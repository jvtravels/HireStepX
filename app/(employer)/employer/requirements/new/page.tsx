"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { WorkMode } from "@/employer/mockData";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import {
  AutocompleteInput,
  Card,
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
import { CITY_SUGGESTIONS } from "../../../../../data/city-tiers";
import { COMPANY_SUGGESTIONS, ROLE_SUGGESTIONS } from "@/onboardingData";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${t.line}`,
  fontFamily: f.sans,
  fontSize: 14,
  boxSizing: "border-box",
};

const MIN_DESCRIPTION_LENGTH = 20;

const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "Onsite" },
  { value: "hybrid", label: "Hybrid" },
];

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

export default function PostRequirementPage() {
  const { addRequirement } = useEmployerData();
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const [title, setTitle] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [openPositions, setOpenPositions] = useState("");
  const [workMode, setWorkMode] = useState<WorkMode>("remote");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [experienceMin, setExperienceMin] = useState("");
  const [experienceMax, setExperienceMax] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [responsibilities, setResponsibilities] = useState("");
  const [niceToHave, setNiceToHave] = useState("");

  const [preferredIndustry, setPreferredIndustry] = useState("");
  const [preferredColleges, setPreferredColleges] = useState<string[]>([]);
  const [targetCompanies, setTargetCompanies] = useState<string[]>([]);
  const [perksAndBenefits, setPerksAndBenefits] = useState<string[]>([]);
  const [noticePeriodPref, setNoticePeriodPref] = useState("Any");
  const [dueDate, setDueDate] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const step1Valid =
    title.trim().length > 1 && locations.length > 0 && description.trim().length >= MIN_DESCRIPTION_LENGTH;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!step1Valid || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    const parsedMin = experienceMin.trim() ? Number(experienceMin) : undefined;
    const parsedMax = experienceMax.trim() ? Number(experienceMax) : undefined;
    const parsedBudgetMin = budgetMin.trim() ? Number(budgetMin) : undefined;
    const parsedBudgetMax = budgetMax.trim() ? Number(budgetMax) : undefined;
    const parsedOpenPositions = openPositions.trim() ? Number(openPositions) : undefined;
    const id = await addRequirement({
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
      skills,
      responsibilities: responsibilities.trim() || undefined,
      niceToHave: niceToHave.trim() || undefined,
      preferredIndustry: preferredIndustry.trim() || undefined,
      preferredColleges,
      targetCompanies,
      perksAndBenefits,
    });
    if (!id) {
      setSubmitting(false);
      setSubmitError("Couldn't create this requirement — please try again.");
      return;
    }
    router.push(`/employer/requirements/${id}`);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <Eyebrow tone="indigo">New requirement · step {step} of 2</Eyebrow>
      <StepProgress step={step} />
      <h1 style={{ fontFamily: f.serif, fontSize: 28, color: t.coal, margin: "0 0 20px" }}>
        {step === 1 ? "Basic information" : "Preferences & perks"}
      </h1>
      <Card pad={24}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          {step === 1 && (
            <>
              <FormSection title="Role">
                <div>
                  <FieldLabel required>Job title</FieldLabel>
                  <AutocompleteInput value={title} onChange={setTitle} placeholder="Senior Frontend Engineer" suggestions={ROLE_SUGGESTIONS} />
                </div>

                <div>
                  <FieldLabel required>Locations</FieldLabel>
                  <TagAutocompleteInput values={locations} onChange={setLocations} placeholder="Mumbai, Bengaluru, Remote…" suggestions={CITY_SUGGESTIONS} />
                  <HelpText>Add each city or "Remote" as its own tag, then press Enter.</HelpText>
                </div>

                <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
                  <div>
                    <FieldLabel>Work mode</FieldLabel>
                    <SegmentedControl options={WORK_MODES} value={workMode} onChange={setWorkMode} />
                  </div>
                  <div style={{ width: 140 }}>
                    <FieldLabel>Open positions</FieldLabel>
                    <input type="number" min={1} max={500} value={openPositions} onChange={(e) => setOpenPositions(e.target.value)} placeholder="1" style={inputStyle} />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Compensation & experience">
                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <FieldLabel>Budget — min (LPA)</FieldLabel>
                    <input type="number" min={0} max={1000} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="12" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FieldLabel>Budget — max (LPA)</FieldLabel>
                    <input type="number" min={0} max={1000} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="18" style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <FieldLabel>Experience — min (years)</FieldLabel>
                    <input type="number" min={0} max={40} value={experienceMin} onChange={(e) => setExperienceMin(e.target.value)} placeholder="2" style={inputStyle} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <FieldLabel>Experience — max (years)</FieldLabel>
                    <input type="number" min={0} max={40} value={experienceMax} onChange={(e) => setExperienceMax(e.target.value)} placeholder="5" style={inputStyle} />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Skills & description">
                <div>
                  <FieldLabel>Skills</FieldLabel>
                  <TagInput values={skills} onChange={setSkills} placeholder="React, TypeScript, System design…" />
                </div>

                <div>
                  <FieldLabel required>Role description</FieldLabel>
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
                  <textarea value={niceToHave} onChange={(e) => setNiceToHave(e.target.value.slice(0, 500))} rows={3} maxLength={500} placeholder="Bonus skills or experience" style={{ ...inputStyle, resize: "vertical" }} />
                  <HelpText>{niceToHave.length}/500</HelpText>
                </div>
              </FormSection>

              {submitError && <p style={{ fontFamily: f.sans, fontSize: 13, color: t.error, margin: 0 }}>{submitError}</p>}

              <PrimaryCta type="button" full disabled={!step1Valid} onClick={() => setStep(2)}>
                Continue
              </PrimaryCta>
            </>
          )}

          {step === 2 && (
            <>
              <FormSection title="Candidate targeting">
                <div>
                  <FieldLabel>Preferred industry (optional)</FieldLabel>
                  <input value={preferredIndustry} onChange={(e) => setPreferredIndustry(e.target.value)} placeholder="Fintech, SaaS, Ecommerce…" style={inputStyle} />
                </div>

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
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
                  <HelpText>Shown on the Jobs table as a countdown so you know when to follow up.</HelpText>
                </div>
              </FormSection>

              {submitError && <p style={{ fontFamily: f.sans, fontSize: 13, color: t.error, margin: 0 }}>{submitError}</p>}

              <div style={{ display: "flex", gap: 12 }}>
                <OutlineCta onClick={() => setStep(1)}>Back</OutlineCta>
                <PrimaryCta type="submit" full disabled={submitting}>
                  {submitting ? "Posting job…" : "Post Job"}
                </PrimaryCta>
              </div>
            </>
          )}
        </form>
      </Card>
    </div>
  );
}
