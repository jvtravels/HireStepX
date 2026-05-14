/* Candidate-profile parser — Phase 17B (2026-05-13).
 *
 * The 19-scenario audit surfaced three adjacent candidate-background
 * signals that materially affect how a recruiter frames the offer:
 *
 *   16. Career gap — "I had a 1-year break for upskilling". Pre-Phase-17
 *       the kernel had no state for this; the LLM had to re-derive it
 *       from the transcript every turn and routinely missed the gap-
 *       justification activity.
 *
 *   17. Frequent job changes — "I've switched 4 times in 5 years". A
 *       recruiter pushback that materially affects offer framing (often
 *       reduces joining-bonus willingness due to retention risk). No
 *       state captured the switch cadence.
 *
 *   18/19. Over/under-qualified — "I'm overqualified but want this for
 *          the domain" / "I'm short on YOE but my skills match". Real
 *          recruiters always probe this; without state, the AI couldn't
 *          adapt its push-back style (over-q → "will you get bored?";
 *          under-q → "are you open to lower level?").
 *
 * All three are conservative parsers — the cost of a false positive is
 * silently teaching the kernel a candidate background that wasn't
 * stated. */

export type CareerGapActivity =
  /** Upskilling / certification / course. */
  | "upskill"
  /** Freelancing / consulting. */
  | "freelance"
  /** Family / personal reasons. */
  | "family"
  /** Health / medical reasons. */
  | "health"
  /** Higher studies / degree. */
  | "study"
  /** Job search / interviewing. */
  | "job-search";

export type TenureSignal =
  /** Candidate has switched ≥ 3 times in ≤ 5 years, or stated they job-
   *  hop. Materially affects retention-bonus framing. */
  | "frequent"
  /** Candidate has stayed long at companies — used as a positive
   *  retention signal that can support a higher joining bonus. */
  | "stable";

export type LevelMismatch =
  /** Candidate's stated experience exceeds the role level. */
  | "over"
  /** Candidate is below the typical YOE/level for the role. */
  | "under";

/** Phase 25b — payroll-issue history. Materially affects how the AI
 *  should anchor when current CTC is below market: a delayed/unpaid
 *  history means "current CTC" isn't a clean signal of market price. */
export type CompensationHistoryIssue =
  /** Salary was paid but delayed by months on at least one occasion. */
  | "delayed"
  /** Salary was withheld entirely / partial months unpaid. */
  | "unpaid";

/** Fresher-flow extension (2026-05-14c). Indian campus hiring anchors
 *  differently by college tier:
 *    tier-1 — IIT / IISc / NIT / IIIT-H / BITS Pilani / top IIM.
 *      Real recruiters quote ~25% above the standard fresher band.
 *    tier-2 — VIT / SRM / Manipal / DTU / NSUT / state engineering
 *      colleges with consistent placement records. Standard band.
 *    tier-3 — private engineering colleges without consistent
 *      placement tie-ups. Often offered below the standard band
 *      (~80%) when there's no campus-deal floor.
 *  Detection is conservative — only fires when the candidate names
 *  the college explicitly or uses an unambiguous tier label.
 *  See `data/college-tiers.ts` for the canonical list. */
export type CollegeTier = "tier-1" | "tier-2" | "tier-3";

export interface CandidateProfileResult {
  /** Stated career-gap duration in months. Range 1–60 (5 years max).
   *  Null when unstated. */
  careerGapMonths: number | null;
  /** What the candidate did during the gap. Null when not stated or
   *  unrecognized. */
  careerGapActivity: CareerGapActivity | null;
  /** Frequent / stable job-tenure signal. Null when unstated. */
  tenureSignal: TenureSignal | null;
  /** Over- or under-qualified self-statement. Null when unstated. */
  levelMismatch: LevelMismatch | null;
  /** Phase 25b — domain pivot. True when the candidate says they're
   *  changing function/industry ("teacher → EdTech sales", "designer
   *  → PM"). Materially affects how the AI grades the comp ask. */
  domainPivot: boolean;
  /** Phase 25b — candidate claimed transferable skills as justification
   *  for full-rate comp despite the pivot. Used together with
   *  domainPivot to flag overreach. */
  transferableSkillsClaimed: boolean;
  /** Phase 25b — payroll history issue. Null when not stated. */
  compensationHistoryIssue: CompensationHistoryIssue | null;
  /** Phase 26 — service-agreement / training bond accepted or being
   *  asked about. True when the candidate has signed (or is being asked
   *  to sign) a bond. Doesn't say whether terms are clear — that's the
   *  red-flag's job to surface. */
  serviceBondAccepted: boolean;
  /** Phase 26 — probation period vs confirmed salary distinction surfaced
   *  in dialogue. True when probation is mentioned in a comp context
   *  (i.e. probation salary may differ from post-confirmation salary). */
  probationCompMentioned: boolean;
  /** Fresher-flow extension (2026-05-14). True when the candidate
   *  signals an intern-to-fulltime conversion: phrases like "PPO",
   *  "pre-placement offer", "convert my internship", "I interned with
   *  you". Routes the negotiation to a PPO-aware framing — the
   *  candidate already has demonstrated fit and a recent stipend, so
   *  the recruiter typically anchors near (not at) the fresher entry
   *  band and JB sizing differs from a cold full-time hire. */
  internshipConversion: boolean;
  /** Fresher-flow extension (2026-05-14c). College tier disclosed by the
   *  candidate. Null when unstated or unrecognized. Routes into the
   *  band-resolver to shift the entry band ±20-25% — tier-1 anchors
   *  above the standard fresher rate, tier-3 below. */
  collegeTier: CollegeTier | null;
  /** Junior-flow extension (2026-05-14e). Candidate signals a single
   *  recent job switch (1 or 2 stints within ≤2 years). Distinct from
   *  `tenureSignal="frequent"` which gates on ≥3 switches. Used by
   *  LEVER_GUIDANCE to trigger the "only 1 year — what changed that
   *  justifies this hike?" pushback move. Monotone-up. */
  earlySwitcher: boolean;
  /** Junior-flow extension (2026-05-14e). Candidate self-states that
   *  their current CTC is below market / their actual skill level
   *  ("I'm underpaid", "my current salary doesn't reflect my skills",
   *  "my CTC is low for what I do"). Routes the recruiter to a
   *  "market-anchor-not-hike" reframe instead of pushing back on the
   *  big hike percentage. Monotone-up. */
  lowCtcAlert: boolean;
  /** Junior-flow extension (2026-05-14e). Candidate signals they did
   *  an internship at a DIFFERENT company before their current/prior
   *  full-time role — the internship is a credential, not a current
   *  PPO-conversion event. Distinct from `internshipConversion` (which
   *  is for converting the CURRENT internship at THIS company). Routes
   *  to a "fresher-or-junior" classifier voice. Monotone-up. */
  priorInternshipNonConversion: boolean;
  /** Junior-flow extension (2026-05-14e). Candidate currently works
   *  at an Indian IT-services company (TCS/Infosys/Wipro/Cognizant/HCL/
   *  TechM/Mindtree/LTI/etc) or self-labels "service background". When
   *  the target is a product company (FAANG/unicorn/SaaS), routes to a
   *  "service vs product depth" reframe — service experience is solid
   *  but product values different depth (systems design vs platform
   *  ops), so the band anchors on entry/mid for product even at 2-3
   *  YoE service. Monotone-up. */
  serviceCompanyBackground: boolean;
  /** Mid-level extension (2026-05-14f). Candidate self-states they
   *  don't know their current fixed/variable / base-variable / CTC
   *  breakup — common at 3-6 YoE in IT-services where the candidate
   *  knows the headline number but not the structure. Routes the
   *  recruiter to a "comp-literacy coaching" voice on compensation-
   *  summary instead of negotiating against unknown numbers.
   *  Monotone-up. */
  compBreakupUnknown: boolean;
  /** Real-world Indian extension (2026-05-14g) — candidate was recently
   *  laid off (Byju's / Unacademy / startup shutdown / mass layoff).
   *  Distinct from `careerGapMonths`: this is the REASON for the gap and
   *  it changes the voice — empathetic tone, do NOT anchor down on
   *  current-CTC (the candidate may have been let go before promotion/
   *  appraisal). Monotone-up. */
  recentLayoff: boolean;
  /** Real-world Indian extension (2026-05-14g) — candidate's role is in
   *  a hot-domain bucket (AI/ML/GenAI, Security/AppSec, Quant/HFT).
   *  These commanded 30-50% premium over standard SWE bands in 2026.
   *  Routes the recruiter to a "premium-justified, but show specialty"
   *  voice instead of pushing back on the headline number.
   *  Monotone-up. */
  hotDomainPremium: boolean;
  /** Real-world Indian extension (2026-05-14g) — candidate disclosed
   *  they are on a Performance Improvement Plan / forced exit / "asked
   *  to leave" / non-voluntary separation. HIGH-RISK oversharing
   *  pattern — the recruiter must coach NOT to volunteer this to other
   *  interviewers and must NOT anchor down on current CTC because of
   *  it. Distinct from layoff (PIP = performance signal; layoff =
   *  org/macro signal). Monotone-up. */
  pipDisclosed: boolean;
  /** Real-world Indian extension (2026-05-14g) — candidate states the
   *  offer was made verbally / no offer letter yet / waiting on written
   *  confirmation. Extremely common Indian pattern and a high source of
   *  candidate anxiety. Routes recruiter to a "we'll get the written
   *  offer to you by [date], here's exactly what it will say" voice.
   *  Monotone-up. */
  verbalOnlyOffer: boolean;
  /** Real-world Indian extension (2026-05-14g) — candidate cites a
   *  culturally-rooted joining constraint: muhurat date, wedding,
   *  Diwali, religious festival, family function. Distinct from generic
   *  noticePeriod / joiningDate — recruiters in India should NOT push
   *  back on these; the right voice is accommodating ("understood,
   *  we'll target a post-festival joining and lock the offer letter
   *  now"). Monotone-up. */
  culturalJoiningConstraint: boolean;
  /** Senior-flow extension (2026-05-14h) — candidate claims people-
   *  management scope ("I lead a team of N", "managed X engineers",
   *  "EM / Engineering Manager / Director title"). Routes to a senior-
   *  voice: probe scope (IC+management split, comp-decisions owned)
   *  before pricing the band. Monotone-up. */
  peopleManagementClaimed: boolean;
  /** Senior-flow extension (2026-05-14h) — candidate anchors on a
   *  cross-border / overseas TC ("my Bay Area TC was $250k", "I'm
   *  returning from Singapore / Dubai / London"). Routes recruiter to
   *  the PPP-correction rule: do NOT match USD/SGD/GBP directly;
   *  explain India-market parity for the role. Monotone-up. */
  crossBorderAnchor: boolean;
  /** Senior-flow extension (2026-05-14h) — candidate claims unvested
   *  equity / RSU loss / underwater options as a comp-justification
   *  for higher signing bonus or stretch base. Routes recruiter to a
   *  "we can address unvested via signing-bonus, not base" voice.
   *  Monotone-up. */
  unvestedEquityLossClaim: boolean;
  /** Process-dynamics extension (2026-05-14h) — recruiter from another
   *  company has given an exploding offer (24-72h deadline pressure).
   *  Routes to a "don't get pressured" coaching voice + accelerated
   *  decision support. Monotone-up. */
  explodingOfferPressure: boolean;
  /** Process-dynamics extension (2026-05-14h) — candidate signals they
   *  have accepted then reneged on an offer before, or is considering
   *  reneging now. HIGH RED-FLAG in Indian recruiting; routes recruiter
   *  to a "we're optimizing for a clean acceptance, not a fast one"
   *  voice. Monotone-up. */
  postAcceptanceRenege: boolean;
  /** Process-dynamics extension (2026-05-14h) — sales candidate claims
   *  quota attainment ("hit 140% of quota", "President's Club", "top
   *  performer"). Routes to a probe-the-claim voice + scope sales OTE
   *  framing. Monotone-up. */
  quotaAttainmentClaimed: boolean;
  /** Long-tail extension (2026-05-14h) — candidate is on garden leave
   *  / forced paid time-off between resignation and last-working-day.
   *  Routes recruiter to "joining timeline is firm; we can use GL
   *  productively" framing. Monotone-up. */
  gardenLeaveDisclosed: boolean;
  /** Long-tail extension (2026-05-14h) — candidate's current employer
   *  has a non-compete / restrictive covenant restricting joining
   *  competitors. Routes recruiter to a "let's review the clause and
   *  consult counsel before signing" voice. Monotone-up. */
  nonCompeteFlagged: boolean;
  /** Long-tail extension (2026-05-14h) — candidate asks about a
   *  relocation bonus / moving allowance (common when moving
   *  Bangalore↔Hyderabad↔Pune↔Gurgaon etc). Routes recruiter to
   *  surface the standard relo package proactively. Monotone-up. */
  relocationBonusAsked: boolean;
  /* ─── Wave-2 (2026-05-14i) ──────────────────────────────────────── */
  /** Wave-2A — candidate asks about parent / family insurance cover.
   *  THE #1 unmet Indian benefit ask. Routes recruiter to surface the
   *  parent-floater details proactively. Monotone-up. */
  parentInsuranceAsked: boolean;
  /** Wave-2A — candidate frames comp in in-hand / take-home / monthly
   *  net terms instead of CTC. Routes recruiter to walk through the
   *  CTC → in-hand bridge (PF/gratuity/tax) explicitly. Monotone-up. */
  inHandTakehomeFocus: boolean;
  /** Wave-2A — candidate pushes back on Return-to-Office / mandatory
   *  hybrid days. 2024-2026 Infosys/TCS/Wipro mass-attrition driver.
   *  Routes recruiter to clarify our specific WFO policy + flex.
   *  Monotone-up. */
  rtoPushback: boolean;
  /** Wave-2A — candidate is returning from a maternity break (distinct
   *  from generic careerGap — needs returnship voice + no anchor-down
   *  on stale CTC). Monotone-up. */
  returnshipMaternity: boolean;
  /** Wave-2A — candidate asks for the official pay-band / level-range
   *  / "what's the top of the band". Transparent-comp probe. Routes
   *  recruiter to honest band disclosure within policy. Monotone-up. */
  payBandAsked: boolean;
  /** Wave-2B — candidate asks for tax-optimal CTC structuring (HRA /
   *  LTA / FBP / meal-card / 80C / NPS). Routes to "yes, we can
   *  restructure within these caps" voice. Monotone-up. */
  taxStructureAsked: boolean;
  /** Wave-2B — candidate volunteers anxiety about background-
   *  verification (degree gap, employment gap, comp-inflation, weak
   *  college, "don't call my current manager"). Routes recruiter to
   *  a measured "tell me what you're worried about" voice — and to
   *  the red-flag layer. Monotone-up. */
  bgvAnxiety: boolean;
  /** Wave-2B — candidate probes ESOP sophistication: 409A / FMV /
   *  strike-price / vesting / exercise-window / liquidity-history /
   *  acceleration. Sophisticated-candidate signal — routes recruiter
   *  to data-rich detail mode. Monotone-up. */
  esopSophisticationProbe: boolean;
  /** Wave-2B — candidate cites spouse's job as location/move
   *  constraint ("wife works in Pune"). Common dual-career India
   *  pattern. Routes recruiter to location-flex voice. Monotone-up. */
  spouseJobConstraint: boolean;
  /** Wave-2B — candidate cites aging-parent care as relocation /
   *  travel / WFH constraint. Routes recruiter to WFH-flex + medical-
   *  cover-extending-to-parents voice. Monotone-up. */
  agingParentCare: boolean;
  /** Wave-2C — candidate discloses they intend to / already do
   *  moonlight / side-hustle / second job. Post-Wipro-2022 sensitive
   *  topic — routes recruiter to surface our written moonlighting
   *  policy without surprise. Monotone-up. */
  moonlightingDisclosed: boolean;
  /** Wave-2C — candidate discloses a mental-health / burnout / therapy
   *  history affecting work. SENSITIVE — recruiter must NOT anchor
   *  down; routes to empathetic, "our benefits include EAP / therapy
   *  reimbursement" voice. Monotone-up. */
  mentalHealthDisclosed: boolean;
  /** Wave-2C — candidate asks about gender pay-parity / DEI / pay
   *  audit results. Routes recruiter to honest disclosure of policy
   *  (don't deflect). Monotone-up. */
  payParityAsked: boolean;
  /** Wave-2C — candidate's current employer pre-emptively counter-
   *  offered (raise / promotion / WFH) before resignation. Routes
   *  recruiter to "we know the counter pattern — let's price for the
   *  market, not against the panicked counter" voice. Monotone-up. */
  preemptiveCounterReceived: boolean;
  /** Wave-2C — candidate explicitly asks for an acceptance-grace
   *  period ("can I have 1-2 weeks to decide?"). Routes recruiter to
   *  "yes, here's the offer-validity window; how can I help you
   *  decide?" voice. Monotone-up. */
  acceptanceTimeRequest: boolean;
  /** Wave-2D — candidate frames comp in crypto / token / USDT /
   *  stablecoin terms. Routes recruiter to legal/tax-clarification
   *  voice (RBI tax 30%+TDS for VDAs). Monotone-up. */
  cryptoTokenComp: boolean;
  /** Wave-2D — candidate is at / coming from a Global Capability
   *  Center (GCC / captive) and may anchor on India-arbitrage parent-
   *  comp. Routes recruiter to "we price India-market, not parent-co
   *  arbitrage" voice. Monotone-up. */
  gccArbitrageAnchor: boolean;
  /** Wave-2D — candidate discloses bench-time at their current
   *  services-company (unallocated to a project). Common at TCS/
   *  Infosys/Wipro. Routes recruiter to "bench is structural, not
   *  performance" reframe — do NOT anchor down. Monotone-up. */
  benchTimeDisclosed: boolean;
  /** Wave-2D — candidate is a second-innings ex-founder / ex-CEO
   *  whose last salary was ₹0 / stipend / equity-only. Routes
   *  recruiter to "previous package is non-signal — we price the
   *  role" voice. Monotone-up. */
  founderSecondInnings: boolean;
  /** Wave-2D — candidate is 45+ and signals age-bias concern ("am I
   *  too senior?", "fit with younger team?"). Routes recruiter to
   *  warm-affirming voice + frame seniority as asset, not liability.
   *  Monotone-up. */
  latecareerAgeBias: boolean;
  /** Convenience flag. */
  hasAny: boolean;
}

const EMPTY: CandidateProfileResult = {
  careerGapMonths: null,
  careerGapActivity: null,
  tenureSignal: null,
  levelMismatch: null,
  domainPivot: false,
  transferableSkillsClaimed: false,
  compensationHistoryIssue: null,
  serviceBondAccepted: false,
  probationCompMentioned: false,
  internshipConversion: false,
  collegeTier: null,
  earlySwitcher: false,
  lowCtcAlert: false,
  priorInternshipNonConversion: false,
  serviceCompanyBackground: false,
  compBreakupUnknown: false,
  recentLayoff: false,
  hotDomainPremium: false,
  pipDisclosed: false,
  verbalOnlyOffer: false,
  culturalJoiningConstraint: false,
  peopleManagementClaimed: false,
  crossBorderAnchor: false,
  unvestedEquityLossClaim: false,
  explodingOfferPressure: false,
  postAcceptanceRenege: false,
  quotaAttainmentClaimed: false,
  gardenLeaveDisclosed: false,
  nonCompeteFlagged: false,
  relocationBonusAsked: false,
  parentInsuranceAsked: false,
  inHandTakehomeFocus: false,
  rtoPushback: false,
  returnshipMaternity: false,
  payBandAsked: false,
  taxStructureAsked: false,
  bgvAnxiety: false,
  esopSophisticationProbe: false,
  spouseJobConstraint: false,
  agingParentCare: false,
  moonlightingDisclosed: false,
  mentalHealthDisclosed: false,
  payParityAsked: false,
  preemptiveCounterReceived: false,
  acceptanceTimeRequest: false,
  cryptoTokenComp: false,
  gccArbitrageAnchor: false,
  benchTimeDisclosed: false,
  founderSecondInnings: false,
  latecareerAgeBias: false,
  hasAny: false,
};

/* "1-year gap", "6 month break", "took a break of 8 months",
 * "career gap of 2 years" — months-normalized. */
function extractGapMonths(text: string): number | null {
  /* Year-based phrasing */
  const yPat = /\b(?:gap|break|hiatus|sabbatical|career\s+gap|career\s+break|on\s+a\s+break)\s+(?:of\s+)?(\d{1,2})\s+(?:year|yr|years|yrs)\b/i;
  const yPat2 = /\b(\d{1,2})[-\s]?(?:year|yr|years|yrs)\s+(?:gap|break|hiatus|sabbatical|career\s+gap|career\s+break)\b/i;
  for (const re of [yPat, yPat2]) {
    const m = re.exec(text);
    if (m) {
      const y = parseInt(m[1], 10);
      if (Number.isFinite(y) && y >= 1 && y <= 5) return y * 12;
    }
  }
  /* Month-based phrasing */
  const mPat = /\b(?:gap|break|hiatus|sabbatical|career\s+gap|career\s+break|on\s+a\s+break)\s+(?:of\s+)?(\d{1,2})\s+(?:month|mo|months|mos)\b/i;
  const mPat2 = /\b(\d{1,2})[-\s]?(?:month|mo|months|mos)\s+(?:gap|break|hiatus|sabbatical|career\s+gap|career\s+break)\b/i;
  for (const re of [mPat, mPat2]) {
    const m = re.exec(text);
    if (m) {
      const mo = parseInt(m[1], 10);
      if (Number.isFinite(mo) && mo >= 1 && mo <= 60) return mo;
    }
  }
  /* "took a break for 8 months" — generic */
  const generic = /\b(?:took|had)\s+(?:a\s+)?(?:break|gap)\s+(?:for\s+)?(\d{1,2})\s+(month|mo|months|mos|year|yr|years|yrs)\b/i;
  const g = generic.exec(text);
  if (g) {
    const v = parseInt(g[1], 10);
    if (!Number.isFinite(v)) return null;
    const isYear = /year|yr/i.test(g[2]);
    const months = isYear ? v * 12 : v;
    if (months >= 1 && months <= 60) return months;
  }
  return null;
}

const GAP_ACTIVITY_PATTERNS: { kind: CareerGapActivity; pattern: RegExp }[] = [
  {
    kind: "upskill",
    pattern: /\b(?:upskill(?:ing)?|reskill(?:ing)?|certification|cert\s+exam|coursera|udemy|udacity|edx|bootcamp|learning\s+(?:new\s+)?(?:skills?|tech)|self[-\s]?study(?:ing)?|building\s+(?:projects?|portfolio))\b/i,
  },
  {
    kind: "freelance",
    pattern: /\b(?:freelanc(?:e|ing|er)|consult(?:ing|ant)|contract\s+work|independent\s+(?:work|consultant)|side\s+projects?|gig\s+work)\b/i,
  },
  {
    kind: "family",
    pattern: /\b(?:family\s+(?:reasons?|matters|responsibilities|emergency)|personal\s+(?:reasons?|matters)|caring\s+for|caregiver|parental\s+(?:leave|break)|maternity|paternity|child(?:care)?)\b/i,
  },
  {
    kind: "health",
    pattern: /\b(?:health\s+(?:reasons?|issues?|recovery)|medical\s+(?:reasons?|leave|emergency)|surgery|recovery|wellness\s+break|burnout|burn\s+out)\b/i,
  },
  {
    kind: "study",
    pattern: /\b(?:higher\s+studies|masters?|mba|m\.?tech|phd|doctorate|gmat|gre|further\s+studies|pursuing\s+(?:my\s+)?degree|full[-\s]?time\s+(?:course|degree|program))\b/i,
  },
  {
    kind: "job-search",
    pattern: /\b(?:job\s+search(?:ing)?|interview(?:ing)?\s+(?:actively|around)|looking\s+(?:for|around)|exploring\s+(?:options|opportunities)|between\s+jobs)\b/i,
  },
];

const FREQUENT_SWITCH_PATTERNS = [
  /\b(?:switch(?:ed)?|changed|moved\s+(?:between|across))\s+(?:jobs?|companies|roles)\s+(\d+)\s+times?\b/i,
  /\b(\d+)\s+(?:jobs?|companies|switches)\s+in\s+(\d+)\s+(?:year|yr|years|yrs)\b/i,
  /\b(?:job[-\s]?hopp(?:er|ing)|frequent\s+(?:switch(?:er|es)|changes?|moves?)|short\s+stints?|short\s+tenures?)\b/i,
];

const STABLE_TENURE_PATTERNS = [
  /\b(?:stayed\s+(?:for\s+)?(\d+)\+?\s+(?:year|yr|years|yrs)|tenured?\s+(?:for\s+)?(\d+)\+?\s+(?:year|yr|years|yrs)|long\s+tenure|stable\s+(?:career|tenure)|(\d+)\+?\s+(?:year|yr|years|yrs)\s+at\s+(?:my\s+)?(?:current|same|one)\s+(?:company|role|job))\b/i,
];

function extractTenureSignal(text: string): TenureSignal | null {
  /* "switched 4 times" / "4 jobs in 5 years" / "job hopper" — frequent */
  for (const re of FREQUENT_SWITCH_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      /* If pattern captured a count, gate ≥3. Otherwise the keyword
       * pattern is its own evidence. */
      if (m[1] && m[2]) {
        const jobs = parseInt(m[1], 10);
        const yrs = parseInt(m[2], 10);
        if (Number.isFinite(jobs) && Number.isFinite(yrs) && jobs >= 3 && yrs <= 6) {
          return "frequent";
        }
      } else if (m[1]) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n >= 3) return "frequent";
      } else {
        return "frequent";
      }
    }
  }
  for (const re of STABLE_TENURE_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const yearsStr = m[1] || m[2] || m[3];
      if (yearsStr) {
        const y = parseInt(yearsStr, 10);
        if (Number.isFinite(y) && y >= 4) return "stable";
      } else {
        return "stable";
      }
    }
  }
  return null;
}

const OVER_PATTERNS = [
  /\b(?:over[-\s]?qualified|overqualified|seem\s+over[-\s]?qualified|may\s+(?:be|seem)\s+over[-\s]?qualified|too\s+(?:senior|experienced)\s+for|higher\s+level\s+than\s+(?:this|the)\s+role)\b/i,
];

const UNDER_PATTERNS = [
  /\b(?:under[-\s]?qualified|underqualified|not\s+match(?:ing)?\s+every\s+requirement|short\s+on\s+(?:yoe|experience|years)|less\s+experience\s+than|don.?t\s+match\s+(?:the\s+)?(?:level|requirements?)|may\s+not\s+match\s+every\s+requirement)\b/i,
];

function extractLevelMismatch(text: string): LevelMismatch | null {
  if (OVER_PATTERNS.some((p) => p.test(text))) return "over";
  if (UNDER_PATTERNS.some((p) => p.test(text))) return "under";
  return null;
}

/* Phase 25b — domain-pivot patterns. Two flavours: explicit transition
 * ("moving from teaching to sales", "career change") and "transferable
 * skills" framing that almost always accompanies a pivot. We require
 * a transition phrase OR an explicit pivot keyword; transferable-skills
 * alone is too noisy (anyone might say it in passing). */
const DOMAIN_PIVOT_PATTERNS: RegExp[] = [
  /\b(?:transition(?:ing)?|moving|switching|pivot(?:ing)?|shift(?:ing)?)\s+(?:from|out\s+of|into)\s+\w+(?:\s+\w+){0,3}\s+(?:to|into)\s+\w+/i,
  /\b(?:career\s+(?:change|switch|pivot|transition)|domain\s+(?:change|switch|pivot)|changing\s+(?:domain|field|industry|function))\b/i,
  /\bfrom\s+(?:teaching|design|support|qa|sales|marketing|finance|consulting|operations|hr|customer\s+success)\s+to\s+(?:edtech|product|engineering|pm|data|design|marketing|sales|qa)\b/i,
  /\b(?:i\s+am|i'm|am)\s+(?:transitioning|making\s+a\s+transition|making\s+a\s+pivot|making\s+a\s+switch)\b/i,
];

const TRANSFERABLE_SKILLS_PATTERNS: RegExp[] = [
  /\btransferable\s+skills?\b/i,
  /\b(?:my\s+)?(?:experience|background|skills?)\s+(?:translates?|maps?|carr(?:y|ies))\s+(?:over|across|directly)\b/i,
  /\b(?:adjacent|cross[-\s]?functional|cross[-\s]?domain)\s+(?:skills?|experience|expertise)\b/i,
];

function detectDomainPivot(text: string): {
  domainPivot: boolean;
  transferableSkillsClaimed: boolean;
} {
  const pivot = DOMAIN_PIVOT_PATTERNS.some((p) => p.test(text));
  const transferable = TRANSFERABLE_SKILLS_PATTERNS.some((p) => p.test(text));
  return {
    domainPivot: pivot,
    /* Only count "transferable skills" claims in the context of a pivot
     * — otherwise an SWE saying "my skills carry over to this role" at
     * the same company false-fires. */
    transferableSkillsClaimed: pivot && transferable,
  };
}

/* Phase 25b — payroll-history patterns. "delayed" beats "unpaid" only
 * if both fire; unpaid is the more severe signal so we prefer it when
 * both are present. */
const DELAYED_SALARY_PATTERNS: RegExp[] = [
  /\b(?:salary|salaries|pay(?:cheques?|checks?)?|wages?|comp(?:ensation)?)\s+(?:was|were|got|has\s+been|have\s+been|is\s+being)\s+(?:delayed|late|deferred|withheld\s+briefly)\b/i,
  /\b(?:delayed|late|deferred)\s+(?:salary|salaries|pay(?:cheques?|checks?)?|wages?|payroll)\b/i,
  /\bpayroll\s+(?:was\s+)?(?:delayed|late|deferred|inconsistent|irregular)\b/i,
  /\b(?:company|employer)\s+(?:was|has\s+been)\s+(?:delaying|withholding)\s+(?:salary|payment|pay)/i,
];

const UNPAID_SALARY_PATTERNS: RegExp[] = [
  /\b(?:salary|salaries|wages?|pay(?:cheques?|checks?)?)\s+(?:was|were|has\s+been|have\s+been)\s+unpaid\b/i,
  /\b(?:unpaid|outstanding)\s+(?:salary|salaries|wages?|dues?|payroll|months?)\b/i,
  /\b(?:didn't|did\s+not|hasn'?t|haven'?t)\s+(?:get|receive|been\s+paid)\s+(?:salary|paid|paycheck|wages?)\s+(?:for\s+|in\s+)?(?:\d+\s+)?(?:months?|weeks?)/i,
  /\b(?:not\s+been\s+paid|haven'?t\s+been\s+paid|unpaid\s+for|owed)\s+(?:for\s+)?\d+\s+(?:months?|weeks?)/i,
];

function detectCompensationHistoryIssue(
  text: string,
): CompensationHistoryIssue | null {
  if (UNPAID_SALARY_PATTERNS.some((p) => p.test(text))) return "unpaid";
  if (DELAYED_SALARY_PATTERNS.some((p) => p.test(text))) return "delayed";
  return null;
}

/* Phase 26 — service-agreement / training-bond patterns. Fires when the
 * candidate either accepts a bond or is being explicitly asked about
 * one in a current/prior employment context. The red-flag layer then
 * surfaces it as "unverified" unless the candidate also discussed exit
 * conditions / financial penalty. */
const SERVICE_BOND_PATTERNS: RegExp[] = [
  /\bservice\s+(?:agreement|bond|commitment)\b/i,
  /\btraining\s+bond\b/i,
  /\b(?:\d+)[-\s]?(?:year|yr|years|yrs)\s+(?:bond|commitment|service\s+agreement)\b/i,
  /\bsigned?\s+a?\s+bond\b/i,
  /\bbond\s+(?:period|amount|penalty|clause|terms?)\b/i,
];

function detectServiceBond(text: string): boolean {
  return SERVICE_BOND_PATTERNS.some((p) => p.test(text));
}

/* Phase 26 — probation-comp patterns. The probation period typically
 * carries a lower salary than post-confirmation comp; recruiters often
 * leave this implicit. Fires when probation is mentioned alongside a
 * comp/salary token, OR explicitly named as a comp period. */
const PROBATION_COMP_PATTERNS: RegExp[] = [
  /\bprobation\s+(?:period|salary|comp(?:ensation)?|pay|ctc)\b/i,
  /\b(?:during|in)\s+probation\b/i,
  /\bpost[-\s]?(?:confirmation|probation)\s+(?:salary|comp|ctc|pay)\b/i,
  /\b(?:after|once)\s+(?:confirmation|probation)\s+(?:i|my|the)?\s*(?:salary|ctc|pay|comp)/i,
];

function detectProbationComp(text: string): boolean {
  return PROBATION_COMP_PATTERNS.some((p) => p.test(text));
}

/* Fresher-flow extension (2026-05-14). Intern-to-fulltime conversion
 * detection. Fires when the candidate signals that the current
 * negotiation is for converting a prior or current internship into
 * a full-time role — a "PPO" (pre-placement offer) in Indian campus
 * recruiting parlance. Common phrasings:
 *   - "PPO", "pre-placement offer", "pre placement offer"
 *   - "convert my internship", "convert the internship", "internship to full-time"
 *   - "I interned with you", "I interned here", "I was your intern"
 *   - "intern conversion"
 * Pure. */
const INTERNSHIP_CONVERSION_PATTERNS: RegExp[] = [
  /\bppo\b/i,
  /\bpre[-\s]?placement\s+offer\b/i,
  /\bconvert(?:ing|ed)?\s+(?:my\s+|the\s+)?internship\b/i,
  /\binternship\s+(?:to|into)\s+full[-\s]?time\b/i,
  /\bintern(?:ed|ing)?\s+(?:with|at|for)\s+you\b/i,
  /\bi\s+(?:was|am)\s+(?:your|the)\s+intern\b/i,
  /\bintern\s+conversion\b/i,
];

function detectInternshipConversion(text: string): boolean {
  return INTERNSHIP_CONVERSION_PATTERNS.some((p) => p.test(text));
}

/* ─── Fresher-flow extension (2026-05-14c) — college-tier detection ──
 *
 * Indian campus hiring outcomes correlate strongly with college tier.
 * Three patterns recognized:
 *
 *   tier-1 — explicit IIT/IISc/NIT/IIIT-H/BITS Pilani/IIM mentions,
 *     plus generic "tier-1 college", "top-tier institute", "premier
 *     institute" labels.
 *   tier-2 — VIT/SRM/Manipal/DTU/NSUT/COEP/PEC/Thapar mentions, plus
 *     "tier-2 college" label.
 *   tier-3 — explicit "tier-3 college" / "non-tier-1" label; we do NOT
 *     try to enumerate private colleges by name (too many, too noisy).
 *
 * Conservative: only fires on clear name match or unambiguous tier
 * label. Returns null when the candidate just says "engineering
 * college" or "did my B.Tech" without naming it. */
const COLLEGE_TIER_1_PATTERNS: RegExp[] = [
  /\biit\s*[-(\s]?(?:bombay|delhi|madras|kanpur|kharagpur|roorkee|guwahati|hyderabad|bhilai|gandhinagar|indore|jodhpur|mandi|patna|ropar|tirupati|varanasi|bhubaneswar|dhanbad|goa|palakkad|jammu|dharwad)?[)\s]/i,
  /\b(?:iit|iisc|iiit[-\s]?(?:h|hyderabad|delhi|bangalore))\b/i,
  /\bnit\s*(?:trichy|warangal|surathkal|calicut|rourkela|allahabad|kurukshetra|nagpur)?\b/i,
  /\bbits\s+(?:pilani|hyderabad|goa|dubai)?\b/i,
  /\biim\s+(?:ahmedabad|bangalore|calcutta|kozhikode|lucknow|indore)\b/i,
  /\b(?:tier[-\s]?1|tier[-\s]?one)\s+(?:college|institute|school)\b/i,
  /\b(?:top[-\s]?tier|premier)\s+(?:college|institute|engineering\s+college)\b/i,
];
const COLLEGE_TIER_2_PATTERNS: RegExp[] = [
  /\b(?:vit|srm|manipal|dtu|nsut|coep|pec\s+chandigarh|thapar|amity|christ|symbiosis)\b/i,
  /\b(?:tier[-\s]?2|tier[-\s]?two)\s+(?:college|institute|school)\b/i,
];
const COLLEGE_TIER_3_PATTERNS: RegExp[] = [
  /\b(?:tier[-\s]?3|tier[-\s]?three)\s+(?:college|institute|school)\b/i,
  /\b(?:non[-\s]?tier[-\s]?1|non[-\s]?premier)\s+(?:college|institute)\b/i,
];

/* ─── Junior-flow extensions (2026-05-14e) ────────────────────────── */

/* `earlySwitcher` — candidate is on their first or second job switch
 * within ≤2 years of total experience. Distinct from frequent-switcher
 * (≥3 switches). Three classes of evidence:
 *   - explicit "first job switch", "first switch", "switching for the
 *     first time"
 *   - "1 year" or "X months" tenure + currently looking ("switching",
 *     "moving", "looking for change") — captures "I've been at TCS for
 *     1 year and now want to switch"
 *   - "first job" + "X months/years" + transition language */
const EARLY_SWITCHER_PATTERNS: RegExp[] = [
  /\bfirst\s+(?:job\s+)?(?:switch|move|change|transition|jump)\b/i,
  /\b(?:switching|moving|changing)\s+(?:jobs?|companies)\s+for\s+the\s+first\s+time\b/i,
  /\b(?:i'?ve\s+been|been|after)\s+(?:at\s+\w+\s+|here\s+|with\s+\w+\s+)?(?:for\s+)?(?:about\s+|just\s+|only\s+)?(\d+)\s+(?:month|mo|months|mos|year|yr|years|yrs)\b.{0,80}\b(?:looking|switching|moving|change|want\s+to\s+(?:switch|move|leave|change))\b/i,
  /\bonly\s+(?:about\s+|just\s+)?(\d+)\s+(?:month|months|year|years|yr|yrs)\s+(?:at|in)\b.{0,40}\b(?:switching|moving|change)\b/i,
];

function detectEarlySwitcher(text: string): boolean {
  for (const re of EARLY_SWITCHER_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    /* When a tenure-count is captured, require ≤24 months — anything
     * above 2 years stops being "early". When no number is captured
     * (explicit "first switch" phrasing), the keyword is its own
     * evidence. */
    if (m[1]) {
      const n = parseInt(m[1], 10);
      if (!Number.isFinite(n)) continue;
      const isYear = /year|yr/i.test(m[0]);
      const months = isYear ? n * 12 : n;
      if (months <= 24) return true;
    } else {
      return true;
    }
  }
  return false;
}

/* `lowCtcAlert` — candidate self-states that their current CTC is
 * below market or below what their skills warrant. Fires the
 * "market-anchor-not-hike" reframe in LEVER_GUIDANCE. Conservative:
 * needs explicit self-statement, not just a low number — the numeric
 * check is the kernel's job (state.candidateCurrentCtc vs band). */
const LOW_CTC_PATTERNS: RegExp[] = [
  /\b(?:my\s+(?:current\s+)?(?:salary|ctc|pay|comp(?:ensation)?))\s+(?:is\s+)?(?:low|below\s+market|under\s+market|underpaid|much\s+lower|too\s+low|on\s+the\s+lower\s+side)\b/i,
  /\b(?:i'?m|i\s+am|i\s+feel)\s+(?:underpaid|undervalued|under[-\s]?compensated|under\s+market|below\s+market)\b/i,
  /\b(?:current|prior|last)\s+(?:salary|ctc|pay|package)\s+(?:doesn'?t|does\s+not|never)\s+(?:reflect|match|capture|represent)\s+(?:my\s+)?(?:current\s+|actual\s+|real\s+)?(?:skill|skills|level|responsibilities|work|value)\b/i,
  /\b(?:underpaid\s+for|under\s+market\s+for)\s+(?:my\s+|the\s+)?(?:role|skill|work|level)\b/i,
];

function detectLowCtcAlert(text: string): boolean {
  return LOW_CTC_PATTERNS.some((p) => p.test(text));
}

/* `priorInternshipNonConversion` — candidate did an internship at a
 * DIFFERENT company before their current/prior full-time role. The
 * internship is a credential on the resume, not a PPO conversion
 * event for this negotiation. Distinct from `internshipConversion`:
 *   - internshipConversion = "I'm your intern, converting to FT"
 *   - priorInternshipNonConversion = "I interned at Google, then joined
 *     TCS, now applying to Flipkart" */
const PRIOR_INTERNSHIP_NONCONVERSION_PATTERNS: RegExp[] = [
  /\b(?:i\s+)?intern(?:ed|ship)\s+(?:at|with|for)\s+(?!you\b|us\b|here\b|this\s+company\b)\w+/i,
  /\b(?:summer\s+intern(?:ship)?|winter\s+intern(?:ship)?|industrial\s+trainee)\s+(?:at|with)\s+\w+/i,
  /\b(?:after\s+(?:my\s+)?internship|post[-\s]?internship)\s+(?:i\s+)?(?:joined|moved|went\s+to|started)\b/i,
  /\b(?:did|completed|finished)\s+(?:an?\s+|my\s+)?internship\s+(?:before|prior\s+to|earlier)\b/i,
];

function detectPriorInternshipNonConversion(text: string, isConversionDetected: boolean): boolean {
  if (isConversionDetected) return false; /* current PPO trumps prior credential */
  return PRIOR_INTERNSHIP_NONCONVERSION_PATTERNS.some((p) => p.test(text));
}

/* `serviceCompanyBackground` — candidate works at / came from an
 * Indian IT-services company. Two classes of evidence:
 *   - explicit company name (TCS/Infosys/Wipro/Cognizant/HCL/TechM/
 *     Mindtree/LTI/L&T Infotech/Capgemini/Accenture-India/IBM-India/
 *     DXC/Mphasis)
 *   - self-label ("service company", "service background", "from
 *     services side", "IT services") */
const SERVICE_COMPANY_PATTERNS: RegExp[] = [
  /\b(tcs|infosys|wipro|cognizant|hcl\s+(?:tech|technologies)?|tech\s+mahindra|techm|mindtree|lti|l&t\s+infotech|capgemini|accenture(?:\s+india)?|ibm\s+india|dxc|mphasis|persistent\s+systems|hexaware|coforge|birlasoft|kpit|cyient|nseit|sonata)\b/i,
  /\b(?:it[-\s]?services|service[-\s]company|service[-\s]background|services\s+side|services\s+company|services\s+firm)\b/i,
  /\b(?:from|in|at)\s+(?:a\s+)?service[-\s]?(?:based\s+)?(?:company|firm|background|side)\b/i,
];

function detectServiceCompanyBackground(text: string): boolean {
  return SERVICE_COMPANY_PATTERNS.some((p) => p.test(text));
}

/* `compBreakupUnknown` — candidate self-states they don't know their
 * fixed/variable/CTC breakup. Common at 3-6 YoE in IT-services where
 * the offer letter shows a headline number and the structure is
 * opaque to the candidate. The recruiter should coach (state the
 * structure they would offer) rather than negotiate against unknowns. */
const COMP_BREAKUP_UNKNOWN_PATTERNS: RegExp[] = [
  /\b(?:i\s+(?:don'?t|do\s+not)\s+know|not\s+sure(?:\s+of)?|haven'?t\s+checked|haven'?t\s+seen|need\s+to\s+(?:check|confirm|verify))\s+(?:(?:my|the|exact|exactly)\s+){0,3}(?:base|fixed|variable|breakup|break[-\s]?up|split|structure|component|breakdown|fixed[-\s\/]+variable)\b/i,
  /\b(?:my\s+)?(?:base|fixed|variable|breakup|break[-\s]?up|split|structure)\s+(?:is\s+)?(?:not\s+clear|unclear|something\s+i\s+(?:would\s+)?need\s+to\s+check)\b/i,
  /\b(?:i\s+only\s+know|i\s+(?:just\s+)?know)\s+(?:the\s+)?(?:total\s+ctc|headline\s+(?:number|figure|ctc)|ctc\s+number)\b/i,
  /\b(?:don'?t|do\s+not)\s+(?:remember|recall)\s+(?:the\s+)?(?:exact\s+)?(?:base|fixed|variable|breakup|split|structure|breakdown)\b/i,
];

function detectCompBreakupUnknown(text: string): boolean {
  return COMP_BREAKUP_UNKNOWN_PATTERNS.some((p) => p.test(text));
}

/* ─── Real-world Indian extensions (2026-05-14g) ────────────────────── */

/* `recentLayoff` — candidate was let go in a layoff / RIF / company
 * shutdown. Common 2024-2026 pattern (Byju's, Unacademy, Vedantu,
 * crypto-winter, generic edtech/startup shutdowns). Distinguished
 * from "I quit" — fires on involuntary separation cause language. */
const RECENT_LAYOFF_PATTERNS: RegExp[] = [
  /\b(?:i\s+was|got|i\s+got|been|recently)\s+(?:laid[-\s]?off|let\s+go|made\s+redundant|impacted|affected)\b/i,
  /\b(?:layoff|lay[-\s]?off|layoffs|riff?|reduction\s+in\s+force|mass\s+layoff|workforce\s+reduction)\b/i,
  /\b(?:part\s+of\s+(?:the\s+)?(?:layoffs?|riff?|cuts?|reduction)|in\s+(?:the\s+)?(?:layoffs?|riff?))\b/i,
  /\b(?:company|startup|byju'?s?|unacademy|vedantu|udaan|cars24|ola|paytm)\s+(?:shut\s+down|shutdown|wound\s+down|went\s+under|filed\s+for\s+bankruptcy|closed\s+(?:down|operations))\b/i,
  /\b(?:my\s+)?(?:role|position|team|division|business\s+unit)\s+(?:was|got)\s+(?:eliminated|cut|shut\s+down|wound\s+down|dissolved)\b/i,
];

function detectRecentLayoff(text: string): boolean {
  return RECENT_LAYOFF_PATTERNS.some((p) => p.test(text));
}

/* `hotDomainPremium` — candidate's role / specialty is in a hot
 * 2026 bucket commanding 30-50% premium over std SWE: AI/ML/GenAI/
 * LLM/applied-ML, Security/AppSec/InfoSec/cybersec, Quant/HFT.
 * Conservative: requires an explicit specialty mention in a
 * comp / role / experience context. The kernel's domain classifier
 * is independent — this fires when the CANDIDATE invokes the
 * specialty as a comp-justification signal. */
const HOT_DOMAIN_PREMIUM_PATTERNS: RegExp[] = [
  /\b(?:gen[-\s]?ai|generative\s+ai|llm\s+(?:engineer|engineering|ops|infra|training|fine[-\s]?tuning)|prompt\s+engineer|foundation\s+model|rag\s+(?:engineer|pipeline)|agentic\s+(?:ai|systems?))\b/i,
  /\b(?:applied\s+ml|ml\s+(?:engineer|infra|platform|ops|research|scientist)|machine\s+learning\s+(?:engineer|scientist|infrastructure)|ai\s+(?:engineer|scientist|researcher))\b/i,
  /\b(?:appsec|app[-\s]?sec|application\s+security|security\s+engineer|infosec|cybersecurity|cyber\s+security|red\s+team|offensive\s+security|pen[-\s]?test(?:er|ing)?|cloud\s+security)\b/i,
  /\b(?:quant(?:itative)?\s+(?:researcher|developer|trader|analyst)|hft|high[-\s]?frequency\s+trading|low[-\s]?latency\s+trading|trading\s+systems)\b/i,
  /\b(?:premium\s+for|market\s+premium|skill\s+premium|domain\s+premium|specialist\s+premium)\s+(?:ai|ml|gen[-\s]?ai|security|llm|quant)\b/i,
];

function detectHotDomainPremium(text: string): boolean {
  return HOT_DOMAIN_PREMIUM_PATTERNS.some((p) => p.test(text));
}

/* `pipDisclosed` — candidate volunteered that they are on / were on a
 * Performance Improvement Plan, or were forced out / asked to leave
 * for performance reasons. HIGH-RISK oversharing — the AI should
 * NOT pile on, should coach against further disclosure, and should
 * NOT use it to anchor down. Conservative: only fires on explicit
 * PIP / forced-exit language. */
const PIP_DISCLOSED_PATTERNS: RegExp[] = [
  /\b(?:pip|p\.?i\.?p\.?|performance\s+improvement\s+plan)\b/i,
  /\b(?:on\s+a\s+pip|put\s+on\s+a?\s*pip|placed\s+on\s+a?\s*pip)\b/i,
  /\b(?:asked\s+to\s+leave|forced\s+(?:to\s+)?(?:resign|leave|exit)|forced\s+out|managed\s+out|pushed\s+out)\b/i,
  /\b(?:performance\s+(?:issues?|concerns?|reasons?|exit|termination))\b/i,
  /\b(?:terminated\s+for\s+performance|fired\s+for\s+performance|let\s+go\s+for\s+performance)\b/i,
];

function detectPipDisclosed(text: string): boolean {
  return PIP_DISCLOSED_PATTERNS.some((p) => p.test(text));
}

/* `verbalOnlyOffer` — candidate states the offer is verbal / no
 * written offer letter / waiting on offer letter / promised
 * verbally. Recruiter should commit to a written-offer date and
 * spell out the terms. */
const VERBAL_ONLY_OFFER_PATTERNS: RegExp[] = [
  /\b(?:verbal\s+(?:offer|commitment|agreement|confirmation)|offered\s+verbally|told\s+verbally|verbally\s+(?:offered|confirmed|told|promised|committed))\b/i,
  /\b(?:no\s+(?:offer\s+letter|written\s+offer|ol\b)\s+(?:yet|so\s+far)|still\s+(?:waiting|awaiting)\s+(?:for\s+)?(?:the\s+)?(?:offer\s+letter|written\s+offer|ol\b))\b/i,
  /\b(?:offer\s+letter\s+(?:is\s+)?(?:pending|not\s+(?:yet\s+)?(?:received|received\s+yet|issued)|delayed))\b/i,
  /\b(?:nothing\s+in\s+writing|haven'?t\s+(?:received|gotten|got)\s+(?:the\s+)?(?:written\s+)?(?:offer|ol\b)|need\s+(?:it|the\s+offer)\s+in\s+writing)\b/i,
];

function detectVerbalOnlyOffer(text: string): boolean {
  return VERBAL_ONLY_OFFER_PATTERNS.some((p) => p.test(text));
}

/* `culturalJoiningConstraint` — Indian-specific joining-date
 * constraint rooted in a cultural / family event. Muhurat (auspicious
 * date), wedding, Diwali / Holi / Eid / Karva Chauth, sibling
 * wedding, family function, gruhapravesham (housewarming). The
 * recruiter should accommodate, not push back. */
const CULTURAL_JOINING_PATTERNS: RegExp[] = [
  /\b(?:muhurat|muhurtham|muhurath|auspicious\s+(?:date|day|time))\b/i,
  /\b(?:after|post|before)\s+(?:my\s+|the\s+|sister'?s?\s+|brother'?s?\s+)?(?:wedding|marriage|engagement|reception)\b/i,
  /\b(?:my\s+|sister'?s?\s+|brother'?s?\s+|cousin'?s?\s+)?wedding\s+(?:is\s+)?(?:in|on|scheduled|coming\s+up|happening|planned)\b/i,
  /\b(?:after|post|before|around|during)\s+(?:diwali|holi|eid|onam|pongal|navratri|ganesh\s+chaturthi|durga\s+puja|christmas|new\s+year)\b/i,
  /\b(?:family\s+(?:function|event|wedding|ceremony|obligation|commitment)|gruhapravesham|housewarming|griha\s+pravesh|naming\s+ceremony)\b/i,
  /\b(?:can(?:not|'t)\s+join|unable\s+to\s+join|need\s+to\s+delay\s+joining)\s+(?:before|until|till)\s+(?:diwali|wedding|muhurat|after\s+the\s+festival)\b/i,
];

function detectCulturalJoiningConstraint(text: string): boolean {
  return CULTURAL_JOINING_PATTERNS.some((p) => p.test(text));
}

/* ─── Senior-flow + process + long-tail (2026-05-14h) ──────────────── */

/* `peopleManagementClaimed` — candidate self-states management scope. */
const PEOPLE_MGMT_PATTERNS: RegExp[] = [
  /\b(?:i\s+(?:lead|manage|run|head))\s+(?:a\s+)?(?:team\s+of\s+)?\d+\s+(?:engineers?|people|reports?|folks|members|developers?|designers?|analysts?|managers?)\b/i,
  /\b(?:i\s+have|managing|leading)\s+\d+\s+(?:direct\s+)?reports?\b/i,
  /\b(?:engineering\s+manager|eng\s+manager|em\b|director\s+of\s+engineering|head\s+of\s+(?:engineering|product|design|data)|senior\s+(?:engineering\s+)?manager|tech\s+lead\s+manager|tlm\b|people\s+manager|line\s+manager)\b/i,
  /\b(?:team\s+of\s+\d+|\d+\s+person\s+team|\d+[-\s]person\s+team)\b/i,
  /\b(?:managing|leading|owned)\s+(?:a\s+)?(?:team|squad|pod|tribe)\s+(?:of\s+)?(?:engineers?|people|designers?|analysts?)/i,
];
function detectPeopleManagementClaimed(text: string): boolean {
  return PEOPLE_MGMT_PATTERNS.some((p) => p.test(text));
}

/* `crossBorderAnchor` — candidate cites overseas TC / return-to-India. */
const CROSS_BORDER_PATTERNS: RegExp[] = [
  /\b(?:returning|moving\s+back|coming\s+back|relocat(?:ing|ed))\s+(?:to\s+india\s+)?from\s+(?:the\s+)?(?:us|usa|united\s+states|bay\s+area|silicon\s+valley|seattle|new\s+york|sf|san\s+francisco|singapore|sg|dubai|uae|london|uk|united\s+kingdom|canada|australia|berlin|germany|netherlands|amsterdam|zurich|switzerland)\b/i,
  /\b(?:my|current|prior|last)\s+(?:tc|total\s+comp(?:ensation)?|salary|package|comp(?:ensation)?)\s+(?:is|was)\s+(?:\$|usd|sgd|gbp|eur|aed|cad|aud)\s*[\d,.]+/i,
  /\b(?:bay\s+area|silicon\s+valley|us\s+market|singapore\s+market|dubai\s+market|london\s+market)\s+(?:tc|comp|salary|package|rates?|standards?)\b/i,
  /\b(?:nri|non[-\s]resident\s+indian|h1b|h[-\s]?1b|green\s+card|ep\s+pass|employment\s+pass)\b/i,
  /\b(?:return(?:ing)?\s+to\s+india|move\s+back\s+to\s+india|coming\s+home\s+to\s+india)\b/i,
];
function detectCrossBorderAnchor(text: string): boolean {
  return CROSS_BORDER_PATTERNS.some((p) => p.test(text));
}

/* `unvestedEquityLossClaim` — candidate cites unvested equity loss. */
const UNVESTED_EQUITY_PATTERNS: RegExp[] = [
  /\b(?:unvested|leaving\s+behind|walking\s+away\s+from|forfeit(?:ing)?|losing)\s+(?:my\s+|the\s+)?(?:rsus?|stock|equity|options?|shares?|grant|esops?|vesting)\b/i,
  /\b(?:rsus?|stock|equity|options?|esops?)\s+(?:left|remaining|outstanding|unvested|not\s+(?:yet\s+)?vested)\b/i,
  /\b(?:underwater|out\s+of\s+the\s+money|otm)\s+(?:options?|stock|equity|grants?)\b/i,
  /\b(?:signing\s+bonus|joining\s+bonus|sign[-\s]on|sign\s+on)\s+(?:to\s+)?(?:offset|cover|make\s+up\s+for|compensate)\s+(?:the\s+)?(?:unvested|loss|equity|rsus?|stock)\b/i,
  /\b(?:make\s+(?:me\s+)?whole|whole\s+(?:me\s+)?up)\s+(?:for|on)\s+(?:the\s+)?(?:unvested|rsus?|equity|stock|grant)\b/i,
];
function detectUnvestedEquityLossClaim(text: string): boolean {
  return UNVESTED_EQUITY_PATTERNS.some((p) => p.test(text));
}

/* `explodingOfferPressure` — another company gave a tight deadline. */
const EXPLODING_OFFER_PATTERNS: RegExp[] = [
  /\b(?:exploding\s+offer|24[-\s]?hour\s+(?:deadline|window)|48[-\s]?hour\s+(?:deadline|window)|72[-\s]?hour\s+(?:deadline|window))\b/i,
  /\b(?:they|other\s+(?:company|recruiter|offer|firm))\s+(?:want|wants|need|needs|gave\s+me|are\s+giving\s+me|said)\s+(?:a\s+)?(?:decision|answer|response)\s+(?:in|within|by)\s+(?:\d+\s+)?(?:hours?|days?|tomorrow|tonight|end\s+of\s+(?:day|week))\b/i,
  /\b(?:decide|decision)\s+(?:by\s+)?(?:tomorrow|tonight|end\s+of\s+(?:day|week)|in\s+\d+\s+(?:hours?|days?))\b/i,
  /\b(?:pressured|pressuring|rushing|rushed)\s+(?:me\s+)?(?:to\s+)?(?:decide|accept|sign|commit)\b/i,
  /\b(?:offer\s+expires?|expires?\s+(?:in|on)|valid\s+(?:for\s+)?(?:only\s+)?(?:\d+\s+)?(?:hours?|days?))\b/i,
];
function detectExplodingOfferPressure(text: string): boolean {
  return EXPLODING_OFFER_PATTERNS.some((p) => p.test(text));
}

/* `postAcceptanceRenege` — candidate has reneged before or is now. */
const POST_ACCEPTANCE_RENEGE_PATTERNS: RegExp[] = [
  /\b(?:accepted\s+(?:another\s+offer\s+)?(?:then|but)\s+(?:reneged|backed\s+out|changed\s+my\s+mind|declined|reneg(?:ed|ing)))\b/i,
  /\b(?:renege|reneged|reneging|back\s+out\s+of|backed\s+out\s+of|backing\s+out\s+of|pulling\s+out\s+of)\s+(?:an?\s+|the\s+)?(?:offer|acceptance|commitment)\b/i,
  /\b(?:dropping|drop|ghost(?:ing|ed)?)\s+(?:another\s+offer|previously\s+accepted\s+offer|the\s+previous\s+offer)\b/i,
  /\b(?:already\s+(?:accepted|signed)\s+(?:another|a\s+different)\s+offer\s+(?:but|and\s+now))\b/i,
  /\b(?:bait\s+and\s+switch|reneged\s+on|broke\s+(?:my\s+|the\s+)?commitment)\b/i,
];
function detectPostAcceptanceRenege(text: string): boolean {
  return POST_ACCEPTANCE_RENEGE_PATTERNS.some((p) => p.test(text));
}

/* `quotaAttainmentClaimed` — sales candidate cites attainment metric. */
const QUOTA_ATTAINMENT_PATTERNS: RegExp[] = [
  /\b(?:hit|achieved|attained|exceeded|crushed|beat|delivered)\s+\d{2,3}\s*%\s+(?:of\s+)?(?:my\s+|the\s+)?(?:quota|target|number|plan)\b/i,
  /\b\d{2,3}\s*%\s+(?:quota|target|attainment|of\s+plan|to\s+quota|to\s+target)\b/i,
  /\b(?:president'?s?\s+club|club\s+winner|top\s+performer|top\s+(?:\d+\s*%|quartile|decile)|rep\s+of\s+the\s+(?:year|quarter))\b/i,
  /\b(?:quota\s+attainment|attainment\s+(?:of|was|is)|quota[-\s]carrying)\b/i,
  /\b(?:closed|booked|brought\s+in|generated)\s+(?:\$|usd|inr|₹|rs\.?)\s*[\d,.]+\s*(?:m|mn|million|cr|crore|lakhs?|l|k)\s+(?:in\s+)?(?:arr|bookings|revenue|pipeline|deals?)/i,
];
function detectQuotaAttainmentClaimed(text: string): boolean {
  return QUOTA_ATTAINMENT_PATTERNS.some((p) => p.test(text));
}

/* `gardenLeaveDisclosed` — candidate is on / will be on garden leave. */
const GARDEN_LEAVE_PATTERNS: RegExp[] = [
  /\bgarden(?:ing)?\s+leave\b/i,
  /\b(?:on\s+|in\s+)?(?:paid\s+leave|paid\s+notice|paid\s+sit[-\s]out)\s+(?:period|between\s+jobs|until|till)\b/i,
  /\b(?:asked|told|forced)\s+to\s+(?:sit\s+out|stay\s+home|not\s+work)\s+(?:my\s+|the\s+)?notice\b/i,
];
function detectGardenLeaveDisclosed(text: string): boolean {
  return GARDEN_LEAVE_PATTERNS.some((p) => p.test(text));
}

/* `nonCompeteFlagged` — current contract has restrictive covenant. */
const NON_COMPETE_PATTERNS: RegExp[] = [
  /\b(?:non[-\s]?compete(?:\s+clause|\s+agreement)?|nca\b|restrictive\s+covenant|restraint\s+of\s+trade)\b/i,
  /\b(?:non[-\s]?solicit(?:ation)?(?:\s+clause)?|cannot\s+join\s+competitors?|restricted\s+from\s+(?:joining|working\s+with))\b/i,
  /\b(?:competitor\s+list|competing\s+(?:companies|firms|employers))\s+(?:clause|in\s+(?:my\s+)?contract)\b/i,
];
function detectNonCompeteFlagged(text: string): boolean {
  return NON_COMPETE_PATTERNS.some((p) => p.test(text));
}

/* `relocationBonusAsked` — candidate asks about relo package. */
const RELOCATION_PATTERNS: RegExp[] = [
  /\b(?:relocation|relo|moving|move)\s+(?:bonus|allowance|package|assistance|support|reimbursement|expenses?)\b/i,
  /\b(?:cover|reimburse|pay\s+for)\s+(?:my\s+|the\s+)?(?:moving|relocation|move)\s+(?:cost|expense|charges)/i,
  /\b(?:relocating|moving)\s+(?:to|from)\s+(?:bangalore|bengaluru|hyderabad|pune|gurgaon|gurugram|noida|chennai|mumbai|delhi|kolkata|kochi|ahmedabad)\b.{0,80}\b(?:bonus|allowance|package|support|cover)/i,
];
function detectRelocationBonusAsked(text: string): boolean {
  return RELOCATION_PATTERNS.some((p) => p.test(text));
}

/* ─── Wave-2 (2026-05-14i) — 20 deeper Indian-market signals ──────── */

/* Wave-2A — parent / family insurance ask. */
const PARENT_INSURANCE_PATTERNS: RegExp[] = [
  /\b(?:parents?|family|in[-\s]?laws?|spouse|dependents?)\s+(?:insurance|medical|mediclaim|health\s+cover|coverage|floater)\b/i,
  /\b(?:medical|insurance|mediclaim|health\s+cover|floater)\s+(?:for|cover(?:ing|s)?|include[ds]?)\s+(?:my\s+)?(?:parents?|family|in[-\s]?laws?|spouse|dependents?)\b/i,
  /\b(?:does\s+(?:the\s+)?(?:medical|insurance|mediclaim|cover)|insurance\s+sum\s+insured|sum\s+insured|family\s+floater\s+amount)\b/i,
  /\b(?:opd|out[-\s]?patient)\s+(?:cover(?:age)?|benefit|reimbursement)\b/i,
  /\b(?:cover|covering|include|including)\s+(?:my\s+)?(?:parents?|in[-\s]?laws?|family|dependents?)\s+(?:in|under|on)\s+(?:the\s+)?(?:medical|insurance|mediclaim|floater|policy)\b/i,
  /\b(?:cover|covering|include|including)\s+(?:my\s+)?(?:parents?|in[-\s]?laws?|dependents?)\b/i,
];
function detectParentInsuranceAsked(t: string): boolean {
  return PARENT_INSURANCE_PATTERNS.some((p) => p.test(t));
}

/* Wave-2A — in-hand / take-home / monthly net focus. */
const INHAND_TAKEHOME_PATTERNS: RegExp[] = [
  /\b(?:in[-\s]?hand|take[-\s]?home|net\s+(?:salary|pay|monthly|in[-\s]?hand))\b/i,
  /\b(?:monthly\s+(?:in[-\s]?hand|net|take[-\s]?home|salary|deposit|credit)|per[-\s]?month\s+(?:in[-\s]?hand|net|take[-\s]?home))\b/i,
  /\b(?:what\s+(?:will|would|do)\s+(?:i|my)\s+(?:get|receive|see|take\s+home))\s+(?:in[-\s]?hand|monthly|per[-\s]?month|net)\b/i,
  /\b(?:gross\s+(?:vs\.?|versus)\s+net|ctc\s+(?:vs\.?|versus)\s+(?:in[-\s]?hand|take[-\s]?home|net))\b/i,
];
function detectInHandTakehomeFocus(t: string): boolean {
  return INHAND_TAKEHOME_PATTERNS.some((p) => p.test(t));
}

/* Wave-2A — Return-to-Office pushback. */
const RTO_PUSHBACK_PATTERNS: RegExp[] = [
  /\b(?:rto|return[-\s]?to[-\s]?office|return\s+to\s+office)\s+(?:mandate|policy|requirement|push|order)?\b/i,
  /\b(?:was\s+promised|told|sold)\s+(?:wfh|remote|work[-\s]?from[-\s]?home|hybrid)\b/i,
  /\b(?:forced|mandated|required|asked)\s+(?:to\s+)?(?:come\s+(?:in|back)|return\s+to\s+(?:the\s+)?office)\b/i,
  /\b(?:hybrid|3[-\s]days?\s+(?:in[-\s]?office|wfo)|office\s+\d+\s+days?)\s+(?:is|becoming|dealbreaker)\b/i,
  /\b(?:full[-\s]?time\s+(?:wfo|in[-\s]?office)|5\s+days?\s+in\s+(?:the\s+)?office)\b/i,
];
function detectRtoPushback(t: string): boolean {
  return RTO_PUSHBACK_PATTERNS.some((p) => p.test(t));
}

/* Wave-2A — returnship from maternity. */
const RETURNSHIP_MATERNITY_PATTERNS: RegExp[] = [
  /\b(?:returning|coming\s+back|getting\s+back)\s+(?:to\s+work\s+)?(?:after|from|post)\s+(?:my\s+)?(?:maternity|parental|child\s+care|baby)\b/i,
  /\b(?:maternity|parental)\s+(?:break|gap|leave|hiatus)\s+(?:of\s+|for\s+)?(\d+\s+)?(?:months?|years?)?\b/i,
  /\b(?:returnship|return[-\s]ship|return\s+to\s+work)\s+(?:program|track|cohort)?\b/i,
  /\b(?:on\s+a\s+|took\s+a\s+|had\s+a\s+)?(?:maternity|parental)\s+(?:break|sabbatical)\b/i,
];
function detectReturnshipMaternity(t: string): boolean {
  return RETURNSHIP_MATERNITY_PATTERNS.some((p) => p.test(t));
}

/* Wave-2A — pay-band / level-range / transparency probe. */
const PAY_BAND_PATTERNS: RegExp[] = [
  /\b(?:pay\s+band|salary\s+band|comp(?:ensation)?\s+band|band\s+(?:for\s+this\s+)?(?:level|role|grade)|level\s+(?:range|band))\b/i,
  /\b(?:top|max(?:imum)?|upper|highest)\s+(?:of\s+)?(?:the\s+)?(?:band|range|tier|level)\b/i,
  /\b(?:what'?s?\s+the\s+(?:band|range|spread|max|maximum)\s+(?:for|on)\s+(?:this|the)\s+(?:role|level|grade))\b/i,
  /\b(?:internal\s+(?:band|range|equity|parity)|pay\s+equity|outlier\s+hire|out[-\s]?of[-\s]?band)\b/i,
  /\b(?:levels\.fyi|ambitionbox|glassdoor|levels)\s+(?:data|range|estimate|says)\b/i,
];
function detectPayBandAsked(t: string): boolean {
  return PAY_BAND_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — tax-optimal CTC restructuring ask. */
const TAX_STRUCTURE_PATTERNS: RegExp[] = [
  /\b(?:hra|house\s+rent\s+allowance|lta|leave\s+travel\s+allowance|fbp|flexi(?:ble)?\s+benefit\s+plan|flexible\s+benefit)\b/i,
  /\b(?:80c|80d|80ccd|nps|section\s+80|tax[-\s]?saving|tax[-\s]?optim(?:al|ization|ize|izing))\s+(?:structure|component|allocation)?\b/i,
  /\b(?:meal\s+card|sodexo|telephone\s+allowance|fuel\s+allowance|driver\s+salary)\s+(?:component|reimbursement)?\b/i,
  /\b(?:old\s+regime|new\s+regime|tax\s+regime)\b/i,
  /\b(?:structure\s+(?:my\s+|the\s+)?ctc|restructure\s+(?:ctc|comp|package)|ctc\s+(?:break(?:up|down)|component\s+split))\s+(?:for\s+)?(?:tax|hra|optim)/i,
];
function detectTaxStructureAsked(t: string): boolean {
  return TAX_STRUCTURE_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — background-verification anxiety. */
const BGV_ANXIETY_PATTERNS: RegExp[] = [
  /\b(?:background\s+(?:check|verification|investigation)|bgv|employment\s+verification|degree\s+verification)\s+(?:concern|issue|risk|worry|anxiety|process)?\b/i,
  /\b(?:don'?t|do\s+not|please\s+don'?t)\s+(?:call|contact|reach\s+out\s+to)\s+(?:my\s+)?(?:current\s+)?(?:manager|employer|company|hr)\b/i,
  /\b(?:worried|concerned|nervous)\s+about\s+(?:the\s+)?(?:bgv|background|verification)\b/i,
  /\b(?:my\s+)?(?:degree|education|college)\s+(?:might|may|could)\s+(?:not\s+verify|fail|be\s+a\s+problem)\b/i,
  /\b(?:correspondence\s+degree|degree\s+is\s+correspondence|distance\s+education|distance[-\s]learning|fake\s+experience|inflated\s+ctc|exaggerated\s+comp)\b/i,
];
function detectBgvAnxiety(t: string): boolean {
  return BGV_ANXIETY_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — ESOP sophistication. */
const ESOP_SOPHISTICATION_PATTERNS: RegExp[] = [
  /\b(?:409a|four[-\s]?o[-\s]?nine[-\s]?a|fmv|fair\s+market\s+value)\b/i,
  /\b(?:strike\s+price|exercise\s+price|exercise\s+window|post[-\s]?termination\s+exercise|pte\s+window)\b/i,
  /\b(?:single[-\s]?trigger|double[-\s]?trigger|acceleration\s+(?:on\s+(?:acquisition|change\s+of\s+control)|clause))\b/i,
  /\b(?:cliff(?:\s+period)?|vesting\s+(?:schedule|cliff|cadence)|4[-\s]?year\s+vesting|monthly\s+vest)\b/i,
  /\b(?:liquidity\s+(?:event|history|program)|esop\s+buy[-\s]?back|secondary\s+(?:sale|transaction))\b/i,
  /\b(?:phantom\s+(?:stock|shares?|equity)|sar\b|stock\s+appreciation\s+rights?)\b/i,
];
function detectEsopSophisticationProbe(t: string): boolean {
  return ESOP_SOPHISTICATION_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — spouse-job constraint. */
const SPOUSE_JOB_PATTERNS: RegExp[] = [
  /\b(?:wife|husband|spouse|partner)\s+(?:works?|is\s+(?:working|based|employed))\s+(?:in|at|out\s+of|from)\s+\w+/i,
  /\b(?:my\s+)?(?:wife'?s?|husband'?s?|spouse'?s?|partner'?s?)\s+(?:job|work|role|company|posting|office)\b/i,
  /\b(?:dual[-\s]?career|two[-\s]?career|both\s+(?:of\s+us|working)|spouse\s+(?:can'?t|cannot)\s+(?:move|relocate))\b/i,
  /\b(?:can'?t\s+relocate|cannot\s+relocate|cant\s+move)\s+(?:because|since|as)\s+(?:my\s+)?(?:wife|husband|spouse|partner)\b/i,
];
function detectSpouseJobConstraint(t: string): boolean {
  return SPOUSE_JOB_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — aging-parent care. */
const AGING_PARENT_PATTERNS: RegExp[] = [
  /\b(?:aging|elderly|old(?:er)?|senior|ill|sick|unwell)\s+parents?\b/i,
  /\b(?:taking\s+care\s+of|caring\s+for|looking\s+after|need\s+to\s+be\s+near|stay\s+near)\s+(?:my\s+)?(?:parents?|mother|father|mom|dad|in[-\s]?laws?)\b/i,
  /\b(?:parents?\s+(?:are\s+)?(?:in|live\s+in|staying\s+in|based\s+in)|parents?\s+(?:health|medical|illness))\b.{0,80}\b(?:can'?t|cannot|need|stay|relocate|move|wfh|remote)/i,
  /\b(?:medical\s+emergency\s+at\s+home|family\s+health\s+(?:situation|emergency)|parent'?s?\s+surgery)\b/i,
];
function detectAgingParentCare(t: string): boolean {
  return AGING_PARENT_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — moonlighting disclosure. */
const MOONLIGHTING_PATTERNS: RegExp[] = [
  /\b(?:moonlight(?:ing)?|dual\s+employment|second\s+job|side\s+job|side\s+income)\b/i,
  /\b(?:youtube\s+channel|content\s+creation|teaching\s+(?:on\s+the\s+side|online)|freelance\s+(?:on\s+side|side\s+work)|consulting\s+(?:on\s+side|on\s+the\s+side))\b/i,
  /\b(?:can\s+i\s+(?:keep|continue)|allowed\s+to\s+(?:keep|continue|work\s+on))\s+(?:my\s+)?(?:side[-\s]?(?:project|hustle|gig|business)|other\s+(?:work|job))\b/i,
  /\b(?:do\s+you\s+allow|policy\s+on)\s+(?:moonlight(?:ing)?|side[-\s]?(?:gigs?|hustle|work)|dual\s+employment)\b/i,
];
function detectMoonlightingDisclosed(t: string): boolean {
  return MOONLIGHTING_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — mental-health / burnout disclosure. */
const MENTAL_HEALTH_PATTERNS: RegExp[] = [
  /\b(?:mental\s+health|burnout|burn[-\s]?out|anxiety|depression|panic\s+(?:attacks?|disorder))\b/i,
  /\b(?:therapy|therapist|counsell?or|counsell?ing|psychiatrist|psychologist)\s+(?:sessions?|reimbursement|cover|benefit)?\b/i,
  /\b(?:eap|employee\s+assistance\s+program|mental\s+wellness|wellness\s+leave|mental\s+health\s+day)\b/i,
  /\b(?:taking\s+(?:a\s+)?(?:break|time\s+off|leave)\s+for\s+mental\s+health|on\s+leave\s+for\s+(?:burnout|mental\s+health))\b/i,
];
function detectMentalHealthDisclosed(t: string): boolean {
  return MENTAL_HEALTH_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — pay-parity / DEI ask. */
const PAY_PARITY_PATTERNS: RegExp[] = [
  /\b(?:pay\s+(?:parity|equity|gap|audit|transparency)|gender\s+pay\s+(?:gap|parity)|equal\s+pay)\b/i,
  /\b(?:diversity\s+(?:and\s+inclusion|equity)|dei\s+(?:policy|report|metrics?)|women\s+at\s+(?:the\s+)?(?:co|company|leadership))\b/i,
  /\b(?:how\s+do\s+(?:my\s+)?(?:peers?|comparable\s+(?:men|women|hires?)|same[-\s]?level)\s+(?:get\s+paid|earn|compare))\b/i,
  /\b(?:gender\s+(?:ratio|representation|breakdown)|female\s+leadership|women\s+in\s+(?:tech|engineering|leadership))\b/i,
];
function detectPayParityAsked(t: string): boolean {
  return PAY_PARITY_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — preemptive counter received. */
const PREEMPTIVE_COUNTER_PATTERNS: RegExp[] = [
  /\b(?:my\s+(?:current\s+)?(?:company|employer|manager|boss|hr))\s+(?:just\s+|already\s+|recently\s+)?(?:gave|offered|made|put|matched)\s+(?:me\s+)?(?:a\s+)?(?:counter|counter[-\s]?offer|raise|hike|promotion|match)/i,
  /\b(?:counter[-\s]?offered\s+by|got\s+a\s+counter|been\s+counter[-\s]?offered)\s+(?:already|before\s+(?:resigning|leaving)|preemptively)\b/i,
  /\b(?:got\s+(?:a\s+)?promotion|got\s+(?:a\s+)?raise|salary\s+(?:was|got)\s+(?:bumped|increased|hiked))\s+(?:just|recently|last\s+(?:week|month)|to\s+keep\s+me)\b/i,
  /\b(?:they|current\s+(?:co|employer))\s+(?:are\s+)?(?:trying|attempting)\s+to\s+(?:retain|keep|hold\s+on\s+to)\s+me\b/i,
];
function detectPreemptiveCounterReceived(t: string): boolean {
  return PREEMPTIVE_COUNTER_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — acceptance-time / decision-window request. */
const ACCEPTANCE_TIME_PATTERNS: RegExp[] = [
  /\b(?:can\s+i\s+(?:have|get|take)|need|i'?d\s+like|give\s+me)\s+(?:about\s+|around\s+|roughly\s+)?(?:a\s+(?:few|couple)\s+(?:of\s+)?|a\s+|\d+\s+)?(?:days?|weeks?)\s+to\s+(?:decide|think|respond|consider|review)\b/i,
  /\b(?:offer\s+validity|offer\s+expir(?:y|ation)|decision\s+(?:window|timeline|deadline))\s+(?:of|is|to\s+be)\b/i,
  /\b(?:more\s+time\s+to\s+decide|some\s+time\s+to\s+(?:think|review|consider)|grace\s+period)\b/i,
  /\b(?:before\s+i\s+(?:can\s+)?(?:commit|accept|sign|respond)|need\s+(?:to|some)\s+time)\b/i,
];
function detectAcceptanceTimeRequest(t: string): boolean {
  return ACCEPTANCE_TIME_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — crypto / token comp. */
const CRYPTO_TOKEN_PATTERNS: RegExp[] = [
  /\b(?:crypto|bitcoin|btc|ethereum|eth|usdt|usdc|stablecoin|web3\s+token)\s+(?:comp(?:ensation)?|salary|pay(?:roll|out)?|portion|allocation|component)\b/i,
  /\b(?:token\s+(?:allocation|grant|vesting|comp)|token[-\s]?based\s+(?:comp|compensation|pay))\b/i,
  /\b(?:paid\s+in\s+(?:crypto|btc|eth|usdt|usdc|stable(?:coin)?s?|tokens?)|partial\s+(?:crypto|token)\s+payment)\b/i,
  /\b(?:vda|virtual\s+digital\s+asset|web3\s+native\s+co(?:mpany|mp)?)\b/i,
];
function detectCryptoTokenComp(t: string): boolean {
  return CRYPTO_TOKEN_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — GCC / captive India-arbitrage anchor. */
const GCC_PATTERNS: RegExp[] = [
  /\b(?:gcc|global\s+capability\s+cent(?:re|er)|captive\s+(?:center|centre|unit)|india\s+(?:gcc|captive))\b/i,
  /\b(?:parent\s+(?:co|company))\s+(?:is\s+)?(?:in|out\s+of|based\s+in|headquartered\s+in)\s+(?:the\s+)?(?:us|usa|uk|europe|germany|japan)\b.{0,120}\b(?:salary|comp|tc|package|parity|arbitrage|pay)\b/i,
  /\b(?:india\s+(?:cost\s+)?arbitrage|cost[-\s]?center\s+model|offshore[-\s]?onsite\s+pay\s+gap)\b/i,
  /\b(?:headquarters?\s+in\s+(?:us|usa|uk|europe))\b.{0,80}\b(?:india\s+(?:office|office\s+pays?|comp|salaries?))\b/i,
];
function detectGccArbitrageAnchor(t: string): boolean {
  return GCC_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — bench-time disclosure (services). */
const BENCH_TIME_PATTERNS: RegExp[] = [
  /\b(?:on\s+(?:the\s+)?bench|bench\s+(?:time|period|duration|for\s+\d+))\b/i,
  /\b(?:unallocated|between\s+projects|not\s+(?:yet\s+)?allocated)\s+(?:for\s+|to\s+a\s+)?(?:\d+\s+)?(?:months?|weeks?)?\b/i,
  /\b(?:bench\s+strength|reserves?\s+pool|talent\s+pool)\b/i,
];
function detectBenchTimeDisclosed(t: string): boolean {
  return BENCH_TIME_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — founder / second-innings. */
const FOUNDER_SECOND_INNINGS_PATTERNS: RegExp[] = [
  /\b(?:was|been|i'?m\s+(?:a\s+)?)\s+(?:a\s+)?(?:founder|co[-\s]?founder|ceo|chief\s+executive)\b/i,
  /\b(?:my\s+)?(?:start[-\s]?up|venture|company)\s+(?:didn'?t\s+work\s+out|shut\s+down|failed|wound\s+down|sold|exited)\b/i,
  /\b(?:i\s+took\s+|drew\s+)(?:no\s+salary|zero\s+salary|a\s+stipend|equity[-\s]?only|founder'?s?\s+salary)\b/i,
  /\b(?:second\s+innings|returning\s+to\s+(?:full[-\s]?time|fte|corporate)|leaving\s+the\s+founder\s+life)\b/i,
];
function detectFounderSecondInnings(t: string): boolean {
  return FOUNDER_SECOND_INNINGS_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — late-career age-bias concern. */
const LATECAREER_AGE_BIAS_PATTERNS: RegExp[] = [
  /\b(?:am\s+i\s+too\s+(?:old|senior)|too\s+senior\s+for\s+(?:this|the\s+role|the\s+team)|age\s+(?:bias|discrimination|concern))\b/i,
  /\b(?:fit\s+(?:in\s+)?with\s+(?:a\s+)?young(?:er)?\s+team|culture\s+fit\s+(?:with|in)\s+a\s+young(?:er)?\s+(?:team|culture))\b/i,
  /\b(?:i'?m\s+\d{2,3}\s+(?:years\s+old)?|over\s+\d{2,3}|(?:45|50|55|60)\+)\b.{0,80}\b(?:concern|worry|bias|too\s+old|too\s+senior)/i,
  /\b(?:experience\s+being\s+a\s+(?:liability|negative)|over[-\s]qualified\s+(?:age|tenure)|seniority\s+working\s+against)\b/i,
];
function detectLatecareerAgeBias(t: string): boolean {
  return LATECAREER_AGE_BIAS_PATTERNS.some((p) => p.test(t));
}

export function detectCollegeTier(text: string): CollegeTier | null {
  if (!text) return null;
  /* tier-1 wins on tie — a candidate from "IIT-B and a tier-3 backup"
   * is read as tier-1 because their best signal dominates anchoring. */
  if (COLLEGE_TIER_1_PATTERNS.some((p) => p.test(text))) return "tier-1";
  if (COLLEGE_TIER_2_PATTERNS.some((p) => p.test(text))) return "tier-2";
  if (COLLEGE_TIER_3_PATTERNS.some((p) => p.test(text))) return "tier-3";
  return null;
}

/* ─── Bug-report 11 (2026-05-14) — Fresh-grad disclosure ─────────────
 *
 * A candidate may disclose mid-session that they are actually a pre-
 * graduate / fresh graduate / still in college / have zero applicable
 * experience. The previous parser had no signal for this: applicableYoe
 * was frozen at init from the resume, so a "Senior Product Designer"
 * resume applying for Business Analyst kept the senior bucket forever
 * even when the candidate said "I'm graduating, pre-graduate."
 *
 * Returns true when ANY of the following are stated:
 *   - "pre-graduate", "pre graduation", "yet to graduate"
 *   - "fresh graduate", "fresher", "freshly graduated"
 *   - "still in college", "still studying", "final year"
 *   - "haven't graduated", "haven't completed"
 *   - explicit "0 years of experience" / "no experience" in context
 *   - "graduating this year / next month / soon" (active student)
 * Pure. */
const FRESH_GRAD_PATTERNS: RegExp[] = [
  /\b(pre[-\s]?grad(?:uate|uation)?|yet\s+to\s+graduate)\b/i,
  /\b(fresh(?:\s+|-)?grad(?:uate)?|fresher|fresh(?:ly|er|ers)?\s+(?:graduated|out\s+of\s+(?:college|university)))\b/i,
  /\b(still\s+(?:in\s+college|in\s+university|studying|a\s+student)|final[-\s]?year(?:\s+student)?|last[-\s]?year\s+(?:student|college))\b/i,
  /\b(haven'?t\s+(?:graduated|completed\s+(?:my\s+)?(?:degree|college))|not\s+(?:yet\s+)?graduated)\b/i,
  /\b(graduating\s+(?:this\s+year|next\s+(?:month|year)|soon|in\s+\w+))\b/i,
  /\b(0|zero)\s+(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp|yoe)\b/i,
  /\b(no\s+(?:prior\s+|professional\s+|real\s+|actual\s+)?(?:work\s+)?experience)\b/i,
  /\bi'?m\s+(?:graduating|a\s+fresher|a\s+fresh\s+grad)\b/i,
];

export function detectFreshGradDisclosure(text: string): boolean {
  if (!text) return false;
  return FRESH_GRAD_PATTERNS.some((p) => p.test(text));
}

export function extractCandidateProfile(text: string): CandidateProfileResult {
  if (!text) return EMPTY;

  const careerGapMonths = extractGapMonths(text);
  /* Activity only counted when there's a gap context OR the activity
   * phrase carries its own gap connotation (e.g. "during my break I
   * was upskilling"). To avoid false positives on "I'm currently
   * upskilling on the side", require a gap signal nearby. */
  let careerGapActivity: CareerGapActivity | null = null;
  const gapContext =
    careerGapMonths != null ||
    /\b(?:during\s+(?:my\s+|the\s+)?(?:break|gap|hiatus|sabbatical|time\s+off)|in\s+the\s+(?:gap|break)|while\s+(?:i\s+was\s+)?(?:off|on\s+break))\b/i.test(text);
  if (gapContext) {
    for (const { kind, pattern } of GAP_ACTIVITY_PATTERNS) {
      if (pattern.test(text)) {
        careerGapActivity = kind;
        break;
      }
    }
  }

  const tenureSignal = extractTenureSignal(text);
  const levelMismatch = extractLevelMismatch(text);
  const { domainPivot, transferableSkillsClaimed } = detectDomainPivot(text);
  const compensationHistoryIssue = detectCompensationHistoryIssue(text);
  const serviceBondAccepted = detectServiceBond(text);
  const probationCompMentioned = detectProbationComp(text);
  const internshipConversion = detectInternshipConversion(text);
  const collegeTier = detectCollegeTier(text);
  /* Junior-flow (2026-05-14e) — four 0-2 YoE signals. */
  const earlySwitcher = detectEarlySwitcher(text);
  const lowCtcAlert = detectLowCtcAlert(text);
  const priorInternshipNonConversion = detectPriorInternshipNonConversion(text, internshipConversion);
  const serviceCompanyBackground = detectServiceCompanyBackground(text);
  /* Mid-level flow (2026-05-14f) — comp-literacy signal. */
  const compBreakupUnknown = detectCompBreakupUnknown(text);
  /* Real-world Indian extensions (2026-05-14g). */
  const recentLayoff = detectRecentLayoff(text);
  const hotDomainPremium = detectHotDomainPremium(text);
  const pipDisclosed = detectPipDisclosed(text);
  const verbalOnlyOffer = detectVerbalOnlyOffer(text);
  const culturalJoiningConstraint = detectCulturalJoiningConstraint(text);
  /* Senior + process + long-tail (2026-05-14h). */
  const peopleManagementClaimed = detectPeopleManagementClaimed(text);
  const crossBorderAnchor = detectCrossBorderAnchor(text);
  const unvestedEquityLossClaim = detectUnvestedEquityLossClaim(text);
  const explodingOfferPressure = detectExplodingOfferPressure(text);
  const postAcceptanceRenege = detectPostAcceptanceRenege(text);
  const quotaAttainmentClaimed = detectQuotaAttainmentClaimed(text);
  const gardenLeaveDisclosed = detectGardenLeaveDisclosed(text);
  const nonCompeteFlagged = detectNonCompeteFlagged(text);
  const relocationBonusAsked = detectRelocationBonusAsked(text);
  /* Wave-2 (2026-05-14i) — 20 deeper signals. */
  const parentInsuranceAsked = detectParentInsuranceAsked(text);
  const inHandTakehomeFocus = detectInHandTakehomeFocus(text);
  const rtoPushback = detectRtoPushback(text);
  const returnshipMaternity = detectReturnshipMaternity(text);
  const payBandAsked = detectPayBandAsked(text);
  const taxStructureAsked = detectTaxStructureAsked(text);
  const bgvAnxiety = detectBgvAnxiety(text);
  const esopSophisticationProbe = detectEsopSophisticationProbe(text);
  const spouseJobConstraint = detectSpouseJobConstraint(text);
  const agingParentCare = detectAgingParentCare(text);
  const moonlightingDisclosed = detectMoonlightingDisclosed(text);
  const mentalHealthDisclosed = detectMentalHealthDisclosed(text);
  const payParityAsked = detectPayParityAsked(text);
  const preemptiveCounterReceived = detectPreemptiveCounterReceived(text);
  const acceptanceTimeRequest = detectAcceptanceTimeRequest(text);
  const cryptoTokenComp = detectCryptoTokenComp(text);
  const gccArbitrageAnchor = detectGccArbitrageAnchor(text);
  const benchTimeDisclosed = detectBenchTimeDisclosed(text);
  const founderSecondInnings = detectFounderSecondInnings(text);
  const latecareerAgeBias = detectLatecareerAgeBias(text);

  const hasAny =
    careerGapMonths != null ||
    careerGapActivity != null ||
    tenureSignal != null ||
    levelMismatch != null ||
    domainPivot ||
    transferableSkillsClaimed ||
    compensationHistoryIssue != null ||
    serviceBondAccepted ||
    probationCompMentioned ||
    internshipConversion ||
    collegeTier != null ||
    earlySwitcher ||
    lowCtcAlert ||
    priorInternshipNonConversion ||
    serviceCompanyBackground ||
    compBreakupUnknown ||
    recentLayoff ||
    hotDomainPremium ||
    pipDisclosed ||
    verbalOnlyOffer ||
    culturalJoiningConstraint ||
    peopleManagementClaimed ||
    crossBorderAnchor ||
    unvestedEquityLossClaim ||
    explodingOfferPressure ||
    postAcceptanceRenege ||
    quotaAttainmentClaimed ||
    gardenLeaveDisclosed ||
    nonCompeteFlagged ||
    relocationBonusAsked ||
    parentInsuranceAsked ||
    inHandTakehomeFocus ||
    rtoPushback ||
    returnshipMaternity ||
    payBandAsked ||
    taxStructureAsked ||
    bgvAnxiety ||
    esopSophisticationProbe ||
    spouseJobConstraint ||
    agingParentCare ||
    moonlightingDisclosed ||
    mentalHealthDisclosed ||
    payParityAsked ||
    preemptiveCounterReceived ||
    acceptanceTimeRequest ||
    cryptoTokenComp ||
    gccArbitrageAnchor ||
    benchTimeDisclosed ||
    founderSecondInnings ||
    latecareerAgeBias;
  return {
    careerGapMonths,
    careerGapActivity,
    tenureSignal,
    levelMismatch,
    domainPivot,
    transferableSkillsClaimed,
    compensationHistoryIssue,
    serviceBondAccepted,
    probationCompMentioned,
    internshipConversion,
    collegeTier,
    earlySwitcher,
    lowCtcAlert,
    priorInternshipNonConversion,
    serviceCompanyBackground,
    compBreakupUnknown,
    recentLayoff,
    hotDomainPremium,
    pipDisclosed,
    verbalOnlyOffer,
    culturalJoiningConstraint,
    peopleManagementClaimed,
    crossBorderAnchor,
    unvestedEquityLossClaim,
    explodingOfferPressure,
    postAcceptanceRenege,
    quotaAttainmentClaimed,
    gardenLeaveDisclosed,
    nonCompeteFlagged,
    relocationBonusAsked,
    parentInsuranceAsked,
    inHandTakehomeFocus,
    rtoPushback,
    returnshipMaternity,
    payBandAsked,
    taxStructureAsked,
    bgvAnxiety,
    esopSophisticationProbe,
    spouseJobConstraint,
    agingParentCare,
    moonlightingDisclosed,
    mentalHealthDisclosed,
    payParityAsked,
    preemptiveCounterReceived,
    acceptanceTimeRequest,
    cryptoTokenComp,
    gccArbitrageAnchor,
    benchTimeDisclosed,
    founderSecondInnings,
    latecareerAgeBias,
    hasAny,
  };
}

/* ─── Phase 29 (2026-05-14) — Role-applicable YOE ────────────────────
 *
 * A Senior Product Designer with 6 years of experience applying for a
 * Java Developer role has totalYoe=6 but applicableYoe≈0 — the
 * negotiation kernel must NOT pay senior rates for unrelated tenure.
 *
 * Two inputs:
 *   - resumeProfile.primaryDomain (e.g. "Product Design", "Java
 *     Backend", "Data Science") — emitted by analyze-resume.
 *   - targetRole (e.g. "java developer") — known at session start.
 *
 * Three outcomes:
 *   - match    → applicableYoe = totalYoe
 *   - adjacent → applicableYoe = totalYoe * 0.5
 *   - pivot    → applicableYoe = 0
 *
 * Conservative: when primaryDomain is missing/empty we fall back to
 * domainPivot / transferableSkillsClaimed utterance signals (if a pivot
 * is asserted in dialogue, applicableYoe collapses to 0).
 *
 * Pure: no clock, no IO. */

interface ApplicableYoeInputs {
  totalYoe: number | null;
  primaryDomain: string | null;
  targetRole: string;
  /** Optional fallbacks from utterance-derived candidateProfile. */
  domainPivot?: boolean;
}

interface DomainCanon {
  /** Canonical domain key surfaced from a free-form string. */
  key: string;
  /** Adjacent domains by canonical key. */
  adjacent: string[];
}

/* Lowercase-keyword → canonical domain. Order matters: more-specific
 * phrases first so "product designer" beats "designer". */
/* Exported for the domain-graph invariant test
 * (src/__tests__/domainGraphInvariants.test.ts). Not part of the
 * runtime public API — leading double underscore signals "internal,
 * audit-only". */
export const __DOMAIN_KEYWORDS_INTERNAL: Array<[RegExp, string]> = [
  [/\b(product\s+design(er)?|ux\s+design(er)?|ui\/?ux|interaction\s+design)\b/i, "product-design"],
  [/\b(visual\s+design|graphic\s+design|brand\s+design)\b/i, "visual-design"],
  [/\b(java\s+(backend|developer|engineer)|spring\s+boot|java\s+ee|j2ee)\b/i, "java-backend"],
  [/\b(python\s+backend|django|flask|fastapi)\b/i, "python-backend"],
  [/\b(node\.?js|nodejs\s+backend|express\s+backend)\b/i, "node-backend"],
  [/\b(\.net|c#|dotnet)\s+(backend|developer|engineer)?\b/i, "dotnet-backend"],
  [/\b(go(lang)?\s+(backend|developer|engineer))\b/i, "go-backend"],
  [/\b(backend\s+(engineer|developer|engineering)|server[-\s]side)\b/i, "backend"],
  [/\b(frontend\s+(engineer|developer|engineering)|react|angular|vue|web\s+frontend)\b/i, "frontend"],
  [/\b(full[-\s]?stack)\b/i, "fullstack"],
  [/\b(mobile|android|ios|react\s+native|flutter)\s*(engineer|developer)?\b/i, "mobile"],
  [/\b(data\s+(science|scientist)|machine\s+learning|ml\s+engineer|ai\s+engineer)\b/i, "data-science"],
  [/\b(data\s+(engineer|engineering)|etl|pipeline|warehouse)\b/i, "data-engineering"],
  [/\b(data\s+analyst|business\s+analyst|analytics)\b/i, "data-analyst"],
  [/\b(devops|sre|site\s+reliability|platform\s+engineer|infrastructure)\b/i, "devops"],
  [/\b(security\s+engineer|appsec|infosec|cybersecurity)\b/i, "security"],
  [/\b(product\s+manager|product\s+management|pm\b)\b/i, "product-management"],
  [/\b(program\s+manager|tpm|technical\s+program)\b/i, "program-management"],
  [/\b(product\s+marketing|pmm)\b/i, "product-marketing"],
  [/\b(social\s+media\s+(manager|lead|specialist|executive|coordinator|strategist)?|community\s+manager|influencer\s+(marketing|manager))\b/i, "social-media"],
  [/\b(marketing\s+(manager|lead)?|growth\s+marketing|digital\s+marketing)\b/i, "marketing"],
  [/\b(sales\s+(engineer|executive|manager)?|account\s+executive|sdr|bdr)\b/i, "sales"],
  [/\b(customer\s+success|cs\s+manager|implementation)\b/i, "customer-success"],
  [/\b(qa\s+(engineer)?|test\s+(engineer|automation)|sdet)\b/i, "qa"],
  [/\b(content\s+(writer|strategist)|technical\s+writer|copywriter)\b/i, "content"],
  [/\b(hr\b|human\s+resources|people\s+(ops|operations)|recruiter|talent\s+acquisition|hr\s+manager|hrbp)\b/i, "hr-people"],
  [/\b(finance\s+(manager|analyst)?|financial\s+analyst|accountant|controller|fp&a|treasur(er|y))\b/i, "finance"],
  /* Bug-report 13 (2026-05-14) — Operations / management / business
   * domain mappings. Pre-13 the table only had a single "operations"
   * keyword which matched too narrowly, and no entries for management /
   * business analyst / customer-success-manager etc., so a Senior
   * Product Designer applying for Operations Manager was getting an
   * "unknown" classification on the target side → applicableYoe
   * defaulted to totalYoe → senior band → catastrophic ₹25L opener. */
  [/\b(operations\s+(manager|lead|head|director)?|ops\s+(manager|lead|head)?|coo\b|chief\s+operating\s+officer|supply\s+chain\s+(manager|lead)?|logistics\s+(manager|lead)?|warehouse\s+(manager|lead)?|fulfilment|fulfillment)\b/i, "operations"],
  [/\b(project\s+manager|program\s+manager|engineering\s+manager|general\s+manager|delivery\s+manager|gm\b|pmo\b)\b/i, "management"],
  [/\b(business\s+(analyst|operations|ops)|biz\s*ops|bizops)\b/i, "business"],
  [/\b(account\s+manager|customer\s+success\s+(manager|lead)?|customer\s+experience\s+(lead|manager)?|cx\s+(lead|manager))\b/i, "customer-success"],
  [/\b(brand\s+(manager|lead)|growth\s+(manager|lead)|marketing\s+(manager|lead|director)?)\b/i, "marketing"],
  [/\b(consultant|consulting|advisory)\b/i, "consulting"],
  [/\b(teach(ing|er)?|educator|instructor|professor)\b/i, "education"],
];

/* Adjacency graph — keyed by canonical domain. Edges are bidirectional
 * conceptually but stored from-each-side for O(1) lookup. */
/* Session A (2026-05-14) audit — graph normalised to be bidirectional
 * and every key referenced by DOMAIN_KEYWORDS / by an edge value MUST
 * be a key in this record (no orphan nodes). The runtime classifier
 * uses `cand.adj.includes(b) || b.adj.includes(a)` so prior asymmetries
 * were behaviour-equivalent, but the audit invariant test now enforces
 * proper bidirectionality so the graph can be reasoned about. The
 * operations / hr-people / finance / qa / education buckets remain
 * intentionally pivot-only (no outgoing adjacency) — this is the
 * design intent from bug-report 13. */
export const __ADJACENT_INTERNAL: Record<string, string[]> = {
  "product-design": ["visual-design", "frontend", "product-management"],
  "visual-design": ["product-design"],
  "frontend": ["fullstack", "mobile", "product-design"],
  "fullstack": ["frontend", "backend", "java-backend", "node-backend"],
  "backend": ["fullstack", "java-backend", "python-backend", "node-backend", "dotnet-backend", "go-backend", "devops", "data-engineering", "security", "management"],
  "java-backend": ["backend", "fullstack"],
  "python-backend": ["backend", "data-engineering"],
  "node-backend": ["backend", "fullstack"],
  "dotnet-backend": ["backend"],
  "go-backend": ["backend", "devops"],
  "mobile": ["frontend"],
  "data-science": ["data-engineering", "data-analyst"],
  "data-engineering": ["data-science", "backend", "python-backend"],
  "data-analyst": ["data-science", "product-management", "business"],
  "devops": ["backend", "security", "go-backend"],
  "security": ["devops", "backend"],
  "product-management": ["product-marketing", "program-management", "data-analyst", "customer-success", "management", "product-design"],
  "program-management": ["product-management", "management"],
  "product-marketing": ["product-management", "marketing"],
  "marketing": ["product-marketing", "content", "sales", "social-media"],
  /* Bug-report 14 (2026-05-14) — social-media as its own bucket.
   * Adjacent to marketing + content (skill transfer is real: copy,
   * brand, audience). Not adjacent to product-design — a Senior
   * Product Designer → Social Media Manager is a true craft pivot. */
  "social-media": ["marketing", "content"],
  "sales": ["customer-success", "marketing"],
  "customer-success": ["sales", "product-management"],
  /* Bug-report 13 — management cluster is internally adjacent (e.g.
   * Engineering Manager → Program Manager). Operations / business /
   * hr-people / finance are intentionally NOT adjacent to anything else
   * outside their own bucket: cross-bucket transitions (Product Design
   * → Operations Manager, Engineering → Operations) must classify as
   * pivot to keep applicableYoe=0 and prevent over-anchoring. */
  "management": ["product-management", "program-management", "backend"],
  "business": ["data-analyst", "consulting"],
  "consulting": ["business"],
  "content": ["marketing", "social-media"],
  /* Pivot-only buckets — empty adjacency by design. */
  "operations": [],
  "hr-people": [],
  "finance": [],
  "qa": [],
  "education": [],
};

function canonDomain(s: string | null | undefined): DomainCanon | null {
  if (!s) return null;
  for (const [pat, key] of __DOMAIN_KEYWORDS_INTERNAL) {
    if (pat.test(s)) return { key, adjacent: __ADJACENT_INTERNAL[key] ?? [] };
  }
  return null;
}

export type ApplicableYoeRelation = "match" | "adjacent" | "pivot" | "unknown";

export interface ApplicableYoeResult {
  applicableYoe: number | null;
  relation: ApplicableYoeRelation;
  /** The canonical key inferred for the candidate's primary domain. */
  candidateDomainKey: string | null;
  /** The canonical key inferred for the target role's domain. */
  targetDomainKey: string | null;
}

/** Map (primaryDomain, targetRole, totalYoe) → applicableYoe.
 *  Pure. */
export function computeApplicableYoe(input: ApplicableYoeInputs): ApplicableYoeResult {
  const { totalYoe, primaryDomain, targetRole } = input;
  const cand = canonDomain(primaryDomain);
  const tgt = canonDomain(targetRole);

  /* Conservative defaults when we can't classify both sides. */
  if (totalYoe == null) {
    return { applicableYoe: null, relation: "unknown", candidateDomainKey: cand?.key ?? null, targetDomainKey: tgt?.key ?? null };
  }
  if (!cand || !tgt) {
    /* Bug-report 14 (2026-05-14) — when either side fails to classify
     * we previously defaulted to `relation: "unknown"` with applicableYoe
     * = totalYoe (full credit). That is the wrong direction for a
     * salary kernel: granting full credit to an unrecognised target role
     * lets a senior candidate's YoE anchor a senior-tier band for a
     * role the system has no model of. Bug-13 (Senior Product Designer
     * → Operations Manager → ₹25L opener) and Bug-14 (Senior Product
     * Designer → Social Media Manager → ₹32L opener) are the same
     * bug class, both rooted here. Band-aiding by adding more domain
     * keywords fixes the symptom for that role and leaves the next
     * unknown role exposed.
     *
     * Correct contract: when we cannot model the relationship, treat
     * it as a pivot. applicableYoe collapses to 0, the band-resolver
     * picks the entry tier, and the recruiter offers conservatively.
     * If the candidate IS in fact senior in the unknown role, they
     * will negotiate up from a low opener — the failure mode is mild
     * (under-offer + counter) rather than catastrophic (6–8× market
     * offer that destroys the simulation's pedagogical value).
     *
     * `relation: "unknown"` is still emitted when totalYoe is null
     * (the truly unknowable case, handled above), so callers that
     * branch on "unknown" for telemetry continue to work. */
    return { applicableYoe: 0, relation: "pivot", candidateDomainKey: cand?.key ?? null, targetDomainKey: tgt?.key ?? null };
  }
  if (cand.key === tgt.key) {
    return { applicableYoe: totalYoe, relation: "match", candidateDomainKey: cand.key, targetDomainKey: tgt.key };
  }
  if (cand.adjacent.includes(tgt.key) || tgt.adjacent.includes(cand.key)) {
    return { applicableYoe: Math.round(totalYoe * 0.5 * 10) / 10, relation: "adjacent", candidateDomainKey: cand.key, targetDomainKey: tgt.key };
  }
  return { applicableYoe: 0, relation: "pivot", candidateDomainKey: cand.key, targetDomainKey: tgt.key };
}

/** Convert applicableYoe → experienceLevel keyword consumed by the
 *  salary-lookup band resolver. Buckets: 0–1 entry, 2–4 mid, 5–8 senior,
 *  9+ staff. Null when no signal. Pure. */
export function experienceLevelFromYoe(yoe: number | null | undefined): "entry" | "mid" | "senior" | "staff" | null {
  if (yoe == null || !Number.isFinite(yoe)) return null;
  if (yoe <= 1) return "entry";
  if (yoe <= 4) return "mid";
  if (yoe <= 8) return "senior";
  return "staff";
}

export function mergeCandidateProfile(
  prior: CandidateProfileResult | null | undefined,
  next: CandidateProfileResult,
): CandidateProfileResult {
  const p = prior ?? EMPTY;
  const merged: CandidateProfileResult = {
    careerGapMonths: next.careerGapMonths ?? p.careerGapMonths,
    careerGapActivity: next.careerGapActivity ?? p.careerGapActivity,
    tenureSignal: next.tenureSignal ?? p.tenureSignal,
    levelMismatch: next.levelMismatch ?? p.levelMismatch,
    /* domainPivot + transferableSkillsClaimed are monotone-up — once
     * the candidate disclosed a pivot the recruiter would remember. */
    domainPivot: p.domainPivot || next.domainPivot,
    transferableSkillsClaimed:
      p.transferableSkillsClaimed || next.transferableSkillsClaimed,
    /* compensationHistoryIssue prefers the more severe of the two
     * (unpaid > delayed). Last-stated escalation wins. */
    compensationHistoryIssue:
      next.compensationHistoryIssue === "unpaid"
        ? "unpaid"
        : p.compensationHistoryIssue === "unpaid"
          ? "unpaid"
          : (next.compensationHistoryIssue ?? p.compensationHistoryIssue),
    /* Phase 26 — both fields are monotone-up: once the candidate has
     * disclosed a bond or raised the probation-comp question, the
     * recruiter would remember through the rest of the session. */
    serviceBondAccepted: p.serviceBondAccepted || next.serviceBondAccepted,
    probationCompMentioned: p.probationCompMentioned || next.probationCompMentioned,
    /* internshipConversion is monotone-up — once the candidate disclosed
     * "I was your intern" or "convert my PPO", the recruiter remembers. */
    internshipConversion: p.internshipConversion || next.internshipConversion,
    /* collegeTier — last-stated wins (recruiter would update mental
     * model on disclosure), but never demoted from null. */
    collegeTier: next.collegeTier ?? p.collegeTier,
    /* Junior-flow (2026-05-14e) — all four are monotone-up. Once the
     * candidate disclosed an early switch / low CTC / prior internship
     * / service background, the recruiter would remember through the
     * rest of the session. */
    earlySwitcher: p.earlySwitcher || next.earlySwitcher,
    lowCtcAlert: p.lowCtcAlert || next.lowCtcAlert,
    priorInternshipNonConversion: p.priorInternshipNonConversion || next.priorInternshipNonConversion,
    serviceCompanyBackground: p.serviceCompanyBackground || next.serviceCompanyBackground,
    compBreakupUnknown: p.compBreakupUnknown || next.compBreakupUnknown,
    /* Real-world Indian extensions (2026-05-14g) — all monotone-up.
     * Once disclosed, the recruiter would remember through the session. */
    recentLayoff: p.recentLayoff || next.recentLayoff,
    hotDomainPremium: p.hotDomainPremium || next.hotDomainPremium,
    pipDisclosed: p.pipDisclosed || next.pipDisclosed,
    verbalOnlyOffer: p.verbalOnlyOffer || next.verbalOnlyOffer,
    culturalJoiningConstraint: p.culturalJoiningConstraint || next.culturalJoiningConstraint,
    /* Senior + process + long-tail (2026-05-14h) — all monotone-up. */
    peopleManagementClaimed: p.peopleManagementClaimed || next.peopleManagementClaimed,
    crossBorderAnchor: p.crossBorderAnchor || next.crossBorderAnchor,
    unvestedEquityLossClaim: p.unvestedEquityLossClaim || next.unvestedEquityLossClaim,
    explodingOfferPressure: p.explodingOfferPressure || next.explodingOfferPressure,
    postAcceptanceRenege: p.postAcceptanceRenege || next.postAcceptanceRenege,
    quotaAttainmentClaimed: p.quotaAttainmentClaimed || next.quotaAttainmentClaimed,
    gardenLeaveDisclosed: p.gardenLeaveDisclosed || next.gardenLeaveDisclosed,
    nonCompeteFlagged: p.nonCompeteFlagged || next.nonCompeteFlagged,
    relocationBonusAsked: p.relocationBonusAsked || next.relocationBonusAsked,
    /* Wave-2 (2026-05-14i) — all monotone-up. */
    parentInsuranceAsked: p.parentInsuranceAsked || next.parentInsuranceAsked,
    inHandTakehomeFocus: p.inHandTakehomeFocus || next.inHandTakehomeFocus,
    rtoPushback: p.rtoPushback || next.rtoPushback,
    returnshipMaternity: p.returnshipMaternity || next.returnshipMaternity,
    payBandAsked: p.payBandAsked || next.payBandAsked,
    taxStructureAsked: p.taxStructureAsked || next.taxStructureAsked,
    bgvAnxiety: p.bgvAnxiety || next.bgvAnxiety,
    esopSophisticationProbe: p.esopSophisticationProbe || next.esopSophisticationProbe,
    spouseJobConstraint: p.spouseJobConstraint || next.spouseJobConstraint,
    agingParentCare: p.agingParentCare || next.agingParentCare,
    moonlightingDisclosed: p.moonlightingDisclosed || next.moonlightingDisclosed,
    mentalHealthDisclosed: p.mentalHealthDisclosed || next.mentalHealthDisclosed,
    payParityAsked: p.payParityAsked || next.payParityAsked,
    preemptiveCounterReceived: p.preemptiveCounterReceived || next.preemptiveCounterReceived,
    acceptanceTimeRequest: p.acceptanceTimeRequest || next.acceptanceTimeRequest,
    cryptoTokenComp: p.cryptoTokenComp || next.cryptoTokenComp,
    gccArbitrageAnchor: p.gccArbitrageAnchor || next.gccArbitrageAnchor,
    benchTimeDisclosed: p.benchTimeDisclosed || next.benchTimeDisclosed,
    founderSecondInnings: p.founderSecondInnings || next.founderSecondInnings,
    latecareerAgeBias: p.latecareerAgeBias || next.latecareerAgeBias,
    hasAny: false,
  };
  merged.hasAny =
    merged.careerGapMonths != null ||
    merged.careerGapActivity != null ||
    merged.tenureSignal != null ||
    merged.levelMismatch != null ||
    merged.domainPivot ||
    merged.transferableSkillsClaimed ||
    merged.compensationHistoryIssue != null ||
    merged.serviceBondAccepted ||
    merged.probationCompMentioned ||
    merged.internshipConversion ||
    merged.collegeTier != null ||
    merged.earlySwitcher ||
    merged.lowCtcAlert ||
    merged.priorInternshipNonConversion ||
    merged.serviceCompanyBackground ||
    merged.compBreakupUnknown ||
    merged.recentLayoff ||
    merged.hotDomainPremium ||
    merged.pipDisclosed ||
    merged.verbalOnlyOffer ||
    merged.culturalJoiningConstraint ||
    merged.peopleManagementClaimed ||
    merged.crossBorderAnchor ||
    merged.unvestedEquityLossClaim ||
    merged.explodingOfferPressure ||
    merged.postAcceptanceRenege ||
    merged.quotaAttainmentClaimed ||
    merged.gardenLeaveDisclosed ||
    merged.nonCompeteFlagged ||
    merged.relocationBonusAsked ||
    merged.parentInsuranceAsked ||
    merged.inHandTakehomeFocus ||
    merged.rtoPushback ||
    merged.returnshipMaternity ||
    merged.payBandAsked ||
    merged.taxStructureAsked ||
    merged.bgvAnxiety ||
    merged.esopSophisticationProbe ||
    merged.spouseJobConstraint ||
    merged.agingParentCare ||
    merged.moonlightingDisclosed ||
    merged.mentalHealthDisclosed ||
    merged.payParityAsked ||
    merged.preemptiveCounterReceived ||
    merged.acceptanceTimeRequest ||
    merged.cryptoTokenComp ||
    merged.gccArbitrageAnchor ||
    merged.benchTimeDisclosed ||
    merged.founderSecondInnings ||
    merged.latecareerAgeBias;
  return merged;
}
