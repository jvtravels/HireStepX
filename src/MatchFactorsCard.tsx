"use client";

import { CheckIcon } from "lucide-react";

export type MatchFactorLevel = "strong" | "partial" | "gap";
export interface MatchFactor {
  key: "role" | "skills" | "location" | "experience";
  label: string;
  level: MatchFactorLevel;
  detail: string;
}
export interface MatchFactors {
  factors: MatchFactor[];
  matchedSkills: string[];
  missingSkills: string[];
}

const LEVEL: Record<MatchFactorLevel, { label: string; className: string }> = {
  strong: { label: "Strong", className: "bg-hx-success-100 text-hx-success-ink" },
  partial: { label: "Partial", className: "bg-hx-warning-100 text-hx-warning-ink" },
  gap: { label: "Gap", className: "bg-hx-soft text-hx-neutral-ink" },
};

const H2 = "m-0 mb-2.5 text-[15px] font-semibold leading-6 text-hx-coal";
const H3 = "m-0 mb-2 text-[12px] font-semibold text-hx-ink-soft";
const HINT = "m-0 mt-2.5 text-[12px] leading-[18px] text-hx-ink-soft";
const CHIP = "inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-[12px] leading-none font-medium [overflow-wrap:anywhere]";

function LevelChip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex min-w-[3.75rem] shrink-0 justify-center rounded-full px-2 py-0.5 text-[12px] font-semibold ${className}`}>{children}</span>;
}

export function MatchFactorsCard({ data }: { data: MatchFactors }) {
  if (data.factors.length === 0) return null;
  const hasSkills = data.matchedSkills.length > 0 || data.missingSkills.length > 0;
  return (
    <section aria-label="Why you matched">
      <h2 className={H2}>Why you matched</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {data.factors.map((x) => (
          <li key={x.key} className="flex items-start gap-2.5 text-[13px] leading-[20px] text-hx-ink-soft">
            <LevelChip className={LEVEL[x.level].className}>{LEVEL[x.level].label}</LevelChip>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-hx-coal">{x.label}</span>
              {x.detail}
            </span>
          </li>
        ))}
      </ul>
      {hasSkills && (
        <>
          <h3 className={`${H3} mt-4`}>Skills they asked for</h3>
          <ul aria-label="Skills they asked for" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {data.matchedSkills.map((s) => (
              <li key={`y-${s}`} className={`${CHIP} bg-hx-success-100 text-hx-success-ink`}>
                <CheckIcon size={12} aria-hidden="true" className="shrink-0" />
                {s}
                <span className="sr-only"> (on your resume)</span>
              </li>
            ))}
            {data.missingSkills.map((s) => (
              <li key={`n-${s}`} className={`${CHIP} border border-dashed border-hx-ink-soft/50 text-hx-neutral-ink`}>
                {s}
                <span className="sr-only"> (not on your resume yet)</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {data.missingSkills.length > 0 && (
        <p className={HINT}>Dashed skills are not on your resume yet. Practising them in a mock interview adds verified evidence employers can see.</p>
      )}
    </section>
  );
}

export function EmployerVisibilityCard({ unlocked }: { unlocked: boolean }) {
  const rows = [
    { visible: true, text: "Your practice scores, skills and interview summary for this role" },
    { visible: unlocked, text: unlocked ? "Your name and contact details, since they showed interest" : "Your name and contact details, until they unlock your profile" },
    { visible: unlocked, text: unlocked ? "Your answers and the notes on them" : "Your spoken answers, which are never shared before an unlock" },
  ];
  return (
    <section aria-label="What the employer sees">
      <h2 className={H2}>What this employer sees</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {rows.map((r) => (
          <li key={r.text} className="flex items-start gap-2.5 text-[13px] leading-[20px] text-hx-ink-soft">
            <LevelChip className={r.visible ? LEVEL.strong.className : LEVEL.gap.className}>{r.visible ? "Visible" : "Hidden"}</LevelChip>
            <span className="min-w-0">{r.text}</span>
          </li>
        ))}
      </ul>
      <p className={HINT}>You can switch employer visibility off at any time in Settings.</p>
    </section>
  );
}
