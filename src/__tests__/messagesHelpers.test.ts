import { describe, it, expect } from "vitest";
import {
  asMessageBody,
  asFlagReason,
  asFlagNote,
  resolveRole,
  detectContactInfoFlag,
  inferAttachmentExtension,
  isConversationUnread,
  MAX_MESSAGE_BODY_LEN,
} from "../../server-handlers/_messages-helpers";

describe("asMessageBody", () => {
  it("trims and caps the body", () => {
    expect(asMessageBody("  hello  ")).toBe("hello");
    expect(asMessageBody("a".repeat(5000)).length).toBe(MAX_MESSAGE_BODY_LEN);
  });

  it("returns empty string for non-string input", () => {
    expect(asMessageBody(undefined)).toBe("");
    expect(asMessageBody(42)).toBe("");
  });
});

describe("asFlagReason / asFlagNote", () => {
  it("caps reason to 100 chars", () => {
    expect(asFlagReason("a".repeat(200)).length).toBe(100);
  });

  it("returns null for empty note", () => {
    expect(asFlagNote("   ")).toBeNull();
    expect(asFlagNote(undefined)).toBeNull();
  });
});

describe("resolveRole", () => {
  it("identifies the employer", () => {
    expect(resolveRole("u1", "u1", "u2")).toBe("employer");
  });
  it("identifies the candidate", () => {
    expect(resolveRole("u2", "u1", "u2")).toBe("candidate");
  });
  it("returns null for a stranger", () => {
    expect(resolveRole("u3", "u1", "u2")).toBeNull();
  });
});

describe("detectContactInfoFlag", () => {
  it("flags an email address", () => {
    expect(detectContactInfoFlag("reach me at jane@example.com")).toBe("email_detected");
  });

  it("flags an Indian mobile number", () => {
    expect(detectContactInfoFlag("call me on 9876543210")).toBe("phone_number_detected");
  });

  it("flags a +91-prefixed number", () => {
    expect(detectContactInfoFlag("+91 98765 43210")).toBe("phone_number_detected");
  });

  it("flags spelled-out digits", () => {
    expect(detectContactInfoFlag("my number is nine eight seven six five four three two one")).toBe(
      "spelled_out_number_detected",
    );
  });

  it("flags off-platform contact phrases", () => {
    expect(detectContactInfoFlag("let's chat on whatsapp instead")).toBe("off_platform_contact_phrase");
  });

  it("flags 'dm me' phrasing", () => {
    expect(detectContactInfoFlag("just dm me on instagram")).toBe("off_platform_contact_phrase");
  });

  it("returns null for an ordinary message", () => {
    expect(detectContactInfoFlag("Thanks for your interest, when are you free for a call this week?")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(detectContactInfoFlag("")).toBeNull();
  });
});

describe("inferAttachmentExtension", () => {
  it("maps known mime types", () => {
    expect(inferAttachmentExtension("application/pdf")).toBe("pdf");
    expect(inferAttachmentExtension("image/png")).toBe("png");
  });

  it("rejects an unknown mime type", () => {
    expect(inferAttachmentExtension("application/x-msdownload")).toBeNull();
  });
});

describe("isConversationUnread", () => {
  it("is false when there is no message yet", () => {
    expect(isConversationUnread("employer", null, null, null)).toBe(false);
  });

  it("is false when the viewer sent the last message", () => {
    expect(isConversationUnread("employer", "2026-01-01T00:00:00Z", "employer", null)).toBe(false);
  });

  it("is true when the other side sent the last message and the viewer has never read", () => {
    expect(isConversationUnread("employer", "2026-01-01T00:00:00Z", "candidate", null)).toBe(true);
  });

  it("is true for a system message the viewer hasn't read", () => {
    expect(isConversationUnread("candidate", "2026-01-01T00:00:00Z", "system", null)).toBe(true);
  });

  it("is false once the viewer's last read is after the message", () => {
    expect(isConversationUnread("employer", "2026-01-01T00:00:00Z", "candidate", "2026-01-02T00:00:00Z")).toBe(false);
  });

  it("is true when a new message arrives after the viewer's last read", () => {
    expect(isConversationUnread("employer", "2026-01-02T00:00:00Z", "candidate", "2026-01-01T00:00:00Z")).toBe(true);
  });
});
