import { describe, it, expect } from "vitest";
import { stripHonorifics } from "../../server-handlers/_adversarial-detector";

describe("Bug 6: stripHonorifics", () => {
  it("removes trailing 'sir'", () => {
    const r = stripHonorifics("Welcome to the call, sir.");
    expect(r.text.toLowerCase()).not.toContain("sir");
    expect(r.applied).toBe(true);
  });
  it("removes leading 'Sir,'", () => {
    const r = stripHonorifics("Sir, please share your expected CTC.");
    expect(r.text.toLowerCase()).not.toMatch(/\bsir\b/);
    expect(r.applied).toBe(true);
  });
  it("removes mid-sentence 'sir'", () => {
    const r = stripHonorifics("Can you tell me sir what your current package is?");
    expect(r.text.toLowerCase()).not.toMatch(/\bsir\b/);
    expect(r.applied).toBe(true);
  });
  it("removes 'ma'am' and 'madam'", () => {
    expect(stripHonorifics("Thank you ma'am for your time.").text.toLowerCase()).not.toMatch(/ma'am/);
    expect(stripHonorifics("Yes, madam.").text.toLowerCase()).not.toContain("madam");
  });
  it("strips 'Mr. Smith' down to 'Smith'", () => {
    const r = stripHonorifics("Hello Mr. Smith, the offer is 22 LPA.");
    expect(r.text).toContain("Smith");
    expect(r.text).not.toContain("Mr.");
    expect(r.applied).toBe(true);
  });
  it("leaves clean text unchanged", () => {
    const r = stripHonorifics("Welcome Priya, the offer is 22 LPA.");
    expect(r.applied).toBe(false);
    expect(r.text).toBe("Welcome Priya, the offer is 22 LPA.");
  });
});
