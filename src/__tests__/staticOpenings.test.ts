import { describe, it, expect } from "vitest";
import { STATIC_OPENINGS, liveStaticOpenings } from "../../server-handlers/_static-openings";
import { fetchLiveOpenings } from "../../server-handlers/_public-openings-fetch";

describe("static openings", () => {
  it("only returns entries that have not expired", () => {
    const far = new Date("2999-01-01");
    expect(liveStaticOpenings(far)).toEqual([]);
    for (const o of liveStaticOpenings(new Date("2000-01-01"))) {
      expect(Date.parse(o.expiresAt)).toBeGreaterThan(Date.parse("2000-01-01"));
    }
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
