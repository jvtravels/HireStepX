"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
import { useEmployerData, type Requirement } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { CandidateStatusChip, ScoreChip, SkillTag } from "@/employer/_atoms";
import { EmptyNote, ErrorRetry, LinkCta, PageSkeleton } from "@/employer/_requirementAtoms";
import { candidateSkillFit, interviewScore, scoreTone } from "@/employer/_jobDetailHelpers";
import { candidateDisplayName } from "../_components/requirementFormat";
import { MIN_COMPARE, parseCompareIds } from "../_components/shortlistSelection";
import { metricLeaders, sameAcross, summarizeComparison, type CompareMetric } from "../_components/compareInsights";
import { displaySkillName } from "../candidates/[candidateId]/_components/helpers";

const COMPARE_CSS = `
.cmp-back:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; border-radius: 4px; }
.cmp-table { width: 100%; min-width: 560px; border-collapse: collapse; table-layout: fixed; }
.cmp-name-link { color: inherit; text-decoration: none; }
.cmp-name-link:hover { text-decoration: underline; }
.cmp-name-link:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; border-radius: 4px; }
.cmp-table th, .cmp-table td { padding: 14px 28px; text-align: left; vertical-align: top; border-bottom: 1px solid ${t.line}; overflow-wrap: anywhere; }
.cmp-table tbody tr:last-child th, .cmp-table tbody tr:last-child td { border-bottom: 0; }
.cmp-table thead th { background: ${t.rowTint}; }
.cmp-table tbody th { width: 28%; font-weight: 600; color: ${t.inkSoft}; }
@media (max-width: 480px) {
  .cmp-table th, .cmp-table td { padding: 10px 12px; }
  .cmp-table tbody th { width: 30%; }
  .cmp-table[data-cols="2"] { min-width: 0; }
}
`;

const cellText = { fontFamily: f.sans, fontSize: textSize.base, color: t.coal } as const;
const faintText = { ...cellText, color: t.inkFaint } as const;
const SCORE_TEXT = { success: "text-hx-success-ink", warning: "text-hx-warning-ink", error: "text-hx-error-ink" } as const;
const mutedText = { fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, marginTop: 4 } as const;

function BackLink({ requirementId }: { requirementId: string }) {
  return (
    <Link
      href={`/employer/requirements/${requirementId}`}
      className="cmp-back inline-flex items-center gap-1 pointer-coarse:min-h-11"
      style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, color: t.indigo, textDecoration: "none" }}
    >
      <ArrowLeftIcon size={14} aria-hidden="true" /> Back to shortlist
    </Link>
  );
}

function NameCell({ candidate, requirementId }: { candidate: Candidate; requirementId: string }) {
  return (
    <div style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 700, color: t.coal }}>
      <Link href={`/employer/requirements/${requirementId}/candidates/${candidate.id}`} className="cmp-name-link">
        {candidateDisplayName(candidate)}
      </Link>
    </div>
  );
}

interface CompareRow {
  label: string;
  render: (c: Candidate, requiredSkills: string[]) => ReactNode;
  /** Set when the row has a numeric measure where one candidate can clearly lead. */
  metric?: CompareMetric;
  /** What "the same" means for this row, so the differences-only view can hide it. */
  same: (c: Candidate, requiredSkills: string[]) => string;
}

const ROWS: CompareRow[] = [
  {
    label: "Target role",
    same: (c) => `${c.targetRole}|${c.city}`,
    render: (c) => (
      <span style={cellText}>
        {[c.targetRole, c.city].filter((v) => v && v !== "Not specified").join(" · ") || <span style={{ color: t.inkFaint }}>Not specified</span>}
      </span>
    ),
  },
  {
    label: "Match score",
    metric: "match",
    same: (c) => String(Math.round(c.matchScore)),
    render: (c) => (
      <>
        <ScoreChip score={c.matchScore} />
        {c.matchBreakdown && (
          <div style={mutedText}>
            Role {c.matchBreakdown.roleMatch}% · Skill {c.matchBreakdown.skillMatch}% · Location {c.matchBreakdown.locationMatch}%
          </div>
        )}
      </>
    ),
  },
  {
    label: "Required skills",
    metric: "skills",
    same: (c, required) => candidateSkillFit(c, required).matched.slice().sort().join(","),
    render: (c, required) => {
      const { matched, gaps } = candidateSkillFit(c, required);
      return (
        <>
          <span style={cellText}>
            <strong>{matched.length}</strong> of {matched.length + gaps.length}
          </span>
          {gaps.length > 0 && <div style={mutedText}>Missing: {gaps.join(", ")}</div>}
        </>
      );
    },
  },
  {
    // The same figure and rule as the shortlist's evidence column: a never-practised candidate has no score, not a default 50.
    label: "Interview score",
    metric: "interview",
    same: (c) => String(interviewScore(c)),
    render: (c) => {
      const score = interviewScore(c);
      if (score == null) return <span style={faintText}>No graded interviews</span>;
      return (
        <span className={SCORE_TEXT[scoreTone(score)]} style={{ fontFamily: cellText.fontFamily, fontSize: cellText.fontSize }}>
          <strong>{score}</strong>/100
        </span>
      );
    },
  },
  {
    label: "Practice sessions",
    metric: "sessions",
    same: (c) => String(c.sessionsCompleted),
    render: (c) => (
      <>
        <span style={cellText}>
          <strong>{c.sessionsCompleted}</strong>
        </span>
        <div style={mutedText}>Last active {c.lastActiveDaysAgo < 0 ? "unknown" : c.lastActiveDaysAgo === 0 ? "today" : `${c.lastActiveDaysAgo}d ago`}</div>
      </>
    ),
  },
  {
    label: "Pipeline status",
    same: (c) => String(c.candidateStatus ?? ""),
    render: (c) => (
      <>
        {c.candidateStatus ? <CandidateStatusChip status={c.candidateStatus} /> : <span style={{ ...cellText, color: t.inkFaint }}>Not set</span>}
        {c.interviewScheduledAt && (
          <div style={mutedText}>Interview {new Date(c.interviewScheduledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</div>
        )}
        {c.candidateStatusNote && <div style={mutedText}>Private note: {c.candidateStatusNote}</div>}
      </>
    ),
  },
  {
    label: "Skills",
    same: (c) => c.skills.slice().sort().join(","),
    render: (c) =>
      c.skills.length ? (
        <ul style={{ display: "flex", gap: 6, flexWrap: "wrap", listStyle: "none", margin: 0, padding: 0 }}>
          {c.skills.map((s) => (
            <li key={s}>
              <SkillTag>{displaySkillName(s)}</SkillTag>
            </li>
          ))}
        </ul>
      ) : (
        <span style={{ ...cellText, color: t.inkFaint }}>None listed</span>
      ),
  },
];

export default function ComparePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { fetchRequirementDetail } = useEmployerData();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [diffOnly, setDiffOnly] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    fetchRequirementDetail(params.id).then((r) => {
      if (!active) return;
      setRequirement(r);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fetchRequirementDetail, params.id]);

  useEffect(() => load(), [load]);

  useEmployerBreadcrumb(requirement ? [{ label: requirement.title, path: `/employer/requirements/${params.id}` }, { label: "Compare candidates" }] : null);

  const wantedIds = parseCompareIds(searchParams);
  const chosen = wantedIds.flatMap((id) => requirement?.candidates.find((c) => c.id === id) ?? []);

  if (loading) return <PageSkeleton label="Loading candidates to compare" />;

  if (!requirement) {
    return (
      <ErrorRetry title="Couldn't load this comparison" message="We couldn't reach HireStepX, or this job no longer exists." onRetry={() => load()}>
        <BackLink requirementId={params.id} />
      </ErrorRetry>
    );
  }

  if (chosen.length < MIN_COMPARE) {
    return (
      <>
        <style>{COMPARE_CSS}</style>
        <EmptyNote
          title="Pick two or three candidates to compare"
          action={<LinkCta variant="outline" href={`/employer/requirements/${requirement.id}`}>Back to shortlist</LinkCta>}
        >
          {chosen.length < wantedIds.length ? "Some candidates in this link could not be loaded for this job. They may have been removed, or they are not in the part of the list that has loaded." : ""}
          Tick the box next to two or three candidates on the shortlist, then choose Compare in the bar that appears.
        </EmptyNote>
      </>
    );
  }

  const names = chosen.map(candidateDisplayName);
  const namesLabel = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

  const summary = summarizeComparison(chosen, requirement.skills);
  const leaders = new Map<CompareMetric, Set<string>>(
    (["match", "skills", "interview", "sessions"] as CompareMetric[]).map((m) => [m, metricLeaders(chosen, requirement.skills, m)]),
  );
  const rows = ROWS.filter((row) => row.label !== "Required skills" || requirement.skills.length > 0);
  const visibleRows = diffOnly ? rows.filter((row) => !sameAcross(chosen, (c) => row.same(c, requirement.skills))) : rows;

  return (
    <div style={{ minWidth: 0 }}>
      <style>{COMPARE_CSS}</style>
      <section aria-label={`Comparison of ${namesLabel}`} style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 16, overflow: "hidden" }}>
        <header style={{ padding: "20px 28px", borderBottom: `1px solid ${t.line}` }}>
          <BackLink requirementId={requirement.id} />
          <h1 style={{ fontFamily: f.sans, fontSize: 20, fontWeight: 600, color: t.coal, margin: "10px 0 0", overflowWrap: "anywhere" }}>
            Comparing candidates for {requirement.title}
          </h1>
          <p style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, margin: "4px 0 0", maxWidth: 640 }}>
            {chosen.some((c) => !c.unlocked)
              ? "Names and contact details of locked candidates stay hidden until you unlock them from the shortlist."
              : "Side by side on match, interview evidence and pipeline status."}
          </p>
        </header>
        <div className="flex flex-col gap-4 border-b border-hx-line px-7 py-5 max-sm:px-4">
          <div>
            <h2 className="m-0 text-[15px] font-semibold text-hx-coal">How they differ</h2>
            {summary.differences.length > 0 ? (
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[14px] text-hx-coal">
                {summary.differences.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="m-0 mt-2 text-[14px] text-hx-ink-soft">These candidates are close on every measure we compare. Use the interview to separate them.</p>
            )}
          </div>
          {summary.questions.length > 0 && (
            <div>
              <h2 className="m-0 text-[15px] font-semibold text-hx-coal">Worth asking in the interview</h2>
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[14px] text-hx-coal">
                {summary.questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="m-0 text-[13px] text-hx-ink-soft">
            Worked out from the figures below. HireStepX shows where candidates differ and does not pick a hire for you. Interview scores reflect practice, not job performance.
          </p>
          <label htmlFor="cmp-diff-only" className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-hx-coal">
            <Checkbox id="cmp-diff-only" checked={diffOnly} onCheckedChange={(v) => setDiffOnly(v === true)} className="shrink-0" />
            Show differences only
          </label>
        </div>
        {/* Keyboard users can only scroll an overflow region they can focus. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2" tabIndex={0} role="region" aria-label="Comparison table. Scroll sideways to see every candidate.">
          <table className="cmp-table" data-cols={chosen.length}>
            <caption className="sr-only">
              Side-by-side comparison of {namesLabel} for {requirement.title}
            </caption>
            <thead>
              <tr>
                <td style={{ background: t.rowTint }}>
                  <span className="sr-only">Attribute</span>
                </td>
                {chosen.map((c) => (
                  <th key={c.id} scope="col">
                    <NameCell candidate={c} requirementId={requirement.id} />
                    {(summary.leads.get(c.id) ?? 0) > 0 && (
                      <div className="mt-1 text-[13px] font-normal text-hx-ink-soft">Highest on {summary.leads.get(c.id)} of 4 measures</div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" style={{ fontFamily: f.sans, fontSize: textSize.base }}>
                    {row.label}
                  </th>
                  {chosen.map((c) => (
                    <td key={c.id}>
                      {row.render(c, requirement.skills)}
                      {row.metric && leaders.get(row.metric)?.has(c.id) && (
                        <div className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-hx-indigo">
                          <CheckIcon size={13} aria-hidden="true" /> Highest
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
