"use client";

import { CircleAlertIcon, SparklesIcon, StarIcon } from "lucide-react";
import { skillTiers } from "@/employer/_jobDetailHelpers";
import { SkillChip, type ChipTone } from "@/employer/_panelParts";
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
  const { mustHave, other, niceToHave } = skillTiers(requirement);
  const tiers = [
    mustHave.length > 0 && <Tier key="must" title="Must have" icon={<CircleAlertIcon size={13} />} tone="danger" skills={mustHave} iconClass="bg-hx-error-100 text-hx-error-ink" />,
    other.length > 0 && <Tier key="oth" title="Other skills" icon={<StarIcon size={13} />} tone="primary" skills={other} iconClass="bg-hx-indigo-100 text-hx-indigo" />,
    niceToHave.length > 0 && <Tier key="nice" title="Nice to have" icon={<SparklesIcon size={13} />} tone="info" skills={niceToHave} iconClass="bg-hx-info-100 text-hx-info" />,
  ].filter(Boolean);
  if (tiers.length === 0) return null;
  return (
    <section aria-labelledby="key-requirements-heading" className="mt-5 border-t border-hx-line pt-5">
      <h2 id="key-requirements-heading" className="m-0 mb-3.5 text-[15px] font-semibold text-hx-coal">
        Key requirements
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{tiers}</div>
    </section>
  );
}
