import type { NegotiationOutcome } from "../derivations";
import { PanelShell, PanelEmptyState, EyebrowLabel, t, f, radius, space } from "./_primitives";

export function ArchetypePanel({ outcome, priorSessionCount }: { outcome: NegotiationOutcome; priorSessionCount?: number }) {
  if (!outcome.archetype) {
    if ((priorSessionCount ?? 0) < 2) {
      return (
        <PanelEmptyState
          index="11"
          title="The pattern across your sessions"
          subtitle="We need at least two negotiation sessions to spot a pattern."
          infoSize="roomy"
        >
          Run one more negotiation session and we'll show you the habit
          you keep repeating, and the single move that breaks the pattern.
        </PanelEmptyState>
      );
    }
    return null;
  }
  const a = outcome.archetype;
  return (
    <PanelShell
      index="11"
      title="The pattern we see across all your sessions"
      subtitle="What you keep getting right, and the one habit that keeps holding you back."
    >
      <div style={{ marginBottom: space.xl }}>
        <span className="nfr-pill nfr-pill-warn">REPEATED PATTERN</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: t.coal, marginBottom: space.lg, letterSpacing: -0.2, fontFamily: f.serif }}>
        {a.title}
      </div>
      <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.6, marginBottom: space.panel }}>{a.body}</div>

      {a.arc && a.arc.length > 0 && (
        <div style={{ marginBottom: space.panel }}>
          <EyebrowLabel marginBottom={space.lg}>{(a.arcMetric ?? "TREND").toUpperCase()} ACROSS SESSIONS</EyebrowLabel>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${a.arc.length}, 1fr)`,
              gap: space.lg, alignItems: "end", height: 110,
            }}
          >
            {a.arc.map((p, i) => {
              const max = Math.max(...a.arc!.map(x => x.score));
              const color = p.score < 35 ? t.error : p.score > 70 ? t.success : t.copper;
              const bg = p.score < 35 ? t.error100 : p.score > 70 ? t.success100 : t.copperSoft;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: space.sm }}>
                  <div style={{ fontSize: 11, fontFamily: f.mono, fontWeight: 700, color }}>
                    {p.score}
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: `${(p.score / max) * 70 + 8}px`,
                      background: bg, border: `1px solid ${color}`,
                      borderRadius: "6px 6px 2px 2px",
                    }}
                  />
                  <div style={{ fontSize: 10, color: t.inkSoft, fontFamily: f.mono, marginTop: 2 }}>
                    {p.label}
                  </div>
                  {p.highlight && (
                    <div style={{ fontSize: 9, color: t.inkFaint, fontStyle: "italic", textAlign: "center", lineHeight: 1.3 }}>
                      {p.highlight}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: space.row, background: t.success100, borderRadius: radius.lg, fontSize: 13, color: t.coal }}>
        <EyebrowLabel color={t.success} marginBottom={space.xs}>THE FIX</EyebrowLabel>
        {a.fix}
      </div>
    </PanelShell>
  );
}
