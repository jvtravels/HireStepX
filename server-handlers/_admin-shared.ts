/* Shared substrate for the admin-data handler: env, auth, Supabase REST helpers. */

import { createHmac, timingSafeEqual } from "crypto";
import type { VercelRequest } from "@vercel/node";
import { verifyAdminToken } from "./_admin-auth";
import { getClientIp, isRateLimited, slog } from "./_shared";

/* ─── Config ─── */

/** Thrown for bad client input inside admin-data.ts's section switch — distinct
 * from backend/network failures so the outer catch can return 400 instead
 * of 500 without relying on fragile message substring matching (that
 * matching used to miss any validation message not containing "required"
 * or "Unknown", e.g. "status must be new | seen | resolved"). */
export class ValidationError extends Error {}

export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || "").trim();
export const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
export const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
export const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();

/* Query limits — reasonable caps to prevent huge payloads */
export const LIMIT_PROFILES = 2000;
export const LIMIT_SESSIONS = 2000;
export const LIMIT_PAYMENTS = 1000;
export const LIMIT_LLM = 2000;
export const LIMIT_RECENT = 30;


/* ─── Auth ─── */

export function verifyPassword(input: string): boolean {
  if (!ADMIN_PASSWORD || !input) return false;
  // HMAC both sides to a fixed-length 32-byte digest. This eliminates
  // length-based timing leaks (the comparison itself sees only equal-
  // length buffers) and we use the comparison result directly so static
  // analyzers don't flag a discarded timingSafeEqual return.
  const a = createHmac("sha256", "hsx-admin-pw-v1").update(input).digest();
  const b = createHmac("sha256", "hsx-admin-pw-v1").update(ADMIN_PASSWORD).digest();
  return timingSafeEqual(a, b);
}

/** Check auth: either password (for login) or token (for subsequent requests) */
export async function verifyAuth(req: VercelRequest): Promise<{ ok: boolean; isLogin?: boolean }> {
  // Check x-admin-token header (in-memory token from client state)
  const token = req.headers["x-admin-token"];
  if (token && typeof token === "string" && verifyAdminToken(token)) {
    return { ok: true };
  }
  // Fallback: read token from HttpOnly admin_token cookie (session resume on
  // page refresh, when the client has no in-memory token yet).
  const cookieHeader = typeof req.headers["cookie"] === "string" ? req.headers["cookie"] : "";
  if (cookieHeader) {
    const cookieToken = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("admin_token="))
      ?.slice("admin_token=".length);
    if (cookieToken && verifyAdminToken(cookieToken)) {
      return { ok: true };
    }
  }
  // Check for password (login attempt). This is a second path into the same
  // password check admin-login.ts exposes, so it shares that endpoint's
  // "admin-login" rate-limit bucket — otherwise it'd be a brute-force
  // bypass of the 5-attempts/15-min limit enforced there.
  const key = req.headers["x-admin-key"];
  if (key && typeof key === "string") {
    // getClientIp is typed against the standard Request; this handler is Node
    // runtime (VercelRequest), but both expose the same .headers reads.
    const ip = getClientIp(req as unknown as Request);
    if (await isRateLimited(ip, "admin-login", 5, 900_000)) {
      return { ok: false };
    }
    if (verifyPassword(key)) {
      return { ok: true, isLogin: true };
    }
  }
  return { ok: false };
}

/* ─── Supabase Helpers ─── */

export function supa(path: string, opts?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(opts?.headers || {}),
    },
  });
}

export async function fetchJSON<T = unknown>(path: string): Promise<T[]> {
  const res = await supa(path);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    slog.error("admin-data: supabase query failed", { path: path.slice(0, 120), status: res.status, body: body.slice(0, 200) });
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchCount(table: string, filter = ""): Promise<number> {
  const path = `${table}?select=id${filter}&limit=0`;
  const res = await supa(path, { headers: { Prefer: "count=exact" } });
  const range = res.headers.get("content-range");
  if (range) {
    const match = range.match(/\/(\d+)/);
    if (match) return parseInt(match[1], 10);
  }
  return 0;
}

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

/* Shared with getCostData's modeled-vs-actual reconciliation below, so both
 * places classify provider usage rows identically. */
export const TTS_SERVICES = new Set(["azure_tts", "cartesia_tts", "sarvam_tts"]);
export const STT_SERVICES = new Set(["deepgram_stt", "sarvam_stt"]);
