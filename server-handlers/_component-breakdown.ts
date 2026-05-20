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
  /** PDF#33 Move B1 (2026-05-18) — provenance flag for the variable
   *  component. When true, `variable` was computed as the total−base
   *  complement (PDF#29 Bug 1 inference), NOT explicitly disclosed.
   *  The kernel's component-probe sequencer treats inferred variables
   *  as "needs confirmation" rather than "satisfied", so the bot
   *  asks "Quick check — variable is the remaining X on that Y total?"
   *  instead of silently skipping the variable probe. Prevents the
   *  PDF#33 base → esop jump that surprised candidates whose
   *  intended message was "base IS my total, no variable".
   *
   *  Optional so existing literal constructions (tests, fixtures,
   *  legacy serialized sessions) remain valid; absence ≡ false. */
  variableInferred?: boolean;
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

/* PDF#29 Bug 1 (2026-05-18) — number-BEFORE-cue extractor.
 *
 * Real candidates phrase splits with the number ahead of the cue:
 *   "I'm currently drawing ₹12 LPA fixed"
 *   "10 LPA base + 8 LPA variable"
 *   "₹8L variable"
 * extractNumberAfter is anchored on cue→number adjacency; it misses
 * every one of these. Symmetric companion below: capture a leading
 * "₹? N (lpa|lakhs|l)? ... cue" — the unit is REQUIRED here (without
 * it the regex would over-match generic numbers in nearby text). Same
 * LPA-normalisation + sanity gates as extractNumberAfter. */
function extractNumberBefore(
  text: string,
  cuePattern: string,
): number | null {
  /* Negative lookahead `(?!\s*%)` after the unit blocks the trivial
   * "(\d+)% (cue)" form (percentage splits are handled separately).
   * The filler char class `[^.!?\n%,]` (note `%` and `,` excluded)
   * additionally blocks a *secondary* percent-split appearing between
   * the absolute number and the cue ("18 LPA, 80% fixed" must NOT bind
   * base=18 just because "fixed" follows). */
  const re = new RegExp(
    String.raw`₹?\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d+)?)\s*(lpa|lakhs?|l)\b(?!\s*%)[^.!?\n%,]{0,15}?\b${cuePattern}\b`,
    "i",
  );
  const m = re.exec(text);
  if (!m) return null;
  const raw = parseFloat(m[1].replace(/,/g, ""));
  if (!Number.isFinite(raw) || raw <= 0) return null;
  /* Unit is captured (lpa|lakhs?|l) — all of these normalize to LPA
   * directly. We don't accept crore here because nobody phrases
   * components as "0.5 crore variable" — that's a total-CTC idiom. */
  const lpa = raw;
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
   * fixed-side percentage.
   *
   * Single-sided fallback (2026-05-18 probe-loop fix): real candidates
   * disclose only one side ("80% fixed", "90% fixed for me") and let
   * the complement be implied. When only one side is tagged, derive
   * the other as 100 − x. We also accept range shapes ("80-85% fixed"),
   * binding the upper bound — same rule the target-range parser uses
   * (`targetRangePat` in _negotiation-kernel.ts).
   *
   * Sanity gates: the explicit pct must be in (0, 100] and the derived
   * complement must be ≥ 0 (so an out-of-band value like "120% fixed"
   * is rejected, not silently turned into negative variable). */
  const tagged: Array<{ side: "base" | "variable"; pct: number }> = [];
  /* Range-aware: optional "N-M%" / "N to M%" — bind upper bound (M). */
  const baseRangeRe = /(?:(\d{1,3}(?:\.\d+)?)\s*(?:[-–—]|to)\s*(\d{1,3}(?:\.\d+)?)\s*%\s*(?:of\s+)?(fixed|base|basic)|(fixed|base|basic)\s+(?:is|of|at|=)?\s*(\d{1,3}(?:\.\d+)?)\s*(?:[-–—]|to)\s*(\d{1,3}(?:\.\d+)?)\s*%)/gi;
  const varRangeRe = /(?:(\d{1,3}(?:\.\d+)?)\s*(?:[-–—]|to)\s*(\d{1,3}(?:\.\d+)?)\s*%\s*(?:of\s+)?(variable|bonus|performance)|(variable|bonus|performance)\s+(?:is|of|at|=)?\s*(\d{1,3}(?:\.\d+)?)\s*(?:[-–—]|to)\s*(\d{1,3}(?:\.\d+)?)\s*%)/gi;
  const baseRe = /(?:(\d{1,3}(?:\.\d+)?)\s*%\s*(?:of\s+)?(fixed|base|basic)|(fixed|base|basic)\s+(?:is|of|at|=)?\s*(\d{1,3}(?:\.\d+)?)\s*%)/gi;
  const varRe = /(?:(\d{1,3}(?:\.\d+)?)\s*%\s*(?:of\s+)?(variable|bonus|performance)|(variable|bonus|performance)\s+(?:is|of|at|=)?\s*(\d{1,3}(?:\.\d+)?)\s*%)/gi;
  let m: RegExpExecArray | null;
  /* Range shapes first so "80-85% fixed" doesn't get half-eaten by the
   * single-value regex (which would bind 80 as base, missing the 85). */
  const rangeSpans: Array<[number, number]> = [];
  while ((m = baseRangeRe.exec(a)) !== null) {
    const upper = parseFloat(m[2] ?? m[6]);
    if (Number.isFinite(upper)) tagged.push({ side: "base", pct: upper });
    rangeSpans.push([m.index, m.index + m[0].length]);
  }
  while ((m = varRangeRe.exec(a)) !== null) {
    const upper = parseFloat(m[2] ?? m[6]);
    if (Number.isFinite(upper)) tagged.push({ side: "variable", pct: upper });
    rangeSpans.push([m.index, m.index + m[0].length]);
  }
  const inRangeSpan = (idx: number) => rangeSpans.some(([s, e]) => idx >= s && idx < e);
  while ((m = baseRe.exec(a)) !== null) {
    if (inRangeSpan(m.index)) continue;
    const n = parseFloat(m[1] ?? m[4]);
    if (Number.isFinite(n)) tagged.push({ side: "base", pct: n });
  }
  while ((m = varRe.exec(a)) !== null) {
    if (inRangeSpan(m.index)) continue;
    const n = parseFloat(m[1] ?? m[4]);
    if (Number.isFinite(n)) tagged.push({ side: "variable", pct: n });
  }
  const baseHits = tagged.filter((t) => t.side === "base");
  const varHits = tagged.filter((t) => t.side === "variable");
  /* Both-sided: prefer the pair that sums to ~100. */
  for (const bh of baseHits) {
    for (const vh of varHits) {
      if (bh.pct > 0 && vh.pct > 0 && Math.abs(bh.pct + vh.pct - 100) <= 2) {
        return { basePercent: bh.pct, variablePercent: vh.pct };
      }
    }
  }
  /* Single-sided: derive the complement. Sanity-gate to keep the result
   * in [0, 100] on both sides. */
  if (baseHits.length > 0 && varHits.length === 0) {
    const bp = baseHits[0].pct;
    if (bp > 0 && bp <= 100) {
      return { basePercent: bp, variablePercent: Math.round((100 - bp) * 10) / 10 };
    }
  }
  if (varHits.length > 0 && baseHits.length === 0) {
    const vp = varHits[0].pct;
    if (vp > 0 && vp <= 100) {
      return { basePercent: Math.round((100 - vp) * 10) / 10, variablePercent: vp };
    }
  }
  /* Form B: "80/20" or "80:20" near a split/fixed/variable cue. */
  const ratioMatch = /(\d{1,3}(?:\.\d+)?)\s*[/:]\s*(\d{1,3}(?:\.\d+)?)[^.!?\n]{0,20}?(?:split|fixed[-\s]?variable|fixed\s+and\s+variable)/i.exec(a)
    ?? /(?:split|fixed[-\s]?variable|fixed\s+and\s+variable)[^.!?\n]{0,20}?(\d{1,3}(?:\.\d+)?)\s*[/:]\s*(\d{1,3}(?:\.\d+)?)/i.exec(a);
  if (ratioMatch) {
    const bp = parseFloat(ratioMatch[1]);
    const vp = parseFloat(ratioMatch[2]);
    if (Number.isFinite(bp) && Number.isFinite(vp) && bp > 0 && vp > 0 && Math.abs(bp + vp - 100) <= 2) {
      return { basePercent: bp, variablePercent: vp };
    }
  }
  return { basePercent: null, variablePercent: null };
}

export function extractComponentBreakdown(
  text: string,
  /* PDF#29 Bug 1 (2026-05-18) — caller may supply the candidate's known
   * total CTC. When set AND we extract a single-sided absolute split
   * (e.g. "₹12 LPA fixed" with no variable named), we derive the
   * complement = total − stated. The kernel uses this to satisfy
   * fixedVariableSplitHasBoth without re-probing. Optional to preserve
   * existing call-site signatures. */
  totalCtc?: number | null,
): ComponentBreakdown {
  if (!text) return EMPTY;
  const a = text.toLowerCase();

  /* Combined cue lookup: number-AFTER takes precedence (it matches the
   * vast majority of phrasings the corpus has historically covered).
   * When that misses, fall through to number-BEFORE for "₹12 LPA fixed"-
   * style leading-number constructions. PDF#29 Bug 1. */
  const base =
    extractNumberAfter(a, "base\\s+salary") ??
    extractNumberAfter(a, "base\\s+pay") ??
    extractNumberAfter(a, "fixed\\s+pay") ??
    extractNumberAfter(a, "fixed\\s+component") ??
    extractNumberAfter(a, "fixed") ??
    extractNumberAfter(a, "basic") ??
    extractNumberAfter(a, "base") ??
    extractNumberBefore(a, "fixed") ??
    extractNumberBefore(a, "base(?:\\s+(?:salary|pay))?") ??
    extractNumberBefore(a, "basic");

  let variable =
    extractNumberAfter(a, "performance\\s+bonus") ??
    extractNumberAfter(a, "performance\\s+pay") ??
    extractNumberAfter(a, "target\\s+bonus") ??
    extractNumberAfter(a, "variable\\s+pay") ??
    extractNumberAfter(a, "variable\\s+comp(?:onent)?") ??
    extractNumberAfter(a, "variable") ??
    extractNumberAfter(a, "incentive") ??
    extractNumberAfter(a, "bonus") ??
    extractNumberBefore(a, "variable") ??
    extractNumberBefore(a, "bonus") ??
    extractNumberBefore(a, "incentive");

  /* PDF#38 BUG-E (2026-05-20) — explicit zero-variable parse. When the
   * candidate's reply is a DEFINITIVE negation tied to a variable
   * token ("no variable", "no variable component", "zero variable",
   * "no incentive"), set variable = 0 so the nextComponentProbe gate
   * treats variable as populated and stops re-asking. Without this,
   * the planner's component cascade kept firing variable probes
   * because variable === null even after the candidate stated "no
   * variable component" — exact Flipkart/SPD repro at T6.
   *
   * Conservative by design: we only fire on an explicit variable-
   * negation token. Bare "fixed only" / "just fixed 10L" phrasings
   * are NOT enough — they're ambiguous (the candidate may simply
   * be naming what they know rather than asserting "no variable
   * exists"). The split-disambiguation test guards against this. */
  if (variable == null) {
    const NO_VARIABLE_RE =
      /\b(?:no|zero|nil|none|without\s+any|don.?t\s+(?:have|get)\s+(?:any\s+)?|doesn.?t\s+(?:have|offer)\s+(?:any\s+)?)\s+(?:variable|incentive)(?:\s+(?:pay|comp(?:onent)?|component))?\b/i;
    const HUNDRED_PCT_FIXED_RE =
      /\b(?:100\s*%?|hundred\s+percent)\s+(?:fixed|base)\b/i;
    if (NO_VARIABLE_RE.test(a) || HUNDRED_PCT_FIXED_RE.test(a)) {
      variable = 0;
    }
  }

  const equity =
    extractNumberAfter(a, "rsus?") ??
    extractNumberAfter(a, "esops?") ??
    extractNumberAfter(a, "equity\\s+grant") ??
    extractNumberAfter(a, "equity") ??
    extractNumberAfter(a, "stock\\s+(?:options?|grant)") ??
    extractNumberAfter(a, "stocks?") ??
    extractNumberAfter(a, "shares") ??
    extractNumberAfter(a, "grant");

  /* PDF#29 Bug 1: single-sided absolute split + known total → derive
   * complement. variable = total − base (or base = total − variable).
   * Guarded: result must be strictly positive AND strictly less than
   * the total so we don't fabricate a zero/negative component.
   *
   * PDF#33 Move B1 (2026-05-18) — when we compute variable as the
   * total−base complement, stamp `variableInferred = true`. Downstream
   * (nextComponentProbe) treats inferred variables as "needs
   * confirmation" instead of "satisfied", so the kernel asks the
   * candidate to verify rather than silently jumping past the topic. */
  let base2 = base;
  let variableInferred = false;
  if (totalCtc != null && totalCtc > 0) {
    if (base != null && variable == null) {
      const complement = Math.round((totalCtc - base) * 10) / 10;
      if (complement > 0 && complement < totalCtc) {
        variable = complement;
        variableInferred = true;
      }
    } else if (variable != null && base == null) {
      const complement = Math.round((totalCtc - variable) * 10) / 10;
      if (complement > 0 && complement < totalCtc) base2 = complement;
    }
  }

  const { basePercent, variablePercent } = extractPercentageSplit(a);

  const hasAny =
    base2 != null || variable != null || equity != null || basePercent != null || variablePercent != null;
  return { base: base2, variable, equity, basePercent, variablePercent, variableInferred, hasAny };
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
  /* PDF#33 Move B1 (2026-05-18) — variableInferred travels with the
   * variable value that won the merge. If `next` supplies a fresh
   * variable (explicit OR inferred), its inferred-flag wins. Otherwise
   * we inherit prior's flag along with prior's variable. */
  const variableFromNext = next.variable != null;
  const merged: ComponentBreakdown = {
    base: next.base ?? p.base,
    variable: next.variable ?? p.variable,
    equity: next.equity ?? p.equity,
    basePercent: next.basePercent ?? p.basePercent,
    variablePercent: next.variablePercent ?? p.variablePercent,
    variableInferred: variableFromNext
      ? next.variableInferred === true
      : p.variableInferred === true,
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
