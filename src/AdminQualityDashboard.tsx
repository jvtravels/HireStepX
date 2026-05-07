"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { c, font, radius, sp } from "./tokens";

const TOKEN_KEY = "hirestepx_admin_token";

interface Headline {
  focus: string;
  sessions_7d: number;
  avg_drift_7d: number;
  hallucination_rate_7d: number;
}

interface DailyRow {
  day: string;
  focus: string;
  sessions_analyzed: number;
  avg_score_drift: number;
  hallucination_rate: number;
  flagged_question_count: number;
  top_flags: { flag: string; count: number }[] | null;
}

interface InsightRow {
  session_id: string;
  user_id: string;
  focus: string;
  analyzer_version: string;
  analyzed_at: string;
  rescore: number | null;
  score_drift: number | null;
  flags: string[] | null;
  hallucinations: unknown;
  coaching_notes: string;
  error: string | null;
}

interface QualityData {
  headlines: Headline[];
  daily: DailyRow[];
  recent: InsightRow[];
  generated_at: string;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function fmtDrift(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}`;
}

function driftColor(drift: number): string {
  if (Math.abs(drift) < 3) return c.sage;
  if (Math.abs(drift) < 8) return c.gilt;
  return c.ember;
}

export default function AdminQualityDashboard() {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) {
      setError("Not logged in. Visit /admin first to sign in, then return here.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/admin-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
      });
      if (res.status === 401) {
        setError("Session expired. Sign in again at /admin.");
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError(`Server error: ${res.status}`);
        setLoading(false);
        return;
      }
      setData((await res.json()) as QualityData);
    } catch (e) {
      setError(`Network error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const dailyByFocus = useMemo(() => {
    if (!data) return new Map<string, DailyRow[]>();
    const m = new Map<string, DailyRow[]>();
    for (const row of data.daily) {
      const list = m.get(row.focus) || [];
      list.push(row);
      m.set(row.focus, list);
    }
    return m;
  }, [data]);

  return (
    <div style={{ minHeight: "100vh", background: c.obsidian, color: c.ivory, padding: sp["3xl"], fontFamily: font.ui }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp["3xl"] }}>
        <div>
          <a href="/admin" style={{ color: c.stone, fontSize: 12, textDecoration: "none", fontFamily: font.ui }}>← Back to admin</a>
          <h1 style={{ fontFamily: font.display, fontSize: 36, margin: 0, marginTop: sp.xs, color: c.gilt }}>Session Quality</h1>
          <p style={{ color: c.stone, margin: 0, marginTop: sp.xs }}>
            Per-focus drift + hallucinations from the nightly analyzer cron.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: "transparent", color: c.gilt, border: `1px solid ${c.gilt}`,
            padding: `${sp.sm}px ${sp.lg}px`, borderRadius: radius.md, fontFamily: font.ui,
            cursor: loading ? "wait" : "pointer", fontSize: 14,
          }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {error && (
        <div style={{ padding: sp.lg, background: "rgba(209,126,104,0.1)", border: `1px solid ${c.ember}`, borderRadius: radius.md, color: c.emberLight, marginBottom: sp["2xl"] }}>
          {error}
        </div>
      )}

      {!data && !error && loading && (
        <div style={{ color: c.stone }}>Loading quality data…</div>
      )}

      {data && (
        <>
          <section style={{ marginBottom: sp["3xl"] }}>
            <h2 style={{ fontSize: 18, color: c.chalk, fontWeight: 500, marginBottom: sp.lg }}>
              Last 7 days — by focus
            </h2>
            {data.headlines.length === 0 ? (
              <div style={{ color: c.stone, padding: sp.lg, background: c.graphite, borderRadius: radius.md }}>
                No analyzed sessions yet. The cron runs nightly at 03:00 IST.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: sp.lg }}>
                {data.headlines.map((h) => (
                  <div key={h.focus} style={{ padding: sp.lg, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.md }}>
                    <div style={{ color: c.gilt, fontSize: 13, fontWeight: 600, marginBottom: sp.sm, fontFamily: font.mono }}>{h.focus}</div>
                    <div style={{ color: c.stone, fontSize: 11, marginBottom: 2 }}>Sessions analyzed</div>
                    <div style={{ fontSize: 24, fontFamily: font.display, color: c.ivory, marginBottom: sp.sm }}>{h.sessions_7d}</div>
                    <div style={{ display: "flex", gap: sp.lg, marginTop: sp.sm }}>
                      <div>
                        <div style={{ color: c.stone, fontSize: 10 }}>Avg drift</div>
                        <div style={{ fontSize: 16, fontFamily: font.mono, color: driftColor(h.avg_drift_7d) }}>{fmtDrift(h.avg_drift_7d)}</div>
                      </div>
                      <div>
                        <div style={{ color: c.stone, fontSize: 10 }}>Halluc. rate</div>
                        <div style={{ fontSize: 16, fontFamily: font.mono, color: h.hallucination_rate_7d > 0.05 ? c.ember : c.sage }}>
                          {fmtPct(h.hallucination_rate_7d)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section style={{ marginBottom: sp["3xl"] }}>
            <h2 style={{ fontSize: 18, color: c.chalk, fontWeight: 500, marginBottom: sp.lg }}>Daily breakdown (30 days)</h2>
            {Array.from(dailyByFocus.entries()).map(([focus, rows]) => (
              <div key={focus} style={{ marginBottom: sp.xl }}>
                <div style={{ color: c.gilt, fontSize: 13, fontFamily: font.mono, marginBottom: sp.sm }}>{focus}</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 13, fontFamily: font.mono, minWidth: 720 }}>
                    <thead>
                      <tr style={{ color: c.stone, textAlign: "left" }}>
                        <th style={{ padding: sp.sm, fontWeight: 400 }}>Day</th>
                        <th style={{ padding: sp.sm, fontWeight: 400 }}>Sessions</th>
                        <th style={{ padding: sp.sm, fontWeight: 400 }}>Avg drift</th>
                        <th style={{ padding: sp.sm, fontWeight: 400 }}>Halluc. rate</th>
                        <th style={{ padding: sp.sm, fontWeight: 400 }}>Top flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={`${r.day}-${r.focus}`} style={{ borderTop: `1px solid ${c.border}`, color: c.chalk }}>
                          <td style={{ padding: sp.sm }}>{r.day}</td>
                          <td style={{ padding: sp.sm }}>{r.sessions_analyzed}</td>
                          <td style={{ padding: sp.sm, color: driftColor(r.avg_score_drift) }}>{fmtDrift(r.avg_score_drift)}</td>
                          <td style={{ padding: sp.sm, color: r.hallucination_rate > 0.05 ? c.ember : c.chalk }}>{fmtPct(r.hallucination_rate)}</td>
                          <td style={{ padding: sp.sm, color: c.stone }}>
                            {(r.top_flags || []).slice(0, 3).map((f) => `${f.flag} (${f.count})`).join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>

          <section>
            <h2 style={{ fontSize: 18, color: c.chalk, fontWeight: 500, marginBottom: sp.lg }}>Recent flagged sessions</h2>
            <div style={{ display: "grid", gap: sp.sm }}>
              {data.recent
                .filter((r) => (r.flags && r.flags.length > 0) || r.error)
                .slice(0, 25)
                .map((r) => (
                  <div key={r.session_id} style={{ padding: sp.md, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.sm, fontSize: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp.xs }}>
                      <code style={{ color: c.gilt, fontFamily: font.mono, fontSize: 12 }}>{r.session_id.slice(0, 16)}…</code>
                      <span style={{ color: c.stone, fontSize: 11 }}>{r.focus} · {new Date(r.analyzed_at).toLocaleString()}</span>
                    </div>
                    {r.error && (
                      <div style={{ color: c.ember, fontSize: 12, marginBottom: sp.xs }}>error: {r.error}</div>
                    )}
                    {r.flags && r.flags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: sp.xs, marginBottom: sp.xs }}>
                        {r.flags.map((f) => (
                          <span key={f} style={{ background: c.onyx, color: c.gilt, padding: `2px ${sp.sm}px`, borderRadius: radius.pill, fontSize: 11, fontFamily: font.mono }}>{f}</span>
                        ))}
                      </div>
                    )}
                    {r.coaching_notes && <div style={{ color: c.chalk, fontSize: 12 }}>{r.coaching_notes}</div>}
                  </div>
                ))}
              {data.recent.filter((r) => (r.flags && r.flags.length > 0) || r.error).length === 0 && (
                <div style={{ color: c.stone, padding: sp.lg }}>No flagged sessions in the last batch.</div>
              )}
            </div>
          </section>

          <p style={{ marginTop: sp["3xl"], color: c.stone, fontSize: 11 }}>
            Generated at {new Date(data.generated_at).toLocaleString()}.
          </p>
        </>
      )}
    </div>
  );
}
