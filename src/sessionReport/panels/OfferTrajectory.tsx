import React from "react";
import type { NegotiationOutcome } from "../derivations";
import { OutlinedCard, EyebrowLabel, t, f, radius, space } from "./_primitives";

/* Big rupee-amount pill — used inside OfferTrajectory for both the
 * recruiter offer chain and the candidate's stated ask. */
function AmountPill({
  variant,
  children,
}: { variant: "offer" | "ask"; children: React.ReactNode }) {
  const isAsk = variant === "ask";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontFamily: f.serif, fontSize: 16, fontWeight: 600,
        color: isAsk ? t.copper : t.coal,
        padding: "6px 12px",
        background: isAsk ? t.copperSoft : t.cream,
        border: `1px solid ${isAsk ? t.copperBorder : t.line}`,
        borderRadius: radius.pill,
      }}
    >
      {children}
    </span>
  );
}

export function OfferTrajectory({ outcome }: { outcome: NegotiationOutcome }) {
  const offers = outcome.offers ?? [];
  if (offers.length === 0) return null;
  const initial = offers[0].total;
  const final = outcome.finalTotal !== null && outcome.finalTotal > initial
    ? Math.round((outcome.finalTotal - initial) * 10) / 10
    : null;
  if (offers.length === 1 && outcome.candidateAsk === null) {
    return (
      <OutlinedCard marginBottom={space.panel}>
        <EyebrowLabel marginBottom={10}>What happened</EyebrowLabel>
        <div style={{ fontSize: 14, color: t.coal, lineHeight: 1.6 }}>
          They opened at <strong style={{ fontFamily: f.serif }}>₹{initial} LPA</strong>. You didn't name a counter, so this became the final number. The conversation never moved past the offer-reaction stage.
        </div>
      </OutlinedCard>
    );
  }
  return (
    <OutlinedCard marginBottom={space.panel}>
      <EyebrowLabel marginBottom={10}>Offer progression</EyebrowLabel>
      <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {offers.map((o, i) => (
          <li key={i} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <AmountPill variant="offer">₹{o.total} LPA</AmountPill>
            {i < offers.length - 1 && <span aria-hidden style={{ color: t.inkFaint, fontSize: 14 }}>→</span>}
          </li>
        ))}
        {outcome.candidateAsk !== null && (
          <>
            <span aria-hidden style={{ color: t.inkFaint, fontSize: 14, marginLeft: 4 }}>•</span>
            <li style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, textTransform: "uppercase", letterSpacing: 0.6 }}>
                your ask
              </span>
              <AmountPill variant="ask">₹{outcome.candidateAsk} LPA</AmountPill>
            </li>
          </>
        )}
      </ol>
      {final !== null && (
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 10 }}>
          You moved the offer up by <strong style={{ color: t.coal }}>₹{final} LPA</strong> from the opening number.
          {typeof outcome.percentileWithinBand === "number" && (
            <> {" "}You closed <strong style={{ color: t.coal }}>{outcome.percentileWithinBand}%</strong> of the gap to your stated ask.</>
          )}
        </div>
      )}
    </OutlinedCard>
  );
}
