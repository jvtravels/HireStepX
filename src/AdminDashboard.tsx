"use client";
import { useState, useEffect, useCallback, useRef, memo } from "react";
import Image from "next/image";
import { c, font, radius } from "./tokens";
import { EmptyState } from "./components/EmptyState";

/* ─── Token-based auth ─── */
// Token lives in a React ref (memory only). The HttpOnly admin_token cookie is
// the durable credential; the in-memory token is cached here after login / mount
// probe so subsequent API calls can send it in the x-admin-token header without
// touching localStorage or reading the HttpOnly cookie from JS (impossible by design).

/* ─── Types ─── */

interface AnomalyHighSpendUser {
  userId: string;
  tokens: number;
  zScore: number;
}

interface AnomaliesData {
  highSpendUsers: AnomalyHighSpendUser[];
  runawayCallsToday: number;
}

interface OverviewData {
  users: { total: number; today: number; thisWeek: number; activeLastWeek: number; tierBreakdown: Record<string, number>; churningThisWeek: number; conversionRate: number; paidUserCount: number };
  sessions: { total: number; today: number; thisWeek: number; avgScore: number; perDay: Record<string, number> };
  revenue: { totalPaise: number; thisMonthPaise: number; paymentCount: number };
  activation?: { signups30d: number; activatedCount: number; activationRate: number; convertedCount: number; paidConversionRate: number };
  llm: { tokensToday: number; fallbackRate: number; errorRate: number; totalCalls: number };
  cost?: {
    perSessionInr: number; todayInr: number; estimate: boolean;
    month: { totalInr: number; llmInr: number; ttsInr: number; sttInr: number; sessions: number };
  };
  anomalies?: AnomaliesData;
}

interface UserRow {
  id: string; name: string; email: string; tier: string; sessionsCount: number;
  sessionsLast7d: number; lastActive: string | null; onboarded: boolean; joined: string; subscriptionEnd: string | null;
}

interface FinancialsData {
  totalRevenuePaise: number;
  revenueThisMonthPaise: number;
  revenueLastMonthPaise: number;
  momGrowthPct: number;
  totalPayments: number;
  failedPayments: number;
  pendingPayments: number;
  successRate: number;
  avgTransactionPaise: number;
  paidUserCount: number;
  arpuPaise: number;
  estimatedMrrPaise: number;
  activeSubsCount: number;
  byPlan: Record<string, { revenue: number; count: number }>;
  perDay: Record<string, number>;
  perMonth: Record<string, number>;
  topSpenders: Array<{ userId: string; name: string; email: string; totalPaise: number; paymentCount: number; lastPayment: string }>;
  recent: Array<{ id: string; amount: number; currency: string; status: string; plan: string; date: string; userId: string }>;
  recentFailed: Array<{ id: string; amount: number; plan: string; status: string; date: string }>;
}

interface ServiceUsage {
  callsTotal: number; callsToday: number;
  errorsTotal: number; errorsToday: number;
  avgLatencyMs: number | null;
  tokensToday?: number; tokensTotal?: number;
  charsToday?: number; charsTotal?: number;
}

interface ServiceInfo {
  name: string; type: string; role: string; model: string; status: string;
  usage: ServiceUsage;
  limits: Record<string, number>;
  notes: string;
}

interface LLMData {
  totalCalls: number; totalTokens: number; todayTokens: number; fallbackRate: number; errorRate: number;
  errorBreakdown?: { rateLimit: number; contextLength: number; timeout: number; serverError: number; auth: number; safety: number; other: number };
  byEndpoint: Record<string, { calls: number; tokens: number; avgLatency: number; errors: number }>;
  byModel: Record<string, { calls: number; tokens: number }>;
  tokensPerDay: Record<string, number>;
  recentErrors: Array<{ endpoint: string; model: string; error: string | null; status?: string; date: string }>;
  services?: ServiceInfo[];
  anomalies?: AnomaliesData;
}

interface SessionsData {
  total: number; avgScore: number; avgDuration: number;
  scoreDistribution: Record<string, number>; byType: Record<string, number>;
  byDifficulty: Record<string, number>; avgSkillScores: Record<string, number>;
  recent: Array<{ id: string; userId: string; type: string; difficulty: string; focus?: string; score: number; duration: number; date: string; llmCostInr?: number | null; promptTokens?: number | null; completionTokens?: number | null; isFallback?: boolean }>;
}

interface CostData {
  totalLlmInr: number;
  avgCostPerSession: number;
  highestSessionCostInr: number;
  sessionCount: number;
  totalSessions30d: number;
  nullCostCount: number;
  dataCoveragePercent: number;
  thisWeekInr: number;
  lastWeekInr: number;
  wowDeltaPct: number | null;
  todayCostInr: number;
  dailyAvgInr: number;
  isCostSpike: boolean;
  byFocus: Record<string, { totalInr: number; sessions: number; avgInr: number }>;
  perDay: Record<string, number>;
  byEndpoint: Record<string, { estimatedInr: number; tokens: number; calls: number }>;
  topUsersByCost: Array<{ userId: string; name: string; email: string; totalLlmInr: number; sessions: number; avgInr: number }>;
  topExpensiveSessions: Array<{
    id: string; userId: string; focus: string; score: number; duration: number;
    llmCostInr: number; promptTokens: number; completionTokens: number; date: string;
  }>;
}

interface HealthAlert {
  severity: "critical" | "warning";
  code: string;
  message: string;
  action: string;
}
interface HealthData {
  alerts: HealthAlert[];
  checkedAt: string;
}

interface FeedbackData {
  total: number; byRating: Record<string, number>;
  recent: Array<{ id: string; user_id: string; rating: string; comment: string; session_score: number; session_type: string; created_at: string }>;
}

interface SupportMessagesData {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  avgResponseHours: number | null;
  avgResolutionHours: number | null;
  volumeByDay: Record<string, number>;
  recent: Array<{
    id: string; user_id: string | null; email: string | null; message: string;
    page: string | null; user_agent: string | null; status: string; created_at: string;
    type: string | null; plan_tier: string | null; session_count_30d: number | null;
    first_response_at: string | null; resolved_at: string | null;
  }>;
}

/**
 * Shape returned by /api/admin-data?userId=X. Declares the fields the
 * profile card actually reads so the render sites get real type
 * checking, plus an index signature for any extra columns we don't
 * explicitly touch (referral stats, etc.). The
 * row arrays remain `Record<string, unknown>[]` because each table
 * has a different row shape and the admin surface iterates them
 * generically — formatCell() narrows values at render time.
 *
 * Previously this was `{ profile: Record<string, any>; sessions:
 * any[]; ... }` with an eslint-disable. Now no `any` anywhere: named
 * fields are strictly typed, the rest is unknown-safe.
 */
export interface AdminProfileRow {
  id?: string;
  name?: string | null;
  email?: string;
  subscription_tier?: string | null;
  subscription_end?: string | null;
  target_role?: string | null;
  experience_level?: string | null;
  created_at?: string;
  [key: string]: unknown;
}
export interface UserDetailData {
  profile: AdminProfileRow;
  sessions: Record<string, unknown>[];
  payments: Record<string, unknown>[];
  llmUsage: Record<string, unknown>[];
  feedback: Record<string, unknown>[];
  costSummary?: {
    totalLlmCostInr: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    top3ExpensiveSessions: Array<{ id: string; type: string; date: string; llmCostInr: number | null; promptTokens: number | null; completionTokens: number | null }>;
  };
}

export interface ReferralsData {
  total: number; last30d: number; converted: number; conversionRate: number;
  kFactor?: number; activeLast30d?: number;
  topReferrers: Array<{ id: string; name: string; email: string; total: number; converted: number }>;
  recent: Array<{ id: string; referrerName: string; refereeEmail: string; status: string; rewardGranted: boolean; createdAt: string }>;
}

export interface PromoCodesData {
  total: number; active: number; expired: number; totalUses: number;
  codes: Array<{
    id: string; code: string;
    discountPct: number | null; discountAmount: number | null;
    maxUses: number | null; uses: number;
    active: boolean; appliesTo: string;
    expiresAt: string | null; createdAt: string;
  }>;
}

export interface CalendarData {
  total: number; upcoming: number; pastWeek: number;
  byType: Record<string, number>;
  recent: Array<{ id: string; userName: string; userEmail: string; type: string; company: string; date: string; time: string; reminded: boolean }>;
}

export interface OutcomesData {
  total: number; applied: number; interviewed: number; offer: number; accepted: number; offerRate: number;
  shareableTestimonials: Array<{ firstName: string; company: string; roleLanded: string; testimonial: string; reportedAt: string }>;
  recent: Array<{ name: string; applied: boolean | null; interviewed: boolean | null; offer: boolean | null; accepted: boolean | null; company: string; roleLanded: string; reportedAt: string }>;
}

export interface SessionDetailData {
  session: {
    id: string; user_id: string; date: string; type: string; difficulty: string;
    focus: string; duration: number; score: number; questions: number;
    transcript: Array<{ speaker: string; text: string; time?: string }>;
    ai_feedback: string;
    skill_scores: Record<string, unknown> | null;
    job_description?: string;
    jd_analysis?: Record<string, unknown> | null;
    report_json?: Record<string, unknown> | null;
    report_version?: string | null;
    report_generated_at?: string | null;
    created_at: string;
  } | null;
  profile: { id: string; name: string | null; email: string } | null;
  qaPairs: Array<{ question: string; answer: string; questionTime?: string; answerTime?: string }>;
  llmCalls: Array<{ endpoint: string; model: string; total_tokens: number; prompt_tokens?: number; completion_tokens?: number; is_fallback?: boolean; latency_ms: number; status: string; created_at: string }>;
  costInr?: number;
  promptTokens?: number;
  completionTokens?: number;
}

type Tab = "overview" | "users" | "sessions" | "financials" | "costs" | "llm" | "feedback" | "support-messages" | "referrals" | "promo-codes" | "calendar" | "outcomes" | "analytics" | "live";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "📊" },
  { key: "users", label: "Users", icon: "👤" },
  { key: "live", label: "Live", icon: "🟢" },
  { key: "sessions", label: "Sessions", icon: "🎯" },
  { key: "financials", label: "Financials", icon: "💰" },
  { key: "costs", label: "Cost Monitor", icon: "💸" },
  { key: "llm", label: "AI / Services", icon: "🤖" },
  { key: "analytics", label: "Analytics", icon: "📈" },
  { key: "feedback", label: "Feedback", icon: "💬" },
  { key: "support-messages", label: "Support", icon: "🛟" },
  { key: "outcomes", label: "Outcomes", icon: "🏆" },
  { key: "referrals", label: "Referrals", icon: "🔗" },
  { key: "promo-codes", label: "Promo Codes", icon: "🎟️" },
  { key: "calendar", label: "Calendar", icon: "📅" },
];

/* ─── Cache (per tab, 5 min TTL) ─── */
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry { data: unknown; ts: number }

/* ─── Helpers ─── */

function paise(amount: number): string {
  return "₹" + (amount / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function timeAgo(d: string | null): string {
  if (!d) return "Never";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

/**
 * Export an array of objects as a CSV download. Quotes cells containing
 * commas/quotes/newlines per RFC 4180. Browser-only — no-op on SSR.
 */
function exportCsv<T extends Record<string, unknown>>(filename: string, rows: T[]): void {
  if (typeof window === "undefined" || rows.length === 0) return;
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [keys.join(","), ...rows.map((r) => keys.map((k) => escape(r[k])).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ─── Styles ─── */

const card = {
  background: c.graphite,
  border: `1px solid ${c.border}`,
  borderRadius: radius.lg,
  padding: "20px 24px",
} as const;

const statCard = {
  ...card,
  flex: "1 1 200px",
  minWidth: 180,
} as const;

const labelStyle = {
  fontSize: 11,
  fontWeight: 600 as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: c.stone,
  margin: "0 0 6px",
} as const;

const bigNum = {
  fontSize: 28,
  fontWeight: 700 as const,
  color: c.ivory,
  fontFamily: font.mono,
  margin: 0,
  lineHeight: 1.2,
} as const;

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: 13,
} as const;

const thStyle = {
  textAlign: "left" as const,
  padding: "10px 12px",
  fontSize: 11,
  fontWeight: 600 as const,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: c.stone,
  borderBottom: `1px solid ${c.border}`,
} as const;

const tdStyle = {
  padding: "10px 12px",
  color: c.chalk,
  borderBottom: `1px solid ${c.borderSubtle}`,
} as const;

const exportBtn = {
  fontFamily: font.ui, fontSize: 11, fontWeight: 600,
  color: c.gilt, background: "transparent",
  border: `1px solid rgba(180,83,9,0.3)`,
  borderRadius: 6, padding: "5px 12px", cursor: "pointer",
} as const;

/* ─── Mini Bar Chart (memoized) ─── */

const MiniBarChart = memo(function MiniBarChart({ data, color = c.gilt, height = 80 }: { data: Record<string, number>; color?: string; height?: number }) {
  const entries = Object.entries(data);
  const values = entries.map(([, v]) => v);
  const max = Math.max(...values, 1);
  const barW = Math.max(4, Math.floor(100 / values.length) - 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height, width: "100%" }}>
      {entries.map(([key, v], i) => (
        <div
          key={i}
          title={`${key}: ${v.toLocaleString()}`}
          style={{
            flex: 1,
            maxWidth: barW + "%",
            height: `${Math.max(2, (v / max) * 100)}%`,
            background: color,
            borderRadius: "3px 3px 0 0",
            opacity: 0.8,
            transition: "height 0.3s ease",
          }}
        />
      ))}
    </div>
  );
});

/* ─── Tier Badge ─── */

function TierBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = { free: c.stone, starter: c.slate, pro: c.gilt, team: c.sage };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 100,
      fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
      background: `${colors[tier] || c.stone}22`, color: colors[tier] || c.stone,
      border: `1px solid ${colors[tier] || c.stone}33`,
    }}>
      {tier}
    </span>
  );
}

/* ─── Status Dot ─── */

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: ok ? c.sage : c.ember, marginRight: 6,
    }} />
  );
}

/* ─── Service Status Badge ─── */

function ServiceStatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    healthy: { bg: `${c.sage}22`, text: c.sage },
    degraded: { bg: `${c.gilt}22`, text: c.gilt },
    down: { bg: `${c.ember}22`, text: c.ember },
  };
  const col = colors[status] || colors.healthy;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 100,
      fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
      background: col.bg, color: col.text, border: `1px solid ${col.text}33`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: col.text }} />
      {status}
    </span>
  );
}

/* ─── Refresh Button ─── */

function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title="Refresh data"
      style={{
        background: "none", border: `1px solid ${c.border}`, borderRadius: radius.md,
        color: c.stone, fontSize: 12, padding: "5px 12px", cursor: loading ? "not-allowed" : "pointer",
        fontFamily: font.ui, display: "inline-flex", alignItems: "center", gap: 6,
        opacity: loading ? 0.5 : 1,
      }}
    >
      <span style={{ display: "inline-block", animation: loading ? "spin 0.8s linear infinite" : "none" }}>↻</span>
      Refresh
    </button>
  );
}

/* ─── Main Component ─── */

export default function AdminDashboard() {
  /* ── Auth state (token-based) ── */
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  // Client-side cache
  const cache = useRef<Map<string, CacheEntry>>(new Map());

  // In-memory token ref — the HttpOnly cookie is the durable credential.
  // This ref holds the rolling session token returned by admin-data responses
  // so x-admin-token header calls work without ever touching localStorage.
  const tokenRef = useRef<string | null>(null);

  function getToken(): string | null { return tokenRef.current; }
  function setToken(token: string) { tokenRef.current = token; }
  function clearToken() { tokenRef.current = null; }

  // Probe for an active session on mount using the HttpOnly cookie.
  // No localStorage read — the cookie is sent automatically via credentials:"include".
  // On success the response carries _token which we cache in memory for API calls.
  useEffect(() => {
    fetch("/api/admin-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ section: "overview" }),
    }).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        if (data._token) setToken(data._token);
        setAuthed(true);
        const { _token, ...rest } = data;
        cache.current.set("overview", { data: rest, ts: Date.now() });
      }
      setAuthLoading(false);
    }).catch(() => {
      setAuthLoading(false);
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginBusy(true);
    try {
      // POST to /api/admin-login so the server sets an HttpOnly admin_token cookie
      // (middleware gate) in addition to returning the session token for subsequent
      // x-admin-token API calls.
      const loginRes = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: loginPassword }),
      });
      if (!loginRes.ok) {
        if (loginRes.status === 429) {
          setLoginError("Too many attempts. Try again in 15 minutes.");
        } else {
          setLoginError("Wrong password");
        }
        setLoginBusy(false);
        return;
      }
      // Cookie is now set by the server. Fetch overview via cookie to get
      // the in-memory token (_token) for subsequent x-admin-token header calls.
      const overviewRes = await fetch("/api/admin-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ section: "overview" }),
      });
      if (overviewRes.ok) {
        const data = await overviewRes.json();
        if (data._token) setToken(data._token);
        const { _token, ...rest } = data;
        cache.current.set("overview", { data: rest, ts: Date.now() });
      }

      setAuthed(true);
      setLoginPassword(""); // Clear password from memory
    } catch {
      setLoginError("Connection failed. Check your network.");
    }
    setLoginBusy(false);
  };

  const handleLogout = useCallback(() => {
    setAuthed(false);
    clearToken();
    cache.current.clear();
    // Clear the HttpOnly admin_token cookie via the logout endpoint.
    fetch("/api/admin-login", { method: "DELETE", credentials: "include" }).catch(() => { /* best-effort */ });
  }, []);

  /* ── Dashboard state ── */
  // Read initial tab + userId from URL so refresh/back-button restores context
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "overview";
    const p = new URLSearchParams(window.location.search);
    const t = p.get("tab") as Tab | null;
    return (t && ["overview","users","sessions","financials","costs","llm","feedback","support-messages","referrals","promo-codes","calendar","outcomes","analytics","live"].includes(t)) ? t : "overview";
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data states
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userDetail, setUserDetail] = useState<UserDetailData | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("userId");
  });
  const [financials, setFinancials] = useState<FinancialsData | null>(null);
  const [llm, setLlm] = useState<LLMData | null>(null);
  const [sessions, setSessions] = useState<SessionsData | null>(null);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessagesData | null>(null);
  const [referrals, setReferrals] = useState<ReferralsData | null>(null);
  const [promoCodes, setPromoCodes] = useState<PromoCodesData | null>(null);
  const [calendar, setCalendar] = useState<CalendarData | null>(null);
  const [outcomes, setOutcomes] = useState<OutcomesData | null>(null);
  const [costData, setCostData] = useState<CostData | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetailData | null>(null);
  const [qaExtendTier, setQaExtendTier] = useState("pro");
  const [qaExtendDays, setQaExtendDays] = useState("30");
  const [qaGrantQty, setQaGrantQty] = useState("5");
  const [qaGrantNote, setQaGrantNote] = useState("");
  const [qaEmailSubject, setQaEmailSubject] = useState("");
  const [qaEmailBody, setQaEmailBody] = useState("");
  const [qaStatus, setQaStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [qaBusy, setQaBusy] = useState(false);
  const [qaDeleteConfirm, setQaDeleteConfirm] = useState(false);
  const [liveData, setLiveData] = useState<{ sessions: Array<{ id: string; user_id: string; type: string; difficulty: string; score: number | null; created_at: string }>; since: string } | null>(null);

  const fetchSection = useCallback(async (section: string, extra?: Record<string, unknown>, skipCache = false): Promise<unknown> => {
    if (!authed) return null;

    // Check cache (skip for user-specific or search queries)
    const cacheKey = section + (extra ? JSON.stringify(extra) : "");
    if (!skipCache) {
      const cached = cache.current.get(cacheKey);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        return cached.data;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-admin-token"] = token;

      const res = await fetch("/api/admin-data", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ section, ...extra }),
      });

      if (res.status === 401) {
        handleLogout();
        setError("Session expired. Please sign in again.");
        setLoading(false);
        return null;
      }
      if (res.status === 429) {
        setError("Rate limited. Please wait a few minutes.");
        setLoading(false);
        return null;
      }
      if (!res.ok) {
        throw new Error(`Server error (${res.status})`);
      }

      const data = await res.json();

      // Store refreshed token
      if (data._token) setToken(data._token);

      // Strip _token from data and cache
      const { _token, ...rest } = data;
      cache.current.set(cacheKey, { data: rest, ts: Date.now() });

      setLoading(false);
      return rest;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load data";
      setError(msg);
      setLoading(false);
      return null;
    }
  }, [authed, handleLogout]);

  // Load data when tab changes
  useEffect(() => {
    if (!authed) return;
    (async () => {
      switch (tab) {
        case "overview": {
          const d = await fetchSection("overview") as OverviewData | null;
          if (d) setOverview(d);
          break;
        }
        case "users": {
          const d = await fetchSection("users", { search: userSearch }) as { users: UserRow[] } | null;
          if (d) setUsers(d.users || []);
          break;
        }
        case "financials": {
          const d = await fetchSection("financials") as FinancialsData | null;
          if (d) setFinancials(d);
          break;
        }
        case "llm": {
          const d = await fetchSection("llm") as LLMData | null;
          if (d) setLlm(d);
          break;
        }
        case "sessions": {
          const d = await fetchSection("sessions") as SessionsData | null;
          if (d) setSessions(d);
          break;
        }
        case "feedback": {
          const d = await fetchSection("feedback") as FeedbackData | null;
          if (d) setFeedback(d);
          break;
        }
        case "support-messages": {
          const d = await fetchSection("support-messages") as SupportMessagesData | null;
          if (d) setSupportMessages(d);
          break;
        }
        case "referrals": {
          const d = await fetchSection("referrals") as ReferralsData | null;
          if (d) setReferrals(d);
          break;
        }
        case "promo-codes": {
          const d = await fetchSection("promo-codes") as PromoCodesData | null;
          if (d) setPromoCodes(d);
          break;
        }
        case "calendar": {
          const d = await fetchSection("calendar") as CalendarData | null;
          if (d) setCalendar(d);
          break;
        }
        case "outcomes": {
          const d = await fetchSection("outcomes") as OutcomesData | null;
          if (d) setOutcomes(d);
          break;
        }
        case "costs": {
          const d = await fetchSection("costs") as CostData | null;
          if (d) setCostData(d);
          break;
        }
        case "live": {
          const d = await fetchSection("live") as typeof liveData | null;
          if (d) setLiveData(d);
          break;
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authed]);

  // Sync tab + selectedUserId to URL so refresh/back-button restores the view
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    if (tab !== "overview") p.set("tab", tab);
    if (selectedUserId) p.set("userId", selectedUserId);
    const qs = p.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (window.location.href !== window.location.origin + next) {
      window.history.replaceState(null, "", next);
    }
  }, [tab, selectedUserId]);

  // Health alerts — load on mount + refresh every 5 minutes
  useEffect(() => {
    if (!authed) return;
    const loadHealth = async () => {
      const d = await fetchSection("health", undefined, true) as HealthData | null;
      if (d) setHealthData(d);
    };
    void loadHealth();
    const interval = setInterval(() => void loadHealth(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  // Live tab — auto-refresh every 30 seconds while on the tab
  useEffect(() => {
    if (tab !== "live" || !authed) return;
    const poll = async () => {
      const d = await fetchSection("live", undefined, true) as typeof liveData | null;
      if (d) setLiveData(d);
    };
    const interval = setInterval(() => void poll(), 30 * 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authed]);

  // Search users (debounced)
  useEffect(() => {
    if (tab !== "users" || !authed) return;
    const t = setTimeout(async () => {
      const d = await fetchSection("users", { search: userSearch }, true) as { users: UserRow[] } | null;
      if (d) setUsers(d.users || []);
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSearch]);

  // Load user detail
  useEffect(() => {
    if (!selectedUserId || !authed) return;
    setQaStatus(null);
    setQaDeleteConfirm(false);
    setQaEmailSubject("");
    setQaEmailBody("");
    (async () => {
      const d = await fetchSection("user-detail", { userId: selectedUserId }, true) as UserDetailData | null;
      if (d) setUserDetail(d);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId]);

  // Load session detail
  useEffect(() => {
    if (!selectedSessionId || !authed) return;
    (async () => {
      const d = await fetchSection("session-detail", { sessionId: selectedSessionId }, true) as SessionDetailData | null;
      if (d) setSessionDetail(d);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

  // Refresh handler for current tab
  const refreshTab = useCallback(async () => {
    switch (tab) {
      case "overview": {
        const d = await fetchSection("overview", undefined, true) as OverviewData | null;
        if (d) setOverview(d);
        break;
      }
      case "users": {
        const d = await fetchSection("users", { search: userSearch }, true) as { users: UserRow[] } | null;
        if (d) setUsers(d.users || []);
        break;
      }
      case "financials": {
        const d = await fetchSection("financials", undefined, true) as FinancialsData | null;
        if (d) setFinancials(d);
        break;
      }
      case "llm": {
        const d = await fetchSection("llm", undefined, true) as LLMData | null;
        if (d) setLlm(d);
        break;
      }
      case "sessions": {
        const d = await fetchSection("sessions", undefined, true) as SessionsData | null;
        if (d) setSessions(d);
        break;
      }
      case "feedback": {
        const d = await fetchSection("feedback", undefined, true) as FeedbackData | null;
        if (d) setFeedback(d);
        break;
      }
      case "support-messages": {
        const d = await fetchSection("support-messages", undefined, true) as SupportMessagesData | null;
        if (d) setSupportMessages(d);
        break;
      }
      case "referrals": {
        const d = await fetchSection("referrals", undefined, true) as ReferralsData | null;
        if (d) setReferrals(d);
        break;
      }
      case "promo-codes": {
        const d = await fetchSection("promo-codes", undefined, true) as PromoCodesData | null;
        if (d) setPromoCodes(d);
        break;
      }
      case "calendar": {
        const d = await fetchSection("calendar", undefined, true) as CalendarData | null;
        if (d) setCalendar(d);
        break;
      }
      case "outcomes": {
        const d = await fetchSection("outcomes", undefined, true) as OutcomesData | null;
        if (d) setOutcomes(d);
        break;
      }
      case "costs": {
        const d = await fetchSection("costs", undefined, true) as CostData | null;
        if (d) setCostData(d);
        break;
      }
      case "live": {
        const d = await fetchSection("live", undefined, true) as typeof liveData | null;
        if (d) setLiveData(d);
        break;
      }
    }
  }, [tab, fetchSection, userSearch, liveData]);

  /* ─── Render Helpers ─── */

  const renderOverview = () => {
    if (!overview) return <EmptyState title="No overview data available" />;
    const { users: u, sessions: s, revenue: r, llm: l, activation } = overview;
    const anom = overview.anomalies;
    const hasAnomalies = (anom?.highSpendUsers?.length ?? 0) > 0 || (anom?.runawayCallsToday ?? 0) > 0;

    return (
      <div>
        {/* Anomaly banner */}
        {hasAnomalies && anom && (
          <div style={{
            background: "rgba(180,83,9,0.12)",
            border: "1px solid rgba(180,83,9,0.35)",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 14, color: "#B45309", fontWeight: 700 }}>⚠ Anomalies</span>
            {anom.highSpendUsers.length > 0 && (
              <span style={{ fontSize: 13, color: "#B45309" }}>
                {anom.highSpendUsers.length} high-spend user{anom.highSpendUsers.length > 1 ? "s" : ""} (24h)
              </span>
            )}
            {anom.runawayCallsToday > 0 && (
              <span style={{ fontSize: 13, color: "#B45309" }}>
                {anom.runawayCallsToday} runaway LLM call{anom.runawayCallsToday > 1 ? "s" : ""} (&gt;8K tokens)
              </span>
            )}
            <span style={{ fontSize: 11, color: "rgba(180,83,9,0.7)", marginLeft: "auto" }}>
              See AI / Services tab for details
            </span>
          </div>
        )}

        {/* Churn warning */}
        {u.churningThisWeek > 0 && (
          <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "#F87171" }}>
            ⏰ <strong>{u.churningThisWeek} paid subscription{u.churningThisWeek > 1 ? "s" : ""}</strong> expire this week — check the Users tab (filter by tier) to reach out before they churn.
          </div>
        )}

        {/* Stat Cards */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={statCard}>
            <p style={labelStyle}>Total Users</p>
            <p style={bigNum}>{formatNum(u.total)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: c.sage }}>+{u.today} today · +{u.thisWeek} this week</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Active (7d)</p>
            <p style={bigNum}>{formatNum(u.activeLastWeek)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: c.stone }}>{u.total > 0 ? Math.round((u.activeLastWeek / u.total) * 100) : 0}% of total</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Free → Paid</p>
            <p style={{ ...bigNum, color: u.conversionRate >= 5 ? c.sage : u.conversionRate >= 2 ? c.gilt : c.ember }}>
              {u.conversionRate}%
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: c.stone }}>{u.paidUserCount} paid of {u.total} total</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Total Sessions</p>
            <p style={bigNum}>{formatNum(s.total)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: c.sage }}>+{s.today} today · +{s.thisWeek} this week</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Avg Score</p>
            <p style={bigNum}>{s.avgScore}<span style={{ fontSize: 14, color: c.stone }}>/100</span></p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Revenue (Total)</p>
            <p style={bigNum}>{paise(r.totalPaise)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: c.sage }}>{paise(r.thisMonthPaise)} this month</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>LLM Calls</p>
            <p style={bigNum}>{formatNum(l.totalCalls)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: l.errorRate > 5 ? c.ember : c.stone }}>
              {l.fallbackRate}% fallback · {l.errorRate}% errors
            </p>
          </div>
          {overview.cost && (
            <>
              <div style={statCard}>
                <p style={labelStyle}>Cost / Session</p>
                <p style={bigNum}>₹{overview.cost.perSessionInr}<span style={{ fontSize: 12, color: c.stone }}> est.</span></p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: c.stone }}>list-rate estimate · 30d</p>
              </div>
              <div style={statCard}>
                <p style={labelStyle}>AI Cost Today</p>
                <p style={bigNum}>₹{overview.cost.todayInr}<span style={{ fontSize: 12, color: c.stone }}> est.</span></p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: c.stone }}>
                  30d: ₹{overview.cost.month.totalInr} (LLM ₹{overview.cost.month.llmInr} · TTS ₹{overview.cost.month.ttsInr} · STT ₹{overview.cost.month.sttInr})
                </p>
              </div>
            </>
          )}
        </div>

        {/* Activation Funnel (30d) */}
        {activation && (
          <div style={{ ...card, marginBottom: 24 }}>
            <p style={{ ...labelStyle, marginBottom: 16 }}>Activation Funnel — Last 30 Days</p>
            <div style={{ display: "flex", alignItems: "stretch", gap: 0 }}>
              {[
                { label: "Signed Up", value: activation.signups30d, color: c.stone, pct: 100 },
                { label: "Completed ≥1 Session", value: activation.activatedCount, color: c.gilt, pct: activation.signups30d > 0 ? Math.round((activation.activatedCount / activation.signups30d) * 100) : 0 },
                { label: "Converted to Paid", value: activation.convertedCount, color: c.sage, pct: activation.signups30d > 0 ? Math.round((activation.convertedCount / activation.signups30d) * 100) : 0 },
              ].map((step, i) => (
                <div key={step.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative" }}>
                  {i > 0 && <div style={{ position: "absolute", left: -8, top: 18, fontSize: 14, color: c.stone, zIndex: 1 }}>→</div>}
                  <div style={{ fontSize: 22, fontWeight: 700, color: step.color, fontFamily: font.mono }}>{step.value}</div>
                  <div style={{ fontSize: 11, color: c.stone, textAlign: "center" }}>{step.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: step.color }}>{step.pct}%</div>
                  <div style={{ width: "80%", height: 4, background: c.onyx, borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${step.pct}%`, background: step.color, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 11, color: c.stone }}>
              Activation rate: <strong style={{ color: c.gilt }}>{activation.activationRate}%</strong> of signups started a session ·
              Paid conversion (from activated): <strong style={{ color: c.sage }}>{activation.paidConversionRate}%</strong>
            </p>
          </div>
        )}

        {/* Tier Breakdown */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ ...card, flex: 1, minWidth: 280 }}>
            <p style={{ ...labelStyle, marginBottom: 16 }}>Subscription Tiers</p>
            {Object.entries(u.tierBreakdown).length === 0
              ? <p style={{ color: c.stone, fontSize: 13 }}>No tier data</p>
              : Object.entries(u.tierBreakdown).map(([tier, count]) => (
                <div key={tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${c.borderSubtle}` }}>
                  <TierBadge tier={tier} />
                  <span style={{ fontFamily: font.mono, color: c.ivory, fontSize: 14, fontWeight: 600 }}>{count}</span>
                </div>
              ))
            }
          </div>
          <div style={{ ...card, flex: 2, minWidth: 380 }}>
            <p style={{ ...labelStyle, marginBottom: 12 }}>Sessions / Day (30d)</p>
            {Object.keys(s.perDay).length > 0
              ? <>
                  <MiniBarChart data={s.perDay} height={100} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: c.stone }}>
                    <span>{Object.keys(s.perDay)[0]}</span>
                    <span>Today</span>
                  </div>
                </>
              : <p style={{ color: c.stone, fontSize: 13 }}>No session data yet</p>
            }
          </div>
        </div>
      </div>
    );
  };

  const renderUsers = () => {
    if (selectedSessionId && sessionDetail) return renderSessionDetail();
    if (selectedUserId && userDetail) return renderUserDetail();
    return (
      <div>
        {/* Search + export */}
        <div style={{ marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 240, maxWidth: 400, padding: "10px 16px",
              background: c.onyx, border: `1px solid ${c.border}`, borderRadius: radius.md,
              color: c.ivory, fontSize: 14, fontFamily: font.ui, outline: "none",
            }}
          />
          <span style={{ fontFamily: font.ui, fontSize: 12, color: c.stone }}>
            {users.length} result{users.length === 1 ? "" : "s"}
          </span>
          <button
            onClick={() => exportCsv("users.csv", users as unknown as Record<string, unknown>[])}
            style={exportBtn}
            disabled={users.length === 0}
          >Export CSV</button>
        </div>

        {/* Table */}
        <div style={{ ...card, padding: 0, overflow: "auto" }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>User</th>
                <th style={thStyle}>Tier</th>
                <th style={thStyle}>Sessions</th>
                <th style={thStyle}>7d Sessions</th>
                <th style={thStyle}>Last Active</th>
                <th style={thStyle}>Sub Expires</th>
                <th style={thStyle}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const subExpiring = u.subscriptionEnd && u.tier !== "free"
                  ? Math.ceil((new Date(u.subscriptionEnd).getTime() - Date.now()) / 86400000)
                  : null;
                return (
                <tr
                  key={u.id}
                  onClick={() => { setSelectedUserId(u.id); setUserDetail(null); }}
                  style={{ cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = c.onyx; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 500, color: c.ivory }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: c.stone }}>{u.email}</div>
                  </td>
                  <td style={tdStyle}><TierBadge tier={u.tier} /></td>
                  <td style={{ ...tdStyle, fontFamily: font.mono }}>{u.sessionsCount}</td>
                  <td style={{ ...tdStyle, fontFamily: font.mono, color: u.sessionsLast7d === 0 && u.sessionsCount > 0 ? c.ember : u.sessionsLast7d > 0 ? c.sage : c.stone }}>
                    {u.sessionsLast7d}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{timeAgo(u.lastActive)}</td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>
                    {subExpiring != null ? (
                      <span style={{ color: subExpiring <= 3 ? c.ember : subExpiring <= 7 ? c.gilt : c.stone }}>
                        {subExpiring <= 0 ? "Expired" : `${subExpiring}d`}
                      </span>
                    ) : u.tier === "free" ? <span style={{ color: c.stone }}>—</span> : <span style={{ color: c.stone }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12 }}>{formatDate(u.joined)}</td>
                </tr>
                );
              })}
              {users.length === 0 && !loading && (
                <tr><td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: 40, color: c.stone }}>
                  {userSearch ? "No users match your search" : "No users found"}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSessionDetail = () => {
    if (!sessionDetail || !sessionDetail.session) return <EmptyState title="Session not found" />;
    const s = sessionDetail.session;
    const skillScores = s.skill_scores && typeof s.skill_scores === "object" ? s.skill_scores as Record<string, unknown> : {};
    const scoreColor = (score: number) => score >= 65 ? c.sage : score >= 40 ? c.gilt : c.ember;

    return (
      <div>
        {/* Back nav: prefer back-to-user when we got here from a user detail. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <button
            onClick={() => { setSelectedSessionId(null); setSessionDetail(null); }}
            style={{ ...exportBtn, color: c.stone, borderColor: c.border }}
          >← Back</button>
          {sessionDetail.profile && (
            <span style={{ fontFamily: font.ui, fontSize: 12, color: c.stone }}>
              Viewing session for{" "}
              <span style={{ color: c.chalk, fontWeight: 600 }}>{sessionDetail.profile.name || "(no name)"}</span>{" "}
              <span style={{ fontFamily: font.mono }}>({sessionDetail.profile.email})</span>
            </span>
          )}
        </div>

        {/* Session metadata */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "flex-start", justifyContent: "space-between" }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <p style={labelStyle}>Session ID</p>
              <p style={{ fontFamily: font.mono, fontSize: 12, color: c.chalk, margin: "2px 0 14px", wordBreak: "break-all" }}>{s.id}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontFamily: font.ui, fontSize: 13, color: c.chalk }}>
                <div><span style={{ color: c.stone }}>Type:</span> {s.type}</div>
                <div><span style={{ color: c.stone }}>Difficulty:</span> {s.difficulty}</div>
                {s.focus && <div><span style={{ color: c.stone }}>Focus:</span> {s.focus}</div>}
                <div><span style={{ color: c.stone }}>Questions:</span> {s.questions}</div>
                <div><span style={{ color: c.stone }}>Duration:</span> {s.duration ? `${Math.round(s.duration / 60)}m` : "—"}</div>
                <div><span style={{ color: c.stone }}>Date:</span> {formatDateTime(s.created_at)}</div>
                {s.report_generated_at && (
                  <div><span style={{ color: c.stone }}>Report:</span> {String(s.report_version || "—")} · {formatDateTime(s.report_generated_at)}</div>
                )}
              </div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <p style={labelStyle}>Score</p>
              <p style={{ fontFamily: font.mono, fontSize: 56, fontWeight: 700, lineHeight: 1, color: scoreColor(s.score), margin: "4px 0 0" }}>
                {s.score}<span style={{ fontSize: 18, color: c.stone, fontWeight: 400 }}>/100</span>
              </p>
              {sessionDetail.costInr != null && sessionDetail.costInr > 0 && (
                <div style={{ marginTop: 12 }}>
                  <span style={{
                    display: "inline-block",
                    background: "rgba(180,83,9,0.1)", border: "1px solid rgba(180,83,9,0.3)",
                    borderRadius: 6, padding: "4px 10px",
                    fontFamily: font.mono, fontSize: 12, color: "#B45309", fontWeight: 600,
                  }}>
                    ₹{sessionDetail.costInr.toFixed(3)} LLM
                  </span>
                  {sessionDetail.promptTokens != null && (
                    <p style={{ margin: "4px 0 0", fontSize: 10, color: c.stone }}>
                      {formatNum(sessionDetail.promptTokens)} prompt / {formatNum(sessionDetail.completionTokens ?? 0)} completion
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Skill scores */}
        {Object.keys(skillScores).length > 0 && (
          <div style={{ ...card, marginBottom: 20 }}>
            <p style={labelStyle}>Skill Breakdown</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 12 }}>
              {Object.entries(skillScores).map(([name, raw]) => {
                const score = typeof raw === "number" ? raw : (typeof raw === "object" && raw !== null && "score" in raw ? (raw as { score: number }).score : 0);
                return (
                  <div key={name}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontFamily: font.ui, fontSize: 12, color: c.chalk, textTransform: "capitalize" }}>{name}</span>
                      <span style={{ fontFamily: font.mono, fontSize: 12, fontWeight: 600, color: scoreColor(score) }}>{score}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: "rgba(14,12,8,0.05)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(0, Math.min(100, score))}%`, height: "100%", background: scoreColor(score), borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* AI feedback */}
        {s.ai_feedback && (
          <div style={{ ...card, marginBottom: 20 }}>
            <p style={labelStyle}>AI Feedback</p>
            <p style={{ fontFamily: font.ui, fontSize: 13, color: c.chalk, lineHeight: 1.65, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{s.ai_feedback}</p>
          </div>
        )}

        {/* Q&A pairs */}
        {sessionDetail.qaPairs.length > 0 ? (
          <div style={{ ...card, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={labelStyle}>Interview Transcript ({sessionDetail.qaPairs.length} Q&amp;A pair{sessionDetail.qaPairs.length === 1 ? "" : "s"})</p>
              <button
                onClick={() => exportCsv(`session-${s.id.slice(0,8)}-transcript.csv`, sessionDetail.qaPairs as unknown as Record<string, unknown>[])}
                style={exportBtn}
              >Export CSV</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {sessionDetail.qaPairs.map((qa, i) => (
                <div key={i} style={{
                  border: `1px solid ${c.borderSubtle}`, borderRadius: 10, overflow: "hidden",
                  background: "rgba(14,12,8,0.02)",
                }}>
                  {/* AI question */}
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${c.borderSubtle}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontFamily: font.ui, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                        color: c.gilt, background: "rgba(180,83,9,0.1)", padding: "2px 7px", borderRadius: 3,
                      }}>Q{i + 1} · Interviewer</span>
                      {qa.questionTime && <span style={{ fontFamily: font.mono, fontSize: 10, color: c.stone }}>{qa.questionTime}</span>}
                    </div>
                    <p style={{ fontFamily: font.ui, fontSize: 13, color: c.ivory, lineHeight: 1.6, margin: 0 }}>{qa.question}</p>
                  </div>
                  {/* Candidate answer */}
                  <div style={{ padding: "12px 16px", background: "rgba(21,128,61,0.04)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{
                        fontFamily: font.ui, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                        color: c.sage, background: "rgba(21,128,61,0.1)", padding: "2px 7px", borderRadius: 3,
                      }}>Candidate</span>
                      {qa.answerTime && <span style={{ fontFamily: font.mono, fontSize: 10, color: c.stone }}>{qa.answerTime}</span>}
                    </div>
                    <p style={{
                      fontFamily: font.ui, fontSize: 13,
                      color: qa.answer === "(no answer)" ? c.stone : c.chalk,
                      fontStyle: qa.answer === "(no answer)" ? "italic" : "normal",
                      lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap",
                    }}>{qa.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ ...card, marginBottom: 20, textAlign: "center" }}>
            <p style={{ fontFamily: font.ui, fontSize: 13, color: c.stone, margin: 0 }}>No transcript was recorded for this session.</p>
          </div>
        )}

        {/* Cached report summary, if generated */}
        {s.report_json && Object.keys(s.report_json).length > 0 && (
          <div style={{ ...card, marginBottom: 20 }}>
            <p style={labelStyle}>Cached Report (v6 evaluator)</p>
            <pre style={{
              fontFamily: font.mono, fontSize: 11, color: c.chalk, lineHeight: 1.5,
              background: c.onyx, border: `1px solid ${c.border}`, borderRadius: 8,
              padding: "12px 14px", overflow: "auto", maxHeight: 400, margin: "10px 0 0",
            }}>{JSON.stringify(s.report_json, null, 2)}</pre>
          </div>
        )}

        {/* Job description (if attached) */}
        {s.job_description && (
          <div style={{ ...card, marginBottom: 20 }}>
            <p style={labelStyle}>Job Description (used for personalization)</p>
            <p style={{ fontFamily: font.ui, fontSize: 12, color: c.chalk, lineHeight: 1.6, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{s.job_description}</p>
          </div>
        )}
      </div>
    );
  };

  const renderUserDetail = () => {
    if (!userDetail?.profile) return <EmptyState title="User not found" />;
    const p = userDetail.profile;

    return (
      <div>
        <button
          onClick={() => { setSelectedUserId(null); setUserDetail(null); }}
          style={{
            background: "none", border: "none", color: c.gilt, cursor: "pointer",
            fontSize: 13, fontFamily: font.ui, marginBottom: 16, padding: 0,
          }}
        >
          &larr; Back to users
        </button>

        {/* Profile Header */}
        <div style={{ ...card, marginBottom: 20, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: `linear-gradient(135deg, ${c.gilt}, ${c.giltDark})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 700, color: c.obsidian,
          }}>
            {(p.name || "?")[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, color: c.ivory, fontSize: 18 }}>{p.name || "—"}</h3>
            <p style={{ margin: "2px 0", color: c.stone, fontSize: 13 }}>{p.email}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <TierBadge tier={p.subscription_tier || "free"} />
              {p.target_role && <span style={{ fontSize: 12, color: c.chalk }}>Target: {p.target_role}</span>}
              {p.experience_level && <span style={{ fontSize: 12, color: c.stone }}>{p.experience_level}</span>}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 11, color: c.stone }}>Joined {formatDate(p.created_at || null)}</p>
            {p.subscription_end && <p style={{ margin: "2px 0 0", fontSize: 11, color: c.stone }}>Sub ends {formatDate(p.subscription_end)}</p>}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <div style={statCard}>
            <p style={labelStyle}>Sessions</p>
            <p style={bigNum}>{userDetail.sessions.length}</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Payments</p>
            <p style={bigNum}>{userDetail.payments.length}</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>LLM Calls</p>
            <p style={bigNum}>{userDetail.llmUsage.length}</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Feedback</p>
            <p style={bigNum}>{userDetail.feedback.length}</p>
          </div>
          {userDetail.costSummary && userDetail.costSummary.totalLlmCostInr > 0 && (
            <div style={statCard}>
              <p style={labelStyle}>Cost</p>
              <p style={{ ...bigNum, fontSize: 20 }}>
                LLM ₹{userDetail.costSummary.totalLlmCostInr.toFixed(2)}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>
                {formatNum(userDetail.costSummary.totalPromptTokens)} prompt / {formatNum(userDetail.costSummary.totalCompletionTokens)} completion tokens
              </p>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ ...card, marginBottom: 20 }}>
          <p style={{ ...labelStyle, marginBottom: 16 }}>Quick Actions</p>
          {qaStatus && (
            <div style={{
              padding: "8px 14px", borderRadius: 6, marginBottom: 14, fontSize: 13,
              background: qaStatus.ok ? "rgba(22,101,52,0.25)" : "rgba(153,27,27,0.25)",
              color: qaStatus.ok ? "rgb(74,222,128)" : "rgb(248,113,113)",
              border: `1px solid ${qaStatus.ok ? "rgba(74,222,128,0.25)" : "rgba(248,113,113,0.25)"}`,
            }}>
              {qaStatus.msg}
            </div>
          )}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {/* Extend subscription */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: c.chalk }}>Extend / Change Plan</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={qaExtendTier}
                    onChange={(e) => setQaExtendTier(e.target.value)}
                    disabled={qaBusy}
                    style={{
                      flex: 1, background: c.obsidian, color: c.ivory, border: `1px solid ${c.borderSubtle}`,
                      borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: font.ui,
                    }}
                  >
                    <option value="free">Free</option>
                    <option value="starter">Sprint Pack</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={366}
                    value={qaExtendDays}
                    onChange={(e) => setQaExtendDays(e.target.value)}
                    disabled={qaBusy}
                    placeholder="days"
                    style={{
                      width: 80, background: c.obsidian, color: c.ivory, border: `1px solid ${c.borderSubtle}`,
                      borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: font.mono,
                    }}
                  />
                </div>
                <button
                  disabled={qaBusy}
                  onClick={async () => {
                    const days = parseInt(qaExtendDays, 10);
                    if (!qaExtendTier || isNaN(days) || days < 1 || days > 366) {
                      setQaStatus({ ok: false, msg: "Enter a valid tier and days (1–366)." });
                      return;
                    }
                    setQaBusy(true);
                    setQaStatus(null);
                    try {
                      const res = await fetchSection("extend-subscription", { userId: selectedUserId, tier: qaExtendTier, days }, true);
                      const r = res as { ok?: boolean; error?: string; tier?: string; days?: number; newEnd?: string } | null;
                      if (r?.ok) {
                        setQaStatus({ ok: true, msg: `Plan updated to ${r.tier} for ${r.days}d — expires ${r.newEnd ? new Date(r.newEnd).toLocaleDateString("en-IN") : "—"}.` });
                        setUserDetail(null);
                        await fetchSection("user-detail", { userId: selectedUserId }, true).then((d) => setUserDetail(d as UserDetailData));
                      } else {
                        setQaStatus({ ok: false, msg: r?.error ?? "Supabase PATCH failed." });
                      }
                    } catch (err) {
                      setQaStatus({ ok: false, msg: String(err) });
                    } finally {
                      setQaBusy(false);
                    }
                  }}
                  style={{
                    background: c.gilt, color: c.obsidian, border: "none", borderRadius: 6,
                    padding: "7px 18px", fontSize: 13, fontWeight: 600, fontFamily: font.ui,
                    cursor: qaBusy ? "not-allowed" : "pointer", opacity: qaBusy ? 0.6 : 1,
                  }}
                >
                  {qaBusy ? "…" : "Apply Plan Change"}
                </button>
              </div>
            </div>

            {/* Grant credits */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: c.chalk }}>Grant Session Credits</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={qaGrantQty}
                    onChange={(e) => setQaGrantQty(e.target.value)}
                    disabled={qaBusy}
                    placeholder="qty"
                    style={{
                      width: 80, background: c.obsidian, color: c.ivory, border: `1px solid ${c.borderSubtle}`,
                      borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: font.mono,
                    }}
                  />
                  <input
                    type="text"
                    value={qaGrantNote}
                    onChange={(e) => setQaGrantNote(e.target.value)}
                    disabled={qaBusy}
                    placeholder="note (optional)"
                    maxLength={200}
                    style={{
                      flex: 1, background: c.obsidian, color: c.ivory, border: `1px solid ${c.borderSubtle}`,
                      borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: font.ui,
                    }}
                  />
                </div>
                <button
                  disabled={qaBusy}
                  onClick={async () => {
                    const qty = parseInt(qaGrantQty, 10);
                    if (isNaN(qty) || qty < 1 || qty > 100) {
                      setQaStatus({ ok: false, msg: "Qty must be 1–100." });
                      return;
                    }
                    setQaBusy(true);
                    setQaStatus(null);
                    try {
                      const res = await fetchSection("grant-credits", { userId: selectedUserId, qty, note: qaGrantNote || "admin grant" }, true);
                      const r = res as { ok?: boolean; error?: string; qty?: number } | null;
                      if (r?.ok) {
                        setQaStatus({ ok: true, msg: `${r.qty} session credit${(r.qty ?? 0) > 1 ? "s" : ""} granted.` });
                        setQaGrantQty("5");
                        setQaGrantNote("");
                      } else {
                        setQaStatus({ ok: false, msg: r?.error ?? "RPC call failed." });
                      }
                    } catch (err) {
                      setQaStatus({ ok: false, msg: String(err) });
                    } finally {
                      setQaBusy(false);
                    }
                  }}
                  style={{
                    background: "rgb(22,101,52)", color: "rgb(240,253,244)", border: "none", borderRadius: 6,
                    padding: "7px 18px", fontSize: 13, fontWeight: 600, fontFamily: font.ui,
                    cursor: qaBusy ? "not-allowed" : "pointer", opacity: qaBusy ? 0.6 : 1,
                  }}
                >
                  {qaBusy ? "…" : "Grant Credits"}
                </button>
              </div>
            </div>

            {/* Ban / Delete */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: c.chalk }}>Account Control</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    disabled={qaBusy}
                    onClick={async () => {
                      setQaBusy(true); setQaStatus(null);
                      try {
                        const res = await fetchSection("ban-user", { userId: selectedUserId }, true);
                        const r = res as { ok?: boolean; error?: string } | null;
                        if (r?.ok) setQaStatus({ ok: true, msg: "User banned — they cannot sign in." });
                        else setQaStatus({ ok: false, msg: r?.error ?? "Ban failed" });
                      } catch (err) { setQaStatus({ ok: false, msg: String(err) }); }
                      finally { setQaBusy(false); }
                    }}
                    style={{
                      flex: 1, background: "rgba(180,83,9,0.15)", color: "rgb(251,191,36)",
                      border: "1px solid rgba(251,191,36,0.3)", borderRadius: 6,
                      padding: "7px 10px", fontSize: 13, fontWeight: 600, fontFamily: font.ui,
                      cursor: qaBusy ? "not-allowed" : "pointer", opacity: qaBusy ? 0.6 : 1,
                    }}
                  >
                    Ban
                  </button>
                  <button
                    disabled={qaBusy}
                    onClick={async () => {
                      setQaBusy(true); setQaStatus(null);
                      try {
                        const res = await fetchSection("unban-user", { userId: selectedUserId }, true);
                        const r = res as { ok?: boolean; error?: string } | null;
                        if (r?.ok) setQaStatus({ ok: true, msg: "User unbanned — they can sign in again." });
                        else setQaStatus({ ok: false, msg: r?.error ?? "Unban failed" });
                      } catch (err) { setQaStatus({ ok: false, msg: String(err) }); }
                      finally { setQaBusy(false); }
                    }}
                    style={{
                      flex: 1, background: "rgba(22,101,52,0.15)", color: "rgb(74,222,128)",
                      border: "1px solid rgba(74,222,128,0.3)", borderRadius: 6,
                      padding: "7px 10px", fontSize: 13, fontWeight: 600, fontFamily: font.ui,
                      cursor: qaBusy ? "not-allowed" : "pointer", opacity: qaBusy ? 0.6 : 1,
                    }}
                  >
                    Unban
                  </button>
                </div>
                {!qaDeleteConfirm
                  ? (
                    <button
                      disabled={qaBusy}
                      onClick={() => setQaDeleteConfirm(true)}
                      style={{
                        background: "rgba(127,29,29,0.2)", color: "rgb(248,113,113)",
                        border: "1px solid rgba(248,113,113,0.3)", borderRadius: 6,
                        padding: "7px 10px", fontSize: 13, fontWeight: 600, fontFamily: font.ui,
                        cursor: "pointer",
                      }}
                    >
                      Delete Account
                    </button>
                  )
                  : (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        disabled={qaBusy}
                        onClick={async () => {
                          setQaBusy(true); setQaStatus(null); setQaDeleteConfirm(false);
                          try {
                            const res = await fetchSection("delete-user", { userId: selectedUserId }, true);
                            const r = res as { ok?: boolean; error?: string } | null;
                            if (r?.ok) {
                              setQaStatus({ ok: true, msg: "Account permanently deleted." });
                              setSelectedUserId(null); setUserDetail(null);
                            } else {
                              setQaStatus({ ok: false, msg: r?.error ?? "Delete failed" });
                            }
                          } catch (err) { setQaStatus({ ok: false, msg: String(err) }); }
                          finally { setQaBusy(false); }
                        }}
                        style={{
                          flex: 1, background: "rgb(127,29,29)", color: "rgb(254,202,202)",
                          border: "none", borderRadius: 6, padding: "7px 10px", fontSize: 12,
                          fontWeight: 700, fontFamily: font.ui, cursor: "pointer",
                        }}
                      >
                        Yes, permanently delete
                      </button>
                      <button
                        onClick={() => setQaDeleteConfirm(false)}
                        style={{
                          background: c.obsidian, color: c.stone, border: `1px solid ${c.borderSubtle}`,
                          borderRadius: 6, padding: "7px 10px", fontSize: 12, fontFamily: font.ui, cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )
                }
              </div>
            </div>

            {/* Send Email */}
            <div style={{ flex: "1 1 100%", minWidth: 0 }}>
              <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: c.chalk }}>Send Email to User</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  type="text"
                  value={qaEmailSubject}
                  onChange={(e) => setQaEmailSubject(e.target.value)}
                  disabled={qaBusy}
                  placeholder="Subject"
                  maxLength={200}
                  style={{
                    background: c.obsidian, color: c.ivory, border: `1px solid ${c.borderSubtle}`,
                    borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: font.ui,
                  }}
                />
                <textarea
                  value={qaEmailBody}
                  onChange={(e) => setQaEmailBody(e.target.value)}
                  disabled={qaBusy}
                  placeholder="Email body (HTML supported)"
                  rows={4}
                  maxLength={20000}
                  style={{
                    background: c.obsidian, color: c.ivory, border: `1px solid ${c.borderSubtle}`,
                    borderRadius: 6, padding: "6px 10px", fontSize: 13, fontFamily: font.ui,
                    resize: "vertical",
                  }}
                />
                <button
                  disabled={qaBusy || !qaEmailSubject.trim() || !qaEmailBody.trim()}
                  onClick={async () => {
                    setQaBusy(true); setQaStatus(null);
                    try {
                      const res = await fetchSection("send-email", {
                        userId: selectedUserId,
                        subject: qaEmailSubject.trim(),
                        htmlBody: qaEmailBody.trim(),
                      }, true);
                      const r = res as { ok?: boolean; error?: string; to?: string; emailId?: string } | null;
                      if (r?.ok) {
                        setQaStatus({ ok: true, msg: `Email sent to ${r.to} (ID: ${r.emailId})` });
                        setQaEmailSubject(""); setQaEmailBody("");
                      } else {
                        setQaStatus({ ok: false, msg: r?.error ?? "Send failed" });
                      }
                    } catch (err) { setQaStatus({ ok: false, msg: String(err) }); }
                    finally { setQaBusy(false); }
                  }}
                  style={{
                    background: c.gilt, color: c.obsidian, border: "none", borderRadius: 6,
                    padding: "7px 18px", fontSize: 13, fontWeight: 600, fontFamily: font.ui,
                    cursor: (qaBusy || !qaEmailSubject.trim() || !qaEmailBody.trim()) ? "not-allowed" : "pointer",
                    opacity: (qaBusy || !qaEmailSubject.trim() || !qaEmailBody.trim()) ? 0.5 : 1,
                    alignSelf: "flex-start",
                  }}
                >
                  {qaBusy ? "Sending…" : "Send Email"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Top expensive sessions */}
        {userDetail.costSummary && userDetail.costSummary.top3ExpensiveSessions.length > 0 && (
          <div style={{ ...card, marginBottom: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 12 }}>Top 3 Most Expensive Sessions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {userDetail.costSummary.top3ExpensiveSessions.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "8px 0", borderBottom: `1px solid ${c.borderSubtle}` }}>
                  <span style={{ fontFamily: font.mono, fontSize: 11, color: c.stone }}>{s.id.slice(0, 8)}…</span>
                  <span style={{ fontSize: 12, color: c.chalk, flex: 1 }}>{s.type || "—"}</span>
                  <span style={{ fontSize: 11, color: c.stone }}>{formatDateTime(s.date)}</span>
                  <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 600, color: c.gilt }}>₹{(s.llmCostInr || 0).toFixed(3)}</span>
                  <span style={{ fontSize: 11, color: c.stone }}>{formatNum((s.promptTokens || 0) + (s.completionTokens || 0))} tok</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sessions Table */}
        {userDetail.sessions.length > 0 && (
          <div style={{ ...card, padding: 0, marginBottom: 20, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px" }}>
              <p style={labelStyle}>Session History</p>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Difficulty</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>LLM Cost</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {userDetail.sessions.slice(0, 20).map((s: Record<string, unknown>, i: number) => (
                  <tr
                    key={i}
                    onClick={() => { setSelectedSessionId(String(s.id)); setSessionDetail(null); }}
                    style={{ cursor: "pointer", transition: "background 120ms" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(14,12,8,0.04)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    title="Click to view full session transcript"
                  >
                    <td style={tdStyle}>{String(s.type || "—")}</td>
                    <td style={tdStyle}>{String(s.difficulty || "—")}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontWeight: 600, color: (s.score as number) >= 65 ? c.sage : (s.score as number) >= 40 ? c.gilt : c.ember }}>
                      {String(s.score ?? "—")}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: font.mono }}>{s.duration ? `${Math.round(s.duration as number / 60)}m` : "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, color: s.llm_cost_inr != null ? c.gilt : c.stone }}>
                      {s.llm_cost_inr != null ? `₹${(s.llm_cost_inr as number).toFixed(3)}` : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(s.created_at as string)}</td>
                    <td style={{ ...tdStyle, color: c.gilt, fontSize: 11 }}>View →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Payments Table */}
        {userDetail.payments.length > 0 && (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px" }}>
              <p style={labelStyle}>Payment History</p>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Refund</th>
                </tr>
              </thead>
              <tbody>
                {userDetail.payments.map((p: Record<string, unknown>, i: number) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontWeight: 600 }}>{paise(p.amount as number)}</td>
                    <td style={tdStyle}>{String(p.plan || p.tier || "—")}</td>
                    <td style={tdStyle}>
                      <StatusDot ok={p.status === "captured" || p.status === "paid"} />
                      {String(p.status)}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(p.created_at as string)}</td>
                    <td style={tdStyle}>
                      {(p.razorpay_payment_id as string | undefined) && (p.status === "captured" || p.status === "paid") && (
                        <button
                          disabled={qaBusy}
                          onClick={async () => {
                            if (!window.confirm(`Refund full ₹${((p.amount as number) / 100).toFixed(0)} for payment ${p.razorpay_payment_id}?`)) return;
                            setQaBusy(true);
                            setQaStatus(null);
                            try {
                              const res = await fetchSection("refund-payment", { paymentId: p.razorpay_payment_id }, true);
                              const r = res as { ok?: boolean; error?: string; refundId?: string } | null;
                              if (r?.ok) setQaStatus({ ok: true, msg: `Refund initiated — Razorpay ID: ${r.refundId}` });
                              else setQaStatus({ ok: false, msg: r?.error ?? "Refund failed" });
                            } catch (err) { setQaStatus({ ok: false, msg: String(err) }); }
                            finally { setQaBusy(false); }
                          }}
                          style={{
                            background: "rgba(180,83,9,0.2)", color: "rgb(251,191,36)", border: "1px solid rgba(251,191,36,0.3)",
                            borderRadius: 4, padding: "3px 10px", fontSize: 11, cursor: qaBusy ? "not-allowed" : "pointer",
                          }}
                        >
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Empty states for user detail sections */}
        {userDetail.sessions.length === 0 && userDetail.payments.length === 0 && (
          <div style={{ ...card, textAlign: "center", padding: 40 }}>
            <p style={{ color: c.stone, fontSize: 13, margin: 0 }}>No sessions or payments for this user yet.</p>
          </div>
        )}
      </div>
    );
  };

  const renderFinancials = () => {
    if (!financials) return <EmptyState title="No financial data available" />;

    const totalRev = financials.totalRevenuePaise;
    const momSign = financials.momGrowthPct >= 0 ? "+" : "";
    const momColor = financials.momGrowthPct >= 0 ? c.sage : c.ember;

    // 12-month chart: convert YYYY-MM keys to short month labels
    const monthEntries = Object.entries(financials.perMonth);
    const monthMax = Math.max(...monthEntries.map(([, v]) => v), 1);
    const monthLabels = monthEntries.map(([k]) => {
      const [yr, mo] = k.split("-");
      const d = new Date(Number(yr), Number(mo) - 1, 1);
      return d.toLocaleString("en-IN", { month: "short" });
    });

    return (
      <div>
        {/* ── KPI Row ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
          <div style={statCard}>
            <p style={labelStyle}>Total Revenue</p>
            <p style={bigNum}>{paise(totalRev)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>{financials.totalPayments} successful payments</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>This Month</p>
            <p style={bigNum}>{paise(financials.revenueThisMonthPaise)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: momColor }}>
              {momSign}{financials.momGrowthPct}% vs last 30d
            </p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Last 30d</p>
            <p style={bigNum}>{paise(financials.revenueLastMonthPaise)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>prior period</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>ARPU</p>
            <p style={bigNum}>{paise(financials.arpuPaise)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>avg revenue / paid user</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Avg Transaction</p>
            <p style={bigNum}>{paise(financials.avgTransactionPaise)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>per payment</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Success Rate</p>
            <p style={{ ...bigNum, color: financials.successRate >= 90 ? c.sage : c.ember }}>
              {financials.successRate}%
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>
              {financials.failedPayments} failed · {financials.pendingPayments} pending
            </p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Paid Users</p>
            <p style={bigNum}>{financials.paidUserCount}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>lifetime unique buyers</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Est. MRR</p>
            <p style={bigNum}>{paise(financials.estimatedMrrPaise)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>{financials.activeSubsCount} active subs · list-rate est.</p>
          </div>
        </div>

        {/* ── 12-Month Revenue Chart ── */}
        <div style={{ ...card, marginBottom: 24 }}>
          <p style={{ ...labelStyle, marginBottom: 16 }}>Revenue — Last 12 Months</p>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120, marginBottom: 8 }}>
            {monthEntries.map(([key, v], i) => (
              <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                <div
                  title={`${key}: ${paise(v)}`}
                  style={{
                    width: "100%",
                    height: `${Math.max(2, (v / monthMax) * 100)}%`,
                    background: i === monthEntries.length - 1 ? c.gilt : c.sage,
                    borderRadius: "3px 3px 0 0",
                    opacity: 0.85,
                    cursor: "default",
                  }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {monthLabels.map((lbl, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: i === monthLabels.length - 1 ? c.gilt : c.stone, fontFamily: font.mono }}>
                {lbl}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: c.stone, fontFamily: font.mono }}>
            <span>Total: {paise(Object.values(financials.perMonth).reduce((a, b) => a + b, 0))}</span>
            <span style={{ color: c.gilt }}>■ current month</span>
          </div>
        </div>

        {/* ── Plan Breakdown + Daily Chart ── */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ ...card, flex: 1, minWidth: 260 }}>
            <p style={{ ...labelStyle, marginBottom: 16 }}>Revenue by Plan</p>
            {Object.keys(financials.byPlan).length === 0
              ? <p style={{ color: c.stone, fontSize: 13 }}>No plan data yet</p>
              : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "0 16px", alignItems: "center", marginBottom: 8, fontSize: 10, color: c.stone, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <span>Plan</span><span style={{ textAlign: "right" }}>Count</span><span style={{ textAlign: "right" }}>Revenue</span><span style={{ textAlign: "right" }}>% Total</span>
                  </div>
                  {Object.entries(financials.byPlan).sort(([, a], [, b]) => b.revenue - a.revenue).map(([plan, { revenue, count }]) => {
                    const pct = totalRev > 0 ? Math.round((revenue / totalRev) * 100) : 0;
                    return (
                      <div key={plan} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "0 16px", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${c.borderSubtle}` }}>
                        <span style={{ color: c.chalk, fontSize: 13 }}>{plan}</span>
                        <span style={{ fontFamily: font.mono, color: c.stone, fontSize: 12, textAlign: "right" }}>{count}</span>
                        <span style={{ fontFamily: font.mono, color: c.gilt, fontWeight: 600, fontSize: 13, textAlign: "right" }}>{paise(revenue)}</span>
                        <span style={{ fontFamily: font.mono, color: c.stone, fontSize: 12, textAlign: "right" }}>{pct}%</span>
                      </div>
                    );
                  })}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: "0 16px", alignItems: "center", padding: "8px 0", marginTop: 4 }}>
                    <span style={{ color: c.chalk, fontSize: 12, fontWeight: 600 }}>Total</span>
                    <span style={{ fontFamily: font.mono, color: c.chalk, fontSize: 12, textAlign: "right", fontWeight: 600 }}>{financials.totalPayments}</span>
                    <span style={{ fontFamily: font.mono, color: c.gilt, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{paise(totalRev)}</span>
                    <span style={{ fontFamily: font.mono, color: c.stone, fontSize: 12, textAlign: "right" }}>100%</span>
                  </div>
                </>
              )
            }
          </div>

          <div style={{ ...card, flex: 2, minWidth: 340 }}>
            <p style={{ ...labelStyle, marginBottom: 12 }}>Revenue / Day (30d)</p>
            <MiniBarChart data={financials.perDay} color={c.sage} height={100} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 10, color: c.stone }}>
              <span>{Object.keys(financials.perDay)[0]}</span>
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* ── Top Customers ── */}
        {financials.topSpenders.length > 0 && (
          <div style={{ ...card, padding: 0, overflow: "auto", marginBottom: 24 }}>
            <div style={{ padding: "16px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={labelStyle}>Top Customers</p>
              <button
                onClick={() => exportCsv("top-customers.csv", financials.topSpenders as unknown as Record<string, unknown>[])}
                style={exportBtn}
              >Export CSV</button>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Payments</th>
                  <th style={thStyle}>Total Spent</th>
                  <th style={thStyle}>Last Payment</th>
                </tr>
              </thead>
              <tbody>
                {financials.topSpenders.map((s, i) => (
                  <tr key={s.userId}>
                    <td style={{ ...tdStyle, color: c.stone, fontSize: 11, fontFamily: font.mono }}>{i + 1}</td>
                    <td style={tdStyle}>{s.name}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 12, color: c.stone }}>{s.email}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, textAlign: "right" }}>{s.paymentCount}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontWeight: 700, color: c.gilt }}>{paise(s.totalPaise)}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(s.lastPayment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── All Payments ── */}
        {financials.recent.length > 0 ? (
          <div style={{ ...card, padding: 0, overflow: "auto", marginBottom: 24 }}>
            <div style={{ padding: "16px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={labelStyle}>All Payments (last 50)</p>
              <button
                onClick={() => exportCsv("payments.csv", financials.recent as unknown as Record<string, unknown>[])}
                style={exportBtn}
              >Export CSV</button>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>User ID</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {financials.recent.map((p, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontWeight: 600, color: c.gilt }}>{paise(p.amount)}</td>
                    <td style={tdStyle}>{p.plan}</td>
                    <td style={tdStyle}><StatusDot ok={p.status === "captured" || p.status === "paid" || p.status === "success"} />{p.status}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 11, color: c.stone }}>{p.userId?.slice(0, 8) || "—"}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(p.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No payments recorded yet" />
        )}

        {/* ── Failed / Pending ── */}
        {financials.recentFailed.length > 0 && (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px" }}>
              <p style={{ ...labelStyle, color: c.ember }}>Failed &amp; Cancelled Payments ({financials.failedPayments})</p>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {financials.recentFailed.map((p, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontFamily: font.mono }}>{paise(p.amount)}</td>
                    <td style={tdStyle}>{p.plan}</td>
                    <td style={{ ...tdStyle, color: c.ember }}>{p.status}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(p.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  /** Compute "used today" / "daily limit" for a service and return progress bar data */
  function getUsageBar(svc: ServiceInfo): { usedToday: number; limit: number; label: string; unit: string } | null {
    const lim = svc.limits;
    // LLMs: requests per day
    if (lim.requestsPerDay) {
      return { usedToday: svc.usage.callsToday, limit: lim.requestsPerDay, label: "Requests", unit: "req" };
    }
    // Resend: emails per day
    if (lim.freeEmailsPerDay) {
      return { usedToday: svc.usage.callsToday, limit: lim.freeEmailsPerDay, label: "Emails", unit: "emails" };
    }
    // Sarvam: requests per day
    if (lim.freeRequestsPerDay) {
      return { usedToday: svc.usage.callsToday, limit: lim.freeRequestsPerDay, label: "Requests", unit: "req" };
    }
    // Upstash: commands per day
    if (lim.freeCommandsPerDay) {
      return { usedToday: svc.usage.callsToday, limit: lim.freeCommandsPerDay, label: "Commands", unit: "cmds" };
    }
    // Azure TTS: chars per month (show daily estimate)
    if (lim.freeCharsPerMonth) {
      const dailyBudget = Math.round(lim.freeCharsPerMonth / 30);
      return { usedToday: svc.usage.charsToday || 0, limit: dailyBudget, label: "Chars", unit: "chars" };
    }
    return null;
  }

  const renderServices = () => {
    if (!llm?.services || llm.services.length === 0) return null;

    const typeOrder = ["LLM", "TTS", "STT", "Email", "Cache / Rate Limiting"];
    const grouped: Record<string, ServiceInfo[]> = {};
    for (const s of llm.services) {
      if (!grouped[s.type]) grouped[s.type] = [];
      grouped[s.type].push(s);
    }

    return (
      <div style={{ marginBottom: 24 }}>
        <p style={{ ...labelStyle, fontSize: 13, marginBottom: 20, color: c.ivory }}>Service Health &amp; Usage</p>

        {typeOrder.filter(t => grouped[t]).map(type => (
          <div key={type} style={{ marginBottom: 20 }}>
            <p style={{ ...labelStyle, marginBottom: 12, color: c.gilt }}>{type}</p>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {grouped[type].map(svc => {
                const bar = getUsageBar(svc);
                const pct = bar ? Math.min(100, (bar.usedToday / bar.limit) * 100) : 0;
                const barColor = pct > 90 ? c.ember : pct > 70 ? c.gilt : c.sage;

                return (
                <div key={svc.name} style={{ ...card, flex: "1 1 320px", minWidth: 300, maxWidth: 520 }}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 15, fontWeight: 600, color: c.ivory }}>{svc.name}</span>
                        <span style={{
                          fontSize: 9, padding: "2px 7px", borderRadius: 100,
                          background: svc.role === "Primary" ? `${c.sage}22` : `${c.stone}18`,
                          color: svc.role === "Primary" ? c.sage : c.stone,
                          fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                        }}>{svc.role}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: c.stone, fontFamily: font.mono }}>{svc.model}</p>
                    </div>
                    <ServiceStatusBadge status={svc.status} />
                  </div>

                  {/* Usage Today / Available Today bar */}
                  {bar && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: c.chalk }}>
                          <span style={{ fontFamily: font.mono, fontWeight: 600, color: c.ivory }}>{formatNum(bar.usedToday)}</span>
                          <span style={{ color: c.stone }}> / {formatNum(bar.limit)} {bar.unit} today</span>
                        </span>
                        <span style={{ fontSize: 11, fontFamily: font.mono, color: barColor, fontWeight: 600 }}>
                          {formatNum(Math.max(0, bar.limit - bar.usedToday))} left
                        </span>
                      </div>
                      <div style={{ height: 8, background: c.onyx, borderRadius: 4, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${pct}%`, background: barColor, borderRadius: 4,
                          transition: "width 0.3s ease", minWidth: bar.usedToday > 0 ? 4 : 0,
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Usage metrics grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <div>
                      <p style={{ ...labelStyle, fontSize: 9 }}>Total Calls</p>
                      <p style={{ margin: 0, fontFamily: font.mono, color: c.ivory, fontSize: 14, fontWeight: 600 }}>{formatNum(svc.usage.callsTotal)}</p>
                    </div>
                    <div>
                      <p style={{ ...labelStyle, fontSize: 9 }}>Today</p>
                      <p style={{ margin: 0, fontFamily: font.mono, color: c.ivory, fontSize: 14, fontWeight: 600 }}>{formatNum(svc.usage.callsToday)}</p>
                    </div>
                    <div>
                      <p style={{ ...labelStyle, fontSize: 9 }}>Errors</p>
                      <p style={{ margin: 0, fontFamily: font.mono, color: svc.usage.errorsToday > 0 ? c.ember : c.stone, fontSize: 14, fontWeight: 600 }}>
                        {svc.usage.errorsToday}
                        {svc.usage.errorsTotal > 0 && <span style={{ fontSize: 10, color: c.stone }}> ({svc.usage.errorsTotal})</span>}
                      </p>
                    </div>
                    {svc.usage.tokensToday != null && svc.usage.tokensToday > 0 && (
                      <div>
                        <p style={{ ...labelStyle, fontSize: 9 }}>Tokens Today</p>
                        <p style={{ margin: 0, fontFamily: font.mono, color: c.ivory, fontSize: 14, fontWeight: 600 }}>{formatNum(svc.usage.tokensToday)}</p>
                      </div>
                    )}
                    {svc.usage.charsToday != null && svc.usage.charsToday > 0 && (
                      <div>
                        <p style={{ ...labelStyle, fontSize: 9 }}>Chars Today</p>
                        <p style={{ margin: 0, fontFamily: font.mono, color: c.ivory, fontSize: 14, fontWeight: 600 }}>{formatNum(svc.usage.charsToday)}</p>
                      </div>
                    )}
                    {svc.usage.avgLatencyMs != null && svc.usage.avgLatencyMs > 0 && (
                      <div>
                        <p style={{ ...labelStyle, fontSize: 9 }}>Avg Latency</p>
                        <p style={{ margin: 0, fontFamily: font.mono, color: c.ivory, fontSize: 14, fontWeight: 600 }}>{svc.usage.avgLatencyMs}ms</p>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <p style={{ margin: 0, fontSize: 11, color: c.stone, lineHeight: 1.5 }}>{svc.notes}</p>
                </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderLLM = () => {
    if (!llm) return <EmptyState title="No AI/LLM data available" />;

    return (
      <div>
        {/* Services section at top */}
        {renderServices()}

        {/* Divider */}
        {llm.services && llm.services.length > 0 && (
          <div style={{ borderBottom: `1px solid ${c.border}`, marginBottom: 24 }} />
        )}

        <p style={{ ...labelStyle, fontSize: 13, marginBottom: 16, color: c.ivory }}>LLM Usage Analytics</p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={statCard}>
            <p style={labelStyle}>Total API Calls</p>
            <p style={bigNum}>{formatNum(llm.totalCalls)}</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Total Tokens</p>
            <p style={bigNum}>{formatNum(llm.totalTokens)}</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Today Tokens</p>
            <p style={bigNum}>{formatNum(llm.todayTokens)}</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Fallback Rate</p>
            <p style={{ ...bigNum, color: llm.fallbackRate > 10 ? c.ember : c.sage }}>{llm.fallbackRate}%</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Error Rate</p>
            <p style={{ ...bigNum, color: llm.errorRate > 5 ? c.ember : c.sage }}>{llm.errorRate}%</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {/* By Endpoint */}
          <div style={{ ...card, flex: 1, minWidth: 300 }}>
            <p style={{ ...labelStyle, marginBottom: 16 }}>By Endpoint</p>
            {Object.keys(llm.byEndpoint).length === 0
              ? <p style={{ color: c.stone, fontSize: 13 }}>No endpoint data</p>
              : <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Endpoint</th>
                      <th style={thStyle}>Calls</th>
                      <th style={thStyle}>Tokens</th>
                      <th style={thStyle}>Avg Latency</th>
                      <th style={thStyle}>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(llm.byEndpoint).sort(([, a], [, b]) => b.calls - a.calls).map(([ep, d]) => (
                      <tr key={ep}>
                        <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 12 }}>{ep}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono }}>{d.calls}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono }}>{formatNum(d.tokens)}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono }}>{d.avgLatency}ms</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono, color: d.errors > 0 ? c.ember : c.stone }}>{d.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>

          {/* By Model */}
          <div style={{ ...card, flex: 0.6, minWidth: 220 }}>
            <p style={{ ...labelStyle, marginBottom: 16 }}>By Model</p>
            {Object.keys(llm.byModel).length === 0
              ? <p style={{ color: c.stone, fontSize: 13 }}>No model data</p>
              : Object.entries(llm.byModel).sort(([, a], [, b]) => b.calls - a.calls).map(([model, d]) => (
                <div key={model} style={{ padding: "8px 0", borderBottom: `1px solid ${c.borderSubtle}` }}>
                  <div style={{ fontFamily: font.mono, fontSize: 12, color: c.ivory, marginBottom: 2 }}>{model}</div>
                  <div style={{ fontSize: 11, color: c.stone }}>{d.calls} calls · {formatNum(d.tokens)} tokens</div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Tokens chart */}
        <div style={{ ...card, marginBottom: 24 }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>Tokens / Day (30d)</p>
          <MiniBarChart data={llm.tokensPerDay} color={c.slate} height={100} />
        </div>

        {/* Error breakdown — explains *why* calls fail beyond just "errored" */}
        {llm.errorBreakdown && Object.values(llm.errorBreakdown).some(n => n > 0) && (
          <div style={{ ...card, marginBottom: 24 }}>
            <p style={{ ...labelStyle, color: c.ember, marginBottom: 12 }}>Error Breakdown</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              {([
                ["Rate limit (RPM/TPM)", llm.errorBreakdown.rateLimit],
                ["Context length", llm.errorBreakdown.contextLength],
                ["Timeout", llm.errorBreakdown.timeout],
                ["Provider 5xx", llm.errorBreakdown.serverError],
                ["Auth/key", llm.errorBreakdown.auth],
                ["Safety block", llm.errorBreakdown.safety],
                ["Other", llm.errorBreakdown.other],
              ] as const).map(([label, n]) => (
                <div key={label} style={{ padding: "10px 12px", background: c.onyx, borderRadius: 6, border: `1px solid ${c.borderSubtle}` }}>
                  <p style={{ margin: 0, fontSize: 10, color: c.stone, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</p>
                  <p style={{ margin: "4px 0 0", fontFamily: font.mono, fontSize: 18, fontWeight: 600, color: n > 0 ? c.ember : c.stone }}>{n}</p>
                </div>
              ))}
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 11, color: c.stone, lineHeight: 1.5 }}>
              Counts come from the most recent {formatNum(llm.totalCalls)} llm_usage rows. If "Rate limit" or "Context length" dominate, daily token quota isn't the bottleneck — per-minute caps or oversized prompts are.
            </p>
          </div>
        )}

        {/* Recent errors */}
        {llm.recentErrors.length > 0 && (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px" }}>
              <p style={{ ...labelStyle, color: c.ember }}>Recent Errors</p>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Endpoint</th>
                  <th style={thStyle}>Model</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Error</th>
                  <th style={thStyle}>Time</th>
                </tr>
              </thead>
              <tbody>
                {llm.recentErrors.map((e, i) => (
                  <tr key={i}>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 12, verticalAlign: "top" as const }}>{e.endpoint}</td>
                    <td style={{ ...tdStyle, fontSize: 12, verticalAlign: "top" as const }}>{e.model}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 11, color: c.ember, verticalAlign: "top" as const }}>{e.status || "error"}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: c.ember, fontFamily: font.mono, whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const, maxWidth: 520, lineHeight: 1.5 }}>{e.error || "—"}</td>
                    <td style={{ ...tdStyle, fontSize: 12, verticalAlign: "top" as const, whiteSpace: "nowrap" as const }}>{formatDateTime(e.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Anomalies subsection */}
        {llm.anomalies && ((llm.anomalies.highSpendUsers.length > 0) || llm.anomalies.runawayCallsToday > 0) && (
          <div style={{ ...card, marginTop: 24, border: "1px solid rgba(180,83,9,0.35)", background: "rgba(180,83,9,0.06)" }}>
            <p style={{ ...labelStyle, color: "#B45309", marginBottom: 16 }}>⚠ Anomalies (last 24h)</p>
            {llm.anomalies.runawayCallsToday > 0 && (
              <div style={{ marginBottom: 12, fontSize: 13, color: "#B45309" }}>
                <strong>{llm.anomalies.runawayCallsToday}</strong> runaway LLM call{llm.anomalies.runawayCallsToday > 1 ? "s" : ""} with &gt;8,000 tokens each
              </div>
            )}
            {llm.anomalies.highSpendUsers.length > 0 && (
              <div style={{ overflow: "auto" }}>
                <p style={{ ...labelStyle, marginBottom: 8 }}>High-spend users (24h)</p>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>User ID</th>
                      <th style={thStyle}>Tokens (24h)</th>
                      <th style={thStyle}>Z-Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {llm.anomalies.highSpendUsers.map((u, i) => (
                      <tr key={i}>
                        <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 11 }}>{u.userId.slice(0, 16)}…</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono, color: "#B45309", fontWeight: 600 }}>{formatNum(u.tokens)}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono }}>{u.zScore > 0 ? `+${u.zScore.toFixed(1)}σ` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCosts = () => {
    if (!costData) return <EmptyState title="No cost data available" />;
    const cd = costData;

    const focusLabel = (f: string) => f.replace(/-/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());

    // Gross margin per session = revenue/session (rough monthly estimate) - LLM cost/session
    // thisMonthPaise / 100 → INR; divide by total sessions as a proxy (month sessions not available on overview)
    const thisMonthRevInr = overview?.revenue ? overview.revenue.thisMonthPaise / 100 : 0;
    const paidRevPerSession = (thisMonthRevInr > 0 && cd.totalSessions30d > 0)
      ? Math.round((thisMonthRevInr / cd.totalSessions30d) * 100) / 100
      : null;
    const grossMarginPerSession = paidRevPerSession != null
      ? Math.round((paidRevPerSession - cd.avgCostPerSession) * 100) / 100
      : null;

    const wowBadge = cd.wowDeltaPct != null
      ? (cd.wowDeltaPct > 0
          ? <span style={{ fontSize: 11, color: c.ember, marginLeft: 6 }}>▲ {cd.wowDeltaPct}% WoW</span>
          : <span style={{ fontSize: 11, color: c.sage, marginLeft: 6 }}>▼ {Math.abs(cd.wowDeltaPct)}% WoW</span>)
      : null;

    return (
      <div>
        {/* Data quality banner */}
        {cd.dataCoveragePercent < 70 && (
          <div style={{ background: "rgba(180,83,9,0.08)", border: "1px solid rgba(180,83,9,0.25)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: c.ember }}>
            ⚠️ Cost data coverage is only {cd.dataCoveragePercent}% ({cd.nullCostCount} of {cd.totalSessions30d} sessions missing
            <code style={{ fontFamily: font.mono, marginLeft: 4 }}>llm_cost_inr</code>). Averages below are computed only on sessions
            that have data — actual per-session cost may be higher. Check <code style={{ fontFamily: font.mono }}>save-session.ts</code> fire-and-forget PATCH for silent failures.
          </div>
        )}

        {/* Cost spike warning */}
        {cd.isCostSpike && (
          <div style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 12, color: "#DC2626" }}>
            🚨 Cost spike today: ₹{cd.todayCostInr.toFixed(2)} vs ₹{cd.dailyAvgInr.toFixed(2)} daily avg (30d). Verify for anomalous session volume or runaway prompts.
          </div>
        )}

        {/* Headline unit economics */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={statCard}>
            <p style={labelStyle}>Avg Cost / Session</p>
            <p style={bigNum}>₹{cd.avgCostPerSession.toFixed(2)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>
              LLM only · {cd.dataCoveragePercent}% coverage · {cd.sessionCount}/{cd.totalSessions30d} sessions
            </p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Total LLM Cost (30d)</p>
            <p style={bigNum}>₹{cd.totalLlmInr.toFixed(2)}{wowBadge}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>
              This week ₹{cd.thisWeekInr.toFixed(2)} · Prior ₹{cd.lastWeekInr.toFixed(2)}
            </p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Most Expensive Session</p>
            <p style={{ ...bigNum, color: cd.highestSessionCostInr > 2 ? c.ember : c.gilt }}>₹{cd.highestSessionCostInr.toFixed(3)}</p>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>Today ₹{cd.todayCostInr.toFixed(2)} · Avg/day ₹{cd.dailyAvgInr.toFixed(2)}</p>
          </div>
          {grossMarginPerSession != null && (
            <div style={statCard}>
              <p style={labelStyle}>Gross Margin / Session</p>
              <p style={{ ...bigNum, color: grossMarginPerSession >= 0 ? c.sage : c.ember }}>
                {grossMarginPerSession >= 0 ? "+" : ""}₹{grossMarginPerSession.toFixed(2)}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>
                Revenue ₹{paidRevPerSession!.toFixed(2)} − LLM ₹{cd.avgCostPerSession.toFixed(2)}
              </p>
            </div>
          )}
          {overview?.cost && (
            <div style={statCard}>
              <p style={labelStyle}>Voice Cost (30d)</p>
              <p style={{ ...bigNum, fontSize: 20 }}>₹{(overview.cost.month.ttsInr + overview.cost.month.sttInr).toFixed(2)}</p>
              <p style={{ margin: "4px 0 0", fontSize: 11, color: c.stone }}>TTS ₹{overview.cost.month.ttsInr} · STT ₹{overview.cost.month.sttInr}</p>
            </div>
          )}
        </div>

        {/* Daily cost trend */}
        <div style={{ ...card, marginBottom: 24 }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>LLM Cost / Day — ₹ (30d)</p>
          <MiniBarChart data={cd.perDay} color="#B45309" height={100} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: c.stone }}>
            <span>{Object.keys(cd.perDay)[0]}</span>
            <span>Today</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {/* Cost by focus */}
          <div style={{ ...card, flex: 1, minWidth: 280 }}>
            <p style={{ ...labelStyle, marginBottom: 16 }}>Cost by Interview Focus (30d)</p>
            {Object.keys(cd.byFocus).length === 0
              ? <p style={{ color: c.stone, fontSize: 13 }}>No data yet</p>
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
                        <td style={{ ...tdStyle, fontSize: 12 }}>{focusLabel(focus)}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono }}>{d.sessions}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono, color: c.gilt }}>₹{d.totalInr.toFixed(2)}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono, color: d.avgInr > 1 ? c.ember : c.sage }}>₹{d.avgInr.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>

          {/* Cost by endpoint */}
          <div style={{ ...card, flex: 1, minWidth: 280 }}>
            <p style={{ ...labelStyle, marginBottom: 16 }}>Estimated Cost by API Endpoint (30d)</p>
            {Object.keys(cd.byEndpoint).length === 0
              ? <p style={{ color: c.stone, fontSize: 13 }}>No data yet</p>
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
                        <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 11 }}>{ep}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono }}>{d.calls}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono }}>{formatNum(d.tokens)}</td>
                        <td style={{ ...tdStyle, fontFamily: font.mono, color: c.gilt }}>₹{d.estimatedInr.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            }
          </div>
        </div>

        {/* Top users by LLM spend */}
        {cd.topUsersByCost.length > 0 && (
          <div style={{ ...card, marginBottom: 24 }}>
            <p style={{ ...labelStyle, marginBottom: 16 }}>Top 5 Users by LLM Spend (30d)</p>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Sessions</th>
                  <th style={thStyle}>Total ₹</th>
                  <th style={thStyle}>Avg ₹</th>
                </tr>
              </thead>
              <tbody>
                {cd.topUsersByCost.map((u) => (
                  <tr
                    key={u.userId}
                    onClick={() => { setSelectedUserId(u.userId); setUserDetail(null); }}
                    style={{ cursor: "pointer", transition: "background 120ms" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(180,83,9,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ ...tdStyle, fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ color: c.stone, fontSize: 10 }}>{u.email}</div>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: font.mono }}>{u.sessions}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, color: c.gilt, fontWeight: 700 }}>₹{u.totalLlmInr.toFixed(2)}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, color: u.avgInr > 1 ? c.ember : "inherit" }}>₹{u.avgInr.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top expensive sessions */}
        {cd.topExpensiveSessions.length > 0 && (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={labelStyle}>Top 30 Most Expensive Sessions (all-time)</p>
              <button
                onClick={() => exportCsv("expensive-sessions.csv", cd.topExpensiveSessions)}
                style={{ fontSize: 11, color: c.gilt, background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
              >
                Export CSV
              </button>
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
                    onClick={() => { setSelectedSessionId(s.id); setSessionDetail(null); }}
                    style={{ cursor: "pointer", transition: "background 120ms" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(180,83,9,0.06)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 11 }}>{s.id.slice(0, 8)}…</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{focusLabel(s.focus)}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, color: s.score >= 65 ? c.sage : s.score >= 40 ? c.gilt : c.ember }}>{s.score}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono }}>{s.duration ? `${Math.round(s.duration / 60)}m` : "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono }}>{formatNum(s.promptTokens)}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono }}>{formatNum(s.completionTokens)}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontWeight: 700, color: s.llmCostInr > 1.5 ? c.ember : c.gilt }}>
                      ₹{s.llmCostInr.toFixed(3)}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(s.date)}</td>
                    <td style={{ ...tdStyle, color: c.gilt, fontSize: 11 }}>View →</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ marginTop: 16, fontSize: 11, color: c.stone }}>
          LLM costs: list-rate estimates (Groq Llama 70B ~$0.70/M tok, Gemini Flash ~$0.30/M tok · 1 USD = ₹84).
          Voice costs (TTS/STT) are aggregate rate-card estimates with no per-session breakdown.
          Reconcile against actual Groq/Azure/Deepgram invoices before any pricing decision.
        </p>
      </div>
    );
  };

  const renderSessions = () => {
    if (!sessions) return <EmptyState title="No session data available" />;

    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={statCard}>
            <p style={labelStyle}>Total Sessions</p>
            <p style={bigNum}>{formatNum(sessions.total)}</p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Avg Score</p>
            <p style={bigNum}>{sessions.avgScore}<span style={{ fontSize: 14, color: c.stone }}>/100</span></p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Avg Duration</p>
            <p style={bigNum}>{Math.round(sessions.avgDuration / 60)}<span style={{ fontSize: 14, color: c.stone }}>min</span></p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {/* Score Distribution */}
          <div style={{ ...card, flex: 1, minWidth: 280 }}>
            <p style={{ ...labelStyle, marginBottom: 16 }}>Score Distribution</p>
            {Object.entries(sessions.scoreDistribution).map(([range, count]) => (
              <div key={range} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ width: 50, fontSize: 11, color: c.stone, fontFamily: font.mono }}>{range}</span>
                <div style={{ flex: 1, height: 12, background: c.onyx, borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${sessions.total > 0 ? (count / sessions.total) * 100 : 0}%`, background: c.gilt, borderRadius: 6, minWidth: count > 0 ? 4 : 0 }} />
                </div>
                <span style={{ width: 30, fontSize: 11, color: c.stone, fontFamily: font.mono, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </div>

          {/* By Type + Difficulty */}
          <div style={{ ...card, flex: 0.6, minWidth: 220 }}>
            <p style={{ ...labelStyle, marginBottom: 16 }}>By Type</p>
            {Object.keys(sessions.byType).length === 0
              ? <p style={{ color: c.stone, fontSize: 13 }}>No type data</p>
              : Object.entries(sessions.byType).sort(([, a], [, b]) => b - a).map(([type, count]) => (
                <div key={type} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${c.borderSubtle}` }}>
                  <span style={{ color: c.chalk, fontSize: 13 }}>{type}</span>
                  <span style={{ fontFamily: font.mono, color: c.ivory, fontSize: 13 }}>{count}</span>
                </div>
              ))
            }
            <p style={{ ...labelStyle, marginTop: 20, marginBottom: 12 }}>By Difficulty</p>
            {Object.keys(sessions.byDifficulty).length === 0
              ? <p style={{ color: c.stone, fontSize: 13 }}>No difficulty data</p>
              : Object.entries(sessions.byDifficulty).sort(([, a], [, b]) => b - a).map(([diff, count]) => (
                <div key={diff} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${c.borderSubtle}` }}>
                  <span style={{ color: c.chalk, fontSize: 13 }}>{diff}</span>
                  <span style={{ fontFamily: font.mono, color: c.ivory, fontSize: 13 }}>{count}</span>
                </div>
              ))
            }
          </div>

          {/* Avg Skill Scores */}
          {Object.keys(sessions.avgSkillScores).length > 0 && (
            <div style={{ ...card, flex: 0.8, minWidth: 250 }}>
              <p style={{ ...labelStyle, marginBottom: 16 }}>Avg Skill Scores (All Users)</p>
              {Object.entries(sessions.avgSkillScores).sort(([, a], [, b]) => b - a).map(([skill, score]) => (
                <div key={skill} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ flex: 1, fontSize: 12, color: c.chalk }}>{skill}</span>
                  <div style={{ width: 80, height: 8, background: c.onyx, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${score}%`, background: score >= 65 ? c.sage : score >= 40 ? c.gilt : c.ember, borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 28, fontSize: 11, fontFamily: font.mono, color: c.stone, textAlign: "right" }}>{score}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent sessions */}
        {sessions.recent.length > 0 ? (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px" }}>
              <p style={labelStyle}>Recent Sessions</p>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Difficulty</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>LLM Cost</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {sessions.recent.map((s, i) => (
                  <tr key={i}
                    onClick={() => { setSelectedSessionId(s.id); setSessionDetail(null); setTab("sessions"); }}
                    style={{ cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = c.onyx; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <td style={tdStyle}>
                      {s.type}
                      {s.isFallback && (
                        <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(124,110,230,0.2)", color: "#a5b4fc", fontWeight: 700 }}>FALLBACK</span>
                      )}
                      {(s.score === 0 || s.score == null) && (
                        <span style={{ marginLeft: 6, fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "rgba(239,68,68,0.15)", color: c.ember, fontWeight: 700 }}>FAILED</span>
                      )}
                    </td>
                    <td style={tdStyle}>{s.difficulty}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontWeight: 600, color: s.score >= 65 ? c.sage : s.score >= 40 ? c.gilt : c.ember }}>{s.score ?? "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono }}>{s.duration ? `${Math.round(s.duration / 60)}m` : "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, color: s.llmCostInr != null ? c.gilt : c.stone }}>
                      {s.llmCostInr != null ? `₹${s.llmCostInr.toFixed(3)}` : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(s.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No sessions recorded yet" />
        )}
      </div>
    );
  };

  const renderFeedback = () => {
    if (!feedback) return <EmptyState title="No feedback data available" />;

    const ratingColors: Record<string, string> = {
      helpful: c.sage, too_harsh: c.ember, too_generous: c.gilt, inaccurate: c.ember,
    };

    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={statCard}>
            <p style={labelStyle}>Total Feedback</p>
            <p style={bigNum}>{feedback.total}</p>
          </div>
          {Object.entries(feedback.byRating).map(([rating, count]) => (
            <div key={rating} style={statCard}>
              <p style={labelStyle}>{rating.replace(/_/g, " ")}</p>
              <p style={{ ...bigNum, color: ratingColors[rating] || c.ivory }}>{count}</p>
            </div>
          ))}
        </div>

        {feedback.recent.length > 0 ? (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px" }}>
              <p style={labelStyle}>Recent Feedback</p>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Rating</th>
                  <th style={thStyle}>Comment</th>
                  <th style={thStyle}>Session Type</th>
                  <th style={thStyle}>Score</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {feedback.recent.map((f, i) => (
                  <tr key={i}
                    onClick={() => { if (f.user_id) { setSelectedUserId(f.user_id); setUserDetail(null); setTab("users"); } }}
                    style={{ cursor: f.user_id ? "pointer" : "default", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (f.user_id) (e.currentTarget as HTMLElement).style.background = c.onyx; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    title={f.user_id ? "Click to view user" : ""}
                  >
                    <td style={{ ...tdStyle, color: ratingColors[f.rating] || c.chalk }}>{f.rating?.replace(/_/g, " ")}</td>
                    <td style={{ ...tdStyle, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{f.comment || "—"}</td>
                    <td style={tdStyle}>{f.session_type || "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono }}>{f.session_score ?? "—"}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(f.created_at)}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: c.gilt }}>{f.user_id ? "View user →" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No feedback received yet" />
        )}
      </div>
    );
  };

  const renderSupportMessages = () => {
    if (!supportMessages) return <EmptyState title="No support messages available" />;

    const statusColors: Record<string, string> = {
      new: c.gilt, seen: c.stone, resolved: c.sage,
    };
    const statusBg: Record<string, string> = {
      new: "rgba(180,83,9,0.12)", seen: "rgba(100,100,100,0.12)", resolved: "rgba(21,128,61,0.12)",
    };
    const typeColors: Record<string, string> = {
      bug: c.ember, feature: "#7c6ee6", billing: c.gilt, other: c.stone,
    };
    const typeBg: Record<string, string> = {
      bug: "rgba(239,68,68,0.12)", feature: "rgba(124,110,230,0.12)",
      billing: "rgba(180,83,9,0.12)", other: "rgba(100,100,100,0.12)",
    };

    const updateStatus = async (id: string, status: "seen" | "resolved") => {
      const token = getToken();
      const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (token) reqHeaders["x-admin-token"] = token;
      try {
        const res = await fetch("/api/admin-data", {
          method: "POST",
          headers: reqHeaders,
          credentials: "include",
          body: JSON.stringify({ action: "update-support-status", id, status }),
        });
        if (res.ok) {
          const data = await res.json() as { _token?: string };
          if (data._token) setToken(data._token);
          const d = await fetchSection("support-messages", undefined, true) as SupportMessagesData | null;
          if (d) setSupportMessages(d);
        }
      } catch { /* best-effort */ }
    };

    const formatHours = (h: number | null) => {
      if (h === null) return "—";
      if (h < 1) return `${Math.round(h * 60)}m`;
      return `${h}h`;
    };

    const last14Days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86_400_000);
      return d.toISOString().slice(0, 10);
    });
    const maxVol = Math.max(1, ...last14Days.map(d => supportMessages.volumeByDay[d] || 0));

    return (
      <div>
        {/* KPI row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={statCard}>
            <p style={labelStyle}>Total</p>
            <p style={bigNum}>{supportMessages.total}</p>
          </div>
          {Object.entries(supportMessages.byStatus).map(([st, count]) => (
            <div key={st} style={statCard}>
              <p style={labelStyle}>{st.charAt(0).toUpperCase() + st.slice(1)}</p>
              <p style={{ ...bigNum, color: statusColors[st] || c.ivory }}>{count}</p>
            </div>
          ))}
          <div style={statCard}>
            <p style={labelStyle}>Avg First Response</p>
            <p style={{ ...bigNum, color: supportMessages.avgResponseHours !== null && supportMessages.avgResponseHours < 24 ? c.sage : c.ivory }}>
              {formatHours(supportMessages.avgResponseHours)}
            </p>
          </div>
          <div style={statCard}>
            <p style={labelStyle}>Avg Resolution</p>
            <p style={bigNum}>{formatHours(supportMessages.avgResolutionHours)}</p>
          </div>
        </div>

        {/* Analytics row: by-type + volume sparkline */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ ...card, flex: "1 1 200px", minWidth: 200 }}>
            <p style={{ ...labelStyle, marginBottom: 12 }}>By Type</p>
            {Object.entries(supportMessages.byType).length > 0
              ? Object.entries(supportMessages.byType).map(([t, count]) => (
                  <div key={t} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 10,
                      fontSize: 11, fontWeight: 600, fontFamily: font.ui,
                      background: typeBg[t] || typeBg.other, color: typeColors[t] || c.stone,
                    }}>{t}</span>
                    <span style={{ fontFamily: font.mono, fontSize: 13, color: c.ivory }}>{count}</span>
                  </div>
                ))
              : <p style={{ fontFamily: font.ui, fontSize: 12, color: c.stone }}>No data yet</p>
            }
          </div>
          <div style={{ ...card, flex: "1 1 320px" }}>
            <p style={{ ...labelStyle, marginBottom: 12 }}>Volume — Last 14 Days</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 48 }}>
              {last14Days.map(day => {
                const v = supportMessages.volumeByDay[day] || 0;
                const pct = (v / maxVol) * 100;
                return (
                  <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column" as const, alignItems: "center" }}>
                    <div
                      title={`${day}: ${v}`}
                      style={{
                        width: "100%", borderRadius: "3px 3px 0 0",
                        background: v > 0 ? c.gilt : c.border,
                        height: `${Math.max(pct, 4)}%`,
                        minHeight: v > 0 ? 6 : 3,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontFamily: font.mono, fontSize: 10, color: c.stone }}>{last14Days[0]?.slice(5)}</span>
              <span style={{ fontFamily: font.mono, fontSize: 10, color: c.stone }}>{last14Days[13]?.slice(5)}</span>
            </div>
          </div>
        </div>

        {/* Message table */}
        {supportMessages.recent.length > 0 ? (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={labelStyle}>Messages — Help &amp; Support widget</p>
              <button onClick={() => exportCsv("support-messages.csv", supportMessages.recent)} style={exportBtn}>Export CSV</button>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Context</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Message</th>
                  <th style={thStyle}>Page</th>
                  <th style={thStyle}>SLA</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {supportMessages.recent.map((m) => {
                  const st = m.status || "new";
                  const tp = m.type || "other";
                  const responseMs = m.first_response_at
                    ? new Date(m.first_response_at).getTime() - new Date(m.created_at).getTime()
                    : null;
                  const responseHr = responseMs !== null ? responseMs / 3_600_000 : null;
                  return (
                    <tr key={m.id}>
                      <td style={{ ...tdStyle, fontSize: 12, whiteSpace: "nowrap" as const }}>{formatDateTime(m.created_at)}</td>
                      <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 12 }}>
                        {m.email
                          ? <a href={`mailto:${m.email}?subject=Re: Your HireStepX support message`} style={{ color: c.gilt, textDecoration: "none" }} title="Reply via email">{m.email}</a>
                          : "—"}
                      </td>
                      <td style={{ ...tdStyle, fontSize: 11, whiteSpace: "nowrap" as const }}>
                        {m.plan_tier ? (
                          <span style={{
                            display: "inline-block", padding: "1px 6px", borderRadius: 8,
                            fontSize: 10, fontWeight: 600, fontFamily: font.ui,
                            background: m.plan_tier === "pro" ? "rgba(49,46,129,0.2)" : "rgba(100,100,100,0.12)",
                            color: m.plan_tier === "pro" ? "#a5b4fc" : c.stone,
                            marginRight: 4,
                          }}>{m.plan_tier}</span>
                        ) : null}
                        {m.session_count_30d !== null && m.session_count_30d !== undefined
                          ? <span style={{ color: c.stone, fontSize: 11 }}>{m.session_count_30d}s</span>
                          : null}
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-block", padding: "2px 7px", borderRadius: 10,
                          fontSize: 11, fontWeight: 600, fontFamily: font.ui,
                          background: typeBg[tp] || typeBg.other, color: typeColors[tp] || c.stone,
                        }}>{tp}</span>
                      </td>
                      <td style={tdStyle}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 10,
                          fontSize: 11, fontWeight: 600, fontFamily: font.ui,
                          background: statusBg[st] || "rgba(100,100,100,0.12)",
                          color: statusColors[st] || c.stone,
                        }}>{st}</span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 400, whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const }}>{m.message || "—"}</td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>{m.page || "—"}</td>
                      <td style={{ ...tdStyle, fontSize: 11, whiteSpace: "nowrap" as const }}>
                        {responseHr !== null
                          ? <span style={{ color: responseHr < 24 ? c.sage : c.ember }}>{formatHours(Math.round(responseHr * 10) / 10)}</span>
                          : (() => {
                              const ageHr = (Date.now() - new Date(m.created_at).getTime()) / 3_600_000;
                              return st === "new"
                                ? <span style={{ color: ageHr > 48 ? c.ember : c.gilt, fontWeight: ageHr > 48 ? 700 : 400 }}>
                                    {ageHr > 48 ? "⚠ overdue" : "pending"}
                                  </span>
                                : <span>—</span>;
                            })()}
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" as const }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {st === "new" && (
                            <button
                              onClick={() => updateStatus(m.id, "seen")}
                              style={{
                                padding: "3px 8px", borderRadius: 6, border: `1px solid ${c.border}`,
                                background: "#1a1a1a", color: c.stone,
                                fontSize: 11, fontFamily: font.ui, cursor: "pointer",
                              }}
                            >Mark seen</button>
                          )}
                          {(st === "new" || st === "seen") && (
                            <button
                              onClick={() => updateStatus(m.id, "resolved")}
                              style={{
                                padding: "3px 8px", borderRadius: 6, border: "1px solid rgba(21,128,61,0.3)",
                                background: "#1a1a1a", color: c.sage,
                                fontSize: 11, fontFamily: font.ui, cursor: "pointer",
                              }}
                            >Resolve</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No support messages yet" />
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (error) {
      return (
        <div style={{ ...card, textAlign: "center", padding: 60 }}>
          <p style={{ fontSize: 18, color: c.ember, margin: "0 0 8px" }}>
            {error.includes("expired") ? "Session Expired" : error.includes("Rate") ? "Rate Limited" : "Error"}
          </p>
          <p style={{ color: c.stone, fontSize: 14, margin: 0 }}>{error}</p>
          {error.includes("expired") && (
            <button
              onClick={() => { setError(null); handleLogout(); }}
              style={{
                marginTop: 16, padding: "8px 20px",
                background: `linear-gradient(135deg, ${c.gilt}, ${c.giltDark})`,
                border: "none", borderRadius: radius.md, color: c.obsidian,
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font.ui,
              }}
            >
              Sign In Again
            </button>
          )}
        </div>
      );
    }
    if (loading) {
      return (
        <div style={{ ...card, textAlign: "center", padding: 60 }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${c.border}`, borderTopColor: c.gilt, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: c.stone, fontSize: 14, margin: 0 }}>Loading {tab}...</p>
        </div>
      );
    }
    switch (tab) {
      case "overview": return renderOverview();
      case "users": return renderUsers();
      case "financials": return renderFinancials();
      case "llm": return renderLLM();
      case "sessions": return renderSessions();
      case "feedback": return renderFeedback();
      case "support-messages": return renderSupportMessages();
      case "referrals": return renderReferrals();
      case "promo-codes": return renderPromoCodes();
      case "calendar": return renderCalendar();
      case "outcomes": return renderOutcomes();
      case "costs": return renderCosts();
      case "analytics": return renderAnalytics();
      case "live": return renderLive();
    }
  };

  const renderLive = () => {
    const sessions = liveData?.sessions ?? [];
    const since = liveData?.since ? new Date(liveData.since).toLocaleTimeString("en-IN") : "—";
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: c.ivory, fontSize: 18 }}>Live — Last 30 Minutes</h3>
          <span style={{ fontSize: 12, color: c.stone }}>Since {since} · auto-refreshes every 30s</span>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgb(74,222,128)", boxShadow: "0 0 6px rgb(74,222,128)" }} />
        </div>
        {sessions.length === 0
          ? <EmptyState title="No sessions in the last 30 minutes" />
          : (
            <div style={{ ...card, padding: 0, overflow: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Session ID</th>
                    <th style={thStyle}>User ID</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Difficulty</th>
                    <th style={thStyle}>Score</th>
                    <th style={thStyle}>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr
                      key={s.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => { setSelectedSessionId(s.id); setSessionDetail(null); }}
                    >
                      <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 11 }}>{s.id.slice(0, 8)}…</td>
                      <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 11 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedUserId(s.user_id); setUserDetail(null); setTab("users"); }}
                          style={{ background: "none", border: "none", color: c.gilt, cursor: "pointer", fontSize: 11, fontFamily: font.mono, padding: 0 }}
                        >
                          {s.user_id.slice(0, 8)}…
                        </button>
                      </td>
                      <td style={tdStyle}>{s.type || "—"}</td>
                      <td style={tdStyle}>{s.difficulty || "—"}</td>
                      <td style={tdStyle}>{s.score != null ? s.score : <span style={{ color: c.stone }}>in progress</span>}</td>
                      <td style={{ ...tdStyle, fontSize: 11, color: c.stone }}>{new Date(s.created_at).toLocaleTimeString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>
    );
  };

  const renderAnalytics = () => {
    const tools = [
      {
        name: "PostHog",
        desc: "Pageviews, blog funnel, session recordings, user behavior",
        color: "#F54E00",
        links: [
          { label: "Dashboard", url: "https://us.posthog.com/project/370211/dashboard" },
          { label: "Funnels", url: "https://us.posthog.com/project/370211/insights/new?insight=FUNNELS" },
          { label: "Live events", url: "https://us.posthog.com/project/370211/activity/explore" },
          { label: "Recordings", url: "https://us.posthog.com/project/370211/replay" },
          { label: "Persons", url: "https://us.posthog.com/project/370211/persons" },
          { label: "Feature flags", url: "https://us.posthog.com/project/370211/feature_flags" },
        ],
      },
      {
        name: "Google Analytics 4",
        desc: "Traffic sources, geography, pages, acquisition channels",
        color: "#E37400",
        links: [
          { label: "Realtime", url: "https://analytics.google.com/analytics/web/#/p" + "476946071" + "/realtime/overview" },
          { label: "Acquisition", url: "https://analytics.google.com/analytics/web/#/p476946071/reports/explorer?params=_u..nav%3Dmaui%26_r.explorerCard..selmet%3D%5B%22sessions%22%5D%26_r.explorerCard..seldim%3D%5B%22sessionDefaultChannelGroup%22%5D&r=acquisition-traffic-acquisition&ruid=acquisition-traffic-acquisition,life-cycle,acquisition" },
          { label: "Pages", url: "https://analytics.google.com/analytics/web/#/p476946071/reports/explorer?params=_u..nav%3Dmaui&r=all-pages-and-screens&ruid=all-pages-and-screens,life-cycle,engagement" },
          { label: "Overview", url: "https://analytics.google.com/analytics/web/#/p476946071/reports/reportinghub" },
        ],
      },
      {
        name: "Google Search Console",
        desc: "Search rankings, impressions, CTR, indexed pages, Core Web Vitals",
        color: "#1A73E8",
        links: [
          { label: "Performance", url: "https://search.google.com/search-console/performance/search-analytics?resource_id=sc-domain%3Ahirestepx.com" },
          { label: "Coverage", url: "https://search.google.com/search-console/index?resource_id=sc-domain%3Ahirestepx.com" },
          { label: "Core Web Vitals", url: "https://search.google.com/search-console/core-web-vitals?resource_id=sc-domain%3Ahirestepx.com" },
          { label: "Sitemaps", url: "https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Ahirestepx.com" },
          { label: "URL Inspection", url: "https://search.google.com/search-console/inspect?resource_id=sc-domain%3Ahirestepx.com" },
          { label: "Rich results", url: "https://search.google.com/search-console/enhancement-status?resource_id=sc-domain%3Ahirestepx.com" },
        ],
      },
      {
        name: "SERPWatcher",
        desc: "Keyword rank tracking — daily updates, India target",
        color: "#6B4FDB",
        links: [
          { label: "Rank tracker", url: "https://mangools.com/serpwatcher" },
          { label: "KW Finder", url: "https://mangools.com/kwfinder" },
          { label: "Link Miner", url: "https://mangools.com/linkminer" },
          { label: "Site Profiler", url: "https://mangools.com/siteprofiler" },
        ],
      },
      {
        name: "Vercel",
        desc: "Deployment status, build logs, Web Analytics, Speed Insights, Edge logs",
        color: "#FFFFFF",
        links: [
          { label: "Deployments", url: "https://vercel.com/hirestepx/hirestepx" },
          { label: "Web Analytics", url: "https://vercel.com/hirestepx/hirestepx/analytics" },
          { label: "Speed Insights", url: "https://vercel.com/hirestepx/hirestepx/speed-insights" },
          { label: "Functions", url: "https://vercel.com/hirestepx/hirestepx/logs" },
          { label: "Edge config", url: "https://vercel.com/hirestepx/hirestepx/edge-config" },
        ],
      },
      {
        name: "Razorpay",
        desc: "Payments, settlements, refunds, UPI, orders, webhooks",
        color: "#0E6CF0",
        links: [
          { label: "Dashboard", url: "https://dashboard.razorpay.com/" },
          { label: "Orders", url: "https://dashboard.razorpay.com/app/orders" },
          { label: "Payments", url: "https://dashboard.razorpay.com/app/payments" },
          { label: "Settlements", url: "https://dashboard.razorpay.com/app/settlements" },
          { label: "Webhooks", url: "https://dashboard.razorpay.com/app/webhooks" },
        ],
      },
      {
        name: "Resend",
        desc: "Transactional email delivery — open rates, bounces, domains",
        color: "#000000",
        links: [
          { label: "Overview", url: "https://resend.com/overview" },
          { label: "Emails", url: "https://resend.com/emails" },
          { label: "Domains", url: "https://resend.com/domains" },
          { label: "API keys", url: "https://resend.com/api-keys" },
        ],
      },
      {
        name: "Upstash Redis",
        desc: "Rate-limit counters, question cache (gq:* keys), request budgets",
        color: "#00C389",
        links: [
          { label: "Console", url: "https://console.upstash.com/" },
          { label: "Data browser", url: "https://console.upstash.com/redis" },
          { label: "Metrics", url: "https://console.upstash.com/redis" },
        ],
      },
    ];

    const keywords = [
      "mock interview practice India",
      "AI mock interview",
      "TCS interview questions freshers 2026",
      "behavioral interview questions freshers India",
      "salary negotiation tips India",
      "Infosys interview preparation 2026",
      "campus placement AI practice",
      "Wipro interview questions",
      "Accenture behavioral interview",
      "how to prepare for TCS interview",
    ];

    /* Schema health — links to Google Rich Results Test for each page type we now have structured data on */
    const schemaPages = [
      { label: "Homepage", url: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fhirestepx.com%2F" },
      { label: "/blog (ItemList)", url: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fhirestepx.com%2Fblog" },
      { label: "Blog post (sample)", url: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fhirestepx.com%2Fblog%2Ftcs-interview-questions-freshers" },
      { label: "/questions (ItemList)", url: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fhirestepx.com%2Fquestions" },
      { label: "/questions/tcs-behavioral", url: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fhirestepx.com%2Fquestions%2Ftcs-behavioral" },
      { label: "/companies/tcs-behavioral", url: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fhirestepx.com%2Fcompanies%2Ftcs-behavioral" },
      { label: "/for-students", url: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fhirestepx.com%2Ffor-students" },
      { label: "/interview-prep", url: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fhirestepx.com%2Finterview-prep" },
      { label: "/pricing", url: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fhirestepx.com%2Fpricing" },
      { label: "/about", url: "https://search.google.com/test/rich-results?url=https%3A%2F%2Fhirestepx.com%2Fabout" },
    ];

    /* Schemas currently deployed — for quick audit reference */
    const schemaMatrix = [
      { page: "/", schemas: ["WebSite", "Organization", "SiteNavigationElement", "BreadcrumbList"] },
      { page: "/blog", schemas: ["ItemList (52 posts)", "BreadcrumbList"] },
      { page: "/blog/[slug]", schemas: ["BlogPosting", "BreadcrumbList", "FAQPage"] },
      { page: "/questions", schemas: ["ItemList (62 question sets)", "BreadcrumbList"] },
      { page: "/questions/[slug]", schemas: ["Article", "BreadcrumbList", "FAQPage"] },
      { page: "/companies/[slug]", schemas: ["Article", "BreadcrumbList", "FAQPage"] },
      { page: "/for-students", schemas: ["Article", "FAQPage", "BreadcrumbList"] },
      { page: "/interview-prep", schemas: ["Article", "FAQPage", "BreadcrumbList"] },
      { page: "/pricing", schemas: ["Product", "BreadcrumbList"] },
      { page: "/about", schemas: ["Organization", "SoftwareApplication", "BreadcrumbList"] },
    ];

    /* Full user conversion funnel events */
    const funnelEvents = [
      { event: "pageview /", desc: "User lands on homepage", stage: "top" },
      { event: "blog_post_view", desc: "User reads a blog post", stage: "top" },
      { event: "company_page_view", desc: "User views a /companies or /questions page", stage: "top" },
      { event: "blog_cta_click", desc: "User clicks any \"Start practice\" CTA", stage: "mid" },
      { event: "signup_started", desc: "User opens the signup page", stage: "mid" },
      { event: "user signed up", desc: "User completes email signup", stage: "mid" },
      { event: "interview_session_started", desc: "User starts their first mock interview", stage: "activation" },
      { event: "interview_session_completed", desc: "User finishes an interview and sees the report", stage: "activation" },
      { event: "upgrade_modal_shown", desc: "User hits the paywall", stage: "revenue" },
      { event: "payment_initiated", desc: "User opens Razorpay checkout", stage: "revenue" },
      { event: "payment_success", desc: "Payment confirmed — user is now paid tier", stage: "revenue" },
    ];

    /* SEO action checklist */
    const seoActions = [
      { task: "Submit new sitemaps to GSC after any slug addition", cadence: "On deploy", done: true },
      { task: "Request indexing for new company/questions pages via GSC URL Inspection", cadence: "On deploy", done: true },
      { task: "Check GSC Coverage → 'Crawled – not indexed' for any blocked pages", cadence: "Weekly", done: false },
      { task: "Review GSC Performance → filter by company/questions pages, look for CTR < 2%", cadence: "Weekly", done: false },
      { task: "Build PostHog funnel (Insights → Funnel → 11 events above)", cadence: "One-time", done: false },
      { task: "Track 10 priority keywords in SERPWatcher targeting India", cadence: "One-time", done: false },
      { task: "Write 1 comparison blog post (HireStepX vs AlmaLinked vs Pramp)", cadence: "Monthly", done: false },
      { task: "Post 2 Reddit/Quora answers/week (r/cscareerquestionsIndia, r/developersIndia)", cadence: "Weekly", done: false },
      { task: "List on G2, Product Hunt, Futurepedia, AlternativeTo", cadence: "One-time", done: false },
      { task: "Validate schema with Rich Results Test after any schema code change", cadence: "On deploy", done: true },
    ];

    const stagePill = (stage: string) => {
      const colors: Record<string, string> = { top: "#1A73E8", mid: "#E37400", activation: "#1E8E3E", revenue: "#6B4FDB" };
      return (
        <span style={{
          fontSize: 9, fontWeight: 700, fontFamily: font.ui, letterSpacing: "0.06em",
          padding: "2px 6px", borderRadius: 3,
          background: colors[stage] ?? c.onyx, color: "#fff",
          textTransform: "uppercase",
        }}>
          {stage}
        </span>
      );
    };

    return (
      <div>
        <p style={{ ...labelStyle, marginBottom: 20 }}>All active tracking tools — click any link to open the live report</p>

        {/* ── Tool cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 32 }}>
          {tools.map((tool) => (
            <div key={tool.name} style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: tool.color, flexShrink: 0, border: tool.color === "#FFFFFF" || tool.color === "#000000" ? `1px solid ${c.border}` : "none" }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: c.ivory, fontFamily: font.ui }}>{tool.name}</p>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: c.stone, lineHeight: 1.5 }}>{tool.desc}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {tool.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 11, fontWeight: 600, fontFamily: font.ui,
                      padding: "4px 10px", borderRadius: 4,
                      background: c.onyx, color: c.stone,
                      textDecoration: "none", border: `1px solid ${c.border}`,
                      letterSpacing: "0.04em",
                    }}
                  >
                    {link.label} ↗
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Full conversion funnel ── */}
        <div style={{ ...card, marginBottom: 24 }}>
          <p style={{ ...labelStyle, marginBottom: 4 }}>Full conversion funnel — PostHog events</p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: c.stone }}>
            Build in PostHog → Insights → Funnel → add events below in order. Stages: top (discovery) → mid (intent) → activation → revenue.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {funnelEvents.map((e, i) => (
              <div key={e.event} style={{ display: "flex", alignItems: "center", gap: 12, background: c.onyx, borderRadius: 6, padding: "10px 14px", border: `1px solid ${c.border}` }}>
                <span style={{ fontSize: 11, fontFamily: font.mono, color: c.stone, minWidth: 18, textAlign: "right" }}>{i + 1}</span>
                <span style={{ fontSize: 11, fontFamily: font.mono, color: "#F54E00", flex: "0 0 auto", minWidth: 260 }}>{e.event}</span>
                <span style={{ fontSize: 12, color: c.stone, flex: 1 }}>{e.desc}</span>
                {stagePill(e.stage)}
              </div>
            ))}
          </div>
        </div>

        {/* ── Schema health ── */}
        <div style={{ ...card, marginBottom: 24 }}>
          <p style={{ ...labelStyle, marginBottom: 4 }}>Schema markup — deployed coverage</p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: c.stone }}>
            Pages with structured data injected server-side. Validate any page in Google Rich Results Test using the links below.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, marginBottom: 16, border: `1px solid ${c.border}`, borderRadius: 8, overflow: "hidden" }}>
            <div style={{ display: "contents" }}>
              {schemaMatrix.map((row, i) => (
                <>
                  <div key={row.page + "-page"} style={{ padding: "8px 14px", background: i % 2 === 0 ? c.onyx : "transparent", borderBottom: `1px solid ${c.border}`, fontSize: 12, fontFamily: font.mono, color: c.stone }}>{row.page}</div>
                  <div key={row.page + "-schemas"} style={{ padding: "8px 14px", background: i % 2 === 0 ? c.onyx : "transparent", borderBottom: `1px solid ${c.border}`, fontSize: 11, color: c.stone, display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                    {row.schemas.map((s) => (
                      <span key={s} style={{ background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 3, padding: "1px 6px", fontSize: 10, fontFamily: font.mono, color: "#1A73E8" }}>{s}</span>
                    ))}
                  </div>
                </>
              ))}
            </div>
          </div>
          <p style={{ ...labelStyle, marginBottom: 10 }}>Validate pages with Rich Results Test</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {schemaPages.map((p) => (
              <a
                key={p.label}
                href={p.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 11, fontWeight: 600, fontFamily: font.ui,
                  padding: "4px 10px", borderRadius: 4,
                  background: c.onyx, color: "#1A73E8",
                  textDecoration: "none", border: `1px solid ${c.border}`,
                  letterSpacing: "0.04em",
                }}
              >
                {p.label} ↗
              </a>
            ))}
          </div>
        </div>

        {/* ── Keywords ── */}
        <div style={{ ...card, marginBottom: 24 }}>
          <p style={{ ...labelStyle, marginBottom: 12 }}>Priority keywords to track (SERPWatcher → India region)</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {keywords.map((kw) => (
              <span key={kw} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 4, background: c.onyx, color: c.stone, border: `1px solid ${c.border}`, fontFamily: font.mono }}>
                {kw}
              </span>
            ))}
          </div>
        </div>

        {/* ── SEO action checklist ── */}
        <div style={{ ...card }}>
          <p style={{ ...labelStyle, marginBottom: 4 }}>SEO action checklist</p>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: c.stone }}>Recurring and one-time tasks to keep SEO health green.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {seoActions.map((action) => (
              <div key={action.task} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", borderRadius: 6, background: c.onyx, border: `1px solid ${c.border}` }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{action.done ? "✓" : "○"}</span>
                <span style={{ flex: 1, fontSize: 12, color: action.done ? c.stone : c.ivory, lineHeight: 1.5, textDecoration: action.done ? "line-through" : "none", textDecorationColor: c.stone }}>{action.task}</span>
                <span style={{ fontSize: 10, fontFamily: font.mono, color: c.stone, flexShrink: 0, whiteSpace: "nowrap" }}>{action.cadence}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderOutcomes = () => {
    if (!outcomes) return <EmptyState title="No outcome data yet — users haven't reported job-search results." />;
    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={statCard}><p style={labelStyle}>Reports</p><p style={bigNum}>{outcomes.total}</p></div>
          <div style={statCard}><p style={labelStyle}>Applied</p><p style={bigNum}>{outcomes.applied}</p></div>
          <div style={statCard}><p style={labelStyle}>Interviewed</p><p style={bigNum}>{outcomes.interviewed}</p></div>
          <div style={statCard}><p style={labelStyle}>Offers</p><p style={{ ...bigNum, color: c.sage }}>{outcomes.offer}</p></div>
          <div style={statCard}><p style={labelStyle}>Accepted</p><p style={{ ...bigNum, color: c.sage }}>{outcomes.accepted}</p></div>
          <div style={statCard}><p style={labelStyle}>Offer Rate</p><p style={{ ...bigNum, color: c.gilt }}>{outcomes.offerRate}%</p></div>
        </div>

        {outcomes.shareableTestimonials.length > 0 && (
          <div style={{ ...card, marginBottom: 24 }}>
            <p style={labelStyle}>Shareable Testimonials ({outcomes.shareableTestimonials.length})</p>
            <p style={{ fontFamily: font.ui, fontSize: 11, color: c.stone, margin: "4px 0 14px" }}>
              Users gave permission to share. Use these for landing-page social proof / case studies.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {outcomes.shareableTestimonials.map((t, i) => (
                <div key={i} style={{ padding: "12px 14px", background: "rgba(21,128,61,0.04)", border: `1px solid rgba(21,128,61,0.18)`, borderRadius: 10 }}>
                  <p style={{ fontFamily: font.ui, fontSize: 13, color: c.ivory, lineHeight: 1.6, margin: "0 0 6px", fontStyle: "italic" }}>&ldquo;{t.testimonial}&rdquo;</p>
                  <p style={{ fontFamily: font.ui, fontSize: 11, color: c.stone, margin: 0 }}>
                    — <strong style={{ color: c.chalk }}>{t.firstName}</strong> · landed {t.roleLanded} at {t.company} · {formatDateTime(t.reportedAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {outcomes.recent.length > 0 && (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={labelStyle}>Recent Reports</p>
              <button onClick={() => exportCsv("outcomes.csv", outcomes.recent as unknown as Record<string, unknown>[])} style={exportBtn}>Export CSV</button>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Applied</th>
                  <th style={thStyle}>Interviewed</th>
                  <th style={thStyle}>Offer</th>
                  <th style={thStyle}>Accepted</th>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {outcomes.recent.map((r, i) => (
                  <tr key={i}>
                    <td style={tdStyle}>{r.name}</td>
                    <td style={tdStyle}>{r.applied === true ? "✓" : r.applied === false ? "✕" : "—"}</td>
                    <td style={tdStyle}>{r.interviewed === true ? "✓" : r.interviewed === false ? "✕" : "—"}</td>
                    <td style={{ ...tdStyle, color: r.offer === true ? c.sage : c.stone }}>{r.offer === true ? "✓" : r.offer === false ? "✕" : "—"}</td>
                    <td style={{ ...tdStyle, color: r.accepted === true ? c.sage : c.stone }}>{r.accepted === true ? "✓" : r.accepted === false ? "✕" : "—"}</td>
                    <td style={tdStyle}>{r.company}</td>
                    <td style={tdStyle}>{r.roleLanded}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(r.reportedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  /* ─── New tab renderers ─── */

  const renderReferrals = () => {
    if (!referrals) return <EmptyState title="No referral data available" />;
    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={statCard}><p style={labelStyle}>Total Referrals</p><p style={bigNum}>{referrals.total}</p></div>
          <div style={statCard}><p style={labelStyle}>Last 30 days</p><p style={bigNum}>{referrals.last30d}</p></div>
          <div style={statCard}><p style={labelStyle}>Converted</p><p style={{ ...bigNum, color: c.sage }}>{referrals.converted}</p></div>
          <div style={statCard}><p style={labelStyle}>Conversion Rate</p><p style={bigNum}>{referrals.conversionRate}%</p></div>
          <div style={statCard}>
            <p style={labelStyle}>K-factor (30d)</p>
            <p style={{ ...bigNum, color: (referrals.kFactor ?? 0) >= 0.3 ? c.sage : c.ivory }}>{referrals.kFactor ?? 0}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: c.stone }}>signups / {referrals.activeLast30d ?? 0} active · target &gt; 0.3</p>
          </div>
        </div>

        {referrals.topReferrers.length > 0 && (
          <div style={{ ...card, padding: 0, marginBottom: 24, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px" }}>
              <p style={labelStyle}>Top Referrers</p>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Total</th>
                  <th style={thStyle}>Converted</th>
                </tr>
              </thead>
              <tbody>
                {referrals.topReferrers.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.name}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 12 }}>{r.email}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono }}>{r.total}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, color: c.sage }}>{r.converted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {referrals.recent.length > 0 && (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={labelStyle}>Recent Referrals</p>
              <button onClick={() => exportCsv("referrals.csv", referrals.recent)} style={exportBtn}>Export CSV</button>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Referrer</th>
                  <th style={thStyle}>Referee</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Reward</th>
                  <th style={thStyle}>Date</th>
                </tr>
              </thead>
              <tbody>
                {referrals.recent.map((r) => (
                  <tr key={r.id}>
                    <td style={tdStyle}>{r.referrerName}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 12 }}>{r.refereeEmail}</td>
                    <td style={{ ...tdStyle, color: r.status === "converted" ? c.sage : c.stone }}>{r.status}</td>
                    <td style={tdStyle}>{r.rewardGranted ? "✓" : "—"}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderPromoCodes = () => {
    if (!promoCodes) return <EmptyState title="No promo code data available" />;
    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={statCard}><p style={labelStyle}>Total Codes</p><p style={bigNum}>{promoCodes.total}</p></div>
          <div style={statCard}><p style={labelStyle}>Active</p><p style={{ ...bigNum, color: c.sage }}>{promoCodes.active}</p></div>
          <div style={statCard}><p style={labelStyle}>Expired</p><p style={{ ...bigNum, color: c.stone }}>{promoCodes.expired}</p></div>
          <div style={statCard}><p style={labelStyle}>Total Uses</p><p style={bigNum}>{promoCodes.totalUses}</p></div>
        </div>

        {promoCodes.codes.length > 0 ? (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={labelStyle}>All Codes</p>
              <button onClick={() => exportCsv("promo-codes.csv", promoCodes.codes)} style={exportBtn}>Export CSV</button>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Discount</th>
                  <th style={thStyle}>Applies to</th>
                  <th style={thStyle}>Uses</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Expires</th>
                </tr>
              </thead>
              <tbody>
                {promoCodes.codes.map((p) => {
                  const isActive = p.active && (!p.expiresAt || new Date(p.expiresAt) > new Date());
                  const usagePct = p.maxUses ? Math.round((p.uses / p.maxUses) * 100) : null;
                  return (
                    <tr key={p.id}>
                      <td style={{ ...tdStyle, fontFamily: font.mono, fontWeight: 600 }}>{p.code}</td>
                      <td style={tdStyle}>{p.discountPct ? `${p.discountPct}%` : p.discountAmount ? `₹${(p.discountAmount/100).toFixed(0)}` : "—"}</td>
                      <td style={tdStyle}>{p.appliesTo}</td>
                      <td style={{ ...tdStyle, fontFamily: font.mono }}>
                        {p.uses}{p.maxUses ? ` / ${p.maxUses}` : ""}
                        {usagePct !== null && <span style={{ color: c.stone, marginLeft: 6 }}>({usagePct}%)</span>}
                      </td>
                      <td style={{ ...tdStyle, color: isActive ? c.sage : c.stone }}>{isActive ? "Active" : "Inactive"}</td>
                      <td style={{ ...tdStyle, fontSize: 12 }}>{p.expiresAt ? formatDateTime(p.expiresAt) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No promo codes have been created yet." />}
      </div>
    );
  };

  const renderCalendar = () => {
    if (!calendar) return <EmptyState title="No calendar data available" />;
    return (
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div style={statCard}><p style={labelStyle}>Total Events</p><p style={bigNum}>{calendar.total}</p></div>
          <div style={statCard}><p style={labelStyle}>Upcoming</p><p style={{ ...bigNum, color: c.gilt }}>{calendar.upcoming}</p></div>
          <div style={statCard}><p style={labelStyle}>Last 7 days</p><p style={bigNum}>{calendar.pastWeek}</p></div>
        </div>

        {Object.keys(calendar.byType).length > 0 && (
          <div style={{ ...card, marginBottom: 24 }}>
            <p style={labelStyle}>Events by type</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
              {Object.entries(calendar.byType).map(([type, n]) => (
                <div key={type} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: c.stone, textTransform: "uppercase", letterSpacing: "0.06em" }}>{type}</span>
                  <span style={{ fontFamily: font.mono, fontSize: 22, color: c.ivory, fontWeight: 600 }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {calendar.recent.length > 0 ? (
          <div style={{ ...card, padding: 0, overflow: "auto" }}>
            <div style={{ padding: "16px 24px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={labelStyle}>Recent Events</p>
              <button onClick={() => exportCsv("calendar.csv", calendar.recent)} style={exportBtn}>Export CSV</button>
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Reminded</th>
                </tr>
              </thead>
              <tbody>
                {calendar.recent.map((e) => (
                  <tr key={e.id}>
                    <td style={tdStyle}>{e.userName}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 12 }}>{e.userEmail}</td>
                    <td style={tdStyle}>{e.type}</td>
                    <td style={tdStyle}>{e.company}</td>
                    <td style={{ ...tdStyle, fontSize: 12 }}>{formatDateTime(e.date)}</td>
                    <td style={{ ...tdStyle, fontFamily: font.mono, fontSize: 12 }}>{e.time}</td>
                    <td style={tdStyle}>{e.reminded ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No upcoming or recent calendar events." />}
      </div>
    );
  };

  /* ─── Layout ─── */

  // Loading auth
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: c.obsidian, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.ui }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${c.border}`, borderTopColor: c.gilt, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: c.stone, fontSize: 14 }}>Loading...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Login screen
  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: c.obsidian, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: font.ui }}>
        <div style={{
          width: 360, padding: "40px 36px", background: c.graphite,
          border: `1px solid ${c.border}`, borderRadius: radius.xl,
        }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <Image src="/wordmark.png" alt="HireStepX" width={387} height={108} style={{ height: 26, width: "auto", display: "inline-block" }} />
            <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.12em", color: c.stone, marginTop: 6 }}>Admin Console</span>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 24 }}>
              <label htmlFor="admin-password" style={{ display: "block", fontSize: 12, color: c.stone, marginBottom: 6, fontWeight: 500 }}>Password</label>
              <input
                id="admin-password"
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                required
                autoComplete="off"
                style={{
                  width: "100%", padding: "11px 14px", background: c.onyx,
                  border: `1px solid ${c.border}`, borderRadius: radius.md,
                  color: c.ivory, fontSize: 14, fontFamily: font.ui, outline: "none",
                  boxSizing: "border-box",
                }}
                placeholder="Enter admin password"
              />
            </div>

            {loginError && (
              <div style={{
                marginBottom: 16, padding: "10px 14px",
                background: loginError.includes("Too many") ? `${c.gilt}15` : `${c.ember}15`,
                border: `1px solid ${loginError.includes("Too many") ? c.gilt : c.ember}33`,
                borderRadius: radius.md, fontSize: 13,
                color: loginError.includes("Too many") ? c.gilt : c.ember,
              }}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loginBusy}
              style={{
                width: "100%", padding: "12px 0",
                background: loginBusy ? c.onyx : `linear-gradient(135deg, ${c.gilt}, ${c.giltDark})`,
                border: "none", borderRadius: radius.md,
                color: loginBusy ? c.stone : c.obsidian,
                fontSize: 14, fontWeight: 600, fontFamily: font.ui,
                cursor: loginBusy ? "not-allowed" : "pointer",
              }}
            >
              {loginBusy ? "Verifying..." : "Sign In"}
            </button>
          </form>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Dashboard
  return (
    <div style={{ minHeight: "100vh", background: c.obsidian, color: c.ivory, fontFamily: font.ui }}>
      {/* Top Bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 32px", borderBottom: `1px solid ${c.border}`,
        background: c.graphite,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image src="/wordmark.png" alt="HireStepX" width={387} height={108} style={{ height: 22, width: "auto" }} />
          <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: c.stone, background: `${c.ember}22`, padding: "3px 10px", borderRadius: 100 }}>Admin</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            onClick={handleLogout}
            style={{
              background: "none", border: `1px solid ${c.border}`, borderRadius: radius.md,
              color: c.stone, fontSize: 12, padding: "6px 14px", cursor: "pointer",
              fontFamily: font.ui,
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* System Health Bar — always visible, auto-refreshes every 5 min */}
      {healthData && healthData.alerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {healthData.alerts.map((alert) => (
            <div
              key={alert.code}
              style={{
                display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 24px",
                background: alert.severity === "critical" ? "rgba(220,38,38,0.12)" : "rgba(217,119,6,0.10)",
                borderBottom: `1px solid ${alert.severity === "critical" ? "rgba(220,38,38,0.3)" : "rgba(217,119,6,0.3)"}`,
              }}
            >
              <span style={{ fontSize: 15, flexShrink: 0, paddingTop: 1 }}>
                {alert.severity === "critical" ? "🚨" : "⚠️"}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                  color: alert.severity === "critical" ? "#F87171" : "#FCD34D",
                  marginRight: 8, textTransform: "uppercase",
                }}>
                  {alert.severity === "critical" ? "Critical" : "Warning"}
                </span>
                <span style={{ fontSize: 12, color: c.ivory }}>{alert.message}</span>
                <span style={{ fontSize: 11, color: c.stone, marginLeft: 12 }}>→ {alert.action}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="admin-shell" style={{ display: "flex", minHeight: "calc(100vh - 57px)" }}>
        {/* Sidebar — collapses to a horizontal tab strip on narrow screens. */}
        <div className="admin-tabs" style={{
          width: 220, flexShrink: 0, padding: "24px 16px",
          borderRight: `1px solid ${c.border}`, background: c.graphite,
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedUserId(null); setUserDetail(null); setSelectedSessionId(null); setSessionDetail(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                padding: "10px 14px", marginBottom: 4, border: "none", borderRadius: radius.md,
                background: tab === t.key ? c.onyx : "transparent",
                color: tab === t.key ? c.ivory : c.stone,
                fontSize: 13, fontFamily: font.ui, fontWeight: tab === t.key ? 600 : 400,
                cursor: "pointer", transition: "all 0.15s",
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: "28px 32px", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: c.ivory }}>
              {TABS.find(t => t.key === tab)?.icon} {TABS.find(t => t.key === tab)?.label}
            </h2>
            <RefreshButton onClick={refreshTab} loading={loading} />
          </div>
          {renderContent()}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          /* Sidebar → horizontal scrollable strip. */
          .admin-shell { flex-direction: column; }
          .admin-tabs {
            width: auto !important; padding: 8px 12px !important;
            display: flex; gap: 4px; overflow-x: auto !important;
            border-right: none !important;
            border-bottom: 1px solid rgba(14,12,8,0.06);
            -webkit-overflow-scrolling: touch;
          }
          .admin-tabs button { white-space: nowrap; flex-shrink: 0; width: auto !important; }
          .admin-tabs::-webkit-scrollbar { height: 3px; }
          .admin-tabs::-webkit-scrollbar-thumb { background: rgba(14,12,8,0.12); border-radius: 2px; }
        }
        /* Tables remain scrollable horizontally on narrow screens. */
        @media (max-width: 720px) {
          table { font-size: 12px; }
          table th, table td { padding: 8px 10px !important; }
        }
      `}</style>
    </div>
  );
}
