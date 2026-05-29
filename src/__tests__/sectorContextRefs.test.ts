import { describe, it, expect } from "vitest";
import {
  pickSectorContextRef,
  applyContextRefOverlay,
  __TEST_ONLY__,
} from "../../server-handlers/_recruiter-prose-realism";
import type { RecruiterSectorPersona } from "../../server-handlers/_indian-recruiter-personas";

const PERSONAS_WITH_BANK: RecruiterSectorPersona[] = [
  "edtech",
  "it-services",
  "gcc",
  "indian-unicorn",
  "early-startup",
  "bfsi",
  "psu",
  "consulting-big4",
  "consulting-mbb",
  "fmcg-management",
];

const BASE = "We can structure the comp around the band we have on file.";

describe("pickSectorContextRef", () => {
  it("is deterministic across 100 calls", () => {
    const ref = pickSectorContextRef("edtech", "sess-det");
    for (let i = 0; i < 100; i++) {
      expect(pickSectorContextRef("edtech", "sess-det")).toBe(ref);
    }
  });

  it("returns null ~50% of the time", () => {
    let nulls = 0;
    const total = 500;
    for (let i = 0; i < total; i++) {
      if (pickSectorContextRef("bfsi", `sess-n-${i}`) === null) nulls++;
    }
    const rate = nulls / total;
    expect(rate).toBeGreaterThanOrEqual(0.35);
    expect(rate).toBeLessThanOrEqual(0.65);
  });

  it("when non-null, the ref belongs to that persona's bank", () => {
    for (const persona of PERSONAS_WITH_BANK) {
      const bank = __TEST_ONLY__.SECTOR_CONTEXT_REFS[persona];
      for (let i = 0; i < 50; i++) {
        const ref = pickSectorContextRef(persona, `sess-${persona}-${i}`);
        if (ref === null) continue;
        expect(bank).toContain(ref);
      }
    }
  });

  it("default persona always returns null (empty bank)", () => {
    for (let i = 0; i < 20; i++) {
      expect(pickSectorContextRef("default", `sess-def-${i}`)).toBeNull();
    }
  });
});

describe("applyContextRefOverlay", () => {
  it("is deterministic across 100 calls (same input -> same output)", () => {
    const out = applyContextRefOverlay(BASE, "edtech", "sess-d");
    for (let i = 0; i < 100; i++) {
      expect(applyContextRefOverlay(BASE, "edtech", "sess-d")).toBe(out);
    }
  });

  it("is idempotent: running twice does not stack", () => {
    for (let i = 0; i < 500; i++) {
      const sessionId = `sess-idem-${i}`;
      const once = applyContextRefOverlay(BASE, "edtech", sessionId);
      if (once === BASE) continue;
      const twice = applyContextRefOverlay(once, "edtech", sessionId);
      expect(twice).toBe(once);
      return;
    }
    throw new Error("no fires across 500 seeds — test invalid");
  });

  it("each persona's bank fires correctly when it does fire", () => {
    for (const persona of PERSONAS_WITH_BANK) {
      const bank = __TEST_ONLY__.SECTOR_CONTEXT_REFS[persona];
      let fired = false;
      for (let i = 0; i < 500; i++) {
        const out = applyContextRefOverlay(BASE, persona, `sess-fire-${persona}-${i}`);
        if (out === BASE) continue;
        const outLower = out.toLowerCase();
        const hit = bank.some((phrase) => outLower.includes(phrase.toLowerCase()));
        expect(hit).toBe(true);
        fired = true;
        break;
      }
      expect(fired).toBe(true);
    }
  });

  it(">=30% of sessionIds produce no overlay (null-path exercises)", () => {
    let noOverlay = 0;
    const total = 200;
    for (let i = 0; i < total; i++) {
      const out = applyContextRefOverlay(BASE, "bfsi", `sess-null-${i}`);
      if (out === BASE) noOverlay++;
    }
    expect(noOverlay / total).toBeGreaterThanOrEqual(0.3);
  });
});
