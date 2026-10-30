/* Pure pieces behind the public /openings pages. Anonymity is enforced here:
 * a role reaches the public only through toPublicOpening(), which copies a fixed
 * allowlist of fields. description, responsibilities, target_companies,
 * preferred_colleges, perks and every other free-text column are never selected
 * (PUBLIC_OPENING_SELECT) and never copied, so an employer typing their name into
 * one of those fields cannot leak it. */

export const PUBLIC_OPENING_SELECT = [
  "id", "title", "public_title", "public_summary", "location", "locations", "work_mode",
  "experience_min", "experience_max", "skills", "employment_type",
  "public_listing", "public_approved_at", "status", "stage", "due_date",
].join(",");

/** A listing hides itself this long after admin approves it, unless re-approved. */
export const OPENING_MAX_AGE_DAYS = 45;

export interface OpeningRow {
  id: string;
  title: string;
  public_title: string | null;
  public_summary: string | null;
  location: string | null;
  locations: string[] | null;
  work_mode: string | null;
  experience_min: number | null;
  experience_max: number | null;
  skills: string[] | null;
  employment_type: string | null;
  public_listing: string;
  public_approved_at: string | null;
  status: string;
  stage: string;
  due_date: string | null;
}

export interface PublicOpening {
  slug: string;
  title: string;
  summary: string;
  location: string;
  workMode: "remote" | "onsite" | "hybrid" | null;
  experienceMin: number | null;
  experienceMax: number | null;
  skills: string[];
  employmentType: string | null;
  listedAt: string;
  expiresAt: string;
}

const DAY_MS = 86_400_000;

function clean(v: string | null | undefined, max: number): string {
  return (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** The one definition of "live": both consent keys on, not closed or hired,
 *  not past its due date, and approved within the last 45 days. */
export function isLiveOpening(row: OpeningRow, now: Date = new Date()): boolean {
  if (row.public_listing !== "approved") return false;
  if (row.status === "closed" || row.stage === "hired") return false;
  if (!clean(row.public_summary, 280) || !clean(row.public_title || row.title, 120)) return false;
  if (!row.public_approved_at) return false;
  const approved = Date.parse(row.public_approved_at);
  if (Number.isNaN(approved) || now.getTime() - approved > OPENING_MAX_AGE_DAYS * DAY_MS) return false;
  if (row.due_date && row.due_date < now.toISOString().slice(0, 10)) return false;
  return true;
}

export function slugifyTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50).replace(/-+$/g, "") || "role";
}

export function openingSlug(title: string, id: string): string {
  return `${slugifyTitle(title)}-${id.replace(/-/g, "").slice(0, 8)}`;
}

/** The trailing 8 hex characters of a slug, or null when it does not end in one. */
export function openingIdPrefix(slug: string): string | null {
  const m = /-([0-9a-f]{8})$/.exec(slug);
  return m ? m[1] : null;
}

export function toPublicOpening(row: OpeningRow): PublicOpening {
  const title = clean(row.public_title || row.title, 120);
  const mode = row.work_mode === "remote" || row.work_mode === "onsite" || row.work_mode === "hybrid" ? row.work_mode : null;
  const approved = Date.parse(row.public_approved_at ?? "");
  return {
    slug: openingSlug(title, row.id),
    title,
    summary: clean(row.public_summary, 280),
    location: clean(row.location || (row.locations ?? [])[0], 60),
    workMode: mode,
    experienceMin: row.experience_min,
    experienceMax: row.experience_max,
    skills: (row.skills ?? []).map((s) => clean(s, 40)).filter(Boolean).slice(0, 8),
    employmentType: clean(row.employment_type, 20) || null,
    listedAt: new Date(approved).toISOString(),
    expiresAt: new Date(approved + OPENING_MAX_AGE_DAYS * DAY_MS).toISOString(),
  };
}

export function liveOpenings(rows: OpeningRow[], now: Date = new Date()): PublicOpening[] {
  return rows
    .filter((r) => isLiveOpening(r, now))
    .map(toPublicOpening)
    .sort((a, b) => b.listedAt.localeCompare(a.listedAt));
}

export function findOpeningBySlug(openings: PublicOpening[], slug: string): PublicOpening | null {
  return openings.find((o) => o.slug === slug) ?? null;
}

/** "2 to 4 years", "Up to 3 years", "Fresher" (0 to 1). */
export function experienceLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  const lo = min ?? 0;
  if (max == null) return lo === 0 ? "Fresher friendly" : `${lo}+ years`;
  if (max === 0 || (lo === 0 && max <= 1)) return "Fresher friendly";
  if (lo === 0) return `Up to ${max} years`;
  return lo === max ? `${lo} years` : `${lo} to ${max} years`;
}

export const WORK_MODE_LABEL: Record<"remote" | "onsite" | "hybrid", string> = { remote: "Remote", onsite: "On-site", hybrid: "Hybrid" };

/** Sign-up link that carries the role through, so the first session is for this role. */
export function practiseHref(o: Pick<PublicOpening, "title" | "skills" | "slug">): string {
  const q = new URLSearchParams({ source: "openings", role: o.title, focus: o.skills.slice(0, 3).join(",") });
  if (!o.skills.length) q.delete("focus");
  q.set("opening", o.slug);
  return `/signup?${q.toString()}`;
}
