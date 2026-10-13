/* Email unsubscribe + suppression helpers (RFC 8058 one-click, CAN-SPAM,
   Gmail/Yahoo bulk-sender rules).

   Pure + dependency-injected so it is unit-testable and safe in both the edge
   runtime (Web Crypto only, no Node APIs) and the node serverless handlers.

   Two opt-out categories, deliberately small:
     marketing               lifecycle / re-engagement / upsell / digest email
     employer_notifications  matching + employer-activity alerts (candidate
                             "an employer viewed your profile", employer
                             "new strong match")
   Transactional mail (verify, reset, payment, security, deletion, reminders
   the user scheduled, interview invites) is never suppressible and never
   passes through this module.

   Tokens are stateless: `<userId>.<category>.<hmac>`; HMAC-SHA256 over a
   domain-separated message with UNSUBSCRIBE_SECRET. No expiry on purpose — an
   unsubscribe link in an old email must keep working. Fail closed: with no
   secret configured no signed link/header is produced (the footer degrades to
   the settings page) and tokens never verify. */

import type { EmailFooterOptions } from "./_email-theme";

export type EmailCategory = "marketing" | "employer_notifications";

export const EMAIL_CATEGORIES: readonly EmailCategory[] = ["marketing", "employer_notifications"];

export const CATEGORY_COLUMN: Record<EmailCategory, string> = {
  marketing: "marketing_opt_out",
  employer_notifications: "employer_notifications_opt_out",
};

/** Human wording used on the confirmation page ("…from {label} emails"). */
export const CATEGORY_LABEL: Record<EmailCategory, string> = {
  marketing: "HireStepX tips, reminders and progress",
  employer_notifications: "employer and job-match activity",
};

export const REPLY_TO = "hello@hirestepx.com";
export const UNSUBSCRIBE_MAILTO = "mailto:unsubscribe@hirestepx.com?subject=unsubscribe";

const TOKEN_DOMAIN = "hsx-unsub-v1";
const MIN_SECRET_LENGTH = 16;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isEmailCategory(v: unknown): v is EmailCategory {
  return v === "marketing" || v === "employer_notifications";
}

/** Returns "" when unset or too short to be a credible HMAC key. Never logged. */
export function getUnsubscribeSecret(): string {
  const s = (process.env.UNSUBSCRIBE_SECRET || "").trim();
  return s.length >= MIN_SECRET_LENGTH ? s : "";
}

/* ─── base64url / HMAC ─── */

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

function message(userId: string, category: EmailCategory): Uint8Array<ArrayBuffer> {
  // Copy so the buffer is typed ArrayBuffer (not SharedArrayBuffer-capable) for crypto.subtle.
  return new Uint8Array(new TextEncoder().encode(`${TOKEN_DOMAIN}|${userId}|${category}`));
}

/** Returns null (never throws) when no secret is configured or the id is not a uuid. */
export async function signUnsubscribeToken(
  userId: string,
  category: EmailCategory,
  secret: string = getUnsubscribeSecret(),
): Promise<string | null> {
  if (!secret || !UUID_RE.test(userId) || !isEmailCategory(category)) return null;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), message(userId, category));
  return `${userId.toLowerCase()}.${category}.${toB64Url(new Uint8Array(sig))}`;
}

export type VerifyResult =
  | { ok: true; userId: string; category: EmailCategory }
  | { ok: false; reason: "unconfigured" | "malformed" | "invalid" };

/** Signature check uses crypto.subtle.verify, which compares in constant time. */
export async function verifyUnsubscribeToken(
  token: string | null | undefined,
  secret: string = getUnsubscribeSecret(),
): Promise<VerifyResult> {
  if (!secret) return { ok: false, reason: "unconfigured" };
  if (!token || token.length > 256) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [userId, category, sigPart] = parts;
  if (!UUID_RE.test(userId) || !isEmailCategory(category)) return { ok: false, reason: "malformed" };
  const sig = fromB64Url(sigPart);
  if (!sig) return { ok: false, reason: "malformed" };
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), sig, message(userId.toLowerCase(), category));
  return valid ? { ok: true, userId: userId.toLowerCase(), category } : { ok: false, reason: "invalid" };
}

/* ─── Headers + footer ─── */

/** RFC 8058: an https URL plus a mailto fallback, and the one-click marker. */
export function buildUnsubscribeHeaders(url: string, mailto: string = UNSUBSCRIBE_MAILTO): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>, <${mailto}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function baseUrl(): string {
  return (process.env.APP_URL || "https://hirestepx.com").replace(/\/$/, "");
}

export async function buildUnsubscribeUrl(userId: string, category: EmailCategory): Promise<string | null> {
  const token = await signUnsubscribeToken(userId, category);
  return token ? `${baseUrl()}/api/unsubscribe?t=${encodeURIComponent(token)}` : null;
}

let warnedUnconfigured = false;

export interface MarketingEmailParts {
  /** Pass to emailShell({ footer }). */
  footer: EmailFooterOptions;
  /** Spread into the Resend request body: `{ ...parts.resend }`. */
  resend: { reply_to: string; headers: Record<string, string> };
}

/** Everything a marketing/notification send needs, per recipient. Without a
    signing secret the send still carries reply_to and a footer that points at
    the settings page, but no List-Unsubscribe header (an unsigned or fake one
    would be worse than none). */
export async function marketingEmailParts(userId: string, category: EmailCategory): Promise<MarketingEmailParts> {
  const url = await buildUnsubscribeUrl(userId, category);
  const manageUrl = `${baseUrl()}/settings`;
  if (!url) {
    if (!warnedUnconfigured) {
      warnedUnconfigured = true;
      console.warn("[unsubscribe] UNSUBSCRIBE_SECRET is unset or too short; marketing email has no one-click link");
    }
    return { footer: { marketing: true, manageUrl }, resend: { reply_to: REPLY_TO, headers: {} } };
  }
  return {
    footer: { marketing: true, manageUrl, unsubUrl: url },
    resend: { reply_to: REPLY_TO, headers: buildUnsubscribeHeaders(url) },
  };
}

/* ─── Suppression store (email_preferences) ─── */

export interface PreferenceDeps {
  supabaseUrl: string;
  serviceKey: string;
  fetchImpl?: typeof fetch;
}

export function preferenceDepsFromEnv(): PreferenceDeps {
  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

function authHeaders(deps: PreferenceDeps): Record<string, string> {
  return { apikey: deps.serviceKey, Authorization: `Bearer ${deps.serviceKey}`, "Content-Type": "application/json" };
}

/* PostgREST/Postgres codes for "table or column does not exist yet" — the
   migration is applied after the code deploys, so this must read as "nobody
   has opted out" rather than an error. */
const MISSING_SCHEMA_CODES = new Set(["PGRST205", "PGRST204", "42P01", "42703"]);

async function isMissingSchema(res: Response): Promise<boolean> {
  const body = (await res.json().catch(() => null)) as { code?: unknown } | null;
  return typeof body?.code === "string" && MISSING_SCHEMA_CODES.has(body.code);
}

const ID_CHUNK = 100;

/** Subset of `userIds` that opted out of `category`.
    - table/column missing (migration not applied): empty set, logged.
    - any other failure (5xx, auth, network, timeout): FAIL CLOSED — every id is
      returned as suppressed so a marketing run skips rather than mailing
      someone who opted out. The next cron run retries. */
export async function getSuppressedUserIds(
  deps: PreferenceDeps,
  userIds: readonly string[],
  category: EmailCategory,
): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = [...new Set(userIds.filter((id) => UUID_RE.test(id)))];
  if (ids.length === 0 || !deps.supabaseUrl || !deps.serviceKey) return out;
  const doFetch = deps.fetchImpl ?? fetch;
  const col = CATEGORY_COLUMN[category];
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK);
    try {
      const res = await doFetch(
        `${deps.supabaseUrl}/rest/v1/email_preferences?${col}=eq.true&user_id=in.(${chunk.join(",")})&select=user_id`,
        { headers: authHeaders(deps), signal: AbortSignal.timeout(8_000) },
      );
      if (res.ok) {
        const rows = (await res.json().catch(() => [])) as { user_id?: string }[];
        for (const r of Array.isArray(rows) ? rows : []) if (r.user_id) out.add(r.user_id.toLowerCase());
        continue;
      }
      if (await isMissingSchema(res)) {
        console.warn("[unsubscribe] email_preferences not available yet; treating as not suppressed");
        continue;
      }
      console.warn(`[unsubscribe] suppression lookup failed HTTP ${res.status}; skipping this batch`);
    } catch (err) {
      console.warn(`[unsubscribe] suppression lookup threw (${err instanceof Error ? err.name : "error"}); skipping this batch`);
    }
    for (const id of chunk) out.add(id.toLowerCase());
  }
  return out;
}

export async function isSuppressed(deps: PreferenceDeps, userId: string, category: EmailCategory): Promise<boolean> {
  return (await getSuppressedUserIds(deps, [userId], category)).has(userId.toLowerCase());
}

/** Drop suppressed users from a list (cron senders). Keeps order. */
export async function filterSuppressed<T extends { id: string }>(
  deps: PreferenceDeps,
  rows: readonly T[],
  category: EmailCategory,
): Promise<T[]> {
  const suppressed = await getSuppressedUserIds(deps, rows.map((r) => r.id), category);
  return suppressed.size === 0 ? [...rows] : rows.filter((r) => !suppressed.has(r.id.toLowerCase()));
}

export interface EmailPreferences {
  marketing_opt_out: boolean;
  employer_notifications_opt_out: boolean;
}

export const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = { marketing_opt_out: false, employer_notifications_opt_out: false };

/** Read-only view for the settings UI; missing table/row = nothing opted out. */
export async function getEmailPreferences(deps: PreferenceDeps, userId: string): Promise<EmailPreferences | null> {
  if (!deps.supabaseUrl || !deps.serviceKey) return null;
  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const res = await doFetch(
      `${deps.supabaseUrl}/rest/v1/email_preferences?user_id=eq.${encodeURIComponent(userId)}&select=marketing_opt_out,employer_notifications_opt_out`,
      { headers: authHeaders(deps), signal: AbortSignal.timeout(8_000) },
    );
    if (res.ok) {
      const rows = (await res.json().catch(() => [])) as Partial<EmailPreferences>[];
      return {
        marketing_opt_out: rows[0]?.marketing_opt_out === true,
        employer_notifications_opt_out: rows[0]?.employer_notifications_opt_out === true,
      };
    }
    if (await isMissingSchema(res)) return { ...DEFAULT_EMAIL_PREFERENCES };
  } catch {
    /* fall through */
  }
  return null;
}

/** Upsert one category. Returns false when it could not be recorded (including
    migration-not-applied) so callers never report a false "you're unsubscribed". */
export async function setEmailOptOut(
  deps: PreferenceDeps,
  userId: string,
  category: EmailCategory,
  optOut: boolean,
): Promise<boolean> {
  if (!deps.supabaseUrl || !deps.serviceKey || !UUID_RE.test(userId)) return false;
  const doFetch = deps.fetchImpl ?? fetch;
  try {
    const res = await doFetch(`${deps.supabaseUrl}/rest/v1/email_preferences?on_conflict=user_id`, {
      method: "POST",
      headers: { ...authHeaders(deps), Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: userId.toLowerCase(), [CATEGORY_COLUMN[category]]: optOut, updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
