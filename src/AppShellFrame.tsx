import { Fragment, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import { tokens as T, fonts as F } from "./auth/_tokens";
import { dur, ease } from "./_motion";
import NotificationBell from "./NotificationBell";
import MessagesBell, { type ConversationSummary } from "./MessagesBell";

/* ─── Shared app shell ───────────────────────────────────────────────────
 * The sidebar + header + scrolling body used by BOTH the candidate
 * dashboard (DashboardLayout.tsx) and the employer console
 * (employer/EmployerShell.tsx). Each side supplies its own nav items,
 * account menu entries and page-level extras; the chrome itself lives
 * only here so the two consoles can't drift apart visually. */

const c = {
  surface: T.pageBg,
  graphite: T.white,
  border: T.line,
  accent: T.indigo,
  ink: T.coal,
  inkSoft: T.inkSoft,
} as const;

export interface ShellNavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ReactNode;
  /** Small dot on the label (e.g. an urgent upcoming interview). */
  alert?: boolean;
}

interface AppShellFrameProps {
  homeHref: string;
  navAriaLabel: string;
  navItems: ShellNavItem[];
  activeId: string;
  onNavigate: (path: string) => void;
  onNavHover?: (id: string) => void;
  /** Rendered above the account button (candidate side: plan card). */
  sidebarFooterExtra?: React.ReactNode;
  account: { name: string; subtitle: string; email?: string };
  /** Extra account-menu entries rendered above "Log out". */
  accountMenuItems?: React.ReactNode;
  onLogout: () => void;
  /** Powers the header's message icon (next to the notification bell). */
  messaging: { fetchConversations: () => Promise<ConversationSummary[] | null>; basePath: string };
  /** Which console this shell is — scopes the notification bell so an
   *  employer-only notification (e.g. "New strong match found") never shows
   *  up on the candidate side and vice versa, which matters for any account
   *  that is both (dual-role test accounts, or a future employer-who-also-
   *  interviews feature). */
  audience: "candidate" | "employer";
  breadcrumbRoot: { label: string; path: string };
  pageLabel: string;
  /** Where pageLabel navigates to when extraCrumbs make it a clickable
   *  mid-trail segment instead of the bold current page. Defaults to
   *  breadcrumbRoot.path when omitted. */
  pageLabelPath?: string;
  /** Extra segments rendered after pageLabel for pages nested deeper than
   *  the shell's static section label (e.g. a job title, then a candidate
   *  name). Each needs a path to be clickable; the last segment is always
   *  rendered as the bold, non-clickable current page regardless of path. */
  extraCrumbs?: { label: string; path?: string }[];
  isMobile: boolean;
  mainId: string;
  /** Changing this re-runs the page-enter animation. */
  pageKey?: string | null;
  /** Rendered at the top of the scrolling body (alerts/banners). */
  banners?: React.ReactNode;
  /** Rendered inside the provider after the main inset (modals, toasts, palette). */
  overlays?: React.ReactNode;
  children?: React.ReactNode;
}

export default function AppShellFrame({
  homeHref, navAriaLabel, navItems, activeId, onNavigate, onNavHover,
  sidebarFooterExtra, account, accountMenuItems, onLogout, messaging, audience,
  breadcrumbRoot, pageLabel, pageLabelPath, extraCrumbs, isMobile, mainId, pageKey, banners, overlays, children,
}: AppShellFrameProps) {
  const initial = (account.name || "?")[0].toUpperCase();

  /* The scrollable content div below persists across navigations (only the
     `pageKey`-keyed child inside it remounts), so its scrollTop carries over
     from whatever page the user last scrolled — a new page can open already
     scrolled past its own header. Reset it whenever pageKey changes.
     Must be a layout effect: a plain effect fires after paint, so the new
     page would flash on-screen at the old scroll offset (its heading
     clipped above the fold) for one frame before snapping to top. */
  const scrollRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [pageKey]);

  return (
    // 100dvh accounts for the mobile Safari URL bar — 100vh leaves a
    // 60-80px gap at the bottom when the bar collapses. The vh value
    // is the fallback for pre-iOS 15.4 / Android <108.
    <TooltipProvider delayDuration={0}>
    <SidebarProvider className="app-vh" style={{ background: c.surface, overflow: "hidden" }}>
      <a href={`#${mainId}`} style={{
        position: "absolute", left: -9999, top: "auto", width: 1, height: 1, overflow: "hidden",
        zIndex: 100, padding: "12px 24px", background: c.accent, color: c.graphite,
        fontFamily: F.sans, fontSize: 14, fontWeight: 600, borderRadius: 8, textDecoration: "none",
      }} onFocus={(e) => { e.currentTarget.style.left = "16px"; e.currentTarget.style.top = "16px"; e.currentTarget.style.width = "auto"; e.currentTarget.style.height = "auto"; }}
        onBlur={(e) => { e.currentTarget.style.left = "-9999px"; e.currentTarget.style.width = "1px"; e.currentTarget.style.height = "1px"; }}>
        Skip to main content
      </a>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {/* collapsible="icon" shrinks to an icon-only rail instead of the
          default fully-offscreen slide (shadcn sidebar-07). SidebarRail is
          intentionally omitted — it produced a stray "Toggle Sidebar"
          title-tooltip over page content, and the visible SidebarTrigger
          already covers the toggle action. */}
      <Sidebar collapsible="icon" className="border-none">
        <aside aria-label="Navigation sidebar" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <SidebarHeader className="px-3 pt-4 pb-3">
          <Link href={homeHref} className="pl-1.5 group-data-[collapsible=icon]:pl-0" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            <Image src="/wordmark.png" alt="HireStepX" width={387} height={108} priority className="group-data-[collapsible=icon]:hidden" style={{ height: 32, width: "auto" }} />
            <Image src="/favicon.svg" alt="HireStepX" width={28} height={28} className="hidden group-data-[collapsible=icon]:block" style={{ height: 28, width: 28 }} />
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <nav aria-label={navAriaLabel}>
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
                const active = activeId === item.id;
                return (
                  <SidebarMenuItem key={item.id} style={{ position: "relative" }}>
                    {active && (
                      <span aria-hidden="true" style={{ position: "absolute", left: -8, top: 4, width: 3, height: 24, borderRadius: "0 3px 3px 0", background: c.accent, animation: "fadeIn 0.15s ease" }} />
                    )}
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                    >
                      <Link
                        href={item.path}
                        aria-current={active ? "page" : undefined}
                        onClick={() => onNavigate(item.path)}
                        onMouseEnter={(e) => { onNavHover?.(item.id); if (!active) e.currentTarget.style.background = c.border; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
                        onTouchStart={() => onNavHover?.(item.id)}
                        aria-label={item.alert ? `${item.label} (new activity)` : item.label}
                        style={{
                          height: 36, gap: 10, fontFamily: F.sans, fontSize: 14,
                          fontWeight: 500,
                          color: active ? c.accent : c.inkSoft,
                          background: active ? c.border : "transparent",
                          borderRadius: 8,
                          transition: `background ${dur.instant} ${ease.snap}, color ${dur.instant} ${ease.snap}`,
                        }}
                      >
                        {item.icon}
                        <span className="group-data-[collapsible=icon]:hidden" style={{ position: "relative" }}>
                          {item.label}
                          {item.alert && (
                            <span aria-hidden="true" style={{ position: "absolute", top: -2, right: -10, width: 7, height: 7, borderRadius: "50%", background: T.error, border: `2px solid ${c.graphite}` }} />
                          )}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
            </nav>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-2">
        {sidebarFooterExtra}

        {/* Account — bordered white card; the chevrons-up-down trigger
            opens the account menu (settings entries + Log out). */}
        <div className="group-data-[collapsible=icon]:px-0.5" style={{ marginTop: 8, paddingBottom: 16, flexShrink: 0 }}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                aria-label="Account menu"
                className="justify-between p-2 h-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  gap: 8, textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Avatar className="rounded-md size-8 shrink-0">
                    <AvatarFallback className="rounded-md" style={{ background: T.copper, color: T.white, fontFamily: F.sans, fontSize: 14, fontWeight: 500 }}>
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="group-data-[collapsible=icon]:hidden" style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontFamily: F.sans, fontSize: 13.5, fontWeight: 600, color: c.ink, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.name}</p>
                    <p style={{ margin: 0, fontFamily: F.sans, fontSize: 12, color: c.inkSoft, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{account.subtitle}</p>
                  </span>
                </span>
                <ChevronsUpDownIcon size={12} aria-hidden="true" className="group-data-[collapsible=icon]:hidden" style={{ flexShrink: 0, color: c.inkSoft }} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" style={{ width: 240 }}>
              <DropdownMenuLabel className="p-0 font-normal">
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px" }}>
                  <Avatar className="rounded-md size-8 shrink-0">
                    <AvatarFallback className="rounded-md" style={{ background: T.copper, color: T.white, fontFamily: F.sans, fontSize: 14, fontWeight: 500 }}>
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <span style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: F.sans, fontSize: 14, fontWeight: 500, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{account.name}</p>
                    <p style={{ fontFamily: F.sans, fontSize: 12, color: c.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{account.email}</p>
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {accountMenuItems && (
                <>
                  {accountMenuItems}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={onLogout}>
                <LogOutIcon size={14} aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        </SidebarFooter>
        </aside>
      </Sidebar>

      <SidebarInset id={mainId} tabIndex={-1} className="dash-main app-vh" style={{ padding: isMobile ? "0 12px" : "0 16px 0 8px", display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden", background: c.surface }}>

        {/* Top bar — sidebar toggle + current page label */}
        <header style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: isMobile ? "0 8px" : "0 16px",
          height: 62, boxSizing: "border-box", flexShrink: 0,
          background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 8,
          marginTop: 8, marginBottom: 16,
        }}>
          <SidebarTrigger aria-label="Toggle navigation" style={{ color: c.ink }} />
          <Separator orientation="vertical" style={{ height: 16, alignSelf: "center", flexShrink: 0 }} />
          <Breadcrumb style={{ flex: 1, minWidth: 0 }}>
            <BreadcrumbList style={{ fontFamily: F.sans, fontSize: 13, flexWrap: "nowrap", overflow: "hidden", alignItems: "center" }}>
              {/* Root crumb is dropped on narrow phones so the current page label keeps the room. */}
              <BreadcrumbItem className="max-[480px]:hidden">
                <BreadcrumbLink onClick={() => onNavigate(breadcrumbRoot.path)} style={{ color: c.inkSoft, cursor: "pointer", display: "flex", alignItems: "center" }}>
                  {breadcrumbRoot.label}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="max-[480px]:hidden" />
              {extraCrumbs && extraCrumbs.length > 0 ? (
                <BreadcrumbItem>
                  <BreadcrumbLink onClick={() => onNavigate(pageLabelPath ?? breadcrumbRoot.path)} style={{ color: c.inkSoft, cursor: "pointer", display: "flex", alignItems: "center" }}>
                    {pageLabel}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage style={{ fontSize: 13, fontWeight: 600, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                    {pageLabel}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              )}
              {extraCrumbs?.map((crumb, i) => {
                const isLast = i === extraCrumbs.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${i}`}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {isLast || !crumb.path ? (
                        <BreadcrumbPage style={{ fontSize: 13, fontWeight: 600, color: c.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                          {crumb.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink onClick={() => onNavigate(crumb.path!)} style={{ color: c.inkSoft, cursor: "pointer", display: "flex", alignItems: "center" }}>
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
          <MessagesBell onNavigate={onNavigate} fetchConversations={messaging.fetchConversations} basePath={messaging.basePath} />
          <NotificationBell onNavigate={onNavigate} audience={audience} />
        </header>

        <div ref={scrollRef} style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden", paddingBottom: isMobile ? 16 : 24 }}>
          {banners}
          <div key={pageKey ?? undefined} className="dash-page-enter" style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {children}
          </div>
        </div>
      </SidebarInset>

      {overlays}
    </SidebarProvider>
    </TooltipProvider>
  );
}
