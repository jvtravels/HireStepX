/* Pure helpers for finding a Supabase Auth user by email and classifying it.

   GoTrue's admin `?filter=` is a case-insensitive SUBSTRING match, so the raw
   result can contain other accounts ("bob@x.com" also matches "abob@x.com").
   Every caller must therefore take an exact lowercase equality match out of
   the page it gets back, and ask for a page wide enough that a few superstring
   accounts cannot push the real one off it. */

export interface AdminAuthUser {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
  app_metadata?: { provider?: unknown; providers?: unknown };
}

export type UserLookupResult =
  | { ok: true; user: AdminAuthUser | null }
  | { ok: false };

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
const EMAIL_MAX_LENGTH = 254;
const LOOKUP_PAGE_SIZE = 50;

/** Trimmed, lowercased email, or null when it is not a plausible address. */
export function normalizeAuthEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH) return null;
  if (!EMAIL_RE.test(email) || email.includes("..")) return null;
  return email;
}

function pickUserByExactEmail(users: unknown, email: string): AdminAuthUser | null {
  const list = Array.isArray(users) ? users : [];
  for (const u of list) {
    if (u && typeof u === "object" && typeof (u as AdminAuthUser).id === "string") {
      const candidate = (u as AdminAuthUser).email;
      if (typeof candidate === "string" && candidate.trim().toLowerCase() === email) return u as AdminAuthUser;
    }
  }
  return null;
}

/** `email` must already be normalised (see normalizeAuthEmail). `ok:false`
 *  means the lookup itself failed, which callers must not read as "no account". */
export async function findAuthUserByEmail(
  supabaseUrl: string,
  serviceKey: string,
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UserLookupResult> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}&page=1&per_page=${LOOKUP_PAGE_SIZE}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!res.ok) return { ok: false };
    const data: unknown = await res.json();
    const users = data && typeof data === "object" && !Array.isArray(data) ? (data as { users?: unknown }).users : data;
    return { ok: true, user: pickUserByExactEmail(users, email) };
  } catch {
    return { ok: false };
  }
}

/** Same rule AuthContext applies at login: either flag counts as verified. */
export function isEmailVerified(user: AdminAuthUser): boolean {
  return user.user_metadata?.custom_email_verified === true || !!user.email_confirmed_at;
}

/** True for accounts that only ever signed in through an OAuth provider, so
 *  there is no password to reset and no verification link to send. */
export function isOAuthOnlyUser(user: AdminAuthUser): boolean {
  const meta = user.app_metadata;
  if (!meta) return false;
  const providers = Array.isArray(meta.providers)
    ? meta.providers.filter((p): p is string => typeof p === "string")
    : typeof meta.provider === "string"
      ? [meta.provider]
      : [];
  return providers.length > 0 && !providers.includes("email");
}
