/* Component-breakdown parser — Phase 10A (2026-05-13).
 *
 * Pre-Phase-10 the kernel modeled total CTC only. `candidateTarget`
 * stored a single number representing the candidate's ask, with no
 * structure for the components inside it (fixed base, variable, equity,
 * non-cash). The audit (2026-05-13) surfaced two failure modes from
 * this gap:
 *
 *   1. "I want ₹35 LPA total but base must be 28" — kernel binds
 *      target=35 and silently discards "base must be 28". The
 *      move-picker can then satisfy the total while violating the
 *      base constraint (e.g. 30 base + 5 variable = 35), and the AI
 *      thinks the offer is accepted. Candidate rejects post-hoc;
 *      neither side understood why.
 *   2. "I'm okay with 30 LPA" after the bot offered "30 LPA total
 *      (20 base + 10 variable)" — candidate often means "30 base",
 *      kernel reads as "30 total". Same component-confusion bug,
 *      mirrored.
 *
 * This module is the structural fix: a separate parser that extracts
 * component breakdowns when the candidate names them. The kernel
 * stores the result, the LLM prompt surfaces it ("Candidate stated:
 * base ₹28 LPA, variable ₹7 LPA"), and the validator can flag
 * proposals that ignore the stated component.
 *
 * Scope: detect + carry + surface in prompt. Enforcement in the
 * move-picker (e.g. mathematical "counter base must be ≥ stated
 * base") is deferred — bands are modeled as total CTC only, and
 * extending the band schema to carry components is a separate
 * architectural change.
 *
 * Patterns are conservative — false positives here would silently
 * constrain the kernel against a constraint the candidate didn't
 * state. Each component requires an explicit cue word: "base",
 * "fixed", "variable", "bonus", "equity", "stock", "RSU", "ESOP". */

export interface ComponentBreakdown {
  /** Fixed / base salary the candidate stated, in LPA. */
  base: number | null;
  /** Variable / bonus / performance pay, in LPA. */
  variable: number | null;
  /** Equity / stock / RSU / ESOP grant amortized to annual, in LPA.
   *  The candidate may state this as a multi-year grant ("₹30 LPA
   *  over 4 years"); we extract the per-year value when an obvious
   *  vesting period is given, otherwise the raw number. */
  equity: number | null;
  /** BUG-3 (PDF#24, 2026-05-16) — when the candidate states a fitment
   *  split as percentages ("80% fixed, 20% variable") the absolute LPA
   *  values aren't knowable without a total. We surface the percentage
   *  shape so the kernel can record split-disclosed without fabricating
   *  fake LPA values. Both must be present for the percent-split to be
   *  considered disclosed. Optional so existing literal constructions
   *  (tests + kernel defaults) remain valid; absence ≡ null. */
  basePercent?: number | null;
  variablePercent?: number | null;
  /** Did this turn name any component at all? Convenience for the
   *  applyTurn fold — we only update state when the candidate
   *  actively stated a breakdown. */
  hasAny: boolean;
}

const EMPTY: ComponentBreakdown = {
  base: null,
  variable: null,
  equity: null,
  basePercent: null,
  variablePercent: null,
  hasAny: false,
};

/* Number-with-unit pattern reused across components. Permits:
 *   "28", "28 LPA", "28L", "28 lakhs", "28 lakh", "₹28", "₹28 LPA",
 *   "28.5 LPA", "28,00,000". Returns LPA-normalized number.
 * Crore handling: a sub-1 crore value is converted to LPA (×100). */
function extractNumberAfter(
  text: string,
  cuePattern: string,
): number | null {
  /* Match "cue ... ₹? number unit?". Allow up to 30 chars of filler
     between the cue and the number (handles "base salary of around 28").
     BUG-3 (PDF#24, 2026-05-16): the captured number must NOT be
     immediately followed by `%`. Without this guard "80% fixed, 20%
     variable" misparses as base=20 LPA (the regex finds the literal
     cue 'fixed', skips the comma, captures '20', and ignores the '%').
     Percentage-shaped splits are surfaced separately via
     extractPercentageSplit. */
  const re = new RegExp(
    String.raw`\b${cuePattern}\b[^.!?\n]{0,30}?₹?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)\s*(lpa|lakhs?|l\b|cr|crore|k\b)?(\s*%)?`,
    "i",
  );
  const m = re.exec(text);
  if (!m) return null;
  /* Reject percentage-suffixed numbers. */
  if (m[3]) return null;
  const raw = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const unit = (m[2] || "").toLowerCase();
  let lpa: number;
  if (unit === "cr" || unit === "crore") {
    lpa = raw * 100;
  } else if (unit === "k") {
    /* "28k" almost certainly means 28,000 INR — too small for a
       salary component. Skip. */
    return null;
  } else {
    /* lpa, lakhs, lakh, l, or no-unit (assumed LPA when in the
       salary range). Reject obviously-wrong values. */
    lpa = raw;
  }
  if (lpa < 0.5 || lpa > 5000) return null;
  return Math.round(lpa * 10) / 10;
}

/** Extract component breakdown from candidate text. Returns an
 *  object with `hasAny: false` and all-null components when no
 *  components are named.
 *
 *  Each component has multiple cue phrases:
 *    - base: "base", "fixed", "fixed pay", "base salary", "base pay",
 *      "basic"
 *    - variable: "variable", "bonus", "performance pay", "performance
 *      bonus", "incentive", "target bonus", "performance comp"
 *    - equity: "equity", "stock", "stocks", "rsu", "rsus", "esop",
 *      "esops", "shares", "grant"
 *
 *  Order matters in one place: "base salary" must match before "base"
 *  alone because the regex word boundary on "base" would otherwise
 *  bind to the wrong cue context. Within `extractNumberAfter` we use
 *  the longest cue first via the alternation order below. */
/** Extract a percentage-shaped fitment split. Handles the common forms:
 *
 *   "80% fixed, 20% variable"
 *   "fixed 80% and variable 20%"
 *   "80/20 fixed-variable" / "80:20 split"
 *
 *  Returns the (base%, variable%) pair only when both halves can be
 *  recovered AND they sum to ~100 (±2 tolerance for rounding). All
 *  other shapes return (null, null) — we'd rather miss than fabricate. */
function extractPercentageSplit(a: string): { basePercent: number | null; variablePercent: number | null } {
  /* Form A: walk every "(\d+)% (cue)" or "(cue) (\d+)%" adjacency,
   * tagging each as base-side / variable-side. We then pick the
   * (base, variable) pair whose percentages sum to ~100. Restricting
   * to ADJACENT pairings avoids the "80% fixed, 20% variable" trap
   * where a loose gap would let the variable-cue gobble past the
   * fixed-side percentage. */
  const tagged: Array<{ side: "base" | "variable"; pct: number }> = [];
  const baseRe = /(?:(\d{1,3}(?:\.\d+)?)\s*%\s*(?:of\s+)?(fixed|base|basic)|(fixed|base|basic)\s+(?:is|of|at|=)?\s*(\d{1,3}(?:\.\d+)?)\s*%)/gi;
  const varRe = /(?:(\d{1,3}(?:\.\d+)?)\s*%\s*(?:of\s+)?(variable|bonus|performance)|(variable|bonus|performance)\s+(?:is|of|at|=)?\s*(\d{1,3}(?:\.\d+)?)\s*%)/gi;
  let m: RegExpExecArray | null;
  while ((m = baseRe.exec(a)) !== null) {
    const n = parseFloat(m[1] ?? m[4]);
    if (Number.isFinite(n)) tagged.push({ side: "base", pct: n });
  }
  while ((m = varRe.exec(a)) !== null) {
    const n = parseFloat(m[1] ?? m[4]);
    if (Number.isFinite(n)) tagged.push({ side: "variable", pct: n });
  }
  const baseHits = tagged.filter((t) => t.side === "base");
  const varHits = tagged.filter((t) => t.side === "variable");
  for (const bh of baseHits) {
    for (const vh of varHits) {
      if (bh.pct > 0 && vh.pct > 0 && Math.abs(bh.pct + vh.pct - 100) <= 2) {
        return { basePercent: bh.pct, variablePercent: vh.pct };
      }
    }
  }
  /* Form B: "80/20" or "80:20" near a split/fixed/variable cue. */
  const ratioMatch = /(\d{1,3}(?:\.\d+)?)\s*[\/:]\s*(\d{1,3}(?:\.\d+)?)[^.!?\n]{0,20}?(?:split|fixed[-\s]?variable|fixed\s+and\s+variable)/i.exec(a)
    ?? /(?:split|fixed[-\s]?variable|fixed\s+and\s+variable)[^.!?\n]{0,20}?(\d{1,3}(?:\.\d+)?)\s*[\/:]\s*(\d{1,3}(?:\.\d+)?)/i.exec(a);
  if (ratioMatch) {
    const bp = parseFloat(ratioMatch[1]);
    const vp = parseFloat(ratioMatch[2]);
    if (Number.isFinite(bp) && Number.isFinite(vp) && bp > 0 && vp > 0 && Math.abs(bp + vp - 100) <= 2) {
      return { basePercent: bp, variablePercent: vp };
    }
  }
  return { basePercent: null, variablePercent: null };
}

export function extractComponentBreakdown(text: string): ComponentBreakdown {
  if (!text) return EMPTY;
  const a = text.toLowerCase();

  const base =
    extractNumberAfter(a, "base\\s+salary") ??
    extractNumberAfter(a, "base\\s+pay") ??
    extractNumberAfter(a, "fixed\\s+pay") ??
    extractNumberAfter(a, "fixed\\s+component") ??
    extractNumberAfter(a, "fixed") ??
    extractNumberAfter(a, "basic") ??
    extractNumberAfter(a, "base");

  const variable =
    extractNumberAfter(a, "performance\\s+bonus") ??
    extractNumberAfter(a, "performance\\s+pay") ??
    extractNumberAfter(a, "target\\s+bonus") ??
    extractNumberAfter(a, "variable\\s+pay") ??
    extractNumberAfter(a, "variable\\s+comp(?:onent)?") ??
    extractNumberAfter(a, "variable") ??
    extractNumberAfter(a, "incentive") ??
    extractNumberAfter(a, "bonus");

  const equity =
    extractNumberAfter(a, "rsus?") ??
    extractNumberAfter(a, "esops?") ??
    extractNumberAfter(a, "equity\\s+grant") ??
    extractNumberAfter(a, "equity") ??
    extractNumberAfter(a, "stock\\s+(?:options?|grant)") ??
    extractNumberAfter(a, "stocks?") ??
    extractNumberAfter(a, "shares") ??
    extractNumberAfter(a, "grant");

  const { basePercent, variablePercent } = extractPercentageSplit(a);

  const hasAny =
    base != null || variable != null || equity != null || basePercent != null || variablePercent != null;
  return { base, variable, equity, basePercent, variablePercent, hasAny };
}

/** Merge a freshly-parsed breakdown with the prior session-state
 *  breakdown. Non-null fields in the new parse OVERWRITE the prior
 *  ones (candidate can revise: "actually I meant base 30 not 28").
 *  Null fields preserve the prior — a turn that names only variable
 *  doesn't wipe a previously stated base. */
export function mergeBreakdown(
  prior: ComponentBreakdown | null | undefined,
  next: ComponentBreakdown,
): ComponentBreakdown {
  const p = prior ?? EMPTY;
  const merged: ComponentBreakdown = {
    base: next.base ?? p.base,
    variable: next.variable ?? p.variable,
    equity: next.equity ?? p.equity,
    basePercent: next.basePercent ?? p.basePercent,
    variablePercent: next.variablePercent ?? p.variablePercent,
    hasAny: false,
  };
  merged.hasAny =
    merged.base != null ||
    merged.variable != null ||
    merged.equity != null ||
    merged.basePercent != null ||
    merged.variablePercent != null;
  return merged;
}

/** Human-readable summary of a breakdown for the LLM prompt SESSION
 *  CONTEXT block. Returns "" when nothing is known. */
export function summarizeBreakdown(b: ComponentBreakdown | null | undefined): string {
  if (!b || !b.hasAny) return "";
  const parts: string[] = [];
  if (b.base != null) parts.push(`base ₹${b.base} LPA`);
  if (b.variable != null) parts.push(`variable ₹${b.variable} LPA`);
  if (b.equity != null) parts.push(`equity ₹${b.equity} LPA`);
  if (b.basePercent != null && b.variablePercent != null) {
    parts.push(`split ${b.basePercent}% fixed / ${b.variablePercent}% variable`);
  }
  return parts.join(", ");
}
