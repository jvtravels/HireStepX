import { describe, it, expect } from "vitest";
import { STATIC_OPENINGS, liveStaticOpenings } from "../../server-handlers/_static-openings";
import { fetchLiveOpenings } from "../../server-handlers/_public-openings-fetch";

describe("static openings", () => {
  it("lists the SDR role while unexpired and hides it after expiry", () => {
    expect(liveStaticOpenings(new Date("2026-11-01")).map((o) => o.slug)).toContain(STATIC_OPENINGS[0].slug);
    expect(liveStaticOpenings(new Date("2027-01-01"))).toEqual([]);
  });
  it("keeps summaries within the public limits", () => {
    for (const o of STATIC_OPENINGS) {
      expect(o.title.length).toBeLessThanOrEqual(120);
      expect(o.summary.length).toBeLessThanOrEqual(280);
    }
  });
  it("still serves static roles when the database is unavailable", async () => {
    const failing = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    const out = await fetchLiveOpenings(failing);
    expect(out.length).toBe(liveStaticOpenings().length);
  });
});
