/* Pure helpers extracted from generate-questions.ts.
 *
 * The handler is mostly prompt building + a single LLM call, but there are
 * three load-bearing post-LLM stages where a wrong shape ships blank
 * questions to the interview screen:
 *   1. extractQuestionsArray — the LLM sometimes returns
 *      { questions: [] } / { steps: [] } / a bare array. Unwrapping must
 *      handle every shape we've observed in production.
 *   2. validateQuestionShape — every step must have type + non-empty aiText.
 *   3. normalizePanelPersonas — panel interviews require one of three
 *      personas; we normalize case and round-robin to fill missing/invalid
 *      assignments. Intro and closing always come from "Hiring Manager".
 */

export type Persona = "Hiring Manager" | "Technical Lead" | "HR Partner";

export const VALID_PERSONAS: Persona[] = ["Hiring Manager", "Technical Lead", "HR Partner"];

export interface RawQuestion {
  type?: string;
  aiText?: string;
  scoreNote?: string;
  persona?: string;
  [k: string]: unknown;
}

/**
 * Unwrap the LLM's response into a questions array. The model wraps
 * questions inconsistently — sometimes a bare array, sometimes
 * `{questions: [...]}`, sometimes `{steps: [...]}` or
 * `{interview_steps: [...]}`. Last fallback: take the first array-valued
 * entry on the object. Returns null if no array can be found.
 */
export function extractQuestionsArray(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const candidates = [obj.questions, obj.steps, obj.interview_steps];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }
  // Final fallback: first array-valued entry.
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) return v;
  }
  return null;
}

/**
 * True when every step has a non-empty `type` and `aiText` string. Empty
 * questions in the interview UI render as a blank avatar bubble — this is
 * the most user-visible failure mode.
 */
export function validateQuestionShape(questions: unknown[]): boolean {
  if (!Array.isArray(questions) || questions.length === 0) return false;
  for (const q of questions) {
    if (!q || typeof q !== "object") return false;
    const qObj = q as Record<string, unknown>;
    if (typeof qObj.type !== "string" || qObj.type.length === 0) return false;
    if (typeof qObj.aiText !== "string" || qObj.aiText.length === 0) return false;
  }
  return true;
}

/**
 * Mutates `questions` in place: cleans punctuation artifacts in aiText.
 * LLMs occasionally produce "Tell me about a failure., What did you learn"
 * (comma-period stitch) or end interrogatives with a period
 * ("how did you measure the impact."). The fixes here are minimal —
 * collapse stray punctuation joins and flip terminal "." to "?" when the
 * sentence is clearly a question opener.
 */
export function sanitizeQuestionText(questions: RawQuestion[]): void {
  // Only true interrogative openers — NOT imperatives like "Tell me about X."
  // (which is grammatical with a period). Flipping imperatives would corrupt
  // most behavioral questions.
  const interrogOpeners = /^(how|what|why|when|where|which|who|whose|whom|can|could|would|should|will|did|do|does|is|are|was|were|have|has|had)\b/i;
  for (const q of questions) {
    if (typeof q.aiText !== "string" || q.aiText.length === 0) continue;
    let t = q.aiText;
    // Collapse "., " / ",." / ".." into ". "
    t = t.replace(/\.,\s+/g, ". ").replace(/,\.\s*/g, ". ").replace(/\.\.\s+/g, ". ");
    // Drop a stray comma before a sentence terminator ("retention,.")
    t = t.replace(/,\s*([.!?])/g, "$1");
    // Last sentence flip-to-? rule: only when its FIRST WORD is a true
    // interrogative starter (How/What/Why/etc.) AND it ends with ".".
    const lastSentenceMatch = t.match(/(?:^|[.!?]\s+)([^.!?]+)\.\s*$/);
    if (lastSentenceMatch) {
      const firstWord = lastSentenceMatch[1].trimStart();
      if (interrogOpeners.test(firstWord)) {
        t = t.replace(/\.\s*$/, "?");
      }
    }
    q.aiText = t.trim();
  }
}

/**
 * Mutates `questions` in place: assigns/normalizes a valid persona to
 * each step. Intro + closing always become "Hiring Manager"; other steps
 * round-robin across the three roles. Existing valid personas (any case)
 * are preserved.
 */
export function normalizePanelPersonas(questions: RawQuestion[]): void {
  let rotIdx = 0;
  for (const q of questions) {
    if (typeof q.persona === "string") {
      const lower = q.persona.toLowerCase();
      const match = VALID_PERSONAS.find((p) => p.toLowerCase() === lower);
      if (match) {
        q.persona = match;
        continue;
      }
    }
    if (q.type === "intro" || q.type === "closing") {
      q.persona = "Hiring Manager";
    } else {
      q.persona = VALID_PERSONAS[rotIdx % VALID_PERSONAS.length];
      rotIdx++;
    }
  }
}

/**
 * Post-LLM role-fence backstop. The prompt has a ROLE FENCE directive,
 * but LLMs occasionally still slip in a SWE-style "design a rate
 * limiter" question for a Product Designer round, or a "Figma
 * critique" question for a backend engineer. This regex sweep flags
 * any question whose text contains off-role terminology for the
 * inferred role family, so the caller can replace it with a curated
 * fallback. Conservative on false positives: if a designer answer
 * mentions "metrics" that's fine — we only flag terms that are
 * unambiguously off-discipline (sharding, JOIN keys, Figma autolayout).
 *
 * Returns the indices of `questions` whose `aiText` is off-role.
 * Empty array means all questions look in-discipline.
 */
export function flagOffRoleQuestions(
  questions: RawQuestion[],
  roleFamily: string | undefined,
): number[] {
  if (!roleFamily) return [];
  const fam = roleFamily.toLowerCase();
  // Each role family lists hard-off-role term regexes. Designers don't
  // get asked about JOIN keys; engineers don't get asked about Figma
  // autolayout. Soft-overlap terms ("metrics", "users", "team") are NOT
  // listed here because they're shared across all roles.
  let offRoleRe: RegExp | null = null;
  if (fam === "design" || fam === "designer-senior") {
    offRoleRe = /\b(?:sharding|rate[\s-]?limit(?:er|ing)|distributed\s+system|kafka|redis\s+cluster|kubernetes|microservice\s+architecture|sql\s+join|query\s+optimi[sz]ation|big[\s-]?o\s+complexity|leetcode|algorithm\s+design|garbage\s+collect|memory\s+leak|api\s+gateway|load\s+balanc(?:er|ing)|database\s+schema|etl\s+pipeline)\b/i;
  } else if (fam === "swe" || fam === "em" || fam === "ml") {
    offRoleRe = /\b(?:figma\s+(?:autolayout|component|variant)|design\s+token|visual\s+hierarchy|color\s+palette|user\s+persona\s+workshop|wireframe\s+critique|brand\s+voice|copy\s+deck|editorial\s+calendar)\b/i;
  } else if (fam === "writer") {
    offRoleRe = /\b(?:sharding|rate[\s-]?limit|distributed\s+system|sql\s+join|leetcode|big[\s-]?o|figma\s+autolayout|design\s+token|api\s+endpoint|microservice|database\s+schema|etl\s+pipeline|sprint\s+velocity)\b/i;
  } else if (fam === "data" || fam === "ds-research") {
    offRoleRe = /\b(?:figma|design\s+token|visual\s+hierarchy|color\s+palette|brand\s+voice|copy\s+deck|sharding\s+strategy|kafka\s+partition|kubernetes\s+pod)\b/i;
  } else if (fam === "pm") {
    offRoleRe = /\b(?:figma\s+autolayout|design\s+token|leetcode|big[\s-]?o\s+complexity|garbage\s+collect|memory\s+leak|sql\s+join\s+key|sharding\s+strategy)\b/i;
  }
  if (!offRoleRe) return [];
  const flagged: number[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.type === "intro" || q.type === "closing") continue;
    if (typeof q.aiText !== "string") continue;
    if (offRoleRe.test(q.aiText)) flagged.push(i);
  }
  return flagged;
}

/**
 * Salary-negotiation interviews need at least 4 turns to play out the
 * full arc (intro → offer → probe → counter → close). Anything shorter
 * is a malformed LLM response that won't make sense in the UI.
 */
export function isSalaryNegotiationLengthOk(
  isSalaryType: boolean,
  questionLength: number,
): boolean {
  if (!isSalaryType) return true;
  return questionLength >= 4;
}

/**
 * The number of total interview steps to request from the LLM, given the
 * format. Mini sessions get 3 questions (or 5 for salary-negotiation,
 * which needs the full arc); regular sessions get 5. Total = +2 for
 * intro and closing.
 */
export function computeStepCount(opts: { mini: boolean; isSalaryType: boolean }): number {
  const questionCount = opts.mini ? (opts.isSalaryType ? 5 : 3) : 5;
  return questionCount + 2;
}

/* ─── Static fallback (used when both LLM providers fail) ──────────────
 *
 * When Groq + Gemini both return errors (provider outage, TPM exhaustion,
 * 503), we'd rather show curated questions from the seed bank than a 500
 * page. Quality is lower than a tailored LLM response but materially
 * better than "Try again later" for the user mid-interview.
 *
 * Selection priority: exact (focus) match → roleFamily fallback →
 * generic warmup mix. Always returns at least 5 questions; never throws. */

import { QUESTION_BANK, type FocusArea, type RoleFamily } from "../data/interview-question-bank";

export interface FallbackQuestion {
  type: string;
  aiText: string;
  scoreNote?: string;
}

/** Pick N curated questions matching the requested signature. Best-effort. */
export function buildStaticFallback(opts: {
  type: string;
  focus?: string;
  difficulty?: string;
  roleFamily?: string;
  count: number;
}): FallbackQuestion[] {
  const wantFocus = (opts.focus || "").toLowerCase() as FocusArea;
  const wantRole = (opts.roleFamily || "general").toLowerCase() as RoleFamily;
  // Priority pass: exact role + focus match.
  const tier1 = QUESTION_BANK.filter(q => q.roleFamily === wantRole && q.focus === wantFocus);
  // Fallback pass: same role, any focus (covers when focus="general").
  const tier2 = QUESTION_BANK.filter(q => q.roleFamily === wantRole);
  // Last resort: just behavioral entries (smallest-blast-radius default).
  const tier3 = QUESTION_BANK.filter(q => q.focus === "behavioral");
  const pool = tier1.length >= opts.count ? tier1 : tier2.length >= opts.count ? tier2 : tier3;
  // Shuffle deterministically by index for variety without randomness side effects.
  const picked = pool.slice(0, opts.count);
  const questions: FallbackQuestion[] = [
    { type: "intro", aiText: "Hi — let's get started. To warm up, tell me a bit about yourself and what brings you to this role." },
    ...picked.map((q, i): FallbackQuestion => ({
      type: i === 0 ? "warmup" : "main",
      aiText: q.text,
      scoreNote: q.styleNote,
    })),
    { type: "closing", aiText: "That's all I had — what questions do you have for me?" },
  ];
  return questions;
}
