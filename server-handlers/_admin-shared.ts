/* Shared substrate for the admin-data handler: env, auth, Supabase REST helpers. */

import type { VercelRequest } from "@vercel/node";
import { readAdminTokenClaims } from "./_admin-auth";
import { evaluateSession, isMfaRequired, NO_REVOCATIONS, readCookie, type AdminClaims, type RevocationState, type SessionDenial } from "./_admin-session-helpers";
import { loadRevocationState } from "./_admin-session-store";
import { slog } from "./_shared";
import { readAllPages } from "./_paged-fetch";

/* ─── Config ─── */

/** Thrown for bad client input inside admin-data.ts's section switch — distinct
 * from backend/network failures so the outer catch can return 400 instead
 * of 500 without relying on fragile message substring matching (that
 * matching used to miss any validation message not containing "required"
 * or "Unknown", e.g. "status must be new | seen | resolved"). */
export class ValidationError extends Error {}

export const SUPABASE_URL = process.env.SUPABASE_URL || "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
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

export type AdminAuthResult =
  | { ok: true; claims: AdminClaims }
  | { ok: false; status: 401 | 403 | 503; code: string; error: string; claims?: AdminClaims };

/** Check auth. Only the signed session token (header or HttpOnly cookie) is accepted.
 * The raw admin password is deliberately NOT a credential here: it is verified, together
 * with the TOTP second factor, solely by /api/admin-login, which mints the token. Accepting
 * it on this endpoint would let anyone holding the shared password skip TOTP.
 *
 * On top of the signature it enforces the 8h session cap, the Redis revocation list and
 * (when ADMIN_REQUIRE_MFA=1) the `mfa` claim. If the revocation list can't be read the
 * request is refused (503): an unverifiable session is treated as an invalid one. */
export async function verifyAuth(req: VercelRequest): Promise<AdminAuthResult> {
  const candidates: string[] = [];
  const header = req.headers["x-admin-token"];
  if (header && typeof header === "string") candidates.push(header);
  // Cookie fallback: session resume on page refresh, when the client has no in-memory token yet.
  const cookieHeader = typeof req.headers["cookie"] === "string" ? req.headers["cookie"] : "";
  const cookieToken = cookieHeader ? readCookie(cookieHeader, "admin_token") : undefined;
  if (cookieToken) candidates.push(cookieToken);

  const signed = candidates.map(readAdminTokenClaims).filter((c): c is AdminClaims => c !== null);
  if (signed.length === 0) return { ok: false, status: 401, code: "unauthorized", error: "Unauthorized" };

  const ctx = { now: Date.now(), requireMfa: isMfaRequired(process.env.ADMIN_REQUIRE_MFA) };
  let chosen: AdminClaims | null = null;
  let firstDenial: { denial: SessionDenial; claims: AdminClaims } | null = null;
  for (const claims of signed) {
    const d = evaluateSession(claims, { ...ctx, ...NO_REVOCATIONS });
    if (d.ok) { chosen = claims; break; }
    firstDenial ??= { denial: d, claims };
  }
  if (!chosen) {
    const { denial, claims } = firstDenial!;
    return { ok: false, status: denial.status, code: denial.code, error: denial.error, claims };
  }

  let state: RevocationState;
  try {
    state = await loadRevocationState(chosen.sid!);
  } catch (err) {
    slog.error("admin-auth: revocation lookup failed, refusing request", { error: err instanceof Error ? err.message : String(err) });
    return { ok: false, status: 503, code: "session_check_unavailable", error: "Could not verify session. Try again shortly.", claims: chosen };
  }
  const d = evaluateSession(chosen, { ...ctx, ...state });
  if (!d.ok) return { ok: false, status: d.status, code: d.code, error: d.error, claims: chosen };
  return { ok: true, claims: chosen };
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

export interface FullRead<T> {
  rows: T[];
  /** The row cap was hit, so totals computed from `rows` are lower bounds. */
  truncated: boolean;
  /** A page read failed. `rows` is then empty, never a partial read dressed up as complete. */
  failed: boolean;
}

/** Whole-window read, keyset-paged on `id` (the select must include it) past PostgREST's
 * 1000-row response cap. Unlike fetchJSON a failure is reported, not collapsed to []. */
export async function fetchAllRows<T = unknown>(path: string, maxRows = 50_000): Promise<FullRead<T>> {
  try {
    const r = await readAllPages<T>((p) => supa(p), path, { keyset: "id", maxRows });
    return { rows: r.rows, truncated: r.truncated, failed: false };
  } catch (err) {
    slog.error("admin-data: paged read failed", { path: path.slice(0, 120), error: err instanceof Error ? err.message : String(err) });
    return { rows: [], truncated: false, failed: true };
  }
}

/** Flags to merge into a section's output: which reads failed or hit the cap. */
export function readQuality(reads: Record<string, { truncated: boolean; failed: boolean }>) {
  const degradedSources = Object.keys(reads).filter((k) => reads[k].failed);
  const truncatedSources = Object.keys(reads).filter((k) => reads[k].truncated);
  return { degraded: degradedSources.length > 0, degradedSources, truncated: truncatedSources.length > 0, truncatedSources };
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

/* Employer accounts also get a profiles row (signup trigger), so every
 * candidate-facing admin stat has to subtract them. These helpers do that
 * without a URL-length cap, whatever the number of employers. */
const EMPLOYER_PAGE = 1000;
const COUNT_IN_CHUNK = 80;

export async function fetchEmployerIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let offset = 0; ; offset += EMPLOYER_PAGE) {
    const rows = await fetchJSON<{ id: string }>(`employers?select=id&order=id.asc&offset=${offset}&limit=${EMPLOYER_PAGE}`);
    for (const r of rows) ids.add(r.id);
    if (rows.length < EMPLOYER_PAGE) return ids;
  }
}

/** Profiles that belong to employers and also match `filter`. */
async function countEmployerProfiles(employerIds: Set<string>, filter: string): Promise<number> {
  const all = [...employerIds].map(encodeURIComponent);
  const chunks: string[] = [];
  for (let i = 0; i < all.length; i += COUNT_IN_CHUNK) chunks.push(all.slice(i, i + COUNT_IN_CHUNK).join(","));
  const counts = await Promise.all(chunks.map((c) => fetchCount("profiles", `&id=in.(${c})${filter}`)));
  return counts.reduce((a, b) => a + b, 0);
}

/** Number of candidate (non-employer) profiles matching `filter`. */
export async function fetchCandidateCount(employerIds: Set<string>, filter = ""): Promise<number> {
  const [total, employers] = await Promise.all([
    fetchCount("profiles", filter),
    countEmployerProfiles(employerIds, filter),
  ]);
  return Math.max(0, total - employers);
}

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

/* Shared with getCostData's modeled-vs-actual reconciliation below, so both
 * places classify provider usage rows identically. */
export const TTS_SERVICES = new Set(["azure_tts", "cartesia_tts", "sarvam_tts"]);
export const STT_SERVICES = new Set(["deepgram_stt", "sarvam_stt"]);
