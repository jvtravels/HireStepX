/* HireStepX — Session Report (production view)
   Best-in-class post-session results screen. Ported from the
   `interview-result` Tempo canvas. Goal: deliver feedback that feels
   coach-grade, not LLM-generic, and that justifies the price.

   This is the presentation layer. It is pure — props in, JSX out.
   The adapter at `./adapter.ts` translates the production SessionReport
   schema into the InterviewResultData view-model this component
   consumes. Production-only wiring (loading, error, abort, share,
   PDF, analytics) lives at `./SessionReport.tsx` (the entry).

   This file is the orchestrator only. Every section is its own file
   under `./panels/sr-*.tsx`. The split mirrors the pattern already
   applied to NegotiationFullReport. */

"use client";

import { t, f } from "./tokens";
import { SESSION_REPORT_STYLES } from "./styles";
import { NegotiationFullReport } from "./NegotiationFullReport";
import type { CredibilitySummary } from "../_credibilityCallout";
import type {
  AnswerSpan,
  BiasFinding,
  BlindSpot,
  Calibration,
  CrossSessionInsight,
  DeliveryMetric,
  HighlightKind,
  InterviewResultData,
  Question,
  Skill,
  StoryReuseFinding,
  ThoughtBubbleSegment,
  Verdict,
} from "./types";

import { Header } from "./panels/sr-Header";
import { JumpNav } from "./panels/sr-JumpNav";
import { HeroSection } from "./panels/sr-HeroSection";
import { TrendStrip } from "./panels/sr-TrendStrip";
import { TopScoreDriversSection } from "./panels/sr-TopScoreDriversSection";
import { KernelNegotiationQualitySection } from "./panels/sr-KernelNegotiationQualitySection";
import { CoreMetricsSection } from "./panels/sr-CoreMetricsSection";
import { SkillsSection } from "./panels/sr-SkillsSection";
import { ThoughtBubbleSection } from "./panels/sr-ThoughtBubbleSection";
import { PerQuestionSection } from "./panels/sr-PerQuestionSection";
import { CoachNotesSection } from "./panels/sr-CoachNotesSection";
import { BiasSection } from "./panels/sr-BiasSection";
import { ReverseInterviewSection } from "./panels/sr-ReverseInterviewSection";
import { NextStepsSection } from "./panels/sr-NextStepsSection";
import { FooterSection } from "./panels/sr-FooterSection";
import { CampusCgpaCalibrationNote } from "./panels/sr-CampusCgpaCalibrationNote";
import { CredibilitySection } from "./panels/sr-CredibilitySection";
import { OfferEconomicsPanel } from "./panels/sr-OfferEconomicsPanel";
import { ProgressTrendPanel } from "./panels/sr-ProgressTrendPanel";
import type { SkillTrend } from "./progressTracking";
import type { OfferNetValueInput } from "./derivations/offerNetValue";

// Re-export types so call-sites importing from this entry stay happy.
export type {
  AnswerSpan,
  BiasFinding,
  BlindSpot,
  Calibration,
  CrossSessionInsight,
  DeliveryMetric,
  HighlightKind,
  InterviewResultData,
  Question,
  Skill,
  StoryReuseFinding,
  ThoughtBubbleSegment,
  Verdict,
};

/* ─── Main component ──────────────────────────────────────────────── */

export interface SessionReportViewProps {
  data: InterviewResultData;
  /** Back navigation handler — wired by `dashboardComponents.tsx` to
   *  return to the dashboard. Optional so the canvas/storybook usage
   *  still works without a navigation stack. */
  onBack?: () => void;
  /** PDF download handler — typically `() => window.print()`. */
  onDownloadPdf?: () => void;
  /** Share-link handler — POSTs to /api/share-report and copies the
   *  resulting URL to clipboard. */
  onShare?: () => void;
  /** "Try this question again" — invoked from the Next-Steps first
   *  card. Production routes to /session/new with the weakest question
   *  pre-loaded. */
  onTryQuestionAgain?: (questionIdx: number) => void;
  /** "Drill weakest skill" — invoked from the Next-Steps third card.
   *  Production routes to a focused 5-question drill. */
  onDrillSkill?: (skillName: string) => void;
  /** "Save top story to Notebook" — invoked from the Next-Steps middle
   *  card. Production calls saveStoryToNotebook on the highest-scoring
   *  question. */
  onSaveTopStory?: (questionIdx: number) => void;
  /** Trust + usefulness 2-question polls. Both fire to analytics. */
  onTrustAnswer?: (value: "yes" | "no") => void;
  onUsefulAnswer?: (value: "yes" | "no") => void;
  /** Resume cross-check summary from `session_insights`. When present
   *  AND `hasIssues` is true, the report renders a dedicated BGV-risk
   *  panel between Hero and the cross-session strip. Omitted (or
   *  `hasIssues: false`) renders nothing — happy path is silent. */
  credibility?: CredibilitySummary;
  /** "Report inaccuracy" handler on each credibility item — POSTs to
   *  /api/credibility-dispute and fires PostHog `credibility_flag_disputed`.
   *  Optional so the storybook / canvas path renders the panel without
   *  needing the network layer wired. */
  onDisputeCredibility?: (flag: string) => void;
  /** Campus-placement: tier-aware CGPA calibration. Surfaced inline
   *  so the candidate sees the actual cutoff they were graded
   *  against — e.g. "TCS NQT baseline 6.0 CGPA, tier-2 adjusted
   *  5.5 — you're at 6.4 ✓". Undefined when the session isn't
   *  campus-placement, the analyzer hasn't run, or the insight row
   *  predates the `meta` column. */
  campusPlacementMeta?: {
    companyTier: string;
    collegeTier: string;
    baseCgpaCutoff: number;
    adjustedCgpaCutoff: number;
    statedCgpa: number | null;
    targetCompany?: string | null;
    archetype?: string;
    archetypeLabel?: string;
  };
  /** Salary-negotiation: tier-aware compensation bucket the analyzer
   *  scored against + CTC take-home breakdown for the closing offer.
   *  When present, the NegotiationFullReport renders a tier-band chip
   *  in its header and an in-hand-monthly card under the offer
   *  trajectory. Undefined for non-salary sessions or pre-v5 rows. */
  salaryNegotiationMeta?: {
    tierBucket?: string;
    tierBucketLabel?: string;
    closingTotalLpa?: number | null;
    monthlyTakeHomeNewRegimeInr?: number | null;
    monthlyTakeHomeOldRegimeInr?: number | null;
    annualTaxNewRegimeLpa?: number | null;
    annualTaxOldRegimeLpa?: number | null;
    /* Phase 3 of Salary-Negotiation plan (2026-05-18) — Indian
       recruiter sector persona for the report header chip. */
    recruiterPersona?: string;
    recruiterPersonaLabel?: string;
  };
  /** Structured offer surface for the clawback-honest economics panel.
   *  When present, renders OfferEconomicsPanel alongside the existing
   *  NPV math (which only models base-delta, not joining-bonus risk).
   *  Optional — silent for sessions where the kernel didn't capture a
   *  joining-bonus / clawback-window pair. */
  offerNetValue?: OfferNetValueInput;
  /** Per-skill cross-session trend data, precomputed upstream from a
   *  ProgressStore. When present, the report renders ProgressTrendPanel
   *  immediately after CoreMetricsSection so the user sees whether
   *  they're improving on ESOPs, Anchoring, etc. Undefined / omitted
   *  silently skips the panel (e.g. first-session render before the
   *  store is wired). */
  progressTrends?: SkillTrend[];
}

export default function SessionReportView({
  data,
  onBack,
  onDownloadPdf,
  onShare,
  onTryQuestionAgain,
  onDrillSkill,
  onSaveTopStory,
  onTrustAnswer,
  onUsefulAnswer,
  credibility,
  onDisputeCredibility,
  campusPlacementMeta,
  salaryNegotiationMeta,
  offerNetValue,
  progressTrends,
}: SessionReportViewProps) {
  // Pick the highest-scoring question so the "Save top story" CTA
  // points at the right answer. Falls back to the first question.
  const topStoryIdx =
    data.questions.length > 0
      ? data.questions.reduce(
          (best, q) => (q.score > best.score ? q : best),
          data.questions[0]
        ).index
      : 1;
  return (
    <>
      <style>{SESSION_REPORT_STYLES}</style>
      <div
        style={{
          background: t.cream,
          minHeight: "100vh",
          fontFamily: f.sans,
          color: t.coal,
          paddingBottom: 48,
        }}
      >
        {/* Skip link — keyboard users tabbing into the page can jump
            directly past the header + jump-nav to the report content.
            Visually hidden until focused; standard a11y pattern. */}
        <a href="#ir-section-hero" className="ir-skip-link">
          Skip to report
        </a>
        <Header onBack={onBack} onDownloadPdf={onDownloadPdf} onShare={onShare} />
        <main
          id="ir-main"
          aria-label="Interview report"
          className="ir-main-container"
          style={{
            maxWidth: 1240,
            margin: "0 auto",
            padding: "0 clamp(14px, 4vw, 32px)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <JumpNav />
          <HeroSection data={data} />
          {credibility && credibility.hasIssues && (
            <CredibilitySection summary={credibility} onDispute={onDisputeCredibility} />
          )}
          {campusPlacementMeta && (
            <CampusCgpaCalibrationNote meta={campusPlacementMeta} />
          )}
          {data.negotiationOutcome && (
            <NegotiationFullReport
              outcome={data.negotiationOutcome}
              role={data.role}
              company={data.company}
              questions={data.questions}
              daysUntilInterview={data.daysUntilInterview}
              priorSessionCount={data.priorSessionCount}
              salaryMeta={salaryNegotiationMeta}
            />
          )}
          {offerNetValue && <OfferEconomicsPanel offer={offerNetValue} />}
          {data.kernelMetrics && (
            <KernelNegotiationQualitySection m={data.kernelMetrics} />
          )}
          {data.priorSessionCount !== undefined && data.priorSessionCount >= 3 && data.crossSessionInsights && (
            <TrendStrip
              priorSessionCount={data.priorSessionCount}
              insights={data.crossSessionInsights}
            />
          )}
          <TopScoreDriversSection questions={data.questions} />
          <CoreMetricsSection metrics={data.metrics} />
          {progressTrends && <ProgressTrendPanel trends={progressTrends} />}
          <SkillsSection skills={data.skills} weakest={data.weakestSkill} />
          {data.thoughtBubble && data.thoughtBubble.length > 0 && (
            <ThoughtBubbleSection segments={data.thoughtBubble} />
          )}
          <PerQuestionSection questions={data.questions} />
          <CoachNotesSection
            insights={data.crossSessionInsights}
            storyReuse={data.storyReuseFindings}
            blindSpots={data.blindSpots}
          />
          {data.biasFindings && data.biasFindings.length > 0 && (
            <BiasSection findings={data.biasFindings} />
          )}
          {data.reverseInterview && (
            <ReverseInterviewSection reverse={data.reverseInterview} />
          )}
          <NextStepsSection
            daysUntilInterview={data.daysUntilInterview}
            readinessSentence={data.readinessSentence}
            weakestSkill={data.weakestSkill?.name}
            onTryWeakestQuestion={
              onTryQuestionAgain
                ? () => onTryQuestionAgain(data.questions[0]?.index ?? 1)
                : undefined
            }
            onDrillSkill={
              onDrillSkill && data.weakestSkill
                ? () => onDrillSkill(data.weakestSkill.name)
                : undefined
            }
            onSaveTopStory={
              onSaveTopStory ? () => onSaveTopStory(topStoryIdx) : undefined
            }
          />
          <FooterSection
            onTrustAnswer={onTrustAnswer}
            onUsefulAnswer={onUsefulAnswer}
          />
        </main>
      </div>
    </>
  );
}
