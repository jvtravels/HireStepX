import { TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { readQuotesLocked } from "@/employer/_candidateFields";
import { Badge } from "@/employer/_atoms";
import { KeyValueList, KeyValueRow, MeterRow, Panel } from "@/employer/_panelParts";
import { EmptyNote } from "@/employer/_requirementAtoms";
import { PROVENANCE, formatSessionDate } from "./helpers";
import { LockedQuotes } from "./Notices";
import { Masonry } from "./parts";
import { EvidenceStatus, type EvidenceState } from "./OverviewTab";

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
            <MeterRow label={`${formatSessionDate(t.date)}${t.focus ? ` · ${t.focus}` : ""}`} value={t.score} />
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function PracticeTab({
  evidence,
  candidate,
  shortlistHref,
  state,
}: {
  evidence: CandidateEvidence | null;
  candidate: Candidate;
  shortlistHref: string;
  state: EvidenceState;
}) {
  const quotesLocked = readQuotesLocked(evidence, candidate.unlocked);
  const skills = evidence?.skills ?? [];
  const star = evidence?.starCompleteness;
  const trend = evidence?.sessionTrend ?? [];
  const quotes = evidence?.quotes ?? [];
  const hasAnything = skills.length > 0 || !!star || trend.length > 0 || quotes.length > 0 || quotesLocked;

  if (!state.loading && !state.failed && !hasAnything) {
    return (
      <EmptyNote title="No practice evidence yet">
        This candidate hasn&apos;t completed a graded mock interview, so there are no skill scores, STAR answers or quotes to show. The Resume tab has everything else we know.
      </EmptyNote>
    );
  }

  return (
    <EvidenceStatus state={state}>
      <Masonry>
          {trend.length > 0 && <HistoryPanel trend={trend} sessions={candidate.sessionsCompleted || trend.length} />}
          {(quotesLocked || quotes.length > 0) && (
            <Panel id="quotes-heading" title="What they said">
              {quotesLocked ? (
                <LockedQuotes shortlistHref={shortlistHref} />
              ) : (
                <>
                  <p className="m-0 mb-2 text-[13px] text-hx-ink-soft">Verbatim lines from practice answers.</p>
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
        {(skills.length > 0 || star) && (
            <Panel id="skills-heading" title="Skill scores">
              <p className="m-0 mb-3.5 text-[13px] text-hx-ink-soft">{PROVENANCE}, from the most recent completed session.</p>
              <div className="grid gap-3.5">
                {skills.map((s) => (
                  <MeterRow key={s.name} label={s.name} value={s.score} />
                ))}
                {star && (
                  <div className={skills.length > 0 ? "border-t border-hx-line pt-3.5" : undefined}>
                    <MeterRow label={`STAR answers, across ${star.questionsConsidered} question${star.questionsConsidered === 1 ? "" : "s"}`} value={star.pct} />
                  </div>
                )}
              </div>
            </Panel>
        )}
      </Masonry>
    </EvidenceStatus>
  );
}
