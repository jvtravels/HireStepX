/* Drill mode UI barrel.
 *
 * Surface kept small: a controller view and a verdict card. The
 * controller owns 5-turn state via the pure `_drill-session.ts` engine.
 * Re-exports the skill/config types so callers (sr-NextStepsSection) can
 * stay decoupled from the kernel module path. */

export { DrillSessionView } from "./DrillSessionView";
export { DrillVerdictCard } from "./DrillVerdictCard";
export type { DrillSkill, DrillConfig, DrillSummary } from "../../../server-handlers/_drill-session";
