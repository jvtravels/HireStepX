import { describe, it, expect } from "vitest";
import { defaultCompanyFromEmail, looksLikePlaceholderProfile } from "../employer/_companyProfileHelpers";

describe("defaultCompanyFromEmail", () => {
  it("names the company from the work-email domain and uses the domain as website", () => {
    expect(defaultCompanyFromEmail("priya@acme.com")).toEqual({ companyName: "Acme", website: "acme.com" });
    expect(defaultCompanyFromEmail("Priya@Acme-Labs.co.in")).toEqual({ companyName: "Acme Labs", website: "acme-labs.co.in" });
  });

  it("falls back safely on a malformed address", () => {
    expect(defaultCompanyFromEmail("nobody")).toEqual({ companyName: "My company", website: "example.com" });
  });

  it("produces a name the dashboard nudges to correct when it is too short", () => {
    const d = defaultCompanyFromEmail("a@ab.com");
    expect(looksLikePlaceholderProfile(d.companyName, d.website)).toBe(true);
  });
});
