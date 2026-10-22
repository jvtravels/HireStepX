/* Admin Login handler — verifies ADMIN_PASSWORD and issues an HttpOnly
 * admin_token cookie so the middleware can gate page routes server-side.
 *
 * This is the only place the raw password is accepted. On success:
 *   1. A signed HMAC session token is minted via _admin-auth.ts.
 *   2. The token is set in a Secure; HttpOnly; SameSite=Strict cookie —
 *      the sole delivery mechanism. The token is NOT returned in the JSON
 *      body to prevent client-side JavaScript from ever touching it.
 *   3. The client reads the token from the subsequent /api/admin-data
 *      response (_token field) and caches it in memory (React ref) for
 *      x-admin-token header use. No localStorage involved.
 *
 * When ADMIN_TOTP_SECRET is set, a TOTP second factor is also required. With
 * ADMIN_REQUIRE_MFA=1 a sign-in without one is refused (403 mfa_required), and every
 * token records whether a TOTP was verified so /api/admin-data can enforce it too.
 * Sign-ins, failures and sign-outs are written to admin_audit_log (best effort).
 *
 * POST /api/admin-login  { password: string, totp?: string }
 *   200  { ok: true }                         — success, cookie set
 *   401  { error: "Unauthorized" }            — wrong password
 *   401  { error: "Invalid 2FA code" }        — TOTP mismatch (when enabled)
 *   401  { error: "2FA code required" }       — totp field missing (when enabled)
 *   403  { code: "mfa_required" }             — ADMIN_REQUIRE_MFA=1 but no TOTP secret configured
 *   429  { error: "Too many attempts…" }      — rate limited
 *   503  { error: "Not configured" }          — ADMIN_PASSWORD not set
 */

import { createHmac, timingSafeEqual } from "crypto";
import { adminAuthConfigured, createAdminToken, readAdminTokenClaims } from "./_admin-auth";
import { isRateLimited, getClientIp } from "./_shared";
import { isTotpRequired, verifyAdminTotp } from "./_admin-totp";
import { ADMIN_ACTOR, isMfaRequired, readCookie, type AdminAuditRow } from "./_admin-session-helpers";
import { recordAdminAudit, revokeSession } from "./_admin-session-store";

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();

function verifyPassword(input: string): boolean {
  if (!ADMIN_PASSWORD || !input) return false;
  const a = createHmac("sha256", "hsx-admin-pw-v1").update(input).digest();
  const b = createHmac("sha256", "hsx-admin-pw-v1").update(ADMIN_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

/* Cookie TTL matches the token TTL from _admin-auth.ts (4 hours). */
const COOKIE_MAX_AGE = 4 * 60 * 60; // seconds

function buildCookieHeader(token: string): string {
  return [
    `admin_token=${token}`,
    `Max-Age=${COOKIE_MAX_AGE}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "https://admin.hirestepx.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Credentials": "true",
};

function audit(ip: string, action: string, outcome: string, sid: string | null = null) {
  const row: AdminAuditRow = {
    admin_user_id: ADMIN_ACTOR, session_id: sid, action, resource_type: null, resource_id: null, outcome, ip, meta: {},
  };
  return recordAdminAudit(row);
}

export default async function adminLoginHandler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  if (!adminAuthConfigured()) {
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
      headers: CORS_HEADERS,
    });
  }

  const ip = getClientIp(req);

  if (await isRateLimited(ip, "admin-login", 5, 900_000)) {
    return new Response(
      JSON.stringify({ error: "Too many attempts. Try again in 15 minutes." }),
      { status: 429, headers: CORS_HEADERS }
    );
  }

  let password: string;
  let totp: string;
  try {
    const body = await req.json() as { password?: unknown; totp?: unknown };
    password = typeof body.password === "string" ? body.password : "";
    totp = typeof body.totp === "string" ? body.totp.replace(/\s/g, "") : "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  if (!verifyPassword(password)) {
    await audit(ip, "login", "bad_password");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  // Second factor: TOTP required when ADMIN_TOTP_SECRET is configured.
  // Checked AFTER password to avoid leaking whether TOTP is enabled before
  // the password gate — both factors always look like a plain 401 to attackers.
  if (isMfaRequired(process.env.ADMIN_REQUIRE_MFA) && !isTotpRequired()) {
    await audit(ip, "login", "mfa_not_configured");
    return new Response(
      JSON.stringify({ error: "Two-factor authentication is required but not configured (ADMIN_TOTP_SECRET).", code: "mfa_required" }),
      { status: 403, headers: CORS_HEADERS },
    );
  }

  if (isTotpRequired()) {
    if (!totp) {
      return new Response(JSON.stringify({ error: "2FA code required", totp_required: true }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }
    if (!(await verifyAdminTotp(totp))) {
      await audit(ip, "login", "bad_totp");
      return new Response(JSON.stringify({ error: "Invalid 2FA code" }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }
  }

  const token = createAdminToken(Date.now(), { mfa: isTotpRequired() });
  await audit(ip, "login", "ok", readAdminTokenClaims(token)?.sid ?? null);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Set-Cookie": buildCookieHeader(token),
    },
  });
}

/* Logout handler — clears the admin_token cookie. */
export async function adminLogoutHandler(req: Request): Promise<Response> {
  // Revoke server-side so a copied token stops working too; clearing the cookie alone
  // would leave the in-memory copy valid until it expires.
  // The cookie (4h) can lapse before the rolling header token does, so honour either.
  const presented = [req.headers.get("x-admin-token"), readCookie(req.headers.get("cookie") || "", "admin_token")];
  const claims = presented.map((t) => (t ? readAdminTokenClaims(t) : null)).find((c) => c?.sid) ?? null;
  if (claims?.sid) {
    await revokeSession(claims.sid);
    await audit(getClientIp(req), "logout", "ok", claims.sid);
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      // Expire immediately by setting Max-Age=0
      "Set-Cookie": "admin_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict",
    },
  });
}
