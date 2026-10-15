import { describe, it, expect, vi, beforeEach } from "vitest";

const apiFetch = vi.fn();
vi.mock("../apiClient", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { archiveResumeFile } from "../resumeArchive";

// jsdom's File has no arrayBuffer(); real browsers do.
function withBytes(file: File, bytes: Uint8Array): File {
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  return file;
}
const pdf = (text = "hello") => withBytes(new File([text], "cv.pdf", { type: "application/pdf" }), new TextEncoder().encode(text));

beforeEach(() => apiFetch.mockReset());

describe("archiveResumeFile", () => {
  it("posts the file as base64 with its version id", async () => {
    apiFetch.mockResolvedValue({ ok: true });
    expect(await archiveResumeFile(pdf("hello"), "ver-1")).toBe(true);
    expect(apiFetch).toHaveBeenCalledWith("/api/resume/upload-file", {
      resumeVersionId: "ver-1", fileName: "cv.pdf", contentType: "application/pdf", fileBase64: btoa("hello"),
    });
  });

  it("skips when there is no version id or the file is empty or too large", async () => {
    expect(await archiveResumeFile(pdf(), null)).toBe(false);
    expect(await archiveResumeFile(pdf(""), "ver-1")).toBe(false);
    expect(await archiveResumeFile(withBytes(new File([new Uint8Array(9_000_001)], "big.pdf"), new Uint8Array(0)), "ver-1")).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("reports false instead of throwing when the upload or file read fails", async () => {
    apiFetch.mockResolvedValue({ ok: false });
    expect(await archiveResumeFile(pdf(), "ver-1")).toBe(false);
    const unreadable = new File(["x"], "cv.pdf");
    Object.defineProperty(unreadable, "arrayBuffer", { value: () => { throw new Error("unreadable"); } });
    expect(await archiveResumeFile(unreadable, "ver-1")).toBe(false);
  });
});
