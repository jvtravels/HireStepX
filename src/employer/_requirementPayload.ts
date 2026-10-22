import type { WorkMode, EmploymentType, SalaryType, RequirementFormValues } from "./mockData";

/** Raw editor state: text inputs stay strings until submit. */
export interface RequirementDraft {
  title: string;
  department: string;
  locations: string[];
  noticePeriodPref: string;
  description: string;
  experienceMin: string;
  experienceMax: string;
  dueDate: string;
  budgetMin: string;
  budgetMax: string;
  openPositions: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  skills: string[];
  customSkillSets: string[];
  responsibilities: string;
  niceToHave: string;
  preferredIndustry: string;
  preferredColleges: string[];
  targetCompanies: string[];
  perksAndBenefits: string[];
  salaryType: SalaryType;
  preferredDomain: string;
  workSchedule: string;
  availability: string;
  relevantExperience: string;
  portfolioRequired: boolean;
  durationWeeks: string;
  hoursPerWeek: string;
  minReadinessBand: "" | "strongHire" | "hire" | "leanHire";
  minStarCompleteness: string;
}

const text = (v: string): string | null => v.trim() || null;

const num = (v: string): number | null => {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Builds the full, explicit payload for create and edit. Every optional field
 *  is always present: a blank input becomes `null` ("clear it"), never
 *  `undefined`. JSON.stringify drops `undefined`, and the PATCH handler reads
 *  an omitted key as "keep the stored value" — so a user who deleted "SaaS"
 *  from Preferred industry used to see it come back after Save. */
export function buildRequirementPayload(d: RequirementDraft): RequirementFormValues {
  return {
    title: d.title.trim(),
    locations: d.locations,
    department: text(d.department),
    noticePeriodPref: d.noticePeriodPref,
    description: d.description.trim(),
    experienceMin: num(d.experienceMin),
    experienceMax: num(d.experienceMax),
    dueDate: d.dueDate || null,
    budgetMin: num(d.budgetMin),
    budgetMax: num(d.budgetMax),
    openPositions: num(d.openPositions),
    workMode: d.workMode,
    employmentType: d.employmentType,
    skills: d.skills,
    customSkillSets: d.customSkillSets,
    responsibilities: text(d.responsibilities),
    niceToHave: text(d.niceToHave),
    preferredIndustry: text(d.preferredIndustry),
    preferredColleges: d.preferredColleges,
    targetCompanies: d.targetCompanies,
    perksAndBenefits: d.perksAndBenefits,
    salaryType: d.salaryType,
    preferredDomain: text(d.preferredDomain),
    workSchedule: text(d.workSchedule),
    availability: text(d.availability),
    relevantExperience: text(d.relevantExperience),
    portfolioRequired: d.portfolioRequired,
    durationWeeks: num(d.durationWeeks),
    hoursPerWeek: num(d.hoursPerWeek),
    minReadinessBand: d.minReadinessBand || null,
    minStarCompleteness: num(d.minStarCompleteness),
  };
}
