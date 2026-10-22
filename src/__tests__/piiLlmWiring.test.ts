import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

vi.hoisted(() => {
  process.env.GROQ_API_KEY = "test-groq-key";
  process.env.GEMINI_API_KEY = "test-gemini-key";
});

const rawCallLLM = vi.fn();

vi.mock("../../server-handlers/_shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_shared")>();
  return {
    ...actual,
    withAuthAndRateLimit: vi.fn(async () => ({
      headers: { "Content-Type": "application/json" },
      auth: { userId: "user-1" },
      quota: { tier: "free" },
    })),
    getSubscriptionTier: vi.fn(async () => "free"),
    redisIncrByWithExpiry: vi.fn(async () => 1),
    redisGet: vi.fn(async () => null),
    redisSetEx: vi.fn(async () => undefined),
    logServiceUsage: vi.fn(),
  };
});

vi.mock("../../server-handlers/_posthog", () => ({
  captureServerEvent: vi.fn(async () => undefined),
  captureServerException: vi.fn(async () => undefined),
  distinctIdFrom: vi.fn(() => "distinct"),
}));

vi.mock("../../server-handlers/_llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_llm")>();
  return { ...actual, callLLM: (...args: unknown[]) => rawCallLLM(...args) };
});

import analyzeResume from "../../server-handlers/analyze-resume";
import evaluateSession from "../../server-handlers/evaluate-session";
import { callLLM } from "../../server-handlers/_llm-pii";

const RAW = ["rahul.sharma@gmail.com", "98765 43210", "2345 6789 0124", "ABCPE1234F", "4111 1111 1111 1111", "rahul.k@okhdfcbank", "14/03/1996"];

function expectNoRawPii(prompt: string) {
  for (const raw of RAW) expect(prompt).not.toContain(raw);
}

const RESUME = `Rahul Sharma
Email: rahul.sharma@gmail.com | Phone: +91 98765 43210
Address: Flat 402, Sunrise Apartments, MG Road, Bengaluru 560001
DOB: 14/03/1996  Aadhaar: 2345 6789 0124  PAN: ABCPE1234F
UPI: rahul.k@okhdfcbank  Card 4111 1111 1111 1111
Senior Engineer at Infosys, 2019-2023. Cut latency by 98.5% and saved ₹12,00,000 per year. CTC 18 LPA.`;

describe("analyze-resume: prompt is scrubbed, response keeps product fields", () => {
  beforeEach(() => {
    rawCallLLM.mockReset();
  });

  it("sends no raw identifiers upstream but keeps name, employer, years and amounts", async () => {
    rawCallLLM.mockResolvedValue({
      text: JSON.stringify({
        name: "Rahul Sharma",
        headline: "Senior Engineer",
        summary: "Reach him at [EMAIL_1] or [PHONE_1]. Cut latency by 98.5% at Infosys.",
        resumeScore: 70,
      }),
      model: "gemini",
      fallback: false,
    });
    const res = await analyzeResume(
      new Request("https://app.hirestepx.com/api/analyze-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText: RESUME, targetRole: "Backend Engineer" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(rawCallLLM).toHaveBeenCalledTimes(1);
    const sentPrompt = rawCallLLM.mock.calls[0][0].prompt as string;
    expectNoRawPii(sentPrompt);
    expect(sentPrompt).toContain("[EMAIL_1]");
    expect(sentPrompt).toContain("[PHONE_1]");
    expect(sentPrompt).toContain("Rahul Sharma");
    expect(sentPrompt).toContain("Infosys");
    expect(sentPrompt).toContain("2019-2023");
    expect(sentPrompt).toContain("98.5%");
    expect(sentPrompt).toContain("₹12,00,000");
    expect(sentPrompt).toContain("18 LPA");

    const body = JSON.stringify(await res.json());
    expect(body).not.toMatch(/\[(EMAIL|PHONE)_\d+\]/);
    expect(body).not.toContain("rahul.sharma@gmail.com");
    expect(body).toContain("Infosys");
  });
});

describe("evaluate-session: transcript and resume context are scrubbed", () => {
  beforeEach(() => {
    rawCallLLM.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("never lets a raw identifier reach any provider call, including retries", async () => {
    rawCallLLM.mockResolvedValue({ text: "not json", model: "groq", fallback: false });
    const res = await evaluateSession(
      new Request("https://app.hirestepx.com/api/evaluate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-pii-1",
          transcript: [
            { role: "interviewer", text: "Tell me about a time you reduced latency." },
            {
              role: "candidate",
              text: "Sure. At Infosys I cut p99 by 98.5% in 2022. You can reach me at rahul.sharma@gmail.com or 98765 43210 and my PAN is ABCPE1234F.",
            },
          ],
          meta: { role: "Backend Engineer", type: "behavioral", resumeContext: { headline: "Backend dev, Aadhaar 2345 6789 0124", keyAchievements: ["Cut p99 by 98.5%, contact rahul.k@okhdfcbank"] } },
        }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(rawCallLLM.mock.calls.length).toBeGreaterThan(0);
    for (const call of rawCallLLM.mock.calls) {
      const prompt = call[0].prompt as string;
      expectNoRawPii(prompt);
      expect(prompt).toContain("98.5%");
    }
    expect(rawCallLLM.mock.calls[0][0].prompt).toContain("[EMAIL_1]");
    expect(rawCallLLM.mock.calls[0][0].prompt).toContain("[AADHAAR_1]");
    expect(rawCallLLM.mock.calls[0][0].prompt).toContain("[UPI_1]");
  });
});

describe("callLLM wrapper", () => {
  beforeEach(() => {
    rawCallLLM.mockReset();
  });

  it("restores placeholders in the reply and JSON-escapes them in jsonMode", async () => {
    rawCallLLM.mockImplementation(async (opts: { prompt: string }) => {
      expectNoRawPii(opts.prompt);
      return { text: '{"echo":"[ADDRESS_1] / [EMAIL_1] / [DOB_1]"}', model: "m", fallback: false };
    });
    const r = await callLLM(
      { prompt: 'Address: Flat 4, "Rose" Apts, MG Road, Pune 411001\nmail rahul.sharma@gmail.com\nDOB: 14/03/1996', jsonMode: true },
      5000,
      { endpoint: "t" },
    );
    const parsed = JSON.parse(r.text) as { echo: string };
    expect(parsed.echo).toBe('Flat 4, "Rose" Apts, MG Road, Pune 411001 / rahul.sharma@gmail.com / 14/03/1996');
    expect(rawCallLLM.mock.calls[0][1]).toBe(5000);
    expect(rawCallLLM.mock.calls[0][2]).toEqual({ endpoint: "t" });
  });

  it("passes prompts without PII through untouched (same options object)", async () => {
    const opts = { prompt: "Explain CAP theorem in 2019-2023 terms, 98.5% please" };
    rawCallLLM.mockResolvedValue({ text: "ok", model: "m", fallback: false });
    await callLLM(opts);
    expect(rawCallLLM.mock.calls[0][0]).toBe(opts);
    expect(rawCallLLM.mock.calls[0]).toHaveLength(1);
  });
});

describe("wiring guard", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? walk(p) : /\.ts$/.test(n) ? [p] : [];
    });
  }

  it("no server-handler imports callLLM straight from _llm (must use _llm-pii)", () => {
    const offenders = walk(join(process.cwd(), "server-handlers"))
      .filter((f) => !f.endsWith("_llm-pii.ts"))
      .filter((f) => /import\s*\{[^}]*\bcallLLM\b[^}]*\}\s*from\s*"(?:\.\/|\.\.\/)+_llm"/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
