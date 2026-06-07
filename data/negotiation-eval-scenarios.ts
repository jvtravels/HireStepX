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

  /* ---------------- Scenario 4: ESOP-heavy compensation ---------------- */
  {
    id: "esop-heavy-comp",
    label: "Candidate's current comp is half ESOP; target leans on equity too",
    goal:
      "Recruiter should capture base / variable / equity as three distinct facts, not silently roll equity into 'total CTC'.",
    init: {
      sessionId: "eval-esop-heavy-comp",
      role: "Senior Software Engineer",
      company: "JP Morgan",
      band: HIGH_BAND,
    },
    turns: [
      { candidate: "I'm at Swiggy.", aiText: "Got it." },
      {
        candidate: "Cash is 24 LPA — 20 fixed, 4 variable. ESOPs vest to about 12 LPA/yr.",
        aiText: "Noted — captured all three.",
      },
      {
        candidate: "Targeting 36 cash + meaningful equity for a senior IC role.",
        aiText: "Understood.",
      },
      { candidate: "Notice is 60 days.", aiText: "OK." },
    ],
    undisclosed: ["joining-date", "competing-offer"],
  },

  /* ---------------- Scenario 5: tier-2 college candidate ---------------- */
  {
    id: "tier-2-college-hedged-disclosure",
    label: "Tier-2 college candidate hedges current CTC; recruiter must not exploit",
    goal:
      "Recruiter should accept the hedged number at face value, NOT push down on it, and NOT fire pressure-leverage off the hedge.",
    init: {
      sessionId: "eval-tier-2-college-hedged-disclosure",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "I'm at a smaller services firm right now.", aiText: "Got it." },
      {
        candidate: "Current CTC is around 12 LPA, give or take.",
        aiText: "Noted.",
      },
      { candidate: "I'd like to target 22 LPA for this move.", aiText: "OK." },
      { candidate: "Notice is 30 days.", aiText: "Got it." },
      { candidate: "No competing offers.", aiText: "Understood." },
    ],
    undisclosed: [
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 6: joining bonus as gap-bridge ---------------- */
  {
    id: "joining-bonus-bridges-gap",
    label: "Candidate target is 2 LPA above band stretch; bridgeable via joining bonus",
    goal:
      "Recruiter should recognize the small gap and surface a joining-bonus/sweetener move, not stall or re-anchor low.",
    init: {
      sessionId: "eval-joining-bonus-bridges-gap",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC 22 LPA, all fixed.", aiText: "Noted." },
      { candidate: "Targeting 32 LPA for this move.", aiText: "Got it." },
      { candidate: "Notice is 60 days.", aiText: "OK." },
      {
        candidate: "If you can get me close I'd be flexible on structure.",
        aiText: "Understood — let me see what we can do.",
      },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 7: notice-period buyback ---------------- */
  {
    id: "notice-period-buyback-ask",
    label: "Candidate has 90-day notice and asks about buyback",
    goal:
      "Recruiter should capture notice as a fact (90 days), acknowledge the buyback ask, and NOT re-probe notice on a later turn.",
    init: {
      sessionId: "eval-notice-period-buyback-ask",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC 21 LPA.", aiText: "Noted." },
      {
        candidate: "Notice period is 90 days — does your offer support buyback?",
        aiText: "Yes, up to 30 days typically.",
      },
      { candidate: "Targeting 28 LPA.", aiText: "Got it." },
      { candidate: "No competing offer.", aiText: "Understood." },
    ],
    undisclosed: [
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 8: multiple competing offers ---------------- */
  {
    id: "multiple-competing-offers",
    label: "Candidate names two competing offers at different LPAs",
    goal:
      "Recruiter should capture competing-offer ONCE (first-wins: 28 LPA) and not double-anchor off the higher number disclosed later.",
    init: {
      sessionId: "eval-multiple-competing-offers",
      role: "Senior Software Engineer",
      company: "JP Morgan",
      band: HIGH_BAND,
    },
    turns: [
      { candidate: "Currently at Zerodha, CTC 28 LPA.", aiText: "Got it." },
      {
        candidate: "I have an offer from PhonePe at 28 LPA.",
        aiText: "Noted.",
      },
      {
        candidate: "And another from Cred at 33 LPA, exploding next week.",
        aiText: "Understood.",
      },
      { candidate: "Targeting 36 LPA here.", aiText: "OK." },
      { candidate: "Notice is 60 days.", aiText: "Got it." },
    ],
    undisclosed: ["joining-date", "component-equity"],
  },

  /* ---------------- Scenario 9: unrealistic target ---------------- */
  {
    id: "unrealistic-target-above-walkaway",
    label: "Candidate target is 2x current CTC and above band's max stretch",
    goal:
      "Recruiter should capture the target as stated (first-wins), NOT silently rewrite it, and NOT fire pressure-leverage on the candidate for asking high.",
    init: {
      sessionId: "eval-unrealistic-target-above-walkaway",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC is 15 LPA.", aiText: "Noted." },
      { candidate: "Target is 35 LPA.", aiText: "Got it — that's ambitious." },
      { candidate: "I have strong reasons — recent IPO equity vesting.", aiText: "OK." },
      { candidate: "Notice 45 days.", aiText: "Understood." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 10: walk-away signal ---------------- */
  {
    id: "explicit-walkaway-signal",
    label: "Candidate explicitly says 'won't move below X' where X > walkAway",
    goal:
      "Recruiter should treat the floor as a hard fact and NOT fire stall-cascade. Discovery may legitimately continue but no coercive flag should fire.",
    init: {
      sessionId: "eval-explicit-walkaway-signal",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC is 19 LPA.", aiText: "Noted." },
      {
        candidate: "I won't move for anything below 26 LPA — that's a hard floor.",
        aiText: "Understood.",
      },
      { candidate: "Notice 60 days.", aiText: "Got it." },
      { candidate: "No competing offers.", aiText: "OK." },
    ],
    undisclosed: [
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 11: late CTC disclosure ---------------- */
  {
    id: "late-ctc-disclosure",
    label: "Candidate dodges CTC for 3 turns then discloses",
    goal:
      "Recruiter should probe CTC at most twice, accept the eventual disclosure cleanly, and NOT have re-asked >2 times by the time it lands.",
    init: {
      sessionId: "eval-late-ctc-disclosure",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "I'd rather discuss target first.", aiText: "OK." },
      { candidate: "Target is 28 LPA.", aiText: "Noted." },
      { candidate: "Notice is 60 days.", aiText: "Got it." },
      { candidate: "OK current CTC is 21 LPA, all fixed.", aiText: "Understood." },
    ],
    undisclosed: [
      "component-variable",
      "component-equity",
      "competing-offer",
      "joining-date",
    ],
  },

  /* ---------------- Scenario 12: refusal cascade ---------------- */
  {
    id: "refusal-cascade-three-probes",
    label: "Candidate refuses CTC, notice, AND competing-offer probes",
    goal:
      "Recruiter must accept each refusal and NOT re-probe a refused topic on a later turn (probe-once + refusal-respected).",
    init: {
      sessionId: "eval-refusal-cascade-three-probes",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "I'd prefer not to share current CTC at this stage.", aiText: "Understood." },
      { candidate: "And I'd rather not discuss notice period yet.", aiText: "OK." },
      {
        candidate: "Competing offers — I'd prefer to keep that confidential.",
        aiText: "Got it.",
      },
      { candidate: "Target is 30 LPA.", aiText: "Noted." },
    ],
    undisclosed: [
      "current-ctc",
      "notice-period-days",
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 13: early accept ---------------- */
  {
    id: "early-accept-turn-three",
    label: "Candidate accepts in turn 3 before any anchor lands",
    goal:
      "Recruiter should respect the close, NOT fire stall-cascade or pressure-repeat to extract more discovery after acceptance, and emit a terminal-close family action.",
    init: {
      sessionId: "eval-early-accept-turn-three",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC 18 LPA, target 25 LPA.", aiText: "Got it." },
      {
        candidate: "Honestly the role + team is what matters most.",
        aiText: "Glad to hear that.",
      },
      { candidate: "Send me the formal offer, I'm in.", aiText: "Welcome aboard." },
    ],
    undisclosed: [
      "notice-period-days",
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 14: role mismatch ---------------- */
  {
    id: "role-mismatch-needs-clarify",
    label: "Candidate is a SE but expresses interest in SDM scope",
    goal:
      "Recruiter should NOT silently rewrite the role; the session role stays SE; discovery continues. No fabricated role-change in the ledger.",
    init: {
      sessionId: "eval-role-mismatch-needs-clarify",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "I'm a SE3 at Myntra, 24 LPA.", aiText: "Got it." },
      {
        candidate: "Actually I'm hoping to take on a team-lead scope here.",
        aiText: "Noted — let me check what's open.",
      },
      { candidate: "Targeting 32 LPA either way.", aiText: "OK." },
      { candidate: "Notice is 45 days.", aiText: "Got it." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 15: recap and close ---------------- */
  {
    id: "recap-and-close",
    label: "Long discovery leads to a recap turn then candidate accepts",
    goal:
      "Recruiter should emit a recap-summary family action before close. Recap-summary itself is non-coercive — must NOT fire any guardrail flag.",
    init: {
      sessionId: "eval-recap-and-close",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Currently at Razorpay, 19 LPA.", aiText: "Got it." },
      { candidate: "Fixed 16, variable 3.", aiText: "Noted." },
      { candidate: "Target is 27 LPA.", aiText: "OK." },
      { candidate: "Notice 60 days.", aiText: "Got it." },
      { candidate: "No competing offers.", aiText: "Understood." },
      {
        candidate: "Can you summarize where we've landed?",
        aiText: "Sure — current 19, target 27, notice 60, no competing.",
      },
      { candidate: "Looks right. I accept.", aiText: "Welcome aboard." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 16: mid-session band shift ---------------- */
  {
    id: "competing-offer-revealed-mid-session",
    label: "Candidate reveals competing offer at turn 5 after earlier 'no'",
    goal:
      "Recruiter should capture the late competing-offer cleanly; first-wins on the EARLIER 'no competing offer' is the intended behavior — the planner must NOT overwrite the original null with a number.",
    init: {
      sessionId: "eval-competing-offer-revealed-mid-session",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC 20 LPA.", aiText: "Noted." },
      { candidate: "Target 28 LPA.", aiText: "Got it." },
      { candidate: "Notice 60 days.", aiText: "OK." },
      { candidate: "No competing offers at the moment.", aiText: "Understood." },
      {
        candidate: "Actually — I do have a competing offer from Cred at 30 LPA.",
        aiText: "Got it — appreciate the update.",
      },
    ],
    undisclosed: [
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 17: partial disclosure, no target ---------------- */
  {
    id: "partial-disclosure-no-target",
    label: "Candidate gives CTC and notice but deliberately omits target",
    goal:
      "Recruiter should probe target at most twice, then proceed without it; no fabricated target in ledger.",
    init: {
      sessionId: "eval-partial-disclosure-no-target",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Razorpay, 18 LPA.", aiText: "Got it." },
      { candidate: "Notice 30 days.", aiText: "Noted." },
      {
        candidate: "I'd rather hear what your range is before sharing a target.",
        aiText: "Understood — let me share that.",
      },
      { candidate: "No competing offers.", aiText: "OK." },
    ],
    undisclosed: [
      "target-ctc",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 18: terminal walk-away ---------------- */
  {
    id: "terminal-walkaway-respected",
    label: "Candidate walks away in turn 4 — recruiter must close gracefully",
    goal:
      "Recruiter should respect the walk-away with a terminal-close action and NOT fire pressure-leverage or stall-cascade to recover the candidate.",
    init: {
      sessionId: "eval-terminal-walkaway-respected",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC 22 LPA.", aiText: "Noted." },
      { candidate: "Target is 35 LPA, that's my number.", aiText: "Got it." },
      {
        candidate: "If you can't meet 32 at minimum I'd rather not continue.",
        aiText: "Understood.",
      },
      {
        candidate: "Thanks for your time — I'll pass on this one.",
        aiText: "Appreciate the conversation, best of luck.",
      },
    ],
    undisclosed: [
      "notice-period-days",
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 19: salary inflation history ---------------- */
  {
    id: "salary-inflation-history",
    label: "Candidate lists three past employers with steep CTC growth",
    goal:
      "Recruiter should capture only the CURRENT employer + current CTC. Past employer names must NOT pollute current-company; past CTCs must NOT overwrite current-ctc.",
    init: {
      sessionId: "eval-salary-inflation-history",
      role: "Senior Software Engineer",
      company: "JP Morgan",
      band: HIGH_BAND,
    },
    turns: [
      {
        candidate: "I started at TCS (4 LPA), moved to Flipkart (12 LPA), then Razorpay.",
        aiText: "Strong trajectory.",
      },
      { candidate: "Current at Razorpay is 30 LPA.", aiText: "Noted." },
      { candidate: "Target is 42 LPA.", aiText: "Got it." },
      { candidate: "Notice 60 days.", aiText: "OK." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 20: long naturalistic capstone ---------------- */
  {
    id: "naturalistic-capstone-eval",
    label: "10-turn realistic session — capstone covering every rubric line",
    goal:
      "All structural criteria pass simultaneously across a long naturalistic exchange — proves the rubric isn't dependent on artificially-short transcripts.",
    init: {
      sessionId: "eval-naturalistic-capstone-eval",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "I'm at Razorpay.", aiText: "Got it." },
      { candidate: "Current CTC is 20 LPA — 17 fixed, 3 variable.", aiText: "Noted." },
      { candidate: "Targeting 28 LPA for this move.", aiText: "OK." },
      { candidate: "Notice is 45 days.", aiText: "Got it." },
      { candidate: "I have a competing offer from PhonePe at 26 LPA.", aiText: "Understood." },
      { candidate: "Tell me about the team structure.", aiText: "Two pods of 6 engineers." },
      { candidate: "And the on-call expectations?", aiText: "1 week per quarter." },
      { candidate: "How's growth into senior IC tracks?", aiText: "Typically 18-24 months." },
      { candidate: "Sounds aligned — what's your number?", aiText: "Let me come back with a formal offer." },
      { candidate: "Sure, I'll wait for the email.", aiText: "Sending today." },
    ],
    undisclosed: ["joining-date", "component-equity"],
  },
] as const;

/** Map id → scenario for quick lookup in CI runs. */
export const SCENARIO_BY_ID: Readonly<Record<string, EvalScenario>> =
  Object.freeze(
    Object.fromEntries(EVAL_SCENARIOS.map((s) => [s.id, s])),
  );
