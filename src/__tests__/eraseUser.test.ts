import { describe, it, expect, vi } from "vitest";
import {
  eraseUserData,
  posthogConfigFromEnv,
  sha256Hex,
  pseudonymousId,
  USER_TABLE_DELETES,
  OPTIONAL_TABLES,
  type EraseDeps,
} from "../../server-handlers/_erase-user";
import { buildErasureEmail, sendErasureEmail } from "../../server-handlers/_erase-user-email";

/* eraseUserData is the single erasure routine shared by the immediate path and the cron.
 * These tests drive it against a recording fake of Supabase REST + Storage + Auth, so the
 * whole table/bucket inventory, ordering, idempotency and failure semantics are checked
 * without any network. */

const UID = "11111111-2222-3333-4444-555555555555";
const EMAIL = "candidate@example.com";
const URL = "https://proj.supabase.co";

type Call = { url: string; method: string; body?: string };
type Override = (c: Call) => Response | undefined | Promise<Response | undefined>;

interface FakeOpts {
  storage?: Record<string, string[]>;
  resumePointers?: string[];
  /** attachment_path values on the user's chat messages (chat-attachments is keyed by conversation, not user). */
  chatPointers?: string[];
  employer?: { logo_path?: string | null } | null;
  employerPayments?: number;
  googleRefreshToken?: string;
  override?: Override;
}

function makeFake(opts: FakeOpts = {}) {
  const calls: Call[] = [];
  const storage: Record<string, Set<string>> = {};
  for (const [bucket, paths] of Object.entries(opts.storage ?? {})) storage[bucket] = new Set(paths);
  const json = (rows: unknown, status = 200) => new Response(JSON.stringify(rows), { status });

  const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const call: Call = { url, method, body: init?.body as string | undefined };
    calls.push(call);
    const custom = await opts.override?.(call);
    if (custom) return custom;

    const list = url.match(/\/storage\/v1\/object\/list\/([^/?]+)$/);
    if (list && method === "POST") {
      const prefix = (JSON.parse(call.body!) as { prefix: string }).prefix;
      const seen = new Map<string, boolean>();
      for (const p of storage[list[1]] ?? []) {
        if (!p.startsWith(prefix + "/")) continue;
        const rest = p.slice(prefix.length + 1);
        const [seg, ...more] = rest.split("/");
        seen.set(seg, more.length === 0);
      }
      return json([...seen].map(([name, isFile]) => ({ name, id: isFile ? "obj" : null })));
    }
    const rm = url.match(/\/storage\/v1\/object\/([^/?]+)$/);
    if (rm && method === "DELETE") {
      for (const p of (JSON.parse(call.body!) as { prefixes: string[] }).prefixes) storage[rm[1]]?.delete(p);
      return json([]);
    }
    if (url.includes("/rest/v1/profiles") && method === "GET") return json([{ email: EMAIL, name: "Aarti" }]);
    if (url.includes("/rest/v1/employers?id=eq.") && method === "GET") return json(opts.employer ? [{ id: UID, logo_path: opts.employer.logo_path ?? null }] : []);
    if (url.includes("/rest/v1/employer_unlock_payments?employer_id") && method === "GET") return json(opts.employerPayments ? [{ id: "p" }] : []);
    if (url.includes("/rest/v1/employer_unlock_orders?employer_id") && method === "GET") return json([]);
    if (url.includes("conversation_messages?or=")) return json((opts.chatPointers ?? []).map((attachment_path) => ({ attachment_path })));
    if (url.includes("/rest/v1/resume_versions")) return json((opts.resumePointers ?? []).map((file_path) => ({ file_path })));
    if (url.includes("/rest/v1/google_calendar_sync") && method === "GET") return json(opts.googleRefreshToken ? [{ refresh_token: opts.googleRefreshToken }] : []);
    if (method === "DELETE" && url.includes("/rest/v1/")) return new Response(null, { status: 204, headers: { "content-range": "*/2" } });
    return json([], method === "POST" ? 201 : 200);
  });

  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls, storage };
}

function deps(fake: { fetchImpl: typeof fetch }, extra: Partial<EraseDeps> = {}): EraseDeps {
  return { fetchImpl: fake.fetchImpl, supabaseUrl: URL, serviceKey: "svc-key", trigger: "user_hard", ...extra };
}

const rest = (calls: Call[], method: string, table: string) =>
  calls.filter((c) => c.method === method && c.url.startsWith(`${URL}/rest/v1/${table}?`));

describe("eraseUserData — inventory", () => {
  it("erases every user-scoped table and all three storage buckets, auth user last", async () => {
    const fake = makeFake({
      storage: {
        "resume-files": [`${UID}/a.pdf`, `${UID}/orphan/b.pdf`, `other-user/keep.pdf`],
        "chat-attachments": ["conv-1/c.png", "conv-2/keep-other-conversation.png"],
        "employer-logos": [`${UID}/logo.png`],
      },
      resumePointers: [`${UID}/a.pdf`],
      chatPointers: ["conv-1/c.png"],
    });
    const result = await eraseUserData(deps(fake), UID);

    expect(result.ok).toBe(true);
    expect(result.auth).toBe("deleted");
    // Every user-scoped table gets an explicit DELETE...
    for (const step of USER_TABLE_DELETES.filter((s) => s.scope === "user")) {
      expect(rest(fake.calls, "DELETE", step.table).some((c) => c.url.includes(`${step.column}=eq.${UID}`)), step.table).toBe(true);
    }
    // ...employer-scoped ones only for employers.
    expect(rest(fake.calls, "DELETE", "employer_requirements")).toHaveLength(0);
    // Buckets are emptied, including the orphan with no DB pointer, and nobody else's files are touched.
    expect([...fake.storage["resume-files"]]).toEqual(["other-user/keep.pdf"]);
    expect([...fake.storage["chat-attachments"]]).toEqual(["conv-2/keep-other-conversation.png"]);
    expect(fake.storage["employer-logos"].size).toBe(0);
    expect(result.counts["resume-files"]).toBe(2);

    // Ordering: storage first, auth user after every row delete, profile cleanup after auth.
    const idx = (pred: (c: Call) => boolean) => fake.calls.findIndex(pred);
    const lastRowDelete = fake.calls.map((c, i) => (c.method === "DELETE" && c.url.includes("/rest/v1/") && !c.url.includes("/profiles?") ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    const firstRowDelete = idx((c) => c.method === "DELETE" && c.url.includes("/rest/v1/sessions"));
    const authDelete = idx((c) => c.method === "DELETE" && c.url.includes("/auth/v1/admin/users/"));
    const lastStorage = fake.calls.map((c, i) => (c.url.includes("/storage/v1/") ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    expect(lastStorage).toBeLessThan(firstRowDelete);
    expect(authDelete).toBeGreaterThan(lastRowDelete);
    expect(idx((c) => c.method === "DELETE" && c.url.includes("/rest/v1/profiles?"))).toBeGreaterThan(authDelete);
  });

  it("also erases the employer-scoped tables for an employer account", async () => {
    const fake = makeFake({ employer: { logo_path: `${UID}/logo.png` }, storage: { "employer-logos": [`${UID}/logo.png`] } });
    const result = await eraseUserData(deps(fake), UID);
    expect(result.ok).toBe(true);
    for (const t of ["employer_requirements", "employer_requirement_activity"]) {
      expect(rest(fake.calls, "DELETE", t).length, t).toBe(1);
    }
    expect(fake.storage["employer-logos"].size).toBe(0);
  });

  it("covers every user-scoped table in the schema (guards against a new table being forgotten)", async () => {
    const fs = await import("node:fs");
    const schema = fs.readFileSync("supabase-schema.sql", "utf8");
    const covered = new Set(USER_TABLE_DELETES.map((s) => s.table));
    // Tables that hold a user_id-style reference but are intentionally handled elsewhere.
    const handledElsewhere = new Set([
      "profiles", // auth cascade + explicit delete
      "resume_versions", // cascades from resumes
      "payments", "payment_dedup", "service_usage", // anonymised, not deleted
      "employer_unlock_payments", "employer_unlock_orders", "employers", // retention / auth cascade
      "account_erasure_log", // proof of erasure
      "used_verification_tokens", // keyed by email
    ]);
    const tables = [...schema.matchAll(/create table (?:if not exists )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g)];
    const missing: string[] = [];
    for (const [, name, body] of tables) {
      const userScoped = /\b(user_id|candidate_user_id|referrer_id|reporter_user_id|flagged_by)\b[^\n]*references\s+(profiles|auth\.users)/i.test(body);
      if (userScoped && !covered.has(name) && !handledElsewhere.has(name)) missing.push(name);
    }
    expect(missing).toEqual([]);
  });
});

describe("eraseUserData — retention exceptions", () => {
  it("anonymises payment records instead of deleting them", async () => {
    const fake = makeFake();
    const result = await eraseUserData(deps(fake), UID);
    expect(result.ok).toBe(true);
    for (const table of ["payments", "payment_dedup", "service_usage"]) {
      const patches = rest(fake.calls, "PATCH", table);
      expect(patches.length, table).toBe(1);
      expect(JSON.parse(patches[0].body!)).toMatchObject({ user_id: null });
      expect(rest(fake.calls, "DELETE", table), `${table} must not be deleted`).toHaveLength(0);
    }
    expect(JSON.parse(rest(fake.calls, "PATCH", "payments")[0].body!)).toMatchObject({ receipt_url: "" });
  });

  it("keeps an employer's unlock payments: anonymises the employer row and deactivates (not deletes) auth", async () => {
    const fake = makeFake({ employer: { logo_path: null }, employerPayments: 1 });
    const result = await eraseUserData(deps(fake), UID);
    expect(result.ok).toBe(true);
    expect(result.retainedFinancialRecords).toBe(true);
    expect(result.auth).toBe("deactivated");
    expect(JSON.parse(rest(fake.calls, "PATCH", "employers")[0].body!)).toMatchObject({ company_name: "", website: "", logo_path: null });
    expect(fake.calls.some((c) => c.method === "DELETE" && c.url.includes("/auth/v1/admin/users/"))).toBe(false);
    const put = fake.calls.find((c) => c.method === "PUT" && c.url.includes("/auth/v1/admin/users/"))!;
    expect(JSON.parse(put.body!)).toMatchObject({ ban_duration: "876000h", email: `deleted-${UID}@deleted.invalid` });
    for (const t of ["employer_unlock_payments", "employer_unlock_orders"]) expect(rest(fake.calls, "DELETE", t)).toHaveLength(0);
  });

  it("writes an audit row with a hash and counts only: no user id, email or name", async () => {
    const fake = makeFake({ storage: { "resume-files": [`${UID}/a.pdf`] } });
    await eraseUserData(deps(fake), UID);
    const audit = fake.calls.find((c) => c.method === "POST" && c.url.endsWith("/rest/v1/account_erasure_log"))!;
    expect(audit).toBeTruthy();
    expect(audit.body).not.toContain(UID);
    expect(audit.body).not.toContain(EMAIL);
    expect(audit.body).not.toContain("Aarti");
    expect(JSON.parse(audit.body!)).toMatchObject({ user_hash: await sha256Hex(UID), trigger: "user_hard", retained_financial: false });
  });

  it("never logs the user id or email", async () => {
    const fake = makeFake();
    const log = vi.fn();
    await eraseUserData(deps(fake, { log }), UID);
    expect(JSON.stringify(log.mock.calls)).not.toContain(UID);
    expect(JSON.stringify(log.mock.calls)).not.toContain(EMAIL);
  });
});

describe("eraseUserData — idempotent and resumable", () => {
  it("a second run over an already-erased account still succeeds", async () => {
    const fake = makeFake({ storage: { "resume-files": [`${UID}/a.pdf`] } });
    expect((await eraseUserData(deps(fake), UID)).ok).toBe(true);
    const second = await eraseUserData(deps(fake), UID);
    expect(second.ok).toBe(true);
    expect(second.counts["resume-files"]).toBe(0);
  });

  it("treats a 404 from the auth delete (already gone) as success", async () => {
    const fake = makeFake({ override: (c) => (c.method === "DELETE" && c.url.includes("/auth/v1/admin/users/") ? new Response("{}", { status: 404 }) : undefined) });
    const r = await eraseUserData(deps(fake), UID);
    expect(r.ok).toBe(true);
    expect(r.auth).toBe("deleted");
  });

  it("a table delete failure aborts before the auth user and profile are touched, and names the step", async () => {
    const fake = makeFake({ override: (c) => (c.method === "DELETE" && c.url.includes("/rest/v1/sessions?") ? new Response("", { status: 500 }) : undefined) });
    const notify = vi.fn();
    const r = await eraseUserData(deps(fake, { notify }), UID);
    expect(r.ok).toBe(false);
    expect(r.failedSteps).toEqual(["sessions"]);
    expect(r.auth).toBe("not_attempted");
    expect(fake.calls.some((c) => c.url.includes("/auth/v1/admin/users/"))).toBe(false);
    expect(fake.calls.some((c) => c.method === "DELETE" && c.url.includes("/rest/v1/profiles?"))).toBe(false);
    expect(fake.calls.some((c) => c.url.endsWith("/rest/v1/account_erasure_log"))).toBe(false);
    // Remaining tables are still attempted so one bad table doesn't block the rest.
    expect(rest(fake.calls, "DELETE", "feedback")).toHaveLength(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it("a storage failure aborts before ANY row is deleted (rows are the pointers to the files)", async () => {
    const fake = makeFake({ override: (c) => (c.url.includes("/storage/v1/object/list/resume-files") ? new Response("boom", { status: 500 }) : undefined) });
    const r = await eraseUserData(deps(fake), UID);
    expect(r.ok).toBe(false);
    expect(r.failedSteps).toEqual(["resume-files"]);
    expect(fake.calls.some((c) => c.method === "DELETE" && c.url.includes("/rest/v1/"))).toBe(false);
    expect(fake.calls.some((c) => c.url.includes("/auth/v1/admin/users/"))).toBe(false);
  });

  it("fails if files are still present after the delete (verification re-list)", async () => {
    const fake = makeFake({
      storage: { "resume-files": [`${UID}/a.pdf`] },
      override: (c) => (c.method === "DELETE" && c.url.endsWith("/storage/v1/object/resume-files") ? new Response("[]", { status: 200 }) : undefined),
    });
    // The override swallows the delete without removing anything, so the re-list still sees the file.
    const r = await eraseUserData(deps(fake), UID);
    expect(r.ok).toBe(false);
    expect(r.failedSteps).toContain("resume-files");
  });

  it("fails closed when the employer lookup fails", async () => {
    const fake = makeFake({ override: (c) => (c.url.includes("/rest/v1/employers?id=eq.") ? new Response("", { status: 500 }) : undefined) });
    const r = await eraseUserData(deps(fake), UID);
    expect(r.ok).toBe(false);
    expect(r.failedSteps).toEqual(["employer data"]);
    expect(fake.calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("fails closed (account stays soft-deleted) when payments cannot be anonymised, e.g. migration 0038 unapplied", async () => {
    const fake = makeFake({ override: (c) => (c.method === "PATCH" && c.url.includes("/rest/v1/payments?") ? new Response("not-null violation", { status: 400 }) : undefined) });
    const r = await eraseUserData(deps(fake), UID);
    expect(r.ok).toBe(false);
    expect(r.failedSteps).toEqual(["payments"]);
    expect(fake.calls.some((c) => c.method === "DELETE" && c.url.includes("/rest/v1/"))).toBe(false);
  });

  it("reports an auth-delete failure as the only failed step", async () => {
    const fake = makeFake({ override: (c) => (c.method === "DELETE" && c.url.includes("/auth/v1/admin/users/") ? new Response("", { status: 500 }) : undefined) });
    const r = await eraseUserData(deps(fake), UID);
    expect(r.ok).toBe(false);
    expect(r.failedSteps).toEqual(["auth"]);
    expect(r.auth).toBe("failed");
  });

  it("tolerates a 404 only for tables from not-yet-applied migrations", async () => {
    const notFound = (table: string): Override => (c) => (c.method === "DELETE" && c.url.includes(`/rest/v1/${table}?`) ? new Response("", { status: 404 }) : undefined);
    expect(OPTIONAL_TABLES.has("conversations")).toBe(true);
    expect((await eraseUserData(deps(makeFake({ override: notFound("conversations") })), UID)).ok).toBe(true);
    const core = await eraseUserData(deps(makeFake({ override: notFound("sessions") })), UID);
    expect(core.ok).toBe(false);
    expect(core.failedSteps).toEqual(["sessions"]);
  });
});

describe("eraseUserData — third-party processors (best effort)", () => {
  const ph = { apiHost: "https://us.posthog.com", projectId: "123", personalApiKey: "phx_secret" };

  it("requests PostHog person deletion including events", async () => {
    const fake = makeFake();
    const r = await eraseUserData(deps(fake, { posthog: ph }), UID);
    expect(r.ok).toBe(true);
    expect(r.processors.posthog).toBe("deleted");
    const call = fake.calls.find((c) => c.url === "https://us.posthog.com/api/projects/123/persons/bulk_delete/")!;
    expect(JSON.parse(call.body!)).toEqual({ distinct_ids: [UID], delete_events: true });
  });

  it("skips PostHog silently when it is not configured", async () => {
    const fake = makeFake();
    const r = await eraseUserData(deps(fake, { posthog: null }), UID);
    expect(r.ok).toBe(true);
    expect(r.processors.posthog).toBe("skipped");
    expect(fake.calls.some((c) => c.url.includes("posthog"))).toBe(false);
  });

  it("a PostHog failure or network error never fails the erasure", async () => {
    const bad = makeFake({ override: (c) => (c.url.includes("posthog.com") ? new Response("", { status: 500 }) : undefined) });
    const r1 = await eraseUserData(deps(bad, { posthog: ph }), UID);
    expect(r1.ok).toBe(true);
    expect(r1.processors.posthog).toBe("failed");
    const thrown = makeFake({ override: (c) => { if (c.url.includes("posthog.com")) throw new Error("dns"); return undefined; } });
    expect((await eraseUserData(deps(thrown, { posthog: ph }), UID)).ok).toBe(true);
  });

  it("revokes the Google grant and deletes the sync row regardless of the revoke outcome", async () => {
    const ok = makeFake({ googleRefreshToken: "rt-1" });
    const r = await eraseUserData(deps(ok), UID);
    expect(r.processors.google).toBe("revoked");
    expect(ok.calls.some((c) => c.url === "https://oauth2.googleapis.com/revoke?token=rt-1")).toBe(true);
    expect(rest(ok.calls, "DELETE", "google_calendar_sync")).toHaveLength(1);

    const down = makeFake({ googleRefreshToken: "rt-2", override: (c) => { if (c.url.includes("oauth2.googleapis.com")) throw new Error("down"); return undefined; } });
    const r2 = await eraseUserData(deps(down), UID);
    expect(r2.ok).toBe(true);
    expect(r2.processors.google).toBe("failed");
    expect(rest(down.calls, "DELETE", "google_calendar_sync")).toHaveLength(1);
  });

  it("builds the PostHog management host from the env, and is null without credentials", () => {
    expect(posthogConfigFromEnv({})).toBeNull();
    expect(posthogConfigFromEnv({ POSTHOG_PERSONAL_API_KEY: "k" })).toBeNull();
    expect(posthogConfigFromEnv({ POSTHOG_PERSONAL_API_KEY: "k", POSTHOG_PROJECT_ID: "9", POSTHOG_HOST: "https://eu.i.posthog.com/" })).toEqual({
      apiHost: "https://eu.posthog.com", projectId: "9", personalApiKey: "k",
    });
  });

  it("derives a stable pseudonymous id that is not the user id", async () => {
    const id = await pseudonymousId(UID);
    expect(id).toMatch(/^deleted_[0-9a-f]{16}$/);
    expect(id).not.toContain(UID);
    expect(await pseudonymousId(UID)).toBe(id);
  });
});

describe("eraseUserData — confirmation email", () => {
  it("is sent only after a fully successful erasure", async () => {
    const notify = vi.fn(async () => undefined);
    await eraseUserData(deps(makeFake(), { notify }), UID);
    expect(notify).toHaveBeenCalledWith({ email: EMAIL, name: "Aarti" });
  });

  it("a notify failure never fails the erasure", async () => {
    const r = await eraseUserData(deps(makeFake(), { notify: async () => { throw new Error("resend down"); } }), UID);
    expect(r.ok).toBe(true);
  });

  it("makes only true claims: backups overwritten within 30 days, payment records kept anonymised", () => {
    const { html, subject } = buildErasureEmail("Aarti", "https://hirestepx.com");
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(subject).toMatch(/deleted/i);
    expect(text).toMatch(/overwritten within 30 days/i);
    expect(text).toMatch(/tax law/i);
    expect(text).toMatch(/anonymised/i);
    expect(text).not.toMatch(/no backup/i);
    expect(text).not.toMatch(/we keep no/i);
  });

  it("escapes the recipient name", () => {
    expect(buildErasureEmail("<script>x</script>", "https://hirestepx.com").html).not.toContain("<script>x</script>");
  });

  it("sendErasureEmail is a no-op without a key and never throws", async () => {
    const f = vi.fn();
    await sendErasureEmail(f as unknown as typeof fetch, { resendApiKey: "", fromEmail: "a@b.c", appUrl: "https://x" }, { email: EMAIL, name: "A" });
    expect(f).not.toHaveBeenCalled();
    const boom = vi.fn(async () => { throw new Error("net"); });
    await expect(sendErasureEmail(boom as unknown as typeof fetch, { resendApiKey: "k", fromEmail: "a@b.c", appUrl: "https://x" }, { email: EMAIL, name: "A" })).resolves.toBeUndefined();
  });
});
