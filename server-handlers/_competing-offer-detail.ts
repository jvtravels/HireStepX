/* Competing-offer detail parser — Phase 16 (2026-05-13).
 *
 * The kernel pre-Phase-16 stored `competingOffer: number | null` — just
 * the magnitude. But India-market recruiters routinely probe:
 *   - Which company is the offer from?
 *   - Is it verbal, on email, or a signed letter?
 *   - What stage are you at with them (interviewing / offered / signed)?
 *   - Can you share the offer letter for verification?
 *
 * Pre-Phase-16 the kernel had none of this. The candidate-side audit
 * matrix flagged 7 of 10 E-section (competing-offer) questions as
 * NOT HANDLED. This module extracts the available signals into a
 * structured record so the LLM brief surfaces them.
 *
 * Patterns are conservative — false positives here would teach the
 * kernel a company name or status the candidate didn't actually state.
 * We pattern-match recognised company names (top India hiring brands)
 * and stop-words for status / stage. */

export type CompetingOfferStatus =
  /** Spoken word only — no written confirmation. */
  | "verbal"
  /** Recruiter-side email confirming the number, often pre-letter. */
  | "email"
  /** Formal offer letter received. */
  | "letter"
  /** Candidate has signed / accepted, but hasn't joined. */
  | "signed";

export type CompetingOfferStage =
  /** Still in interviews. */
  | "interviewing"
  /** Offer extended, candidate deciding. */
  | "offered"
  /** Candidate has accepted/signed. */
  | "accepted";

export interface CompetingOfferDetail {
  /** Company name (lowercase, normalized). Null when not stated or
   *  unrecognized. */
  company: string | null;
  /** Status of the competing offer paperwork. */
  status: CompetingOfferStatus | null;
  /** Stage in the competing pipeline. */
  stage: CompetingOfferStage | null;
  /** Did candidate explicitly offer to share / forward the offer letter? */
  letterShareOffered: boolean;
  /** Convenience flag. */
  hasAny: boolean;
}

const EMPTY: CompetingOfferDetail = {
  company: null,
  status: null,
  stage: null,
  letterShareOffered: false,
  hasAny: false,
};

/* Recognized India-market hiring brands. Patterns require word boundaries
 * to avoid catching substrings (e.g. "tcs" inside other words). */
const COMPANY_PATTERNS: { canonical: string; pattern: RegExp }[] = [
  { canonical: "google", pattern: /\b(?:google|goog)\b/i },
  { canonical: "microsoft", pattern: /\b(?:microsoft|msft|ms)\b(?!\s*(?:office|word|excel|teams))/i },
  { canonical: "amazon", pattern: /\b(?:amazon|aws)\b/i },
  { canonical: "meta", pattern: /\b(?:meta|facebook|fb)\b/i },
  { canonical: "apple", pattern: /\b(?:apple)\b/i },
  { canonical: "flipkart", pattern: /\b(?:flipkart|fkt)\b/i },
  { canonical: "swiggy", pattern: /\b(?:swiggy)\b/i },
  { canonical: "zomato", pattern: /\b(?:zomato)\b/i },
  { canonical: "paytm", pattern: /\b(?:paytm)\b/i },
  { canonical: "phonepe", pattern: /\b(?:phonepe|phone\s*pe)\b/i },
  { canonical: "razorpay", pattern: /\b(?:razorpay)\b/i },
  { canonical: "cred", pattern: /\b(?:cred)\b/i },
  { canonical: "uber", pattern: /\b(?:uber)\b/i },
  { canonical: "ola", pattern: /\b(?:ola\s+cabs?|ola)\b/i },
  { canonical: "tcs", pattern: /\b(?:tcs|tata\s+consultancy)\b/i },
  { canonical: "infosys", pattern: /\b(?:infosys|infy)\b/i },
  { canonical: "wipro", pattern: /\b(?:wipro)\b/i },
  { canonical: "accenture", pattern: /\b(?:accenture|acn)\b/i },
  { canonical: "deloitte", pattern: /\b(?:deloitte)\b/i },
  { canonical: "cognizant", pattern: /\b(?:cognizant|ctsh)\b/i },
  { canonical: "myntra", pattern: /\b(?:myntra)\b/i },
  { canonical: "byju's", pattern: /\b(?:byju.?s?|byjus)\b/i },
  { canonical: "unacademy", pattern: /\b(?:unacademy)\b/i },
  { canonical: "razorpay", pattern: /\b(?:razorpay)\b/i },
  { canonical: "atlassian", pattern: /\b(?:atlassian)\b/i },
  { canonical: "salesforce", pattern: /\b(?:salesforce|sfdc)\b/i },
  { canonical: "oracle", pattern: /\b(?:oracle)\b/i },
  { canonical: "sap", pattern: /\b(?:sap)\b/i },
  { canonical: "adobe", pattern: /\b(?:adobe)\b/i },
  { canonical: "intuit", pattern: /\b(?:intuit)\b/i },
];

const STATUS_PATTERNS: { kind: CompetingOfferStatus; pattern: RegExp }[] = [
  {
    kind: "signed",
    pattern: /\b(?:signed\s+(?:the\s+)?(?:offer|letter|contract)|already\s+(?:signed|accepted)|accepted\s+(?:their|the)\s+offer)\b/i,
  },
  {
    kind: "letter",
    pattern: /\b(?:offer\s+letter|written\s+offer|formal\s+offer|received\s+(?:the\s+)?letter|letter\s+(?:in\s+hand|received))\b/i,
  },
  {
    kind: "email",
    pattern: /\b(?:offer\s+(?:on\s+)?email|email(?:ed)?\s+(?:the\s+)?offer|written\s+(?:on\s+)?email|email\s+confirmation)\b/i,
  },
  {
    kind: "verbal",
    pattern: /\b(?:verbal(?:ly)?\s+(?:offered|confirmed)|verbal\s+offer|over\s+(?:the\s+)?phone|on\s+(?:the\s+)?call|told\s+me\s+(?:they.?ll|the\s+number))\b/i,
  },
];

const STAGE_PATTERNS: { kind: CompetingOfferStage; pattern: RegExp }[] = [
  {
    kind: "accepted",
    pattern: /\b(?:i.?ve\s+accepted|already\s+accepted|signed\s+with\s+them|joining\s+them)\b/i,
  },
  {
    kind: "offered",
    pattern: /\b(?:have\s+an?\s+offer|offer\s+(?:in\s+hand|extended|on\s+the\s+table)|offered\s+(?:by|me)|received\s+(?:an?\s+)?offer)\b/i,
  },
  {
    kind: "interviewing",
    pattern: /\b(?:interviewing\s+(?:with|at)|final\s+round|in\s+(?:the\s+)?process|(?:talking|in\s+conversation)\s+with|hr\s+round|technical\s+round|last\s+round)\b/i,
  },
];

const LETTER_SHARE_PATTERNS = [
  /\b(?:happy\s+to\s+share|can\s+share\s+(?:the\s+)?(?:letter|offer)|will\s+(?:share|forward)\s+(?:the\s+)?(?:letter|offer)|forward\s+(?:you\s+)?the\s+(?:letter|offer)|attach\s+(?:the\s+)?(?:letter|offer))\b/i,
];

export function extractCompetingOfferDetail(text: string): CompetingOfferDetail {
  if (!text) return EMPTY;

  let company: string | null = null;
  for (const { canonical, pattern } of COMPANY_PATTERNS) {
    if (pattern.test(text)) {
      company = canonical;
      break;
    }
  }

  let status: CompetingOfferStatus | null = null;
  for (const { kind, pattern } of STATUS_PATTERNS) {
    if (pattern.test(text)) {
      status = kind;
      break;
    }
  }

  let stage: CompetingOfferStage | null = null;
  for (const { kind, pattern } of STAGE_PATTERNS) {
    if (pattern.test(text)) {
      stage = kind;
      break;
    }
  }

  const letterShareOffered = LETTER_SHARE_PATTERNS.some((p) => p.test(text));

  const hasAny =
    company != null || status != null || stage != null || letterShareOffered;
  return { company, status, stage, letterShareOffered, hasAny };
}

export function mergeCompetingOfferDetail(
  prior: CompetingOfferDetail | null | undefined,
  next: CompetingOfferDetail,
): CompetingOfferDetail {
  const p = prior ?? EMPTY;
  const merged: CompetingOfferDetail = {
    company: next.company ?? p.company,
    status: next.status ?? p.status,
    stage: next.stage ?? p.stage,
    letterShareOffered: p.letterShareOffered || next.letterShareOffered,
    hasAny: false,
  };
  merged.hasAny =
    merged.company != null ||
    merged.status != null ||
    merged.stage != null ||
    merged.letterShareOffered;
  return merged;
}
