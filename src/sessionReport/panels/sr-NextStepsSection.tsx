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

import { t, f, radius, size } from "../tokens";
import { ReportCardShell, CalloutCard } from "./_primitives";
import { Button } from "@/components/ui/button";

export function NextStepsSection({
  daysUntilInterview,
  readinessSentence,
  weakestSkill,
  weakestQuestionIndex,
  weakestQuestionScore,
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
  weakestQuestionScore?: number;
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
        title: `Build your ${daysUntilInterview}-day prep plan`,
        desc: `Your interview is ${daysUntilInterview} days away. Schedule ${sessionsToFit} focused sessions on your weakest skill.`,
        cta: "Schedule sessions",
      }
    : {
        title: "Try your weakest question again",
        desc: `Question ${weakestQuestionIndex ?? 1} scored lowest${typeof weakestQuestionScore === "number" ? ` (${weakestQuestionScore}/100)` : ""}. Redo it and see your score go up.`,
        cta: "Retry this question",
      };

  const firstCardWithHandler = { ...firstCard, onClick: onTryWeakestQuestion };
  const cards = [
    firstCardWithHandler,
    {
      title: "Drill your weakest skill",
      desc: weakestSkill
        ? `Focus on ${weakestSkill} with a 5-question drill.`
        : "Run a focused drill on your lowest skill.",
      cta: "Start 5-question drill",
      onClick: handleDrillSkill,
    },
  ];
  return (
    <ReportCardShell id="ir-section-next" ariaLabelledBy="ir-next-heading">
      <h2 id="ir-next-heading" style={{ fontFamily: f.sans, fontSize: size.xl, fontWeight: 600, color: t.coal, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
        Next steps
      </h2>
      {readinessSentence && (
        <p style={{ fontFamily: f.sans, fontSize: size.base, color: t.inkSoft, margin: "0 0 16px", lineHeight: 1.5 }}>
          {readinessSentence}
        </p>
      )}
      {resumeImprovements && resumeImprovements.length > 0 && (
        <div style={{ margin: "16px 0" }}>
          <CalloutCard eyebrow="Resume fixes that match this interview pattern">
            <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
              {resumeImprovements.map((tip, i) => (
                <li key={i} style={{ marginBottom: i < resumeImprovements.length - 1 ? 4 : 0 }}>
                  {tip}
                </li>
              ))}
            </ul>
          </CalloutCard>
        </div>
      )}
      <div className="ir-next-steps-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginTop: 16 }}>
        {cards.map((c) => (
          <div
            key={c.title}
            style={{
              border: `1px solid ${t.line}`,
              borderRadius: radius.bar,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <h3 style={{ fontFamily: f.sans, fontSize: size.md, fontWeight: 600, color: t.coal, margin: 0 }}>{c.title}</h3>
            <p style={{ fontFamily: f.sans, fontSize: size.base, color: t.inkSoft, lineHeight: 1.5, margin: "0 0 10px", flex: 1 }}>
              {c.desc}
            </p>
            <Button type="button" size="sm" variant="outline" onClick={c.onClick} disabled={!c.onClick} style={{ alignSelf: "flex-start" }}>
              {c.cta}
            </Button>
          </div>
        ))}
      </div>
    </ReportCardShell>
  );
}
