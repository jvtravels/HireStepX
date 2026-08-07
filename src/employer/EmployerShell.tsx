"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../AuthContext";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { EmployerWordmark } from "./_atoms";
import { useEmployerData } from "./EmployerDataContext";

const navItems = [
  { key: "console", label: "Requirements", href: "/employer" },
];

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
          <Link href="/employer" style={{ display: "flex", width: "fit-content" }}>
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
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 32px",
          borderBottom: `1px solid ${t.line}`,
          background: t.white,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <Link href="/employer" style={{ display: "flex" }}>
            <EmployerWordmark />
          </Link>
          <nav style={{ display: "flex", gap: 4 }}>
            {navItems.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontFamily: f.sans,
                    fontSize: 13,
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
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
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
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 32px" }}>{children}</main>
    </div>
  );
}
