/* Team invite email. Best-effort: the invite row is already committed, and the
   admin also gets a copyable link, so a failed send never fails the request. */

import { escapeHtml, slog } from "./_shared";
import { emailShell, title, para, b, button } from "./_email-theme";
import { INVITE_TTL_DAYS, ROLE_LABEL, ROLE_BLURB, type InvitableRole } from "./_employer-team-helpers";

declare const process: { env: Record<string, string | undefined> };

const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";

export function appBaseUrl(): string {
  return (process.env.APP_URL || "https://hirestepx.com").replace(/\/$/, "");
}

export function inviteLink(token: string): string {
  return `${appBaseUrl()}/employer/join?token=${encodeURIComponent(token)}`;
}

export async function sendTeamInviteEmail(params: {
  to: string;
  token: string;
  companyName: string;
  inviterName: string;
  role: InvitableRole;
}): Promise<boolean> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) return false;
  const company = escapeHtml(params.companyName || "the team");
  const inviter = escapeHtml(params.inviterName || "A teammate");
  const html = emailShell({
    preview: `${params.inviterName || "A teammate"} invited you to ${params.companyName || "their company"} on HireStepX.`,
    body:
      title(`Join ${company}`) +
      para(`${inviter} invited you to ${b(company)} as ${b(ROLE_LABEL[params.role])}. ${escapeHtml(ROLE_BLURB[params.role])}`) +
      button("Accept invite", inviteLink(params.token)) +
      para(`This link works for ${INVITE_TTL_DAYS} days and only for ${escapeHtml(params.to)}. If you weren't expecting it, you can ignore this email.`, { small: true, muted: true }),
  });
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [params.to],
        subject: `${params.inviterName || "A teammate"} invited you to ${params.companyName || "their team"} on HireStepX`,
        html,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) slog.warn("[team-invite] email rejected", { status: res.status });
    return res.ok;
  } catch (err) {
    slog.warn("[team-invite] email failed", { err: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
