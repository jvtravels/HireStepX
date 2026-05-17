/* Candidate-stance scalar signals — Phase 18 (2026-05-13).
 *
 * These are sentiment/posture cues that complement the numeric facts
 * already in NegotiationState. They drive two derived modules:
 *
 *   - `_followup-router.ts`  — decides which follow-up question to
 *     ask next based on rigidity / market-reference / salary-only.
 *
 *   - `_red-flags.ts`        — flags risky candidate behaviour
 *     (desperation, badmouthing current employer, confidential
 *     overshare, etc.) so the move-picker can soften / probe / record.
 *
 * All stance fields are conservative — false positives would silently
 * tilt the negotiation away from the candidate. Each pattern requires
 * a fairly explicit surface form. */

export interface CandidateStanceResult {
  /** "rigid"   — candidate signals zero flexibility ("non-negotiable",
   *              "this is my number, period")
   *  "flexible" — candidate is openly accommodating ("flexible",
   *              "open to discussion", "happy to find a middle ground")
   *  Null when no stance cue. */
  flexibilityPosture: "rigid" | "flexible" | null;

  /** Candidate said "as per market" / "market standard" without
   *  naming a specific range. Triggers a market-reference probe. */
  marketReferenceVague: boolean;

  /** Candidate explicitly stated salary is the only thing that
   *  matters ("only money matters", "purely about the package").
   *  Distinct from a strong salary ask — this is a posture statement. */
  salaryOnlyFactor: boolean;

  /** Candidate is badmouthing their current employer ("toxic",
   *  "horrible", "bad management"). A behavioural red flag — recruiters
   *  weight this as a culture / professionalism risk. */
  badmouthsCurrent: boolean;

  /** Candidate has overshared confidential information ("our internal
   *  budget was X", "my manager told me confidentially"). The AI should
   *  not encourage further disclosure; it's an integrity flag. */
  confidentialOvershare: boolean;

  /** Candidate sounds desperate ("I really need this job", "I'll take
   *  anything", "please consider me"). Materially weakens BATNA. */
  soundsDesperate: boolean;

  /** Candidate treats ESOP/equity as guaranteed cash ("the equity is
   *  X lakhs in my pocket", "I'm counting the ESOP as cash"). Suggests
   *  a literacy gap — kernel should add an ESOP-risk follow-up. */
  treatsEquityAsCash: boolean;

  /** Phase 19 (2026-05-13) — corpus-derived.
   *
   *  Candidate refuses to anchor on a number ("as per company
   *  standards", "you decide", "whatever you offer"). Distinct from
   *  marketReferenceVague: that one names "market" without anchoring;
   *  this one names nothing at all. Recruiters consistently asked an
   *  expected-range follow-up after this. */
  avoidsAnchor: boolean;

  /** Candidate justifies the ask via personal expenses ("my rent is
   *  high", "EMI / loan / family commitments"). Recruiters in the
   *  training corpus weighted this NEGATIVELY — personal-finance
   *  framing is not a market-value argument. */
  personalExpenseJustification: boolean;

  /** Candidate uses other offers as a transactional demand ("match my
   *  other offer or I'll join whoever pays more"). Distinct from a
   *  competing-offer mention — the difference is the demand grammar.
   *  Recruiters log this as offer-shopping risk. */
  offerShoppingDemand: boolean;

  /** Candidate explicitly dismisses variable-pay risk ("variable is
   *  fine", "I only care about total CTC"). Text-side mirror to the
   *  structural ignores-variable-risk red flag — captures the SAYING
   *  even before the numbers line up. */
  dismissesVariableRisk: boolean;

  /** Candidate says they can join sooner than their notice allows
   *  ("I can join immediately even though my notice is 60 days").
   *  Text-side mirror to the overcommits-joining structural flag. */
  overpromisesJoining: boolean;

  /** Phase 3 missing-lever set (2026-05-17) — candidate just complained
   *  that the recruiter's offer represents only a small percentage hike
   *  on their current CTC ("that's only 8% hike", "barely a hike",
   *  "just a 5% jump"). Drives `anchor-defense-hike-strong` which rebuts
   *  with peer-context framing. Monotone-up via mergeCandidateStance.
   *  Optional for back-compat with fixtures constructed before the
   *  field shipped — extractCandidateStance / mergeCandidateStance
   *  default to false / null when absent. */
  complainedAboutHikePercent?: boolean;

  /** Phase 3 missing-lever set (2026-05-17) — candidate is stalling the
   *  conversation without leverage ("let me think about it", "I'll
   *  discuss with family", "I'll revert by Friday"). Drives the
   *  `polite-walkaway` lever (gated additionally on no competing
   *  offer + counterRound>=1 + non-flexible posture). `kind` records
   *  the dominant pattern; `statedAt` is the candidate-turn index at
   *  first detection. Last-stated-wins for kind, statedAt set on first
   *  detection (sticky). null when no stall signal seen. Optional for
   *  back-compat. */
  stallSignal?: {
    kind: "thinking" | "family-discussion" | "revert-later";
    statedAt: number;
  } | null;

  /** Convenience flag. */
  hasAny: boolean;
}

const EMPTY: CandidateStanceResult = {
  flexibilityPosture: null,
  marketReferenceVague: false,
  salaryOnlyFactor: false,
  badmouthsCurrent: false,
  confidentialOvershare: false,
  soundsDesperate: false,
  treatsEquityAsCash: false,
  avoidsAnchor: false,
  personalExpenseJustification: false,
  offerShoppingDemand: false,
  dismissesVariableRisk: false,
  overpromisesJoining: false,
  complainedAboutHikePercent: false,
  stallSignal: null,
  hasAny: false,
};

/* ── Flexibility posture ─────────────────────────────────────────── */

/* Rigid: "non-negotiable", "this is my number period", "I won't budge",
 * "firm on X", "hard floor", "no compromise on salary".
 *
 * Phase 20 — Hinglish coverage: Indian candidates routinely mix Hindi
 * idioms ("isse kam nahi", "final hai", "fix hai") into English calls.
 * Patterns are still anchored on English negotiation vocabulary so we
 * don't false-fire on neutral Hinglish. */
const RIGID_PATTERNS: RegExp[] = [
  /\bnon[-\s]?negotiable\b/i,
  /\bthis\s+is\s+(?:my\s+)?(?:number|ask|figure)\s*(?:,|\.|\s+)?\s*period\b/i,
  /\bwon.?t\s+(?:budge|move|come\s+down|negotiate)\b/i,
  /\b(?:firm|fixed)\s+on\s+(?:my\s+)?(?:number|ask|target|figure|\d)/i,
  /\bhard\s+(?:floor|number|ask)\b/i,
  /\bno\s+(?:compromise|flexibility|wiggle\s+room|negotiation)\s+on\s+(?:salary|the\s+number|comp|ctc)/i,
  /\btake\s+it\s+or\s+leave\s+it\b/i,
  /* Corpus-derived (Phase 19): "I will not join below ₹14L" /
   * "won't join below 20" — the candidate is naming a hard floor as
   * a take-it-or-leave-it stance, not a flexible floor. */
  /\b(?:won.?t|will\s+not|wouldn.?t|won.?t\s+ever)\s+(?:join|accept|consider|sign)\s+below\s+₹?\s*\d/i,
  /* Phase 20 (Hinglish): "isse kam nahi" / "isse neeche nahi" — "not
   * less than this". "final hai" / "fix hai" — "this is final/fixed". */
  /\b(?:isse|usse|is\s+se)\s+(?:kam|kum|neeche|niche|low)\s+nahi(?:n|.?n)?\b/i,
  /\b(?:final|fix(?:ed)?|pakka|pucca)\s+hai\b/i,
  /\bnegotiate\s+nahi(?:n|.?n)?\s+(?:karunga|karenge|hoga|kar\s+sakta)/i,
];

/* Flexible: "I'm flexible", "open to discussion", "we can work
 * something out", "happy to find middle ground", "willing to be
 * flexible". */
const FLEXIBLE_PATTERNS: RegExp[] = [
  /\b(?:i.?m|i\s+am|fairly|very|quite)\s+flexible\b/i,
  /\bwilling\s+to\s+be\s+flexible\b/i,
  /\bopen\s+to\s+(?:discussion|negotiation|exploring|hearing|adjusting)\b/i,
  /\b(?:happy|willing|open)\s+to\s+(?:find|reach|work\s+out)\s+(?:a\s+)?(?:middle\s+ground|compromise|fair\s+number)\b/i,
  /\bwe\s+can\s+(?:work\s+(?:something|this)\s+out|figure\s+(?:something|this)\s+out)\b/i,
  /\bsome\s+(?:flex|wiggle\s+room|give)\s+(?:on\s+my\s+side|here|there)?/i,
  /* Phase 20 (Hinglish): "flexible hoon" / "negotiable hai" / "dekh
   * lenge" — "I'm flexible" / "we'll work it out". */
  /\bflexible\s+(?:hoon|hu|hain)\b/i,
  /\bnegotiable\s+hai\b/i,
  /\b(?:dekh|baat)\s+(?:lenge|sakte\s+hain)\b/i,
];

function detectFlexibility(text: string): "rigid" | "flexible" | null {
  /* Rigid trumps flexible — if both fire, the candidate's hardline
   * cue is the more decision-relevant signal. */
  if (RIGID_PATTERNS.some((p) => p.test(text))) return "rigid";
  if (FLEXIBLE_PATTERNS.some((p) => p.test(text))) return "flexible";
  return null;
}

/* ── "As per market" without a stated range ──────────────────────── */

/* "as per market", "market standard", "industry standard", "going
 * rate" — without a paired number nearby. We approximate "without a
 * number" by requiring no digit within 30 chars after the phrase. */
const MARKET_REFERENCE_PATTERNS: RegExp[] = [
  /\bas\s+per\s+(?:the\s+)?market\b/i,
  /\bmarket\s+(?:standards?|rates?|ranges?|values?|norms?|benchmarks?)\b/i,
  /\bindustry\s+(?:standard|average|norm)\b/i,
  /\bgoing\s+rate\b/i,
  /* Phase 19 (corpus): "market is paying that much", "market pays
   * that much" — the candidate gestures at market without a number. */
  /\b(?:the\s+)?market\s+(?:is\s+(?:paying|offering)|pays|offers)\b(?!\s+₹?\s*\d)/i,
];

function detectMarketReferenceVague(text: string): boolean {
  for (const re of MARKET_REFERENCE_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    /* Look 30 chars ahead for a digit. If a number is present nearby,
     * the candidate has anchored the market claim and it's NOT vague. */
    const tail = text.slice(m.index, m.index + (m[0]?.length ?? 0) + 30);
    if (/\d/.test(tail)) continue;
    return true;
  }
  return false;
}

/* ── Salary-only factor ──────────────────────────────────────────── */

const SALARY_ONLY_PATTERNS: RegExp[] = [
  /\b(?:only|just|purely)\s+(?:about|interested\s+in|care\s+about|focused\s+on)\s+(?:the\s+)?(?:salary|money|number|package|comp(?:ensation)?|ctc)\b/i,
  /\b(?:salary|money|comp(?:ensation)?|the\s+number|the\s+package)\s+is\s+(?:the\s+)?(?:only|sole|main|primary)\s+(?:thing|factor|consideration|driver|decider)\b/i,
  /\b(?:nothing|don.?t\s+care)\s+(?:else|but\s+(?:the\s+)?(?:money|salary|number))\b/i,
  /\bdecision\s+(?:is\s+)?(?:purely|entirely|only)\s+(?:about\s+)?(?:money|salary|comp|the\s+number)/i,
];

function detectSalaryOnly(text: string): boolean {
  return SALARY_ONLY_PATTERNS.some((p) => p.test(text));
}

/* ── Badmouthing current employer ────────────────────────────────── */

/* "my current company is toxic", "the management is horrible", "boss
 * is terrible". Conservative — we only count an attribute statement
 * about the current employer; generic complaints ("the team is busy")
 * don't count. */
const BADMOUTH_PATTERNS: RegExp[] = [
  /\b(?:my\s+)?(?:current|present)\s+(?:company|employer|firm|manager|boss|management|team|workplace)\s+(?:is|are|has\s+been|.?s)\s+(?:toxic|horrible|terrible|awful|garbage|trash|hellish|miserable|nightmare|broken|incompetent)\b/i,
  /\b(?:hate|despise|can.?t\s+stand|fed\s+up\s+with)\s+(?:my\s+)?(?:current\s+)?(?:company|employer|manager|boss|team|workplace|job)\b/i,
  /\b(?:toxic|hostile)\s+(?:work\s+)?(?:environment|culture)\b/i,
  /\b(?:my\s+)?(?:manager|boss)\s+(?:is\s+a\s+)?(?:micromanager|idiot|moron|tyrant|nightmare)\b/i,
];

function detectBadmouth(text: string): boolean {
  return BADMOUTH_PATTERNS.some((p) => p.test(text));
}

/* ── Confidential overshare ──────────────────────────────────────── */

const CONFIDENTIAL_PATTERNS: RegExp[] = [
  /\b(?:our|the)\s+internal\s+(?:budget|comp\s+band|salary\s+band|hiring\s+budget)\s+(?:is|was|for)\b/i,
  /\b(?:my\s+)?manager\s+told\s+me\s+(?:confidentially|in\s+confidence|off\s+the\s+record)\b/i,
  /\b(?:off\s+the\s+record|between\s+us|don.?t\s+tell\s+(?:anyone|them))\b/i,
  /\bnda.?d\s+but\s+i.?ll\s+(?:share|tell)\b/i,
  /\b(?:another\s+candidate|a\s+colleague|hr)\s+told\s+me\s+(?:their|the)\s+(?:offer|comp|ctc|salary)\s+is\b/i,
];

function detectConfidentialOvershare(text: string): boolean {
  return CONFIDENTIAL_PATTERNS.some((p) => p.test(text));
}

/* ── Desperation ─────────────────────────────────────────────────── */

const DESPERATION_PATTERNS: RegExp[] = [
  /\bi\s+(?:really|desperately|badly)\s+need\s+(?:this\s+)?(?:job|offer|role|opportunity)\b/i,
  /\bi.?ll\s+(?:take|accept)\s+(?:anything|whatever\s+you\s+offer|any\s+number)\b/i,
  /\b(?:please\s+)?(?:please\s+)?consider\s+me\b/i,
  /\bbeggars\s+can.?t\s+be\s+choosers\b/i,
  /\bi.?m\s+(?:running\s+out\s+of\s+(?:time|options|runway|savings)|out\s+of\s+work|unemployed\s+and)\b/i,
  /\b(?:i\s+have\s+no\s+other\s+offers|nothing\s+else\s+(?:in\s+hand|lined\s+up)|this\s+is\s+my\s+only\s+(?:offer|option))\b/i,
  /* Phase 19 (corpus): "I just need the job", "I simply need this
   * role" — non-superlative-but-still-pleading need framing. */
  /\bi\s+(?:just|simply)\s+need\s+(?:this|the|a|any)\s+(?:job|offer|role|opportunity)\b/i,
  /* Phase 19 (corpus): "Anything is fine. I just need the job." —
   * pairing 'anything is fine/ok' near 'need/take a job'. */
  /\banything\s+(?:is\s+)?(?:fine|ok|okay)\b[\s\S]{0,60}\b(?:need|take|accept)\s+(?:this|the|a|any)?\s*(?:job|offer|role|opportunity)\b/i,
  /* Phase 20 (Hinglish): "job ki bahut zaroorat hai" — "I really need
   * this job". "kuch bhi chalega" — "anything will work". "please
   * consider kar lijiye" — "please consider me". */
  /\b(?:job|offer|role|opportunity)\s+(?:ki\s+)?(?:bahut|bohot|bahot)\s+(?:zaroorat|jaroorat|need)\s+hai\b/i,
  /\bkuch\s+bhi\s+chalega\b/i,
  /\bplease\s+consider\s+kar\s+(?:lijiye|lo|le\s+lijiye)\b/i,
];

function detectDesperation(text: string): boolean {
  return DESPERATION_PATTERNS.some((p) => p.test(text));
}

/* ── Treats equity as cash ───────────────────────────────────────── */

/* The candidate is computing equity at a guaranteed face value — they
 * count it in their total expectation without adjusting for vesting,
 * dilution, or liquidity risk. */
const EQUITY_AS_CASH_PATTERNS: RegExp[] = [
  /\b(?:counting|including|treating)\s+(?:the\s+)?(?:esop|equity|stock|options?|rsu)s?\s+as\s+(?:cash|guaranteed|in[-\s]?hand|fixed)\b/i,
  /\b(?:esop|equity|stock|options?|rsu)s?\s+(?:is|are)\s+(?:basically|essentially|just|like)\s+cash\b/i,
  /\b(?:the\s+)?(?:esop|equity|stock|options?|rsu)\s+(?:is|are)\s+₹?\s*\d+\s*(?:lpa|lakhs?|cr|crore)\s+in\s+(?:my\s+)?pocket\b/i,
  /\bguaranteed\s+payout\s+(?:on|from)\s+(?:the\s+)?(?:esop|equity|stock|options?)\b/i,
  /* Phase 19 (corpus): "ESOP is also money", "equity is also money",
   * "stock is money" — equating equity with cash without qualification. */
  /\b(?:esop|equity|stock|options?|rsu)s?\s+(?:is|are)\s+(?:also\s+)?(?:money|cash)\b/i,
];

function detectEquityAsCash(text: string): boolean {
  return EQUITY_AS_CASH_PATTERNS.some((p) => p.test(text));
}

/* ── Phase 19 corpus-derived signals ─────────────────────────────── */

/* Avoids anchoring: "as per company standards", "you decide",
 * "whatever you offer", "as per your discretion", "I leave it to
 * you", "happy with whatever". Distinct from marketReferenceVague —
 * that one names "market"; this one names nothing. */
const AVOIDS_ANCHOR_PATTERNS: RegExp[] = [
  /\bas\s+per\s+(?:company|your)\s+(?:standards?|policy|norms?|discretion|decision)\b/i,
  /\byou\s+(?:can\s+)?decide\b/i,
  /\bi(?:.?ll|\s+will)?\s+leave\s+(?:it|that)\s+(?:to|with)\s+you\b/i,
  /\bwhatever\s+(?:you\s+)?(?:offer|decide|think\s+is\s+fair|company\s+(?:decides|gives))\b/i,
  /\bhappy\s+with\s+whatever\b/i,
  /\bi\s+(?:don.?t|do\s+not)\s+have\s+a\s+specific\s+(?:number|range|expectation)\b/i,
  /* Phase 20 (Hinglish): "aap decide kar lijiye" / "company decide
   * karegi" / "jo aap sahi samjho" — "you decide" / "whatever you
   * think is right". */
  /\b(?:aap|app|company|HR)\s+(?:hi\s+)?decide\s+kar\s+(?:lijiye|lo|le|denge|legi|karenge)/i,
  /\bjo\s+(?:aap|app|company)\s+(?:sahi|theek|thik)\s+(?:samjho|samjhe|samjhein|lage)/i,
  /\bjo\s+(?:bhi|company|aap)\s+(?:offer|de)\s+(?:karenge|karegi|denge|dega)/i,
];

function detectAvoidsAnchor(text: string): boolean {
  return AVOIDS_ANCHOR_PATTERNS.some((p) => p.test(text));
}

/* Personal-expense justification: candidate explains the ask via
 * personal finance ("my rent is high", "EMI", "family responsibilities",
 * "expenses are high", "loan to pay"). NOT a market-value argument. */
const PERSONAL_EXPENSE_PATTERNS: RegExp[] = [
  /\b(?:my\s+)?(?:expenses|rent|emi|loans?|debts?|bills?)\s+(?:are|is)\s+(?:high|too\s+much|increasing|growing)\b/i,
  /\bneed\s+this\s+(?:salary|amount|money|number|figure)\s+(?:because|since|as)\s+(?:my\s+)?(?:expenses|rent|emi|loan|family|kids|parents|household)/i,
  /\b(?:cost\s+of\s+living|household\s+(?:expenses|costs)|family\s+(?:expenses|responsibilities|commitments))\s+(?:is|are|have)\s+(?:high|increased|gone\s+up|risen)/i,
  /\b(?:home\s+loan|car\s+loan|education\s+loan|personal\s+loan)\s+(?:emi|payment|installment)/i,
  /\bsupport(?:ing)?\s+(?:my\s+)?(?:family|parents|kids|household)\s+(?:financially|with\s+(?:money|salary))/i,
];

function detectPersonalExpenseJustification(text: string): boolean {
  return PERSONAL_EXPENSE_PATTERNS.some((p) => p.test(text));
}

/* Offer-shopping demand: candidate uses other offers as a
 * transactional demand. Key cues: "you need to match", "match my
 * other offer or", "I'll join whoever pays/gives more", "highest
 * bidder", "match or beat". Distinct from a competing-offer mention. */
const OFFER_SHOPPING_PATTERNS: RegExp[] = [
  /\b(?:you|company|hr)\s+(?:need|have|got)\s+to\s+(?:match|beat)\s+(?:my\s+)?(?:other\s+offers?|competing\s+offers?|them)/i,
  /\bi.?ll\s+join\s+whoever\s+(?:gives|pays|offers)\s+(?:me\s+)?(?:more|the\s+most|highest|₹?\s*\d)/i,
  /\bwill\s+join\s+whoever\s+(?:gives|pays|offers)\s+(?:me\s+)?(?:more|the\s+most|highest|₹?\s*\d)/i,
  /\bgo(?:ing)?\s+with\s+(?:the\s+)?highest\s+(?:bidder|offer)/i,
  /\b(?:match|beat)\s+(?:my\s+)?(?:other\s+)?offers?\s+or\s+i.?ll\b/i,
  /\bi\s+have\s+(?:many|multiple|several|other)\s+offers?,?\s+(?:so\s+)?you\s+(?:need\s+to|have\s+to|must)\s+(?:match|beat|exceed)/i,
];

function detectOfferShoppingDemand(text: string): boolean {
  return OFFER_SHOPPING_PATTERNS.some((p) => p.test(text));
}

/* Dismisses variable-pay risk by SAYING ("variable is fine", "I only
 * care about total CTC", "doesn't matter how it's split"). Text-side
 * mirror to the structural red flag in _red-flags.ts. */
const DISMISSES_VARIABLE_PATTERNS: RegExp[] = [
  /\bvariable\s+(?:is|.?s)\s+(?:fine|ok|okay|no\s+problem|not\s+a\s+(?:problem|concern|issue))\b/i,
  /\b(?:only|just)\s+care(?:s)?\s+about\s+(?:the\s+)?total\s+(?:ctc|comp|package|number)\b/i,
  /\b(?:doesn.?t|does\s+not)\s+matter\s+(?:to\s+me\s+)?how\s+(?:it.?s|the\s+(?:ctc|comp|package))\s+(?:split|structured|broken)/i,
  /\bany\s+(?:split|structure|breakup)\s+(?:is\s+)?(?:fine|ok|okay|works)\b/i,
  /\bi.?m\s+okay\s+with\s+any\s+(?:structure|split|breakup)\b/i,
];

function detectDismissesVariableRisk(text: string): boolean {
  return DISMISSES_VARIABLE_PATTERNS.some((p) => p.test(text));
}

/* Overpromises joining: candidate says they can join sooner than
 * their stated notice ("I can join immediately even though my notice
 * is 60 days"). The corpus has the exact "immediately even though"
 * idiom; we accept variants. */
const OVERPROMISES_JOINING_PATTERNS: RegExp[] = [
  /\b(?:i\s+can\s+)?join\s+(?:immediately|right\s+away|today|tomorrow|this\s+week|next\s+week|in\s+\d+\s+days?)\s*(?:,|\.)?\s*(?:even\s+though|despite|although|but)\s+(?:my\s+)?(?:notice|notice\s+period)/i,
  /\bjoin\s+immediately(?:\s+if\s+(?:needed|required))?\s*(?:,|\.)?\s*(?:even|despite|although)\s+(?:my\s+)?(?:notice|with\s+a)/i,
  /\b(?:will|can)\s+(?:start|join)\s+(?:right\s+)?(?:away|now|today)\s+(?:irrespective|regardless)\s+of\s+(?:my\s+)?notice/i,
];

function detectOverpromisesJoining(text: string): boolean {
  return OVERPROMISES_JOINING_PATTERNS.some((p) => p.test(text));
}

/* ── Phase 3 missing-lever set (2026-05-17) — hike-% complaint ────── */

/* Candidate is complaining that the offer represents only a small
 * percentage hike on their current CTC. Conservative — pattern must
 * mention the hike/jump explicitly so neutral percentages elsewhere
 * (variable share, equity percent, etc.) don't false-fire. */
const HIKE_PCT_COMPLAINT_PATTERNS: RegExp[] = [
  /\bonly\s+\d+\s*%?\s*hike\b/i,
  /\bjust\s+\d+\s*%?\s*(?:hike|jump|bump|increase)\b/i,
  /\bthat\s*(?:\w+\s+){0,2}barely\s*(?:\w+\s+){0,3}hike\b/i,
  /\bthat\s*(?:\w+\s+){0,2}not\s+even\s+(?:\w+\s+){0,3}hike\b/i,
  /* Phase 22 Hinglish (2026-05-17) — "sirf 8% hike" / "bas 10% hike"
   * ("only/just N% hike"), "itna sa hike" / "thoda hi hike"
   * ("such a small hike" / "only a little hike"). Patterns are
   * anchored on the literal token `hike` to avoid neutral
   * percentages elsewhere (variable share, equity %) firing. */
  /\bsirf\s+\d+\s*%?\s*hike\b/i,
  /\bbas\s+\d+\s*%?\s*hike\b/i,
  /\bitna\s+sa\s+hike\b/i,
  /\bthoda\s+(?:hi|sa)\s+hike\b/i,
];

function detectComplainedAboutHikePercent(text: string): boolean {
  return HIKE_PCT_COMPLAINT_PATTERNS.some((p) => p.test(text));
}

/* ── Phase 3 missing-lever set (2026-05-17) — stall signals ───────── */

const STALL_THINKING_PATTERNS: RegExp[] = [
  /\blet\s+me\s+think\s+(?:about\s+it|it\s+over|on\s+it)\b/i,
  /\bi(?:.?ll|\s+will)?\s+(?:need\s+to\s+|have\s+to\s+)?think\s+(?:about\s+it|on\s+it|it\s+over)\b/i,
  /\bneed\s+(?:some\s+)?time\s+to\s+think\b/i,
];
const STALL_FAMILY_PATTERNS: RegExp[] = [
  /\b(?:i(?:.?ll|\s+will)?\s+)?(?:discuss|talk|check)\s+(?:this\s+|it\s+)?with\s+(?:my\s+)?(?:family|wife|husband|spouse|partner|parents)\b/i,
  /\bneed\s+to\s+(?:discuss|talk|check)\s+with\s+(?:my\s+)?(?:family|wife|husband|spouse|partner|parents)\b/i,
  /* Phase 22 Hinglish (2026-05-17) — "family se discuss / baat
   * karunga / poochhna padega". */
  /\bfamily\s+se\s+(?:discuss|baat|poochh|pooch)/i,
];
const STALL_REVERT_PATTERNS: RegExp[] = [
  /\bi(?:.?ll|\s+will)?\s+(?:revert|get\s+back\s+to\s+you|come\s+back\s+to\s+you|respond)\s+(?:by|on|in|after|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|next\s+week|the\s+weekend)/i,
  /\bcan\s+i\s+revert\s+(?:by|on|in|after|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|next\s+week|the\s+weekend)/i,
  /\bgive\s+me\s+(?:a\s+)?(?:day|two\s+days|few\s+days|some\s+time|till|until)\b/i,
  /* Phase 22 Hinglish/English (2026-05-17) — "ek din do" ("give me a
   * day"), "thoda time" ("a bit of time"), "sochke batata" ("will
   * think and tell"), "family se discuss" ("discuss with family"),
   * "wapas call" ("call back"). Plus three English idioms that were
   * missed in the Phase 3 set. */
  /\bek\s+din\s+do\b/i,
  /\bthoda\s+time\b/i,
  /\bsochke\s+(?:batata|bataunga|bataenge|batayenge)/i,
  /\bwapas\s+call\b/i,
  /\bgive\s+me\s+a\s+day\b/i,
  /\bsleep\s+on\s+it\b/i,
  /\bneed\s+to\s+think\b/i,
];

function detectStallSignal(text: string): "thinking" | "family-discussion" | "revert-later" | null {
  if (STALL_THINKING_PATTERNS.some((p) => p.test(text))) return "thinking";
  if (STALL_FAMILY_PATTERNS.some((p) => p.test(text))) return "family-discussion";
  if (STALL_REVERT_PATTERNS.some((p) => p.test(text))) return "revert-later";
  return null;
}

/* ── Phase 21 — Recovery signals (multi-turn posture decay) ──────── */

/* A candidate who said "I really need this job" on turn 1 but on
 * turn 4 says "Based on market data my target is ₹22L; I'm also
 * weighing the role scope" has recovered. Without decay logic, the
 * Phase 18 sticky-boolean semantics keeps `soundsDesperate` true for
 * the rest of the session, which (a) misleads the LLM into continued
 * predatory pacing and (b) tanks the candidate's score unfairly.
 *
 * Recovery is NOT total: red flags about events (badmouthing, equity-
 * as-cash, confidential overshare) STAY sticky — they happened, and
 * the recruiter would remember. Only POSTURE signals can decay:
 *   - soundsDesperate
 *   - salaryOnlyFactor
 *   - avoidsAnchor
 *   - personalExpenseJustification
 *   - offerShoppingDemand
 *
 * Each has its own recovery condition:
 *   - desperate → candidate anchors on a number OR mentions non-comp value
 *   - salary-only → candidate names a non-comp factor
 *   - avoids-anchor → candidate states a concrete target
 *   - personal-expense → candidate uses market or competing-offer rationale
 *   - offer-shopping → candidate explicitly de-escalates ("not auctioning",
 *                      "fair number on both sides") */
export interface RecoverySignals {
  desperateRecovered: boolean;
  salaryOnlyRecovered: boolean;
  avoidsAnchorRecovered: boolean;
  personalExpenseRecovered: boolean;
  offerShoppingRecovered: boolean;
}

/* "I'm also weighing role / scope / growth / mentorship / equity /
 * learning / team / manager / mission" — explicit non-comp value. */
const NON_COMP_FACTOR_PATTERNS: RegExp[] = [
  /\b(?:role|scope|growth|mentorship|learning|team|manager|mission|impact|culture|stack|technology|product)\s+(?:is|are|matters?|important|factor|driver|consideration)/i,
  /\b(?:weighing|considering|evaluating|looking\s+at)\b[\s\S]{0,40}\b(?:role|scope|growth|mentorship|learning|team|manager|mission|impact|culture|stack)/i,
  /\bnot\s+(?:just|only|purely)\s+about\s+(?:the\s+)?(?:salary|money|comp|package|number)/i,
  /\b(?:salary|comp|money)\s+(?:is|.?s)\s+(?:one|just\s+one|a|a\s+single)\s+(?:factor|consideration|piece)/i,
];

/* Market or competing-offer rationale: "market data", "peer offers",
 * "competing offer at ₹X", "₹X for similar role at <company>". */
const MARKET_RATIONALE_PATTERNS: RegExp[] = [
  /\bmarket\s+(?:data|benchmark|research|comp(?:arable)?|rate|range)\b[\s\S]{0,40}\d/i,
  /\b(?:peer|competing|other)\s+offers?\s+(?:at|of|around)\s+₹?\s*\d/i,
  /\bbased\s+on\s+(?:my\s+)?(?:research|benchmarking|data|levels.?fyi|glassdoor)/i,
  /\bsimilar\s+(?:role|position|level)s?\s+at\s+(?:.+?)\s+(?:pay|offer|are\s+at)/i,
];

/* Explicit offer-shopping de-escalation: "not auctioning", "fair on
 * both sides", "I'm not playing offers off". */
const OFFER_SHOPPING_DEESCALATION: RegExp[] = [
  /\bnot\s+(?:auctioning|playing\s+(?:offers\s+)?off|shopping\s+(?:offers|around))/i,
  /\bfair\s+(?:number|deal|outcome|landing)\s+(?:on\s+)?both\s+sides/i,
  /\bnot\s+(?:about|asking\s+for)\s+(?:the\s+)?highest\s+(?:bidder|offer)/i,
];

/* Anchor presence: candidate has stated a concrete number as their
 * target/ask in this utterance. We look for "I'm targeting/asking/
 * looking at ₹N" or "my expectation is ₹N" — distinct from random
 * digits (current CTC mentions don't anchor the FUTURE ask). */
const ANCHOR_NUMBER_PATTERNS: RegExp[] = [
  /\b(?:i.?m|i\s+am)\s+(?:targeting|asking\s+for|looking\s+at|expecting|hoping\s+for)\s+₹?\s*\d/i,
  /\b(?:my|the)\s+(?:target|ask|expectation|number|figure)\s+(?:is|.?s)\s+₹?\s*\d/i,
  /\b(?:looking\s+at|targeting)\s+(?:a\s+)?range\s+of\s+₹?\s*\d/i,
];

export function detectRecoverySignals(text: string): RecoverySignals {
  if (!text) {
    return {
      desperateRecovered: false,
      salaryOnlyRecovered: false,
      avoidsAnchorRecovered: false,
      personalExpenseRecovered: false,
      offerShoppingRecovered: false,
    };
  }
  const hasNonComp = NON_COMP_FACTOR_PATTERNS.some((p) => p.test(text));
  const hasMarketRationale = MARKET_RATIONALE_PATTERNS.some((p) => p.test(text));
  const hasAnchor = ANCHOR_NUMBER_PATTERNS.some((p) => p.test(text));
  const hasDeescalation = OFFER_SHOPPING_DEESCALATION.some((p) => p.test(text));
  return {
    /* Desperate clears on EITHER anchoring (confidence) OR surfacing
     * non-comp value (showing other options matter). */
    desperateRecovered: hasAnchor || hasNonComp,
    salaryOnlyRecovered: hasNonComp,
    avoidsAnchorRecovered: hasAnchor,
    personalExpenseRecovered: hasMarketRationale,
    offerShoppingRecovered: hasDeescalation || hasNonComp,
  };
}

/* ── Public API ──────────────────────────────────────────────────── */

export function extractCandidateStance(
  text: string,
  /* Phase 3 missing-lever set (2026-05-17) — turn index of the candidate
   * utterance being analysed. Used to stamp stallSignal.statedAt on
   * first detection. Defaults to 0 so existing callers / unit tests
   * keep working without code change; the production call-site in the
   * kernel passes state.turnIndex. */
  turnIndex: number = 0,
): CandidateStanceResult {
  if (!text) return EMPTY;
  const flexibilityPosture = detectFlexibility(text);
  const marketReferenceVague = detectMarketReferenceVague(text);
  const salaryOnlyFactor = detectSalaryOnly(text);
  const badmouthsCurrent = detectBadmouth(text);
  const confidentialOvershare = detectConfidentialOvershare(text);
  const soundsDesperate = detectDesperation(text);
  const treatsEquityAsCash = detectEquityAsCash(text);
  const avoidsAnchor = detectAvoidsAnchor(text);
  const personalExpenseJustification = detectPersonalExpenseJustification(text);
  const offerShoppingDemand = detectOfferShoppingDemand(text);
  const dismissesVariableRisk = detectDismissesVariableRisk(text);
  const overpromisesJoining = detectOverpromisesJoining(text);
  const complainedAboutHikePercent = detectComplainedAboutHikePercent(text);
  const stallKind = detectStallSignal(text);
  const stallSignal = stallKind == null ? null : { kind: stallKind, statedAt: turnIndex };
  const hasAny =
    flexibilityPosture != null ||
    marketReferenceVague ||
    salaryOnlyFactor ||
    badmouthsCurrent ||
    confidentialOvershare ||
    soundsDesperate ||
    treatsEquityAsCash ||
    avoidsAnchor ||
    personalExpenseJustification ||
    offerShoppingDemand ||
    dismissesVariableRisk ||
    overpromisesJoining ||
    complainedAboutHikePercent ||
    stallSignal != null;
  return {
    flexibilityPosture,
    marketReferenceVague,
    salaryOnlyFactor,
    badmouthsCurrent,
    confidentialOvershare,
    soundsDesperate,
    treatsEquityAsCash,
    avoidsAnchor,
    personalExpenseJustification,
    offerShoppingDemand,
    dismissesVariableRisk,
    overpromisesJoining,
    complainedAboutHikePercent,
    stallSignal,
    hasAny,
  };
}

export function mergeCandidateStance(
  prior: CandidateStanceResult | null | undefined,
  next: CandidateStanceResult,
  /* Phase 21 — optional recovery signals from the current utterance.
   * When supplied, the matching prior sticky boolean is cleared (only
   * if next.* didn't re-fire it). This makes posture decay possible
   * without breaking the audit-trail semantics of red-flag stickiness. */
  recovery?: RecoverySignals,
): CandidateStanceResult {
  const p = prior ?? EMPTY;
  const r = recovery ?? {
    desperateRecovered: false,
    salaryOnlyRecovered: false,
    avoidsAnchorRecovered: false,
    personalExpenseRecovered: false,
    offerShoppingRecovered: false,
  };
  /* Decay rule: prior sticky boolean is cleared iff
   *   (recovery signal fires) AND (next utterance does NOT re-fire it).
   * If the candidate is BOTH anchoring AND simultaneously dropping a
   * new desperate cue, the new cue is stronger and we keep it true. */
  const decayedDesperate =
    p.soundsDesperate && r.desperateRecovered && !next.soundsDesperate ? false : p.soundsDesperate;
  const decayedSalaryOnly =
    p.salaryOnlyFactor && r.salaryOnlyRecovered && !next.salaryOnlyFactor ? false : p.salaryOnlyFactor;
  const decayedAvoidsAnchor =
    p.avoidsAnchor && r.avoidsAnchorRecovered && !next.avoidsAnchor ? false : p.avoidsAnchor;
  const decayedPersonalExpense =
    p.personalExpenseJustification && r.personalExpenseRecovered && !next.personalExpenseJustification
      ? false
      : p.personalExpenseJustification;
  const decayedOfferShopping =
    p.offerShoppingDemand && r.offerShoppingRecovered && !next.offerShoppingDemand
      ? false
      : p.offerShoppingDemand;

  /* Flexibility: last-stated wins (the candidate may shift posture
   * mid-conversation; that's a real signal, not noise). Non-decaying
   * red flags stay monotone-up — once a behavioural breach (badmouth,
   * confidential overshare, equity-as-cash, overpromise) fires, it
   * stays in the audit trail. */
  /* Phase 3 missing-lever set (2026-05-17) — stallSignal: keep the
   * earliest statedAt so the polite-walkaway lever has stable
   * provenance ("the candidate has been stalling since turn N"); the
   * `kind` is last-stated-wins to reflect the most recent posture. */
  const mergedStallSignal =
    next.stallSignal != null
      ? {
          kind: next.stallSignal.kind,
          statedAt: p.stallSignal?.statedAt ?? next.stallSignal.statedAt,
        }
      : p.stallSignal;
  const merged: CandidateStanceResult = {
    flexibilityPosture: next.flexibilityPosture ?? p.flexibilityPosture,
    marketReferenceVague: p.marketReferenceVague || next.marketReferenceVague,
    salaryOnlyFactor: decayedSalaryOnly || next.salaryOnlyFactor,
    badmouthsCurrent: p.badmouthsCurrent || next.badmouthsCurrent,
    confidentialOvershare: p.confidentialOvershare || next.confidentialOvershare,
    soundsDesperate: decayedDesperate || next.soundsDesperate,
    treatsEquityAsCash: p.treatsEquityAsCash || next.treatsEquityAsCash,
    avoidsAnchor: decayedAvoidsAnchor || next.avoidsAnchor,
    personalExpenseJustification: decayedPersonalExpense || next.personalExpenseJustification,
    offerShoppingDemand: decayedOfferShopping || next.offerShoppingDemand,
    dismissesVariableRisk: p.dismissesVariableRisk || next.dismissesVariableRisk,
    overpromisesJoining: p.overpromisesJoining || next.overpromisesJoining,
    complainedAboutHikePercent: p.complainedAboutHikePercent || next.complainedAboutHikePercent,
    stallSignal: mergedStallSignal,
    hasAny: false,
  };
  merged.hasAny =
    merged.flexibilityPosture != null ||
    merged.marketReferenceVague ||
    merged.salaryOnlyFactor ||
    merged.badmouthsCurrent ||
    merged.confidentialOvershare ||
    merged.soundsDesperate ||
    merged.treatsEquityAsCash ||
    merged.avoidsAnchor ||
    merged.personalExpenseJustification ||
    merged.offerShoppingDemand ||
    merged.dismissesVariableRisk ||
    merged.overpromisesJoining ||
    merged.complainedAboutHikePercent ||
    merged.stallSignal != null;
  return merged;
}
