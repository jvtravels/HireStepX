"use client";
import Skel from "./Skel";
import { useState } from "react";
import { Arrow, Shell } from "./Pages";
import { delay, useReveal } from "./motion";

const MAIL = "hello@hirestepx.com";

const PATHS: [string, string][] = [
  ["Interview questions", "/questions"],
  ["Salary guides", "/salary"],
  ["Company guides", "/companies"],
  ["Interview prep", "/interview-prep"],
  ["Blog", "/blog"],
  ["Pricing", "/pricing"],
];

/* Bar heights for a spoken answer; the tail is what each error does to it. */
const LIVE = [22, 38, 54, 30, 70, 46, 82, 58, 36, 64, 90, 52, 40, 74, 48, 28, 60, 44, 34, 20];

type Mode = "lost" | "broken";

function Line({ mode }: { mode: Mode }) {
  const bars = Array.from({ length: 36 }, (_, n) => {
    if (mode === "lost") return n < LIVE.length ? { h: LIVE[n], s: "live" } : { h: 3, s: "flat" };
    if (n < 12) return { h: LIVE[n], s: "live" };
    if (n < 16) return { h: 3, s: "gap" };
    return { h: LIVE[n - 4] ?? LIVE[n % LIVE.length], s: "ghost" };
  });
  return (
    <div className={`er-line er-${mode}`} aria-hidden="true">
      {bars.map((b, n) => <i key={n} className={`s-${b.s}`} style={{ height: `${b.h}%`, ...delay(n % 8) }} />)}
      {mode === "lost" ? <u className="er-cur" /> : null}
    </div>
  );
}

const errorCss = `
.er-hero { padding: 88px 0 120px; }
.er-g { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 64px; align-items: center; }
.er-g > * { min-width: 0; }
.er-code { display: block; margin: 20px 0 0; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 120px; line-height: .9; font-weight: 600; letter-spacing: -0.05em; color: var(--btn); font-variant-numeric: tabular-nums; }
.er-h1 { margin: 20px 0 0; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 52px; line-height: 1.08; letter-spacing: -0.025em; font-weight: 600; text-wrap: balance; color: var(--ink); }
.er-lede { margin: 16px 0 0; max-width: 46ch; font-size: 18px; line-height: 1.55; color: var(--ink-2); text-wrap: pretty; }
.er-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.er-ref { display: inline-flex; align-items: center; gap: 10px; margin-top: 24px; padding: 8px 8px 8px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--wash); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: .02em; color: var(--ink-2); }
.er-ref button { font: inherit; font-family: inherit; color: var(--btn); background: var(--white); border: 1px solid var(--line); border-radius: 7px; padding: 4px 10px; cursor: pointer; }
.er-ref button:hover { border-color: var(--btn); }
.er-try { margin-top: 40px; }
.er-try h2 { margin: 0; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.er-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.er-chips a { display: inline-flex; align-items: center; padding: 8px 14px; border: 1px solid var(--line); border-radius: 99px; background: var(--white); font-size: 14px; font-weight: 500; color: var(--ink); transition: border-color .15s, color .15s; }
.er-chips a:hover { border-color: var(--btn); color: var(--btn); }
.er-stage { position: relative; aspect-ratio: 1 / .86; border-radius: 28px; border: 1px solid var(--line); background: linear-gradient(135deg, oklch(0.945 0.04 55) 0%, oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285) 100%); display: grid; place-items: center; padding: 8%; overflow: hidden; }
.er-line { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%; height: 44%; }
.er-line i { flex: 1; min-width: 0; border-radius: 99px; background: var(--btn); }
.er-line i.s-live { transform-origin: center; animation: er-breathe 1.9s ease-in-out infinite; animation-delay: calc(var(--i, 0) * 90ms); }
.er-line i.s-flat { background: oklch(0.2 0.05 280 / 0.28); }
.er-line i.s-gap { background: none; border: 1.5px dashed oklch(0.36 0.135 278 / 0.5); height: 14% !important; border-radius: 4px; }
.er-line i.s-ghost { background: oklch(0.36 0.135 278 / 0.18); }
.er-cur { position: absolute; left: calc(55.5% + 1px); top: 12%; bottom: 12%; width: 2px; border-radius: 2px; background: var(--btn); animation: er-blink 1.1s steps(1) infinite; }
@keyframes er-breathe { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(.62); } }
@keyframes er-blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .er-line i.s-live, .er-cur { animation: none; } }
@container (max-width: 900px) {
  .er-hero { padding: 48px 0 72px; }
  .er-g { grid-template-columns: minmax(0, 1fr); gap: 40px; }
  .er-code { font-size: 88px; }
  .er-h1 { font-size: 34px; }
  .er-lede { font-size: 16px; }
  .er-cta .hx-btn { flex: 1 1 auto; justify-content: center; }
  .er-stage { aspect-ratio: 1 / .62; }
}
`;

function Frame({ kicker, code, title, body, mode, children }: { kicker: string; code: string; title: React.ReactNode; body: string; mode: Mode; children: React.ReactNode }) {
  const hero = useReveal<HTMLDivElement>();
  return (
    <section className="er-hero">
      <style>{errorCss}</style>
      <div ref={hero.ref} className={`hx-wrap hx-rv${hero.on ? " on" : ""}`}>
        <div className="er-g">
          <div>
            <span className="hx-kicker hx-ri" style={delay(0)}>{kicker}</span>
            <b className="er-code hx-ri" style={delay(1)}>{code}</b>
            <h1 className="er-h1 hx-ri" style={delay(2)}>{title}</h1>
            <p className="er-lede hx-ri" style={delay(3)}>{body}</p>
            {children}
          </div>
          <Skel className="er-stage hx-ri" style={delay(2)}><Line mode={mode} /></Skel>
        </div>
      </div>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <Shell>
      <Frame kicker="404 · Page not found" code="404" mode="lost" title="That page dropped off the line." body="The link may be old or mistyped. Head home, or jump to one of the places people usually come for.">
        <div className="er-cta hx-ri" style={delay(4)}>
          <a data-no-underline className="hx-btn lg" href="/">Back to home <Arrow /></a>
          <a data-no-underline className="hx-btn lg alt" href={`mailto:${MAIL}`}>Report a broken link</a>
        </div>
        <div className="er-try hx-ri" style={delay(5)}>
          <h2>Try one of these</h2>
          <div className="er-chips">{PATHS.map(([l, h]) => <a data-no-underline key={h} href={h}>{l}</a>)}</div>
        </div>
      </Frame>
    </Shell>
  );
}

export function ServerErrorPage({ digest = "1834920571", onRetry }: { digest?: string; onRetry?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    try {
      navigator.clipboard.writeText(digest).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }, () => undefined);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <Shell>
      <Frame kicker="500 · Something broke" code="500" mode="broken" title="That one is on us." body="We hit an unexpected error. Trying again clears it most of the time. If it keeps happening, send us the reference below and we will look into it.">
        <div className="er-cta hx-ri" style={delay(4)}>
          <button type="button" className="hx-btn lg" onClick={onRetry}>Try again</button>
          <a data-no-underline className="hx-btn lg alt" href="/">Back to home</a>
          <a data-no-underline className="hx-btn lg alt" href={`mailto:${MAIL}?subject=Error%20${digest}`}>Contact support</a>
        </div>
        {digest ? (
          <div className="er-ref hx-ri" style={delay(5)}>
            <span>Reference {digest}</span>
            <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          </div>
        ) : null}
      </Frame>
    </Shell>
  );
}

/* Rendered when the root layout itself crashed, so it deliberately avoids Shell, providers and web fonts. */
export function GlobalErrorPage({ digest = "1834920571" }: { digest?: string }) {
  return (
    <div className="hx" style={{ minHeight: 720, display: "grid", placeItems: "center", padding: 32, background: "var(--white)" }}>
      <style>{errorCss}</style>
      <div style={{ maxWidth: 520 }}>
        <span className="hx-kicker">Something broke</span>
        <h1 className="er-h1">HireStepX could not load.</h1>
        <p className="er-lede">Reload the page to try again. If it keeps happening, email {MAIL} with the reference below.</p>
        <div className="er-cta">
          <button type="button" className="hx-btn lg" onClick={() => undefined}>Reload</button>
          <a data-no-underline className="hx-btn lg alt" href={`mailto:${MAIL}`}>Email support</a>
        </div>
        <div className="er-ref"><span>Reference {digest}</span></div>
      </div>
    </div>
  );
}
