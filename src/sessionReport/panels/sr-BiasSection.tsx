/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Language-pattern hits research has tied to lower hiring outcomes.
 * Pure presentation. */

import type { BiasFinding } from "../types";
import { SrSectionShell } from "./_primitives";

export function BiasSection({ findings }: { findings: BiasFinding[] }) {
  if (!findings || findings.length === 0) return null;
  return (
    <SrSectionShell
      anchorId="ir-section-bias"
      headingId="ir-bias-heading"
      label="Perception optimizer"
      title="Language patterns to watch"
      subtitle="Research-backed patterns that tend to lower hiring perception. Not a judgment — a perception optimizer."
    >
      <div className="ir-bias-grid">
        {findings.map((b) => (
          <div key={b.kind} className="ir-bias-card">
            <div className="ir-bias-card-head">
              <span className="ir-bias-count">{b.count}×</span>
              <span className="ir-bias-label">{b.label}</span>
            </div>
            {b.example && (
              <span className="ir-bias-example">&ldquo;{b.example}&rdquo;</span>
            )}
            <span className="ir-bias-tip">{b.suggestion}</span>
          </div>
        ))}
      </div>
    </SrSectionShell>
  );
}
