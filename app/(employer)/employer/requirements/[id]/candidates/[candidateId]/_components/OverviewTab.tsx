import { tokens as t, fonts as f } from "@/auth/_tokens";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { Card, HelpText, OutlineCta, Pill } from "@/employer/_atoms";
import type { Candidate } from "@/employer/mockData";
import { SectionTitle } from "./atoms";
import { HiringProgress } from "./HiringProgress";
import {
  PROVENANCE,
  READINESS_LABEL,
  READINESS_TONE,
  formatSessionDate,
} from "./helpers";

type EvidenceState = {
  evidence: CandidateEvidence | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
};

export function EvidenceStatus({
  state,
  children,
}: {
  state: EvidenceState;
  children: React.ReactNode;
}) {
  if (state.loading)
    return (
      <div role="status">
        <HelpText>Loading practice-session evidence…</HelpText>
      </div>
    );
  if (state.failed) {
    return (
      <div
        role="alert"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 10,
        }}
      >
        <HelpText tone="error" live={false}>
          Couldn't load practice-session evidence.
        </HelpText>
        <OutlineCta size="sm" onClick={state.onRetry}>
          Try again
        </OutlineCta>
      </div>
    );
  }
  return <>{children}</>;
}

export function OverviewTab({
  candidate,
  fitReasons,
  requirementTitle,
  state,
}: {
  candidate: Candidate;
  fitReasons: string[];
  requirementTitle: string;
  state: EvidenceState;
}) {
  const { evidence } = state;
  const hasTrackRecord = !!(
    evidence?.readiness ||
    evidence?.starCompleteness ||
    evidence?.skills.length
  );
  const verified = evidence?.verifiedCapabilities ?? [];

  return (
    <>
      {fitReasons.length > 0 && (
        <Card style={{ boxShadow: "none" }} aria-labelledby="fit-heading">
          <SectionTitle id="fit-heading">
            Why this candidate fits {requirementTitle}
          </SectionTitle>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontFamily: f.sans,
              fontSize: 13.5,
              color: t.neutralInk,
              lineHeight: 1.8,
            }}
          >
            {fitReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Card>
      )}

      {(state.loading || state.failed || hasTrackRecord) && (
        <Card style={{ boxShadow: "none" }} aria-labelledby="track-heading">
          <SectionTitle id="track-heading">Practice track record</SectionTitle>
          <EvidenceStatus state={state}>
            {hasTrackRecord ? (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  {evidence?.readiness && (
                    <Pill tone={READINESS_TONE[evidence.readiness.band]}>
                      {READINESS_LABEL[evidence.readiness.band]} readiness ·{" "}
                      {evidence.readiness.confidence} confidence
                    </Pill>
                  )}
                  {evidence?.starCompleteness && (
                    <Pill tone="neutral">
                      STAR completeness: {evidence.starCompleteness.pct}%
                    </Pill>
                  )}
                  {evidence?.sessionDate &&
                    formatSessionDate(evidence.sessionDate) && (
                      <Pill tone="neutral">
                        Last session {formatSessionDate(evidence.sessionDate)}
                      </Pill>
                    )}
                </div>
                <HelpText>
                  {PROVENANCE}. This is practice performance, not a verified
                  employment check.
                </HelpText>
              </>
            ) : (
              <HelpText>
                No graded practice sessions yet for this candidate.
              </HelpText>
            )}
          </EvidenceStatus>
        </Card>
      )}

      {(state.loading || state.failed || verified.length > 0) && (
        <Card style={{ boxShadow: "none" }} aria-labelledby="verified-heading">
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <SectionTitle id="verified-heading">
              Verified capabilities
            </SectionTitle>
            {verified.length > 0 && (
              <span
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  color: t.neutralInk,
                }}
              >
                {verified.filter((c) => c.verified).length} of {verified.length}{" "}
                verified
              </span>
            )}
          </div>
          <EvidenceStatus state={state}>
            {verified.length === 0 ? (
              <HelpText>No practice session data yet.</HelpText>
            ) : (
              <>
                <ul
                  style={{
                    listStyle: "none",
                    margin: "10px 0 14px",
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {verified.map((cap) => (
                    <li
                      key={cap.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        flexWrap: "wrap",
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: cap.verified ? t.success100 : t.creamSoft,
                        border: `1px solid ${cap.verified ? t.successLine : t.line}`,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: f.sans,
                          fontSize: 13.5,
                          color: t.coal,
                        }}
                      >
                        {cap.label}
                      </span>
                      <Pill tone={cap.verified ? "success" : "neutral"}>
                        {cap.verified
                          ? `Verified${cap.verifiedDateLabel ? ` · ${cap.verifiedDateLabel}` : ""}`
                          : "Not yet verified"}
                      </Pill>
                    </li>
                  ))}
                </ul>
                <HelpText>
                  "Verified" means this candidate scored 70+ on the underlying
                  skill across 2 or more separate practice sessions — the same
                  bar shown on their own dashboard, not a looser or stricter one
                  for employers.
                </HelpText>
              </>
            )}
          </EvidenceStatus>
        </Card>
      )}

      <Card style={{ boxShadow: "none" }} aria-labelledby="progress-heading">
        <SectionTitle id="progress-heading">Hiring progress</SectionTitle>
        <HiringProgress status={candidate.candidateStatus} />
      </Card>
    </>
  );
}
