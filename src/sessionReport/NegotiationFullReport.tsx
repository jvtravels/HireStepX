/* HireStepX — Full Salary Negotiation Report (production)
 *
 * Top-level composition only. Each panel lives in its own file under
 * `./panels/`. Shared chrome (PanelShell, ToneCard, EventRow, StatTile,
 * etc.) lives in `./panels/_primitives.tsx`.
 *
 * Why the split (2026-05-29): the previous monolith hit 2,150 LOC with
 * 16 panel functions interleaved. The earlier audits had reasoned that
 * a split wouldn't compound (single consumer, panels not reused
 * elsewhere), and that's still true — but readability + diff-blast-
 * radius arguments won out. A change to one panel now diffs ~120 LOC
 * instead of touching the middle of a 2k-LOC file.
 *
 * Layout:
 *
 *   Part 1 — What happened in this call (diagnosis)
 *   Part 2 — What to do next (action: counter-offer email + checklist)
 *   Part 3 — What it's worth in rupees (cohort + NPV math)
 *   Part 4 — Your pattern across sessions (archetype + drills)
 *
 * Design principles preserved across the split:
 *
 *   • Plain English. No jargon (BATNA, anchor delta, NPV, p18) unaided.
 *   • Honest about empty states. Each panel renders only when its
 *     slice of data is present; nothing fabricated.
 *   • Mobile-first reflow via `nfr-*` classes in styles.ts.
 *   • Production tokens from `./tokens`. */

import type { Question } from "./types";
import { t, f, shadows, radius, space } from "./tokens";
import { computeNpvRows, type NegotiationOutcome } from "./derivations";

import { HeaderChip } from "./panels/_primitives";
import { StartHereHint, ANCHOR_PART_2, ANCHOR_PART_3, ANCHOR_PART_4 } from "./panels/StartHereHint";
import { SectionBand } from "./panels/_primitives";
import { TLDRHero } from "./panels/TLDRHero";
import { OfferTrajectory } from "./panels/OfferTrajectory";
import { InHandMonthlyCard } from "./panels/InHandMonthlyCard";
import { PhaseLadderPanel } from "./panels/PhaseLadderPanel";
import { ConcessionAnalysisPanel } from "./panels/ConcessionAnalysisPanel";
import { AnchorBracketPanel } from "./panels/AnchorBracketPanel";
import { VerbalHabitsPanel } from "./panels/VerbalHabitsPanel";
import { SilenceMapPanel } from "./panels/SilenceMapPanel";
import { UnaskedLeversPanel } from "./panels/UnaskedLeversPanel";
import { CounterOfferLetterPanel } from "./panels/CounterOfferLetterPanel";
import { CohortPlacementPanel } from "./panels/CohortPlacementPanel";
import { NPVMathPanel } from "./panels/NPVMathPanel";
import { CounterpartyPanel } from "./panels/CounterpartyPanel";
import { ArchetypePanel } from "./panels/ArchetypePanel";
import { DrillPlanPanel } from "./panels/DrillPlanPanel";
import { NextRoundCTA } from "./panels/NextRoundCTA";

interface Props {
  outcome: NegotiationOutcome;
  role: string;
  company: string;
  questions: Question[];
  daysUntilInterview?: number;
  priorSessionCount?: number;
  onLaunchDrill?: (slug: string) => void;
  salaryMeta?: {
    tierBucket?: string;
    tierBucketLabel?: string;
    closingTotalLpa?: number | null;
    monthlyTakeHomeNewRegimeInr?: number | null;
    monthlyTakeHomeOldRegimeInr?: number | null;
    annualTaxNewRegimeLpa?: number | null;
    annualTaxOldRegimeLpa?: number | null;
    recruiterPersona?: string;
    recruiterPersonaLabel?: string;
  };
}

export function NegotiationFullReport({
  outcome, role, company, questions, daysUntilInterview, priorSessionCount, onLaunchDrill, salaryMeta,
}: Props) {
  const offers = outcome.offers ?? [];
  const finalTotal = outcome.finalTotal ?? offers[offers.length - 1]?.total ?? null;

  return (
    <section
      aria-labelledby="ir-section-negotiation"
      style={{
        background: t.white, border: `1px solid ${t.line}`, borderRadius: radius.shell,
        padding: "28px clamp(16px, 4vw, 32px)", boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <div style={{ marginBottom: space.panel }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <HeaderChip variant="accent">Salary Negotiation · Full Report</HeaderChip>
          {salaryMeta?.tierBucketLabel && (
            <HeaderChip title="Compensation band the analyzer scored you against (Phase 1 of SCORE_IMPROVEMENT_PLAN).">
              Tier · {salaryMeta.tierBucketLabel}
            </HeaderChip>
          )}
          {salaryMeta?.recruiterPersonaLabel && salaryMeta.recruiterPersona !== "default" && (
            <HeaderChip title="Indian recruiter sector archetype the analyzer scored against (Phase 3 of SCORE_IMPROVEMENT_PLAN).">
              {salaryMeta.recruiterPersonaLabel}
            </HeaderChip>
          )}
        </div>
        <h2
          id="ir-section-negotiation"
          style={{ fontFamily: f.serif, fontSize: 26, margin: "10px 0 6px", color: t.coal, letterSpacing: -0.4 }}
        >
          The full breakdown of your negotiation
        </h2>
        <div style={{ fontSize: 13, color: t.inkSoft, marginBottom: space.block, maxWidth: 720 }}>
          Each panel below turns one negotiation skill into something you can act on, not a score.
        </div>
        <StartHereHint outcome={outcome} daysUntilInterview={daysUntilInterview} />
      </div>

      <TLDRHero outcome={outcome} role={role} company={company} />

      {/* PART 1 — DIAGNOSIS · indigo (analytical / cool tone) */}
      <SectionBand
        label="Part 1 of 4"
        title="What happened in this call"
        subtitle="Every moment that mattered: what you said, what you missed, what it cost."
        accent={t.indigo}
        bg={t.indigo100}
      />

      {offers.length > 0 && <OfferTrajectory outcome={outcome} />}

      {/* Phase 1.1 — in-hand monthly under both tax regimes for the
          closing offer. Silent unless the analyzer extracted a closing
          offer + computed take-home. */}
      {salaryMeta?.closingTotalLpa != null
        && (salaryMeta.monthlyTakeHomeNewRegimeInr != null
            || salaryMeta.monthlyTakeHomeOldRegimeInr != null)
        && (
        <InHandMonthlyCard salaryMeta={salaryMeta} />
      )}

      <div className="nfr-vstack-xl">
        <PhaseLadderPanel outcome={outcome} />
        <div className="nfr-grid-2up">
          <ConcessionAnalysisPanel outcome={outcome} />
          <AnchorBracketPanel outcome={outcome} />
        </div>
        {(outcome.verbalHabits || outcome.silenceMoments) && (
          <div className="nfr-grid-2up">
            <VerbalHabitsPanel outcome={outcome} />
            <SilenceMapPanel outcome={outcome} />
          </div>
        )}
      </div>

      {/* PART 2 — ACTION */}
      <SectionBand
        anchorId={ANCHOR_PART_2}
        label="Part 2 of 4"
        title="What to do before your real round"
        subtitle="A draft email you can send, the questions to ask next time, and the things to prepare."
        accent={t.copper}
        bg={t.copperTint}
      />
      <div className="nfr-vstack-xl">
        <UnaskedLeversPanel outcome={outcome} />
        <CounterOfferLetterPanel outcome={outcome} role={role} company={company} />
      </div>

      {/* PART 3 — COHORT & MATH. Render the band ONLY when at least
          one child panel will render — prevents an empty band. */}
      {(() => {
        const willRenderCohort = typeof outcome.percentileWithinBand === "number";
        const willRenderNpv = computeNpvRows(outcome).length > 0;
        const willRenderCounterparty = !!(outcome.counterpartyFacts && outcome.counterpartyFacts.length > 0);
        const showPart3 = willRenderCohort || willRenderNpv || willRenderCounterparty;
        if (!showPart3) return null;
        return (
          <>
            <SectionBand
              anchorId={ANCHOR_PART_3}
              label="Part 3 of 4"
              title="What this offer is worth in rupees"
              subtitle="Where your offer sits vs others, and what accepting really costs after tax."
              accent={t.warning}
              bg={t.warning100}
            />
            <div className="nfr-vstack-xl">
              {willRenderCohort && <CohortPlacementPanel outcome={outcome} />}
              {(willRenderNpv || willRenderCounterparty) && (
                <div className="nfr-grid-2up">
                  {willRenderNpv && <NPVMathPanel outcome={outcome} />}
                  {willRenderCounterparty && <CounterpartyPanel outcome={outcome} />}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* PART 4 — SKILL ARC. Empty state only renders for users with
          ≥1 prior session; first-session users get the band hidden. */}
      {(() => {
        const willRenderArchetype = !!outcome.archetype || ((priorSessionCount ?? 0) >= 1 && (priorSessionCount ?? 0) < 2);
        const willRenderDrills = !!(outcome.drills && outcome.drills.length > 0);
        const showPart4 = willRenderArchetype || willRenderDrills;
        if (!showPart4) return null;
        return (
          <>
            <SectionBand
              anchorId={ANCHOR_PART_4}
              label="Part 4 of 4"
              title="Your pattern across sessions"
              subtitle="What you keep doing right (and wrong), and the drills to break the pattern."
              accent={t.indigoDeep}
              bg={t.indigo100}
            />
            <div className="nfr-vstack-xl">
              {willRenderArchetype && <ArchetypePanel outcome={outcome} priorSessionCount={priorSessionCount} />}
              {willRenderDrills && <DrillPlanPanel outcome={outcome} onLaunchDrill={onLaunchDrill} />}
            </div>
          </>
        );
      })()}

      {/* Transcript export — preserved from legacy section */}
      <details style={{ marginTop: 28 }}>
        <summary style={{ cursor: "pointer", fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>
          Conversation transcript: copy for your records
        </summary>
        <pre
          style={{
            marginTop: 10, padding: 14, borderRadius: radius.xl,
            background: t.cream, border: `1px solid ${t.line}`,
            fontFamily: f.mono, fontSize: 11, lineHeight: 1.55,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            color: t.coal, overflow: "auto", maxWidth: "100%", maxHeight: 360,
          }}
        >
          {(() => {
            const lines: string[] = [
              `Salary negotiation: ${role} at ${company}`,
              `Outcome: ${
                outcome.outcome === "accepted" ? `Accepted at ₹${finalTotal} LPA` :
                outcome.outcome === "walked_away" ? "Walked away" :
                "No agreement"
              }`,
              "",
            ];
            questions.forEach((q, i) => {
              lines.push(`— Turn ${i + 1} —`);
              if (q.text) lines.push(`AI: ${q.text}`);
              const answerText = (q.answer || []).map(s => s.text).join(" ").trim();
              if (answerText) lines.push(`You: ${answerText}`);
              lines.push("");
            });
            return lines.join("\n");
          })()}
        </pre>
      </details>

      {/* Bottom CTA — literal last element on the page. */}
      <NextRoundCTA outcome={outcome} role={role} company={company} />
    </section>
  );
}
