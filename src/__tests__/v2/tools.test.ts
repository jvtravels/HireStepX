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
    surfacedTopics: [],
    closedTopics: [],
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

describe("v2 tools — defer_with_callback surfacedTopics gate", () => {
  it("rejects a defer on a topic the candidate never raised", () => {
    /* The v1 failure: AI says "let me check on the joining bonus"
     * when the candidate never mentioned joining bonus. v2 must
     * refuse — the LLM doesn't get to invent the topic. */
    const call: ToolCall = {
      name: "defer_with_callback",
      args: { topic: "joining bonus", when: "by EOD tomorrow" },
    };
    const result = executeTool(call, BAND, freshState({ surfacedTopics: ["base", "variable"] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/not raised by the candidate/);
    }
  });

  it("accepts a defer on a topic the candidate did raise", () => {
    const call: ToolCall = {
      name: "defer_with_callback",
      args: { topic: "joining bonus", when: "by EOD tomorrow" },
    };
    const result = executeTool(call, BAND, freshState({ surfacedTopics: ["joining bonus", "base"] }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.canonical).toMatch(/joining bonus/i);
      expect(result.canonical).toMatch(/EOD tomorrow/i);
    }
  });

  it("matches by substring — AI's topic 'esop vesting schedule' grounds against surfaced 'esop'", () => {
    const call: ToolCall = {
      name: "defer_with_callback",
      args: { topic: "esop vesting schedule", when: "by Friday" },
    };
    const result = executeTool(call, BAND, freshState({ surfacedTopics: ["esop"] }));
    expect(result.ok).toBe(true);
  });

  it("still rejects when surfacedTopics is empty (no candidate disclosures yet)", () => {
    const call: ToolCall = {
      name: "defer_with_callback",
      args: { topic: "variable", when: "by tomorrow EOD" },
    };
    const result = executeTool(call, BAND, freshState({ surfacedTopics: [] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/surfaced: none/);
    }
  });
});

describe("v2 tools — ask_discovery closed-topic gate (Bug #58 T3 fix)", () => {
  /* Candidate said "24 LPA is base" (= no variable). AI must NOT ask
   * about variable again. Same for "no rsu/esop" closing esop. */
  it("rejects asking about variable after candidate closed it", () => {
    const call: ToolCall = {
      name: "ask_discovery",
      args: {
        topic: "variable",
        question: "What's the variable component — performance-linked or fixed",
      },
    };
    const result = executeTool(call, BAND, freshState({ closedTopics: ["variable"] }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/already closed|redundant/);
    }
  });

  it("rejects when the topic arg is generic but the question references the closed topic", () => {
    /* Defense in depth — LLM passes topic:"package" but asks about ESOP. */
    const call: ToolCall = {
      name: "ask_discovery",
      args: {
        topic: "package",
        question: "Do you have any RSUs vesting from your current company",
      },
    };
    const result = executeTool(call, BAND, freshState({ closedTopics: ["esop"] }));
    expect(result.ok).toBe(false);
  });

  it("accepts a discovery question on an unrelated topic", () => {
    const call: ToolCall = {
      name: "ask_discovery",
      args: { topic: "timeline", question: "What's your earliest joining date" },
    };
    const result = executeTool(call, BAND, freshState({ closedTopics: ["variable", "esop"] }));
    expect(result.ok).toBe(true);
  });
});

describe("v2 tools — ask_discovery answer-options rule (Bug #58 T8 fix)", () => {
  /* T8: AI as recruiter asks "what justifies it — design system
   * ownership, user-research depth, conversion / retention impact?"
   * The recruiter offered the candidate three hypothetical justifications
   * — role-confused. */
  it("rejects a question that offers 3 comma-separated answer options after an em-dash", () => {
    const call: ToolCall = {
      name: "ask_discovery",
      args: {
        topic: "justification",
        question:
          "what justifies it — design system ownership, user-research depth, conversion / retention impact?",
      },
    };
    const result = executeTool(call, BAND, freshState());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/list of answer options|do not propose/);
    }
  });

  it("rejects a colon-introduced option list", () => {
    const call: ToolCall = {
      name: "ask_discovery",
      args: {
        topic: "scope",
        question: "what shapes your scope: team size, reporting line, charter",
      },
    };
    const result = executeTool(call, BAND, freshState());
    expect(result.ok).toBe(false);
  });

  it("accepts a question with a single comma after an em-dash (clarifier, not a list)", () => {
    const call: ToolCall = {
      name: "ask_discovery",
      args: {
        topic: "scope",
        question: "tell me — what's the scope you own today",
      },
    };
    const result = executeTool(call, BAND, freshState());
    expect(result.ok).toBe(true);
  });

  it("accepts a normal multi-clause question with no list separator", () => {
    const call: ToolCall = {
      name: "ask_discovery",
      args: {
        topic: "ctc",
        question: "what's your current CTC including base and any variable",
      },
    };
    const result = executeTool(call, BAND, freshState());
    expect(result.ok).toBe(true);
  });
});
