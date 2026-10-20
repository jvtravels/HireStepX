const INDIA_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_MS = 86_400_000;

/** Whole calendar days from today (in India) to a YYYY-MM-DD due date: 0 is today, negative is overdue. */
export function calendarDaysUntil(dueDate: string, now: number = Date.now()): number {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(due)) return Number.NaN;
  return Math.round((due - Date.parse(`${INDIA_DATE.format(now)}T00:00:00Z`)) / DAY_MS);
}
