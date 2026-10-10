/* Pure-ish helpers for employer-create-unlock-order.ts: tier daily-limit
 * accounting, open-order reuse/overlap rules, and the employer_unlock_orders
 * insert. The partial unique index uq_unlock_orders_open_single (migration
 * 0032) is the correctness gate against duplicate single-candidate orders —
 * the Redis lock here is only a double-click optimisation and never blocks.
 */

import { TIER_LIMITS, type EmployerTier } from "./_employer-trust";
import { ORDER_SELECT, type UnlockOrderRow } from "./_unlock-fulfillment";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

/** An abandoned checkout must not lock an employer out of their daily quota
 *  or block a different purchase for the 24h before the reconciler expires it. */
export const STALE_CREATED_ORDER_MS = 30 * 60 * 1000;

export function isFreshOpenOrder(o: Pick<UnlockOrderRow, "status" | "created_at">, nowMs: number): boolean {
  if (o.status === "paid") return true;
  return o.status === "created" && nowMs - new Date(o.created_at).getTime() < STALE_CREATED_ORDER_MS;
}

export function decideUnlockLimit(args: {
  tier: EmployerTier;
  /** Matches unlocked in the last 24h plus matches in fresh open orders. */
  used: number;
  requested: number;
}): { ok: true } | { ok: false; limit: number; remaining: number; message: string } {
  const limit = TIER_LIMITS[args.tier].unlocksPerDay;
  const remaining = Math.max(0, limit - args.used);
  if (args.used + args.requested <= limit) return { ok: true };
  const upgrade =
    args.tier === "basic"
      ? " Sign in with a confirmed work email to raise your limit."
      : args.tier === "email_verified"
        ? " Verify your company website or contact support@hirestepx.com to raise your limit."
        : " Contact support@hirestepx.com if you need more.";
  return {
    ok: false,
    limit,
    remaining,
    message: `Daily unlock limit reached: your account can unlock ${limit} candidate${limit === 1 ? "" : "s"} per day (${remaining} left today).${upgrade}`,
  };
}

export function pendingOrderMatchCount(openOrders: UnlockOrderRow[], nowMs: number): number {
  return openOrders.filter((o) => isFreshOpenOrder(o, nowMs)).reduce((n, o) => n + o.match_ids.length, 0);
}

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && [...a].sort().join(",") === [...b].sort().join(",");

/** An unpaid order for exactly this purchase — returned instead of creating a
 *  second Razorpay order. Singles ignore age (the unique index forces reuse). */
export function findReusableOrder(
  openOrders: UnlockOrderRow[], mode: "single" | "batch", matchIds: string[],
): UnlockOrderRow | null {
  return openOrders.find((o) => o.mode === mode && o.status === "created" && sameSet(o.match_ids, matchIds)) ?? null;
}

/** A different, still-live order that touches any of these matches. */
export function findOverlappingOrder(
  openOrders: UnlockOrderRow[], matchIds: string[], nowMs: number,
): UnlockOrderRow | null {
  const wanted = new Set(matchIds);
  return openOrders.find((o) => isFreshOpenOrder(o, nowMs) && o.match_ids.some((id) => wanted.has(id))) ?? null;
}

/* ── I/O ── */

export async function loadOpenOrders(
  supabaseUrl: string, headers: Record<string, string>, employerId: string, fetchImpl: typeof fetch = fetch,
): Promise<UnlockOrderRow[] | null> {
  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/employer_unlock_orders?employer_id=eq.${encodeURIComponent(employerId)}` +
      `&status=in.(created,paid)&select=${ORDER_SELECT}&order=created_at.desc&limit=100`,
    { headers },
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) ? (rows as UnlockOrderRow[]) : null;
}

/** Matches this employer unlocked in the last 24h (paid or complimentary). */
export async function countUnlocksLast24h(
  supabaseUrl: string, headers: Record<string, string>, employerId: string, nowMs: number, fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  const since = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/requirement_matches?unlocked=eq.true&unlocked_at=gte.${encodeURIComponent(since)}` +
      `&select=id,employer_requirements!inner(employer_id)&employer_requirements.employer_id=eq.${encodeURIComponent(employerId)}&limit=1000`,
    { headers },
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) ? rows.length : null;
}

export type InsertOrderResult =
  | { kind: "inserted"; order: UnlockOrderRow }
  | { kind: "conflict"; order: UnlockOrderRow | null }
  | { kind: "error"; detail: string };

/** Written right after Razorpay returns the order id. A 409 is the unique
 *  open-single index firing — the caller reuses the winner's order. */
export async function insertUnlockOrder(
  supabaseUrl: string,
  headers: Record<string, string>,
  row: { razorpayOrderId: string; employerId: string; requirementId: string; mode: "single" | "batch"; matchIds: string[]; amount: number; currency: string },
  fetchImpl: typeof fetch = fetch,
): Promise<InsertOrderResult> {
  const res = await fetchImpl(`${supabaseUrl}/rest/v1/employer_unlock_orders`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      razorpay_order_id: row.razorpayOrderId,
      employer_id: row.employerId,
      requirement_id: row.requirementId,
      mode: row.mode,
      match_ids: row.matchIds,
      amount: row.amount,
      currency: row.currency,
      status: "created",
    }),
  });
  if (res.ok) {
    const rows = (await res.json().catch(() => [])) as UnlockOrderRow[];
    if (Array.isArray(rows) && rows[0]) return { kind: "inserted", order: rows[0] };
    return { kind: "error", detail: "insert returned no row" };
  }
  if (res.status === 409) {
    const existing = await loadOpenOrders(supabaseUrl, headers, row.employerId, fetchImpl);
    const winner = existing && findReusableOrder(existing, row.mode, row.matchIds);
    return { kind: "conflict", order: winner || existing?.find((o) => o.mode === "single" && o.match_ids[0] === row.matchIds[0]) || null };
  }
  const t = await res.text().catch(() => "");
  return { kind: "error", detail: `${res.status} ${t.slice(0, 160)}` };
}

/* ── Redis double-click guard (optimisation only) ── */

export type LockState = "acquired" | "held" | "unavailable";

export async function tryCreateLock(
  key: string, cfg: { url: string; token: string }, ttlSeconds: number, fetchImpl: typeof fetch = fetch,
): Promise<LockState> {
  if (!cfg.url || !cfg.token) return "unavailable";
  try {
    const res = await fetchImpl(`${cfg.url}/SET/${encodeURIComponent(key)}/1/NX/EX/${ttlSeconds}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(1_500),
    });
    if (!res.ok) return "unavailable";
    const data = (await res.json().catch(() => null)) as { result?: unknown } | null;
    if (!data) return "unavailable";
    return data.result === null ? "held" : "acquired";
  } catch {
    return "unavailable";
  }
}

export async function releaseCreateLock(
  key: string, cfg: { url: string; token: string }, fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!cfg.url || !cfg.token) return;
  try {
    await fetchImpl(`${cfg.url}/DEL/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${cfg.token}` },
      signal: AbortSignal.timeout(1_500),
    });
  } catch { /* the lock expires on its own */ }
}
