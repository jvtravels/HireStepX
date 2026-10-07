"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../AuthContext";
import { tokens as t, fonts as f, shadows } from "../auth/_tokens";
import { EmployerWordmark } from "./_atoms";
import { useEmployerData } from "./EmployerDataContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { LayoutDashboardIcon, BriefcaseIcon, SettingsIcon } from "lucide-react";
import AppShellFrame, { type ShellNavItem } from "../AppShellFrame";

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

/* Mirrors the account-menu button in src/onboarding/Panels.tsx TopBar
   (initials avatar chip + "Signed in as / Log out" dropdown) so the
   pre-approval employer flow reads as the same account chrome as the
   candidate onboarding flow, not a different, plainer pattern. */
function AccountMenu({ name, email, onLogout }: { name?: string; email?: string; onLogout: () => void }) {
  const display = (name || email || "").trim();
  const initials =
    display
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (!display) return null;

  return (
    <div ref={menuRef} style={{ position: "relative" }}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant={menuOpen ? "outline" : "ghost"}
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Account: ${display}`}
              style={{ borderRadius: 999, fontFamily: f.sans, color: t.coal }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: t.indigo100,
                  color: t.indigo,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: f.sans,
                  fontSize: 13,
                }}
              >
                {initials}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                {display}
              </span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{display}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {menuOpen && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            minWidth: 200,
            background: t.white,
            border: `1px solid ${t.line}`,
            borderRadius: 10,
            boxShadow: shadows.card,
            padding: 6,
            zIndex: 20,
            fontFamily: f.sans,
          }}
        >
          <div style={{ padding: "6px 10px", fontSize: 12, color: t.inkSoft, borderBottom: `1px solid ${t.line}`, marginBottom: 4 }}>
            Signed in as<br />
            <span style={{ color: t.coal, fontWeight: 500 }}>{email || display}</span>
          </div>
          <Button
            type="button"
            role="menuitem"
            variant="ghost"
            onClick={() => { setMenuOpen(false); onLogout(); }}
            style={{ width: "100%", justifyContent: "flex-start", fontFamily: f.sans, color: t.coal }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}

/* Pre-approval states (none/pending/rejected) use the same bare, centered
   top bar as the candidate onboarding flow (src/onboarding/Panels.tsx
   TopBar) — no console nav, no bordered header — so signup reads as one
   continuous flow instead of dropping into a dashboard shell before the
   company is even approved. */
export default function EmployerShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { companyStatus, companyName, listConversations } = useEmployerData();
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const isConsole = companyStatus === "approved";

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (!isConsole) {
    return (
      <div style={{ minHeight: "100vh", background: t.cream, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            padding: "32px 48px",
            gap: 16,
          }}
        >
          <Link href="/employer" style={{ display: "flex", width: "fit-content", textDecoration: "none" }}>
            <EmployerWordmark />
          </Link>
          <div style={{ justifySelf: "end" }}>
            <AccountMenu name={user?.name} email={user?.email} onLogout={handleLogout} />
          </div>
        </header>
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 32px 40px" }}>
          {children}
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

  return (
    <AppShellFrame
      homeHref="/employer"
      navAriaLabel="Employer navigation"
      navItems={navItems}
      activeId={isSettingsRoute || isMessagesRoute ? "" : activeItem.id}
      onNavigate={(path) => router.push(path)}
      messaging={{ fetchConversations: listConversations, basePath: "/employer/messages" }}
      account={{
        name: companyName || "Employer",
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
      breadcrumbRoot={{ label: companyName || "HireStepX", path: "/employer" }}
      pageLabel={isSettingsRoute ? "Settings" : isMessagesRoute ? "Messages" : activeItem.label}
      isMobile={isMobile}
      mainId="employer-main"
      pageKey={pathname}
    >
      {isSelfCardedRoute(pathname ?? "") ? children : (
        <div style={{
          width: "100%", maxWidth: 1280, margin: "0 auto", boxSizing: "border-box",
          background: t.white, border: `1px solid ${t.line}`, borderRadius: 12, padding: 24,
        }}>
          {children}
        </div>
      )}
    </AppShellFrame>
  );
}
