export type InviteStatus = "pending" | "redeemed" | "rewarded";

export interface ReferralStats {
  total: number;
  redeemed: number;
  rewarded: number;
}

/** Each side of a redeemed referral gets this many session credits (mirrors REFERRAL_REWARD_CREDITS server-side). */
export const SESSIONS_PER_REFERRAL = 1;

/** Public referral conditions; mirror the server constants in
 *  server-handlers/_referral-reward-helpers.ts (a test pins them together). */
export const REFERRAL_TERMS = {
  newAccountWindowDays: 7,
  minAnswersForPayout: 3,
  dailyCap: 20,
  lifetimeCap: 50,
} as const;

export function referralTermsText(): string {
  const t = REFERRAL_TERMS;
  return `Conditions: your friend must sign up with your link within their first ${t.newAccountWindowDays} days of creating an account. You are credited after their first practice session with at least ${t.minAnswersForPayout} answered questions. Rewards are capped at ${t.dailyCap} referrals per day and ${t.lifetimeCap} per person in total. Credits are practice sessions, not cash. We may withhold credits for self-referrals or abuse.`;
}

export function buildShareMessage(link: string): string {
  return `I'm practising interviews with AI on HireStepX. Sign up with my link and get a free practice session: ${link}`;
}

export function whatsAppShareUrl(link: string): string {
  return `https://wa.me/?text=${encodeURIComponent(buildShareMessage(link))}`;
}

export function linkedInShareUrl(link: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`;
}

export function mailtoShareUrl(link: string): string {
  return `mailto:?subject=${encodeURIComponent("Free interview practice on HireStepX")}&body=${encodeURIComponent(buildShareMessage(link))}`;
}

export function inviteStatusLabel(status: InviteStatus): string {
  if (status === "rewarded") return "Free session earned";
  if (status === "redeemed") return "Joined";
  return "Pending";
}

export function freeSessionsEarned(stats: ReferralStats): number {
  return stats.rewarded * SESSIONS_PER_REFERRAL;
}
