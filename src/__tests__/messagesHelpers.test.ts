import { describe, it, expect } from "vitest";
import {
  asMessageBody,
  asFlagReason,
  asFlagNote,
  resolveRole,
  detectContactInfoFlag,
  inferAttachmentExtension,
  isConversationUnread,
  isSelfConversation,
  MAX_MESSAGE_BODY_LEN,
  redactContactInfo,
  messageBodyForViewer,
  CONTACT_REDACTION_MARK,
  employerMessageCap,
  isSafeAttachmentPath,
  attachmentBytesMatchType,
  candidateSendBlock,
  EMPLOYER_MESSAGE_WINDOW_MS,
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

describe("isSelfConversation", () => {
  it("flags a match whose employer and candidate are the same account", () => {
    expect(isSelfConversation("u1", "u1")).toBe(true);
  });

  it("allows distinct parties", () => {
    expect(isSelfConversation("u1", "u2")).toBe(false);
  });
});

describe("redactContactInfo", () => {
  it("masks emails and phone numbers and reports that it did", () => {
    const r = redactContactInfo("Yes interested, mail me at asha@example.com or call 98765 43210");
    expect(r.redacted).toBe(true);
    expect(r.text).not.toContain("asha@example.com");
    expect(r.text).not.toMatch(/98765/);
    expect(r.text).toContain(CONTACT_REDACTION_MARK);
  });

  it("leaves a clean body and empty input untouched", () => {
    expect(redactContactInfo("Happy to talk on Tuesday")).toEqual({ text: "Happy to talk on Tuesday", redacted: false });
    expect(redactContactInfo("")).toEqual({ text: "", redacted: false });
  });
});

describe("messageBodyForViewer", () => {
  const body = "reach me at asha@example.com";
  it("hides contact in a candidate message only while the employer is locked out", () => {
    expect(messageBodyForViewer(body, "candidate", true)).not.toContain("asha@example.com");
    expect(messageBodyForViewer(body, "candidate", false)).toBe(body);
  });
  it("does not rewrite the employer's own or system messages", () => {
    expect(messageBodyForViewer(body, "employer", true)).toBe(body);
    expect(messageBodyForViewer(body, "system", true)).toBe(body);
  });
});

describe("employerMessageCap", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it("is not limited under the cap", () => {
    expect(employerMessageCap(Array.from({ length: 19 }, () => ago(1000)), now)).toEqual({ limited: false, retryAfterSeconds: 0 });
  });

  it("limits at the cap and reports when the oldest counted message ages out", () => {
    const sent = Array.from({ length: 20 }, (_, i) => ago(i === 19 ? 23 * 3_600_000 : 1000));
    const r = employerMessageCap(sent, now);
    expect(r.limited).toBe(true);
    expect(r.retryAfterSeconds).toBe(3600);
  });

  it("ignores messages outside the window and unparseable timestamps", () => {
    const sent = [...Array.from({ length: 19 }, () => ago(1000)), ago(EMPLOYER_MESSAGE_WINDOW_MS + 1000), "garbage"];
    expect(employerMessageCap(sent, now).limited).toBe(false);
  });
});

describe("isSafeAttachmentPath", () => {
  const M = "11111111-1111-4111-8111-111111111111";
  it("accepts <matchId>/<name>", () => {
    expect(isSafeAttachmentPath(`${M}/abc-123.pdf`, M)).toBe(true);
  });
  it.each([`${M}/../x.pdf`, `${M}/..%2f`, `/${M}/a.pdf`, `${M}\\a.pdf`, `${M}/a/b.pdf`, `${M}/`, `${M}/a b.pdf`, "other/a.pdf", `${M}/..`])("rejects %s", (p) => {
    expect(isSafeAttachmentPath(p, M)).toBe(false);
  });
});

describe("attachmentBytesMatchType", () => {
  const b = (...n: number[]) => new Uint8Array(n);
  it("checks magic bytes per declared type", () => {
    expect(attachmentBytesMatchType(b(0x25, 0x50, 0x44, 0x46, 0x2d), "application/pdf")).toBe(true);
    expect(attachmentBytesMatchType(b(0x3c, 0x68, 0x74, 0x6d), "application/pdf")).toBe(false);
    expect(attachmentBytesMatchType(b(0xff, 0xd8, 0xff), "image/jpeg")).toBe(true);
    expect(attachmentBytesMatchType(b(0x50, 0x4b, 0x03, 0x04), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(attachmentBytesMatchType(b(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50), "image/webp")).toBe(true);
    expect(attachmentBytesMatchType(b(0x25, 0x50, 0x44, 0x46), "image/png")).toBe(false);
    expect(attachmentBytesMatchType(b(0x25, 0x50, 0x44, 0x46), "application/x-msdownload")).toBe(false);
  });
  it("rejects binary content declared as text/plain", () => {
    expect(attachmentBytesMatchType(new TextEncoder().encode("hello\nworld"), "text/plain")).toBe(true);
    expect(attachmentBytesMatchType(b(0x4d, 0x5a, 0x00), "text/plain")).toBe(false);
  });
});

describe("candidateSendBlock new-thread rule", () => {
  const match = (over: Record<string, unknown>) => ({
    employer_requirements: { employers: { suspended_at: null } }, unlocked: false, candidate_response: null, candidate_status: "shortlisted", ...over,
  }) as unknown as Parameters<typeof candidateSendBlock>[0];
  it("blocks a cold new thread, even when the candidate is interested, but not a reply or a thread after contact", () => {
    expect(candidateSendBlock(match({}), false)?.code).toBe("no_relationship");
    expect(candidateSendBlock(match({}), true)).toBeNull();
    expect(candidateSendBlock(match({ unlocked: true }), false)).toBeNull();
    expect(candidateSendBlock(match({ candidate_response: "interested" }), false)?.code).toBe("no_relationship");
    for (const candidate_status of ["interview_invited", "interviewing", "hired"]) {
      expect(candidateSendBlock(match({ candidate_status }), false)).toBeNull();
    }
  });
});
