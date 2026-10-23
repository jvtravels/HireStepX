"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Shell, Close, Arrow } from "./Pages";
import { Vis, KIND_LABEL, resourcesCss } from "./Resources";
import { SeoCover, coverCss } from "./SeoCover";
import Skel from "./Skel";
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

/* ── Shared helpers ── */

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
        return <p key={i}>{inline(b.replace(/\n/g, " "))}</p>;
      })}
    </>
  );
}

function Related({ title, items }: { title: string; items: { item: Item; meta: string }[] }) {
  return (
    <section className="sx-rel">
      <style>{resourcesCss}</style>
      <h2 className="sx-h2">{title}</h2>
      <ul className="lb-grid">
        {items.map(({ item: i, meta }) => (
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

function Faqs({ items }: { items: { q: string; a: string }[] }) {
  if (items.length === 0) return null;
  return (
    <section className="sx-faq" aria-label="Frequently asked questions">
      <h2 className="sx-h2">Frequently asked questions</h2>
      {items.map((f) => (
        <details key={f.q}>
          <summary>{f.q}</summary>
          <p>{f.a}</p>
        </details>
      ))}
    </section>
  );
}

const HUBS = [
  ["Interview questions", "/questions"], ["Company guides", "/companies"], ["Salary guides", "/salary"], ["Blog", "/blog"],
  ["Interview preparation", "/interview-prep"], ["AI mock interview", "/ai-mock-interview"], ["How it works", "/how-it-works"],
  ["Methodology", "/methodology"], ["Grievance officer", "/grievance"],
];

function Hubs() {
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
          <button type="button" className="hx-btn" onClick={() => setFlip(true)}>Reveal the framework <Arrow /></button>
        </div>
      ) : (
        <div className="sx-x-face sx-x-back">
          <span className="sx-mono">{framework.name} framework</span>
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
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(ids.map((i) => [i, true])));
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
      <style>{sxCss + coverCss}</style>
      <div className="sa-bar" ref={bar} aria-hidden="true"><i /></div>
      <header className="sx-hero sa-hero">
        <div className="hx-wrap">
          <span className="sx-mono sx-kick sa-in" style={delay(0)}>{post.category}</span>
          <h1 className="sx-h1 sa-in" style={delay(1)}>{post.title}</h1>
          <p className="sx-dek sa-in" style={delay(2)}>{post.metaDescription}</p>
          <div className="sx-meta sa-in" style={delay(3)}>
            <span>{post.company}</span>
            <span>{fmtDate(post.datePublished)}</span>
            <span>{post.readTime} read</span>
            <span>{post.sections.length} sections</span>
          </div>
          <div className="sx-cover sa-in" style={delay(4)}><SeoCover hero item={{ k: "guide", t: post.title, co: post.company, tag: post.category }} /></div>
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
      <div className="hx-wrap sx-after">
        <Faqs items={post.faqs.map((f) => ({ q: f.question, a: f.answer }))} />
        <Explore links={explore} />
        {related.length > 0 && (
          <Related title="Continue reading" items={related.map((b) => ({ item: { k: "guide", t: b.title, h: `/blog/${b.slug}`, co: b.company, tag: b.category }, meta: `${b.category} · ${b.readTime}` }))} />
        )}
        <p className="sx-allposts"><a data-no-underline href="/blog">All posts <Arrow /></a></p>
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
            <i style={{ left: `${(b.totalMin / max) * 100}%`, width: `${((b.totalMax - b.totalMin) / max) * 100}%` }} />
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
        <i style={{ left: `${(b.totalMin / max) * 100}%`, width: `${((b.totalMax - b.totalMin) / max) * 100}%` }} />
      </div>
      <div className="sx-x-trio">
        <div><span className="sx-mono">Base</span><b>{range(b.baseMin, b.baseMax)}</b></div>
        <div><span className="sx-mono">Equity</span><b>{range(b.equityMin, b.equityMax, "None reported")}</b></div>
        <div><span className="sx-mono">Verified</span><b>{b.lastVerified}</b></div>
      </div>
    </div>
  );
}

export type SalaryTemplateProps = {
  company: string;
  model: NonNullable<ReturnType<typeof buildSalaryPageModel>>;
  meta?: (typeof COMPANY_META)[string];
  facts?: (typeof COMPANY_KNOWN_FACTS)[string];
  related: { slug: string; label: string }[];
  groupLabel: string;
  blogSlug?: string;
  calibrationDate: string;
};

export function SalaryTemplate({ company, model, meta, facts, related, groupLabel, blogSlug, calibrationDate }: SalaryTemplateProps) {
  const [ri, setRi] = useState(0);
  const [li, setLi] = useState(0);
  const { label, roles, faqs, peerComparisons, interviewTeaser, page } = model;
  const headline = roles[0];
  const signup = `/signup?source=salary-seo&company=${encodeURIComponent(company)}&next=${encodeURIComponent(`/interview${headline ? `?role=${encodeURIComponent(headline.roleLabel)}` : ""}`)}`;
  const tierLabel = (t?: string) => (t === "high" ? "High" : t === "medium" ? "Medium" : t === "low" ? "Low" : "Reported");
  return (
    <Shell active="resources">
      <style>{sxCss + coverCss}</style>
      <header className="sx-hero">
        <div className="hx-wrap">
          <span className="sx-mono sx-kick">Salary guide · India 2026 · verified {calibrationDate}</span>
          <h1 className="sx-h1">{label} salary in India</h1>
          <p className="sx-dek">{page.metaDescription}</p>
          <div className="sx-cover"><SeoCover hero item={{ k: "salary", t: `${label} salary`, co: label }} /></div>
          <div className="sx-stats">
            {meta?.noticePeriodDays != null && <div><span className="sx-mono">Notice period</span><b>{meta.noticePeriodDays} <small>days</small></b></div>}
            {meta?.bondPenaltyLpa != null && <div><span className="sx-mono">Bond</span><b>{meta.bondPenaltyLpa} <small>LPA penalty</small></b></div>}
            <div><span className="sx-mono">Roles covered</span><b>{roles.length}</b></div>
          </div>
          <LevelExplorer roles={roles} ri={ri} setRi={setRi} li={li} setLi={setLi} />
        </div>
      </header>
      <section className="sx-body">
        <div className="hx-wrap sx-grid sx-grid-wide">
          <aside className="sx-side">
            <span className="sx-mono">Role</span>
            <div className="sx-roles">
              {roles.map((r, i) => (
                <a key={r.roleKey} data-no-underline href={`#role-${r.roleKey}`} data-on={i === ri ? "1" : "0"} onClick={() => setRi(i)}>{r.roleLabel}</a>
              ))}
            </div>
          </aside>
          <div className="sx-main">
            {roles.map((role, i) => {
              const top = role.bands[role.bands.length - 1];
              const peer = peerComparisons[i] ?? null;
              return (
                <section key={role.roleKey} id={`role-${role.roleKey}`} className="sx-role">
                  <h2 className="sx-h2">{role.roleLabel} at {label}</h2>
                  <p className="sx-sub">Total CTC by level, in lakhs per annum. Base, variable and equity combined.</p>
                  <Ladder bands={role.bands} />
                  <div className="sx-tablewrap">
                    <table className="sx-table">
                      <thead>
                        <tr><th>Level</th><th>Total CTC</th><th>Base</th><th>Equity</th><th>Confidence</th><th>Verified</th></tr>
                      </thead>
                      <tbody>
                        {role.bands.map((b) => (
                          <tr key={b.level}>
                            <th>{LVL[b.level] ?? b.levelLabel}</th>
                            <td><b>{lpa(b.totalMin)} to {lpa(b.totalMax)} LPA</b></td>
                            <td>{b.baseMin != null && b.baseMax != null ? `${lpa(b.baseMin)} to ${lpa(b.baseMax)}` : "Not reported"}</td>
                            <td>{b.equityMin != null && b.equityMax != null ? `${lpa(b.equityMin)} to ${lpa(b.equityMax)}` : "None reported"}</td>
                            <td><span className="sx-badge" data-tier={b.dataConfidenceTier ?? "none"}>{tierLabel(b.dataConfidenceTier)}</span></td>
                            <td>{b.lastVerified}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {top?.notes && <p className="sx-tip"><b>Negotiation note.</b> {top.notes}</p>}
                  {peer && (
                    <p className="sx-peer">
                      Peer median for {peer.groupLabel} at this level is {lpa(peer.peerMedianMin)} to {lpa(peer.peerMedianMax)} LPA, across {peer.peerCount} companies.
                    </p>
                  )}
                </section>
              );
            })}
            {facts && (
              <section className="sx-snap">
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
                <a data-no-underline className="sx-link" href={`/questions/${interviewTeaser.questionSlug}`}>{interviewTeaser.searchPhrase} <Arrow /></a>
              </section>
            )}
            {blogSlug && <p className="sx-peer"><a data-no-underline className="sx-link" href={`/blog/${blogSlug}`}>Read the {label} interview guide <Arrow /></a></p>}
            <Faqs items={faqs} />
          </div>
        </div>
      </section>
      <div className="hx-wrap sx-after">
        {related.length > 0 && (
          <Related title={`Compare ${label} salary with similar companies`} items={related.map((r) => ({ item: { k: "salary", t: `${r.label} salary`, h: `/salary/${r.slug}`, co: r.label }, meta: groupLabel || "Compare pay" }))} />
        )}
      </div>
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
  return (
    <Shell active="resources">
      <style>{sxCss + coverCss}</style>
      <header className="sx-hero">
        <div className="hx-wrap">
          <span className="sx-mono sx-kick">{focusLabel} · {companyLabel}</span>
          <h1 className="sx-h1">{page.searchPhrase}</h1>
          <p className="sx-dek">{first}</p>
          <div className="sx-meta">
            <span>{questions.length} questions</span>
            {page.interviewRounds && <span>{page.interviewRounds.length} rounds</span>}
            <span>Framework: {page.framework.name}</span>
          </div>
          <Skel><FlipDeck href={signup} questions={questions} framework={page.framework} company={companyLabel} /></Skel>
        </div>
      </header>
      <section className="sx-body">
        <div className="hx-wrap sx-grid sx-grid-q">
          <article className="sx-prose">
            {rest && <p className="sx-lead">{rest}</p>}
            {page.recruitmentSteps && (
              <section>
                <h2>Recruitment process</h2>
                <ol className="sx-steps">{page.recruitmentSteps.map((s) => <li key={s}>{s}</li>)}</ol>
              </section>
            )}
            {page.interviewRounds && (
              <section>
                <h2>Interview rounds</h2>
                <ol className="sx-steps">{page.interviewRounds.map((s) => <li key={s}>{s}</li>)}</ol>
              </section>
            )}
            <section>
              <h2>Questions candidates report</h2>
              <ol className="sx-qs">
                {free.map((q, i) => (
                  <li key={q.text}>
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
                  <a data-no-underline className="hx-btn" href={signup}>Unlock all questions <Arrow /></a>
                </div>
              )}
            </section>
            <Faqs items={visibleFaqs} />
          </article>
          <aside className="sx-rail">
            <div className="sx-card sx-dark">
              <b>Practise this loop</b>
              <span>An AI interviewer asks the {companyLabel} questions and scores each answer.</span>
              <a data-no-underline className="hx-btn" href={signup}>Start free <Arrow /></a>
            </div>
            <div className="sx-card">
              <span className="sx-mono">Framework</span>
              <b>{page.framework.name}</b>
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
      <div className="hx-wrap sx-after">
        <Related
          title="More to read"
          items={[
            ...relatedBlogPosts.map((b): { item: Item; meta: string } => ({ item: { k: "guide", t: b.title, h: `/blog/${b.slug}`, }, meta: "Guide" })),
            ...relatedPages.map((r): { item: Item; meta: string } => ({ item: { k: "question", t: r.searchPhrase, h: `/questions/${r.slug}` }, meta: "Question set" })),
          ]}
        />
      </div>
      <Hubs />
      <Close kicker="Practice" title={<>Rehearse the room <b>before you enter it</b>.</>} body={`Run a mock ${companyLabel} interview and get scored feedback on every answer.`} primary={["Start a free interview", signup]} />
    </Shell>
  );
}

/* ── Styles ── */

const sxCss = `
.sa-bar { position: fixed; inset: 0 0 auto 0; height: 3px; z-index: 100; pointer-events: none; }
.sa-bar i { display: block; height: 100%; background: var(--btn); transform-origin: 0 50%; transform: scaleX(var(--rp, 0)); }
@keyframes sa-in { from { transform: translateY(10px); } to { transform: none; } }
.sa-in { animation: sa-in .7s cubic-bezier(.22,1,.36,1) both; animation-delay: calc(var(--i, 0) * 90ms); }
.sa-body { padding: 56px 0 24px; }
.sa-grid { max-width: 1040px; margin-inline: auto; display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 56px; align-items: start; }
.sa-rail { position: relative; display: grid; padding-left: 0; border-left: 2px solid var(--line); }
.sa-toc .sa-rail a { height: 36px; display: flex; align-items: center; padding: 0 0 0 16px; font-size: 14px; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .2s, padding-left .25s cubic-bezier(.22,1,.36,1); }
.sa-toc .sa-rail a:hover { color: var(--ink); padding-left: 20px; }
.sa-toc .sa-rail a[aria-current="true"] { color: var(--ink); font-weight: 500; }
.sa-thumb { position: absolute; left: -2px; top: 0; width: 2px; height: 36px; background: var(--btn); transition: transform .45s cubic-bezier(.22,1,.36,1); }
.sa-article { display: grid; gap: 16px; min-width: 0; }
.sa-intro { margin: 0 0 8px; font-size: 19px; line-height: 1.65; color: var(--ink); }
.sa-tools { display: flex; align-items: center; justify-content: space-between; }
.sa-tools button { font: inherit; font-size: 14px; font-weight: 500; padding: 7px 14px; border: 1px solid var(--line-2); border-radius: 99px; background: var(--white); color: var(--ink); cursor: pointer; transition: border-color .15s, color .15s; }
.sa-tools button:hover { border-color: var(--btn); color: var(--btn); }
.sa-card { border: 1px solid var(--line); border-radius: 20px; background: var(--white); scroll-margin-top: 96px; transition: opacity .6s cubic-bezier(.22,1,.36,1), transform .6s cubic-bezier(.22,1,.36,1), box-shadow .25s, border-color .25s; }
.sa-card[data-on="0"] { opacity: 0; transform: translateY(24px); }
.sa-card:hover { border-color: var(--line-2); box-shadow: 0 1px 2px rgba(20,20,60,.04), 0 12px 32px -16px rgba(20,20,60,.12); }
.sa-head { all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 16px; padding: 22px 28px; cursor: pointer; border-radius: 20px; }
.sa-head:focus-visible { outline: 2px solid var(--btn); outline-offset: 2px; }
.sa-num { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 13px; font-weight: 500; color: var(--btn); padding: 4px 9px; border-radius: 8px; background: var(--wash); }
.sa-card h2 { flex: 1; font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 24px; line-height: 1.25; letter-spacing: -0.02em; font-weight: 500; margin: 0; }
.sa-chev { width: 10px; height: 10px; border-right: 2px solid var(--ink-3); border-bottom: 2px solid var(--ink-3); transform: rotate(45deg); margin-right: 4px; transition: transform .35s cubic-bezier(.22,1,.36,1), border-color .2s; }
.sa-card[data-open="0"] .sa-chev { transform: rotate(-45deg); }
.sa-head:hover .sa-chev { border-color: var(--btn); }
.sa-fold { display: grid; grid-template-rows: 1fr; transition: grid-template-rows .4s cubic-bezier(.22,1,.36,1); }
.sa-card[data-open="0"] .sa-fold { grid-template-rows: 0fr; }
.sa-prose { min-height: 0; overflow: hidden; padding: 0 28px; font-size: 16px; line-height: 1.7; color: var(--ink); }
.sa-card[data-open="1"] .sa-prose { padding-bottom: 28px; }
.sa-prose p, .sa-prose ul, .sa-prose ol { margin: 0 0 14px; }
.sa-prose > :last-child { margin-bottom: 0; }
.sa-prose ul, .sa-prose ol { padding-left: 22px; display: grid; gap: 6px; }
.sa-prose strong { font-weight: 600; }
.sa-prose .sa-lab { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 16px; padding: 14px 12px; margin: 0 -12px; border-top: 1px solid var(--line); border-radius: 10px; transition: background .2s; }
.sa-prose .sa-lab:hover { background: var(--wash); }
.sa-prose .sa-lab span:first-child { padding-top: 3px; font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); transition: color .2s; }
.sa-prose .sa-lab:hover span:first-child { color: var(--btn); }

.sx-mono { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); }
.sx-hero .hx-wrap { text-align: center; display: flex; flex-direction: column; align-items: center; }
.sx-hero { padding: 72px 0 56px; background: var(--wash); border-bottom: 1px solid var(--line); }
.sx-narrow { max-width: 1040px; margin-inline: auto; }
.sx-kick { display: block; margin-bottom: 14px; }
.sx-h1 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 52px; line-height: 1.08; letter-spacing: -0.03em; font-weight: 600; margin: 0 auto; max-width: 960px; text-wrap: balance; }
.sx-h2 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 30px; line-height: 1.15; letter-spacing: -0.02em; font-weight: 500; margin: 0 0 14px; }
.sx-dek { margin: 20px auto 0; max-width: 62ch; font-size: 19px; line-height: 1.55; color: var(--ink-2); }
.sx-cover { position: relative; width: 100%; max-width: 920px; margin-top: 36px; }
.sx-meta { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px 24px; margin-top: 24px; font-size: 14px; color: var(--ink-3); }
.sx-meta span + span::before { content: ''; display: inline-block; width: 3px; height: 3px; border-radius: 50%; background: var(--ink-3); margin-right: 24px; vertical-align: middle; }
.sx-x { width: 100%; max-width: 1040px; margin: 44px auto 0; text-align: left; background: var(--white); border: 1px solid var(--line); border-radius: 20px; box-shadow: 0 1px 2px rgba(20,20,60,.04), 0 12px 32px -16px rgba(20,20,60,.12); }
.sx-x button { font: inherit; cursor: pointer; }
.sx-x-body { font-size: 16px; line-height: 1.65; color: var(--ink); }
.sx-x-body p, .sx-x-body ul, .sx-x-body ol { margin: 0 0 12px; }
.sx-x-body ul, .sx-x-body ol { padding-left: 20px; display: grid; gap: 6px; }
.sx-x-link { align-self: flex-start; padding: 0; border: 0; background: none; font-size: 14px; font-weight: 500; color: var(--btn); }
.sx-x-link:hover { text-decoration: underline; }
.sx-x-nav { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: auto; padding-top: 16px; font-size: 14px; }
.sx-x-nav button { padding: 8px 16px; border: 1px solid var(--line-2); border-radius: 99px; background: var(--white); color: var(--ink); transition: border-color .15s, color .15s; }
.sx-x-nav button:hover:not(:disabled) { border-color: var(--btn); color: var(--btn); }
.sx-x-nav button:disabled { opacity: .4; cursor: default; }
.sx-x-nav a { color: var(--btn); font-weight: 500; }
.sx-x-nav a:hover { text-decoration: underline; }
.sx-x-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; }
.sx-deck, .sx-lvl { padding: 24px 28px; display: flex; flex-direction: column; gap: 20px; }
.sx-dots { display: flex; gap: 6px; }
.sx-dots i { width: 22px; height: 4px; border-radius: 4px; background: var(--line-2); transition: background .2s; }
.sx-dots i[data-on="1"] { background: var(--btn); }
.sx-dots i[data-on="p"] { background: var(--ink-3); }
.sx-x-face { display: flex; flex-direction: column; align-items: flex-start; gap: 14px; min-height: 200px; padding: 28px; border-radius: 16px; background: var(--wash); border: 1px solid var(--line); }
.sx-x-q { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 28px; line-height: 1.25; letter-spacing: -0.02em; font-weight: 500; margin: 0; text-wrap: balance; }
.sx-x-hint { font-size: 14px; color: var(--ink-3); line-height: 1.5; }
.sx-x-face em { font-style: normal; font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 99px; background: var(--white); border: 1px solid var(--line-2); color: var(--ink-2); }
.sx-x-back { background: var(--white); border-color: var(--btn); }
.sx-x-steps { margin: 0; padding: 0; list-style: none; counter-reset: s; display: grid; gap: 10px; font-size: 16px; line-height: 1.5; }
.sx-x-steps li { counter-increment: s; display: grid; grid-template-columns: 28px 1fr; gap: 10px; }
.sx-x-steps li::before { content: counter(s); width: 24px; height: 24px; border-radius: 50%; background: var(--btn); color: var(--white); font-size: 12px; font-weight: 600; display: grid; place-items: center; }
.sx-x-sel { display: grid; gap: 4px; }
.sx-x-sel select { padding: 8px 12px; border: 1px solid var(--line-2); border-radius: 10px; background: var(--white); font: inherit; font-size: 14px; color: var(--ink); }
.sx-seg { display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; border-radius: 99px; background: var(--wash); border: 1px solid var(--line); }
.sx-seg button { padding: 7px 16px; border: 0; border-radius: 99px; background: transparent; font-size: 14px; color: var(--ink-2); transition: background .15s, color .15s; }
.sx-seg button[aria-selected="true"] { background: var(--btn); color: var(--white); }
.sx-x-big { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 48px; line-height: 1.05; font-weight: 600; letter-spacing: -0.03em; }
.sx-x-big small { font-size: 16px; font-weight: 400; color: var(--ink-3); letter-spacing: 0; }
.sx-x-track { position: relative; height: 14px; border-radius: 99px; background: var(--wash); border: 1px solid var(--line); }
.sx-x-track i { position: absolute; top: -1px; bottom: -1px; border-radius: 99px; background: var(--btn); transition: left .35s cubic-bezier(.25,1,.5,1), width .35s cubic-bezier(.25,1,.5,1); }
.sx-x-trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.sx-x-trio div { display: grid; gap: 4px; padding: 14px 16px; border-radius: 14px; background: var(--wash); border: 1px solid var(--line); }
.sx-x-trio b { font-size: 16px; font-weight: 500; }
.sx-body { padding: 64px 0 40px; }
.sx-grid { display: grid; grid-template-columns: 160px 960px; justify-content: center; gap: 40px; align-items: start; }
.sx-grid-wide { grid-template-columns: 260px minmax(0, 1fr); justify-content: stretch; gap: 64px; }
.sx-grid-q { grid-template-columns: minmax(0, 1fr) 340px; justify-content: stretch; gap: 64px; }
.sx-toc, .sx-side { position: sticky; top: 96px; display: grid; gap: 2px; }
.sx-toc .sx-mono, .sx-side .sx-mono { margin-bottom: 8px; }
.sx-toc a { padding: 6px 0; font-size: 14px; line-height: 1.35; color: var(--ink-2); text-decoration: none; }
.sx-toc a:hover, .sx-toc a:focus-visible { color: var(--btn); outline: none; }
.sx-toc a[aria-current="true"] { color: var(--btn); font-weight: 500; }
.sx-prose { min-width: 0; max-width: 960px; font-size: 17px; line-height: 1.7; color: var(--ink); }
.sx-grid-q .sx-prose { max-width: none; }
.sx-prose h2 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 28px; line-height: 1.2; letter-spacing: -0.02em; font-weight: 500; margin: 8px 0 12px; scroll-margin-top: 96px; }
.sx-prose section { margin-top: 48px; }
.sx-prose p, .sx-prose ul, .sx-prose ol { margin: 0 0 16px; }
.sx-prose ul, .sx-prose ol { padding-left: 22px; display: grid; gap: 8px; }
.sx-prose strong { font-weight: 600; }
.sx-q { display: block; margin-bottom: 8px; color: var(--btn); }
.hx-closing .hx-end p { font-size: 16px; line-height: 1.65; max-width: 60ch; text-wrap: pretty; }
.sx-after { padding-bottom: 8px; padding-top: 16px; }
.sx-faq { margin: 40px 0 8px; }
.sx-faq details { border-top: 1px solid var(--line, rgba(0,0,0,.1)); padding: 14px 0; }
.sx-faq details:last-child { border-bottom: 1px solid var(--line, rgba(0,0,0,.1)); }
.sx-faq summary { cursor: pointer; font-weight: 600; font-size: 17px; color: var(--ink); list-style: none; display: flex; justify-content: space-between; gap: 16px; }
.sx-faq summary::-webkit-details-marker { display: none; }
.sx-faq summary::after { content: "+"; color: var(--ink-2); font-weight: 400; }
.sx-faq details[open] summary::after { content: "\\2212"; }
.sx-faq p { margin: 10px 0 0; font-size: 16px; line-height: 1.65; color: var(--ink-2); max-width: 70ch; }
.sx-explore { margin: 40px 0 8px; }
.sx-explore div { display: flex; flex-wrap: wrap; gap: 10px; }
.sx-explore a { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border: 1px solid var(--line, rgba(0,0,0,.12)); border-radius: 999px; font-size: 14px; font-weight: 500; color: var(--ink); }
.sx-explore a:hover { border-color: var(--ink-2); }
.sx-explore .hx-arr { width: 13px; flex: none; }
.sx-hubs { display: flex; flex-wrap: wrap; gap: 8px 20px; max-width: 1040px; margin: 24px auto 0; padding: 0 24px; font-size: 14px; }
.sx-hubs a { color: var(--ink-2); }
.sx-hubs a:hover { color: var(--ink); }
.sx-allposts { margin: 8px 0 0; font-size: 14px; }
.sx-allposts a { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; color: var(--ink); }
.sx-role { margin: 0 0 56px; scroll-margin-top: 96px; }
.sx-rel { margin-top: 24px; padding-bottom: 32px; }
.sx-rel .sx-h2 { text-align: center; margin-bottom: 28px; }
.sx-stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; margin-top: 40px; }
.sx-stats div { text-align: left; display: grid; gap: 6px; min-width: 190px; padding: 18px 22px; border: 1px solid var(--line); border-radius: 16px; background: var(--white); }
.sx-stats b { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 32px; font-weight: 600; letter-spacing: -0.02em; }
.sx-stats small { font-size: 14px; font-weight: 400; color: var(--ink-3); letter-spacing: 0; }
.sx-roles { display: flex; flex-wrap: wrap; gap: 8px; }
.sx-roles a { display: inline-block; padding: 8px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); font: inherit; font-size: 14px; color: var(--ink-2); cursor: pointer; transition: border-color .15s, color .15s, background .15s; }
.sx-roles a:hover { border-color: var(--btn); color: var(--ink); }
.sx-roles a[data-on="1"] { background: var(--btn); border-color: var(--btn); color: #fff; }
.sx-more { width: 100%; font-size: 13px; color: var(--ink-3); margin-top: 4px; }
.sx-main { min-width: 0; }
.sx-sub { margin: 0 0 28px; font-size: 16px; color: var(--ink-2); }
.sx-ladder { display: grid; gap: 14px; padding: 28px; border: 1px solid var(--line); border-radius: 18px; background: var(--white); margin-bottom: 24px; }
.sx-lrow { display: grid; grid-template-columns: 88px minmax(0, 1fr) 150px; gap: 16px; align-items: center; font-size: 14px; }
.sx-llab { color: var(--ink-2); font-weight: 500; }
.sx-ltrack { position: relative; height: 12px; border-radius: 6px; background: var(--wash); }
.sx-ltrack i { position: absolute; top: 0; bottom: 0; border-radius: 6px; background: var(--btn); }
.sx-lval { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
.sx-tablewrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; margin-bottom: 20px; }
.sx-table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 15px; line-height: 1.5; }
.sx-table th, .sx-table td { text-align: left; padding: 14px 18px; border-bottom: 1px solid var(--line); }
.sx-table thead th { background: var(--wash); font-size: 13px; font-weight: 600; color: var(--ink-2); }
.sx-table tbody th { font-weight: 600; white-space: nowrap; }
.sx-table tbody tr:last-child th, .sx-table tbody tr:last-child td { border-bottom: 0; }
.sx-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--wash); color: var(--ink-2); }
.sx-badge[data-tier="high"] { background: oklch(0.94 0.05 160); color: oklch(0.38 0.1 160); }
.sx-badge[data-tier="medium"] { background: oklch(0.95 0.05 85); color: oklch(0.42 0.09 75); }
.sx-tip, .sx-peer { margin: 0 0 14px; font-size: 16px; line-height: 1.6; color: var(--ink-2); }
.sx-tip b { color: var(--ink); }
.sx-snap { margin-top: 56px; }
.sx-snap dl { display: grid; gap: 0; margin: 0; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.sx-snap dl div { display: grid; grid-template-columns: 160px minmax(0, 1fr); gap: 20px; padding: 16px 20px; border-bottom: 1px solid var(--line); }
.sx-snap dl div:last-child { border-bottom: 0; }
.sx-snap dt { font-weight: 600; font-size: 14px; color: var(--ink-2); }
.sx-snap dd { margin: 0; font-size: 15px; line-height: 1.55; }
.sx-teaser { display: grid; gap: 12px; margin-top: 40px; padding: 24px 28px; border: 1px solid var(--line); border-radius: 18px; background: var(--wash); }
.sx-teaser ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; font-size: 15px; line-height: 1.55; }
.sx-link { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; color: var(--btn); }
.sx-link .hx-arr { width: 14px; }
.sx-steps { counter-reset: s; list-style: none; padding: 0 !important; gap: 0 !important; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; }
.sx-steps li { counter-increment: s; display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 14px; padding: 16px 20px; border-bottom: 1px solid var(--line); font-size: 16px; line-height: 1.55; }
.sx-steps li:last-child { border-bottom: 0; }
.sx-steps li::before { content: counter(s, decimal-leading-zero); font-family: 'Geist Mono', ui-monospace, monospace; font-size: 13px; color: var(--btn); padding-top: 3px; }
.sx-qs { list-style: none; padding: 0 !important; gap: 0 !important; border-top: 1px solid var(--line); }
.sx-qs li { display: grid; grid-template-columns: 36px minmax(0, 1fr) auto; gap: 16px; align-items: start; padding: 20px 0; border-bottom: 1px solid var(--line); }
.sx-qs li .sx-mono { padding-top: 4px; color: var(--btn); }
.sx-qs p { margin: 0; font-size: 17px; line-height: 1.5; font-weight: 500; }
.sx-qm { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; margin-top: 8px; }
.sx-qm em { font-style: normal; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; background: var(--wash); color: var(--ink-2); }
.sx-qm em[data-d="intense"] { background: oklch(0.95 0.04 25); color: oklch(0.45 0.12 25); }
.sx-qm small { font-size: 13px; line-height: 1.45; color: var(--ink-3); }
.sx-try { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: var(--btn); padding-top: 3px; opacity: .0; transition: opacity .15s; }
.sx-qs li:hover .sx-try, .sx-qs li:focus-within .sx-try { opacity: 1; }
.sx-try .hx-arr { width: 13px; }
.sx-gate { display: grid; gap: 10px; justify-items: start; margin-top: 20px; padding: 28px; border: 1px dashed var(--line-2, var(--line)); border-radius: 18px; background: var(--wash); }
.sx-gate b { font-size: 20px; font-weight: 600; }
.sx-gate span { font-size: 15px; color: var(--ink-2); max-width: 52ch; }
.sx-rail { position: sticky; top: 96px; display: grid; gap: 16px; }
.sx-card { display: grid; gap: 8px; padding: 22px 24px; border: 1px solid var(--line); border-radius: 18px; background: var(--white); color: var(--ink); }
.sx-card b { font-size: 20px; font-weight: 600; line-height: 1.25; }
.sx-card p { margin: 0; font-size: 15px; line-height: 1.55; color: var(--ink-2); }
.sx-card span:not(.sx-mono) { font-size: 15px; line-height: 1.5; }
.sx-dark { background: var(--btn); border-color: var(--btn); color: #fff; justify-items: start; }
.sx-dark span { color: oklch(0.92 0.03 278); }
.sx-dark .hx-btn { margin-top: 6px; background: #fff; color: var(--btn); }
.sx-linkcard { transition: border-color .15s, box-shadow .2s; }
.sx-linkcard:hover { border-color: var(--btn); box-shadow: 0 8px 24px oklch(0.4 0.12 280 / 0.1); }
@media (max-width: 900px) {
  .sx-hero { padding: 40px 0 32px; }
  .sx-h1 { font-size: 36px; }
  .sx-dek { font-size: 17px; }
  .sx-x { margin-top: 28px; border-radius: 16px; }
  .sx-deck, .sx-lvl { padding: 18px; }
  .sx-x-face { padding: 18px; }
  .sx-x-q { font-size: 21px; }
  .sx-x-big { font-size: 34px; }
  .sx-x-trio { grid-template-columns: 1fr; }
  .sx-x-nav { flex-wrap: wrap; }
  .sx-body { padding: 32px 0 24px; }
  .sx-grid, .sx-grid-wide, .sx-grid-q { grid-template-columns: 1fr; gap: 32px; }
  .sx-toc { display: none; }
  .sa-body { padding: 28px 0 8px; }
  .sa-grid { grid-template-columns: 1fr; gap: 0; }
  .sa-head { padding: 18px 20px; gap: 12px; }
  .sa-prose { padding: 0 20px; }
  .sa-card[data-open="1"] .sa-prose { padding-bottom: 20px; }
  .sa-card h2 { font-size: 19px; }
  .sa-prose .sa-lab { grid-template-columns: 1fr; gap: 4px; }
  .sx-grid { justify-content: stretch; }
  .sx-prose { max-width: none; }
  .sx-side { position: static; }
  .sx-rail { position: static; }
  .sx-prose { font-size: 16px; }
  .sx-prose h2, .sx-h2 { font-size: 24px; }
  .sx-stats div { min-width: 0; flex: 1 1 140px; padding: 14px 16px; }
  .sx-stats b { font-size: 26px; }
  .sx-ladder { padding: 18px; }
  .sx-lrow { grid-template-columns: 64px minmax(0, 1fr); gap: 6px 12px; }
  .sx-lval { grid-column: 2; text-align: left; }
  .sx-snap dl div { grid-template-columns: 1fr; gap: 4px; }
  .sx-qs li { grid-template-columns: 28px minmax(0, 1fr); }
  .sx-try { display: none; }
}
@media (prefers-reduced-motion: reduce) { .sa-in { animation: none; } .sa-card, .sa-fold, .sa-thumb, .sa-chev, .sa-toc .sa-rail a { transition: none; } .sa-card[data-on="0"] { opacity: 1; transform: none; } .sx-x-track i, .sx-seg button, .sx-dots i { transition: none; } .sx-roles a, .sx-try { transition: none; } }
`;
