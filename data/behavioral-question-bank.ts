/* HireStepX — Canonical behavioural question bank (the 50)
 *
 * Anyone who's run 5+ real behavioural loops at Indian product cos
 * (Razorpay, Flipkart, Swiggy, Atlassian-India, Microsoft IDC, etc.)
 * recognises the same ~50 questions on rotation. Phrasings vary, but
 * the *intent* is stable: each question maps to a specific competency
 * that the company's leadership-principles framework cares about.
 *
 * This file is the single source of truth for that bank. Used in
 * three places:
 *   1. `_generate-questions-helpers.ts` → static fallback when both
 *      LLM providers fail, gives candidates a real-interviewer-grade
 *      set instead of generic prompts.
 *   2. `follow-up.ts` → competency tag steers the follow-up coach
 *      toward the right deepener (e.g. conflict.* probes on conflict
 *      questions).
 *   3. `evaluate-session.ts` → `blindSpots` is fixed against this
 *      taxonomy so the report's coverage signal is deterministic
 *      across runs.
 *
 * Phrasing rule: every question begins with "Tell me about a time" —
 * that's the canonical real-interviewer opener. Variants like
 * "Describe a situation…" / "Walk me through a time…" exist but
 * normalising to one phrasing makes the bank greppable and the
 * static-fallback experience consistent.
 *
 * Pure constants + tiny deterministic sampler — no side-effects,
 * safe to import from Edge runtime.
 */

/** The 12-competency taxonomy. Mirrors what FAANG-India + top-tier
 *  Indian product cos actually grade against — a deliberately compact
 *  set so blindSpots in the report stays interpretable. */
export const BEHAVIORAL_COMPETENCIES = [
  "ownership",
  "failure",
  "pressure-deadlines",
  "conflict",
  "feedback",
  "influence",
  "ambiguity",
  "decision-making",
  "problem-solving",
  "mentorship-team",
  "communication",
  "integrity-trust",
  /* Added 2026-05: adaptability + execution-rigor.
     Two competencies real Indian-product-co loops grade against but the
     original 12-set folded into others (adaptability got bucketed under
     ambiguity; execution-rigor under ownership). Splitting them out so
     blindSpots in the report can say "your loop missed adaptability"
     instead of conflating it with "ambiguity" — different coaching tip,
     different probe bank. */
  "adaptability",
  "execution-rigor",
] as const;

export type BehavioralCompetency = typeof BEHAVIORAL_COMPETENCIES[number];

/** Human-readable label for each competency, used in the evaluator's
 *  blindSpots field + UI surfaces. Keep them short — these render in
 *  badge chips. */
export const COMPETENCY_LABELS: Record<BehavioralCompetency, string> = {
  "ownership": "Ownership",
  "failure": "Failure & resilience",
  "pressure-deadlines": "Pressure & deadlines",
  "conflict": "Conflict & disagreement",
  "feedback": "Receiving feedback",
  "influence": "Influence without authority",
  "ambiguity": "Operating in ambiguity",
  "decision-making": "Decision-making",
  "problem-solving": "Problem-solving",
  "mentorship-team": "Mentorship & team",
  "communication": "Communication",
  "integrity-trust": "Integrity & trust",
  "adaptability": "Adaptability",
  "execution-rigor": "Execution rigor",
};

/** Which STAR slot the question is biased toward — used by the
 *  evaluator's gap detector to know what to score most strictly. */
export type StarFocus = "action" | "result" | "situation-task" | "action+result";

/** Coarse difficulty band. `warmup` = early-loop / openers,
 *  `standard` = bulk of the bank, `hard` = senior / staff-level
 *  scenarios where ambiguity or conflict is high. */
export type BehavioralDifficulty = "warmup" | "standard" | "hard";

/** Role families used for tilt — keep deliberately coarse so tagging
 *  stays cheap and the sampler's role match doesn't over-fit. */
export type BehavioralRole = "pm" | "engineer" | "designer" | "manager" | "data" | "ops" | "marketing" | "sales";

export const BEHAVIORAL_ROLES: ReadonlyArray<BehavioralRole> = [
  "pm",
  "engineer",
  "designer",
  "manager",
  "data",
  "ops",
  // marketing + sales carry no affinity-tagged questions of their own yet —
  // they exist so the sampler can STEER these candidates away from
  // discipline-locked questions (e.g. an engineer's "complex codebase"
  // probe) into the universal pool, instead of role:undefined → no steering.
  "marketing",
  "sales",
] as const;

export interface BehavioralQuestion {
  /** Stable id — used for analytics + dedupe across sessions. */
  id: string;
  text: string;
  competency: BehavioralCompetency;
  starFocus: StarFocus;
  difficulty: BehavioralDifficulty;
  /** How often this question (or near-paraphrase) shows up in real
   *  loops, 0–100. Used as a soft weight in the sampler when the
   *  caller wants "what interviewers actually ask" ordering. */
  frequencyPct: number;
  /** Which role families this question fits best. Empty = universal (any role). */
  roleAffinity?: ReadonlyArray<BehavioralRole>;
  /** Minimum YoE (years of experience) this question is appropriate for.
   * 0 = anyone; 5 = senior+; 8 = staff+. */
  seniorityFloor?: number;
}

/** The bank (originally 50, grew to 56 with adaptability + execution-rigor
 *  split-out in 2026-05, then to 61 with Phase-6.6 designer-affinity
 *  additions in 2026-05). Curated from real loops at: Razorpay, Flipkart,
 *  Swiggy, Zomato, CRED, Atlassian-IN, Microsoft IDC, Amazon-IN,
 *  Google-IN, Uber-IN, Walmart-Labs, ThoughtSpot, Postman, Freshworks.
 *  Export name kept as `BEHAVIORAL_50` (historical brand — `.length` is
 *  the authoritative size, not the constant name). */
export const BEHAVIORAL_50: ReadonlyArray<BehavioralQuestion> = [
  // ── ownership (5)
  { id: "own-01", text: "Tell me about a time you took ownership of something outside your job description.",                competency: "ownership",          starFocus: "action",          difficulty: "standard", frequencyPct: 78, seniorityFloor: 2 },
  { id: "own-02", text: "Tell me about a time you saw a problem nobody else noticed and fixed it.",                            competency: "ownership",          starFocus: "action+result",   difficulty: "standard", frequencyPct: 72, seniorityFloor: 2 },
  { id: "own-03", text: "Tell me about a time you went above and beyond on a project.",                                        competency: "ownership",          starFocus: "action",          difficulty: "warmup",   frequencyPct: 65 },
  { id: "own-04", text: "Tell me about a time you owned a decision that turned out to be wrong.",                              competency: "ownership",          starFocus: "result",          difficulty: "hard",     frequencyPct: 60, seniorityFloor: 2 },
  { id: "own-05", text: "Tell me about a time you had to clean up a mess you didn't create.",                                  competency: "ownership",          starFocus: "action",          difficulty: "standard", frequencyPct: 55 },

  // ── failure (4)
  { id: "fail-01", text: "Tell me about a time you failed.",                                                                    competency: "failure",            starFocus: "action+result",   difficulty: "standard", frequencyPct: 88 },
  { id: "fail-02", text: "Tell me about a time a project you led missed its goal.",                                            competency: "failure",            starFocus: "result",          difficulty: "hard",     frequencyPct: 70 },
  { id: "fail-03", text: "Tell me about a time you made a mistake that affected your team.",                                   competency: "failure",            starFocus: "action+result",   difficulty: "standard", frequencyPct: 68 },
  { id: "fail-04", text: "Tell me about a time you took a risk and it didn't pay off.",                                        competency: "failure",            starFocus: "result",          difficulty: "hard",     frequencyPct: 50 },

  // ── pressure-deadlines (4)
  { id: "prs-01", text: "Tell me about a time you had to deliver under a tight deadline.",                                     competency: "pressure-deadlines", starFocus: "action",          difficulty: "standard", frequencyPct: 82 },
  { id: "prs-02", text: "Tell me about a time you had to juggle multiple high-priority tasks.",                                competency: "pressure-deadlines", starFocus: "action",          difficulty: "standard", frequencyPct: 75 },
  { id: "prs-03", text: "Tell me about a time you had to deliver something during a production incident.",                     competency: "pressure-deadlines", starFocus: "action+result",   difficulty: "hard",     frequencyPct: 58 },
  { id: "prs-04", text: "Tell me about a time the scope changed mid-sprint and you had to ship anyway.",                       competency: "pressure-deadlines", starFocus: "action",          difficulty: "hard",     frequencyPct: 52 },

  // ── conflict (5)
  { id: "cnf-01", text: "Tell me about a time you disagreed with your manager.",                                               competency: "conflict",           starFocus: "action",          difficulty: "standard", frequencyPct: 85 },
  { id: "cnf-02", text: "Tell me about a time you had a conflict with a teammate.",                                            competency: "conflict",           starFocus: "action",          difficulty: "standard", frequencyPct: 80 },
  { id: "cnf-03", text: "Tell me about a time a peer pushed back hard on your technical decision.",                            competency: "conflict",           starFocus: "action+result",   difficulty: "hard",     frequencyPct: 62, roleAffinity: ["engineer", "designer"] },
  { id: "cnf-04", text: "Tell me about a time you had to deliver bad news to a stakeholder.",                                  competency: "conflict",           starFocus: "action",          difficulty: "standard", frequencyPct: 55, seniorityFloor: 3 },
  { id: "cnf-05", text: "Tell me about a time you had to work with someone whose style clashed with yours.",                   competency: "conflict",           starFocus: "action",          difficulty: "standard", frequencyPct: 50 },
  /* Designer-affinity additions (Phase 6.6, 2026-05).
     Senior Product Designer loops grade influence + judgement + leadership
     alongside execution. Pre-Phase-6.6 the bank had zero designer-affinity
     entries — designers fell through to universal questions and missed the
     SPD-specific shape: disagreement on design decisions with cross-functional
     partners, UX-vs-business trade-offs, changing direction after critique/data,
     raising team design quality. Each entry below maps 1:1 to a real loop
     question pattern from senior-designer rounds at Indian product cos
     (Razorpay, Flipkart, Swiggy, Meesho, Atlassian-IN). */
  { id: "cnf-06", text: "Tell me about a time you disagreed with a PM or engineer on a design decision. How did you resolve it?", competency: "conflict",        starFocus: "action",          difficulty: "standard", frequencyPct: 75, roleAffinity: ["designer"], seniorityFloor: 3 },

  // ── feedback (3)
  { id: "fdb-01", text: "Tell me about a time you received tough feedback.",                                                    competency: "feedback",           starFocus: "action+result",   difficulty: "standard", frequencyPct: 72 },
  { id: "fdb-02", text: "Tell me about a time feedback changed how you worked.",                                                competency: "feedback",           starFocus: "result",          difficulty: "standard", frequencyPct: 60 },
  { id: "fdb-03", text: "Tell me about a time you had to give difficult feedback to a peer.",                                   competency: "feedback",           starFocus: "action",          difficulty: "hard",     frequencyPct: 55, roleAffinity: ["manager", "pm"] },
  { id: "fdb-04", text: "Tell me about a time you changed your design direction after critique, user research, or data.",      competency: "feedback",           starFocus: "action+result",   difficulty: "standard", frequencyPct: 70, roleAffinity: ["designer"], seniorityFloor: 2 },

  // ── influence (4)
  { id: "inf-01", text: "Tell me about a time you convinced someone to change their mind.",                                    competency: "influence",          starFocus: "action",          difficulty: "standard", frequencyPct: 78 },
  { id: "inf-02", text: "Tell me about a time you had to influence a team without formal authority.",                          competency: "influence",          starFocus: "action",          difficulty: "hard",     frequencyPct: 70 },
  { id: "inf-03", text: "Tell me about a time you sold an unpopular idea internally.",                                          competency: "influence",          starFocus: "action+result",   difficulty: "hard",     frequencyPct: 50, roleAffinity: ["pm", "manager"] },
  { id: "inf-04", text: "Tell me about a time you got buy-in from a senior leader.",                                            competency: "influence",          starFocus: "action",          difficulty: "standard", frequencyPct: 48, roleAffinity: ["pm", "manager"] },

  // ── ambiguity (4)
  { id: "amb-01", text: "Tell me about a time you worked on something with unclear requirements.",                             competency: "ambiguity",          starFocus: "action",          difficulty: "standard", frequencyPct: 75 },
  { id: "amb-02", text: "Tell me about a time you had to make progress without knowing the full picture.",                     competency: "ambiguity",          starFocus: "action",          difficulty: "hard",     frequencyPct: 60 },
  { id: "amb-03", text: "Tell me about a time you defined a problem nobody had framed before.",                                competency: "ambiguity",          starFocus: "situation-task",  difficulty: "hard",     frequencyPct: 45, seniorityFloor: 5 },
  { id: "amb-04", text: "Tell me about a time the priorities shifted and you had to re-plan.",                                  competency: "ambiguity",          starFocus: "action",          difficulty: "standard", frequencyPct: 55 },
  { id: "amb-05", text: "Tell me about a time the problem statement was unclear and you had to create clarity for the team through design.", competency: "ambiguity",       starFocus: "situation-task",   difficulty: "standard", frequencyPct: 62, roleAffinity: ["designer"] },

  // ── decision-making (5)
  { id: "dec-01", text: "Tell me about a time you had to make a decision with incomplete data.",                                competency: "decision-making",    starFocus: "action",          difficulty: "standard", frequencyPct: 80, seniorityFloor: 3 },
  { id: "dec-02", text: "Tell me about a time you had to choose between two reasonable options.",                              competency: "decision-making",    starFocus: "action",          difficulty: "standard", frequencyPct: 65, seniorityFloor: 3 },
  { id: "dec-03", text: "Tell me about a time you reversed a decision you'd already made.",                                    competency: "decision-making",    starFocus: "action+result",   difficulty: "hard",     frequencyPct: 50, seniorityFloor: 5 },
  { id: "dec-04", text: "Tell me about a time you had to say no to a stakeholder.",                                            competency: "decision-making",    starFocus: "action",          difficulty: "standard", frequencyPct: 58, seniorityFloor: 3 },
  { id: "dec-05", text: "Tell me about a time you traded off speed against quality.",                                          competency: "decision-making",    starFocus: "action+result",   difficulty: "standard", frequencyPct: 62, seniorityFloor: 3 },
  { id: "dec-06", text: "Tell me about a time you had to balance user experience with a business goal or revenue metric.",     competency: "decision-making",    starFocus: "action+result",   difficulty: "hard",     frequencyPct: 72, roleAffinity: ["designer", "pm"], seniorityFloor: 3 },

  // ── problem-solving (4)
  { id: "prb-01", text: "Tell me about a time you debugged a problem nobody else could crack.",                                competency: "problem-solving",    starFocus: "action+result",   difficulty: "hard",     frequencyPct: 70, roleAffinity: ["engineer"] },
  { id: "prb-02", text: "Tell me about a time you simplified something complex.",                                              competency: "problem-solving",    starFocus: "action",          difficulty: "standard", frequencyPct: 60 },
  { id: "prb-03", text: "Tell me about a time you found a creative solution to a constraint.",                                 competency: "problem-solving",    starFocus: "action",          difficulty: "standard", frequencyPct: 58 },
  { id: "prb-04", text: "Tell me about a time you used data to change a decision.",                                            competency: "problem-solving",    starFocus: "action+result",   difficulty: "standard", frequencyPct: 65, roleAffinity: ["pm", "manager"] },

  // ── mentorship-team (4)
  { id: "mnt-01", text: "Tell me about a time you mentored someone.",                                                          competency: "mentorship-team",    starFocus: "action+result",   difficulty: "warmup",   frequencyPct: 70, seniorityFloor: 3 },
  { id: "mnt-02", text: "Tell me about a time you helped a struggling teammate.",                                              competency: "mentorship-team",    starFocus: "action",          difficulty: "standard", frequencyPct: 60, roleAffinity: ["manager", "pm", "designer"] },
  { id: "mnt-03", text: "Tell me about a time you onboarded a new joiner onto a complex codebase.",                            competency: "mentorship-team",    starFocus: "action",          difficulty: "standard", frequencyPct: 45, seniorityFloor: 3, roleAffinity: ["engineer"] },
  { id: "mnt-04", text: "Tell me about a time you delegated something you would normally do yourself.",                        competency: "mentorship-team",    starFocus: "action",          difficulty: "hard",     frequencyPct: 40, seniorityFloor: 5 },
  { id: "mnt-05", text: "Tell me about a time you raised the design quality of your team — through mentoring juniors, running design crits, or building a system.", competency: "mentorship-team", starFocus: "action+result", difficulty: "hard", frequencyPct: 65, roleAffinity: ["designer"], seniorityFloor: 5 },

  // ── communication (4)
  { id: "cmm-01", text: "Tell me about a time you had to explain something technical to a non-technical audience.",            competency: "communication",      starFocus: "action+result",   difficulty: "warmup",   frequencyPct: 80 },
  { id: "cmm-02", text: "Tell me about a time a miscommunication caused a problem.",                                            competency: "communication",      starFocus: "result",          difficulty: "standard", frequencyPct: 55 },
  { id: "cmm-03", text: "Tell me about a time you had to communicate a delay or slip.",                                         competency: "communication",      starFocus: "action",          difficulty: "standard", frequencyPct: 58 },
  { id: "cmm-04", text: "Tell me about a time you presented work to senior leadership.",                                       competency: "communication",      starFocus: "action+result",   difficulty: "standard", frequencyPct: 50 },

  // ── integrity-trust (4)
  { id: "int-01", text: "Tell me about a time you had to admit you didn't know something.",                                    competency: "integrity-trust",    starFocus: "action",          difficulty: "warmup",   frequencyPct: 60 },
  { id: "int-02", text: "Tell me about a time you spoke up about something that wasn't right.",                                 competency: "integrity-trust",    starFocus: "action+result",   difficulty: "hard",     frequencyPct: 50 },
  { id: "int-03", text: "Tell me about a time you escalated something despite political risk.",                                competency: "integrity-trust",    starFocus: "action",          difficulty: "hard",     frequencyPct: 42, seniorityFloor: 5 },
  { id: "int-04", text: "Tell me about a time you took credit for less than you contributed.",                                 competency: "integrity-trust",    starFocus: "action",          difficulty: "standard", frequencyPct: 38, seniorityFloor: 4 },

  // ── adaptability (3)
  { id: "adp-01", text: "Tell me about a time you had to adapt to a major change at work.",                                    competency: "adaptability",       starFocus: "action",          difficulty: "warmup",   frequencyPct: 68 },
  { id: "adp-02", text: "Tell me about a time you had to learn a new skill or tool quickly to ship something.",                competency: "adaptability",       starFocus: "action+result",   difficulty: "standard", frequencyPct: 65 },
  { id: "adp-03", text: "Tell me about a time you had to switch context between very different problems in a single day.",    competency: "adaptability",       starFocus: "action",          difficulty: "hard",     frequencyPct: 45, seniorityFloor: 3 },

  // ── execution-rigor (3)
  { id: "exr-01", text: "Tell me about a time you caught a bug or issue in your own work before it shipped.",                  competency: "execution-rigor",    starFocus: "action+result",   difficulty: "warmup",   frequencyPct: 60 },
  { id: "exr-02", text: "Tell me about a time a missed detail came back to bite you.",                                         competency: "execution-rigor",    starFocus: "result",          difficulty: "standard", frequencyPct: 55 },
  { id: "exr-03", text: "Tell me about a time you traded thoroughness for speed and had to defend the call later.",            competency: "execution-rigor",    starFocus: "action+result",   difficulty: "hard",     frequencyPct: 48, seniorityFloor: 3 },
];

/** Canonical export name. `BEHAVIORAL_50` is the legacy alias kept for
 *  backward-compat with existing call-sites; new code should import
 *  `BEHAVIORAL_BANK`. Both point at the same array — the name is the
 *  only difference. The "50" suffix is historical (the bank started at
 *  50 entries before adaptability + execution-rigor split out in
 *  2026-05). */
export const BEHAVIORAL_BANK = BEHAVIORAL_50;

/* ─────────── Deterministic sampler ─────────── */

/** Tiny LCG — same seed in, same sequence out, no entropy from
 *  Math.random. Numbers chosen are Numerical Recipes constants. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
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

/** Weighted shuffle: produce an ordering where higher-weight items are
 *  more likely to land near the top. Implemented as the standard
 *  weighted-random-sample-without-replacement: each item gets a key of
 *  `-ln(rand) / weight`, then sort ascending. Same seed → same output.
 *  Weights ≤ 0 are clamped to 1 so a missing/zero `frequencyPct` doesn't
 *  starve the entry entirely. */
function weightedShuffle<T extends { frequencyPct: number }>(
  arr: ReadonlyArray<T>,
  rand: () => number,
): T[] {
  return arr
    .map(item => {
      const w = Math.max(1, item.frequencyPct);
      // Avoid log(0); rand can be 0 with very rare LCG draws.
      const u = Math.max(rand(), 1e-9);
      return { item, key: -Math.log(u) / w };
    })
    .sort((a, b) => a.key - b.key)
    .map(x => x.item);
}

export interface SampleOpts {
  count: number;
  seed: number;
  /** When set, exclude `hard` (warmup) or `warmup` (hard) — gives the
   *  early-loop / late-loop tuning. `standard` returns everything. */
  difficulty?: BehavioralDifficulty;
  /** Competencies the caller wants prioritised — the sampler fills
   *  these first, then dedupes the remainder by competency. */
  prioritise?: ReadonlyArray<BehavioralCompetency>;
  /** Candidate's role family — questions whose roleAffinity doesn't
   *  include this role are downweighted (not eliminated, since most
   *  questions are universal). */
  role?: BehavioralRole;
  /** Candidate's years of experience — questions with seniorityFloor
   *  > yoe are hard-filtered (would be inappropriate to ask). */
  yoe?: number;
  /** When true, the deterministic shuffle is replaced with a
   *  frequency-weighted draw — questions with higher `frequencyPct`
   *  are more likely to land in the top of the order. Still seedable;
   *  same seed → same output. Off by default so existing call-sites
   *  (and the seed=42 backward-compat pin) keep their behaviour. The
   *  static-fallback in `_generate-questions-helpers.ts` opts in so a
   *  candidate hit by the LLM-down path still gets "what interviewers
   *  actually ask" ordering. */
  weightByFrequency?: boolean;
}

/** Deterministic sampler. Behaviour:
 *  - When `count` ≤ competency count (12), every returned question
 *    has a unique competency — interview coverage > question count.
 *  - When `count` > 12, falls through to second-pass fill from the
 *    remaining pool (now duplicates of competency are allowed).
 *  - Hard cap = bank size; oversize requests truncate silently. */
export function sampleBehavioralQuestions(opts: SampleOpts): BehavioralQuestion[] {
  const rand = lcg(opts.seed);
  const competencyCount = BEHAVIORAL_COMPETENCIES.length;
  const requested = Math.max(0, Math.min(opts.count, BEHAVIORAL_50.length));

  // 0) Hard-filter by seniority — questions whose floor is above the
  //    candidate's YoE would be inappropriate to ask. Runs BEFORE
  //    difficulty filter so the difficulty pool reflects what's actually
  //    askable.
  let pool: BehavioralQuestion[] = BEHAVIORAL_50.slice();
  if (typeof opts.yoe === "number") {
    const yoe = opts.yoe;
    pool = pool.filter(q => (q.seniorityFloor ?? 0) <= yoe);
  }

  // 1) Filter by difficulty intent
  if (opts.difficulty === "warmup") {
    pool = pool.filter(q => q.difficulty !== "hard");
  } else if (opts.difficulty === "hard") {
    pool = pool.filter(q => q.difficulty !== "warmup");
  }

  // 2) Shuffle deterministically. If a role is set, partition the
  //    shuffled order: matching-or-universal first, explicit-other-role
  //    last. We exhaust partition A before falling through to B so the
  //    sampler "prefers" but doesn't "eliminate". When role is absent,
  //    the shuffled order is used verbatim — preserving pre-change
  //    behaviour exactly.
  const shuffledRaw = opts.weightByFrequency
    ? weightedShuffle(pool, rand)
    : shuffle(pool, rand);
  let shuffled: BehavioralQuestion[];
  if (opts.role) {
    const role = opts.role;
    const matches: BehavioralQuestion[] = [];
    const others: BehavioralQuestion[] = [];
    for (const q of shuffledRaw) {
      if (!q.roleAffinity || q.roleAffinity.length === 0 || q.roleAffinity.includes(role)) {
        matches.push(q);
      } else {
        others.push(q);
      }
    }
    shuffled = matches.concat(others);
  } else {
    shuffled = shuffledRaw;
  }

  // 3) First pass: dedupe by competency until we hit min(requested, 12)
  const firstPassTarget = Math.min(requested, competencyCount);
  const prioritiseSet = new Set(opts.prioritise || []);
  const out: BehavioralQuestion[] = [];
  const usedCompetencies = new Set<BehavioralCompetency>();

  // Fill prioritised competencies first
  if (prioritiseSet.size > 0) {
    for (const q of shuffled) {
      if (out.length >= firstPassTarget) break;
      if (!prioritiseSet.has(q.competency)) continue;
      if (usedCompetencies.has(q.competency)) continue;
      out.push(q);
      usedCompetencies.add(q.competency);
    }
  }

  // Then fill remaining competencies deduped
  for (const q of shuffled) {
    if (out.length >= firstPassTarget) break;
    if (usedCompetencies.has(q.competency)) continue;
    out.push(q);
    usedCompetencies.add(q.competency);
  }

  // 4) Second pass: if caller wanted more than competency count,
  //    fill the rest from whatever remains (allow duplicate competencies)
  if (out.length < requested) {
    const remaining = shuffled.filter(q => !out.includes(q));
    for (const q of remaining) {
      if (out.length >= requested) break;
      out.push(q);
    }
  }

  return out;
}
