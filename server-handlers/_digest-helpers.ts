/* Pure helper for session-insight severity classification.
 * Unit-testable without mocking the LLM.
 */

/**
 * Severity tier for a session insight. Keep in sync with the SQL default.
 */
export function computeSeverity(opts: {
  hallucinationCount: number;
  scoreDrift: number | null;
  flagCount: number;
}): "high" | "medium" | "low" {
  if (opts.hallucinationCount > 0) return "high";
  if (typeof opts.scoreDrift === "number" && Math.abs(opts.scoreDrift) >= 10) return "high";
  if (opts.flagCount > 0) return "medium";
  return "low";
}
