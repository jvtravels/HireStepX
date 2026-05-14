/* Real-ish token estimator (2026-05-14).
 * ─────────────────────────────────────────────────────────────────────
 * The shipped `estimateTokens` in _session-limits.ts collapses to
 * `Math.ceil(len/4)` — a 4-chars-per-token English heuristic that
 * under-estimates code/whitespace-heavy input and over-estimates dense
 * unicode. This module is the single source of truth for token-count
 * approximation across the kernel; _session-limits delegates to it.
 *
 * If a real BPE tokenizer (gpt-tokenizer / tiktoken) is later added to
 * package.json, swap the `countTokensHeuristic` branch in `countTokens`
 * for the BPE encoder. We deliberately do NOT add a runtime dependency
 * here — the kernel's edge-runtime cold-start budget is tight and a
 * 1 MB tokenizer table doesn't earn its keep at our turn volumes.
 *
 * Pure — no IO, no clocks. */

/** Approximate a token count from raw text.
 *
 *  We combine two estimators and take their max:
 *    - char-based lower bound: ceil(len/4) — English-mix heuristic.
 *    - whitespace-aware upper bound: words * 1.3 — accounts for the
 *      "common BPE tokenizers split punctuation and subwords" effect.
 *
 *  Taking the max is intentional: under-counting tokens lets a runaway
 *  client slip past per-call ceilings, which is the worst failure mode.
 *  Over-counting at worst rejects a turn that would have been fine. */
export function countTokens(text: string | null | undefined): number {
  if (!text || typeof text !== "string" || text.length === 0) return 0;
  const lowerBound = Math.ceil(text.length / 4);
  /* `split(/\s+/)` over a non-empty trimmed string yields at least one
   * element; filter() drops empties from doubled whitespace. */
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const upperBound = Math.ceil(words * 1.3);
  return Math.max(lowerBound, upperBound, words > 0 ? 1 : 0);
}
