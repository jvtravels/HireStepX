import type { NegotiationOutcome } from "../derivations";
import { PanelShell, ToneCard, FreshnessChip, t } from "./_primitives";

export function CounterpartyPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (!outcome.counterpartyFacts || outcome.counterpartyFacts.length === 0) return null;
  return (
    <PanelShell
      index="10"
      title="How this company usually negotiates"
      subtitle="What we've learned about this employer specifically: where they're flexible, where they're not."
      aside={
        outcome.counterpartySource ? (
          <FreshnessChip source={outcome.counterpartySource} asOf="last 30d" />
        ) : undefined
      }
    >
      <div className="nfr-vstack">
        {outcome.counterpartyFacts.map((cf, i) => {
          const tone: "good" | "warn" | "bad" =
            cf.tone === "good" ? "good" : cf.tone === "bad" ? "bad" : "warn";
          return (
            <ToneCard key={i} tone={tone}>
              <div style={{ fontSize: 13, color: t.coal, lineHeight: 1.55 }}>{cf.fact}</div>
            </ToneCard>
          );
        })}
      </div>
    </PanelShell>
  );
}
