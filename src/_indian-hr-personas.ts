/* HireStepX — Indian HR-round personas (Phase 3 of HR Round plan).
 *
 * Distinct from `_indian-panel-personas.ts`. Panel personas model the
 * three voices INSIDE a behavioural loop (HR Partner / Hiring Manager /
 * Tech Lead). These personas model the three voices a *standalone* HR
 * round shows up as in India:
 *
 *   1. HR Partner (warm) — default, rapport-led. Probes culture-fit,
 *      stay-intent, family / relocation, "why us", soft logistics.
 *      Common at growth-stage Indian product cos + service firms.
 *
 *   2. HR Business Partner (firm) — process-led. Asks for proof
 *      points: BGV doc list, payslip / Form 16 fluency, notice
 *      buyout policy, references, prior-BGV-failure history.
 *      Common at MNC / GCC / FAANG / consulting / regulated BFSI
 *      hires; and at any mid-senior+ hire (org cares more about
 *      onboarding-readiness than vibe-fit).
 *
 *   3. Talent Acquisition (transactional) — quick screen. Speed of
 *      decision dominates. Probes: notice in days, current CTC,
 *      expected CTC, location, joining date. Light on culture, heavy
 *      on go/no-go logistics.
 *      Common at IT-services / early-stage startups / fresher hiring.
 *
 * Picked from company-tier + experience-level. Pure constant module —
 * no I/O. Safe to import from server-handlers (Edge runtime) and src/
 * alike.
 */

export type HrPersonaId = "hr-partner-warm" | "hr-bp-firm" | "talent-acquisition";

export interface HrPersona {
  id: HrPersonaId;
  displayName: string;
  /** One-paragraph voice instruction injected into the generate-questions
   *  prompt so the questions match the archetype. */
  probeStyle: string;
  /** What this persona scores hardest. Used in the report when surfacing
   *  why a flag fired under this archetype. */
  scoringEmphasis: string;
  /** Topics this persona probes harder than the others. Helps the
   *  question generator avoid producing 3 identical-sounding HR rounds
   *  across persona variants. */
  pressureTopics: ReadonlyArray<string>;
}

const PERSONAS: Record<HrPersonaId, HrPersona> = {
  "hr-partner-warm": {
    id: "hr-partner-warm",
    displayName: "HR Partner (warm)",
    probeStyle:
      "You are the Indian HR Partner — warm, relational, rapport-led. Your voice is friendly and slightly informal; deferential gratitude ('thank you so much for this opportunity, sir / ma'am') from the candidate is expected and normal. Open with culture-fit + 'why this company'. Probe stay-intent, family / relocation, and competing offers. Be lighter on BGV mechanics — a quick mention is enough; deep document literacy isn't where this persona scores. Hinglish softeners are in bounds if the candidate uses them.",
    scoringEmphasis:
      "Authenticity, stay-intent credibility, cultural fit, deal-closeability. STAR depth is secondary — pedigree / family / relocation framing is legitimate primary signal.",
    pressureTopics: ["why_this_company", "stay_intent", "relocation_family", "competing_offers", "soft_logistics"],
  },
  "hr-bp-firm": {
    id: "hr-bp-firm",
    displayName: "HR Business Partner (firm)",
    probeStyle:
      "You are an Indian HR Business Partner — firm, process-led, proof-driven. Your voice is professional and slightly cool. Reward fluency on BGV docs (Form 16, UAN, payslips, relieving letter, PAN/Aadhaar), notice-period mechanics (buyout policy, LWD, handover plan), prior BGV failures, and references. Probe HARD on commitment signals: counter-offer protection, joining-date realism vs. notice, clawback / bond awareness. Cultural-fit questions are present but secondary — onboarding readiness and risk reduction dominate.",
    scoringEmphasis:
      "Document literacy, notice-period depth, counter-offer commitment, clawback / bond awareness, reference readiness. This persona scores 'will this hire onboard cleanly' over 'will they stay'.",
    pressureTopics: ["bgv_documents", "notice_depth", "counter_offer", "clawback_bond", "references", "prior_bgv_history"],
  },
  "talent-acquisition": {
    id: "talent-acquisition",
    displayName: "Talent Acquisition (transactional)",
    probeStyle:
      "You are an Indian Talent Acquisition recruiter — transactional, fast, decision-velocity-led. Your voice is brisk and direct. Open with logistics: current CTC, expected CTC, notice period in days, joining date, location preference. Limit culture-fit probing to one quick question. Skip deep BGV mechanics — your job is to qualify the candidate into the pipeline, not to onboard them. Ask one tight 'why this role' but don't push for depth. Push for fast yes/no on RTO + location.",
    scoringEmphasis:
      "Logistics velocity: comp clarity, notice days, joining date, location. Closes-per-hour is the implicit metric. Depth on culture / commitment is out of scope for this persona.",
    pressureTopics: ["current_ctc", "expected_ctc", "notice_days", "joining_date", "location_rto"],
  },
};

/** Lookup an HR persona by id. Returns null on unrecognised input —
 *  callers should fall through to the default ("hr-partner-warm"). */
export function getHrPersona(id: string | null | undefined): HrPersona | null {
  if (!id) return null;
  const norm = id.toLowerCase().trim();
  const map: Record<string, HrPersonaId> = {
    "hr-partner-warm": "hr-partner-warm",
    "hr partner": "hr-partner-warm",
    "hr partner (warm)": "hr-partner-warm",
    "hr-bp-firm": "hr-bp-firm",
    "hrbp": "hr-bp-firm",
    "hr business partner": "hr-bp-firm",
    "talent-acquisition": "talent-acquisition",
    "ta": "talent-acquisition",
    "talent acquisition": "talent-acquisition",
  };
  const key = map[norm];
  return key ? PERSONAS[key] : null;
}

/* Company-tier vocabulary mirrors `data/company-tiers.ts`. Kept as a
   string union here so this module stays self-contained (no
   cross-import into data/ from src/, which the edge bundler doesn't
   always like). When `data/company-tiers.ts` grows, this list can be
   refreshed; an unknown tier falls through to the default branch. */
export type HrPersonaCompanyTier =
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

export type HrPersonaExperienceLevel = "fresher" | "entry" | "mid" | "senior" | "lead" | "executive" | "unknown";

/** Selector — picks the most likely HR persona for a given role.
 *
 * Rules (ordered, first match wins):
 *   1. Talent Acquisition  → IT-services / early-stage startups /
 *      edtech AND experience ∈ {fresher, entry, mid}. Reflects how
 *      these orgs screen volume-hires (Infosys, Wipro, Byju's-style
 *      campus + early-career).
 *   2. HR Business Partner → MNC / GCC / FAANG / consulting / BFSI-global
 *      regardless of level, OR any company tier when experience ∈
 *      {senior, lead, executive}. These orgs run process-led HR; mid-
 *      senior hires get HRBP scrutiny on onboarding readiness.
 *   3. HR Partner (warm)   → everything else (default). Indian-unicorn
 *      mid-stage hires, growth-stage product cos, BFSI-domestic, FMCG
 *      etc. lean on warm rapport. */
export function selectHrPersona(opts: {
  companyTier?: HrPersonaCompanyTier | string | null;
  experienceLevel?: HrPersonaExperienceLevel | string | null;
}): HrPersona {
  const tier = (opts.companyTier || "unknown").toString().toLowerCase() as HrPersonaCompanyTier;
  const level = (opts.experienceLevel || "unknown").toString().toLowerCase() as HrPersonaExperienceLevel;

  const isJuniorLevel = level === "fresher" || level === "entry" || level === "mid";
  const isSeniorLevel = level === "senior" || level === "lead" || level === "executive";
  const taTiers: HrPersonaCompanyTier[] = ["it-services", "startup-early", "edtech"];
  const bpTiers: HrPersonaCompanyTier[] = [
    "faang",
    "big-tech",
    "gcc",
    "consulting-mbb",
    "consulting-big4",
    "bfsi-global",
  ];

  if (taTiers.includes(tier) && isJuniorLevel) return PERSONAS["talent-acquisition"];
  if (bpTiers.includes(tier) || isSeniorLevel) return PERSONAS["hr-bp-firm"];
  return PERSONAS["hr-partner-warm"];
}

/** Build a prompt fragment the question generator can inject when an
 *  HR-round session is running under a specific persona. Combines
 *  probeStyle, scoring emphasis, and pressure topics into one block so
 *  the LLM doesn't have to reconcile three separate directives. */
export function hrPersonaPromptFragment(persona: HrPersona): string {
  const topicsLine = persona.pressureTopics.length
    ? `Pressure topics for this archetype: ${persona.pressureTopics.join(", ")}. Ensure at least one stem touches each of the top 3.`
    : "";
  return [
    `INDIAN HR-ROUND PERSONA — ${persona.displayName}.`,
    persona.probeStyle,
    topicsLine,
    persona.scoringEmphasis,
  ].filter(Boolean).join(" ");
}
