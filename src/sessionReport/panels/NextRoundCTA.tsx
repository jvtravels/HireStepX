import type { NegotiationOutcome } from "../derivations";
import { t, f, radius } from "./_primitives";

/* Bottom CTA — closes the report with a clear next move. The previous
   version of the report ended on the transcript collapsible. Users
   finished scrolling and had nowhere to go. */
export function NextRoundCTA({
  outcome, role, company,
}: { outcome: NegotiationOutcome; role: string; company: string }) {
  let title: string;
  let body: string;
  let primaryLabel: string;
  if (outcome.outcome === "accepted") {
    title = "Take this into your next negotiation";
    body = `You closed the deal on ${role} at ${company}. Run a session for the next role you're targeting, and practise the moves you missed before they cost you on the real one.`;
    primaryLabel = "Practise next round →";
  } else if (outcome.outcome === "walked_away") {
    title = "Run the next round";
    body = "You walked away. The right call needs a clear walk-away point. Practise a session for the same band with a stronger anchor + BATNA prepared.";
    primaryLabel = "Run a stronger session →";
  } else if (outcome.candidateAsk === null) {
    title = "Practise naming a counter";
    body = "You didn't name a counter-anchor in this session. Run the same scenario again, this time walking in with a specific number + bracket prepared.";
    primaryLabel = "Practise the counter →";
  } else {
    title = "Push past where you stalled";
    body = `You named ₹${outcome.candidateAsk} LPA but didn't close. Run another round and practise the lever-exploration phase where this session ended.`;
    primaryLabel = "Practise the next phase →";
  }
  return (
    <div
      style={{
        marginTop: 24, padding: "24px 26px",
        background: t.indigo, color: "#FFFFFF",
        borderRadius: radius.card, display: "flex",
        alignItems: "center", justifyContent: "space-between",
        gap: 20, flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, fontFamily: f.serif, letterSpacing: -0.2 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.78)", lineHeight: 1.5 }}>
          {body}
        </div>
      </div>
      <button
        style={{
          padding: "12px 22px",
          background: "#FFFFFF",
          color: t.indigo,
          border: "none",
          borderRadius: radius.lg,
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: f.sans,
          flexShrink: 0,
        }}
      >
        {primaryLabel}
      </button>
    </div>
  );
}
