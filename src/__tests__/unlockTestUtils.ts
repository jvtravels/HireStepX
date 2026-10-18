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
  updated_at?: string;
  refund_due_paise?: number | null;
}
export interface FakeMatch {
  id: string;
  requirement_id: string;
  candidate_user_id: string;
  unlocked: boolean;
  unlocked_at: string | null;
  unlocked_candidate_name: string | null;
  unlocked_candidate_email: string | null;
  candidate_response?: string | null;
  profiles: { name: string | null; email: string | null; employer_visibility: string | null } | null;
}
export interface FakeLedger {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  employer_id: string;
  amount: number;
  invoice_no: string | null;
  refunded_at: string | null;
  /** Migration 0045 columns. */
  invoice_snapshot?: unknown;
  partial_refund_paise?: number | null;
  partial_refund_at?: string | null;
  match_id?: string;
  match_ids?: string[];
  created_at?: string;
}
export interface FakeCreditNote { id: string; order_id: string; refund_id: string; amount_paise: number; credit_note_no: string; created_at: string }

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
  /** Employer billing identity served from `employers` (what the invoice snapshot freezes). */
  employers = new Map<string, { company_name: string; billing_name: string; gstin: string; suspended_at?: string | null }>();
  /** true = migration 0047 applied: employer_credit_notes + assign_employer_credit_note exist. */
  applied0047 = false;
  creditNotes: FakeCreditNote[] = [];
  creditNoteSeq = 0;
  /** true = migration 0045 applied: the invoice_no default is gone, assign_unlock_invoice_no exists and the
   *  snapshot / partial-refund columns exist. false = the pre-0045 schema, where the column default numbers
   *  every inserted row and the new columns / RPC answer like PostgREST does for unknown ones. */
  applied0045 = false;
  /** Sequence values handed out, so a test can assert none was burned. */
  invoiceSeq = 0;

  seed(o: { orders?: FakeOrder[]; matches?: FakeMatch[] }) {
    for (const x of o.orders ?? []) this.orders.set(x.razorpay_order_id, { ...x });
    for (const m of o.matches ?? []) this.matches.set(m.id, { ...m });
    return this;
  }

  private nextInvoiceNo() { return `HSX-2610-${String(++this.invoiceSeq).padStart(6, "0")}`; }

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
      const upd = q.get("updated_at");
      if (upd?.startsWith("gte.")) rows = rows.filter((r) => (r.updated_at ?? r.created_at) >= upd.slice(4));
      if (q.get("razorpay_payment_id") === "is.null") rows = rows.filter((r) => r.razorpay_payment_id == null);
      if (q.get("employer_id")) rows = rows.filter((r) => r.employer_id === eq(q.get("employer_id")));
      if (method === "GET") {
        const dir = q.get("order") === "created_at.desc" ? -1 : 1;
        rows.sort((a, b) => dir * a.created_at.localeCompare(b.created_at));
        return json(rows.slice(0, Number(q.get("limit") || 1000)));
      }
      if (method === "PATCH") {
        for (const r of rows) Object.assign(r, body);
        // return=representation answers with the rows the filter really matched (the CAS signal).
        if (String((init?.headers as Record<string, string> | undefined)?.Prefer ?? "").includes("return=representation")) return json(rows);
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
        const row: FakeLedger = { ...body, invoice_no: this.applied0045 ? null : this.nextInvoiceNo(), refunded_at: null };
        this.ledger.push(row);
        return json([row], 201);
      }
      const pid = eq(q.get("razorpay_payment_id"));
      let rows = this.ledger.filter((l) => !pid || l.razorpay_payment_id === pid);
      if (q.get("refunded_at") === "is.null") rows = rows.filter((l) => !l.refunded_at);
      if (q.get("invoice_no") === "is.null") rows = rows.filter((l) => !l.invoice_no);
      if (q.get("amount") === "gt.0") rows = rows.filter((l) => l.amount > 0);
      const lcreated = q.get("created_at");
      if (lcreated?.startsWith("gte.")) rows = rows.filter((l) => !l.created_at || l.created_at >= lcreated.slice(4));
      if (q.get("invoice_snapshot") === "is.null") rows = rows.filter((l) => l.invoice_snapshot == null);
      const or = q.get("or")?.match(/^\(partial_refund_paise\.is\.null,partial_refund_paise\.lt\.(\d+)\)$/);
      if (or) rows = rows.filter((l) => l.partial_refund_paise == null || l.partial_refund_paise < Number(or[1]));
      if (method === "PATCH") {
        const usesNewColumn = body && ("invoice_snapshot" in body || "partial_refund_paise" in body);
        if (usesNewColumn && !this.applied0045) return json({ code: "PGRST204", message: "Could not find the column in the schema cache" }, 400);
        for (const r of rows) Object.assign(r, body);
        return json(null, 204);
      }
      return json(rows);
    }

    if (table === "rpc/assign_unlock_invoice_no") {
      if (!this.applied0045) return json({ code: "PGRST202", message: "function not found" }, 404);
      const row = this.ledger.find((l) => l.razorpay_payment_id === body.p_payment_id && l.amount > 0);
      if (!row) return json(null);
      if (!row.invoice_no) row.invoice_no = this.nextInvoiceNo();
      return json(row.invoice_no);
    }

    if (table === "rpc/assign_employer_credit_note") {
      if (!this.applied0047) return json({ code: "PGRST202", message: "function not found" }, 404);
      const found = this.creditNotes.find((c) => c.refund_id === body.p_refund_id);
      if (found) return json(found.credit_note_no);
      const note: FakeCreditNote = {
        id: `cn-${this.creditNotes.length + 1}`, order_id: body.p_order_id, refund_id: body.p_refund_id, amount_paise: body.p_amount_paise,
        credit_note_no: `CN-2610-${String(++this.creditNoteSeq).padStart(6, "0")}`, created_at: new Date().toISOString(),
      };
      this.creditNotes.push(note);
      return json(note.credit_note_no);
    }

    if (table === "employer_credit_notes") {
      if (!this.applied0047) return json({ code: "42P01", message: "relation does not exist" }, 404);
      const ids = inList(q.get("order_id"));
      return json(this.creditNotes.filter((c) => !ids || ids.includes(c.order_id)));
    }

    if (table === "employers") {
      const id = eq(q.get("id"));
      const e = id ? this.employers.get(id) : undefined;
      return json(e ? [e] : []);
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

export interface FakeRzpPayment { id: string; status: string; amount: number; order_id: string; refund_status?: string | null; amount_refunded?: number; currency?: string }

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
