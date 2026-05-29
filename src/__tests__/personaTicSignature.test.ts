import { describe, it, expect } from "vitest";
import {
  pickPersonaTicSignature,
  applyPersonaTicSignature,
  __TEST_ONLY__,
} from "../../server-handlers/_recruiter-prose-realism";

describe("pickPersonaTicSignature", () => {
  it("same (sessionId, persona) returns the same signature across 100 calls", () => {
    const ref = pickPersonaTicSignature("sess-X", "bfsi");
    for (let i = 0; i < 100; i++) {
      const sig = pickPersonaTicSignature("sess-X", "bfsi");
      expect(sig).toEqual(ref);
    }
  });

  it("returns 2 or 3 tics", () => {
    for (let i = 0; i < 50; i++) {
      const sig = pickPersonaTicSignature(`sess-c-${i}`, "indian-unicorn");
      expect(sig.length).toBeGreaterThanOrEqual(2);
      expect(sig.length).toBeLessThanOrEqual(3);
    }
  });

  it("different sessions of same persona produce different signatures (>=30% variance over 50)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const sig = pickPersonaTicSignature(`sess-var-${i}`, "early-startup");
      seen.add(sig.slice().sort().join("|"));
    }
    /* >=30% variance means >=15 distinct signatures out of 50 sessions. */
    expect(seen.size).toBeGreaterThanOrEqual(15);
  });

  it("BFSI signature contains only formal tics", () => {
    const formal = __TEST_ONLY__.FORMAL_ONLY_TICS;
    for (let i = 0; i < 50; i++) {
      const sig = pickPersonaTicSignature(`sess-bfsi-${i}`, "bfsi");
      for (const tic of sig) {
        expect(formal.has(tic)).toBe(true);
      }
    }
  });

  it("early-startup signature contains at least one casual tic in >=60% of sessions", () => {
    const casual = __TEST_ONLY__.CASUAL_TICS;
    let withCasual = 0;
    const total = 100;
    for (let i = 0; i < total; i++) {
      const sig = pickPersonaTicSignature(`sess-startup-${i}`, "early-startup");
      if (sig.some((t) => casual.has(t))) withCasual++;
    }
    expect(withCasual / total).toBeGreaterThanOrEqual(0.6);
  });
});

describe("applyPersonaTicSignature", () => {
  const BASE = "We can structure the comp around the band on file.";

  it("is deterministic for (sessionId, text, persona)", () => {
    const a = applyPersonaTicSignature(BASE, "sess-det", "indian-unicorn");
    const b = applyPersonaTicSignature(BASE, "sess-det", "indian-unicorn");
    expect(a).toBe(b);
  });

  it("fires at roughly the configured rate (~20%) across many sessions", () => {
    let fires = 0;
    const total = 500;
    for (let i = 0; i < total; i++) {
      const out = applyPersonaTicSignature(BASE, `sess-rate-${i}`, "indian-unicorn");
      if (out !== BASE) fires++;
    }
    const rate = fires / total;
    /* Loose bound around the 20% nominal rate. */
    expect(rate).toBeGreaterThanOrEqual(0.1);
    expect(rate).toBeLessThanOrEqual(0.3);
  });

  it("is idempotent: re-applying does not stack", () => {
    for (let i = 0; i < 500; i++) {
      const sessionId = `sess-idem-${i}`;
      const once = applyPersonaTicSignature(BASE, sessionId, "early-startup");
      if (once === BASE) continue;
      const twice = applyPersonaTicSignature(once, sessionId, "early-startup");
      expect(twice).toBe(once);
      return;
    }
    throw new Error("no fire across 500 seeds — test invalid");
  });

  it("skips when text already begins with a known sector tic prefix", () => {
    const prefixed = "Look, we can structure the comp around the band on file.";
    for (let i = 0; i < 20; i++) {
      const out = applyPersonaTicSignature(prefixed, `sess-skip-${i}`, "indian-unicorn");
      expect(out).toBe(prefixed);
    }
  });
});
