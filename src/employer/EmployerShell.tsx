"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../AuthContext";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { EmployerWordmark } from "./_atoms";
import { useEmployerData } from "./EmployerDataContext";
import VerificationBanner from "./VerificationBanner";
import { ErrorPanel, PageSkeleton } from "./_consoleParts";
import LoadingScreen from "../_LoadingScreen";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { LayoutDashboardIcon, BriefcaseIcon, SettingsIcon, ChevronDownIcon, LogOutIcon } from "lucide-react";
import AppShellFrame, { type ShellNavItem } from "../AppShellFrame";

export type BreadcrumbCrumb = { label: string; path?: string };
type BreadcrumbState = { pathname: string; crumbs: BreadcrumbCrumb[] } | null;

const EmployerBreadcrumbContext = React.createContext<(state: BreadcrumbState) => void>(() => {});

/* Pages nested deeper than the shell's static section label (job details,
   candidate details, etc.) call this once their data loads to extend the
   breadcrumb past "Jobs" with the real job title / candidate name. Tagging
   each update with the pathname it was computed for (rather than clearing
   on unmount) avoids a race against EmployerShell's own re-render on
   navigation — a stale trail from the previous page is simply never read
   once pathname has moved on, with no effect-ordering to get right. */
export function useEmployerBreadcrumb(crumbs: BreadcrumbCrumb[] | null) {
  const setState = React.useContext(EmployerBreadcrumbContext);
  const pathname = usePathname();
  const key = crumbs ? JSON.stringify(crumbs) : "";
  useEffect(() => {
    setState(crumbs ? { pathname: pathname ?? "", crumbs } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pathname]);
}

/* The console renders the exact same AppShellFrame as the candidate
   dashboard (src/DashboardLayout.tsx) — one product, one shell. */
const navItems: ShellNavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/employer", icon: <LayoutDashboardIcon size={18} aria-hidden="true" /> },
  { id: "jobs", label: "Jobs", path: "/employer/jobs", icon: <BriefcaseIcon size={18} aria-hidden="true" /> },
];

/* Candidate pages each own their body card (DashboardHome's grid,
   DashboardJobs' table shell). Employer routes that render a card
   themselves are listed here; every other employer page is wrapped in the
   same white bordered card so the body reads identically across sides.
   /employer (its own maxWidth:1280 grid) and /employer/settings (its own
   narrower Card) both own their layout already — wrapping either in the
   fallback double-cards the page and, for the dashboard, caps it at the
   same 1280 the fallback itself uses, just with less usable width inside. */
const SELF_CARDED_ROUTES = ["/employer", "/employer/jobs", "/employer/requirements/new", "/employer/settings", "/employer/messages"];

/* Every requirement-scoped page (detail, edit, candidate detail, outcome
   feedback, compare) renders its own header/Card layout designed to fill
   the full main-content width. Wrapping any of them in the generic
   fallback card too produces a nested double-card look AND visibly caps
   the page at maxWidth:1280 instead of the width the page itself uses. */
function isSelfCardedRoute(pathname: string): boolean {
  return (
    SELF_CARDED_ROUTES.includes(pathname) ||
    /^\/employer\/requirements\/[^/]+(\/edit|\/outcome|\/compare|\/candidates\/[^/]+)?$/.test(pathname)
  );
}

/* Last-known "this user's company is approved" marker. On a refresh the
   profile fetch takes a moment; with the marker the shell can draw the real
   console chrome (header, sidebar) with a page skeleton inside, instead of a
   blank loader, for the common returning-employer case. Purely a paint hint:
   the fetched status still decides everything once it arrives. */
const CONSOLE_HINT_KEY = "hsx_employer_console";

function readConsoleHint(userId?: string): { name: string } | null {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(CONSOLE_HINT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && (parsed as { userId?: unknown }).userId === userId) {
      const name = (parsed as { name?: unknown }).name;
      return { name: typeof name === "string" ? name : "" };
    }
  } catch { /* storage blocked or corrupt — fall back to the neutral loader */ }
  return null;
}

function writeConsoleHint(userId: string, name: string | null) {
  try {
    if (name === null) window.localStorage.removeItem(CONSOLE_HINT_KEY);
    else window.localStorage.setItem(CONSOLE_HINT_KEY, JSON.stringify({ userId, name }));
  } catch { /* best effort */ }
}

/* Mirrors the account-menu button in src/onboarding/Panels.tsx TopBar
   (initials avatar chip + "Signed in as / Log out" dropdown) so the
   pre-onboarding employer flow reads as the same account chrome as the
   candidate onboarding flow. Built on the shared DropdownMenu so arrow-key
   navigation, Escape, focus return and outside-click all come from Radix
   instead of a hand-rolled role="menu". */
function AccountMenu({ name, email, onLogout }: { name?: string; email?: string; onLogout: () => void }) {
  const display = (name || email || "").trim();
  const initials =
    display
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  if (!display) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={`Account menu for ${display}`}
          className="h-11 max-w-full"
          style={{ borderRadius: 999, fontFamily: f.sans, color: t.coal }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 30, height: 30, borderRadius: 999, background: t.indigo100, color: t.indigo,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontFamily: f.sans, fontSize: 13, flexShrink: 0,
            }}
          >
            {initials}
          </span>
          <span className="max-[480px]:hidden" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
            {display}
          </span>
          <ChevronDownIcon size={12} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ minWidth: 200, fontFamily: f.sans }}>
        <DropdownMenuLabel style={{ fontSize: 12, color: t.inkSoft, fontWeight: 400 }}>
          Signed in as<br />
          <span style={{ color: t.coal, fontWeight: 500, overflowWrap: "anywhere" }}>{email || display}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout} className="min-h-9 pointer-coarse:min-h-11">
          <LogOutIcon size={14} aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* Until the company profile is captured (status "none") the shell uses the same bare, centered
   top bar as the candidate onboarding flow (src/onboarding/Panels.tsx
   TopBar) — no console nav, no bordered header — so signup reads as one
   continuous flow instead of dropping into a dashboard shell before the
   company profile exists. */
export default function EmployerShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { companyStatus, companyStatusLoading, companyStatusError, refreshCompanyStatus, companyName, listConversations } = useEmployerData();
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const [consoleHint] = useState(() => readConsoleHint(user?.id));
  const isConsole = companyStatus === "approved" || (companyStatusLoading && consoleHint !== null);
  const displayName = companyName || consoleHint?.name || "";

  useEffect(() => {
    if (!user?.id || companyStatusLoading || companyStatusError) return;
    writeConsoleHint(user.id, companyStatus === "approved" ? companyName : null);
  }, [user?.id, companyStatus, companyStatusLoading, companyStatusError, companyName]);

  const [breadcrumbState, setBreadcrumbState] = useState<BreadcrumbState>(null);
  const breadcrumbExtra = breadcrumbState && breadcrumbState.pathname === pathname ? breadcrumbState.crumbs : undefined;

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  /* companyStatus defaults to "none" until /api/employer-profile answers, so
     without this an approved employer's refresh would paint the bare
     onboarding frame (no nav, content centered) before snapping to the console.
     Returning employers (hint present) get the console chrome + skeleton below;
     everyone else gets the neutral loader. */
  if (companyStatusLoading && !isConsole) return <LoadingScreen message="Loading your workspace…" />;

  if (!isConsole) {
    const gutter = isMobile ? 16 : 48;
    return (
      <div style={{ minHeight: "100dvh", background: t.cream, display: "flex", flexDirection: "column" }}>
        <a href="#employer-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-3"
          style={{ background: t.indigo, color: t.white, fontFamily: f.sans, fontSize: 14, fontWeight: 600 }}>
          Skip to main content
        </a>
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            alignItems: "center",
            padding: `${isMobile ? 16 : 32}px ${gutter}px`,
            gap: 16,
          }}
        >
          <Link href="/employer" aria-label="HireStepX employer home" style={{ display: "flex", width: "fit-content", textDecoration: "none" }}>
            <EmployerWordmark />
          </Link>
          <div style={{ justifySelf: "end", minWidth: 0 }}>
            <AccountMenu name={user?.name} email={user?.email} onLogout={handleLogout} />
          </div>
        </header>
        <main
          id="employer-main"
          tabIndex={-1}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: `8px ${isMobile ? 16 : 32}px 40px`, outline: "none" }}
        >
          {companyStatusError ? (
            <ErrorPanel
              title="We couldn't load your company"
              message="Check your connection and try again. Your details are safe."
              onRetry={() => { void refreshCompanyStatus(); }}
            />
          ) : children}
        </main>
      </div>
    );
  }

  /* Settings has no navItems entry — it's only reachable via the account
     menu dropdown, not the sidebar — so it must not fall through to
     navItems[0] here, or the sidebar highlights "Dashboard" and the
     breadcrumb reads "Dashboard" while the page itself says "Settings". */
  const isSettingsRoute = pathname === "/employer/settings";
  const isMessagesRoute = pathname === "/employer/messages";
  const activeItem =
    navItems.find((item) =>
      item.path === "/employer" ? pathname === item.path : pathname === item.path || pathname?.startsWith(`${item.path}/`)
    ) ??
    (pathname?.startsWith("/employer/requirements/") ? navItems.find((item) => item.id === "jobs") : undefined) ??
    navItems[0];

  const pageBody = companyStatusLoading ? <PageSkeleton label="Loading your workspace" /> : children;

  return (
    <EmployerBreadcrumbContext.Provider value={setBreadcrumbState}>
      <AppShellFrame
        homeHref="/employer"
        navAriaLabel="Employer navigation"
        navItems={navItems}
        activeId={isSettingsRoute || isMessagesRoute ? "" : activeItem.id}
        onNavigate={(path) => router.push(path)}
        messaging={{ fetchConversations: listConversations, basePath: "/employer/messages" }}
        audience="employer"
        account={{
          name: displayName || "Employer",
          subtitle: "Employer account",
          email: user?.email,
        }}
        accountMenuItems={
          <DropdownMenuItem onClick={() => router.push("/employer/settings")}>
            <SettingsIcon size={14} aria-hidden="true" />
            Settings
          </DropdownMenuItem>
        }
        onLogout={handleLogout}
        breadcrumbRoot={{ label: displayName || "HireStepX", path: "/employer" }}
        pageLabel={isSettingsRoute ? "Settings" : isMessagesRoute ? "Messages" : activeItem.label}
        pageLabelPath={activeItem.path}
        extraCrumbs={breadcrumbExtra}
        isMobile={isMobile}
        mainId="employer-main"
        pageKey={pathname}
        banners={<VerificationBanner />}
      >
        {isSelfCardedRoute(pathname ?? "") ? pageBody : (
          <div style={{
            width: "100%", maxWidth: 1280, margin: "0 auto", boxSizing: "border-box",
            background: t.white, border: `1px solid ${t.line}`, borderRadius: 12, padding: 24,
          }}>
            {pageBody}
          </div>
        )}
      </AppShellFrame>
    </EmployerBreadcrumbContext.Provider>
  );
}
