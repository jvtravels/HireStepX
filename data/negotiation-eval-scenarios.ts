/* Negotiation-eval scenarios — recorded candidate transcripts that
 * exercise the recruiter on the negotiation shapes we care about most.
 *
 * Each scenario is:
 *   - a name + a one-line goal
 *   - an init bag (role, company, band) for the kernel
 *   - a list of candidate turns (driven through the planner via the
 *     existing pdfReplay harness)
 *   - an `undisclosed` set: FactKinds the candidate did NOT reveal in
 *     this transcript, used by the no-fabricated-facts rubric line
 *
 * The first three scenarios cover the three negotiation shapes the
 * deep research flagged as highest-frequency in the Indian tech
 * recruiter context. EVAL-2 scales this to ~20, covering every
 * shape from the audit set (exploding offer, retention counter,
 * fixed/variable disclosure, ESOP-heavy comp, tier-2 college
 * candidate, joining-bonus push, notice-period buyback, etc.).
 *
 * Scenarios are TYPED, not JSON, so adding a new one is a typescript
 * exercise with autocomplete on FactKind / band — the same ergonomic
 * the PDF fixtures get. */

import type { FactKind } from "../server-handlers/_conversation-ledger";
import type { NegotiationBand } from "../server-handlers/_negotiation-kernel";

export interface EvalScenarioTurn {
  candidate: string;
  /** Optional verbatim AI text to fold back into transcript. When
   *  omitted, the planner's rationale is used (matches pdfReplay
   *  convention). */
  aiText?: string;
}

export interface EvalScenario {
  /** Stable id — used as the row key in scorecards. Don't rename. */
  id: string;
  /** Short label shown in CI output. */
  label: string;
  /** One-sentence goal: what the recruiter SHOULD do well here. */
  goal: string;
  /** Init bag for the kernel. */
  init: {
    sessionId: string;
    role: string;
    company: string;
    band: NegotiationBand;
  };
  /** Candidate transcript, in order. */
  turns: EvalScenarioTurn[];
  /** FactKinds the candidate did NOT disclose. The no-fabricated-facts
   *  rubric line asserts these stay null in the ledger. */
  undisclosed: readonly FactKind[];
}

const DEFAULT_BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 30,
  walkAway: 20,
  hasEquity: false,
};

const HIGH_BAND: NegotiationBand = {
  initialOffer: 32,
  maxStretch: 40,
  walkAway: 26,
  hasEquity: true,
};

export const EVAL_SCENARIOS: readonly EvalScenario[] = [
  /* ---------------- Scenario 1: exploding offer ---------------- */
  {
    id: "exploding-offer-from-competitor",
    label: "Candidate has a 48h exploding offer from a competitor",
    goal:
      "Recruiter should acknowledge urgency, confirm the deadline, and move to anchor — without panic-anchoring above the candidate's stated target.",
    init: {
      sessionId: "eval-exploding-offer-from-competitor",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "I'm at Razorpay currently.", aiText: "Got it." },
      { candidate: "Current CTC is 18 LPA — 14 fixed, 4 variable.", aiText: "Noted." },
      {
        candidate: "I have a competing offer from PhonePe at 28 LPA, but it expires in 48 hours.",
        aiText: "Understood — that's a real deadline.",
      },
      { candidate: "I'm targeting at least 30 LPA to make this move.", aiText: "OK." },
      {
        candidate: "Can you tell me where you'd land before tomorrow?",
        aiText: "Let me check with my team and come back to you.",
      },
    ],
    undisclosed: ["joining-date", "component-equity", "notice-period-days"],
  },

  /* ---------------- Scenario 2: retention counter ---------------- */
  {
    id: "retention-counter-from-current-employer",
    label: "Current employer made a retention counter mid-conversation",
    goal:
      "Recruiter should treat the retention counter as new information, NOT collapse to a defensive re-anchor, and re-discover what changed in the candidate's situation.",
    init: {
      sessionId: "eval-retention-counter-from-current-employer",
      role: "Senior Software Engineer",
      company: "JP Morgan",
      band: HIGH_BAND,
    },
    turns: [
      { candidate: "I'm at Flipkart, 26 LPA fixed plus 5 variable.", aiText: "Got it." },
      { candidate: "Targeting 38 LPA for this move.", aiText: "Noted." },
      { candidate: "Notice is 60 days.", aiText: "OK." },
      {
        candidate:
          "Actually — my current manager just offered me a retention counter at 34 LPA fixed if I stay.",
        aiText: "That changes the picture.",
      },
      {
        candidate: "Honestly I'd still move for the right number but it has to be meaningful.",
        aiText: "Understood.",
      },
      {
        candidate: "What's the best you can do on fixed?",
        aiText: "Let me work the numbers.",
      },
    ],
    undisclosed: ["joining-date", "component-equity"],
  },

  /* ---------------- Scenario 3: fixed/variable disclosure ---------------- */
  {
    id: "fixed-variable-split-disclosure",
    label: "Candidate discloses CTC then refuses to split fixed/variable",
    goal:
      "Recruiter should ask for the split exactly once, accept refusal gracefully on the second pass, and not re-probe a third time.",
    init: {
      sessionId: "eval-fixed-variable-split-disclosure",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Razorpay, 20 LPA total.", aiText: "Got it." },
      {
        candidate: "I'd rather not break down the fixed/variable split publicly.",
        aiText: "Understood.",
      },
      { candidate: "Target is 28 LPA.", aiText: "Noted." },
      { candidate: "Notice 45 days.", aiText: "OK." },
      { candidate: "No competing offers right now.", aiText: "Understood." },
    ],
    undisclosed: [
      "component-base",
      "component-variable",
      "component-equity",
      "joining-date",
      "competing-offer",
    ],
  },
] as const;

/** Map id → scenario for quick lookup in CI runs. */
export const SCENARIO_BY_ID: Readonly<Record<string, EvalScenario>> =
  Object.freeze(
    Object.fromEntries(EVAL_SCENARIOS.map((s) => [s.id, s])),
  );
