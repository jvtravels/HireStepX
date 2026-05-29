/* Offer Economics — clawback-honest view of the headline number.
 *
 * Renders three stat tiles (headline, stayed-12mo, leave-early floor)
 * and a single asterisk sentence below. Composition of pure derivation
 * + existing panel primitives — no new tokens, no new chrome. The
 * derivation logic lives at ../derivations/offerNetValue.ts. */

import {
  computeOfferNetValue,
  type OfferNetValueInput,
} from "../derivations/offerNetValue";
import { PanelShell, StatTile, t, f } from "./_primitives";

export interface OfferEconomicsPanelProps {
  offer: OfferNetValueInput;
}

const fmtLpa = (v: number) => `₹${v.toFixed(1)}L`;

export function OfferEconomicsPanel({ offer }: OfferEconomicsPanelProps) {
  const net = computeOfferNetValue(offer);
  return (
    <PanelShell
      index="10"
      title="What this offer is actually worth, net of clawback risk"
      subtitle="The offer-letter headline assumes you stay through the joining-bonus cliff. Here's the floor if you don't."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 16,
        }}
      >
        <StatTile
          variant="monthly"
          label="Headline CTC (offer letter)"
          value={fmtLpa(net.headlineCtc)}
          suffix="/yr"
          footnote={`includes ${fmtLpa(net.joiningBonus)} joining bonus`}
        />
        <StatTile
          variant="monthly"
          label={`If you stay ${net.joiningBonusClawbackWindowMonths || 12}+ months`}
          value={fmtLpa(net.effectiveYearOneStayedFull)}
          suffix="yr 1"
          footnote={`${fmtLpa(net.guaranteedCash)} guaranteed + ${fmtLpa(net.joiningBonus)} JB clears`}
        />
        <StatTile
          variant="monthly"
          label="If you leave at month 11"
          value={fmtLpa(net.effectiveYearOneIfLeaveEarly)}
          suffix="yr 1 floor"
          footnote="full joining-bonus clawback"
        />
      </div>
      <div
        style={{
          fontSize: 12,
          color: t.inkSoft,
          fontStyle: "italic",
          marginTop: 14,
          lineHeight: 1.5,
          fontFamily: f.sans,
        }}
      >
        {net.asteriskNote}
      </div>
    </PanelShell>
  );
}
