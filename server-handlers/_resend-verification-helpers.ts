/* Pure logic behind /api/resend-verification. The HTTP handler decides the
   (always identical) response first and then runs processResendVerification
   in the background, so nothing here can change what the caller sees. */

import { emailShell, title, para, b, link, button, escapeHtml } from "./_email-theme";
import { findAuthUserByEmail, isEmailVerified, isOAuthOnlyUser } from "./_auth-user-lookup";

export const RESEND_GENERIC_MESSAGE =
  "If an account exists and is not yet verified, we have sent a new link.";

/** Per hour. Tight on purpose: a legit user needs one or two resends. */
export const RESEND_EMAIL_LIMIT = 3;
export const RESEND_IP_LIMIT = 10;
export const RESEND_WINDOW_MS = 60 * 60 * 1000;

export interface ResendDeps {
  supabaseUrl: string;
  serviceKey: string;
  resendApiKey: string;
  fromEmail: string;
  appUrl: string;
  /** False when the HMAC secret is too weak to issue tokens that would verify. */
  canIssueTokens: boolean;
  makeToken: (email: string) => string;
  fetchImpl?: typeof fetch;
}

export type ResendOutcome =
  | "sent"
  | "skipped-no-account"
  | "skipped-verified"
  | "skipped-oauth"
  | "not-configured"
  | "lookup-failed"
  | "send-failed";

function verificationEmailHtml(name: string, verifyUrl: string): string {
  return emailShell({
    preview: "A fresh link to confirm your email. Valid for 24 hours.",
    body:
      title("Here's your new", { accentWord: "link." }) +
      para(`Hi ${escapeHtml(name)}, you asked for another verification link. Confirm your email and your ${b("2 free mock interviews")} are ready.`) +
      button("Verify my email", verifyUrl) +
      para(
        `This link works for ${b("24 hours")}. Older links may stop working. If you didn't ask for this, you can safely ignore this email.`,
        { small: true, muted: true },
      ) +
      para(`Button not working? Copy this link:<br>${link(verifyUrl, verifyUrl)}`, { small: true, muted: true }),
  });
}

export async function processResendVerification(
  deps: ResendDeps,
  email: string,
): Promise<ResendOutcome> {
  if (!deps.supabaseUrl || !deps.serviceKey || !deps.resendApiKey || !deps.canIssueTokens) {
    return "not-configured";
  }
  const fetchImpl = deps.fetchImpl ?? fetch;

  const lookup = await findAuthUserByEmail(deps.supabaseUrl, deps.serviceKey, email, fetchImpl);
  if (!lookup.ok) return "lookup-failed";
  if (!lookup.user) return "skipped-no-account";
  if (isOAuthOnlyUser(lookup.user)) return "skipped-oauth";
  if (isEmailVerified(lookup.user)) return "skipped-verified";

  const token = deps.makeToken(email);
  const verifyUrl = `${deps.appUrl}/api/verify-email?email=${encodeURIComponent(email)}&token=${token}`;
  const rawName = lookup.user.user_metadata?.name;
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 48) : "there";

  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.resendApiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from: deps.fromEmail,
        to: [email],
        subject: "Your new verification link",
        html: verificationEmailHtml(name, verifyUrl),
      }),
    });
    return res.ok ? "sent" : "send-failed";
  } catch {
    return "send-failed";
  }
}
