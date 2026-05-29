import { derivePhases, type NegotiationOutcome } from "../derivations";
import { PanelShell, StatTile, t, f, radius, space } from "./_primitives";

export function PhaseLadderPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const phases = derivePhases(outcome);
  const reached = phases.filter(p => p.reached).length;
  const total = phases.length;
  const reachedColor = reached >= 4 ? t.success : reached >= 2 ? t.copper : t.error;
  return (
    <PanelShell
      index="01"
      title="How far you got in the negotiation"
      subtitle={`A strong negotiation moves through ${total} stages, from naming a counter all the way to closing.`}
      aside={
        <StatTile
          variant="aside"
          value={reached}
          denominator={total}
          label="Stages"
          valueColor={reachedColor}
        />
      }
    >
      <div className="nfr-phase-rail" style={{ display: "flex", gap: space.xs, marginBottom: space.block, marginTop: space.xs }}>
        {phases.map((p) => (
          <div key={p.num} style={{ flex: 1, height: 8, borderRadius: radius.sm, background: p.reached ? t.success : t.line }} />
        ))}
      </div>
      {(() => {
        const nextIdx = phases.findIndex(p => !p.reached);
        return (
          <div className="nfr-vstack-md">
            {phases.map((p, i) => {
              const isNext = i === nextIdx;
              const bg = p.reached ? t.success100 : isNext ? t.copperWash : t.creamSoft;
              const border = p.reached ? t.success : isNext ? t.copper : t.line;
              return (
                <div
                  key={p.num}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 14px",
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: radius.xl,
                    opacity: p.reached || isNext ? 1 : 0.6,
                  }}
                >
                  <div
                    style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: p.reached ? t.success : isNext ? t.copper : t.white,
                      color: p.reached || isNext ? t.white : t.inkFaint,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: 13, fontFamily: f.mono,
                      border: p.reached || isNext ? "none" : `1px solid ${t.lineStrong}`,
                      flexShrink: 0,
                    }}
                  >
                    {p.reached ? "✓" : p.num}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: t.coal }}>{p.name}</div>
                    {p.note && <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 2 }}>{p.note}</div>}
                  </div>
                  <span className={`nfr-pill ${p.reached ? "nfr-pill-good" : isNext ? "nfr-pill-warn" : "nfr-pill-neutral"}`}>
                    {p.reached ? "Reached" : isNext ? "Try this next" : "Not reached"}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </PanelShell>
  );
}
