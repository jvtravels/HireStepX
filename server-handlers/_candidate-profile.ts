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

  const hasAny =
    careerGapMonths != null ||
    careerGapActivity != null ||
    tenureSignal != null ||
    levelMismatch != null ||
    domainPivot ||
    transferableSkillsClaimed ||
    compensationHistoryIssue != null;
  return {
    careerGapMonths,
    careerGapActivity,
    tenureSignal,
    levelMismatch,
    domainPivot,
    transferableSkillsClaimed,
    compensationHistoryIssue,
    hasAny,
  };
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
    hasAny: false,
  };
  merged.hasAny =
    merged.careerGapMonths != null ||
    merged.careerGapActivity != null ||
    merged.tenureSignal != null ||
    merged.levelMismatch != null ||
    merged.domainPivot ||
    merged.transferableSkillsClaimed ||
    merged.compensationHistoryIssue != null;
  return merged;
}
