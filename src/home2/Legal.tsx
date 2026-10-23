"use client";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Shell } from "./Pages";
import { CopyEmailLink } from "../_CopyEmailLink";
import { LEGAL_META } from "./legalDocs";
import type { Group } from "./legalDocs";
import {
  PrivacyBody, RefundBody, TermsBody,
} from "../marketing-v2/MarketingPagesV2";


function CookiesBody() {
  return (
    <>
      <h2>What we use</h2>
      <p><strong>Essential (always on).</strong> Your sign-in session and device token (stored in your browser&apos;s local storage), security and rate-limiting tokens, and a record of your cookie choice. The product cannot work without these.</p>
      <p><strong>Analytics (only after you opt in).</strong> PostHog, Google Analytics 4, and Vercel Analytics set identifiers to count visits and see which features are used. Vercel Speed Insights reports anonymised page-speed metrics without cookies.</p>
      <p><strong>Advertising (only after you opt in).</strong> Google AdSense may set advertising cookies on public content pages (blog, interview questions, salary guides) to show relevant ads. None are used on signed-in pages.</p>

      <h2>Your choice</h2>
      <p>The banner lets you accept all optional cookies, reject all of them, or choose analytics and advertising separately. Rejecting is as easy as accepting, and nothing optional is switched on by default.</p>
      <p>To change or withdraw consent at any time, use the &ldquo;Cookie settings&rdquo; link in the site footer (or the account menu when signed in). Withdrawing stops analytics and advertising from loading on your next page view. You can also clear site data in your browser and manage ads in <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer">Google Ad Settings</a>.</p>

      <h2>More detail</h2>
      <p>How we handle the data these cookies collect is in the <a href="/privacy">Privacy Policy</a>.</p>
    </>
  );
}

const BODIES: Record<string, () => ReactNode> = {
  privacy: PrivacyBody, terms: TermsBody, refund: RefundBody, cookies: CookiesBody,
};

const GROUPS: Group[] = ["Core policies"];

function slugify(t: string) {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function Toc({ proseRef }: { proseRef: React.RefObject<HTMLDivElement | null> }) {
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  useEffect(() => {
    const root = proseRef.current;
    if (!root) return;
    const next = Array.from(root.querySelectorAll("h2")).map((h) => {
      const text = h.textContent ?? "";
      if (!h.id) h.id = slugify(text);
      return { id: h.id, text };
    });
    setItems(next);
  }, [proseRef]);
  if (items.length < 2) return null;
  return (
    <nav className="lg-toc" aria-label="On this page">
      <h2>On this page</h2>
      {items.map((i) => <a key={i.id} href={`#${i.id}`}>{i.text}</a>)}
    </nav>
  );
}

export function LegalDocPage({ slug }: { slug: string }) {
  const doc = LEGAL_META.find((d) => d.slug === slug);
  const proseRef = useRef<HTMLDivElement>(null);
  if (!doc) return null;
  const Body = BODIES[slug];
  const others = LEGAL_META.filter((d) => d.slug !== slug);
  return (
    <Shell active="talent">
      <style>{legalCss}</style>
      <section className="lg-hero">
        <div className="hx-wrap">
          <a data-no-underline className="lg-back" href="/legal">All legal documents</a>
          <h1>{doc.title}</h1>
          <p className="lg-meta">Last updated {doc.updated}. Questions: <CopyEmailLink email="hello@hirestepx.com" />. Privacy or data complaints: <CopyEmailLink email="grievance@hirestepx.com" />.</p>
        </div>
      </section>
      <section className="lg-body">
        <div className="hx-wrap lg-grid">
          <Toc proseRef={proseRef} />
          <article className="lg-prose" ref={proseRef}><Body /></article>
        </div>
      </section>
      <section className="lg-more">
        <div className="hx-wrap">
          <h2>More legal documents</h2>
          <div className="lg-list">
            {others.map((d) => <a key={d.slug} data-no-underline href={`/${d.slug}`}><b>{d.title}</b><span>{d.blurb}</span></a>)}
          </div>
        </div>
      </section>
    </Shell>
  );
}

export function LegalHubPage() {
  return (
    <Shell active="talent">
      <style>{legalCss}</style>
      <section className="lg-hero">
        <div className="hx-wrap">
          <h1>Legal and trust</h1>
          <p className="lg-meta">Every policy that covers your data, your payments and your account, in plain English, each with its last updated date.</p>
        </div>
      </section>
      <section className="lg-body">
        <div className="hx-wrap">
          {GROUPS.map((g) => (
            <div className="lg-group" key={g}>
              <h2>{g}</h2>
              <div className="lg-list">
                {LEGAL_META.filter((d) => d.group === g).map((d) => (
                  <a key={d.slug} data-no-underline href={`/${d.slug}`}><b>{d.title}</b><span>{d.blurb}</span><em>Updated {d.updated}</em></a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}

const legalCss = `
.lg-hero { padding: 72px 0 32px; border-bottom: 1px solid var(--line); background: var(--wash); }
.lg-hero h1 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 52px; line-height: 1.05; letter-spacing: -0.03em; font-weight: 600; margin: 12px 0 0; text-wrap: balance; }
.lg-back { display: inline-block; font-size: 15px; color: var(--ink-2); }
.lg-back::before { content: '\\2190'; margin-right: 8px; }
.lg-back:hover { color: var(--ink); }
.lg-meta { margin: 16px 0 0; max-width: 64ch; font-size: 16px; line-height: 1.55; color: var(--ink-2); }
.lg-meta a { color: var(--ink); text-decoration: underline; text-underline-offset: 3px; }
.lg-body { padding: 48px 0 72px; }
.lg-grid { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 64px; align-items: start; }
.lg-toc { position: sticky; top: 96px; display: grid; gap: 4px; padding-right: 8px; }
.lg-toc h2 { font-family: 'Geist Mono', ui-monospace, monospace; font-size: 12px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-3); margin: 0 0 8px; }
.lg-toc a { display: block; padding: 6px 0; font-size: 14px; line-height: 1.35; color: var(--ink-2); text-decoration: none; }
.lg-toc a:hover { color: var(--btn); }
.lg-prose { grid-column: 2; min-width: 0; max-width: 72ch; font-size: 17px; line-height: 1.7; color: var(--ink); }
.lg-prose > :first-child { margin-top: 0; }
.lg-prose h2 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 28px; line-height: 1.2; letter-spacing: -0.02em; font-weight: 500; margin: 48px 0 12px; scroll-margin-top: 96px; }
.lg-prose p, .lg-prose ul { margin: 0 0 16px; }
.lg-prose ul { padding-left: 22px; display: grid; gap: 10px; }
.lg-prose li::marker { color: var(--ink-3); }
.lg-prose strong { font-weight: 600; }
.lg-prose em { font-style: normal; font-weight: 500; }
.lg-prose a { color: var(--btn); text-decoration: underline; text-underline-offset: 3px; }
.lg-tablewrap { overflow-x: auto; margin: 0 0 24px; border: 1px solid var(--line); border-radius: 14px; }
.lg-table { width: 100%; min-width: 560px; border-collapse: collapse; font-size: 15px; line-height: 1.5; }
.lg-table th, .lg-table td { text-align: left; vertical-align: top; padding: 14px 18px; border-bottom: 1px solid var(--line); }
.lg-table thead th { background: var(--wash); font-weight: 600; font-size: 13px; color: var(--ink-2); }
.lg-table tbody th { font-weight: 600; white-space: nowrap; }
.lg-table tbody tr:last-child th, .lg-table tbody tr:last-child td { border-bottom: 0; }
.lg-more { padding: 0 0 72px; }
.lg-more h2, .lg-group h2 { font-family: 'Bricolage Grotesque', 'Geist', ui-sans-serif, system-ui, sans-serif; font-size: 24px; letter-spacing: -0.02em; font-weight: 500; margin: 0 0 16px; }
.lg-group { margin-bottom: 40px; }
.lg-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.lg-list a { display: grid; gap: 6px; align-content: start; padding: 22px 24px; border: 1px solid var(--line); border-radius: 16px; background: var(--white); color: var(--ink); transition: border-color .15s, box-shadow .15s; }
.lg-list a:hover { border-color: var(--btn); box-shadow: 0 8px 24px oklch(0.4 0.12 280 / 0.1); }
.lg-list b { font-size: 17px; font-weight: 600; }
.lg-list span { font-size: 15px; line-height: 1.5; color: var(--ink-2); }
.lg-list em { font-style: normal; font-size: 13px; color: var(--ink-3); margin-top: 4px; }
@media (max-width: 900px) {
  .lg-hero { padding: 40px 0 24px; }
  .lg-hero h1 { font-size: 38px; }
  .lg-grid { grid-template-columns: 1fr; gap: 0; }
  .lg-toc { display: none; }
  .lg-prose { grid-column: 1; font-size: 16px; }
  .lg-prose h2 { font-size: 24px; margin-top: 36px; }
  .lg-list { grid-template-columns: 1fr; }
}
`;
