/* Phase-4 (4.1) — deterministic salary-negotiation fixture suite.
 *
 * Mirrors the campus-placement fixture shape exactly. Each transcript
 * is hand-crafted to either trip a specific named ai_*-flag or to
 * exercise a coaching cluster / recruiter sector persona, so the
 * matching driver in `salaryNegotiationFixtures.test.ts` can assert
 * containment end-to-end at >=0.85 precision/recall per flag.
 *
 * Coverage shape (see SCORE_IMPROVEMENT_PLAN.md §2 Phase 4.1):
 *   1. Each ai_* self-consistency flag the analyzer detects.
 *   2. One transcript per recruiter sector persona (5 Phase-3 personas).
 *   3. One transcript per coaching cluster (discovery / anchoring /
 *      counter / close / batna).
 *   4. Negative cases for high-false-positive detectors (equity literacy
 *      on bare "stocks", etc).
 *
 * Conventions match `campusPlacementTranscripts.ts`:
 *   - Each transcript is a `TranscriptTurn[]` consumed directly by
 *     `SessionRowForAnalysis.transcript`.
 *   - Fixtures expose the flag IDs we expect the analyzer to emit
 *     (positive) and the flag IDs it MUST NOT emit (negative).
 *   - Assertions use `toContain` (not equality) so adding NEW flags
 *     doesn't break the regression net.
 */

import type { TranscriptTurn } from "../../../server-handlers/analyzers/_types";

export interface SalaryNegotiationFixture {
  id: string;
  description: string;
  targetCompany: string;
  targetRole: string;
  difficulty: string;
  /** Recruiter sector persona the analyzer should resolve from the
   *  tier-bucket. Stable string set: "it-services" | "gcc" |
   *  "indian-unicorn" | "early-startup" | "bfsi" | "default". */
  expectedPersona:
    | "it-services"
    | "gcc"
    | "indian-unicorn"
    | "early-startup"
    | "bfsi"
    | "default";
  /** Flags the analyzer MUST emit on this fixture (positive). */
  mustHaveFlags: string[];
  /** Flags the analyzer MUST NOT emit on this fixture (negative). */
  mustNotHaveFlags?: string[];
  transcript: TranscriptTurn[];
}

/* ─────────────────────────────────────────────────────────────────
 *  Block A — ai_* self-consistency flags (one fixture per flag).
 *  Each transcript is the minimum surface area to trip exactly one
 *  hallucination-class signal cleanly.
 * ───────────────────────────────────────────────────────────────── */

/* ai_phrase_repetition — AI repeats the same 8+-word phrase 2+ times
 * inside ONE turn (long-repeat threshold). Long verbatim repetition
 * within a single AI turn is an LLM stutter, not a real recruiter. */
const aiPhraseRepetition: SalaryNegotiationFixture = {
  id: "ai-phrase-repetition",
  description: "AI repeats an 8-word phrase verbatim twice in a single turn",
  targetCompany: "Razorpay",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "indian-unicorn",
  mustHaveFlags: ["ai_phrase_repetition"],
  transcript: [
    { speaker: "user", text: "My expectation is ₹42 LPA total based on my research and current ₹32 LPA. I'm targeting that range with my competing offer.", time: "00:00" },
    { speaker: "ai", text: "I understand your expectation. That is the absolute top of what I can approve for this level, that is the absolute top of what I can approve for this level. We can discuss further if needed.", time: "00:30" },
    { speaker: "user", text: "Can we revisit the joining bonus or equity then? My notice period is 90 days.", time: "01:00" },
    { speaker: "ai", text: "We can offer ₹38 LPA total. Equity vesting cliff is 1 year.", time: "01:30" },
  ],
};

/* ai_consecutive_duplicate_question — two adjacent AI turns are >=85%
 * word-identical. The Spinny case. */
const aiConsecutiveDuplicate: SalaryNegotiationFixture = {
  id: "ai-consecutive-duplicate-question",
  description: "AI asks the same long question twice in adjacent turns",
  targetCompany: "Infosys",
  targetRole: "Software Engineer",
  difficulty: "mid",
  expectedPersona: "it-services",
  mustHaveFlags: ["ai_consecutive_duplicate_question"],
  transcript: [
    { speaker: "ai", text: "Welcome. Tell me about your current package and what you would consider a fair number for this role here at Infosys.", time: "00:00" },
    { speaker: "user", text: "My current CTC is ₹12 LPA fixed. I'm looking for ₹18 LPA based on my research. I have a competing offer at ₹17 LPA. Equity and joining bonus also negotiable. Notice period is 60 days.", time: "00:15" },
    { speaker: "ai", text: "Thanks. What is most important to you in this offer — is it the base, the variable, the joining bonus, or something else entirely you would prioritise here?", time: "01:00" },
    { speaker: "ai", text: "What is most important to you in this offer — is it the base, the variable, the joining bonus, or something else entirely you would prioritise here?", time: "01:30" },
    { speaker: "user", text: "I already answered — base is the priority. Can we move forward?", time: "02:00" },
    { speaker: "ai", text: "Right. We can offer ₹15 LPA fixed plus ₹1 LPA variable.", time: "02:30" },
  ],
};

/* ai_didnt_answer_direct_question — user explicitly asks "what are you
 * offering?" and AI pivots to another question instead of giving a
 * number or acknowledging. */
const aiDidntAnswerDirect: SalaryNegotiationFixture = {
  id: "ai-didnt-answer-direct-question",
  description: "User asks 'what's your offer?' — AI pivots without a number",
  targetCompany: "Accenture",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "it-services",
  mustHaveFlags: ["ai_didnt_answer_direct_question"],
  transcript: [
    { speaker: "ai", text: "Welcome. Let's start — tell me about your current CTC and what you're targeting.", time: "00:00" },
    { speaker: "user", text: "Current ₹20 LPA. My expectation is ₹28 LPA based on my research. I have a competing offer at ₹26 LPA. Notice period 90 days. Equity / joining bonus also up for discussion.", time: "00:15" },
    { speaker: "user", text: "Can you give me the initial offer? What are you offering for this role?", time: "01:00" },
    { speaker: "ai", text: "Before we get to numbers — what would you consider your single most important constraint in this conversation?", time: "01:30" },
    { speaker: "user", text: "I already said — base is the priority. Please share the number.", time: "02:00" },
    { speaker: "ai", text: "Let's first understand your priorities better. Where do you see yourself in two years?", time: "02:30" },
  ],
};

/* ai_no_counter_offered — AI never quotes any ₹ number across 4+ AI
 * turns. The Accenture session — opener was vague, follow-ups never
 * produced numbers either. */
const aiNoCounterOffered: SalaryNegotiationFixture = {
  id: "ai-no-counter-offered",
  description: "AI never quotes a single ₹ amount across 4+ AI turns",
  targetCompany: "Accenture",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "it-services",
  mustHaveFlags: ["ai_no_counter_offered"],
  transcript: [
    { speaker: "ai", text: "Welcome. Let me start with your background and what you're looking for here.", time: "00:00" },
    { speaker: "user", text: "Current ₹18 LPA. My expectation is ₹24 LPA based on my research. I'm targeting that range. I have a competing offer elsewhere. Equity, joining bonus, notice period all negotiable.", time: "00:30" },
    { speaker: "ai", text: "Thanks. We've put together a competitive offer based on internal benchmarks for this level.", time: "01:00" },
    { speaker: "user", text: "Can you tell me the actual number?", time: "01:30" },
    { speaker: "ai", text: "The team is excited about your background. Our package is aligned with industry standards.", time: "02:00" },
    { speaker: "user", text: "I'd like to know the number before discussing further.", time: "02:30" },
    { speaker: "ai", text: "We pride ourselves on a strong total rewards philosophy. Let's continue the conversation.", time: "03:00" },
  ],
};

/* ai_reversed_range — AI quotes "₹12 to ₹8.5 LPA". Yellow Slice. */
const aiReversedRange: SalaryNegotiationFixture = {
  id: "ai-reversed-range",
  description: "AI quotes a reversed numeric range (high → low)",
  targetCompany: "Yellow Slice",
  targetRole: "Senior UX Designer",
  difficulty: "senior",
  expectedPersona: "it-services",
  mustHaveFlags: ["ai_reversed_range"],
  transcript: [
    { speaker: "ai", text: "Hi. Our band for this level is ₹12 to ₹8.5 LPA all-inclusive. What are you targeting?", time: "00:00" },
    { speaker: "user", text: "My expectation is ₹14 LPA based on my research. Current ₹11 LPA fixed plus equity. Competing offer at ₹13 LPA. Notice period 60 days.", time: "00:30" },
    { speaker: "ai", text: "Understood. We can stretch to ₹13 LPA total. Joining bonus of ₹1 LPA.", time: "01:00" },
  ],
};

/* ai_ignored_user_complaint — user expresses confusion; AI's next turn
 * neither acknowledges nor recaps numbers. */
const aiIgnoredUserComplaint: SalaryNegotiationFixture = {
  id: "ai-ignored-user-complaint",
  description: "User says 'I'm confused' — AI continues without acknowledging or recapping",
  targetCompany: "Wipro",
  targetRole: "Software Engineer",
  difficulty: "mid",
  expectedPersona: "it-services",
  mustHaveFlags: ["ai_ignored_user_complaint"],
  transcript: [
    { speaker: "ai", text: "Welcome. We can offer ₹14 LPA total including variable for this role.", time: "00:00" },
    { speaker: "user", text: "What's the fixed component? Current ₹12 LPA. My expectation is ₹16 LPA based on my research. Competing offer ₹15 LPA. Equity / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "The total package is ₹14 LPA. Variable component is performance-linked at 10%. Let's discuss your strengths next.", time: "01:00" },
    { speaker: "user", text: "I'm confused — what is the fixed number exactly? You're confusing me with totals.", time: "01:30" },
    { speaker: "ai", text: "Tell me about your most challenging project so I can position you for the panel.", time: "02:00" },
  ],
};

/* ai_self_contradiction — AI says "can't meet ₹X" then offers ₹X in
 * the same turn. The Thence case. */
const aiSelfContradiction: SalaryNegotiationFixture = {
  id: "ai-self-contradiction",
  description: "AI says it cannot meet ₹18 LPA then offers ₹18 LPA in the same turn",
  targetCompany: "Thence",
  targetRole: "Senior UX Designer",
  difficulty: "senior",
  expectedPersona: "it-services",
  mustHaveFlags: ["ai_self_contradiction"],
  transcript: [
    { speaker: "ai", text: "Hi. We can open at ₹14 LPA total CTC for this role.", time: "00:00" },
    { speaker: "user", text: "My expectation is ₹18 LPA based on my research. Current ₹15 LPA. I have a competing offer elsewhere. Notice period 60 days. Equity / joining bonus also negotiable.", time: "00:30" },
    { speaker: "ai", text: "I can't quite meet ₹18 LPA directly. However, I can offer a revised total CTC of ₹18 LPA including variable.", time: "01:00" },
  ],
};

/* ai_misread_conditional_as_acceptance — user says "if you can do X,
 * I'd accept" → AI replies with celebration ("welcome to the team"). */
const aiMisreadConditional: SalaryNegotiationFixture = {
  id: "ai-misread-conditional-as-acceptance",
  description: "User uses conditional language — AI celebrates as definite yes",
  targetCompany: "Flipkart",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "indian-unicorn",
  mustHaveFlags: ["ai_misread_conditional_as_acceptance"],
  transcript: [
    { speaker: "ai", text: "We can offer ₹38 LPA total — ₹26 LPA base, ₹4 LPA variable, ₹8 LPA equity. Vesting 4-yr with 1-yr cliff.", time: "00:00" },
    { speaker: "user", text: "My expectation is ₹42 LPA based on my research. Current ₹34 LPA. I have a competing offer at ₹40 LPA. Notice 90 days. If you can move base to ₹30 LPA, I would accept.", time: "00:30" },
    { speaker: "ai", text: "Excited to have you on board. Welcome aboard — HR will share the formal offer.", time: "01:00" },
  ],
};

/* ai_accepted_without_pushback — AI accepts user's first number with
 * no pushback language at all. */
const aiAcceptedWithoutPushback: SalaryNegotiationFixture = {
  id: "ai-accepted-without-pushback",
  description: "AI accepts user's first asked number without any pushback",
  targetCompany: "Cognizant",
  targetRole: "Software Engineer",
  difficulty: "mid",
  expectedPersona: "it-services",
  mustHaveFlags: ["ai_accepted_without_pushback"],
  transcript: [
    { speaker: "user", text: "Current ₹10 LPA. My expectation is ₹14 LPA based on my research. I have a competing offer at ₹13 LPA. Notice 60 days. Equity / joining bonus also negotiable.", time: "00:00" },
    { speaker: "ai", text: "Deal. ₹14 LPA works. That sounds fair. We accept your number.", time: "00:30" },
    { speaker: "user", text: "Great, thank you. Could you confirm joining bonus terms?", time: "01:00" },
    { speaker: "ai", text: "Joining bonus of ₹1 LPA with a 1-year clawback. Final offer is ₹14 LPA total.", time: "01:30" },
  ],
};

/* ai_silent_capitulation — AI matches user's ask without saying it was
 * above market anywhere. */
const aiSilentCapitulation: SalaryNegotiationFixture = {
  id: "ai-silent-capitulation",
  description: "AI matches user's ask but never says it was above band",
  targetCompany: "Zerodha",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "indian-unicorn",
  mustHaveFlags: ["ai_silent_capitulation"],
  transcript: [
    { speaker: "ai", text: "Hi. We're considering you for the senior role. What are you targeting?", time: "00:00" },
    { speaker: "user", text: "My expectation is ₹50 LPA based on my research. Current ₹40 LPA. Competing offer at ₹48 LPA. Notice 90 days. Equity / joining bonus also negotiable.", time: "00:30" },
    { speaker: "ai", text: "Noted. We're open to working with that range.", time: "01:00" },
    { speaker: "user", text: "Is there room to revisit base?", time: "01:30" },
    { speaker: "ai", text: "Joining bonus ₹2 LPA, 1-year clawback. ESOP vesting 4-yr / 1-yr cliff. We can come up to ₹50 LPA total.", time: "02:00" },
  ],
};

/* ai_arithmetic_error — AI claims monthly take-home that's wildly off
 * the ~3.5-5.5k/LPA expectation. ₹25 LPA → ~₹125k-275k monthly band;
 * AI claims 60k. */
const aiArithmeticError: SalaryNegotiationFixture = {
  id: "ai-arithmetic-error",
  description: "AI's monthly take-home math is implausible for stated CTC",
  targetCompany: "Tata Consultancy Services",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "it-services",
  mustHaveFlags: ["ai_arithmetic_error"],
  transcript: [
    { speaker: "user", text: "Current ₹20 LPA. My expectation is ₹25 LPA based on my research. Competing offer at ₹24 LPA. Notice 90 days. Equity / joining / notice all on the table.", time: "00:00" },
    { speaker: "ai", text: "We can offer ₹25 LPA total. That comes to roughly ₹30k per month take-home after tax.", time: "00:30" },
    { speaker: "user", text: "That seems low for that CTC. Can we revisit the math?", time: "01:00" },
    { speaker: "ai", text: "The in-hand reflects EPF, professional tax, and standard deductions. Final offer is ₹25 LPA total.", time: "01:30" },
  ],
};

/* ai_offer_regression — AI quotes ₹30 LPA then walks back to ₹26 LPA
 * without revision language. */
const aiOfferRegression: SalaryNegotiationFixture = {
  id: "ai-offer-regression",
  description: "AI quotes ₹30 LPA then silently regresses to ₹26 LPA",
  targetCompany: "Swiggy",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "indian-unicorn",
  mustHaveFlags: ["ai_offer_regression"],
  transcript: [
    { speaker: "ai", text: "Hi. We can open at ₹30 LPA total for the senior level here.", time: "00:00" },
    { speaker: "user", text: "Current ₹26 LPA. My expectation is ₹32 LPA based on my research. Competing offer at ₹31 LPA. Notice 90 days. Equity / joining / notice all in play.", time: "00:30" },
    { speaker: "ai", text: "After checking with the panel, our final offer is ₹26 LPA total. Joining bonus of ₹2 LPA, ESOP vesting 4-yr cliff 1-yr.", time: "01:00" },
  ],
};

/* ai_usism_drift — AI uses US-isms ("PTO", "401(k)", "sign-on package"). */
const aiUsismDrift: SalaryNegotiationFixture = {
  id: "ai-usism-drift",
  description: "AI uses US-only vocabulary (PTO, sign-on package)",
  targetCompany: "Microsoft India",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "gcc",
  mustHaveFlags: ["ai_usism_drift"],
  transcript: [
    { speaker: "ai", text: "Welcome. We can offer ₹52 LPA total CTC including a generous sign-on package and unlimited PTO.", time: "00:00" },
    { speaker: "user", text: "Current ₹42 LPA. My expectation is ₹56 LPA based on my research. Competing offer at ₹54 LPA. Notice 90 days. Equity / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "We can stretch to ₹55 LPA total with RSU refresh annually. Joining bonus ₹4 LPA, 1-year clawback.", time: "01:00" },
  ],
};

/* ai_unrealistic_close_above_predicted — AI closes far above the
 * predicted landing zone for the tier. Early-startup tier with
 * conservative initial offer; AI closes way above zone. */
const aiUnrealisticCloseAbove: SalaryNegotiationFixture = {
  id: "ai-unrealistic-close-above-predicted",
  description: "Early-stage startup recruiter closes way above predicted landing zone",
  targetCompany: "ZippyDeliver",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "default",
  mustHaveFlags: ["ai_unrealistic_close_above_predicted"],
  transcript: [
    { speaker: "ai", text: "Hi. We can open at ₹18 LPA total for this senior role.", time: "00:00" },
    { speaker: "user", text: "Current ₹20 LPA. My expectation is ₹25 LPA based on my research. Competing offer at ₹24 LPA. Notice 90 days. Equity / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "After internal discussion, joining bonus ₹3 LPA, ESOP vesting 4-yr / 1-yr cliff. I can stretch to ₹40 LPA total.", time: "01:00" },
  ],
};

/* ai_under_close_below_predicted — AI closes below the predicted
 * landing zone. */
const aiUnderCloseBelow: SalaryNegotiationFixture = {
  id: "ai-under-close-below-predicted",
  description: "AI closes well below the predicted landing zone for the tier",
  targetCompany: "Google India",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "gcc",
  mustHaveFlags: ["ai_under_close_below_predicted"],
  transcript: [
    { speaker: "ai", text: "Hi. We can open at ₹60 LPA total for this senior level here.", time: "00:00" },
    { speaker: "user", text: "Current ₹50 LPA. My expectation is ₹70 LPA based on my research. Competing offer at ₹66 LPA. Notice 90 days. Equity / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "After review, our final number is ₹42 LPA total. Joining bonus ₹3 LPA, RSU vesting 4-yr / 1-yr cliff.", time: "01:00" },
  ],
};

/* ─────────────────────────────────────────────────────────────────
 *  Block B — coaching cluster exemplars (one transcript per cluster).
 *  These trip MULTIPLE members of the same cluster so the analyzer
 *  emits the "Pattern, not isolated" coaching narrative.
 * ───────────────────────────────────────────────────────────────── */

/* discovery cluster — equity/joining-bonus/notice all skipped. */
const clusterDiscoveryMisses: SalaryNegotiationFixture = {
  id: "cluster-discovery-misses",
  description: "User never probes any of equity / joining bonus / notice — full discovery skip",
  targetCompany: "Mindtree",
  targetRole: "Software Engineer",
  difficulty: "mid",
  expectedPersona: "it-services",
  mustHaveFlags: [
    "equity_never_discussed",
    "joining_bonus_never_discussed",
    "notice_period_never_discussed",
  ],
  transcript: [
    { speaker: "ai", text: "Welcome. We can offer ₹13 LPA total for this role.", time: "00:00" },
    { speaker: "user", text: "My expectation is ₹16 LPA based on my research. Current ₹12 LPA. Can you stretch?", time: "00:30" },
    { speaker: "ai", text: "We can come up to ₹15 LPA total — that's the upper end of our range.", time: "01:00" },
    { speaker: "user", text: "I'll think about it overnight. Thanks.", time: "01:30" },
  ],
};

/* anchoring cluster — user never anchored + no BATNA articulated. */
const clusterAnchoringMisses: SalaryNegotiationFixture = {
  id: "cluster-anchoring-misses",
  description: "User opens with no anchor and never articulates a BATNA",
  targetCompany: "HCL Technologies",
  targetRole: "Software Engineer",
  difficulty: "mid",
  expectedPersona: "it-services",
  mustHaveFlags: ["user_never_anchored", "no_batna_articulated"],
  transcript: [
    { speaker: "ai", text: "Welcome. We can offer ₹13 LPA total for this level.", time: "00:00" },
    { speaker: "user", text: "OK. Whatever the team thinks is fair works for me. I just want a reasonable jump from my current package. Joining bonus, equity, notice period all flexible on my side.", time: "00:30" },
    { speaker: "ai", text: "Appreciate the openness. We'll keep it at ₹13 LPA total then. Joining bonus ₹1 LPA, 1-year clawback.", time: "01:00" },
    { speaker: "user", text: "Sounds good. Thanks for the offer.", time: "01:30" },
  ],
};

/* counter cluster — AI accepted without pushback AND silently
 * capitulated (matches the user ask without ever calling it above-band). */
const clusterCounterMisses: SalaryNegotiationFixture = {
  id: "cluster-counter-misses",
  description: "AI accepts without pushback AND silently capitulates",
  targetCompany: "Zerodha",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "indian-unicorn",
  mustHaveFlags: ["ai_accepted_without_pushback", "ai_silent_capitulation"],
  transcript: [
    { speaker: "user", text: "Current ₹40 LPA. My expectation is ₹52 LPA based on my research. Competing offer at ₹50 LPA. Notice 90 days. Equity / joining bonus all on the table.", time: "00:00" },
    { speaker: "ai", text: "Deal. ₹52 LPA works for us. We accept your number — sounds fair.", time: "00:30" },
    { speaker: "user", text: "Great. Joining bonus and ESOP terms?", time: "01:00" },
    { speaker: "ai", text: "Joining bonus ₹3 LPA with 1-year clawback. ESOP vesting 4-yr / 1-yr cliff. Final offer ₹52 LPA total.", time: "01:30" },
  ],
};

/* close cluster — AI ignored complaint AND misread conditional. */
const clusterCloseMisses: SalaryNegotiationFixture = {
  id: "cluster-close-misses",
  description: "AI ignores user confusion AND misreads conditional as acceptance",
  targetCompany: "Paytm",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "indian-unicorn",
  mustHaveFlags: [
    "ai_ignored_user_complaint",
    "ai_misread_conditional_as_acceptance",
  ],
  transcript: [
    { speaker: "ai", text: "We can offer ₹32 LPA total — ₹22 LPA base, ₹4 LPA variable, ₹6 LPA ESOP.", time: "00:00" },
    { speaker: "user", text: "My expectation is ₹38 LPA based on my research. Current ₹30 LPA. Competing offer at ₹36 LPA. Notice 90 days.", time: "00:30" },
    { speaker: "user", text: "Wait what, I'm confused about the base versus total. Can you clarify the breakdown?", time: "01:00" },
    { speaker: "ai", text: "Let me ask — what are your three most important criteria for joining a company?", time: "01:30" },
    { speaker: "user", text: "If you can move base to ₹26 LPA, I would accept the package.", time: "02:00" },
    { speaker: "ai", text: "Welcome aboard! So glad you're on board — HR will share the formal offer letter.", time: "02:30" },
  ],
};

/* batna cluster — BATNA is articulated but weak (verbal hedge, no LPA,
 * no named peer-tier company). */
const clusterBatnaWeak: SalaryNegotiationFixture = {
  id: "cluster-batna-weak",
  description: "BATNA is articulated but unsupported — verbal-only, no LPA / no peer",
  targetCompany: "PhonePe",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "indian-unicorn",
  mustHaveFlags: ["batna_weak_unsupported"],
  transcript: [
    { speaker: "ai", text: "Hi. What are you targeting for this role?", time: "00:00" },
    { speaker: "user", text: "My expectation is ₹40 LPA based on my research. Current ₹32 LPA. I have another offer elsewhere from a few months back, details not firm. Notice 90 days. Equity / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "Understood. We can stretch to ₹38 LPA total. Joining bonus ₹2 LPA, ESOP vesting 4-yr / 1-yr cliff.", time: "01:00" },
    { speaker: "user", text: "Can you push to ₹40? My other offer is in the same range.", time: "01:30" },
    { speaker: "ai", text: "Our final number is ₹38 LPA total — that's the top of the band for this level.", time: "02:00" },
  ],
};

/* ─────────────────────────────────────────────────────────────────
 *  Block C — recruiter sector persona coverage.
 *  One clean transcript per persona where the analyzer should
 *  resolve to that persona id via the tierBucket mapping.
 * ───────────────────────────────────────────────────────────────── */

const personaItServices: SalaryNegotiationFixture = {
  id: "persona-it-services",
  description: "Persona: IT services recruiter (TCS / Infosys / Wipro / HCL / Mindtree)",
  targetCompany: "Wipro",
  targetRole: "Software Engineer",
  difficulty: "mid",
  expectedPersona: "it-services",
  mustHaveFlags: [],
  transcript: [
    { speaker: "ai", text: "Welcome. We can open at ₹12 LPA total for this role.", time: "00:00" },
    { speaker: "user", text: "Current ₹10 LPA. My expectation is ₹14 LPA based on my research. Competing offer at ₹13 LPA. Notice 60 days. Equity / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "We can stretch to ₹13 LPA total — joining bonus ₹0.5 LPA, 1-year clawback.", time: "01:00" },
  ],
};

const personaGcc: SalaryNegotiationFixture = {
  id: "persona-gcc",
  description: "Persona: GCC / FAANG-India recruiter (big-tech bucket)",
  targetCompany: "Amazon India",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "gcc",
  mustHaveFlags: [],
  transcript: [
    { speaker: "ai", text: "Welcome. We can open at ₹55 LPA total for this senior level.", time: "00:00" },
    { speaker: "user", text: "Current ₹46 LPA. My expectation is ₹62 LPA based on my research. Competing offer at ₹60 LPA. Notice 90 days. RSU / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "We can stretch to ₹60 LPA total — RSU grant ₹40 LPA over 4 years, joining bonus ₹4 LPA with 1-year clawback.", time: "01:00" },
  ],
};

const personaIndianUnicorn: SalaryNegotiationFixture = {
  id: "persona-indian-unicorn",
  description: "Persona: Indian unicorn recruiter (Razorpay / Flipkart / Swiggy / Zomato)",
  targetCompany: "Razorpay",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "indian-unicorn",
  mustHaveFlags: [],
  transcript: [
    { speaker: "ai", text: "Welcome. We can open at ₹35 LPA total for this senior level.", time: "00:00" },
    { speaker: "user", text: "Current ₹30 LPA. My expectation is ₹42 LPA based on my research. Competing offer at ₹40 LPA. Notice 90 days. ESOP / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "We can come up to ₹40 LPA total — ESOP grant ₹15 LPA over 4-yr cliff 1-yr, joining bonus ₹3 LPA with 1-year clawback.", time: "01:00" },
  ],
};

const personaEarlyStartup: SalaryNegotiationFixture = {
  id: "persona-early-startup",
  description: "Persona: Early-stage startup recruiter (growth-startup tier maps to early-startup persona)",
  targetCompany: "Ninjacart",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "early-startup",
  mustHaveFlags: [],
  transcript: [
    { speaker: "ai", text: "Hi. We can open at ₹22 LPA total — ₹18 LPA cash + ₹4 LPA ESOP.", time: "00:00" },
    { speaker: "user", text: "Current ₹24 LPA. My expectation is ₹28 LPA based on my research. Competing offer at ₹26 LPA. Notice 60 days. ESOP / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "We can stretch to ₹26 LPA total — ₹20 LPA cash + ₹6 LPA ESOP cliff 1-yr, joining bonus ₹1 LPA.", time: "01:00" },
  ],
};

const personaBfsi: SalaryNegotiationFixture = {
  id: "persona-bfsi",
  description: "Persona: BFSI recruiter (variable-heavy / banking)",
  targetCompany: "Goldman Sachs India",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "bfsi",
  mustHaveFlags: [],
  transcript: [
    { speaker: "ai", text: "Welcome. We can open at ₹45 LPA total — ₹30 LPA fixed + ₹15 LPA variable.", time: "00:00" },
    { speaker: "user", text: "Current ₹38 LPA. My expectation is ₹52 LPA based on my research. Competing offer at ₹50 LPA. Notice 90 days. Variable / joining / notice all on the table — and equity / RSU.", time: "00:30" },
    { speaker: "ai", text: "We can come up to ₹50 LPA total — ₹34 LPA fixed + ₹16 LPA variable, joining bonus ₹4 LPA with 1-year clawback.", time: "01:00" },
  ],
};

/* ─────────────────────────────────────────────────────────────────
 *  Block D — negative cases for high-false-positive detectors.
 *  Each transcript intentionally exercises the trigger SURFACE but
 *  should NOT fire the flag (e.g. "stocks" without RSU/ESOP, AI
 *  acknowledges confusion, AI uses revision language before walking
 *  back, etc).
 * ───────────────────────────────────────────────────────────────── */

/* Negative: equity literacy detector should NOT fire on bare "stocks"
 * without a face-value grant. equity_terms_not_probed should stay
 * silent when no concrete grant is on the table. */
const negEquityBareStocks: SalaryNegotiationFixture = {
  id: "neg-equity-bare-stocks",
  description: "User says 'stocks' generically — equity literacy detectors should NOT fire",
  targetCompany: "Tata Consultancy Services",
  targetRole: "Software Engineer",
  difficulty: "mid",
  expectedPersona: "it-services",
  mustHaveFlags: [],
  mustNotHaveFlags: ["equity_terms_not_probed"],
  transcript: [
    { speaker: "ai", text: "Welcome. We can offer ₹13 LPA total. No equity for this role — TCS doesn't offer stocks at this level.", time: "00:00" },
    { speaker: "user", text: "Understood, no stocks expected. My expectation is ₹15 LPA based on my research. Current ₹12 LPA. Competing offer at ₹14 LPA. Notice 60 days. Joining bonus also on the table.", time: "00:30" },
    { speaker: "ai", text: "We can stretch to ₹15 LPA total — joining bonus ₹1 LPA with 1-year clawback.", time: "01:00" },
  ],
};

/* Negative: AI acknowledged user confusion explicitly — should NOT
 * fire ai_ignored_user_complaint. */
const negComplaintAcknowledged: SalaryNegotiationFixture = {
  id: "neg-complaint-acknowledged",
  description: "AI acknowledges user confusion + recaps with numbers — ai_ignored_user_complaint must NOT fire",
  targetCompany: "Infosys",
  targetRole: "Software Engineer",
  difficulty: "mid",
  expectedPersona: "it-services",
  mustHaveFlags: [],
  mustNotHaveFlags: ["ai_ignored_user_complaint"],
  transcript: [
    { speaker: "ai", text: "Welcome. We can offer ₹14 LPA total CTC for this role.", time: "00:00" },
    { speaker: "user", text: "Current ₹12 LPA. My expectation is ₹16 LPA based on my research. Competing offer at ₹15 LPA. Notice 60 days. Equity / joining / notice all on the table.", time: "00:30" },
    { speaker: "user", text: "I'm confused — what's the fixed vs variable split?", time: "01:00" },
    { speaker: "ai", text: "I hear you — let me clarify. Fixed component is ₹12.6 LPA, variable is ₹1.4 LPA, total ₹14 LPA. Joining bonus ₹1 LPA, 1-year clawback.", time: "01:30" },
  ],
};

/* Negative: AI quotes ₹30 LPA → ₹26 LPA but with explicit revision
 * language. Should NOT fire ai_offer_regression. */
const negRegressionWithRevision: SalaryNegotiationFixture = {
  id: "neg-regression-with-revision",
  description: "AI walks back number with explicit 'I misspoke / let me revise' language",
  targetCompany: "Swiggy",
  targetRole: "Senior Software Engineer",
  difficulty: "senior",
  expectedPersona: "indian-unicorn",
  mustHaveFlags: [],
  mustNotHaveFlags: ["ai_offer_regression"],
  transcript: [
    { speaker: "ai", text: "Hi. We can open at ₹30 LPA total for the senior role.", time: "00:00" },
    { speaker: "user", text: "Current ₹25 LPA. My expectation is ₹32 LPA based on my research. Competing offer at ₹31 LPA. Notice 90 days. ESOP / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "I misspoke earlier — let me revise. The accurate opening for this level is ₹26 LPA total. Joining bonus ₹2 LPA, ESOP vesting 4-yr / 1-yr cliff.", time: "01:00" },
  ],
};

/* Negative: AI quotes a "range" that looks low-to-high but reversed
 * regex shouldn't fire on equal numbers or low → high. Sanity check. */
const negRangeLowToHigh: SalaryNegotiationFixture = {
  id: "neg-range-low-to-high",
  description: "AI quotes a proper low-to-high range — ai_reversed_range must NOT fire",
  targetCompany: "Yellow Slice",
  targetRole: "Senior UX Designer",
  difficulty: "senior",
  expectedPersona: "it-services",
  mustHaveFlags: [],
  mustNotHaveFlags: ["ai_reversed_range"],
  transcript: [
    { speaker: "ai", text: "Hi. Our band for this level is ₹8.5 to ₹12 LPA all-inclusive. What are you targeting?", time: "00:00" },
    { speaker: "user", text: "My expectation is ₹14 LPA based on my research. Current ₹11 LPA. Competing offer at ₹13 LPA. Notice 60 days. Equity / joining / notice all on the table.", time: "00:30" },
    { speaker: "ai", text: "We can stretch to ₹13 LPA total. Joining bonus ₹1 LPA, 1-year clawback.", time: "01:00" },
  ],
};

/* Negative: AI uses "stock" in non-equity context (parent company stock
 * for context, not as a grant). Should not crash equity literacy. */
const negStockNonGrant: SalaryNegotiationFixture = {
  id: "neg-stock-non-grant",
  description: "Mentions 'stock' only as parent-company context — not a grant",
  targetCompany: "Infosys",
  targetRole: "Software Engineer",
  difficulty: "mid",
  expectedPersona: "it-services",
  mustHaveFlags: [],
  mustNotHaveFlags: ["equity_terms_not_probed"],
  transcript: [
    { speaker: "ai", text: "Welcome. ₹15 LPA total. Infosys stock is listed but we don't offer RSU at this level.", time: "00:00" },
    { speaker: "user", text: "Got it, no RSU expected. My expectation is ₹17 LPA based on my research. Current ₹14 LPA. Competing offer at ₹16 LPA. Notice 60 days. Joining bonus also on the table.", time: "00:30" },
    { speaker: "ai", text: "We can stretch to ₹17 LPA total. Joining bonus ₹1 LPA, 1-year clawback.", time: "01:00" },
  ],
};

export const SALARY_NEGOTIATION_FIXTURES: SalaryNegotiationFixture[] = [
  // Block A — ai_* flags (15)
  aiPhraseRepetition,
  aiConsecutiveDuplicate,
  aiDidntAnswerDirect,
  aiNoCounterOffered,
  aiReversedRange,
  aiIgnoredUserComplaint,
  aiSelfContradiction,
  aiMisreadConditional,
  aiAcceptedWithoutPushback,
  aiSilentCapitulation,
  aiArithmeticError,
  aiOfferRegression,
  aiUsismDrift,
  aiUnrealisticCloseAbove,
  aiUnderCloseBelow,
  // Block B — coaching clusters (5)
  clusterDiscoveryMisses,
  clusterAnchoringMisses,
  clusterCounterMisses,
  clusterCloseMisses,
  clusterBatnaWeak,
  // Block C — recruiter sector personas (5)
  personaItServices,
  personaGcc,
  personaIndianUnicorn,
  personaEarlyStartup,
  personaBfsi,
  // Block D — negative cases (5)
  negEquityBareStocks,
  negComplaintAcknowledged,
  negRegressionWithRevision,
  negRangeLowToHigh,
  negStockNonGrant,
];
