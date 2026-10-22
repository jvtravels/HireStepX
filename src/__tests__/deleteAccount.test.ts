import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/* Handler-level tests for delete-account.ts — the irreversible, hard-delete
 * path that wipes a user's rows across 14 tables in parallel (Promise.
 * allSettled) plus their Supabase Auth user. Zero direct unit tests existed
 * before this file despite being the highest blast-radius destructive
 * handler in the codebase.
 *
 * Following the employer-verify-unlock-payment.test.ts convention:
 * withNodeAuthAndRateLimit (the auth/rate-limit preamble) is mocked so tests
 * drive the handler's OWN branches directly — reauth gate, restore path,
 * soft vs hard delete, per-table partial-failure reporting, auth-user
 * delete failure — without re-exercising _shared's CORS/rate-limit logic
 * (that's covered elsewhere). _posthog's captureServerEvent is mocked to a
 * no-op spy; _email-theme is left real since it's pure HTML string
 * building with no network calls. */

process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
process.env.RESEND_API_KEY = "resend-key";
process.env.FROM_EMAIL = "HireStepX <noreply@hirestepx.com>";
process.env.APP_URL = "https://hirestepx.vercel.app";

const withNodeAuthAndRateLimit = vi.fn();
const supabaseUrl = vi.fn();
const supabaseAnonKey = vi.fn();
const isRateLimited = vi.fn(async () => false);

vi.mock("../../server-handlers/_shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_shared")>();
  return {
    ...actual,
    withNodeAuthAndRateLimit: (...args: unknown[]) =>
      withNodeAuthAndRateLimit(...(args as Parameters<typeof actual.withNodeAuthAndRateLimit>)),
    isRateLimited: (...args: unknown[]) => isRateLimited(...(args as [])),
    supabaseUrl: (...args: unknown[]) => supabaseUrl(...(args as Parameters<typeof actual.supabaseUrl>)),
    supabaseAnonKey: (...args: unknown[]) => supabaseAnonKey(...(args as Parameters<typeof actual.supabaseAnonKey>)),
  };
});

const captureServerEvent = vi.fn();
vi.mock("../../server-handlers/_posthog", () => ({
  captureServerEvent: (...args: unknown[]) => captureServerEvent(...args),
}));

const { default: handler } = await import("../../server-handlers/delete-account");

const USER_ID = "user-123";
// The post-erasure analytics event must never carry the real id (it would re-create the erased PostHog person).
const PSEUDONYM = expect.stringMatching(/^deleted_[0-9a-f]{16}$/);

function mockReq(body: Record<string, unknown>): VercelRequest {
  return { method: "POST", headers: {}, body } as unknown as VercelRequest;
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(key: string, value: string) { res.headers[key] = value; return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; },
    end() { return res; },
  };
  return res as unknown as VercelResponse & typeof res;
}

function authOk(overrides: Partial<{ userEmail: string; userData: Record<string, unknown> }> = {}) {
  return {
    handled: false,
    userId: USER_ID,
    userEmail: overrides.userEmail ?? "candidate@example.com",
    userData: overrides.userData ?? { id: USER_ID, app_metadata: { provider: "email", providers: ["email"] } },
  };
}

/** All 15 sequential + parallel Supabase/auth calls succeed; used as a base
 *  fetch implementation that individual tests override selectively. */
function fullSuccessFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/auth/v1/token?grant_type=password")) return { ok: true } as Response;
    if (u.includes("/rest/v1/profiles") && u.includes("select=email,name")) {
      return { ok: true, json: async () => [{ email: "candidate@example.com", name: "Priya" }] } as unknown as Response;
    }
    if (u.includes("api.resend.com")) return { ok: true } as Response;
    if (u.includes("/rest/v1/service_usage")) return { ok: true } as unknown as Response;
    if (u.includes("/auth/v1/admin/users/")) return { ok: true } as unknown as Response;
    if (u.includes("/rest/v1/profiles") && init?.method === "PATCH") return { ok: true } as unknown as Response;
    if (u.includes("/rest/v1/profiles") && init?.method === "DELETE") return { ok: true } as unknown as Response;
    // Every other per-table DELETE in the Promise.allSettled batch.
    return { ok: true } as unknown as Response;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  supabaseUrl.mockReturnValue("https://example.supabase.co");
  supabaseAnonKey.mockReturnValue("anon-key");
  withNodeAuthAndRateLimit.mockResolvedValue(authOk());
  isRateLimited.mockResolvedValue(false);
});

describe("delete-account — per-user limit", () => {
  it("429s a user who keeps retrying, before touching any data", async () => {
    isRateLimited.mockResolvedValue(true);
    global.fetch = vi.fn();
    const res = mockRes();
    await handler(mockReq({}), res);
    expect(res.statusCode).toBe(429);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(isRateLimited).toHaveBeenCalledWith(USER_ID, "delete-account-user", 3, 60_000);
  });
});

describe("delete-account — preamble", () => {
  it("returns immediately once withNodeAuthAndRateLimit has already handled the response", async () => {
    withNodeAuthAndRateLimit.mockResolvedValue({ handled: true });
    global.fetch = vi.fn();
    const res = mockRes();
    await handler(mockReq({}), res);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("delete-account — re-auth gate", () => {
  it("403s when no password is supplied for a password-holding account", async () => {
    global.fetch = vi.fn();
    const res = mockRes();
    await handler(mockReq({}), res);
    expect(res.statusCode).toBe(403);
    expect((res.body as { code: string }).code).toBe("reauth_required");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("403s on an incorrect password", async () => {
    global.fetch = vi.fn(async () => ({ ok: false }) as Response);
    const res = mockRes();
    await handler(mockReq({ password: "wrong" }), res);
    expect(res.statusCode).toBe(403);
    expect((res.body as { code: string }).code).toBe("reauth_failed");
  });

  it("504s when password verification times out", async () => {
    global.fetch = vi.fn(() => {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    const res = mockRes();
    await handler(mockReq({ password: "whatever" }), res);
    expect(res.statusCode).toBe(504);
  });

  it("skips the re-auth gate for Google-OAuth-only accounts (no password to check)", async () => {
    withNodeAuthAndRateLimit.mockResolvedValue(
      authOk({ userData: { id: USER_ID, app_metadata: { provider: "google", providers: ["google"] } } }),
    );
    global.fetch = fullSuccessFetch() as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({}), res);
    // Soft-delete (default) succeeds without ever hitting the reauth token endpoint.
    expect(res.statusCode).toBe(200);
    const reauthCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([u]) =>
      String(u).includes("grant_type=password"),
    );
    expect(reauthCall).toBeUndefined();
  });

  it("exempts the restore path from the re-auth gate entirely", async () => {
    global.fetch = fullSuccessFetch() as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ restore: true }), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { restored: boolean }).restored).toBe(true);
  });
});

describe("delete-account — restore", () => {
  it("clears deleted_at and returns restored:true", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true }) as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ restore: true }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, restored: true });
    const call = fetchMock.mock.calls[0];
    expect(String(call[0])).toContain(`profiles?id=eq.${USER_ID}`);
    expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ deleted_at: null });
  });

  it("500s when the restore PATCH fails", async () => {
    global.fetch = vi.fn(async () => ({ ok: false }) as Response);
    const res = mockRes();
    await handler(mockReq({ restore: true }), res);
    expect(res.statusCode).toBe(500);
  });
});

describe("delete-account — soft delete (default)", () => {
  it("schedules deletion 7 days out without touching the per-table data", async () => {
    const fetchMock = fullSuccessFetch();
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct" }), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { scheduled: boolean }).scheduled).toBe(true);
    expect((res.body as { deletionDate: string }).deletionDate).toBeDefined();
    // Only the re-auth + soft-delete PATCH should have fired.
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/rest/v1/sessions"))).toBe(false);
  });

  it("500s and never hard-erases when the soft-delete PATCH is rejected (even for a missing column)", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("grant_type=password")) return { ok: true } as Response;
      if (u.includes("/rest/v1/profiles") && init?.method === "PATCH") {
        return { ok: false, status: 400, text: async () => "column \"deleted_at\" does not exist" } as unknown as Response;
      }
      return { ok: true, json: async () => [] } as unknown as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct" }), res);
    expect(res.statusCode).toBe(500);
    expect(captureServerEvent).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/auth/v1/admin/users/"))).toBe(false);
  });

  it("500s and never hard-erases when the soft-delete request throws", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("grant_type=password")) return { ok: true } as Response;
      if (u.includes("/rest/v1/profiles")) throw new Error("network down");
      return { ok: true, json: async () => [] } as unknown as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct" }), res);
    expect(res.statusCode).toBe(500);
    expect(captureServerEvent).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/auth/v1/admin/users/") || String(u).includes("/rest/v1/sessions"))).toBe(false);
  });

  it("switches employer_visibility off at soft-delete time, and a failure there does not block the deletion", async () => {
    const calls: Array<{ url: string; body: string }> = [];
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, body: String(init?.body ?? "") });
      if (init?.body && String(init.body).includes("employer_visibility")) return { ok: false, status: 400 } as Response;
      return { ok: true, json: async () => [] } as unknown as Response;
    }) as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct" }), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as { scheduled: boolean }).scheduled).toBe(true);
    const vis = calls.find((c) => c.body.includes("employer_visibility"));
    expect(vis?.url).toContain(`profiles?id=eq.${USER_ID}`);
    expect(JSON.parse(vis!.body)).toMatchObject({ employer_visibility: "off" });
  });
});

describe("delete-account — hard delete", () => {
  it("succeeds end-to-end: clears service_usage, deletes every table, then the auth user", async () => {
    const fetchMock = fullSuccessFetch();
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(captureServerEvent).toHaveBeenCalledWith("account_deleted", PSEUDONYM, { mode: "hard", $process_person_profile: false });
  });

  it("stops before the per-table batch if clearing service_usage fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("grant_type=password")) return { ok: true } as Response;
      if (u.includes("select=email,name")) return { ok: true, json: async () => [] } as unknown as Response;
      if (u.includes("/rest/v1/service_usage")) return { ok: false, status: 409, text: async () => "fk violation" } as unknown as Response;
      return { ok: true } as unknown as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toContain("service_usage");
    // Never reached the per-table delete batch or the auth-user delete.
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/rest/v1/sessions"))).toBe(false);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/auth/v1/admin/users/"))).toBe(false);
  });

  it("reports exactly the tables that failed, by name, when some deletes reject and some return non-ok — and does not delete the auth user", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("grant_type=password")) return { ok: true } as Response;
      if (u.includes("select=email,name")) return { ok: true, json: async () => [] } as unknown as Response;
      if (u.includes("api.resend.com")) return { ok: true } as Response;
      if (u.includes("/rest/v1/service_usage")) return { ok: true } as unknown as Response;
      if (u.includes("/rest/v1/sessions") && init?.method === "DELETE") {
        return { ok: false, status: 500 } as unknown as Response; // fulfilled but not ok
      }
      if (u.includes("/rest/v1/feedback") && init?.method === "DELETE") {
        throw new Error("network blip"); // rejected
      }
      if (u.includes("/auth/v1/admin/users/")) return { ok: true } as unknown as Response;
      return { ok: true } as unknown as Response; // every other table + profiles delete succeeds
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(500);
    const err = (res.body as { error: string }).error;
    expect(err).toContain("sessions");
    expect(err).toContain("feedback");
    expect(err).not.toContain("calendar_events");
    expect(err).not.toContain("llm_usage");
    // Auth-user delete must never be attempted once any table failed.
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/auth/v1/admin/users/"))).toBe(false);
    // The account is handed to the cron: deleted_at is set so the next run resumes the erasure.
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes("/rest/v1/profiles?id=eq.") && String(u).includes("deleted_at=is.null") && (i as RequestInit)?.method === "PATCH")).toBe(true);
  });

  it("fails the erasure (account left soft-deleted, auth untouched) when anonymising payments fails", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("grant_type=password")) return { ok: true } as Response;
      if (u.includes("select=email,name")) return { ok: true, json: async () => [] } as unknown as Response;
      if (u.includes("/rest/v1/payments") && init?.method === "PATCH") return { ok: false, status: 400 } as unknown as Response; // migration 0038 not applied
      return { ok: true, status: 200, json: async () => [] } as unknown as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toContain("payments");
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes("/auth/v1/admin/users/"))).toBe(false);
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes("/rest/v1/sessions") && (i as RequestInit)?.method === "DELETE")).toBe(false);
  });

  it("reports success:true with partial:true when data is deleted but the auth-user delete itself fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("grant_type=password")) return { ok: true } as Response;
      if (u.includes("select=email,name")) return { ok: true, json: async () => [] } as unknown as Response;
      if (u.includes("/auth/v1/admin/users/")) return { ok: false, status: 500 } as unknown as Response;
      return { ok: true } as unknown as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(207);
    expect(res.body).toMatchObject({ success: true, partial: true });
    expect(captureServerEvent).not.toHaveBeenCalled();
  });

  it("still completes the deletion even when the best-effort confirmation email fails", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("grant_type=password")) return { ok: true } as Response;
      if (u.includes("select=email,name")) return { ok: true, json: async () => [{ email: "candidate@example.com" }] } as unknown as Response;
      if (u.includes("api.resend.com")) throw new Error("resend down");
      return { ok: true } as unknown as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

describe("delete-account — candidate-agency + employer data", () => {
  type Call = { url: string; method: string; body?: string };

  /** Base fetch for hard-delete scenarios; `route` can override any call. */
  function scenario(route: (c: Call) => Response | undefined) {
    const calls: Call[] = [];
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      const c: Call = { url: String(url), method: init?.method ?? "GET", body: init?.body as string | undefined };
      calls.push(c);
      const custom = route(c);
      if (custom) return custom;
      if (c.url.includes("grant_type=password")) return { ok: true } as Response;
      if (c.url.includes("select=email,name")) return { ok: true, json: async () => [] } as unknown as Response;
      return { ok: true, status: 200, json: async () => [] } as unknown as Response;
    });
    global.fetch = fn as unknown as typeof fetch;
    return calls;
  }
  const json = (rows: unknown[]) => ({ ok: true, status: 200, json: async () => rows }) as unknown as Response;

  it("deletes every candidate-agency table before the profile", async () => {
    const calls = scenario(() => undefined);
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    const deletes = calls.filter((c) => c.method === "DELETE").map((c) => c.url);
    for (const t of ["candidate_consent_log", "employer_blocks", "employer_reports?reporter_user_id", "match_status_events", "message_flags?flagged_by", "conversation_messages", "conversations", "requirement_matches"]) {
      expect(deletes.some((u) => u.includes(`/rest/v1/${t}`))).toBe(true);
    }
  });

  it("tolerates a 404 from tables of the not-yet-applied migration but not from core tables", async () => {
    scenario((c) => (c.method === "DELETE" && c.url.includes("/rest/v1/employer_blocks") ? ({ ok: false, status: 404 } as unknown as Response) : undefined));
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(200);

    scenario((c) => (c.method === "DELETE" && c.url.includes("/rest/v1/sessions") ? ({ ok: false, status: 404 } as unknown as Response) : undefined));
    const res2 = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res2);
    expect(res2.statusCode).toBe(500);
    expect((res2.body as { error: string }).error).toContain("sessions");
  });

  it("removes chat attachment objects from storage before deleting the message rows", async () => {
    const calls = scenario((c) =>
      c.url.includes("conversation_messages?or=") ? json([{ attachment_path: "c1/a.pdf" }, { attachment_path: "c1/a.pdf" }, { attachment_path: "../evil" }]) : undefined,
    );
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(200);
    const storageIdx = calls.findIndex((c) => c.url.includes("/storage/v1/object/chat-attachments"));
    const msgDeleteIdx = calls.findIndex((c) => c.method === "DELETE" && c.url.includes("/rest/v1/conversation_messages?candidate_user_id"));
    expect(storageIdx).toBeGreaterThan(-1);
    expect(storageIdx).toBeLessThan(msgDeleteIdx);
    expect(JSON.parse(calls[storageIdx].body!)).toEqual({ prefixes: ["c1/a.pdf"] });
  });

  it("fails the erasure (retried by the cron) when storage cleanup throws, rather than orphaning files", async () => {
    scenario((c) => {
      if (c.url.includes("conversation_messages?or=")) return json([{ attachment_path: "c1/a.pdf" }]);
      if (c.url.includes("/storage/v1/")) throw new Error("storage down");
      return undefined;
    });
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(500);
    const err = (res.body as { error: string }).error;
    expect(err).toContain("resume-files");
    expect(err).toContain("chat-attachments");
  });

  it("retains an employer with payment rows: anonymises, deactivates the auth user (PUT) and never DELETEs it", async () => {
    const calls = scenario((c) => {
      if (c.url.includes("/rest/v1/employers?id=eq.")) {
        return c.method === "PATCH" ? ({ ok: true } as Response) : json([{ id: USER_ID, logo_path: "u/logo.png" }]);
      }
      if (c.url.includes("/rest/v1/employer_unlock_payments?employer_id")) return json([{ id: "p1" }]);
      return undefined;
    });
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, retainedFinancialRecords: true });
    const patch = calls.find((c) => c.method === "PATCH" && c.url.includes("/rest/v1/employers?id="));
    expect(JSON.parse(patch!.body!)).toMatchObject({ company_name: "", website: "", logo_path: null, suspended_reason: "account deleted by user" });
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/rest/v1/employer_requirements?employer_id"))).toBe(true);
    const logoDelete = calls.find((c) => c.method === "DELETE" && c.url.endsWith("/storage/v1/object/employer-logos"));
    expect(JSON.parse(logoDelete!.body!)).toEqual({ prefixes: ["u/logo.png"] });
    const put = calls.find((c) => c.method === "PUT" && c.url.includes("/auth/v1/admin/users/"));
    expect(JSON.parse(put!.body!)).toMatchObject({ ban_duration: "876000h", email: `deleted-${USER_ID}@deleted.invalid` });
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/auth/v1/admin/users/"))).toBe(false);
    expect(captureServerEvent).toHaveBeenCalledWith("account_deleted", PSEUDONYM, { mode: "hard", retainedFinancialRecords: true, $process_person_profile: false });
  });

  it("hard-deletes the auth user for an employer with no financial rows", async () => {
    const calls = scenario((c) => (c.url.includes("/rest/v1/employers?id=eq.") ? json([{ id: USER_ID, logo_path: null }]) : undefined));
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.body).toEqual({ success: true });
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/auth/v1/admin/users/"))).toBe(true);
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("treats a missing employer_unlock_orders table (404) as zero orders", async () => {
    const calls = scenario((c) => {
      if (c.url.includes("/rest/v1/employers?id=eq.")) return json([{ id: USER_ID }]);
      if (c.url.includes("employer_unlock_orders")) return { ok: false, status: 404 } as unknown as Response;
      return undefined;
    });
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(200);
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("fails closed with 500 (and deletes nothing) when the employer lookup fails", async () => {
    const calls = scenario((c) => (c.url.includes("/rest/v1/employers?id=eq.") ? ({ ok: false, status: 500 } as unknown as Response) : undefined));
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: string }).error).toContain("employer data");
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("207s with retainedFinancialRecords when auth deactivation of a retained employer fails", async () => {
    scenario((c) => {
      if (c.url.includes("/rest/v1/employers?id=eq.")) return c.method === "PATCH" ? ({ ok: true } as Response) : json([{ id: USER_ID }]);
      if (c.url.includes("/rest/v1/employer_unlock_payments?employer_id")) return json([{ id: "p1" }]);
      if (c.method === "PUT") return { ok: false, status: 500 } as unknown as Response;
      return undefined;
    });
    const res = mockRes();
    await handler(mockReq({ password: "correct", hard: true }), res);
    expect(res.statusCode).toBe(207);
    expect(res.body).toMatchObject({ success: true, partial: true, retainedFinancialRecords: true });
  });
});

describe("delete-account — employer block and restore", () => {
  it("blocks the employer row at soft delete without overwriting an existing suspension", async () => {
    const fetchMock = fullSuccessFetch();
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct" }), res);
    expect(res.statusCode).toBe(200);
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("/rest/v1/employers?") && String(u).includes("suspended_at=is.null"));
    expect(call).toBeDefined();
    expect(JSON.parse((call![1] as RequestInit).body as string)).toMatchObject({ suspended_reason: "account_deletion_pending" });
  });

  it("reverts the schedule and 500s when the employer block fails", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/rest/v1/employers")) return { ok: false, status: 500 } as Response;
      void init;
      return { ok: true, json: async () => [] } as unknown as Response;
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ password: "correct" }), res);
    expect(res.statusCode).toBe(500);
    const revert = fetchMock.mock.calls.find(([u, i]) => String(u).includes("/rest/v1/profiles") && (i as RequestInit)?.body && JSON.parse((i as RequestInit).body as string).deleted_at === null);
    expect(revert).toBeDefined();
  });

  it("restore lifts only the deletion-pending block", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => ({ ok: true }) as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ restore: true }), res);
    expect(res.statusCode).toBe(200);
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes("/rest/v1/employers?"));
    expect(String(call![0])).toContain("suspended_reason=eq.account_deletion_pending");
    expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ suspended_at: null, suspended_reason: null });
  });

  it("500s when the employer unblock fails", async () => {
    global.fetch = vi.fn(async (url: string) => (String(url).includes("/rest/v1/employers") ? { ok: false, status: 500 } : { ok: true })) as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ restore: true }), res);
    expect(res.statusCode).toBe(500);
  });
});
