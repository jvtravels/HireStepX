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

/* finding #110 (2026-06-20) — current-CTC clauses. A candidate's stated
 * CURRENT pay ("currently at 48 LPA", "current CTC is 48", "I'm at 48
 * fixed") is NEVER the competing-offer amount. We blank these spans
 * before scanning for a number so a current-CTC figure can't be
 * mis-attributed as the rival offer — even when a genuine competing
 * company is named elsewhere in the same utterance. The authoritative
 * current/target/competing split lives in the number-role classifier;
 * this extractor must not contradict it by re-reading the candidate's
 * own current pay as a rival's number. */
const CURRENT_CTC_CLAUSE_RE =
  /\b(?:currently|presently|right\s+now)\s+(?:at|on|drawing|making|earning|getting|taking\s+home)\s+₹?\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l|cr|crores?)?(?:\s+(?:fixed|total|ctc))?|\bcurrent\s+(?:ctc|salary|comp|compensation|package|fixed|pay)\s+(?:is\s+)?₹?\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l|cr|crores?)?|\bi\s*(?:'?m|\s+am)\s+(?:currently\s+)?(?:at|on|drawing|making|earning)\s+₹?\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l|cr|crores?)?|\b(?:i\s+(?:make|earn|draw|take\s+home))\s+₹?\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l|cr|crores?)?/gi;

function maskCurrentCtcClauses(text: string): string {
  return text.replace(CURRENT_CTC_CLAUSE_RE, (m) => " ".repeat(m.length));
}

function extractCompetingAmount(
  text: string,
  hasCompetingContext: boolean,
  hasNamedCompany: boolean,
): number | null {
  /* Require ANY competing-offer contextual signal in the same utterance:
   *   - a recognised company name OR a status/stage pattern (caller
   *     passes hasCompetingContext=true), OR
   *   - one of the dedicated "their offer" / "competing offer" markers. */
  if (!hasCompetingContext && !COMPETING_AMOUNT_CONTEXT_RE.test(text)) return null;
  /* finding #110 — blank current-CTC spans so a stated current pay can
   * never surface as the competing amount. */
  const scan = maskCurrentCtcClauses(text);
  const cr = AMOUNT_CR_RE.exec(scan);
  if (cr && cr[1]) {
    const n = parseFloat(cr[1]);
    if (Number.isFinite(n)) return n * 100;
  }
  const lpa = AMOUNT_LPA_RE.exec(scan);
  if (lpa && lpa[1]) {
    const n = parseFloat(lpa[1]);
    if (Number.isFinite(n)) return n;
  }
  /* S19-B1 (2026-07-22) — bare number fallback for "at N" / "for N" pattern.
   * "I have an offer from Zomato at 38, can you match it?" sets company="zomato"
   * and stage="offered" but the amount "38" has no LPA/lakh suffix, so
   * AMOUNT_LPA_RE returns null. Guard: requires hasNamedCompany (not just any
   * hasCompetingContext) because status="letter" alone (from "offer letter" in an
   * acceptance utterance like "move ahead with the offer letter") also sets
   * hasCompetingContext=true and would falsely extract "24.5" from the fitment
   * figure in the same sentence. A status-only signal without a named company is
   * too ambiguous — "our offer letter" vs "their offer letter" — to safely read
   * a bare number as the competing amount.
   * Negative lookahead excludes AM/PM clock-time matches ("interview at 10am"). */
  if (hasNamedCompany) {
    const bare = /\b(?:at|for|of)\s+(?:₹\s*)?(\d+(?:\.\d+)?)\b(?!\s*(?:am|pm|a\.m\.|p\.m\.))/i.exec(scan);
    if (bare && bare[1]) {
      const n = parseFloat(bare[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
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

/* OA-B65 — competing-offer REVOCATION (the candidate withdraws their own
 * BATNA: "that offer fell through", "they backed out", "it's off the table
 * now"). Distinct from ON_HOLD (delayed / frozen but still real): a revoked
 * offer carries NO leverage, so the kernel must clear the numeric
 * competingOffer entirely, not merely flag it weakened. Kept revocation-
 * specific in wording; the kernel additionally gates the clear on an offer
 * actually being on record, so a stray match is a harmless no-op. */
const REVOKED_PATTERNS: RegExp[] = [
  /\b(?:offer|it|that|they|the\s+other\s+one)\s+(?:has\s+|had\s+|just\s+|'s\s+|s\s+)?(?:fell|fallen|falls)\s+(?:through|apart|out)\b/i,
  /\b(?:offer\s+)?(?:fell|fallen)\s+(?:through|apart)\b/i,
  /\b(?:no\s+longer\s+(?:on\s+the\s+table|valid|available|an\s+option)|off\s+the\s+table(?:\s+now)?|not\s+(?:happening|going\s+(?:ahead|through))(?:\s+anymore)?)\b/i,
  /\b(?:they|recruiter|company)\s+(?:backed|pulled|dropped)\s+out\b/i,
  /\b(?:backed|pulled|dropped)\s+out\s+(?:of\s+)?(?:the\s+|that\s+|their\s+)?offer\b/i,
  /\b(?:offer\s+(?:got\s+|was\s+|has\s+been\s+)?(?:rescinded|revoked|withdrawn|cancell?ed|retracted|pulled))\b/i,
];

/** OA-B65 — true when this utterance withdraws a previously-stated competing
 *  offer. Single source of truth for the kernel's leverage-clear. */
export function isCompetingOfferRevoked(text: string): boolean {
  if (!text) return false;
  return REVOKED_PATTERNS.some((p) => p.test(text));
}

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
  { canonical: "atlassian", pattern: /\b(?:atlassian)\b/i },
  { canonical: "salesforce", pattern: /\b(?:salesforce|sfdc)\b/i },
  { canonical: "oracle", pattern: /\b(?:oracle)\b/i },
  { canonical: "sap", pattern: /\b(?:sap)\b/i },
  { canonical: "adobe", pattern: /\b(?:adobe)\b/i },
  { canonical: "intuit", pattern: /\b(?:intuit)\b/i },
  /* S40-B3 (2026-07-23) — Indian startup brands missing from the list.
   * Candidates routinely cite these as competing offers; without a match
   * the company field stays null, hasConcreteTell() never fires, and the
   * fake-leverage-challenge probe is never armed. */
  { canonical: "meesho", pattern: /\b(?:meesho)\b/i },
  { canonical: "nykaa", pattern: /\b(?:nykaa)\b/i },
  { canonical: "zepto", pattern: /\b(?:zepto)\b/i },
  { canonical: "blinkit", pattern: /\b(?:blinkit|grofers)\b/i },
  { canonical: "groww", pattern: /\b(?:groww)\b/i },
  { canonical: "oyo", pattern: /\b(?:oyo(?:\s+rooms?)?)\b/i },
  { canonical: "dream11", pattern: /\b(?:dream\s*11|dream\s*xi)\b/i },
  { canonical: "mpl", pattern: /\b(?:mpl|mobile\s+premier\s+league)\b/i },
  { canonical: "slice", pattern: /\b(?:slice\s+(?:pay|card|fintech)?|slicepay)\b/i },
  { canonical: "jar", pattern: /\b(?:jar\s+(?:app)?)\b/i },
  { canonical: "juspay", pattern: /\b(?:juspay)\b/i },
  { canonical: "dunzo", pattern: /\b(?:dunzo)\b/i },
  { canonical: "urban-company", pattern: /\b(?:urban\s+company|urban\s+clap|urbanclap)\b/i },
  { canonical: "vedantu", pattern: /\b(?:vedantu)\b/i },
  { canonical: "physics-wallah", pattern: /\b(?:physics\s+wallah|pw(?:\s+(?:live|app))?)\b/i },
  { canonical: "mfine", pattern: /\b(?:mfine)\b/i },
  { canonical: "licious", pattern: /\b(?:licious)\b/i },
  { canonical: "porter", pattern: /\b(?:porter(?:\s+(?:delivery|logistics))?)\b/i },
  { canonical: "purplle", pattern: /\b(?:purplle)\b/i },
  { canonical: "healthkart", pattern: /\b(?:healthkart|hk\s+vitals)\b/i },
  { canonical: "sharechat", pattern: /\b(?:sharechat|moj)\b/i },
  { canonical: "dailyhunt", pattern: /\b(?:dailyhunt|verse\s+innovation)\b/i },
  { canonical: "logitech", pattern: /\b(?:logitech)\b/i },
  { canonical: "nutanix", pattern: /\b(?:nutanix)\b/i },
  { canonical: "rubrik", pattern: /\b(?:rubrik)\b/i },
  { canonical: "palo-alto", pattern: /\b(?:palo\s*alto\s*networks|palo\s*alto)\b/i },
  { canonical: "crowdstrike", pattern: /\b(?:crowdstrike)\b/i },
  { canonical: "servicenow", pattern: /\b(?:servicenow)\b/i },
  { canonical: "workday", pattern: /\b(?:workday)\b/i },
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
 * candidate to re-state everything in a single sentence.
 *
 * S19-B1/B3 (2026-07-22) — stage "offered"/"accepted" is accepted as an
 * alternative to status. "I have an offer from Zomato at 38" extracts
 * stage="offered" but status=null (no verbal/email/letter word). Without
 * this arm, hasConcreteTell always returned false for the most common
 * disclosure pattern — at counterRound>=1 the defensive ladder (comparative-
 * anchoring) fired instead of fake-leverage-challenge, ignoring the
 * competing offer entirely. "interviewing" is explicitly excluded because
 * the candidate is still in process and has no offer yet. */
export function hasConcreteTell(detail: CompetingOfferDetail | null | undefined): boolean {
  if (!detail) return false;
  const hasConcreteStage = detail.stage === "offered" || detail.stage === "accepted";
  return (
    detail.company != null &&
    detail.amount != null &&
    (detail.status != null || hasConcreteStage)
  );
}

/* finding #110 (2026-06-20) — canonicalize a free-text company name to a
 * COMPANY_PATTERNS key (or null if unrecognized). Used to suppress the
 * HIRING company from ever being read as a COMPETING-offer company:
 * "for this role at Flipkart, I'm targeting 65" must not register
 * Flipkart — the employer we're negotiating WITH — as a rival offer. */
export function canonicalizeCompany(name: string | null | undefined): string | null {
  if (!name) return null;
  for (const { canonical, pattern } of COMPANY_PATTERNS) {
    if (pattern.test(name)) return canonical;
  }
  return null;
}

/* finding #114 (2026-06-20) — branded display names. COMPANY_PATTERNS
 * keys are lowercase canonical forms used for matching; rendering them
 * verbatim leaks "flipkart"/"tcs"/"phonepe" into recruiter prose. This
 * map restores the brand casing (acronyms upper, camel brands intact);
 * unknown values fall back to word-wise title-case. */
const COMPANY_DISPLAY: Record<string, string> = {
  google: "Google", microsoft: "Microsoft", amazon: "Amazon", meta: "Meta",
  apple: "Apple", flipkart: "Flipkart", swiggy: "Swiggy", zomato: "Zomato",
  paytm: "Paytm", phonepe: "PhonePe", razorpay: "Razorpay", cred: "CRED",
  uber: "Uber", ola: "Ola", tcs: "TCS", infosys: "Infosys", wipro: "Wipro",
  accenture: "Accenture", deloitte: "Deloitte", cognizant: "Cognizant",
  myntra: "Myntra", "byju's": "BYJU'S", unacademy: "Unacademy",
  atlassian: "Atlassian", salesforce: "Salesforce", oracle: "Oracle",
  sap: "SAP", adobe: "Adobe", intuit: "Intuit",
  meesho: "Meesho", nykaa: "Nykaa", zepto: "Zepto", blinkit: "Blinkit",
  groww: "Groww", oyo: "OYO", dream11: "Dream11", mpl: "MPL",
  slice: "Slice", jar: "Jar", juspay: "Juspay", dunzo: "Dunzo",
  "urban-company": "Urban Company", vedantu: "Vedantu",
  "physics-wallah": "Physics Wallah", mfine: "mfine", licious: "Licious",
  porter: "Porter", purplle: "Purplle", healthkart: "HealthKart",
  sharechat: "ShareChat", dailyhunt: "Dailyhunt", logitech: "Logitech",
  nutanix: "Nutanix", rubrik: "Rubrik", "palo-alto": "Palo Alto Networks",
  crowdstrike: "CrowdStrike", servicenow: "ServiceNow", workday: "Workday",
};

export function displayCompany(name: string | null | undefined): string {
  if (!name) return "";
  const key = name.trim().toLowerCase();
  if (COMPANY_DISPLAY[key]) return COMPANY_DISPLAY[key];
  return name
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function extractCompetingOfferDetail(
  text: string,
  /** finding #110 — the company we're hiring for. When it matches a
   *  recognised brand it is excluded from competing-company detection so
   *  the candidate's reference to THIS role's employer ("for this role at
   *  Flipkart") is never mis-read as a competing offer. */
  hiringCompany?: string | null,
): CompetingOfferDetail {
  if (!text) return EMPTY;

  const hiringCanonical = canonicalizeCompany(hiringCompany);

  let company: string | null = null;
  for (const { canonical, pattern } of COMPANY_PATTERNS) {
    /* finding #110 — never read the HIRING company as a competing offer.
     * Skip it and keep scanning for a genuinely different company (a real
     * rival offer mentioned in the same utterance still resolves). */
    if (hiringCanonical != null && canonical === hiringCanonical) continue;
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
  const amount = extractCompetingAmount(text, hasCompetingContext, company != null);

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
  /* Crack 2.5 (2026-05-17) — proofProvided ONLY flips on
   * PROOF_SHARE_PATTERNS match (already handled by parseCompetingOfferDetail).
   * The prior auto-flip on hasConcreteTell(merged) conflated the lever's
   * ARMING condition with its SUPPRESSION condition, permanently
   * suppressing fake-leverage-challenge the moment it became applicable.
   * hasConcreteTell is now the planner's arming gate, not a suppression
   * trigger here. */
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
