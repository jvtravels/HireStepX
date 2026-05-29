import type { NegotiationOutcome } from "../derivations";
import { PanelShell, t, f } from "./_primitives";

/** Build the rendered coaching text for the calibrated-surprise lowball
 *  event. Exported so tests can lock the exact prose without doing
 *  brittle DOM scraping. The two branches (held vs revised) carry
 *  different tone: the held branch is a "most expensive moment" warning,
 *  the revised branch is positive reinforcement plus a forward-looking
 *  next-time directive. */
export function renderLowballEventText(
  ev: NonNullable<NegotiationOutcome["lowballEvent"]>,
): { headline: string; gapLine: string; recruiterLine: string; candidateLine: string; takeaway: string } {
  const gapLpa = Math.max(0, Math.round((ev.bandFloor - ev.candidateAnchor) * 10) / 10);
  const headline = `You anchored at ₹${ev.candidateAnchor}L`;
  const gapLine = `That came in about ₹${gapLpa}L below the band floor for this role.`;
  const recruiterLine =
    "The recruiter probed it with a calibrated surprise — a quiet signal that the number was under-anchored.";
  const candidateLine = ev.candidateHeld
    ? "You held the lowball — you reaffirmed the number instead of revising up."
    : "You revised up after the probe — you adjusted your anchor once the signal landed.";
  const takeaway = ev.candidateHeld
    ? "This is the most expensive moment of the call. The recruiter gave you a clear signal that you were under-anchoring, and you confirmed the low number. Recovery is hard once you've reaffirmed an ask."
    : "Good recovery. The recruiter probed, you adjusted. Next time, anchor higher in the first place — the surprise probe tells you the band floor is significantly above where you started.";
  return { headline, gapLine, recruiterLine, candidateLine, takeaway };
}

function LowballEventInsight({
  ev,
}: {
  ev: NonNullable<NegotiationOutcome["lowballEvent"]>;
}) {
  const text = renderLowballEventText(ev);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        columnGap: 14,
        padding: 14,
        background: t.copperTint,
        border: `1px solid ${t.copper}`,
        borderRadius: 8,
      }}
    >
      <span
        style={{
          fontFamily: f.mono, fontSize: 13, fontWeight: 700,
          color: t.copper, paddingTop: 1,
        }}
      >
        !!
      </span>
      <div>
        <div
          style={{
            fontSize: 14, fontWeight: 700, color: t.coal,
            fontFamily: f.mono, marginBottom: 6,
          }}
        >
          {text.headline}
        </div>
        <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.55, marginBottom: 4 }}>
          {text.gapLine}
        </div>
        <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.55, marginBottom: 4 }}>
          {text.recruiterLine}
        </div>
        <div style={{ fontSize: 12, color: t.coal, lineHeight: 1.55, marginBottom: 8, fontWeight: 600 }}>
          {text.candidateLine}
        </div>
        <div style={{ fontSize: 12, color: t.coal, lineHeight: 1.55, fontStyle: "italic" }}>
          {text.takeaway}
        </div>
      </div>
    </div>
  );
}

export function UnaskedLeversPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const hasLevers = !!outcome.unaskedLevers && outcome.unaskedLevers.length > 0;
  const hasLowball = !!outcome.lowballEvent;
  if (!hasLevers && !hasLowball) return null;
  return (
    <PanelShell
      index="06"
      title="Questions you should have asked but didn't"
      subtitle="Each of these would likely have unlocked more money. We explain what each is worth."
    >
      <div className="nfr-vstack-lg">
        {hasLowball && <LowballEventInsight ev={outcome.lowballEvent!} />}
        {hasLevers && (
          <ol
            className="nfr-vstack-lg"
            style={{ listStyle: "none", padding: 0, margin: 0 }}
          >
            {outcome.unaskedLevers!.map((l, i) => (
              <li key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 14 }}>
                <span
                  style={{
                    fontFamily: f.mono, fontSize: 13, fontWeight: 700,
                    color: t.copper, paddingTop: 1,
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.coal, fontFamily: f.mono, marginBottom: 4 }}>
                    {l.question}
                  </div>
                  <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.5 }}>{l.whyItMatters}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </PanelShell>
  );
}
