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

export function computeBreakdown(headlineLpa: number): SalaryBreakdown | null {
  if (!Number.isFinite(headlineLpa) || headlineLpa <= 0) return null;
  const base = round1(headlineLpa * 0.6);
  const variable = round1(headlineLpa * 0.2);
  const joining = round1(headlineLpa * 0.1);
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
): string | null {
  const b = computeBreakdown(headlineLpa);
  if (!b) return null;
  const cleanedLead = stripRupeeFigures((leadIn || "").trim());
  const lead = cleanedLead.length > 0
    ? (cleanedLead.endsWith(".") ? cleanedLead : cleanedLead + ".")
    : "Sure, happy to walk through the structure.";
  return `${lead} ${formatBreakdownSentence(b)} What part would you like to dig into?`;
}
