/* Plain-English translations for analyzer flags, categories, and statuses.
 *
 * The Quality dashboard reads from this file so a non-technical admin
 * can review reports without learning the analyzer's internal vocabulary.
 * Power users still see the technical name as a small subtitle.
 *
 * Adding a new analyzer flag? Add an entry here too — otherwise the UI
 * falls back to a humanized version of the raw flag name.
 */

export interface FriendlyFlag {
  label: string;          // headline shown in the UI
  description: string;    // 1-line explanation (tooltip / subline)
  category: "ai_made_up_info" | "ai_didnt_push_back" | "user_skipped_step" | "question_quality" | "system";
}

const DICT: Record<string, FriendlyFlag> = {
  // Hallucinations / made-up info
  implausible_salary_claim: { label: "AI gave unrealistic salary number", description: "The AI quoted compensation outside any plausible market range.", category: "ai_made_up_info" },
  stale_market_calibration: { label: "Salary data is out of date", description: "The reference data used to check AI claims hasn't been refreshed in over a year.", category: "ai_made_up_info" },
  unverifiable_companies: { label: "User mentioned company not in resume", description: "User referenced an employer the resume doesn't list — could be hallucination on either side.", category: "ai_made_up_info" },

  // AI didn't push back hard enough
  ai_accepted_without_pushback: { label: "AI accepted the offer without negotiating", description: "AI agreed to the first user number without trying to counter — unrealistic for hiring practice.", category: "ai_didnt_push_back" },
  ai_accepts_missing_result: { label: "AI moved on without asking for the outcome", description: "User didn't share the Result of their STAR story; AI didn't probe before changing topic.", category: "ai_didnt_push_back" },
  ai_accepts_hand_waving: { label: "AI accepted vague design answer", description: "User gave a hand-wavy answer; AI didn't ask a follow-up to pin it down.", category: "ai_didnt_push_back" },
  ai_accepted_without_verification: { label: "AI didn't verify the code", description: "AI said 'looks good' without checking correctness, edge cases, or complexity.", category: "ai_didnt_push_back" },

  // User skipped a key step
  weak_star_structure: { label: "User answers missed STAR structure", description: "Most user answers were missing Situation / Task / Action / Result components.", category: "user_skipped_step" },
  frequent_missing_result: { label: "User often forgot the Result", description: "More than half of answers stopped before sharing the outcome.", category: "user_skipped_step" },
  unquantified_answers: { label: "User didn't quantify impact", description: "Answers described actions but didn't include numbers (% improvement, hours saved, users affected).", category: "user_skipped_step" },
  user_never_anchored: { label: "User didn't open with a number", description: "In salary-neg, user reacted instead of stating a researched target — costs leverage.", category: "user_skipped_step" },
  no_batna_articulated: { label: "User didn't mention an alternative offer", description: "BATNA (best alternative) is what makes negotiation real; it never came up.", category: "user_skipped_step" },
  equity_never_discussed: { label: "Equity / stock options never came up", description: "Salary-neg session didn't cover equity — often the biggest lever at senior level.", category: "user_skipped_step" },
  joining_bonus_never_discussed: { label: "Joining bonus never came up", description: "Sign-on bonus can recover gap when base is capped; was never raised.", category: "user_skipped_step" },
  notice_period_never_discussed: { label: "Notice period / start date never came up", description: "Logistics around joining weren't discussed — common HR-round gap.", category: "user_skipped_step" },
  user_anchor_leaked_salary: { label: "User volunteered salary number too early", description: "User said a number before being asked — costs negotiation leverage.", category: "user_skipped_step" },
  user_badmouthing_employer: { label: "User badmouthed previous employer", description: "Negative language about a past employer — flagged for professionalism coaching.", category: "user_skipped_step" },
  generic_self_intro: { label: "Self-intro was too generic", description: "'Tell me about yourself' answer lacked years, projects, or measurable results.", category: "user_skipped_step" },
  no_code_provided: { label: "User didn't write code when asked", description: "AI asked for an implementation; user only described it verbally.", category: "user_skipped_step" },
  wrong_complexity_claim: { label: "User claimed wrong Big-O complexity", description: "User said O(n) but the code has nested loops, or similar mismatch.", category: "user_skipped_step" },
  no_edge_case_probing: { label: "Edge cases were never discussed", description: "Code was reviewed without probing empty input / boundary / overflow cases.", category: "user_skipped_step" },
  no_complexity_discussion: { label: "Time/space complexity never came up", description: "Code was written but neither user nor AI talked about its complexity.", category: "user_skipped_step" },
  insufficient_scale_probing: { label: "Scale was never established", description: "AI didn't pin down QPS / data size / latency before designing.", category: "user_skipped_step" },
  incomplete_design_coverage: { label: "Design skipped key layers", description: "Discussion missed several of: capacity, API, data model, scaling, failure modes, monitoring.", category: "user_skipped_step" },
  user_hand_waving: { label: "User answered vaguely", description: "Phrases like 'it just works', 'some kind of', 'or something' — not concrete enough.", category: "user_skipped_step" },

  // Question quality
  duplicate_question: { label: "AI repeated the same question", description: "AI asked the same question twice in the same session.", category: "question_quality" },
  leaked_answer: { label: "Question gave away the answer", description: "The AI's question contained part of the answer it was looking for.", category: "question_quality" },

  // System
  empty_transcript: { label: "Session has no transcript", description: "Could not analyze — no conversation data was recorded.", category: "system" },
  analyzer_error: { label: "Analyzer crashed on this session", description: "The audit code failed to run. Investigate the analyzer logs.", category: "system" },
  no_analyzer_for_focus: { label: "No analyzer built for this interview type yet", description: "This focus has no audit logic — coverage gap.", category: "system" },
  analyzer_blind_spot: { label: "Analyzer blind spot — user disagreed", description: "User rated this session as inaccurate / too harsh / too generous, but the analyzer found no issues. Review what the rubric is missing.", category: "system" },
};

export const CATEGORY_LABEL: Record<FriendlyFlag["category"], string> = {
  ai_made_up_info: "AI made up information",
  ai_didnt_push_back: "AI didn't push back enough",
  user_skipped_step: "User skipped a key step",
  question_quality: "Question quality issues",
  system: "System / setup issues",
};

const SECTIONS_FRIENDLY: Record<string, string> = {
  hallucinations: "AI made-up information",
  rubric_gaps: "Where coaching is needed",
  bad_questions: "Question quality problems",
  coaching_notes: "Coaching tips",
};

const STATUS_LABEL: Record<string, string> = {
  open: "Needs review",
  acknowledged: "Reviewed",
  resolved: "Fixed",
  wont_fix: "Closed (won't fix)",
};

const SEVERITY_LABEL: Record<string, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

/** Look up a flag's friendly form. Falls back to humanizing the snake_case name. */
export function friendlyFlag(flag: string): FriendlyFlag {
  const known = DICT[flag];
  if (known) return known;
  // Fallback: convert snake_case → "Sentence case", best-guess category.
  const label = flag.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());
  let category: FriendlyFlag["category"] = "user_skipped_step";
  if (flag.startsWith("implausible_") || flag.includes("hallucinat") || flag.includes("fake_") || flag.includes("invented")) category = "ai_made_up_info";
  else if (flag.startsWith("ai_accept") || flag.startsWith("ai_invent")) category = "ai_didnt_push_back";
  else if (flag === "duplicate_question" || flag === "leaked_answer") category = "question_quality";
  else if (flag === "analyzer_error" || flag === "empty_transcript" || flag === "no_analyzer_for_focus") category = "system";
  return { label, description: "", category };
}

export function friendlySection(name: string): string {
  return SECTIONS_FRIENDLY[name] || name;
}

export function friendlyStatus(status: string): string {
  return STATUS_LABEL[status] || status;
}

export function friendlySeverity(sev: string): string {
  return SEVERITY_LABEL[sev] || sev;
}

/* Map a focus key to a friendly name shown in headers. */
export function friendlyFocus(focus: string): string {
  const m: Record<string, string> = {
    behavioral: "Behavioral",
    "salary-negotiation": "Salary negotiation",
    technical: "Technical",
    "system-design": "System design",
    "hr-round": "HR round",
    strategic: "Strategic",
    "case-study": "Case study",
    panel: "Panel",
    "campus-placement": "Campus placement",
    management: "Management",
    "government-psu": "Government / PSU",
  };
  return m[focus] || focus;
}
