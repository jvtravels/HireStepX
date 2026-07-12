/* Admin Login handler — verifies ADMIN_PASSWORD and issues an HttpOnly
 * admin_token cookie so the middleware can gate page routes server-side.
 *
 * This is the only place the raw password is accepted. On success:
 *   1. A signed HMAC session token is minted via _admin-auth.ts.
 *   2. The token is set in a Secure; HttpOnly; SameSite=Strict cookie so
 *      middleware can read it without JS exposure.
 *   3. The token is also returned in the JSON body so the client can store
 *      it in localStorage for subsequent x-admin-token API calls (existing
 *      flow is preserved).
 *
 * When ADMIN_TOTP_SECRET is set, a TOTP second factor is also required.
 *
 * POST /api/admin-login  { password: string, totp?: string }
 *   200  { ok: true, token: string }          — success, cookie set
 *   401  { error: "Unauthorized" }            — wrong password
 *   401  { error: "Invalid 2FA code" }        — TOTP mismatch (when enabled)
 *   401  { error: "2FA code required" }       — totp field missing (when enabled)
 *   429  { error: "Too many attempts…" }      — rate limited
 *   503  { error: "Not configured" }          — ADMIN_PASSWORD not set
 */

import { createHmac, timingSafeEqual } from "crypto";
import { adminAuthConfigured, createAdminToken } from "./_admin-auth";
import { isRateLimited, getClientIp } from "./_shared";
import { isTotpRequired, verifyAdminTotp } from "./_admin-totp";

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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  // Second factor: TOTP required when ADMIN_TOTP_SECRET is configured.
  // Checked AFTER password to avoid leaking whether TOTP is enabled before
  // the password gate — both factors always look like a plain 401 to attackers.
  if (isTotpRequired()) {
    if (!totp) {
      return new Response(JSON.stringify({ error: "2FA code required", totp_required: true }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }
    if (!(await verifyAdminTotp(totp))) {
      return new Response(JSON.stringify({ error: "Invalid 2FA code" }), {
        status: 401,
        headers: CORS_HEADERS,
      });
    }
  }

  const token = createAdminToken();

  return new Response(JSON.stringify({ ok: true, token }), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Set-Cookie": buildCookieHeader(token),
    },
  });
}

/* Logout handler — clears the admin_token cookie. */
export function adminLogoutHandler(_req: Request): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      // Expire immediately by setting Max-Age=0
      "Set-Cookie": "admin_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict",
    },
  });
}
