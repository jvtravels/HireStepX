// Server-owned salary breakdown templating.
//
// The LLM kept leaking placeholder numbers ("base ₹49, variable ₹49, ESOPs ₹49,
// PF ₹49") because we asked it to author the breakdown in prose. The structural
// fix: the LLM emits a `wantsBreakdown: true` flag, and the server composes the
// breakdown sentence from the band's headline using a fixed split. The LLM
// cannot leak placeholder numbers because it never writes them.
//
// Split rationale (Indian-HR convention for tech roles):
//   base       60% — recurring monthly salary
//   variable   20% — performance / bonus
//   joining    10% — joining bonus, prorated retention
//   pf         10% — PF + gratuity + benefits
//
// We round each slot independently and put the rounding residual into `pf` so
// the four slots sum exactly to the headline. Equity is intentionally omitted
// from the default breakdown — equity belongs in benefits-discussion or
// candidate-raised, not the initial structure walkthrough.

export type SalaryBreakdown = {
  base: number;
  variable: number;
  joining: number;
  pf: number;
  total: number;
};

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Optional structural component caps from the negotiation band. When the 60%
 *  base slot would exceed the band's `baseStretch` (common when variable / ESOP
 *  is a large slice of the package), quoting that base in the recap promises a
 *  fixed the company structurally won't pay — and it contradicts the
 *  counter-offer sentence, which DOES clamp to baseStretch.
 *
 *  Semantics when supplied: base is clamped to `baseStretch`; the spill is
 *  pushed into variable but only up to `variableMax` (the *ceiling* on the
 *  variable slot, not an addition to the naive 20%), and any remainder lands in
 *  joining. `pf` then absorbs the final rounding residual so the four slots
 *  still sum exactly to the headline. Joining is intentionally NOT capped — it
 *  is the overflow sink of last resort before pf.
 *
 *  Provenance / status (2026-06-15 architecture audit — Numeric Finding 4,
 *  reconciled by the unbiased Class-C review): these caps are only meaningful
 *  for a band that carries `baseStretch`/`variableMax` — i.e. the KERNEL band
 *  (`_negotiation-kernel.ts` NegotiationState.band). The current production
 *  callers (`follow-up.ts` breakdown + closing-recap templating) run on the
 *  legacy `salary-lookup` `NegotiationBand`, which has neither field, so they
 *  pass no caps and the default 60/20/10/10 split applies (already internally
 *  consistent — there is no competing baseStretch-clamped counter sentence in
 *  that path to disagree with). The parameter is therefore exercised only by
 *  unit tests today and reserved for a future kernel-path caller that adopts
 *  this templating; it is a documented optional hook, not accidental dead code. */
export type BreakdownCaps = { baseStretch?: number; variableMax?: number };

export function computeBreakdown(
  headlineLpa: number,
  caps?: BreakdownCaps,
): SalaryBreakdown | null {
  if (!Number.isFinite(headlineLpa) || headlineLpa <= 0) return null;
  let base = round1(headlineLpa * 0.6);
  let variable = round1(headlineLpa * 0.2);
  let joining = round1(headlineLpa * 0.1);

  // Honor variableMax as a true ceiling on the variable slot. For a base-heavy
  // band the naive 20% can already exceed the ceiling; clamp it down and push
  // the excess into joining BEFORE the baseStretch reallocation, so the
  // documented "ceiling on the variable slot" contract holds in both
  // directions (not just for additions from the base spill).
  if (caps?.variableMax != null && variable > caps.variableMax) {
    const excess = round1(variable - caps.variableMax);
    variable = round1(caps.variableMax);
    joining = round1(joining + excess);
  }

  // Clamp base to the band's structural fixed ceiling, reallocating the
  // residual into variable (up to variableMax) then joining. The four slots
  // still sum exactly to the headline (pf absorbs the final rounding residual).
  if (caps?.baseStretch != null && base > caps.baseStretch) {
    const spill = round1(base - caps.baseStretch);
    base = round1(caps.baseStretch);
    const variableRoom =
      caps.variableMax != null ? Math.max(0, round1(caps.variableMax - variable)) : spill;
    const toVariable = Math.min(spill, variableRoom);
    variable = round1(variable + toVariable);
    joining = round1(joining + (spill - toVariable));
  }

  // Put rounding residual in PF so the four slots sum exactly to headline.
  const pf = round1(headlineLpa - base - variable - joining);
  if (pf < 0) return null;
  return { base, variable, joining, pf, total: round1(headlineLpa) };
}

export function formatBreakdownSentence(b: SalaryBreakdown): string {
  return `Base ₹${b.base} LPA, variable ₹${b.variable} LPA, joining bonus ₹${b.joining} LPA, and PF + benefits ₹${b.pf} LPA — that adds up to ₹${b.total} LPA total.`;
}

// Strip rupee figures from prose. Used when the LLM disobeyed the
// "no rupee numbers when wantsBreakdown=true" rule. We're conservative —
// only the canonical "₹X LPA / lakh / Cr" shapes.
export function stripRupeeFigures(text: string): string {
  return text
    .replace(/₹\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|cr|crore)/gi, "the number")
    .replace(/\bthe number\s+the number\b/g, "the number");
}

// Compose the final breakdown reply. Strips any rupee numbers the LLM
// emitted, then appends the server-templated breakdown sentence and a
// gentle next-step probe.
export function composeBreakdownReply(
  leadIn: string,
  headlineLpa: number,
  caps?: BreakdownCaps,
): string | null {
  const b = computeBreakdown(headlineLpa, caps);
  if (!b) return null;
  const cleanedLead = stripRupeeFigures((leadIn || "").trim());
  const lead = cleanedLead.length > 0
    ? (cleanedLead.endsWith(".") ? cleanedLead : cleanedLead + ".")
    : "Sure, happy to walk through the structure.";
  return `${lead} ${formatBreakdownSentence(b)} What part would you like to dig into?`;
}

// ── Closing-recap templating ────────────────────────────────────────
// Used when the candidate has accepted and the AI is wrapping up. The
// load-bearing arithmetic ("base ₹A + variable ₹B + bonus ₹C = total ₹W")
// was the most trust-destroying LLM failure mode on this surface (the
// flat-breakdown bug — every component equals the headline number). The
// structural fix: the LLM writes warmth prose only; the server appends
// the recap sentence using the same 60/20/10/10 split as the breakdown
// templating. The numbers are by construction internally consistent.

export function formatClosingRecapSentence(b: SalaryBreakdown): string {
  return `Just to confirm the package: base ₹${b.base} LPA, variable ₹${b.variable} LPA, joining bonus ₹${b.joining} LPA, plus PF and benefits ₹${b.pf} LPA — total ₹${b.total} LPA CTC.`;
}

// Compose the final closing-recap reply. Strips any rupee numbers the
// LLM emitted (its recap arithmetic was the bug), then appends the
// server-templated recap sentence plus a logistics tail. The LLM's
// prose lead-in carries the warmth; the server carries the math.
//
// `noticeAlreadyProvided`: when true, the tail does NOT re-ask notice
// period (the Pine Labs T5 bug — closing recap re-asking info the
// candidate gave earlier in the session). The detector
// `notice-period-reask` will fire on the templated output otherwise.
export function composeClosingRecapReply(
  leadIn: string,
  agreedTotalLpa: number,
  opts?: { noticeAlreadyProvided?: boolean; caps?: BreakdownCaps },
): string | null {
  const b = computeBreakdown(agreedTotalLpa, opts?.caps);
  if (!b) return null;
  const cleanedLead = stripRupeeFigures((leadIn || "").trim());
  const lead = cleanedLead.length > 0
    ? (cleanedLead.endsWith(".") ? cleanedLead : cleanedLead + ".")
    : "Wonderful — really glad we landed somewhere that works for both sides.";
  const tail = opts?.noticeAlreadyProvided
    ? "I'll have HR send the formal offer letter shortly. Let me know if you have any other questions."
    : "I'll have HR send the formal offer letter shortly. What's your notice-period situation — when would you ideally start?";
  return `${lead} ${formatClosingRecapSentence(b)} ${tail}`;
}
