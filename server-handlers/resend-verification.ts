/* Public "send me a new verification link" endpoint.

   Anti-enumeration contract: for any well-formed request that is not
   IP-limited the response is the same 200 body, whether the account exists,
   is already verified, is OAuth-only, or the per-email limit was hit. The
   lookup and the send run after that response is chosen (via after()), so
   they cannot show up as timing or shape differences either. */

import { after } from "next/server";
import {
  checkBodySize,
  corsHeaders,
  forbiddenResponse,
  getClientIp,
  handleCorsPreflightOrMethod,
  hashStable,
  isRateLimited,
  rateLimitResponse,
  readBodyWithSizeLimit,
  tooLargeResponse,
  validateOrigin,
  withRequestId,
} from "./_shared";
import { normalizeAuthEmail } from "./_auth-user-lookup";
import {
  processResendVerification,
  RESEND_EMAIL_LIMIT,
  RESEND_GENERIC_MESSAGE,
  RESEND_IP_LIMIT,
  RESEND_WINDOW_MS,
} from "./_resend-verification-helpers";
import { assertEmailSecret, generateVerifyToken } from "./send-welcome";
import { isDisposableEmailServer } from "./_disposable-emails";

const MAX_BODY_BYTES = 2_000;

export default async function handler(req: Request): Promise<Response> {
  const early = handleCorsPreflightOrMethod(req);
  if (early) return early;
  const headers = withRequestId(corsHeaders(req));

  if (checkBodySize(req, MAX_BODY_BYTES)) return tooLargeResponse(headers);
  if (!validateOrigin(req)) return forbiddenResponse(headers);

  if (await isRateLimited(getClientIp(req), "resend-verification", RESEND_IP_LIMIT, RESEND_WINDOW_MS)) {
    return rateLimitResponse(headers, RESEND_WINDOW_MS / 1000);
  }

  let rawEmail: unknown;
  try {
    const parsed: unknown = JSON.parse((await readBodyWithSizeLimit(req, MAX_BODY_BYTES)) || "{}");
    rawEmail = parsed && typeof parsed === "object" ? (parsed as { email?: unknown }).email : undefined;
  } catch (err) {
    if (err instanceof Response) return err;
    rawEmail = undefined;
  }

  const generic = () =>
    new Response(JSON.stringify({ ok: true, message: RESEND_GENERIC_MESSAGE }), { status: 200, headers });

  const email = normalizeAuthEmail(rawEmail);
  if (!email || isDisposableEmailServer(email)) return generic();

  const emailHash = await hashStable(email);
  if (await isRateLimited(emailHash, "resend-verification-email", RESEND_EMAIL_LIMIT, RESEND_WINDOW_MS)) {
    return generic();
  }

  const work = async () => {
    try {
      const outcome = await processResendVerification(
        {
          supabaseUrl: process.env.SUPABASE_URL || "",
          serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
          resendApiKey: (process.env.RESEND_API_KEY || "").trim(),
          fromEmail: process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>",
          appUrl: (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, ""),
          canIssueTokens: assertEmailSecret(),
          makeToken: generateVerifyToken,
        },
        email,
      );
      if (outcome === "not-configured" || outcome === "lookup-failed" || outcome === "send-failed") {
        console.error(`[resend-verification] ${outcome} (email_hash=${emailHash})`);
      }
    } catch (err) {
      console.error("[resend-verification] unexpected failure:", err instanceof Error ? err.message : "unknown");
    }
  };
  try { after(work); } catch { await work(); } // after() throws outside a request (tests)

  return generic();
}
