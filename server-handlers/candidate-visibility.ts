/* Vercel Edge Function — Candidate employer-visibility (consent) control
 *
 * GET  /api/candidate-visibility
 * POST /api/candidate-visibility  { visibility: "masked" | "off", source?: string }
 *   -> { visibility, updatedAt, policyVersion, history, noticePending, stats, changed }
 *   { visibility: "masked" } while already masked with no 'granted' row = the
 *   candidate affirming the on-by-default setting ("Keep on"): logs 'granted'.
 * POST /api/candidate-visibility  { noticeSeen: true }  -> { ok: true }
 *
 * The single write path for profiles.employer_visibility. A DB trigger stops
 * client JWTs changing that column, so this handler (service role) is what
 * makes every change leave an append-only candidate_consent_log row.
 *
 * Switching to "off" also deletes the candidate's LOCKED matches so they drop
 * out of employer shortlists immediately. Unlocked matches (an employer paid
 * for them) are never touched here — see _entitlements.ts for how a withdrawn
 * candidate stays unreachable even to an employer who already unlocked them. */

export const config = { runtime: "edge" };

import {
  withAuthAndRateLimit,
  corsHeaders,
  isRateLimited,
  rateLimitResponse,
  slog,
  supabaseUrl,
  supabaseServiceHeaders,
} from "./_shared";
import {
  EMPLOYER_DISCOVERY_POLICY_VERSION,
  asVisibility,
  buildConsentLogRow,
  isDiscoveryNoticePending,
  shapeConsentHistory,
  type ConsentHistoryEntry,
  type EmployerVisibility,
} from "./_candidate-consent-helpers";
import { creditRefundForMatches, unlockedMatchIdsForCandidate } from "./_employer-credit";

const HISTORY_LIMIT = 20;
const THIRTY_DAYS_MS = 30 * 86400000;

export interface VisibilityState {
  visibility: EmployerVisibility;
  updatedAt: string | null;
  policyVersion: string;
  history: ConsentHistoryEntry[];
  /** True until the candidate answers or dismisses the one-time dashboard notice. */
  noticePending: boolean;
  stats: { employersViewedLast30d: number };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...supabaseServiceHeaders(), "Content-Type": "application/json", ...extra };
}

type ProfileRead = { visibility: EmployerVisibility; updatedAt: string | null; noticeSeenAt: string | null };
type ProfileRow = { employer_visibility?: string | null; employer_visibility_updated_at?: string | null; employer_notice_seen_at?: string | null };

async function readProfile(base: string, userId: string, fetchImpl: typeof fetch): Promise<ProfileRead | "missing" | "error"> {
  const url = (cols: string) => `${base}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=${cols}&limit=1`;
  const base_cols = "employer_visibility,employer_visibility_updated_at";
  let res = await fetchImpl(url(`${base_cols},employer_notice_seen_at`), { headers: supabaseServiceHeaders(), signal: AbortSignal.timeout(6000) });
  // Migration 0037 (employer_notice_seen_at) may not be applied yet: PostgREST
  // answers 400 for an unknown column, so retry without it.
  if (res.status === 400) res = await fetchImpl(url(base_cols), { headers: supabaseServiceHeaders(), signal: AbortSignal.timeout(6000) });
  if (!res.ok) return "error";
  const rows = (await res.json().catch(() => [])) as ProfileRow[];
  if (!rows[0]) return "missing";
  return {
    visibility: asVisibility(rows[0].employer_visibility) ?? "masked",
    updatedAt: rows[0].employer_visibility_updated_at ?? null,
    noticeSeenAt: rows[0].employer_notice_seen_at ?? null,
  };
}

/** Best-effort: stamps the notice as seen. Never throws and never fails the
 *  caller — the column is optional (migration 0037) and a missing one just
 *  means the dashboard falls back to its per-device dismissal. */
export async function markNoticeSeen(userId: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl()}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&employer_notice_seen_at=is.null`,
      {
        method: "PATCH",
        headers: jsonHeaders({ Prefer: "return=minimal" }),
        body: JSON.stringify({ employer_notice_seen_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(6000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function hasGrantedConsent(base: string, userId: string, fetchImpl: typeof fetch): Promise<boolean | "error"> {
  const res = await fetchImpl(
    `${base}/rest/v1/candidate_consent_log?user_id=eq.${encodeURIComponent(userId)}&purpose=eq.employer_discovery&action=eq.granted&select=id&limit=1`,
    { headers: supabaseServiceHeaders(), signal: AbortSignal.timeout(6000) },
  );
  if (!res.ok) return "error";
  const rows = (await res.json().catch(() => [])) as unknown[];
  return Array.isArray(rows) && rows.length > 0;
}

/** Current state + last 20 consent-log rows + how many employers viewed the candidate in the last 30 days. */
export async function loadVisibilityState(userId: string, fetchImpl: typeof fetch = fetch): Promise<VisibilityState | "missing" | "error"> {
  const base = supabaseUrl();
  const enc = encodeURIComponent(userId);
  const since = encodeURIComponent(new Date(Date.now() - THIRTY_DAYS_MS).toISOString());
  const [profile, historyRes, viewedRes] = await Promise.all([
    readProfile(base, userId, fetchImpl),
    fetchImpl(
      `${base}/rest/v1/candidate_consent_log?user_id=eq.${enc}&select=action,created_at,source&order=created_at.desc&limit=${HISTORY_LIMIT}`,
      { headers: supabaseServiceHeaders(), signal: AbortSignal.timeout(6000) },
    ),
    // One match row per (requirement, candidate) with profile_viewed_at set = one employer-requirement that viewed them.
    fetchImpl(
      `${base}/rest/v1/requirement_matches?candidate_user_id=eq.${enc}&profile_viewed_at=gte.${since}&select=id`,
      { headers: { ...supabaseServiceHeaders(), Prefer: "count=exact", Range: "0-0" }, signal: AbortSignal.timeout(6000) },
    ),
  ]);
  if (profile === "missing" || profile === "error") return profile;
  if (!historyRes.ok) return "error";
  const history = shapeConsentHistory((await historyRes.json().catch(() => [])) as Array<{ action?: unknown; created_at?: unknown; source?: unknown }>);
  let viewed = 0;
  if (viewedRes.ok) {
    const range = viewedRes.headers?.get?.("content-range") ?? "";
    const m = range.match(/\/(\d+)$/);
    viewed = m ? parseInt(m[1], 10) : 0;
  }
  return {
    visibility: profile.visibility,
    updatedAt: profile.updatedAt,
    policyVersion: EMPLOYER_DISCOVERY_POLICY_VERSION,
    history,
    noticePending: isDiscoveryNoticePending({ visibility: profile.visibility, history, noticeSeenAt: profile.noticeSeenAt }),
    stats: { employersViewedLast30d: viewed },
  };
}

/** Applies a visibility change. Returns whether anything changed; a same-value request writes nothing. */
export async function applyVisibilityChange(opts: {
  userId: string;
  next: EmployerVisibility;
  source?: unknown;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; changed: boolean } | { ok: false; status: number; error: string }> {
  const f = opts.fetchImpl ?? fetch;
  const base = supabaseUrl();
  const enc = encodeURIComponent(opts.userId);

  const profile = await readProfile(base, opts.userId, f);
  if (profile === "error") return { ok: false, status: 502, error: "Could not read your settings" };
  if (profile === "missing") return { ok: false, status: 404, error: "Profile not found" };

  // Discovery is on by default, so "masked" can exist without any consent
  // record. Re-affirming it ("Keep on") is a no-op on the column but must
  // still leave a 'granted' receipt.
  let hasGrant: boolean | undefined;
  if (profile.visibility === "masked" && opts.next === "masked") {
    const g = await hasGrantedConsent(base, opts.userId, f);
    if (g === "error") return { ok: false, status: 502, error: "Could not read your settings" };
    hasGrant = g;
  }

  const logRow = buildConsentLogRow({ userId: opts.userId, current: profile.visibility, next: opts.next, source: opts.source, hasGrant });
  if (!logRow) return { ok: true, changed: false };

  if (profile.visibility === opts.next) {
    const ackRes = await f(`${base}/rest/v1/candidate_consent_log`, {
      method: "POST",
      headers: jsonHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify(logRow),
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!ackRes || !ackRes.ok) {
      slog.error("candidate-visibility: consent log insert failed", { status: ackRes?.status ?? 0 });
      return { ok: false, status: 500, error: "Could not record your choice" };
    }
    if (!profile.noticeSeenAt) await markNoticeSeen(opts.userId, f);
    return { ok: true, changed: true };
  }

  // Compare-and-swap on the value we read so two concurrent toggles can't both
  // log a transition from the same stale state.
  const patchRes = await f(
    `${base}/rest/v1/profiles?id=eq.${enc}&employer_visibility=eq.${profile.visibility}`,
    {
      method: "PATCH",
      headers: jsonHeaders({ Prefer: "return=representation" }),
      body: JSON.stringify({ employer_visibility: opts.next, employer_visibility_updated_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!patchRes.ok) {
    slog.error("candidate-visibility: profile PATCH failed", { status: patchRes.status });
    return { ok: false, status: 500, error: "Could not update your setting" };
  }
  const patched = (await patchRes.json().catch(() => [])) as unknown[];
  if (patched.length === 0) {
    return { ok: false, status: 409, error: "Your setting just changed — refresh and try again" };
  }

  // The consent receipt is the point of this endpoint: if it can't be written,
  // put the old value back rather than leave an unrecorded change.
  const logRes = await f(`${base}/rest/v1/candidate_consent_log`, {
    method: "POST",
    headers: jsonHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(logRow),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!logRes || !logRes.ok) {
    slog.error("candidate-visibility: consent log insert failed, reverting", { status: logRes?.status ?? 0 });
    await f(`${base}/rest/v1/profiles?id=eq.${enc}`, {
      method: "PATCH",
      headers: jsonHeaders({ Prefer: "return=minimal" }),
      body: JSON.stringify({ employer_visibility: profile.visibility, employer_visibility_updated_at: profile.updatedAt }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    return { ok: false, status: 500, error: "Could not record your consent change" };
  }

  if (opts.next === "off") {
    // `not.is.true` also covers legacy NULLs; rows with unlocked = true are never matched.
    const delRes = await f(
      `${base}/rest/v1/requirement_matches?candidate_user_id=eq.${enc}&unlocked=not.is.true`,
      { method: "DELETE", headers: jsonHeaders({ Prefer: "return=minimal" }), signal: AbortSignal.timeout(10000) },
    ).catch(() => null);
    if (!delRes || !delRes.ok) {
      // Consent is already withdrawn and recorded; the matcher/entitlement layer
      // also filters 'off' candidates, so stale locked rows are not employer-visible.
      slog.error("candidate-visibility: locked-match cleanup failed", { status: delRes?.status ?? 0 });
    }
    // Paid matches stay visible to the employer but the candidate is now
    // unreachable, so what they paid for each one comes back as credit (the match
    // is relocked, and an employer who already messaged them is not credited).
    // Turning visibility back on later does NOT re-grant: one refund per match.
    const unlockedIds = await unlockedMatchIdsForCandidate(base, supabaseServiceHeaders(), opts.userId, f);
    await creditRefundForMatches({ base: base, headers: supabaseServiceHeaders(), matchIds: unlockedIds, reason: "withdrew", fetchImpl: f });
  }

  if (!profile.noticeSeenAt) await markNoticeSeen(opts.userId, f);
  return { ok: true, changed: true };
}

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "candidate-visibility",
    ipLimit: 40,
    userLimit: 20,
    maxBytes: 2_000,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) return json({ error: "Unauthorized" }, 401, headers);
  if (!supabaseUrl() || !supabaseServiceHeaders().apikey) return json({ error: "Server misconfigured" }, 503, headers);

  try {
    if (req.method === "POST") {
      // Stricter bucket for writes: a consent toggle is never a hot path.
      if (await isRateLimited(`user:${auth.userId}`, "candidate-visibility-write", 6, 60_000)) {
        return rateLimitResponse(headers);
      }
      let body: { visibility?: unknown; source?: unknown; noticeSeen?: unknown };
      try {
        body = await req.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400, headers);
      }
      // Dismissing the dashboard notice without choosing: record that it was seen, change nothing else.
      if (body?.noticeSeen === true && body.visibility === undefined) {
        await markNoticeSeen(auth.userId);
        return json({ ok: true }, 200, headers);
      }
      const next = asVisibility(body?.visibility);
      if (!next) return json({ error: "visibility must be 'masked' or 'off'" }, 400, headers);

      const result = await applyVisibilityChange({ userId: auth.userId, next, source: body.source });
      if (!result.ok) return json({ error: result.error }, result.status, headers);

      const state = await loadVisibilityState(auth.userId);
      if (state === "missing" || state === "error") return json({ error: "Could not load your settings" }, 502, headers);
      return json({ ...state, changed: result.changed }, 200, headers);
    }

    if (req.method === "GET") {
      const state = await loadVisibilityState(auth.userId);
      if (state === "missing") return json({ error: "Profile not found" }, 404, headers);
      if (state === "error") return json({ error: "Could not load your settings" }, 502, headers);
      return json(state, 200, headers);
    }

    return json({ error: "Method not allowed" }, 405, headers);
  } catch (err) {
    slog.error("candidate-visibility: unexpected error", { error: err instanceof Error ? err.message : String(err) });
    return json({ error: "Internal error" }, 500, headers);
  }
}
