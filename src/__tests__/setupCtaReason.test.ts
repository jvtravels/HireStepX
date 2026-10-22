import { describe, it, expect } from "vitest";
import { getCtaReason, type CtaReasonInput } from "../setupCtaReason";

const base: CtaReasonInput = {
  starting: false, formComplete: true, hasRole: true, companyMissing: false,
  roleCompanyMismatch: false, isOnline: true, micStatus: "granted", needsMic: false,
};

describe("getCtaReason", () => {
  it("returns null when ready to start", () => {
    expect(getCtaReason(base)).toBeNull();
  });
  it("returns null while starting", () => {
    expect(getCtaReason({ ...base, starting: true, formComplete: false })).toBeNull();
  });
  it("asks for a role first", () => {
    expect(getCtaReason({ ...base, formComplete: false, hasRole: false })).toMatch(/role/);
  });
  it("asks for a company when required", () => {
    expect(getCtaReason({ ...base, formComplete: false, companyMissing: true })).toMatch(/company/i);
  });
  it("flags a role/company mismatch", () => {
    expect(getCtaReason({ ...base, formComplete: false, roleCompanyMismatch: true })).toMatch(/go together/);
  });
  it("falls back to the focus prompt", () => {
    expect(getCtaReason({ ...base, formComplete: false })).toMatch(/focus/);
  });
  it("reports offline", () => {
    expect(getCtaReason({ ...base, isOnline: false })).toMatch(/offline/i);
  });
  it("explains a pending mic prompt", () => {
    expect(getCtaReason({ ...base, micStatus: "requesting" })).toMatch(/Waiting for microphone/);
  });
  it("distinguishes denied from not-yet-asked mic", () => {
    expect(getCtaReason({ ...base, micStatus: "denied", needsMic: true })).toMatch(/blocked/);
    expect(getCtaReason({ ...base, micStatus: "idle", needsMic: true })).toMatch(/need microphone/);
  });
});
