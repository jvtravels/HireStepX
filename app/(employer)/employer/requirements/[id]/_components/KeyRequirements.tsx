"use client";

import { CircleAlertIcon, SparklesIcon, StarIcon } from "lucide-react";
import { skillTiers } from "@/employer/_jobDetailHelpers";
import { Panel, SkillChip, type ChipTone } from "@/employer/_panelParts";
import type { Requirement } from "@/employer/EmployerDataContext";
import type { ReactNode } from "react";

function Tier({ title, icon, tone, skills, iconClass }: { title: string; icon: ReactNode; tone: ChipTone; skills: string[]; iconClass: string }) {
  return (
    <div className="min-w-0">
      <h3 className="m-0 mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-hx-coal">
        <span aria-hidden="true" className={`inline-flex size-6 items-center justify-center rounded-md ${iconClass}`}>{icon}</span>
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

export default function KeyRequirements({ requirement }: { requirement: Requirement }) {
  const { mustHave, important, niceToHave } = skillTiers(requirement);
  const tiers = [
    mustHave.length > 0 && <Tier key="must" title="Must have" icon={<CircleAlertIcon size={13} />} tone="danger" skills={mustHave} iconClass="bg-hx-error-100 text-hx-error-ink" />,
    important.length > 0 && <Tier key="imp" title="Important" icon={<StarIcon size={13} />} tone="primary" skills={important} iconClass="bg-hx-indigo-100 text-hx-indigo" />,
    niceToHave.length > 0 && <Tier key="nice" title="Nice to have" icon={<SparklesIcon size={13} />} tone="info" skills={niceToHave} iconClass="bg-hx-info-100 text-hx-info" />,
  ].filter(Boolean);
  if (tiers.length === 0) return null;
  return (
    <Panel id="key-requirements-heading" title="Key requirements">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{tiers}</div>
    </Panel>
  );
}
