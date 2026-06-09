"use client";
/* Route-level wrapper for the Sessions page.
 *
 * Renders the new two-rail balanced card layout (see DashboardSessions
 * → SessionRow): identity headline + quiet "Did well" line + dominant
 * "Work on next" block with structured plain-language coaching from
 * the evaluator (server-handlers/evaluate-session.ts, mvp-8+), plus a
 * ScoreRing rail and a persistent "View full report →" action bar.
 *
 * DashboardSessions already consumes useDashboardSessions(), so this
 * route is a thin pass-through — context is provided one level up by
 * app/(app)/(dashboard)/layout.tsx. The earlier SessionHistoryDesign
 * "timeline chronicle" treatment is retired here; it remains available
 * in the canvas (tempo/designs/canvases/session-history) for design
 * exploration but is no longer the user-facing surface. */
import DashboardSessions from "./DashboardSessions";

export default function SessionHistoryRoute() {
  return <DashboardSessions />;
}
