import { BriefcaseIcon, CheckIcon, LockIcon, MinusIcon, TargetIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { CandidateEvidence, Requirement } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { Badge, OutlineCta } from "@/employer/_atoms";
import { InfoTip, KeyValueList, KeyValueRow, MeterRow, Panel, PanelButton } from "@/employer/_panelParts";
import { InlineNotice, LinkCta } from "@/employer/_requirementAtoms";
import { ChipList, IconList, Masonry, MutedText } from "./parts";
import { PROVENANCE, READINESS_LABEL, buildResumeInsights, buildRoleFit, evidenceAverage, formatSessionDate, type FitStatus } from "./helpers";

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

function MatchPanel({ candidate, requirement, matched, evidence }: { candidate: Candidate; requirement: Requirement; matched: string[]; evidence: CandidateEvidence | null }) {
  const b = candidate.matchBreakdown;
  const hasCity = !!candidate.city && candidate.city !== "Not specified";
  const rows = buildRoleFit(candidate, requirement, matched, evidence);
  const meets = rows.filter((r) => r.status === "meets").length;
  return (
    <Panel id="match-heading" title="Fit for this role" icon={<TargetIcon size={15} />}>
      <div className="grid gap-5">
        {b && (
          <div className="grid gap-3.5">
            <MeterRow label="Role match" value={b.roleMatch} />
            <MeterRow label="Skill match" value={b.skillMatch} />
            {hasCity && <MeterRow label="Location match" value={b.locationMatch} />}
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
      </div>
    </Panel>
  );
}

function CareerPanel({ candidate, requirement, matched, unmatched, onOpenResume }: { candidate: Candidate; requirement: Requirement; matched: string[]; unmatched: string[]; onOpenResume: () => void }) {
  const r = candidate.resume;
  if (!candidate.unlocked || !r) return null;
  const roles = r.experience.slice(0, 3);
  const edu = r.education[0];
  const { avgTenureMonths } = buildResumeInsights(candidate, requirement, matched, unmatched);
  const tenure = avgTenureMonths == null ? null : avgTenureMonths >= 24 ? `${Math.round((avgTenureMonths / 12) * 10) / 10} years per role` : `${avgTenureMonths} months per role`;
  if (!r.headline && roles.length === 0 && !edu && r.industries.length === 0 && r.certifications.length === 0) return null;
  return (
    <Panel id="career-heading" title="Career snapshot" icon={<BriefcaseIcon size={15} />} action={<PanelButton onClick={onOpenResume}>Full resume</PanelButton>}>
      <div className="grid gap-4">
        {r.headline && <p className="m-0 text-[14px] font-medium leading-snug text-hx-coal">{r.headline}</p>}
        {roles.length > 0 && (
          <ol aria-label="Recent roles" className="m-0 flex list-none flex-col p-0">
            {roles.map((e, i) => (
              <li key={`${e.company}-${e.period}-${i}`} className="border-b border-hx-line py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                <div className="text-[13px] font-semibold text-hx-coal [overflow-wrap:anywhere]">{e.title || "Role not listed"}</div>
                <div className="text-[12px] text-hx-ink-soft [overflow-wrap:anywhere]">{[e.company, e.period].filter(Boolean).join(" · ")}</div>
              </li>
            ))}
          </ol>
        )}
        {(tenure || edu || r.certifications.length > 0) && (
          <KeyValueList className="border-t border-hx-line pt-4">
            {tenure && <KeyValueRow label="Average tenure">{tenure}</KeyValueRow>}
            {edu && <KeyValueRow label="Education">{[edu.degree, edu.school].filter(Boolean).join(", ")}</KeyValueRow>}
            {r.certifications.length > 0 && <KeyValueRow label="Certifications">{r.certifications.slice(0, 2).join(", ")}{r.certifications.length > 2 ? ` +${r.certifications.length - 2}` : ""}</KeyValueRow>}
          </KeyValueList>
        )}
        {r.industries.length > 0 && (
          <div className="grid gap-1.5">
            <h3 className="m-0 text-[13px] font-semibold text-hx-ink-soft">Industries</h3>
            <ChipList items={r.industries.slice(0, 6)} label="Industries" />
          </div>
        )}
      </div>
    </Panel>
  );
}

function EvidencePanel({ candidate, state, onOpenPractice }: { candidate: Candidate; state: EvidenceState; onOpenPractice: () => void }) {
  const { evidence } = state;
  const avg = evidenceAverage(evidence);
  const hasEvidence = !!(evidence?.readiness || evidence?.starCompleteness || evidence?.skills.length);
  const verified = evidence?.verifiedCapabilities ?? [];
  const last = evidence?.sessionDate ? formatSessionDate(evidence.sessionDate) : "";
  const tip = (
    <InfoTip label="How practice evidence is scored">
      {PROVENANCE}. This is practice performance, not an employment check. Verified means 70+ on the skill across 2 or more sessions.
    </InfoTip>
  );

  return (
    <Panel id="evidence-heading" title="Practice evidence" action={tip}>
      <EvidenceStatus state={state}>
        {hasEvidence ? (
          <div className="grid gap-4">
            <p className="m-0 text-[13px] text-hx-ink-soft">
              {candidate.sessionsCompleted} graded session{candidate.sessionsCompleted === 1 ? "" : "s"}
              {last ? `, last on ${last}` : ""}
            </p>
            <KeyValueList>
              {evidence?.readiness && <KeyValueRow label="Readiness">{READINESS_LABEL[evidence.readiness.band]} <span className="font-normal text-hx-ink-soft">({evidence.readiness.confidence} confidence)</span></KeyValueRow>}
              {avg != null && <KeyValueRow label="Avg skill score"><span className="tabular-nums">{avg} / 100</span></KeyValueRow>}
              {evidence?.starCompleteness && (
                <KeyValueRow label="STAR answers">
                  <span className="tabular-nums">{evidence.starCompleteness.pct}%</span>{" "}
                  <span className="font-normal text-hx-ink-soft">({evidence.starCompleteness.questionsConsidered} question{evidence.starCompleteness.questionsConsidered === 1 ? "" : "s"})</span>
                </KeyValueRow>
              )}
            </KeyValueList>
            {verified.length > 0 && (
              <KeyValueList className="border-t border-hx-line pt-4">
                {verified.map((cap) => (
                  <KeyValueRow key={cap.key} label={cap.label}>
                    {cap.verified ? <Badge tone="success">Verified{cap.verifiedDateLabel ? ` · ${cap.verifiedDateLabel}` : ""}</Badge> : <Badge tone="neutral">Not yet verified</Badge>}
                  </KeyValueRow>
                ))}
              </KeyValueList>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            <MutedText>No graded practice interviews yet, so this match reflects the resume only.</MutedText>
            <div><PanelButton onClick={onOpenPractice}>View evidence tab</PanelButton></div>
          </div>
        )}
      </EvidenceStatus>
    </Panel>
  );
}

function AnalysisPanel({ candidate, requirement, matched, unmatched, shortlistHref }: { candidate: Candidate; requirement: Requirement; matched: string[]; unmatched: string[]; shortlistHref: string }) {
  if (!candidate.unlocked) {
    return (
      <Panel id="analysis-heading" title="Resume analysis" icon={<LockIcon size={15} />}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MutedText>Strengths, concerns and what to validate unlock with the candidate.</MutedText>
          <LinkCta href={shortlistHref} size="sm" variant="outline">Unlock from the shortlist</LinkCta>
        </div>
      </Panel>
    );
  }
  const insights = buildResumeInsights(candidate, requirement, matched, unmatched);
  const columns = [
    { id: "strengths", title: "Key strengths", items: insights.strengths, empty: "Nothing stands out yet.", icon: CheckIcon, cls: "size-4 text-hx-success" },
    { id: "concerns", title: "Potential concerns", items: insights.concerns, empty: "Nothing flagged.", icon: MinusIcon, cls: "size-4 text-hx-warning" },
    { id: "validate", title: "Worth validating", items: insights.validate, empty: "Nothing to confirm.", icon: TargetIcon, cls: "size-4 text-hx-indigo" },
  ];
  return (
    <Panel id="analysis-heading" title="Resume analysis">
      <p className="m-0 mb-4 max-w-[75ch] text-[13px] text-hx-ink-soft">{insights.snapshot} Read from the resume against {requirement.title}.</p>
      <div className="grid gap-5">
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
  shortlistHref,
  state,
  onOpenPractice,
  onOpenResume,
}: {
  candidate: Candidate;
  requirement: Requirement;
  matched: string[];
  unmatched: string[];
  shortlistHref: string;
  state: EvidenceState;
  onOpenPractice: () => void;
  onOpenResume: () => void;
}) {
  return (
    <Masonry>
      <MatchPanel candidate={candidate} requirement={requirement} matched={matched} evidence={state.evidence} />
      <EvidencePanel candidate={candidate} state={state} onOpenPractice={onOpenPractice} />
      <AnalysisPanel candidate={candidate} requirement={requirement} matched={matched} unmatched={unmatched} shortlistHref={shortlistHref} />
      <CareerPanel candidate={candidate} requirement={requirement} matched={matched} unmatched={unmatched} onOpenResume={onOpenResume} />
    </Masonry>
  );
}
