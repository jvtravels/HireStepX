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
 * POST /api/admin-login  { password: string }
 *   200  { ok: true, token: string }          — success, cookie set
 *   401  { error: "Unauthorized" }            — wrong password
 *   429  { error: "Too many attempts…" }      — rate limited
 *   503  { error: "Not configured" }          — ADMIN_PASSWORD not set
 */

import { createHmac, timingSafeEqual } from "crypto";
import { adminAuthConfigured, createAdminToken } from "./_admin-auth";

const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();

/* Rate limiting — in-memory per serverless instance, same params as admin-data.ts */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
  } else {
    entry.count++;
  }
}

function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

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

  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: "Too many attempts. Try again in 15 minutes." }),
      { status: 429, headers: CORS_HEADERS }
    );
  }

  let password: string;
  try {
    const body = await req.json() as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: CORS_HEADERS,
    });
  }

  if (!verifyPassword(password)) {
    recordAttempt(ip);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: CORS_HEADERS,
    });
  }

  clearAttempts(ip);

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
