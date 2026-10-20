/* Delivery metrics: one tile per spoken-delivery measure, each with a range
 * bar (shaded zone = target, dot = you) and a one-line plain-English read. */

import type * as React from "react";
import type { DeliveryMetric } from "../types";
import { SrSectionShell } from "./_primitives";
import { MetricBand } from "./sr-HeroSection";

interface Scale {
  min: number;
  max: number;
  goodLo: number;
  goodHi: number;
  hint: Record<DeliveryMetric["band"], string>;
}

const SCALES: Record<string, Scale> = {
  "Filler words / min": {
    min: 0, max: 10, goodLo: 0, goodHi: 3,
    hint: { good: "Clean. Few ums and ahs.", ok: "A few too many ums and ahs.", needsWork: "Too many ums and ahs. Pause instead." },
  },
  "Silence ratio": {
    min: 0, max: 50, goodLo: 0, goodHi: 20,
    hint: { good: "Natural pauses.", ok: "A bit of dead air.", needsWork: "Long silences. Start answering sooner." },
  },
  "Pace (WPM)": {
    min: 60, max: 220, goodLo: 140, goodHi: 180,
    hint: { good: "Easy to follow.", ok: "Slightly off the ideal pace.", needsWork: "Off the ideal pace. Aim for 140 to 180 words a minute." },
  },
  Energy: {
    min: 0, max: 100, goodLo: 60, goodHi: 100,
    hint: { good: "Engaged and confident.", ok: "A little flat.", needsWork: "Sounded flat. Add emphasis." },
  },
  "Median latency": {
    min: 0, max: 6, goodLo: 0, goodHi: 2,
    hint: { good: "Quick to respond.", ok: "A short wait before answering.", needsWork: "Slow to start answering." },
  },
  "Self-correction rate": {
    min: 0, max: 4, goodLo: 0, goodHi: 1,
    hint: { good: "Few restarts.", ok: "Some restarts.", needsWork: "Many restarts. Slow down and finish the thought." },
  },
};

function RangeBar({ scale, value, label }: { scale: Scale; value: number; label: string }) {
  const span = scale.max - scale.min;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - scale.min) / span) * 100));
  const zoneLeft = pct(scale.goodLo);
  return (
    <div className="ir-meter" role="img" aria-label={`${label}: ${value}. Target zone ${scale.goodLo} to ${scale.goodHi}.`}>
      <div className="ir-meter-zone" style={{ left: `${zoneLeft}%`, width: `${pct(scale.goodHi) - zoneLeft}%` }} />
      <div className="ir-meter-dot" style={{ left: `calc(${pct(value)}% - 7px)` }} />
    </div>
  );
}

export function CoreMetricsSection({ metrics }: { metrics: DeliveryMetric[] }) {
  return (
    <SrSectionShell
      anchorId="ir-section-metrics"
      headingId="ir-metrics-heading"
      label="Delivery"
      title="Delivery"
      subtitle="How you sounded. The green zone on each bar is the target; the dot is you."
    >
      <div
        className="ir-tile-grid"
        style={{ "--ir-cols": metrics.length === 6 ? 3 : Math.min(metrics.length, 4) } as React.CSSProperties}
      >
        {metrics.map((m) => {
          const scale = SCALES[m.label];
          return (
            <div key={m.label} className="ir-metric-tile">
              <span className="ir-metric-label">{m.label}</span>
              <div className="ir-metric-value">
                {m.value}
                {m.unit && <span className="ir-metric-unit">{m.unit}</span>}
              </div>
              {scale && <RangeBar scale={scale} value={m.value} label={m.label} />}
              <div className="ir-metric-target">{m.targetLabel}</div>
              <div className="ir-metric-foot">
                <MetricBand band={m.band} />
                {scale && <span className="ir-metric-hint">{scale.hint[m.band]}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </SrSectionShell>
  );
}
