/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * "What's actually pulling my score down?" — top 3 weighted red
 * flags drawn from the union of per-question redFlags arrays.
 * Pure presentation. */

import { t, f, radius, size } from "../tokens";
import type { Question } from "../types";
import { SrSectionShell, StatusPill } from "./_primitives";

export function TopScoreDriversSection({ questions }: { questions: Question[] }) {
  const severityWeight = (s: "high" | "medium" | "low"): number =>
    s === "high" ? 3 : s === "medium" ? 2 : 1;
  const all: Array<{ qIdx: number; severity: "high" | "medium" | "low"; title: string; explanation: string }> = [];
  for (const q of questions) {
    if (!q.redFlags || q.redFlags.length === 0) continue;
    for (const rf of q.redFlags) {
      all.push({ qIdx: q.index, severity: rf.severity, title: rf.title, explanation: rf.explanation });
    }
  }
  if (all.length === 0) return null;
  const ranked = all
    .map((row, idx) => ({ row, idx }))
    .sort((a, b) => severityWeight(b.row.severity) - severityWeight(a.row.severity) || a.idx - b.idx)
    .map((x) => x.row);
  const top = ranked.slice(0, 3);
  const topN = top.length;
  return (
    <SrSectionShell
      anchorId="ir-section-score-drivers"
      headingId="ir-score-drivers-heading"
      label="Score drivers"
      title={topN === 1 ? "Biggest issue" : `Biggest ${topN} issues`}
      subtitle="The most serious problems across your answers, worst first."
    >
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {top.map((r, i) => (
          <li
            key={`${r.qIdx}-${i}-${r.title}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              alignItems: "start",
              padding: "12px 14px",
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: radius.xl,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: f.sans, fontSize: size.md, fontWeight: 600, color: t.coal }}>{r.title}</span>
                <span style={{ fontFamily: f.sans, fontSize: size.sm, color: t.inkSoft }}>Question {r.qIdx}</span>
              </div>
              <p style={{ margin: "4px 0 0", fontFamily: f.sans, fontSize: size.base, color: t.inkSoft, lineHeight: 1.5, overflowWrap: "anywhere" }}>
                {r.explanation}
              </p>
            </div>
            <StatusPill tone={r.severity === "high" ? "bad" : r.severity === "medium" ? "warn" : "neutral"}>
              {r.severity === "high" ? "High" : r.severity === "medium" ? "Medium" : "Low"}
            </StatusPill>
          </li>
        ))}
      </ol>
    </SrSectionShell>
  );
}
