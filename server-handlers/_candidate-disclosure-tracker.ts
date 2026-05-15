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
  | "joining-date";

export interface CandidateDisclosureEntry {
  kind: CandidateDisclosureKind;
  /** Compact label surfaced in the brief, e.g. "notice period 90 days". */
  label: string;
}

interface DisclosureRule {
  kind: CandidateDisclosureKind;
  /** Detects disclosure in a candidate utterance. May extract a number
   *  (returned as the label suffix). Returns null when not present. */
  detect: (candidateUtterance: string) => string | null;
  /** Detects whether a bot reply acknowledges this disclosure. */
  acknowledge: (botReply: string) => boolean;
}

const NOTICE_RE = /\b(\d{1,3})\s*(?:day|days)\s+(?:notice|notice\s+period)\b|\bnotice\s+period\s+(?:is|of)\s+(\d{1,3})\s*(?:day|days)?\b|\b(\d{1,3})[-\s]?day\s+notice\b/i;
const CURRENT_CTC_RE = /\b(?:current(?:ly)?(?:\s+at)?(?:\s+earning)?|present(?:ly)?(?:\s+at)?|my\s+current(?:\s+ctc|\s+package)?|currently\s+making)\s+(?:is\s+|at\s+)?(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(?:l|lpa|lakh|lakhs)\b/i;
const COMPETING_RE = /\b(?:competing|other|another|second)\s+offer\b|\bi\s+have\s+(?:an?\s+)?offer\s+from\b|\boffer\s+from\s+\w+\s+(?:at|of|for)\b/i;
const JOINING_RE = /\b(?:can\s+join|able\s+to\s+join|joining\s+(?:on|by|after|in|date))\b|\b(?:available\s+(?:to\s+join|from))\b/i;

const ACK_NOTICE_RE = /\bnotice\s+(?:period|days)|\b\d{1,3}\s*(?:day|days)\s+notice\b|\bbuyout\b|\bearly\s+(?:join|release)\b/i;
const ACK_CURRENT_RE = /\bcurrent\s+(?:ctc|package|salary|comp)|\bhike\s+(?:of|on)\b|\b\d+(?:\.\d+)?\s*l(?:pa)?\s+to\s+\d+(?:\.\d+)?\s*l(?:pa)?\b/i;
const ACK_COMPETING_RE = /\bcompeting\s+offer|\bother\s+offer|\bbeat\s+(?:the|that|their)\s+offer|\bmatch\s+(?:the|that|their)\s+offer\b/i;
const ACK_JOINING_RE = /\bjoining\s+(?:date|day|by)|\bstart\s+date\b|\bonboard\s+(?:on|by)\b|\bearly\s+join\b/i;

const CANDIDATE_DISCLOSURES: DisclosureRule[] = [
  {
    kind: "notice-period",
    detect: (u) => {
      const m = u.match(NOTICE_RE);
      if (!m) return null;
      const n = m[1] || m[2] || m[3];
      return n ? `notice period ${n} days` : "notice period";
    },
    acknowledge: (b) => ACK_NOTICE_RE.test(b),
  },
  {
    kind: "current-ctc",
    detect: (u) => {
      const m = u.match(CURRENT_CTC_RE);
      if (!m) return null;
      return `current CTC ${m[1]} LPA`;
    },
    acknowledge: (b) => ACK_CURRENT_RE.test(b),
  },
  {
    kind: "competing-offer",
    detect: (u) => (COMPETING_RE.test(u) ? "competing offer disclosed" : null),
    acknowledge: (b) => ACK_COMPETING_RE.test(b),
  },
  {
    kind: "joining-date",
    detect: (u) => (JOINING_RE.test(u) ? "joining date / availability" : null),
    acknowledge: (b) => ACK_JOINING_RE.test(b),
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
    const label = rule.detect(candidateUtterance);
    if (label) {
      out.push({ kind: rule.kind, label });
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
