/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Cross-session insights + story-reuse + blind-spots aggregation card.
 * Pure presentation. */

import type { BlindSpot, CrossSessionInsight, StoryReuseFinding } from "../types";
import { SrSectionShell } from "./_primitives";

export function CoachNotesSection({
  insights,
  storyReuse,
  blindSpots,
  coaching,
}: {
  insights?: CrossSessionInsight[];
  storyReuse?: StoryReuseFinding[];
  blindSpots?: BlindSpot[];
  coaching?: {
    strength: { headline: string; meaning: string };
    gap: { headline: string; meaning: string; example: string };
  };
}) {
  const hasInsights = insights && insights.length > 0;
  const hasStoryReuse = storyReuse && storyReuse.length > 0;
  const hasBlindSpots = blindSpots && blindSpots.length > 0;
  const hasCoaching = !!coaching;
  if (!hasInsights && !hasStoryReuse && !hasBlindSpots && !hasCoaching) return null;
  return (
    <SrSectionShell
      anchorId="ir-section-coach-notes"
      headingId="ir-coach-notes-heading"
      num="05"
      label="What your coach would say"
      title={<>Coach&apos;s Notes</>}
      subtitle={<>Patterns we&apos;ve noticed across your last few sessions — the perspective a human coach would bring.</>}
    >
      <div className="ir-coach-notes-grid">
        {hasCoaching && (
          <>
            <article key="coaching-strength" className="ir-coach-note-card persistent">
              <div className="ir-coach-note-eyebrow">✓ What went well</div>
              <h3 className="ir-coach-note-title">{coaching!.strength.headline}</h3>
              <p className="ir-coach-note-body">{coaching!.strength.meaning}</p>
            </article>
            <article key="coaching-gap" className="ir-coach-note-card regression">
              <div className="ir-coach-note-eyebrow">→ For next time</div>
              <h3 className="ir-coach-note-title">{coaching!.gap.headline}</h3>
              <p className="ir-coach-note-body">{coaching!.gap.meaning}</p>
              {coaching!.gap.example && (
                <p className="ir-coach-note-body" style={{ fontStyle: "italic", marginTop: 6 }}>{coaching!.gap.example}</p>
              )}
            </article>
          </>
        )}
        {hasInsights && insights!.map((it) => (
          <article
            key={it.title}
            className={`ir-coach-note-card ${it.kind === "regression" ? "regression" : "persistent"}`}
          >
            <div className="ir-coach-note-eyebrow">
              {it.kind === "regression" ? "↓ Regression" : it.kind === "improvement" ? "↑ Improvement" : "Persistent gap"}
            </div>
            <h3 className="ir-coach-note-title">{it.title}</h3>
            <p className="ir-coach-note-body">{it.body}</p>
          </article>
        ))}
        {hasStoryReuse && storyReuse!.map((s) => (
          <article key={s.storyLabel} className="ir-coach-note-card story-reuse">
            <div className="ir-coach-note-eyebrow">↻ Story reuse</div>
            <h3 className="ir-coach-note-title">{s.storyLabel}</h3>
            <p className="ir-coach-note-body">{s.body}</p>
          </article>
        ))}
        {hasBlindSpots && blindSpots!.map((b) => (
          <article key={b.title} className="ir-coach-note-card blind-spot">
            <div className="ir-coach-note-eyebrow">◌ Blind spot</div>
            <h3 className="ir-coach-note-title">{b.title}</h3>
            <p className="ir-coach-note-body">{b.body}</p>
          </article>
        ))}
      </div>
    </SrSectionShell>
  );
}
