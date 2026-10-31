/* Typed-by-the-candidate text shown to employers. Only text that is entirely
   upper or lower case is rewritten, so deliberate casing ("McDonald", "iOS
   Engineer", "QA Lead") is never touched. */

const SMALL_WORDS = new Set(["and", "of", "the", "for", "to", "in", "at", "de", "van", "von"]);
const KEEP_UPPER = new Set(["qa", "ui", "ux", "ai", "ml", "hr", "it", "sde", "sre", "ios", "api", "sql", "seo", "pm", "cto", "ceo", "cfo", "vp", "bi", "devops"]);

function isUniformCase(s: string): boolean {
  return /[a-z]/i.test(s) && (s === s.toUpperCase() || s === s.toLowerCase());
}

function capWord(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** "JAY VYAS" and "sufiyan sanderwale" read as typed names; "Himani" is left alone. */
export function tidyName(name: string): string {
  const s = name.trim();
  if (!isUniformCase(s)) return s;
  return s.toLowerCase().split(/(\s+|-)/).map((p) => (/^[\s-]*$/.test(p) ? p : capWord(p))).join("");
}

/** "SOFTWARE ENGINEER" and "software engineer · 1 yr" become "Software Engineer"; leading
    word of a mixed-case headline is untouched. Acronyms stay upper case. */
export function tidyRole(role: string): string {
  const s = role.trim();
  if (!isUniformCase(s)) return s;
  return s.toLowerCase().split(/(\s+)/).map((w, i) => {
    if (/^\s*$/.test(w)) return w;
    if (KEEP_UPPER.has(w)) return w.toUpperCase();
    return i > 0 && SMALL_WORDS.has(w) ? w : capWord(w);
  }).join("");
}
