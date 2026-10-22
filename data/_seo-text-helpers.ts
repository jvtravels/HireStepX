/**
 * Shared title/description truncation for <title>/<meta name="description">
 * tags. Programmatic SEO pages (questions/[slug], companies, blog) build
 * these from concatenated content fields, which routinely overshoots
 * Google's display window (~60 chars title, ~160 chars description) and
 * gets truncated mid-word in the SERP. Truncate at a word boundary here
 * instead, before the string ever reaches Metadata.
 */

export function truncateSeoText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
  return trimmed.trimEnd().replace(/[,;:—-]+$/, "");
}

const TITLE_MAX = 60;
/** Truncates `base` so `base + suffix` fits the title display window. */
export function truncateSeoTitle(base: string, suffix: string): string {
  const budget = TITLE_MAX - suffix.length;
  return `${truncateSeoText(base, budget)}${suffix}`;
}

const DESC_MAX = 160;
/** Appends `suffix` (a promotional CTA) only if it fits; drops it rather
 *  than truncating mid-sentence when the base text alone is already long. */
export function truncateSeoDescription(text: string, suffix?: string): string {
  const withSuffix = suffix ? `${text} ${suffix}` : text;
  if (withSuffix.length <= DESC_MAX) return withSuffix;
  if (text.length <= DESC_MAX) return text;
  return truncateSeoText(text, DESC_MAX);
}
