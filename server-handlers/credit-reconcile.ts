/* POST /api/credit-reconcile
 *
 * Self-healing endpoint: rebuilds a user's session_credits balance from the
 * authoritative payments table when the live balance is wrong (missing row,
 * shows 0 after purchases, or otherwise inconsistent).
 *
 * Algorithm:
 *   1. Read all "single" payments for this user from the payments table.
 *   2. Count total credits granted (sum of quantity per payment record).
 *   3. Read all consume operations from credit_ledger to count credits spent.
 *   4. Correct balance = granted - consumed (floor 0).
 *   5. If computed balance ≠ current balance → write it via reconcile_session_credits RPC.
 *   6. Return { before, after, granted_total, consumed_total } for auditability.
 *
 * Rate limited aggressively (5 calls/min/user) — it's a corrective path, not
 * a polling path. Idempotent: calling it twice produces the same result.
 *
 * Security: user can only reconcile their own balance (JWT userId check).
 * The corrective write goes through the service role RPC, not a direct PATCH.
 */
export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders } from "./_shared";

declare const process: { env: Record<string, string | undefined> };

function serviceHeaders(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "credit-reconcile",
    ipLimit: 20,
    userLimit: 5,
    maxBytes: 0,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const getHeaders = { ...headers, ...corsHeaders(req) };

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "service_unavailable" }), { status: 503, headers: getHeaders });
  }

  const userId = auth.userId ?? "";
  if (!userId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: getHeaders });
  }

  try {
    // ── 1. Total credits granted from payments table ──────────────────────────
    // The payments table records every successful single-session purchase.
    // `notes` column is a JSONB blob containing `{ quantity: N }` set at
    // create-order time and preserved through the payment lifecycle.
    const paymentsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?user_id=eq.${encodeURIComponent(userId)}&plan=eq.single&status=eq.completed&select=id,razorpay_payment_id,amount,created_at`,
      { headers: serviceHeaders(SERVICE_ROLE_KEY) },
    );
    if (!paymentsRes.ok) {
      throw new Error(`payments read failed: ${paymentsRes.status}`);
    }
    const payments = await paymentsRes.json() as Array<{ id: string; amount: number }>;

    // Each single session costs 900 paise (₹9). Quantity = amount / 900.
    // Cap at 10 per order (matches create-order and grantSessionCredits clamp).
    const SINGLE_PAISE = 900;
    const grantedTotal = payments.reduce((sum, p) => {
      const qty = Math.min(Math.max(Math.round(p.amount / SINGLE_PAISE), 1), 10);
      return sum + qty;
    }, 0);

    // ── 2. Total credits consumed from ledger ─────────────────────────────────
    // Only count rows written by the SQL functions (operation = 'consume').
    // If ledger doesn't exist yet (PGRST205 / non-ok), refuse auto-reconcile:
    // silently treating consumed=0 would over-credit (set balance = all grants
    // ever, ignoring every session the user has already spent credits on).
    let consumedTotal = 0;
    let ledgerAvailable = false;
    try {
      const ledgerRes = await fetch(
        `${SUPABASE_URL}/rest/v1/credit_ledger?user_id=eq.${encodeURIComponent(userId)}&operation=eq.consume&select=quantity`,
        { headers: serviceHeaders(SERVICE_ROLE_KEY) },
      );
      if (ledgerRes.ok) {
        const rows = await ledgerRes.json() as Array<{ quantity: number }>;
        // quantity is negative for consume rows (e.g. -1); sum and negate.
        consumedTotal = rows.reduce((sum, r) => sum + Math.abs(r.quantity), 0);
        ledgerAvailable = true;
      }
    } catch { /* network error — treat as unavailable */ }

    // If the ledger table hasn't been migrated yet, report what we know but
    // do NOT auto-write a balance (it would ignore consumed credits entirely).
    if (!ledgerAvailable) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "ledger_unavailable",
          message: "credit_ledger table not found — run the SQL migration first. Auto-reconcile disabled to prevent over-crediting.",
          granted_total: grantedTotal,
          payment_count: payments.length,
        }),
        { status: 409, headers: getHeaders },
      );
    }

    // ── 3. Computed correct balance ───────────────────────────────────────────
    const computedBalance = Math.max(0, grantedTotal - consumedTotal);

    // ── 4. Current live balance ───────────────────────────────────────────────
    const liveRes = await fetch(
      `${SUPABASE_URL}/rest/v1/session_credits?user_id=eq.${encodeURIComponent(userId)}&select=balance`,
      { headers: serviceHeaders(SERVICE_ROLE_KEY) },
    );
    const liveRows = liveRes.ok ? await liveRes.json() as Array<{ balance: number }> : [];
    const currentBalance = Array.isArray(liveRows) && liveRows.length > 0 ? liveRows[0].balance : 0;

    // ── 5. Write correction if needed ─────────────────────────────────────────
    let finalBalance = currentBalance;
    let reconciled = false;

    if (computedBalance !== currentBalance) {
      // Use direct service-role upsert (reconcile_session_credits SQL RPC is the
      // eventual target, but requires a Supabase migration; upsert works today).
      // Prefer the RPC if it exists (it writes an audit ledger row), fall back
      // immediately to upsert on any non-2xx.
      let writeOk = false;

      // Try the RPC first; any failure falls through to the upsert.
      try {
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reconcile_session_credits`, {
          method: "POST",
          headers: serviceHeaders(SERVICE_ROLE_KEY),
          body: JSON.stringify({
            p_user_id: userId,
            p_correct_balance: computedBalance,
            p_note: `reconcile: granted=${grantedTotal} consumed=${consumedTotal} prev=${currentBalance}`,
          }),
        });
        if (rpcRes.ok) writeOk = true;
      } catch { /* RPC not available — fall through to direct upsert */ }

      if (!writeOk) {
        // Direct service-role upsert: INSERT … ON CONFLICT (user_id) DO UPDATE.
        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/session_credits`, {
          method: "POST",
          headers: {
            ...serviceHeaders(SERVICE_ROLE_KEY),
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            user_id: userId,
            balance: computedBalance,
            updated_at: new Date().toISOString(),
          }),
        });
        if (upsertRes.ok) {
          writeOk = true;
        } else {
          const errText = await upsertRes.text().catch(() => "");
          console.error(`[credit-reconcile] upsert failed (${upsertRes.status}): ${errText}`);
          throw new Error(`reconcile write failed: ${upsertRes.status} — ${errText.slice(0, 200)}`);
        }
      }

      if (writeOk) {
        finalBalance = computedBalance;
        reconciled = true;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        balance: finalBalance,
        before: currentBalance,
        after: finalBalance,
        granted_total: grantedTotal,
        consumed_total: consumedTotal,
        reconciled,
        payment_count: payments.length,
      }),
      { status: 200, headers: getHeaders },
    );
  } catch (err) {
    console.error("[credit-reconcile] error:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ error: "reconcile_failed" }),
      { status: 500, headers: getHeaders },
    );
  }
}
