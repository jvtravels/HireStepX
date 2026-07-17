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
 *  Primary path: calls the `grant_session_credits` SQL RPC, which is a single
 *  INSERT ... ON CONFLICT DO UPDATE so the increment is atomic. Postgres row-
 *  locking serializes concurrent payment calls — the old read-then-write race
 *  where two concurrent purchases both read balance=3, both write balance=4
 *  (one credit lost) is eliminated.
 *
 *  Fallback: ONLY fires when the RPC returns 404/405 (function not yet deployed
 *  in the target environment). Any other failure retries the atomic RPC instead
 *  of falling back — this is intentional. Using the non-atomic read-then-upsert
 *  path on transient RPC errors is what caused credits to be silently lost when
 *  the Razorpay webhook and the client verify-payment both fell into the fallback
 *  simultaneously (both read the same stale balance, both wrote balance+qty, net
 *  result: one payment's grant was clobbered).
 *
 *  `opts.paymentId`: passed to the RPC so the `credit_ledger` table records which
 *  Razorpay payment triggered each grant (immutable audit trail).
 *
 *  `retries` covers transient Supabase blips. This is money-critical — the
 *  caller has already taken payment.  Default 0 keeps unit tests unchanged. */
export async function grantSessionCredits(
  baseUrl: string,
  serviceKey: string,
  userId: string,
  qty: number,
  fetchImpl: FetchImpl = fetch,
  retries = 0,
  opts?: { paymentId?: string },
): Promise<number | null> {
  const safeQty = Math.min(Math.max(Math.trunc(Number(qty)) || 0, 1), 10);
  // Set once on first 404/405; all subsequent attempts skip the RPC and go
  // straight to the fallback (no point retrying a missing function).
  let rpcMissing = false;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (!rpcMissing) {
        // ── Primary: atomic RPC ────────────────────────────────────────
        const rpcBody: Record<string, unknown> = { p_user_id: userId, p_qty: safeQty };
        if (opts?.paymentId) rpcBody.p_payment_id = opts.paymentId;
        const rpcRes = await fetchImpl(`${baseUrl}/rest/v1/rpc/grant_session_credits`, {
          method: "POST",
          headers: authHeaders(serviceKey, { "Content-Type": "application/json" }),
          body: JSON.stringify(rpcBody),
        });
        if (rpcRes.ok) {
          const newBalance = await rpcRes.json();
          if (typeof newBalance === "number") return newBalance;
          // Unexpected response shape — treat as transient and retry RPC only.
          console.error(`grant_session_credits RPC ok but non-numeric response for ${userId}, will retry`);
        } else if (rpcRes.status === 404 || rpcRes.status === 405) {
          // Function not deployed in this environment — use non-atomic fallback.
          rpcMissing = true;
        } else {
          // Transient RPC error (5xx, auth issue, etc.). Retry the atomic path;
          // do NOT fall back to non-atomic upsert — that's what caused credit
          // loss under concurrent webhook + client-callback delivery.
          console.error(`grant_session_credits RPC error (${rpcRes.status}) for ${userId}, will retry`);
          if (attempt < retries) await new Promise(r => setTimeout(r, 250 * (attempt + 1)));
          continue;
        }
      }

      if (rpcMissing) {
        // ── Fallback: read-then-upsert (non-atomic, 404/405 only) ─────
        // Each attempt re-reads the live balance so a partial prior write
        // self-corrects, but concurrent concurrent calls CAN still race.
        // Deploy the SQL migration to eliminate this path entirely.
        const current = await getSessionCredits(baseUrl, serviceKey, userId, fetchImpl);
        const next = current + safeQty;
        const upsertRes = await fetchImpl(`${baseUrl}/rest/v1/session_credits`, {
          method: "POST",
          headers: authHeaders(serviceKey, {
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates,return=minimal",
          }),
          body: JSON.stringify({ user_id: userId, balance: next, updated_at: new Date().toISOString() }),
        });
        if (upsertRes.ok) return next;
      }
    } catch { /* transient network error — fall through to retry */ }
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

  if (res.ok) {
    // The function returns a bare boolean; PostgREST serializes it as JSON `true`/`false`.
    // true = credit decremented. false = balance was already 0 (legitimate block).
    const consumed = await res.json().catch(() => false);
    return consumed === true;
  }

  // ── RPC call itself failed (function not found, permission denied, 5xx) ──
  // This is distinct from "balance = 0": if the function were found and ran, it
  // would always return 200 (the boolean return value encodes the balance check).
  // A non-200 means the function is missing or misconfigured — not that the user
  // is out of credits. Fall back to a direct read-then-PATCH so users with a
  // real balance can still start sessions despite the RPC misconfiguration.
  // Non-atomic (rare double-spend if two requests race), but better than
  // hard-blocking users who legitimately paid.
  console.error(
    `consume_session_credit RPC failed (${res.status}) — falling back to direct PATCH for user ${userId}`,
  );
  const current = await getSessionCredits(baseUrl, serviceKey, userId, fetchImpl);
  if (current <= 0) return false; // genuinely out of credits

  const patchRes = await fetchImpl(
    `${baseUrl}/rest/v1/session_credits?user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: authHeaders(serviceKey, {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      }),
      body: JSON.stringify({ balance: current - 1, updated_at: new Date().toISOString() }),
    },
  );
  return patchRes.ok;
}

/** Revoke a user's session credits by setting the ledger balance to an absolute
 *  target (default 0). Used on refund.processed to claw back single-session
 *  credits a refunded buyer would otherwise keep. Writes the authoritative
 *  `session_credits` TABLE via the `reconcile_session_credits` RPC (which also
 *  records a credit_ledger entry) — NOT the long-dropped `profiles.session_credits`
 *  column. Returns the new balance, or null if the RPC failed. */
export async function revokeSessionCredits(
  baseUrl: string,
  serviceKey: string,
  userId: string,
  targetBalance = 0,
  note = "refund revoke",
  fetchImpl: FetchImpl = fetch,
): Promise<number | null> {
  const res = await fetchImpl(`${baseUrl}/rest/v1/rpc/reconcile_session_credits`, {
    method: "POST",
    headers: authHeaders(serviceKey, { "Content-Type": "application/json" }),
    body: JSON.stringify({ p_user_id: userId, p_correct_balance: targetBalance, p_note: note }),
  });
  if (!res.ok) {
    console.error(`reconcile_session_credits RPC failed (${res.status}) revoking credits for ${userId}`);
    return null;
  }
  const newBalance = await res.json().catch(() => null);
  return typeof newBalance === "number" ? newBalance : null;
}
