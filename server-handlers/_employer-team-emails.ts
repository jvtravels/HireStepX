/* Team invite email. Best-effort: the invite row is already committed, and the
   admin also gets a copyable link, so a failed send never fails the request. */

import { escapeHtml, slog } from "./_shared";
import { emailShell, title, para, b, button } from "./_email-theme";
import { INVITE_TTL_DAYS, ROLE_LABEL, ROLE_BLURB, type EmployerRole, type InvitableRole } from "./_employer-team-helpers";

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
  return sendEmail(params.to, `${params.inviterName || "A teammate"} invited you to ${params.companyName || "their team"} on HireStepX`, html);
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) slog.warn("[team-email] rejected", { status: res.status });
    return res.ok;
  } catch (err) {
    slog.warn("[team-email] failed", { err: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

export type TeamChange =
  | { kind: "role_changed"; role: EmployerRole }
  | { kind: "removed" }
  | { kind: "ownership_received" };

/* Tells someone their access changed. Removal matters most: without it a
   person finds out only when the console stops working. */
export function teamChangeCopy(change: TeamChange, companyName: string, actorName: string): { subject: string; heading: string; message: string } {
  const company = companyName || "your team";
  switch (change.kind) {
    case "removed":
      return {
        subject: `You no longer have access to ${company} on HireStepX`,
        heading: `You were removed from ${company}`,
        message: `${actorName} removed you from ${company}, so you can no longer open its jobs or candidates. Your own HireStepX account is unchanged.`,
      };
    case "ownership_received":
      return {
        subject: `You are now the owner of ${company} on HireStepX`,
        heading: `You now own ${company}`,
        message: `${actorName} made you the owner of ${company}. You can manage billing, teammates and the company profile.`,
      };
    case "role_changed":
      return {
        subject: `Your role at ${company} is now ${ROLE_LABEL[change.role]}`,
        heading: `You are now ${ROLE_LABEL[change.role]}`,
        message: `${actorName} changed your role at ${company} to ${ROLE_LABEL[change.role]}. ${ROLE_BLURB[change.role]}`,
      };
  }
}

export async function sendTeamChangeEmail(params: { to: string; change: TeamChange; companyName: string; actorName: string }): Promise<boolean> {
  if (!(process.env.RESEND_API_KEY || "").trim()) return false;
  const copy = teamChangeCopy(params.change, params.companyName, params.actorName || "A teammate");
  const html = emailShell({
    preview: copy.message,
    body: title(escapeHtml(copy.heading)) + para(escapeHtml(copy.message)) +
      (params.change.kind === "removed" ? "" : button("Open the console", `${appBaseUrl()}/employer/team`)),
  });
  return sendEmail(params.to, copy.subject, html);
}
