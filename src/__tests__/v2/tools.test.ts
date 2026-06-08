/* V2-TOOLS direct test suite (2026-06-09).
 *
 * Tool-level unit tests for invariants that don't need the full
 * orchestrator. The orchestrator tests prove the orchestration loop;
 * these tests prove individual tool validators reject the specific
 * malformed args that real LLM output produces. */

import { describe, it, expect } from "vitest";
import { executeTool, type ToolCall } from "../../../server-handlers/v2/tools";
import { computeBand, type DerivedState } from "../../../server-handlers/v2/kernel";

const BAND = computeBand("Senior Product Designer", "flipkart", "senior", 6);

function freshState(extra: Partial<DerivedState> = {}): DerivedState {
  return {
    turnIndex: 3,
    offerAskCount: 0,
    hasAnchored: false,
    lastAnchorLpa: null,
    candidateTarget: null,
    verbalAcceptanceTurn: null,
    mentionedNumbers: [],
    ...extra,
  };
}

describe("v2 tools — ask_discovery single-sentence rule (PD #2 T8 monologue fix)", () => {
  it("rejects a multi-sentence question with embedded policy assertion", () => {
    /* The exact T8 shape: a question + an unsolicited declarative
     * about clawback policy tacked on. */
    const call: ToolCall = {
      name: "ask_discovery",
      args: {
        topic: "joining_bonus",
        question:
          "What's the joining bonus bridging on your side? The clawback is typically 12 months pro-rata.",
      },
    };
    const result = executeTool(call, BAND, freshState());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/single sentence/);
    }
  });

  it("rejects a long monologue even without a mid-string period", () => {
    /* >200 chars is structurally not a question. */
    const long =
      "tell me more about everything you're thinking about including the role scope the comp structure the timeline the location the team and any other lever that could possibly come up between now and a final letter being issued";
    const call: ToolCall = {
      name: "ask_discovery",
      args: { topic: "everything", question: long },
    };
    const result = executeTool(call, BAND, freshState());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/single short question|monologue/);
    }
  });

  it("accepts a normal single-sentence discovery question", () => {
    const call: ToolCall = {
      name: "ask_discovery",
      args: {
        topic: "current_ctc",
        question: "What's your current total CTC, including base and variable?",
      },
    };
    const result = executeTool(call, BAND, freshState());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.canonical.endsWith("?")).toBe(true);
    }
  });

  it("accepts a question without a trailing question mark and adds one", () => {
    const call: ToolCall = {
      name: "ask_discovery",
      args: { topic: "scope", question: "What does your current scope look like" },
    };
    const result = executeTool(call, BAND, freshState());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.canonical.endsWith("?")).toBe(true);
    }
  });
});
