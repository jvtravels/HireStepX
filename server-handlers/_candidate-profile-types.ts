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
  /** ResumeFactPack track (2026-05-16) — candidate has experience at an
   *  MNC / large established product company. Pre-seeded at init from
   *  resumeFactPack.priorCompanies (any with tier "faang" or
   *  "indian-product") with provenance="resume". Also settable from a
   *  stated utterance ("I've worked at Google", "I'm at an MNC") with
   *  provenance="stated". Resume wins on conflict — monotone-up; never
   *  downgrade. Promoted to first-class so downstream consumers don't
   *  leak resume-shape knowledge by reading priorCompanies directly. */
  mncExperience: boolean;
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
  /* ─── Wave-3 (2026-05-14j) — 25 new flags spanning identity / title /
   * sensitive disclosures (7), history / relationship / retention (6),
   * domain / vertical voice (7), and process / coaching surface (5). */
  /** Wave-3A — candidate asks about exact title / designation /
   *  grade-step ("what's the exact designation?", "SDE-2 or Senior
   *  SDE?", "M5 or M6"). India places huge weight on resume-readable
   *  titles. Routes to designation / grade voice. Monotone-up. */
  titlePrecisionAsk: boolean;
  /** Wave-3A — candidate refuses to share current CTC ("I'd prefer not
   *  to share", "rather not say my current package"). Routes recruiter
   *  to RESPECT the refusal — pivot to band-anchored pricing without
   *  pressuring for the number. Monotone-up. */
  currentCtcRefusal: boolean;
  /** Wave-3A — candidate discloses pregnancy / expecting / due date /
   *  imminent maternity leave. SENSITIVE — recruiter must NOT anchor
   *  down; do not let comp be influenced by maternity context. Routes
   *  to warm + maternity-benefit-detail voice. Monotone-up. */
  pregnancyDisclosed: boolean;
  /** Wave-3A — candidate is a returning ex-employee ("I worked here
   *  before", "boomerang hire", "rejoining after 3 years"). Routes to
   *  rehire-eligibility / institutional-knowledge voice. Monotone-up. */
  boomerangRehire: boolean;
  /** Wave-3A — candidate was referred by a current employee ("X
   *  referred me", "internal referral", "employee referral"). Routes
   *  recruiter to surface referral-bonus / honor-referrer voice and
   *  note the social-debt context. Monotone-up. */
  referralReceived: boolean;
  /** Wave-3A — candidate wants to relocate to hometown / tier-2 city
   *  ("back to my hometown", "move closer to family in Indore /
   *  Coimbatore"). Distinct from spouseJobConstraint. Routes to
   *  tier-2-city PPP-adjusted band voice. Monotone-up. */
  hometownReturnPreference: boolean;
  /** Wave-3A — candidate discloses a disability / accessibility need /
   *  PWD reservation ("hearing impairment", "wheelchair accessible",
   *  "PWD candidate", "accommodation required"). SENSITIVE — routes
   *  recruiter to "yes, we accommodate; what specifically?" voice. Must
   *  not anchor down. Monotone-up. */
  pwdDisability: boolean;
  /** Wave-3A — candidate cites being close to gratuity vesting (4.6+
   *  years; "I'll lose gratuity if I leave now", "almost 5 years for
   *  gratuity"). Routes recruiter to "we can cover the gratuity gap in
   *  the signing bonus" voice. Monotone-up. */
  gratuityVestingNear: boolean;
  /** Wave-3A — candidate asks about acquisition / merger context
   *  ("are you being acquired?", "I heard about the M&A", "post-
   *  acquisition retention"). Routes to "here's where we are on the
   *  M&A; here's how it affects your offer" voice. Monotone-up. */
  acquisitionContextAsk: boolean;
  /** Wave-3A — candidate discloses LGBTQ+ identity / asks about partner
   *  benefits / same-sex spouse insurance. SENSITIVE — routes to
   *  "yes, partner benefits cover same-sex partners" voice. Must not
   *  anchor down. Monotone-up. */
  lgbtqDisclosure: boolean;
  /** Wave-3A — candidate discloses a chronic illness / ongoing
   *  treatment / dialysis / cancer-survivor / autoimmune. SENSITIVE
   *  — routes recruiter to EAP / medical-leave / accommodation voice.
   *  Must not anchor down. Monotone-up. */
  chronicIllnessDisclosed: boolean;
  /** Wave-3A — candidate explicitly asks about notice-period buyout /
   *  shortfall ("can you buy out my notice?", "notice buyout amount?").
   *  Distinct from Phase-25 noticePeriodDays; this is the buyout-money
   *  ask. Routes to "yes/no on notice buyout, here's the cap" voice.
   *  Monotone-up. */
  noticeBuyoutAsk: boolean;
  /** Wave-3B — candidate from BFSI cites year-end / variable / bonus
   *  clawback if they leave before March ("bonus locked till March",
   *  "joining bonus clawback if I leave under 1 year"). Routes to
   *  "we can cover the clawback in the signing bonus" voice.
   *  Monotone-up. */
  bfsiClawbackContext: boolean;
  /** Wave-3B — candidate is at Deloitte/EY/PwC/KPMG and references
   *  grade step (Consultant → Senior Consultant → Manager → SM → D,
   *  "S2 to M1 lateral"). Routes to Big-4 grade-step band voice.
   *  Monotone-up. */
  bigFourGradeStep: boolean;
  /** Wave-3B — candidate raises security clearance / defence / govt
   *  project requirement ("I need clearance", "DRDO/ISRO project",
   *  "DoD clearance"). Routes to clearance-status / timeline voice.
   *  Monotone-up. */
  securityClearanceNeeded: boolean;
  /** Wave-3B — candidate signals willingness to take below-market for
   *  mission (climate, healthtech, public sector, social impact, NGO).
   *  Routes to "we won't lowball you even if you're mission-aligned"
   *  voice. Monotone-up. */
  missionDrivenComp: boolean;
  /** Wave-3B — candidate probes edtech company reputation / mass-firing
   *  history / Byju's-parallel anxiety. Routes to honest-stability /
   *  runway / unit-economics voice. Monotone-up. */
  edtechReputationCheck: boolean;
  /** Wave-3B — candidate's CURRENT company is being acquired / wound
   *  down and they're moving as a result. Distinct from
   *  acquisitionContextAsk which is about OUR company's M&A.
   *  Routes to "stale CTC is non-signal, we price the role" voice.
   *  Monotone-up. */
  acquiHireContext: boolean;
  /** Wave-3B — candidate asks about cabin / parking / dedicated
   *  workstation / company car / fuel reimbursement. Traditional
   *  Indian seniority perks. Routes to perk-disclosure voice.
   *  Monotone-up. */
  cabinParkingAsk: boolean;
  /** Wave-3B — candidate asks about their span of control / team size
   *  to manage / org structure / reporting lines / number of reports.
   *  Routes to "here's the org chart and your span of control" voice.
   *  Monotone-up. */
  spanOfControlAsk: boolean;
  /** Wave-3C — candidate has NOT yet told current employer ("they
   *  don't know I'm interviewing", "stealth job search"). Routes to
   *  "we'll structure the offer to give you confidentiality cover"
   *  voice. Monotone-up. */
  preResignationStealth: boolean;
  /** Wave-3C — candidate refuses to give a number first and asks the
   *  recruiter to anchor ("what's your budget?", "you tell me",
   *  "what range did you have in mind?"). Routes to coaching: do not
   *  anchor first unless band data is firm. Monotone-up. */
  reverseAnchorAsk: boolean;
  /** Wave-3C — candidate raises dietary / religious accommodation
   *  (Jain / halal / vegetarian-cafeteria / Friday prayers / Ramzan /
   *  Sabbath). Routes to dietary-accommodation voice. Monotone-up. */
  dietaryReligiousNeed: boolean;
  /** Wave-3C — candidate has trouble retrieving relieving letter /
   *  experience letter / payslips from a prior employer. Affects BGV.
   *  Routes to "we accept affidavit / alternate proof" voice.
   *  Monotone-up. */
  oldEmployerDocsIssue: boolean;
  /** Wave-3C — candidate asks about equity refresh cadence / top-up
   *  grants / promotion refresh ("when's my next RSU grant?", "annual
   *  refresh policy?", "promotion top-up?"). Distinct from
   *  esopSophisticationProbe (which is initial-grant mechanics).
   *  Routes to refresh-cadence voice. Monotone-up. */
  equityRefreshCadenceAsk: boolean;
  /** Wave-3D (PDF #17 follow-up, 2026-05-15) — candidate asks about
   *  equity vesting schedule / cadence ("vesting schedule", "vesting
   *  cadence", "how does vesting work", "vesting period"). Distinct
   *  from equityRefreshCadenceAsk (refresh grants) and
   *  equityCliffPeriodAsk (initial cliff). Monotone-up. */
  equityVestingScheduleAsk: boolean;
  /** Wave-3D (PDF #17 follow-up, 2026-05-15) — candidate asks about
   *  the equity cliff period ("cliff period", "1-year cliff",
   *  "vesting cliff"). Monotone-up. */
  equityCliffPeriodAsk: boolean;
  /** Wave-3D (PDF #17 follow-up, 2026-05-15) — candidate asks about
   *  exercise terms / window / price ("exercise terms", "exercise
   *  window", "exercise price", "strike price", "exercise period").
   *  Monotone-up. */
  equityExerciseTermsAsk: boolean;
  /** Wave-3D (PDF #17 follow-up, 2026-05-15) — candidate asks about
   *  buyback / liquidity events ("buyback", "liquidity event",
   *  "secondary sale", "tender offer", "liquidity history"). Distinct
   *  from preIpoSecondaryAsk (broader pre-IPO context) and
   *  tenderOfferCycleAsk (cadence of buybacks); this flag captures the
   *  general liquidity-mechanism ask. Monotone-up. */
  equityBuybackLiquidityAsk: boolean;
  /* ─── Wave-4 (2026-05-14k) — 32 new flags spanning high-frequency comp /
   * process gaps (12), sensitive identity / DEI (6), equity depth (5),
   * contract / timing (5), and vertical context (4). */
  /** Wave-4A — candidate raises sign-on / joining bonus clawback if they
   *  leave before X months. Distinct from JB-ask in noticeJoining.
   *  Routes to "we will document the clawback waiver" voice. Monotone-up. */
  signOnClawback: boolean;
  /** Wave-4A — candidate claims consistent variable / bonus track record
   *  ("always hit 100% variable", "maxed bonus"). Engineering/PM variant
   *  of sales' quotaAttainmentClaimed. Routes to validate + price-the-
   *  level voice. Monotone-up. */
  variableTrackRecord: boolean;
  /** Wave-4A — candidate asks about WFH / setup stipend (desk, chair,
   *  internet, laptop reimbursement, one-time WFH allowance). Routes to
   *  concrete-stipend-amount disclosure voice. Monotone-up. */
  wfhEquipmentStipend: boolean;
  /** Wave-4A — candidate asks about salary review cadence ("annual or
   *  semi-annual?", "next appraisal?", "mid-year correction policy?").
   *  Routes to review-cycle disclosure voice. Monotone-up. */
  salaryReviewCadenceAsk: boolean;
  /** Wave-4A — candidate juggling multiple offers / 3+ active processes.
   *  Distinct from explodingOfferPressure (one tight deadline) and
   *  competingOffer (single rival). Routes to "let's get to apples-to-
   *  apples comparison" voice. Monotone-up. */
  multipleOffersJuggling: boolean;
  /** Wave-4A — candidate is sourced through an external recruiter /
   *  placement agency / RMS / consultancy. Materially distorts offer
   *  mechanics (agency margin, BGV, joining timeline). Monotone-up. */
  recruitmentAgencyMediation: boolean;
  /** Wave-4A — candidate is an internal transfer / IJP candidate.
   *  Routes to internal-band / current-grade-step voice. Monotone-up. */
  internalTransferContext: boolean;
  /** Wave-4A — candidate has a prior offer-rescinded history ("Cars24
   *  pulled my offer", "joining was cancelled"). Routes to extra-
   *  reassurance / written-offer-quickly voice. Monotone-up. */
  offerRescindedHistory: boolean;
  /** Wave-4A — candidate signals international degree premium (Stanford,
   *  MIT, Oxford, Ivy League MBA, INSEAD / LBS / Wharton). Distinct from
   *  crossBorderAnchor (overseas TC). Routes to "premium acknowledged
   *  but India-priced" voice. Monotone-up. */
  internationalDegreePremium: boolean;
  /** Wave-4A — candidate is fresh from top-tier domestic MBA (IIM-A/B/C,
   *  ISB, XLRI, FMS, MDI). Distinct from collegeTier=tier-1 (undergrad).
   *  Routes to MBA-fresher-band voice. Monotone-up. */
  domesticTopMbaAnchor: boolean;
  /** Wave-4A — candidate cites toxic manager / bad leadership as primary
   *  exit reason. Distinct from generic badmouthing. Routes to
   *  "validate without anchoring down" voice. Monotone-up. */
  toxicManagerContext: boolean;
  /** Wave-4A — candidate needs visa sponsorship (H1B, OPT expiry, STEM
   *  extension, green card sponsorship, visa transfer). Routes to
   *  sponsorship-eligibility / timeline voice. Monotone-up. */
  visaSponsorshipNeed: boolean;
  /** Wave-4B — candidate discloses caste / reservation category (SC/ST/
   *  OBC) in PSU/govt context. SENSITIVE — respect category disclosure;
   *  do not anchor on it. Monotone-up. */
  casteReservationContext: boolean;
  /** Wave-4B — candidate is transitioning from armed forces (Army/Navy/
   *  Air Force, ex-defence, military lateral). Routes to veteran-
   *  lateral comp / civil-equivalent voice. Monotone-up. */
  veteranTransition: boolean;
  /** Wave-4B — candidate is a single parent (sole custody, no co-
   *  parent). Drives schedule-flex / location constraints. SENSITIVE —
   *  schedule flex voice; do not anchor down. Monotone-up. */
  singleParentConstraint: boolean;
  /** Wave-4B — candidate is sole earner / joint-family financial
   *  responsibility (supporting parents, siblings' education). SENSITIVE
   *  — do not anchor down. Monotone-up. */
  jointFamilyFinancialResp: boolean;
  /** Wave-4B — candidate asks about paternity-leave policy. Distinct
   *  from returnshipMaternity. Routes to policy-disclosure voice.
   *  Monotone-up. */
  paternityLeaveAsk: boolean;
  /** Wave-4B — candidate asks about menstrual / period leave policy
   *  (Zomato-style). Routes to policy-disclosure voice. Monotone-up. */
  menstrualLeavePolicy: boolean;
  /** Wave-4C — candidate asks about ESOP exercise loan / cashless
   *  exercise / company-funded exercise. Routes to exercise-loan
   *  mechanics voice. Monotone-up. */
  esopExerciseLoanAsk: boolean;
  /** Wave-4C — candidate asks about pre-IPO secondary sale / tender
   *  for early employees. Routes to secondary-cycle voice. Monotone-up. */
  preIpoSecondaryAsk: boolean;
  /** Wave-4C — candidate asks directly about acceleration trigger
   *  (single-trigger / double-trigger on change of control). Distinct
   *  from esopSophisticationProbe. Routes to double-trigger voice.
   *  Monotone-up. */
  accelerationTriggerAsk: boolean;
  /** Wave-4C — candidate asks about ESOP perquisite-tax treatment
   *  (Section 17(2), TDS on exercise). Routes to perquisite-tax voice.
   *  Monotone-up. */
  esopPerquisiteTaxAsk: boolean;
  /** Wave-4C — candidate asks about tender-offer / annual buyback
   *  cycle. Routes to buyback-cadence voice. Monotone-up. */
  tenderOfferCycleAsk: boolean;
  /** Wave-4D — candidate asks about probationary duration (3-mo vs
   *  6-mo). Distinct from probationCompMentioned. Routes to probation-
   *  length voice. Monotone-up. */
  probationaryDurationAsk: boolean;
  /** Wave-4D — candidate demands fast offer-letter turnaround
   *  ("48 hours", "when will I get the OL?"). Routes to OL-turnaround
   *  voice. Monotone-up. */
  offerLetterTurnaroundDemand: boolean;
  /** Wave-4D — candidate asks if role is contract-to-hire / when it
   *  converts to permanent. Routes to contract-to-hire mechanics
   *  voice. Monotone-up. */
  contractToHireAsk: boolean;
  /** Wave-4D — candidate explicitly checks headcount approval / HC
   *  budgeted ("seen offers fall through on HC"). Routes to
   *  headcount-approval voice. Monotone-up. */
  headcountApprovalCheck: boolean;
  /** Wave-4D — candidate raises IP assignment / moonlighting / side-
   *  project ownership concern. GenAI-era anxiety. Routes to IP-scope
   *  voice. Monotone-up. */
  ipAssignmentClauseAsk: boolean;
  /** Wave-4E — candidate from pharma R&D / API / clinical / regulatory
   *  (Sun Pharma, Dr Reddy's, Cipla). Routes to pharma-band voice.
   *  Monotone-up. */
  healthcarePharmaContext: boolean;
  /** Wave-4E — candidate from core mechanical / electrical / auto /
   *  steel (Tata Motors, Mahindra, L&T, Maruti, Bajaj Auto). Routes
   *  to core-engineering-band voice. Monotone-up. */
  manufacturingCoreContext: boolean;
  /** Wave-4E — candidate from quick commerce (Zepto, Blinkit, Swiggy-
   *  Instamart, BB-Now). Routes to quick-commerce equity voice.
   *  Monotone-up. */
  quickCommerceContext: boolean;
  /** Wave-4E — candidate from D2C founder-era brand (Boat, Mamaearth,
   *  Sugar, Wakefit, Licious). Routes to D2C-brand voice. Monotone-up. */
  d2cConsumerEquity: boolean;
  /* ─── PDF #17 architectural fix (2026-05-15) — discovery-first
   * detectors. The recruiter MUST collect these signals before
   * disclosing an anchor band. All six are optional for back-compat
   * with serialized state from in-flight sessions; the merge helper
   * is monotone-up. */
  /** Candidate disclosed their current CTC (phrases like "my current
   *  CTC is", "I'm earning", "current package is" + a ₹ amount). */
  currentCtcDisclosed?: boolean;
  /** Candidate disclosed the fixed/variable split of their current
   *  package ("X fixed Y variable", "70-30 split", etc). */
  fixedVariableSplitDisclosed?: boolean;
  /** Candidate disclosed their in-hand / take-home amount ("in-hand is
   *  ₹X", "monthly net ₹X"). */
  inHandSalaryDisclosed?: boolean;
  /** Candidate disclosed their notice period ("X days/weeks/months
   *  notice", "notice period is X"). */
  noticePeriodDisclosed?: boolean;
  /** Candidate disclosed competing-offer status, either positively
   *  ("I have another offer", "in process with X") or negatively
   *  ("no other offers"). */
  competingOffersDisclosed?: boolean;
  /** Candidate provided role-specific value proof: ARR/book size for
   *  CSM, quota/attainment for sales, complex system shipped for
   *  engineering, product launches + metrics for product, portfolio
   *  depth for design. */
  valueProofProvided?: boolean;
  /* ─── Wave-5 (ITEM 4, 2026-05-15) — 21 preference / behaviour flags.
   * These are additive; back-compat optional fields would break EMPTY type,
   * so they are required booleans / nullable unions defaulting to false/null
   * in EMPTY and populated by the Wave-5 detectors below. */

  /* Equity/Wealth flags */
  /** Candidate explicitly prefers equity over a higher cash component
   *  ("I'd rather have equity", "more stock than salary", "equity matters
   *  more to me than base"). Routes recruiter to equity-first framing.
   *  Monotone-up. */
  /** Candidate mentions existing unvested equity / cliff they'd be leaving
   *  ("I have a 1-year cliff coming up", "unvested RSUs worth X"). Distinct
   *  from unvestedEquityLossClaim (loss framing); this is existence signal.
   *  Monotone-up. */
  /** Candidate demonstrates RSU/ESOP vesting mechanics awareness ("4-year
   *  vesting with 1-year cliff", "monthly vesting after cliff", "standard
   *  4/1 schedule"). Sophisticated-candidate signal. Monotone-up. */
  /** Candidate self-identifies as an ESOP/stock holder at current employer
   *  ("I hold ESOPs", "I have unvested options", "my current package
   *  includes ESOPs"). Distinct from esopSophisticationProbe (questions
   *  mechanics) — this is an ownership-existence signal. Monotone-up. */

  /* Risk/Stability flags */
  /** Candidate signals preference for fixed over variable comp ("I prefer
   *  stable fixed salary", "not comfortable with variable", "I'd rather
   *  have less variable"). Routes recruiter to fixed-heavy structuring.
   *  Monotone-up. */
  /** Candidate signals preference for an MNC / established company over a
   *  startup ("I want the stability of an MNC", "prefer large company",
   *  "not comfortable with startup risk"). Monotone-up. */
  /** Candidate signals preference for a startup / high-growth environment
   *  ("I want to join a startup", "looking for a fast-paced startup",
   *  "equity is important — startup stage"). Monotone-up. */
  /** Candidate explicitly states willingness to relocate ("I'm open to
   *  relocating", "happy to move cities", "can relocate for the right
   *  role"). Distinct from relocationBonusAsked (money ask). Monotone-up. */
  /** Candidate's stated work-mode preference. Null when not stated. */

  /* Negotiation behaviour flags */
  /** Candidate signals they will or are likely to counter any offer
   *  ("I'll need to think about it and come back", "I'll be negotiating",
   *  "I always negotiate", "I have a number in mind"). Monotone-up. */
  /** Candidate volunteered they accepted a first offer in the past
   *  ("I usually accept the first offer", "I took the first number they
   *  gave me", "I don't like to negotiate"). Anti-signal for counter risk.
   *  Monotone-up. */
  /** Set true when a walk-away phase is triggered in the session (i.e.,
   *  the negotiation ended with close-walkaway). Set by applyAiMove or
   *  the phase-derivation path, not by parseCandidateAnswer. */
  /** Candidate's expected CTC is > 40% above their stated current CTC
   *  ("I'm at 20L and want 30L"). High-anchor signal — routes recruiter
   *  to "show your work" probe. Populated when both numbers are parseable.
   *  Monotone-up. */
  /** Candidate gave a salary range with a spread of ≥ ₹20 LPA ("between
   *  28 and 50 LPA" or similar). Signals low precision / willingness to
   *  anchor at the low end. Monotone-up. */

  /* Notice/Timing flags */
  /** Candidate indicated their notice period can be shortened via buyout
   *  or early exit ("my notice can be bought out", "they can waive it",
   *  "I can join earlier if you cover the notice"). Distinct from
   *  noticeBuyoutAsk (asking whether WE pay). Monotone-up. */
  /** Candidate's joining urgency. Null when not stated. */
  /** Estimate of how likely the candidate's current employer will counter.
   *  "high" when candidate mentions prior counter or current manager knows
   *  they're looking. "medium" when tenure/specialisation is high. Null
   *  when not inferable. */
  counterOfferRisk: "high" | "medium" | "low" | null;

  /* Domain/Seniority flags */
  /** Candidate is transitioning from Individual Contributor to People
   *  Manager ("I want to move into management", "looking for a team lead
   *  / EM / manager role", "ready for the IC→manager transition").
   *  Distinct from peopleManagementClaimed (already managing). Monotone-up. */
  /** Candidate claims prior leadership / management experience ("I've
   *  led teams", "ex-engineering-manager", "director level"). Broader
   *  than peopleManagementClaimed — includes non-current experience.
   *  Monotone-up. */
  /** Candidate mentions a niche domain specialisation that commands a
   *  premium (fintech, healthtech, deep-tech, space-tech, climate-tech,
   *  embedded, VLSI, quantitative finance). Routes to premium-band voice.
   *  Monotone-up. */
  /** Candidate has been at 3+ companies in the last 2 years (distinct from
   *  tenureSignal="frequent" which is 3+ in 5 years). Extreme job-hopper
   *  signal — routes to retention-risk framing. Monotone-up. */

  /* ─── Wave-6 (2026-05-15) — Compensation structure flags (~21 flags). ── */

  /* Current compensation breakdown */
  /** Candidate mentioned annual / performance bonus at current employer. Monotone-up. */
  /** Extracted bonus % of CTC ("15% variable" → 15). Null when unstated. Takes max across turns. */
  /** Candidate has ESOPs in current role. Monotone-up. */
  /** Candidate mentioned vested ESOPs at current employer. Monotone-up. */
  /** Candidate mentioned retention bonus / joining bonus at current employer. Monotone-up. */
  /** Candidate mentioned gratuity (signals 5yr+ tenure). Monotone-up. */
  /** Candidate mentioned NPS / 80CCD(2) component. Monotone-up. */

  /* Expected compensation preferences */
  /** Candidate explicitly asked for higher fixed/base. Monotone-up. */
  wantsHigherBase: boolean;
  /** Candidate asked about performance bonus structure. Monotone-up. */
  /** Candidate asked about or mentioned joining bonus. Monotone-up. */
  wantsJoiningBonus: boolean;
  /** Candidate asked about relocation support/allowance. Monotone-up. */
  wantsRelocationAllowance: boolean;
  /** Candidate asked about remote/hybrid work arrangement (days in office)
   * as part of the offer — distinct from wfhEquipmentStipend (setup money).
   * Gap #1 (2026-06-18). Monotone-up. */
  wantsFlexibleWork: boolean;
  /** Candidate mentioned L&D budget, certifications, upskilling allowance. Monotone-up. */
  /** Candidate asked about equity refresh grants. Monotone-up. */
  /** Candidate mentioned title upgrade as part of expectation. Monotone-up. */

  /* Offer evaluation signals */
  /** Candidate has received the offer letter / verbal offer. Monotone-up. */
  /** Candidate mentioned offer expiry / time pressure. Monotone-up. */
  /** Extracted deadline date/timeframe if mentioned ("by Friday", "3 days"). Null when unstated. */
  /** Candidate is juggling 2+ active offers simultaneously. Monotone-up. */
  /** Candidate explicitly said they care more about the number than perks. Monotone-up. */
  /** Health insurance, food coupons, cab mentioned as important. Monotone-up. */

  /* ─── Wave-7 (2026-05-15) — Behavioral and psychological negotiation flags (~21 flags). ── */

  /* Anchoring behavior */
  /** Candidate stated a number before being asked. Monotone-up. */
  /** Candidate's first anchor was > 50% above current CTC. Monotone-up. */
  /** Candidate walked back their initial ask. Monotone-up. */
  /** Candidate accepted counter-offer in < 2 turns. Monotone-up. */

  /* Pressure response */
  /** Candidate acknowledged when told budget ceiling. Monotone-up. */
  /** Candidate explicitly challenged the stated ceiling. Monotone-up. */
  /** Candidate used competing offer as leverage (not just mentioned). Monotone-up. */
  invokedCompetingOffer: boolean;
  /** Candidate said things like "I need to decide by...". Monotone-up. */
  /** Candidate expressed hesitation ("I'm not sure", "need to think about it"). Monotone-up. */

  /* Rapport signals */
  /** Candidate addressed recruiter by name. Monotone-up. */
  /** Candidate expressed gratitude during negotiation. Monotone-up. */
  /** Candidate showed interest in team/manager/culture. Monotone-up. */
  /** Candidate asked about career progression explicitly. Monotone-up. */
  askedAboutGrowthPath: boolean;
  /** Candidate raised WLB as a concern. Monotone-up. */

  /* Red flags */
  /** CTC numbers contradicted each other across turns. Monotone-up. */
  gaveInconsistentNumbers: boolean;
  /** Candidate deflected or refused to disclose current CTC. Monotone-up. */
  evasiveOnCurrentCtc: boolean;
  /** Expected CTC jumped > 30% across turns (changed ask). Monotone-up. */
  /** Current employer made or might make counter-offer. Monotone-up. */
  /** Candidate hinted at job insecurity as reason for looking. Monotone-up. */
  /** Multiple signals of time pressure / urgency. Monotone-up. */

  /* ─── Wave-8 (2026-05-16) — Offer-response behavior + financial specifics +
   * role clarity + competing-offer specifics (~21 flags). */

  /* Offer-response behavior */
  /** Candidate reacted positively, negatively, or neutrally to the offer.
   *  Null when not yet stated. */
  /** Candidate explicitly rejected the offer ("I can't accept this",
   *  "this doesn't work for me"). Monotone-up. */
  /** Candidate asked for time to decide ("can I have a day?", "I need
   *  to think overnight"). Monotone-up. */
  /** Candidate mentioned spouse / family discussion as reason for delay
   *  ("need to discuss with my wife", "family decision"). Monotone-up. */
  mentionedSpouseFamily: boolean;
  /** Candidate mentioned relocation in the context of this offer
   *  ("I'd need to relocate", "is relocation covered?"). Distinct from
   *  relocationBonusAsked (money) and openToRelocation (willingness).
   *  Monotone-up. */

  /* Financial specifics */
  /** Candidate asked about PF contribution / UAN transfer / employer PF
   *  ("what's the PF breakup?", "does the company contribute 12%?",
   *  "PF UAN transfer"). Monotone-up. */
  /** Candidate mentioned gratuity in an offer-evaluation context
   *  ("is gratuity included?", "5-year gratuity"). Distinct from
   *  currentHasGratuity (existing employer) and gratuityVestingNear
   *  (near-vesting signal). Monotone-up. */
  /** Candidate asked about Form-16 / tax certificate from new employer
   *  ("will I get Form 16?", "Form 16 issuance date"). Monotone-up. */
  mentionedForm16: boolean;
  /** Candidate asked when / how variable component gets paid ("when is
   *  variable paid?", "is variable quarterly or annual?", "what's the
   *  variable payout track record?"). Monotone-up. */
  /** Candidate asked about or mentioned signing bonus
   *  ("is there a signing bonus?", "sign-on?"). Distinct from
   *  wantsJoiningBonus (preference) — this is a mention/ask signal.
   *  Monotone-up. */
  /** Candidate asked about retention bonus
   *  ("retention bonus?", "is there a stay bonus?"). Monotone-up. */
  /** Candidate asked about joining bonus explicitly
   *  ("joining bonus", "JB", "onboarding bonus"). Distinct from
   *  wantsJoiningBonus (preference weight); this is a raw mention/ask.
   *  Monotone-up. */

  /* Role clarity flags */
  /** Candidate asked who they report to ("who's my manager?",
   *  "reporting line", "who does this role report to?"). Monotone-up. */
  askedAboutReporting: boolean;
  /** Candidate asked about team size ("how big is the team?",
   *  "how many people on the team?"). Distinct from spanOfControlAsk
   *  (management span). Monotone-up. */
  askedAboutTeamSize: boolean;
  /** Candidate asked about growth path ("what's the career path?",
   *  "how quickly do people grow here?"). Already covered by
   *  askedAboutGrowthPath in Wave-7; this is the Wave-8 parallel
   *  intended to capture it via a different detection path. Monotone-up. */
  askedAboutGrowthPath8: boolean;
  /** Candidate asked about performance review cycle ("annual review?",
   *  "performance cycle", "how often is performance assessed?").
   *  Monotone-up. */
  /** Candidate stated a target role / future aspiration ("I want to be
   *  a Staff Engineer in 3 years", "VP in 5 years"). Monotone-up. */

  /* Competing-offer specifics */
  /** Candidate's competing offer is verbal / not yet written
   *  ("I have a verbal offer", "not written yet", "informal offer").
   *  Monotone-up. */
  /** Company name of the competing offer, if mentioned. Null when not
   *  stated. Takes last non-null value across turns. */
  /** Stated amount of the competing offer in LPA. Null when not stated.
   *  Takes max across turns. */
  competingOfferAmount: number | null;
  /** Deadline associated with the competing offer, if mentioned
   *  ("they want an answer by Friday"). Null when not stated. Takes
   *  last non-null value. */

  /* ─── Wave-9 (2026-05-16) — Psychological/behavioral + Indian doc/process +
   * seniority/career stage + negotiation strategy signals (~21 flags). */

  /* Psychological/behavioral */
  /** Candidate expressed frustration or impatience ("this is taking too
   *  long", "I'm getting frustrated", "it's been weeks"). Monotone-up. */
  /** Candidate expressed genuine excitement about the role ("I'm really
   *  excited about this", "this is exactly what I've been looking for").
   *  Monotone-up. */
  /** Candidate explicitly paused / asked for a moment to think ("give
   *  me a moment", "let me think about that", "can I have a minute?").
   *  Monotone-up. */
  /** Candidate walked back a previously stated number ("actually, I can
   *  work with less", "forget what I said — let's talk about X").
   *  Distinct from retreatedFromAnchor (which tracks first-anchor walk-
   *  back). This covers mid-session backtracking. Monotone-up. */
  /** Candidate escalated their demand AFTER partial agreement ("you
   *  agreed on X, can we also add Y?", "one more thing — I also need Z").
   *  Classic salami tactic. Monotone-up. */

  /* Indian-specific doc/process flags */
  /** Candidate raised a background-verification concern ("BGV", "my
   *  degree has a gap year", "previous employer won't verify", "what
   *  does the BGV cover?"). Distinct from bgvAnxiety (Wave-2, general
   *  anxiety). Monotone-up. */
  mentionedBgvConcern: boolean;
  /** Candidate raised risk of not getting a relieving letter / experience
   *  letter from current employer ("my company may not give relieving
   *  letter", "absconding risk", "I left without proper exit").
   *  Monotone-up. */
  /** Company is willing to waive notice period ("we'll waive notice",
   *  "no notice needed", "immediate joining OK"). Monotone-up. */
  /** Candidate willing to buy out notice ("I'll pay the notice buyout",
   *  "I can cover the shortfall"). Distinct from noticeBuyoutAsk (asking
   *  whether WE pay). Monotone-up. */
  /** Candidate disclosed or asked about moonlighting policy
   *  ("moonlighting", "second job", "side project IP"). Distinct from
   *  moonlightingDisclosed (Wave-2, personal disclosure). This flag
   *  captures any moonlighting mention including policy questions.
   *  Monotone-up. */
  mentionedMoonlighting: boolean;

  /* Seniority/career stage */
  /** Candidate signals this is their first job change ("first company",
   *  "been here since college", "only employer", "never changed jobs").
   *  Monotone-up. */
  /** Candidate has or claims management experience ("I've managed a
   *  team", "managed 5 people", "team lead"). Distinct from
   *  peopleManagementClaimed (current scope) and hasLeadershipExperience
   *  (broader leadership claim). This targets explicit "I managed"
   *  language. Monotone-up. */
  /** Candidate mentions startup experience as a credential ("I've worked
   *  at a startup", "startup background", "Series A company").
   *  Monotone-up. */
  /** Candidate mentions MNC experience ("I've worked at an MNC",
   *  "Fortune 500 background", "large corp experience"). Monotone-up. */
  /** Candidate mentions a PhD or MBA degree ("I have a PhD", "MBA from
   *  IIM", "doctoral degree", "post-grad"). Distinct from
   *  domesticTopMbaAnchor (top-tier MBA band) and
   *  internationalDegreePremium (overseas degree). Monotone-up. */

  /* Negotiation strategy signals */
  /** Candidate stated their number BEFORE being asked — proactive anchor.
   *  Distinct from anchoredFirst (Wave-7 which tracks first-number timing
   *  more broadly). This specifically flags unprompted anchoring.
   *  Monotone-up. */
  /** Candidate gave a salary range instead of a point number ("30 to 35
   *  LPA", "somewhere between X and Y"). Signals lower precision /
   *  willingness to converge. Monotone-up. */
  gaveRangeNotPoint: boolean;
  /** Candidate deflected when asked for a number ("I'm flexible",
   *  "you tell me", "whatever the market says", "I'm open"). Classic
   *  negotiation defensive move. Monotone-up. */
  deflectedOnRange: boolean;
  /** Candidate cited external market data ("Glassdoor says", "levels.fyi
   *  data", "AmbitionBox shows", "market research suggests"). Monotone-up. */
  referencedMarketData: boolean;
  /** Polish 3 (2026-05-16) — the specific source keys the candidate
   *  named. Lets the reactive followup cite the exact source(s) instead
   *  of saying "market data" generically. Union-merged across turns
   *  (monotone-up). Source keys come from `marketDataSources`. */
  referencedMarketDataSources: string[];
  /** Candidate mentioned cost-of-living as a factor ("cost of living in
   *  Bangalore", "Mumbai is expensive", "higher CoL city"). Monotone-up. */
  /** Candidate mentioned tax implications as a factor ("new tax regime",
   *  "Section 87A", "old vs new regime", "TDS planning", "my effective
   *  tax rate"). Monotone-up. */
  mentionedTaxImplication: boolean;

  /** Convenience flag. */
  hasAny: boolean;
}

/* ─── DPDP Special Personal Data classification ──────────────────────
 *
 * Under India's Digital Personal Data Protection Act, 2023 (DPDP) and
 * adjacent global frameworks (GDPR Art. 9 "special categories"), the
 * following candidate-profile flags encode SENSITIVE / SPECIAL personal
 * data: health, sexual orientation, caste / religion, family / care
 * status, disability, and gender / reproductive context.
 *
 * These flags MUST NOT be written to analytics logs, retention stores,
 * or any non-essential persistence layer in cleartext. Any code path
 * that emits a candidateProfile snapshot to a log/analytics sink MUST
 * route the snapshot through `redactCandidateProfileForLogs()` first.
 *
 * The kernel still computes these flags in-memory for turn-by-turn
 * dialogue framing (e.g. choosing an empathetic voice for a layoff or
 * PIP disclosure), but they are zeroed before any telemetry write.
 *
 * Adding a new sensitive flag? Add the key here, ensure it's a boolean
 * on CandidateProfileResult, and update the redaction tests. */
export const SPECIAL_PERSONAL_DATA_FLAGS: ReadonlyArray<keyof CandidateProfileResult> = [
  "pregnancyDisclosed",
  "pipDisclosed",
  "mentalHealthDisclosed",
  "lgbtqDisclosure",
  "casteReservationContext",
  "pwdDisability",
  "chronicIllnessDisclosed",
  "dietaryReligiousNeed",
  "singleParentConstraint",
  "paternityLeaveAsk",
  "menstrualLeavePolicy",
  "agingParentCare",
  "returnshipMaternity",
];

/**
 * Return a shallow copy of `p` with every flag in
 * SPECIAL_PERSONAL_DATA_FLAGS forced to `false`. All other fields pass
 * through unchanged. The input object is NOT mutated.
 *
 * Use this at every analytics / log write boundary that includes a
 * candidate-profile snapshot (PostHog events, retention tables, error
 * reports, debug dumps). See DPDP rationale above.
 */
export function redactCandidateProfileForLogs(
  p: CandidateProfileResult,
): CandidateProfileResult {
  const out: CandidateProfileResult = { ...p };
  for (const key of SPECIAL_PERSONAL_DATA_FLAGS) {
    /* Every listed flag is a boolean field on the interface; zero it.
     * Dynamic key from SPECIAL_PERSONAL_DATA_FLAGS needs the index-signature view. */
    (out as unknown as Record<string, unknown>)[key as string] = false;
  }
  return out;
}

/**
 * Generic deep-redaction helper for any payload destined for an
 * analytics / log sink. Walks the object (arrays + plain objects)
 * and forces any key that matches a SPECIAL_PERSONAL_DATA_FLAGS name
 * to `false`. Non-matching keys pass through unchanged.
 *
 * Use this as a defence-in-depth wrap at every analytics write site
 * where the payload MAY contain a candidate-profile snapshot
 * (PostHog events, structured stdout logs, retention writes).
 *
 * Pure — does not mutate the input. Cycles in the input cause it to
 * fall back to returning the value unchanged for that subtree
 * (analytics payloads should not be cyclic).
 */
export function redactForAnalytics(payload: unknown): unknown {
  const sensitive = new Set<string>(
    SPECIAL_PERSONAL_DATA_FLAGS.map((k) => String(k)),
  );
  const seen = new WeakSet<object>();
  function walk(v: unknown): unknown {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return v;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src)) {
      if (sensitive.has(k)) {
        out[k] = false;
      } else {
        out[k] = walk(src[k]);
      }
    }
    return out;
  }
  return walk(payload);
}

export const EMPTY_CANDIDATE_PROFILE: CandidateProfileResult = {
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
  mncExperience: false,
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
  /* Wave-3 (2026-05-14j) — 25 new flags. */
  titlePrecisionAsk: false,
  currentCtcRefusal: false,
  pregnancyDisclosed: false,
  boomerangRehire: false,
  referralReceived: false,
  hometownReturnPreference: false,
  pwdDisability: false,
  gratuityVestingNear: false,
  acquisitionContextAsk: false,
  lgbtqDisclosure: false,
  chronicIllnessDisclosed: false,
  noticeBuyoutAsk: false,
  bfsiClawbackContext: false,
  bigFourGradeStep: false,
  securityClearanceNeeded: false,
  missionDrivenComp: false,
  edtechReputationCheck: false,
  acquiHireContext: false,
  cabinParkingAsk: false,
  spanOfControlAsk: false,
  preResignationStealth: false,
  reverseAnchorAsk: false,
  dietaryReligiousNeed: false,
  oldEmployerDocsIssue: false,
  equityRefreshCadenceAsk: false,
  /* Wave-3D (PDF #17 follow-up, 2026-05-15) — equity-instrument depth. */
  equityVestingScheduleAsk: false,
  equityCliffPeriodAsk: false,
  equityExerciseTermsAsk: false,
  equityBuybackLiquidityAsk: false,
  /* Wave-4 (2026-05-14k) — 32 new flags. */
  signOnClawback: false,
  variableTrackRecord: false,
  wfhEquipmentStipend: false,
  salaryReviewCadenceAsk: false,
  multipleOffersJuggling: false,
  recruitmentAgencyMediation: false,
  internalTransferContext: false,
  offerRescindedHistory: false,
  internationalDegreePremium: false,
  domesticTopMbaAnchor: false,
  toxicManagerContext: false,
  visaSponsorshipNeed: false,
  casteReservationContext: false,
  veteranTransition: false,
  singleParentConstraint: false,
  jointFamilyFinancialResp: false,
  paternityLeaveAsk: false,
  menstrualLeavePolicy: false,
  esopExerciseLoanAsk: false,
  preIpoSecondaryAsk: false,
  accelerationTriggerAsk: false,
  esopPerquisiteTaxAsk: false,
  tenderOfferCycleAsk: false,
  probationaryDurationAsk: false,
  offerLetterTurnaroundDemand: false,
  contractToHireAsk: false,
  headcountApprovalCheck: false,
  ipAssignmentClauseAsk: false,
  healthcarePharmaContext: false,
  manufacturingCoreContext: false,
  quickCommerceContext: false,
  d2cConsumerEquity: false,
  /* Wave-5 (ITEM 4, 2026-05-15) — 21 preference / behaviour flags. */
  counterOfferRisk: null,
  /* Wave-6 (2026-05-15) — compensation structure flags. */
  wantsHigherBase: false,
  wantsJoiningBonus: false,
  wantsRelocationAllowance: false,
  wantsFlexibleWork: false,
  /* Wave-7 (2026-05-15) — behavioral/psychological negotiation flags. */
  invokedCompetingOffer: false,
  askedAboutGrowthPath: false,
  gaveInconsistentNumbers: false,
  evasiveOnCurrentCtc: false,

  /* Wave-8 (2026-05-16) defaults */
  mentionedSpouseFamily: false,
  mentionedForm16: false,
  askedAboutReporting: false,
  askedAboutTeamSize: false,
  askedAboutGrowthPath8: false,
  competingOfferAmount: null,

  /* Wave-9 (2026-05-16) defaults */
  mentionedBgvConcern: false,
  mentionedMoonlighting: false,
  gaveRangeNotPoint: false,
  deflectedOnRange: false,
  referencedMarketData: false,
  referencedMarketDataSources: [],
  mentionedTaxImplication: false,

  /* Audit follow-up (2026-05-21) — Wave-fact-disclosure markers. These
   * are typed `?: boolean` on the interface and were silently absent
   * from EMPTY, so consumers spreading `...EMPTY_CANDIDATE_PROFILE`
   * received `undefined` for these fields. The chaos test caught this
   * as schema drift between extract output and EMPTY. Defaults explicit
   * so spread-construction yields a fully-populated profile. */
  currentCtcDisclosed: false,
  fixedVariableSplitDisclosed: false,
  inHandSalaryDisclosed: false,
  noticePeriodDisclosed: false,
  competingOffersDisclosed: false,
  valueProofProvided: false,

  hasAny: false,
};

