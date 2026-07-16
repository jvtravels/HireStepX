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
import { ReferralInviteSection } from "./panels/sr-ReferralInviteSection";
import { TestimonialNudge } from "./panels/sr-TestimonialNudge";
import { ScoreCardDownloadButton } from "./panels/sr-ScoreCard";
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

/* ─── Free-user upgrade nudge ──────────────────────────────────────── */
/* Shown after the hero score on the report page — the highest-attention,
   highest-curiosity moment in the product. Better here than at the
   session-limit gate when the user is already frustrated and blocked. */

function UpgradeNudgeStrip({ score, onUpgrade }: { score: number; onUpgrade?: () => void }) {
  return (
    <div
      role="complementary"
      aria-label="Upgrade to keep practising"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        background: t.indigoTint,
        border: `1px solid ${t.indigoRing}`,
        borderRadius: 12,
        padding: "14px 20px",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal }}>
          You scored {score}. Want to see if you can beat it?
        </p>
        <p style={{ margin: "3px 0 0", fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.45 }}>
          Get 5 more sessions for ₹39 — track your improvement across a Sprint Pack.
        </p>
      </div>
      <button
        onClick={onUpgrade}
        style={{
          flexShrink: 0,
          fontFamily: f.sans,
          fontSize: 13,
          fontWeight: 600,
          padding: "9px 20px",
          borderRadius: 8,
          background: t.indigo ?? "#4f46e5",
          color: "#fff",
          border: 0,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Get Sprint Pack — ₹39
      </button>
    </div>
  );
}

/* ─── Focus banner ─────────────────────────────────────────────────── */

const TONE_VALUE_COLOR: Record<FocusBannerData["headlineMetric"]["tone"], string> = {
  good: t.success,
  watch: t.copper,
  miss: t.error,
  neutral: t.neutralInk,
};

function FocusBannerStrip({ banner, daysUntilInterview }: { banner: FocusBannerData; daysUntilInterview?: number }) {
  const valueColor = TONE_VALUE_COLOR[banner.headlineMetric.tone] ?? banner.accent;
  return (
    <div
      aria-label={`${banner.label} focus`}
      style={{
        background: banner.accentSoft,
        borderTop: `3px solid ${banner.accent}`,
        borderRadius: 12,
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0 }}>
        <div
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: banner.accent,
            color: t.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {banner.icon}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: banner.accent,
              marginBottom: 3,
            }}
          >
            {banner.label}
          </div>
          <div style={{ fontSize: 13, color: t.coal, fontWeight: 500, lineHeight: 1.4 }}>
            {banner.tagline}
          </div>
        </div>
      </div>

      {/* Right cluster: headline metric + optional days-to-interview countdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 24, flexShrink: 0 }}>
        {/* Headline metric — the single most important number for this focus */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: t.inkSoft,
              marginBottom: 2,
            }}
          >
            {banner.headlineMetric.label}
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: valueColor,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            }}
          >
            {banner.headlineMetric.value}
          </div>
          {banner.headlineMetric.caption && (
            <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 3, maxWidth: 240 }}>
              {banner.headlineMetric.caption}
            </div>
          )}
        </div>
        {/* Countdown — only when the user has set an interview date */}
        {typeof daysUntilInterview === "number" && daysUntilInterview > 0 && (
          <div
            style={{
              borderLeft: `1px solid ${t.lineStrong}`,
              paddingLeft: 24,
              textAlign: "right",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: t.inkSoft,
                marginBottom: 2,
              }}
            >
              Real round in
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: t.copper,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}
            >
              {daysUntilInterview}d
            </div>
            <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 3 }}>
              Practice before then
            </div>
          </div>
        )}
      </div>

      {/* Secondary metrics — if the evaluator produced more than the headline */}
      {banner.allMetrics.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            width: "100%",
            paddingTop: 10,
            borderTop: `1px solid ${banner.accent}22`,
          }}
        >
          {banner.allMetrics.slice(1).map((m) => {
            const mColor = TONE_VALUE_COLOR[m.tone] ?? t.neutralInk;
            return (
              <div
                key={m.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: t.neutralInk,
                }}
              >
                <span style={{ fontWeight: 700, color: t.inkSoft, textTransform: "uppercase", fontSize: 10, letterSpacing: 0.5 }}>
                  {m.label}
                </span>
                <span style={{ fontWeight: 700, color: mColor, fontFamily: "monospace" }}>
                  {m.value}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────── */

export interface SessionReportViewProps {
  data: InterviewResultData;
  /** Back navigation handler — wired by `dashboardComponents.tsx` to
   *  return to the dashboard. Optional so the canvas/storybook usage
   *  still works without a navigation stack. */
  onBack?: () => void;
  /** Label for the back button. Defaults to "Back to Dashboard" inside
   *  Header — overridden to "Back to Sessions" when the user arrived
   *  from /sessions so the affordance matches where they came from. */
  backLabel?: string;
  /** PDF download handler — typically `() => window.print()`. */
  onDownloadPdf?: () => void;
  /** Share-link handler — POSTs to /api/share-report and copies the
   *  resulting URL to clipboard. */
  onShare?: () => void;
  /** Public share URL for the report — when provided, used by the LinkedIn
   *  share button and passed to ReferralInviteSection so both surface the
   *  same URL. Populated by SessionReport.tsx after /api/share-report
   *  resolves; undefined until the user hits "Share Report". */
  shareUrl?: string;
  /** "Try this question again" — invoked from the Next-Steps first
   *  card. Production routes to /session/new with the weakest question
   *  pre-loaded. */
  onTryQuestionAgain?: (questionIdx: number) => void;
  /** "Drill weakest skill" — invoked from the Next-Steps third card.
   *  Production routes to a focused 5-question drill. */
  onDrillSkill?: (skillName: string) => void;
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
  /** When true, shows a post-session upgrade nudge after the hero score.
   *  The moment the score lands is the highest-attention, highest-curiosity
   *  point in the product — better to pitch here than at the session-limit
   *  gate when the user is already frustrated. */
  isFreeUser?: boolean;
  /** Called when the user clicks the upgrade CTA on the post-session nudge. */
  onUpgrade?: () => void;
}

export default function SessionReportView({
  data,
  onBack,
  backLabel,
  onDownloadPdf,
  onShare,
  shareUrl,
  onTryQuestionAgain,
  onDrillSkill,
  onTrustAnswer,
  onUsefulAnswer,
  credibility,
  onDisputeCredibility,
  campusPlacementMeta,
  salaryNegotiationMeta,
  offerNetValue,
  progressTrends,
  behavioralFullReportData,
  hrReportData,
  isFreeUser,
  onUpgrade,
}: SessionReportViewProps) {
  // Behavioral v2 dispatch — env-gated, opt-in. Renders the new
  // diagnostic-first report and skips the existing panel stack.
  // Default (env unset) falls through unchanged.
  const behavioralV2Enabled =
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_BEHAVIORAL_REPORT_V2 === "true";
  if (behavioralV2Enabled && behavioralFullReportData) {
    return <BehavioralFullReport data={behavioralFullReportData} />;
  }
  // HR-round dispatch — when `hrReportData` is present (adapter detected
  // hr-round focus), render the dedicated HrFullReport and skip the
  // generic panel stack. The FocusBannerStrip is embedded inside
  // HrFullReport's ReconcileStrip so we don't render it twice.
  if (hrReportData || data.hrReport) {
    const hr = hrReportData ?? data.hrReport;
    return (
      <>
        <style>{SESSION_REPORT_STYLES}</style>
        <div style={{ background: t.cream, minHeight: "100vh", fontFamily: f.sans, color: t.coal, paddingBottom: 48 }}>
          <Header onBack={onBack} backLabel={backLabel} onDownloadPdf={onDownloadPdf} onShare={onShare} />
          <main
            id="ir-main"
            aria-label="HR Round report"
            className="ir-main-container"
            style={{ maxWidth: 1240, margin: "0 auto", padding: "0 clamp(14px, 4vw, 32px)", display: "flex", flexDirection: "column", gap: 16 }}
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
              onDrillSkill={onDrillSkill}
            />
            <ReferralInviteSection score={data.overallScore} shareUrl={shareUrl} />
            <TestimonialNudge score={data.overallScore} priorSessionCount={data.priorSessionCount} role={data.role} />
            <FooterSection onTrustAnswer={onTrustAnswer} onUsefulAnswer={onUsefulAnswer} />
          </main>
        </div>
      </>
    );
  }
  /* L-2 (2026-07-10, live staging — negotiation report cc0a7469): the generic
   * behavioural cross-session insights ("You were told to quantify results two
   * sessions ago, still missing in 4/5 answers") are generated by the
   * behavioural evaluate-session prompt and are meaningless on a salary
   * negotiation report — a negotiation has no "answers to quantify results in".
   * They were leaking onto BOTH the cross-session TrendStrip AND the Coach's
   * Notes "PERSISTENT GAP" card, side-by-side with the dedicated negotiation
   * surfaces. `data.negotiationOutcome` is the definitive "this is a negotiation
   * report" signal and the view is the single point where both panels are
   * chosen — suppress the behavioural insight stream here so neither surface
   * can render it. (blindSpots stay — the adapter already filters those to
   * negotiation competencies per R-8.) */
  const behaviouralCrossSessionInsights = data.negotiationOutcome
    ? undefined
    : data.crossSessionInsights;
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
        <Header onBack={onBack} backLabel={backLabel} onDownloadPdf={onDownloadPdf} onShare={onShare} />
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
          {data.focusBanner && <FocusBannerStrip banner={data.focusBanner} daysUntilInterview={data.daysUntilInterview} />}
          <HeroSection data={data} />
          <p
            role="note"
            style={{
              fontFamily: f.sans,
              fontSize: 11.5,
              color: t.inkFaint,
              textAlign: "center",
              margin: "4px 0 0",
              lineHeight: 1.5,
            }}
          >
            AI-generated feedback — a practice tool, not a hiring decision. Scores may not reflect every panel's rubric.{" "}
            <a href="/contact" style={{ color: t.inkFaint, textUnderlineOffset: 2 }}>Dispute a score</a> if something looks wrong.
          </p>
          {isFreeUser && (
            <UpgradeNudgeStrip score={data.overallScore} onUpgrade={onUpgrade} />
          )}
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
              guardrailFlagSummary={data.kernelMetrics?.guardrailFlagSummary}
              salaryMeta={salaryNegotiationMeta}
            />
          )}
          {offerNetValue && <OfferEconomicsPanel offer={offerNetValue} />}
          {data.kernelMetrics && (
            <KernelNegotiationQualitySection m={data.kernelMetrics} />
          )}
          {data.priorSessionCount !== undefined && data.priorSessionCount >= 3 && behaviouralCrossSessionInsights && (
            <TrendStrip
              priorSessionCount={data.priorSessionCount}
              insights={behaviouralCrossSessionInsights}
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
            insights={behaviouralCrossSessionInsights}
            storyReuse={data.negotiationOutcome ? undefined : data.storyReuseFindings}
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
            resumeImprovements={data.resumeImprovements}
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
          />
          {/* Score card download — surfaces after the report body so the
              candidate has read their results before sharing. Guards the
              Canvas API call client-side via typeof window check inside
              downloadScoreCard. Only shows when we have the data needed. */}
          <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 8 }}>
            <ScoreCardDownloadButton
              score={data.overallScore}
              role={data.role}
              company={data.company}
              topStrength={data.strengths[0] ?? ""}
              topGap={data.weakestSkill?.tip ?? data.improvements[0] ?? ""}
              verdict={data.aiVerdict}
            />
          </div>
          <ReferralInviteSection score={data.overallScore} shareUrl={shareUrl} />
          <TestimonialNudge score={data.overallScore} priorSessionCount={data.priorSessionCount} role={data.role} />
          <FooterSection
            onTrustAnswer={onTrustAnswer}
            onUsefulAnswer={onUsefulAnswer}
          />
        </main>
      </div>
    </>
  );
}
