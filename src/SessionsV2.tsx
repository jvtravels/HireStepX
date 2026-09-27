"use client";

/* HireStepX 2.0 — Sessions screen.
   Sidebar shell, top bar, page header, KPI strip, filter/sort toolbar,
   grouped/sectioned data table, and footer pagination — wired to real
   session history via useDashboardSessions() (recentSessions,
   sessionsLoading), with search/filter/sort/pagination running against
   the mapped rows client-side. "Open report" and "Practice again" push
   real routes; "Start session" hands off to /interview. Delete-a-session
   and the richer report-detail affordances (radar/percentile) have no
   backing API yet, so those stay disabled stubs — see the comments at
   each site. */

import { Fragment, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { tokens as T, fonts as F } from "./auth/_tokens";
import { useAuth } from "./AuthContext";
import { useDashboardSessions } from "./DashboardContext";
import type { DashboardSession } from "./dashboardTypes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  LayoutDashboardIcon,
  ClipboardListIcon,
  CalendarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  GaugeIcon,
  TrophyIcon,
  FileTextIcon,
  BriefcaseIcon,
  HelpCircleIcon,
  SettingsIcon,
  SparklesIcon,
  UserCircleIcon,
  CreditCardIcon,
  BellIcon,
  MailIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  SearchXIcon,
  ArrowRightIcon,
  RotateCcwIcon,
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
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const BASE = T.creamSoft;
const font = { ui: "'Geist', 'Satoshi', system-ui, -apple-system, sans-serif", mono: F.mono };

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
  focus?: string;
  role: string;
  company?: string;
  difficulty?: string;
};

/* Flattened row used by the table's filter/sort/paginate pipeline —
   groupLabel keeps the "Today / This week / Earlier" bucket so date
   divider rows can be rebuilt after filtering. */
type FlatRow = SessionRow;

// Re-uses the app's existing status/stage tokens rather than inventing new
// literals: violet is already reserved for "interviewing-stage / in
// progress" states (see auth/_tokens.ts), which fits "developing" exactly.
const bandColor: Record<ScoreBand, { bg: string; text: string }> = {
  developing: { bg: T.violet100, text: T.violet },
  needsFocus: { bg: T.error100, text: T.error },
  good: { bg: T.success100, text: T.successInk },
};

const bandLabel: Record<ScoreBand, string> = {
  developing: "Developing",
  needsFocus: "Needs focus",
  good: "Good",
};

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
   same toHsx idiom as SessionHistoryRoute.tsx (campus-placement special
   case, empty-company guard), adapted to SessionsV2's own fields. */
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
    focus: d.focus,
    role: d.role,
    company: d.company ?? "",
    difficulty: d.difficulty,
  };
}

const SCORE_OPTIONS: { value: "All" | ScoreBand; label: string }[] = [
  { value: "All", label: "All" },
  { value: "good", label: "Good" },
  { value: "developing", label: "Developing" },
  { value: "needsFocus", label: "Needs focus" },
];

type SortColumn = "title" | "score" | "progress" | "date";
type SortDirection = "asc" | "desc";
type Sort = { column: SortColumn; direction: SortDirection };

const COLUMN_LABEL: Record<SortColumn, string> = {
  title: "Session",
  score: "Score",
  progress: "Progress",
  date: "Date",
};

/* The "Sort" pill surfaces the same (column, direction) state the column
   headers write to — one source of truth, so clicking a header and picking
   a pill option can never disagree. Named presets get a friendly label;
   anything else (e.g. sorting by Session or Progress) falls back to
   "<Column> (asc/desc)" via sortLabel() below. */
const SORT_PRESETS: { value: Sort; label: string }[] = [
  { value: { column: "date", direction: "desc" }, label: "Recent" },
  { value: { column: "date", direction: "asc" }, label: "Oldest" },
  { value: { column: "score", direction: "desc" }, label: "Highest score" },
  { value: { column: "score", direction: "asc" }, label: "Lowest score" },
];

function sortLabel(sort: Sort): string {
  const preset = SORT_PRESETS.find((p) => p.value.column === sort.column && p.value.direction === sort.direction);
  if (preset) return preset.label;
  return `${COLUMN_LABEL[sort.column]} (${sort.direction === "asc" ? "low to high" : "high to low"})`;
}

function sortKey(sort: Sort): string {
  return `${sort.column}:${sort.direction}`;
}

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

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "sessions", label: "Sessions" },
  { id: "calendar", label: "Calendar" },
  { id: "analytics", label: "Analytics" },
  { id: "resume", label: "Resume" },
  { id: "jobs", label: "Jobs" },
] as const;

function NavIcon({ id }: { id: string }) {
  switch (id) {
    case "dashboard":
      return <LayoutDashboardIcon size={18} aria-hidden="true" />;
    case "sessions":
      return <ClipboardListIcon size={18} aria-hidden="true" />;
    case "calendar":
      return <CalendarIcon size={18} aria-hidden="true" />;
    case "analytics":
      return <TrendingUpIcon size={18} aria-hidden="true" />;
    case "resume":
      return <FileTextIcon size={18} aria-hidden="true" />;
    case "jobs":
      return <BriefcaseIcon size={18} aria-hidden="true" />;
    default:
      return null;
  }
}

function AppSidebar({ name, email }: { name: string; email: string }) {
  const { logout } = useAuth();
  const initial = (name.trim()[0] || email.trim()[0] || "U").toUpperCase();

  return (
    <Sidebar collapsible="icon" className="border-none">
      <SidebarHeader className="px-3 pt-4 pb-3">
        <div className="flex items-center gap-2 overflow-hidden px-2">
          <div className="hidden shrink-0 items-center justify-center group-data-[collapsible=icon]:flex">
            <Image src="/favicon.svg" alt="HireStepX" width={28} height={28} style={{ width: 24, height: 24, borderRadius: 6 }} />
          </div>
          <Image
            src="/wordmark.png"
            alt="HireStepX"
            width={387}
            height={108}
            className="group-data-[collapsible=icon]:hidden"
            style={{ height: 22, width: "auto" }}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-1.5">
            {NAV_ITEMS.map((item) => {
              const active = item.id === "sessions";
              return (
                <SidebarMenuItem key={item.id} style={{ position: "relative" }}>
                  {active && (
                    <span
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        left: -12,
                        top: 4,
                        width: 4,
                        height: 32,
                        borderRadius: "0 4px 4px 0",
                        background: T.indigo,
                      }}
                    />
                  )}
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={item.label}
                    style={{
                      height: 40,
                      gap: 10,
                      background: active ? T.white : "transparent",
                      border: active ? `1px solid ${T.line}` : "1px solid transparent",
                      color: active ? T.indigo : T.inkFaint,
                      fontFamily: font.ui,
                      fontSize: 14,
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    <NavIcon id={item.id} />
                    <span className="truncate group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-2">
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Help & Support" style={{ height: 40, gap: 10, color: T.inkFaint, fontFamily: font.ui, fontSize: 14, fontWeight: 500 }}>
              <HelpCircleIcon size={18} aria-hidden="true" />
              <span className="truncate group-data-[collapsible=icon]:hidden">Help & Support</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings" style={{ height: 40, gap: 10, color: T.inkFaint, fontFamily: font.ui, fontSize: 14, fontWeight: 500 }}>
              <SettingsIcon size={18} aria-hidden="true" />
              <span className="truncate group-data-[collapsible=icon]:hidden">Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-transparent group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0"
              style={{ borderColor: T.line, background: T.white, cursor: "pointer" }}
            >
              <Avatar style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }}>
                <AvatarFallback style={{ borderRadius: 8, background: T.indigo, fontFamily: font.ui, fontSize: 14, fontWeight: 700, color: T.white }}>{initial}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: T.coal, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
                <p style={{ fontFamily: font.ui, fontSize: 11, color: T.inkFaint, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</p>
              </div>
              <ChevronsUpDownIcon
                className="shrink-0 group-data-[collapsible=icon]:hidden"
                size={14}
                color={T.inkFaint}
                aria-hidden="true"
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" style={{ width: 232, fontFamily: font.ui }}>
            <DropdownMenuLabel style={{ padding: "6px 8px" }}>
              <div className="flex items-center gap-2.5">
                <Avatar style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0 }}>
                  <AvatarFallback style={{ borderRadius: 8, background: T.indigo, fontFamily: font.ui, fontSize: 14, fontWeight: 700, color: T.white }}>{initial}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: T.coal, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
                  <p style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 400, color: T.inkFaint, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/* Upgrade / Account / Billing / Notifications have no target
                surface yet (no pricing/account page wired into SessionsV2)
                — left as clearly-disabled stubs, same treatment as
                ResumeV2's identical sidebar chrome. */}
            <DropdownMenuItem aria-disabled="true" title="Not wired in this preview" style={{ padding: "8px", fontSize: 13, color: T.coal }}>
              <SparklesIcon size={15} aria-hidden="true" />
              Upgrade to Pro
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem aria-disabled="true" title="Not wired in this preview" style={{ padding: "8px", fontSize: 13, color: T.coal }}>
              <UserCircleIcon size={15} aria-hidden="true" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem aria-disabled="true" title="Not wired in this preview" style={{ padding: "8px", fontSize: 13, color: T.coal }}>
              <CreditCardIcon size={15} aria-hidden="true" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem aria-disabled="true" title="Not wired in this preview" style={{ padding: "8px", fontSize: 13, color: T.coal }}>
              <BellIcon size={15} aria-hidden="true" />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { void logout(); }} style={{ padding: "8px", fontSize: 13, color: T.coal, cursor: "pointer" }}>
              <LogOutIcon size={15} aria-hidden="true" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function TopBar() {
  return (
    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", padding: "8px 16px", width: "100%" }}>
      <div
        style={{
          height: 62,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          background: T.white,
          border: `1px solid ${T.line}`,
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SidebarTrigger style={{ color: T.coal }} />
          <span style={{ fontFamily: font.ui, fontSize: 14, color: T.coal }}>Sessions</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button variant="ghost" size="icon" aria-label="Messages" aria-disabled="true" title="Not wired in this preview">
            <MailIcon size={20} aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Notifications" aria-disabled="true" title="Not wired in this preview">
            <BellIcon size={20} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ onStartSession }: { onStartSession: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
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
          boxShadow: "0px 2px 4px rgba(49,46,129,0.2)",
        }}
      >
        <PlusIcon size={16} strokeWidth={2.5} aria-hidden="true" />
        Start session
      </Button>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
  tooltip,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "positive" | "negative";
  tooltip?: string;
}) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: T.white, border: `1px solid ${T.line}`, borderRadius: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: T.creamSoft, display: "flex", alignItems: "center", justifyContent: "center", color: T.inkFaint, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontFamily: font.ui, fontSize: 12, color: T.inkFaint, margin: 0, display: "flex", alignItems: "center", gap: 4 }}>
          {label}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={tooltip} style={{ display: "inline-flex", background: "transparent", border: "none", padding: 0, cursor: "pointer", color: T.inkFaint }}>
                  <HelpCircleIcon size={12} aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </p>
        <p
          style={{
            fontFamily: font.mono,
            fontSize: 20,
            fontWeight: 700,
            color: tone === "positive" ? T.successInk : tone === "negative" ? T.error : T.coal,
            margin: "2px 0 0",
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function KpiStrip({ count, avg, best, avgDelta }: { count: number; avg: number; best: number; avgDelta: number }) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <KpiCard icon={<ClipboardListIcon size={18} aria-hidden="true" />} label="Sessions" value={String(count)} />
      <KpiCard icon={<GaugeIcon size={18} aria-hidden="true" />} label="Average score" value={String(avg)} />
      <KpiCard icon={<TrophyIcon size={18} aria-hidden="true" />} label="Best score" value={String(best)} />
      <KpiCard
        icon={avgDelta < 0 ? <TrendingDownIcon size={18} aria-hidden="true" /> : <TrendingUpIcon size={18} aria-hidden="true" />}
        label="Avg. score change"
        tooltip="Average of each session's score change vs. that same session's own previous attempt — not a trend across the sessions shown here."
        value={`${avgDelta > 0 ? "+" : ""}${avgDelta}`}
        tone={avgDelta > 0 ? "positive" : avgDelta < 0 ? "negative" : undefined}
      />
    </div>
  );
}

function FilterPill<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (value: V) => void;
}) {
  const current = options.find((o) => o.value === value);
  const display = `${label}: ${current?.label ?? value}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          style={{ borderRadius: 8, height: 44, gap: 6, background: T.white, color: value === "All" ? T.inkFaint : T.coal, fontFamily: font.ui, fontSize: 13, fontWeight: 500 }}
        >
          {display}
          <ChevronDownIcon size={12} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as V)}>
          {options.map((opt) => (
            <DropdownMenuRadioItem key={opt.value} value={opt.value}>
              {opt.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Sort pill is its own component (rather than reusing FilterPill<Sort>)
   because its value is a {column, direction} object, not a plain string,
   and its label needs the sortLabel() fallback for non-preset states
   reached via a header click (e.g. sorting by Session or Progress). */
function SortPill({ sort, onChange }: { sort: Sort; onChange: (sort: Sort) => void }) {
  const activeKey = sortKey(sort);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          style={{ borderRadius: 8, height: 44, gap: 6, background: T.white, color: T.coal, fontFamily: font.ui, fontSize: 13, fontWeight: 500 }}
        >
          {`Sort: ${sortLabel(sort)}`}
          <ChevronDownIcon size={12} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup value={activeKey} onValueChange={(v) => {
          const preset = SORT_PRESETS.find((p) => sortKey(p.value) === v);
          if (preset) onChange(preset.value);
        }}>
          {SORT_PRESETS.map((preset) => (
            <DropdownMenuRadioItem key={sortKey(preset.value)} value={sortKey(preset.value)}>
              {preset.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Toolbar({
  search,
  onSearchChange,
  typeOptions,
  typeFilter,
  onTypeFilterChange,
  scoreFilter,
  onScoreFilterChange,
  dateFilter,
  onDateFilterChange,
  sort,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  typeOptions: string[];
  typeFilter: string;
  onTypeFilterChange: (value: string) => void;
  scoreFilter: "All" | ScoreBand;
  onScoreFilterChange: (value: "All" | ScoreBand) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  sort: Sort;
  onSortChange: (value: Sort) => void;
}) {
  const dateOptions = ["All", ...GROUP_ORDER];
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${T.line}`, flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ position: "relative", width: 400 }}>
          <label htmlFor="sessions-search" className="sr-only">Search sessions</label>
          <SearchIcon
            size={14}
            color={T.inkFaint}
            aria-hidden="true"
            style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
          />
          <Input
            id="sessions-search"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{ paddingLeft: 34, height: 44, borderRadius: 8, background: T.white }}
          />
        </div>
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
      </div>
      <SortPill sort={sort} onChange={onSortChange} />
    </div>
  );
}

function ScoreCell({ score, band }: { score: number; band: ScoreBand }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: font.mono, fontSize: 14, fontWeight: 700, color: T.coal }}>{score}</span>
      <Badge
        style={{
          fontFamily: font.ui,
          fontSize: 13,
          fontWeight: 500,
          color: bandColor[band].text,
          background: bandColor[band].bg,
          height: "auto",
          padding: "3px 8px",
        }}
      >
        {bandLabel[band]}
      </Badge>
    </div>
  );
}

function ProgressCell({ progress }: { progress: number }) {
  const { bg, text } =
    progress > 0
      ? { bg: T.success100, text: T.successInk }
      : progress < 0
        ? { bg: T.error100, text: T.error }
        : { bg: T.creamSoft, text: T.inkSoft };
  const sign = progress > 0 ? "+" : "";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Badge
        style={{
          fontFamily: font.ui,
          fontSize: 13,
          fontWeight: 600,
          color: text,
          background: bg,
          height: "auto",
          padding: "3px 7px",
        }}
      >
        {sign}{progress}
      </Badge>
      <span style={{ fontFamily: font.ui, fontSize: 13, color: T.inkFaint }}>vs last session</span>
    </div>
  );
}

function TakeawayCell({ points }: { points: TakeawayPoint[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {points.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0, background: p.tone === "good" ? T.success : T.warning }} />
          <span style={{ fontFamily: font.ui, fontSize: 13, color: p.tone === "good" ? T.coal : T.inkFaint, whiteSpace: "normal", lineHeight: 1.4 }}>
            {p.tone === "next" ? "Next: " : ""}{p.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function GroupDivider({ label, count }: { label: string; count: number }) {
  return (
    <TableRow style={{ background: T.creamSoft, height: 40 }}>
      <TableCell colSpan={6} style={{ padding: "8px 16px" }}>
        <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 700, color: T.coal }}>
          {label}
        </span>{" "}
        <span style={{ fontFamily: font.ui, fontSize: 13, color: T.inkFaint }}>{count} sessions</span>
      </TableCell>
    </TableRow>
  );
}

function SortableHead({
  column,
  width,
  sort,
  onSortChange,
  children,
}: {
  column: SortColumn;
  width?: number;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  children: React.ReactNode;
}) {
  const active = sort.column === column;
  return (
    <TableHead style={{ width, borderLeft: `1px solid ${T.line}`, fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: T.inkSoft, padding: 0 }}>
      <button
        type="button"
        onClick={() => onSortChange({ column, direction: active && sort.direction === "asc" ? "desc" : active ? "asc" : column === "title" ? "asc" : "desc" })}
        aria-label={`Sort by ${COLUMN_LABEL[column]}${active ? `, currently ${sort.direction === "asc" ? "ascending" : "descending"}` : ""}`}
        style={{ display: "flex", alignItems: "center", gap: 4, width: "100%", height: 40, padding: "0 16px", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit", color: active ? T.coal : "inherit" }}
      >
        {children}
        {active ? (
          sort.direction === "asc" ? <ChevronUpIcon size={13} aria-hidden="true" /> : <ChevronDownIcon size={13} aria-hidden="true" />
        ) : (
          <ChevronsUpDownIcon size={13} color={T.inkFaint} aria-hidden="true" />
        )}
      </button>
    </TableHead>
  );
}

function SessionsTable({
  groups,
  totalCount,
  filteredCount,
  sort,
  onSortChange,
  page,
  totalPages,
  rowsPerPage,
  onRowsPerPageChange,
  onPageChange,
  onOpenReport,
  onRerun,
}: {
  groups: { label: string; rows: FlatRow[] }[];
  totalCount: number;
  filteredCount: number;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
  page: number;
  totalPages: number;
  rowsPerPage: number;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  onPageChange: (page: number) => void;
  onOpenReport: (row: FlatRow) => void;
  onRerun: (row: FlatRow) => void;
}) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
      <div className="[&>div]:h-full [&>div]:overflow-y-auto" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Table aria-label="Practice session history">
        <TableHeader style={{ position: "sticky", top: 0, zIndex: 1 }}>
          <TableRow style={{ background: T.creamSoft, height: 40 }}>
            <SortableHead column="title" width={260} sort={sort} onSortChange={onSortChange}>Session</SortableHead>
            <SortableHead column="score" width={160} sort={sort} onSortChange={onSortChange}>Score</SortableHead>
            <SortableHead column="progress" width={150} sort={sort} onSortChange={onSortChange}>Progress</SortableHead>
            <SortableHead column="date" width={150} sort={sort} onSortChange={onSortChange}>Date</SortableHead>
            <TableHead style={{ borderLeft: `1px solid ${T.line}`, fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: T.inkSoft }}>Key Takeaway</TableHead>
            <TableHead style={{ width: 190, borderLeft: `1px solid ${T.line}` }} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} style={{ padding: "56px 16px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <SearchXIcon size={22} color={T.inkFaint} aria-hidden="true" />
                  <p style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: T.coal, margin: 0 }}>No sessions match your filters</p>
                  <p style={{ fontFamily: font.ui, fontSize: 13, color: T.inkFaint, margin: 0 }}>Try a different search term or clear a filter.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            groups.map((group, groupIndex) => (
              <Fragment key={`${group.label || "flat"}-${groupIndex}`}>
                {group.label && <GroupDivider label={group.label} count={group.rows.length} />}
                {group.rows.map((row) => (
                  <TableRow key={row.id} style={{ height: 64 }}>
                    <TableCell style={{ width: 260, height: 56, whiteSpace: "normal" }}>
                      <p style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: T.coal, margin: 0 }}>{row.title}</p>
                      <p style={{ fontFamily: font.ui, fontSize: 13, color: T.inkFaint, margin: "2px 0 0" }}>
                        {row.category} · {row.questionCount} questions
                      </p>
                    </TableCell>
                    <TableCell style={{ width: 160, height: 56, borderLeft: `1px solid ${T.line}` }}>
                      <ScoreCell score={row.score} band={row.band} />
                    </TableCell>
                    <TableCell style={{ width: 150, height: 56, borderLeft: `1px solid ${T.line}` }}>
                      <ProgressCell progress={row.progress} />
                    </TableCell>
                    <TableCell style={{ width: 150, height: 56, borderLeft: `1px solid ${T.line}` }}>
                      <span style={{ fontFamily: font.ui, fontSize: 13, color: T.inkSoft }}>{row.date}</span>
                    </TableCell>
                    <TableCell style={{ height: 56, borderLeft: `1px solid ${T.line}`, whiteSpace: "normal", minWidth: 260 }}>
                      <TakeawayCell points={row.takeaways} />
                    </TableCell>
                    <TableCell style={{ width: 190, height: 56, borderLeft: `1px solid ${T.line}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Practice this again"
                          title="Practice this again"
                          onClick={() => onRerun(row)}
                          style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0 }}
                        >
                          <RotateCcwIcon size={14} aria-hidden="true" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenReport(row)}
                          style={{ width: 117, height: 44, borderRadius: 6, gap: 4, fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: T.inkSoft }}
                        >
                          Open report
                          <ArrowRightIcon size={12} aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
      </div>

      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${T.line}` }}>
        <span style={{ fontFamily: font.ui, fontSize: 13, color: T.inkFaint }}>
          {filteredCount === totalCount
            ? `${totalCount} session${totalCount === 1 ? "" : "s"} total`
            : `Showing ${filteredCount} of ${totalCount} sessions`}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: font.ui, fontSize: 13, color: T.inkFaint }}>Rows per page</span>
            <Select value={String(rowsPerPage)} onValueChange={(v) => onRowsPerPageChange(Number(v))}>
              <SelectTrigger
                size="sm"
                style={{ borderRadius: 6, fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: T.inkFaint }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <span style={{ fontFamily: font.ui, fontSize: 13, color: T.inkFaint }}>
            Page {page} of {totalPages}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(1)} aria-label="Go to first page" style={{ borderRadius: 6, width: 32, height: 32, padding: 8 }}>
              <ChevronsLeftIcon size={14} />
            </Button>
            <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Go to previous page" style={{ borderRadius: 6, width: 32, height: 32, padding: 8 }}>
              <ChevronLeftIcon size={14} />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Go to next page" style={{ borderRadius: 6, width: 32, height: 32, padding: 8 }}>
              <ChevronRightIcon size={14} />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} aria-label="Go to last page" style={{ borderRadius: 6, width: 32, height: 32, padding: 8 }}>
              <ChevronsRightIcon size={14} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionsEmptyState({ onStartSession }: { onStartSession: () => void }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: T.indigo100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MicIcon size={24} color={T.indigo} aria-hidden="true" />
        </div>
        <h2 style={{ fontFamily: font.ui, fontSize: 20, fontWeight: 700, color: T.coal, margin: 0 }}>No sessions yet</h2>
        <p style={{ fontFamily: font.ui, fontSize: 14, lineHeight: "22px", color: T.inkFaint, margin: 0 }}>
          Start your first mock interview to see your score, progress, and coaching notes here.
        </p>
        <Button
          onClick={onStartSession}
          style={{ background: T.indigo, color: T.white, fontFamily: font.ui, fontSize: 14, fontWeight: 600, gap: 8, height: 44, borderRadius: 8 }}
        >
          <PlusIcon size={16} aria-hidden="true" />
          Start session
        </Button>
      </div>
    </div>
  );
}

function SessionsLoadingSkeleton() {
  return (
    <div role="status" aria-label="Loading sessions" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, height: 68, borderRadius: 12, background: T.white, border: `1px solid ${T.line}` }} />
        ))}
      </div>
      <div style={{ flex: 1, borderRadius: 12, background: T.white, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2Icon size={24} color={T.indigo} className="animate-spin" aria-hidden="true" />
      </div>
    </div>
  );
}

/* Holds all interactive state for the table + KPI strip + toolbar, so
   filtering/sorting/pagination work end to end against the real, mapped
   session rows. */
function SessionsWorkspace({
  rows,
  onOpenReport,
  onRerun,
}: {
  rows: FlatRow[];
  onOpenReport: (row: FlatRow) => void;
  onRerun: (row: FlatRow) => void;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [scoreFilter, setScoreFilter] = useState<"All" | ScoreBand>("All");
  const [dateFilter, setDateFilter] = useState("All");
  const [sort, setSort] = useState<Sort>({ column: "date", direction: "desc" });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);

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
      if (q && !`${r.title} ${r.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...filteredRows].sort((a, b) => compareRows(a, b, sort));
  }, [rows, search, typeFilter, scoreFilter, dateFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const page_ = Math.min(page, totalPages);
  const pageRows = filtered.slice((page_ - 1) * rowsPerPage, page_ * rowsPerPage);

  /* Non-date sorts break date-bucket contiguity, so date dividers only
     render while sorting by date; otherwise the table renders as a single
     flat, undivided list. */
  const showDateGroups = sort.column === "date";
  const pageGroups = useMemo(() => {
    if (!showDateGroups) {
      return pageRows.length ? [{ label: "", rows: pageRows }] : [];
    }
    const groups: { label: string; rows: FlatRow[] }[] = [];
    for (const row of pageRows) {
      const last = groups[groups.length - 1];
      if (last && last.label === row.groupLabel) last.rows.push(row);
      else groups.push({ label: row.groupLabel, rows: [row] });
    }
    return groups;
  }, [pageRows, showDateGroups]);

  const kpis = useMemo(() => {
    const count = filtered.length;
    const avg = count ? Math.round(filtered.reduce((s, r) => s + r.score, 0) / count) : 0;
    const best = count ? Math.max(...filtered.map((r) => r.score)) : 0;
    const avgDelta = count ? Math.round(filtered.reduce((s, r) => s + r.progress, 0) / count) : 0;
    return { count, avg, best, avgDelta };
  }, [filtered]);

  return (
    <>
      <KpiStrip {...kpis} />
      <div style={{ flex: 1, minHeight: 0, background: T.white, border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Toolbar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          typeOptions={typeOptions}
          typeFilter={typeFilter}
          onTypeFilterChange={(v) => { setTypeFilter(v); setPage(1); }}
          scoreFilter={scoreFilter}
          onScoreFilterChange={(v) => { setScoreFilter(v); setPage(1); }}
          dateFilter={dateFilter}
          onDateFilterChange={(v) => { setDateFilter(v); setPage(1); }}
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
        />
        <SessionsTable
          groups={pageGroups}
          totalCount={rows.length}
          filteredCount={filtered.length}
          sort={sort}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          page={page_}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(v) => { setRowsPerPage(v); setPage(1); }}
          onPageChange={setPage}
          onOpenReport={onOpenReport}
          onRerun={onRerun}
        />
      </div>
    </>
  );
}

export default function SessionsV2Screen() {
  const router = useRouter();
  const { user } = useAuth();
  const { recentSessions, sessionsLoading } = useDashboardSessions();

  const rows = useMemo(() => {
    const now = Date.now();
    return recentSessions.map((d) => toRow(d, now));
  }, [recentSessions]);

  const name = user?.name || "Your account";
  const email = user?.email || "";

  /* Routes through /session/new (SessionSetup) so the user configures
     type/role/company before starting — mirrors DashboardContext's
     handleStartSession. Pushing straight to /interview skips that
     config step; useInterviewEngine's missing-start-intent guard (no
     ?new=1) immediately bounces back to /dashboard, so the button
     would look like it silently breaks. */
  const onStartSession = () => router.push("/session/new");
  const onOpenReport = (row: FlatRow) => router.push(`/session/${row.id}`);
  /* Mirrors SessionHistoryRoute.tsx's onRerun: build type/focus/role/
     company/difficulty params and hand off to /session/new so the user
     confirms setup instead of silently burning a credit on a misclick. */
  const onRerun = (row: FlatRow) => {
    const params = new URLSearchParams();
    if (row.focus && row.focus !== "general") {
      params.set("type", row.focus === "campus-placement" ? "behavioral" : row.focus);
      params.set("focus", row.focus);
    } else if (row.category) {
      params.set("type", row.category.toLowerCase().replace(/\s+&?\s*/g, "-").replace(/[^a-z0-9-]/g, ""));
    }
    if (row.role) params.set("role", row.role);
    if (row.company) params.set("company", row.company);
    if (row.difficulty) params.set("difficulty", row.difficulty);
    const qs = params.toString();
    router.push(qs ? `/session/new?${qs}` : "/session/new");
  };

  let body: React.ReactNode;
  if (sessionsLoading) {
    body = <SessionsLoadingSkeleton />;
  } else if (rows.length === 0) {
    body = <SessionsEmptyState onStartSession={onStartSession} />;
  } else {
    body = <SessionsWorkspace rows={rows} onOpenReport={onOpenReport} onRerun={onRerun} />;
  }

  return (
    <TooltipProvider>
      <SidebarProvider style={{ width: "100%", maxWidth: 1728, height: "100vh", background: BASE, fontFamily: font.ui }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap');`}</style>
        <AppSidebar name={name} email={email} />
        <SidebarInset style={{ background: BASE, minHeight: 0 }}>
          <TopBar />
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "0 16px 16px" }}>
            <div style={{ flex: 1, minHeight: 0, background: T.white, border: `1px solid ${T.line}`, borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <PageHeader onStartSession={onStartSession} />
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 16, padding: "0 16px 16px" }}>
                {body}
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
