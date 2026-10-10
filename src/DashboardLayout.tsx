import { useState, useEffect, useMemo, useContext, createContext } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "./AuthContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  LayoutDashboardIcon,
  ClipboardListIcon,
  CalendarIcon,
  TrendingUpIcon,
  FileTextIcon,
  BriefcaseIcon,
  SettingsIcon,
  CreditCardIcon,
  UserPlusIcon,
} from "lucide-react";
import { DropdownMenuGroup, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { preloadRouteChunk } from "./routeChunkPreload";
import AppShellFrame from "./AppShellFrame";
import { listConversations } from "./messagesApi";
import { useDashboardCore, useDashboardSessions, useDashboardSubscription, useDashboardUI } from "./DashboardContext";
const UpgradeModal = dynamic(() => import("./dashboardComponents").then(m => ({ default: m.UpgradeModal })), { ssr: false });
import { FREE_SESSION_LIMIT, STARTER_WEEKLY_LIMIT } from "./dashboardData";
import { starterPackFootnote, planCtaLabel, planCtaTitle } from "./planCardCopy";
import { daysUntilEvent } from "./dashboardHelpers";
import { useConnectionState } from "./connectionMonitor";
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

/* ─── Sidebar Nav Items ───
 * One continuous list, rendered at full weight — matches the Figma
 * sidebar's single route list.
 * Figma's active-item color is the old editorial orange; kept indigo
 * here per the documented copper→indigo
 * retirement (tempo/CLAUDE.md), not a missed detail. */
const navItems = [
  { id: "dashboard", path: "/dashboard", label: "Dashboard" },
  { id: "sessions", path: "/sessions", label: "Sessions" },
  { id: "analytics", path: "/analytics", label: "Analytics" },
  { id: "resume", path: "/resume", label: "Your Profile" },
  { id: "jobs", path: "/jobs", label: "Jobs" },
];

const EXTRA_ROUTE_LABELS: { prefix: string; label: string }[] = [
  { prefix: "/messages", label: "Messages" },
  { prefix: "/notifications", label: "Notifications" },
  { prefix: "/settings", label: "Settings" },
  { prefix: "/referrals", label: "Referrals" },
];

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

export type DashboardBreadcrumbCrumb = { label: string; path?: string };
type DashboardBreadcrumbState = { pathname: string; crumbs: DashboardBreadcrumbCrumb[] } | null;

const DashboardBreadcrumbContext = createContext<(state: DashboardBreadcrumbState) => void>(() => {});

/* Mirrors useEmployerBreadcrumb (src/employer/EmployerShell.tsx) — pages
   nested deeper than the shell's static section label (session report,
   settings sub-section) call this once their data loads to extend the
   breadcrumb past "Sessions"/"Settings" with the real session name / tab.
   Tagging each update with the pathname it was computed for avoids a race
   against DashboardLayout's own re-render on navigation. */
export function useDashboardBreadcrumb(crumbs: DashboardBreadcrumbCrumb[] | null) {
  const setState = useContext(DashboardBreadcrumbContext);
  const pathname = usePathname();
  const key = crumbs ? JSON.stringify(crumbs) : "";
  useEffect(() => {
    setState(crumbs ? { pathname: pathname ?? "", crumbs } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pathname]);
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
  const { calendarEvents } = useDashboardSessions();
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

  // Drain any interview-turn writes that failed during a previous session
  // (network blip mid-interview, browser tab closed before save, etc.).
  // Runs once per dashboard mount; flushPendingTurns is a no-op when the
  // queue is empty and only retries each turn once before re-queueing.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { flushPendingTurns, installTurnOutboxDrain } = await import("./interviewTurns");
        installTurnOutboxDrain();
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

  // Use the same initial state on the server and browser, then sync to the
  // browser's actual network state after hydration.
  const isOffline = useConnectionState().status === "offline";


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

  // Keyboard shortcut: ⌘K / Ctrl+K opens the command palette from anywhere.
  // (⌘B is reserved by SidebarProvider for sidebar toggle — see sidebar.tsx —
  // so billing no longer shares that binding; it's reachable via the palette.)
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const extraRoute = EXTRA_ROUTE_LABELS.find(r => pathname === r.prefix || pathname?.startsWith(r.prefix + "/"));

  // Determine active nav from current route. Messages and Settings have no
  // sidebar entry (reached via the bell / account menu), so no item is
  // highlighted there instead of falling back to Dashboard.
  const activeNav = (() => {
    const path = pathname;
    if (extraRoute) return "";
    if (path === "/dashboard" || path === "/dashboard/") return "dashboard";
    // /session/[id] is the Sessions detail view, not its own nav item —
    // treat it as a sub-route of "/sessions" so the sidebar highlights
    // Sessions instead of silently falling back to Dashboard.
    if (path?.startsWith("/session/")) return "sessions";
    if (path?.startsWith("/jobs/")) return "jobs";
    const match = navItems.find(item => item.path !== "/dashboard" && path === item.path);
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

  const [breadcrumbState, setBreadcrumbState] = useState<DashboardBreadcrumbState>(null);
  const breadcrumbExtra = breadcrumbState && breadcrumbState.pathname === pathname ? breadcrumbState.crumbs : undefined;

  return (
    <DashboardBreadcrumbContext.Provider value={setBreadcrumbState}>
    <AppShellFrame
      homeHref="/"
      navAriaLabel="Main navigation"
      navItems={navItems.map((item) => ({
        ...item,
        icon: <NavIcon id={item.id} />,
        alert: item.id === "calendar" && hasUrgentInterview,
      }))}
      activeId={activeNav}
      onNavigate={(path) => nav.push(path)}
      messaging={{ fetchConversations: listConversations, basePath: "/messages" }}
      audience="candidate"
      onNavHover={(id) => {
        const path = navItems.find((item) => item.id === id)?.path;
        preloadRouteChunk(path);
        if (path) nav.prefetch(path);
      }}
      sidebarFooterExtra={
        <>
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
            // Purchased credits make the plan limit a soft ceiling, not a hard
            // wall — don't flash the alarming "limit reached" ember styling
            // when the candidate can keep practicing anyway (mirrors the
            // same guard in SessionSetup's quota banner).
            const hasCredits = creditBalance > 0;
            const isLow = !planExhausted && !hasCredits && (
              (isStarter && planLeft <= 2) || (isFree && planLeft <= 1)
            );
            const showExhaustedAlarm = planExhausted && !hasCredits;
            // barFill: matches the "N of N" text — ember when exhausted or low, indigo when healthy.
            const barFill = (showExhaustedAlarm || isLow) ? c.ember : c.accent;


            return (
              <>
                {/* ── Row 1: "Sessions used" label + remaining count ── */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                  <p
                    aria-live="polite"
                    style={{ fontFamily: font.ui, fontSize: 11, lineHeight: 1.4, margin: 0,
                      color: isLow ? c.ember : c.inkSoft,
                      fontWeight: isLow ? 600 : 400,
                      opacity: showExhaustedAlarm ? 0.65 : 1 }}
                  >
                    Sessions used
                  </p>
                  <span style={{ fontFamily: font.mono, fontSize: 11,
                    color: showExhaustedAlarm ? c.ember : isLow ? c.ember : c.inkSoft,
                    opacity: showExhaustedAlarm ? 0.75 : 1, fontWeight: showExhaustedAlarm ? 600 : 400 }}>
                    {planUsed} of {planTotal}
                  </span>
                </div>

                {/* ── Smooth progress bar — always visible ── */}
                <Progress
                  value={pct}
                  aria-label={planExhausted
                    ? `All ${planTotal} sessions used ${periodLabel}`
                    : `${planUsed} of ${planTotal} sessions used ${periodLabel}`}
                  className="h-1 rounded-sm [&_[data-slot=progress-indicator]]:bg-[var(--bar-fill)]"
                  style={{ background: c.border, marginBottom: 10, marginTop: 6, "--bar-fill": barFill } as React.CSSProperties}
                />

                {/* ── Extra sessions available — always visible ──
                    Green + bold when credits exist. Muted with 0 when none —
                    so users always see the row and know purchased credits are a thing. */}
                {(() => {
                  return (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                      marginBottom: 10, marginTop: planExhausted ? 6 : 2,
                      padding: "8px 11px",
                      background: hasCredits ? T.success100 : T.copperWash,
                      border: hasCredits ? `1px solid ${T.successLine}` : `1px solid ${T.copperMid}`,
                      borderRadius: 8 }}>
                      <span style={{ fontFamily: font.ui, fontSize: 11, display: "flex", alignItems: "center", gap: 5,
                        color: hasCredits ? T.successInk : T.copper }}>
                        {hasCredits ? (
                          <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={T.successInk} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
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
              className="w-full"
              onClick={() => setShowUpgradeModal(true)}
              title={primaryCtaTitle}
              aria-label={primaryCtaLabel}
            >{primaryCtaLabel}</Button>
          )}
        </div>

        </>
      }
      account={{
        name: displayName,
        subtitle: user?.targetRole || persisted.targetRole || "Set your target role",
        email: user?.email,
      }}
      accountMenuItems={
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => nav.push("/settings")}>
            <SettingsIcon size={14} aria-hidden="true" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => nav.push("/referrals")}>
            <UserPlusIcon size={14} aria-hidden="true" />
            Referral
          </DropdownMenuItem>
        </DropdownMenuGroup>
      }
      onLogout={() => { authLogout(); }}
      breadcrumbRoot={{ label: "HireStepX", path: "/dashboard" }}
      pageLabel={extraRoute?.label ?? (navItems.find((item) => item.id === activeNav)?.label || "Dashboard")}
      pageLabelPath={extraRoute?.prefix ?? navItems.find((item) => item.id === activeNav)?.path}
      extraCrumbs={breadcrumbExtra}
      isMobile={isMobile}
      mainId="dashboard-main"
      pageKey={pathname}
      banners={
        <>
        {/* Payment success/cancel banner */}
        {paymentBanner && (
          <Alert
            variant={paymentBanner === "success" ? "default" : "destructive"}
            className="mb-4 flex flex-row items-center justify-between"
            style={{ background: paymentBanner === "success" ? T.success100 : T.error100, borderColor: paymentBanner === "success" ? T.successLine : T.errorLine, animation: "slideDown 0.2s ease" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {paymentBanner === "success" ? (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.sage} strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              ) : (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c.ember} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              )}
              <AlertDescription style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 500, color: paymentBanner === "success" ? c.sage : c.ember }}>
                {paymentBanner === "success" ? "Payment successful! Your account has been upgraded." : "Payment was not completed. No charges were made — you can try again anytime."}
              </AlertDescription>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => setPaymentBanner(null)} aria-label="Dismiss banner">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Button>
          </Alert>
        )}

        {/* Sync error banner */}
        {syncError && (
          <Alert variant="destructive" className="mb-4 flex flex-row items-center justify-between" style={{ background: T.error100, borderColor: T.errorLine, animation: "slideDown 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.ember} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <AlertDescription style={{ fontFamily: font.ui, fontSize: 12, color: c.ember }}>{syncError}</AlertDescription>
            </div>
            <Button variant="ghost" size="icon-xs" onClick={() => setSyncError("")} aria-label="Dismiss sync error">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Button>
          </Alert>
        )}

        {isOffline && (
          <Alert className="mb-4 flex flex-row items-center gap-2" style={{ background: c.creamSoft, borderColor: "rgba(126,141,152,0.2)", animation: "slideDown 0.2s ease" }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.inkSoft} strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
            <AlertDescription style={{ fontFamily: font.ui, fontSize: 12, color: c.inkSoft }}>You&apos;re offline — your work is saved on this device and will sync when you&apos;re back</AlertDescription>
          </Alert>
        )}
        </>
      }
      overlays={
        <>
      {/* Command palette — ⌘K from anywhere, or the header's Search button */}
      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen}>
        <CommandInput placeholder="Jump to a page or action…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {navItems.map((item) => (
              <CommandItem
                key={item.id}
                onSelect={() => { setPaletteOpen(false); nav.push(item.path); }}
                onMouseEnter={() => preloadRouteChunk(item.path)}
              >
                <NavIcon id={item.id} />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={() => { setPaletteOpen(false); nav.push("/settings"); }}>
              <SettingsIcon size={16} aria-hidden="true" />
              Settings
            </CommandItem>
            <CommandItem onSelect={() => { setPaletteOpen(false); setShowUpgradeModal(true); }}>
              <CreditCardIcon size={16} aria-hidden="true" />
              Plans & billing
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Upgrade modal — preload the checkout script only once the modal is
          actually open, not on every dashboard page view (most visits never
          touch checkout at all). */}
      {showUpgradeModal && (
        <>
        <link rel="preload" href="https://checkout.razorpay.com/v1/checkout.js" as="script" crossOrigin="anonymous" />
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
        </>
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

        </>
      }
    >
      {children}
    </AppShellFrame>
    </DashboardBreadcrumbContext.Provider>
  );
}
