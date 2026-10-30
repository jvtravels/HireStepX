"use client";
import { useState } from "react";
import { Shell, Close, Arrow } from "./Pages";
import { Faqs, Hubs, sxCss } from "./SeoTemplates";

export type HubItem = { label: string; href: string; meta?: string };
export type HubSection =
  | { kind: "grid"; id: string; title: string; sub?: string; items: HubItem[]; initial?: number; filter?: boolean }
  | { kind: "steps"; id: string; title: string; sub?: string; items: { title: string; body: string }[] }
  | { kind: "text"; id: string; title: string; paragraphs: string[] }
  | { kind: "table"; id: string; title: string; sub?: string; head: string[]; rows: string[][] };

export type HubProps = {
  kicker: string;
  title: string;
  dek: string;
  crumbs?: { label: string; href?: string }[];
  stats?: { label: string; value: string }[];
  cta?: [string, string];
  sections: HubSection[];
  faqs?: { q: string; a: string }[];
  close: { kicker: string; title: string; body: string; primary: [string, string] };
};

function Grid({ s }: { s: Extract<HubSection, { kind: "grid" }> }) {
  const [q, setQ] = useState("");
  const [all, setAll] = useState(false);
  const term = q.trim().toLowerCase();
  const matched = term ? s.items.filter((i) => `${i.label} ${i.meta ?? ""}`.toLowerCase().includes(term)) : s.items;
  const cap = s.initial ?? 24;
  const shown = all || term ? matched : matched.slice(0, cap);
  return (
    <>
      {s.filter && (
        <label className="hb-find">
          <span className="sx-mono">Filter</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${s.items.length} items`} aria-label={`Filter ${s.title}`} />
        </label>
      )}
      <ul className="hb-grid">
        {shown.map((i) => (
          <li key={i.href + i.label}>
            <a data-no-underline className="hb-card" href={i.href}>
              <b>{i.label}</b>
              {i.meta && <small>{i.meta}</small>}
              <span className="hb-go" aria-hidden="true"><Arrow /></span>
            </a>
          </li>
        ))}
      </ul>
      {term && matched.length === 0 && <p className="hb-none">Nothing matches &ldquo;{q.trim()}&rdquo;.</p>}
      {!term && matched.length > cap && (
        <button type="button" className="hx-btn sm alt hb-more" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${matched.length}`}</button>
      )}
    </>
  );
}

export function HubTemplate({ kicker, title, dek, crumbs, stats, cta, sections, faqs, close }: HubProps) {
  return (
    <Shell active="resources">
      <style>{sxCss + hubCss}</style>
      <header className="sx-hero">
        <div className="hx-wrap">
          {crumbs && crumbs.length > 0 && (
            <nav className="hb-crumbs" aria-label="Breadcrumb">
              {crumbs.map((c, n) => (
                <span key={c.label}>{c.href ? <a data-no-underline href={c.href}>{c.label}</a> : <span aria-current="page">{c.label}</span>}{n < crumbs.length - 1 && <i aria-hidden="true">/</i>}</span>
              ))}
            </nav>
          )}
          <span className="sx-mono sx-kick">{kicker}</span>
          <h1 className="sx-h1">{title}</h1>
          <p className="sx-dek">{dek}</p>
          {stats && stats.length > 0 && (
            <div className="sx-stats">
              {stats.map((s) => <div key={s.label}><span className="sx-mono">{s.label}</span><b>{s.value}</b></div>)}
            </div>
          )}
          {cta && <a data-no-underline className="hx-btn lg hb-cta" href={cta[1]}>{cta[0]}</a>}
        </div>
      </header>
      {sections.length > 2 && (
        <nav className="hb-jump" aria-label="On this page">
          <div className="hx-wrap">
            {sections.map((s) => <a key={s.id} data-no-underline href={`#${s.id}`}>{s.title}</a>)}
            {faqs && faqs.length > 0 && <a data-no-underline href="#faq">FAQ</a>}
          </div>
        </nav>
      )}
      <div className="hx-wrap hb-body">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="hb-sec">
            <h2 className="sx-h2">{s.title}</h2>
            {s.kind !== "text" && s.sub && <p className="sx-sub">{s.sub}</p>}
            {s.kind === "grid" && <Grid s={s} />}
            {s.kind === "steps" && (
              <ol className="hb-steps">
                {s.items.map((i) => <li key={i.title}><b>{i.title}</b><span>{i.body}</span></li>)}
              </ol>
            )}
            {s.kind === "text" && <div className="hb-text">{s.paragraphs.map((p, n) => <p key={n}>{p}</p>)}</div>}
            {s.kind === "table" && (
              <div className="sx-tablewrap">
                <table className="sx-table">
                  <thead><tr>{s.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                  <tbody>{s.rows.map((r, n) => <tr key={n}>{r.map((c, k) => (k === 0 ? <th key={k}>{c}</th> : <td key={k}>{c}</td>))}</tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </div>
      {faqs && <Faqs items={faqs} />}
      <Hubs />
      <Close kicker={close.kicker} title={close.title} body={close.body} primary={close.primary} />
    </Shell>
  );
}

const hubCss = `
.hb-crumbs { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin-bottom: 18px; font-size: 13px; color: var(--ink-3); }
.hb-crumbs a { color: var(--ink-2); }
.hb-crumbs a:hover { color: var(--ink); }
.hb-crumbs i { font-style: normal; margin-left: 6px; }
.hb-cta { margin-top: 28px; }
.hb-jump { border-bottom: 1px solid var(--line); background: var(--white); }
.hb-jump .hx-wrap { display: flex; gap: 8px; overflow-x: auto; padding-top: 14px; padding-bottom: 14px; scrollbar-width: none; }
.hb-jump a { flex: none; padding: 7px 14px; border: 1px solid var(--line); border-radius: 99px; font-size: 14px; color: var(--ink-2); transition: border-color .15s, color .15s; }
.hb-jump a:hover { border-color: var(--btn); color: var(--ink); }
.hb-body { padding-top: 56px; padding-bottom: 24px; }
.hb-sec { margin: 0 0 64px; scroll-margin-top: 96px; }
.hb-find { display: grid; gap: 4px; max-width: 360px; margin: 0 0 20px; }
.hb-find input { padding: 10px 14px; border: 1px solid var(--line-2); border-radius: 12px; background: var(--white); font: inherit; font-size: 15px; color: var(--ink); }
.hb-find input:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.hb-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.hb-card { position: relative; display: grid; gap: 4px; height: 100%; padding: 16px 40px 16px 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--white); color: var(--ink); transition: border-color .15s, box-shadow .2s, transform .2s cubic-bezier(.22,1,.36,1); }
.hb-card b { font-weight: 600; font-size: 15px; line-height: 1.35; }
.hb-card small { font-size: 13px; line-height: 1.45; color: var(--ink-3); }
.hb-card .hb-go { position: absolute; right: 16px; top: 16px; width: 14px; color: var(--ink-3); transition: transform .2s cubic-bezier(.22,1,.36,1), color .15s; }
.hb-card:hover { border-color: var(--btn); box-shadow: 0 8px 24px oklch(0.4 0.12 280 / 0.1); transform: translateY(-2px); }
.hb-card:hover .hb-go { color: var(--btn); transform: translateX(3px); }
.hb-more { margin-top: 20px; }
.hb-none { margin: 16px 0 0; color: var(--ink-3); }
.hb-steps { list-style: none; margin: 0; padding: 0; counter-reset: s; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; }
.hb-steps li { counter-increment: s; display: grid; gap: 8px; align-content: start; padding: 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--white); }
.hb-steps li::before { content: counter(s); width: 26px; height: 26px; border-radius: 50%; background: var(--btn); color: var(--white); font-size: 13px; font-weight: 600; display: grid; place-items: center; }
.hb-steps b { font-weight: 600; font-size: 16px; }
.hb-steps span { font-size: 15px; line-height: 1.55; color: var(--ink-2); }
.hb-text { max-width: 72ch; display: grid; gap: 14px; font-size: 17px; line-height: 1.7; color: var(--ink); }
.hb-text p { margin: 0; }
@media (max-width: 900px) { .hb-body { padding-top: 32px; } .hb-sec { margin-bottom: 44px; } .hb-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); } }
@media (prefers-reduced-motion: reduce) { .hb-card, .hb-card .hb-go { transition: none; } .hb-card:hover { transform: none; } }
`;
