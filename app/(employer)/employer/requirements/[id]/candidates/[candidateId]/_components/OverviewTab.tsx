import { useState } from "react";
import { CheckIcon, MinusIcon, TargetIcon, TrendingUpIcon, XIcon } from "lucide-react";
import { cn } from "cn";
import AnimatedNumber from "@/AnimatedNumber";
import { Skeleton } from "@/components/ui/skeleton";
import type { CandidateEvidence, Requirement } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { Badge, FAIR_MATCH_THRESHOLD, OutlineCta, STRONG_MATCH_THRESHOLD } from "@/employer/_atoms";
import { InfoTip, KeyValueList, KeyValueRow, MeterRow, Panel, PanelButton, Stat, StatGrid } from "@/employer/_panelParts";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { ChipList, IconList, MutedText } from "./parts";
import { ItemRequest, type RequestUi } from "./RequestPopover";
import { RequestsPanel } from "./RequestsPanel";
import { RoleMismatchNotice, hasRoleMismatch } from "./RoleMismatchNotice";
import { PROVENANCE, displaySkillName, FIT_SOURCE_LABEL, READINESS_LABEL, averageTenureMonths, buildResumeInsights, buildRoleFit, candidateSignal, employerCapabilities, evidenceAverage, fitHeadline, formatSessionDate, formatTenure, formatYears, groupSkillsByDepth, skillChipLabel, sortFitRows, summarizeFit, type FitStatus, type ResumeInsights } from "./helpers";

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
  meets: { icon: CheckIcon, label: "Strength", cls: "bg-hx-success-100 text-hx-success-ink" },
  partial: { icon: MinusIcon, label: "Close", cls: "bg-hx-warning-100 text-hx-warning-ink" },
  gap: { icon: XIcon, label: "Gap", cls: "bg-hx-error-100 text-hx-error-ink" },
};

function FitMark({ status }: { status: FitStatus }) {
  const { icon: Icon, label, cls } = FIT_MARK[status];
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-medium", cls)}>
      <Icon size={11} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}

const SIGNAL_TONE = { strong: "success", promising: "brand", fair: "warning", low: "neutral" } as const;

const SEGMENT_CLS: Record<FitStatus, string> = { meets: "bg-hx-success", partial: "bg-hx-warning", gap: "bg-hx-error" };

function MatchPanel({ candidate, requirement, matched, unmatched, evidence, requestUi, analysisClear }: { candidate: Candidate; requirement: Requirement; matched: string[]; unmatched: string[]; evidence: CandidateEvidence | null; requestUi: RequestUi; analysisClear: boolean }) {
  const rows = sortFitRows(buildRoleFit(candidate, requirement, matched, evidence));
  const fit = summarizeFit(rows);
  const signal = candidateSignal(candidate.matchScore, fit);
  const caption = [
    fit.gaps.length > 0 && `Gap: ${fit.gaps.join(", ")}.`,
    fit.close.length > 0 && `Close: ${fit.close.join(", ")}.`,
    candidate.matchScore < 100 && !candidate.matchBreakdown && "The score also weighs practice results and recent activity.",
    analysisClear && "No concerns flagged on the resume.",
  ].filter(Boolean).join(" ");
  return (
    <Panel id="match-heading" title="Fit for this job" action={<Badge tone={SIGNAL_TONE[signal.key]}>{signal.label}</Badge>}>
      <div className="grid gap-5">
        <div className="@container">
          <div className="grid gap-5 @xl:grid-cols-[auto_minmax(0,1fr)] @xl:items-center @xl:gap-10">
            <div className="grid gap-1.5">
              <p className="m-0 flex items-baseline gap-2">
                <span className="text-[44px] leading-none font-semibold tracking-[-0.03em] tabular-nums text-hx-coal"><AnimatedNumber value={candidate.matchScore} /></span>
                <span className="text-[13px] text-hx-ink-soft">
                  out of 100{candidate.sessionsCompleted > 0 ? `, based on ${candidate.sessionsCompleted} graded session${candidate.sessionsCompleted === 1 ? "" : "s"}` : ""}
                </span>
              </p>
              <p className="m-0 text-[12px] text-hx-ink-soft tabular-nums">{STRONG_MATCH_THRESHOLD}+ strong, {FAIR_MATCH_THRESHOLD} to {STRONG_MATCH_THRESHOLD - 1} fair, under {FAIR_MATCH_THRESHOLD} low</p>
            </div>
            {fit.total > 0 && (
              <div className="grid gap-2">
                <p className="m-0 text-[15px] font-semibold text-hx-coal tabular-nums">{fitHeadline(fit)}</p>
                <div aria-hidden="true" className="flex gap-1">
                  {rows.map((row, i) => (
                    <span key={row.id} style={{ animationDelay: `${160 + i * 45}ms` }} className={cn("mx-seg h-1.5 flex-1 rounded-full", SEGMENT_CLS[row.status])} />
                  ))}
                </div>
                {caption && <p className="m-0 text-[13px] text-hx-ink-soft">{caption}</p>}
              </div>
            )}
          </div>
        </div>
        {candidate.matchBreakdown && (
          <div className="@container grid gap-3 border-t border-hx-line pt-4">
            <p className="m-0 flex items-center gap-1 text-[13px] font-medium text-hx-coal">
              Resume overlap
              <InfoTip label="About resume overlap">How much of this resume overlaps the posting. These are inputs, not shares of the score: practice results and recent activity are weighed too, so they do not add up to it.</InfoTip>
            </p>
            <div className="grid gap-x-8 gap-y-3.5 @xl:grid-cols-3">
              <MeterRow label="Role overlap" value={candidate.matchBreakdown.roleMatch} tone="indigo" />
              <MeterRow label="Skill overlap" value={candidate.matchBreakdown.skillMatch} tone="indigo" />
              <MeterRow label="Location fit" value={candidate.matchBreakdown.locationMatch} tone="indigo" />
            </div>
          </div>
        )}
        {rows.length > 0 && (
          <div className="border-t border-hx-line pt-2">
            <ul aria-label="Criteria compared with the posting" className="m-0 flex list-none flex-col p-0">
              {rows.map((row) => (
                <li key={row.id} className="grid gap-2.5 border-b border-hx-line py-3 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-hx-coal">{row.label}</div>
                      <div className="text-[12px] text-hx-ink-soft [overflow-wrap:anywhere]">Asks for {row.asked}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="max-w-36 text-right text-[13px] font-medium text-hx-coal [overflow-wrap:anywhere]">{row.has}</span>
                      <FitMark status={row.status} />
                    </div>
                  </div>
                  <p className="m-0 text-[13px] text-hx-ink-soft">{row.reason} <span>{FIT_SOURCE_LABEL[row.source]}.</span></p>
                  {row.id === "skills" && (matched.length > 0 || unmatched.length > 0) && (
                    <div className="grid gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {matched.length > 0 && <ChipList items={matched} tone="primary" label="Required skills on the resume" />}
                        {unmatched.length > 0 && <ChipList items={unmatched} tone="danger" label="Required skills missing from the resume" />}
                      </div>
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
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}

function ClampedText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 300;
  return (
    <div className="grid justify-items-start gap-1">
      <p className={cn("m-0 max-w-[75ch] text-[13px] leading-relaxed whitespace-pre-line text-hx-ink-soft [overflow-wrap:anywhere]", long && !open && "line-clamp-5")}>{text}</p>
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
    <Panel id="profile-heading" title="Profile" action={<PanelButton onClick={onOpenResume}>Full resume</PanelButton>}>
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
  const topSkills = [...(evidence?.skills ?? [])].sort((a, b) => b.score - a.score).slice(0, 4);
  const trend = evidence?.sessionTrend ?? [];
  const trendLine = trend.length > 1
    ? `Latest ${trend[trend.length - 1].score}, best ${Math.max(...trend.map((t) => t.score))}, ${trend[trend.length - 1].score - trend[0].score >= 0 ? "+" : ""}${trend[trend.length - 1].score - trend[0].score} since first session`
    : "";
  const action = (
    <div className="flex items-center gap-3">
      {hasEvidence && <PanelButton onClick={onOpenPractice}>See every answer and score</PanelButton>}
      <InfoTip label="How practice evidence is scored">
        {PROVENANCE}. This is practice performance, not an employment check.
      </InfoTip>
    </div>
  );

  return (
    <Panel id="evidence-heading" title="Practice snapshot" action={action}>
      <EvidenceStatus state={state}>
        {hasEvidence ? (
          <div className="@container">
            <StatGrid className="@xl:grid-cols-4">
              <Stat label="Interviews" hint={last ? `Latest ${last}` : undefined}>{candidate.sessionsCompleted} graded</Stat>
              {evidence?.readiness && (
                <Stat label="Readiness" hint={`${evidence.readiness.confidence} confidence`}>
                  <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[13px] leading-snug", evidence.readiness.band === "leanHire" ? "bg-hx-warning-100 text-hx-warning-ink" : "bg-hx-success-100 text-hx-success-ink")}>
                    {READINESS_LABEL[evidence.readiness.band]}
                  </span>
                </Stat>
              )}
              {avg != null && <Stat label="Avg skill score" hint="out of 100">{avg}</Stat>}
              {verified.length > 0 && <Stat label="Verified skills" hint={`of ${verified.length} checked`}>{verifiedCount}</Stat>}
            </StatGrid>
            {topSkills.length > 0 && (
              <div className="mt-5 grid gap-3 border-t border-hx-line pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="m-0 text-[13px] font-semibold text-hx-coal">Top skill scores</h3>
                  {trendLine && <p className="m-0 text-[12px] text-hx-ink-soft tabular-nums">{trendLine}</p>}
                </div>
                <div className="grid gap-x-8 gap-y-3.5 @xl:grid-cols-2">
                  {topSkills.map((sk) => (
                    <MeterRow key={sk.name} label={sk.name} value={sk.score} tone={sk.score >= 70 ? "success" : "indigo"} />
                  ))}
                </div>
              </div>
            )}
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

function StandoutPanel({ evidence, onOpenPractice }: { evidence: CandidateEvidence | null; onOpenPractice: () => void }) {
  const quotes = (evidence?.quotes ?? []).filter((q) => q.quote.trim());
  const picked = [...quotes.filter((q) => q.kind === "win").slice(0, 2), ...quotes.filter((q) => q.kind === "redFlag").slice(0, 1)];
  if (picked.length === 0) return null;
  return (
    <Panel id="standout-heading" title="Standout answers" action={<PanelButton onClick={onOpenPractice}>All answers</PanelButton>}>
      <ul aria-label="Quoted moments from practice interviews" className="m-0 flex list-none flex-col p-0">
        {picked.map((q, i) => (
          <li key={`${q.kind}-${i}`} className="grid gap-1.5 border-b border-hx-line py-3 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex items-start gap-2 text-[13px] font-medium text-hx-coal">
              <Badge tone={q.kind === "redFlag" ? "error" : "success"}>{q.kind === "redFlag" ? "Flag" : "Win"}</Badge>
              <span className="min-w-0 [overflow-wrap:anywhere]">{q.text}</span>
            </div>
            <p className="m-0 text-[13px] leading-relaxed text-hx-ink-soft italic [overflow-wrap:anywhere]">&ldquo;{q.quote}&rdquo;</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function HighlightsPanel({ candidate }: { candidate: Candidate }) {
  const r = candidate.resume;
  const achievements = (r?.keyAchievements ?? []).filter((a) => a.trim());
  const ordered = [...achievements.filter((a) => /\d/.test(a)), ...achievements.filter((a) => !/\d/.test(a))].slice(0, 3);
  const growth = (r?.promotionSignals ?? []).filter((p) => p.trim()).slice(0, 1);
  const items = [...ordered, ...growth];
  if (items.length === 0) return null;
  return (
    <Panel id="highlights-heading" title="Career highlights">
      <IconList label="Career highlights" items={items} icon={TrendingUpIcon} iconClassName="size-4 text-hx-success" />
    </Panel>
  );
}

function SkillsPanel({ candidate, onOpenResume }: { candidate: Candidate; onOpenResume: () => void }) {
  const detailed = candidate.resume?.skillsDetailed ?? [];
  const groups = groupSkillsByDepth(detailed).slice(0, 2).map((g) => ({ label: g.label, items: g.skills.slice(0, 8).map(skillChipLabel), more: Math.max(0, g.skills.length - 8) }));
  const fallback = detailed.length === 0 ? candidate.skills.slice(0, 12).map(displaySkillName) : [];
  if (groups.length === 0 && fallback.length === 0) return null;
  const industries = (candidate.resume?.industries ?? []).slice(0, 4);
  return (
    <Panel id="skills-overview-heading" title="Skills" action={<PanelButton onClick={onOpenResume}>All skills</PanelButton>}>
      <div className="grid gap-4">
        {groups.map((g) => (
          <div key={g.label} className="grid gap-2">
            <h3 className="m-0 text-[12px] font-medium text-hx-ink-soft">{g.label}{g.more > 0 ? `, ${g.more} more` : ""}</h3>
            <ChipList label={g.label} items={g.items} />
          </div>
        ))}
        {fallback.length > 0 && <ChipList label="Skills" items={fallback} />}
        {industries.length > 0 && (
          <div className="grid gap-2 border-t border-hx-line pt-4">
            <h3 className="m-0 text-[12px] font-medium text-hx-ink-soft">Industries</h3>
            <ChipList label="Industries" items={industries} />
          </div>
        )}
      </div>
    </Panel>
  );
}

const COLUMNS_CLS = ["", "@2xl:grid-cols-1", "@2xl:grid-cols-2", "@2xl:grid-cols-3"];

function AnalysisPanel({ candidate, insights, requestUi }: { candidate: Candidate; insights: ResumeInsights; requestUi: RequestUi }) {
  const columns = [
    { id: "strengths", title: "Key strengths", items: insights.strengths, empty: "Nothing stands out yet.", icon: CheckIcon, cls: "size-4 text-hx-success", ask: false },
    { id: "concerns", title: "Potential concerns", items: insights.concerns, empty: "No concerns flagged.", icon: MinusIcon, cls: "size-4 text-hx-warning", ask: true },
    { id: "validate", title: "Worth validating", items: insights.validate, empty: "Nothing to confirm.", icon: TargetIcon, cls: "size-4 text-hx-indigo", ask: true },
  ];
  const filled = columns.filter((c) => c.items.length > 0);
  const empties = columns.filter((c) => c.items.length === 0);
  if (filled.length === 0) return null;
  return (
    <Panel id="analysis-heading" title="Resume analysis">
      <div className="@container">
        {filled.length > 0 && (
          <div className={cn("grid gap-6 @2xl:gap-8", COLUMNS_CLS[filled.length])}>
            {filled.map((c) => (
              <div key={c.id} className="min-w-0">
                <h3 className="m-0 mb-2 flex items-center gap-2 text-[13px] font-semibold text-hx-coal">
                  {c.title}
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-hx-soft px-1.5 py-0.5 text-[11px] leading-none font-medium text-hx-neutral-ink tabular-nums">{c.items.length}</span>
                </h3>
                <IconList
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
                />
              </div>
            ))}
          </div>
        )}
        {empties.length > 0 && (
          <p className={cn("m-0 text-[13px] text-hx-ink-soft", filled.length > 0 && "mt-4 border-t border-hx-line pt-4")}>{empties.map((c) => c.empty).join(" ")}</p>
        )}
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
  const insights = buildResumeInsights(candidate, unmatched);
  const analysisClear = insights.strengths.length + insights.concerns.length + insights.validate.length === 0;
  return (
    <div className="grid min-w-0 divide-y divide-hx-line lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:divide-x lg:divide-y-0">
      <div className="flex min-w-0 flex-col divide-y divide-hx-line">
        <MatchPanel candidate={candidate} requirement={requirement} matched={matched} unmatched={unmatched} evidence={state.evidence} requestUi={requestUi} analysisClear={analysisClear} />
        <PracticeSnapshot candidate={candidate} state={state} onOpenPractice={onOpenPractice} requirementTitle={requirement.title} requestUi={requestUi} />
        <StandoutPanel evidence={state.evidence} onOpenPractice={onOpenPractice} />
        <RequestsPanel state={requestUi.state} disabled={requestUi.disabled} />
      </div>
      <div className="flex min-w-0 flex-col divide-y divide-hx-line">
        <ProfilePanel candidate={candidate} onOpenResume={onOpenResume} />
        <HighlightsPanel candidate={candidate} />
        <SkillsPanel candidate={candidate} onOpenResume={onOpenResume} />
        <AnalysisPanel candidate={candidate} insights={insights} requestUi={requestUi} />
      </div>
    </div>
  );
}
