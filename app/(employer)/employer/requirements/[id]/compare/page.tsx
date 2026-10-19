"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
import { useEmployerData, type Requirement } from "@/employer/EmployerDataContext";
import type { Candidate } from "@/employer/mockData";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Card, CandidateStatusChip, Eyebrow, ScoreChip, SkillTag } from "@/employer/_atoms";
import { EmptyNote, ErrorRetry, LinkCta, PageSkeleton } from "@/employer/_requirementAtoms";
import { interviewScore, scoreTone } from "@/employer/_jobDetailHelpers";
import { candidateDisplayName } from "../_components/requirementFormat";
import { MIN_COMPARE, parseCompareIds } from "../_components/shortlistSelection";
import { displaySkillName } from "../candidates/[candidateId]/_components/helpers";

const COMPARE_CSS = `
.cmp-back:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; border-radius: 4px; }
.cmp-table { width: 100%; min-width: 560px; border-collapse: collapse; table-layout: fixed; }
.cmp-name-link { color: inherit; text-decoration: none; }
.cmp-name-link:hover { text-decoration: underline; }
.cmp-name-link:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; border-radius: 4px; }
.cmp-table th, .cmp-table td { padding: 12px; text-align: left; vertical-align: top; border-bottom: 1px solid ${t.line}; overflow-wrap: anywhere; }
.cmp-table tbody tr:last-child th, .cmp-table tbody tr:last-child td { border-bottom: 0; }
.cmp-table thead th { background: ${t.rowTint}; }
.cmp-table tbody th { width: 28%; font-weight: 600; color: ${t.inkSoft}; }
@media (max-width: 480px) {
  .cmp-table th, .cmp-table td { padding: 10px 8px; }
  .cmp-table tbody th { width: 30%; }
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
  render: (c: Candidate) => ReactNode;
}

const ROWS: CompareRow[] = [
  {
    label: "Target role",
    render: (c) => (
      <span style={cellText}>
        {[c.targetRole, c.city].filter((v) => v && v !== "Not specified").join(" · ") || <span style={{ color: t.inkFaint }}>Not specified</span>}
      </span>
    ),
  },
  {
    label: "Match score",
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
    // The same figure and rule as the shortlist's evidence column: a never-practised candidate has no score, not a default 50.
    label: "Interview score",
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
    render: (c) => (
      <>
        <span style={cellText}>
          <strong>{c.sessionsCompleted}</strong>
        </span>
        <div style={mutedText}>Last active {c.lastActiveDaysAgo === 0 ? "today" : `${c.lastActiveDaysAgo}d ago`}</div>
      </>
    ),
  },
  {
    label: "Pipeline status",
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

  return (
    <div style={{ minWidth: 0 }}>
      <style>{COMPARE_CSS}</style>
      <BackLink requirementId={requirement.id} />
      <div style={{ marginTop: 8 }}>
        <Eyebrow tone="indigo">Comparing candidates</Eyebrow>
      </div>
      <h1 style={{ fontFamily: f.sans, fontSize: "clamp(22px, 6vw, 26px)", color: t.coal, margin: "6px 0 16px", overflowWrap: "anywhere" }}>{requirement.title}</h1>
      {chosen.some((c) => !c.unlocked) && (
        <p style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, margin: "0 0 16px", maxWidth: 640 }}>
          Names and contact details of locked candidates stay hidden until you unlock them from the shortlist.
        </p>
      )}
      <Card pad={0} aria-label={`Comparison of ${namesLabel}`} style={{ overflow: "hidden", boxShadow: "none" }}>
        {/* Keyboard users can only scroll an overflow region they can focus. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
        <div className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2" tabIndex={0} role="region" aria-label="Comparison table. Scroll sideways to see every candidate.">
        <table className="cmp-table">
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
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label}>
                <th scope="row" style={{ fontFamily: f.sans, fontSize: textSize.base }}>
                  {row.label}
                </th>
                {chosen.map((c) => (
                  <td key={c.id}>{row.render(c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
