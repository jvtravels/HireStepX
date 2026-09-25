"use client";

import React, { useState } from "react";
import { tokens as t, fonts as f } from "../auth/_tokens";
import { Card, EmployerWordmark, PrimaryCta, StageDot } from "./_atoms";
import { Button } from "@/components/ui/button";

/* Proposed employer console navigation — sidebar destinations do not all
   exist as real routes yet (Saved Talent, Messages, Payments). This screen
   is a UI-only prototype of the "Opportunities" surface built from the
   same tokens/atoms as the live EmployerShell (src/employer/EmployerShell.tsx)
   rather than the shell itself, so it doesn't change live app-wide nav. */

const Icon = {
  Home: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-8 9 8" /><path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  ),
  Briefcase: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /><line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  ),
  Bookmark: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
    </svg>
  ),
  Message: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Payments: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  ),
  Help: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 1.7-2.4 3.2" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Settings: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  PanelLeft: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" /><line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  ),
  Bell: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  Search: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  Filter: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7" /><circle cx="9" cy="7" r="2" fill={t.white} />
      <line x1="4" y1="17" x2="20" y2="17" /><circle cx="16" cy="17" r="2" fill={t.white} />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Edit: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  ),
  Archive: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" /><line x1="10" y1="13" x2="14" y2="13" />
    </svg>
  ),
  ChevronsUpDown: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 15l5 5 5-5" /><path d="M7 9l5-5 5 5" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
};

const SIDEBAR_WIDTH = 232;

const navPrimary = [
  { key: "dashboard", label: "Dashboard", icon: <Icon.Home /> },
  { key: "opportunities", label: "Opportunities", icon: <Icon.Briefcase /> },
  { key: "saved-talent", label: "Saved Talent", icon: <Icon.Bookmark /> },
  { key: "messages", label: "Messages", icon: <Icon.Message /> },
  { key: "payments", label: "Payments", icon: <Icon.Payments /> },
];

const navSecondary = [
  { key: "help", label: "Help & Support", icon: <Icon.Help /> },
  { key: "settings", label: "Settings", icon: <Icon.Settings /> },
];

function Sidebar({ active }: { active: string }) {
  const item = (key: string, label: string, icon: React.ReactNode) => {
    const isActive = key === active;
    return (
      <button
        key={key}
        type="button"
        aria-current={isActive ? "page" : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          borderRadius: 10,
          border: "none",
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          fontFamily: f.sans,
          fontSize: 14,
          fontWeight: isActive ? 600 : 500,
          color: isActive ? t.coal : t.inkSoft,
          background: isActive ? t.creamSoft : "transparent",
        }}
      >
        <span style={{ display: "inline-flex", flexShrink: 0 }}>{icon}</span>
        {label}
      </button>
    );
  };

  return (
    <aside
      aria-label="Employer navigation"
      style={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        borderRight: `1px solid ${t.line}`,
        display: "flex",
        flexDirection: "column",
        padding: "20px 16px 16px",
        boxSizing: "border-box",
        minHeight: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 24px" }}>
        <EmployerWordmark />
        <span style={{ color: t.inkFaintWeak, display: "inline-flex" }}>
          <Icon.PanelLeft />
        </span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {navPrimary.map((n) => item(n.key, n.label, n.icon))}
      </nav>

      <div style={{ flex: 1 }} />

      <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
        {navSecondary.map((n) => item(n.key, n.label, n.icon))}
      </nav>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          borderRadius: 12,
          border: `1px solid ${t.line}`,
          background: t.creamRaised,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: t.indigoDeep,
            color: t.white,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: f.serif,
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          F
        </div>
        <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Flexio Company
        </span>
        <span style={{ color: t.inkFaint, display: "inline-flex" }}>
          <Icon.ChevronsUpDown />
        </span>
      </div>
    </aside>
  );
}

function TopBar() {
  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 28px",
        borderBottom: `1px solid ${t.line}`,
        background: t.white,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.inkSoft }}>
        <Icon.Briefcase />
        <span style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Opportunities</span>
      </div>
      <Button type="button" variant="ghost" size="icon" aria-label="Notifications" style={{ borderRadius: 999, color: t.inkSoft }}>
        <Icon.Bell />
      </Button>
    </header>
  );
}

type Stage = "matching" | "review" | "interviewing" | "hired";

const stageMeta: Record<Stage, { tone: "indigo" | "copper" | "violet" | "success"; label: string }> = {
  matching: { tone: "indigo", label: "Matching" },
  review: { tone: "copper", label: "Review" },
  interviewing: { tone: "violet", label: "Interviewing" },
  hired: { tone: "success", label: "Hired" },
};

interface Opportunity {
  id: string;
  title: string;
  type: string;
  duration: string;
  hours: string;
  rate: string;
  location: string;
  stage: Stage;
  headline: string;
  subline: { text: string; tone?: "success" | "error" } | null;
  detail: string;
  nextStep: string;
  updated: string;
}

const opportunities: Opportunity[] = [
  {
    id: "saas-onboarding",
    title: "Saas Onboarding Design",
    type: "Project",
    duration: "6 Weeks",
    hours: "20hrs/week",
    rate: "₹80,000/month",
    location: "Remote",
    stage: "matching",
    headline: "12 recommended",
    subline: { text: "4 Available Now", tone: "success" },
    detail: "4 Strong Matches",
    nextStep: "Continue Matching",
    updated: "2hr ago",
  },
  {
    id: "product-designer",
    title: "Product Designer",
    type: "Contract",
    duration: "16 Weeks",
    hours: "30hrs/week",
    rate: "₹1,20,000/month",
    location: "Bengaluru/Hybrid",
    stage: "review",
    headline: "8 Recommended",
    subline: { text: "0 Available Now", tone: "error" },
    detail: "4 Strong Matches",
    nextStep: "Review Candidates",
    updated: "15m ago",
  },
  {
    id: "ux-research-intern",
    title: "UX Research Intern",
    type: "Internship",
    duration: "12 Weeks",
    hours: "20hrs/week",
    rate: "₹20,000/month",
    location: "Mumbai/Hybrid",
    stage: "interviewing",
    headline: "5 Shortlisted",
    subline: { text: "3 Interviews", tone: "success" },
    detail: "2 Pending",
    nextStep: "View Interviews",
    updated: "1hr ago",
  },
  {
    id: "brand-identity-1",
    title: "Brand Identity System",
    type: "Freelance",
    duration: "4 Weeks",
    hours: "15hrs/week",
    rate: "₹45,000 fixed",
    location: "Remote",
    stage: "review",
    headline: "10 Recommended",
    subline: { text: "5 Available Now", tone: "success" },
    detail: "2 Strong Matches",
    nextStep: "Review Candidates",
    updated: "3hr ago",
  },
  {
    id: "website-redesign",
    title: "Website Redesign",
    type: "Contract",
    duration: "6 Weeks",
    hours: "20hrs/week",
    rate: "₹60,000 fixed",
    location: "Remote",
    stage: "hired",
    headline: "1 Hired",
    subline: { text: "4 Interviewed", tone: "success" },
    detail: "Completed",
    nextStep: "View Outcome",
    updated: "2m ago",
  },
  {
    id: "analytics-support",
    title: "Analytics Support",
    type: "Project",
    duration: "6 Weeks",
    hours: "20hrs/week",
    rate: "₹80,000 fixed",
    location: "Remote",
    stage: "interviewing",
    headline: "5 Shortlisted",
    subline: { text: "3 Interviews", tone: "success" },
    detail: "2 Pending",
    nextStep: "View Interviews",
    updated: "2d ago",
  },
];

const th: React.CSSProperties = {
  textAlign: "left",
  fontFamily: f.sans,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: t.inkFaint,
  padding: "14px 16px",
  background: t.creamSoft,
};

const td: React.CSSProperties = {
  padding: "16px",
  borderTop: `1px solid ${t.line}`,
  fontFamily: f.sans,
  fontSize: 13.5,
  color: t.coal,
  verticalAlign: "top",
};

function OpportunityCell({ o }: { o: Opportunity }) {
  return (
    <td style={td}>
      <div style={{ fontWeight: 600, color: t.coal }}>{o.title}</div>
      <div style={{ fontSize: 12, color: t.inkFaint, marginTop: 4 }}>
        {o.type} · {o.duration} · {o.hours}
      </div>
      <div style={{ fontSize: 12, color: t.inkFaint, marginTop: 2 }}>
        {o.rate} · {o.location}
      </div>
    </td>
  );
}

function TalentCell({ o }: { o: Opportunity }) {
  return (
    <td style={td}>
      <div style={{ fontWeight: 600, color: t.coal }}>{o.headline}</div>
      {o.subline && (
        <div style={{ fontSize: 12.5, marginTop: 4, color: o.subline.tone === "error" ? t.error : t.success, fontWeight: 600 }}>
          {o.subline.text}
        </div>
      )}
      <div style={{ fontSize: 12, color: t.inkFaint, marginTop: 2 }}>{o.detail}</div>
    </td>
  );
}

function RowActions() {
  return (
    <td style={{ ...td, textAlign: "right" }}>
      <div style={{ display: "inline-flex", gap: 8 }}>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Edit opportunity" style={{ color: t.inkSoft }}>
          <Icon.Edit />
        </Button>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Archive opportunity" style={{ color: t.inkSoft }}>
          <Icon.Archive />
        </Button>
      </div>
    </td>
  );
}

function Pagination() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px" }}>
      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>Showing 1–6 of 6 Opportunities</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Previous page">
          <Icon.ChevronLeft />
        </Button>
        <Button type="button" variant="default" size="icon-sm" aria-current="page">1</Button>
        <Button type="button" variant="outline" size="icon-sm">2</Button>
        <Button type="button" variant="outline" size="icon-sm">3</Button>
        <Button type="button" variant="outline" size="icon-sm" aria-label="Next page">
          <Icon.ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export default function OpportunitiesScreen() {
  const [search, setSearch] = useState("");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: t.white, fontFamily: f.sans }}>
      <Sidebar active="opportunities" />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <TopBar />

        <main style={{ flex: 1, padding: "32px 32px 40px", background: t.cream }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 24 }}>
            <div>
              <h1 style={{ fontFamily: f.serif, fontSize: 28, fontWeight: 400, letterSpacing: "-0.02em", color: t.coal, margin: 0 }}>
                Opportunities
              </h1>
              <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: "6px 0 0" }}>
                Manage opportunities from matching to hire.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.inkFaint }}>
                  <Icon.Search />
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search"
                  aria-label="Search opportunities"
                  style={{
                    width: 220,
                    padding: "9px 12px 9px 34px",
                    borderRadius: 10,
                    border: `1px solid ${t.line}`,
                    background: t.white,
                    fontFamily: f.sans,
                    fontSize: 13,
                    color: t.coal,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Filter opportunities"
                style={{ color: t.inkSoft }}
              >
                <Icon.Filter />
              </Button>
              <PrimaryCta icon={<Icon.Plus />}>Create</PrimaryCta>
            </div>
          </div>

          <Card pad={0} style={{ overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                <thead>
                  <tr>
                    <th style={th}>Opportunity</th>
                    <th style={th}>Stage</th>
                    <th style={th}>Talent</th>
                    <th style={th}>Next Step</th>
                    <th style={th}>Updated</th>
                    <th style={{ ...th, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((o) => {
                    const meta = stageMeta[o.stage];
                    return (
                      <tr key={o.id}>
                        <OpportunityCell o={o} />
                        <td style={td}>
                          <StageDot tone={meta.tone} label={meta.label} />
                        </td>
                        <TalentCell o={o} />
                        <td style={td}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            style={{
                              color: t.coal,
                              fontFamily: f.sans,
                              fontSize: 12.5,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {o.nextStep}
                          </Button>
                        </td>
                        <td style={{ ...td, color: t.inkFaint, fontSize: 12.5 }}>
                          <div>Last updated</div>
                          <div style={{ marginTop: 2 }}>{o.updated}</div>
                        </td>
                        <RowActions />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: `1px solid ${t.line}` }}>
              <Pagination />
            </div>
          </Card>
        </main>
      </div>
    </div>
  );
}
