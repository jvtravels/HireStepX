import type { NegotiationOutcome } from "../derivations";
import { PanelShell, FreshnessChip, StatTile, t, f, radius } from "./_primitives";

export function CohortPlacementPanel({ outcome }: { outcome: NegotiationOutcome }) {
  if (typeof outcome.percentileWithinBand !== "number") return null;
  const p = outcome.percentileWithinBand;
  const tone = p < 30 ? t.error : p > 70 ? t.success : t.copper;
  const phrase = p < 30 ? `Bottom ${p}% of candidates` : p > 70 ? `Top ${100 - p}% of candidates` : "Around the middle of the band";
  const hasAttribution = typeof outcome.cohortN === "number" && !!outcome.cohortFreshness;
  return (
    <PanelShell
      index="08"
      title="Where your offer sits vs others like you"
      subtitle={outcome.cohortLabel ?? "Compared to candidates with the same role + level + company tier."}
      aside={
        hasAttribution ? (
          <FreshnessChip
            source="Cohort data"
            n={outcome.cohortN}
            asOf={outcome.cohortFreshness}
            methodologyUrl={outcome.cohortMethodologyUrl}
          />
        ) : (
          <span
            className="nfr-pill nfr-pill-neutral"
            title="Cohort attribution not yet available; treat the placement as an early estimate."
          >
            Early estimate
          </span>
        )
      }
    >
      {hasAttribution ? (
        <>
          <StatTile variant="headline" value={`p${p}`} phrase={phrase} valueColor={tone} />
          <div
            style={{
              height: 12, background: t.line, borderRadius: radius.tile,
              position: "relative", marginBottom: 8, marginTop: 16,
            }}
          >
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "25%", background: t.error100, borderRadius: "6px 0 0 6px" }} />
            <div style={{ position: "absolute", left: "25%", top: 0, bottom: 0, width: "50%", background: t.copperMid }} />
            <div style={{ position: "absolute", left: "75%", top: 0, bottom: 0, right: 0, background: t.success100, borderRadius: "0 6px 6px 0" }} />
            <div style={{ position: "absolute", left: `${p}%`, top: -4, bottom: -4, width: 4, background: t.coal, borderRadius: radius.rail, transform: "translateX(-2px)" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.inkFaint, fontFamily: f.mono, letterSpacing: 0.4 }}>
            <span>p25</span><span>p50</span><span>p75</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 15, color: t.coal, lineHeight: 1.55, marginTop: 4 }}>
          {p < 30
            ? "Your offer looks below the typical band for this role and level."
            : p > 70
            ? "Your offer looks above the typical band for this role and level."
            : "Your offer looks around the typical band for this role and level."}{" "}
          <span style={{ color: t.inkSoft }}>
            We'll show exactly where it sits once we have enough cohort data to compare.
          </span>
        </div>
      )}
    </PanelShell>
  );
}
