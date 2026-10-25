import type { CSSProperties, ReactNode } from "react";
import Skel from "./Skel";

export type CoverInput = { k: "guide" | "question" | "salary" | "company" | "city" | "topic"; t: string; co?: string; tag?: string; rt?: number; role?: string; focus?: string };

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/* hue pairs for the gradient: warm and cool families that stay inside the 2.0 peach-lavender palette */
const PAIRS: [number, number][] = [[55, 285], [350, 55], [195, 285], [240, 330], [165, 230], [300, 70], [80, 10], [270, 200], [20, 320], [215, 165]];

type G = "chat" | "code" | "chart" | "brief" | "cap" | "target" | "nodes" | "rupee" | "doc" | "mic" | "building" | "pin" | "spark";

const PATHS: Record<G, ReactNode> = {
  chat: <path d="M3 4.5h10v6H8l-3 2.5v-2.5H3z" />,
  code: <path d="M6 4.5L2.5 8 6 11.5M10 4.5L13.5 8 10 11.5" />,
  chart: <path d="M3 13V8m4 5V4m4 9V6.5M14 13H2" />,
  brief: <path d="M2.5 6h11v7h-11zM6 6V4h4v2M2.5 9.5h11" />,
  cap: <path d="M1.5 6.5L8 3.5l6.5 3L8 9.5zM4 8v3c1 1.2 2.4 1.7 4 1.7s3-.5 4-1.7V8" />,
  target: <><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="2.5" /></>,
  nodes: <path d="M8 3v3m0 0H4v3m4-3h4v3M2.5 9h3v3h-3zM10.5 9h3v3h-3zM6.5 1.5h3V4h-3z" />,
  rupee: <path d="M4.5 3.5h7M4.5 6h7M4.5 3.5c3.5 0 4 5-.5 5.5l5 4" />,
  doc: <path d="M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12M6 8h4M6 10.5h4" />,
  mic: <path d="M8 2.5a2 2 0 0 1 2 2V8a2 2 0 0 1-4 0V4.5a2 2 0 0 1 2-2zM4 8a4 4 0 0 0 8 0M8 12v2" />,
  building: <path d="M3.5 13.5v-10h6v10M9.5 6.5h3v7M2 13.5h12M5.5 6h2M5.5 8.5h2M5.5 11h2" />,
  pin: <path d="M8 14c3-3.2 4.5-5.3 4.5-7.3a4.5 4.5 0 0 0-9 0C3.5 8.7 5 10.8 8 14zM8 8.3a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z" />,
  spark: <path d="M8 2l1.4 4.1L13.5 8l-4.1 1.9L8 14l-1.4-4.1L2.5 8l4.1-1.9z" />,
};

const KEYWORDS: [RegExp, G][] = [
  [/system design|architecture|scal/i, "nodes"],
  [/salary|lpa|ctc|pay|offer|negotiat/i, "rupee"],
  [/resume|cv|cover letter/i, "doc"],
  [/sde|software|coding|dsa|python|java|sql|developer|engineer|technical|data/i, "code"],
  [/analyst|finance|quant|analytics|bank/i, "chart"],
  [/product|pm\b|case|strategy|consult/i, "target"],
  [/fresher|campus|graduate|nqt|college/i, "cap"],
  [/behavio|hr\b|tell me|introduce|star\b|leadership|culture/i, "chat"],
  [/experience|career|role|manager|switch|notice/i, "brief"],
  [/mock|voice|speak|aloud|practice/i, "mic"],
];

const pickGlyphs = (c: CoverInput, seed: number): G[] => {
  const hay = `${c.t} ${c.tag ?? ""} ${c.role ?? ""} ${c.focus ?? ""}`;
  const found: G[] = [];
  for (const [re, g] of KEYWORDS) if (re.test(hay) && !found.includes(g)) found.push(g);
  const fallback: G[] = c.k === "salary" ? ["rupee", "chart", "brief"] : c.k === "city" ? ["pin", "building", "brief"] : c.k === "question" ? ["chat", "mic", "target"] : c.k === "company" ? ["building", "target", "chat"] : ["spark", "doc", "chat"];
  for (const g of fallback) if (!found.includes(g)) found.push(g);
  const a = found[0];
  const rest = found.slice(1);
  const r = seed % rest.length;
  return [a, rest[r], rest[(r + 1) % rest.length]];
};

const GENERIC = new Set(["top", "how", "best", "what", "tell", "the", "a", "an", "interview", "resume", "system", "50", "30", "20", "10", "campus", "behavioral", "common", "ace"]);
const monogram = (c: CoverInput): string | null => {
  if (c.co && c.co !== "General") return c.co;
  const w = c.t.split(/[\s:,&-]+/).find((x) => /^[A-Z][A-Za-z.]+$/.test(x) && !GENERIC.has(x.toLowerCase()));
  return c.k === "guide" || c.k === "topic" ? null : w ?? null;
};

const Glyph = ({ g }: { g: G }) => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[g]}</svg>
);

function Mini({ c, seed }: { c: CoverInput; seed: number }) {
  const bars = Array.from({ length: 6 }, (_, n) => 30 + ((seed >>> (n * 3)) % 62));
  if (c.k === "salary") {
    const hi = seed % 6;
    return (
      <div className="sc-mini sc-m-sal">
        <div className="sc-bars">{bars.map((h, n) => <i key={n} className={n === hi ? "hi" : ""} style={{ height: `${h}%` }} />)}</div>
        <span className="sc-lab">Pay by level</span>
      </div>
    );
  }
  if (c.k === "question") {
    const lit = 2 + (seed % 3);
    return (
      <div className="sc-mini sc-m-q">
        <div className="sc-wave">{bars.concat(bars.slice(0, 3)).map((h, n) => <i key={n} style={{ height: `${h}%`, animationDelay: `${n * -0.17}s` }} />)}</div>
        <div className="sc-star">{["S", "T", "A", "R"].map((l, n) => <b key={l} className={n < lit ? "on" : ""}>{l}</b>)}</div>
      </div>
    );
  }
  if (c.k === "company") {
    const n = 3 + (seed % 3);
    return (
      <div className="sc-mini sc-m-co">
        <div className="sc-steps">{Array.from({ length: n }, (_, i) => <i key={i} className={i < n - 1 ? "done" : ""} />)}</div>
        <span className="sc-lab">Rounds</span>
      </div>
    );
  }
  return (
    <div className="sc-mini sc-m-g">
      <b className="sc-line" style={{ width: `${70 + (seed % 25)}%` }} />
      <b className="sc-line" style={{ width: `${45 + ((seed >>> 4) % 35)}%` }} />
      <div className="sc-chk">{[0, 1, 2].map((n) => <span key={n}><i />{n === 2 ? <b style={{ width: "40%" }} /> : <b />}</span>)}</div>
      {c.rt ? <span className="sc-lab">{c.rt} min read</span> : c.tag ? <span className="sc-lab">{c.tag}</span> : null}
    </div>
  );
}

export function SeoCover({ item, hero = false }: { item: CoverInput; hero?: boolean }) {
  const seed = hash(`${item.k}|${item.co ?? ""}|${item.t}`);
  const [h1, h2] = PAIRS[seed % PAIRS.length];
  const layout = (seed >>> 5) % 3;
  const [g1, g2, g3] = pickGlyphs(item, seed >>> 7);
  const mono = monogram(item);
  const style = {
    ["--h1" as string]: h1,
    ["--h2" as string]: h2,
    ["--bx" as string]: `${15 + ((seed >>> 9) % 60)}%`,
    ["--by" as string]: `${10 + ((seed >>> 13) % 60)}%`,
    ["--tilt" as string]: `${((seed >>> 3) % 7) - 3}deg`,
  } as CSSProperties;

  return (
    <Skel className={`sc sc-l${layout}${hero ? " sc-hero" : ""}`} style={style}>
      <span className="sc-in" aria-hidden="true">
        <span className="sc-bg" />
        <span className="sc-tile">
          {mono ? <b>{mono.charAt(0).toUpperCase()}</b> : <Glyph g={g1} />}
          {mono && <em>{mono.length > 14 ? mono.slice(0, 13) + "…" : mono}</em>}
        </span>
        <span className="sc-chip sc-c1"><Glyph g={mono ? g1 : g2} /></span>
        <span className="sc-chip sc-c2"><Glyph g={mono ? g2 : g3} /></span>
        <Mini c={item} seed={seed} />
      </span>
    </Skel>
  );
}

export const coverCss = `
.sc { position: absolute; inset: 0; display: block; container-type: size; overflow: hidden; background: oklch(0.95 0.03 var(--h1)); }
.sc-in { --u: min(1cqw, 1.78cqh); position: absolute; left: 50%; top: 50%; width: calc(var(--u) * 100); height: calc(var(--u) * 56); transform: translate(-50%, -50%); display: block; }
.sc-bg { position: absolute; left: -50cqw; right: -50cqw; top: -50cqh; bottom: -50cqh; background:
  radial-gradient(60% 70% at var(--bx) var(--by), oklch(0.88 0.08 var(--h1) / .9), transparent 70%),
  radial-gradient(55% 65% at calc(100% - var(--bx)) calc(100% - var(--by)), oklch(0.89 0.08 var(--h2) / .9), transparent 70%),
  linear-gradient(135deg, oklch(0.955 0.03 var(--h1)), oklch(0.95 0.035 var(--h2))); }
.sc-bg::after { content: ""; position: absolute; inset: 0; opacity: .55; background: repeating-linear-gradient(100deg, transparent 0 calc(var(--u) * 3.2), oklch(1 0 0 / .35) calc(var(--u) * 3.2) calc(var(--u) * 3.9)); mask-image: linear-gradient(0deg, #000, transparent 55%); -webkit-mask-image: linear-gradient(0deg, #000, transparent 55%); }
.sc-tile, .sc-chip, .sc-mini { position: absolute; background: oklch(1 0 0); box-shadow: 0 calc(var(--u) * .3) calc(var(--u) * 1) oklch(0.2 0.03 280 / .08), 0 calc(var(--u) * 2.4) calc(var(--u) * 5) calc(var(--u) * -1.2) oklch(0.2 0.03 280 / .22); }
.sc-tile { display: flex; align-items: center; justify-content: center; gap: calc(var(--u) * 1.6); color: oklch(0.45 0.1 var(--h1)); font-family: 'Bricolage Grotesque', var(--font-ui), ui-sans-serif, system-ui, sans-serif; }
.sc-tile svg { width: calc(var(--u) * 8); height: calc(var(--u) * 8); }
.sc-tile b { display: grid; place-items: center; width: calc(var(--u) * 8.4); height: calc(var(--u) * 8.4); border-radius: calc(var(--u) * 2.4); font-size: calc(var(--u) * 5); font-weight: 600; color: oklch(0.99 0 0); background: linear-gradient(140deg, oklch(0.66 0.15 var(--h1)), oklch(0.56 0.17 var(--h2))); }
.sc-tile em { font-style: normal; font-size: calc(var(--u) * 3.4); font-weight: 600; letter-spacing: -0.01em; color: oklch(0.25 0.03 280); white-space: nowrap; }
.sc-chip { display: grid; place-items: center; width: calc(var(--u) * 11); height: calc(var(--u) * 11); border-radius: 50%; color: oklch(0.5 0.12 var(--h2)); animation: sc-float 6s ease-in-out infinite; }
.sc-chip svg { width: 52%; height: 52%; }
.sc-c2 { color: oklch(0.52 0.12 var(--h1)); animation-delay: -3s; width: calc(var(--u) * 9); height: calc(var(--u) * 9); }
@keyframes sc-float { 50% { transform: translateY(calc(var(--u) * -1.4)); } }
.sc-mini { padding: calc(var(--u) * 2.2); border-radius: calc(var(--u) * 2.6); display: grid; gap: calc(var(--u) * 1.5); align-content: center; }
.sc-lab { font-family: var(--font-mono), ui-monospace, monospace; font-size: calc(var(--u) * 2.1); letter-spacing: .06em; text-transform: uppercase; color: oklch(0.5 0.02 280); white-space: nowrap; }
.sc-line { display: block; height: calc(var(--u) * 1.5); border-radius: 99px; background: oklch(0.88 0.02 280); }
.sc-line:first-child { background: oklch(0.72 0.1 var(--h1)); }
.sc-chk { display: grid; gap: calc(var(--u) * 1.2); }
.sc-chk span { display: flex; align-items: center; gap: calc(var(--u) * 1.2); }
.sc-chk i { width: calc(var(--u) * 2.2); height: calc(var(--u) * 2.2); border-radius: 50%; background: oklch(0.75 0.12 var(--h2)); flex: none; }
.sc-chk b { display: block; height: calc(var(--u) * 1.2); width: 70%; border-radius: 99px; background: oklch(0.91 0.01 280); }
.sc-bars { display: flex; align-items: flex-end; gap: calc(var(--u) * 1); height: calc(var(--u) * 11); }
.sc-bars i { flex: 1; border-radius: calc(var(--u) * .7); background: oklch(0.88 0.05 var(--h2)); }
.sc-bars i.hi { background: linear-gradient(180deg, oklch(0.66 0.15 var(--h1)), oklch(0.58 0.17 var(--h2))); }
.sc-wave { display: flex; align-items: center; gap: calc(var(--u) * .8); height: calc(var(--u) * 7); }
.sc-wave i { flex: 1; border-radius: 99px; background: linear-gradient(180deg, oklch(0.7 0.13 var(--h1)), oklch(0.75 0.1 var(--h2))); animation: sc-eq 1.8s ease-in-out infinite; }
@keyframes sc-eq { 50% { transform: scaleY(.4); } }
.sc-star { display: flex; gap: calc(var(--u) * 1); }
.sc-star b { flex: 1; display: grid; place-items: center; height: calc(var(--u) * 4.4); border-radius: calc(var(--u) * 1.1); font: 600 calc(var(--u) * 2.4) var(--font-mono), ui-monospace, monospace; background: oklch(0.95 0.01 280); color: oklch(0.55 0.02 280); }
.sc-star b.on { background: oklch(0.62 0.16 var(--h1)); color: oklch(0.99 0 0); }
.sc-steps { display: flex; align-items: center; gap: calc(var(--u) * 1.4); }
.sc-steps i { flex: 1; height: calc(var(--u) * 1.6); border-radius: 99px; background: oklch(0.9 0.02 280); }
.sc-steps i.done { background: oklch(0.68 0.14 var(--h1)); }

/* layout 0: centre tile, chips either side, card low right */
.sc-l0 .sc-tile { left: 50%; top: 20%; transform: translateX(-50%) rotate(var(--tilt)); height: calc(var(--u) * 15); padding: 0 calc(var(--u) * 3.6); border-radius: calc(var(--u) * 7.5); }
.sc-l0 .sc-c1 { left: 12%; top: 30%; }
.sc-l0 .sc-c2 { right: 12%; top: 14%; }
.sc-l0 .sc-mini { right: 12%; bottom: 8%; width: 36%; }
/* layout 1: tile on the left, card on the right */
.sc-l1 .sc-tile { left: 11%; top: 50%; transform: translateY(-50%) rotate(calc(var(--tilt) * -1.4)); flex-direction: column; width: calc(var(--u) * 28); height: calc(var(--u) * 28); border-radius: calc(var(--u) * 6); gap: calc(var(--u) * 2.4); }
.sc-l1 .sc-tile b { width: calc(var(--u) * 11); height: calc(var(--u) * 11); font-size: calc(var(--u) * 6.6); border-radius: calc(var(--u) * 3.2); }
.sc-l1 .sc-tile svg { width: calc(var(--u) * 11); height: calc(var(--u) * 11); }
.sc-l1 .sc-c1 { left: 36%; top: 8%; }
.sc-l1 .sc-c2 { right: 9%; top: 9%; }
.sc-l1 .sc-mini { right: 9%; bottom: 14%; width: 42%; }
/* layout 2: card on the left, tile on the right */
.sc-l2 .sc-tile { right: 10%; top: 24%; transform: rotate(var(--tilt)); height: calc(var(--u) * 14); padding: 0 calc(var(--u) * 3.4); border-radius: calc(var(--u) * 4.4); }
.sc-l2 .sc-c1 { right: 40%; top: 10%; }
.sc-l2 .sc-c2 { right: 16%; bottom: 12%; }
.sc-l2 .sc-mini { left: 9%; top: 50%; transform: translateY(-50%); width: 40%; }

/* hero band */
.sc-hero { position: relative; inset: auto; width: 100%; aspect-ratio: 16 / 6.4; border-radius: 28px; border: 1px solid var(--line); }
.sc-hero .sc-in { --u: min(1cqw, 2.4cqh); width: calc(var(--u) * 100); height: calc(var(--u) * 41.6); }
.sc-hero .sc-in { transform: translate(-50%, -50%) scale(1); }

.lb-card .lb-vis.lb-cov { display: block; position: relative; padding: 0; background: none; overflow: hidden; }
@media (prefers-reduced-motion: reduce) { .sc-chip, .sc-wave i { animation: none; } }
`;
