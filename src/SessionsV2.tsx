"use client";

/* HireStepX 2.0 — Sessions screen.
   Sidebar shell, top bar, page header, filter/sort toolbar, grouped/
   sectioned data table, and footer pagination — wired to real session
   history via useDashboardSessions() (recentSessions, sessionsLoading),
   with search/filter/sort/pagination running against the mapped rows
   client-side. "Start session" hands off to /interview. Delete-a-session
   and the richer report-detail affordances (radar/percentile) have no
   backing API yet, so those stay disabled stubs — see the comments at
   each site. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tokens as T, fonts as F } from "./auth/_tokens";
import { dur, ease } from "./_motion";
import { useDashboardSessions } from "./DashboardContext";
import type { DashboardSession } from "./dashboardTypes";
import { captureClientEvent } from "./posthogClient";
import { Button } from "@/components/ui/button";
import {
  PlusIcon,
  SearchXIcon,
  Loader2Icon,
  MicIcon,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SortableHead, type Sort as SharedSort } from "@/components/SortableHead";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";
import { FilterPill } from "@/components/FilterPill";
import { SearchWithSuggestions } from "@/components/SearchWithSuggestions";

const font = { ui: F.sans, mono: F.mono };

type ScoreBand = "developing" | "needsFocus" | "good";

type TakeawayPoint = { tone: "good" | "next"; text: string };

type SessionRow = {
  id: string;
  title: string;
  category: string;
  questionCount: number;
  score: number;
  band: ScoreBand;
  progress: number;
  date: string;
  groupLabel: string;
  takeaways: TakeawayPoint[];
  company?: string;
};

/* Flattened row used by the table's filter/sort/paginate pipeline —
   groupLabel keeps the "Today / This week / Earlier" bucket so date
   divider rows can be rebuilt after filtering. */
type FlatRow = SessionRow;

const bandLabel: Record<ScoreBand, string> = {
  developing: "Developing",
  needsFocus: "Needs focus",
  good: "Good",
};

// Band badges used to carry a full traffic-light palette (red/blue/green)
// on every single row — since "Needs focus" is the majority default, not an
// outlier, that red stopped signaling anything and just became wallpaper.
// One neutral pill now covers the default case; color is reserved for the
// one case that's a genuine outlier worth a second look — a sub-50 score —
// mirroring a restrained "single accent used sparingly" palette rather than
// a color per category.
const ALARM_SCORE = 50;

// Same 85/75 breakpoints as the app's canonical scoreLabel()/
// scoreLabelColor() (src/dashboardTypes.ts) — reused rather than
// invented, just relabeled onto this screen's 3-band vocabulary.
function bandFor(score: number): ScoreBand {
  if (score >= 85) return "good";
  if (score >= 75) return "developing";
  return "needsFocus";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const GROUP_ORDER = ["Today", "This week", "Earlier"];

function bucketLabel(iso: string, now: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "Earlier";
  const days = Math.floor((now - t) / DAY_MS);
  if (days <= 0) return "Today";
  if (days < 7) return "This week";
  return "Earlier";
}

function formatRowDate(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return t.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function buildTakeaways(d: DashboardSession): TakeawayPoint[] {
  if (d.coaching) {
    return [
      { tone: "good", text: d.coaching.strength.headline },
      { tone: "next", text: d.coaching.gap.headline },
    ];
  }
  return [
    { tone: "good", text: d.topStrength },
    { tone: "next", text: d.topWeakness },
  ];
}

/* Map the canonical DashboardSession shape onto this screen's row shape —
   campus-placement special case, empty-company guard. */
function toRow(d: DashboardSession, now: number): FlatRow {
  return {
    id: d.id,
    title: d.role,
    category: d.focus === "campus-placement" ? "Campus Placement" : d.type,
    questionCount: d.questionScores?.length ?? 0,
    score: d.score,
    band: bandFor(d.score),
    progress: d.change,
    date: formatRowDate(d.date),
    groupLabel: bucketLabel(d.date, now),
    takeaways: buildTakeaways(d),
    company: d.company ?? "",
  };
}

const SCORE_OPTIONS: { value: "All" | ScoreBand; label: string }[] = [
  { value: "All", label: "All" },
  { value: "good", label: "Good" },
  { value: "developing", label: "Developing" },
  { value: "needsFocus", label: "Needs focus" },
];

type SortColumn = "title" | "score" | "progress" | "date";
type Sort = SharedSort<SortColumn>;
const DEFAULT_SORT: Sort = { column: "date", direction: "desc" };

const COLUMN_LABEL: Record<SortColumn, string> = {
  title: "Session",
  score: "Score",
  progress: "Progress",
  date: "Date",
};

function compareRows(a: FlatRow, b: FlatRow, sort: Sort): number {
  switch (sort.column) {
    case "title":
      return sort.direction === "asc" ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
    case "score":
      return sort.direction === "asc" ? a.score - b.score : b.score - a.score;
    case "progress":
      return sort.direction === "asc" ? a.progress - b.progress : b.progress - a.progress;
    case "date":
      return sort.direction === "asc" ? parseRowDate(a.date) - parseRowDate(b.date) : parseRowDate(b.date) - parseRowDate(a.date);
  }
}

/* "26 Sep 2026" parses fine via the platform date parser; guarded so a
   malformed date sorts to the back instead of throwing. */
function parseRowDate(date: string): number {
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function PageHeader({ onStartSession }: { onStartSession: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap", gap: 12 }}>
      <div>
        <h1 style={{ fontFamily: font.ui, fontSize: 26, fontWeight: 700, color: T.coal, margin: 0, letterSpacing: "-0.01em", lineHeight: "32px" }}>Sessions</h1>
        <p style={{ fontFamily: font.ui, fontSize: 14, color: T.inkFaint, margin: "2px 0 0" }}>
          Review your practice sessions, track your progress and keep improving.
        </p>
      </div>
      <Button
        onClick={onStartSession}
        style={{
          background: T.indigo,
          color: T.white,
          borderRadius: 8,
          padding: "12px 20px",
          height: 44,
          gap: 8,
          fontSize: 15,
          fontWeight: 600,
          boxShadow: `0px 2px 4px color-mix(in srgb, ${T.indigo} 20%, transparent)`,
        }}
      >
        <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
        Start session
      </Button>
    </div>
  );
}

/* Merges the page title + the search/filter toolbar + the primary
   CTA into one row (previously two separate bordered rows) — saves the
   height of a whole row on the Sessions screen without moving the CTA
   into the shared app-shell header, which stays identical across every
   page. Title stays a plain heading (no controls in its own box); the
   toolbar cluster is a separate flex group to its right so the two never
   visually merge into "one big control." */
function WorkspaceHeader({
  onStartSession,
  search,
  onSearchChange,
  typeOptions,
  typeFilter,
  onTypeFilterChange,
  scoreFilter,
  onScoreFilterChange,
  dateFilter,
  onDateFilterChange,
}: {
  onStartSession: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  typeOptions: string[];
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  scoreFilter: "All" | ScoreBand;
  onScoreFilterChange: (value: "All" | ScoreBand) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
}) {
  const dateOptions = useMemo(() => ["All", ...GROUP_ORDER], []);

  const suggestedFilters = useMemo(() => {
    const suggestions: Array<{ label: string; apply: () => void }> = [];
    const firstType = typeOptions.find((o) => o !== "All" && o !== typeFilter);
    if (firstType) suggestions.push({ label: `Type: ${firstType}`, apply: () => onTypeFilterChange(firstType) });
    const firstScore = SCORE_OPTIONS.find((o) => o.value !== "All" && o.value !== scoreFilter);
    if (firstScore) suggestions.push({ label: `Score: ${firstScore.label}`, apply: () => onScoreFilterChange(firstScore.value) });
    const firstDate = dateOptions.find((o) => o !== "All" && o !== dateFilter);
    if (firstDate) suggestions.push({ label: `Date: ${firstDate}`, apply: () => onDateFilterChange(firstDate) });
    return suggestions.slice(0, 4);
  }, [typeOptions, typeFilter, onTypeFilterChange, scoreFilter, onScoreFilterChange, dateOptions, dateFilter, onDateFilterChange]);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap", gap: 12 }}>
      <h1 style={{ fontFamily: font.ui, fontSize: 26, lineHeight: "32px", fontWeight: 700, color: T.coal, margin: 0, letterSpacing: "-0.01em", flexShrink: 0 }}>Sessions</h1>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "nowrap", gap: 8, justifyContent: "flex-end", minWidth: 0 }}>
        <SearchWithSuggestions
          id="sessions-search"
          label="Search sessions"
          value={search}
          onChange={onSearchChange}
          placeholder="Search sessions..."
          storageKey="hirestepx-sessions-recent-searches"
          suggestedFilters={suggestedFilters}
          style={{ flex: "1 1 200px", minWidth: 140, maxWidth: 560 }}
        />
        {/* Only this inner group scrolls horizontally on narrow viewports —
            keeping overflowX off the row above avoids clipping the search
            dropdown's absolutely-positioned panel (overflow-x: auto forces
            overflow-y to auto too, per spec, which clips it invisibly). */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto" }}>
          <FilterPill
            label="Type"
            value={typeFilter}
            options={typeOptions.map((t) => ({ value: t, label: t }))}
            onChange={onTypeFilterChange}
          />
          <FilterPill label="Score" value={scoreFilter} options={SCORE_OPTIONS} onChange={onScoreFilterChange} />
          <FilterPill
            label="Date"
            value={dateFilter}
            options={dateOptions.map((d) => ({ value: d, label: d }))}
            onChange={onDateFilterChange}
          />
          <Button size="lg" className="gap-2 px-4" onClick={onStartSession}>
            <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
            Start session
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScoreCell({ score, band }: { score: number; band: ScoreBand }) {
  const alarming = score < ALARM_SCORE;
  const dotColor = alarming ? T.error : T.inkFaint;
  const textColor = alarming ? T.error : T.inkSoft;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: font.mono, fontSize: 14, fontWeight: 500, color: T.coal, fontVariantNumeric: "tabular-nums" }}>{score}</span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: textColor }}>
        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 3, background: dotColor, flexShrink: 0 }} />
        {bandLabel[band]}
      </span>
    </div>
  );
}

// The one place color stays load-bearing: whether a session actually got
// better or worse since last time. Kept as plain colored text + a small
// arrow rather than a filled badge, so it reads as a lightweight signal
// (like a single accent) instead of another competing pill next to Score's.
function ProgressCell({ progress }: { progress: number }) {
  const { text, glyph } =
    progress > 0
      ? { text: T.successInk, glyph: "▲" }
      : progress < 0
        ? { text: T.error, glyph: "▼" }
        : { text: T.inkFaint, glyph: "" };
  const sign = progress > 0 ? "+" : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 500, color: text, display: "inline-flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" }}>
        {glyph && <span aria-hidden="true" style={{ fontSize: 9 }}>{glyph}</span>}
        {sign}{progress}
      </span>
      <span style={{ fontFamily: font.ui, fontSize: 13, color: T.inkFaint }}>vs last session</span>
    </div>
  );
}

function TakeawayCell({ points }: { points: TakeawayPoint[] }) {
  // Both takeaway lines now share one muted-gray dot instead of a green/
  // amber pair — "strength" vs. "next step" is already carried by the
  // "Next: " prefix and the (single) bolder-vs-muted text weight below, so
  // the dot no longer needs to duplicate that distinction in color.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {points.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0, background: T.inkFaintWeak }} />
          <span style={{ fontFamily: font.ui, fontSize: 13, color: p.tone === "good" ? T.coal : T.inkFaint, whiteSpace: "normal", lineHeight: 1.4 }}>
            {p.tone === "next" ? "Next: " : ""}{p.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function SessionsTable({
  rows,
  totalCount,
  filteredCount,
  sort,
  onSortChange,
  page,
  totalPages,
  rowsPerPage,
  onRowsPerPageChange,
  onPageChange,
  onClearFilters,
  onOpenSession,
}: {
  rows: FlatRow[];
  totalCount: number;
  filteredCount: number;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  page: number;
  totalPages: number;
  rowsPerPage: number;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onPageChange: (page: number) => void;
  onClearFilters: () => void;
  onOpenSession: (id: string) => void;
}) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="[&>div]:h-full [&>div]:overflow-y-auto" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Table aria-label="Practice session history" className="table-fixed">
        <TableHeader style={{ position: "sticky", top: 0, zIndex: 1 }}>
          <TableRow style={{ background: T.rowTint, height: 40 }}>
            {/* All five columns carry a % width so they scale together
                proportionally at any viewport, instead of the previous mix of
                a % title column + fixed-px Score/Progress/Date + an unset
                Takeaway absorbing the remainder — that mix let Takeaway
                balloon far past what its two-line content needed while
                Score/Progress/Date stayed cramped. minWidth still protects
                each column's content on narrower viewports (the table then
                scrolls horizontally, per the empty-state note below). */}
            <SortableHead column="title" columnLabel={COLUMN_LABEL.title} defaultDirection="asc" width="28%" minWidth={220} sort={sort} onSortChange={onSortChange}>Session</SortableHead>
            <SortableHead column="score" columnLabel={COLUMN_LABEL.score} width="14%" minWidth={150} sort={sort} onSortChange={onSortChange}>Score</SortableHead>
            <SortableHead column="progress" columnLabel={COLUMN_LABEL.progress} width="17%" minWidth={190} sort={sort} onSortChange={onSortChange}>Progress</SortableHead>
            <SortableHead column="date" columnLabel={COLUMN_LABEL.date} width="11%" minWidth={120} sort={sort} onSortChange={onSortChange}>Date</SortableHead>
            <TableHead style={{ width: "30%", minWidth: 260, padding: "0 20px", fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: T.inkSoft }}>Key Takeaway</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              {/* The row spans every (fixed-width) column, so on a viewport
                  narrower than their combined width the table scrolls
                  horizontally underneath it — without `sticky` this content,
                  centered in the full row width, sits out past the initial
                  scroll position and never becomes visible. */}
              <TableCell colSpan={5} style={{ padding: "56px 20px" }}>
                <div style={{ position: "sticky", left: 0, width: "max-content", maxWidth: "100%", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <SearchXIcon size={22} color={T.inkFaint} aria-hidden="true" />
                  <p style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: T.coal, margin: 0 }}>No sessions match your filters</p>
                  <p style={{ fontFamily: font.ui, fontSize: 13, color: T.inkFaint, margin: 0 }}>Try a different search term or clear a filter.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onClearFilters}
                    style={{ height: 36, borderRadius: 6, fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: T.inkSoft }}
                  >
                    Clear filters
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${row.title}${row.company ? ` at ${row.company}` : ""}`}
                onClick={() => onOpenSession(row.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenSession(row.id);
                  }
                }}
                className="focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                style={{ height: 64, borderBottom: `1px solid ${T.line}`, cursor: "pointer", transition: `background ${dur.instant} ${ease.snap}` }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.rowTint; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <TableCell style={{ width: "28%", minWidth: 220, height: 56, padding: "0 20px", whiteSpace: "normal" }}>
                  <p style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 500, color: T.coal, margin: 0 }}>
                    {row.title}{row.company ? ` · ${row.company}` : ""}
                  </p>
                  <p style={{ fontFamily: font.ui, fontSize: 13, color: T.inkFaint, margin: "2px 0 0" }}>
                    {row.category} · {row.questionCount} questions
                  </p>
                </TableCell>
                <TableCell style={{ width: "14%", minWidth: 150, height: 56, padding: "0 20px" }}>
                  <ScoreCell score={row.score} band={row.band} />
                </TableCell>
                <TableCell style={{ width: "17%", minWidth: 190, height: 56, padding: "0 20px" }}>
                  <ProgressCell progress={row.progress} />
                </TableCell>
                <TableCell style={{ width: "11%", minWidth: 120, height: 56, padding: "0 20px" }}>
                  <span style={{ fontFamily: font.mono, fontSize: 13, color: T.inkFaint, fontVariantNumeric: "tabular-nums" }}>{row.date}</span>
                </TableCell>
                <TableCell style={{ width: "30%", height: 56, padding: "0 20px", whiteSpace: "normal", minWidth: 260 }}>
                  <TakeawayCell points={row.takeaways} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      <TablePaginationFooter
        entityLabel="session"
        totalCount={totalCount}
        filteredCount={filteredCount}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={onRowsPerPageChange}
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

function SessionsEmptyState({ onStartSession }: { onStartSession: () => void }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: T.indigo100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MicIcon size={24} color={T.indigo} aria-hidden="true" />
        </div>
        <h2 style={{ fontFamily: font.ui, fontSize: 20, fontWeight: 700, color: T.coal, margin: 0 }}>No sessions yet</h2>
        <p style={{ fontFamily: font.ui, fontSize: 14, lineHeight: "22px", color: T.inkFaint, margin: 0 }}>
          Start your first mock interview to see your score, progress, and coaching notes here.
        </p>
        <Button
          onClick={onStartSession}
          style={{ background: T.indigo, color: T.white, fontFamily: font.ui, fontSize: 14, fontWeight: 600, gap: 8, height: 44, borderRadius: 8, transition: `background ${dur.instant} ${ease.snap}` }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.indigoDeep; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = T.indigo; }}
        >
          <PlusIcon size={16} aria-hidden="true" />
          Start session
        </Button>
      </div>
    </div>
  );
}

function SessionsLoadingSkeleton() {
  // No wrapping card here — the screen's own root card (SessionsV2Screen)
  // is the only bordered/rounded container in any data state, so loading,
  // empty, and populated all share one consistent shape.
  return (
    <div role="status" aria-label="Loading sessions" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
      <div style={{ display: "flex", gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton rounded-xl" style={{ flex: 1, height: 68, border: `1px solid ${T.line}` }} />
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2Icon size={24} color={T.indigo} className="animate-spin" aria-hidden="true" />
      </div>
    </div>
  );
}

/* Holds all interactive state for the table + toolbar, so filtering/
   sorting/pagination work end to end against the real, mapped session
   rows. */
function SessionsWorkspace({
  rows,
  onStartSession,
  onOpenSession,
}: {
  rows: FlatRow[];
  onStartSession: () => void;
  onOpenSession: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [scoreFilter, setScoreFilter] = useState<"All" | ScoreBand>("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

  // `rows` gets a new array identity each time refreshSessions() refetches
  // (tab refocus, layout remount) even when the underlying data is
  // unchanged. A user-picked sort shouldn't survive that refresh — reset
  // to the default order, but skip the initial mount so it doesn't fight
  // the useState initializer.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    setSort(DEFAULT_SORT);
  }, [rows]);

  const typeOptions = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((r) => r.category)))],
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filteredRows = rows.filter((r) => {
      if (typeFilter !== "All" && r.category !== typeFilter) return false;
      if (scoreFilter !== "All" && r.band !== scoreFilter) return false;
      if (dateFilter !== "All" && r.groupLabel !== dateFilter) return false;
      if (q && !`${r.title} ${r.category} ${r.company ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...filteredRows].sort((a, b) => compareRows(a, b, sort));
  }, [rows, search, typeFilter, scoreFilter, dateFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const page_ = Math.min(page, totalPages);
  const pageRows = filtered.slice((page_ - 1) * rowsPerPage, page_ * rowsPerPage);

  const clearFilters = () => {
    setSearch("");
    setTypeFilter("All");
    setScoreFilter("All");
    setDateFilter("All");
    setPage(1);
  };

  return (
    <>
      {/* No border/radius/background of its own — the screen's root card
          (SessionsV2Screen) is the only card in the whole hierarchy. A
          second bordered box here would double the chrome around one
          visual unit. Toolbar/Table each own an internal border only
          where they act as a real section divider (borderBottom/Top). */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <WorkspaceHeader
          onStartSession={onStartSession}
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          typeOptions={typeOptions}
          typeFilter={typeFilter}
          onTypeFilterChange={(v) => { setTypeFilter(v); setPage(1); }}
          scoreFilter={scoreFilter}
          onScoreFilterChange={(v) => { setScoreFilter(v); setPage(1); }}
          dateFilter={dateFilter}
          onDateFilterChange={(v) => { setDateFilter(v); setPage(1); }}
        />
        <SessionsTable
          rows={pageRows}
          totalCount={rows.length}
          filteredCount={filtered.length}
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          page={page_}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(1); }}
          onPageChange={setPage}
          onClearFilters={clearFilters}
          onOpenSession={onOpenSession}
        />
      </div>
    </>
  );
}

export default function SessionsV2Screen() {
  const router = useRouter();
  const { recentSessions, sessionsLoading } = useDashboardSessions();

  const rows = useMemo(() => {
    const now = Date.now();
    return recentSessions.map((d) => toRow(d, now));
  }, [recentSessions]);

  /* Routes through /session/new (SessionSetup) so the user configures
     type/role/company before starting — mirrors DashboardContext's
     handleStartSession. Pushing straight to /interview skips that
     config step; useInterviewEngine's missing-start-intent guard (no
     ?new=1) immediately bounces back to /dashboard, so the button
     would look like it silently breaks. */
  const onStartSession = () => router.push("/session/new");

  const onOpenSession = (id: string) => {
    const s = recentSessions.find((r) => r.id === id);
    captureClientEvent("dashboard_session_clicked", {
      session_id: id,
      score: s?.score,
      type: s?.type,
      surface: "sessions-table",
    });
    router.push(`/session/${id}`);
  };

  let body: React.ReactNode;
  let showPageHeader = true;
  if (sessionsLoading) {
    body = <SessionsLoadingSkeleton />;
  } else if (rows.length === 0) {
    body = <SessionsEmptyState onStartSession={onStartSession} />;
  } else {
    // WorkspaceHeader already embeds the title + CTA into its own row —
    // rendering PageHeader above it here would duplicate both.
    showPageHeader = false;
    body = <SessionsWorkspace rows={rows} onStartSession={onStartSession} onOpenSession={onOpenSession} />;
  }

  return (
    <TooltipProvider>
      <div style={{ background: T.white, display: "flex", flexDirection: "column", fontFamily: font.ui, flex: 1, minHeight: 0, borderRadius: 12, border: `1px solid ${T.line}`, overflow: "hidden" }}>
        {showPageHeader && <PageHeader onStartSession={onStartSession} />}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          {body}
        </div>
      </div>
    </TooltipProvider>
  );
}
