/* Role-label post-processor for LLM prose in salary-negotiation turns.
 * ─────────────────────────────────────────────────────────────────────
 * Belt-and-suspenders companion to _role-mismatch.ts. Where role-mismatch
 * *detects* a drift (catalogued role substitution like "Product Designer"
 * → "UX Designer") and forces a retry, this module *fixes* the milder
 * but more frequent failure mode: the LLM keeps the role family right
 * but tacks on a seniority adjective ("Senior Product Designer") that
 * leaks from the resume context, even when the session's target role
 * is plain "Product Designer".
 *
 * Design notes:
 *   - Pure string transform. No state, no IO. Same input → same output.
 *   - We do NOT strip an adjective that is already part of the session
 *     role itself (otherwise sessions for "Senior Product Designer"
 *     would lose the "Senior").
 *   - Case-insensitive match; the replacement uses the session role's
 *     original casing.
 *   - Wired at the very end of the LLM-prose pipeline in negotiate-turn.ts
 *     so structured-field validation runs on the LLM's original text
 *     (we want to know what the LLM actually said) but the user only
 *     sees the cleaned prose.
 */

const SENIORITY_ADJECTIVES = [
  "Senior",
  "Sr.",
  "Sr",
  "Lead",
  "Principal",
  "Staff",
  "Junior",
  "Jr.",
  "Jr",
  "Associate",
];

/** Escape a string for safe use inside a RegExp pattern. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip seniority-adjective prefixes that the LLM has prepended to
 *  the session role, unless the session role itself starts with that
 *  adjective. Idempotent. */
export function enforceRoleLabel(text: string, sessionRole: string): string {
  if (!text || !sessionRole) return text;
  const trimmedRole = sessionRole.trim();
  if (!trimmedRole) return text;

  let result = text;
  for (const adj of SENIORITY_ADJECTIVES) {
    /* Skip adjectives already baked into the session role — stripping
       them would corrupt sessions like "Senior Product Designer". */
    const rolePrefixPattern = new RegExp(`^${escapeRegex(adj)}\\b`, "i");
    if (rolePrefixPattern.test(trimmedRole)) continue;

    /* Match "<adj> <sessionRole>" with whitespace between, case-insensitive.
       \b on the adjective side prevents matching "Seniority Product Designer"
       or similar. Replacement preserves the session role's original casing. */
    const pattern = new RegExp(
      `\\b${escapeRegex(adj)}\\s+${escapeRegex(trimmedRole)}\\b`,
      "gi",
    );
    result = result.replace(pattern, trimmedRole);
  }
  return result;
}
