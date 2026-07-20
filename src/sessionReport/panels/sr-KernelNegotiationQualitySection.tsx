/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Phase 3 kernel-metrics view: 6 tiles + tactics/info-intent panel.
 * Distinct from NegotiationFullReport (which is transcript-derived).
 * Pure presentation. */

import { t, f, radius } from "../tokens";
import type { InterviewResultData } from "../types";
import { anchorAtLabel } from "../derivations";
import { SrSectionShell } from "./_primitives";

type KernelMetrics = NonNullable<InterviewResultData["kernelMetrics"]>;

const TACTIC_LABELS: Record<string, { name: string; what: string }> = {
  "calibrated": { name: "Calibrated question", what: "Asked a 'how' / 'what' question that made the recruiter solve the problem with you." },
  "label": { name: "Label", what: "Named what the other side was feeling ('it sounds like budget is tight…') to defuse and unlock info." },
  "mirror": { name: "Mirror", what: "Repeated their last 1–3 words to keep them talking and reveal more." },
  "sign-today-bundle": { name: "Sign-today bundle", what: "Offered to close today *if* a specific lever moves — turns urgency into leverage." },
  "deflect-current-ctc": { name: "Deflected current CTC", what: "Side-stepped the 'what's your current package?' anchor and re-asked about the role." },
};
const INFO_LABELS: Record<string, string> = {
  "clawback-period": "Joining-bonus clawback (years + pro-ration)",
  "variable-history": "Historical variable payout %",
  "vest-schedule": "Equity vest schedule & cliff",
  "strike-price": "Equity strike / FMV",
  "in-hand-monthly": "In-hand monthly after tax",
  "exercise-window": "Post-exit exercise window",
  "acceleration": "Single/double-trigger acceleration",
  "fixed-vs-variable": "Fixed-vs-variable split",
  "perks-non-cash": "Non-cash perks (insurance, learning, etc.)",
};
const ALL_TACTICS = Object.keys(TACTIC_LABELS);

function KernelTacticsPanel({ m }: { m: KernelMetrics }) {
  const used = (m.vossTacticsUsed ?? []).filter((tk) => TACTIC_LABELS[tk]);
  const usedSet = new Set(used);
  const missed = ALL_TACTICS.filter((tk) => !usedSet.has(tk));
  const asked = (m.infoAsked ?? []).filter((k) => INFO_LABELS[k]);
  const showCallouts = !!m.walkAwayReturned || !!m.hardBandCap || (m.marketMode && m.marketMode !== "neutral");
  if (used.length === 0 && asked.length === 0 && !showCallouts) return null;
  const Chip = ({ children, tone }: { children: React.ReactNode; tone: "good" | "muted" }) => (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: radius.pill,
      fontFamily: f.sans, fontSize: 12, fontWeight: 500,
      background: tone === "good" ? t.kernelGoodBg : t.creamSoft,
      color: tone === "good" ? t.kernelGoodInk : t.inkSoft,
      border: `1px solid ${tone === "good" ? t.kernelGoodBorder : t.line}`,
    }}>{children}</span>
  );
  return (
    <div style={{ marginTop: 22, display: "grid", gap: 22 }}>
      {(used.length > 0 || missed.length > 0) && (
        <div>
          <h3 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: "0 0 8px", letterSpacing: 0.2, textTransform: "uppercase" }}>
            Tactics
          </h3>
          {used.length > 0 && (
            <>
              <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "0 0 6px" }}>You used:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {used.map((tk) => <Chip key={tk} tone="good">{TACTIC_LABELS[tk].name}</Chip>)}
              </div>
              <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, lineHeight: 1.55 }}>
                {used.map((tk) => <li key={tk}><strong style={{ color: t.coal }}>{TACTIC_LABELS[tk].name}.</strong> {TACTIC_LABELS[tk].what}</li>)}
              </ul>
            </>
          )}
          {missed.length > 0 && (
            <>
              <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "0 0 6px" }}>
                {used.length > 0 ? "You didn't try:" : "Tactics worth practicing next session:"}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {missed.map((tk) => <Chip key={tk} tone="muted">{TACTIC_LABELS[tk].name}</Chip>)}
              </div>
            </>
          )}
        </div>
      )}
      {asked.length > 0 && (
        <div>
          <h3 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: "0 0 8px", letterSpacing: 0.2, textTransform: "uppercase" }}>
            Questions you raised
          </h3>
          <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "0 0 6px" }}>
            Specific levers you pried open — each is a number-mover most candidates skip.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {asked.map((k) => <Chip key={k} tone="good">{INFO_LABELS[k]}</Chip>)}
          </div>
        </div>
      )}
      {showCallouts && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {m.marketMode === "soft" && (
            <div style={{ padding: "8px 12px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: radius.lg, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
              Simulated <strong style={{ color: t.coal }}>soft market</strong> — recruiters concede ~30% less than baseline. Cash gains here are harder-won than the % suggests.
            </div>
          )}
          {m.marketMode === "hot" && (
            <div style={{ padding: "8px 12px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: radius.lg, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
              Simulated <strong style={{ color: t.coal }}>hot market</strong> — recruiters concede ~30% more than baseline. Match this anchoring discipline in a normal market.
            </div>
          )}
          {m.hardBandCap && (
            <div style={{ padding: "8px 12px", background: t.creamSoft, border: `1px solid ${t.line}`, borderRadius: radius.lg, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
              <strong style={{ color: t.coal }}>Hard band cap.</strong> The simulated company had a fixed fitment grid (services-co pattern). The kernel redirected to joining bonus, equity, and benefits — the right play.
            </div>
          )}
          {m.walkAwayReturned && (
            <div style={{ padding: "8px 12px", background: t.kernelWarnBg, border: `1px solid ${t.kernelWarnBorder}`, borderRadius: radius.lg, fontFamily: f.sans, fontSize: 12, color: t.kernelWarnInk }}>
              <strong>You walked away and came back.</strong> This works, but the recruiter prices in your reduced leverage — concession rate halves after a return.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function KernelNegotiationQualitySection({ m }: { m: KernelMetrics }) {
  const outcomeLabel = {
    "accepted": "Accepted",
    "walked-away": "Walked away",
    "stalemate": "Stalemate",
    // S16-B8 (2026-07-18 audit) — this tile renders on a CONCLUDED report; a
    // non-terminal kernel phase means the candidate abandoned mid-flow, so
    // "In progress" reads as a live session that never ended. "Ended early" is
    // the honest label for a report surface.
    "in-progress": "Ended early",
  }[m.outcome];
  const outcomeColor = m.outcome === "accepted" ? t.goodInk
    : m.outcome === "walked-away" ? t.badInk
    : m.outcome === "stalemate" ? t.warnInk
    : t.inkSoft;
  const anchorLabel = anchorAtLabel(m.anchorTurn, m.candidateAskLpa);
  const traversalPct = m.bandTraversal == null ? null : Math.round(m.bandTraversal * 100);
  const ctc = m.candidateCurrentCtcLpa ?? null;
  const finalOffer = m.finalOfferLpa ?? null;
  const hikePct = ctc != null && ctc > 0 && finalOffer != null && finalOffer > 0
    ? Math.round((finalOffer / ctc - 1) * 100)
    : null;
  const tiles: Array<{ label: string; value: string; sub?: string }> = [
    { label: "Execution score", value: `${m.score}`, sub: "/100" },
    { label: "Outcome", value: outcomeLabel },
    { label: "Anchored at", value: anchorLabel },
    { label: "LPA gained", value: `₹${m.lpaGained}`, sub: `LPA · ${m.lpaPerTurn}/turn` },
    { label: "Band traversal", value: traversalPct == null ? "—" : `${traversalPct}%`, sub: traversalPct == null ? "no spread" : "of ceiling" },
    { label: "Lever diversity", value: `${m.leverDiversity}`, sub: `lever${m.leverDiversity === 1 ? "" : "s"} explored` },
    ...(hikePct != null
      ? [{ label: "Hike from current", value: `${hikePct > 0 ? "+" : ""}${hikePct}%`, sub: `from ₹${ctc} LPA` }]
      : []),
  ];
  const outcomeChip = (
    <span style={{ fontFamily: f.mono, fontSize: 11, color: outcomeColor, letterSpacing: "0.06em", textTransform: "uppercase" }}>
      {outcomeLabel}
    </span>
  );
  return (
    <SrSectionShell
      anchorId="ir-section-kernel-neg"
      headingId="ir-kernel-neg-heading"
      num="N1"
      label="Negotiation quality"
      title="How you negotiated"
      subtitle={`How well you ran the negotiation itself — scored deterministically from the ${m.totalTurns} kernel-tracked turns (your actual lever picks and counters, not transcript regex). This is separate from your overall interview-readiness score up top: anchoring early, climbing the band, and exploring multiple levers all lift it.`}
      aside={outcomeChip}
    >
      <div className="ir-tile-grid">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: radius.bar,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{tile.label}</span>
            <div style={{ fontFamily: f.serif, fontSize: 32, color: t.coal, lineHeight: 1, letterSpacing: "-0.02em" }}>
              {tile.value}
              {tile.sub && tile.label === "Execution score" && (
                <span style={{ fontSize: 16, color: t.inkSoft, marginLeft: 2, fontFamily: f.mono }}>{tile.sub}</span>
              )}
            </div>
            {tile.sub && tile.label !== "Quality score" && (
              <div style={{ fontFamily: f.mono, fontSize: 11, color: t.inkSoft, letterSpacing: "0.04em" }}>{tile.sub}</div>
            )}
          </div>
        ))}
      </div>
      {m.overBandViolation && (
        <div style={{
          marginTop: 14,
          padding: "10px 14px",
          background: t.kernelBadBg,
          border: `1px solid ${t.kernelBadBorder}`,
          borderRadius: radius.lg,
          fontFamily: f.sans,
          fontSize: 12,
          color: t.kernelBadInk,
        }}>
          Kernel anomaly: AI offered above the band ceiling on at least one turn. This shouldn't happen — please report.
        </div>
      )}
      {(m.candidateCurrentCtcLpa == null) && (
        <div style={{
          marginTop: 14,
          padding: "10px 14px",
          background: t.creamSoft,
          border: `1px solid ${t.line}`,
          borderRadius: radius.lg,
          fontFamily: f.sans,
          fontSize: 12,
          color: t.inkSoft,
        }}>
          <strong style={{ color: t.coal }}>CTC not shared.</strong> You never stated your current package, so the simulation used role-average band defaults. Share your actual CTC in your next session for a personalised band and hike-% read.
        </div>
      )}
      <KernelTacticsPanel m={m} />
    </SrSectionShell>
  );
}
