/* Planner registry — one-direction edge breaker (commit 4, 2026-05-15).
 *
 * Why this module exists:
 *   - The kernel (_negotiation-kernel.ts) needs to call the planner
 *     (_next-action-planner.ts) inside applyCandidateAnswer's finalize()
 *     to stamp state.plannedNextAction.
 *   - The planner imports value bindings from the kernel (isTerminalPhase,
 *     clampToCloseFloor, etc.).
 *   - A static `import { planNextAction } from "./_next-action-planner"`
 *     inside the kernel would create a load-order cycle: the kernel
 *     re-exports pickAiMove from _kernel-move-picker (hoisted), which
 *     transitively pulls _next-action-planner, which then tries to read
 *     value bindings from the kernel BEFORE the kernel's own body has
 *     finished initializing — ReferenceError in the TDZ.
 *
 * The session-2 follow-up first solved this via globalThis — a load-order
 * workaround that buried the dependency in a runtime side-effect. This
 * module replaces that workaround with a typed, one-direction registry:
 *
 *     kernel ──▶ planner-registry ◀── planner
 *
 * Both kernel and planner import from this module. This module imports
 * nothing from either side — it has no cycle by construction.
 *
 * The planner registers its `planNextAction` function at module-load
 * (side-effect at the bottom of _next-action-planner.ts). The kernel
 * reads through `getNextActionPlanner()` inside finalize().
 *
 * Pure. No state other than the two registration pointers. */

/** Pointer type for the next-action planner. Kept `unknown`-typed at
 *  the boundary so this module never has to import NegotiationState
 *  from the kernel (which would re-introduce the cycle). The kernel
 *  side and planner side both narrow at their respective call sites. */
export type NextActionPlannerFn = (state: unknown) => unknown;

/** Pointer type for the action→lever conversion. Same opaque-typing
 *  rationale as NextActionPlannerFn. */
export type ActionToLeverFn = (action: unknown, state: unknown) => unknown;

let plannerFn: NextActionPlannerFn | null = null;
let actionToLeverFn: ActionToLeverFn | null = null;

/** Register the planner + its inverse converter. Called once at planner
 *  module load via a side-effect at the bottom of _next-action-planner.ts.
 *  Idempotent — re-registration overwrites prior pointers (used by tests
 *  that re-import the planner). */
export function registerNextActionPlanner(
  fn: NextActionPlannerFn,
  a2l: ActionToLeverFn,
): void {
  plannerFn = fn;
  actionToLeverFn = a2l;
}

/** Return the registered planner, or null if the planner module hasn't
 *  loaded yet. Kernel callers must tolerate null (early in module init,
 *  before the planner side-effect has fired). */
export function getNextActionPlanner(): NextActionPlannerFn | null {
  return plannerFn;
}

/** Return the registered action→lever converter. */
export function getActionToLever(): ActionToLeverFn | null {
  return actionToLeverFn;
}
