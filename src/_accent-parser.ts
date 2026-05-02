/* HireStepX — Accent extraction for editorial question headings
 *
 * Two-strategy pipeline:
 *
 *   1. extractAccentMarkup(text) → parses LLM-marked `*asterisk*` markup.
 *      Preferred path. Used by interviewAPI.ts when ingesting LLM
 *      questions — runs once per question at fetch time and stores the
 *      result on InterviewStep.accentSplit.
 *
 *   2. pickAccent(text) → heuristic fallback. Used by Interview.tsx at
 *      render time when no accentSplit field is present (older cached
 *      questions, fallback scripts, malformed LLM output). Two-stage:
 *      pattern match against 24 known interview-question shapes, then
 *      scoring fallback that prefers action verbs and editorial-priority
 *      words while skipping proper nouns and stopwords.
 *
 * Both return `{ before, accent, after }` ready to feed to
 * CanvasEditorialHeading. A null return = "no decent accent found,
 * render the plain heading instead." Better no accent than a bad one.
 *
 * Lives in its own file so it's testable without spinning up React,
 * the engine, or the API client. See src/__tests__/accentParser.test.ts.
 */

export interface AccentSplit {
  before: string;
  accent: string;
  after: string;
}

/* ─── extractAccentMarkup — LLM-marked path ──────────────────────── */

const ACCENT_MARKUP_STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "to", "of", "in",
  "on", "at", "by", "for", "with", "and", "or", "but", "you", "your",
  "i", "me", "my", "we", "our",
]);

/**
 * Extract italic-copper accent markup from question text.
 *
 * The LLM is prompted to wrap one emphasis word per question in
 * `*asterisks*` (markdown style). This parses the first such marker,
 * splits the question into `{before, accent, after}`, and returns the
 * cleaned text with markup stripped.
 *
 * Defensive parsing — if the LLM emits zero, multiple, or malformed
 * markers, returns the cleaned text without an accentSplit. The UI
 * then falls back to pickAccent() so the heading still renders.
 *
 * Patterns rejected:
 *   - Multi-word accents (`*lead a team*`) → won't match (regex enforces single token)
 *   - Accents > 24 chars → likely LLM ran away with markup
 *   - Markers spanning sentence boundaries
 *   - Accent word that's a stopword (a, the, is, etc.)
 */
export function extractAccentMarkup(text: string): {
  cleaned: string;
  accentSplit?: AccentSplit;
} {
  if (!text) return { cleaned: "" };
  // Strip a leading bracketed persona tag like "[HR Partner] " before scanning,
  // but preserve it in cleaned so panel personas still render correctly.
  const personaMatch = text.match(/^(\[[^\]]+\]\s*)/);
  const personaPrefix = personaMatch?.[1] ?? "";
  const body = text.slice(personaPrefix.length);

  // Match the first single-word *asterisk* marker. Allows hyphens/apostrophes.
  const markerRegex = /\*([\p{L}][\p{L}\p{N}'-]{0,23})\*/u;
  const m = body.match(markerRegex);
  if (!m || typeof m.index !== "number") {
    return { cleaned: stripStrayAsterisks(text) };
  }
  const accent = m[1];
  if (!accent || accent.length < 2 || ACCENT_MARKUP_STOPWORDS.has(accent.toLowerCase())) {
    return { cleaned: stripStrayAsterisks(text) };
  }
  const beforeBody = body.slice(0, m.index).replace(/\s+$/, "");
  const afterBody = body
    .slice(m.index + m[0].length)
    .replace(/^\s+/, "")
    .replace(/[.!?]+\s*$/, "");

  const cleaned = stripStrayAsterisks(personaPrefix + body.replace(markerRegex, accent));

  return {
    cleaned,
    accentSplit: { before: personaPrefix + beforeBody, accent, after: afterBody },
  };
}

/** Defensive: strip any unmatched asterisks the LLM may have left behind. */
function stripStrayAsterisks(text: string): string {
  return text.replace(/\*+/g, "");
}

/* ─── pickAccent — heuristic fallback ────────────────────────────── */

/** Words we love as accents — verbs of doing + emotionally-loaded nouns. */
const ACCENT_PRIORITY = new Set([
  // editorial nouns
  "time", "decision", "challenge", "conflict", "mistake", "failure", "success",
  "moment", "story", "example", "experience", "situation", "incident", "regret",
  "lesson", "learning", "win", "loss", "tradeoff", "trade-off", "weakness",
  // verbs of doing
  "led", "convince", "persuade", "negotiate", "design", "build", "ship",
  "deliver", "fix", "solve", "improve", "scale", "drive", "launch", "cut",
  "rebuild", "rewrite", "migrate", "untangle", "refactor", "size", "estimate",
  "prioritize", "decide", "balance", "handle", "manage", "lead", "mentor",
  "coach", "influence", "align", "challenge", "push", "advocate",
  // emotion / quality
  "proud", "regret", "learned", "taught", "changed", "impact", "biggest",
  "hardest", "toughest", "ready", "workable", "specific", "honest",
  // question heads
  "why", "how", "when", "what", "where",
]);

/** Stopwords excluded from heuristic fallback. */
const STOPWORDS = new Set([
  "a","an","the","of","to","in","on","at","by","for","with","from","is","are",
  "was","were","be","been","being","have","has","had","do","does","did","and",
  "or","but","not","that","this","these","those","it","its","i","you","we",
  "they","he","she","tell","me","about","walk","through","describe","share",
  "talk","discuss","share","explain","give","take","let","know","think",
  "your","yours","mine","my","our","ours","their","theirs","his","her","hers",
  "can","could","would","should","will","may","might","just","only","also",
  "very","really","quite","most","more","much","some","any","all","every",
  "now","then","here","there","please","thank","thanks","sure",
]);

/** Action verbs that work especially well as accents. */
const ACTION_VERBS = new Set([
  "led","convince","persuade","negotiate","design","build","ship","deliver",
  "fix","solve","improve","scale","drive","launch","cut","rebuild","rewrite",
  "migrate","untangle","refactor","size","estimate","prioritize","decide",
  "balance","handle","manage","mentor","coach","influence","align","push",
  "advocate","ask","tell","teach","learn","grow","change","start","end",
  "stop","run","write","review","approve","reject","pick","choose","accept",
]);

/**
 * 24 hand-picked patterns covering ~95% of question stems the engine
 * actually ships. Capture-group 1 is the emphasis word. Order matters
 * (more specific first).
 */
const QUESTION_PATTERNS: RegExp[] = [
  /* ─── Behavioral STAR-style ─── */
  /\btell\s+me\s+about\s+(?:a|an)\s+(time|moment|situation|story|example|experience|incident|decision|challenge|mistake|conflict|win|loss|project|tradeoff|trade-off|lesson|weakness|failure|success)\b/i,
  /\btell\s+me\s+about\s+your\s+(last|first|biggest|hardest|proudest|toughest|favorite|worst)\b/i,
  /\bwalk\s+me\s+through\s+(?:a|an|your)\s+(project|situation|story|decision|moment|migration|launch|rewrite|negotiation|conflict|problem|approach|process|day|week)\b/i,
  /\b(?:describe|share|recall|recount)\s+(?:a|an|your)\s+(time|moment|situation|story|example|experience|incident|decision|challenge|mistake|conflict|win|loss|project|tradeoff|trade-off|lesson|weakness|approach|strength|failure)\b/i,
  /\bgive\s+(?:me|us)\s+(?:a|an)\s+(example|instance|case|story|scenario)\b/i,
  /\bthink\s+of\s+(?:a|an)\s+(time|moment|situation|story|example|experience|project)\b/i,

  /* ─── Self-reflective ─── */
  /\bwhat(?:'s| is| was|'ve| has)\s+(?:the\s+|your\s+|been\s+)?(biggest|hardest|toughest|smallest|best|worst|proudest|most|least|favorite|riskiest|costliest|fastest|slowest|hardest)\b/i,
  /\bwhat(?:'s| is)\s+your\s+(?:biggest\s+|greatest\s+)?(weakness|strength|fear|regret|gap|blind\s*spot|edge|advantage)\b/i,
  /\bhow\s+do\s+you\s+(handle|approach|manage|deal|tackle|prioritize|decide|measure|track|prepare|recover|stay|keep|grow|learn)\b/i,
  /\bhow\s+would\s+you\s+(\w+)\b/i,
  /^\s*(why)\b/i,
  /\bwhat\s+(motivates|drives|energizes|excites|inspires|frustrates|scares)\s+you\b/i,

  /* ─── Future / aspirational ─── */
  /\bwhere\s+do\s+you\s+(see|want|hope|expect)\b/i,
  /\bwhat\s+(?:are|is)\s+your\s+(goals|plans|aspirations|priorities|objectives|hopes|dreams|ambitions)\b/i,

  /* ─── Technical / case ─── */
  /\b(?:design|build|architect|sketch|model|prototype|spec)\s+(?:a|an)\s+([a-z][a-z0-9-]+)\b/i,
  /\bhow\s+would\s+you\s+(scale|optimize|debug|refactor|test|validate|measure|monitor|secure|migrate)\b/i,
  /\bestimate\s+(?:the\s+)?(number|size|cost|revenue|impact|reach|share|adoption|growth)\b/i,
  /\bwalk\s+me\s+through\s+your\s+(approach|process|thinking|reasoning|design|architecture)\b/i,

  /* ─── Salary negotiation ─── */
  /\bis\s+(?:that|this|₹?[\d.,]+\s*(?:lpa|k|cr)?)\s+(workable|acceptable|reasonable|fair|comfortable|doable)\b/i,
  /\bwhat(?:'s| is| are)\s+your\s+(expectations?|range|number|target|ask|requirement|floor|ceiling|bottom\s*line)\b/i,
  /\bhelp\s+me\s+(understand|see|figure|work|think)\b/i,

  /* ─── Open-ended / conversational ─── */
  /(?:^|—\s*|-\s*)(why|describe|tell|walk|share|explain|how|what|when|where|consider|imagine)\b/i,
  /^now\s*[—-]\s*(\w+)\b/i,
  /\blet(?:'s| us)\s+start\s+(?:with\s+|by\s+)?(easy|simple|small|big|hard|tough|warm|fresh|over)\b/i,
];

/**
 * Returns true if `word` looks like a proper noun mid-sentence
 * (capitalized but not the first token). Skip these so accents like
 * "Flipkart" don't dominate.
 */
function isLikelyProperNoun(word: string, isFirstToken: boolean): boolean {
  if (isFirstToken) return false;
  return /^[A-Z][a-z]/.test(word);
}

export function pickAccent(text: string): AccentSplit | null {
  if (!text) return null;
  const cleaned = text.replace(/^\[[^\]]+\]\s*/, "").trim();
  if (!cleaned) return null;

  // Strategy 1 — known interview-question patterns
  for (const pattern of QUESTION_PATTERNS) {
    const m = cleaned.match(pattern);
    if (!m || typeof m.index !== "number") continue;
    const accent = m[1];
    if (!accent || accent.length < 2) continue;
    const accentStart = m.index + m[0].toLowerCase().lastIndexOf(accent.toLowerCase());
    const accentEnd = accentStart + accent.length;
    const before = cleaned.slice(0, accentStart).replace(/\s+$/, "");
    const after = cleaned.slice(accentEnd).replace(/^\s+/, "").replace(/[.!?]+\s*$/, "");
    if (!before && !after) continue;
    return { before, accent, after };
  }

  // Strategy 2 — heuristic over tokens
  const tokenRegex = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;
  const tokens: { word: string; start: number; end: number; idx: number }[] = [];
  let i = 0;
  for (const match of cleaned.matchAll(tokenRegex)) {
    if (typeof match.index !== "number") continue;
    tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length, idx: i++ });
  }
  if (tokens.length < 3) return null;

  const scored = tokens
    .map((tok) => {
      const lower = tok.word.toLowerCase();
      if (STOPWORDS.has(lower)) return { tok, score: -1 };
      if (isLikelyProperNoun(tok.word, tok.idx === 0)) return { tok, score: -1 };
      if (tok.word.length < 3) return { tok, score: -1 };
      let score = tok.word.length;
      if (ACCENT_PRIORITY.has(lower)) score += 30;
      if (ACTION_VERBS.has(lower)) score += 20;
      if (ACTION_VERBS.has(lower) && tok.idx <= 6) score += 8;
      if (tok.idx === 0) score -= 4;
      return { tok, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;
  const chosen = scored[0].tok;
  const before = cleaned.slice(0, chosen.start).replace(/\s+$/, "");
  const after = cleaned.slice(chosen.end).replace(/^\s+/, "").replace(/[.!?]+\s*$/, "");
  if (!before && !after) return null;
  return { before, accent: chosen.word, after };
}
