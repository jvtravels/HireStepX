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
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LayoutDashboardIcon, BriefcaseIcon, SettingsIcon, ChevronsUpDownIcon, LogOutIcon } from "lucide-react";

/* Same nav-item shape and shell pattern as src/DashboardLayout.tsx (the
   candidate-side sidebar) — the two sides are meant to read as one product,
   not two differently-built consoles. */
const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/employer", icon: LayoutDashboardIcon },
  { key: "jobs", label: "Jobs", href: "/employer/jobs", icon: BriefcaseIcon },
  { key: "settings", label: "Settings", href: "/employer/settings", icon: SettingsIcon },
];

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
  const { companyStatus } = useEmployerData();
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

  const activeItem = navItems.find((item) =>
    item.href === "/employer" ? pathname === item.href : pathname === item.href || pathname?.startsWith(`${item.href}/`)
  ) ?? navItems[0];

  const displayName = (user?.name || user?.email || "").trim();
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  return (
    <TooltipProvider delayDuration={0}>
    <SidebarProvider style={{ minHeight: "100vh", background: t.cream }}>
      {/* Sidebar — same shadcn shell as src/DashboardLayout.tsx (candidate side):
          collapsible="icon", SidebarProvider handles the mobile sheet natively. */}
      <Sidebar collapsible="icon" className="border-none">
        <SidebarHeader className="px-3 pt-4 pb-3">
          <Link href="/employer" className="pl-1.5 group-data-[collapsible=icon]:pl-0" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
            <EmployerWordmark />
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <nav aria-label="Employer navigation">
              <SidebarMenu className="gap-1">
                {navItems.map((item) => {
                  const active = item.key === activeItem.key;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        aria-current={active ? "page" : undefined}
                        tooltip={item.label}
                        style={{
                          height: 36, gap: 10, fontFamily: f.sans, fontSize: 14, fontWeight: 500,
                          color: active ? t.indigo : t.inkSoft,
                          background: active ? t.creamSoft : "transparent",
                          borderRadius: 8,
                        }}
                      >
                        <Link href={item.href}>
                          <Icon size={18} aria-hidden="true" />
                          <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg" style={{ background: t.indigo100, color: t.indigo, fontFamily: f.sans, fontWeight: 600 }}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate font-medium" style={{ fontFamily: f.sans, color: t.coal }}>{user?.name}</span>
                      <span className="truncate text-xs" style={{ fontFamily: f.sans, color: t.inkSoft }}>{user?.email}</span>
                    </div>
                    <ChevronsUpDownIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex flex-col gap-0.5 px-2 py-1.5 text-left text-sm">
                      <span className="truncate font-medium" style={{ fontFamily: f.sans, color: t.coal }}>Signed in as</span>
                      <span className="truncate text-xs" style={{ fontFamily: f.sans, color: t.inkSoft }}>{user?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOutIcon className="mr-2 size-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{activeItem.label}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main style={{ padding: 32 }}>
          <div style={{ maxWidth: 1600, margin: "0 auto" }}>{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
    </TooltipProvider>
  );
}
