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

/* Single-fire-per-session (2026-06-18). A market-context aside is a one-
 * time band-framing remark, not a verbal tic. Before this, the identical
 * deterministic phrase bolted onto 3-4 lines of one negotiation. The
 * overlay now fires on exactly one early turn (turnIndex gate). */
describe("applyContextRefOverlay — single fire per session", () => {
  /** A persona+sessionId whose context-ref pick is non-null (will fire). */
  function firingSession(): { persona: RecruiterSectorPersona; sid: string } {
    for (let i = 0; i < 2000; i++) {
      const sid = `sess-onefire-${i}`;
      if (pickSectorContextRef("indian-unicorn", sid) !== null) {
        return { persona: "indian-unicorn", sid };
      }
    }
    throw new Error("no firing session found — test invalid");
  }

  it("fires on at most one turn across a 12-turn sweep", () => {
    // Sweep many sessions so we cover every chosenTurn bucket.
    for (let s = 0; s < 200; s++) {
      const sid = `sess-sweep-${s}`;
      if (pickSectorContextRef("gcc", sid) === null) continue;
      let fires = 0;
      for (let ti = 0; ti < 12; ti++) {
        if (applyContextRefOverlay(BASE, "gcc", sid, ti) !== BASE) fires++;
      }
      expect(fires, `session ${sid} fired on ${fires} turns`).toBe(1);
    }
  });

  it("the single fire lands inside the early band-framing window (turn < 3)", () => {
    const { persona, sid } = firingSession();
    let firedAt = -1;
    for (let ti = 0; ti < 12; ti++) {
      if (applyContextRefOverlay(BASE, persona, sid, ti) !== BASE) {
        firedAt = ti;
        break;
      }
    }
    expect(firedAt).toBeGreaterThanOrEqual(0);
    expect(firedAt).toBeLessThan(3);
  });

  it("does not fire on a late turn (turnIndex 6) — the regression case", () => {
    // Every firing session must be silent at turn 6 (the buyout turn that
    // leaked the phrase before the fix).
    for (let s = 0; s < 200; s++) {
      const sid = `sess-late-${s}`;
      if (pickSectorContextRef("indian-unicorn", sid) === null) continue;
      expect(applyContextRefOverlay(BASE, "indian-unicorn", sid, 6)).toBe(BASE);
    }
  });

  it("omitted turnIndex defaults to turn 0 (back-compat for callers)", () => {
    const { persona, sid } = firingSession();
    const withArg = applyContextRefOverlay(BASE, persona, sid, 0);
    const noArg = applyContextRefOverlay(BASE, persona, sid);
    expect(noArg).toBe(withArg);
  });
});
