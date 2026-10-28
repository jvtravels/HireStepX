import { type CareerGapActivity, type CompensationHistoryIssue, type LevelMismatch, type TenureSignal } from "./_candidate-profile-types";
import { registerWaveFlag } from "./_candidate-profile-registry";

/* "1-year gap", "6 month break", "took a break of 8 months",
 * "career gap of 2 years" — months-normalized. */
export function extractGapMonths(text: string): number | null {
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

export const GAP_ACTIVITY_PATTERNS: { kind: CareerGapActivity; pattern: RegExp }[] = [
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

export const FREQUENT_SWITCH_PATTERNS = [
  /\b(?:switch(?:ed)?|changed|moved\s+(?:between|across))\s+(?:jobs?|companies|roles)\s+(\d+)\s+times?\b/i,
  /\b(\d+)\s+(?:jobs?|companies|switches)\s+in\s+(\d+)\s+(?:year|yr|years|yrs)\b/i,
  /\b(?:job[-\s]?hopp(?:er|ing)|frequent\s+(?:switch(?:er|es)|changes?|moves?)|short\s+stints?|short\s+tenures?)\b/i,
];

export const STABLE_TENURE_PATTERNS = [
  /\b(?:stayed\s+(?:for\s+)?(\d+)\+?\s+(?:year|yr|years|yrs)|tenured?\s+(?:for\s+)?(\d+)\+?\s+(?:year|yr|years|yrs)|long\s+tenure|stable\s+(?:career|tenure)|(\d+)\+?\s+(?:year|yr|years|yrs)\s+at\s+(?:my\s+)?(?:current|same|one)\s+(?:company|role|job))\b/i,
];

export function extractTenureSignal(text: string): TenureSignal | null {
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

export const OVER_PATTERNS = [
  /\b(?:over[-\s]?qualified|overqualified|seem\s+over[-\s]?qualified|may\s+(?:be|seem)\s+over[-\s]?qualified|too\s+(?:senior|experienced)\s+for|higher\s+level\s+than\s+(?:this|the)\s+role)\b/i,
];

export const UNDER_PATTERNS = [
  /\b(?:under[-\s]?qualified|underqualified|not\s+match(?:ing)?\s+every\s+requirement|short\s+on\s+(?:yoe|experience|years)|less\s+experience\s+than|don.?t\s+match\s+(?:the\s+)?(?:level|requirements?)|may\s+not\s+match\s+every\s+requirement)\b/i,
];

export function extractLevelMismatch(text: string): LevelMismatch | null {
  if (OVER_PATTERNS.some((p) => p.test(text))) return "over";
  if (UNDER_PATTERNS.some((p) => p.test(text))) return "under";
  return null;
}

/* Phase 25b — domain-pivot patterns. Two flavours: explicit transition
 * ("moving from teaching to sales", "career change") and "transferable
 * skills" framing that almost always accompanies a pivot. We require
 * a transition phrase OR an explicit pivot keyword; transferable-skills
 * alone is too noisy (anyone might say it in passing). */
export const DOMAIN_PIVOT_PATTERNS: RegExp[] = [
  /\b(?:transition(?:ing)?|moving|switching|pivot(?:ing)?|shift(?:ing)?)\s+(?:from|out\s+of|into)\s+\w+(?:\s+\w+){0,3}\s+(?:to|into)\s+\w+/i,
  /\b(?:career\s+(?:change|switch|pivot|transition)|domain\s+(?:change|switch|pivot)|changing\s+(?:domain|field|industry|function))\b/i,
  /\bfrom\s+(?:teaching|design|support|qa|sales|marketing|finance|consulting|operations|hr|customer\s+success)\s+to\s+(?:edtech|product|engineering|pm|data|design|marketing|sales|qa)\b/i,
  /\b(?:i\s+am|i'm|am)\s+(?:transitioning|making\s+a\s+transition|making\s+a\s+pivot|making\s+a\s+switch)\b/i,
];

export const TRANSFERABLE_SKILLS_PATTERNS: RegExp[] = [
  /\btransferable\s+skills?\b/i,
  /\b(?:my\s+)?(?:experience|background|skills?)\s+(?:translates?|maps?|carr(?:y|ies))\s+(?:over|across|directly)\b/i,
  /\b(?:adjacent|cross[-\s]?functional|cross[-\s]?domain)\s+(?:skills?|experience|expertise)\b/i,
];

export function detectDomainPivot(text: string): {
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
export const DELAYED_SALARY_PATTERNS: RegExp[] = [
  /\b(?:salary|salaries|pay(?:cheques?|checks?)?|wages?|comp(?:ensation)?)\s+(?:was|were|got|has\s+been|have\s+been|is\s+being)\s+(?:delayed|late|deferred|withheld\s+briefly)\b/i,
  /\b(?:delayed|late|deferred)\s+(?:salary|salaries|pay(?:cheques?|checks?)?|wages?|payroll)\b/i,
  /\bpayroll\s+(?:was\s+)?(?:delayed|late|deferred|inconsistent|irregular)\b/i,
  /\b(?:company|employer)\s+(?:was|has\s+been)\s+(?:delaying|withholding)\s+(?:salary|payment|pay)/i,
];

export const UNPAID_SALARY_PATTERNS: RegExp[] = [
  /\b(?:salary|salaries|wages?|pay(?:cheques?|checks?)?)\s+(?:was|were|has\s+been|have\s+been)\s+unpaid\b/i,
  /\b(?:unpaid|outstanding)\s+(?:salary|salaries|wages?|dues?|payroll|months?)\b/i,
  /\b(?:didn't|did\s+not|hasn'?t|haven'?t)\s+(?:get|receive|been\s+paid)\s+(?:salary|paid|paycheck|wages?)\s+(?:for\s+|in\s+)?(?:\d+\s+)?(?:months?|weeks?)/i,
  /\b(?:not\s+been\s+paid|haven'?t\s+been\s+paid|unpaid\s+for|owed)\s+(?:for\s+)?\d+\s+(?:months?|weeks?)/i,
];

export function detectCompensationHistoryIssue(
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
export const SERVICE_BOND_PATTERNS: RegExp[] = [
  /\bservice\s+(?:agreement|bond|commitment)\b/i,
  /\btraining\s+bond\b/i,
  /\b(?:\d+)[-\s]?(?:year|yr|years|yrs)\s+(?:bond|commitment|service\s+agreement)\b/i,
  /\bsigned?\s+a?\s+bond\b/i,
  /\bbond\s+(?:period|amount|penalty|clause|terms?)\b/i,
];

export function detectServiceBond(text: string): boolean {
  return SERVICE_BOND_PATTERNS.some((p) => p.test(text));
}

/* Phase 26 — probation-comp patterns. The probation period typically
 * carries a lower salary than post-confirmation comp; recruiters often
 * leave this implicit. Fires when probation is mentioned alongside a
 * comp/salary token, OR explicitly named as a comp period. */
export const PROBATION_COMP_PATTERNS: RegExp[] = [
  /\bprobation\s+(?:period|salary|comp(?:ensation)?|pay|ctc)\b/i,
  /\b(?:during|in)\s+probation\b/i,
  /\bpost[-\s]?(?:confirmation|probation)\s+(?:salary|comp|ctc|pay)\b/i,
  /\b(?:after|once)\s+(?:confirmation|probation)\s+(?:i|my|the)?\s*(?:salary|ctc|pay|comp)/i,
];

export function detectProbationComp(text: string): boolean {
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
export const INTERNSHIP_CONVERSION_PATTERNS: RegExp[] = [
  /\bppo\b/i,
  /\bpre[-\s]?placement\s+offer\b/i,
  /\bconvert(?:ing|ed)?\s+(?:my\s+|the\s+)?internship\b/i,
  /\binternship\s+(?:to|into)\s+full[-\s]?time\b/i,
  /\bintern(?:ed|ing)?\s+(?:with|at|for)\s+you\b/i,
  /\bi\s+(?:was|am)\s+(?:your|the)\s+intern\b/i,
  /\bintern\s+conversion\b/i,
];

export function detectInternshipConversion(text: string): boolean {
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
export const COLLEGE_TIER_1_PATTERNS: RegExp[] = [
  /\biit\s*[-(\s]?(?:bombay|delhi|madras|kanpur|kharagpur|roorkee|guwahati|hyderabad|bhilai|gandhinagar|indore|jodhpur|mandi|patna|ropar|tirupati|varanasi|bhubaneswar|dhanbad|goa|palakkad|jammu|dharwad)?[)\s]/i,
  /\b(?:iit|iisc|iiit[-\s]?(?:h|hyderabad|delhi|bangalore))\b/i,
  /\bnit\s*(?:trichy|warangal|surathkal|calicut|rourkela|allahabad|kurukshetra|nagpur)?\b/i,
  /\bbits\s+(?:pilani|hyderabad|goa|dubai)?\b/i,
  /\biim\s+(?:ahmedabad|bangalore|calcutta|kozhikode|lucknow|indore)\b/i,
  /\b(?:tier[-\s]?1|tier[-\s]?one)\s+(?:college|institute|school)\b/i,
  /\b(?:top[-\s]?tier|premier)\s+(?:college|institute|engineering\s+college)\b/i,
];
export const COLLEGE_TIER_2_PATTERNS: RegExp[] = [
  /\b(?:vit|srm|manipal|dtu|nsut|coep|pec\s+chandigarh|thapar|amity|christ|symbiosis)\b/i,
  /\b(?:tier[-\s]?2|tier[-\s]?two)\s+(?:college|institute|school)\b/i,
];
export const COLLEGE_TIER_3_PATTERNS: RegExp[] = [
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
export const EARLY_SWITCHER_PATTERNS: RegExp[] = [
  /\bfirst\s+(?:job\s+)?(?:switch|move|change|transition|jump)\b/i,
  /\b(?:switching|moving|changing)\s+(?:jobs?|companies)\s+for\s+the\s+first\s+time\b/i,
  /\b(?:i'?ve\s+been|been|after)\s+(?:at\s+\w+\s+|here\s+|with\s+\w+\s+)?(?:for\s+)?(?:about\s+|just\s+|only\s+)?(\d+)\s+(?:month|mo|months|mos|year|yr|years|yrs)\b.{0,80}\b(?:looking|switching|moving|change|want\s+to\s+(?:switch|move|leave|change))\b/i,
  /\bonly\s+(?:about\s+|just\s+)?(\d+)\s+(?:month|months|year|years|yr|yrs)\s+(?:at|in)\b.{0,40}\b(?:switching|moving|change)\b/i,
];

export function detectEarlySwitcher(text: string): boolean {
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
export const LOW_CTC_PATTERNS: RegExp[] = [
  /\b(?:my\s+(?:current\s+)?(?:salary|ctc|pay|comp(?:ensation)?))\s+(?:is\s+)?(?:low|below\s+market|under\s+market|underpaid|much\s+lower|too\s+low|on\s+the\s+lower\s+side)\b/i,
  /\b(?:i'?m|i\s+am|i\s+feel)\s+(?:underpaid|undervalued|under[-\s]?compensated|under\s+market|below\s+market)\b/i,
  /\b(?:current|prior|last)\s+(?:salary|ctc|pay|package)\s+(?:doesn'?t|does\s+not|never)\s+(?:reflect|match|capture|represent)\s+(?:my\s+)?(?:current\s+|actual\s+|real\s+)?(?:skill|skills|level|responsibilities|work|value)\b/i,
  /\b(?:underpaid\s+for|under\s+market\s+for)\s+(?:my\s+|the\s+)?(?:role|skill|work|level)\b/i,
];

export function detectLowCtcAlert(text: string): boolean {
  return LOW_CTC_PATTERNS.some((p) => p.test(text));
}

/* `priorInternshipNonConversion` — candidate did an internship at a
 * DIFFERENT company before their current/prior full-time role. The
 * internship is a credential on the resume, not a PPO conversion
 * event for this negotiation. Distinct from `internshipConversion`:
 *   - internshipConversion = "I'm your intern, converting to FT"
 *   - priorInternshipNonConversion = "I interned at Google, then joined
 *     TCS, now applying to Flipkart" */
export const PRIOR_INTERNSHIP_NONCONVERSION_PATTERNS: RegExp[] = [
  /\b(?:i\s+)?intern(?:ed|ship)\s+(?:at|with|for)\s+(?!you\b|us\b|here\b|this\s+company\b)\w+/i,
  /\b(?:summer\s+intern(?:ship)?|winter\s+intern(?:ship)?|industrial\s+trainee)\s+(?:at|with)\s+\w+/i,
  /\b(?:after\s+(?:my\s+)?internship|post[-\s]?internship)\s+(?:i\s+)?(?:joined|moved|went\s+to|started)\b/i,
  /\b(?:did|completed|finished)\s+(?:an?\s+|my\s+)?internship\s+(?:before|prior\s+to|earlier)\b/i,
];

export function detectPriorInternshipNonConversion(text: string, isConversionDetected: boolean): boolean {
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
export const SERVICE_COMPANY_PATTERNS: RegExp[] = [
  /\b(tcs|infosys|wipro|cognizant|hcl\s+(?:tech|technologies)?|tech\s+mahindra|techm|mindtree|lti|l&t\s+infotech|capgemini|accenture(?:\s+india)?|ibm\s+india|dxc|mphasis|persistent\s+systems|hexaware|coforge|birlasoft|kpit|cyient|nseit|sonata)\b/i,
  /\b(?:it[-\s]?services|service[-\s]company|service[-\s]background|services\s+side|services\s+company|services\s+firm)\b/i,
  /\b(?:from|in|at)\s+(?:a\s+)?service[-\s]?(?:based\s+)?(?:company|firm|background|side)\b/i,
];

export function detectServiceCompanyBackground(text: string): boolean {
  return SERVICE_COMPANY_PATTERNS.some((p) => p.test(text));
}

/* `compBreakupUnknown` — candidate self-states they don't know their
 * fixed/variable/CTC breakup. Common at 3-6 YoE in IT-services where
 * the offer letter shows a headline number and the structure is
 * opaque to the candidate. The recruiter should coach (state the
 * structure they would offer) rather than negotiate against unknowns. */
export const COMP_BREAKUP_UNKNOWN_PATTERNS: RegExp[] = [
  /\b(?:i\s+(?:don'?t|do\s+not)\s+know|not\s+sure(?:\s+of)?|haven'?t\s+checked|haven'?t\s+seen|need\s+to\s+(?:check|confirm|verify))\s+(?:(?:my|the|exact|exactly)\s+){0,3}(?:base|fixed|variable|breakup|break[-\s]?up|split|structure|component|breakdown|fixed[-\s/]+variable)\b/i,
  /\b(?:my\s+)?(?:base|fixed|variable|breakup|break[-\s]?up|split|structure)\s+(?:is\s+)?(?:not\s+clear|unclear|something\s+i\s+(?:would\s+)?need\s+to\s+check)\b/i,
  /\b(?:i\s+only\s+know|i\s+(?:just\s+)?know)\s+(?:the\s+)?(?:total\s+ctc|headline\s+(?:number|figure|ctc)|ctc\s+number)\b/i,
  /\b(?:don'?t|do\s+not)\s+(?:remember|recall)\s+(?:the\s+)?(?:exact\s+)?(?:base|fixed|variable|breakup|split|structure|breakdown)\b/i,
];

export function detectCompBreakupUnknown(text: string): boolean {
  return COMP_BREAKUP_UNKNOWN_PATTERNS.some((p) => p.test(text));
}

/* ─── Real-world Indian extensions (2026-05-14g) ────────────────────── */

/* `recentLayoff` — candidate was let go in a layoff / RIF / company
 * shutdown. Common 2024-2026 pattern (Byju's, Unacademy, Vedantu,
 * crypto-winter, generic edtech/startup shutdowns). Distinguished
 * from "I quit" — fires on involuntary separation cause language. */
export const RECENT_LAYOFF_PATTERNS: RegExp[] = [
  /\b(?:i\s+was|got|i\s+got|been|recently)\s+(?:laid[-\s]?off|let\s+go|made\s+redundant|impacted|affected)\b/i,
  /\b(?:layoff|lay[-\s]?off|layoffs|riff?|reduction\s+in\s+force|mass\s+layoff|workforce\s+reduction)\b/i,
  /\b(?:part\s+of\s+(?:the\s+)?(?:layoffs?|riff?|cuts?|reduction)|in\s+(?:the\s+)?(?:layoffs?|riff?))\b/i,
  /\b(?:company|startup|byju'?s?|unacademy|vedantu|udaan|cars24|ola|paytm)\s+(?:shut\s+down|shutdown|wound\s+down|went\s+under|filed\s+for\s+bankruptcy|closed\s+(?:down|operations))\b/i,
  /\b(?:my\s+)?(?:role|position|team|division|business\s+unit)\s+(?:was|got)\s+(?:eliminated|cut|shut\s+down|wound\s+down|dissolved)\b/i,
];

export function detectRecentLayoff(text: string): boolean {
  return RECENT_LAYOFF_PATTERNS.some((p) => p.test(text));
}

/* `hotDomainPremium` — candidate's role / specialty is in a hot
 * 2026 bucket commanding 30-50% premium over std SWE: AI/ML/GenAI/
 * LLM/applied-ML, Security/AppSec/InfoSec/cybersec, Quant/HFT.
 * Conservative: requires an explicit specialty mention in a
 * comp / role / experience context. The kernel's domain classifier
 * is independent — this fires when the CANDIDATE invokes the
 * specialty as a comp-justification signal. */
export const HOT_DOMAIN_PREMIUM_PATTERNS: RegExp[] = [
  /\b(?:gen[-\s]?ai|generative\s+ai|llm\s+(?:engineer|engineering|ops|infra|training|fine[-\s]?tuning)|prompt\s+engineer|foundation\s+model|rag\s+(?:engineer|pipeline)|agentic\s+(?:ai|systems?))\b/i,
  /\b(?:applied\s+ml|ml\s+(?:engineer|infra|platform|ops|research|scientist)|machine\s+learning\s+(?:engineer|scientist|infrastructure)|ai\s+(?:engineer|scientist|researcher))\b/i,
  /\b(?:appsec|app[-\s]?sec|application\s+security|security\s+engineer|infosec|cybersecurity|cyber\s+security|red\s+team|offensive\s+security|pen[-\s]?test(?:er|ing)?|cloud\s+security)\b/i,
  /\b(?:quant(?:itative)?\s+(?:researcher|developer|trader|analyst)|hft|high[-\s]?frequency\s+trading|low[-\s]?latency\s+trading|trading\s+systems)\b/i,
  /\b(?:premium\s+for|market\s+premium|skill\s+premium|domain\s+premium|specialist\s+premium)\s+(?:ai|ml|gen[-\s]?ai|security|llm|quant)\b/i,
];

export function detectHotDomainPremium(text: string): boolean {
  return HOT_DOMAIN_PREMIUM_PATTERNS.some((p) => p.test(text));
}

/* `pipDisclosed` — candidate volunteered that they are on / were on a
 * Performance Improvement Plan, or were forced out / asked to leave
 * for performance reasons. HIGH-RISK oversharing — the AI should
 * NOT pile on, should coach against further disclosure, and should
 * NOT use it to anchor down. Conservative: only fires on explicit
 * PIP / forced-exit language. */
export const PIP_DISCLOSED_PATTERNS: RegExp[] = [
  /\b(?:pip|p\.?i\.?p\.?|performance\s+improvement\s+plan)\b/i,
  /\b(?:on\s+a\s+pip|put\s+on\s+a?\s*pip|placed\s+on\s+a?\s*pip)\b/i,
  /\b(?:asked\s+to\s+leave|forced\s+(?:to\s+)?(?:resign|leave|exit)|forced\s+out|managed\s+out|pushed\s+out)\b/i,
  /\b(?:performance\s+(?:issues?|concerns?|reasons?|exit|termination))\b/i,
  /\b(?:terminated\s+for\s+performance|fired\s+for\s+performance|let\s+go\s+for\s+performance)\b/i,
];

export function detectPipDisclosed(text: string): boolean {
  return PIP_DISCLOSED_PATTERNS.some((p) => p.test(text));
}

/* `verbalOnlyOffer` — candidate states the offer is verbal / no
 * written offer letter / waiting on offer letter / promised
 * verbally. Recruiter should commit to a written-offer date and
 * spell out the terms. */
export const VERBAL_ONLY_OFFER_PATTERNS: RegExp[] = [
  /\b(?:verbal\s+(?:offer|commitment|agreement|confirmation)|offered\s+verbally|told\s+verbally|verbally\s+(?:offered|confirmed|told|promised|committed))\b/i,
  /\b(?:no\s+(?:offer\s+letter|written\s+offer|ol\b)\s+(?:yet|so\s+far)|still\s+(?:waiting|awaiting)\s+(?:for\s+)?(?:the\s+)?(?:offer\s+letter|written\s+offer|ol\b))\b/i,
  /\b(?:offer\s+letter\s+(?:is\s+)?(?:pending|not\s+(?:yet\s+)?(?:received|received\s+yet|issued)|delayed))\b/i,
  /\b(?:nothing\s+in\s+writing|haven'?t\s+(?:received|gotten|got)\s+(?:the\s+)?(?:written\s+)?(?:offer|ol\b)|need\s+(?:it|the\s+offer)\s+in\s+writing)\b/i,
];

export function detectVerbalOnlyOffer(text: string): boolean {
  return VERBAL_ONLY_OFFER_PATTERNS.some((p) => p.test(text));
}

/* `culturalJoiningConstraint` — Indian-specific joining-date
 * constraint rooted in a cultural / family event. Muhurat (auspicious
 * date), wedding, Diwali / Holi / Eid / Karva Chauth, sibling
 * wedding, family function, gruhapravesham (housewarming). The
 * recruiter should accommodate, not push back. */
export const CULTURAL_JOINING_PATTERNS: RegExp[] = [
  /\b(?:muhurat|muhurtham|muhurath|auspicious\s+(?:date|day|time))\b/i,
  /\b(?:after|post|before)\s+(?:my\s+|the\s+|sister'?s?\s+|brother'?s?\s+)?(?:wedding|marriage|engagement|reception)\b/i,
  /\b(?:my\s+|sister'?s?\s+|brother'?s?\s+|cousin'?s?\s+)?wedding\s+(?:is\s+)?(?:in|on|scheduled|coming\s+up|happening|planned)\b/i,
  /\b(?:after|post|before|around|during)\s+(?:diwali|holi|eid|onam|pongal|navratri|ganesh\s+chaturthi|durga\s+puja|christmas|new\s+year)\b/i,
  /\b(?:family\s+(?:function|event|wedding|ceremony|obligation|commitment)|gruhapravesham|housewarming|griha\s+pravesh|naming\s+ceremony)\b/i,
  /\b(?:can(?:not|'t)\s+join|unable\s+to\s+join|need\s+to\s+delay\s+joining)\s+(?:before|until|till)\s+(?:diwali|wedding|muhurat|after\s+the\s+festival)\b/i,
];

export function detectCulturalJoiningConstraint(text: string): boolean {
  return CULTURAL_JOINING_PATTERNS.some((p) => p.test(text));
}

/* ─── Senior-flow + process + long-tail (2026-05-14h) ──────────────── */

/* `peopleManagementClaimed` — candidate self-states management scope. */
export const PEOPLE_MGMT_PATTERNS: RegExp[] = [
  /\b(?:i\s+(?:lead|manage|run|head))\s+(?:a\s+)?(?:team\s+of\s+)?\d+\s+(?:engineers?|people|reports?|folks|members|developers?|designers?|analysts?|managers?)\b/i,
  /\b(?:i\s+have|managing|leading)\s+\d+\s+(?:direct\s+)?reports?\b/i,
  /\b(?:engineering\s+manager|eng\s+manager|em\b|director\s+of\s+engineering|head\s+of\s+(?:engineering|product|design|data)|senior\s+(?:engineering\s+)?manager|tech\s+lead\s+manager|tlm\b|people\s+manager|line\s+manager)\b/i,
  /\b(?:team\s+of\s+\d+|\d+\s+person\s+team|\d+[-\s]person\s+team)\b/i,
  /\b(?:managing|leading|owned)\s+(?:a\s+)?(?:team|squad|pod|tribe)\s+(?:of\s+)?(?:engineers?|people|designers?|analysts?)/i,
];
export function detectPeopleManagementClaimed(text: string): boolean {
  return PEOPLE_MGMT_PATTERNS.some((p) => p.test(text));
}

/* `mncExperience` — candidate states prior/current MNC / big-tech /
 *  GCC / large-product-company affiliation. Resume-seed wins on
 *  conflict, but stated utterances can flip the flag true on their own
 *  when no resume is available. Conservative — requires a named
 *  company or an explicit MNC/big-tech context phrase. */
export const MNC_EXPERIENCE_PATTERNS: RegExp[] = [
  /\b(?:i(?:'ve|\s+have)?\s+worked|i\s+work(?:ed)?|i'?m\s+(?:at|with)|i\s+spent|my\s+(?:current|last|previous|prior)\s+(?:role|job|company|employer)\s+(?:is|was)\s+(?:at\s+)?)\s+(?:at\s+|with\s+|@\s*|in\s+)?(?:google|alphabet|microsoft|amazon|meta|facebook|apple|netflix|adobe|salesforce|atlassian|nvidia|uber|airbnb|stripe|databricks|snowflake|servicenow|oracle|sap|ibm|intel|qualcomm|cisco|vmware|paypal|linkedin|twitter|x\s+corp|tiktok|bytedance|samsung|sony|walmart\s+labs?|target\s+tech)\b/i,
  /\b(?:i(?:'ve|\s+have)?\s+worked|i\s+work(?:ed)?|i'?m\s+(?:at|with))\s+(?:at\s+|with\s+|in\s+)?(?:flipkart|freshworks|zoho|swiggy|zomato|paytm|phonepe|razorpay|cred|byju|nykaa|mphasis|jpmc|jp\s+morgan|goldman\s+sachs|morgan\s+stanley|citi|wells\s+fargo|barclays)\b/i,
  /\b(?:worked|working|spent\s+\d+\s+(?:years?|yrs?))\s+(?:at|with|in|for)\s+(?:an?\s+)?(?:mnc|multinational|fortune\s*\d+|big[-\s]?tech|big\s+four|big\s+4|gcc|global\s+capability\s+center)\b/i,
  /\b(?:my\s+)?(?:mnc|multinational|fortune\s*\d+|big[-\s]?tech|gcc)\s+(?:background|experience|tenure|exposure)\b/i,
];
export function detectMncExperience(text: string): boolean {
  if (!text) return false;
  return MNC_EXPERIENCE_PATTERNS.some((p) => p.test(text));
}

/* `crossBorderAnchor` — candidate cites overseas TC / return-to-India. */
export const CROSS_BORDER_PATTERNS: RegExp[] = [
  /\b(?:returning|moving\s+back|coming\s+back|relocat(?:ing|ed))\s+(?:to\s+india\s+)?from\s+(?:the\s+)?(?:us|usa|united\s+states|bay\s+area|silicon\s+valley|seattle|new\s+york|sf|san\s+francisco|singapore|sg|dubai|uae|london|uk|united\s+kingdom|canada|australia|berlin|germany|netherlands|amsterdam|zurich|switzerland)\b/i,
  /\b(?:my|current|prior|last)\s+(?:tc|total\s+comp(?:ensation)?|salary|package|comp(?:ensation)?)\s+(?:is|was)\s+(?:\$|usd|sgd|gbp|eur|aed|cad|aud)\s*[\d,.]+/i,
  /\b(?:bay\s+area|silicon\s+valley|us\s+market|singapore\s+market|dubai\s+market|london\s+market)\s+(?:tc|comp|salary|package|rates?|standards?)\b/i,
  /\b(?:nri|non[-\s]resident\s+indian|h1b|h[-\s]?1b|green\s+card|ep\s+pass|employment\s+pass)\b/i,
  /\b(?:return(?:ing)?\s+to\s+india|move\s+back\s+to\s+india|coming\s+home\s+to\s+india)\b/i,
];
export function detectCrossBorderAnchor(text: string): boolean {
  return CROSS_BORDER_PATTERNS.some((p) => p.test(text));
}

/* `unvestedEquityLossClaim` — candidate cites unvested equity loss. */
export const UNVESTED_EQUITY_PATTERNS: RegExp[] = [
  /\b(?:unvested|leaving\s+behind|walking\s+away\s+from|forfeit(?:ing)?|losing)\s+(?:my\s+|the\s+)?(?:rsus?|stock|equity|options?|shares?|grant|esops?|vesting)\b/i,
  /\b(?:rsus?|stock|equity|options?|esops?)\s+(?:left|remaining|outstanding|unvested|not\s+(?:yet\s+)?vested)\b/i,
  /\b(?:underwater|out\s+of\s+the\s+money|otm)\s+(?:options?|stock|equity|grants?)\b/i,
  /\b(?:signing\s+bonus|joining\s+bonus|sign[-\s]on|sign\s+on)\s+(?:to\s+)?(?:offset|cover|make\s+up\s+for|compensate)\s+(?:the\s+)?(?:unvested|loss|equity|rsus?|stock)\b/i,
  /\b(?:make\s+(?:me\s+)?whole|whole\s+(?:me\s+)?up)\s+(?:for|on)\s+(?:the\s+)?(?:unvested|rsus?|equity|stock|grant)\b/i,
];
export function detectUnvestedEquityLossClaim(text: string): boolean {
  return UNVESTED_EQUITY_PATTERNS.some((p) => p.test(text));
}

/* `explodingOfferPressure` — another company gave a tight deadline. */
export const EXPLODING_OFFER_PATTERNS: RegExp[] = [
  /\b(?:exploding\s+offer|24[-\s]?hour\s+(?:deadline|window)|48[-\s]?hour\s+(?:deadline|window)|72[-\s]?hour\s+(?:deadline|window))\b/i,
  /\b(?:they|other\s+(?:company|recruiter|offer|firm))\s+(?:want|wants|need|needs|gave\s+me|are\s+giving\s+me|said)\s+(?:a\s+)?(?:decision|answer|response)\s+(?:in|within|by)\s+(?:\d+\s+)?(?:hours?|days?|tomorrow|tonight|end\s+of\s+(?:day|week))\b/i,
  /\b(?:decide|decision)\s+(?:by\s+)?(?:tomorrow|tonight|end\s+of\s+(?:day|week)|in\s+\d+\s+(?:hours?|days?))\b/i,
  /\b(?:pressured|pressuring|rushing|rushed)\s+(?:me\s+)?(?:to\s+)?(?:decide|accept|sign|commit)\b/i,
  /\b(?:offer\s+expires?|expires?\s+(?:in|on)|valid\s+(?:for\s+)?(?:only\s+)?(?:\d+\s+)?(?:hours?|days?))\b/i,
];
export function detectExplodingOfferPressure(text: string): boolean {
  return EXPLODING_OFFER_PATTERNS.some((p) => p.test(text));
}

/* `postAcceptanceRenege` — candidate has reneged before or is now. */
export const POST_ACCEPTANCE_RENEGE_PATTERNS: RegExp[] = [
  /\b(?:accepted\s+(?:another\s+offer\s+)?(?:then|but)\s+(?:reneged|backed\s+out|changed\s+my\s+mind|declined|reneg(?:ed|ing)))\b/i,
  /\b(?:renege|reneged|reneging|back\s+out\s+of|backed\s+out\s+of|backing\s+out\s+of|pulling\s+out\s+of)\s+(?:an?\s+|the\s+)?(?:offer|acceptance|commitment)\b/i,
  /\b(?:dropping|drop|ghost(?:ing|ed)?)\s+(?:another\s+offer|previously\s+accepted\s+offer|the\s+previous\s+offer)\b/i,
  /\b(?:already\s+(?:accepted|signed)\s+(?:another|a\s+different)\s+offer\s+(?:but|and\s+now))\b/i,
  /\b(?:bait\s+and\s+switch|reneged\s+on|broke\s+(?:my\s+|the\s+)?commitment)\b/i,
];
export function detectPostAcceptanceRenege(text: string): boolean {
  return POST_ACCEPTANCE_RENEGE_PATTERNS.some((p) => p.test(text));
}

/* `quotaAttainmentClaimed` — sales candidate cites attainment metric. */
export const QUOTA_ATTAINMENT_PATTERNS: RegExp[] = [
  /\b(?:hit|achieved|attained|exceeded|crushed|beat|delivered)\s+\d{2,3}\s*%\s+(?:of\s+)?(?:my\s+|the\s+)?(?:quota|target|number|plan)\b/i,
  /\b\d{2,3}\s*%\s+(?:quota|target|attainment|of\s+plan|to\s+quota|to\s+target)\b/i,
  /\b(?:president'?s?\s+club|club\s+winner|top\s+performer|top\s+(?:\d+\s*%|quartile|decile)|rep\s+of\s+the\s+(?:year|quarter))\b/i,
  /\b(?:quota\s+attainment|attainment\s+(?:of|was|is)|quota[-\s]carrying)\b/i,
  /\b(?:closed|booked|brought\s+in|generated)\s+(?:\$|usd|inr|₹|rs\.?)\s*[\d,.]+\s*(?:m|mn|million|cr|crore|lakhs?|l|k)\s+(?:in\s+)?(?:arr|bookings|revenue|pipeline|deals?)/i,
];
export function detectQuotaAttainmentClaimed(text: string): boolean {
  return QUOTA_ATTAINMENT_PATTERNS.some((p) => p.test(text));
}

/* `gardenLeaveDisclosed` — candidate is on / will be on garden leave. */
export const GARDEN_LEAVE_PATTERNS: RegExp[] = [
  /\bgarden(?:ing)?\s+leave\b/i,
  /\b(?:on\s+|in\s+)?(?:paid\s+leave|paid\s+notice|paid\s+sit[-\s]out)\s+(?:period|between\s+jobs|until|till)\b/i,
  /\b(?:asked|told|forced)\s+to\s+(?:sit\s+out|stay\s+home|not\s+work)\s+(?:my\s+|the\s+)?notice\b/i,
];
export function detectGardenLeaveDisclosed(text: string): boolean {
  return GARDEN_LEAVE_PATTERNS.some((p) => p.test(text));
}

/* `nonCompeteFlagged` — current contract has restrictive covenant. */
export const NON_COMPETE_PATTERNS: RegExp[] = [
  /\b(?:non[-\s]?compete(?:\s+clause|\s+agreement)?|nca\b|restrictive\s+covenant|restraint\s+of\s+trade)\b/i,
  /\b(?:non[-\s]?solicit(?:ation)?(?:\s+clause)?|cannot\s+join\s+competitors?|restricted\s+from\s+(?:joining|working\s+with))\b/i,
  /\b(?:competitor\s+list|competing\s+(?:companies|firms|employers))\s+(?:clause|in\s+(?:my\s+)?contract)\b/i,
];
export function detectNonCompeteFlagged(text: string): boolean {
  return NON_COMPETE_PATTERNS.some((p) => p.test(text));
}

/* `relocationBonusAsked` — candidate asks about relo package. */
export const RELOCATION_PATTERNS: RegExp[] = [
  /\b(?:relocation|relo|moving|move)\s+(?:bonus|allowance|package|assistance|support|reimbursement|expenses?)\b/i,
  /\b(?:cover|reimburse|pay\s+for)\s+(?:my\s+|the\s+)?(?:moving|relocation|move)\s+(?:cost|expense|charges)/i,
  /\b(?:relocating|moving)\s+(?:to|from)\s+(?:bangalore|bengaluru|hyderabad|pune|gurgaon|gurugram|noida|chennai|mumbai|delhi|kolkata|kochi|ahmedabad)\b.{0,80}\b(?:bonus|allowance|package|support|cover)/i,
];
export function detectRelocationBonusAsked(text: string): boolean {
  return RELOCATION_PATTERNS.some((p) => p.test(text));
}

/* ─── Wave-2 (2026-05-14i) — 20 deeper Indian-market signals ──────── */

/* Wave-2A — parent / family insurance ask. */
export const PARENT_INSURANCE_PATTERNS: RegExp[] = [
  /\b(?:parents?|family|in[-\s]?laws?|spouse|dependents?)\s+(?:insurance|medical|mediclaim|health\s+cover|coverage|floater)\b/i,
  /\b(?:medical|insurance|mediclaim|health\s+cover|floater)\s+(?:for|cover(?:ing|s)?|include[ds]?)\s+(?:my\s+)?(?:parents?|family|in[-\s]?laws?|spouse|dependents?)\b/i,
  /\b(?:does\s+(?:the\s+)?(?:medical|insurance|mediclaim|cover)|insurance\s+sum\s+insured|sum\s+insured|family\s+floater\s+amount)\b/i,
  /\b(?:opd|out[-\s]?patient)\s+(?:cover(?:age)?|benefit|reimbursement)\b/i,
  /\b(?:cover|covering|include|including)\s+(?:my\s+)?(?:parents?|in[-\s]?laws?|family|dependents?)\s+(?:in|under|on)\s+(?:the\s+)?(?:medical|insurance|mediclaim|floater|policy)\b/i,
  /\b(?:cover|covering|include|including)\s+(?:my\s+)?(?:parents?|in[-\s]?laws?|dependents?)\b/i,
];
export function detectParentInsuranceAsked(t: string): boolean {
  return PARENT_INSURANCE_PATTERNS.some((p) => p.test(t));
}

/* Wave-2A — in-hand / take-home / monthly net focus. */
export const INHAND_TAKEHOME_PATTERNS: RegExp[] = [
  /\b(?:in[-\s]?hand|take[-\s]?home|net\s+(?:salary|pay|monthly|in[-\s]?hand))\b/i,
  /\b(?:monthly\s+(?:in[-\s]?hand|net|take[-\s]?home|salary|deposit|credit)|per[-\s]?month\s+(?:in[-\s]?hand|net|take[-\s]?home))\b/i,
  /\b(?:what\s+(?:will|would|do)\s+(?:i|my)\s+(?:get|receive|see|take\s+home))\s+(?:in[-\s]?hand|monthly|per[-\s]?month|net)\b/i,
  /\b(?:gross\s+(?:vs\.?|versus)\s+net|ctc\s+(?:vs\.?|versus)\s+(?:in[-\s]?hand|take[-\s]?home|net))\b/i,
];
export function detectInHandTakehomeFocus(t: string): boolean {
  return INHAND_TAKEHOME_PATTERNS.some((p) => p.test(t));
}

/* Wave-2A — Return-to-Office pushback. */
export const RTO_PUSHBACK_PATTERNS: RegExp[] = [
  /\b(?:rto|return[-\s]?to[-\s]?office|return\s+to\s+office)\s+(?:mandate|policy|requirement|push|order)?\b/i,
  /\b(?:was\s+promised|told|sold)\s+(?:wfh|remote|work[-\s]?from[-\s]?home|hybrid)\b/i,
  /\b(?:forced|mandated|required|asked)\s+(?:to\s+)?(?:come\s+(?:in|back)|return\s+to\s+(?:the\s+)?office)\b/i,
  /\b(?:hybrid|3[-\s]days?\s+(?:in[-\s]?office|wfo)|office\s+\d+\s+days?)\s+(?:is|becoming|dealbreaker)\b/i,
  /\b(?:full[-\s]?time\s+(?:wfo|in[-\s]?office)|5\s+days?\s+in\s+(?:the\s+)?office)\b/i,
];
export function detectRtoPushback(t: string): boolean {
  return RTO_PUSHBACK_PATTERNS.some((p) => p.test(t));
}

/* Audit follow-up (2026-05-21) — wave-flag registry PRIMARY mode.
 * Three Wave-2A detectors register themselves with the composition seam
 * (`_candidate-profile-registry.ts`). As of the 2026-05-21 cutover,
 * extractCandidateProfile READS these flags from the registry via
 * runRegistry(text) — the legacy direct-call path was removed. The
 * `detect:` references below are now the single source of truth for
 * these three signals. The parity contract test
 * (candidateProfileRegistry.test.ts) remains in place as a regression
 * backstop against accidental drift if either path is later modified
 * independently. Six more waves to migrate after this. */
registerWaveFlag({
  name: "parentInsuranceAsked",
  waveId: "wave-2A",
  detect: detectParentInsuranceAsked,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "inHandTakehomeFocus",
  waveId: "wave-2A",
  detect: detectInHandTakehomeFocus,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "rtoPushback",
  waveId: "wave-2A",
  detect: detectRtoPushback,
  defaultValue: false,
  mergeStrategy: "or",
});

/* Audit follow-up (2026-05-21) — wave-flag registry Wave-2B SHADOW mode.
 * Five Wave-2B detectors register themselves below alongside the legacy
 * direct-call path that still lives in extractCandidateProfile. The
 * parity contract test (candidateProfileRegistry.test.ts) asserts that
 * runRegistry(text)[flag] === legacy detector(text) byte-for-byte, and
 * a NODE_ENV !== "production" runtime parity-assert in the call-site
 * surfaces drift fast in dev/CI. Once SHADOW soaks clean, a separate
 * commit will cut Wave-2B over to PRIMARY (delete the legacy calls and
 * read the values from the registry) — same pattern as Wave-2A. */
registerWaveFlag({
  name: "taxStructureAsked",
  waveId: "wave-2B",
  detect: detectTaxStructureAsked,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "bgvAnxiety",
  waveId: "wave-2B",
  detect: detectBgvAnxiety,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "esopSophisticationProbe",
  waveId: "wave-2B",
  detect: detectEsopSophisticationProbe,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "spouseJobConstraint",
  waveId: "wave-2B",
  detect: detectSpouseJobConstraint,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "agingParentCare",
  waveId: "wave-2B",
  detect: detectAgingParentCare,
  defaultValue: false,
  mergeStrategy: "or",
});

/* Audit follow-up (2026-05-22) — wave-flag registry Wave-2C SHADOW mode.
 * Five Wave-2C detectors register themselves below alongside the legacy
 * direct-call path that still lives in extractCandidateProfile. Same
 * pattern as Wave-2B: registry runs in parallel, parity contract test
 * (candidateProfileRegistry.test.ts) asserts byte-for-byte equivalence,
 * and a NODE_ENV !== "production" runtime parity-assert in the call-site
 * surfaces drift fast in dev/CI. Cutover to PRIMARY is a separate commit
 * after the soak window. */
registerWaveFlag({
  name: "moonlightingDisclosed",
  waveId: "wave-2C",
  detect: detectMoonlightingDisclosed,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "mentalHealthDisclosed",
  waveId: "wave-2C",
  detect: detectMentalHealthDisclosed,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "payParityAsked",
  waveId: "wave-2C",
  detect: detectPayParityAsked,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "preemptiveCounterReceived",
  waveId: "wave-2C",
  detect: detectPreemptiveCounterReceived,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "acceptanceTimeRequest",
  waveId: "wave-2C",
  detect: detectAcceptanceTimeRequest,
  defaultValue: false,
  mergeStrategy: "or",
});

/* Audit follow-up (2026-05-22) — wave-flag registry Wave-2D SHADOW mode.
 * Five Wave-2D detectors register themselves below alongside the legacy
 * direct-call path that still lives in extractCandidateProfile. Same
 * pattern as Wave-2B/2C: registry runs in parallel, parity contract test
 * (candidateProfileRegistry.test.ts) asserts byte-for-byte equivalence,
 * and a NODE_ENV !== "production" runtime parity-assert in the call-site
 * surfaces drift fast in dev/CI. Cutover to PRIMARY is a separate commit
 * after the soak window. */
registerWaveFlag({
  name: "cryptoTokenComp",
  waveId: "wave-2D",
  detect: detectCryptoTokenComp,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "gccArbitrageAnchor",
  waveId: "wave-2D",
  detect: detectGccArbitrageAnchor,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "benchTimeDisclosed",
  waveId: "wave-2D",
  detect: detectBenchTimeDisclosed,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "founderSecondInnings",
  waveId: "wave-2D",
  detect: detectFounderSecondInnings,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "latecareerAgeBias",
  waveId: "wave-2D",
  detect: detectLatecareerAgeBias,
  defaultValue: false,
  mergeStrategy: "or",
});

/* Wave-2A — returnship from maternity. */
export const RETURNSHIP_MATERNITY_PATTERNS: RegExp[] = [
  /\b(?:returning|coming\s+back|getting\s+back)\s+(?:to\s+work\s+)?(?:after|from|post)\s+(?:my\s+)?(?:maternity|parental|child\s+care|baby)\b/i,
  /\b(?:maternity|parental)\s+(?:break|gap|leave|hiatus)\s+(?:of\s+|for\s+)?(\d+\s+)?(?:months?|years?)?\b/i,
  /\b(?:returnship|return[-\s]ship|return\s+to\s+work)\s+(?:program|track|cohort)?\b/i,
  /\b(?:on\s+a\s+|took\s+a\s+|had\s+a\s+)?(?:maternity|parental)\s+(?:break|sabbatical)\b/i,
];
export function detectReturnshipMaternity(t: string): boolean {
  return RETURNSHIP_MATERNITY_PATTERNS.some((p) => p.test(t));
}

/* Wave-2A — pay-band / level-range / transparency probe. */
export const PAY_BAND_PATTERNS: RegExp[] = [
  /\b(?:pay\s+band|salary\s+band|comp(?:ensation)?\s+band|band\s+(?:for\s+this\s+)?(?:level|role|grade)|level\s+(?:range|band))\b/i,
  /\b(?:top|max(?:imum)?|upper|highest)\s+(?:of\s+)?(?:the\s+)?(?:band|range|tier|level)\b/i,
  /\b(?:what'?s?\s+the\s+(?:band|range|spread|max|maximum)\s+(?:for|on)\s+(?:this|the)\s+(?:role|level|grade))\b/i,
  /\b(?:internal\s+(?:band|range|equity|parity)|pay\s+equity|outlier\s+hire|out[-\s]?of[-\s]?band)\b/i,
  /\b(?:levels\.fyi|ambitionbox|glassdoor|levels)\s+(?:data|range|estimate|says)\b/i,
];
export function detectPayBandAsked(t: string): boolean {
  return PAY_BAND_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — tax-optimal CTC restructuring ask. */
export const TAX_STRUCTURE_PATTERNS: RegExp[] = [
  /\b(?:hra|house\s+rent\s+allowance|lta|leave\s+travel\s+allowance|fbp|flexi(?:ble)?\s+benefit\s+plan|flexible\s+benefit)\b/i,
  /\b(?:80c|80d|80ccd|nps|section\s+80|tax[-\s]?saving|tax[-\s]?optim(?:al|ization|ize|izing))\s+(?:structure|component|allocation)?\b/i,
  /\b(?:meal\s+card|sodexo|telephone\s+allowance|fuel\s+allowance|driver\s+salary)\s+(?:component|reimbursement)?\b/i,
  /\b(?:old\s+regime|new\s+regime|tax\s+regime)\b/i,
  /\b(?:structure\s+(?:my\s+|the\s+)?ctc|restructure\s+(?:ctc|comp|package)|ctc\s+(?:break(?:up|down)|component\s+split))\s+(?:for\s+)?(?:tax|hra|optim)/i,
];
export function detectTaxStructureAsked(t: string): boolean {
  return TAX_STRUCTURE_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — background-verification anxiety. */
export const BGV_ANXIETY_PATTERNS: RegExp[] = [
  /\b(?:background\s+(?:check|verification|investigation)|bgv|employment\s+verification|degree\s+verification)\s+(?:concern|issue|risk|worry|anxiety|process)?\b/i,
  /\b(?:don'?t|do\s+not|please\s+don'?t)\s+(?:call|contact|reach\s+out\s+to)\s+(?:my\s+)?(?:current\s+)?(?:manager|employer|company|hr)\b/i,
  /\b(?:worried|concerned|nervous)\s+about\s+(?:the\s+)?(?:bgv|background|verification)\b/i,
  /\b(?:my\s+)?(?:degree|education|college)\s+(?:might|may|could)\s+(?:not\s+verify|fail|be\s+a\s+problem)\b/i,
  /\b(?:correspondence\s+degree|degree\s+is\s+correspondence|distance\s+education|distance[-\s]learning|fake\s+experience|inflated\s+ctc|exaggerated\s+comp)\b/i,
];
export function detectBgvAnxiety(t: string): boolean {
  return BGV_ANXIETY_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — ESOP sophistication. */
export const ESOP_SOPHISTICATION_PATTERNS: RegExp[] = [
  /\b(?:409a|four[-\s]?o[-\s]?nine[-\s]?a|fmv|fair\s+market\s+value)\b/i,
  /\b(?:strike\s+price|exercise\s+price|exercise\s+window|post[-\s]?termination\s+exercise|pte\s+window)\b/i,
  /\b(?:single[-\s]?trigger|double[-\s]?trigger|acceleration\s+(?:on\s+(?:acquisition|change\s+of\s+control)|clause))\b/i,
  /\b(?:cliff(?:\s+period)?|vesting\s+(?:schedule|cliff|cadence)|4[-\s]?year\s+vesting|monthly\s+vest)\b/i,
  /\b(?:liquidity\s+(?:event|history|program)|esop\s+buy[-\s]?back|secondary\s+(?:sale|transaction))\b/i,
  /\b(?:phantom\s+(?:stock|shares?|equity)|sar\b|stock\s+appreciation\s+rights?)\b/i,
];
export function detectEsopSophisticationProbe(t: string): boolean {
  return ESOP_SOPHISTICATION_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — spouse-job constraint. */
export const SPOUSE_JOB_PATTERNS: RegExp[] = [
  /\b(?:wife|husband|spouse|partner)\s+(?:works?|is\s+(?:working|based|employed))\s+(?:in|at|out\s+of|from)\s+\w+/i,
  /\b(?:my\s+)?(?:wife'?s?|husband'?s?|spouse'?s?|partner'?s?)\s+(?:job|work|role|company|posting|office)\b/i,
  /\b(?:dual[-\s]?career|two[-\s]?career|both\s+(?:of\s+us|working)|spouse\s+(?:can'?t|cannot)\s+(?:move|relocate))\b/i,
  /\b(?:can'?t\s+relocate|cannot\s+relocate|cant\s+move)\s+(?:because|since|as)\s+(?:my\s+)?(?:wife|husband|spouse|partner)\b/i,
];
export function detectSpouseJobConstraint(t: string): boolean {
  return SPOUSE_JOB_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — aging-parent care. */
export const AGING_PARENT_PATTERNS: RegExp[] = [
  /\b(?:aging|elderly|old(?:er)?|senior|ill|sick|unwell)\s+parents?\b/i,
  /\b(?:taking\s+care\s+of|caring\s+for|looking\s+after|need\s+to\s+be\s+near|stay\s+near)\s+(?:my\s+)?(?:parents?|mother|father|mom|dad|in[-\s]?laws?)\b/i,
  /\b(?:parents?\s+(?:are\s+)?(?:in|live\s+in|staying\s+in|based\s+in)|parents?\s+(?:health|medical|illness))\b.{0,80}\b(?:can'?t|cannot|need|stay|relocate|move|wfh|remote)/i,
  /\b(?:medical\s+emergency\s+at\s+home|family\s+health\s+(?:situation|emergency)|parent'?s?\s+surgery)\b/i,
];
export function detectAgingParentCare(t: string): boolean {
  return AGING_PARENT_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — moonlighting disclosure. */
export const MOONLIGHTING_PATTERNS: RegExp[] = [
  /\b(?:moonlight(?:ing)?|dual\s+employment|second\s+job|side\s+job|side\s+income)\b/i,
  /\b(?:youtube\s+channel|content\s+creation|teaching\s+(?:on\s+the\s+side|online)|freelance\s+(?:on\s+side|side\s+work)|consulting\s+(?:on\s+side|on\s+the\s+side))\b/i,
  /\b(?:can\s+i\s+(?:keep|continue)|allowed\s+to\s+(?:keep|continue|work\s+on))\s+(?:my\s+)?(?:side[-\s]?(?:project|hustle|gig|business)|other\s+(?:work|job))\b/i,
  /\b(?:do\s+you\s+allow|policy\s+on)\s+(?:moonlight(?:ing)?|side[-\s]?(?:gigs?|hustle|work)|dual\s+employment)\b/i,
];
export function detectMoonlightingDisclosed(t: string): boolean {
  return MOONLIGHTING_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — mental-health / burnout disclosure. */
export const MENTAL_HEALTH_PATTERNS: RegExp[] = [
  /\b(?:mental\s+health|burnout|burn[-\s]?out|anxiety|depression|panic\s+(?:attacks?|disorder))\b/i,
  /\b(?:therapy|therapist|counsell?or|counsell?ing|psychiatrist|psychologist)\s+(?:sessions?|reimbursement|cover|benefit)?\b/i,
  /\b(?:eap|employee\s+assistance\s+program|mental\s+wellness|wellness\s+leave|mental\s+health\s+day)\b/i,
  /\b(?:taking\s+(?:a\s+)?(?:break|time\s+off|leave)\s+for\s+mental\s+health|on\s+leave\s+for\s+(?:burnout|mental\s+health))\b/i,
];
export function detectMentalHealthDisclosed(t: string): boolean {
  return MENTAL_HEALTH_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — pay-parity / DEI ask. */
export const PAY_PARITY_PATTERNS: RegExp[] = [
  /\b(?:pay\s+(?:parity|equity|gap|audit|transparency)|gender\s+pay\s+(?:gap|parity)|equal\s+pay)\b/i,
  /\b(?:diversity\s+(?:and\s+inclusion|equity)|dei\s+(?:policy|report|metrics?)|women\s+at\s+(?:the\s+)?(?:co|company|leadership))\b/i,
  /\b(?:how\s+do\s+(?:my\s+)?(?:peers?|comparable\s+(?:men|women|hires?)|same[-\s]?level)\s+(?:get\s+paid|earn|compare))\b/i,
  /\b(?:gender\s+(?:ratio|representation|breakdown)|female\s+leadership|women\s+in\s+(?:tech|engineering|leadership))\b/i,
];
export function detectPayParityAsked(t: string): boolean {
  return PAY_PARITY_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — preemptive counter received. */
export const PREEMPTIVE_COUNTER_PATTERNS: RegExp[] = [
  /\b(?:my\s+(?:current\s+)?(?:company|employer|manager|boss|hr))\s+(?:just\s+|already\s+|recently\s+)?(?:gave|offered|made|put|matched)\s+(?:me\s+)?(?:a\s+)?(?:counter|counter[-\s]?offer|raise|hike|promotion|match)/i,
  /\b(?:counter[-\s]?offered\s+by|got\s+a\s+counter|been\s+counter[-\s]?offered)\s+(?:already|before\s+(?:resigning|leaving)|preemptively)\b/i,
  /\b(?:got\s+(?:a\s+)?promotion|got\s+(?:a\s+)?raise|salary\s+(?:was|got)\s+(?:bumped|increased|hiked))\s+(?:just|recently|last\s+(?:week|month)|to\s+keep\s+me)\b/i,
  /\b(?:they|current\s+(?:co|employer))\s+(?:are\s+)?(?:trying|attempting)\s+to\s+(?:retain|keep|hold\s+on\s+to)\s+me\b/i,
];
export function detectPreemptiveCounterReceived(t: string): boolean {
  return PREEMPTIVE_COUNTER_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — acceptance-time / decision-window request. */
export const ACCEPTANCE_TIME_PATTERNS: RegExp[] = [
  /\b(?:can\s+i\s+(?:have|get|take)|need|i'?d\s+like|give\s+me)\s+(?:about\s+|around\s+|roughly\s+)?(?:a\s+(?:few|couple)\s+(?:of\s+)?|a\s+|\d+\s+)?(?:days?|weeks?)\s+to\s+(?:decide|think|respond|consider|review)\b/i,
  /\b(?:offer\s+validity|offer\s+expir(?:y|ation)|decision\s+(?:window|timeline|deadline))\s+(?:of|is|to\s+be)\b/i,
  /\b(?:more\s+time\s+to\s+decide|some\s+time\s+to\s+(?:think|review|consider)|grace\s+period)\b/i,
  /\b(?:before\s+i\s+(?:can\s+)?(?:commit|accept|sign|respond)|need\s+(?:to|some)\s+time)\b/i,
];
export function detectAcceptanceTimeRequest(t: string): boolean {
  return ACCEPTANCE_TIME_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — crypto / token comp. */
export const CRYPTO_TOKEN_PATTERNS: RegExp[] = [
  /\b(?:crypto|bitcoin|btc|ethereum|eth|usdt|usdc|stablecoin|web3\s+token)\s+(?:comp(?:ensation)?|salary|pay(?:roll|out)?|portion|allocation|component)\b/i,
  /\b(?:token\s+(?:allocation|grant|vesting|comp)|token[-\s]?based\s+(?:comp|compensation|pay))\b/i,
  /\b(?:paid\s+in\s+(?:crypto|btc|eth|usdt|usdc|stable(?:coin)?s?|tokens?)|partial\s+(?:crypto|token)\s+payment)\b/i,
  /\b(?:vda|virtual\s+digital\s+asset|web3\s+native\s+co(?:mpany|mp)?)\b/i,
];
export function detectCryptoTokenComp(t: string): boolean {
  return CRYPTO_TOKEN_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — GCC / captive India-arbitrage anchor. */
export const GCC_PATTERNS: RegExp[] = [
  /\b(?:gcc|global\s+capability\s+cent(?:re|er)|captive\s+(?:center|centre|unit)|india\s+(?:gcc|captive))\b/i,
  /\b(?:parent\s+(?:co|company))\s+(?:is\s+)?(?:in|out\s+of|based\s+in|headquartered\s+in)\s+(?:the\s+)?(?:us|usa|uk|europe|germany|japan)\b.{0,120}\b(?:salary|comp|tc|package|parity|arbitrage|pay)\b/i,
  /\b(?:india\s+(?:cost\s+)?arbitrage|cost[-\s]?center\s+model|offshore[-\s]?onsite\s+pay\s+gap)\b/i,
  /\b(?:headquarters?\s+in\s+(?:us|usa|uk|europe))\b.{0,80}\b(?:india\s+(?:office|office\s+pays?|comp|salaries?))\b/i,
];
export function detectGccArbitrageAnchor(t: string): boolean {
  return GCC_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — bench-time disclosure (services). */
export const BENCH_TIME_PATTERNS: RegExp[] = [
  /\b(?:on\s+(?:the\s+)?bench|bench\s+(?:time|period|duration|for\s+\d+))\b/i,
  /\b(?:unallocated|between\s+projects|not\s+(?:yet\s+)?allocated)\s+(?:for\s+|to\s+a\s+)?(?:\d+\s+)?(?:months?|weeks?)?\b/i,
  /\b(?:bench\s+strength|reserves?\s+pool|talent\s+pool)\b/i,
];
export function detectBenchTimeDisclosed(t: string): boolean {
  return BENCH_TIME_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — founder / second-innings. */
export const FOUNDER_SECOND_INNINGS_PATTERNS: RegExp[] = [
  /\b(?:was|been|i'?m\s+(?:a\s+)?)\s+(?:a\s+)?(?:founder|co[-\s]?founder|ceo|chief\s+executive)\b/i,
  /\b(?:my\s+)?(?:start[-\s]?up|venture|company)\s+(?:didn'?t\s+work\s+out|shut\s+down|failed|wound\s+down|sold|exited)\b/i,
  /\b(?:i\s+took\s+|drew\s+)(?:no\s+salary|zero\s+salary|a\s+stipend|equity[-\s]?only|founder'?s?\s+salary)\b/i,
  /\b(?:second\s+innings|returning\s+to\s+(?:full[-\s]?time|fte|corporate)|leaving\s+the\s+founder\s+life)\b/i,
];
export function detectFounderSecondInnings(t: string): boolean {
  return FOUNDER_SECOND_INNINGS_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — late-career age-bias concern. */
export const LATECAREER_AGE_BIAS_PATTERNS: RegExp[] = [
  /\b(?:am\s+i\s+too\s+(?:old|senior)|too\s+senior\s+for\s+(?:this|the\s+role|the\s+team)|age\s+(?:bias|discrimination|concern))\b/i,
  /\b(?:fit\s+(?:in\s+)?with\s+(?:a\s+)?young(?:er)?\s+team|culture\s+fit\s+(?:with|in)\s+a\s+young(?:er)?\s+(?:team|culture))\b/i,
  /\b(?:i'?m\s+\d{2,3}\s+(?:years\s+old)?|over\s+\d{2,3}|(?:45|50|55|60)\+)\b.{0,80}\b(?:concern|worry|bias|too\s+old|too\s+senior)/i,
  /\b(?:experience\s+being\s+a\s+(?:liability|negative)|over[-\s]qualified\s+(?:age|tenure)|seniority\s+working\s+against)\b/i,
];
export function detectLatecareerAgeBias(t: string): boolean {
  return LATECAREER_AGE_BIAS_PATTERNS.some((p) => p.test(t));
}

