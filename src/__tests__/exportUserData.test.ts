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
      employer_account: { employer: { id: "u" }, requirements: [], unlock_payments: [{ id: "p" }], unlock_orders: [], messages_sent: [], requirement_activity: [], credit_ledger: [], credit_notes: [] },
    });
    expect(env.employer_discovery.visibility).toBe("off");
    expect(env.employer_account?.unlock_payments).toHaveLength(1);
  });
});

/* ── Completeness: new tables, pagination, visible failures ── */
import { fetchPaged, buildCandidateExportSpecs, EXPORT_MAX_ROWS_PER_TABLE } from "../../server-handlers/_export-user-data-helpers";
import { collectUserExport, EMPLOYER_AUDIT_MAX_ROWS } from "../../server-handlers/_export-user-data-collect";

const BASE = "https://proj.supabase.co";
const UID = "user-1";

type ExportCall = { url: string; method: string };

/** Fake PostgREST: serves `rows[table]` honouring limit/offset; per-table status overrides. */
function exportFake(rows: Record<string, unknown[]> = {}, status: Record<string, number> = {}, sign?: (path: string) => Response) {
  const calls: ExportCall[] = [];
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, method: init?.method ?? "GET" });
    if (url.includes("/storage/v1/object/sign/")) {
      return sign ? sign(url) : new Response(JSON.stringify({ signedURL: "/object/sign/resume-files/x?token=t" }), { status: 200 });
    }
    const table = url.match(/\/rest\/v1\/([a-z_]+)\?/)?.[1] ?? "";
    if (status[table]) return new Response("{}", { status: status[table] });
    const q = new URL(url).searchParams;
    const limit = Number(q.get("limit") ?? 1000);
    const offset = Number(q.get("offset") ?? 0);
    return new Response(JSON.stringify((rows[table] ?? []).slice(offset, offset + limit)), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const collect = (fetchImpl: typeof fetch) => collectUserExport({ fetchImpl, supabaseUrl: BASE, serviceKey: "svc", userId: UID, userEmail: "u@example.com" });

describe("fetchPaged", () => {
  const spec = { key: "interview_turns", path: `/rest/v1/interview_turns?user_id=eq.${UID}`, order: "created_at.desc,id.asc" };
  const many = Array.from({ length: 2500 }, (_, i) => ({ id: i }));

  it("walks every page (no silent 5000/1000 cap) with an explicit stable order", async () => {
    const { fetchImpl, calls } = exportFake({ interview_turns: many });
    const r = await fetchPaged(fetchImpl, BASE, {}, spec);
    expect(r.rows).toHaveLength(2500);
    expect(r).toMatchObject({ truncated: false, error: false });
    expect(calls).toHaveLength(3);
    expect(calls.every((c) => c.url.includes("order=created_at.desc,id.asc"))).toBe(true);
  });

  it("flags truncated when the row cap is hit with more rows remaining", async () => {
    const { fetchImpl } = exportFake({ interview_turns: many });
    const r = await fetchPaged(fetchImpl, BASE, {}, spec, { pageSize: 1000, maxRows: 2000 });
    expect(r.rows).toHaveLength(2000);
    expect(r.truncated).toBe(true);
  });

  it("does not flag truncated when the table ends exactly at the cap", async () => {
    const { fetchImpl } = exportFake({ interview_turns: many.slice(0, 2000) });
    const r = await fetchPaged(fetchImpl, BASE, {}, spec, { pageSize: 1000, maxRows: 2000 });
    expect(r).toMatchObject({ truncated: false, error: false });
  });

  it("surfaces HTTP errors and network failures instead of returning []", async () => {
    expect((await fetchPaged(exportFake({}, { interview_turns: 500 }).fetchImpl, BASE, {}, spec)).error).toBe(true);
    const boom = (async () => { throw new Error("net"); }) as unknown as typeof fetch;
    expect((await fetchPaged(boom, BASE, {}, spec)).error).toBe(true);
  });

  it("treats a 404 as 'no rows' only for optional tables (migration not applied)", async () => {
    const f = exportFake({}, { interview_turns: 404 }).fetchImpl;
    expect((await fetchPaged(f, BASE, {}, { ...spec, optional: true })).error).toBe(false);
    expect((await fetchPaged(f, BASE, {}, spec)).error).toBe(true);
  });

  it("has a sane default cap", () => {
    expect(EXPORT_MAX_ROWS_PER_TABLE).toBeGreaterThanOrEqual(10_000);
  });
});

describe("buildCandidateExportSpecs", () => {
  const specs = buildCandidateExportSpecs(UID);
  const keys = specs.map((s) => s.key);

  it("covers every user-scoped table that was previously omitted", () => {
    for (const t of [
      "resumes", "resume_versions", "calendar_reminder_log", "google_calendar_sync", "question_feedback", "credibility_disputes",
      "referrals", "report_shares", "user_outcomes", "product_ratings", "session_insights", "salary_offers", "promo_redemptions",
      "credit_ledger", "session_credits", "support_messages", "notifications", "notification_preferences", "payment_dedup",
    ]) expect(keys, t).toContain(t);
  });

  it("never selects Google tokens/sync cursors or report-share bearer tokens", () => {
    const gcal = specs.find((s) => s.key === "google_calendar_sync")!;
    expect(gcal.path).toContain("select=");
    for (const secret of ["refresh_token", "access_token", "sync_token", "channel_id", "resource_id"]) expect(gcal.path).not.toContain(secret);
    const shares = specs.find((s) => s.key === "report_shares")!;
    expect(shares.path).toContain("select=");
    expect(shares.path).not.toMatch(/select=[^&]*\btoken\b/);
  });

  it("scopes every spec to the requesting user", () => {
    for (const s of specs) expect(s.path, s.key).toContain(`=eq.${UID}`);
  });
});

describe("collectUserExport", () => {
  it("includes the newly covered tables and reports a complete export", async () => {
    const { fetchImpl } = exportFake({
      profiles: [{ id: UID }],
      resumes: [{ id: "r1" }],
      support_messages: [{ id: "m1" }],
      salary_offers: [{ id: "o1" }],
      referrals: [{ id: "ref1" }],
    });
    const { envelope, status } = await collect(fetchImpl);
    expect(status).toBe("complete");
    expect(envelope._meta).toMatchObject({ complete: true, errors: [], truncated: [] });
    expect(Object.keys(envelope)[0]).toBe("_meta");
    expect(envelope.resumes).toEqual([{ id: "r1" }]);
    expect(envelope.support_messages).toEqual([{ id: "m1" }]);
    expect(envelope.salary_offers).toEqual([{ id: "o1" }]);
    expect(envelope.referrals).toEqual([{ id: "ref1" }]);
    expect(envelope).toHaveProperty("google_calendar_sync");
    expect(envelope).toHaveProperty("credit_ledger");
  });

  it("flags failed tables by name, returns partial with the rest intact (no silent [])", async () => {
    const { fetchImpl } = exportFake({ profiles: [{ id: UID }], sessions: [{ id: "s1" }] }, { feedback: 500, salary_offers: 500 });
    const { envelope, status } = await collect(fetchImpl);
    expect(status).toBe("partial");
    expect(envelope._meta.complete).toBe(false);
    expect([...envelope._meta.errors].sort()).toEqual(["feedback", "salary_offers"]);
    expect(envelope._meta.notice).toMatch(/INCOMPLETE/);
    expect(envelope.sessions).toEqual([{ id: "s1" }]);
  });

  it("returns status 'failed' when everything fails", async () => {
    const down = (async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    const { status, envelope } = await collect(down);
    expect(status).toBe("failed");
    expect(envelope._meta.complete).toBe(false);
  });

  it("paginates interview_turns and llm_usage beyond the old 5000 / 1000 caps", async () => {
    const turns = Array.from({ length: 5200 }, (_, i) => ({ id: i }));
    const usage = Array.from({ length: 1200 }, (_, i) => ({ id: i }));
    const { fetchImpl } = exportFake({ profiles: [{ id: UID }], interview_turns: turns, llm_usage: usage });
    const { envelope, status } = await collect(fetchImpl);
    expect(status).toBe("complete");
    expect(envelope.interview_turns).toHaveLength(5200);
    expect(envelope.llm_usage).toHaveLength(1200);
  });

  it("gives resume files as short-expiry signed URLs and strips the join helper column", async () => {
    const { fetchImpl, calls } = exportFake({
      profiles: [{ id: UID }],
      resume_versions: [{ id: "v1", file_name: "cv.pdf", file_path: `${UID}/cv.pdf`, resumes: { user_id: UID } }],
    });
    const { envelope, status } = await collect(fetchImpl);
    expect(status).toBe("complete");
    const files = envelope.resume_files as Array<{ download_url: string; expires_in_seconds: number }>;
    expect(files).toHaveLength(1);
    expect(files[0].download_url).toBe(`${BASE}/storage/v1/object/sign/resume-files/x?token=t`);
    expect(files[0].expires_in_seconds).toBeLessThanOrEqual(3600);
    expect(JSON.stringify(envelope.resume_versions)).not.toContain('"resumes"');
    const sign = calls.find((c) => c.url.includes("/object/sign/"))!;
    expect(sign.method).toBe("POST");
  });

  it("marks the export incomplete when a resume file cannot be signed", async () => {
    const { fetchImpl } = exportFake(
      { profiles: [{ id: UID }], resume_versions: [{ id: "v1", file_path: `${UID}/cv.pdf`, resumes: { user_id: UID } }] },
      {},
      () => new Response("nope", { status: 500 }),
    );
    const { envelope } = await collect(fetchImpl);
    expect(envelope._meta.errors).toContain("resume_files");
    expect(envelope._meta.complete).toBe(false);
  });

  it("rejects path-traversal file paths instead of signing them", async () => {
    const { fetchImpl, calls } = exportFake({ profiles: [{ id: UID }], resume_versions: [{ id: "v1", file_path: "../other/cv.pdf", resumes: {} }] });
    await collect(fetchImpl);
    expect(calls.some((c) => c.url.includes("/object/sign/"))).toBe(false);
  });

  it("adds the employer side only for employer accounts", async () => {
    const plain = await collect(exportFake({ profiles: [{ id: UID }] }).fetchImpl);
    expect(plain.envelope.employer_account).toBeNull();
    const emp = await collect(exportFake({ profiles: [{ id: UID }], employers: [{ id: UID, company_name: "Acme" }], employer_requirements: [{ id: "q1" }] }).fetchImpl);
    expect(emp.envelope.employer_account).toMatchObject({ employer: { company_name: "Acme" }, requirements: [{ id: "q1" }] });
  });

  it("exports the employer's own requirement activity, credit ledger and credit notes", async () => {
    const { fetchImpl, calls } = exportFake({
      profiles: [{ id: UID }],
      employers: [{ id: UID }],
      employer_unlock_orders: [{ id: "o1", razorpay_order_id: "order_A" }],
      employer_requirement_activity: [{ id: "a1", action: "created" }],
      employer_credit_ledger: [{ id: "l1" }],
      employer_credit_notes: [{ id: "n1", order_id: "order_A" }],
    });
    const { envelope, status } = await collect(fetchImpl);
    expect(status).toBe("complete");
    expect(envelope.employer_account).toMatchObject({
      requirement_activity: [{ id: "a1" }],
      credit_ledger: [{ id: "l1" }],
      credit_notes: [{ id: "n1" }],
    });
    const notesCall = calls.find((c) => c.url.includes("/employer_credit_notes?"));
    expect(decodeURIComponent(notesCall?.url ?? "")).toContain('order_id=in.("order_A")');
  });

  it("treats a not-yet-migrated employer_credit_ledger as empty, not an error", async () => {
    const { envelope, status } = await collect(exportFake({ profiles: [{ id: UID }], employers: [{ id: UID }] }, { employer_credit_ledger: 404 }).fetchImpl);
    expect(status).toBe("complete");
    expect(envelope.employer_account?.credit_ledger).toEqual([]);
  });

  it("caps audit-style employer tables below the global per-table ceiling and flags truncation", async () => {
    const many = Array.from({ length: EMPLOYER_AUDIT_MAX_ROWS + 5 }, (_, i) => ({ id: i }));
    const { envelope, status } = await collect(exportFake({ profiles: [{ id: UID }], employers: [{ id: UID }], employer_requirement_activity: many }).fetchImpl);
    expect(envelope.employer_account?.requirement_activity).toHaveLength(EMPLOYER_AUDIT_MAX_ROWS);
    expect(envelope._meta.truncated).toContain("employer_requirement_activity");
    expect(status).toBe("partial");
  });

  it("selects the employer notes on matches and gates them behind the unlock", async () => {
    const { fetchImpl, calls } = exportFake({ profiles: [{ id: UID }] });
    await collect(fetchImpl);
    const matchCall = calls.find((c) => c.url.includes("/requirement_matches?"));
    expect(matchCall?.url).toContain("candidate_status_note");
    const { shaped } = shapeMatchesForExport([
      { id: "m1", unlocked: false, candidate_status_note: "Call Acme HR", employer_requirements: { title: "T", employers: { company_name: "Acme" } } },
      { id: "m2", unlocked: true, candidate_status_note: "Please join Globex on Friday", interview_scheduled_at: "2026-10-20", employer_requirements: { title: "T", employers: { company_name: "Globex" } } },
    ]);
    const [locked, open] = shaped as Array<Record<string, unknown>>;
    expect(locked.employer_note).toBeNull();
    expect(open.employer_note).toBe("Please join Globex on Friday");
    expect(open.interview_scheduled_at).toBe("2026-10-20");
  });

  it("collects candidate_requests and match_status_events for the user", async () => {
    const { envelope } = await collect(exportFake({
      profiles: [{ id: UID }],
      candidate_requests: [{ id: "r1", kind: "access" }],
      match_status_events: [{ id: "e1", match_id: "m1", to_status: "hired", actor: "candidate", note: "mine" }],
    }).fetchImpl);
    expect(envelope.candidate_requests).toEqual([{ id: "r1", kind: "access" }]);
    expect(envelope.employer_discovery.status_events).toHaveLength(1);
  });
});
