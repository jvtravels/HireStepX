/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Three action cards: retry weakest / save story / drill weakest skill.
 * First card is date-aware (scheduled interview → prep plan).
 * Pure presentation.
 *
 * Intentionally NOT using SrSectionShell — the readinessSentence below
 * the h2 is a richer block than the shell's subtitle slot: it carries a
 * copper accent rule (borderLeft), 12px paddingLeft, coal-on-cream
 * coloring, and 14px serif-adjacent body type. Collapsing it into the
 * shell's plain inkSoft subtitle would erase the "this is a callout, not
 * metadata" affordance. */

import { t, f, shadows, radius } from "../tokens";
import { SectionEyebrow } from "./sr-JumpNav";

export function NextStepsSection({
  daysUntilInterview,
  readinessSentence,
  weakestSkill,
  weakestQuestionIndex,
  onTryWeakestQuestion,
  onDrillSkill,
  resumeImprovements,
}: {
  daysUntilInterview?: number;
  readinessSentence?: string;
  weakestSkill?: string;
  /** The label index (as shown in the Per-Question section) of the
   *  lowest-scored question — used in the CTA copy so it matches
   *  what the user sees in the report (e.g. "Q5", not "Q1"). */
  weakestQuestionIndex?: number;
  onTryWeakestQuestion?: () => void;
  onDrillSkill?: () => void;
  /** Resume polish bullets from the AI analysis — shown when present
   *  to connect interview coaching with resume quality. Max 3. */
  resumeImprovements?: string[];
}) {
  /* Drill weakest skill — bridges to drill mode. If the parent didn't
   * provide a handler we fall back to a no-op so the CTA is never a
   * dead button. Matches the no-op-default pattern used elsewhere in the
   * report (e.g. onTryWeakestQuestion is left undefined and disabled;
   * the drill CTA is the entry point for a new flow so we keep it live
   * by default). */
  const handleDrillSkill = onDrillSkill ?? (() => {});

  const hasScheduledInterview = typeof daysUntilInterview === "number" && daysUntilInterview > 0;
  const sessionsToFit = hasScheduledInterview
    ? Math.min(6, Math.max(2, Math.floor((daysUntilInterview as number) * 0.6)))
    : 0;

  const firstCard = hasScheduledInterview
    ? {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
        iconBg: t.errorTint,
        iconColor: t.error,
        title: `Build your ${daysUntilInterview}-day prep plan`,
        desc: `Your interview is ${daysUntilInterview} days away. Schedule ${sessionsToFit} focused sessions on your weakest skill.`,
        cta: "Schedule now",
      }
    : {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
        ),
        iconBg: t.errorTint,
        iconColor: t.error,
        title: "Try your weakest question again",
        desc: `Improve your answer for Q${weakestQuestionIndex ?? 1} and see your score go up.`,
        cta: "Retry now",
      };

  const firstCardWithHandler = { ...firstCard, onClick: onTryWeakestQuestion };
  const cards = [
    firstCardWithHandler,
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
      iconBg: t.indigoTint,
      iconColor: t.indigo,
      title: "Drill your weakest skill",
      desc: weakestSkill
        ? `Focus on ${weakestSkill} with a 5-question drill.`
        : "Run a focused drill on your lowest skill.",
      cta: "Start drill",
      onClick: handleDrillSkill,
    },
  ];
  return (
    <section
      id="ir-section-next"
      aria-labelledby="ir-next-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.shell,
        padding: 28,
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      <SectionEyebrow num="06" label="What to do now" />
      <h2 id="ir-next-heading" style={{ fontFamily: f.serif, fontSize: 22, fontWeight: 400, color: t.coal, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
        Recommended Next Steps
      </h2>
      {readinessSentence && (
        <p
          style={{
            fontFamily: f.sans,
            fontSize: 14,
            color: t.coal,
            margin: "0 0 18px",
            lineHeight: 1.55,
            paddingLeft: 12,
            borderLeft: `2px solid ${t.copper}`,
          }}
        >
          {readinessSentence}
        </p>
      )}
      {/* Resume fix card — shown when AI resume analysis has improvement bullets.
          Connects interview coaching with resume quality in a single view. */}
      {resumeImprovements && resumeImprovements.length > 0 && (
        <div
          style={{
            background: "#FFFBF0",
            border: `1px solid rgba(180,83,9,0.20)`,
            borderLeft: `3px solid ${t.copper}`,
            borderRadius: radius.bar,
            padding: "14px 18px",
            marginBottom: 16,
          }}
        >
          <p style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 600, color: t.copper, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            📄 Resume fixes that match this interview pattern
          </p>
          <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
            {resumeImprovements.map((tip, i) => (
              <li key={i} style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.55, marginBottom: i < resumeImprovements.length - 1 ? 4 : 0 }}>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="ir-next-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {cards.map((c) => (
          <div
            key={c.title}
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: radius.bar,
              padding: "18px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.xl,
                background: c.iconBg,
                color: c.iconColor,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {c.icon}
            </span>
            <h3 style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: 0 }}>{c.title}</h3>
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.5, margin: 0, flex: 1 }}>
              {c.desc}
            </p>
            <button
              type="button"
              onClick={c.onClick}
              disabled={!c.onClick}
              style={{
                background: "transparent",
                border: "none",
                color: c.onClick ? t.indigo : t.inkFaint,
                fontFamily: f.sans,
                fontSize: 13,
                fontWeight: 600,
                cursor: c.onClick ? "pointer" : "not-allowed",
                padding: 0,
                alignSelf: "flex-start",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {c.cta}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
