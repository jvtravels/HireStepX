/**
 * Sector-specific closing-stage hints.
 *
 * Different Indian employer sectors close offers with materially different
 * deadline / lever framing. A GCC closing in May is referencing the
 * month-end hiring window. An early-stage startup is referencing the
 * funding-close timing. IT-services anchors to the April revision cycle.
 *
 * This helper is injected at closing-stage briefs (only fires when phase
 * is in the closing family). Returns a short, prompt-ready string. Pure. */

export type ClosingSector =
  | "gcc"
  | "startup"
  | "consulting"
  | "it-services"
  | "product-india"
  | "bfsi"
  | string;

const HINTS: Record<string, string> = {
  "gcc": "hiring window closes month-end",
  "startup": "grant size depends on funding-close timing",
  "early-stage": "grant size depends on funding-close timing",
  "consulting": "consider grade-hop vs hike",
  "it-services": "next revision cycle is April",
  "product-india": "ESOP grants tied to next funding",
  "bfsi": "March bonus cycle reference",
};

/** Return a short closing-stage hint string for (sector, tier), or null if
 *  no hint applies. tier is accepted for future calibration but is not
 *  currently used. Pure. */
export function getSectorClosingHint(
  sector: ClosingSector | null | undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tier?: string | null,
): string | null {
  if (!sector) return null;
  return HINTS[sector] ?? null;
}
