/* HireStepX — Indian Behavioral-round personas (Phase 4.2 of Behavioral plan).
 *
 * Distinct from `_indian-hr-personas.ts`. HR personas model the
 * standalone HR round (rapport / BGV / logistics). These personas
 * model the behavioural-loop interviewer — the manager / director who
 * pulls STAR stories out of the candidate:
 *
 *   1. HR Partner (warm) — entry-level behavioural screen. Probes
 *      culture-fit stories, "tell me about a time you worked with a
 *      tough teammate", values-driven prompts. Default for fresher /
 *      entry behavioural rounds where the interviewer is HR-led.
 *
 *   2. Hiring Manager (depth-led) — the manager you'd actually
 *      report to. Probes specific Action depth ("what did *you*
 *      personally do"), tradeoff reasoning, ownership signals,
 *      failure ownership. Default for mid-senior IC / line-manager
 *      behavioural rounds.
 *
 *   3. Director (strategic) — senior leader probing for scale,
 *      strategic thinking, influence without authority, long-horizon
 *      bets, cross-org alignment. Default for senior / lead /
 *      executive rounds — the bar shifts from "did you do it" to
 *      "would you reshape the org".
 *
 * Picked from company-tier × experience-level. Pure constant module —
 * no I/O. Safe to import from server-handlers (Edge runtime) and src/.
 */

export type BehavioralPersonaId =
  | "hr-partner-warm"
  | "hiring-manager-depth"
  | "director-strategic";

export interface BehavioralPersona {
  id: BehavioralPersonaId;
  displayName: string;
  /** One-paragraph voice instruction injected into the
   *  generate-questions prompt so the questions match the archetype. */
  probeStyle: string;
  /** What this persona scores hardest. Used in the report when
   *  surfacing why a flag fired under this archetype. */
  scoringEmphasis: string;
  /** Story shapes this persona pulls for. Helps the question generator
   *  avoid producing 3 identical-sounding behavioural rounds across
   *  persona variants. */
  pressureTopics: ReadonlyArray<string>;
}

const PERSONAS: Record<BehavioralPersonaId, BehavioralPersona> = {
  "hr-partner-warm": {
    id: "hr-partner-warm",
    displayName: "HR Partner (warm)",
    probeStyle:
      "You are the Indian HR Partner running an entry-level behavioural screen — warm, relational, values-led. Open with culture-fit stories: 'tell me about a time you worked with someone difficult', 'a time you had to learn something new fast', 'a time you handled stress'. Reward authenticity over polish; first-job candidates often don't have a measurable Result yet, so weight Situation / Task framing higher. Indian deferential phrasing ('with respect, sir / ma'am, in my last internship I…') is in-register. Don't push for depth on Action; one clarifying probe is enough.",
    scoringEmphasis:
      "Authenticity, learning attitude, teamwork stories, values alignment. Deep ownership / metric impact is secondary — entry-level candidates don't have the scope yet.",
    pressureTopics: [
      "teamwork_conflict",
      "learning_agility",
      "stress_handling",
      "values_fit",
      "first_job_motivation",
    ],
  },
  "hiring-manager-depth": {
    id: "hiring-manager-depth",
    displayName: "Hiring Manager (depth-led)",
    probeStyle:
      "You are the Indian hiring manager the candidate would report to — depth-led, ownership-focused, slightly impatient with collective framing. When a candidate says 'we did X', probe HARD: 'what did *you* specifically do?' Push for: first-person Action verbs, measurable Result with numbers, tradeoff reasoning ('why that approach vs the alternatives?'), one explicit failure story with what they'd do differently. Reward STAR completeness — if Result is missing, ask 'how did you measure success?' before moving on. Indian register holds: hedged disagreement ('with respect, I'd push back') is conviction, not weakness.",
    scoringEmphasis:
      "Ownership clarity (I vs we), quantified Result, tradeoff reasoning, failure ownership without blame-routing, cross-functional partnership stories.",
    pressureTopics: [
      "first_person_ownership",
      "quantified_impact",
      "tradeoff_reasoning",
      "failure_ownership",
      "cross_team_partnership",
    ],
  },
  "director-strategic": {
    id: "director-strategic",
    displayName: "Director (strategic)",
    probeStyle:
      "You are an Indian Director-level interviewer — strategic, scale-led, influence-led. Pull stories about: shaping multi-quarter bets, influencing without direct authority, navigating ambiguous / political situations, cross-org alignment, hiring / scaling teams, sunsetting work. Push back on tactical-only answers: 'that's the execution — what was the bet you were making at the portfolio level?' Reward long-horizon thinking, scope ('how many people / how many ₹ / how many customers?'), and judgment under ambiguity. STAR is table stakes — what differentiates here is the size of the decision and the reasoning behind it.",
    scoringEmphasis:
      "Scope / scale of decisions, influence without authority, long-horizon framing, judgment under ambiguity, hiring / team-shaping stories.",
    pressureTopics: [
      "strategic_bets",
      "influence_without_authority",
      "ambiguity_judgment",
      "cross_org_alignment",
      "team_scaling",
    ],
  },
};

/** Lookup a behavioral persona by id. Returns null on unrecognised
 *  input — callers should fall through to the default
 *  ("hiring-manager-depth"). */
export function getBehavioralPersona(
  id: string | null | undefined,
): BehavioralPersona | null {
  if (!id) return null;
  const norm = id.toLowerCase().trim();
  const map: Record<string, BehavioralPersonaId> = {
    "hr-partner-warm": "hr-partner-warm",
    "hr partner": "hr-partner-warm",
    "hiring-manager-depth": "hiring-manager-depth",
    "hiring manager": "hiring-manager-depth",
    "hm": "hiring-manager-depth",
    "director-strategic": "director-strategic",
    "director": "director-strategic",
  };
  const key = map[norm];
  return key ? PERSONAS[key] : null;
}

export type BehavioralPersonaCompanyTier =
  | "faang"
  | "big-tech"
  | "indian-unicorn"
  | "it-services"
  | "startup-early"
  | "startup-growth"
  | "consulting-mbb"
  | "consulting-big4"
  | "bfsi-global"
  | "bfsi-domestic"
  | "government-psu"
  | "fmcg-mnc"
  | "edtech"
  | "saas-product"
  | "gcc"
  | "unknown";

export type BehavioralPersonaExperienceLevel =
  | "fresher"
  | "entry"
  | "mid"
  | "senior"
  | "lead"
  | "executive"
  | "unknown";

/** Selector — picks the most likely behavioural persona for a given
 *  role.
 *
 *  Rules (ordered, first match wins):
 *    1. Director (strategic)        → experience ∈ {lead, executive},
 *       OR senior at FAANG / big-tech / GCC / consulting / BFSI-global.
 *       These rounds explicitly probe portfolio-level thinking.
 *    2. HR Partner (warm)           → fresher / entry, OR mid at
 *       IT-services / edtech / early-stage. Behavioural screens at
 *       these tiers are still HR-led; depth is unrealistic.
 *    3. Hiring Manager (depth-led)  → everything else (default). The
 *       common case: mid-senior IC / line-manager behavioural loops
 *       across most Indian product cos. */
export function selectBehavioralPersona(opts: {
  companyTier?: BehavioralPersonaCompanyTier | string | null;
  experienceLevel?: BehavioralPersonaExperienceLevel | string | null;
}): BehavioralPersona {
  const tier = (opts.companyTier || "unknown")
    .toString()
    .toLowerCase() as BehavioralPersonaCompanyTier;
  const level = (opts.experienceLevel || "unknown")
    .toString()
    .toLowerCase() as BehavioralPersonaExperienceLevel;

  const isJuniorLevel = level === "fresher" || level === "entry";
  const isSeniorPlus = level === "senior" || level === "lead" || level === "executive";
  const warmTiers: BehavioralPersonaCompanyTier[] = ["it-services", "edtech", "startup-early"];
  const directorTiers: BehavioralPersonaCompanyTier[] = [
    "faang",
    "big-tech",
    "gcc",
    "consulting-mbb",
    "consulting-big4",
    "bfsi-global",
  ];

  if (level === "lead" || level === "executive") {
    return PERSONAS["director-strategic"];
  }
  if (level === "senior" && directorTiers.includes(tier)) {
    return PERSONAS["director-strategic"];
  }
  if (isJuniorLevel) return PERSONAS["hr-partner-warm"];
  if (level === "mid" && warmTiers.includes(tier)) {
    return PERSONAS["hr-partner-warm"];
  }
  // Default — the broad mid-senior IC / line-manager case.
  return isSeniorPlus
    ? PERSONAS["hiring-manager-depth"]
    : PERSONAS["hiring-manager-depth"];
}

/** Build a prompt fragment the question generator can inject when a
 *  behavioural session is running under a specific persona. */
export function behavioralPersonaPromptFragment(
  persona: BehavioralPersona,
): string {
  const topicsLine = persona.pressureTopics.length
    ? `Story shapes for this archetype: ${persona.pressureTopics.join(", ")}. Ensure at least one stem targets each of the top 3.`
    : "";
  return [
    `INDIAN BEHAVIOURAL PERSONA — ${persona.displayName}.`,
    persona.probeStyle,
    topicsLine,
    persona.scoringEmphasis,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Pedigree-aware opener (Phase 4.3). For candidates with <2 years of
 *  experience, soften the opener — the standard "tell me about a time
 *  you led a cross-functional initiative" assumes scope the candidate
 *  doesn't have yet. This fragment pushes the LLM to lead with
 *  internship / college / open-source story shapes instead.
 *
 *  Triggered by experience-level string ("fresher" / "entry") OR a
 *  numeric YOE < 2. Returns "" otherwise (silent no-op for the
 *  mid-senior common case). */
export function pedigreeAwareOpenerFragment(
  input: { experienceLevel?: string | null; yoe?: number | null },
): string {
  const level = (input.experienceLevel || "").toString().toLowerCase().trim();
  const yoeKnown = typeof input.yoe === "number";
  const isJunior =
    level === "fresher" ||
    level === "entry" ||
    (yoeKnown && (input.yoe as number) < 2);
  if (!isJunior) return "";
  return [
    "PEDIGREE-AWARE OPENER (candidate has <2 yrs experience):",
    "- Lead with a story shape the candidate can actually fill: internship project, college capstone, hackathon, open-source contribution, or first 6 months on the job.",
    "- Do NOT open with 'tell me about a time you led a team of N' — they haven't had that scope yet, and the dead-air response signals nothing useful.",
    "- Weight Situation / Task framing higher than Result quantification — early-career candidates rarely own the measurement layer.",
    "- One stem should explicitly ask about learning under ambiguity ('tell me about something you had to figure out without anyone to ask') — early-career candidates differentiate on learning-velocity, not delivery scope.",
  ].join("\n");
}
