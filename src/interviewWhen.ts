/** The employer invite form collects a date only, which is stored as UTC midnight.
 *  Showing that instant in a local zone invents a time (5:30 am in IST), so an
 *  exact-midnight-UTC value is treated as "date only" everywhere it is shown. */
export function isDateOnlyInstant(iso: string): boolean {
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0;
}

export function formatInterviewWhen(iso: string, style: "full" | "medium" = "medium", locale = "en-IN"): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isDateOnlyInstant(iso)) return d.toLocaleDateString(locale, { dateStyle: style, timeZone: "UTC" });
  return d.toLocaleString(locale, { dateStyle: style, timeStyle: "short" });
}

/** A date-only invite is over once its whole UTC day has passed; a timed one once it starts. */
export function isInterviewPast(iso: string, now: Date = new Date()): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const end = isDateOnlyInstant(iso) ? d.getTime() + 86_400_000 : d.getTime();
  return end <= now.getTime();
}
