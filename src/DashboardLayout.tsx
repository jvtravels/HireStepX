import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useDashboardCore, useDashboardSessions, useDashboardSubscription, useDashboardUI } from "./DashboardContext";
const UpgradeModal = dynamic(() => import("./dashboardComponents").then(m => ({ default: m.UpgradeModal })), { ssr: false });
import { FREE_SESSION_LIMIT, STARTER_WEEKLY_LIMIT } from "./dashboardData";
import { daysUntilEvent } from "./dashboardHelpers";
import dynamic from "next/dynamic";
import { tokens as T, fonts as F, shadows as shadow } from "./auth/_tokens";


/* ─── Cream-mode design tokens (derived) ───────────────────────────────
 * Source of truth lives in src/auth/_tokens.ts. We expose the cream
 * editorial palette under the legacy `c`/`font` aliases so the rest of
 * the file's JSX needs no per-property edits — only the binding changes.
 * If a token like `inkFaint` ever shifts for WCAG, every alias on this
 * page picks it up automatically (no more drift between local copies). */
const c = {
  obsidian: T.cream,         // page bg → cream
  graphite: T.white,         // raised cards
  border: T.line,            // hairlines
  gilt: T.copper,
  giltDark: T.copperDark,
  ivory: T.coal,             // primary ink
  chalk: T.coal,
  stone: T.inkSoft,          // secondary ink
  sage: T.success,
  ember: T.error,
  slate: T.inkSoft,
  indigo: T.indigo,
  indigo100: T.indigo100,
  cream: T.cream,
  creamSoft: T.creamSoft,
} as const;
const font = {
  display: F.serif,
  ui: F.sans,
  mono: F.mono,
} as const;

/* ─── Prefetch route chunks on nav hover ─── */
const prefetchMap: Record<string, () => void> = {
  dashboard: () => { import("./DashboardHome"); },
  sessions: () => { import("./DashboardSessions"); },
  calendar: () => { import("./DashboardCalendar"); },
  analytics: () => { import("./DashboardAnalytics"); },
  resume: () => { import("./DashboardResume"); },
  settings: () => { import("./DashboardSettings"); },
};

/* ─── Sidebar Nav Items ─── */
const navItems = [
  { id: "dashboard", path: "/dashboard", label: "Dashboard", icon: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { id: "sessions", path: "/sessions", label: "Sessions", icon: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg> },
  { id: "calendar", path: "/calendar", label: "Calendar", icon: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
  { id: "analytics", path: "/analytics", label: "Analytics", icon: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> },
  { id: "resume", path: "/resume", label: "Resume", icon: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg> },
  { id: "settings", path: "/settings", label: "Settings", icon: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
];

export default function DashboardLayout({ children }: { children?: React.ReactNode }) {
  const nav = useRouter();
  const pathname = usePathname();
  const { logout: authLogout, user, updateUser: authUpdateUser } = useAuth();
  // Use focused hooks instead of aggregate useDashboard() — prevents this
  // layout from re-rendering when unrelated state (e.g. recentSessions poll)
  // changes. Each sub-context only notifies when ITS slice changes.
  const { displayName, persisted } = useDashboardCore();
  const { calendarEvents, refreshSessions } = useDashboardSessions();
  const { isFree, isStarter, isPro, sessionsUsed, sessionsRemaining, starterRemaining, sessionsThisWeek } = useDashboardSubscription();
  // True when we have a session but profile fetch (tier-bearing) hasn't
  // returned yet. profileToUser always sets subscriptionTier; the JWT-only
  // fallback path leaves it undefined. Avoid rendering "Free Plan" in this
  // window — it misleads Pro users until the background retry lands.
  // The localStorage tier cache (AuthContext cacheTier) seeds subscriptionTier
  // into the fallback user object on every load after the first, so this is
  // false only on the very first page load before any profile has been cached.
  const tierKnown = !!user && user.subscriptionTier !== undefined;
  const {
    isMobile,
    showUpgradeModal, setShowUpgradeModal,
    paymentBanner, setPaymentBanner,
    syncError, setSyncError,
    toast,
  } = useDashboardUI();

  // Refetch sessions on mount (e.g. returning from interview)
  useEffect(() => { refreshSessions(); }, [refreshSessions]);

  // Drain any interview-turn writes that failed during a previous session
  // (network blip mid-interview, browser tab closed before save, etc.).
  // Runs once per dashboard mount; flushPendingTurns is a no-op when the
  // queue is empty and only retries each turn once before re-queueing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { flushPendingTurns } = await import("./supabase");
        const result = await flushPendingTurns();
        if (!cancelled && result.flushed > 0) {
          console.warn(`[dashboard] flushed ${result.flushed} pending turn(s) from previous session`);
        }
      } catch { /* best effort */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const hasUrgentInterview = useMemo(() =>
    calendarEvents.some(e => e.status === "upcoming" && daysUntilEvent(e.date, e.time) >= 0 && daysUntilEvent(e.date, e.time) <= 3),
    [calendarEvents]
  );

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpFeedback, setHelpFeedback] = useState("");
  const [helpSending, setHelpSending] = useState(false);
  const [helpSent, setHelpSent] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);


  // Haptic feedback on mobile button taps
  useEffect(() => {
    if (!isMobile) return;
    const handler = (e: TouchEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("button, a, [role='button'], [role='menuitem']")) {
        try { navigator.vibrate?.(8); } catch { /* expected: vibrate API may not be available */ }
      }
    };
    document.addEventListener("touchstart", handler, { passive: true });
    return () => document.removeEventListener("touchstart", handler);
  }, [isMobile]);

  // Auto-dismiss payment cancel banner after 8s
  useEffect(() => {
    if (paymentBanner === "cancelled") {
      const t = setTimeout(() => setPaymentBanner(null), 8000);
      return () => clearTimeout(t);
    }
    return;
  }, [paymentBanner, setPaymentBanner]);

  // Auto-dismiss sync error after 8s
  useEffect(() => {
    if (syncError) {
      const t = setTimeout(() => setSyncError(""), 8000);
      return () => clearTimeout(t);
    }
    return;
  }, [syncError, setSyncError]);

  // Keyboard shortcut: ⌘B / Ctrl+B opens the plan/billing modal from anywhere
  useEffect(() => {
    if (!tierKnown) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setShowUpgradeModal(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [tierKnown, setShowUpgradeModal]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
    return;
  }, [isMobile, sidebarOpen]);

  // Determine active nav from current route
  const activeNav = (() => {
    const path = pathname;
    if (path === "/dashboard" || path === "/dashboard/") return "dashboard";
    const match = navItems.find(item => item.path !== "/dashboard" && path === item.path);
    return match?.id || "dashboard";
  })();

  return (
    // 100dvh accounts for the mobile Safari URL bar — 100vh leaves a
    // 60-80px gap at the bottom when the bar collapses. The vh value
    // is the fallback for pre-iOS 15.4 / Android <108.
    <div style={{ display: "flex", height: "100dvh", minHeight: "100vh", background: c.obsidian, overflow: "hidden" }}>
      {/* Mobile sticky header — logo left, hamburger right. Sits below the
          sidebar overlay (z:19) and sidebar itself (z:20) so the drawer
          slides over it. Replaces the old inline "≡ Menu" content button. */}
      {isMobile && (
        <header style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 20px",
          background: c.cream,
          borderBottom: `1px solid ${c.border}`,
          zIndex: 18,
        }}>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center" }}>
            <img src="/wordmark.png" alt="HireStepX" style={{ height: 24, width: "auto" }} />
          </Link>
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
            style={{
              background: "none", border: "none", color: c.ivory,
              cursor: "pointer", padding: 8, margin: -8,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </header>
      )}
      <a href="#dashboard-main" style={{
        position: "absolute", left: -9999, top: "auto", width: 1, height: 1, overflow: "hidden",
        zIndex: 100, padding: "12px 24px", background: c.gilt, color: c.obsidian,
        fontFamily: font.ui, fontSize: 14, fontWeight: 600, borderRadius: 8, textDecoration: "none",
      }} onFocus={(e) => { e.currentTarget.style.left = "16px"; e.currentTarget.style.top = "16px"; e.currentTarget.style.width = "auto"; e.currentTarget.style.height = "auto"; }}
        onBlur={(e) => { e.currentTarget.style.left = "-9999px"; e.currentTarget.style.width = "1px"; e.currentTarget.style.height = "1px"; }}>
        Skip to main content
      </a>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {isMobile && sidebarOpen && <div role="button" aria-label="Close navigation menu" tabIndex={0} onClick={() => setSidebarOpen(false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarOpen(false); }} style={{ position: "fixed", inset: 0, background: "rgba(14,12,8,0.45)", zIndex: 19 }} />}

      {/* Sidebar */}
      <aside aria-label="Navigation sidebar" style={{
        width: 260, borderRight: `1px solid ${c.border}`, padding: isMobile ? "0 14px 0" : "20px 18px 0",
        display: "flex", flexDirection: "column", position: "fixed", top: 0, bottom: 0,
        background: c.cream,
        zIndex: 20, overflow: "hidden",
        transform: isMobile ? (sidebarOpen ? "translateX(0)" : "translateX(-100%)") : "translateX(0)",
        transition: "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      }}>
        {/* Sidebar wordmark — mobile gets a full-bleed header row; desktop gets a compact top block */}
        {isMobile ? (
          <div style={{
            height: 56,
            display: "flex", alignItems: "center",
            borderBottom: `1px solid ${c.border}`,
            marginBottom: 8,
            marginLeft: -14, marginRight: -14,
            paddingLeft: 20, paddingRight: 20,
            flexShrink: 0,
          }}>
            <Link
              href="/"
              onClick={() => setSidebarOpen(false)}
              style={{ textDecoration: "none", display: "flex", alignItems: "center" }}
            >
              <img src="/wordmark.png" alt="HireStepX" style={{ height: 24, width: "auto" }} />
            </Link>
          </div>
        ) : (
          <div style={{ paddingBottom: 12, marginBottom: 8, borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
            <Link href="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", paddingLeft: 14 }}>
              <img src="/wordmark.png" alt="HireStepX" style={{ height: 22, width: "auto" }} />
            </Link>
          </div>
        )}
        <nav aria-label="Main navigation" style={{ display: "flex", flexDirection: "column", gap: 2, flex: "0 0 auto" }}>
          {navItems.map((item) => (
            <button key={item.id}
              aria-current={activeNav === item.id ? "page" : undefined}
              aria-label={item.label}
              onClick={() => { nav.push(item.path); if (isMobile) setSidebarOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: isMobile ? "10px 12px" : "11px 14px",
                borderRadius: 10, border: "none", cursor: "pointer",
                background: activeNav === item.id ? c.creamSoft : "transparent",
                color: activeNav === item.id ? c.ivory : c.stone,
                fontFamily: font.ui, fontSize: 13, fontWeight: activeNav === item.id ? 600 : 500,
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)", textAlign: "left", outline: "none",
              }}
              onFocus={(e) => e.currentTarget.style.boxShadow = `0 0 0 2px ${c.gilt}40`}
              onBlur={(e) => e.currentTarget.style.boxShadow = "none"}
              onMouseEnter={(e) => { if (activeNav !== item.id) e.currentTarget.style.background = c.creamSoft; prefetchMap[item.id]?.(); }}
              onMouseLeave={(e) => { if (activeNav !== item.id) e.currentTarget.style.background = "transparent"; }}
            >
              {item.icon}
              <span style={{ position: "relative" }}>
                {item.label}
                {item.id === "calendar" && hasUrgentInterview && (
                  <span style={{ position: "absolute", top: -2, right: -10, width: 7, height: 7, borderRadius: "50%", background: c.ember, border: `2px solid ${c.obsidian}` }} />
                )}
              </span>
              {activeNav === item.id && <div style={{ width: 3, height: 16, borderRadius: 2, background: c.gilt, marginLeft: "auto" }} />}
            </button>
          ))}
        </nav>

        {/* Spacer — pushes plan card + user info to bottom */}
        <div style={{ flex: 1 }} />

        {/* Plan Status */}
        <div style={{ margin: "0 8px 12px", padding: "14px", borderRadius: 12, background: isPro ? "rgba(21,128,61,0.11)" : (isFree && sessionsRemaining === 0) ? "rgba(180,83,9,0.14)" : "rgba(180,83,9,0.08)", border: `1px solid ${isPro ? "rgba(21,128,61,0.22)" : (isFree && sessionsRemaining === 0) ? "rgba(185,28,28,0.28)" : "rgba(180,83,9,0.2)"}`, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
            {isPro ? (
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.sage} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            ) : isStarter ? (
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.gilt} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            ) : (
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.gilt} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>
            )}
            <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 700, color: isPro ? c.sage : c.gilt, letterSpacing: "0.01em" }}>
              {!tierKnown ? "Loading plan…" : isPro ? "Pro Plan" : isStarter ? "Starter Plan" : "Free Plan"}
            </span>
            {tierKnown && (
              <span
                title={isPro
                  ? "Unlimited sessions · STAR coaching · skill decay tracking · PDF reports"
                  : isStarter
                  ? `${STARTER_WEEKLY_LIMIT} sessions/week · STAR coaching · PDF reports · ₹49/week`
                  : "3 lifetime sessions · basic feedback · upgrade anytime"}
                style={{ display: "inline-flex", alignItems: "center", cursor: "help", color: isPro ? c.sage : c.gilt, opacity: 0.45, flexShrink: 0 }}
              >
                <svg aria-label="What's included" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </span>
            )}
            {isPro && tierKnown && user?.subscriptionEnd && (
              <span style={{ marginLeft: "auto", fontFamily: font.ui, fontSize: 10, color: c.sage, opacity: 0.75, whiteSpace: "nowrap" }}>
                Renews {new Date(user.subscriptionEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          <p style={{ fontFamily: font.ui, fontSize: 11, color: tierKnown && ((isFree && sessionsRemaining <= 1 && sessionsRemaining > 0) || (isStarter && starterRemaining <= 2 && starterRemaining > 0)) ? c.ember : c.stone, lineHeight: 1.4, marginBottom: isStarter && user?.subscriptionEnd ? 3 : 8, fontWeight: tierKnown && ((isFree && sessionsRemaining <= 1) || (isStarter && starterRemaining <= 2)) ? 600 : 400 }}>
            {!tierKnown ? "\u00a0" : isPro ? "Unlimited sessions" : isStarter ? `${starterRemaining} of ${STARTER_WEEKLY_LIMIT} sessions this week${starterRemaining <= 2 && starterRemaining > 0 ? ", running low" : ""}` : sessionsRemaining > 0 ? `${sessionsRemaining} of ${FREE_SESSION_LIMIT} session${sessionsRemaining !== 1 ? "s" : ""} remaining${sessionsRemaining === 1 ? ", last one" : ""}` : "No sessions left. Upgrade to continue."}
          </p>
          {user?.subscriptionEnd && isStarter && (
            <p style={{ fontFamily: font.ui, fontSize: 10, color: c.stone, marginBottom: 10 }}>
              Renews {new Date(user.subscriptionEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · sessions reset Sun
            </p>
          )}
          {tierKnown && (isFree || isStarter) && (
            <div style={{ height: 3, borderRadius: 2, background: c.border, marginBottom: 12 }}>
              {isFree ? (
                <div style={{ height: "100%", borderRadius: 2, background: sessionsRemaining === 0 ? c.ember : c.gilt, width: `${Math.min(100, (sessionsUsed / FREE_SESSION_LIMIT) * 100)}%`, transition: "width 0.3s" }} />
              ) : (
                <div style={{ height: "100%", borderRadius: 2, background: starterRemaining === 0 ? c.ember : c.gilt, width: `${Math.min(100, (sessionsThisWeek / STARTER_WEEKLY_LIMIT) * 100)}%`, transition: "width 0.3s" }} />
              )}
            </div>
          )}
          {!tierKnown ? (
            <div aria-hidden="true" style={{ width: "100%", height: 32, borderRadius: 8, background: c.border, opacity: 0.4 }} />
          ) : isPro ? (
            <>
              <button onClick={() => setShowUpgradeModal(true)} title="Billing, invoices, and plan changes (⌘B)" style={{ width: "100%", padding: "8px 0", borderRadius: 8, cursor: "pointer", border: "none", background: c.sage, color: "#fff", fontFamily: font.ui, fontSize: 12, fontWeight: 600, letterSpacing: "0.01em", transition: "filter 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.87)")}
                onMouseLeave={(e) => (e.currentTarget.style.filter = "")}
              >Manage Subscription</button>
              <button onClick={() => setShowUpgradeModal(true)} title="Cancel or downgrade your subscription" style={{ display: "block", width: "100%", marginTop: 6, background: "none", border: "none", cursor: "pointer", fontFamily: font.ui, fontSize: 10, color: c.stone, opacity: 0.6, textAlign: "center" as const, padding: "2px 0", transition: "opacity 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
              >Cancel plan</button>
            </>
          ) : (
            <button onClick={() => setShowUpgradeModal(true)} title="See what's included in Pro — unlimited sessions, STAR coaching, skill tracking" style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${c.gilt}, ${c.giltDark})`, color: c.obsidian, fontFamily: font.ui, fontSize: 12, fontWeight: 600, transition: "filter 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.filter = "brightness(0.93)")}
              onMouseLeave={(e) => (e.currentTarget.style.filter = "")}
            >{isFree && sessionsRemaining === 0 ? "Unlock sessions now" : "Upgrade to Pro"}</button>
          )}
        </div>

        {/* User info */}
        <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 8, padding: "14px 12px 16px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#F4E5D8", border: `1px solid rgba(180,83,9,0.2)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: c.gilt }}>{(displayName || "?")[0].toUpperCase()}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
              <p style={{ fontFamily: font.ui, fontSize: 11, color: c.stone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{user?.targetRole || persisted.targetRole || "Set your target role"}</p>
            </div>
          </div>
          <button onClick={() => { authLogout(); }} style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 500, color: c.stone, background: "none", border: "none", cursor: "pointer", padding: "6px 0", transition: "color 0.2s", display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={(e) => e.currentTarget.style.color = c.ember}
            onMouseLeave={(e) => e.currentTarget.style.color = c.stone}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Log out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main id="dashboard-main" className="dash-main" style={{ flex: 1, marginLeft: isMobile ? 0 : 260, padding: isMobile ? "68px 12px max(60px, env(safe-area-inset-bottom))" : "32px 52px 80px", overflowY: "auto", height: "100dvh", minHeight: "100vh", paddingLeft: isMobile ? "max(12px, env(safe-area-inset-left))" : undefined, paddingRight: isMobile ? "max(12px, env(safe-area-inset-right))" : undefined }}>

        {/* Payment success/cancel banner */}
        {paymentBanner && (
          <div role="alert" style={{ padding: "12px 16px", marginBottom: 16, borderRadius: 10, background: paymentBanner === "success" ? "#DCFCE7" : "#FEE2E2", border: `1px solid ${paymentBanner === "success" ? "rgba(21,128,61,0.22)" : "rgba(185,28,28,0.22)"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {paymentBanner === "success" ? (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.sage} strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              ) : (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.ember} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              )}
              <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: paymentBanner === "success" ? c.sage : c.ember }}>
                {paymentBanner === "success" ? "Payment successful! Your account has been upgraded." : "Payment was not completed. No charges were made — you can try again anytime."}
              </span>
            </div>
            <button onClick={() => setPaymentBanner(null)} aria-label="Dismiss banner"
              onMouseEnter={(e) => { e.currentTarget.style.color = paymentBanner === "success" ? c.sage : c.ember; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = c.stone; }}
              style={{ background: "none", border: "none", color: c.stone, cursor: "pointer", padding: 2, transition: "color 160ms ease" }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* Sync error banner */}
        {syncError && (
          <div role="alert" style={{ padding: "10px 16px", marginBottom: 16, borderRadius: 8, background: "#FEE2E2", border: "1px solid rgba(185,28,28,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.ember} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{ fontFamily: font.ui, fontSize: 12, color: c.ember }}>{syncError}</span>
            </div>
            <button onClick={() => setSyncError("")} aria-label="Dismiss sync error"
              onMouseEnter={(e) => { e.currentTarget.style.color = c.ember; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = c.stone; }}
              style={{ background: "none", border: "none", color: c.stone, cursor: "pointer", padding: 2, transition: "color 160ms ease" }}>
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {isOffline && (
          <div role="alert" style={{ padding: "10px 16px", marginBottom: 16, borderRadius: 8, background: c.creamSoft, border: "1px solid rgba(126,141,152,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.slate} strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
            <span style={{ fontFamily: font.ui, fontSize: 12, color: c.slate }}>You're offline — some features may be unavailable</span>
          </div>
        )}
        <div key={pathname} className="dash-page-enter">
          {children}
        </div>
      </main>

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          sessionsUsed={sessionsUsed}
          user={user}
          currentTier={user?.subscriptionTier || "free"}
          onPaymentSuccess={(tier, start, end) => {
            setShowUpgradeModal(false);
            setPaymentBanner("success");
            setTimeout(() => setPaymentBanner(null), 8000);
            authUpdateUser({ subscriptionTier: tier as "starter" | "pro", subscriptionStart: start, subscriptionEnd: end });
          }}
        />
      )}


      {/* Toast notification */}
      {toast && (
        <div role="status" aria-live="polite" style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 10,
          padding: "10px 20px", zIndex: 100, animation: "slideDown 0.2s ease",
          boxShadow: shadow.cta,
        }}>
          <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: c.ivory }}>{toast}</span>
        </div>
      )}

      {/* Floating help widget */}
      <div style={{ position: "fixed", bottom: "max(24px, env(safe-area-inset-bottom))", right: "max(24px, env(safe-area-inset-right))", zIndex: 80 }}>
        {helpOpen && (
          <div style={{
            width: 320, maxHeight: 440, overflowY: "auto", marginBottom: 12,
            background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 14,
            padding: "20px 20px 16px", boxShadow: shadow.modal,
            animation: "slideDown 0.2s ease",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontFamily: font.ui, fontSize: 15, fontWeight: 600, color: c.ivory, margin: 0 }}>Help & Support</h3>
              <button onClick={() => setHelpOpen(false)} aria-label="Close help panel" style={{ background: "none", border: "none", color: c.stone, cursor: "pointer", padding: 4, borderRadius: 6, transition: "color 0.15s" }}
                onMouseEnter={(e) => e.currentTarget.style.color = c.ivory}
                onMouseLeave={(e) => e.currentTarget.style.color = c.stone}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Quick links */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {/* Getting Started */}
              <Link href="/how-it-works" style={{ textDecoration: "none" }} onClick={() => setHelpOpen(false)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.creamSoft, cursor: "pointer", transition: "all 0.15s", color: c.chalk, fontFamily: font.ui, fontSize: 13, fontWeight: 500 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#F4E5D8"; e.currentTarget.style.borderColor = "rgba(180,83,9,0.22)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = c.creamSoft; e.currentTarget.style.borderColor = c.border; }}>
                  <span style={{ color: c.gilt, flexShrink: 0 }}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span>
                  Getting Started
                </div>
              </Link>
              {/* FAQs */}
              <Link href="/#faq" style={{ textDecoration: "none" }} onClick={() => setHelpOpen(false)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: `1px solid ${c.border}`, background: c.creamSoft, cursor: "pointer", transition: "all 0.15s", color: c.chalk, fontFamily: font.ui, fontSize: 13, fontWeight: 500 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#F4E5D8"; e.currentTarget.style.borderColor = "rgba(180,83,9,0.22)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = c.creamSoft; e.currentTarget.style.borderColor = c.border; }}>
                  <span style={{ color: c.gilt, flexShrink: 0 }}><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
                  FAQs
                </div>
              </Link>
            </div>

            {/* Contact section */}
            <div style={{ marginBottom: 16, padding: "12px", borderRadius: 8, background: c.creamSoft }}>
              <p style={{ fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: c.chalk, marginBottom: 8 }}>Need help?</p>
              <a href="mailto:support@hirestepx.com" style={{
                display: "block", textAlign: "center", padding: "8px 0", borderRadius: 8,
                background: c.creamSoft, border: `1px solid rgba(180,83,9,0.2)`,
                color: c.gilt, fontFamily: font.ui, fontSize: 12, fontWeight: 600, textDecoration: "none",
                transition: "background 0.15s",
              }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#F4E5D8"}
                onMouseLeave={(e) => e.currentTarget.style.background = c.creamSoft}>
                support@hirestepx.com
              </a>
              <p style={{ fontFamily: font.ui, fontSize: 11, color: c.stone, marginTop: 6 }}>We typically respond within 24 hours</p>
            </div>

            {/* Feedback section */}
            <div>
              <textarea
                rows={2}
                placeholder="Describe your issue or suggestion..."
                value={helpFeedback}
                onChange={(e) => { setHelpFeedback(e.target.value); if (helpSent) setHelpSent(false); }}
                style={{
                  width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8,
                  background: c.creamSoft, border: `1px solid ${c.border}`,
                  color: c.ivory, fontFamily: font.ui, fontSize: 12, resize: "vertical",
                  outline: "none", transition: "border-color 0.15s",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "rgba(180,83,9,0.35)"}
                onBlur={(e) => e.currentTarget.style.borderColor = c.border}
              />
              {helpSent ? (
                <p style={{ fontFamily: font.ui, fontSize: 12, color: c.sage, marginTop: 8, fontWeight: 500 }}>Thanks! We'll look into it.</p>
              ) : (
                <button
                  disabled={helpSending || !helpFeedback.trim()}
                  onClick={async () => {
                    const msg = helpFeedback.trim();
                    if (!msg) return;
                    setHelpSending(true);
                    try {
                      const { apiFetch } = await import("./apiClient");
                      const res = await apiFetch("/api/support-feedback", {
                        message: msg,
                        email: user?.email || null,
                        page: typeof window !== "undefined" ? window.location.pathname : null,
                        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
                      });
                      if (!res.ok) throw new Error(res.error || "send failed");
                      setHelpFeedback("");
                      setHelpSent(true);
                    } catch {
                      // Persisted path failed — fall back to the user's email client
                      // so the feedback isn't lost.
                      window.location.href = `mailto:support@hirestepx.com?body=${encodeURIComponent(msg)}`;
                    } finally {
                      setHelpSending(false);
                    }
                  }}
                  style={{
                    marginTop: 8, width: "100%", padding: "8px 0", borderRadius: 8,
                    border: "none", cursor: helpSending || !helpFeedback.trim() ? "default" : "pointer",
                    background: helpSending || !helpFeedback.trim() ? c.creamSoft : `linear-gradient(135deg, ${c.gilt}, ${c.giltDark})`,
                    color: helpSending || !helpFeedback.trim() ? c.stone : c.obsidian,
                    fontFamily: font.ui, fontSize: 12, fontWeight: 600, transition: "opacity 0.15s",
                    opacity: helpSending ? 0.7 : 1,
                  }}
                  onMouseEnter={(e) => { if (!helpSending && helpFeedback.trim()) e.currentTarget.style.opacity = "0.9"; }}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}>
                  {helpSending ? "Sending..." : "Send Feedback"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setHelpOpen(v => !v)}
          aria-label={helpOpen ? "Close help" : "Open help"}
          style={{
            width: 48, height: 48, borderRadius: "50%", border: `1px solid ${c.border}`,
            background: c.graphite, color: c.ivory, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: shadow.cta, transition: "border-color 0.2s, transform 0.2s",
            marginLeft: "auto",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.gilt; e.currentTarget.style.transform = "scale(1.05)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.transform = "scale(1)"; }}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </button>
      </div>

    </div>
  );
}
