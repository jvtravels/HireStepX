/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Opt-in horizontal stacked bar showing interviewer-state across the
 * session. Collapsed by default.
 * Pure presentation. */

import { useState } from "react";
import { t, f, size } from "../tokens";
import type { ThoughtBubbleSegment } from "../types";
import { Button } from "@/components/ui/button";
import { SrSectionShell } from "./_primitives";

export function ThoughtBubbleSection({ segments }: { segments: ThoughtBubbleSegment[] }) {
  const [open, setOpen] = useState(false);
  if (!segments || segments.length === 0) return null;
  const totalPct = segments.reduce((acc, s) => acc + s.pct, 0);
  return (
    <SrSectionShell
      anchorId="ir-section-thought-bubble"
      headingId="ir-thought-bubble-heading"
      num="05"
      label="How engaged did they stay"
      title="Interviewer Attention Timeline"
    >
      <Button
        type="button"
        variant="ghost"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        style={{ fontFamily: f.sans, color: "inherit", padding: 0, height: "auto" }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {open ? "Hide" : "Show"} the timeline
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 200ms" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </Button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontFamily: f.sans, fontSize: size.base, color: t.inkSoft, margin: "0 0 4px", lineHeight: 1.5 }}>
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
    </SrSectionShell>
  );
}
