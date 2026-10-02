/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Cross-session insights + story-reuse + blind-spots aggregation card.
 * Pure presentation. */

import type { ReactNode } from "react";
import { t, f, size } from "../tokens";
import type { BlindSpot, CrossSessionInsight, StoryReuseFinding } from "../types";
import { SrSectionShell } from "./_primitives";
import { Card, CardContent } from "@/components/ui/card";

type NoteKind = "strength" | "gap" | "regression" | "improvement" | "persistent" | "story-reuse" | "blind-spot";

const NOTE_META: Record<NoteKind, { eyebrow: string; dot: string }> = {
  strength:     { eyebrow: "✓ What went well",  dot: t.success },
  gap:          { eyebrow: "→ For next time",   dot: t.copper },
  regression:   { eyebrow: "↓ Regression",      dot: t.error },
  improvement:  { eyebrow: "↑ Improvement",     dot: t.success },
  persistent:   { eyebrow: "Persistent gap",    dot: t.copper },
  "story-reuse": { eyebrow: "↻ Story reuse",    dot: t.indigo },
  "blind-spot": { eyebrow: "◌ Blind spot",      dot: t.inkSoft },
};

function NoteCard({ kind, title, body, extra }: { kind: NoteKind; title: string; body: string; extra?: ReactNode }) {
  const meta = NOTE_META[kind];
  return (
    <Card className="gap-0 py-0 shadow-none" style={{ borderColor: t.line, background: t.creamSoft }}>
      <CardContent className="px-4 py-3.5">
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: meta.dot, flexShrink: 0 }} />
          <span style={{ fontFamily: f.mono, fontSize: size.xs, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: meta.dot }}>
            {meta.eyebrow}
          </span>
        </div>
        <h3 style={{ fontFamily: f.serif, fontSize: size.lg, color: t.coal, lineHeight: 1.3, margin: "0 0 6px" }}>{title}</h3>
        <p style={{ fontFamily: f.sans, fontSize: size.base, color: t.inkSoft, lineHeight: 1.55, margin: 0 }}>{body}</p>
        {extra}
      </CardContent>
    </Card>
  );
}

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
      num="07"
      label="What your coach would say"
      title={<>Coach&apos;s Notes</>}
      subtitle={<>Patterns we&apos;ve noticed across your last few sessions — the perspective a human coach would bring.</>}
    >
      <div className="ir-coach-notes-grid">
        {hasCoaching && (
          <>
            <NoteCard
              key="coaching-strength"
              kind="strength"
              title={coaching!.strength.headline}
              body={coaching!.strength.meaning}
            />
            <NoteCard
              key="coaching-gap"
              kind="gap"
              title={coaching!.gap.headline}
              body={coaching!.gap.meaning}
              extra={
                coaching!.gap.example ? (
                  <p style={{ fontFamily: f.sans, fontSize: size.base, color: t.inkSoft, lineHeight: 1.55, fontStyle: "italic", margin: "6px 0 0" }}>
                    {coaching!.gap.example}
                  </p>
                ) : undefined
              }
            />
          </>
        )}
        {hasInsights && insights!.map((it) => (
          <NoteCard
            key={it.title}
            kind={it.kind === "regression" ? "regression" : it.kind === "improvement" ? "improvement" : "persistent"}
            title={it.title}
            body={it.body}
          />
        ))}
        {hasStoryReuse && storyReuse!.map((s) => (
          <NoteCard key={s.storyLabel} kind="story-reuse" title={s.storyLabel} body={s.body} />
        ))}
        {hasBlindSpots && blindSpots!.map((b) => (
          <NoteCard key={b.title} kind="blind-spot" title={b.title} body={b.body} />
        ))}
      </div>
    </SrSectionShell>
  );
}
