/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Six-tile delivery metrics row. MetricBand pill comes from sr-HeroSection.
 * Pure presentation. */

import { t, f, radius } from "../tokens";
import type { DeliveryMetric } from "../types";
import { SrSectionShell } from "./_primitives";
import { MetricBand } from "./sr-HeroSection";

export function CoreMetricsSection({ metrics }: { metrics: DeliveryMetric[] }) {
  const howButton = (
    <button
      type="button"
      style={{
        background: "transparent",
        border: "none",
        fontFamily: f.sans,
        fontSize: 12,
        color: t.indigo,
        cursor: "pointer",
        padding: 0,
        fontWeight: 500,
      }}
    >
      How are these calculated?
    </button>
  );
  return (
    <SrSectionShell
      anchorId="ir-section-metrics"
      headingId="ir-metrics-heading"
      num="02"
      label="How you delivered"
      title="Core Delivery Metrics"
      aside={howButton}
    >
      <div className="ir-tile-grid">
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: radius.bar,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{m.label}</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={t.inkFaint} strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <div style={{ fontFamily: f.serif, fontSize: 36, color: t.coal, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {m.value}
              {m.unit && <span style={{ fontSize: 18, color: t.inkSoft, marginLeft: 2, fontFamily: f.mono }}>{m.unit}</span>}
            </div>
            <div style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: "0.04em" }}>
              {m.targetLabel}
            </div>
            <div>
              <MetricBand band={m.band} />
            </div>
          </div>
        ))}
      </div>
    </SrSectionShell>
  );
}
