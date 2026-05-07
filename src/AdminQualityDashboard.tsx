"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { c, font, radius, sp } from "./tokens";
import { friendlyFlag, friendlyFocus, friendlySeverity, friendlyStatus, CATEGORY_LABEL, type FriendlyFlag } from "./qualityFlagDictionary";

const TOKEN_KEY = "hirestepx_admin_token";

type SubView = "digest" | "headlines" | "issues" | "sessions" | "resolved" | "revisions";

interface Revision {
  id: string;
  focus: string;
  description: string;
  commit_sha: string;
  deployed_at: string;
  deployed_by: string;
  outcome: FixOutcome | null;
}

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
  fix_outcome: FixOutcome | null;
  error: string | null;
}

interface FixOutcome {
  verdict?: "verified" | "partial" | "no_change" | "regressed" | "insufficient_data";
  before_rate?: number;
  after_rate?: number;
  delta?: number;
  primary_flag?: string;
  computed_at?: string;
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
  revisions: Revision[];
  recommendations: Recommendation[];
  generated_at: string;
}

interface Recommendation {
  id: string;
  priority: "high" | "medium" | "low" | string;
  title: string;
  target_file: string;
  change_description: string;
  rationale: string;
  affected_flags: string[] | null;
  affected_focus: string;
  file_grounded: boolean;
  status: "pending" | "in_progress" | "done" | "dismissed" | string;
  status_notes: string;
  status_updated_at: string | null;
  status_updated_by: string;
  first_seen_at: string;
  last_seen_at: string;
  seen_count: number;
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

function outcomeBadge(o: FixOutcome | null | undefined): { label: string; color: string; tooltip: string } | null {
  if (!o || !o.verdict) return null;
  const before = (o.before_rate || 0) * 100;
  const after = (o.after_rate || 0) * 100;
  const arrow = (o.delta || 0) > 0 ? "↘" : (o.delta || 0) < 0 ? "↗" : "→";
  const trend = `${before.toFixed(1)}% ${arrow} ${after.toFixed(1)}%`;
  switch (o.verdict) {
    case "verified": return { label: `Fix verified · ${trend}`, color: c.sage, tooltip: `Flag rate dropped meaningfully after this fix.` };
    case "partial":  return { label: `Partial fix · ${trend}`, color: c.gilt, tooltip: `Flag rate dropped but didn't fall below half of pre-fix.` };
    case "no_change": return { label: `No change · ${trend}`, color: c.stone, tooltip: `Flag rate did not move after the fix.` };
    case "regressed": return { label: `Regressed · ${trend}`, color: c.ember, tooltip: `Flag rate INCREASED after this 'fix' — investigate.` };
    case "insufficient_data": return { label: `Awaiting data`, color: c.stone, tooltip: `Not enough sessions yet to measure outcome.` };
  }
  return null;
}

/* Categorize a flag using the friendly dictionary. Drives Issues sub-tab grouping. */
function flagCategory(flag: string): FriendlyFlag["category"] {
  return friendlyFlag(flag).category;
}

/** Bucket a row by the day it was analyzed (YYYY-MM-DD, local time). */
function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

/** Date-range filter for a list of rows by analyzed_at. */
function withinRange(iso: string, range: "today" | "7d" | "30d" | "all"): boolean {
  if (range === "all") return true;
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return true;
  const now = Date.now();
  const day = 86400_000;
  if (range === "today") return ts >= now - day;
  if (range === "7d") return ts >= now - 7 * day;
  if (range === "30d") return ts >= now - 30 * day;
  return true;
}

type DateRange = "today" | "7d" | "30d" | "all";

export function QualityContent({ showBackLink = false }: { showBackLink?: boolean }) {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<SubView>("digest");
  const [selectedSession, setSelectedSession] = useState<InsightRow | null>(null);
  const [runNowState, setRunNowState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [runNowResult, setRunNowResult] = useState<{ scanned?: number; written?: number; digest?: string; duration_ms?: number; error?: string } | null>(null);

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

  const runQualityCheckNow = useCallback(async () => {
    setRunNowState("running");
    setRunNowResult(null);
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) { setRunNowState("error"); setRunNowResult({ error: "Not signed in" }); return; }
    try {
      const res = await fetch("/api/admin-quality-run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
      });
      const j = await res.json() as { ok?: boolean; cron_response?: { scanned?: number; written?: number; digest?: string; duration_ms?: number }; error?: string; details?: string };
      if (!res.ok || !j.ok) {
        setRunNowState("error");
        setRunNowResult({ error: j.error || j.details || `HTTP ${res.status}` });
        return;
      }
      setRunNowResult({
        scanned: j.cron_response?.scanned,
        written: j.cron_response?.written,
        digest: j.cron_response?.digest,
        duration_ms: j.cron_response?.duration_ms,
      });
      setRunNowState("done");
      // Refresh dashboard data after a successful run.
      fetchData();
    } catch (e) {
      setRunNowState("error");
      setRunNowResult({ error: (e as Error).message });
    }
  }, [fetchData]);

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
    { key: "revisions", label: "Prompt revisions", icon: "🔬" },
  ];

  return (
    <div style={{ color: c.ivory, fontFamily: font.ui }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp.xl }}>
        <div>
          {showBackLink && <a href="/admin" style={{ color: c.stone, fontSize: 12, textDecoration: "none", fontFamily: font.ui }}>← Back to admin</a>}
          <h1 style={{ fontFamily: font.display, fontSize: 32, margin: 0, marginTop: showBackLink ? sp.xs : 0, color: c.gilt }}>Session Quality</h1>
          <p style={{ color: c.stone, margin: 0, marginTop: sp.xs, fontSize: 13 }}>Categorized issues, resolutions, and the nightly AI digest.</p>
        </div>
        <div style={{ display: "flex", gap: sp.sm, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={runQualityCheckNow}
            disabled={runNowState === "running"}
            title="Re-runs the analyzer over today's sessions and regenerates the AI digest. Same code path as the nightly cron — usually 5-15 seconds."
            style={{ background: c.gilt, color: c.obsidian, border: "none", padding: `${sp.sm}px ${sp.lg}px`, borderRadius: radius.md, fontFamily: font.ui, cursor: runNowState === "running" ? "wait" : "pointer", fontSize: 13, fontWeight: 600 }}
          >
            {runNowState === "running" ? "Running…" : "Run quality check now"}
          </button>
          <button onClick={fetchData} disabled={loading} style={{ background: "transparent", color: c.gilt, border: `1px solid ${c.gilt}`, padding: `${sp.sm}px ${sp.lg}px`, borderRadius: radius.md, fontFamily: font.ui, cursor: loading ? "wait" : "pointer", fontSize: 13 }}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </header>

      {runNowState !== "idle" && runNowResult && (
        <div style={{ marginBottom: sp.lg, padding: sp.md, borderRadius: radius.md, background: runNowState === "error" ? "rgba(209,126,104,0.1)" : "rgba(122,158,126,0.1)", border: `1px solid ${runNowState === "error" ? c.ember : c.sage}`, fontSize: 13 }}>
          {runNowState === "running" && <span style={{ color: c.gilt }}>Running quality check… this re-analyzes today's sessions and regenerates the digest.</span>}
          {runNowState === "done" && (
            <span style={{ color: c.sage }}>
              ✓ Done in {((runNowResult.duration_ms || 0) / 1000).toFixed(1)}s · scanned {runNowResult.scanned ?? 0} · wrote {runNowResult.written ?? 0} insights · digest {runNowResult.digest || "skipped"}
            </span>
          )}
          {runNowState === "error" && <span style={{ color: c.ember }}>✗ Failed: {runNowResult.error}</span>}
        </div>
      )}

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

          {view === "digest" && <DigestView digest={data.digest} headlines={data.headlines} totals={{ analyzed: data.recent.length, open: data.recent.filter((r) => r.resolution_status === "open").length, resolved: data.recent.filter((r) => r.resolution_status === "resolved").length }} recommendations={data.recommendations || []} onRefresh={fetchData} />}

          {view === "headlines" && <HeadlinesView headlines={data.headlines} dailyByFocus={dailyByFocus} />}

          {view === "issues" && <IssuesView issuesByCategory={issuesByCategory} recent={data.recent} onSelectSession={(sid) => { const s = data.recent.find((r) => r.session_id === sid); if (s) { setSelectedSession(s); setView("sessions"); } }} onRefresh={fetchData} />}

          {view === "sessions" && <SessionsView rows={data.recent} selected={selectedSession} setSelected={setSelectedSession} onResolve={resolveSession} />}

          {view === "resolved" && <ResolvedView rows={resolvedSessions} />}

          {view === "revisions" && <RevisionsView revisions={data.revisions || []} onRefresh={fetchData} />}

          <p style={{ marginTop: sp["3xl"], color: c.stone, fontSize: 11 }}>Generated at {new Date(data.generated_at).toLocaleString()}.</p>
        </>
      )}
    </div>
  );
}

/* ─── Sub-views ─── */

function DigestView({ digest, headlines, totals, recommendations, onRefresh }: {
  digest: DigestRow | null;
  headlines: Headline[];
  totals: { analyzed: number; open: number; resolved: number };
  recommendations: Recommendation[];
  onRefresh: () => void;
}) {
  const pendingRecs = recommendations.filter((r) => r.status === "pending" || r.status === "in_progress");
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: sp.md, marginBottom: sp.xl }}>
        <SummaryCard label="Sessions in panel" value={String(totals.analyzed)} color={c.gilt} />
        <SummaryCard label="Open issues" value={String(totals.open)} color={totals.open > 0 ? c.ember : c.sage} />
        <SummaryCard label="Resolved" value={String(totals.resolved)} color={c.sage} />
      </div>

      <RecommendationsPanel pending={pendingRecs} onRefresh={onRefresh} />


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
            <div style={{ color: c.gilt, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{friendlyFocus(h.focus)}</div>
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

function RecommendationsPanel({ pending, onRefresh }: { pending: Recommendation[]; onRefresh: () => void }) {
  const updateStatus = useCallback(async (id: string, status: string, notes = "") => {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    const res = await fetch("/api/admin-quality-recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ id, status, notes, by: "admin" }),
    });
    if (res.ok) onRefresh();
    else alert(`Update failed: HTTP ${res.status}`);
  }, [onRefresh]);

  if (pending.length === 0) {
    return (
      <div style={{ background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.md, padding: sp.lg, marginBottom: sp.xl }}>
        <div style={{ color: c.chalk, fontSize: 13, fontWeight: 600 }}>What to fix</div>
        <div style={{ color: c.stone, fontSize: 12, marginTop: sp.xs }}>
          No open recommendations. The cron generates fresh ones nightly when there are open issues to address.
        </div>
      </div>
    );
  }

  const ordered = [...pending].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 } as Record<string, number>;
    const pa = order[a.priority] ?? 1;
    const pb = order[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return b.last_seen_at.localeCompare(a.last_seen_at);
  });

  return (
    <div style={{ background: c.graphite, border: `1px solid ${c.gilt}`, borderRadius: radius.md, padding: sp.lg, marginBottom: sp.xl }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp.sm }}>
        <div>
          <div style={{ color: c.gilt, fontSize: 14, fontWeight: 600 }}>What to fix · {ordered.length} pending</div>
          <div style={{ color: c.stone, fontSize: 11, marginTop: 2 }}>Auto-generated nightly. Review, mark in-progress when you start, or dismiss if not relevant.</div>
        </div>
      </div>

      <div style={{ display: "grid", gap: sp.sm, marginTop: sp.md }}>
        {ordered.slice(0, 8).map((r) => {
          const priorityColor = r.priority === "high" ? c.ember : r.priority === "medium" ? c.gilt : c.sage;
          return (
            <div key={r.id} style={{ padding: sp.md, background: c.onyx, borderLeft: `3px solid ${priorityColor}`, borderRadius: radius.sm }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: sp.sm, marginBottom: sp.xs }}>
                <div style={{ color: c.ivory, fontSize: 13, fontWeight: 600 }}>{r.title}</div>
                <div style={{ display: "flex", gap: sp.sm, alignItems: "center" }}>
                  {r.status === "in_progress" && <span style={{ color: c.gilt, fontSize: 10, fontFamily: font.mono, textTransform: "uppercase" }}>In progress</span>}
                  <span style={{ color: priorityColor, fontSize: 10, fontFamily: font.mono, textTransform: "uppercase", letterSpacing: 0.5 }}>{r.priority}</span>
                  {r.seen_count > 1 && <span style={{ color: c.stone, fontSize: 10 }} title={`Recommended ${r.seen_count} times`}>×{r.seen_count}</span>}
                </div>
              </div>
              {r.target_file && (
                <div style={{ marginBottom: sp.xs, display: "flex", gap: sp.xs, alignItems: "center", flexWrap: "wrap" }}>
                  <code style={{ background: c.obsidian, color: c.gilt, padding: `1px 6px`, borderRadius: radius.sm, fontSize: 11, fontFamily: font.mono }}>{r.target_file}</code>
                  {!r.file_grounded && <span style={{ background: "rgba(209,126,104,0.15)", color: c.ember, padding: `1px ${sp.sm}px`, borderRadius: radius.pill, fontSize: 10 }}>⚠ unverified path</span>}
                </div>
              )}
              <div style={{ color: c.chalk, fontSize: 12, lineHeight: 1.5, marginBottom: sp.xs }}>{r.change_description}</div>
              {r.rationale && <div style={{ color: c.stone, fontSize: 11, fontStyle: "italic", marginBottom: sp.xs }}>Why: {r.rationale}</div>}
              {(r.affected_flags || []).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: sp.xs }}>
                  {(r.affected_flags || []).slice(0, 5).map((f) => <span key={f} style={{ background: c.graphite, color: c.gilt, padding: `1px 6px`, borderRadius: radius.pill, fontSize: 10, fontFamily: font.mono }}>{f}</span>)}
                </div>
              )}
              <div style={{ display: "flex", gap: sp.xs, marginTop: sp.sm, flexWrap: "wrap" }}>
                {r.status !== "in_progress" && <button onClick={() => updateStatus(r.id, "in_progress")} style={{ background: "transparent", color: c.gilt, border: `1px solid ${c.gilt}`, padding: `2px ${sp.sm}px`, borderRadius: radius.sm, fontSize: 11, fontFamily: font.ui, cursor: "pointer" }}>Mark in progress</button>}
                <button onClick={() => updateStatus(r.id, "done")} style={{ background: "transparent", color: c.sage, border: `1px solid ${c.sage}`, padding: `2px ${sp.sm}px`, borderRadius: radius.sm, fontSize: 11, fontFamily: font.ui, cursor: "pointer" }}>Mark done</button>
                <button onClick={() => updateStatus(r.id, "dismissed")} style={{ background: "transparent", color: c.stone, border: `1px solid ${c.stone}`, padding: `2px ${sp.sm}px`, borderRadius: radius.sm, fontSize: 11, fontFamily: font.ui, cursor: "pointer" }}>Dismiss</button>
              </div>
            </div>
          );
        })}
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
            <div style={{ color: c.gilt, fontSize: 13, fontWeight: 600, marginBottom: sp.sm }}>{friendlyFocus(h.focus)}</div>
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
          <div style={{ color: c.gilt, fontSize: 13, fontWeight: 600, marginBottom: sp.sm }}>{friendlyFocus(focus)}</div>
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
  file_grounded?: boolean;
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

  if (issuesByCategory.size === 0) return <div style={{ color: c.stone, padding: sp.lg }}>No issues found yet.</div>;
  const order: FriendlyFlag["category"][] = ["ai_made_up_info", "ai_didnt_push_back", "user_skipped_step", "question_quality", "system"];
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
            <h3 style={{ fontSize: 15, color: c.chalk, margin: 0 }}>{CATEGORY_LABEL[cat]}</h3>
            <span style={{ color: c.stone, fontSize: 11 }}>{(issuesByCategory.get(cat) || []).length} types of issue</span>
          </div>
          <div style={{ display: "grid", gap: sp.xs }}>
            {(issuesByCategory.get(cat) || []).map((issue) => {
              const f = friendlyFlag(issue.flag);
              return (
                <div key={issue.flag} style={{ padding: sp.md, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.sm }}>
                  <div style={{ display: "flex", alignItems: "center", gap: sp.lg, flexWrap: "wrap", marginBottom: f.description ? sp.xs : 0 }}>
                    <div style={{ flexShrink: 0 }}>
                      <div style={{ color: c.ivory, fontSize: 13, fontWeight: 500 }}>{f.label}</div>
                      <code style={{ color: c.stone, fontFamily: font.mono, fontSize: 10 }}>{issue.flag}</code>
                    </div>
                    <span style={{ fontSize: 12, color: c.chalk }}>{issue.count} occurrence{issue.count === 1 ? "" : "s"}</span>
                    {issue.severity_high > 0 && <span style={{ background: "rgba(209,126,104,0.15)", color: c.ember, padding: `2px ${sp.sm}px`, borderRadius: radius.pill, fontSize: 11 }}>{issue.severity_high} high priority</span>}
                    <span style={{ color: c.stone, fontSize: 11 }}>{issue.open} need review · {issue.resolved} fixed</span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: sp.xs, flexWrap: "wrap", alignItems: "center" }}>
                      {issue.open > 0 && (
                        <button onClick={() => bulkAcknowledge(issue.flag)} style={{ background: "transparent", color: c.gilt, border: `1px solid ${c.gilt}`, borderRadius: radius.sm, padding: `2px ${sp.sm}px`, fontSize: 11, fontFamily: font.ui, cursor: "pointer" }}>
                          Mark {issue.open} as reviewed
                        </button>
                      )}
                      {issue.sessions.slice(0, 5).map((sid) => (
                        <button key={sid} onClick={() => onSelectSession(sid)} style={{ background: c.onyx, color: c.gilt, border: "none", borderRadius: radius.sm, padding: `2px ${sp.sm}px`, fontFamily: font.mono, fontSize: 10, cursor: "pointer" }}>
                          {sid.slice(0, 10)}…
                        </button>
                      ))}
                    </div>
                  </div>
                  {f.description && <div style={{ color: c.stone, fontSize: 12, lineHeight: 1.4 }}>{f.description}</div>}
                </div>
              );
            })}
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
        <div style={{ marginBottom: sp.xs, display: "flex", gap: sp.xs, alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ background: c.obsidian, color: c.gilt, padding: `2px 6px`, borderRadius: radius.sm, fontSize: 11, fontFamily: font.mono }}>{item.target_file}</code>
          {item.file_grounded === false && (
            <span title="The LLM referenced a file that doesn't exist in the repo. Verify before acting on this recommendation." style={{ background: "rgba(209,126,104,0.15)", color: c.ember, padding: `1px ${sp.sm}px`, borderRadius: radius.pill, fontSize: 10, fontFamily: font.ui }}>
              ⚠ unverified path
            </span>
          )}
          {item.file_grounded === true && (
            <span title="Path verified against repo manifest." style={{ color: c.sage, fontSize: 10 }}>✓</span>
          )}
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
  const [range, setRange] = useState<DateRange>("7d");

  const filtered = useMemo(() => {
    let out = rows.filter((r) => withinRange(r.analyzed_at, range));
    if (filter) {
      const q = filter.toLowerCase();
      out = out.filter((r) =>
        r.session_id.toLowerCase().includes(q) ||
        r.focus.toLowerCase().includes(q) ||
        friendlyFocus(r.focus).toLowerCase().includes(q) ||
        (r.flags || []).some((f) => f.toLowerCase().includes(q) || friendlyFlag(f).label.toLowerCase().includes(q)),
      );
    }
    return out;
  }, [rows, filter, range]);

  // Group by day for the table — date headers separate the report by day so
  // 300+ sessions stay scannable.
  const grouped = useMemo(() => {
    const m = new Map<string, InsightRow[]>();
    for (const r of filtered) {
      const day = dayKey(r.analyzed_at);
      const list = m.get(day) || [];
      list.push(r);
      m.set(day, list);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: sp.lg }}>
      <div>
        <div style={{ display: "flex", gap: sp.sm, marginBottom: sp.md, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by ID, interview type, or issue…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ flex: 1, minWidth: 240, padding: sp.sm, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.sm, color: c.ivory, fontFamily: font.ui, fontSize: 13 }}
          />
          <DateRangeSelector value={range} onChange={setRange} />
        </div>

        <div style={{ color: c.stone, fontSize: 11, marginBottom: sp.sm }}>
          Showing {filtered.length} of {rows.length} sessions
        </div>

        {grouped.length === 0 && <div style={{ color: c.stone, padding: sp.lg }}>No sessions in this date range.</div>}

        {grouped.map(([day, dayRows]) => (
          <div key={day} style={{ marginBottom: sp.lg }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: sp.xs, padding: `${sp.xs}px ${sp.sm}px`, background: c.onyx, borderRadius: radius.sm }}>
              <div style={{ color: c.gilt, fontFamily: font.ui, fontSize: 13, fontWeight: 600 }}>{formatDay(day)}</div>
              <div style={{ color: c.stone, fontSize: 11 }}>{dayRows.length} session{dayRows.length === 1 ? "" : "s"}</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12, fontFamily: font.ui, width: "100%" }}>
                <thead>
                  <tr style={{ color: c.stone, textAlign: "left" }}>
                    <th style={{ padding: sp.sm, fontWeight: 400 }}>Session</th>
                    <th style={{ padding: sp.sm, fontWeight: 400 }}>Interview type</th>
                    <th style={{ padding: sp.sm, fontWeight: 400 }}>Priority</th>
                    <th style={{ padding: sp.sm, fontWeight: 400 }}>Score gap</th>
                    <th style={{ padding: sp.sm, fontWeight: 400 }}>Issues</th>
                    <th style={{ padding: sp.sm, fontWeight: 400 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map((r) => (
                    <tr key={r.session_id} onClick={() => setSelected(r)} style={{ borderTop: `1px solid ${c.border}`, color: c.chalk, cursor: "pointer", background: selected?.session_id === r.session_id ? c.onyx : "transparent" }}>
                      <td style={{ padding: sp.sm }}><code style={{ color: c.gilt, fontFamily: font.mono, fontSize: 11 }}>{r.session_id.slice(0, 14)}…</code></td>
                      <td style={{ padding: sp.sm }}>{friendlyFocus(r.focus)}</td>
                      <td style={{ padding: sp.sm, color: severityColor(r.severity) }}>{friendlySeverity(r.severity)}</td>
                      <td style={{ padding: sp.sm, color: driftColor(r.score_drift), fontFamily: font.mono }}>{fmtDrift(r.score_drift)}</td>
                      <td style={{ padding: sp.sm }}>{(r.flags || []).length}</td>
                      <td style={{ padding: sp.sm, color: statusColor(r.resolution_status) }}>{friendlyStatus(r.resolution_status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {selected && <SessionDetail row={selected} onClose={() => setSelected(null)} onResolve={onResolve} />}
    </div>
  );
}

function DateRangeSelector({ value, onChange }: { value: DateRange; onChange: (v: DateRange) => void }) {
  const opts: { key: DateRange; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "7d", label: "Last 7 days" },
    { key: "30d", label: "Last 30 days" },
    { key: "all", label: "All" },
  ];
  return (
    <div style={{ display: "flex", gap: 0, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.sm, overflow: "hidden" }}>
      {opts.map((o) => (
        <button key={o.key} onClick={() => onChange(o.key)} style={{
          background: value === o.key ? c.gilt : "transparent",
          color: value === o.key ? c.obsidian : c.stone,
          border: "none",
          padding: `${sp.sm}px ${sp.md}px`,
          fontSize: 12,
          fontFamily: font.ui,
          fontWeight: value === o.key ? 600 : 400,
          cursor: "pointer",
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function formatDay(yyyymmdd: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  if (yyyymmdd === today) return `Today · ${yyyymmdd}`;
  if (yyyymmdd === yesterday) return `Yesterday · ${yyyymmdd}`;
  const d = new Date(yyyymmdd + "T00:00:00Z");
  return `${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })} · ${yyyymmdd}`;
}

interface TranscriptTurn { speaker: string; text: string; time: string }

/* Download the current session + analyzer findings as a ground-truth
 * fixture skeleton. The admin reviews / edits the must_include /
 * must_not_include arrays and commits the file under
 * tests/fixtures/analyzer-ground-truth/<focus>/. This closes the
 * loop from "Claude found X" → "calibrated CI gate locked in." */
function downloadAsFixture(row: InsightRow, transcript: TranscriptTurn[]): void {
  const fixture = {
    name: `Real session ${row.session_id.slice(0, 12)} — review and rename`,
    notes: `Auto-exported from admin Quality dashboard on ${new Date().toISOString().slice(0, 10)}. Edit the expected.must_include / must_not_include arrays to match your judgement, then commit under tests/fixtures/analyzer-ground-truth/${row.focus}/.`,
    session: {
      type: row.focus,
      transcript: transcript.map((t) => ({ speaker: t.speaker, text: t.text || "", time: t.time || "" })),
    },
    expected: {
      must_include: row.flags || [],
      must_not_include: ["empty_transcript"],
    },
    analyzer_snapshot_at_export: {
      analyzer_version: row.analyzer_version,
      severity: row.severity,
      score_drift: row.score_drift,
      flags: row.flags,
      hallucinations: row.hallucinations,
    },
  };
  const blob = new Blob([JSON.stringify(fixture, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${row.focus}-${row.session_id.slice(0, 12)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function turnContextFor(transcript: TranscriptTurn[], turnIdx: number | undefined): { question: TranscriptTurn | null; answer: TranscriptTurn | null; nextQuestion: TranscriptTurn | null } {
  if (typeof turnIdx !== "number" || !transcript.length) return { question: null, answer: null, nextQuestion: null };
  const isAi = (t: TranscriptTurn) => (t.speaker || "").toLowerCase().startsWith("a");
  const isUser = (t: TranscriptTurn) => (t.speaker || "").toLowerCase().startsWith("u");
  const at = transcript[turnIdx];
  if (!at) return { question: null, answer: null, nextQuestion: null };
  // If the finding's turn is the user's answer, walk back to the prior AI turn
  // for the question, and forward to the next AI turn for the follow-up.
  // If the finding's turn is an AI turn (e.g. duplicate_question), treat that as
  // the question and find the user's reply right after.
  let questionIdx = -1;
  let answerIdx = -1;
  let nextQuestionIdx = -1;
  if (isUser(at)) {
    answerIdx = turnIdx;
    for (let i = turnIdx - 1; i >= 0; i--) { if (isAi(transcript[i])) { questionIdx = i; break; } }
    for (let i = turnIdx + 1; i < transcript.length; i++) { if (isAi(transcript[i])) { nextQuestionIdx = i; break; } }
  } else if (isAi(at)) {
    questionIdx = turnIdx;
    for (let i = turnIdx + 1; i < transcript.length; i++) { if (isUser(transcript[i])) { answerIdx = i; break; } }
    for (let i = (answerIdx >= 0 ? answerIdx : turnIdx) + 1; i < transcript.length; i++) { if (isAi(transcript[i])) { nextQuestionIdx = i; break; } }
  }
  return {
    question: questionIdx >= 0 ? transcript[questionIdx] : null,
    answer: answerIdx >= 0 ? transcript[answerIdx] : null,
    nextQuestion: nextQuestionIdx >= 0 ? transcript[nextQuestionIdx] : null,
  };
}

function ContextTriplet({ transcript, turnIdx }: { transcript: TranscriptTurn[]; turnIdx: number | undefined }) {
  const ctx = turnContextFor(transcript, turnIdx);
  if (!ctx.question && !ctx.answer && !ctx.nextQuestion) return null;
  const cellStyle = { padding: sp.sm, borderRadius: radius.sm, fontSize: 11, lineHeight: 1.45 } as const;
  return (
    <div style={{ marginTop: sp.xs, display: "grid", gap: sp.xs }}>
      {ctx.question && (
        <div style={{ ...cellStyle, background: c.obsidian, borderLeft: `2px solid ${c.gilt}` }}>
          <div style={{ color: c.gilt, fontSize: 10, marginBottom: 2, fontFamily: font.mono }}>Q · turn {turnIdx !== undefined && ctx.answer === transcript[turnIdx] ? "prior" : turnIdx}</div>
          <div style={{ color: c.chalk }}>{(ctx.question.text || "").slice(0, 600)}</div>
        </div>
      )}
      {ctx.answer && (
        <div style={{ ...cellStyle, background: c.obsidian, borderLeft: `2px solid ${c.sage}` }}>
          <div style={{ color: c.sageLight, fontSize: 10, marginBottom: 2, fontFamily: font.mono }}>A · user</div>
          <div style={{ color: c.chalk }}>{(ctx.answer.text || "").slice(0, 600)}</div>
        </div>
      )}
      {ctx.nextQuestion && (
        <div style={{ ...cellStyle, background: c.obsidian, borderLeft: `2px solid ${c.slate}` }}>
          <div style={{ color: c.slateLight, fontSize: 10, marginBottom: 2, fontFamily: font.mono }}>Next Q · AI</div>
          <div style={{ color: c.chalk }}>{(ctx.nextQuestion.text || "").slice(0, 600)}</div>
        </div>
      )}
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
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [sessionMeta, setSessionMeta] = useState<{ target_role: string | null; target_company: string | null; difficulty: string; has_job_description: boolean } | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  useEffect(() => { setNotes(row.resolution_notes || ""); setBy(row.resolved_by || ""); }, [row.session_id, row.resolution_notes, row.resolved_by]);

  // Fetch the session transcript + metadata so we can render Q→A→next-Q context
  // and show what the candidate was practicing for (role / company).
  useEffect(() => {
    let cancelled = false;
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) return;
    setTranscript([]);
    setSessionMeta(null);
    setTranscriptLoading(true);
    fetch("/api/admin-quality-session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ session_id: row.session_id }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((j: { session?: { transcript: TranscriptTurn[]; target_role: string | null; target_company: string | null; difficulty: string; has_job_description: boolean } } | null) => {
        if (cancelled) return;
        setTranscript(j?.session?.transcript || []);
        if (j?.session) {
          setSessionMeta({
            target_role: j.session.target_role,
            target_company: j.session.target_company,
            difficulty: j.session.difficulty || "",
            has_job_description: j.session.has_job_description,
          });
        }
      })
      .catch(() => { if (!cancelled) { setTranscript([]); setSessionMeta(null); } })
      .finally(() => { if (!cancelled) setTranscriptLoading(false); });
    return () => { cancelled = true; };
  }, [row.session_id]);

  return (
    <aside style={{ background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.md, padding: sp.lg, alignSelf: "start", position: "sticky", top: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp.sm }}>
        <code style={{ color: c.gilt, fontSize: 11, fontFamily: font.mono }}>{row.session_id}</code>
        <button onClick={onClose} style={{ background: "transparent", color: c.stone, border: "none", cursor: "pointer", fontSize: 16 }}>×</button>
      </div>
      <div style={{ color: c.stone, fontSize: 11, marginBottom: sp.sm }}>{friendlyFocus(row.focus)} · {new Date(row.analyzed_at).toLocaleString()}</div>

      {/* Target role / company / difficulty — what was the candidate practicing for? */}
      <div style={{ background: c.onyx, padding: sp.md, borderRadius: radius.sm, marginBottom: sp.lg, display: "grid", gridTemplateColumns: "auto 1fr", gap: `${sp.xs}px ${sp.md}px`, fontSize: 11 }}>
        <div style={{ color: c.stone }}>Interview type</div>
        <div style={{ color: c.ivory, fontWeight: 500 }}>{friendlyFocus(row.focus)}</div>

        <div style={{ color: c.stone }}>Target role</div>
        <div style={{ color: sessionMeta?.target_role ? c.ivory : c.stone }}>{sessionMeta?.target_role || (transcriptLoading ? "Loading…" : "Not recorded")}</div>

        <div style={{ color: c.stone }}>Target company</div>
        <div style={{ color: sessionMeta?.target_company ? c.ivory : c.stone }}>{sessionMeta?.target_company || (transcriptLoading ? "Loading…" : "Not recorded")}</div>

        {sessionMeta?.difficulty && (
          <>
            <div style={{ color: c.stone }}>Difficulty</div>
            <div style={{ color: c.chalk }}>{sessionMeta.difficulty}</div>
          </>
        )}
        {sessionMeta?.has_job_description && (
          <>
            <div style={{ color: c.stone }}>Job description</div>
            <div style={{ color: c.sage }}>Provided</div>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: sp.md, marginBottom: sp.lg, fontSize: 11, flexWrap: "wrap" }}>
        <div><div style={{ color: c.stone, fontSize: 10 }}>Priority</div><div style={{ color: severityColor(row.severity), fontWeight: 600 }}>{friendlySeverity(row.severity)}</div></div>
        <div><div style={{ color: c.stone, fontSize: 10 }}>Score gap</div><div style={{ color: driftColor(row.score_drift), fontFamily: font.mono }}>{fmtDrift(row.score_drift)}</div></div>
        <div><div style={{ color: c.stone, fontSize: 10 }}>Stricter score</div><div style={{ color: c.chalk, fontFamily: font.mono }}>{row.rescore ?? "—"}</div></div>
      </div>

      {row.flags && row.flags.length > 0 && (
        <Section title="Issues found">
          <div style={{ display: "grid", gap: sp.xs }}>
            {row.flags.map((f) => {
              const ff = friendlyFlag(f);
              return (
                <div key={f} style={{ background: c.onyx, padding: `${sp.xs}px ${sp.sm}px`, borderRadius: radius.sm, borderLeft: `2px solid ${c.gilt}` }}>
                  <div style={{ color: c.ivory, fontSize: 12 }}>{ff.label}</div>
                  {ff.description && <div style={{ color: c.stone, fontSize: 10, marginTop: 1 }}>{ff.description}</div>}
                  <code style={{ color: c.stone, fontSize: 9, fontFamily: font.mono }}>{f}</code>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {row.hallucinations && row.hallucinations.length > 0 && (
        <Section title="AI made-up information">
          {row.hallucinations.map((h, i) => (
            <div key={i} style={{ padding: sp.sm, background: "rgba(209,126,104,0.08)", borderRadius: radius.sm, marginBottom: sp.sm, fontSize: 11 }}>
              <div style={{ color: c.ember, fontFamily: font.mono, marginBottom: 2 }}>{h.type}</div>
              <div style={{ color: c.chalk }}>{h.evidence}</div>
              {transcript.length > 0 && <ContextTriplet transcript={transcript} turnIdx={h.turn_idx} />}
            </div>
          ))}
        </Section>
      )}

      {row.rubric_gaps && row.rubric_gaps.length > 0 && (
        <Section title="Where coaching is needed">
          {row.rubric_gaps.map((g, i) => (
            <div key={i} style={{ padding: sp.sm, background: c.onyx, borderRadius: radius.sm, marginBottom: sp.sm, fontSize: 11 }}>
              <div style={{ color: c.gilt, fontFamily: font.mono }}>{g.dimension}</div>
              <div style={{ color: c.stone, fontSize: 10 }}>expected: {g.expected}</div>
              <div style={{ color: c.chalk }}>observed: {g.observed}</div>
            </div>
          ))}
        </Section>
      )}

      {row.bad_questions && row.bad_questions.length > 0 && (
        <Section title="Question quality problems">
          {row.bad_questions.map((q, i) => (
            <div key={i} style={{ padding: sp.sm, background: c.onyx, borderRadius: radius.sm, marginBottom: sp.sm, fontSize: 11 }}>
              <div style={{ color: c.gilt, fontFamily: font.mono }}>{q.reason}</div>
              <div style={{ color: c.chalk }}>{(q.evidence || "").slice(0, 200)}</div>
              {transcript.length > 0 && <ContextTriplet transcript={transcript} turnIdx={q.turn_idx} />}
            </div>
          ))}
        </Section>
      )}

      {transcript.length > 0 && (
        <Section title={`Full transcript (${transcript.length} turns)`}>
          <details>
            <summary style={{ color: c.gilt, fontSize: 11, cursor: "pointer", marginBottom: sp.xs }}>Show all turns</summary>
            <div style={{ display: "grid", gap: sp.xs, marginTop: sp.xs }}>
              {transcript.map((t, i) => {
                const isAi = (t.speaker || "").toLowerCase().startsWith("a");
                return (
                  <div key={i} style={{ padding: sp.sm, background: c.obsidian, borderLeft: `2px solid ${isAi ? c.gilt : c.sage}`, borderRadius: radius.sm, fontSize: 11 }}>
                    <div style={{ color: isAi ? c.gilt : c.sageLight, fontSize: 9, fontFamily: font.mono, marginBottom: 2 }}>#{i} · {isAi ? "AI" : "USER"}</div>
                    <div style={{ color: c.chalk, lineHeight: 1.45 }}>{(t.text || "").slice(0, 600)}</div>
                  </div>
                );
              })}
            </div>
          </details>
        </Section>
      )}
      {transcriptLoading && <div style={{ color: c.stone, fontSize: 11, marginBottom: sp.sm }}>Loading transcript…</div>}

      {row.coaching_notes && (
        <Section title="Coaching notes">
          <div style={{ color: c.chalk, fontSize: 12, lineHeight: 1.5 }}>{row.coaching_notes}</div>
        </Section>
      )}

      {transcript.length > 0 && (
        <Section title="Calibrate the analyzer">
          <div style={{ color: c.stone, fontSize: 11, lineHeight: 1.4, marginBottom: sp.xs }}>
            Disagree with this report? Save it as a ground-truth fixture so the CI gate locks in the right answer for next time.
          </div>
          <button
            onClick={() => downloadAsFixture(row, transcript)}
            style={{ background: "transparent", color: c.gilt, border: `1px solid ${c.gilt}`, padding: `${sp.xs}px ${sp.sm}px`, borderRadius: radius.sm, fontSize: 11, fontFamily: font.ui, cursor: "pointer" }}
          >
            Download as fixture (.json)
          </button>
        </Section>
      )}

      <Section title="What did you do?">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What's the fix? (e.g. 'Updated AI prompt to push back harder on missing R')"
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
          <ResolveButton label="Mark as reviewed" color={c.gilt} onClick={() => onResolve(row.session_id, "acknowledged", notes, by)} />
          <ResolveButton label="Mark as fixed" color={c.sage} onClick={() => onResolve(row.session_id, "resolved", notes, by)} />
          <ResolveButton label="Won't fix" color={c.stone} onClick={() => onResolve(row.session_id, "wont_fix", notes, by)} />
          <ResolveButton label="Reopen" color={c.ember} onClick={() => onResolve(row.session_id, "open", notes, by)} />
        </div>
        {row.resolved_at && <div style={{ color: c.stone, fontSize: 10, marginTop: sp.xs }}>Last action: {friendlyStatus(row.resolution_status)} by {row.resolved_by || "—"} on {new Date(row.resolved_at).toLocaleString()}</div>}
        {(() => {
          const b = outcomeBadge(row.fix_outcome);
          if (!b) return null;
          return (
            <div style={{ marginTop: sp.sm, padding: sp.sm, background: c.obsidian, borderRadius: radius.sm, borderLeft: `2px solid ${b.color}` }}>
              <div style={{ color: b.color, fontSize: 11, fontFamily: font.mono, marginBottom: 2 }}>{b.label}</div>
              <div style={{ color: c.stone, fontSize: 10 }}>{b.tooltip}</div>
              {row.fix_outcome?.primary_flag && <div style={{ color: c.stone, fontSize: 9, marginTop: 2 }}>Tracked flag: <code>{row.fix_outcome.primary_flag}</code></div>}
            </div>
          );
        })()}
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
  const [range, setRange] = useState<DateRange>("30d");
  const filtered = useMemo(() => rows.filter((r) => r.resolved_at && withinRange(r.resolved_at, range)), [rows, range]);
  const grouped = useMemo(() => {
    const m = new Map<string, InsightRow[]>();
    for (const r of filtered) {
      if (!r.resolved_at) continue;
      const day = dayKey(r.resolved_at);
      const list = m.get(day) || [];
      list.push(r);
      m.set(day, list);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  if (rows.length === 0) return <div style={{ color: c.stone, padding: sp.lg }}>No sessions reviewed yet. Use the "Mark as reviewed" / "Mark as fixed" buttons in the Sessions tab.</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: sp.md, flexWrap: "wrap", gap: sp.sm }}>
        <div style={{ color: c.stone, fontSize: 12 }}>{filtered.length} reviewed in this range</div>
        <DateRangeSelector value={range} onChange={setRange} />
      </div>
      {grouped.length === 0 && <div style={{ color: c.stone, padding: sp.lg }}>Nothing reviewed in this date range.</div>}
      {grouped.map(([day, dayRows]) => (
        <div key={day} style={{ marginBottom: sp.lg }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: sp.xs, padding: `${sp.xs}px ${sp.sm}px`, background: c.onyx, borderRadius: radius.sm }}>
            <div style={{ color: c.gilt, fontSize: 13, fontWeight: 600 }}>{formatDay(day)}</div>
            <div style={{ color: c.stone, fontSize: 11 }}>{dayRows.length} reviewed</div>
          </div>
          <div style={{ display: "grid", gap: sp.xs }}>
            {dayRows.map((r) => (
              <div key={r.session_id} style={{ padding: sp.md, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.sm, fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: sp.xs }}>
                  <code style={{ color: c.gilt, fontFamily: font.mono, fontSize: 11 }}>{r.session_id.slice(0, 18)}…</code>
                  <span style={{ color: statusColor(r.resolution_status), fontSize: 11, fontWeight: 600 }}>{friendlyStatus(r.resolution_status)}</span>
                </div>
                <div style={{ color: c.stone, fontSize: 11, marginBottom: sp.xs }}>{friendlyFocus(r.focus)} · by {r.resolved_by || "unknown"} · {r.resolved_at ? new Date(r.resolved_at).toLocaleTimeString() : "—"}</div>
                {(() => {
                  const b = outcomeBadge(r.fix_outcome);
                  if (!b) return null;
                  return <div title={b.tooltip} style={{ display: "inline-block", marginBottom: sp.xs, padding: `2px ${sp.sm}px`, borderRadius: radius.pill, fontSize: 11, color: b.color, border: `1px solid ${b.color}`, fontFamily: font.mono }}>{b.label}</div>;
                })()}
                {r.resolution_notes && <div style={{ color: c.chalk, fontSize: 12 }}>{r.resolution_notes}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RevisionsView({ revisions, onRefresh }: { revisions: Revision[]; onRefresh: () => void }) {
  const [focus, setFocus] = useState("");
  const [description, setDescription] = useState("");
  const [commit, setCommit] = useState("");
  const [by, setBy] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!focus || !description) { alert("Focus and description are required."); return; }
    setSubmitting(true);
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) { setSubmitting(false); return; }
    const res = await fetch("/api/admin-quality-revision", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ action: "create", focus, description, commit_sha: commit, by }),
    });
    setSubmitting(false);
    if (res.ok) {
      setDescription("");
      setCommit("");
      onRefresh();
    } else {
      alert(`Log revision failed: HTTP ${res.status}`);
    }
  };

  return (
    <div>
      <div style={{ background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.md, padding: sp.lg, marginBottom: sp.xl }}>
        <div style={{ fontSize: 14, color: c.chalk, fontWeight: 600, marginBottom: sp.xs }}>Log a prompt deployment</div>
        <div style={{ fontSize: 11, color: c.stone, marginBottom: sp.md }}>Mark when you ship a prompt change. The cron measures the focus-wide flag-rate 7 days before vs after, and reports a verdict.</div>
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 160px 160px auto", gap: sp.sm, alignItems: "center" }}>
          <select value={focus} onChange={(e) => setFocus(e.target.value)} style={{ padding: sp.sm, background: c.obsidian, border: `1px solid ${c.border}`, borderRadius: radius.sm, color: c.ivory, fontFamily: font.ui, fontSize: 12 }}>
            <option value="">Choose focus…</option>
            {["behavioral", "salary-negotiation", "technical", "system-design", "hr-round", "strategic", "panel", "case-study", "campus-placement", "management", "government-psu"].map((f) => (
              <option key={f} value={f}>{friendlyFocus(f)}</option>
            ))}
          </select>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What changed? (e.g. 'Tightened STAR probe in behavioral system prompt')" style={{ padding: sp.sm, background: c.obsidian, border: `1px solid ${c.border}`, borderRadius: radius.sm, color: c.ivory, fontFamily: font.ui, fontSize: 12 }} />
          <input value={commit} onChange={(e) => setCommit(e.target.value)} placeholder="Commit SHA (optional)" style={{ padding: sp.sm, background: c.obsidian, border: `1px solid ${c.border}`, borderRadius: radius.sm, color: c.ivory, fontFamily: font.mono, fontSize: 11 }} />
          <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name" style={{ padding: sp.sm, background: c.obsidian, border: `1px solid ${c.border}`, borderRadius: radius.sm, color: c.ivory, fontFamily: font.ui, fontSize: 12 }} />
          <button onClick={submit} disabled={submitting} style={{ background: c.gilt, color: c.obsidian, border: "none", padding: `${sp.sm}px ${sp.lg}px`, borderRadius: radius.sm, fontFamily: font.ui, fontSize: 12, fontWeight: 600, cursor: submitting ? "wait" : "pointer" }}>
            {submitting ? "Logging…" : "Log"}
          </button>
        </div>
      </div>

      <h3 style={{ fontSize: 14, color: c.chalk, marginBottom: sp.sm }}>Recent revisions</h3>
      {revisions.length === 0 ? (
        <div style={{ color: c.stone, padding: sp.lg }}>No prompt revisions logged yet.</div>
      ) : (
        <div style={{ display: "grid", gap: sp.sm }}>
          {revisions.map((r) => {
            const b = outcomeBadge(r.outcome);
            return (
              <div key={r.id} style={{ padding: sp.md, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: radius.sm }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: sp.sm, marginBottom: sp.xs }}>
                  <div>
                    <span style={{ color: c.gilt, fontSize: 13, fontWeight: 600 }}>{friendlyFocus(r.focus)}</span>
                    <span style={{ color: c.stone, fontSize: 11, marginLeft: sp.sm }}>{new Date(r.deployed_at).toLocaleString()}</span>
                  </div>
                  {b && <div title={b.tooltip} style={{ padding: `2px ${sp.sm}px`, borderRadius: radius.pill, fontSize: 11, color: b.color, border: `1px solid ${b.color}`, fontFamily: font.mono }}>{b.label}</div>}
                </div>
                <div style={{ color: c.ivory, fontSize: 12, marginBottom: 2 }}>{r.description}</div>
                <div style={{ color: c.stone, fontSize: 10, fontFamily: font.mono }}>
                  {r.deployed_by && <span>by {r.deployed_by}</span>}
                  {r.commit_sha && <span style={{ marginLeft: sp.sm }}>· {r.commit_sha.slice(0, 8)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
