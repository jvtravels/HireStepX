"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Shell, Close, Arrow } from "./Pages";
import "./sx.css";
import { Vis, KIND_LABEL } from "./Resources";
import { Scene } from "./ResourceScenes";
import type { Item as ResItem } from "./resourcesData";
import Skel from "./Skel";
import { FaqBlock } from "./Extra";
import { delay, useReveal } from "./motion";
import type { Item } from "./resourcesData";
import { captureClientEvent } from "../posthogClient";
import type { BlogPost } from "../../data/blog-posts";
import type { BlogMeta } from "../blog-meta";
import type { COMPANY_META } from "../../data/company-salary-overrides";
import type { COMPANY_KNOWN_FACTS } from "../../data/company-known-facts";
import type { buildSalaryPageModel } from "../../app/(marketing)/salary/[company]/_jsonld";
import type { buildQuestionsPageModel } from "../../app/(marketing)/questions/[slug]/_jsonld";
import type { SalaryBandRow } from "../marketing-v2/SalaryPage";
import { questionHref } from "../seoLinks";
import { displayFrameworkName, stripEndPunct } from "../../data/_seo-text-helpers";

/* ── Shared helpers ── */

function RangeBar({ min, max, scale }: { min: number; max: number; scale: number }) {
  return <i style={{ left: `${(min / scale) * 100}%`, width: `${((max - min) / scale) * 100}%` }} />;
}

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p,
  );
}

function Prose({ text, labels = false }: { text: string; labels?: boolean }) {
  const blocks = text.split(/\n\n+/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ""))}</li>)}</ul>;
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return <ol key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>)}</ol>;
        }
        const lab = labels ? b.match(/^([A-Z][A-Za-z' ]{2,24}):\s+([\s\S]+)$/) : null;
        if (lab) return <p key={i} className="sa-lab"><span>{lab[1]}</span><span>{inline(lab[2].replace(/\n/g, " "))}</span></p>;
        const flat = b.replace(/\n/g, " ");
        if (flat.length > 380) {
          /* Walls of "Label: text. Label: text." read better as a list. */
          const items = flat.split(/(?<=[.!?]) (?=[A-Z][A-Za-z' \-/()]{2,34}: )/);
          if (items.length >= 3) {
            return (
              <ul key={i} className="sa-defs">
                {items.map((it, j) => {
                  const m = it.match(/^([^:]{3,36}):\s+([\s\S]+)$/);
                  return <li key={j}>{m ? <><b>{m[1]}.</b> {inline(m[2])}</> : inline(it)}</li>;
                })}
              </ul>
            );
          }
        }
        if (flat.length > 750) {
          const sentences = flat.match(/[^.!?]+[.!?]+(?:\s+|$)/g);
          if (sentences && sentences.length >= 5) {
            const per = Math.ceil(sentences.length / Math.ceil(flat.length / 450));
            const chunks: string[] = [];
            for (let k = 0; k < sentences.length; k += per) chunks.push(sentences.slice(k, k + per).join("").trim());
            return <Fragment key={i}>{chunks.map((c, j) => <p key={j}>{inline(c)}</p>)}</Fragment>;
          }
        }
        return <p key={i}>{inline(flat)}</p>;
      })}
    </>
  );
}

function Related({ title, items, limit = 3 }: { title: string; items: { item: Item; meta: string }[]; limit?: number }) {
  return (
    <section className="sx-rel">
      <h2 className="sx-h2">{title}</h2>
      <ul className="lb-grid">
        {items.slice(0, limit).map(({ item: i, meta }) => (
          <li key={i.h}>
            <article className={`lb-card k-${i.k}`}>
              <Vis i={i} />
              <div className="lb-body">
                <span className={`lb-chip k-${i.k}`}>{KIND_LABEL[i.k]}</span>
                <b><a data-no-underline className="lb-link" href={i.h}>{i.t}</a></b>
                <div className="lb-foot"><small>{meta}</small><span className="lb-go" aria-hidden="true"><Arrow /></span></div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export type FaqKind = "article" | "salary" | "questions" | "hub";
const FAQ_COPY: Record<FaqKind, { kicker: string; title: React.ReactNode }> = {
  article: { kicker: "Quick answers", title: <>Before you close <b>this tab</b>.</> },
  salary: { kicker: "Pay, explained", title: <>What the numbers <b>really mean</b>.</> },
  questions: { kicker: "Prep notes", title: <>How to <b>walk in ready</b>.</> },
  hub: { kicker: "Good to know", title: <>The short <b>version</b>.</> },
};

function HeroScene({ item }: { item: ResItem }) {
  return (
    <div className={`sx-scene k-${item.k}`} aria-hidden="true">
      <div className="sx-scene-in">{Scene({ i: item }) ?? <Vis i={item} />}</div>
    </div>
  );
}

export function Faqs({ items, kind = "hub" }: { items: { q: string; a: string }[]; kind?: FaqKind }) {
  if (items.length === 0) return null;
  const c = FAQ_COPY[kind];
  return <FaqBlock id="faq" kicker={c.kicker} title={c.title} qa={items.map((f): [string, string] => [f.q, f.a])} jsonLd={false} />;
}

const HUBS = [
  ["Interview questions", "/questions"], ["Company guides", "/companies"], ["Salary guides", "/salary"], ["Blog", "/blog"],
  ["Interview preparation", "/interview-prep"], ["AI mock interview", "/ai-mock-interview"],
];

export function Hubs() {
  return (
    <nav className="sx-hubs" aria-label="Browse HireStepX">
      {HUBS.map(([l, h]) => <a key={h} data-no-underline href={h}>{l}</a>)}
    </nav>
  );
}

function Explore({ links }: { links: { label: string; href: string }[] }) {
  if (links.length === 0) return null;
  return (
    <section className="sx-explore" aria-label="Explore more">
      <h2 className="sx-h2">Explore more</h2>
      <div>{links.map((l) => <a key={l.href} data-no-underline href={l.href}>{l.label} <Arrow /></a>)}</div>
    </section>
  );
}

/* ── Interactive heroes ── */

const topicLabel = (h: string) => h.replace(/^\d+\.\s*/, "");

function Toc({ sections, active, onGo }: { sections: { heading: string }[]; active: string; onGo: (id: string) => void }) {
  const idx = Math.max(0, sections.findIndex((s) => slugify(s.heading) === active));
  return (
    <nav className="sx-toc sa-toc" aria-label="In this guide">
      <span className="sx-mono">In this guide</span>
      <div className="sa-rail">
        <i className="sa-thumb" style={{ transform: `translateY(${idx * 36}px)` }} aria-hidden="true" />
        {sections.map((s) => {
          const id = slugify(s.heading);
          return <a key={s.heading} data-no-underline href={`#${id}`} onClick={() => onGo(id)} aria-current={id === active ? "true" : undefined}>{topicLabel(s.heading)}</a>;
        })}
      </div>
    </nav>
  );
}

function Sec({ s, open, toggle }: { s: { heading: string; content: string }; open: boolean; toggle: () => void }) {
  const { ref, on } = useReveal<HTMLElement>();
  const id = slugify(s.heading);
  const num = s.heading.match(/^(\d+)\.\s*/);
  return (
    <section ref={ref} id={id} className="sa-card" data-on={on ? "1" : "0"} data-open={open ? "1" : "0"}>
      <button type="button" className="sa-head" aria-expanded={open} aria-controls={`${id}-body`} onClick={toggle}>
        {num && <span className="sa-num">{num[1].padStart(2, "0")}</span>}
        <h2>{topicLabel(s.heading)}</h2>
        <span className="sa-chev" aria-hidden="true" />
      </button>
      <div className="sa-fold" id={`${id}-body`} inert={!open}>
        <div className="sa-prose"><Prose text={s.content} labels /></div>
      </div>
    </section>
  );
}

function FlipDeck({ questions, framework, company, href }: { href: string; questions: { text: string; difficulty?: string; styleNote?: string }[]; framework: { name: string; summary: string }; company: string }) {
  const deck = questions.slice(0, 10);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const q = deck[i];
  const steps = framework.summary.split(/\s*→\s*/).filter(Boolean);
  const go = (n: number) => { setI(n); setFlip(false); };
  return (
    <div className="sx-x sx-deck">
      <div className="sx-x-top">
        <span className="sx-mono">Try it · {company} question {i + 1} of {deck.length}</span>
        <div className="sx-dots" aria-hidden="true">{deck.map((_, n) => <i key={n} data-on={n === i ? "1" : n < i ? "p" : "0"} />)}</div>
      </div>
      {!flip ? (
        <div className="sx-x-face">
          {q.difficulty && <em data-d={q.difficulty}>{DIFF[q.difficulty]}</em>}
          <p className="sx-x-q">{q.text}</p>
          <span className="sx-x-hint">Think of your answer first, then reveal how to structure it.</span>
          <button type="button" className="hx-btn" onClick={() => setFlip(true)}>Reveal the framework</button>
        </div>
      ) : (
        <div className="sx-x-face sx-x-back">
          <span className="sx-mono">{displayFrameworkName(framework.name)} framework</span>
          <ol className="sx-x-steps">{steps.map((st) => <li key={st}>{st}</li>)}</ol>
          {q.styleNote && <span className="sx-x-hint">{q.styleNote}</span>}
          <button type="button" className="sx-x-link" onClick={() => setFlip(false)}>Back to the question</button>
        </div>
      )}
      <div className="sx-x-nav">
        <button type="button" onClick={() => go(Math.max(0, i - 1))} disabled={i === 0}>Previous</button>
        <a data-no-underline href={href}>Practise this out loud</a>
        <button type="button" onClick={() => go(Math.min(deck.length - 1, i + 1))} disabled={i === deck.length - 1}>Next question</button>
      </div>
    </div>
  );
}

/* ── 1. Blog article / guide ── */

export type ArticleTemplateProps = { post: BlogPost; explore: { label: string; href: string }[]; related: BlogMeta[] };

export function ArticleTemplate({ post, explore, related }: ArticleTemplateProps) {
  const slug = post.slug;
  const ids = post.sections.map((x) => slugify(x.heading));
  const [active, setActive] = useState(ids[0]);
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(ids.map((i) => [i, i === ids[0]])));
  const allOpen = ids.every((i) => open[i]);
  const bar = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLElement>(null);

  useEffect(() => {
    captureClientEvent("blog_post_view", { slug: post.slug, title: post.title, category: post.category });
  }, [post.slug, post.title, post.category]);

  useEffect(() => {
    const els = ids.map((i) => document.getElementById(i)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).sort((x, y) => x.boundingClientRect.top - y.boundingClientRect.top)[0];
        if (hit) setActive(hit.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = art.current;
      if (!el || !bar.current) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = Math.min(1, Math.max(0, (vh * 0.4 - r.top) / Math.max(1, r.height - vh * 0.2)));
      bar.current.style.setProperty("--rp", p.toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <Shell active="resources">
      <div className="sa-bar" ref={bar} aria-hidden="true"><i /></div>
      <header className="sx-hero sa-hero">
        <div className="hx-wrap">
          <span className="sx-mono sx-kick sa-in" style={delay(0)}>{post.category}</span>
          <h1 className="sx-h1 sa-in" style={delay(1)}>{post.title}</h1>
          <p className="sx-dek sa-in" style={delay(2)}>{post.metaDescription}</p>
          <Byline />
          <div className="sx-meta sa-in" style={delay(3)}>
            <span>{post.company}</span>
            <span>{fmtDate(post.datePublished)}</span>
            {post.dateModified && post.dateModified !== post.datePublished && <span>Updated {fmtDate(post.dateModified)}</span>}
            <span>{post.readTime} read</span>
            <span>{post.sections.length} sections</span>
          </div>
          <div className="sx-cover sa-in" style={delay(4)}><HeroScene item={{ k: "guide", t: post.title, h: "", co: post.company, tag: post.category }} /></div>
        </div>
      </header>
      <section className="sa-body">
        <div className="hx-wrap sa-grid">
          <Toc sections={post.sections} active={active} onGo={(id) => setOpen((o) => ({ ...o, [id]: true }))} />
          <article className="sa-article" ref={art}>
            <p className="sa-intro">{post.intro}</p>
            <div className="sa-tools">
              <span className="sx-mono">{post.sections.length} sections</span>
              <button type="button" onClick={() => setOpen(Object.fromEntries(ids.map((i) => [i, !allOpen])))}>{allOpen ? "Collapse all" : "Expand all"}</button>
            </div>
            {post.sections.map((s, n) => {
              const id = ids[n];
              return <Sec key={s.heading} s={s} open={!!open[id]} toggle={() => setOpen((o) => ({ ...o, [id]: !o[id] }))} />;
            })}
          </article>
        </div>
      </section>
      <Faqs kind="article" items={post.faqs.map((f) => ({ q: f.question, a: f.answer }))} />
      <div className="hx-wrap sx-after">
        <Explore links={explore} />
        {related.length > 0 && (
          <Related title="Continue reading" limit={6} items={related.map((b) => ({ item: { k: "guide", t: b.title, h: `/blog/${b.slug}`, co: b.company, tag: b.category }, meta: `${b.category} · ${b.readTime}` }))} />
        )}
      </div>
      <Hubs />
      <Close kicker="Practice" title={<>Know the answer. <b>Now say it.</b></>} body={post.cta} primary={["Start a free interview", "/signup"]} />
    </Shell>
  );
}

/* ── 2. Salary page ── */

const LVL: Record<string, string> = { entry: "Entry", mid: "Mid", senior: "Senior", lead: "Lead", executive: "Executive" };
const lpa = (n: number) => `${n % 1 ? n.toFixed(1) : n}`;

function Ladder({ bands }: { bands: SalaryBandRow[] }) {
  const max = Math.max(...bands.map((b) => b.totalMax));
  return (
    <div className="sx-ladder" role="img" aria-label="Total CTC range by level">
      {bands.map((b) => (
        <div key={b.level} className="sx-lrow">
          <span className="sx-llab">{LVL[b.level] ?? b.levelLabel}</span>
          <div className="sx-ltrack">
            <RangeBar min={b.totalMin} max={b.totalMax} scale={max} />
          </div>
          <span className="sx-lval">{lpa(b.totalMin)} to {lpa(b.totalMax)} LPA</span>
        </div>
      ))}
    </div>
  );
}

function LevelExplorer({ roles, ri, setRi, li, setLi }: { roles: { roleKey: string; roleLabel: string; bands: SalaryBandRow[] }[]; ri: number; setRi: (n: number) => void; li: number; setLi: (n: number) => void }) {
  const role = roles[ri] ?? roles[0];
  const idx = Math.min(li, role.bands.length - 1);
  const b = role.bands[idx];
  const max = Math.max(...role.bands.map((x) => x.totalMax));
  const range = (a?: number | null, z?: number | null, none = "Not reported") => (a != null && z != null ? `${lpa(a)} to ${lpa(z)} LPA` : none);
  return (
    <div className="sx-x sx-lvl">
      <div className="sx-x-top">
        <label className="sx-x-sel">
          <span className="sx-mono">Role</span>
          <select value={ri} onChange={(e) => { setRi(Number(e.target.value)); }}>
            {roles.slice(0, 10).map((r, n) => <option key={r.roleKey} value={n}>{r.roleLabel}</option>)}
          </select>
        </label>
        <div className="sx-seg" role="tablist" aria-label="Level">
          {role.bands.map((x, n) => (
            <button key={x.level} type="button" role="tab" aria-selected={n === idx} onClick={() => setLi(n)}>{LVL[x.level] ?? x.levelLabel}</button>
          ))}
        </div>
      </div>
      <div className="sx-x-big">{lpa(b.totalMin)} to {lpa(b.totalMax)} <small>LPA total CTC</small></div>
      <div className="sx-x-track" role="img" aria-label={`${lpa(b.totalMin)} to ${lpa(b.totalMax)} LPA`}>
        <RangeBar min={b.totalMin} max={b.totalMax} scale={max} />
      </div>
      <div className="sx-x-trio">
        <div><span className="sx-mono">Base</span><b>{range(b.baseMin, b.baseMax)}</b></div>
        <div><span className="sx-mono">Equity</span><b>{range(b.equityMin, b.equityMax, "None reported")}</b></div>
        <div><span className="sx-mono">Last checked</span><b>{b.lastVerified}</b></div>
      </div>
    </div>
  );
}

export type SalaryTemplateProps = {
  company: string;
  model: NonNullable<ReturnType<typeof buildSalaryPageModel>>;
  meta?: (typeof COMPANY_META)[string];
  facts?: (typeof COMPANY_KNOWN_FACTS)[string];
  related: { slug: string; label: string; band?: { role: string; level: string; min: number; max: number } }[];
  groupLabel: string;
  blogSlug?: string;
  calibrationDate: string;
};

function PeerCompare({ label, headline, related, groupLabel }: { label: string; headline?: { roleLabel: string; bands: SalaryBandRow[] }; related: NonNullable<SalaryTemplateProps["related"]>; groupLabel: string }) {
  const own = headline?.bands[0];
  const rows = [
    ...(own ? [{ slug: "", label, band: { role: headline?.roleLabel ?? "", level: own.levelLabel, min: own.totalMin, max: own.totalMax }, self: true }] : []),
    ...related.filter((r) => r.band).map((r) => ({ ...r, self: false })),
  ];
  const max = Math.max(...rows.map((r) => r.band?.max ?? 0), 1);
  return (
    <section className="sx-cmp">
      <h2 className="sx-h2">{label} vs similar companies</h2>
      <p className="sx-sub">{groupLabel ? `${groupLabel}, ` : ""}{own ? `${own.levelLabel} level, total CTC in LPA.` : "Total CTC in LPA."}</p>
      <div className="sx-cmp-list">
        {rows.map((r) => {
          const cells = (
            <>
              <span className="sx-cmp-name">{r.label}{r.self && <em>This page</em>}</span>
              <span className="sx-cmp-track"><i style={{ left: `${((r.band?.min ?? 0) / max) * 100}%`, width: `${(((r.band?.max ?? 0) - (r.band?.min ?? 0)) / max) * 100}%` }} /></span>
              <span className="sx-cmp-val">{lpa(r.band?.min ?? 0)} to {lpa(r.band?.max ?? 0)}</span>
            </>
          );
          return r.self ? (
            <div key={r.label} className="sx-cmp-row" data-self="1">{cells}</div>
          ) : (
            <a key={r.label} data-no-underline href={`/salary/${r.slug}`} className="sx-cmp-row" data-self="0">{cells}</a>
          );
        })}
      </div>
    </section>
  );
}

/* Importer notes read "AB scrape: Product Manager (n=80); n=80"; show the sample size, not the pipeline label. */
function Byline() {
  return (
    <p className="sx-by">
      By the HireStepX editorial team · <a data-no-underline href="/methodology">How we source and label this</a>
    </p>
  );
}

function readerNote(notes: string): string {
  if (!/^AB scrape/i.test(notes)) return notes;
  const n = notes.match(/n=(\d+)/)?.[1];
  return n ? `Based on ${n} AmbitionBox salary reports.` : "Based on AmbitionBox salary reports.";
}

export function SalaryTemplate({ company, model, meta, facts, related, groupLabel, blogSlug, calibrationDate }: SalaryTemplateProps) {
  const [ri, setRi] = useState(0);
  const [li, setLi] = useState(0);
  const [tab, setTab] = useState<"pay" | "info" | "compare">("pay");
  const { label, roles, faqs, peerComparisons, interviewTeaser, page } = model;
  const headline = roles[0];
  const signup = `/signup?source=salary-seo&company=${encodeURIComponent(company)}&next=${encodeURIComponent(`/interview${headline ? `?role=${encodeURIComponent(headline.roleLabel)}` : ""}`)}`;
  const hasInfo = !!(facts || interviewTeaser || blogSlug);
  const tabs = [{ id: "pay" as const, label: "Pay by level" }, ...(hasInfo ? [{ id: "info" as const, label: "Interview and company" }] : []), ...(related.length > 0 ? [{ id: "compare" as const, label: "Compare companies" }] : [])];
  const tierLabel = (t?: string) => (t === "high" ? "High" : t === "medium" ? "Medium" : t === "low" ? "Low" : "Estimate");
  return (
    <Shell active="resources">
      <header className="sx-hero">
        <div className="hx-wrap">
          <span className="sx-mono sx-kick">Salary guide · India 2026 · checked {calibrationDate}</span>
          <h1 className="sx-h1">{label} salary{/\bIndia\b/.test(label) ? "" : " in India"}</h1>
          <p className="sx-dek">{page.metaDescription}</p>
          <Byline />
          <div className="sx-cover"><HeroScene item={{ k: "salary", t: `${label} salary`, h: "", co: label }} /></div>
          <div className="sx-stats">
            {meta?.noticePeriodDays != null && <div><span className="sx-mono">Notice period</span><b>{meta.noticePeriodDays} <small>days</small></b></div>}
            {meta?.bondPenaltyLpa != null && <div><span className="sx-mono">Bond</span><b>{meta.bondPenaltyLpa} <small>LPA penalty</small></b></div>}
            {roles.length > 1 && <div><span className="sx-mono">Roles covered</span><b>{roles.length}</b></div>}
          </div>
          <LevelExplorer roles={roles} ri={ri} setRi={setRi} li={li} setLi={setLi} />
        </div>
      </header>
      <section className="sx-body">
        {tabs.length > 1 && (
          <div className="hx-wrap sx-tabbar">
            <div className="sx-seg" role="tablist" aria-label="Salary page sections">
              {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
            </div>
          </div>
        )}
        <div className={`hx-wrap sx-grid ${tab === "pay" ? "sx-grid-wide" : "sx-one"}`}>
          <aside className="sx-side" hidden={tab !== "pay" || roles.length < 2}>
            <span className="sx-mono">Role</span>
            <div className="sx-roles">
              {roles.map((r, i) => (
                <a key={r.roleKey} data-no-underline href={`#role-${r.roleKey}`} data-on={i === ri ? "1" : "0"} onClick={(e) => { e.preventDefault(); setRi(i); }}>{r.roleLabel}</a>
              ))}
            </div>
          </aside>
          <div className="sx-main">
            {roles.map((role, i) => {
              const top = role.bands[role.bands.length - 1];
              const peer = peerComparisons[i] ?? null;
              return (
                <section key={role.roleKey} id={`role-${role.roleKey}`} className="sx-role" hidden={tab !== "pay" || i !== ri}>
                  <h2 className="sx-h2">{role.roleLabel} at {label}</h2>
                  <p className="sx-sub">Total CTC by level, in lakhs per annum. Base, variable and equity combined.</p>
                  <Ladder bands={role.bands} />
                  <div className="sx-tablewrap">
                    <table className="sx-table">
                      <thead>
                        <tr><th>Level</th><th>Total CTC</th><th>Base</th><th>Equity</th><th>Confidence</th><th>Last checked</th></tr>
                      </thead>
                      <tbody>
                        {role.bands.map((b) => (
                          <tr key={b.level}>
                            <th>{LVL[b.level] ?? b.levelLabel}</th>
                            <td><b>{lpa(b.totalMin)} to {lpa(b.totalMax)} LPA</b></td>
                            <td>{b.baseMin != null && b.baseMax != null ? `${lpa(b.baseMin)} to ${lpa(b.baseMax)}` : "Not reported"}</td>
                            <td>{b.dataConfidenceTier && b.equityMin != null && b.equityMax != null ? `${lpa(b.equityMin)} to ${lpa(b.equityMax)}` : "Not reported"}</td>
                            <td><span className="sx-badge" data-tier={b.dataConfidenceTier ?? "none"}>{tierLabel(b.dataConfidenceTier)}</span></td>
                            <td>{b.lastVerified}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {top?.notes && <p className="sx-tip"><b>Note.</b> {readerNote(top.notes)}</p>}
                  {peer && (
                    <p className="sx-peer">
                      Peer median for {peer.groupLabel} at this level is {lpa(peer.peerMedianMin)} to {lpa(peer.peerMedianMax)} LPA, across {peer.peerCount} companies.
                    </p>
                  )}
                </section>
              );
            })}
            <div hidden={tab !== "info"}>
            {facts && (
              <section className="sx-snap sx-snap-first">
                <h2 className="sx-h2">{label} snapshot</h2>
                <dl>
                  {facts.scale && <div><dt>Scale</dt><dd>{facts.scale}</dd></div>}
                  {facts.products && facts.products.length > 0 && <div><dt>Products</dt><dd>{facts.products.join(", ")}</dd></div>}
                  {facts.notes && <div><dt>Interview notes</dt><dd>{facts.notes}</dd></div>}
                </dl>
              </section>
            )}
            {interviewTeaser && (
              <section className="sx-teaser">
                <span className="sx-mono">How the interview goes</span>
                <ul>{interviewTeaser.items.map((it) => <li key={it}>{it}</li>)}</ul>
                <a data-no-underline className="sx-link" href={questionHref(interviewTeaser.questionSlug)}>{interviewTeaser.searchPhrase} <Arrow /></a>
              </section>
            )}
            {blogSlug && <p className="sx-peer"><a data-no-underline className="sx-link" href={`/blog/${blogSlug}`}>Read the {label} interview guide <Arrow /></a></p>}
            </div>
            <div hidden={tab !== "compare"}>
              {related.length > 0 && <PeerCompare label={label} headline={headline} related={related} groupLabel={groupLabel} />}
            </div>
          </div>
        </div>
      </section>
      <div className="hx-wrap">
        <p className="sx-peer sx-peer-note">Salary figures are estimates compiled from public, self-reported data and tier benchmarks. They are not offers or guarantees, and actual pay varies by team, level and negotiation.</p>
      </div>
      <Faqs kind="salary" items={faqs} />
      <Hubs />
      <Close kicker="Negotiate" title={<>Walk in knowing <b>your number</b>.</>} body={`Practise the salary conversation with an AI recruiter before the real one, using the ${label} bands above.`} primary={["Practise negotiation", signup]} />
    </Shell>
  );
}

/* ── 3. Question set / company guide ── */

const DIFF: Record<string, string> = { warmup: "Warm-up", standard: "Standard", intense: "Intense" };

export type QuestionSetModel = NonNullable<ReturnType<typeof buildQuestionsPageModel>>;

export function QuestionSetTemplate({ model }: { model: QuestionSetModel }) {
  const { page, questions, companyLabel, focusLabel, relatedPages, salaryTeaser, relatedBlogPosts, visibleFaqs } = model;
  const signup = `/signup?source=questions-seo&company=${encodeURIComponent(page.company)}&focus=${encodeURIComponent(page.focus)}${page.roleFamily ? `&role=${encodeURIComponent(page.roleFamily)}` : ""}&next=${encodeURIComponent(`/interview${page.roleFamily ? `?role=${encodeURIComponent(page.roleFamily)}` : ""}`)}`;
  const free = questions.slice(0, 10);
  const locked = Math.max(0, questions.length - free.length);
  const first = page.intro.split(/(?<=\.)\s/)[0];
  const rest = page.intro.slice(first.length).trim();
  const [tab, setTab] = useState<"qs" | "process" | "framework">("qs");
  const [diff, setDiff] = useState("all");
  const showRounds = !!page.interviewRounds && !(page.recruitmentSteps?.length && page.interviewRounds.every((r) => /^Stage \d+:/.test(r)));
  const hasProcess = !!page.recruitmentSteps?.length || showRounds;
  const fwSteps = page.framework.summary.split(/\s*→\s*/).filter(Boolean);
  const diffCount = (d: string) => free.filter((q) => q.difficulty === d).length;
  const diffs = Object.keys(DIFF).filter((d) => diffCount(d) > 0);
  const tabs = [{ id: "qs" as const, label: `Questions (${questions.length})` }, ...(hasProcess ? [{ id: "process" as const, label: "Interview process" }] : []), { id: "framework" as const, label: "Answer framework" }];
  const intense = questions.filter((q) => q.difficulty === "intense").length;
  return (
    <Shell active="resources">
      <header className="sx-hero">
        <div className="hx-wrap">
          <span className="sx-mono sx-kick">{focusLabel} · {companyLabel}</span>
          <h1 className="sx-h1">{page.searchPhrase}</h1>
          <p className="sx-dek">{first}</p>
          <Byline />
          <div className="sx-stats">
            <div><span className="sx-mono">Questions</span><b>{questions.length}</b></div>
            {page.interviewRounds && <div><span className="sx-mono">Rounds</span><b>{page.interviewRounds.length}</b></div>}
            {intense > 0 && <div><span className="sx-mono">Intense</span><b>{intense} <small>of {questions.length}</small></b></div>}
            <div><span className="sx-mono">Framework</span><b>{displayFrameworkName(page.framework.name)}</b></div>
          </div>
          <Skel><FlipDeck href={signup} questions={questions} framework={page.framework} company={companyLabel} /></Skel>
        </div>
      </header>
      <section className="sx-body">
        <div className="hx-wrap sx-grid sx-grid-q">
          <article className="sx-prose">
            {rest && <p className="sx-lead">{rest}</p>}
            <div className="sx-seg sx-tabs-q" role="tablist" aria-label="Question set sections">
              {tabs.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>)}
            </div>
            <div hidden={tab !== "process"}>
            {page.recruitmentSteps && (
              <section>
                <h2>Recruitment process</h2>
                <ol className="sx-steps">{page.recruitmentSteps.map((s) => <li key={s}>{stripEndPunct(s)}</li>)}</ol>
              </section>
            )}
            {page.interviewRounds && showRounds && (
              <section>
                <h2>Interview rounds</h2>
                <ol className="sx-steps">{page.interviewRounds.map((s) => <li key={s}>{stripEndPunct(s)}</li>)}</ol>
              </section>
            )}
            </div>
            <section hidden={tab !== "framework"}>
              <h2>{displayFrameworkName(page.framework.name)} framework</h2>
              <ol className="sx-x-steps">{fwSteps.map((st) => <li key={st}>{st}</li>)}</ol>
            </section>
            <section hidden={tab !== "qs"}>
              <h2>Practice questions</h2>
              {diffs.length > 1 && (
                <div className="sx-chips" role="group" aria-label="Filter by difficulty">
                  <button type="button" aria-pressed={diff === "all"} onClick={() => setDiff("all")}>All {free.length}</button>
                  {diffs.map((d) => <button key={d} type="button" aria-pressed={diff === d} onClick={() => setDiff(d)}>{DIFF[d]} {diffCount(d)}</button>)}
                </div>
              )}
              <ol className="sx-qs">
                {free.map((q, i) => (
                  <li key={q.text} hidden={diff !== "all" && q.difficulty !== diff}>
                    <span className="sx-mono">{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <p>{q.text}</p>
                      <div className="sx-qm">
                        {q.difficulty && <em data-d={q.difficulty}>{DIFF[q.difficulty]}</em>}
                        {q.styleNote && <small>{q.styleNote}</small>}
                      </div>
                    </div>
                    <a data-no-underline href={signup} className="sx-try">Practise <Arrow /></a>
                  </li>
                ))}
              </ol>
              {locked > 0 && (
                <div className="sx-gate">
                  <b>{locked} more questions</b>
                  <span>Create a free account to see the full set and practise any of them with scoring.</span>
                  <a data-no-underline className="hx-btn" href={signup}>Unlock all questions</a>
                </div>
              )}
            </section>
          </article>
          <aside className="sx-rail">
            <div className="sx-card sx-dark">
              <b>Practise this loop</b>
              <span>An AI interviewer asks the {companyLabel} questions and scores each answer.</span>
              <a data-no-underline className="hx-btn" href={signup}>Start practising</a>
            </div>
            <div className="sx-card">
              <span className="sx-mono">Framework</span>
              <b>{displayFrameworkName(page.framework.name)}</b>
              <p>{page.framework.summary}</p>
            </div>
            {salaryTeaser && (
              <a data-no-underline className="sx-card sx-linkcard" href={`/salary/${page.company}`}>
                <span className="sx-mono">Salary</span>
                <b>{lpa(salaryTeaser.totalMin)} to {lpa(salaryTeaser.totalMax)} LPA</b>
                <p>{salaryTeaser.roleLabel}, {salaryTeaser.levelLabel.toLowerCase()} level</p>
              </a>
            )}
          </aside>
        </div>
      </section>
      <Faqs kind="questions" items={visibleFaqs} />
      <div className="hx-wrap sx-after">
        <Related
          title="More to read"
          items={[
            ...relatedBlogPosts.map((b): { item: Item; meta: string } => ({ item: { k: "guide", t: b.title, h: `/blog/${b.slug}`, }, meta: "Guide" })),
            ...relatedPages.map((r): { item: Item; meta: string } => ({ item: { k: "question", t: r.searchPhrase, h: questionHref(r.slug) }, meta: "Question set" })),
          ]}
        />
      </div>
      <Hubs />
      <Close kicker="Practice" title={<>Rehearse the room <b>before you enter it</b>.</>} body={`Run a mock ${companyLabel} interview and get scored feedback on every answer.`} primary={["Start a free interview", signup]} />
    </Shell>
  );
}

/* ── Styles ── */
