/* V2-ORCHESTRATOR end-to-end test (2026-06-09).
 *
 * Drives the full v2 brain (kernel → orchestrator → tools → rail)
 * through the Flipkart fixture with a STUB LLM. The point isn't to
 * test LLM judgment — it's to prove that the structural guarantees
 * hold regardless of LLM output:
 *
 *   - When the LLM tries to ask_discovery after the offer-ask
 *     invariant has tripped, the orchestrator rejects it and the
 *     retry path forces a number or an honest decline.
 *   - When the LLM tries to defer without a concrete callback time,
 *     the kernel rejects it.
 *   - When the LLM tries to anchor out-of-band, the kernel rejects.
 *   - When everything fails, the fallback is decline_offer_ask, not
 *     marketing fluff. v1's terminal failure mode is structurally
 *     impossible. */

import { describe, it, expect, vi } from "vitest";
import { generateTurn, type LlmAdapter } from "../../../server-handlers/v2/orchestrator";
import { assertHonestMove } from "../../../server-handlers/v2/rail";
import { computeBand, deriveState, type ConversationTurn } from "../../../server-handlers/v2/kernel";
import type { ToolCall } from "../../../server-handlers/v2/tools";
import fixture from "../../../server-handlers/v2/__fixtures__/flipkart-senior-pd.json";

const FLIPKART_LOG = fixture.log as ConversationTurn[];
const BAND = computeBand("Senior Product Designer", "flipkart", "senior", 6);

/** Stub LLM. The test parameterizes what the LLM "wants" to do; the
 *  orchestrator's job is to enforce the structural rules regardless. */
function stubLlm(plan: ToolCall[]): LlmAdapter {
  let i = 0;
  return vi.fn(async () => {
    const next = plan[i++];
    if (!next) throw new Error("stub LLM ran out of planned calls");
    return next;
  });
}

describe("v2 e2e — the Flipkart bug is structurally impossible", () => {
  it("LLM tries to ask_discovery after T6 offer-ask → orchestrator FORCES a retry", async () => {
    /* Slice the log up to the candidate's T6 "give your initial
     * offer" message. The next AI turn is what v1 produced as
     * "more discovery" (the bug). */
    const log = FLIPKART_LOG.slice(0, 12);

    /* LLM tries discovery first (the v1 bug). Orchestrator rejects
     * (not in legal set). LLM retries with anchor. */
    const llm = stubLlm([
      {
        name: "ask_discovery",
        args: { topic: "market-fit", question: "how does your comp fit the market?" },
      },
      {
        name: "propose_anchor",
        args: {
          number_lpa: BAND.initialOffer,
          rationale: "based on the senior PD band at Flipkart and your 6 YoE in product design",
        },
      },
    ]);

    const result = await generateTurn(log, BAND, llm);
    expect(result.firstPickAccepted).toBe(false);
    expect(result.firstPick.tool).toBe("ask_discovery");
    expect(result.tool).toBe("propose_anchor");
    expect(result.canonical).toMatch(/₹\s*\d+/);
    expect(result.llmCalls).toBe(2);

    /* The rail signs off on the rendered turn. */
    const state = deriveState(log);
    const verdict = assertHonestMove(result, state);
    expect(verdict.pass).toBe(true);
  });

  it("even if the LLM tries discovery AGAIN on retry, fallback is decline_offer_ask — never fluff", async () => {
    const log = FLIPKART_LOG.slice(0, 12);
    const llm = stubLlm([
      {
        name: "ask_discovery",
        args: { topic: "equity", question: "do you have ESOPs in your current role?" },
      },
      {
        name: "ask_discovery",
        args: { topic: "timeline", question: "when do you need to decide?" },
      },
    ]);

    const result = await generateTurn(log, BAND, llm);
    expect(result.tool).toBe("decline_offer_ask");
    expect(result.canonical).toMatch(/ceiling/i);
    expect(result.canonical).not.toMatch(/let me check and come back/i);

    const state = deriveState(log);
    const verdict = assertHonestMove(result, state);
    expect(verdict.pass).toBe(true);
  });

  it("LLM tries to defer without a callback time → kernel rejects, retry path engages", async () => {
    const log = FLIPKART_LOG.slice(0, 12);
    const llm = stubLlm([
      {
        name: "defer_with_callback",
        args: { topic: "the final fitment", when: "soon" },
      },
      {
        name: "propose_anchor",
        args: {
          number_lpa: BAND.initialOffer,
          rationale: "based on senior product design band at Flipkart, this is where we open",
        },
      },
    ]);

    const result = await generateTurn(log, BAND, llm);
    expect(result.firstPickAccepted).toBe(false);
    expect(result.firstPick.tool).toBe("defer_with_callback");
    expect(result.firstPick.rejectionReason).toMatch(/CONCRETE callback time|legal set/);
    expect(result.tool).toBe("propose_anchor");
  });

  it("LLM tries to anchor OUT OF BAND → kernel rejects with the band cited", async () => {
    const log = FLIPKART_LOG.slice(0, 12);
    const wayAbove = BAND.maxStretch + 100;
    const llm = stubLlm([
      {
        name: "propose_anchor",
        args: { number_lpa: wayAbove, rationale: "your strong profile justifies this opening" },
      },
      {
        name: "propose_anchor",
        args: {
          number_lpa: BAND.initialOffer,
          rationale: "this is the calibrated opener for senior PD at Flipkart",
        },
      },
    ]);

    const result = await generateTurn(log, BAND, llm);
    expect(result.firstPickAccepted).toBe(false);
    expect(result.firstPick.rejectionReason).toMatch(/outside band/);
    expect(result.tool).toBe("propose_anchor");
    expect(result.lpa).toBe(BAND.initialOffer);
  });

  it("LLM tries to anchor with FABRICATED % in rationale (the PD #2 T7 bug) → kernel rejects, retry with grounded rationale", async () => {
    /* Candidate states 32 total / 30 base. Variable share is ~6%.
     * The LLM tries to invent "88% variable is significant" — exactly
     * what v1 shipped. v2 must reject. */
    const log: ConversationTurn[] = [
      { role: "ai", text: "current CTC?", tool: "ask_discovery" },
      { role: "candidate", text: "my current ctc is 32 LPA" },
      { role: "ai", text: "base split?", tool: "ask_discovery" },
      { role: "candidate", text: "base is 30 LPA" },
    ];
    const llm = stubLlm([
      {
        name: "propose_anchor",
        args: {
          number_lpa: BAND.initialOffer,
          rationale: "your 88% variable share is significant so we want to bridge with fixed",
        },
      },
      {
        name: "propose_anchor",
        args: {
          number_lpa: BAND.initialOffer,
          rationale: "your current 32 LPA total and 30 LPA base put us at this opener",
        },
      },
    ]);

    const result = await generateTurn(log, BAND, llm);
    expect(result.firstPickAccepted).toBe(false);
    expect(result.firstPick.rejectionReason).toMatch(/88% .* not derivable/);
    expect(result.tool).toBe("propose_anchor");
    expect(result.canonical).toMatch(/32 LPA total/);
  });

  it("LLM tries to anchor citing an INVENTED LPA number ('your 50 LPA peer benchmark') → kernel rejects", async () => {
    const log: ConversationTurn[] = [
      { role: "ai", text: "current CTC?", tool: "ask_discovery" },
      { role: "candidate", text: "my current ctc is 32 LPA" },
    ];
    const llm = stubLlm([
      {
        name: "propose_anchor",
        args: {
          number_lpa: BAND.initialOffer,
          rationale: "your peer benchmark at 50 LPA gives us room to open here",
        },
      },
      {
        name: "propose_anchor",
        args: {
          number_lpa: BAND.initialOffer,
          rationale: "your current 32 LPA puts you well inside the senior PD band",
        },
      },
    ]);

    const result = await generateTurn(log, BAND, llm);
    expect(result.firstPickAccepted).toBe(false);
    expect(result.firstPick.rejectionReason).toMatch(/not grounded/);
    expect(result.tool).toBe("propose_anchor");
  });

  it("post-acceptance: only close_recap is legal — anything else is rejected", async () => {
    const log: ConversationTurn[] = [
      {
        role: "ai",
        text: "anchor at initial",
        tool: "propose_anchor",
        lpa: BAND.initialOffer,
      },
      { role: "candidate", text: "great, I accept the offer" },
    ];

    /* LLM tries to anchor again (illegal post-acceptance). Then
     * close_recap, which the kernel accepts. */
    const llm = stubLlm([
      {
        name: "propose_counter",
        args: { number_lpa: BAND.maxStretch, rationale: "trying to upsell post-acceptance" },
      },
      {
        name: "close_recap",
        args: {
          final_lpa: BAND.initialOffer,
          components: [
            { label: "fixed", lpa: BAND.initialOffer * 0.85 },
            { label: "variable", lpa: BAND.initialOffer * 0.15 },
          ],
        },
      },
    ]);

    const result = await generateTurn(log, BAND, llm);
    expect(result.firstPickAccepted).toBe(false);
    expect(result.tool).toBe("close_recap");
    expect(result.canonical).toMatch(/recap/i);
    expect(result.canonical).toMatch(/HR send the formal letter/i);
  });
});

describe("v2 rail — catches discovery shipped after offer-ask pressure", () => {
  it("flags a discovery turn that somehow slipped through after the offer-ask invariant tripped", async () => {
    /* Simulate a malformed orchestrator result (as if a bug let
     * discovery ship despite the gate). The rail catches it. */
    const log = FLIPKART_LOG.slice(0, 12);
    const state = deriveState(log);
    const verdict = assertHonestMove(
      {
        tool: "ask_discovery",
        canonical: "What's your timeline like?",
        firstPickAccepted: true,
        llmCalls: 1,
        firstPick: { tool: "ask_discovery" },
      },
      state,
    );
    expect(verdict.pass).toBe(false);
    expect(verdict.reason).toMatch(/discovery shipped/i);
  });

  it("passes a discovery turn during early discovery (turn 1, no offer-asks)", () => {
    const verdict = assertHonestMove(
      {
        tool: "ask_discovery",
        canonical: "What's your current CTC?",
        firstPickAccepted: true,
        llmCalls: 1,
        firstPick: { tool: "ask_discovery" },
      },
      {
        turnIndex: 0,
        offerAskCount: 0,
        hasAnchored: false,
        lastAnchorLpa: null,
        candidateTarget: null,
        verbalAcceptanceTurn: null,
        mentionedNumbers: [],
      },
    );
    expect(verdict.pass).toBe(true);
  });
});
