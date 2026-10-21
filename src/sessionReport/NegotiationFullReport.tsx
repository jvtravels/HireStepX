/* HireStepX — Full Salary Negotiation Report (production)
 *
 * Top-level composition only. Each panel lives in its own file under
 * `./panels/`. Shared chrome lives in `./panels/_primitives.tsx`.
 *
 * Order follows the decision the candidate has to make, not the order the
 * analyzer ran in: verdict, then what to do next, then the diagnosis behind
 * it, then what it was worth, then the pattern across sessions. Groups are
 * unnumbered and a group with nothing to show renders nothing, so the page
 * never promises a section it can't fill. Panels inherit the flat employer
 * treatment through `.nfr-flat` + FlatReportContext.
 *
 * Design principles:
 *   • Plain English. No jargon (BATNA, anchor delta, NPV, p18) unaided.
 *   • Honest about empty states. Nothing fabricated.
 *   • Mobile-first reflow via `nfr-*` classes in styles.ts. */

import { useState, type CSSProperties, type ReactNode } from "react";
import type { Question } from "./types";
import { computeNpvRows, type NegotiationOutcome } from "./derivations";

import { HeaderChip } from "./panels/_primitives";
import { StartHereHint, ANCHOR_ACTION, ANCHOR_WORTH, ANCHOR_PATTERN } from "./panels/StartHereHint";
import { TLDRHero } from "./panels/TLDRHero";
import { atCompany } from "./roleLabel";
import { OfferTrajectory } from "./panels/OfferTrajectory";
import { InHandMonthlyCard } from "./panels/InHandMonthlyCard";
import { PhaseLadderPanel } from "./panels/PhaseLadderPanel";
import { ConcessionAnalysisPanel } from "./panels/ConcessionAnalysisPanel";
import { AnchorBracketPanel } from "./panels/AnchorBracketPanel";
import { VerbalHabitsPanel } from "./panels/VerbalHabitsPanel";
import { CoachingSignalsPanel } from "./panels/CoachingSignalsPanel";
import { SilenceMapPanel } from "./panels/SilenceMapPanel";
import { UnaskedLeversPanel } from "./panels/UnaskedLeversPanel";
import { CounterOfferLetterPanel } from "./panels/CounterOfferLetterPanel";
import { NPVMathPanel } from "./panels/NPVMathPanel";
import { CounterpartyPanel } from "./panels/CounterpartyPanel";
import { ArchetypePanel } from "./panels/ArchetypePanel";
import { DrillPlanPanel } from "./panels/DrillPlanPanel";
import { NextRoundCTA } from "./panels/NextRoundCTA";

const ANCHOR_DIAGNOSIS = "nfr-diagnosis";

function Group({ id, label, sub, index, children }: {
  id: string; label: string; sub: string; index: number; children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-label`}
      className="nfr-group nfr-rise"
      style={{ "--i": index } as CSSProperties}
    >
      <h3 id={`${id}-label`} className="nfr-group-label">{label}</h3>
      <p className="nfr-group-sub">{sub}</p>
      {children}
    </section>
  );
}

function Chevron() {
  return (
    <svg className="nfr-disclosure-chev" width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TranscriptDisclosure({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <details className="nfr-disclosure nfr-rise mt-8 border-t border-hx-line" style={{ "--i": 6 } as CSSProperties}>
      <summary>
        <Chevron />
        Conversation transcript
        <span className="ml-1 text-[13px] font-normal text-hx-ink-soft">copy for your records</span>
      </summary>
      <div className="pb-2">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={copy}
            aria-live="polite"
            className="rounded-md border border-hx-line px-2.5 py-1 text-[12px] font-medium text-hx-coal transition-colors duration-150 hover:border-hx-indigo hover:text-hx-indigo focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hx-indigo"
          >
            {copied ? "Copied" : "Copy transcript"}
          </button>
        </div>
        <pre className="m-0 max-h-[360px] max-w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-hx-soft p-4 font-mono text-[12px] leading-relaxed text-hx-coal">
          {text}
        </pre>
      </div>
    </details>
  );
}

function buildTranscript(outcome: NegotiationOutcome, role: string, company: string, questions: Question[], finalTotal: number | null): string {
  const lines: string[] = [
    `Salary negotiation: ${role}${atCompany(company)}`,
    `Outcome: ${
      outcome.outcome === "accepted" ? `Accepted at ₹${typeof finalTotal === "number" ? parseFloat(finalTotal.toFixed(1)) : finalTotal} LPA` :
      outcome.outcome === "walked_away" ? "Walked away" :
      "No agreement"
    }`,
    "",
  ];
  questions.forEach((q, i) => {
    lines.push(`— Turn ${i + 1} —`);
    if (q.text) lines.push(`AI: ${q.text}`);
    const answerText = (q.answer || []).map(seg => seg.text).join(" ").trim();
    if (answerText) lines.push(`You: ${answerText}`);
    lines.push("");
  });
  return lines.join("\n");
}

interface Props {
  outcome: NegotiationOutcome;
  role: string;
  company: string;
  questions: Question[];
  daysUntilInterview?: number;
  priorSessionCount?: number;
  onLaunchDrill?: (slug: string) => void;
  /** Setup link prefilled with this session's type, role and company. */
  practiceHref?: string;
  /** M2 PR-6 — family-level guardrail flag counts (e.g.
   *  { "pressure-repeat": 2, "stall-cascade": 1 }). Optional: when
   *  absent or empty, the CoachingSignalsPanel renders nothing. */
  guardrailFlagSummary?: Record<string, number>;
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
  outcome, role, company, questions, daysUntilInterview, priorSessionCount, onLaunchDrill, practiceHref, guardrailFlagSummary, salaryMeta,
}: Props) {
  const offers = outcome.offers ?? [];
  const finalTotal = outcome.finalTotal ?? offers[offers.length - 1]?.total ?? null;

  const hasInHand = salaryMeta?.closingTotalLpa != null
    && (salaryMeta.monthlyTakeHomeNewRegimeInr != null || salaryMeta.monthlyTakeHomeOldRegimeInr != null);
  const willRenderNpv = computeNpvRows(outcome).length > 0;
  const willRenderCounterparty = !!(outcome.counterpartyFacts && outcome.counterpartyFacts.length > 0);
  const showWorth = hasInHand || willRenderNpv || willRenderCounterparty;
  const willRenderArchetype = !!outcome.archetype || ((priorSessionCount ?? 0) >= 1 && (priorSessionCount ?? 0) < 2);
  const willRenderDrills = !!(outcome.drills && outcome.drills.length > 0);
  const showPattern = willRenderArchetype || willRenderDrills;

  let groupIndex = 0;

  return (
    <section aria-labelledby="ir-section-negotiation" className="ir-flat-section scroll-mt-[72px] border-t border-hx-line py-7">
      <header className="nfr-rise" style={{ "--i": 0 } as CSSProperties}>
        <div className="flex flex-wrap gap-2">
          <HeaderChip variant="accent">Salary negotiation</HeaderChip>
          {salaryMeta?.tierBucketLabel && (
            <HeaderChip title="Compensation band the analyzer scored you against.">
              Tier · {salaryMeta.tierBucketLabel}
            </HeaderChip>
          )}
          {salaryMeta?.recruiterPersonaLabel && salaryMeta.recruiterPersona !== "default" && (
            <HeaderChip title="Indian recruiter sector archetype the analyzer scored against.">
              {salaryMeta.recruiterPersonaLabel}
            </HeaderChip>
          )}
        </div>
        <h2 id="ir-section-negotiation" className="m-0 mt-3 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-hx-coal">
          Your negotiation, move by move
        </h2>
        <p className="m-0 mb-5 mt-1.5 max-w-[65ch] text-[13px] leading-normal text-hx-ink-soft">
          Each section turns one negotiation skill into something you can act on, not just a score.
        </p>
        <StartHereHint outcome={outcome} daysUntilInterview={daysUntilInterview} />
      </header>

      <div className="nfr-rise" style={{ "--i": 1 } as CSSProperties}>
        <TLDRHero outcome={outcome} role={role} company={company} priorSessionCount={priorSessionCount} />
      </div>

      <Group
        id={ANCHOR_ACTION}
        index={++groupIndex + 1}
        label="What to do next"
        sub="A draft email you can send, the questions to ask next time, and the things to prepare."
      >
        <div className="nfr-vstack-xl">
          <UnaskedLeversPanel outcome={outcome} />
          <CounterOfferLetterPanel outcome={outcome} role={role} company={company} />
        </div>
      </Group>

      <Group
        id={ANCHOR_DIAGNOSIS}
        index={++groupIndex + 1}
        label="What happened"
        sub="Every moment that mattered: what you said, what you missed, what it cost."
      >
        <div className="nfr-vstack-xl">
          {offers.length > 0 && <OfferTrajectory outcome={outcome} />}
          <PhaseLadderPanel outcome={outcome} />
          <div className="nfr-grid-2up">
            <ConcessionAnalysisPanel outcome={outcome} />
            <AnchorBracketPanel outcome={outcome} />
          </div>
          <CoachingSignalsPanel flagSummary={guardrailFlagSummary} />
          {(outcome.verbalHabits || outcome.silenceMoments) && (
            <div className="nfr-grid-2up">
              <VerbalHabitsPanel outcome={outcome} />
              <SilenceMapPanel outcome={outcome} />
            </div>
          )}
        </div>
      </Group>

      {showWorth && (
        <Group
          id={ANCHOR_WORTH}
          index={++groupIndex + 1}
          label="What it's worth"
          sub="What accepting really costs after tax, and who you were negotiating against."
        >
          <div className="nfr-vstack-xl">
            {hasInHand && salaryMeta && <InHandMonthlyCard salaryMeta={salaryMeta} />}
            {(willRenderNpv || willRenderCounterparty) && (
              <div className="nfr-grid-2up">
                {willRenderNpv && <NPVMathPanel outcome={outcome} />}
                {willRenderCounterparty && <CounterpartyPanel outcome={outcome} />}
              </div>
            )}
          </div>
        </Group>
      )}

      {showPattern && (
        <Group
          id={ANCHOR_PATTERN}
          index={++groupIndex + 1}
          label="Your pattern"
          sub="What you keep doing right (and wrong), and the drills to break the pattern."
        >
          <div className="nfr-vstack-xl">
            {willRenderArchetype && <ArchetypePanel outcome={outcome} priorSessionCount={priorSessionCount} />}
            {willRenderDrills && <DrillPlanPanel outcome={outcome} onLaunchDrill={onLaunchDrill} />}
          </div>
        </Group>
      )}

      <TranscriptDisclosure text={buildTranscript(outcome, role, company, questions, finalTotal)} />

      <NextRoundCTA outcome={outcome} role={role} company={company} practiceHref={practiceHref} />
    </section>
  );
}
