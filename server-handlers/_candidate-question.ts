/* Candidate-question topic classification + response bank.
 *
 * Replaces the regex-ladder `answer-direct` branch in `_canonical-prose.ts`
 * with a typed two-stage architecture:
 *
 *   1. `classifyCandidateQuestion(raw)` → `CandidateQuestionTopic | null`
 *      Deterministic intent classification; one function, one return type,
 *      no embedded prose. Pure (string → enum).
 *
 *   2. `renderCandidateQuestionResponse(topic, sector, round)` →
 *      `string` Persona-overlaid recruiter prose. Lookups in a single
 *      `RESPONSE_BANK` table keyed by topic with optional sector/round
 *      overrides. Adding a new topic = one entry in the union + one row in
 *      the bank; no `if` branches to extend.
 *
 * The previous design (BUG-006 sub-classifier) interleaved classification
 * and prose generation inside a ~70-line `if (/regex/.test(r)) return "..."`
 * chain. That layout couples three concerns:
 *   (a) which question intent the candidate expressed,
 *   (b) which recruiter persona is replying,
 *   (c) the literal recruiter wording.
 * Co-locating them blocked persona overlays (no way to vary the ESOP
 * answer by sector), made testing impossible (you can only assert the
 * full string, not the detected intent), and made every new topic a copy-
 * paste edit. This module separates the concerns.
 *
 * Architectural QA v3 round 3 (2026-05-19) — "solid fix, no patchwork"
 * directive.
 */

import type { RecruiterSectorPersona } from "./_indian-recruiter-personas";
import type { NegotiationRoundPersona } from "./_negotiation-rounds";

/* ─── Topic taxonomy ────────────────────────────────────────────────── */

/**
 * Closed enumeration of candidate-question intents the deterministic
 * core can recognise without an LLM. Each value maps to exactly one
 * row in `RESPONSE_BANK`. Order is informational only — match priority
 * is encoded by `INTENT_PATTERNS` order below.
 *
 * If a new topic is needed: (1) add a union member here, (2) add a
 * `RESPONSE_BANK` row, (3) add an `INTENT_PATTERNS` entry. The classifier
 * and renderer pick it up automatically — no changes to call sites.
 */
export type CandidateQuestionTopic =
  | "esop-structure"          // ESOP/RSU/vesting/cliff/exercise questions
  | "fixed-variable-split"    // breakup / fixed-vs-variable / structure
  | "budget-disclosure"       // budget / range / final offer / room
  | "in-hand-monthly"         // monthly take-home / per-month math
  | "review-cycle"            // appraisal / next cycle / 6-month review
  | "location-remote"         // remote / WFH / different city / relocation
  | "verification-bgv"        // salary slip / BGV / proof / verification
  | "benefits-non-ctc"        // insurance / PF / gratuity / perks
  | "notice-buyout"           // notice period / buyout / early join
  | "variable-mechanics"      // variable guaranteed / KPI / payout formula
  | "range-grade-leverage"    // grade revisit / max offer / why lower
  | "tax-structuring"         // tax efficient / flexi plan / structuring
  | "channel-switch"          // take this on a call / email instead
  | "meta-coaching";          // candidate asking what to say (defensive)

interface IntentPattern {
  topic: CandidateQuestionTopic;
  /** Single regex describing the intent. Must match against
   *  lowercased input. Order in `INTENT_PATTERNS` defines priority on
   *  multi-match (first wins). */
  match: RegExp;
}

/* ─── Intent patterns (priority-ordered) ────────────────────────────── */

/* Priority rationale: more-specific topics first, so a question that
 * mentions both "ESOP" and "structure" classifies as `esop-structure`,
 * not `fixed-variable-split`. Channel/meta intents sit at the bottom —
 * they only fire when nothing substantive matches. */
const INTENT_PATTERNS: ReadonlyArray<IntentPattern> = [
  { topic: "esop-structure",        match: /\b(?:esop|rsu)\b|equity|exercise\s+price|vesting|cliff/ },
  { topic: "in-hand-monthly",       match: /\bmonthly\b|in[- ]?hand|take[- ]?home|per\s*month|\bp\.?m\.?\b/ },
  { topic: "review-cycle",          match: /\breview\b|appraisal|cycle|6[- ]?month|six[- ]?month|next\s+cycle/ },
  { topic: "location-remote",       match: /\bremote\b|\bwfh\b|work\s+from\s+home|different\s+city|relocat/ },
  { topic: "verification-bgv",      match: /salary\s+slip|payslip|verification|\bbgv\b|background|proof|document/ },
  { topic: "benefits-non-ctc",      match: /benefit|perk|apart\s+from\s+ctc|non[- ]?ctc|insurance|gratuity|\bpf\b|provident|allowance/ },
  { topic: "notice-buyout",         match: /\bnotice\b|buyout|early\s+join|early.*joining|\bserve\b/ },
  { topic: "variable-mechanics",    match: /variable.*guaranteed|guaranteed.*variable|performance[- ]?based|individual\s+or\s+company|individual\s+vs\s+company|payout\s+(?:formula|criteria)/ },
  { topic: "tax-structuring",       match: /tax\s+efficient|tax\s+optimised|tax\s+optimized|structuring|flexi\s+plan|flexible\s+benefit/ },
  { topic: "fixed-variable-split",  match: /(?:fixed.*variable|variable.*fixed|fixed\s+and\s+(?:the\s+)?variable|breakup|\bsplit\b).*(?:how\s+much|what(?:'s| is)|tell\s+me|help\s+me\s+understand|comfort)|(?:how\s+much|what(?:'s| is)|tell\s+me|help\s+me\s+understand|comfort).*(?:fixed.*variable|variable.*fixed|fixed\s+and\s+(?:the\s+)?variable|breakup|\bsplit\b)|(?:share|give|provide|walk\s+me\s+through|explain|tell\s+me|can\s+you|could\s+you|what(?:'?s| is)|need|want)\s+(?:me\s+|us\s+)?(?:the\s+|a\s+|an\s+)?(?:break(?:down|up)|split|structure|components?)\b|(?:break(?:down|up)|split|structure|components?)\s+of\s+(?:the\s+|this\s+|that\s+|\d)|summari[sz]e\s+(?:the\s+)?offer|recap\s+(?:the\s+)?offer|what\s+is\s+(?:the\s+)?base\b|base\s*,?\s*variable\s*,?\s*bonus/ },
  { topic: "budget-disclosure",     match: /\bbudget\b|what(?:'s| is)\s+(?:the\s+)?(?:range|band)|what\s+can\s+you\s+offer|what\s+number\s+can\s+you\s+give|final\s+offer|room\s+to\s+negotiate|any\s+room/ },
  { topic: "range-grade-leverage",  match: /broad\s+range|share.*range|range\s+(?:for|at)|\bgrade\b|\blevel\b|maximum.*offer|max.*offer|market\s+(?:salary|range)|why.*lower|revisit\s+(?:compensation|grade|level)/ },
  { topic: "channel-switch",        match: /over\s+a\s+call|on\s+a\s+call|on\s+the\s+phone|switch\s+to|email\s+instead|in\s+writing|in\s+person|face\s+to\s+face|\bf2f\b/ },
  { topic: "meta-coaching",         match: /what\s+should\s+i\s+say|what\s+do\s+i\s+say|should\s+i\s+say|help\s+me\s+phrase|how\s+do\s+i\s+answer/ },
];

/**
 * Pure intent classifier. Returns the first matching topic or `null` if
 * no pattern fires. Lowercases internally so callers can pass raw input.
 */
export function classifyCandidateQuestion(
  raw: string | null | undefined,
): CandidateQuestionTopic | null {
  if (!raw) return null;
  const r = raw.toLowerCase();
  /* PDF#37 BUG-F (2026-05-20) — disambiguate vesting+buyout compound.
   * The `esop-structure` pattern fires on bare `vesting|cliff`, which
   * captures a question like "what about buyout — does notice vesting
   * apply here?" as ESOP-structure even though the candidate is
   * asking about notice-period buyout. When the input mentions BOTH
   * an equity token AND a notice/buyout token, prefer `notice-buyout`
   * — buyout is the rarer, more specific intent and the equity word
   * is usually being borrowed metaphorically (or co-occurring as a
   * separate clause the reactive-followup layer will pick up next).
   * Pure precedence flip is wrong (would mis-route plain "what's the
   * vesting schedule"); the compound test runs ONLY when both signal
   * families are present. */
  const hasBuyout = /\bnotice\b|buyout|early\s+join|early.*joining|\bserve\b/.test(r);
  const hasEquity = /\b(?:esop|rsu)\b|equity|exercise\s+price|vesting|cliff/.test(r);
  if (hasBuyout && hasEquity) return "notice-buyout";
  for (const { topic, match } of INTENT_PATTERNS) {
    if (match.test(r)) return topic;
  }
  return null;
}

/* ─── Response bank ─────────────────────────────────────────────────── */

/**
 * Per-topic recruiter prose. The base string is the sector-neutral /
 * round-neutral default. Optional `sectorOverrides` and `roundOverrides`
 * tilt the prose for known persona combinations — e.g. a BFSI HR partner
 * answers ESOP differently from an early-startup hiring manager.
 *
 * Overrides are sparse on purpose: only override when the base wording
 * is materially wrong for that persona. Most topics need no override.
 */
interface ResponseBankEntry {
  base: string;
  sectorOverrides?: Partial<Record<RecruiterSectorPersona, string>>;
  roundOverrides?: Partial<Record<NegotiationRoundPersona, string>>;
}

const RESPONSE_BANK: Record<CandidateQuestionTopic, ResponseBankEntry> = {
  "esop-structure": {
    base:
      "On the ESOP piece — equity is reported separately from cash CTC: the offer letter splits fixed, variable, and ESOPs with the vesting schedule and cliff. So you'll see the cash component as guaranteed and the ESOP as a 4-year grant on top.",
    sectorOverrides: {
      "early-startup":
        "On the ESOP piece — at this stage equity is a meaningful chunk of the total: the offer letter shows fixed, variable, and ESOPs separately with a 4-year vest and a 1-year cliff. The cash sits where the market is; the ESOP is the upside if we get to the next round.",
      "bfsi":
        "On the ESOP piece — we don't run ESOPs at this grade; comp is structured as fixed plus performance-linked variable. If equity exposure matters to you, I should flag that upfront so you can weigh it against the cash strength.",
      "it-services":
        "On the ESOP piece — ESOPs aren't part of the standard grade structure here; the comp is fixed plus a performance bonus. The offer letter will reflect that and the bonus criteria are documented separately.",
    },
  },
  "fixed-variable-split": {
    base:
      "On the structure — the breakup will include fixed cash, variable target (paid quarterly against KPIs), and ESOPs as a separate component. Are you comfortable with that shape, or would you want me to size the fixed harder against the variable?",
  },
  "budget-disclosure": {
    base:
      "On the budget — I can't share the full internal band, but the fitment sits in a defined corridor for this grade. If you can share even a rough target, I'll tell you straight away whether we're broadly aligned.",
    roundOverrides: {
      "director":
        "On the budget — at this level the fitment isn't a single number, it's a corridor we move inside based on the panel's read of you. Give me a rough target and I'll tell you if we're in the same zip code.",
    },
  },
  "in-hand-monthly": {
    base:
      "On the in-hand piece — the monthly take-home depends on your tax declarations and structuring (HRA, LTA, NPS), so the offer letter will show a band rather than a single number. We can walk through the structuring sheet once the fitment is locked.",
  },
  "review-cycle": {
    base:
      "On the review piece — the next appraisal cycle is anchored to the company calendar, and joiners are usually eligible on a pro-rated basis once they've crossed the qualifying tenure. I can have the cycle dates and eligibility rule confirmed in writing alongside the offer.",
  },
  "location-remote": {
    base:
      "On the location piece — the fitment doesn't change for remote or different-city, but the allowance structure (HRA, location pay) does shift to match the policy for that city. I can pull the city-wise structuring before we lock the offer.",
  },
  "verification-bgv": {
    base:
      "Noted on the verification piece — slips can come at the formal BGV stage. For now let's first align on whether the range works for you, and then I'll move it through the panel.",
  },
  "benefits-non-ctc": {
    base:
      "On the benefits piece — beyond cash CTC there's group medical (self + family), gratuity, PF as per statute, and a few flexi allowances under the structuring envelope. I can share the full benefits sheet alongside the offer letter.",
  },
  "notice-buyout": {
    base:
      "On the notice piece — buyout support is case-by-case and tied to the urgency from the hiring side. If they want an early join, I can take the buyout ask to the panel with your notice-period letter as evidence.",
  },
  "variable-mechanics": {
    base:
      "On the variable piece — variable is target-based, not guaranteed: payout sits between 0 and 200% of target against KPIs that get locked in the first quarter. The split between individual and company KPIs varies by grade — I can have the comp team share the policy doc once you're onboarded.",
  },
  "range-grade-leverage": {
    base:
      "On the range piece — I can't put an internal band on the table, but the fitment moves with the grade we've slotted you against. If you can share even a rough target, I'll tell you straight away whether we're broadly aligned, and I can take it back to the panel if there's a gap.",
  },
  "tax-structuring": {
    base:
      "On the structuring piece — the breakup is built around the standard flexi plan (HRA, LTA, NPS, meal card). It's not aggressively optimised but it covers the usual heads. Once we lock the fitment I can have the structuring sheet shared so you can plan your declarations.",
  },
  "channel-switch": {
    base:
      "Happy to take this on a call — let me set up a time once I've taken your range back to the panel. We can close the open points faster on a call than over email.",
  },
  "meta-coaching": {
    /* Defensive: candidate is asking the recruiter for coaching mid-call.
     * Recruiter doesn't coach — redirects to the actual question. */
    base:
      "I'll let you frame it the way you're comfortable — just share what's true for you and we'll work from there.",
  },
};

/**
 * Render the recruiter's deterministic response for a classified topic.
 * Resolution precedence: roundOverride → sectorOverride → base.
 *
 * Called from `_canonical-prose.ts` after `classifyCandidateQuestion`
 * fires. Returns `null` when the topic has no entry — the caller should
 * fall back to the safe generic ack.
 */
export function renderCandidateQuestionResponse(
  topic: CandidateQuestionTopic,
  sector: RecruiterSectorPersona | null | undefined,
  round: NegotiationRoundPersona | null | undefined,
): string | null {
  const entry = RESPONSE_BANK[topic];
  if (!entry) return null;
  if (round && entry.roundOverrides?.[round]) {
    return entry.roundOverrides[round] ?? null;
  }
  if (sector && entry.sectorOverrides?.[sector]) {
    return entry.sectorOverrides[sector] ?? null;
  }
  return entry.base;
}

/**
 * Generic fallback used when no pattern classifies and no LLM is in play.
 * Centralised so the canonical-prose layer doesn't hand-roll the string.
 */
export const CANDIDATE_QUESTION_GENERIC_FALLBACK =
  "Happy to address that — let me come back to where we were.";
