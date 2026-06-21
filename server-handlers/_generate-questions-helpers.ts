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

import { initState, type MarketMode } from "./_negotiation-kernel";
import { renderCanonicalProse } from "./_canonical-prose";

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
    t = t.trim();
    // Defensive: capitalize the very first letter (closing/intro lines
    // sometimes come back lowercase from the LLM, e.g. "thanks for your
    // time. anything else?"). Only flips an already-letter first char,
    // leaves emoji/quote/bracket prefixes alone.
    if (t.length > 0 && /^[a-z]/.test(t)) {
      t = t.charAt(0).toUpperCase() + t.slice(1);
    }
    q.aiText = t;
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
  } else if (fam === "sales" || fam === "bfsi-sales") {
    offRoleRe = /\b(?:figma\s+autolayout|design\s+token|leetcode|sharding|kafka|kubernetes|sql\s+join|big[\s-]?o\s+complexity|garbage\s+collect|memory\s+leak|etl\s+pipeline|microservice\s+architecture)\b/i;
  } else if (fam === "marketing") {
    offRoleRe = /\b(?:sharding|kafka|kubernetes|sql\s+join\s+key|big[\s-]?o\s+complexity|leetcode|garbage\s+collect|microservice\s+architecture|figma\s+autolayout)\b/i;
  } else if (fam === "hr") {
    offRoleRe = /\b(?:sharding|kafka|kubernetes|sql\s+join\s+key|big[\s-]?o\s+complexity|leetcode|figma\s+autolayout|design\s+token)\b/i;
  } else if (fam === "finance") {
    offRoleRe = /\b(?:figma\s+autolayout|design\s+token|sharding\s+strategy|kafka\s+partition|kubernetes\s+pod|leetcode)\b/i;
  } else if (fam === "consultant") {
    offRoleRe = /\b(?:figma\s+autolayout|design\s+token|sharding|kafka\s+partition|kubernetes\s+pod|leetcode|garbage\s+collect|memory\s+leak)\b/i;
  } else if (fam === "healthcare" || fam === "legal") {
    offRoleRe = /\b(?:figma\s+autolayout|design\s+token|sharding|kafka|kubernetes|sql\s+join\s+key|leetcode|big[\s-]?o\s+complexity|microservice\s+architecture)\b/i;
  } else if (fam === "ops") {
    offRoleRe = /\b(?:figma\s+autolayout|design\s+token|sharding|kafka\s+partition|kubernetes\s+pod|leetcode|big[\s-]?o\s+complexity)\b/i;
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
 * Salary-negotiation scripts now emit ONLY intro + initial-offer + closing
 * (3 steps total). Every turn in between is owned by the NegotiationKernel
 * at runtime — see useInterviewEngine's insert-before-closing path.
 *
 * Why so short: the previous 5-question arc (intro/offer/probe/counter/
 * package/closing) created a parallel response surface to the kernel. Every
 * static slot was a place the LLM could hallucinate a number, a role title,
 * or a phase mismatch — and a place we had to validate, rewrite, and keep
 * in sync with the kernel's lever logic. Cutting the script to two
 * anchored turns (the cold-open intro and the band-bounded initial offer)
 * makes the kernel the single source of truth for everything after the
 * candidate's first reaction.
 *
 * The minimum is 3 because anything shorter means the LLM dropped intro,
 * offer, or closing — a malformed response, not a stylistic choice.
 */
export function isSalaryNegotiationLengthOk(
  isSalaryType: boolean,
  questionLength: number,
): boolean {
  if (!isSalaryType) return true;
  return questionLength >= 3;
}

/**
 * The number of total interview steps to request from the LLM, given the
 * format. Salary-negotiation gets a fixed 3 steps (intro + initial offer +
 * closing) regardless of mini/regular; the kernel fills the middle. Other
 * types: mini → 3 questions, regular → 5 questions. HR-round → 7 questions
 * (7-dimension Indian HR gate can't be covered in 5 turns). Total = +2 for
 * intro and closing.
 */
export function computeStepCount(opts: { mini: boolean; isSalaryType: boolean; interviewType?: string }): number {
  if (opts.isSalaryType) return 3; // intro + initial-offer + closing
  if (opts.mini) return 3 + 2;
  if (opts.interviewType === "hr-round") return 7 + 2;
  return 5 + 2;
}

/* ─── Salary-negotiation LLM-down fallback ────────────────────────────
 *
 * When both LLM providers are exhausted, salary-negotiation does NOT
 * dead-end: the band is deterministic (generateNegotiationBand, no LLM)
 * and /api/negotiate-turn owns every turn (also no LLM). This builder
 * produces the seed session the client needs — a warm intro, the
 * canonical kernel OPENER (a discovery probe with NO premature anchor,
 * byte-identical to the success-path q[1] construction), and a closing.
 *
 * Why this matters (root cause of "0 of 5 stages"): the client's band
 * fetch lives ONLY in this response (useInterviewEngine reads
 * result.negotiationBand). On a 500 the band never loads → the kernel
 * bails to the non-adaptive static script that never names a number →
 * the deal-summary extractor finds nothing → the report renders a hollow
 * "didn't close". Returning the band + opener here keeps the kernel
 * reachable so it drives a real, staged close even with the LLMs down. */
export interface SalaryFallbackStep {
  type: string;
  aiText: string;
  aiTextDisplay: string;
  question: string;
  text: string;
}

export function buildSalaryNegotiationFallbackQuestions(opts: {
  role: string;
  company: string;
  band: {
    initialOffer: number;
    maxStretch: number;
    walkAway: number;
    hasEquity?: boolean;
    marketMode?: MarketMode;
  };
}): SalaryFallbackStep[] {
  const { role, company, band } = opts;
  let opener: string;
  try {
    const kernelState = initState({
      sessionId: "generate-questions-opener-fallback",
      role: role || "this role",
      company: company || "this company",
      band: {
        initialOffer: Math.round(band.initialOffer),
        maxStretch: Math.round(band.maxStretch),
        walkAway: Math.round(band.walkAway),
        hasEquity: band.hasEquity ?? false,
      },
      marketMode: band.marketMode ?? "neutral",
    });
    opener = renderCanonicalProse(
      // renderCanonicalProse's first arg is the NextAction union; the bare
      // "open-with-offer" literal needs widening to that param type.
      { kind: "open-with-offer" } as Parameters<typeof renderCanonicalProse>[0],
      kernelState,
    );
  } catch {
    // Prose render should never throw, but if it does, ship a safe greeting
    // rather than a blank turn — the kernel re-renders on its first reply.
    opener = "Thanks for taking the time today. Let's get into it — to start, can you walk me through your current compensation structure?";
  }
  const introText = "Thanks for making time today — let's keep this conversational. Take your time, and feel free to type if that's easier.";
  const closingText = "Thanks for talking it through with me today. We'll follow up with the next steps from here.";
  const mk = (type: string, t: string): SalaryFallbackStep => ({ type, aiText: t, aiTextDisplay: t, question: t, text: t });
  return [mk("intro", introText), mk("question", opener), mk("closing", closingText)];
}

export function computeQuestionCount(opts: { mini: boolean; isSalaryType: boolean; interviewType?: string }): number {
  if (opts.isSalaryType) return opts.mini ? 5 : 5;
  if (opts.mini) return 3;
  if (opts.interviewType === "hr-round") return 7;
  return 5;
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
import { sampleBehavioralQuestions, type BehavioralRole } from "../data/behavioral-question-bank";
import { sampleHrQuestions } from "../data/hr-round-question-bank";

/* Map the broad interview-bank RoleFamily onto the behavioural bank's
   compact 6-role discipline taxonomy. Drives the behavioural fallback so a
   designer doesn't get SWE-flavoured probes and vice versa (live QA bug,
   2026-06). Families with no behavioural-discipline analogue (sales,
   finance, legal, civil-services…) return undefined → the sampler keeps its
   universal/standard mix, which is the correct neutral behaviour. */
function toBehavioralRole(roleFamily: string): BehavioralRole | undefined {
  switch (roleFamily) {
    case "swe": case "ml": case "psu-engineer": return "engineer";
    case "pm": return "pm";
    case "em": return "manager";
    case "data": case "ds-research": case "quant": case "scientist": return "data";
    case "design": case "designer-senior": return "designer";
    case "ops": return "ops";
    default: return undefined;
  }
}

/* Coarse experienceLevel → years-of-experience for the behavioural sampler's
   seniorityFloor filter (so a fresher isn't asked staff-level org-strategy
   questions on the LLM-down path). Mirrors the calibration buckets used in
   generate-questions.ts. Undefined when unknown → sampler skips the floor. */
function toYoe(experienceLevel: string | undefined): number | undefined {
  switch ((experienceLevel || "").toLowerCase()) {
    case "entry": case "fresher": return 1;
    case "mid": return 4;
    case "senior": case "lead": return 8;
    case "executive": return 12;
    default: return undefined;
  }
}

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
  experienceLevel?: string;
  count: number;
}): FallbackQuestion[] {
  const focus = (opts.focus || "").toLowerCase();
  const type = (opts.type || "").toLowerCase();
  const roleFamily = (opts.roleFamily || "general").toLowerCase();
  const count = opts.count;

  // Behavioural session → draw from the curated 50-question bank with
  // competency-deduped sampling. Anyone running the static fallback for
  // a behavioural interview gets a real-interviewer-grade set instead of
  // generic prompts. Match on TYPE as well as focus (mirrors the HR branch
  // below): a behavioural session can arrive with focus:"general" — keying
  // only on focus let it fall through to the cross-role QUESTION_BANK path,
  // which once handed a Senior Product Designer a `swe`-tagged "owned an
  // outage / post-mortem" question (live QA, 2026-06).
  const behavioralByType = (type === "behavioral" || type === "behavioural")
    // An explicit HR focus is the more specific signal and owns its own
    // branch below — don't let a behavioural *type* hijack an HR session.
    && focus !== "hr" && focus !== "hr-round";
  if (focus === "behavioral" || focus === "behavioural" || behavioralByType) {
    const seed = ((count * 31) + (focus.length * 17) + (roleFamily.length)) >>> 0;
    /* Opt in to frequency-weighted sampling for the LLM-down fallback
       path: a candidate who hits this code is already getting a degraded
       experience, so the consolation is "at least we ask the questions
       interviewers actually ask most often" instead of a uniform draw
       across the bank. The LLM-up path (where `generate-questions` calls
       Groq/Gemini) still uses the unweighted bank for the
       canonical-phrasing rule — see the rationale in
       `generate-questions.ts`. */
    const sampled = sampleBehavioralQuestions({
      count, seed, weightByFrequency: true,
      // Discipline + seniority steering: questions whose roleAffinity excludes
      // the candidate's discipline are downweighted (not eliminated), and
      // questions above the candidate's seniority floor are hard-filtered.
      // Without this a designer's LLM-down fallback drew SWE outage/post-mortem
      // probes (live QA, 2026-06).
      role: toBehavioralRole(roleFamily),
      yoe: toYoe(opts.experienceLevel),
    });
    if (sampled.length > 0) {
      return [
        { type: "intro", aiText: "Hi — let's get started. To warm up, tell me a bit about yourself and what brings you to this role." },
        ...sampled.map((q): FallbackQuestion => ({
          // Canonical InterviewStep type. The LLM path emits "question"
          // (see generate-questions.ts prompt) and the entire engine —
          // totalQuestions/currentQuestionNum counters, progress dots, the
          // end-modal, and the saved `questions` count — recognizes only
          // "question"/"follow-up". The old "warmup"/"main" tags were a
          // divergent vocabulary invisible to all of it, so an LLM-down
          // session (static fallback) rendered "answered 0 of 0 questions"
          // and persisted questions:0. Difficulty escalation lives on the
          // bank entry, not the step type.
          type: "question",
          aiText: q.text,
          scoreNote: `Competency: ${q.competency}; STAR focus: ${q.starFocus}.`,
        })),
        { type: "closing", aiText: "That's all I had — what questions do you have for me?" },
      ];
    }
  }

  // HR round → dedicated HR bank. The interview *type* is "hr-round" but
  // the curated bank's FocusArea is "hr"; this fallback never normalises
  // between them, so without this branch an HR session silently degrades
  // to tier-3 behavioural prompts (wrong prep for the candidate). Match on
  // either signal — type carries "hr-round", focus may be "hr"/"hr-round".
  if (focus === "hr" || focus === "hr-round" || type === "hr-round") {
    const seed = ((count * 37) + (roleFamily.length * 13) + 7) >>> 0;
    const sampled = sampleHrQuestions({ count, seed, weightByFrequency: true });
    if (sampled.length > 0) {
      return [
        // The intro IS the "tell me about yourself" opener (the sampler
        // excludes that question from the body), so this is the single
        // background beat — it must not also pre-empt a body question.
        { type: "intro", aiText: "Hi — thanks for making the time. To get us started, tell me a little about yourself and walk me through your background." },
        ...sampled.map((q): FallbackQuestion => ({
          // Canonical InterviewStep type. The LLM path emits "question"
          // (see generate-questions.ts prompt) and the entire engine —
          // totalQuestions/currentQuestionNum counters, progress dots, the
          // end-modal, and the saved `questions` count — recognizes only
          // "question"/"follow-up". The old "warmup"/"main" tags were a
          // divergent vocabulary invisible to all of it, so an LLM-down
          // session (static fallback) rendered "answered 0 of 0 questions"
          // and persisted questions:0. Difficulty escalation lives on the
          // bank entry, not the step type.
          type: "question",
          aiText: q.text,
          scoreNote: `HR dimension: ${q.dimension}.`,
        })),
        { type: "closing", aiText: "That's everything from my side — what would you like to ask me about the role, the team, or the company?" },
      ];
    }
  }

  const wantFocus = focus as FocusArea;
  const wantRole = roleFamily as RoleFamily;
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
    ...picked.map((q): FallbackQuestion => ({
      // Canonical InterviewStep type — see the note above. "warmup"/"main"
      // were invisible to the engine's question counters.
      type: "question",
      aiText: q.text,
      scoreNote: q.styleNote,
    })),
    { type: "closing", aiText: "That's all I had — what questions do you have for me?" },
  ];
  return questions;
}

/* ── Discipline fence ────────────────────────────────────────────────
   Abstract weak-skill labels (technicalDepth, businessImpact,
   specificity, adaptability…) are discipline-agnostic. Handed to the LLM
   without a craft anchor, "technical depth" for a Senior Product Designer
   was observed LIVE to produce a software-engineering question — "Walk me
   through a system you designed that had to handle scalability issues.
   What were the key architectural decisions you made, and how did you
   validate them?" — a clear role-fit miss for a designer.

   This fence pins every weak-skill interpretation to the candidate's
   actual craft and forbids adjacent-discipline questions. It is keyed off
   the role string, so it protects every role (a marketer shouldn't get
   architecture questions either), not just designers. Conservative
   keyword matching; an unrecognised role falls back to a generic fence
   that still forbids cross-discipline drift. */

export type Discipline =
  | "design" | "product" | "data" | "engineering"
  | "marketing" | "sales" | "ops" | "generic";

/** Classify a free-text role title into a coarse discipline. Order
 *  matters: more specific multi-word craft cues are tested before the
 *  broad "engineer/developer" net so "Product Designer" → design, not a
 *  miss. Returns "generic" when nothing matches confidently. */
export function classifyDiscipline(role: string): Discipline {
  const r = (role || "").toLowerCase();
  if (!r.trim()) return "generic";
  // Design first — "Product Designer" contains "product", so design must win.
  // Each alternative carries its own boundary; a single \b(...)\b wrapper
  // would wrongly require a word boundary mid-token (e.g. after "data scien").
  if (/\bux\b|\bui\b|product design|visual design|interaction design|graphic design|motion design|design system|\bdesigner\b/.test(r)) return "design";
  if (/product manager|product owner|product lead|group product|program manager|associate product|product management|\bpm\b|\bapm\b|\bgpm\b/.test(r)) return "product";
  if (/data scientist|data science|data analy|\banalytics\b|machine learning|\bml\b|\bai engineer\b|data engineer|business intelligence|\bbi\b|statistician|quantitative/.test(r)) return "data";
  if (/\bmarketing\b|\bgrowth\b|\bseo\b|\bsem\b|content strateg|\bbrand\b|social media|performance marketing|demand gen/.test(r)) return "marketing";
  if (/\bsales\b|account executive|business development|\bbd\b|account manager|customer success|inside sales|pre[\s-]?sales|solutions consultant/.test(r)) return "sales";
  if (/\boperations\b|\bops\b|supply chain|logistics|project manager|delivery manager|scrum master/.test(r)) return "ops";
  // Broad engineering net last so it doesn't swallow "design engineer"-style titles.
  if (/engineer|developer|programmer|\bsde\b|\bswe\b|architect|devops|\bsre\b|backend|back[\s-]?end|frontend|front[\s-]?end|full[\s-]?stack|\bmobile\b|android|\bios\b|\bqa\b|tester|platform/.test(r)) return "engineering";
  return "generic";
}

const DISCIPLINE_CRAFT: Record<Exclude<Discipline, "generic">, { craft: string; technicalMeans: string; forbid: string }> = {
  design: {
    craft: "product / UX / visual design",
    technicalMeans: "interaction design, design systems, prototyping fidelity, design–engineering feasibility trade-offs, accessibility, and usability-research rigor",
    forbid: "software architecture, scalability, infrastructure, databases, backend/system-design, or writing/optimising code (a designer partners with engineers on constraints — they do not architect the system)",
  },
  product: {
    craft: "product management",
    technicalMeans: "product sense, metric definition, prioritisation, experimentation / A-B testing, discovery rigor, and technical fluency to partner with engineering",
    forbid: "hand-writing production code, low-level system architecture, or executing visual / brand design",
  },
  data: {
    craft: "data / analytics / ML",
    technicalMeans: "analysis rigor, statistical reasoning, modelling choices, pipeline / SQL / data-quality work, and metric validity",
    forbid: "front-end / visual design, brand strategy, or unrelated application-feature architecture",
  },
  engineering: {
    craft: "software engineering",
    technicalMeans: "the candidate's ACTUAL stack as signalled by the resume (do not ask a frontend engineer about Kubernetes or a backend engineer about rendering performance); system design and architecture ARE in-scope for senior engineers",
    forbid: "brand / visual-design execution, marketing-funnel ownership, or sales-quota questions",
  },
  marketing: {
    craft: "marketing / growth",
    technicalMeans: "channel strategy, funnel / conversion analysis, positioning, campaign measurement, and growth experimentation",
    forbid: "writing production code, low-level system architecture, or implementing UI components",
  },
  sales: {
    craft: "sales / account management",
    technicalMeans: "pipeline management, discovery, objection handling, negotiation, and quota / forecast ownership",
    forbid: "writing code, system architecture, or executing visual design",
  },
  ops: {
    craft: "operations / program management",
    technicalMeans: "process design, cross-team coordination, risk / timeline management, and operational-metric ownership",
    forbid: "writing production code or low-level system architecture",
  },
};

/**
 * Build a hard "stay in this role's craft" rule for the question
 * generator's prompt. Returns "" only when role is blank (nothing to
 * anchor to). For an unrecognised but non-empty role it still returns a
 * generic fence so abstract weak-skills don't leak an adjacent
 * discipline's questions.
 */
export function buildDisciplineFence(role: string): string {
  const cleanRole = (role || "").trim();
  if (!cleanRole) return "";
  const discipline = classifyDiscipline(cleanRole);
  if (discipline === "generic") {
    return `DISCIPLINE FENCE (mandatory): the candidate's role is "${cleanRole}". Every question MUST stay inside the real day-to-day craft of THIS role. Interpret any abstract weak-skill (e.g. "technical depth", "business impact", "specificity") through the lens of this role's actual work — never an adjacent discipline's. Do NOT borrow a software-engineering, design, sales, or finance question unless that IS this role's craft.`;
  }
  const { craft, technicalMeans, forbid } = DISCIPLINE_CRAFT[discipline];
  return `DISCIPLINE FENCE (mandatory): the candidate's role is "${cleanRole}", a ${craft} role. Every question MUST stay inside that craft. Interpret abstract weak-skills through this lens — for this role, "technical depth" means ${technicalMeans}. It does NOT mean ${forbid}. Never ask a question that belongs to a different discipline; resolve any ambiguous weak-skill label to this role's craft.`;
}
