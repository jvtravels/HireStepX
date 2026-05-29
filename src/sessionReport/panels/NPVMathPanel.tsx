import { NPV_MODEL, computeNpvRows, type NegotiationOutcome } from "../derivations";
import { PanelShell, toneToColor, t, f } from "./_primitives";

export function NPVMathPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const rows = computeNpvRows(outcome);
  if (rows.length === 0) return null;
  return (
    <PanelShell
      index="09"
      title="What this offer is really worth, after tax"
      subtitle="The headline rupee number minus tax and inflation: the actual rupees that hit your bank account."
    >
      <table className="nfr-table">
        <tbody>
          {rows.map((r, i) => {
            const tone = toneToColor(r.tone);
            const isLast = i === rows.length - 1;
            return (
              <tr key={i} className={isLast ? "nfr-table-total" : undefined}>
                <td>{r.label}</td>
                <td
                  className={isLast ? "nfr-table-total-value" : undefined}
                  style={{
                    textAlign: "right", fontFamily: f.mono,
                    fontWeight: isLast ? 800 : 600, color: tone,
                  }}
                >
                  {r.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: t.inkFaint, fontStyle: "italic", marginTop: 12, lineHeight: 1.5 }}>
        Assumes the {Math.round(NPV_MODEL.incomeTaxRate * 100)}% Indian income-tax slab + {Math.round(NPV_MODEL.annualInflation * 100)}% annual inflation over a {NPV_MODEL.horizonYears}-year horizon. If your slab or inflation expectations differ, the take-home and today's-rupees rows will shift accordingly.
      </div>
    </PanelShell>
  );
}
