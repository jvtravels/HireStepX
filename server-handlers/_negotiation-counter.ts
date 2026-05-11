// Server-owned counter-offer templating.
//
// Step 2 of the structural-fix series (companion to _negotiation-breakdown.ts).
// The recurring bug class: the LLM authors counter-offer numbers in prose and
// they drift — "revised offer of ₹35.3 LPA" when the highest offer already on
// the table was ₹49 LPA, or matching the candidate's ₹70 LPA target verbatim
// when our ceiling is ₹46. Regex rewriters scrub the symptoms but the model
// keeps inventing variants.
//
// New contract: the LLM emits `proposedCounter: <number>` as a typed field.
// The server validates against the band:
//   - must be >= highestOfferMade (never move backwards)
//   - must be <= maxStretch * 1.05 (5% tolerance for rounding)
//   - must be > 0 and finite
// If valid, the server templates the counter sentence and substitutes any
// rupee figure in the LLM's prose with the validated number. If invalid, the
// server falls back to the server-computed `recommendedCounter`.

export type CounterContext = {
  highestOfferMade: number | null;
  maxStretch: number;
  recommendedCounter: number | null;
};

export type CounterResolution =
  | { ok: true; counter: number; source: "llm" | "recommended" }
  | { ok: false; reason: "no-valid-counter-available" };

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function resolveCounter(
  llmProposed: number | null | undefined,
  ctx: CounterContext,
): CounterResolution {
  const ceiling = ctx.maxStretch * 1.05;
  const floor = ctx.highestOfferMade ?? 0;

  const isValid = (n: number | null | undefined): n is number =>
    typeof n === "number" && Number.isFinite(n) && n > 0 && n >= floor - 0.05 && n <= ceiling + 0.05;

  if (isValid(llmProposed)) {
    return { ok: true, counter: round1(llmProposed), source: "llm" };
  }
  if (isValid(ctx.recommendedCounter)) {
    return { ok: true, counter: round1(ctx.recommendedCounter), source: "recommended" };
  }
  return { ok: false, reason: "no-valid-counter-available" };
}

export function formatCounterSentence(counter: number, isCeiling: boolean): string {
  const tail = isCeiling
    ? "That's genuinely the top of what I can do for this role."
    : "Where does that leave us?";
  return `I've pushed for what I can — I can offer ₹${round1(counter)} LPA total CTC. ${tail}`;
}

// Replace any rupee-LPA figure in the LLM lead-in with the validated counter.
// We don't strip — we substitute — so the surrounding sentence stays
// grammatical. If the lead-in has no rupee number, return as-is.
export function substituteCounterNumber(text: string, counter: number): string {
  if (!text) return text;
  const re = /₹\s*\d+(?:\.\d+)?\s*(?:LPA|lpa|lakhs?|cr|crore)/gi;
  let replaced = false;
  const out = text.replace(re, () => {
    if (replaced) return `₹${round1(counter)} LPA`;
    replaced = true;
    return `₹${round1(counter)} LPA`;
  });
  return out;
}

// Compose the final counter-offer reply. Validates the LLM's proposed
// number, substitutes it into the prose, and appends the templated counter
// sentence if the prose didn't already include the validated figure.
export function composeCounterReply(
  leadIn: string,
  llmProposed: number | null | undefined,
  ctx: CounterContext,
): { text: string; counter: number; source: "llm" | "recommended" } | null {
  const r = resolveCounter(llmProposed, ctx);
  if (!r.ok) return null;
  const isCeiling = r.counter >= ctx.maxStretch - 0.5;
  const substituted = substituteCounterNumber(leadIn || "", r.counter).trim();
  const counterFigure = `₹${round1(r.counter)} LPA`;
  const alreadyMentions = substituted.includes(counterFigure);
  const lead = substituted.length > 0
    ? (substituted.endsWith(".") || substituted.endsWith("?") || substituted.endsWith("!") ? substituted : substituted + ".")
    : "";
  const text = alreadyMentions
    ? (lead.length > 0 ? lead : formatCounterSentence(r.counter, isCeiling))
    : `${lead ? lead + " " : ""}${formatCounterSentence(r.counter, isCeiling)}`;
  return { text, counter: r.counter, source: r.source };
}
