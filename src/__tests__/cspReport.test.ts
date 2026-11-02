import { describe, it, expect, vi, afterEach } from "vitest";
import { reportOnlyCsp, isEmployerConsolePath, shouldSendCspTrial, summarizeCspReports } from "../../server-handlers/_csp-report-helpers";
import handler from "../../server-handlers/csp-report";

describe("reportOnlyCsp", () => {
  const enforced = "default-src 'self'; script-src 'self' 'unsafe-inline' blob:; script-src-elem 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'";
  it("drops unsafe-inline from script directives only", () => {
    const out = reportOnlyCsp(enforced);
    expect(out).toContain("script-src 'self' blob:");
    expect(out).toContain("script-src-elem 'self'");
    expect(out).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(out).toContain("style-src 'self' 'unsafe-inline'");
  });
  it("adds the report endpoint", () => {
    expect(reportOnlyCsp(enforced)).toMatch(/; report-uri \/api\/csp-report$/);
  });
});

describe("isEmployerConsolePath", () => {
  it("matches the console but not the marketing page", () => {
    expect(isEmployerConsolePath("/employer")).toBe(true);
    expect(isEmployerConsolePath("/employer/requirements/x")).toBe(true);
    expect(isEmployerConsolePath("/employers")).toBe(false);
    expect(isEmployerConsolePath("/dashboard")).toBe(false);
  });
});

describe("summarizeCspReports", () => {
  it("reads the legacy body and strips ids and query strings", () => {
    const [v] = summarizeCspReports({
      "csp-report": {
        "effective-directive": "script-src-elem",
        "blocked-uri": "inline",
        "document-uri": "https://app.hirestepx.com/employer/requirements/03e91b34-f38c-4dc6-aa13-a5e6d67ff4fd?x=1",
        "script-sample": "self.__next_f.push",
      },
    });
    expect(v).toMatchObject({ directive: "script-src-elem", blocked: "inline", sample: "self.__next_f.push" });
    expect(v.page).toBe("https://app.hirestepx.com/employer/requirements/:id");
  });
  it("reads the Reporting API array body", () => {
    const out = summarizeCspReports([{ type: "csp-violation", body: { effectiveDirective: "script-src", blockedURL: "inline", documentURL: "https://a/b" } }]);
    expect(out).toHaveLength(1);
    expect(out[0].directive).toBe("script-src");
  });
  it("ignores junk", () => {
    expect(summarizeCspReports(null)).toEqual([]);
    expect(summarizeCspReports([1, "x", {}])).toEqual([]);
  });
});

describe("csp-report handler", () => {
  afterEach(() => vi.restoreAllMocks());
  const post = (body: string) => new Request("https://app.hirestepx.com/api/csp-report", { method: "POST", body, headers: { "x-real-ip": "9.9.9.9" } });
  it("logs a summary and answers 204", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await handler(post(JSON.stringify({ "csp-report": { "effective-directive": "script-src", "blocked-uri": "inline" } })));
    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it("rejects bad JSON and wrong methods", async () => {
    expect((await handler(post("{nope"))).status).toBe(400);
    expect((await handler(new Request("https://x/api/csp-report"))).status).toBe(405);
  });
});

describe("shouldSendCspTrial", () => {
  it("sends the trial header on a small sample of employer loads only", () => {
    expect(shouldSendCspTrial("/employer/jobs", 0.01)).toBe(true);
    expect(shouldSendCspTrial("/employer/jobs", 0.5)).toBe(false);
    expect(shouldSendCspTrial("/dashboard", 0.01)).toBe(false);
  });
});
