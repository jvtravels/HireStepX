"use client";

import { useId, useState } from "react";
import { PanelButton, SkillChip } from "@/employer/_panelParts";
import type { JobMatch } from "../DashboardJobs";
import { BODY, EMPTY, H2, LIST, SEC } from "./styles";

const COLLAPSE_THRESHOLD = 600;
/* ~8 lines at 14px / 24px; the mask fades the cut so it reads as "more below". */
const CLAMP = "max-h-[170px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]";

function bulletLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.replace(/^\s*[-•*·]\s*/, "").trim()).filter(Boolean);
}

function RoleText({ text, bullets }: { text: string; bullets?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = text.length > COLLAPSE_THRESHOLD;
  const clamp = long && !expanded ? CLAMP : "";
  const lines = bullets ? bulletLines(text) : [];
  return (
    <>
      {lines.length > 1 ? (
        <ul id={id} className={`${LIST} ${clamp}`}>{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
      ) : (
        <div id={id} className={`flex flex-col gap-3 ${clamp}`}>
          {text.split(/\n\s*\n/).map((para, i) => <p key={i} className={BODY}>{para.trim()}</p>)}
        </div>
      )}
      {long && (
        <div className="mt-1.5">
          <PanelButton expanded={expanded} controls={id} onClick={() => setExpanded((v) => !v)}>
            {expanded ? "View less" : "View more"}
          </PanelButton>
        </div>
      )}
    </>
  );
}

export default function JobBody({ job, showSkills }: { job: JobMatch; showSkills: boolean }) {
  const hasBody = !!(job.description || job.responsibilities || job.niceToHave);
  const skills = showSkills && job.skills.length > 0;
  const perks = job.perksAndBenefits.length > 0;
  return (
    <>
      <div className={`${SEC} flex flex-col gap-6`}>
        {job.description && (
          <section aria-labelledby="job-about-heading">
            <h2 id="job-about-heading" className={H2}>About the role</h2>
            <RoleText text={job.description} />
          </section>
        )}
        {job.responsibilities && (
          <section aria-labelledby="job-resp-heading">
            <h2 id="job-resp-heading" className={H2}>Responsibilities</h2>
            <RoleText text={job.responsibilities} bullets />
          </section>
        )}
        {job.niceToHave && (
          <section aria-labelledby="job-nice-heading">
            <h2 id="job-nice-heading" className={H2}>Nice to have</h2>
            <RoleText text={job.niceToHave} bullets />
          </section>
        )}
        {!hasBody && <p className={EMPTY}>This employer hasn't added a role description yet.</p>}
      </div>
      {(skills || perks) && (
        <div className={`${SEC} flex flex-col gap-6`}>
          {skills && (
            <section aria-label="Skills">
              <h2 className={H2}>Skills</h2>
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {job.skills.map((s, i) => <li key={i}><SkillChip tone="primary">{s}</SkillChip></li>)}
              </ul>
            </section>
          )}
          {perks && (
            <section aria-label="Perks and benefits">
              <h2 className={H2}>Perks &amp; benefits</h2>
              <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                {job.perksAndBenefits.map((p, i) => <li key={i}><SkillChip tone="neutral">{p}</SkillChip></li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </>
  );
}
