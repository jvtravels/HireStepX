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
import { tokens as T } from "./auth/_tokens";

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
    /* Per-focus signature strip (mvp-9+). Threaded through from
       report_json.focusMetrics. Absent for older rows — the card renders
       no instrument strip and shows the coaching pair instead. */
    focusMetrics: d.focusMetrics,
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
    /* Skeleton cards that mirror the SessionCard geometry (eyebrow +
       identity + coaching block + ring rail + action bar). Static, no
       shimmer — the card's own borders carry the structural promise
       so the swap into real data reads as continuity, not state-flip.
       Three rows lands beneath the H1 + KPI strip without scrolling
       on a 1366×768 viewport, which is the most common breakpoint. */
    const ui =
      "'Satoshi', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
    const line = T.line;
    const lineFaint = "#F2EEDE";
    const skeleton = (
      <div
        role="status"
        aria-label="Loading sessions"
        style={{
          border: `1px solid ${line}`,
          borderRadius: 14,
          background: "#FFFFFF",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 18px",
            borderBottom: `1px solid ${line}`,
            background: "#F5EFDC",
            height: 36,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 999, background: lineFaint }} />
          <span style={{ width: 90, height: 8, borderRadius: 4, background: lineFaint }} />
          <span style={{ width: 60, height: 8, borderRadius: 4, background: lineFaint }} />
        </div>
        <div style={{ display: "flex", padding: "18px 20px", gap: 22, alignItems: "stretch" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ width: "60%", height: 16, borderRadius: 4, background: lineFaint }} />
            <span style={{ width: "40%", height: 10, borderRadius: 4, background: lineFaint }} />
            <div
              style={{
                background: "rgba(180,83,9,0.06)",
                borderRadius: 10,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <span style={{ width: "70%", height: 12, borderRadius: 4, background: lineFaint }} />
              <span style={{ width: "85%", height: 8, borderRadius: 4, background: lineFaint }} />
            </div>
          </div>
          <div
            style={{
              flexShrink: 0,
              borderLeft: `1px solid ${line}`,
              paddingLeft: 22,
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                border: `3px solid ${lineFaint}`,
              }}
            />
          </div>
        </div>
        <div
          style={{
            borderTop: `1px solid ${line}`,
            padding: "12px 20px 14px",
            height: 38,
          }}
        />
      </div>
    );
    return (
      <div
        style={{
          minHeight: "100vh",
          background: T.cream,
          fontFamily: ui,
          padding: "40px 56px",
        }}
      >
        <div style={{ maxWidth: 1200, display: "flex", flexDirection: "column", gap: 10 }}>
          <span
            style={{
              width: 240,
              height: 36,
              borderRadius: 6,
              background: lineFaint,
              marginBottom: 18,
            }}
            aria-hidden
          />
          {[0, 1, 2].map(i => (
            <div key={i}>{skeleton}</div>
          ))}
        </div>
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
      /* Clicking a session card opens the canonical post-interview
         report at /session/[id] (rendered by SessionDetail →
         SessionReport). Mirrors the dashboard's row-click behavior
         and the "View results" CTA users see right after an interview
         ends — one report surface, not two divergent ones. */
      onOpenReport={id => router.push(`/session/${id}`)}
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
