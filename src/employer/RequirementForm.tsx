"use client";

import { useMaxWidth } from "../hooks/useMaxWidth";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useCallback, useEffect, useMemo, useRef, useState, Dispatch, SetStateAction, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { WorkMode, EmploymentType, Requirement, RequirementFormValues } from "./mockData";
import { buildRequirementPayload, type RequirementDraft } from "./_requirementPayload";
import DateField from "./DateField";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import {
  AutocompleteInput,
  Checkbox,
  FieldLabel,
  FormSection,
  HelpText,
  OutlineCta,
  PrimaryCta,
  SegmentedControl,
  TagAutocompleteInput,
  TagInput,
} from "@/employer/_atoms";
import { ErrorSummary, ExperienceField, NumberField, SalaryField, StepNav } from "./_requirementFields";
import {
  DRAFT_STORAGE_KEY,
  FIELD_FOCUS_ID,
  FIELD_STEP,
  MAX_DESCRIPTION_LENGTH,
  MAX_LONG_TEXT_LENGTH,
  NOTICE_PERIOD_OPTIONS,
  STEP_LABELS,
  allErrors,
  errorsForStep,
  hasAdvancedValues,
  initialDraft,
  isDraftMeaningful,
  needsDuration,
  parseStoredDraft,
  validateDraft,
  type FieldKey,
  type FormStep,
  type StoredDraft,
} from "./_requirementFormHelpers";
import { CITY_SUGGESTIONS } from "../../data/city-tiers";
import { ROLE_SUGGESTIONS } from "@/onboardingData";
import { COMPANY_SUGGESTIONS } from "../../data/company-suggestions";
import { COLLEGE_SUGGESTIONS, DOMAIN_SUGGESTIONS, INDUSTRY_SUGGESTIONS, SKILL_SUGGESTIONS } from "../../data/requirement-suggestions";

const baseInputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: `1px solid ${t.line}`,
  fontFamily: f.sans,
  fontSize: textSize.md,
  boxSizing: "border-box",
};

/* Collapses to one column on narrow viewports; two 1fr columns leave each
   input too narrow to type into comfortably on a phone. */
const grid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 20,
};

/* Fields that sit side by side when there is room and stack when there isn't.
   Each cell's flex-basis is the narrowest width it stays comfortable at. */
const flexRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "26px 20px", alignItems: "flex-start" };
const flexRowWide: CSSProperties = { ...flexRow, columnGap: 32 };
const cell = (grow: number, basis: number): CSSProperties => ({ flex: `${grow} 1 ${basis}px`, minWidth: 0 });

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

export type { RequirementFormValues } from "./mockData";

/* Shared by the "post a new requirement" and "edit a requirement" pages.
   Create walks a 3-step wizard (Role basics, Requirements and pay, Candidate
   targeting); edit renders the same three sections on one flat page with a
   top Cancel / Save changes bar. Validation is inline and on demand: nothing
   is disabled, a failed Continue/Save explains what is wrong and moves focus
   to the first problem. */

/* One white card holds the header (title, progress, actions) and the fields. The
   header is pinned to the top of the shell's scroll area so Save / Continue stay
   reachable on a long form; it paints its own white background so scrolled
   fields never show through. */
const LAST_STEP: FormStep = 2;
const ADVANCED_ID = "advanced";

const textareaStyle: CSSProperties = { resize: "vertical" };
const advancedTitle: CSSProperties = { fontFamily: f.sans, fontSize: textSize.md, fontWeight: 600, color: t.coal };
const advancedHint: CSSProperties = { fontFamily: f.sans, fontSize: textSize.base, fontWeight: 400, color: t.inkFaint };
const advancedBody: CSSProperties = { display: "flex", flexDirection: "column", gap: 20, padding: "4px 0 16px" };
const checkboxCell: CSSProperties = { display: "flex", alignItems: "flex-end", paddingBottom: 8 };
const noteText: CSSProperties = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, margin: 0 };
const requiredStar: CSSProperties = { color: t.indigo };
const bannerBox: CSSProperties = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 12, background: t.info100, border: `1px solid ${t.line}`, fontFamily: f.sans, fontSize: textSize.base, color: t.coal };
const bannerText: CSSProperties = { flex: "1 1 240px" };
const errorText: CSSProperties = { fontFamily: f.sans, fontSize: textSize.base, color: t.errorInk, margin: 0 };
const cardStyle: CSSProperties = { background: t.white, borderRadius: 12, border: `1px solid ${t.line}`, overflow: "clip" };
const actionRow: CSSProperties = { display: "flex", alignItems: "center", gap: 12, flexShrink: 0 };
const cardHeader: CSSProperties = { position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", columnGap: 28, rowGap: 10, padding: "14px 20px", background: t.white, borderBottom: `1px solid ${t.line}` };
const formTitle: CSSProperties = { outline: "none", fontFamily: f.sans, fontSize: 22, fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "28px" };
const stackedSections: CSSProperties = { display: "flex", flexDirection: "column", gap: 26 };

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
  const inputStyle: CSSProperties = phone ? { ...baseInputStyle, fontSize: 16 } : baseInputStyle;
  const selectStyle: CSSProperties = { ...inputStyle, background: t.white };
  const longTextStyle: CSSProperties = { ...inputStyle, ...textareaStyle };
  const isCreate = mode === "create";

  const [step, setStep] = useState<FormStep>(1);
  const [draft, setDraft] = useState<RequirementDraft>(() => initialDraft(initial));
  const [dirty, setDirty] = useState(false);
  const [touched, setTouched] = useState<ReadonlySet<FieldKey>>(new Set());
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(() => hasAdvancedValues(initialDraft(initial)));
  const [offer, setOffer] = useState<StoredDraft | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const submittedRef = useRef(false);
  const pendingFocus = useRef<string | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const firstStepRender = useRef(true);

  const set = useCallback(<K extends keyof RequirementDraft>(key: K, value: RequirementDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }, []);

  const touch = useCallback((k: FieldKey) => {
    setTouched((prev) => (prev.has(k) ? prev : new Set(prev).add(k)));
  }, []);

  // Local calendar date — toISOString() is UTC, which is "yesterday" for the
  // first hours of an IST morning and would let a past due date through.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const errors = useMemo(() => validateDraft(draft, today, initial?.dueDate), [draft, today, initial?.dueDate]);
  const shown = (k: FieldKey): string | undefined => (attempted || touched.has(k) ? errors[k] : undefined);
  const errId = (k: FieldKey) => `${FIELD_FOCUS_ID[k]}-err`;
  const descriptionStyle: CSSProperties = { ...longTextStyle, borderColor: shown("description") ? t.error : t.line };
  const describe = (k: FieldKey, extra?: string) => [shown(k) ? errId(k) : null, extra].filter(Boolean).join(" ") || undefined;
  const fieldError = (k: FieldKey) => {
    const msg = shown(k);
    // While the summary alert is up it already announces every problem.
    return msg ? <HelpText id={errId(k)} tone="error" live={!attempted}>{msg}</HelpText> : null;
  };

  /* ── Focus management ── */

  const focusId = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
      const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    }
  };

  const focusField = useCallback((k: FieldKey) => {
    const target = FIELD_STEP[k];
    if (k === "minStarCompleteness") setAdvancedOpen(true);
    if (isCreate && target !== step) {
      pendingFocus.current = FIELD_FOCUS_ID[k];
      setStep(target);
    } else if (k === "minStarCompleteness") {
      requestAnimationFrame(() => focusId(FIELD_FOCUS_ID[k]));
    } else {
      focusId(FIELD_FOCUS_ID[k]);
    }
  }, [isCreate, step]);

  // Moving between wizard steps swaps the whole body; without this, keyboard
  // and screen-reader focus is left on a button that no longer exists.
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    if (pendingFocus.current) {
      focusId(pendingFocus.current);
      pendingFocus.current = null;
    } else {
      stepHeadingRef.current?.focus();
    }
  }, [step]);

  /* ── Draft autosave (create only) ── */

  useEffect(() => {
    if (!isCreate) return;
    try {
      const stored = parseStoredDraft(window.localStorage.getItem(DRAFT_STORAGE_KEY));
      if (stored && isDraftMeaningful(stored.draft)) setOffer(stored);
    } catch {
      // storage can be blocked; the form works without drafts
    }
  }, [isCreate]);

  useEffect(() => {
    if (!isCreate || !dirty || offer || submittedRef.current) return;
    const id = window.setTimeout(() => {
      try {
        const at = Date.now();
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ savedAt: at, draft }));
        setSavedAt(at);
      } catch {
        // quota or blocked storage: drafts are best effort
      }
    }, 800);
    return () => window.clearTimeout(id);
  }, [draft, dirty, offer, isCreate]);

  const clearStoredDraft = () => {
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // nothing to clear
    }
  };

  // Browsers show their own generic prompt; the text is ignored but the
  // preventDefault is what triggers it.
  useEffect(() => {
    if (!dirty || submittedRef.current) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ── Navigation + submit ── */

  const leave = () => {
    // A create draft is already saved on this device; an edit has nothing saved.
    if (!isCreate && dirty && !window.confirm("Discard your changes to this requirement?")) return;
    router.back();
  };

  const goNext = () => {
    const stepErrors = errorsForStep(errors, step);
    if (stepErrors.length > 0) {
      setAttempted(true);
      focusField(stepErrors[0][0]);
      return;
    }
    setAttempted(false);
    setStep((s) => (s < LAST_STEP ? ((s + 1) as FormStep) : s));
  };

  const goTo = (s: FormStep) => {
    setAttempted(false);
    setStep(s);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (isCreate && step < LAST_STEP) {
      goNext();
      return;
    }
    const all = allErrors(errors);
    if (all.length > 0) {
      setAttempted(true);
      focusField(all[0][0]);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    const ok = await onSubmit(buildRequirementPayload({
      ...draft,
      noticePeriodPref: draft.noticePeriodPref,
      durationWeeks: needsDuration(draft.employmentType) ? draft.durationWeeks : "",
      hoursPerWeek: needsDuration(draft.employmentType) ? draft.hoursPerWeek : "",
    }));
    if (ok) {
      submittedRef.current = true;
      clearStoredDraft();
    } else {
      setSubmitting(false);
      // onSubmit already called setSubmitError with the server's specific
      // message when it had one; only fall back to a generic message here.
      setSubmitError((prev) => prev ?? (isCreate ? "Couldn't create this requirement. Please try again." : "Couldn't save changes. Please try again."));
    }
  };

  /* ── Sections ── */

  const noticeOptions = NOTICE_PERIOD_OPTIONS.includes(draft.noticePeriodPref) ? NOTICE_PERIOD_OPTIONS : [...NOTICE_PERIOD_OPTIONS, draft.noticePeriodPref];
  const showDuration = needsDuration(draft.employmentType);
  const descLen = draft.description.length;

  const roleBasics = (
    <>
      <div style={flexRow}>
      <div style={cell(1, 280)}>
        <FieldLabel required htmlFor="rf-title">Job title</FieldLabel>
        <AutocompleteInput id="rf-title" value={draft.title} onChange={(v) => set("title", v)} onBlur={() => touch("title")} invalid={!!shown("title")} describedBy={describe("title")} placeholder="Senior Frontend Engineer" suggestions={ROLE_SUGGESTIONS} />
        {fieldError("title")}
      </div>

      <div style={cell(1, 280)}>
        <FieldLabel htmlFor="rf-department">Department</FieldLabel>
        <input id="rf-department" value={draft.department} onChange={(e) => set("department", e.target.value)} placeholder="Engineering, Sales, Design…" autoComplete="off" style={inputStyle} />
      </div>
      </div>

      <div style={flexRowWide}>
      <div>
        <FieldLabel>Employment type</FieldLabel>
        <SegmentedControl ariaLabel="Employment type" options={EMPLOYMENT_TYPES} value={draft.employmentType} onChange={(v) => set("employmentType", v)} />
      </div>

      <div>
        <FieldLabel>Work mode</FieldLabel>
        <SegmentedControl ariaLabel="Work mode" options={WORK_MODES} value={draft.workMode} onChange={(v) => set("workMode", v)} />
      </div>
      </div>

      <div style={flexRow}>
      <div style={cell(3, 300)}>
        <FieldLabel required htmlFor="rf-locations">Location</FieldLabel>
        <TagAutocompleteInput id="rf-locations" values={draft.locations} onChange={(v) => set("locations", v)} onBlur={() => touch("locations")} invalid={!!shown("locations")} describedBy={describe("locations", "rf-locations-help")} placeholder="Mumbai, Bengaluru, Remote…" suggestions={CITY_SUGGESTIONS} />
        <HelpText id="rf-locations-help" live={false}>Pick a suggestion or type a city and press Enter. Add more than one if the role is open in several.</HelpText>
        {fieldError("locations")}
      </div>

        <div style={cell(1, 150)}>
          <FieldLabel htmlFor="rf-open">Open positions</FieldLabel>
          <NumberField id="rf-open" value={draft.openPositions} onChange={(v) => set("openPositions", v)} onBlur={() => touch("openPositions")} maxDigits={3} placeholder="1" invalid={!!shown("openPositions")} describedBy={describe("openPositions")} style={inputStyle} />
          {fieldError("openPositions")}
        </div>
        <div style={cell(1, 190)}>
          <FieldLabel htmlFor="rf-due">Application deadline</FieldLabel>
          <DateField id="rf-due" aria-describedby={describe("dueDate", "rf-due-help")} aria-invalid={!!shown("dueDate") || undefined} min={today} value={draft.dueDate} onChange={(e) => set("dueDate", e.target.value)} onBlur={() => touch("dueDate")} style={inputStyle} />
          {shown("dueDate") ? fieldError("dueDate") : null}
          <HelpText id="rf-due-help" live={false}>
            {initial?.dueDate && initial.dueDate < today && draft.dueDate === initial.dueDate
              ? "This deadline has passed. Pick a new date, or keep it and save your other changes."
              : "Shown on the Jobs table as a countdown so you know when to follow up."}
          </HelpText>
        </div>
      </div>

      {showDuration && (
        <div style={grid2}>
          <div>
            <FieldLabel htmlFor="rf-weeks">Duration (weeks)</FieldLabel>
            <NumberField id="rf-weeks" value={draft.durationWeeks} onChange={(v) => set("durationWeeks", v)} onBlur={() => touch("durationWeeks")} maxDigits={3} placeholder="12" invalid={!!shown("durationWeeks")} describedBy={describe("durationWeeks", "rf-weeks-help")} style={inputStyle} />
            <HelpText id="rf-weeks-help" live={false}>Shown to candidates alongside the pay rate.</HelpText>
            {fieldError("durationWeeks")}
          </div>
          <div>
            <FieldLabel htmlFor="rf-hours">Hours per week</FieldLabel>
            <NumberField id="rf-hours" value={draft.hoursPerWeek} onChange={(v) => set("hoursPerWeek", v)} onBlur={() => touch("hoursPerWeek")} maxDigits={2} placeholder="20" invalid={!!shown("hoursPerWeek")} describedBy={describe("hoursPerWeek")} style={inputStyle} />
            {fieldError("hoursPerWeek")}
          </div>
        </div>
      )}
    </>
  );

  const requirementsAndPay = (
    <>
      <div style={flexRow}>
      <div style={cell(1, 340)}>
      <ExperienceField
        min={draft.experienceMin}
        max={draft.experienceMax}
        onChange={(min, max) => { setDraft((d) => ({ ...d, experienceMin: min, experienceMax: max })); setDirty(true); }}
        onBlur={() => touch("experience")}
        error={shown("experience")}
        inputStyle={inputStyle}
      />
      </div>

      <div style={cell(1, 340)}>
      <SalaryField
        salaryType={draft.salaryType}
        min={draft.budgetMin}
        max={draft.budgetMax}
        onChange={(next) => { setDraft((d) => ({ ...d, salaryType: next.salaryType, budgetMin: next.min, budgetMax: next.max })); setDirty(true); }}
        onBlur={() => touch("budget")}
        error={shown("budget")}
        inputStyle={inputStyle}
      />
      </div>
      </div>

      <div>
        <FieldLabel htmlFor="rf-skills">Required skills</FieldLabel>
        <TagAutocompleteInput id="rf-skills" describedBy="rf-skills-help" values={draft.skills} onChange={(v) => set("skills", v)} placeholder="React, TypeScript, System design…" suggestions={SKILL_SUGGESTIONS} />
        <HelpText id="rf-skills-help" live={false}>Pick a suggestion or type your own and press Enter. Five to eight skills match best.</HelpText>
      </div>

      <div>
        <FieldLabel required htmlFor="rf-description">Description</FieldLabel>
        <textarea
          id="rf-description"
          aria-required="true"
          aria-describedby={describe("description", "rf-description-help")}
          aria-invalid={!!shown("description") || undefined}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
          onBlur={() => touch("description")}
          rows={6}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="Paste the JD or write a few lines about what you're looking for…"
          style={descriptionStyle}
        />
        <HelpText id="rf-description-help" live={false}>
          We compare this with each candidate's resume to build their match report. {descLen.toLocaleString("en-IN")} / {MAX_DESCRIPTION_LENGTH.toLocaleString("en-IN")}
        </HelpText>
        {fieldError("description")}
      </div>

      <div style={flexRow}>
      <div style={cell(1, 320)}>
        <FieldLabel htmlFor="rf-resp">Responsibilities</FieldLabel>
        <textarea id="rf-resp" aria-describedby="rf-resp-count" value={draft.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} rows={4} maxLength={MAX_LONG_TEXT_LENGTH} placeholder="What will this person own day to day?" style={longTextStyle} />
        <HelpText id="rf-resp-count" live={false}>{draft.responsibilities.length.toLocaleString("en-IN")} / {MAX_LONG_TEXT_LENGTH.toLocaleString("en-IN")}</HelpText>
      </div>

      <div style={cell(1, 320)}>
        <FieldLabel htmlFor="rf-nice">Nice to have</FieldLabel>
        <textarea id="rf-nice" aria-describedby="rf-nice-count" value={draft.niceToHave} onChange={(e) => set("niceToHave", e.target.value)} rows={3} maxLength={MAX_LONG_TEXT_LENGTH} placeholder="Skills or experience that aren't required but would help" style={longTextStyle} />
        <HelpText id="rf-nice-count" live={false}>{draft.niceToHave.length.toLocaleString("en-IN")} / {MAX_LONG_TEXT_LENGTH.toLocaleString("en-IN")}</HelpText>
      </div>
      </div>
    </>
  );

  const targeting = (
    <>
      <div style={flexRow}>
      <div style={cell(1, 320)}>
        <FieldLabel htmlFor="rf-colleges">Preferred colleges</FieldLabel>
        <TagAutocompleteInput id="rf-colleges" values={draft.preferredColleges} onChange={(v) => set("preferredColleges", v)} placeholder="IIT Bombay, BITS Pilani, Any NIT…" suggestions={COLLEGE_SUGGESTIONS} />
      </div>

      <div style={cell(1, 320)}>
        <FieldLabel htmlFor="rf-targets">Target companies</FieldLabel>
        <TagAutocompleteInput id="rf-targets" values={draft.targetCompanies} onChange={(v) => set("targetCompanies", v)} placeholder="Companies you'd like candidates to come from" suggestions={COMPANY_SUGGESTIONS} />
      </div>
      </div>

      <div style={flexRow}>
        <div style={cell(1, 220)}>
          <FieldLabel htmlFor="rf-notice">Notice period</FieldLabel>
          <select id="rf-notice" value={draft.noticePeriodPref} onChange={(e) => set("noticePeriodPref", e.target.value)} style={selectStyle}>
            {noticeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div style={cell(2, 320)}>
          <FieldLabel htmlFor="rf-perks">Perks and benefits</FieldLabel>
          <TagInput id="rf-perks" values={draft.perksAndBenefits} onChange={(v) => set("perksAndBenefits", v)} placeholder="Health insurance, Flexible hours…" />
        </div>
      </div>

      <Accordion type="single" collapsible value={advancedOpen ? ADVANCED_ID : ""} onValueChange={(v) => setAdvancedOpen(v === ADVANCED_ID)}>
        <AccordionItem value={ADVANCED_ID} className="rounded-xl border border-border bg-background px-3">
          <AccordionTrigger className="items-center gap-3 px-1 py-3.5 hover:no-underline pointer-coarse:min-h-11 rf-accordion-trigger">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span style={advancedTitle}>Advanced matching</span>
              <span style={advancedHint}>Optional. Sharpens who we shortlist.</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="h-auto px-1">
        <div style={advancedBody}>
          <div style={grid2}>
            <div>
              <FieldLabel htmlFor="rf-industry">Preferred industry</FieldLabel>
              <AutocompleteInput id="rf-industry" value={draft.preferredIndustry} onChange={(v) => set("preferredIndustry", v)} placeholder="Fintech, SaaS, Ecommerce…" suggestions={INDUSTRY_SUGGESTIONS} />
            </div>
            <div>
              <FieldLabel htmlFor="rf-domain">Preferred domain</FieldLabel>
              <AutocompleteInput id="rf-domain" value={draft.preferredDomain} onChange={(v) => set("preferredDomain", v)} placeholder="Payments, Growth, Platform…" suggestions={DOMAIN_SUGGESTIONS} />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="rf-custom-skills">Other skills</FieldLabel>
            <TagInput id="rf-custom-skills" describedBy="rf-custom-skills-help" values={draft.customSkillSets} onChange={(v) => set("customSkillSets", v)} placeholder="Domain-specific or bespoke skills…" />
            <HelpText id="rf-custom-skills-help" live={false}>For anything role-specific that doesn't fit the Required skills list.</HelpText>
          </div>

          <div style={grid2}>
            <div>
              <FieldLabel htmlFor="rf-schedule">Work schedule</FieldLabel>
              <input id="rf-schedule" value={draft.workSchedule} onChange={(e) => set("workSchedule", e.target.value)} placeholder="Mon–Fri, 9 AM–6 PM" autoComplete="off" style={inputStyle} />
            </div>
            <div>
              <FieldLabel htmlFor="rf-availability">Availability</FieldLabel>
              <input id="rf-availability" value={draft.availability} onChange={(e) => set("availability", e.target.value)} placeholder="Immediate, 2 weeks…" autoComplete="off" style={inputStyle} />
            </div>
          </div>

          <div style={grid2}>
            <div>
              <FieldLabel htmlFor="rf-relevant">Relevant experience</FieldLabel>
              <input id="rf-relevant" value={draft.relevantExperience} onChange={(e) => set("relevantExperience", e.target.value)} placeholder="3+ years in a similar role" autoComplete="off" style={inputStyle} />
            </div>
            <div style={checkboxCell}>
              <Checkbox label="Portfolio required" checked={draft.portfolioRequired} onChange={(v) => set("portfolioRequired", v)} />
            </div>
          </div>

          <div style={grid2}>
            <div>
              <FieldLabel htmlFor="rf-readiness">Minimum readiness</FieldLabel>
              <select id="rf-readiness" value={draft.minReadinessBand} onChange={(e) => set("minReadinessBand", e.target.value as RequirementDraft["minReadinessBand"])} style={selectStyle}>
                <option value="">No minimum</option>
                <option value="leanHire">Lean hire or better</option>
                <option value="hire">Hire or better</option>
                <option value="strongHire">Strong hire only</option>
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="rf-star">Minimum STAR completeness (%)</FieldLabel>
              <NumberField id="rf-star" value={draft.minStarCompleteness} onChange={(v) => set("minStarCompleteness", v)} onBlur={() => touch("minStarCompleteness")} maxDigits={3} placeholder="60" invalid={!!shown("minStarCompleteness")} describedBy={describe("minStarCompleteness", "rf-star-help")} style={inputStyle} />
              <HelpText id="rf-star-help" live={false}>How much of the Situation, Task, Action, Result structure a candidate's answers must cover.</HelpText>
              {fieldError("minStarCompleteness")}
            </div>
          </div>
        </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );

  const requiredNote = (
    <p style={noteText}>
      <span aria-hidden="true" style={requiredStar}>* </span>Required. Everything else is optional.
    </p>
  );

  const draftBanner = offer && (
    <div role="status" style={bannerBox}>
      <span style={bannerText}>
        You have an unfinished requirement{offer.draft.title.trim() ? ` ("${offer.draft.title.trim()}")` : ""} saved on this device.
      </span>
      <OutlineCta size="sm" onClick={() => { setDraft(offer.draft); setDirty(true); setOffer(null); }}>Restore draft</OutlineCta>
      <OutlineCta size="sm" onClick={() => { clearStoredDraft(); setOffer(null); }}>Start fresh</OutlineCta>
    </div>
  );

  const bodyPadding: CSSProperties = { padding: "24px clamp(16px, 5vw, 104px)", display: "flex", flexDirection: "column", gap: 26 };
  const section = (title: string | undefined, children: ReactNode) => <FormSection title={title}>{children}</FormSection>;
  const submitErrorEl = submitError && (
    <p role="alert" style={errorText}>{submitError}</p>
  );

  if (!isCreate) {
    return (
      <form onSubmit={handleSubmit} noValidate>
        <div style={cardStyle}>
          <div style={cardHeader}>
            <h1 style={formTitle}>Edit job requirement</h1>
            <div style={actionRow}>
              <OutlineCta size="sm" onClick={leave}>Cancel</OutlineCta>
              <PrimaryCta type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save changes"}
              </PrimaryCta>
            </div>
          </div>
          <div style={bodyPadding}>
            {requiredNote}
            <ErrorSummary errors={attempted ? errors : {}} scope="all" onJump={focusField} />
            {section("Role basics", roleBasics)}
            {section("Requirements and pay", requirementsAndPay)}
            {section(STEP_LABELS[2], targeting)}
            {submitErrorEl}
            <p style={noteText}>
              Saving re-scores your shortlist against the current candidate pool. Candidates you've already unlocked stay unlocked.
            </p>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={cardStyle}>
        <div style={cardHeader}>
          <h1 style={formTitle}>New job requirement</h1>
          <h2 ref={stepHeadingRef} tabIndex={-1} className="sr-only">
            {STEP_LABELS[step]}
          </h2>
          <span className="sr-only">Step {step} of {LAST_STEP}</span>
          <StepNav step={step} onGoTo={goTo} />
          <div style={actionRow}>
            {step > 1 && <OutlineCta size="sm" onClick={() => goTo((step - 1) as FormStep)}>Back</OutlineCta>}
            <OutlineCta size="sm" onClick={leave}>Cancel</OutlineCta>
            {step < LAST_STEP ? (
              <PrimaryCta type="button" onClick={goNext}>Continue</PrimaryCta>
            ) : (
              <PrimaryCta type="submit" disabled={submitting}>{submitting ? "Posting job…" : "Post job"}</PrimaryCta>
            )}
          </div>
        </div>
        <div style={bodyPadding}>
          {draftBanner}
          <ErrorSummary errors={attempted ? errors : {}} scope={step} onJump={focusField} />
          {step === 1 ? (
            <div style={stackedSections}>
              {section("Role basics", roleBasics)}
              {section("Requirements and pay", requirementsAndPay)}
            </div>
          ) : (
            section(undefined, targeting)
          )}
          {submitErrorEl}
          {savedAt && (
            <p style={noteText}>
              Draft saved on this device. You can close this page and come back.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
