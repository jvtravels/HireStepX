import { deriveAnchorBracket, type NegotiationOutcome } from "../derivations";
import { PanelShell, PanelEmptyState, QuoteBlock, toneToColor, t, radius, space } from "./_primitives";

export function AnchorBracketPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const bracket = deriveAnchorBracket(outcome);
  /* PDF#45 — when the candidate DID name a counter but the classifier
   * hasn't produced grounded anchorBracket data, render a transparent
   * "we recorded ₹X but don't have a read on how you defended it" tile
   * instead of inventing a "you named a single number" verdict. */
  if (!bracket) {
    if (outcome.candidateAsk === null) return null;
    /* S16-B7 / S1-B1 (2026-07-18 audit) — "countered" presumes a recruiter
     * offer preceded the number. With offers === [] the candidate's number is
     * an OPENING ANCHOR, not a counter; label it accordingly. */
    const hasPriorOffer = (outcome.offers ?? []).length > 0;
    return (
      <PanelEmptyState
        index="03"
        title="The way you named your number"
        subtitle={
          hasPriorOffer
            ? `You countered with ₹${outcome.candidateAsk} LPA.`
            : `You opened with ₹${outcome.candidateAsk} LPA.`
        }
      >
        We logged your {hasPriorOffer ? "counter" : "opening number"} but don't have a transcript-grounded
        read on how you framed it (single number, range, or range
        with justification). The strongest move next round: name a
        defended range, e.g. "I was anchoring at ₹X-Y based on what
        I'm seeing in the market and where I am in other
        conversations", so the recruiter has to produce a
        counter-justification rather than just naming a lower number.
      </PanelEmptyState>
    );
  }
  const map = {
    single: { label: "Single number", tone: "warn" as const, ladder: 1 },
    range: { label: "Range only", tone: "warn" as const, ladder: 2 },
    range_with_justification: { label: "Range + justification", tone: "good" as const, ladder: 3 },
    none: { label: "No counter named", tone: "bad" as const, ladder: 0 },
  };
  const m = map[bracket.type];
  const toneColor = toneToColor(m.tone);
  return (
    <PanelShell
      index="03"
      title="The way you named your number"
      subtitle="There are 4 ways to counter an offer, from weakest to strongest."
    >
      <div style={{ marginBottom: space.xl }}>
        <span className={`nfr-pill nfr-pill-${m.tone}`}>{m.label}</span>
      </div>
      {bracket.quote && (
        <div style={{ marginBottom: space.xl }}>
          <QuoteBlock>{bracket.quote}</QuoteBlock>
        </div>
      )}
      <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.55 }}>{bracket.verdict}</div>
      <div style={{ marginTop: space.block, display: "flex", gap: space.sm }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1, height: 6, borderRadius: radius.rail,
              background: i <= m.ladder ? toneColor : t.line,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex", justifyContent: "space-between",
          marginTop: space.sm, fontSize: 10, color: t.inkFaint, letterSpacing: 0.4,
        }}
      >
        <span>NONE</span><span>SINGLE</span><span>RANGE</span><span>RANGE + JUSTIFY</span>
      </div>
    </PanelShell>
  );
}
