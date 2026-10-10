"use client";

import { useMaxWidth } from "../hooks/useMaxWidth";
import { useEffect, useRef, useState, Dispatch, SetStateAction, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { WorkMode, EmploymentType, SalaryType, Requirement, RequirementFormValues } from "./mockData";
import { buildRequirementPayload } from "./_requirementPayload";
import DateField from "./DateField";
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
import { ROLE_SUGGESTIONS } from "@/onboardingData";
import { COMPANY_SUGGESTIONS } from "../../data/company-suggestions";

const baseInputStyle: React.CSSProperties = {
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

/* For short numeric fields (salary/experience min-max) — lets 4 fields
   share a row on wide screens instead of each pair stretching a whole
   half-width column for a 2-digit value, while still collapsing down
   on narrow viewports like grid2. */
const grid4: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
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
    <div aria-hidden="true" style={{ display: "flex", gap: 6, margin: "10px 0 0" }}>
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
/* Pinned to the top of the shell's scroll area so Save / Continue stay reachable
   on a long form. Needs the card to clip (not hide) overflow: `hidden` makes the
   card a scroll container and silently disables sticky. */
const STICKY_HEADER: CSSProperties = { position: "sticky", top: 0, zIndex: 20, background: t.white };

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
  setSubmitError: Dispatch<SetStateAction<string | null>>;
}) {
  const router = useRouter();
  const phone = useMaxWidth(768);
  // iOS zooms any focused input under 16px.
  const inputStyle: React.CSSProperties = phone ? { ...baseInputStyle, fontSize: 16 } : baseInputStyle;
  const [step, setStep] = useState<1 | 2>(1);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
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
  const [minReadinessBand, setMinReadinessBand] = useState<"" | "strongHire" | "hire" | "leanHire">(initial?.minReadinessBand ?? "");
  const [minStarCompleteness, setMinStarCompleteness] = useState(initial?.minStarCompleteness != null ? String(initial.minStarCompleteness) : "");

  const [submitting, setSubmitting] = useState(false);

  // Moving between wizard steps swaps the whole body; without this, keyboard
  // and screen-reader focus is left on a button that no longer exists.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstStepRender = useRef(true);
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [step]);

  // Local calendar date — toISOString() is UTC, which is "yesterday" for the
  // first hours of an IST morning and would let a past due date through.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const experienceRangeValid = !experienceMin.trim() || !experienceMax.trim() || Number(experienceMin) <= Number(experienceMax);
  const budgetRangeValid = !budgetMin.trim() || !budgetMax.trim() || Number(budgetMin) <= Number(budgetMax);
  const dueDateValid = !dueDate || dueDate >= today;
  const descriptionTooShort = description.trim().length > 0 && description.trim().length < MIN_DESCRIPTION_LENGTH;

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
    // Enter inside a field must not post the job from step 1.
    if (mode === "create" && step === 1) {
      setStep(2);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    const ok = await onSubmit(buildRequirementPayload({
      title, department, locations, noticePeriodPref, description, experienceMin, experienceMax, dueDate,
      budgetMin, budgetMax, openPositions, workMode, employmentType, skills, customSkillSets,
      responsibilities, niceToHave, preferredIndustry, preferredColleges, targetCompanies, perksAndBenefits,
      salaryType, preferredDomain, workSchedule, availability, relevantExperience, portfolioRequired,
      durationWeeks, hoursPerWeek, minReadinessBand, minStarCompleteness,
    }));
    if (!ok) {
      setSubmitting(false);
      // onSubmit already called setSubmitError with the server's specific
      // message when it had one; only fall back to a generic message here.
      setSubmitError((prev) => prev ?? (mode === "create" ? "Couldn't create this requirement — please try again." : "Couldn't save changes — please try again."));
    }
  };

  const missingBasics = [
    title.trim().length <= 1 && "a title",
    locations.length === 0 && "at least one location",
    description.trim().length < MIN_DESCRIPTION_LENGTH && `a description of ${MIN_DESCRIPTION_LENGTH}+ characters`,
  ].filter((m): m is string => typeof m === "string");
  const basicsHint = missingBasics.length > 0 ? (
    <HelpText live={false}>To continue, add {missingBasics.join(", ")}.</HelpText>
  ) : null;

  const basicInfoFields = (
    <FormSection>
      <div>
        <FieldLabel required htmlFor="rf-title">Opportunity title</FieldLabel>
        <AutocompleteInput id="rf-title" value={title} onChange={setTitle} placeholder="Senior Frontend Engineer" suggestions={ROLE_SUGGESTIONS} />
      </div>

      <div>
        <FieldLabel htmlFor="rf-department">Department (optional)</FieldLabel>
        <input id="rf-department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering, Sales, Design…" style={inputStyle} />
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel>Employment type</FieldLabel>
          <SegmentedControl ariaLabel="Employment type" options={EMPLOYMENT_TYPES} value={employmentType} onChange={setEmploymentType} />
        </div>
        <div>
          <FieldLabel>Salary type</FieldLabel>
          <SegmentedControl ariaLabel="Salary type" options={SALARY_TYPES} value={salaryType} onChange={setSalaryType} />
        </div>
      </div>

      <div>
        <div style={grid4}>
          <div>
            <FieldLabel htmlFor="rf-budget-min">Minimum salary ({SALARY_UNIT[salaryType].unitLabel})</FieldLabel>
            <input id="rf-budget-min" inputMode="numeric" aria-invalid={!budgetRangeValid || undefined} aria-describedby={!budgetRangeValid ? "rf-budget-err" : undefined} type="number" min={0} max={SALARY_UNIT[salaryType].max} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder={SALARY_UNIT[salaryType].minPlaceholder} style={inputStyle} />
          </div>
          <div>
            <FieldLabel htmlFor="rf-budget-max">Maximum salary ({SALARY_UNIT[salaryType].unitLabel})</FieldLabel>
            <input id="rf-budget-max" inputMode="numeric" aria-invalid={!budgetRangeValid || undefined} aria-describedby={!budgetRangeValid ? "rf-budget-err" : undefined} type="number" min={0} max={SALARY_UNIT[salaryType].max} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder={SALARY_UNIT[salaryType].maxPlaceholder} style={inputStyle} />
          </div>
          <div>
            <FieldLabel htmlFor="rf-exp-min">Minimum experience (years)</FieldLabel>
            <input id="rf-exp-min" inputMode="numeric" aria-invalid={!experienceRangeValid || undefined} aria-describedby={!experienceRangeValid ? "rf-exp-err" : undefined} type="number" min={0} max={40} value={experienceMin} onChange={(e) => setExperienceMin(e.target.value)} placeholder="2" style={inputStyle} />
          </div>
          <div>
            <FieldLabel htmlFor="rf-exp-max">Maximum experience (years)</FieldLabel>
            <input id="rf-exp-max" inputMode="numeric" aria-invalid={!experienceRangeValid || undefined} aria-describedby={!experienceRangeValid ? "rf-exp-err" : undefined} type="number" min={0} max={40} value={experienceMax} onChange={(e) => setExperienceMax(e.target.value)} placeholder="5" style={inputStyle} />
          </div>
        </div>
        {!budgetRangeValid && <HelpText id="rf-budget-err" tone="error">Minimum salary can't be greater than maximum salary.</HelpText>}
        {!experienceRangeValid && <HelpText id="rf-exp-err" tone="error">Minimum experience can't be greater than maximum experience.</HelpText>}
      </div>

      <div>
        <FieldLabel required htmlFor="rf-locations">Location</FieldLabel>
        <TagAutocompleteInput id="rf-locations" describedBy="rf-locations-help" values={locations} onChange={setLocations} placeholder="Mumbai, Bengaluru, Remote…" suggestions={CITY_SUGGESTIONS} />
        <HelpText id="rf-locations-help">Add each city or "Remote" as its own tag, then press Enter.</HelpText>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel>Opportunity type</FieldLabel>
          <SegmentedControl ariaLabel="Opportunity type" options={WORK_MODES} value={workMode} onChange={setWorkMode} />
        </div>
        <div>
          <FieldLabel htmlFor="rf-open">Open positions</FieldLabel>
          <input id="rf-open" inputMode="numeric" type="number" min={1} max={500} value={openPositions} onChange={(e) => setOpenPositions(e.target.value)} placeholder="1" style={inputStyle} />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel htmlFor="rf-weeks">Duration in weeks (optional)</FieldLabel>
          <input id="rf-weeks" inputMode="numeric" aria-describedby="rf-weeks-help" type="number" min={1} max={104} value={durationWeeks} onChange={(e) => setDurationWeeks(e.target.value)} placeholder="12" style={inputStyle} />
          <HelpText id="rf-weeks-help">For contract or project-based roles — shown to candidates alongside the pay rate.</HelpText>
        </div>
        <div>
          <FieldLabel htmlFor="rf-hours">Hours per week (optional)</FieldLabel>
          <input id="rf-hours" inputMode="numeric" type="number" min={1} max={80} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} placeholder="20" style={inputStyle} />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="rf-skills">Required skills</FieldLabel>
        <TagInput id="rf-skills" values={skills} onChange={setSkills} placeholder="React, TypeScript, System design…" />
      </div>

      <div>
        <FieldLabel required htmlFor="rf-description">Description</FieldLabel>
        <textarea id="rf-description" aria-required="true" aria-describedby="rf-description-help" aria-invalid={descriptionTooShort || undefined} value={description} onChange={(e) => setDescription(e.target.value.slice(0, 500))} rows={4} maxLength={500} placeholder="Paste the JD or a few lines about what you're looking for…" style={{ ...inputStyle, resize: "vertical" }} />
        <HelpText id="rf-description-help" live={false} tone={descriptionTooShort ? "error" : "muted"}>
          We diff this against each candidate's resume to generate their JD-match report — at least {MIN_DESCRIPTION_LENGTH} characters. {description.length}/500
        </HelpText>
      </div>

      <div>
        <FieldLabel htmlFor="rf-resp">Responsibilities (optional)</FieldLabel>
        <textarea id="rf-resp" aria-describedby="rf-resp-count" value={responsibilities} onChange={(e) => setResponsibilities(e.target.value.slice(0, 500))} rows={4} maxLength={500} placeholder="What will this person own day to day?" style={{ ...inputStyle, resize: "vertical" }} />
        <HelpText id="rf-resp-count" live={false}>{responsibilities.length}/500</HelpText>
      </div>

      <div>
        <FieldLabel htmlFor="rf-nice">Nice to have (optional)</FieldLabel>
        <textarea id="rf-nice" aria-describedby="rf-nice-count" value={niceToHave} onChange={(e) => setNiceToHave(e.target.value.slice(0, 500))} rows={3} maxLength={500} placeholder="Skills or experience that aren't required but would help" style={{ ...inputStyle, resize: "vertical" }} />
        <HelpText id="rf-nice-count" live={false}>{niceToHave.length}/500</HelpText>
      </div>

      <div>
        <FieldLabel htmlFor="rf-custom-skills">Custom skill sets (optional)</FieldLabel>
        <TagInput id="rf-custom-skills" describedBy="rf-custom-skills-help" values={customSkillSets} onChange={setCustomSkillSets} placeholder="Domain-specific or bespoke skills…" />
        <HelpText id="rf-custom-skills-help">Separate from Required skills — use this for anything role-specific that doesn't fit the standard skill list.</HelpText>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel htmlFor="rf-industry">Preferred industry (optional)</FieldLabel>
          <input id="rf-industry" value={preferredIndustry} onChange={(e) => setPreferredIndustry(e.target.value)} placeholder="Fintech, SaaS, Ecommerce…" style={inputStyle} />
        </div>
        <div>
          <FieldLabel htmlFor="rf-domain">Preferred domain (optional)</FieldLabel>
          <input id="rf-domain" value={preferredDomain} onChange={(e) => setPreferredDomain(e.target.value)} placeholder="Payments, Growth, Platform…" style={inputStyle} />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel htmlFor="rf-schedule">Work schedule (optional)</FieldLabel>
          <input id="rf-schedule" value={workSchedule} onChange={(e) => setWorkSchedule(e.target.value)} placeholder="Mon–Fri, 9 AM–6 PM" style={inputStyle} />
        </div>
        <div>
          <FieldLabel htmlFor="rf-availability">Availability (optional)</FieldLabel>
          <input id="rf-availability" value={availability} onChange={(e) => setAvailability(e.target.value)} placeholder="Immediate, 2 weeks…" style={inputStyle} />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel htmlFor="rf-relevant">Relevant experience (optional)</FieldLabel>
          <input id="rf-relevant" value={relevantExperience} onChange={(e) => setRelevantExperience(e.target.value)} placeholder="3+ years in a similar role" style={inputStyle} />
        </div>
        <div style={{ display: "flex", alignItems: "center", paddingTop: 28 }}>
          <Checkbox label="Portfolio required" checked={portfolioRequired} onChange={setPortfolioRequired} />
        </div>
      </div>

      <div style={grid2}>
        <div>
          <FieldLabel htmlFor="rf-readiness">Minimum readiness (optional)</FieldLabel>
          <select
            id="rf-readiness"
            value={minReadinessBand}
            onChange={(e) => setMinReadinessBand(e.target.value as "" | "strongHire" | "hire" | "leanHire")}
            style={{ ...inputStyle, background: t.white }}
          >
            <option value="">No minimum</option>
            <option value="leanHire">Lean hire or better</option>
            <option value="hire">Hire or better</option>
            <option value="strongHire">Strong hire only</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="rf-star">Minimum STAR completeness % (optional)</FieldLabel>
          <input
            id="rf-star"
            inputMode="numeric"
            type="number"
            min={0}
            max={100}
            value={minStarCompleteness}
            onChange={(e) => setMinStarCompleteness(e.target.value)}
            placeholder="e.g. 60"
            style={inputStyle}
          />
        </div>
      </div>
    </FormSection>
  );

  const preferencesFields = (
    <>
      <FormSection title="Candidate targeting">
        <div>
          <FieldLabel htmlFor="rf-colleges">Preferred colleges (optional)</FieldLabel>
          <TagInput id="rf-colleges" values={preferredColleges} onChange={setPreferredColleges} placeholder="IIT, NIT, BITS…" />
        </div>

        <div>
          <FieldLabel htmlFor="rf-targets">Target companies (optional)</FieldLabel>
          <TagAutocompleteInput
            id="rf-targets"
            values={targetCompanies}
            onChange={setTargetCompanies}
            placeholder="Companies you'd like candidates to come from"
            suggestions={COMPANY_SUGGESTIONS}
          />
        </div>
      </FormSection>

      <FormSection title="Perks & logistics">
        <div>
          <FieldLabel htmlFor="rf-perks">Perks and benefits (optional)</FieldLabel>
          <TagInput id="rf-perks" values={perksAndBenefits} onChange={setPerksAndBenefits} placeholder="Full healthcare, Unlimited vacation…" />
        </div>

        <div style={grid2}>
          <div>
            <FieldLabel htmlFor="rf-notice">Notice period preference</FieldLabel>
            <select id="rf-notice" value={noticePeriodPref} onChange={(e) => setNoticePeriodPref(e.target.value)} style={{ ...inputStyle, background: t.white }}>
              <option>Any</option>
              <option>Immediate</option>
              <option>Immediate–30 days</option>
              <option>30 days</option>
              <option>60 days</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="rf-due">Due date (optional)</FieldLabel>
            <DateField id="rf-due" aria-describedby="rf-due-help" aria-invalid={!dueDateValid || undefined} min={today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
            {dueDateValid ? (
              <HelpText id="rf-due-help">Shown on the Jobs table as a countdown so you know when to follow up.</HelpText>
            ) : (
              <HelpText id="rf-due-help" tone="error">Due date can't be in the past.</HelpText>
            )}
          </div>
        </div>
      </FormSection>
    </>
  );

  if (mode === "edit") {
    return (
      <form onSubmit={handleSubmit}>
        <div style={{ background: t.white, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "clip" }}>
          <div style={{ ...STICKY_HEADER, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${t.line}`, flexWrap: "wrap", gap: 12 }}>
            <div>
              <Eyebrow tone="indigo">Edit opportunity</Eyebrow>
              <h1 style={{ fontFamily: f.sans, fontSize: 26, fontWeight: 700, color: t.coal, margin: "4px 0 0", letterSpacing: "-0.01em", lineHeight: "32px" }}>
                {initial?.title || "Edit opportunity"}
              </h1>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              <OutlineCta size="sm" onClick={() => router.back()}>Cancel</OutlineCta>
              <PrimaryCta type="submit" disabled={!basicInfoValid || submitting}>
                {submitting ? "Saving…" : "Save changes"}
              </PrimaryCta>
            </div>
          </div>
          <div style={{ padding: "24px clamp(16px, 5vw, 104px)", display: "flex", flexDirection: "column", gap: 26 }}>
            {basicInfoFields}
            {preferencesFields}
            {basicsHint}
            {submitError && <p role="alert" style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.errorInk, margin: 0 }}>{submitError}</p>}
            <p style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, margin: 0 }}>
              Saving re-scores your shortlist against the current candidate pool. Candidates you've already unlocked stay unlocked.
            </p>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ background: t.white, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "clip" }}>
        <div style={{ ...STICKY_HEADER, padding: "12px 20px", borderBottom: `1px solid ${t.line}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <h1 ref={stepHeadingRef} tabIndex={-1} style={{ outline: "none", fontFamily: f.sans, fontSize: 22, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "28px" }}>
                {step === 1 ? "Basic information" : "Preferences & perks"}
              </h1>
              <span style={{ fontFamily: f.mono, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: t.indigo, fontWeight: 600 }}>
                Step {step} of 2
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
              {step === 2 && (
                <OutlineCta size="sm" onClick={() => setStep(1)}>Back</OutlineCta>
              )}
              <OutlineCta size="sm" onClick={() => router.back()}>Cancel</OutlineCta>
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
        <div style={{ padding: "24px clamp(16px, 5vw, 104px)", display: "flex", flexDirection: "column", gap: 26 }}>
          {step === 1 && basicInfoFields}
          {step === 1 && basicsHint}
          {step === 2 && preferencesFields}

          {submitError && <p role="alert" style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.errorInk, margin: 0 }}>{submitError}</p>}
        </div>
      </div>
    </form>
  );
}
