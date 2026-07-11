/* HireStepX — Canonical HR-round question bank
 *
 * HR rounds (TCS/Infosys/Wipro "HR round", the people-ops screen at
 * product cos, the closing fit-and-comp conversation) ask a stable,
 * recognisable set of questions. They are NOT STAR behavioural probes —
 * the signal is motivation, self-awareness, culture/values fit, comp
 * alignment, and logistics (notice period, relocation, availability).
 * Conflating them with the behavioural-50 gives candidates the wrong
 * prep, so HR gets its own bank.
 *
 * Used by `_generate-questions-helpers.ts` → `buildStaticFallback`: when
 * both LLM providers fail on an HR-round session, candidates get a
 * real-interviewer-grade HR set instead of silently degrading to
 * behavioural prompts (the pre-2026-06 bug — the static fallback never
 * mapped the "hr-round" type to the bank's "hr" focus, so it fell
 * through to tier-3 behavioural).
 *
 * Pure constants + a tiny deterministic sampler — no side effects, no
 * Date/Math.random (edge-runtime safe).
 */

/** The HR-round signal taxonomy. Deliberately compact so the sampler's
 *  dimension-dedupe spreads coverage across what HR rounds actually
 *  grade, not ten variants of "why this company". */
export const HR_DIMENSIONS = [
  "motivation",
  "career-goals",
  "self-awareness",
  "culture-values",
  "compensation",
  "interpersonal",
  "adaptability",
  "integrity",
  "logistics",
  "compliance",
  "company-knowledge",
] as const;

export type HrDimension = typeof HR_DIMENSIONS[number];

export interface HrQuestion {
  /** Stable id — analytics + cross-session dedupe. */
  id: string;
  text: string;
  dimension: HrDimension;
  /** How often this (or a near-paraphrase) shows up in real HR rounds,
   *  0–100. Soft weight when sampling "what HR actually asks". */
  frequencyPct: number;
  /** The universal "tell me about yourself / walk me through your
   *  background" opener. It IS the interview's opening beat, not a body
   *  question — callers render it as the intro, so the sampler excludes
   *  it from the body pool by default to avoid asking for the candidate's
   *  background twice in a row. */
  opener?: boolean;
}

/** Curated from real HR rounds across Indian service cos (TCS, Infosys,
 *  Wipro, Cognizant, Accenture, HCL), product cos (Razorpay, Flipkart,
 *  Swiggy, Freshworks, Zoho) and MNC GCCs. Phrasings normalised; intent
 *  is stable. */
export const HR_QUESTIONS: ReadonlyArray<HrQuestion> = [
  // ── Motivation ──
  { id: "mot-01", text: "Why do you want to join this company specifically, and not one of its competitors?", dimension: "motivation", frequencyPct: 88 },
  { id: "mot-02", text: "What made you start looking for a new role at this point in your career?", dimension: "motivation", frequencyPct: 80 },
  { id: "mot-03", text: "What about this role excites you the most?", dimension: "motivation", frequencyPct: 72 },

  // ── Career goals ──
  { id: "car-01", text: "Where do you see yourself three to five years from now?", dimension: "career-goals", frequencyPct: 85 },
  { id: "car-02", text: "What does the next step in your career look like, and how does this role fit into it?", dimension: "career-goals", frequencyPct: 66 },
  { id: "car-03", text: "Are you looking for depth in your current specialisation, or to broaden into something new?", dimension: "career-goals", frequencyPct: 48 },

  // ── Self-awareness ──
  { id: "self-01", text: "What would you say are your greatest strengths, and how have they shown up at work?", dimension: "self-awareness", frequencyPct: 82 },
  { id: "self-02", text: "What is one weakness you're actively working on, and what are you doing about it?", dimension: "self-awareness", frequencyPct: 84 },
  { id: "self-03", text: "How would your current manager and teammates describe you?", dimension: "self-awareness", frequencyPct: 58 },
  { id: "self-04", text: "Tell me about yourself — walk me through your background in a couple of minutes.", dimension: "self-awareness", frequencyPct: 90, opener: true },

  // ── Culture & values ──
  { id: "cul-01", text: "What kind of work environment helps you do your best work?", dimension: "culture-values", frequencyPct: 70 },
  { id: "cul-02", text: "What matters most to you in a manager or a team?", dimension: "culture-values", frequencyPct: 60 },
  { id: "cul-03", text: "How do you handle working on something you don't fully agree with?", dimension: "culture-values", frequencyPct: 55 },

  // ── Compensation ──
  { id: "comp-01", text: "What are your salary expectations for this role?", dimension: "compensation", frequencyPct: 86 },
  { id: "comp-02", text: "What is your current compensation, and what would make a move worth it for you?", dimension: "compensation", frequencyPct: 64 },
  { id: "comp-03", text: "Beyond salary, what else matters to you in an offer?", dimension: "compensation", frequencyPct: 40 },

  // ── Interpersonal ──
  { id: "intp-01", text: "How do you handle disagreements with a colleague or manager?", dimension: "interpersonal", frequencyPct: 68 },
  { id: "intp-02", text: "Tell me about a time you had to work with a difficult teammate. How did you manage it?", dimension: "interpersonal", frequencyPct: 62 },

  // ── Adaptability ──
  { id: "adp-01", text: "How do you adjust when priorities or requirements change suddenly?", dimension: "adaptability", frequencyPct: 58 },
  { id: "adp-02", text: "Tell me about a significant change at work and how you adapted to it.", dimension: "adaptability", frequencyPct: 50 },

  // ── Integrity ──
  { id: "int-01", text: "Tell me about a time you had to choose between the easy option and the right one.", dimension: "integrity", frequencyPct: 46 },
  { id: "int-02", text: "Have you ever disagreed with a decision but had to support it anyway? How did you handle that?", dimension: "integrity", frequencyPct: 42 },

  // ── Logistics ──
  { id: "log-01", text: "What is your notice period, and how soon could you join if we made an offer?", dimension: "logistics", frequencyPct: 78 },
  { id: "log-02", text: "Are you comfortable with this role's location and work model — on-site, hybrid, or remote?", dimension: "logistics", frequencyPct: 60 },
  { id: "log-03", text: "Do you have any other offers or processes in progress right now?", dimension: "logistics", frequencyPct: 44 },

  // ── Compliance / BGV (the 13% "Compliance readiness" rubric dimension) ──
  { id: "cmp-01", text: "Our offer is subject to background verification. Are you comfortable sharing your last 3 months' payslips, Form 16, and relieving letters from previous employers?", dimension: "compliance", frequencyPct: 76 },
  { id: "cmp-02", text: "Do you have any overlapping employment, consulting, or freelance engagements we should know about before the BGV runs? Your UAN will show concurrent PF contributions.", dimension: "compliance", frequencyPct: 58 },
  { id: "cmp-03", text: "Are there any gaps, short stints, or prior background-check issues we should discuss up front so nothing surprises us later?", dimension: "compliance", frequencyPct: 50 },

  // ── Company knowledge ──
  { id: "cok-01", text: "What do you know about what we do, and where do you think you'd add value?", dimension: "company-knowledge", frequencyPct: 65 },
  { id: "cok-02", text: "Why should we hire you over other candidates for this role?", dimension: "company-knowledge", frequencyPct: 74 },
];

/* ─── Deterministic sampler ──────────────────────────────────────────
   Linear congruential generator → reproducible shuffle from a seed.
   No Date/Math.random so the result is stable across edge invocations
   and unit-testable. Mirrors the behavioural bank's approach. */
function lcg(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    // Numerical Recipes constants.
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffle<T>(arr: ReadonlyArray<T>, rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface SampleHrOpts {
  count: number;
  seed: number;
  /** When true, bias the order toward higher-frequency questions. */
  weightByFrequency?: boolean;
  /** Include the opener ("tell me about yourself") in the pool. Off by
   *  default: the opener is rendered as the intro beat, so sampling it
   *  into the body would ask for the candidate's background twice. */
  includeOpener?: boolean;
  /** Dimensions the caller wants surfaced FIRST — the sampler fills these
   *  before the neutral round-robin. Lets the caller reflect the resolved
   *  HR rubric (e.g. a senior candidate's higher comp/commitment weight,
   *  a fresher's self-awareness/motivation weight) so the draw isn't blind
   *  to what this candidate's round actually grades hardest. A soft boost,
   *  not a filter: non-prioritised dimensions still fill the remaining
   *  slots. Empty / omitted → the prior neutral behaviour. */
  prioritiseDimensions?: ReadonlyArray<HrDimension>;
}

/** Pick `count` HR *body* questions, spreading coverage across dimensions
 *  before allowing a second question from any one dimension. Excludes the
 *  opener by default (see `includeOpener`). Returns at most the pool size;
 *  never throws. Deterministic for a given (count, seed). */
export function sampleHrQuestions(opts: SampleHrOpts): HrQuestion[] {
  const source = opts.includeOpener
    ? HR_QUESTIONS
    : HR_QUESTIONS.filter((q) => !q.opener);
  const requested = Math.max(0, Math.min(opts.count, source.length));
  if (requested === 0) return [];
  const rand = lcg(opts.seed);

  let pool = shuffle(source, rand);
  if (opts.weightByFrequency) {
    // Stable sort by frequency DESC over the already-shuffled order so
    // ties stay seed-varied rather than bank-order-locked.
    pool = pool
      .map((q, i) => ({ q, i }))
      .sort((a, b) => b.q.frequencyPct - a.q.frequencyPct || a.i - b.i)
      .map((x) => x.q);
  }

  // Pass 1: one question per dimension until we hit the target. Prioritised
  // dimensions (the resolved rubric's heaviest) fill first so a short draw
  // still surfaces what this candidate's round grades hardest; the neutral
  // round-robin then covers the rest.
  const out: HrQuestion[] = [];
  const usedDimensions = new Set<HrDimension>();
  const prioritised = new Set(opts.prioritiseDimensions || []);
  if (prioritised.size > 0) {
    for (const q of pool) {
      if (out.length >= requested) break;
      if (!prioritised.has(q.dimension)) continue;
      if (usedDimensions.has(q.dimension)) continue;
      usedDimensions.add(q.dimension);
      out.push(q);
    }
  }
  for (const q of pool) {
    if (out.length >= requested) break;
    if (usedDimensions.has(q.dimension)) continue;
    usedDimensions.add(q.dimension);
    out.push(q);
  }

  // Pass 2: backfill with remaining questions if the dimension count
  // was smaller than the request.
  if (out.length < requested) {
    const picked = new Set(out.map((q) => q.id));
    for (const q of pool) {
      if (out.length >= requested) break;
      if (picked.has(q.id)) continue;
      out.push(q);
    }
  }

  return out;
}
