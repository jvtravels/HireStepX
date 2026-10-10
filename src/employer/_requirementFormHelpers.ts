import type { SalaryType, EmploymentType, Requirement } from "./mockData";
import type { RequirementDraft } from "./_requirementPayload";

/* Pure logic behind RequirementForm: validation, experience presets, salary
   unit conversion and draft (de)serialisation. Limits mirror the server
   validators in server-handlers/_employer-requirements-helpers.ts, which
   silently drop out-of-range values, so the form has to enforce them first. */

export const MIN_DESCRIPTION_LENGTH = 20;
export const MAX_DESCRIPTION_LENGTH = 5000;
export const MAX_LONG_TEXT_LENGTH = 2000;
export const MAX_EXPERIENCE_YEARS = 40;

export const SALARY_LIMITS: Record<SalaryType, number> = {
  "per-annum": 1000,
  "per-month": 1_00_00_000,
  fixed: 1_00_00_000,
};

export type FormStep = 1 | 2 | 3;

export const STEP_LABELS: Record<FormStep, string> = {
  1: "Role basics",
  2: "Requirements and pay",
  3: "Candidate targeting",
};

export type FieldKey =
  | "title" | "locations" | "openPositions" | "durationWeeks" | "hoursPerWeek" | "dueDate"
  | "experience" | "budget" | "description" | "minStarCompleteness";

/** Which wizard step owns each validated field. */
export const FIELD_STEP: Record<FieldKey, FormStep> = {
  title: 1, locations: 1, openPositions: 1, durationWeeks: 1, hoursPerWeek: 1, dueDate: 1,
  experience: 2, budget: 2, description: 2,
  minStarCompleteness: 3,
};

/** DOM id of the first control to focus for each field's error. */
export const FIELD_FOCUS_ID: Record<FieldKey, string> = {
  title: "rf-title", locations: "rf-locations", openPositions: "rf-open", durationWeeks: "rf-weeks", hoursPerWeek: "rf-hours",
  dueDate: "rf-due", experience: "rf-exp-min", budget: "rf-budget-min", description: "rf-description", minStarCompleteness: "rf-star",
};

export type FormErrors = Partial<Record<FieldKey, string>>;

const WHOLE = /^\d+$/;
const isBlank = (v: string) => v.trim() === "";

export const digitsOnly = (v: string, maxDigits = 9): string => v.replace(/\D/g, "").slice(0, maxDigits);

/** Contract, part-time and internship roles carry a duration and weekly hours. */
export const needsDuration = (type: EmploymentType): boolean => type !== "full-time";

function validateRange(minRaw: string, maxRaw: string, limit: number, noun: string, unit: string): string | undefined {
  const min = isBlank(minRaw) ? null : minRaw.trim();
  const max = isBlank(maxRaw) ? null : maxRaw.trim();
  for (const v of [min, max]) {
    if (v !== null && !WHOLE.test(v)) return `${noun} must be a whole number.`;
    if (v !== null && Number(v) > limit) return `${noun} can't be more than ${limit.toLocaleString("en-IN")} ${unit}.`;
  }
  if (min !== null && max !== null && Number(min) > Number(max)) return `Minimum ${noun.toLowerCase()} can't be higher than the maximum.`;
  return undefined;
}

/** `savedDueDate` is the deadline already stored on a requirement being edited:
 *  keeping an expired deadline untouched must not block saving other fields. */
export function validateDraft(d: RequirementDraft, today: string, savedDueDate?: string | null): FormErrors {
  const e: FormErrors = {};
  if (d.title.trim().length < 2) e.title = "Enter a job title.";
  if (d.locations.length === 0) e.locations = "Add at least one location, or \"Remote\".";

  const desc = d.description.trim().length;
  if (desc === 0) e.description = `Add a description of at least ${MIN_DESCRIPTION_LENGTH} characters.`;
  else if (desc < MIN_DESCRIPTION_LENGTH) e.description = `Add ${MIN_DESCRIPTION_LENGTH - desc} more characters so we can match candidates well.`;

  const exp = validateRange(d.experienceMin, d.experienceMax, MAX_EXPERIENCE_YEARS, "Experience", "years");
  if (exp) e.experience = exp;

  const unit = d.salaryType === "per-annum" ? "LPA" : "rupees";
  const pay = validateRange(d.budgetMin, d.budgetMax, SALARY_LIMITS[d.salaryType], "Salary", unit);
  if (pay) e.budget = pay;

  if (!isBlank(d.openPositions) && (!WHOLE.test(d.openPositions.trim()) || Number(d.openPositions) < 1 || Number(d.openPositions) > 500)) {
    e.openPositions = "Enter a number from 1 to 500.";
  }
  if (needsDuration(d.employmentType)) {
    if (!isBlank(d.durationWeeks) && (!WHOLE.test(d.durationWeeks.trim()) || Number(d.durationWeeks) < 1 || Number(d.durationWeeks) > 104)) {
      e.durationWeeks = "Enter a whole number of weeks, from 1 to 104.";
    }
    if (!isBlank(d.hoursPerWeek) && (!WHOLE.test(d.hoursPerWeek.trim()) || Number(d.hoursPerWeek) < 1 || Number(d.hoursPerWeek) > 80)) {
      e.hoursPerWeek = "Enter hours from 1 to 80.";
    }
  }
  if (d.dueDate && d.dueDate < today && d.dueDate !== savedDueDate) e.dueDate = "The deadline can't be in the past.";
  if (!isBlank(d.minStarCompleteness) && (!WHOLE.test(d.minStarCompleteness.trim()) || Number(d.minStarCompleteness) > 100)) {
    e.minStarCompleteness = "Enter a percentage from 0 to 100.";
  }
  return e;
}

/** Errors belonging to one step, in on-screen order. */
export function errorsForStep(errors: FormErrors, step: FormStep): [FieldKey, string][] {
  return (Object.keys(FIELD_FOCUS_ID) as FieldKey[])
    .filter((k) => errors[k] && FIELD_STEP[k] === step)
    .map((k) => [k, errors[k] as string]);
}

export function allErrors(errors: FormErrors): [FieldKey, string][] {
  return ([1, 2, 3] as FormStep[]).flatMap((s) => errorsForStep(errors, s));
}

/* ── Experience ── */

export interface ExperiencePreset {
  label: string;
  min: string;
  max: string;
}

export const EXPERIENCE_PRESETS: ExperiencePreset[] = [
  { label: "Fresher", min: "0", max: "1" },
  { label: "1 to 3 yrs", min: "1", max: "3" },
  { label: "3 to 5 yrs", min: "3", max: "5" },
  { label: "5 to 8 yrs", min: "5", max: "8" },
  { label: "8 to 12 yrs", min: "8", max: "12" },
  { label: "12+ yrs", min: "12", max: "" },
];

export const presetIsActive = (p: ExperiencePreset, min: string, max: string): boolean =>
  p.min === min.trim() && p.max === max.trim();

export function describeExperience(minRaw: string, maxRaw: string): string {
  const min = minRaw.trim();
  const max = maxRaw.trim();
  if (!min && !max) return "Any experience level";
  if (min && max) return min === max ? `${min} ${min === "1" ? "year" : "years"}` : `${min} to ${max} years`;
  if (min) return `${min}+ years`;
  return `Up to ${max} ${max === "1" ? "year" : "years"}`;
}

/* ── Salary ── */

const LAKH = 1_00_000;

/** Converts a salary bound when the unit changes. Annual figures are whole
 *  lakhs (the server only stores integers), monthly ones round to ₹1,000. */
export function convertBudget(value: string, from: SalaryType, to: SalaryType): string {
  const v = value.trim();
  if (!v || !WHOLE.test(v) || from === to) return v;
  const n = Number(v);
  if (from === "per-annum") return String(Math.round((n * LAKH) / 12 / 1000) * 1000);
  if (to === "per-annum") return String(Math.min(SALARY_LIMITS["per-annum"], Math.max(1, Math.round((n * 12) / LAKH))));
  return v;
}

export const formatInr = (n: number): string => `₹${n.toLocaleString("en-IN")}`;

/** Plain-language read-back, e.g. "₹12,00,000 to ₹18,00,000 a year". */
export function describeSalary(minRaw: string, maxRaw: string, type: SalaryType): string | null {
  const min = WHOLE.test(minRaw.trim()) ? Number(minRaw) : null;
  const max = WHOLE.test(maxRaw.trim()) ? Number(maxRaw) : null;
  if (min === null && max === null) return null;
  const scale = type === "per-annum" ? LAKH : 1;
  const suffix = type === "per-annum" ? "a year" : type === "per-month" ? "a month" : "fixed";
  const lo = min !== null ? formatInr(min * scale) : null;
  const hi = max !== null ? formatInr(max * scale) : null;
  if (lo && hi) return min === max ? `${lo} ${suffix}` : `${lo} to ${hi} ${suffix}`;
  return lo ? `From ${lo} ${suffix}` : `Up to ${hi} ${suffix}`;
}

/* ── Drafts ── */

export function initialDraft(initial?: Requirement): RequirementDraft {
  const n = (v: number | null | undefined) => (v != null ? String(v) : "");
  return {
    title: initial?.title ?? "",
    department: initial?.department ?? "",
    locations: initial?.locations ?? [],
    noticePeriodPref: normalizeNoticePeriod(initial?.noticePeriodPref ?? "Any"),
    description: initial?.description ?? "",
    experienceMin: n(initial?.experienceMin),
    experienceMax: n(initial?.experienceMax),
    dueDate: initial?.dueDate ?? "",
    budgetMin: n(initial?.budgetMin),
    budgetMax: n(initial?.budgetMax),
    openPositions: initial ? n(initial.openPositions) : "1",
    workMode: initial?.workMode ?? "remote",
    employmentType: initial?.employmentType ?? "full-time",
    skills: initial?.skills ?? [],
    customSkillSets: initial?.customSkillSets ?? [],
    responsibilities: initial?.responsibilities ?? "",
    niceToHave: initial?.niceToHave ?? "",
    preferredIndustry: initial?.preferredIndustry ?? "",
    preferredColleges: initial?.preferredColleges ?? [],
    targetCompanies: initial?.targetCompanies ?? [],
    perksAndBenefits: initial?.perksAndBenefits ?? [],
    salaryType: initial?.salaryType ?? "per-annum",
    preferredDomain: initial?.preferredDomain ?? "",
    workSchedule: initial?.workSchedule ?? "",
    availability: initial?.availability ?? "",
    relevantExperience: initial?.relevantExperience ?? "",
    portfolioRequired: initial?.portfolioRequired ?? false,
    durationWeeks: n(initial?.durationWeeks),
    hoursPerWeek: n(initial?.hoursPerWeek),
    minReadinessBand: initial?.minReadinessBand ?? "",
    minStarCompleteness: n(initial?.minStarCompleteness),
  };
}

/** True when any "advanced matching" field already has a value, so the
 *  section opens by default instead of hiding data the employer set. */
export function hasAdvancedValues(d: RequirementDraft): boolean {
  return Boolean(
    d.preferredIndustry || d.preferredDomain || d.workSchedule || d.availability || d.relevantExperience ||
    d.portfolioRequired || d.minReadinessBand || d.minStarCompleteness || d.customSkillSets.length,
  );
}

export const NOTICE_PERIOD_OPTIONS = ["Any", "Immediate", "Immediate to 15 days", "Up to 30 days", "Up to 60 days", "Up to 90 days"];

/* Older requirements stored en-dash labels; map them onto the current options. */
const LEGACY_NOTICE: Record<string, string> = {
  "Immediate–30 days": "Up to 30 days",
  "30 days": "Up to 30 days",
  "60 days": "Up to 60 days",
};
export const normalizeNoticePeriod = (v: string): string => LEGACY_NOTICE[v] ?? v;

/* ── Local draft storage (create mode) ── */

export const DRAFT_STORAGE_KEY = "hsx-employer-requirement-draft-v1";

export interface StoredDraft {
  savedAt: number;
  draft: RequirementDraft;
}

export function parseStoredDraft(raw: string | null): StoredDraft | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const { savedAt, draft } = parsed as { savedAt?: unknown; draft?: unknown };
    if (typeof savedAt !== "number" || !draft || typeof draft !== "object") return null;
    // Merge over a blank draft so a draft saved by an older build never
    // leaves a field undefined.
    const merged = { ...initialDraft(), ...(draft as Partial<RequirementDraft>) };
    return { savedAt, draft: merged };
  } catch {
    return null;
  }
}

/** A draft is worth offering back only when the user actually typed something. */
export function isDraftMeaningful(d: RequirementDraft): boolean {
  return Boolean(d.title.trim() || d.description.trim() || d.locations.length || d.skills.length);
}
