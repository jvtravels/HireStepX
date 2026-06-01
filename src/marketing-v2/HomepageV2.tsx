"use client";
import { useEffect, useState, useRef, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { tokens as t, fonts, shadows } from "../auth/_tokens";
import { useAuth, hasStoredSession } from "../AuthContext";

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
  return (
    <header role="banner">
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
            style={{
              fontFamily: fonts.serif,
              fontSize: 24,
              color: t.coal,
              textDecoration: "none",
              letterSpacing: "-0.015em",
            }}
          >
            HireStep<span style={{ color: t.copper }}>X</span>
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
          </div>
        </div>
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
        const h = 5 + Math.abs(Math.sin(i * 0.9)) * 21;
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

const heroQuotes = [
  { text: "Cleared the Razorpay PM loop on round 3.", by: "Aanya · IIT-D" },
  { text: "Got the Zomato offer two weeks after Diwali.", by: "Rohan · NIT-Trichy" },
  { text: "Stopped freezing on the why-this-company question.", by: "Meera · BITS Pilani" },
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
              Voice-first mock rounds. Real interviewer questions.{" "}
              <abbr title="Situation, Task, Action, Result — the answer framework used by Amazon, Google, and most India tech panels" style={{ textDecoration: "underline dotted", textUnderlineOffset: 3, cursor: "help" }}>STAR</abbr>{" "}
              rubric back before your chai cools.
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
function LogoMark({ label, slug }: { label: string; slug: string }) {
  /* simpleicons.org omits several brands for trademark reasons (Flipkart,
     Deloitte, Microsoft, HDFC Bank, Accenture, …). When the glyph 404s
     we swap the <img> for a serif wordmark so every brand still renders
     and the strip never shows broken-image placeholders. */
  const [failed, setFailed] = useState(false);
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
      }}
    >
      {failed ? (
        <span
          style={{
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
      ) : (
        <img
          src={`https://cdn.simpleicons.org/${slug}/1a1a1a`}
          alt={label}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{
            height: 24,
            width: "auto",
            maxWidth: 140,
            opacity: 0.72,
            filter: "grayscale(100%)",
          }}
        />
      )}
    </span>
  );
}

export function LogoStripV2() {
  const logos: Array<[string, string]> = [
    ["Razorpay", "razorpay"],
    ["Zomato", "zomato"],
    ["Flipkart", "flipkart"],
    ["Swiggy", "swiggy"],
    ["Paytm", "paytm"],
    ["PhonePe", "phonepe"],
    ["Infosys", "infosys"],
    ["Wipro", "wipro"],
    ["HDFC Bank", "hdfcbank"],
    ["Deloitte", "deloitte"],
    ["Accenture", "accenture"],
    ["Google", "google"],
    ["Microsoft", "microsoft"],
    ["Amazon", "amazon"],
    ["Adobe", "adobe"],
    ["Salesforce", "salesforce"],
  ];
  return (
    <section
      aria-label="Companies we cover"
      className="mv2-cv-auto"
      style={{
        ...sectionTight,
        background: t.creamSoft,
        borderTop: `1px solid ${t.line}`,
        borderBottom: `1px solid ${t.line}`,
      }}
    >
      <div style={container}>
        <SectionMasthead n="02" label="Candidates from" right="3,000+ companies" style={{ marginBottom: 32 }} />
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
            {[...logos, ...logos].map(([label, slug], i) => (
              <LogoMark key={`${label}-${i}`} label={label} slug={slug} />
            ))}
          </div>
          <span className="mv2-skip" aria-live="off">
            Practiced for {logos.map(([l]) => l).join(", ")}
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
          <a
            href="#"
            style={{ color: t.indigo, fontWeight: 600, textDecoration: "none" }}
          >
            Vote on the next type →
          </a>
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
            ["Aanya Sharma", "BITS Pilani · 2026"],
            ["Razorpay · Backend Intern", "6 months"],
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
              3,000+
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
              Indian company catalogues mapped. IT services, unicorns, PSUs, MNCs.
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
      sub: "Just one round before the real thing",
      features: [
        "1 full mock session",
        "Full STAR breakdown",
        "Coach fixes after every answer",
        "Saved report for 90 days",
      ],
      cta: "Buy a session",
      href: "/signup?plan=session",
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
    <section className="mv2-section" aria-labelledby="hd-pricing" style={{ ...sectionBase, background: t.creamSoft, borderTop: `1px solid ${t.line}` }}>
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
            ["✓", "7-day refund if unused"],
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
      q: "What if I just want one session?",
      a: "Pay ₹9 per session. No subscription, no commitment. Useful if you have one interview tomorrow.",
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
      a: "3,000+ companies in our catalog (IT services, unicorns, PSUs, MNCs) across behavioural, campus placement, salary negotiation and HR rounds at launch. New focus types ship month by month after public beta.",
    },
    {
      cat: "Product",
      q: "How accurate is the AI score?",
      a: "Benchmarked against real Indian hiring panels. Every score shows the rubric (STAR breakdown, what worked, what didn't), not just a number.",
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
        <a
          href="#"
          style={{
            fontFamily: fonts.sans,
            fontSize: 13,
            fontWeight: 600,
            color: t.indigo,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Full roadmap →
        </a>
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
            first round in under two minutes.
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
            Start your free round
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
            <p
              style={{
                fontFamily: fonts.serif,
                fontSize: 26,
                color: t.coal,
                margin: 0,
                letterSpacing: "-0.015em",
              }}
            >
              HireStep<span style={{ color: t.copper }}>X</span>
            </p>
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
    ["What if I just want one session?", "Pay ₹9 per session. No subscription, no commitment."],
    ["Do you have a student discount?", "Verified .ac.in / .edu.in email = 30% off Weekly and Monthly."],
    ["Which companies and roles do you cover?", "3,000+ companies (IT services, unicorns, PSUs, MNCs) across behavioural, campus placement, salary negotiation and HR rounds at launch."],
    ["How accurate is the AI score?", "Benchmarked against real Indian hiring panels. Every score shows the rubric (STAR breakdown), not just a number."],
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
        <FeatureGridV2 />
        <TestimonialsV2 />
        <PricingV2 />
        <BuiltForIndiaV2 />
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
