import { tokens as t, fonts as f } from "@/auth/_tokens";
import type { Candidate } from "@/employer/mockData";
import { Card, HelpText, SkillTag } from "@/employer/_atoms";
import { SectionTitle, SnapshotCell, UnlockLink } from "./atoms";

export function SideRail({
  candidate,
  matchedSkills,
  unmatchedSkills,
  shortlistHref,
}: {
  candidate: Candidate;
  matchedSkills: string[];
  unmatchedSkills: string[];
  shortlistHref: string;
}) {
  const resume = candidate.resume;
  return (
    <>
      <Card style={{ boxShadow: "none" }} aria-labelledby="snapshot-heading">
        <SectionTitle id="snapshot-heading">Candidate snapshot</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <SnapshotCell label="Experience" value={resume?.yearsExperience != null ? `${resume.yearsExperience} yrs` : "—"} />
          <SnapshotCell label="Notice period" value={resume?.noticePeriod || "—"} />
          <SnapshotCell label="Current CTC" value={resume?.currentCtc || "—"} />
          <SnapshotCell label="Roster score · sessions" value={`${candidate.rosterScore} · ${candidate.sessionsCompleted}`} />
        </div>
        {(resume?.noticePeriod || resume?.currentCtc) && <HelpText>Notice period and CTC are self-reported on the resume.</HelpText>}
      </Card>

      <Card style={{ boxShadow: "none" }} aria-labelledby="skills-match-heading">
        <SectionTitle id="skills-match-heading">Required skills</SectionTitle>
        {matchedSkills.length === 0 && unmatchedSkills.length === 0 ? (
          <HelpText>This requirement lists no required skills.</HelpText>
        ) : (
          <>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {matchedSkills.map((s) => (
                <li key={s}>
                  <SkillTag>
                    {s}
                    <span className="sr-only"> (found on resume)</span>
                  </SkillTag>
                </li>
              ))}
              {unmatchedSkills.map((s) => (
                <li
                  key={s}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: `1px dashed ${t.lineStrong}`,
                    fontFamily: f.sans,
                    fontSize: 12,
                    color: t.neutralInk,
                  }}
                >
                  {s}
                  <span className="sr-only"> (not found on resume)</span>
                </li>
              ))}
            </ul>
            {unmatchedSkills.length > 0 && <HelpText>Dashed tags aren't on this candidate's resume yet.</HelpText>}
          </>
        )}
      </Card>

      {!!resume?.education.length && (
        <Card style={{ boxShadow: "none" }} aria-labelledby="education-heading">
          <SectionTitle id="education-heading">Education</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resume.education.map((ed, i) => (
              <SnapshotCell key={`${ed.school}-${i}`} label="Degree" value={`${ed.degree}${ed.school ? ` — ${ed.school}` : ""}${ed.year ? ` · ${ed.year}` : ""}`} />
            ))}
          </div>
        </Card>
      )}

      {!candidate.unlocked && (
        <Card style={{ boxShadow: "none", border: `1px dashed ${t.lineStrong}` }} aria-labelledby="identity-heading">
          <SectionTitle id="identity-heading">Identity locked</SectionTitle>
          <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.neutralInk, lineHeight: 1.6, margin: "0 0 12px" }}>
            Name, contact details, portfolio links and verbatim quotes stay hidden until this candidate is unlocked.
          </p>
          <UnlockLink href={shortlistHref}>Unlock from the shortlist</UnlockLink>
        </Card>
      )}
    </>
  );
}
