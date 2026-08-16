"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEmployerData, Requirement } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import {
  Card,
  Divider,
  EmployerIcon,
  HelpText,
  Pill,
  ScoreChip,
  SkillTag,
  StatCell,
} from "@/employer/_atoms";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: t.inkFaint, margin: "0 0 12px" }}>
      {children}
    </h2>
  );
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string; candidateId: string }>();
  const { fetchRequirementDetail } = useEmployerData();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchRequirementDetail(params.id);
    setRequirement(r);
    setLoading(false);
  }, [fetchRequirementDetail, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Loading…</p>
      </Card>
    );
  }

  const candidate = requirement?.candidates.find((c) => c.id === params.candidateId);

  if (!requirement || !candidate) {
    return (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, marginBottom: 16 }}>Candidate not found.</p>
        <Link href={`/employer/requirements/${params.id}`} style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.indigo, textDecoration: "none" }}>
          ← Back to shortlist
        </Link>
      </Card>
    );
  }

  const resume = candidate.resume;
  const displayName = candidate.unlocked ? candidate.name : `Candidate #${candidate.id.slice(0, 6)}`;

  return (
    <div>
      <Link
        href={`/employer/requirements/${requirement.id}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: t.inkSoft, textDecoration: "none", marginBottom: 16 }}
      >
        <span style={{ display: "inline-block", transform: "rotate(180deg)" }}>
          <EmployerIcon.Arrow />
        </span>
        {requirement.title}
      </Link>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <ScoreChip score={candidate.matchScore} />
            <div>
              <h1 style={{ fontFamily: f.serif, fontSize: 26, color: t.coal, margin: 0 }}>{displayName}</h1>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginTop: 4 }}>
                {candidate.targetRole} · {candidate.city}
              </div>
              {resume?.headline && (
                <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, marginTop: 6 }}>{resume.headline}</div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {candidate.skills.map((s) => (
                  <SkillTag key={s}>{s}</SkillTag>
                ))}
              </div>
            </div>
          </div>
          <Pill tone={candidate.unlocked ? "success" : "neutral"}>{candidate.unlocked ? "Unlocked" : "Locked"}</Pill>
        </div>

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.line}` }}>
          {candidate.unlocked ? (
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap", fontFamily: f.sans, fontSize: 13, color: t.coal }}>
              {candidate.contact?.email && <span>{candidate.contact.email}</span>}
              {candidate.contact?.phone && <span>{candidate.contact.phone}</span>}
              {resume?.linkedin && (
                <a href={`https://${resume.linkedin.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" style={{ color: t.indigo, textDecoration: "none", fontWeight: 600 }}>
                  {resume.linkedin}
                </a>
              )}
            </div>
          ) : (
            <HelpText>
              Contact details are locked. <Link href={`/employer/requirements/${requirement.id}`} style={{ color: t.indigo, fontWeight: 600 }}>Unlock from the shortlist</Link> to view.
            </HelpText>
          )}
        </div>
      </Card>

      <Card style={{ marginBottom: 16, padding: "4px 20px" }}>
        <div style={{ display: "flex" }}>
          <StatCell label="Match score" value={String(candidate.matchScore)} unit="/ 100" />
          <StatCell label="Roster score" value={String(candidate.rosterScore)} unit="/ 100" />
          <StatCell label="Practice sessions" value={String(candidate.sessionsCompleted)} unit="" />
          <StatCell label="Last active" value={candidate.lastActiveDaysAgo < 0 ? "—" : `${candidate.lastActiveDaysAgo}d`} unit={candidate.lastActiveDaysAgo < 0 ? "" : "ago"} />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, alignItems: "start" }}>
        <Card>
          <SectionTitle>About</SectionTitle>
          {resume?.summary ? (
            <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.6, margin: 0 }}>{resume.summary}</p>
          ) : (
            <HelpText>No resume summary available for this candidate.</HelpText>
          )}

          {(resume?.seniorityLevel || resume?.yearsExperience != null) && (
            <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, marginTop: 10 }}>
              {[resume?.seniorityLevel, resume?.yearsExperience != null ? `${resume.yearsExperience} yrs experience` : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}

          {!!resume?.keyAchievements.length && (
            <>
              <Divider />
              <div style={{ marginTop: 14 }}>
                <SectionTitle>Key achievements</SectionTitle>
                <ul style={{ margin: 0, paddingLeft: 18, fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.7 }}>
                  {resume.keyAchievements.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {!!resume?.industries.length && (
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Industries</SectionTitle>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {resume.industries.map((i) => (
                  <SkillTag key={i}>{i}</SkillTag>
                ))}
              </div>
            </div>
          )}

          {!!resume?.certifications.length && (
            <div style={{ marginTop: 14 }}>
              <SectionTitle>Certifications</SectionTitle>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {resume.certifications.map((c) => (
                  <SkillTag key={c}>{c}</SkillTag>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle>Employment history</SectionTitle>
          {resume?.experience.length ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {resume.experience.map((e, i) => (
                <div key={`${e.company}-${i}`} style={{ paddingBottom: 14, borderBottom: i < resume.experience.length - 1 ? `1px solid ${t.line}` : "none" }}>
                  <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal }}>{e.title || "Role"}</div>
                  <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 2 }}>{e.company}</div>
                  {e.period && <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginTop: 2 }}>{e.period}</div>}
                </div>
              ))}
            </div>
          ) : (
            <HelpText>No structured employment history extracted from this resume.</HelpText>
          )}

          {!!resume?.education.length && (
            <>
              <Divider />
              <div style={{ marginTop: 14 }}>
                <SectionTitle>Education</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {resume.education.map((ed, i) => (
                    <div key={`${ed.school}-${i}`} style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                      <strong style={{ color: t.coal }}>{ed.degree}</strong>
                      {ed.school ? ` — ${ed.school}` : ""}
                      {ed.year ? ` · ${ed.year}` : ""}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {(resume?.noticePeriod || resume?.currentCtc) && (
            <>
              <Divider />
              <div style={{ marginTop: 14 }}>
                <SectionTitle>As stated on resume</SectionTitle>
                <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, display: "flex", flexDirection: "column", gap: 4 }}>
                  {resume?.noticePeriod && <div>Notice period: <strong style={{ color: t.coal }}>{resume.noticePeriod}</strong></div>}
                  {resume?.currentCtc && <div>Current CTC: <strong style={{ color: t.coal }}>{resume.currentCtc}</strong></div>}
                </div>
                <HelpText>Self-reported by the candidate's resume text — not independently verified.</HelpText>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
