import { describe, it, expect, vi, beforeEach } from "vitest";
import { isActionRequired, actionSubjectBits } from "../../server-handlers/_health-alerts";

const alert = (code: string, severity: "critical" | "warning" = "critical") => ({ severity, code, message: "m", action: "a" });
const getHealthAlerts = vi.fn();

vi.mock("../../server-handlers/_health-alerts", async (orig) => ({
  ...(await orig<typeof import("../../server-handlers/_health-alerts")>()),
  getHealthAlerts: (...a: unknown[]) => getHealthAlerts(...a),
}));

const { default: handler } = await import("../../server-handlers/uptime-check");
const call = () => handler(new Request("https://x.test/api/uptime-check", { headers: { authorization: "Bearer s3cret" } }));

let resendBodies: { subject: string }[] = [];
function installFetch(resend: { ok: boolean; status?: number } | "throw", health = { status: "healthy", timestamp: "t" }) {
  global.fetch = vi.fn(async (url: string, init?: { body?: string }) => {
    if (String(url).includes("resend.com")) {
      if (resend === "throw") throw new Error("network down");
      resendBodies.push(JSON.parse(String(init?.body)));
      return { ok: resend.ok, status: resend.status ?? (resend.ok ? 200 : 500), json: async () => ({}) };
    }
    return { ok: true, json: async () => health };
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.CRON_SECRET = "s3cret";
  process.env.RESEND_API_KEY = "re_key";
  resendBodies = [];
  getHealthAlerts.mockReset().mockResolvedValue({ alerts: [], checkedAt: "t" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("health alert classification", () => {
  it("treats refund owed, stuck paid orders, stale crons and a blind order check as action-required", () => {
    for (const code of ["unlock_refund_due", "unlock_order_stuck_paid", "cron_stale", "employer_health_unreadable"]) {
      expect(isActionRequired([alert(code)])).toBe(true);
    }
  });

  it("does not flag ordinary signals, including a missing heartbeat", () => {
    expect(isActionRequired([alert("groq_fallback_rate", "warning"), alert("cron_heartbeat_missing", "warning")])).toBe(false);
    expect(isActionRequired([])).toBe(false);
  });

  it("names the action items in the subject bits without repeating", () => {
    const bits = actionSubjectBits([alert("unlock_refund_due"), alert("unlock_refund_due"), alert("cron_stale")]);
    expect(bits).toEqual(expect.arrayContaining(["refund owed", "cron stale"]));
    expect(bits).toHaveLength(2);
  });

  it("is safe for inherited property names", () => {
    expect(isActionRequired([alert("constructor"), alert("toString")])).toBe(false);
  });
});

describe("uptime-check alert email delivery", () => {
  it("prefixes the subject with [ACTION] when a refund is owed", async () => {
    getHealthAlerts.mockResolvedValue({ alerts: [alert("unlock_refund_due")], checkedAt: "t" });
    installFetch({ ok: true });
    const res = await call();
    expect(resendBodies[0].subject).toMatch(/^\[ACTION\] \[ALERT\] HireStepX: .*refund owed/);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ alert: true, alertEmailSent: true });
  });

  it("uses the plain [ALERT] subject for non-action signals", async () => {
    getHealthAlerts.mockResolvedValue({ alerts: [alert("groq_fallback_rate", "warning")], checkedAt: "t" });
    installFetch({ ok: true });
    await call();
    expect(resendBodies[0].subject.startsWith("[ALERT]")).toBe(true);
  });

  it("returns 500 with alertEmailSent=false and logs when Resend rejects the email", async () => {
    getHealthAlerts.mockResolvedValue({ alerts: [alert("cron_stale")], checkedAt: "t" });
    installFetch({ ok: false, status: 403 });
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ alert: true, alertEmailSent: false });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("alert_email_failed"));
  });

  it("returns 500 when the Resend request throws", async () => {
    getHealthAlerts.mockResolvedValue({ alerts: [alert("cron_stale")], checkedAt: "t" });
    installFetch("throw");
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ alertEmailSent: false });
  });

  it("returns 500 and logs when RESEND_API_KEY is missing", async () => {
    process.env.RESEND_API_KEY = "";
    getHealthAlerts.mockResolvedValue({ alerts: [alert("cron_stale")], checkedAt: "t" });
    installFetch({ ok: true });
    const res = await call();
    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("alert_email_unconfigured"));
  });

  it("stays 200 with no email when everything is healthy", async () => {
    installFetch({ ok: true });
    const res = await call();
    expect(res.status).toBe(200);
    expect(resendBodies).toHaveLength(0);
  });
});

describe("uptime-check when /api/health itself is unreachable", () => {
  type Sent = { url: string; body: { subject?: string; to?: string[]; text?: string } };
  let sent: Sent[] = [];
  let healthUrls: string[] = [];
  function installDown(o: { resend?: "ok" | "fail"; slack?: "ok" | "fail" | "unset" } = {}) {
    global.fetch = vi.fn(async (url: string, init?: { body?: string }) => {
      const u = String(url);
      if (u.includes("resend.com")) {
        sent.push({ url: u, body: JSON.parse(String(init?.body)) });
        return { ok: (o.resend ?? "ok") === "ok", status: (o.resend ?? "ok") === "ok" ? 200 : 500, json: async () => ({}) };
      }
      if (u.includes("hooks.slack.test")) {
        sent.push({ url: u, body: JSON.parse(String(init?.body)) });
        return { ok: o.slack === "ok", status: o.slack === "ok" ? 200 : 500, json: async () => ({}) };
      }
      healthUrls.push(u);
      throw new Error("connect ETIMEDOUT");
    }) as unknown as typeof fetch;
  }

  beforeEach(() => {
    sent = [];
    healthUrls = [];
    delete process.env.SLACK_ALERT_WEBHOOK_URL;
    delete process.env.ALERT_EMAIL;
    delete process.env.APP_URL;
    process.env.VERCEL_URL = "preview-abc.vercel.app";
  });

  it("emails an [ACTION] alert and returns 503 instead of only logging", async () => {
    installDown();
    const res = await call();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ alert: true, alertEmailSent: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].body.subject).toBe("[ACTION] [ALERT] HireStepX: health check unreachable");
    expect(sent[0].body.text).toContain("connect ETIMEDOUT");
  });

  it("probes the production host, never the per-deployment VERCEL_URL", async () => {
    installDown();
    await call();
    expect(healthUrls).toEqual(["https://hirestepx.com/api/health"]);
    process.env.APP_URL = "https://app.example.com/";
    healthUrls = [];
    await call();
    expect(healthUrls).toEqual(["https://app.example.com/api/health"]);
  });

  it("sends to ALERT_EMAIL when set, else the support default", async () => {
    installDown();
    await call();
    expect(sent[0].body.to).toEqual(["support@hirestepx.com"]);
    sent = [];
    process.env.ALERT_EMAIL = "oncall@example.com";
    await call();
    expect(sent[0].body.to).toEqual(["oncall@example.com"]);
  });

  it("falls back to Slack when email fails, and reports delivered", async () => {
    process.env.SLACK_ALERT_WEBHOOK_URL = "https://hooks.slack.test/T/B/x";
    installDown({ resend: "fail", slack: "ok" });
    const res = await call();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ alert: true, alertEmailSent: true });
    expect(sent.some((s) => s.url.includes("hooks.slack.test"))).toBe(true);
  });

  it("reports alertEmailSent:false when no channel delivers", async () => {
    installDown({ resend: "fail" });
    const res = await call();
    expect(await res.json()).toMatchObject({ alert: true, alertEmailSent: false });
  });

  it("keeps the alertEmailSent:false / 500 behaviour on the degraded-health path", async () => {
    getHealthAlerts.mockResolvedValue({ alerts: [alert("cron_stale")], checkedAt: "t" });
    installFetch({ ok: false });
    const res = await call();
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ alert: true, alertEmailSent: false });
  });
});
