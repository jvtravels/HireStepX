/* HireStepX — One-shot verification-token consumption ledger.

   The HMAC validator in _email-verify-helpers.ts only proves a token
   is well-formed and unexpired. It does NOT prove the token hasn't
   been used. Without this layer:

     • An attacker who intercepted the verification email could click
       the link from their own device, get the account verified,
       then the legitimate user clicks → "verified=already" — fine,
       but the attacker also got a (brief) chance to set up a session
       under the verified account.
     • If EMAIL_VERIFICATION_SECRET ever leaks, an attacker can forge
       arbitrary tokens for any email and have them accepted
       indefinitely until the 48h window expires.

   `consumeToken()` records that a token has been used by inserting
   its SHA-256 hash into used_verification_tokens. Insert-on-conflict
   semantics (PRIMARY KEY token_hash) make first-write wins:

     • First call: 201 Created → consumeToken returns "consumed"
     • Subsequent calls: conflict (status 409 from PostgREST with
       Prefer: return=minimal) → returns "already-used"

   The handler MUST treat "already-used" as a hard reject (redirect
   to login with error=replay), NOT as the existing
   "custom_email_verified === true" idempotent-success branch — the
   former is a security event, the latter is a benign re-click. */

import { createHash } from "crypto";

export type ConsumeTokenResult =
  | { ok: true; status: "consumed" }
  | { ok: true; status: "already-used" }
  | { ok: false; status: "config-missing" }
  | { ok: false; status: "error"; message: string };

/** SHA-256 hex of the raw token. We store the hash, not the token,
    so a leak of the ledger doesn't double as a leak of unused tokens. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Try to record a token as consumed. Returns:
 *    { ok: true, status: "consumed" }     — first time, accept the verify
 *    { ok: true, status: "already-used" } — replay, REJECT the verify
 *    { ok: false, ... }                   — infra fault; caller decides
 *
 *  Fails CLOSED on infra errors: a missing/unreachable Supabase
 *  shouldn't silently let replay through. The handler converts
 *  infra-fault into a "try again" redirect, not a success. */
export async function consumeToken(
  supabaseUrl: string,
  serviceKey: string,
  token: string,
  email: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<ConsumeTokenResult> {
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, status: "config-missing" };
  }
  const tokenHash = hashToken(token);
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/used_verification_tokens`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          // return=minimal keeps the body small; resolution=ignore-
          // duplicates would silently swallow a replay (we DO want to
          // distinguish first-write from conflict), so we let
          // PostgREST raise 409 on conflict and inspect the status.
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          token_hash: tokenHash,
          email: email.toLowerCase().trim(),
        }),
      },
    );
    if (res.status >= 200 && res.status < 300) {
      return { ok: true, status: "consumed" };
    }
    if (res.status === 409) {
      // Primary-key conflict — token already in the ledger. This is
      // the replay-defense path.
      return { ok: true, status: "already-used" };
    }
    // Any other 4xx/5xx is treated as infra fault. Notably 404 means
    // the migration hasn't run yet — the handler should fail-closed
    // with a "try again" message rather than skip the consumption
    // step (which would let replay through).
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      status: "error",
      message: `HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
