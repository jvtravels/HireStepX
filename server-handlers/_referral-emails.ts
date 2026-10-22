/* Referral lifecycle emails + in-app notifications. Best-effort: callers
   fire these after the reward is already committed and ignore failures. */

import { escapeHtml } from "./_shared";
import { emailShell, title, para, b, button } from "./_email-theme";
import { notify } from "./_notify";

declare const process: { env: Record<string, string | undefined> };

const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.com").replace(/\/$/, "");

async function send(to: string, subject: string, html: string): Promise<void> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    signal: AbortSignal.timeout(8_000),
  }).catch((err) => console.warn("[referral] email failed:", err?.message));
}

const firstName = (name: string | null | undefined) => escapeHtml(name?.split(" ")[0] || "there");

/** Referred friend: credit landed at signup. */
export async function notifyReferredWelcome(userId: string, email: string | null, name: string | null): Promise<void> {
  void notify({
    userId,
    type: "referral_reward",
    title: "Welcome bonus unlocked",
    body: "A free practice session has been added to your account.",
    link: "/session/new",
  });
  if (!email) return;
  await send(
    email,
    "Your invite reward is here — one free session added",
    emailShell({
      preview: "Your referral credit is in. Start a free session now.",
      body:
        title("One free session", { accentWord: "added." }) +
        para(`Hi ${firstName(name)}, a free practice session has been added to your account because a friend invited you. ${b("Finish your first interview and they earn one too.")}`) +
        button("Start your free session", `${APP_URL}/session/new`) +
        para("You can invite friends of your own from the Referrals page.", { small: true, muted: true }),
    }),
  );
}

/** Referrer: told a friend joined (reward is pending their first session). */
export function notifyReferrerJoined(referrerId: string): void {
  void notify({
    userId: referrerId,
    type: "referral_reward",
    title: "A friend joined with your link",
    body: "Your free session unlocks when they finish their first interview.",
    link: "/referrals",
  });
}

/** Referrer: reward paid because the friend completed a real first session. */
export async function notifyReferrerPaid(referrerId: string, email: string | null, name: string | null): Promise<void> {
  void notify({
    userId: referrerId,
    type: "referral_reward",
    title: "Your referral paid off!",
    body: "A friend you invited finished their first interview — a free session is in your account.",
    link: "/referrals",
  });
  if (!email) return;
  await send(
    email,
    "Your invite worked — a free session is yours",
    emailShell({
      preview: "A friend you invited finished their first interview.",
      body:
        title("Your invite", { accentWord: "worked." }) +
        para(`Hi ${firstName(name)}, a friend you invited just finished their first interview on HireStepX. ${b("A free practice session has been added to your account.")}`) +
        button("Start your free session", `${APP_URL}/session/new`) +
        para("Keep sharing your link from the Referrals page.", { small: true, muted: true }),
    }),
  );
}
