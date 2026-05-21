/* Shared helper bundle for carved-out per-action canonical-prose arms.
 *
 * Code-quality audit (2026-05-22) — `_canonical-prose.ts` had grown to
 * 1,659 lines as a single switch-over-action.kind. Each new persona or
 * NextAction.kind regrew the file. The carve-out splits each arm into a
 * sibling `prose/<kind>.ts` module and passes a `ProseHelpers` bundle
 * built once per call so individual arms remain pure (no module-scope
 * coupling back into the dispatcher).
 *
 * Behaviour is byte-identical to the pre-carve-out dispatcher — the
 * arms reference exactly the helpers they referenced before; this file
 * is just the explicit contract for that surface.
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import type { RecruiterSectorPersona } from "../_indian-recruiter-personas";
import type { NegotiationRoundPersona } from "../_negotiation-rounds";

export interface ProseHelpers {
  /** Candidate first name, or null if unavailable. */
  firstName: string | null;
  /** Sector persona (defaults to "default"). */
  sectorPersona: RecruiterSectorPersona;
  /** Multi-round persona, or null when multi-round is disabled. */
  activeRoundPersona: NegotiationRoundPersona | null;
  /** Round-persona record lookup. */
  selectByRoundPersona<T>(
    p: NegotiationRoundPersona,
    table: Record<NegotiationRoundPersona, T>,
  ): T;
  /** Sector-persona record lookup. */
  selectBySectorPersona<T>(
    p: RecruiterSectorPersona,
    table: Record<RecruiterSectorPersona, T>,
  ): T;
  /** Per-action escalation anchor selector. */
  selectEscalationAnchor(action: NextAction, state: NegotiationState): string;
  /** Discovery-probe ACK prefix builder. */
  buildDiscoveryAck(
    delta: import("../_negotiation-kernel").TurnDelta | null | undefined,
    probeItem: string,
    state?: NegotiationState,
  ): string | null;
  /** Meta-directive sanitiser for candidate-bound prose. */
  sanitiseCandidateProse(s: string | null | undefined): string | null;
  /** Grade label used in band framing ("this grade" today). */
  gradeLabel(state: NegotiationState): string;
}
