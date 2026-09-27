import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "./AuthContext";
import { Button } from "@/components/ui/button";
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
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  LayoutDashboardIcon,
  ClipboardListIcon,
  CalendarIcon,
  TrendingUpIcon,
  FileTextIcon,
  BriefcaseIcon,
  SettingsIcon,
  MailIcon,
  BellIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardCore, useDashboardSessions, useDashboardSubscription, useDashboardUI } from "./DashboardContext";
const UpgradeModal = dynamic(() => import("./dashboardComponents").then(m => ({ default: m.UpgradeModal })), { ssr: false });
import { FREE_SESSION_LIMIT, STARTER_WEEKLY_LIMIT } from "./dashboardData";
import { starterPackFootnote, planCtaLabel, planCtaTitle } from "./planCardCopy";
import { daysUntilEvent } from "./dashboardHelpers";
import { CopyEmailLink } from "./_CopyEmailLink";
import dynamic from "next/dynamic";
import { tokens as T, fonts as F, shadows as shadow } from "./auth/_tokens";


/* ─── Design tokens (derived) ───────────────────────────────────────────
 * Source of truth lives in src/auth/_tokens.ts. Aliased under short
 * names so the rest of the file's JSX needs no per-property edits —
 * only the binding changes. If a token like `inkFaint` ever shifts for
 * WCAG, every alias on this page picks it up automatically (no more
 * drift between local copies). */
const c = {
  surface: T.pageBg,         // app-shell canvas (sidebar + main content)
  graphite: T.white,         // raised cards (header bar, tables, panels)
  border: T.line,            // hairlines
  accent: T.indigo,
  accentDark: T.indigoDeep,
  ink: T.coal,               // primary text
  inkSoft: T.inkSoft,        // secondary text
  sage: T.success,
  ember: T.error,
  indigo: T.indigo,
  indigo100: T.indigo100,
  cream: T.cream,
  creamSoft: T.creamSoft,
} as const;
const font = {
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
  jobs: () => { import("./DashboardJobs"); },
  settings: () => { import("./DashboardSettings"); },
};

/* ─── Sidebar Nav Items ───
 * Matches the Figma sidebar's two clusters: a primary route list, and a
 * secondary list (Help & Support, Settings) pinned above the plan card.
 * Figma's active-item color is the old editorial orange; kept indigo
 * here per the documented copper→indigo
 * retirement (tempo/CLAUDE.md), not a missed detail. */
const navItems = [
  { id: "dashboard", path: "/dashboard", label: "Dashboard" },
  { id: "sessions", path: "/sessions", label: "Sessions" },
  { id: "calendar", path: "/calendar", label: "Calendar" },
  { id: "analytics", path: "/analytics", label: "Analytics" },
  { id: "resume", path: "/resume", label: "Resume" },
  { id: "jobs", path: "/jobs", label: "Jobs" },
];
const secondaryNavItems = [
  { id: "settings", path: "/settings", label: "Settings" },
];
const allNavItems = [...navItems, ...secondaryNavItems];

function NavIcon({ id }: { id: string }) {
  const props = { size: 18, "aria-hidden": true as const };
  switch (id) {
    case "dashboard": return <LayoutDashboardIcon {...props} />;
    case "sessions": return <ClipboardListIcon {...props} />;
    case "calendar": return <CalendarIcon {...props} />;
    case "analytics": return <TrendingUpIcon {...props} />;
    case "resume": return <FileTextIcon {...props} />;
    case "jobs": return <BriefcaseIcon {...props} />;
    case "settings": return <SettingsIcon {...props} />;
    default: return null;
  }
}

export default function DashboardLayout({ children }: { children?: React.ReactNode }) {
  const nav = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout: authLogout, user, updateUser: authUpdateUser, loading: authLoading } = useAuth();
  // Use focused hooks instead of aggregate useDashboard() — prevents this
  // layout from re-rendering when unrelated state (e.g. recentSessions poll)
  // changes. Each sub-context only notifies when ITS slice changes.
  const { displayName, persisted } = useDashboardCore();
  const { calendarEvents, refreshSessions } = useDashboardSessions();
  const { isFree, isStarter, sessionsUsed, sessionsRemaining, starterRemaining, sessionsThisWeek, creditBalance, creditsLoaded } = useDashboardSubscription();
  // True once auth has fully resolved AND the tier is set. Gating on
  // !authLoading prevents the card from briefly showing the wrong colour
  // (green → orange flicker) when practiceTimestamps are still stale from
  // the localStorage cache and the DB profile hasn't arrived yet.
  // The localStorage tier cache (AuthContext cacheTier) seeds subscriptionTier
  // into the fallback user object on every load after the first, so the
  // skeleton only shows for the brief window until authLoading goes false.
  const tierKnown = !!user && user.subscriptionTier !== undefined && !authLoading;
  const {
    isMobile,
    showUpgradeModal, setShowUpgradeModal,
    paymentBanner, setPaymentBanner,
    syncError, setSyncError,
    toast, setCreditBalanceDirect, refreshCreditBalance,
  } = useDashboardUI();

  // Auto-open upgrade modal when arriving from ?upgrade=1 (e.g. the
  // post-session report upgrade nudge navigates here). Strip the param
  // from the URL immediately so a page refresh doesn't re-open it.
  useEffect(() => {
    if (searchParams?.get("upgrade") === "1") {
      setShowUpgradeModal(true);
      nav.replace(pathname ?? "/dashboard");
    }
  }, [searchParams, pathname, setShowUpgradeModal, nav]);

  // Refetch sessions AND credit balance on every mount (returning from /interview,
  // navigating back from session report, etc.).  Always fetch — don't gate on
  // creditsLoaded: when the layout remounts after an interview the Context resets
  // creditsLoaded→false and the old guard caused the refresh to silently skip,
  // leaving a stale/consumed balance on screen until a full page reload.
  useEffect(() => {
    refreshSessions();
    refreshCreditBalance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSessions, refreshCreditBalance]);

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

  const [helpOpen, setHelpOpen] = useState(false);
  const [helpFeedback, setHelpFeedback] = useState("");
  const [helpType, setHelpType] = useState<"bug" | "feature" | "billing" | "other">("other");
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

  // Determine active nav from current route
  const activeNav = (() => {
    const path = pathname;
    if (path === "/dashboard" || path === "/dashboard/") return "dashboard";
    const match = allNavItems.find(item => item.path !== "/dashboard" && path === item.path);
    return match?.id || "dashboard";
  })();

  /* Exhausted-quota states — used to switch the plan card from a
     punitive "limit reached" framing to a calm "all done" achievement. */
  const starterExhausted = tierKnown && isStarter && starterRemaining === 0;
  const freeExhausted = tierKnown && isFree && sessionsRemaining === 0;
  // Primary plan-card CTA (rendered by the else branch below) — label + matching
  // tooltip/aria derived from plan state. See planCardCopy.ts for the rules.
  const primaryCtaLabel = planCtaLabel({ starterExhausted, freeExhausted, creditBalance });
  const primaryCtaTitle = planCtaTitle(primaryCtaLabel);

  return (
    // 100dvh accounts for the mobile Safari URL bar — 100vh leaves a
    // 60-80px gap at the bottom when the bar collapses. The vh value
    // is the fallback for pre-iOS 15.4 / Android <108.
    <TooltipProvider delayDuration={0}>
    <SidebarProvider style={{ height: "100dvh", minHeight: "100vh", background: c.surface, overflow: "hidden" }}>
      {/* Preload Razorpay checkout script so it's cached before the user clicks Upgrade */}
      <link rel="preload" href="https://checkout.razorpay.com/v1/checkout.js" as="script" crossOrigin="anonymous" />
      <a href="#dashboard-main" style={{
        position: "absolute", left: -9999, top: "auto", width: 1, height: 1, overflow: "hidden",
        zIndex: 100, padding: "12px 24px", background: c.accent, color: c.graphite,
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

      {/* Sidebar — shadcn shell shared across every (dashboard) route.
          collapsible="icon" shrinks to an icon-only rail instead of the
          default fully-offscreen slide, matching shadcn's sidebar-07
          reference; SidebarRail gives the collapsed rail its own drag/
          click-to-expand affordance. */}
      <Sidebar collapsible="icon" className="border-none">
        <aside aria-label="Navigation sidebar" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <SidebarHeader className="px-3 pt-4 pb-3">
          <Link href="/" className="pl-1.5 group-data-[collapsible=icon]:pl-0" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            <Image src="/wordmark.png" alt="HireStepX" width={387} height={108} className="group-data-[collapsible=icon]:hidden" style={{ height: 24, width: "auto" }} />
            <Image src="/favicon.svg" alt="HireStepX" width={24} height={24} className="hidden group-data-[collapsible=icon]:block" style={{ height: 24, width: 24 }} />
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <nav aria-label="Main navigation">
            <SidebarMenu className="gap-1">
              {navItems.map((item) => (
                <SidebarMenuItem key={item.id} style={{ position: "relative" }}>
                  {activeNav === item.id && (
                    <span aria-hidden="true" style={{ position: "absolute", left: -8, top: 4, width: 3, height: 24, borderRadius: "0 3px 3px 0", background: c.accent }} />
                  )}
                  <SidebarMenuButton
                    isActive={activeNav === item.id}
                    aria-current={activeNav === item.id ? "page" : undefined}
                    onClick={() => nav.push(item.path)}
                    onMouseEnter={() => prefetchMap[item.id]?.()}
                    aria-label={item.label}
                    tooltip={item.label}
                    style={{
                      height: 40, gap: 10, fontFamily: font.ui, fontSize: 14,
                      fontWeight: activeNav === item.id ? 600 : 500,
                      color: activeNav === item.id ? c.accent : c.inkSoft,
                      background: activeNav === item.id ? c.graphite : "transparent",
                      border: activeNav === item.id ? `1px solid ${c.border}` : "1px solid transparent",
                      borderRadius: 8,
                    }}
                  >
                    <NavIcon id={item.id} />
                    <span className="group-data-[collapsible=icon]:hidden" style={{ position: "relative" }}>
                      {item.label}
                      {item.id === "calendar" && hasUrgentInterview && (
                        <span style={{ position: "absolute", top: -2, right: -10, width: 7, height: 7, borderRadius: "50%", background: c.ember, border: `2px solid ${c.graphite}` }} />
                      )}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            </nav>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-2">
        {/* Secondary nav — Settings is a route like the primary items above. */}
        <div className="px-3" style={{ marginBottom: 4 }}>
          <SidebarMenu className="gap-1">
            {secondaryNavItems.map((item) => (
              <SidebarMenuItem key={item.id} style={{ position: "relative" }}>
                {activeNav === item.id && (
                  <span aria-hidden="true" style={{ position: "absolute", left: -8, top: 4, width: 3, height: 24, borderRadius: "0 3px 3px 0", background: c.accent }} />
                )}
                <SidebarMenuButton
                  isActive={activeNav === item.id}
                  aria-current={activeNav === item.id ? "page" : undefined}
                  onClick={() => nav.push(item.path)}
                  onMouseEnter={() => prefetchMap[item.id]?.()}
                  aria-label={item.label}
                  tooltip={item.label}
                  style={{
                    height: 40, gap: 10, fontFamily: font.ui, fontSize: 14,
                    fontWeight: activeNav === item.id ? 600 : 500,
                    color: activeNav === item.id ? c.accent : c.inkSoft,
                    background: activeNav === item.id ? c.surface : "transparent",
                    border: activeNav === item.id ? `1px solid ${c.border}` : "1px solid transparent",
                    borderRadius: 8,
                  }}
                >
                  <NavIcon id={item.id} />
                  <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>

        {/* Plan Status — white card, indigo accents throughout. No tinted backgrounds;
            state (exhausted / low / healthy) is communicated through the usage row
            and dash bar, not the card surface color. Hidden in the icon-only
            collapsed rail — there's no room for its text rows. */}
        <div className="group-data-[collapsible=icon]:hidden" style={{ padding: "14px", borderRadius: 12,
          background: c.graphite,
          border: `1px solid ${c.border}`,
          flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
            {isStarter ? (
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            ) : (
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.accent} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/></svg>
            )}
            <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 700, letterSpacing: "0.01em", color: c.accent }}>
              {!tierKnown ? "Loading plan…" : isStarter ? "Starter Plan" : "Free Plan"}
            </span>
            {/* Renewal / end date — ember if cancelling, muted stone otherwise */}
            {tierKnown && isStarter && user?.subscriptionEnd && (
              <span
                aria-label={user.cancelAtPeriodEnd
                  ? `Plan ends ${new Date(user.subscriptionEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} — access until then`
                  : `Sprint Pack valid till ${new Date(user.subscriptionEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                style={{ marginLeft: "auto", fontFamily: font.ui, fontSize: 10, whiteSpace: "nowrap",
                  color: user.cancelAtPeriodEnd ? c.ember : c.inkSoft,
                  opacity: user.cancelAtPeriodEnd ? 0.9 : 0.65 }}
              >
                {/* Starter is a one-off Sprint Pack — it expires, it doesn't renew. */}
                {user.cancelAtPeriodEnd ? "Ends" : "Valid till"}{" "}
                {new Date(user.subscriptionEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </span>
            )}
          </div>
          {/* ── Session usage block ── */}
          {!tierKnown ? (
            <div aria-hidden="true" style={{ height: 56, marginBottom: 12 }} />
          ) : (() => {
            const planUsedRaw   = isStarter ? sessionsThisWeek : sessionsUsed;
            const planTotal     = isStarter ? STARTER_WEEKLY_LIMIT : FREE_SESSION_LIMIT;
            /* Cap display at planTotal — a user may have more sessions than the plan
               limit (grandfathered usage, manual grants) but showing "117/40" is confusing. */
            const planUsed      = Math.min(planUsedRaw, planTotal);
            const planLeft      = isStarter ? starterRemaining : sessionsRemaining;
            const planExhausted = isStarter ? starterExhausted : freeExhausted;
            const periodLabel   = isStarter ? "in this pack" : "total";
            // planName kept for potential future use (e.g. aria labels, tooltips).
            const pct  = Math.min(100, (planUsed / planTotal) * 100);
            const isLow = !planExhausted && (
              (isStarter && planLeft <= 2) || (isFree && planLeft <= 1)
            );
            // barFill: matches the "N of N" text — ember when exhausted or low, indigo when healthy.
            const barFill = (planExhausted || isLow) ? c.ember : c.accent;


            return (
              <>
                {/* ── Row 1: "Sessions used" label + remaining count ── */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                  <p
                    aria-live="polite"
                    style={{ fontFamily: font.ui, fontSize: 11, lineHeight: 1.4, margin: 0,
                      color: isLow ? c.ember : c.inkSoft,
                      fontWeight: isLow ? 600 : 400,
                      opacity: planExhausted ? 0.65 : 1 }}
                  >
                    Sessions used
                  </p>
                  <span style={{ fontFamily: font.mono, fontSize: 11,
                    color: planExhausted ? c.ember : isLow ? c.ember : c.inkSoft,
                    opacity: planExhausted ? 0.75 : 1, fontWeight: planExhausted ? 600 : 400 }}>
                    {planUsed} of {planTotal}
                  </span>
                </div>

                {/* ── Smooth progress bar — always visible ── */}
                <div
                  role="progressbar"
                  aria-label={planExhausted
                    ? `All ${planTotal} sessions used ${periodLabel}`
                    : `${planUsed} of ${planTotal} sessions used ${periodLabel}`}
                  aria-valuenow={Math.round(pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  style={{ height: 4, borderRadius: 2, background: c.border, marginBottom: 10, marginTop: 6, overflow: "hidden" }}
                >
                  <div style={{
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 2,
                    background: barFill,
                    transition: "width 0.4s ease",
                  }} />
                </div>

                {/* ── Extra sessions available — always visible ──
                    Green + bold when credits exist. Muted with 0 when none —
                    so users always see the row and know purchased credits are a thing. */}
                {(() => {
                  const hasCredits = creditBalance > 0;
                  return (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 10, marginTop: planExhausted ? 6 : 2,
                      padding: "8px 11px",
                      background: hasCredits ? T.success100 : "rgba(180,83,9,0.06)",
                      border: hasCredits ? "1px solid rgba(21,128,61,0.22)" : "1px solid rgba(180,83,9,0.18)",
                      borderRadius: 8 }}>
                      <span style={{ fontFamily: font.ui, fontSize: 11, display: "flex", alignItems: "center", gap: 5,
                        color: hasCredits ? T.successInk : T.copper }}>
                        {hasCredits ? (
                          <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        )}
                        Extra sessions available
                      </span>
                      <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 800, letterSpacing: "-0.01em",
                        color: hasCredits ? c.sage : T.copper, opacity: hasCredits ? 1 : 0.55 }}>
                        {creditBalance}
                      </span>
                    </div>
                  );
                })()}

                {/* Sprint Pack footnote — a one-off pack that does NOT renew and
                    does NOT reset weekly. The plan name + validity date already
                    live in the card header and the "N of 5" count in the usage
                    row, so this line carries only the pack's one-off nature —
                    never the pack SIZE, which used to read as availability
                    directly above a buy CTA. Empty once the pack is spent
                    (exhaustion is already stated by the red usage row + buy
                    CTA), so only render when the footnote is non-empty. */}
                {isStarter && starterPackFootnote(starterRemaining) && (
                  <p style={{ fontFamily: font.ui, fontSize: 10, color: c.inkSoft,
                    marginBottom: 10, marginTop: -6 }}>
                    {starterPackFootnote(starterRemaining)}
                  </p>
                )}
              </>
            );
          })()}
          {/* Hold skeleton until BOTH tier and credit balance are known — avoids
              a flash of "Buy sessions" for users who have credits but whose balance
              hasn't loaded yet (creditBalance defaults to 0 before the fetch resolves). */}
          {(!tierKnown || !creditsLoaded) ? (
            <div aria-hidden="true" style={{ width: "100%", height: 32, borderRadius: 8, background: c.border, opacity: 0.4 }} />
          ) : isStarter && !starterExhausted ? (
            /* Active Starter with sessions remaining — no upsell, Pro isn't purchasable */
            null
          ) : (
            /* Free upsell or exhausted Starter: label + tooltip follow plan state.
               An exhausted Sprint Pack gets a pack-consistent "Buy more sessions"
               (opens the pack/credit modal), not a mismatched "Upgrade to Pro". */
            <Button
              size="sm"
              className="w-full"
              onClick={() => setShowUpgradeModal(true)}
              title={primaryCtaTitle}
              aria-label={primaryCtaLabel}
            >{primaryCtaLabel}</Button>
          )}
        </div>

        {/* User info — bordered white card matching Figma's sidebar footer;
            the chevrons-up-down trigger opens Log out as a menu item. */}
        <div className="px-3 group-data-[collapsible=icon]:px-0.5" style={{ marginTop: 8, paddingBottom: 16, flexShrink: 0 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="justify-between p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  gap: 8, background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 8,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 4, background: T.copper, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 500, color: T.white }}>{(displayName || "?")[0].toUpperCase()}</span>
                  </span>
                  <span className="group-data-[collapsible=icon]:hidden" style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 500, color: c.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</p>
                    <p style={{ fontFamily: font.ui, fontSize: 12, color: c.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{user?.targetRole || persisted.targetRole || "Set your target role"}</p>
                  </span>
                </span>
                <ChevronsUpDownIcon size={12} aria-hidden="true" className="group-data-[collapsible=icon]:hidden" style={{ flexShrink: 0, color: c.inkSoft }} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" style={{ width: 215 }}>
              <DropdownMenuItem onClick={() => { authLogout(); }}>
                <LogOutIcon size={14} aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </SidebarFooter>
        </aside>
        <SidebarRail />
      </Sidebar>

      {/* Main Content */}
      <SidebarInset id="dashboard-main" tabIndex={-1} className="dash-main" style={{ padding: isMobile ? "0 16px" : "0 16px 0 0", display: "flex", flexDirection: "column", height: "100dvh", minHeight: "100vh", overflow: "hidden", background: c.surface }}>

        {/* Top bar — sidebar toggle + current page label */}
        <header style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: isMobile ? "12px 16px" : "0 16px",
          height: 62, boxSizing: "border-box", flexShrink: 0,
          background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 8,
          marginTop: 8, marginBottom: 16,
        }}>
          <SidebarTrigger aria-label="Toggle navigation" style={{ color: c.ink }} />
          <Separator orientation="vertical" style={{ height: 16 }} />
          <Breadcrumb style={{ flex: 1 }}>
            <BreadcrumbList style={{ fontFamily: font.ui, fontSize: 13 }}>
              <BreadcrumbItem>
                <BreadcrumbPage style={{ fontSize: 15, fontWeight: 600, color: c.ink }}>
                  {allNavItems.find((item) => item.id === activeNav)?.label || "HireStepX"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button variant="ghost" size="icon" aria-label="Messages" aria-disabled="true" title="Not wired yet">
            <MailIcon size={24} aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Notifications" aria-disabled="true" title="Not wired yet">
            <BellIcon size={24} aria-hidden="true" />
          </Button>
        </header>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflowY: "auto", paddingBottom: isMobile ? 16 : 24 }}>
        {/* Payment success/cancel banner */}
        {paymentBanner && (
          <div role="alert" style={{ padding: "12px 16px", marginBottom: 16, borderRadius: 10, background: paymentBanner === "success" ? T.success100 : T.error100, border: `1px solid ${paymentBanner === "success" ? "rgba(21,128,61,0.22)" : "rgba(185,28,28,0.22)"}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
            <Button variant="ghost" size="icon-xs" onClick={() => setPaymentBanner(null)} aria-label="Dismiss banner">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Button>
          </div>
        )}

        {/* Sync error banner */}
        {syncError && (
          <div role="alert" style={{ padding: "10px 16px", marginBottom: 16, borderRadius: 8, background: T.error100, border: "1px solid rgba(185,28,28,0.2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.ember} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style={{ fontFamily: font.ui, fontSize: 12, color: c.ember }}>{syncError}</span>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => setSyncError("")} aria-label="Dismiss sync error">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Button>
          </div>
        )}

        {isOffline && (
          <div role="alert" style={{ padding: "10px 16px", marginBottom: 16, borderRadius: 8, background: c.creamSoft, border: "1px solid rgba(126,141,152,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.inkSoft} strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
            <span style={{ fontFamily: font.ui, fontSize: 12, color: c.inkSoft }}>You're offline — some features may be unavailable</span>
          </div>
        )}
        <div key={pathname} className="dash-page-enter" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
        </div>
      </SidebarInset>

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <UpgradeModal
          onClose={() => setShowUpgradeModal(false)}
          sessionsUsed={sessionsUsed}
          user={user}
          currentTier={user?.subscriptionTier || "free"}
          starterExhausted={starterExhausted}
          onPaymentSuccess={(tier, start, end) => {
            setShowUpgradeModal(false);
            setPaymentBanner("success");
            setTimeout(() => setPaymentBanner(null), 8000);
            authUpdateUser({ subscriptionTier: tier as "starter", subscriptionStart: start, subscriptionEnd: end });
          }}
          onCreditPurchase={(newBalance) => {
              // Directly apply the balance the server just reported — no DB
              // round-trip, no race condition between modal close and re-fetch.
              setCreditBalanceDirect(newBalance);
              // Belt-and-suspenders: also re-read from DB shortly after so
              // that a page refresh doesn't revert to 0 if the RLS SELECT
              // policy wasn't warmed yet. The direct set above wins the race
              // for the current session; the re-read corrects any mismatch.
              setTimeout(() => refreshCreditBalance(), 1500);
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
          <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: c.ink }}>{toast}</span>
        </div>
      )}

      {/* Floating help widget */}
      <div style={{ position: "fixed", bottom: "max(24px, env(safe-area-inset-bottom))", right: "max(24px, env(safe-area-inset-right))", zIndex: 80 }}>
        {helpOpen && (
          <div role="dialog" aria-modal="true" aria-label="Help and support" style={{
            width: 340, marginBottom: 12,
            background: T.white, border: `1px solid ${c.border}`, borderRadius: 16,
            overflow: "hidden", boxShadow: shadow.modal,
            animation: "slideDown 0.2s ease",
          }}>
            {/* Header strip — indigo tint gives panel immediate identity */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px",
              background: T.indigo100, borderBottom: `1px solid ${T.indigoRing}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: T.indigo, display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.white} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <h3 style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 700, color: T.indigoDeep, margin: 0, letterSpacing: "-0.01em" }}>Help & Support</h3>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setHelpOpen(false)} aria-label="Close help panel" style={{ color: T.indigo }}>
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </Button>
            </div>

            {/* Body */}
            <div style={{ padding: "18px 18px 16px" }}>
              {/* Type label */}
              <p style={{ fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: c.inkSoft, margin: "0 0 10px", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                What&apos;s on your mind?
              </p>

              {/* Type selector — 2×2 icon+label grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                {([
                  {
                    key: "bug" as const, label: "Bug report",
                    icon: <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l1.5 1.5"/><path d="M14.5 3.5L16 2"/><path d="M9 7.5h6"/><path d="M12 7.5v13"/><path d="M7.5 10.5H4a2 2 0 0 0-2 2v1a6 6 0 0 0 6 6h8a6 6 0 0 0 6-6v-1a2 2 0 0 0-2-2h-3.5"/><path d="M4.5 7.5A3.5 3.5 0 0 1 8 4h8a3.5 3.5 0 0 1 3.5 3.5"/></svg>,
                    inactiveBg: "rgba(185,28,28,0.06)", inactiveColor: T.error,
                    activeBg: T.error100, activeColor: T.error, activeBdr: `1px solid rgba(185,28,28,0.3)`,
                  },
                  {
                    key: "feature" as const, label: "Feature idea",
                    icon: <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
                    inactiveBg: T.indigo100, inactiveColor: T.indigo,
                    activeBg: T.indigo100, activeColor: T.indigo, activeBdr: `1px solid ${T.indigoRing}`,
                  },
                  {
                    key: "billing" as const, label: "Billing",
                    icon: <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
                    inactiveBg: T.indigo100, inactiveColor: T.indigo,
                    activeBg: T.indigo100, activeColor: T.indigo, activeBdr: `1px solid ${T.indigoRing}`,
                  },
                  {
                    key: "other" as const, label: "Other",
                    icon: <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
                    inactiveBg: T.creamSoft, inactiveColor: c.inkSoft,
                    activeBg: T.indigo100, activeColor: T.indigo, activeBdr: `1px solid ${T.indigoRing}`,
                  },
                ]).map(({ key, label, icon, inactiveBg, inactiveColor, activeBg, activeColor, activeBdr }) => {
                  const active = helpType === key;
                  return (
                    <Button
                      key={key}
                      variant="ghost"
                      aria-pressed={active}
                      onClick={() => setHelpType(key)}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        justifyContent: "flex-start",
                        height: "auto", padding: "9px 11px", borderRadius: 8,
                        fontFamily: font.ui, fontSize: 12, fontWeight: active ? 700 : 500,
                        transition: "all 0.15s", textAlign: "left" as const,
                        background: active ? activeBg : inactiveBg,
                        color: active ? activeColor : inactiveColor,
                        border: active ? activeBdr : `1px solid transparent`,
                        opacity: active ? 1 : 0.7,
                      }}
                    >
                      {icon}
                      {label}
                    </Button>
                  );
                })}
              </div>

              {/* Textarea */}
              <textarea
                rows={3}
                placeholder={helpType === "bug" ? "What happened? What did you expect?" : helpType === "feature" ? "Describe the feature you'd like..." : helpType === "billing" ? "Describe your billing question..." : "How can we help?"}
                value={helpFeedback}
                onChange={(e) => { setHelpFeedback(e.target.value); if (helpSent) setHelpSent(false); }}
                maxLength={500}
                style={{
                  width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8,
                  background: T.white, border: `1px solid ${c.border}`,
                  color: c.ink, fontFamily: font.ui, fontSize: 13, resize: "none",
                  outline: "none", transition: "border-color 0.15s", lineHeight: 1.55,
                  marginBottom: 10,
                  boxShadow: "inset 0 1px 3px rgba(14,12,8,0.04)",
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = T.indigoRing}
                onBlur={(e) => e.currentTarget.style.borderColor = c.border}
              />

              {/* Send / success */}
              {helpSent ? (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 12px", borderRadius: 8,
                  background: T.success100, border: `1px solid rgba(21,128,61,0.2)`,
                }}>
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <p style={{ fontFamily: font.ui, fontSize: 12, color: T.success, margin: 0, fontWeight: 500 }}>Sent! We&apos;ll get back to you soon.</p>
                </div>
              ) : (
                <Button
                  className="w-full"
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
                        type: helpType,
                      });
                      if (!res.ok) throw new Error(res.error || "send failed");
                      setHelpFeedback("");
                      setHelpType("other");
                      setHelpSent(true);
                    } catch {
                      // Persisted path failed — fall back to the user's email client
                      // so the feedback isn't lost.
                      navigator.clipboard?.writeText("hello@hirestepx.com").catch(() => {});
                    } finally {
                      setHelpSending(false);
                    }
                  }}
                >
                  {helpSending ? "Sending..." : "Send Feedback"}
                </Button>
              )}

              {/* Secondary email fallback */}
              <p style={{ fontFamily: font.ui, fontSize: 11, color: c.inkSoft, textAlign: "center" as const, margin: "10px 0 0" }}>
                Or email{" "}
                <CopyEmailLink email="hello@hirestepx.com" style={{ color: T.indigo, textDecoration: "none", fontWeight: 500 }} />
              </p>
            </div>
          </div>
        )}

        {/* FAB button */}
        <Button
          size="icon-lg"
          className="rounded-full"
          onClick={() => setHelpOpen(v => !v)}
          aria-label={helpOpen ? "Close help" : "Open help"}
          style={{
            background: c.graphite, color: c.ink,
            boxShadow: shadow.cta,
            marginLeft: "auto",
          }}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </Button>
      </div>

    </SidebarProvider>
    </TooltipProvider>
  );
}
