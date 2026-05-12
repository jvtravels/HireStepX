/* Role-label-mismatch detection shared between the static-script
 * generator (generate-questions.ts) and the kernel-turn validator
 * (_negotiate-turn-helpers.ts). Both contexts need to catch the LLM
 * substituting a different job title than the candidate selected
 * (e.g. "Senior Product Designer" when the user picked "Senior UX
 * Designer"). Keeping a single canonical list + matcher means the
 * two paths can't drift — every place we accept LLM output for a
 * salary-negotiation flow runs the same check.
 *
 * Two pieces of context to keep in mind when expanding KNOWN_ROLE_LABELS:
 *   - Longer labels MUST come before shorter ones that are their prefix,
 *     otherwise `includes("product designer")` would match "Senior
 *     Product Designer" and the longer label would never be tested.
 *     The matcher exits on first match.
 *   - The check is purely syntactic on a curated list — roles outside
 *     the list silently pass. That's intentional: a hand-curated list
 *     has zero false positives on novel role names (which is what
 *     candidates type), at the cost of false negatives on rare titles.
 *     Telemetry will surface the false negatives in production. */

export const KNOWN_ROLE_LABELS = [
  /* Designer family — order matters: "senior X designer" before "X
     designer" so the longer match wins. */
  "senior product designer", "product designer",
  "senior ux designer", "ux designer",
  "senior ui designer", "ui designer",
  "senior ui/ux designer", "ui/ux designer",
  "senior visual designer", "visual designer",
  "senior interaction designer", "interaction designer",
  /* Engineering family. */
  "senior software engineer", "software engineer",
  "senior backend engineer", "backend engineer",
  "senior frontend engineer", "frontend engineer",
  "senior full stack engineer", "full stack engineer",
  "senior devops engineer", "devops engineer",
  /* Product + data + analyst families. */
  "senior product manager", "product manager",
  "senior data scientist", "data scientist",
  "senior data analyst", "data analyst",
  "senior data engineer", "data engineer",
  /* Management. */
  "senior engineering manager", "engineering manager",
  "senior design manager", "design manager",
  "senior product marketing manager", "product marketing manager",
];

export const ROLE_STOPWORDS = new Set([
  "senior", "sr", "junior", "jr", "lead", "principal", "staff",
  "the", "a", "an", "of", "for",
]);

/* Family terms shared across role variants — "designer" is common to
 * UX, UI, product, visual, interaction designers. They count for
 * confirming the broader family but NOT for telling subfamilies apart.
 * The drift detector strips these to compare DOMAIN tokens ("ux" vs
 * "product") rather than family tokens ("designer" vs "designer"). */
const ROLE_FAMILY_TERMS = new Set([
  "designer", "engineer", "developer", "manager", "analyst",
  "scientist", "architect", "consultant", "specialist", "associate",
  "head", "director", "vp", "executive", "officer",
]);

export function tokenizeRole(r: string): string[] {
  return r
    .toLowerCase()
    .replace(/[^\w\s/]/g, " ")
    .split(/\s+/)
    .filter(t => t && !ROLE_STOPWORDS.has(t));
}

/** Returns the offending label if `text` mentions a role title from
 *  KNOWN_ROLE_LABELS whose DOMAIN tokens (after stripping role-family
 *  terms like "designer"/"engineer") differ from the user's role.
 *  Returns "" when no mismatch (or no role/text).
 *
 *  Why domain tokens, not raw shared-tokens: "Senior UX Designer" and
 *  "Senior Product Designer" share "designer" — the original algorithm
 *  treated this as a match and let the LLM substitute "Product
 *  Designer" for "UX Designer". The Lollypop session (2026-05-13)
 *  proved that's the actual failure mode: same family, different
 *  subfamily. Comparing domain tokens ("ux" vs "product") catches it. */
export function detectRoleLabelMismatch(text: string, userRole: string): string {
  if (!text || !userRole) return "";
  const userTokens = tokenizeRole(userRole);
  const userDomain = new Set(userTokens.filter(t => !ROLE_FAMILY_TERMS.has(t)));
  /* If the user only typed a generic family word ("Designer", "Engineer"),
     we can't tell drift apart — don't flag, be lenient. */
  if (userDomain.size === 0) return "";

  const lower = text.toLowerCase();
  for (const label of KNOWN_ROLE_LABELS) {
    if (!lower.includes(label)) continue;
    const labelTokens = tokenizeRole(label);
    const labelDomain = new Set(labelTokens.filter(t => !ROLE_FAMILY_TERMS.has(t)));
    if (labelDomain.size === 0) continue;
    /* Drift iff label has a domain token, AND none of the label's
       domain tokens appear in the user's domain set. */
    const sharesDomain = Array.from(labelDomain).some(t => userDomain.has(t));
    if (!sharesDomain) return label;
  }
  return "";
}
