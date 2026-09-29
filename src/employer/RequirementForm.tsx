"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WorkMode, EmploymentType, SalaryType, Requirement, RequirementFormValues } from "./mockData";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import {
  AutocompleteInput,
  Checkbox,
  Eyebrow,
  FieldLabel,
  FormSection,
  HelpText,
  OutlineCta,
  PrimaryCta,
  SegmentedControl,
  TagAutocompleteInput,
  TagInput,
} from "@/employer/_atoms";
import { CITY_SUGGESTIONS } from "../../data/city-tiers";
import { COMPANY_SUGGESTIONS, ROLE_SUGGESTIONS } from "@/onboardingData";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${t.line}`,
  fontFamily: f.sans,
  fontSize: textSize.md,
  boxSizing: "border-box",
};

/* Collapses to a single column on narrow viewports — grid2's callers sit
   inside the console's max-width-1280 card, but the card itself is used
   down to phone width, where two 1fr columns leave each input too narrow
   to type into comfortably. */
const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 20,
};

const MIN_DESCRIPTION_LENGTH = 20;

const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "Onsite" },
  { value: "hybrid", label: "Hybrid" },
];

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
];

const SALARY_TYPES: { value: SalaryType; label: string }[] = [
  { value: "per-month", label: "Per Month" },
  { value: "fixed", label: "Fixed" },
  { value: "per-annum", label: "Per Annum" },
];

/** budgetMin/budgetMax's unit and valid range depend on salaryType — LPA
    for per-annum roles, a raw INR amount for per-month/fixed ones. Mirrors
    asBoundedBudget in server-handlers/_employer-requirements-helpers.ts. */
const SALARY_UNIT: Record<SalaryType, { unitLabel: string; max: number; minPlaceholder: string; maxPlaceholder: string }> = {
  "per-annum": { unitLabel: "LPA", max: 1000, minPlaceholder: "12", maxPlaceholder: "18" },
  "per-month": { unitLabel: "₹/month", max: 1_00_00_000, minPlaceholder: "80000", maxPlaceholder: "120000" },
  fixed: { unitLabel: "₹ fixed", max: 1_00_00_000, minPlaceholder: "45000", maxPlaceholder: "60000" },
};

export type { RequirementFormValues } from "./mockData";

function StepProgress({ step }: { step: 1 | 2 }) {
  return (
    <div style={{ display: "flex", gap: 6, margin: "10px 0 20px" }}>
      {[1, 2].map((n) => (
        <div
          key={n}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 999,
            background: n <= step ? t.indigo : t.line,
          }}
        />
      ))}
    </div>
  );
}

/* Shared by the "post a new requirement" and "edit a requirement" pages.
   Create walks a 2-step wizard (Basic Information → Preferences & perks);
   edit renders every field on one flat page with a top Cancel / Save
   changes bar, matching the "Edit Opportunity" reference exactly. */
export function RequirementForm({
  mode,
  initial,
  onSubmit,
  submitError,
  setSubmitError,
}: {
  mode: "create" | "edit";
  initial?: Requirement;
  onSubmit: (values: RequirementFormValues) => Promise<boolean>;
  submitError: string | null;
  setSubmitError: (v: string | null) => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [locations, setLocations] = useState<string[]>(initial?.locations ?? []);
  const [openPositions, setOpenPositions] = useState(initial?.openPositions != null ? String(initial.openPositions) : "");
  const [workMode, setWorkMode] = useState<WorkMode>(initial?.workMode ?? "remote");
  const [employmentType, setEmploymentType] = useState<EmploymentType>(initial?.employmentType ?? "full-time");
  const [salaryType, setSalaryType] = useState<SalaryType>(initial?.salaryType ?? "per-annum");
  const [budgetMin, setBudgetMin] = useState(initial?.budgetMin != null ? String(initial.budgetMin) : "");
  const [budgetMax, setBudgetMax] = useState(initial?.budgetMax != null ? String(initial.budgetMax) : "");
  const [experienceMin, setExperienceMin] = useState(initial?.experienceMin != null ? String(initial.experienceMin) : "");
  const [experienceMax, setExperienceMax] = useState(initial?.experienceMax != null ? String(initial.experienceMax) : "");
  const [skills, setSkills] = useState<string[]>(initial?.skills ?? []);
  const [customSkillSets, setCustomSkillSets] = useState<string[]>(initial?.customSkillSets ?? []);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [responsibilities, setResponsibilities] = useState(initial?.responsibilities ?? "");
  const [niceToHave, setNiceToHave] = useState(initial?.niceToHave ?? "");

  const [preferredIndustry, setPreferredIndustry] = useState(initial?.preferredIndustry ?? "");
  const [preferredDomain, setPreferredDomain] = useState(initial?.preferredDomain ?? "");
  const [workSchedule, setWorkSchedule] = useState(initial?.workSchedule ?? "");
  const [availability, setAvailability] = useState(initial?.availability ?? "");
  const [relevantExperience, setRelevantExperience] = useState(initial?.relevantExperience ?? "");
  const [portfolioRequired, setPortfolioRequired] = useState(initial?.portfolioRequired ?? false);
  const [preferredColleges, setPreferredColleges] = useState<string[]>(initial?.preferredColleges ?? []);
  const [targetCompanies, setTargetCompanies] = useState<string[]>(initial?.targetCompanies ?? []);
  const [perksAndBenefits, setPerksAndBenefits] = useState<string[]>(initial?.perksAndBenefits ?? []);
  const [noticePeriodPref, setNoticePeriodPref] = useState(initial?.noticePeriodPref ?? "Any");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [durationWeeks, setDurationWeeks] = useState(initial?.durationWeeks != null ? String(initial.durationWeeks) : "");
  const [hoursPerWeek, setHoursPerWeek] = useState(initial?.hoursPerWeek != null ? String(initial.hoursPerWeek) : "");

  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const experienceRangeValid = !experienceMin.trim() || !experienceMax.trim() || Number(experienceMin) <= Number(experienceMax);
  const budgetRangeValid = !budgetMin.trim() || !budgetMax.trim() || Number(budgetMin) <= Number(budgetMax);
  const dueDateValid = !dueDate || dueDate >= today;

  const basicInfoValid =
    title.trim().length > 1 &&
    locations.length > 0 &&
    description.trim().length >= MIN_DESCRIPTION_LENGTH &&
    experienceRangeValid &&
    budgetRangeValid &&
    dueDateValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!basicInfoValid || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    const parsedMin = experienceMin.trim() ? Number(experienceMin) : undefined;
    const parsedMax = experienceMax.trim() ? Number(experienceMax) : undefined;
    const parsedBudgetMin = budgetMin.trim() ? Number(budgetMin) : undefined;
    const parsedBudgetMax = budgetMax.trim() ? Number(budgetMax) : undefined;
    const parsedOpenPositions = openPositions.trim() ? Number(openPositions) : undefined;
    const parsedDurationWeeks = durationWeeks.trim() ? Number(durationWeeks) : undefined;
    const parsedHoursPerWeek = hoursPerWeek.trim() ? Number(hoursPerWeek) : undefined;
    const ok = await onSubmit({
      title: title.trim(),
      locations,
      noticePeriodPref,
      description: description.trim(),
      experienceMin: Number.isFinite(parsedMin) ? parsedMin : undefined,
      experienceMax: Number.isFinite(parsedMax) ? parsedMax : undefined,
      dueDate: dueDate || undefined,
      budgetMin: Number.isFinite(parsedBudgetMin) ? parsedBudgetMin : undefined,
      budgetMax: Number.isFinite(parsedBudgetMax) ? parsedBudgetMax : undefined,
      openPositions: Number.isFinite(parsedOpenPositions) ? parsedOpenPositions : undefined,
      workMode,
      employmentType,
      skills,
      customSkillSets,
      responsibilities: responsibilities.trim() || undefined,
      niceToHave: niceToHave.trim() || undefined,
      preferredIndustry: preferredIndustry.trim() || undefined,
      preferredColleges,
      targetCompanies,
      perksAndBenefits,
      salaryType,
      preferredDomain: preferredDomain.trim() || undefined,
      workSchedule: workSchedule.trim() || undefined,
      availability: availability.trim() || undefined,
      relevantExperience: relevantExperience.trim() || undefined,
      portfolioRequired,
      durationWeeks: Number.isFinite(parsedDurationWeeks) ? parsedDurationWeeks : undefined,
      hoursPerWeek: Number.isFinite(parsedHoursPerWeek) ? parsedHoursPerWeek : undefined,
    });
    if (!ok) {
      setSubmitting(false);
      setSubmitError(mode === "create" ? "Couldn't create this requirement — please try again." : "Couldn't save changes — please try again.");
    }
  };

  const basicInfoFields = (
    <FormSection>
      <div>
        <FieldLabel required>Opportunity title</FieldLabel>
        <AutocompleteInput value={title} onChange={setTitle} placeholder="Senior Frontend Engineer" suggestions={ROLE_SUGGESTIONS} />
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel>Employment type</FieldLabel>
          <SegmentedControl options={EMPLOYMENT_TYPES} value={employmentType} onChange={setEmploymentType} />
        </div>
        <div>
          <FieldLabel>Salary type</FieldLabel>
          <SegmentedControl options={SALARY_TYPES} value={salaryType} onChange={setSalaryType} />
        </div>
      </div>

      <div>
        <div style={grid2}>
          <div>
            <FieldLabel>Minimum salary ({SALARY_UNIT[salaryType].unitLabel})</FieldLabel>
            <input type="number" min={0} max={SALARY_UNIT[salaryType].max} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder={SALARY_UNIT[salaryType].minPlaceholder} style={inputStyle} />
          </div>
          <div>
            <FieldLabel>Maximum salary ({SALARY_UNIT[salaryType].unitLabel})</FieldLabel>
            <input type="number" min={0} max={SALARY_UNIT[salaryType].max} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder={SALARY_UNIT[salaryType].maxPlaceholder} style={inputStyle} />
          </div>
        </div>
        {!budgetRangeValid && <HelpText tone="error">Minimum salary can't be greater than maximum salary.</HelpText>}
      </div>

      <div>
        <div style={grid2}>
          <div>
            <FieldLabel>Minimum experience (years)</FieldLabel>
            <input type="number" min={0} max={40} value={experienceMin} onChange={(e) => setExperienceMin(e.target.value)} placeholder="2" style={inputStyle} />
          </div>
          <div>
            <FieldLabel>Maximum experience (years)</FieldLabel>
            <input type="number" min={0} max={40} value={experienceMax} onChange={(e) => setExperienceMax(e.target.value)} placeholder="5" style={inputStyle} />
          </div>
        </div>
        {!experienceRangeValid && <HelpText tone="error">Minimum experience can't be greater than maximum experience.</HelpText>}
      </div>

      <div>
        <FieldLabel required>Location</FieldLabel>
        <TagAutocompleteInput values={locations} onChange={setLocations} placeholder="Mumbai, Bengaluru, Remote…" suggestions={CITY_SUGGESTIONS} />
        <HelpText>Add each city or "Remote" as its own tag, then press Enter.</HelpText>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel>Opportunity type</FieldLabel>
          <SegmentedControl options={WORK_MODES} value={workMode} onChange={setWorkMode} />
        </div>
        <div>
          <FieldLabel>Open positions</FieldLabel>
          <input type="number" min={1} max={500} value={openPositions} onChange={(e) => setOpenPositions(e.target.value)} placeholder="1" style={inputStyle} />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel>Duration in weeks (optional)</FieldLabel>
          <input type="number" min={1} max={104} value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} placeholder="12" style={inputStyle} />
          <HelpText>For contract or project-based roles — shown to candidates alongside the pay rate.</HelpText>
        </div>
        <div>
          <FieldLabel>Hours per week (optional)</FieldLabel>
          <input type="number" min={1} max={80} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} placeholder="20" style={inputStyle} />
        </div>
      </div>

      <div>
        <FieldLabel>Required skills</FieldLabel>
        <TagInput values={skills} onChange={setSkills} placeholder="React, TypeScript, System design…" />
      </div>

      <div>
        <FieldLabel required>Description</FieldLabel>
        <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 500))} rows={4} maxLength={500} placeholder="Paste the JD or a few lines about what you're looking for…" style={{ ...inputStyle, resize: "vertical" }} />
        <HelpText tone={description.trim().length > 0 && description.trim().length < MIN_DESCRIPTION_LENGTH ? "error" : "muted"}>
          We diff this against each candidate's resume to generate their JD-match report — at least {MIN_DESCRIPTION_LENGTH} characters. {description.length}/500
        </HelpText>
      </div>

      <div>
        <FieldLabel>Responsibilities (optional)</FieldLabel>
        <textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value.slice(0, 500))} rows={4} maxLength={500} placeholder="What will this person own day to day?" style={{ ...inputStyle, resize: "vertical" }} />
        <HelpText>{responsibilities.length}/500</HelpText>
      </div>

      <div>
        <FieldLabel>Nice to have (optional)</FieldLabel>
        <textarea value={niceToHave} onChange={(e) => setNiceToHave(e.target.value.slice(0, 500))} rows={3} maxLength={500} placeholder="Skills or experience that aren't required but would help" style={{ ...inputStyle, resize: "vertical" }} />
        <HelpText>{niceToHave.length}/500</HelpText>
      </div>

      <div>
        <FieldLabel>Custom skill sets (optional)</FieldLabel>
        <TagInput values={customSkillSets} onChange={setCustomSkillSets} placeholder="Domain-specific or bespoke skills…" />
        <HelpText>Separate from Required skills — use this for anything role-specific that doesn't fit the standard skill list.</HelpText>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel>Preferred industry (optional)</FieldLabel>
          <input value={preferredIndustry} onChange={(e) => setPreferredIndustry(e.target.value)} placeholder="Fintech, SaaS, Ecommerce…" style={inputStyle} />
        </div>
        <div>
          <FieldLabel>Preferred domain (optional)</FieldLabel>
          <input value={preferredDomain} onChange={(e) => setPreferredDomain(e.target.value)} placeholder="Payments, Growth, Platform…" style={inputStyle} />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel>Work schedule (optional)</FieldLabel>
          <input value={workSchedule} onChange={(e) => setWorkSchedule(e.target.value)} placeholder="Mon–Fri, 9 AM–6 PM" style={inputStyle} />
        </div>
        <div>
          <FieldLabel>Availability (optional)</FieldLabel>
          <input value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="Immediate, 2 weeks…" style={inputStyle} />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel>Relevant experience (optional)</FieldLabel>
          <input value={relevantExperience} onChange={(e) => setRelevantExperience(e.target.value)} placeholder="3+ years in a similar role" style={inputStyle} />
        </div>
        <div style={{ display: "flex", alignItems: "center", paddingTop: 28 }}>
          <Checkbox label="Portfolio required" checked={portfolioRequired} onChange={setPortfolioRequired} />
        </div>
      </div>
    </FormSection>
  );

  const preferencesFields = (
    <>
      <FormSection title="Candidate targeting">
        <div>
          <FieldLabel>Preferred colleges (optional)</FieldLabel>
          <TagInput values={preferredColleges} onChange={setPreferredColleges} placeholder="IIT, NIT, BITS…" />
        </div>

        <div>
          <FieldLabel>Target companies (optional)</FieldLabel>
          <TagAutocompleteInput
            values={targetCompanies}
            onChange={setTargetCompanies}
            placeholder="Companies you'd like candidates to come from"
            suggestions={COMPANY_SUGGESTIONS}
          />
        </div>
      </FormSection>

      <FormSection title="Perks & logistics">
        <div>
          <FieldLabel>Perks and benefits (optional)</FieldLabel>
          <TagInput values={perksAndBenefits} onChange={setPerksAndBenefits} placeholder="Full healthcare, Unlimited vacation…" />
        </div>

        <div style={grid2}>
          <div>
            <FieldLabel>Notice period preference</FieldLabel>
            <select value={noticePeriodPref} onChange={(e) => setNoticePeriodPref(e.target.value)} style={{ ...inputStyle, background: t.white }}>
              <option>Any</option>
              <option>Immediate</option>
              <option>Immediate–30 days</option>
              <option>30 days</option>
              <option>60 days</option>
            </select>
          </div>
          <div>
            <FieldLabel>Due date (optional)</FieldLabel>
            <input type="date" min={today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
            {dueDateValid ? (
              <HelpText>Shown on the Jobs table as a countdown so you know when to follow up.</HelpText>
            ) : (
              <HelpText tone="error">Due date can't be in the past.</HelpText>
            )}
          </div>
        </div>
      </FormSection>
    </>
  );

  if (mode === "edit") {
    return (
      <form onSubmit={handleSubmit} style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ background: t.white, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.line}`, flexWrap: "wrap", gap: 12 }}>
            <div>
              <Eyebrow tone="indigo">Edit opportunity</Eyebrow>
              <h1 style={{ fontFamily: f.sans, fontSize: 26, fontWeight: 700, color: t.coal, margin: "4px 0 0", letterSpacing: "-0.01em", lineHeight: "32px" }}>
                {initial?.title || "Edit opportunity"}
              </h1>
            </div>
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <OutlineCta onClick={() => router.back()}>Cancel</OutlineCta>
              <PrimaryCta type="submit" disabled={!basicInfoValid || submitting}>
                {submitting ? "Saving…" : "Save changes"}
              </PrimaryCta>
            </div>
          </div>
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 26 }}>
            {basicInfoFields}
            {preferencesFields}
            {submitError && <p role="alert" style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.error, margin: 0 }}>{submitError}</p>}
            <p style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, margin: 0 }}>
              Saving re-scores your shortlist against the current candidate pool. Candidates you've already unlocked stay unlocked.
            </p>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ background: t.white, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${t.line}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ fontFamily: f.sans, fontSize: 26, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "32px" }}>
                {step === 1 ? "Basic information" : "Preferences & perks"}
              </h1>
              <span style={{ fontFamily: f.mono, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: t.indigo, fontWeight: 600 }}>
                Step {step} of 2
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <OutlineCta onClick={() => router.back()}>Cancel</OutlineCta>
              {step === 1 ? (
                <PrimaryCta type="button" disabled={!basicInfoValid} onClick={() => setStep(2)}>
                  Continue
                </PrimaryCta>
              ) : (
                <PrimaryCta type="submit" disabled={submitting}>
                  {submitting ? "Posting job…" : "Post job"}
                </PrimaryCta>
              )}
            </div>
          </div>
          <StepProgress step={step} />
        </div>
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 26 }}>
          {step === 1 && basicInfoFields}
          {step === 2 && preferencesFields}

          {submitError && <p role="alert" style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.error, margin: 0 }}>{submitError}</p>}

          {step === 2 && (
            <OutlineCta onClick={() => setStep(1)}>Back</OutlineCta>
          )}
        </div>
      </div>
    </form>
  );
}
