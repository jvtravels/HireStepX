/* TEXT-NORM-1 (2026-06-25) — recruiter-voice punctuation normalizer.
 *
 * Em/en dashes (— U+2014, – U+2013) read as "AI-generated" to an Indian-HR
 * audience: a real recruiter texting/speaking uses commas and full stops, not
 * typographic dashes. They leak into emitted text from two places at once:
 *   1. hand-authored canonical-prose / question-bank templates that literally
 *      contain "—" in their string literals, and
 *   2. the LLM restyle pass, which reintroduces them even when the template
 *      didn't have one.
 *
 * Rather than hand-edit hundreds of templates (which the LLM would undo on the
 * next turn anyway), every surface that emits recruiter-facing prose runs its
 * final text through normalizeDashes(). Single source of truth, applied at the
 * emit boundary — covers deterministic prose AND model output in one place.
 *
 * Context matters: a dash inside a NUMBER RANGE ("53–58 LPA", "₹53.2—55L") is
 * a range operator and must collapse to a hyphen, NOT a comma — "53, 58 LPA"
 * would be wrong and confusing. A dash used as a clause separator becomes a
 * comma. This mirrors the maintainer's manual copy fix (commit 1a4862a,
 * "replace em dash with comma in trust strip").
 */

const DASHES = "—–"; // em dash, en dash
const DASH_CLASS = `[${DASHES}]`;

const NUMBER_RANGE_RE = new RegExp(`(\\d)\\s*${DASH_CLASS}\\s*(\\d)`, "g");
const SPACED_SEPARATOR_RE = new RegExp(`\\s*${DASH_CLASS}\\s*`, "g");
const ANY_DASH_RE = new RegExp(DASH_CLASS, "g");

/**
 * Replace em/en dashes with HR-register punctuation.
 *
 * - `53–58`, `₹53.2—55`  → hyphenated range (`53-58`)
 * - `clause — clause`     → comma (`clause, clause`)
 * - any stray dash        → comma
 *
 * Then tidies the fallout: spaces before commas, doubled commas, and runs of
 * whitespace. Empty / nullish input passes straight through.
 */
export function normalizeDashes(text: string | null | undefined): string {
  if (!text) return text ?? "";
  return text
    // Number ranges first, so the range hyphen survives the separator pass.
    .replace(NUMBER_RANGE_RE, "$1-$2")
    // Everything else is a clause separator → comma + single trailing space.
    .replace(SPACED_SEPARATOR_RE, ", ")
    // Belt-and-suspenders: any dash the patterns above missed.
    .replace(ANY_DASH_RE, ", ")
    // Tidy: " ," → ",", ",," → ",", collapse whitespace.
    .replace(/\s+,/g, ",")
    .replace(/,(?:\s*,)+/g, ",")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
