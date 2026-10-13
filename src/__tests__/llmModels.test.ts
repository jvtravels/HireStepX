import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  geminiLadder, geminiProviderName, isGeminiProviderName, geminiThinkingConfig, groqModel, isModelRetiredError, DEFAULT_GEMINI_MODELS, cloudflareModel, DEFAULT_CLOUDFLARE_MODEL,
} from "../../server-handlers/_llm-models";
import { buildReport, classifyProbe, isListed, ladderIsThin, needsAction, KNOWN_RETIRING } from "../../server-handlers/_llm-watchdog-helpers";

describe("geminiLadder", () => {
  it("defaults to the verified-stable models", () => {
    expect(geminiLadder("")).toEqual([...DEFAULT_GEMINI_MODELS]);
    expect(geminiLadder(undefined)).toEqual([...DEFAULT_GEMINI_MODELS]);
  });
  it("honours an ordered env override, dedupes and caps at 3", () => {
    expect(geminiLadder("gemini-3.6-flash, gemini-3.6-flash ,gemini-2.5-flash-lite,a-b-c,d-e-f")).toEqual(["gemini-3.6-flash", "gemini-2.5-flash-lite", "a-b-c"]);
  });
  it("drops invalid ids and falls back when nothing valid remains", () => {
    expect(geminiLadder("../etc/passwd, x")).toEqual([...DEFAULT_GEMINI_MODELS]);
    expect(geminiLadder("bad id,gemini-3.6-flash")).toEqual(["gemini-3.6-flash"]);
  });
  it("keeps the legacy chain name for the first rung only", () => {
    expect(geminiProviderName(0, "gemini-3.6-flash")).toBe("gemini");
    expect(geminiProviderName(1, "gemini-2.5-flash-lite")).toBe("gemini-2.5-flash-lite");
    expect(isGeminiProviderName("gemini", ["x-y-z"])).toBe(true);
    expect(isGeminiProviderName("x-y-z", ["x-y-z"])).toBe(true);
    expect(isGeminiProviderName("groq", ["x-y-z"])).toBe(false);
  });
});

describe("geminiThinkingConfig", () => {
  it("uses a budget for 1.x/2.x and a level for everything newer", () => {
    expect(geminiThinkingConfig("gemini-2.5-flash-lite")).toEqual({ thinkingBudget: 0 });
    expect(geminiThinkingConfig("gemini-3.5-flash-lite")).toEqual({ thinkingLevel: "minimal" });
    expect(geminiThinkingConfig("gemini-3.8-flash")).toEqual({ thinkingLevel: "minimal" });
    expect(geminiThinkingConfig("gemini-4.0-flash")).toEqual({ thinkingLevel: "minimal" });
  });
});

describe("groqModel", () => {
  afterEach(() => { delete process.env.GROQ_MODEL; delete process.env.GROQ_FAST_MODEL; });
  it("defaults and honours env overrides", () => {
    expect(groqModel(true)).toBe("openai/gpt-oss-20b");
    expect(groqModel(false)).toBe("openai/gpt-oss-120b");
    process.env.GROQ_MODEL = "openai/gpt-oss-next";
    expect(groqModel(false)).toBe("openai/gpt-oss-next");
    expect(groqModel(true)).toBe("openai/gpt-oss-20b");
  });
});

describe("isModelRetiredError", () => {
  it("recognises a gone model", () => {
    expect(isModelRetiredError("Gemini error 404: models/gemini-x is not found for API version v1beta")).toBe(true);
    expect(isModelRetiredError("Groq error 404: The model `x` does not exist or you do not have access to it")).toBe(true);
    expect(isModelRetiredError("Gemini error 400: model has been deprecated")).toBe(true);
  });
  it("does not confuse capacity or request errors with retirement", () => {
    expect(isModelRetiredError("Gemini error 503: high demand")).toBe(false);
    expect(isModelRetiredError("Gemini error 429: RESOURCE_EXHAUSTED")).toBe(false);
    expect(isModelRetiredError("Gemini error 400: invalid argument")).toBe(false);
  });
});

describe("watchdog helpers", () => {
  it("matches ids with or without the models/ prefix", () => {
    expect(isListed("gemini-3.5-flash-lite", new Set(["models/gemini-3.5-flash-lite"]))).toBe(true);
    expect(isListed("gemini-3.5-flash-lite", ["models/other"])).toBe(false);
  });
  it("classifies probes: 404 is gone, capacity is not retirement", () => {
    expect(classifyProbe(200)).toBe("ok");
    expect(classifyProbe(404)).toBe("missing");
    expect(classifyProbe(503)).toBe("busy");
    expect(classifyProbe(429)).toBe("busy");
    expect(classifyProbe(null)).toBe("busy");
    expect(classifyProbe(400)).toBe("error");
  });
  it("flags known-retiring ids even when they still answer", () => {
    const id = Object.keys(KNOWN_RETIRING)[0];
    expect(buildReport("gemini", id, new Set([id]), 200).status).toBe("retiring");
  });
  it("flags a model missing from the vendor list", () => {
    expect(buildReport("gemini", "gemini-3.5-flash-lite", new Set(["models/other"]), 200).status).toBe("missing");
  });
  it("does not alert on a busy model, and tolerates a failed list call", () => {
    const busy = buildReport("gemini", "gemini-3.5-flash-lite", null, 503);
    expect(busy.status).toBe("busy");
    expect(needsAction(busy)).toBe(false);
  });
  it("reports a thin ladder when fewer than two Gemini models answer", () => {
    const ok = (model: string) => buildReport("gemini", model, null, 200);
    expect(ladderIsThin([ok("a-b-c"), ok("d-e-f")])).toBe(false);
    expect(ladderIsThin([ok("a-b-c"), buildReport("gemini", "d-e-f", null, 503)])).toBe(true);
  });
});

describe("llm-model-watchdog handler", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CRON_SECRET = "s3cret";
    process.env.GEMINI_API_KEY = "g";
    process.env.GROQ_API_KEY = "q";
    delete process.env.RESEND_API_KEY;
    delete process.env.SLACK_ALERT_WEBHOOK_URL;
    delete process.env.GEMINI_MODELS;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of ["CRON_SECRET", "GEMINI_API_KEY", "GROQ_API_KEY"]) delete process.env[k];
  });

  const stub = (opts: { geminiListed: string[]; probe: (url: string) => number; groqListed: string[] }) =>
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("generativelanguage") && u.includes(":generateContent")) return new Response("{}", { status: opts.probe(u) });
      if (u.includes("generativelanguage")) return new Response(JSON.stringify({ models: opts.geminiListed.map((name) => ({ name })) }), { status: 200 });
      if (u.includes("api.groq.com")) return new Response(JSON.stringify({ data: opts.groqListed.map((id) => ({ id })) }), { status: 200 });
      return new Response("{}", { status: 200 });
    }));

  const call = async (secret?: string) => {
    const { default: handler } = await import("../../server-handlers/llm-model-watchdog");
    return handler(new Request("https://x/api/cron/llm-model-watchdog", { headers: secret ? { authorization: `Bearer ${secret}` } : {} }));
  };

  it("fails closed without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("wrong")).status).toBe(401);
  });

  it("reports ok when every configured model is listed and answering", async () => {
    stub({ geminiListed: ["models/gemini-3.5-flash-lite", "models/gemini-2.5-flash-lite", "models/gemini-2.5-flash"], probe: () => 200, groqListed: ["openai/gpt-oss-20b", "openai/gpt-oss-120b"] });
    const body = await (await call("s3cret")).json();
    expect(body.ok).toBe(true);
    expect(body.reports.every((r: { status: string }) => r.status === "ok")).toBe(true);
  });

  it("alerts when a configured model disappears from the vendor list", async () => {
    stub({ geminiListed: ["models/gemini-2.5-flash-lite", "models/gemini-2.5-flash"], probe: () => 200, groqListed: ["openai/gpt-oss-20b", "openai/gpt-oss-120b"] });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await (await call("s3cret")).json();
    expect(body.ok).toBe(false);
    expect(body.reports.find((r: { model: string }) => r.model === "gemini-3.5-flash-lite").status).toBe("missing");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("does not page on Gemini capacity errors alone", async () => {
    stub({ geminiListed: ["models/gemini-3.5-flash-lite", "models/gemini-2.5-flash-lite", "models/gemini-2.5-flash"], probe: (u) => (u.includes("3.5") ? 503 : 200), groqListed: ["openai/gpt-oss-20b", "openai/gpt-oss-120b"] });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await (await call("s3cret")).json();
    expect(body.reports.find((r: { model: string }) => r.model === "gemini-3.5-flash-lite").status).toBe("busy");
    errSpy.mockRestore();
  });
});

describe("cloudflareModel", () => {
  it("defaults to gpt-oss-120b and honours a valid override", () => {
    expect(cloudflareModel("")).toBe(DEFAULT_CLOUDFLARE_MODEL);
    expect(cloudflareModel(undefined)).toBe("@cf/openai/gpt-oss-120b");
    expect(cloudflareModel(" @cf/meta/llama-3.3-70b-instruct-fp8-fast ")).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
  });
  it("ignores an invalid id instead of sending it to the API", () => {
    expect(cloudflareModel("../x y")).toBe(DEFAULT_CLOUDFLARE_MODEL);
    expect(cloudflareModel("gpt-oss-120b")).toBe(DEFAULT_CLOUDFLARE_MODEL);
  });
  it("reports a model present in the vendor list as ok and a missing one as missing", () => {
    expect(buildReport("cloudflare", "@cf/openai/gpt-oss-120b", new Set(["@cf/openai/gpt-oss-120b"]), undefined).status).toBe("ok");
    expect(buildReport("cloudflare", "@cf/openai/gpt-oss-120b", new Set(["@cf/openai/gpt-oss-20b"]), undefined).status).toBe("missing");
  });
});
