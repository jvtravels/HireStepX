/* Cloudflare Turnstile token verification.

   Site key (NEXT_PUBLIC_TURNSTILE_SITE_KEY) is rendered into the
   client widget. Secret key (TURNSTILE_SECRET_KEY) lives only on the
   server and validates tokens against Cloudflare's siteverify endpoint.

   If TURNSTILE_SECRET_KEY is missing (dev / preview without env), this
   helper returns ok=true so signup/reset-request flows still work
   locally. Production should always have the key set.

   Reference: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
*/

const TURNSTILE_SECRET_KEY = (process.env.TURNSTILE_SECRET_KEY || "").trim();
const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface VerifyResult {
  ok: boolean;
  /** Why verification failed — opaque error code from Cloudflare. */
  reason?: string;
}

/** Verify a Turnstile token. Pass `req.headers["cf-connecting-ip"]` or
    similar as `clientIp` if available — improves replay protection.
    Tokens are single-use and expire 5 minutes after issue. */
export async function verifyTurnstile(
  token: string | undefined,
  clientIp?: string,
): Promise<VerifyResult> {
  // Not configured — fail open for dev / preview.
  if (!TURNSTILE_SECRET_KEY) {
    return { ok: true };
  }
  if (!token) {
    return { ok: false, reason: "missing-token" };
  }
  try {
    const body = new URLSearchParams();
    body.set("secret", TURNSTILE_SECRET_KEY);
    body.set("response", token);
    if (clientIp) body.set("remoteip", clientIp);

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: ac.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      return { ok: false, reason: `siteverify-status-${res.status}` };
    }
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success) return { ok: true };
    return {
      ok: false,
      reason: data["error-codes"]?.join(",") || "unknown",
    };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "fetch-error",
    };
  }
}
