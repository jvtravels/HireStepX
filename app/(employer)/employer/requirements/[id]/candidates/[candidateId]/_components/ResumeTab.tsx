import { tokens as t, fonts as f } from "@/auth/_tokens";
import type { Candidate } from "@/employer/mockData";
import { Card, Divider, HelpText, SkillTag } from "@/employer/_atoms";
import { SectionTitle, SnapshotCell } from "./atoms";
import Link from "next/link";

const bodyText = { fontFamily: f.sans, fontSize: 13.5, color: t.neutralInk, lineHeight: 1.6 } as const;

function TagList({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: 6, flexWrap: "wrap" }}>
      {items.map((s) => (
        <li key={s}>
          <SkillTag>{s}</SkillTag>
        </li>
      ))}
    </ul>
  );
}

export function ResumeTab({ candidate, phone, shortlistHref }: { candidate: Candidate; phone: boolean; shortlistHref: string }) {
  const resume = candidate.resume;
  const linkStyle = { color: t.indigoDeep, fontWeight: 600 } as const;

  return (
    <>
      <Card style={{ boxShadow: "none" }} aria-labelledby="resume-heading">
        <SectionTitle id="resume-heading">Resume summary</SectionTitle>
        {!candidate.unlocked ? (
          <HelpText>
            This candidate's summary is locked. <Link href={shortlistHref} style={linkStyle}>Unlock from the shortlist</Link> to view.
          </HelpText>
        ) : resume?.summary ? (
          <p style={{ ...bodyText, margin: 0 }}>{resume.summary}</p>
        ) : (
          <HelpText>No resume summary available for this candidate.</HelpText>
        )}

        <div style={{ display: "grid", gridTemplateColumns: phone ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", gap: 16, marginTop: 16 }}>
          <SnapshotCell label="Seniority" value={resume?.seniorityLevel || "—"} />
          <SnapshotCell label="Experience" value={resume?.yearsExperience != null ? `${resume.yearsExperience} yrs` : "—"} />
          <SnapshotCell label="Practice sessions" value={`${candidate.sessionsCompleted}`} />
        </div>

        {!!resume?.keyAchievements.length && (
          <>
            <div style={{ marginTop: 14 }}><Divider /></div>
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Key achievements (from resume)</SectionTitle>
              <ul style={{ margin: 0, paddingLeft: 18, fontFamily: f.sans, fontSize: 13, color: t.neutralInk, lineHeight: 1.7 }}>
                {resume.keyAchievements.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </Card>

      <Card style={{ boxShadow: "none" }} aria-labelledby="history-heading">
        <SectionTitle id="history-heading">Employment history</SectionTitle>
        {resume?.experience.length ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {resume.experience.map((e, i) => (
              <li key={`${e.company}-${i}`} style={{ paddingBottom: 14, borderBottom: i < resume.experience.length - 1 ? `1px solid ${t.line}` : "none" }}>
                <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal }}>{e.title || "Role"}</div>
                <div style={{ fontFamily: f.sans, fontSize: 13, color: t.neutralInk, marginTop: 2 }}>{e.company}</div>
                {e.period && <div style={{ fontFamily: f.sans, fontSize: 12, color: t.neutralInk, marginTop: 2 }}>{e.period}</div>}
              </li>
            ))}
          </ul>
        ) : (
          <HelpText>No structured employment history extracted from this resume.</HelpText>
        )}

        {!!resume?.industries.length && (
          <>
            <div style={{ marginTop: 14 }}><Divider /></div>
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Industries</SectionTitle>
              <TagList items={resume.industries} />
            </div>
          </>
        )}

        {(resume?.noticePeriod || resume?.currentCtc) && (
          <>
            <div style={{ marginTop: 14 }}><Divider /></div>
            <div style={{ marginTop: 14 }}>
              <SectionTitle>As stated on resume</SectionTitle>
              <div style={{ fontFamily: f.sans, fontSize: 13, color: t.neutralInk, display: "flex", flexDirection: "column", gap: 4 }}>
                {resume?.noticePeriod && <div>Notice period: <strong style={{ color: t.coal }}>{resume.noticePeriod}</strong></div>}
                {resume?.currentCtc && <div>Current CTC: <strong style={{ color: t.coal }}>{resume.currentCtc}</strong></div>}
              </div>
              <HelpText>Self-reported by the candidate's resume text — not independently verified.</HelpText>
            </div>
          </>
        )}
      </Card>

      <Card style={{ boxShadow: "none" }} aria-labelledby="tools-heading">
        <SectionTitle id="tools-heading">Tools &amp; skills</SectionTitle>
        {candidate.skills.length ? <TagList items={candidate.skills} /> : <HelpText>No tools or skills listed on this resume.</HelpText>}
        {!!resume?.certifications.length && (
          <>
            <div style={{ marginTop: 14 }}><Divider /></div>
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Certifications</SectionTitle>
              <TagList items={resume.certifications} />
            </div>
          </>
        )}
      </Card>

      <Card style={{ boxShadow: "none" }} aria-labelledby="portfolio-heading">
        <SectionTitle id="portfolio-heading">Portfolio &amp; work samples</SectionTitle>
        {!candidate.unlocked ? (
          <HelpText>Portfolio links are locked until this candidate is unlocked.</HelpText>
        ) : candidate.portfolioLinks?.length ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {candidate.portfolioLinks.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <SkillTag>
                    {link.title}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </SkillTag>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <HelpText>No portfolio or project links on file for this candidate.</HelpText>
        )}
      </Card>
    </>
  );
}
