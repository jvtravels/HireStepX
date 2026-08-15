"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../AuthContext";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { EmployerWordmark } from "./_atoms";
import { useEmployerData } from "./EmployerDataContext";

const navItems = [
  { key: "dashboard", label: "Dashboard", href: "/employer" },
  { key: "jobs", label: "Jobs", href: "/employer/jobs" },
  { key: "settings", label: "Settings", href: "/employer/settings" },
];

const SIDEBAR_WIDTH = 220;

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
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

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
          <div style={{ display: "flex", alignItems: "center", gap: 16, justifySelf: "end" }}>
            <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{user?.name}</span>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: `1px solid ${t.lineStrong}`,
                background: "transparent",
                color: t.coal,
                fontFamily: f.sans,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          </div>
        </header>
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: t.cream }}>
      {isMobile && (
        <header
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: `1px solid ${t.line}`,
            background: t.white,
            zIndex: 21,
          }}
        >
          <button
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((v) => !v)}
            style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "transparent", cursor: "pointer" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={t.coal} strokeWidth="1.75" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <EmployerWordmark />
          <div style={{ width: 32 }} />
        </header>
      )}

      {isMobile && sidebarOpen && (
        <div
          role="button"
          aria-label="Close navigation menu"
          tabIndex={0}
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSidebarOpen(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(14,12,8,0.45)", zIndex: 19 }}
        />
      )}

      <aside
        aria-label="Employer navigation sidebar"
        inert={isMobile && !sidebarOpen ? true : undefined}
        aria-hidden={isMobile && !sidebarOpen}
        style={{
          width: SIDEBAR_WIDTH,
          borderRight: `1px solid ${t.line}`,
          padding: "20px 14px 0",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          background: t.white,
          zIndex: 20,
          transform: isMobile ? (sidebarOpen ? "translateX(0)" : "translateX(-100%)") : "translateX(0)",
          transition: "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <Link href="/employer" style={{ display: "flex", width: "fit-content", paddingLeft: 6, marginBottom: 24, textDecoration: "none" }}>
          <EmployerWordmark />
        </Link>
        <nav aria-label="Employer navigation" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  fontFamily: f.sans,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: active ? t.indigoDeep : t.inkSoft,
                  background: active ? t.indigo100 : "transparent",
                  textDecoration: "none",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ borderTop: `1px solid ${t.line}`, padding: "14px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.name}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${t.lineStrong}`,
              background: "transparent",
              color: t.coal,
              fontFamily: f.sans,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Log out
          </button>
        </div>
      </aside>

      <main
        style={{
          marginLeft: isMobile ? 0 : SIDEBAR_WIDTH,
          padding: isMobile ? "76px 20px 40px" : "40px 32px",
        }}
      >
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>{children}</div>
      </main>
    </div>
  );
}
