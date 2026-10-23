import { describe, it, expect } from "vitest";
import { isStagingHost, isStagingAuthorized } from "../stagingGate";

const creds = "team:s3cret";
const basic = (s: string) => `Basic ${btoa(s)}`;

describe("isStagingHost", () => {
  it("matches only the staging host", () => {
    expect(isStagingHost("staging.hirestepx.com")).toBe(true);
    expect(isStagingHost("Staging.HireStepX.com")).toBe(true);
    expect(isStagingHost("hirestepx.com")).toBe(false);
    expect(isStagingHost("staging.hirestepx.com.evil.example")).toBe(false);
  });
});

describe("isStagingAuthorized", () => {
  it("accepts the exact credentials", () => {
    expect(isStagingAuthorized(basic(creds), creds)).toBe(true);
  });
  it("rejects wrong, missing and non-Basic headers", () => {
    expect(isStagingAuthorized(basic("team:wrong"), creds)).toBe(false);
    expect(isStagingAuthorized(null, creds)).toBe(false);
    expect(isStagingAuthorized("Bearer abc", creds)).toBe(false);
    expect(isStagingAuthorized("Basic !!!notbase64", creds)).toBe(false);
  });
  it("fails closed when the secret is unset or malformed", () => {
    expect(isStagingAuthorized(basic(":"), undefined)).toBe(false);
    expect(isStagingAuthorized(basic(""), "")).toBe(false);
    expect(isStagingAuthorized(basic("nocolon"), "nocolon")).toBe(false);
  });
});
