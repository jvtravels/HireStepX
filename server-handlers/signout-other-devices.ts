/* Vercel Edge Function — Sign out all other devices
 *
 * Calls Supabase's user-scoped `auth/v1/logout?scope=others` with the
 * caller's bearer token to revoke every refresh token except the one
 * tied to the current session, then pins user_metadata to the current
 * device via the admin API: `active_device_token` becomes the caller's
 * local token and `recent_devices` is trimmed to just this device.
 *
 * This is the server-side complement to the existing single-device
 * enforcement in `AuthContext.tsx`. Without the metadata rotation, a
 * stale tab on another device could still pass the token-mismatch
 * check on its next poll because its cached metadata snapshot still
 * lists itself as active.
 *
 * POST /api/signout-other-devices
 *   { deviceToken: string, userAgent?: string }
 *
 * Body shape mirrors what the client already tracks locally:
 *   - deviceToken: the value set by storeDeviceToken() on this device
 *   - userAgent:   trimmed UA string for the recent_devices entry
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import {
  buildMetadataPatch,
  validateSignoutBody,
  type SignoutBody,
} from "./_signout-other-devices-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "signout-other-devices",
    ipLimit: 20,
    userLimit: 8,
    maxBytes: 4_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: SignoutBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const validated = validateSignoutBody(body);
  if (!validated.ok) {
    return new Response(JSON.stringify({ error: validated.error }), { status: 400, headers });
  }
  const { deviceToken } = validated.value;

  const callerBearer = (req.headers.get("authorization") || "").slice(7);

  /* Step 1 — revoke every refresh token except the caller's via the
     user-scoped logout endpoint. The current session is preserved by
     `scope=others`. Failure here is fatal: if we can't revoke we don't
     pretend we did. */
  const revokeRes = await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=others`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${callerBearer}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  if (!revokeRes.ok && revokeRes.status !== 204) {
    return new Response(JSON.stringify({ error: "Failed to revoke other sessions" }), {
      status: 502,
      headers,
    });
  }

  /* Step 2 — pin user_metadata to just this device. We deliberately
     trim recent_devices to a single entry so a refreshed Settings page
     can't show a stale "other device" the user just kicked off. */
  const adminPatch = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(auth.userId)}`, {
    method: "PUT",
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildMetadataPatch(validated.value, Date.now())),
  });
  if (!adminPatch.ok) {
    return new Response(JSON.stringify({ error: "Failed to rotate device token" }), {
      status: 502,
      headers,
    });
  }

  return new Response(JSON.stringify({ ok: true, deviceToken }), { status: 200, headers });
}
