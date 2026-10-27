/* Turns a candidate's free-text expected CTC ("24 LPA", "₹24,00,000", "20-26L")
 * into an approximate band an employer may see BEFORE unlocking, when the
 * candidate opted in. The band is centred on the stated figure and rounded so
 * the exact number is never recoverable from it. */

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Best single LPA figure in the text (the higher end of a range), or null. */
export function parseCtcLpa(text: string | null | undefined): number | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/,/g, "").replace(/[₹]|rs\.?|inr/g, " ");
  const nums: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lpa|l|k)?\b/g;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const n = Number(m[1]);
    const unit = m[2] ?? "";
    if (!Number.isFinite(n) || n <= 0) continue;
    if (/^cr/.test(unit)) nums.push((n * CRORE) / LAKH);
    else if (/^(lakh|lac|lpa|l$)/.test(unit)) nums.push(n);
    else if (unit === "k") continue;
    else if (n >= LAKH) nums.push(n / LAKH);
    else if (n >= 1) nums.push(n);
  }
  if (!nums.length) return null;
  const lpa = Math.max(...nums);
  return lpa >= 1 && lpa <= 500 ? lpa : null;
}

export function ctcBand(text: string | null | undefined): string | null {
  const lpa = parseCtcLpa(text);
  if (lpa == null) return null;
  let lo = Math.floor(lpa * 0.9);
  let hi = Math.ceil(lpa * 1.1);
  if (hi - lo < 2) { lo = Math.max(1, lo - 1); hi = lo + 2; }
  return `₹${lo}–${hi} LPA`;
}

/** Only a candidate who explicitly opted in is ever banded. */
export function sharedCtcBand(resume: Record<string, unknown> | null | undefined): string | null {
  if (!resume || resume.shareCtcBand !== true) return null;
  return ctcBand(typeof resume.expectedCtc === "string" ? resume.expectedCtc : null);
}

const DAY_MS = 86_400_000;

/** ISO timestamp of the candidate's last "still looking" confirmation; invalid or future dates are dropped. */
export function readAvailabilityConfirmedAt(v: unknown, nowMs: number): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  if (!Number.isFinite(t) || t > nowMs + DAY_MS) return null;
  return new Date(t).toISOString();
}

export const WORK_MODE_PREFS = ["onsite", "hybrid", "remote"] as const;
export type WorkModePref = (typeof WORK_MODE_PREFS)[number];

export function readWorkModePref(v: unknown): WorkModePref | null {
  return typeof v === "string" && (WORK_MODE_PREFS as readonly string[]).includes(v) ? (v as WorkModePref) : null;
}
