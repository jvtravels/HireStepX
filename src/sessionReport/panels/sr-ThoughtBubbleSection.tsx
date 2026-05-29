/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Opt-in horizontal stacked bar showing interviewer-state across the
 * session. Collapsed by default.
 * Pure presentation. */

import { useState } from "react";
import { t, f, shadows, radius } from "../tokens";
import type { ThoughtBubbleSegment } from "../types";

export function ThoughtBubbleSection({ segments }: { segments: ThoughtBubbleSegment[] }) {
  const [open, setOpen] = useState(false);
  if (!segments || segments.length === 0) return null;
  const totalPct = segments.reduce((acc, s) => acc + s.pct, 0);
  return (
    <section
      aria-label="Interviewer attention timeline"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.shell,
        padding: "16px 22px",
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <button
        type="button"
        className="ir-thought-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {open ? "Hide" : "Show"} interviewer&apos;s attention timeline
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "0 0 4px", lineHeight: 1.5 }}>
            Modelled from latency patterns, hedging density, and your transitions. Approximate — read it as a sketch, not a transcript.
          </p>
          <div
            className="ir-thought-track"
            role="img"
            aria-label={`Interviewer attention: ${segments.map((s) => `${s.pct}% ${s.state}`).join(", ")}`}
          >
            {segments.map((s, i) => (
              <div
                key={i}
                className={`ir-thought-seg-${s.state}`}
                style={{ width: `${(s.pct / Math.max(totalPct, 1)) * 100}%` }}
                title={`${s.pct}% ${s.state}`}
              />
            ))}
          </div>
          <div className="ir-thought-legend" aria-hidden="true">
            <span><span className="ir-thought-legend-swatch ir-thought-seg-engaged" />Engaged</span>
            <span><span className="ir-thought-legend-swatch ir-thought-seg-drifting" />Drifting</span>
            <span><span className="ir-thought-legend-swatch ir-thought-seg-concerned" />Concerned</span>
          </div>
        </div>
      )}
    </section>
  );
}
