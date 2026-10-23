"use client";
import { useEffect, useRef, useState } from "react";
import { Close, Shell } from "./Pages";
import Skel from "./Skel";
import { delay, reduced, useReveal, useTween } from "./motion";
import { FaqBlock } from "./Extra";

type City = "Delhi" | "Mumbai" | "Bengaluru" | "Kolkata";
type Member = { name: string; role: string; city: City; bio: string; photo?: string; linkedin?: string; x?: string };

const TEAM: Member[] = [
  { name: "Aarav Mehta", role: "Co-founder, Product", city: "Mumbai", bio: "Sat through 40 campus interviews and learned the hard way what practice was missing. Now builds the thing he wished he had." },
  { name: "Ishita Rao", role: "Engineering", city: "Bengaluru", bio: "Ex-fintech engineer who cares about voice that works on a slow connection in a tier-2 city." },
  { name: "Kabir Sen", role: "Interview Coaching", city: "Kolkata", bio: "Ten years of hiring in operations and sales. Writes the rubrics the AI scores against." },
  { name: "Neha Kapoor", role: "Growth and Support", city: "Delhi", bio: "Reads every email that lands in the inbox and replies herself." },
];

/* Positions in the 1000 x 800 map viewBox, projected from real longitude and latitude. */
const SPOT: Record<City, [number, number]> = { Delhi: [372, 249], Mumbai: [268, 485], Bengaluru: [381, 636], Kolkata: [641, 398] };
const LINKS: [City, City][] = [["Delhi", "Mumbai"], ["Mumbai", "Bengaluru"], ["Bengaluru", "Kolkata"], ["Kolkata", "Delhi"], ["Delhi", "Bengaluru"]];

const INDIA = "M307 41 L386 78 L391 152 L415 202 L463 215 L535 252 L623 289 L666 295 L719 297 L791 279 L839 267 L815 292 L803 331 L779 367 L731 374 L708 349 L667 349 L635 391 L628 453 L608 425 L560 467 L499 536 L446 573 L443 635 L433 702 L378 757 L349 722 L318 660 L306 586 L277 511 L265 462 L262 425 L209 442 L173 405 L209 387 L161 375 L185 338 L209 288 L233 263 L257 226 L305 177 L295 115 Z";

const curve = (a: City, b: City) => {
  const [x1, y1] = SPOT[a];
  const [x2, y2] = SPOT[b];
  const mx = (x1 + x2) / 2 + (y2 - y1) * 0.14;
  const my = (y1 + y2) / 2 - (x2 - x1) * 0.14;
  return `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
};

type Stats = { users: number | null; sessions: number | null; companies: number | null; jobs: number | null };

const useStats = (): Stats => {
  const [stats, setStats] = useState<Stats>({ users: null, sessions: null, companies: null, jobs: null });
  useEffect(() => {
    fetch("/api/platform-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { userCount?: number | null; sessionCount?: number | null; companyCount?: number | null; jobCount?: number | null } | null) => {
        if (d) setStats({ users: d.userCount ?? null, sessions: d.sessionCount ?? null, companies: d.companyCount ?? null, jobs: d.jobCount ?? null });
      })
      .catch(() => { /* leave the dashes in place */ });
  }, []);
  return stats;
};

const initials = (name: string) => {
  const parts = name.replace(/[[\]]/g, "").trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
};

const ABOUT_QA: [string, string][] = [
  ["Who is behind HireStepX?", "A small team that works remotely from cities across India. Real people read every piece of feedback and decide what we build next."],
  ["What does practice cost?", "Your first 2 sessions are free, with no card needed. After that a single session is ₹9, and the Sprint Pack is ₹39 for 5 sessions."],
  ["Do companies pay too?", "Yes, and only when they want to talk to someone. Unlocking one candidate is ₹59, or ₹299 for ten."],
  ["What happens to my data?", "Delete your account from Settings. Your profile is hidden from employers right away and your data is erased within 7 days."],
  ["How do I reach the team?", "Write to hello@hirestepx.com or use the contact page. A person reads the inbox and replies within 1 business day, India time."],
];

const ABOUT_STAGE: { cap: string; rows: [string, string][] }[] = [
  { cap: "The team", rows: [["Works", "Remotely, across India"], ["Reads", "Every piece of feedback"], ["Decides", "What we build next"]] },
  { cap: "Candidate pricing", rows: [["First 2 sessions", "Free, no card"], ["One session", "₹9"], ["Sprint Pack", "₹39 for 5 sessions"]] },
  { cap: "Company pricing", rows: [["One candidate", "₹59"], ["Ten candidates", "₹299"], ["Browsing", "Free"]] },
  { cap: "When you delete", rows: [["Right away", "Profile hidden from employers"], ["Within 7 days", "Your data is erased"]] },
  { cap: "Reaching us", rows: [["Email", "hello@hirestepx.com"], ["Reply time", "1 business day"]] },
];

function AboutStage({ i }: { i: number }) {
  const d = ABOUT_STAGE[i] ?? ABOUT_STAGE[0];
  return (
    <div className="hx-priv-stage" aria-live="polite">
      <div className="hx-priv-top"><span className="hx-priv-lab"><i className="hx-gdot" />{ABOUT_QA[i]?.[0] ?? ABOUT_QA[0][0]}</span></div>
      <div className="hx-priv-body" key={i}>
        <div className="hx-priv-card">
          <p className="hx-mini-cap">{d.cap}</p>
          <ol className="hx-pv-steps">
            {d.rows.map(([b, t]) => <li key={b}><b>{b}</b><span>{t}</span></li>)}
          </ol>
        </div>
      </div>
    </div>
  );
}

const WAVE = [10, 22, 14, 30, 18, 36, 24, 12, 28, 16, 32, 20, 26, 14, 22];

const aboutCss = `
.ab-sec { padding: 104px 0 0; }
.ab-head { max-width: 640px; }
.ab-head h2 { margin: 14px 0 0; }
.ab-sub { margin: 14px 0 0; font-size: 17px; line-height: 1.55; color: var(--ink-2); max-width: 48ch; text-wrap: pretty; }

/* hero */
.ab-hero { padding: 88px 0 0; }
.ab-hero-g { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 64px; align-items: center; }
.ab-hero-g > * { min-width: 0; }
.ab-hero .hx-kicker { display: block; }
.ab-h1 { margin: 16px 0 0; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 64px; line-height: 1.03; letter-spacing: -0.03em; font-weight: 600; text-wrap: balance; color: var(--ink); }
.ab-lede { margin: 20px 0 0; max-width: 46ch; font-size: 18px; line-height: 1.55; color: var(--ink-2); text-wrap: pretty; }
.ab-cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.ab-stage { position: relative; display: grid; align-content: start; gap: 0; padding: 40px 36px 44px; border-radius: 28px; border: 1px solid var(--line); background: linear-gradient(135deg, oklch(0.945 0.04 55) 0%, oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285) 100%); overflow: hidden; min-height: 460px; }
.ab-card { background: var(--white); border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 1px 2px oklch(0.2 0.03 280 / 0.04), 0 18px 32px -12px oklch(0.2 0.03 280 / 0.14); }
.ab-q { padding: 20px 22px 22px; display: grid; gap: 14px; max-width: 360px; }
.ab-q em { font-style: normal; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.ab-q p { margin: 0; font-size: 17px; line-height: 1.4; font-weight: 500; color: var(--ink); }
.ab-wave { display: flex; align-items: center; gap: 4px; height: 40px; }
.ab-wave i { flex: 1; min-width: 3px; border-radius: 3px; background: linear-gradient(180deg, oklch(0.72 0.12 285), oklch(0.78 0.1 55)); height: var(--h); transform-origin: center; animation: ab-wave 1.6s ease-in-out infinite; animation-delay: calc(var(--n) * -0.13s); }
@keyframes ab-wave { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.35); } }
.ab-score { position: relative; justify-self: end; margin: -14px 0 0; padding: 16px 18px; display: flex; align-items: center; gap: 14px; animation: ab-float 7s ease-in-out infinite; }
.ab-ring { width: 54px; height: 54px; flex: none; }
.ab-ring circle { fill: none; stroke-width: 6; }
.ab-ring .bg { stroke: oklch(0.93 0.01 285); }
.ab-ring .fg { stroke: oklch(0.62 0.17 285); stroke-linecap: round; stroke-dasharray: 125 163; transform: rotate(-90deg); transform-origin: 50% 50%; animation: ab-ring 2.4s cubic-bezier(.2,.7,.2,1) both; }
@keyframes ab-ring { from { stroke-dasharray: 0 163; } }
.ab-score b { display: block; font-size: 15px; font-weight: 600; color: var(--ink); }
.ab-score span { display: block; margin-top: 2px; font-size: 13px; color: var(--ink-2); }
.ab-hired { position: absolute; left: 36px; bottom: 36px; padding: 12px 16px 12px 12px; display: flex; align-items: center; gap: 12px; animation: ab-float 8s ease-in-out -3s infinite; }
.ab-hired svg { width: 36px; height: 36px; flex: none; padding: 9px; border-radius: 50%; background: oklch(0.94 0.06 160); color: oklch(0.45 0.12 160); }
.ab-hired b { font-size: 14px; font-weight: 600; color: var(--ink); }
.ab-hired span { display: block; font-size: 12.5px; color: var(--ink-2); margin-top: 1px; }
.ab-tag { position: absolute; right: 36px; bottom: 44px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
@keyframes ab-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

/* stats */
.ab-stats { margin-top: 44px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
.ab-stats > * { min-width: 0; }
.ab-stat { position: relative; display: grid; grid-template-rows: 120px auto auto; gap: 14px; padding: 22px 22px 24px; border-radius: 22px; border: 1px solid var(--line); background: var(--white); overflow: hidden; transition: transform .35s cubic-bezier(.2,.7,.2,1), box-shadow .35s; }
.ab-stat:hover { transform: translateY(-4px); box-shadow: 0 18px 32px -14px oklch(0.2 0.03 280 / 0.16); }
.ab-stat:nth-child(1) { background: linear-gradient(160deg, oklch(0.97 0.025 55), var(--white) 70%); }
.ab-stat:nth-child(2) { background: linear-gradient(160deg, oklch(0.97 0.025 320), var(--white) 70%); }
.ab-stat:nth-child(3) { background: linear-gradient(160deg, oklch(0.97 0.025 285), var(--white) 70%); }
.ab-stat:nth-child(4) { background: linear-gradient(160deg, oklch(0.97 0.025 200), var(--white) 70%); }
.ab-stat b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 56px; line-height: 1; font-weight: 600; letter-spacing: -0.03em; color: var(--ink); font-variant-numeric: tabular-nums; }
.ab-stat b.na { color: var(--ink-3); }
.ab-stat span { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.ab-viz { position: relative; display: flex; align-items: flex-end; }
.ab-dots { display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; width: 100%; }
.ab-dots i { aspect-ratio: 1; border-radius: 50%; background: oklch(0.88 0.03 55); opacity: .5; }
.hx-rv.on .ab-dots i { animation: ab-pop .5s cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(var(--n) * 14ms); background: oklch(0.72 0.13 55); opacity: 1; }
.ab-dots i:nth-child(3n) { background: oklch(0.72 0.12 320); }
@keyframes ab-pop { from { transform: scale(0); opacity: 0; } }
.ab-bars { display: flex; align-items: flex-end; gap: 5px; width: 100%; height: 100%; }
.ab-bars i { flex: 1; border-radius: 4px; background: linear-gradient(180deg, oklch(0.72 0.12 320), oklch(0.82 0.08 320)); height: var(--h); transform-origin: bottom; }
.hx-rv.on .ab-bars i { animation: ab-grow .8s cubic-bezier(.2,.7,.2,1) both, ab-wave 2.2s ease-in-out .8s infinite; animation-delay: calc(var(--n) * 40ms), calc(var(--n) * -0.15s); }
@keyframes ab-grow { from { transform: scaleY(0); } }
.ab-orbs { position: relative; width: 100%; height: 100%; }
.ab-orbs i { position: absolute; left: calc(var(--n) * 17%); top: calc(50% - 28px + var(--y)); width: 56px; height: 56px; border-radius: 50%; border: 3px solid var(--white); background: linear-gradient(135deg, oklch(0.82 0.09 285), oklch(0.88 0.07 200)); box-shadow: 0 6px 14px -6px oklch(0.2 0.03 280 / 0.3); }
.ab-orbs i:nth-child(2n) { background: linear-gradient(135deg, oklch(0.85 0.08 55), oklch(0.88 0.07 320)); }
.hx-rv.on .ab-orbs i { animation: ab-drop .7s cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(var(--n) * 90ms); }
@keyframes ab-drop { from { transform: translateY(-30px) scale(.6); opacity: 0; } }
.ab-ladder { display: grid; gap: 8px; width: 100%; align-content: end; }
.ab-ladder i { display: block; height: 14px; border-radius: 7px; width: var(--w); background: linear-gradient(90deg, oklch(0.8 0.09 200), oklch(0.88 0.06 200)); transform-origin: left; }
.hx-rv.on .ab-ladder i { animation: ab-sweep .9s cubic-bezier(.2,.7,.2,1) both; animation-delay: calc(var(--n) * 110ms); }
@keyframes ab-sweep { from { transform: scaleX(0); } }
.ab-stat-note { margin: 18px 0 0; font-size: 13px; color: var(--ink-2); }

/* remote team */
.ab-team-g { margin-top: 48px; display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 56px; align-items: center; }
.ab-team-g > * { min-width: 0; }
.ab-roster { display: grid; gap: 10px; }
.ab-pick { appearance: none; width: 100%; text-align: left; display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 16px; align-items: center; padding: 14px 16px; border-radius: 18px; border: 1px solid var(--line); background: transparent; cursor: pointer; font: inherit; color: inherit; transition: background .3s, border-color .3s, box-shadow .3s, transform .3s cubic-bezier(.2,.7,.2,1); }
.ab-pick:hover { transform: translateX(4px); }
.ab-pick:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.ab-pick[data-on="true"] { background: var(--white); border-color: var(--ink-3); box-shadow: 0 14px 28px -14px oklch(0.2 0.03 280 / 0.22); }
.ab-pic { position: relative; width: 56px; height: 56px; border-radius: 50%; overflow: hidden; display: grid; place-items: center; background: linear-gradient(135deg, oklch(0.945 0.04 55), oklch(0.95 0.035 320) 50%, oklch(0.935 0.045 285)); }
.ab-pic img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ab-pic b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 20px; font-weight: 500; color: var(--ink-3); }
.ab-pick h3 { margin: 0; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 19px; line-height: 1.2; font-weight: 600; letter-spacing: -0.01em; color: var(--ink); }
.ab-meta { display: block; margin-top: 3px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11.5px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.ab-bio { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .4s cubic-bezier(.2,.7,.2,1); grid-column: 2; }
.ab-bio > span { display: block; overflow: hidden; min-height: 0; }
.ab-bio p { margin: 10px 0 0; font-size: 15px; line-height: 1.5; color: var(--ink-2); }
.ab-pick[data-on="true"] .ab-bio { grid-template-rows: 1fr; }
.ab-links { display: flex; gap: 14px; margin-top: 8px; font-size: 13.5px; font-weight: 500; }
.ab-links a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }

.ab-map { position: relative; aspect-ratio: 5 / 4; border-radius: 28px; border: 1px solid var(--line); overflow: hidden; background: linear-gradient(135deg, oklch(0.965 0.025 55) 0%, oklch(0.965 0.022 320) 50%, oklch(0.96 0.03 285) 100%); }
.ab-map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.ab-india { fill: oklch(0.99 0.004 285 / 0.85); stroke: oklch(0.82 0.04 285); stroke-width: 2; stroke-linejoin: round; }
.ab-grid-l { stroke: oklch(0.86 0.02 285 / 0.5); stroke-width: 1; stroke-dasharray: 2 8; }
.ab-pulse { fill: oklch(0.62 0.17 285); stroke: oklch(0.62 0.17 285 / 0.2); stroke-width: 8; }
.ab-link { fill: none; stroke: oklch(0.7 0.1 285 / 0.35); stroke-width: 2; stroke-dasharray: 5 7; transition: stroke .4s, stroke-width .4s; }
.ab-link[data-hot="true"] { stroke: oklch(0.58 0.17 285); stroke-width: 3; stroke-dasharray: none; }
.ab-node { position: absolute; left: var(--x); top: var(--y); transform: translate(-50%, -50%); appearance: none; border: 0; padding: 0; background: none; cursor: pointer; font: inherit; display: grid; justify-items: center; gap: 8px; }
.ab-node:focus-visible { outline: 2px solid var(--ink); outline-offset: 6px; border-radius: 50%; }
.ab-av { position: relative; width: 60px; height: 60px; border-radius: 50%; border: 3px solid var(--white); overflow: hidden; display: grid; place-items: center; background: linear-gradient(135deg, oklch(0.9 0.06 55), oklch(0.9 0.06 320) 50%, oklch(0.88 0.07 285)); box-shadow: 0 10px 22px -8px oklch(0.2 0.03 280 / 0.35); transition: transform .4s cubic-bezier(.2,.7,.2,1); }
.ab-av img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.ab-av b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 20px; font-weight: 500; color: var(--ink-2); }
.ab-node::before { content: ""; position: absolute; left: 50%; top: 30px; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%; border: 2px solid oklch(0.62 0.17 285); opacity: 0; }
.ab-node[data-on="true"]::before { animation: ab-ping 2s ease-out infinite; }
@keyframes ab-ping { from { transform: scale(1); opacity: .7; } to { transform: scale(2); opacity: 0; } }
.ab-node[data-on="true"] .ab-av { transform: scale(1.22); }
.ab-node:hover .ab-av { transform: scale(1.12); }
.ab-node[data-on="true"]:hover .ab-av { transform: scale(1.22); }
.ab-city { padding: 4px 10px; border-radius: 999px; background: var(--white); border: 1px solid var(--line); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); white-space: nowrap; transition: background .3s, color .3s; }
.ab-node[data-on="true"] .ab-city { background: var(--ink); color: var(--white); border-color: var(--ink); }
.ab-live { position: absolute; left: 20px; top: 20px; display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 999px; background: var(--white); border: 1px solid var(--line); font-size: 12.5px; color: var(--ink-2); }
.ab-live i { width: 8px; height: 8px; border-radius: 50%; background: oklch(0.65 0.17 155); animation: ab-blink 1.8s ease-in-out infinite; }
@keyframes ab-blink { 50% { opacity: .35; } }

.hx-rv:not(.on) .ab-node, .hx-rv:not(.on) .ab-map svg { opacity: 0; }
.ab-node, .ab-map svg { transition: opacity .8s ease; }


@media (prefers-reduced-motion: reduce) {
  .ab-wave i, .ab-score, .ab-hired, .ab-pulse, .ab-live i, .ab-node::before, .ab-bars i, .ab-dots i, .ab-orbs i, .ab-ladder i, .ab-ring .fg { animation: none !important; }
  .ab-pulse { display: none; }
}

@container (max-width: 1100px) {
  .ab-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 900px) {
  .ab-sec { padding-top: 72px; }
  .ab-hero { padding-top: 48px; }
  .ab-hero-g { grid-template-columns: minmax(0, 1fr); gap: 36px; }
  .ab-h1 { font-size: 40px; }
  .ab-lede { font-size: 16px; }
  .ab-stage { padding: 20px 18px 24px; border-radius: 22px; min-height: 380px; }
  .ab-score { padding: 12px 14px; }
  .ab-hired { left: 18px; bottom: 18px; }
  .ab-tag { display: none; }
  .ab-stats { gap: 10px; margin-top: 32px; }
  .ab-stat { padding: 16px 14px 18px; grid-template-rows: 84px auto auto; border-radius: 18px; }
  .ab-stat b { font-size: 34px; }
  .ab-stat span { font-size: 10.5px; }
  .ab-orbs i { width: 38px; height: 38px; top: calc(50% - 19px + var(--y)); }
  .ab-team-g { grid-template-columns: minmax(0, 1fr); gap: 28px; margin-top: 32px; }
  .ab-map { order: -1; }
  .ab-av { width: 42px; height: 42px; border-width: 2px; }
  .ab-av b { font-size: 14px; }
  .ab-node::before { width: 42px; height: 42px; top: 21px; margin: -21px 0 0 -21px; }
  .ab-city { font-size: 9.5px; padding: 3px 7px; }
  .ab-live { left: 12px; top: 12px; font-size: 11.5px; }
}
`;

const HeroStage = () => (
  <Skel className="ab-stage hx-ri" style={delay(3)} role="img" aria-label="Sample of a practice interview being scored, then a candidate getting shortlisted">
    <div className="ab-card ab-q">
      <em>Sample question</em>
      <p>Tell me about a time you led without being the manager.</p>
      <div className="ab-wave" aria-hidden="true">{WAVE.map((h, n) => <i key={n} style={{ ["--h" as string]: `${h}px`, ["--n" as string]: n }} />)}</div>
    </div>
    <div className="ab-card ab-score" aria-hidden="true">
      <svg className="ab-ring" viewBox="0 0 60 60"><circle className="bg" cx="30" cy="30" r="26" /><circle className="fg" cx="30" cy="30" r="26" /></svg>
      <div><b>Answer scored</b><span>STAR breakdown ready</span></div>
    </div>
    <div className="ab-card ab-hired" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8.5l3.2 3.2L13 4.8" /></svg>
      <div><b>Shortlisted</b><span>A company saw your proof</span></div>
    </div>
    <span className="ab-tag">Illustration</span>
  </Skel>
);

const STAT_LIVE = ["People practising", "Interviews practised", "Companies hiring", "Roles posted"];

function StatViz({ i }: { i: number }) {
  if (i === 0) return <div className="ab-dots" aria-hidden="true">{Array.from({ length: 30 }, (_, n) => <i key={n} style={{ ["--n" as string]: n }} />)}</div>;
  if (i === 1) return <div className="ab-bars" aria-hidden="true">{[38, 62, 46, 84, 56, 100, 70, 44, 78, 52, 90, 60].map((h, n) => <i key={n} style={{ ["--h" as string]: `${h}%`, ["--n" as string]: n }} />)}</div>;
  if (i === 2) return <div className="ab-orbs" aria-hidden="true">{[0, 1, 2, 3, 4].map((n) => <i key={n} style={{ ["--n" as string]: n, ["--y" as string]: `${n % 2 ? 14 : -14}px` }} />)}</div>;
  return <div className="ab-ladder" aria-hidden="true">{[92, 74, 58, 40].map((w, n) => <i key={n} style={{ ["--w" as string]: `${w}%`, ["--n" as string]: n }} />)}</div>;
}

function StatNumber({ n, on }: { n: number | null; on: boolean }) {
  const v = useTween(on && n !== null ? n : 0, 1400);
  return <b className={n === null ? "na" : ""}>{n === null ? "-" : `${v.toLocaleString("en-IN")}+`}</b>;
}

function RemoteTeam() {
  const { ref, on } = useReveal<HTMLDivElement>();
  const [active, setActive] = useState(0);
  const touched = useRef(false);

  useEffect(() => {
    if (reduced()) return;
    const t = setInterval(() => { if (!touched.current) setActive((a) => (a + 1) % TEAM.length); }, 3600);
    return () => clearInterval(t);
  }, []);

  const pick = (i: number) => { touched.current = true; setActive(i); };
  const hot = TEAM[active].city;

  return (
    <section className="ab-sec">
      <div ref={ref} className={`hx-wrap hx-rv${on ? " on" : ""}`}>
        <div className="ab-head">
          <span className="hx-kicker hx-ri" style={delay(0)}>Our team</span>
          <h2 className="hx-h2 hx-ri" style={delay(1)}>Remote by design, <b>one team</b>.</h2>
          <p className="ab-sub hx-ri" style={delay(2)}>Different cities, one inbox. Tap a face to see who is where.</p>
        </div>
        <div className="ab-team-g hx-ri" style={delay(3)}>
          <div className="ab-roster">
            {TEAM.map((m, i) => (
              <button type="button" className="ab-pick" key={i} data-on={active === i} aria-pressed={active === i} onClick={() => pick(i)} onMouseEnter={() => pick(i)}>
                <span className="ab-pic">{m.photo ? <img src={m.photo} alt="" /> : <b aria-hidden="true">{initials(m.name)}</b>}</span>
                <span>
                  <h3>{m.name}</h3>
                  <span className="ab-meta">{m.role} · {m.city}</span>
                </span>
                <span className="ab-bio">
                  <span>
                    <p>{m.bio}</p>
                    {(m.linkedin || m.x) && (
                      <span className="ab-links">
                        {m.linkedin && <a href={m.linkedin}>LinkedIn</a>}
                        {m.x && <a href={m.x}>X</a>}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            ))}
          </div>
          <Skel className="ab-map">
            <svg viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              {[200, 400, 600].map((y) => <line key={`h${y}`} className="ab-grid-l" x1="0" x2="1000" y1={y} y2={y} />)}
              {[250, 500, 750].map((x) => <line key={`v${x}`} className="ab-grid-l" y1="0" y2="800" x1={x} x2={x} />)}
              <path className="ab-india" d={INDIA} />
              {LINKS.map(([a, b]) => <path key={a + b} className="ab-link" d={curve(a, b)} data-hot={a === hot || b === hot} />)}
              {LINKS.map(([a, b], i) => (
                <circle key={`p${a}${b}`} className="ab-pulse" r="7">
                  <animateMotion dur="5s" begin={`${-i}s`} repeatCount="indefinite" path={curve(a, b)} />
                </circle>
              ))}
            </svg>
            {TEAM.map((m, i) => (
              <button type="button" className="ab-node" key={i} data-on={active === i} aria-label={`${m.name}, ${m.city}`} onClick={() => pick(i)} onMouseEnter={() => pick(i)} style={{ ["--x" as string]: `${SPOT[m.city][0] / 10}%`, ["--y" as string]: `${SPOT[m.city][1] / 8}%` }}>
                <span className="ab-av">{m.photo ? <img src={m.photo} alt="" /> : <b aria-hidden="true">{initials(m.name)}</b>}</span>
                <span className="ab-city">{m.city}</span>
              </button>
            ))}
            <span className="ab-live"><i />Working from {TEAM.length} cities</span>
          </Skel>
        </div>
      </div>
    </section>
  );
}

export function AboutPage() {
  const hero = useReveal<HTMLDivElement>();
  const st = useReveal<HTMLDivElement>();
  const counts = useStats();
  const nums = [counts.users, counts.sessions, counts.companies, counts.jobs];

  return (
    <Shell active="about">
      <style>{aboutCss}</style>
      <section className="ab-hero">
        <div ref={hero.ref} className={`hx-wrap hx-rv${hero.on ? " on" : ""}`}>
          <div className="ab-hero-g">
            <div>
              <span className="hx-kicker hx-ri" style={delay(0)}>About us</span>
              <h1 className="ab-h1 hx-ri" style={delay(1)}>Helping India get <b>hired on proof</b>.</h1>
              <p className="ab-lede hx-ri" style={delay(2)}>HireStepX is where candidates practise interviews out loud, and where companies find people who have already shown what they can do.</p>
              <div className="ab-cta hx-ri" style={delay(3)}>
                <a data-no-underline className="hx-btn lg" href="/signup">Start for free</a>
                <a data-no-underline className="hx-btn lg alt" href="/contact">Book a demo with a founder</a>
              </div>
            </div>
            <HeroStage />
          </div>
        </div>
      </section>

      <section className="ab-sec">
        <div ref={st.ref} className={`hx-wrap hx-rv${st.on ? " on" : ""}`}>
          <div className="ab-head">
            <span className="hx-kicker hx-ri" style={delay(0)}>By the numbers</span>
            <h2 className="hx-h2 hx-ri" style={delay(1)}>Practice that <b>leads somewhere</b>.</h2>
          </div>
          <div className="ab-stats">
            {STAT_LIVE.map((label, i) => (
              <div className="ab-stat hx-ri" style={delay(2 + i)} key={label}>
                <Skel className="ab-viz"><StatViz i={i} /></Skel>
                <StatNumber n={nums[i]} on={st.on} />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="ab-stat-note hx-ri" style={delay(6)}>Live totals, rounded down. Updated hourly.</p>
        </div>
      </section>

      <RemoteTeam />

      <div className="ab-faq">
        <FaqBlock id="about-faq" title={<>Good to <b>know</b>.</>} qa={ABOUT_QA} stage={(i) => <AboutStage i={i} />} />
      </div>

      <div className="ab-close">
        <Close
          kicker="Talk to us"
          title={<>Meet the founders, or <b>start on your own</b>.</>}
          body="Book a demo with a founder and we will walk you through HireStepX, or create a free account and run your first interview today."
          primary={["Start for free", "/signup"]}
          secondary={["Book a demo with a founder", "/contact"]}
          notes={["2 free sessions", "No card needed"]}
        />
      </div>
    </Shell>
  );
}
