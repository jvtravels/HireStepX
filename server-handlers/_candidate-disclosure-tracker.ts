/* PDF #18 root-cause (2026-05-15) — candidate-disclosure ack tracker.
 *
 * Real session: candidate said "I have 90 days notice" on turn 4 and
 * the bot's next reply ignored it entirely (restated benefits instead).
 * Root cause: the kernel folded the disclosure into state
 * (noticeJoining.noticePeriodDays) but nothing forced the NEXT bot
 * turn to acknowledge it. Existing pendingPromises infrastructure
 * tracks BOT promises only; there was no symmetric mechanism for
 * candidate-disclosed facts.
 *
 * This module detects candidate-disclosed facts and produces a list
 * of pending-acknowledgement labels. The brief surfaces them as
 * [CANDIDATE DISCLOSED — ACKNOWLEDGE THIS TURN: ...] so the LLM must
 * address them. Pure, no IO.
 *
 * Scope (initial ship — PDF #18):
 *   - notice period in days
 *   - current CTC
 *   - competing offer presence
 *   - joining date / availability
 *
 * Extension pattern: each new disclosure type adds:
 *   1. A detector regex (or detector function).
 *   2. An acknowledgement-detector regex (does bot reply address it?).
 *   3. An entry in CANDIDATE_DISCLOSURES below. */

export type CandidateDisclosureKind =
  | "notice-period"
  | "current-ctc"
  | "competing-offer"
  | "joining-date"
  /* PDF #28 (2026-06-07) — captures candidate's CURRENT employer name
   * so deflection prose can distinguish target-company references
   * from current-company references. */
  | "current-company";

export interface CandidateDisclosureEntry {
  kind: CandidateDisclosureKind;
  /** Compact label surfaced in the brief, e.g. "notice period 90 days". */
  label: string;
  /** PDF #28 (2026-06-07) — parsed numeric value (e.g. 44 for "44 LPA",
   *  90 for "90 days notice"). Optional; only present when the detector
   *  captured a number. Kernel writes this into the matching state slot
   *  (candidateCurrentCtc / noticePeriodDays) when the slot is null,
   *  closing the gap between disclosure-detection and fact-persistence
   *  that caused the CTC re-ask bug. */
  parsedValue?: number;
  /** PDF #28 (2026-06-07) — parsed string value, used by current-company
   *  to carry the captured employer name into candidateCurrentCompany. */
  parsedString?: string;
}

interface DisclosureRule {
  kind: CandidateDisclosureKind;
  /** Detects disclosure in a candidate utterance. May extract a number
   *  (returned as the label suffix). Returns null when not present. */
  detect: (candidateUtterance: string) => { label: string; parsedValue?: number; parsedString?: string } | null;
  /** Detects whether a bot reply acknowledges this disclosure. */
  acknowledge: (botReply: string) => boolean;
}

/* PDF #28 (2026-06-07) — precision guard for current-CTC detection.
 *
 * The current-CTC regex below matches "my current ctc is 44 LPA". But
 * candidates also say things like "I'm asking for 44 LPA", "expected
 * CTC is 50", "I want a 60 LPA package" — those are TARGET asks, not
 * CURRENT comp. If the disclosure tracker writes those into
 * candidateCurrentCtc the kernel will think the candidate already
 * earns their target ask, and the entire negotiation math collapses.
 *
 * This guard inspects the utterance for target-ask intent words near
 * the regex match. If any are present, refuse to fire current-CTC. */
const TARGET_ASK_INTENT_RE = /\b(?:asking|ask\s+for|want(?:ing)?|expected|expect|looking\s+for|targeting|aim(?:ing)?\s+for|hoping\s+for|need|require|seeking|aspiring|seeking|i'?d\s+like|i\s+would\s+like)\b/i;

const NOTICE_RE = /\b(\d{1,3})\s*(?:day|days)\s+(?:notice|notice\s+period)\b|\bnotice\s+period\s+(?:is|of)\s+(\d{1,3})\s*(?:day|days)?\b|\b(\d{1,3})[-\s]?day\s+notice\b/i;
const CURRENT_CTC_RE = /\b(?:current(?:ly)?(?:\s+at)?(?:\s+earning)?|present(?:ly)?(?:\s+at)?|my\s+current(?:\s+ctc|\s+package)?|currently\s+making)\s+(?:is\s+|at\s+)?(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(?:l|lpa|lakh|lakhs)\b/i;
const COMPETING_RE = /\b(?:competing|other|another|second)\s+offer\b|\bi\s+have\s+(?:an?\s+)?offer\s+from\b|\boffer\s+from\s+\w+\s+(?:at|of|for)\b/i;
const JOINING_RE = /\b(?:can\s+join|able\s+to\s+join|joining\s+(?:on|by|after|in|date))\b|\b(?:available\s+(?:to\s+join|from))\b/i;
/* PDF #28 (2026-06-07) — current-employer detector.
 *
 * Matches utterances where the candidate names their CURRENT employer:
 *   "I'm at Razorpay", "I am with Walmart", "currently at Swiggy",
 *   "my current company is Flipkart", "working at Zomato".
 *
 * Captures the company name (a capitalised word, 1–3 tokens). The
 * trailing word boundary tolerates ".", ",", " as", " in", " for",
 * " since", " where" so we don't capture trailing prose.
 *
 * Refuses to fire on past-tense ("worked at", "was at", "previously at")
 * and on neutral mentions ("I admire Razorpay's culture") via the
 * intro-phrase anchor. */
const CURRENT_COMPANY_RE = /\b(?:i(?:'m| am)(?:\s+(?:currently|presently))?\s+(?:at|with|working\s+at|working\s+with)|currently\s+(?:at|with|working\s+at|working\s+with)|my\s+current\s+(?:company|employer|org(?:anisation|anization)?)\s+(?:is|are)|i\s+work\s+(?:at|with))\s+([A-Z][A-Za-z0-9&.\-]+(?:\s+[A-Z][A-Za-z0-9&.\-]+){0,2})(?=\s*(?:[,.\s]|as\b|in\b|for\b|since\b|where\b|$))/;

const ACK_NOTICE_RE = /\bnotice\s+(?:period|days)|\b\d{1,3}\s*(?:day|days)\s+notice\b|\bbuyout\b|\bearly\s+(?:join|release)\b/i;
const ACK_CURRENT_RE = /\bcurrent\s+(?:ctc|package|salary|comp)|\bhike\s+(?:of|on)\b|\b\d+(?:\.\d+)?\s*l(?:pa)?\s+to\s+\d+(?:\.\d+)?\s*l(?:pa)?\b/i;
const ACK_COMPETING_RE = /\bcompeting\s+offer|\bother\s+offer|\bbeat\s+(?:the|that|their)\s+offer|\bmatch\s+(?:the|that|their)\s+offer\b/i;
const ACK_JOINING_RE = /\bjoining\s+(?:date|day|by)|\bstart\s+date\b|\bonboard\s+(?:on|by)\b|\bearly\s+join\b/i;
/* current-company ack: bot references the captured employer name OR
 * says "your current side / employer / role" in a non-deflective way. */
const ACK_CURRENT_COMPANY_RE = /\byour\s+current\s+(?:side|employer|company|role|comp|comp\.)\b|\bover\s+(?:at|with)\s+your\s+side\b/i;

const CANDIDATE_DISCLOSURES: DisclosureRule[] = [
  {
    kind: "notice-period",
    detect: (u) => {
      const m = u.match(NOTICE_RE);
      if (!m) return null;
      const n = m[1] || m[2] || m[3];
      if (!n) return { label: "notice period" };
      const parsed = parseInt(n, 10);
      return {
        label: `notice period ${n} days`,
        parsedValue: Number.isFinite(parsed) ? parsed : undefined,
      };
    },
    acknowledge: (b) => ACK_NOTICE_RE.test(b),
  },
  {
    kind: "current-ctc",
    detect: (u) => {
      const m = u.match(CURRENT_CTC_RE);
      if (!m) return null;
      /* PDF #28 precision guard — refuse if utterance signals a target
       * ask, not a current-comp disclosure. Without this guard,
       * "I'm asking for 44 LPA" would set candidateCurrentCtc=44 and
       * break hike-percent math and target/current logic downstream. */
      if (TARGET_ASK_INTENT_RE.test(u)) return null;
      const parsed = parseFloat(m[1]);
      return {
        label: `current CTC ${m[1]} LPA`,
        parsedValue: Number.isFinite(parsed) ? parsed : undefined,
      };
    },
    acknowledge: (b) => ACK_CURRENT_RE.test(b),
  },
  {
    kind: "competing-offer",
    detect: (u) => (COMPETING_RE.test(u) ? { label: "competing offer disclosed" } : null),
    acknowledge: (b) => ACK_COMPETING_RE.test(b),
  },
  {
    kind: "joining-date",
    detect: (u) => (JOINING_RE.test(u) ? { label: "joining date / availability" } : null),
    acknowledge: (b) => ACK_JOINING_RE.test(b),
  },
  {
    kind: "current-company",
    detect: (u) => {
      /* PDF #28 precision guard — refuse on past-tense / negation context.
       * "I worked at Razorpay" / "I was at Walmart" / "I left Swiggy
       * last year" should not register as CURRENT employer. */
      if (/\b(?:worked\s+at|was\s+at|used\s+to\s+(?:work|be)\s+at|previously\s+(?:at|with)|former(?:ly)?\s+(?:at|with)|left|quit|resigned\s+from|ex[-\s])\b/i.test(u)) {
        return null;
      }
      const m = u.match(CURRENT_COMPANY_RE);
      if (!m) return null;
      const name = m[1]?.trim();
      if (!name || name.length < 2 || name.length > 40) return null;
      return { label: `current employer ${name}`, parsedString: name };
    },
    acknowledge: (b) => ACK_CURRENT_COMPANY_RE.test(b),
  },
];

/** Detect any candidate disclosures in a single utterance. Returns the
 *  list of (kind, label) entries. Pure. */
export function detectCandidateDisclosures(
  candidateUtterance: string | null | undefined,
): CandidateDisclosureEntry[] {
  if (!candidateUtterance || typeof candidateUtterance !== "string") return [];
  const out: CandidateDisclosureEntry[] = [];
  const seen = new Set<CandidateDisclosureKind>();
  for (const rule of CANDIDATE_DISCLOSURES) {
    if (seen.has(rule.kind)) continue;
    const hit = rule.detect(candidateUtterance);
    if (hit) {
      const entry: CandidateDisclosureEntry = { kind: rule.kind, label: hit.label };
      if (typeof hit.parsedValue === "number") entry.parsedValue = hit.parsedValue;
      if (typeof hit.parsedString === "string") entry.parsedString = hit.parsedString;
      out.push(entry);
      seen.add(rule.kind);
    }
  }
  return out;
}

/** Filter a list of pending acknowledgements down to those the bot
 *  reply did NOT address. Pure. */
export function pruneAcknowledged(
  pending: CandidateDisclosureEntry[] | null | undefined,
  botReply: string | null | undefined,
): CandidateDisclosureEntry[] {
  if (!pending || pending.length === 0) return [];
  if (!botReply || typeof botReply !== "string") return pending.slice();
  const remaining: CandidateDisclosureEntry[] = [];
  for (const entry of pending) {
    const rule = CANDIDATE_DISCLOSURES.find((r) => r.kind === entry.kind);
    if (!rule) continue;
    if (rule.acknowledge(botReply)) continue;
    remaining.push(entry);
  }
  return remaining;
}
