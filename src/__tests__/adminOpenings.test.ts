import { describe, it, expect } from "vitest";
import { mentionsCompany, validateOpeningInput, PUBLIC_SUMMARY_MAX } from "../../server-handlers/_admin-openings";

describe("mentionsCompany", () => {
  it("matches the whole company name ignoring case and punctuation", () => {
    expect(mentionsCompany("Join ACME Corp today", "Acme Corp")).toBe(true);
    expect(mentionsCompany("acme-corp is hiring", "Acme Corp")).toBe(true);
  });
  it("does not flag unrelated words that merely contain the name", () => {
    expect(mentionsCompany("A pacmen themed role", "Acme")).toBe(false);
    expect(mentionsCompany("Own a territory", "Acme Corp")).toBe(false);
  });
  it("ignores empty or one-letter names", () => {
    expect(mentionsCompany("anything", "")).toBe(false);
    expect(mentionsCompany("a role", "A")).toBe(false);
  });
});

describe("validateOpeningInput", () => {
  const ok = { decision: "approve", publicSummary: "Own a territory and close inbound leads." };
  it("approves with the current title when no override is given", () => {
    expect(validateOpeningInput(ok, "Sales Executive", "Acme Corp")).toEqual({ decision: "approve", summary: ok.publicSummary, title: "Sales Executive" });
  });
  it("needs a summary", () => {
    expect(() => validateOpeningInput({ decision: "approve", publicSummary: "  " }, "Sales", "Acme")).toThrow(/publicSummary required/);
  });
  it("caps the summary length", () => {
    expect(() => validateOpeningInput({ decision: "approve", publicSummary: "x".repeat(PUBLIC_SUMMARY_MAX + 1) }, "Sales", "Acme")).toThrow(/characters or fewer/);
  });
  it("refuses public text that names the company, in the summary or the title", () => {
    expect(() => validateOpeningInput({ decision: "approve", publicSummary: "Work at Acme Corp in Pune" }, "Sales", "Acme Corp")).toThrow(/company name/);
    expect(() => validateOpeningInput(ok, "Sales Exec at Acme Corp", "Acme Corp")).toThrow(/company name/);
  });
  it("lets an admin override a title that names the company", () => {
    expect(validateOpeningInput({ ...ok, publicTitle: "Sales Executive" }, "Sales Exec at Acme Corp", "Acme Corp").title).toBe("Sales Executive");
  });
  it("unpublish needs no text, and unknown decisions are rejected", () => {
    expect(validateOpeningInput({ decision: "unpublish" }, "Sales", "Acme").decision).toBe("unpublish");
    expect(() => validateOpeningInput({ decision: "publish" }, "Sales", "Acme")).toThrow(/decision must be/);
  });
});
