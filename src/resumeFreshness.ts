/* Resume freshness — pure logic for the dashboard "your resume is N days
 * old · refresh" nudge (PRI-33).
 *
 * The market audit (June 2026) found competitors prompt users to refresh
 * stale resumes around the 30-day mark. We surface a dismissable strip at
 * 30 days that re-appears at 60. All timestamp/dismissal math lives here
 * so the React component is a thin renderer and the rules are unit-tested.
 *
 * Source of truth for the timestamp is `StoredResume.parsedAt` (ISO-8601),
 * stamped server-side at the resume write chokepoint. Resumes persisted
 * before that field shipped have no `parsedAt`; we return `show: false`
 * (no strip) rather than fabricate an age. */

export const RESUME_FRESHNESS_MIN_DAYS = 30;
export const RESUME_FRESHNESS_REAPPEAR_DAYS = 60;

/** localStorage key holding the last-dismissed strip state (per user device). */
export const RESUME_FRESHNESS_DISMISS_KEY = "hsx_resume_freshness_dismissed";

export interface ResumeFreshnessDismissal {
  /** The exact parsedAt the user dismissed against — a re-upload changes
   *  this and invalidates the dismissal. */
  parsedAt: string;
  /** Highest day-bucket the user dismissed (30 or 60). */
  bucket: number;
}

export interface ResumeFreshness {
  /** Whole days since parse, or null when there's no usable timestamp. */
  days: number | null;
  /** Whether the freshness strip should render now. */
  show: boolean;
  /** The threshold bucket the current age falls into: 0, 30, or 60. */
  bucket: number;
}

/** Whole days between `parsedAt` and `nowMs`. Null when absent/unparseable.
 *  Negative deltas (clock skew) clamp to 0. */
export function resumeAgeDays(parsedAt: string | null | undefined, nowMs: number): number | null {
  if (!parsedAt) return null;
  const t = Date.parse(parsedAt);
  if (!isFinite(t)) return null;
  const diff = nowMs - t;
  if (diff <= 0) return 0;
  return Math.floor(diff / 86_400_000);
}

/** The highest crossed threshold for a given age. */
export function freshnessBucket(days: number): number {
  if (days >= RESUME_FRESHNESS_REAPPEAR_DAYS) return RESUME_FRESHNESS_REAPPEAR_DAYS;
  if (days >= RESUME_FRESHNESS_MIN_DAYS) return RESUME_FRESHNESS_MIN_DAYS;
  return 0;
}

/**
 * Decide whether to show the freshness strip.
 *
 * - No parsedAt → never show (graceful back-compat).
 * - Age below 30 days → never show.
 * - Age ≥ 30 → show, UNLESS the user already dismissed *this same resume*
 *   at an equal-or-higher bucket. Dismissing at 30 hides the strip until
 *   the age crosses 60 (a higher bucket), at which point it reappears.
 *   A new upload changes parsedAt, so a stale dismissal no longer matches
 *   (and a fresh resume is 0 days old anyway).
 */
export function computeResumeFreshness(
  parsedAt: string | null | undefined,
  nowMs: number,
  dismissal: ResumeFreshnessDismissal | null,
): ResumeFreshness {
  const days = resumeAgeDays(parsedAt, nowMs);
  if (days == null) return { days: null, show: false, bucket: 0 };
  const bucket = freshnessBucket(days);
  if (bucket === 0) return { days, show: false, bucket };
  if (dismissal && dismissal.parsedAt === parsedAt && dismissal.bucket >= bucket) {
    return { days, show: false, bucket };
  }
  return { days, show: true, bucket };
}

/** Parse a persisted dismissal blob defensively (localStorage is untrusted). */
export function parseDismissal(raw: string | null): ResumeFreshnessDismissal | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (
      v &&
      typeof v === "object" &&
      typeof (v as Record<string, unknown>).parsedAt === "string" &&
      typeof (v as Record<string, unknown>).bucket === "number"
    ) {
      return { parsedAt: (v as ResumeFreshnessDismissal).parsedAt, bucket: (v as ResumeFreshnessDismissal).bucket };
    }
  } catch {
    /* corrupt blob → treat as no dismissal */
  }
  return null;
}
