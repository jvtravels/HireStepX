/* HireStepX — Session Report (production view)
   Best-in-class post-session results screen. Ported from the
   `interview-result` Tempo canvas. Goal: deliver feedback that feels
   coach-grade, not LLM-generic, and that justifies the price.

   This is the presentation layer. It is pure — props in, JSX out.
   The adapter at `./adapter.ts` translates the production SessionReport
   schema into the InterviewResultData view-model this component
   consumes. Production-only wiring (loading, error, abort, share,
   analytics) lives at `./SessionReport.tsx` (the entry).

   This file is the orchestrator only. Every section is its own file
   under `./panels/sr-*.tsx`. The split mirrors the pattern already
   applied to NegotiationFullReport. */

"use client";

import { useState } from "react";

import { t } from "./tokens";
import { SESSION_REPORT_STYLES } from "./styles";
import { NegotiationFullReport } from "./NegotiationFullReport";
import BehavioralFullReport from "./BehavioralFullReport";
import HrFullReport from "./HrFullReport";
import type { BehavioralFullReportData } from "./types";
import type { CredibilitySummary } from "../_credibilityCallout";
import type {
  AnswerSpan,
  BiasFinding,
  BlindSpot,
  Calibration,
  CrossSessionInsight,
  DeliveryMetric,
  FocusBannerData,
  HighlightKind,
  HrReportData,
  InterviewResultData,
  Question,
  Skill,
  StoryReuseFinding,
  ThoughtBubbleSegment,
  Verdict,
} from "./types";

import StatusTabs from "../components/StatusTabs";
import { ReportFrame, ReportBody } from "./panels/sr-ReportFrame";
import { HeroSection } from "./panels/sr-HeroSection";
import { TrendStrip } from "./panels/sr-TrendStrip";
import { KernelNegotiationQualitySection } from "./panels/sr-KernelNegotiationQualitySection";
import { CoreMetricsSection } from "./panels/sr-CoreMetricsSection";
import { SkillsSection } from "./panels/sr-SkillsSection";
import { PerQuestionSection } from "./panels/sr-PerQuestionSection";
import { CoachNotesSection } from "./panels/sr-CoachNotesSection";
import { BiasSection } from "./panels/sr-BiasSection";
import { ReverseInterviewSection } from "./panels/sr-ReverseInterviewSection";
import { NextStepsSection } from "./panels/sr-NextStepsSection";
import { FooterSection } from "./panels/sr-FooterSection";
import { ReferralInviteSection } from "./panels/sr-ReferralInviteSection";
import { TestimonialNudge } from "./panels/sr-TestimonialNudge";
import { ProductRating } from "./panels/sr-ProductRating";
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
  FocusBannerData,
  HighlightKind,
  HrReportData,
  InterviewResultData,
  Question,
  Skill,
  StoryReuseFinding,
  ThoughtBubbleSegment,
  Verdict,
};

/* ─── Focus banner ─────────────────────────────────────────────────── */

const TONE_VALUE_COLOR: Record<FocusBannerData["headlineMetric"]["tone"], string> = {
  good: t.success,
  watch: t.warning,
  miss: t.error,
  neutral: t.coal,
};

function FocusBannerStrip({ banner, daysUntilInterview }: { banner: FocusBannerData; daysUntilInterview?: number }) {
  const valueColor = TONE_VALUE_COLOR[banner.headlineMetric.tone] ?? t.coal;
  return (
    <div
      aria-label={`${banner.label} focus`}
      style={{
        background: t.creamSoft,
        border: `1px solid ${t.line}`,
        borderRadius: 12,
        padding: "14px 18px",
        marginBottom: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.coal }}>{banner.label}</div>
        <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.4, marginTop: 2 }}>{banner.tagline}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, flexShrink: 0 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: t.inkSoft }}>{banner.headlineMetric.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: valueColor, letterSpacing: "-0.01em" }}>
            {banner.headlineMetric.value}
          </div>
          {banner.headlineMetric.caption && (
            <div style={{ fontSize: 12, color: t.inkSoft, marginTop: 2, maxWidth: 240 }}>
              {banner.headlineMetric.caption}
            </div>
          )}
        </div>
        {typeof daysUntilInterview === "number" && daysUntilInterview > 0 && (
          <div style={{ borderLeft: `1px solid ${t.line}`, paddingLeft: 20, textAlign: "right" }}>
            <div style={{ fontSize: 12, color: t.inkSoft }}>Interview in</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: t.coal }}>
              {daysUntilInterview} {daysUntilInterview === 1 ? "day" : "days"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────── */


export interface SessionReportViewProps {
  data: InterviewResultData;
  /** Session id — wired to ProductRating so the 1-5 star widget can POST
   *  /api/product-rating. Optional so the storybook/canvas path renders
   *  without needing a real session. */
  sessionId?: string;
  /** Back navigation handler — wired by `dashboardComponents.tsx` to
   *  return to the dashboard. Optional so the canvas/storybook usage
   *  still works without a navigation stack. */
  onBack?: () => void;
  /** Label for the back button. Defaults to "Back to Dashboard" inside
   *  Header — overridden to "Back to Sessions" when the user arrived
   *  from /sessions so the affordance matches where they came from. */
  backLabel?: string;
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
    bondProbeCount?: number;
    aptitudeProbeExpectedType?: string;
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
  /** Setup link prefilled with this session's type, role and company. */
  practiceHref?: string;
  /** Behavioral v2 report payload. When provided AND the env flag
   *  `NEXT_PUBLIC_BEHAVIORAL_REPORT_V2 === "true"` is set, the view
   *  short-circuits the existing panel stack and renders the new
   *  diagnostic-first BehavioralFullReport instead. Default (unset)
   *  falls through to the existing behavior — safe rollback = unset
   *  the env var. */
  behavioralFullReportData?: BehavioralFullReportData;
  /** HR-round structured extraction — when present, the view renders the
   *  dedicated HrFullReport (dimension gate + motivation rewrite + logistics
   *  + drill CTA) instead of the generic panel stack. Populated by the
   *  adapter for sessions where focus is "hr-round". */
  hrReportData?: HrReportData;
}

type ReportTab = "overview" | "negotiation" | "answers" | "skills" | "coach";

function reportSubtitle(data: InterviewResultData): string {
  const role = (data.role ?? "").trim();
  const level = (data.level ?? "").trim();
  const levelInRole = level !== "" && role.toLowerCase().includes(level.toLowerCase());
  const parts = [role, (data.company ?? "").trim(), level && !levelInRole ? `${level} level` : ""].filter(Boolean);
  return parts.join(" · ");
}

export default function SessionReportView(props: SessionReportViewProps) {
  const { data, sessionId, onTrustAnswer, onUsefulAnswer, behavioralFullReportData, hrReportData } = props;
  // Behavioral v2 dispatch: env-gated, opt-in. Default (env unset) falls through unchanged.
  const behavioralV2Enabled =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_BEHAVIORAL_REPORT_V2 === "true";
  if (behavioralV2Enabled && behavioralFullReportData) {
    return <BehavioralFullReport data={behavioralFullReportData} />;
  }
  // HR-round dispatch: the FocusBannerStrip is embedded inside HrFullReport's
  // ReconcileStrip so it is not rendered twice.
  if (hrReportData || data.hrReport) {
    const hr = hrReportData ?? data.hrReport;
    return (
      <>
        <style>{SESSION_REPORT_STYLES}</style>
        <ReportFrame subtitle={reportSubtitle(data)}>
          <ReportBody>
            <section
              id="ir-main"
              aria-label="HR Round report"
              className="ir-main-container"
              style={{ width: "100%", display: "flex", flexDirection: "column", gap: 16 }}
            >
              <HrFullReport
                overallScore={data.overallScore}
                skills={data.skills}
                wins={data.strengths}
                questions={data.questions}
                hrReport={hr}
                daysUntilInterview={data.daysUntilInterview}
                role={data.role}
                company={data.company}
              />
              <ReferralInviteSection score={data.overallScore} />
              <ProductRating sessionId={sessionId ?? ""} />
              <TestimonialNudge score={data.overallScore} priorSessionCount={data.priorSessionCount} role={data.role} />
              <FooterSection onTrustAnswer={onTrustAnswer} onUsefulAnswer={onUsefulAnswer} />
            </section>
          </ReportBody>
        </ReportFrame>
      </>
    );
  }
  return <GenericReport {...props} />;
}

function GenericReport({
  data,
  credibility,
  onDisputeCredibility,
  campusPlacementMeta,
  salaryNegotiationMeta,
  offerNetValue,
  progressTrends,
  practiceHref,
}: SessionReportViewProps) {
  const [tab, setTab] = useState<ReportTab>("overview");
  /* L-2 (2026-07-10, live staging, negotiation report cc0a7469): the behavioural
   * cross-session insights ("quantify results ... still missing in 4/5 answers")
   * are meaningless on a salary negotiation report. `data.negotiationOutcome` is
   * the definitive signal, and this is the single point where the panels are
   * chosen, so suppress the stream here. (blindSpots stay: the adapter already
   * filters those to negotiation competencies per R-8.) */
  const behaviouralCrossSessionInsights = data.negotiationOutcome
    ? undefined
    : data.crossSessionInsights;

  const tabs: { key: ReportTab; label: string; count?: number }[] = [
    { key: "overview", label: "Overview" },
    ...(data.negotiationOutcome ? [{ key: "negotiation" as const, label: "Negotiation" }] : []),
    { key: "answers", label: "Answers", count: data.questions.length || undefined },
    { key: "skills", label: "Skills" },
    { key: "coach", label: "Coach" },
  ];

  return (
    <>
      <style>{SESSION_REPORT_STYLES}</style>
      <ReportFrame
        subtitle={reportSubtitle(data)}
        tabs={<StatusTabs tabs={tabs} value={tab} onChange={setTab} label="Report sections" idPrefix="ir" panelId="ir-tabpanel" listClassName="group-data-horizontal/tabs:h-12" />}
      >
        <a href="#ir-main" className="ir-skip-link">
          Skip to report
        </a>
        <ReportBody id="ir-tabpanel" labelledBy={`ir-tab-${tab}`}>
          {/* section, not main: the app shell's SidebarInset already provides the page's one main landmark. */}
          <section key={tab} id="ir-main" aria-label="Interview report" className="ir-main-container ir-tab-panel ir-panel-in" style={{ width: "100%" }}>
            {tab === "overview" && (
              <>
                {data.focusBanner && <FocusBannerStrip banner={data.focusBanner} daysUntilInterview={data.daysUntilInterview} />}
                <HeroSection data={data} />
                {credibility && credibility.hasIssues && (
                  <CredibilitySection summary={credibility} onDispute={onDisputeCredibility} />
                )}
                {campusPlacementMeta && <CampusCgpaCalibrationNote meta={campusPlacementMeta} />}
                <NextStepsSection
                  plan={data.readinessPlan}
                  practiceHref={practiceHref}
                  resumeImprovements={data.resumeImprovements}
                />
              </>
            )}
            {tab === "negotiation" && data.negotiationOutcome && (
              <>
                <NegotiationFullReport
                  outcome={data.negotiationOutcome}
                  role={data.role}
                  company={data.company}
                  questions={data.questions}
                  daysUntilInterview={data.daysUntilInterview}
                  priorSessionCount={data.priorSessionCount}
                  guardrailFlagSummary={data.kernelMetrics?.guardrailFlagSummary}
                  salaryMeta={salaryNegotiationMeta}
                />
                {offerNetValue && <OfferEconomicsPanel offer={offerNetValue} />}
                {data.kernelMetrics && <KernelNegotiationQualitySection m={data.kernelMetrics} />}
              </>
            )}
            {tab === "answers" && (
              <PerQuestionSection questions={data.questions} />
            )}
            {tab === "skills" && (
              <>
                <SkillsSection skills={data.skills} weakest={data.weakestSkill} />
                {progressTrends && <ProgressTrendPanel trends={progressTrends} />}
                <CoreMetricsSection metrics={data.metrics} />
                {!data.negotiationOutcome && offerNetValue && <OfferEconomicsPanel offer={offerNetValue} />}
                {!data.negotiationOutcome && data.kernelMetrics && (
                  <KernelNegotiationQualitySection m={data.kernelMetrics} />
                )}
              </>
            )}
            {tab === "coach" && (
              <>
                {data.priorSessionCount !== undefined && data.priorSessionCount >= 3 && behaviouralCrossSessionInsights && (
                  <TrendStrip
                    priorSessionCount={data.priorSessionCount}
                    insights={behaviouralCrossSessionInsights}
                  />
                )}
                <CoachNotesSection
                  insights={behaviouralCrossSessionInsights}
                  storyReuse={data.negotiationOutcome ? undefined : data.storyReuseFindings}
                  blindSpots={data.blindSpots}
                  coaching={data.coaching}
                />
                {data.biasFindings && data.biasFindings.length > 0 && <BiasSection findings={data.biasFindings} />}
                {data.reverseInterview && <ReverseInterviewSection reverse={data.reverseInterview} />}
                <TestimonialNudge score={data.overallScore} priorSessionCount={data.priorSessionCount} role={data.role} />
              </>
            )}
          </section>
        </ReportBody>
      </ReportFrame>
    </>
  );
}
