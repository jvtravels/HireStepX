/**
 * Pure core for the dialogic-feedback feature (PRI-37) — "ask about /
 * argue with your verdict". A candidate reads their report and replies:
 * "why did I score low on structure?", "I disagree — I DID give a
 * metric", "how should I have answered Q2?". The eventual handler
 * (coach-followup.ts) sends an LLM answer, but the load-bearing,
 * design-independent, unit-testable parts live HERE:
 *
 *   1. classifyFollowupIntent  — deterministic intent of the follow-up.
 *   2. validateFollowupRequest — request-shape guard for the handler.
 *   3. checkChallengeEvidence  — when a candidate DISPUTES the verdict,
 *      adjudicate the dispute against their OWN transcript words, not the
 *      LLM's memory. This is the fairness primitive: a "I did quantify
 *      it" challenge is checked against detectStarPresence(answer), so the
 *      reply is grounded in evidence rather than a model guess.
 *   4. buildGroundingContext   — assemble the compact factual brief the
 *      LLM answer MUST stay grounded in (scores, verdict, weakest skill,
 *      the relevant answer quotes, and any adjudicated challenge
 *      evidence). Constraining the model to cited facts is what keeps
 *      dialogic feedback from hallucinating a different report.
 *
 * Decoupled by design: this module takes a narrow FollowupQuestionContext
 * (NOT the 600-line server SessionReport), so the report's shape can
 * evolve without touching the dialogue core, and the tests don't need to
 * synthesise a whole report.
 */

import { detectStarPresence } from "../src/_star-detection";

export type FollowupIntent = "challenge" | "clarify" | "improve" | "offtopic";

export interface FollowupQuestionContext {
  overallScore: number;
  /** Human verdict label, e.g. "Hire", "Lean Hire". */
  verdict: string;
  strengths: string[];
  improvements: string[];
  weakestSkill?: { name: string; tip: string };
  /** Per-question answers, in asked order. candidateAnswer is the raw
   *  transcript text the candidate actually said. */
  perQuestion?: Array<{ question: string; score?: number; candidateAnswer: string }>;
}

export interface FollowupRequest {
  sessionId: string;
  question: string;
}

export interface ChallengeEvidence {
  /** What the candidate is asserting they DID do. */
  claim: "quantified" | "structured" | "unknown";
  /** True when their own transcript supports the claim. */
  supported: boolean;
  /** The answer quotes (trimmed) that back — or fail to back — the claim. */
  quotes: string[];
}

export interface ValidatedFollowup {
  sessionId: string;
  question: string;
  intent: FollowupIntent;
}

/* ── 1. Intent classification ─────────────────────────────────── */

/* Dispute markers — the candidate is pushing back on the verdict itself.
   Conservative: a bare "why" is a clarify, not a challenge. */
const CHALLENGE_RE =
  /\b(i disagree|disagree|that.?s (?:not fair|unfair|wrong|harsh)|unfair|too harsh|i did|i actually|but i|i think (?:this|that|the score|you).{0,40}(?:wrong|unfair|harsh)|you.?re wrong|that.?s incorrect|i don.?t think that.?s right|reconsider|i deserve)\b/i;

const IMPROVE_RE =
  /\b(how (?:should|do|would|can) i|what should i (?:have|do)|how to|help me (?:improve|fix)|what.?s a better|give me an example|how would a strong|model answer|ideal answer)\b/i;

const CLARIFY_RE =
  /\b(why (?:did|do|was|is|am)|what (?:do you mean|does .* mean|made you|led to)|can you explain|explain|how come|what (?:lowered|dropped|hurt|cost) (?:my|the))\b/i;

/**
 * Deterministic intent of a follow-up. Order matters: a challenge that
 * also contains "why" is still a challenge (dispute dominates), and an
 * explicit "how should I" is an improve request even if phrased as a
 * complaint. Anything that matches none of the report-relevant patterns
 * is "offtopic" — the handler can then politely decline to leave the
 * report's scope rather than free-associate.
 */
export function classifyFollowupIntent(question: string): FollowupIntent {
  const q = (question || "").trim();
  if (!q) return "offtopic";
  if (CHALLENGE_RE.test(q)) return "challenge";
  if (IMPROVE_RE.test(q)) return "improve";
  if (CLARIFY_RE.test(q)) return "clarify";
  return "offtopic";
}

/* ── 2. Request validation ────────────────────────────────────── */

const MAX_QUESTION_CHARS = 600;

/**
 * Guard the raw request body for the handler. Returns the normalised
 * request (trimmed question) + the classified intent, or a user-facing
 * error string. Keeps the handler's body small and the validation
 * unit-tested.
 */
export function validateFollowupRequest(
  raw: unknown,
): { ok: true; value: ValidatedFollowup } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid request body." };
  }
  const r = raw as Record<string, unknown>;
  const sessionId = typeof r.sessionId === "string" ? r.sessionId.trim() : "";
  const question = typeof r.question === "string" ? r.question.trim() : "";
  if (!sessionId) return { ok: false, error: "Missing sessionId." };
  if (!question) return { ok: false, error: "Ask a question about your report." };
  if (question.length > MAX_QUESTION_CHARS) {
    return { ok: false, error: "Question is too long — keep it under 600 characters." };
  }
  return {
    ok: true,
    value: { sessionId, question, intent: classifyFollowupIntent(question) },
  };
}

/* ── 3. Challenge adjudication against the transcript ──────────── */

/* What the candidate is claiming they DID. Quantification ("I gave
   numbers / metrics / I quantified the impact") and structure ("I set
   the context / told the situation / it was a complete STAR") are the
   two disputes we can settle deterministically from their own words. */
/* Stems intentionally lack a trailing \b so plurals/inflections match
   ("number" → "numbers", "quantif" → "quantify/quantified", "measur" →
   "measured"). A trailing \b would break those. */
const QUANTIFY_CLAIM_RE =
  /\b(?:metric|number|quantif|percent|measur|result|impact|revenue|figure|data point)|%/i;
const STRUCTURE_CLAIM_RE =
  /\b(?:structur|star\b|situation|context|set the scene|background|the goal|first-person)/i;

const MAX_QUOTE_CHARS = 240;

function trimQuote(text: string): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  return clean.length > MAX_QUOTE_CHARS ? clean.slice(0, MAX_QUOTE_CHARS - 1) + "…" : clean;
}

/**
 * When intent === "challenge", check whether the candidate's OWN answers
 * support the thing they're disputing. Returns null when the question
 * isn't a settle-able quantified/structured claim (the LLM then answers
 * from the general grounding context). When it IS settle-able, the
 * verdict is computed from detectStarPresence over their answers — the
 * SAME detector the score rubric used — so the dialogue can't contradict
 * the report. supported=true means "you're right, the evidence is in
 * your transcript"; supported=false means "here's why I didn't see it".
 */
export function checkChallengeEvidence(
  question: string,
  context: FollowupQuestionContext,
): ChallengeEvidence | null {
  const answers = (context.perQuestion ?? [])
    .map((p) => (p.candidateAnswer || "").trim())
    .filter((t) => t.length > 0 && !t.startsWith("[SKIPPED"));
  if (answers.length === 0) return null;

  const wantsQuantify = QUANTIFY_CLAIM_RE.test(question);
  const wantsStructure = STRUCTURE_CLAIM_RE.test(question);
  if (!wantsQuantify && !wantsStructure) return null;

  // Quantification dominates when both fire — it's the more specific,
  // less ambiguous claim to adjudicate.
  const claim: ChallengeEvidence["claim"] = wantsQuantify ? "quantified" : "structured";

  const quotes: string[] = [];
  let supported = false;
  for (const ans of answers) {
    const star = detectStarPresence(ans);
    const hit = claim === "quantified" ? star.hasMetrics : star.count >= 3;
    if (hit) {
      supported = true;
      quotes.push(trimQuote(ans));
    }
  }
  // No supporting answer found: surface the strongest 1-2 answers so the
  // reply can point at what WAS said (and what was missing), honestly.
  if (!supported) {
    for (const ans of answers.slice(0, 2)) quotes.push(trimQuote(ans));
  }
  return { claim, supported, quotes: quotes.slice(0, 3) };
}

/* ── 4. Grounding-context builder ─────────────────────────────── */

const MAX_PERQUESTION = 6;

/**
 * Assemble the factual brief the LLM answer must stay grounded in. This
 * is plain text (cheap to cache, easy to eyeball in logs). The handler
 * places it BEFORE the candidate's question in the prompt so Groq's
 * prefix cache holds the static report context across a multi-turn
 * dialogue (see the prompt-cache note in CLAUDE.md). Returns a stable,
 * deterministic string — no timestamps, no randomness.
 */
export function buildGroundingContext(
  context: FollowupQuestionContext,
  validated: ValidatedFollowup,
): string {
  const lines: string[] = [];
  lines.push("REPORT FACTS (answer ONLY from these — do not invent scores or quotes):");
  lines.push(`- Overall score: ${context.overallScore}/100`);
  lines.push(`- Verdict: ${context.verdict}`);
  if (context.strengths.length > 0) {
    lines.push(`- Strengths: ${context.strengths.join("; ")}`);
  }
  if (context.improvements.length > 0) {
    lines.push(`- Improvements: ${context.improvements.join("; ")}`);
  }
  if (context.weakestSkill) {
    lines.push(`- Weakest skill: ${context.weakestSkill.name} — ${context.weakestSkill.tip}`);
  }

  const perQ = (context.perQuestion ?? []).slice(0, MAX_PERQUESTION);
  if (perQ.length > 0) {
    lines.push("PER-QUESTION:");
    perQ.forEach((p, i) => {
      const score = typeof p.score === "number" ? ` (scored ${p.score})` : "";
      lines.push(`  Q${i + 1}${score}: ${p.question}`);
      lines.push(`    Candidate said: "${trimQuote(p.candidateAnswer)}"`);
    });
  }

  if (validated.intent === "challenge") {
    const ev = checkChallengeEvidence(validated.question, context);
    if (ev) {
      lines.push("CHALLENGE ADJUDICATION (computed from the candidate's own words):");
      lines.push(
        `- Claim type: ${ev.claim}. Transcript ${ev.supported ? "SUPPORTS" : "does NOT clearly support"} it.`,
      );
      lines.push(
        ev.supported
          ? "- Concede the point honestly and acknowledge the evidence below."
          : "- Explain, without dismissiveness, what was missing using the quotes below.",
      );
      ev.quotes.forEach((qt) => lines.push(`    • "${qt}"`));
    }
  }

  return lines.join("\n");
}

/* ── 5. Prompt assembly (Groq prefix-cache friendly) ──────────── */

/* Byte-identical across every call — no per-session interpolation — so it
   extends Groq's longest shared prefix (see CLAUDE.md → LLM prompt
   caching). Anything dynamic (the report facts, the candidate's
   question) is appended AFTER this block by buildCoachPrompt. */
export const COACH_STATIC_RULES = `
You are the candidate's interview coach reviewing THEIR OWN mock-interview report with them. They can ask why they were scored a certain way, or push back on the verdict. Rules:

GROUNDING: Answer ONLY from the REPORT FACTS provided below. Never invent a score, a quote, or a rubric the facts don't contain. If the facts don't cover their question, say so plainly and point them to what the report does show.

HONESTY OVER FLATTERY: This is coaching, not customer service. If their answer genuinely lacked a metric or structure, say so kindly but clearly — don't cave just because they pushed back. If the CHALLENGE ADJUDICATION block says the transcript SUPPORTS their point, concede it openly and thank them for the catch. If it says it does NOT, explain what was actually missing, quoting their own words.

NO SCORE CHANGES: You cannot change the score — you explain it. If they've genuinely identified something the rubric missed, acknowledge it and suggest they flag it, but don't promise a new number.

VOICE: Indian English, warm and direct. Use ₹ / LPA / CTC. No Americanisms ("awesome", "reach out", "circle back"). Keep replies tight — 2-4 short paragraphs, no preamble. English only.`.trim();

const INTENT_DIRECTIVE: Record<FollowupIntent, string> = {
  challenge:
    "The candidate is DISPUTING the verdict. Weigh the CHALLENGE ADJUDICATION block above all else — concede if it supports them, hold the line (kindly) if it doesn't.",
  clarify:
    "The candidate wants to understand WHY they were scored this way. Cite the specific strength/improvement/weakest-skill and their own quoted words.",
  improve:
    "The candidate wants to do better. Give one concrete, specific rewrite or technique anchored to what they actually said — not generic advice.",
  offtopic:
    "The question is outside this report. Politely say it's beyond what this report covers and redirect to what the report does show.",
};

/**
 * Assemble the full prompt: static rules → grounding facts → intent
 * directive → the candidate's question. Deterministic; no timestamps.
 */
export function buildCoachPrompt(
  context: FollowupQuestionContext,
  validated: ValidatedFollowup,
): string {
  return [
    COACH_STATIC_RULES,
    "",
    buildGroundingContext(context, validated),
    "",
    `DIRECTIVE: ${INTENT_DIRECTIVE[validated.intent]}`,
    "",
    `CANDIDATE'S QUESTION: ${validated.question}`,
    "",
    "Your reply:",
  ].join("\n");
}

/**
 * Deterministic non-LLM reply. Used for offtopic questions (no need to
 * spend a token on them) and as the graceful degrade when every LLM
 * provider fails — the dialogue stays honest and never hard-errors.
 */
export function fallbackAnswer(intent: FollowupIntent): string {
  if (intent === "offtopic") {
    return "That's a bit outside what this report covers — I can only speak to your scores, strengths, improvements and the answers in this session. Ask me why a particular score landed where it did, or how to strengthen a specific answer.";
  }
  return "I couldn't generate a full reply just now — please try again in a moment. In the meantime, the report's Top Improvements and Weakest Skill are the fastest things to act on.";
}
