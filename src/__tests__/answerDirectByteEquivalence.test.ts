/* answer-direct byte-equivalence guard.
 *
 * The PDF#51 (2026-05-28) deterministic-prose path produces an
 * `answer-direct` NextAction at the planner level — `_next-action-planner.ts`
 * humanizes the response-bank prose and stashes the result on
 * `action.prose` (also mirrored to `_move.deterministicProse`).
 * negotiate-turn.ts SHIPS that string directly (LLM bypass).
 *
 * The canonical-prose fallback in `_canonical-prose.ts` handles legacy
 * callers that still traverse `renderCanonicalProse` for an
 * `answer-direct` action (restyle fallback, snapshot tests). That arm
 * simply returns `action.prose`, AND `answer-direct` is registered in
 * both `SENTIMENT_PREFIX_SUPPRESSED_KINDS` and
 * `HUMANIZER_SUPPRESSED_KINDS` so the exit-point composition stays a
 * no-op for this kind.
 *
 * If either suppression set ever drifts (e.g. someone removes
 * `answer-direct` from `HUMANIZER_SUPPRESSED_KINDS`), candidates on the
 * fallback path would hear a DIFFERENT recruiter — double-humanized,
 * possibly sentiment-prefixed — than candidates on the bypass path.
 * This test pins byte-equivalence end-to-end: drive `planNextAction`
 * with five representative answer-direct contexts (varied topic, name,
 * offer state, sentiment, sector persona) and assert
 * `renderCanonicalProse(action, state) === action.prose` for each.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: true,
};

const fresh = (
  overrides: Partial<NegotiationState> = {},
): NegotiationState => ({
  ...initState({
    sessionId: overrides.sessionId ?? "s-answer-direct-byte-eq",
    role: "Software Engineer",
    company: "acme",
    band: BAND,
  }),
  ...overrides,
});

interface Variation {
  label: string;
  utterance: string;
  expectedTopic: string;
  state: Partial<NegotiationState>;
}

/* Five representative variations spanning:
 *   - different curated topics (esop, fixed-variable, in-hand, notice,
 *     range-grade)
 *   - different candidate names (threaded via candidateProfile.firstName
 *     when available; otherwise nullable)
 *   - different offer states (no offer yet, mid-offer at 24L, post-offer
 *     at 28L)
 *   - different recruiter sector personas (null, indian-unicorn, bfsi)
 *   - different sentiments (null, hesitant, decisive) — the sentiment
 *     prefix is the highest-risk drift vector if the suppression set
 *     ever loses `answer-direct`.
 */
const VARIATIONS: ReadonlyArray<Variation> = [
  {
    label: "esop-structure / no offer / no sector persona / hesitant sentiment",
    utterance: "Quick question — can you walk me through the ESOP vesting and cliff?",
    expectedTopic: "esop-structure",
    state: {
      sessionId: "v1-esop",
      turnIndex: 2,
      phase: "opening",
    },
  },
  {
    label: "fixed-variable-split / opening / indian-unicorn sector",
    utterance: "Help me understand the fixed and variable split — what's the comfort there?",
    expectedTopic: "fixed-variable-split",
    state: {
      sessionId: "v2-fixed-variable",
      turnIndex: 4,
      phase: "opening",
      recruiterSectorPersona: "indian-unicorn",
    },
  },
  {
    label: "in-hand-monthly / opening / bfsi sector",
    utterance: "Roughly what does the monthly come out to at this grade?",
    expectedTopic: "in-hand-monthly",
    state: {
      sessionId: "v3-in-hand",
      /* #121 (2026-06-21) — below STONEWALL_ANCHOR_TURNS (5). At turn ≥5 with
       * nothing disclosed and no offer, the planner now (correctly) fires the
       * hoisted stonewall band-anchor instead of answer-direct — a candidate
       * who stonewalled that long and then asks for the number gets the band
       * stated. This case exercises the answer-direct PROSE path, which still
       * owns the turn pre-stonewall (high-turn anchor covered by the #121
       * negotiation battery). */
      turnIndex: 4,
      phase: "opening",
      recruiterSectorPersona: "bfsi",
    },
  },
  {
    label: "notice-buyout / opening / no sector persona",
    utterance: "Can you support a buyout if my notice runs longer than expected?",
    expectedTopic: "notice-buyout",
    state: {
      sessionId: "v4-notice",
      turnIndex: 3,
      phase: "opening",
    },
  },
  {
    label: "range-grade-leverage / opening / indian-unicorn sector",
    utterance: "Can you share the broad range at this grade?",
    expectedTopic: "range-grade-leverage",
    state: {
      sessionId: "v5-range-grade",
      /* #121 (2026-06-21) — below STONEWALL_ANCHOR_TURNS (5); see in-hand
       * case above. A stonewalled candidate asking for the range at turn ≥5
       * now gets the band anchored, not an answer-direct deflection. */
      turnIndex: 4,
      phase: "opening",
      recruiterSectorPersona: "indian-unicorn",
    },
  },
];

describe("answer-direct: planner pre-humanized prose === canonical-prose fallback (byte-identical)", () => {
  for (const v of VARIATIONS) {
    it(`byte-equivalent for ${v.label}`, () => {
      /* applyCandidateAnswer sets lastTurnDelta.askedQuestion +
       * appends the utterance to conversationLog, which is what the
       * planner's answer-direct branch reads via latestCandidateText. */
      const state = applyCandidateAnswer(fresh(v.state), v.utterance);

      const action = planNextAction(state);

      /* Sanity: the planner reached the deterministic answer-direct
       * branch for this utterance. If this fires, the test fixture
       * needs revising (a higher-priority branch shadowed the route);
       * it is NOT a byte-equivalence failure. */
      expect(action.kind, `planner did not reach answer-direct for "${v.utterance}"`).toBe(
        "answer-direct",
      );
      if (action.kind !== "answer-direct") return;
      expect(action.topic).toBe(v.expectedTopic);

      /* Path A — planner-set pre-humanized prose (LLM-bypass ships
       * this verbatim via move.deterministicProse). */
      const plannerProse = action.prose;

      /* Path B — canonical-prose fallback. Must return byte-identical
       * output: the `answer-direct` case returns action.prose, and the
       * exit-point sentiment prefix + humanizer must BOTH be suppressed
       * for this kind. */
      const canonicalProse = renderCanonicalProse(action, state);

      expect(canonicalProse).toBe(plannerProse);
    });
  }
});
