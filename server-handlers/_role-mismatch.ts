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

/* Seniority modifiers — tokens that change the *level* of a role
 * without changing its domain. Promotion drift (LLM emits "Senior UX
 * Designer" when user picked "UX Designer") was the Accenture session
 * failure mode (2026-05-13): domain-token comparison treats both as
 * {ux} and lets the drift through. We compare seniority asymmetry as
 * a separate axis. */
export const SENIORITY_MODIFIERS = new Set([
  "senior", "sr", "junior", "jr", "lead", "principal", "staff",
]);

/** Returns the seniority modifier (lowercase) present in `r`, or null
 *  if none. First match wins; the modifiers above are mutually
 *  exclusive in practice. */
export function extractSeniority(r: string): string | null {
  const lower = r.toLowerCase();
  for (const m of SENIORITY_MODIFIERS) {
    const re = new RegExp(String.raw`\b${m}\b`, "i");
    if (re.test(lower)) return m === "sr" ? "senior" : m === "jr" ? "junior" : m;
  }
  return null;
}

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

  const userSeniority = extractSeniority(userRole);
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
    /* Seniority drift — domain matches, but the LLM promoted or
       demoted the candidate. "UX Designer" → "Senior UX Designer" is
       a promotion; "Senior UX Designer" → "UX Designer" is a demotion.
       Either way it misrepresents the candidate's level.
       Early-good-exit: if the first (longest, most specific) matching
       label also aligns on seniority, the text is fine — return "".
       Otherwise return the offending label. The list is sorted
       longest-first, so the first match is the most specific. */
    const labelSeniority = extractSeniority(label);
    if (labelSeniority === userSeniority) return "";
    return label;
  }
  return "";
}
