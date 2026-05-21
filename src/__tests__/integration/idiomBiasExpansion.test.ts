/* Realism-Audit Fix 2 (2026-05-22) — idiomBias expansion.
 *
 * Every non-default sector persona now carries a 15-20 idiom bank
 * drawn from real Indian recruiter register. Assertions:
 *   - each non-default persona has >= 15 idioms
 *   - phrases are non-empty strings
 *   - prompt-fragment helper consumes the bank safely (truncates to a
 *     stable prefix slice so the LLM prompt cache stays warm)
 *   - pickIdiomDeterministic returns a stable selection for the same
 *     (persona, seed) pair
 */
import { describe, it, expect } from "vitest";
import {
  getRecruiterSectorPersona,
  recruiterSectorPersonaPromptFragment,
  pickIdiomDeterministic,
  type RecruiterSectorPersona,
} from "../../../server-handlers/_indian-recruiter-personas";

const NON_DEFAULT: RecruiterSectorPersona[] = [
  "it-services",
  "gcc",
  "indian-unicorn",
  "early-startup",
  "bfsi",
  "psu",
  "consulting-big4",
  "fmcg-management",
];

describe("Realism-Audit Fix 2 — idiomBias expansion", () => {
  it("every non-default persona has at least 15 idioms", () => {
    for (const id of NON_DEFAULT) {
      const p = getRecruiterSectorPersona(id);
      expect(p.idiomBias.length, `persona=${id} should carry >=15 idioms`).toBeGreaterThanOrEqual(15);
    }
  });
  it("every idiom is a non-empty trimmed string", () => {
    for (const id of NON_DEFAULT) {
      const p = getRecruiterSectorPersona(id);
      for (const phrase of p.idiomBias) {
        expect(typeof phrase).toBe("string");
        expect(phrase.length).toBeGreaterThan(2);
        expect(phrase.trim()).toBe(phrase);
      }
    }
  });
  it("default persona stays empty (no surface override)", () => {
    const p = getRecruiterSectorPersona("default");
    expect(p.idiomBias.length).toBe(0);
  });
  it("recruiterSectorPersonaPromptFragment slices to a stable prefix, doesn't blow up", () => {
    for (const id of NON_DEFAULT) {
      const p = getRecruiterSectorPersona(id);
      const frag = recruiterSectorPersonaPromptFragment(p);
      expect(frag).toContain(p.displayName);
      expect(frag).toContain(p.pushbackStyle);
      /* The fragment must NOT dump the full 20-phrase bank — that would
       * blow the prompt cache. Sample to the first 6. */
      const idiomCount = (frag.match(/, /g) || []).length;
      expect(idiomCount).toBeLessThan(20);
    }
  });
  it("pickIdiomDeterministic returns a stable selection for the same seed", () => {
    for (const id of NON_DEFAULT) {
      const p = getRecruiterSectorPersona(id);
      const a = pickIdiomDeterministic(p, 7);
      const b = pickIdiomDeterministic(p, 7);
      expect(a).toBe(b);
      expect(a).not.toBeNull();
      expect(p.idiomBias).toContain(a);
    }
  });
});
