import { describe, it, expect, vi, beforeEach } from "vitest";
import { readAllPages, contentRangeTotal, type RestGet } from "../../server-handlers/_paged-fetch";
import { getEmployerHealthAlerts } from "../../server-handlers/_employer-health-signals";
import { getHealthAlerts } from "../../server-handlers/_health-alerts";

const res = (body: unknown, ok = true, status = ok ? 200 : 500, headers: Record<string, string> = {}) =>
  ({ ok, status, json: async () => body, headers: new Headers(headers) }) as unknown as Response;
const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ id: `id-${String(from + i).padStart(6, "0")}` }));

describe("readAllPages keyset mode", () => {
  it("orders by the key and continues with key=gt.<last>, never offset", async () => {
    const all = ids(0, 2250);
    const get = vi.fn<RestGet>(async (path) => {
      const after = /id=gt\.([^&]+)/.exec(path)?.[1];
      const start = after ? all.findIndex((r) => r.id === decodeURIComponent(after)) + 1 : 0;
      return res(all.slice(start, start + 1000));
    });
    const out = await readAllPages<{ id: string }>(get, "t?select=id", { keyset: "id" });
    expect(out.rows).toHaveLength(2250);
    expect(new Set(out.rows.map((r) => r.id)).size).toBe(2250);
    expect(out.truncated).toBe(false);
    const paths = get.mock.calls.map((c) => c[0]);
    expect(paths[0]).toBe("t?select=id&order=id.asc&limit=1000");
    expect(paths[1]).toBe("t?select=id&order=id.asc&id=gt.id-000999&limit=1000");
    expect(paths.some((p) => p.includes("offset="))).toBe(false);
  });

  it("does not skip or repeat rows when rows are inserted mid-read (what offset paging gets wrong)", async () => {
    let table = ids(0, 1500);
    let calls = 0;
    const get: RestGet = async (path) => {
      calls++;
      if (calls === 2) table = [...ids(0, 3).map((r) => ({ id: `a-${r.id}` })), ...table]; // sorts before every existing id
      const after = /id=gt\.([^&]+)/.exec(path)?.[1];
      const sorted = [...table].sort((a, b) => (a.id < b.id ? -1 : 1));
      const rest = after ? sorted.filter((r) => r.id > decodeURIComponent(after)) : sorted;
      return res(rest.slice(0, 1000));
    };
    const out = await readAllPages<{ id: string }>(get, "t?select=id", { keyset: "id" });
    const got = out.rows.map((r) => r.id);
    expect(new Set(got).size).toBe(got.length);
    expect(got.filter((i) => i.startsWith("id-"))).toHaveLength(1500);
  });

  it("refuses a basePath that already orders, since it would fight the keyset order", async () => {
    await expect(readAllPages(async () => res([]), "t?select=id&order=created_at.desc", { keyset: "id" })).rejects.toThrow(/order=/);
  });

  it("fails loudly if the keyset column is missing from the rows", async () => {
    await expect(readAllPages(async () => res([{ other: 1 }]), "t?select=other", { keyset: "id" })).rejects.toThrow(/keyset column/);
  });

  it("flags truncated at maxRows and stops there", async () => {
    const get: RestGet = async (p) => res(ids(p.includes("id=gt.") ? 1000 : 0, 1000));
    const out = await readAllPages(get, "t?select=id", { keyset: "id", maxRows: 2000 });
    expect(out.rows).toHaveLength(2000);
    expect(out.truncated).toBe(true);
  });
});

describe("readAllPages Content-Range handling", () => {
  it("parses the total from the header and ignores */* and missing headers", () => {
    expect(contentRangeTotal(res([], true, 200, { "content-range": "0-999/5234" }))).toBe(5234);
    expect(contentRangeTotal(res([], true, 200, { "content-range": "*/0" }))).toBe(0);
    expect(contentRangeTotal(res([], true, 200, { "content-range": "0-9/*" }))).toBeNull();
    expect(contentRangeTotal(res([]))).toBeNull();
    expect(contentRangeTotal({ ok: true } as unknown as Response)).toBeNull();
  });

  it("keeps reading when a server max-rows below the page size returns short pages, as long as the total says more", async () => {
    // Server caps each response at 500 although we asked for 1000: a short page must not end the read.
    const all = ids(0, 1200);
    const get: RestGet = async (path) => {
      const after = /id=gt\.([^&]+)/.exec(path)?.[1];
      const start = after ? all.findIndex((r) => r.id === decodeURIComponent(after)) + 1 : 0;
      return res(all.slice(start, start + 500), true, 200, { "content-range": `0-499/${all.length}` });
    };
    const out = await readAllPages<{ id: string }>(get, "t?select=id", { keyset: "id" });
    expect(out.rows).toHaveLength(1200);
    expect(out.total).toBe(1200);
    expect(out.truncated).toBe(false);
  });

  it("stops at the total even when the last page is exactly full", async () => {
    const get = vi.fn<RestGet>(async () => res(ids(0, 1000), true, 200, { "content-range": "0-999/1000" }));
    const out = await readAllPages(get, "t?select=id", { keyset: "id" });
    expect(out.rows).toHaveLength(1000);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("falls back to the short-page rule when no count was requested", async () => {
    const get = vi.fn<RestGet>(async () => res(ids(0, 10)));
    expect((await readAllPages(get, "t?select=id", { keyset: "id" })).rows).toHaveLength(10);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe("getEmployerHealthAlerts refund_due_paise fallback", () => {
  const order = { razorpay_order_id: "order_1", status: "paid", created_at: new Date(Date.now() - 3 * 3_600_000).toISOString(), razorpay_payment_id: "pay_1" };
  let selects: string[] = [];

  function install(first: () => Response, second?: () => Response) {
    selects = [];
    global.fetch = vi.fn(async (url: string) => {
      const u = String(url);
      if (!u.includes("employer_unlock_orders")) return res([]);
      const sel = decodeURIComponent(/select=([^&]+)/.exec(u)?.[1] ?? "");
      selects.push(sel);
      return sel.includes("refund_due_paise") ? first() : (second ?? first)();
    }) as unknown as typeof fetch;
  }
  const codes = async () => (await getEmployerHealthAlerts()).map((a) => a.code);

  beforeEach(() => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
  });

  it("drops refund_due_paise only when the column is genuinely missing (42703)", async () => {
    install(() => res({ code: "42703" }, false, 400), () => res([order]));
    expect(await codes()).toContain("unlock_order_stuck_paid");
    expect(selects.some((s) => s.includes("refund_due_paise"))).toBe(true);
    expect(selects.some((s) => !s.includes("refund_due_paise"))).toBe(true);
  });

  it("does NOT fall back on a transient 5xx: it raises the unreadable alert and never queries without the refund column", async () => {
    install(() => res({ message: "upstream timeout" }, false, 503));
    const c = await codes();
    expect(c).toContain("employer_health_unreadable");
    expect(selects.every((s) => s.includes("refund_due_paise"))).toBe(true);
  });

  it("does NOT fall back on a network error either", async () => {
    install(() => { throw new Error("socket hang up"); });
    expect(await codes()).toContain("employer_health_unreadable");
    expect(selects.every((s) => s.includes("refund_due_paise"))).toBe(true);
  });

  it("still reports a refund owed when the column exists", async () => {
    install(() => res([{ ...order, status: "partial", razorpay_payment_id: "pay_1", refund_due_paise: 5900 }]));
    expect(await codes()).toContain("unlock_refund_due");
  });
});

describe("getHealthAlerts paging and degraded reporting", () => {
  const today = new Date().toISOString();
  beforeEach(() => {
    process.env.SUPABASE_URL = "https://proj.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function install(handler: (table: string, path: string) => Response) {
    global.fetch = vi.fn(async (url: string) => {
      const m = /\/rest\/v1\/([a-z_]+)\?/.exec(String(url));
      return m ? handler(m[1], decodeURIComponent(String(url))) : res([]);
    }) as unknown as typeof fetch;
  }

  it("reads llm_usage past the 1000-row PostgREST cap so the fallback rate is not computed from a prefix", async () => {
    // 1500 calls in the last 24h, the first 1000 by id are all primary and the last 500 all fallback: 33% overall.
    const rows = Array.from({ length: 1500 }, (_, i) => ({ id: `id-${String(i).padStart(5, "0")}`, is_fallback: i >= 1000, total_tokens: 1 }));
    install((table, path) => {
      if (table !== "llm_usage" || path.includes("created_at=lt.")) return res([]);
      const after = /id=gt\.([^&]+)/.exec(path)?.[1];
      const start = after ? rows.findIndex((r) => r.id === after) + 1 : 0;
      return res(rows.slice(start, start + 1000));
    });
    const out = await getHealthAlerts();
    expect(out.degraded).toBe(false);
    expect(out.alerts.some((a) => a.code === "llm_fallback_elevated" && a.message.includes("500/1500"))).toBe(true);
  });

  it("flags a failed read as degraded and skips its signals instead of treating it as zero", async () => {
    install((table) => (table === "llm_usage" ? res({ message: "boom" }, false, 503) : res([])));
    const out = await getHealthAlerts();
    expect(out.degraded).toBe(true);
    expect(out.degradedSources).toEqual(expect.arrayContaining(["llm_usage_24h", "llm_usage_prev_week"]));
    expect(out.alerts.some((a) => a.code === "health_read_degraded")).toBe(true);
    expect(out.alerts.some((a) => a.code.startsWith("llm_"))).toBe(false);
  });

  it("sets truncated when a source hits its row cap", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: `s-${i}`, llm_cost_inr: 1, score: 5, created_at: today }));
    let n = 0;
    install((table) => {
      if (table !== "sessions") return res([]);
      const page = n++;
      return res(full.map((r) => ({ ...r, id: `s-${String(page).padStart(4, "0")}-${r.id}` })));
    });
    const out = await getHealthAlerts();
    expect(out.truncated).toBe(true);
    expect(out.truncatedSources.length).toBeGreaterThan(0);
  });
});
