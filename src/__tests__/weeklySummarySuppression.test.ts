import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const U_OPTED_OUT = "11111111-1111-4111-8111-111111111111";
const U_OK = "22222222-2222-4222-8222-222222222222";

interface Sent { to: string[]; headers?: Record<string, string>; reply_to?: string; html: string }

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function runCron(prefsResponse: () => Response): Promise<{ sent: Sent[]; body: Record<string, number> }> {
  vi.resetModules();
  const sent: Sent[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("api.resend.com")) {
      sent.push(JSON.parse(String(init?.body)) as Sent);
      return jsonRes(200, { id: "e1" });
    }
    if (url.includes("/rest/v1/email_preferences")) return prefsResponse();
    if (url.includes("/rest/v1/profiles?select=")) {
      return jsonRes(200, [
        { id: U_OPTED_OUT, email: "out@x.test", name: "Out", last_summary_email_at: null },
        { id: U_OK, email: "ok@x.test", name: "Ok", last_summary_email_at: null },
      ]);
    }
    if (url.includes("/rest/v1/sessions")) return jsonRes(200, url.includes("select=id,") ? [{ id: "s1", user_id: U_OK, score: 70, created_at: new Date().toISOString(), report_json: {} }] : [{ id: "s1" }]);
    return jsonRes(200, []);
  }));
  const mod = await import("../../server-handlers/weekly-summary");
  const res = await mod.default(new Request("https://hirestepx.com/api/weekly-summary", { headers: { authorization: "Bearer cron-secret" } }));
  return { sent, body: (await res.json()) as Record<string, number> };
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("SUPABASE_URL", "https://db.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret-at-least-16-chars");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("weekly-summary suppression", () => {
  it("skips opted-out users and sends one-click unsubscribe headers to the rest", async () => {
    const { sent, body } = await runCron(() => jsonRes(200, [{ user_id: U_OPTED_OUT }]));
    expect(sent.map((s) => s.to[0])).toEqual(["ok@x.test"]);
    expect(body.suppressed).toBe(1);
    expect(sent[0].headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(sent[0].headers?.["List-Unsubscribe"]).toContain("/api/unsubscribe?t=");
    expect(sent[0].reply_to).toBe("hello@hirestepx.com");
    expect(sent[0].html).toContain("Unsubscribe");
  });

  it("still sends when the migration is not applied yet", async () => {
    const { sent } = await runCron(() => jsonRes(404, { code: "PGRST205" }));
    expect(sent).toHaveLength(2);
  });

  it("sends nothing when the suppression lookup fails (fail closed)", async () => {
    const { sent } = await runCron(() => jsonRes(500, { message: "down" }));
    expect(sent).toHaveLength(0);
  });
});
