import { describe, it, expect } from "vitest";
import {
  pickProfileRow,
  buildExportEnvelope,
  buildExportFilename,
  shapeMatchesForExport,
  shapeStatusEventsForExport,
  shapeConversationsForExport,
  shapeMessagesForExport,
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

describe("employer-discovery export", () => {
  const rawMatches = [
    { id: "m-locked", created_at: "2026-10-01", unlocked: false, unlocked_at: null, profile_viewed_at: "2026-10-02", candidate_response: "none", employer_requirements: { title: "Backend Dev", employers: { company_name: "Acme" } } },
    { id: "m-open", created_at: "2026-10-03", unlocked: true, unlocked_at: "2026-10-04", profile_viewed_at: "2026-10-04", candidate_response: "interested", candidate_responded_at: "2026-10-05", employer_requirements: { title: "SRE", employers: { company_name: "Globex" } } },
  ];

  it("reveals employer company and role ONLY for unlocked matches", () => {
    const { shaped, unlockedIds } = shapeMatchesForExport(rawMatches);
    const [locked, open] = shaped as Array<Record<string, unknown>>;
    expect(locked.employer_company).toBeNull();
    expect(locked.role_title).toBeNull();
    expect(locked.unlocked_at).toBeNull();
    expect(open.employer_company).toBe("Globex");
    expect(open.role_title).toBe("SRE");
    expect(open.your_response).toBe("interested");
    expect([...unlockedIds]).toEqual(["m-open"]);
    // the shaped rows never carry raw employer/requirement ids
    expect(JSON.stringify(shaped)).not.toContain("employer_id");
  });

  it("skips malformed rows and tolerates non-arrays", () => {
    expect(shapeMatchesForExport(null).shaped).toEqual([]);
    expect(shapeMatchesForExport([null, {}, { id: 5 }]).shaped).toEqual([]);
  });

  it("hides employer-authored event notes until the match is unlocked, but keeps the candidate's own", () => {
    const events = [
      { id: "e1", match_id: "m-locked", to_status: "shortlisted", actor: "employer", note: "Acme wants you" },
      { id: "e2", match_id: "m-open", to_status: "shortlisted", actor: "employer", note: "Globex note" },
      { id: "e3", match_id: "m-locked", to_status: "candidate_interested", actor: "candidate", note: "mine" },
    ];
    const out = shapeStatusEventsForExport(events, new Set(["m-open"])) as Array<{ note: string | null }>;
    expect(out.map((e) => e.note)).toEqual([null, "Globex note", "mine"]);
  });

  it("names the employer on a conversation only when its match is unlocked", () => {
    const { companyByMatch } = shapeMatchesForExport(rawMatches);
    const out = shapeConversationsForExport([{ id: "c1", match_id: "m-locked" }, { id: "c2", match_id: "m-open" }], companyByMatch) as Array<{ employer_company: string | null }>;
    expect(out.map((c) => c.employer_company)).toEqual([null, "Globex"]);
  });

  it("exports message bodies but not storage paths", () => {
    const out = shapeMessagesForExport([{ id: "x", conversation_id: "c1", sender_role: "employer", body: "hi", attachment_name: "cv.pdf", attachment_path: "secret/path", created_at: "t" }]);
    expect(JSON.stringify(out)).not.toContain("secret/path");
    expect(out[0]).toMatchObject({ body: "hi", attachment_name: "cv.pdf" });
  });

  it("envelope defaults the new sections so older callers keep working", () => {
    const env = buildExportEnvelope({
      userId: "u", userEmail: "e", exportedAt: "t", profile: [], sessions: [], calendar_events: [], payments: [], feedback: [], interview_turns: [], llm_usage: [],
    });
    expect(env.employer_discovery.consent_log).toEqual([]);
    expect(env.employer_account).toBeNull();
  });

  it("envelope carries supplied employer sections through", () => {
    const env = buildExportEnvelope({
      userId: "u", userEmail: "e", exportedAt: "t", profile: [], sessions: [], calendar_events: [], payments: [], feedback: [], interview_turns: [], llm_usage: [],
      employer_discovery: { visibility: "off", visibility_updated_at: "t", consent_log: [{ action: "withdrawn" }], blocks: [], reports_filed: [], matches: [], status_events: [], conversations: [], messages: [] },
      employer_account: { employer: { id: "u" }, requirements: [], unlock_payments: [{ id: "p" }], unlock_orders: [], messages_sent: [] },
    });
    expect(env.employer_discovery.visibility).toBe("off");
    expect(env.employer_account?.unlock_payments).toHaveLength(1);
  });
});
