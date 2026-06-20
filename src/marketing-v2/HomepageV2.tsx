"use client";
import { useEffect, useState, useRef, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { tokens as t, fonts, shadows } from "../auth/_tokens";
import { useAuth, hasStoredSession } from "../AuthContext";
import { captureClientEvent } from "../posthogClient";

/* ════════════════════════════════════════════════════════════════════
   HireStepX — Marketing Homepage v2 (brand-aligned)
   Cream + indigo + copper editorial system, matching the production
   auth/onboarding surfaces. Instrument Serif display + Satoshi UI.
   ════════════════════════════════════════════════════════════════════ */

const ease = "cubic-bezier(0.16, 1, 0.3, 1)";

/* Responsive rules — inline-style architecture + a single sheet for @media */
const ResponsiveSheet = () => (
  <style>{`
    /* FAQ marker: rotate the "+" into "×" when the details element opens.
       Mirrors MarketingPagesV2's PagesResponsiveSheet so the homepage FAQ
       and pricing-page FAQ animate identically. */
    .mv2p-faq[open] .mv2p-faq-marker { transform: rotate(45deg); }
    .mv2p-faq-marker { transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1); }
    @media (prefers-reduced-motion: reduce) {
      .mv2p-faq-marker { transition: none !important; }
    }
    /* ── Phones (sm) ── */
    @media (max-width: 640px) {
      .mv2-section { padding-top: 64px !important; padding-bottom: 64px !important; }
      .mv2-container { padding-left: 18px !important; padding-right: 18px !important; }
      .mv2-hero-display { font-size: clamp(40px, 12vw, 56px) !important; line-height: 1.02 !important; }
      .mv2-hero-cta-row a { width: 100% !important; justify-content: center !important; }
      main, footer { padding-bottom: 96px !important; }
      .mv2-tap-44 { min-height: 44px !important; }
      .mv2-features-h2 { white-space: normal !important; font-size: clamp(34px, 9vw, 48px) !important; }
      .mv2-hero-section { min-height: 0 !important; display: block !important; }
    }
    /* ── Tablets (md) ── */
    @media (max-width: 880px) {
      .mv2-nav-links { display: none !important; }
      .mv2-nav-cta-label { display: none !important; }
      .mv2-nav-burger { display: inline-flex !important; }
      .mv2-hero-mock-body { grid-template-columns: 1fr !important; }
      .mv2-hero-mock-side { border-left: none !important; border-top: 1px solid var(--mv2-line) !important; }
      .mv2-hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
      .mv2-hero-section { min-height: 0 !important; display: block !important; }
      .mv2-hero-mock-wrap { margin-top: 0 !important; }
      .mv2-hero-margin-note { display: none !important; }
      .mv2-hero-rule-label-end { display: none !important; }
      .mv2-story-stage { grid-template-columns: 1fr !important; gap: 32px !important; padding-top: 40px !important; padding-bottom: 40px !important; }
      .mv2-focus-flagship { grid-template-columns: 1fr !important; gap: 28px !important; padding: 28px !important; }
      .mv2-focus-grid { grid-template-columns: 1fr !important; }
      .mv2-feature-grid { grid-template-columns: 1fr !important; }
      .mv2-feature-span2 { grid-column: span 1 !important; }
      .mv2-india-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
      .mv2-india-logos { justify-content: flex-start !important; }
      .mv2-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
      .mv2-pricing-grid { grid-template-columns: 1fr !important; }
      .mv2-focus-grid { grid-template-columns: 1fr !important; }
      .mv2-mobile-cta { display: flex !important; }
      /* Security & Compliance: collapse 4-col to 2-col at tablet */
      .mv2-security-grid { grid-template-columns: repeat(2, 1fr) !important; }
      main, footer { padding-bottom: 96px; }
    }
    /* ── Small laptops (lg) ── */
    @media (max-width: 1100px) and (min-width: 881px) {
      .mv2-pricing-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .mv2-why-row { grid-template-columns: 56px 1fr !important; gap: 20px !important; padding: 28px 0 !important; }
      .mv2-why-row > p:last-child { grid-column: 2 / 3 !important; }
      .mv2-trust-row { flex-direction: column !important; gap: 16px !important; align-items: flex-start !important; }
      .mv2-section { padding-top: 80px !important; padding-bottom: 80px !important; }
      .mv2-container { padding-left: 20px !important; padding-right: 20px !important; }
      .mv2-logo-strip { gap: 24px !important; }
      .mv2-comparison-table { font-size: 12px !important; }
      .mv2-faq-grid { grid-template-columns: 1fr !important; }
      .mv2-hero-display { font-size: clamp(48px, 10vw, 80px) !important; }
      .mv2-focus-grid { grid-template-columns: repeat(2, 1fr) !important; }
    }
    .mv2-skip { position: absolute; left: -9999px; top: 0; }
    .mv2-skip:focus { left: 16px; top: 16px; z-index: 100; background: ${t.coal}; color: ${t.cream}; padding: 10px 16px; border-radius: 8px; font-family: ${fonts.sans}; font-size: 14px; }
    /* Global focus + hover affordances on marketing surfaces */
    a:focus-visible, button:focus-visible, summary:focus-visible {
      outline: 2px solid ${t.indigo};
      outline-offset: 3px;
      border-radius: 6px;
    }
    /* Dark-band override: indigo outline disappears against indigoDeep / coal; copper holds contrast */
    .mv2-on-dark a:focus-visible, .mv2-on-dark button:focus-visible, .mv2-on-dark summary:focus-visible {
      outline-color: ${t.copper100};
    }
    a[href]:hover { filter: brightness(0.94); transition: filter 0.15s ease; }
    button:not(:disabled):hover { filter: brightness(0.94); transition: filter 0.15s ease; }
    details summary { transition: color 0.15s ease; }
    details[open] summary { color: ${t.indigo}; }
    details[open] summary > span:last-child { transform: rotate(45deg); transition: transform 0.2s ease; display: inline-block; }
    :root { --mv2-line: ${t.line}; }
    @keyframes mv2-pulse-dot { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.6); opacity: 0.4; } }
    .mv2-pulse-dot { animation: mv2-pulse-dot 1.8s ease-in-out infinite; }
    /* Scroll-driven reveal */
    @keyframes mv2-reveal { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    .mv2-reveal { opacity: 0; }
    .mv2-reveal.is-in { animation: mv2-reveal 0.7s ${ease} forwards; }
    @media (prefers-reduced-motion: reduce) {
      .mv2-reveal, .mv2-reveal.is-in { opacity: 1 !important; animation: none !important; transform: none !important; }
      .mv2-pulse-dot { animation: none !important; }
    }
    /* Mock first-paint choreography */
    @keyframes mv2-bar-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @keyframes mv2-fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .mv2-mock-card { transition: transform 0.4s ${ease}, box-shadow 0.4s ${ease}; }
    .mv2-mock-card:hover { transform: translateY(-2px); box-shadow: ${shadows.mockHover}; }
    @media (prefers-reduced-motion: reduce) {
      .mv2-bar-fill, .mv2-fade-up { animation: none !important; transform: none !important; opacity: 1 !important; }
      .mv2-mock-card { transition: none !important; }
    }
    /* Pricing card hover lift */
    .mv2-price-card { transition: transform 0.2s ${ease}, box-shadow 0.2s ${ease}; }
    .mv2-price-card:hover { transform: translateY(-3px); box-shadow: ${shadows.priceHover}; }
    /* Logo marquee */
    @keyframes mv2-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
    .mv2-marquee-track { display: flex; gap: 12px; width: max-content; animation: mv2-marquee 38s linear infinite; }
    /* Pause CSS animation when the strip scrolls off-screen — content-visibility:auto
       skips rendering the section, dropping paint cost on long pages + low-end mobiles. */
    .mv2-marquee-mask { mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent); -webkit-mask-image: linear-gradient(90deg, transparent, black 8%, black 92%, transparent); overflow: hidden; content-visibility: auto; contain-intrinsic-size: 1px 96px; }
    .mv2-marquee-mask:hover .mv2-marquee-track { animation-play-state: paused; }
    @media (prefers-reduced-motion: reduce) { .mv2-marquee-track { animation: none; } }
    /* Skip paint + pause CSS animations on off-screen sections (battery on low-end mobile) */
    .mv2-cv-auto { content-visibility: auto; contain-intrinsic-size: 1px 700px; }
    /* Hero load cascade — stepped entrance, one orchestrated moment */
    @keyframes mv2-cascade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .mv2-cascade { opacity: 0; animation: mv2-cascade 0.72s ${ease} forwards; }
    .mv2-cascade-1 { animation-delay: 0ms; }
    .mv2-cascade-2 { animation-delay: 80ms; }
    .mv2-cascade-3 { animation-delay: 160ms; }
    .mv2-cascade-4 { animation-delay: 260ms; }
    .mv2-cascade-5 { animation-delay: 360ms; }
    .mv2-cascade-6 { animation-delay: 460ms; }
    @media (prefers-reduced-motion: reduce) {
      .mv2-cascade { opacity: 1 !important; animation: none !important; transform: none !important; }
    }
    /* Primary CTA — arrow drifts on hover, signals forward motion */
    .mv2-cta-primary { transition: transform 0.25s ${ease}, box-shadow 0.25s ${ease}, filter 0.15s ease; }
    .mv2-cta-primary:hover { transform: translateY(-1px); box-shadow: ${shadows.ctaPrimaryHover}; }
    .mv2-cta-primary .mv2-cta-arrow { transition: transform 0.28s ${ease}; display: inline-block; }
    .mv2-cta-primary:hover .mv2-cta-arrow { transform: translateX(4px); }
    .mv2-cta-primary:active { transform: translateY(0) scale(0.98); transition-duration: 0.08s; }
    .mv2-cta-secondary { transition: border-color 0.2s ease, color 0.2s ease, transform 0.25s ${ease}; }
    .mv2-cta-secondary:hover { transform: translateY(-1px); border-color: ${t.coal} !important; }
    .mv2-cta-secondary:active { transform: scale(0.98); transition-duration: 0.08s; }
    @media (prefers-reduced-motion: reduce) {
      .mv2-cta-primary, .mv2-cta-secondary, .mv2-cta-primary .mv2-cta-arrow { transition: none !important; transform: none !important; }
    }
    /* Feature card — surface lifts, icon glyph scales, tint deepens */
    .mv2-feature-card { transition: transform 0.32s ${ease}, box-shadow 0.32s ${ease}, border-color 0.2s ease; }
    .mv2-feature-card:hover { transform: translateY(-4px); box-shadow: ${shadows.featureHover}; border-color: ${t.lineStrong}; }
    .mv2-feature-icon { transition: transform 0.32s ${ease}, background 0.25s ease; }
    .mv2-feature-card:hover .mv2-feature-icon { transform: scale(1.08) rotate(-3deg); background: ${t.copper}; color: ${t.cream} !important; }
    @media (prefers-reduced-motion: reduce) {
      .mv2-feature-card, .mv2-feature-icon { transition: none !important; transform: none !important; }
    }
  `}</style>
);

/* prefers-reduced-motion — single subscription, shared across components */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* Shared reveal observer — one IO for the whole page; was N independent ones */
let sharedRevealIO: IntersectionObserver | null = null;
const sharedRevealCb = new WeakMap<Element, () => void>();
function getSharedRevealIO(): IntersectionObserver | null {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return null;
  if (!sharedRevealIO) {
    sharedRevealIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const cb = sharedRevealCb.get(e.target);
            if (cb) cb();
            sharedRevealIO!.unobserve(e.target);
            sharedRevealCb.delete(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
  }
  return sharedRevealIO;
}

/* Scroll-reveal wrapper — fades + translates on enter, respects reduced-motion */
function MotionReveal({
  children,
  delay = 0,
  as: Tag = "div",
  ...rest
}: {
  children: React.ReactNode;
  delay?: number;
  as?: keyof React.JSX.IntrinsicElements;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = getSharedRevealIO();
    if (!io) {
      el.classList.add("is-in");
      return;
    }
    sharedRevealCb.set(el, () => el.classList.add("is-in"));
    io.observe(el);
    return () => {
      io.unobserve(el);
      sharedRevealCb.delete(el);
    };
  }, []);
  const Comp = Tag as React.ElementType;
  return (
    <Comp
      ref={ref as unknown as React.Ref<HTMLElement>}
      className={`mv2-reveal${rest.className ? " " + rest.className : ""}`}
      style={{ animationDelay: `${delay}ms`, ...(rest.style || {}) }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

const container: CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  paddingLeft: 32,
  paddingRight: 32,
};

const sectionBase: CSSProperties = {
  position: "relative",
  paddingTop: 120,
  paddingBottom: 120,
};

const sectionTight: CSSProperties = {
  position: "relative",
  paddingTop: 80,
  paddingBottom: 80,
};

const h2: CSSProperties = {
  fontFamily: fonts.serif,
  fontSize: "clamp(40px, 5.4vw, 72px)",
  lineHeight: 1.02,
  letterSpacing: "-0.025em",
  color: t.coal,
  margin: 0,
  fontWeight: 400,
};

const body: CSSProperties = {
  fontFamily: fonts.sans,
  fontSize: 17,
  lineHeight: 1.6,
  color: t.indigoGray,
  margin: 0,
  maxWidth: "60ch",
};

/* ─────────────────────────── 1. NAV ─────────────────────────── */
export function NavV2() {
  const navLinks: Array<[string, string]> = [
    ["How it works", "/how-it-works"],
    ["Pricing", "/pricing"],
    ["For students", "/for-students"],
    ["About", "/about"],
    ["Help", "/#faq"],
    ["Contact", "/contact"],
  ];
  /* Auth-aware CTA pair. Supabase session restore is async, so
     useAuth().isLoggedIn starts `false` and flips after restore — which
     leaves logged-in users staring at "Sign in / Start free" for the
     ~1-2s of cold restore. We sidestep that by checking localStorage
     synchronously after mount: if a Supabase auth token is present we
     optimistically render the Dashboard CTA right away, then keep it
     in sync with the real `isLoggedIn` once restore completes.
     SSR + first paint still render the signed-out variant to avoid
     hydration mismatch. */
  const { isLoggedIn, loading } = useAuth();
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => { setHasSession(hasStoredSession()); }, [isLoggedIn]);
  const showDashboard = isLoggedIn || (loading && hasSession);
  const pathname = usePathname();
  const isActive = (href: string) => {
    if (href.startsWith("/#")) return false;
    return pathname === href || (href !== "/" && pathname?.startsWith(href));
  };

  // Mobile drawer (≤880px): the desktop link row is hidden by the
  // responsive sheet, so without this the nav links are unreachable on
  // phones/tablets. The hamburger only renders ≤880px (CSS); state lives
  // here so we can close on navigation and on Escape.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { setMenuOpen(false); }, [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);
  return (
    <header role="banner">
      {/* Self-contained nav responsive rules. NavV2 is rendered both by the
          homepage and standalone by every marketing sub-page (via
          MarketingPagesV2). The homepage ResponsiveSheet used to be the only
          place these lived, so sub-pages shipped the desktop link row with no
          way to collapse it — on a phone that forced a ~657px layout viewport
          and zoomed the whole page out. Keeping the rules here means the nav
          collapses correctly wherever it mounts. */}
      <style>{`
        @media (max-width: 880px) {
          .mv2-nav-links { display: none !important; }
          .mv2-nav-cta-label { display: none !important; }
          .mv2-nav-burger { display: inline-flex !important; }
          /* Hide the "Sign in" text link — it's in the mobile drawer */
          .mv2-nav-sign-in { display: none !important; }
        }
      `}</style>
      <nav
        aria-label="Primary"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          /* Opaque sticky nav. We tried translucent + blur; the visual gain
             against a cream surface was nil and the compositor cost on every
             scroll frame was real on low-end Android. Fully opaque + hairline
             border reads exactly the same and costs nothing. */
          background: t.cream,
          borderBottom: `1px solid ${t.line}`,
        }}
      >
        <div
          style={{
            ...container,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 68,
          }}
        >
          <a
            href="/"
            aria-label="HireStepX home"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            <img src="/wordmark.png" alt="HireStepX" style={{ height: 26, width: "auto" }} />
          </a>

          <div
            className="mv2-nav-links"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
              fontFamily: fonts.sans,
              fontSize: 14,
            }}
          >
            {navLinks.map(([label, href]) => {
              const active = isActive(href);
              return (
                <a
                  key={label}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  style={{
                    color: active ? t.coal : t.inkSoft,
                    textDecoration: "none",
                    fontWeight: active ? 600 : 500,
                    transition: `color 0.2s ${ease}`,
                    position: "relative",
                    paddingBottom: 4,
                    borderBottom: active ? `1.5px solid ${t.copper}` : "1.5px solid transparent",
                  }}
                >
                  {label}
                </a>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {showDashboard ? (
              <a
                href="/dashboard"
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 14,
                  fontWeight: 600,
                  color: t.white,
                  background: t.indigo,
                  padding: "9px 18px",
                  borderRadius: 999,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                Dashboard
                <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
              </a>
            ) : (
              <>
                <a
                  href="/login"
                  className="mv2-nav-sign-in"
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 14,
                    fontWeight: 500,
                    color: t.inkSoft,
                    textDecoration: "none",
                  }}
                >
                  Sign in
                </a>
                <a
                  href="/signup"
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 14,
                    fontWeight: 600,
                    color: t.white,
                    background: t.indigo,
                    padding: "9px 18px",
                    borderRadius: 999,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  Start free
                  <span style={{ fontSize: 16, lineHeight: 1 }}>→</span>
                </a>
              </>
            )}

            <button
              type="button"
              className="mv2-nav-burger mv2-tap-44"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mv2-mobile-menu"
              onClick={() => setMenuOpen((v) => !v)}
              style={{
                display: "none",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                marginRight: -8,
                padding: 0,
                border: "none",
                background: "transparent",
                color: t.coal,
                cursor: "pointer",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {menuOpen ? (
                  <>
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </>
                ) : (
                  <>
                    <path d="M3 6h18" />
                    <path d="M3 12h18" />
                    <path d="M3 18h18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="mv2-mobile-menu"
            style={{
              borderTop: `1px solid ${t.line}`,
              background: t.cream,
              padding: "12px 18px 20px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              {navLinks.map(([label, href]) => {
                const active = isActive(href);
                return (
                  <a
                    key={label}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                    className="mv2-tap-44"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontFamily: fonts.sans,
                      fontSize: 16,
                      fontWeight: active ? 600 : 500,
                      color: active ? t.coal : t.inkSoft,
                      textDecoration: "none",
                      padding: "12px 0",
                      borderBottom: `1px solid ${t.line}`,
                    }}
                  >
                    {label}
                  </a>
                );
              })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              {showDashboard ? (
                <a
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 15,
                    fontWeight: 600,
                    color: t.white,
                    background: t.indigo,
                    padding: "13px 18px",
                    borderRadius: 999,
                    textDecoration: "none",
                    textAlign: "center",
                  }}
                >
                  Go to dashboard →
                </a>
              ) : (
                <>
                  <a
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 15,
                      fontWeight: 600,
                      color: t.coal,
                      background: t.white,
                      border: `1px solid ${t.lineStrong}`,
                      padding: "12px 18px",
                      borderRadius: 999,
                      textDecoration: "none",
                      textAlign: "center",
                    }}
                  >
                    Sign in
                  </a>
                  <a
                    href="/signup"
                    onClick={() => setMenuOpen(false)}
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 15,
                      fontWeight: 600,
                      color: t.white,
                      background: t.indigo,
                      padding: "13px 18px",
                      borderRadius: 999,
                      textDecoration: "none",
                      textAlign: "center",
                    }}
                  >
                    Start free →
                  </a>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

/* ─────────────────────────── 2. HERO ─────────────────────────── */
function Waveform({ accent }: { accent?: string }) {
  const bars = 28;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 26 }} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => {
        // Round to an integer: React serializes a float like 20.7707… to a
        // truncated "20.7707px" string on the server but keeps full precision
        // on the client, which trips a hydration mismatch warning. Source is
        // deterministic, so rounding removes the warning without changing the look.
        const h = Math.round(5 + Math.abs(Math.sin(i * 0.9)) * 21);
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 3,
              height: h,
              borderRadius: 2,
              background: i % 6 === 0 ? accent || t.copper : t.inkFaint,
              opacity: i > bars - 4 ? 0.4 : 1,
              animation: `wf 1.2s ${i * 0.04}s ease-in-out infinite`,
            }}
          />
        );
      })}
      <style>{`@keyframes wf {0%,100%{transform:scaleY(1)}50%{transform:scaleY(0.4)}}`}</style>
    </div>
  );
}

function ProductMockHero() {
  type Phase = "idle" | "listening" | "scoring" | "done";
  const scenarios = [
    {
      company: "Razorpay",
      round: "Behavioural Round",
      question:
        "Tell me about a time you led a cross-functional project under a tight deadline.",
      transcript:
        "Last quarter at Razorpay, our checkout latency spiked during a Tier-1 sale. I was asked to lead a tiger team across infra and product",
      score: "8.4",
      bars: [
        ["Situation", 92],
        ["Task", 88],
        ["Action", 71],
        ["Result", 64],
      ] as Array<[string, number]>,
      fix: 'Quantify the result. Try "checkout p95 latency from 1.4s → 380ms".',
    },
    {
      company: "Zomato",
      round: "Product Sense",
      question:
        "How would you re-design the Zomato Gold flow for tier-2 cities?",
      transcript:
        "I'd start by segmenting Gold users by frequency, then audit the funnel from search to checkout. The drop-off in tier-2 is at payment, not discovery",
      score: "9.1",
      bars: [
        ["Framework", 95],
        ["User empathy", 92],
        ["Metrics", 86],
        ["Tradeoffs", 78],
      ] as Array<[string, number]>,
      fix: "Strong frame. Add one cost tradeoff to push past a 9.5.",
    },
    {
      company: "TCS Digital",
      round: "HR Round",
      question: "Why TCS Digital and not just TCS?",
      transcript:
        "Digital is where TCS bets on the next decade: cloud, data, the modernisation work. The codebase pace matches my pace; the regular stream felt like maintenance.",
      score: "7.6",
      bars: [
        ["Honesty", 88],
        ["Specificity", 74],
        ["Brand fit", 82],
        ["Confidence", 70],
      ] as Array<[string, number]>,
      fix: 'Add one concrete project. "I want to work on Aurora rollouts" beats brand talk.',
    },
  ];
  const [idx, setIdx] = useState(0);
  const scene = scenarios[idx];
  const [phase, setPhase] = useState<Phase>("done");
  const [typed, setTyped] = useState("");
  const [displayScore, setDisplayScore] = useState(parseFloat(scenarios[0].score));
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (phase !== "listening") return;
    /* Reduced-motion: skip the typewriter, jump straight to scored state */
    if (reducedMotion) {
      setTyped(scene.transcript);
      setPhase("done");
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setTyped(scene.transcript.slice(0, i));
      if (i >= scene.transcript.length) {
        clearInterval(id);
        setTimeout(() => setPhase("scoring"), 350);
        setTimeout(() => setPhase("done"), 1500);
      }
    }, 28);
    return () => clearInterval(id);
  }, [phase, scene.transcript, reducedMotion]);

  /* Score count-up on each new scored answer */
  useEffect(() => {
    if (phase !== "done") return;
    const target = parseFloat(scene.score);
    /* Reduced-motion: set final value instantly, no rAF loop */
    if (reducedMotion) {
      setDisplayScore(target);
      return;
    }
    const start = performance.now();
    const dur = 700;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplayScore(Math.round(target * eased * 10) / 10);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setDisplayScore(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, scene.score, idx, reducedMotion]);

  /* Auto-cycle scenarios — bounded + pausable per critique.
     - Bounded: stops after looping through every scenario once (autoLoops < scenarios.length).
       The previous infinite cycle competed with the H1 for attention forever.
     - Pausable: user can stop the rotation; survives until they tap "Try it" again.
     - First cycle delayed (4.5s instead of 6.2s the first tick) so the user has
       time to read the hero before the mock starts moving on its own. */
  const [autoPaused, setAutoPaused] = useState(false);
  const [autoLoops, setAutoLoops] = useState(0);
  useEffect(() => {
    if (phase !== "done" || reducedMotion || autoPaused) return;
    if (autoLoops >= scenarios.length) return;
    const delay = autoLoops === 0 ? 4500 : 6200;
    const id = setTimeout(() => {
      setIdx((i) => (i + 1) % scenarios.length);
      setAutoLoops((n) => n + 1);
      setPhase("done");
    }, delay);
    return () => clearTimeout(id);
  }, [phase, idx, scenarios.length, reducedMotion, autoPaused, autoLoops]);

  const start = () => {
    if (phase === "done") setIdx((i) => (i + 1) % scenarios.length);
    setTyped("");
    setPhase("listening");
    /* User-initiated → reset auto-cycle budget so they get fresh rotation */
    setAutoLoops(0);
    setAutoPaused(false);
  };

  const phaseLabel =
    phase === "idle"
      ? "Ready · tap Try it"
      : phase === "listening"
        ? "Live · 00:24"
        : phase === "scoring"
          ? "Scoring…"
          : "Scored · 00:31";

  const phaseColor =
    phase === "scoring" ? t.copper : phase === "done" ? t.indigo : t.success;

  /* Screen-reader narration for the silent visual phase machine */
  const liveAnnounce =
    phase === "listening"
      ? `AI is listening to your answer for ${scene.company} ${scene.round}.`
      : phase === "scoring"
        ? "Scoring your answer."
        : phase === "done"
          ? `Scored ${scene.score} out of 10. ${scene.fix}`
          : "Demo ready. Press Try it to start.";

  return (
    <div
      className="mv2-mock-card"
      role="region"
      aria-label="Live mock interview demo"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 980,
        margin: "56px auto 0",
        borderRadius: 20,
        background: t.white,
        border: `1px solid ${t.line}`,
        boxShadow: shadows.modal,
        overflow: "hidden",
      }}
    >
      {/* SR-only narration of the phase state machine (silent to sighted users) */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0,0,0,0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {liveAnnounce}
      </span>
      {/* Window chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 18px",
          borderBottom: `1px solid ${t.line}`,
          background: t.creamSoft,
        }}
      >
        {[t.error, t.warning, t.success].map((color, i) => (
          <span
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: color,
              opacity: 0.85,
            }}
          />
        ))}
        <span
          style={{
            marginLeft: 14,
            fontFamily: fonts.mono,
            fontSize: 12,
            color: t.inkFaint,
          }}
        >
          hirestepx.com/interview · {scene.round} · {scene.company}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: fonts.sans,
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: t.inkFaint,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Round {String(idx + 1).padStart(2, "0")} / {String(scenarios.length).padStart(2, "0")}
        </span>
      </div>

      {/* Body */}
      <div className="mv2-hero-mock-body" style={{ display: "grid", gridTemplateColumns: "1fr 280px" }}>
        {/* Left: live transcript */}
        <div
          style={{
            padding: 32,
            borderRight: `1px solid ${t.line}`,
            background: t.white,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: fonts.sans,
                fontSize: 11,
                color: phaseColor,
                fontWeight: 600,
                padding: "4px 10px",
                background:
                  phase === "scoring"
                    ? t.copperSoft
                    : phase === "done"
                      ? t.indigo100
                      : t.success100,
                borderRadius: 999,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: phaseColor,
                  animation:
                    phase === "listening" ? "pulse 1s infinite" : undefined,
                }}
              />
              {phaseLabel}
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}`}</style>
            </span>
            {phase === "listening" && <Waveform />}
            <button
              onClick={start}
              disabled={phase === "listening" || phase === "scoring"}
              style={{
                marginLeft: "auto",
                border: 0,
                cursor: phase === "idle" || phase === "done" ? "pointer" : "default",
                background: phase === "idle" || phase === "done" ? t.indigo : t.cream,
                color: phase === "idle" || phase === "done" ? t.white : t.inkFaint,
                fontFamily: fonts.sans,
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 999,
                boxShadow:
                  phase === "idle" || phase === "done" ? shadows.cta : "none",
              }}
            >
              {phase === "done" ? "Replay" : phase === "idle" ? "Try it ▶" : "…"}
            </button>
            {/* Pause / Resume — only meaningful while auto-rotation is still
                budgeted and the user hasn't asked for reduced motion. Keeps
                the User Control & Freedom heuristic honest without adding
                chrome that does nothing 90% of the time. */}
            {!reducedMotion && phase === "done" && autoLoops < scenarios.length && (
              <button
                onClick={() => setAutoPaused((p) => !p)}
                aria-pressed={autoPaused}
                aria-label={autoPaused ? "Resume auto rotation" : "Pause auto rotation"}
                style={{
                  border: `1px solid ${t.lineStrong}`,
                  cursor: "pointer",
                  background: "transparent",
                  color: t.inkSoft,
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: 999,
                }}
              >
                {autoPaused ? "Resume" : "Pause"}
              </button>
            )}
          </div>

          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              color: t.inkFaint,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              margin: 0,
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            Interviewer
          </p>
          <p
            key={`question-${idx}`}
            style={{
              fontFamily: fonts.sans,
              fontSize: 17,
              color: t.coal,
              lineHeight: 1.55,
              margin: 0,
              marginBottom: 20,
              animation: `mv2-fade-up 0.55s ${ease} both`,
            }}
          >
            {scene.question}
          </p>

          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              color: t.copper,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              margin: 0,
              marginBottom: 6,
              fontWeight: 600,
            }}
          >
            You
          </p>
          <p
            key={`transcript-${idx}-${phase}`}
            style={{
              fontFamily: fonts.sans,
              fontSize: 17,
              color: t.inkSoft,
              lineHeight: 1.55,
              margin: 0,
              minHeight: 80,
              animation:
                phase === "done"
                  ? `mv2-fade-up 0.6s ${ease} 80ms both`
                  : undefined,
            }}
          >
            {phase === "idle" ? (
              <span style={{ color: t.inkFaint, fontStyle: "italic" }}>
                Your answer appears here as you speak…
              </span>
            ) : (
              <>
                {phase === "done" ? scene.transcript : typed}
                {(phase === "listening" || phase === "done") && (
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 18,
                      background: t.copper,
                      verticalAlign: "text-bottom",
                      marginLeft: 2,
                      opacity: phase === "done" ? 0.5 : 1,
                      animation: "caret 1.1s steps(1) infinite",
                    }}
                  />
                )}
              </>
            )}
          </p>
          <style>{`@keyframes caret{50%{opacity:0}}`}</style>
        </div>

        {/* Right: scored answer */}
        <div
          className="mv2-hero-mock-side"
          style={{
            padding: 24,
            background: t.cream,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              color: t.inkFaint,
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Last answer
          </p>

          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              key={`score-${idx}-${phase}`}
              style={{
                fontFamily: fonts.serif,
                fontSize: 56,
                color: t.indigo,
                lineHeight: 1,
                opacity: phase === "done" ? 1 : 0.3,
                animation:
                  phase === "done"
                    ? `mv2-fade-up 0.55s ${ease} 200ms both`
                    : undefined,
              }}
            >
              {phase === "done" ? displayScore.toFixed(1) : "—"}
            </span>
            <span
              style={{ fontFamily: fonts.sans, fontSize: 14, color: t.inkFaint }}
            >
              / 10
            </span>
          </div>

          {scene.bars.map(([label, val], i) => (
            <div key={label as string}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  color: t.coal,
                  fontWeight: 500,
                  marginBottom: 4,
                }}
              >
                <span>{label}</span>
                <span style={{ color: t.inkFaint }}>{val}</span>
              </div>
              <div
                style={{
                  height: 4,
                  background: t.copper100,
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  key={`bar-${idx}-${i}-${phase}`}
                  style={{
                    width: `${val}%`,
                    height: "100%",
                    background:
                      (val as number) > 80
                        ? t.success
                        : (val as number) > 70
                          ? t.indigo
                          : t.copper,
                    transformOrigin: "left center",
                    animation:
                      phase === "done"
                        ? `mv2-bar-fill 0.9s ${ease} ${320 + i * 110}ms both`
                        : undefined,
                  }}
                />
              </div>
            </div>
          ))}

          <div
            style={{
              marginTop: "auto",
              padding: 12,
              background: t.white,
              border: `1px solid ${t.line}`,
              borderRadius: 10,
              fontFamily: fonts.sans,
              fontSize: 12,
              color: t.coal,
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: t.copper, fontWeight: 600 }}>Fix →</span>{" "}
            {scene.fix}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Editorial section masthead — numbered hairline used across the page */
function SectionMasthead({
  n,
  label,
  right,
  live = false,
  style,
}: {
  n: string;
  label: string;
  right?: React.ReactNode;
  live?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        fontFamily: fonts.sans,
        fontSize: 11,
        lineHeight: 1,
        color: t.inkFaint,
        textTransform: "uppercase",
        letterSpacing: "0.2em",
        fontWeight: 600,
        ...style,
      }}
    >
      <span style={{ color: t.coal }}>{n}</span>
      <span aria-hidden style={{ color: t.inkFaint }}>/</span>
      <span>{label}</span>
      <span aria-hidden style={{ flex: 1, height: 1, background: t.line }} />
      {right ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {live ? (
            <span
              aria-hidden
              className="mv2-pulse-dot"
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: t.success,
              }}
            />
          ) : null}
          {right}
        </span>
      ) : null}
    </div>
  );
}

/* Aspirational micro-copy, not testimonials. We don't have customers
   yet (founded 2026) — fabricating named quotes would burn credibility
   the second any prospect googles the names. Rotated through the hero
   as a "what this product is for" line. */
const heroQuotes = [
  { text: "Walk into the loop already knowing how you sound.", by: "Built for Indian candidates" },
  { text: "Practice the why-this-company answer until it lands.", by: "Behavioral · campus · negotiation" },
  { text: "Scored feedback on every answer, every session.", by: "Free first session — no card" },
];

export function HeroV2() {
  const [quoteIdx, setQuoteIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setQuoteIdx((i) => (i + 1) % heroQuotes.length),
      6200,
    );
    return () => clearInterval(id);
  }, []);
  const quote = heroQuotes[quoteIdx];
  return (
    <section
      aria-labelledby="hd-hero"
      className="mv2-hero-section"
      style={{
        ...sectionBase,
        paddingTop: 56,
        paddingBottom: 88,
        background: t.cream,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Editorial backdrop — copper wash anchored to the mock side */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 55% 45% at 78% 18%, rgba(180, 83, 9, 0.08) 0%, transparent 65%)",
          pointerEvents: "none",
          contain: "paint",
        }}
      />
      <div
        style={{
          ...container,
          position: "relative",
          width: "100%",
        }}
      >
        <div className="mv2-cascade mv2-cascade-1">
          <SectionMasthead
            n="01"
            label="Practice"
            live
            right="Live · Edition 2026"
          />
        </div>

        {/* Asymmetric editorial split — text + mock in two columns, the
            hero is content-sized (no forced viewport height) so there's
            no dead-air band below. */}
        <div
          className="mv2-hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.2fr",
            gap: 56,
            alignItems: "center",
            marginTop: 32,
          }}
        >
          {/* Left — text column */}
          <div style={{ maxWidth: 600 }}>
            <h1
              id="hd-hero"
              className="mv2-hero-display mv2-cascade mv2-cascade-2"
              style={{
                fontFamily: fonts.serif,
                fontSize: "clamp(40px, 4.6vw, 64px)",
                lineHeight: 1.04,
                letterSpacing: "-0.025em",
                color: t.coal,
                margin: 0,
                fontWeight: 400,
              }}
            >
              Practice the interview.
              <br />
              <span style={{ fontStyle: "italic", color: t.copper }}>
                Not the panic.
              </span>
            </h1>

            <p
              className="mv2-cascade mv2-cascade-3"
              style={{
                fontFamily: fonts.sans,
                fontSize: 18,
                lineHeight: 1.55,
                color: t.inkSoft,
                maxWidth: 480,
                margin: "28px 0 0",
              }}
            >
              AI mock interviews you actually speak to — scored against the
              rubrics real Indian panels use. Your first 3 sessions are free, no
              card needed. STAR breakdown back before your chai cools.
            </p>

            <div
              className="mv2-hero-cta-row mv2-cascade mv2-cascade-4"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                marginTop: 36,
                flexWrap: "wrap",
              }}
            >
              <a
                href="/signup"
                className="mv2-tap-44 mv2-cta-primary"
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 15,
                  fontWeight: 600,
                  color: t.white,
                  background: t.indigo,
                  padding: "14px 24px",
                  borderRadius: 999,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                Start round 01
                <span aria-hidden className="mv2-cta-arrow" style={{ fontSize: 16 }}>→</span>
              </a>
              <a
                href="/how-it-works"
                className="mv2-tap-44 mv2-cta-secondary"
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 15,
                  fontWeight: 600,
                  color: t.coal,
                  padding: "14px 22px",
                  borderRadius: 999,
                  textDecoration: "none",
                  border: `1px solid ${t.lineStrong}`,
                  background: "transparent",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                Watch 60-sec preview
              </a>
            </div>

            {/* Single-line trust band — replaces helper + pulse pill */}
            <div
              className="mv2-cascade mv2-cascade-5"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginTop: 32,
                paddingTop: 20,
                borderTop: `1px solid ${t.line}`,
                fontFamily: fonts.sans,
                fontSize: 13,
                color: t.inkSoft,
                flexWrap: "wrap",
              }}
            >
              <span style={{ color: t.coal, fontWeight: 600 }}>
                3 sessions free
              </span>
              <span aria-hidden style={{ color: t.inkFaint }}>·</span>
              <span>No card needed</span>
              <span aria-hidden style={{ color: t.inkFaint }}>·</span>
              <span>
                <span
                  style={{
                    fontFamily: fonts.serif,
                    fontStyle: "italic",
                    color: t.copper,
                  }}
                >
                  ₹9
                </span>{" "}
                per session after
              </span>
            </div>

            {/* Social proof — rotating testimonial */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 14,
                fontFamily: fonts.sans,
                fontSize: 12,
                color: t.inkFaint,
                minHeight: 20,
              }}
            >
              <span
                aria-hidden
                className="mv2-pulse-dot"
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: t.success,
                  flexShrink: 0,
                }}
              />
              <span
                key={`quote-${quoteIdx}`}
                style={{
                  animation: `mv2-fade-up 0.5s ${ease} both`,
                }}
              >
                <span
                  style={{
                    fontFamily: fonts.serif,
                    fontStyle: "italic",
                    color: t.coal,
                  }}
                >
                  "{quote.text}"
                </span>{" "}
                <span style={{ color: t.inkFaint }}>({quote.by})</span>
              </span>
            </div>
          </div>

          {/* Right — product mock with editorial caption */}
          <div
            className="mv2-hero-mock-wrap"
            style={{ position: "relative", marginTop: -56 }}
          >
            <ProductMockHero />
            {/* Caption row — credits the mock, restores rhythm against left trust band */}
            <div
              className="mv2-hero-margin-note"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 18,
                paddingLeft: 4,
                fontFamily: fonts.sans,
                fontSize: 11,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: t.inkFaint,
                fontWeight: 600,
              }}
            >
              <span style={{ color: t.coal }}>Live mock</span>
              <span aria-hidden style={{ color: t.line }}>/</span>
              <span>Behavioural · Razorpay</span>
              <span aria-hidden style={{ color: t.line }}>/</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span
                  aria-hidden
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: t.copper,
                  }}
                />
                Scored in ~12s
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── 3. LOGO STRIP + STAT ─────────────────────────── */
function LogoMark({ label }: { label: string }) {
  /* Uniform serif wordmark — NO external logo CDN.
     We used to pull glyphs from cdn.simpleicons.org with an onError →
     wordmark fallback, but simpleicons drops brands for trademark reasons
     (Flipkart, Deloitte, Microsoft, Amazon, Adobe, Salesforce all 404'd in
     prod), which produced console 404 noise, a fallback race that briefly
     left 0-width broken <img>s, and an inconsistent strip where some brands
     showed icons and others text. Rendering every brand as a wordmark is
     visually consistent, zero-dependency, and can never 404 — the strip's
     reliability no longer rides on a third-party CDN. */
  return (
    <span
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 40,
        padding: "0 24px",
        flexShrink: 0,
        fontFamily: fonts.serif,
        fontSize: 22,
        color: t.coal,
        opacity: 0.72,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function LogoStripV2() {
  const logos: string[] = [
    "Razorpay",
    "Zomato",
    "Flipkart",
    "Swiggy",
    "Paytm",
    "PhonePe",
    "Infosys",
    "Wipro",
    "HDFC Bank",
    "Deloitte",
    "Accenture",
    "Google",
    "Microsoft",
    "Amazon",
    "Adobe",
    "Salesforce",
  ];
  return (
    <section
      aria-label="Companies our question bank covers"
      className="mv2-cv-auto"
      style={{
        ...sectionTight,
        background: t.creamSoft,
        borderTop: `1px solid ${t.line}`,
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <div style={container}>
        <SectionMasthead n="02" label="Question bank covers" right="200+ Indian roles" style={{ marginBottom: 32 }} />
        <p
          style={{
            fontFamily: fonts.serif,
            fontSize: "clamp(40px, 5vw, 56px)",
            color: t.coal,
            margin: 0,
            letterSpacing: "-0.02em",
            fontWeight: 400,
            textAlign: "center",
          }}
        >
          Every name{" "}
          <span style={{ fontStyle: "italic", color: t.copper }}>
            you're targeting.
          </span>
        </p>
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: 12,
            fontWeight: 600,
            color: t.inkFaint,
            marginTop: 8,
            marginBottom: 36,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          IT services · Unicorns · PSUs · MNCs · All four covered
        </p>

        <div className="mv2-logo-strip mv2-marquee-mask">
          <div className="mv2-marquee-track" aria-hidden>
            {[...logos, ...logos].map((label, i) => (
              <LogoMark key={`${label}-${i}`} label={label} />
            ))}
          </div>
          <span className="mv2-skip" aria-live="off">
            Practiced for {logos.join(", ")}
          </span>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── 3.5. INTERVIEW FOCUS ─────────────────────────── */
export function InterviewFocusV2() {
  const flagship = {
    role: "Behavioral",
    tag: "Leadership · Conflict · Decision-making",
    sample: "Tell me about a time you disagreed with a senior and turned out to be right.",
    loops: ["STAR scoring", "Tell me about…", "Why this role", "Failure stories", "Conflict resolution", "Ownership"],
  };
  const tracks: Array<{ role: string; loops: string[]; tag: string }> = [
    {
      role: "Campus Placement",
      tag: "Aptitude · HR · Role-fit",
      loops: ["TCS Digital", "Infosys SP", "Wipro Elite", "Cognizant GenC"],
    },
    {
      role: "Salary Negotiation",
      tag: "Counter-offers · Levelling · Benefits",
      loops: ["Razorpay", "Zomato", "Flipkart", "Swiggy", "Cred"],
    },
    {
      role: "HR Round",
      tag: "Culture fit · Motivation · Expectations",
      loops: ["Behavioral fit", "Salary expectations", "Notice period", "Why leaving"],
    },
  ];
  const comingSoon = [
    "Strategic",
    "Technical Leadership",
    "Case Study",
    "Panel Interview",
    "Management",
    "Government / PSU",
  ];
  return (
    <section
      className="mv2-section"
      aria-labelledby="hd-focus"
      style={{
        ...sectionBase,
        background: t.cream,
      }}
    >
      <div style={{ ...container }}>
        <SectionMasthead n="03" label="Focus" right="Roles × companies" style={{ marginBottom: 24 }} />
        <MotionReveal style={{ textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
          <h2 id="hd-focus" style={h2}>
            Ten interview types.{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>
              One coach.
            </span>
          </h2>
          <p style={{ ...body, marginTop: 16 }}>
            Four go live at launch: behavioral, campus placement, salary
            negotiation, HR round. Six more land month-by-month after public
            beta.
          </p>
        </MotionReveal>

        {/* Flagship — Behavioral gets full width + sample question pull-quote */}
        <article
          className="mv2-focus-flagship"
          style={{
            marginTop: 56,
            background: t.white,
            border: `1px solid ${t.line}`,
            borderRadius: 18,
            padding: "40px 44px",
            display: "grid",
            gridTemplateColumns: "minmax(220px, 280px) 1fr",
            gap: 56,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: fonts.mono,
                fontSize: 11,
                color: t.copper,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: 10,
              }}
            >
              Flagship track
            </div>
            <h3
              style={{
                fontFamily: fonts.serif,
                fontSize: 36,
                letterSpacing: "-0.02em",
                color: t.coal,
                margin: 0,
                fontWeight: 400,
                lineHeight: 1.05,
              }}
            >
              {flagship.role}
            </h3>
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                color: t.inkSoft,
                margin: "10px 0 0",
              }}
            >
              {flagship.tag}
            </p>
          </div>

          <div>
            <p
              style={{
                fontFamily: fonts.serif,
                fontStyle: "italic",
                fontSize: 22,
                color: t.copper,
                letterSpacing: "-0.01em",
                lineHeight: 1.3,
                margin: 0,
                textWrap: "balance" as const,
              }}
            >
              "{flagship.sample}"
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 24 }}>
              {flagship.loops.map((c) => (
                <span
                  key={c}
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.coal,
                    padding: "5px 10px",
                    background: t.creamSoft,
                    border: `1px solid ${t.line}`,
                    borderRadius: 999,
                  }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        </article>

        {/* Other 3 tracks — compact row */}
        <div
          className="mv2-focus-grid"
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          {tracks.map((track) => (
            <article
              key={track.role}
              style={{
                background: t.white,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 22,
                    letterSpacing: "-0.015em",
                    color: t.coal,
                    margin: 0,
                    fontWeight: 400,
                  }}
                >
                  {track.role}
                </h3>
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 12,
                    color: t.inkSoft,
                    margin: "6px 0 0",
                  }}
                >
                  {track.tag}
                </p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {track.loops.map((c) => (
                  <span
                    key={c}
                    style={{
                      fontFamily: fonts.sans,
                      fontSize: 11,
                      fontWeight: 500,
                      color: t.inkSoft,
                      padding: "4px 9px",
                      background: t.creamSoft,
                      border: `1px solid ${t.line}`,
                      borderRadius: 999,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div
          style={{
            marginTop: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: t.copper,
              padding: "4px 10px",
              background: t.copperSoft,
              borderRadius: 999,
            }}
          >
            Coming soon
          </span>
          {comingSoon.map((label) => (
            <span
              key={label}
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: 500,
                color: t.inkSoft,
                padding: "8px 14px",
                background: t.creamSoft,
                border: `1px dashed ${t.lineStrong}`,
                borderRadius: 999,
              }}
            >
              {label}
            </span>
          ))}
        </div>

        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: 13,
            color: t.inkFaint,
            textAlign: "center",
            marginTop: 24,
          }}
        >
          Don't see your target?{" "}
          <button
            type="button"
            style={{ color: t.indigo, fontWeight: 600, textDecoration: "none", background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer" }}
          >
            Vote on the next type →
          </button>
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────── 4. 3-STEP PRODUCT STORY ─────────────────────────── */
function Step03Score() {
  const target = 7.8;
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        obs.unobserve(el);
        const start = performance.now();
        const dur = 1100;
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 4);
          setVal(target * eased);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => {
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <span ref={ref} style={{ color: t.copper, fontWeight: 600 }}>
      {val.toFixed(1)} / 10
    </span>
  );
}

function StepMock({ step }: { step: number }) {
  const wrap: CSSProperties = {
    padding: 32,
    background: t.white,
    borderRadius: 20,
    border: `1px solid ${t.line}`,
    boxShadow: shadows.card,
    minHeight: 360,
  };
  const kicker: CSSProperties = {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: t.inkFaint,
    letterSpacing: "0.14em",
    fontWeight: 600,
    margin: 0,
  };
  const kickerDark: CSSProperties = {
    ...kicker,
    color: t.creamMuted,
  };
  if (step === 0) {
    return (
      <div style={{ padding: "8px 0", minHeight: 360 }}>
        <p style={kicker}>STEP 01 / RESUME / 4S</p>
        <div
          style={{
            marginTop: 20,
            padding: 24,
            border: `1.5px dashed ${t.copper}`,
            borderRadius: 14,
            background: t.copperSoft,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              margin: "0 auto",
              borderRadius: 10,
              background: t.copper,
              color: t.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
            }}
          >
            ↑
          </div>
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 15,
              fontWeight: 600,
              color: t.coal,
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            Drop your resume
          </p>
          <p
            style={{
              fontFamily: fonts.sans,
              fontSize: 12,
              color: t.inkSoft,
              margin: 0,
            }}
          >
            PDF, DOCX · auto-parsed in 4s
          </p>
        </div>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            ["Sample Candidate", "Tier-1 Engineering · 2026"],
            ["Backend Intern", "6 months"],
            ["Python, Go, Postgres, k8s", "Skills"],
          ].map(([a, b], idx) => (
            <div
              key={a}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: fonts.sans,
                fontSize: 13,
                padding: "10px 14px",
                borderRadius: 8,
                background: t.cream,
                border: `1px solid ${t.line}`,
                opacity: 0,
                animation: `mv2-fade-up 0.5s ${ease} ${600 + idx * 220}ms forwards`,
              }}
            >
              <span style={{ color: t.coal, fontWeight: 500 }}>{a}</span>
              <span style={{ color: t.inkSoft }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div style={wrap}>
        <p style={kicker}>STEP 02 / TARGET / 200 ROLES</p>
        <p
          style={{
            fontFamily: fonts.serif,
            fontSize: 26,
            color: t.coal,
            margin: 0,
            marginTop: 12,
          }}
        >
          Who are you interviewing with?
        </p>
        <div
          style={{
            marginTop: 20,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {[
            ["Razorpay", "Backend SDE-2", true],
            ["Zomato", "Product Manager", false],
            ["TCS", "Digital · Fresher", false],
            ["Flipkart", "Data Analyst", false],
          ].map(([co, role, active]) => (
            <div
              key={co as string}
              style={{
                padding: 16,
                borderRadius: 12,
                background: active ? t.indigo100 : t.cream,
                border: `1px solid ${active ? t.indigo : t.line}`,
              }}
            >
              <p
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 17,
                  color: t.coal,
                  margin: 0,
                }}
              >
                {co}
              </p>
              <p
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 12,
                  color: t.inkSoft,
                  marginTop: 4,
                  marginBottom: 0,
                }}
              >
                {role}
              </p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["Behavioural", "System Design", "Negotiation"].map((r, i) => (
            <span
              key={r}
              style={{
                fontFamily: fonts.sans,
                fontSize: 12,
                fontWeight: 500,
                padding: "6px 12px",
                borderRadius: 999,
                color: i === 0 ? t.white : t.coal,
                background: i === 0 ? t.indigo : t.white,
                border: `1px solid ${i === 0 ? t.indigo : t.line}`,
              }}
            >
              {r}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        ...wrap,
        background: t.coal,
        border: `1px solid ${t.creamLineFaint}`,
        /* Quieter: shadow tinted toward coal (was pure black), lower alpha so
           the step-03 mock sits on the page instead of hovering off it. */
        boxShadow: `0 20px 50px -22px ${t.coalShadow}`,
        minHeight: undefined,
      }}
    >
      <p style={kickerDark}>STEP 03 / PRACTICE / 312MS</p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 12,
          marginBottom: 20,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: t.error,
            boxShadow: `0 0 12px ${t.error}`,
          }}
        />
        <span
          style={{
            fontFamily: fonts.sans,
            fontSize: 13,
            fontWeight: 600,
            color: t.cream,
            letterSpacing: "0.05em",
          }}
        >
          REC · 03:14
        </span>
        <span style={{ marginLeft: "auto", opacity: 0.7 }}>
          <Waveform />
        </span>
      </div>
      <p
        style={{
          fontFamily: fonts.sans,
          fontSize: 11,
          color: t.creamMuted,
          margin: 0,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        Coach
      </p>
      <p
        style={{
          fontFamily: fonts.sans,
          fontSize: 16,
          color: t.cream,
          lineHeight: 1.55,
          marginTop: 6,
          marginBottom: 20,
        }}
      >
        Walk me through how you'd design a UPI fraud detection pipeline.
      </p>
      <div
        style={{
          padding: 16,
          background: t.creamSurfaceLow,
          border: `1px solid ${t.creamLineSoft}`,
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.cream }}>
          Live score:{" "}
          <Step03Score />
        </span>
        <span
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            color: t.success,
            padding: "3px 8px",
            background: t.successMist,
            borderRadius: 6,
            fontWeight: 600,
          }}
        >
          STAR · 4/4
        </span>
      </div>
    </div>
  );
}

export function ProductStoryV2() {
  const steps = [
    {
      kicker: "01",
      title: "Drop your resume",
      desc: "AI extracts your roles, projects, and skills in 4 seconds. No retyping.",
    },
    {
      kicker: "02",
      title: "Pick the company & round",
      desc: "200+ Indian roles (Razorpay PM, TCS Digital, ISRO scientist). We know the format.",
    },
    {
      kicker: "03",
      title: "Talk to the AI. Get scored.",
      desc: "Real voice in, real voice out. STAR breakdown. Coach fixes after every answer.",
    },
  ];

  return (
    <section aria-labelledby="hd-story" style={{ ...sectionBase, background: t.cream }}>
      <div style={container}>
        <SectionMasthead n="04" label="How it works" right="Three steps" style={{ marginBottom: 24 }} />
        <MotionReveal style={{ textAlign: "center", marginBottom: 80 }}>
          <h2 id="hd-story" style={h2}>
            Three steps.{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>Zero fluff.</span>
          </h2>
        </MotionReveal>

        <ol
          className="mv2-story-stages"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {steps.map((s, i) => (
            <li
              key={s.kicker}
              className="mv2-story-stage"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 360px) 1fr",
                gap: 80,
                alignItems: "center",
                paddingTop: i === 0 ? 0 : 64,
                paddingBottom: 64,
                borderTop: i === 0 ? "none" : `1px solid ${t.line}`,
              }}
            >
              <MotionReveal>
                <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 14 }}>
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 13,
                      color: t.copper,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {s.kicker}
                  </span>
                  <span
                    aria-hidden
                    style={{ width: 24, height: 1, background: t.line }}
                  />
                </div>
                <h3
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 36,
                    color: t.coal,
                    margin: 0,
                    letterSpacing: "-0.02em",
                    fontWeight: 400,
                    lineHeight: 1.1,
                    textWrap: "balance" as const,
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 16,
                    color: t.inkSoft,
                    lineHeight: 1.6,
                    marginTop: 16,
                    marginBottom: 0,
                    maxWidth: 380,
                  }}
                >
                  {s.desc}
                </p>
              </MotionReveal>

              <MotionReveal delay={80}>
                <StepMock step={i} />
              </MotionReveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────── 5. FEATURE GRID ─────────────────────────── */
function FeatureCard({
  icon,
  title,
  desc,
  span2,
  visual,
}: {
  icon: string;
  title: string;
  desc: string;
  span2?: boolean;
  visual?: React.ReactNode;
}) {
  return (
    <div
      className={`mv2-feature-card${span2 ? " mv2-feature-span2" : ""}`}
      style={{
        gridColumn: span2 ? "span 2" : "span 1",
        padding: 32,
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 20,
        boxShadow: shadows.card,
        minHeight: 240,
      }}
    >
      <span
        className="mv2-feature-icon"
        style={{
          width: 38,
          height: 38,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          background: t.copperSoft,
          color: t.copper,
          fontSize: 18,
          marginBottom: 20,
        }}
        aria-hidden
      >
        {icon}
      </span>
      <h3
        style={{
          fontFamily: fonts.serif,
          fontSize: 24,
          color: t.coal,
          margin: 0,
          marginBottom: 8,
          letterSpacing: "-0.015em",
          fontWeight: 400,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: fonts.sans,
          fontSize: 14,
          color: t.inkSoft,
          lineHeight: 1.55,
          margin: 0,
          maxWidth: span2 ? 460 : "100%",
        }}
      >
        {desc}
      </p>
      {visual ? <div style={{ marginTop: 24 }}>{visual}</div> : null}
    </div>
  );
}

function ScoredReportVisual() {
  return (
    <div
      style={{
        padding: 20,
        background: t.cream,
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 24,
        alignItems: "center",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p
          style={{
            fontFamily: fonts.serif,
            fontSize: 56,
            color: t.indigo,
            margin: 0,
            lineHeight: 1,
          }}
        >
          7.9
        </p>
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: 11,
            color: t.inkFaint,
            margin: 0,
            marginTop: 4,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Session avg
        </p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          ["Clarity", 84],
          ["Structure (STAR)", 76],
          ["Confidence", 72],
          ["Specificity", 68],
        ].map(([k, v]) => (
          <div key={k as string}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: fonts.sans,
                fontSize: 12,
                color: t.coal,
                fontWeight: 500,
                marginBottom: 3,
              }}
            >
              <span>{k}</span>
              <span style={{ color: t.inkFaint }}>{v}</span>
            </div>
            <div
              style={{
                height: 3,
                background: t.copper100,
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${v}%`,
                  height: "100%",
                  background: t.indigo,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LatencyVisual() {
  return (
    <div
      style={{
        padding: 14,
        background: t.cream,
        border: `1px solid ${t.line}`,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: fonts.mono,
        fontSize: 12,
        color: t.coal,
      }}
    >
      <Waveform />
      <span style={{ marginLeft: "auto", color: t.success, fontWeight: 600 }}>
        312 ms
      </span>
    </div>
  );
}

function RoundsVisual() {
  const rounds = ["TCS Digital", "Razorpay SDE-2", "Zomato PM", "ISRO Sci-B"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {rounds.map((r, i) => (
        <span
          key={r}
          style={{
            fontFamily: fonts.sans,
            fontSize: 11,
            fontWeight: 500,
            padding: "5px 10px",
            borderRadius: 999,
            background: i === 0 ? t.indigo : t.white,
            color: i === 0 ? t.white : t.coal,
            border: `1px solid ${i === 0 ? t.indigo : t.line}`,
          }}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function DecayVisual() {
  const days = [80, 62, 48, 74, 88, 71, 95];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        height: 56,
        padding: 10,
        background: t.cream,
        border: `1px solid ${t.line}`,
        borderRadius: 10,
      }}
    >
      {days.map((d, i) => (
        <span
          key={i}
          style={{
            flex: 1,
            height: `${d}%`,
            background:
              d < 60 ? t.copper : d > 85 ? t.success : t.indigo,
            borderRadius: 2,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

function PayVisual() {
  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        flexWrap: "wrap",
      }}
    >
      {["UPI", "Visa", "GPay", "PhonePe", "Cards"].map((p, i) => (
        <span
          key={p}
          style={{
            fontFamily: fonts.sans,
            fontSize: 11,
            fontWeight: 600,
            padding: "5px 9px",
            borderRadius: 6,
            background: i === 4 ? t.success100 : t.white,
            color: i === 4 ? t.success : t.coal,
            border: `1px solid ${i === 4 ? t.success100 : t.line}`,
          }}
        >
          {p}
        </span>
      ))}
    </div>
  );
}

export function FeatureGridV2() {
  return (
    <section aria-labelledby="hd-features" style={{ ...sectionBase, background: t.cream }}>
      <div style={container}>
        <SectionMasthead n="05" label="What you get" right="At launch" style={{ marginBottom: 24 }} />
        <MotionReveal style={{ marginBottom: 56 }}>
          <h2 id="hd-features" className="mv2-features-h2" style={{ ...h2, whiteSpace: "nowrap" }}>
            Not another{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>
              question bank.
            </span>
          </h2>
          <p style={{ ...body, marginTop: 16 }}>
            Every session ends with a numbered breakdown of what to fix,
            not a vague "great job, keep practicing".
          </p>
        </MotionReveal>

        <div
          className="mv2-feature-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          <FeatureCard
            icon="◐"
            title="Real voice. Real pressure."
            desc="The AI speaks, listens, and interrupts. Sub-400ms latency on Indian 4G."
            visual={<LatencyVisual />}
          />
          <FeatureCard
            icon="◇"
            title="STAR-scored, not vibes."
            desc="Every answer broken into Situation · Task · Action · Result, with a coached model answer beside it."
            span2
            visual={<ScoredReportVisual />}
          />
          <FeatureCard
            icon="❋"
            title="Built for Indian rounds."
            desc="TCS Digital, Infosys Mysore, Razorpay tech screens. Formats we're mapping panel by panel."
            visual={<RoundsVisual />}
          />
          <FeatureCard
            icon="↻"
            title="Skill-decay tracking."
            desc="We'll remember what you got wrong last Tuesday. Spaced repetition will resurface it."
            visual={<DecayVisual />}
          />
          <FeatureCard
            icon="₹"
            title="UPI-first. ₹ pricing."
            desc="Pay with UPI, cards, or netbanking. ₹ pricing throughout. No dollar surprises."
            visual={<PayVisual />}
          />
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── 6. BUILT FOR INDIA BAND ─────────────────────────── */
export function BuiltForIndiaV2() {
  const companies = [
    "TCS",
    "Infosys",
    "Wipro",
    "Razorpay",
    "Zomato",
    "Swiggy",
    "Flipkart",
    "Cred",
    "Deloitte",
    "ISRO",
    "RBI",
    "Paytm",
  ];
  return (
    <section
      aria-labelledby="hd-india"
      className="mv2-on-dark mv2-cv-auto"
      style={{
        ...sectionBase,
        background: t.indigoDeep,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 20% 50%, rgba(180, 83, 9, 0.18) 0%, transparent 60%)",
          pointerEvents: "none",
          contain: "paint",
        }}
      />
      <div
        className="mv2-india-grid"
        style={{
          ...container,
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr",
          gap: 64,
          alignItems: "center",
        }}
      >
        <div>
          <span
            style={{
              fontFamily: fonts.mono,
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: t.copper100,
              display: "inline-block",
              marginBottom: 16,
            }}
          >
            India-first
          </span>
          <h2 id="hd-india" style={{ ...h2, color: t.cream }}>
            We know{" "}
            <span style={{ fontStyle: "italic", color: t.copper100 }}>your</span>{" "}
            interview.
          </h2>
          <p
            style={{
              ...body,
              color: t.creamMuted,
              marginTop: 16,
              maxWidth: 460,
            }}
          >
            Real round formats. Real salary bands in ₹. Designed for the loops
            Indian candidates actually sit: campus, off-campus, and lateral.
          </p>

          {/* Anchor data — gives the section one number to grip */}
          <div
            style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: `1px solid ${t.creamLine}`,
              display: "flex",
              alignItems: "baseline",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontFamily: fonts.serif,
                fontSize: 56,
                lineHeight: 1,
                color: t.copper100,
                letterSpacing: "-0.03em",
                fontWeight: 400,
              }}
            >
              200+
            </span>
            <span
              style={{
                fontFamily: fonts.sans,
                fontSize: 14,
                color: t.creamFaded,
                maxWidth: 220,
                lineHeight: 1.4,
              }}
            >
              Indian roles in the question bank. IT services, unicorns, PSUs, MNCs.
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 28,
              flexWrap: "wrap",
            }}
          >
            {[
              ["UPI", "Pay in ₹"],
              ["₹", "India-first pricing"],
              ["IN", "Made in India"],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  background: t.creamLowAlpha,
                  border: `1px solid ${t.creamLine}`,
                  borderRadius: 999,
                }}
              >
                <span
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 15,
                    color: t.copper100,
                  }}
                >
                  {k}
                </span>
                <span
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 12,
                    color: t.cream,
                    fontWeight: 500,
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>

        </div>

        <div
          className="mv2-india-logos"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "flex-end",
          }}
        >
          {companies.map((co, i) => (
            <span
              key={co}
              style={{
                fontFamily: fonts.serif,
                fontSize: 18,
                color: i % 3 === 0 ? t.cream : t.creamFaded,
                padding: "10px 18px",
                background: t.creamVeryFaint,
                border: `1px solid ${t.creamLineSoft}`,
                borderRadius: 999,
                letterSpacing: "-0.01em",
              }}
            >
              {co}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── 6b. TESTIMONIALS (objections we hear) ─────────────────────────── */
export function TestimonialsV2() {
  const items = [
    {
      n: "01",
      problem: "“My seniors are too busy to mock me.”",
      promise:
        "An interviewer that picks up at 11pm the night before your Razorpay loop. No favours owed.",
    },
    {
      n: "02",
      problem: "“ChatGPT just agrees with whatever I say.”",
      promise:
        "STAR rubric that calls out a missing Result, names the weakest beat, and rewrites the answer in your own voice.",
    },
    {
      n: "03",
      problem: "“I forget half of what I prep in a week.”",
      promise:
        "Skill-decay tracking surfaces your weakest answer the day before the round it shows up in again.",
    },
  ];
  return (
    <section className="mv2-section" aria-labelledby="hd-why" style={{ ...sectionBase, background: t.cream, borderTop: `1px solid ${t.line}` }}>
      <div className="mv2-container" style={container}>
        <SectionMasthead n="06" label="Why" right="Three objections" style={{ marginBottom: 24 }} />
        <MotionReveal style={{ textAlign: "center", marginBottom: 64, maxWidth: 760, marginLeft: "auto", marginRight: "auto" }}>
          <h2 id="hd-why" style={{ ...h2, textWrap: "balance" as const }}>
            The interview help{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>nobody made for you.</span>
          </h2>
          <p style={{ ...body, marginTop: 16 }}>
            Built by candidates who sat through enough Indian loops to know what serious prep actually looks like.
          </p>
        </MotionReveal>

        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            maxWidth: 1040,
            marginLeft: "auto",
            marginRight: "auto",
            borderTop: `1px solid ${t.line}`,
          }}
        >
          {items.map((it) => (
            <li
              key={it.n}
              className="mv2-why-row"
              style={{
                display: "grid",
                gridTemplateColumns: "72px 1fr 1fr",
                gap: 40,
                alignItems: "baseline",
                padding: "40px 0",
                borderBottom: `1px solid ${t.line}`,
              }}
            >
              <span
                aria-hidden
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 22,
                  fontStyle: "italic",
                  color: t.copper,
                  letterSpacing: "-0.01em",
                }}
              >
                {it.n}
              </span>

              <p
                style={{
                  margin: 0,
                  fontFamily: fonts.serif,
                  fontSize: "clamp(22px, 2.1vw, 28px)",
                  lineHeight: 1.25,
                  color: t.coal,
                  letterSpacing: "-0.015em",
                  fontStyle: "italic",
                  textWrap: "balance" as const,
                }}
              >
                {it.problem}
              </p>

              <p
                style={{
                  margin: 0,
                  fontFamily: fonts.sans,
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: t.inkSoft,
                  maxWidth: 44 + "ch",
                }}
              >
                {it.promise}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─────────────────────────── 6c. PRICING ─────────────────────────── */
export function PricingV2() {
  /* Funnel-top engagement signal. When the pricing section scrolls into
     view we capture pricing_section_viewed once per session — feeds the
     PostHog landing-page funnel (hero → pricing → CTA click → signup). */
  const sectionRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let fired = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired) {
            fired = true;
            captureClientEvent("pricing_section_viewed", { surface: "homepage" });
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const tiers = [
    {
      name: "Free",
      price: "₹0",
      unit: "forever",
      sub: "Try before you pay a rupee",
      features: [
        "3 mock sessions",
        "Behavioural rounds + basic STAR score",
        "Email report",
        "No card required",
      ],
      cta: "Start free",
      href: "/signup?plan=free",
      featured: false,
      studentDiscount: false,
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
      studentDiscount: false,
    },
    {
      name: "Weekly",
      price: "₹49",
      unit: "/ 7 days",
      sub: "Sprint before placement week",
      features: [
        "10 sessions · 7 days",
        "Voice in & out, all round types",
        "Company-specific rounds",
        "Skill-decay tracking",
      ],
      cta: "Go weekly",
      href: "/signup?plan=weekly",
      featured: false,
      studentDiscount: true,
    },
    {
      name: "Monthly",
      price: "₹149",
      unit: "/ 30 days",
      sub: "Most loved during placement season",
      features: [
        "40 sessions · 30 days",
        "Everything in Weekly",
        "Interview calendar + countdown",
        "Performance analytics & trends",
        "Export PDF, CSV, JSON",
        "Priority coach feedback",
      ],
      cta: "Go monthly",
      href: "/signup?plan=monthly",
      featured: true,
      studentDiscount: true,
    },
  ];
  return (
    <section ref={sectionRef} className="mv2-section" aria-labelledby="hd-pricing" style={{ ...sectionBase, background: t.creamSoft, borderTop: `1px solid ${t.line}` }}>
      <div className="mv2-container" style={container}>
        <MotionReveal style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionMasthead n="07" label="Pricing" right="From ₹9 / session" style={{ marginBottom: 16 }} />
          <h2 id="hd-pricing" style={h2}>
            Costs less than{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>one chai a day.</span>
          </h2>
          <p style={{ ...body, marginTop: 16, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>
            Free to start. Buy one session, a week, or a month, whichever matches your prep. UPI / cards / netbanking accepted at checkout.
          </p>
        </MotionReveal>
        <MotionReveal
          className="mv2-pricing-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="mv2-price-card"
              style={{
                position: "relative",
                padding: 32,
                background: tier.featured ? t.coal : t.white,
                color: tier.featured ? t.cream : t.coal,
                border: `1px solid ${tier.featured ? t.coal : t.line}`,
                borderRadius: 20,
                /* Lift the "Most loved" card: tiny translateY + stronger
                   shadow so it visually leads without breaking the grid.
                   Subtle on purpose — a real scale bump fights the
                   editorial restraint. */
                boxShadow: tier.featured ? shadows.featured : shadows.card,
                transform: tier.featured ? "translateY(-8px)" : "none",
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
                  Most loved
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
                    fontSize: 42,
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
                {/* Per-card .ac.in / .edu.in discount surfacing — paid tiers only.
                    Footer chip stays as the umbrella affordance; this puts the
                    discount where the price decision actually happens. */}
                {tier.studentDiscount && (
                  <p
                    style={{
                      margin: "10px 0 0",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: fonts.sans,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "4px 8px",
                      borderRadius: 999,
                      color: tier.featured ? t.copper100 : t.copper,
                      background: tier.featured
                        ? t.copper100Soft
                        : t.copper100,
                      border: tier.featured
                        ? `1px solid ${t.copper100SoftLine}`
                        : `1px solid ${t.lineStrong}`,
                    }}
                  >
                    .ac.in / .edu.in · 30% off
                  </p>
                )}
              </div>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
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
                style={{
                  marginTop: "auto",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  fontFamily: fonts.sans,
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "12px 18px",
                  borderRadius: 999,
                  textDecoration: "none",
                  color: tier.featured ? t.coal : t.white,
                  background: tier.featured ? t.cream : t.indigo,
                  boxShadow: tier.featured ? "none" : shadows.cta,
                }}
              >
                {tier.cta} <span style={{ fontSize: 16 }}>→</span>
              </a>
            </div>
          ))}
        </MotionReveal>

        {/* No-renew anchor */}
        <div
          style={{
            marginTop: 32,
            display: "flex",
            justifyContent: "center",
            gap: 24,
            flexWrap: "wrap",
            fontFamily: fonts.sans,
            fontSize: 13,
            color: t.inkSoft,
          }}
        >
          {[
            ["✓", "Cancel anytime · no lock-in"],
            ["✓", "7-day refund on Monthly · 24h on Weekly"],
            ["✓", "GST-ready receipt on every order"],
            ["✓", "30% off for .ac.in / .edu.in"],
          ].map(([k, v]) => (
            <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: t.success100,
                  color: t.success,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {k}
              </span>
              {v}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── 6d. TRUST ROW ─────────────────────────── */
export function TrustRowV2() {
  const items = [
    { k: "DPDP", v: "Designed for Act 2023" },
    { k: "Encrypted", v: "In transit + at rest" },
    { k: "Mumbai", v: "Data will stay in India" },
    { k: "Privacy-first", v: "Audit before public launch" },
    { k: "Razorpay", v: "PA-PG payments at launch" },
  ];
  return (
    <section
      aria-label="Trust and security signals"
      style={{
        background: t.cream,
        borderTop: `1px solid ${t.line}`,
        borderBottom: `1px solid ${t.line}`,
        paddingTop: 32,
        paddingBottom: 32,
      }}
    >
      <div
        className="mv2-container mv2-trust-row"
        style={{
          ...container,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        {items.map((it) => (
          <div
            key={it.k}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              fontFamily: fonts.sans,
            }}
          >
            <span
              style={{
                fontFamily: fonts.serif,
                fontSize: 18,
                color: t.indigo,
                letterSpacing: "-0.01em",
              }}
            >
              {it.k}
            </span>
            <span style={{ fontSize: 12, color: t.inkSoft }}>{it.v}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── 6e. COMPARISON ─────────────────────────── */
export function ComparisonV2() {
  const rows: Array<[string, string, string, string]> = [
    ["Real voice in & out", "Sub-400ms target", "Text only", "Text only"],
    ["Indian rounds & companies", "4 tracks · 8 loops at launch", "Generic", "Generic"],
    ["Scoring rubric", "STAR · 4 dimensions", "Vibes", "Single score"],
    ["Indian English accents", "Trained on regional accents", "US/UK voices", "Text only"],
    ["Spaced repetition", "Tracks every weak spot", "Not built for it", "Static lists"],
    ["Pricing", "From ₹9 / session", "$20 / month", "₹1,500 / month"],
  ];
  return (
    <section className="mv2-section" aria-labelledby="hd-compare" style={{ ...sectionBase, background: t.cream, borderTop: `1px solid ${t.line}` }}>
      <div className="mv2-container" style={container}>
        <SectionMasthead n="08" label="VS" right="Honest take" style={{ marginBottom: 24 }} />
        <MotionReveal style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 id="hd-compare" style={h2}>
            Why not just{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>
              ChatGPT it?
            </span>
          </h2>
          <p style={{ ...body, marginTop: 16, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
            ChatGPT can roleplay an interviewer. It can't listen, score your delivery, or know what TCS Digital actually asks. Here's the breakdown.
          </p>
        </MotionReveal>
        <div
          style={{
            background: t.white,
            border: `1px solid ${t.line}`,
            borderRadius: 18,
            boxShadow: shadows.card,
            overflow: "hidden",
          }}
        >
          <table
            className="mv2-comparison-table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: fonts.sans,
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: t.creamSoft }}>
                <th
                  scope="col"
                  style={{
                    textAlign: "left",
                    padding: "18px 24px",
                    fontWeight: 600,
                    fontSize: 12,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: t.inkSoft,
                    borderBottom: `1px solid ${t.line}`,
                  }}
                >
                  <span className="sr-only">Capability</span>
                </th>
                {[
                  { label: "HireStepX", accent: true },
                  { label: "ChatGPT mocks", accent: false },
                  { label: "Question banks", accent: false },
                ].map((h) => (
                  <th
                    key={h.label}
                    scope="col"
                    style={{
                      textAlign: "left",
                      padding: "18px 24px",
                      fontFamily: fonts.serif,
                      fontSize: 17,
                      fontWeight: 400,
                      color: h.accent ? t.indigo : t.inkSoft,
                      letterSpacing: "-0.01em",
                      borderBottom: `1px solid ${t.line}`,
                      borderLeft: `1px solid ${t.line}`,
                    }}
                  >
                    {h.label}
                    {h.accent && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          padding: "2px 6px",
                          borderRadius: 999,
                          background: t.copperSoft,
                          color: t.copper,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          fontFamily: fonts.sans,
                          fontWeight: 600,
                          verticalAlign: "middle",
                        }}
                      >
                        You
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, us, cgpt, bank], i) => (
                <tr key={label} style={{ borderTop: i === 0 ? "none" : `1px solid ${t.line}` }}>
                  <th
                    scope="row"
                    style={{
                      padding: "16px 24px",
                      color: t.coal,
                      fontWeight: 500,
                      textAlign: "left",
                      fontFamily: fonts.sans,
                      fontSize: 14,
                    }}
                  >
                    {label}
                  </th>
                  <td
                    style={{
                      padding: "16px 24px",
                      color: t.coal,
                      borderLeft: `1px solid ${t.line}`,
                      background: t.indigoFog,
                      fontWeight: 500,
                    }}
                  >
                    {us}
                  </td>
                  <td
                    style={{
                      padding: "16px 24px",
                      color: t.inkSoft,
                      borderLeft: `1px solid ${t.line}`,
                    }}
                  >
                    {cgpt}
                  </td>
                  <td
                    style={{
                      padding: "16px 24px",
                      color: t.inkSoft,
                      borderLeft: `1px solid ${t.line}`,
                    }}
                  >
                    {bank}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── 6f. FAQ ─────────────────────────── */
export function FAQV2() {
  const qs: Array<{ cat: string; q: string; a: string }> = [
    {
      cat: "Pricing",
      q: "Is the free tier actually free?",
      a: "Yes. 3 full mock sessions, full scoring, full report. No card, no auto-charge after.",
    },
    {
      cat: "Pricing",
      q: "Do plans auto-renew?",
      a: "No. Weekly and Monthly are one-time top-ups. They expire on day 7 or 30. You buy again when you want more. No surprise charges.",
    },
    {
      cat: "Pricing",
      q: "What if I just want to try it?",
      a: "Sign up free and get 3 full mock sessions — no card needed. If you have an interview tomorrow, that's enough to practice once and review the report.",
    },
    {
      cat: "Pricing",
      q: "Do you have a student discount?",
      a: "Verified .ac.in / .edu.in email = 30% off Weekly and Monthly. Apply once, lasts your degree.",
    },
    {
      cat: "Pricing",
      q: "Do I get a receipt for each order?",
      a: "Yes. Auto-emailed and downloadable from your dashboard. Tax invoicing rolls out post-launch once we've registered for GST.",
    },
    {
      cat: "Product",
      q: "Why not just use ChatGPT?",
      a: "ChatGPT can roleplay an interviewer, but it can't listen to your voice, can't score delivery, and doesn't know what TCS Digital or Razorpay's tech round actually asks. HireStepX is voice in / voice out, scored against real Indian hiring rubrics, with company-specific question banks. ChatGPT also agrees with whatever you say; we tell you where you fell short.",
    },
    {
      cat: "Product",
      q: "Which companies and roles do you cover?",
      a: "200+ Indian roles in the question bank — IT services, unicorns, PSUs, MNCs — across behavioural, campus placement, salary negotiation and HR rounds at launch. New focus types ship month by month after public beta.",
    },
    {
      cat: "Product",
      q: "How accurate is the AI score?",
      a: "Rubrics are built from publicly aggregated interview reports (Glassdoor, Levels.fyi, AmbitionBox), cross-checked against two independent sources per question. Every score shows the rubric (STAR breakdown, what worked, what didn't), not just a number. Disagree? Hit Dispute.",
    },
    {
      cat: "Product",
      q: "What if the AI scores me unfairly?",
      a: "Every session has a 'Dispute score' link. Our coach team reviews within 24h and refunds the session credit if we agree.",
    },
    {
      cat: "Product",
      q: "Which languages do you support?",
      a: "English at launch, with voice models tuned for Indian, American and British accents. Hindi and other Indian languages are on the post-launch roadmap.",
    },
    {
      cat: "Privacy",
      q: "Where does my voice data go?",
      a: "Encrypted in transit (TLS 1.3) and at rest. Auto-deleted after 90 days unless you save the session. Designed against DPDP Act 2023 from day one.",
    },
    {
      cat: "Support",
      q: "Can I use it on my phone?",
      a: "Works on any modern Chrome / Safari: phone, tablet, laptop. Optimised for Realme/Redmi-class Android on Indian 4G.",
    },
  ];
  const cats = ["Pricing", "Product", "Privacy", "Support"];
  const [activeCat, setActiveCat] = useState("Pricing");
  const visible = qs.filter((q) => q.cat === activeCat);
  return (
    <section
      id="faq"
      className="mv2-section"
      aria-labelledby="hd-faq"
      style={{ ...sectionBase, background: t.creamSoft, borderTop: `1px solid ${t.line}` }}
    >
      <div className="mv2-container" style={container}>
        <MotionReveal style={{ textAlign: "center", marginBottom: 40 }}>
          <SectionMasthead n="09" label="FAQ" right="Asked & answered" style={{ marginBottom: 16 }} />
          <h2 id="hd-faq" style={h2}>
            Things you'd ask{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>before paying.</span>
          </h2>
        </MotionReveal>

        <div
          role="tablist"
          aria-label="FAQ categories"
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 32,
          }}
        >
          {cats.map((c) => {
            const active = c === activeCat;
            const count = qs.filter((q) => q.cat === c).length;
            return (
              <button
                key={c}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveCat(c)}
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: active ? t.white : t.coal,
                  background: active ? t.coal : t.white,
                  border: `1px solid ${active ? t.coal : t.line}`,
                  padding: "8px 16px",
                  borderRadius: 999,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  boxShadow: active ? shadows.card : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {c}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: active ? t.copper100 : t.inkFaint,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
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
          {visible.map(({ q, a }, i) => (
            <details
              key={q}
              className="mv2p-faq"
              open={i === 0}
              style={{
                borderTop: i === 0 ? "none" : `1px solid ${t.line}`,
                padding: "20px 24px",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontFamily: fonts.serif,
                  fontSize: 19,
                  color: t.coal,
                  letterSpacing: "-0.01em",
                  listStyle: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 16,
                  fontWeight: 400,
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
          ))}
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: 32,
            fontFamily: fonts.sans,
            fontSize: 14,
            color: t.inkFaint,
          }}
        >
          Still curious?{" "}
          <a
            href="mailto:hello@hirestepx.com"
            style={{ color: t.indigo, fontWeight: 600, textDecoration: "none" }}
          >
            Ask us directly →
          </a>
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────── 6g. CHANGELOG TEASE ─────────────────────────── */
export function ChangelogTeaseV2() {
  const entries = [
    { date: "Jun", label: "Public beta: first 500 testers" },
    { date: "Jul", label: "Strategic + Technical Leadership tracks" },
    { date: "Aug", label: "Razorpay + Zomato PM loops" },
  ];
  return (
    <section
      aria-label="Product roadmap"
      style={{
        background: t.cream,
        borderTop: `1px solid ${t.line}`,
        borderBottom: `1px solid ${t.line}`,
        paddingTop: 32,
        paddingBottom: 32,
      }}
    >
      <div
        className="mv2-container"
        style={{
          ...container,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              fontFamily: fonts.sans,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: t.copper,
              padding: "4px 10px",
              background: t.copperSoft,
              borderRadius: 999,
            }}
          >
            Roadmap
          </span>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {entries.map((e) => (
              <span
                key={e.date}
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 13,
                  color: t.coal,
                }}
              >
                <span style={{ color: t.inkFaint, marginRight: 8 }}>{e.date}</span>
                {e.label}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          style={{
            fontFamily: fonts.sans,
            fontSize: 13,
            fontWeight: 600,
            color: t.indigo,
            textDecoration: "none",
            whiteSpace: "nowrap",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          Full roadmap →
        </button>
      </div>
    </section>
  );
}

/* ─────────────────────────── 7. FINAL CTA + FOOTER ─────────────────────────── */
export function FinalCTAFooterV2() {
  const footerCols: Array<{ title: string; links: Array<[string, string]> }> = [
    /* Footer columns are intentionally narrow: every link below points
     * to a route that exists in app/(marketing). When adding a new
     * column entry, confirm the page ships before merging — dead links
     * tank the trust signal on the most-scrolled section of the site. */
    {
      title: "Product",
      links: [
        ["How it works", "/how-it-works"],
        ["Pricing", "/pricing"],
      ],
    },
    {
      title: "For you",
      links: [
        ["Students & freshers", "/for-students"],
      ],
    },
    {
      title: "Resources",
      links: [
        ["Blog", "/blog"],
        ["Contact", "/contact"],
      ],
    },
    {
      title: "Company",
      links: [
        ["About", "/about"],
        ["Privacy", "/privacy"],
        ["Terms", "/terms"],
        ["Refund policy", "/refund"],
      ],
    },
  ];
  return (
    <footer aria-labelledby="hd-cta" style={{ background: t.cream, position: "relative" }}>
      {/* Self-contained responsive collapse: this footer is rendered both by
          HomepageV2 (whose ResponsiveSheet has the .mv2-footer-grid rule) AND
          standalone on sub-pages via MarketingPagesV2 (whose sheet does NOT).
          Without this, the 5-column grid never collapses on sub-pages and
          overflows the viewport at mobile widths. Mirror the nav fix in NavV2. */}
      <style>{`
        @media (max-width: 880px) {
          .mv2-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
        }
      `}</style>
      {/* Final CTA */}
      <div
        style={{
          paddingTop: 140,
          paddingBottom: 140,
          textAlign: "center",
          position: "relative",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(49, 46, 129, 0.08) 0%, transparent 60%)",
            contain: "paint",
            pointerEvents: "none",
          }}
        />
        <div style={{ ...container, position: "relative" }}>
          <h2
            id="hd-cta"
            style={{
              fontFamily: fonts.serif,
              fontSize: "clamp(48px, 7vw, 88px)",
              color: t.coal,
              margin: 0,
              lineHeight: 1.0,
              letterSpacing: "-0.035em",
              fontWeight: 400,
            }}
          >
            Your next interview is
            <br />
            <span style={{ fontStyle: "italic", color: t.copper }}>
              three sessions away.
            </span>
          </h2>
          <p
            style={{
              ...body,
              fontSize: 17,
              marginTop: 28,
              maxWidth: 520,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Free to start. No card, no commitment. Open your mic and run your
            first session in under two minutes.
          </p>
          <a
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              marginTop: 36,
              fontFamily: fonts.sans,
              fontSize: 16,
              fontWeight: 600,
              color: t.white,
              background: t.indigo,
              padding: "16px 28px",
              borderRadius: 999,
              textDecoration: "none",
              boxShadow: shadows.cta,
            }}
          >
            Start free — 3 sessions
            <span aria-hidden style={{ fontSize: 20 }}>→</span>
          </a>
        </div>
      </div>

      {/* Compact footer */}
      <div
        style={{
          borderTop: `1px solid ${t.line}`,
          paddingTop: 56,
          paddingBottom: 28,
          background: t.creamSoft,
        }}
      >
        <div
          className="mv2-footer-grid"
          style={{
            ...container,
            display: "grid",
            gridTemplateColumns: "1.5fr repeat(4, 1fr)",
            gap: 36,
          }}
        >
          <div>
            <img src="/wordmark.png" alt="HireStepX" style={{ height: 26, width: "auto", display: "block", marginBottom: 0 }} />
            <p
              style={{
                fontFamily: fonts.sans,
                fontSize: 13,
                color: t.inkSoft,
                marginTop: 12,
                maxWidth: 240,
                lineHeight: 1.55,
              }}
            >
              The AI mock interviewer for India. Built in Bengaluru.
            </p>
          </div>
          {footerCols.map((col) => (
            <div key={col.title}>
              <p
                style={{
                  fontFamily: fonts.sans,
                  fontSize: 11,
                  fontWeight: 600,
                  color: t.inkFaint,
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  margin: 0,
                  marginBottom: 16,
                }}
              >
                {col.title}
              </p>
              {col.links.map(([label, href]) => (
                <a
                  key={label}
                  href={href}
                  style={{
                    display: "block",
                    fontFamily: fonts.sans,
                    fontSize: 14,
                    color: t.inkSoft,
                    textDecoration: "none",
                    marginBottom: 10,
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div
          style={{
            ...container,
            marginTop: 36,
            paddingTop: 20,
            borderTop: `1px solid ${t.line}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            fontFamily: fonts.sans,
            fontSize: 12,
            color: t.inkFaint,
          }}
        >
          <span>© 2026 HireStepX Labs Pvt Ltd</span>
          <span style={{ display: "flex", gap: 20 }}>
            {[
              ["Privacy", "/privacy"],
              ["Terms", "/terms"],
              ["Refund", "/refund"],
              ["Status", "https://status.hirestepx.com"],
            ].map(([label, href]) => (
              <a key={label} href={href} style={{ color: t.inkFaint, textDecoration: "none" }}>
                {label}
              </a>
            ))}
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────── STRUCTURED DATA (JSON-LD) ─────────────────────────── */
function StructuredData() {
  const faqs = [
    ["Is the free tier actually free?", "Yes. 3 full mock sessions, full scoring, full report. No card, no auto-charge after."],
    ["Do plans auto-renew?", "No. Weekly and Monthly are one-time top-ups. They expire on day 7 or 30. You buy again when you want more."],
    ["What if I just want to try it?", "Sign up free — 3 full sessions, no card needed."],
    ["Do you have a student discount?", "Verified .ac.in / .edu.in email = 30% off Weekly and Monthly."],
    ["Which companies and roles do you cover?", "200+ Indian roles in our question bank (IT services, unicorns, PSUs, MNCs) across behavioural, campus placement, salary negotiation and HR rounds at launch."],
    ["How accurate is the AI score?", "Rubrics built from publicly aggregated interview reports, cross-checked against two sources per question. Every score shows the rubric (STAR breakdown), not just a number."],
    ["Where does my voice data go?", "Encrypted in transit and at rest. Auto-deleted after 90 days. Designed against DPDP Act 2023 from day one."],
    ["Which languages do you support?", "English at launch. Hindi and other Indian languages are on the post-launch roadmap."],
  ];
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "HireStepX",
    url: "https://hirestepx.com",
    logo: "https://hirestepx.com/logo.png",
    sameAs: ["https://twitter.com/hirestepx"],
    address: {
      "@type": "PostalAddress",
      addressLocality: "Bengaluru",
      addressCountry: "IN",
    },
  };
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "HireStepX · AI Mock Interviewer",
    description: "Voice-first AI mock interviews scored on STAR, built for Indian job seekers.",
    brand: { "@type": "Brand", name: "HireStepX" },
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "INR",
      lowPrice: "0",
      highPrice: "149",
      offerCount: "4",
    },
  };
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(product) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }} />
    </>
  );
}

/* ─────────────────────────── PERSONALIZED REPORTS ─────────────────────────── */

const rpt_STYLES = `
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap');

/* Fan card showcase — responsive containment */
@media (max-width: 640px) {
  /* Hide side cards on mobile; only the center report card stays */
  .mv2-rpt-side { display: none !important; }
  /* Make the center card fluid so it fits within the mobile viewport */
  .mv2-rpt-center-card { width: min(520px, calc(100vw - 48px)) !important; }
  /* Shrink top padding and headline for mobile */
  .mv2-rpt-section { padding-top: 60px !important; padding-bottom: 48px !important; }
  .mv2-rpt-h2 { font-size: 40px !important; letter-spacing: -1px !important; }
  .mv2-rpt-showcase { height: 440px !important; }
}
`;

/* Module-level constants — avoid recomputing these on every render */
const RV = "transform 0.72s cubic-bezier(0.16,1,0.3,1), opacity 0.55s ease";
const TR = "transform 0.50s cubic-bezier(0.16,1,0.3,1), opacity 0.38s ease, filter 0.50s ease";

/* ─── Card: Behavioral — left ── (exact canvas copy) */
function RPT_InterviewCard({ lifted, revealed, baseDelay = 0 }: { lifted?: boolean; revealed?: boolean; baseDelay?: number }) {
  const star = [
    { key: "S", label: "Situation",  score: 88, c: "#15803D" },
    { key: "T", label: "Task",       score: 88, c: "#15803D" },
    { key: "A", label: "Action",     score: 71, c: "#B45309" },
    { key: "R", label: "Result",     score: 42, c: "#B91C1C" },
  ];
  const rptF = { sans: "Inter, system-ui, -apple-system, sans-serif", serif: "'Instrument Serif', Georgia, serif", mono: "'JetBrains Mono', 'Fira Code', monospace" };
  /* Arc length for 82% of a semicircle: π × r × 0.82 = π × 33 × 0.82 ≈ 85 */
  const arcLen = 85;
  return (
    <div style={{ width: 460, minHeight: 620, background: "#FEFDF8", borderRadius: 16, border: "1px solid rgba(180,83,9,0.08)", boxShadow: lifted ? "0 32px 96px rgba(14,12,8,0.28), 0 8px 24px rgba(14,12,8,0.12)" : "0 8px 48px rgba(14,12,8,0.12), 0 2px 8px rgba(14,12,8,0.06)", overflow: "hidden", fontFamily: rptF.sans, transition: "box-shadow 0.50s ease" }}>
      <div style={{ background: "#FAF7F0", padding: "9px 16px", borderBottom: "1px solid #EAE3D0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6, color: "#6E6759" }}>READINESS</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#15803D" }}>68%</span>
        <span style={{ fontSize: 8, color: "#6E6759" }}>Razorpay Senior PD · ~3 sessions to close gap</span>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "14px 16px 12px" }}>
        <div style={{ width: 124, flexShrink: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: "#6E6759", marginBottom: 6 }}>OVERALL SCORE</div>
          <div style={{ position: "relative", width: 84, height: 52, margin: "0 auto 8px" }}>
            <svg viewBox="0 0 80 50" width="84" height="52">
              <path d="M7,46 A33,33 0 0,1 73,46" fill="none" stroke="#E8E0D0" strokeWidth="7" strokeLinecap="round" />
              <path d="M7,46 A33,33 0 0,1 68,28" fill="none" stroke="#15803D" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={arcLen} strokeDashoffset={revealed ? 0 : arcLen}
                style={{ transition: `stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1) ${baseDelay + 200}ms` }} />
            </svg>
            <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontSize: 22, fontWeight: 800, color: "#0E0C08", lineHeight: 1 }}>82</div>
            <div style={{ position: "absolute", bottom: -4, left: 0, right: 0, textAlign: "center", fontSize: 7.5, color: "#9E9589" }}>/ 100</div>
          </div>
          <span style={{ fontSize: 7.5, background: "#DCFCE7", color: "#15803D", padding: "2px 7px", borderRadius: 3, fontWeight: 600 }}>Hire ✓</span>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="28" height="12" viewBox="0 0 28 12"><polyline points="0,10 5,7 10,9 16,4 22,6 28,2" fill="none" stroke="#15803D" strokeWidth="1.2" /></svg>
            <span style={{ fontSize: 9, color: "#15803D", fontWeight: 700 }}>↑ 6</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.4, color: "#B45309", marginBottom: 5 }}>✦ AI INTERVIEW VERDICT</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#0E0C08", lineHeight: 1.5, marginBottom: 9 }}>Specific, owned, outcome-anchored. Tighten the Q2 "we" usage — then you're ready for the bar-raiser.</div>
          <div style={{ fontSize: 7.5, background: "#F3EFE5", padding: "4px 8px", borderRadius: 3, color: "#6E6759" }}>
            Calibrated to Senior · Strong ≥ 85 · Hire ≥ 70 · Lean ≥ 55
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #EAE3D0", padding: "10px 16px 6px", background: "#FEFDF8" }}>
        <span style={{ fontSize: 8, background: "#E5E2F2", color: "#312E81", padding: "3px 9px", borderRadius: 20, fontWeight: 600 }}>BEHAVIORAL INTERVIEW · FULL REPORT</span>
      </div>
      <div style={{ padding: "8px 16px 10px" }}>
        {star.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: s.c, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: rptF.mono }}>{s.key}</span>
            <span style={{ fontSize: 8.5, color: "#4A4540", width: 52, flexShrink: 0 }}>{s.label}</span>
            <div style={{ flex: 1, height: 4, background: "#EBE5D2", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: revealed ? `${s.score}%` : "0%", background: s.c, borderRadius: 2, transition: `width 0.7s cubic-bezier(0.16,1,0.3,1) ${baseDelay + 400 + i * 80}ms` }} />
            </div>
            <span style={{ fontSize: 8.5, fontWeight: 700, color: s.c, fontFamily: rptF.mono, width: 20, textAlign: "right", flexShrink: 0 }}>{s.score}</span>
          </div>
        ))}
      </div>
      <div style={{ margin: "0 16px", background: "#312E81", borderRadius: 6, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 8, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 7px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>PART 2 OF 4</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>AI coached model answer</div>
          <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.65)" }}>See exactly how a Strong Hire would answer Q2.</div>
        </div>
      </div>
      <div style={{ padding: "10px 16px 14px" }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: "#B45309", letterSpacing: 0.4, marginBottom: 6 }}>✦ MODEL ANSWER EXCERPT</div>
        <div style={{ fontSize: 9, color: "#4A4540", lineHeight: 1.6, background: "#F3EFE5", borderRadius: 5, padding: "8px 10px", borderLeft: "2px solid #B45309" }}>
          {"Instead of 'we reduced latency,' say: "}
          <span style={{ fontStyle: "italic", color: "#0E0C08" }}>{"I led the caching rewrite — my call to switch to Redis cut p99 from 420ms to 38ms, unblocking the iOS team."}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Card: Salary neg — center ── (exact canvas copy) */
function RPT_ReportCard({ lifted, revealed, baseDelay = 0 }: { lifted?: boolean; revealed?: boolean; baseDelay?: number }) {
  const phases = [
    { n: 1, label: "Named a counter number" },
    { n: 2, label: "Justified with market data" },
    { n: 3, label: "Closed at ₹48L target" },
  ];
  const rptF = { sans: "Inter, system-ui, -apple-system, sans-serif", serif: "'Instrument Serif', Georgia, serif" };
  /* Arc length for 84% of a semicircle: π × r × 0.84 = π × 37 × 0.84 ≈ 98 */
  const arcLen = 98;
  return (
    <div className="mv2-rpt-center-card" style={{ width: 520, background: "#FEFDF8", borderRadius: 18, border: "1.5px solid rgba(180,83,9,0.08)", boxShadow: lifted ? "0 56px 160px rgba(14,12,8,0.34), 0 16px 48px rgba(14,12,8,0.16)" : "0 48px 140px rgba(14,12,8,0.26), 0 12px 40px rgba(14,12,8,0.12)", overflow: "hidden", fontFamily: rptF.sans, transition: "box-shadow 0.50s ease" }}>
      <div style={{ background: "#FAF7F0", padding: "10px 18px", borderBottom: "1px solid #EAE3D0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: "#6E6759" }}>READINESS</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#15803D" }}>84%</span>
        <span style={{ fontSize: 8.5, color: "#6E6759" }}>PhonePe Senior EM · Top quartile, ready to negotiate.</span>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "16px 18px 14px" }}>
        <div style={{ width: 144, flexShrink: 0 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, color: "#6E6759", marginBottom: 7 }}>OVERALL SCORE</div>
          <div style={{ position: "relative", width: 92, height: 56, margin: "0 auto 9px" }}>
            <svg viewBox="0 0 90 56" width="92" height="56">
              <path d="M8,52 A37,37 0 0,1 82,52" fill="none" stroke="#E8E0D0" strokeWidth="8" strokeLinecap="round" />
              <path d="M8,52 A37,37 0 0,1 77,34" fill="none" stroke="#15803D" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={arcLen} strokeDashoffset={revealed ? 0 : arcLen}
                style={{ transition: `stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1) ${baseDelay + 200}ms` }} />
            </svg>
            <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontSize: 25, fontWeight: 800, color: "#0E0C08", lineHeight: 1 }}>84</div>
            <div style={{ position: "absolute", bottom: -5, left: 0, right: 0, textAlign: "center", fontSize: 8, color: "#9E9589" }}>/ 100</div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, background: "#DCFCE7", color: "#15803D", padding: "3px 7px", borderRadius: 3, fontWeight: 600 }}>Strong Hire ✓</span>
          </div>
          <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="30" height="13" viewBox="0 0 30 13"><polyline points="0,11 5,8 10,10 16,4 22,6 30,2" fill="none" stroke="#15803D" strokeWidth="1.3" /></svg>
            <span style={{ fontSize: 9.5, color: "#15803D", fontWeight: 700 }}>↑ 19</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, color: "#B45309", marginBottom: 6 }}>✦ AI NEGOTIATION VERDICT</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#0E0C08", lineHeight: 1.5, marginBottom: 10 }}>Countered with data, held silence twice, closed at ₹48L. 71% gap closure on the first-offer anchor.</div>
          <div style={{ fontSize: 8, background: "#F3EFE5", padding: "4px 8px", borderRadius: 3, color: "#6E6759" }}>
            Calibrated to Senior EM · Strong ≥ 85 · Hire ≥ 70 · Lean ≥ 55
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #EAE3D0", padding: "10px 18px 8px", background: "#FEFDF8" }}>
        <span style={{ fontSize: 8.5, background: "#FED7AA", color: "#B45309", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>SALARY NEGOTIATION · FULL REPORT</span>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0E0C08", marginTop: 7, fontFamily: rptF.serif, lineHeight: 1.25 }}>The full breakdown of your negotiation</div>
        <div style={{ fontSize: 8.5, color: "#6E6759", marginTop: 3 }}>Each panel turns one negotiation skill into something you can act on.</div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: "#B45309", letterSpacing: 0.4 }}>THE 30-SECOND READ</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#0E0C08", marginTop: 4, lineHeight: 1.35, fontFamily: rptF.serif }}>
            Landed ₹48L — ₹10L above opening. 71% gap closure in 3 rounds.
          </div>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 8.5, color: "#6E6759" }}>How far you got in the negotiation</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#15803D" }}>3 of 3 stages</span>
          </div>
        </div>
      </div>
      <div style={{ margin: "10px 18px 0", background: "#312E81", borderRadius: 7, padding: "9px 14px", display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 8.5, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "3px 8px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>PART 1 OF 4</span>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "#fff" }}>What happened in this call</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.65)" }}>Every moment that mattered: what you said, what you missed, what it cost.</div>
        </div>
      </div>
      <div style={{ padding: "10px 18px 14px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#0E0C08", marginBottom: 6 }}>01  How far you got in the negotiation</div>
        <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
          {phases.map(p => (
            <div key={p.n} style={{ flex: 1, height: 4, background: "#15803D", borderRadius: 2 }} />
          ))}
        </div>
        {phases.map(p => (
          <div key={p.n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: "1px solid #F0EDE3" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 17, height: 17, borderRadius: "50%", background: "#15803D", color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.n}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: "#0E0C08" }}>{p.label}</span>
            </div>
            <span style={{ fontSize: 8, fontWeight: 600, color: "#15803D", background: "#DCFCE7", padding: "2px 7px", borderRadius: 3 }}>DONE ✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Card: Campus placement — right ── (exact canvas copy) */
function RPT_ProgressCard({ lifted, revealed, baseDelay = 0 }: { lifted?: boolean; revealed?: boolean; baseDelay?: number }) {
  const skills = [
    { label: "Communication",     score: 75, c: "#15803D" },
    { label: "Fundamentals",      score: 70, c: "#15803D" },
    { label: "Project ownership", score: 45, c: "#B91C1C" },
    { label: "Project depth",     score: 40, c: "#B91C1C" },
  ];
  const rptF = { sans: "Inter, system-ui, -apple-system, sans-serif", serif: "'Instrument Serif', Georgia, serif", mono: "'JetBrains Mono', 'Fira Code', monospace" };
  /* Arc length for 58% of a semicircle: π × r × 0.58 = π × 33 × 0.58 ≈ 60 */
  const arcLen = 60;
  return (
    <div style={{ width: 460, background: "#FEFDF8", borderRadius: 16, border: "1px solid rgba(180,83,9,0.08)", boxShadow: lifted ? "0 32px 96px rgba(14,12,8,0.28), 0 8px 24px rgba(14,12,8,0.12)" : "0 8px 48px rgba(14,12,8,0.12), 0 2px 8px rgba(14,12,8,0.06)", overflow: "hidden", fontFamily: rptF.sans, transition: "box-shadow 0.50s ease" }}>
      <div style={{ background: "#FAF7F0", padding: "9px 16px", borderBottom: "1px solid #EAE3D0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6, color: "#6E6759" }}>READINESS</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#B45309" }}>42%</span>
        <span style={{ fontSize: 8, color: "#6E6759" }}>Infosys SWE Fresher · ~5 sessions to close gap</span>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "14px 16px 12px" }}>
        <div style={{ width: 124, flexShrink: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: "#6E6759", marginBottom: 6 }}>OVERALL SCORE</div>
          <div style={{ position: "relative", width: 84, height: 52, margin: "0 auto 8px" }}>
            <svg viewBox="0 0 80 50" width="84" height="52">
              <path d="M7,46 A33,33 0 0,1 73,46" fill="none" stroke="#E8E0D0" strokeWidth="7" strokeLinecap="round" />
              <path d="M7,46 A33,33 0 0,1 48,14" fill="none" stroke="#B45309" strokeWidth="7" strokeLinecap="round"
                strokeDasharray={arcLen} strokeDashoffset={revealed ? 0 : arcLen}
                style={{ transition: `stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1) ${baseDelay + 200}ms` }} />
            </svg>
            <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontSize: 22, fontWeight: 800, color: "#0E0C08", lineHeight: 1 }}>58</div>
            <div style={{ position: "absolute", bottom: -4, left: 0, right: 0, textAlign: "center", fontSize: 7.5, color: "#9E9589" }}>/ 100</div>
          </div>
          <span style={{ fontSize: 7.5, background: "#FEF3C7", color: "#92400E", padding: "2px 7px", borderRadius: 3, fontWeight: 600 }}>Lean Hire</span>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="28" height="12" viewBox="0 0 28 12"><polyline points="0,4 5,7 10,5 16,10 22,8 28,12" fill="none" stroke="#B91C1C" strokeWidth="1.2" /></svg>
            <span style={{ fontSize: 9, color: "#B91C1C", fontWeight: 700 }}>↓ 8</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.4, color: "#B45309", marginBottom: 5 }}>✦ AI CAMPUS VERDICT</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#0E0C08", lineHeight: 1.5, marginBottom: 8 }}>Enthusiasm came through. Project section drifted to "we" — distinguish your individual contribution.</div>
          <div style={{ fontSize: 8, background: "#FEE2E2", padding: "4px 8px", borderRadius: 3, color: "#7F1D1D", fontWeight: 600 }}>
            ⚠ RED FLAG: "we built the backend" — vague project role
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #EAE3D0", padding: "10px 16px 8px", background: "#FEFDF8" }}>
        <span style={{ fontSize: 8, background: "#FEF3C7", color: "#92400E", padding: "3px 9px", borderRadius: 20, fontWeight: 600 }}>CAMPUS PLACEMENT · FULL REPORT</span>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0E0C08", marginTop: 7, fontFamily: rptF.serif, lineHeight: 1.25 }}>The full breakdown of your campus interview</div>
        <div style={{ fontSize: 8, color: "#6E6759", marginTop: 3 }}>Each panel turns one campus skill into something you can rehearse.</div>
      </div>
      <div style={{ margin: "10px 16px 0", background: "#312E81", borderRadius: 6, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 8, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 7px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>PART 1 OF 3</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>Skill breakdown</div>
          <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.65)" }}>Where each axis landed and what to practice next.</div>
        </div>
      </div>
      <div style={{ padding: "10px 16px 14px" }}>
        {skills.map((s, i) => (
          <div key={s.label} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 8.5, color: "#4A4540" }}>{s.label}</span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: s.c, fontFamily: rptF.mono }}>{s.score}</span>
            </div>
            <div style={{ height: 4, background: "#EBE5D2", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: revealed ? `${s.score}%` : "0%", background: s.c, borderRadius: 2, transition: `width 0.7s cubic-bezier(0.16,1,0.3,1) ${baseDelay + 400 + i * 80}ms` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PersonalizedReportsV2() {
  const [hov, setHov] = useState<"left" | "center" | "right" | null>(null);
  const [revealed, setRevealed] = useState(false);
  const showcaseRef = useRef<HTMLDivElement>(null);

  /* Bidirectional scroll reveal — two observers with different thresholds:
     enter fires when 12% visible; exit fires the moment any part leaves */
  useEffect(() => {
    const el = showcaseRef.current;
    if (!el || typeof IntersectionObserver === "undefined") { setRevealed(true); return; }
    const enterIO = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setRevealed(true); }),
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
    );
    const exitIO = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (!e.isIntersecting) setRevealed(false); }),
      { threshold: 0 },
    );
    enterIO.observe(el);
    exitIO.observe(el);
    return () => { enterIO.disconnect(); exitIO.disconnect(); };
  }, []);

  const lActive = hov === "left";
  const cActive = hov === "center";
  const rActive = hov === "right";
  const anyHov  = hov !== null;

  /* Stagger delays: 0 / 120 / 240ms on enter; all 0ms on exit (snap away together) */
  const delay = (n: number) => revealed ? `${n * 120}ms` : "0ms";

  /* ── Outer div: absolute position + scroll reveal (translateY + opacity) ──
     ── Inner div: hover transforms (rotate / scale)                         ── */

  return (
    <section
      aria-labelledby="hd-reports"
      className="mv2-rpt-section"
      style={{ background: "#FAF7F0", overflowX: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 120, paddingBottom: 80 }}
    >
      <style>{rpt_STYLES}</style>

      {/* ── Fan card showcase ── */}
      <div ref={showcaseRef} className="mv2-rpt-showcase" style={{ position: "relative", width: "100%", height: 580, flexShrink: 0, clipPath: "inset(-280px -60px 0 -60px)" }}>

        {/* Left card — outer: position + reveal; inner: hover */}
        <div className="mv2-rpt-side" style={{ position: "absolute", left: 220, bottom: 60, zIndex: lActive ? 12 : anyHov ? 2 : 3, transform: revealed ? "translateY(0px)" : "translateY(80px)", opacity: revealed ? 1 : 0, transition: RV, transitionDelay: delay(0) }}>
          <div style={{ transformOrigin: "bottom center", transform: lActive ? "rotate(0deg) translateY(-30px) scale(1.08)" : anyHov ? "rotate(-10deg) translateY(6px) scale(0.86)" : "rotate(-8deg)", opacity: anyHov && !lActive ? 0.65 : 1, filter: anyHov && !lActive ? "brightness(0.92) saturate(0.2)" : "none", transition: TR }} onMouseEnter={() => setHov("left")} onMouseLeave={() => setHov(null)}>
            <div style={{ position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none", fontFamily: "Inter, system-ui, sans-serif", fontWeight: 400, fontSize: 12, color: "#9E9589", lineHeight: 1.4, opacity: hov !== null ? 0 : 1, transition: "opacity 0.30s ease" }}>
              Behavioral · 82/100<br />Razorpay Senior PD
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3, color: "#9E9589" }}>↓</div>
            </div>
            <RPT_InterviewCard lifted={lActive} revealed={revealed} baseDelay={0} />
          </div>
        </div>

        {/* Center card */}
        <div style={{ position: "absolute", left: "50%", bottom: 60, zIndex: cActive ? 12 : anyHov ? 4 : 5, transform: revealed ? "translateX(-50%) translateY(0px)" : "translateX(-50%) translateY(80px)", opacity: revealed ? 1 : 0, transition: RV, transitionDelay: delay(1) }}>
          <div style={{ transform: cActive ? "translateY(-30px) scale(1.08)" : anyHov ? "translateY(6px) scale(0.86)" : "none", opacity: anyHov && !cActive ? 0.65 : 1, filter: anyHov && !cActive ? "brightness(0.92) saturate(0.2)" : "none", transition: TR }} onMouseEnter={() => setHov("center")} onMouseLeave={() => setHov(null)}>
            <div style={{ position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none", fontFamily: "Inter, system-ui, sans-serif", fontWeight: 400, fontSize: 12, color: "#9E9589", lineHeight: 1.4, opacity: hov !== null ? 0 : 1, transition: "opacity 0.30s ease" }}>
              Salary Neg · ₹48L landed<br />PhonePe Senior EM
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3, color: "#9E9589" }}>↓</div>
            </div>
            <RPT_ReportCard lifted={cActive} revealed={revealed} baseDelay={120} />
          </div>
        </div>

        {/* Right card */}
        <div className="mv2-rpt-side" style={{ position: "absolute", right: 220, bottom: 60, zIndex: rActive ? 12 : anyHov ? 2 : 3, transform: revealed ? "translateY(0px)" : "translateY(80px)", opacity: revealed ? 1 : 0, transition: RV, transitionDelay: delay(2) }}>
          <div style={{ transformOrigin: "bottom center", transform: rActive ? "rotate(0deg) translateY(-30px) scale(1.08)" : anyHov ? "rotate(10deg) translateY(6px) scale(0.86)" : "rotate(8deg)", opacity: anyHov && !rActive ? 0.65 : 1, filter: anyHov && !rActive ? "brightness(0.92) saturate(0.2)" : "none", transition: TR }} onMouseEnter={() => setHov("right")} onMouseLeave={() => setHov(null)}>
            <div style={{ position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none", fontFamily: "Inter, system-ui, sans-serif", fontWeight: 400, fontSize: 12, color: "#9E9589", lineHeight: 1.4, opacity: hov !== null ? 0 : 1, transition: "opacity 0.30s ease" }}>
              Campus · 58/100<br />Infosys SWE Fresher
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3, color: "#9E9589" }}>↓</div>
            </div>
            <RPT_ProgressCard lifted={rActive} revealed={revealed} baseDelay={240} />
          </div>
        </div>

        {/* Bottom fade */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 360, background: "linear-gradient(to bottom, transparent 0%, #FAF7F0 70%)", zIndex: 15, pointerEvents: "none" }} />
      </div>

      {/* ── Headline — scroll-revealed same as cards, fires after last card lands ── */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, marginTop: -80,
        opacity: revealed ? 1 : 0,
        transform: revealed ? "translateY(0px)" : "translateY(32px)",
        transition: RV,
        transitionDelay: revealed ? delay(3) : "0ms",
      }}>
        <h2 id="hd-reports" className="mv2-rpt-h2" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 72, fontWeight: 400, lineHeight: 1.02, color: "#0E0C08", margin: "0 0 4px", textAlign: "center", letterSpacing: -2.5, padding: "0 24px" }}>
          Personalized reports after
        </h2>
        <h2 className="mv2-rpt-h2" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 72, fontWeight: 400, fontStyle: "italic", lineHeight: 1.02, color: "#B45309", margin: "0 0 24px", textAlign: "center", letterSpacing: -1.5 }}>
          every interview
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4A4540", textAlign: "center", margin: 0, maxWidth: 480, fontWeight: 400, fontFamily: "'Satoshi', Inter, system-ui, sans-serif" }}>
          HireStepX gives you a full breakdown after every interview — what landed,
          what to sharpen, and your exact next practice session.
        </p>
      </div>
    </section>
  );
}

/* ─────────────────────────── SECURITY & COMPLIANCE ─────────────────────────── */
export function SecurityComplianceV2() {
  const cards = [
    {
      title: "DPDP Act 2023",
      desc: "Built for India's Digital Personal Data Protection Act. Your data rights are enforced by design, not just policy.",
      icon: (
        /* Document (indigo) + copper official seal */
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="7" y="4" width="22" height="28" rx="3" fill="#EEEDF8" stroke="#312E81" strokeWidth="1.7" />
          <path d="M22 4v7h7" fill="#C9C6E8" stroke="#312E81" strokeWidth="1.4" strokeLinejoin="round" />
          <line x1="12" y1="16" x2="22" y2="16" stroke="#312E81" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="20" x2="22" y2="20" stroke="#312E81" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="24" x2="18" y2="24" stroke="#312E81" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="31" cy="31" r="9.5" fill="#EEEDF8" stroke="#312E81" strokeWidth="1.7" />
          <path d="M27 31l2.5 2.5 4.5-5" stroke="#312E81" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Encrypted at rest",
      desc: "All resumes, transcripts, and voice data stored with AES-256 encryption and row-level security. Nothing leaks between users.",
      icon: (
        /* Indigo body + copper shackle */
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="21" width="26" height="17" rx="4" fill="#EEEDF8" stroke="#312E81" strokeWidth="1.7" />
          <path d="M15 21v-5.5a7 7 0 0 1 14 0V21" stroke="#312E81" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx="22" cy="30" r="3.5" fill="#312E81" />
          <line x1="22" y1="33" x2="22" y2="36" stroke="#312E81" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "No AI training on your data",
      desc: "Your interviews, resume, and voice recordings are never used to train AI models. Your sessions belong to you alone.",
      icon: (
        /* Indigo CPU/chip + copper prohibition ring */
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="12" y="12" width="20" height="20" rx="3" fill="#EEEDF8" stroke="#312E81" strokeWidth="1.7" />
          <rect x="16" y="16" width="12" height="12" rx="1.5" fill="#312E81" opacity="0.15" stroke="#312E81" strokeWidth="1.2" />
          <line x1="17" y1="8" x2="17" y2="12" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="22" y1="8" x2="22" y2="12" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="27" y1="8" x2="27" y2="12" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="17" y1="32" x2="17" y2="36" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="22" y1="32" x2="22" y2="36" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="27" y1="32" x2="27" y2="36" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="8" y1="17" x2="12" y2="17" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="8" y1="22" x2="12" y2="22" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="8" y1="27" x2="12" y2="27" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="32" y1="17" x2="36" y2="17" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="32" y1="22" x2="36" y2="22" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="32" y1="27" x2="36" y2="27" stroke="#312E81" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="32" cy="32" r="9" fill="#EEEDF8" />
          <circle cx="32" cy="32" r="7.5" stroke="#312E81" strokeWidth="1.8" fill="none" />
          <line x1="27.3" y1="36.7" x2="36.7" y2="27.3" stroke="#312E81" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "You're in control",
      desc: "Delete your account and every byte of your data from Settings, instantly. No support ticket. No waiting period.",
      icon: (
        /* Indigo shield + copper person = you own your data */
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 4L8 10v11c0 9.2 6 17.3 14 19.8 8-2.5 14-10.6 14-19.8V10L22 4Z" fill="#EEEDF8" stroke="#312E81" strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="22" cy="18" r="4" fill="#312E81" />
          <path d="M13.5 31.5c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5" fill="#312E81" />
        </svg>
      ),
    },
  ];

  return (
    <section style={{ background: t.cream, padding: "96px 0 80px", overflowX: "hidden" }}>
      <div className="mv2-container" style={{ maxWidth: 1120, margin: "0 auto", padding: "0 40px" }}>
        {/* Headline */}
        <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 56, fontWeight: 400, lineHeight: 1.05, color: t.coal, textAlign: "center", margin: "0 auto 16px", letterSpacing: -1.5, maxWidth: 640 }}>
          Your data stays <span style={{ fontStyle: "italic", color: "#B45309" }}>yours</span>
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4A4540", textAlign: "center", margin: "0 auto 64px", maxWidth: 480, fontFamily: fonts.sans }}>
          Built for India's regulatory landscape. Every piece of data you share is encrypted, private, and deletable on demand.
        </p>

        {/* Cards grid — collapses to 2-col at ≤880px via .mv2-security-grid */}
        <div className="mv2-security-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {cards.map((c) => (
            <div
              key={c.title}
              style={{
                background: "#FEFDF8",
                border: "1px solid rgba(180,83,9,0.1)",
                borderRadius: 14,
                padding: "28px 24px 28px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 260,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.coal, marginBottom: 10, fontFamily: fonts.sans }}>
                  {c.title}
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "#4A4540", margin: 0, fontFamily: fonts.sans }}>
                  {c.desc}
                </p>
              </div>
              <div style={{ marginTop: 32 }}>
                {c.icon}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── VIDEO CTA ─────────────────────────── */
export function VideoCtaV2() {
  return (
    <section style={{ position: "relative", minHeight: 580, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#0E0C08" }}>

      {/* Background video — swap /demo-loop.mp4 with actual product recording */}
      <video
        autoPlay
        muted
        loop
        playsInline
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.38 }}
      >
        <source src="/demo-loop.mp4" type="video/mp4" />
      </video>

      {/* Gradient overlays — top + bottom fade for depth */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, #0E0C08 0%, transparent 30%, transparent 70%, #0E0C08 100%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 40%, rgba(14,12,8,0.55) 100%)" }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "80px 40px", maxWidth: 720, margin: "0 auto" }}>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(180,83,9,0.15)", border: "1px solid rgba(180,83,9,0.35)", borderRadius: 20, padding: "5px 14px 5px 10px", marginBottom: 32 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#B45309", display: "inline-block", boxShadow: "0 0 6px #B45309" }} />
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#FED7AA", letterSpacing: 0.5 }}>Live AI interview — no scripts, no shortcuts</span>
        </div>

        <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 64, fontWeight: 400, lineHeight: 1.04, color: "#FAF7F0", margin: "0 0 20px", letterSpacing: -2 }}>
          Hear the silence.<br />
          <span style={{ fontStyle: "italic", color: "#B45309" }}>Then answer it.</span>
        </h2>

        <p style={{ fontSize: 17, lineHeight: 1.7, color: "rgba(250,247,240,0.68)", margin: "0 auto 40px", maxWidth: 480, fontFamily: fonts.sans }}>
          HireStepX asks real follow-up questions, catches vague answers, and scores you — just like a bar-raiser would.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#B45309", color: "#FAF7F0", padding: "14px 28px", borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: "none", fontFamily: fonts.sans, letterSpacing: 0.1 }}>
            Start your free interview
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
          <a href="#demo" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(250,247,240,0.08)", color: "#FAF7F0", border: "1px solid rgba(250,247,240,0.18)", padding: "14px 24px", borderRadius: 8, fontWeight: 500, fontSize: 15, textDecoration: "none", fontFamily: fonts.sans }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" /><path d="M6.5 5.5l4 2.5-4 2.5V5.5Z" fill="currentColor" /></svg>
            Watch a session
          </a>
        </div>

        {/* Social proof strip */}
        <div style={{ marginTop: 48, display: "flex", gap: 32, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { n: "3 free", label: "sessions, no card" },
            { n: "10 types", label: "of interviews" },
            { n: "50+", label: "companies" },
          ].map(item => (
            <div key={item.n} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#FAF7F0", fontFamily: "'Instrument Serif', Georgia, serif", letterSpacing: -0.5 }}>{item.n}</div>
              <div style={{ fontSize: 11, color: "rgba(250,247,240,0.5)", marginTop: 2, fontFamily: fonts.sans }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── COMPOSED PAGE ─────────────────────────── */
export default function HomepageV2() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.cream,
        color: t.coal,
        fontFamily: fonts.sans,
        /* Force light-mode UA chrome (form controls, scrollbars) on this surface.
           Page renders cream regardless of OS theme; this stops the dark-mode
           UA from painting dark inputs / form controls against our light bg. */
        colorScheme: "light",
      }}
    >
      <ResponsiveSheet />
      <StructuredData />
      <a href="#main" className="mv2-skip">Skip to content</a>
      <NavV2 />
      {/* Composition compressed from 11 → 9 sections:
            - TrustRowV2 cut (security badges fold into FAQ + footer)
            - ComparisonV2 cut (folded into single FAQ entry on ChatGPT)
            - PricingV2 sits at slot 6, after objections are handled.
              Earlier draft placed it at slot 3 on a weak "price upfront"
              theory; standard B2C arc (build belief, then show cost) wins. */}
      <main id="main">
        <HeroV2 />
        <LogoStripV2 />
        <ProductStoryV2 />
        <InterviewFocusV2 />
        <PersonalizedReportsV2 />
        <FeatureGridV2 />
        <TestimonialsV2 />
        <PricingV2 />
        <BuiltForIndiaV2 />
        <SecurityComplianceV2 />
        <VideoCtaV2 />
        <FAQV2 />
      </main>
      <FinalCTAFooterV2 />
      <MobileStickyCTA />
    </div>
  );
}

/* ─────────────────────────── MOBILE STICKY CTA ─────────────────────────── */
export function MobileStickyCTA() {
  return (
    <div
      className="mv2-mobile-cta"
      role="region"
      aria-label="Quick start"
      style={{
        position: "fixed",
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 60,
        display: "none",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: "10px 12px 10px 16px",
        // Fully opaque on mobile so we can drop the persistent backdrop-filter
        // that this element is only ever rendered on. Saves a compositor layer
        // on every scroll frame on mid-range Android.
        background: "rgb(14, 12, 8)",
        border: `1px solid ${t.creamLine}`,
        borderRadius: 999,
        boxShadow: `0 10px 40px ${t.coalShadow}`,
      }}
    >
      <span
        style={{
          fontFamily: fonts.sans,
          fontSize: 13,
          color: t.cream,
          lineHeight: 1.3,
        }}
      >
        <span style={{ fontFamily: fonts.serif, fontStyle: "italic", color: t.copper100 }}>
          3 free sessions
        </span>{" "}
        · No card needed
      </span>
      <a
        href="/signup"
        style={{
          fontFamily: fonts.sans,
          fontSize: 13,
          fontWeight: 600,
          color: t.coal,
          background: t.cream,
          padding: "10px 16px",
          borderRadius: 999,
          textDecoration: "none",
          whiteSpace: "nowrap",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        Start
        <span aria-hidden>→</span>
      </a>
    </div>
  );
}
