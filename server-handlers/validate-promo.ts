/* Vercel Edge Function — Validate and apply promo/coupon codes */
/* POST { code, plan } → { valid, discount_percent, discount_amount, final_amount } */

export const config = { runtime: "edge" };

import { handleCorsPreflightOrMethod, corsHeaders, verifyAuth, unauthorizedResponse, validateOrigin, withRequestId } from "./_shared";
import { checkPromoValidity, computeDiscountAmount } from "./_promo";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const PLAN_AMOUNT: Record<string, number> = { weekly: 4900, monthly: 14900 };

export default async function handler(req: Request): Promise<Response> {
  const earlyResponse = handleCorsPreflightOrMethod(req);
  if (earlyResponse) return earlyResponse;

  const headers = withRequestId(corsHeaders(req));

  if (!validateOrigin(req)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
  }

  const auth = await verifyAuth(req);
  if (!auth.authenticated) return unauthorizedResponse(headers);

  const body = await req.json().catch(() => ({})) as { code?: string; plan?: string };
  const code = body.code?.trim().toUpperCase();
  const plan = body.plan;

  if (!code || !plan || !PLAN_AMOUNT[plan]) {
    return new Response(JSON.stringify({ error: "Missing code or plan" }), { status: 400, headers });
  }

  const dbHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  // Look up promo code
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(code)}&select=*`,
    { headers: dbHeaders },
  );
  const rows = await res.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return new Response(JSON.stringify({ valid: false, error: "Invalid promo code" }), { status: 200, headers });
  }

  const promo = rows[0];

  // Validity is a READ-ONLY preview. The code's usage count is NOT touched
  // here — it is consumed exactly once in verify-payment after a successful
  // charge, so previews and abandoned checkouts never burn a use.
  const validity = checkPromoValidity(promo, plan, Date.now());
  if (!validity.valid) {
    return new Response(JSON.stringify({ valid: false, error: validity.error }), { status: 200, headers });
  }

  const originalAmount = PLAN_AMOUNT[plan];
  const discountAmount = computeDiscountAmount(promo, originalAmount);
  const finalAmount = Math.max(0, originalAmount - discountAmount);

  return new Response(JSON.stringify({
    valid: true,
    discount_percent: promo.discount_percent,
    discount_amount: discountAmount,
    original_amount: originalAmount,
    final_amount: finalAmount,
    code,
  }), { status: 200, headers });
}
