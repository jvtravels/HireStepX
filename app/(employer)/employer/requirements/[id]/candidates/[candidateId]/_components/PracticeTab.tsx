import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { readQuotesLocked } from "@/employer/_candidateFields";
import { Badge } from "@/employer/_atoms";
import { InfoTip, KeyValueList, KeyValueRow, MeterRow, Panel } from "@/employer/_panelParts";
import { EmptyNote } from "@/employer/_requirementAtoms";
import { PROVENANCE, READINESS_LABEL, describeDelivery, formatSessionDate } from "./helpers";
import { LockedQuotes } from "./Notices";
import { Masonry } from "./parts";
import { QuestionBreakdown } from "./QuestionBreakdown";
import { EvidenceStatus, type EvidenceState } from "./OverviewTab";

function ReadinessPanel({ evidence, sessions }: { evidence: CandidateEvidence; sessions: number }) {
  const { readiness, starCompleteness: star, sessionDate } = evidence;
  const last = sessionDate ? formatSessionDate(sessionDate) : "";
  return (
    <Panel
      id="readiness-heading"
      title="Interview readiness"
      action={<InfoTip label="How readiness is scored">{PROVENANCE}. This is practice performance, not an employment check.</InfoTip>}
    >
      <p className="m-0 mb-3.5 text-[13px] text-hx-ink-soft">
        {sessions} graded session{sessions === 1 ? "" : "s"}{last ? `, latest on ${last}` : ""}.
      </p>
      <KeyValueList>
        {readiness && (
          <KeyValueRow label="Forecast">
            {READINESS_LABEL[readiness.band]} <span className="font-normal text-hx-ink-soft">({readiness.confidence} confidence)</span>
          </KeyValueRow>
        )}
        {star && (
          <KeyValueRow label="Full STAR answers">
            <span className="tabular-nums">{star.pct}%</span> <span className="font-normal text-hx-ink-soft">of {star.questionsConsidered} question{star.questionsConsidered === 1 ? "" : "s"}</span>
          </KeyValueRow>
        )}
      </KeyValueList>
    </Panel>
  );
}

function DeliveryPanel({ delivery }: { delivery: CandidateEvidence["delivery"] }) {
  const rows = describeDelivery(delivery);
  return (
    <Panel id="delivery-heading" title="How they speak">
      <p className="m-0 mb-1 text-[13px] text-hx-ink-soft">Measured from the timing and wording of the latest spoken interview.</p>
      <ul aria-label="Spoken delivery" className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 border-b border-hx-line py-2.5 last:border-b-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-1 text-[13px] text-hx-coal">
              {r.label}
              <InfoTip label={`About ${r.label.toLowerCase()}`}>{r.hint}</InfoTip>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="text-[13px] font-medium text-hx-coal tabular-nums">{r.value}</span>
              <Badge tone={r.tone}>{r.note}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function VerifiedPanel({ capabilities }: { capabilities: NonNullable<CandidateEvidence["verifiedCapabilities"]> }) {
  const count = capabilities.filter((c) => c.verified).length;
  return (
    <Panel
      id="verified-heading"
      title="Verified skills"
      action={<InfoTip label="What verified means">Verified means a score of 70 or more on the skill across 2 or more graded sessions.</InfoTip>}
    >
      <p className="m-0 mb-3.5 text-[13px] text-hx-ink-soft">{count} of {capabilities.length} verified across repeated sessions.</p>
      <KeyValueList>
        {capabilities.map((cap) => (
          <KeyValueRow key={cap.key} label={cap.label}>
            {cap.verified ? <Badge tone="success">Verified{cap.verifiedDateLabel ? ` · ${cap.verifiedDateLabel}` : ""}</Badge> : <Badge tone="neutral">Not yet verified</Badge>}
          </KeyValueRow>
        ))}
      </KeyValueList>
    </Panel>
  );
}

function HistoryPanel({ trend, sessions }: { trend: NonNullable<CandidateEvidence["sessionTrend"]>; sessions: number }) {
  const first = trend[0].score;
  const last = trend[trend.length - 1].score;
  const best = Math.max(...trend.map((t) => t.score));
  const delta = last - first;
  return (
    <Panel id="history-heading" title="Practice history">
      <p className="m-0 mb-3.5 text-[13px] text-hx-ink-soft">Overall score of each graded interview, oldest first. {sessions} session{sessions === 1 ? "" : "s"} in total.</p>
      <KeyValueList>
        <KeyValueRow label="Latest"><span className="tabular-nums">{last} / 100</span></KeyValueRow>
        <KeyValueRow label="Best"><span className="tabular-nums">{best} / 100</span></KeyValueRow>
        <KeyValueRow label="Since first">
          {trend.length > 1 ? (
            <span className="inline-flex items-center gap-1 tabular-nums">
              {delta > 0 ? <TrendingUpIcon size={14} aria-hidden="true" className="text-hx-success" /> : delta < 0 ? <TrendingDownIcon size={14} aria-hidden="true" className="text-hx-error" /> : null}
              {delta > 0 ? "+" : ""}{delta}
            </span>
          ) : (
            <span className="font-normal text-hx-ink-soft">One session</span>
          )}
        </KeyValueRow>
      </KeyValueList>
      <ol aria-label="Sessions" className="m-0 mt-4 grid list-none gap-3.5 border-t border-hx-line p-0 pt-4">
        {trend.map((t, i) => (
          <li key={`${t.date}-${i}`}>
            <MeterRow label={`${formatSessionDate(t.date)}${t.focus ? ` · ${t.focus}` : t.type ? ` · ${t.type}` : ""}`} value={t.score} />
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function PracticeTab({
  evidence,
  candidate,
  state,
  onUnlock,
}: {
  evidence: CandidateEvidence | null;
  candidate: Candidate;
  state: EvidenceState;
  onUnlock: () => void;
}) {
  const quotesLocked = readQuotesLocked(evidence, candidate.unlocked);
  const skills = evidence?.skills ?? [];
  const trend = evidence?.sessionTrend ?? [];
  const quotes = evidence?.quotes ?? [];
  const questions = evidence?.questions ?? [];
  const verified = evidence?.verifiedCapabilities ?? [];
  const sessions = candidate.sessionsCompleted || trend.length;
  const hasReadiness = !!(evidence?.readiness || evidence?.starCompleteness);
  const hasAnything = skills.length > 0 || hasReadiness || trend.length > 0 || quotes.length > 0 || questions.length > 0 || !!evidence?.delivery;

  if (!state.loading && !state.failed && !hasAnything) {
    return (
      <EmptyNote title="No practice evidence yet">
        This candidate hasn&apos;t completed a graded mock interview, so there are no answers, scores or delivery measurements to show. The Resume tab has everything else we know.
      </EmptyNote>
    );
  }

  return (
    <EvidenceStatus state={state}>
      <div className="grid min-w-0 gap-4">
        {questions.length > 0 && <QuestionBreakdown questions={questions} unlocked={candidate.unlocked} onUnlock={onUnlock} />}
        <Masonry>
          {evidence && hasReadiness && <ReadinessPanel evidence={evidence} sessions={sessions} />}
          {skills.length > 0 && (
            <Panel id="skills-heading" title="Skill scores">
              <p className="m-0 mb-3.5 text-[13px] text-hx-ink-soft">{PROVENANCE}, from the most recent completed session.</p>
              <div className="grid gap-3.5">
                {skills.map((s) => (
                  <MeterRow key={s.name} label={s.name} value={s.score} />
                ))}
              </div>
            </Panel>
          )}
          {describeDelivery(evidence?.delivery).length > 0 && <DeliveryPanel delivery={evidence?.delivery} />}
          {verified.length > 0 && <VerifiedPanel capabilities={verified} />}
          {trend.length > 0 && <HistoryPanel trend={trend} sessions={sessions} />}
          {(quotesLocked || quotes.length > 0) && (
            <Panel id="quotes-heading" title="Standout lines">
              {quotesLocked ? (
                <LockedQuotes onUnlock={onUnlock} />
              ) : (
                <>
                  <p className="m-0 mb-2 text-[13px] text-hx-ink-soft">The strongest and weakest moments, quoted from their answers.</p>
                  <ItemGroup className="gap-0">
                    {quotes.map((q, i) => (
                      <Item key={i} role="listitem" size="sm" className="items-start border-0 border-t border-hx-line px-0 first:border-t-0">
                        <ItemContent>
                          <ItemTitle className="items-start gap-2 text-[13px]">
                            <Badge tone={q.kind === "redFlag" ? "error" : "success"}>{q.kind === "redFlag" ? "Flag" : "Win"}</Badge>
                            <span>{q.text}</span>
                          </ItemTitle>
                          <ItemDescription className="line-clamp-none text-[13px] italic">&ldquo;{q.quote}&rdquo;</ItemDescription>
                        </ItemContent>
                      </Item>
                    ))}
                  </ItemGroup>
                </>
              )}
            </Panel>
          )}
        </Masonry>
      </div>
    </EvidenceStatus>
  );
}
