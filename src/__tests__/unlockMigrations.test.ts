import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* The SQL here has no live-database test; these guards pin the invariants that the TS code relies on and
 * keep the migration files and supabase-schema.sql from drifting apart. */
const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");
const schema = read("supabase-schema.sql");

describe("0052 credit refund per order", () => {
  const sql = read("supabase-migrations/0052-credit-refund-per-order.sql");

  it("creates the per-order index before dropping the per-match one, idempotently", () => {
    const created = sql.indexOf("create unique index if not exists uq_employer_credit_refund_match_order");
    const dropped = sql.indexOf("drop index if exists public.uq_employer_credit_refund_match;");
    expect(created).toBeGreaterThanOrEqual(0);
    expect(dropped).toBeGreaterThan(created);
    expect(sql).toContain("(match_id, order_ref) where kind = 'refund'");
  });

  it("is mirrored in the schema, which no longer defines the per-match index", () => {
    expect(schema).toContain("uq_employer_credit_refund_match_order");
    expect(schema).not.toMatch(/create unique index if not exists uq_employer_credit_refund_match\s/);
  });
});

describe("0053 gap-free invoice numbers", () => {
  const sql = read("supabase-migrations/0053-invoice-no-gapless.sql");

  it("locks the payment row before it touches the counter, and draws from a per-year counter", () => {
    expect(sql.indexOf("for update")).toBeGreaterThan(0);
    expect(sql.indexOf("for update")).toBeLessThan(sql.indexOf("insert into public.employer_invoice_counters"));
    expect(sql).toContain("on conflict (fy) do update set last_no");
    expect(sql).not.toMatch(/nextval\(/);
  });

  it("keeps the HSX-YYMM-NNNNNN shape and the IST month", () => {
    expect(sql).toContain("'HSX-' || to_char(v_ist, 'YYMM')");
    expect(sql).toContain("Asia/Kolkata");
  });

  it("numbers credit-only purchases and nothing else without cash", () => {
    expect(sql).toContain("amount > 0 or razorpay_payment_id like 'credit\\_pay\\_%'");
  });

  it("is mirrored in the schema", () => {
    expect(schema).toContain("employer_invoice_counters");
    expect(schema).toContain("razorpay_payment_id like 'credit\\_pay\\_%'");
  });
});

describe("0053 seed query is cast-safe", () => {
  const sql = read("supabase-migrations/0053-invoice-no-gapless.sql");
  it.each([["migration", sql], ["schema", schema]])("guards the casts with a shape check in the %s", (_n, text) => {
    expect(text).toContain("case when invoice_no ~ '^HSX-[0-9]{4}-[0-9]+$' then");
    expect(text).not.toMatch(/where invoice_no ~ '\^HSX-\[0-9\]\{4\}-\[0-9\]\+\$'\s+and substring/);
  });
});

describe("0054 unlock money guards", () => {
  const sql = read("supabase-migrations/0054-unlock-money-guards.sql");
  const section = schema.slice(schema.indexOf("-- 0054: money guards"));

  it("claims every match of an open order, one claim per match", () => {
    expect(sql).toContain("match_id uuid primary key");
    expect(sql).toContain("trg_sync_unlock_match_claims");
    expect(sql).toContain("after insert or update of status, match_ids");
    expect(sql).toContain("errcode = '23505'");
  });

  it("is fail-open for status changes and releases claims for closed orders", () => {
    expect(sql).toContain("when others then");
    expect(sql).toContain("new.status not in ('created', 'paid')");
    expect(sql).toContain("interval '30 minutes'");
  });

  it("draws credit-note numbers from a per-FY counter with a distinct prefix", () => {
    expect(sql).toContain("employer_credit_note_counters");
    expect(sql).toContain("on conflict (fy) do update set last_no");
    expect(sql).toContain("'HCN-'");
    expect(sql).toContain("Asia/Kolkata");
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('credit_note:'");
    expect(sql).not.toMatch(/nextval\(/);
  });

  it("makes invoice_no unique and stops an employer delete cascading into invoices", () => {
    expect(sql).toContain("uq_employer_unlock_payments_invoice_no");
    expect(sql).toContain("where invoice_no is not null");
    expect(sql).toContain("on delete restrict");
  });

  it("is mirrored in the schema", () => {
    for (const needle of [
      "employer_unlock_match_claims",
      "trg_sync_unlock_match_claims",
      "employer_credit_note_counters",
      "'HCN-'",
      "uq_employer_unlock_payments_invoice_no",
      "on delete restrict not valid",
    ]) {
      expect(section).toContain(needle);
    }
  });
});
