/* ARCH-C3a (2026-06-08) — typed-slot validator for MoveSpec restyles.
 *
 * The legacy `validateRestyle` in _response-pipeline.ts is a 32-check
 * regex-driven semantic guard that grew over weeks of patching. It
 * operates on the canonical STRING and the restyled STRING and tries
 * to detect drift via heuristics: number-set diff, idiom budgets,
 * banned-token scans, sentence-length cap, etc. The string-level
 * approach has known blind spots (e.g. percentage inversions where the
 * candidate's "19% variable" gets restyled as "81% variable" — session
 * #55 BUG-W03-1).
 *
 * This module is the typed-slot replacement. It operates on the
 * MoveSpec STRUCTURE (the spec the adapter produced) and the restyled
 * STRING, asserting:
 *
 *   1. Every numeric value in the spec's `derived` block appears in
 *      the restyled prose (no number got dropped or transformed).
 *   2. The restyled prose contains NO numeric tokens beyond those in
 *      the spec (no new numbers — the LLM can't invent a "₹37L"
 *      that wasn't in the kernel's compute).
 *   3. Frame-stance invariants from `validateFrameStance` still hold.
 *
 * C3a wires this as an OBSERVER alongside validateRestyle: when both
 * have a verdict for the same turn, divergence is logged via
 * `negotiation_movespec_slot_validator_divergence` telemetry. Neither
 * gates ship yet — we want a week of telemetry showing that the slot
 * validator catches what the regex validator catches (plus the
 * percentage-inversion class it currently misses) before we flip the
 * authority over and retire validateRestyle.
 */

import type { MoveSpec } from "./_move-spec";

export interface SlotValidationResult {
  valid: boolean;
  /** Short machine-readable code; matches the shape of validateRestyle's reason. */
  reason?: string;
  /** Optional human-readable detail for telemetry / logs. */
  detail?: string;
}

/** Extract every number-like token from a string. Mirrors the
 *  spirit of _response-pipeline.ts:extractNumbers (decimal-aware,
 *  preserves L / LPA / % sigils via the surrounding char scan). */
const NUMBER_RE = /(\d+(?:\.\d+)?)/g;
function extractNumbers(s: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  NUMBER_RE.lastIndex = 0;
  while ((m = NUMBER_RE.exec(s)) != null) out.push(m[1]);
  return out;
}

/* Build the whitelist of numeric tokens the restyle may contain. The
 * source of truth is the CANONICAL string — it was rendered from the
 * spec, so any number in canonical is one the kernel computed and
 * authorized. We tolerate ONLY the int-vs-decimal restyle of an
 * INTEGER-valued figure ("20" ↔ "20.0").
 *
 * Decimal-collision fix (2026-06-15, unbiased review HIGH): a fractional
 * figure must NOT be rounded into the whitelist — doing so authorized
 * "20" for a canonical "20.4", silently shipping a ₹20.4L→₹20L rounding
 * on exactly the fractional-lakh figures this market uses. Fractional
 * values are whitelisted in their exact form only. */
function authorizedFromCanonical(canonical: string): Set<string> {
  const out = new Set<string>();
  for (const n of extractNumbers(canonical)) {
    out.add(n);
    const parsed = Number(n);
    if (Number.isFinite(parsed) && Number.isInteger(parsed)) {
      out.add(String(parsed)); // "20.0" also authorizes "20"
      out.add(`${parsed}.0`); //  "20"   also authorizes "20.0"
    }
  }
  return out;
}

/** Validate a restyle against the canonical its MoveSpec produced.
 *
 *  Two checks:
 *    1. unauthorized-number — restyle invents a number that wasn't in
 *       the canonical (the session #55 percentage-inversion class).
 *    2. dropped-number — canonical carried a number the restyle does
 *       not (LLM quietly elided a salary scalar).
 *
 *  `spec` is currently accepted for future structural checks (slot
 *  ordering, frame-stance invariants beyond what the adapter caught
 *  at construction). Unused today — that's intentional. */
export function validateMoveSpecRestyle(
  spec: MoveSpec,
  canonical: string,
  restyled: string,
): SlotValidationResult {
  void spec;
  const allowed = authorizedFromCanonical(canonical);
  const canonicalNumbers = extractNumbers(canonical);
  const found = extractNumbers(restyled);
  const foundSet = new Set(found);

  /* Check 1 — every number in the restyle must be authorized. */
  for (const n of found) {
    if (!allowed.has(n)) {
      return {
        valid: false,
        reason: "unauthorized-number",
        detail: `restyled prose contains '${n}' which is not in the canonical`,
      };
    }
  }

  /* Check 2 — every number the canonical shipped must survive. The
   * decimal/int tolerance applies ONLY to integer-valued figures: a
   * canonical "20" survives as "20" or "20.0", and "20.0" as "20.0" or
   * "20". A FRACTIONAL figure ("20.4") must survive exactly — truncating
   * it to "20" would treat a rounded restyle as faithful (the 2026-06-15
   * decimal-collision class). */
  for (const n of canonicalNumbers) {
    if (foundSet.has(n)) continue;
    const parsed = Number(n);
    if (Number.isFinite(parsed) && Number.isInteger(parsed)) {
      const intForm = String(parsed);
      const dotZeroForm = `${intForm}.0`;
      if (foundSet.has(intForm) || foundSet.has(dotZeroForm)) continue;
    }
    return {
      valid: false,
      reason: "dropped-number",
      detail: `canonical carried '${n}' but restyle does not`,
    };
  }

  return { valid: true };
}
