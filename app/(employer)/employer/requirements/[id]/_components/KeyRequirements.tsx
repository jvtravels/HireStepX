"use client";

import { CircleAlertIcon, SparklesIcon, StarIcon } from "lucide-react";
import { skillTiers } from "@/employer/_jobDetailHelpers";
import { SkillChip, type ChipTone } from "@/employer/_panelParts";
import type { Requirement } from "@/employer/EmployerDataContext";
import type { ReactNode } from "react";

function Tier({ title, icon, tone, skills, iconClass }: { title: string; icon: ReactNode; tone: ChipTone; skills: string[]; iconClass: string }) {
  return (
    <div className="grid min-w-0 gap-1.5 sm:grid-cols-[116px_minmax(0,1fr)] sm:items-start sm:gap-3">
      <h3 className="m-0 flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-hx-coal sm:pt-1">
        <span aria-hidden="true" className={`inline-flex size-5 shrink-0 items-center justify-center rounded-md ${iconClass}`}>{icon}</span>
        {title}
      </h3>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {skills.map((s) => (
          <li key={s}>
            <SkillChip tone={tone}>{s}</SkillChip>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function hasKeyRequirements(r: Requirement): boolean {
  const { mustHave, other, niceToHave } = skillTiers(r);
  return mustHave.length + other.length + niceToHave.length > 0;
}

/** Rendered inside the job header card, beside the description. */
export default function KeyRequirements({ requirement }: { requirement: Requirement }) {
  const { mustHave, other, niceToHave } = skillTiers(requirement);
  const tiers = [
    mustHave.length > 0 && <Tier key="must" title="Must have" icon={<CircleAlertIcon size={12} />} tone="danger" skills={mustHave} iconClass="bg-hx-error-100 text-hx-error-ink" />,
    other.length > 0 && <Tier key="oth" title="Important" icon={<StarIcon size={12} />} tone="primary" skills={other} iconClass="bg-hx-indigo-100 text-hx-indigo" />,
    niceToHave.length > 0 && <Tier key="nice" title="Nice to have" icon={<SparklesIcon size={12} />} tone="neutral" skills={niceToHave} iconClass="bg-hx-soft text-hx-neutral-ink" />,
  ].filter(Boolean);
  if (tiers.length === 0) return null;
  return (
    <section aria-labelledby="key-requirements-heading" className="min-w-0">
      <h2 id="key-requirements-heading" className="m-0 mb-2.5 text-[13px] font-semibold text-hx-ink-soft">
        Key requirements
      </h2>
      <div className="flex flex-col gap-3">{tiers}</div>
    </section>
  );
}
