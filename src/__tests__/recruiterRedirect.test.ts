import { describe, it, expect } from "vitest";
import { getRecruiterRedirect } from "../../server-handlers/_recruiter-redirect";

describe("_recruiter-redirect", () => {
  it("spouseJobNegotiation → escalate-to-HM advisory", () => {
    const s = getRecruiterRedirect({ spouseJobNegotiation: true });
    expect(s).toMatch(/spouse-job/);
    expect(s).toMatch(/hiring manager/);
  });

  it("recommendWalkAway → walk-away advisory", () => {
    const s = getRecruiterRedirect({ recommendWalkAway: true });
    expect(s).toMatch(/walk-away/);
    expect(s).toMatch(/disengage/);
  });

  it("neither set → null", () => {
    expect(getRecruiterRedirect({})).toBeNull();
  });

  it("spouseJob takes priority over walk-away", () => {
    const s = getRecruiterRedirect({ spouseJobNegotiation: true, recommendWalkAway: true });
    expect(s).toMatch(/spouse-job/);
  });
});
