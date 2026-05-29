/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Cross-session insights + story-reuse + blind-spots aggregation card.
 * Pure presentation. */

import type { BlindSpot, CrossSessionInsight, StoryReuseFinding } from "../types";
import { SrSectionShell } from "./_primitives";

export function CoachNotesSection({
  insights,
  storyReuse,
  blindSpots,
}: {
  insights?: CrossSessionInsight[];
  storyReuse?: StoryReuseFinding[];
  blindSpots?: BlindSpot[];
}) {
  const hasInsights = insights && insights.length > 0;
  const hasStoryReuse = storyReuse && storyReuse.length > 0;
  const hasBlindSpots = blindSpots && blindSpots.length > 0;
  if (!hasInsights && !hasStoryReuse && !hasBlindSpots) return null;
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
