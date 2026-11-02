import { describe, expect, it } from "vitest";
import { roleToFamily } from "../sessionReport/SessionReport";

describe("roleToFamily", () => {
  it("does not mistake 'development' for PM", () => {
    expect(roleToFamily("Software Development Engineer Intern")).toBe("swe");
  });
  it("does not mistake 'HTML' or 'maintain' for data", () => {
    expect(roleToFamily("HTML Developer")).toBe("swe");
    expect(roleToFamily("Site Maintainer")).toBe("swe");
  });
  it("still classifies real PM, EM, data and HR roles", () => {
    expect(roleToFamily("Product Manager")).toBe("pm");
    expect(roleToFamily("APM / PM Intern")).toBe("pm");
    expect(roleToFamily("Engineering Manager")).toBe("em");
    expect(roleToFamily("Data Analyst")).toBe("data");
    expect(roleToFamily("ML Engineer")).toBe("data");
    expect(roleToFamily("HR Round")).toBe("behavioral");
  });
});
