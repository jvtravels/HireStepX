/* Power-posture overlay tests (2026-05-30).
 *
 * Asserts the sector × power-strength prose injection added to the
 * recruiter prose chain. The kernel already shipped recruiterPower as a
 * scalar; this overlay is what makes the scalar audible.
 *
 * Contract under test:
 *   • Fires only at |recruiterPower| ≥ 2 (no behavior at |power| ≤ 1).
 *   • Bank is keyed on (persona × hungry|leveraged) — IT-services
 *     hungry must read differently from unicorn hungry, etc.
 *   • ~20% fire rate via FNV — most turns must remain unchanged so the
 *     posture is seasoning, not a chorus.
 *   • Idempotent: re-applying must be a byte-identical no-op.
 *   • Snapshot baseline safe: empty sessionId OR persona="default" →
 *     no-op regardless of power. */

import { describe, it, expect } from "vitest";
import {
  applyPowerPostureOverlay,
  __TEST_ONLY__,
} from "../../server-handlers/_recruiter-prose-realism";
import type { RecruiterSectorPersona } from "../../server-handlers/_indian-recruiter-personas";

const BASE = "We can structure the comp around a base and variable split, and the joining bonus offsets the notice-period gap.";

const NON_DEFAULT_SECTORS: RecruiterSectorPersona[] = [
  "it-services", "gcc", "indian-unicorn", "early-startup",
  "bfsi", "psu", "consulting-big4", "consulting-mbb",
  "fmcg-management", "edtech",
];

function fireRate(persona: RecruiterSectorPersona, power: number, n = 400): number {
  let fires = 0;
  for (let i = 0; i < n; i++) {
    const out = applyPowerPostureOverlay(BASE, persona, `s-rate-${persona}-${i}`, power);
    if (out !== BASE) fires++;
  }
  return fires / n;
}

describe("power-posture overlay — gate semantics", () => {
  it("no-op when |power| < 2 (equilibrium band)", () => {
    for (const p of [-1, -0.5, 0, 0.5, 1]) {
      for (const persona of NON_DEFAULT_SECTORS) {
        const out = applyPowerPostureOverlay(BASE, persona, "s-equilibrium", p);
        expect(out).toBe(BASE);
      }
    }
  });

  it("fires at |power| ≥ 2 across sectors", () => {
    for (const persona of NON_DEFAULT_SECTORS) {
      expect(fireRate(persona, -3)).toBeGreaterThan(0.10);
      expect(fireRate(persona, +3)).toBeGreaterThan(0.10);
    }
  });

  it("fire rate stays under 35% — posture is seasoning, not chorus", () => {
    for (const persona of NON_DEFAULT_SECTORS) {
      expect(fireRate(persona, -3)).toBeLessThan(0.35);
      expect(fireRate(persona, +3)).toBeLessThan(0.35);
    }
  });

  it("default persona is a no-op (empty bank)", () => {
    expect(applyPowerPostureOverlay(BASE, "default", "s-default", -3)).toBe(BASE);
    expect(applyPowerPostureOverlay(BASE, "default", "s-default", +3)).toBe(BASE);
  });

  it("empty sessionId is a no-op (snapshot baseline safety)", () => {
    for (const persona of NON_DEFAULT_SECTORS) {
      expect(applyPowerPostureOverlay(BASE, persona, "", -3)).toBe(BASE);
      expect(applyPowerPostureOverlay(BASE, persona, null, +3)).toBe(BASE);
    }
  });

  it("non-finite power is a no-op", () => {
    expect(applyPowerPostureOverlay(BASE, "indian-unicorn", "s-nan", NaN)).toBe(BASE);
    expect(applyPowerPostureOverlay(BASE, "indian-unicorn", "s-inf", Infinity)).toBe(BASE);
  });
});

describe("power-posture overlay — sector distinctness", () => {
  it("hungry banks differ across sectors (no cross-sector prefix collisions)", () => {
    const bank = __TEST_ONLY__.POWER_POSTURE_BANK;
    for (const a of NON_DEFAULT_SECTORS) {
      for (const b of NON_DEFAULT_SECTORS) {
        if (a === b) continue;
        const overlap = bank[a].hungry.filter((p) => bank[b].hungry.includes(p));
        expect(overlap).toEqual([]);
      }
    }
  });

  it("leveraged banks differ across sectors", () => {
    const bank = __TEST_ONLY__.POWER_POSTURE_BANK;
    for (const a of NON_DEFAULT_SECTORS) {
      for (const b of NON_DEFAULT_SECTORS) {
        if (a === b) continue;
        const overlap = bank[a].leveraged.filter((p) => bank[b].leveraged.includes(p));
        expect(overlap).toEqual([]);
      }
    }
  });

  it("hungry and leveraged pools don't share phrases within a sector", () => {
    const bank = __TEST_ONLY__.POWER_POSTURE_BANK;
    for (const persona of NON_DEFAULT_SECTORS) {
      const overlap = bank[persona].hungry.filter((p) => bank[persona].leveraged.includes(p));
      expect(overlap).toEqual([]);
    }
  });

  it("BFSI hungry leans on policy language (register-coherent)", () => {
    const bank = __TEST_ONLY__.POWER_POSTURE_BANK;
    const bfsiBlob = bank["bfsi"].hungry.join(" ").toLowerCase();
    expect(/policy|compliance|cycle/.test(bfsiBlob)).toBe(true);
  });

  it("PSU hungry leans on cadre/rules/OM language", () => {
    const bank = __TEST_ONLY__.POWER_POSTURE_BANK;
    const psuBlob = bank["psu"].hungry.join(" ").toLowerCase();
    expect(/cadre|rules|om|scale/.test(psuBlob)).toBe(true);
  });
});

describe("power-posture overlay — idempotency + determinism", () => {
  it("re-applying the overlay is a byte-identical no-op", () => {
    /* Find a session that fires, then re-apply. */
    let fired: string | null = null;
    let session = "";
    for (let i = 0; i < 200; i++) {
      const sid = `s-idem-${i}`;
      const out = applyPowerPostureOverlay(BASE, "indian-unicorn", sid, -3);
      if (out !== BASE) { fired = out; session = sid; break; }
    }
    expect(fired).not.toBeNull();
    const reapplied = applyPowerPostureOverlay(fired!, "indian-unicorn", session, -3);
    expect(reapplied).toBe(fired);
  });

  it("same (sessionId, persona, text, power) → same output (deterministic)", () => {
    const a = applyPowerPostureOverlay(BASE, "consulting-big4", "s-det", +3);
    const b = applyPowerPostureOverlay(BASE, "consulting-big4", "s-det", +3);
    expect(a).toBe(b);
  });
});
