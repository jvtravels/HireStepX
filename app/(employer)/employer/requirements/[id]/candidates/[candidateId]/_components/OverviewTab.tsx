import { CheckIcon, MinusIcon, TargetIcon, UserRoundIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CandidateEvidence, Requirement } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { Badge, OutlineCta } from "@/employer/_atoms";
import { InfoTip, KeyValueList, KeyValueRow, MeterRow, Panel, PanelButton } from "@/employer/_panelParts";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { ChipList, IconList, MutedText } from "./parts";
import { PROVENANCE, READINESS_LABEL, averageTenureMonths, buildResumeInsights, buildRoleFit, employerCapabilities, evidenceAverage, formatSessionDate, formatTenure, formatYears, type FitStatus } from "./helpers";

export type EvidenceState = { evidence: CandidateEvidence | null; loading: boolean; failed: boolean; onRetry: () => void };

export function EvidenceStatus({ state, children }: { state: EvidenceState; children: React.ReactNode }) {
  if (state.loading) {
    return (
      <div role="status" className="grid gap-3">
        <span className="sr-only">Loading practice-session evidence…</span>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/5" />
      </div>
    );
  }
  if (state.failed) {
    return (
      <InlineNotice tone="error" action={<OutlineCta size="sm" onClick={state.onRetry}>Try again</OutlineCta>}>
        Couldn&apos;t load practice-session evidence.
      </InlineNotice>
    );
  }
  return <>{children}</>;
}

const FIT_BADGE: Record<FitStatus, { tone: "success" | "warning" | "error"; label: string }> = {
  meets: { tone: "success", label: "Meets" },
  partial: { tone: "warning", label: "Close" },
  gap: { tone: "error", label: "Gap" },
};

function MatchPanel({ candidate, requirement, matched, unmatched, evidence }: { candidate: Candidate; requirement: Requirement; matched: string[]; unmatched: string[]; evidence: CandidateEvidence | null }) {
  const b = candidate.matchBreakdown;
  const rows = buildRoleFit(candidate, requirement, matched, evidence);
  const meets = rows.filter((r) => r.status === "meets").length;
  return (
    <Panel id="match-heading" title="Fit for this role" icon={<TargetIcon size={15} />}>
      <div className="grid gap-5">
        {b && (
          <div className="grid gap-3.5">
            <MeterRow label="Role match" value={b.roleMatch} />
            <MeterRow label="Required skills" value={requirement.skills.length > 0 ? Math.round((matched.length / requirement.skills.length) * 100) : b.skillMatch} />
            <p className="m-0 text-[12px] text-hx-ink-soft">
              The {candidate.matchScore} match score blends these with practice results and recent activity, so it can differ from the two bars.
            </p>
          </div>
        )}
        {rows.length > 0 && (
          <div className={b ? "border-t border-hx-line pt-4" : undefined}>
            <p className="m-0 mb-1 text-[13px] text-hx-ink-soft">
              Meets <span className="font-semibold text-hx-coal tabular-nums">{meets} of {rows.length}</span> criteria set for {requirement.title}
            </p>
            <ul aria-label="Criteria compared with the posting" className="m-0 flex list-none flex-col p-0">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 border-b border-hx-line py-2.5 last:border-b-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-hx-coal">{row.label}</div>
                    <div className="text-[12px] text-hx-ink-soft [overflow-wrap:anywhere]">Asks for {row.asked}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="max-w-32 text-right text-[13px] font-medium text-hx-coal [overflow-wrap:anywhere]">{row.has}</span>
                    <Badge tone={FIT_BADGE[row.status].tone}>{FIT_BADGE[row.status].label}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(matched.length > 0 || unmatched.length > 0) && (
          <div className="grid gap-3 border-t border-hx-line pt-4">
            {matched.length > 0 && (
              <div className="grid gap-1.5">
                <h3 className="m-0 text-[13px] font-semibold text-hx-coal">On the resume</h3>
                <ChipList items={matched} tone="primary" label="Required skills on the resume" />
              </div>
            )}
            {unmatched.length > 0 && (
              <div className="grid gap-1.5">
                <h3 className="m-0 text-[13px] font-semibold text-hx-coal">Not on the resume</h3>
                <ChipList items={unmatched} tone="danger" label="Required skills missing from the resume" />
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function ProfilePanel({ candidate, onOpenResume }: { candidate: Candidate; onOpenResume: () => void }) {
  const r = candidate.resume;
  if (!r) return null;
  const latest = r.experience[0];
  const latestRole = latest ? [latest.title, latest.company].filter(Boolean).join(" at ") : "";
  const edu = r.education[0];
  const eduText = edu ? [edu.degree, edu.school].filter(Boolean).join(", ") : "";
  const avgTenureMonths = averageTenureMonths(r.experience);
  const facts: Array<{ label: string; value: string; selfReported?: boolean }> = [];
  if (latestRole) facts.push({ label: "Latest role", value: latest?.period ? `${latestRole} (${latest.period})` : latestRole });
  if (r.yearsExperience != null) facts.push({ label: "Experience", value: `${formatYears(r.yearsExperience)}${r.seniorityLevel ? `, ${r.seniorityLevel}` : ""}` });
  if (avgTenureMonths != null) facts.push({ label: "Average tenure", value: `${formatTenure(avgTenureMonths)} per role` });
  if (eduText) facts.push({ label: "Education", value: eduText });
  if (r.noticePeriod) facts.push({ label: "Notice period", value: r.noticePeriod, selfReported: true });
  if (r.currentCtc) facts.push({ label: "Current CTC", value: r.currentCtc, selfReported: true });
  const summary = r.summary?.trim();
  if (!summary && !r.headline && facts.length === 0) return null;
  const hasIntro = !!(r.headline || summary);
  return (
    <Panel id="profile-heading" title="Profile" icon={<UserRoundIcon size={15} />} action={<PanelButton onClick={onOpenResume}>Full resume</PanelButton>}>
      <div className="grid gap-4">
        {!r.headline && !summary && <MutedText>This resume has no written summary. The details below come from the structured fields.</MutedText>}
        {(r.headline || summary) && (
          <div className="grid gap-1.5">
            {r.headline && <p className="m-0 text-[13px] font-semibold leading-snug text-hx-coal">{r.headline}</p>}
            {summary && <p className="m-0 max-w-[75ch] text-[13px] leading-relaxed whitespace-pre-line text-hx-ink-soft [overflow-wrap:anywhere]">{summary}</p>}
          </div>
        )}
        {facts.length > 0 && (
          <KeyValueList className={hasIntro ? "border-t border-hx-line pt-4" : undefined}>
            {facts.map((f) => (
              <KeyValueRow key={f.label} label={f.label}>
                {f.value}
                {f.selfReported && <span className="sr-only"> (self-reported)</span>}
              </KeyValueRow>
            ))}
          </KeyValueList>
        )}
        {facts.some((f) => f.selfReported) && <p className="m-0 text-[12px] text-hx-ink-soft">Notice period and CTC are as the candidate entered them.</p>}
      </div>
    </Panel>
  );
}

function PracticeSnapshot({ candidate, state, onOpenPractice }: { candidate: Candidate; state: EvidenceState; onOpenPractice: () => void }) {
  const { evidence } = state;
  const avg = evidenceAverage(evidence);
  const hasEvidence = !!(evidence?.readiness || evidence?.starCompleteness || evidence?.skills.length || evidence?.questions?.length);
  const verified = employerCapabilities(evidence?.verifiedCapabilities ?? []);
  const verifiedCount = verified.filter((c) => c.verified).length;
  const last = evidence?.sessionDate ? formatSessionDate(evidence.sessionDate) : "";
  const tip = (
    <InfoTip label="How practice evidence is scored">
      {PROVENANCE}. This is practice performance, not an employment check.
    </InfoTip>
  );

  return (
    <Panel id="evidence-heading" title="Practice snapshot" action={tip}>
      <EvidenceStatus state={state}>
        {hasEvidence ? (
          <div className="grid gap-4">
            <KeyValueList className="md:grid md:grid-cols-2 md:gap-x-10 xl:grid-cols-4">
              <KeyValueRow label="Interviews">
                {candidate.sessionsCompleted} graded{last ? <span className="font-normal text-hx-ink-soft">, latest {last}</span> : null}
              </KeyValueRow>
              {evidence?.readiness && <KeyValueRow label="Readiness">{READINESS_LABEL[evidence.readiness.band]} <span className="font-normal text-hx-ink-soft">({evidence.readiness.confidence} confidence)</span></KeyValueRow>}
              {avg != null && <KeyValueRow label="Avg skill score"><span className="tabular-nums">{avg} / 100</span></KeyValueRow>}
              {verified.length > 0 && <KeyValueRow label="Verified skills"><span className="tabular-nums">{verifiedCount} of {verified.length}</span></KeyValueRow>}
            </KeyValueList>
            <div><PanelButton onClick={onOpenPractice}>See every answer and score</PanelButton></div>
          </div>
        ) : (
          <MutedText>No graded practice interviews yet, so this match reflects the resume only.</MutedText>
        )}
      </EvidenceStatus>
    </Panel>
  );
}

function AnalysisPanel({ candidate, requirement, unmatched }: { candidate: Candidate; requirement: Requirement; unmatched: string[] }) {
  const insights = buildResumeInsights(candidate, unmatched);
  const columns = [
    { id: "strengths", title: "Key strengths", items: insights.strengths, empty: "Nothing stands out yet.", icon: CheckIcon, cls: "size-4 text-hx-success" },
    { id: "concerns", title: "Potential concerns", items: insights.concerns, empty: "Nothing flagged.", icon: MinusIcon, cls: "size-4 text-hx-warning" },
    { id: "validate", title: "Worth validating", items: insights.validate, empty: "Nothing to confirm.", icon: TargetIcon, cls: "size-4 text-hx-indigo" },
  ];
  return (
    <Panel id="analysis-heading" title="Resume analysis">
      <p className="m-0 mb-4 max-w-[75ch] text-[13px] text-hx-ink-soft">{insights.snapshot} Read from the resume against {requirement.title}.</p>
      <div className="grid gap-5 md:grid-cols-3 md:gap-8">
        {columns.map((c) => (
          <div key={c.id} className="min-w-0">
            <h3 className="m-0 mb-1.5 text-[13px] font-semibold text-hx-coal">{c.title}</h3>
            {c.items.length ? <IconList label={c.title} items={c.items} icon={c.icon} iconClassName={c.cls} /> : <MutedText>{c.empty}</MutedText>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function OverviewTab({
  candidate,
  requirement,
  matched,
  unmatched,
  state,
  onOpenPractice,
  onOpenResume,
}: {
  candidate: Candidate;
  requirement: Requirement;
  matched: string[];
  unmatched: string[];
  state: EvidenceState;
  onOpenPractice: () => void;
  onOpenResume: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <ProfilePanel candidate={candidate} onOpenResume={onOpenResume} />
        <MatchPanel candidate={candidate} requirement={requirement} matched={matched} unmatched={unmatched} evidence={state.evidence} />
      </div>
      <PracticeSnapshot candidate={candidate} state={state} onOpenPractice={onOpenPractice} />
      <AnalysisPanel candidate={candidate} requirement={requirement} unmatched={unmatched} />
    </div>
  );
}
