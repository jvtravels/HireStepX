"use client";
/* Route-level wrapper for the new Session History design.
   Pulls real sessions from DashboardContext (already provided by
   app/(app)/(dashboard)/layout.tsx), maps DashboardSession → the
   design's local Session shape, and renders SessionHistoryDesign.

   Empty real-data automatically lands the user on the design's
   "empty" variant (handled inside the component). Loading shows a
   minimal cream-on-coal placeholder rather than the prototype's
   embedded mock data, so users never see fake rows. */
import { useRouter } from "next/navigation";
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
  /* humanDate is preferred over d.dateLabel because dateLabel is
     persisted at write-time ("Today" stays "Today" forever); the
     fresh computation always reflects "now". Fall back to the
     persisted label only when the date itself fails to parse. */
  const fresh = humanDate(d.date, now);
  return {
    id: d.id,
    type: d.type,
    role: d.role,
    /* Empty string when company is missing; the row template
       conditionally renders the company suffix, so we don't surface
       a "–" glyph that reads as data corruption. */
    company: d.company ?? "",
    date: d.date,
    dateLabel: fresh || d.dateLabel || "",
    duration: d.duration,
    score: d.score,
    delta: d.change,
    /* Plain-language coaching pair (strength + gap, each with a meaning;
       gap also carries a concrete rewrite example). Persisted in
       report_json.coaching by evaluate-session (mvp-8+) and threaded
       through DashboardSession. Undefined for pre-mvp-8 rows — the card
       falls back to topStrength / topGap headlines, never invents copy. */
    coaching: d.coaching,
    /* difficulty is surfaced inline in the row's metadata line so the
       score numeral has interpretive context (82 on Hard ≠ 82 on Easy).
       Optional upstream because some legacy rows predate the field. */
    difficulty: d.difficulty,
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
  const router = useRouter();
  const { recentSessions, sessionsLoading } = useDashboardSessions();

  if (sessionsLoading) {
    /* Render a calm placeholder during fetch rather than fall through
       to mock data. Matches the design's cream surface so the swap
       doesn't flash. */
    return (
      <div
        style={{
          minHeight: "100vh",
          /* HireStepX cream + coal + Inter — matches DashboardLayout
             so the swap into the design doesn't flash. */
          background: "#FAF7F0",
          color: "#6E6759",
          display: "grid",
          placeItems: "center",
          fontFamily:
            "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
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
      theme="hirestepx"
      /* Hand "New session" + EmptyView CTAs off to the interview
         route. /interview is the same target the dashboard's
         primary CTA uses. */
      onStartSession={() => router.push("/interview")}
      /* Row-level "Practice this again" carries the original session's
         setup forward so the user lands in a pre-populated interview
         setup. Query params mirror the dashboard's deep-link contract
         for /interview. Missing fields drop cleanly. */
      onRerun={s => {
        const params = new URLSearchParams();
        if (s.type) params.set("type", s.type);
        if (s.role) params.set("role", s.role);
        if (s.company) params.set("company", s.company);
        if (s.difficulty) params.set("difficulty", s.difficulty);
        const qs = params.toString();
        router.push(qs ? `/interview?${qs}` : "/interview");
      }}
    />
  );
}
