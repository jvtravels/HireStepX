import type { ReactNode } from "react";
import { LockIcon, TrendingUpIcon } from "lucide-react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item";
import type { Candidate } from "@/employer/mockData";
import { OutlineCta } from "@/employer/_atoms";
import { Panel } from "@/employer/_panelParts";
import { ChipList, IconList, MutedText } from "./parts";
import { averageTenureMonths, formatTenure, groupSkillsByDepth, periodMonths, skillChipLabel } from "./helpers";

type EntryRow = { key: string; title: string; sub: string; when?: string; note?: string; extra?: ReactNode };

function Entries({ rows, label }: { rows: EntryRow[]; label: string }) {
  return (
    <ItemGroup aria-label={label} className="gap-0">
      {rows.map((r, i) => (
        <div key={r.key}>
          {i > 0 && <ItemSeparator className="my-0" />}
          <Item role="listitem" size="sm" className="items-start justify-between gap-4 px-0">
            <ItemContent>
              <ItemTitle className="text-[14px]">{r.title}</ItemTitle>
              {r.sub && <ItemDescription className="line-clamp-none text-[13px]">{r.sub}</ItemDescription>}
              {r.extra}
            </ItemContent>
            {(r.when || r.note) && (
              <span className="shrink-0 text-right text-[12px] text-hx-ink-soft">
                {r.when}
                {r.note && <span className="block">{r.note}</span>}
              </span>
            )}
          </Item>
        </div>
      ))}
    </ItemGroup>
  );
}

type Role = NonNullable<Candidate["resume"]>["experience"][number];

function RoleDetail({ role }: { role: Role }) {
  const meta = [
    role.teamSize ? `Team of ${role.teamSize}` : "",
    role.partners?.length ? `Works with ${role.partners.join(", ")}` : "",
  ].filter(Boolean);
  const points = [...(role.topProjects ?? []), ...(role.bullets ?? [])];
  if (!role.scope && meta.length === 0 && points.length === 0) return null;
  return (
    <div className="mt-1.5 grid gap-1.5">
      {role.scope && <p className="m-0 text-[13px] leading-snug text-hx-coal">{role.scope}</p>}
      {meta.length > 0 && <p className="m-0 text-[12px] text-hx-ink-soft">{meta.join(" · ")}</p>}
      {points.length > 0 && (
        <ul className="m-0 grid list-disc gap-1 pl-4 text-[13px] leading-snug text-hx-coal marker:text-hx-ink-soft">
          {points.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkillsBlock({ candidate }: { candidate: Candidate }) {
  const detailed = candidate.resume?.skillsDetailed ?? [];
  if (detailed.length === 0) {
    return candidate.skills.length ? <ChipList label="Skills" items={candidate.skills} /> : <MutedText>No tools or skills listed on this resume.</MutedText>;
  }
  const groups = groupSkillsByDepth(detailed);
  const recent = detailed.filter((s) => s.recent).map((s) => s.name);
  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <div key={g.label} className="grid gap-2">
          <h3 className="m-0 text-[13px] font-semibold text-hx-coal">{g.label}</h3>
          <ChipList label={g.label} items={g.skills.map(skillChipLabel)} />
        </div>
      ))}
      {recent.length > 0 && <p className="m-0 text-[12px] text-hx-ink-soft">Used in the last 12 months: {recent.join(", ")}.</p>}
    </div>
  );
}

export function ResumeTab({ candidate, onUnlock }: { candidate: Candidate; onUnlock: () => void }) {
  const resume = candidate.resume;
  const achievements = (resume?.keyAchievements ?? []).filter((a) => a.trim());
  const highlights = [...achievements.filter((a) => /\d/.test(a)), ...achievements.filter((a) => !/\d/.test(a))];
  const avg = resume ? averageTenureMonths(resume.experience) : null;
  const progression = (resume?.promotionSignals ?? []).filter((p) => p.trim());
  const hasStory = !!resume?.careerTrajectory?.trim() || progression.length > 0;

  return (
    <div className="grid min-w-0 gap-4">
      {!candidate.unlocked && (
        <Item variant="muted">
          <ItemMedia variant="icon"><LockIcon aria-hidden="true" /></ItemMedia>
          <ItemContent>
            <ItemTitle>Employers, schools and the original file are hidden</ItemTitle>
            <ItemDescription className="line-clamp-none text-[13px]">Everything else we hold is shown below. Unlock the candidate to see where they worked and studied and to download the resume.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <OutlineCta size="sm" onClick={onUnlock}>Unlock candidate</OutlineCta>
          </ItemActions>
        </Item>
      )}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="grid min-w-0 content-start gap-4">
        <Panel id="employment-heading" title="Employment history">
          {resume?.experience.length ? (
            <div className="grid gap-3">
              {avg != null && resume.experience.length > 1 && <p className="m-0 text-[13px] text-hx-ink-soft">{resume.experience.length} roles, about {formatTenure(avg)} each.</p>}
              <Entries
                label="Employment history"
                rows={resume.experience.map((e, i) => {
                  const months = periodMonths(e.period);
                  return { key: `${e.company}-${e.period}-${i}`, title: e.title || "Role", sub: e.company, when: e.period, note: months != null ? formatTenure(months) : undefined, extra: <RoleDetail role={e} /> };
                })}
              />
            </div>
          ) : (
            <MutedText>No structured employment history extracted from this resume.</MutedText>
          )}
        </Panel>
        {!!resume?.education.length && (
          <Panel id="education-heading" title="Education">
            <Entries label="Education" rows={resume.education.map((ed, i) => ({ key: `${ed.school}-${ed.degree}-${i}`, title: ed.degree, sub: ed.school, when: ed.year }))} />
          </Panel>
        )}
        </div>
        <div className="grid min-w-0 content-start gap-4">
        {highlights.length > 0 && (
          <Panel id="highlights-heading" title="Achievements">
            <IconList label="Achievements" items={highlights} icon={TrendingUpIcon} iconClassName="size-4 text-hx-success" />
          </Panel>
        )}
        {hasStory && (
          <Panel id="progression-heading" title="Career progression">
            <div className="grid gap-3">
              {resume?.careerTrajectory && <p className="m-0 text-[13px] leading-relaxed text-hx-coal">{resume.careerTrajectory}</p>}
              {progression.length > 0 && <IconList label="Promotions and growth" items={progression} icon={TrendingUpIcon} iconClassName="size-4 text-hx-success" />}
            </div>
          </Panel>
        )}
        <Panel id="skills-heading" title="Skills">
          <div className="grid gap-4">
            <SkillsBlock candidate={candidate} />
            {!!resume?.industries.length && (
              <div className="grid gap-2 border-t border-hx-line pt-4">
                <h3 className="m-0 text-[13px] font-semibold text-hx-coal">Industries</h3>
                <ChipList label="Industries" items={resume.industries} />
              </div>
            )}
            {!!resume?.certifications.length && (
              <div className="grid gap-2 border-t border-hx-line pt-4">
                <h3 className="m-0 text-[13px] font-semibold text-hx-coal">Certifications</h3>
                <ChipList label="Certifications" items={resume.certifications} />
              </div>
            )}
          </div>
        </Panel>
        </div>
      </div>
    </div>
  );
}
