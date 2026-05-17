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
  /** fake-leverage-challenge (2026-05-17) — magnitude of the competing
   *  offer in LPA when stated in this utterance (e.g. "30 LPA",
   *  "32 lakhs"). Accumulates last-stated-wins across turns so the
   *  hasConcreteTell() predicate (which gates fake-leverage-challenge)
   *  can be satisfied via dribbled disclosure: company at T14, amount at
   *  T16, status at T18. Distinct from the legacy top-level
   *  state.competingOffer scalar — that one may have come from a
   *  recruiter-side rumour or canonical fact pack; this one is the
   *  amount the candidate themselves uttered alongside other tells.
   *  Optional for back-compat with fixtures / serialized snapshots
   *  constructed before the field shipped. */
  amount?: number | null;
  /** Did candidate explicitly offer to share / forward the offer letter? */
  letterShareOffered: boolean;
  /** Phase 27 — competing offer is on hold / revoked / joining frozen.
   *  Materially weakens the candidate's leverage (the "I have another
   *  offer at ₹X" anchor is no longer a credible alternative). */
  onHold: boolean;
  /** fake-leverage-challenge (2026-05-17) — turn index at which the AI
   *  asked the candidate to share the offer letter (or redacted
   *  version). Null until the lever fires; stamped once by applyAiMove.
   *  Drives single-fire of the challenge and gates `proofProvided`
   *  detection in subsequent candidate utterances. */
  proofRequestedAtTurn: number | null;
  /** fake-leverage-challenge (2026-05-17) — candidate complied with the
   *  proof request: shared (or offered to share) an offer letter /
   *  redacted PDF / concrete amount+company+status. Monotone-up. */
  proofProvided: boolean;
  /** Convenience flag. */
  hasAny: boolean;
}

const EMPTY: CompetingOfferDetail = {
  company: null,
  status: null,
  stage: null,
  amount: null,
  letterShareOffered: false,
  onHold: false,
  proofRequestedAtTurn: null,
  proofProvided: false,
  hasAny: false,
};

/* fake-leverage-challenge (2026-05-17) — competing-offer amount in LPA.
 * Recognised forms: "30 LPA", "32 lakhs", "1.5 cr", "1 crore". We
 * normalise crore→LPA (×100). Conservative: a stray "L" without preceding
 * digit is ignored.
 *
 * Contextual gating: candidates routinely state numbers that AREN'T
 * about a competing offer — their own target ("I'm hoping for 26 LPA"),
 * their current CTC ("currently at 18 LPA"), or a market reference
 * ("market is 32 LPA"). We only treat a number as the competing-offer
 * amount when the same utterance ALSO surfaces a competing-offer cue
 * (company name, status/stage pattern, or one of the dedicated
 * "their offer" / "competing offer" / "other offer" markers below).
 * This keeps the dribbled-disclosure path working — company at T14,
 * "their number is 32 LPA" at T16, status at T18 — while preventing
 * the candidate's OWN target/current-CTC from being mis-extracted as
 * the competing amount and falsely satisfying hasConcreteTell. */
const AMOUNT_LPA_RE = /\b(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l)\b/i;
const AMOUNT_CR_RE = /\b(\d+(?:\.\d+)?)\s*(?:cr|crore)s?\b/i;
const COMPETING_AMOUNT_CONTEXT_RE =
  /\b(?:their|other|another|competing|alternate|alternative)\s+(?:offer|number|comp|ctc|package|amount|figure|range)\b|\b(?:offer|number|comp|ctc|package)\s+(?:from\s+them|on\s+the\s+table|in\s+hand)\b|\bthey\s+(?:offered|are\s+offering|gave|will\s+give|will\s+pay|mentioned|said|told\s+me|quoted)\b|\bthe\s+(?:number|offer|amount|figure)\s+(?:being\s+)?discussed\b/i;

function extractCompetingAmount(
  text: string,
  hasCompetingContext: boolean,
): number | null {
  /* Require ANY competing-offer contextual signal in the same utterance:
   *   - a recognised company name OR a status/stage pattern (caller
   *     passes hasCompetingContext=true), OR
   *   - one of the dedicated "their offer" / "competing offer" markers. */
  if (!hasCompetingContext && !COMPETING_AMOUNT_CONTEXT_RE.test(text)) return null;
  const cr = AMOUNT_CR_RE.exec(text);
  if (cr && cr[1]) {
    const n = parseFloat(cr[1]);
    if (Number.isFinite(n)) return n * 100;
  }
  const lpa = AMOUNT_LPA_RE.exec(text);
  if (lpa && lpa[1]) {
    const n = parseFloat(lpa[1]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/* Phase 27 — competing offer on hold / revoked / joining frozen.
 * Common India patterns: BGV pending, joining date pushed, offer
 * rescinded after hiring freeze. Materially weakens the leverage of
 * a stated competing number. */
const ON_HOLD_PATTERNS: RegExp[] = [
  /\b(?:joining\s+(?:is\s+)?(?:on\s+hold|frozen|delayed|pushed|deferred|postponed))\b/i,
  /\b(?:offer\s+(?:is\s+)?(?:on\s+hold|rescinded|revoked|withdrawn|frozen|delayed))\b/i,
  /\b(?:hiring\s+freeze|joining\s+date\s+(?:moved|pushed|delayed))\b/i,
  /\b(?:bgv|background\s+(?:check|verification))\s+(?:is\s+)?(?:pending|delayed|stuck|on\s+hold)/i,
  /\b(?:they.?ve\s+(?:put|placed)\s+(?:my\s+)?(?:offer|joining)\s+on\s+hold|put\s+on\s+hold)\b/i,
];

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

/* fake-leverage-challenge (2026-05-17) — proof-share signals. When the
 * AI has asked for the offer letter (state.competingOfferDetail
 * .proofRequestedAtTurn != null) and the candidate responds with one of
 * these patterns, the leverage signal is corroborated (real candidate)
 * vs. dodged (bluff). Patterns are intentionally broad — sharing intent,
 * file-type tells (PDF/screenshot), or "redacted" qualifier all count. */
const PROOF_SHARE_PATTERNS: RegExp[] = [
  /\b(?:here.?s|attaching|sending|sharing|share|send\s+you)\s+(?:the\s+|a\s+|my\s+)?(?:offer|letter|pdf|screenshot)\b/i,
  /\b(?:offer\s+letter|redacted\s+(?:version|copy|offer|letter)|redacted\s+pdf)\b/i,
  /\b(?:pdf|screenshot)\s+of\s+(?:the\s+|my\s+)?(?:offer|letter)\b/i,
  /\b(?:i.?ll|i\s+will|can|will)\s+(?:send|share|forward|attach)\s+(?:you\s+)?(?:the\s+|a\s+|my\s+)?(?:offer|letter|pdf|redacted)\b/i,
];

/* fake-leverage-challenge (2026-05-17) — concrete-tell detection.
 *
 * A candidate who has surfaced amount + company + status has internalised
 * the offer (real bluffers stay vague). Originally this required all
 * three in ONE utterance, but real candidates dribble: company at T14,
 * amount at T16, status at T18. The mergeCompetingOfferDetail folder
 * already accumulates these across turns — the predicate was just
 * reading the wrong source (per-utterance extraction). This now reads
 * the ACCUMULATED CompetingOfferDetail (the merged state object) so a
 * dribbled disclosure satisfies the predicate without forcing the
 * candidate to re-state everything in a single sentence. */
export function hasConcreteTell(detail: CompetingOfferDetail | null | undefined): boolean {
  if (!detail) return false;
  return detail.company != null && detail.status != null && detail.amount != null;
}

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
  const onHold = ON_HOLD_PATTERNS.some((p) => p.test(text));
  /* fake-leverage-challenge (2026-05-17) — only extract amount when
   * there's a competing-offer context cue in the same utterance.
   * Otherwise the candidate's own target / current CTC / market quote
   * would be mis-attributed as the competing-offer amount. */
  const hasCompetingContext = company != null || status != null || stage != null;
  const amount = extractCompetingAmount(text, hasCompetingContext);

  /* fake-leverage-challenge — proofProvided at PARSE time only fires on
   * an explicit proof-share pattern (offer letter / redacted PDF /
   * screenshot). The accumulated-concrete-tell heuristic was previously
   * applied here against the single-utterance extraction; that gated
   * the planner on impossible single-turn co-occurrence and missed the
   * realistic dribbled-disclosure path. The concrete-tell contribution
   * is now applied in mergeCompetingOfferDetail() against the merged
   * record so it reads accumulated state, not the latest utterance. */
  const proofProvided = PROOF_SHARE_PATTERNS.some((p) => p.test(text));

  const hasAny =
    company != null ||
    status != null ||
    stage != null ||
    amount != null ||
    letterShareOffered ||
    onHold ||
    proofProvided;
  return {
    company,
    status,
    stage,
    amount,
    letterShareOffered,
    onHold,
    proofRequestedAtTurn: null,
    proofProvided,
    hasAny,
  };
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
    /* fake-leverage-challenge (2026-05-17) — amount is last-stated-wins
     * so the candidate can revise (e.g. "actually it's 32 LPA not 30"),
     * but if the latest utterance didn't restate a number, the prior
     * accumulated value is preserved. */
    amount: next.amount ?? p.amount ?? null,
    letterShareOffered: p.letterShareOffered || next.letterShareOffered,
    /* Phase 27 — onHold is monotone-up. Once the recruiter knows the
     * competing offer is shaky, the leverage damage persists even if
     * the candidate later claims it's "back on track". */
    onHold: p.onHold || next.onHold,
    /* fake-leverage-challenge (2026-05-17) — proofRequestedAtTurn is
     * stamped by applyAiMove (never by the parser); preserve the prior
     * state value. proofProvided is monotone-up. */
    proofRequestedAtTurn: p.proofRequestedAtTurn ?? next.proofRequestedAtTurn ?? null,
    proofProvided: p.proofProvided || next.proofProvided,
    hasAny: false,
  };
  /* fake-leverage-challenge (2026-05-17) — apply concrete-tell against
   * the ACCUMULATED record (not the per-turn extraction). This is the
   * dribbled-disclosure fix: company at T14, amount at T16, status at
   * T18 → proofProvided fires at T18. Sticky once true. */
  if (!merged.proofProvided && hasConcreteTell(merged)) {
    merged.proofProvided = true;
  }
  merged.hasAny =
    merged.company != null ||
    merged.status != null ||
    merged.stage != null ||
    merged.amount != null ||
    merged.letterShareOffered ||
    merged.onHold ||
    merged.proofProvided;
  return merged;
}
