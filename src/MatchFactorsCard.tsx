"use client";

import { CheckIcon, EyeOffIcon } from "lucide-react";
import { Badge, type BadgeTone } from "@/employer/_atoms";
import { InfoTip, SkillChip } from "@/employer/_panelParts";

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

const LEVEL: Record<MatchFactorLevel, { label: string; tone: BadgeTone }> = {
  strong: { label: "Strong", tone: "success" },
  partial: { label: "Partial", tone: "warning" },
  gap: { label: "Gap", tone: "neutral" },
};

const H2 = "m-0 mb-3 text-[16px] font-semibold leading-6 text-hx-coal";
const H3 = "m-0 mb-2 text-[12px] font-semibold text-hx-ink-soft";
const HINT = "m-0 mt-2.5 text-[12px] leading-[18px] text-hx-ink-soft";

/* Each row is one line (label + level). The sentence behind the level stays
   available to screen readers and on hover, so the header's facts aren't
   restated here. */
export function MatchFactorsCard({ data, stacked }: { data: MatchFactors; stacked?: boolean }) {
  if (data.factors.length === 0) return null;
  const hasSkills = data.matchedSkills.length > 0 || data.missingSkills.length > 0;
  return (
    <section aria-label="Why you matched">
      <h2 className={`${H2} flex items-center gap-0.5`}>
        Why you matched
        <InfoTip compact label="What the levels mean">
          Strong: you meet what the employer asked for. Partial: you meet some of it. Gap: not on your profile yet.
        </InfoTip>
      </h2>
      <ul className={`m-0 grid list-none gap-x-10 gap-y-2.5 p-0 ${stacked ? "" : "min-[640px]:grid-cols-2"}`}>
        {data.factors.map((x) => (
          <li key={x.key} className="flex items-center justify-between gap-3 text-[14px] leading-6 text-hx-coal">
            <span className="flex min-w-0 items-center gap-0.5">
              {x.label}
              <span className="sr-only">: {x.detail}</span>
              <InfoTip compact label={`Why ${x.label.toLowerCase()} is ${LEVEL[x.level].label.toLowerCase()}`}>{x.detail}</InfoTip>
            </span>
            <Badge tone={LEVEL[x.level].tone} className="shrink-0">{LEVEL[x.level].label}</Badge>
          </li>
        ))}
      </ul>
      {hasSkills && (
        <>
          <h3 className={`${H3} mt-5 flex items-center gap-0.5`}>
            Skills they asked for
            {data.missingSkills.length > 0 && (
              <InfoTip compact label="About dashed skills">Ticked skills are on your resume. Dashed skills aren't yet.</InfoTip>
            )}
          </h3>
          <ul aria-label="Skills they asked for" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
            {data.matchedSkills.map((s) => (
              <li key={`y-${s}`}>
                <SkillChip tone="present">
                  <CheckIcon size={12} aria-hidden="true" className="mr-1 shrink-0" />
                  {s}
                  <span className="sr-only"> (on your resume)</span>
                </SkillChip>
              </li>
            ))}
            {data.missingSkills.map((s) => (
              <li key={`n-${s}`}>
                <SkillChip tone="missing">
                  {s}
                  <span className="sr-only"> (not on your resume yet)</span>
                </SkillChip>
              </li>
            ))}
          </ul>
        </>
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
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {rows.map((r) => (
          <li key={r.text} className={`flex items-start gap-2.5 text-[13px] leading-[20px] ${r.visible ? "text-hx-neutral-ink" : "text-hx-ink-soft"}`}>
            {r.visible
              ? <CheckIcon size={15} aria-hidden="true" className="mt-0.5 shrink-0 text-hx-success" />
              : <EyeOffIcon size={15} aria-hidden="true" className="mt-0.5 shrink-0" />}
            <span className="min-w-0">
              <span className="sr-only">{r.visible ? "Visible: " : "Hidden: "}</span>
              {r.text}
            </span>
          </li>
        ))}
      </ul>
      <p className={HINT}>You can switch employer visibility off at any time in Settings.</p>
    </section>
  );
}
