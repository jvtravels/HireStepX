import { describe, it, expect } from "vitest";
import {
  buildShareMessage,
  freeSessionsEarned,
  inviteStatusLabel,
  linkedInShareUrl,
  mailtoShareUrl,
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
});
