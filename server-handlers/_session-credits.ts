/* Service-role-only session-credit ledger.
 *
 * Credits let a free-tier user run mock interviews beyond FREE_SESSION_LIMIT —
 * one credit per session start. They are bought via the "single" Razorpay plan
 * (₹9 each, up to 10 per order).
 *
 * SECURITY — why a dedicated table, not a `profiles` column:
 * the `profiles` UPDATE RLS policy is row-scoped (`auth.uid() = id`) with no
 * column restriction, so an authenticated user can PATCH their own row. A
 * `session_credits` column there would be self-grantable. This ledger lives in
 * its own table whose RLS grants the owner SELECT only — there is NO
 * insert/update/delete policy for `authenticated`/`anon`, so the balance is
 * writable solely by the service role (which bypasses RLS) from these helpers.
 * See the `session_credits` block in supabase-schema.sql.
 *
 * All functions take an injectable fetchImpl so handlers stay edge-safe and the
 * pure call shape is unit-testable with a mocked fetch.
 */

type FetchImpl = typeof fetch;

function authHeaders(serviceKey: string, extra?: Record<string, string>): Record<string, string> {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...(extra || {}) };
}

/** Read a user's current credit balance. Returns 0 on any error or missing row
 *  (fail-safe: a transient read failure must never grant a free session). */
export async function getSessionCredits(
  baseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl = fetch,
): Promise<number> {
  const res = await fetchImpl(
    `${baseUrl}/rest/v1/session_credits?user_id=eq.${encodeURIComponent(userId)}&select=balance`,
    { headers: authHeaders(serviceKey) },
  );
  if (!res.ok) return 0;
  const rows = await res.json().catch(() => []);
  if (Array.isArray(rows) && rows.length > 0 && typeof rows[0].balance === "number") {
    return rows[0].balance > 0 ? rows[0].balance : 0;
  }
  return 0;
}

/** Add `qty` (clamped 1–10) credits to a user's balance, creating the ledger
 *  row if absent. Returns the new balance, or null if the write failed. */
export async function grantSessionCredits(
  baseUrl: string,
  serviceKey: string,
  userId: string,
  qty: number,
  fetchImpl: FetchImpl = fetch,
): Promise<number | null> {
  const safeQty = Math.min(Math.max(Math.trunc(Number(qty)) || 0, 1), 10);
  const current = await getSessionCredits(baseUrl, serviceKey, userId, fetchImpl);
  const next = current + safeQty;
  const res = await fetchImpl(`${baseUrl}/rest/v1/session_credits`, {
    method: "POST",
    headers: authHeaders(serviceKey, {
      "Content-Type": "application/json",
      // Upsert: insert the row, or overwrite balance with the computed total.
      Prefer: "resolution=merge-duplicates,return=minimal",
    }),
    body: JSON.stringify({ user_id: userId, balance: next, updated_at: new Date().toISOString() }),
  });
  return res.ok ? next : null;
}

/** Spend one credit. Returns true if a credit was decremented, false if the
 *  user had none (or the write failed). The `balance=gt.0` filter is a
 *  server-side guard so the balance can never go negative; a rare double-spend
 *  under a client retry is acceptable for MVP (one lost ₹9 credit, never a
 *  charge), and concurrent session starts are already deduped by the Redis
 *  in-flight counter upstream. */
export async function consumeSessionCredit(
  baseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl = fetch,
): Promise<boolean> {
  const current = await getSessionCredits(baseUrl, serviceKey, userId, fetchImpl);
  if (current <= 0) return false;
  const res = await fetchImpl(
    `${baseUrl}/rest/v1/session_credits?user_id=eq.${encodeURIComponent(userId)}&balance=gt.0`,
    {
      method: "PATCH",
      headers: authHeaders(serviceKey, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify({ balance: current - 1, updated_at: new Date().toISOString() }),
    },
  );
  return res.ok;
}
