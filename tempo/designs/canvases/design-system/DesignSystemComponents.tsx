/* HireStepX — Design System / Components
   Buttons · Inputs · Cards · Badges · Tags · Tooltips · Toasts · Avatars
   Every component, every state, every variant. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "./_tokens";
import { MonoLabel, SectionHead, Footer } from "./_atoms";
function StatePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
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

function StateRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        alignItems: "center",
        gap: 20,
        padding: "14px 0",
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <span
        style={{
          fontFamily: f.mono,
          fontSize: 11,
          color: t.inkSoft,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

/* Button styles inline so each state is visible */
const btnPrimary = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: t.indigo,
  color: t.white,
  border: "none",
  padding: "12px 22px",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: f.sans,
  boxShadow: shadows.cta,
  ...extra,
});
const btnSecondary = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: t.white,
  color: t.coal,
  border: `1px solid ${t.lineStrong}`,
  padding: "12px 22px",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: f.sans,
  ...extra,
});
const btnGhost = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  background: "transparent",
  color: t.indigo,
  border: "none",
  padding: "12px 22px",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: f.sans,
  ...extra,
});

const inputBase = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  width: "100%",
  padding: "12px 14px",
  border: `1px solid ${t.lineStrong}`,
  borderRadius: 10,
  fontFamily: f.sans,
  fontSize: 14,
  background: t.white,
  color: t.coal,
  outline: "none",
  ...extra,
});

/* Tag */
function Tag({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "indigo" | "copper";
}) {
  const variants: Record<string, { bg: string; fg: string }> = {
    default: { bg: t.creamSoft, fg: t.coal },
    success: { bg: t.success100, fg: t.success },
    warning: { bg: t.warning100, fg: t.warning },
    error: { bg: t.error100, fg: t.error },
    indigo: { bg: t.indigo100, fg: t.indigo },
    copper: { bg: t.copperSoft, fg: t.copper },
  };
  const { bg, fg } = variants[variant];
  return (
    <span
      style={{
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 500,
        padding: "3px 10px",
        borderRadius: 999,
        letterSpacing: "0.02em",
        fontFamily: f.sans,
      }}
    >
      {children}
    </span>
  );
}

/* Avatar */
function Avatar({
  size = 40,
  initials,
  copper,
}: {
  size?: number;
  initials: string;
  copper?: boolean;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: copper ? t.copper100 : t.indigo100,
        color: copper ? t.copper : t.indigo,
        fontFamily: f.sans,
        fontWeight: 600,
        fontSize: size * 0.36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
}

/* ─── Main ─── */

export default function DesignSystemComponents() {
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
        <header
          style={{
            borderBottom: `1px solid ${t.line}`,
            paddingBottom: 40,
            marginBottom: 64,
          }}
        >
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
            Components, by{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>state</em>.
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
            Every component you'll use, every state it can be in. Buttons,
            inputs, cards, tags, badges, toasts, tooltips, avatars. Built on
            color, typography, and foundation tokens — never invented.
          </p>
        </header>

        {/* 01 — BUTTONS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="01"
            title="Buttons"
            desc="Three variants. Three sizes. Six states. Indigo on primary — always."
          />
          <div style={{ display: "grid", gap: 16 }}>
            <StatePanel title="Variants">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button style={btnPrimary()}>Continue to practise →</button>
                <button style={btnSecondary()}>Cancel</button>
                <button style={btnGhost()}>Skip for now</button>
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: t.indigoGray,
                  marginTop: 16,
                  marginBottom: 0,
                  lineHeight: 1.6,
                }}
              >
                <b>Primary</b> for the one most-likely action. <b>Secondary</b>{" "}
                for the alternative. <b>Ghost</b> for tertiary or "skip" /
                "later" actions. One primary per surface — never two.
              </p>
            </StatePanel>

            <StatePanel title="Sizes">
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button style={btnPrimary({ padding: "8px 14px", fontSize: 13 })}>Small</button>
                <button style={btnPrimary()}>Default</button>
                <button style={btnPrimary({ padding: "16px 28px", fontSize: 15 })}>Large</button>
              </div>
            </StatePanel>

            <StatePanel title="States">
              <StateRow label="Default">
                <button style={btnPrimary()}>Continue</button>
              </StateRow>
              <StateRow label="Hover">
                <button style={btnPrimary({ background: t.indigoDeep, transform: "translateY(-1px)" })}>
                  Continue
                </button>
              </StateRow>
              <StateRow label="Pressed">
                <button style={btnPrimary({ transform: "scale(0.98)", boxShadow: "0 1px 2px rgba(20,17,10,.12)" })}>
                  Continue
                </button>
              </StateRow>
              <StateRow label="Focus">
                <button
                  style={btnPrimary({
                    boxShadow: `0 0 0 3px ${t.indigoRing}, ${shadows.cta}`,
                  })}
                >
                  Continue
                </button>
              </StateRow>
              <StateRow label="Disabled">
                <button style={btnPrimary({ opacity: 0.5, cursor: "not-allowed" })} disabled>
                  Continue
                </button>
              </StateRow>
              <StateRow label="Loading">
                <button style={btnPrimary({ paddingLeft: 38, position: "relative" })}>
                  <span
                    style={{
                      position: "absolute",
                      left: 16,
                      top: "50%",
                      width: 14,
                      height: 14,
                      marginTop: -7,
                      border: `2px solid rgba(255,255,255,.3)`,
                      borderTopColor: t.white,
                      borderRadius: "50%",
                      animation: "spin 800ms linear infinite",
                    }}
                  />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  Saving…
                </button>
              </StateRow>
              <StateRow label="Success">
                <button style={btnPrimary({ background: t.success })}>
                  ✓ Saved
                </button>
              </StateRow>
            </StatePanel>
          </div>
        </section>

        {/* 02 — INPUTS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="02"
            title="Inputs"
            desc="Email, password, search, error, disabled, autofill. Every form state."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <StatePanel title="Default">
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: t.coal,
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                Email address
              </label>
              <input
                type="email"
                placeholder="name@email.com"
                style={inputBase()}
                defaultValue="jay@hirestepx.com"
              />
            </StatePanel>

            <StatePanel title="Focused">
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: t.coal,
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                Email address
              </label>
              <input
                type="email"
                placeholder="name@email.com"
                style={inputBase({
                  borderColor: t.indigo,
                  boxShadow: `0 0 0 3px ${t.indigoRing}`,
                  background: "#FAFAF8",
                })}
                defaultValue="jay@hirestepx.com"
              />
            </StatePanel>

            <StatePanel title="Valid · live ✓">
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: t.coal,
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                Email address
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="email"
                  placeholder="name@email.com"
                  style={inputBase({ paddingRight: 40 })}
                  defaultValue="jay@hirestepx.com"
                />
                <span
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: t.success,
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  ✓
                </span>
              </div>
            </StatePanel>

            <StatePanel title="Error">
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: t.coal,
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                Email address
              </label>
              <input
                type="email"
                placeholder="name@email.com"
                style={inputBase({ borderColor: t.error })}
                defaultValue="not-an-email"
              />
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 12,
                  color: t.error,
                  fontWeight: 500,
                }}
              >
                Please enter a valid email.
              </p>
            </StatePanel>

            <StatePanel title="Password · with toggle">
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: t.coal,
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="password"
                  placeholder="••••••••"
                  style={inputBase({ paddingRight: 40 })}
                  defaultValue="securepass123"
                />
                <button
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 6,
                    color: t.inkSoft,
                  }}
                  aria-label="Show password"
                >
                  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              </div>
            </StatePanel>

            <StatePanel title="Disabled">
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  color: t.inkFaint,
                  fontWeight: 500,
                  marginBottom: 6,
                }}
              >
                Email address
              </label>
              <input
                type="email"
                placeholder="name@email.com"
                style={inputBase({
                  background: t.creamSoft,
                  color: t.inkFaint,
                  cursor: "not-allowed",
                })}
                defaultValue="locked@email.com"
                disabled
              />
            </StatePanel>
          </div>
        </section>

        {/* 03 — CARDS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="03"
            title="Cards"
            desc="Three elevations. Match content to surface — never the other way."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            <div
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 28,
                boxShadow: shadows.card,
              }}
            >
              <MonoLabel color={t.copper}>Default · interactive</MonoLabel>
              <h3
                style={{
                  fontFamily: f.serif,
                  fontSize: 22,
                  fontWeight: 500,
                  margin: "12px 0 8px",
                }}
              >
                Behavioral interview
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: t.indigoGray,
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                15-minute session. Questions tailored to your resume.
              </p>
              <div style={{ marginTop: 16 }}>
                <Tag variant="indigo">15 min</Tag>{" "}
                <Tag>Standard</Tag>
              </div>
            </div>

            <div
              style={{
                background: t.cream,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 28,
              }}
            >
              <MonoLabel>Flat · informational</MonoLabel>
              <h3
                style={{
                  fontFamily: f.serif,
                  fontSize: 22,
                  fontWeight: 500,
                  margin: "12px 0 8px",
                }}
              >
                Your weakest area
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: t.indigoGray,
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                Salary negotiation — practice this 3 more times.
              </p>
            </div>

            <div
              style={{
                background: t.indigo100,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 28,
              }}
            >
              <MonoLabel color={t.indigo}>Highlighted · premium</MonoLabel>
              <h3
                style={{
                  fontFamily: f.serif,
                  fontSize: 22,
                  fontWeight: 500,
                  margin: "12px 0 8px",
                  color: t.indigoDeep,
                }}
              >
                Pro plan
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: t.indigoDeep,
                  margin: 0,
                  lineHeight: 1.55,
                  opacity: 0.8,
                }}
              >
                Unlimited interviews. AI feedback. Priority support.
              </p>
            </div>
          </div>
        </section>

        {/* 04 — TAGS & BADGES */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="04"
            title="Tags & badges"
            desc="Pill-shaped, soft-tinted. Used for status, count, and category."
          />
          <StatePanel title="Six variants · semantic">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Tag>Default</Tag>
              <Tag variant="indigo">Indigo</Tag>
              <Tag variant="copper">Copper</Tag>
              <Tag variant="success">Success</Tag>
              <Tag variant="warning">Warning</Tag>
              <Tag variant="error">Error</Tag>
            </div>
            <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Tag variant="success">✓ Verified</Tag>
              <Tag variant="indigo">15 min</Tag>
              <Tag variant="copper">Fair · 62/100</Tag>
              <Tag variant="warning">3 sessions left</Tag>
              <Tag variant="error">Subscription expired</Tag>
              <Tag>Behavioral</Tag>
              <Tag>Standard</Tag>
              <Tag>SaaS · AI</Tag>
            </div>
          </StatePanel>
        </section>

        {/* 05 — AVATARS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="05"
            title="Avatars"
            desc="Initials on indigo or copper soft backgrounds. Three sizes."
          />
          <StatePanel title="Sizes & variants">
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <Avatar size={32} initials="JV" />
              <Avatar size={40} initials="JV" />
              <Avatar size={56} initials="JV" />
              <Avatar size={72} initials="JV" />
              <div style={{ width: 1, height: 56, background: t.line }} />
              <Avatar size={40} initials="AM" copper />
              <Avatar size={56} initials="AM" copper />
            </div>
            <p
              style={{
                fontSize: 13,
                color: t.indigoGray,
                marginTop: 20,
                marginBottom: 0,
                lineHeight: 1.6,
              }}
            >
              Default avatars use indigo-100 background with indigo text.
              Copper variant is reserved for current-user moments — top-right
              header, settings, profile screens. Never both styles on the same
              screen.
            </p>
          </StatePanel>
        </section>

        {/* 06 — TOASTS / NOTIFICATIONS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="06"
            title="Toasts & alerts"
            desc="Inline notifications. Soft-tinted backgrounds, semantic icons."
          />
          <div style={{ display: "grid", gap: 12 }}>
            {[
              {
                bg: t.success100,
                fg: t.success,
                icon: "✓",
                title: "Reset link sent.",
                body: "Check your inbox — it usually arrives within 30 seconds.",
              },
              {
                bg: t.error100,
                fg: t.error,
                icon: "!",
                title: "Couldn't sign you in.",
                body: "The email or password you entered doesn't match our records.",
              },
              {
                bg: t.warning100,
                fg: t.warning,
                icon: "⚠",
                title: "Subscription expires in 3 days.",
                body: "Renew now to keep unlimited interview access.",
              },
              {
                bg: t.indigo100,
                fg: t.indigo,
                icon: "i",
                title: "New: Salary negotiation mode.",
                body: "Practice realistic offer conversations with phase-aware AI.",
              },
            ].map((toast, i) => (
              <div
                key={i}
                style={{
                  background: toast.bg,
                  border: `1px solid ${toast.fg}33`,
                  borderRadius: 10,
                  padding: "14px 18px",
                  display: "grid",
                  gridTemplateColumns: "32px 1fr auto",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: toast.fg,
                    color: toast.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {toast.icon}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: toast.fg }}>
                    {toast.title}
                  </div>
                  <div style={{ fontSize: 13, color: t.indigoGray, marginTop: 2 }}>
                    {toast.body}
                  </div>
                </div>
                <button
                  aria-label="Dismiss"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: toast.fg,
                    cursor: "pointer",
                    fontSize: 16,
                    padding: 4,
                    opacity: 0.7,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 07 — TOOLTIPS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="07"
            title="Tooltips"
            desc="Brief, contextual. Coal background, 12px text. 200ms delay before showing."
          />
          <StatePanel title="Default tooltip">
            <div style={{ display: "flex", justifyContent: "center", padding: "30px 0" }}>
              <div style={{ position: "relative", display: "inline-block" }}>
                <button style={btnSecondary()}>Hover me</button>
                <div
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 8px)",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: t.coal,
                    color: t.cream,
                    fontSize: 12,
                    padding: "6px 10px",
                    borderRadius: 6,
                    whiteSpace: "nowrap",
                    fontFamily: f.sans,
                    fontWeight: 500,
                    boxShadow: shadows.cta,
                  }}
                >
                  Practice unlimited interviews
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      borderLeft: "5px solid transparent",
                      borderRight: "5px solid transparent",
                      borderTop: `5px solid ${t.coal}`,
                    }}
                  />
                </div>
              </div>
            </div>
          </StatePanel>
        </section>

        {/* 08 — PROGRESS */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="08"
            title="Progress"
            desc="Bars and arcs. Indigo on cream-soft. Animated width on update."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <StatePanel title="Linear · 4 segments">
              {[
                { label: "Weak", pct: 25, color: t.error },
                { label: "Fair", pct: 50, color: t.warning },
                { label: "Good", pct: 75, color: "#CA8A04" },
                { label: "Strong", pct: 100, color: t.success },
              ].map((row) => (
                <div key={row.label} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ color: t.coal, fontWeight: 500 }}>{row.label}</span>
                    <span style={{ color: t.inkSoft, fontFamily: f.mono }}>{row.pct}%</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: t.creamSoft,
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${row.pct}%`,
                        height: "100%",
                        background: row.color,
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              ))}
            </StatePanel>

            <StatePanel title="Score arc · circular">
              <div
                style={{
                  position: "relative",
                  width: 200,
                  height: 120,
                  margin: "0 auto",
                }}
              >
                <svg width="200" height="120" viewBox="0 0 200 120">
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke={t.creamSoft}
                    strokeWidth="10"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke={t.copper}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="155 1000"
                  />
                </svg>
                <div
                  style={{
                    position: "absolute",
                    top: 28,
                    left: 0,
                    right: 0,
                    textAlign: "center",
                  }}
                >
                  <MonoLabel>Clarity</MonoLabel>
                  <div
                    style={{
                      fontFamily: f.serif,
                      fontSize: 48,
                      fontWeight: 500,
                      lineHeight: 1,
                      color: t.copper,
                      marginTop: 4,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    62
                  </div>
                </div>
              </div>
            </StatePanel>
          </div>
        </section>

        {/* 09 — CHECKBOXES + RADIO */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="09"
            title="Checkboxes & radios"
            desc="Custom-styled. Indigo when checked, with subtle scale-in animation."
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <StatePanel title="Checkboxes">
              {[
                { label: "Stay signed in on this device", checked: true },
                { label: "Email me weekly tips", checked: false },
                { label: "Use my resume for personalization", checked: true },
              ].map((row, i) => (
                <label
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 0",
                    fontSize: 14,
                    cursor: "pointer",
                    color: t.coal,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      border: `1.5px solid ${row.checked ? t.indigo : t.lineStrong}`,
                      background: row.checked ? t.indigo : t.white,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {row.checked && (
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M3 8L7 12L13 4"
                          stroke="white"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  {row.label}
                </label>
              ))}
            </StatePanel>

            <StatePanel title="Radios">
              {[
                { label: "Behavioral interview", checked: true },
                { label: "Technical leadership", checked: false },
                { label: "Salary negotiation", checked: false },
              ].map((row, i) => (
                <label
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 0",
                    fontSize: 14,
                    cursor: "pointer",
                    color: t.coal,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: `1.5px solid ${row.checked ? t.indigo : t.lineStrong}`,
                      background: t.white,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {row.checked && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: t.indigo,
                        }}
                      />
                    )}
                  </span>
                  {row.label}
                </label>
              ))}
            </StatePanel>
          </div>
        </section>

        {/* 10 — EMPTY STATE */}
        <section style={{ marginBottom: 80 }}>
          <SectionHead
            num="10"
            title="Empty state"
            desc="When there's nothing yet. Calm, instructive, single primary CTA."
          />
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 14,
              padding: "64px 40px",
              boxShadow: shadows.card,
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                background: t.copper100,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                color: t.copper,
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <h3
              style={{
                fontFamily: f.serif,
                fontSize: 28,
                fontWeight: 400,
                margin: "0 0 8px",
                letterSpacing: "-0.01em",
              }}
            >
              No interviews yet.
            </h3>
            <p
              style={{
                color: t.indigoGray,
                fontSize: 14,
                margin: "0 0 28px",
                maxWidth: 380,
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.6,
              }}
            >
              Run your first mock interview in 90 seconds. Three free
              sessions, no card needed.
            </p>
            <button style={btnPrimary()}>Start your first interview →</button>
          </div>
        </section>

        {/* FOOTER */}
        <Footer section="Section" tagline="Built on color, type, foundations. Never invented." />
      </div>
    </>
  );
}
