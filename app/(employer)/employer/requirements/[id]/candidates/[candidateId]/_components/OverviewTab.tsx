import { useState } from "react";
import { CheckIcon, MinusIcon, TargetIcon, UserRoundIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import type { CandidateEvidence, Requirement } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { OutlineCta } from "@/employer/_atoms";
import { InfoTip, KeyValueList, KeyValueRow, MeterRow, Panel, PanelButton, Stat, StatGrid } from "@/employer/_panelParts";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { ChipList, IconList, MutedText } from "./parts";
import { ItemRequest, type RequestUi } from "./RequestPopover";
import { RequestsPanel } from "./RequestsPanel";
import { RoleMismatchNotice, hasRoleMismatch } from "./RoleMismatchNotice";
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

const FIT_MARK: Record<FitStatus, { icon: typeof CheckIcon; label: string; cls: string }> = {
  meets: { icon: CheckIcon, label: "Meets", cls: "bg-hx-success-100 text-hx-success-ink" },
  partial: { icon: MinusIcon, label: "Close", cls: "bg-hx-warning-100 text-hx-warning-ink" },
  gap: { icon: XIcon, label: "Gap", cls: "bg-hx-error-100 text-hx-error-ink" },
};

function FitMark({ status }: { status: FitStatus }) {
  const { icon: Icon, label, cls } = FIT_MARK[status];
  return (
    <span title={label} className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full", cls)}>
      <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

function MatchPanel({ candidate, requirement, matched, unmatched, evidence, requestUi }: { candidate: Candidate; requirement: Requirement; matched: string[]; unmatched: string[]; evidence: CandidateEvidence | null; requestUi: RequestUi }) {
  const b = candidate.matchBreakdown;
  const rows = buildRoleFit(candidate, requirement, matched, evidence);
  const meets = rows.filter((r) => r.status === "meets").length;
  return (
    <Panel id="match-heading" title="Fit for this role" icon={<TargetIcon size={15} />}>
      <div className="grid gap-5">
        {b && <MeterRow label="Role match" value={b.roleMatch} />}
        {rows.length > 0 && (
          <div>
            <p className="m-0 mb-2 text-[13px] text-hx-ink-soft">
              Meets <span className="font-semibold text-hx-coal tabular-nums">{meets} of {rows.length}</span> criteria set for {requirement.title}
            </p>
            <ul aria-label="Criteria compared with the posting" className="m-0 flex list-none flex-col p-0">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-hx-coal">{row.label}</div>
                    <div className="text-[12px] text-hx-ink-soft [overflow-wrap:anywhere]">Asks for {row.asked}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="max-w-36 text-right text-[13px] font-medium text-hx-coal [overflow-wrap:anywhere]">{row.has}</span>
                    <FitMark status={row.status} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(matched.length > 0 || unmatched.length > 0) && (
          <div className="grid gap-4 border-t border-hx-line pt-4">
            {matched.length > 0 && (
              <div className="grid gap-2">
                <h3 className="m-0 text-[12px] font-medium text-hx-ink-soft">On the resume</h3>
                <ChipList items={matched} tone="primary" label="Required skills on the resume" />
              </div>
            )}
            {unmatched.length > 0 && (
              <div className="grid gap-2">
                <h3 className="m-0 text-[12px] font-medium text-hx-ink-soft">Not on the resume</h3>
                <ChipList items={unmatched} tone="danger" label="Required skills missing from the resume" />
                <ul aria-label="Ask for proof of a missing skill" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
                  {unmatched.slice(0, 6).map((skill) => (
                    <li key={skill}>
                      <ItemRequest
                        candidate={candidate}
                        ui={requestUi}
                        label={`Ask for proof of ${skill}`}
                        preset={{ kind: "document", topic: `Evidence of ${skill}`.slice(0, 120) }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

function ClampedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 220;
  return (
    <div className="grid justify-items-start gap-1">
      <p className={cn("m-0 max-w-[75ch] text-[13px] leading-relaxed whitespace-pre-line text-hx-ink-soft [overflow-wrap:anywhere]", long && !open && "line-clamp-3")}>{text}</p>
      {long && <PanelButton onClick={() => setOpen((v) => !v)} expanded={open}>{open ? "Show less" : "Show more"}</PanelButton>}
    </div>
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
  if (r.noticePeriod) facts.push({ label: "Notice period", value: r.noticePeriod, selfReported: true });
  if (r.currentCtc) facts.push({ label: "Current CTC", value: r.currentCtc, selfReported: true });
  if (r.primaryDomain) {
    const primaryYears = r.domainYears?.find((d) => d.domain.toLowerCase() === r.primaryDomain?.toLowerCase())?.years;
    facts.push({ label: "Domain", value: primaryYears ? `${r.primaryDomain} (${formatYears(primaryYears)})` : r.primaryDomain });
  }
  if (avgTenureMonths != null) facts.push({ label: "Average tenure", value: `${formatTenure(avgTenureMonths)} per role` });
  if (eduText) facts.push({ label: "Education", value: eduText });
  const summary = r.summary?.trim();
  if (!summary && !r.headline && facts.length === 0) return null;
  return (
    <Panel id="profile-heading" title="Profile" icon={<UserRoundIcon size={15} />} action={<PanelButton onClick={onOpenResume}>Full resume</PanelButton>}>
      <div className="grid gap-4">
        {r.headline && <p className="m-0 text-[14px] font-semibold leading-snug text-hx-coal">{r.headline}</p>}
        {facts.length > 0 && (
          <KeyValueList>
            {facts.map((f) => (
              <KeyValueRow key={f.label} label={f.label}>
                {f.value}
                {f.selfReported && <span className="sr-only"> (self-reported)</span>}
              </KeyValueRow>
            ))}
          </KeyValueList>
        )}
        {facts.some((f) => f.selfReported) && <p className="m-0 text-[12px] text-hx-ink-soft">Notice period and CTC are as the candidate entered them.</p>}
        {summary ? (
          <div className="grid gap-1.5 border-t border-hx-line pt-4">
            <h3 className="m-0 text-[12px] font-medium text-hx-ink-soft">Summary</h3>
            <ClampedText text={summary} />
          </div>
        ) : (
          !r.headline && <MutedText>This resume has no written summary. The details above come from the structured fields.</MutedText>
        )}
      </div>
    </Panel>
  );
}

function PracticeSnapshot({ candidate, state, onOpenPractice, requirementTitle, requestUi }: { candidate: Candidate; state: EvidenceState; onOpenPractice: () => void; requirementTitle: string; requestUi: RequestUi }) {
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
            <StatGrid>
              <Stat label="Interviews" hint={last ? `Latest ${last}` : undefined}>{candidate.sessionsCompleted} graded</Stat>
              {evidence?.readiness && <Stat label="Readiness" hint={`${evidence.readiness.confidence} confidence`}>{READINESS_LABEL[evidence.readiness.band]}</Stat>}
              {avg != null && <Stat label="Avg skill score" hint="out of 100">{avg}</Stat>}
              {verified.length > 0 && <Stat label="Verified skills" hint={`of ${verified.length} checked`}>{verifiedCount}</Stat>}
            </StatGrid>
            <div><PanelButton onClick={onOpenPractice}>See every answer and score</PanelButton></div>
          </div>
        ) : evidence && hasRoleMismatch(evidence) ? (
          <RoleMismatchNotice evidence={evidence} candidate={candidate} requirementTitle={requirementTitle} requestUi={requestUi} />
        ) : (
          <MutedText>No graded practice interviews yet, so this match reflects the resume only.</MutedText>
        )}
      </EvidenceStatus>
    </Panel>
  );
}

function AnalysisPanel({ candidate, requirement, unmatched, requestUi }: { candidate: Candidate; requirement: Requirement; unmatched: string[]; requestUi: RequestUi }) {
  const insights = buildResumeInsights(candidate, unmatched);
  const columns = [
    { id: "strengths", title: "Key strengths", items: insights.strengths, empty: "Nothing stands out yet.", icon: CheckIcon, cls: "size-4 text-hx-success", ask: false },
    { id: "concerns", title: "Potential concerns", items: insights.concerns, empty: "Nothing flagged.", icon: MinusIcon, cls: "size-4 text-hx-warning", ask: true },
    { id: "validate", title: "Worth validating", items: insights.validate, empty: "Nothing to confirm.", icon: TargetIcon, cls: "size-4 text-hx-indigo", ask: true },
  ];
  return (
    <Panel id="analysis-heading" title="Resume analysis">
      <p className="m-0 mb-5 max-w-[75ch] text-[14px] leading-snug text-hx-coal">
        {insights.snapshot} <span className="text-hx-ink-soft">Read from the resume against {requirement.title}.</span>
      </p>
      <div className="@container">
        <div className="grid gap-6 @2xl:grid-cols-3 @2xl:gap-8">
          {columns.map((c) => (
            <div key={c.id} className="min-w-0">
              <h3 className="m-0 mb-2 flex items-baseline gap-1.5 text-[13px] font-semibold text-hx-coal">
                {c.title}
                {c.items.length > 0 && <span className="text-[12px] font-medium text-hx-ink-soft tabular-nums">{c.items.length}</span>}
              </h3>
              {c.items.length ? <IconList
                  label={c.title}
                  items={c.items}
                  icon={c.icon}
                  iconClassName={c.cls}
                  renderAction={
                    c.ask
                      ? (text) => (
                          <ItemRequest
                            candidate={candidate}
                            ui={requestUi}
                            label="Ask them about this"
                            preset={{ kind: "clarification", topic: text.slice(0, 120), note: `Could you tell me more about this? ${text}`.slice(0, 300) }}
                          />
                        )
                      : undefined
                  }
                /> : <MutedText>{c.empty}</MutedText>}
            </div>
          ))}
        </div>
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
  requestUi,
}: {
  candidate: Candidate;
  requirement: Requirement;
  matched: string[];
  unmatched: string[];
  state: EvidenceState;
  onOpenPractice: () => void;
  onOpenResume: () => void;
  requestUi: RequestUi;
}) {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      <div className="grid min-w-0 content-start gap-4 lg:order-last">
        <ProfilePanel candidate={candidate} onOpenResume={onOpenResume} />
        <PracticeSnapshot candidate={candidate} state={state} onOpenPractice={onOpenPractice} requirementTitle={requirement.title} requestUi={requestUi} />
      </div>
      <div className="grid min-w-0 content-start gap-4 lg:order-first">
        <MatchPanel candidate={candidate} requirement={requirement} matched={matched} unmatched={unmatched} evidence={state.evidence} requestUi={requestUi} />
        <AnalysisPanel candidate={candidate} requirement={requirement} unmatched={unmatched} requestUi={requestUi} />
        <RequestsPanel state={requestUi.state} disabled={requestUi.disabled} />
      </div>
    </div>
  );
}
