"use client";
/* Route-level wrapper for the new Session History design.
   Pulls real sessions from DashboardContext (already provided by
   app/(app)/(dashboard)/layout.tsx), maps DashboardSession → the
   design's local Session shape, and renders SessionHistoryDesign.

   Empty real-data automatically lands the user on the design's
   "empty" variant (handled inside the component). Loading shows a
   minimal cream-on-coal placeholder rather than the prototype's
   embedded mock data, so users never see fake rows. */
import SessionHistoryDesign, { type SessionHistoryItem } from "./SessionHistoryDesign";
import { useDashboardSessions } from "./DashboardContext";
import type { DashboardSession } from "./dashboardTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

/* Date → human label. Mirrors the grouping idiom inside the design
   (Today / Yesterday / N days ago / Last week / Older), so the
   dateLabel field stays consistent with the bucket headers. */
function humanDate(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.floor((now - t) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "Last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/* Map the canonical DashboardSession shape to the design's local
   Session shape. The two were designed independently; this is the
   one place the two vocabularies meet. */
function toHsx(d: DashboardSession, now: number): SessionHistoryItem {
  return {
    id: d.id,
    type: d.type,
    role: d.role,
    company: d.company ?? "–",
    date: d.date,
    dateLabel: d.dateLabel || humanDate(d.date, now),
    duration: d.duration,
    score: d.score,
    delta: d.change,
    topStrength: d.topStrength,
    topGap: d.topWeakness,
    questions: d.questionScores?.length ?? 0,
    /* Detail-view payloads. The design's Detail view falls back to
       sample arrays when these are absent (canvas mode); when present
       it renders real Q-by-Q, transcript, and coach notes. */
    questionScores: d.questionScores,
    transcript: d.transcript,
    feedback: d.feedback,
  };
}

export default function SessionHistoryRoute() {
  const { recentSessions, sessionsLoading } = useDashboardSessions();

  if (sessionsLoading) {
    /* Render a calm placeholder during fetch rather than fall through
       to mock data. Matches the design's cream surface so the swap
       doesn't flash. */
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#FAF7F0",
          color: "#0E0C08",
          display: "grid",
          placeItems: "center",
          fontFamily: "'Satoshi', -apple-system, system-ui, sans-serif",
          fontSize: 13,
        }}
      >
        Loading sessions…
      </div>
    );
  }

  const now = Date.now();
  const sessions = recentSessions.map(d => toHsx(d, now));

  /* allowDelete / allowReport gate two affordances that have no
     real backend yet: there is no /api/sessions/delete endpoint, and
     the Report view's radar / percentile / confidence band have no
     source in DashboardSession. Hiding them in route mode keeps the
     UI honest; the canvas keeps both ON for design exploration. */
  return (
    <SessionHistoryDesign
      initialSessions={sessions}
      allowDelete={false}
      allowReport={false}
      embedded
    />
  );
}
