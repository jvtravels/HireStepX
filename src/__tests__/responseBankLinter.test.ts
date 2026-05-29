/* 2026-05-29 realism-pass P1 — response-bank linter.
 *
 * The 14-topic RESPONSE_BANK in `_candidate-question.ts` carries
 * curated recruiter prose with optional sector / round / phase /
 * register / sector×phase overrides. As contributors add overrides,
 * five failure modes recur:
 *
 *   1. Banned recruiter idiom slipping in — a sector override picks
 *      up "circle back" / "touch base" copy-pasted from another arm.
 *      We reuse the canonical `BANNED_RECRUITER_IDIOM_RE` exported
 *      from `_canonical-prose.ts` so this list never drifts from the
 *      restyle validator's list.
 *   2. Meta-directive token leakage — overrides that contain
 *      "checklist advance" / "do not mention" leak system-prompt
 *      tokens to the candidate. Reuse `META_DIRECTIVE_TOKENS_RE`.
 *   3. Empty / whitespace overrides — a string in the type but a
 *      blank value makes `if (override) ...` branches skip and the
 *      override silently falls through, masking the entry entirely.
 *   4. Variants colliding with base — duplicated prose defeats the
 *      rotation mechanism and ships the same wording twice.
 *   5. `sectorPhaseOverrides` not actually shadowing `sectorOverrides`
 *      when both are present — i.e. precedence regression.
 *
 * Asserting these as a vitest run keeps the bank honest as it grows. */

import { describe, it, expect } from "vitest";
import {
  renderCandidateQuestionResponse,
  classifyCandidateQuestion,
  TOPIC_PROBES,
  type CandidateQuestionTopic,
} from "../../server-handlers/_candidate-question";
import {
  BANNED_RECRUITER_IDIOM_RE,
  META_DIRECTIVE_TOKENS_RE,
  ALLOWED_HINGLISH_TOKENS,
} from "../../server-handlers/_canonical-prose";

/* Sampling matrix — assert behavior across the cartesian product the
 * renderer actually fires under. */
const TOPICS: ReadonlyArray<CandidateQuestionTopic> = Object.keys(
  TOPIC_PROBES,
) as CandidateQuestionTopic[];

const SECTORS = [
  null,
  "consulting-big4",
  "fmcg-management",
  "psu",
  "bfsi",
  "gcc",
  "it-services",
  "indian-unicorn",
  "early-startup",
  "default",
] as const;

const PHASES = [
  null,
  "opening",
  "range-disclosure",
  "offer-presented",
  "probe-expectations",
  "counter-offer",
  "lever-explore",
  "closing-push",
] as const;

const REGISTERS = [null, "formal", "casual", "direct", "neutral"] as const;

/* roundPersonas — highest-precedence override path in the bank. Pre-audit
 * the linter passed null throughout, which meant a banned-idiom slip on a
 * `roundOverrides` entry would never trip. Including the three real round
 * personas (and null for the baseline) closes that gap. */
const ROUND_PERSONAS = [null, "hr-partner", "hiring-manager", "director"] as const;

/* Cartesian product generator. Avoids the 5-deep `for` nest the linter
 * grew into (post-audit it had a brace-count mismatch as a fix-up). Each
 * yielded tuple is the full (topic, sector, round, phase, register)
 * cross-product slot. Yielding (not allocating an N-deep array) keeps
 * the ~22k iteration count cheap on memory.
 *
 * Typed so each axis stays narrow — the caller destructures with the
 * original named axes intact. Adding a new axis (e.g. `serveCount`)
 * means one new generator argument, not another `for` level. */
function* renderMatrix(): Generator<{
  topic: CandidateQuestionTopic;
  sector: typeof SECTORS[number];
  roundPersona: typeof ROUND_PERSONAS[number];
  phase: typeof PHASES[number];
  register: typeof REGISTERS[number];
}> {
  for (const topic of TOPICS) {
    for (const sector of SECTORS) {
      for (const roundPersona of ROUND_PERSONAS) {
        for (const phase of PHASES) {
          for (const register of REGISTERS) {
            yield { topic, sector, roundPersona, phase, register };
          }
        }
      }
    }
  }
}

function slotLabel(slot: ReturnType<typeof renderMatrix> extends Generator<infer T> ? T : never): string {
  return `${slot.topic} | sector=${slot.sector} round=${slot.roundPersona} phase=${slot.phase} register=${slot.register}`;
}

describe("response-bank linter", () => {
  it("returns a non-empty, trimmed string for every (topic, sector, round, phase, register) the renderer reaches", () => {
    const offenders: string[] = [];
    for (const slot of renderMatrix()) {
      const prose = renderCandidateQuestionResponse(
        slot.topic,
        slot.sector,
        slot.roundPersona,
        null,
        slot.phase,
        0,
        slot.register,
      );
      if (prose == null) {
        offenders.push(`null  | ${slotLabel(slot)}`);
        continue;
      }
      if (prose.trim() === "") {
        offenders.push(`empty | ${slotLabel(slot)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never ships a banned recruiter idiom (reusing canonical-prose validator regex)", () => {
    const offenders: string[] = [];
    for (const slot of renderMatrix()) {
      const prose = renderCandidateQuestionResponse(
        slot.topic,
        slot.sector,
        slot.roundPersona,
        null,
        slot.phase,
        0,
        slot.register,
      );
      if (!prose) continue;
      /* Reset stateful regex flag — BANNED_RECRUITER_IDIOM_RE is
       * defined with /g semantics in canonical-prose. */
      BANNED_RECRUITER_IDIOM_RE.lastIndex = 0;
      if (BANNED_RECRUITER_IDIOM_RE.test(prose)) {
        offenders.push(`banned-idiom -> ${slotLabel(slot)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("never leaks meta-directive tokens to the candidate", () => {
    const offenders: string[] = [];
    for (const slot of renderMatrix()) {
      const prose = renderCandidateQuestionResponse(
        slot.topic,
        slot.sector,
        slot.roundPersona,
        null,
        slot.phase,
        0,
        slot.register,
      );
      if (!prose) continue;
      META_DIRECTIVE_TOKENS_RE.lastIndex = 0;
      if (META_DIRECTIVE_TOKENS_RE.test(prose)) {
        offenders.push(`meta-leak -> ${slotLabel(slot)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Hinglish tokens used in sectorPhaseOverrides are deliberate (allow-list sanity)", () => {
    /* Sanity check that our Hinglish closing-push variants ship the
     * tokens we documented (catches accidental deletion / typo). Picks
     * indian-unicorn × closing-push for budget-disclosure since that's
     * the one we curated. */
    const prose = renderCandidateQuestionResponse(
      "budget-disclosure",
      "indian-unicorn",
      null,
      null,
      "closing-push",
      0,
      null,
    );
    expect(prose).not.toBeNull();
    const matched = ALLOWED_HINGLISH_TOKENS.some((re) => re.test(prose ?? ""));
    expect(matched, `expected a Hinglish token in: ${prose}`).toBe(true);
  });

  it("variants rotate distinct prose — base + variants must differ across the rotation window", () => {
    const offenders: string[] = [];
    for (const topic of TOPICS) {
      const seen = new Set<string>();
      for (let serve = 0; serve < 4; serve++) {
        const prose = renderCandidateQuestionResponse(
          topic,
          null,
          null,
          "lint-seed",
          null,
          serve,
          null,
        );
        if (!prose) continue;
        seen.add(prose);
      }
      if (seen.size < 2) {
        offenders.push(`${topic}: only ${seen.size} distinct phrasing(s) across 4 serves`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("sectorPhaseOverrides shadows the flat sectorOverrides for the matching (sector, phase) pair", () => {
    /* Precedence regression guard. We curated
     *   budget-disclosure × psu × closing-push (sectorPhaseOverrides)
     *   budget-disclosure × psu                (sectorOverrides — grade-pay framing)
     * Pick a (sector, phase) where BOTH a sectorPhaseOverrides entry AND
     * the flat sectorOverride exist, and assert the composed entry
     * wins. If precedence regresses (flat sector override fires when
     * the composed slot has a more-specific entry), this test catches
     * it directly without needing snapshot diff archaeology. */
    const composed = renderCandidateQuestionResponse(
      "budget-disclosure",
      "psu",
      null,
      null,
      "closing-push",
      0,
      null,
    );
    const flat = renderCandidateQuestionResponse(
      "budget-disclosure",
      "psu",
      null,
      null,
      /* no phase → flat sectorOverride path */ null,
      0,
      null,
    );
    expect(composed).not.toBeNull();
    expect(flat).not.toBeNull();
    expect(composed).not.toBe(flat);
    /* The composed entry retains the persona content (deputy GM) AND
     * adds the close cadence (close this today / want to land it). */
    expect(composed).toMatch(/deputy\s+gm/i);
    expect(composed).toMatch(/close|land/i);
  });

  it("registerVariants shadows base/variants when the candidate register matches (precedence guard)", () => {
    /* Mirror of the sectorPhaseOverrides precedence test, applied to
     * registerVariants. We curated:
     *   fixed-variable-split.registerVariants.direct = "Fixed cash, quarterly variable on KPIs, ESOPs separate. Want the fixed pushed up?"
     * Pick (no sector, no phase, no round) so the precedence chain falls
     * straight to registerVariants. If a future refactor reorders the
     * chain such that variants/base fire ahead of registerVariants, this
     * test catches it without snapshot archaeology. */
    const direct = renderCandidateQuestionResponse(
      "fixed-variable-split",
      null,
      null,
      null,
      null,
      0,
      "direct",
    );
    const neutral = renderCandidateQuestionResponse(
      "fixed-variable-split",
      null,
      null,
      null,
      null,
      0,
      null,
    );
    expect(direct).not.toBeNull();
    expect(neutral).not.toBeNull();
    expect(direct).not.toBe(neutral);
    /* The direct variant is audibly clipped — no corridor preamble. */
    expect(direct).toMatch(/fixed cash/i);
    expect(direct!.length).toBeLessThan(neutral!.length);
  });

  it("classifyCandidateQuestion + renderer is round-trip safe for every topic (probes derived from TOPIC_PROBES)", () => {
    for (const topic of TOPICS) {
      const probe = TOPIC_PROBES[topic];
      const classified = classifyCandidateQuestion(probe);
      expect(
        classified,
        `classifier missed canonical probe for ${topic}: "${probe}"`,
      ).toBe(topic);
      const prose = renderCandidateQuestionResponse(topic, null, null);
      expect(prose, `renderer null on classified topic ${topic}`).not.toBeNull();
      expect((prose ?? "").trim().length, `renderer empty on ${topic}`).toBeGreaterThan(0);
    }
  });
});
