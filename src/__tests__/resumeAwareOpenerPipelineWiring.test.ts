/* PDF#27 Fix 6 (2026-05-17) — resume-aware opener wiring verification.
 *
 * df305ac modified renderCanonicalProse to cite resumeFactPack.latest
 * Role.companyName + title at turnIndex==0. Fix 6 verifies the opener
 * is reachable through the ACTIVE negotiate-turn code path
 * (generateBotReply → planNextAction → renderCanonicalProse → restyle
 * → validate). When the LLM is forced to fail validation, the fallback
 * returns the canonical opener verbatim — that's our window into what
 * the kernel-first pipeline emits.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { generateBotReply, type GenerateAiTextFn } from "../../server-handlers/_response-pipeline";
import type { ResumeFactPack } from "../../server-handlers/_resume-fact-pack";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  const s = initState({
    sessionId: "fix6-pipeline",
    role: "Senior Product Designer",
    company: "acme",
    band: BAND,
  });
  /* Force the open-with-offer path: skip discovery so the planner
   * routes turn-0 through the opener branch where the resume-aware
   * canonical prose lives. Real production sessions hit this path
   * when discoveryStage is set to "skip" by the off-script intake. */
  return Object.assign(s, {
    turnIndex: 0,
    discoveryStage: "skip" as never,
    ...overrides,
  });
}

/* Force the LLM restyle to fail validation by returning empty so the
 * canonical opener falls through verbatim. This is the surface the
 * pipeline actually emits when restyle fails — testing the canonical
 * via the pipeline rather than calling renderCanonicalProse directly. */
const llmReturnsEmpty: GenerateAiTextFn = async () => "";

describe("PDF#27 Fix 6 — resume-aware opener is on the active pipeline path", () => {
  it("ResumeFactPack with latestRole.companyName → canonical opener cites that company", async () => {
    const rfp: ResumeFactPack = {
      priorCompanies: [],
      stackTags: [],
      tenurePattern: "unknown" as never,
      mbaTier: "none" as never,
      leadershipClaimed: false,
      gapMonths: null,
      latestRole: {
        title: "Senior Product Designer",
        companyName: "Flipkart",
        companyTier: "unicorn",
      },
    };
    const state = mkState({ resumeFactPack: rfp });
    const result = await generateBotReply(state, llmReturnsEmpty);
    expect(result.text).toMatch(/Flipkart/);
    expect(result.text).toMatch(/Senior Product Designer/i);
  });

  it("no ResumeFactPack → canonical opener falls back to generic phrasing", async () => {
    const state = mkState();
    const result = await generateBotReply(state, llmReturnsEmpty);
    expect(result.text).toMatch(/compensation structure/i);
    /* Generic opener does NOT name a specific company beyond
     * state.company; certainly not Flipkart. */
    expect(result.text).not.toMatch(/Flipkart/);
  });
});
