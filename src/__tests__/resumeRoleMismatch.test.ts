import { describe, it, expect } from "vitest";
import { detectResumeRoleMismatch } from "../../server-handlers/_resume-role-match";

describe("Bug 4: detectResumeRoleMismatch", () => {
  it("hard: product designer → java developer", () => {
    const r = detectResumeRoleMismatch({ resumeTitle: "Senior Product Designer", targetRole: "Java Developer" });
    expect(r.mismatch).toBe(true);
    expect(r.severity).toBe("hard");
  });
  it("hard: sales → backend engineer", () => {
    const r = detectResumeRoleMismatch({ resumeTitle: "Account Executive Sales", targetRole: "Backend Engineer" });
    expect(r.mismatch).toBe(true);
    expect(r.severity).toBe("hard");
  });
  it("hard: data scientist → frontend dev", () => {
    const r = detectResumeRoleMismatch({ resumeTitle: "Data Scientist", targetRole: "Frontend Developer (React)" });
    expect(r.mismatch).toBe(true);
    expect(r.severity).toBe("hard");
  });
  it("soft: backend dev → frontend role (same family)", () => {
    const r = detectResumeRoleMismatch({ resumeTitle: "Backend Engineer", targetRole: "Frontend Engineer (React)" });
    expect(r.mismatch).toBe(true);
    expect(r.severity).toBe("soft");
  });
  it("soft: QA → SDE", () => {
    const r = detectResumeRoleMismatch({ resumeTitle: "QA Engineer", targetRole: "Backend Developer" });
    expect(r.mismatch).toBe(true);
    expect(r.severity).toBe("soft");
  });
  it("match: react dev → react dev", () => {
    expect(
      detectResumeRoleMismatch({ resumeTitle: "React Developer", targetRole: "React Developer" }).mismatch,
    ).toBe(false);
  });
  it("match: product designer → UX designer", () => {
    expect(
      detectResumeRoleMismatch({ resumeTitle: "Product Designer", targetRole: "UX Designer" }).mismatch,
    ).toBe(false);
  });
  it("none on unknown title", () => {
    expect(
      detectResumeRoleMismatch({ resumeTitle: null, targetRole: "React Developer" }).mismatch,
    ).toBe(false);
  });
});
