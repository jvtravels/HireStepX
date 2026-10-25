/* Below this, a "N+ interviews practiced" line reads as an admission of a tiny
   base rather than social proof, so the UI shows nothing instead. */
export const MIN_PUBLIC_SESSION_COUNT = 100;

/** A session only counts as "completed" once the user answered this many
    questions (the same bar the referral payout uses). */
export const COMPLETED_SESSION_MIN_QUESTIONS = 3;

/** Floor a real count to the nearest 10 for display ("120+"). Returns null
    when the number is too small to show — never inflates it. */
export function displaySessionCount(n: number): number | null {
  if (!Number.isFinite(n) || n < MIN_PUBLIC_SESSION_COUNT) return null;
  return Math.floor(n / 10) * 10;
}

/** Companies and roles are small by nature, so they use lower bars than
    sessions. Still never inflated; below the bar the card shows a dash. */
export const MIN_PUBLIC_COMPANY_COUNT = 2;
export const MIN_PUBLIC_ROLE_COUNT = 3;

/** Single digits are shown exactly ("8+"); from 10 up they floor to the
    nearest 10 so a live total does not flicker on every signup. */
export function displayCount(n: number, min: number): number | null {
  if (!Number.isFinite(n) || n < min) return null;
  return n < 10 ? n : Math.floor(n / 10) * 10;
}

export interface RawPlatformCounts {
  users: number;
  sessions: number;
  companies: number;
  jobs: number;
}

export interface PublicPlatformStats {
  userCount: number | null;
  sessionCount: number | null;
  companyCount: number | null;
  jobCount: number | null;
}

export function toPublicStats(raw: RawPlatformCounts): PublicPlatformStats {
  return {
    userCount: displayCount(raw.users, MIN_PUBLIC_SESSION_COUNT),
    sessionCount: displaySessionCount(raw.sessions),
    companyCount: displayCount(raw.companies, MIN_PUBLIC_COMPANY_COUNT),
    jobCount: raw.jobs >= MIN_PUBLIC_ROLE_COUNT ? MIN_PUBLIC_ROLE_COUNT : null,
  };
}

export function parseRawCounts(json: string | null): RawPlatformCounts | null {
  if (!json) return null;
  try {
    const v: unknown = JSON.parse(json);
    if (typeof v !== "object" || v === null) return null;
    const o = v as Record<string, unknown>;
    const keys = ["users", "sessions", "companies", "jobs"] as const;
    if (!keys.every((k) => typeof o[k] === "number" && Number.isFinite(o[k] as number))) return null;
    return { users: o.users as number, sessions: o.sessions as number, companies: o.companies as number, jobs: o.jobs as number };
  } catch {
    return null;
  }
}
