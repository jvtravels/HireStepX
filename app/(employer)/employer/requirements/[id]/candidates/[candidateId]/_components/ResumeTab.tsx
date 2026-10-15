import { LockIcon, TrendingUpIcon } from "lucide-react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item";
import type { Candidate } from "@/employer/mockData";
import { OutlineCta } from "@/employer/_atoms";
import { Panel } from "@/employer/_panelParts";
import { ChipList, IconList, Masonry, MutedText } from "./parts";
import { averageTenureMonths, formatTenure, periodMonths } from "./helpers";

type EntryRow = { key: string; title: string; sub: string; when?: string; note?: string };

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

export function ResumeTab({ candidate, onUnlock }: { candidate: Candidate; onUnlock: () => void }) {
  const resume = candidate.resume;
  const achievements = (resume?.keyAchievements ?? []).filter((a) => a.trim());
  const highlights = [...achievements.filter((a) => /\d/.test(a)), ...achievements.filter((a) => !/\d/.test(a))];
  const avg = resume ? averageTenureMonths(resume.experience) : null;

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
      <Masonry>
        {highlights.length > 0 && (
          <Panel id="highlights-heading" title="Achievements">
            <IconList label="Achievements" items={highlights} icon={TrendingUpIcon} iconClassName="size-4 text-hx-success" />
          </Panel>
        )}

        <Panel id="employment-heading" title="Employment history">
          {resume?.experience.length ? (
            <div className="grid gap-3">
              {avg != null && resume.experience.length > 1 && <p className="m-0 text-[13px] text-hx-ink-soft">{resume.experience.length} roles, about {formatTenure(avg)} each.</p>}
              <Entries
                label="Employment history"
                rows={resume.experience.map((e, i) => {
                  const months = periodMonths(e.period);
                  return { key: `${e.company}-${e.period}-${i}`, title: e.title || "Role", sub: e.company, when: e.period, note: months != null ? formatTenure(months) : undefined };
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

        <Panel id="skills-heading" title="Skills">
          <div className="grid gap-4">
            {candidate.skills.length ? <ChipList label="Skills" items={candidate.skills} /> : <MutedText>No tools or skills listed on this resume.</MutedText>}
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
      </Masonry>
    </div>
  );
}
