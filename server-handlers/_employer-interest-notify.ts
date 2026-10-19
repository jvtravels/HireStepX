/* Tells a candidate an employer has unlocked their profile (the "Employer
   interested" badge on /jobs). Deliberately generic, like the profile-viewed
   email: no company name, so it cannot be used to identify or pressure the
   candidate before they respond. Never throws. */
import { slog } from "./_shared";
import { emailShell, title as emailTitle, para, button, escapeHtml } from "./_email-theme";
import { isSuppressed, marketingEmailParts, preferenceDepsFromEnv } from "./_unsubscribe";
import type { NotifyInput } from "./_notify";

declare const process: { env: Record<string, string | undefined> };

export interface InterestTarget {
  matchId: string;
  candidateUserId: string;
  name: string | null;
  email: string | null;
}

export function interestNotification(t: InterestTarget): NotifyInput {
  return {
    userId: t.candidateUserId,
    type: "employer_contact_request",
    title: "An employer is interested in you",
    body: "They can now reach out to you directly. Open the role to see the match and reply when you are ready.",
    link: `/jobs/${t.matchId}`,
    actionLabel: "View role",
    groupKey: `interest:${t.candidateUserId}`,
  };
}

async function sendInterestEmail(t: InterestTarget, fetchImpl: typeof fetch): Promise<void> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey || !t.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email)) return;
  if (await isSuppressed(preferenceDepsFromEnv(), t.candidateUserId, "employer_notifications")) return;
  const parts = await marketingEmailParts(t.candidateUserId, "employer_notifications");
  const appUrl = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");
  const firstName = escapeHtml((t.name || "there").split(" ")[0]);
  const headline = "An employer is interested in your profile.";
  const html = emailShell({
    footer: parts.footer,
    preview: headline,
    body:
      emailTitle("An employer is", { accentWord: "interested" }) +
      para(`Hi ${firstName}, ${headline} They can now contact you directly, so keep an eye on your inbox. You can switch employer visibility off any time in Settings.`) +
      button("View the role", `${appUrl}/jobs/${encodeURIComponent(t.matchId)}`),
  });
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>",
      to: [t.email],
      subject: "An employer is interested in your profile - HireStepX",
      html,
      ...parts.resend,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) slog.warn("[sendInterestEmail] resend failed", { status: res.status });
}

export async function notifyCandidatesOfInterest(p: {
  targets: InterestTarget[];
  notifyFn: (input: NotifyInput) => Promise<void> | void;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const f = p.fetchImpl ?? fetch;
  await Promise.all(
    p.targets.map(async (t) => {
      try {
        await p.notifyFn(interestNotification(t));
        await sendInterestEmail(t, f);
      } catch (err) {
        slog.warn("[notifyCandidatesOfInterest] failed", { err: err instanceof Error ? err.message : String(err) });
      }
    }),
  );
}
