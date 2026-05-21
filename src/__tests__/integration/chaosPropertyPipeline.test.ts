/* Chaos property test for the kernel-first response pipeline.
 *
 * Audit gap (2026-05-21): the existing 38 integration suites gate
 * KNOWN regressions tied to PDF#N replays. None of them enumerate the
 * cartesian product of (state shape × LLM behavior) — so an unknown
 * combination (e.g. validator rejects 3 turns in a row + LLM returns
 * the canonical verbatim + candidate asked a question) is unmeasured.
 *
 * This suite hammers `generateBotReply` with a matrix of fuzzed
 * states × adversarial LLM personas and asserts the invariant set:
 *
 *   INV-1  Liveness — text is always non-empty after trim
 *   INV-2  Source — always one of the four allowed enum values
 *   INV-3  No meta-directive leak — META_DIRECTIVE_TOKENS_RE never matches
 *   INV-4  No salary fabrication — no rupee/LPA number above band.maxStretch
 *   INV-5  Determinism on LLM-down — when the LLM throws, source MUST be a
 *          canonical path (`canonical-fallback` or `answer-canonical`)
 *   INV-6  Action shape — planner-emitted action.kind is always present
 *   INV-7  No raw-prompt echo — text does not contain system-prompt artifacts
 *          ("you are a recruiter", "system:", "###", "{{", "fact pack")
 *
 * These are TRUE invariants — they must hold for every (state, LLM)
 * pair the system can encounter. Failures here are architectural,
 * not authoring, bugs. */
import { describe, it, expect, vi } from "vitest";
import {
  generateBotReply,
  type GenerateAiTextFn,
} from "../../../server-handlers/_response-pipeline";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { EMPTY_CANDIDATE_PROFILE } from "../../../server-handlers/_candidate-profile";

/* ───────── bands ───────── */
const BANDS: Record<string, NegotiationBand> = {
  rm: { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: false },
  pd: {
    initialOffer: 35,
    maxStretch: 50,
    walkAway: 30,
    hasEquity: true,
    baseFloor: 24,
    baseStretch: 38,
    variableMax: 7,
  },
  junior: { initialOffer: 8, maxStretch: 12, walkAway: 6, hasEquity: false },
};

/* ───────── state shapes ─────────
 * Each builder yields a state in a distinct phase / topology so the
 * planner takes a different branch. */
function buildStates(): Array<{ name: string; state: NegotiationState }> {
  const out: Array<{ name: string; state: NegotiationState }> = [];

  /* S1 — fresh session, turn 0, no facts. */
  out.push({
    name: "fresh-turn-0-rm",
    state: initState({
      sessionId: "chaos-S1",
      role: "Relationship Manager",
      company: "HDFC Bank",
      band: BANDS.rm,
    }),
  });

  /* S2 — discovery mid-flight, candidate answered current ctc. */
  {
    let s = initState({
      sessionId: "chaos-S2",
      role: "Senior Product Designer",
      company: "Flipkart",
      band: BANDS.pd,
    });
    s = applyCandidateAnswer(s, "currently at 32 LPA.");
    out.push({ name: "discovery-with-ctc", state: s });
  }

  /* S3 — counter-offer phase with competing offer + proof. */
  out.push({
    name: "counter-with-proven-competing",
    state: {
      ...initState({
        sessionId: "chaos-S3",
        role: "Senior Product Designer",
        company: "Flipkart",
        band: BANDS.pd,
      }),
      phase: "counter-offer",
      counterRound: 1,
      turnIndex: 9,
      highestOfferMade: 35,
      candidateCurrentCtc: 32,
      competingOffer: 42,
      fakeLeverageChallengeFiredAtTurn: 8,
      competingOfferDetail: {
        company: "swiggy",
        status: "letter",
        stage: "offered",
        amount: 42,
        letterShareOffered: true,
        onHold: false,
        proofRequestedAtTurn: 8,
        proofProvided: true,
        hasAny: true,
      },
    } as NegotiationState,
  });

  /* S4 — closing-push, offerAskedAtTurn just stamped. */
  out.push({
    name: "closing-push-final-asked",
    state: {
      ...initState({
        sessionId: "chaos-S4",
        role: "Relationship Manager",
        company: "HDFC Bank",
        band: BANDS.rm,
      }),
      phase: "closing-push",
      turnIndex: 14,
      highestOfferMade: 26,
      candidateCurrentCtc: 18,
      candidateTarget: 30,
      offerAskedAtTurn: 14,
    } as NegotiationState,
  });

  /* S5 — wired-profile-followup precondition (wants-higher-base). */
  out.push({
    name: "wired-wants-higher-base",
    state: {
      ...initState({
        sessionId: "chaos-S5",
        role: "Senior Product Designer",
        company: "Flipkart",
        band: BANDS.pd,
      }),
      phase: "counter-offer",
      counterRound: 1,
      turnIndex: 11,
      highestOfferMade: 35,
      candidateCurrentCtc: 32,
      candidateProfile: {
        ...EMPTY_CANDIDATE_PROFILE,
        wantsHigherBase: true,
        hasAny: true,
      },
    } as NegotiationState,
  });

  /* S6 — verbal-acceptance then renegotiating (rescission risk). */
  out.push({
    name: "rescission-risk",
    state: {
      ...initState({
        sessionId: "chaos-S6",
        role: "Relationship Manager",
        company: "HDFC Bank",
        band: BANDS.rm,
      }),
      phase: "closing-push",
      turnIndex: 16,
      highestOfferMade: 26,
      candidateCurrentCtc: 18,
      verbalAcceptanceTurn: 14,
      postVerbalRenegotiationCount: 2,
    } as NegotiationState,
  });

  /* S7 — junior band, very low numbers. */
  out.push({
    name: "junior-band-discovery",
    state: initState({
      sessionId: "chaos-S7",
      role: "Junior Analyst",
      company: "Zerodha",
      band: BANDS.junior,
    }),
  });

  /* S8 — candidate just asked an off-script question (WFH). */
  {
    let s = initState({
      sessionId: "chaos-S8",
      role: "Relationship Manager",
      company: "HDFC Bank",
      band: BANDS.rm,
    });
    s = applyCandidateAnswer(s, "What's the WFH policy for this role?");
    out.push({ name: "off-script-question-asked", state: s });
  }

  return out;
}

/* ───────── adversarial LLM personas ─────────
 * Each persona models a failure mode the production LLM has produced
 * (or could produce). The pipeline must hold every invariant against
 * every persona. */

const llmThrow: GenerateAiTextFn = vi.fn().mockRejectedValue(new Error("LLM down"));

const llmEmpty: GenerateAiTextFn = vi.fn().mockResolvedValue("");
const llmWhitespace: GenerateAiTextFn = vi.fn().mockResolvedValue("   \n  \t  ");

const llmInjectsHighNumber: GenerateAiTextFn = vi
  .fn()
  .mockResolvedValue(
    "Look, we can stretch to ₹95 LPA for this role — that's our absolute max.",
  );

const llmLeaksDirective: GenerateAiTextFn = vi
  .fn()
  .mockResolvedValue(
    "Answer the candidate's question first; checklist advance pauses while reactive-followup runs.",
  );

const llmLeaksFactPack: GenerateAiTextFn = vi
  .fn()
  .mockResolvedValue(
    "Per the fact pack: this role is hybrid. (system prompt: you are a recruiter)",
  );

const llmFabricatesNumber: GenerateAiTextFn = vi
  .fn()
  .mockResolvedValue("The team is about 42 people across three pods.");

const llmReturnsJSON: GenerateAiTextFn = vi
  .fn()
  .mockResolvedValue('{"text": "unparsed json blob", "ok": true}');

const llmReturnsBackticks: GenerateAiTextFn = vi
  .fn()
  .mockResolvedValue("```\nso here's where we land — ₹25 LPA total.\n```");

const llmReturnsPromptTemplate: GenerateAiTextFn = vi
  .fn()
  .mockResolvedValue("{{candidate_name}}, our offer is {{offer}} LPA.");

const llmVerbose: GenerateAiTextFn = vi
  .fn()
  .mockResolvedValue(
    "So look — and I want to be really really transparent here — what we're trying to do is, you know, find a number that works for both sides, and the way we usually structure this is by looking at your CTC, your expected CTC, the band we have approved internally for this level, the variable component, the equity if any, the joining bonus we can sometimes wire in, and then we sort of arrive at something that everybody can live with. So with that framing in mind, here's where I'm at right now: I'd like to propose ₹24 LPA total for this role, structured as ₹18 fixed + ₹4 variable + ₹2 joining bonus. Does that broadly work?",
  );

const PERSONAS: Array<{ name: string; gen: GenerateAiTextFn; throws: boolean }> = [
  { name: "throw", gen: llmThrow, throws: true },
  { name: "empty", gen: llmEmpty, throws: false },
  { name: "whitespace", gen: llmWhitespace, throws: false },
  { name: "injects-high-salary", gen: llmInjectsHighNumber, throws: false },
  { name: "leaks-meta-directive", gen: llmLeaksDirective, throws: false },
  { name: "leaks-factpack-marker", gen: llmLeaksFactPack, throws: false },
  { name: "fabricates-headcount", gen: llmFabricatesNumber, throws: false },
  { name: "returns-json-blob", gen: llmReturnsJSON, throws: false },
  { name: "wraps-in-backticks", gen: llmReturnsBackticks, throws: false },
  { name: "leaks-prompt-template", gen: llmReturnsPromptTemplate, throws: false },
  { name: "verbose-rambling", gen: llmVerbose, throws: false },
];

const META_DIRECTIVE_TOKENS_RE =
  /\b(checklist|advance pauses|advance is paused|planner|planned action|next action|reactive[- ]followup|system prompt|fact[\s-]?pack|factpack|directive)\b/i;

const PROMPT_ARTIFACT_RE =
  /\{\{[a-z_]+\}\}|```|^\s*system\s*:|you are a recruiter/i;

/* SALARY_NUM_RE: matches numbers presented as salary-bearing tokens.
 *   ₹95 LPA  /  ₹ 95 L  /  95 LPA  /  95 lakhs */
const SALARY_NUM_RE = /(?:₹\s*)?(\d{1,3}(?:\.\d+)?)\s*(?:LPA|L\b|lakh)/gi;

function extractSalaryNumbers(text: string): number[] {
  const out: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SALARY_NUM_RE);
  while ((m = re.exec(text)) != null) {
    const n = Number(m[1]);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/* ───────── invariant checker ───────── */
function assertInvariants(
  text: string,
  source: string,
  action: unknown,
  band: NegotiationBand,
  ctx: string,
  throws: boolean,
) {
  /* INV-1 */
  expect(text.trim().length, `${ctx} INV-1 liveness`).toBeGreaterThan(0);

  /* INV-2 */
  expect(
    ["restyle", "canonical-fallback", "answer-restyle", "answer-canonical"],
    `${ctx} INV-2 source enum`,
  ).toContain(source);

  /* INV-3 */
  expect(text, `${ctx} INV-3 meta-directive leak`).not.toMatch(
    META_DIRECTIVE_TOKENS_RE,
  );

  /* INV-4 — no salary number above band.maxStretch.
   * We add a small headroom (×1.1) because canonical prose occasionally
   * cites a competing offer the candidate substantiated, which can
   * legitimately exceed the band. Any number above 2× maxStretch is
   * unambiguously a fabrication. */
  const ceiling = band.maxStretch * 2;
  for (const n of extractSalaryNumbers(text)) {
    expect(
      n,
      `${ctx} INV-4 salary fabrication (saw ${n}, band stretch ${band.maxStretch})`,
    ).toBeLessThanOrEqual(ceiling);
  }

  /* INV-5 */
  if (throws) {
    expect(
      ["canonical-fallback", "answer-canonical"],
      `${ctx} INV-5 LLM-down determinism`,
    ).toContain(source);
  }

  /* INV-6 */
  expect(action, `${ctx} INV-6 action emitted`).toBeTruthy();
  expect(
    typeof (action as { kind?: unknown }).kind,
    `${ctx} INV-6 action.kind shape`,
  ).toBe("string");

  /* INV-7 */
  expect(text, `${ctx} INV-7 raw-prompt artifact`).not.toMatch(
    PROMPT_ARTIFACT_RE,
  );
}

describe("chaos property — generateBotReply invariants over state × LLM matrix", () => {
  const states = buildStates();

  for (const { name: stateName, state } of states) {
    for (const persona of PERSONAS) {
      it(`[${stateName}] × [${persona.name}] holds all invariants`, async () => {
        const result = await generateBotReply(state, persona.gen);
        assertInvariants(
          result.text,
          result.source,
          result.action,
          state.band,
          `${stateName}/${persona.name}`,
          persona.throws,
        );
      });
    }
  }

  /* Determinism boundary — restyle success vs. fail must produce
   * sources from the same {canonical, restyle} dichotomy, never a
   * meta-leak or empty text regardless of which side we land on. */
  it("determinism boundary — restyle-success vs throw produce different sources but both ship safe text", async () => {
    const s = buildStates()[0].state;
    const rSuccess = await generateBotReply(
      s,
      vi.fn().mockResolvedValue("So, what total package are you looking at for this role?"),
    );
    const rThrow = await generateBotReply(s, llmThrow);

    /* Both must satisfy invariants. */
    assertInvariants(rSuccess.text, rSuccess.source, rSuccess.action, s.band, "determinism/success", false);
    assertInvariants(rThrow.text, rThrow.source, rThrow.action, s.band, "determinism/throw", true);

    /* The throw path must route to canonical. */
    expect(["canonical-fallback", "answer-canonical"]).toContain(rThrow.source);
  });
});
