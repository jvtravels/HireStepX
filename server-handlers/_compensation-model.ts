/* Scope-typed compensation model (negotiation architecture upgrade,
 * 2026-06-17).
 *
 * WHY THIS EXISTS
 * ---------------
 * The negotiation kernel historically tracked the candidate's stated pay as
 * flat scalars (`userClaims.currentCtc`, `userClaims.expectedCtc`) with NO
 * notion of scope. A breakdown like "my base is ₹36L, the rest is ₹12L
 * variable, so ₹48L total" produced three numbers (36, 12, 48) that were all
 * compared, flatly, against the single stored "current CTC" — so the ±10%
 * drift detector fired a spurious "you contradicted yourself" call-out on a
 * perfectly consistent disclosure, looping the bot and starving the session
 * into a forced stalemate. Each past fix bolted ONE more regex guard onto the
 * extractor (equity guard, target-clause mask, fixed-route). The bug class
 * kept returning because there was no single source of truth for "what scope
 * is this number".
 *
 * THE MODEL
 * ---------
 * A disclosed pay figure occupies exactly ONE axis:
 *   - total    — the headline CTC / package
 *   - fixed    — base / fixed / basic component
 *   - variable — variable / bonus / incentive component
 *   - equity   — RSU / ESOP / stock, amortised to annual
 * Because `fixed` and `total` are DIFFERENT FIELDS, a base figure can never
 * masquerade as the total — the old bug is unrepresentable, not "guarded".
 *
 * Components RECONCILE with the total (fixed ≤ total; fixed+variable+equity ≈
 * total) — they can never CONTRADICT it. A contradiction fires only when the
 * SAME axis moves materially (total 48 → total 60). Even if upstream
 * extraction mis-files a number onto the wrong axis, the worst case is a wrong
 * component value — never a session-killing false contradiction. Failures
 * degrade gracefully instead of catastrophically.
 *
 * This module is PURE and edge-safe (no Node APIs, no I/O). It is the keystone
 * the kernel's contradiction detector and ledger are rewired onto in later
 * stages; on its own it changes no behaviour.
 */

export type CompAxis = "total" | "fixed" | "variable" | "equity";

export type CompFrame = "ctc" | "in-hand" | "unknown";

/** A single scoped pay claim plus the provenance needed to reason about it. */
export interface ScopedClaim {
  /** LPA-normalised value. */
  value: number;
  /** Turn the candidate first stated this axis (anchors contradiction labels). */
  firstSeenTurn: number;
  /** Most recent turn the candidate restated/refined this axis. */
  lastSeenTurn: number;
  /** Whether the figure was framed as full CTC or take-home in-hand. */
  frame: CompFrame;
  /** Raw utterance the claim was parsed from (audit / call-out wording). */
  rawUtterance: string;
}

/** The candidate's stated current compensation, one slot per axis. */
export interface CandidateComp {
  total: ScopedClaim | null;
  fixed: ScopedClaim | null;
  variable: ScopedClaim | null;
  equity: ScopedClaim | null;
}

export const EMPTY_COMP: Readonly<CandidateComp> = Object.freeze({
  total: null,
  fixed: null,
  variable: null,
  equity: null,
});

/** A scoped observation extracted from ONE candidate turn. */
export interface CompObservation {
  axis: CompAxis;
  value: number;
  turn: number;
  frame?: CompFrame;
  raw: string;
}

/** Emitted only for a genuine same-axis contradiction. */
export interface CompContradiction {
  axis: CompAxis;
  oldValue: number;
  newValue: number;
  firstSeenTurn: number;
}

/* ── Tolerances ─────────────────────────────────────────────────────────
 * SAME_AXIS: how far the same axis can move before it's a real contradiction.
 *   Kept at the kernel's historical ±10% so genuine "30 → 45 total" still
 *   fires.
 * RECONCILE: components rarely sum to the exact headline CTC (rounding,
 *   benefits, gratuity), so reconciliation is looser — a 12% envelope. */
export const SAME_AXIS_TOLERANCE = 0.10;
export const RECONCILE_TOLERANCE = 0.12;

const isFiniteNum = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

function relDrift(a: number, b: number): number {
  return Math.abs(a - b) / Math.max(Math.abs(b), 1e-9);
}

/** Sum of the disclosed components, or null when not even the fixed leg is
 *  known (a total can't be meaningfully implied from variable/equity alone). */
export function impliedTotal(c: CandidateComp): number | null {
  if (c.fixed == null) return null;
  let sum = c.fixed.value;
  if (c.variable != null) sum += c.variable.value;
  if (c.equity != null) sum += c.equity.value;
  return sum;
}

/** True when the stated total (if any) is consistent with the disclosed
 *  components. No total, or no components → vacuously consistent. */
export function reconciles(
  c: CandidateComp,
  tolerance = RECONCILE_TOLERANCE,
): boolean {
  if (c.total == null) return true;
  const total = c.total.value;
  const ceiling = total * (1 + tolerance);

  // A single component can never exceed the total (beyond tolerance).
  for (const part of [c.fixed, c.variable, c.equity]) {
    if (part != null && part.value > ceiling) return false;
  }

  // If we have the full split, the sum should land near the headline total.
  const implied = impliedTotal(c);
  if (implied != null && c.variable != null) {
    // Components sum within envelope, OR sum sits at/under the headline
    // (headline may legitimately include benefits the candidate didn't break
    // out) — both reconcile.
    return relDrift(implied, total) <= tolerance || implied <= ceiling;
  }
  return true;
}

/**
 * Fold one scoped observation into the candidate's compensation model.
 *
 * Contract:
 *  - A NEW axis simply fills its slot. Cross-axis observations NEVER
 *    contradict (this is what kills the "36 base vs 48 total" false positive).
 *  - The SAME axis restated within tolerance refines the claim (updates
 *    lastSeenTurn / frame / raw) without firing.
 *  - The SAME axis moved beyond tolerance is a genuine contradiction.
 *  - A `total` observation that merely echoes an already-known component value
 *    (same turn or earlier) is demoted: it's a restatement of that component,
 *    not a fresh headline total. This absorbs upstream mis-classification
 *    where a base/variable figure leaks onto the total axis.
 */
export function applyObservation(
  comp: CandidateComp,
  obs: CompObservation,
  tolerance = SAME_AXIS_TOLERANCE,
): { comp: CandidateComp; contradiction: CompContradiction | null } {
  if (!isFiniteNum(obs.value)) return { comp, contradiction: null };

  let axis = obs.axis;

  // Demotion guard: a "total" that equals a known component (within reconcile
  // tolerance) and is NOT larger than the components is almost certainly a
  // restatement of that component, not a new headline. Re-file it so a leaked
  // component figure can't overwrite the real total.
  if (axis === "total") {
    const components: Array<[CompAxis, ScopedClaim | null]> = [
      ["fixed", comp.fixed],
      ["variable", comp.variable],
      ["equity", comp.equity],
    ];
    const echoed = components.find(
      ([, claim]) => claim != null && relDrift(obs.value, claim.value) <= RECONCILE_TOLERANCE,
    );
    const knownMax = Math.max(
      comp.fixed?.value ?? 0,
      comp.variable?.value ?? 0,
      comp.equity?.value ?? 0,
    );
    // Only demote when it echoes a component AND doesn't plausibly exceed the
    // component stack (a genuinely larger total should still register).
    if (echoed != null && obs.value <= knownMax * (1 + RECONCILE_TOLERANCE)) {
      axis = echoed[0];
    }
  }

  const prior = comp[axis];
  const frame: CompFrame = obs.frame ?? prior?.frame ?? "unknown";

  if (prior == null) {
    const next: CandidateComp = {
      ...comp,
      [axis]: {
        value: obs.value,
        firstSeenTurn: obs.turn,
        lastSeenTurn: obs.turn,
        frame,
        rawUtterance: obs.raw,
      },
    };
    return { comp: next, contradiction: null };
  }

  if (relDrift(obs.value, prior.value) <= tolerance) {
    // Refinement of the same axis — update provenance, no contradiction.
    const next: CandidateComp = {
      ...comp,
      [axis]: {
        ...prior,
        value: obs.value,
        lastSeenTurn: obs.turn,
        frame,
        rawUtterance: obs.raw,
      },
    };
    return { comp: next, contradiction: null };
  }

  // Same axis, material move → genuine contradiction. Last value wins for
  // forward reasoning; the signal carries the original anchor turn.
  const contradiction: CompContradiction = {
    axis,
    oldValue: prior.value,
    newValue: obs.value,
    firstSeenTurn: prior.firstSeenTurn,
  };
  const next: CandidateComp = {
    ...comp,
    [axis]: {
      ...prior,
      value: obs.value,
      lastSeenTurn: obs.turn,
      frame,
      rawUtterance: obs.raw,
    },
  };
  return { comp: next, contradiction };
}

/** Fold a batch of same-turn observations in a stable order so that
 *  components are seen BEFORE a total, letting the demotion guard absorb a
 *  leaked component-as-total within the same utterance. Returns the first
 *  genuine contradiction, if any. */
export function applyObservations(
  comp: CandidateComp,
  observations: readonly CompObservation[],
  tolerance = SAME_AXIS_TOLERANCE,
): { comp: CandidateComp; contradiction: CompContradiction | null } {
  const AXIS_ORDER: Record<CompAxis, number> = {
    fixed: 0,
    variable: 1,
    equity: 2,
    total: 3,
  };
  const ordered = [...observations].sort(
    (a, b) => AXIS_ORDER[a.axis] - AXIS_ORDER[b.axis],
  );
  let acc = comp;
  let firstContradiction: CompContradiction | null = null;
  for (const obs of ordered) {
    const res = applyObservation(acc, obs, tolerance);
    acc = res.comp;
    if (firstContradiction == null && res.contradiction != null) {
      firstContradiction = res.contradiction;
    }
  }
  return { comp: acc, contradiction: firstContradiction };
}

/* ── Adapter ────────────────────────────────────────────────────────────
 * Maps the kernel's existing per-turn parse output into scoped observations
 * WITHOUT depending on the giant kernel types — callers pass the minimal
 * shape. `currentCtc` is the only ambiguous field (it conflates total with
 * leaked components upstream); we tag it `total` and let applyObservations'
 * demotion guard re-file it when it echoes a same-turn component. */
export interface ParsedCompInput {
  currentCtc?: number | null;
  componentBase?: number | null;
  componentVariable?: number | null;
  componentEquity?: number | null;
  frame?: CompFrame;
}

export function observationsFromParsed(
  parsed: ParsedCompInput,
  turn: number,
  raw: string,
): CompObservation[] {
  const out: CompObservation[] = [];
  const push = (axis: CompAxis, value: number | null | undefined): void => {
    if (isFiniteNum(value)) out.push({ axis, value, turn, frame: parsed.frame, raw });
  };
  push("fixed", parsed.componentBase);
  push("variable", parsed.componentVariable);
  push("equity", parsed.componentEquity);
  push("total", parsed.currentCtc);
  return out;
}
