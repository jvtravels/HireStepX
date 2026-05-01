/* HireStepX — Design System / Components · Advanced
   Modals · Tables · Navigation · Dropdowns · Breadcrumbs · Tabs · Pagination
   The composition layer above buttons + inputs. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
function StatePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "28px 32px",
        boxShadow: shadows.card,
      }}
    >
      <MonoLabel color={t.copper}>{title}</MonoLabel>
      <div style={{ marginTop: 20 }}>{children}</div>
    </div>
  );
}

/* ─── Main ─── */
export default function DesignSystemComponentsAdvanced() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "80px 56px 120px",
          fontFamily: f.sans,
          color: t.coal,
          background: t.cream,
        }}
      >
        {/* MASTHEAD */}
        <header style={{ borderBottom: `1px solid ${t.line}`, paddingBottom: 40, marginBottom: 64 }}>
          <MonoLabel>Design System · v1.0</MonoLabel>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: 56,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              margin: "12px 0 0",
            }}
          >
            Components,{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>composed</em>.
          </h1>
          <p
            style={{
              color: t.indigoGray,
              fontSize: 15,
              margin: "16px 0 0",
              maxWidth: 540,
              lineHeight: 1.6,
            }}
          >
            Modals, tables, navigation. The composition layer that sits above
            atomic buttons and inputs. Built from the same tokens — never
            invented.
          </p>
        </header>

        {/* 01 — MODALS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="Modals & dialogs"
            desc="Three sizes. Always centered. Always with one primary action and one escape."
          />
          <div style={{ display: "grid", gap: 16 }}>
            {[
              {
                size: "sm",
                width: 380,
                title: "Delete this session?",
                body: "Your transcript and score will be removed. This can't be undone.",
                primary: "Delete",
                primaryColor: t.error,
              },
              {
                size: "md",
                width: 480,
                title: "End interview early?",
                body: "You've answered 3 of 5 questions. We'll score what you've completed, but the report won't reflect your full readiness.",
                primary: "End and score",
                primaryColor: t.indigo,
              },
              {
                size: "lg",
                width: 600,
                title: "Upgrade to Pro",
                body: "Unlock unlimited interviews, salary negotiation mode, and full analytics. ₹149/month, cancel anytime.",
                primary: "Continue to payment",
                primaryColor: t.indigo,
              },
            ].map((m) => (
              <div
                key={m.size}
                style={{
                  background: "rgba(14, 12, 8, 0.04)",
                  border: `1px solid ${t.line}`,
                  borderRadius: 14,
                  padding: 32,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <div style={{ position: "absolute", top: 28, left: 32, zIndex: 0 }}>
                  <MonoLabel color={t.copper}>
                    Modal · {m.size} · {m.width}px
                  </MonoLabel>
                </div>
                <div
                  style={{
                    width: m.width,
                    background: t.white,
                    borderRadius: 14,
                    boxShadow: shadows.modal,
                    overflow: "hidden",
                    marginTop: 24,
                    border: `1px solid ${t.line}`,
                  }}
                >
                  <div style={{ padding: "32px 36px 24px" }}>
                    <h3
                      style={{
                        fontFamily: f.serif,
                        fontSize: 24,
                        fontWeight: 500,
                        margin: "0 0 12px",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {m.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 14,
                        color: t.indigoGray,
                        margin: 0,
                        lineHeight: 1.6,
                      }}
                    >
                      {m.body}
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "16px 24px",
                      background: t.creamSoft,
                      borderTop: `1px solid ${t.line}`,
                      display: "flex",
                      justifyContent: "flex-end",
                      gap: 10,
                    }}
                  >
                    <button
                      style={{
                        background: t.white,
                        color: t.coal,
                        border: `1px solid ${t.lineStrong}`,
                        padding: "10px 18px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        fontFamily: f.sans,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      style={{
                        background: m.primaryColor,
                        color: t.white,
                        border: "none",
                        padding: "10px 18px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: f.sans,
                      }}
                    >
                      {m.primary}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rules:</b> max 3
            sizes (380 / 480 / 600px) · always two actions (cancel + primary)
            · destructive actions get ember-red primary, never indigo · always
            trap focus inside · ESC closes · backdrop click closes (unless
            mid-form).
          </p>
        </section>

        {/* 02 — TABLES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Tables"
            desc="When data has structure. Soft borders, generous row height, copper accents on user-row metrics."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              boxShadow: shadows.card,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: t.creamSoft, borderBottom: `1px solid ${t.line}` }}>
                  {["Date", "Type", "Difficulty", "Duration", "Score", ""].map((h, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "14px 24px",
                        textAlign: i === 4 ? "right" : "left",
                        fontFamily: f.mono,
                        fontSize: 10,
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: t.inkSoft,
                      }}
                    >
                      {h}
                      {i < 4 && (
                        <span style={{ marginLeft: 6, color: t.inkFaint, fontSize: 10 }}>↕</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { date: "14 May 2026", type: "Behavioral", diff: "Standard", dur: "15 min", score: 78, delta: "+6" },
                  { date: "11 May 2026", type: "Salary negotiation", diff: "Intense", dur: "20 min", score: 62, delta: "−4" },
                  { date: "08 May 2026", type: "Technical leadership", diff: "Standard", dur: "15 min", score: 71, delta: "+3" },
                  { date: "05 May 2026", type: "Behavioral", diff: "Warmup", dur: "10 min", score: 68, delta: "+2" },
                  { date: "02 May 2026", type: "Behavioral", diff: "Standard", dur: "15 min", score: 66, delta: null },
                ].map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: `1px solid ${t.line}`,
                      transition: "background 0.18s",
                    }}
                  >
                    <td style={{ padding: "16px 24px", fontFamily: f.mono, fontSize: 12, color: t.inkSoft }}>
                      {row.date}
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 14, color: t.coal, fontWeight: 500 }}>
                      {row.type}
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 13, color: t.indigoGray }}>
                      {row.diff}
                    </td>
                    <td style={{ padding: "16px 24px", fontSize: 13, color: t.indigoGray }}>{row.dur}</td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      <span
                        style={{
                          fontFamily: f.serif,
                          fontSize: 22,
                          fontWeight: 500,
                          color: t.copper,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {row.score}
                      </span>
                      {row.delta && (
                        <span
                          style={{
                            fontSize: 11,
                            color: row.delta.startsWith("+") ? t.success : t.error,
                            marginLeft: 6,
                            fontWeight: 500,
                            fontFamily: f.mono,
                          }}
                        >
                          {row.delta}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "16px 24px", textAlign: "right" }}>
                      <a
                        style={{
                          color: t.indigo,
                          fontSize: 13,
                          fontWeight: 500,
                          textDecoration: "none",
                          borderBottom: `1px solid transparent`,
                          cursor: "pointer",
                        }}
                      >
                        View →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Table footer · pagination */}
            <div
              style={{
                padding: "14px 24px",
                background: t.creamSoft,
                borderTop: `1px solid ${t.line}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 12,
                color: t.inkSoft,
              }}
            >
              <span>Showing 5 of 12</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  style={{
                    width: 30,
                    height: 30,
                    border: `1px solid ${t.lineStrong}`,
                    background: t.white,
                    borderRadius: 6,
                    cursor: "pointer",
                    color: t.coal,
                    fontSize: 12,
                  }}
                >
                  ←
                </button>
                {[1, 2, 3].map((p) => (
                  <button
                    key={p}
                    style={{
                      width: 30,
                      height: 30,
                      border: `1px solid ${p === 1 ? t.indigo : t.lineStrong}`,
                      background: p === 1 ? t.indigo : t.white,
                      color: p === 1 ? t.white : t.coal,
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  style={{
                    width: 30,
                    height: 30,
                    border: `1px solid ${t.lineStrong}`,
                    background: t.white,
                    borderRadius: 6,
                    cursor: "pointer",
                    color: t.coal,
                    fontSize: 12,
                  }}
                >
                  →
                </button>
              </div>
            </div>
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: t.inkSoft, lineHeight: 1.6 }}>
            <b style={{ color: t.coal, fontWeight: 600 }}>Rules:</b> rows
            48-56px tall · zebra-striping NOT used (cream surface is enough) ·
            score column always right-aligned with copper Instrument Serif · sortable
            headers get ↕ glyph · pagination at the foot, not the head.
          </p>
        </section>

        {/* 03 — TOP NAV */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Top navigation"
            desc="Wordmark left · routes center · avatar right. Cream background. No box-shadow at rest."
          />
          <div
            style={{
              background: t.cream,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              overflow: "hidden",
              boxShadow: shadows.card,
            }}
          >
            <nav
              style={{
                display: "flex",
                alignItems: "center",
                padding: "16px 32px",
                borderBottom: `1px solid ${t.line}`,
                background: t.cream,
              }}
            >
              <div
                style={{
                  fontFamily: f.serif,
                  fontWeight: 500,
                  fontSize: 18,
                  color: t.coal,
                }}
              >
                HireStepX
              </div>
              <div style={{ display: "flex", gap: 24, marginLeft: 48, flex: 1 }}>
                {[
                  { label: "Practice", active: true },
                  { label: "Sessions", active: false },
                  { label: "Analytics", active: false },
                  { label: "Resume", active: false },
                ].map((item) => (
                  <a
                    key={item.label}
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: item.active ? t.coal : t.indigoGray,
                      textDecoration: "none",
                      paddingBottom: 4,
                      borderBottom: item.active ? `2px solid ${t.copper}` : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <button
                  style={{
                    background: "transparent",
                    border: "none",
                    color: t.indigoGray,
                    cursor: "pointer",
                    padding: 6,
                  }}
                  aria-label="Notifications"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </button>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: t.copper100,
                    color: t.copper,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  JV
                </div>
              </div>
            </nav>
          </div>
        </section>

        {/* 04 — SIDEBAR */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Sidebar navigation"
            desc="For dense apps. Coal background · cream-tinted active state · icon + label."
          />
          <div
            style={{
              background: t.cream,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: 24,
              boxShadow: shadows.card,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 24, alignItems: "stretch" }}>
              <aside
                style={{
                  background: t.coal,
                  borderRadius: 14,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontFamily: f.serif,
                    fontSize: 18,
                    fontWeight: 500,
                    color: t.cream,
                    padding: "10px 14px",
                    marginBottom: 12,
                  }}
                >
                  HireStepX
                </div>
                {[
                  { icon: "▶", label: "Practice", active: true },
                  { icon: "≡", label: "Sessions", active: false },
                  { icon: "▲", label: "Analytics", active: false },
                  { icon: "✎", label: "Resume", active: false },
                  { icon: "✦", label: "Calendar", active: false },
                ].map((item) => (
                  <a
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 500,
                      color: item.active ? t.cream : "rgba(250,247,240,.65)",
                      background: item.active ? "rgba(180,83,9,.16)" : "transparent",
                      cursor: "pointer",
                      borderLeft: item.active ? `2px solid ${t.copper}` : "2px solid transparent",
                      paddingLeft: item.active ? 12 : 14,
                    }}
                  >
                    <span style={{ fontSize: 14, color: item.active ? t.copper : "rgba(250,247,240,.45)" }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </a>
                ))}
                <div
                  style={{
                    marginTop: "auto",
                    paddingTop: 16,
                    borderTop: `1px solid rgba(250,247,240,.10)`,
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "16px 14px 6px",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: t.copper100,
                      color: t.copper,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    JV
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: t.cream }}>Jay Vyas</div>
                    <div style={{ fontSize: 11, color: "rgba(250,247,240,.55)" }}>Pro · 12 days</div>
                  </div>
                </div>
              </aside>
              <div
                style={{
                  background: t.cream,
                  borderRadius: 14,
                  padding: "32px 36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: t.inkSoft,
                  fontSize: 13,
                  fontStyle: "italic",
                }}
              >
                Main content area
              </div>
            </div>
          </div>
        </section>

        {/* 05 — TABS + BREADCRUMBS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Tabs & breadcrumbs"
            desc="Two ways to show hierarchy. Tabs for siblings, breadcrumbs for ancestry."
          />
          <div style={{ display: "grid", gap: 16 }}>
            <StatePanel title="Tabs · underline · default style">
              <div
                style={{
                  display: "flex",
                  gap: 32,
                  borderBottom: `1px solid ${t.line}`,
                }}
              >
                {[
                  { label: "Overview", active: true },
                  { label: "Skills", active: false },
                  { label: "Transcript", active: false },
                  { label: "Coaching tips", active: false },
                ].map((tab) => (
                  <a
                    key={tab.label}
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: tab.active ? t.coal : t.indigoGray,
                      textDecoration: "none",
                      padding: "12px 0",
                      borderBottom: tab.active ? `2px solid ${t.copper}` : "2px solid transparent",
                      cursor: "pointer",
                      marginBottom: -1,
                    }}
                  >
                    {tab.label}
                  </a>
                ))}
              </div>
            </StatePanel>

            <StatePanel title="Tabs · pill · alt style for filters">
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  background: t.creamSoft,
                  padding: 4,
                  borderRadius: 999,
                  width: "fit-content",
                }}
              >
                {[
                  { label: "All", active: true },
                  { label: "Behavioral", active: false },
                  { label: "Technical", active: false },
                  { label: "Salary", active: false },
                ].map((tab) => (
                  <button
                    key={tab.label}
                    style={{
                      background: tab.active ? t.white : "transparent",
                      color: tab.active ? t.coal : t.indigoGray,
                      border: "none",
                      padding: "8px 14px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: f.sans,
                      boxShadow: tab.active ? "0 1px 2px rgba(20,17,10,.08)" : "none",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </StatePanel>

            <StatePanel title="Breadcrumbs">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: t.indigoGray,
                }}
              >
                {["Sessions", "Behavioral · 14 May", "Skills"].map((crumb, i, arr) => (
                  <React.Fragment key={i}>
                    {i === arr.length - 1 ? (
                      <span style={{ color: t.coal, fontWeight: 500 }}>{crumb}</span>
                    ) : (
                      <a
                        style={{
                          color: t.indigo,
                          textDecoration: "none",
                          cursor: "pointer",
                          borderBottom: `1px solid transparent`,
                        }}
                      >
                        {crumb}
                      </a>
                    )}
                    {i < arr.length - 1 && (
                      <span style={{ color: t.inkFaint, fontSize: 12 }}>/</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </StatePanel>
          </div>
        </section>

        {/* 06 — DROPDOWN / SELECT */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="Dropdown · select · menu"
            desc="Coal-text on white surface. Indigo highlight on hover. Soft shadow."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <StatePanel title="Select field · closed">
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  marginBottom: 6,
                  color: t.coal,
                }}
              >
                Interview type
              </label>
              <div
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  border: `1px solid ${t.lineStrong}`,
                  borderRadius: 10,
                  fontSize: 14,
                  color: t.coal,
                  background: t.white,
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Behavioral · Standard</span>
                <span style={{ color: t.inkSoft, fontSize: 12 }}>▼</span>
              </div>
            </StatePanel>

            <StatePanel title="Select field · open">
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 500,
                  marginBottom: 6,
                  color: t.coal,
                }}
              >
                Interview type
              </label>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    border: `1px solid ${t.indigo}`,
                    boxShadow: `0 0 0 3px ${t.indigoRing}`,
                    borderRadius: 10,
                    fontSize: 14,
                    color: t.coal,
                    background: t.white,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span>Behavioral · Standard</span>
                  <span style={{ color: t.indigo, fontSize: 12 }}>▲</span>
                </div>
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    right: 0,
                    background: t.white,
                    border: `1px solid ${t.line}`,
                    borderRadius: 10,
                    boxShadow: shadows.modal,
                    overflow: "hidden",
                    zIndex: 10,
                  }}
                >
                  {[
                    { label: "Behavioral · Warmup", check: false },
                    { label: "Behavioral · Standard", check: true },
                    { label: "Behavioral · Intense", check: false },
                    { label: "Technical leadership", check: false },
                    { label: "Salary negotiation", check: false },
                  ].map((opt, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        fontSize: 13,
                        color: opt.check ? t.indigo : t.coal,
                        background: opt.check ? t.indigo100 : t.white,
                        fontWeight: opt.check ? 500 : 400,
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>{opt.label}</span>
                      {opt.check && <span style={{ color: t.indigo, fontSize: 14 }}>✓</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ height: 200 }} />
            </StatePanel>
          </div>
        </section>

        {/* 07 — SEARCH */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="07"
            title="Search & command"
            desc="Header search · in-page filter · Cmd-K command palette."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <StatePanel title="Header search · default">
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search sessions, skills, companies…"
                  style={{
                    width: "100%",
                    padding: "12px 14px 12px 40px",
                    border: `1px solid ${t.lineStrong}`,
                    borderRadius: 10,
                    fontSize: 14,
                    background: t.white,
                    color: t.coal,
                    fontFamily: f.sans,
                    outline: "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: t.inkSoft,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                </span>
                <kbd
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontFamily: f.mono,
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: t.creamSoft,
                    border: `1px solid ${t.line}`,
                    color: t.inkSoft,
                  }}
                >
                  ⌘K
                </kbd>
              </div>
            </StatePanel>

            <StatePanel title="Command palette · open">
              <div
                style={{
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 10,
                  boxShadow: shadows.modal,
                  overflow: "hidden",
                }}
              >
                <input
                  type="text"
                  placeholder="Type a command or search…"
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    border: "none",
                    borderBottom: `1px solid ${t.line}`,
                    fontSize: 14,
                    color: t.coal,
                    fontFamily: f.sans,
                    outline: "none",
                    background: "transparent",
                  }}
                />
                <div style={{ padding: "6px 0" }}>
                  {[
                    { icon: "▶", label: "Start practice session", shortcut: "⌘N" },
                    { icon: "≡", label: "View all sessions", shortcut: null, active: true },
                    { icon: "▲", label: "Open analytics", shortcut: null },
                    { icon: "✎", label: "Update resume", shortcut: null },
                  ].map((cmd, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        background: cmd.active ? t.creamSoft : "transparent",
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ color: t.inkSoft, fontSize: 14 }}>{cmd.icon}</span>
                      <span style={{ flex: 1, color: t.coal, fontWeight: cmd.active ? 500 : 400 }}>
                        {cmd.label}
                      </span>
                      {cmd.shortcut && (
                        <kbd
                          style={{
                            fontFamily: f.mono,
                            fontSize: 10,
                            padding: "2px 6px",
                            borderRadius: 3,
                            background: t.creamSoft,
                            border: `1px solid ${t.line}`,
                            color: t.inkSoft,
                          }}
                        >
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </StatePanel>
          </div>
        </section>

        {/* 08 — POPOVER + DROPDOWN MENU */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="08"
            title="Popover · context menu"
            desc="When triggered by an action button. Lifted with shadow-modal. Indigo highlight on hover."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <StatePanel title="Avatar dropdown">
              <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
                <div style={{ position: "relative" }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: t.copper100,
                      color: t.copper,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    JV
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      width: 220,
                      background: t.white,
                      border: `1px solid ${t.line}`,
                      borderRadius: 10,
                      boxShadow: shadows.modal,
                      overflow: "hidden",
                      zIndex: 10,
                    }}
                  >
                    <div style={{ padding: "14px 16px", borderBottom: `1px solid ${t.line}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.coal }}>Jay Vyas</div>
                      <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 2 }}>jay@hirestepx.com</div>
                    </div>
                    {[
                      { label: "Profile", icon: "○" },
                      { label: "Settings", icon: "✦" },
                      { label: "Billing · Pro", icon: "₹", indigo: true },
                      { label: "Help & support", icon: "?" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: t.coal,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <span style={{ color: item.indigo ? t.copper : t.inkSoft, width: 14 }}>
                          {item.icon}
                        </span>
                        {item.label}
                      </div>
                    ))}
                    <div
                      style={{
                        padding: "10px 16px",
                        fontSize: 13,
                        color: t.error,
                        cursor: "pointer",
                        borderTop: `1px solid ${t.line}`,
                      }}
                    >
                      Sign out
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ height: 200 }} />
            </StatePanel>

            <StatePanel title="Row context menu (•••)">
              <div style={{ position: "relative", display: "flex", justifyContent: "flex-end" }}>
                <div style={{ position: "relative" }}>
                  <button
                    style={{
                      background: t.white,
                      border: `1px solid ${t.line}`,
                      borderRadius: 8,
                      width: 32,
                      height: 32,
                      cursor: "pointer",
                      color: t.coal,
                      fontSize: 16,
                      letterSpacing: "0.1em",
                    }}
                  >
                    •••
                  </button>
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      width: 180,
                      background: t.white,
                      border: `1px solid ${t.line}`,
                      borderRadius: 10,
                      boxShadow: shadows.modal,
                      overflow: "hidden",
                      zIndex: 10,
                    }}
                  >
                    {[
                      { label: "View report", default: true },
                      { label: "Re-analyze", default: false },
                      { label: "Share link", default: false },
                      { label: "Export PDF", default: false },
                    ].map((item, i) => (
                      <div
                        key={i}
                        style={{
                          padding: "10px 16px",
                          fontSize: 13,
                          color: t.coal,
                          cursor: "pointer",
                          background: item.default ? t.creamSoft : "transparent",
                        }}
                      >
                        {item.label}
                      </div>
                    ))}
                    <div
                      style={{
                        padding: "10px 16px",
                        fontSize: 13,
                        color: t.error,
                        cursor: "pointer",
                        borderTop: `1px solid ${t.line}`,
                      }}
                    >
                      Delete session
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ height: 200 }} />
            </StatePanel>
          </div>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="One primary action · ESC closes · Coal text · Copper accents." />
      </div>
    </>
  );
}
