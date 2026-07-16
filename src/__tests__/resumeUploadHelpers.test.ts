import { describe, it, expect } from "vitest";
import { base64ToBytes, inferExtension, VERSION_ID_RE } from "../../server-handlers/_resume-upload-helpers";

/* ─── base64ToBytes ──────────────────────────────────────────────────── */

describe("base64ToBytes", () => {
  it("decodes a known base64 string to the correct bytes", () => {
    // "Hello" in ASCII = [72, 101, 108, 108, 111]
    const bytes = base64ToBytes(btoa("Hello"));
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it("returns an empty Uint8Array for an empty base64 string", () => {
    const bytes = base64ToBytes(btoa(""));
    expect(bytes.length).toBe(0);
  });

  it("round-trips arbitrary binary content", () => {
    const original = new Uint8Array([0, 127, 200, 255, 1, 99]);
    const b64 = btoa(String.fromCharCode(...original));
    const decoded = base64ToBytes(b64);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it("correctly decodes a 1-byte payload (edge of padding)", () => {
    const bytes = base64ToBytes(btoa("A"));
    expect(bytes.length).toBe(1);
    expect(bytes[0]).toBe(65); // ASCII 'A'
  });

  it("throws on invalid base64 input", () => {
    // atob throws DOMException on malformed input — the handler catches this
    // and returns 400 "Invalid base64 file content".
    expect(() => base64ToBytes("not!!valid##base64@@")).toThrow();
  });
});

/* ─── inferExtension ─────────────────────────────────────────────────── */

describe("inferExtension", () => {
  it("returns pdf for application/pdf", () => {
    expect(inferExtension("application/pdf", "resume.pdf")).toBe("pdf");
  });

  it("returns pdf when content-type merely contains 'pdf'", () => {
    expect(inferExtension("application/x-pdf", "file")).toBe("pdf");
  });

  it("returns docx for application/vnd.openxmlformats-officedocument.wordprocessingml.document", () => {
    expect(inferExtension(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "resume.docx",
    )).toBe("docx");
  });

  it("returns docx when content-type contains 'docx'", () => {
    expect(inferExtension("application/docx", "file")).toBe("docx");
  });

  it("returns txt for text/plain", () => {
    expect(inferExtension("text/plain", "resume.txt")).toBe("txt");
  });

  it("falls back to the file-name extension when MIME is unknown", () => {
    expect(inferExtension("application/octet-stream", "resume.pdf")).toBe("pdf");
    expect(inferExtension("application/octet-stream", "cv.DOCX")).toBe("docx"); // lowercased
  });

  it("returns bin when MIME is unknown and file has no extension", () => {
    expect(inferExtension("application/octet-stream", "resume")).toBe("bin");
  });

  it("returns bin for an empty filename and unknown MIME", () => {
    expect(inferExtension("application/octet-stream", "")).toBe("bin");
  });

  it("content-type takes precedence over file-name extension", () => {
    // If someone sends contentType=application/pdf but fileName=cv.docx
    // we should trust the MIME type, not the name.
    expect(inferExtension("application/pdf", "cv.docx")).toBe("pdf");
  });
});

/* ─── VERSION_ID_RE ──────────────────────────────────────────────────── */

describe("VERSION_ID_RE", () => {
  it("accepts a standard lowercase UUID", () => {
    expect(VERSION_ID_RE.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("accepts a UUID without hyphens (32 hex chars)", () => {
    expect(VERSION_ID_RE.test("550e8400e29b41d4a716446655440000")).toBe(true);
  });

  it("accepts uppercase hex characters", () => {
    expect(VERSION_ID_RE.test("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects strings shorter than 32 characters", () => {
    expect(VERSION_ID_RE.test("550e8400-e29b-41d4")).toBe(false);
    expect(VERSION_ID_RE.test("abc123")).toBe(false);
  });

  it("rejects SQL injection patterns", () => {
    expect(VERSION_ID_RE.test("'; DROP TABLE resumes; --")).toBe(false);
    expect(VERSION_ID_RE.test("1 OR 1=1")).toBe(false);
    expect(VERSION_ID_RE.test("../../../etc/passwd")).toBe(false);
  });

  it("rejects version IDs containing non-hex characters", () => {
    // g-z are not hex digits
    expect(VERSION_ID_RE.test("gggggggg-gggg-gggg-gggg-gggggggggggg")).toBe(false);
    expect(VERSION_ID_RE.test("zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(VERSION_ID_RE.test("")).toBe(false);
  });

  it("rejects path-traversal characters", () => {
    expect(VERSION_ID_RE.test("550e8400/../evil/path/550e8400e29b41d4a716446655440000")).toBe(false);
  });
});
