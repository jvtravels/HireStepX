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
  above_role_band: { label: "AI offered above the realistic band for this role", description: "The number is plausible globally but well above what this company actually pays for this role.", category: "ai_made_up_info" },
  offer_components_inconsistent: { label: "AI's offer math doesn't add up", description: "AI stated a total CTC but the components (base + variable + bonus) don't sum to that total. Structural hallucination.", category: "ai_made_up_info" },
  ai_silent_capitulation: { label: "AI matched user's ask without negotiating", description: "AI eventually offered ≥ user's number without ever saying the ask was above market — silent capitulation, not real negotiation.", category: "ai_didnt_push_back" },
  ai_self_contradiction: { label: "AI contradicted itself in the same message", description: "AI said 'I can't meet ₹X' and then offered ₹X in the same turn. Re-reading the draft would have caught it.", category: "ai_made_up_info" },
  ai_misread_conditional_as_acceptance: { label: "AI treated a conditional as acceptance", description: "User said 'if you can do X, I'd accept' (conditional). AI responded with celebration / closing language as if the deal was done.", category: "ai_didnt_push_back" },
  ai_phrase_repetition: { label: "AI repeated the same phrase multiple times", description: "Generation loop — the same 5+ word phrase appeared 3+ times in a single AI turn. Catastrophic; users notice immediately.", category: "ai_made_up_info" },
  ai_reversed_range: { label: "AI quoted a range high-to-low", description: "Like '₹12 to ₹8.5 LPA' — ranges should always go low to high. Indicates broken number tracking.", category: "ai_made_up_info" },
  ai_ignored_user_complaint: { label: "AI closed the deal on a confused user", description: "User said 'I'm confused' or 'why are you confusing me?'; AI responded with closing language ('thanks, HR will reach out') instead of clarifying the offer.", category: "ai_didnt_push_back" },
  ai_consecutive_duplicate_question: { label: "AI repeated its own question word-for-word", description: "Two consecutive AI turns are nearly identical text — usually after the user already answered. Conversation isn't progressing.", category: "question_quality" },
  ai_didnt_answer_direct_question: { label: "AI dodged a direct user question", description: "User asked 'what are you offering?' or 'can you clarify?' — AI replied with another question instead of giving an answer.", category: "ai_didnt_push_back" },
  ai_no_counter_offered: { label: "AI never made a numeric counter", description: "Salary-neg session went 4+ turns with the user asking for a number, but the AI never produced a specific counter — just deflection until close.", category: "ai_didnt_push_back" },
  stale_market_calibration: { label: "Salary data is out of date", description: "The reference data used to check AI claims hasn't been refreshed in over a year.", category: "ai_made_up_info" },
  ai_arithmetic_error: { label: "AI's salary math is wrong", description: "AI computed a sum, percentage, or hike multiple incorrectly inside the offer (e.g. '20% above ₹12L = ₹13L').", category: "ai_made_up_info" },
  ai_offer_regression: { label: "AI revised the offer downward mid-negotiation", description: "AI offered a higher number earlier in the same session and then quoted a lower one — never realistic in a real negotiation.", category: "ai_made_up_info" },
  ai_usism_drift: { label: "AI slipped into US salary framing", description: "AI used '$', 'six figures', 'OTE', '401k' or similar US idioms in an Indian negotiation context — calibration drift the candidate will notice.", category: "ai_made_up_info" },
  ai_under_close_below_predicted: { label: "AI closed below the realistic floor", description: "Final offer landed under the lower bound of the role's plausible band — would not happen in a real Indian negotiation.", category: "ai_made_up_info" },
  ai_unrealistic_close_above_predicted: { label: "AI closed above the realistic ceiling", description: "Final offer exceeded the upper bound of the role's plausible band — sets a false expectation for the candidate's real negotiation.", category: "ai_made_up_info" },
  role_company_mismatch: { label: "Role and company don't fit", description: "The requested role doesn't match the company's known hiring profile (e.g. 'Quant Researcher at TCS') — candidate practising on an unrealistic combo.", category: "system" },
  user_below_band_underask: { label: "User asked for below market", description: "User's anchor was below the realistic lower band for the role — costs significant compensation. Coaching: research before anchoring.", category: "user_skipped_step" },
  user_moonshot_no_batna: { label: "User asked for a moonshot number with no BATNA", description: "User anchored well above the realistic ceiling and never mentioned an alternative offer — leverage-free moonshot, AI will rightly walk away in a real session.", category: "user_skipped_step" },
  unverifiable_companies: { label: "User mentioned company not in resume", description: "User referenced an employer the resume doesn't list — could be hallucination on either side.", category: "ai_made_up_info" },

  // AI didn't push back hard enough
  ai_accepted_without_pushback: { label: "AI accepted the offer without negotiating", description: "AI agreed to the first user number without trying to counter — unrealistic for hiring practice.", category: "ai_didnt_push_back" },
  ai_accepts_missing_result: { label: "AI moved on without asking for the outcome", description: "User didn't share the Result of their STAR story; AI didn't probe before changing topic.", category: "ai_didnt_push_back" },
  ai_accepts_hand_waving: { label: "AI accepted vague design answer", description: "User gave a hand-wavy answer; AI didn't ask a follow-up to pin it down.", category: "ai_didnt_push_back" },
  ai_accepted_without_verification: { label: "AI didn't verify the code", description: "AI said 'looks good' without checking correctness, edge cases, or complexity.", category: "ai_didnt_push_back" },
  jumped_to_code_no_clarifying: { label: "User skipped scoping the problem", description: "User started coding immediately without asking about input constraints, edge cases, or sample I/O — interviewers grade scoping.", category: "user_skipped_step" },
  no_test_walkthrough: { label: "User didn't trace their own code", description: "User wrote code but never walked through a concrete sample input — verification instinct is part of the grade.", category: "user_skipped_step" },
  no_tradeoff_articulation: { label: "User presented one solution as the only option", description: "Senior-signal gap: no alternative approach named, no trade-off articulated. 'Hash-map for O(n); sort + two-pointer is O(n log n) but lower memory' is the shape.", category: "user_skipped_step" },
  vague_complexity_claim: { label: "User used vague speed language instead of Big-O", description: "Phrases like 'pretty fast' / 'linear-ish' / 'fast enough' without a concrete O(...) — costs technical credibility.", category: "user_skipped_step" },
  language_anti_pattern: { label: "Rookie language idiom in the code", description: "Anti-patterns like 'var' + loose-equality in JS, bare-except / range(len(...)) in Python, or string-concat-in-loop in Java — easy credibility hit.", category: "user_skipped_step" },
  we_heavy_ownership: { label: "User said 'we' without saying what they did", description: "Long answer with multiple 'we / our' references and no 'I' — interviewer can't tell the candidate's individual contribution.", category: "user_skipped_step" },
  mti_pattern_detected: { label: "Mother-tongue-influenced English phrasing", description: "Phrases like 'do the needful', 'revert back', 'passout of 2024', 'kindly do', 'myself X', 'cope up with' — common Indian-English deviations that interviewers grade against. Swap for standard professional phrasing.", category: "user_skipped_step" },
  cgpa_low_no_framing: { label: "Low CGPA stated without context", description: "User mentioned a CGPA under 7.0 but didn't frame it — no context on what happened, what they learned, or evidence of capability outside the number. Costs significant credibility for freshers.", category: "user_skipped_step" },
  reverse_questions_declined: { label: "User had no reverse-questions ready", description: "AI closed with 'any questions for us?' — user said no or gave nothing. Every Indian campus closer expects 2-3 prepared questions; declining reads as unprepared.", category: "user_skipped_step" },
  weak_reverse_questions: { label: "Reverse-questions were generic", description: "User asked back with 'How is the work culture?' or 'What are growth opportunities?' — generic. Specific reverse-questions (training program, mentor structure, PPT references) are a real tie-breaker.", category: "user_skipped_step" },
  bond_refusal: { label: "User refused the service bond outright", description: "AI asked about the service agreement, user refused outright — at TCS / Infosys / Wipro / Cognizant this ends the interview on the spot. Bonds are standard; framing concerns as questions about buyout terms is the move.", category: "user_skipped_step" },
  bond_unprepared: { label: "User didn't know about service bonds", description: "AI probed the service agreement, user showed unfamiliarity ('what's a bond?'). Service-tier campus interviews always probe this — every candidate should know their target company's bond duration.", category: "user_skipped_step" },
  college_tier_1: { label: "College tier-1 (IIT / NIT / BITS / IIIT / IISc)", description: "Detected a tier-1 college mention — analyzer applies a -0.5 CGPA leniency to reflect harder grading curves at these institutions.", category: "system" },
  college_tier_2: { label: "College tier-2 (VIT / Manipal / SRM / DTU / NSIT / etc.)", description: "Detected a tier-2 college mention — standard CGPA cutoffs apply; competitive admit but no extra leniency.", category: "system" },

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

  // Strategic
  framework_without_application: { label: "Framework named but not applied", description: "User cited Porter / SWOT / etc. without applying it to a concrete recommendation.", category: "user_skipped_step" },
  no_tradeoff_probing: { label: "AI didn't probe trade-offs", description: "Strategic answers need 'what would you NOT do?' — AI never raised opportunity cost.", category: "ai_didnt_push_back" },
  no_success_metrics: { label: "No measurable success criteria", description: "Recommendations weren't tied to numbers + timelines.", category: "user_skipped_step" },
  stakeholders_never_considered: { label: "Stakeholders never named", description: "Strategy without people is theory — affected groups weren't named.", category: "user_skipped_step" },
  risks_never_discussed: { label: "Risks never discussed", description: "No mention of failure modes or mitigations.", category: "user_skipped_step" },
  ai_accepts_vague_strategy: { label: "AI accepted vague 'it depends' answers", description: "User stayed at hedge level; AI moved on without forcing specificity.", category: "ai_didnt_push_back" },

  // Panel
  single_persona_panel: { label: "Panel sounds like a single voice", description: "Only one persona detected — should feel like multiple distinct interviewers.", category: "question_quality" },
  missing_technical_persona: { label: "No technical persona in the panel", description: "Panel skipped a technical screen — coverage gap.", category: "question_quality" },
  missing_behavioral_persona: { label: "No HR / hiring-manager persona", description: "Panel skipped a behavioral screen.", category: "question_quality" },
  user_didnt_adapt_tone: { label: "User used same tone for every persona", description: "Identical answer openings — didn't adapt depth/register across personas.", category: "user_skipped_step" },
  technical_persona_too_shallow: { label: "Technical persona stayed shallow", description: "Technical questions were too short to test real depth.", category: "question_quality" },

  // Case study
  jumped_to_solution: { label: "Jumped to solution without clarifying", description: "First substantive answer skipped scope / time-horizon clarification.", category: "user_skipped_step" },
  no_sanity_check: { label: "Numbers without sanity check", description: "Numerical claims had no order-of-magnitude validation language.", category: "user_skipped_step" },
  ai_accepted_vague_research: { label: "AI accepted 'I'd do market research'", description: "Vague research-language wasn't forced into specifics.", category: "ai_didnt_push_back" },
  missing_conclusion: { label: "Final answer didn't conclude", description: "No explicit recommendation tying back to the original question.", category: "user_skipped_step" },

  // Campus placement
  no_academic_project_discussed: { label: "Capstone / academic project never came up", description: "Fresher interviews should surface coursework + capstone — they didn't.", category: "user_skipped_step" },
  generic_passion_no_substance: { label: "Generic 'I'm passionate' answer", description: "Used passion language without describing a built project.", category: "user_skipped_step" },
  availability_never_discussed: { label: "Availability / joining date never came up", description: "For freshers, joining timeline matters — wasn't discussed.", category: "user_skipped_step" },
  user_badmouthing_college: { label: "User badmouthed their college", description: "Negative language about college / professors — costs interview points.", category: "user_skipped_step" },
  project_no_tech_stack: { label: "Project narrated without naming a stack", description: "Fresher described a project but didn't name a language / framework / DB / deployment target.", category: "user_skipped_step" },
  implausible_team_size: { label: "Implausible team-size claim", description: "Fresher claimed to have led a 15+ person team — not credible at college level.", category: "user_skipped_step" },
  no_company_specific_research: { label: "No company-specific research surfaced", description: "AI asked 'why us?' — user replied with generic 'great culture / brand value' filler.", category: "user_skipped_step" },
  volunteered_academic_deficit: { label: "Volunteered backlogs / low CGPA unprompted", description: "User offered up an academic deficit before being asked — costs framing points.", category: "user_skipped_step" },
  excessive_filler_words: { label: "Excessive filler words", description: "Fillers ('basically', 'as such', 'like') above 4 per 100 words — reads as nervous.", category: "user_skipped_step" },
  internship_unsubstantiated: { label: "Internship claimed but not substantiated", description: "Internship mentioned without naming company / deliverable / mentor / outcome when probed.", category: "user_skipped_step" },

  // Management
  answered_as_ic_not_manager: { label: "Answered as IC, not as manager", description: "Stories used 'I built / I shipped' — should be 'my team / my report'.", category: "user_skipped_step" },
  no_team_metrics: { label: "No team-level metrics", description: "No retention / hiring / promotions / velocity numbers.", category: "user_skipped_step" },
  no_hard_conversation_probe: { label: "AI didn't probe difficult conversations", description: "Manager interviews must cover underperformers / firing — AI didn't.", category: "ai_didnt_push_back" },
  no_stakeholder_management: { label: "Stakeholder management never discussed", description: "No cross-functional / partner-team language.", category: "user_skipped_step" },
  no_leadership_philosophy: { label: "Leadership philosophy not articulated", description: "Manager candidates should be ready with a 2-sentence philosophy.", category: "user_skipped_step" },

  // Government / PSU
  corporate_jargon_overuse: { label: "Corporate jargon used heavily", description: "Government interviews expect formal vocabulary — KPI / sprint / OKR are out of place.", category: "user_skipped_step" },
  no_public_service_motivation: { label: "No public-service motivation articulated", description: "Civil services interviews test sincerity — public-welfare framing was missing.", category: "user_skipped_step" },
  user_badmouthing_private_sector: { label: "User badmouthed private sector", description: "Frame the move positively, not as escape from a 'bad' employer.", category: "user_skipped_step" },
  no_current_affairs_probe: { label: "Current affairs never came up", description: "AI didn't test policy / news awareness — usually expected.", category: "question_quality" },
  service_preference_never_discussed: { label: "Service / posting preference never came up", description: "UPSC / PSU panels expect to discuss cadre, posting, transferability.", category: "question_quality" },

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
