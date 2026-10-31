/* Pure role-date maths shared by the employer pages and the server handlers. */

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthIndex(token: string): number | null {
  const m = token.trim().toLowerCase().match(/^([a-z]{3})[a-z]*\.?\s+(\d{4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[1]);
    return mi < 0 ? null : Number(m[2]) * 12 + mi;
  }
  const y = token.trim().match(/^(\d{4})$/);
  return y ? Number(y[1]) * 12 : null;
}

function periodRange(period: string, now: Date): [number, number] | null {
  const parts = period.split(/\s[-–—]\s|\sto\s/i);
  if (parts.length !== 2) return null;
  const start = monthIndex(parts[0]);
  const end = /present|current|now/i.test(parts[1]) ? now.getFullYear() * 12 + now.getMonth() : monthIndex(parts[1]);
  if (start == null || end == null || end < start) return null;
  return [start, Math.max(end, start + 1)];
}

/** Months covered by "Sep 2025 – Jul 2026" / "2021 – Present"; null if unparseable. */
export function periodMonths(period: string, now = new Date()): number | null {
  const range = periodRange(period, now);
  return range ? range[1] - range[0] : null;
}

/** Total months worked, adding up the role dates with overlaps counted once. Null when no role has readable dates. */
export function roleDateMonths(experience: ReadonlyArray<{ period: string }>, now = new Date()): number | null {
  const ranges = experience.map((e) => periodRange(e.period, now)).filter((r): r is [number, number] => r != null).sort((a, b) => a[0] - b[0]);
  if (ranges.length === 0) return null;
  let total = 0;
  let [curStart, curEnd] = ranges[0];
  for (const [a, b] of ranges.slice(1)) {
    if (a <= curEnd) curEnd = Math.max(curEnd, b);
    else { total += curEnd - curStart; curStart = a; curEnd = b; }
  }
  return total + (curEnd - curStart);
}

/** "1 yr 4 mo", "7 mo"; used for per-role tenure. */
export function formatTenure(months: number): string {
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} yr${y === 1 ? "" : "s"}` : `${y} yr ${m} mo`;
}
