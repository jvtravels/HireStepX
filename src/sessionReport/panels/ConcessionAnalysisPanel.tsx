import { deriveConcessionsFromOffers, type NegotiationOutcome } from "../derivations";
import { PanelShell, PanelEmptyState, ToneCard, t } from "./_primitives";

export function ConcessionAnalysisPanel({ outcome }: { outcome: NegotiationOutcome }) {
  const events = outcome.pushbacks ?? deriveConcessionsFromOffers(outcome);
  const offerRounds = (outcome.offers ?? []).length;
  /* PDF#45 — honest empty state. When the classifier hasn't produced
   * grounded pushback events but offers DID move (≥2 rounds), render
   * a transparent "we tracked rupees but didn't classify your verbal
   * responses" tile instead of fabricating verdicts. */
  if (events.length === 0) {
    if (offerRounds < 2) return null;
    return (
      <PanelEmptyState
        index="02"
        title="When they pushed back, did you fold?"
        subtitle={`${offerRounds} offer rounds tracked.`}
      >
        We tracked the rupee trajectory across {offerRounds} rounds (see the
        outcome record above), but we don't have a transcript-grounded
        read on how you responded to each pushback in this session.
        Next round: name a defended range up front so each recruiter
        counter has something specific to push against.
      </PanelEmptyState>
    );
  }
  const held = events.filter(e => e.outcome === "held").length;
  return (
    <PanelShell
      index="02"
      title="When they pushed back, did you fold?"
      subtitle={`You held ${held} of ${events.length} pushbacks.`}
    >
      <div className="nfr-vstack">
        {events.map((e, i) => {
          const tone: "good" | "warn" | "bad" =
            e.outcome === "held" ? "good" : e.outcome === "deflected" ? "warn" : "bad";
          return (
            <ToneCard
              key={i}
              tone={tone}
              pill={<span className={`nfr-pill nfr-pill-${tone}`}>{e.outcome}</span>}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: t.coal, marginBottom: 3 }}>
                "{e.pushback}"
              </div>
              <div style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.5 }}>{e.detail}</div>
            </ToneCard>
          );
        })}
      </div>
    </PanelShell>
  );
}
