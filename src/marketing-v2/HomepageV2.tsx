"use client";
import { useEffect, useState, useRef, type CSSProperties } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { tokens as t, fonts, shadows } from "../auth/_tokens";
import { useAuth, hasStoredSession } from "../AuthContext";
import { captureClientEvent } from "../posthogClient";
import { FooterDome as FinalCTAFooterV2 } from "./FooterDome";
export { FinalCTAFooterV2 };

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
      .mv2-hero-mock-outer { padding-left: 16px !important; padding-right: 16px !important; }
      /* Mosaic: single column on phones */
      .mv2-bento-mosaic { grid-template-columns: 1fr !important; }
      .mv2-bento-mosaic > *:first-child { grid-column: 1 !important; }
      main, footer { padding-bottom: 96px !important; }
      .mv2-tap-44 { min-height: 44px !important; }
      .mv2-features-h2 { white-space: normal !important; }
      .mv2-hero-section { min-height: 0 !important; display: block !important; }
      /* Focus type icon grids: phone */
      .mv2-focus-live-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .mv2-focus-soon-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 24px 16px !important; }
    }
    /* ── Tablets (md) ── */
    @media (max-width: 880px) {
      .mv2-nav-links { display: none !important; }
      .mv2-nav-cta-label { display: none !important; }
      .mv2-nav-burger { display: inline-flex !important; }
      .mv2-hero-mock-body { grid-template-columns: 1fr !important; }
      .mv2-hero-mock-side { border-left: none !important; border-top: 1px solid var(--mv2-line) !important; }
      .mv2-hero-section { min-height: 0 !important; display: block !important; }
      .mv2-hero-mock-outer { padding-left: 20px !important; padding-right: 20px !important; }
      .mv2-story-stage { grid-template-columns: 1fr !important; gap: 32px !important; padding-top: 40px !important; padding-bottom: 40px !important; }
      .mv2-story-stages { flex-direction: column !important; }
      .mv2-story-arrow { display: none !important; }
      .mv2-bento-resume-row { flex-direction: column !important; gap: 24px !important; }
      .mv2-focus-flagship { grid-template-columns: 1fr !important; gap: 28px !important; padding: 28px !important; }
      .mv2-focus-grid { grid-template-columns: 1fr !important; }
      .mv2-feature-grid { grid-template-columns: 1fr !important; }
      .mv2-feature-span2 { grid-column: span 1 !important; }
      /* Mosaic: collapse to 2-col at tablet (Before card spans full width) */
      .mv2-bento-mosaic { grid-template-columns: 1fr 1fr !important; grid-template-rows: auto !important; height: auto !important; }
      .mv2-bento-mosaic > *:first-child { grid-column: 1 / 3 !important; grid-row: auto !important; height: auto !important; min-height: 200px; }
      .mv2-bento-mosaic > *:not(:first-child) { grid-column: auto !important; grid-row: auto !important; height: auto !important; }
      .mv2-bento-large, .mv2-bento-small { grid-column: 1 / -1 !important; }
      .mv2-india-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
      .mv2-india-logos { justify-content: flex-start !important; }
      .mv2-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
      .mv2-pricing-grid { grid-template-columns: 1fr !important; }
      .mv2-focus-grid { grid-template-columns: 1fr !important; }
      .mv2-mobile-cta { display: flex !important; }
      /* Security & Compliance: collapse 4-col to 2-col at tablet */
      .mv2-security-grid { grid-template-columns: repeat(2, 1fr) !important; }
      /* Comparison: competitor cards side by side, HireStepX spans full width */
      .mv2-cmp-cards { grid-template-columns: 1fr 1fr !important; }
      .mv2-cmp-hsx { grid-column: 1 / -1 !important; }
      /* Focus type icon grids: tablet */
      .mv2-focus-live-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .mv2-focus-soon-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 32px 20px !important; }
      /* Objections: collapse 3-col (72px 1fr 1fr) → 2-col (number + content).
         The response <p> is forced into col 2 so it stacks under the quote,
         not under the number. Same pattern as the 881-1100px breakpoint. */
      .mv2-why-row { grid-template-columns: 40px 1fr !important; gap: 20px !important; padding: 28px 0 !important; }
      .mv2-why-row > p:last-child { grid-column: 2 / 3 !important; }
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
      /* Cap at 64px so the heading doesn't stack to 4 lines in the ~343px
         text column of the 2-col hero at 13" laptop widths (881–1100px). */
      .mv2-hero-display { font-size: clamp(48px, 7.5vw, 64px) !important; }
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
    /* Bento card animations */
    @keyframes mv2-dot-bounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }
    @media (prefers-reduced-motion: reduce) { [style*="mv2-dot-bounce"] { animation: none !important; } }
    /* Skip paint + pause CSS animations on off-screen sections (battery on low-end mobile) */
    .mv2-cv-auto { content-visibility: auto; contain-intrinsic-size: 1px 700px; }
    /* Hero load cascade — stepped entrance, one orchestrated moment */
    @keyframes mv2-cascade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .mv2-cascade { animation: mv2-cascade 0.72s ${ease} both; }
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
    /* Bento card hover lift */
    .mv2-bento-large, .mv2-bento-small { transition: transform 0.28s ${ease}, box-shadow 0.28s ${ease}, border-color 0.2s ease; }
    .mv2-bento-large:hover, .mv2-bento-small:hover { transform: translateY(-3px); box-shadow: ${shadows.featureHover}; border-color: ${t.lineStrong}; }
    @media (prefers-reduced-motion: reduce) { .mv2-bento-large, .mv2-bento-small { transition: none !important; transform: none !important; } }
    /* HireStepX comparison card glow on hover */
    .mv2-cmp-hsx { transition: box-shadow 0.3s ${ease}; }
    .mv2-cmp-hsx:hover { box-shadow: 0 24px 64px rgba(14,12,8,0.36), 0 6px 20px rgba(14,12,8,0.18); }
    @media (prefers-reduced-motion: reduce) { .mv2-cmp-hsx { transition: none !important; } }
    /* Dark-surface cross-links — arrow nudge on hover */
    .mv2-dark-link { transition: color 0.18s ease; }
    .mv2-dark-link .mv2-dark-arrow { display: inline-block; transition: transform 0.22s ${ease}; }
    .mv2-dark-link:hover .mv2-dark-arrow { transform: translateX(3px); }
    /* Mobile sticky CTA press state */
    .mv2-sticky-btn { transition: transform 0.15s ease, opacity 0.1s ease; }
    .mv2-sticky-btn:active { transform: scale(0.96); }
    @media (prefers-reduced-motion: reduce) { .mv2-sticky-btn { transition: none !important; transform: none !important; } }
    /* Pricing CTA press state */
    .mv2-pricing-cta { transition: transform 0.2s ${ease}, opacity 0.15s ease; }
    .mv2-pricing-cta:hover { transform: translateY(-1px); }
    .mv2-pricing-cta:active { transform: scale(0.97); transition-duration: 0.08s; }
    @media (prefers-reduced-motion: reduce) { .mv2-pricing-cta { transition: none !important; transform: none !important; } }
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
  paddingLeft: 48,
  paddingRight: 48,
};

const sectionBase: CSSProperties = {
  position: "relative",
  paddingTop: 120,
  paddingBottom: 120,
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
  fontSize: 16,
  lineHeight: 1.6,
  color: t.indigoGray,
  margin: 0,
  maxWidth: "60ch",
};

/* ─────────────────────────── 1. NAV ─────────────────────────── */
export function NavV2() {
  const navLinks: Array<[string, string]> = [
    ["Blog", "/blog"],
    ["Pricing", "/#hd-pricing"],
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

  /* Floating pill with hysteresis: shrinks at >80px, expands only when
     scrollY drops back below 40px. The asymmetric thresholds prevent the
     animation from toggling rapidly when the user hovers near a single
     boundary — which is the main cause of the "jerk" feeling. */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let current = window.scrollY > 80;
    setScrolled(current);
    const onScroll = () => {
      const y = window.scrollY;
      if (!current && y > 80) { current = true; setScrolled(true); }
      else if (current && y < 40) { current = false; setScrolled(false); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      role="banner"
      className="mv2-nav-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        /* When scrolled, header becomes transparent so page content shows
           through the gap around the pill. When not scrolled, cream matches
           the hero surface seamlessly. Transition background only — not
           border — to avoid a jarring line appearing mid-animation. */
        background: scrolled ? "transparent" : t.cream,
        borderBottom: scrolled ? "none" : `1px solid ${t.line}`,
        transition: "background 250ms ease-out",
      }}
    >
      {/* Self-contained responsive + pill rules. NavV2 is rendered both by
          the homepage and standalone by every marketing sub-page (via
          MarketingPagesV2). Keeping the rules here means the nav collapses
          correctly wherever it mounts. On mobile (≤880px) the pill is
          suppressed: full-width sticky bar always, no floating effect. */}
      <style>{`
        /* ── Nav link hover: copper underline slides in from left ── */
        .mv2-nav-link {
          color: #6E6759;
          font-weight: 500;
          padding-bottom: 4px;
          transition: color 180ms ease-out;
        }
        .mv2-nav-link[aria-current="page"] {
          color: #0E0C08;
          font-weight: 600;
        }
        .mv2-nav-link:hover:not([aria-current="page"]) {
          color: #0E0C08;
        }
        .mv2-nav-link::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          height: 1.5px;
          width: 0;
          background: #B45309;
          transition: width 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .mv2-nav-link[aria-current="page"]::after {
          width: 100%;
          transition: none;
        }
        .mv2-nav-link:hover:not([aria-current="page"])::after {
          width: 100%;
        }

        @media (max-width: 880px) {
          .mv2-nav-links { display: none !important; }
          .mv2-nav-cta-label { display: none !important; }
          .mv2-nav-burger { display: inline-flex !important; }
          /* Hide the "Sign in" text link — it's in the mobile drawer */
          .mv2-nav-sign-in { display: none !important; }
          /* Always full-width sticky on mobile, never a floating pill */
          .mv2-nav-header { background: #FAF7F0 !important; border-bottom: 1px solid #EBE5D2 !important; transition: none !important; }
          .mv2-nav-pill { max-width: 100% !important; margin: 0 !important; border-radius: 0 !important; border-color: transparent !important; box-shadow: none !important; }
        }
      `}</style>
      <nav
        aria-label="Primary"
        className="mv2-nav-pill"
        style={{
          background: t.cream,
          /* Use a large px value instead of "100%" — px→px transitions are
             always smooth; % requires mid-animation unit conversion which
             causes the expand to stutter. 1600 exceeds all common viewports
             so it reads as full-width while staying interpolatable. */
          maxWidth: scrolled ? 760 : 1600,
          /* Keep "auto" on both sides so only the numeric part (16→0) animates;
             if we toggle between "16px auto" and "0" the browser has to
             interpolate through the auto keyword which can't be eased smoothly. */
          margin: scrolled ? "16px auto" : "0px auto",
          borderRadius: scrolled ? "0 0 14px 14px" : 0,
          /* Border stays 1px always — toggling between transparent and colored
             avoids the 1px content-box shift that border:none → border:1px causes */
          border: `1px solid ${scrolled ? t.line : "transparent"}`,
          boxShadow: scrolled ? "0 4px 24px rgba(14,12,8,0.09), 0 1px 4px rgba(14,12,8,0.04)" : "none",
          overflow: "hidden",
          position: "relative",
          /* Different easing per direction: the CSS transition on the destination
             state is what the browser uses. Shrink → snappy expo ease-out (400ms).
             Expand → relaxed standard ease (550ms) so the nav opens gracefully
             rather than springing back. */
          transition: scrolled
            ? "max-width 400ms cubic-bezier(0.16,1,0.3,1), margin 400ms cubic-bezier(0.16,1,0.3,1), border-radius 400ms cubic-bezier(0.16,1,0.3,1), box-shadow 400ms cubic-bezier(0.16,1,0.3,1), border-color 400ms cubic-bezier(0.16,1,0.3,1)"
            : "max-width 550ms cubic-bezier(0.4,0,0.2,1), margin 550ms cubic-bezier(0.4,0,0.2,1), border-radius 550ms cubic-bezier(0.4,0,0.2,1), box-shadow 550ms cubic-bezier(0.4,0,0.2,1), border-color 550ms cubic-bezier(0.4,0,0.2,1)",
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
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", flexShrink: 0 }}
          >
            <Image src="/wordmark.png" alt="HireStepX" width={387} height={108} priority style={{ height: scrolled ? 21 : 26, width: "auto", transition: "height 0.2s ease" }} />
          </a>

          <div
            className="mv2-nav-links"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
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
                  className="mv2-nav-link"
                  style={{ textDecoration: "none", position: "relative" }}
                >
                  {label}
                </a>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
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
      round: "Behavioral Round",
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
        margin: "0 auto",
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
            display: "flex",
            flexDirection: "column",
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
              fontSize: 18,
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
              fontSize: 18,
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

          {phase === "done" && (
            <div style={{
              marginTop: "auto",
              paddingTop: 16,
              borderTop: `1px solid ${t.line}`,
              display: "flex",
              alignItems: "center",
              gap: 8,
              animation: `mv2-fade-up 0.5s ${ease} 600ms both`,
            }}>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontFamily: fonts.sans,
                fontSize: 11,
                color: t.indigo,
                fontWeight: 600,
                padding: "3px 10px",
                background: t.indigo100,
                borderRadius: 999,
              }}>
                3 follow-up questions ready
              </span>
              <span style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkFaint }}>
                Answer one to keep the round going
              </span>
            </div>
          )}
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
              marginTop: 4,
              padding: "12px 14px",
              background: t.copperSoft,
              border: `1px solid rgba(180,83,9,0.18)`,
              borderRadius: 10,
              fontFamily: fonts.sans,
              lineHeight: 1.5,
            }}
          >
            <span style={{
              fontFamily: fonts.mono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase" as const,
              color: t.copperDark,
              display: "block",
              marginBottom: 5,
            }}>Coach fix</span>
            <span style={{ fontSize: 13, color: t.coal }}>{scene.fix}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Editorial section masthead — numbered hairline that once headed each
   section. The design dropped the visible mastheads; the call sites stay
   (they document section order/labels) but the component renders nothing.
   Props are accepted-and-ignored via a single `_props` so the neutered
   stub doesn't trip no-unused-vars. */
function SectionMasthead(_props: {
  n: string;
  label: string;
  right?: React.ReactNode;
  live?: boolean;
  style?: CSSProperties;
}): null {
  return null;
}

/* Aspirational micro-copy, not testimonials. We don't have customers
   yet (founded 2026) — fabricating named quotes would burn credibility
   the second any prospect googles the names. Rotated through the hero
   as a "what this product is for" line. */
export function HeroV2() {
  return (
    <section
      aria-labelledby="hd-hero"
      className="mv2-hero-section"
      style={{
        ...sectionBase,
        paddingTop: 96,
        paddingBottom: 40,
        background: t.cream,
        overflowX: "hidden",
        position: "relative",
      }}
    >
      {/* Copper wash — stronger and wider to anchor the headline */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 60% at 50% 8%, rgba(180,83,9,0.11) 0%, rgba(180,83,9,0.04) 45%, transparent 65%)",
          pointerEvents: "none",
          contain: "paint",
        }}
      />

      {/* Centered text block */}
      <div style={{ ...container, position: "relative", textAlign: "center" }}>

        {/* Positioning eyebrow */}
        <div
          className="mv2-cascade mv2-cascade-1"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            marginBottom: 28,
            padding: "6px 16px",
            background: t.copperSoft,
            border: `1px solid rgba(180,83,9,0.18)`,
            borderRadius: 999,
            fontFamily: fonts.mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.13em",
            textTransform: "uppercase" as const,
            color: t.copper,
          }}
        >
          <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: t.copper, display: "inline-block", flexShrink: 0 }} />
          AI Interview Coach, Built for India
        </div>

        <h1
          id="hd-hero"
          className="mv2-hero-display mv2-cascade mv2-cascade-2"
          style={{
            fontFamily: fonts.serif,
            fontSize: "clamp(48px, 6vw, 86px)",
            lineHeight: 1.03,
            letterSpacing: "-0.035em",
            color: t.coal,
            margin: "0 auto",
            fontWeight: 400,
            maxWidth: 760,
            textWrap: "balance" as CSSProperties["textWrap"],
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
            fontSize: 16,
            lineHeight: 1.62,
            color: t.inkSoft,
            maxWidth: 500,
            margin: "22px auto 0",
          }}
        >
          AI mock interviews you actually speak to, scored against the
          rubrics real Indian panels use. STAR breakdown back before your chai
          cools.
        </p>

        {/* CTAs */}
        <div
          className="mv2-hero-cta-row mv2-cascade mv2-cascade-4"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            marginTop: 40,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <a
            href="/signup"
            className="mv2-tap-44 mv2-cta-primary"
            onClick={() => captureClientEvent("hero_cta_clicked", { cta: "start_free", surface: "hero" })}
            style={{
              fontFamily: fonts.sans,
              fontSize: 16,
              fontWeight: 600,
              color: t.cream,
              background: t.indigo,
              padding: "15px 28px",
              borderRadius: 999,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 20px rgba(49,46,129,0.28)",
            }}
          >
            Start free session
            <span aria-hidden className="mv2-cta-arrow" style={{ fontSize: 17 }}>→</span>
          </a>
        </div>
        <p
          style={{
            fontFamily: fonts.sans,
            fontSize: 12.5,
            color: t.inkSoft,
            textAlign: "center",
            marginTop: 12,
            letterSpacing: "0.01em",
          }}
        >
          2 sessions free · no credit card required
        </p>

      </div>

      {/* Product mock — wider, more breathing room above.
          mask-image fades the bottom third to transparent so the card's
          shadow and hard edge dissolve into the cream background instead
          of cutting off abruptly. */}
      <div
        className="mv2-cascade mv2-cascade-6 mv2-hero-mock-outer"
        style={{
          maxWidth: 1160,
          margin: "48px auto 0",
          padding: "0 32px",
          position: "relative",
          maskImage: "linear-gradient(to bottom, black 0%, black 62%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 62%, transparent 100%)",
        }}
      >
        <ProductMockHero />
      </div>
    </section>
  );
}

/* ─────────────────────────── 3.5. INTERVIEW FOCUS ─────────────────────────── */
export function InterviewFocusV2() {
  const G  = "url(#hsx-cg)";
  const rp = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  const LIVE_TYPES = [
    {
      label: "Behavioral",
      desc: "STAR stories · leadership · decisions",
      icon: (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M9 8h46a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H28L16 52l2-14H9a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"
            stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.08"/>
          <polygon points="32,12 35,21 44,21 37,26 40,35 32,30 24,35 27,26 20,21 29,21"
            stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.26"/>
        </svg>
      ),
    },
    {
      label: "Campus Placement",
      desc: "TCS · Infosys · Wipro · Cognizant",
      icon: (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <path d="M32 10 L56 24 L32 38 L8 24 Z" stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.18"/>
          <circle cx="32" cy="24" r="5" stroke={G} strokeWidth={1.5} fill={G} fillOpacity="0.55"/>
          <path d="M32 24 L56 24 L56 46" stroke={G} strokeWidth={2} strokeLinecap="round" fill="none"/>
          <circle cx="56" cy="51" r="4.5" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.40"/>
        </svg>
      ),
    },
    {
      label: "Salary Negotiation",
      desc: "Counter-offers · levelling · benefits",
      icon: (
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <text x="32" y="48" textAnchor="middle" fontSize="48"
            fontFamily='"Satoshi", "Inter", system-ui, sans-serif'
            fontWeight="500" fill={G}>₹</text>
        </svg>
      ),
    },
    {
      label: "HR Round",
      desc: "Culture fit · motivation · expectations",
      icon: (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="20" r="11" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.12"/>
          <path d="M6 56 Q6 38 32 38 Q58 38 58 56" stroke={G} strokeWidth={2} strokeLinecap="round" fill={G} fillOpacity="0.08"/>
          <circle cx="50" cy="46" r="11" fill="#FAF7F0"/>
          <circle cx="50" cy="46" r="10" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.16"/>
          <path d="M44 46 L48 50 L56 40" stroke={G} strokeWidth={2.5} {...rp}/>
        </svg>
      ),
    },
  ];

  const SOON_TYPES = [
    {
      label: "Leadership Round",
      icon: (<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M6 50 L6 26 L20 40 L32 8 L44 40 L58 26 L58 50" stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.09"/>
        <rect x="6" y="50" width="52" height="8" rx="2" stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.18"/>
        <circle cx="6" cy="26" r="3.5" stroke={G} strokeWidth="1.5" fill={G} fillOpacity="0.55"/>
        <circle cx="32" cy="8" r="4.5" stroke={G} strokeWidth="1.5" fill={G} fillOpacity="0.55"/>
        <circle cx="58" cy="26" r="3.5" stroke={G} strokeWidth="1.5" fill={G} fillOpacity="0.55"/>
      </svg>),
    },
    {
      label: "Technical Leadership",
      icon: (<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="8" y="10" width="48" height="34" rx="4" stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.07"/>
        <rect x="12" y="14" width="40" height="26" rx="2" stroke={G} strokeWidth={2} {...rp}/>
        <path d="M22 23 L15 27 L22 31" stroke={G} strokeWidth={2} {...rp}/>
        <path d="M42 23 L49 27 L42 31" stroke={G} strokeWidth={2} {...rp}/>
        <line x1="34" y1="20" x2="30" y2="34" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <path d="M29 44 L26 54 L38 54 L35 44" stroke={G} strokeWidth={2} {...rp}/>
        <line x1="22" y1="54" x2="42" y2="54" stroke={G} strokeWidth={2} strokeLinecap="round"/>
      </svg>),
    },
    {
      label: "Case Study",
      icon: (<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M10 8 h24 l12 12 v36 H10 Z" stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.07"/>
        <path d="M34 8 v12 h12" stroke={G} strokeWidth={2} {...rp}/>
        <line x1="16" y1="28" x2="30" y2="28" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <line x1="16" y1="34" x2="28" y2="34" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <circle cx="44" cy="46" r="10" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.10"/>
        <line x1="51" y1="53" x2="57" y2="59" stroke={G} strokeWidth={3} strokeLinecap="round"/>
      </svg>),
    },
    {
      label: "Panel Interview",
      icon: (<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="14" cy="17" r="7" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.08"/>
        <circle cx="32" cy="15" r="8" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.13"/>
        <circle cx="50" cy="17" r="7" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.08"/>
        <rect x="4" y="36" width="56" height="6" rx="2" stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.14"/>
        <circle cx="32" cy="54" r="7" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.07"/>
      </svg>),
    },
    {
      label: "Management",
      icon: (<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <circle cx="32" cy="14" r="9" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.16"/>
        <line x1="32" y1="23" x2="32" y2="34" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <line x1="12" y1="34" x2="52" y2="34" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <line x1="12" y1="34" x2="12" y2="42" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <line x1="32" y1="34" x2="32" y2="42" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <line x1="52" y1="34" x2="52" y2="42" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <circle cx="12" cy="49" r="7" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.08"/>
        <circle cx="32" cy="49" r="7" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.08"/>
        <circle cx="52" cy="49" r="7" stroke={G} strokeWidth={2} fill={G} fillOpacity="0.08"/>
      </svg>),
    },
    {
      label: "Govt / PSU",
      icon: (<svg viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <path d="M8 26 L32 6 L56 26" stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.10"/>
        <circle cx="32" cy="17" r="5" stroke={G} strokeWidth="1.5" fill={G} fillOpacity="0.26"/>
        <circle cx="32" cy="17" r="2" fill={G} fillOpacity="0.60"/>
        <rect x="8" y="26" width="48" height="5" rx="1" stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.10"/>
        <line x1="14" y1="31" x2="14" y2="53" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <line x1="22" y1="31" x2="22" y2="53" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <line x1="32" y1="31" x2="32" y2="53" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <line x1="42" y1="31" x2="42" y2="53" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <line x1="50" y1="31" x2="50" y2="53" stroke={G} strokeWidth={2} strokeLinecap="round"/>
        <rect x="6" y="53" width="52" height="4" rx="1" stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.09"/>
        <rect x="4" y="57" width="56" height="3" rx="1" stroke={G} strokeWidth={2} {...rp} fill={G} fillOpacity="0.06"/>
      </svg>),
    },
  ];

  return (
    <section
      className="mv2-section"
      aria-labelledby="hd-focus"
      style={{ ...sectionBase, background: t.cream }}
    >
      <style>{`
        .hsx-focus-live-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #B45309; display: inline-block; flex-shrink: 0;
          animation: hsx-focus-pulse 2s ease-in-out infinite;
        }
        @keyframes hsx-focus-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.25; }
        }
        @media (prefers-reduced-motion: reduce) {
          .hsx-focus-live-dot { animation: none !important; }
        }
      `}</style>

      {/* Copper gradient — referenced by all icons as url(#hsx-cg) */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute", overflow: "hidden" }}>
        <defs>
          <linearGradient id="hsx-cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#E8C4A0" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>
      </svg>

      <div style={{ ...container }}>
        <SectionMasthead n="03" label="Interview formats" right="10 types · 4 live now" style={{ marginBottom: 44 }} />

        <MotionReveal style={{ textAlign: "center", maxWidth: 860, margin: "0 auto" }}>
          <h2 id="hd-focus" style={{ ...h2, fontSize: 64 }}>
            Walk into any round<br />
            <span style={{ fontStyle: "italic", color: t.copper }}>knowing exactly what it&rsquo;s testing.</span>
          </h2>
        </MotionReveal>

        {/* ── Available now: divider ── */}
        <MotionReveal style={{
          display: "flex", alignItems: "center", gap: 14,
          margin: "56px 0 36px",
        }}>
          <div style={{ flex: 1, height: 1, background: "#EBE5D2" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
            <span className="hsx-focus-live-dot" />
            <span style={{
              fontFamily: fonts.sans, fontSize: 10.5, fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase" as const,
              color: t.copper, whiteSpace: "nowrap" as const,
            }}>Available now</span>
          </div>
          <div style={{ flex: 1, height: 1, background: "#EBE5D2" }} />
        </MotionReveal>

        {/* ── Available now: 4-column icon grid ── */}
        <div
          className="mv2-focus-live-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "0 32px",
          }}
        >
          {LIVE_TYPES.map((type, i) => (
            <MotionReveal
              key={type.label}
              delay={i * 80}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
            >
              <div style={{ width: 80, height: 80, marginBottom: 20 }}>{type.icon}</div>
              <h3 style={{
                fontFamily: fonts.sans, fontSize: 15, fontWeight: 600,
                color: t.coal, margin: "0 0 6px",
                letterSpacing: "-0.015em", lineHeight: 1.3,
              }}>{type.label}</h3>
              <p style={{
                fontFamily: fonts.sans, fontSize: 13,
                color: t.inkSoft, margin: 0, lineHeight: 1.55, maxWidth: 150,
              }}>{type.desc}</p>
            </MotionReveal>
          ))}
        </div>

        {/* ── Coming soon: divider ── */}
        <MotionReveal style={{
          display: "flex", alignItems: "center", gap: 14,
          margin: "52px 0 32px",
        }}>
          <div style={{ flex: 1, height: 1, background: "#EBE5D2" }} />
          <span style={{
            fontFamily: fonts.sans, fontSize: 10.5, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase" as const,
            color: t.inkFaint, whiteSpace: "nowrap" as const,
          }}>Coming soon</span>
          <div style={{ flex: 1, height: 1, background: "#EBE5D2" }} />
        </MotionReveal>

        {/* ── Coming soon: 6-column icon grid (faded) ── */}
        <MotionReveal>
          <div
            className="mv2-focus-soon-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: "0 20px",
              opacity: 0.3,
              filter: "saturate(0.45)",
            }}
          >
            {SOON_TYPES.map((type) => (
              <div
                key={type.label}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}
              >
                <div style={{ width: 60, height: 60, marginBottom: 16 }}>{type.icon}</div>
                <p style={{
                  fontFamily: fonts.sans, fontSize: 13, fontWeight: 600,
                  color: t.coal, margin: 0, lineHeight: 1.3,
                  letterSpacing: "-0.01em",
                }}>{type.label}</p>
              </div>
            ))}
          </div>
        </MotionReveal>

      </div>
    </section>
  );
}

/* ─────────────────────────── 4. 3-STEP PRODUCT STORY ─────────────────────────── */

function CompactStepMock({ step }: { step: number }) {
  const card: CSSProperties = {
    background: t.white,
    border: `1px solid ${t.line}`,
    borderRadius: 16,
    padding: 20,
    boxShadow: shadows.card,
  };
  if (step === 0) {
    return (
      <div style={{ ...card, minHeight: 248 }}>
        <div
          style={{
            padding: 18,
            border: `1.5px dashed ${t.copper}`,
            borderRadius: 12,
            background: t.copperSoft,
            textAlign: "center",
            marginBottom: 14,
          }}
        >
          {/* Document icon — more meaningful than a generic upload arrow */}
          <div
            style={{
              width: 34,
              height: 34,
              margin: "0 auto",
              borderRadius: 8,
              background: t.copper,
              color: t.white,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="13" y2="17" />
            </svg>
          </div>
          <p style={{ fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, color: t.coal, marginTop: 8, marginBottom: 2 }}>Drop your resume</p>
          <p style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkSoft, margin: 0 }}>PDF, DOCX · auto-parsed in 4s</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[["Backend Intern", "6 months"], ["Python, Go, k8s", "Skills"]].map(([a, b]) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", fontFamily: fonts.sans, fontSize: 12, padding: "7px 11px", borderRadius: 7, background: t.cream, border: `1px solid ${t.line}` }}>
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
      <div style={{ ...card, minHeight: 248 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {(
            [
              ["Razorpay", "Backend SDE-2", true],
              ["TCS", "Digital · Fresher", false],
              ["Zomato", "Product Manager", false],
              ["Flipkart", "Data Analyst", false],
            ] as [string, string, boolean][]
          ).map(([co, role, active]) => (
            <div
              key={co}
              style={{
                padding: "9px 11px",
                borderRadius: 10,
                background: active ? t.indigo100 : t.cream,
                border: `1px solid ${active ? t.indigo : t.line}`,
              }}
            >
              <p style={{ fontFamily: fonts.serif, fontSize: 14, color: t.coal, margin: 0 }}>{co}</p>
              <p style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkSoft, marginTop: 2, marginBottom: 0 }}>{role}</p>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Behavioral", "System Design", "Negotiation"].map((r, i) => (
            <span
              key={r}
              style={{
                fontFamily: fonts.sans,
                fontSize: 11,
                fontWeight: 500,
                padding: "5px 10px",
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
        background: t.coal,
        border: `1px solid ${t.creamLineFaint}`,
        borderRadius: 16,
        padding: 24,
        minHeight: 248,
        boxShadow: `0 20px 50px -22px ${t.coalShadow}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.error, boxShadow: `0 0 8px ${t.error}`, flexShrink: 0 }} />
        <span style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 600, color: t.cream, letterSpacing: "0.05em" }}>REC · 03:14</span>
        <span style={{ marginLeft: "auto", opacity: 0.7 }}><Waveform /></span>
      </div>
      <p style={{ fontFamily: fonts.sans, fontSize: 13, color: t.cream, lineHeight: 1.5, margin: "0 0 14px" }}>
        &ldquo;Walk me through how you&apos;d design a UPI fraud detection pipeline.&rdquo;
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
        {(
          [["S", 92], ["T", 78], ["A", 85], ["R", 55]] as [string, number][]
        ).map(([l, v]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: t.creamMuted, width: 10 }}>{l}</span>
            <div style={{ flex: 1, height: 4, background: t.creamLineSoft, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${v}%`, height: "100%", background: t.copper, borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: t.creamMuted, width: 22, textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          padding: "7px 11px",
          background: t.creamSurfaceLow,
          border: `1px solid ${t.creamLineSoft}`,
          borderRadius: 8,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontFamily: fonts.sans, fontSize: 12, color: t.cream }}>
          Score: <span style={{ color: t.copper, fontWeight: 600 }}>8.4 / 10</span>
        </span>
        <span style={{ fontFamily: fonts.mono, fontSize: 10, color: t.success, padding: "2px 7px", background: t.successMist, borderRadius: 5, fontWeight: 600 }}>
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
    <section aria-labelledby="hd-story" className="mv2-section" style={{ ...sectionBase, background: t.cream, paddingTop: 96, paddingBottom: 72 }}>
      <div style={container}>
        <MotionReveal style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 id="hd-story" style={h2}>
            Resume in.{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>Scored answer out.</span>
          </h2>
          <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.inkSoft, margin: "10px 0 0", lineHeight: 1.5 }}>
            From file upload to scored STAR breakdown: under 10 minutes, no prep materials needed.
          </p>
        </MotionReveal>

        {/* 3-column layout — gaps between columns act as dividers */}
        <div
          className="mv2-story-stages"
          style={{ display: "flex", alignItems: "start", gap: 32 }}
        >
          {steps.map((step, i) => (
            <MotionReveal
              key={step.kicker}
              delay={i * 120}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 12,
                      color: t.copper,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                    }}
                  >
                    {step.kicker}
                  </span>
                  <span aria-hidden style={{ flex: 1, height: 1, background: t.line }} />
                </div>
                <h3
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 22,
                    color: t.coal,
                    margin: 0,
                    letterSpacing: "-0.02em",
                    fontWeight: 400,
                    lineHeight: 1.2,
                    textWrap: "balance" as const,
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontFamily: fonts.sans,
                    fontSize: 14,
                    color: t.inkSoft,
                    lineHeight: 1.6,
                    marginTop: 8,
                    marginBottom: 0,
                  }}
                >
                  {step.desc}
                </p>
              </div>
              <CompactStepMock step={i} />
            </MotionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── 5. FEATURE BENTO ─────────────────────────── */

/* Voice Follow-up visual: transcript with a follow-up question surfacing */
/* Shared hook: Intersection Observer that fires once when element enters view.
   Returns a ref to attach and a boolean `inView`. */
function useInViewOnce<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView] as const;
}

/* Shared hook: looping animation driver.
   Calls `runFrame` with the current frame index (0 = reset) on a schedule.
   Only runs while `active` is true. Cleans up on unmount. */
function useBentoLoop(
  active: boolean,
  frames: number[],   /* ms delays from frame 0 */
  loopMs: number,     /* total cycle duration before restart */
  onFrame: (frame: number) => void,
) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!active) return;
    function runCycle() {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      onFrame(0);
      frames.forEach((delay, i) => {
        timers.current.push(setTimeout(() => onFrame(i + 1), delay));
      });
      timers.current.push(setTimeout(runCycle, loopMs));
    }
    runCycle();
    return () => timers.current.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}

/* Reveal transition helper: items snap-to-hidden on reset (frame 0), animate in after */
function revealStyle(visible: boolean, resetting: boolean): CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(8px)",
    transition: resetting ? "none" : "opacity 0.38s cubic-bezier(0.16,1,0.3,1), transform 0.38s cubic-bezier(0.16,1,0.3,1)",
  };
}

/* Resume-aware visual: personalized question chip — staggered reveal */
function ResumeAwareVisual() {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  const [step, setStep] = useState(0);
  const resetting = useRef(false);

  useBentoLoop(inView && !reduced, [200, 950, 1750, 2600], 6600, (frame) => {
    resetting.current = frame === 0;
    setStep(frame);
  });

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={revealStyle(step >= 1, resetting.current)}>
        <div style={{ padding: "10px 12px", background: t.copper100, borderRadius: 8, fontFamily: fonts.sans, fontSize: 12, color: t.copperDark, lineHeight: 1.4 }}>
          <span style={{ fontWeight: 600 }}>From your resume →</span>
          <p style={{ margin: "4px 0 0" }}>Python · Razorpay internship · Final year</p>
        </div>
      </div>
      <div style={revealStyle(step >= 2, resetting.current)}>
        <div style={{ padding: "10px 12px", background: t.white, border: `1px solid ${t.line}`, borderRadius: 8, fontFamily: fonts.sans, fontSize: 12, color: t.coal, lineHeight: 1.4 }}>
          "Walk me through the specific bug you fixed in the Razorpay payment gateway."
        </div>
      </div>
      <div style={revealStyle(step >= 3, resetting.current)}>
        <div style={{ padding: "10px 12px", background: t.indigoMist, borderRadius: 8, fontFamily: fonts.sans, fontSize: 12, color: t.coal, lineHeight: 1.4 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: t.indigo, display: "block", marginBottom: 4 }}>Follow-up</span>
          "What was the transaction volume affected? Did you escalate to senior engineers?"
        </div>
      </div>
      <div style={revealStyle(step >= 4, resetting.current)}>
        <div style={{ padding: "8px 12px", background: t.successMist, border: `1px solid rgba(21,128,61,0.22)`, borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: fonts.mono, fontSize: 10, color: t.success }}>✓</span>
          <span style={{ fontFamily: fonts.sans, fontSize: 11, color: t.success, fontWeight: 600 }}>
            12 questions prepared from your Razorpay internship
          </span>
        </div>
      </div>
    </div>
  );
}

/* Voice follow-up visual: user → typing dots → AI reply → waveform */
function VoiceFollowUpVisual() {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  const [phase, setPhase] = useState(0);
  const resetting = useRef(false);

  /* user(200) → dots(900) → ai-reply(2000) → wave(2900) */
  useBentoLoop(inView && !reduced, [200, 900, 2000, 2900], 5600, (frame) => {
    resetting.current = frame === 0;
    setPhase(frame);
  });

  const row = { padding: "9px 14px", borderBottom: `1px solid ${t.line}` } as const;
  const lbl = { fontSize: 9, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" } as const;

  return (
    <div ref={ref} style={{ background: t.cream, border: `1px solid ${t.line}`, borderRadius: 10, overflow: "hidden", fontFamily: fonts.sans }}>
      <div style={{ ...row, ...revealStyle(phase >= 1, resetting.current) }}>
        <span style={{ ...lbl, color: t.inkFaint }}>YOU</span>
        <p style={{ margin: "3px 0 0", fontSize: 12, color: t.inkSoft, lineHeight: 1.4 }}>
          "I improved comms by setting up weekly syncs…"
        </p>
      </div>
      <div style={{ ...row, background: t.indigoMist, minHeight: 50, ...revealStyle(phase >= 2, resetting.current) }}>
        <span style={{ ...lbl, color: t.indigoGray }}>AI INTERVIEWER</span>
        <div style={{ marginTop: 5, display: "flex", gap: 4, alignItems: "center", height: 13,
          opacity: phase === 2 ? 1 : 0, transition: "opacity 0.18s ease" }}>
          {[0, 130, 260].map(d => (
            <span key={d} style={{ width: 5, height: 5, borderRadius: "50%", background: t.indigo, opacity: 0.6,
              animation: `mv2-dot-bounce 1.1s ${d}ms ease-in-out infinite` }} />
          ))}
        </div>
        <p style={{ margin: "-13px 0 0", fontSize: 12, color: t.coal, fontWeight: 500, lineHeight: 1.4,
          opacity: phase >= 3 ? 1 : 0, transform: phase >= 3 ? "none" : "translateY(4px)",
          transition: resetting.current ? "none" : "opacity 0.28s ease, transform 0.28s cubic-bezier(0.16,1,0.3,1)" }}>
          "What metric did you track to know the syncs were working?"
        </p>
      </div>
      <div style={{ padding: "7px 14px", display: "flex", alignItems: "center", gap: 8,
        ...revealStyle(phase >= 4, resetting.current) }}>
        <Waveform />
        <span style={{ marginLeft: "auto", fontFamily: fonts.mono, fontSize: 10, color: t.success, fontWeight: 600 }}>listening…</span>
      </div>
    </div>
  );
}

/* Salary negotiation visual: slide-in rows + integer counter ₹12→₹14 */
function SalaryNegVisual() {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  const [step, setStep] = useState(0);
  const [counter, setCounter] = useState(12);
  const resetting = useRef(false);
  const counterTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useBentoLoop(inView && !reduced, [200, 1050], 5500, (frame) => {
    resetting.current = frame === 0;
    setStep(frame);
    if (frame === 0) {
      counterTimers.current.forEach(clearTimeout);
      setCounter(12);
    }
    if (frame === 2) {
      /* counter row just appeared showing ₹12 — tick to 14 */
      counterTimers.current.push(setTimeout(() => setCounter(13), 600));
      counterTimers.current.push(setTimeout(() => setCounter(14), 950));
      /* show delta after counter settles */
      counterTimers.current.push(setTimeout(() => setStep(3), 1300));
    }
  });

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ padding: "12px 14px", background: t.cream, border: `1px solid ${t.line}`, borderRadius: 10,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        ...revealStyle(step >= 1, resetting.current) }}>
        <span style={{ fontFamily: fonts.sans, fontSize: 12, color: t.inkSoft }}>HR&apos;s offer</span>
        <span style={{ fontFamily: fonts.mono, fontSize: 16, fontWeight: 700, color: t.coal, fontVariantNumeric: "tabular-nums" }}>₹12 LPA</span>
      </div>
      <div style={{ padding: "12px 14px", background: t.indigoDeep, borderRadius: 10,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        ...revealStyle(step >= 2, resetting.current) }}>
        <span style={{ fontFamily: fonts.sans, fontSize: 12, color: t.creamMuted }}>Your counter</span>
        <span style={{ fontFamily: fonts.mono, fontSize: 16, fontWeight: 700, color: t.copper100, fontVariantNumeric: "tabular-nums" }}>
          ₹{counter} LPA
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, paddingTop: 2,
        ...revealStyle(step >= 3, resetting.current) }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 11, color: t.success, fontWeight: 700 }}>+₹2L/yr</span>
        <span style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkFaint }}>recovered in 4 minutes of practice</span>
      </div>
    </div>
  );
}

/* Bias detector visual: cascading word highlights → slide-up crisp rewrite */
function BiasDetectorVisual() {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  const [marks, setMarks] = useState(0);
  const [showRewrite, setShowRewrite] = useState(false);
  const resetting = useRef(false);

  useBentoLoop(inView && !reduced, [800, 1300, 1800, 2600], 5800, (frame) => {
    resetting.current = frame === 0;
    if (frame === 0) { setMarks(0); setShowRewrite(false); }
    else if (frame <= 3) setMarks(frame);
    else setShowRewrite(true);
  });

  const markStyle = (n: number): CSSProperties => ({
    background: marks >= n ? "rgba(180,83,9,0.14)" : "transparent",
    color: marks >= n ? t.copper : "inherit",
    borderRadius: 3,
    padding: "1px 4px",
    fontWeight: marks >= n ? 600 : "inherit" as CSSProperties["fontWeight"],
    fontStyle: "normal" as const,
    transition: resetting.current ? "none" : "background 0.28s ease, color 0.28s ease",
  });

  return (
    <div ref={ref} style={{ background: t.cream, border: `1px solid ${t.line}`, borderRadius: 10, overflow: "hidden", fontFamily: fonts.sans, fontSize: 13 }}>
      <div style={{ padding: "12px 14px", lineHeight: 1.7, color: t.inkSoft }}>
        {"I "}
        <mark style={markStyle(1)}>basically</mark>
        {" restructured the team and "}
        <mark style={markStyle(2)}>I think</mark>
        {" it "}
        <mark style={markStyle(3)}>probably</mark>
        {" helped…"}
      </div>
      <div style={{
        padding: "10px 14px", background: t.indigoMist, borderTop: `1px solid ${t.line}`,
        display: "flex", alignItems: "baseline", gap: 10,
        opacity: showRewrite ? 1 : 0,
        transform: showRewrite ? "translateY(0)" : "translateY(10px)",
        transition: resetting.current ? "none" : "opacity 0.35s ease, transform 0.4s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: t.indigo, flexShrink: 0 }}>Crisp</span>
        <span style={{ fontSize: 12, color: t.coal, fontWeight: 500, lineHeight: 1.4 }}>
          "I restructured the team. Throughput rose 30% in Q3."
        </span>
      </div>
    </div>
  );
}

/* Thought Bubble visual: sequential bar fills, Q4 dramatic drop, trigger reveal */
function ThoughtBubbleVisual() {
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInViewOnce<HTMLDivElement>();
  /* Start in the "story told" state — bars filled, trigger visible — so the card
     reads immediately before the loop kicks in on scroll. */
  const [bars, setBars] = useState([88, 80, 66, 22]);
  const [showTrigger, setShowTrigger] = useState(true);
  const [q4Dropping, setQ4Dropping] = useState(true);
  const resetting = useRef(false);
  const barTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useBentoLoop(inView && !reduced, [350], 6400, (frame) => {
    resetting.current = frame === 0;
    barTimers.current.forEach(clearTimeout);
    barTimers.current = [];
    if (frame === 0) { setBars([0, 0, 0, 0]); setShowTrigger(false); setQ4Dropping(false); return; }
    /* Stagger Q1-Q3 fills, then Q4 fills then drops */
    barTimers.current.push(setTimeout(() => setBars([88, 0, 0, 0]), 0));
    barTimers.current.push(setTimeout(() => setBars([88, 80, 0, 0]), 450));
    barTimers.current.push(setTimeout(() => setBars([88, 80, 66, 0]), 900));
    barTimers.current.push(setTimeout(() => { setQ4Dropping(false); setBars([88, 80, 66, 72]); }, 1350));
    barTimers.current.push(setTimeout(() => { setQ4Dropping(true);  setBars([88, 80, 66, 22]); }, 1870));
    barTimers.current.push(setTimeout(() => setShowTrigger(true), 2450));
  });

  const BAR_COLORS = [t.success, t.success, t.copper, "#DC2626"];

  return (
    <div ref={ref} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 148 }}>
        {["Q1", "Q2", "Q3", "Q4"].map((q, i) => (
          <div key={q} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, color: t.inkFaintWeak, width: 18, flexShrink: 0 }}>{q}</span>
            <div style={{ flex: 1, height: 10, background: t.line, borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                width: `${bars[i]}%`, height: "100%", background: BAR_COLORS[i], borderRadius: 4,
                transition: resetting.current ? "none"
                  : i === 3 && q4Dropping
                    ? "width 0.22s cubic-bezier(0.6,0,1,1)"
                    : "width 0.45s cubic-bezier(0.16,1,0.3,1)",
              }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{
        flex: 1, padding: "10px 12px",
        background: "rgba(220, 38, 38, 0.09)", border: "1px solid rgba(220, 38, 38, 0.22)", borderRadius: 8,
        opacity: showTrigger ? 1 : 0,
        transform: showTrigger ? "translateY(0)" : "translateY(6px)",
        transition: resetting.current ? "none" : "opacity 0.38s ease, transform 0.38s cubic-bezier(0.16,1,0.3,1)",
      }}>
        <span style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "#DC2626", display: "block", marginBottom: 4 }}>
          Trigger · Q4
        </span>
        <p style={{ fontFamily: fonts.sans, fontSize: 12, color: t.coal, margin: 0, lineHeight: 1.4, fontStyle: "italic" }}>
          "It was a learning experience."
        </p>
        <p style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkSoft, margin: "5px 0 0" }}>
          90 words at Q3 → 6 words. The room shifted here.
        </p>
      </div>
    </div>
  );
}

function BentoCard({
  children,
  large,
  style,
}: {
  children: React.ReactNode;
  large?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={large ? "mv2-bento-large" : "mv2-bento-small"}
      style={{
        padding: large ? 36 : 28,
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: 20,
        boxShadow: shadows.card,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* Compact act-row label embedded inside a card */
export function FeatureGridV2() {
  return (
    <section
      aria-labelledby="hd-features"
      className="mv2-section"
      style={{ position: "relative", background: t.cream, paddingTop: "clamp(20px,3vh,36px)", paddingBottom: "clamp(20px,3vh,36px)" }}
    >
      <div style={container}>
        <MotionReveal style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 id="hd-features" className="mv2-features-h2" style={{ ...h2 }}>
            What practice alone{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>never shows you.</span>
          </h2>
          <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.inkSoft, margin: "10px auto 0", lineHeight: 1.55, maxWidth: 520 }}>
            Your resume. Your voice. The exact moment you lost the room. None of it surfaces in a generic prep sheet.
          </p>
        </MotionReveal>

        {/* Grid fills remaining viewport height: rows grow with available space */}
        <div
          className="mv2-bento-mosaic"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gridTemplateRows: "minmax(0,1fr) minmax(0,1fr) minmax(0,0.78fr)",
            gap: 12,
            height: "calc(100vh - 255px)",
            maxHeight: 660,
          }}
        >
          {/* ── Before: left column, spans all 3 rows ── */}
          <BentoCard large style={{ gridColumn: "1", gridRow: "1 / 4", overflow: "hidden", padding: 18, boxSizing: "border-box" }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: t.copper, marginBottom: 8, display: "block" }}>
              Before · Personalisation
            </span>
            <h3 style={{ fontFamily: fonts.serif, fontSize: 22, color: t.coal, margin: "0 0 14px", letterSpacing: "-0.015em", fontWeight: 400, lineHeight: 1.2 }}>
              Your resume is <em>the question paper.</em>
            </h3>
            <div aria-hidden="true" style={{ overflow: "hidden" }}>
              <ResumeAwareVisual />
            </div>
          </BentoCard>

          {/* ── During: Voice follow-up — wide top strip ── */}
          <BentoCard large style={{ gridColumn: "2 / 4", gridRow: "1", overflow: "hidden", padding: 18, boxSizing: "border-box" }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: t.copper, marginBottom: 8, display: "block" }}>
              During · Real Conversation
            </span>
            <h3 style={{ fontFamily: fonts.serif, fontSize: 20, color: t.coal, margin: "0 0 12px", letterSpacing: "-0.01em", fontWeight: 400, lineHeight: 1.2 }}>
              Vague answer?{" "}
              <span style={{ color: t.copper, fontStyle: "italic" }}>It asks again. Harder.</span>
            </h3>
            <div aria-hidden="true" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <VoiceFollowUpVisual />
            </div>
          </BentoCard>

          {/* ── During: Salary negotiation — middle left ── */}
          <BentoCard large style={{ gridColumn: "2", gridRow: "2", background: t.indigoDeep, border: "none", overflow: "hidden", padding: 18, boxSizing: "border-box" }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: t.copper100, marginBottom: 8, display: "block" }}>
              During · Salary Negotiation
            </span>
            <h3 style={{ fontFamily: fonts.serif, fontSize: 18, color: t.cream, margin: "0 0 12px", letterSpacing: "-0.01em", fontWeight: 400, lineHeight: 1.2 }}>
              You left{" "}
              <span style={{ color: t.copper100, fontStyle: "italic" }}>₹2L on the table.</span>{" "}
              Practice changing that.
            </h3>
            <div aria-hidden="true" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <SalaryNegVisual />
            </div>
          </BentoCard>

          {/* ── After: Filler Words — middle right ── */}
          <BentoCard style={{ gridColumn: "3", gridRow: "2", overflow: "hidden", padding: 18, boxSizing: "border-box" }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: t.copper, marginBottom: 8, display: "block" }}>
              After · Filler Words
            </span>
            <h3 style={{ fontFamily: fonts.serif, fontSize: 18, color: t.coal, margin: "0 0 12px", letterSpacing: "-0.01em", fontWeight: 400, lineHeight: 1.25 }}>
              You said <em>&ldquo;basically&rdquo;</em> 9 times.
            </h3>
            <div aria-hidden="true" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <BiasDetectorVisual />
            </div>
          </BentoCard>

          {/* ── After: Engagement Drop — wide bottom strip ── */}
          <BentoCard style={{ gridColumn: "2 / 4", gridRow: "3", overflow: "hidden", padding: 18, boxSizing: "border-box" }}>
            <span style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: t.copper, marginBottom: 8, display: "block" }}>
              After · Engagement Drop
            </span>
            <h3 style={{ fontFamily: fonts.serif, fontSize: 18, color: t.coal, margin: "0 0 10px", letterSpacing: "-0.01em", fontWeight: 400, lineHeight: 1.25 }}>
              The exact answer <em>that lost the room.</em>
            </h3>
            <div aria-hidden="true" style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <ThoughtBubbleVisual />
            </div>
          </BentoCard>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── COMPARISON ─────────────────────────── */
export function ComparisonV2() {
  const COAL_BG = t.coal;
  const mono = fonts.mono;

  const STAR = [
    { label: "Situation", pass: true,  note: "stated clearly" },
    { label: "Task",      pass: false, note: "context missing" },
    { label: "Action",    pass: false, note: "3 steps, 2 explained" },
    { label: "Result",    pass: false, note: "no number, no baseline" },
  ] as const;

  return (
    <section
      aria-labelledby="hd-comparison"
      className="mv2-cv-auto"
      style={{ background: t.cream, padding: "96px 24px 110px", display: "flex", flexDirection: "column", alignItems: "center" }}
    >
      {/* Headline */}
      <h2
        id="hd-comparison"
        className="mv2-reveal"
        style={{
          fontFamily: fonts.serif,
          fontSize: "clamp(36px, 5vw, 58px)",
          fontWeight: 400,
          color: t.coal,
          margin: "0 0 20px",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          textAlign: "center",
          maxWidth: 760,
        }}
      >
        Other tools give you a question.
        <br />
        HireStepX tells you where you lost the panel.
      </h2>

      {/* Subhead */}
      <p style={{
        fontFamily: fonts.sans,
        fontSize: 16,
        lineHeight: 1.65,
        color: t.inkSoft,
        textAlign: "center",
        maxWidth: 520,
        margin: "0 0 60px",
      }}>
        A senior&rsquo;s mock is hard to arrange. Scripted AI agrees with everything.
        Neither scores you against the rubric the HR panel actually uses.
      </p>

      {/* Three cards — 3-col grid on desktop, 2-col on tablet (HireStepX full-width), 1-col on phone */}
      <div
        className="mv2-cmp-cards"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 20,
          width: "100%",
          maxWidth: 1120,
        }}
      >

        {/* Card 1 — Senior mock */}
        <div style={{
          background: t.white,
          border: `1px solid ${t.line}`,
          borderRadius: 16,
          padding: "28px 28px 32px",
          display: "flex",
          flexDirection: "column",
        }}>
          <span style={{
            fontFamily: fonts.sans, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase" as const,
            color: t.inkFaint, marginBottom: 20, display: "block",
          }}>Mock with a senior</span>

          <div style={{ marginBottom: 24, flex: 1 }}>
            <span style={{
              fontFamily: fonts.sans, fontSize: 10, fontWeight: 600,
              letterSpacing: "0.10em", textTransform: "uppercase" as const,
              color: t.inkFaint, display: "block", marginBottom: 10,
            }}>What it said</span>
            <p style={{ fontFamily: fonts.serif, fontSize: 20, lineHeight: 1.45, color: t.inkSoft, margin: 0, fontStyle: "italic" }}>
              &ldquo;That was pretty good. Work on your communication a bit.&rdquo;
            </p>
          </div>

          <div style={{ height: "0.5px", background: t.line, marginBottom: 24 }} />

          <div>
            <span style={{
              fontFamily: fonts.sans, fontSize: 10, fontWeight: 600,
              letterSpacing: "0.10em", textTransform: "uppercase" as const,
              color: t.copper, display: "block", marginBottom: 10,
            }}>What you needed</span>
            <p style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 1.6, color: t.inkSoft, margin: 0 }}>
              Q3: You dropped the STAR structure and never recovered the impact statement.
              The interviewer has no idea what the business outcome was.
            </p>
          </div>
        </div>

        {/* Card 2 — AI chatbot */}
        <div style={{
          background: t.white,
          border: `1px solid ${t.line}`,
          borderRadius: 16,
          padding: "28px 28px 32px",
          display: "flex",
          flexDirection: "column",
        }}>
          <span style={{
            fontFamily: fonts.sans, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase" as const,
            color: t.inkFaint, marginBottom: 20, display: "block",
          }}>Any AI chatbot</span>

          <div style={{ marginBottom: 24, flex: 1 }}>
            <span style={{
              fontFamily: fonts.sans, fontSize: 10, fontWeight: 600,
              letterSpacing: "0.10em", textTransform: "uppercase" as const,
              color: t.inkFaint, display: "block", marginBottom: 10,
            }}>What it said</span>
            <p style={{ fontFamily: fonts.serif, fontSize: 20, lineHeight: 1.45, color: t.inkSoft, margin: 0, fontStyle: "italic" }}>
              &ldquo;Excellent response! 9/10. You&rsquo;re ready for this interview.&rdquo;
            </p>
          </div>

          <div style={{ height: "0.5px", background: t.line, marginBottom: 24 }} />

          <div>
            <span style={{
              fontFamily: fonts.sans, fontSize: 10, fontWeight: 600,
              letterSpacing: "0.10em", textTransform: "uppercase" as const,
              color: t.copper, display: "block", marginBottom: 10,
            }}>What you needed</span>
            <p style={{ fontFamily: fonts.sans, fontSize: 14, lineHeight: 1.6, color: t.inkSoft, margin: 0 }}>
              You gave the same answer to Q2 and Q4. The AI didn&rsquo;t catch it.
              A real panel would have. That&rsquo;s a red flag for shortlisting.
            </p>
          </div>
        </div>

        {/* Card 3 — HireStepX (coal, STAR report) */}
        <div
          className="mv2-cmp-hsx"
          style={{
            background: COAL_BG,
            borderRadius: 16,
            padding: "28px 28px 32px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 16px 48px rgba(14,12,8,0.22), 0 4px 16px rgba(14,12,8,0.14)",
          }}
        >
          <span style={{
            fontFamily: fonts.sans, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.14em", textTransform: "uppercase" as const,
            color: t.copper, marginBottom: 20, display: "block",
          }}>HireStepX</span>

          {/* Report panel */}
          <div style={{
            background: "rgba(254,252,248,0.05)",
            borderRadius: 10,
            padding: "20px 20px 22px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}>
            {/* Q label */}
            <span style={{
              fontFamily: mono, fontSize: 10, fontWeight: 400,
              color: "rgba(254,252,248,0.4)", letterSpacing: "0.08em",
              textTransform: "uppercase" as const, display: "block", marginBottom: 16,
            }}>
              Q3 — Behaviour question
            </span>

            {/* Score row */}
            <div style={{
              display: "flex", alignItems: "baseline", justifyContent: "space-between",
              marginBottom: 16, paddingBottom: 16,
              borderBottom: "0.5px solid rgba(254,252,248,0.1)",
            }}>
              <span style={{ fontFamily: mono, fontSize: 12, color: "rgba(254,252,248,0.45)", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Score</span>
              <span style={{ fontFamily: fonts.serif, fontSize: 28, color: t.copper, fontStyle: "italic", lineHeight: 1 }}>
                4 <span style={{ fontSize: 16, color: "rgba(254,252,248,0.3)" }}>/ 10</span>
              </span>
            </div>

            {/* STAR breakdown */}
            {STAR.map(({ label, pass, note }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: pass ? "#6EBF8B" : "rgba(254,252,248,0.25)", width: 14, flexShrink: 0 }}>
                  {pass ? "✓" : "✗"}
                </span>
                <span style={{ fontFamily: mono, fontSize: 11, color: "rgba(254,252,248,0.55)", width: 64, flexShrink: 0 }}>
                  {label}
                </span>
                <span style={{ fontFamily: mono, fontSize: 11, color: pass ? "rgba(254,252,248,0.55)" : "rgba(254,252,248,0.4)" }}>
                  {note}
                </span>
              </div>
            ))}

            {/* Fix */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid rgba(254,252,248,0.1)" }}>
              <span style={{
                fontFamily: mono, fontSize: 10, color: t.copper,
                display: "block", marginBottom: 6,
                textTransform: "uppercase" as const, letterSpacing: "0.08em",
              }}>Fix</span>
              <span style={{ fontFamily: mono, fontSize: 12, lineHeight: 1.55, color: t.white }}>
                Add &ldquo;...which cut onboarding time by 40%&rdquo; after step 3.
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* CTA */}
      <div style={{ marginTop: 44 }}>
        <a
          href="/signup"
          className="mv2-cta-primary"
          style={{
            fontFamily: fonts.sans, fontSize: 15, fontWeight: 600,
            color: t.white, background: t.coal,
            padding: "14px 30px", borderRadius: 999,
            textDecoration: "none",
            display: "inline-flex", alignItems: "center", gap: 8,
            letterSpacing: "-0.01em",
          }}
        >
          Start free, no card needed
          <span className="mv2-cta-arrow" aria-hidden="true" style={{ fontSize: 16 }}>→</span>
        </a>
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

          {/* Cross-links to pillar pages — signals topical authority to Google */}
          <div style={{ display: "flex", gap: 16, marginTop: 32, flexWrap: "wrap" }}>
            <a
              href="/questions"
              className="mv2-dark-link"
              style={{
                fontFamily: fonts.sans, fontSize: 13, fontWeight: 600,
                color: t.cream, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 6,
                borderBottom: `1px solid ${t.creamLine}`,
                paddingBottom: 2,
              }}
            >
              Browse practice questions <span className="mv2-dark-arrow" aria-hidden>→</span>
            </a>
            <a
              href="/salary"
              className="mv2-dark-link"
              style={{
                fontFamily: fonts.sans, fontSize: 13, fontWeight: 600,
                color: t.cream, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 6,
                borderBottom: `1px solid ${t.creamLine}`,
                paddingBottom: 2,
              }}
            >
              Salary guides India <span className="mv2-dark-arrow" aria-hidden>→</span>
            </a>
            <a
              href="/for-students"
              className="mv2-dark-link"
              style={{
                fontFamily: fonts.sans, fontSize: 13, fontWeight: 600,
                color: t.copper100, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 6,
                borderBottom: `1px solid ${t.creamLine}`,
                paddingBottom: 2,
              }}
            >
              Campus placement guide <span className="mv2-dark-arrow" aria-hidden>→</span>
            </a>
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
        <MotionReveal style={{ textAlign: "center", marginBottom: 48, maxWidth: 760, marginLeft: "auto", marginRight: "auto" }}>
          <h2 id="hd-why" style={{ ...h2, textWrap: "balance" as const }}>
            The interview help{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>nobody made for you.</span>
          </h2>
          <p style={{ ...body, marginTop: 16 }}>
            Three objections. Three answers. Skip to the one that sounds like you.
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
  /* Per-session quantity picker — mirrors the dashboard upgrade modal slider */
  const [singleQty, setSingleQty] = useState(1);
  const SINGLE_PRICE = 9;
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
        "2 mock sessions",
        "Behavioral rounds + basic STAR score",
        "Full scored report after each session",
      ],
      cta: "Start free",
      href: "/signup?plan=free",
      featured: false,
    },
    {
      name: "Per session",
      price: "₹9",
      unit: "/ session",
      sub: "No subscription · credits never expire",
      features: [
        "Buy 1–10 sessions at ₹9 each",
        "Voice in & out, all round types",
        "Full STAR score + report",
        "Company-specific rounds",
      ],
      cta: "Buy sessions",
      href: "/signup?plan=single",
      featured: false,
    },
    {
      name: "Sprint Pack",
      price: "₹39",
      compareAt: "₹45",
      unit: "/ 5 sessions",
      sub: "Prep for your next interview",
      features: [
        "5 sessions · 30-day validity",
        "Voice in & out, all round types",
        "Company-specific rounds",
        "Skill-decay tracking",
      ],
      cta: "Get Sprint Pack",
      href: "/signup?plan=weekly",
      featured: true,
    },
    // Monthly plan temporarily hidden — re-enable by removing hidden:true
    // { name: "Monthly", price: "₹149", unit: "/ 30 days", sub: "Most loved during placement season",
    //   features: ["40 sessions · 30 days", "Everything in Weekly", "Interview calendar + countdown",
    //     "Performance analytics & trends", "Export PDF, CSV, JSON", "Priority coach feedback"],
    //   cta: "Go monthly", href: "/signup?plan=monthly", featured: true },
  ];
  return (
    <section ref={sectionRef} className="mv2-section" aria-labelledby="hd-pricing" style={{ ...sectionBase, background: t.creamSoft, borderTop: `1px solid ${t.line}` }}>
      <div className="mv2-container" style={container}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <MotionReveal>
            <SectionMasthead n="07" label="Pricing" right="From ₹9 / session" style={{ marginBottom: 16 }} />
          </MotionReveal>
          <MotionReveal delay={80}>
            <h2 id="hd-pricing" style={h2}>
              Costs less than{" "}
              <span style={{ fontStyle: "italic", color: t.copper }}>one chai a day.</span>
            </h2>
          </MotionReveal>
          <MotionReveal delay={160}>
            <p style={{ ...body, fontSize: 16, fontWeight: 400, color: t.inkSoft, margin: "16px auto 0", textAlign: "center" }}>
              Pay when a round is coming. Stop when you&apos;re ready. No subscription, no monthly guilt.
            </p>
          </MotionReveal>
        </div>
        {/* Cards — each card gets its own MotionReveal so they cascade
            left-to-right (0 / 110 / 220 ms) instead of popping in together */}
        {/* paddingTop reserves space for the "Most loved" chip (position:absolute, top:-12)
            so it doesn't clip against the section background. Cards align flush. */}
        <div
          className="mv2-pricing-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            alignItems: "stretch",
            paddingTop: 20,
          }}
        >
          {tiers.map((tier, i) => (
            <MotionReveal
              key={tier.name}
              delay={i * 110}
              className="mv2-price-card"
              style={{
                position: "relative",
                padding: 32,
                background: tier.featured ? t.coal : t.white,
                color: tier.featured ? t.cream : t.coal,
                border: `1px solid ${tier.featured ? t.coal : t.line}`,
                borderRadius: 20,
                boxShadow: tier.featured ? shadows.featured : shadows.card,
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
                {"compareAt" in tier && tier.compareAt && (
                  <p style={{ margin: "6px 0 0", fontFamily: fonts.sans, fontSize: 13, color: tier.featured ? t.creamFaded : t.inkSoft, textDecoration: "line-through" }}>
                    {tier.compareAt}
                  </p>
                )}
                <p
                  style={{
                    margin: "compareAt" in tier && tier.compareAt ? "2px 0 0" : "10px 0 0",
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
              {/* Quantity picker — only on the Per Session card */}
              {tier.price === "₹9" && (
                <>
                  <style>{`
                    .pricing-session-slider{-webkit-appearance:none;appearance:none;width:100%;height:18px;background:transparent;outline:none;cursor:pointer;}
                    .pricing-session-slider::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:linear-gradient(to right,#B45309 0%,#B45309 var(--fill,0%),#EBE5D2 var(--fill,0%),#EBE5D2 100%);}
                    .pricing-session-slider::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#B45309;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.18);cursor:pointer;margin-top:-7.5px;}
                    .pricing-session-slider::-moz-range-track{height:3px;border-radius:2px;background:linear-gradient(to right,#B45309 0%,#B45309 var(--fill,0%),#EBE5D2 var(--fill,0%),#EBE5D2 100%);}
                    .pricing-session-slider::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:#B45309;border:2.5px solid #fff;cursor:pointer;box-sizing:border-box;}
                    .pricing-session-slider:focus-visible::-webkit-slider-thumb{outline:2px solid #B45309;outline-offset:2px;}
                  `}</style>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: t.inkSoft }}>How many?</span>
                      <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.copper, fontWeight: 600 }}>₹{SINGLE_PRICE * singleQty} total</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <button
                        onClick={() => setSingleQty(q => Math.max(1, q - 1))}
                        disabled={singleQty <= 1}
                        aria-label="Remove one session"
                        style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, border: `1.5px solid ${singleQty <= 1 ? t.line : t.lineStrong}`, background: "transparent", color: singleQty <= 1 ? t.inkFaint : t.coal, cursor: singleQty <= 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 300, opacity: singleQty <= 1 ? 0.3 : 1, transition: "opacity 0.15s" }}
                      >−</button>
                      <input
                        type="range" min={1} max={10} step={1}
                        value={singleQty}
                        onChange={e => setSingleQty(Number(e.target.value))}
                        aria-label="Number of sessions"
                        aria-valuenow={singleQty} aria-valuemin={1} aria-valuemax={10}
                        className="pricing-session-slider"
                        style={{ flex: 1, "--fill": `${((singleQty - 1) / 9) * 100}%` } as React.CSSProperties}
                      />
                      <button
                        onClick={() => setSingleQty(q => Math.min(10, q + 1))}
                        disabled={singleQty >= 10}
                        aria-label="Add one session"
                        style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, border: `1.5px solid ${singleQty >= 10 ? t.line : t.copper}`, background: singleQty >= 10 ? "transparent" : "rgba(180,83,9,0.08)", color: singleQty >= 10 ? t.inkFaint : t.copper, cursor: singleQty >= 10 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 300, opacity: singleQty >= 10 ? 0.3 : 1, transition: "opacity 0.15s, border-color 0.15s, background 0.15s" }}
                      >+</button>
                    </div>
                    <p style={{ margin: 0, fontFamily: fonts.sans, fontSize: 12, color: t.inkFaint, textAlign: "center" }}>
                      {singleQty === 1 ? "1 session" : `${singleQty} sessions`}
                      {singleQty >= 10 && <span style={{ color: t.copper }}> · max per order</span>}
                    </p>
                  </div>
                </>
              )}

              {/* CTA hierarchy:
                  Free        → ghost/outline — discovery tier, lowest weight
                  Per Session → indigo filled — transactional, mid-weight
                  Weekly      → cream on coal — primary conversion driver */}
              <a
                href={tier.price === "₹9" ? `${tier.href}&qty=${singleQty}` : tier.href}
                className="mv2-tap-44 mv2-pricing-cta"
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
                  color: tier.featured ? t.coal : tier.price === "₹0" ? t.coal : t.cream,
                  background: tier.featured ? t.cream : tier.price === "₹0" ? "transparent" : t.copper,
                  border: !tier.featured && tier.price === "₹0" ? `1px solid ${t.line}` : "none",
                  boxShadow: tier.featured || tier.price === "₹0" ? "none" : shadows.cta,
                }}
              >
                {tier.price === "₹9"
                  ? <>{singleQty === 1 ? "Buy 1 session" : `Buy ${singleQty} sessions`} · ₹{SINGLE_PRICE * singleQty} <span style={{ fontSize: 16 }}>→</span></>
                  : <>{tier.cta} <span style={{ fontSize: 16 }}>→</span></>
                }
              </a>
            </MotionReveal>
          ))}
        </div>

        {/* Trust anchors — copper palette matches the section; green success
            tokens were off-brand here. Third badge surfaces the payment
            methods already called out in the section sub-copy above. */}
        <MotionReveal delay={350}>
        <div
          style={{
            marginTop: 36,
            display: "flex",
            justifyContent: "center",
            gap: 28,
            flexWrap: "wrap",
            fontFamily: fonts.sans,
            fontSize: 13,
            color: t.inkSoft,
          }}
        >
          {[
            "2 free sessions, no card needed",
            "₹9 sessions never expire",
            "Cancel Sprint Pack any time · UPI · cards",
          ].map((v) => (
            <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span
                aria-hidden
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: t.copper100,
                  color: t.copper,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ✓
              </span>
              {v}
            </span>
          ))}
        </div>
        </MotionReveal>
      </div>
    </section>
  );
}

/* ─────────────────────────── 6f. FAQ ─────────────────────────── */
export function FAQV2() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const qs: Array<{ q: string; a: string }> = [
    {
      q: "What exactly is free? Do I need a card to start?",
      a: "2 sessions completely free: no account needed, no card required. You get the full voice interview and the full scored report both times. After that, ₹9 per session with no expiry, or ₹39 for a Sprint Pack of 5 sessions that renews monthly. Cancel the Sprint Pack any time before the next cycle.",
    },
    {
      q: "Will the AI understand my Indian English accent?",
      a: "Yes, built specifically for Indian English. Our voice model is trained on Indian speech patterns, including regional accents. If you can speak to a real interviewer, you can speak to HireStepX.",
    },
    {
      q: "Is ₹9 per session really it? What's the catch?",
      a: "That's the real price. ₹9 per session with no expiry: buy one, use it whenever. Or get the Sprint Pack: 5 sessions for ₹39, renews monthly, cancel any time before the next cycle. Built on Indian infrastructure at Indian costs. No hidden charges either way.",
    },
    {
      q: "Will my current company know I'm practicing?",
      a: "No. HireStepX is completely private. We don't connect to LinkedIn, your employer, or your target company. Nothing you practice here is visible to anyone but you.",
    },
    {
      q: "How long does a session take?",
      a: "18 minutes on average: one focused interview topic, real-time scoring, full report ready immediately after. You don't need an afternoon. You need 20 minutes and headphones.",
    },
    {
      q: "Does this work on mobile?",
      a: "Yes. Works on any modern Chrome or Safari: phone, tablet, laptop. Optimised for Realme and Redmi-class Android on Indian 4G. No downloads, no app installs.",
    },
    {
      q: "What if I cancel? Do I lose my reports?",
      a: "Your reports are yours. We keep them for 90 days after cancellation so you can export or reference them before your next interview. Nothing gets deleted without warning.",
    },
    {
      q: "Do you share my data with my employer or target company?",
      a: "Never. Your resume, voice, and practice answers are not shared with your current employer, your target company, or any third party. Encrypted end to end. DPDPA 2023 compliant.",
    },
    {
      q: "How is this different from just asking ChatGPT?",
      a: "ChatGPT agrees with you. HireStepX disagrees — constructively. It scores your answer on the STAR framework, names which beat is weak, and gives you a coached model answer. You also speak out loud (voice in and out) instead of typing, so you practise the actual skill. ChatGPT has no Indian company rubrics, no role-specific question bank, and no score you can track across sessions.",
    },
  ];
  return (
    <section
      id="faq"
      className="mv2-section"
      aria-labelledby="hd-faq"
      style={{ ...sectionBase, background: t.creamSoft, borderTop: `1px solid ${t.line}` }}
    >
      <div className="mv2-container" style={container}>
        <MotionReveal style={{ textAlign: "center", marginBottom: 48 }}>
          <SectionMasthead n="09" label="FAQ" right="Asked & answered" style={{ marginBottom: 16 }} />
          <h2 id="hd-faq" style={h2}>
            Things you'd ask{" "}
            <span style={{ fontStyle: "italic", color: t.copper }}>before paying.</span>
          </h2>
        </MotionReveal>

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
          {qs.map(({ q, a }, i) => (
            <details
              key={q}
              className="mv2p-faq"
              open={openIdx === i}
              onToggle={(e) => {
                // Prevent the browser's native toggle so React state is the source of truth.
                // Without this the browser and React state diverge when another item opens.
                e.preventDefault();
              }}
              style={{
                borderTop: i === 0 ? "none" : `1px solid ${t.line}`,
                padding: "20px 24px",
              }}
            >
              <summary
                onClick={(e) => {
                  e.preventDefault();
                  // Toggle this item; close it if already open (allow collapse).
                  setOpenIdx((prev) => (prev === i ? null : i));
                }}
                style={{
                  cursor: "pointer",
                  fontFamily: fonts.serif,
                  fontSize: 18,
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

/* ─────────────────────────── 7. FINAL CTA + FOOTER ─────────────────────────── */
/* FinalCTAFooterV2 now points to FooterDome (imported at the top of this file). */

/* ─────────────────────────── STRUCTURED DATA (JSON-LD) ─────────────────────────── */
function StructuredData() {
  const faqs = [
    ["What exactly is free? Do I need a card to start?", "2 sessions completely free: no account needed, no card required. After that, ₹9 per session with no expiry, or ₹39 for a Sprint Pack of 5 sessions that renews monthly. Cancel any time before the next cycle."],
    ["Will the AI understand my Indian English accent?", "Yes, built specifically for Indian English. Our voice model is trained on Indian speech patterns, including regional accents. If you can speak to a real interviewer, you can speak to HireStepX."],
    ["Is ₹9 per session really it? What's the catch?", "That's the real price. ₹9 per session with no expiry: buy one, use it whenever. Or get the Sprint Pack: 5 sessions for ₹39, renews monthly, cancel any time before the next cycle. No hidden charges either way."],
    ["Will my current company know I'm practicing?", "No. HireStepX is completely private. We don't connect to LinkedIn, your employer, or your target company. Nothing you practice here is visible to anyone but you."],
    ["How long does a session take?", "18 minutes on average: one focused interview topic, real-time scoring, full report ready immediately after."],
    ["Does this work on mobile?", "Yes. Works on any modern Chrome or Safari: phone, tablet, laptop. Optimised for Realme and Redmi-class Android on Indian 4G. No downloads, no app installs."],
    ["What if I cancel? Do I lose my reports?", "Your reports are yours for 90 days after cancellation so you can export or reference them before your next interview. Nothing gets deleted without warning."],
    ["Do you share my data with my employer or target company?", "Never. Your resume, voice, and practice answers are not shared with your current employer, your target company, or any third party. Encrypted end to end. DPDPA 2023 compliant."],
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
  .mv2-rpt-h2 { letter-spacing: -1px !important; }
  .mv2-rpt-showcase { height: 440px !important; }
}
`;

/* Module-level constants — avoid recomputing these on every render */
const RV = "transform 0.72s cubic-bezier(0.16,1,0.3,1), opacity 0.55s ease";
const TR = "transform 0.50s cubic-bezier(0.16,1,0.3,1), opacity 0.38s ease, filter 0.50s ease";

/* ─── Card: Behavioral — left ── (exact canvas copy) */
function RPT_InterviewCard({ lifted, revealed, baseDelay = 0 }: { lifted?: boolean; revealed?: boolean; baseDelay?: number }) {
  const star = [
    { key: "S", label: "Situation",  score: 88, c: t.success },
    { key: "T", label: "Task",       score: 88, c: t.success },
    { key: "A", label: "Action",     score: 71, c: t.copper },
    { key: "R", label: "Result",     score: 42, c: t.error },
  ];
  const rptF = { sans: "'Satoshi', system-ui, -apple-system, sans-serif", serif: "'Instrument Serif', Georgia, serif", mono: "'JetBrains Mono', 'Fira Code', monospace" };
  /* Arc length for 82% of a semicircle: π × r × 0.82 = π × 33 × 0.82 ≈ 85 */
  const arcLen = 85;
  return (
    <div style={{ width: 460, background: "#FEFDF8", borderRadius: 16, border: "1px solid rgba(180,83,9,0.08)", boxShadow: lifted ? "0 32px 96px rgba(14,12,8,0.28), 0 8px 24px rgba(14,12,8,0.12)" : "0 8px 48px rgba(14,12,8,0.12), 0 2px 8px rgba(14,12,8,0.06)", overflow: "hidden", fontFamily: rptF.sans, transition: "box-shadow 0.50s ease" }}>
      <div style={{ background: t.cream, padding: "9px 16px", borderBottom: "1px solid #EAE3D0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6, color: t.inkSoft }}>READINESS</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: t.success }}>68%</span>
        <span style={{ fontSize: 8, color: t.inkSoft }}>Razorpay Senior PD · ~3 sessions to close gap</span>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "14px 16px 12px" }}>
        <div style={{ width: 124, flexShrink: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: t.inkSoft, marginBottom: 6 }}>OVERALL SCORE</div>
          <div style={{ position: "relative", width: 84, height: 52, margin: "0 auto 8px" }}>
            <svg viewBox="0 0 80 50" width="84" height="52">
              <path d="M7,46 A33,33 0 0,1 73,46" fill="none" stroke="#E8E0D0" strokeWidth="7" strokeLinecap="round" />
              <path d="M7,46 A33,33 0 0,1 68,28" fill="none" stroke={t.success} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={arcLen} strokeDashoffset={revealed ? 0 : arcLen}
                style={{ transition: `stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1) ${baseDelay + 200}ms` }} />
            </svg>
            <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontSize: 22, fontWeight: 800, color: t.coal, lineHeight: 1 }}>82</div>
            <div style={{ position: "absolute", bottom: -4, left: 0, right: 0, textAlign: "center", fontSize: 7.5, color: t.inkFaintWeak }}>/ 100</div>
          </div>
          <span style={{ fontSize: 7.5, background: t.success100, color: t.success, padding: "2px 7px", borderRadius: 3, fontWeight: 600 }}>Hire ✓</span>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="28" height="12" viewBox="0 0 28 12"><polyline points="0,10 5,7 10,9 16,4 22,6 28,2" fill="none" stroke={t.success} strokeWidth="1.2" /></svg>
            <span style={{ fontSize: 9, color: t.success, fontWeight: 700 }}>↑ 6</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.4, color: t.copper, marginBottom: 5 }}>✦ AI INTERVIEW VERDICT</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: t.coal, lineHeight: 1.5, marginBottom: 9 }}>Specific, owned, outcome-anchored. Tighten the Q2 "we" usage — then you're ready for the bar-raiser.</div>
          <div style={{ fontSize: 7.5, background: "#F3EFE5", padding: "4px 8px", borderRadius: 3, color: t.inkSoft }}>
            Calibrated to Senior · Strong ≥ 85 · Hire ≥ 70 · Lean ≥ 55
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #EAE3D0", padding: "10px 16px 6px", background: "#FEFDF8" }}>
        <span style={{ fontSize: 8, background: t.indigo100, color: t.indigo, padding: "3px 9px", borderRadius: 20, fontWeight: 600 }}>BEHAVIORAL INTERVIEW · FULL REPORT</span>
      </div>
      <div style={{ padding: "8px 16px 10px" }}>
        {star.map((s, i) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: s.c, color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: rptF.mono }}>{s.key}</span>
            <span style={{ fontSize: 8.5, color: "#4A4540", width: 52, flexShrink: 0 }}>{s.label}</span>
            <div style={{ flex: 1, height: 4, background: t.line, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: revealed ? `${s.score}%` : "0%", background: s.c, borderRadius: 2, transition: `width 0.7s cubic-bezier(0.16,1,0.3,1) ${baseDelay + 400 + i * 80}ms` }} />
            </div>
            <span style={{ fontSize: 8.5, fontWeight: 700, color: s.c, fontFamily: rptF.mono, width: 20, textAlign: "right", flexShrink: 0 }}>{s.score}</span>
          </div>
        ))}
      </div>
      <div style={{ margin: "0 16px", background: t.indigo, borderRadius: 6, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 8, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "2px 7px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>PART 2 OF 4</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}>AI coached model answer</div>
          <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.65)" }}>See exactly how a Strong Hire would answer Q2.</div>
        </div>
      </div>
      <div style={{ padding: "10px 16px 14px" }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: t.copper, letterSpacing: 0.4, marginBottom: 6 }}>✦ MODEL ANSWER EXCERPT</div>
        <div style={{ fontSize: 9, color: "#4A4540", lineHeight: 1.6, background: "#F3EFE5", borderRadius: 5, padding: "8px 10px", borderLeft: `2px solid ${t.copper}` }}>
          {"Instead of 'we reduced latency,' say: "}
          <span style={{ fontStyle: "italic", color: t.coal }}>{"I led the caching rewrite — my call to switch to Redis cut p99 from 420ms to 38ms, unblocking the iOS team."}</span>
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
  const rptF = { sans: "'Satoshi', system-ui, -apple-system, sans-serif", serif: "'Instrument Serif', Georgia, serif" };
  /* Arc length for 84% of a semicircle: π × r × 0.84 = π × 37 × 0.84 ≈ 98 */
  const arcLen = 98;
  return (
    <div className="mv2-rpt-center-card" style={{ width: 520, background: "#FEFDF8", borderRadius: 18, border: "1.5px solid rgba(180,83,9,0.08)", boxShadow: lifted ? "0 56px 160px rgba(14,12,8,0.34), 0 16px 48px rgba(14,12,8,0.16)" : "0 48px 140px rgba(14,12,8,0.26), 0 12px 40px rgba(14,12,8,0.12)", overflow: "hidden", fontFamily: rptF.sans, transition: "box-shadow 0.50s ease" }}>
      <div style={{ background: t.cream, padding: "10px 18px", borderBottom: "1px solid #EAE3D0", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, color: t.inkSoft }}>READINESS</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: t.success }}>84%</span>
        <span style={{ fontSize: 8.5, color: t.inkSoft }}>PhonePe Senior EM · Top quartile, ready to negotiate.</span>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "16px 18px 14px" }}>
        <div style={{ width: 144, flexShrink: 0 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.5, color: t.inkSoft, marginBottom: 7 }}>OVERALL SCORE</div>
          <div style={{ position: "relative", width: 92, height: 56, margin: "0 auto 9px" }}>
            <svg viewBox="0 0 90 56" width="92" height="56">
              <path d="M8,52 A37,37 0 0,1 82,52" fill="none" stroke="#E8E0D0" strokeWidth="8" strokeLinecap="round" />
              <path d="M8,52 A37,37 0 0,1 77,34" fill="none" stroke={t.success} strokeWidth="8" strokeLinecap="round"
                strokeDasharray={arcLen} strokeDashoffset={revealed ? 0 : arcLen}
                style={{ transition: `stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1) ${baseDelay + 200}ms` }} />
            </svg>
            <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontSize: 25, fontWeight: 800, color: t.coal, lineHeight: 1 }}>84</div>
            <div style={{ position: "absolute", bottom: -5, left: 0, right: 0, textAlign: "center", fontSize: 8, color: t.inkFaintWeak }}>/ 100</div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 8, background: t.success100, color: t.success, padding: "3px 7px", borderRadius: 3, fontWeight: 600 }}>Strong Hire ✓</span>
          </div>
          <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="30" height="13" viewBox="0 0 30 13"><polyline points="0,11 5,8 10,10 16,4 22,6 30,2" fill="none" stroke={t.success} strokeWidth="1.3" /></svg>
            <span style={{ fontSize: 9.5, color: t.success, fontWeight: 700 }}>↑ 19</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.4, color: t.copper, marginBottom: 6 }}>✦ AI NEGOTIATION VERDICT</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.coal, lineHeight: 1.5, marginBottom: 10 }}>Countered with data, held silence twice, closed at ₹48L. 71% gap closure on the first-offer anchor.</div>
          <div style={{ fontSize: 8, background: "#F3EFE5", padding: "4px 8px", borderRadius: 3, color: t.inkSoft }}>
            Calibrated to Senior EM · Strong ≥ 85 · Hire ≥ 70 · Lean ≥ 55
          </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid #EAE3D0", padding: "10px 18px 8px", background: "#FEFDF8" }}>
        <span style={{ fontSize: 8.5, background: "#FED7AA", color: t.copper, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>SALARY NEGOTIATION · FULL REPORT</span>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: t.coal, marginTop: 7, fontFamily: rptF.serif, lineHeight: 1.25 }}>The full breakdown of your negotiation</div>
        <div style={{ fontSize: 8.5, color: t.inkSoft, marginTop: 3 }}>Each panel turns one negotiation skill into something you can act on.</div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 8.5, fontWeight: 700, color: t.copper, letterSpacing: 0.4 }}>THE 30-SECOND READ</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.coal, marginTop: 4, lineHeight: 1.35, fontFamily: rptF.serif }}>
            Landed ₹48L — ₹10L above opening. 71% gap closure in 3 rounds.
          </div>
          <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 8.5, color: t.inkSoft }}>How far you got in the negotiation</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.success }}>3 of 3 stages</span>
          </div>
        </div>
      </div>
      <div style={{ margin: "10px 18px 0", background: t.indigo, borderRadius: 7, padding: "9px 14px", display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 8.5, background: "rgba(255,255,255,0.15)", color: "#fff", padding: "3px 8px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>PART 1 OF 4</span>
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "#fff" }}>What happened in this call</div>
          <div style={{ fontSize: 8, color: "rgba(255,255,255,0.65)" }}>Every moment that mattered: what you said, what you missed, what it cost.</div>
        </div>
      </div>
      <div style={{ padding: "10px 18px 14px" }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: t.coal, marginBottom: 6 }}>01  How far you got in the negotiation</div>
        <div style={{ display: "flex", gap: 2, marginBottom: 8 }}>
          {phases.map(p => (
            <div key={p.n} style={{ flex: 1, height: 4, background: t.success, borderRadius: 2 }} />
          ))}
        </div>
        {phases.map(p => (
          <div key={p.n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderTop: "1px solid #F0EDE3" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 17, height: 17, borderRadius: "50%", background: t.success, color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{p.n}</span>
              <span style={{ fontSize: 9, fontWeight: 600, color: t.coal }}>{p.label}</span>
            </div>
            <span style={{ fontSize: 8, fontWeight: 600, color: t.success, background: t.success100, padding: "2px 7px", borderRadius: 3 }}>DONE ✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Card: Campus placement — right ── (exact canvas copy) */
function RPT_ProgressCard({ lifted, revealed, baseDelay = 0 }: { lifted?: boolean; revealed?: boolean; baseDelay?: number }) {
  const skills = [
    { label: "Communication",     score: 75, c: t.success },
    { label: "Fundamentals",      score: 70, c: t.success },
    { label: "Project ownership", score: 45, c: t.error },
    { label: "Project depth",     score: 40, c: t.error },
  ];
  /* Arc length for 58% of a semicircle: π × r × 0.58 = π × 33 × 0.58 ≈ 60 */
  const arcLen = 60;
  return (
    <div style={{ width: 460, background: t.cream, borderRadius: 16, border: `1px solid ${t.line}`, boxShadow: lifted ? "0 32px 96px rgba(14,12,8,0.28), 0 8px 24px rgba(14,12,8,0.12)" : "0 8px 48px rgba(14,12,8,0.12), 0 2px 8px rgba(14,12,8,0.06)", overflow: "hidden", fontFamily: fonts.sans, transition: "box-shadow 0.50s ease" }}>
      <div style={{ background: t.creamSoft, padding: "9px 16px", borderBottom: `1px solid ${t.line}`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 0.6, color: t.inkSoft }}>READINESS</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: t.copper }}>42%</span>
        <span style={{ fontSize: 8, color: t.inkSoft }}>Infosys SWE Fresher · ~5 sessions to close gap</span>
      </div>
      <div style={{ display: "flex", gap: 0, padding: "14px 16px 12px" }}>
        <div style={{ width: 124, flexShrink: 0 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.5, color: t.inkSoft, marginBottom: 6 }}>OVERALL SCORE</div>
          <div style={{ position: "relative", width: 84, height: 52, margin: "0 auto 8px" }}>
            <svg viewBox="0 0 80 50" width="84" height="52">
              <path d="M7,46 A33,33 0 0,1 73,46" fill="none" stroke={t.line} strokeWidth="7" strokeLinecap="round" />
              <path d="M7,46 A33,33 0 0,1 48,14" fill="none" stroke={t.copper} strokeWidth="7" strokeLinecap="round"
                strokeDasharray={arcLen} strokeDashoffset={revealed ? 0 : arcLen}
                style={{ transition: `stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1) ${baseDelay + 200}ms` }} />
            </svg>
            <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, textAlign: "center", fontSize: 22, fontWeight: 800, color: t.coal, lineHeight: 1 }}>58</div>
            <div style={{ position: "absolute", bottom: -4, left: 0, right: 0, textAlign: "center", fontSize: 7.5, color: t.inkFaint }}>/ 100</div>
          </div>
          <span style={{ fontSize: 7.5, background: t.copper100, color: t.copperDark, padding: "2px 7px", borderRadius: 3, fontWeight: 600 }}>Lean Hire</span>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <svg width="28" height="12" viewBox="0 0 28 12"><polyline points="0,4 5,7 10,5 16,10 22,8 28,12" fill="none" stroke={t.error} strokeWidth="1.2" /></svg>
            <span style={{ fontSize: 9, color: t.error, fontWeight: 700 }}>↓ 8</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 0.4, color: t.copper, marginBottom: 5 }}>✦ AI CAMPUS VERDICT</div>
          <div style={{ fontSize: 10, fontWeight: 600, color: t.coal, lineHeight: 1.5, marginBottom: 8 }}>Enthusiasm came through. Project section drifted to "we" — distinguish your individual contribution.</div>
          <div style={{ fontSize: 8, background: t.error100, padding: "4px 8px", borderRadius: 3, color: t.error, fontWeight: 600 }}>
            ⚠ RED FLAG: "we built the backend" — vague project role
          </div>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${t.line}`, padding: "10px 16px 8px", background: t.cream }}>
        <span style={{ fontSize: 8, background: t.copper100, color: t.copperDark, padding: "3px 9px", borderRadius: 20, fontWeight: 600 }}>CAMPUS PLACEMENT · FULL REPORT</span>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: t.coal, marginTop: 7, fontFamily: fonts.serif, lineHeight: 1.25 }}>The full breakdown of your campus interview</div>
        <div style={{ fontSize: 8, color: t.inkSoft, marginTop: 3 }}>Each panel turns one campus skill into something you can rehearse.</div>
      </div>
      <div style={{ margin: "10px 16px 0", background: t.indigo, borderRadius: 6, padding: "8px 12px", display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 8, background: "rgba(255,255,255,0.15)", color: t.cream, padding: "2px 7px", borderRadius: 4, fontWeight: 700, whiteSpace: "nowrap" }}>PART 1 OF 3</span>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: t.cream }}>Skill breakdown</div>
          <div style={{ fontSize: 7.5, color: "rgba(255,255,255,0.65)" }}>Where each axis landed and what to practice next.</div>
        </div>
      </div>
      <div style={{ padding: "10px 16px 14px" }}>
        {skills.map((s, i) => (
          <div key={s.label} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 8.5, color: t.inkSoft }}>{s.label}</span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: s.c, fontFamily: fonts.mono }}>{s.score}</span>
            </div>
            <div style={{ height: 4, background: t.line, borderRadius: 2, overflow: "hidden" }}>
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
      style={{ background: t.cream, overflowX: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: 120, paddingBottom: 80 }}
    >
      <style>{rpt_STYLES}</style>

      {/* ── Fan card showcase ── */}
      <div ref={showcaseRef} className="mv2-rpt-showcase" style={{ position: "relative", width: "100%", height: 580, flexShrink: 0, clipPath: "inset(-280px -60px 0 -60px)" }}>

        {/* Left card — outer: position + reveal; inner: hover */}
        <div className="mv2-rpt-side" style={{ position: "absolute", left: 220, bottom: 60, zIndex: lActive ? 12 : anyHov ? 2 : 3, transform: revealed ? "translateY(0px)" : "translateY(80px)", opacity: revealed ? 1 : 0, transition: RV, transitionDelay: delay(0) }}>
          <div style={{ transformOrigin: "bottom center", transform: lActive ? "rotate(0deg) translateY(-30px) scale(1.08)" : anyHov ? "rotate(-10deg) translateY(6px) scale(0.86)" : "rotate(-8deg)", opacity: anyHov && !lActive ? 0.65 : 1, filter: anyHov && !lActive ? "brightness(0.92) saturate(0.2)" : "none", transition: TR }} onMouseEnter={() => setHov("left")} onMouseLeave={() => setHov(null)}>
            <div style={{ position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none", fontFamily: "'Satoshi', system-ui, sans-serif", fontWeight: 400, fontSize: 12, color: t.inkFaintWeak, lineHeight: 1.4, opacity: hov !== null ? 0 : 1, transition: "opacity 0.30s ease" }}>
              Behavioral · 82/100<br />Razorpay Senior PD
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3, color: t.inkFaintWeak }}>↓</div>
            </div>
            <RPT_InterviewCard lifted={lActive} revealed={revealed} baseDelay={0} />
          </div>
        </div>

        {/* Center card */}
        <div style={{ position: "absolute", left: "50%", bottom: 60, zIndex: cActive ? 12 : anyHov ? 4 : 5, transform: revealed ? "translateX(-50%) translateY(0px)" : "translateX(-50%) translateY(80px)", opacity: revealed ? 1 : 0, transition: RV, transitionDelay: delay(1) }}>
          <div style={{ transform: cActive ? "translateY(-30px) scale(1.08)" : anyHov ? "translateY(6px) scale(0.86)" : "none", opacity: anyHov && !cActive ? 0.65 : 1, filter: anyHov && !cActive ? "brightness(0.92) saturate(0.2)" : "none", transition: TR }} onMouseEnter={() => setHov("center")} onMouseLeave={() => setHov(null)}>
            <div style={{ position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none", fontFamily: "'Satoshi', system-ui, sans-serif", fontWeight: 400, fontSize: 12, color: t.inkFaintWeak, lineHeight: 1.4, opacity: hov !== null ? 0 : 1, transition: "opacity 0.30s ease" }}>
              Salary Neg · ₹48L landed<br />PhonePe Senior EM
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3, color: t.inkFaintWeak }}>↓</div>
            </div>
            <RPT_ReportCard lifted={cActive} revealed={revealed} baseDelay={120} />
          </div>
        </div>

        {/* Right card */}
        <div className="mv2-rpt-side" style={{ position: "absolute", right: 220, bottom: 60, zIndex: rActive ? 12 : anyHov ? 2 : 3, transform: revealed ? "translateY(0px)" : "translateY(80px)", opacity: revealed ? 1 : 0, transition: RV, transitionDelay: delay(2) }}>
          <div style={{ transformOrigin: "bottom center", transform: rActive ? "rotate(0deg) translateY(-30px) scale(1.08)" : anyHov ? "rotate(10deg) translateY(6px) scale(0.86)" : "rotate(8deg)", opacity: anyHov && !rActive ? 0.65 : 1, filter: anyHov && !rActive ? "brightness(0.92) saturate(0.2)" : "none", transition: TR }} onMouseEnter={() => setHov("right")} onMouseLeave={() => setHov(null)}>
            <div style={{ position: "absolute", top: -68, left: "50%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap", pointerEvents: "none", fontFamily: "'Satoshi', system-ui, sans-serif", fontWeight: 400, fontSize: 12, color: t.inkFaintWeak, lineHeight: 1.4, opacity: hov !== null ? 0 : 1, transition: "opacity 0.30s ease" }}>
              Campus · 58/100<br />Infosys SWE Fresher
              <div style={{ fontSize: 13, opacity: 0.7, marginTop: 3, color: t.inkFaintWeak }}>↓</div>
            </div>
            <RPT_ProgressCard lifted={rActive} revealed={revealed} baseDelay={240} />
          </div>
        </div>

        {/* Bottom fade */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 360, background: `linear-gradient(to bottom, transparent 0%, ${t.cream} 70%)`, zIndex: 15, pointerEvents: "none" }} />
      </div>

      {/* ── Headline — staggered scroll reveal, each line fires after the cards land ── */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, marginTop: -80 }}>
        <h2 id="hd-reports" className="mv2-rpt-h2" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(40px, 5.4vw, 72px)", fontWeight: 400, lineHeight: 1.02, color: t.coal, margin: "0 0 4px", textAlign: "center", letterSpacing: -2.5, padding: "0 24px", opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0px)" : "translateY(28px)", transition: RV, transitionDelay: revealed ? delay(3) : "0ms" }}>
          Personalized reports after
        </h2>
        <h2 className="mv2-rpt-h2" style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(40px, 5.4vw, 72px)", fontWeight: 400, fontStyle: "italic", lineHeight: 1.02, color: t.copper, margin: "0 0 24px", textAlign: "center", letterSpacing: -1.5, opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0px)" : "translateY(28px)", transition: RV, transitionDelay: revealed ? delay(4) : "0ms" }}>
          every interview
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4A4540", textAlign: "center", margin: 0, maxWidth: 480, fontWeight: 400, fontFamily: "'Satoshi', system-ui, sans-serif", opacity: revealed ? 1 : 0, transform: revealed ? "translateY(0px)" : "translateY(28px)", transition: RV, transitionDelay: revealed ? delay(5) : "0ms" }}>
          STAR scores, bias flags, engagement bars, and a coached rewrite of
          your weakest answer. Ready before you close the tab.
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
          <rect x="7" y="4" width="22" height="28" rx="3" fill={t.indigo100} stroke={t.indigo} strokeWidth="1.7" />
          <path d="M22 4v7h7" fill="#C9C6E8" stroke={t.indigo} strokeWidth="1.4" strokeLinejoin="round" />
          <line x1="12" y1="16" x2="22" y2="16" stroke={t.indigo} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="20" x2="22" y2="20" stroke={t.indigo} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="24" x2="18" y2="24" stroke={t.indigo} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="31" cy="31" r="9.5" fill={t.indigo100} stroke={t.indigo} strokeWidth="1.7" />
          <path d="M27 31l2.5 2.5 4.5-5" stroke={t.indigo} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: "Encrypted at rest",
      desc: "All resumes, transcripts, and voice data stored with AES-256 encryption and row-level security. Nothing leaks between users.",
      icon: (
        /* Indigo body + copper shackle */
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="9" y="21" width="26" height="17" rx="4" fill={t.indigo100} stroke={t.indigo} strokeWidth="1.7" />
          <path d="M15 21v-5.5a7 7 0 0 1 14 0V21" stroke={t.indigo} strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx="22" cy="30" r="3.5" fill={t.indigo} />
          <line x1="22" y1="33" x2="22" y2="36" stroke={t.indigo} strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "No AI training on your data",
      desc: "Your interviews, resume, and voice recordings are never used to train AI models. Your sessions belong to you alone.",
      icon: (
        /* Indigo CPU/chip + copper prohibition ring */
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="12" y="12" width="20" height="20" rx="3" fill={t.indigo100} stroke={t.indigo} strokeWidth="1.7" />
          <rect x="16" y="16" width="12" height="12" rx="1.5" fill={t.indigo} opacity="0.15" stroke={t.indigo} strokeWidth="1.2" />
          <line x1="17" y1="8" x2="17" y2="12" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="22" y1="8" x2="22" y2="12" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="27" y1="8" x2="27" y2="12" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="17" y1="32" x2="17" y2="36" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="22" y1="32" x2="22" y2="36" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="27" y1="32" x2="27" y2="36" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="8" y1="17" x2="12" y2="17" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="8" y1="22" x2="12" y2="22" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="8" y1="27" x2="12" y2="27" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="32" y1="17" x2="36" y2="17" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="32" y1="22" x2="36" y2="22" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <line x1="32" y1="27" x2="36" y2="27" stroke={t.indigo} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="32" cy="32" r="9" fill={t.indigo100} />
          <circle cx="32" cy="32" r="7.5" stroke={t.indigo} strokeWidth="1.8" fill="none" />
          <line x1="27.3" y1="36.7" x2="36.7" y2="27.3" stroke={t.indigo} strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      title: "You're in control",
      desc: "Delete your account and every byte of your data from Settings, instantly. No support ticket. No waiting period.",
      icon: (
        /* Indigo shield + copper person = you own your data */
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 4L8 10v11c0 9.2 6 17.3 14 19.8 8-2.5 14-10.6 14-19.8V10L22 4Z" fill={t.indigo100} stroke={t.indigo} strokeWidth="1.7" strokeLinejoin="round" />
          <circle cx="22" cy="18" r="4" fill={t.indigo} />
          <path d="M13.5 31.5c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5" fill={t.indigo} />
        </svg>
      ),
    },
  ];

  return (
    <section style={{ background: t.cream, padding: "96px 0 80px", overflowX: "hidden" }}>
      <div className="mv2-container" style={{ maxWidth: 1120, margin: "0 auto", padding: "0 40px" }}>
        {/* Headline */}
        <MotionReveal style={{ textAlign: "center", margin: "0 auto 16px", maxWidth: 640 }}>
          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 56, fontWeight: 400, lineHeight: 1.05, color: t.coal, margin: 0, letterSpacing: -1.5 }}>
            Your data stays <span style={{ fontStyle: "italic", color: t.copper }}>yours</span>
          </h2>
        </MotionReveal>
        <MotionReveal delay={100} style={{ textAlign: "center", margin: "0 auto 64px", maxWidth: 480 }}>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4A4540", margin: 0, fontFamily: fonts.sans }}>
            Built for India&rsquo;s regulatory landscape. Every piece of data you share is encrypted, private, and deletable on demand.
          </p>
        </MotionReveal>

        {/* Cards grid — collapses to 2-col at ≤880px via .mv2-security-grid */}
        <div className="mv2-security-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {cards.map((c, i) => (
            <MotionReveal key={c.title} delay={i * 90}>
              <div
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
            </MotionReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────── VIDEO CTA ─────────────────────────── */
export function VideoCtaV2({
  headingPlain = "Your next interview won't wait.",
  headingItalic = "Neither should your prep.",
  body = "One session. A STAR breakdown on every answer. Your weak spots caught before HR finds them first.",
  ctaLabel = "Start your first free session",
  ctaHref = "/login",
}: {
  headingPlain?: string;
  headingItalic?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
} = {}) {
  const [revealed, setRevealed] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setRevealed(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const fadeUp = (delay: number): CSSProperties => ({
    opacity: revealed ? 1 : 0,
    transform: revealed ? "translateY(0)" : "translateY(28px)",
    transition: `opacity 0.75s ease ${delay}ms, transform 0.75s ease ${delay}ms`,
  });

  return (
    <section ref={sectionRef} style={{ position: "relative", minHeight: 720, overflow: "hidden", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>

      {/* Background video */}
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        crossOrigin="anonymous"
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center 75%",
          opacity: revealed ? 1 : 0,
          transform: revealed ? "scale(1)" : "scale(1.06)",
          transition: "opacity 1.2s ease 0ms, transform 1.4s ease 0ms",
        }}
      >
        <source src="/cta.mp4" type="video/mp4" />
      </video>

      {/* Dark gradient — top to transparent */}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0) 100%)", pointerEvents: "none" }} />

      {/* Content */}
      <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "60px 40px 40px", maxWidth: 1100, margin: "0 auto", alignSelf: "flex-start" }}>

        <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: "clamp(36px, 5.5vw, 72px)", fontWeight: 400, lineHeight: 1.04, color: t.cream, margin: "0 0 20px", letterSpacing: -2, textWrap: "balance" as const, ...fadeUp(100) }}>
          {headingPlain} <span style={{ fontStyle: "italic" }}>{headingItalic}</span>
        </h2>

        <p style={{ fontSize: 15, lineHeight: 1.65, color: "#ffffff", margin: "0 auto 40px", maxWidth: 520, fontFamily: "'Satoshi', -apple-system, system-ui, sans-serif", ...fadeUp(260) }}>
          {body}
        </p>

        <div style={{ display: "flex", justifyContent: "center", ...fadeUp(400) }}>
          <a href={ctaHref} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: t.copper, color: t.cream, padding: "14px 28px", borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: "none", fontFamily: "'Satoshi', -apple-system, system-ui, sans-serif", letterSpacing: 0.1 }}>
            {ctaLabel}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>
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
      {/* 12-section composition:
            1. NavV2  2. HeroV2  3. InterviewFocusV2  4. PersonalizedReportsV2
            5. FeatureGridV2  6. ProductStoryV2 (3 Easy Steps)  7. PricingV2
            8. ComparisonV2  9. BuiltForIndiaV2  10. SecurityComplianceV2
            11. FAQV2  12. VideoCtaV2  13. FooterDome
            Arc: hook → proof → features → how-it-works → price → vs-alternatives → buy
            Pricing moved before Comparison so candidates see the cost before the
            competitor contrast — most decide on price first, then validate "why us". */}
      <main id="main">
        <HeroV2 />
        <InterviewFocusV2 />
        <PersonalizedReportsV2 />
        <FeatureGridV2 />
        <ProductStoryV2 />
        <PricingV2 />
        <SecurityComplianceV2 />
        <FAQV2 />
        <VideoCtaV2 />
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
          2 free sessions
        </span>{" "}
        · No card needed
      </span>
      <a
        href="/signup"
        className="mv2-sticky-btn"
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
