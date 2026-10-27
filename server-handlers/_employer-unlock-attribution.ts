/* Who unlocked a candidate: one place that stamps requirement_matches.unlocked_by,
 * the payment ledger's paid_by and the team audit entry, whichever path
 * completed the order (browser verify, Razorpay webhook, reconciler, credit
 * spend). Attribution is best-effort and never undoes a fulfilled payment.
 *
 * Idempotent across those paths: a known actor claims the match with a
 * conditional PATCH (unlocked_by is null), so only the first caller logs;
 * with no known actor the audit log itself is checked for this order. */

import { writeAuditLog } from "./_employer-team-helpers";
import { fetchRazorpayOrder, type FulfillResult } from "./_unlock-fulfillment";
import { isUuid } from "./_employer-unlock-order";

export type FulfilledResult = Extract<FulfillResult, { kind: "fulfilled" | "partial" }>;

const TIMEOUT_MS = 4_000;

/** The teammate recorded on the Razorpay order notes when the order was created. */
export function actorFromNotes(notes: unknown): string | null {
  if (!notes || typeof notes !== "object") return null;
  const v = (notes as Record<string, unknown>).createdBy;
  return typeof v === "string" && isUuid(v) ? v : null;
}

/** Cash orders only; a credit-only order has no Razorpay order and yields null. */
export async function cashOrderActor(
  orderId: string, keyId: string | undefined, keySecret: string | undefined, fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!keyId || !keySecret) return null;
  try {
    const order = await fetchRazorpayOrder(orderId, keyId, keySecret, fetchImpl);
    return actorFromNotes(order?.notes);
  } catch {
    return null;
  }
}

async function claimMatches(
  base: string, headers: Record<string, string>, ids: string[], actorId: string, since: string, f: typeof fetch,
): Promise<string[]> {
  const res = await f(
    `${base}/rest/v1/requirement_matches?id=in.(${ids.map(encodeURIComponent).join(",")})` +
      `&unlocked_by=is.null&unlocked_at=gte.${encodeURIComponent(since)}&select=id`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ unlocked_by: actorId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  if (!res.ok) return [];
  const rows = (await res.json().catch(() => [])) as Array<{ id?: string }>;
  return Array.isArray(rows) ? rows.flatMap((r) => (typeof r.id === "string" ? [r.id] : [])) : [];
}

async function notYetLogged(
  base: string, headers: Record<string, string>, employerId: string, ids: string[], orderId: string, f: typeof fetch,
): Promise<string[]> {
  const res = await f(
    `${base}/rest/v1/employer_audit_log?employer_id=eq.${encodeURIComponent(employerId)}&action=eq.candidate.unlocked` +
      `&entity_id=in.(${ids.map(encodeURIComponent).join(",")})&meta->>orderId=eq.${encodeURIComponent(orderId)}&select=entity_id`,
    { headers, signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  if (!res.ok) return [];
  const rows = (await res.json().catch(() => [])) as Array<{ entity_id?: string }>;
  const logged = new Set(Array.isArray(rows) ? rows.map((r) => r.entity_id) : []);
  return ids.filter((id) => !logged.has(id));
}

/** Records the unlock against `actorId` (null = nobody knows, e.g. a legacy order). Returns the match ids it logged. */
export async function attributeUnlocks(p: {
  supabaseUrl: string;
  headers: Record<string, string>;
  result: FulfilledResult;
  actorId: string | null;
  paymentId?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  const f = p.fetchImpl ?? fetch;
  const { order, unlockedMatchIds } = p.result;
  try {
    if (p.actorId && p.paymentId) {
      await f(
        `${p.supabaseUrl}/rest/v1/employer_unlock_payments?razorpay_payment_id=eq.${encodeURIComponent(p.paymentId)}&paid_by=is.null`,
        {
          method: "PATCH",
          headers: { ...p.headers, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ paid_by: p.actorId }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        },
      ).catch(() => null);
    }
    if (unlockedMatchIds.length === 0) return [];

    const fresh = p.actorId
      ? await claimMatches(p.supabaseUrl, p.headers, unlockedMatchIds, p.actorId, order.created_at, f)
      : await notYetLogged(p.supabaseUrl, p.headers, order.employer_id, unlockedMatchIds, order.razorpay_order_id, f);
    if (fresh.length === 0) return [];

    const nameByMatchId = new Map(p.result.candidates.map((c) => [c.matchId, c.name]));
    await Promise.all(fresh.map((matchId) =>
      writeAuditLog(p.supabaseUrl, p.headers, {
        employerId: order.employer_id,
        actorUserId: p.actorId,
        action: "candidate.unlocked",
        entityType: "match",
        entityId: matchId,
        meta: {
          candidateName: nameByMatchId.get(matchId) ?? null,
          jobId: p.result.requirementId,
          orderId: order.razorpay_order_id,
          mode: order.mode,
        },
      }, f),
    ));
    return fresh;
  } catch {
    return [];
  }
}
