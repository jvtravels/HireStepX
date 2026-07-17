"use client";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { tokens as t, fonts, shadows } from "../auth/_tokens";
import { NavV2, MobileStickyCTA } from "./HomepageV2";
import { FooterDome as FinalCTAFooterV2 } from "./FooterDome";
import { captureClientEvent } from "../posthogClient";

/* ════════════════════════════════════════════════════════════════════
   HireStepX — Marketing pages v2
   Pricing · How it works · About · Contact · For Students ·
   vs ChatGPT · 404 · Legal templates
   All consume tokens from auth/_tokens.ts and reuse Nav + Footer
   from HomepageV2 so brand consistency is automatic.
   ════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────── Shared primitives ─────────────────────────── */

const container: CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  paddingLeft: 32,
  paddingRight: 32,
};

const containerNarrow: CSSProperties = {
  maxWidth: 820,
  margin: "0 auto",
  paddingLeft: 32,
  paddingRight: 32,
};

const sectionBase: CSSProperties = {
  position: "relative",
  paddingTop: 80,
  paddingBottom: 80,
};

const h1Display: CSSProperties = {
  fontFamily: fonts.serif,
  /* Was clamp(48px, 7vw, 96px) — at 1366px that's 95.6px which swallows
     40% of the viewport before pricing cards can appear. Cap at 72px and
     use a gentler vw rate so desktop headings stay bold without dominating. */
  fontSize: "clamp(48px, 5.5vw, 72px)",
  lineHeight: 1.0,
  letterSpacing: "-0.03em",
  color: t.coal,
  margin: 0,
  fontWeight: 400,
  textWrap: "balance" as const,
};

const h2: CSSProperties = {
  fontFamily: fonts.serif,
  fontSize: "clamp(36px, 4.8vw, 64px)",
  lineHeight: 1.04,
  letterSpacing: "-0.025em",
  color: t.coal,
  margin: 0,
  fontWeight: 400,
  textWrap: "balance" as const,
};

const h3: CSSProperties = {
  fontFamily: fonts.serif,
  fontSize: "clamp(24px, 2.6vw, 32px)",
  lineHeight: 1.15,
  letterSpacing: "-0.015em",
  color: t.coal,
  margin: 0,
  fontWeight: 400,
};

const eyebrow: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: t.copper,
  margin: 0,
};

const lead: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 18,
  lineHeight: 1.55,
  color: t.indigoGray,
  margin: 0,
  maxWidth: "62ch",
};

const body: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 16,
  lineHeight: 1.65,
  color: t.indigoGray,
  margin: 0,
  maxWidth: "62ch",
};

const ctaPrimary = (size: "md" | "lg" = "md"): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: fonts.sans,
  fontSize: size === "lg" ? 16 : 14,
  fontWeight: 600,
  padding: size === "lg" ? "14px 24px" : "11px 18px",
  borderRadius: 999,
  background: t.copper,
  color: t.cream,
  textDecoration: "none",
  border: 0,
  cursor: "pointer",
  boxShadow: shadows.cta,
});

const ctaGhost = (size: "md" | "lg" = "md"): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: fonts.sans,
  fontSize: size === "lg" ? 16 : 14,
  fontWeight: 600,
  padding: size === "lg" ? "14px 24px" : "11px 18px",
  borderRadius: 999,
  background: "transparent",
  color: t.coal,
  textDecoration: "none",
  border: `1px solid ${t.lineStrong}`,
  cursor: "pointer",
});

/* PageHero — single shared header used by every non-home page so the
   typographic system feels unified across the site. Eyebrow + display
   headline (with italic copper accent) + lead. */
function PageHero({
  eyebrow: eb,
  title,
  accent,
  lead: leadText,
  meta,
  narrow,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  lead?: string;
  meta?: ReactNode;
  narrow?: boolean;
}) {
  return (
    <section
      className="mv2p-page-hero"
      style={{
        position: "relative",
        paddingTop: 80,
        paddingBottom: 60,
        background: t.cream,
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      {/* Subtle radial backdrop, sits behind everything, no blur tax */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(180, 83, 9, 0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div className="mv2-container" style={{ ...(narrow ? containerNarrow : container), position: "relative" }}>
        <p style={{ ...eyebrow, marginBottom: 18 }}>{eb}</p>
        <h1 style={h1Display}>
          {title}
          {accent && (
            <>
              {" "}
              <span style={{ fontStyle: "italic", color: t.copper }}>{accent}</span>
            </>
          )}
        </h1>
        {leadText && <p style={{ ...lead, marginTop: 28 }}>{leadText}</p>}
        {meta && <div style={{ marginTop: 32 }}>{meta}</div>}
      </div>
    </section>
  );
}

/* MDXProse — typographic shell for long-form pages (legal, about, blog post).
   Caps line length, sets paragraph rhythm, scales headings down a step. */
function MDXProse({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: fonts.sans,
        fontSize: 16,
        lineHeight: 1.7,
        color: t.coal,
      }}
    >
      <style>{`
        .mv2p-prose > * + * { margin-top: 1.1em; }
        .mv2p-prose h2 { font-family: ${fonts.serif}; font-size: 28px; font-weight: 400; letter-spacing: -0.015em; color: ${t.coal}; margin-top: 2em; margin-bottom: 0.4em; line-height: 1.2; }
        .mv2p-prose h3 { font-family: ${fonts.sans}; font-size: 16px; font-weight: 700; color: ${t.coal}; margin-top: 1.6em; margin-bottom: 0.4em; letter-spacing: -0.005em; }
        .mv2p-prose p, .mv2p-prose li { color: ${t.indigoGray}; max-width: 70ch; }
        .mv2p-prose ul, .mv2p-prose ol { padding-left: 1.2em; }
        .mv2p-prose li + li { margin-top: 0.5em; }
        .mv2p-prose strong { color: ${t.coal}; font-weight: 600; }
        .mv2p-prose a { color: ${t.indigo}; text-decoration: underline; text-underline-offset: 3px; }
        .mv2p-prose code { background: ${t.creamSoft}; padding: 2px 6px; border-radius: 4px; font-family: ${fonts.mono}; font-size: 14px; color: ${t.coal}; }
        .mv2p-prose hr { border: 0; border-top: 1px solid ${t.line}; margin: 3em 0; }
        .mv2p-prose blockquote { position: relative; padding: 20px 24px 20px 56px; color: ${t.coal}; font-family: ${fonts.serif}; font-size: 20px; line-height: 1.5; font-style: italic; margin: 1.8em 0; background: ${t.creamSoft}; border: 1px solid ${t.line}; border-radius: 10px; }
        .mv2p-prose blockquote::before { content: "\\201C"; position: absolute; left: 16px; top: 4px; font-family: ${fonts.serif}; font-size: 56px; line-height: 1; color: ${t.copper}; font-style: normal; }
        .mv2p-prose blockquote > :first-child { margin-top: 0; }
        .mv2p-prose blockquote > :last-child { margin-bottom: 0; }
      `}</style>
      <div className="mv2p-prose">{children}</div>
    </div>
  );
}

/* FAQ accordion — semantic <details>, copper "+" marker that rotates
   to × on open. Matches the homepage FAQV2 design 1:1 so the accordion
   reads the same on every marketing page. */
export function FAQItem({ q, a, first }: { q: string; a: string; first?: boolean }) {
  return (
    <details
      className="mv2p-faq"
      open={first}
      style={{
        borderTop: first ? "none" : `1px solid ${t.line}`,
        padding: "20px 24px",
      }}
    >
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          fontFamily: fonts.serif,
          fontSize: 18,
          fontWeight: 400,
          color: t.coal,
          letterSpacing: "-0.01em",
        }}
      >
        {q}
        <span
          aria-hidden
          className="mv2p-faq-marker"
          style={{
            color: t.copper,
            fontSize: 22,
            fontFamily: fonts.sans,
            fontWeight: 300,
            lineHeight: 1,
            display: "inline-block",
          }}
        >
          +
        </span>
      </summary>
      <p
        style={{
          margin: "12px 0 0",
          fontFamily: fonts.sans,
          fontSize: 15,
          lineHeight: 1.65,
          color: t.inkSoft,
          maxWidth: 620,
        }}
      >
        {a}
      </p>
    </details>
  );
}

/* PageShell — wraps a page in Nav + content + Footer + mobile sticky CTA.
   Every marketing page passes children through here so the chrome is
   identical and breakpoints land in one place. */
function PageShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.cream,
        color: t.coal,
        fontFamily: fonts.sans,
        colorScheme: "light",
      }}
    >
      <PagesResponsiveSheet />
      <a href="#main" className="mv2-skip">Skip to content</a>
      <NavV2 />
      <main id="main">{children}</main>
      <FinalCTAFooterV2 />
      <MobileStickyCTA />
    </div>
  );
}

/* Responsive overrides specific to the secondary pages. Homepage already
   ships its own ResponsiveSheet inside HomepageV2; this one carries the
   page-shell-only rules so we don't double-emit. */
const PagesResponsiveSheet = () => (
  <style>{`
    /* Skip-to-content link: visually hidden until keyboard focus.
       Without this the link rendered in raw browser styling (purple
       underline at top-left of every secondary page). Mirrors the
       rule defined inside HomepageV2's ResponsiveSheet. */
    .mv2-skip { position: absolute; left: -9999px; top: 0; }
    .mv2-skip:focus { left: 16px; top: 16px; z-index: 100; background: ${t.coal}; color: ${t.cream}; padding: 10px 16px; border-radius: 8px; font-family: ${fonts.sans}; font-size: 14px; text-decoration: none; }
    /* Focus-visible ring for form inputs + interactive links/buttons.
       Targets bare elements too, so a missing .mv2p-input class never
       silently strips the focus ring. */
    .mv2p-input:focus-visible,
    main input:focus-visible,
    main select:focus-visible,
    main textarea:focus-visible {
      border-color: ${t.copper} !important;
      box-shadow: 0 0 0 3px ${t.copperSoft};
      outline: none;
    }
    /* FAQ marker: rotate the "+" into "×" when the details element opens. */
    .mv2p-faq[open] .mv2p-faq-marker { transform: rotate(45deg); }
    .mv2p-faq-marker { transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1); }
    @media (prefers-reduced-motion: reduce) {
      .mv2p-faq-marker { transition: none !important; }
    }

    @media (max-width: 640px) {
      /* Hero: cut from 80px to 48px — nav is already 68px so users still
         see 116px of context before the first word. */
      .mv2p-page-hero { padding-top: 48px !important; padding-bottom: 40px !important; }
      /* Container: match the 18px landing-page gutter so secondary pages
         feel identical to the homepage on a phone. */
      .mv2-container { padding-left: 18px !important; padding-right: 18px !important; }
      .mv2p-section { padding-top: 52px !important; padding-bottom: 52px !important; }
      .mv2p-grid-2 { grid-template-columns: 1fr !important; gap: 28px !important; }
      .mv2p-grid-3 { grid-template-columns: 1fr !important; gap: 20px !important; }
      .mv2p-grid-4 { grid-template-columns: repeat(2, 1fr) !important; gap: 16px !important; }
      .mv2p-cta-row a, .mv2p-cta-row button { width: 100% !important; justify-content: center !important; }
      .mv2p-cta-row { flex-direction: column !important; align-items: stretch !important; }
      .mv2p-pricing-row { grid-template-columns: 1fr !important; }
      /* Compare table on small screens: drop the desktop min-width so columns
         can compress instead of forcing horizontal scroll, tighten padding,
         hide tier eyebrow chrome. Keeps all four columns readable on a phone. */
      .mv2p-compare-table { font-size: 12px !important; min-width: 0 !important; }
      .mv2p-compare-table th, .mv2p-compare-table td { padding: 10px 8px !important; }
      .mv2p-compare-table th:first-child, .mv2p-compare-table td:first-child { padding-left: 12px !important; }
      .mv2p-form { grid-template-columns: 1fr !important; }
      .mv2p-stat-row { grid-template-columns: repeat(2, 1fr) !important; }
      main, footer { padding-bottom: 96px !important; }
    }
    @media (max-width: 880px) and (min-width: 641px) {
      /* Tablet: intermediate hero padding — keeps a clean editorial gap
         without the 140→80px cliff of the desktop default. */
      .mv2p-page-hero { padding-top: 64px !important; padding-bottom: 48px !important; }
      /* Container: tighten to 20px to mirror the landing-page tablet gutter. */
      .mv2-container { padding-left: 20px !important; padding-right: 20px !important; }
      .mv2p-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
      .mv2p-grid-4 { grid-template-columns: repeat(2, 1fr) !important; }
      .mv2p-form { grid-template-columns: 1fr !important; }
      .mv2p-pricing-row { grid-template-columns: repeat(2, 1fr) !important; }
    }
  `}</style>
);

/* ════════════════════════════════════════════════════════════════════
   PRICING PAGE
   Deeper than the homepage slot. 4 tiers + comparison table + FAQ.
   ════════════════════════════════════════════════════════════════════ */
export function PricingPageV2() {
  useEffect(() => {
    captureClientEvent("pricing_page_viewed", { surface: "marketing_v2" });
  }, []);

  const tiersMonthly = [
    {
      name: "Free",
      price: "₹0",
      unit: "forever",
      sub: "Try before you pay a rupee",
      features: [
        "2 mock sessions",
        "Behavioural rounds + basic STAR score",
        "Email report",
        "No credit card required",
      ],
      cta: "Start free",
      href: "/signup?plan=free",
      featured: false,
      hidden: false,
    },
    {
      name: "Per session",
      price: "₹9",
      unit: "/ session",
      sub: "One mock, zero commitment",
      features: [
        "1 mock session",
        "Voice in & out, all round types",
        "Full STAR score + report",
        "Credit never expires",
      ],
      cta: "Buy one session",
      href: "/signup?plan=single",
      featured: false,
      hidden: false,
    },
    {
      name: "Sprint Pack",
      price: "₹39",
      unit: "/ 5 sessions",
      sub: "Prep for your next interview",
      features: [
        "5 sessions · valid for 30 days · cancel anytime",
        "Voice in & out, all round types",
        "Company-specific rounds",
        "Skill-decay tracking",
        "90-day report history",
      ],
      cta: "Get Sprint Pack",
      href: "/signup?plan=weekly",
      featured: true,
      hidden: false,
    },
    {
      /* Monthly plan — hidden until re-enabled. Keep all data intact. */
      name: "Monthly",
      price: "₹149",
      unit: "/ 30 days",
      sub: "Most loved during placement season",
      features: [
        "40 sessions · 30 days",
        "Everything in Weekly",
        "Interview calendar + countdown",
        "Session history & score trends",
        "Export PDF, CSV, JSON",
        "AI coach notes on every session",
      ],
      cta: "Go monthly",
      href: "/signup?plan=monthly",
      featured: false,
      hidden: true, // temporarily hidden — re-enable when monthly plan returns
    },
  ];

  const tiers = tiersMonthly.filter(t => !t.hidden);

  // Monthly column hidden — 3 visible tiers: Free, Per session, Sprint Pack
  const compareRows: Array<[string, string, string, string]> = [
    ["Mock sessions included", "2 (one-time)", "1 (one-time)", "5 / pack (30 days)"],
    ["Voice in & out", "Yes", "Yes", "Yes"],
    ["STAR scoring", "Yes", "Yes", "Yes"],
    ["Company-specific rounds", "Limited", "Yes", "Yes"],
    ["Skill-decay tracking", "No", "No", "Yes"],
    ["Report retention", "30 days", "30 days", "90 days"],
  ];

  const faqs: Array<[string, string]> = [
    [
      "Do plans auto-renew?",
      "The Sprint Pack (₹39 for 5 sessions) renews automatically each month. Cancel any time from Settings before the next billing date and you won't be charged again. Per-session credits (₹9) never expire and never auto-renew — buy one and use it whenever.",
    ],
    [
      "What happens to unused Sprint Pack sessions?",
      "You get 5 fresh sessions each 30-day billing cycle — they don't accumulate across cycles. Unused sessions within the cycle carry forward until the cycle ends. If you cancel before renewal, you keep access until your paid period expires. If you haven't started any sessions, you can request a full refund within 7 days of purchase.",
    ],
    [
      "Can I switch plans?",
      "Yes. Upgrade any time; we credit the unused portion of your current plan toward the new one. Downgrades take effect on the next cycle so you don't lose sessions you already paid for.",
    ],
    [
      "Which payment methods work in India?",
      "UPI (GPay / PhonePe / BHIM), all major Indian debit + credit cards, netbanking from 50+ banks, and Razorpay wallets. International cards work too if you're abroad.",
    ],
    [
      "Will I get a tax invoice?",
      "Every order generates a downloadable payment receipt with the order ID, amount paid, and date. Formal GST invoices will be added once HireStepX crosses the GST registration threshold; until then, the receipt is what you'd attach to a B2B reimbursement.",
    ],
  ];

  return (
    <PageShell>
      <PageHero
        eyebrow="Pricing"
        title="Costs less than"
        accent="one chai a day."
        lead="Free to start. Buy one session or a 5-session Sprint Pack, whichever matches your prep. UPI, cards, and netbanking accepted. 7-day refund if unused."
      />

      {/* Tier cards */}
      <section className="mv2p-section" aria-label="Pricing tiers" style={{ ...sectionBase, paddingTop: 56 }}>
        <div className="mv2-container" style={container}>
          <div
            className="mv2p-pricing-row"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${tiers.length}, 1fr)`,
              gap: 16,
              alignItems: "stretch",
              paddingTop: 20, /* room for "Most loved" chip (position:absolute, top:-12) */
            }}
          >
            {tiers.map((tier) => (
              <div
                key={tier.name}
                style={{
                  position: "relative",
                  padding: 32,
                  background: tier.featured ? t.coal : t.white,
                  color: tier.featured ? t.cream : t.coal,
                  border: `1px solid ${tier.featured ? t.coal : t.line}`,
                  borderRadius: 20,
                  boxShadow: tier.featured ? "none" : shadows.card,
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                {tier.featured && (
                  <span
                    style={{
                      position: "absolute",
                      top: -12,
                      left: 24,
                      fontFamily: fonts.sans,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: t.coal,
                      background: t.copper100,
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: `1px solid ${t.lineStrong}`,
                    }}
                  >
                    Best value
                  </span>
                )}
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontFamily: fonts.sans,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: tier.featured ? t.copper100 : t.copper,
                    }}
                  >
                    {tier.name}
                  </p>
                  <p
                    style={{
                      margin: "10px 0 0",
                      fontFamily: fonts.serif,
                      fontSize: 44,
                      lineHeight: 1,
                      letterSpacing: "-0.02em",
                      color: tier.featured ? t.cream : t.coal,
                      display: "flex",
                      alignItems: "baseline",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    {tier.price}
                    <span
                      style={{
                        fontFamily: fonts.sans,
                        fontSize: 13,
                        fontWeight: 500,
                        color: tier.featured ? t.creamFaded : t.inkSoft,
                      }}
                    >
                      {tier.unit}
                    </span>
                  </p>
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontFamily: fonts.sans,
                      fontSize: 13,
                      color: tier.featured ? t.creamFaded : t.inkSoft,
                    }}
                  >
                    {tier.sub}
                  </p>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {tier.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        fontFamily: fonts.sans,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: tier.featured ? t.creamMuted : t.inkSoft,
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          color: tier.featured ? t.copper100 : t.copper,
                          marginTop: 2,
                        }}
                      >
                        →
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={tier.href}
                  className="mv2-tap-44"
                  onClick={() => captureClientEvent("purchase_started", { plan: tier.name.toLowerCase().replace(/ /g, "_"), surface: "pricing_page" })}
                  style={{
                    marginTop: "auto",
                    ...ctaPrimary("md"),
                    background: tier.featured ? t.cream : t.copper,
                    color: tier.featured ? t.coal : t.cream,
                    boxShadow: tier.featured ? "none" : shadows.cta,
                  }}
                >
                  {tier.cta} <span style={{ fontSize: 16 }}>→</span>
                </a>
                {tier.name !== "Free" && (
                  <p style={{ margin: "10px 0 0", fontFamily: fonts.sans, fontSize: 11, textAlign: "center", color: tier.featured ? t.creamFaded : t.inkSoft }}>
                    7-day refund if unused · cancel anytime
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare-everything table */}
      <section
        className="mv2p-section"
        style={{ ...sectionBase, background: t.creamSoft, borderTop: `1px solid ${t.line}` }}
      >
        <div className="mv2-container" style={container}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <p style={{ ...eyebrow, marginBottom: 12 }}>Compare</p>
            <h2 style={h2}>
              All plans, side{" "}
              <span style={{ fontStyle: "italic", color: t.copper }}>by side.</span>
            </h2>
          </div>
          <div
            style={{
              overflowX: "auto",
              border: `1px solid ${t.line}`,
              borderRadius: 16,
              background: t.white,
            }}
          >
            <table
              className="mv2p-compare-table"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: fonts.sans,
                fontSize: 14,
                minWidth: 720,
              }}
            >
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.line}`, background: t.creamSoft }}>
                  <th scope="col" style={{ padding: "16px 20px", textAlign: "left", fontWeight: 600, color: t.inkSoft }}>Feature</th>
                  {tiers.map((tier) => (
                    <th
                      key={tier.name}
                      scope="col"
                      style={{
                        padding: "16px 20px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: tier.featured ? t.indigo : t.coal,
                        borderLeft: `1px solid ${t.line}`,
                        background: tier.featured ? t.indigoMist : "transparent",
                      }}
                    >
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map(([feature, free, perSession, weekly], i) => (
                  <tr key={feature} style={{ borderTop: i === 0 ? "none" : `1px solid ${t.line}` }}>
                    <th scope="row" style={{ padding: "14px 20px", color: t.coal, fontWeight: 500, textAlign: "left", fontFamily: fonts.sans, fontSize: 14 }}>{feature}</th>
                    <td style={{ padding: "14px 20px", color: t.inkSoft, borderLeft: `1px solid ${t.line}` }}>{free}</td>
                    <td style={{ padding: "14px 20px", color: t.inkSoft, borderLeft: `1px solid ${t.line}` }}>{perSession}</td>
                    <td style={{ padding: "14px 20px", color: t.coal, fontWeight: 500, borderLeft: `1px solid ${t.line}`, background: t.indigoMist }}>{weekly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mv2p-section" aria-label="Pricing FAQ" style={sectionBase}>
        <div className="mv2-container" style={containerNarrow}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <p style={{ ...eyebrow, marginBottom: 12 }}>FAQ</p>
            <h2 style={h2}>
              The money{" "}
              <span style={{ fontStyle: "italic", color: t.copper }}>questions.</span>
            </h2>
          </div>
          <div
            style={{
              maxWidth: 760,
              margin: "0 auto",
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 16,
              boxShadow: shadows.card,
              overflow: "hidden",
            }}
          >
            {faqs.map(([q, a], i) => (
              <FAQItem key={q} q={q} a={a} first={i === 0} />
            ))}
          </div>
          <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, textAlign: "center", marginTop: 32, lineHeight: 1.6 }}>
            Not sure what to practice?{" "}
            <a href="/questions" style={{ color: t.copper, fontWeight: 500, textDecoration: "none" }}>Browse question sets →</a>
            {" · "}
            <a href="/for-students" style={{ color: t.copper, fontWeight: 500, textDecoration: "none" }}>Campus placement guide →</a>
            {" · "}
            <a href="/how-it-works" style={{ color: t.copper, fontWeight: 500, textDecoration: "none" }}>See how it works →</a>
          </p>
        </div>
      </section>
    </PageShell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   HOW IT WORKS PAGE
   Long-form product walkthrough. 5 phases, deep-dive on each.
   ════════════════════════════════════════════════════════════════════ */
export function HowItWorksV2() {
  const phases = [
    {
      n: "01",
      label: "Upload resume",
      title: "Tell us where you've been.",
      body: "Drop a PDF or paste plain text. Our parser pulls roles, skills, dates, and projects. The AI uses this to ask questions about your actual experience, not generic ones. Resume stays private; never shared with employers or shown to other users.",
      detail: "We support resumes in English. Parsing typically takes 6 seconds. If parsing fails, you can fill in the gaps manually.",
    },
    {
      n: "02",
      label: "Pick target",
      title: "Choose the room you're walking into.",
      body: "200+ Indian roles in the question bank: TCS, Infosys, Wipro, Razorpay, Zomato, Flipkart, Cred, Deloitte, ISRO, RBI, Paytm — across IT services, unicorns, PSUs, and MNCs. Pair with a role and round type: HR screen, technical, campus placement, panel, salary negotiation.",
      detail: "We refresh question patterns regularly as new public interview reports surface. Don't see your target company? Tell us and we'll add it within 48 hours.",
    },
    {
      n: "03",
      label: "Practice live",
      title: "Speak to a real AI interviewer.",
      body: "The AI greets you, asks a question, listens to your voice, asks follow-ups when you're shallow, and pushes back when you contradict yourself. Average session: 18 minutes for short rounds, 45 for full panels.",
      detail: "Voice in / voice out. Indian, American, and British accents tuned. Works on any modern browser including Realme / Redmi-class Android on 4G.",
    },
    {
      n: "04",
      label: "Get scored",
      title: "STAR breakdown on every answer.",
      body: "Every answer is scored on Situation, Task, Action, Result, plus communication clarity, technical depth, and authenticity. You get a 1–10 score, the rubric behind it, and a model answer to compare against.",
      detail: "Rubrics built from publicly aggregated interview reports across Glassdoor, Levels.fyi and AmbitionBox — each question cross-checked against two independent sources. Disagree with a score? Hit 'Dispute' and we review within 24h. Credit refunded if we agree.",
    },
    {
      n: "05",
      label: "Track + return",
      title: "Skill decay, surfaced.",
      body: "Stop practicing for a week and your scores in weak areas slip. We track that. Your dashboard shows which competencies need a refresh and queues spaced-repetition prompts in the rounds you book next.",
      detail: "Spaced-repetition based on the SuperMemo SM-2 algorithm. Designed to make a 30-minute session per week sufficient to hold your edge.",
    },
  ];

  return (
    <PageShell>
      <PageHero
        eyebrow="How it works"
        title="Five steps from"
        accent="upload to ready."
        lead="No fluffy demos. Here's exactly what happens, from the second you drop your resume to your first scored mock. Total time to first session: under five minutes."
        meta={
          <div className="mv2p-cta-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="/signup" style={ctaPrimary("lg")} className="mv2-tap-44">
              Start free: 2 sessions
            </a>
            <a href="/pricing" style={ctaGhost("lg")} className="mv2-tap-44">
              See pricing
            </a>
          </div>
        }
      />

      {/* Phase blocks — alternating layout for rhythm */}
      <section className="mv2p-section" aria-label="How it works steps" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="mv2-container" style={container}>
          {phases.map((p, i) => (
            <article
              key={p.n}
              style={{
                display: "grid",
                gridTemplateColumns: "200px 1fr",
                gap: 48,
                padding: "56px 0",
                borderTop: i === 0 ? "none" : `1px solid ${t.line}`,
              }}
              className="mv2p-grid-2"
            >
              <div>
                <p
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.copper,
                    letterSpacing: "0.08em",
                    margin: 0,
                  }}
                >
                  {p.n} · {p.label}
                </p>
              </div>
              <div>
                <h3
                  style={{
                    ...h3,
                    fontSize: "clamp(28px, 3.4vw, 40px)",
                    marginBottom: 20,
                  }}
                >
                  {p.title}
                </h3>
                <p style={{ ...lead, marginBottom: 16 }}>{p.body}</p>
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 14,
                    color: t.inkSoft,
                    margin: 0,
                    padding: "16px 20px",
                    background: t.creamSoft,
                    borderRadius: 12,
                  }}
                >
                  <span aria-hidden style={{ color: t.copper, fontWeight: 700, marginRight: 6 }}>“</span>
                  {p.detail}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Pillar page cross-links — pick your path before starting */}
      <section className="mv2p-section" aria-label="Choose where to start" style={{ paddingTop: 48, paddingBottom: 48, borderTop: `1px solid ${t.line}` }}>
        <div className="mv2-container" style={containerNarrow}>
          <p style={{ ...eyebrow, marginBottom: 20, textAlign: "center" }}>Choose where to start</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            {([
              ["Practice Questions", "67+ sets for TCS, Google, Flipkart & more", "/questions"],
              ["Campus Placement", "HR rounds, NQT, NLTH: for freshers & students", "/for-students"],
              ["All Companies", "Browse by company type: IT, product, consulting", "/companies"],
              ["Interview Prep Guide", "How to prepare step by step for any company", "/interview-prep"],
            ] as [string, string, string][]).map(([title, desc, href]) => (
              <a
                key={href}
                href={href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  padding: "18px 20px",
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 12,
                  textDecoration: "none",
                }}
              >
                <span style={{ fontFamily: fonts.sans, fontSize: 15, fontWeight: 600, color: t.coal }}>{title}</span>
                <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.4 }}>{desc}</span>
                <span style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.copper, marginTop: 4 }}>Start →</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Why it works */}
      <section
        className="mv2p-section"
        style={{ ...sectionBase, background: t.coal, color: t.cream }}
      >
        <div className="mv2-container" style={container}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <p style={{ ...eyebrow, color: t.copper100, marginBottom: 12 }}>Why this approach</p>
            <h2 style={{ ...h2, color: t.cream }}>
              Built on what works for{" "}
              <span style={{ fontStyle: "italic", color: t.copper100 }}>Indian candidates.</span>
            </h2>
          </div>
          <div
            className="mv2p-grid-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 24,
            }}
          >
            {[
              ["Reading isn't practice", "Preparing for a voice interview by reading questions silently is like practising swimming on land. We make you speak, same pressure, same format as the actual room."],
              ["You see the rubric", "Every score comes with the rubric and a model answer. You learn what a strong answer actually looks like, not just whether yours was good enough."],
              ["Built for India, not FAANG", "TCS Digital, Infosys Power Programmer, Razorpay tech round: we know the actual question patterns, not the generic American SWE template."],
            ].map(([title, copy]) => (
              <div
                key={title}
                style={{
                  padding: 28,
                  background: t.creamVeryFaint,
                  border: `1px solid ${t.copper100Soft}`,
                  borderRadius: 16,
                }}
              >
                <h3 style={{ ...h3, color: t.cream, fontSize: 22, marginBottom: 12 }}>{title}</h3>
                <p style={{ fontFamily: fonts.sans, fontSize: 15, lineHeight: 1.6, color: t.creamFaded, margin: 0 }}>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   ABOUT PAGE
   Mission, story, founders. Editorial register.
   ════════════════════════════════════════════════════════════════════ */
export function AboutV2() {
  return (
    <PageShell>
      <PageHero
        eyebrow="About"
        title="We built the prep we wish"
        accent="we'd had."
        lead="HireStepX exists because the gap between a great resume and a great interview is unforgiving, and the people teaching interview prep mostly aren't the ones still doing them. We're building the coach we wanted when we were the candidate."
        narrow
      />

      {/* Mission block */}
      <section className="mv2p-section" aria-label="Mission" style={{ ...sectionBase }}>
        <div className="mv2-container" style={containerNarrow}>
          <MDXProse>
            <p style={{ fontSize: 18, lineHeight: 1.7 }}>
              India produces over a million engineering graduates a year. Most can't make it past round one — not because of talent. It's that interview prep, the way it's taught, was designed for a labor market that doesn't exist anymore: coaching that costs ₹5,000 or more a session, friends who can only roleplay so many times, and YouTube videos from 2018 about a hiring funnel that's already changed twice.
            </p>
            <p>
              We've been on both sides of the table. Hiring at unicorns, coaching at colleges, taking the rounds ourselves. The pattern was always the same: the people who got better got <em>reps</em>: specific, scored, immediate. Not generic advice.
            </p>
            <p>
              That's what HireStepX is. Voice-native rounds, scored against real Indian hiring rubrics, available at ₹9 per session so the candidates who need it most can actually afford it.
            </p>
            <blockquote>
              The interview is the only part of getting hired you can rehearse for. We just made the rehearsal honest.
            </blockquote>
          </MDXProse>
        </div>
      </section>

      {/* Credibility band: who built this. We keep real metrics here as
          they accrue post-launch; do not add a metric until the number
          is defensible from data. */}
      <section
        className="mv2p-section"
        style={{
          background: t.coal,
          color: t.cream,
          paddingTop: 96,
          paddingBottom: 96,
        }}
      >
        <div className="mv2-container" style={containerNarrow}>
          <h2
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: t.copper100,
              margin: 0,
              marginBottom: 28,
            }}
          >
            Who's building this
          </h2>
          <p
            style={{
              fontFamily: fonts.serif,
              fontSize: "clamp(32px, 4vw, 48px)",
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              margin: 0,
              color: t.cream,
            }}
          >
            People who have sat on{" "}
            <span style={{ fontStyle: "italic", color: t.copper100 }}>both sides</span>{" "}
            of the table.
          </p>
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 16,
              lineHeight: 1.7,
              color: t.cream,
              opacity: 0.78,
              margin: "32px 0 0",
              maxWidth: "60ch",
            }}
          >
            We've sat through enough Indian-tech interview cycles
            — services, GCC, product — to know where the prep most candidates do
            actually breaks. The product reflects that frustration, not a
            placement-cell pitch deck.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="mv2p-section" aria-label="Values" style={{ ...sectionBase, background: t.creamSoft }}>
        <div className="mv2-container" style={container}>
          <div style={{ marginBottom: 56, maxWidth: 720 }}>
            <p style={{ ...eyebrow, marginBottom: 12 }}>What we believe</p>
            <h2 style={h2}>
              Four principles we won't{" "}
              <span style={{ fontStyle: "italic", color: t.copper }}>compromise on.</span>
            </h2>
          </div>
          <div
            className="mv2p-grid-2"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 32,
            }}
          >
            {[
              [
                "Honest scoring over flattery.",
                "ChatGPT agrees with whatever you say. We don't. If your STAR collapsed in the Action paragraph, we'll show you exactly where.",
              ],
              [
                "Built for the bottom of the price curve.",
                "₹9 a session is a deliberate choice. A first-year student in Tier-3 college shouldn't need rich parents to prepare for Razorpay.",
              ],
              [
                "Voice, not text.",
                "Interviews are a speaking medium. Practicing in text is practicing the wrong skill. Every session is voice in, voice out.",
              ],
              [
                "Privacy is the default.",
                "Your recordings are encrypted, auto-deleted after 90 days, and never shown to employers or shared with anyone. Designed against the DPDP Act 2023 from day one.",
              ],
            ].map(([title, copy]) => (
              <div key={title}>
                <h3 style={{ ...h3, fontSize: 24, marginBottom: 12 }}>{title}</h3>
                <p style={{ ...body, fontSize: 16 }}>{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Start practicing — bridge from mission to product */}
      <section className="mv2p-section" aria-label="Start practicing" style={{ ...sectionBase, paddingTop: 64, paddingBottom: 64 }}>
        <div className="mv2-container" style={containerNarrow}>
          <p style={{ ...eyebrow, marginBottom: 16 }}>Ready to practice?</p>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <a
              href="/questions"
              style={{ fontFamily: fonts.sans, fontSize: 14, fontWeight: 600, color: t.white, background: t.coal, padding: "12px 22px", borderRadius: 8, textDecoration: "none", display: "inline-block" }}
            >
              Browse practice questions →
            </a>
            <a
              href="/for-students"
              style={{ fontFamily: fonts.sans, fontSize: 14, fontWeight: 600, color: t.coal, background: "transparent", border: `1px solid ${t.line}`, padding: "12px 22px", borderRadius: 8, textDecoration: "none", display: "inline-block" }}
            >
              Campus placement guide →
            </a>
            <a
              href="/companies"
              style={{ fontFamily: fonts.sans, fontSize: 14, fontWeight: 600, color: t.coal, background: "transparent", border: `1px solid ${t.line}`, padding: "12px 22px", borderRadius: 8, textDecoration: "none", display: "inline-block" }}
            >
              Browse companies →
            </a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CONTACT PAGE
   Form + alternate channels. Conversion intent: support / partnership.
   ════════════════════════════════════════════════════════════════════ */
export function ContactV2() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [ref, setRef] = useState<string | null>(null);
  const channels = [
    {
      name: "General support",
      detail: "Account, billing, technical issues. We reply within 1 business day.",
      contact: "hello@hirestepx.com",
      href: "mailto:hello@hirestepx.com",
    },
  ];

  return (
    <PageShell>
      <PageHero
        eyebrow="Contact"
        title="Real humans,"
        accent="real replies."
        lead="No ticket systems, no autoresponders that pretend to care. Pick the channel that fits your question and we'll get back."
      />

      <section className="mv2p-section" aria-label="Contact form and channels" style={{ ...sectionBase, paddingTop: 64 }}>
        <div className="mv2-container" style={container}>
          <div
            className="mv2p-form"
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr",
              gap: 56,
              alignItems: "start",
            }}
          >
            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (status === "sending" || status === "sent") return;
                setStatus("sending");
                const form = e.currentTarget as HTMLFormElement;
                const data = {
                  name: (form.querySelector("#contact-name") as HTMLInputElement)?.value ?? "",
                  email: (form.querySelector("#contact-email") as HTMLInputElement)?.value ?? "",
                  topic: (form.querySelector("#contact-topic") as HTMLSelectElement)?.value ?? "",
                  message: (form.querySelector("#contact-message") as HTMLTextAreaElement)?.value ?? "",
                };
                fetch("/api/contact", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(data),
                })
                  .then(r => r.json())
                  .then((d: { ok?: boolean; ref?: string }) => {
                    if (d.ok) { setRef(d.ref ?? null); setStatus("sent"); }
                    else setStatus("error");
                  })
                  .catch(() => setStatus("error"));
              }}
              aria-describedby="contact-form-status"
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 20,
                padding: 32,
                boxShadow: shadows.card,
                display: "grid",
                gap: 18,
              }}
            >
              <h2
                style={{
                  ...h3,
                  fontSize: 28,
                  margin: 0,
                  marginBottom: 4,
                }}
              >
                Send a message
              </h2>
              <p
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 14,
                  color: t.inkSoft,
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                We reply within 1 business day (IST).
              </p>
              <FieldGroup label="Your name" htmlFor="contact-name">
                <input id="contact-name" className="mv2p-input" type="text" required placeholder="Aarav Mehta" style={inputStyle} />
              </FieldGroup>
              <FieldGroup label="Email" htmlFor="contact-email">
                <input id="contact-email" className="mv2p-input" type="email" required placeholder="you@example.com" style={inputStyle} />
              </FieldGroup>
              <FieldGroup label="What's this about?" htmlFor="contact-topic">
                <select id="contact-topic" className="mv2p-input" required style={inputStyle}>
                  <option value="">Pick one</option>
                  <option>Account or billing</option>
                  <option>Bug or technical issue</option>
                  <option>Press or media</option>
                  <option>Something else</option>
                </select>
              </FieldGroup>
              <FieldGroup label="Message" htmlFor="contact-message">
                <textarea
                  id="contact-message"
                  className="mv2p-input"
                  required
                  rows={5}
                  placeholder="As specific as you can. Screenshots help if there's a bug."
                  style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
                />
              </FieldGroup>
              <button
                type="submit"
                disabled={status === "sending" || status === "sent"}
                style={{
                  ...ctaPrimary("lg"),
                  justifySelf: "start",
                  opacity: status === "sending" || status === "sent" ? 0.6 : 1,
                  cursor: status === "sending" || status === "sent" ? "default" : "pointer",
                }}
                className="mv2-tap-44"
              >
                {status === "sending" ? "Sending…" : status === "sent" ? "Sent ✓" : "Send message"}
              </button>
              <p
                id="contact-form-status"
                role="status"
                aria-live="polite"
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  margin: 0,
                  minHeight: 18,
                  color: status === "error" ? t.error : status === "sent" ? t.success : t.inkSoft,
                }}
              >
                {status === "sent"
                  ? `Got it${ref ? ` (ref: ${ref})` : ""}. Check your email for a confirmation — we'll reply within 1 business day.`
                  : status === "error"
                  ? "Couldn't send. Email hello@hirestepx.com directly instead."
                  : ""}
              </p>
            </form>

            {/* Channels + alt */}
            <div style={{ display: "grid", gap: 20 }}>
              <p style={{ ...eyebrow, margin: 0 }}>Direct channels</p>
              {channels.map((c) => (
                <div
                  key={c.name}
                  style={{
                    padding: 20,
                    background: t.white,
                    border: `1px solid ${t.line}`,
                    borderRadius: 14,
                  }}
                >
                  <p
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 12,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: t.copper,
                      margin: 0,
                      marginBottom: 8,
                    }}
                  >
                    {c.name}
                  </p>
                  <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, margin: 0, marginBottom: 12 }}>
                    {c.detail}
                  </p>
                  <a
                    href={c.href}
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 15,
                      fontWeight: 600,
                      color: t.indigo,
                      textDecoration: "none",
                      borderBottom: `1px solid ${t.indigo}`,
                    }}
                  >
                    {c.contact}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

function FieldGroup({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontFamily: fonts.sans,
          fontSize: 13,
          fontWeight: 600,
          color: t.coal,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 15,
  padding: "12px 14px",
  background: t.cream,
  border: `1px solid ${t.lineStrong}`,
  borderRadius: 10,
  color: t.coal,
  outline: "none",
  width: "100%",
  minHeight: 44,
};

/* ════════════════════════════════════════════════════════════════════
   FOR STUDENTS — segment landing
   ════════════════════════════════════════════════════════════════════ */
export function ForStudentsV2() {
  return (
    <PageShell>
      <PageHero
        eyebrow="For students"
        title="Placement week is in"
        accent="six weeks."
        lead="Built for final-year students. Practice the actual rounds your seniors got: TCS Digital, Infosys Power Programmer, campus drives, HR rounds. Not generic FAANG."
        meta={
          <div className="mv2p-cta-row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <a href="/signup?plan=free" style={ctaPrimary("lg")} className="mv2-tap-44">
              Start with 2 free sessions
            </a>
            <span
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                color: t.inkSoft,
              }}
            >
              No credit card · ~5 min to first mock
            </span>
          </div>
        }
      />

      {/* Practice links — direct links to the most-searched fresher tracks */}
      <section className="mv2p-section" aria-label="Practice by company track" style={{ paddingTop: 40, paddingBottom: 40 }}>
        <div className="mv2-container" style={container}>
          <p style={{ ...eyebrow, marginBottom: 20 }}>Practice by company track</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {([
              ["TCS NQT 2026", "/questions/tcs-nqt-interview-questions"],
              ["TCS Ninja", "/questions/tcs-ninja-interview-questions"],
              ["TCS Digital", "/questions/tcs-digital-interview-questions"],
              ["Infosys Campus", "/questions/infosys-campus-interview-questions"],
              ["Infosys Power Programmer", "/questions/infosys-power-programmer-interview"],
              ["Wipro Freshers", "/questions/wipro-freshers-interview-questions"],
              ["Wipro Turbo", "/questions/wipro-turbo-technical-interview"],
              ["Cognizant GenC", "/questions/cognizant-genc-interview-questions"],
              ["Accenture ASE", "/questions/accenture-ase-interview-questions"],
              ["Capgemini Freshers", "/questions/capgemini-freshers-interview-questions"],
              ["HCL Freshers", "/questions/hcl-freshers-interview-questions"],
              ["LTIMindtree Freshers", "/questions/ltimindtree-freshers-interview-questions"],
              ["Why Should We Hire You?", "/questions/why-should-we-hire-you-answer-india"],
              ["Tell Me About Yourself", "/questions/tell-me-about-yourself-answer-freshers-india"],
              ["Common HR Questions", "/questions/common-hr-interview-questions-freshers-india"],
            ] as [string, string][]).map(([label, href]) => (
              <a
                key={label}
                href={href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "8px 16px",
                  borderRadius: 999,
                  border: `1px solid ${t.line}`,
                  background: t.white,
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  fontWeight: 500,
                  color: t.coal,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* What's included for students */}
      <section className="mv2p-section" aria-label="What's included for students" style={{ paddingTop: 56, paddingBottom: 56 }}>
        <div className="mv2-container" style={container}>
          <div
            className="mv2p-grid-3"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
          >
            {[
              ["Campus rounds", "TCS NQT, Ninja, Digital, Infosys SP/PP, Wipro Elite, Capgemini, plus your private engineering college pool."],
              ["Off-campus prep", "Cred, Razorpay, Zomato, Flipkart tech rounds with rubrics from real recent panels."],
              ["HR + behavioral", "The 'tell me about yourself' that doesn't sound like a Wikipedia page. STAR-scored."],
              ["Salary negotiation", "Your first job, ₹4 LPA vs ₹5.5 LPA, said with confidence. We practice the script."],
              ["Govt + PSU", "ISRO scientist-engineer, RBI grade B, GATE-PSU technicals. Distinct prep pattern."],
              ["Skill-decay tracking", "Practice once, our system reminds you when your edge is slipping. 30 min / week holds the gain."],
            ].map(([title, copy]) => (
              <article
                key={title}
                style={{
                  padding: 24,
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 14,
                  boxShadow: shadows.card,
                }}
              >
                <h3 style={{ ...h3, fontSize: 22, marginBottom: 10 }}>{title}</h3>
                <p style={{ ...body, fontSize: 14, lineHeight: 1.6 }}>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Related reading — links to campus & fresher blog guides */}
      <section className="mv2p-section" aria-label="Related guides" style={{ ...sectionBase, paddingTop: 56, paddingBottom: 56 }}>
        <div className="mv2-container" style={container}>
          <p style={{ ...eyebrow, marginBottom: 20 }}>Guides worth reading before your placement round</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {([
              ["Campus Placement Interview Tips 2026", "/blog/campus-placement-interview-tips"],
              ["Behavioral Interview Questions for Freshers", "/blog/behavioral-interview-questions-freshers"],
              ["How to Introduce Yourself in an Interview", "/blog/how-to-introduce-yourself-in-interview"],
              ["TCS Interview Questions for Freshers 2026", "/blog/tcs-interview-questions-freshers-2026"],
              ["Infosys Interview Questions 2026", "/blog/infosys-interview-questions-2026"],
              ["Wipro Interview Questions & Answers", "/blog/wipro-interview-questions-answers"],
              ["Capgemini Interview Questions for Freshers 2026", "/blog/capgemini-interview-questions-freshers-2026"],
              ["LTIMindtree Interview Questions for Freshers 2026", "/blog/ltimindtree-interview-questions-freshers-2026"],
              ["HR Interview Questions & Answers India", "/blog/hr-interview-questions-answers-india"],
              ["Group Discussion Topics — Campus Placement 2026", "/blog/group-discussion-topics-campus-placement-2026"],
              ["How to Pass TCS NQT 2026", "/blog/how-to-pass-tcs-nqt-2026"],
              ["Resume Tips for Freshers India 2026", "/blog/resume-tips-freshers-india-2026"],
            ] as [string, string][]).map(([label, href]) => (
              <a
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "14px 18px",
                  background: t.white,
                  border: `1px solid ${t.line}`,
                  borderRadius: 12,
                  fontFamily: fonts.sans,
                  fontSize: 14,
                  fontWeight: 500,
                  color: t.coal,
                  textDecoration: "none",
                  gap: 10,
                  lineHeight: 1.4,
                }}
              >
                <span style={{ color: t.copper, fontSize: 16, flexShrink: 0 }}>→</span>
                {label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Honest pre-launch note */}
      <section className="mv2p-section" aria-label="Pre-launch note" style={sectionBase}>
        <div className="mv2-container" style={containerNarrow}>
          <div
            style={{
              padding: 40,
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: 20,
            }}
          >
            <p style={{ ...eyebrow, marginBottom: 16 }}>Before you pay</p>
            <p style={{ fontFamily: fonts.serif, fontSize: 22, lineHeight: 1.45, color: t.coal, margin: 0, marginBottom: 16 }}>
              HireStepX is in early access. Try two full mocks free first — see the
              voice, the questions, and the scored report yourself before you decide.
              If the free tier doesn't change how you're preparing, paid won't either.
            </p>
            <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkSoft, margin: 0 }}>
              No testimonials shown yet — outcomes get published once early-access users
              opt in to share theirs.
            </p>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   404 + 500
   ════════════════════════════════════════════════════════════════════ */
export function NotFoundV2() {
  return (
    <PageShell>
      <section aria-label="Error message" style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ textAlign: "center", maxWidth: 560 }}>
          <p
            style={{
              fontFamily: fonts.mono,
              fontSize: 13,
              fontWeight: 600,
              color: t.copper,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              margin: 0,
              marginBottom: 24,
            }}
          >
            404 · Page not found
          </p>
          <h1 style={{ ...h1Display, fontSize: "clamp(56px, 8vw, 96px)" }}>
            That round{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>doesn't exist.</span>
          </h1>
          <p style={{ ...lead, marginTop: 24, marginLeft: "auto", marginRight: "auto", textAlign: "center" }}>
            The URL is wrong, or the page moved. Try the homepage, or jump straight to what most folks come for.
          </p>
          <div
            className="mv2p-cta-row"
            style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}
          >
            <a href="/" style={ctaPrimary("lg")} className="mv2-tap-44">
              Back to homepage
            </a>
            <a href="/pricing" style={ctaGhost("lg")} className="mv2-tap-44">
              See pricing
            </a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

export function ServerErrorV2() {
  return (
    <PageShell>
      <section aria-label="Error message" style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <div style={{ textAlign: "center", maxWidth: 560 }}>
          <p
            style={{
              fontFamily: fonts.mono,
              fontSize: 13,
              fontWeight: 600,
              color: t.error,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              margin: 0,
              marginBottom: 24,
            }}
          >
            500 · Server error
          </p>
          <h1 style={{ ...h1Display, fontSize: "clamp(56px, 8vw, 96px)" }}>
            Something{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>broke on our end.</span>
          </h1>
          <p style={{ ...lead, marginTop: 24, marginLeft: "auto", marginRight: "auto", textAlign: "center" }}>
            Not your fault. We've been alerted. Try again in a minute, and if it keeps failing, drop us a line.
          </p>
          <div
            className="mv2p-cta-row"
            style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32, flexWrap: "wrap" }}
          >
            <a href="/" style={ctaPrimary("lg")} className="mv2-tap-44">
              Try the homepage
            </a>
            <a href="/contact" style={ctaGhost("lg")} className="mv2-tap-44">
              Contact support
            </a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

/* ════════════════════════════════════════════════════════════════════
   LEGAL TEMPLATES — shared shell, swap content per page
   ════════════════════════════════════════════════════════════════════ */
function LegalPage({
  title,
  accent,
  updated,
  children,
}: {
  title: string;
  accent: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <PageShell>
      <PageHero
        eyebrow="Legal"
        title={title}
        accent={accent}
        lead={`Last updated: ${updated}. Written in plain English. If anything's unclear, email hello@hirestepx.com.`}
        narrow
      />
      <section className="mv2p-section" aria-label="Document body" style={sectionBase}>
        <div className="mv2-container" style={containerNarrow}>
          <MDXProse>{children}</MDXProse>
        </div>
      </section>
    </PageShell>
  );
}

export function PrivacyV2() {
  return (
    <LegalPage title="Privacy" accent="explained simply." updated="30 May 2026">
      <h2>What we collect</h2>
      <p>Account email, your resume (uploaded by you), transcripts of your mock sessions, and basic usage telemetry (page views, session counts, plan type). We do not store audio or video recordings of your sessions — if you answer by voice, your speech is streamed to our speech-to-text provider for live transcription and is not retained. No location, no contacts, no microphone access outside of an active interview round.</p>

      <h2>Why we collect it</h2>
      <p>To run the product. The resume tunes the AI's questions to your background. The transcripts power scoring and the report you read after each session. Email is for login, receipts, and support replies.</p>

      <h2>How long we keep it</h2>
      <p>Transcripts auto-delete after 90 days unless you explicitly save a session. Account data persists until you delete your account, after which it's purged within 30 days.</p>

      <h2>Who we share with</h2>
      <p>Nobody. We do not share transcripts, scores, or resumes with employers, recruiters, colleges, or third parties. We use the following third-party sub-processors, each under a data-processing agreement that prevents retention or use beyond what we authorise:</p>
      <ul>
        <li><strong>Supabase</strong> — database, authentication, and file storage (Ireland / US-East)</li>
        <li><strong>Vercel</strong> — serverless hosting and edge functions (global CDN)</li>
        <li><strong>Groq</strong> — primary AI inference for interview scoring and question generation (US)</li>
        <li><strong>Google (Gemini)</strong> — secondary AI inference fallback (US)</li>
        <li><strong>Deepgram</strong> — primary speech-to-text transcription of voice answers (US)</li>
        <li><strong>Sarvam AI</strong> — Indian-English text-to-speech and speech-to-text fallback (India)</li>
        <li><strong>Cartesia</strong> — secondary text-to-speech (US)</li>
        <li><strong>Microsoft Azure</strong> — tertiary text-to-speech fallback (global)</li>
        <li><strong>Resend</strong> — transactional email delivery (US)</li>
        <li><strong>Razorpay</strong> — payment processing and subscription billing (India)</li>
        <li><strong>PostHog</strong> — product analytics (US); only loaded after explicit cookie consent</li>
        <li><strong>Upstash</strong> — Redis-based rate limiting and caching (US)</li>
      </ul>
      <p>Voice audio is streamed live to Deepgram or Sarvam for real-time transcription and is not stored by either provider beyond the duration of the API call. We do not send your resume or session transcripts to Razorpay, Resend, PostHog, or Upstash.</p>

      <h2>Your rights under DPDP Act 2023</h2>
      <p>India's Digital Personal Data Protection Act, 2023 gives you the right to access, correct, and erase the data we hold on you, to nominate another person to exercise these rights on your behalf, and to a grievance redressal process. Lawful basis for processing is performance of contract (delivering the service you signed up for) for everything except optional analytics, which run on explicit consent only.</p>
      <p>Cross-border transfers: we process data within India and the United States, governed by standard contractual clauses with each sub-processor. If a grievance isn't resolved to your satisfaction, you may escalate to the Data Protection Board of India.</p>
      <p>We respond to any request within 7 working days. Reach us at <code>hello@hirestepx.com</code> for data requests, grievances, or any privacy question.</p>

      <h2>Cookies</h2>
      <p>Strictly-necessary cookies only by default (session token, CSRF). Analytics cookies (PostHog) load only after explicit consent via the banner on first visit. No third-party advertising or tracking cookies, ever.</p>

      <h2>Children</h2>
      <p>HireStepX is not directed at users under 16. If you believe a minor has created an account, email us and we'll remove it.</p>

      <h2>Changes</h2>
      <p>We post updates here and, for material changes, email all account holders 14 days before they take effect. The diff between versions is published on this page.</p>
    </LegalPage>
  );
}

export function TermsV2() {
  return (
    <LegalPage title="Terms of service" accent="the rules." updated="30 May 2026">
      <h2>Who can use HireStepX</h2>
      <p>Anyone 16 or older with a valid email address. By signing up, you confirm you are 16+ and the information you provide is accurate.</p>

      <h2>What you get</h2>
      <p>Access to the platform's mock interview features, scoring, reports, and content libraries based on the plan you select. Plans are described on <a href="/pricing">/pricing</a>.</p>

      <h2>What we expect</h2>
      <p>One account per person. Don't share login credentials. Don't scrape, reverse-engineer, or attempt to extract our scoring rubrics, question banks, or model outputs at scale. Don't use the platform to impersonate real candidates or train third-party AI systems.</p>

      <h2>Payment</h2>
      <p>Billed in INR via Razorpay. Per-session credits (₹9) are charged immediately and never expire. Sprint Pack (₹39 for 5 sessions) renews automatically each month; cancel any time before the next billing cycle to stop renewal. No other plan auto-renews.</p>

      <h2>Refunds</h2>
      <p>See our <a href="/refund">refund policy</a>. Short version: per-session credits are refundable within 7 days of purchase if the session has not started. Sprint Pack refunds depend on usage; cancel before the next cycle to avoid the next charge.</p>

      <h2>Acceptable use</h2>
      <p>Don't upload illegal content. Don't use the platform to harass, defame, or harm others. Don't attempt to break our security controls. We may suspend or terminate accounts for serious or repeated violations.</p>

      <h2>Disclaimers</h2>
      <p>HireStepX provides interview practice. We do not guarantee any specific employment outcome. AI-generated feedback is a tool for self-improvement, not a substitute for professional career counseling.</p>

      <h2>Liability</h2>
      <p>To the maximum extent permitted by law, our total liability for any claim arising from your use of HireStepX is limited to the amount you paid us in the 12 months preceding the claim.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Disputes go to the courts of Bengaluru, Karnataka.</p>
    </LegalPage>
  );
}

export function RefundPolicyV2() {
  return (
    <LegalPage title="Refund" accent="policy." updated="30 May 2026">
      <h2>Free plan</h2>
      <p>Nothing to refund; you didn't pay anything.</p>

      <h2>Per-session purchase (₹9)</h2>
      <p>Refundable up to 7 days after purchase, as long as the session hasn't started. Once you begin a session, the AI has done the work; the credit is consumed.</p>

      <h2>Sprint Pack (₹39 / month)</h2>
      <p>Full refund within 7 days of purchase if zero sessions from that cycle have been used. After that, no refund for the current month's charge — your remaining sessions stay active until the cycle ends. Cancel any time from Settings before the next billing date to stop the next renewal; cancellation takes effect at the end of the current cycle.</p>

      <h2>How to request a refund</h2>
      <p>Email <code>hello@hirestepx.com</code> with your account email and order ID. We process refunds within 5 working days to the original payment method. Razorpay typically takes another 3–7 working days to reflect the credit on your bank statement.</p>

      <h2>Disputes</h2>
      <p>If you believe a session was scored unfairly and want a refund of just that session's credit, hit the "Dispute score" link inside the session report. We review every dispute within 24 hours.</p>
    </LegalPage>
  );
}

/* ════════════════════════════════════════════════════════════════════
   PAYMENT FAILED PAGE
   UPI payments fail ~18% of the time in India. This page reassures
   the user that no money was debited and offers a direct retry path.
   ════════════════════════════════════════════════════════════════════ */
export function PaymentFailedPage() {
  return (
    <PageShell>
      <PageHero
        eyebrow="Payment"
        title="Payment didn't"
        accent="go through."
        lead="This happens sometimes with UPI — your money has NOT been debited. You can try again safely."
      />

      <section style={{ ...sectionBase, paddingTop: 64, paddingBottom: 96 }}>
        <div style={{ ...containerNarrow, maxWidth: 680 }}>

          {/* Main action card */}
          <div
            style={{
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 20,
              padding: "40px 40px 32px",
              boxShadow: shadows.card,
              marginBottom: 24,
            }}
          >
            {/* Warning icon */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FEF3C7", border: "1px solid #FCD34D", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
            </div>

            <h2
              style={{
                fontFamily: fonts.serif,
                fontSize: 24,
                fontWeight: 400,
                color: t.coal,
                textAlign: "center",
                marginBottom: 12,
                letterSpacing: "-0.015em",
              }}
            >
              No money was debited
            </h2>
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 15,
                lineHeight: 1.65,
                color: t.inkSoft,
                textAlign: "center",
                marginBottom: 32,
                maxWidth: 480,
                margin: "0 auto 32px",
              }}
            >
              UPI payments can fail due to bank timeouts, network issues, or daily limits — it{"'"}s common and completely safe to retry. Your bank will not charge you for a failed transaction.
            </p>

            {/* Primary CTA */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
              <a
                href="/pricing"
                style={{
                  ...ctaPrimary("lg"),
                  minWidth: 240,
                  justifyContent: "center",
                }}
                className="mv2-tap-44"
              >
                Try again <span style={{ fontSize: 16 }}>→</span>
              </a>
              <a
                href="mailto:hello@hirestepx.com"
                style={{
                  ...ctaGhost("md"),
                  minWidth: 240,
                  justifyContent: "center",
                  fontSize: 14,
                }}
                className="mv2-tap-44"
              >
                Contact support
              </a>
            </div>
          </div>

          {/* Reassurance note */}
          <div
            style={{
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              borderRadius: 12,
              padding: "20px 24px",
            }}
          >
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                lineHeight: 1.65,
                color: t.inkSoft,
                margin: 0,
              }}
            >
              <strong style={{ color: t.coal }}>If your account was debited,</strong> email us at{" "}
              <a href="mailto:hello@hirestepx.com" style={{ color: t.indigo, textDecoration: "underline", textUnderlineOffset: 3 }}>
                hello@hirestepx.com
              </a>{" "}
              with your UPI transaction ID and we{"'"}ll credit your account within 2 hours.
            </p>
          </div>

          {/* Tips to improve success */}
          <div style={{ marginTop: 32 }}>
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: t.inkSoft,
                marginBottom: 16,
              }}
            >
              Tips for a successful retry
            </p>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Switch from UPI to debit/credit card or netbanking if UPI keeps failing",
                "Check that your UPI daily transaction limit hasn't been reached",
                "Try on a stable WiFi or 4G connection — poor signal causes timeouts",
                "Wait 5 minutes before retrying — your bank may need a moment to release the hold",
              ].map((tip) => (
                <li key={tip} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontFamily: fonts.sans, fontSize: 14, lineHeight: 1.5, color: t.inkSoft }}>
                  <span aria-hidden style={{ color: t.copper, marginTop: 2, flexShrink: 0 }}>→</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </PageShell>
  );
}

/* ─────────────────────── Referral Page ─────────────────────── */

const HOW_IT_WORKS = [
  {
    step: "01",
    heading: "Get your link",
    body: "Sign up or log in, then visit Dashboard → Settings → Referral to copy your personal link.",
  },
  {
    step: "02",
    heading: "Share it",
    body: "Send your link to a friend preparing for interviews — WhatsApp, LinkedIn, or a direct message.",
  },
  {
    step: "03",
    heading: "Both of you benefit",
    body: "Your friend gets a free session credit added to their account immediately. You earn one free session credit once they practise.",
  },
];

export function ReferralPageV2() {
  return (
    <PageShell>
      {/* Hero */}
      <section
        style={{
          paddingTop: "clamp(80px, 10vw, 140px)",
          paddingBottom: "clamp(56px, 7vw, 96px)",
          paddingLeft: 24,
          paddingRight: 24,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: t.copper,
            marginBottom: 20,
          }}
        >
          Refer a friend
        </p>
        <h1
          style={{
            fontFamily: fonts.serif,
            fontSize: "clamp(42px, 6vw, 72px)",
            fontWeight: 400,
            color: t.coal,
            letterSpacing: "-0.03em",
            lineHeight: 1.04,
            margin: "0 auto 24px",
            maxWidth: 760,
            textWrap: "balance" as const,
          }}
        >
          Give a session,{" "}
          <span style={{ color: t.copper }}>get a session.</span>
        </h1>
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: "clamp(16px, 2vw, 18px)",
            lineHeight: 1.65,
            color: t.inkSoft,
            maxWidth: 520,
            margin: "0 auto 40px",
          }}
        >
          Refer a friend preparing for interviews. They get a free session credit
          the moment they sign up with your link. You earn one free session
          credit once they practise. No codes to track — your link does it automatically.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: fonts.sans,
              fontSize: 15,
              fontWeight: 700,
              padding: "13px 28px",
              borderRadius: 999,
              background: t.coal,
              color: t.cream,
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            Get your referral link →
          </a>
          <a
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: fonts.sans,
              fontSize: 15,
              fontWeight: 600,
              padding: "13px 28px",
              borderRadius: 999,
              background: "transparent",
              color: t.coal,
              textDecoration: "none",
              border: `1.5px solid ${t.line}`,
            }}
          >
            Already a member? Go to Settings
          </a>
        </div>
      </section>

      {/* How it works */}
      <section
        style={{
          paddingTop: "clamp(48px, 6vw, 80px)",
          paddingBottom: "clamp(48px, 6vw, 80px)",
          paddingLeft: 24,
          paddingRight: 24,
          borderTop: `1px solid ${t.line}`,
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: t.inkSoft,
              textAlign: "center",
              marginBottom: 48,
            }}
          >
            How it works
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 32,
            }}
          >
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} style={{ padding: "28px 32px", border: `1px solid ${t.line}`, borderRadius: 14 }}>
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: t.copper,
                    margin: "0 0 14px",
                  }}
                >
                  {item.step}
                </p>
                <p
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 22,
                    fontWeight: 400,
                    color: t.coal,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.2,
                    margin: "0 0 10px",
                  }}
                >
                  {item.heading}
                </p>
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: t.inkSoft,
                    margin: 0,
                  }}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Terms note */}
      <section
        style={{
          paddingTop: 40,
          paddingBottom: "clamp(64px, 8vw, 120px)",
          paddingLeft: 24,
          paddingRight: 24,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: 13,
            lineHeight: 1.65,
            color: t.inkSoft,
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          Credit is applied automatically once your referred friend completes
          their first paid session. Credits are valid for 90 days and apply
          toward any session type. No limit on referrals.
        </p>
      </section>
    </PageShell>
  );
}

