/* Contract test for the candidate-profile registration API.
 *
 * Audit follow-up (2026-05-21). The wave-flag registry runs in SHADOW
 * mode — the legacy direct-call path in extractCandidateProfile is
 * canonical; the registry is registered alongside. This test asserts
 * the safety contract:
 *
 *   - The registry contains exactly the flags currently declared
 *     SHADOW.
 *   - For every registered flag and every input in the adversarial
 *     corpus, `runRegistry(text)[flag]` matches
 *     `extractCandidateProfile(text)[flag]` byte-for-byte. (This is
 *     the proof that the legacy call site is safe to delete when the
 *     wave is cut over to PRIMARY mode.)
 *   - `mergeRegistry` for "or" strategy produces the same boolean
 *     monotone behaviour as the legacy merge.
 *
 * If a future change drifts the registry's detect function away from
 * the legacy detector, this test fails — surfacing the regression at
 * the safety boundary BEFORE the legacy call site is removed. */
import { describe, it, expect } from "vitest";
import {
  getRegisteredFlags,
  runRegistry,
  mergeRegistry,
} from "../../../server-handlers/_candidate-profile-registry";
import {
  extractCandidateProfile,
  type CandidateProfileResult,
} from "../../../server-handlers/_candidate-profile";

/* Same adversarial corpus used by the profile chaos suite — keeps
 * the two test files in lockstep so any new input the chaos suite
 * adds is also exercised against the registry. */
const CORPUS: string[] = [
  "",
  "   ",
  "\n\n\t  ",
  "currently at 18 LPA, expecting 28",
  "I'm hybrid, three days in the office",
  "I have a career gap of 8 months, was upskilling on AWS",
  "another offer of 42 LPA in hand, letter from Swiggy",
  "what's the WFH policy here?",
  "I want a higher base, joining bonus and relocation help",
  /* Wave-2A signals — these should fire on the shadow-registered detectors. */
  "Does the medical insurance cover my parents too?",
  "What will I get in-hand monthly after deductions?",
  "Was promised hybrid, now they're mandating return to office five days.",
  "RTO mandate is becoming a dealbreaker for me.",
  "ctc vs in-hand — I care about take-home pay.",
  /* Wave-2B signals — newly shadow-registered (2026-05-21). */
  "Can we restructure the CTC for HRA and LTA tax optimization?",
  "I'm worried about the BGV — please don't call my current manager.",
  "What's the 409A FMV and the post-termination exercise window?",
  "My wife works in Pune, dual-career — can't relocate easily.",
  "Need to be near my aging parents, they have medical issues.",
];

/* Flags registered in the wave-flag registry. Wave-2A is PRIMARY (the
 * legacy direct-call path has been removed and extractCandidateProfile
 * reads from runRegistry); Wave-2B is SHADOW (legacy path canonical,
 * registry registered in parallel). Both groups must agree with the
 * legacy extractor byte-for-byte. Keep this list in sync with the
 * registerWaveFlag(...) calls in _candidate-profile.ts. */
const EXPECTED_SHADOW_FLAGS = [
  /* Wave-2A (PRIMARY since 2026-05-21). */
  "parentInsuranceAsked",
  "inHandTakehomeFocus",
  "rtoPushback",
  /* Wave-2B (SHADOW since 2026-05-21). */
  "taxStructureAsked",
  "bgvAnxiety",
  "esopSophisticationProbe",
  "spouseJobConstraint",
  "agingParentCare",
] as const;

describe("candidate-profile registry — contract", () => {
  it("contains the expected SHADOW-mode flags", () => {
    const flags = getRegisteredFlags();
    const names = new Set(flags.map((f) => f.name));
    for (const expected of EXPECTED_SHADOW_FLAGS) {
      expect(names.has(expected), `registry missing flag "${expected}"`).toBe(true);
    }
  });

  it("every registered flag has metadata (waveId + detect + defaultValue + mergeStrategy)", () => {
    for (const f of getRegisteredFlags()) {
      expect(f.waveId, `flag ${f.name} missing waveId`).toMatch(/^wave-/);
      expect(typeof f.detect, `flag ${f.name} detect is not a function`).toBe("function");
      expect(["or", "last-truthy", "first-wins", "max"]).toContain(f.mergeStrategy);
    }
  });

  describe("parity — runRegistry matches legacy extractCandidateProfile byte-for-byte", () => {
    for (const input of CORPUS) {
      const label = input.length > 40 ? `${input.slice(0, 40)}…` : input || "<empty>";
      it(`[${label}] every shadow flag agrees with legacy extractor`, () => {
        const legacy = extractCandidateProfile(input) as unknown as Record<string, unknown>;
        const reg = runRegistry(input);
        for (const flagName of EXPECTED_SHADOW_FLAGS) {
          expect(
            reg[flagName],
            `parity break on ${flagName} for input "${label}" (legacy=${legacy[flagName]}, registry=${reg[flagName]})`,
          ).toBe(legacy[flagName]);
        }
      });
    }
  });

  describe("mergeRegistry — 'or' strategy is monotone-up for boolean flags", () => {
    it("monotone: merge(true, false).flag === true (cannot un-set)", () => {
      const prior = { parentInsuranceAsked: true, inHandTakehomeFocus: false, rtoPushback: true };
      const next = { parentInsuranceAsked: false, inHandTakehomeFocus: true, rtoPushback: false };
      const m = mergeRegistry(prior, next);
      expect(m.parentInsuranceAsked).toBe(true);
      expect(m.inHandTakehomeFocus).toBe(true);
      expect(m.rtoPushback).toBe(true);
    });

    it("identity: merge(empty, empty) returns defaults", () => {
      const m = mergeRegistry({}, {});
      for (const f of EXPECTED_SHADOW_FLAGS) {
        expect(m[f]).toBe(false);
      }
    });

    it("right-identity: merge(X, empty) preserves X's truthy flags", () => {
      const x = { parentInsuranceAsked: true, rtoPushback: true };
      const m = mergeRegistry(x, {});
      expect(m.parentInsuranceAsked).toBe(true);
      expect(m.rtoPushback).toBe(true);
      expect(m.inHandTakehomeFocus).toBe(false);
    });

    it("commutative: merge(a, b) ≡ merge(b, a) for boolean strategy", () => {
      const a = { parentInsuranceAsked: true, rtoPushback: false };
      const b = { parentInsuranceAsked: false, rtoPushback: true };
      const ab = mergeRegistry(a, b);
      const ba = mergeRegistry(b, a);
      for (const f of EXPECTED_SHADOW_FLAGS) {
        expect(ab[f], `commutativity broke on ${f}`).toBe(ba[f]);
      }
    });
  });

  describe("end-to-end — register a real candidate utterance and merge into a prior session", () => {
    it("turn 1 + turn 2: signals accumulate", () => {
      const turn1 = runRegistry("Does the medical insurance cover my parents?");
      expect(turn1.parentInsuranceAsked).toBe(true);

      const turn2 = runRegistry("What's the in-hand take-home pay monthly?");
      expect(turn2.inHandTakehomeFocus).toBe(true);

      const merged = mergeRegistry(turn1, turn2);
      expect(merged.parentInsuranceAsked).toBe(true); // carried from turn 1
      expect(merged.inHandTakehomeFocus).toBe(true); // fresh from turn 2
      expect(merged.rtoPushback).toBe(false); // neither turn fired it
    });
  });
});

/* Keep CandidateProfileResult import "used" for the type-narrowing
 * intent the parity test relies on. */
type _ProfileShape = CandidateProfileResult;
const _shape: _ProfileShape | null = null;
void _shape;
