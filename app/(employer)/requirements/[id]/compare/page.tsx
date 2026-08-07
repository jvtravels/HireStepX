"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { formatCtc, Candidate } from "@/employer/mockData";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Card, Eyebrow, ScoreChip, SkillTag, Divider } from "@/employer/_atoms";

function CompareColumn({ candidate }: { candidate: Candidate }) {
  return (
    <Card style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <ScoreChip score={candidate.matchScore} />
        <div>
          <div style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 700, color: t.coal }}>
            {candidate.unlocked ? candidate.name : `Candidate #${candidate.id}`}
          </div>
          <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>{candidate.targetRole} · {candidate.city}</div>
        </div>
      </div>
      <Divider />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
        <div>Match score for this role: <strong style={{ color: t.coal }}>{candidate.matchScore}</strong></div>
        <div>Roster score (lifetime): <strong style={{ color: t.coal }}>{candidate.rosterScore}</strong></div>
        <div>Practice sessions: <strong style={{ color: t.coal }}>{candidate.sessionsCompleted}</strong> · last active {candidate.lastActiveDaysAgo}d ago</div>
        <div>Experience: <strong style={{ color: t.coal }}>{candidate.experienceYears} yrs</strong></div>
        <div>Notice period: <strong style={{ color: t.coal }}>~{candidate.noticePeriodDays} days</strong></div>
        <div>Advisory CTC: <strong style={{ color: t.coal }}>{formatCtc(candidate.ctcAdvisory.low, candidate.ctcAdvisory.high)}</strong></div>
        <div>
          Skills:
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {candidate.skills.map((s) => (
              <SkillTag key={s}>{s}</SkillTag>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ComparePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { getRequirement } = useEmployerData();
  const requirement = getRequirement(params.id);

  const aId = searchParams.get("a");
  const bId = searchParams.get("b");
  const a = requirement?.candidates.find((c) => c.id === aId);
  const b = requirement?.candidates.find((c) => c.id === bId);

  if (!requirement || !a || !b) {
    return (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>
          Select two candidates from the shortlist to compare them.
        </p>
      </Card>
    );
  }

  return (
    <div>
      <Eyebrow tone="indigo">Comparing candidates</Eyebrow>
      <h1 style={{ fontFamily: f.serif, fontSize: 26, color: t.coal, margin: "6px 0 20px" }}>{requirement.title}</h1>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <CompareColumn candidate={a} />
        <CompareColumn candidate={b} />
      </div>
    </div>
  );
}
