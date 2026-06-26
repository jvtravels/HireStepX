/* Pure label helper for the report hero.
 *
 * The hero prints "For {level} {role} at {company}". Joining level and role
 * unconditionally produces a redundant label when the role already carries the
 * seniority word — e.g. level "Manager" + role "Engineering Manager" rendered
 * "Manager Engineering Manager" (caught in the 2026-06-27 live staging audit).
 *
 * Rule: drop the level prefix when the role already contains it as a whole
 * word (case-insensitive). "Senior" + "Product Designer" still reads
 * "Senior Product Designer"; "Senior" + "Senior Software Engineer" collapses
 * to "Senior Software Engineer". */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatRoleWithLevel(
  level: string | null | undefined,
  role: string | null | undefined,
): string {
  const r = (role ?? "").trim();
  const l = (level ?? "").trim();
  if (!l) return r;
  if (!r) return l;
  const levelAlreadyInRole = new RegExp(`\\b${escapeRegExp(l)}\\b`, "i").test(r);
  return levelAlreadyInRole ? r : `${l} ${r}`;
}
