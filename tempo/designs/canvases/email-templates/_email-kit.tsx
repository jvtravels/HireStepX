/* HireStepX — Email Templates / Shared Kit
   The redesign primitives for every transactional email. Reuses the
   canonical design tokens + atoms from the design-system canvas so the
   whole email surface stays in lockstep with the product brand:
   Instrument Serif headers, Satoshi body, indigo CTA, copper accent,
   cream receipt surfaces, one CTA, editorial layout, mobile-readable.

   These mirror the inline-HTML emails shipped from server-handlers/*.
   The HTML strings are the production source of truth; this kit is the
   designed reference the templates are built from. */
import React from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";
import { MonoLabel, SectionHead } from "../design-system/_atoms";

/* ─── Page shell — one category of emails, stacked editorial-style ─── */
export function EmailPage({
  num,
  titlePre,
  titleAccent,
  titlePost = ".",
  description,
  children,
}: {
  num: string;
  titlePre: string;
  titleAccent: string;
  titlePost?: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
        @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900&display=swap');
      `}</style>
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "72px 56px 112px",
          fontFamily: f.sans,
          color: t.coal,
          background: t.cream,
          minHeight: "100%",
        }}
      >
        <header
          style={{
            borderBottom: `1px solid ${t.line}`,
            paddingBottom: 36,
            marginBottom: 56,
          }}
        >
          <MonoLabel>Email Templates · {num}</MonoLabel>
          <h1
            style={{
              fontFamily: f.serif,
              fontSize: 52,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              margin: "12px 0 0",
            }}
          >
            {titlePre}{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>
              {titleAccent}
            </em>
            {titlePost}
          </h1>
          <p
            style={{
              color: t.indigoGray,
              fontSize: 15,
              margin: "16px 0 0",
              maxWidth: 560,
              lineHeight: 1.6,
            }}
          >
            {description}
          </p>
        </header>
        <div style={{ display: "grid", gap: 72 }}>{children}</div>
      </div>
    </>
  );
}

/* ─── One labeled email specimen: section head + rendered frame ─── */
export function EmailSpec({
  num,
  title,
  desc,
  children,
}: {
  num: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <SectionHead num={num} title={title} desc={desc} />
      {children}
    </section>
  );
}

/* ─── Email frame — a faithful client preview of the rendered email ─── */
export function EmailFrame({
  subject,
  from,
  preview,
  children,
}: {
  subject: string;
  from: string;
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        boxShadow: shadows.card,
        overflow: "hidden",
        maxWidth: 640,
      }}
    >
      {/* Mail client header */}
      <div
        style={{
          background: t.creamSoft,
          padding: "14px 24px",
          borderBottom: `1px solid ${t.line}`,
        }}
      >
        <div
          style={{
            fontFamily: f.serif,
            fontSize: 18,
            fontWeight: 500,
            color: t.coal,
            letterSpacing: "-0.01em",
          }}
        >
          {subject}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 6,
            fontSize: 12,
            color: t.inkSoft,
            flexWrap: "wrap",
          }}
        >
          <b style={{ color: t.coal, fontWeight: 500 }}>{from}</b>
          <span style={{ color: t.inkFaint }}>· {preview}</span>
        </div>
      </div>
      {/* Body */}
      <div
        style={{
          padding: "40px 44px",
          fontFamily: f.sans,
          fontSize: 15,
          lineHeight: 1.7,
          color: t.coal,
        }}
      >
        <div
          style={{
            fontFamily: f.serif,
            fontSize: 18,
            fontWeight: 500,
            color: t.coal,
            marginBottom: 28,
            paddingBottom: 22,
            borderBottom: `1px solid ${t.line}`,
            letterSpacing: "-0.01em",
          }}
        >
          HireStepX
        </div>
        {children}
        <EmailFooter />
      </div>
    </div>
  );
}

/* ─── Standard email footer — compliance + unsubscribe ─── */
export function EmailFooter() {
  return (
    <div
      style={{
        marginTop: 44,
        paddingTop: 22,
        borderTop: `1px solid ${t.line}`,
        fontSize: 12,
        color: t.inkSoft,
        lineHeight: 1.7,
      }}
    >
      You're receiving this because you have an account at hirestepx.com.
      <br />
      <EmailLink>Manage notifications</EmailLink> ·{" "}
      <EmailLink>Unsubscribe</EmailLink>
      <div style={{ marginTop: 12, color: t.inkFaint, fontSize: 11 }}>
        HireStepX · Bengaluru, India
      </div>
    </div>
  );
}

/* ─── Serif headline inside an email body ─── */
export function EmailTitle({
  size = 28,
  children,
}: {
  size?: number;
  children: React.ReactNode;
}) {
  return (
    <h1
      style={{
        fontFamily: f.serif,
        fontSize: size,
        fontWeight: 400,
        letterSpacing: "-0.02em",
        lineHeight: 1.18,
        margin: "0 0 18px",
      }}
    >
      {children}
    </h1>
  );
}

/* ─── Copper italic accent word — the one editorial flourish per email ─── */
export function Accent({ children }: { children: React.ReactNode }) {
  return (
    <em style={{ fontStyle: "italic", color: t.copper, fontWeight: 500 }}>
      {children}
    </em>
  );
}

/* ─── Inline indigo link — bottom-border underline (email-safe) ─── */
export function EmailLink({ children }: { children: React.ReactNode }) {
  return (
    <a
      style={{
        color: t.indigo,
        textDecoration: "none",
        borderBottom: `1px solid ${t.indigo}`,
      }}
    >
      {children}
    </a>
  );
}

/* ─── Bulletproof-style CTA button (rendered as inline-block <a>) ─── */
export const emailBtn: React.CSSProperties = {
  display: "inline-block",
  background: t.indigo,
  color: t.white,
  textDecoration: "none",
  padding: "13px 26px",
  borderRadius: 10,
  fontWeight: 600,
  fontSize: 14,
  marginTop: 6,
  boxShadow: shadows.cta,
};

export function EmailButton({
  children,
  tone = "indigo",
}: {
  children: React.ReactNode;
  tone?: "indigo" | "ghost";
}) {
  if (tone === "ghost") {
    return (
      <a
        style={{
          display: "inline-block",
          background: t.white,
          color: t.coal,
          textDecoration: "none",
          padding: "12px 24px",
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 14,
          marginTop: 6,
          border: `1px solid ${t.lineStrong}`,
        }}
      >
        {children}
      </a>
    );
  }
  return <a style={emailBtn}>{children}</a>;
}

/* ─── Standard body paragraph ─── */
export function P({
  children,
  muted,
  small,
}: {
  children: React.ReactNode;
  muted?: boolean;
  small?: boolean;
}) {
  return (
    <p
      style={{
        margin: "0 0 16px",
        fontSize: small ? 13 : 15,
        lineHeight: 1.7,
        color: muted ? t.indigoGray : t.coal,
      }}
    >
      {children}
    </p>
  );
}

/* ─── Bold inline fact ─── */
export function B({ children }: { children: React.ReactNode }) {
  return <b style={{ color: t.coal, fontWeight: 600 }}>{children}</b>;
}

/* ─── Key/value data block on cream surface (receipts, plan summaries) ─── */
export function DataCard({
  label,
  rows,
  tone = "cream",
}: {
  label: string;
  rows: [string, React.ReactNode][];
  tone?: "cream" | "copper" | "success" | "warning" | "error";
}) {
  const bg =
    tone === "copper"
      ? t.copperSoft
      : tone === "success"
        ? t.success100
        : tone === "warning"
          ? t.warning100
          : tone === "error"
            ? t.error100
            : t.creamSoft;
  return (
    <div
      style={{
        background: bg,
        borderRadius: 10,
        padding: "20px 24px",
        margin: "0 0 26px",
      }}
    >
      <div
        style={{
          fontFamily: f.mono,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: t.inkSoft,
          marginBottom: 14,
          fontWeight: 500,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 12,
          fontSize: 13,
        }}
      >
        {rows.map(([k, v], i) => (
          <React.Fragment key={i}>
            <span style={{ color: t.indigoGray }}>{k}</span>
            <span
              style={{ color: t.coal, textAlign: "right", fontWeight: 500 }}
            >
              {v}
            </span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─── Mono number for receipt amounts / IDs ─── */
export function Mono({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: f.mono }}>{children}</span>;
}

/* ─── Copper eyebrow row — dateline for the weekly recap ─── */
export function MonoLabelRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: f.mono,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: t.copper,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Three-up KPI row — serif copper numbers over mono caps ─── */
export function StatRow({
  stats,
}: {
  stats: { label: string; val: string }[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        gap: 12,
        margin: "0 0 28px",
        paddingBottom: 28,
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      {stats.map((kpi) => (
        <div key={kpi.label}>
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: t.inkSoft,
            }}
          >
            {kpi.label}
          </div>
          <div
            style={{
              fontFamily: f.serif,
              fontSize: 32,
              fontWeight: 500,
              color: t.copper,
              marginTop: 4,
              letterSpacing: "-0.02em",
            }}
          >
            {kpi.val}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Signature block — founder voice for the warmer emails ─── */
export function Signoff({
  name = "Jay",
  role = "Founder, HireStepX",
  note,
}: {
  name?: string;
  role?: string;
  note?: string;
}) {
  return (
    <>
      {note && (
        <p
          style={{
            margin: "30px 0 0",
            fontSize: 14,
            color: t.indigoGray,
            fontStyle: "italic",
            lineHeight: 1.6,
          }}
        >
          {note}
        </p>
      )}
      <p style={{ margin: "22px 0 0", color: t.indigoGray }}>
        Yours,
        <br />
        <span style={{ fontWeight: 600, color: t.coal }}>{name}</span>
        <br />
        <span style={{ fontSize: 13, color: t.inkSoft }}>{role}</span>
      </p>
    </>
  );
}
