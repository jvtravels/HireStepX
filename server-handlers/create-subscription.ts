/* Retired: HireStepX sells no auto-renewing plan (Sprint Pack is a one-time,
   30-day purchase — see create-order.ts). This endpoint used to create a
   Razorpay recurring subscription; it now answers 410 Gone so nothing can
   start a recurring charge. cancel/pause/reactivate-subscription stay live so
   any legacy subscriber can still manage or stop theirs. */

import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({ error: "Subscriptions are no longer offered. Buy a one-time Sprint Pack or single sessions at /pricing." });
}
