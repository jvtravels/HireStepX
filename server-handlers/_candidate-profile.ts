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
    compBreakupUnknown;
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
    merged.compBreakupUnknown;
  return merged;
}
