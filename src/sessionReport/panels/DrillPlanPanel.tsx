import type { NegotiationOutcome } from "../derivations";
import { PanelShell, EyebrowLabel, t, f } from "./_primitives";

export function DrillPlanPanel({ outcome, onLaunchDrill }: { outcome: NegotiationOutcome; onLaunchDrill?: (slug: string) => void }) {
  if (!outcome.drills || outcome.drills.length === 0) return null;
  return (
    <PanelShell
      index="12"
      title="Drills for the next 5 days"
      subtitle="Each drill targets one specific habit you can fix this week."
    >
      <div className="nfr-grid-3up">
        {outcome.drills.map((d, i) => (
          <div
            key={i}
            className="nfr-info-tile-roomy nfr-info-tile nfr-vstack"
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <EyebrowLabel color={t.indigo} marginBottom={0}>DRILL {i + 1}</EyebrowLabel>
              <div style={{ fontSize: 10, color: t.inkFaint, fontFamily: f.mono, letterSpacing: 0.4 }}>
                {d.effort}
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.coal, lineHeight: 1.3, fontFamily: f.serif }}>
              {d.title}
            </div>
            <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.5, flex: 1 }}>{d.goal}</div>
            {onLaunchDrill && d.slug && (
              <button
                className="nfr-btn-primary"
                style={{ marginTop: 4, width: "100%" }}
                onClick={() => onLaunchDrill(d.slug!)}
              >
                Start drill →
              </button>
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}
