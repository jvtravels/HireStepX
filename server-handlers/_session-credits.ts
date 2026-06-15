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
 *  row if absent. Returns the new balance, or null if the write failed.
 *
 *  `retries` re-attempts the read+upsert on transient failure with linear
 *  backoff. This is money-critical: the caller has already taken the user's
 *  payment, so a Supabase blip here must not silently drop the credit. Each
 *  attempt re-reads the balance, so a partial prior write is self-correcting
 *  (the merge-duplicates upsert is idempotent on the computed total).
 *  Default 0 keeps the call shape unchanged for existing unit tests. */
export async function grantSessionCredits(
  baseUrl: string,
  serviceKey: string,
  userId: string,
  qty: number,
  fetchImpl: FetchImpl = fetch,
  retries = 0,
): Promise<number | null> {
  const safeQty = Math.min(Math.max(Math.trunc(Number(qty)) || 0, 1), 10);
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
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
      if (res.ok) return next;
    } catch { /* transient — fall through to retry */ }
    if (attempt < retries) await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
  }
  return null;
}

/** Spend one credit. Returns true iff a credit was decremented, false if the
 *  user had none (or the call failed).
 *
 *  Atomicity (audit N-4): this calls the `consume_session_credit` SQL function,
 *  which decrements in a single `UPDATE … WHERE balance > 0` statement. Postgres
 *  row-locking serializes concurrent calls, so two near-simultaneous session
 *  starts can never both spend the same credit — the loser sees the already-
 *  lowered balance and the guarded WHERE no longer matches. The previous
 *  read-then-PATCH was non-atomic and admitted a rare double-spend. */
export async function consumeSessionCredit(
  baseUrl: string,
  serviceKey: string,
  userId: string,
  fetchImpl: FetchImpl = fetch,
): Promise<boolean> {
  const res = await fetchImpl(`${baseUrl}/rest/v1/rpc/consume_session_credit`, {
    method: "POST",
    headers: authHeaders(serviceKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({ p_user_id: userId }),
  });
  if (!res.ok) return false;
  // The function returns a bare boolean; PostgREST serializes it as JSON `true`/`false`.
  const consumed = await res.json().catch(() => false);
  return consumed === true;
}
