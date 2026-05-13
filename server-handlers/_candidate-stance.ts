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
  hasAny: false,
};

/* ── Flexibility posture ─────────────────────────────────────────── */

/* Rigid: "non-negotiable", "this is my number period", "I won't budge",
 * "firm on X", "hard floor", "no compromise on salary". */
const RIGID_PATTERNS: RegExp[] = [
  /\bnon[-\s]?negotiable\b/i,
  /\bthis\s+is\s+(?:my\s+)?(?:number|ask|figure)\s*(?:,|\.|\s+)?\s*period\b/i,
  /\bwon.?t\s+(?:budge|move|come\s+down|negotiate)\b/i,
  /\b(?:firm|fixed)\s+on\s+(?:my\s+)?(?:number|ask|target|figure|\d)/i,
  /\bhard\s+(?:floor|number|ask)\b/i,
  /\bno\s+(?:compromise|flexibility|wiggle\s+room|negotiation)\s+on\s+(?:salary|the\s+number|comp|ctc)/i,
  /\btake\s+it\s+or\s+leave\s+it\b/i,
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
  /\bmarket\s+(?:standard|rate|range|value|norms?|benchmark)\b/i,
  /\bindustry\s+(?:standard|average|norm)\b/i,
  /\bgoing\s+rate\b/i,
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
];

function detectEquityAsCash(text: string): boolean {
  return EQUITY_AS_CASH_PATTERNS.some((p) => p.test(text));
}

/* ── Public API ──────────────────────────────────────────────────── */

export function extractCandidateStance(text: string): CandidateStanceResult {
  if (!text) return EMPTY;
  const flexibilityPosture = detectFlexibility(text);
  const marketReferenceVague = detectMarketReferenceVague(text);
  const salaryOnlyFactor = detectSalaryOnly(text);
  const badmouthsCurrent = detectBadmouth(text);
  const confidentialOvershare = detectConfidentialOvershare(text);
  const soundsDesperate = detectDesperation(text);
  const treatsEquityAsCash = detectEquityAsCash(text);
  const hasAny =
    flexibilityPosture != null ||
    marketReferenceVague ||
    salaryOnlyFactor ||
    badmouthsCurrent ||
    confidentialOvershare ||
    soundsDesperate ||
    treatsEquityAsCash;
  return {
    flexibilityPosture,
    marketReferenceVague,
    salaryOnlyFactor,
    badmouthsCurrent,
    confidentialOvershare,
    soundsDesperate,
    treatsEquityAsCash,
    hasAny,
  };
}

export function mergeCandidateStance(
  prior: CandidateStanceResult | null | undefined,
  next: CandidateStanceResult,
): CandidateStanceResult {
  const p = prior ?? EMPTY;
  /* Flexibility: last-stated wins (the candidate may shift posture
   * mid-conversation; that's a real signal, not noise). Booleans are
   * monotone-up — once a red flag fires, it sticks. */
  const merged: CandidateStanceResult = {
    flexibilityPosture: next.flexibilityPosture ?? p.flexibilityPosture,
    marketReferenceVague: p.marketReferenceVague || next.marketReferenceVague,
    salaryOnlyFactor: p.salaryOnlyFactor || next.salaryOnlyFactor,
    badmouthsCurrent: p.badmouthsCurrent || next.badmouthsCurrent,
    confidentialOvershare: p.confidentialOvershare || next.confidentialOvershare,
    soundsDesperate: p.soundsDesperate || next.soundsDesperate,
    treatsEquityAsCash: p.treatsEquityAsCash || next.treatsEquityAsCash,
    hasAny: false,
  };
  merged.hasAny =
    merged.flexibilityPosture != null ||
    merged.marketReferenceVague ||
    merged.salaryOnlyFactor ||
    merged.badmouthsCurrent ||
    merged.confidentialOvershare ||
    merged.soundsDesperate ||
    merged.treatsEquityAsCash;
  return merged;
}
