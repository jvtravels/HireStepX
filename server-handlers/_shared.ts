/* Shared utilities for Vercel Edge Functions & Node.js API routes */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { consumeSessionCredit } from "./_session-credits";
import { verifyJwtLocally, importEs256VerifyKey } from "./_jwt-verify";

declare const process: { env: Record<string, string | undefined> };

/* ─── Plan Limits (single source of truth for backend) ─── */
const FREE_SESSION_LIMIT = 2;
const STARTER_WEEKLY_LIMIT = 5; // Sprint Pack: 5 sessions per 30-day pack
const PRO_MONTHLY_LIMIT = 40;

/** Timeout for Supabase auth/profile verification requests (ms) */
const SUPABASE_TIMEOUT_MS = 5000;
/** TTL for atomic in-flight session counter (seconds) */
const INFLIGHT_TTL_SEC = 300;

/* ─── CORS ─── */

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);

/** Resolve allowed CORS origin from a raw origin string. Returns empty string if not allowed. */
export function getAllowedOriginFromString(origin: string): string {
  if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) return origin;
  if (isAllowedDomain(origin)) return origin;
  return "";
}

/** Resolve allowed CORS origin from a Request's Origin header. */
export function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("origin") || "";
  return getAllowedOriginFromString(origin);
}

/** Build CORS response headers for an Edge Function request.
 *
 * Pass `allowGet: true` for endpoints that accept GET requests (e.g. credit-
 * balance) so the Allow-Methods header matches the actual method list.
 * Omitting it (or passing false) keeps the default POST-only list. */
export function corsHeaders(req: Request, opts?: { allowGet?: boolean }): Record<string, string> {
  const origin = getAllowedOrigin(req);
  const methodList = opts?.allowGet ? "GET, POST, OPTIONS" : "POST, OPTIONS";
  if (!origin) return { "Content-Type": "application/json" };
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methodList,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

/** Handle OPTIONS preflight and reject disallowed methods. Returns Response if handled, null if should continue. */
export function handleCorsPreflightOrMethod(req: Request, opts?: { allowGet?: boolean }): Response | null {
  const methodList = opts?.allowGet ? "GET, POST, OPTIONS" : "POST, OPTIONS";
  if (req.method === "OPTIONS") {
    const origin = getAllowedOrigin(req);
    return new Response(null, {
      status: 204,
      headers: origin
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Methods": methodList,
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Vary": "Origin",
          }
        : {},
    });
  }
  const allowed = req.method === "POST" || (opts?.allowGet === true && req.method === "GET");
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

/* ─── Auth ─── */

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

/* ─── Local JWT verification (JWKS) ───────────────────────────────────────
 *
 * Supabase issues asymmetric ES256 JWTs with a published JWKS. We verify the
 * signature + claims locally (Web Crypto) so the common case — a valid token —
 * never round-trips to /auth/v1/user. That round-trip, fired concurrently by
 * the several authed calls an interview makes at session start, was getting
 * rate-limited/timed-out and surfacing as spurious 401s on record-session-
 * start / follow-up. See _jwt-verify.ts for the full story + safety contract:
 * local verify only ever produces a fast positive; everything else defers to
 * the network introspection below, so there is no security regression. */

const JWKS_TTL_MS = 10 * 60 * 1000;
const JWKS_NEGATIVE_REFETCH_MS = 30 * 1000;
let jwksCache: { keys: Map<string, CryptoKey>; fetchedAt: number } | null = null;
let jwksInflight: Promise<Map<string, CryptoKey> | null> | null = null;

async function fetchJwksKeys(): Promise<Map<string, CryptoKey> | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), SUPABASE_TIMEOUT_MS);
    const res = await fetch(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = (await res.json()) as { keys?: JsonWebKey[] };
    if (!body || !Array.isArray(body.keys)) return null;
    const keys = new Map<string, CryptoKey>();
    for (const jwk of body.keys) {
      const kid = (jwk as { kid?: string }).kid;
      if (!kid) continue;
      const key = await importEs256VerifyKey(jwk);
      if (key) keys.set(kid, key);
    }
    return keys;
  } catch {
    return null;
  }
}

/** Resolve a JWKS verify key by `kid`, with module-level caching and a single
 * bounded refetch when an unknown kid appears (key rotation). Returns null when
 * the key can't be resolved — callers must treat that as "defer to network". */
async function resolveJwksKey(kid: string): Promise<CryptoKey | null> {
  if (!SUPABASE_URL) return null;
  const now = Date.now();

  if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    const cached = jwksCache.keys.get(kid);
    if (cached) return cached;
    // Fresh-ish cache but unknown kid → possible rotation. Allow one refetch,
    // throttled so a barrage of forged kids can't hammer the JWKS endpoint.
    if (now - jwksCache.fetchedAt < JWKS_NEGATIVE_REFETCH_MS) return null;
  }

  if (!jwksInflight) {
    jwksInflight = fetchJwksKeys().then((keys) => {
      if (keys) jwksCache = { keys, fetchedAt: Date.now() };
      jwksInflight = null;
      return keys;
    });
  }
  const keys = await jwksInflight;
  return keys ? keys.get(kid) ?? null : null;
}

/** Verify the user's JWT token against Supabase Auth. Returns userId if valid.
 *
 * Distinguishes between three failure classes so we don't bounce users mid-
 * session during a Supabase incident:
 *   - Permanent auth failure (401/403, invalid token) → authenticated:false
 *   - Transient infrastructure failure (5xx, network, timeout) → retry once
 *     with backoff, then surface as authenticated:false but log loudly so it
 *     shows up in Vercel logs as `[verifyAuth] transient` for triage.
 * Without this distinction, a single Supabase Auth blip cascades into 401s
 * across the whole app and users lose interviews mid-flow. */
export async function verifyAuth(req: Request): Promise<{ authenticated: boolean; userId?: string }> {
  // Fail closed in production — only skip auth in local dev.
  // M-1: gate the localhost fast-path on NODE_ENV so a misconfigured prod
  // deploy with missing Supabase env vars can't be bypassed by spoofing an
  // Origin: http://localhost:XXXX header (valid in curl, scripts, non-browser
  // contexts where the browser enforces no Origin-forgery restrictions).
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const isLocal = (req.headers.get("origin") || "").startsWith("http://localhost:");
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — process.env available in both Node and edge (WinterCG)
    if (isLocal && (typeof process === "undefined" || process.env.NODE_ENV !== "production")) {
      return { authenticated: true };
    }
    return { authenticated: false };
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { authenticated: false };
  }

  const token = authHeader.slice(7);

  // Fast path: verify the ES256 token locally against Supabase's JWKS. Only a
  // fully valid token short-circuits here; anything else falls through to the
  // network introspection below (see _jwt-verify.ts safety contract).
  const local = await verifyJwtLocally(token, {
    resolveKey: resolveJwksKey,
    now: Math.floor(Date.now() / 1000),
    issuer: `${SUPABASE_URL}/auth/v1`,
  });
  if (local.kind === "ok") return { authenticated: true, userId: local.userId };

  const tryOnce = async (): Promise<{ kind: "ok"; userId: string } | { kind: "auth-fail" } | { kind: "transient"; reason: string }> => {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), SUPABASE_TIMEOUT_MS);
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SUPABASE_ANON_KEY,
        },
        signal: ac.signal,
      });
      clearTimeout(timer);
      // 401/403 = bad/expired token. 5xx = Supabase incident.
      if (res.status === 401 || res.status === 403) return { kind: "auth-fail" };
      if (res.status >= 500 && res.status <= 599) return { kind: "transient", reason: `HTTP ${res.status}` };
      // 408 Request Timeout / 429 Too Many Requests are load/infra signals, not
      // a verdict on the token — treat as transient so a burst of authed calls
      // at session start can't turn a valid token into a spurious 401.
      if (res.status === 408 || res.status === 429) return { kind: "transient", reason: `HTTP ${res.status}` };
      if (!res.ok) return { kind: "auth-fail" };
      const user = await res.json();
      if (!user.id || typeof user.id !== "string") return { kind: "auth-fail" };
      return { kind: "ok", userId: user.id };
    } catch (err) {
      // Network errors, timeouts, DNS failures — all transient.
      const msg = err instanceof Error ? err.message : String(err);
      return { kind: "transient", reason: msg.slice(0, 100) };
    }
  };

  let result = await tryOnce();
  if (result.kind === "transient") {
    console.warn(`[verifyAuth] transient (attempt 1): ${result.reason} — retrying after 500ms`);
    await new Promise((r) => setTimeout(r, 500));
    result = await tryOnce();
  }

  if (result.kind === "ok") return { authenticated: true, userId: result.userId };
  if (result.kind === "transient") {
    // Both attempts hit transient errors. Surface as not authed (we cannot
    // grant access without verification) but log loudly so ops see the
    // pattern during a Supabase incident.
    console.error(`[verifyAuth] transient after retry: ${result.reason}`);
  }
  return { authenticated: false };
}

/** Return a 401 Unauthorized JSON response. */
export function unauthorizedResponse(headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized. Please log in." }), {
    status: 401,
    headers,
  });
}

/* ─── Atomic In-Flight Session Counter (prevents race condition) ─── */

const UPSTASH_URL_SHARED = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN_SHARED = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

async function incrementInFlightCounter(userId: string, tier: string, ttlSec: number): Promise<number | null> {
  if (!UPSTASH_URL_SHARED || !UPSTASH_TOKEN_SHARED) return null;
  try {
    const key = `inflight:${tier}:${userId}`;
    const res = await fetch(`${UPSTASH_URL_SHARED}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN_SHARED}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, ttlSec]]),
    });
    if (res.ok) {
      const results = await res.json();
      return (results[0]?.result ?? 1) - 1; // subtract 1 because INCR includes current request
    }
    return null;
  } catch { return null; }
}

/* ─── Session Limit Check ─── */

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Check if a user has exceeded their plan's session limit. Uses atomic in-flight counter to prevent race conditions. */
export async function checkSessionLimit(
  userId: string,
  opts?: { consumeCredit?: boolean; tier?: string },
): Promise<{ allowed: boolean; reason?: string }> {
  // Only session-START callers spend a credit / take an in-flight slot. End-of-
  // session callers (evaluate) pass consumeCredit:false so scoring a session the
  // user already started and paid for cannot spend a SECOND credit. Default true.
  const consumeCredit = opts?.consumeCredit !== false;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return { allowed: true }; // skip in dev

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), SUPABASE_TIMEOUT_MS);
    // Get user's subscription tier and expiry
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_tier,subscription_start,subscription_end,sessions_started_lifetime`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }, signal: ac.signal },
    );
    if (!profileRes.ok) {
      clearTimeout(timer);
      // Retry once on transient Supabase 5xx errors so paid users aren't locked out during incidents.
      // On persistent failure, fail-open (same behaviour as checkLLMQuota) unless SESSION_LIMIT_FAIL_CLOSED=1.
      if (profileRes.status >= 500) {
        console.warn("Session limit check: profile fetch 5xx, retrying once", profileRes.status);
        try {
          const ac2 = new AbortController();
          const timer2 = setTimeout(() => ac2.abort(), SUPABASE_TIMEOUT_MS);
          const retryRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_tier,subscription_end`,
            { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }, signal: ac2.signal },
          );
          clearTimeout(timer2);
          if (!retryRes.ok) {
            const failClosed = process.env.SESSION_LIMIT_FAIL_CLOSED === "1";
            console.error("Session limit check: retry also failed", retryRes.status, failClosed ? "(fail-closed)" : "(fail-open)");
            return failClosed ? { allowed: false, reason: "Could not verify session limit. Please try again." } : { allowed: true };
          }
          const retryProfiles = await retryRes.json();
          if (!Array.isArray(retryProfiles) || retryProfiles.length === 0) {
            const failClosed = process.env.SESSION_LIMIT_FAIL_CLOSED === "1";
            return failClosed ? { allowed: false, reason: "Could not verify session limit. Please try again." } : { allowed: true };
          }
          // Continue with retry response — replace profileRes context
          let tier = retryProfiles[0].subscription_tier || "free";
          const subEnd = retryProfiles[0].subscription_end;
          if (tier !== "free" && subEnd && new Date(subEnd) < new Date()) tier = "free";
          if (tier === "team" || tier === "pro" || tier === "starter") return { allowed: true };
          return { allowed: true }; // fail-open for free on transient error
        } catch {
          const failClosed = process.env.SESSION_LIMIT_FAIL_CLOSED === "1";
          return failClosed ? { allowed: false, reason: "Could not verify session limit. Please try again." } : { allowed: true };
        }
      }
      console.error("Session limit check: profile fetch failed", profileRes.status);
      return { allowed: false, reason: "Could not verify session limit. Please try again." };
    }
    const profiles = await profileRes.json();
    if (!Array.isArray(profiles) || profiles.length === 0) { clearTimeout(timer); return { allowed: false, reason: "Could not verify session limit. Please try again." }; }

    let tier = profiles[0].subscription_tier || "free";
    const subEnd = profiles[0].subscription_end;

    // Check expiry — treat expired paid tiers as free
    if (tier !== "free" && subEnd && new Date(subEnd) < new Date()) {
      tier = "free";
    }

    if (tier === "team") { clearTimeout(timer); return { allowed: true }; }

    if (tier === "pro") {
      // Pro: 40 sessions per month
      const now2 = new Date();
      const monthStart = new Date(Date.UTC(now2.getUTCFullYear(), now2.getUTCMonth(), 1));
      const monthISO = monthStart.toISOString();
      const sessionsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(monthISO)}&select=id`,
        { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: "count=exact" }, signal: ac.signal },
      );
      clearTimeout(timer);
      if (!sessionsRes.ok) { console.error("Session limit check: sessions fetch failed", sessionsRes.status); return { allowed: false, reason: "Could not verify session limit. Please try again." }; }
      const range = sessionsRes.headers.get("content-range");
      const thisMonth = range ? parseInt(range.split("/")[1] || "0", 10) : ((await sessionsRes.json()) as unknown[]).length;
      if (thisMonth >= PRO_MONTHLY_LIMIT) {
        // Exhausted Pro monthly allotment — allow only if the user holds a
        // purchased session credit (same credit ledger as free-tier top-ups).
        // End-of-session callers pass consumeCredit:false — the credit was
        // already spent at session start, so scoring must not spend a second one.
        if (!consumeCredit) return { allowed: true };
        const consumed = await consumeSessionCredit(SUPABASE_URL, SERVICE_ROLE_KEY, userId);
        if (!consumed) {
          return { allowed: false, reason: `Pro plan limit reached (${PRO_MONTHLY_LIMIT} sessions/month). Buy session credits or wait for next month.` };
        }
        return { allowed: true };
      }
      // Atomic in-flight check: prevent race where two concurrent session starts
      // both read thisMonth < PRO_MONTHLY_LIMIT and both slip through.
      if (consumeCredit) {
        const inFlight = await incrementInFlightCounter(userId, "pro", INFLIGHT_TTL_SEC);
        if (inFlight !== null && thisMonth + inFlight > PRO_MONTHLY_LIMIT) {
          return { allowed: false, reason: `Pro plan limit reached (${PRO_MONTHLY_LIMIT} sessions/month). Buy session credits or wait for next month.` };
        }
      }
      return { allowed: true };
    }

    if (tier === "free") {
      // Count total sessions at DB level
      const sessionsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodeURIComponent(userId)}&select=id`,
        { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: "count=exact" }, signal: ac.signal },
      );
      clearTimeout(timer);
      if (!sessionsRes.ok) { console.error("Session limit check: sessions fetch failed", sessionsRes.status); return { allowed: false, reason: "Could not verify session limit. Please try again." }; }
      // Use content-range header for count (more efficient than parsing all rows)
      const range = sessionsRes.headers.get("content-range");
      const totalCount = range ? parseInt(range.split("/")[1] || "0", 10) : ((await sessionsRes.json()) as unknown[]).length;

      // Monotonic lifetime counter (audit P0-2): deleting sessions reduces the
      // live row count but not this column, so a free user can't reset their
      // allotment by deleting history. Gate on the high-water mark. Falls back
      // to the row count when the column is absent (pre-migration deploys).
      const lifetimeStarted = typeof profiles[0].sessions_started_lifetime === "number"
        ? profiles[0].sessions_started_lifetime
        : null;
      const effectiveCount = lifetimeStarted !== null ? Math.max(lifetimeStarted, totalCount) : totalCount;

      if (effectiveCount >= FREE_SESSION_LIMIT) {
        // Past the free allotment — allow only if the user holds a purchased
        // session credit, and spend it now (one credit = one session start).
        // Credits live in the service-role-only session_credits ledger.
        // End-of-session callers (evaluate) pass consumeCredit:false: the credit
        // was already spent at session start, so scoring must not spend a SECOND
        // one. They are allowed through unconditionally (the session already ran).
        if (!consumeCredit) return { allowed: true };
        const consumed = await consumeSessionCredit(SUPABASE_URL, SERVICE_ROLE_KEY, userId);
        if (!consumed) {
          return { allowed: false, reason: `Free plan limit reached (${FREE_SESSION_LIMIT} sessions). Buy a session for ₹9 or upgrade.` };
        }
        return { allowed: true };
      }
      if (effectiveCount < FREE_SESSION_LIMIT && consumeCredit) {
        // Atomic in-flight check: prevent race condition with concurrent session
        // STARTS. Skipped for end-of-session callers — they must not take a slot.
        const inFlight = await incrementInFlightCounter(userId, "free", INFLIGHT_TTL_SEC);
        if (inFlight !== null && effectiveCount + inFlight > FREE_SESSION_LIMIT) {
          return { allowed: false, reason: `Free plan limit reached (${FREE_SESSION_LIMIT} sessions). Upgrade to continue.` };
        }
      }
    } else if (tier === "starter") {
      // Count sessions since pack purchase (subscription_start) at DB level.
      // Sprint Pack grants 5 sessions within a 30-day validity window —
      // no weekly reset; the counter runs from the day the pack was bought.
      const packStart = profiles[0].subscription_start;
      if (!packStart) {
        // subscription_start missing for a starter user — data integrity gap (partial
        // webhook failure, manual account creation). Fail-open so the user isn't
        // blocked from the sessions they paid for; log for investigation.
        console.error("[checkSessionLimit] starter profile missing subscription_start", { userId });
        clearTimeout(timer);
        return { allowed: true };
      }

      // H-6: guard against a tampered or corrupted subscription_start that was
      // moved back in time. A start date more than 8 days ago would make
      // all sessions appear outside the current pack window and allow unlimited
      // re-use across pack renewals. Clamp to now minus 8 days at most —
      // the window is strictly the 7-day validity of the purchased pack.
      const packStartMs = new Date(packStart).getTime();
      const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
      if (!Number.isFinite(packStartMs) || packStartMs < Date.now() - eightDaysMs) {
        console.error("[checkSessionLimit] starter subscription_start is invalid or too far in the past", { userId, packStart });
        // Fail-closed: a clearly wrong start date is a data integrity problem;
        // require the user to contact support rather than silently granting access.
        clearTimeout(timer);
        return { allowed: false, reason: "Your subscription date could not be verified. Please contact support@hirestepx.com." };
      }

      const packStartISO = new Date(packStart).toISOString();
      const sessionsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(packStartISO)}&select=id`,
        { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: "count=exact" }, signal: ac.signal },
      );
      clearTimeout(timer);
      if (!sessionsRes.ok) { console.error("Session limit check: sessions fetch failed", sessionsRes.status); return { allowed: false, reason: "Could not verify session limit. Please try again." }; }
      const range = sessionsRes.headers.get("content-range");
      const thisPack = range ? parseInt(range.split("/")[1] || "0", 10) : ((await sessionsRes.json()) as unknown[]).length;
      if (thisPack >= STARTER_WEEKLY_LIMIT) {
        // Exhausted Sprint Pack allotment — allow only if the user holds a
        // purchased session credit. Same pattern as free and pro tiers.
        if (!consumeCredit) return { allowed: true };
        const consumed = await consumeSessionCredit(SUPABASE_URL, SERVICE_ROLE_KEY, userId);
        if (!consumed) {
          return { allowed: false, reason: `Sprint Pack limit reached (${STARTER_WEEKLY_LIMIT} sessions). Buy more session credits to continue.` };
        }
        return { allowed: true };
      }
      // Atomic in-flight check: prevent race where two concurrent session starts
      // both read thisPack < STARTER_WEEKLY_LIMIT and both slip through.
      if (consumeCredit) {
        const inFlight = await incrementInFlightCounter(userId, "starter", INFLIGHT_TTL_SEC);
        if (inFlight !== null && thisPack + inFlight > STARTER_WEEKLY_LIMIT) {
          return { allowed: false, reason: `Sprint Pack limit reached (${STARTER_WEEKLY_LIMIT} sessions). Buy more session credits to continue.` };
        }
      }
    } else {
      clearTimeout(timer);
    }

    return { allowed: true };
  } catch (err) {
    console.error("Session limit check error:", err);
    return { allowed: false, reason: "Could not verify session limit. Please try again." };
  }
}

/* ─── Prior Negotiation Count (repeat-session freshness) ─── */

/** Count this user's prior salary-negotiation sessions. Used by the
 *  scenario-seed layer to rotate the recruiter tone across sessions so a
 *  returning user doesn't face the identical recruiter every time.
 *
 *  Fail-open: returns 0 on any missing-env / timeout / non-2xx / parse
 *  failure. A wrong count only changes WHICH plausible recruiter tone
 *  the user gets — never correctness — so a DB blip must never block or
 *  delay session start. Mirrors checkSessionLimit's REST + content-range
 *  pattern. */
export async function countPriorNegotiationSessions(userId: string): Promise<number> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return 0; // dev / unconfigured
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), SUPABASE_TIMEOUT_MS);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodeURIComponent(userId)}&type=eq.salary-negotiation&select=id`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, Prefer: "count=exact" }, signal: ac.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return 0;
    const range = res.headers.get("content-range");
    if (range) {
      const total = parseInt(range.split("/")[1] || "0", 10);
      return Number.isFinite(total) && total >= 0 ? total : 0;
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

/** Read this user's prior salary-negotiation companies, oldest → newest.
 *  Feeds the cross-session persona ledger: the scenario-seed layer
 *  reconstructs the recruiter tones actually served by replaying the
 *  deterministic seed over these companies' tiers, then picks the
 *  least-recently-seen tone for the new session. "Reuse existing
 *  sessions" — reads only the already-persisted `target_company` column;
 *  no new table, no write path.
 *
 *  Fail-open: returns [] on any missing-env / timeout / non-2xx / parse
 *  failure. A missing ledger only weakens anti-repetition back to the
 *  count-modulo rotation — never blocks or delays session start. Capped
 *  at the most recent `limit` sessions (returned ascending) since only
 *  the recent tail matters for "don't repeat what they just saw". */
export async function readPriorNegotiationCompanies(
  userId: string,
  limit = 40,
): Promise<string[]> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return []; // dev / unconfigured
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), SUPABASE_TIMEOUT_MS);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodeURIComponent(userId)}&type=eq.salary-negotiation&select=target_company,created_at&order=created_at.desc&limit=${encodeURIComponent(String(limit))}`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }, signal: ac.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows)) return [];
    // Fetched newest-first (so the cap keeps the recent tail); the
    // reconstruction wants chronological order, so reverse to ascending.
    return rows
      .reverse()
      .map((r) => (r && typeof r.target_company === "string" ? r.target_company : ""));
  } catch {
    return [];
  }
}

/* ─── Subscription Tier Check ─── */

/** Get the user's current subscription tier, accounting for expiry. Returns "pro" in dev mode. */
export async function getSubscriptionTier(userId: string): Promise<"free" | "starter" | "pro" | "team"> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return "pro"; // dev mode — unrestricted

  // One profile lookup attempt. Distinguishes transient (5xx / network / timeout
  // -> retry once) from definitive (2xx, or 4xx like a real not-found -> trust
  // the answer). Mirrors the transient-vs-permanent handling in verifyAuth so a
  // Supabase blip never silently downgrades a paying user and 403s their save.
  const attempt = async (): Promise<{ tier: "free" | "starter" | "pro" | "team"; transient: boolean }> => {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), SUPABASE_TIMEOUT_MS);
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_tier,subscription_end`,
        { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }, signal: ac.signal },
      );
      clearTimeout(timer);
      if (!res.ok) return { tier: "free", transient: res.status >= 500 };
      const profiles = await res.json();
      if (!Array.isArray(profiles) || profiles.length === 0) return { tier: "free", transient: false };
      let tier = (profiles[0].subscription_tier || "free") as "free" | "starter" | "pro" | "team";
      const subEnd = profiles[0].subscription_end;
      if (tier !== "free" && subEnd && new Date(subEnd) < new Date()) tier = "free";
      return { tier, transient: false };
    } catch {
      return { tier: "free", transient: true }; // network error / abort
    }
  };

  const first = await attempt();
  if (!first.transient) return first.tier;
  return (await attempt()).tier;
}

/* ─── CSRF Origin Validation ─── */

/** Validate that the request origin is in the allowlist. Returns false for missing origins. */
export function validateOrigin(req: Request): boolean {
  const origin = req.headers.get("origin") || "";
  if (!origin) {
    // GET requests from same-origin may not include Origin header — allow if Referer matches
    const referer = req.headers.get("referer") || "";
    if (referer && isAllowedDomain(referer)) return true;
    return false;
  }
  if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) return true;
  if (isAllowedDomain(origin)) return true;
  return false;
}

/** Check if a URL/origin belongs to an allowed domain */
function isAllowedDomain(urlOrOrigin: string): boolean {
  if (urlOrOrigin.startsWith("http://localhost:")) return true;
  try {
    const hostname = urlOrOrigin.includes("://") ? new URL(urlOrOrigin).hostname : urlOrOrigin;
    // Allow *.hirestepx.com subdomains
    if (hostname === "hirestepx.com" || hostname.endsWith(".hirestepx.com")) return true;
    // Allow this project's specific Vercel deployment (VERCEL_URL is set automatically per-deployment).
    // We intentionally do NOT allow all *.vercel.app — that would let any Vercel tenant call our API.
    const vercelUrl = process.env.VERCEL_URL; // e.g. "hirestepx-git-main-xyz.vercel.app"
    if (vercelUrl && hostname === vercelUrl) return true;
  } catch { /* invalid URL */ }
  return false;
}

/* ─── Rate Limiting (Upstash Redis with in-memory fallback) ─── */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const useRedis = !!(UPSTASH_URL && UPSTASH_TOKEN);

// In-memory fallback (for local dev or if Redis not configured)
// LIMITATION: In-memory rate limiting does not share state across serverless invocations.
// Each cold start gets a fresh map, so limits are per-instance only. Use Redis (Upstash) in production.
const rateLimitMaps = new Map<string, Map<string, { count: number; reset: number }>>();

function inMemoryRateLimit(ip: string, bucket: string, limit: number, windowMs: number): boolean {
  if (!rateLimitMaps.has(bucket)) rateLimitMaps.set(bucket, new Map());
  const map = rateLimitMaps.get(bucket)!;
  const now = Date.now();
  const entry = map.get(ip);
  if (!entry || now > entry.reset) {
    map.set(ip, { count: 1, reset: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

async function redisRateLimit(ip: string, bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const key = `rl:${bucket}:${ip}`;
  try {
    // INCR + EXPIRE via Upstash REST API (single pipeline)
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, windowSec]]),
    });
    if (!res.ok) return inMemoryRateLimit(ip, bucket, limit, windowSec * 1000);
    const results = await res.json();
    const count = results[0]?.result ?? 1;
    return count > limit;
  } catch {
    // Redis down — fall back to in-memory
    return inMemoryRateLimit(ip, bucket, limit, windowSec * 1000);
  }
}

/* ─── Generic Redis kv (Upstash REST) ───────────────────────────────
 * Best-effort cache helpers for response memoization. Returns null on any
 * failure (Redis down, network blip, malformed JSON) so callers can fall
 * through to the live path without try/catch noise. */

export async function redisGet(key: string): Promise<string | null> {
  if (!useRedis) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.result === "string" ? data.result : null;
  } catch { return null; }
}

export async function redisSetEx(key: string, ttlSec: number, value: string): Promise<void> {
  if (!useRedis) return;
  try {
    await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([["SET", key, value, "EX", ttlSec]]),
    });
  } catch { /* swallow — caching is best-effort */ }
}

/** Atomically INCRBY a counter and set TTL on first write. Returns the new
 * counter value, or `null` when Redis is unavailable (caller should fail open).
 * Used for per-user spend / cost circuit breakers — see sarvam-tts.ts. */
export async function redisIncrByWithExpiry(key: string, by: number, ttlSec: number): Promise<number | null> {
  if (!useRedis) return null;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["INCRBY", key, String(by)],
        ["EXPIRE", key, String(ttlSec), "NX"],
      ]),
    });
    if (!res.ok) return null;
    const data = await res.json() as Array<{ result?: unknown }>;
    const incr = data?.[0]?.result;
    return typeof incr === "number" ? incr : null;
  } catch { return null; }
}

/** SHA-256 hex digest. Edge-runtime safe (Web Crypto). For cache keys, not security. */
export async function hashStable(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex.slice(0, 24);
}

/** Check if an IP has exceeded its rate limit for a given bucket. Uses Redis with in-memory fallback. */
export async function isRateLimited(
  ip: string,
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  if (useRedis) return redisRateLimit(ip, bucket, limit, Math.ceil(windowMs / 1000));
  return inMemoryRateLimit(ip, bucket, limit, windowMs);
}

/** Extract client IP from request headers. Prefers x-real-ip (Vercel edge, not spoofable). */
export function getClientIp(req: Request): string {
  // Prefer x-real-ip (set by Vercel's edge, not spoofable) over x-forwarded-for
  return req.headers.get("x-real-ip")?.trim()
    || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

/** Return a 429 Too Many Requests response with Retry-After header. */
export function rateLimitResponse(headers: Record<string, string>, retryAfterSec = 60): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again shortly.", retryAfter: retryAfterSec }), {
    status: 429,
    headers: { ...headers, "Retry-After": String(retryAfterSec) },
  });
}

/* ─── Request Body Size Check ─── */

/**
 * @deprecated Use readBodyWithSizeLimit() which checks actual bytes, not just Content-Length header.
 * Check if the request body exceeds the maximum allowed size.
 */
export function checkBodySize(req: Request, maxBytes = 1048576): boolean {
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  return contentLength > maxBytes;
}

/**
 * Reads the request body as text while enforcing a hard byte cap.
 * Unlike checkBodySize (which only reads the Content-Length header and can be
 * bypassed with chunked transfer encoding), this reads the actual bytes.
 * Throws a Response with status 413 when the body exceeds maxBytes.
 */
export async function readBodyWithSizeLimit(
  req: Request,
  maxBytes: number
): Promise<string> {
  // Fast path: trust Content-Length when present and over limit
  const cl = parseInt(req.headers.get("content-length") || "0", 10);
  if (cl > maxBytes) {
    throw new Response(JSON.stringify({ error: "Request body too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }
  const blob = await req.blob();
  if (blob.size > maxBytes) {
    throw new Response(JSON.stringify({ error: "Request body too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }
  return blob.text();
}

/** Validate that the request has a JSON Content-Type. Returns error Response if invalid, null if ok. */
export function validateContentType(req: Request, headers: Record<string, string>): Response | null {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    return new Response(JSON.stringify({ error: "Content-Type must be application/json" }), { status: 400, headers });
  }
  return null;
}

/* ─── Input Sanitization ─── */

/** Sanitize user-provided text before embedding in LLM prompts.
 *  Strips control characters, known injection patterns, and normalizes unicode. */
export function sanitizeForLLM(s: unknown, maxLen = 200): string {
  if (typeof s !== "string") return "";
  return s
    // Normalize unicode to NFC to prevent homoglyph attacks
    .normalize("NFC")
    // Strip zero-width characters (used to bypass pattern matching)
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF\u00AD]/g, "")
    // Normalize Cyrillic/Greek/other lookalike chars to ASCII equivalents
    .replace(/[\u0400-\u04FF]/g, c => {
      const map: Record<string, string> = {"\u0410":"A","\u0412":"B","\u0421":"C","\u0415":"E","\u041D":"H","\u041A":"K","\u041C":"M","\u041E":"O","\u0420":"P","\u0422":"T","\u0425":"X","\u0430":"a","\u0435":"e","\u043E":"o","\u0440":"p","\u0441":"c","\u0443":"y","\u0445":"x","\u043A":"k","\u043D":"h"};
      return map[c] || c;
    })
    // eslint-disable-next-line no-control-regex -- intentional: strips control characters for LLM prompt safety
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "")
    // Collapse multiple whitespace/underscores to single space (prevents "i g n o r e" bypass)
    .replace(/[\s_]{2,}/g, " ")
    // Strip known LLM role markers (case-insensitive, with optional whitespace/punctuation)
    .replace(/(?:^|\n)\s*(?:system|assistant|user|human|instruction)\s*[:-]/gim, "")
    // Strip ChatML/special tokens
    .replace(/<\|[^|]*\|>/g, "")
    // Strip markdown code blocks (potential hidden instructions)
    .replace(/```[\s\S]*?```/g, "")
    // Strip JSON role injection attempts
    .replace(/\{\s*"role"\s*:/gi, "{")
    // Strip override/ignore instructions (with underscore/separator tolerance)
    .replace(/(?:ignore|disregard|forget|override|bypass)[\s_]+(?:all[\s_]+)?(?:previous|above|prior|system)[\s_]+(?:instructions?|prompts?|context|rules?)/gi, "")
    // Strip HTML/XML tags
    .replace(/<[^>]+>/g, "")
    .slice(0, maxLen)
    .trim();
}

/* ─── Per-User Daily LLM Quota ─── */

// Free tier is capped tight: the lifetime free-session cap is 2 (one-time, no renewal),
// so a generous daily LLM-call budget only widens the abuse window without helping a
// genuine free user. 15 covers 2 full sessions of retries comfortably. Paid
// tiers stay generous.
const DAILY_LLM_LIMITS: Record<string, number> = { free: 15, starter: 60, pro: 200, team: 500 };

/** Check if a user has exceeded their daily LLM API call quota for a specific endpoint. */
export async function checkLLMQuota(userId: string, endpoint: string): Promise<{ allowed: boolean; reason?: string; count?: number; limit?: number; warning?: boolean; tier?: string }> {
  // Get user tier
  const tier = await getSubscriptionTier(userId);
  const dailyLimit = DAILY_LLM_LIMITS[tier] || DAILY_LLM_LIMITS.free;

  // No Redis configured → we can't count calls. Default to fail-open so a
  // missing cache doesn't lock users out, but honor QUOTA_FAIL_CLOSED=1 so an
  // operator who wants strict cost control isn't silently granting unlimited
  // LLM spend when Redis is absent.
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    if (process.env.QUOTA_FAIL_CLOSED === "1") {
      return { allowed: false, reason: "Service temporarily unavailable. Please try again in a few minutes.", warning: true };
    }
    return { allowed: true };
  }

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `llm_quota:${userId}:${today}:${endpoint}`;
  try {
    const res = await fetch(`${UPSTASH_URL}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, 86400]]),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      // Fail open so a Redis blip doesn't lock everyone out, but log loudly
      // and flag the caller so ops alerts can fire on a sustained outage.
      // During a sustained incident, flip QUOTA_FAIL_CLOSED=1 in Vercel env
      // to switch this to fail-closed and stop runaway LLM spend until
      // Redis recovers. The default stays fail-open to protect UX.
      console.error(`[quota] CRITICAL: Redis quota check failed (HTTP ${res.status}) — fail-${process.env.QUOTA_FAIL_CLOSED === "1" ? "closed" : "open"} for user ${userId.slice(0, 8)}`);
      if (process.env.QUOTA_FAIL_CLOSED === "1") {
        return { allowed: false, reason: "Service temporarily unavailable. Please try again in a few minutes.", warning: true };
      }
      return { allowed: true, warning: true };
    }
    const results = await res.json();
    const count = results[0]?.result ?? 1;
    if (count > dailyLimit) {
      return { allowed: false, reason: `Daily AI usage limit reached (${dailyLimit} calls/day for ${tier} plan). Upgrade for more, or try again tomorrow.`, count, limit: dailyLimit };
    }
    // 80% warning threshold — caller can surface to client
    const warning = count >= Math.floor(dailyLimit * 0.8);
    return { allowed: true, count, limit: dailyLimit, warning, tier };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[quota] CRITICAL: Redis quota check threw (${msg.slice(0, 80)}) — fail-${process.env.QUOTA_FAIL_CLOSED === "1" ? "closed" : "open"} for user ${userId.slice(0, 8)}`);
    if (process.env.QUOTA_FAIL_CLOSED === "1") {
      return { allowed: false, reason: "Service temporarily unavailable. Please try again in a few minutes.", warning: true };
    }
    return { allowed: true, warning: true };
  }
}

/* ─── Request ID Helper ─── */

/** Attach a unique X-Request-ID header to the response headers. */
export function withRequestId(headers: Record<string, string>): Record<string, string> {
  return { ...headers, "X-Request-ID": crypto.randomUUID() };
}

/* ─── Structured Logging ─── */

type LogLevel = "info" | "warn" | "error";

/**
 * Emit a single structured log line (JSON) with consistent fields.
 * Vercel's log viewer can parse these for filtering/aggregation.
 */
export function structuredLog(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const slog = {
  info: (msg: string, fields?: Record<string, unknown>) => structuredLog("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => structuredLog("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => structuredLog("error", msg, fields),
};

/* ─── VercelResponse CORS helpers (for Node.js API routes) ─── */

/** Apply CORS headers to a VercelResponse based on the request origin. Returns the matched origin. */
export function applyCorsHeaders(req: VercelRequest, res: VercelResponse): string {
  const origin = getAllowedOriginFromString(req.headers.origin as string || "");
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Vary", "Origin");
  }
  return origin;
}

/** Handle OPTIONS preflight and reject non-POST methods for VercelRequest. Returns true if handled. */
export function handlePreflightAndMethod(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return true; }
  return false;
}

/* ─── Supabase Header Builders ─── */

/** Build Supabase headers using the service role key (for server-side operations). */
export function supabaseServiceHeaders(): Record<string, string> {
  return { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
}

/** Build Supabase headers using the anon key and a user's JWT token. */
export function supabaseAnonHeaders(token: string): Record<string, string> {
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

/** Return the configured Supabase URL. */
export function supabaseUrl(): string {
  return SUPABASE_URL;
}

/** Return the configured Supabase anon key. */
export function supabaseAnonKey(): string {
  return SUPABASE_ANON_KEY;
}

/* ─── Shared HTML Utilities ─── */

/** Escape HTML special characters to prevent XSS in rendered output. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ─── Composed Request Preamble ─── */

/**
 * One-call helper that runs the common edge-function preamble:
 *   1. CORS preflight / method check
 *   2. Body size guard
 *   3. Origin validation (CSRF defense)
 *   4. Per-IP rate limit
 *   5. Supabase auth verification
 *   6. Optional per-user rate limit
 *   7. Optional LLM quota check (returns warning flag on X-LLM-Quota-Warning header)
 *
 * Returns either a Response (caller returns early) or { headers, auth, quota }
 * for the handler to use.
 *
 * Example:
 *   const pre = await withAuthAndRateLimit(req, { endpoint: "evaluate", ipLimit: 15, userLimit: 8, checkQuota: true });
 *   if (pre instanceof Response) return pre;
 *   const { headers, auth } = pre;
 */
export async function withAuthAndRateLimit(
  req: Request,
  opts: {
    endpoint: string;
    ipLimit?: number;
    userLimit?: number;
    checkQuota?: boolean;
    maxBytes?: number;
    skipOriginCheck?: boolean;
    allowGet?: boolean;
  },
): Promise<Response | {
  headers: Record<string, string>;
  auth: { authenticated: boolean; userId?: string };
  quota?: { allowed: boolean; reason?: string; count?: number; limit?: number; warning?: boolean; tier?: string };
}> {
  const early = handleCorsPreflightOrMethod(req, { allowGet: opts.allowGet });
  if (early) return early;
  const headers = withRequestId(corsHeaders(req));

  // checkBodySize returns true when the body EXCEEDS the limit, so we 413
  // on the truthy branch — the previous `!checkBodySize` inverted the check
  // and rejected every request that was actually inside the limit.
  if (checkBodySize(req, opts.maxBytes ?? 1048576)) return tooLargeResponse(headers);
  if (!opts.skipOriginCheck && !validateOrigin(req)) return forbiddenResponse(headers);

  const ip = getClientIp(req);
  if (opts.ipLimit && await isRateLimited(ip, opts.endpoint, opts.ipLimit, 60_000)) {
    return rateLimitResponse(headers);
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(headers);

  if (opts.userLimit && auth.userId
      && await isRateLimited(`user:${auth.userId}`, opts.endpoint, opts.userLimit, 60_000)) {
    return rateLimitResponse(headers);
  }

  let quota: { allowed: boolean; reason?: string; count?: number; limit?: number; warning?: boolean; tier?: string } | undefined;
  if (opts.checkQuota && auth.userId) {
    quota = await checkLLMQuota(auth.userId, opts.endpoint);
    if (!quota.allowed) {
      return new Response(JSON.stringify({ error: quota.reason, quotaExceeded: true }), { status: 429, headers });
    }
    if (quota.warning && quota.count != null && quota.limit != null) {
      headers["X-LLM-Quota-Count"] = String(quota.count);
      headers["X-LLM-Quota-Limit"] = String(quota.limit);
      headers["X-LLM-Quota-Warning"] = "1";
    }
  }

  return { headers, auth, quota };
}

/* ─── Standard Error Responses (Edge) ─── */

/** Return a JSON error response with the given status code and message. */
export function errorResponse(status: number, message: string, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

/** Return a 403 Forbidden JSON response. */
export function forbiddenResponse(headers: Record<string, string>): Response {
  return errorResponse(403, "Forbidden", headers);
}

/** Return a 413 Request Too Large JSON response. */
export function tooLargeResponse(headers: Record<string, string>): Response {
  return errorResponse(413, "Request too large", headers);
}

/* ─── VercelRequest IP Helper ─── */

/** Extract client IP from VercelRequest headers. Prefers x-real-ip (Vercel edge, not spoofable). */
export function getVercelClientIp(req: VercelRequest): string {
  return (req.headers["x-real-ip"] as string)?.trim()
    || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
    || "unknown";
}

/* ─── Service Usage Logging ─── */

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Fire-and-forget: log service usage to Supabase. Never blocks or throws. */
export function logServiceUsage(entry: {
  service: string;
  endpoint?: string;
  userId?: string;
  status: "success" | "error" | "timeout" | "rate_limited";
  latencyMs?: number;
  requestChars?: number;
  responseBytes?: number;
  errorMessage?: string;
  meta?: Record<string, unknown>;
}): void {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
  fetch(`${SUPABASE_URL}/rest/v1/service_usage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      service: entry.service,
      endpoint: entry.endpoint || null,
      user_id: entry.userId || null,
      status: entry.status,
      latency_ms: entry.latencyMs || null,
      request_chars: entry.requestChars || null,
      response_bytes: entry.responseBytes || null,
      error_message: entry.errorMessage?.slice(0, 500) || null,
      meta: entry.meta || null,
    }),
  }).catch(() => {}); // swallow — never block the response
}
