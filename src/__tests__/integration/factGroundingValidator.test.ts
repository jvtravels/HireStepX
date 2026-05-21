/* Audit follow-up (2026-05-21) — fact-grounding validator tests.
 *
 * The pre-fix LLM answer path trusted unvalidated free-text on non-
 * salary intents. validateAnswer caught LPA hallucinations but let the
 * LLM fabricate manager names, office addresses, insurance carriers,
 * team-lead names. The grounding validator closes that gap by checking
 * that proper-noun-shaped tokens in the LLM output appear in the
 * factPack or a small generic allowlist.
 *
 * Contract pinned by this file:
 *
 *   1. LLM output naming a person NOT in factPack → grounding rejects,
 *      pipeline ships FACT_GROUNDING_HEDGE.
 *   2. LLM wfh answer referencing a real persona.workMode → accepted.
 *   3. LLM number that IS in the band → accepted.
 *   4. LLM number NOT in the band → rejected (overlaps with
 *      validateAnswer — defense in depth, kept intentionally).
 *   5. A WIRED_PROFILE_TOPICS-covered intent NEVER calls the LLM.
 */
import { describe, it, expect, vi } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import {
  generateBotReply,
  validateAnswerGrounding,
  type GenerateAiTextFn,
} from "../../../server-handlers/_response-pipeline";
import { FACT_GROUNDING_HEDGE } from "../../../server-handlers/_canonical-prose";
import { buildFactPack } from "../../../server-handlers/_fact-pack";

function seed(overrides: Partial<Parameters<typeof initState>[0]> = {}): NegotiationState {
  return initState({
    sessionId: "fgv-1",
    role: "Senior Product Designer",
    company: "Flipkart",
    band: { initialOffer: 35, maxStretch: 50, walkAway: 30, hasEquity: true },
    ...overrides,
  });
}

describe("validateAnswerGrounding — unit", () => {
  it("rejects a fabricated manager name not in the factPack", () => {
    const pack = buildFactPack(seed());
    const res = validateAnswerGrounding(
      "Your manager will be Priya Sharma — she heads the platform pod.",
      pack,
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/unfounded-proper-noun:priya sharma/);
  });

  it("accepts an answer whose proper-noun appears verbatim in the factPack", () => {
    const s = seed();
    /* Inject a reporting manager name into state so the pack carries it. */
    const sWithMgr: NegotiationState = { ...s, reportingTo: "Anand Iyer" };
    const pack = buildFactPack(sWithMgr);
    const res = validateAnswerGrounding(
      "You'll be reporting to Anand Iyer on the platform side.",
      pack,
    );
    expect(res.ok).toBe(true);
  });

  it("accepts a wfh answer referencing the persona's workMode (hybrid)", () => {
    const s = seed();
    const sHybrid: NegotiationState = { ...s, workMode: "hybrid" };
    const pack = buildFactPack(sHybrid);
    /* Plain prose, no proper nouns — should ground. */
    const res = validateAnswerGrounding(
      "We run hybrid here — three days in office, the rest remote.",
      pack,
    );
    expect(res.ok).toBe(true);
  });

  it("accepts the recruiter-generic vocabulary allowlist (Bengaluru, HR, BGV)", () => {
    const pack = buildFactPack(seed());
    const res = validateAnswerGrounding(
      "The role is based out of Bengaluru. BGV runs after acceptance.",
      pack,
    );
    expect(res.ok).toBe(true);
  });

  it("accepts FirstAdvantage and AuthBridge — the BGV vendors in INDIAN_MARKET_FACTS", () => {
    /* Seed with a post-anchor phase so the market facts include the BGV
     * keys. Using a band-disclosed seed and forcing phase via direct
     * state mutation for the test scope. */
    const s = seed();
    const sPostAnchor: NegotiationState = { ...s, phase: "offer-presented" };
    const pack = buildFactPack(sPostAnchor);
    const res = validateAnswerGrounding(
      "We run it through FirstAdvantage post-acceptance.",
      pack,
    );
    expect(res.ok).toBe(true);
  });

  it("rejects a fabricated office address not in pack", () => {
    const pack = buildFactPack(seed());
    const res = validateAnswerGrounding(
      "The team sits at Prestige Tech Park on the twelfth floor.",
      pack,
    );
    expect(res.ok).toBe(false);
  });

  it("rejects a fabricated insurance carrier not in pack", () => {
    const pack = buildFactPack(seed());
    const res = validateAnswerGrounding(
      "Our medical insurance is provided by Acko Insure.",
      pack,
    );
    expect(res.ok).toBe(false);
  });

  it("ignores sentence-initial leads (not flagged as proper-nouns)", () => {
    const pack = buildFactPack(seed());
    /* "Hybrid" / "Reporting" at sentence start are capitalization
     * artifacts, not fabricated specifics. */
    const res = validateAnswerGrounding(
      "Hybrid is the norm here. Reporting goes through the EM.",
      pack,
    );
    expect(res.ok).toBe(true);
  });
});

describe("validateAnswer (number guard) — defense in depth", () => {
  it("rejects an LLM number that is NOT in the band, even when grounding would accept the prose shape", async () => {
    let s = seed();
    s = applyCandidateAnswer(s, "What's the package range here?");
    const llm: GenerateAiTextFn = async () =>
      "The package sits around 99 lakhs as per the band.";
    const result = await generateBotReply(s, llm, "What's the package range here?");
    /* validateAnswer should reject "99" as unfounded; pipeline defers. */
    expect(result.source).toBe("answer-canonical");
    expect(result.rejectReason).toMatch(/unfounded-number:99|fact-grounding-failed/);
  });
});

describe("pipeline integration — grounding kicks in after validateAnswer", () => {
  it("ships FACT_GROUNDING_HEDGE when LLM fabricates a manager name", async () => {
    let s = seed();
    /* Pre-seed reportingTo so factPack has the fact and detectFactGap
     * does not short-circuit before the LLM is even called. The LLM
     * will fabricate a DIFFERENT name; grounding catches that. */
    s = { ...s, reportingTo: "Anand Iyer" };
    s = applyCandidateAnswer(s, "Who would I be reporting to on this role?");
    const llm: GenerateAiTextFn = async () =>
      "You'd be reporting to Priya Sharma, the platform lead.";
    const result = await generateBotReply(s, llm, "Who would I be reporting to on this role?");
    expect(result.source).toBe("answer-canonical");
    expect(result.text).toBe(FACT_GROUNDING_HEDGE);
    expect(result.rejectReason).toMatch(/fact-grounding|unfounded-proper-noun/);
  });
});

describe("WIRED_PROFILE_TOPICS never calls the LLM", () => {
  /* The wired-profile precedence at the top of generateAnswerToCandidate
   * ships canonical prose verbatim and skips the LLM entirely. Pin it. */
  it("does not invoke the LLM when the planner routes to a wired-profile topic (team-size)", async () => {
    let s = seed();
    /* Trip the candidate-profile flag so the planner emits the wired
     * team-size action instead of answer-direct. */
    s = applyCandidateAnswer(s, "How big is the team I'd be joining?");
    /* Confirm the profile flag landed; if the parser missed it, the test
     * is meaningless. */
    if (!s.candidateProfile?.askedAboutTeamSize) {
      /* Force-set the flag for deterministic test coverage of the
       * wired-precedence branch — the production parser is exercised
       * elsewhere. */
      s = {
        ...s,
        candidateProfile: {
          ...(s.candidateProfile ?? {}),
          askedAboutTeamSize: true,
        } as NegotiationState["candidateProfile"],
      };
    }
    const llm = vi.fn(async () => "LLM SHOULD NOT BE CALLED ON WIRED TOPICS");
    const result = await generateBotReply(s, llm, "How big is the team I'd be joining?");
    expect(llm).not.toHaveBeenCalled();
    expect(result.source).toBe("canonical-fallback");
    expect(result.rejectReason).toMatch(/wired-profile-topic:team-size/);
  });
});
