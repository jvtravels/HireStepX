"use client";
import { useState } from "react";
import type { CSSProperties } from "react";
import { c, font } from "./tokens";
import { tokens as T } from "./auth/_tokens";
import { EmptyState } from "./components/EmptyState";
import { Button } from "./components/ui/button";
import {
  type CostData, type CostWindow, MiniBarChart, bigNum, card, exportCsv, formatDateTime, formatNum,
  labelStyle, statCard, tableStyle, tdStyle, thStyle,
} from "./adminShared";

const BANNER: CSSProperties = { borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 12 };
const BANNER_WARN: CSSProperties = { ...BANNER, background: "rgba(180,83,9,0.08)", border: "1px solid rgba(180,83,9,0.25)", color: c.ember };
const BANNER_SPIKE: CSSProperties = { ...BANNER, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.25)", color: "rgb(220,38,38)" };
const BANNER_NEUTRAL: CSSProperties = { ...BANNER, background: "rgba(14,12,8,0.04)", border: "1px solid rgba(14,12,8,0.1)", color: c.stone };

const CARD_GAP: CSSProperties = { ...card, marginBottom: 24 };
const CARD_FLUSH: CSSProperties = { ...card, marginBottom: 24, padding: 0, overflow: "auto" };
const CARD_FLUSH_LAST: CSSProperties = { ...card, padding: 0, overflow: "auto" };
const CARD_HALF: CSSProperties = { ...card, flex: 1, minWidth: 280 };
const PAD_HEAD: CSSProperties = { padding: "16px 24px 6px" };
const LIST_HEAD: CSSProperties = { padding: "16px 24px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" };
const NOTE: CSSProperties = { margin: "4px 0 0", fontSize: 11, color: c.stone };
const NOTE_FOOT: CSSProperties = { margin: 0, padding: "10px 24px 14px", fontSize: 11, color: c.stone };
const NOTE_BELOW: CSSProperties = { margin: "10px 0 0", fontSize: 11, color: c.stone };
const NOTE_PAGE: CSSProperties = { marginTop: 16, fontSize: 11, color: c.stone };
const NO_DATA: CSSProperties = { color: c.stone, fontSize: 13 };

const LABEL_12: CSSProperties = { ...labelStyle, marginBottom: 12 };
const LABEL_16: CSSProperties = { ...labelStyle, marginBottom: 16 };

const STAT_ROW: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 };
const SPLIT_ROW: CSSProperties = { display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" };
const AXIS_ROW: CSSProperties = { display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: c.stone };

const TD_12: CSSProperties = { ...tdStyle, fontSize: 12 };
const TD_LABEL: CSSProperties = { ...tdStyle, fontSize: 12, fontWeight: 600 };
const TD_MONO: CSSProperties = { ...tdStyle, fontFamily: font.mono };
const TD_MONO_SM: CSSProperties = { ...TD_MONO, fontSize: 11 };
const TD_MONO_BOLD: CSSProperties = { ...TD_MONO, fontWeight: 700 };
const TD_MONO_INDIGO: CSSProperties = { ...TD_MONO, color: T.indigo };
const TD_MONO_INDIGO_BOLD: CSSProperties = { ...TD_MONO, color: T.indigo, fontWeight: 700 };
const TD_VIEW: CSSProperties = { ...tdStyle, color: T.indigo, fontSize: 11 };
const tdMono = (color: string, bold = false): CSSProperties => (bold ? { ...TD_MONO_BOLD, color } : { ...TD_MONO, color });

const ROW_CLICK: CSSProperties = { cursor: "pointer", transition: "background 120ms" };
const USER_NAME: CSSProperties = { fontWeight: 600 };
const USER_EMAIL: CSSProperties = { color: c.stone, fontSize: 10 };

const RECON_LIST: CSSProperties = { marginBottom: 14 };
const RECON_ROW: CSSProperties = { display: "flex", alignItems: "center", gap: 12, padding: "6px 0", borderBottom: "1px solid rgba(14,12,8,0.06)", fontSize: 12 };
const RECON_MONTH: CSSProperties = { width: 70, color: c.ivory };
const RECON_MUTED: CSSProperties = { color: c.stone };
const RECON_NOTE: CSSProperties = { color: c.stone, fontStyle: "italic" };
const RECON_EMPTY: CSSProperties = { fontSize: 12, color: c.stone, marginBottom: 14 };
const FORM_ROW: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" };
const INPUT: CSSProperties = { background: T.white, color: T.coal, border: "1px solid rgba(14,12,8,0.18)", borderRadius: 6, padding: "7px 10px", fontSize: 13, fontFamily: font.ui };
const INPUT_AMOUNT: CSSProperties = { ...INPUT, width: 140 };
const INPUT_NOTE: CSSProperties = { ...INPUT, flex: 1, minWidth: 140 };
const LOG_BTN: CSSProperties = { background: "rgba(21,128,61,0.12)", color: T.successInk, border: "1px solid rgba(21,128,61,0.3)" };
const EXPORT_BTN: CSSProperties = { fontSize: 11, color: T.indigo, background: "none", border: "none", padding: "2px 6px" };
const MONO: CSSProperties = { fontFamily: font.mono };

const wowStyle = (color: string): CSSProperties => ({ fontSize: 11, color, marginLeft: 6 });
const bigNumColor = (color: string): CSSProperties => ({ ...bigNum, color });
const rateBanner = (stale: boolean): CSSProperties =>
  stale ? BANNER_WARN : BANNER_NEUTRAL;
const varianceStyle = (pct: number): CSSProperties => ({ color: Math.abs(pct) > 20 ? c.ember : c.sage, fontWeight: 600 });
const statusStyle = (ok: boolean): CSSProperties => ({ marginTop: 8, fontSize: 12, color: ok ? c.sage : c.ember });

const focusLabel = (f: string) => f.replace(/-/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());

const hoverOn = (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.background = "rgba(180,83,9,0.06)"; };
const hoverOff = (e: { currentTarget: HTMLElement }) => { e.currentTarget.style.background = "transparent"; };

interface AdminCostTabProps {
  costData: CostData | null;
  monthRevenueInr: number;
  fetchSection: (section: string, extra?: Record<string, unknown>, skipCache?: boolean) => Promise<unknown>;
  onCostData: (d: CostData) => void;
  onOpenUser: (userId: string) => void;
  onOpenSession: (sessionId: string) => void;
}

export default function AdminCostTab({ costData, monthRevenueInr, fetchSection, onCostData, onOpenUser, onOpenSession }: AdminCostTabProps) {
  const [recMonth, setRecMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [recAmount, setRecAmount] = useState("");
  const [recNote, setRecNote] = useState("");
  const [recBusy, setRecBusy] = useState(false);
  const [recStatus, setRecStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!costData) return <EmptyState title="No cost data available" />;
  const cd = costData;

  // Revenue per session is a rough proxy: this month's revenue over 30d saved sessions.
  const paidRevPerSession = (monthRevenueInr > 0 && cd.totalSessions30d > 0)
    ? Math.round((monthRevenueInr / cd.totalSessions30d) * 100) / 100
    : null;
  const grossMarginPerSession = paidRevPerSession != null
    ? Math.round((paidRevPerSession - cd.avgCostPerSession) * 100) / 100
    : null;

  const wowBadge = cd.wowDeltaPct != null
    ? (cd.wowDeltaPct > 0
        ? <span style={wowStyle(c.ember)}>▲ {cd.wowDeltaPct}% WoW</span>
        : <span style={wowStyle(c.sage)}>▼ {Math.abs(cd.wowDeltaPct)}% WoW</span>)
    : null;

  const logInvoice = async () => {
    const amount = parseFloat(recAmount);
    if (!recMonth || isNaN(amount) || amount < 0) {
      setRecStatus({ ok: false, msg: "Enter a month and a non-negative amount." });
      return;
    }
    setRecBusy(true);
    setRecStatus(null);
    try {
      const res = await fetchSection("save-cost-reconciliation", { month: recMonth, actualInvoiceInr: amount, note: recNote || undefined }, true);
      const r = res as { ok?: boolean; error?: string } | null;
      if (r?.ok) {
        setRecStatus({ ok: true, msg: "Saved." });
        setRecNote("");
        const fresh = await fetchSection("costs", undefined, true) as CostData | null;
        if (fresh) onCostData(fresh);
      } else {
        setRecStatus({ ok: false, msg: r?.error ?? "Save failed" });
      }
    } catch (err) {
      setRecStatus({ ok: false, msg: String(err) });
    } finally {
      setRecBusy(false);
    }
  };

  return (
    <div>
      {cd.attributedLlmPct < 70 && (
        <div style={BANNER_WARN}>
          Only {cd.attributedLlmPct}% of LLM spend is tagged to a session. The other ₹{cd.unattributedLlmInr.toFixed(2)} (resume analysis,
          question generation, interview-time calls) is still counted in every total on this tab, but not in the per-session LLM figure.
        </div>
      )}

      {cd.isCostSpike && (
        <div style={BANNER_SPIKE}>
          🚨 Cost spike today: ₹{cd.todayCostInr.toFixed(2)} vs ₹{cd.dailyAvgInr.toFixed(2)} daily avg (30d, all-in). Verify for anomalous session volume or runaway prompts.
        </div>
      )}

      <div style={CARD_FLUSH}>
        <div style={PAD_HEAD}>
          <p style={labelStyle}>Cost Breakdown · all-in (LLM + TTS + STT)</p>
          <p style={NOTE}>
            Today = IST calendar day ({cd.today.date}). Per session = total spend / saved sessions, so spend on abandoned or unsaved sessions is included.
          </p>
        </div>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Window</th>
              <th style={thStyle}>Sessions</th>
              <th style={thStyle}>LLM ₹</th>
              <th style={thStyle}>TTS ₹</th>
              <th style={thStyle}>STT ₹</th>
              <th style={thStyle}>Total ₹</th>
              <th style={thStyle}>₹ / session</th>
            </tr>
          </thead>
          <tbody>
            {([["Today", cd.today], ["Last 7 days", cd.last7d], ["Last 30 days", cd.last30d]] as Array<[string, CostWindow]>).map(([label, w]) => (
              <tr key={label}>
                <td style={TD_LABEL}>{label}</td>
                <td style={TD_MONO}>{w.sessions}</td>
                <td style={TD_MONO}>₹{w.llmInr.toFixed(2)}</td>
                <td style={TD_MONO}>₹{w.ttsInr.toFixed(2)}</td>
                <td style={TD_MONO}>₹{w.sttInr.toFixed(2)}</td>
                <td style={TD_MONO_INDIGO_BOLD}>₹{w.totalInr.toFixed(2)}</td>
                <td style={TD_MONO_BOLD}>{w.sessions > 0 ? `₹${w.perSessionInr.toFixed(2)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={NOTE_FOOT}>
          STT history starts 2026-10-12 and TTS logging 2026-09-22, so the 30-day per-session figure is understated.
          Cartesia and Azure characters are priced at the Sarvam rate (upper bound). STT is calls × an assumed 1.8 min average, not metered minutes.
        </p>
      </div>

      <div style={STAT_ROW}>
        <div style={statCard}>
          <p style={labelStyle}>Today (IST)</p>
          <p style={bigNum}>₹{cd.today.totalInr.toFixed(2)}</p>
          <p style={NOTE}>Daily avg (30d) ₹{cd.dailyAvgInr.toFixed(2)}{wowBadge}</p>
        </div>
        <div style={statCard}>
          <p style={labelStyle}>All-in Cost / Session (7d)</p>
          <p style={bigNum}>₹{cd.last7d.perSessionInr.toFixed(2)}</p>
          <p style={NOTE}>
            LLM + voice · {cd.last7d.sessions} sessions · this week ₹{cd.thisWeekInr.toFixed(2)} · prior ₹{cd.lastWeekInr.toFixed(2)}
          </p>
        </div>
        <div style={statCard}>
          <p style={labelStyle}>Most Expensive Session (LLM)</p>
          <p style={bigNumColor(cd.highestSessionCostInr > 2 ? c.ember : T.indigo)}>₹{cd.highestSessionCostInr.toFixed(3)}</p>
          <p style={NOTE}>{cd.attributedLlmPct}% of LLM spend is tagged to a session</p>
        </div>
        {grossMarginPerSession != null && (
          <div style={statCard}>
            <p style={labelStyle}>Gross Margin / Session</p>
            <p style={bigNumColor(grossMarginPerSession >= 0 ? c.sage : c.ember)}>
              {grossMarginPerSession >= 0 ? "+" : ""}₹{grossMarginPerSession.toFixed(2)}
            </p>
            <p style={NOTE}>
              Revenue ₹{paidRevPerSession!.toFixed(2)} − cost ₹{cd.avgCostPerSession.toFixed(2)} (30d, all-in)
            </p>
          </div>
        )}
      </div>

      <div style={rateBanner(cd.rateCardIsStale)}>
        {cd.rateCardIsStale ? "⚠️ " : ""}Rate card last verified <strong>{cd.ratesLastVerifiedAt}</strong> ({cd.rateCardAgeDays} days ago)
        {cd.rateCardIsStale && " — overdue for a recheck against current Groq/Sarvam/Deepgram pricing"}. LLM is priced per model from provider-reported tokens; all figures on this tab are
        modeled from <code style={MONO}>DEFAULT_COST_RATES</code>, not real invoices — log an actual month below to check them.
      </div>

      <div style={CARD_GAP}>
        <p style={LABEL_12}>Actual Invoice vs. Modeled Estimate</p>
        {cd.costReconciliations.length > 0 ? (
          <div style={RECON_LIST}>
            {cd.costReconciliations.map(r => (
              <div key={r.month} style={RECON_ROW}>
                <span style={RECON_MONTH}>{r.month}</span>
                <span style={RECON_MUTED}>Modeled ₹{r.modeledInr.toFixed(2)}</span>
                <span style={RECON_MUTED}>Actual ₹{r.actualInvoiceInr.toFixed(2)}</span>
                {r.variancePct != null && (
                  <span style={varianceStyle(r.variancePct)}>
                    {r.variancePct > 0 ? "+" : ""}{r.variancePct}%
                  </span>
                )}
                {r.note && <span style={RECON_NOTE}>{r.note}</span>}
              </div>
            ))}
          </div>
        ) : (
          <p style={RECON_EMPTY}>No invoice totals logged yet — the modeled figures above have never been checked against a real bill.</p>
        )}
        <div style={FORM_ROW}>
          <input
            type="month"
            value={recMonth}
            onChange={(e) => setRecMonth(e.target.value)}
            disabled={recBusy}
            style={INPUT}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={recAmount}
            onChange={(e) => setRecAmount(e.target.value)}
            disabled={recBusy}
            placeholder="actual invoice ₹"
            style={INPUT_AMOUNT}
          />
          <input
            type="text"
            value={recNote}
            onChange={(e) => setRecNote(e.target.value)}
            disabled={recBusy}
            placeholder="note (optional)"
            maxLength={500}
            style={INPUT_NOTE}
          />
          <Button variant="outline" disabled={recBusy} onClick={logInvoice} style={LOG_BTN}>
            Log invoice
          </Button>
        </div>
        {recStatus && <p style={statusStyle(recStatus.ok)}>{recStatus.msg}</p>}
      </div>

      <div style={CARD_GAP}>
        <p style={LABEL_12}>All-in Cost / Day — ₹ (30d, IST)</p>
        <MiniBarChart data={cd.perDay} color={T.copper} height={100} />
        <div style={AXIS_ROW}>
          <span>{Object.keys(cd.perDay)[0]}</span>
          <span>Today</span>
        </div>
      </div>

      <div style={SPLIT_ROW}>
        <div style={CARD_HALF}>
          <p style={LABEL_16}>Cost by Interview Focus (30d)</p>
          {Object.keys(cd.byFocus).length === 0
            ? <p style={NO_DATA}>No data yet</p>
            : <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Focus</th>
                    <th style={thStyle}>Sessions</th>
                    <th style={thStyle}>Total ₹</th>
                    <th style={thStyle}>Avg ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cd.byFocus).sort(([, a], [, b]) => b.totalInr - a.totalInr).map(([focus, d]) => (
                    <tr key={focus}>
                      <td style={TD_12}>{focusLabel(focus)}</td>
                      <td style={TD_MONO}>{d.sessions}</td>
                      <td style={TD_MONO_INDIGO}>₹{d.totalInr.toFixed(2)}</td>
                      <td style={tdMono(d.avgInr > 1 ? c.ember : c.sage)}>₹{d.avgInr.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>

        <div style={CARD_HALF}>
          <p style={LABEL_16}>LLM Cost by API Endpoint (30d)</p>
          {Object.keys(cd.byEndpoint).length === 0
            ? <p style={NO_DATA}>No data yet</p>
            : <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Endpoint</th>
                    <th style={thStyle}>Calls</th>
                    <th style={thStyle}>Tokens</th>
                    <th style={thStyle}>Est. ₹</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(cd.byEndpoint).sort(([, a], [, b]) => b.estimatedInr - a.estimatedInr).map(([ep, d]) => (
                    <tr key={ep}>
                      <td style={TD_MONO_SM}>{ep}</td>
                      <td style={TD_MONO}>{d.calls}</td>
                      <td style={TD_MONO}>{formatNum(d.tokens)}</td>
                      <td style={TD_MONO_INDIGO}>₹{d.estimatedInr.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </div>
      </div>

      <div style={CARD_GAP}>
        <p style={LABEL_16}>LLM Cost by Endpoint and Model (30d · today)</p>
        {Object.keys(cd.byModel).length === 0
          ? <p style={NO_DATA}>No data yet</p>
          : <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Endpoint · model</th>
                  <th style={thStyle}>Calls</th>
                  <th style={thStyle}>Failed</th>
                  <th style={thStyle}>Tokens</th>
                  <th style={thStyle}>30d ₹</th>
                  <th style={thStyle}>Today ₹</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(cd.byModel).sort(([, a], [, b]) => b.estimatedInr - a.estimatedInr).map(([k, d]) => (
                  <tr key={k}>
                    <td style={TD_MONO_SM}>{k}</td>
                    <td style={TD_MONO}>{d.calls}</td>
                    <td style={tdMono(d.failed > 0 ? c.ember : "inherit")}>{d.failed}</td>
                    <td style={TD_MONO}>{formatNum(d.tokens)}</td>
                    <td style={TD_MONO_INDIGO}>₹{d.estimatedInr.toFixed(2)}</td>
                    <td style={TD_MONO}>₹{(cd.byModelToday[k]?.estimatedInr ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
        <p style={NOTE_BELOW}>
          Failed or timed-out calls log 0 tokens and are priced at ₹0. Provider free tiers (e.g. Gemini) may make real spend lower than list price.
        </p>
      </div>

      {cd.topUsersByCost.length > 0 && (
        <div style={CARD_GAP}>
          <p style={LABEL_16}>Top 5 Users by Spend (30d, LLM + voice)</p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Sessions</th>
                <th style={thStyle}>LLM ₹</th>
                <th style={thStyle}>Voice ₹</th>
                <th style={thStyle}>Total ₹</th>
                <th style={thStyle}>₹ / session</th>
              </tr>
            </thead>
            <tbody>
              {cd.topUsersByCost.map((u) => (
                <tr
                  key={u.userId}
                  onClick={() => onOpenUser(u.userId)}
                  style={ROW_CLICK}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                >
                  <td style={TD_12}>
                    <div style={USER_NAME}>{u.name}</div>
                    <div style={USER_EMAIL}>{u.email}</div>
                  </td>
                  <td style={TD_MONO}>{u.sessions}</td>
                  <td style={TD_MONO}>₹{u.totalLlmInr.toFixed(2)}</td>
                  <td style={TD_MONO}>₹{u.voiceInr.toFixed(2)}</td>
                  <td style={TD_MONO_INDIGO_BOLD}>₹{u.totalInr.toFixed(2)}</td>
                  <td style={tdMono(u.avgInr > 1 ? c.ember : "inherit")}>₹{u.avgInr.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cd.topExpensiveSessions.length > 0 && (
        <div style={CARD_FLUSH_LAST}>
          <div style={LIST_HEAD}>
            <p style={labelStyle}>Top 30 Most Expensive Sessions (30d, LLM only)</p>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => exportCsv("expensive-sessions.csv", cd.topExpensiveSessions)}
              style={EXPORT_BTN}
            >
              Export CSV
            </Button>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Session ID</th>
                <th style={thStyle}>Focus</th>
                <th style={thStyle}>Score</th>
                <th style={thStyle}>Duration</th>
                <th style={thStyle}>Prompt tok</th>
                <th style={thStyle}>Compl tok</th>
                <th style={thStyle}>Cost ₹</th>
                <th style={thStyle}>Date</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {cd.topExpensiveSessions.map((s, i) => (
                <tr
                  key={i}
                  onClick={() => onOpenSession(s.id)}
                  style={ROW_CLICK}
                  onMouseEnter={hoverOn}
                  onMouseLeave={hoverOff}
                >
                  <td style={TD_MONO_SM}>{s.id.slice(0, 8)}…</td>
                  <td style={TD_12}>{focusLabel(s.focus)}</td>
                  <td style={tdMono(s.score >= 65 ? c.sage : s.score >= 40 ? T.copper : c.ember)}>{s.score}</td>
                  <td style={TD_MONO}>{s.duration ? `${Math.round(s.duration / 60)}m` : "—"}</td>
                  <td style={TD_MONO}>{formatNum(s.promptTokens)}</td>
                  <td style={TD_MONO}>{formatNum(s.completionTokens)}</td>
                  <td style={tdMono(s.llmCostInr > 1.5 ? c.ember : T.indigo, true)}>
                    ₹{s.llmCostInr.toFixed(3)}
                  </td>
                  <td style={TD_12}>{formatDateTime(s.date)}</td>
                  <td style={TD_VIEW}>View →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={NOTE_PAGE}>
        LLM costs: list-rate estimates (Groq GPT-OSS 20B $0.075/M input + $0.30/M output; 120B $0.15/M + $0.60/M · 1 USD = ₹84).
        Voice costs (TTS/STT) are aggregate rate-card estimates with no per-session breakdown.
        Reconcile against actual Groq/Azure/Deepgram invoices before any pricing decision.
      </p>
    </div>
  );
}
