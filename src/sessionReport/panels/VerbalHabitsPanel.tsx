import type { NegotiationOutcome } from "../derivations";
import { PanelShell, EventRow, EyebrowLabel, PlayableTime, t, f, space } from "./_primitives";

export function VerbalHabitsPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.verbalHabits || outcome.verbalHabits.length === 0) return null;
  const leaks = outcome.disclosureLeaks ?? [];
  return (
    <PanelShell
      index="04"
      title="Words you said that hurt your offer"
      subtitle="Phrases like 'I think', 'kind of', or 'sounds fair' make recruiters lower their offer. Click the timestamp to listen back."
    >
      <div style={{ marginBottom: leaks.length > 0 ? space.panel : 0 }}>
        <EyebrowLabel>TOP COSTLY PHRASES</EyebrowLabel>
        <div className="nfr-vstack-md">
          {outcome.verbalHabits.map((h, i) => (
            <EventRow
              key={i}
              tone="neutral"
              leading={
                <div style={{ fontFamily: f.mono, fontSize: 14, fontWeight: 700, color: t.error, minWidth: 32 }}>
                  ×{h.count}
                </div>
              }
              primary={
                <div style={{ fontSize: 13, fontWeight: 500, color: t.coal, fontFamily: f.mono }}>
                  "{h.phrase}"
                </div>
              }
              secondary={<span style={{ fontSize: 11 }}>{h.cost}</span>}
              trailing={
                h.timestamps && h.timestamps.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", maxWidth: 180 }}>
                    {h.timestamps.map((ts, j) => <PlayableTime key={j} at={ts} />)}
                  </div>
                ) : undefined
              }
            />
          ))}
        </div>
      </div>
      {leaks.length > 0 && (
        <div>
          <EyebrowLabel color={t.error}>DISCLOSURE LEAKS · {leaks.length}</EyebrowLabel>
          <div className="nfr-vstack-sm">
            {leaks.map((l, i) => (
              <EventRow
                key={i}
                tone="bad"
                leading={<PlayableTime at={l.at} />}
                primary={
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.error, fontFamily: f.mono }}>
                    · {l.leak}
                  </div>
                }
                secondary={<span style={{ fontSize: 11 }}>{l.cost}</span>}
              />
            ))}
          </div>
        </div>
      )}
    </PanelShell>
  );
}
