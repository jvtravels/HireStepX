/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Cross-session deltas in a single line. Renders only when there are
 * ≥3 prior sessions and at least one insight to surface.
 * Pure presentation. */

import type { CrossSessionInsight } from "../types";

export function TrendStrip({
  priorSessionCount,
  insights,
}: {
  priorSessionCount: number;
  insights: CrossSessionInsight[];
}) {
  const improvements = insights.filter((i) => i.kind === "improvement").slice(0, 1);
  const persistent = insights.filter((i) => i.kind === "persistent").slice(0, 1);
  const regressions = insights.filter((i) => i.kind === "regression").slice(0, 1);
  const items = [...improvements, ...persistent, ...regressions];
  if (items.length === 0) return null;
  return (
    <section
      aria-label="Cross-session trend"
      className="ir-trend-strip"
      style={{ scrollMarginTop: 72 }}
    >
      <span className="ir-trend-eyebrow">Across {priorSessionCount + 1} sessions</span>
      {items.map((it) => {
        const cls =
          it.kind === "improvement" ? "ir-trend-delta-up"
          : it.kind === "regression" ? "ir-trend-delta-down"
          : "ir-trend-delta-flat";
        const arrow = it.kind === "improvement" ? "↑" : it.kind === "regression" ? "↓" : "→";
        return (
          <span key={it.title} className="ir-trend-item">
            <span className={cls}>{arrow}</span>
            <span style={{ fontWeight: 600 }}>{it.title}</span>
          </span>
        );
      })}
    </section>
  );
}
