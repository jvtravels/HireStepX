/**
 * Non-salary constraints — structured capture of hard, non-comp asks that
 * materially change the recruiter's playbook (without showing up in any
 * salary number).
 *
 * Design: a single optional state field rather than 6 individual fanout
 * fields. New constraint detectors land as keys on this object; the brief-
 * injection routine emits a single bracketed advisory line when any field
 * is populated.
 *
 * Some related signals (visaSponsorshipNeed, spouseJobConstraint,
 * locationMode.relocationRefused) already live on CandidateProfileResult /
 * LocationModeResult and are NOT re-detected here — they remain canonical
 * sources. This module owns only the fields not previously captured.
 *
 * Pure; no I/O. */

export interface NonSalaryConstraints {
  /** Required number of WFH days per week (e.g. 3 for "3 days WFH"). */
  wfhDaysRequired?: number | null;
  /** Hard parent-care lock to a specific city ("can't relocate from Coimbatore — aging parents"). */
  parentCareLocationLock?: boolean;
  /** Specific office requested ("must be Bangalore-Whitefield specifically"). */
  specificOfficeLocation?: string | null;
}

const WFH_DAYS_PATTERNS: ReadonlyArray<RegExp> = [
  /\b([1-5])\s*days?\s*(?:of\s*)?(?:wfh|work\s*from\s*home|remote)/i,
  /\b(?:wfh|work\s*from\s*home|remote)\s*(?:for\s*)?([1-5])\s*days?/i,
  /\bneed\s*([1-5])\s*(?:days?|d)\s*(?:wfh|remote|home)/i,
  /\b([1-5])\s*[-/]\s*[1-5]\s*hybrid\b/i,
  /\bhybrid\s*([1-5])\s*days?\b/i,
];

const PARENT_CARE_LOCK_PATTERNS: ReadonlyArray<RegExp> = [
  /\baging\s+parents?\b/i,
  /\bcan'?t\s+(?:relocate|move|shift)\s+(?:from|out\s+of)\s+\w+\s+\b(?:because|since|—)?\s*parents?\b/i,
  /\bparents?\s+(?:need|require)\s+care\b/i,
  /\bparent[- ]care\b/i,
  /\bcaring\s+for\s+(?:my\s+)?parents?\b/i,
  /\belderly\s+parents?\s+at\s+home\b/i,
];

const SPECIFIC_OFFICE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bmust\s+be\s+([A-Z][a-z]+(?:[- ][A-Z][a-z]+){0,2})\s+(?:office|location)?\b/,
  /\bonly\s+(?:work|join)\s+(?:at|from|in)\s+([A-Z][a-z]+(?:[- ][A-Z][a-z]+){0,2})\b/,
  /\bneed\s+to\s+be\s+(?:in|at)\s+([A-Z][a-z]+(?:[- ][A-Z][a-z]+){0,2})\s+specifically\b/i,
  /\bspecifically\s+([A-Z][a-z]+(?:[- ][A-Z][a-z]+){0,2})\s+(?:office|location)\b/,
  /\b(?:Whitefield|Koramangala|HSR|Marathahalli|Hinjewadi|Powai|Andheri|Gurgaon|Noida|Indiranagar)\s+(?:specifically|only|alone)\b/i,
];

/** Extract a NonSalaryConstraints object from a free-form utterance.
 *  Returns an object whose keys are only set when the corresponding detector
 *  fires; this lets the caller merge into existing state via spread. Pure. */
export function extractNonSalaryConstraints(text: string): NonSalaryConstraints {
  const out: NonSalaryConstraints = {};
  if (!text) return out;
  for (const re of WFH_DAYS_PATTERNS) {
    const m = text.match(re);
    if (m && m[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 5) {
        out.wfhDaysRequired = n;
        break;
      }
    }
  }
  for (const re of PARENT_CARE_LOCK_PATTERNS) {
    if (re.test(text)) {
      out.parentCareLocationLock = true;
      break;
    }
  }
  for (const re of SPECIFIC_OFFICE_PATTERNS) {
    const m = text.match(re);
    if (m && m[1]) {
      out.specificOfficeLocation = m[1];
      break;
    }
  }
  return out;
}

/** Merge two constraint objects. Last-stated-wins for non-null fields,
 *  monotone-up for booleans. Pure. */
export function mergeNonSalaryConstraints(
  prev: NonSalaryConstraints | undefined | null,
  next: NonSalaryConstraints | undefined | null,
): NonSalaryConstraints {
  const a = prev ?? {};
  const b = next ?? {};
  const out: NonSalaryConstraints = { ...a };
  if (b.wfhDaysRequired != null) out.wfhDaysRequired = b.wfhDaysRequired;
  if (b.parentCareLocationLock) out.parentCareLocationLock = true;
  if (b.specificOfficeLocation != null) out.specificOfficeLocation = b.specificOfficeLocation;
  return out;
}

/** Returns true if at least one constraint field is populated. */
export function hasAnyNonSalaryConstraint(c: NonSalaryConstraints | undefined | null): boolean {
  if (!c) return false;
  return (
    c.wfhDaysRequired != null ||
    c.parentCareLocationLock === true ||
    (c.specificOfficeLocation != null && c.specificOfficeLocation !== "")
  );
}

/** Format constraints as a single human-readable advisory string for the
 *  compactTurnBrief. Returns null if no constraints fired. */
export function formatNonSalaryConstraintsBrief(
  c: NonSalaryConstraints | undefined | null,
): string | null {
  if (!hasAnyNonSalaryConstraint(c)) return null;
  const parts: string[] = [];
  if (c!.wfhDaysRequired != null) parts.push(`${c!.wfhDaysRequired} WFH days required`);
  if (c!.parentCareLocationLock) parts.push("parent-care location lock");
  if (c!.specificOfficeLocation) parts.push(`specific office: ${c!.specificOfficeLocation}`);
  return `[NON-SALARY CONSTRAINTS: ${parts.join("; ")}]`;
}
