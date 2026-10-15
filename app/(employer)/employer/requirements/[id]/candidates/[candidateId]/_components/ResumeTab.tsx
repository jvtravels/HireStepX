import { Item, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item";
import type { Candidate } from "@/employer/mockData";
import { Panel } from "@/employer/_panelParts";
import { LinkCta } from "@/employer/_requirementAtoms";
import { ChipList, Masonry, MutedText } from "./parts";

function Entries({ rows, label }: { rows: { key: string; title: string; sub: string; when?: string }[]; label: string }) {
  return (
    <ItemGroup aria-label={label} className="gap-0">
      {rows.map((r, i) => (
        <div key={r.key}>
          {i > 0 && <ItemSeparator className="my-0" />}
          <Item role="listitem" size="sm" className="items-start justify-between gap-4 px-0">
            <ItemContent>
              <ItemTitle className="text-[14px]">{r.title}</ItemTitle>
              <ItemDescription className="line-clamp-none text-[13px]">{r.sub}</ItemDescription>
            </ItemContent>
            {r.when && <span className="shrink-0 text-[12px] text-hx-ink-soft">{r.when}</span>}
          </Item>
        </div>
      ))}
    </ItemGroup>
  );
}

export function ResumeTab({ candidate, shortlistHref }: { candidate: Candidate; shortlistHref: string }) {
  const resume = candidate.resume;

  return (
    <Masonry>
        <Panel id="summary-heading" title="Summary and achievements">
          {!candidate.unlocked ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <MutedText>Locked. Unlock to read the resume and download the original file.</MutedText>
              <LinkCta href={shortlistHref} size="sm" variant="outline">Unlock from the shortlist</LinkCta>
            </div>
          ) : (
            <div className="grid gap-4">
              {resume?.summary ? <p className="m-0 max-w-[75ch] text-[14px] leading-relaxed text-hx-coal">{resume.summary}</p> : <MutedText>No summary on this resume.</MutedText>}
              {!!resume?.keyAchievements.length && (
                <ul className="m-0 grid list-disc gap-1.5 border-t border-hx-line pt-4 pl-5 text-[13px] leading-relaxed text-hx-coal marker:text-hx-ink-soft">
                  {resume.keyAchievements.map((a) => <li key={a}>{a}</li>)}
                </ul>
              )}
            </div>
          )}
        </Panel>

        <Panel id="employment-heading" title="Employment history">
          {resume?.experience.length ? (
            <Entries label="Employment history" rows={resume.experience.map((e, i) => ({ key: `${e.company}-${i}`, title: e.title || "Role", sub: e.company, when: e.period }))} />
          ) : (
            <MutedText>No structured employment history extracted from this resume.</MutedText>
          )}
        </Panel>

        {!!resume?.education.length && (
          <Panel id="education-heading" title="Education">
            <Entries label="Education" rows={resume.education.map((ed, i) => ({ key: `${ed.school}-${i}`, title: ed.degree, sub: ed.school, when: ed.year }))} />
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
  );
}
