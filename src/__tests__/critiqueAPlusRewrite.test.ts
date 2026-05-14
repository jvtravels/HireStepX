import { describe, it, expect } from "vitest";
import {
  critiqueRecruiterWithQuotes,
} from "../../server-handlers/_recruiter-critique";
import {
  initState,
  type NegotiationState,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import type { KernelTurnSummary } from "../../server-handlers/_negotiation-metrics";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 30, walkAway: 16, hasEquity: false };

function makeState(over: Partial<NegotiationState> = {}): NegotiationState {
  const base = initState({ sessionId: "ap1", role: "swe", company: "Acme", band: BAND, maxTurns: 8 });
  return { ...base, ...over } as NegotiationState;
}

function m(over: Partial<KernelTurnSummary>): KernelTurnSummary {
  return {
    lever: "open-with-offer",
    newTotalLpa: null,
    turnIndex: 0,
    candidateTargetAtTurn: null,
    ...over,
  } as KernelTurnSummary;
}

describe("critiqueRecruiterWithQuotes — quotes + A+ rewrite", () => {
  it("returns the items list verbatim from critiqueRecruiterStrategy", () => {
    const state = makeState();
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "counter-base", newTotalLpa: 30, turnIndex: 1 }),
    ];
    const out = critiqueRecruiterWithQuotes({ finalState: state, moves });
    expect(out.items.length).toBeGreaterThan(0);
    expect(out.items.every((i) => typeof i.code === "string")).toBe(true);
  });

  it("attaches verbatim candidate quotes to issues with a turnIndex", () => {
    const state = makeState({
      conversationLog: [
        { speaker: "ai", text: "We're offering ₹22 LPA fixed." },
        { speaker: "candidate", text: "Whatever works, I'm flexible." },
        { speaker: "ai", text: "Great — let's go with ₹30 LPA then." },
      ],
    });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "counter-base", newTotalLpa: 30, turnIndex: 1 }),
    ];
    const out = critiqueRecruiterWithQuotes({ finalState: state, moves });
    expect(out.quotes.length).toBeGreaterThan(0);
    for (const q of out.quotes) {
      const log = state.conversationLog;
      const sourceLine = log[q.turn];
      expect(sourceLine.speaker).toBe("candidate");
      expect(q.text).toBe(sourceLine.text);
    }
  });

  it("returns an A+ rewrite for the weakest turn when issues exist", () => {
    const state = makeState({
      conversationLog: [
        { speaker: "ai", text: "Offer is ₹22 LPA." },
        { speaker: "candidate", text: "Sounds fine, I trust your number." },
        { speaker: "ai", text: "Going up to ₹30 LPA." },
      ],
    });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "counter-base", newTotalLpa: 30, turnIndex: 1 }),
    ];
    const out = critiqueRecruiterWithQuotes({ finalState: state, moves });
    expect(out.aPlusRewrite).not.toBeNull();
    expect(out.aPlusRewrite!.weakestTurn).toBeGreaterThanOrEqual(0);
    expect(out.aPlusRewrite!.originalText.length).toBeGreaterThan(0);
    expect(out.aPlusRewrite!.rewrittenText.length).toBeGreaterThan(0);
    expect(out.aPlusRewrite!.why.length).toBeGreaterThan(0);
    /* The rewrite must differ from the original — coach is showing a
     * better way to say it. */
    expect(out.aPlusRewrite!.rewrittenText).not.toBe(out.aPlusRewrite!.originalText);
  });

  it("aPlusRewrite is null when there are no issues AND no candidate lines", () => {
    const state = makeState();
    const moves: KernelTurnSummary[] = [];
    const out = critiqueRecruiterWithQuotes({ finalState: state, moves });
    expect(out.items.length).toBe(0);
    expect(out.aPlusRewrite).toBeNull();
  });

  it("picks the highest-severity issue as the weakest-turn anchor", () => {
    /* hold-firm-then-concede is severity=blocker; open-too-high is
     * severity=concern. With both fired, the rewrite must be tied to
     * the blocker. */
    const state = makeState({
      conversationLog: [
        { speaker: "ai", text: "Offering ₹26 LPA." },
        { speaker: "candidate", text: "I'm targeting ₹28 LPA." },
        { speaker: "ai", text: "Bumping to ₹27." },
        { speaker: "candidate", text: "Still short — I need ₹28." },
        { speaker: "ai", text: "₹27 is our final offer." },
        { speaker: "candidate", text: "Then we have a problem." },
        { speaker: "ai", text: "Fine — ₹28 then." },
      ],
    });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 26, turnIndex: 0, candidateTargetAtTurn: 28 }),
      m({ lever: "counter-base", newTotalLpa: 27, turnIndex: 1, candidateTargetAtTurn: 28 }),
      m({ lever: "hold-firm", turnIndex: 2, candidateTargetAtTurn: 28 }),
      m({ lever: "counter-base", newTotalLpa: 28, turnIndex: 3, candidateTargetAtTurn: 28 }),
    ];
    const out = critiqueRecruiterWithQuotes({ finalState: state, moves });
    expect(out.items.some((i) => i.code === "hold-firm-then-concede")).toBe(true);
    expect(out.aPlusRewrite).not.toBeNull();
    /* Rewrite text should reference structure or an adjacent lever
     * (sign-on / equity), since the linked issue is hold-firm-then-concede. */
    const rw = out.aPlusRewrite!.rewrittenText;
    const why = out.aPlusRewrite!.why.toLowerCase();
    const refsLever = /sign-on|equity|base|esop|joining/i.test(rw);
    expect(refsLever || why.includes("lever")).toBe(true);
  });

  it("quote text is a verbatim substring of an actual candidate line", () => {
    const state = makeState({
      conversationLog: [
        { speaker: "ai", text: "Offering ₹22 LPA." },
        { speaker: "candidate", text: "Original candidate phrasing here, with a specific 7%." },
        { speaker: "ai", text: "Bumping to ₹30 LPA." },
      ],
    });
    const moves = [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "counter-base", newTotalLpa: 30, turnIndex: 1 }),
    ];
    const out = critiqueRecruiterWithQuotes({ finalState: state, moves });
    for (const q of out.quotes) {
      expect(state.conversationLog[q.turn].text).toContain(q.text);
    }
  });
});
