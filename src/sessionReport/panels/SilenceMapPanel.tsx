import type { NegotiationOutcome } from "../derivations";
import { PanelShell, EventRow, PlayableTime, t } from "./_primitives";

export function SilenceMapPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.silenceMoments || outcome.silenceMoments.length === 0) return null;
  return (
    <PanelShell
      index="05"
      title="When you went quiet, and whether it helped"
      subtitle="Silence after you name a number is your friend. Silence when you should be pushing back is your enemy."
    >
      <div className="nfr-vstack">
        {outcome.silenceMoments.map((s, i) => (
          <EventRow
            key={i}
            tone={s.healthy ? "good" : "bad"}
            paddingX={14}
            leading={<PlayableTime at={s.at} />}
            primary={<div style={{ fontSize: 13, fontWeight: 600, color: t.coal }}>{s.duration} silence</div>}
            secondary={s.context}
            trailing={
              <span className={`nfr-pill ${s.healthy ? "nfr-pill-good" : "nfr-pill-bad"}`}>
                {s.healthy ? "Served you" : "Filled too fast"}
              </span>
            }
          />
        ))}
      </div>
    </PanelShell>
  );
}
