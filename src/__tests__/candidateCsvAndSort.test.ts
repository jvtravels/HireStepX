import { describe, it, expect } from "vitest";
import { candidatesToCsv, csvCell, csvFileName, exportableCandidates } from "../../app/(employer)/employer/requirements/[id]/_components/candidateCsv";
import { describeSort, skillChipSlots } from "../../app/(employer)/employer/requirements/[id]/_components/candidateTableModel";
import type { Candidate } from "../employer/mockData";

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    id: "m-1",
    name: "Asha Rao",
    targetRole: "Backend Engineer",
    city: "Pune",
    matchScore: 82,
    rosterScore: 74.2,
    sessionsCompleted: 2,
    candidateStatus: "shortlisted",
    unlocked: true,
    skills: ["Node.js", "SQL"],
    contact: { email: "asha@example.com", phone: "+91 98765 43210" },
    portfolioLinks: [{ title: "GitHub", url: "https://github.com/asha" }],
    resume: { noticePeriod: "30 days", linkedin: "https://linkedin.com/in/asha", headline: "", summary: "", keyAchievements: [], certifications: [], skillsDetailed: [], experience: [], education: [] },
    ...over,
  } as unknown as Candidate;
}

describe("csvCell", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a, "b"\nc')).toBe('"a, ""b""\nc"');
  });

  it("defuses spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("@sum")).toBe("'@sum");
    expect(csvCell("-1+1")).toBe("'-1+1");
  });

  it("leaves numbers and empty values alone", () => {
    expect(csvCell(82)).toBe("82");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });
});

describe("candidatesToCsv", () => {
  it("exports unlocked candidates only and never a locked name or contact", () => {
    const locked = candidate({ id: "m-2", name: "Secret Person", unlocked: false, contact: { email: "secret@example.com" } });
    expect(exportableCandidates([candidate(), locked])).toHaveLength(1);
    const csv = candidatesToCsv([candidate(), locked], ["Node.js", "Python"]);
    expect(csv).not.toContain("Secret Person");
    expect(csv).not.toContain("secret@example.com");
    const [header, row] = csv.split("\r\n");
    expect(header.startsWith("Name,Email,Phone")).toBe(true);
    expect(row).toContain("Asha Rao,asha@example.com,'+91 98765 43210,Backend Engineer,Pune,30 days,82,74,2,Node.js,Python,To review");
    expect(row).toContain("https://linkedin.com/in/asha,https://github.com/asha");
  });

  it("writes only the header when nothing is unlocked", () => {
    expect(candidatesToCsv([candidate({ unlocked: false })], [])).not.toContain("\r\n");
  });
});

describe("csvFileName", () => {
  it("slugs the job title and falls back when it has no letters", () => {
    expect(csvFileName("Senior Backend Engineer (Pune)")).toBe("senior-backend-engineer-pune-unlocked-candidates.csv");
    expect(csvFileName("???")).toBe("candidates-unlocked-candidates.csv");
  });
});

describe("describeSort", () => {
  it("names the column and the order in plain words", () => {
    expect(describeSort({ column: "match", direction: "desc" })).toEqual({ name: "Match score", order: "high to low" });
    expect(describeSort({ column: "name", direction: "asc" })).toEqual({ name: "Name", order: "A to Z" });
    expect(describeSort({ column: "pipeline", direction: "desc" })).toEqual({ name: "Stage", order: "latest first" });
  });
});

describe("skillChipSlots", () => {
  it("shows matched skills first and counts the rest", () => {
    expect(skillChipSlots(["A", "B", "C", "D", "E"], [])).toEqual({ matched: ["A", "B", "C"], gaps: [], hidden: 2 });
  });

  it("always keeps a slot for a missing skill", () => {
    expect(skillChipSlots(["A", "B", "C", "D"], ["X", "Y"])).toEqual({ matched: ["A", "B"], gaps: ["X"], hidden: 3 });
    expect(skillChipSlots(["A"], ["X", "Y", "Z", "W"])).toEqual({ matched: ["A"], gaps: ["X", "Y"], hidden: 2 });
  });

  it("shows everything when it fits", () => {
    expect(skillChipSlots(["A"], ["X"])).toEqual({ matched: ["A"], gaps: ["X"], hidden: 0 });
    expect(skillChipSlots([], [])).toEqual({ matched: [], gaps: [], hidden: 0 });
  });
});
