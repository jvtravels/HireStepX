"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { FieldLabel, HelpText, SegmentedControl } from "@/employer/_atoms";
import type { SalaryType } from "./mockData";
import {
  EXPERIENCE_PRESETS,
  SALARY_LIMITS,
  allErrors,
  FIELD_FOCUS_ID,
  FIELD_STEP,
  STEP_LABELS,
  STEPS,
  convertBudget,
  describeExperience,
  describeSalary,
  digitsOnly,
  presetIsActive,
  type FieldKey,
  type FormErrors,
  type FormStep,
} from "./_requirementFormHelpers";

/* Field-level building blocks for RequirementForm. Kept out of _atoms.tsx
   (near its size budget); these are specific to the requirement editor. */

const legendStyle: CSSProperties = {
  display: "block",
  padding: 0,
  fontFamily: f.sans,
  fontSize: 13,
  fontWeight: 600,
  color: t.coal,
  marginBottom: 8,
};

const fieldsetStyle: CSSProperties = { border: "none", padding: 0, margin: 0, minWidth: 0 };

/** Whole-number text input. `type="number"` was dropped on purpose: it shows
 *  spinner arrows, lets the scroll wheel change the value, accepts "e" and
 *  decimals the server then discards. A digits-only text input with a numeric
 *  keypad avoids all of that and still announces as an edit field. */
export function NumberField({
  id,
  value,
  onChange,
  onBlur,
  placeholder,
  invalid,
  describedBy,
  style,
  maxDigits,
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  style: CSSProperties;
  maxDigits?: number;
}) {
  const merged: CSSProperties = { ...style, borderColor: invalid ? t.error : style.borderColor };
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(digitsOnly(e.target.value, maxDigits))}
      onBlur={onBlur}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      style={merged}
    />
  );
}

const chipStyle = (pressed: boolean): CSSProperties => ({
  minHeight: 34,
  padding: "6px 14px",
  borderRadius: 999,
  border: `1px solid ${pressed ? t.indigo : t.line}`,
  background: pressed ? t.indigo100 : t.white,
  color: pressed ? t.indigoDeep : t.neutralInk,
  fontFamily: f.sans,
  fontSize: textSize.base,
  fontWeight: pressed ? 700 : 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
});

function ChipToggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="pointer-coarse:min-h-11"
      style={chipStyle(pressed)}
    >
      {children}
    </button>
  );
}

const chipRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 };
const pairGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 };

export function ExperienceField({
  min,
  max,
  onChange,
  error,
  inputStyle,
  onBlur,
}: {
  min: string;
  max: string;
  onChange: (min: string, max: string) => void;
  error?: string;
  inputStyle: CSSProperties;
  onBlur?: () => void;
}) {
  return (
    <fieldset style={fieldsetStyle}>
      <legend style={legendStyle}>Experience</legend>
      <div style={chipRow}>
        {EXPERIENCE_PRESETS.map((p) => {
          const active = presetIsActive(p, min, max);
          return (
            <ChipToggle key={p.label} pressed={active} onClick={() => (active ? onChange("", "") : onChange(p.min, p.max))}>
              {p.label}
            </ChipToggle>
          );
        })}
      </div>
      <div style={pairGrid}>
        <div>
          <FieldLabel htmlFor="rf-exp-min">From (years)</FieldLabel>
          <NumberField id="rf-exp-min" value={min} onChange={(v) => onChange(v, max)} onBlur={onBlur} placeholder="2" maxDigits={2} invalid={!!error} describedBy="rf-exp-help" style={inputStyle} />
        </div>
        <div>
          <FieldLabel htmlFor="rf-exp-max">To (years)</FieldLabel>
          <NumberField id="rf-exp-max" value={max} onChange={(v) => onChange(min, v)} onBlur={onBlur} placeholder="5" maxDigits={2} invalid={!!error} describedBy="rf-exp-help" style={inputStyle} />
        </div>
      </div>
      {error ? (
        <HelpText id="rf-exp-help" tone="error">{error}</HelpText>
      ) : (
        <HelpText id="rf-exp-help" live={false}>{describeExperience(min, max)}. Pick a range above or type your own; leave both empty for any level.</HelpText>
      )}
    </fieldset>
  );
}

const segmentWrap: CSSProperties = { marginBottom: 12 };

const SALARY_OPTIONS: { value: SalaryType; label: string }[] = [
  { value: "per-annum", label: "Per year" },
  { value: "per-month", label: "Per month" },
  { value: "fixed", label: "Fixed amount" },
];

const SALARY_UNIT: Record<SalaryType, { label: string; min: string; max: string }> = {
  "per-annum": { label: "LPA", min: "12", max: "18" },
  "per-month": { label: "₹ per month", min: "80000", max: "120000" },
  fixed: { label: "₹ total", min: "45000", max: "60000" },
};

export function SalaryField({
  salaryType,
  min,
  max,
  onChange,
  error,
  inputStyle,
  onBlur,
}: {
  salaryType: SalaryType;
  min: string;
  max: string;
  onChange: (next: { salaryType: SalaryType; min: string; max: string }) => void;
  error?: string;
  inputStyle: CSSProperties;
  onBlur?: () => void;
}) {
  const [announce, setAnnounce] = useState("");
  const unit = SALARY_UNIT[salaryType];
  const readBack = describeSalary(min, max, salaryType);

  const changeType = (next: SalaryType) => {
    if (next === salaryType) return;
    const nextMin = convertBudget(min, salaryType, next);
    const nextMax = convertBudget(max, salaryType, next);
    onChange({ salaryType: next, min: nextMin, max: nextMax });
    const converted = describeSalary(nextMin, nextMax, next);
    setAnnounce(converted ? `Pay basis changed. Salary is now ${converted}.` : "Pay basis changed.");
  };

  return (
    <fieldset style={fieldsetStyle}>
      <legend style={legendStyle}>Salary</legend>
      <div style={segmentWrap}>
        <SegmentedControl ariaLabel="Pay basis" options={SALARY_OPTIONS} value={salaryType} onChange={changeType} />
      </div>
      <div style={pairGrid}>
        <div>
          <FieldLabel htmlFor="rf-budget-min">Minimum ({unit.label})</FieldLabel>
          <NumberField id="rf-budget-min" value={min} onChange={(v) => onChange({ salaryType, min: v, max })} onBlur={onBlur} placeholder={unit.min} maxDigits={9} invalid={!!error} describedBy="rf-budget-help" style={inputStyle} />
        </div>
        <div>
          <FieldLabel htmlFor="rf-budget-max">Maximum ({unit.label})</FieldLabel>
          <NumberField id="rf-budget-max" value={max} onChange={(v) => onChange({ salaryType, min, max: v })} onBlur={onBlur} placeholder={unit.max} maxDigits={9} invalid={!!error} describedBy="rf-budget-help" style={inputStyle} />
        </div>
      </div>
      {error ? (
        <HelpText id="rf-budget-help" tone="error">{error}</HelpText>
      ) : (
        <HelpText id="rf-budget-help" live={false}>
          {readBack ?? `Whole numbers only, up to ${SALARY_LIMITS[salaryType].toLocaleString("en-IN")}. Optional.`}
        </HelpText>
      )}
      <span role="status" className="sr-only">{announce}</span>
    </fieldset>
  );
}

const stepListStyle: CSSProperties = { display: "flex", flexWrap: "wrap", gap: "6px 18px", listStyle: "none", margin: 0, padding: 0 };
const stepBadgeStyle = (filled: boolean): CSSProperties => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 999,
  fontSize: textSize.sm, fontWeight: 700, background: filled ? t.indigo : t.creamSoft, color: filled ? t.white : t.neutralInk,
});

/** Wizard progress. Finished steps are buttons so a recruiter can jump back;
 *  later steps are plain text, because skipping ahead would skip validation. */
export function StepNav({ step, onGoTo }: { step: FormStep; onGoTo: (s: FormStep) => void }) {
  return (
    <nav aria-label="Form progress">
      <ol style={stepListStyle}>
        {STEPS.map((s) => {
          const current = s === step;
          const done = s < step;
          const label = (
            <>
              <span
                aria-hidden="true"
                style={stepBadgeStyle(current || done)}
              >
                {done ? "✓" : s}
              </span>
              <span>{STEP_LABELS[s]}</span>
              {done && <span className="sr-only"> (completed)</span>}
            </>
          );
          const common: CSSProperties = {
            display: "inline-flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: textSize.base,
            fontWeight: current ? 700 : 500, color: current ? t.coal : t.neutralInk, background: "none", border: "none", padding: 0,
          };
          const doneStyle: CSSProperties = { ...common, cursor: "pointer" };
          const todoStyle: CSSProperties = { ...common, minHeight: 28 };
          return (
            <li key={s} aria-current={current ? "step" : undefined}>
              {done ? (
                <button type="button" onClick={() => onGoTo(s)} className="pointer-coarse:min-h-11" style={doneStyle}>{label}</button>
              ) : (
                <span className="pointer-coarse:min-h-11" style={todoStyle}>{label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const summaryBox: CSSProperties = { padding: "12px 16px", borderRadius: 12, background: t.error100, border: `1px solid ${t.errorLine}`, color: t.errorInk, fontFamily: f.sans, fontSize: textSize.base };
const summaryTitle: CSSProperties = { display: "block", marginBottom: 6 };
const summaryList: CSSProperties = { margin: 0, paddingLeft: 18 };
const summaryLink: CSSProperties = { color: "inherit", textDecoration: "underline", fontWeight: 600 };

/** Lists every blocking problem after a failed Continue / Save, each one a
 *  link that moves focus to the offending control. */
export function ErrorSummary({
  errors,
  scope,
  onJump,
}: {
  errors: FormErrors;
  scope: FormStep | "all";
  onJump: (field: FieldKey) => void;
}) {
  const items = allErrors(errors).filter(([k]) => scope === "all" || FIELD_STEP[k] === scope);
  if (items.length === 0) return null;
  return (
    <div
      role="alert"
      style={summaryBox}
    >
      <strong style={summaryTitle}>
        {items.length === 1 ? "1 thing needs fixing" : `${items.length} things need fixing`}
      </strong>
      <ul style={summaryList}>
        {items.map(([k, msg]) => (
          <li key={k}>
            <a
              href={`#${FIELD_FOCUS_ID[k]}`}
              onClick={(e) => {
                e.preventDefault();
                onJump(k);
              }}
              style={summaryLink}
            >
              {msg}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
