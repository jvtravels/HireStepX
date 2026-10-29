/* Emails that mirror employer in-app notifications: credit refunded, matches
   ready, teammate joined. Every sender is best-effort and never throws: the
   event it reports (refund, stage flip, join) is already committed. */

import { slog, escapeHtml } from "./_shared";
import { emailShell, hero, para, button, dataCard } from "./_email-theme";
import { sendEmployerEmail, type BuiltEmail } from "./_employer-emails";
import { employerMarketingParts, isSuppressed, preferenceDepsFromEnv } from "./_unsubscribe";
import { loadAuthIdentity } from "./_entitlements";

declare const process: { env: Record<string, string | undefined> };

const appUrl = () => (process.env.APP_URL || "https://hirestepx.com").replace(/\/$/, "");
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const clip = (s: string, n: number) => s.trim().slice(0, n);

export function buildCreditRefundedEmail(opts: { candidateCount: number; amountPaise: number; reasonLabel: string }): BuiltEmail & { text: string } {
  const { candidateCount: n } = opts;
  const amount = rupees(opts.amountPaise);
  const subject = `${amount} credit added to your HireStepX account`;
  const what = n === 1 ? "A candidate you unlocked can't be reached" : `${n} candidates you unlocked can't be reached`;
  const reason = opts.reasonLabel.toLowerCase();
  const lede = `${what} (${reason}), so ${amount} is back in your account as credit.`;
  const html = emailShell({
    preview: lede,
    body:
      hero({ tone: "success", eyebrow: "Credit added", title: `${amount} is back in your account`, lede: escapeHtml(lede) }) +
      dataCard("Credit", [["Amount", amount], ["Candidates", String(n)], ["Reason", escapeHtml(opts.reasonLabel)]]) +
      para("It applies automatically to your next unlock. The contact details of the affected candidates are locked again.") +
      button("View your credit", `${appUrl()}/employer/settings`),
    footer: { manageUrl: `${appUrl()}/employer/settings` },
  });
  const text = `${lede}\n\nIt applies automatically to your next unlock. The contact details of the affected candidates are locked again.\n\nView your credit: ${appUrl()}/employer/settings`;
  return { subject, html, text };
}

export function buildMatchesReadyEmail(opts: { requirementId: string; roleTitle: string }, footer?: Parameters<typeof emailShell>[0]["footer"]): BuiltEmail {
  const role = clip(opts.roleTitle, 60) || "your role";
  const subject = `Candidates are ready to review for your ${role} role`;
  const html = emailShell({
    preview: subject,
    body:
      hero({ eyebrow: "Matches ready", title: "Your candidates are ready", lede: `We found candidates for ${escapeHtml(role)}, ranked on evidence from their mock interviews.` }) +
      para("Browsing is free. You pay only when you unlock a candidate's contact details.") +
      button("Review candidates", `${appUrl()}/employer/requirements/${encodeURIComponent(opts.requirementId)}`),
    footer,
  });
  return { subject, html };
}

export function buildTeamJoinedEmail(opts: { memberName: string; roleLabel: string }, footer?: Parameters<typeof emailShell>[0]["footer"]): BuiltEmail {
  const who = clip(opts.memberName, 80) || "Your teammate";
  const subject = `${who} joined your team on HireStepX`;
  const html = emailShell({
    preview: subject,
    body:
      hero({ tone: "success", eyebrow: "Team update", title: `${escapeHtml(who)} joined your team`, lede: `They accepted your invite as ${escapeHtml(opts.roleLabel)}.` }) +
      button("Open your team", `${appUrl()}/employer/team`),
    footer,
  });
  return { subject, html };
}

async function emailFor(employerId: string): Promise<string | null> {
  if (!(process.env.RESEND_API_KEY || "").trim()) return null;
  const base = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const { email } = await loadAuthIdentity(base, { apikey: key, Authorization: `Bearer ${key}` }, employerId);
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** A receipt for money the employer is owed: always sent, even after an alert opt-out. */
export async function sendCreditRefundedEmail(opts: { employerId: string; candidateCount: number; amountPaise: number; reasonLabel: string; dedupeKey: string }): Promise<void> {
  try {
    const to = await emailFor(opts.employerId);
    if (!to) return;
    const { text, ...mail } = buildCreditRefundedEmail(opts);
    await sendEmployerEmail({ to, ...mail, idempotencyKey: `credit-refunded-${opts.dedupeKey}`, extra: { text } });
  } catch (err) {
    slog.warn("[credit-refunded-email] threw", { err: err instanceof Error ? err.message : String(err) });
  }
}

/** An alert: honours the employer_notifications opt-out. */
async function sendAlert(userId: string, build: (footer: Parameters<typeof emailShell>[0]["footer"]) => BuiltEmail, idempotencyKey: string): Promise<void> {
  try {
    const to = await emailFor(userId);
    if (!to) return;
    if (await isSuppressed(preferenceDepsFromEnv(), userId, "employer_notifications")) return;
    const parts = await employerMarketingParts(userId);
    await sendEmployerEmail({ to, ...build(parts.footer), idempotencyKey, extra: parts.resend });
  } catch (err) {
    slog.warn("[employer-alert-email] threw", { key: idempotencyKey, err: err instanceof Error ? err.message : String(err) });
  }
}

export const sendMatchesReadyEmail = (opts: { employerId: string; requirementId: string; roleTitle: string }) =>
  sendAlert(opts.employerId, (f) => buildMatchesReadyEmail(opts, f), `matches-ready-${opts.requirementId}`);

export const sendTeamJoinedEmail = (opts: { ownerId: string; memberId: string; memberName: string; roleLabel: string }) =>
  sendAlert(opts.ownerId, (f) => buildTeamJoinedEmail(opts, f), `team-joined-${opts.ownerId}-${opts.memberId}`);
