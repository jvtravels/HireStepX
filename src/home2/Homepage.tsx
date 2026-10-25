"use client";
import { homeCss } from "./homeCss";
import { HeroSurface, StepVisual, ReportSurface, InboxSurface } from "./Visuals";
import { Trust } from "./Extra";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import Skel, { useSkel } from "./Skel";
import { useScrollTilt, useScrollDepth, useReveal, delay, reduced } from "./motion";

function Arrow() {
  return (
    <svg className="hx-arr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="hx-arr-c"><path className="hx-arr-a hx-arr-t" d="M6 4L10 8" /><path className="hx-arr-a hx-arr-b" d="M10 8L6 12" /></g>
    </svg>
  );
}


const FONT_FILES = ["bricolage-500", "bricolage-600"];
const preloadFonts = () => FONT_FILES.forEach((f) => preload(`/fonts/${f}.woff2`, { as: "font", type: "font/woff2", crossOrigin: "anonymous" }));

const NAV_X_KEY = "hx-nav-x";
const rollKeys = (from: number, to: number) => {
  const turns = Math.max(1, Math.round(Math.abs(to - from) / 28));
  const rot = Math.sign(to - from) * 360 * turns;
  return [{ transform: `translateX(${from}px) rotate(0deg)` }, { transform: `translateX(${to}px) rotate(${rot}deg)` }];
};
const rollOpts: KeyframeAnimationOptions = { duration: 560, easing: "cubic-bezier(.22,.8,.24,1)", fill: "forwards" };
const markX = (a: HTMLElement) => a.offsetLeft + a.offsetWidth / 2 - 4.5;

function useNavX(active: string | undefined) {
  const links = useRef<HTMLElement>(null);
  const x = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = links.current, mark = x.current;
    const a = nav?.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!a) { try { sessionStorage.removeItem(NAV_X_KEY); } catch { /* storage blocked */ } return; }
    if (!nav || !mark) return;
    const to = markX(a);
    let from: number | null = null;
    try { const v = sessionStorage.getItem(NAV_X_KEY); from = v === null ? null : Number(v); sessionStorage.setItem(NAV_X_KEY, String(to)); } catch { /* storage blocked */ }
    mark.style.opacity = "1";
    mark.style.transform = `translateX(${to}px)`;
    if (from !== null && Number.isFinite(from) && Math.abs(from - to) > 1 && !reduced() && mark.animate) mark.animate(rollKeys(from, to), rollOpts);
    const fit = () => { mark.style.transform = `translateX(${markX(a)}px)`; };
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [active]);
  return { links, x };
}

export type NavKey = "talent" | "companies" | "pricing" | "resources" | "about";

export function Nav({ active, talentHref = "/candidates" }: { active?: NavKey; talentHref?: string }) {
  preloadFonts();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  const navx = useNavX(active);
  const cur = (k: NavKey) => (active === k ? "page" : undefined);
  return (
    <header className="hx-nav">
      <div className="hx-wrap hx-nav-in">
        <Link data-no-underline className="hx-logo" href="/" aria-label="HireStepX home"><img src="/wordmark.png" alt="HireStepX" /></Link>
        <nav ref={navx.links} className="hx-links" aria-label="Primary">
          <Link data-no-underline data-navx href={talentHref} aria-current={cur("talent")}>For Talent</Link>
          <Link data-no-underline data-navx href="/employers" aria-current={cur("companies")}>For Companies</Link>
          <Link data-no-underline data-navx href="/pricing" aria-current={cur("pricing")}>Pricing</Link>
          <Link data-no-underline data-navx href="/resources" aria-current={cur("resources")}>Resources</Link>
          <Link data-no-underline data-navx href="/about" aria-current={cur("about")}>About us</Link>
          <i ref={navx.x} className="hx-x" aria-hidden="true" />
        </nav>
        <div className="hx-nav-cta">
          <Link data-no-underline className="hx-ghost" href="/login">Log in</Link>
          <Link data-no-underline className="hx-btn sm" href="/signup">Sign up free</Link>
        </div>
        <button type="button" className="hx-burger" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="hx-menu" onClick={() => setOpen((o) => !o)}>
          <svg className={open ? "hx-bsvg on" : "hx-bsvg"} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path className="hx-b1" d="M4 7h16" /><path className="hx-b2" d="M4 12h16" /><path className="hx-b3" d="M4 17h16" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="hx-menu" id="hx-menu" onClick={() => setOpen(false)}>
          <nav aria-label="Mobile">
            <Link data-no-underline href={talentHref} aria-current={cur("talent")}>For Talent</Link>
            <Link data-no-underline href="/employers" aria-current={cur("companies")}>For Companies</Link>
            <Link data-no-underline href="/pricing" aria-current={cur("pricing")}>Pricing</Link>
            <Link data-no-underline href="/resources" aria-current={cur("resources")}>Resources</Link>
            <Link data-no-underline href="/about" aria-current={cur("about")}>About us</Link>
          </nav>
          <div className="hx-menu-cta">
            <Link data-no-underline className="hx-btn alt" href="/login">Log in</Link>
            <Link data-no-underline className="hx-btn" href="/signup">Sign up free</Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function Hero() {
  const tilt = useScrollTilt<HTMLDivElement>();
  useSkel(tilt);
  return (
    <section className="hx-hero">
      <div className="hx-wrap">
        <h1 className="hx-h1">Prepare to be <b>hired</b>.<br />Hire the <b>prepared</b>.</h1>
        <p className="hx-lede">Practise a mock interview and get scored on every answer. Employers read the answers behind the score.</p>
        <div className="hx-cta">
          <a data-no-underline className="hx-btn lg" href="/signup">Practise free <Arrow /></a>
          <a data-no-underline className="hx-btn lg alt" href="/signup?next=/employer">Hire from proof</a>
        </div>
        <div className="hx-tiltwrap">
          <div ref={tilt} data-sk="pending" className="hx-stage hx-stage-hero hx-tilt">
            <HeroSurface />
          </div>
        </div>
      </div>
    </section>
  );
}

const HOW_MS = 5200;

export function Connection() {
  const steps: [string, string][] = [
    ["Practise", "A candidate runs a voice interview for a real role."],
    ["Get scored", "Every answer is scored on clarity, relevance, depth and confidence, then saved as evidence."],
    ["Opt in", "The candidate chooses whether employers can find them."],
    ["Connect", "An employer reads the answers, then pays to see the name and say hello."],
  ];
  const { ref, on } = useReveal<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!on || !auto || reduced()) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % steps.length), HOW_MS);
    return () => clearTimeout(id);
  }, [on, auto, active, steps.length]);
  return (
    <section className="hx-sec" id="how">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <span className="hx-kicker">How it works</span>
        <h2 className="hx-h2 hx-wide">One session, read from <b>both sides</b> of the table.</h2>
        <div className="hx-how hx-ri" style={delay(1)}>
          <ol className="hx-how-list">
            {steps.map(([t, d], i) => (
              <li key={t} data-state={active === i ? "now" : "idle"}>
                <button type="button" aria-expanded={active === i} onClick={() => { setActive(i); setAuto(false); }}>
                  <b>{`0${i + 1}`}</b>
                  <span>{t}</span>
                </button>
                <div className="hx-how-d"><div><p>{d}</p></div></div>
                {active === i && auto && !reduced() && <i className="hx-how-pg" style={{ animationDuration: `${HOW_MS}ms` }} />}
              </li>
            ))}
          </ol>
          <Skel className="hx-stage hx-how-vis">
            <div className="hx-how-in" key={active}><StepVisual n={active} play /></div>
          </Skel>
        </div>
      </div>
    </section>
  );
}

export function Candidates() {
  const depth = useScrollDepth<HTMLDivElement>();
  useSkel(depth);
  return (
    <section className="hx-sec" id="candidates">
      <div className="hx-wrap">
        <div className="hx-head">
          <div>
            <span className="hx-kicker">For candidates</span>
            <h2 className="hx-h2">The report points at the sentence that <b>cost you</b>.</h2>
          </div>
          <div className="hx-head-cta">
            <a data-no-underline className="hx-btn" href="/signup">Practise free <Arrow /></a>          </div>
        </div>
        <div ref={depth} data-sk="pending" className="hx-stage hx-stage-cool hx-stage-crop hx-depth"><ReportSurface /></div>
      </div>
    </section>
  );
}

export function Employers() {
  const depth = useScrollDepth<HTMLDivElement>();
  useSkel(depth);
  return (
    <section className="hx-sec" id="employers">
      <div className="hx-wrap">
        <div className="hx-head">
          <div>
            <span className="hx-kicker">For employers</span>
            <h2 className="hx-h2">Know how they <b>think</b> before you call.</h2>
          </div>
          <div className="hx-head-cta">
            <a data-no-underline className="hx-btn" href="/signup?next=/employer">Hire from proof <Arrow /></a>
          </div>
        </div>
        <div ref={depth} data-sk="pending" className="hx-stage hx-stage-warm hx-stage-crop hx-depth"><InboxSurface /></div>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section className="hx-sec hx-closing">
      <div className="hx-wrap">
        <div className="hx-end">
          <span className="hx-kicker">Ready when you are</span>
          <h2 className="hx-h2">Start with <b>one answer</b>.</h2>
          <p>Practise out loud, see exactly what to fix, and let employers find the proof.</p>
          <div className="hx-cta">
            <a data-no-underline className="hx-btn lg" href="/signup">Practise free <Arrow /></a>
            <a data-no-underline className="hx-btn lg alt" href="/signup?next=/employer">Hire from proof</a>
          </div>
          <ul className="hx-endnote">
            <li>2 free sessions</li>
            <li>No card needed</li>
            <li>Delete anytime</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <div className="hx-wrap hx-footwrap">
      <footer className="hx-foot">
          <div className="hx-foot-brand">
            <a data-no-underline className="hx-logo" href="/" aria-label="HireStepX home"><img src="/wordmark.png" alt="HireStepX" /></a>
            <p>Practise interviews. Get hired on proof.</p>
            <p className="hx-foot-rights"><a href="/privacy#your-rights">Your rights under India&apos;s DPDP Act</a>: access, correct or erase your data.</p>
          </div>
          <nav aria-label="Footer" className="hx-foot-cols">
            <div><h3>Product</h3><a data-no-underline href="/candidates">For talent</a><a data-no-underline href="/employers">For employers</a><a href="/pricing">Pricing</a><a href="/resources">Resources</a></div>
            <div><h3>Company</h3><a href="/about">About</a><a href="/contact">Contact</a></div>
            <div><h3>Legal</h3><a href="/privacy">Privacy policy</a><a href="/terms">Terms</a><a href="/refund">Refund policy</a></div>
          </nav>
          <div className="hx-foot-bar">
            <span>&copy; 2026 HireStepX. Made in Mumbai, India.</span>
            <div className="hx-social">
              <a data-no-underline href="https://www.linkedin.com/company/hirestepx" target="_blank" rel="noopener noreferrer" aria-label="HireStepX on LinkedIn">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" /></svg>
              </a>
            </div>
          </div>
      </footer>
    </div>
  );
}

export function HomeShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="hx">
      <style>{homeCss}</style>
      {children}
    </div>
  );
}

export default function Homepage() {
  return (
    <HomeShell>
      <Nav />
      <main>
        <Hero />
        <Connection />
        <Candidates />
        <Employers />
        <Trust />
        <Closing />
      </main>
      <Footer />
    </HomeShell>
  );
}
