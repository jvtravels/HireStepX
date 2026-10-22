/* Pure resume-text helpers shared by src/resumeParser.ts (client extraction)
 * and analyze-resume.ts (server LLM input). No Node/DOM APIs. */

export const RESUME_CHAR_CAP = 12000;

export const UNREADABLE_RESUME_MESSAGE =
  "We could not read the text in this file. This usually happens with PDFs that use custom Indian-language fonts, or scans. Export it again as a PDF from Word or Google Docs, or upload a DOCX or TXT file.";

/* Unicode-aware on purpose: \w / [A-Za-z] would treat a fully Devanagari
 * (or Tamil, Bengali, ...) resume as zero letters. Combining marks (\p{M},
 * i.e. matras and viramas) count as letter-like. */
const LETTER_LIKE = /[\p{L}\p{M}]/gu;
// U+FFFD, private-use glyphs and C0/C1 controls: what pdf.js emits when an
// embedded Indic font has no ToUnicode map.
// eslint-disable-next-line no-control-regex -- matching control chars is the point
const GARBLE = /[\uFFFD\uE000-\uF8FF\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/** True when extraction produced mostly garbage rather than language. Short
 *  inputs are never flagged here; the callers' own length gates handle those. */
export function isUnreadableResumeText(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  if (compact.length < 30) return false;
  const garbled = (compact.match(GARBLE) ?? []).length;
  const letters = (compact.match(LETTER_LIKE) ?? []).length;
  return garbled / compact.length > 0.2 || letters / compact.length < 0.3;
}

const HEADING_WORDS = new RegExp(
  "^(?:work\\s+|professional\\s+|technical\\s+|key\\s+)?(?:experience|employment|education|skills|projects?|certifications?|summary|profile|objective|achievements|awards|languages|publications|internships?|training|interests)\\b" +
    "|^(?:शिक्षा|अनुभव|कौशल|कौशल्य|परियोजना|प्रमाणपत्र|सारांश|उपलब्धि|उद्देश्य)",
  "iu",
);

function isHeadingLine(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 40) return false;
  if (HEADING_WORDS.test(t)) return true;
  const letters = t.match(/\p{L}/gu) ?? [];
  return letters.length >= 3 && t === t.toUpperCase() && t !== t.toLowerCase() && !/[.,;:]$/.test(t);
}

function cutAtLine(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const slice = text.slice(0, budget);
  const nl = slice.lastIndexOf("\n");
  return nl > budget * 0.5 ? slice.slice(0, nl) : slice;
}

/** Shrink to `cap` chars while keeping the head of EVERY section. A plain
 *  head-cut drops whole trailing sections (education, certifications, older
 *  roles); water-filling gives each section min(its size, fair share) and
 *  hands the slack of short sections to the long ones. Falls back to a
 *  line-boundary head-cut when no section headings are detectable. */
export function truncateResumeText(text: string, cap = RESUME_CHAR_CAP): { text: string; truncated: boolean } {
  if (text.length <= cap) return { text, truncated: false };

  const lines = text.split("\n");
  const sections: string[][] = [[]];
  for (const line of lines) {
    if (isHeadingLine(line) && sections[sections.length - 1].length > 0) sections.push([]);
    sections[sections.length - 1].push(line);
  }
  if (sections.length < 2) return { text: cutAtLine(text, cap), truncated: true };

  const bodies = sections.map(s => s.join("\n"));
  const budgets = new Array<number>(bodies.length).fill(0);
  // Joining adds one "\n" between sections.
  let remaining = cap - (bodies.length - 1);
  let open = bodies.map((_, i) => i);
  while (open.length > 0 && remaining > 0) {
    const share = Math.floor(remaining / open.length);
    const fits = open.filter(i => bodies[i].length - budgets[i] <= share);
    if (fits.length === 0) {
      for (const i of open) budgets[i] += share;
      break;
    }
    for (const i of fits) {
      remaining -= bodies[i].length - budgets[i];
      budgets[i] = bodies[i].length;
    }
    open = open.filter(i => !fits.includes(i));
  }
  const out = bodies.map((b, i) => cutAtLine(b, budgets[i])).join("\n");
  return { text: out.length > cap ? cutAtLine(out, cap) : out, truncated: true };
}
