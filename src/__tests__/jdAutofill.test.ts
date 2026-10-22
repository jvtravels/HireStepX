import { describe, it, expect } from "vitest";
import type { JdField, JdFields } from "../../data/jd-extraction";
import { initialDraft } from "../employer/_requirementFormHelpers";
import {
  checkJdFile, displayValue, draftDisplay, draftSignature, outcomeCounts, planImport, resetPatch,
} from "../employer/_jdAutofillHelpers";

const base = initialDraft(undefined);
const field = <T,>(value: T, confidence: JdField<T>["confidence"] = "high"): JdField<T> => ({ value, confidence, evidence: "q", source: "llm" });

describe("planImport", () => {
  it("fills blank fields straight away and converts numbers to the form's string values", () => {
    const fields: JdFields = {
      title: field("Backend Engineer"),
      experience: field({ min: 4, max: 7 }),
      salary: field({ type: "per-annum" as const, min: 25, max: 35 }),
    };
    const plan = planImport(fields, base, base);
    expect(plan.applyNow).toMatchObject({
      title: "Backend Engineer", experienceMin: "4", experienceMax: "7", salaryType: "per-annum", budgetMin: "25", budgetMax: "35",
    });
    expect(plan.items.every((i) => i.status === "applied")).toBe(true);
  });

  it("never overwrites a field the employer already filled; it becomes a suggestion", () => {
    const draft = { ...base, title: "My own title" };
    const plan = planImport({ title: field("Backend Engineer") }, draft, base);
    expect(plan.applyNow).toEqual({});
    expect(plan.items[0]).toMatchObject({ status: "suggested", reason: "already-filled" });
  });

  it("keeps low-confidence values as suggestions", () => {
    const plan = planImport({ skills: field(["Java"], "low") }, base, base);
    expect(plan.applyNow).toEqual({});
    expect(plan.items[0]).toMatchObject({ status: "suggested", reason: "low-confidence" });
  });

  it("does not auto-apply a work mode the employer already changed", () => {
    const draft = { ...base, workMode: base.workMode === "onsite" ? "remote" as const : "onsite" as const };
    const plan = planImport({ workMode: field("hybrid" as const) }, draft, base);
    expect(plan.items[0].status).toBe("suggested");
  });

  it("applying a suggested list unions with what is already there", () => {
    const draft = { ...base, skills: ["Java"] };
    const plan = planImport({ skills: field(["java", "Kafka"]) }, draft, base);
    expect(plan.items[0].patch.skills).toEqual(["Java", "Kafka"]);
  });

  it("skips duration and hours for full-time roles", () => {
    const plan = planImport({ employmentType: field("full-time" as const), durationWeeks: field(12), hoursPerWeek: field(20) }, base, base);
    expect(plan.items.map((i) => i.key)).toEqual(["employmentType"]);
  });

  it("keeps duration and hours for internships", () => {
    const plan = planImport({ employmentType: field("internship" as const), durationWeeks: field(12), hoursPerWeek: field(20) }, base, base);
    expect(plan.applyNow).toMatchObject({ employmentType: "internship", durationWeeks: "12", hoursPerWeek: "20" });
  });

  it("leaves a half-open experience range's missing side untouched", () => {
    const plan = planImport({ experience: field({ min: 5, max: null }) }, base, base);
    expect(plan.applyNow.experienceMin).toBe("5");
    expect("experienceMax" in plan.applyNow).toBe(false);
  });
});

describe("display, undo and outcome", () => {
  it("formats salary with the right unit", () => {
    expect(displayValue("salary", field({ type: "per-annum", min: 25, max: 35 }))).toBe("₹25 to 35 LPA");
    expect(displayValue("salary", field({ type: "per-month", min: 15000, max: 15000 }))).toBe("₹15,000 per month");
  });

  it("resets only the imported fields the employer has not edited since", () => {
    const imported = { title: draftSignature("title", { ...base, title: "A" }), department: draftSignature("department", { ...base, department: "Eng" }) };
    const out = resetPatch(imported, { ...base, title: "A", department: "Sales" }, base);
    expect(out.keys).toEqual(["title"]);
    expect(out.patch).toEqual({ title: base.title });
  });

  it("counts imported fields kept versus edited after import", () => {
    const imported = { title: draftSignature("title", { ...base, title: "A" }), department: draftSignature("department", { ...base, department: "Eng" }) };
    expect(outcomeCounts(imported, { ...base, title: "A", department: "Sales" })).toEqual({ kept: 1, edited: 1 });
  });
});

describe("draftDisplay", () => {
  it("formats what the form currently holds and returns blank for empty fields", () => {
    const d = { ...initialDraft(undefined), title: "Edited by me", experienceMin: "2", experienceMax: "4", budgetMin: "10", budgetMax: "15", skills: ["Go", "SQL"] };
    expect(draftDisplay("title", d)).toBe("Edited by me");
    expect(draftDisplay("experience", d)).toBe("2 to 4 years");
    expect(draftDisplay("salary", d)).toMatch(/10 to 15 LPA/);
    expect(draftDisplay("skills", d)).toBe("Go, SQL");
    expect(draftDisplay("department", d)).toBe("");
    expect(draftDisplay("locations", d)).toBe("");
    expect(draftDisplay("experience", initialDraft(undefined))).toBe("");
  });
});

describe("checkJdFile", () => {
  const file = (name: string, size = 100) => new File([new Uint8Array(size)], name);

  it("accepts pdf, docx and txt", () => {
    for (const n of ["a.pdf", "b.DOCX", "c.txt"]) expect(checkJdFile(file(n))).toBeNull();
  });

  it("explains old .doc files", () => {
    expect(checkJdFile(file("a.doc"))).toMatch(/docx/i);
  });

  it("rejects other types, empty files and oversized files", () => {
    expect(checkJdFile(file("a.png"))).not.toBeNull();
    expect(checkJdFile(file("a.pdf", 0))).toMatch(/empty/i);
    expect(checkJdFile(file("a.pdf", 5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
  });
});
