/* Team invite email. Best-effort: the invite row is already committed, and the
   admin also gets a copyable link, so a failed send never fails the request. */

import { escapeHtml, slog } from "./_shared";
import { emailShell, hero, para, b, button } from "./_email-theme";
import { INVITE_TTL_DAYS, ROLE_LABEL, ROLE_BLURB, type EmployerRole, type InvitableRole } from "./_employer-team-helpers";

declare const process: { env: Record<string, string | undefined> };

const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <hello@hirestepx.com>";

export function appBaseUrl(): string {
  return (process.env.APP_URL || "https://hirestepx.com").replace(/\/$/, "");
}

/* Names typed in caps lock ("JAY VYAS") read as shouting in an email. */
function displayName(name: string): string {
  const n = name.trim();
  if (n && n === n.toUpperCase() && n !== n.toLowerCase()) {
    return n.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
  }
  return n;
}

export function inviteLink(token: string): string {
  return `${appBaseUrl()}/employer/join?token=${encodeURIComponent(token)}`;
}

async function sha256Hex(v: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export async function sendTeamInviteEmail(params: {
  to: string;
  token: string;
  companyName: string;
  inviterName: string;
  inviterEmail?: string;
  role: InvitableRole;
}): Promise<boolean> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) return false;
  const companyText = params.companyName || "the team";
  const inviterText = displayName(params.inviterName) || "A teammate";
  const company = escapeHtml(companyText);
  const inviter = escapeHtml(inviterText);
  const html = emailShell({
    preview: `${inviterText} invited you to ${companyText} on HireStepX.`,
    body:
      hero({
        eyebrow: "Team invite",
        title: `Join ${company}`,
        lede: `${inviter} invited you to ${b(company)} as ${b(ROLE_LABEL[params.role])}. ${escapeHtml(ROLE_BLURB[params.role])}`,
      }) +
      button("Accept invite", inviteLink(params.token)) +
      para(`This link works for ${INVITE_TTL_DAYS} days and only for this email address. If you weren't expecting it, you can ignore this email.`, { small: true, muted: true }),
    footer: { reason: "You're receiving this because a teammate invited this address to join their team on HireStepX." },
  });
  const text = [
    `${inviterText} invited you to ${companyText} on HireStepX as ${ROLE_LABEL[params.role]}.`,
    ROLE_BLURB[params.role],
    "",
    `Accept the invite: ${inviteLink(params.token)}`,
    "",
    `This link works for ${INVITE_TTL_DAYS} days and only for this email address. If you weren't expecting it, you can ignore this email.`,
  ].join("\n");
  // Keyed on a hash of the token so a double click or retry can't send twice, and a resend (new token) still goes out.
  const idempotencyKey = `team-invite-${(await sha256Hex(params.token)).slice(0, 32)}`;
  return sendEmail(params.to, `${inviterText} invited you to ${params.companyName || "their team"} on HireStepX`, html, { text, replyTo: params.inviterEmail, idempotencyKey });
}

/* A 2xx from Resend means it accepted the message, not that it was delivered, so the
   message id is logged to match a "sent" invite against the Resend dashboard. */
async function sendEmail(to: string, subject: string, html: string, extra: { text?: string; replyTo?: string; idempotencyKey?: string } = {}): Promise<boolean> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) {
    slog.warn("[team-email] RESEND_API_KEY is not set; nothing was sent");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(extra.idempotencyKey ? { "Idempotency-Key": extra.idempotencyKey } : {}) },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html, ...(extra.text ? { text: extra.text } : {}), ...(extra.replyTo ? { reply_to: extra.replyTo } : {}) }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      slog.warn("[team-email] rejected", { status: res.status, body: (await res.text().catch(() => "")).slice(0, 300) });
      return false;
    }
    const sent = (await res.json().catch(() => null)) as { id?: string } | null;
    slog.info("[team-email] accepted by Resend", { id: sent?.id ?? null, domain: to.split("@")[1] ?? null });
    return true;
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
    body:
      hero({ eyebrow: "Team update", title: escapeHtml(copy.heading), lede: escapeHtml(copy.message) }) +
      (params.change.kind === "removed" ? "" : button("Open the console", `${appBaseUrl()}/employer/team`)),
    footer: { manageUrl: `${appBaseUrl()}/employer/settings` },
  });
  // 10-minute bucket: absorbs a retry, but a real second change later still sends.
  const role = params.change.kind === "role_changed" ? params.change.role : "-";
  const idempotencyKey = `team-change-${params.to}-${params.change.kind}-${role}-${Math.floor(Date.now() / 600_000)}`;
  return sendEmail(params.to, copy.subject, html, { idempotencyKey });
}
