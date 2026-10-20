/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Six-tile delivery metrics row. MetricBand pill comes from sr-HeroSection.
 * Pure presentation. */

import type * as React from "react";
import { t, f, radius, size } from "../tokens";
import type { DeliveryMetric } from "../types";
import { SrSectionShell } from "./_primitives";
import { MetricBand } from "./sr-HeroSection";

export function CoreMetricsSection({ metrics }: { metrics: DeliveryMetric[] }) {
  return (
    <SrSectionShell
      anchorId="ir-section-metrics"
      headingId="ir-metrics-heading"
      label="Delivery"
      title="Delivery"
      subtitle="How you spoke, measured against a target for your role."
    >
      <div
        className="ir-tile-grid"
        style={{ "--ir-cols": metrics.length === 6 ? 3 : Math.min(metrics.length, 4) } as React.CSSProperties}
      >
        {metrics.map((m) => (
          <div
            key={m.label}
            style={{
              border: `1px solid ${t.line}`,
              borderRadius: radius.bar,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span style={{ fontFamily: f.sans, fontSize: size.base, color: t.inkSoft }}>{m.label}</span>
            <div style={{ fontFamily: f.sans, fontSize: size["3xl"], fontWeight: 700, color: t.coal, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              {m.value}
              {m.unit && <span style={{ fontSize: size.md, fontWeight: 500, color: t.inkSoft, marginLeft: 3 }}>{m.unit}</span>}
            </div>
            <div style={{ fontFamily: f.sans, fontSize: size.sm, color: t.inkSoft }}>{m.targetLabel}</div>
            <div style={{ marginTop: 2 }}>
              <MetricBand band={m.band} />
            </div>
          </div>
        ))}
      </div>
    </SrSectionShell>
  );
}
