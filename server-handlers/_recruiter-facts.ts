/* Recruiter-side fact tracker (Bug 7, 2026-05-14).
 *
 * Failure mode: same benefits paragraph repeated four turns in a row.
 * The LLM (or fallback) was citing PF + medical insurance + leave
 * policy + variable structure every turn the candidate engaged
 * benefits — even after we'd already said it.
 *
 * Fix: extract a small token set from each bot turn that we can
 * carry on kernel state and feed back into the brief so the LLM
 * sees "ALREADY-STATED FACTS: medical-insurance, pf, gratuity" and
 * is instructed not to restate them.
 *
 * Tokens are coarse-grained on purpose — we want anti-repetition, not
 * a structured benefits log. Token set is closed (defined here),
 * additions go through code review. */

export type RecruiterFactToken =
  | "medical-insurance"
  | "pf"
  | "gratuity"
  | "learning-platform"
  | "paid-time-off"
  | "hybrid-work"
  | "variable-component"
  | "fixed-variable-split"
  | "performance-review"
  | "sick-leave"
  | "privilege-leave";

export const RECRUITER_FACT_TOKENS: RecruiterFactToken[] = [
  "medical-insurance",
  "pf",
  "gratuity",
  "learning-platform",
  "paid-time-off",
  "hybrid-work",
  "variable-component",
  "fixed-variable-split",
  "performance-review",
  "sick-leave",
  "privilege-leave",
];

const TOKEN_PATTERNS: Array<{ token: RecruiterFactToken; pattern: RegExp }> = [
  { token: "medical-insurance", pattern: /\b(medical\s+insurance|health\s+insurance|family\s+floater|medi[-\s]?claim|gmc|hospitali[sz]ation)\b/i },
  { token: "pf", pattern: /\b(provident\s+fund|\bpf\b|epfo|employee\s+pf)\b/i },
  { token: "gratuity", pattern: /\bgratuity\b/i },
  { token: "learning-platform", pattern: /\b(learning\s+(?:platform|stipend|budget|allowance)|udemy|coursera|pluralsight|upskilling\s+budget)\b/i },
  { token: "paid-time-off", pattern: /\b(paid\s+time\s+off|annual\s+leave|earned\s+leave|\bel\b|vacation\s+days)\b/i },
  { token: "hybrid-work", pattern: /\b(hybrid\s+(?:work|model)|wfh|work\s+from\s+home|remote\s+work|3\s+days\s+(?:in[-\s]?office|wfh))\b/i },
  { token: "variable-component", pattern: /\b(variable\s+(?:component|pay|bonus|portion)|annual\s+bonus|performance\s+bonus)\b/i },
  { token: "fixed-variable-split", pattern: /\b(fixed[-\s]?(?:vs|\/|to|and)[-\s]?variable|\d{1,2}\s*[-/]\s*\d{1,2}\s+split|base\s+plus\s+variable)\b/i },
  { token: "performance-review", pattern: /\b(performance\s+review|annual\s+review|appraisal\s+cycle|review\s+cycle|salary\s+review)\b/i },
  { token: "sick-leave", pattern: /\b(sick\s+leave|\bsl\b\s+(?:days?|policy)|casual\s+leave|\bcl\b\s+(?:days?|policy))\b/i },
  { token: "privilege-leave", pattern: /\b(privilege\s+leave|\bpl\b\s+(?:days?|policy))\b/i },
];

/** Extract recruiter-fact tokens mentioned in a bot turn. */
export function extractRecruiterFacts(botReply: string | null | undefined): RecruiterFactToken[] {
  if (!botReply || typeof botReply !== "string") return [];
  const hits: RecruiterFactToken[] = [];
  for (const { token, pattern } of TOKEN_PATTERNS) {
    if (pattern.test(botReply)) hits.push(token);
  }
  return hits;
}

/* Bug 5 (2026-05-14) — in-hand specificity detector.
 *
 * When the candidate asks for in-hand monthly / take-home / net salary,
 * the bot must give a concrete ₹/month estimate, not a percentage.
 * Detector triggers on the standard phrasings; the invariant test
 * asserts the bot reply contains a ₹-numeric pattern. */
const IN_HAND_PATTERNS: RegExp[] = [
  /\bin[-\s]?hand\b/i,
  /\btake[-\s]?home\b/i,
  /\bnet\s+salary\b/i,
  /\bmonthly\s+(?:net|take|in\s*hand|salary)\b/i,
  /\bafter\s+deductions\b/i,
  /\bafter\s+tax(?:es)?\b/i,
  /\bnet\s+(?:pay|monthly)\b/i,
];

export function detectInHandRequest(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return false;
  for (const p of IN_HAND_PATTERNS) if (p.test(text)) return true;
  return false;
}

/** Convenience: returns true if `botReply` contains an explicit ₹ /
 *  LPA / lakh / k numeric figure. Used by the in-hand invariant test. */
export function containsRupeeAmount(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return false;
  if (/₹\s*\d{1,2},?\d{2,3},?\d{3}/.test(text)) return true;
  if (/₹\s*\d+(?:\.\d+)?\s*(?:l|lpa|lakh|lakhs|k)/i.test(text)) return true;
  if (/\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l\b|lkhs?)/i.test(text)) return true;
  if (/\binr\s*\d/i.test(text)) return true;
  if (/\d{1,3}(?:,\d{3})+/.test(text)) return true;
  return false;
}

/* Fix 3 (2026-05-15) — Promise-keeping enforcement.
 *
 * Real session: bot said "we can discuss the variable payout structure"
 * across 3 turns and never delivered the numbers. extractRecruiterPromises
 * parses bot turns for open promises; extractPromisesFulfilled checks
 * whether the latest reply delivered substantive (numerical or factual)
 * content for a pending promise.
 *
 * Returned promises are short normalized subject strings (the captured
 * group after the cue verb, lowercased, trimmed, sentence-terminator
 * stripped). */
const PROMISE_PATTERNS: RegExp[] = [
  /\bwe\s+can\s+(?:definitely\s+|certainly\s+|surely\s+)?(?:discuss|share|dive\s+into|walk\s+you\s+through|explain|break\s+down|cover|talk\s+about|get\s+into)\s+([^.,;!?\n]{1,80})/gi,
  /\blet\s+me\s+(?:share|walk\s+you\s+through|explain|break\s+down|get\s+back\s+(?:to\s+you\s+)?(?:on|with))\s+([^.,;!?\n]{1,80})/gi,
  /\bi(?:'|'|\s+wi)ll\s+(?:share|send|provide|get\s+back\s+to\s+you\s+(?:on|with)|loop\s+back\s+(?:on|with)|circle\s+back\s+(?:on|with))\s+([^.,;!?\n]{1,80})/gi,
  /\bwe(?:'|'|\s+wi)ll\s+(?:share|send|provide|cover|walk\s+through|dive\s+into|get\s+to)\s+([^.,;!?\n]{1,80})/gi,
  /\b(?:happy\s+to|glad\s+to)\s+(?:share|walk\s+through|dive\s+into|explain|cover)\s+([^.,;!?\n]{1,80})/gi,
];

function normalizePromiseSubject(s: string): string {
  return s.toLowerCase().replace(/[.,;:!?]$/g, "").replace(/\s+/g, " ").trim();
}

/** Extract open promises from a bot turn. Returned values are short
 *  normalised subject strings. Pure. */
export function extractRecruiterPromises(botReply: string | null | undefined): string[] {
  if (!botReply || typeof botReply !== "string") return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const re of PROMISE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(botReply)) !== null) {
      const subj = normalizePromiseSubject(m[1] || "");
      if (subj.length < 3) continue;
      if (seen.has(subj)) continue;
      seen.add(subj);
      out.push(subj);
    }
  }
  return out;
}

/** Given a list of pending promises and a fresh bot reply, return the
 *  subset that are FULFILLED — the subject's keyword appears in the
 *  reply alongside substantive (numerical OR factual-noun) content.
 *  Substantive = a digit, a percent sign, an LPA/₹ figure, OR a
 *  factual noun pattern. The bar is intentionally low — any one of
 *  those signals is enough to consider the promise honoured. */
const SUBSTANTIVE_FACT_PATTERNS: RegExp[] = [
  /\d/,
  /\b\d{1,3}\s*%/,
  /\b(monthly|quarterly|annually|yearly|four[-\s]year|three[-\s]year|six[-\s]month|twelve[-\s]month)\b/i,
];

function hasSubstantiveContent(text: string): boolean {
  if (containsRupeeAmount(text)) return true;
  for (const p of SUBSTANTIVE_FACT_PATTERNS) if (p.test(text)) return true;
  return false;
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 3);
}

/** Return the subset of `pendingPromises` that the current reply
 *  substantively addresses. Pure. */
export function extractPromisesFulfilled(
  pendingPromises: string[] | null | undefined,
  botReply: string | null | undefined,
): string[] {
  if (!pendingPromises || pendingPromises.length === 0) return [];
  if (!botReply || typeof botReply !== "string") return [];
  if (!hasSubstantiveContent(botReply)) return [];
  const replyTokens = new Set(tokenize(botReply));
  const out: string[] = [];
  for (const promise of pendingPromises) {
    const ptokens = tokenize(promise);
    if (ptokens.length === 0) continue;
    /* Require at least one informative subject token to appear in the
     * reply. Stopword-like fragments (e.g. "the", "of") are already
     * filtered by the length>=3 cut. */
    const hit = ptokens.some(t => replyTokens.has(t));
    if (hit) out.push(promise);
  }
  return out;
}

/* Fix 4 (2026-05-15) — Full-message-repetition detector.
 *
 * Anti-repetition only tracked benefit tokens; in a real session the bot
 * sent the IDENTICAL reply two turns in a row. Word-shingle Jaccard at
 * 5-word shingles, threshold 0.65.
 *
 * Pure. */
function shingles(text: string, k = 5): Set<string> {
  const tokens = (text || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  if (tokens.length < k) {
    out.add(tokens.join(" "));
    return out;
  }
  for (let i = 0; i <= tokens.length - k; i++) {
    out.add(tokens.slice(i, i + k).join(" "));
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface BotReplyRepetitionResult {
  repeated: boolean;
  similarity: number;
}

export const BOT_REPLY_REPETITION_THRESHOLD = 0.65;

export function detectBotReplyRepetition(
  currentReply: string,
  lastReply: string | null,
): BotReplyRepetitionResult {
  if (!lastReply || !currentReply) return { repeated: false, similarity: 0 };
  const a = shingles(currentReply);
  const b = shingles(lastReply);
  const sim = jaccard(a, b);
  return { repeated: sim >= BOT_REPLY_REPETITION_THRESHOLD, similarity: sim };
}
