/* Shared resume period / duration parsers.
 *
 * Two analyzers (hr-round, campus-placement) independently parsed
 * resume `period` strings like "Mar 2022 – Jun 2024" — same dash
 * normalization, same year-expansion, same MONTHS map. Same regex
 * was reimplemented in both files (campus-placement returned months
 * elapsed, hr-round returned the date pair). A single source-of-truth
 * here removes the duplication and gives both call sites the same
 * edge-case coverage when this file gets a fix.
 *
 * Also exports NUM_WORDS ("six" → 6) and the duration regex used by
 * the spoken-duration cross-check ("for six months", "two years") —
 * campus-placement is the only caller today, hr-round is the obvious
 * next consumer when its v3 spoken-experience cross-check lands.
 *
 * Pure — no DB, no fetch, no analyzer state. Unit tested in
 * `src/__tests__/resumePeriod.test.ts`.
 */

/* Month-name → 0-indexed month. Covers the spellings actually seen in
 * Indian fresher resumes (full + 3-char + "sept"). Don't add fuzzier
 * variants — we'd rather miss a malformed period than fabricate a
 * date and feed a wrong drift into the analyzer. */
export const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, febr: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

/* Spelled-out numbers a candidate is likely to say when describing an
 * internship duration. Bounded at twelve — "fifteen months" is rare
 * enough that we'd rather under-detect than chase a long tail. */
export const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

/* Spoken-duration regex. Matches "for six months", "8 months", "about
 * two years", "around 3 years". Filler-word prefix is optional. The
 * caller normalizes the captured group (digit-or-word) via NUM_WORDS.
 * Stateful (g flag) — callers must reset .lastIndex before each scan. */
export const SPOKEN_DURATION_REGEX =
  /\b(?:for|about|around|nearly|roughly|some)?\s*(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(months?|years?)\b/gi;

/* Parse a resume period string to a {start, end} date pair.
 * Returns null on anything ambiguous — under-fire beats fabricate.
 *
 * Accepts:
 *   "Jan 2022 - Jun 2024"   (hyphen)
 *   "Mar 2022 – Present"    (en-dash, present)
 *   "Apr 2023 to Sep 2023"  (" to " separator)
 *   "Jan'22 - Mar'24"       (apostrophe-2-digit years)
 *   "2022 - 2024"           (bare years; defaults to Jan / Dec)
 *
 * Year-expansion cutoff: ≥50 → 19xx, else 20xx. Resume sections
 * virtually never reference pre-1975, so the cutoff is safe.
 */
export function parseResumePeriod(
  period: string | undefined | null,
): { start: Date; end: Date } | null {
  if (!period) return null;
  const norm = period
    .toLowerCase()
    .replace(/–|—/g, "-")
    .replace(/\bto\b/g, "-")
    .replace(/'(\d{2})\b/g, (_m, yy: string) => {
      const n = parseInt(yy, 10);
      return ` ${n >= 50 ? 1900 + n : 2000 + n}`;
    });
  const parts = norm.split("-").map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const parsePart = (p: string, isEnd: boolean): Date | null => {
    if (/^(present|current|now|till\s+date|ongoing)$/i.test(p)) return new Date();
    // "Jan 2022" / "January 2022" / "Sept 2022" / "2022" / "Jan. 2022"
    const mYr = /^(?:([a-z]{3,9})\.?\s+)?(\d{4})$/i.exec(p);
    if (!mYr) return null;
    const monRaw = mYr[1]?.toLowerCase();
    const year = parseInt(mYr[2], 10);
    if (year < 1990 || year > 2100) return null;
    const mon = monRaw && MONTHS[monRaw] !== undefined ? MONTHS[monRaw] : isEnd ? 11 : 0;
    return new Date(year, mon, isEnd ? 28 : 1);
  };
  const start = parsePart(parts[0], false);
  const end = parsePart(parts[parts.length - 1], true);
  if (!start || !end || end < start) return null;
  return { start, end };
}

/* Convenience derived from parseResumePeriod — returns the period
 * length in months (rounded, minimum 1). Used by the campus-placement
 * internship-duration cross-check. Returns null on anything that
 * parseResumePeriod itself can't parse. */
export function parsePeriodMonths(
  period: string | undefined | null,
): number | null {
  const range = parseResumePeriod(period);
  if (!range) return null;
  const ms = range.end.getTime() - range.start.getTime();
  return Math.max(1, Math.round(ms / (30 * 86400 * 1000)));
}
