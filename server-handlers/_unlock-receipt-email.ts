/* Emailed receipt for a completed employer unlock purchase. Non-blocking and
 * best-effort: it runs only for the call that recorded the payment ledger row
 * (so once per payment), never throws, and a missing Resend key / address just
 * skips it. Until a supplier GSTIN is configured the email says plainly that it
 * is a receipt and not a GST tax invoice, matching the in-app document. */

import { slog } from "./_shared";
import { emailShell, title, para, b, dataCard, mono, button, escapeHtml } from "./_email-theme";

declare const process: { env: Record<string, string | undefined> };

export interface UnlockReceipt {
  employerId: string;
  orderId: string;
  paymentId: string;
  /** Cash charged, paise. */
  amountPaise: number;
  /** Credit applied to the order, paise. */
  creditPaise: number;
  candidates: number;
  invoiceNo: string | null;
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function hasSupplierGstin(): boolean {
  return (process.env.SUPPLIER_GSTIN || process.env.NEXT_PUBLIC_SUPPLIER_GSTIN || "").trim().length > 0;
}

export function buildReceiptEmail(r: UnlockReceipt, opts: { company: string | null; appUrl: string; taxInvoice: boolean }): { subject: string; html: string } {
  const doc = opts.taxInvoice ? "tax invoice" : "receipt";
  const rows: [string, string][] = [
    [opts.taxInvoice ? "Invoice" : "Receipt", mono(escapeHtml(r.invoiceNo ?? r.orderId))],
    ["Candidates unlocked", String(r.candidates)],
    ["Paid", mono(rupees(r.amountPaise))],
  ];
  if (r.creditPaise > 0) rows.push(["Account credit applied", mono(rupees(r.creditPaise))]);
  rows.push(["Payment ID", mono(escapeHtml(r.paymentId))]);
  const body =
    title("Contacts", { accentWord: "unlocked." }) +
    para(`${opts.company ? `Hi ${escapeHtml(opts.company)}, ` : ""}your payment went through and ${b(`${r.candidates} candidate contact${r.candidates === 1 ? "" : "s"}`)} ${r.candidates === 1 ? "is" : "are"} ready.`) +
    dataCard("Receipt", rows) +
    button("Open your requirements", `${opts.appUrl}/employer`) +
    para(
      opts.taxInvoice
        ? "Keep this email for your records. Download the full tax invoice from Settings, Billing history."
        : "This is a payment receipt, not a GST tax invoice. A GST tax invoice is issued once HireStepX's GSTIN is set up on the account; it will not carry GST input credit until then.",
      { small: true, muted: true },
    );
  return {
    subject: `${rupees(r.amountPaise)} received, ${doc} for your candidate unlock`,
    html: emailShell({ preview: `${r.candidates} candidate contact${r.candidates === 1 ? "" : "s"} unlocked.`, body }),
  };
}

async function lookupEmail(base: string, headers: Record<string, string>, employerId: string, f: typeof fetch): Promise<string | null> {
  try {
    const res = await f(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(employerId)}&select=email`, { headers });
    if (res.ok) {
      const rows = (await res.json().catch(() => [])) as Array<{ email?: string | null }>;
      const e = Array.isArray(rows) ? rows[0]?.email : null;
      if (e) return e;
    }
    const auth = await f(`${base}/auth/v1/admin/users/${encodeURIComponent(employerId)}`, { headers });
    if (auth.ok) {
      const u = (await auth.json().catch(() => null)) as { email?: string | null } | null;
      return u?.email ?? null;
    }
  } catch { /* fall through */ }
  return null;
}

async function lookupCompany(base: string, headers: Record<string, string>, employerId: string, f: typeof fetch): Promise<string | null> {
  try {
    const res = await f(`${base}/rest/v1/employers?id=eq.${encodeURIComponent(employerId)}&select=company_name`, { headers });
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => [])) as Array<{ company_name?: string | null }>;
    return (Array.isArray(rows) && rows[0]?.company_name) || null;
  } catch {
    return null;
  }
}

/** Sends the receipt. Resolves to true when Resend accepted it. Never throws. */
export async function sendUnlockReceiptEmail(p: {
  supabaseUrl: string;
  headers: Record<string, string>;
  receipt: UnlockReceipt;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const key = (process.env.RESEND_API_KEY || "").trim();
  if (!key) return false;
  const f = p.fetchImpl ?? fetch;
  try {
    const to = await lookupEmail(p.supabaseUrl, p.headers, p.receipt.employerId, f);
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return false;
    const company = await lookupCompany(p.supabaseUrl, p.headers, p.receipt.employerId, f);
    const appUrl = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");
    const { subject, html } = buildReceiptEmail(p.receipt, { company, appUrl, taxInvoice: hasSupplierGstin() });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8_000);
    try {
      const res = await f("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          // Resend dedupes within 24h, so a webhook/verify race can't double-send.
          "Idempotency-Key": `unlock-receipt-${p.receipt.paymentId}`,
        },
        signal: ac.signal,
        body: JSON.stringify({ from: process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>", to: [to], subject, html }),
      });
      if (!res.ok) {
        slog.error("unlock receipt email failed", { status: res.status, orderId: p.receipt.orderId });
        return false;
      }
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    slog.error("unlock receipt email threw", { orderId: p.receipt.orderId, err: err instanceof Error ? err.message : String(err) });
    return false;
  }
}
