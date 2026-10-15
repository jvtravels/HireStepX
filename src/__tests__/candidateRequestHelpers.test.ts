import { describe, expect, it } from "vitest";
import {
  asRequestResolution,
  isMissingTableResponse,
  isUniqueViolation,
  parseCreateRequest,
  requestHeadline,
  requestNotificationText,
  resolutionNotificationText,
  toRequestDto,
} from "../../server-handlers/_candidate-request-helpers";

describe("parseCreateRequest", () => {
  it("rejects an unknown kind", () => {
    expect(parseCreateRequest({ kind: "nuke" }).ok).toBe(false);
  });

  it("contact needs at least one valid field", () => {
    expect(parseCreateRequest({ kind: "contact", fields: [] }).ok).toBe(false);
    const r = parseCreateRequest({ kind: "contact", fields: ["phone", "email"] });
    expect(r.ok && r.value.fields).toEqual(["phone", "email"]);
  });

  it("document and practice need a topic, clarification needs a note", () => {
    expect(parseCreateRequest({ kind: "document" }).ok).toBe(false);
    expect(parseCreateRequest({ kind: "practice" }).ok).toBe(false);
    expect(parseCreateRequest({ kind: "clarification", topic: "Gap" }).ok).toBe(false);
    expect(parseCreateRequest({ kind: "document", topic: "Certificate" }).ok).toBe(true);
    expect(parseCreateRequest({ kind: "clarification", note: "Why the gap in 2022?" }).ok).toBe(true);
  });

  it("trims and caps free text", () => {
    const r = parseCreateRequest({ kind: "document", topic: `  ${"a".repeat(300)}  ` });
    expect(r.ok && r.value.topic?.length).toBe(120);
  });

  it("refuses contact details in free text so requests cannot dodge the unlock fee", () => {
    expect(parseCreateRequest({ kind: "clarification", note: "email me at a@b.com" }).ok).toBe(false);
    expect(parseCreateRequest({ kind: "document", topic: "Certificate", note: "call 9876543210" }).ok).toBe(false);
  });
});

describe("wording", () => {
  it("builds headlines per kind", () => {
    expect(requestHeadline({ kind: "contact", topic: null, fields: ["phone", "email"] })).toBe("Contact details: phone number and email address");
    expect(requestHeadline({ kind: "document", topic: "Certificate", fields: null })).toBe("Certificate");
    expect(requestHeadline({ kind: "practice", topic: "SQL", fields: null })).toBe("Practice answer: SQL");
    expect(requestHeadline({ kind: "clarification", topic: null, fields: null })).toBe("A question about your profile");
  });

  it("uses the supplied (already masked) company name", () => {
    const t = requestNotificationText("Confidential company", "SRE", { kind: "document", topic: "Certificate", fields: null });
    expect(t.title).toBe("Confidential company sent you a request");
    expect(t.body).toContain("SRE");
  });

  it("words resolutions for the employer", () => {
    expect(resolutionNotificationText("fulfilled", { kind: "document", topic: "Certificate", fields: null }, "Candidate A").body).toContain("shared");
    expect(resolutionNotificationText("declined", { kind: "document", topic: "Certificate", fields: null }, "Candidate A").title).toContain("declined");
  });
});

describe("misc", () => {
  it("accepts only candidate-allowed resolutions", () => {
    expect(asRequestResolution("fulfilled")).toBe("fulfilled");
    expect(asRequestResolution("declined")).toBe("declined");
    expect(asRequestResolution("cancelled")).toBeNull();
  });

  it("detects a missing table and unique violations", () => {
    expect(isMissingTableResponse(404, "")).toBe(true);
    expect(isMissingTableResponse(400, '{"code":"42P01"}')).toBe(true);
    expect(isMissingTableResponse(500, "boom")).toBe(false);
    expect(isUniqueViolation(409, "")).toBe(true);
    expect(isUniqueViolation(400, '{"code":"23505"}')).toBe(true);
  });

  it("maps a row to the DTO without leaking ids of other parties", () => {
    const dto = toRequestDto({ id: "r", match_id: "m", kind: "document", topic: "T", fields: null, note: null, status: "pending", response_note: null, created_at: "c", resolved_at: null });
    expect(dto).toEqual({ id: "r", kind: "document", topic: "T", fields: null, note: null, status: "pending", responseNote: null, createdAt: "c", resolvedAt: null });
  });
});

