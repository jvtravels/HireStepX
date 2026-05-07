"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { c, font, radius, sp } from "./tokens";

const TOKEN_KEY = "hirestepx_admin_token";

type SubView = "digest" | "headlines" | "issues" | "sessions" | "resolved";

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
  hallucinations: { turn_idx?: number; type?: string; evidence?: string; severity?: string }[] | null;
  rubric_gaps: { dimension?: string; expected?: string; observed?: string; severity?: string }[] | null;
  bad_questions: { turn_idx?: number; reason?: string; evidence?: string }[] | null;
  coaching_notes: string;
  severity: string;
  resolution_status: string;
  resolution_notes: string;
  resolved_at: string | null;
  resolved_by: string | null;
  error: string | null;
}

interface IssueRow {
  flag: string;
  count: number;
  open: number;
  resolved: number;
  sessions: string[];
  severity_high: number;
}

interface DigestRow {
  day: string;
  generated_at: string;
  model: string;
  fixes_summary: string;
  improvements_summary: string;
  patterns_summary: string;
  recommendations: string;
}

interface QualityData {
  headlines: Headline[];
  daily: DailyRow[];
  recent: InsightRow[];
  digest: DigestRow | null;
  issues: IssueRow[];
  generated_at: string;
}

function fmtPct(n: number): string { return `${(n * 100).toFixed(1)}%`; }
function fmtDrift(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
}
function driftColor(d: number | null): string {
  if (d === null) return c.stone;
  const a = Math.abs(d);
  if (a < 3) return c.sage;
  if (a < 8) return c.gilt;
  return c.ember;
}
function severityColor(s: string): string {
  if (s === "high") return c.ember;
  if (s === "medium") return c.gilt;
  return c.sage;
}
function statusColor(s: string): string {
  if (s === "resolved") return c.sage;
  if (s === "wont_fix") return c.stone;
  if (s === "acknowledged") return c.gilt;
  return c.ember;
}

/* Categorize a flag into a coarse type bucket. Drives the Issues sub-tab grouping. */
function flagCategory(flag: string): string {
  if (flag.startsWith("implausible_") || flag.includes("hallucinat") || flag.includes("fake_") || flag.includes("invented")) return "hallucination";
  if (flag === "duplicate_question" || flag === "leaked_answer") return "bad_question";
  if (flag === "analyzer_error" || flag === "empty_transcript") return "system";
  if (flag.startsWith("ai_accept") || flag.startsWith("ai_invent")) return "evaluator_drift";
  return "rubric_gap";
}

export function QualityContent({ showBackLink = false }: { showBackLink?: boolean }) {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<SubView>("digest");
  const [selectedSession, setSelectedSession] = useState<InsightRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) {
      setError("Not logged in. Sign in at /admin first.");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/admin-quality", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
      });
      if (res.status === 401) { setError("Session expired. Sign in again at /admin."); setLoading(false); return; }
      if (!res.ok) { setError(`Server error: ${res.status}`); setLoading(false); return; }
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

  const issuesByCategory = useMemo(() => {
    const map = new Map<string, IssueRow[]>();
    if (!data) return map;
    for (const issue of data.issues) {
      const cat = flagCategory(issue.flag);
      const list = map.get(cat) || [];
      list.push(issue);
      map.set(cat, list);
    }
    return map;
  }, [data]);

  const resolvedSessions = useMemo(() => {
    if (!data) return [];
    return data.recent
      .filter((r) => r.resolution_status === "resolved" || r.resolution_status === "wont_fix")
      .sort((a, b) => (b.resolved_at || "").localeCompare(a.resolved_at || ""))
      .slice(0, 50);
  }, [data]);

  const resolveSession = useCallback(async (sessionId: string, status: string, notes: string, by: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    const res = await fetch("/api/admin-quality-resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ session_id: sessionId, status, notes, by }),
    });
    if (res.ok) {
      // Optimistic local update; full refresh on next render anyway.
      setData((prev) => {
        if (!prev) return prev;
        const updated = prev.recent.map((r) =>
          r.session_id === sessionId
            ? { ...r, resolution_status: status, resolution_notes: notes, resolved_by: by, resolved_at: status === "open" ? null : new Date().toISOString() }
            : r,
        );
        return { ...prev, recent: updated };
      });
      setSelectedSession((prev) => prev && prev.session_id === sessionId ? { ...prev, resolution_status: status, resolution_notes: notes, resolved_by: by, resolved_at: status === "open" ? null : new Date().toISOString() } : prev);
    } else {
      alert(`Resolve failed: HTTP ${res.status}`);
    }
  }, []);

  const subTabs: { key: SubView; label: string; icon: string }[] = [
    { key: "digest", label: "Today's digest", icon: "🪄" },
    { key: "headlines", label: "Headlines", icon: "📊" },
    { key: "issues", label: "Issues", icon: "⚠️" },
    { key: "sessions", label: "Sessions", icon: "🗂️" },
    { key: "resolved", label: "Resolved log", icon: "✅" },
  ];

  return (
    <div style={{ color: c.ivory, fontFamily: font.ui }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp.xl }}>
        <div>
          {showBackLink && <a href="/admin" style={{ color: c.stone, fontSize: 12, textDecoration: "none", fontFamily: font.ui }}>← Back to admin</a>}
          <h1 style={{ fontFamily: font.display, fontSize: 32, margin: 0, marginTop: showBackLink ? sp.xs : 0, color: c.gilt }}>Session Quality</h1>
          <p style={{ color: c.stone, margin: 0, marginTop: sp.xs, fontSize: 13 }}>Categorized issues, resolutions, and the nightly AI digest.</p>
        </div>
        <button onClick={fetchData} disabled={loading} style={{ background: "transparent", color: c.gilt, border: `1px solid ${c.gilt}`, padding: `${sp.sm}px ${sp.lg}px`, borderRadius: radius.md, fontFamily: font.ui, cursor: loading ? "wait" : "pointer", fontSize: 13 }}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </header>

      {error && <div style={{ padding: sp.lg, background: "rgba(209,126,104,0.1)", border: `1px solid ${c.ember}`, borderRadius: radius.md, color: c.emberLight, marginBottom: sp.lg }}>{error}</div>}
      {!data && !error && loading && <div style={{ color: c.stone }}>Loading quality data…</div>}

      {data && (
        <>
          <div style={{ display: "flex", gap: sp.xs, marginBottom: sp.xl, borderBottom: `1px solid ${c.border}`, flexWrap: "wrap" }}>
            {subTabs.map((t) => (
              <button key={t.key} onClick={() => setView(t.key)} style={{
                background: "transparent",
                color: view === t.key ? c.gilt : c.stone,
                border: "none",
                borderBottom: `2px solid ${view === t.key ? c.gilt : "transparent"}`,
                padding: `${sp.sm}px ${sp.md}px`,
                fontFamily: font.ui,
                fontSize: 13,
                fontWeight: view === t.key ? 600 : 400,
                cursor: "pointer",
              }}>
                <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          {view === "digest" && <DigestView digest={data.digest} headlines={data.headlines} totals={{ analyzed: data.recent.length, open: data.recent.filter((r) => r.resolution_status === "open").length, resolved: data.recent.filter((r) => r.resolution_status === "resolved").length }} />}

          {view === "headlines" && <HeadlinesView headlines={data.headlines} dailyByFocus={dailyByFocus} />}

          {view === "issues" && <IssuesView issuesByCategory={issuesByCategory} recent={data.recent} onSelectSession={(sid) => { const s = data.recent.find((r) => r.session_id === sid); if (s) { setSelectedSession(s); setView("sessions"); } }} onRefresh={fetchData} />}

          {view === "sessions" && <SessionsView rows={data.recent} selected={selectedSession} setSelected={setSelectedSession} onResolve={resolveSession} />}

          {view === "resolved" && <ResolvedView rows={resolvedSessions} />}

          <p style={{ marginTop: sp["3xl"], color: c.stone, fontSize: 11 }}>Generated at {new Date(data.generated_at).toLocaleString()}.</p>
        </>
      )}
    </div>
  );
}

/* ─── Sub-views ─── */

function DigestView({ digest, headlines, totals }: {
  digest: DigestRow | null;
  headlines: Headline[];
  totals: { analyzed: number; open: number; resolved: number };
}) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: sp.md, marginBottom: sp.xl }}>
        <SummaryCard label="Sessions in panel" value={String(totals.analyzed)} color={c.gilt} />
        <SummaryCard label="Open issues" value={String(totals.open)} color={totals.open > 0 ? c.ember : c.sage} />
        <SummaryCard label="Resolved" value={String(totals.resolved)} color={c.sage} />
      </div>

      {!digest ? (
        <div style={{ padding: sp.xl, background: c.graphite, borderRadius: radius.md, color: c.stone }}>
          No digest yet. The cron generates one nightly at 03:00 IST after the analyzer runs.
        </div>
      ) : (
        <div style={{ background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.lg, padding: sp.xl }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp.lg }}>
            <h2 style={{ fontFamily: font.display, fontSize: 22, color: c.gilt, margin: 0 }}>Digest — {digest.day}</h2>
            <span style={{ color: c.stone, fontSize: 11, fontFamily: font.mono }}>{digest.model || "model unknown"}</span>
          </div>
          <DigestSection title="🔧 Fixes today" body={digest.fixes_summary} />
          <DigestSection title="📈 Improvements landed" body={digest.improvements_summary} />
          <DigestSection title="🔍 Patterns observed" body={digest.patterns_summary} />
          <DigestSection title="💡 Recommendations" body={digest.recommendations} />
        </div>
      )}

      <h3 style={{ fontSize: 14, color: c.chalk, marginTop: sp.xl, marginBottom: sp.sm }}>7-day rollup</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: sp.sm }}>
        {headlines.map((h) => (
          <div key={h.focus} style={{ padding: sp.md, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.md }}>
            <div style={{ color: c.gilt, fontSize: 12, fontWeight: 600, marginBottom: 4, fontFamily: font.mono }}>{h.focus}</div>
            <div style={{ fontSize: 22, fontFamily: font.display, color: c.ivory }}>{h.sessions_7d}</div>
            <div style={{ display: "flex", gap: sp.md, marginTop: sp.xs, fontSize: 11, fontFamily: font.mono }}>
              <span style={{ color: driftColor(h.avg_drift_7d) }}>drift {fmtDrift(h.avg_drift_7d)}</span>
              <span style={{ color: h.hallucination_rate_7d > 0.05 ? c.ember : c.sage }}>halluc {fmtPct(h.hallucination_rate_7d)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DigestSection({ title, body }: { title: string; body: string }) {
  if (!body) return null;
  return (
    <div style={{ marginBottom: sp.lg }}>
      <div style={{ color: c.chalk, fontSize: 13, fontWeight: 600, marginBottom: sp.xs }}>{title}</div>
      <p style={{ color: c.ivory, fontSize: 13, lineHeight: 1.55, margin: 0 }}>{body}</p>
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: sp.lg, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.md }}>
      <div style={{ color: c.stone, fontSize: 11, marginBottom: sp.xs }}>{label}</div>
      <div style={{ fontSize: 28, fontFamily: font.display, color }}>{value}</div>
    </div>
  );
}

function HeadlinesView({ headlines, dailyByFocus }: { headlines: Headline[]; dailyByFocus: Map<string, DailyRow[]> }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: sp.lg, marginBottom: sp["3xl"] }}>
        {headlines.length === 0 ? (
          <div style={{ color: c.stone, padding: sp.lg }}>No analyzed sessions in the last 7 days.</div>
        ) : headlines.map((h) => (
          <div key={h.focus} style={{ padding: sp.lg, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.md }}>
            <div style={{ color: c.gilt, fontSize: 13, fontWeight: 600, marginBottom: sp.sm, fontFamily: font.mono }}>{h.focus}</div>
            <div style={{ color: c.stone, fontSize: 11, marginBottom: 2 }}>Sessions analyzed</div>
            <div style={{ fontSize: 24, fontFamily: font.display, color: c.ivory, marginBottom: sp.sm }}>{h.sessions_7d}</div>
            <div style={{ display: "flex", gap: sp.lg }}>
              <div><div style={{ color: c.stone, fontSize: 10 }}>Avg drift</div><div style={{ fontSize: 16, fontFamily: font.mono, color: driftColor(h.avg_drift_7d) }}>{fmtDrift(h.avg_drift_7d)}</div></div>
              <div><div style={{ color: c.stone, fontSize: 10 }}>Halluc.</div><div style={{ fontSize: 16, fontFamily: font.mono, color: h.hallucination_rate_7d > 0.05 ? c.ember : c.sage }}>{fmtPct(h.hallucination_rate_7d)}</div></div>
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 14, color: c.chalk, marginBottom: sp.lg }}>Daily breakdown (30 days)</h3>
      {Array.from(dailyByFocus.entries()).map(([focus, rows]) => (
        <div key={focus} style={{ marginBottom: sp.xl }}>
          <div style={{ color: c.gilt, fontSize: 13, fontFamily: font.mono, marginBottom: sp.sm }}>{focus}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12, fontFamily: font.mono, minWidth: 720 }}>
              <thead>
                <tr style={{ color: c.stone, textAlign: "left" }}>
                  <th style={{ padding: sp.sm, fontWeight: 400 }}>Day</th>
                  <th style={{ padding: sp.sm, fontWeight: 400 }}>Sessions</th>
                  <th style={{ padding: sp.sm, fontWeight: 400 }}>Avg drift</th>
                  <th style={{ padding: sp.sm, fontWeight: 400 }}>Halluc.</th>
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
                    <td style={{ padding: sp.sm, color: c.stone }}>{(r.top_flags || []).slice(0, 3).map((f) => `${f.flag} (${f.count})`).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

interface FixPlanItem {
  priority: "high" | "medium" | "low";
  title: string;
  target_file: string;
  change: string;
  rationale: string;
  affected_flags: string[];
}
interface FixPlan {
  summary: string;
  items: FixPlanItem[];
  cautions: string[];
}

function IssuesView({ issuesByCategory, recent, onSelectSession, onRefresh }: {
  issuesByCategory: Map<string, IssueRow[]>;
  recent: InsightRow[];
  onSelectSession: (sessionId: string) => void;
  onRefresh: () => void;
}) {
  const [planLoading, setPlanLoading] = useState(false);
  const [plan, setPlan] = useState<FixPlan | null>(null);
  const [planMeta, setPlanMeta] = useState<{ model?: string; focus?: string | null } | null>(null);

  const allOpen = useMemo(() => recent.filter((r) => r.resolution_status === "open"), [recent]);

  const generateFixPlan = useCallback(async (focus?: string) => {
    setPlanLoading(true);
    setPlan(null);
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) { setPlanLoading(false); return; }
    try {
      const res = await fetch("/api/admin-quality-fix-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify(focus ? { focus } : {}),
      });
      if (!res.ok) {
        alert(`Fix plan failed: HTTP ${res.status}`);
        return;
      }
      const j = await res.json() as { plan: FixPlan; model?: string; input_summary?: { focus?: string | null } };
      setPlan(j.plan);
      setPlanMeta({ model: j.model, focus: j.input_summary?.focus });
    } catch (e) {
      alert(`Fix plan failed: ${(e as Error).message}`);
    } finally {
      setPlanLoading(false);
    }
  }, []);

  const bulkAcknowledge = useCallback(async (flag: string) => {
    // Find all open sessions that include this flag in their flag list.
    const targetIds = allOpen.filter((r) => (r.flags || []).includes(flag)).map((r) => r.session_id);
    if (targetIds.length === 0) return;
    if (!confirm(`Acknowledge ${targetIds.length} open sessions with flag "${flag}"?`)) return;
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    const res = await fetch("/api/admin-quality-resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ session_ids: targetIds, status: "acknowledged", notes: `Bulk-acknowledged from Issues view (flag: ${flag})`, by: "admin" }),
    });
    if (res.ok) {
      const j = await res.json() as { updated: number };
      alert(`Acknowledged ${j.updated} sessions.`);
      onRefresh();
    } else {
      alert(`Failed: HTTP ${res.status}`);
    }
  }, [allOpen, onRefresh]);

  if (issuesByCategory.size === 0) return <div style={{ color: c.stone, padding: sp.lg }}>No flagged issues yet.</div>;
  const order = ["hallucination", "evaluator_drift", "rubric_gap", "bad_question", "system"];
  const ordered = order.filter((k) => issuesByCategory.has(k));

  return (
    <div>
      {/* Fix-plan toolbar */}
      <div style={{ background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.md, padding: sp.lg, marginBottom: sp.xl }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: sp.sm }}>
          <div>
            <div style={{ fontSize: 14, color: c.chalk, fontWeight: 600 }}>Fix-plan generator</div>
            <div style={{ fontSize: 11, color: c.stone, marginTop: 2 }}>LLM proposes prioritized code changes targeting open issues. Recommendations only — you implement them.</div>
          </div>
          <button
            onClick={() => generateFixPlan()}
            disabled={planLoading}
            style={{ background: c.gilt, color: c.obsidian, border: "none", borderRadius: radius.md, padding: `${sp.sm}px ${sp.lg}px`, fontFamily: font.ui, fontSize: 13, fontWeight: 600, cursor: planLoading ? "wait" : "pointer" }}
          >
            {planLoading ? "Generating…" : "Generate fix plan"}
          </button>
        </div>

        {plan && (
          <div style={{ marginTop: sp.lg, paddingTop: sp.lg, borderTop: `1px solid ${c.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp.sm }}>
              <div style={{ fontSize: 13, color: c.gilt, fontWeight: 600 }}>Plan {planMeta?.focus ? `· ${planMeta.focus}` : "· all focuses"}</div>
              <div style={{ fontSize: 10, color: c.stone, fontFamily: font.mono }}>{planMeta?.model || ""}</div>
            </div>
            {plan.summary && <p style={{ color: c.ivory, fontSize: 13, lineHeight: 1.5, marginTop: 0 }}>{plan.summary}</p>}
            {plan.items.length > 0 && (
              <div style={{ display: "grid", gap: sp.sm, marginTop: sp.md }}>
                {plan.items.map((item, i) => (
                  <FixPlanCard key={i} item={item} />
                ))}
              </div>
            )}
            {plan.cautions.length > 0 && (
              <div style={{ marginTop: sp.lg, padding: sp.md, background: "rgba(212,179,127,0.06)", borderRadius: radius.sm, border: `1px solid ${c.border}` }}>
                <div style={{ fontSize: 11, color: c.gilt, fontWeight: 600, marginBottom: sp.xs }}>⚠ Cautions</div>
                <ul style={{ margin: 0, paddingLeft: sp.lg, color: c.chalk, fontSize: 12 }}>
                  {plan.cautions.map((cau, i) => <li key={i} style={{ marginBottom: 2 }}>{cau}</li>)}
                </ul>
              </div>
            )}
            <button onClick={() => setPlan(null)} style={{ background: "transparent", color: c.stone, border: "none", padding: 0, fontSize: 11, marginTop: sp.sm, cursor: "pointer", textDecoration: "underline" }}>Dismiss</button>
          </div>
        )}
      </div>

      {ordered.map((cat) => (
        <div key={cat} style={{ marginBottom: sp.xl }}>
          <div style={{ display: "flex", alignItems: "center", gap: sp.sm, marginBottom: sp.sm }}>
            <h3 style={{ fontSize: 14, color: c.chalk, margin: 0, textTransform: "capitalize" }}>{cat.replace(/_/g, " ")}</h3>
            <span style={{ color: c.stone, fontSize: 11 }}>{(issuesByCategory.get(cat) || []).length} flag types</span>
          </div>
          <div style={{ display: "grid", gap: sp.xs }}>
            {(issuesByCategory.get(cat) || []).map((issue) => (
              <div key={issue.flag} style={{ padding: sp.md, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.sm, display: "flex", alignItems: "center", gap: sp.lg, flexWrap: "wrap" }}>
                <span style={{ color: c.gilt, fontFamily: font.mono, fontSize: 12, flexShrink: 0 }}>{issue.flag}</span>
                <span style={{ fontSize: 12, color: c.chalk }}>×{issue.count}</span>
                {issue.severity_high > 0 && <span style={{ background: "rgba(209,126,104,0.15)", color: c.ember, padding: `2px ${sp.sm}px`, borderRadius: radius.pill, fontSize: 11, fontFamily: font.mono }}>{issue.severity_high} high</span>}
                <span style={{ color: c.stone, fontSize: 11 }}>open {issue.open} · resolved {issue.resolved}</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: sp.xs, flexWrap: "wrap", alignItems: "center" }}>
                  {issue.open > 0 && (
                    <button onClick={() => bulkAcknowledge(issue.flag)} style={{ background: "transparent", color: c.gilt, border: `1px solid ${c.gilt}`, borderRadius: radius.sm, padding: `2px ${sp.sm}px`, fontSize: 10, fontFamily: font.ui, cursor: "pointer" }}>
                      Ack {issue.open} open
                    </button>
                  )}
                  {issue.sessions.slice(0, 5).map((sid) => (
                    <button key={sid} onClick={() => onSelectSession(sid)} style={{ background: c.onyx, color: c.gilt, border: "none", borderRadius: radius.sm, padding: `2px ${sp.sm}px`, fontFamily: font.mono, fontSize: 10, cursor: "pointer" }}>
                      {sid.slice(0, 10)}…
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FixPlanCard({ item }: { item: FixPlanItem }) {
  const priorityColor = item.priority === "high" ? c.ember : item.priority === "medium" ? c.gilt : c.sage;
  return (
    <div style={{ padding: sp.md, background: c.onyx, borderLeft: `3px solid ${priorityColor}`, borderRadius: radius.sm }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: sp.xs, gap: sp.sm, flexWrap: "wrap" }}>
        <div style={{ color: c.ivory, fontSize: 13, fontWeight: 600 }}>{item.title}</div>
        <span style={{ color: priorityColor, fontSize: 10, fontFamily: font.mono, textTransform: "uppercase", letterSpacing: 0.5 }}>{item.priority}</span>
      </div>
      {item.target_file && (
        <div style={{ marginBottom: sp.xs }}>
          <code style={{ background: c.obsidian, color: c.gilt, padding: `2px 6px`, borderRadius: radius.sm, fontSize: 11, fontFamily: font.mono }}>{item.target_file}</code>
        </div>
      )}
      <div style={{ color: c.chalk, fontSize: 12, lineHeight: 1.5, marginBottom: sp.xs }}>{item.change}</div>
      {item.rationale && <div style={{ color: c.stone, fontSize: 11, fontStyle: "italic" }}>Why: {item.rationale}</div>}
      {item.affected_flags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: sp.xs }}>
          {item.affected_flags.map((f) => <span key={f} style={{ background: c.graphite, color: c.gilt, padding: `1px 6px`, borderRadius: radius.pill, fontSize: 10, fontFamily: font.mono }}>{f}</span>)}
        </div>
      )}
    </div>
  );
}

function SessionsView({ rows, selected, setSelected, onResolve }: {
  rows: InsightRow[];
  selected: InsightRow | null;
  setSelected: (r: InsightRow | null) => void;
  onResolve: (sessionId: string, status: string, notes: string, by: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    if (!filter) return rows;
    const q = filter.toLowerCase();
    return rows.filter((r) =>
      r.session_id.toLowerCase().includes(q) ||
      r.focus.toLowerCase().includes(q) ||
      (r.flags || []).some((f) => f.toLowerCase().includes(q)),
    );
  }, [rows, filter]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: sp.lg }}>
      <div>
        <input
          type="text"
          placeholder="Filter by session ID, focus, or flag…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: "100%", padding: sp.sm, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.sm, color: c.ivory, fontFamily: font.ui, fontSize: 13, marginBottom: sp.md }}
        />
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, fontFamily: font.mono, width: "100%" }}>
            <thead>
              <tr style={{ color: c.stone, textAlign: "left" }}>
                <th style={{ padding: sp.sm, fontWeight: 400 }}>Session</th>
                <th style={{ padding: sp.sm, fontWeight: 400 }}>Focus</th>
                <th style={{ padding: sp.sm, fontWeight: 400 }}>Sev</th>
                <th style={{ padding: sp.sm, fontWeight: 400 }}>Drift</th>
                <th style={{ padding: sp.sm, fontWeight: 400 }}>Flags</th>
                <th style={{ padding: sp.sm, fontWeight: 400 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.session_id} onClick={() => setSelected(r)} style={{ borderTop: `1px solid ${c.border}`, color: c.chalk, cursor: "pointer", background: selected?.session_id === r.session_id ? c.onyx : "transparent" }}>
                  <td style={{ padding: sp.sm }}><code style={{ color: c.gilt }}>{r.session_id.slice(0, 14)}…</code></td>
                  <td style={{ padding: sp.sm, color: c.chalk }}>{r.focus}</td>
                  <td style={{ padding: sp.sm, color: severityColor(r.severity), textTransform: "uppercase", fontWeight: 600, fontSize: 10 }}>{r.severity}</td>
                  <td style={{ padding: sp.sm, color: driftColor(r.score_drift) }}>{fmtDrift(r.score_drift)}</td>
                  <td style={{ padding: sp.sm, color: c.stone }}>{(r.flags || []).length}</td>
                  <td style={{ padding: sp.sm, color: statusColor(r.resolution_status), textTransform: "uppercase", fontSize: 10 }}>{r.resolution_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && <SessionDetail row={selected} onClose={() => setSelected(null)} onResolve={onResolve} />}
    </div>
  );
}

function SessionDetail({ row, onClose, onResolve }: {
  row: InsightRow;
  onClose: () => void;
  onResolve: (sessionId: string, status: string, notes: string, by: string) => void;
}) {
  const [notes, setNotes] = useState(row.resolution_notes || "");
  const [by, setBy] = useState(row.resolved_by || "");
  useEffect(() => { setNotes(row.resolution_notes || ""); setBy(row.resolved_by || ""); }, [row.session_id, row.resolution_notes, row.resolved_by]);

  return (
    <aside style={{ background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.md, padding: sp.lg, alignSelf: "start", position: "sticky", top: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp.sm }}>
        <code style={{ color: c.gilt, fontSize: 11, fontFamily: font.mono }}>{row.session_id}</code>
        <button onClick={onClose} style={{ background: "transparent", color: c.stone, border: "none", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
      <div style={{ color: c.stone, fontSize: 11, marginBottom: sp.lg }}>{row.focus} · {new Date(row.analyzed_at).toLocaleString()}</div>

      <div style={{ display: "flex", gap: sp.md, marginBottom: sp.lg, fontSize: 11, fontFamily: font.mono }}>
        <div><span style={{ color: c.stone }}>severity</span> <span style={{ color: severityColor(row.severity) }}>{row.severity.toUpperCase()}</span></div>
        <div><span style={{ color: c.stone }}>drift</span> <span style={{ color: driftColor(row.score_drift) }}>{fmtDrift(row.score_drift)}</span></div>
        <div><span style={{ color: c.stone }}>rescore</span> {row.rescore ?? "—"}</div>
      </div>

      {row.flags && row.flags.length > 0 && (
        <Section title="Flags">
          <div style={{ display: "flex", flexWrap: "wrap", gap: sp.xs }}>
            {row.flags.map((f) => <span key={f} style={{ background: c.onyx, color: c.gilt, padding: `2px ${sp.sm}px`, borderRadius: radius.pill, fontSize: 10, fontFamily: font.mono }}>{f}</span>)}
          </div>
        </Section>
      )}

      {row.hallucinations && row.hallucinations.length > 0 && (
        <Section title="Hallucinations">
          {row.hallucinations.map((h, i) => (
            <div key={i} style={{ padding: sp.sm, background: "rgba(209,126,104,0.08)", borderRadius: radius.sm, marginBottom: sp.xs, fontSize: 11 }}>
              <div style={{ color: c.ember, fontFamily: font.mono, marginBottom: 2 }}>{h.type}</div>
              <div style={{ color: c.chalk }}>{h.evidence}</div>
            </div>
          ))}
        </Section>
      )}

      {row.rubric_gaps && row.rubric_gaps.length > 0 && (
        <Section title="Rubric gaps">
          {row.rubric_gaps.map((g, i) => (
            <div key={i} style={{ padding: sp.sm, background: c.onyx, borderRadius: radius.sm, marginBottom: sp.xs, fontSize: 11 }}>
              <div style={{ color: c.gilt, fontFamily: font.mono }}>{g.dimension}</div>
              <div style={{ color: c.stone, fontSize: 10 }}>expected: {g.expected}</div>
              <div style={{ color: c.chalk }}>observed: {g.observed}</div>
            </div>
          ))}
        </Section>
      )}

      {row.bad_questions && row.bad_questions.length > 0 && (
        <Section title="Bad questions">
          {row.bad_questions.map((q, i) => (
            <div key={i} style={{ padding: sp.sm, background: c.onyx, borderRadius: radius.sm, marginBottom: sp.xs, fontSize: 11 }}>
              <div style={{ color: c.gilt, fontFamily: font.mono }}>{q.reason}</div>
              <div style={{ color: c.chalk }}>{(q.evidence || "").slice(0, 200)}</div>
            </div>
          ))}
        </Section>
      )}

      {row.coaching_notes && (
        <Section title="Coaching notes">
          <div style={{ color: c.chalk, fontSize: 12, lineHeight: 1.5 }}>{row.coaching_notes}</div>
        </Section>
      )}

      <Section title="Resolution">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (what's the fix? linked commit?)"
          rows={3}
          style={{ width: "100%", background: c.obsidian, border: `1px solid ${c.border}`, color: c.ivory, padding: sp.sm, borderRadius: radius.sm, fontFamily: font.ui, fontSize: 12, resize: "vertical" }}
        />
        <input
          value={by}
          onChange={(e) => setBy(e.target.value)}
          placeholder="Your name / email"
          style={{ width: "100%", background: c.obsidian, border: `1px solid ${c.border}`, color: c.ivory, padding: sp.sm, borderRadius: radius.sm, fontFamily: font.ui, fontSize: 12, marginTop: sp.xs }}
        />
        <div style={{ display: "flex", gap: sp.xs, marginTop: sp.sm, flexWrap: "wrap" }}>
          <ResolveButton label="Acknowledge" color={c.gilt} onClick={() => onResolve(row.session_id, "acknowledged", notes, by)} />
          <ResolveButton label="Resolve" color={c.sage} onClick={() => onResolve(row.session_id, "resolved", notes, by)} />
          <ResolveButton label="Won't fix" color={c.stone} onClick={() => onResolve(row.session_id, "wont_fix", notes, by)} />
          <ResolveButton label="Reopen" color={c.ember} onClick={() => onResolve(row.session_id, "open", notes, by)} />
        </div>
        {row.resolved_at && <div style={{ color: c.stone, fontSize: 10, marginTop: sp.xs }}>Last action: {row.resolution_status} by {row.resolved_by || "—"} at {new Date(row.resolved_at).toLocaleString()}</div>}
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: sp.lg }}>
      <div style={{ color: c.chalk, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: sp.xs }}>{title}</div>
      {children}
    </div>
  );
}

function ResolveButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: "transparent", color, border: `1px solid ${color}`, padding: `4px ${sp.sm}px`, borderRadius: radius.sm, fontSize: 11, fontFamily: font.ui, cursor: "pointer" }}>{label}</button>
  );
}

function ResolvedView({ rows }: { rows: InsightRow[] }) {
  if (rows.length === 0) return <div style={{ color: c.stone, padding: sp.lg }}>No sessions resolved yet.</div>;
  return (
    <div style={{ display: "grid", gap: sp.sm }}>
      {rows.map((r) => (
        <div key={r.session_id} style={{ padding: sp.md, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.sm, fontSize: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp.xs }}>
            <code style={{ color: c.gilt, fontFamily: font.mono, fontSize: 11 }}>{r.session_id.slice(0, 18)}…</code>
            <span style={{ color: statusColor(r.resolution_status), fontFamily: font.mono, fontSize: 10, textTransform: "uppercase" }}>{r.resolution_status}</span>
          </div>
          <div style={{ color: c.stone, fontSize: 11, marginBottom: sp.xs }}>{r.focus} · {r.resolved_by || "unknown"} · {r.resolved_at ? new Date(r.resolved_at).toLocaleString() : "—"}</div>
          {r.resolution_notes && <div style={{ color: c.chalk, fontSize: 12 }}>{r.resolution_notes}</div>}
        </div>
      ))}
    </div>
  );
}

export default function AdminQualityDashboard() {
  return (
    <div style={{ minHeight: "100vh", background: c.obsidian, padding: sp["3xl"] }}>
      <QualityContent showBackLink />
    </div>
  );
}
