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
  /** OPTIONAL: facts the candidate DID disclose with their expected
   *  bound values. The disclosed-facts-bound rubric line asserts
   *  getFact(kind) matches each declared value. Scenarios that omit
   *  this field get n/a on that criterion (backwards-compatible).
   *  Use this when the binding correctness — not just "no crash, no
   *  fabrication" — is the actual thing under test. */
  expectedDisclosures?: Partial<Record<FactKind, number | string>>;
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
    expectedDisclosures: {
      "current-ctc": 18,
      "component-base": 14,
      "component-variable": 4,
      "competing-offer": 28,
      "target-ctc": 30,
    },
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
    expectedDisclosures: {
      "current-ctc": 20,
      "target-ctc": 28,
      "notice-period-days": 45,
    },
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
    expectedDisclosures: {
      "current-ctc": 22,
      "target-ctc": 32,
      "notice-period-days": 60,
    },
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
    expectedDisclosures: {
      "current-ctc": 18,
      "target-ctc": 25,
    },
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
    expectedDisclosures: {
      "current-ctc": 19,
      "component-base": 16,
      "component-variable": 3,
      "target-ctc": 27,
      "notice-period-days": 60,
    },
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
    expectedDisclosures: {
      "current-ctc": 20,
      "component-base": 17,
      "component-variable": 3,
      "target-ctc": 28,
      "notice-period-days": 45,
      "competing-offer": 26,
    },
  },

  /* ============================================================ *
   * EVAL-4: adversarial layer.                                   *
   *                                                              *
   * The first 20 scenarios are recorded "realistic" transcripts. *
   * The 6 below are DESIGNED to stress-test classes of bug the   *
   * QUALITY-1 fix made visible — verb-form cues, compound parses,*
   * first-wins under pressure, range disclosures, bare-number    *
   * disambiguation, Hindi-mix compound. If any of these regress  *
   * the suite, that IS the next QUALITY-N PR.                    *
   * ============================================================ */

  /* ---------------- Scenario 21: 'anchored at' verb form ---------------- */
  {
    id: "anchored-at-verb-form",
    label: "Candidate uses 'anchored at' — past-participle of anchor cue",
    goal:
      "Same class as QUALITY-1: TARGET_CUES has /anchor(?:ing)?…/ but not /anchored/. The parser must bind 'anchored at 30 LPA' as target=30; if it silently drops, the planner re-probes and the discovery-before-anchor rubric line stays unfired (which still scores OK), but probe-once-per-topic will flip if target gets re-probed >2x.",
    init: {
      sessionId: "eval-anchored-at-verb-form",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC is 22 LPA, all fixed.", aiText: "Noted." },
      { candidate: "I'm anchored at 30 LPA for this move.", aiText: "Got it." },
      { candidate: "Notice 45 days.", aiText: "OK." },
      { candidate: "No competing offer.", aiText: "Understood." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-variable",
      "component-equity",
    ],
    expectedDisclosures: {
      "current-ctc": 22,
      // "anchored at 30 LPA" — verb-form target cue. If parser
      // misses, target-ctc lands null and this fails — exactly the
      // class of bug PARSER-1 surfaced for component-* facts.
      "target-ctc": 30,
      "notice-period-days": 45,
    },
  },

  /* ---------------- Scenario 22: compound one-breath disclosure ---------------- */
  {
    id: "compound-one-breath-disclosure",
    label: "Candidate discloses CTC + split + target + notice + competing in turn 1",
    goal:
      "Parser must fan out a single utterance into multiple ledger writes correctly — not collapse to one fact, not double-write any. Probe-once-per-topic shouldn't fire any discovery probes since everything is already disclosed by turn 2.",
    init: {
      sessionId: "eval-compound-one-breath-disclosure",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      {
        candidate:
          "Quick context: currently at Razorpay drawing 20 LPA (17 fixed, 3 variable), targeting 28 LPA, notice 60 days, no competing offers.",
        aiText: "Captured all of that.",
      },
      { candidate: "What's the next step?", aiText: "Let me share what we're thinking." },
    ],
    undisclosed: ["joining-date", "component-equity"],
    expectedDisclosures: {
      "current-ctc": 20,
      "component-base": 17,
      "component-variable": 3,
      "target-ctc": 28,
      "notice-period-days": 60,
    },
  },

  /* ---------------- Scenario 23: first-wins under pressure ---------------- */
  {
    id: "first-wins-self-corrected-ctc",
    label: "Candidate states CTC then 'corrects' it upward two turns later",
    goal:
      "Read-layer first-wins must hold under audit-trail re-appends: the ledger correctly appends the 22 LPA disclosure as part of the audit trail (that's the contract), but getFact(\"current-ctc\") must still return 18 (the earliest). Planner reads from getFact, so the 'correction' is effectively ignored as far as anchoring decisions go — exactly the anti-gaming guarantee. The first-wins-honored rubric line tests the read layer directly.",
    init: {
      sessionId: "eval-first-wins-self-corrected-ctc",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC is 18 LPA.", aiText: "Noted." },
      { candidate: "Target 28 LPA.", aiText: "Got it." },
      {
        candidate: "Actually wait — current is 22 LPA, I forgot the variable.",
        aiText: "Understood.",
      },
      { candidate: "Notice 45 days.", aiText: "OK." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
    expectedDisclosures: {
      // First-wins: read layer returns the EARLIEST disclosure (18),
      // not the later "correction" to 22. The ledger audit-trails both;
      // the read-layer contract is what matters here.
      "current-ctc": 18,
      "target-ctc": 28,
      "notice-period-days": 45,
    },
  },

  /* ---------------- Scenario 24: range disclosure ---------------- */
  {
    id: "target-stated-as-range",
    label: "Candidate states target as a range '25-28 LPA' instead of a single number",
    goal:
      "Range cues exist in TARGET_CUES (/\\bbetween\\b/) — parser should bind ONE value (typically the upper of the range, or skip cleanly) and NOT cycle back to re-probe target. probe-once-per-topic is the gate.",
    init: {
      sessionId: "eval-target-stated-as-range",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC is 19 LPA.", aiText: "Noted." },
      { candidate: "Looking for something between 25 and 28 LPA.", aiText: "Got it." },
      { candidate: "Notice is 60 days.", aiText: "OK." },
      { candidate: "No competing offer.", aiText: "Understood." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 25: Hindi-mix compound disclosure ---------------- */
  {
    id: "hindi-mix-compound-disclosure",
    label: "Candidate discloses current + target in Hindi-mix register",
    goal:
      "Hindi cues (/chahiye/, /mil jaye/, /expect karta hu/) must classify correctly when stacked with English. Real Indian-tech transcript pattern. No fabrication; probe-once enforced.",
    init: {
      sessionId: "eval-hindi-mix-compound-disclosure",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      {
        candidate: "Sir, currently 18 LPA hai — Razorpay mein.",
        aiText: "Got it.",
      },
      {
        candidate: "Mujhe 28 LPA chahiye is move ke liye, minimum 26 LPA mil jaye to consider karenge.",
        aiText: "Noted.",
      },
      { candidate: "Notice period 60 days hai.", aiText: "Understood." },
      { candidate: "Koi competing offer nahi hai abhi.", aiText: "OK." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 26: bare-number reply in probe phase ---------------- */
  {
    id: "bare-number-reply-in-probe",
    label: "Candidate answers each probe with bare numbers; planner must bind via phase context",
    goal:
      "Bare-reply context binding ('30 LPA' alone) must use lastAiText / phase to resolve role. The classifier table already encodes this; this scenario verifies it survives a 5-turn chain of bare replies without any role drift or re-probe.",
    init: {
      sessionId: "eval-bare-number-reply-in-probe",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "20 LPA.", aiText: "What's your target for this move?" },
      { candidate: "28 LPA.", aiText: "And notice period?" },
      { candidate: "45 days.", aiText: "Any competing offers?" },
      { candidate: "None right now.", aiText: "Got it." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
    expectedDisclosures: {
      // Bare numbers context-bind via lastAiText. Turn 0's bare "20 LPA"
      // has no prior bot text yet (replay starts candidate-first), so
      // current-ctc binding requires either (a) a turn-0-opening-phase
      // heuristic that doesn't exist or (b) the candidate self-cueing.
      // The cleaner test is the SUBSEQUENT bare replies: turn 1's
      // "28 LPA" with lastAiText="What's your target..." binds to
      // target via LAST_AI_ASKED_TARGET (AUDIT-2), and turn 2's "45 days"
      // unambiguously notice via unit alone.
      "target-ctc": 28,
      "notice-period-days": 45,
    },
  },

  /* ============================================================ *
   * EVAL-5: meaner adversarial layer.                            *
   *                                                              *
   * EVAL-4 added "stress test the happy parser." This adds       *
   * "stress test the messy real world": typos, mid-utterance     *
   * language switches, downward corrections, negated cues,       *
   * prose joining dates, recruiter-echo, and contradicting-      *
   * fact ambiguity. Each scenario targets a class of mistake     *
   * the deterministic scorer can verify without an LLM.          *
   * ============================================================ */

  /* ---------------- Scenario 27: typo'd disclosure ---------------- */
  {
    id: "typoed-disclosure",
    label: "Candidate disclosure has plausible typos in cue words",
    goal:
      "Real candidates typo. 'currnt' / 'tarrget' / 'expecitng' are common autocomplete misfires; the parser should NOT silently drop a number because the cue word is one letter off. If it does, planner re-probes and probe-once-per-topic flips on a long-enough chain. Mostly informational for now — if this fails we want to know the typo-tolerance bound.",
    init: {
      sessionId: "eval-typoed-disclosure",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "currnt CTC is 18 LPA", aiText: "Noted." },
      { candidate: "tarrget 28 LPA for this move", aiText: "Got it." },
      { candidate: "notice 45 days", aiText: "OK." },
      { candidate: "no competing offer", aiText: "Understood." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 28: downward correction ---------------- */
  {
    id: "first-wins-self-corrected-downward",
    label: "Candidate inflates CTC then 'corrects' downward — first-wins still holds",
    goal:
      "Symmetric to scenario 23 but downward. Candidate states 25 LPA, two turns later says 'actually 20 LPA' (still meeting band but stripped variable). getFact must return 25 (the earliest) — the read layer doesn't care about direction of the correction. Prevents post-hoc deflation gaming as much as inflation gaming.",
    init: {
      sessionId: "eval-first-wins-self-corrected-downward",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC is 25 LPA.", aiText: "Noted." },
      { candidate: "Target 32 LPA.", aiText: "Got it." },
      {
        candidate: "Actually wait — current is 20 LPA without the variable component.",
        aiText: "OK.",
      },
      { candidate: "Notice 60 days.", aiText: "Understood." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 29: mid-utterance language switch ---------------- */
  {
    id: "mid-utterance-language-switch",
    label: "Candidate code-switches English↔Hindi mid-sentence with numbers",
    goal:
      "Common in real Indian-tech transcripts: an English clause carrying current-CTC followed by a Hindi clause carrying target. Each number must bind to the right role despite the language flip inside the same utterance. Probes the cue tables don't silently anchor on the first language seen.",
    init: {
      sessionId: "eval-mid-utterance-language-switch",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      {
        candidate: "I'm currently at Flipkart drawing 22 LPA, lekin mujhe 30 LPA chahiye is move ke liye.",
        aiText: "Noted both numbers.",
      },
      { candidate: "Notice period 45 days hai.", aiText: "OK." },
      { candidate: "Competing offers? Nahi, abhi nothing.", aiText: "Understood." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 30: negated cue ---------------- */
  {
    id: "negated-cue-bare-number",
    label: "Candidate says 'not 30 LPA, that's too high' — negation must NOT bind 30 as target",
    goal:
      "If parser binds bare-numbered negation as a target, planner anchors high based on a number the candidate explicitly rejected. Test: after this utterance, getFact(\"target-ctc\") should be null (or the legitimately-stated target if one follows). no-fabricated-facts gates this — target-ctc is listed undisclosed for the all-negation case.",
    init: {
      sessionId: "eval-negated-cue-bare-number",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current CTC 22 LPA.", aiText: "Noted." },
      {
        candidate: "Not 30 LPA, that's too high. I wouldn't ask for that.",
        aiText: "Understood — what were you thinking?",
      },
      {
        candidate: "Honestly I'd like to hear your range before sharing a number.",
        aiText: "Fair.",
      },
      { candidate: "Notice 60 days.", aiText: "OK." },
    ],
    undisclosed: [
      "target-ctc",
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 31: joining-date as prose ---------------- */
  {
    id: "joining-date-as-prose",
    label: "Candidate gives joining date in natural prose ('next month', 'by March')",
    goal:
      "Joining-date in real transcripts is rarely ISO — it's 'next month', 'after Holi', 'by March 15th'. Whether the parser binds it OR cleanly leaves it null both pass no-fabricated-facts; the failure mode is FABRICATING a date that wasn't said. Listed as undisclosed to gate the fabrication path.",
    init: {
      sessionId: "eval-joining-date-as-prose",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Current 20 LPA, target 28 LPA.", aiText: "Got it." },
      {
        candidate: "Earliest I could join would be sometime in March, after notice ends.",
        aiText: "Noted.",
      },
      { candidate: "Notice is 60 days.", aiText: "OK." },
      { candidate: "No competing offers.", aiText: "Understood." },
    ],
    undisclosed: [
      "joining-date",
      "competing-offer",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 32: recruiter echo / parroting ---------------- */
  {
    id: "recruiter-question-echoed",
    label: "Candidate echoes the recruiter's question back instead of answering",
    goal:
      "Test the planner doesn't treat its own question, parroted back by the candidate, as a candidate disclosure. If '\"What's your current CTC?\" — that's a good question' got parsed as currentCtc=null-but-numbered, we'd silently fabricate. Probe-once-per-topic catches the downstream loop if it happens.",
    init: {
      sessionId: "eval-recruiter-question-echoed",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      {
        candidate: "\"What's your current CTC?\" — interesting question, let me think.",
        aiText: "Take your time.",
      },
      { candidate: "OK, current is 21 LPA.", aiText: "Got it." },
      { candidate: "Target 28 LPA.", aiText: "Noted." },
      { candidate: "Notice 45 days.", aiText: "OK." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ============================================================ *
   * EVAL-6: the mean layer.                                      *
   *                                                              *
   * EVAL-5 stressed the parser; this stresses the kernel's       *
   * trajectory and unit handling. Number-word edges (crore,      *
   * lakh-as-rupees, percentage-variable), multi-fact contradic-  *
   * tion in a single utterance, a 15-turn long-horizon, an       *
   * implicit competing offer (existence without number), and     *
   * range-stated CURRENT CTC (we covered range target in EVAL-4, *
   * not current). One scenario per failure-mode class.           *
   * ============================================================ */

  /* ---------------- Scenario 33: salary in crore ---------------- */
  {
    id: "salary-stated-in-crore",
    label: "Senior candidate states comp in crore, not LPA",
    goal:
      "Indian-tech recruiter context: senior IC candidates routinely state comp as '1 crore' or '1.2 cr', not 100 LPA. The salary-span finder must recognize crore/cr as a unit and convert to LPA correctly (1 cr = 100 LPA). If the parser misses, current-ctc stays null and the planner re-probes a fact the candidate already disclosed.",
    init: {
      sessionId: "eval-salary-stated-in-crore",
      role: "Staff Software Engineer",
      company: "JP Morgan",
      band: HIGH_BAND,
    },
    turns: [
      { candidate: "Currently at 60 lakh fixed.", aiText: "Got it." },
      { candidate: "Target is 1.2 crore total package.", aiText: "Noted." },
      { candidate: "Notice 90 days.", aiText: "OK." },
      { candidate: "No competing offer.", aiText: "Understood." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-variable",
      "component-equity",
    ],
    expectedDisclosures: {
      "current-ctc": 60,    // 60 lakh = 60 LPA
      "target-ctc": 120,    // 1.2 crore = 120 LPA
    },
  },

  /* ---------------- Scenario 34: contradiction within one utterance ---------------- */
  {
    id: "intra-utterance-contradiction",
    label: "Candidate self-contradicts within ONE utterance",
    goal:
      "Edge of first-wins: 'Current is 18 — actually 22 LPA' as one breath. The parser sees two spans; the FIRST should bind (audit + read both first-wins). Listed as undisclosed for the second value's drift — no-fabricated-facts gates the ledger landing 22 as current-ctc by mistake.",
    init: {
      sessionId: "eval-intra-utterance-contradiction",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      {
        candidate: "Current is 18 LPA — actually 22 LPA with the variable, sorry.",
        aiText: "Captured the headline.",
      },
      { candidate: "Target 28 LPA.", aiText: "Got it." },
      { candidate: "Notice 60 days.", aiText: "OK." },
      { candidate: "No competing offer.", aiText: "Understood." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
    expectedDisclosures: {
      "current-ctc": 18,    // first-wins: keep the original, not the in-breath correction to 22
      "target-ctc": 28,
    },
  },

  /* ---------------- Scenario 35: 15-turn long horizon ---------------- */
  {
    id: "long-horizon-trajectory",
    label: "15-turn session — frustration recovery + re-anchor + close",
    goal:
      "Long sessions stress every guardrail simultaneously: probe-once-per-topic, no-coercion (no pressure-repeat on a stretched conversation), first-wins (no late overwrite by drift). If any criterion silently breaks past turn 10, this surfaces it.",
    init: {
      sessionId: "eval-long-horizon-trajectory",
      role: "Senior Software Engineer",
      company: "JP Morgan",
      band: HIGH_BAND,
    },
    turns: [
      { candidate: "Currently at Razorpay.", aiText: "Got it." },
      { candidate: "Total CTC is 28 LPA — 24 fixed, 4 variable.", aiText: "Noted." },
      { candidate: "Target is 38 LPA for this move.", aiText: "OK." },
      { candidate: "Notice is 60 days.", aiText: "Got it." },
      { candidate: "No competing offers right now.", aiText: "Understood." },
      { candidate: "Honestly the interview process felt rushed.", aiText: "Sorry to hear that — let me address that." },
      { candidate: "I'm not sure this team is the right fit.", aiText: "What concern is strongest?" },
      { candidate: "Mainly the on-call rotation — I'd want clarity there.", aiText: "1 week per 6 weeks, with comp." },
      { candidate: "OK that's reasonable. Walk me through the package.", aiText: "Let me share the structure." },
      { candidate: "What's the equity component?", aiText: "RSUs vest over 4 years, 25% per year." },
      { candidate: "And growth into staff?", aiText: "Typically 24 months at strong perf." },
      { candidate: "Alright — what's your number on fixed?", aiText: "Working that for you." },
      { candidate: "I need at least 34 fixed to make this work.", aiText: "Captured." },
      { candidate: "If you can land 34 fixed + the rest, I'm in.", aiText: "Let me confirm with comp." },
      { candidate: "Sounds good — I'll wait for the formal.", aiText: "Sending today." },
    ],
    undisclosed: ["joining-date"],
    expectedDisclosures: {
      "current-ctc": 28,
      "target-ctc": 38,
      "component-base": 24,
      "component-variable": 4,
    },
  },

  /* ---------------- Scenario 36: implicit competing offer ---------------- */
  {
    id: "implicit-competing-offer-no-number",
    label: "Candidate confirms a competing offer exists but won't share the number",
    goal:
      "Existence-without-amount is a real recruiter situation. The kernel should NOT fabricate a competing-offer number (no-fabricated-facts), AND should NOT keep re-probing the amount past the polite refusal (probe-once-per-topic). Listed undisclosed: competing-offer stays null.",
    init: {
      sessionId: "eval-implicit-competing-offer-no-number",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Currently 22 LPA at Swiggy.", aiText: "Got it." },
      { candidate: "Target 30 LPA.", aiText: "Noted." },
      {
        candidate: "I do have a competing offer but I'd rather not share the number at this stage.",
        aiText: "Understood — won't push.",
      },
      { candidate: "Notice 45 days.", aiText: "OK." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-base",
      "component-variable",
      "component-equity",
    ],
  },

  /* ---------------- Scenario 37: range-stated current CTC ---------------- */
  {
    id: "current-ctc-stated-as-range",
    label: "Candidate states current as a range '18-22 LPA' (variable swing)",
    goal:
      "EVAL-4 covered target-as-range; this covers CURRENT-as-range. Candidate's variable-component swing makes total CTC a range. Parser should bind ONE value cleanly (upper or lower convention) without re-probing or fabricating. Probe-once + no-fabricated-facts gate this.",
    init: {
      sessionId: "eval-current-ctc-stated-as-range",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      {
        candidate: "Current CTC ranges 18 to 22 LPA depending on variable hit.",
        aiText: "Captured.",
      },
      { candidate: "Target 28 LPA flat.", aiText: "Got it." },
      { candidate: "Notice 60 days.", aiText: "OK." },
      { candidate: "No competing offer.", aiText: "Understood." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-equity",
    ],
    expectedDisclosures: {
      // Current stated as a range 18-22 LPA; binding 22 (upper-of-range)
      // is the architectural choice the parser already makes elsewhere
      // for target ranges (EVAL-4 scenario 24). This pins it for current
      // too — if the convention changes, the scorecard surfaces it.
      "current-ctc": 22,
      "target-ctc": 28,
    },
  },

  /* ---------------- Scenario 38: variable as percentage ---------------- */
  {
    id: "variable-as-percentage",
    label: "Candidate states variable as % of base, not LPA",
    goal:
      "'20 LPA base plus 20% variable' is a common Indian-tech disclosure shape. component-base should bind to 20; component-variable should EITHER bind to a derived number (4 LPA) OR stay null cleanly — both pass. The fabrication failure mode would be binding 20 as variable (the percentage value) or polluting current-ctc with the percentage.",
    init: {
      sessionId: "eval-variable-as-percentage",
      role: "Software Engineer",
      company: "JP Morgan",
      band: DEFAULT_BAND,
    },
    turns: [
      { candidate: "Base is 20 LPA, variable is 20% on top.", aiText: "Noted base + structure." },
      { candidate: "Target 28 LPA total package.", aiText: "Got it." },
      { candidate: "Notice 45 days.", aiText: "OK." },
      { candidate: "No competing offer.", aiText: "Understood." },
    ],
    undisclosed: [
      "competing-offer",
      "joining-date",
      "component-equity",
    ],
    expectedDisclosures: {
      "component-base": 20,
      "target-ctc": 28,
    },
  },
] as const;

/** Map id → scenario for quick lookup in CI runs. */
export const SCENARIO_BY_ID: Readonly<Record<string, EvalScenario>> =
  Object.freeze(
    Object.fromEntries(EVAL_SCENARIOS.map((s) => [s.id, s])),
  );
