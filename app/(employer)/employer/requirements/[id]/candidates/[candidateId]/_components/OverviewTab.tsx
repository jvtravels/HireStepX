import { useState } from "react";
import { CheckIcon, MinusIcon, TargetIcon } from "lucide-react";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import type { CandidateEvidence, Requirement } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { Badge, OutlineCta } from "@/employer/_atoms";
import { InfoTip, KeyValueList, KeyValueRow, MeterRow, Panel, PanelButton } from "@/employer/_panelParts";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { IconList, MutedText } from "./parts";
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

const FIT_BADGE: Record<FitStatus, { tone: "success" | "warning" | "error"; label: string }> = {
  meets: { tone: "success", label: "Meets" },
  partial: { tone: "warning", label: "Close" },
  gap: { tone: "error", label: "Gap" },
};

function MatchPanel({ candidate, requirement, matched, unmatched, evidence, requestUi }: { candidate: Candidate; requirement: Requirement; matched: string[]; unmatched: string[]; evidence: CandidateEvidence | null; requestUi: RequestUi }) {
  const b = candidate.matchBreakdown;
  const rows = buildRoleFit(candidate, requirement, matched, evidence);
  const meets = rows.filter((r) => r.status === "meets").length;
  return (
    <Panel plain id="match-heading" title="Fit for this role">
      <div className="grid gap-5">
        {b && (
          <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
            <MeterRow label="Role match" value={b.roleMatch} />
            <MeterRow label="Required skills" value={requirement.skills.length > 0 ? Math.round((matched.length / requirement.skills.length) * 100) : b.skillMatch} />
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
          <div className="grid gap-2 border-t border-hx-line pt-4 text-[13px] leading-relaxed text-hx-ink-soft">
            {matched.length > 0 && (
              <p className="m-0 [overflow-wrap:anywhere]">
                <span className="font-semibold text-hx-coal">On the resume: </span>
                {matched.join(", ")}
              </p>
            )}
            {unmatched.length > 0 && (
              <p className="m-0 [overflow-wrap:anywhere]">
                <span className="font-semibold text-hx-coal">Not on the resume: </span>
                {unmatched.join(", ")}
              </p>
            )}
            {unmatched.length > 0 && (
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
  if (r.primaryDomain) {
    const primaryYears = r.domainYears?.find((d) => d.domain.toLowerCase() === r.primaryDomain?.toLowerCase())?.years;
    facts.push({ label: "Domain", value: primaryYears ? `${r.primaryDomain} (${formatYears(primaryYears)})` : r.primaryDomain });
  }
  if (avgTenureMonths != null) facts.push({ label: "Average tenure", value: `${formatTenure(avgTenureMonths)} per role` });
  if (eduText) facts.push({ label: "Education", value: eduText });
  if (r.noticePeriod) facts.push({ label: "Notice period", value: r.noticePeriod, selfReported: true });
  if (r.currentCtc) facts.push({ label: "Current CTC", value: r.currentCtc, selfReported: true });
  const summary = r.summary?.trim();
  if (!summary && !r.headline && facts.length === 0) return null;
  const hasIntro = !!(r.headline || summary);
  return (
    <Panel plain id="profile-heading" title="Profile" action={<PanelButton onClick={onOpenResume}>Full resume</PanelButton>}>
      <div className="grid gap-4">
        {!r.headline && !summary && <MutedText>This resume has no written summary. The details below come from the structured fields.</MutedText>}
        {(r.headline || summary) && (
          <div className="grid gap-1.5">
            {r.headline && <p className="m-0 text-[13px] font-semibold leading-snug text-hx-coal">{r.headline}</p>}
            {summary && <ClampedText text={summary} />}
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
    <Panel plain id="evidence-heading" title="Practice snapshot" action={tip}>
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
    <Panel plain id="analysis-heading" title="Resume analysis">
      <p className="m-0 mb-4 max-w-[75ch] text-[13px] text-hx-ink-soft">{insights.snapshot} Read from the resume against {requirement.title}.</p>
      <div className="grid gap-5 md:grid-cols-3 md:gap-8">
        {columns.map((c) => (
          <div key={c.id} className="min-w-0">
            <h3 className="m-0 mb-1.5 text-[13px] font-semibold text-hx-coal">{c.title}</h3>
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
    <div className="grid min-w-0 gap-7">
      <div className="grid min-w-0 gap-x-10 gap-y-7 lg:grid-cols-2">
        <ProfilePanel candidate={candidate} onOpenResume={onOpenResume} />
        <MatchPanel candidate={candidate} requirement={requirement} matched={matched} unmatched={unmatched} evidence={state.evidence} requestUi={requestUi} />
      </div>
      <PracticeSnapshot candidate={candidate} state={state} onOpenPractice={onOpenPractice} requirementTitle={requirement.title} requestUi={requestUi} />
      <AnalysisPanel candidate={candidate} requirement={requirement} unmatched={unmatched} requestUi={requestUi} />
      <RequestsPanel state={requestUi.state} disabled={requestUi.disabled} />
    </div>
  );
}
