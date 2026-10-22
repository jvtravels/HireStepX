"use client";
import { homeCss } from "./homeCss";
import { HeroSurface, StepVisual, ReportSurface, InboxSurface } from "./Visuals";
import { Trust } from "./Extra";
import { useEffect, useState } from "react";
import { useScrollTilt, useScrollDepth, useReveal, delay } from "./motion";

function Arrow() {
  return (
    <svg className="hx-arr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g className="hx-arr-c"><path className="hx-arr-a hx-arr-t" d="M6 4L10 8" /><path className="hx-arr-a hx-arr-b" d="M10 8L6 12" /></g>
    </svg>
  );
}

export function Nav() {
  return (
    <header className="hx-nav">
      <div className="hx-wrap hx-nav-in">
        <a data-no-underline className="hx-logo" href="/"><img src="/wordmark.png" alt="HireStepX" /></a>
        <nav className="hx-links" aria-label="Primary">
          <a data-no-underline href="#candidates">For Talent</a>
          <a data-no-underline href="/employers">For companies</a>
          <a data-no-underline href="/pricing">Pricing</a>
          <a data-no-underline href="/about">About us</a>
        </nav>
        <div className="hx-nav-cta">
          <a data-no-underline className="hx-ghost" href="/login">Log in</a>
          <a data-no-underline className="hx-btn sm" href="/signup">Sign up free</a>
        </div>
      </div>
    </header>
  );
}

export function Hero() {
  const tilt = useScrollTilt<HTMLDivElement>();
  return (
    <section className="hx-hero">
      <div className="hx-wrap">
        <h1 className="hx-h1">Prepare to be <b>hired</b>.<br />Hire the <b>prepared</b>.</h1>
        <p className="hx-lede">Practise a mock interview and get scored on every answer. Employers read the answers behind the score.</p>
        <div className="hx-cta">
          <a data-no-underline className="hx-btn lg" href="/signup">Practise free <Arrow /></a>
          <a data-no-underline className="hx-btn lg alt" href="/employers">Hire from proof</a>
        </div>
        <div className="hx-tiltwrap">
          <div ref={tilt} className="hx-stage hx-stage-hero hx-tilt">
            <HeroSurface />
          </div>
        </div>
      </div>
    </section>
  );
}

export function Connection() {
  const steps: [string, string, string][] = [
    ["01", "Practise", "A candidate runs a voice interview for a real role."],
    ["02", "Get scored", "Every answer is scored on clarity, relevance, depth and confidence, then saved as evidence."],
    ["03", "Opt in", "The candidate chooses whether employers can find them."],
    ["04", "Connect", "An employer reads the answers, then pays to see the name and say hello."],
  ];
  const { ref, on } = useReveal<HTMLDivElement>();
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!on) return;
    const cycle = 400 + 3 * 2300 + 3200;
    const ids: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      [0, 1, 2, 3].forEach((i) => ids.push(setTimeout(() => setActive(i), 400 + i * 2300)));
      ids.push(setTimeout(() => setActive(-1), cycle - 600));
      ids.push(setTimeout(run, cycle));
    };
    run();
    return () => ids.forEach(clearTimeout);
  }, [on]);
  const state = (i: number) => (active === i ? "now" : active > i ? "done" : "next");
  return (
    <section className="hx-sec" id="how">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <span className="hx-kicker">How it works</span>
        <h2 className="hx-h2 hx-wide">One session, read from <b>both sides</b> of the table.</h2>
        <div className="hx-stage hx-how-stage" style={{ ["--prog" as string]: Math.max(0, active) / 3 }}>
          {steps.map(([n], i) => (
            <div className="hx-sv hx-ri" key={n} style={delay(i + 1)} data-state={state(i)}><StepVisual n={i} play={active >= i} /></div>
          ))}
        </div>
        <ol className="hx-steps">
          {steps.map(([n, t, d], i) => (
            <li key={n} className="hx-ri" style={delay(i + 3)} data-state={state(i)}>
              <div className="hx-sn"><b>{n}</b></div>
              <h3>{t}</h3>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Candidates() {
  const depth = useScrollDepth<HTMLDivElement>();
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
        <div ref={depth} className="hx-stage hx-stage-cool hx-stage-crop hx-depth"><ReportSurface /></div>
      </div>
    </section>
  );
}

export function Employers() {
  const depth = useScrollDepth<HTMLDivElement>();
  return (
    <section className="hx-sec" id="employers">
      <div className="hx-wrap">
        <div className="hx-head">
          <div>
            <span className="hx-kicker">For employers</span>
            <h2 className="hx-h2">Know how they <b>think</b> before you call.</h2>
          </div>
          <div className="hx-head-cta">
            <a data-no-underline className="hx-btn" href="/employers">Hire from proof <Arrow /></a>
          </div>
        </div>
        <div ref={depth} className="hx-stage hx-stage-warm hx-stage-crop hx-depth"><InboxSurface /></div>
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
            <a data-no-underline className="hx-btn lg alt" href="/employers">Hire from proof</a>
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
            <a data-no-underline className="hx-logo" href="/"><img src="/wordmark.png" alt="HireStepX" /></a>
            <p>Practise interviews. Get hired on proof.</p>
            <p className="hx-foot-rights">Your rights under India&apos;s DPDP Act: access, correct or erase your data. <a href="/grievance">Contact the grievance officer.</a></p>
          </div>
          <nav aria-label="Footer" className="hx-foot-cols">
            <div><h3>Product</h3><a href="/signup">Practise free</a><a data-no-underline href="/employers">For employers</a><a href="/login">Log in</a></div>
            <div><h3>Company</h3><a href="/contact">Contact</a><a href="/grievance">Grievance officer</a></div>
            <div><h3>Legal</h3><a href="/privacy">Privacy policy</a><a href="/terms">Terms</a></div>
          </nav>
          <span className="hx-foot-copy">&copy; 2026 HireStepX</span>
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
