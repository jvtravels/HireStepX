/* Stateful fakes shared by the employer-unlock payment tests (fulfilment,
 * webhook, reconcile, verify). FakeUnlockDb speaks just enough PostgREST for
 * the unlock tables; fakeRazorpay answers the three read endpoints. Both are
 * plain `fetch` replacements so the production code runs unmodified. */


import type { UnlockOrderStatus } from "../../server-handlers/_unlock-fulfillment";
export const SUPABASE = "https://example.supabase.co";
export const HEADERS = { apikey: "service-key", Authorization: "Bearer service-key" };

export interface FakeOrder {
  id: string;
  razorpay_order_id: string;
  employer_id: string;
  requirement_id: string | null;
  mode: "single" | "batch";
  match_ids: string[];
  amount: number;
  currency: string;
  status: UnlockOrderStatus;
  razorpay_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
}
export interface FakeMatch {
  id: string;
  requirement_id: string;
  candidate_user_id: string;
  unlocked: boolean;
  unlocked_at: string | null;
  unlocked_candidate_name: string | null;
  unlocked_candidate_email: string | null;
  profiles: { name: string | null; email: string | null; employer_visibility: string | null } | null;
}
export interface FakeLedger {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  employer_id: string;
  amount: number;
  invoice_no: string;
  refunded_at: string | null;
  match_id?: string;
  match_ids?: string[];
}

const json = (body: unknown, status = 200) =>
  status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status });
const inList = (v: string | null): string[] | null => {
  const m = v?.match(/^in\.\((.*)\)$/);
  return m ? m[1].split(",").map(decodeURIComponent) : null;
};
const eq = (v: string | null): string | null => (v && v.startsWith("eq.") ? decodeURIComponent(v.slice(3)) : null);

export function order(over: Partial<FakeOrder> = {}): FakeOrder {
  return {
    id: "ord-row-1", razorpay_order_id: "order_1", employer_id: "emp-1", requirement_id: "req-1", mode: "single",
    match_ids: ["m1"], amount: 5900, currency: "INR", status: "created", razorpay_payment_id: null,
    created_at: "2026-10-10T08:00:00.000Z", paid_at: null, fulfilled_at: null, ...over,
  };
}
export function match(id: string, over: Partial<FakeMatch> = {}): FakeMatch {
  return {
    id, requirement_id: "req-1", candidate_user_id: `cand-${id}`, unlocked: false, unlocked_at: null,
    unlocked_candidate_name: null, unlocked_candidate_email: null,
    profiles: { name: `Name ${id}`, email: `${id}@example.com`, employer_visibility: "on" }, ...over,
  };
}

export class FakeUnlockDb {
  orders = new Map<string, FakeOrder>();
  ledger: FakeLedger[] = [];
  matches = new Map<string, FakeMatch>();
  blockedCandidates = new Set<string>();
  calls: Array<{ method: string; url: string }> = [];
  /** Return true to make a request fail with a 500. */
  failWhen: ((method: string, url: string) => boolean) | null = null;
  private invoiceSeq = 0;

  seed(o: { orders?: FakeOrder[]; matches?: FakeMatch[] }) {
    for (const x of o.orders ?? []) this.orders.set(x.razorpay_order_id, { ...x });
    for (const m of o.matches ?? []) this.matches.set(m.id, { ...m });
    return this;
  }

  handles(url: string) { return url.startsWith(SUPABASE); }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();
    this.calls.push({ method, url });
    if (this.failWhen?.(method, url)) return json({ message: "boom" }, 500);
    const u = new URL(url);
    const table = u.pathname.split("/rest/v1/")[1];
    const q = u.searchParams;
    const body = init?.body ? JSON.parse(String(init.body)) : null;

    if (table === "employer_unlock_orders") {
      let rows = [...this.orders.values()];
      const byOrder = eq(q.get("razorpay_order_id"));
      if (byOrder) rows = rows.filter((r) => r.razorpay_order_id === byOrder);
      const byPay = eq(q.get("razorpay_payment_id"));
      if (byPay) rows = rows.filter((r) => r.razorpay_payment_id === byPay);
      const st = q.get("status");
      const stIn = inList(st);
      if (stIn) rows = rows.filter((r) => stIn.includes(r.status));
      else if (eq(st)) rows = rows.filter((r) => r.status === eq(st));
      const lt = q.get("created_at")?.replace(/^lt\./, "");
      if (lt && q.get("created_at")?.startsWith("lt.")) rows = rows.filter((r) => r.created_at < lt);
      if (q.get("employer_id")) rows = rows.filter((r) => r.employer_id === eq(q.get("employer_id")));
      if (method === "GET") {
        rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
        return json(rows.slice(0, Number(q.get("limit") || 1000)));
      }
      if (method === "PATCH") {
        for (const r of rows) Object.assign(r, body);
        return json(null, 204);
      }
      if (method === "POST") {
        if (this.orders.has(body.razorpay_order_id)) return json({ code: "23505" }, 409);
        this.orders.set(body.razorpay_order_id, order({ ...body, id: `row-${this.orders.size + 1}` }));
        return json([this.orders.get(body.razorpay_order_id)], 201);
      }
    }

    if (table === "employer_unlock_payments") {
      if (method === "POST") {
        if (this.ledger.some((l) => l.razorpay_payment_id === body.razorpay_payment_id)) return json({ code: "23505" }, 409);
        const row: FakeLedger = { ...body, invoice_no: `HSX-2610-${String(++this.invoiceSeq).padStart(6, "0")}`, refunded_at: null };
        this.ledger.push(row);
        return json([row], 201);
      }
      const pid = eq(q.get("razorpay_payment_id"));
      let rows = this.ledger.filter((l) => !pid || l.razorpay_payment_id === pid);
      if (q.get("refunded_at") === "is.null") rows = rows.filter((l) => !l.refunded_at);
      if (method === "PATCH") { for (const r of rows) Object.assign(r, body); return json(null, 204); }
      return json(rows);
    }

    if (table === "requirement_matches") {
      const ids = inList(q.get("id")) ?? (eq(q.get("id")) ? [eq(q.get("id")) as string] : null);
      let rows = [...this.matches.values()].filter((m) => !ids || ids.includes(m.id));
      if (q.get("unlocked") === "eq.true") rows = rows.filter((m) => m.unlocked);
      const gte = q.get("unlocked_at");
      if (gte?.startsWith("gte.")) rows = rows.filter((m) => !!m.unlocked_at && m.unlocked_at >= gte.slice(4));
      if (method === "PATCH") { for (const r of rows) Object.assign(r, body); return json(null, 204); }
      return json(rows);
    }

    if (table === "employer_blocks") {
      const cids = inList(q.get("candidate_user_id")) ?? [];
      return json(cids.filter((c) => this.blockedCandidates.has(c)).map((candidate_user_id) => ({ candidate_user_id })));
    }
    return json({ message: `unhandled ${method} ${table}` }, 404);
  };
}

export interface FakeRzpPayment { id: string; status: string; amount: number; order_id: string; refund_status?: string | null }

export function fakeRazorpay(cfg: { orders?: Record<string, { amount: number; notes?: Record<string, unknown> }>; payments?: FakeRzpPayment[]; down?: boolean }) {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (cfg.down) throw new Error("razorpay unreachable");
    const path = url.split("api.razorpay.com/v1")[1] ?? "";
    let m = path.match(/^\/orders\/([^/]+)\/payments$/);
    if (m) return json({ items: (cfg.payments ?? []).filter((p) => p.order_id === m![1]) });
    m = path.match(/^\/orders\/([^/]+)$/);
    if (m) { const o = cfg.orders?.[m[1]]; return o ? json({ id: m[1], amount: o.amount, notes: o.notes ?? {} }) : json({}, 404); }
    m = path.match(/^\/payments\/([^/]+)$/);
    if (m) { const p = (cfg.payments ?? []).find((x) => x.id === m![1]); return p ? json(p) : json({}, 404); }
    return json({}, 404);
  };
}

/** Routes Supabase URLs to the fake DB and everything else to the Razorpay fake. */
export function combineFetch(db: FakeUnlockDb, rzp: ReturnType<typeof fakeRazorpay>): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => (db.handles(String(input)) ? db.fetch(input, init) : rzp(input))) as typeof fetch;
}
