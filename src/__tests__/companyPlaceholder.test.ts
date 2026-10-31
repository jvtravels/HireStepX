import { describe, expect, it } from "vitest";
import { looksLikePlaceholderProfile } from "../employer/_companyProfileHelpers";
import { deriveOnboardingSteps } from "../employer/onboardingSteps";

describe("looksLikePlaceholderProfile", () => {
  it("flags short names, filler words and the platform's own site", () => {
    expect(looksLikePlaceholderProfile("JV", "acme.com")).toBe(true);
    expect(looksLikePlaceholderProfile("Test", "")).toBe(true);
    expect(looksLikePlaceholderProfile("Acme Pvt Ltd", "https://www.hirestepx.com/")).toBe(true);
  });
  it("leaves real profiles and unloaded (empty) values alone", () => {
    expect(looksLikePlaceholderProfile("Acme Pvt Ltd", "acme.com")).toBe(false);
    expect(looksLikePlaceholderProfile("", "")).toBe(false);
  });
});

describe("company profile step", () => {
  it("is added only for a placeholder profile and links to settings", () => {
    expect(deriveOnboardingSteps({ jobs: [], reviewed: null, unlocked: null })).toHaveLength(3);
    const steps = deriveOnboardingSteps({ jobs: [], reviewed: null, unlocked: null, profilePlaceholder: true });
    expect(steps).toHaveLength(4);
    expect(steps[3].href).toBe("/employer/settings");
  });
});
