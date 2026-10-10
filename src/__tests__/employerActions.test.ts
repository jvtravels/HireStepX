// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  REPORT_NOTE_MAX, REPORT_REASONS, dropMatchFromCaches, normalizeResponse, readStoredResponse,
  reasonLabel, responseLabel, storeResponse,
} from "../employerActions";

describe("employerActions helpers", () => {
  beforeEach(() => localStorage.clear());

  it("labels every report reason and falls back safely", () => {
    for (const r of REPORT_REASONS) expect(reasonLabel(r.value)).toBe(r.label);
    expect(reasonLabel("bogus" as never)).toBe("Other");
  });

  it("offers exactly the reasons the API accepts", () => {
    expect(REPORT_REASONS.map((r) => r.value).sort()).toEqual(
      ["discriminatory", "fake_company", "harassment", "off_platform_solicitation", "other", "spam"],
    );
    expect(REPORT_NOTE_MAX).toBe(500);
  });

  it("describes the candidate's response", () => {
    expect(responseLabel("interested")).toBe("You said: Interested");
    expect(responseLabel("declined")).toBe("You said: Not interested");
    expect(responseLabel(null)).toBeNull();
  });

  it("normalizes unknown response values to null", () => {
    expect(normalizeResponse("interested")).toBe("interested");
    expect(normalizeResponse("maybe")).toBeNull();
    expect(normalizeResponse(undefined)).toBeNull();
  });

  it("round-trips and clears a stored response", () => {
    storeResponse("m1", "declined");
    expect(readStoredResponse("m1")).toBe("declined");
    storeResponse("m1", null);
    expect(readStoredResponse("m1")).toBeNull();
  });

  it("drops a blocked match from both cached lists", () => {
    const body = JSON.stringify({ shortlistedCount: 2, recent: [{ id: "a" }, { id: "b" }] });
    localStorage.setItem("hirestepx_cache_hiring_activity_full_u1", body);
    localStorage.setItem("hirestepx_cache_hiring_activity_teaser_u1", body);
    dropMatchFromCaches("u1", "a");
    for (const k of ["full", "teaser"]) {
      const parsed = JSON.parse(localStorage.getItem(`hirestepx_cache_hiring_activity_${k}_u1`) ?? "{}");
      expect(parsed.recent).toEqual([{ id: "b" }]);
      expect(parsed.shortlistedCount).toBe(1);
    }
  });

  it("ignores missing caches and missing user ids", () => {
    expect(() => dropMatchFromCaches(undefined, "a")).not.toThrow();
    expect(() => dropMatchFromCaches("u2", "a")).not.toThrow();
  });
});
