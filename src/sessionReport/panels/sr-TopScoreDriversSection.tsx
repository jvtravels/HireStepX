/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * "What's actually pulling my score down?" — top 3 weighted red
 * flags drawn from the union of per-question redFlags arrays.
 * Pure presentation. */

import { t, f, radius } from "../tokens";
import type { Question } from "../types";
import { SrSectionShell } from "./_primitives";

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
  const totalImpact = top.reduce((sum, r) => sum + severityWeight(r.severity), 0);

  const impactChip = (
    <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      weighted impact · {totalImpact} pts
    </span>
  );
  return (
    <SrSectionShell
      anchorId="ir-section-score-drivers"
      headingId="ir-score-drivers-heading"
      num="01b"
      label="Score drivers — what hit hardest"
      title="Top 3 score drivers"
      subtitle="Each flag is weighted by severity (high = 3, medium = 2, low = 1). These three account for most of the score gap."
      aside={impactChip}
    >
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
        {top.map((r, i) => {
          const impact = severityWeight(r.severity);
          const tone = r.severity === "high" ? t.error : r.severity === "medium" ? t.copper : t.inkSoft;
          return (
            <li
              key={`${r.qIdx}-${i}-${r.title}`}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 12,
                alignItems: "start",
                padding: "12px 14px",
                background: t.copperSoft,
                border: `1px solid ${t.copper100}`,
                borderLeft: `3px solid ${tone}`,
                borderRadius: radius.xl,
              }}
            >
              <span
                aria-hidden
                style={{
                  fontFamily: f.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  color: tone,
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>{r.title}</span>
                  <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft }}>Q{r.qIdx}</span>
                </div>
                <p style={{ margin: "4px 0 0", fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.45, overflowWrap: "anywhere" }}>
                  {r.explanation}
                </p>
              </div>
              <span
                title={`${r.severity} severity — counts as ${impact} pt${impact === 1 ? "" : "s"}`}
                style={{
                  fontFamily: f.mono,
                  fontSize: 11,
                  fontWeight: 600,
                  color: tone,
                  background: t.white,
                  border: `1px solid ${tone}`,
                  borderRadius: radius.pill,
                  padding: "3px 9px",
                  whiteSpace: "nowrap",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                −{impact}
              </span>
            </li>
          );
        })}
      </ol>
    </SrSectionShell>
  );
}
