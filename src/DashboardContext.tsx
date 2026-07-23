import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./AuthContext";
import { getUserSessions, getCalendarEvents, syncGoogleEvents, getGoogleProviderToken, getLatestSessionInsightFlags, getCreditBalance, getSupabase, supabaseConfigured } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scheduleEventNotifications } from "./interviewNotifications";
import { type InterviewEvent, loadEvents } from "./dashboardHelpers";
import {
  type PersistedState, type DashboardSession, type SkillData, type TrendPoint,
  type RealSession, type SkillVelocity, type CompanyReadiness, type ImprovementPlan,
  FREE_SESSION_LIMIT, STARTER_WEEKLY_LIMIT, PRO_MONTHLY_LIMIT,
  loadState, saveState, getSessionData,
  generateFallbackInsights, generateNotifications, generateGoals,
  getReturnContext, getSmartScheduleSuggestion, getImprovementPlan,
  computeWeekActivity, computeStreak, computeReadiness, computeCompanyReadiness, daysUntil,
  generateReport,
  computeBadges, getDailyChallenge, getPracticeReminder,
} from "./dashboardData";
import { getCurriculumState, type CurriculumState } from "./curriculum";

/* ─── Sub-context types ─── */

interface SessionsContextValue {
  recentSessions: DashboardSession[];
  scoreTrend: TrendPoint[];
  skills: SkillData[];
  skillVelocity: SkillVelocity[];
  overallStats: { sessionsCompleted: number; avgScore: number; improvement: number; hoursLogged: number };
  hasData: boolean;
  weekActivity: boolean[];
  currentStreak: number;
  readinessScore: number;
  calendarEvents: InterviewEvent[];
  /**
   * Per-section initial-load flags. Replaces the all-or-nothing
   * `dataLoading` for surfaces that can render the moment their own
   * fetch resolves. `dataLoading` is still exposed (UIContext) as the
   * union, for legacy gates that depend on both. New widgets should
   * read the specific flag they need so a slow `getCalendarEvents`
   * does not blank the streak/sessions cards.
   */
  sessionsLoading: boolean;
  eventsLoading: boolean;
  /**
   * Gap-flag codes from the user's most-recently analyzed session
   * (`session_insights.flags`), used by the "Your next move" CTA to
   * surface gap-specific coaching. Empty array when no insight row
   * exists yet (first-time user or last session not yet analyzed
   * by the nightly cron).
   */
  topGaps: string[];
  refreshSessions: () => void;
  /** Bump the session-fetch epoch so the data effect re-runs immediately.
   *  Also writes a localStorage dirty flag so a remount (e.g. returning
   *  from /interview) picks up the signal even without a live context call. */
  invalidateSessions: () => void;
  sessionVersion: number;
}

interface SubscriptionContextValue {
  isFree: boolean;
  isStarter: boolean;
  isPro: boolean;
  atSessionLimit: boolean;
  sessionsUsed: number;
  sessionsRemaining: number;
  starterRemaining: number;
  sessionsThisWeek: number;
  /** Sessions started in the current calendar month — used to track Pro's 40/month cap. */
  sessionsThisMonth: number;
  /** Sessions remaining for Pro this calendar month (max 0). Always 0 for non-Pro tiers. */
  proRemaining: number;
  /** Purchased one-off session credits (₹9 each). Acts as a top-up for any tier
   *  that has exhausted its plan allotment (free, starter, or pro). The `atSessionLimit`
   *  gate clears for all three tiers when creditBalance > 0. Fetched lazily after auth;
   *  0 until loaded. */
  creditBalance: number;
  /** True once the credit balance DB fetch has resolved (success or error).
   *  Use to suppress the "Buy sessions" CTA while the balance is still unknown —
   *  avoids a flash of the exhausted state for users who have purchased credits. */
  creditsLoaded: boolean;
}

interface UIContextValue {
  showUpgradeModal: boolean;
  setShowUpgradeModal: (v: boolean) => void;
  dataLoading: boolean;
  isMobile: boolean;
  paymentBanner: "success" | "cancelled" | null;
  setPaymentBanner: (v: "success" | "cancelled" | null) => void;
  syncError: string;
  setSyncError: (v: string) => void;
  toast: string | null;
  showToast: (msg: string) => void;
  /** Re-fetches purchased credit balance from DB. Prefer setCreditBalanceDirect
   *  when the new balance is already known (e.g. from a verify-payment response)
   *  to avoid a round-trip and eliminate the race-condition window. */
  refreshCreditBalance: () => void;
  /** Immediately applies a known balance — use after a successful credit purchase
   *  where the server returns the new total. Eliminates the async re-fetch race
   *  where the user closes the modal before the DB read lands. */
  setCreditBalanceDirect: (newBalance: number) => void;
}

interface CoreContextValue {
  persisted: PersistedState;
  updatePersisted: (updates: Partial<PersistedState>) => void;
  displayName: string;
  isNewUser: boolean;
  daysLeft: number;
  aiInsights: { type: string; text: string; action?: string }[];
  notifications: { id: number; type: string; text: string; dismissible: boolean; action?: string }[];
  upcomingGoals: { label: string; progress: number; total: number; action?: string }[];
  returnContext: string | null;
  smartSchedule: string | null;
  prepPlan: ImprovementPlan | null;
  companyReadiness: CompanyReadiness | null;
  curriculumState: CurriculumState | null;
  badges: { id: string; label: string; description: string; icon: string; earned: boolean; progress: number }[];
  dailyChallenge: { id: string; label: string; description: string; type: string; focus?: string; difficulty: string; completed: boolean };
  practiceReminder: string | null;
  googleSyncStatus: "idle" | "syncing" | "done" | "error";
  googleSyncError: string | null;
  hasGoogleToken: boolean;
  syncGoogleCalendar: () => Promise<void>;
  handleStartSession: () => void;
  handleExport: () => void;
  handleDownload: () => void;
  handleExportCSV: () => void;
  handleExportPDF: () => void;
}

/* ─── Contexts ─── */

const SessionsContext = createContext<SessionsContextValue | null>(null);
const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);
const UIContext = createContext<UIContextValue | null>(null);
const CoreContext = createContext<CoreContextValue | null>(null);

/* ─── Focused hooks ─── */

export function useDashboardSessions() {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error("useDashboardSessions must be used within DashboardProvider");
  return ctx;
}

export function useDashboardSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error("useDashboardSubscription must be used within DashboardProvider");
  return ctx;
}

export function useDashboardUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error("useDashboardUI must be used within DashboardProvider");
  return ctx;
}

export function useDashboardCore() {
  const ctx = useContext(CoreContext);
  if (!ctx) throw new Error("useDashboardCore must be used within DashboardProvider");
  return ctx;
}

/** Backward-compatible aggregate hook — returns all properties from all sub-contexts */
export function useDashboard() {
  const sessions = useDashboardSessions();
  const subscription = useDashboardSubscription();
  const ui = useDashboardUI();
  const core = useDashboardCore();
  return { ...sessions, ...subscription, ...ui, ...core };
}

/* ─── Provider ─── */

export function DashboardProvider({ children }: { children: ReactNode }) {
  const nav = useRouter();
  const searchParams = useSearchParams();
  const { user, updateUser: _authUpdateUser } = useAuth();
  const [persisted, setPersisted] = useState<PersistedState>(() => {
    const local = loadState();
    if (user) {
      return {
        ...local,
        userName: user.name != null && user.name !== "" ? user.name : local.userName,
        targetRole: user.targetRole != null && user.targetRole !== "" ? user.targetRole : local.targetRole,
        interviewDate: user.interviewDate != null && user.interviewDate !== "" ? user.interviewDate : local.interviewDate,
        resumeFileName: user.resumeFileName != null && user.resumeFileName !== "" ? user.resumeFileName : local.resumeFileName,
        hasCompletedFirstSession: user.hasCompletedOnboarding || local.hasCompletedFirstSession,
      };
    }
    return local;
  });
  const [calendarEvents, setCalendarEvents] = useState<InterviewEvent[]>(loadEvents);
  const [supabaseSessions, setSupabaseSessions] = useState<RealSession[]>([]);
  // Flags from the user's most-recent analyzed session — drives the
  // gap-aware "Your next move" CTA. Loaded lazily after auth so the
  // initial dashboard paint isn't blocked by it; empty until the fetch
  // completes (degrades gracefully to skill-based CTA).
  const [topGaps, setTopGaps] = useState<string[]>([]);
  // sessionVersion increments each time invalidateSessions() is called,
  // forcing the data-fetch useEffect to re-run. Also consumed on mount
  // when a dirty flag was written by useInterviewEngine after a cloud save.
  const [sessionVersion, setSessionVersion] = useState(0);
  const [syncError, setSyncError] = useState("");
  /* Per-section loading flags — split from a single `dataLoading`
     boolean so one slow Supabase call (events) cannot blank the rest
     of the dashboard (sessions, streak, readiness). The legacy
     `dataLoading` derived below is true while EITHER initial fetch is
     still in flight, preserving the old gate semantics for consumers
     that need a both-loaded view (Resume, Settings, Analytics). */
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const dataLoading = sessionsLoading || eventsLoading;
  /* Synchronous initial value — without it, every mobile visitor saw a
     desktop-shaped paint (sidebar visible, two-column grid) then a layout
     flash to the mobile shape after the useEffect fired. matchMedia is
     synchronous and available pre-hydration on the client; on the server
     we fall back to false (desktop default) so SSR markup matches the
     initial-paint assumption. */
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches
  );
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [paymentBanner, setPaymentBanner] = useState<"success" | "cancelled" | null>(null);
  const [creditBalance, setCreditBalance] = useState(0);
  const [creditsLoaded, setCreditsLoaded] = useState(false);
  // Seed credit balance from sessionStorage on mount so the CTA never
  // flashes skeleton when the user navigates back from /interview.
  // /interview lives outside the (dashboard) route group, so DashboardProvider
  // unmounts on that transition and remounts on return — resetting creditBalance
  // to 0 and creditsLoaded to false. The sessionStorage write at line ~240
  // keeps a fresh copy; we read it here once so the sidebar is correct
  // immediately, before the DB fetch resolves.
  const creditSeedDoneRef = useRef(false);
  useEffect(() => {
    if (!user?.id || creditSeedDoneRef.current) return;
    creditSeedDoneRef.current = true;
    try {
      const cached = sessionStorage.getItem(`hsx_credit_${user.id}`);
      if (cached !== null) {
        const val = parseInt(cached, 10);
        if (!isNaN(val)) {
          setCreditBalance(val);
          setCreditsLoaded(true); // skip skeleton — DB fetch below will overwrite with fresh value
        }
      }
    } catch { /* sessionStorage unavailable (private-browsing) — stay with defaults */ }
  }, [user?.id]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshCreditBalance = useCallback(() => {
    if (!user?.id) return;
    // getCreditBalance already retries 2× internally on 502/503. If all retries
    // fail, log and leave the cached balance untouched rather than zeroing it out.
    getCreditBalance(user.id)
      .then(bal => { setCreditBalance(bal); setCreditsLoaded(true); })
      .catch(err => {
        console.warn("[credits] refreshCreditBalance failed — keeping cached value:", err?.message);
      });
  }, [user?.id]);

  // Persist the balance to sessionStorage so /session/new (a different Next.js
  // route group, outside this DashboardProvider) can read it immediately on mount
  // without an independent API round-trip. Writes on every change — including the
  // initial DB fetch AND the setCreditBalanceDirect call after a credit purchase —
  // so the session/new page always has the freshest value we know about.
  //
  // Gated on creditsLoaded: sessionStorage is a write-through cache of
  // DB-CONFIRMED balances only, never transient pre-load render state. Without
  // this gate the effect fires on first mount while creditBalance is still its
  // initial 0 — clobbering a valid cached value to "0" before the seed effect's
  // setState commits — so a cross-route read (or a fast remount) briefly sees 0
  // and the sidebar flip-flops 0→real. Once creditsLoaded is true the value is
  // always something the DB (or a purchase/realtime event) confirmed.
  useEffect(() => {
    if (!user?.id || !creditsLoaded) return;
    try { sessionStorage.setItem(`hsx_credit_${user.id}`, String(creditBalance)); } catch { /* private-browsing caps */ }
  }, [creditBalance, creditsLoaded, user?.id]);

  // ── Supabase Realtime: live credit-balance sync ───────────────────────────
  // Subscribes to row-level changes on session_credits for this user so the
  // sidebar updates the moment credits are granted — including the webhook path
  // (Razorpay → server → DB) where the browser never receives a direct response.
  // Without this, a webhook grant only appears after the next page load.
  // Cleanup unsubscribes when the user logs out or the provider unmounts.
  useEffect(() => {
    if (!user?.id || !supabaseConfigured) return;
    let cancelled = false;
    let channelRef: ReturnType<SupabaseClient["channel"]> | null = null;

    getSupabase().then(sb => {
      if (cancelled) return;
      channelRef = sb
        .channel(`credit-balance-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",           // INSERT or UPDATE
            schema: "public",
            table: "session_credits",
            filter: `user_id=eq.${user.id}`,
          },
          (payload: { new: { balance?: number } }) => {
            const fresh = payload?.new?.balance;
            if (typeof fresh === "number" && fresh >= 0) {
              setCreditBalance(fresh);
              setCreditsLoaded(true);
            }
          },
        )
        .subscribe();
    }).catch(() => { /* Supabase unavailable — fall back to fetch-on-mount */ });

    return () => {
      cancelled = true;
      if (channelRef) {
        getSupabase().then(sb => sb.removeChannel(channelRef!)).catch(() => {});
      }
    };
  }, [user?.id]);

  // Auto-open upgrade modal when navigated back from /interview with ?upgrade=1
  // (the interview engine redirects here when the server returns 403 session-limit).
  useEffect(() => {
    if (searchParams.get("upgrade") === "1") {
      setShowUpgradeModal(true);
      // Remove the param from the URL so a reload/back doesn't re-trigger it.
      nav.replace("/dashboard");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ─── Google Calendar sync state ───
  const [googleSyncStatus, setGoogleSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [googleSyncError, setGoogleSyncError] = useState<string | null>(null);
  const [hasGoogleToken, setHasGoogleToken] = useState(() => !!getGoogleProviderToken());

  const syncGoogleCalendar = useCallback(async () => {
    if (!user?.id || googleSyncStatus === "syncing") return;
    setGoogleSyncStatus("syncing");
    setGoogleSyncError(null);
    try {
      const result = await syncGoogleEvents(user.id);
      if (result.error) {
        setGoogleSyncStatus("error");
        setGoogleSyncError(result.error);
        showToast(result.error);
      } else {
        setGoogleSyncStatus("done");
        showToast(result.synced > 0 ? `Synced ${result.synced} interview(s) from Google Calendar` : "No new interviews found");
        if (result.synced > 0) {
          const events = await getCalendarEvents(user.id);
          const mapped = events.map(e => ({
            id: e.id, title: e.title, company: e.company,
            date: e.date, time: e.time, type: e.type,
            duration: 60, location: "", notes: e.notes,
            status: "upcoming" as const, reminders: true,
            google_event_id: e.google_event_id,
          }));
          setCalendarEvents(mapped);
          scheduleEventNotifications(mapped);
        }
      }
    } catch (err: unknown) {
      setGoogleSyncStatus("error");
      setGoogleSyncError(err instanceof Error ? err.message : "Sync failed");
      setHasGoogleToken(!!getGoogleProviderToken());
      showToast("Google Calendar sync failed");
    }
  }, [user?.id, showToast, googleSyncStatus]);

  // Sync persisted state when user profile loads/changes
  useEffect(() => {
    if (!user) return;
    setPersisted(prev => {
      const updated = {
        ...prev,
        userName: user.name != null && user.name !== "" ? user.name : prev.userName,
        targetRole: user.targetRole != null && user.targetRole !== "" ? user.targetRole : prev.targetRole,
        interviewDate: user.interviewDate != null && user.interviewDate !== "" ? user.interviewDate : prev.interviewDate,
        resumeFileName: user.resumeFileName != null && user.resumeFileName !== "" ? user.resumeFileName : prev.resumeFileName,
        hasCompletedFirstSession: user.hasCompletedOnboarding || prev.hasCompletedFirstSession,
      };
      saveState(updated);
      return updated;
    });
    // We intentionally key on the individual user fields we read, not the whole user object — including `user` here would re-run on every auth refresh that mutates a different field (e.g. session counts) and stomp persisted state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, user?.targetRole, user?.interviewDate, user?.resumeFileName, user?.hasCompletedOnboarding]);

  // Load data from Supabase on mount, with localStorage cache fallback.
  // Also runs when sessionVersion increments (invalidateSessions() call
  // or dirty-flag consumed from a cross-page write by useInterviewEngine).
  useEffect(() => {
    if (!user?.id) { setSessionsLoading(false); setEventsLoading(false); return; }

    const sessionsCacheKey = `hirestepx_cache_sessions_${user.id}`;
    const eventsCacheKey = `hirestepx_cache_events_${user.id}`;

    // Consume the dirty flag written by useInterviewEngine after a cloud
    // save. On a sessionVersion > 0 run the cache is intentionally skipped
    // so stale data never flickers in over the fresh network result.
    const dirtyKey = `hirestepx_sessions_dirty_${user.id}`;
    let skipSessionsCache = false;
    try {
      if (localStorage.getItem(dirtyKey)) {
        localStorage.removeItem(dirtyKey);
        skipSessionsCache = true;
      }
    } catch { /* localStorage unavailable — proceed normally */ }

    let cancelled = false;

    // Show cached data immediately for instant LCP, then refresh from network.
    // Cache hits flip per-section flags independently so a card whose
    // cache is warm renders straight away while the other still streams.
    // Skip the sessions cache when skipSessionsCache is set — a dirty flag
    // written by useInterviewEngine means the cached list is stale and
    // showing it would cause a visible flicker back to the old entry count.
    try {
      const cachedSessions = skipSessionsCache ? null : localStorage.getItem(sessionsCacheKey);
      const cachedEvents = localStorage.getItem(eventsCacheKey);
      if (cachedSessions) {
        setSupabaseSessions(JSON.parse(cachedSessions));
        setSessionsLoading(false);
      }
      if (cachedEvents) {
        const parsed = JSON.parse(cachedEvents);
        setCalendarEvents(parsed);
        scheduleEventNotifications(parsed);
        setEventsLoading(false);
      }
    } catch { /* expected: localStorage may be unavailable */ }

    Promise.allSettled([
      getUserSessions(user.id).then(sessions => {
        if (cancelled) return;
        const mapped = sessions.map(s => ({
          id: s.id, date: s.date, type: s.type, difficulty: s.difficulty,
          focus: s.focus, duration: s.duration,
          company: s.target_company ?? undefined,
          target_role: s.target_role ?? undefined,
          /* Canonical score = the report's blended-and-anchored overall when a
             report has been generated (report_json.overallScore), else the
             quick eval persisted at save time (sessions.score). The report
             page shows the blended number; without this the list/dashboard
             showed the quick number for the same session (e.g. 64 vs 51).
             New reports also write the blended value back into sessions.score
             (evaluate-session saveCachedReport) — this client-side preference
             additionally reconciles sessions whose reports were cached before
             that writeback shipped, without forcing a re-evaluation. */
          score: typeof s.report_json?.overallScore === "number" ? s.report_json.overallScore : s.score,
          questions: s.questions,
          ai_feedback: s.ai_feedback, skill_scores: s.skill_scores,
          /* Plain-language coaching pair, persisted inside report_json by
             evaluate-session. Undefined for pre-mvp-8 rows → the card
             falls back to the legacy strength/weakness one-liners. */
          coaching: s.report_json?.coaching ?? undefined,
          /* Per-focus signature strip (mvp-9+), persisted in
             report_json.focusMetrics. Empty/undefined for older rows → the
             card renders no instrument strip. */
          focusMetrics: s.report_json?.focusMetrics ?? undefined,
          /* Kernel-aware negotiation metrics. The Supabase column type
             is jsonb so we get an unknown-shaped object back; the
             RealSession field is strictly typed. Cast is intentional —
             validateNegotiationMetrics in the report layer is the
             trust boundary, not this mapping. */
          negotiationMetrics: (s as { negotiation_metrics?: unknown }).negotiation_metrics as RealSession["negotiationMetrics"] | undefined,
        }));
        setSupabaseSessions(mapped);
        try { localStorage.setItem(sessionsCacheKey, JSON.stringify(mapped)); } catch { /* expected: localStorage may be unavailable */ }
      }).catch(() => {
        if (cancelled) return;
        try {
          const cached = localStorage.getItem(sessionsCacheKey);
          if (cached) {
            setSyncError("Offline — showing cached data.");
          } else {
            setSyncError("Could not load session data.");
          }
        } catch { setSyncError("Could not load session data."); }
      }).finally(() => { if (!cancelled) setSessionsLoading(false); }),
      // Best-effort fetch of latest analyzed-session flags for the
      // gap-aware "Your next move" CTA. Failure → empty topGaps →
      // dashboard falls back to skill-based CTA. Not flagged because
      // the CTA degrades silently — no skeleton needed.
      getLatestSessionInsightFlags(user.id).then(flags => {
        if (cancelled) return;
        setTopGaps(flags);
      }).catch(() => { /* silent — CTA degrades to skill-based */ }),
      // Fetch purchased session-credit balance (free-tier users who bought ₹9
      // top-ups). getCreditBalance retries internally on 502/503. On persistent
      // failure it throws — we mark loaded but leave the balance at the cached
      // value (seeded from sessionStorage above) so we don't zero it out on a
      // transient infra blip.
      getCreditBalance(user.id).then(bal => {
        if (cancelled) return;
        setCreditBalance(bal);
        setCreditsLoaded(true);
      }).catch(err => {
        if (cancelled) return;
        console.warn("[credits] initial fetch failed:", err?.message);
        // creditsLoaded must still flip true so the UI exits skeleton state.
        // Balance stays at whatever sessionStorage seeded (or 0 if cold start).
        setCreditsLoaded(true);
      }),
      getCalendarEvents(user.id).then(events => {
        if (cancelled) return;
        const mapped = events.map(e => ({
          id: e.id, title: e.title, company: e.company,
          date: e.date, time: e.time, type: e.type, notes: e.notes,
          duration: 60, location: "", status: "upcoming" as const, reminders: true,
        }));
        setCalendarEvents(mapped);
        scheduleEventNotifications(mapped);
        try { localStorage.setItem(eventsCacheKey, JSON.stringify(mapped)); } catch { /* expected: localStorage may be unavailable */ }
      }).catch(() => {
        if (cancelled) return;
        try {
          const cached = localStorage.getItem(eventsCacheKey);
          if (cached) {
            if (!syncError) setSyncError("Offline — showing cached data.");
          }
        } catch { /* expected: cache read may fail */ }
      }).finally(() => { if (!cancelled) setEventsLoading(false); }),
    ]);

    // Safety net — if a fetch never settles (extension-stalled XHR, dropped
    // tab), unblock both gates after 10s so the dashboard isn't pinned on a
    // skeleton forever. Per-section flags so each clears independently.
    const timeout = setTimeout(() => {
      if (cancelled) return;
      setSessionsLoading(false);
      setEventsLoading(false);
    }, 10000);
    return () => { cancelled = true; clearTimeout(timeout); };
    // syncError is read inside one of the inner .catch handlers as a "don't overwrite" guard. Adding it as a dep would refetch the whole dashboard whenever the error string toggles, which is exactly the loop we're trying to avoid.
    // sessionVersion is intentionally included: invalidateSessions() bumps it to
    // force a fresh fetch after a session save (B9 fix — no hard reload required).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, sessionVersion]);

  // Invalidate the sessions cache — bumps sessionVersion so the data-fetch
  // useEffect re-runs immediately. Also writes a localStorage dirty flag so
  // a DashboardProvider remount (e.g. returning from /interview via SPA nav)
  // skips the stale cache and goes straight to a network fetch.
  const invalidateSessions = useCallback(() => {
    if (!user?.id) return;
    try { localStorage.setItem(`hirestepx_sessions_dirty_${user.id}`, "1"); } catch { /* non-critical */ }
    setSessionVersion(v => v + 1);
  }, [user?.id]);

  // Refetch sessions from Supabase (debounced to prevent rapid-fire calls
  // on tab-switch. Debounce reduced from 5s → 1s: it now only guards against
  // rapid visibilitychange retriggers, not the normal post-session navigation.)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshSessions = useCallback(() => {
    if (!user?.id) return;
    // Debounce: skip if a refresh was triggered within the last 1 second
    if (refreshTimeoutRef.current) return;
    refreshTimeoutRef.current = setTimeout(() => { refreshTimeoutRef.current = null; }, 1000);
    getUserSessions(user.id).then(sessions => {
      const mapped = sessions.map(s => ({
        id: s.id, date: s.date, type: s.type, difficulty: s.difficulty,
        /* S54-B7 (2026-07-24) — mirror the report_json.overallScore preference from the
         * initial-load mapping (line 461) so a refresh doesn't revert to the raw
         * quick-eval score and re-introduce the +5pt sessions-list vs report gap. */
        focus: s.focus, duration: s.duration, score: typeof s.report_json?.overallScore === "number" ? s.report_json.overallScore : s.score, questions: s.questions,
        ai_feedback: s.ai_feedback, skill_scores: s.skill_scores,
        coaching: s.report_json?.coaching ?? undefined,
        focusMetrics: s.report_json?.focusMetrics ?? undefined,
      }));
      setSupabaseSessions(mapped);
      try { localStorage.setItem(`hirestepx_cache_sessions_${user.id}`, JSON.stringify(mapped)); } catch { /* expected: localStorage may be unavailable */ }
    }).catch(() => {});
  }, [user?.id]);

  // Auto-refresh data when user returns to tab
  useEffect(() => {
    if (!user?.id) return;
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      refreshSessions();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (refreshTimeoutRef.current) { clearTimeout(refreshTimeoutRef.current); refreshTimeoutRef.current = null; }
    };
  }, [user?.id, refreshSessions]);

  // Session data
  const { recentSessions, scoreTrend, skills, overallStats, hasData, skillVelocity } = useMemo(
    () => getSessionData(user?.targetRole || persisted.targetRole, supabaseSessions),
    [user?.targetRole, persisted.targetRole, supabaseSessions],
  );

  const weekActivity = useMemo(() => computeWeekActivity(recentSessions), [recentSessions]);
  const currentStreak = useMemo(() => computeStreak(recentSessions), [recentSessions]);

  // Personalized AI insights
  const fallbackInsights = useMemo(() => generateFallbackInsights(user, skills, skillVelocity), [user, skills, skillVelocity]);
  const [llmInsights, setLlmInsights] = useState<{ type: string; text: string }[] | null>(null);
  const insightsFetchedRef = useRef<string>("");
  const insightsUserRef = useRef<string>("");

  // Reset insights cache when user changes (logout/login)
  useEffect(() => {
    const uid = user?.id || "";
    if (insightsUserRef.current && insightsUserRef.current !== uid) {
      insightsFetchedRef.current = "";
      setLlmInsights(null);
    }
    insightsUserRef.current = uid;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || skills.length === 0 || recentSessions.length === 0) return;
    const tier = user.subscriptionTier || "free";
    if (tier === "free") { setLlmInsights(null); return; }

    const cacheKey = `hirestepx_insights_${user.id}_${recentSessions.length}`;
    if (insightsFetchedRef.current === cacheKey) return;
    insightsFetchedRef.current = cacheKey;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { insights, ts } = JSON.parse(cached);
        if (Date.now() - ts < 86400000) { setLlmInsights(insights); return; }
      }
    } catch { /* expected: cache read may fail */ }

    const ac = new AbortController();
    (async () => {
      try {
        const { authHeaders } = await import("./supabase");
        const hdrs = await authHeaders();
        const res = await fetch("/api/generate-insights", {
          method: "POST",
          headers: hdrs,
          signal: ac.signal,
          body: JSON.stringify({
            role: user.targetRole,
            company: user.targetCompany,
            industry: user.industry,
            sessionCount: recentSessions.length,
            skills: skills.map(s => ({ name: s.name, score: s.score, prev: s.prev })),
            recentSessions: recentSessions.slice(0, 5).map(s => ({
              type: s.type, score: s.score, date: s.date,
              topStrength: s.topStrength, topWeakness: s.topWeakness,
            })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.insights && data.insights.length > 0) {
            setLlmInsights(data.insights);
            try { localStorage.setItem(cacheKey, JSON.stringify({ insights: data.insights, ts: Date.now() })); } catch { /* expected: localStorage may be unavailable */ }
          }
        }
      } catch {
        // Silently fall back to template insights (also handles AbortError)
      }
    })();
    return () => ac.abort();
  }, [user, skills, recentSessions]);

  const aiInsights = llmInsights || fallbackInsights;
  const notifications = useMemo(() => generateNotifications(user, currentStreak, weekActivity, recentSessions), [user, currentStreak, weekActivity, recentSessions]);
  const upcomingGoals = useMemo(() => generateGoals(user, weekActivity, skills, skillVelocity), [user, weekActivity, skills, skillVelocity]);
  const returnContext = useMemo(() => getReturnContext(recentSessions), [recentSessions]);
  const smartSchedule = useMemo(() => getSmartScheduleSuggestion(user), [user]);
  const prepPlan = useMemo(() => getImprovementPlan(user, recentSessions, skills, skillVelocity), [user, recentSessions, skills, skillVelocity]);
  const curriculumState = useMemo(() => getCurriculumState(recentSessions, user ? { targetRole: user.targetRole, targetCompany: user.targetCompany } : null), [recentSessions, user]);
  const badges = useMemo(() => computeBadges(recentSessions, skills, currentStreak), [recentSessions, skills, currentStreak]);
  const dailyChallenge = useMemo(() => getDailyChallenge(recentSessions, skills), [recentSessions, skills]);
  const practiceReminder = useMemo(() => getPracticeReminder(recentSessions, currentStreak), [recentSessions, currentStreak]);

  // Persist state
  const updatePersisted = useCallback((updates: Partial<PersistedState>) => {
    setPersisted(prev => {
      const next = { ...prev, ...updates };
      saveState(next);
      return next;
    });
  }, []);

  // Sync persisted state from auth context
  useEffect(() => {
    if (!user) return;
    const updates: Partial<PersistedState> = {};
    if (user.name && user.name !== persisted.userName) updates.userName = user.name;
    if (user.targetRole && user.targetRole !== persisted.targetRole) updates.targetRole = user.targetRole;
    if (user.resumeFileName && user.resumeFileName !== persisted.resumeFileName) updates.resumeFileName = user.resumeFileName;
    if (user.interviewDate && user.interviewDate !== persisted.interviewDate) updates.interviewDate = user.interviewDate;
    if (Object.keys(updates).length > 0) updatePersisted(updates);
    // Sync-from-user effect: re-runs only when user fields change. Including persisted.* would loop because this effect calls updatePersisted, which mutates persisted. updatePersisted is stable (useCallback with empty deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, user?.targetRole, user?.resumeFileName, user?.interviewDate]);

  const displayName = user?.name || persisted.userName || "User";
  // Only evaluate isNewUser after data has loaded — prevents flash of EmptyState for returning users
  const isNewUser = !dataLoading && !hasData && !user?.hasCompletedOnboarding && !persisted.hasCompletedFirstSession;

  // Mobile detection — uses matchMedia with a change listener so we react
  // to actual breakpoint crossings (not every resize tick during a drag).
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  // Handle payment redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get("payment");
    if (payment === "success" || payment === "cancelled") {
      setPaymentBanner(payment);
      window.history.replaceState({}, "", window.location.pathname);
      setTimeout(() => setPaymentBanner(null), payment === "success" ? 8000 : 6000);
    }
    const pendingPlan = params.get("plan");
    if (pendingPlan === "weekly") {
      setShowUpgradeModal(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Subscription info
  //
  // sessionsUsed counts CONSUMPTION, not just completion. A free-tier
  // user who starts an interview but abandons it before save-session
  // still spent a quota slot — they used the LLM tokens, the question
  // generation, the STT minutes. Counting only finished rows in the
  // sessions table (the previous behaviour: `recentSessions.length`)
  // let users get unlimited do-overs by quitting any interview that
  // wasn't going well.
  //
  // The right signal is profile.practice_timestamps, which the server
  // bumps on session START via /api/record-session-start (and dedupes
  // at completion via save-session's started_session_ids check, so
  // there's no double-counting). This is what SessionSetup already
  // uses — DashboardContext was the lone holdout.
  const practiceTimestamps = user?.practiceTimestamps && Array.isArray(user.practiceTimestamps)
    ? user.practiceTimestamps
    : [];
  // Belt-and-suspenders expiry check: AuthContext already downgrades expired
  // tiers in profileToUser(), but a user whose subscription lapses WHILE the
  // app is open won't get the downgrade until the next JWT refresh. Checking
  // subscriptionEnd here ensures the UI gates reflect reality immediately.
  const rawTier = user?.subscriptionTier || "free";
  const subEnd = user?.subscriptionEnd;
  const isTierExpired = rawTier !== "free" && subEnd ? new Date(subEnd) < new Date() : false;
  const effectiveTier = isTierExpired ? "free" : rawTier;
  const isFree = effectiveTier === "free";
  const isStarter = effectiveTier === "starter";
  const isPro = effectiveTier === "pro";
  const sessionsUsed = practiceTimestamps.length;
  const sessionsRemaining = Math.max(0, FREE_SESSION_LIMIT - sessionsUsed);
  // Starter is a "Sprint Pack": 5 sessions counted from the day the pack was
  // bought (subscription_start), within a 30-day validity window — NOT a
  // calendar week. This mirrors the server gate in _shared.ts
  // checkSessionLimit, which counts sessions since subscription_start. The
  // previous calendar-week anchor (Sunday 00:00) wrongly swept in free-tier
  // practice sessions the user did earlier the same week, so a freshly
  // purchased pack could show "5 of 5 used" before any paid session ran.
  const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000; // clamp slightly over 7-day pack
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const subStartMs = user?.subscriptionStart ? new Date(user.subscriptionStart).getTime() : NaN;
  // Anchor on subscription_start when present; clamp to at most 8 days back
  // (just over the 7-day pack — mirrors the server gate). If start is missing
  // derive from subscription_end - 7d; last resort: rolling 7-day lookback.
  const subEndMs = user?.subscriptionEnd ? new Date(user.subscriptionEnd).getTime() : NaN;
  const derivedStartMs = Number.isFinite(subStartMs)
    ? subStartMs
    : Number.isFinite(subEndMs)
      ? subEndMs - SEVEN_DAYS_MS
      : Date.now() - SEVEN_DAYS_MS;
  const packStartMs = Math.max(derivedStartMs, Date.now() - EIGHT_DAYS_MS);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay()); weekStart.setHours(0, 0, 0, 0);
  // For starter, count within the pack window; other tiers keep the calendar
  // week (used only for informational display, not gating).
  const sessionsThisWeek = practiceTimestamps.filter((t) => {
    try {
      const ms = new Date(t).getTime();
      return ms >= (isStarter ? packStartMs : weekStart.getTime());
    } catch { return false; }
  }).length;
  const starterRemaining = Math.max(0, STARTER_WEEKLY_LIMIT - sessionsThisWeek);
  // Pro plan: 40 sessions per calendar month. Track this so the sidebar
  // and SessionSetup can show real remaining counts instead of "Unlimited".
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sessionsThisMonth = practiceTimestamps.filter((t) => {
    try { return new Date(t).getTime() >= monthStart.getTime(); } catch { return false; }
  }).length;
  const proRemaining = isPro ? Math.max(0, PRO_MONTHLY_LIMIT - sessionsThisMonth) : 0;
  // Users past their plan allotment are NOT at the limit if they hold purchased
  // credits — the backend will consume one on session start. This applies to
  // all tiers: free (past 2 free sessions), starter (past weekly cap), and
  // pro (past monthly cap). Credits are a universal top-up, not free-only.
  const atSessionLimit = (isFree && sessionsUsed >= FREE_SESSION_LIMIT && creditBalance === 0)
    || (isStarter && sessionsThisWeek >= STARTER_WEEKLY_LIMIT && creditBalance === 0)
    || (isPro && sessionsThisMonth >= PRO_MONTHLY_LIMIT && creditBalance === 0);

  const daysLeft = persisted.interviewDate ? daysUntil(persisted.interviewDate) : 0;
  const readinessScore = scoreTrend.length > 0 && skills.length > 0 ? computeReadiness(scoreTrend, skills) : 0;
  const companyReadiness = useMemo(() => {
    if (!user?.targetCompany || skills.length === 0) return null;
    return computeCompanyReadiness(user.targetCompany, skills, skillVelocity, daysLeft);
  }, [user?.targetCompany, skills, skillVelocity, daysLeft]);

  const handleStartSession = useCallback(() => {
    if (atSessionLimit) { setShowUpgradeModal(true); return; }
    nav.push("/session/new");
  }, [atSessionLimit, nav]);

  const handleExport = useCallback(() => {
    const report = generateReport(persisted.userName, overallStats, skills, recentSessions);
    navigator.clipboard.writeText(report);
    showToast("Report copied to clipboard");
  }, [persisted.userName, overallStats, skills, recentSessions, showToast]);

  const handleDownload = useCallback(() => {
    const report = generateReport(persisted.userName, overallStats, skills, recentSessions);
    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HireStepX_Progress_${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Report downloaded");
  }, [persisted.userName, overallStats, skills, recentSessions, showToast]);

  const handleExportCSV = useCallback(() => {
    if (recentSessions.length === 0) return;
    const headers = ["Date", "Type", "Role", "Score", "Change", "Duration", "Top Strength", "Area to Improve", "AI Feedback"];
    const rows = recentSessions.map(s => [
      s.date, s.type, s.role, s.score, s.change, s.duration,
      s.topStrength, s.topWeakness, `"${(s.feedback || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `HireStepX_Sessions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported");
  }, [recentSessions, showToast]);

  const handleExportPDF = useCallback(() => {
    const report = generateReport(persisted.userName, overallStats, skills, recentSessions);
    const rows = recentSessions.slice(0, 20).map(s =>
      `<tr><td>${s.date}</td><td>${s.type}</td><td>${s.score}</td><td>${s.topStrength || "-"}</td><td>${s.topWeakness || "-"}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>HireStepX Progress Report</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;max-width:720px;margin:0 auto;padding:40px 24px;line-height:1.6}
h1{font-size:22px;margin-bottom:4px}h2{font-size:16px;margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:6px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eee}
th{background:#f5f5f5;font-weight:600}.meta{color:#666;font-size:13px}pre{white-space:pre-wrap;font-size:12px;background:#f9f9f9;padding:16px;border-radius:8px}
@media print{body{padding:20px}}</style></head><body>
<h1>HireStepX Progress Report</h1>
<p class="meta">${persisted.userName || "User"} · Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
<h2>Overview</h2>
<p>Sessions: ${overallStats.sessionsCompleted} · Average Score: ${overallStats.avgScore} · Improvement: ${overallStats.improvement > 0 ? "+" : ""}${overallStats.improvement}%</p>
${skills.length > 0 ? `<h2>Skills</h2><table><tr><th>Skill</th><th>Score</th><th>Change</th></tr>${skills.map(s => `<tr><td>${s.name}</td><td>${s.score}/100</td><td>${s.score - s.prev >= 0 ? "+" : ""}${s.score - s.prev}</td></tr>`).join("")}</table>` : ""}
<h2>Recent Sessions</h2>
<table><tr><th>Date</th><th>Type</th><th>Score</th><th>Strength</th><th>To Improve</th></tr>${rows}</table>
<h2>Full Report</h2><pre>${report.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
    showToast("PDF export opened — use Save as PDF in print dialog");
  }, [persisted.userName, overallStats, skills, recentSessions, showToast]);

  /* ─── Memoized sub-context values ─── */

  const sessionsValue: SessionsContextValue = useMemo(() => ({
    recentSessions, scoreTrend, skills, skillVelocity, overallStats, hasData,
    weekActivity, currentStreak, readinessScore,
    calendarEvents, topGaps, refreshSessions, invalidateSessions, sessionVersion,
    sessionsLoading, eventsLoading,
  }), [recentSessions, scoreTrend, skills, skillVelocity, overallStats, hasData, weekActivity, currentStreak, readinessScore, calendarEvents, topGaps, refreshSessions, invalidateSessions, sessionVersion, sessionsLoading, eventsLoading]);

  const subscriptionValue: SubscriptionContextValue = useMemo(() => ({
    isFree, isStarter, isPro, atSessionLimit,
    sessionsUsed, sessionsRemaining, starterRemaining, sessionsThisWeek,
    sessionsThisMonth, proRemaining, creditBalance, creditsLoaded,
  }), [isFree, isStarter, isPro, atSessionLimit, sessionsUsed, sessionsRemaining, starterRemaining, sessionsThisWeek, sessionsThisMonth, proRemaining, creditBalance, creditsLoaded]);

  const uiValue: UIContextValue = useMemo(() => ({
    showUpgradeModal, setShowUpgradeModal,
    dataLoading, isMobile,
    paymentBanner, setPaymentBanner,
    syncError, setSyncError,
    toast, showToast, refreshCreditBalance,
    setCreditBalanceDirect: setCreditBalance,
  }), [showUpgradeModal, dataLoading, isMobile, paymentBanner, syncError, toast, showToast, refreshCreditBalance, setCreditBalance]);

  const coreValue: CoreContextValue = useMemo(() => ({
    persisted, updatePersisted,
    displayName, isNewUser, daysLeft,
    aiInsights, notifications, upcomingGoals,
    returnContext, smartSchedule, prepPlan, companyReadiness, curriculumState,
    badges, dailyChallenge, practiceReminder,
    googleSyncStatus, googleSyncError, hasGoogleToken, syncGoogleCalendar,
    handleStartSession, handleExport, handleDownload, handleExportCSV, handleExportPDF,
  }), [
    persisted, updatePersisted,
    displayName, isNewUser, daysLeft,
    aiInsights, notifications, upcomingGoals,
    returnContext, smartSchedule, prepPlan, companyReadiness, curriculumState,
    badges, dailyChallenge, practiceReminder,
    googleSyncStatus, googleSyncError, hasGoogleToken, syncGoogleCalendar,
    handleStartSession, handleExport, handleDownload, handleExportCSV, handleExportPDF,
  ]);

  return (
    <SessionsContext.Provider value={sessionsValue}>
      <SubscriptionContext.Provider value={subscriptionValue}>
        <UIContext.Provider value={uiValue}>
          <CoreContext.Provider value={coreValue}>
            {children}
          </CoreContext.Provider>
        </UIContext.Provider>
      </SubscriptionContext.Provider>
    </SessionsContext.Provider>
  );
}
