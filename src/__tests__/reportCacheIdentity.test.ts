import { describe, it, expect } from "vitest";
import { buildReportCacheVersion } from "../../server-handlers/evaluate-session";

/* OA-B20 regression: the report cache identity must fold in the
   calibration-affecting inputs (company / role / difficulty) so editing any of
   them is a cache MISS that recomputes bands, instead of serving a stale-band
   report keyed only on (sessionId, REPORT_VERSION).

   buildReportCacheVersion is the ONE shared key-builder used by both the write
   path (saveCachedReport) and the read path (loadCachedReport). loadCachedReport
   returns a row only when row.report_version === buildReportCacheVersion(meta),
   so "different identity ⇒ different version string" == "different identity ⇒
   cache miss". These tests assert that equivalence at the builder. */

const base = { targetCompany: "Google", role: "SWE", difficulty: "standard" };

describe("buildReportCacheVersion — OA-B20 cache identity", () => {
  it("returns the same version string when identity inputs match (cache HIT)", async () => {
    const a = await buildReportCacheVersion(base);
    const b = await buildReportCacheVersion({ ...base });
    expect(a).toBe(b);
  });

  it("changes the version when targetCompany differs (cache MISS)", async () => {
    const a = await buildReportCacheVersion(base);
    const b = await buildReportCacheVersion({ ...base, targetCompany: "Amazon" });
    expect(b).not.toBe(a);
  });

  it("changes the version when role differs (cache MISS)", async () => {
    const a = await buildReportCacheVersion(base);
    const b = await buildReportCacheVersion({ ...base, role: "PM" });
    expect(b).not.toBe(a);
  });

  it("changes the version when difficulty differs (cache MISS)", async () => {
    const a = await buildReportCacheVersion(base);
    const b = await buildReportCacheVersion({ ...base, difficulty: "hard" });
    expect(b).not.toBe(a);
  });

  it("is stable under cosmetic-only differences (case / whitespace / null-vs-empty)", async () => {
    const a = await buildReportCacheVersion(base);
    const b = await buildReportCacheVersion({
      targetCompany: "  google ",
      role: "swe",
      difficulty: "STANDARD",
    });
    expect(b).toBe(a);
    // null and "" collapse to the same normalized empty value
    const empty1 = await buildReportCacheVersion({ targetCompany: null, role: null, difficulty: null });
    const empty2 = await buildReportCacheVersion({ targetCompany: "", role: "", difficulty: "" });
    expect(empty1).toBe(empty2);
  });

  it("carries the schema REPORT_VERSION prefix so a schema bump also invalidates", async () => {
    const v = await buildReportCacheVersion(base);
    expect(v).toMatch(/^mvp-9:/);
    // and appends a hash of the identity inputs
    expect(v.split(":")[1]).toMatch(/^[0-9a-f]{24}$/);
  });
});
