/* Wire contract for the employer "import a job description" feature, shared by
   the /api/employer-parse-jd handler and the requirement form. Types and limits
   only, so it is safe to import from both sides. */

export type JdConfidence = "high" | "medium" | "low";
export type JdSource = "regex" | "llm" | "derived";
export type JdWorkMode = "remote" | "onsite" | "hybrid";
export type JdEmploymentType = "full-time" | "part-time" | "contract" | "internship";
export type JdSalaryType = "per-month" | "fixed" | "per-annum";

export interface JdValueMap {
  title: string;
  department: string;
  locations: string[];
  workMode: JdWorkMode;
  employmentType: JdEmploymentType;
  experience: { min: number | null; max: number | null };
  /** per-annum = whole lakhs, per-month / fixed = whole rupees (same units as the form). */
  salary: { type: JdSalaryType; min: number | null; max: number | null };
  openPositions: number;
  noticePeriodPref: string;
  skills: string[];
  responsibilities: string;
  niceToHave: string;
  preferredIndustry: string;
  preferredColleges: string[];
  targetCompanies: string[];
  perksAndBenefits: string[];
  workSchedule: string;
  durationWeeks: number;
  hoursPerWeek: number;
  description: string;
}

export type JdFieldKey = keyof JdValueMap;

export interface JdField<T> {
  value: T;
  confidence: JdConfidence;
  /** A short quote from the JD that supports the value, for the employer to check. */
  evidence: string;
  source: JdSource;
}

export type JdFields = { [K in JdFieldKey]?: JdField<JdValueMap[K]> };

export interface JdParseResponse {
  ok: true;
  fields: JdFields;
  warnings: string[];
  /** False when the language model was unavailable and only pattern matching ran. */
  llm: boolean;
  cached: boolean;
  /** Imports left today for this employer, or null when the counter is unavailable. */
  remainingToday: number | null;
}

export const JD_MIN_TEXT_CHARS = 80;
export const JD_MAX_TEXT_CHARS = 12_000;
export const JD_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const JD_DAILY_PER_EMPLOYER = 10;
