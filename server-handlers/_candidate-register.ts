/* Candidate register classifier (2026-05-29 realism pass — Fix #3).
 *
 * Reads the candidate's last-N utterances and infers a coarse register:
 *
 *   formal  — "kindly", "I would like", "respectfully", sir/madam, long
 *             courteous sentences. Common from PSU candidates, fresh
 *             grads, candidates whose English is precise-but-stiff.
 *
 *   casual  — "yeah", "tbh", "btw", "hop on", contractions everywhere,
 *             short conversational sentences. Common from startup ICs,
 *             younger candidates, anyone comfortable enough to drop
 *             the formality scaffolding.
 *
 *   direct  — short, imperative, no hedging. "Just tell me the number."
 *             "What's base?" Common from senior IC / staff-level folks,
 *             founder-track candidates, anyone who's tired of dancing.
 *
 *   neutral — default; falls here when signals are mixed or thin.
 *
 * The recruiter mirroring this back is the realism win: a "kindly share
 * the structuring" candidate gets "I'll get the structuring sheet
 * across, sir" rather than "yeah I'll shoot it over." Mismatch reads as
 * tone-deafness.
 *
 * Classification is over the last 5 candidate utterances; signal weights
 * are tuned so a single matching token is suggestive but not conclusive
 * (≥2 hits flips from neutral). The classifier is pure — no I/O — and
 * idempotent, so applyCandidateAnswer can re-run it on every turn
 * without churn risk.
 *
 * State integration: stamped onto NegotiationState.candidateRegister in
 * the kernel reducer (defaults to "neutral", recomputed each turn).
 * Consumed downstream by the humanizer (tic selection) and optionally
 * the candidate-question variant picker. */

export type CandidateRegister = "formal" | "casual" | "direct" | "neutral";

/* Vocabulary signals. Order matters only for grouping; scoring is set-
 * based and case-insensitive. Each list element is a regex fragment
 * that gets joined with `|` and wrapped in `\b...\b`. */
const FORMAL_PATTERNS: readonly string[] = [
  "sir",
  "madam",
  "ma'?am",
  "kindly",
  "respectfully",
  "i\\s+would\\s+like",
  "i\\s+wish\\s+to",
  "may\\s+i\\s+(?:please\\s+)?(?:know|ask|request)",
  "would\\s+(?:it\\s+be\\s+)?possible",
  "i\\s+humbly\\s+request",
  "hereby",
  "as\\s+per\\s+(?:your|the)",
  "regarding\\s+the",
  "in\\s+this\\s+regard",
  "i\\s+would\\s+be\\s+grateful",
  "could\\s+you\\s+please",
  "i\\s+have\\s+to\\s+mention",
];

const CASUAL_PATTERNS: readonly string[] = [
  "yeah",
  "yep",
  "yup",
  "btw",
  "tbh",
  "ngl",
  "imo",
  "imho",
  "lol",
  "lmao",
  "haha+",
  "hey\\s+(?:there|hi)",
  "cool",
  "no\\s+worries",
  "no\\s+stress",
  "hop\\s+on",
  "shoot\\s+(?:me|it)",
  "kinda",
  "sorta",
  "gotcha",
  "got\\s+it",
  "for\\s+sure",
  "totally",
  "fam",
  "bro",
  "dude",
  "thanks\\s+(?:man|buddy)",
];

const DIRECT_PATTERNS: readonly string[] = [
  /* Bare imperatives + minimal interrogatives. */
  "just\\s+tell\\s+me",
  "give\\s+me\\s+the",
  "what'?s\\s+the\\s+(?:number|base|offer|ctc)",
  "tell\\s+me\\s+straight",
  "don'?t\\s+(?:dance|sugarcoat|beat\\s+around)",
  "skip\\s+the",
  "cut\\s+to\\s+the",
  "bottom\\s+line",
  "let'?s\\s+(?:not\\s+waste|get\\s+to\\s+it|do\\s+this)",
  /* Single-word affirmative/negative shapes used as full responses. */
  "^no\\b",
  "^pass\\b",
];

function buildPatternRe(patterns: readonly string[]): RegExp {
  return new RegExp(`\\b(?:${patterns.join("|")})\\b`, "i");
}

const FORMAL_RE = buildPatternRe(FORMAL_PATTERNS);
const CASUAL_RE = buildPatternRe(CASUAL_PATTERNS);
const DIRECT_RE = buildPatternRe(DIRECT_PATTERNS);

/* Token-count helper for "is this utterance terse?" detection — part
 * of the direct-register signal. Strips punctuation, splits on
 * whitespace, drops empties. */
function tokenCount(text: string): number {
  return (text || "")
    .replace(/[?!.,;:()'"–—-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/* Per-utterance scoring. Returns +1 in each bucket the utterance hits
 * a pattern; a single utterance can register in multiple buckets if
 * it mixes signals (rare but legal). The terse-shape bonus only fires
 * when the utterance is ≤6 tokens AND ends with a question mark or
 * full stop — gates out one-word affirmatives like "ok". */
function scoreUtterance(text: string): {
  formal: number;
  casual: number;
  direct: number;
} {
  const t = (text || "").trim();
  if (!t) return { formal: 0, casual: 0, direct: 0 };

  const formal = FORMAL_RE.test(t) ? 1 : 0;
  const casual = CASUAL_RE.test(t) ? 1 : 0;
  let direct = DIRECT_RE.test(t) ? 1 : 0;

  /* Terse-and-pointed bonus for direct. ≤6 tokens AND ends with `?`
   * AND isn't just a single greeting/affirmative. */
  const tokens = tokenCount(t);
  if (
    tokens >= 2
    && tokens <= 6
    && /\?\s*$/.test(t)
    && !/^(?:hi|hello|hey|ok|okay|sure|thanks)\b/i.test(t)
  ) {
    direct += 1;
  }

  return { formal, casual, direct };
}

/* Aggregate the last N candidate utterances into a single register. */
export function classifyCandidateRegister(
  utterances: readonly string[],
  windowSize: number = 5,
): CandidateRegister {
  if (!utterances || utterances.length === 0) return "neutral";
  const window = utterances.slice(-windowSize);

  let formal = 0;
  let casual = 0;
  let direct = 0;
  for (const u of window) {
    const s = scoreUtterance(u);
    formal += s.formal;
    casual += s.casual;
    direct += s.direct;
  }

  /* Decision rule: pick the bucket with the highest score IF it
   * cleared the threshold (≥2). Ties → neutral. A single hit is
   * suggestive but not enough to commit. */
  const THRESHOLD = 2;
  const scores: Array<[CandidateRegister, number]> = [
    ["formal", formal],
    ["casual", casual],
    ["direct", direct],
  ];
  scores.sort((a, b) => b[1] - a[1]);
  const [topKind, topScore] = scores[0];
  const [, secondScore] = scores[1];
  if (topScore < THRESHOLD) return "neutral";
  if (topScore === secondScore) return "neutral";
  return topKind;
}

/* Convenience: classify directly from a NegotiationState's
 * conversationLog. Walks the log once, extracts candidate utterances
 * in order. Kept here (not in the kernel) so the kernel doesn't need
 * to know the scoring details. */
export function classifyFromLog(
  log: readonly { speaker: string; text?: string }[] | undefined,
): CandidateRegister {
  if (!log || log.length === 0) return "neutral";
  const utterances: string[] = [];
  for (const entry of log) {
    if (entry.speaker === "candidate" && typeof entry.text === "string") {
      utterances.push(entry.text);
    }
  }
  return classifyCandidateRegister(utterances);
}
