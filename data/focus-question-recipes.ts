/**
 * Focus-specific question recipes.
 *
 * Each interview focus gets a recipe that tells the LLM:
 *   - Which CategoryKeys to draw from (mandatory + optional)
 *   - The arc/sequence shape (Q1 warm → QN signature)
 *   - Trap-question budget (some focuses use them; others don't)
 *   - Whether candidate-asks-back is part of the closing flow
 *
 * Recipes are translated to a prompt-fragment by formatRecipe()
 * which ships with the focus's TYPE_GUIDANCE in generate-questions.
 *
 * Why centralised vs hard-coded in generate-questions: when we add a
 * new focus type (e.g. "case-study-mini") we want one place to
 * declare its question mix. And the recipes are unit-testable.
 */

import { CATEGORIES, type CategoryKey } from "./question-taxonomy";

export interface FocusRecipe {
  /** Human label for prompt header. */
  label: string;
  /** Category keys that MUST appear in the question set, in roughly this order. */
  mandatory: CategoryKey[];
  /** Category keys that MAY be drawn from to fill remaining slots. */
  optional: CategoryKey[];
  /** Trap-question slots — 0 = none, 1 = at most one, 2 = up to two. */
  trapBudget: 0 | 1 | 2;
  /** True if the closing turn should explicitly invite candidate questions
   *  (and the AI should be ready to answer them). */
  inviteCandidateQuestions: boolean;
  /** Optional one-liner about pacing / depth that supplements TYPE_GUIDANCE. */
  pacingNote?: string;
}

/** Map of focus → recipe. Keys match `interviewType` in generate-questions.ts. */
export const RECIPES: Record<string, FocusRecipe> = {
  /* ─── Behavioral (general) ─── */
  behavioral: {
    label: "Behavioral",
    mandatory: ["opening-resume", "experience-deepdive", "ownership", "collaboration", "problem-solving"],
    optional: ["communication", "leadership", "decision-making", "pressure-resilience", "adaptability-learning"],
    trapBudget: 1,
    inviteCandidateQuestions: true,
    pacingNote: "Q1 is opening (low-stakes), Q2 is the deep-dive on a real project, Q3-4 mix collaboration/problem-solving with one optional, Q5 is the signature stretch — failure, judgement, or trade-off.",
  },

  /* ─── HR Round (Indian context) ─── */
  "hr-round": {
    label: "HR round",
    mandatory: ["opening-resume", "hr-essentials", "culture-fit", "salary-practical"],
    optional: ["pressure-resilience", "communication", "adaptability-learning"],
    trapBudget: 1,
    inviteCandidateQuestions: true,
    pacingNote: "At least TWO HR-essentials (current/expected CTC, notice period, why leaving, gap explanation, why us). At least ONE culture-fit. The trap question, if used, should target rehearsed answers (fake weakness, generic 'why us').",
  },

  /* ─── Managerial / cross-functional ─── */
  managerial: {
    label: "Managerial",
    mandatory: ["managerial", "leadership", "decision-making", "experience-deepdive"],
    optional: ["communication", "ownership", "adaptability-learning"],
    trapBudget: 1,
    inviteCandidateQuestions: true,
    pacingNote: "Focus on planning, escalation, stakeholder handling, decision rationale. At least ONE 'first 30 days' or 'business impact' question.",
  },

  /* ─── Panel ─── */
  panel: {
    label: "Panel",
    mandatory: ["opening-resume", "experience-deepdive", "leadership", "decision-making"],
    optional: ["problem-solving", "collaboration", "communication", "culture-fit"],
    trapBudget: 1,
    inviteCandidateQuestions: true,
    pacingNote: "Distribute categories across the three personas: Hiring Manager → leadership/decision/strategic, Technical Lead → problem-solving/experience-deepdive, HR Partner → collaboration/culture-fit/communication.",
  },

  /* ─── Campus placement (freshers) ─── */
  "campus-placement": {
    label: "Campus placement",
    mandatory: ["opening-resume", "experience-deepdive", "problem-solving", "culture-fit"],
    optional: ["adaptability-learning", "collaboration", "communication"],
    trapBudget: 0,
    inviteCandidateQuestions: true,
    pacingNote: "Tailor experience-deepdive to college projects/internships. Skip ownership/leadership categories — not relevant for 0-2 yrs. Trap budget = 0 (don't trap freshers).",
  },

  /* ─── Case study ─── */
  "case-study": {
    label: "Case study",
    mandatory: ["problem-solving", "decision-making", "communication"],
    optional: ["customer-user"],
    trapBudget: 0,
    inviteCandidateQuestions: false,
    pacingNote: "Recipe is structural — single evolving case, not category-mix. Categories listed are the EVALUATION lens, not separate questions. The case arc itself (FRAME → STRUCTURE → QUANTIFY → REVEAL → SYNTHESIZE) is defined in TYPE_GUIDANCE.",
  },

  /* ─── System design / technical ─── */
  "system-design": {
    label: "System design",
    mandatory: ["problem-solving", "decision-making", "experience-deepdive"],
    optional: ["customer-user", "communication"],
    trapBudget: 0,
    inviteCandidateQuestions: false,
    pacingNote: "Categories are the evaluation lens; the questions themselves are technical. Probe trade-offs, scale assumptions, and recovery paths.",
  },

  /* ─── Salary negotiation ─── */
  "salary-negotiation": {
    label: "Salary negotiation",
    mandatory: ["salary-practical"],
    optional: [],
    trapBudget: 0,
    inviteCandidateQuestions: false,
    pacingNote: "Salary-neg has its own dedicated arc in TYPE_GUIDANCE (intro → offer → probe → counter → benefits → close). This recipe is informational only.",
  },

  /* ─── Mini (3-question quick session) ─── */
  mini: {
    label: "Mini interview (3 questions)",
    mandatory: ["opening-resume", "experience-deepdive"],
    optional: ["problem-solving", "ownership", "decision-making", "communication"],
    trapBudget: 0,
    inviteCandidateQuestions: false,
    pacingNote: "Three questions only. Q1 = opener (60s), Q2 = deep-dive on one real project, Q3 = pick ONE optional category that fits the resume.",
  },
};

/**
 * Format a recipe into a prompt fragment. The output is concatenated
 * into the focus's TYPE_GUIDANCE so the LLM gets:
 *   - The category mix it should draw from
 *   - The intent + signals for each mandatory category (drives scoreNote)
 *   - The trap budget (so it doesn't over-trap)
 *   - Whether to invite candidate questions at closing
 */
export function formatRecipe(focusKey: string): string {
  const recipe = RECIPES[focusKey];
  if (!recipe) return "";

  const renderCategory = (key: CategoryKey, idx: number): string => {
    const c = CATEGORIES[key];
    if (!c) return "";
    return [
      `  ${idx + 1}. ${c.label} (${c.key})`,
      `     INTENT: ${c.intent}`,
      `     STRONG SIGNAL: ${c.signals.strong}`,
      `     WEAK SIGNAL: ${c.signals.weak}`,
      `     SAMPLE STEMS (paraphrase + personalise — never copy verbatim):`,
      ...c.stems.slice(0, 4).map((s) => `       • ${s}`),
    ].join("\n");
  };

  const optionalLine = recipe.optional.length > 0
    ? `Optional categories you may draw from for remaining slots: ${recipe.optional.map((k) => CATEGORIES[k]?.label || k).join(", ")}.`
    : "";

  const trapLine = recipe.trapBudget === 0
    ? "TRAP QUESTIONS: Do NOT use trap-style questions in this focus."
    : `TRAP QUESTIONS: At most ${recipe.trapBudget} trap-style question(s) total. Use sparingly — only when it surfaces real signal.`;

  const closingLine = recipe.inviteCandidateQuestions
    ? `CLOSING: Invite the candidate to ask questions ("Do you have any questions for me?"). When they ask, answer IN CHARACTER as the hiring manager — plausible role-and-company-specific responses, not generic platitudes. Don't claim certainty about things a real interviewer wouldn't know off-hand. If their question is something you genuinely shouldn't answer (compensation specifics, head-count details), say so warmly and offer to take it back to HR.`
    : "";

  return [
    `\n═══ QUESTION RECIPE — ${recipe.label} ═══`,
    `MANDATORY categories (must appear in the question set, in roughly this order):`,
    recipe.mandatory.map(renderCategory).join("\n\n"),
    "",
    optionalLine,
    "",
    trapLine,
    "",
    closingLine,
    recipe.pacingNote ? `\nPACING: ${recipe.pacingNote}` : "",
    "",
  ].filter(Boolean).join("\n");
}
