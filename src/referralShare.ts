export type InviteStatus = "pending" | "redeemed" | "rewarded";

export interface ReferralStats {
  total: number;
  redeemed: number;
  rewarded: number;
}

/** Each side of a redeemed referral gets this many session credits (mirrors REFERRAL_REWARD_CREDITS server-side). */
export const SESSIONS_PER_REFERRAL = 1;

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
