import { tokens as t, fonts as f } from "@/auth/_tokens";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { Card, HelpText } from "@/employer/_atoms";
import { readQuotesLocked } from "@/employer/_candidateFields";
import { BarRow, SectionTitle } from "./atoms";
import { PROVENANCE } from "./helpers";
import { LockedQuotes } from "./Notices";
import { EvidenceStatus } from "./OverviewTab";

export function PracticeTab({
  evidence,
  unlocked,
  shortlistHref,
  state,
}: {
  evidence: CandidateEvidence | null;
  unlocked: boolean;
  shortlistHref: string;
  state: { evidence: CandidateEvidence | null; loading: boolean; failed: boolean; onRetry: () => void };
}) {
  const quotesLocked = readQuotesLocked(evidence, unlocked);
  const skills = evidence?.skills ?? [];

  return (
    <>
      <Card style={{ boxShadow: "none" }} aria-labelledby="skills-heading">
        <SectionTitle id="skills-heading">Skill scores from practice</SectionTitle>
        <EvidenceStatus state={state}>
          {skills.length ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
                {skills.map((s) => (
                  <BarRow key={s.name} label={s.name} pct={s.score} tone={s.score >= 70 ? "success" : s.score >= 50 ? "indigo" : "neutral"} />
                ))}
              </div>
              <HelpText>{PROVENANCE}, from their most recent completed session.</HelpText>
            </>
          ) : (
            <HelpText>No skill scores yet — no completed session has skill data.</HelpText>
          )}
        </EvidenceStatus>
      </Card>

      <Card style={{ boxShadow: "none" }} aria-labelledby="star-heading">
        <SectionTitle id="star-heading">STAR answer completeness</SectionTitle>
        <EvidenceStatus state={state}>
          {evidence?.starCompleteness ? (
            <>
              <div style={{ maxWidth: 360 }}>
                <BarRow
                  label={`Across ${evidence.starCompleteness.questionsConsidered} question${evidence.starCompleteness.questionsConsidered === 1 ? "" : "s"}`}
                  pct={evidence.starCompleteness.pct}
                  tone={evidence.starCompleteness.pct >= 70 ? "success" : evidence.starCompleteness.pct >= 50 ? "indigo" : "neutral"}
                />
              </div>
              <HelpText>Share of answers that covered Situation, Task, Action and Result. {PROVENANCE}.</HelpText>
            </>
          ) : (
            <HelpText>No STAR data yet for this candidate.</HelpText>
          )}
        </EvidenceStatus>
      </Card>

      <Card style={{ boxShadow: "none" }} aria-labelledby="quotes-heading">
        <SectionTitle id="quotes-heading">What they said</SectionTitle>
        <EvidenceStatus state={state}>
          {quotesLocked ? (
            <LockedQuotes shortlistHref={shortlistHref} />
          ) : evidence && evidence.quotes.length > 0 ? (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {evidence.quotes.map((q, i) => {
                const flag = q.kind === "redFlag";
                return (
                  <li
                    key={i}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: flag ? t.error100 : t.success100,
                      border: `1px solid ${flag ? t.errorLine : t.successLine}`,
                    }}
                  >
                    <div style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 700, color: flag ? t.errorInk : t.successInk, marginBottom: 4 }}>
                      {flag ? "Flag" : "Win"} · {q.text}
                    </div>
                    <blockquote style={{ margin: 0, fontFamily: f.sans, fontSize: 13, color: t.neutralInk }}>&ldquo;{q.quote}&rdquo;</blockquote>
                  </li>
                );
              })}
            </ul>
          ) : (
            <HelpText>No quotes recorded from this candidate's sessions.</HelpText>
          )}
        </EvidenceStatus>
      </Card>
    </>
  );
}
