"use client";
import { useState, useMemo, memo } from "react";
import { useRouter } from "next/navigation";
import { c, font } from "./tokens";
import { scoreLabel, scoreLabelColor, sessionTypes } from "./dashboardTypes";
import type { DashboardSession } from "./dashboardTypes";
import { useDashboardSessions, useDashboardCore } from "./DashboardContext";
import { DataLoadingSkeleton } from "./dashboardComponents";
import { useDocTitle } from "./useDocTitle";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ─── ScoreRing — 64px circular progress + band label ───
 * Ported from the canvas demo. Larger than the legacy 52px ring so the
 * score numeral reads at a glance. Band label (Strong/Good/Needs work)
 * sits inside the ring; delta lives in the action bar to keep the rail
 * visually balanced against the left content column. */
function ScoreRing({ score }: { score: number }) {
  const color = scoreLabelColor(score);
  const r = 27;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  return (
    <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
      <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(14,12,8,0.06)" strokeWidth="3" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`} className="score-ring" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: font.mono, fontSize: 20, fontWeight: 700, color: c.ivory, lineHeight: 1 }}>{score}</span>
        <span style={{ fontFamily: font.ui, fontSize: 8, fontWeight: 700, color, letterSpacing: "0.04em", lineHeight: 1, marginTop: 2, textTransform: "uppercase" as const }}>{scoreLabel(score)}</span>
      </div>
    </div>
  );
}

/* ─── Memoized session row — two-rail balanced card ───
 *
 * Structure (top → bottom):
 *   1. Eyebrow strip — type · difficulty · Qs · duration · relative time
 *   2. Body — left column (identity headline → quiet "Did well" line →
 *      dominant "Work on next" block with example chip) + right rail
 *      (ScoreRing). The rail is vertically centered against the full
 *      column with a hairline borderLeft so neither side leaves a void.
 *   3. Action bar — "View full report →" on the left, ±change chip on
 *      the right.
 *
 * Data sourcing:
 *   - `session.coaching` is structured plain-language output from the
 *     evaluator (server-handlers/evaluate-session.ts, mvp-8+). When
 *     present we render the full {headline, meaning, example} layout.
 *   - Pre-mvp-8 sessions have no coaching → we degrade to the legacy
 *     topStrength/topWeakness one-liners (a single short headline each,
 *     no meaning/example). No dummy fields are invented. */
const SessionRow = memo(function SessionRow({ session, onClick }: { session: DashboardSession; onClick: () => void }) {
  const coaching = session.coaching;
  const strengthHeadline = coaching?.strength.headline || session.topStrength;
  const gapHeadline = coaching?.gap.headline || session.topWeakness;
  const eyebrow = [session.type, session.difficulty, session.duration].filter(Boolean) as string[];
  return (
    <button
      onClick={onClick}
      style={{ width: "100%", padding: 0, borderRadius: 14, textAlign: "left" as const, background: c.carbon, border: `1px solid ${c.border}`, cursor: "pointer", display: "block", overflow: "hidden", transition: "border-color 0.15s ease, box-shadow 0.15s ease", outline: "none" }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.borderHover; e.currentTarget.style.boxShadow = "0 2px 12px rgba(14,12,8,0.07)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Eyebrow strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: `1px solid ${c.border}`, background: c.graphite }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {eyebrow.map((p, i) => (
            <span key={p + i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {i > 0 && <span style={{ color: c.stone, fontSize: 10 }}>·</span>}
              <span style={{ fontFamily: font.ui, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: i === 0 ? c.chalk : c.stone }}>{p}</span>
            </span>
          ))}
        </div>
        <span style={{ fontFamily: font.mono, fontSize: 11, color: c.stone }} title={session.dateLabel}>{relativeTime(session.date)}</span>
      </div>

      {/* Body — left content column + right score rail */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 22, padding: "18px 20px" }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Identity headline */}
          <div style={{ fontFamily: font.ui, fontSize: 17, fontWeight: 600, color: c.ivory, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {session.role}{session.company ? <> <span style={{ color: c.chalk, fontWeight: 400 }}>at</span> {session.company}</> : null}
          </div>

          {/* Strength — quiet one-line affirmation */}
          {strengthHeadline && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ color: c.sage, fontSize: 12, flexShrink: 0 }}>✓</span>
              <span style={{ fontFamily: font.ui, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: c.sage, flexShrink: 0 }}>Did well</span>
              <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{strengthHeadline}</span>
            </div>
          )}

          {/* Gap — dominant block. Meaning + example only render when the
              evaluator produced structured coaching; pre-mvp-8 sessions
              show just the legacy headline on the same copper tint so
              the card hierarchy stays consistent. */}
          {gapHeadline && (
            <div style={{ display: "flex", gap: 10, background: "rgba(180,83,9,0.06)", borderRadius: 10, padding: "13px 15px" }}>
              <span style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, background: "rgba(180,83,9,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: c.gilt, marginTop: 1, fontWeight: 700 }}>↑</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: font.ui, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: c.gilt, marginBottom: 3 }}>Work on next</div>
                <div style={{ fontFamily: font.ui, fontSize: 15, fontWeight: 700, color: c.ivory, lineHeight: 1.3 }}>{gapHeadline}</div>
                {coaching?.gap.meaning && (
                  <div style={{ fontFamily: font.ui, fontSize: 12.5, color: c.chalk, lineHeight: 1.45, marginTop: 3 }}>{coaching.gap.meaning}</div>
                )}
                {coaching?.gap.example && (
                  <div style={{ display: "inline-block", marginTop: 8, fontFamily: font.ui, fontSize: 11.5, fontWeight: 500, color: c.gilt, background: c.carbon, border: `1px solid rgba(180,83,9,0.2)`, borderRadius: 8, padding: "4px 9px", lineHeight: 1.35 }}>{coaching.gap.example}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Score rail */}
        <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", paddingLeft: 22, borderLeft: `1px solid ${c.border}` }}>
          <ScoreRing score={session.score} />
        </div>
      </div>

      {/* Action bar — primary nav cue + delta. The whole card is the
          click target; "View full report" reads as the intent label
          rather than a separate control, and the chevron carries the
          affordance for keyboard/touch users. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 14px", borderTop: `1px solid ${c.border}` }}>
        <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 700, color: c.gilt, display: "flex", alignItems: "center", gap: 5 }}>
          View full report
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </span>
        {session.change !== 0 && (
          <span style={{ padding: "4px 10px", borderRadius: 10, background: session.change > 0 ? "rgba(21,128,61,0.08)" : "rgba(185,28,28,0.08)", border: `1px solid ${session.change > 0 ? "rgba(21,128,61,0.15)" : "rgba(185,28,28,0.15)"}` }}>
            <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 600, color: session.change > 0 ? c.sage : c.ember }}>{session.change > 0 ? "+" : ""}{session.change} vs prev</span>
          </span>
        )}
      </div>
    </button>
  );
});

export default function DashboardSessions() {
  useDocTitle("Sessions");
  const sessionNav = useRouter();
  const { recentSessions, sessionsLoading } = useDashboardSessions();
  const { handleStartSession } = useDashboardCore();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "score">("date");
  const [showCount, setShowCount] = useState(20);

  const sessions = recentSessions;
  const filtered = useMemo(() => sessions
    .filter(s => filter === "All" || s.type === filter)
    .filter(s => {
      if (!search) return true;
      const q = search.toLowerCase();
      return s.type.toLowerCase().includes(q)
        || (s.topStrength || "").toLowerCase().includes(q)
        || (s.topWeakness || "").toLowerCase().includes(q)
        || (s.coaching?.strength.headline || "").toLowerCase().includes(q)
        || (s.coaching?.gap.headline || "").toLowerCase().includes(q);
    })
    .sort((a, b) => sortBy === "score" ? b.score - a.score : new Date(b.date).getTime() - new Date(a.date).getTime()), [sessions, filter, search, sortBy]);

  if (sessionsLoading) return <DataLoadingSkeleton />;

  const visible = filtered.slice(0, showCount);
  const hasMore = filtered.length > showCount;

  const exportCSV = () => {
    const header = "Date,Type,Role,Score,Change,Duration,Top Strength,Top Weakness\n";
    const rows = filtered.map(s =>
      [s.dateLabel, s.type, s.role, s.score, s.change, s.duration, s.topStrength, s.topWeakness]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hirestepx-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (sessions.length === 0) {
    return (
      <div style={{ margin: "0 auto", textAlign: "center", padding: "60px 20px" }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, margin: "0 auto 24px", background: "rgba(180,83,9,0.06)", border: `1px solid rgba(180,83,9,0.15)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c.gilt} strokeWidth="1.5" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
        </div>
        <h2 style={{ fontFamily: font.ui, fontSize: 22, fontWeight: 600, color: c.ivory, marginBottom: 8 }}>No sessions yet</h2>
        <p style={{ fontFamily: font.ui, fontSize: 14, color: c.stone, lineHeight: 1.6, marginBottom: 28 }}>
          Complete your first practice interview and it will show up here with detailed scores, feedback, and a full transcript.
        </p>
        <button onClick={handleStartSession} className="shimmer-btn"
          style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 500, padding: "12px 32px", borderRadius: 8, border: "none", background: c.gilt, color: c.obsidian, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
        >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5,3 19,12 5,21" /></svg>
          Start Your First Session
        </button>
      </div>
    );
  }

  return (
    <div style={{ margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h2 style={{ fontFamily: font.ui, fontSize: 22, fontWeight: 600, color: c.ivory, marginBottom: 4 }}>Sessions</h2>
          <p style={{ fontFamily: font.ui, fontSize: 13, color: c.stone }}>{sessions.length} session{sessions.length !== 1 ? "s" : ""} completed</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportCSV} title="Export sessions as CSV"
            style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 500, padding: "10px 16px", borderRadius: 8, border: `1px solid ${c.border}`, background: "transparent", color: c.stone, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.borderHover; e.currentTarget.style.color = c.chalk; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.stone; }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
          <button onClick={handleStartSession} className="shimmer-btn"
            style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 500, padding: "10px 24px", borderRadius: 8, border: "none", background: c.gilt, color: c.obsidian, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Session
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.stone} strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Search by type, strength, weakness..."
            value={search} onChange={(e) => { setSearch(e.target.value); setShowCount(20); }}
            style={{ width: "100%", padding: "9px 12px 9px 34px", fontFamily: font.ui, fontSize: 13, color: c.ivory, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 8, outline: "none", boxSizing: "border-box" }}
            onFocus={(e) => e.currentTarget.style.borderColor = c.gilt}
            onBlur={(e) => e.currentTarget.style.borderColor = c.border}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {sessionTypes.map(type => (
            <button key={type} onClick={() => { setFilter(type); setShowCount(20); }} aria-pressed={filter === type}
              style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 500, padding: "7px 14px", borderRadius: 100, cursor: "pointer", background: filter === type ? "rgba(180,83,9,0.1)" : "transparent", border: `1px solid ${filter === type ? c.gilt : c.border}`, color: filter === type ? c.gilt : c.stone, transition: "all 0.2s ease", outline: "none" }}
              onMouseEnter={(e) => { if (filter !== type) { e.currentTarget.style.color = c.ivory; e.currentTarget.style.borderColor = "rgba(180,83,9,0.35)"; } }}
              onMouseLeave={(e) => { if (filter !== type) { e.currentTarget.style.color = c.stone; e.currentTarget.style.borderColor = c.border; } }}
            >{type}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setSortBy("date")} aria-pressed={sortBy === "date"}
            style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 500, padding: "7px 12px", borderRadius: 100, cursor: "pointer", background: sortBy === "date" ? "rgba(180,83,9,0.1)" : "transparent", border: `1px solid ${sortBy === "date" ? c.gilt : c.border}`, color: sortBy === "date" ? c.gilt : c.stone, transition: "all 0.2s ease", outline: "none" }}
            onMouseEnter={(e) => { if (sortBy !== "date") { e.currentTarget.style.color = c.ivory; e.currentTarget.style.borderColor = "rgba(180,83,9,0.35)"; } }}
            onMouseLeave={(e) => { if (sortBy !== "date") { e.currentTarget.style.color = c.stone; e.currentTarget.style.borderColor = c.border; } }}
          >Recent</button>
          <button onClick={() => setSortBy("score")} aria-pressed={sortBy === "score"}
            style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 500, padding: "7px 12px", borderRadius: 100, cursor: "pointer", background: sortBy === "score" ? "rgba(180,83,9,0.1)" : "transparent", border: `1px solid ${sortBy === "score" ? c.gilt : c.border}`, color: sortBy === "score" ? c.gilt : c.stone, transition: "all 0.2s ease", outline: "none" }}
            onMouseEnter={(e) => { if (sortBy !== "score") { e.currentTarget.style.color = c.ivory; e.currentTarget.style.borderColor = "rgba(180,83,9,0.35)"; } }}
            onMouseLeave={(e) => { if (sortBy !== "score") { e.currentTarget.style.color = c.stone; e.currentTarget.style.borderColor = c.border; } }}
          >Top Score</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, margin: "0 auto 16px", background: "rgba(180,83,9,0.06)", border: `1px solid rgba(180,83,9,0.15)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c.gilt} strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </div>
            <p style={{ fontFamily: font.ui, fontSize: 14, color: c.stone, marginBottom: 16 }}>
              {search ? `No sessions matching "${search}"` : "No sessions in this category yet."}
            </p>
            {(search || filter !== "All") && (
              <button onClick={() => { setSearch(""); setFilter("All"); }}
                style={{ fontFamily: font.ui, fontSize: 12, color: c.gilt, background: "none", border: "none", cursor: "pointer", marginBottom: 12, textDecoration: "underline", transition: "color 160ms ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = c.ivory; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = c.gilt; }}
              >
                Clear filters
              </button>
            )}
            <button onClick={handleStartSession}
              style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: c.gilt, background: "rgba(180,83,9,0.06)", border: `1px solid rgba(180,83,9,0.15)`, borderRadius: 8, padding: "10px 24px", cursor: "pointer", transition: "all 160ms cubic-bezier(0.2, 0.7, 0.2, 1)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(180,83,9,0.12)"; e.currentTarget.style.borderColor = "rgba(180,83,9,0.32)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(180,83,9,0.06)"; e.currentTarget.style.borderColor = "rgba(180,83,9,0.15)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Start a {filter !== "All" ? filter : ""} Session
            </button>
          </div>
        ) : (
          visible.map(session => (
            <SessionRow key={session.id} session={session} onClick={() => sessionNav.push(`/session/${session.id}`)} />
          ))
        )}
        {hasMore && (
          <button onClick={() => setShowCount(s => s + 20)}
            style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1px solid ${c.border}`, background: "transparent", color: c.stone, fontFamily: font.ui, fontSize: 13, cursor: "pointer", transition: "background 0.15s", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(14,12,8,0.04)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            Show more ({filtered.length - showCount} remaining)
          </button>
        )}
      </div>
    </div>
  );
}
