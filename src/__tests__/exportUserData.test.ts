import { describe, it, expect } from "vitest";
import {
  pickProfileRow,
  buildExportEnvelope,
  buildExportFilename,
} from "../../server-handlers/_export-user-data-helpers";

/**
 * export-user-data is the DPDP / GDPR data-portability endpoint. The
 * worst-case bug here is leaking another user's row in the profile slot
 * (Supabase REST always returns an array, even for `?id=eq.X`), or
 * accepting an unsanitized userId into the Content-Disposition filename
 * header. Both cases are covered.
 */

describe("pickProfileRow", () => {
  it("returns null on empty array", () => {
    expect(pickProfileRow([])).toBeNull();
  });

  it("returns null when input is not an array", () => {
    expect(pickProfileRow(null)).toBeNull();
    expect(pickProfileRow({ id: "x" })).toBeNull();
    expect(pickProfileRow(undefined)).toBeNull();
  });

  it("returns the FIRST row only (never indices > 0)", () => {
    const rows = [{ id: "user-a" }, { id: "user-b" }];
    expect(pickProfileRow(rows)).toEqual({ id: "user-a" });
  });

  it("returns null when the first row is null", () => {
    expect(pickProfileRow([null])).toBeNull();
  });
});

describe("buildExportEnvelope", () => {
  const baseInputs = {
    userId: "abc123",
    userEmail: "user@example.com",
    exportedAt: "2026-05-02T10:00:00Z",
    profile: [{ id: "abc123", name: "Aarti" }],
    sessions: [{ id: "s1" }],
    calendar_events: [],
    payments: [],
    feedback: [],
    interview_turns: [{ id: "t1" }],
    llm_usage: [],
  };

  it("includes the legal-compliance notice in _meta", () => {
    const env = buildExportEnvelope(baseInputs);
    expect(env._meta.notice).toMatch(/personal data/i);
    expect(env._meta.format).toBe("HireStepX User Data Export v1");
  });

  it("uses the injected exportedAt timestamp (deterministic for tests)", () => {
    const env = buildExportEnvelope(baseInputs);
    expect(env._meta.exportedAt).toBe("2026-05-02T10:00:00Z");
  });

  it("flattens the profile array to its first row", () => {
    const env = buildExportEnvelope(baseInputs);
    expect(env.profile).toEqual({ id: "abc123", name: "Aarti" });
  });

  it("returns profile=null when Supabase returns []", () => {
    const env = buildExportEnvelope({ ...baseInputs, profile: [] });
    expect(env.profile).toBeNull();
  });

  it("preserves all the secondary collection arrays as-is", () => {
    const env = buildExportEnvelope(baseInputs);
    expect(env.sessions).toBe(baseInputs.sessions);
    expect(env.interview_turns).toBe(baseInputs.interview_turns);
    expect(env.calendar_events).toEqual([]);
  });

  it("places _meta first so the legal notice is at the top of the download", () => {
    const env = buildExportEnvelope(baseInputs);
    const keys = Object.keys(env);
    expect(keys[0]).toBe("_meta");
  });

  it("auto-generates exportedAt when not provided", () => {
    const { exportedAt: _omit, ...rest } = baseInputs;
    void _omit;
    const env = buildExportEnvelope(rest);
    expect(env._meta.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("buildExportFilename", () => {
  const fixedDate = new Date("2026-05-02T10:00:00Z");

  it("produces the canonical hirestepx-export-<8>-<YYYY-MM-DD>.json shape", () => {
    expect(buildExportFilename("abcdef1234567890", fixedDate)).toBe(
      "hirestepx-export-abcdef12-2026-05-02.json",
    );
  });

  it("strips characters not allowed in a header filename (header-injection guard)", () => {
    // A user id with quote/CRLF chars must never break the Content-Disposition header.
    const filename = buildExportFilename('aa"bb\r\n; evil', fixedDate);
    expect(filename).not.toContain('"');
    expect(filename).not.toContain("\r");
    expect(filename).not.toContain("\n");
    expect(filename).not.toContain(";");
  });

  it("falls back to 'user' when userId becomes empty after sanitization", () => {
    expect(buildExportFilename("!!!", fixedDate)).toBe(
      "hirestepx-export-user-2026-05-02.json",
    );
  });

  it("truncates user-id prefix to 8 chars even for very long ids", () => {
    const filename = buildExportFilename("a".repeat(50), fixedDate);
    expect(filename).toBe("hirestepx-export-aaaaaaaa-2026-05-02.json");
  });
});
