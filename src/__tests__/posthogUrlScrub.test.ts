import { describe, it, expect } from "vitest";
import { scrubCandidateUrl, scrubEventUrls } from "../posthogClient";

describe("posthog candidate URL scrub", () => {
  it("replaces the candidate id and keeps the rest of the path", () => {
    expect(scrubCandidateUrl("https://app.hirestepx.com/employer/requirements/r1/candidates/abc-123?tab=x"))
      .toBe("https://app.hirestepx.com/employer/requirements/r1/candidates/:id?tab=x");
  });
  it("leaves other URLs alone", () => {
    expect(scrubCandidateUrl("/employer/jobs")).toBe("/employer/jobs");
  });
  it("scrubs url properties on an event and tolerates a missing bag", () => {
    const e = scrubEventUrls({ properties: { $current_url: "/a/candidates/zz", $pathname: "/a/candidates/zz", other: "/candidates/zz" } });
    expect(e.properties).toEqual({ $current_url: "/a/candidates/:id", $pathname: "/a/candidates/:id", other: "/candidates/zz" });
    expect(scrubEventUrls({})).toEqual({});
  });
});
