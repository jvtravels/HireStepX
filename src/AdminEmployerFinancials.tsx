"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { c, radius } from "./tokens";
import type { EmployerFinancials } from "../server-handlers/_admin-employer-financials";

interface Props {
  getToken: () => string | null;
  setToken: (token: string) => void;
}

const card: CSSProperties = { background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.lg, padding: "20px 24px", marginBottom: 24 };
const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 };
const stat: CSSProperties = { background: c.obsidian, border: `1px solid ${c.border}`, borderRadius: radius.lg, padding: "12px 16px", minWidth: 150 };
const label: CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: c.stone, margin: "0 0 6px" };
const big: CSSProperties = { fontSize: 22, fontWeight: 700, color: c.ivory, margin: 0 };
const note: CSSProperties = { margin: "4px 0 0", fontSize: 11, color: c.stone };
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th: CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: c.stone, borderBottom: `1px solid ${c.border}` };
const td: CSSProperties = { padding: "8px 12px", color: c.chalk, borderBottom: `1px solid ${c.borderSubtle}` };
const bars: CSSProperties = { display: "flex", alignItems: "flex-end", gap: 3, height: 80, marginBottom: 6 };
const barCol: CSSProperties = { flex: 1, display: "flex", alignItems: "flex-end", height: "100%" };
const heading: CSSProperties = { ...label, marginBottom: 12 };
const labelSpaced: CSSProperties = { ...label, marginTop: 16 };

const barStyle = (pct: number): CSSProperties => ({ width: "100%", height: `${Math.max(2, pct)}%`, background: c.sage, borderRadius: "3px 3px 0 0", opacity: 0.85 });
const banner = (bad: boolean): CSSProperties => ({ margin: "0 0 16px", padding: "10px 14px", fontSize: 13, borderRadius: radius.lg, border: `1px solid ${bad ? c.ember : c.border}`, color: bad ? c.ember : c.chalk, background: c.obsidian });
const warnStyle = (bad: boolean): CSSProperties => ({ ...big, color: bad ? c.ember : c.ivory });

function inr(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function AdminEmployerFinancials({ getToken, setToken }: Props) {
  const [data, setData] = useState<EmployerFinancials | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const token = getToken();
        if (token) headers["x-admin-token"] = token;
        const res = await fetch("/api/admin-data", { method: "POST", headers, credentials: "include", body: JSON.stringify({ section: "employer-financials" }) });
        if (!res.ok) throw new Error(String(res.status));
        const d = (await res.json()) as EmployerFinancials & { _token?: string };
        if (cancelled) return;
        if (d._token) setToken(d._token);
        setData(d);
      } catch {
        if (!cancelled) setError("Could not load employer financials.");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div style={card}><p style={note}>{error}</p></div>;
  if (!data) return <div style={card}><p style={note}>Loading employer financials…</p></div>;

  const { revenue, orders, stuckOrders, refundDue, credit, topEmployers } = data;
  // Older cached payloads predate these fields.
  const readErrors = data.readErrors ?? [];
  const truncatedSources = data.truncatedSources ?? [];
  const maxDay = Math.max(...revenue.byDay.map((d) => d.paise), 1);
  const statusEntries = Object.entries(orders.byStatus).sort((a, b) => b[1] - a[1]);

  return (
    <div style={card}>
      <p style={heading}>Employers — pay-as-you-go unlocks</p>
      {readErrors.length > 0 && (
        <p role="alert" style={banner(true)}>
          Could not read: {readErrors.join(", ")}. The figures below are incomplete, not zero. Reload, and check Supabase status if this persists.
        </p>
      )}
      {truncatedSources.length > 0 && (
        <p role="status" style={banner(false)}>
          Row cap reached for {truncatedSources.join(", ")}. Totals may undercount; move these sums to a SQL aggregate.
        </p>
      )}
      <div style={row}>
        <div style={stat}>
          <p style={label}>Revenue (lifetime)</p>
          <p style={big}>{inr(revenue.lifetimePaise)}</p>
          <p style={note}>{revenue.paymentCount} paid unlocks · {inr(revenue.refundedPaise)} refunded</p>
        </div>
        <div style={stat}>
          <p style={label}>Last 30 days</p>
          <p style={big}>{inr(revenue.last30dPaise)}</p>
        </div>
        <div style={stat}>
          <p style={label}>Stuck orders &gt;1h</p>
          <p style={warnStyle(stuckOrders.count > 0)}>{stuckOrders.count}</p>
          <p style={note}>created / failed / paid, unfulfilled</p>
        </div>
        <div style={stat}>
          <p style={label}>Refunds due</p>
          <p style={warnStyle(refundDue.count > 0)}>{refundDue.tracked ? inr(refundDue.totalPaise) : "n/a"}</p>
          <p style={note}>{refundDue.tracked ? `${refundDue.count} orders` : "refund_due_paise column not migrated yet"}</p>
        </div>
        <div style={stat}>
          <p style={label}>Credit outstanding</p>
          <p style={big}>{credit.ledgerAvailable ? inr(credit.outstandingPaise) : "n/a"}</p>
          <p style={note}>{credit.ledgerAvailable ? `${inr(credit.grantedPaise)} granted · ${inr(credit.spentPaise)} spent` : "ledger not migrated yet"}</p>
        </div>
      </div>

      <p style={label}>Revenue per day (IST, last 30d)</p>
      <div style={bars}>
        {revenue.byDay.map((d) => (
          <div key={d.date} style={barCol} title={`${d.date}: ${inr(d.paise)} (${d.count})`}>
            <div style={barStyle((d.paise / maxDay) * 100)} />
          </div>
        ))}
      </div>

      <p style={labelSpaced}>Orders by status ({orders.total})</p>
      <p style={note}>{statusEntries.length ? statusEntries.map(([s, n]) => `${s}: ${n}`).join(" · ") : "No orders yet"}</p>

      {topEmployers.length > 0 && (
        <>
          <p style={labelSpaced}>Top employers by spend</p>
          <table style={table}>
            <thead><tr><th style={th}>Company</th><th style={th}>Unlocks paid</th><th style={th}>Spend</th></tr></thead>
            <tbody>
              {topEmployers.map((t) => (
                <tr key={t.employerId}><td style={td}>{t.companyName}</td><td style={td}>{t.payments}</td><td style={td}>{inr(t.spendPaise)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {stuckOrders.rows.length > 0 && (
        <>
          <p style={labelSpaced}>Stuck orders</p>
          <table style={table}>
            <thead><tr><th style={th}>Order</th><th style={th}>Status</th><th style={th}>Age</th><th style={th}>Amount</th><th style={th}>Payment captured</th></tr></thead>
            <tbody>
              {stuckOrders.rows.map((o) => (
                <tr key={o.orderId}><td style={td}>{o.orderId}</td><td style={td}>{o.status}</td><td style={td}>{o.ageHours}h</td><td style={td}>{inr(o.amountPaise)}</td><td style={td}>{o.hasPayment ? "yes" : "no"}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
