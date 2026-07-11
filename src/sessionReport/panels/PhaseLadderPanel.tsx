import { derivePhases, type NegotiationOutcome } from "../derivations";
import { PanelShell, StatTile, t, f, radius } from "./_primitives";

/* I-8 (2026-07-11, live staging) — these five stages are an INDEPENDENT skills
 * checklist, not a monotonic ladder (see derivePhases R-5 note): a candidate can
 * reach the close without ever handling a pushback because the recruiter never
 * pushed. The panel used to render them as a connected progress rail with a
 * filled-bar and a single "Try this next" rung, which read as a sequential
 * progression — so a reached stage after an unreached one looked like a broken
 * step-ladder. Presentation-only fix: drop the progress rail and the implied
 * "next step" treatment, render each stage as a standalone check / incomplete
 * row, and frame it explicitly as independent skills. The reached/not-reached
 * data is untouched — forcing monotonicity would fabricate a pushback that never
 * happened (PDF#45 anti-fabrication contract). */
export function PhaseLadderPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const phases = derivePhases(outcome);
  const reached = phases.filter(p => p.reached).length;
  const total = phases.length;
  const reachedColor = reached >= 4 ? t.success : reached >= 2 ? t.copper : t.error;
  return (
    <PanelShell
      index="01"
      title="Negotiation skills you showed"
      subtitle={`Five independent skills a strong negotiation demonstrates — not steps in order. You can close a deal without ever handling a pushback if the recruiter never pushed, so a skill can be checked even when one above it isn't.`}
      aside={
        <StatTile
          variant="aside"
          value={reached}
          denominator={total}
          label="Skills shown"
          valueColor={reachedColor}
        />
      }
    >
      <div className="nfr-vstack-md">
        {phases.map((p) => {
          const bg = p.reached ? t.success100 : t.creamSoft;
          const border = p.reached ? t.success : t.line;
          return (
            <div
              key={p.num}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 14px",
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: radius.xl,
                opacity: p.reached ? 1 : 0.6,
              }}
            >
              <div
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: p.reached ? t.success : t.white,
                  color: p.reached ? t.white : t.inkFaint,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 13, fontFamily: f.mono,
                  border: p.reached ? "none" : `1px solid ${t.lineStrong}`,
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                {p.reached ? "✓" : "—"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.coal }}>{p.name}</div>
                {p.note && <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 2 }}>{p.note}</div>}
              </div>
              <span className={`nfr-pill ${p.reached ? "nfr-pill-good" : "nfr-pill-neutral"}`}>
                {p.reached ? "Shown" : "Not shown"}
              </span>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}
