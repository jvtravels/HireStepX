import { describe, it, expect } from "vitest";
import {
  REFERRAL_NEW_ACCOUNT_WINDOW_MS,
  REFERRAL_PAYOUT_MIN_QUESTIONS,
  REFERRAL_REWARD_DAILY_CAP,
  REFERRAL_REWARD_LIFETIME_CAP,
} from "../../server-handlers/_referral-reward-helpers";
import {
  buildShareMessage,
  freeSessionsEarned,
  inviteStatusLabel,
  linkedInShareUrl,
  mailtoShareUrl,
  REFERRAL_TERMS,
  referralTermsText,
  whatsAppShareUrl,
} from "../referralShare";

const LINK = "https://app.hirestepx.com/signup?ref=HSX-ABC123";

describe("referralShare", () => {
  it("puts the attributed link in the share message", () => {
    expect(buildShareMessage(LINK)).toContain(LINK);
  });

  it("encodes the link and message for each channel", () => {
    expect(whatsAppShareUrl(LINK)).toBe(`https://wa.me/?text=${encodeURIComponent(buildShareMessage(LINK))}`);
    expect(linkedInShareUrl(LINK)).toBe(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(LINK)}`);
    const mail = mailtoShareUrl(LINK);
    expect(mail.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(mail)).toContain(LINK);
  });

  it("labels every invite status", () => {
    expect(inviteStatusLabel("pending")).toBe("Pending");
    expect(inviteStatusLabel("redeemed")).toBe("Joined");
    expect(inviteStatusLabel("rewarded")).toBe("Free session earned");
  });

  it("counts free sessions from rewarded referrals only", () => {
    expect(freeSessionsEarned({ total: 5, redeemed: 3, rewarded: 2 })).toBe(2);
    expect(freeSessionsEarned({ total: 0, redeemed: 0, rewarded: 0 })).toBe(0);
  });

  it("public referral terms match the server constants", () => {
    expect(REFERRAL_TERMS.newAccountWindowDays * 24 * 60 * 60 * 1000).toBe(REFERRAL_NEW_ACCOUNT_WINDOW_MS);
    expect(REFERRAL_TERMS.minAnswersForPayout).toBe(REFERRAL_PAYOUT_MIN_QUESTIONS);
    expect(REFERRAL_TERMS.dailyCap).toBe(REFERRAL_REWARD_DAILY_CAP);
    expect(REFERRAL_TERMS.lifetimeCap).toBe(REFERRAL_REWARD_LIFETIME_CAP);
    expect(referralTermsText()).toContain("20 referrals per day");
    expect(referralTermsText()).toContain("50 per person");
  });
});
