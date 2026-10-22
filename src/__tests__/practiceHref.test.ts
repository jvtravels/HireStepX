import { describe, it, expect } from "vitest";
import { practiceHref } from "../sessionReport/practiceHref";

describe("practiceHref", () => {
  it("carries type, role and company", () => {
    expect(practiceHref({ type: "behavioral", role: "Senior Product Designer", company: "Flipkart" })).toBe(
      "/session/new?type=behavioral&role=Senior+Product+Designer&company=Flipkart",
    );
  });

  it("sends campus placement as a focus", () => {
    expect(practiceHref({ type: "behavioral", focus: "campus-placement", role: "Analyst" })).toBe(
      "/session/new?focus=campus-placement&role=Analyst",
    );
  });

  it("drops the placeholder role and blank company", () => {
    expect(practiceHref({ type: "technical", role: "Target Role", company: "  " })).toBe("/session/new?type=technical");
  });

  it("falls back to the bare setup page", () => {
    expect(practiceHref({})).toBe("/session/new");
  });
});
