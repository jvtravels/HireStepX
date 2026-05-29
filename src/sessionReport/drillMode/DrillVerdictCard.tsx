/* DrillVerdictCard — terminal screen for a 5-question drill.
 * Shows the headline verdict, average score, and strongest/weakest
 * answer indices. Pure presentation. */

import { t, f, radius, space } from "../tokens";
import type { DrillSummary } from "../../../server-handlers/_drill-session";

export function DrillVerdictCard({
  summary,
  onExit,
}: {
  summary: DrillSummary;
  onExit?: () => void;
}) {
  return (
    <div
      style={{
        background: t.creamSoft,
        border: `1px solid ${t.line}`,
        borderRadius: radius.bar,
        padding: space.panelPad,
      }}
    >
      <div
        style={{
          fontFamily: f.sans,
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: t.copper,
          fontWeight: 600,
          marginBottom: space.xs,
        }}
      >
        Verdict
      </div>
      <p
        style={{
          fontFamily: f.serif,
          fontSize: 20,
          color: t.coal,
          margin: `0 0 ${space.md}px`,
          lineHeight: 1.4,
        }}
      >
        {summary.oneSentenceVerdict}
      </p>
      <div
        style={{
          display: "flex",
          gap: space.partGap,
          fontFamily: f.sans,
          fontSize: 13,
          color: t.inkSoft,
          marginBottom: space.row,
        }}
      >
        <span>
          Score:{" "}
          <strong style={{ color: t.coal, fontSize: 15 }}>{summary.scorePct}/100</strong>
        </span>
        <span>
          Strongest answer: <strong style={{ color: t.coal }}>Q{summary.strongestAnswerIdx + 1}</strong>
        </span>
        <span>
          Weakest answer: <strong style={{ color: t.coal }}>Q{summary.weakestAnswerIdx + 1}</strong>
        </span>
      </div>
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          style={{
            background: t.indigo,
            color: t.white,
            border: "none",
            borderRadius: radius.lg,
            padding: "10px 18px",
            fontFamily: f.sans,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Back to report
        </button>
      )}
    </div>
  );
}
