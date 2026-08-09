"use client";
import React, { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { captureClientEvent } from "./posthogClient";
import Image from "next/image";
import Link from "next/link";
import { tokens as t, fonts } from "./auth/_tokens";
import { NavV2, MobileStickyCTA, VideoCtaV2 } from "./marketing-v2/HomepageV2";
import { FooterDome as FinalCTAFooterV2 } from "./marketing-v2/FooterDome";
import { useSEO } from "./useSEO";
import { editorialCSS, MarkdownProse, ctaPrimaryStyle } from "./marketing-v2/_editorial";
import { RoundFlow, SalaryLadder, TierCompare, FrameworkSteps, PrepTimeline, ComparisonTable } from "./marketing-v2/_blog-infographics";
import type { BlogPost } from "../data/blog-posts";
import type { BlogMeta } from "./blog-meta";
import { CATEGORY_BUCKET_MAP, CATEGORY_BUCKETS, bucketToSlug } from "./blog-categories";

/* PageShell: mirrors marketing-v2 chrome so the blog inherits the
   editorial brand (cream surface, Instrument Serif + Satoshi, copper
   accents, shared Nav + Footer + mobile sticky CTA). */
function BlogShell({ children, afterContent }: { children: ReactNode; afterContent?: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.cream,
        color: t.coal,
        fontFamily: fonts.sans,
        colorScheme: "light",
      }}
    >
      <style>{`
        .blog-skip { position: absolute; left: -9999px; top: 0; }
        .blog-skip:focus { left: 16px; top: 16px; z-index: 100; background: ${t.coal}; color: ${t.cream}; padding: 10px 16px; border-radius: 8px; font-family: ${fonts.sans}; font-size: 14px; text-decoration: none; }
        .blog-card { position: relative; }
        .blog-card .img-frame img { transition: filter 300ms cubic-bezier(0.16,1,0.3,1); }
        .blog-card:hover .img-frame img { filter: brightness(0.72); }
        .blog-card-title { transition: color 200ms cubic-bezier(0.16,1,0.3,1); }
        .blog-card:hover .blog-card-title { color: ${t.copper}; }
        .blog-card-link { color: inherit; text-decoration: none; outline: none; }
        .blog-card-link::after { content: ""; position: absolute; inset: 0; border-radius: inherit; z-index: 1; }
        .blog-card:has(.blog-card-link:focus-visible) { border-color: ${t.copper}; box-shadow: 0 0 0 3px ${t.copperSoft}; }
        .blog-card .blog-card-meta { position: relative; z-index: 2; }
        .blog-faq-btn:focus-visible { outline: 2px solid ${t.copper}; outline-offset: 2px; border-radius: 4px; }
        .blog-clamp2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .blog-clamp3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .blog-cat-tab { position: relative; padding: 12px 0 14px; background: none; border: none; cursor: pointer; font-family: ${fonts.sans}; font-size: 14px; font-weight: 500; color: #6E6759; transition: color 180ms ease-out; white-space: nowrap; flex-shrink: 0; min-height: 44px; display: inline-flex; align-items: center; text-decoration: none; }
        .blog-cat-tab::after { content: ""; position: absolute; bottom: 0; left: 0; height: 1.5px; width: 0; background: ${t.copper}; transition: width 220ms cubic-bezier(0.16,1,0.3,1); }
        .blog-cat-tab.active { color: ${t.coal}; font-weight: 600; }
        .blog-cat-tab.active::after { width: 100%; transition: none; }
        .blog-cat-tab:hover:not(.active) { color: ${t.coal}; }
        .blog-cat-tab:hover:not(.active)::after { width: 100%; }
        .blog-cat-tab:focus-visible { outline: 2px solid ${t.copper}; outline-offset: 4px; border-radius: 2px; }
        .blog-back-link { display: inline-flex; align-items: center; gap: 6px; font-family: ${fonts.sans}; font-size: 13px; font-weight: 600; color: ${t.copper}; text-decoration: none; transition: color 160ms, gap 160ms cubic-bezier(0.16,1,0.3,1); }
        .blog-back-link:hover { color: ${t.coal}; gap: 10px; }
        .blog-back-link:focus-visible { outline: 2px solid ${t.copper}; outline-offset: 3px; border-radius: 3px; }
        .blog-related-row { display: flex; gap: 20px; padding: 20px 0; border-bottom: 1px solid ${t.line}; text-decoration: none; align-items: center; transition: opacity 160ms cubic-bezier(0.16,1,0.3,1); }
        .blog-related-row:hover { opacity: 0.68; }
        @media (prefers-reduced-motion: reduce) {
          .blog-card { transition: none; } .blog-card:hover { transform: none; }
          .blog-cat-tab::after { transition: none; } .blog-back-link { transition: none; }
          .blog-related-row { transition: none; }
        }
        @media (max-width: 880px) {
          .blog-featured { grid-template-columns: 1fr !important; }
          .blog-featured-media { min-height: 280px !important; }
          .blog-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        .blog-filter-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; flex-wrap: nowrap; }
        @media (max-width: 640px) {
          .blog-grid { grid-template-columns: 1fr !important; }
          .blog-container { padding: 32px 20px 64px !important; max-width: 100% !important; }
          .blog-article { padding: 24px 20px 56px !important; }
          .blog-hero { display: none !important; }
          .blog-meta { padding: 16px 20px !important; }
          .blog-related-grid { grid-template-columns: 1fr !important; }
          main { padding-bottom: 40px !important; }

          .blog-index-cta { flex-direction: column !important; align-items: flex-start !important; }
          .blog-post-header { padding-top: 40px !important; }
          .blog-post-inner { padding: 0 20px !important; }
          .blog-post-hero { padding: 0 16px !important; }
          .blog-post-hero-frame { aspect-ratio: 4 / 3 !important; }
        }
        .mv2p-faq[open] .mv2p-faq-marker { transform: rotate(45deg); }
        .mv2p-faq-marker { transition: transform 180ms cubic-bezier(0.16,1,0.3,1); }
        .mv2p-faq summary::-webkit-details-marker { display: none; }
        @media (prefers-reduced-motion: reduce) { .mv2p-faq-marker { transition: none !important; } }
      `}</style>
      <style>{editorialCSS}</style>
      <a href="#main" className="blog-skip">Skip to content</a>
      <NavV2 />
      <main id="main">{children}</main>
      {afterContent}
      <FinalCTAFooterV2 />
      <MobileStickyCTA />
    </div>
  );
}


/* Blog post + FAQ data lives in data/blog-posts.ts (server-only — see
   that file's header for why). Lightweight per-post metadata for the
   index/related-card views lives in ./blog-meta.ts. */

/* Category bucketing (18 raw categories → 6 user-intent buckets) now lives in
   ./blog-categories so the server-rendered /blog/category/[category] pages
   can share the exact same grouping logic without importing this client file. */
const CATEGORY_MAP = CATEGORY_BUCKET_MAP;
const CATEGORIES = ["All", ...CATEGORY_BUCKETS];

/* ─── Compact card: 3-col grid variant ───────────────────────────────
 * All cards share the same 200px image height for a balanced grid row.
 * Visual hierarchy comes from column width (3fr vs 2fr), not image height. */
function CompactCard({ post }: { post: BlogMeta }) {
  const [imgFailed, setImgFailed] = useState(false);
  const d = new Date(post.datePublished);
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dateLabel = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return (
    <article className="blog-card" style={{ display: "flex", flexDirection: "column" }}>
      {/* Image: frameless, portrait ratio, badges float on top */}
      <div className="img-frame" style={{ position: "relative", aspectRatio: "4 / 3", background: post.heroBg ?? t.creamSoft, flexShrink: 0, overflow: "hidden", borderRadius: 12, border: `2px solid ${t.lineStrong}` }}>
        {!imgFailed ? (
          <Image
            src={post.heroImage} alt={post.heroAlt}
            fill sizes="(max-width: 640px) 100vw, (max-width: 880px) 50vw, 33vw"
            onError={() => setImgFailed(true)}
            style={
              post.heroImageFit === "contain"
                ? { objectFit: "contain", padding: "22%" }
                : { objectFit: "cover" }
            }
          />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: post.heroBg ?? t.creamSoft }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.inkFaintWeak} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
            </svg>
            <span style={{ fontFamily: fonts.sans, fontSize: 11, color: t.inkFaintWeak, letterSpacing: "0.05em", textTransform: "uppercase" }}>{post.category}</span>
          </div>
        )}
        {/* Category + date pills overlaid on image */}
        <div style={{ position: "absolute", top: 12, left: 12, display: "flex", gap: 6 }}>
          <span style={{
            fontFamily: fonts.sans, fontSize: 11, fontWeight: 500, color: t.coal,
            background: "rgba(255,255,255,0.92)", borderRadius: 999,
            padding: "4px 11px", backdropFilter: "blur(4px)",
          }}>{post.category}</span>
          <span style={{
            fontFamily: fonts.sans, fontSize: 11, fontWeight: 500, color: t.coal,
            background: "rgba(255,255,255,0.92)", borderRadius: 999,
            padding: "4px 11px", backdropFilter: "blur(4px)",
          }}>{dateLabel}</span>
        </div>
      </div>

      {/* Text: sits directly on page background, no card box */}
      <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
        <h3
          className="blog-clamp2 blog-card-title"
          style={{ fontFamily: fonts.serif, fontSize: 21, fontWeight: 400, color: t.coal, lineHeight: 1.2, letterSpacing: "-0.016em", margin: 0 }}
        >
          <Link href={`/blog/${post.slug}`} className="blog-card-link">
            {post.title}
          </Link>
        </h3>
        <p
          className="blog-clamp3"
          style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.62, margin: 0 }}
        >
          {post.metaDescription}
        </p>
        <p style={{ fontFamily: fonts.sans, fontSize: 12, color: t.inkFaint, margin: 0, marginTop: 4 }}>
          HireStepX Team · {post.readTime} read
        </p>
      </div>
    </article>
  );
}


const POSTS_PER_PAGE = 30;

/* ─── Blog index (list of all posts) ─── */
function BlogIndex({ metas, initialPage }: { metas: BlogMeta[]; initialPage?: number }) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(initialPage ?? 1);

  useEffect(() => {
    setPage(initialPage ?? 1);
  }, [initialPage]);

  /* Only the unfiltered hub has real /blog?page=N URLs (see app/(marketing)/blog/page.tsx) —
     that's the state Google can discover, so only it gets crawlable <Link> pagination.
     Category/search filters stay client-only; those states aren't in the sitemap and
     shouldn't be indexed as separate search-result pages. */
  const isDefaultView = activeCategory === "All" && !searchQuery.trim();
  const pageHref = (p: number) => (p > 1 ? `/blog?page=${p}` : "/blog");

  useSEO({
    title: "Interview Prep Blog: HireStepX",
    description: "Company-specific interview preparation guides, question banks, and career strategies for Indian job seekers. Google, Amazon, TCS, Infosys, Flipkart, and more.",
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Interview Prep Blog",
      description: "Company-specific interview preparation guides for Indian job seekers.",
      url: "https://hirestepx.com/blog",
      publisher: { "@type": "Organization", name: "HireStepX", url: "https://hirestepx.com" },
      mainEntity: {
        "@type": "ItemList",
        itemListElement: metas.map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `https://hirestepx.com/blog/${p.slug}`,
          name: p.title,
        })),
      },
    },
  });

  const q = searchQuery.trim().toLowerCase();

  const filtered = metas.filter(p => {
    const catMatch = activeCategory === "All" || (CATEGORY_MAP[p.category] ?? p.category) === activeCategory;
    if (!catMatch) return false;
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.company.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      p.metaDescription.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * POSTS_PER_PAGE, safePage * POSTS_PER_PAGE);

  const resetPage = () => setPage(1);

  /* Page number buttons — show up to 7 slots with ellipsis */
  const pageNumbers: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (safePage > 3) pageNumbers.push("…");
    for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pageNumbers.push(i);
    if (safePage < totalPages - 2) pageNumbers.push("…");
    pageNumbers.push(totalPages);
  }

  return (
    <BlogShell>
      {/* ── Hero ── */}
      <header style={{ paddingTop: 96, paddingBottom: 56, borderBottom: `1px solid ${t.line}`, background: t.cream, textAlign: "center" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto", padding: "0 48px" }}>
          <p style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: t.copper, margin: "0 0 18px" }}>
            Interview guides · India 2026
          </p>
          <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(36px, 4.8vw, 64px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.025em", lineHeight: 1.05, margin: "0 auto 20px" }}>
            Interview prep that actually{" "}
            <em style={{ fontStyle: "italic", color: t.copper }}>works.</em>
          </h1>
          <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.inkSoft, lineHeight: 1.6, margin: "0 auto 32px", maxWidth: "54ch" }}>
            Company-specific guides, question banks, and career strategies built for Indian job seekers.
          </p>

          {/* ── Search bar ── */}
          <div style={{ maxWidth: 540, margin: "0 auto", position: "relative" }}>
            <svg
              width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke={t.inkFaint} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              placeholder="Search by company, topic, or keyword…"
              onChange={e => { setSearchQuery(e.target.value); resetPage(); }}
              style={{
                width: "100%", boxSizing: "border-box",
                fontFamily: fonts.sans, fontSize: 15, color: t.coal,
                background: "#fff", border: `1.5px solid ${t.line}`,
                borderRadius: 999, padding: "13px 18px 13px 46px",
                outline: "none", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                transition: "border-color 180ms",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = t.indigo; }}
              onBlur={e => { e.currentTarget.style.borderColor = t.line; }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(""); resetPage(); }}
                aria-label="Clear search"
                style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                  color: t.inkFaint, display: "flex", alignItems: "center",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="blog-container" style={{ maxWidth: 1240, margin: "0 auto", padding: "40px 48px 96px" }}>
        {/* Category filter tabs */}
        <div className="blog-filter-scroll" style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 36, borderBottom: `1px solid ${t.line}`, paddingBottom: 0 }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat;
            const href = cat === "All" ? "/blog" : `/blog/category/${bucketToSlug(cat)}`;
            return (
              <a
                key={cat}
                href={href}
                className={`blog-cat-tab${isActive ? " active" : ""}`}
                onClick={e => { e.preventDefault(); setActiveCategory(cat); resetPage(); }}
                aria-current={isActive ? "page" : undefined}
              >
                {cat}
              </a>
            );
          })}
        </div>

        {/* Post grid */}
        {paginated.length > 0 ? (
          <div className="blog-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 28 }}>
            {paginated.map((p) => <CompactCard key={p.slug} post={p} />)}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "80px 0", fontFamily: fonts.sans }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
            <p style={{ fontSize: 17, color: t.coal, fontWeight: 600, marginBottom: 8 }}>No guides found</p>
            <p style={{ fontSize: 14, color: t.inkSoft, marginBottom: 20 }}>
              Try a different keyword or clear the filter
            </p>
            <button
              onClick={() => { setSearchQuery(""); setActiveCategory("All"); resetPage(); }}
              style={{ ...ctaPrimaryStyle("md"), fontSize: 14, padding: "10px 22px", cursor: "pointer" }}
            >
              Clear all filters
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 52 }}>
            {/* Count label */}
            <span style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, marginRight: 12, whiteSpace: "nowrap" as const }}>
              {filtered.length === metas.length ? `${metas.length} guides` : `${filtered.length} of ${metas.length} guides`}
              {` · page ${safePage} of ${totalPages}`}
            </span>
            {/* Prev */}
            {isDefaultView ? (
              <Link
                href={pageHref(safePage - 1)}
                aria-label="Previous page"
                aria-disabled={safePage === 1}
                onClick={e => { if (safePage === 1) e.preventDefault(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5, textDecoration: "none",
                  fontFamily: fonts.sans, fontSize: 13, fontWeight: 500,
                  padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${t.line}`,
                  background: safePage === 1 ? t.creamSoft : "#fff",
                  color: safePage === 1 ? t.inkFaint : t.coal,
                  cursor: safePage === 1 ? "default" : "pointer",
                  opacity: safePage === 1 ? 0.45 : 1,
                  transition: "border-color 150ms, background 150ms",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Prev
              </Link>
            ) : (
              <button
                onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={safePage === 1}
                aria-label="Previous page"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontFamily: fonts.sans, fontSize: 13, fontWeight: 500,
                  padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${t.line}`,
                  background: safePage === 1 ? t.creamSoft : "#fff",
                  color: safePage === 1 ? t.inkFaint : t.coal,
                  cursor: safePage === 1 ? "default" : "pointer",
                  opacity: safePage === 1 ? 0.45 : 1,
                  transition: "border-color 150ms, background 150ms",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Prev
              </button>
            )}

            {/* Page numbers */}
            {pageNumbers.map((n, i) =>
              n === "…" ? (
                <span key={`ellipsis-${i}`} style={{ fontFamily: fonts.sans, fontSize: 13, color: t.inkFaint, padding: "8px 4px" }}>…</span>
              ) : isDefaultView ? (
                <Link
                  key={n}
                  href={pageHref(n as number)}
                  aria-current={safePage === n ? "page" : undefined}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
                    fontFamily: fonts.sans, fontSize: 13, fontWeight: safePage === n ? 700 : 400,
                    minWidth: 36, height: 36, borderRadius: 8, border: `1.5px solid ${safePage === n ? t.indigo : t.line}`,
                    background: safePage === n ? t.indigo : "#fff",
                    color: safePage === n ? "#fff" : t.coal,
                    cursor: "pointer", transition: "all 150ms",
                  }}
                >
                  {n}
                </Link>
              ) : (
                <button
                  key={n}
                  onClick={() => { setPage(n as number); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                  aria-current={safePage === n ? "page" : undefined}
                  style={{
                    fontFamily: fonts.sans, fontSize: 13, fontWeight: safePage === n ? 700 : 400,
                    minWidth: 36, height: 36, borderRadius: 8, border: `1.5px solid ${safePage === n ? t.indigo : t.line}`,
                    background: safePage === n ? t.indigo : "#fff",
                    color: safePage === n ? "#fff" : t.coal,
                    cursor: "pointer", transition: "all 150ms",
                  }}
                >
                  {n}
                </button>
              )
            )}

            {/* Next */}
            {isDefaultView ? (
              <Link
                href={pageHref(safePage + 1)}
                aria-label="Next page"
                aria-disabled={safePage === totalPages}
                onClick={e => { if (safePage === totalPages) e.preventDefault(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5, textDecoration: "none",
                  fontFamily: fonts.sans, fontSize: 13, fontWeight: 500,
                  padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${t.line}`,
                  background: safePage === totalPages ? t.creamSoft : "#fff",
                  color: safePage === totalPages ? t.inkFaint : t.coal,
                  cursor: safePage === totalPages ? "default" : "pointer",
                  opacity: safePage === totalPages ? 0.45 : 1,
                  transition: "border-color 150ms, background 150ms",
                }}
              >
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ) : (
              <button
                onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={safePage === totalPages}
                aria-label="Next page"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontFamily: fonts.sans, fontSize: 13, fontWeight: 500,
                  padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${t.line}`,
                  background: safePage === totalPages ? t.creamSoft : "#fff",
                  color: safePage === totalPages ? t.inkFaint : t.coal,
                  cursor: safePage === totalPages ? "default" : "pointer",
                  opacity: safePage === totalPages ? 0.45 : 1,
                  transition: "border-color 150ms, background 150ms",
                }}
              >
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Closing CTA */}
      <VideoCtaV2 />
    </BlogShell>
  );
}

/* ─── Section infographics ──────────────────────────────────────────────
   Keyed by "slug||Section Heading". Each value renders after the prose
   for that section, giving a visual companion to the text content.    */
const SECTION_VISUALS: Record<string, ReactNode> = {
  /* Flipkart: interview loop */
  "flipkart-interview-prep-guide||Interview Structure": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "DSA filter round" },
      { label: "Machine Coding", duration: "90 min", detail: "Build a system" },
      { label: "Problem Solving ×2", duration: "45 min", detail: "Whiteboard DSA" },
      { label: "System Design", duration: "45–60 min", detail: "SDE-2+ roles" },
      { label: "Hiring Manager", duration: "30 min", detail: "Culture & ownership" },
    ]} />
  ),

  /* Razorpay: interview loop */
  "razorpay-interview-experience||Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background & motivation" },
      { label: "Online Coding", duration: "60 min", detail: "2 DSA problems" },
      { label: "Technical 1", duration: "~45 min", detail: "DSA + decomposition" },
      { label: "Technical 2", duration: "~45 min", detail: "System design" },
      { label: "Culture Round", duration: "~45 min", detail: "Values & ownership" },
      { label: "Hiring Manager", duration: "30 min", detail: "Final bar raiser" },
    ]} />
  ),

  /* Razorpay: compensation */
  "razorpay-interview-experience||Salary Expectations (2026)": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "SDE-1", min: 15, max: 25 },
      { role: "SDE-2", min: 28, max: 45 },
      { role: "SDE-3", min: 50, max: 70 },
      { role: "PM",    min: 25, max: 50 },
    ]} caption="Pre-ESOP cash comp, 2026" />
  ),

  /* TCS: interview process */
  "tcs-interview-questions-freshers-2026||TCS Interview Process for Freshers": (
    <RoundFlow rounds={[
      { label: "NQT", detail: "Aptitude + coding filter" },
      { label: "Technical Interview", detail: "CS fundamentals" },
      { label: "Managerial Round", detail: "Behavioral & situational" },
      { label: "HR Round", detail: "Offer & joining" },
    ]} />
  ),

  /* TCS: salary bands */
  "tcs-interview-questions-freshers-2026||TCS Salary for Freshers (2026)": (
    <SalaryLadder maxLPA={12} rows={[
      { role: "TCS Ninja",   min: 0, max: 3.36, note: "most common path" },
      { role: "TCS Digital", min: 0, max: 7.5 },
      { role: "TCS Prime",   min: 0, max: 9.5 },
    ]} caption="NQT coding score determines your band" />
  ),

  /* Infosys: hiring tracks */
  "infosys-interview-questions-2026||Infosys Hiring Tracks Explained": (
    <SalaryLadder maxLPA={12} rows={[
      { role: "Systems Engineer (SE)",       min: 0,   max: 3.6 },
      { role: "Power Programmer (PP)",       min: 0,   max: 6.5 },
      { role: "Digital Specialist (DSE)",    min: 6.5, max: 9.5 },
    ]} caption="InfyTQ certification skips the aptitude filter" />
  ),

  /* Engineering Manager: compensation by tier */
  "engineering-manager-interview-india-2026||Engineering Manager Compensation India 2026": (
    <TierCompare cards={[
      {
        tier: "Tier-1 MNCs",
        examples: "Google · Microsoft · Amazon",
        rows: [
          { label: "EM-1 (5–8 person team)", range: "₹60L – 1 Cr" },
          { label: "Senior EM (10–20 person team)", range: "₹90L – 1.5 Cr" },
        ],
      },
      {
        tier: "Fintech Unicorns",
        examples: "Razorpay · PhonePe · CRED",
        rows: [
          { label: "Engineering Manager", range: "₹50 – 80 LPA" },
          { label: "Senior EM / Head of Eng.", range: "₹80L – 1.2 Cr" },
        ],
      },
      {
        tier: "Consumer Internet",
        examples: "Swiggy · Zomato · Flipkart",
        rows: [
          { label: "Engineering Manager", range: "₹45 – 75 LPA" },
          { label: "Senior EM", range: "₹70L – 1.1 Cr" },
        ],
      },
    ]} />
  ),

  /* Case study: universal framework */
  "ace-case-study-interviews||The Universal Case Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify", hint: "Ask questions to narrow the problem scope. Don't assume the company, market, or metric." },
      { number: "02", label: "Structure", hint: "Build a framework adapted to this problem: don't force-fit a memorised template." },
      { number: "03", label: "Analyze", hint: "Work through each branch with data, logic, and estimation. Show your reasoning." },
      { number: "04", label: "Recommend", hint: "State your answer, the key driver, the main risk, and what you'd verify next." },
    ]} />
  ),

  /* Flipkart: compensation */
  "flipkart-interview-prep-guide||Compensation Expectations (2026)": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "SDE-1", min: 18, max: 28 },
      { role: "SDE-2", min: 30, max: 50 },
      { role: "SDE-3", min: 50, max: 80 },
      { role: "Senior Staff", min: 80, max: 90, note: "LPA+" },
    ]} caption="Pre-ESOP cash comp, 2026" />
  ),

  /* STAR method: 30-60-10 rule */
  "star-method-interview-answers||The 30-60-10 Rule": (
    <FrameworkSteps steps={[
      { number: "30%", label: "Situation + Task", hint: "Set context quickly. Don't over-explain the background: keep this to one or two sentences." },
      { number: "60%", label: "Action", hint: "This is where you show your value. Be specific about what YOU did, not what the team did." },
      { number: "10%", label: "Result", hint: "One clear metric or outcome. Numbers make your answer memorable and credible." },
    ]} />
  ),

  /* Cognizant: GenC vs GenC Pro */
  "cognizant-interview-questions-freshers-2026||GenC vs GenC Pro: Which Track Is Right for You?": (
    <TierCompare cards={[
      {
        tier: "GenC",
        examples: "General IT roles",
        rows: [
          { label: "Starting salary", range: "₹4 LPA" },
          { label: "Coding requirement", range: "1 medium problem" },
        ],
      },
      {
        tier: "GenC Pro",
        examples: "Advanced engineering roles",
        rows: [
          { label: "Starting salary", range: "₹6.5 LPA" },
          { label: "Coding requirement", range: "2 medium problems, 60 min" },
        ],
      },
    ]} />
  ),

  /* Cognizant: salary */
  "cognizant-interview-questions-freshers-2026||Salary & Benefits (2026)": (
    <SalaryLadder maxLPA={8} rows={[
      { role: "GenC", min: 0, max: 4, note: "base ₹3.2L + variable ₹0.8L" },
      { role: "GenC Pro", min: 0, max: 6.5, note: "base ₹5.2L + variable ₹1.3L" },
    ]} caption="Cognizant fresher packages 2026" />
  ),

  /* Accenture: hiring tracks salary */
  "accenture-interview-questions-freshers-2026||Accenture Hiring Tracks": (
    <SalaryLadder maxLPA={9} rows={[
      { role: "ASE (Standard)", min: 0, max: 4.5 },
      { role: "AASE (Advanced)", min: 6, max: 8 },
    ]} caption="Accenture fresher packages 2026" />
  ),

  /* Accenture: iCAT test structure */
  "accenture-interview-questions-freshers-2026||iCAT Online Test: What to Expect": (
    <RoundFlow rounds={[
      { label: "Cognitive Assessment", duration: "35 min", detail: "25 questions: logical, quantitative, verbal" },
      { label: "Technical Assessment", duration: "40 min", detail: "40 questions: CS fundamentals, OOP, DBMS" },
      { label: "Coding Module", duration: "45 min", detail: "2 problems: 1 easy + 1 medium" },
    ]} />
  ),

  /* Product Manager: salary by level */
  "product-manager-interview-questions-india||Salary Expectations for PMs in India (2026)": (
    <SalaryLadder maxLPA={200} rows={[
      { role: "APM / Associate PM", min: 18, max: 35 },
      { role: "PM (3–5 years)", min: 35, max: 70 },
      { role: "Senior PM (5–8 years)", min: 70, max: 120 },
      { role: "Director of Product", min: 120, max: 200 },
    ]} caption="Indicative 2026 ranges (incl. ESOP)" />
  ),

  /* HCL vs Accenture vs Capgemini */
  "hcl-accenture-capgemini-interview-comparison||Salary Comparison (2026)": (
    <TierCompare cards={[
      {
        tier: "HCL",
        examples: "GET to Technology Evangelist track",
        rows: [{ label: "Fresher range", range: "₹3.8–6 LPA" }],
      },
      {
        tier: "Capgemini",
        examples: "Analyst to Senior Analyst",
        rows: [{ label: "Fresher range", range: "₹4.35–7 LPA" }],
      },
      {
        tier: "Accenture",
        examples: "ASE to Advanced ASE",
        rows: [{ label: "Fresher range", range: "₹4.5–8 LPA" }],
      },
    ]} />
  ),

  /* Deloitte: interview rounds */
  "deloitte-interview-questions-freshers-2026||Deloitte Interview Rounds (2026)": (
    <RoundFlow rounds={[
      { label: "CogniVue Test", duration: "60–90 min", detail: "Numerical, verbal, logical, situational judgement" },
      { label: "Group Discussion", duration: "15–20 min", detail: "8–12 candidates evaluated on content + communication" },
      { label: "Case Interview", duration: "30–45 min", detail: "Business problem: structure and present solution" },
      { label: "HR Round", duration: "30 min", detail: "Fit, motivation, salary discussion" },
    ]} />
  ),

  /* Deloitte: salary by track */
  "deloitte-interview-questions-freshers-2026||Salary and Tracks (2026)": (
    <SalaryLadder maxLPA={13} rows={[
      { role: "Business Technology Analyst", min: 7, max: 9 },
      { role: "Consulting Analyst", min: 9, max: 12 },
      { role: "Risk Advisory Analyst", min: 7, max: 10 },
      { role: "Audit & Assurance", min: 6, max: 8 },
    ]} caption="Deloitte India fresher tracks 2026" />
  ),

  /* Deloitte: case interview framework */
  "deloitte-interview-questions-freshers-2026||Case Interview Basics for Freshers": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify", hint: "Ask 2–3 questions to narrow the problem. Confirm scope, stakeholders, and constraints before diving in." },
      { number: "02", label: "Structure", hint: "Form a hypothesis-first framework. Adapt to the problem: don't force-fit a memorised template." },
      { number: "03", label: "Analyze", hint: "Ask for data as needed. Work through each branch with logic and estimation." },
      { number: "04", label: "Recommend", hint: "Synthesize findings and give a clear recommendation with measurable success criteria." },
    ]} />
  ),

  /* TCS NQT: test structure */
  "how-to-pass-tcs-nqt-2026||TCS NQT 2026 Structure": (
    <RoundFlow rounds={[
      { label: "Numerical Ability", duration: "~20 min", detail: "12–15 questions: arithmetic, percentages, ratios" },
      { label: "Verbal Ability", duration: "~20 min", detail: "~15 questions: reading comprehension, grammar" },
      { label: "Reasoning Ability", duration: "~20 min", detail: "8–10 questions: logical reasoning, series" },
      { label: "Coding", duration: "60 min", detail: "2 problems: determines Ninja/Digital/Prime track" },
    ]} />
  ),

  /* TCS NQT: score to salary */
  "how-to-pass-tcs-nqt-2026||NQT Cutoffs: What Score Do You Need?": (
    <SalaryLadder maxLPA={10} rows={[
      { role: "TCS Ninja (~70–75%)", min: 0, max: 3.36, note: "most common path" },
      { role: "TCS Digital (~80–85%)", min: 0, max: 7 },
      { role: "TCS Prime (top 5%)", min: 0, max: 9, note: "near-perfect score" },
    ]} caption="NQT score determines salary band" />
  ),

  /* Zoho: hiring process */
  "zoho-interview-questions-freshers-2026||Zoho's Hiring Process: What Makes It Different": (
    <RoundFlow rounds={[
      { label: "Aptitude Test", detail: "Written, pen-paper: harder than TCS/Infosys" },
      { label: "Programming Round 2", detail: "Arrays, strings, basic recursion, patterns" },
      { label: "Advanced Coding Round 3", detail: "Data structures, algorithms, OOP, small system design" },
      { label: "Technical Interview", detail: "CS fundamentals + code walkthrough from rounds 2 & 3" },
      { label: "HR Interview", detail: "Culture fit, joining timeline, compensation" },
    ]} />
  ),

  /* Zoho: salary */
  "zoho-interview-questions-freshers-2026||Salary and Perks (2026)": (
    <SalaryLadder maxLPA={9} rows={[
      { role: "Software Engineer (fresher)", min: 5, max: 6 },
      { role: "Senior Software Engineer", min: 7, max: 8, note: "1–2 yr promotion" },
    ]} caption="Zoho 2026 packages (+ profit sharing)" />
  ),

  /* System Design: 5-step framework */
  "system-design-interview-preparation||The 5-Step Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Requirements", hint: "Clarify functional and non-functional requirements. Ask about scale, latency, and consistency needs. (3–5 min)" },
      { number: "02", label: "Estimation", hint: "Back-of-envelope math: users, QPS, storage, bandwidth. Shows scale thinking. (2–3 min)" },
      { number: "03", label: "High-Level Design", hint: "Draw major components: clients, load balancers, application servers, databases, caches, queues. (10 min)" },
      { number: "04", label: "Deep Dive", hint: "The interviewer picks 1–2 areas to go deep. This is where you differentiate yourself. (15–20 min)" },
      { number: "05", label: "Tradeoffs & Extensions", hint: "Discuss what you'd change for 10x scale, what to monitor, how you'd handle failures. (5 min)" },
    ]} />
  ),

  /* System Design: 4-week prep plan */
  "system-design-interview-preparation||Preparation Timeline (4 Weeks)": (
    <FrameworkSteps steps={[
      { number: "W1", label: "Fundamentals", hint: "Learn caching, databases, load balancing, and message queues. Build the vocabulary for tradeoff discussions." },
      { number: "W2", label: "Classic Problems", hint: "Practice 3 classic problems: URL shortener, chat app, news feed. Focus on requirements and high-level design." },
      { number: "W3", label: "Harder Problems", hint: "Practice 3 harder problems: payment system, search autocomplete, ride-sharing. Focus on deep dives." },
      { number: "W4", label: "Mock Interviews", hint: "Practice explaining your design out loud. Simulate real time pressure. Get feedback on tradeoff reasoning." },
    ]} />
  ),

  /* Amazon: interview structure */
  "amazon-leadership-principles-interview||How Amazon Interviews Are Structured": (
    <RoundFlow rounds={[
      { label: "Coding ×2", duration: "45–60 min", detail: "LeetCode medium-hard DSA problems" },
      { label: "System Design", duration: "45–60 min", detail: "Architecture + tradeoffs (SDE-2+)" },
      { label: "Behavioral ×1–2", duration: "45–60 min", detail: "Leadership Principles STAR stories" },
      { label: "Bar Raiser", duration: "45–60 min", detail: "Cross-team interviewer with veto power" },
    ]} />
  ),

  /* Amazon: India salary */
  "amazon-leadership-principles-interview||Amazon India-Specific Tips": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "SDE-1", min: 22, max: 35 },
      { role: "SDE-2", min: 35, max: 60 },
    ]} caption="Amazon India Bangalore / Hyderabad 2026" />
  ),

  /* Wipro: hiring programs salary */
  "wipro-interview-questions-answers||Wipro Hiring Programs": (
    <SalaryLadder maxLPA={7} rows={[
      { role: "Elite NTH (standard)", min: 0, max: 3.5 },
      { role: "Turbo", min: 0, max: 6.5, note: "harder coding round" },
      { role: "WILP", min: 0, max: 3.5, note: "non-CS graduates" },
    ]} caption="Score on online test determines track" />
  ),

  /* Goldman Sachs: interview process */
  "goldman-sachs-india-interview-questions||Goldman Sachs India Hiring Process (2026)": (
    <RoundFlow rounds={[
      { label: "HireVue Screen", duration: "30 min", detail: "Async video: 3–4 behavioral questions" },
      { label: "Online Coding Assessment", duration: "90 min", detail: "2–3 DSA problems on HackerRank" },
      { label: "Technical Phone Screen", duration: "45 min", detail: "1 medium coding + CS theory" },
      { label: "Super Day ×3–4", duration: "45–60 min each", detail: "Coding + system design + behavioral + partner" },
      { label: "HR + Offer", detail: "Background check takes 3–4 weeks" },
    ]} />
  ),

  /* Goldman Sachs: salary */
  "goldman-sachs-india-interview-questions||Goldman Sachs Salary in India 2026": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "SDE-1 / Analyst (0–2 yr)", min: 25, max: 43, note: "base + bonus" },
      { role: "SDE-2 / Associate (3–5 yr)", min: 38, max: 73, note: "base + bonus" },
      { role: "Vice President (7–10 yr)", min: 65, max: 90, note: "+ variable bonus" },
    ]} caption="Goldman Sachs India 2026 (Jan bonus included)" />
  ),

  /* Swiggy: hiring process */
  "swiggy-interview-questions-2026||Swiggy Hiring Process 2026": (
    <RoundFlow rounds={[
      { label: "Resume Screen", detail: "Referral or portal application" },
      { label: "Online Assessment", duration: "90 min", detail: "2 coding problems (1 medium + 1 hard) on HackerRank" },
      { label: "Technical Round 1", duration: "45 min", detail: "DSA + code walkthrough" },
      { label: "Technical Round 2", duration: "45 min", detail: "System design (mid/senior) or DSA (SDE-1)" },
      { label: "Hiring Manager", detail: "Culture fit + depth questions + bar raiser" },
    ]} />
  ),

  /* Swiggy: salary */
  "swiggy-interview-questions-2026||Swiggy Salary 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "SDE-1 (0–3 yr)", min: 18, max: 25 },
      { role: "SDE-2 (3–6 yr)", min: 28, max: 42 },
      { role: "SDE-3 / Staff", min: 48, max: 70 },
      { role: "PM-1 (0–3 yr)", min: 28, max: 38 },
      { role: "Senior PM (3–6 yr)", min: 42, max: 60 },
    ]} caption="Swiggy post-restructuring packages 2026" />
  ),

  /* Microsoft India: interview process */
  "microsoft-india-interview-questions-2026||Microsoft India Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Resume Screen", detail: "Referral significantly increases visibility" },
      { label: "Online Assessment", duration: "90 min", detail: "2–3 coding problems: 1 easy + 1 medium + 1 medium-hard" },
      { label: "Technical Phone Screen", duration: "45 min", detail: "1–2 coding problems + project discussion" },
      { label: "Virtual Onsite ×4", duration: "45–60 min each", detail: "Coding, systems, behavioral, As Appropriate" },
    ]} />
  ),

  /* Microsoft India: salary */
  "microsoft-india-interview-questions-2026||Microsoft India Salary 2026": (
    <SalaryLadder maxLPA={140} rows={[
      { role: "SDE-1 (0–2 yr)", min: 25, max: 38 },
      { role: "SDE-2 (2–5 yr)", min: 38, max: 60 },
      { role: "SDE-3 / Principal (5–8 yr)", min: 60, max: 90 },
      { role: "Senior Principal", min: 90, max: 140 },
    ]} caption="Microsoft India Hyderabad / Bengaluru 2026" />
  ),

  /* Product vs service salary gap */
  "product-company-vs-service-company-india-career||Salary Difference: The Numbers (2026)": (
    <TierCompare cards={[
      {
        tier: "Fresher (0–1 yr)",
        examples: "TCS vs Flipkart",
        rows: [
          { label: "TCS Ninja", range: "₹3.36 LPA" },
          { label: "Flipkart SDE-1", range: "₹20–25 LPA" },
          { label: "Razorpay SDE-1", range: "₹22–28 LPA" },
        ],
      },
      {
        tier: "Mid-level (3–5 yr)",
        examples: "IT Services vs Product",
        rows: [
          { label: "TCS/Infosys/Wipro Band B–C", range: "₹8–14 LPA" },
          { label: "Flipkart SDE-2", range: "₹35–55 LPA" },
          { label: "Razorpay SDE-2", range: "₹38–55 LPA" },
        ],
      },
    ]} />
  ),

  /* FAANG: interview structure */
  "faang-interview-preparation-india-2026||The FAANG Interview Structure for Indian Candidates": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60–90 min", detail: "2–3 LeetCode-style problems" },
      { label: "Technical Phone Screen", duration: "45 min", detail: "1–2 coding problems with senior engineer" },
      { label: "Virtual Onsite ×4–6", duration: "45–60 min each", detail: "Coding + system design + behavioral" },
    ]} />
  ),

  /* JP Morgan: interview process */
  "jp-morgan-interview-questions-india-2026||Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "HackerRank OA", duration: "90 min", detail: "2–3 coding problems (SDE roles)" },
      { label: "Technical Phone Screen", duration: "45 min", detail: "DSA + 1–2 system design questions" },
      { label: "Technical Panel ×2", duration: "60 min each", detail: "Deeper DSA, architecture, domain knowledge" },
      { label: "Hiring Manager", duration: "45 min", detail: "Behavioral + technical" },
      { label: "HR Offer", detail: "Compensation, joining date, relocation" },
    ]} />
  ),

  /* JP Morgan: compensation */
  "jp-morgan-interview-questions-india-2026||Compensation: India (2026)": (
    <TierCompare cards={[
      {
        tier: "SDE Roles",
        examples: "JP Morgan India Engineering",
        rows: [
          { label: "SDE-1 (Associate)", range: "₹18–28 LPA" },
          { label: "SDE-2 (Senior Associate)", range: "₹28–45 LPA" },
          { label: "VP Engineering", range: "₹45–75 LPA" },
        ],
      },
      {
        tier: "Business Analyst",
        examples: "JP Morgan India BA",
        rows: [
          { label: "Analyst", range: "₹14–22 LPA" },
          { label: "Senior Analyst", range: "₹22–35 LPA" },
        ],
      },
      {
        tier: "Quant Analyst",
        examples: "Markets / Risk",
        rows: [
          { label: "Junior Quant", range: "₹20–35 LPA" },
          { label: "Senior Quant", range: "₹40–70 LPA" },
        ],
      },
    ]} />
  ),

  /* Startup vs MNC: salary comparison */
  "startup-vs-mnc-india-career||Salary Comparison 2026": (
    <TierCompare cards={[
      {
        tier: "Tier-1 MNCs",
        examples: "Google · Microsoft · Amazon · Goldman Sachs",
        rows: [
          { label: "Fresher", range: "₹22–45 LPA" },
          { label: "SDE-2 (3–5 yr)", range: "₹40–80 LPA" },
        ],
      },
      {
        tier: "Well-funded Startups",
        examples: "Razorpay · CRED · Meesho · Swiggy",
        rows: [
          { label: "Fresher", range: "₹20–40 LPA" },
          { label: "SDE-2 (3–5 yr)", range: "₹40–90 LPA" },
        ],
      },
      {
        tier: "Tier-2 MNCs",
        examples: "Accenture · Infosys · Wipro · TCS Digital",
        rows: [
          { label: "Fresher", range: "₹7–18 LPA" },
          { label: "SDE-2", range: "₹18–35 LPA" },
        ],
      },
    ]} />
  ),

  /* Fresher salary: tier-1 product companies */
  "fresher-salary-india-2026||Tier-1 Product Company Salaries (FAANG and Equivalents)": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "Google India SDE-1", min: 22, max: 32 },
      { role: "Microsoft India SDE-1", min: 20, max: 30 },
      { role: "Goldman Sachs India", min: 22, max: 32 },
      { role: "Razorpay SDE-1", min: 22, max: 30 },
      { role: "CRED SDE-1", min: 24, max: 32 },
      { role: "Amazon India SDE-1", min: 18, max: 26 },
      { role: "Flipkart SDE-1", min: 20, max: 28 },
    ]} caption="Tier-1 product company fresher packages 2026" />
  ),

  /* Fresher salary: IT service companies */
  "fresher-salary-india-2026||IT Service Company Salaries": (
    <SalaryLadder maxLPA={15} rows={[
      { role: "TCS Ninja", min: 0, max: 3.36 },
      { role: "TCS Digital", min: 0, max: 7 },
      { role: "TCS Prime", min: 9, max: 14 },
      { role: "Infosys SE", min: 3.6, max: 4.25 },
      { role: "Wipro Turbo NLTH", min: 6.5, max: 7 },
      { role: "Accenture ASE", min: 4.5, max: 5.5 },
    ]} caption="Service company fixed bands 2026" />
  ),

  /* IBM: interview process */
  "ibm-interview-questions-india-2026||IBM India Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "IBM Cognitive Assessment", duration: "30 min", detail: "Logical reasoning, numerical aptitude, verbal ability" },
      { label: "Technical Round 1", duration: "45–60 min", detail: "Role-specific: DSA, CS fundamentals" },
      { label: "Technical Round 2", duration: "45 min", detail: "SDE roles only: system design or domain depth" },
      { label: "HR / Competency Round", duration: "30 min", detail: "IBM values alignment: client success, innovation, trust" },
    ]} />
  ),

  /* IBM: salary */
  "ibm-interview-questions-india-2026||IBM India Compensation 2026": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "SDE Fresher", min: 4.5, max: 7 },
      { role: "SDE 2 years", min: 12, max: 18 },
      { role: "SDE 5 years (Senior)", min: 20, max: 32 },
      { role: "GBS Consulting Analyst (Fresher)", min: 6, max: 8.5 },
    ]} caption="IBM India 2026 (below Tier-1, above service IT)" />
  ),

  /* DSA 60-day: weeks 1-2 */
  "dsa-60-day-preparation-plan||Weeks 1–2: Arrays, Strings, and Two Pointers": (
    <FrameworkSteps steps={[
      { number: "W1", label: "Arrays & Prefix Sums", hint: "Days 1–7: max subarray, find duplicates, rotate array, range sum query, sliding window basics." },
      { number: "W2", label: "Strings & Two Pointers", hint: "Days 8–14: anagram check, palindrome, two pointers (3-sum, trapping rainwater), binary search variants." },
      { number: "Mock", label: "Week 2 Baseline", hint: "Day 14: 3 timed problems at 30 min each with no hints. Baseline your speed and accuracy." },
    ]} />
  ),

  /* DSA 60-day: weeks 5-6 */
  "dsa-60-day-preparation-plan||Weeks 5–6: Graphs, Heaps, and Dynamic Programming": (
    <FrameworkSteps steps={[
      { number: "W5a", label: "Graphs", hint: "Days 29–33: BFS/DFS, connected components, number of islands, course schedule, shortest path (Dijkstra)." },
      { number: "W5b", label: "Heaps", hint: "Days 34–35: kth largest element, merge k sorted lists, top k frequent elements using priority queue." },
      { number: "W6a", label: "1D Dynamic Programming", hint: "Days 37–38: climbing stairs, house robber, coin change: build intuition for memoization." },
      { number: "W6b", label: "2D Dynamic Programming", hint: "Days 39–40: LCS, 0/1 knapsack, minimum path sum: practice drawing the DP table." },
    ]} />
  ),

  /* PM salary: APM programs */
  "product-manager-salary-india-2026||APM Salary (Associate/Junior PM)": (
    <SalaryLadder maxLPA={32} rows={[
      { role: "Google APM India", min: 22, max: 30 },
      { role: "Amazon APM", min: 20, max: 26 },
      { role: "Flipkart APM", min: 18, max: 24 },
      { role: "PhonePe APM", min: 16, max: 22 },
      { role: "Razorpay APM", min: 16, max: 22 },
      { role: "Swiggy APM", min: 15, max: 20 },
      { role: "Freshworks APM", min: 12, max: 16 },
    ]} caption="APM program packages India 2026" />
  ),

  /* PM salary: by company tier */
  "product-manager-salary-india-2026||PM Salary by Company": (
    <TierCompare cards={[
      {
        tier: "FAANG India",
        examples: "Google · Amazon · Microsoft",
        rows: [
          { label: "Senior PM", range: "₹80 L – 1.4 Cr" },
          { label: "Principal PM", range: "₹1.2 – 2 Cr" },
        ],
      },
      {
        tier: "Fintech Unicorns",
        examples: "Razorpay · PhonePe · CRED",
        rows: [
          { label: "Senior PM", range: "₹50–90 LPA" },
          { label: "Group PM", range: "₹80 L – 1.4 Cr" },
        ],
      },
      {
        tier: "Consumer Internet",
        examples: "Swiggy · Zomato · Flipkart",
        rows: [
          { label: "Senior PM", range: "₹45–80 LPA" },
          { label: "Group PM", range: "₹70 L – 1.2 Cr" },
        ],
      },
    ]} />
  ),

  /* Why hire you: SPR framework */
  "why-should-we-hire-you-answer-india||The SPR Framework: Skill, Proof, Relevance": (
    <FrameworkSteps steps={[
      { number: "S", label: "Skill", hint: "Name one concrete capability. Not 'I'm good at coding': 'I'm strong in Java with hands-on Spring Boot experience.'" },
      { number: "P", label: "Proof", hint: "Back it with one specific example: a project, hackathon, internship task: anything real with a measurable outcome." },
      { number: "R", label: "Relevance", hint: "Connect it explicitly to what this company does. Show you researched: name a product, division, or technical challenge." },
    ]} />
  ),

  /* Self-introduction: present-past-future */
  "how-to-introduce-yourself-in-interview||The Perfect Structure (Present-Past-Future)": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present", hint: "Who you are professionally right now: your role, key skills, and your strongest recent achievement." },
      { number: "02", label: "Past", hint: "How you got here: relevant education and experience that created the trajectory you're on." },
      { number: "03", label: "Future", hint: "Why you're here: what excites you about this specific role at this specific company. Be concrete." },
    ]} />
  ),

  /* Python developer salary */
  "python-developer-salary-india-2026||Python Developer Salary by Experience Level (2026)": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Fresher (0–1 yr): service co.", min: 3.5, max: 6 },
      { role: "Fresher (0–1 yr): product co.", min: 6, max: 10 },
      { role: "Junior (1–3 yr)", min: 7, max: 14 },
      { role: "Mid-level (3–6 yr)", min: 14, max: 25 },
      { role: "Senior (6+ yr)", min: 25, max: 45 },
      { role: "Staff / Principal", min: 45, max: 80 },
    ]} caption="Python developer salaries India 2026" />
  ),

  /* Python salary by company type */
  "python-developer-salary-india-2026||Python Salaries by Company Type": (
    <TierCompare cards={[
      {
        tier: "FAANG India",
        examples: "Google · Amazon · Microsoft · Meta",
        rows: [{ label: "Range (by level)", range: "₹20–60 LPA + RSUs" }],
      },
      {
        tier: "Unicorn Startups",
        examples: "Razorpay · PhonePe · CRED · Meesho",
        rows: [{ label: "Range", range: "₹15–40 LPA + equity" }],
      },
      {
        tier: "IT Service Companies",
        examples: "TCS · Infosys · Wipro · HCL",
        rows: [{ label: "Range", range: "₹4–18 LPA" }],
      },
    ]} />
  ),

  /* Data analyst salary by experience */
  "data-analyst-salary-india-2026||Data Analyst Salary by Experience (India 2026)": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Entry Level (0–1 yr)", min: 3, max: 6 },
      { role: "Junior Analyst (1–3 yr)", min: 6, max: 12 },
      { role: "Mid-level (3–6 yr)", min: 12, max: 22 },
      { role: "Senior Analyst (6+ yr)", min: 22, max: 35 },
      { role: "Analytics Lead / Manager", min: 30, max: 50 },
    ]} caption="Data analyst salaries India 2026" />
  ),

  /* Data roles comparison */
  "data-analyst-salary-india-2026||Data Analyst vs Data Engineer vs Data Scientist Salary": (
    <TierCompare cards={[
      {
        tier: "Data Analyst",
        examples: "SQL · BI · Business insights",
        rows: [{ label: "Salary range", range: "₹3–30 LPA" }],
      },
      {
        tier: "Data Engineer",
        examples: "Pipelines · PySpark · Cloud",
        rows: [{ label: "Salary range", range: "₹8–45 LPA" }],
      },
      {
        tier: "Data Scientist",
        examples: "ML · Statistics · Modelling",
        rows: [{ label: "Salary range", range: "₹8–40 LPA" }],
      },
    ]} />
  ),

  /* TCS iON NQT: exam pattern */
  "how-to-crack-tcs-ion-nqt-2026||TCS NQT 2026 Exam Pattern and Sections": (
    <RoundFlow rounds={[
      { label: "Verbal Ability", duration: "30 min", detail: "24 questions: RC, vocabulary, error spotting" },
      { label: "Reasoning Ability", duration: "50 min", detail: "30 questions: logical, blood relations, seating" },
      { label: "Numerical Ability", duration: "40 min", detail: "26 questions: arithmetic, DI, time-speed-distance" },
      { label: "Programming Logic", duration: "15 min", detail: "10 questions: flowcharts, pseudocode, algorithms" },
      { label: "Coding (Digital only)", duration: "45 min", detail: "2 medium-difficulty programming problems" },
    ]} />
  ),

  /* TCS iON NQT: 30-day plan */
  "how-to-crack-tcs-ion-nqt-2026||30-Day NQT Preparation Plan": (
    <FrameworkSteps steps={[
      { number: "W1", label: "Baseline + Verbal / Reasoning", hint: "Take a full mock before prep. Identify weakest section. Days 1–7: 1 hr verbal + 1 hr reasoning daily." },
      { number: "W2", label: "Numerical + Programming Logic", hint: "Days 8–14: arithmetic shortcuts, percentage tricks, profit-loss. 30 min programming logic daily." },
      { number: "W3", label: "Speed Drills + Mocks", hint: "Days 15–21: timed drills for slow question types. Take 2 full mock tests, review mistakes between each." },
      { number: "W4", label: "Simulation + HR Prep", hint: "Days 22–28: 3 full mock tests spaced for review. Practice 5 HR questions out loud daily with STAR structure." },
    ]} />
  ),

  /* Wipro Elite NTH vs NLTH */
  "wipro-elite-nlth-preparation-2026||Wipro Elite NTH vs NLTH: What's the Difference?": (
    <SalaryLadder maxLPA={8} rows={[
      { role: "NLTH Standard", min: 3.5, max: 4.5, note: "60%+ academics" },
      { role: "Elite NTH (Turbo)", min: 6.5, max: 7, note: "65%+ academics, harder coding" },
    ]} caption="Both routes use same interview process" />
  ),

  /* React developer salary */
  "react-developer-salary-india-2026||React Developer Salary by Experience (India 2026)": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Fresher (0–1 yr)", min: 4, max: 8 },
      { role: "Junior (1–3 yr)", min: 8, max: 16 },
      { role: "Mid-level (3–6 yr)", min: 16, max: 28 },
      { role: "Senior Frontend Eng. (6+ yr)", min: 28, max: 45 },
      { role: "Staff / Principal", min: 45, max: 70 },
    ]} caption="React developer salaries India 2026" />
  ),

  /* Zomato PM: interview process */
  "zomato-product-manager-interview-2026||Zomato's Interview Process (2026)": (
    <RoundFlow rounds={[
      { label: "Recruiter Call", duration: "30 min", detail: "Background, motivation, 'Why Zomato?' must be specific" },
      { label: "Case Round 1", duration: "60 min", detail: "Product sense or improvement case (restaurant discovery, order frequency)" },
      { label: "Case Round 2", duration: "60 min", detail: "Metric / analytics case (diagnose reorder rate drop, define Gold metrics)" },
      { label: "Behavioral Round", duration: "45 min", detail: "Ownership, data-driven decisions, customer empathy" },
      { label: "Leadership Round", duration: "45 min", detail: "Product strategy + cross-functional alignment stories" },
    ]} />
  ),

  /* Campus placements: typical process */
  "campus-placement-interview-tips||Typical Placement Process": (
    <RoundFlow rounds={[
      { label: "PPT", detail: "Pre-Placement Talk: attend every one, even for uncertain companies" },
      { label: "Aptitude Test", duration: "45–90 min", detail: "Quantitative, verbal, logical reasoning: eliminates 60–80%" },
      { label: "Technical Round", detail: "DSA + CS fundamentals + project discussion" },
      { label: "HR Round", detail: "Behavioral questions, salary expectations, joining date" },
    ]} />
  ),

  /* Mock interview: 3-session framework */
  "mock-interview-practice-guide||The 3-Session Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Baseline Session", hint: "Do a full mock without preparation. Record yourself. Establishes where you actually are: not where you think you are." },
      { number: "02", label: "Targeted Practice", hint: "Focus on the 2–3 weaknesses from Session 1. If answers lack structure, drill STAR. If filler words, practice pausing." },
      { number: "03", label: "Full Simulation", hint: "Simulate the real interview as closely as possible: different question types, time pressure, follow-ups. Builds confidence through realism." },
    ]} />
  ),

  /* Salary negotiation: headroom by level */
  "salary-negotiation-tips-india||When Companies Have Room to Negotiate": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Freshers: mass hiring", min: 0, max: 10, note: "0–10% room" },
      { role: "Freshers: product companies", min: 15, max: 30, note: "15–30% room" },
      { role: "Experienced (3–5 yrs)", min: 20, max: 40, note: "20–40% room" },
      { role: "Experienced (5+ yrs)", min: 25, max: 50, note: "25–50% room" },
    ]} caption="Negotiation headroom as % of initial offer" />
  ),

  /* ── Batch 26 ── */

  /* LinkedIn: getting found by recruiters */
  "linkedin-profile-tips-india-tech-2026||Getting Found by Indian Recruiters": (
    <FrameworkSteps steps={[
      { number: "01", label: "Keyword-Dense Headline", hint: "Include role title + top 2–3 technologies. Appears in search results: recruiters filter on it before clicking your profile." },
      { number: "02", label: "All-Star Profile Completion", hint: "Photo, headline, About, 3+ experience entries, 5+ skills, education. LinkedIn boosts All-Star profiles in search ranking." },
      { number: "03", label: "Skill Assessments", hint: "Top-30% badges for Python, JavaScript, SQL, or cloud skills increase search visibility and add a verified signal." },
      { number: "04", label: "Consistent Posting", hint: "Posting once every 2 weeks (lessons from a project, interview tips, technical explainers) compounds profile reach through LinkedIn's feed algorithm." },
      { number: "05", label: "Proactive Recruiter Outreach", hint: "Connect with recruiters at target companies. Send a 3-sentence note: role you're targeting, key skill, ask to connect. Under 100 words." },
    ]} />
  ),

  /* Networking: getting referrals */
  "networking-tips-india-tech-jobs-2026||Getting Referrals": (
    <FrameworkSteps steps={[
      { number: "01", label: "Map Your Existing Network", hint: "List college batchmates, former colleagues, and LinkedIn connections at target companies. Warm connections convert 5–10x better than cold outreach." },
      { number: "02", label: "Engage Before Asking", hint: "Comment on their posts, like their updates, and reconnect with a genuine message before asking for a referral. Cold referral requests get ignored." },
      { number: "03", label: "Make It Easy to Refer You", hint: "Send a 150-word message with the exact role link, your resume, and a one-paragraph pitch on why you're a good fit. Remove every friction." },
      { number: "04", label: "Follow Up Once", hint: "If no reply in a week, send one polite follow-up. Never more than once: the relationship matters beyond this referral." },
      { number: "05", label: "Convert to a Friend, Not a Transaction", hint: "Offer to return the favour. Share relevant job openings for their profile. Networking is a long game; reciprocity builds real relationships." },
    ]} />
  ),

  /* Services-to-product: 18-month prep timeline */
  "it-service-to-product-company-switch-india-2026||The Preparation Timeline": (
    <PrepTimeline phases={[
      {
        period: "Month 1–3",
        label: "Foundations",
        tasks: ["LeetCode Easy/Medium (2–3 per week)", "Revise CS fundamentals: OS, DBMS, Networking", "System design basics: read Designing Data-Intensive Applications chapters 1–4"],
        milestone: "Solving Easy in <20 min",
      },
      {
        period: "Month 4–9",
        label: "Build & Portfolio",
        tasks: ["Build 1 personal project with modern stack (React/Node or FastAPI/Postgres)", "Target 200+ LeetCode problems: focus on Blind 75", "Mock interviews with peers or HireStepX"],
        milestone: "Portfolio project live on GitHub",
      },
      {
        period: "Month 10–14",
        label: "Apply & Practice",
        tasks: ["Apply to product companies in batches (5–10 per week)", "System design interviews: HLD + LLD for 20 common scenarios", "Behavioural STAR stories: 8–10 ready responses"],
        milestone: "First onsite interview",
      },
      {
        period: "Month 15–18",
        label: "Negotiate & Switch",
        tasks: ["Use competing offers to negotiate compensation", "Evaluate ESOP vesting, base, and culture fit", "Plan notice period exit professionally"],
        milestone: "Offer signed",
      },
    ]} />
  ),

  /* Competitive programming: platform guide */
  "competitive-programming-india-placement-2026||Platform Guide": (
    <FrameworkSteps steps={[
      { number: "01", label: "Codeforces: Competitive Ladder", hint: "Best platform to develop contest intuition. Participate in Div 2 and Div 3 rounds. Target 1200–1600 rating before placements. Exposes you to greedy, binary search, and graph problems in timed conditions." },
      { number: "02", label: "LeetCode: Interview Filter", hint: "The primary OA platform for Indian product companies and FAANG India. Focus on Blind 75 + company-tagged problems. NeetCode roadmap is the most efficient study structure." },
      { number: "03", label: "HackerRank: OA Practice", hint: "Used for TCS, Infosys, and Wipro OAs. Practice HackerRank's problem sets under time pressure. Their format is formulaic: mock their exact UI before real OAs." },
      { number: "04", label: "CodeChef: Long Challenges", hint: "Monthly long challenges teach optimisation thinking. Rating 1800+ puts you in the top 5%: notable on a resume for service companies." },
      { number: "05", label: "ICPC / National Olympiads", hint: "ICPC regionals and ICPC-style practice make LeetCode Hard feel routine. Even a qualifying attempt signals top-tier algorithmic ability to product companies." },
    ]} />
  ),

  /* GitHub portfolio: building it */
  "github-portfolio-career-india-2026||Building a Portfolio on GitHub": (
    <FrameworkSteps steps={[
      { number: "01", label: "Profile README", hint: "Create a repo named <your-username>/<your-username>. Its README.md becomes your GitHub profile homepage. Include: skills badge grid, featured projects, links to LinkedIn and LeetCode. Recruiters see this first." },
      { number: "02", label: "1–2 Anchor Projects", hint: "Quality beats quantity. Build one full-stack project and one system/tool project. Each needs a real problem statement, a clean README with screenshots, and working deployed links." },
      { number: "03", label: "Contribution Graph", hint: "Green squares matter. Commit to personal projects consistently: even small documentation or test additions count. A bare graph signals dormancy; daily commits signal active engineering." },
      { number: "04", label: "Pinned Repositories", hint: "Pin your 6 best repositories on your profile. Choose projects that demonstrate breadth: one frontend, one backend, one tool/script, one data/ML if applicable." },
      { number: "05", label: "Clean Code Practices", hint: "Recruiters who look beyond README will check your code. Use meaningful variable names, write a few tests, add a .env.example, and keep commits atomic with clear messages." },
    ]} />
  ),

  /* Android/Kotlin: architecture questions */
  "android-kotlin-interview-questions-india-2026||Android Architecture Questions": (
    <RoundFlow rounds={[
      { label: "MVVM Pattern", duration: "Most common", detail: "Model-View-ViewModel with LiveData/StateFlow. ViewModel survives config changes; View only observes state." },
      { label: "Clean Architecture", duration: "SDE-2+ roles", detail: "Presentation → Domain → Data layers. UseCases are pure Kotlin; Repositories abstract data sources." },
      { label: "Jetpack Compose", duration: "2024–2026 standard", detail: "Composables, remember/rememberSaveable, side effects (LaunchedEffect, SideEffect), recomposition triggers." },
      { label: "Dependency Injection", duration: "Hilt mandatory", detail: "Hilt modules, @Inject, @HiltViewModel, @Singleton vs @ActivityScoped: scope leaks are a common failure point." },
      { label: "Coroutines + Flow", duration: "Kotlin async standard", detail: "Structured concurrency, SupervisorScope, SharedFlow vs StateFlow, cancellation propagation." },
    ]} />
  ),

  /* Relocation: city comparison */
  "relocation-tech-jobs-india-cities-2026||Bengaluru: India's Undisputed Tech Capital": (
    <ComparisonTable
      columns={[
        { name: "Bengaluru" },
        { name: "Hyderabad", highlight: true },
        { name: "Pune" },
        { name: "Chennai" },
      ]}
      rows={[
        { label: "Avg Salary (5yr)", values: ["₹22–35 LPA", "₹20–32 LPA", "₹16–28 LPA", "₹15–25 LPA"] },
        { label: "Rent (1BHK)", values: ["₹25–45K/mo", "₹15–30K/mo", "₹12–25K/mo", "₹12–22K/mo"] },
        { label: "Cost of Living", values: ["High", "Medium-High", "Medium", "Medium"] },
        { label: "FAANG Presence", values: ["★★★", "★★★", "★★", "★★"] },
        { label: "Startup Ecosystem", values: ["★★★", "★★", "★★", "★"] },
        { label: "Traffic & Commute", values: ["Severe", "Moderate", "Moderate", "Moderate"] },
      ]}
      caption="2026 estimates: salary ranges reflect SDE-2 to senior engineer across product companies"
    />
  ),

  /* Python coding: interview patterns */
  "python-coding-interview-india-2026||Python Interview Patterns": (
    <FrameworkSteps steps={[
      { number: "01", label: "Built-in Data Structures", hint: "collections.defaultdict, Counter, deque, heapq: knowing which to reach for cuts solution time in half. Most Indian OAs test these in disguise." },
      { number: "02", label: "List/Dict Comprehensions", hint: "Idiomatic Python: interviewers notice when you write a for-loop where a comprehension would be cleaner. Shows Python fluency beyond syntax." },
      { number: "03", label: "Two-Pointer & Sliding Window", hint: "Most frequent pattern in Python OAs: works on strings and arrays alike. Master the template: left/right pointer, window expand/shrink, result tracking." },
      { number: "04", label: "Recursion + Memoisation", hint: "Python's @functools.lru_cache turns a recursive solution into a memoised DP in one decorator. Interviewers love this: shows idiomatic thinking." },
      { number: "05", label: "Time/Space Complexity", hint: "State Big-O explicitly before coding. In Python, append() is O(1) amortised, sorted() is O(n log n), dict lookup is O(1): interviewers test whether you know this." },
    ]} />
  ),

  /* Notice period: early release strategies */
  "notice-period-negotiation-india-2026||Early Release Strategies": (
    <FrameworkSteps steps={[
      { number: "01", label: "Request a Buyout Upfront", hint: "Most companies allow buyout at current CTC pro-rated. Calculate the exact amount before negotiating. New employer often reimburses up to 1–2 months buyout: confirm in writing before resigning." },
      { number: "02", label: "Offer Knowledge Transfer", hint: "Frame it as responsible: 'I can complete a thorough knowledge transfer in 4 weeks rather than spending 3 months on reduced productivity.' Many managers prefer clean closure to a disengaged employee for 90 days." },
      { number: "03", label: "Align with a Quiet Period", hint: "Request early release during low-business-activity periods: quarter start, after a product launch, or during annual appraisal season when managers have other priorities." },
      { number: "04", label: "Get HR and Manager Aligned", hint: "The decision requires both. Get your manager's informal buy-in first, then formalise with HR. If manager resists, going to HR first creates adversarial dynamics." },
      { number: "05", label: "Document Everything in Writing", hint: "Verbal agreement on early release is unenforceable. Get the revised last working day in writing from HR before communicating the date to your new employer." },
    ]} />
  ),

  /* Cloud architecture: AWS design scenarios */
  "cloud-architecture-interview-india-2026||AWS Architecture Design Scenarios": (
    <RoundFlow rounds={[
      { label: "Requirement Clarification", duration: "5 min", detail: "Scale (RPS, users), consistency requirements, latency SLA, budget constraints: ask before drawing." },
      { label: "High-Level Design", duration: "10 min", detail: "Sketch core components: load balancer, application tier, database, cache, storage. Identify the critical path." },
      { label: "Deep Dives", duration: "15–20 min", detail: "Interviewer picks 1–2 components to drill: schema design, cache invalidation, scaling the bottleneck." },
      { label: "Trade-off Discussion", duration: "5–10 min", detail: "SQL vs NoSQL, eventual vs strong consistency, sync vs async: state trade-offs explicitly; right answer depends on constraints." },
      { label: "Failure Modes", duration: "5 min", detail: "How does the system behave if DB goes down? If cache misses 100%? If a service crashes mid-transaction? Shows production maturity." },
    ]} />
  ),
  /* ── Company Guides A ── */
  /* resume-tips-freshers-india-2026: Resume tips for freshers — ATS and section strategy */
  "resume-tips-freshers-india-2026||ATS Optimisation: What Indian Companies Actually Use": (
    <FrameworkSteps steps={[
      { number: "01", label: "Use Standard Section Headings", hint: "Write 'Experience', 'Education', 'Skills' — ATS parsers at TCS, Infosys, and Wipro fail on creative labels like 'My Journey'" },
      { number: "02", label: "Match Keywords from the JD", hint: "Copy exact skill terms from the job description — 'Core Java' not just 'Java', 'REST APIs' not 'web services'" },
      { number: "03", label: "Avoid Tables and Columns", hint: "Multi-column resume layouts break most ATS tools used by Indian IT companies including iCIMS and SuccessFactors" },
      { number: "04", label: "Use .docx or .pdf Correctly", hint: "Send .docx to large IT companies unless PDF is specified — many Indian ATS systems parse Word better than PDF" },
      { number: "05", label: "No Headers or Footers for Key Info", hint: "Do not put your name, phone, or email in the document header — ATS often ignores text outside the body" },
    ]} />
  ),

  "resume-tips-freshers-india-2026||CGPA and Academics: The Real Cutoff Situation": (
    <ComparisonTable
      columns={[{ name: "Company Type" }, { name: "Typical CGPA Cutoff", highlight: true }, { name: "Flexibility?" }]}
      rows={[
        { label: "TCS / Infosys / Wipro / HCL", values: ["6.0 – 7.0", "Hard cutoff, rarely waived"] },
        { label: "Capgemini / Cognizant / Tech Mahindra", values: ["6.0", "Some flexibility with strong test score"] },
        { label: "Product startups (Meesho / Zepto)", values: ["No cutoff stated", "Projects and skills matter most"] },
        { label: "FAANG India (Google / Amazon / Microsoft)", values: ["No official cutoff", "Resume screen by humans; strong projects help"] },
        { label: "BFSI tech (JP Morgan / Goldman)", values: ["7.0+", "Hard cutoff for campus hires"] },
      ]}
      caption="Cutoffs are for campus hiring 2026; off-campus and referral routes often bypass them"
    />
  ),

  /* freshworks-interview-questions-india-2026: Freshworks SDE interview process and compensation */
  "freshworks-interview-questions-india-2026||The Four-Round Freshworks SDE Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "2–3 DSA problems on HackerRank, medium difficulty; basic CS fundamentals MCQs" },
      { label: "Technical Round 1", duration: "60 min", detail: "DSA problem-solving + discussion of past projects; focus on problem decomposition" },
      { label: "Technical Round 2", duration: "60 min", detail: "System design for SaaS scale: multi-tenancy, rate limiting, webhooks, API design" },
      { label: "Hiring Manager / Bar Raiser", duration: "45 min", detail: "Culture fit, ownership mindset, product thinking for SaaS; STAR-based behavioral questions" },
    ]} />
  ),

  "freshworks-interview-questions-india-2026||Compensation: ₹14–22 LPA + Public RSUs": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22, note: "Base + RSUs; Chennai/Hyderabad base" },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 38, note: "Significant RSU component at this level" },
      { role: "SDE-3 / Senior", min: 35, max: 55, note: "Public stock (NASDAQ: FRSH) adds meaningful upside" },
    ]} caption="Freshworks India 2026; Chennai HQ base + RSUs; values are total compensation" />
  ),

  /* phonepe-interview-questions-india-2026: PhonePe interview process and compensation */
  "phonepe-interview-questions-india-2026||The Four-Round PhonePe Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems, medium-hard; focus on arrays, graphs, and dynamic programming" },
      { label: "Coding Interview 1", duration: "60 min", detail: "Live DSA problem + time/space complexity discussion; clean code emphasis" },
      { label: "System Design", duration: "60 min", detail: "Design a payments system, UPI flow, fraud detection, or high-availability ledger" },
      { label: "Behavioral + Leadership", duration: "45 min", detail: "Builder mindset questions: ownership, moving fast, customer obsession in fintech" },
    ]} />
  ),

  "phonepe-interview-questions-india-2026||Compensation at PhonePe": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 32, note: "Base + ESOPs; Bengaluru base" },
      { role: "SDE-2 (2–5 yrs)", min: 32, max: 50, note: "ESOP grants at Series-funded valuation" },
      { role: "SDE-3 / Senior", min: 45, max: 65, note: "Pre-IPO ESOP upside; Walmart backing" },
    ]} caption="PhonePe India 2026; Bengaluru HQ; ESOPs at pre-IPO valuation included" />
  ),

  /* paytm-interview-questions-india-2026: Paytm SDE interview and salary */
  "paytm-interview-questions-india-2026||SDE Technical Round: What Paytm Actually Asks": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems (easy-medium); some roles include SQL or system design MCQs" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; focus on data structures, OOPS concepts, and real fintech scenarios" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design: payments gateway, wallet reconciliation, high-volume transaction systems" },
      { label: "HR / Culture Fit", duration: "30 min", detail: "Motivation, post-restructuring context; questions about ambiguity and adaptability" },
    ]} />
  ),

  "paytm-interview-questions-india-2026||Paytm Salary 2026: Post-Restructuring Reality": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 12, max: 20, note: "Lower than peak-era packages; stable post-restructuring" },
      { role: "SDE-2 (2–5 yrs)", min: 20, max: 35, note: "ESOPs still offered but at restructured valuation" },
      { role: "SDE-3 / Tech Lead", min: 30, max: 45, note: "Fintech domain expertise valued" },
    ]} caption="Paytm India 2026; Noida/Bengaluru base; post-RBI directive restructuring context" />
  ),

  /* cred-interview-questions-india-2026: CRED interview process and salary */
  "cred-interview-questions-india-2026||CRED Interview Process: What to Expect": (
    <RoundFlow rounds={[
      { label: "Application Screen", duration: "—", detail: "Extremely selective: strong DSA portfolio, top-tier college or exceptional project work required" },
      { label: "Online Assessment", duration: "90 min", detail: "Hard-level DSA problems; CRED targets candidates comfortable with LeetCode hard" },
      { label: "Technical Interview 1", duration: "75 min", detail: "Deep DSA + system design; high bar on code quality, edge case handling, and complexity" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design: credit scoring infrastructure, high-concurrency payment flows, data pipelines" },
      { label: "Founder / Culture Round", duration: "45 min", detail: "CRED culture is high-trust, high-bar; deep questions on past work, ownership, and taste" },
    ]} />
  ),

  "cred-interview-questions-india-2026||CRED Salary 2026: Pre-IPO Premium": (
    <SalaryLadder maxLPA={75} rows={[
      { role: "SDE-1 (0–3 yrs)", min: 25, max: 40, note: "High cash + ESOPs; pre-IPO upside" },
      { role: "SDE-2 (3–6 yrs)", min: 38, max: 58, note: "Significant ESOP grants at Series-F valuation" },
      { role: "SDE-3 / Senior", min: 50, max: 75, note: "CRED pays top-10% of India market" },
    ]} caption="CRED India 2026; Bengaluru HQ; pre-IPO ESOPs; highly selective hiring" />
  ),

  /* groww-interview-questions-india-2026: Groww interview process and salary */
  "groww-interview-questions-india-2026||Groww Interview Process: Round by Round": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems on HackerEarth/HackerRank; medium difficulty, focus on arrays and graphs" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; clean code and time complexity are evaluated strictly" },
      { label: "System Design", duration: "60 min", detail: "Design a trading platform, stock price feed, portfolio tracker, or real-time charting system" },
      { label: "Hiring Manager", duration: "45 min", detail: "Product thinking, fintech domain interest, past impact, and culture alignment" },
    ]} />
  ),

  "groww-interview-questions-india-2026||Groww Salary in India 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Base + ESOPs; Bengaluru base" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 45, note: "ESOP component significant at growth stage" },
      { role: "SDE-3 / Senior", min: 40, max: 55, note: "Pre-IPO ESOP upside; Series-E+ company" },
      { role: "Data Engineer / Analyst", min: 14, max: 30, note: "Python + SQL focus; slightly lower than SDE" },
    ]} caption="Groww India 2026; Bengaluru; ESOPs at pre-IPO valuation; total compensation" />
  ),

  /* nykaa-interview-questions-india-2026: Nykaa SDE interview and salary */
  "nykaa-interview-questions-india-2026||Nykaa Interview Process: SDE Roles": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems (easy-medium); some roles include system design MCQs" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + backend concepts; Java/Python; e-commerce domain scenarios (catalog, cart, search)" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design: product catalog at scale, recommendation engine, order management system" },
      { label: "HR / Manager Round", duration: "30 min", detail: "Culture fit for consumer tech; questions on working in fast-paced beauty/fashion domain" },
    ]} />
  ),

  "nykaa-interview-questions-india-2026||Nykaa Salary in India 2026": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 12, max: 22, note: "Mumbai/Bengaluru base; listed company ESOPs" },
      { role: "SDE-2 (2–5 yrs)", min: 20, max: 35, note: "Public ESOPs at NSE-listed valuation" },
      { role: "SDE-3 / Senior", min: 30, max: 45, note: "Niche in beauty-tech; good work-life balance" },
    ]} caption="Nykaa India 2026; NSE-listed; Mumbai HQ; total compensation including ESOPs" />
  ),

  /* ola-interview-questions-india-2026: Ola interview process and salary */
  "ola-interview-questions-india-2026||Ola Cabs Interview Process: SDE Roles": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "DSA problems focused on graphs, shortest paths, real-time systems, and geospatial queries" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; ride-hailing domain questions (driver matching, surge pricing algorithms)" },
      { label: "System Design", duration: "60 min", detail: "Design a cab allocation system, EV charging network, or real-time location tracking at scale" },
      { label: "Hiring Manager", duration: "45 min", detail: "Product thinking for mobility tech; questions on ambiguity, fast execution, and ownership" },
    ]} />
  ),

  "ola-interview-questions-india-2026||Ola Salary in India 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 15, max: 25, note: "Ola Cabs or Ola Electric; Bengaluru base" },
      { role: "SDE-2 (2–5 yrs)", min: 25, max: 40, note: "ESOPs at Ola Group valuation" },
      { role: "SDE-3 / Senior", min: 35, max: 50, note: "Ola Electric track has hardware-software premium" },
    ]} caption="Ola India 2026; Bengaluru HQ; ESOPs at Ola Group blended valuation" />
  ),

  /* makemytrip-interview-questions-india-2026: MakeMyTrip interview and salary */
  "makemytrip-interview-questions-india-2026||MakeMyTrip Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems (easy-medium); travel domain context occasionally embedded in problem statements" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; caching, search, and pricing algorithm scenarios" },
      { label: "System Design", duration: "60 min", detail: "Design a flight/hotel search system, dynamic pricing engine, or booking inventory manager" },
      { label: "Hiring Manager", duration: "30 min", detail: "Culture fit; interest in travel tech; STAR-based behavioral questions" },
    ]} />
  ),

  "makemytrip-interview-questions-india-2026||MakeMyTrip Salary in India 2026": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22, note: "Gurugram/Bengaluru base; NASDAQ-listed RSUs" },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 35, note: "RSU component at MakeMyTrip NASDAQ listing" },
      { role: "SDE-3 / Senior", min: 30, max: 45, note: "Travel tech niche; good learning environment" },
    ]} caption="MakeMyTrip India 2026; Gurugram HQ; NASDAQ-listed; RSUs included in TC" />
  ),

  /* meesho-interview-questions-india-2026: Meesho interview process and salary */
  "meesho-interview-questions-india-2026||Meesho Interview Process: SDE Roles": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems; Meesho sets medium-hard bar for product team; focus on graphs and DP" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + backend fundamentals; social commerce scenarios (catalog, supplier onboarding, logistics)" },
      { label: "System Design", duration: "60 min", detail: "Design a seller dashboard, order routing system, or personalized product feed for Tier-2 India" },
      { label: "Hiring Manager", duration: "45 min", detail: "Meesho values frugality and impact; questions about doing more with less and working in ambiguity" },
    ]} />
  ),

  "meesho-interview-questions-india-2026||Meesho Salary in India 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Bengaluru base; strong ESOP package" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 42, note: "Pre-IPO ESOPs; Series-F valuation" },
      { role: "SDE-3 / Senior", min: 38, max: 50, note: "Meesho hiring is selective; total comp competitive" },
    ]} caption="Meesho India 2026; Bengaluru; pre-IPO ESOPs; total compensation" />
  ),

  /* tcs-nqt-preparation-guide-india-2026: TCS NQT exam structure and interview */
  "tcs-nqt-preparation-guide-india-2026||TCS NQT 2026 Exam Pattern: Complete Section Breakdown": (
    <ComparisonTable
      columns={[{ name: "Section" }, { name: "Questions" }, { name: "Time" }, { name: "Difficulty", highlight: true }]}
      rows={[
        { label: "Verbal Ability", values: ["24", "30 min", "Easy–Medium"] },
        { label: "Reasoning Ability", values: ["30", "50 min", "Medium"] },
        { label: "Numerical Ability", values: ["26", "40 min", "Easy–Medium"] },
        { label: "Programming Logic (MCQ)", values: ["10", "15 min", "Medium"] },
        { label: "Coding (2 problems)", values: ["2", "30 min", "Easy–Medium"] },
        { label: "Advanced Coding (Optional)", values: ["1", "20 min", "Hard (for Prime/Ninja)"] },
      ]}
      caption="TCS NQT 2026 pattern; total ~165 min; Prime track requires higher cutoffs"
    />
  ),

  "tcs-nqt-preparation-guide-india-2026||After NQT: The TCS Interview Process": (
    <RoundFlow rounds={[
      { label: "TCS NQT Exam", duration: "165 min", detail: "Verbal + Reasoning + Numerical + Coding; score determines track (Digital / Prime / Ninja)" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (DBMS, OS, OOP, Networking); one language in depth; project discussion" },
      { label: "Managerial Round", duration: "30 min", detail: "HR-style questions; leadership, teamwork, relocation willingness; asked in Prime/Digital track" },
      { label: "HR Round", duration: "20 min", detail: "Background, salary expectations, bond awareness, onboarding paperwork" },
    ]} />
  ),

  /* wipro-interview-questions-india-2026: Wipro interview process and salary */
  "wipro-interview-questions-india-2026||Wipro Interview Process 2026: All Rounds": (
    <RoundFlow rounds={[
      { label: "Online Assessment (WNTH)", duration: "120 min", detail: "Aptitude + Verbal + Logical + Essay + Coding (2 problems); Elite NLTH has harder coding" },
      { label: "Essay Writing", duration: "20 min", detail: "Written communication assessment; included in WNTH; judged on clarity and grammar" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS), one programming language, projects from resume" },
      { label: "HR Interview", duration: "20 min", detail: "Location, relocation, bond terms (1 year), career goals, salary discussion" },
    ]} />
  ),

  "wipro-interview-questions-india-2026||Wipro Salary in India 2026": (
    <SalaryLadder maxLPA={20} rows={[
      { role: "Fresher – Turbo (Elite NLTH)", min: 6.5, max: 10, note: "Top track for high-scoring candidates" },
      { role: "Fresher – NLTH Package", min: 3.5, max: 5, note: "Standard fresher CTC; most campus hires" },
      { role: "Experienced (2–4 yrs)", min: 7, max: 14, note: "Lateral hires; depends on skill and negotiation" },
      { role: "Senior Engineer (5+ yrs)", min: 12, max: 20, note: "Niche skills (cloud, SAP, Oracle) command premium" },
    ]} caption="Wipro India 2026; Bengaluru/Hyderabad/Pune; gross CTC including variable pay" />
  ),

  /* infosys-interview-questions-india-2026: Infosys interview process and salary */
  "infosys-interview-questions-india-2026||Infosys Interview Process 2026: Complete Round Breakdown": (
    <RoundFlow rounds={[
      { label: "InfyTQ / Online Test", duration: "95 min", detail: "Reasoning + Math + Verbal + Coding (2 problems); SP track needs higher score + harder coding" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals: OOP, DBMS, OS, data structures; one language in depth; projects discussed" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, background, bond terms (not mandated for SE track), career goals, salary" },
    ]} />
  ),

  "infosys-interview-questions-india-2026||Infosys Salary in India 2026": (
    <SalaryLadder maxLPA={18} rows={[
      { role: "SE – Specialist Programmer (SP)", min: 6.5, max: 9, note: "Higher track; requires strong InfyTQ score" },
      { role: "SE – Systems Engineer (Standard)", min: 3.6, max: 4.5, note: "Most campus hires; variable component included" },
      { role: "Experienced (3–5 yrs)", min: 7, max: 14, note: "Lateral; technology stack determines band" },
      { role: "Senior Consultant / Tech Lead", min: 12, max: 18, note: "Digital / cloud specialization premium" },
    ]} caption="Infosys India 2026; Bengaluru/Pune/Hyderabad; gross CTC" />
  ),

  /* cognizant-interview-questions-india-2026: Cognizant interview process and salary */
  "cognizant-interview-questions-india-2026||Cognizant Interview Process 2026: GenC and GenC Next": (
    <RoundFlow rounds={[
      { label: "Online Assessment (COCUBES / CognizantOA)", duration: "90 min", detail: "Aptitude + Verbal + Reasoning + Coding (2 problems); GenC Next has harder problems" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, Networking), Java/Python basics, project discussion" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation preference, background, career goals; Cognizant does not have a mandatory bond" },
    ]} />
  ),

  "cognizant-interview-questions-india-2026||Cognizant Salary in India 2026": (
    <SalaryLadder maxLPA={14} rows={[
      { role: "GenC Next (Engineer)", min: 5, max: 7.5, note: "Higher track; 2-week additional tech training" },
      { role: "GenC (Programmer Analyst)", min: 3.5, max: 4.5, note: "Standard track; most campus hires" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 12, note: "Lateral hires; depends on skill and domain" },
      { role: "Senior Associate (5+ yrs)", min: 10, max: 14, note: "Specialized skills command higher bands" },
    ]} caption="Cognizant India 2026; Chennai/Bengaluru/Pune; gross CTC" />
  ),

  /* amazon-interview-questions-india-2026: Amazon interview process and salary */
  "amazon-interview-questions-india-2026||Amazon India Interview Process: All Rounds for SDE-1 and SDE-2": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "2 DSA problems (medium-hard) + work simulation / debugging section; HackerRank platform" },
      { label: "Phone Screen", duration: "45 min", detail: "1 DSA problem + LP (Leadership Principles) questions; often the first human round" },
      { label: "Virtual Onsite – DSA 1", duration: "60 min", detail: "Medium-hard DSA; time/space complexity required; LPs woven in throughout" },
      { label: "Virtual Onsite – DSA 2", duration: "60 min", detail: "Second DSA round; graph, DP, or design-in-code problems; LP focus increases" },
      { label: "System Design (SDE-2+)", duration: "60 min", detail: "Distributed systems: design a feed aggregator, warehouse system, or notification platform" },
      { label: "Bar Raiser", duration: "60 min", detail: "Behavioural deep-dive on 4–5 LPs with S-T-A-R; evaluates raised-bar for Amazon culture" },
    ]} />
  ),

  "amazon-interview-questions-india-2026||Amazon India Salary 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "SDE-1 (0–3 yrs)", min: 24, max: 38, note: "Base + signing bonus + RSUs (4-year vest)" },
      { role: "SDE-2 (3–6 yrs)", min: 38, max: 60, note: "RSUs form 30–40% of TC at this level" },
      { role: "SDE-3 / Senior (6+ yrs)", min: 55, max: 80, note: "Front-loaded RSU refresh grants common" },
    ]} caption="Amazon India 2026; Bengaluru/Hyderabad; total compensation including RSUs (4yr vest)" />
  ),

  /* google-interview-questions-india-2026: Google India interview process and salary */
  "google-interview-questions-india-2026||Google India SWE Interview Process: All Rounds": (
    <RoundFlow rounds={[
      { label: "Resume Screen", duration: "—", detail: "Extremely selective; top-college preferred but off-campus strong portfolios also considered" },
      { label: "Phone / Video Screen", duration: "45 min", detail: "1 DSA problem (medium-hard); algorithm walk-through and complexity analysis" },
      { label: "Virtual Onsite – Coding 1", duration: "45 min", detail: "1–2 DSA problems; expects clean, working code; no psuedocode" },
      { label: "Virtual Onsite – Coding 2", duration: "45 min", detail: "Second coding round; harder problem or graph/DP/string variant" },
      { label: "Virtual Onsite – System Design", duration: "45 min", detail: "Design at Google scale: web crawler, YouTube, Maps; focus on estimation and trade-offs" },
      { label: "Googleyness Round", duration: "45 min", detail: "Leadership and culture: ambiguity, impact, collaboration; STAR-based with Google values lens" },
    ]} />
  ),

  "google-interview-questions-india-2026||Google India Salary 2026": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "L3 – SWE (New Grad / 0–2 yrs)", min: 30, max: 50, note: "Base + signing + RSUs (4yr vest); Hyderabad/Bengaluru" },
      { role: "L4 – SWE II (2–5 yrs)", min: 48, max: 75, note: "RSU refresh grants kick in; TC can hit ₹70–75L" },
      { role: "L5 – Senior SWE (5–8 yrs)", min: 70, max: 120, note: "Perf-based RSU refresh; top tier in India market" },
    ]} caption="Google India 2026; Hyderabad/Bengaluru; total compensation (base + bonus + RSUs)" />
  ),

  /* microsoft-interview-questions-india-2026: Microsoft India interview and salary */
  "microsoft-interview-questions-india-2026||Microsoft India SDE Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "2–3 DSA problems (medium difficulty); some roles include system design MCQs" },
      { label: "Technical Screen", duration: "45 min", detail: "DSA + OOP problem; evaluates code quality and communication throughout" },
      { label: "Virtual Onsite – DSA", duration: "60 min", detail: "Medium-hard DSA; Microsoft expects clean, well-reasoned code over brute force" },
      { label: "Virtual Onsite – OO Design", duration: "60 min", detail: "Object-oriented design: design a parking lot, elevator system, or chess game" },
      { label: "As Delivered / Growth Mindset", duration: "45 min", detail: "Microsoft values learning agility; questions on feedback, failure, and growth" },
    ]} />
  ),

  "microsoft-interview-questions-india-2026||Microsoft India Salary 2026": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "SDE-1 / L59 (0–2 yrs)", min: 26, max: 42, note: "Base + bonus + RSUs (4yr vest); Hyderabad/Bengaluru" },
      { role: "SDE-2 / L61 (2–5 yrs)", min: 40, max: 65, note: "RSU grants increase significantly at L61" },
      { role: "Senior SDE / L63 (5+ yrs)", min: 60, max: 100, note: "Performance-based RSU refresh; top 5% in India" },
    ]} caption="Microsoft India 2026; Hyderabad GTSC; total compensation including RSUs (4yr vest)" />
  ),

  /* flipkart-interview-questions-india-2026: Flipkart interview process and salary */
  "flipkart-interview-questions-india-2026||Flipkart SDE Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "2–3 DSA problems (medium-hard); Flipkart sets a high bar comparable to Amazon" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; e-commerce domain problem scenarios (catalog, cart, inventory)" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design for e-commerce scale: search ranking, seller platform, delivery optimization" },
      { label: "Hiring Manager / Culture", duration: "45 min", detail: "Flipkart culture: ownership, customer focus, speed; STAR behavioral questions + team fit" },
    ]} />
  ),

  "flipkart-interview-questions-india-2026||Flipkart Salary and Total Compensation 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 22, max: 35, note: "Base + bonus + ESOPs; Bengaluru base" },
      { role: "SDE-2 (2–5 yrs)", min: 35, max: 55, note: "ESOP grants at Walmart-backed valuation" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 50, max: 70, note: "Walmart acquisition adds stability to ESOPs" },
    ]} caption="Flipkart India 2026; Bengaluru; Walmart-backed; total compensation including ESOPs" />
  ),

  /* leetcode-preparation-guide-india-2026: LeetCode preparation — patterns and study plan */
  "leetcode-preparation-guide-india-2026||The 10 Core DSA Patterns: LeetCode Interview Patterns": (
    <FrameworkSteps steps={[
      { number: "01", label: "Sliding Window", hint: "Subarray / substring problems with a variable-size window; TCS to Amazon level" },
      { number: "02", label: "Two Pointers", hint: "Sorted array pair problems, container with most water; frequently asked at all tiers" },
      { number: "03", label: "Fast & Slow Pointers", hint: "Cycle detection in linked lists; Floyd's algorithm; common at product companies" },
      { number: "04", label: "BFS / Level-Order", hint: "Shortest path, level-by-level tree traversal; graph problems at Flipkart / Amazon" },
      { number: "05", label: "DFS + Backtracking", hint: "Permutations, combinations, word search; medium-hard problems at top product companies" },
      { number: "06", label: "Binary Search Variants", hint: "Search in rotated array, first/last position; Google and Microsoft favor this pattern" },
      { number: "07", label: "Heap / Priority Queue", hint: "K-th largest, merge K sorted lists; asked regularly at Amazon and Microsoft" },
      { number: "08", label: "Dynamic Programming", hint: "Knapsack, LCS, coin change; hardest pattern; required for Google/Meta bar raiser" },
      { number: "09", label: "Graph Algorithms", hint: "Dijkstra, topological sort, union-find; system design-adjacent DSA at senior levels" },
      { number: "10", label: "Monotonic Stack", hint: "Next greater element, histogram area; elegant pattern; common at FAANG onsite" },
    ]} />
  ),

  "leetcode-preparation-guide-india-2026||8-Week LeetCode Study Plan: For IT Services to Mid-Product Companies": (
    <PrepTimeline caption="8-week plan targeting Infosys SP / Wipro Elite / Freshworks / Groww level" phases={[
      { period: "Week 1–2", label: "Arrays, Strings & Hashmaps", tasks: ["Easy sliding window", "Two pointer problems", "Frequency counting patterns"], milestone: "Solve 30 Easy problems fluently" },
      { period: "Week 3–4", label: "Linked Lists, Stacks & Queues", tasks: ["Reverse linked list variants", "Monotonic stack problems", "Queue BFS foundations"], milestone: "Solve 20 Medium problems" },
      { period: "Week 5–6", label: "Trees & Graphs", tasks: ["DFS/BFS on trees", "Graph traversal (BFS/DFS)", "Cycle detection"], milestone: "Solve 25 Medium tree/graph problems" },
      { period: "Week 7–8", label: "DP + Mock Contests", tasks: ["1D DP (fibonacci, climbing stairs)", "2D DP (grid paths)", "Weekly contests on LeetCode"], milestone: "Complete 2 full mock interviews" },
    ]} />
  ),

  /* goldman-sachs-india-campus-interview-guide: Goldman Sachs India campus interview */
  "goldman-sachs-india-campus-interview-guide||GS India Campus Recruitment Overview": (
    <RoundFlow rounds={[
      { label: "Online Assessment (HireVue)", duration: "60–90 min", detail: "Coding problems + quantitative aptitude + video interview questions; completed asynchronously" },
      { label: "Coding Interview", duration: "60 min", detail: "2–3 DSA problems for Engineering track; medium-hard LeetCode difficulty; focus on correctness" },
      { label: "Quantitative / Brainteaser Round", duration: "45 min", detail: "Probability, mental math, market sizing; applies to Quant and Technology Analyst tracks" },
      { label: "HR / Motivation Round", duration: "30 min", detail: "Why GS, why finance, fit with 'Our People' values; STAR behavioral questions" },
    ]} />
  ),

  "goldman-sachs-india-campus-interview-guide||Coding Interview (Engineering Track)": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "Technology Analyst (Campus)", min: 20, max: 35, note: "Base + bonus; Bengaluru/Hyderabad" },
      { role: "Associate – Technology (2–4 yrs)", min: 30, max: 50, note: "Year-end bonus can equal 30–60% of base" },
      { role: "VP – Engineering (7+ yrs)", min: 45, max: 60, note: "Bonus-heavy comp; BFSI premium over pure tech" },
    ]} caption="Goldman Sachs India 2026; Bengaluru tech centre; base + bonus (bonus excluded from base LPA shown)" />
  ),

  /* jpmorgan-chase-india-interview-guide-2026: JPMC India interview and salary */
  "jpmorgan-chase-india-interview-guide-2026||The Interview Stages": (
    <RoundFlow rounds={[
      { label: "HireVue / Online Assessment", duration: "60 min", detail: "Coding problems + video behavioral questions; Java and Python most common languages" },
      { label: "Technical Phone Screen", duration: "45 min", detail: "DSA problem (medium) + CS fundamentals; sometimes includes finance domain questions" },
      { label: "Virtual Onsite – Coding", duration: "60 min", detail: "2 DSA problems; JPMC expects clean, production-quality code; complexity analysis required" },
      { label: "Virtual Onsite – System Design", duration: "60 min", detail: "Design a trading platform, risk management system, or transaction processing pipeline" },
      { label: "HR / Culture Round", duration: "30 min", detail: "JPMC Business Principles; integrity, client focus, diversity alignment questions" },
    ]} />
  ),

  "jpmorgan-chase-india-interview-guide-2026||Finance and Domain Knowledge": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Software Engineer Analyst (Campus)", min: 22, max: 35, note: "Base + year-end bonus; Bengaluru/Hyderabad/Mumbai" },
      { role: "Associate – SWE (3–5 yrs)", min: 35, max: 50, note: "Bonus component 20–40% of base" },
      { role: "VP – SWE (7+ yrs)", min: 45, max: 55, note: "BFSI premium for fintech/trading systems experience" },
    ]} caption="JP Morgan Chase India 2026; Bengaluru/Hyderabad; base + bonus; BFSI domain premium" />
  ),

  /* groww-fintech-interview-questions-sde-2026: Groww SDE detailed interview */
  "groww-fintech-interview-questions-sde-2026||Groww SDE Interview Stages": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems; HackerEarth; medium difficulty with some hard-level edge cases" },
      { label: "Coding Interview 1", duration: "60 min", detail: "Live DSA; graph traversal, DP, or greedy; clean code and walkthrough expected" },
      { label: "System Design (SDE-2+)", duration: "60 min", detail: "Design stock feed aggregator, trading engine, mutual fund NAV calculator, or KYC system" },
      { label: "Culture Fit / Hiring Manager", duration: "45 min", detail: "Groww values customer obsession and data-driven decisions; STAR + fintech product questions" },
    ]} />
  ),

  "groww-fintech-interview-questions-sde-2026||System Design Round (SDE-2 and Above)": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Bengaluru base; ESOPs at Series-E valuation" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 45, note: "Significant ESOP component at growth stage" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 40, max: 55, note: "Fintech domain expertise commands premium" },
    ]} caption="Groww India 2026; Bengaluru; ESOPs included; pre-IPO valuation context" />
  ),

  /* dream11-technical-interview-questions-2026: Dream11 interview */
  "dream11-technical-interview-questions-2026||Interview Stages": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "DSA problems with sports/gaming context; medium-hard difficulty on HackerRank" },
      { label: "Coding Interview 1", duration: "60 min", detail: "Live DSA: graphs, DP, priority queues; Dream11 tests edge cases and performance constraints" },
      { label: "System Design", duration: "60 min", detail: "Design a fantasy cricket platform: real-time scoring, team selection engine, contest matching" },
      { label: "Culture / Engineering Philosophy", duration: "45 min", detail: "Dream11 engineering values: scale, low latency, high availability; product thinking for gaming" },
    ]} />
  ),

  "dream11-technical-interview-questions-2026||System Design: The Key Differentiator": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Mumbai/Bengaluru base; ESOPs at unicorn valuation" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 45, note: "ESOP grants significant; $8B+ valuation context" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 40, max: 60, note: "Real-time systems expertise highly valued" },
    ]} caption="Dream11 India 2026; Mumbai HQ; ESOPs at unicorn valuation; total compensation" />
  ),

  /* postman-interview-process-sde-india-2026: Postman India interview */
  "postman-interview-process-sde-india-2026||Interview Stages": (
    <RoundFlow rounds={[
      { label: "Application Screen", duration: "—", detail: "Portfolio-focused; open source contributions, API projects, or developer tooling experience valued" },
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems + API design questions; medium difficulty; focus on clean problem decomposition" },
      { label: "Coding Interview", duration: "60 min", detail: "DSA + discussion of past projects; Postman values engineers who understand developer experience" },
      { label: "API Design Round", duration: "60 min", detail: "Design a REST API system, webhook delivery platform, or API gateway; core to Postman's product" },
      { label: "Culture Fit", duration: "30 min", detail: "Remote-first culture; async communication; product empathy for developers; STAR behavioral" },
    ]} />
  ),

  "postman-interview-process-sde-india-2026||API Design Round": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 32, note: "Bengaluru base; USD salary for remote roles sometimes offered" },
      { role: "SDE-2 (2–5 yrs)", min: 32, max: 50, note: "Pre-IPO ESOPs; $5.6B valuation" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 45, max: 60, note: "Remote-first; API platform expertise valued" },
    ]} caption="Postman India 2026; Bengaluru; pre-IPO ESOPs; developer tooling niche premium" />
  ),

  /* hcl-technologies-interview-questions-2026: HCL Technologies detailed guide */
  "hcl-technologies-interview-questions-2026||Selection Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "Aptitude (Quantitative + Verbal + Reasoning) + 2 coding problems; AMCAT or internal test" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals: OOP (Java/C++/Python), DBMS, OS basics; project walkthrough; 1 coding problem" },
      { label: "HR Round", duration: "20 min", detail: "Location preference, background check consent, career goals, salary band for the track" },
    ]} />
  ),

  "hcl-technologies-interview-questions-2026||Compensation and Growth": (
    <SalaryLadder maxLPA={16} rows={[
      { role: "Graduate Engineer Trainee (Fresher)", min: 3.5, max: 5.5, note: "Standard campus track; most hires" },
      { role: "HCL TechBee (Post-12th)", min: 1.8, max: 3, note: "Unique 12th-pass programme; grows to full SWE role" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 11, note: "Lateral hires; domain and tech stack matter" },
      { role: "Lead Engineer (5+ yrs)", min: 10, max: 16, note: "Cloud, DevOps, SAP skills at premium" },
    ]} caption="HCL Technologies India 2026; Noida/Bengaluru/Chennai; gross CTC" />
  ),

  /* capgemini-interview-questions-process-2026: Capgemini interview */
  "capgemini-interview-questions-process-2026||Capgemini 2026 Selection Process": (
    <RoundFlow rounds={[
      { label: "IntelliAdapt Online Test", duration: "100 min", detail: "Game-based psychometric + Aptitude (Quantitative, Verbal, Logical) + Pseudo-code + Essay" },
      { label: "Pseudo-code Round", duration: "30 min", detail: "10 pseudo-code MCQs testing programming logic without requiring a specific language" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS), one language depth (Java/Python/C++), project discussion" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, Capgemini values; no bond required" },
    ]} />
  ),

  "capgemini-interview-questions-process-2026||Compensation for Capgemini Freshers": (
    <SalaryLadder maxLPA={10} rows={[
      { role: "Fresher – Senior Analyst (Promote Track)", min: 5.5, max: 8, note: "Higher track based on IntelliAdapt score" },
      { role: "Fresher – Analyst (Standard)", min: 3.8, max: 5, note: "Most campus hires; variable included" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 10, note: "Lateral hires; SAP and cloud skills premium" },
    ]} caption="Capgemini India 2026; Mumbai/Pune/Chennai/Bengaluru; gross CTC" />
  ),

  /* deloitte-india-interview-guide-2026: Deloitte India interview */
  "deloitte-india-interview-guide-2026||Deloitte USI Campus Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "Aptitude + Verbal + Reasoning + Coding (2 problems for tech roles); some roles include case MCQs" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals for USI tech roles; Java/Python depth; cloud (AWS/Azure) awareness helpful" },
      { label: "Deloitte Case Interview", duration: "40 min", detail: "For Consulting track only: structured case (market entry, profitability, operations); MECE framing" },
      { label: "HR / Partner Round", duration: "30 min", detail: "Motivation, values fit, STAR behavioral questions; Deloitte 'Green Dot' culture alignment" },
    ]} />
  ),

  "deloitte-india-interview-guide-2026||Technical Interview for Technology Roles": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "Analyst – USI Technology (Fresher)", min: 6.5, max: 10, note: "Bengaluru/Hyderabad; cloud, Java, SAP roles" },
      { role: "Consultant – Technology (2–4 yrs)", min: 12, max: 22, note: "Lateral hires; certification premium" },
      { role: "Analyst – Consulting (Fresher MBA)", min: 15, max: 22, note: "IIM/ISB hires; consulting track" },
      { role: "Consultant – Strategy (3–5 yrs)", min: 20, max: 35, note: "Post-MBA or internal promotion; Bengaluru/Mumbai" },
    ]} caption="Deloitte India 2026; USI + Consulting tracks; gross CTC varies significantly by track" />
  ),

  /* tech-mahindra-interview-questions-2026: Tech Mahindra interview */
  "tech-mahindra-interview-questions-2026||Tech Mahindra Hiring Process Overview": (
    <RoundFlow rounds={[
      { label: "SmartHire Online Assessment", duration: "90 min", detail: "Aptitude + Verbal + Logical + Coding (2 problems); Digital track has a harder coding section" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS, Networking), one language proficiency, project discussion" },
      { label: "Communication Assessment", duration: "15 min", detail: "Versant or spoken English test; eliminates candidates with weak English communication" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, Tech Mahindra values; no mandatory bond for most tracks" },
    ]} />
  ),

  "tech-mahindra-interview-questions-2026||Compensation and Growth at Tech Mahindra": (
    <SalaryLadder maxLPA={14} rows={[
      { role: "Fresher – Digital Track", min: 4.5, max: 7, note: "Higher package for strong aptitude + coding score" },
      { role: "Fresher – ELP (Standard)", min: 3.25, max: 4.5, note: "Most campus hires; variable pay included" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 11, note: "Lateral; 5G, cloud, and SAP skills premium" },
      { role: "Senior Engineer (5+ yrs)", min: 9, max: 14, note: "Telecom domain expertise adds significant premium" },
    ]} caption="Tech Mahindra India 2026; Pune/Hyderabad/Bengaluru; gross CTC" />
  ),

  /* mckinsey-case-interview-india-guide: McKinsey India interview */
  "mckinsey-case-interview-india-guide||Case Interview Structure": (
    <RoundFlow rounds={[
      { label: "Problem Solving Game (PSG)", duration: "35 min", detail: "Ecosystem game testing data interpretation, pattern recognition, and systems thinking; online" },
      { label: "First Round Cases (×2)", duration: "60 min", detail: "Two back-to-back case interviews; structured case solving + personal experience questions (PEI)" },
      { label: "Final Round Cases (×2–3)", duration: "90 min", detail: "Senior partner-led cases; more ambiguous; heavier weight on leadership and impact stories" },
      { label: "Personal Experience Interview (PEI)", duration: "Integrated", detail: "McKinsey DRIVE values: delivering impact, leading others, problem solving, entrepreneurship" },
    ]} />
  ),

  "mckinsey-case-interview-india-guide||McKinsey India Hiring Overview": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Business Analyst (Fresher / MBA)", min: 18, max: 28, note: "Mumbai/Gurugram; signing bonus + performance bonus" },
      { role: "Associate (MBA / 3 yrs exp)", min: 28, max: 45, note: "Post-IIM/ISB MBA hires; performance bonus significant" },
      { role: "Engagement Manager (6+ yrs)", min: 40, max: 55, note: "Partner track; bonus can double take-home" },
    ]} caption="McKinsey India 2026; Mumbai/Gurugram/Bengaluru; base + performance bonus; not including profit sharing" />
  ),

  /* oracle-india-interview-guide-2026: Oracle India interview */
  "oracle-india-interview-guide-2026||Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems (medium) + Java/SQL MCQs; Oracle favors Java depth from the first screen" },
      { label: "Technical Interview 1", duration: "60 min", detail: "Core Java: JVM, collections, multithreading, JDBC; DSA problem-solving with Java" },
      { label: "Technical Interview 2", duration: "60 min", detail: "Database depth: SQL, PL/SQL, Oracle DB internals; distributed systems design for cloud products" },
      { label: "Hiring Manager / HR", duration: "30 min", detail: "Cultural fit, product interest (Fusion, Cloud, APEX), career goals, relocation" },
    ]} />
  ),

  "oracle-india-interview-guide-2026||Compensation at Oracle India": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "IC1 / MTS (0–2 yrs)", min: 18, max: 28, note: "Hyderabad/Bengaluru base; Oracle stock (ORC)" },
      { role: "IC2 / Senior MTS (2–5 yrs)", min: 28, max: 45, note: "RSU component at NYSE-listed ORCL valuation" },
      { role: "IC3 / Staff Engineer (5–8 yrs)", min: 40, max: 65, note: "Cloud (OCI) team premium over on-prem product teams" },
    ]} caption="Oracle India 2026; Hyderabad/Bengaluru; total compensation including RSUs (4yr vest)" />
  ),

  /* ibm-india-interview-guide-2026: IBM India interview */
  "ibm-india-interview-guide-2026||IBM Campus Hiring Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment (IPAT)", duration: "72 min", detail: "IBM Placement Aptitude Test: Verbal + Logical + Quantitative + Coding MCQs; adaptive difficulty" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals, one language depth, cloud awareness (IBM Cloud / AWS); project walkthrough" },
      { label: "IBM Consulting Interview", duration: "45 min", detail: "For consulting/GBS hires: case discussion, stakeholder scenarios, analytical reasoning" },
      { label: "HR Interview", duration: "20 min", detail: "IBMer values: trust, innovation, growth; relocation, career goals, compensation discussion" },
    ]} />
  ),

  "ibm-india-interview-guide-2026||IBM Compensation in India": (
    <SalaryLadder maxLPA={18} rows={[
      { role: "Application Developer (Fresher)", min: 4.5, max: 7, note: "IBM Technology unit; Bengaluru/Hyderabad/Pune" },
      { role: "IBM Consulting Analyst (Fresher)", min: 7, max: 10, note: "GBS/Consulting unit; MBA or tech graduates" },
      { role: "Advisory Consultant (3–5 yrs)", min: 12, max: 18, note: "Lateral hires; SAP, Salesforce, cloud skills" },
    ]} caption="IBM India 2026; across business units (Technology vs Consulting); gross CTC" />
  ),

  /* cognizant-genc-interview-questions-2026: Cognizant GenC interview */
  "cognizant-genc-interview-questions-2026||Cognizant Online Assessment": (
    <RoundFlow rounds={[
      { label: "Online Assessment (COCUBES)", duration: "90 min", detail: "Aptitude + Verbal + Reasoning + 2 coding problems; GenC Elevate has harder coding section" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS, Networking), one language proficiency (Java/Python/C++)" },
      { label: "HR Interview", duration: "20 min", detail: "Cognizant values, relocation flexibility, career goals; salary discussion; no bond requirement" },
    ]} />
  ),

  "cognizant-genc-interview-questions-2026||GenC vs GenC Elevate: Two Tracks": (
    <TierCompare cards={[
      {
        tier: "GenC (Programmer Analyst)",
        examples: "Most campus hires",
        rows: [
          { label: "CTC", range: "₹3.5–4.5 LPA" },
          { label: "Coding Difficulty", range: "Easy–Medium" },
          { label: "Training", range: "Standard Lex platform" },
          { label: "Target Colleges", range: "Tier 2–3 engineering colleges" },
        ],
      },
      {
        tier: "GenC Elevate / Next",
        examples: "Top campus scorers",
        rows: [
          { label: "CTC", range: "₹5–7.5 LPA" },
          { label: "Coding Difficulty", range: "Medium–Hard" },
          { label: "Training", range: "2-week additional specialisation" },
          { label: "Target Colleges", range: "NIT / BITS / top state NITs" },
        ],
      },
    ]} />
  ),

  /* accenture-interview-questions-india-2026: Accenture India interview */
  "accenture-interview-questions-india-2026||Accenture Campus Selection Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment (Accenture OA)", duration: "120 min", detail: "Cognitive (Aptitude + Logical) + Technical MCQs + Coding (2 problems) + Communication test (Versant)" },
      { label: "Communication Test (Versant)", duration: "20 min", detail: "Spoken English fluency test; eliminates many candidates; scored 20–80; 54+ required for ASE track" },
      { label: "Technical Interview (ASE Track)", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS), one language depth, projects; ASE track is developer-focused" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, Accenture values; salary disclosure; no mandatory bond" },
    ]} />
  ),

  "accenture-interview-questions-india-2026||Compensation and Growth at Accenture India": (
    <SalaryLadder maxLPA={15} rows={[
      { role: "ASE – Associate Software Engineer (Fresher)", min: 4.5, max: 7, note: "Developer track; higher than standard" },
      { role: "SE – Software Engineer (Standard)", min: 3.5, max: 4.5, note: "Most campus hires entering standard track" },
      { role: "Experienced (2–4 yrs)", min: 7, max: 12, note: "Lateral; SAP, Salesforce, Workday skills premium" },
      { role: "Tech Lead / Manager (5+ yrs)", min: 10, max: 15, note: "Cloud and digital transformation skills" },
    ]} caption="Accenture India 2026; Bengaluru/Hyderabad/Pune/Chennai; gross CTC" />
  ),

  /* google-india-off-campus-how-to-crack: Google India off-campus process */
  "google-india-off-campus-how-to-crack||The Google India Interview Process": (
    <RoundFlow rounds={[
      { label: "Resume Screen", duration: "—", detail: "Off-campus: LinkedIn / careers.google.com referrals; strong OSS portfolio or contest wins help" },
      { label: "Recruiter Call", duration: "30 min", detail: "Background, experience, role fit; prepare a 2-minute intro and questions about the team" },
      { label: "Phone Screen", duration: "45 min", detail: "1 DSA problem (medium-hard); think aloud; discuss time/space complexity and optimisations" },
      { label: "Virtual Onsite – Coding ×2", duration: "45 min each", detail: "Two separate coding rounds; medium-hard LeetCode; clean, tested code expected" },
      { label: "Virtual Onsite – System Design", duration: "45 min", detail: "Design at Google scale (crawler, YouTube, Maps); estimation, sharding, replication, trade-offs" },
      { label: "Googleyness Round", duration: "45 min", detail: "Culture and leadership questions; STAR format; Google values: ambiguity, collaboration, impact" },
    ]} />
  ),

  "google-india-off-campus-how-to-crack||DSA Preparation for Google India": (
    <PrepTimeline caption="16-week plan for Google India off-campus readiness" phases={[
      { period: "Week 1–4", label: "Core Patterns", tasks: ["Arrays, strings, hashmaps", "Two pointers, sliding window", "Binary search variants", "Linked lists and stacks"], milestone: "75 LeetCode Easy/Medium solved" },
      { period: "Week 5–8", label: "Trees and Graphs", tasks: ["DFS/BFS on trees", "Graph traversal and cycle detection", "Topological sort, Dijkstra"], milestone: "50 Medium graph/tree problems" },
      { period: "Week 9–12", label: "DP and Advanced", tasks: ["1D and 2D dynamic programming", "Backtracking and recursion", "Monotonic stack, heap problems"], milestone: "40 Medium-Hard DP problems" },
      { period: "Week 13–16", label: "Mock + System Design", tasks: ["Weekly LeetCode contests", "4 full mock interviews", "System design (Grokking the System Design)"], milestone: "Interview-ready with full mock score" },
    ]} />
  ),

  /* infosys-infytq-preparation-guide-2026: Infosys InfyTQ guide */
  "infosys-infytq-preparation-guide-2026||SE vs SP: Two Very Different Tracks": (
    <TierCompare cards={[
      {
        tier: "SE – Systems Engineer",
        examples: "Standard campus track",
        rows: [
          { label: "CTC", range: "₹3.6–4.5 LPA" },
          { label: "Coding Difficulty", range: "Easy–Medium" },
          { label: "InfyTQ Required", range: "Yes (Score 60%+)" },
          { label: "Training", range: "4–6 months Lex + Mysuru" },
        ],
      },
      {
        tier: "SP – Specialist Programmer",
        examples: "High scorers / referrals",
        rows: [
          { label: "CTC", range: "₹6.5–9 LPA" },
          { label: "Coding Difficulty", range: "Hard (2 Medium-Hard problems)" },
          { label: "InfyTQ Required", range: "Yes (Score 80%+ + separate test)" },
          { label: "Training", range: "Shorter; specialised project allocation" },
        ],
      },
    ]} />
  ),

  "infosys-infytq-preparation-guide-2026||SP (Specialist Programmer) Selection Process": (
    <RoundFlow rounds={[
      { label: "InfyTQ Certification", duration: "Variable", detail: "Complete InfyTQ courses + pass quizzes; score 80%+ needed for SP track eligibility" },
      { label: "SP Online Assessment", duration: "90 min", detail: "2 hard coding problems (LeetCode Medium-Hard); strict time limit; Java or Python recommended" },
      { label: "SP Technical Interview", duration: "60 min", detail: "DSA depth, system design basics, CS fundamentals; live coding may be asked on harder problems" },
      { label: "HR Interview", duration: "20 min", detail: "Background, SP programme motivation, career goals; SP track typically placed in product-facing teams" },
    ]} />
  ),

  /* microsoft-india-interview-guide-2026: Microsoft India interview guide */
  "microsoft-india-interview-guide-2026||Microsoft SDE Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "2–3 DSA problems (medium difficulty); sometimes includes a debugging problem" },
      { label: "Technical Screen", duration: "45 min", detail: "DSA problem (medium) + OOP discussion; code quality and communication evaluated" },
      { label: "Virtual Onsite – DSA", duration: "60 min", detail: "Medium-hard DSA; Microsoft expects optimal solutions with clean code and edge case handling" },
      { label: "Virtual Onsite – OO Design", duration: "60 min", detail: "Object-oriented design problem; parking lot, elevator, or e-commerce cart commonly asked" },
      { label: "Growth Mindset / Culture Round", duration: "45 min", detail: "Microsoft's 'As Delivered' culture; questions on failure, learning, feedback, and collaboration" },
    ]} />
  ),

  "microsoft-india-interview-guide-2026||System Design for Microsoft India": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "SDE-1 / L59 (0–2 yrs)", min: 26, max: 42, note: "Base + bonus + RSUs; Hyderabad IDC / Bengaluru" },
      { role: "SDE-2 / L61 (2–5 yrs)", min: 40, max: 65, note: "RSU grants increase significantly; PRISM bonus" },
      { role: "Senior SDE / L63 (5+ yrs)", min: 60, max: 100, note: "Performance-based RSU refresh every 2 years" },
    ]} caption="Microsoft India 2026; Hyderabad IDC; total compensation including RSUs (4yr vest)" />
  ),

  /* ltimindtree-interview-questions-2026: LTIMindtree interview */
  "ltimindtree-interview-questions-2026||Online Assessment": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "Aptitude + Verbal + Logical + Coding (2 medium problems); harder than TCS/Infosys OA" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS), one language in depth, project walkthrough; some system design" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, LTIMindtree merger context; no mandatory bond" },
    ]} />
  ),

  "ltimindtree-interview-questions-2026||Compensation and Growth": (
    <SalaryLadder maxLPA={16} rows={[
      { role: "Fresher – Engineer (Campus)", min: 5, max: 7.5, note: "Higher than TCS/Infosys; post-merger packages" },
      { role: "Experienced (2–4 yrs)", min: 8, max: 13, note: "Lateral hires; SAP, Salesforce, cloud premium" },
      { role: "Lead / Senior Engineer (5+ yrs)", min: 11, max: 16, note: "BSE-listed company; stable growth path" },
    ]} caption="LTIMindtree India 2026; Mumbai/Pune/Bengaluru; gross CTC (BSE-listed)" />
  ),

  /* adobe-india-interview-guide-2026: Adobe India interview */
  "adobe-india-interview-guide-2026||Interview Process at Adobe India": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems (medium-hard); Adobe sets a high bar comparable to Google/Microsoft" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA problem + CS fundamentals; clean code, optimal solutions, time/space complexity required" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design or low-level design (OOP design); design a PDF renderer, photo editor, or analytics" },
      { label: "Hiring Manager / Culture", duration: "45 min", detail: "Adobe values: genuine, exceptional, innovative; product thinking for creative and document tools" },
    ]} />
  ),

  "adobe-india-interview-guide-2026||Compensation at Adobe India": (
    <SalaryLadder maxLPA={75} rows={[
      { role: "MTS-1 / SDE-1 (0–2 yrs)", min: 22, max: 35, note: "Noida/Bengaluru base; NASDAQ RSUs (ADBE)" },
      { role: "MTS-2 / SDE-2 (2–5 yrs)", min: 35, max: 55, note: "Significant RSU component at MTS-2 level" },
      { role: "Senior MTS / Staff (5–8 yrs)", min: 50, max: 75, note: "Adobe pays top-quartile in India market" },
    ]} caption="Adobe India 2026; Noida + Bengaluru; total compensation including NASDAQ RSUs (4yr vest)" />
  ),

  /* tcs-nqt-preparation-guide-2026: TCS NQT newer guide */
  "tcs-nqt-preparation-guide-2026||TCS NQT exam structure 2026": (
    <ComparisonTable
      columns={[{ name: "Section" }, { name: "Questions" }, { name: "Time (min)" }, { name: "Key Topics", highlight: true }]}
      rows={[
        { label: "Verbal Ability", values: ["24", "30", "RC passages, grammar, vocabulary"] },
        { label: "Reasoning Ability", values: ["30", "50", "Syllogisms, arrangements, series"] },
        { label: "Numerical Ability", values: ["26", "40", "Ratios, percentages, number series"] },
        { label: "Programming Logic", values: ["10", "15", "Pseudo-code, output prediction"] },
        { label: "Coding Round", values: ["2", "30", "Arrays, strings, basic DP"] },
        { label: "Advanced Coding (Optional)", values: ["1", "20", "Graphs, DP (Prime/Ninja only)"] },
      ]}
      caption="TCS NQT 2026; total ~165 min; higher tracks (Digital/Prime) require higher sectional cutoffs"
    />
  ),

  "tcs-nqt-preparation-guide-2026||TCS NQT tracks and packages": (
    <TierCompare cards={[
      {
        tier: "Ninja Track",
        examples: "Standard campus package",
        rows: [
          { label: "CTC", range: "₹3.36 LPA" },
          { label: "NQT Score", range: "Meets basic cutoff" },
          { label: "Coding", range: "Easy problems" },
          { label: "Profile", range: "Application dev, testing" },
        ],
      },
      {
        tier: "Digital Track",
        examples: "Higher-scoring candidates",
        rows: [
          { label: "CTC", range: "₹7–9 LPA" },
          { label: "NQT Score", range: "Higher cutoff + advanced coding" },
          { label: "Coding", range: "Medium-Hard problems" },
          { label: "Profile", range: "Cloud, analytics, AI/ML projects" },
        ],
      },
    ]} />
  ),

  /* flipkart-interview-questions-2026: Flipkart newer interview guide */
  "flipkart-interview-questions-2026||Flipkart interview process overview": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "2–3 DSA problems (medium-hard); HackerRank; Flipkart bar is comparable to Amazon" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + product domain questions; e-commerce scenarios (search ranking, pricing, catalog)" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design: design seller onboarding, delivery routing, or real-time inventory at scale" },
      { label: "Hiring Manager", duration: "45 min", detail: "Culture, ownership, speed; STAR behavioral questions with Flipkart-specific value framing" },
    ]} />
  ),

  "flipkart-interview-questions-2026||Flipkart SDE compensation 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 22, max: 35, note: "Bengaluru base; Walmart-backed ESOPs" },
      { role: "SDE-2 (2–5 yrs)", min: 35, max: 55, note: "ESOP value linked to Walmart backing" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 50, max: 70, note: "Walmart acquisition adds stability and upside" },
    ]} caption="Flipkart India 2026; Bengaluru HQ; total compensation including ESOPs" />
  ),

  /* razorpay-interview-questions-2026: Razorpay interview */
  "razorpay-interview-questions-2026||Razorpay interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems (medium-hard); payments domain context sometimes embedded in problems" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + backend fundamentals; Razorpay evaluates system thinking for financial systems" },
      { label: "System Design", duration: "60 min", detail: "Design a payment gateway, payout system, fraud detection, or reconciliation engine" },
      { label: "Culture / Hiring Manager", duration: "45 min", detail: "Razorpay values hustle, ownership, and frugality; questions on working under ambiguity at scale" },
    ]} />
  ),

  "razorpay-interview-questions-2026||Razorpay compensation 2026": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 32, note: "Bengaluru base; ESOPs at $7.5B valuation" },
      { role: "SDE-2 (2–5 yrs)", min: 32, max: 50, note: "Strong ESOP component; fintech premium" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 45, max: 60, note: "Pre-IPO upside; B2B fintech domain expertise" },
    ]} caption="Razorpay India 2026; Bengaluru HQ; pre-IPO ESOPs at $7.5B valuation" />
  ),

  /* zomato-interview-questions-india-2026: Zomato interview */
  "zomato-interview-questions-india-2026||Zomato interview process 2026": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "DSA problems (medium-hard); food delivery domain framing common; Zomato bar is competitive" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + backend fundamentals; geospatial algorithms, ETA models, restaurant search at scale" },
      { label: "System Design", duration: "60 min", detail: "Design a food delivery dispatch system, real-time restaurant feed, or order tracking pipeline" },
      { label: "Culture / Hiring Manager", duration: "45 min", detail: "Zomato culture: customer first, frugality, data-driven; questions on impact and ownership" },
    ]} />
  ),

  "zomato-interview-questions-india-2026||Zomato system design questions": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 30, note: "Gurugram/Bengaluru base; BSE-listed ESOPs" },
      { role: "SDE-2 (2–5 yrs)", min: 30, max: 48, note: "Public stock (NSE/BSE: ZOMATO); listed upside" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 42, max: 60, note: "Food-tech domain expertise valued; Blinkit synergy" },
    ]} caption="Zomato India 2026; Gurugram HQ; listed stock on NSE/BSE included in TC" />
  ),

  /* phonepe-interview-questions-2026: PhonePe shorter guide */
  "phonepe-interview-questions-2026||PhonePe interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems (medium-hard); UPI and fintech domain framing common" },
      { label: "Coding Interview", duration: "60 min", detail: "Live DSA with focus on correctness and optimization; payments domain problems possible" },
      { label: "System Design", duration: "60 min", detail: "Design a UPI payment system, money transfer engine, or fraud detection pipeline" },
      { label: "Hiring Manager / Culture", duration: "45 min", detail: "PhonePe values ownership and builder mindset; STAR behavioral questions" },
    ]} />
  ),

  "phonepe-interview-questions-2026||PhonePe compensation 2026": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 32, note: "Bengaluru base; ESOPs at Walmart-backed valuation" },
      { role: "SDE-2 (2–5 yrs)", min: 32, max: 50, note: "ESOP package at pre-IPO valuation; strong upside" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 45, max: 65, note: "Walmart ownership adds credibility and stability" },
    ]} caption="PhonePe India 2026; Bengaluru; ESOPs at Walmart-backed pre-IPO valuation" />
  ),

  /* cred-interview-questions-2026: CRED shorter guide */
  "cred-interview-questions-2026||CRED interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "Hard-level DSA; CRED sets one of the highest bars in Indian product companies" },
      { label: "Technical Interview 1", duration: "75 min", detail: "DSA + system design basics; code quality and clarity are evaluated very strictly" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design for credit infrastructure, fraud detection, or high-concurrency payment flows" },
      { label: "Culture / Founder Round", duration: "45 min", detail: "CRED values: high-trust, high-taste; questions on craftsmanship, ownership, and discernment" },
    ]} />
  ),

  "cred-interview-questions-2026||CRED compensation 2026": (
    <SalaryLadder maxLPA={75} rows={[
      { role: "SDE-1 (0–3 yrs)", min: 25, max: 40, note: "Bengaluru base; pre-IPO ESOPs at Series-F" },
      { role: "SDE-2 (3–6 yrs)", min: 38, max: 58, note: "Significant ESOP grants; CRED values retention" },
      { role: "SDE-3 / Senior (6+ yrs)", min: 50, max: 75, note: "Top-decile in India market; very selective hiring" },
    ]} caption="CRED India 2026; Bengaluru; pre-IPO ESOPs; highly selective — low offer volume" />
  ),

  /* meesho-interview-questions-2026: Meesho shorter guide */
  "meesho-interview-questions-2026||Meesho interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "2–3 DSA problems (medium-hard); Meesho's bar is comparable to Flipkart" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + backend fundamentals; social commerce scenarios (seller onboarding, catalog, logistics)" },
      { label: "System Design", duration: "60 min", detail: "Design a product feed for Tier-2 India, order routing, or supplier dashboard at scale" },
      { label: "Hiring Manager", duration: "45 min", detail: "Meesho values frugality and impact at scale; questions on doing more with less resources" },
    ]} />
  ),

  "meesho-interview-questions-2026||Meesho compensation 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Bengaluru base; pre-IPO ESOPs" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 42, note: "ESOP grants at Series-F valuation" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 38, max: 50, note: "Social commerce domain expertise valued" },
    ]} caption="Meesho India 2026; Bengaluru; pre-IPO ESOPs; Series-F valuation context" />
  ),

  /* freshworks-interview-questions-2026: Freshworks shorter guide */
  "freshworks-interview-questions-2026||Freshworks interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "90 min", detail: "2–3 DSA problems on HackerRank; CS fundamentals MCQs; medium difficulty" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA problem-solving + project discussion; SaaS product thinking sometimes tested" },
      { label: "System Design", duration: "60 min", detail: "Multi-tenant SaaS design: rate limiting, webhooks, tenant isolation, API gateway patterns" },
      { label: "Hiring Manager", duration: "45 min", detail: "Freshworks culture: ownership, frugality, customer obsession; STAR behavioral questions" },
    ]} />
  ),

  "freshworks-interview-questions-2026||Freshworks compensation 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22, note: "Chennai/Bengaluru base; NASDAQ RSUs (FRSH)" },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 38, note: "Public RSUs add significant upside at SDE-2+" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 35, max: 55, note: "NASDAQ-listed; RSU component grows with level" },
    ]} caption="Freshworks India 2026; Chennai + Bengaluru; total compensation including NASDAQ RSUs" />
  ),

  /* zerodha-interview-questions-india-2026: Zerodha interview */
  "zerodha-interview-questions-india-2026||Zerodha's unique hiring approach": (
    <FrameworkSteps steps={[
      { number: "01", label: "No Standard OA", hint: "Zerodha does not use HackerRank or AMCAT; expect a coding assignment or GitHub portfolio review" },
      { number: "02", label: "Take-Home Assignment", hint: "Build a small functional feature (API, CLI tool, or frontend widget); emphasises real code over LeetCode" },
      { number: "03", label: "Technical Discussion", hint: "Walk through your take-home assignment; discuss trade-offs, scalability, and tech decisions you made" },
      { number: "04", label: "Culture Interview", hint: "Zerodha values radical transparency and self-motivation; questions on why you trade or use Kite" },
      { number: "05", label: "Founder / Team Lead Round", hint: "Small team culture; expect to talk directly with a senior engineer or Nithin Kamath's team" },
    ]} />
  ),

  "zerodha-interview-questions-india-2026||Zerodha compensation 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Software Engineer (0–2 yrs)", min: 15, max: 25, note: "Bengaluru; no ESOPs but profit-sharing culture" },
      { role: "Senior Engineer (2–5 yrs)", min: 25, max: 40, note: "Zerodha shares profits; culture of ownership" },
      { role: "Lead / Principal (5+ yrs)", min: 35, max: 50, note: "Highly selective; very low attrition once hired" },
    ]} caption="Zerodha India 2026; Bengaluru; private bootstrapped company; profit-sharing model" />
  ),

  /* paytm-interview-questions-2026: Paytm shorter guide */
  "paytm-interview-questions-2026||Paytm interview process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "DSA problems (easy-medium); SQL and system design MCQs for some roles" },
      { label: "Technical Interview 1", duration: "60 min", detail: "DSA + CS fundamentals; fintech scenarios (payment gateway, wallet, QR code systems)" },
      { label: "Technical Interview 2", duration: "60 min", detail: "System design for high-volume payment flows, UPI integration, or merchant onboarding" },
      { label: "HR / Culture", duration: "30 min", detail: "Questions on adaptability post-restructuring; Paytm values resilience and customer focus" },
    ]} />
  ),

  "paytm-interview-questions-2026||Paytm compensation 2026": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 12, max: 20, note: "Noida/Bengaluru base; listed ESOPs post-restructuring" },
      { role: "SDE-2 (2–5 yrs)", min: 20, max: 35, note: "NSE-listed (PAYTM); public stock component" },
      { role: "SDE-3 / Senior (5+ yrs)", min: 30, max: 45, note: "Fintech domain expertise valued; stable post-RBI" },
    ]} caption="Paytm India 2026; Noida HQ; NSE-listed stock (PAYTM); post-restructuring context" />
  ),

  /* zoho-interview-questions-2026: Zoho interview */
  "zoho-interview-questions-2026||Zoho interview process": (
    <RoundFlow rounds={[
      { label: "Written Test", duration: "120 min", detail: "Aptitude + Programming logic; paper-based or online; focus on problem-solving, not frameworks" },
      { label: "Coding Interview", duration: "60 min", detail: "Write actual working code on a computer; Zoho values clean, readable, efficient logic" },
      { label: "Technical Discussion", duration: "60 min", detail: "Deep dive on CS fundamentals, past projects, and product knowledge of Zoho's suite" },
      { label: "HR / Culture Round", duration: "30 min", detail: "Zoho values long-term commitment and self-sufficiency; family-like work culture discussed" },
    ]} />
  ),

  "zoho-interview-questions-2026||Zoho compensation 2026": (
    <SalaryLadder maxLPA={20} rows={[
      { role: "Member Technical Staff (Fresher)", min: 4, max: 7, note: "Chennai base; no ESOPs (private company)" },
      { role: "Senior Technical Staff (2–5 yrs)", min: 8, max: 14, note: "Salary grows with tenure; very low attrition" },
      { role: "Technical Lead (5+ yrs)", min: 12, max: 20, note: "Bootstrapped; stable; ESOP equivalent via profit share" },
    ]} caption="Zoho India 2026; Chennai HQ; bootstrapped private company; no ESOPs but profit culture" />
  ),

  /* how-to-crack-wipro-interview-2026: Wipro cracking guide */
  "how-to-crack-wipro-interview-2026||Wipro NLTH process for freshers": (
    <RoundFlow rounds={[
      { label: "WNTH Online Assessment", duration: "120 min", detail: "Aptitude + Verbal + Reasoning + Essay + 2 Coding problems; Elite NLTH has harder coding section" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS, Networking), one language in depth, project walkthrough" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, Wipro Spirit values; salary band confirmed; bond of 1 year" },
    ]} />
  ),

  "how-to-crack-wipro-interview-2026||Wipro compensation 2026": (
    <SalaryLadder maxLPA={12} rows={[
      { role: "Fresher – Elite NLTH (Turbo)", min: 6.5, max: 10, note: "Top-scoring candidates; cloud/analytics projects" },
      { role: "Fresher – NLTH (Standard)", min: 3.5, max: 5, note: "Most campus hires; 1-year bond" },
      { role: "Experienced (2–4 yrs)", min: 6, max: 12, note: "Lateral hires; SAP, Salesforce, cloud attract premium" },
    ]} caption="Wipro India 2026; Bengaluru/Hyderabad/Pune; gross CTC; 1-year bond for freshers" />
  ),

  /* how-to-crack-infosys-interview-2026: Infosys cracking guide */
  "how-to-crack-infosys-interview-2026||Infosys interview process by track": (
    <RoundFlow rounds={[
      { label: "InfyTQ / HackWithInfy", duration: "95 min", detail: "Online test: Aptitude + Verbal + Reasoning + 2 Coding problems; SP track needs harder coding" },
      { label: "Technical Interview", duration: "45 min", detail: "CS fundamentals (OOP, DBMS, OS, DSA); Java or Python in depth; project walkthrough required" },
      { label: "HR Interview", duration: "20 min", detail: "Relocation, career goals, salary expectations; Infosys SE track has no bond requirement" },
    ]} />
  ),

  "how-to-crack-infosys-interview-2026||Infosys compensation 2026": (
    <SalaryLadder maxLPA={16} rows={[
      { role: "SP – Specialist Programmer", min: 6.5, max: 9, note: "Top track; strong InfyTQ + separate SP test" },
      { role: "SE – Systems Engineer (Standard)", min: 3.6, max: 4.5, note: "Most campus hires; variable pay included" },
      { role: "Experienced (3–5 yrs)", min: 7, max: 13, note: "Lateral; cloud and digital transformation premium" },
      { role: "Senior Consultant (6+ yrs)", min: 11, max: 16, note: "Digital / cloud specialization" },
    ]} caption="Infosys India 2026; Bengaluru/Pune/Hyderabad/Mysuru; gross CTC" />
  ),

  /* ── Company Guides B ── */
  /* accenture-interview-questions-2026: Interview process and compensation */
  "accenture-interview-questions-2026||Accenture hiring tracks and the interview process": (
    <RoundFlow rounds={[
      { label: "Cognitive & Technical Assessment", duration: "90 min", detail: "Verbal, quant, logical reasoning + 15 coding MCQs" },
      { label: "Communication Assessment", duration: "30 min", detail: "Versant spoken English test — hidden eliminator" },
      { label: "Technical Interview", duration: "45 min", detail: "OOP, DBMS, OS, one DSA question (ASE track only)" },
      { label: "HR Round", duration: "20 min", detail: "Motivation, relocation, joining timeline" },
    ]} />
  ),
  "accenture-interview-questions-2026||Accenture compensation 2026": (
    <SalaryLadder maxLPA={22} rows={[
      { role: "Associate Software Engineer (ASE)", min: 4.5, max: 5.5, note: "Standard track" },
      { role: "Software Engineer (SE — packaged campus)", min: 6.5, max: 9, note: "Merit/referral track" },
      { role: "SE with 2–3 yrs exp (lateral)", min: 9, max: 14 },
      { role: "SSE / Tech Lead (5+ yrs)", min: 14, max: 22 },
    ]} caption="Accenture India CTC 2026 — variable component ~15% of fixed" />
  ),

  /* cognizant-interview-questions-2026: Hiring tracks and compensation */
  "cognizant-interview-questions-2026||Cognizant hiring tracks": (
    <RoundFlow rounds={[
      { label: "GenC Online Assessment", duration: "90 min", detail: "Reasoning, English, quant + coding section" },
      { label: "GenC Elevate Coding Round", duration: "60 min", detail: "2 DSA problems, Medium difficulty" },
      { label: "Technical Interview", duration: "45 min", detail: "OOP, SQL, project discussion, one DSA trace" },
      { label: "HR Round", duration: "20 min", detail: "Bond clarification, relocation, motivation" },
    ]} />
  ),
  "cognizant-interview-questions-2026||Cognizant compensation and career": (
    <SalaryLadder maxLPA={18} rows={[
      { role: "GenC (Programmer Analyst Trainee)", min: 3.5, max: 4.5, note: "Standard fresher track" },
      { role: "GenC Elevate (Programmer Analyst)", min: 5.5, max: 7, note: "Elevated campus track" },
      { role: "Programmer Analyst (2–3 yrs)", min: 7, max: 11 },
      { role: "Senior Programmer Analyst (4–6 yrs)", min: 11, max: 18 },
    ]} caption="Cognizant India CTC 2026 — annual appraisal cycles in March" />
  ),

  /* wipro-interview-questions-2026: Tracks and compensation */
  "wipro-interview-questions-2026||Wipro Hiring Tracks: NTH vs Elite": (
    <RoundFlow rounds={[
      { label: "Online Assessment (NLTH/Elite)", duration: "90 min", detail: "Aptitude + reasoning + coding (1–2 problems)" },
      { label: "Essay Writing", duration: "20 min", detail: "200–300 words on a given topic; grammar and coherence scored" },
      { label: "Technical Interview", duration: "40 min", detail: "Core CS, OOP, DBMS, your resume project" },
      { label: "HR Round", duration: "20 min", detail: "Relocation, NTH bond, motivation" },
    ]} />
  ),
  "wipro-interview-questions-2026||Wipro vs TCS vs Infosys: Choosing Between Service IT Offers": (
    <ComparisonTable
      columns={[{ name: "Factor" }, { name: "Wipro" }, { name: "TCS" }, { name: "Infosys" }]}
      rows={[
        { label: "Fresher CTC", values: ["3.5–7 LPA", "3.5–9 LPA", "3.6–9.5 LPA"] },
        { label: "Bond Period", values: ["No bond (NTH)", "No bond", "No bond"] },
        { label: "Training Duration", values: ["3 months", "3–4 months", "3–4 months"] },
        { label: "Onsite Opportunity", values: ["Moderate", "High", "High"] },
        { label: "Bangalore Strength", values: ["Strong", "Moderate", "Strong"] },
      ]}
      caption="Service IT comparison for freshers India 2026 — NTH = National Talent Hunt"
    />
  ),

  /* hdfc-bank-interview-questions-2026: BFSI domain and process */
  "hdfc-bank-interview-questions-2026||Interview Process and Round Structure": (
    <RoundFlow rounds={[
      { label: "Aptitude + Domain Test", duration: "60 min", detail: "Quant, verbal, basic banking knowledge" },
      { label: "Technical Interview 1", duration: "45 min", detail: "Java/Spring Boot, SQL, core CS for tech roles" },
      { label: "Technical Interview 2 / Panel", duration: "40 min", detail: "BFSI domain, project discussion, scenario questions" },
      { label: "HR / Business Round", duration: "30 min", detail: "Culture fit, HDFC values, location preference" },
    ]} />
  ),
  "hdfc-bank-interview-questions-2026||Java and Spring Boot Questions at HDFC Bank": (
    <SalaryLadder maxLPA={22} rows={[
      { role: "Junior Software Engineer (0–2 yrs)", min: 6, max: 10, note: "BFSI entry, tech division" },
      { role: "Software Engineer (2–4 yrs)", min: 10, max: 16 },
      { role: "Senior Software Engineer (4–7 yrs)", min: 15, max: 22 },
      { role: "Technical Lead / Architect (7+ yrs)", min: 20, max: 35 },
    ]} caption="HDFC Bank Technology Division salary India 2026" />
  ),

  /* icici-bank-interview-questions-2026: Tech stack and process */
  "icici-bank-interview-questions-2026||ICICI Bank Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "Aptitude, logical reasoning, basic coding" },
      { label: "Technical Round 1", duration: "45 min", detail: "Java / Python, REST APIs, DBMS" },
      { label: "Domain / Technical Round 2", duration: "40 min", detail: "Banking APIs, UPI/NEFT/RTGS concepts, microservices" },
      { label: "HR Interview", duration: "25 min", detail: "Stability, relocation, joining timeline" },
    ]} />
  ),
  "icici-bank-interview-questions-2026||Behavioral Interviews and Career Growth at ICICI Bank": (
    <SalaryLadder maxLPA={24} rows={[
      { role: "Analyst / Junior Developer (0–2 yrs)", min: 5.5, max: 9, note: "iWork / iBegin tracks" },
      { role: "Developer (2–4 yrs)", min: 9, max: 15 },
      { role: "Senior Developer (4–7 yrs)", min: 14, max: 22 },
      { role: "Lead / Principal (7+ yrs)", min: 20, max: 35 },
    ]} caption="ICICI Bank Technology Group salary India 2026" />
  ),

  /* axis-bank-interview-questions-2026: Domain and process */
  "axis-bank-interview-questions-2026||Interview Process at Axis Bank": (
    <RoundFlow rounds={[
      { label: "Online Aptitude Test", duration: "50 min", detail: "Quant, reasoning, verbal; banking awareness for non-tech" },
      { label: "Technical Interview", duration: "45 min", detail: "Java/Spring, SQL, API design, core CS" },
      { label: "Domain / Managerial Round", duration: "35 min", detail: "BFSI domain, scenario-based, system thinking" },
      { label: "HR Round", duration: "20 min", detail: "Culture fit, Axis values, growth ambitions" },
    ]} />
  ),
  "axis-bank-interview-questions-2026||Axis Bank Behavioral Interviews and Career Paths": (
    <SalaryLadder maxLPA={20} rows={[
      { role: "Software Engineer (Fresher)", min: 5, max: 8 },
      { role: "Senior Software Engineer (2–5 yrs)", min: 8, max: 14 },
      { role: "Lead Engineer / Tech Lead (5–8 yrs)", min: 13, max: 20 },
      { role: "Principal / Architect (8+ yrs)", min: 18, max: 32 },
    ]} caption="Axis Bank Technology salary India 2026" />
  ),

  /* bajaj-finance-interview-questions-2026: Fintech NBFC process */
  "bajaj-finance-interview-questions-2026||Bajaj Finance Interview Structure": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "Aptitude + coding test (1–2 DSA problems)" },
      { label: "Technical Round 1", duration: "45 min", detail: "DSA, Java/Python, REST APIs, SQL" },
      { label: "Technical Round 2 / Design", duration: "40 min", detail: "System design, microservices, ML architecture (for data roles)" },
      { label: "HR / Leadership Round", duration: "25 min", detail: "NBFC domain knowledge, growth mindset, agility" },
    ]} />
  ),
  "bajaj-finance-interview-questions-2026||Machine Learning and Data Engineering at Bajaj Finance": (
    <SalaryLadder maxLPA={28} rows={[
      { role: "Software Engineer / Analyst (0–2 yrs)", min: 7, max: 12 },
      { role: "Senior Engineer (2–4 yrs)", min: 12, max: 18 },
      { role: "ML Engineer / Data Engineer (3–6 yrs)", min: 14, max: 22 },
      { role: "Lead / Principal Engineer (6+ yrs)", min: 20, max: 32 },
    ]} caption="Bajaj Finance Technology salary India 2026" />
  ),

  /* upstox-interview-questions-2026: Trading platform focus */
  "upstox-interview-questions-2026||Upstox Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "90 min", detail: "2–3 DSA problems; Medium–Hard, time complexity focus" },
      { label: "Technical Round 1 — DSA & CS", duration: "60 min", detail: "Graph/DP deep dive, OS, concurrency" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "System design: trade engine, order book, low-latency feeds" },
      { label: "Culture / Leadership Round", duration: "30 min", detail: "Ownership, zero-to-one work, trading domain awareness" },
    ]} />
  ),
  "upstox-interview-questions-2026||Real-Time Systems and Low-Latency Design": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28, note: "Fintech premium for systems depth" },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 40 },
      { role: "Senior / Staff SDE (5+ yrs)", min: 38, max: 55 },
      { role: "Engineering Manager (6+ yrs)", min: 45, max: 70 },
    ]} caption="Upstox salary India 2026 — ESOPs add meaningful upside pre-IPO" />
  ),

  /* meta-india-interview-questions-2026: FAANG process */
  "meta-india-interview-questions-2026||Meta India Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, motivation, timeline clarification" },
      { label: "Coding Screen (HackerRank / Live)", duration: "45 min", detail: "2 LeetCode-style problems, Medium difficulty" },
      { label: "Virtual Onsite — Coding ×2", duration: "45 min each", detail: "2 problems per round; arrays, graphs, DP heavily tested" },
      { label: "Virtual Onsite — System Design", duration: "60 min", detail: "Design at scale: social graph, news feed, ads delivery" },
      { label: "Jedi (Behavioral) Round", duration: "45 min", detail: "Meta values: Move Fast, Be Direct, Focus on Impact" },
    ]} />
  ),
  "meta-india-interview-questions-2026||Meta System Design at Scale": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "SWE E3 / SDE-1 (0–2 yrs)", min: 40, max: 60, note: "Base + RSU ~4yr vest" },
      { role: "SWE E4 / SDE-2 (2–5 yrs)", min: 60, max: 90 },
      { role: "SWE E5 / Senior (5–8 yrs)", min: 80, max: 120 },
      { role: "SWE E6 / Staff (8+ yrs)", min: 110, max: 180 },
    ]} caption="Meta India total compensation 2026 — includes base + RSU (3yr cliff)" />
  ),

  /* scaler-interview-questions-2026: EdTech product company */
  "scaler-interview-questions-2026||Scaler Interview Process and DSA Emphasis": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "90 min", detail: "3 DSA problems; Medium–Hard; Strong DSA bar" },
      { label: "Technical Round 1 — DSA + CS", duration: "60 min", detail: "Graph, DP, OS, concurrency deep dive" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "EdTech platform design: live classes, progress tracking" },
      { label: "Culture Fit / Mission Alignment", duration: "30 min", detail: "Teaching philosophy, product thinking, impact mindset" },
    ]} />
  ),
  "scaler-interview-questions-2026||Scaler's Culture and Mission Alignment": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 25 },
      { role: "SDE-2 (2–5 yrs)", min: 25, max: 38 },
      { role: "Senior SDE (5+ yrs)", min: 35, max: 52 },
      { role: "Engineering Manager (6+ yrs)", min: 45, max: 65 },
    ]} caption="Scaler Academy salary India 2026 — mission-driven culture, ESOPs offered" />
  ),

  /* vedantu-interview-questions-2026: Real-time video platform */
  "vedantu-interview-questions-2026||Vedantu Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding Assessment", duration: "75 min", detail: "2–3 DSA problems; Medium difficulty; real-time constraints" },
      { label: "Technical Round 1", duration: "60 min", detail: "DSA, real-time systems, WebRTC basics, backend APIs" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Design live tutoring platform, video streaming, whiteboard" },
      { label: "Founder / Culture Round", duration: "30 min", detail: "EdTech mission, product sense, working in ambiguity" },
    ]} />
  ),
  "vedantu-interview-questions-2026||Real-Time Video and Collaboration Engineering": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22 },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 35 },
      { role: "Senior SDE (5+ yrs)", min: 32, max: 48 },
      { role: "Engineering Lead (6+ yrs)", min: 42, max: 60 },
    ]} caption="Vedantu salary India 2026 — ESOPs available; post-layoff team is leaner" />
  ),

  /* optiver-interview-questions-india-2026: Quant trading firm */
  "optiver-india-interview-questions-2026||The Optiver Interview Process: What Makes It Different": (
    <RoundFlow rounds={[
      { label: "80 in 8 Mental Math Test", duration: "8 min", detail: "80 arithmetic questions; no calculator; speed and accuracy" },
      { label: "Numerical Reasoning Test", duration: "30 min", detail: "Probability, combinatorics, expected value" },
      { label: "Trading Simulation Game", duration: "30 min", detail: "Market making exercise; tests risk intuition" },
      { label: "Technical Coding Round", duration: "60 min", detail: "C++ or Python; algorithms, data structures, concurrency" },
      { label: "HR / Fit Interview", duration: "30 min", detail: "Teamwork, risk mindset, Optiver culture" },
    ]} />
  ),
  "optiver-india-interview-questions-2026||Mental Math and Probability Preparation": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Graduate Trader / Researcher", min: 25, max: 50, note: "Bonus can 3–5x base" },
      { role: "Software Developer (SDE-1 equiv)", min: 25, max: 45 },
      { role: "Senior Software Developer", min: 45, max: 80 },
      { role: "Quant Researcher (experienced)", min: 60, max: 120 },
    ]} caption="Optiver India compensation 2026 — year-end bonus is most significant component" />
  ),

  /* millennium-management-interview-india-2026: HF quant */
  "millennium-management-interview-india-2026||Millennium Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Quantitative Test", duration: "45 min", detail: "Probability, statistics, expected value, brain teasers" },
      { label: "C++ / Systems Coding Round", duration: "60 min", detail: "STL, memory management, concurrency, latency thinking" },
      { label: "Quant / Problem-Solving Interview", duration: "60 min", detail: "Mathematical puzzles, market microstructure, Bayesian reasoning" },
      { label: "Hiring Manager Interview", duration: "45 min", detail: "Domain depth, research mindset, pod structure fit" },
    ]} />
  ),
  "millennium-management-interview-india-2026||Technology Roles and C++ at Millennium": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Software Engineer (Entry)", min: 30, max: 55, note: "HFT premium" },
      { role: "Quant Researcher (Junior)", min: 35, max: 70 },
      { role: "Senior Software Engineer", min: 55, max: 100 },
      { role: "Senior Quant Researcher", min: 80, max: 160 },
    ]} caption="Millennium Management India 2026 — bonus comp dominates; base is conservative" />
  ),

  /* zepto-interview-questions-2026: Quick commerce */
  "zepto-interview-questions-2026||Zepto Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "90 min", detail: "2–3 DSA problems; graph, greedy, DP; Medium–Hard" },
      { label: "Technical Round 1 — DSA + CS", duration: "60 min", detail: "Algorithms, OS, concurrency, API design" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "Dark store routing, inventory management, real-time tracking" },
      { label: "Leadership / Culture Round", duration: "30 min", detail: "Ownership, speed, zero-to-one problem-solving" },
    ]} />
  ),
  "zepto-interview-questions-2026||Zepto Salary and Career": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 18, max: 28 },
      { role: "SDE-2 (2–5 yrs)", min: 28, max: 42 },
      { role: "Senior SDE (5+ yrs)", min: 38, max: 55 },
      { role: "Engineering Manager (6+ yrs)", min: 48, max: 70 },
    ]} caption="Zepto salary India 2026 — pre-IPO ESOPs available; hyper-growth environment" />
  ),

  /* blinkit-interview-questions-2026: Quick commerce / Zomato */
  "blinkit-interview-questions-2026||Blinkit Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "90 min", detail: "2–3 DSA problems; graphs, sorting, greedy" },
      { label: "Technical Round 1", duration: "60 min", detail: "DSA deep dive, backend design, database schema" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "10-minute delivery routing, dark store fulfillment systems" },
      { label: "Zomato Culture / Bar-Raiser Round", duration: "30 min", detail: "Ownership, hustle, cross-functional thinking" },
    ]} />
  ),
  "blinkit-interview-questions-2026||Blinkit Salary and Zomato RSUs": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 30, note: "Zomato RSUs included" },
      { role: "SDE-2 (2–5 yrs)", min: 30, max: 44 },
      { role: "Senior SDE (5+ yrs)", min: 40, max: 58 },
      { role: "Engineering Manager (6+ yrs)", min: 50, max: 75 },
    ]} caption="Blinkit salary India 2026 — RSUs are listed Zomato shares (4yr vest)" />
  ),

  /* browserstack-interview-questions-2026: Testing infra */
  "browserstack-interview-questions-2026||BrowserStack Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding Assessment", duration: "90 min", detail: "2–3 DSA + 1 systems-thinking problem; Java/Python/Go" },
      { label: "Technical Round 1 — DSA + OS", duration: "60 min", detail: "Algorithms, concurrency, browser internals" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Distributed testing infra, test-runner orchestration, real device cloud" },
      { label: "Culture / Leadership Round", duration: "30 min", detail: "Remote-first culture, product thinking, customer obsession" },
    ]} />
  ),
  "browserstack-interview-questions-2026||BrowserStack Salary and Career": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 30 },
      { role: "SDE-2 (2–5 yrs)", min: 30, max: 42 },
      { role: "Senior SDE (5+ yrs)", min: 38, max: 55 },
      { role: "Staff Engineer / EM (7+ yrs)", min: 50, max: 75 },
    ]} caption="BrowserStack salary India 2026 — remote-first, ESOPs in pre-IPO range" />
  ),

  /* physicswallah-interview-questions-2026: EdTech unicorn */
  "physicswallah-interview-questions-2026||PhysicsWallah Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "75 min", detail: "2–3 DSA problems; backend-heavy; Python/Java" },
      { label: "Technical Round 1", duration: "60 min", detail: "DSA, system efficiency, backend APIs" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Video streaming at scale, content delivery for low-bandwidth India" },
      { label: "Founder Culture Round", duration: "30 min", detail: "Frugal engineering, mission alignment, hustle" },
    ]} />
  ),
  "physicswallah-interview-questions-2026||PhysicsWallah Salary and Culture": (
    <SalaryLadder maxLPA={30} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 12, max: 20, note: "Below-FAANG but strong mission culture" },
      { role: "SDE-2 (2–5 yrs)", min: 18, max: 30 },
      { role: "Senior SDE (5+ yrs)", min: 28, max: 42 },
      { role: "Engineering Manager (6+ yrs)", min: 35, max: 55 },
    ]} caption="PhysicsWallah salary India 2026 — ESOPs partially offset lower cash comp" />
  ),

  /* sharechat-interview-questions-2026: Social media / ML */
  "sharechat-interview-questions-2026||ShareChat Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "90 min", detail: "2–3 DSA problems; graph, DP; focus on optimization" },
      { label: "Technical Round 1 — DSA + ML", duration: "60 min", detail: "Algorithms, ML system design basics, recommendation concepts" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "Feed ranking, content moderation at 200M+ users, Indic NLP infra" },
      { label: "Culture / Leadership Round", duration: "30 min", detail: "Building for Bharat, ownership, ambiguity tolerance" },
    ]} />
  ),
  "sharechat-interview-questions-2026||ShareChat Salary and Career": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 / MLE-1 (0–2 yrs)", min: 18, max: 28 },
      { role: "SDE-2 / MLE-2 (2–5 yrs)", min: 28, max: 40 },
      { role: "Senior SDE / Senior MLE (5+ yrs)", min: 38, max: 55 },
      { role: "Staff / EM (7+ yrs)", min: 50, max: 72 },
    ]} caption="ShareChat salary India 2026 — ESOPs available; ML engineers at premium" />
  ),

  /* nvidia-india-interview-questions-2026: Chip design / software */
  "nvidia-india-interview-questions-2026||Nvidia India Interview Process": (
    <RoundFlow rounds={[
      { label: "Phone / Technical Screen", duration: "60 min", detail: "Role-specific: CUDA concepts, driver stack, or deep learning infra" },
      { label: "Technical Interview 1 — Algorithms", duration: "60 min", detail: "C++ data structures, memory management, parallel programming" },
      { label: "Technical Interview 2 — Domain Depth", duration: "60 min", detail: "GPU architecture, CUDA optimization, or ML framework internals" },
      { label: "Technical Interview 3 — Design", duration: "60 min", detail: "System design; scalable ML training infra or driver architecture" },
      { label: "HR / Manager Round", duration: "30 min", detail: "Team fit, research mindset, long-term trajectory" },
    ]} />
  ),
  "nvidia-india-interview-questions-2026||Nvidia India Salary and Career": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Software Engineer (Entry)", min: 25, max: 40, note: "RSUs are core comp" },
      { role: "Senior Software Engineer (3–6 yrs)", min: 40, max: 65 },
      { role: "Staff Engineer / Tech Lead (6+ yrs)", min: 60, max: 95 },
      { role: "Principal Engineer / Manager (8+ yrs)", min: 80, max: 140 },
    ]} caption="Nvidia India total compensation 2026 — RSUs on 4yr vest; significant upside" />
  ),

  /* qualcomm-india-interview-questions-2026 (first occurrence, index 71) */
  "qualcomm-india-interview-questions-2026||Qualcomm India Interview Process": (
    <RoundFlow rounds={[
      { label: "Coding / Aptitude Screen", duration: "60 min", detail: "C++ MCQs, pointers, OS concepts, embedded systems basics" },
      { label: "Technical Round 1 — C++ and OS", duration: "60 min", detail: "Memory management, multithreading, process synchronisation" },
      { label: "Technical Round 2 — Embedded / Modem", duration: "60 min", detail: "RTOS, driver development, protocol stack (5G/LTE)" },
      { label: "Design Round", duration: "60 min", detail: "System design: modem firmware architecture or baseband stack" },
      { label: "HR Round", duration: "20 min", detail: "Team fit, Qualcomm values, long-term goals" },
    ]} />
  ),
  "qualcomm-india-interview-questions-2026||Qualcomm India Salary and Career": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Engineer (0–2 yrs)", min: 18, max: 28, note: "Embedded and firmware roles" },
      { role: "Senior Engineer (2–5 yrs)", min: 28, max: 42 },
      { role: "Staff Engineer (5–8 yrs)", min: 40, max: 60 },
      { role: "Principal Engineer (8+ yrs)", min: 55, max: 90 },
    ]} caption="Qualcomm India salary 2026 — RSUs vest over 3yr; Hyderabad + Bangalore offices" />
  ),

  /* apple-india-interview-questions-2026: GCC/MNC */
  "apple-india-interview-questions-2026||Apple India Interview Process": (
    <RoundFlow rounds={[
      { label: "Phone Screen with Recruiter", duration: "30 min", detail: "Background, role alignment, timeline" },
      { label: "Technical Phone Screen", duration: "60 min", detail: "DSA, iOS/macOS internals or backend systems depending on role" },
      { label: "Virtual Onsite — Coding ×2", duration: "60 min each", detail: "Swift/C++ depth, algorithms, platform-specific optimisations" },
      { label: "Virtual Onsite — Domain Round", duration: "60 min", detail: "Core Audio / Security / ML / GPU frameworks based on team" },
      { label: "Behavioral / Hiring Manager", duration: "45 min", detail: "Apple values: quality, privacy by design, cross-team influence" },
    ]} />
  ),
  "apple-india-interview-questions-2026||Apple India Salary and Benefits": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "SWE ICT2 / Entry (0–2 yrs)", min: 30, max: 50, note: "RSUs on 4yr vest" },
      { role: "SWE ICT3 / Senior (3–6 yrs)", min: 50, max: 80 },
      { role: "SWE ICT4 / Staff (6–9 yrs)", min: 75, max: 120 },
      { role: "SWE ICT5+ / Principal (9+ yrs)", min: 110, max: 170 },
    ]} caption="Apple India GCC total compensation 2026 — stock is core; bonus ~10% base" />
  ),

  /* netflix-india-interview-questions-2026: Streaming giant */
  "netflix-india-interview-questions-2026||Netflix India Interview Process": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, role alignment, compensation conversation upfront" },
      { label: "Technical Phone Screen", duration: "60 min", detail: "DSA (Medium–Hard), streaming infra or backend systems" },
      { label: "Virtual Onsite — Coding ×2", duration: "60 min each", detail: "Hard-level problems, time complexity focus" },
      { label: "Virtual Onsite — System Design", duration: "60 min", detail: "Content delivery, encoding pipeline, recommendation infra at scale" },
      { label: "Culture (Netflix Memo) Round", duration: "45 min", detail: "Radical candor, high performance bar, context not control" },
    ]} />
  ),
  "netflix-india-interview-questions-2026||Netflix India Salary and Compensation Philosophy": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "Software Engineer L4 (2–4 yrs)", min: 50, max: 80, note: "All cash — no RSUs" },
      { role: "Senior Software Engineer L5 (4–7 yrs)", min: 75, max: 120 },
      { role: "Staff Engineer L6 (7+ yrs)", min: 110, max: 180 },
      { role: "Principal Engineer L7 (10+ yrs)", min: 160, max: 250 },
    ]} caption="Netflix India 2026 — all salary, no equity; top-of-market cash philosophy" />
  ),

  /* barclays-india-interview-questions-2026: Capital markets tech */
  "barclays-india-interview-questions-2026||Barclays India Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "Aptitude, Java/C++ MCQs, DSA coding problem" },
      { label: "Technical Round 1 — Core CS", duration: "60 min", detail: "OOP, concurrency, database, algorithms" },
      { label: "Technical Round 2 — Domain", duration: "60 min", detail: "Capital markets: trade lifecycle, FX, fixed income basics" },
      { label: "HR / Values Round", duration: "30 min", detail: "Barclays values: respect, integrity, service, excellence" },
    ]} />
  ),
  "barclays-india-interview-questions-2026||Barclays India Salary and Career": (
    <SalaryLadder maxLPA={30} rows={[
      { role: "Analyst (0–2 yrs)", min: 8, max: 14, note: "Pune / Chennai GCC" },
      { role: "Associate (2–5 yrs)", min: 14, max: 22 },
      { role: "AVP (5–8 yrs)", min: 22, max: 35 },
      { role: "VP (8+ yrs)", min: 32, max: 55 },
    ]} caption="Barclays India GCC salary 2026 — bonus 10–30% of base; stable environment" />
  ),

  /* oyo-interview-questions-2026: Hospitality tech */
  "oyo-interview-questions-2026||OYO Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "90 min", detail: "2–3 DSA problems; graph, DP; backend-heavy" },
      { label: "Technical Round 1 — DSA", duration: "60 min", detail: "Algorithm depth, time complexity, backend patterns" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Hotel inventory management, dynamic pricing, booking engine" },
      { label: "Culture / Leadership Round", duration: "30 min", detail: "Ownership, operating in adversity, hospitality domain awareness" },
    ]} />
  ),
  "oyo-interview-questions-2026||OYO Salary and Career in 2026": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22 },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 35 },
      { role: "Senior SDE (5+ yrs)", min: 32, max: 48 },
      { role: "Engineering Manager (6+ yrs)", min: 42, max: 62 },
    ]} caption="OYO salary India 2026 — restructured company, stronger engineering culture post-2024" />
  ),

  /* myntra-interview-questions-2026: Fashion e-commerce */
  "myntra-interview-questions-2026||Myntra Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "90 min", detail: "2–3 DSA problems; arrays, graphs, DP" },
      { label: "Technical Round 1 — DSA", duration: "60 min", detail: "Algorithm depth, time/space complexity discussion" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Product recommendation engine, search ranking, supply chain" },
      { label: "Flipkart Bar-Raiser / Culture Round", duration: "45 min", detail: "Flipkart values, ownership, scale thinking" },
    ]} />
  ),
  "myntra-interview-questions-2026||Myntra Salary and Career Trajectory": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 20, max: 30, note: "Flipkart group RSUs" },
      { role: "SDE-2 (2–5 yrs)", min: 30, max: 44 },
      { role: "Senior SDE (5+ yrs)", min: 40, max: 58 },
      { role: "Engineering Manager (6+ yrs)", min: 50, max: 72 },
    ]} caption="Myntra salary India 2026 — Flipkart group pre-IPO RSUs add significant upside" />
  ),

  /* makemytrip-interview-questions-2026 (second post in Company Guides with this name) */
  "makemytrip-interview-questions-2026||MakeMyTrip Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Coding Assessment", duration: "90 min", detail: "2–3 DSA problems; graphs, hashing, greedy" },
      { label: "Technical Round 1 — DSA", duration: "60 min", detail: "Algorithm deep dive, backend API patterns" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "Flight/hotel search, GDS integration, dynamic pricing" },
      { label: "Culture / Leadership Round", duration: "30 min", detail: "Ownership, travel domain awareness, cross-team collaboration" },
    ]} />
  ),
  "makemytrip-interview-questions-2026||MakeMyTrip Salary and Career": (
    <SalaryLadder maxLPA={38} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 16, max: 26 },
      { role: "SDE-2 (2–5 yrs)", min: 26, max: 38 },
      { role: "Senior SDE (5+ yrs)", min: 35, max: 52 },
      { role: "Engineering Manager (6+ yrs)", min: 45, max: 65 },
    ]} caption="MakeMyTrip salary India 2026 — Gurugram HQ; travel sector rebound post-2024" />
  ),

  /* nykaa-interview-questions-2026 (second post) */
  "nykaa-interview-questions-2026||Nykaa Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "75 min", detail: "2 DSA problems; Medium difficulty; Python/Java" },
      { label: "Technical Round 1 — DSA + Backend", duration: "60 min", detail: "Algorithms, REST API design, database schema" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "E-commerce catalogue, beauty product recommendation, inventory" },
      { label: "Culture / PM Round", duration: "30 min", detail: "Product thinking, fashion tech domain, growth mindset" },
    ]} />
  ),
  "nykaa-interview-questions-2026||Nykaa Salary and Career": (
    <SalaryLadder maxLPA={32} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 14, max: 22, note: "Listed company RSUs" },
      { role: "SDE-2 (2–5 yrs)", min: 22, max: 32 },
      { role: "Senior SDE (5+ yrs)", min: 30, max: 45 },
      { role: "Engineering Manager (6+ yrs)", min: 40, max: 58 },
    ]} caption="Nykaa salary India 2026 — listed company; RSUs in NSE-traded stock" />
  ),

  /* bcg-india-interview-questions-2026: MBB consulting */
  "bcg-india-interview-questions-2026||BCG India Interview Format and Structure": (
    <RoundFlow rounds={[
      { label: "Pymetrics / Online Assessment", duration: "25 min", detail: "Cognitive and personality game-based test" },
      { label: "Case Interview Round 1", duration: "45 min", detail: "Market sizing or profitability case; interviewer-led" },
      { label: "Case Interview Round 2", duration: "45 min", detail: "Operations or strategy case; more candidate-led" },
      { label: "PEI + Case Final Round", duration: "50 min", detail: "Personal experience + complex multi-framework case" },
      { label: "Partner Interview", duration: "45 min", detail: "Values, leadership, long-term vision, fit" },
    ]} />
  ),
  "bcg-india-interview-questions-2026||BCG India Salary and Career": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Associate (MBA / Fresher)", min: 22, max: 30, note: "Plus performance bonus" },
      { role: "Consultant (2–4 yrs post-MBA)", min: 32, max: 50 },
      { role: "Project Leader (4–7 yrs)", min: 50, max: 80 },
      { role: "Principal (7+ yrs)", min: 80, max: 130 },
    ]} caption="BCG India total compensation 2026 — bonus 20–40% of base; travel-heavy role" />
  ),

  /* bain-india-interview-questions-2026: MBB consulting */
  "bain-india-interview-questions-2026||Bain India Interview Format: What to Expect": (
    <RoundFlow rounds={[
      { label: "First Round Case ×2", duration: "45 min each", detail: "Market entry or revenue decline cases; Bain uses interviewer-led format" },
      { label: "Written Case", duration: "60 min", detail: "Analyse a client deck; prepare recommendation and present" },
      { label: "Final Round Case + PEI ×2", duration: "50 min each", detail: "Strategy case + STAR-based personal experience + partner fit" },
    ]} />
  ),
  "bain-india-interview-questions-2026||Bain India Salary and Career Path": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Associate Consultant (Fresher)", min: 18, max: 26, note: "Non-MBA track" },
      { role: "Consultant (Post-MBA / 3+ yrs)", min: 28, max: 48 },
      { role: "Case Team Leader (5–8 yrs)", min: 50, max: 80 },
      { role: "Manager / Principal (8+ yrs)", min: 80, max: 140 },
    ]} caption="Bain India salary 2026 — performance bonus 20–50%; 2-yr MBA sponsorship possible" />
  ),

  /* de-shaw-india-interview-questions-2026: Quant hedge fund */
  "de-shaw-india-interview-questions-2026||D.E. Shaw India Interview Process": (
    <RoundFlow rounds={[
      { label: "Codevita / Online Assessment", duration: "90 min", detail: "Math, algorithms, and probability questions — VERY hard" },
      { label: "Technical Interview 1 — Algorithms", duration: "60 min", detail: "C++ depth, STL, competitive-level DSA" },
      { label: "Technical Interview 2 — Quant Math", duration: "60 min", detail: "Probability, statistics, combinatorics, expected value" },
      { label: "Technical Interview 3 — Systems", duration: "60 min", detail: "Low-latency systems, memory management, network protocols" },
      { label: "HR / Culture Round", duration: "30 min", detail: "Research mindset, intellectual curiosity, team fit" },
    ]} />
  ),
  "de-shaw-india-interview-questions-2026||D.E. Shaw India Salary and Compensation": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Software Developer (Entry)", min: 25, max: 45, note: "Bonus dominates" },
      { role: "Quant Researcher (Entry)", min: 30, max: 55 },
      { role: "Senior Software Developer", min: 50, max: 85 },
      { role: "Senior Quant Researcher", min: 75, max: 150 },
    ]} caption="D.E. Shaw India 2026 — year-end bonus multiples of 1–3x base are common" />
  ),

  /* citadel-india-interview-questions-2026: HFT */
  "citadel-india-interview-questions-2026||Citadel India Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "Hard algorithmic coding; C++ preferred" },
      { label: "Technical Round 1 — C++ and OS", duration: "60 min", detail: "Memory management, concurrency, cache behaviour" },
      { label: "Technical Round 2 — Quant Concepts", duration: "60 min", detail: "Probability, statistics, market intuition, brain teasers" },
      { label: "System Design Round", duration: "60 min", detail: "Ultra-low-latency trading systems, lock-free data structures" },
      { label: "HR / Culture Round", duration: "30 min", detail: "Intellectual rigor, performance mindset, team fit" },
    ]} />
  ),
  "citadel-india-interview-questions-2026||Citadel India Salary and Compensation": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Software Engineer (Entry)", min: 35, max: 60, note: "Cash heavy; year-end bonus" },
      { role: "Quant Researcher (Entry)", min: 40, max: 80 },
      { role: "Senior Software Engineer", min: 70, max: 120 },
      { role: "Quant Portfolio Researcher", min: 100, max: 250 },
    ]} caption="Citadel India 2026 — base + discretionary bonus; PnL-linked rewards at senior levels" />
  ),

  /* angel-one-interview-questions-2026: Indian fintech broking */
  "angel-one-interview-questions-2026||Angel One Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Coding Round", duration: "75 min", detail: "2 DSA problems; Medium difficulty; Python/Java" },
      { label: "Technical Round 1 — DSA + Backend", duration: "60 min", detail: "Algorithms, API design, SQL, trading domain basics" },
      { label: "Technical Round 2 — Design", duration: "60 min", detail: "Order matching engine, portfolio analytics, real-time market data" },
      { label: "Leadership / Culture Round", duration: "30 min", detail: "Ownership, fintech domain, customer-first thinking" },
    ]} />
  ),
  "angel-one-interview-questions-2026||Angel One Salary and Career": (
    <SalaryLadder maxLPA={28} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 12, max: 20, note: "Listed company RSUs" },
      { role: "SDE-2 (2–5 yrs)", min: 20, max: 30 },
      { role: "Senior SDE (5+ yrs)", min: 28, max: 42 },
      { role: "Tech Lead / Engineering Manager (6+ yrs)", min: 38, max: 58 },
    ]} caption="Angel One salary India 2026 — BSE/NSE-listed RSUs; strong fintech domain exposure" />
  ),

  /* atlassian-india-interview-questions-2026 (first occurrence, index 84) */
  "atlassian-india-interview-questions-2026||Atlassian India Interview Process 2026": (
    <RoundFlow rounds={[
      { label: "Karat Screen", duration: "60 min", detail: "2 DSA problems via Karat interviewer; Medium difficulty" },
      { label: "Technical Round — Coding", duration: "60 min", detail: "Data structures, system thinking, code quality emphasis" },
      { label: "System Design Round", duration: "60 min", detail: "Jira / Confluence-style product design, multi-tenant SaaS" },
      { label: "TEAM Values Round", duration: "45 min", detail: "Open company, no bull, play as a team, build balance" },
      { label: "Hiring Manager Round", duration: "30 min", detail: "Role alignment, team fit, long-term goals" },
    ]} />
  ),
  "atlassian-india-interview-questions-2026||Atlassian India Salary and TEAM Anywhere": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 25, max: 38, note: "RSUs on 4yr vest" },
      { role: "SDE-2 (2–5 yrs)", min: 38, max: 55 },
      { role: "Senior SDE (5+ yrs)", min: 52, max: 75 },
      { role: "Staff Engineer / EM (7+ yrs)", min: 70, max: 100 },
    ]} caption="Atlassian India salary 2026 — TEAM Anywhere = fully remote; RSUs in USD" />
  ),

  /* uber-india-interview-questions-2026 (first occurrence, index 85) */
  "uber-india-interview-questions-2026||Uber India's Interview Process: What to Expect": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, role fit, timeline" },
      { label: "Coding Screen", duration: "60 min", detail: "2 DSA problems; Medium–Hard; graphs and hashing common" },
      { label: "Technical Round — Coding ×2", duration: "60 min each", detail: "Algorithms, concurrency, platform-specific patterns" },
      { label: "Technical Round — System Design", duration: "60 min", detail: "Ride-matching, geospatial indexing, surge pricing system" },
      { label: "Behavioral / Culture Round", duration: "45 min", detail: "Uber's norms: customer obsession, bold bets, reliability" },
    ]} />
  ),
  "uber-india-interview-questions-2026||Uber India Salary and Culture": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 28, max: 42, note: "RSUs on 4yr vest" },
      { role: "SDE-2 (2–5 yrs)", min: 40, max: 60 },
      { role: "Senior SDE (5+ yrs)", min: 58, max: 85 },
      { role: "Staff Engineer / EM (7+ yrs)", min: 78, max: 115 },
    ]} caption="Uber India total compensation 2026 — Bengaluru GCC; strong growth culture" />
  ),

  /* linkedin-india-interview-questions-2026: Social/professional network */
  "linkedin-india-interview-questions-2026||LinkedIn India Interview Process": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, role fit, LinkedIn motivation" },
      { label: "Coding Screen", duration: "60 min", detail: "2 DSA problems; Medium difficulty via CoderPad" },
      { label: "Technical Round — Coding ×2", duration: "60 min each", detail: "Algorithms, object-oriented design, code quality" },
      { label: "System Design Round", duration: "60 min", detail: "News feed, social graph, job recommendation system design" },
      { label: "Behavioral / Values Round", duration: "45 min", detail: "LinkedIn values: transformation, integrity, collaboration, humor" },
    ]} />
  ),
  "linkedin-india-interview-questions-2026||LinkedIn India Salary and Work Culture": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "SDE-1 / E4 (0–2 yrs)", min: 28, max: 42, note: "Microsoft RSUs" },
      { role: "SDE-2 / E5 (2–5 yrs)", min: 40, max: 62 },
      { role: "Senior SDE / E6 (5–8 yrs)", min: 58, max: 90 },
      { role: "Staff Engineer / E7 (8+ yrs)", min: 82, max: 130 },
    ]} caption="LinkedIn India salary 2026 — Microsoft RSUs (MSFT stock); Bengaluru office" />
  ),

  /* salesforce-india-interview-questions-2026: CRM cloud */
  "salesforce-india-interview-questions-2026||Salesforce India Interview Process": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, Salesforce ecosystem awareness, timeline" },
      { label: "Coding Screen", duration: "60 min", detail: "2 DSA problems; Java preferred; Medium difficulty" },
      { label: "Technical Round — Coding + OOP", duration: "60 min", detail: "Java, OOP design, REST API patterns, multithreading" },
      { label: "System Design Round", duration: "60 min", detail: "CRM systems, multi-tenant SaaS design, event-driven architecture" },
      { label: "Behavioral / Ohana Culture Round", duration: "45 min", detail: "Salesforce values: trust, customer success, innovation, equality" },
    ]} />
  ),
  "salesforce-india-interview-questions-2026||Salesforce India Salary and Benefits": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "MTS (Member of Technical Staff) 1", min: 25, max: 40, note: "RSUs + VTO" },
      { role: "MTS 2 (2–5 yrs)", min: 38, max: 58 },
      { role: "Senior MTS (5–8 yrs)", min: 55, max: 82 },
      { role: "Principal MTS / EM (8+ yrs)", min: 78, max: 115 },
    ]} caption="Salesforce India salary 2026 — RSUs vest quarterly; Hyderabad + Bengaluru offices" />
  ),

  /* goldman-sachs-india-interview-questions-2026: Investment bank tech */
  "goldman-sachs-india-interview-questions-2026||Goldman Sachs India Interview Process": (
    <RoundFlow rounds={[
      { label: "HireVue Video Interview", duration: "30 min", detail: "Pre-recorded; motivation, problem-solving scenario, background" },
      { label: "Coding Round", duration: "60 min", detail: "3–4 Medium problems; Java/C++ preferred; CS fundamentals heavy" },
      { label: "Technical Interview 1 — Algorithms + OS", duration: "60 min", detail: "Data structures, OS concepts, networking, databases" },
      { label: "Technical Interview 2 — Design", duration: "60 min", detail: "Trading system design, low-latency patterns, data pipelines" },
      { label: "HR / Divisional Interview", duration: "30 min", detail: "GS values, division fit, motivation for finance tech" },
    ]} />
  ),
  "goldman-sachs-india-interview-questions-2026||Goldman Sachs India Salary and Career Path": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Analyst (Fresher / New Grad)", min: 18, max: 28, note: "Plus end-of-year bonus" },
      { role: "Associate (2–4 yrs)", min: 28, max: 45 },
      { role: "Vice President (5–8 yrs)", min: 45, max: 75 },
      { role: "Executive Director (8+ yrs)", min: 70, max: 120 },
    ]} caption="Goldman Sachs India 2026 — bonus 20–100% of base; Bengaluru + Hyderabad centres" />
  ),

  /* jpmorgan-india-interview-questions-2026: Banking tech */
  "jpmorgan-india-interview-questions-2026||JPMorgan India Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "Aptitude + 2 coding problems (Medium); Java/Python/C++" },
      { label: "Technical Round 1 — Algorithms", duration: "60 min", detail: "DSA, OOP, databases, REST APIs" },
      { label: "Technical Round 2 — Domain + Design", duration: "60 min", detail: "Financial systems, risk engine design, trading platform concepts" },
      { label: "HR / Business Principles Round", duration: "30 min", detail: "JPMC principles: client focus, excellence, integrity" },
    ]} />
  ),
  "jpmorgan-india-interview-questions-2026||JPMorgan India Salary and Career Path": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "Software Engineer Analyst (Fresher)", min: 12, max: 20, note: "Pune / Mumbai / Bengaluru" },
      { role: "Software Engineer Associate (2–4 yrs)", min: 20, max: 32 },
      { role: "Associate (Vice President track, 4–7 yrs)", min: 30, max: 48 },
      { role: "Vice President (7+ yrs)", min: 45, max: 75 },
    ]} caption="JPMorgan Chase India 2026 — cash bonus 10–30% of base; strong GCC scale" />
  ),

  /* adobe-india-interview-questions-2026: Creative cloud */
  "adobe-india-interview-questions-2026||Adobe India Interview Process: All Five Rounds Explained": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "90 min", detail: "2–3 DSA problems; Medium–Hard; C++/Java preferred" },
      { label: "Technical Round 1 — DSA", duration: "60 min", detail: "Algorithms, data structures, time/space complexity depth" },
      { label: "Technical Round 2 — OOP + LLD", duration: "60 min", detail: "Low-level design: design a parking lot, LRU cache, chess game" },
      { label: "Technical Round 3 — System Design", duration: "60 min", detail: "HLD: image processing pipeline, creative cloud sync, CDN" },
      { label: "HR / Hiring Manager Round", duration: "30 min", detail: "Adobe values, cross-functional influence, career goals" },
    ]} />
  ),
  "adobe-india-interview-questions-2026||Adobe India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "MTS 1 / SDE-1 (0–2 yrs)", min: 22, max: 35, note: "RSUs on 4yr vest" },
      { role: "MTS 2 / SDE-2 (2–5 yrs)", min: 35, max: 52 },
      { role: "Senior MTS (5–8 yrs)", min: 50, max: 75 },
      { role: "Principal MTS / EM (8+ yrs)", min: 70, max: 105 },
    ]} caption="Adobe India salary 2026 — RSUs vest quarterly; Noida + Bengaluru offices" />
  ),

  /* cisco-india-interview-questions-2026: Networking giant */
  "cisco-india-interview-questions-2026||Cisco India Interview Process: Five Rounds with Networking Focus": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "Aptitude + networking MCQs + 1 coding problem" },
      { label: "Technical Round 1 — CS Fundamentals", duration: "60 min", detail: "OOP, OS, networking basics, one algorithm problem" },
      { label: "Technical Round 2 — Networking Depth", duration: "60 min", detail: "BGP, OSPF, TCP/IP stack, VLAN, SD-WAN concepts" },
      { label: "Technical Round 3 — Design / Coding", duration: "60 min", detail: "Network protocol implementation, socket programming, system design" },
      { label: "HR / Hiring Manager Round", duration: "30 min", detail: "Cisco values, team fit, long-term vision" },
    ]} />
  ),
  "cisco-india-interview-questions-2026||Cisco India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Software Engineer (0–2 yrs)", min: 18, max: 28, note: "RSUs on 4yr vest" },
      { role: "Senior Software Engineer (2–5 yrs)", min: 28, max: 42 },
      { role: "Staff Engineer (5–8 yrs)", min: 40, max: 58 },
      { role: "Principal Engineer / EM (8+ yrs)", min: 55, max: 85 },
    ]} caption="Cisco India salary 2026 — Bengaluru + Chennai offices; strong networking domain" />
  ),

  /* oracle-india-interview-questions-2026: Database and cloud */
  "oracle-india-interview-questions-2026||Oracle India Interview Process: Five Rounds with Database and Java Focus": (
    <RoundFlow rounds={[
      { label: "Online Coding Test", duration: "90 min", detail: "2–3 DSA problems + Java MCQs; database SQL section" },
      { label: "Technical Round 1 — Java Depth", duration: "60 min", detail: "Java core, JVM internals, concurrency, collections" },
      { label: "Technical Round 2 — Database", duration: "60 min", detail: "Oracle SQL, PL/SQL, query optimisation, indexing, RAC" },
      { label: "Technical Round 3 — System Design", duration: "60 min", detail: "Distributed database design, OCI architecture, microservices" },
      { label: "HR / Manager Round", duration: "30 min", detail: "Oracle culture, product pride, career growth path" },
    ]} />
  ),
  "oracle-india-interview-questions-2026||Oracle India Salary Benchmarks and Career Paths 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Software Engineer (0–2 yrs)", min: 20, max: 32, note: "RSUs on 4yr vest" },
      { role: "Senior Software Engineer (2–5 yrs)", min: 30, max: 48 },
      { role: "Staff Engineer (5–8 yrs)", min: 45, max: 65 },
      { role: "Principal Engineer / EM (8+ yrs)", min: 60, max: 95 },
    ]} caption="Oracle India salary 2026 — Bengaluru + Hyderabad + Pune offices; OCI growth role" />
  ),

  /* thoughtworks-india-interview-questions-2026: Consultancy / craft */
  "thoughtworks-india-interview-questions-2026||ThoughtWorks India Interview: Four Stages Unlike Anywhere Else": (
    <RoundFlow rounds={[
      { label: "Technical Aptitude Test (TAT)", duration: "90 min", detail: "Analytical puzzles, basic coding, logical reasoning" },
      { label: "Coding and Pairing Round", duration: "90 min", detail: "TDD exercise in your language; code quality and XP practices matter" },
      { label: "Technical Interview — Design + Case", duration: "60 min", detail: "OOP design, system architecture, consulting scenario" },
      { label: "Culture / Values Interview", duration: "60 min", detail: "Social justice awareness, XP/agile conviction, collaboration style" },
    ]} />
  ),
  "thoughtworks-india-interview-questions-2026||ThoughtWorks India Salary: The Deliberate Trade-off": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "Graduate Consultant (Fresher)", min: 8, max: 12, note: "Below market; craft in return" },
      { role: "Application Developer (1–3 yrs)", min: 12, max: 20 },
      { role: "Senior Consultant (3–6 yrs)", min: 18, max: 30 },
      { role: "Principal Consultant (6+ yrs)", min: 28, max: 45 },
    ]} caption="ThoughtWorks India salary 2026 — 20–30% below market; strong craft brand offset" />
  ),

  /* sap-labs-india-interview-questions-2026: SAP enterprise software */
  "sap-labs-india-interview-questions-2026||SAP Labs India Interview Process: Structure and What Each Round Tests": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "Aptitude + ABAP/Java/Python MCQs + 1 coding problem" },
      { label: "Technical Round 1 — Algorithms + CS", duration: "60 min", detail: "DSA, OOP, database design, REST APIs" },
      { label: "Technical Round 2 — SAP Domain", duration: "60 min", detail: "SAP HANA, S/4HANA, BTP, ABAP (for product roles); architecture" },
      { label: "Hiring Manager / Design Round", duration: "60 min", detail: "Product architecture, enterprise SaaS design, cross-team scope" },
      { label: "HR Round", duration: "20 min", detail: "SAP values, Bengaluru / Pune preference, career goals" },
    ]} />
  ),
  "sap-labs-india-interview-questions-2026||SAP Labs India Salary Benchmarks and Career Paths 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Developer Associate (0–2 yrs)", min: 15, max: 25, note: "RSUs on 4yr vest" },
      { role: "Developer (2–5 yrs)", min: 24, max: 40 },
      { role: "Senior Developer (5–8 yrs)", min: 38, max: 55 },
      { role: "Principal Developer / Architect (8+ yrs)", min: 52, max: 80 },
    ]} caption="SAP Labs India salary 2026 — Bengaluru HQ; strong enterprise product ownership" />
  ),

  /* atlassian-india-interview-questions-2026 (second occurrence, index 95) — duplicate slug, use same key approach */
  /* Note: both posts share the same slug; using the unique heading text as differentiator */
  "atlassian-india-interview-questions-2026||Atlassian India Interview Process: The Karat Screen and TEAM Values Round": (
    <RoundFlow rounds={[
      { label: "Karat Technical Screen", duration: "60 min", detail: "2 DSA problems with Karat interviewer; code quality judged" },
      { label: "Coding Round (Internal)", duration: "60 min", detail: "Data structures, clean code, edge cases" },
      { label: "System Design Round", duration: "60 min", detail: "Jira/Confluence-scale multi-tenant platform, distributed systems" },
      { label: "TEAM Values Round", duration: "45 min", detail: "Open company, no bull, play as a team, build balance" },
      { label: "Hiring Manager Round", duration: "30 min", detail: "Product domain, TEAM Anywhere culture, long-term growth" },
    ]} />
  ),
  "atlassian-india-interview-questions-2026||Atlassian's TEAM Values: What the Values Round Actually Tests": (
    <FrameworkSteps steps={[
      { number: "T", label: "Open company, no bull", hint: "Radical transparency — share information broadly, question decisions respectfully" },
      { number: "E", label: "Build with heart and balance", hint: "Sustainable pace, genuine care for people, avoid burnout" },
      { number: "A", label: "Play as a team", hint: "Diverse inclusion, collaborate across time zones, TEAM Anywhere ethos" },
      { number: "M", label: "Don't #@!% the customer", hint: "Customer obsession — quality that respects users' trust" },
    ]} />
  ),

  /* paypal-india-interview-questions-2026: Payments product */
  "paypal-india-interview-questions-2026||PayPal India Interview Process: Payments-Specific System Design": (
    <RoundFlow rounds={[
      { label: "Online Coding Assessment", duration: "90 min", detail: "2–3 DSA problems; Java/Python; payments domain MCQs" },
      { label: "Technical Round 1 — Algorithms + CS", duration: "60 min", detail: "DSA, concurrency, REST APIs, database design" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "Payments processing, fraud detection, idempotency in financial APIs" },
      { label: "Hiring Manager / Behavioural Round", duration: "45 min", detail: "PayPal mission, global financial inclusion, ownership" },
    ]} />
  ),
  "paypal-india-interview-questions-2026||PayPal India Salary Benchmarks and Career Paths 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 22, max: 35, note: "RSUs on 3yr vest" },
      { role: "SDE-2 (2–5 yrs)", min: 35, max: 52 },
      { role: "Senior SDE (5–8 yrs)", min: 50, max: 72 },
      { role: "Staff SDE / EM (8+ yrs)", min: 68, max: 100 },
    ]} caption="PayPal India salary 2026 — Chennai + Bengaluru offices; full product ownership" />
  ),

  /* walmart-global-tech-india-interview-questions-2026: Retail tech */
  "walmart-global-tech-india-interview-questions-2026||Walmart Global Tech India Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Coding Assessment", duration: "90 min", detail: "2–3 DSA problems; Java preferred; supply chain domain basics" },
      { label: "Technical Round 1 — Algorithms", duration: "60 min", detail: "DSA, OOP, concurrency, REST API design" },
      { label: "Technical Round 2 — System Design", duration: "60 min", detail: "E-commerce search, inventory management, fulfillment routing" },
      { label: "Behavioral / Culture Round", duration: "45 min", detail: "Walmart values: service, excellence, respect, integrity" },
    ]} />
  ),
  "walmart-global-tech-india-interview-questions-2026||Walmart Global Tech India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 22, max: 35, note: "RSUs on 4yr vest" },
      { role: "SDE-2 (2–5 yrs)", min: 35, max: 52 },
      { role: "Senior SDE (5–8 yrs)", min: 48, max: 70 },
      { role: "Staff SDE / EM (8+ yrs)", min: 65, max: 95 },
    ]} caption="Walmart Global Tech India 2026 — Bengaluru office; strong retail domain product ownership" />
  ),

  /* qualcomm-india-interview-questions-2026 (second occurrence, index 98) */
  "qualcomm-india-interview-questions-2026||Qualcomm India Interview Process: What Makes It Different": (
    <RoundFlow rounds={[
      { label: "Technical Phone Screen", duration: "60 min", detail: "C++ coding, embedded systems basics, OS concepts" },
      { label: "Technical Round 1 — C++ and OS", duration: "60 min", detail: "Memory management, threading, RTOS concepts, driver stack" },
      { label: "Technical Round 2 — Domain Depth", duration: "60 min", detail: "5G/LTE modem stack, DSP, QDSP6 processor architecture" },
      { label: "System Design Round", duration: "60 min", detail: "Firmware architecture, baseband system design" },
      { label: "HR Round", duration: "20 min", detail: "Qualcomm values, team fit, long-term goals" },
    ]} />
  ),
  "qualcomm-india-interview-questions-2026||Qualcomm India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Engineer (0–2 yrs)", min: 18, max: 30, note: "Hyderabad / Bengaluru office" },
      { role: "Senior Engineer (2–5 yrs)", min: 28, max: 44 },
      { role: "Staff Engineer (5–8 yrs)", min: 42, max: 62 },
      { role: "Principal Engineer (8+ yrs)", min: 58, max: 92 },
    ]} caption="Qualcomm India salary 2026 — RSUs on 3yr vest; semiconductor domain premium" />
  ),

  /* vmware-india-interview-questions-2026: Virtualisation / Broadcom */
  "vmware-india-interview-questions-2026||VMware India Interview Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "75 min", detail: "C / C++ / Java MCQs + OS concepts + 1 coding problem" },
      { label: "Technical Round 1 — CS Fundamentals", duration: "60 min", detail: "OS internals, virtualisation basics, networking, DSA" },
      { label: "Technical Round 2 — Virtualisation Depth", duration: "60 min", detail: "Hypervisor design, VMware vSphere, storage virtualisation, Kubernetes" },
      { label: "System Design Round", duration: "60 min", detail: "Distributed infrastructure design, container orchestration" },
      { label: "HR / Manager Round", duration: "30 min", detail: "Broadcom-VMware transition awareness, team fit, growth mindset" },
    ]} />
  ),
  "vmware-india-interview-questions-2026||VMware India Salary Benchmarks 2026 (Post-Broadcom)": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Software Engineer (0–2 yrs)", min: 18, max: 28, note: "Broadcom RSUs now" },
      { role: "Senior Software Engineer (2–5 yrs)", min: 28, max: 42 },
      { role: "Staff Engineer (5–8 yrs)", min: 40, max: 58 },
      { role: "Principal Engineer (8+ yrs)", min: 55, max: 82 },
    ]} caption="VMware India salary 2026 — post-Broadcom acquisition; Pune + Bengaluru offices" />
  ),

  /* uber-india-interview-questions-2026 (second occurrence, index 100) */
  "uber-india-interview-questions-2026||Geospatial System Design: Uber's Distinctive Interview Topic": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify geo requirements", hint: "Scale (city / country / global), accuracy needs, update frequency" },
      { number: "02", label: "Geospatial indexing", hint: "Geohash or H3 hex grid to partition the map into searchable cells" },
      { number: "03", label: "Real-time driver location updates", hint: "WebSocket fanout, Kafka for location event streaming" },
      { number: "04", label: "Matching algorithm", hint: "Nearest driver in geohash cell, supply-demand rebalancing" },
      { number: "05", label: "ETA and routing", hint: "Pre-computed road graph, traffic-weighted Dijkstra, frequent recompute" },
      { number: "06", label: "Surge pricing engine", hint: "Supply/demand ratio per geohash cell, configurable multipliers" },
    ]} />
  ),
  "uber-india-interview-questions-2026||Uber India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "SDE-1 (0–2 yrs)", min: 28, max: 44, note: "RSUs on 4yr vest" },
      { role: "SDE-2 (2–5 yrs)", min: 42, max: 62 },
      { role: "Senior SDE (5–8 yrs)", min: 60, max: 88 },
      { role: "Staff Engineer / EM (8+ yrs)", min: 82, max: 120 },
    ]} caption="Uber India total compensation 2026 — Bengaluru GCC; strong systems scale culture" />
  ),

  /* airbnb-india-interview-questions-2026: Travel tech */
  "airbnb-india-interview-questions-2026||Airbnb India Interview Process: The Life Story Round": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, motivation, timeline" },
      { label: "Technical Phone Screen", duration: "60 min", detail: "2 DSA problems; Medium–Hard; Python or Java" },
      { label: "Coding Round ×2 (Onsite)", duration: "60 min each", detail: "Hard-level problems, clean code, test cases" },
      { label: "System Design Round", duration: "60 min", detail: "Search and discovery, pricing system, host-guest matching" },
      { label: "Life Story Round", duration: "45 min", detail: "Walk through your life; values alignment with Airbnb mission" },
    ]} />
  ),
  "airbnb-india-interview-questions-2026||Airbnb India Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "SWE L3 (0–2 yrs)", min: 35, max: 55, note: "RSUs on 4yr vest" },
      { role: "SWE L4 (2–5 yrs)", min: 52, max: 78 },
      { role: "Senior SWE L5 (5–8 yrs)", min: 72, max: 108 },
      { role: "Staff SWE L6 (8+ yrs)", min: 100, max: 150 },
    ]} caption="Airbnb India GCC salary 2026 — Bengaluru office; RSUs in USD; travel perks" />
  ),

  /* stripe-india-interview-questions-2026: Fintech infra */
  "stripe-india-interview-questions-2026||Stripe India Interview: Debugging and Code Review Rounds": (
    <RoundFlow rounds={[
      { label: "Recruiter Screen", duration: "30 min", detail: "Background, Stripe motivation, compensation alignment" },
      { label: "Coding Screen", duration: "60 min", detail: "2 DSA problems via CoderPad; Python/Ruby/Go" },
      { label: "Technical Round — Bug Fix / Code Review", duration: "60 min", detail: "Stripe-specific: review a buggy codebase, find and fix issues" },
      { label: "System Design Round", duration: "60 min", detail: "Payment processing reliability, idempotency, webhook delivery" },
      { label: "Behavioral / Mission Round", duration: "45 min", detail: "Stripe mission: increase GDP of the internet; ownership at scale" },
    ]} />
  ),
  "stripe-india-interview-questions-2026||Stripe India Salary and Equity 2026": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "L3 Software Engineer (0–2 yrs)", min: 35, max: 55, note: "Pre-IPO equity + cash" },
      { role: "L4 Software Engineer (2–5 yrs)", min: 52, max: 80 },
      { role: "L5 Senior Engineer (5–8 yrs)", min: 75, max: 110 },
      { role: "L6 Staff Engineer (8+ yrs)", min: 100, max: 155 },
    ]} caption="Stripe India 2026 — Bengaluru office; pre-IPO equity; above-market cash comp" />
  ),

  /* ── Technical ── */
  /* tell-me-about-yourself-best-answer: Formula framework for structuring answers */
  "tell-me-about-yourself-best-answer||The 3-Sentence Formula": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present", hint: "Your current role, tech stack, and a key achievement in one sentence" },
      { number: "02", label: "Past", hint: "One prior experience or project that led you here" },
      { number: "03", label: "Future", hint: "Why this role and company align with your next goal" },
    ]} />
  ),

  /* software-engineer-interview-checklist-2026: Day-by-day countdown checklist */
  "software-engineer-interview-checklist-2026||48 Hours Before: Technical Review": (
    <PrepTimeline caption="Interview countdown plan" phases={[
      { period: "48 hrs out", label: "Technical Review", tasks: ["Revise DSA patterns used at target company tier", "Skim your resume projects end-to-end", "Re-read 2–3 system design concepts"], milestone: "Tech knowledge refreshed" },
      { period: "24 hrs out", label: "Behavioral & Research", tasks: ["Prepare 5 STAR stories", "Research company's recent news, tech blog", "Write down 3 smart questions to ask"], milestone: "Stories and context ready" },
      { period: "Day of", label: "Logistics & Mindset", tasks: ["Test video/audio setup 30 min early", "Eat a proper meal, hydrate", "Arrive / join 5 min before start"] },
      { period: "In interview", label: "5-Point Framework", tasks: ["Clarify requirements before coding", "Think aloud", "Handle edge cases", "Test with examples", "Ask follow-up questions"] },
    ]} />
  ),

  /* java-interview-questions-freshers-india-2026: Study roadmap for Java freshers */
  "java-interview-questions-freshers-india-2026||Java 8+ Features: Modern Fresher Questions": (
    <FrameworkSteps steps={[
      { number: "01", label: "Lambda & Streams", hint: "Filter, map, collect — asked at virtually every Java fresher interview" },
      { number: "02", label: "Optional", hint: "Null-safety idioms; differentiate from null checks" },
      { number: "03", label: "Default & Static Methods in Interfaces", hint: "Why they exist and backward compatibility" },
      { number: "04", label: "Date/Time API", hint: "LocalDate, LocalDateTime vs old java.util.Date" },
      { number: "05", label: "Functional Interfaces", hint: "Predicate, Function, Consumer, Supplier — know all four" },
    ]} />
  ),

  /* python-interview-questions-freshers-india-2026: Python prep approach */
  "python-interview-questions-freshers-india-2026||Python in DSA Coding Rounds": (
    <FrameworkSteps steps={[
      { number: "01", label: "Know built-ins cold", hint: "sorted(), enumerate(), zip(), collections.defaultdict, heapq" },
      { number: "02", label: "List comprehensions", hint: "Interviewers expect Pythonic one-liners; avoid verbose loops where possible" },
      { number: "03", label: "String methods", hint: "split, join, strip, startswith — common in array/string problems" },
      { number: "04", label: "Complexity awareness", hint: "Know that dict/set ops are O(1); list.insert is O(n)" },
    ]} />
  ),

  /* sql-interview-questions-freshers-india-2026: SQL topic prep ladder */
  "sql-interview-questions-freshers-india-2026||Window Functions: The Advanced Level": (
    <FrameworkSteps steps={[
      { number: "01", label: "ROW_NUMBER()", hint: "Deduplicate rows, rank within a partition" },
      { number: "02", label: "RANK() / DENSE_RANK()", hint: "Difference matters — gaps vs no-gaps in ties" },
      { number: "03", label: "LAG() / LEAD()", hint: "Compare a row to its predecessor/successor — classic interview problem" },
      { number: "04", label: "SUM() OVER / AVG() OVER", hint: "Running totals and moving averages without GROUP BY" },
      { number: "05", label: "PARTITION BY vs ORDER BY", hint: "Explain how they divide and order rows within a window" },
    ]} />
  ),

  /* cpp-interview-questions-freshers-india-2026: C++ study approach */
  "cpp-interview-questions-freshers-india-2026||STL: Standard Template Library": (
    <FrameworkSteps steps={[
      { number: "01", label: "vector", hint: "Dynamic array; know push_back, resize, reserve, iterator invalidation" },
      { number: "02", label: "map / unordered_map", hint: "Ordered vs hash — know time complexity of each" },
      { number: "03", label: "set / multiset", hint: "Unique sorted elements; use for range queries" },
      { number: "04", label: "stack / queue / priority_queue", hint: "Know which problems map to each container" },
      { number: "05", label: "Algorithms", hint: "sort, binary_search, lower_bound, upper_bound — memorise signatures" },
    ]} />
  ),

  /* javascript-interview-questions-india-2026: JS interview key framework */
  "javascript-interview-questions-india-2026||Event Loop, Async, and Promises": (
    <FrameworkSteps steps={[
      { number: "01", label: "Call Stack", hint: "Synchronous execution — LIFO; understand how frames push and pop" },
      { number: "02", label: "Web APIs / Node APIs", hint: "setTimeout, fetch — offloaded here, not in the JS thread" },
      { number: "03", label: "Callback / Task Queue", hint: "Macrotasks: setTimeout callbacks land here" },
      { number: "04", label: "Microtask Queue", hint: "Promise .then() runs before the next macrotask — higher priority" },
      { number: "05", label: "Event Loop", hint: "Picks from microtask queue first, then task queue, repeat" },
    ]} />
  ),

  /* system-design-interview-questions-india-2026: SD answer framework */
  "system-design-interview-questions-india-2026||How to Structure Every System Design Answer (The Framework)": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify Requirements", hint: "Functional vs non-functional; ask about scale, latency, consistency needs" },
      { number: "02", label: "Estimate Scale", hint: "DAU, QPS, storage; back-of-envelope in 2 minutes" },
      { number: "03", label: "High-Level Design", hint: "Draw boxes: clients, load balancer, API servers, DB, cache" },
      { number: "04", label: "Deep-Dive Components", hint: "Pick 2–3 critical components; discuss trade-offs in depth" },
      { number: "05", label: "Handle Bottlenecks", hint: "Caching, sharding, async queues, CDN — show you think at scale" },
      { number: "06", label: "Wrap Up", hint: "Summarise design, mention what you'd do differently with more time" },
    ]} />
  ),

  /* dsa-interview-preparation-guide-india-2026: 12-week DSA study plan */
  "dsa-interview-preparation-guide-india-2026||12-Week DSA Study Plan for Product Company Readiness": (
    <PrepTimeline caption="12-week DSA plan for Indian product company interviews" phases={[
      { period: "Weeks 1–2", label: "Arrays & Strings", tasks: ["Two pointers", "Sliding window", "Prefix sum", "String manipulation"], milestone: "20 easy problems done" },
      { period: "Weeks 3–4", label: "Hashing & Sorting", tasks: ["HashMap patterns", "Counting frequencies", "Merge sort / quick sort logic", "Top-K problems"], milestone: "50 problems done" },
      { period: "Weeks 5–6", label: "Trees & Graphs", tasks: ["BFS, DFS", "Binary search tree operations", "Graph traversal and cycle detection"], milestone: "Tree & graph patterns solid" },
      { period: "Weeks 7–8", label: "Dynamic Programming", tasks: ["1D DP (climbing stairs, house robber)", "2D DP (grid problems)", "LCS, LIS patterns"], milestone: "Core DP patterns memorised" },
      { period: "Weeks 9–10", label: "Heaps & Backtracking", tasks: ["Priority queue problems", "Top-K elements", "Permutations and subsets"], milestone: "80 medium problems done" },
      { period: "Weeks 11–12", label: "Mock & Consolidate", tasks: ["Company-tagged LeetCode sets", "2 timed mock interviews per week", "Review weak areas"], milestone: "Interview-ready" },
    ]} />
  ),

  /* data-analyst-interview-questions-india-2026: framework for BA/DA interviews */
  "data-analyst-interview-questions-india-2026||Business Case Questions: A Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Understand the Goal", hint: "What metric are we trying to move? Revenue, retention, activation?" },
      { number: "02", label: "Define the Metric", hint: "Propose a north star metric and 2–3 supporting metrics" },
      { number: "03", label: "Diagnose the Problem", hint: "Funnel breakdown, segment analysis, time-based trends" },
      { number: "04", label: "Hypothesise Root Cause", hint: "Data, product, or external cause? State assumptions clearly" },
      { number: "05", label: "Recommend Action", hint: "Experiment vs immediate fix vs further investigation" },
    ]} />
  ),

  /* product-manager-interview-guide-india-startups: PM interview 5 dimensions */
  "product-manager-interview-guide-india-startups||The Five PM Interview Dimensions": (
    <FrameworkSteps steps={[
      { number: "01", label: "Product Sense", hint: "Design a product or feature; use user-first thinking with trade-offs" },
      { number: "02", label: "Metrics", hint: "Define success metrics, diagnose drops, propose experiments" },
      { number: "03", label: "Execution", hint: "Prioritisation frameworks (RICE, ICE), roadmap thinking" },
      { number: "04", label: "Technical Fluency", hint: "Explain APIs, databases, system constraints to your team" },
      { number: "05", label: "Behavioural / Leadership", hint: "STAR stories: influence without authority, cross-functional alignment" },
    ]} />
  ),

  /* system-design-interview-for-freshers-india: fresher SD framework */
  "system-design-interview-for-freshers-india||A Framework to Structure Any Design Answer": (
    <FrameworkSteps steps={[
      { number: "01", label: "Requirements", hint: "Ask: who are the users, what are the core features, scale estimate?" },
      { number: "02", label: "API Design", hint: "Define endpoints or function signatures before drawing boxes" },
      { number: "03", label: "Data Model", hint: "What tables or collections, key fields, relationships" },
      { number: "04", label: "High-Level Architecture", hint: "Client → Server → DB; add cache and queue if relevant" },
      { number: "05", label: "Trade-off Discussion", hint: "SQL vs NoSQL, monolith vs services — state your reasoning" },
    ]} />
  ),

  /* react-developer-interview-questions-india-2026: React hooks depth */
  "react-developer-interview-questions-india-2026||Core Hooks: The Most-Tested Area": (
    <FrameworkSteps steps={[
      { number: "01", label: "useState", hint: "State batching in React 18, functional updates, lazy initialiser" },
      { number: "02", label: "useEffect", hint: "Dependency array rules, cleanup, comparing to componentDidMount" },
      { number: "03", label: "useCallback / useMemo", hint: "When they help (stable references) vs when they add cost" },
      { number: "04", label: "useRef", hint: "Persisting values without re-render, DOM access" },
      { number: "05", label: "Custom Hooks", hint: "Extract shared stateful logic; demonstrate with a useFetch example" },
    ]} />
  ),

  /* business-analyst-interview-questions-india-2026: BA skill breakdown */
  "business-analyst-interview-questions-india-2026||What Indian BA Interviews Test": (
    <FrameworkSteps steps={[
      { number: "01", label: "Requirements Elicitation", hint: "User stories, use cases, acceptance criteria — know the formats" },
      { number: "02", label: "Process Mapping", hint: "As-Is vs To-Be; BPMN or flowchart; gap analysis" },
      { number: "03", label: "SQL / Data Analysis", hint: "Basic JOINs, GROUP BY, aggregations — always tested" },
      { number: "04", label: "Stakeholder Management", hint: "STAR stories: aligning conflicting stakeholders, managing expectations" },
      { number: "05", label: "Domain Knowledge", hint: "Banking: SWIFT, IBAN, KYC; E-commerce: catalogues, orders, returns" },
    ]} />
  ),

  /* salesforce-interview-questions-india-2026: Salesforce salary */
  "salesforce-interview-questions-india-2026||Salesforce Certification and Salary in India": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "Salesforce Admin / Junior Dev", min: 4, max: 9 },
      { role: "Salesforce Developer (3–5 yrs)", min: 10, max: 20 },
      { role: "Salesforce Architect / Lead", min: 20, max: 35 },
      { role: "Certified Technical Architect (CTA)", min: 30, max: 40, note: "Rare; high demand" },
    ]} caption="India 2026 — product and service company Salesforce roles" />
  ),

  /* ui-ux-designer-interview-questions-india-2026: design interview process */
  "ui-ux-designer-interview-questions-india-2026||How Indian Design Interviews Are Structured": (
    <FrameworkSteps steps={[
      { number: "01", label: "Portfolio Review", hint: "Walk through 2–3 case studies; explain your design decisions and trade-offs" },
      { number: "02", label: "Design Challenge", hint: "Redesign a product or feature; use the double-diamond process" },
      { number: "03", label: "Product Critique", hint: "Identify usability issues; suggest improvements with reasoning" },
      { number: "04", label: "Whiteboard / Wireframe", hint: "Sketch a flow on the spot; show structure before visuals" },
      { number: "05", label: "Behavioral Round", hint: "Collaboration with PMs and engineers; handling feedback and conflict" },
    ]} />
  ),

  /* data-science-interview-questions-india-2026: DS preparation ladder */
  "data-science-interview-questions-india-2026||What Indian Data Science Interviews Actually Test": (
    <FrameworkSteps steps={[
      { number: "01", label: "Statistics & Probability", hint: "Distributions, hypothesis testing, p-value, confidence intervals" },
      { number: "02", label: "ML Algorithms", hint: "Decision trees, gradient boosting, regularisation, bias-variance" },
      { number: "03", label: "SQL", hint: "Aggregations, JOINs, window functions — tested at every company" },
      { number: "04", label: "Python / Pandas", hint: "Data wrangling, feature engineering, visualisation" },
      { number: "05", label: "Business Case / Product Intuition", hint: "Interpret an A/B test, diagnose a metric drop, recommend action" },
    ]} />
  ),

  /* cryptocurrency-blockchain-interview-questions-india-2026: blockchain salary */
  "cryptocurrency-blockchain-interview-questions-india-2026||Salary and Market Reality for Blockchain Roles in India": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "Blockchain Developer (0–2 yrs)", min: 6, max: 14 },
      { role: "Smart Contract / Solidity Dev (2–4 yrs)", min: 14, max: 25 },
      { role: "Blockchain Architect / Lead (4–7 yrs)", min: 22, max: 40 },
      { role: "DeFi Protocol Engineer (Senior)", min: 30, max: 50, note: "Often USD-remote roles" },
    ]} caption="India 2026 — includes fintech and Web3-native employers" />
  ),

  /* fullstack-developer-interview-questions-india-2026: full-stack approach */
  "fullstack-developer-interview-questions-india-2026||System Design for Full-Stack Roles": (
    <FrameworkSteps steps={[
      { number: "01", label: "Feature Scoping", hint: "Break the feature into frontend, backend, and data storage concerns" },
      { number: "02", label: "API Contract", hint: "Define REST or GraphQL contract; discuss versioning" },
      { number: "03", label: "Database Design", hint: "Schema, indexing, SQL vs NoSQL choice with reasoning" },
      { number: "04", label: "State Management", hint: "Client-side state (React Query / Redux) vs server-side caching" },
      { number: "05", label: "Deployment & Scalability", hint: "CI/CD, containerisation, horizontal scaling basics" },
    ]} />
  ),

  /* cybersecurity-interview-questions-india-2026: security role salary */
  "cybersecurity-interview-questions-india-2026||Security Certifications and Their Value in India": (
    <SalaryLadder maxLPA={35} rows={[
      { role: "Security Analyst / SOC L1 (0–2 yrs)", min: 4, max: 9 },
      { role: "Penetration Tester / VAPT (2–4 yrs)", min: 8, max: 18 },
      { role: "Security Engineer / Cloud Security (3–6 yrs)", min: 15, max: 28 },
      { role: "CISO / Security Architect (8+ yrs)", min: 25, max: 35, note: "CISSP / CISM strongly preferred" },
    ]} caption="India 2026 — BFSI and product companies pay premium for certified professionals" />
  ),

  /* android-developer-interview-questions-india-2026: Android prep areas */
  "android-developer-interview-questions-india-2026||Android Architecture": (
    <FrameworkSteps steps={[
      { number: "01", label: "MVVM Pattern", hint: "ViewModel, LiveData / StateFlow, repository layer separation" },
      { number: "02", label: "Clean Architecture", hint: "Domain, data, presentation layers; dependency rule" },
      { number: "03", label: "Dependency Injection", hint: "Hilt / Dagger 2 — know how to scope and provide dependencies" },
      { number: "04", label: "Navigation Component", hint: "NavGraph, safe args, deep links" },
      { number: "05", label: "WorkManager", hint: "Background tasks, chaining, constraints" },
    ]} />
  ),

  /* dsa-preparation-for-interviews-india-2026: 90-day plan */
  "dsa-preparation-for-interviews-india-2026||The 90-day DSA study plan for Indian engineers": (
    <PrepTimeline caption="90-day DSA plan — from zero to product-company ready" phases={[
      { period: "Days 1–20", label: "Foundations", tasks: ["Arrays, strings, hashmaps", "Two pointers and sliding window", "Binary search"], milestone: "30 easy problems solved" },
      { period: "Days 21–45", label: "Core Data Structures", tasks: ["Linked lists, stacks, queues", "Trees and BST operations", "Heaps and priority queues"], milestone: "50 medium problems solved" },
      { period: "Days 46–70", label: "Graphs & DP", tasks: ["BFS/DFS, Dijkstra", "Union-Find", "1D and 2D dynamic programming"], milestone: "80 medium problems solved" },
      { period: "Days 71–90", label: "Mock & Refinement", tasks: ["Company-tagged problem sets", "Timed mock interviews", "System design basics for SDE-2"], milestone: "Ready for product company interviews" },
    ]} />
  ),

  /* coding-interview-mistakes-india-2026: mistake categories */
  "coding-interview-mistakes-india-2026||Mistake 1–4: Communication and approach failures": (
    <FrameworkSteps steps={[
      { number: "01", label: "Coding Before Clarifying", hint: "Always ask about constraints, edge cases, and expected output first" },
      { number: "02", label: "Silent Solving", hint: "Think aloud; interviewers evaluate your process, not just your answer" },
      { number: "03", label: "Jumping to Optimal", hint: "State a brute-force approach first, then optimise — shows structured thinking" },
      { number: "04", label: "Ignoring Edge Cases", hint: "Empty input, negative numbers, single element — mention them proactively" },
    ]} />
  ),

  /* nodejs-interview-questions-india-2026: Node.js core concepts */
  "nodejs-interview-questions-india-2026||Core Node.js concepts most commonly tested": (
    <FrameworkSteps steps={[
      { number: "01", label: "Event Loop", hint: "6 phases: timers, I/O callbacks, idle, poll, check, close — know the order" },
      { number: "02", label: "Non-blocking I/O", hint: "Why Node.js handles concurrency differently from thread-per-request models" },
      { number: "03", label: "Streams", hint: "Readable, Writable, Duplex, Transform — memory-efficient large data processing" },
      { number: "04", label: "Cluster / Worker Threads", hint: "Scaling CPU-bound work; difference between the two approaches" },
      { number: "05", label: "Error Handling", hint: "process.on('uncaughtException') vs domain vs async/await try-catch patterns" },
    ]} />
  ),

  /* technical-interview-one-week-prep-india-2026: 7-day plan */
  "technical-interview-one-week-prep-india-2026||Day 1: Audit and target-set (2–3 hours)": (
    <PrepTimeline caption="7-day rapid interview preparation plan" phases={[
      { period: "Day 1", label: "Audit & Target-Set", tasks: ["List your weak DSA topics", "Review job description for key tech stack", "Set realistic goals for the week"], milestone: "Study plan written" },
      { period: "Days 2–4", label: "DSA Sprint", tasks: ["3–4 hrs/day on targeted LeetCode problems", "Focus on patterns: sliding window, trees, DP", "Review solutions immediately after each problem"], milestone: "20+ targeted problems solved" },
      { period: "Day 5", label: "System Design", tasks: ["1 full design walkthrough (URL shortener or chat system)", "Review CAP theorem, caching, DB sharding basics"], milestone: "System design framework rehearsed" },
      { period: "Days 6–7", label: "Behavioral & Mock", tasks: ["Prepare 5 STAR stories", "1 full mock interview with time pressure", "Rest and light review only on Day 7"], milestone: "Confident and rested" },
    ]} />
  ),

  /* postgresql-interview-questions-india-2026: PostgreSQL concepts */
  "postgresql-interview-questions-india-2026||PostgreSQL-specific concepts": (
    <FrameworkSteps steps={[
      { number: "01", label: "MVCC", hint: "Multi-Version Concurrency Control — how PG handles reads without locking" },
      { number: "02", label: "Indexes", hint: "B-tree, GIN, GiST, BRIN — when to use each type" },
      { number: "03", label: "EXPLAIN ANALYZE", hint: "Read query plans; identify seq scans, index scans, hash joins" },
      { number: "04", label: "Partial & Expression Indexes", hint: "Index on filtered subset or computed expression for performance" },
      { number: "05", label: "Vacuuming & Autovacuum", hint: "Dead tuple cleanup; why neglecting it causes bloat and slowdowns" },
    ]} />
  ),

  /* microservices-interview-questions-india-2026: microservices concepts */
  "microservices-interview-questions-india-2026||Core microservices concepts tested in interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Service Decomposition", hint: "Domain-driven design, bounded contexts, when NOT to split services" },
      { number: "02", label: "Inter-service Communication", hint: "Sync (REST/gRPC) vs async (Kafka/RabbitMQ) — trade-offs" },
      { number: "03", label: "Service Discovery", hint: "Client-side (Eureka) vs server-side (Kubernetes Service)" },
      { number: "04", label: "Circuit Breaker", hint: "Resilience4j / Hystrix — fail-fast and prevent cascade failures" },
      { number: "05", label: "Distributed Tracing", hint: "OpenTelemetry, Jaeger, correlation IDs across services" },
    ]} />
  ),

  /* oop-interview-questions-india-2026: OOP principles */
  "oop-interview-questions-india-2026||SOLID principles with examples": (
    <FrameworkSteps steps={[
      { number: "S", label: "Single Responsibility", hint: "One class, one reason to change — separate Order and Invoice" },
      { number: "O", label: "Open/Closed", hint: "Open for extension, closed for modification — use interfaces/abstract classes" },
      { number: "L", label: "Liskov Substitution", hint: "Subtypes must be substitutable for their base types without breaking" },
      { number: "I", label: "Interface Segregation", hint: "Many small interfaces beat one fat interface" },
      { number: "D", label: "Dependency Inversion", hint: "Depend on abstractions, not concretions — enables easy mocking" },
    ]} />
  ),

  /* operating-systems-interview-questions-india-2026: OS topics */
  "operating-systems-interview-questions-india-2026||Scheduling and synchronisation": (
    <FrameworkSteps steps={[
      { number: "01", label: "CPU Scheduling Algorithms", hint: "FCFS, SJF, Round Robin, Priority Scheduling — know trade-offs" },
      { number: "02", label: "Mutex vs Semaphore", hint: "Mutex: binary ownership lock; Semaphore: signalling between threads" },
      { number: "03", label: "Deadlock", hint: "Four Coffman conditions; prevention via ordering or timeout" },
      { number: "04", label: "Monitors", hint: "High-level synchronisation construct; Java's synchronized block" },
      { number: "05", label: "Condition Variables", hint: "Wait and signal inside a monitor; bounded buffer producer-consumer" },
    ]} />
  ),

  /* frontend-developer-interview-questions-india-2026: frontend study areas */
  "frontend-developer-interview-questions-india-2026||JavaScript fundamentals most tested in Indian frontend interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Closures", hint: "Function + its lexical scope captured; common in currying and private state" },
      { number: "02", label: "Prototypal Inheritance", hint: "Prototype chain, Object.create, __proto__ vs prototype" },
      { number: "03", label: "this keyword", hint: "Binding rules: default, implicit, explicit (call/apply/bind), arrow functions" },
      { number: "04", label: "Event Loop & Async", hint: "Microtask vs macrotask queue; Promise vs setTimeout ordering" },
      { number: "05", label: "ES6+ Essentials", hint: "Destructuring, spread/rest, modules, optional chaining, nullish coalescing" },
    ]} />
  ),

  /* computer-networking-interview-questions-india-2026: networking concepts */
  "computer-networking-interview-questions-india-2026||OSI model and TCP/IP stack": (
    <FrameworkSteps steps={[
      { number: "07", label: "Application Layer", hint: "HTTP, HTTPS, DNS, SMTP — what engineers interact with daily" },
      { number: "04", label: "Transport Layer", hint: "TCP (reliable, ordered) vs UDP (fast, lossy) — when to use each" },
      { number: "03", label: "Network Layer", hint: "IP addressing, routing, subnets, NAT" },
      { number: "02", label: "Data Link Layer", hint: "MAC addresses, ARP, Ethernet frames" },
      { number: "01", label: "Physical Layer", hint: "Bits over wire/fiber — rarely asked but good to mention" },
    ]} />
  ),

  /* spring-boot-interview-questions-india-2026: Spring Boot topics */
  "spring-boot-interview-questions-india-2026||Spring Boot auto-configuration and REST": (
    <FrameworkSteps steps={[
      { number: "01", label: "Auto-configuration", hint: "@EnableAutoConfiguration scans classpath; @ConditionalOnClass enables features" },
      { number: "02", label: "Starter POMs", hint: "spring-boot-starter-web, -data-jpa, -security — aggregate dependencies" },
      { number: "03", label: "@RestController", hint: "@Controller + @ResponseBody; difference matters for view vs JSON responses" },
      { number: "04", label: "Exception Handling", hint: "@ControllerAdvice + @ExceptionHandler for centralised error responses" },
      { number: "05", label: "Actuator", hint: "/health, /metrics, /env endpoints for production observability" },
    ]} />
  ),

  /* aws-interview-questions-india-2026: AWS services study approach */
  "aws-interview-questions-india-2026||AWS core services most tested in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Compute", hint: "EC2 instance types, Auto Scaling groups, Lambda cold starts vs provisioned" },
      { number: "02", label: "Storage", hint: "S3 storage classes, EBS vs EFS vs S3, lifecycle policies" },
      { number: "03", label: "Database", hint: "RDS multi-AZ vs read replicas, DynamoDB partition key design, ElastiCache" },
      { number: "04", label: "Networking", hint: "VPC, subnets, security groups vs NACLs, Route 53 routing policies" },
      { number: "05", label: "IAM", hint: "Policies, roles, trust relationships — principle of least privilege" },
    ]} />
  ),

  /* golang-interview-questions-india-2026: Go preparation areas */
  "golang-interview-questions-india-2026||Go concurrency patterns and common pitfalls": (
    <FrameworkSteps steps={[
      { number: "01", label: "Goroutines", hint: "Lightweight threads; understand goroutine leaks — always provide a way to exit" },
      { number: "02", label: "Channels", hint: "Buffered vs unbuffered; direction-typed channels in function signatures" },
      { number: "03", label: "select statement", hint: "Multiplex channel operations; default case for non-blocking receive" },
      { number: "04", label: "sync.WaitGroup", hint: "Wait for a set of goroutines to finish; don't copy a WaitGroup" },
      { number: "05", label: "Race detector", hint: "go test -race; understand data races and how to prevent with mutex or channels" },
    ]} />
  ),

  /* api-design-best-practices-india-2026: API design approach */
  "api-design-best-practices-india-2026||REST API naming and URL conventions": (
    <FrameworkSteps steps={[
      { number: "01", label: "Resource-Centric URLs", hint: "/users/{id}/orders not /getOrdersForUser — nouns, not verbs" },
      { number: "02", label: "HTTP Verbs", hint: "GET (read), POST (create), PUT (replace), PATCH (partial update), DELETE" },
      { number: "03", label: "Status Codes", hint: "200/201/204 for success; 400 bad request; 401/403; 404; 409 conflict; 500" },
      { number: "04", label: "Versioning", hint: "URI (/v1/) vs header versioning — URI is simpler for Indian company contexts" },
      { number: "05", label: "Pagination", hint: "Cursor-based for large datasets; limit/offset for simpler use cases" },
    ]} />
  ),

  /* leetcode-study-plan-india-2026: 3-month LeetCode plan */
  "leetcode-study-plan-india-2026||Month 1: Foundations (Arrays, Strings, Hashmaps, Two Pointers)": (
    <PrepTimeline caption="3-month LeetCode study plan for Indian product companies" phases={[
      { period: "Month 1", label: "Foundations", tasks: ["Arrays & strings — 25 problems", "Hashmaps & sets — 15 problems", "Two pointers & sliding window — 15 problems", "Binary search — 10 problems"], milestone: "65 problems, patterns recognised" },
      { period: "Month 2", label: "Trees, Graphs & DP", tasks: ["Binary trees BFS/DFS — 20 problems", "Graphs (adjacency list, BFS, DFS, union-find) — 20 problems", "1D DP — 15 problems", "2D DP / interval DP — 10 problems"], milestone: "130 problems, DP patterns solid" },
      { period: "Month 3", label: "Advanced & Company Prep", tasks: ["Heaps, tries, segment trees — 15 problems", "Backtracking & greedy — 15 problems", "Company-tagged sets (Flipkart/Razorpay/Google) — 30 problems", "Timed mock contests weekly"], milestone: "190+ problems, interview-ready" },
    ]} />
  ),

  /* python-interview-questions-india-2026: Python study areas */
  "python-interview-questions-india-2026||Python fundamentals tested at all interview levels": (
    <FrameworkSteps steps={[
      { number: "01", label: "Data Types & Mutability", hint: "list vs tuple vs set vs dict; mutable default argument trap" },
      { number: "02", label: "GIL", hint: "Global Interpreter Lock — why threads don't give CPU parallelism in CPython" },
      { number: "03", label: "Generators", hint: "yield vs return; memory-efficient iteration; generator expressions" },
      { number: "04", label: "Comprehensions", hint: "List, dict, set comprehensions — write them faster than the interviewer expects" },
      { number: "05", label: "Error Handling", hint: "try/except/else/finally; raising custom exceptions; context managers" },
    ]} />
  ),

  /* java-interview-questions-india-2026: Java topics breakdown */
  "java-interview-questions-india-2026||Core Java questions most tested in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "OOP Pillars", hint: "Encapsulation, inheritance, polymorphism, abstraction — with Java examples" },
      { number: "02", label: "String Internals", hint: "String pool, StringBuilder vs StringBuffer, immutability" },
      { number: "03", label: "equals() and hashCode()", hint: "Contract — if equals is true, hashCodes must match; used in HashMap" },
      { number: "04", label: "Exception Hierarchy", hint: "Checked vs unchecked; when to use each; custom exceptions" },
      { number: "05", label: "JVM Memory", hint: "Heap vs stack; Eden, Survivor, Old Gen; GC types (G1, ZGC)" },
    ]} />
  ),

  /* system-design-interview-beginner-india-2026: 6-step SD framework */
  "system-design-interview-beginner-india-2026||The 6-step framework for any system design question": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify Scope", hint: "Ask about users, features, scale — never assume, always confirm" },
      { number: "02", label: "Capacity Estimation", hint: "QPS, storage, bandwidth back-of-envelope in 2 minutes" },
      { number: "03", label: "System Interface", hint: "Define core APIs before designing infrastructure" },
      { number: "04", label: "Data Model", hint: "Tables, relationships, choice of SQL vs NoSQL" },
      { number: "05", label: "High-Level Design", hint: "Draw the boxes: CDN, LB, servers, cache, DB" },
      { number: "06", label: "Deep Dive", hint: "Pick 1–2 hard problems (hot keys, replication lag) and go deep" },
    ]} />
  ),

  /* data-structures-algorithms-india-interview-2026: 8-week prep plan */
  "data-structures-algorithms-india-interview-2026||Week-by-Week Preparation Plan (8 Weeks)": (
    <PrepTimeline caption="8-week DSA preparation plan for Indian interviews" phases={[
      { period: "Week 1–2", label: "Arrays, Strings & Hashing", tasks: ["Two pointers, prefix sum, sliding window", "HashMap frequency counting", "Binary search variations"], milestone: "Foundations solid" },
      { period: "Week 3–4", label: "Trees & Linked Lists", tasks: ["BST insert, delete, search", "Tree traversals (BFS, DFS)", "Linked list reversal, cycle detection"], milestone: "Tree & list problems fluent" },
      { period: "Week 5–6", label: "Graphs & Dynamic Programming", tasks: ["BFS/DFS, topological sort, union-find", "1D DP, 2D DP, knapsack pattern"], milestone: "Core DP patterns memorised" },
      { period: "Week 7–8", label: "Heaps, Backtracking & Mocks", tasks: ["Top-K elements, merge K lists", "Permutations, subsets, N-Queens", "2 full timed mock interviews"], milestone: "Interview-ready" },
    ]} />
  ),

  /* react-interview-questions-india-2026: React hooks deep dive */
  "react-interview-questions-india-2026||React Hooks: The Core Interview Topic": (
    <FrameworkSteps steps={[
      { number: "01", label: "useState", hint: "Batching, functional updates, lazy initialiser pattern" },
      { number: "02", label: "useEffect", hint: "Cleanup, dependency array rules; common bug: missing deps" },
      { number: "03", label: "useMemo / useCallback", hint: "Memoisation — know when they add overhead vs help" },
      { number: "04", label: "useContext", hint: "Avoid prop drilling; performance pitfall of large context objects" },
      { number: "05", label: "Custom Hooks", hint: "Extract logic into reusable hooks; show a useFetch or useDebounce example" },
    ]} />
  ),

  /* typescript-interview-questions-india-2026: TypeScript key topics */
  "typescript-interview-questions-india-2026||TypeScript Basics: What Every Interview Tests": (
    <FrameworkSteps steps={[
      { number: "01", label: "Type vs Interface", hint: "Interface is extendable and mergeable; type supports unions and mapped types" },
      { number: "02", label: "Generics", hint: "Write reusable, type-safe functions and classes; constrain with extends" },
      { number: "03", label: "Union & Intersection Types", hint: "A | B vs A & B; discriminated unions for type narrowing" },
      { number: "04", label: "Utility Types", hint: "Partial, Required, Pick, Omit, Record, ReturnType — use these, don't rewrite" },
      { number: "05", label: "Type Guards", hint: "typeof, instanceof, in, custom type predicates (is Type)" },
    ]} />
  ),

  /* git-interview-questions-india-2026: Git workflow steps */
  "git-interview-questions-india-2026||Branching and Merging": (
    <FrameworkSteps steps={[
      { number: "01", label: "Feature Branches", hint: "branch per feature; short-lived branches merge faster with fewer conflicts" },
      { number: "02", label: "Merge vs Rebase", hint: "Merge preserves history; rebase creates linear history — know trade-offs" },
      { number: "03", label: "Squash Commits", hint: "Clean up WIP commits before merging into main" },
      { number: "04", label: "Conflict Resolution", hint: "Accept ours / theirs / both; always understand the code, don't just accept" },
      { number: "05", label: "Pull Request Workflow", hint: "Branch → PR → review → CI green → merge — standard in Indian product companies" },
    ]} />
  ),

  /* docker-kubernetes-interview-questions-india-2026: container concepts */
  "docker-kubernetes-interview-questions-india-2026||Kubernetes Fundamentals": (
    <FrameworkSteps steps={[
      { number: "01", label: "Pod", hint: "Smallest deployable unit; 1 or more tightly coupled containers" },
      { number: "02", label: "Deployment", hint: "Desired state for pods; rolling updates and rollback built-in" },
      { number: "03", label: "Service", hint: "Stable network endpoint for a set of pods; ClusterIP / NodePort / LoadBalancer" },
      { number: "04", label: "ConfigMap & Secret", hint: "Decouple configuration from image; secrets are base64 encoded" },
      { number: "05", label: "Horizontal Pod Autoscaler", hint: "Scale pods based on CPU/memory or custom metrics" },
    ]} />
  ),

  /* programming-languages-india-job-market-2026: language salary comparison */
  "programming-languages-india-job-market-2026||Python: The Most Versatile Choice": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Python Developer (1–3 yrs)", min: 6, max: 16 },
      { role: "Java Developer (1–3 yrs)", min: 6, max: 15 },
      { role: "JavaScript/Node.js Developer (1–3 yrs)", min: 5, max: 14 },
      { role: "Go Developer (2–4 yrs)", min: 12, max: 28, note: "Smaller pool, higher premium" },
      { role: "Python ML Engineer (3–5 yrs)", min: 18, max: 45, note: "GenAI demand drives premium" },
    ]} caption="India 2026 — product companies; IT services pay 30–40% less" />
  ),

  /* acing-online-assessment-india-2026: OA strategy steps */
  "acing-online-assessment-india-2026||Time Management Strategy": (
    <FrameworkSteps steps={[
      { number: "01", label: "Read All Questions First", hint: "Spend 2 min scanning all problems; start with highest confidence, not first in list" },
      { number: "02", label: "Partial Credit First", hint: "A brute-force solution that passes 60% test cases beats zero — always submit something" },
      { number: "03", label: "Time Box per Problem", hint: "Allocate time per problem upfront; move on if stuck; return if time allows" },
      { number: "04", label: "Dry-Run Before Submit", hint: "Walk through 2 examples mentally; check array bounds and null cases" },
    ]} />
  ),

  /* interview-preparation-timeline-india-2026: 30/60/90 day plans */
  "interview-preparation-timeline-india-2026||30-Day Plan: Rapid Preparation for a Specific Opportunity": (
    <PrepTimeline caption="Tiered interview preparation timelines" phases={[
      { period: "30-Day Plan", label: "Rapid Prep (SDE-1 at IT/Mid-product)", tasks: ["Days 1–10: Arrays, strings, hashmap problems (30 problems)", "Days 11–20: Trees, linked lists, binary search", "Days 21–28: 5 STAR stories + company research", "Days 29–30: Mock interview + rest"], milestone: "Ready for IT services and mid-tier product companies" },
      { period: "60-Day Plan", label: "Standard Prep (SDE-1 / SDE-2)", tasks: ["Weeks 1–3: DSA foundations (75 problems)", "Weeks 4–6: Graphs, DP, system design basics", "Weeks 7–8: Company-tagged sets + 4 full mock interviews"], milestone: "Ready for Indian unicorns and FAANG India screens" },
      { period: "90-Day Plan", label: "FAANG / Top Unicorn Prep", tasks: ["Months 1–2: 150+ curated LeetCode problems, all patterns", "Month 3: System design (6 full walkthroughs), bar-raiser behavioral prep", "Weeks 11–12: 8 mock interviews, company-specific deep-dives"], milestone: "Ready for Google, Microsoft, Meta, Flipkart, PhonePe bar raiser" },
    ]} />
  ),

  /* angular-interview-questions-india-2026: Angular key topics */
  "angular-interview-questions-india-2026||Angular Fundamentals": (
    <FrameworkSteps steps={[
      { number: "01", label: "Modules & Components", hint: "NgModule, declarations, imports, providers; component lifecycle hooks" },
      { number: "02", label: "Dependency Injection", hint: "Hierarchical injectors; providedIn: 'root' vs module-level" },
      { number: "03", label: "Data Binding", hint: "Interpolation, property, event, and two-way binding with [(ngModel)]" },
      { number: "04", label: "Directives", hint: "Structural (*ngIf, *ngFor) vs attribute directives; custom directive creation" },
      { number: "05", label: "Change Detection", hint: "Default vs OnPush strategy; when to use OnPush for performance" },
    ]} />
  ),

  /* agile-scrum-interview-questions-india-2026: Scrum process */
  "agile-scrum-interview-questions-india-2026||Scrum Ceremonies": (
    <FrameworkSteps steps={[
      { number: "01", label: "Sprint Planning", hint: "Team selects backlog items; estimates using story points or T-shirt sizing" },
      { number: "02", label: "Daily Scrum", hint: "15-min standup: what I did, what I'll do, blockers" },
      { number: "03", label: "Sprint Review", hint: "Demo working software to stakeholders; gather feedback" },
      { number: "04", label: "Sprint Retrospective", hint: "What went well, what to improve, action items — held after review" },
      { number: "05", label: "Backlog Refinement", hint: "Ongoing session to groom and prioritise stories before next sprint" },
    ]} />
  ),

  /* testing-qa-interview-questions-india-2026: Automation framework design */
  "testing-qa-interview-questions-india-2026||Automation Framework Design": (
    <FrameworkSteps steps={[
      { number: "01", label: "Framework Type", hint: "Data-driven vs keyword-driven vs hybrid; most Indian companies use hybrid" },
      { number: "02", label: "Page Object Model", hint: "Separate UI locators from test logic; maintainability improves drastically" },
      { number: "03", label: "Test Runner", hint: "TestNG / JUnit for Java; pytest for Python; Jest for JS" },
      { number: "04", label: "Reporting", hint: "Allure / Extent Reports; attach screenshots on failure" },
      { number: "05", label: "CI Integration", hint: "Trigger tests on PR via GitHub Actions / Jenkins pipeline" },
    ]} />
  ),

  /* data-engineer-interview-questions-india-2026: data pipeline design */
  "data-engineer-interview-questions-india-2026||Data Pipeline Design (Apache Airflow)": (
    <FrameworkSteps steps={[
      { number: "01", label: "DAG Design", hint: "Define tasks as a directed acyclic graph; avoid complex branching" },
      { number: "02", label: "Operators", hint: "PythonOperator, BashOperator, SQLOperator, KubernetesPodOperator" },
      { number: "03", label: "Task Dependencies", hint: "upstream >> downstream; XCom for passing small values between tasks" },
      { number: "04", label: "Retry & SLA", hint: "Set retries, retry_delay, and SLA alerts for production pipelines" },
      { number: "05", label: "Scheduling", hint: "Cron expressions; backfill for reprocessing historical data" },
    ]} />
  ),

  /* java-spring-boot-interview-questions-india-2026: Spring Boot essentials */
  "java-spring-boot-interview-questions-india-2026||Spring Boot Essentials": (
    <FrameworkSteps steps={[
      { number: "01", label: "@SpringBootApplication", hint: "Combines @Configuration, @EnableAutoConfiguration, @ComponentScan" },
      { number: "02", label: "Dependency Injection", hint: "Constructor injection preferred over field injection in tests and production" },
      { number: "03", label: "application.properties / YAML", hint: "@Value, @ConfigurationProperties, profiles (dev/prod)" },
      { number: "04", label: "Spring Data JPA", hint: "Repository abstraction; @Entity, @Table, JPQL vs native queries" },
      { number: "05", label: "Spring Security", hint: "Filter chain, JWT auth, method-level security with @PreAuthorize" },
    ]} />
  ),

  /* machine-learning-interview-questions-india-2026: ML study topics */
  "machine-learning-interview-questions-india-2026||Algorithms and Model Selection": (
    <FrameworkSteps steps={[
      { number: "01", label: "Linear / Logistic Regression", hint: "Assumptions, regularisation (L1/L2), interpreting coefficients" },
      { number: "02", label: "Decision Trees & Ensembles", hint: "GINI vs entropy; Random Forest (bagging); XGBoost/LightGBM (boosting)" },
      { number: "03", label: "SVMs", hint: "Margin maximisation, kernel trick; when SVMs beat NNs" },
      { number: "04", label: "Clustering", hint: "K-Means (pick K with elbow), DBSCAN for arbitrary shapes" },
      { number: "05", label: "Neural Networks", hint: "Backprop, activation functions, batch norm, dropout" },
    ]} />
  ),

  /* devops-interview-questions-india-2026: DevOps topics */
  "devops-interview-questions-india-2026||CI/CD Pipelines": (
    <FrameworkSteps steps={[
      { number: "01", label: "Source Control Trigger", hint: "PR or push to main triggers the pipeline automatically" },
      { number: "02", label: "Build Stage", hint: "Compile, package (Maven/Gradle/npm build), create Docker image" },
      { number: "03", label: "Test Stage", hint: "Unit tests, integration tests, SAST security scan" },
      { number: "04", label: "Artefact Registry", hint: "Push image to ECR/GCR/Artifactory with immutable tag" },
      { number: "05", label: "Deploy Stage", hint: "Helm upgrade, kubectl apply, blue-green or canary release strategy" },
    ]} />
  ),

  /* product-thinking-interview-india-2026: Product metrics framework */
  "product-thinking-interview-india-2026||The Product Metrics Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Define North Star Metric", hint: "One metric that best captures user value (e.g., rides completed, messages sent)" },
      { number: "02", label: "Acquisition", hint: "How users discover and install / sign up" },
      { number: "03", label: "Activation", hint: "First value moment — what % of new users reach it?" },
      { number: "04", label: "Retention", hint: "D1, D7, D30 retention curves; cohort analysis" },
      { number: "05", label: "Revenue", hint: "ARPU, LTV, payback period; conversion from free to paid" },
    ]} />
  ),

  /* sql-interview-questions-india-2026: SQL window functions */
  "sql-interview-questions-india-2026||Window Functions": (
    <FrameworkSteps steps={[
      { number: "01", label: "ROW_NUMBER()", hint: "Unique sequential number per partition; use for deduplication" },
      { number: "02", label: "RANK() vs DENSE_RANK()", hint: "RANK leaves gaps in ties; DENSE_RANK does not — know when each matters" },
      { number: "03", label: "LAG() / LEAD()", hint: "Access previous/next row value without self-join" },
      { number: "04", label: "SUM() / AVG() OVER", hint: "Running totals and sliding averages; ROWS vs RANGE framing" },
      { number: "05", label: "NTILE(n)", hint: "Divide rows into n buckets — used in percentile calculations" },
    ]} />
  ),

  /* ── Career ── */
  /* notice-period-india-it-resignation-guide-2026: Step-by-step resignation process */
  "notice-period-india-it-resignation-guide-2026||How to Resign: Step by Step": (
    <FrameworkSteps steps={[
      { number: "01", label: "Inform Your Manager First", hint: "Tell your direct manager verbally before anyone else hears — do not resign via email first or to HR directly" },
      { number: "02", label: "Submit Written Resignation", hint: "Send a formal email to your manager, CC HR, with your last working day calculated from your contract notice period" },
      { number: "03", label: "Negotiate Notice Period", hint: "If you need to leave early, discuss buyout terms immediately — most companies accept 50–100% of remaining notice salary" },
      { number: "04", label: "Complete Handover", hint: "Document your work, hand off projects, and get sign-off from your manager — this protects your relieving letter" },
      { number: "05", label: "Collect Exit Documents", hint: "Ensure you receive your experience letter, relieving letter, and Form 16 before your last day" },
    ]} />
  ),

  /* notice-period-india-it-resignation-guide-2026: Notice period comparison across major IT companies */
  "notice-period-india-it-resignation-guide-2026||Notice Period by Company in India 2026": (
    <ComparisonTable
      columns={[{ name: "Company" }, { name: "Notice Period" }, { name: "Buyout Allowed?", highlight: true }, { name: "Notes" }]}
      rows={[
        { label: "TCS", values: ["90 days", "Yes (partial)", "Bond conditions may apply"] },
        { label: "Infosys", values: ["90 days", "Yes", "SP track: 60 days"] },
        { label: "Wipro", values: ["90 days", "Yes", "Elite NLTH: 90 days bond period"] },
        { label: "HCL", values: ["60–90 days", "Yes", "Varies by band"] },
        { label: "Cognizant", values: ["60–90 days", "Yes", "GenC: 6-month lock-in"] },
        { label: "Flipkart / Swiggy / Zomato", values: ["30–60 days", "Yes", "Product companies: shorter"] },
        { label: "Google / Microsoft / Amazon", values: ["30–60 days", "Rarely needed", "Often gardening leave paid"] },
      ]}
      caption="Notice periods as per standard employment contracts in India 2026. Verify your specific letter of appointment."
    />
  ),

  /* faang-maang-india-meaning-companies-2026: Salary comparison FAANG vs Indian product */
  "faang-maang-india-meaning-companies-2026||FAANG India Salary vs Indian Product Companies": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "Google / Meta / Microsoft (SWE-2/SDE-2)", min: 45, max: 110, note: "Base + RSU + bonus" },
      { role: "Amazon India (SDE-2)", min: 35, max: 75, note: "High RSU component" },
      { role: "Flipkart / PhonePe (SDE-2)", min: 28, max: 60, note: "RSUs at scale" },
      { role: "Razorpay / CRED / Swiggy (SDE-2)", min: 24, max: 50, note: "Pre-IPO equity upside" },
      { role: "Freshworks / MakeMyTrip (SDE-2)", min: 18, max: 38, note: "Listed company RSUs" },
      { role: "IT Services (Infosys/TCS/Wipro) — 3 yrs", min: 7, max: 14, note: "Predictable increments" },
    ]} caption="Total compensation benchmarks for 3–5 years experience, India 2026. Source: Levels.fyi, Glassdoor, AmbitionBox" />
  ),

  /* faang-maang-india-meaning-companies-2026: Realistic path to FAANG */
  "faang-maang-india-meaning-companies-2026||Realistic Path to FAANG India in 2–3 Years": (
    <PrepTimeline caption="2–3 year roadmap from IT services / mid-tier to FAANG India" phases={[
      { period: "Month 1–3", label: "Assess and Plan", tasks: ["Audit DSA gaps with LeetCode easy/medium", "Identify target role: SDE-1 vs SDE-2", "Start daily 1-hour DSA practice"], milestone: "Baseline: 50 LeetCode problems solved" },
      { period: "Month 4–8", label: "DSA and CS Fundamentals", tasks: ["Complete arrays, trees, graphs, DP patterns", "Study system design fundamentals", "Solve 150+ LeetCode medium problems"], milestone: "Crack 2–3 mid-tier product company offers" },
      { period: "Month 9–15", label: "Targeted FAANG Prep", tasks: ["Mock interviews with peer or AI coach", "System design deep-dives (HLD + LLD)", "Behavioral stories using Amazon LPs as framework"], milestone: "Schedule FAANG India applications" },
      { period: "Month 16–24", label: "Apply and Iterate", tasks: ["Apply via referrals (first choice) and careers page", "Debrief every rejection systematically", "Re-apply: FAANG allows re-attempts after 6 months"], milestone: "FAANG India offer in hand" },
    ]} />
  ),

  /* resignation-letter-format-india-2026: Step-by-step resignation process */
  "resignation-letter-format-india-2026||Common Mistakes That Create Problems Later": (
    <FrameworkSteps steps={[
      { number: "01", label: "Never Resign Verbally Only", hint: "Always follow up with a written email — verbal resignations have no legal standing and cause disputes on your last working day" },
      { number: "02", label: "Don't Skip the Notice Period Date", hint: "Your email must state your last working day explicitly, calculated correctly from your contract — wrong dates delay F&F settlement" },
      { number: "03", label: "Avoid Burning Bridges in the Letter", hint: "Resignation letters are permanent records — keep them neutral and professional regardless of your reason for leaving" },
      { number: "04", label: "Don't Leave Without a Relieving Letter", hint: "Follow up on your relieving letter before your last day — missing this document blocks BGV at your next company" },
      { number: "05", label: "Confirm F&F Timeline in Writing", hint: "Get written confirmation of your Full and Final settlement date — Indian companies legally must pay within 30–45 days of separation" },
    ]} />
  ),

  /* fresher-resume-format-india-2026: Resume section order framework */
  "fresher-resume-format-india-2026||The One-Page Fresher Resume: Structure and Section Order": (
    <FrameworkSteps steps={[
      { number: "01", label: "Contact Header", hint: "Name, phone, email, LinkedIn URL, GitHub — no photo, no date of birth, no gender (illegal to ask in most states)" },
      { number: "02", label: "Education", hint: "Degree, college, graduation year, CGPA — for freshers, education comes before experience since you have none" },
      { number: "03", label: "Projects (2–3 entries)", hint: "Each project: 2–3 bullet points with tech stack, what you built, and quantified outcome — this is your most important section" },
      { number: "04", label: "Skills", hint: "Languages, frameworks, databases, tools — only list what you can answer interview questions on; avoid padding with basic MS Office" },
      { number: "05", label: "Internships / Experience", hint: "If any, list with company, role, dates, and 2–3 outcome-focused bullets — even 2-month internships count" },
      { number: "06", label: "Certifications and Achievements", hint: "Hackathon wins, competitive coding ranks, relevant certifications — keep to genuinely impressive items only" },
    ]} />
  ),

  /* interview-preparation-tips-india-2026: Interview preparation timeline */
  "interview-preparation-tips-india-2026||Interview Preparation Timeline: When to Start": (
    <PrepTimeline caption="Recommended preparation timelines for Indian tech interviews in 2026" phases={[
      { period: "12 Weeks Out", label: "Foundation Phase", tasks: ["Start DSA from scratch or audit gaps", "Set daily 2-hour practice routine", "Pick primary language (Java/Python/C++)"], milestone: "100 LeetCode easy problems done" },
      { period: "8 Weeks Out", label: "Core Building Phase", tasks: ["Arrays, strings, trees, graphs, DP", "Begin system design reading (DDIA, Grokking)", "Start collecting behavioral STAR stories"], milestone: "150 LeetCode medium problems done" },
      { period: "4 Weeks Out", label: "Company-Specific Prep", tasks: ["Research target company interview patterns", "Mock interviews 3x per week", "Review past behavioral answers aloud"], milestone: "First mock interview completed" },
      { period: "1 Week Out", label: "Taper and Polish", tasks: ["Light revision only — no new topics", "Solve 2–3 familiar problems daily", "Prepare questions to ask the interviewer"], milestone: "Interview-ready" },
    ]} />
  ),

  /* campus-placement-preparation-india-2026: Month-by-month preparation plan */
  "campus-placement-preparation-india-2026||Month-by-Month Preparation Plan for Placements": (
    <PrepTimeline caption="Campus placement preparation roadmap for 2026 batch students" phases={[
      { period: "6th Sem (Jan–Apr)", label: "Build Foundations", tasks: ["Start DSA: arrays, strings, sorting, recursion", "Complete one MOOC project to list on resume", "Open LeetCode account, target 50 easy problems"], milestone: "Resume draft ready" },
      { period: "Summer (May–Jul)", label: "Internship or Intensive Prep", tasks: ["Intern if possible — PPO is the best placement outcome", "Without internship: 150+ LeetCode medium problems", "Learn DBMS, OS, CN basics for technical interviews"], milestone: "Technical foundation solid" },
      { period: "7th Sem (Aug–Sep)", label: "Aptitude and Company Research", tasks: ["Start aptitude practice: quant, verbal, logical", "GD practice with study group weekly", "Mock placement drives at college or online"], milestone: "Aptitude test score consistently above 80%" },
      { period: "Peak Season (Oct–Dec)", label: "Active Placement", tasks: ["Apply to every shortlist; prioritise dream companies later", "Debrief every interview the same day", "Keep at least 2 backup offers before declining"], milestone: "Placement offer in hand" },
    ]} />
  ),

  /* campus-placement-preparation-india-2026: Company tiers */
  "campus-placement-preparation-india-2026||Campus Placement Season: Timeline and Company Tiers": (
    <TierCompare cards={[
      {
        tier: "Tier 1 (Dream Companies)",
        examples: "Google · Microsoft · Amazon · Goldman Sachs",
        rows: [
          { label: "CTC Range", range: "₹20–60+ LPA" },
          { label: "When They Visit", range: "Day 1 (Oct/Nov)" },
          { label: "Filter", range: "CGPA 7.5+, strong DSA" },
          { label: "Prep Time Needed", range: "6+ months" },
        ]
      },
      {
        tier: "Tier 2 (Core IT Product)",
        examples: "Flipkart · Razorpay · Freshworks · PhonePe",
        rows: [
          { label: "CTC Range", range: "₹12–30 LPA" },
          { label: "When They Visit", range: "Oct–Dec" },
          { label: "Filter", range: "CGPA 6.5+, medium DSA" },
          { label: "Prep Time Needed", range: "3–4 months" },
        ]
      },
      {
        tier: "Tier 3 (IT Services)",
        examples: "TCS · Infosys · Wipro · Cognizant · HCL",
        rows: [
          { label: "CTC Range", range: "₹3.5–8 LPA" },
          { label: "When They Visit", range: "Dec–Feb" },
          { label: "Filter", range: "CGPA 6.0+, aptitude test" },
          { label: "Prep Time Needed", range: "1–2 months" },
        ]
      },
    ]} />
  ),

  /* placement-experience-what-to-expect-india-2026: What to expect on placement day */
  "placement-experience-what-to-expect-india-2026||Placement Day Morning: What Actually Happens": (
    <FrameworkSteps steps={[
      { number: "01", label: "Report and Register", hint: "Arrive 30 min before reporting time, carry physical copies of resume and photo ID — many companies still require paper copies" },
      { number: "02", label: "Pre-Placement Talk (PPT)", hint: "Company presents their culture and role — take notes on specifics to use in 'Why this company' answers later in the day" },
      { number: "03", label: "Online Assessment / Aptitude Round", hint: "Usually 60–90 min: quant, logical, verbal, and 1–2 coding problems — shortlist announced within 2–4 hours" },
      { number: "04", label: "Technical Interview Rounds", hint: "1–3 rounds of 45–60 min each — DSA, CS fundamentals, and project discussion; can happen back-to-back with no break" },
      { number: "05", label: "HR Round", hint: "Usually same day, 20–30 min — salary expectation, notice period, relocation willingness, and culture fit questions" },
    ]} />
  ),

  /* video-interview-tips-body-language-india: Setup and body language steps */
  "video-interview-tips-body-language-india||The Setup That Signals Professionalism": (
    <FrameworkSteps steps={[
      { number: "01", label: "Camera at Eye Level", hint: "Laptop on books or a stand so the camera is at eye level — looking down at the camera makes you appear condescending" },
      { number: "02", label: "Light Your Face from the Front", hint: "Place a lamp or window in front of you, not behind — backlight turns you into a silhouette on the interviewer's screen" },
      { number: "03", label: "Clean, Neutral Background", hint: "Plain wall or a tidy bookshelf; virtual backgrounds blur and distort — they signal you are hiding something or lack a suitable space" },
      { number: "04", label: "Wired Headphones for Audio", hint: "Earbuds with mic beat laptop speakers — they eliminate echo, reduce background noise, and keep audio stable throughout" },
      { number: "05", label: "Test 30 Minutes Before", hint: "Join the platform early, test camera and mic, close unnecessary apps, silence phone notifications, and have water nearby" },
    ]} />
  ),

  /* notice-period-negotiation-india-guide: Notice period negotiation steps */
  "notice-period-negotiation-india-guide||Negotiating With Your Current Employer": (
    <FrameworkSteps steps={[
      { number: "01", label: "Request Early Relieving in Writing", hint: "Send a formal email to HR requesting early release with a specific date — oral requests are often 'forgotten'" },
      { number: "02", label: "Propose Knowledge Transfer Plan", hint: "Offer to complete handover of all critical work within a compressed timeline — employers are far more likely to agree if they see continuity" },
      { number: "03", label: "Offer Partial Buyout If Needed", hint: "Calculate your remaining notice salary and offer to pay a portion — most companies accept 50–100% of the remaining days' salary" },
      { number: "04", label: "Escalate to Manager If HR Delays", hint: "If HR is unresponsive, ask your direct manager to support the early release — manager approval carries more weight in practice" },
      { number: "05", label: "Get Release Date in Writing", hint: "Any verbal agreement means nothing — get the agreed last working date confirmed via email from HR before informing your new employer" },
    ]} />
  ),

  /* how-to-get-referral-top-indian-tech-companies: Referral outreach steps */
  "how-to-get-referral-top-indian-tech-companies||The Referral Outreach Message That Works": (
    <FrameworkSteps steps={[
      { number: "01", label: "Find the Right Person", hint: "Target someone at the same company in a similar team — LinkedIn 2nd-degree connections, alumni networks, and Twitter/X are the best sources" },
      { number: "02", label: "Personalise Before Asking", hint: "Comment on their posts or share their content for 1–2 weeks before reaching out cold — warm outreach converts 3–4x better" },
      { number: "03", label: "Lead With Value, Not Request", hint: "In your first message: mention a specific thing you admire about their work or company, then briefly introduce yourself — ask for a referral only after rapport is established" },
      { number: "04", label: "Make It Easy to Refer You", hint: "Attach your resume, the exact job link, and a 3-line summary of why you are a fit — the referrer should need zero effort beyond clicking submit" },
      { number: "05", label: "Follow Up Once, Respectfully", hint: "If no reply after 5 days, send one follow-up. If still no reply, move on — persisting further damages the relationship permanently" },
    ]} />
  ),

  /* startup-vs-mnc-india-career-choice-guide: Startup vs MNC comparison */
  "startup-vs-mnc-india-career-choice-guide||What the Comparison Actually Looks Like in 2026": (
    <TierCompare cards={[
      {
        tier: "Early-Stage Startup (Series A–B)",
        examples: "Pre-IPO fintechs · D2C brands · SaaS startups",
        rows: [
          { label: "Base Salary", range: "10–20% below market" },
          { label: "ESOP Upside", range: "High risk, high reward" },
          { label: "Learning Speed", range: "Very fast — wear many hats" },
          { label: "Job Security", range: "Low — funding-dependent" },
          { label: "Brand Value", range: "Low now, high if IPO" },
        ]
      },
      {
        tier: "Indian Product Unicorn",
        examples: "Swiggy · PhonePe · Razorpay · Meesho",
        rows: [
          { label: "Base Salary", range: "Market or above" },
          { label: "ESOP Upside", range: "Moderate — pre-IPO stage" },
          { label: "Learning Speed", range: "Fast — at scale" },
          { label: "Job Security", range: "Moderate" },
          { label: "Brand Value", range: "High in India market" },
        ]
      },
      {
        tier: "Large MNC (IT Services / Global Tech)",
        examples: "TCS · Infosys · Microsoft · Google",
        rows: [
          { label: "Base Salary", range: "Stable, defined bands" },
          { label: "ESOP Upside", range: "RSUs (listed); lower upside" },
          { label: "Learning Speed", range: "Slower — specialised" },
          { label: "Job Security", range: "High" },
          { label: "Brand Value", range: "Strong globally" },
        ]
      },
    ]} />
  ),

  /* startup-vs-mnc-india-career-choice-guide: Salary comparison */
  "startup-vs-mnc-india-career-choice-guide||Salary and Compensation Reality": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "FAANG India (SDE-2, 3–5 yrs)", min: 45, max: 80, note: "Base + RSU + bonus" },
      { role: "Indian Unicorn SDE-2 (Swiggy/PhonePe)", min: 25, max: 50, note: "Base + pre-IPO ESOPs" },
      { role: "Series A–B Startup (SDE-2)", min: 15, max: 30, note: "Base below market + ESOPs" },
      { role: "IT Services Senior Dev (5 yrs, TCS/Infosys)", min: 8, max: 18, note: "Slow increment model" },
      { role: "Fresher — Product Company", min: 10, max: 22, note: "Strong starting package" },
      { role: "Fresher — IT Services", min: 3.5, max: 7, note: "Standard market entry" },
    ]} caption="CTC ranges for Indian tech professionals in 2026. Source: Glassdoor, AmbitionBox, Levels.fyi" />
  ),

  /* gate-vs-mba-vs-ms-abroad-indian-engineers-2026: Decision framework comparison */
  "gate-vs-mba-vs-ms-abroad-indian-engineers-2026||The Decision Framework": (
    <TierCompare cards={[
      {
        tier: "GATE + M.Tech / PSU",
        examples: "IITs · NITs · BHEL · ONGC · NTPC",
        rows: [
          { label: "Total Cost", range: "₹1–5 L (IIT M.Tech)" },
          { label: "Time Investment", range: "2 years + GATE prep" },
          { label: "Salary After", range: "₹8–25 LPA (IIT) / ₹7–15 LPA (PSU)" },
          { label: "Best For", range: "Research, PSU job security" },
        ]
      },
      {
        tier: "MBA from IIM / ISB",
        examples: "IIM A/B/C · ISB Hyderabad · IIM Calcutta",
        rows: [
          { label: "Total Cost", range: "₹20–35 L (IIM A) / ₹35 L (ISB)" },
          { label: "Time Investment", range: "2 years + CAT/GMAT prep" },
          { label: "Salary After", range: "₹25–50 LPA median" },
          { label: "Best For", range: "Consulting, VC, PM, leadership" },
        ]
      },
      {
        tier: "MS Abroad (USA/Canada/Europe)",
        examples: "Carnegie Mellon · Georgia Tech · TU Munich",
        rows: [
          { label: "Total Cost", range: "₹40–90 L (USA) / ₹25–50 L (Europe)" },
          { label: "Time Investment", range: "1.5–2 years + GRE/IELTS" },
          { label: "Salary After", range: "$120–180K USD (US tech)" },
          { label: "Best For", range: "FAANG US, AI/ML specialisation" },
        ]
      },
    ]} />
  ),

  /* interview-anxiety-tips-india-2026: Managing interview anxiety */
  "interview-anxiety-tips-india-2026||The Week Before: Preparation That Reduces Anxiety": (
    <FrameworkSteps steps={[
      { number: "01", label: "Switch to Revision Mode", hint: "Stop learning new topics 5 days before — attempting new problems increases anxiety; revising familiar patterns builds confidence" },
      { number: "02", label: "Do One Full Mock Interview", hint: "Simulate the real interview: timed, camera on, whiteboard — anxious candidates who've done mocks perform measurably better on the real day" },
      { number: "03", label: "Prepare Your Logistics", hint: "Confirm venue or video link, outfit, commute route, and backup phone battery — logistical surprises on interview day amplify anxiety" },
      { number: "04", label: "Sleep 7+ Hours the Night Before", hint: "Sleep deprivation reduces working memory by 30–40% — your problem-solving speed and recall directly depend on the night before" },
      { number: "05", label: "Prepare Your 'Why' Statement", hint: "Remind yourself why you want this role — connecting to purpose reduces performance anxiety better than any tactical tip" },
    ]} />
  ),

  /* remote-jobs-india-how-to-find-2026: Compensation for remote roles */
  "remote-jobs-india-how-to-find-2026||Compensation for Remote Roles in India": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Remote US/EU employer (SDE-2, 3–5 yrs)", min: 40, max: 100, note: "USD salary, India cost base" },
      { role: "Remote Indian unicorn (SDE-2)", min: 22, max: 50, note: "Same as in-office + no commute" },
      { role: "Remote product startup India (SDE-2)", min: 15, max: 30, note: "ESOPs may supplement" },
      { role: "Remote IT services / consulting (3–5 yrs)", min: 9, max: 18, note: "WFH allowance common" },
      { role: "Fresher remote role (Indian company)", min: 5, max: 12, note: "Rare but increasing" },
    ]} caption="Remote work compensation benchmarks for Indian software engineers in 2026" />
  ),

  /* career-change-to-software-engineering-india-2026: Skill roadmap for switching */
  "career-change-to-software-engineering-india-2026||The skill roadmap for a successful switch": (
    <PrepTimeline caption="6–18 month roadmap for switching to software engineering in India" phases={[
      { period: "Month 1–2", label: "Pick Your Stack", tasks: ["Choose one language (Python for data/scripting, JavaScript for web)", "Complete one beginner course end-to-end (CS50, The Odin Project)", "Build your first project: a simple CRUD web app"], milestone: "First working project on GitHub" },
      { period: "Month 3–5", label: "Build Real Projects", tasks: ["Build 2–3 portfolio projects solving real problems from your previous domain", "Learn SQL, basic system concepts, Git workflow", "Start LeetCode easy problems — 30 problems minimum"], milestone: "Portfolio with 3 projects live" },
      { period: "Month 6–9", label: "Interview Preparation", tasks: ["DSA: arrays, strings, trees — 80–100 LeetCode medium", "Apply for junior roles and internships simultaneously", "Mock interviews via peers or AI coaching"], milestone: "First interview callbacks received" },
      { period: "Month 10–18", label: "Land the First Role", tasks: ["Apply broadly: services companies accept switchers with strong projects", "Use domain knowledge as differentiator in cover letters", "Leverage previous industry connections for referrals"], milestone: "First SWE role offer accepted" },
    ]} />
  ),

  /* internship-to-fulltime-conversion-tips-india-2026: PPO strategies */
  "internship-to-fulltime-conversion-tips-india-2026||Strategies to maximise your PPO chances": (
    <FrameworkSteps steps={[
      { number: "01", label: "Ship Something Real in Week 1", hint: "Make your first commit to production code in the first week — interns who contribute code early are remembered as contributors, not observers" },
      { number: "02", label: "Communicate Progress Proactively", hint: "Send a short weekly update to your manager — it creates a paper trail of your impact and keeps you top of mind during PPO decisions" },
      { number: "03", label: "Ask for More Scope", hint: "Once your first task is done, ask: 'What would make this 10x better?' — interns who show initiative get extended or converted; those who wait for instructions do not" },
      { number: "04", label: "Build Relationships Beyond Your Team", hint: "Have coffee chats with senior engineers and PMs — PPO decisions sometimes require cross-team buy-in, and relationships protect you" },
      { number: "05", label: "Ask About Conversion Timeline Early", hint: "In week 6 (of a 2-month internship), ask your manager directly: 'What does a successful conversion look like here?' — clarity lets you target your remaining weeks precisely" },
    ]} />
  ),

  /* how-to-become-product-manager-india-2026: Paths to PM */
  "how-to-become-product-manager-india-2026||The main paths to PM in India": (
    <TierCompare cards={[
      {
        tier: "APM Programme (Fresh Grad)",
        examples: "Google · LinkedIn · Razorpay · Swiggy APM",
        rows: [
          { label: "Eligibility", range: "Top-tier college, 0–1 yr exp" },
          { label: "Salary", range: "₹18–40 LPA" },
          { label: "Timeline", range: "Immediate after graduation" },
          { label: "Competition", range: "Very high — 1000:1 ratio" },
        ]
      },
      {
        tier: "Engineer → PM Transition",
        examples: "Most product companies accept",
        rows: [
          { label: "Eligibility", range: "2–5 yrs SWE experience" },
          { label: "Salary", range: "₹20–45 LPA (mid PM)" },
          { label: "Timeline", range: "Internal transfer or new company" },
          { label: "Competition", range: "Moderate — unique profile" },
        ]
      },
      {
        tier: "MBA → PM (IIM/ISB)",
        examples: "Consulting, large MNCs",
        rows: [
          { label: "Eligibility", range: "IIM A/B/C or ISB grad" },
          { label: "Salary", range: "₹30–60 LPA" },
          { label: "Timeline", range: "2 yrs MBA + placement" },
          { label: "Competition", range: "High among MBA cohort" },
        ]
      },
    ]} />
  ),

  /* how-to-become-product-manager-india-2026: PM salaries */
  "how-to-become-product-manager-india-2026||Product Manager salaries in India 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Senior PM / Group PM (FAANG India, 7+ yrs)", min: 50, max: 80, note: "Base + RSU + bonus" },
      { role: "PM II / Senior PM (Indian unicorn, 5+ yrs)", min: 30, max: 55, note: "Pre-IPO equity common" },
      { role: "PM I / Mid PM (Indian unicorn, 3–5 yrs)", min: 18, max: 35, note: "Market-standard" },
      { role: "APM / Junior PM (0–2 yrs)", min: 12, max: 22, note: "Often post-IIM/APM programme" },
    ]} caption="PM salary benchmarks in India 2026. Source: Glassdoor, LinkedIn Salary, AmbitionBox" />
  ),

  /* open-source-contribution-india-career-2026: Steps for open source contributions */
  "open-source-contribution-india-career-2026||Where to start: projects for Indian engineers": (
    <FrameworkSteps steps={[
      { number: "01", label: "Start With 'Good First Issue'", hint: "Filter any GitHub repo by label 'good first issue' or 'hacktoberfest' — these are explicitly maintained for newcomers and have active maintainer support" },
      { number: "02", label: "Target Repos You Already Use", hint: "Fixing bugs or improving docs in tools you use daily (React, Django, Supabase) means you already understand the codebase enough to contribute meaningfully" },
      { number: "03", label: "Fix Documentation First", hint: "Documentation PRs are accepted fastest, build your credibility with maintainers, and still appear on your GitHub contribution graph — underrated as a starting point" },
      { number: "04", label: "Join Indian Open Source Communities", hint: "GirlScript Summer of Code, FOSSASIA, and the FOSS United community in India run structured programmes with mentors — significantly easier than cold contributions" },
      { number: "05", label: "Apply to GSoC or Outreachy", hint: "Both programmes pay stipends ($1,500–$6,000) and carry significant weight on resumes — applications open December–January for the following summer" },
    ]} />
  ),

  /* first-job-india-tips-freshers-2026: First 30 days strategy */
  "first-job-india-tips-freshers-2026||The first 30 days: earn the right to be here": (
    <FrameworkSteps steps={[
      { number: "01", label: "Learn Before You Contribute", hint: "Spend the first 2 weeks reading code, documentation, and past PRs — understanding why decisions were made matters more than shipping fast" },
      { number: "02", label: "Set Up Your Development Environment", hint: "Get your local environment fully working, run the test suite, and push a small PR (even a typo fix) — this proves you can ship to production" },
      { number: "03", label: "Map the People, Not Just the Code", hint: "Identify who owns what: the PM, tech lead, QA, and on-call rotation — in Indian companies, relationships unlock resources faster than process" },
      { number: "04", label: "Over-Communicate Your Progress", hint: "Send daily Slack updates to your manager in the first month — visibility matters enormously in Indian tech culture, especially in hybrid or remote setups" },
      { number: "05", label: "Ask Questions Systematically", hint: "Batch your questions: 1 hour of research first, then ask — 'I tried X and Y; I'm stuck on Z' shows initiative and respects senior engineers' time" },
    ]} />
  ),

  /* work-life-balance-indian-tech-2026: What to ask and how to evaluate */
  "work-life-balance-indian-tech-2026||What to ask in interviews to assess work culture": (
    <FrameworkSteps steps={[
      { number: "01", label: "Ask About On-Call Rotation", hint: "'How is on-call structured?' — whether it's paid, how frequently engineers are on-call, and whether there's compensation reveals a lot about how the company values engineer time" },
      { number: "02", label: "Ask About the Last Unplanned Weekend", hint: "'When was the last time the team worked on a weekend unexpectedly?' — the specificity of the answer reveals whether this is routine or rare" },
      { number: "03", label: "Ask How Engineers Disconnect on Vacation", hint: "'Do people fully disconnect on leave, or are they expected to be reachable?' — companies with healthy cultures answer this confidently and quickly" },
      { number: "04", label: "Check Glassdoor Reviews for Patterns", hint: "Look for recurring themes in 1-star and 2-star reviews from engineers — individual reviews may be outliers, but patterns across 20+ reviews are usually accurate" },
    ]} />
  ),

  /* how-to-read-job-description-india-2026: Resume tailoring steps */
  "how-to-read-job-description-india-2026||How to tailor your resume to a JD": (
    <FrameworkSteps steps={[
      { number: "01", label: "Highlight Keywords in the JD", hint: "Copy the JD into a doc, highlight every technical skill and tool — these exact words must appear in your resume's skills section and project bullets" },
      { number: "02", label: "Match Your Bullets to Their Priorities", hint: "The JD lists responsibilities in order of importance — reorder your resume bullets so your most relevant experience appears first in each entry" },
      { number: "03", label: "Mirror Their Language", hint: "If the JD says 'distributed systems' use that phrase, not 'scalable backend' — ATS systems do exact keyword matching, not semantic search, at many Indian companies" },
      { number: "04", label: "Add a Targeted Summary", hint: "A 2-line summary at the top that mirrors the role title and key requirements increases ATS scores and gives human reviewers immediate context" },
    ]} />
  ),

  /* data-scientist-vs-ml-engineer-india-2026: Role and salary comparison */
  "data-scientist-vs-ml-engineer-india-2026||Salaries and career paths": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "ML Engineer — FAANG India / AI Labs (5+ yrs)", min: 35, max: 70, note: "Highest compensation band" },
      { role: "ML Engineer — Indian Unicorn (3–5 yrs)", min: 20, max: 40, note: "Strong demand for production ML" },
      { role: "Data Scientist — FAANG India (4+ yrs)", min: 25, max: 55, note: "Research-heavy, PhD premium" },
      { role: "Data Scientist — Indian Unicorn (3–5 yrs)", min: 15, max: 32, note: "Analytics + modelling blend" },
      { role: "ML / DS Fresher (tier-1 college)", min: 10, max: 20, note: "Strong NLP/CV projects needed" },
      { role: "Data Analyst (analytics focus)", min: 6, max: 18, note: "Distinct from DS/MLE track" },
    ]} caption="Salary benchmarks for data science and ML roles in India 2026. Source: Glassdoor, AmbitionBox, Levels.fyi" />
  ),

  /* data-scientist-vs-ml-engineer-india-2026: Skills comparison */
  "data-scientist-vs-ml-engineer-india-2026||Skills required for each role": (
    <TierCompare cards={[
      {
        tier: "Data Scientist",
        examples: "Swiggy · Flipkart · HDFC · Accenture Analytics",
        rows: [
          { label: "Core Skill", range: "Statistics, hypothesis testing" },
          { label: "Programming", range: "Python, R, SQL" },
          { label: "ML Depth", range: "Model selection, evaluation" },
          { label: "Communication", range: "Business storytelling, dashboards" },
          { label: "Tools", range: "Jupyter, Tableau, Looker, Spark" },
        ]
      },
      {
        tier: "ML Engineer",
        examples: "Google · Sarvam · ShareChat · Meesho",
        rows: [
          { label: "Core Skill", range: "ML systems, model serving" },
          { label: "Programming", range: "Python, C++ (some roles)" },
          { label: "ML Depth", range: "MLOps, model optimisation" },
          { label: "Communication", range: "Technical design docs, APIs" },
          { label: "Tools", range: "PyTorch, Kubernetes, Airflow, Ray" },
        ]
      },
    ]} />
  ),

  /* how-to-get-shortlisted-resume-india-2026: Resume improvement framework */
  "how-to-get-shortlisted-resume-india-2026||What makes Indian resumes fail: and how to fix it": (
    <FrameworkSteps steps={[
      { number: "01", label: "Remove Objective Statements", hint: "'Seeking a challenging position...' wastes the most-read section of your resume — replace with a 2-line professional summary with your stack and years of experience" },
      { number: "02", label: "Quantify Every Bullet Point", hint: "'Improved API performance' fails; 'Reduced API latency by 40% (from 800ms to 480ms) serving 2M daily requests' is shortlist-worthy — every bullet needs a number" },
      { number: "03", label: "Fix the Skills Section", hint: "List only tools you can answer interview questions on; remove 'MS Office', 'Photoshop', and 'good communication' — they signal a low-effort resume to Indian screeners" },
      { number: "04", label: "Use Standard Section Headers", hint: "ATS at Indian companies looks for 'Work Experience', 'Education', 'Skills' — fancy headers like 'My Journey' or 'Tech Arsenal' cause ATS to skip the section entirely" },
      { number: "05", label: "Keep It to One Page (under 6 yrs)", hint: "Indian recruiters spend 10–15 seconds on a first scan — if your name and top credential are not visible immediately, the resume gets passed over" },
    ]} />
  ),

  /* devops-engineer-career-india-2026: Skills roadmap */
  "devops-engineer-career-india-2026||Skills roadmap for DevOps in India": (
    <PrepTimeline caption="DevOps career roadmap for Indian software engineers in 2026" phases={[
      { period: "Foundation (0–3 months)", label: "Linux and Scripting", tasks: ["Linux command line: processes, networking, file systems", "Bash scripting for automation", "Git workflow and branching strategies"], milestone: "Comfortable on the Linux command line" },
      { period: "Core Tools (3–6 months)", label: "Docker and CI/CD", tasks: ["Docker: build, run, compose, networking", "GitHub Actions or Jenkins for CI/CD pipelines", "Nginx and basic load balancing concepts"], milestone: "First Dockerised application deployed" },
      { period: "Cloud and Kubernetes (6–12 months)", label: "Cloud Infra", tasks: ["AWS or Azure fundamentals (VPC, EC2, S3, IAM)", "Kubernetes: pods, deployments, services, ingress", "Terraform for infrastructure as code"], milestone: "CKA or AWS Solutions Architect certification" },
      { period: "SRE / Advanced (12–24 months)", label: "Observability and SRE", tasks: ["Prometheus, Grafana, PagerDuty for monitoring", "SLOs, error budgets, and incident response", "Service mesh: Istio or Linkerd basics"], milestone: "First SRE or senior DevOps role" },
    ]} />
  ),

  /* devops-engineer-career-india-2026: Certifications */
  "devops-engineer-career-india-2026||Certifications for DevOps in India": (
    <ComparisonTable
      columns={[{ name: "Certification" }, { name: "Cost (USD)" }, { name: "Difficulty" }, { name: "Salary Impact", highlight: true }]}
      rows={[
        { label: "AWS Solutions Architect Associate", values: ["$150", "Medium", "+₹2–5 LPA typical"] },
        { label: "CKA (Certified Kubernetes Admin)", values: ["$395", "Hard", "+₹3–6 LPA for DevOps/SRE"] },
        { label: "Terraform Associate (HashiCorp)", values: ["$70", "Medium", "+₹2–4 LPA"] },
        { label: "GCP Professional Cloud Architect", values: ["$200", "Hard", "+₹3–6 LPA"] },
        { label: "Azure DevOps Expert (AZ-400)", values: ["$165", "Hard", "+₹2–5 LPA"] },
      ]}
      caption="Certification value for DevOps professionals in India 2026. Salary impacts are additive estimates, not guarantees."
    />
  ),

  /* product-manager-interview-questions-india-2026 (Career category): PM interview prep */
  "product-manager-interview-questions-india-2026||PM interview question types at Indian companies": (
    <FrameworkSteps steps={[
      { number: "01", label: "Product Design / Sense", hint: "'Design a feature for X' — use the framework: identify users, list pain points, prioritise one, design solution, define success metric" },
      { number: "02", label: "Metrics and Analytics", hint: "'Define success for X' or 'DAU dropped 20% — investigate' — show funnel thinking: awareness → activation → retention → revenue" },
      { number: "03", label: "Estimation", hint: "'Estimate the number of food delivery orders in Mumbai daily' — structure matters more than accuracy; show your decomposition method clearly" },
      { number: "04", label: "Execution and Prioritisation", hint: "'You have 10 features, pick 3' — use ICE scoring or RICE framework; always tie back to the north star metric" },
      { number: "05", label: "Behavioural / Leadership", hint: "STAR stories for: stakeholder conflict, data-driven decision, failed launch, cross-functional influence — prepare 5 stories covering all dimensions" },
    ]} />
  ),

  /* internship-tips-india-2026: Converting internship to PPO */
  "internship-tips-india-2026||Converting your internship to a PPO": (
    <FrameworkSteps steps={[
      { number: "01", label: "Ask About PPO Policy on Day 1", hint: "Understand the conversion rate, criteria, and timeline before you start — different companies have different PPO rates (Google: ~70%, startups: ~30%)" },
      { number: "02", label: "Ship Before Midterm Review", hint: "Have at least one merged PR or deployed feature before your midterm review — the first milestone evaluation heavily influences the final PPO decision" },
      { number: "03", label: "Exceed Your Project Scope", hint: "Deliver your assigned project, then propose one improvement beyond scope — this single action differentiates converted interns from those who are not" },
      { number: "04", label: "Get Feedback at Week 3 and Week 6", hint: "Ask your manager explicitly: 'What can I do differently to perform better?' — shows maturity and gives you time to course-correct before the final evaluation" },
      { number: "05", label: "Build Relationships With Your Skip-Level", hint: "One coffee chat with your manager's manager or another senior engineer builds the social capital that supports PPO decisions in close calls" },
    ]} />
  ),

  /* linkedin-profile-tips-indian-job-seekers-2026: LinkedIn optimisation steps */
  "linkedin-profile-tips-indian-job-seekers-2026||Skills, connections, and outreach strategy": (
    <FrameworkSteps steps={[
      { number: "01", label: "Add 5 Relevant Skills and Get Endorsed", hint: "LinkedIn's algorithm ranks profiles higher in recruiter searches when skills match the job posting — ask 2–3 former colleagues to endorse your top skills" },
      { number: "02", label: "Reach 500+ Connections", hint: "LinkedIn shows '500+' instead of the actual count above 500 — this signals an active professional and unlocks better search visibility for recruiter InMail" },
      { number: "03", label: "Turn On 'Open to Work' (Private Mode)", hint: "The private green banner is visible only to recruiters, not your current employer — it triples inbound recruiter messages without revealing your job search" },
      { number: "04", label: "Post One Piece of Content Per Month", hint: "Even one technical post per month (a problem you solved, a lesson learned) increases profile views 4–8x — Indian recruiters actively check recent activity" },
      { number: "05", label: "Send 5 Connection Requests Per Week With a Note", hint: "Add a personalised note: 'I noticed you work on payments infrastructure at Razorpay — I'm building in that space too' — acceptance rate jumps from 30% to 60%+" },
    ]} />
  ),

  /* campus-placement-preparation-guide-india-2026: Month-by-month preparation */
  "campus-placement-preparation-guide-india-2026||Month-by-month preparation plan": (
    <PrepTimeline caption="Month-by-month campus placement preparation roadmap — 2026 batch" phases={[
      { period: "Jan–Mar (6th Sem)", label: "Build Technical Foundation", tasks: ["Start DSA on LeetCode — target 50 easy problems", "Learn one project framework (React, Django, Spring Boot)", "Draft your first resume"], milestone: "Resume ready with 1–2 projects" },
      { period: "Apr–Jun (Summer)", label: "Internship or Intensive DSA", tasks: ["Prioritise internship for PPO opportunity", "Without internship: 150+ LeetCode medium problems", "Complete DBMS, OS, CN syllabus once"], milestone: "200+ LeetCode problems solved" },
      { period: "Jul–Sep (7th Sem)", label: "Aptitude and GD Prep", tasks: ["Aptitude test practice: IndiaBix, PrepInsta", "GD practice weekly with peers on current topics", "Mock interviews at college placement cell"], milestone: "Aptitude test score: 80%+" },
      { period: "Oct–Dec (Peak Season)", label: "Active Placement Drive", tasks: ["Apply to every company shortlisting your branch", "Debrief each interview immediately", "Don't decline offers until you have a better one in hand"], milestone: "Placement offer confirmed" },
    ]} />
  ),

  /* internship-interview-tips-india-2026: Internship hiring timeline */
  "internship-interview-tips-india-2026||The Internship Hiring Timeline in India": (
    <PrepTimeline caption="When Indian companies open internship applications in 2026" phases={[
      { period: "Aug–Sep", label: "Dream Company Applications", tasks: ["Google STEP, Microsoft Engage open", "Apply immediately — slots fill in weeks", "Prepare DSA now: these require strong coding skills"], milestone: "Applications submitted to Tier-1 companies" },
      { period: "Oct–Nov", label: "On-Campus Recruitment", tasks: ["Company PPTs and shortlists announced on campus", "Aptitude tests run in batches", "Technical and HR interviews same day or next day"], milestone: "First internship offer in hand" },
      { period: "Dec–Jan", label: "Off-Campus and Startups", tasks: ["LinkedIn, Internshala, Unstop for off-campus", "Startup internships often open year-round", "Apply even without referral — conversion is higher in winter"], milestone: "2–3 backup options secured" },
      { period: "Feb–Apr", label: "Last-Mile and PPO Focus", tasks: ["Any remaining off-campus opportunities", "Current interns: focus on shipping to maximize PPO odds", "Prepare for summer internship conversion discussions"], milestone: "Internship secured" },
    ]} />
  ),

  /* first-job-tips-for-software-engineers-india-2026: 90-day plan */
  "first-job-tips-for-software-engineers-india-2026||The First 90 Days: What to Prioritise": (
    <PrepTimeline caption="First 90 days as a software engineer at an Indian tech company" phases={[
      { period: "Days 1–30", label: "Learn and Listen", tasks: ["Set up dev environment, read the codebase", "Ship one small bug fix or improvement to production", "Meet your manager, team lead, and cross-functional partners"], milestone: "First PR merged to production" },
      { period: "Days 31–60", label: "Contribute and Ask", tasks: ["Own one feature end-to-end from design to deploy", "Ask questions proactively but research first", "Build relationships with at least 3 senior engineers"], milestone: "Feature shipped with your name on it" },
      { period: "Days 61–90", label: "Extend Your Scope", tasks: ["Propose an improvement to an existing system or process", "Give your first internal tech talk or demo", "Have a career conversation with your manager: 'What does success look like here?'"], milestone: "Recognized as a contributing team member" },
    ]} />
  ),

  /* first-job-tips-for-software-engineers-india-2026: Setting up for first promotion */
  "first-job-tips-for-software-engineers-india-2026||Setting Up for Your First Promotion in 18–24 Months": (
    <FrameworkSteps steps={[
      { number: "01", label: "Understand the Promotion Criteria", hint: "Ask your manager in month 3: 'What does the next level look like?' — at most Indian tech companies, promotion criteria are not published; you must ask" },
      { number: "02", label: "Keep a Brag Document", hint: "Log every contribution weekly: features shipped, bugs fixed, learnings shared — at appraisal time, you cannot recall 18 months of work from memory" },
      { number: "03", label: "Increase Your Surface Area", hint: "Take on work that crosses team boundaries — cross-functional impact is the single strongest signal of readiness for the next level at Indian product companies" },
      { number: "04", label: "Find a Senior Mentor", hint: "One mentor 1–2 levels above you who has been recently promoted is more valuable than any course — they know exactly what the company rewards" },
      { number: "05", label: "Initiate the Promotion Conversation", hint: "At your 12-month mark, ask your manager: 'Am I on track for promotion?' — managers at Indian companies rarely volunteer this information unprompted" },
    ]} />
  ),

  /* remote-job-interview-tips-india-2026: Remote interview steps */
  "remote-job-interview-tips-india-2026||Video Interview Setup: The Basics That Are Not Obvious": (
    <FrameworkSteps steps={[
      { number: "01", label: "Ethernet Over Wi-Fi", hint: "A wired internet connection eliminates 90% of video call disconnection issues — if Wi-Fi is your only option, sit as close to the router as possible and close other devices" },
      { number: "02", label: "Camera at Eye Level", hint: "Propping your laptop on books so the webcam is at eye level makes the conversation feel natural — looking down creates a power imbalance in the interviewer's perception" },
      { number: "03", label: "Front Lighting, Not Back", hint: "Place a desk lamp or sit facing a window — backlit faces show poorly and signal poor setup preparation to technical interviewers who care about such details" },
      { number: "04", label: "Silence the Room for 30 Minutes", hint: "Alert household members, silence all phones, close doors — background noise in Indian home setups (traffic, AIR conditioning, family) is the most common remote interview complaint" },
      { number: "05", label: "Have a Backup Ready", hint: "Keep your phone with the interview link and your hotspot ready — if your internet drops, you can rejoin in under 60 seconds rather than scrambling to explain a 5-minute delay" },
    ]} />
  ),

  /* resume-ats-optimisation-india-2026: ATS optimisation steps */
  "resume-ats-optimisation-india-2026||Keyword Optimisation: How to Match the Job Description": (
    <FrameworkSteps steps={[
      { number: "01", label: "Copy the JD and Highlight Keywords", hint: "Every technical skill, tool, and verb that appears in the JD is a potential ATS keyword — highlight them all before editing your resume" },
      { number: "02", label: "Mirror Exact Phrases", hint: "If the JD says 'RESTful APIs', use that exact phrase — ATS at Indian companies uses keyword matching, not semantic search, and 'REST endpoints' may not match" },
      { number: "03", label: "Weight the Top Half of the Resume", hint: "ATS systems weight keywords that appear higher in the document more heavily — ensure your most relevant skills and technologies appear in the first half of your resume" },
      { number: "04", label: "Add a Skills Section with Exact Keywords", hint: "A dedicated skills section lets you place all technical keywords in one scannable location — many Indian ATS systems prioritise this section" },
      { number: "05", label: "Avoid Images, Tables, and Columns", hint: "Many ATS systems used by Indian companies (Naukri, iRecruiter, SAP SuccessFactors) cannot parse text inside tables or columns — use plain single-column formatting" },
    ]} />
  ),

  /* after-interview-rejection-india-2026: Systematic improvement after rejection */
  "after-interview-rejection-india-2026||Systematic Improvement After Rejection": (
    <FrameworkSteps steps={[
      { number: "01", label: "Debrief Within 24 Hours", hint: "Write down every question you were asked and how you answered — memory fades fast; this log is your most valuable preparation asset for the next interview" },
      { number: "02", label: "Categorise the Gap", hint: "Was the rejection due to DSA, system design, behavioral, or cultural fit? — each category requires a completely different response in your preparation" },
      { number: "03", label: "Request Feedback (Worth Trying)", hint: "Email the recruiter: 'Would you be able to share any areas where I could improve?' — Indian companies rarely give detailed feedback, but some recruiters do, and it costs you nothing to ask" },
      { number: "04", label: "Solve the Specific Problem Type That Failed You", hint: "If you struggled with dynamic programming, solve 20 DP problems before your next interview — targeted practice on your specific weak area is more efficient than general revision" },
      { number: "05", label: "Apply to the Same Company Again (6 months later)", hint: "Most Indian companies allow re-application after 6 months — candidates who return with improved skills are often viewed favourably as persistent and growth-oriented" },
    ]} />
  ),

  /* background-verification-india-2026: BGV preparation steps */
  "background-verification-india-2026||How to Prepare Your Documents": (
    <FrameworkSteps steps={[
      { number: "01", label: "Collect All Experience and Relieving Letters", hint: "Obtain formal experience letters and relieving letters from every employer — HR departments close and companies shut down; collect these within 30 days of leaving any role" },
      { number: "02", label: "Verify Dates Match Your Resume Exactly", hint: "A 1-month mismatch between your resume dates and official records is flagged as a discrepancy — cross-check every joining and last working date before submitting BGV documents" },
      { number: "03", label: "Get Education Documents Verified", hint: "Obtain official marksheets, degree certificates, and provisional certificates from your university — BGV firms contact universities directly, so ensure your records are updated there" },
      { number: "04", label: "Prepare for Reference Checks", hint: "Inform at least 2 former managers that they may receive a BGV call — they should be prepared to confirm your role, tenure, and performance without hesitation" },
      { number: "05", label: "Disclose Any Issues Proactively", hint: "If there is a genuine discrepancy (short tenure not on resume, a gap, a title mismatch), disclose it to HR before BGV starts — early disclosure is treated very differently from a discovered discrepancy" },
    ]} />
  ),

  /* offer-letter-red-flags-india-2026: CTC vs take-home comparison */
  "offer-letter-red-flags-india-2026||CTC vs Take-Home: Understanding the Full Package": (
    <ComparisonTable
      columns={[{ name: "CTC Component" }, { name: "% of CTC (typical)" }, { name: "Actually Received?", highlight: true }, { name: "Watch Out For" }]}
      rows={[
        { label: "Basic Salary", values: ["30–40%", "Yes, monthly", "Basis for PF, HRA calculation"] },
        { label: "HRA", values: ["40–50% of Basic", "Yes, monthly (partly tax-free)", "Must be reasonable for city"] },
        { label: "Special Allowance", values: ["Remainder of monthly", "Yes, monthly (taxable)", "Often used to inflate CTC"] },
        { label: "Variable / Performance Bonus", values: ["10–30% of CTC", "Conditional on targets", "Not guaranteed; check payout history"] },
        { label: "Gratuity", values: ["4.8% of basic", "Only after 5 years", "Zero value if you leave before 5 yrs"] },
        { label: "Employer PF", values: ["12% of basic", "Goes to PF account", "Not spendable monthly salary"] },
      ]}
      caption="CTC components commonly seen in Indian tech offer letters. Always calculate your monthly in-hand before accepting."
    />
  ),

  /* communication-skills-for-indian-engineers-2026: Structuring technical explanations */
  "communication-skills-for-indian-engineers-2026||Structuring Technical Explanations": (
    <FrameworkSteps steps={[
      { number: "01", label: "Bottom Line Up Front (BLUF)", hint: "State your conclusion first, then your reasoning — Indian engineers often give context first and conclusion last, which frustrates stakeholders who need a quick answer" },
      { number: "02", label: "Use the Pyramid Principle", hint: "Main point → 2–3 supporting reasons → 1 example each — this structure works equally well in emails, Slack messages, and verbal presentations" },
      { number: "03", label: "Replace Jargon With Outcomes", hint: "Instead of 'we refactored the monolith to microservices', say 'we restructured the system so the payments team can deploy independently — reducing their release time from 2 weeks to 2 days'" },
      { number: "04", label: "Pause After Each Key Point", hint: "Indian engineers often speak in long unbroken sentences — pause after each key point, make eye contact (or wait for acknowledgment in writing), then continue" },
      { number: "05", label: "Close With Action, Not Summary", hint: "End any technical explanation with: 'I'd like to do X — do I have your go-ahead?' — stakeholders remember what they were asked to do, not technical details" },
    ]} />
  ),

  /* data-science-career-india-2026: How to get first DS job */
  "data-science-career-india-2026||How to Get Your First Data Science Job in India": (
    <PrepTimeline caption="Roadmap to first data science job in India for engineers and graduates" phases={[
      { period: "Month 1–2", label: "Learn the Essentials", tasks: ["Python: pandas, NumPy, matplotlib", "Statistics: distributions, hypothesis testing, p-values", "SQL: joins, aggregations, window functions"], milestone: "Complete one Kaggle dataset end-to-end" },
      { period: "Month 3–4", label: "Build ML Fundamentals", tasks: ["Supervised learning: linear/logistic regression, decision trees, random forest", "Model evaluation: precision, recall, AUC-ROC", "Feature engineering and cross-validation"], milestone: "3 Kaggle competitions participated in" },
      { period: "Month 5–6", label: "Build Portfolio Projects", tasks: ["1 end-to-end project from raw data to deployed API", "Document methodology clearly on GitHub", "Share findings on LinkedIn or Medium"], milestone: "Portfolio with 2–3 projects public on GitHub" },
      { period: "Month 7+", label: "Apply and Iterate", tasks: ["Apply to analytics engineer roles (easier entry than 'Data Scientist')", "Use domain background as differentiator (finance/healthcare/retail)", "Practice SQL and Python take-home tests"], milestone: "First DS or analytics role offer" },
    ]} />
  ),

  /* how-to-get-referral-job-india-2026: Referral outreach steps */
  "how-to-get-referral-job-india-2026||How to Ask for a Referral (Templates That Work)": (
    <FrameworkSteps steps={[
      { number: "01", label: "Connect First, Request Later", hint: "Send a connection request with a genuine note about their work — wait 3–5 days for them to accept before asking for anything" },
      { number: "02", label: "Open With Specific Context", hint: "Mention the exact role and why their team or company appeals to you specifically — generic referral requests are ignored; specific ones show you've done your homework" },
      { number: "03", label: "Provide Everything They Need", hint: "Include: your resume, the job link, a 3-sentence summary of your fit, and confirmation you've already applied — make the referral a one-click action for them" },
      { number: "04", label: "Keep It Short (Under 150 Words)", hint: "Long messages don't get read on LinkedIn — 3 paragraphs: who you are, what you want, why them specifically — everything else in the attached resume" },
      { number: "05", label: "Thank Them Regardless of Outcome", hint: "A genuine thank-you after the process (whether you got the job or not) builds long-term goodwill — referrers often refer the same person to multiple opportunities over a career" },
    ]} />
  ),

  /* career-in-cloud-computing-india-2026: Cloud certifications that matter */
  "career-in-cloud-computing-india-2026||Cloud Certifications That Matter in India": (
    <ComparisonTable
      columns={[{ name: "Certification" }, { name: "Provider" }, { name: "Cost (USD)" }, { name: "Salary Impact in India", highlight: true }]}
      rows={[
        { label: "AWS Solutions Architect Associate", values: ["Amazon", "$150", "+₹3–6 LPA common"] },
        { label: "AWS Solutions Architect Professional", values: ["Amazon", "$300", "+₹5–10 LPA for senior roles"] },
        { label: "GCP Professional Cloud Architect", values: ["Google", "$200", "+₹4–8 LPA"] },
        { label: "Azure Administrator (AZ-104)", values: ["Microsoft", "$165", "+₹3–5 LPA in BFSI/enterprise"] },
        { label: "Kubernetes CKA", values: ["CNCF", "$395", "+₹4–7 LPA for DevOps/cloud"] },
        { label: "Terraform Associate", values: ["HashiCorp", "$70", "+₹2–4 LPA"] },
      ]}
      caption="Certification value for cloud engineering roles in India 2026. Salary impacts are additive estimates based on market data."
    />
  ),

  /* career-in-cloud-computing-india-2026: Salary */
  "career-in-cloud-computing-india-2026||Cloud Engineer Salary in India 2026": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "Cloud Architect (8+ yrs, FAANG / Consulting)", min: 35, max: 60, note: "AWS/GCP specialty + leadership" },
      { role: "Senior Cloud Engineer (5+ yrs)", min: 22, max: 40, note: "Multi-cloud + IaC expertise" },
      { role: "Cloud Engineer (3–5 yrs)", min: 12, max: 25, note: "AWS or Azure certified" },
      { role: "Cloud Engineer (1–2 yrs, fresher certified)", min: 6, max: 14, note: "Entry-level, mostly IT services" },
    ]} caption="Cloud engineering salary benchmarks in India 2026. Source: Glassdoor, Naukri, AmbitionBox" />
  ),

  /* coding-bootcamp-india-2026: Major Indian bootcamps comparison */
  "coding-bootcamp-india-2026||Major Indian Bootcamps Compared": (
    <TierCompare cards={[
      {
        tier: "Upskilling Platforms (Self-Paced)",
        examples: "Scaler · upGrad · GUVI · Simplilearn",
        rows: [
          { label: "Cost", range: "₹1–3 L (ISA or upfront)" },
          { label: "Duration", range: "6–18 months" },
          { label: "Placement Support", range: "Strong (Scaler especially)" },
          { label: "Best For", range: "Working professionals, self-motivated" },
          { label: "Risk", range: "ISA locks you in — read terms carefully" },
        ]
      },
      {
        tier: "Bootcamp-Style Programmes",
        examples: "Masai School · Newton School · Coding Ninja",
        rows: [
          { label: "Cost", range: "₹1–2 L (ISA common)" },
          { label: "Duration", range: "4–9 months, intensive" },
          { label: "Placement Support", range: "Moderate; varies by batch" },
          { label: "Best For", range: "Career changers, freshers without placement" },
          { label: "Risk", range: "Placement rates vary significantly" },
        ]
      },
      {
        tier: "College PG Diploma",
        examples: "IIT Madras · BITS Pilani · IIIT Hyderabad",
        rows: [
          { label: "Cost", range: "₹1–3 L" },
          { label: "Duration", range: "1 year part-time or full-time" },
          { label: "Placement Support", range: "Institutional brand helps" },
          { label: "Best For", range: "Those who want a college credential" },
          { label: "Risk", range: "Curriculum can lag industry" },
        ]
      },
    ]} />
  ),

  /* engineering-manager-vs-staff-engineer-india-2026: Role and salary comparison */
  "engineering-manager-vs-staff-engineer-india-2026||Salary Comparison: EM vs Staff Engineer in India 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Director of Engineering / Principal (10+ yrs, FAANG)", min: 60, max: 80, note: "Top of IC and EM bands converge" },
      { role: "Engineering Manager (7+ yrs, Indian unicorn)", min: 35, max: 60, note: "Includes team scope premium" },
      { role: "Staff Engineer (7+ yrs, Indian unicorn)", min: 32, max: 58, note: "Comparable to EM band at most companies" },
      { role: "Senior EM / Engineering Manager (5–7 yrs, FAANG India)", min: 40, max: 70, note: "Bonus + RSU + base" },
      { role: "Staff Engineer (5–7 yrs, FAANG India)", min: 38, max: 65, note: "Technical leadership premium" },
    ]} caption="Engineering Manager vs Staff Engineer salary comparison for India 2026. Source: Glassdoor, Levels.fyi, AmbitionBox" />
  ),

  /* engineering-manager-vs-staff-engineer-india-2026: Transition framework */
  "engineering-manager-vs-staff-engineer-india-2026||Making the Transition from Senior Engineer": (
    <TierCompare cards={[
      {
        tier: "→ Engineering Manager Path",
        examples: "Team Lead → EM → Senior EM",
        rows: [
          { label: "Key Signal", range: "You energise when solving people problems" },
          { label: "First Step", range: "Volunteer to onboard / mentor junior engineers" },
          { label: "Skills to Build", range: "1:1s, performance reviews, roadmap planning" },
          { label: "Risk", range: "Harder to return to IC track after 3+ yrs as EM" },
        ]
      },
      {
        tier: "→ Staff Engineer Path",
        examples: "Senior SWE → Tech Lead → Staff → Principal",
        rows: [
          { label: "Key Signal", range: "You energise when solving large technical problems" },
          { label: "First Step", range: "Own a cross-team technical initiative" },
          { label: "Skills to Build", range: "System design, technical strategy, influence without authority" },
          { label: "Risk", range: "Staff roles are fewer than EM roles; competition higher" },
        ]
      },
    ]} />
  ),

  /* esop-equity-india-tech-startups-2026: How ESOPs work */
  "esop-equity-india-tech-startups-2026||How ESOPs Work in Indian Startups": (
    <FrameworkSteps steps={[
      { number: "01", label: "Grant and Vesting Schedule", hint: "ESOPs are granted on joining but vest over 4 years (typically 25% at 1-year cliff, then monthly) — you earn the right to options, not shares themselves" },
      { number: "02", label: "Strike Price", hint: "Your strike price is the price at which you can buy shares — if the company's valuation grows, the gap between strike price and current value is your potential gain" },
      { number: "03", label: "Exercise Window", hint: "When you leave, Indian startups typically give you 30–90 days to exercise vested options by paying the strike price — after that window closes, unvested options are forfeited" },
      { number: "04", label: "Liquidity Event", hint: "ESOPs only convert to cash at an IPO, acquisition, or secondary sale — until then, they are paper value only; Indian startup IPO timelines are 5–10 years typically" },
      { number: "05", label: "Perquisite Tax on Exercise", hint: "When you exercise options in India, you pay income tax on the fair value minus strike price as perquisite income — consult a CA before exercising large grants" },
    ]} />
  ),

  /* getting-promotion-india-tech-2026: Promotion framework */
  "getting-promotion-india-tech-2026||How Promotion Decisions Actually Work": (
    <FrameworkSteps steps={[
      { number: "01", label: "Understand the Calibration Process", hint: "Promotions at Indian product companies are decided in calibration meetings where managers advocate for their reports — your manager's ability to articulate your impact is as important as the impact itself" },
      { number: "02", label: "Operate at the Next Level for 6 Months", hint: "The standard bar at most Indian companies is: demonstrate next-level performance for two consecutive review cycles before being considered — start early, not at review time" },
      { number: "03", label: "Build Cross-Team Visibility", hint: "Calibration panels include managers from other teams — one project that another team's manager knows about is worth more than three projects only your manager knows about" },
      { number: "04", label: "Collect Written Evidence", hint: "Compile your brag document: shipped features with metrics, positive feedback from stakeholders, mentorship contributions — bring this data to your promotion conversation" },
      { number: "05", label: "Have the Direct Conversation", hint: "Ask your manager explicitly: 'Am I being considered for promotion this cycle? What specifically do I need to show?' — indirect hints do not work in Indian corporate culture" },
    ]} />
  ),

  /* tech-layoff-india-2026-what-to-do: Re-entering the job market */
  "tech-layoff-india-2026-what-to-do||Re-entering the Job Market": (
    <PrepTimeline caption="Job search roadmap after a tech layoff in India 2026" phases={[
      { period: "Week 1–2", label: "Stabilise and Plan", tasks: ["File for severance and ensure F&F settlement is documented", "Update LinkedIn and turn on 'Open to Work'", "Reach out to your network — announce you're available (without shame)"], milestone: "LinkedIn updated; network alerted" },
      { period: "Week 3–6", label: "Refresh and Apply", tasks: ["Update resume with quantified achievements from last role", "Apply to 10–15 roles per week; prioritise referrals", "Start DSA revision if targeting product companies"], milestone: "First interview callbacks received" },
      { period: "Month 2–3", label: "Interview and Negotiate", tasks: ["Run 5–10 interviews in parallel to maintain leverage", "Do not disclose severance to new employer — it is confidential", "Use competing offers to negotiate better packages"], milestone: "Offer letter in hand" },
      { period: "Month 3+", label: "If Search Is Long", tasks: ["Consider contract or freelance work to maintain income and freshness on resume", "Upskill in a high-demand area (cloud, ML, GenAI)", "Explore adjacent roles: DevOps if SWE, Analytics if backend"], milestone: "New role started" },
    ]} />
  ),

  /* salary-structure-india-tech-2026: CTC anatomy */
  "salary-structure-india-tech-2026||CTC Anatomy: Real Cash vs Non-Cash": (
    <ComparisonTable
      columns={[{ name: "Component" }, { name: "Monthly Cash?" }, { name: "Tax Treatment" }, { name: "Real Value", highlight: true }]}
      rows={[
        { label: "Basic Salary", values: ["Yes", "Fully taxable", "High — drives HRA and PF"] },
        { label: "HRA (House Rent Allowance)", values: ["Yes", "Partly tax-exempt (if renting)", "High if you pay rent in a metro"] },
        { label: "LTA (Leave Travel Allowance)", values: ["Yes (if claimed)", "Tax-exempt 2x in 4-yr block", "Medium — useful but conditional"] },
        { label: "Special Allowance", values: ["Yes", "Fully taxable", "Medium — CTC filler"] },
        { label: "Performance Variable", values: ["Quarterly/Annual", "Taxable on receipt", "Low if not historically paid out at 100%"] },
        { label: "Gratuity", values: ["No (accrual)", "Tax-exempt after 5 yrs", "Zero if you leave before 5 years"] },
        { label: "ESOPs / RSUs", values: ["No (equity)", "Perquisite tax on exercise", "High upside, illiquid until event"] },
      ]}
      caption="How CTC components translate to actual take-home pay in India. Always calculate monthly in-hand before accepting any offer."
    />
  ),

  /* remote-jobs-india-it-2026: Types of remote work */
  "remote-jobs-india-it-2026||Types of Remote IT Work Available in India": (
    <TierCompare cards={[
      {
        tier: "Full Remote — India Company",
        examples: "Zoho · Zerodha · some startups",
        rows: [
          { label: "Salary", range: "Same as in-office (market rate)" },
          { label: "Tools Used", range: "Slack, Zoom, Jira" },
          { label: "Stability", range: "High — regular employment" },
          { label: "Availability", range: "Limited — most Indian companies prefer hybrid" },
        ]
      },
      {
        tier: "Full Remote — Foreign Employer",
        examples: "US/EU startups, remote-first companies",
        rows: [
          { label: "Salary", range: "₹40–100+ LPA in USD/EUR" },
          { label: "Tools Used", range: "Linear, Notion, Loom, async-first" },
          { label: "Stability", range: "Moderate — contractor or FTE" },
          { label: "Availability", range: "Growing — Toptal, Remote.com, Deel" },
        ]
      },
      {
        tier: "Hybrid (2–3 days/week office)",
        examples: "Most Indian unicorns post-2024",
        rows: [
          { label: "Salary", range: "Full market rate" },
          { label: "Tools Used", range: "Mix of in-person and Zoom" },
          { label: "Stability", range: "High — most common in India" },
          { label: "Availability", range: "Widely available at most product companies" },
        ]
      },
    ]} />
  ),

  /* ── Freshers & HR ── */
  /* behavioral-interview-questions-freshers: STAR method + fresher salary ladder */
  "behavioral-interview-questions-freshers||The STAR Method for Freshers": (
    <FrameworkSteps steps={[
      { number: "01", label: "Situation", hint: "Set the context in 1-2 sentences — college project, internship, or hackathon" },
      { number: "02", label: "Task", hint: "What was your specific responsibility or the problem you had to solve?" },
      { number: "03", label: "Action", hint: "What steps did YOU personally take? Use 'I', not 'we'" },
      { number: "04", label: "Result", hint: "Quantify impact — marks saved, time cut, team size, or recognition received" },
    ]} />
  ),
  "behavioral-interview-questions-freshers||Top 10 Questions for TCS/Infosys/Wipro": (
    <SalaryLadder maxLPA={20} rows={[
      { role: "TCS (Ninja / Digital)", min: 3.36, max: 7, note: "Ninja 3.36 LPA · Digital 7 LPA" },
      { role: "Infosys (SE / SP)", min: 3.6, max: 9, note: "SE 3.6 LPA · SP 9 LPA" },
      { role: "Wipro (NTH / Elite)", min: 3.5, max: 6.5, note: "NTH 3.5 LPA · Elite 6.5 LPA" },
      { role: "HCL (Graduate Trainee)", min: 3.5, max: 5, note: "GEP 3.5 LPA · Tech Bee 5 LPA" },
      { role: "Cognizant (GenC / Elevate)", min: 4, max: 9, note: "GenC 4 LPA · GenC Elevate 9 LPA" },
    ]} caption="Service IT fresher packages 2026 — varies by track and test score" />
  ),

  /* group-discussion-topics-campus-placement-2026: GD evaluation framework */
  "group-discussion-topics-campus-placement-2026||GD Scoring Framework: What Assessors Actually Watch": (
    <FrameworkSteps steps={[
      { number: "01", label: "Content Quality", hint: "Relevant facts, logical arguments, and awareness of current affairs" },
      { number: "02", label: "Communication", hint: "Clarity, pace, and vocabulary — avoid filler words like 'basically' and 'you know'" },
      { number: "03", label: "Listening", hint: "Build on others' points, avoid repeating what was said, acknowledge good arguments" },
      { number: "04", label: "Leadership", hint: "Steer the group, invite quieter members, redirect off-topic tangents" },
      { number: "05", label: "Team Behaviour", hint: "Never talk over others, support strong points from peers, stay calm under pressure" },
    ]} />
  ),
  "group-discussion-topics-campus-placement-2026||How to Open, Support, and Close a GD": (
    <FrameworkSteps steps={[
      { number: "01", label: "Open confidently", hint: "State the topic definition and give a 1-sentence context before stating your stance" },
      { number: "02", label: "Support with data", hint: "Quote a stat or cite a policy — '74% of India's internet users access via mobile…'" },
      { number: "03", label: "Handle opposition", hint: "Say 'That's a valid concern, however…' — never 'You are wrong'" },
      { number: "04", label: "Re-enter gracefully", hint: "Wait for a pause, say 'I'd like to add to [Name]'s point…' and contribute" },
      { number: "05", label: "Close with a summary", hint: "Summarise 2-3 key points from all sides and give a balanced conclusion in 30 seconds" },
    ]} />
  ),

  /* capgemini-interview-questions-freshers-2026: round flow + salary */
  "capgemini-interview-questions-freshers-2026||The Four-Round Capgemini Fresher Process": (
    <RoundFlow rounds={[
      { label: "IntelliAdapt Online Test", duration: "2.5 hrs", detail: "Adaptive aptitude: quant, verbal, logical reasoning, and pseudocode — difficulty adjusts to your answers" },
      { label: "Essay Writing", duration: "20 min", detail: "One essay on a given topic — tests communication and structure, not creative writing" },
      { label: "Technical Interview", duration: "30-45 min", detail: "Core CS: OOP, DBMS, OS, data structures, and 1-2 coding questions in any language" },
      { label: "HR Interview", duration: "20-30 min", detail: "Bond confirmation (12 months), relocation discussion, 'Tell me about yourself', and career goals" },
    ]} />
  ),
  "capgemini-interview-questions-freshers-2026||Salary and Job Offer": (
    <SalaryLadder maxLPA={10} rows={[
      { role: "Analyst (A2 Band) — Standard", min: 4, max: 4.2, note: "Most fresher offers — 12-month bond" },
      { role: "Senior Analyst (A3) — Fast Track", min: 6.5, max: 7, note: "High IntelliAdapt scorers, 1-year bond" },
      { role: "Specialist (A4) — Tech for Change", min: 8, max: 9, note: "Niche tech tracks (Cloud, Cyber, AI) — limited seats" },
    ]} caption="Capgemini fresher CTC bands 2026 — take-home is ~65-70% of CTC" />
  ),

  /* ltimindtree-interview-questions-freshers-2026: round flow + salary */
  "ltimindtree-interview-questions-freshers-2026||The Three-Round LTIMindtree Fresher Process": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "2 hrs", detail: "Coding (2 problems, medium difficulty), aptitude, and verbal ability — proctored via HackerEarth" },
      { label: "Technical Interview", duration: "45 min", detail: "DSA discussion, OOP concepts, project walkthrough, DBMS basics — code on whiteboard or editor" },
      { label: "HR Interview", duration: "20 min", detail: "Bond (1 year, ~₹75,000 buyout), relocation, background details, and motivation questions" },
    ]} />
  ),
  "ltimindtree-interview-questions-freshers-2026||Salary and Bond Terms": (
    <SalaryLadder maxLPA={12} rows={[
      { role: "Junior Engineer (JE) — Standard", min: 5.5, max: 6, note: "1-year bond, most campus hires" },
      { role: "Engineer — Niche Track", min: 8, max: 10, note: "Cloud, Data, or Cyber specialisation" },
      { role: "Associate Engineer — Off-Campus", min: 5, max: 5.5, note: "Referral or off-campus lateral fresher" },
    ]} caption="LTIMindtree fresher CTC 2026 — bond buyout ~₹75,000 if leaving before 1 year" />
  ),

  /* tech-mahindra-interview-questions: round flow + salary */
  "tech-mahindra-interview-questions||Tech Mahindra Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "SmartHire / AMCAT Test", duration: "2 hrs", detail: "Aptitude (quant + verbal + logical), coding (1-2 easy problems), and English communication" },
      { label: "Technical Interview", duration: "30-45 min", detail: "OOP, DBMS, OS basics, data structures, and project-based questions" },
      { label: "HR Interview", duration: "20-30 min", detail: "Bond agreement (1 year), relocation confirmation, 'Tell me about yourself', strengths/weaknesses" },
    ]} />
  ),
  "tech-mahindra-interview-questions||Tech Mahindra Salary 2026: ELP vs Digital Track": (
    <SalaryLadder maxLPA={12} rows={[
      { role: "ELP (Entry Level Programme)", min: 3.25, max: 3.75, note: "Standard mass hiring track" },
      { role: "Digital Track", min: 5, max: 7, note: "Cloud, AI/ML, Cybersecurity specialism" },
      { role: "DIGI / TURBO (top scorers)", min: 7, max: 10, note: "Highest aptitude + coding scorers" },
    ]} caption="Tech Mahindra fresher CTC 2026 — 1-year bond applies on ELP track" />
  ),

  /* mphasis-interview-questions-freshers-2026: round flow + salary */
  "mphasis-interview-questions-freshers-2026||Mphasis Interview Process Overview": (
    <RoundFlow rounds={[
      { label: "AMCAT Online Assessment", duration: "2 hrs", detail: "Quantitative aptitude, logical reasoning, verbal English, and coding — standard AMCAT platform" },
      { label: "Technical Interview", duration: "30-45 min", detail: "Core CS (OOP, DBMS, OS), basic coding in Java/Python/C++, and resume/project discussion" },
      { label: "HR Round", duration: "20-25 min", detail: "Cultural fit, relocation, bond terms (1 year), joining timeline, and salary expectations" },
    ]} />
  ),
  "mphasis-interview-questions-freshers-2026||HR Round and What Sets Mphasis Apart": (
    <SalaryLadder maxLPA={10} rows={[
      { role: "Software Engineer — Standard", min: 4, max: 4.5, note: "Campus hire, 1-year bond" },
      { role: "Next Varsity Programme", min: 5, max: 6, note: "Selected campuses, higher CTC" },
      { role: "Digital / Cloud Track", min: 7, max: 9, note: "Specialisation in cloud or data engineering" },
    ]} caption="Mphasis fresher CTC 2026 — known for smaller batch sizes and faster project allocation" />
  ),

  /* off-campus-placement-guide-freshers-india-2026: framework steps */
  "off-campus-placement-guide-freshers-india-2026||How Off-Campus Selection Differs from Campus": (
    <FrameworkSteps steps={[
      { number: "01", label: "No placement officer safety net", hint: "You apply directly — 100% self-driven, no college shortlisting or scheduling support" },
      { number: "02", label: "ATS screening first", hint: "Resume goes through automated filtering before any human sees it — keyword optimisation is critical" },
      { number: "03", label: "Higher baseline expectations", hint: "Off-campus roles often require a portfolio, GitHub, or internship experience to pass CV screening" },
      { number: "04", label: "Longer process, less predictable", hint: "Off-campus cycles can take 4-12 weeks with no fixed season — track every application in a sheet" },
      { number: "05", label: "Negotiation room exists", hint: "Unlike campus packages, off-campus offers are often negotiable by 10-20% with a competing offer" },
    ]} />
  ),

  /* aptitude-questions-it-companies-india-2026: company comparison + prep plan */
  "aptitude-questions-it-companies-india-2026||Aptitude Test Format by Company": (
    <ComparisonTable
      columns={[
        { name: "Company" },
        { name: "Platform" },
        { name: "Duration" },
        { name: "Sections", highlight: true },
        { name: "Coding?" },
      ]}
      rows={[
        { label: "TCS (NQT)", values: ["TCS iON", "120 min", "Verbal + Numeric + Reasoning + Coding", "Yes (2 Qs)"] },
        { label: "Infosys", values: ["HackerRank", "95 min", "Verbal + Quant + Reasoning + Pseudocode", "Yes (1 Q)"] },
        { label: "Wipro (NTH)", values: ["AMCAT", "120 min", "Quant + Verbal + Logical + Essay", "No"] },
        { label: "Capgemini", values: ["IntelliAdapt", "150 min", "Adaptive Quant/Verbal/Logical + Pseudocode", "No"] },
        { label: "Cognizant", values: ["CoCubes", "90 min", "Quant + Verbal + Logical + English", "Yes (1 Q)"] },
        { label: "HCL", values: ["AMCAT", "120 min", "Quant + Verbal + Logical + Technical MCQ", "No"] },
      ]}
      caption="Aptitude test formats by major IT company — 2026 campus season"
    />
  ),
  "aptitude-questions-it-companies-india-2026||Preparation Plan: 4 Weeks to Aptitude Test Ready": (
    <PrepTimeline caption="4-week aptitude preparation plan for IT company campus tests" phases={[
      { period: "Week 1", label: "Quantitative foundation", tasks: ["Percentages, ratios, and profit-loss", "Time-speed-distance and work problems", "Number systems and series"], milestone: "Complete 50 Indiabix quant problems" },
      { period: "Week 2", label: "Logical reasoning", tasks: ["Syllogisms and blood relations", "Seating arrangement and directions", "Coding-decoding and series completion"], milestone: "Complete 3 timed section-tests" },
      { period: "Week 3", label: "Verbal ability", tasks: ["Reading comprehension passages", "Error correction and sentence completion", "Vocabulary — antonyms, synonyms, analogies"], milestone: "Score 80%+ on 2 verbal mocks" },
      { period: "Week 4", label: "Full mocks + pseudocode", tasks: ["2 full-length company-specific mocks", "Pseudocode / flowchart practice for Capgemini/Infosys", "Review weak areas, timed re-practice"], milestone: "Complete 2 full mock tests under real conditions" },
    ]} />
  ),

  /* tcs-nqt-2026-complete-guide: round flow + prep timeline */
  "tcs-nqt-2026-complete-guide||TCS NQT 2026 Exam Pattern": (
    <RoundFlow rounds={[
      { label: "Verbal Ability", duration: "15 min", detail: "Reading comprehension, fill-in-the-blanks, sentence correction — 24 questions" },
      { label: "Numerical Ability", duration: "40 min", detail: "Arithmetic, number series, data interpretation — 26 questions" },
      { label: "Reasoning Ability", duration: "50 min", detail: "Logical puzzles, blood relations, coding-decoding — 30 questions" },
      { label: "Coding (Optional — higher package)", duration: "30 min", detail: "2 programming problems in Python/Java/C/C++ — required for Digital 7 LPA track" },
    ]} />
  ),
  "tcs-nqt-2026-complete-guide||Four-Week Study Plan": (
    <PrepTimeline caption="4-week TCS NQT preparation plan" phases={[
      { period: "Week 1", label: "Numeric + Verbal base", tasks: ["Percentages, ratios, series, time-distance", "Reading comprehension (2 passages/day)", "Vocab drills — 20 words/day"], milestone: "50 quant problems + 2 RC passages per day" },
      { period: "Week 2", label: "Reasoning deep dive", tasks: ["Blood relations and directions", "Seating arrangements and syllogisms", "Coding-decoding patterns"], milestone: "Complete TCS NQT mock paper 1" },
      { period: "Week 3", label: "Coding prep (Digital track)", tasks: ["Arrays, strings, basic sorting in Python/Java", "Pattern printing and simple recursion", "2 LeetCode Easy problems per day"], milestone: "Solve 14+ LeetCode Easy problems" },
      { period: "Week 4", label: "Timed full mocks", tasks: ["2 full NQT mocks with time tracking", "Review errors, revise weak sections", "Official TCS MockVita practice test"], milestone: "Achieve 70%+ on 2 full NQT mocks" },
    ]} />
  ),

  /* wipro-wilp-interview-complete-guide: round flow + salary */
  "wipro-wilp-interview-complete-guide||WILP Selection Process": (
    <RoundFlow rounds={[
      { label: "WNTH Online Test", duration: "120 min", detail: "Aptitude (quant + verbal + logical), coding (1-2 problems), and essay writing — similar to NLTH but for WILP" },
      { label: "Technical Interview", duration: "30-40 min", detail: "OOP, DBMS, OS basics, one programming question, and project discussion" },
      { label: "HR Interview", duration: "20 min", detail: "WILP course confirmation, bond terms, work-from-office discussion, 'Tell me about yourself'" },
    ]} />
  ),
  "wipro-wilp-interview-complete-guide||HR Interview and Bond Clarity": (
    <SalaryLadder maxLPA={10} rows={[
      { role: "WILP — Standard Track", min: 3.5, max: 4, note: "2-year bond; part-time degree from BITS/VIT" },
      { role: "WILP — Elite Track", min: 6, max: 6.5, note: "Higher aptitude/coding scorers" },
      { role: "After degree completion (2 yrs)", min: 5, max: 7, note: "Promotion to Engineer role post-WILP" },
    ]} caption="Wipro WILP CTC 2026 — includes part-time B.Tech/M.Tech sponsorship; bond buyout ~₹1 lakh" />
  ),

  /* campus-placement-aptitude-test-preparation-2026: comparison table */
  "campus-placement-aptitude-test-preparation-2026||Company-Wise Test Patterns 2026": (
    <ComparisonTable
      columns={[
        { name: "Company" },
        { name: "Test Name" },
        { name: "Duration" },
        { name: "Coding Included?", highlight: true },
      ]}
      rows={[
        { label: "TCS", values: ["NQT (National Qualifier Test)", "120 min", "Yes — optional for Digital track"] },
        { label: "Infosys", values: ["InfyTQ / HackerRank", "95 min", "Yes — 1 pseudocode question"] },
        { label: "Wipro", values: ["NLTH / Elite AMCAT", "120 min", "No — aptitude + essay only"] },
        { label: "Capgemini", values: ["IntelliAdapt", "150 min", "No — pseudocode section"] },
        { label: "HCL", values: ["AMCAT / HCL HEAT", "120 min", "No — tech MCQ only"] },
        { label: "Cognizant", values: ["CoCubes", "90 min", "Yes — 1 coding question"] },
      ]}
      caption="Campus aptitude test formats and coding requirements — 2026 placement season"
    />
  ),
  "campus-placement-aptitude-test-preparation-2026||30-Day Preparation Plan": (
    <PrepTimeline caption="30-day campus aptitude preparation plan" phases={[
      { period: "Days 1-8", label: "Quantitative aptitude", tasks: ["Arithmetic: percentages, ratios, profit-loss", "Algebra: time-work, time-distance, pipes", "Number system and series"], milestone: "Score 75%+ on 1 quant mock test" },
      { period: "Days 9-16", label: "Logical reasoning", tasks: ["Seating arrangements, blood relations", "Syllogisms, statement-conclusions", "Data sufficiency and visual puzzles"], milestone: "Complete 3 reasoning section-tests" },
      { period: "Days 17-22", label: "Verbal ability", tasks: ["RC passages — 2 per day", "Sentence correction and fill-in-the-blanks", "Vocab: antonyms, synonyms, one-word substitution"], milestone: "Verbal score 70%+ on practice test" },
      { period: "Days 23-30", label: "Full mocks + gap fix", tasks: ["2 company-specific full mocks", "Timed practice of weakest section", "Pseudocode/coding warm-up for coding companies"], milestone: "2 full mocks completed — target 70%+ overall" },
    ]} />
  ),

  /* group-discussion-tips-campus-placements-india: evaluation framework */
  "group-discussion-tips-campus-placements-india||What GD Evaluators Are Actually Watching": (
    <FrameworkSteps steps={[
      { number: "01", label: "Content and knowledge", hint: "Relevant facts and logical reasoning — prepare 3 points per side for any GD topic" },
      { number: "02", label: "Communication clarity", hint: "Short, clear sentences at a moderate pace — fast speech signals nervousness" },
      { number: "03", label: "Listening and building", hint: "Reference what others said: 'Building on Priya's point about AI regulation…'" },
      { number: "04", label: "Initiating or steering", hint: "Opening or summarising earns extra credit — don't just wait for others to lead" },
      { number: "05", label: "Group dynamics", hint: "Helping quiet participants speak shows maturity: 'I'd like to hear Rahul's take on this'" },
    ]} />
  ),
  "group-discussion-tips-campus-placements-india||Summarising the GD: The Closing Move": (
    <FrameworkSteps steps={[
      { number: "01", label: "Signal the summary", hint: "Say 'As we wrap up, let me summarise the key points discussed…'" },
      { number: "02", label: "Cover both sides", hint: "Acknowledge arguments from both/all perspectives — don't just repeat your own points" },
      { number: "03", label: "Give a balanced conclusion", hint: "Avoid extreme positions in the summary — a measured stance reads as maturity" },
      { number: "04", label: "Keep it to 30 seconds", hint: "A long summary defeats the purpose — 3 crisp sentences is ideal" },
    ]} />
  ),

  /* internship-interview-questions-india-2026: evaluation framework */
  "internship-interview-questions-india-2026||What Companies Actually Evaluate in Internship Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Learning potential", hint: "Can you pick up a new framework or tool quickly? Show examples from your projects" },
      { number: "02", label: "Communication", hint: "Can you explain what your college project does in 60 seconds without jargon?" },
      { number: "03", label: "Basic coding ability", hint: "Simple arrays/strings/loops — not LeetCode Hard; just show you can write working code" },
      { number: "04", label: "Curiosity and initiative", hint: "Asking good questions at the end signals engagement — prepare 2 questions per interview" },
      { number: "05", label: "Reliability signals", hint: "Past competition wins, open source PRs, online courses — any evidence of self-directed learning" },
    ]} />
  ),

  /* fresher-resume-tips-india-2026: framework steps */
  "fresher-resume-tips-india-2026||The Section Order That Works in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Contact + Links", hint: "Name, phone, email, LinkedIn, and GitHub — all on one line at the top" },
      { number: "02", label: "Education", hint: "Degree, college, CGPA, and year — if CGPA < 7.0, place this lower on the page" },
      { number: "03", label: "Skills", hint: "Languages, frameworks, tools, and databases — match keywords from the JD" },
      { number: "04", label: "Projects", hint: "2-3 projects with tech stack, your specific role, and a measurable outcome each" },
      { number: "05", label: "Internships / Experience", hint: "If you have any, put above Projects; add what you built and what impact it had" },
      { number: "06", label: "Achievements / Extras", hint: "Competitive programming ranks, hackathon wins, certifications — keep it brief" },
    ]} />
  ),
  "fresher-resume-tips-india-2026||ATS Optimisation for Indian Companies": (
    <FrameworkSteps steps={[
      { number: "01", label: "Use standard section headings", hint: "'Experience', 'Education', 'Skills' — ATS fails on creative names like 'My Journey'" },
      { number: "02", label: "Match JD keywords exactly", hint: "If the JD says 'REST APIs', your resume should say 'REST APIs', not 'web services'" },
      { number: "03", label: "No tables or columns", hint: "ATS parsers scramble multi-column layouts — use a single-column template" },
      { number: "04", label: "Submit as PDF unless asked otherwise", hint: "PDFs preserve formatting; .docx files can reformat badly on different Word versions" },
      { number: "05", label: "Spell out abbreviations once", hint: "'Machine Learning (ML)' — the ATS may search for either form" },
    ]} />
  ),

  /* aptitude-test-preparation-india-2026: comparison table */
  "aptitude-test-preparation-india-2026||Company-by-Company Aptitude Test Formats": (
    <ComparisonTable
      columns={[
        { name: "Company" },
        { name: "Platform" },
        { name: "Key Sections", highlight: true },
        { name: "Coding?" },
      ]}
      rows={[
        { label: "TCS", values: ["TCS iON (NQT)", "Verbal + Numeric + Reasoning", "Yes (Digital track)"] },
        { label: "Infosys", values: ["HackerRank", "Verbal + Quant + Reasoning + Pseudocode", "Yes (1 Q)"] },
        { label: "Wipro", values: ["AMCAT", "Quant + Verbal + Logical + Essay", "No"] },
        { label: "Capgemini", values: ["IntelliAdapt (adaptive)", "Quant + Verbal + Logical + Pseudocode", "No"] },
        { label: "Cognizant", values: ["CoCubes", "Quant + Verbal + Logical", "Yes (1 Q)"] },
        { label: "Accenture", values: ["ACAT", "Cognitive + Technical + Communication", "No"] },
      ]}
      caption="Aptitude test platform and format by company — 2026 India campus season"
    />
  ),

  /* group-discussion-tips-india-2026: framework steps */
  "group-discussion-tips-india-2026||How to Initiate a GD Without Sounding Scripted": (
    <FrameworkSteps steps={[
      { number: "01", label: "Define the topic", hint: "Start by clarifying what the topic means — sets the frame and buys 10 seconds of thinking time" },
      { number: "02", label: "State the two sides briefly", hint: "'This topic has merits on both sides — on one hand X, on the other Y…'" },
      { number: "03", label: "Give your opening stance", hint: "Take a position with 1 supporting reason — don't stay neutral in the opening" },
      { number: "04", label: "Invite others in", hint: "'I'd like to hear others' views on this…' — shows leadership, not insecurity" },
    ]} />
  ),

  /* tier-2-college-it-career-india-2026: off-campus strategy steps */
  "tier-2-college-it-career-india-2026||Off-Campus Application Strategy": (
    <FrameworkSteps steps={[
      { number: "01", label: "Build a GitHub portfolio first", hint: "2-3 live projects with READMEs — this substitutes for a brand-name college in screening" },
      { number: "02", label: "Get an AMCAT / CoCubes score", hint: "A percentile of 80+ makes you eligible for off-campus drives from 50+ companies" },
      { number: "03", label: "Apply to mass off-campus drives", hint: "TCS NextStep, Infosys InfyTQ, Wipro Talent Hunt — free to apply, no college filter" },
      { number: "04", label: "Use LinkedIn actively", hint: "Connect with recruiters at target companies, post projects, and ask for referrals from alumni" },
      { number: "05", label: "Target service IT first, then product", hint: "Service IT hires in volume regardless of college tier — use it as a stepping stone" },
    ]} />
  ),

  /* hr-round-questions-india-2026: HR evaluation framework */
  "hr-round-questions-india-2026||What HR Rounds Actually Evaluate": (
    <FrameworkSteps steps={[
      { number: "01", label: "Culture fit", hint: "HR checks if your working style, values, and attitude match the team — answer authentically, not generically" },
      { number: "02", label: "Communication clarity", hint: "Can you articulate your thoughts without rambling? Short, structured answers score well" },
      { number: "03", label: "Stability signals", hint: "HR watches for flight risk — show genuine interest in the role, not just the salary" },
      { number: "04", label: "Self-awareness", hint: "Questions on weakness and failure test if you can reflect honestly — scripted perfect answers raise red flags" },
      { number: "05", label: "Closing intent", hint: "HR assesses if you'll accept the offer — have a clear, positive answer ready for 'How soon can you join?'" },
    ]} />
  ),
  "hr-round-questions-india-2026||The High-Stakes HR Questions": (
    <FrameworkSteps steps={[
      { number: "01", label: "Tell me about yourself", hint: "Present → Past → Future in 90 seconds — end with why this role fits your direction" },
      { number: "02", label: "Why should we hire you?", hint: "3 specific strengths that match the JD + 1 differentiator — not a generic answer" },
      { number: "03", label: "What is your biggest weakness?", hint: "Real weakness + concrete steps you are taking to improve + visible progress" },
      { number: "04", label: "Where do you see yourself in 5 years?", hint: "Align with the company's growth path — show ambition without implying you'll leave in 1 year" },
      { number: "05", label: "Why are you leaving your current role?", hint: "Pull reasons (growth, learning, new challenge) — never criticise your current employer" },
    ]} />
  ),

  /* fresher-resume-india-2026: structure + ATS framework */
  "fresher-resume-india-2026||Fresher Resume Structure": (
    <FrameworkSteps steps={[
      { number: "01", label: "Header", hint: "Name (large), phone, email, LinkedIn, GitHub — one clean line, no photo" },
      { number: "02", label: "Education", hint: "Degree, college, CGPA, and year — if CGPA < 7.0, de-emphasise by placing it lower" },
      { number: "03", label: "Technical Skills", hint: "Languages, frameworks, tools, cloud platforms — mirror the exact words in target JDs" },
      { number: "04", label: "Projects", hint: "2-3 projects: title, tech stack, your role, and a measurable outcome each" },
      { number: "05", label: "Achievements", hint: "Competitive programming ranks (CodeChef, Codeforces), hackathon wins, or certifications" },
    ]} />
  ),
  "fresher-resume-india-2026||ATS Optimisation for Indian Fresher Resumes": (
    <FrameworkSteps steps={[
      { number: "01", label: "Single-column layout only", hint: "Multi-column tables break ATS parsers — every Indian IT company ATS fails on them" },
      { number: "02", label: "Standard section titles", hint: "Use 'Skills', 'Experience', 'Education' — creative names like 'My Toolkit' are invisible to ATS" },
      { number: "03", label: "Exact keyword matching", hint: "Copy skills verbatim from the JD — 'React.js' not 'ReactJS' if the JD says the former" },
      { number: "04", label: "Spell out acronyms", hint: "'Machine Learning (ML)' — include both forms since ATS may search either" },
      { number: "05", label: "Submit as PDF", hint: "PDF preserves layout; .docx files reflow unpredictably across Word versions" },
    ]} />
  ),

  /* campus-to-corporate-india-2026: fresher transition framework */
  "campus-to-corporate-india-2026||The First 30 Days: Learn Before You Lead": (
    <FrameworkSteps steps={[
      { number: "01", label: "Observe before acting", hint: "Understand team norms, communication style, and unwritten rules before suggesting changes" },
      { number: "02", label: "Ask structured questions", hint: "Batch your questions, do your own research first, then ask: 'I tried X and Y — is Z the right approach?'" },
      { number: "03", label: "Deliver your first task early", hint: "Under-promise and over-deliver on your first assigned task — sets a strong first impression" },
      { number: "04", label: "Build relationships deliberately", hint: "Introduce yourself to 2-3 colleagues per week — relationships open doors to better projects" },
      { number: "05", label: "Document everything", hint: "Keep notes on processes, system setup, and decisions — you'll need them when onboarding the next fresher" },
    ]} />
  ),
  "campus-to-corporate-india-2026||Performance in the First Year": (
    <PrepTimeline caption="Performance milestones to target in your first year at an IT company" phases={[
      { period: "Month 1-3", label: "Onboarding and training", tasks: ["Complete mandatory training (Lex, TCS iEvolve, etc.)", "Get development environment set up and deploy first code", "Understand team's tech stack and codebase structure"], milestone: "First code merged or first task delivered" },
      { period: "Month 4-6", label: "Independent contribution", tasks: ["Own small features or bug fixes end-to-end", "Participate in code reviews — both giving and receiving", "Raise blockers proactively, don't stay stuck silently"], milestone: "First quarterly review — aim for 'Meets Expectations' or above" },
      { period: "Month 7-9", label: "Visibility and learning", tasks: ["Volunteer for one cross-team initiative or demo", "Start a relevant certification (AWS, GCP, etc.)", "Track your contributions for appraisal evidence"], milestone: "Certification in progress or completed" },
      { period: "Month 10-12", label: "Appraisal prep", tasks: ["Write your self-assessment with specific examples and metrics", "Have a career conversation with your manager", "Identify skill gaps to address in Year 2"], milestone: "Mid-year or annual appraisal discussion done" },
    ]} />
  ),

  /* ── Industry & Salary ── */
  /* backend-developer-salary-india-2026: Salary Guide */
  "backend-developer-salary-india-2026||Backend Developer Salary by Experience Level": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "Fresher / 0-1 yr (IT Services)", min: 4, max: 8 },
      { role: "Junior Backend (1-3 yr)", min: 8, max: 18 },
      { role: "Mid-Level Backend (3-5 yr)", min: 16, max: 35 },
      { role: "Senior Backend (5-8 yr)", min: 28, max: 55 },
      { role: "Staff / Principal (8-12 yr)", min: 45, max: 90 },
      { role: "Engineering Manager / Architect", min: 55, max: 120 },
    ]} caption="India backend developer salaries 2026 — product companies at upper band, IT services at lower" />
  ),

  "backend-developer-salary-india-2026||Salary by Technology Stack": (
    <TierCompare cards={[
      {
        tier: "High Pay (₹20–60 LPA)",
        examples: "Go · Rust · Kafka · Kubernetes",
        rows: [
          { label: "Mid-Level", range: "₹25–45 LPA" },
          { label: "Senior", range: "₹40–60 LPA" },
          { label: "Demand", range: "Very High" },
        ],
      },
      {
        tier: "Mid Pay (₹15–45 LPA)",
        examples: "Java · Python · Node.js · gRPC",
        rows: [
          { label: "Mid-Level", range: "₹18–35 LPA" },
          { label: "Senior", range: "₹30–50 LPA" },
          { label: "Demand", range: "High" },
        ],
      },
      {
        tier: "Entry Pay (₹6–20 LPA)",
        examples: "PHP · .NET legacy · COBOL",
        rows: [
          { label: "Mid-Level", range: "₹10–20 LPA" },
          { label: "Senior", range: "₹18–30 LPA" },
          { label: "Demand", range: "Moderate" },
        ],
      },
    ]} />
  ),

  /* full-stack-developer-salary-india-2026: Salary Guide */
  "full-stack-developer-salary-india-2026||Full Stack Developer Salary by Experience Level in India": (
    <SalaryLadder maxLPA={110} rows={[
      { role: "Fresher / 0-1 yr (IT Services)", min: 4, max: 7 },
      { role: "Junior Full Stack (1-3 yr)", min: 8, max: 20 },
      { role: "Mid-Level Full Stack (3-5 yr)", min: 18, max: 40 },
      { role: "Senior Full Stack (5-8 yr)", min: 30, max: 65 },
      { role: "Staff / Lead Full Stack (8+ yr)", min: 50, max: 110 },
    ]} caption="India full-stack developer salaries 2026 — product startups at upper band" />
  ),

  "full-stack-developer-salary-india-2026||Salary by Stack: Which Full Stack Combination Pays Most": (
    <TierCompare cards={[
      {
        tier: "Top Paying Stacks",
        examples: "Next.js + Go · React + Rust · GraphQL + K8s",
        rows: [
          { label: "Mid range", range: "₹25–50 LPA" },
          { label: "Senior range", range: "₹45–80 LPA" },
          { label: "Openings", range: "Product cos" },
        ],
      },
      {
        tier: "Standard Stacks",
        examples: "React + Node.js · MERN · MEAN",
        rows: [
          { label: "Mid range", range: "₹15–35 LPA" },
          { label: "Senior range", range: "₹30–55 LPA" },
          { label: "Openings", range: "Very many" },
        ],
      },
      {
        tier: "Legacy / Services Stacks",
        examples: "Angular + Java · Vue + .NET",
        rows: [
          { label: "Mid range", range: "₹10–22 LPA" },
          { label: "Senior range", range: "₹20–38 LPA" },
          { label: "Openings", range: "IT Services" },
        ],
      },
    ]} />
  ),

  /* devops-engineer-salary-india-2026: Salary Guide */
  "devops-engineer-salary-india-2026||DevOps Engineer Salary by Experience Level": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "Junior DevOps (0-2 yr)", min: 5, max: 14 },
      { role: "Mid-Level DevOps (2-5 yr)", min: 14, max: 35 },
      { role: "Senior DevOps (5-8 yr)", min: 28, max: 60 },
      { role: "Principal / Platform Eng (8+ yr)", min: 50, max: 90 },
      { role: "Head of Infrastructure", min: 70, max: 120 },
    ]} caption="India DevOps engineer salaries 2026 — cloud-native product companies at upper band" />
  ),

  "devops-engineer-salary-india-2026||What Companies Pay Best for DevOps in India": (
    <TierCompare cards={[
      {
        tier: "Top Payers",
        examples: "Google · Microsoft · Amazon · Atlassian",
        rows: [
          { label: "Mid-Level", range: "₹35–60 LPA" },
          { label: "Senior", range: "₹55–90 LPA" },
          { label: "SRE variant", range: "₹60–100 LPA" },
        ],
      },
      {
        tier: "Indian Product",
        examples: "Razorpay · PhonePe · Swiggy · Zepto",
        rows: [
          { label: "Mid-Level", range: "₹22–40 LPA" },
          { label: "Senior", range: "₹38–65 LPA" },
          { label: "SRE variant", range: "₹40–70 LPA" },
        ],
      },
      {
        tier: "IT Services",
        examples: "TCS · Infosys · Wipro · HCL",
        rows: [
          { label: "Mid-Level", range: "₹10–20 LPA" },
          { label: "Senior", range: "₹18–32 LPA" },
          { label: "SRE variant", range: "Rare role" },
        ],
      },
    ]} />
  ),

  /* machine-learning-engineer-salary-india-2026: Salary Guide */
  "machine-learning-engineer-salary-india-2026||ML Engineer Salary by Experience Level": (
    <SalaryLadder maxLPA={130} rows={[
      { role: "Junior MLE (0-2 yr)", min: 8, max: 18 },
      { role: "Mid-Level MLE (2-5 yr)", min: 18, max: 45 },
      { role: "Senior MLE (5-8 yr)", min: 38, max: 75 },
      { role: "Staff MLE / Research Eng (8-12 yr)", min: 65, max: 105 },
      { role: "Principal / ML Architect", min: 90, max: 130 },
    ]} caption="India ML engineer salaries 2026 — GenAI/LLM specialisation commands highest premium" />
  ),

  "machine-learning-engineer-salary-india-2026||Salary by ML Specialisation": (
    <TierCompare cards={[
      {
        tier: "GenAI / LLM",
        examples: "LLM fine-tuning · RAG · Agents · RLHF",
        rows: [
          { label: "Mid range", range: "₹30–60 LPA" },
          { label: "Senior range", range: "₹55–100 LPA" },
          { label: "Demand", range: "Extremely high" },
        ],
      },
      {
        tier: "Applied ML / CV / NLP",
        examples: "Recommendation · Vision · ASR · NER",
        rows: [
          { label: "Mid range", range: "₹20–45 LPA" },
          { label: "Senior range", range: "₹40–75 LPA" },
          { label: "Demand", range: "High" },
        ],
      },
      {
        tier: "MLOps / Platform",
        examples: "Kubeflow · MLflow · Feature stores",
        rows: [
          { label: "Mid range", range: "₹18–38 LPA" },
          { label: "Senior range", range: "₹35–65 LPA" },
          { label: "Demand", range: "Growing fast" },
        ],
      },
    ]} />
  ),

  /* cloud-computing-salary-india-2026: Salary Guide */
  "cloud-computing-salary-india-2026||Cloud Engineer vs Cloud Architect: Role and Salary Difference": (
    <TierCompare cards={[
      {
        tier: "Cloud Engineer",
        examples: "AWS · Azure · GCP · DevOps focus",
        rows: [
          { label: "Entry (0-2 yr)", range: "₹6–16 LPA" },
          { label: "Mid (3-5 yr)", range: "₹16–38 LPA" },
          { label: "Senior (6-9 yr)", range: "₹32–60 LPA" },
        ],
      },
      {
        tier: "Cloud Architect",
        examples: "Multi-cloud · FinOps · Security design",
        rows: [
          { label: "Entry (5-7 yr total)", range: "₹35–55 LPA" },
          { label: "Mid (8-11 yr)", range: "₹50–80 LPA" },
          { label: "Principal (12+ yr)", range: "₹75–120 LPA" },
        ],
      },
      {
        tier: "Cloud Security / FinOps",
        examples: "CSPM · CCoE · IAM · Cost optim",
        rows: [
          { label: "Mid level", range: "₹22–45 LPA" },
          { label: "Senior", range: "₹40–75 LPA" },
          { label: "Demand", range: "Fastest growing" },
        ],
      },
    ]} />
  ),

  "cloud-computing-salary-india-2026||Highest-Paying Cloud Computing Roles in India": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "Cloud Support / Jr Engineer", min: 6, max: 14 },
      { role: "Cloud Engineer (AWS/Azure/GCP certified)", min: 14, max: 35 },
      { role: "Senior Cloud / Platform Engineer", min: 28, max: 60 },
      { role: "Cloud Architect", min: 45, max: 85 },
      { role: "Principal Cloud Architect / CCoE Lead", min: 70, max: 120 },
    ]} caption="India cloud computing salaries 2026 — certifications + FinOps skills push into upper bands" />
  ),

  /* top-product-companies-bengaluru-2026: Industry Insights */
  "top-product-companies-bengaluru-2026||Tier 1: FAANG and Global Product Companies in Bengaluru": (
    <TierCompare cards={[
      {
        tier: "FAANG Bengaluru",
        examples: "Google · Amazon · Microsoft · Meta · Apple",
        rows: [
          { label: "SDE-1 / SWE-1", range: "₹45–80 LPA" },
          { label: "SDE-2 / SWE-2", range: "₹70–130 LPA" },
          { label: "Staff+", range: "₹120–220 LPA" },
        ],
      },
      {
        tier: "Tier 1 Global Product",
        examples: "Atlassian · Salesforce · Adobe · LinkedIn · Uber",
        rows: [
          { label: "SDE-1", range: "₹30–55 LPA" },
          { label: "SDE-2", range: "₹50–90 LPA" },
          { label: "Staff+", range: "₹80–150 LPA" },
        ],
      },
      {
        tier: "Top Indian Product",
        examples: "Flipkart · PhonePe · Swiggy · Razorpay · CRED",
        rows: [
          { label: "SDE-1", range: "₹22–45 LPA" },
          { label: "SDE-2", range: "₹35–70 LPA" },
          { label: "Staff+", range: "₹60–110 LPA" },
        ],
      },
    ]} />
  ),

  "top-product-companies-bengaluru-2026||Tier 2: Top Indian Product Companies": (
    <SalaryLadder maxLPA={110} rows={[
      { role: "Freshers / SDE-0 (2026 batch)", min: 12, max: 22, note: "Unicorns" },
      { role: "SDE-1 / Junior Engineer (1-3 yr)", min: 18, max: 40 },
      { role: "SDE-2 / Mid-Level (3-6 yr)", min: 30, max: 65 },
      { role: "SDE-3 / Senior (6-10 yr)", min: 50, max: 90 },
      { role: "Staff / Principal (10+ yr)", min: 75, max: 110 },
    ]} caption="Indian product company salaries — Bengaluru 2026. Includes base + variable + pre-IPO equity value" />
  ),

  /* best-fintech-companies-india-2026: Industry Insights */
  "best-fintech-companies-india-2026||Tier 1: Payments Infrastructure Leaders": (
    <TierCompare cards={[
      {
        tier: "Tier 1: Payments Infra",
        examples: "Razorpay · PhonePe · BillDesk · Juspay",
        rows: [
          { label: "SDE-1", range: "₹20–40 LPA" },
          { label: "SDE-2", range: "₹35–65 LPA" },
          { label: "SDE-3 / Senior", range: "₹55–95 LPA" },
        ],
      },
      {
        tier: "Tier 2: Consumer Finance",
        examples: "Groww · Zerodha · Upstox · ClearTax",
        rows: [
          { label: "SDE-1", range: "₹15–30 LPA" },
          { label: "SDE-2", range: "₹25–50 LPA" },
          { label: "SDE-3 / Senior", range: "₹40–75 LPA" },
        ],
      },
      {
        tier: "Tier 3: InsurTech / Lending",
        examples: "Acko · PolicyBazaar · BankBazaar · KreditBee",
        rows: [
          { label: "SDE-1", range: "₹10–22 LPA" },
          { label: "SDE-2", range: "₹18–38 LPA" },
          { label: "SDE-3 / Senior", range: "₹30–55 LPA" },
        ],
      },
    ]} />
  ),

  "best-fintech-companies-india-2026||Tier 2: Consumer Finance and Investment Platforms": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Junior SDE (0-2 yr)", min: 10, max: 22, note: "Consumer finance startups" },
      { role: "Mid-Level SDE (2-5 yr)", min: 22, max: 50 },
      { role: "Senior SDE (5-8 yr)", min: 40, max: 75 },
      { role: "Staff Engineer (8+ yr)", min: 60, max: 100 },
    ]} caption="Consumer fintech (Groww, Zerodha, Upstox, CRED) engineer salaries — India 2026" />
  ),

  /* software-engineer-salary-india-2026: Industry Insights */
  "software-engineer-salary-india-2026||Service IT Companies: TCS, Infosys, Wipro, HCL, Cognizant": (
    <SalaryLadder maxLPA={40} rows={[
      { role: "Fresher / Associate (0-1 yr)", min: 3, max: 7 },
      { role: "Systems Engineer (1-3 yr)", min: 5, max: 12 },
      { role: "Senior Systems Eng (3-6 yr)", min: 10, max: 20 },
      { role: "Lead / Specialist (6-10 yr)", min: 16, max: 32 },
      { role: "Manager / Architect (10+ yr)", min: 25, max: 40 },
    ]} caption="IT Services company salaries (TCS, Infosys, Wipro, HCL, Cognizant) — India 2026" />
  ),

  "software-engineer-salary-india-2026||FAANG India and Global Product Companies": (
    <TierCompare cards={[
      {
        tier: "FAANG India",
        examples: "Google · Amazon · Microsoft · Meta · Apple",
        rows: [
          { label: "SDE-1", range: "₹40–80 LPA" },
          { label: "SDE-2", range: "₹70–130 LPA" },
          { label: "Senior / Staff", range: "₹110–220+ LPA" },
        ],
      },
      {
        tier: "Indian Unicorns",
        examples: "Flipkart · Razorpay · PhonePe · Swiggy · CRED",
        rows: [
          { label: "SDE-1", range: "₹18–42 LPA" },
          { label: "SDE-2", range: "₹35–70 LPA" },
          { label: "Senior / Staff", range: "₹60–110 LPA" },
        ],
      },
      {
        tier: "IT Services",
        examples: "TCS · Infosys · Wipro · HCL · Cognizant",
        rows: [
          { label: "Fresher", range: "₹3.5–7 LPA" },
          { label: "Mid-Level", range: "₹10–20 LPA" },
          { label: "Senior / Lead", range: "₹18–35 LPA" },
        ],
      },
    ]} />
  ),

  /* it-services-vs-product-companies-india-2026: Industry Insights */
  "it-services-vs-product-companies-india-2026||The Compensation Gap: How Large Is It Really?": (
    <TierCompare cards={[
      {
        tier: "IT Services",
        examples: "TCS · Infosys · Wipro · HCL · Cognizant",
        rows: [
          { label: "Fresher CTC", range: "₹3.5–7 LPA" },
          { label: "5-year CTC", range: "₹10–20 LPA" },
          { label: "10-year CTC", range: "₹18–35 LPA" },
        ],
      },
      {
        tier: "Indian Product",
        examples: "Flipkart · Razorpay · Swiggy · PhonePe",
        rows: [
          { label: "Fresher CTC", range: "₹15–30 LPA" },
          { label: "5-year CTC", range: "₹35–70 LPA" },
          { label: "10-year CTC", range: "₹60–110 LPA" },
        ],
      },
      {
        tier: "FAANG India",
        examples: "Google · Amazon · Microsoft · Meta",
        rows: [
          { label: "Fresher CTC", range: "₹40–80 LPA" },
          { label: "5-year CTC", range: "₹80–140 LPA" },
          { label: "10-year CTC", range: "₹130–230+ LPA" },
        ],
      },
    ]} />
  ),

  /* campus-placement-guide-india-2026: Industry Insights */
  "campus-placement-guide-india-2026||Timeline: When to Start and What to Do Each Semester": (
    <PrepTimeline caption="Campus placement preparation — 2-year roadmap for 2026 batch" phases={[
      {
        period: "3rd Year S1",
        label: "Foundation",
        tasks: ["Start DSA on LeetCode (easy)", "Pick one language deeply (Java/Python/C++)", "Apply for summer internships"],
        milestone: "Complete 100 Easy problems",
      },
      {
        period: "3rd Year S2",
        label: "Build Momentum",
        tasks: ["DSA medium problems (150+)", "1 side project on GitHub", "Participate in Codeforces / CodeChef contests"],
        milestone: "Secure a summer internship",
      },
      {
        period: "Summer Internship",
        label: "Industry Exposure",
        tasks: ["Deliver real impact at internship", "Aim for PPO", "Network with seniors for referrals"],
        milestone: "PPO or strong LOR",
      },
      {
        period: "4th Year S1",
        label: "Placement Season",
        tasks: ["Resume finalised by Aug", "Mock interviews weekly", "Apply to 30+ companies via campus + off-campus"],
        milestone: "First offer in hand",
      },
    ]} />
  ),

  /* top-tech-companies-hyderabad-2026: Industry Insights */
  "top-tech-companies-hyderabad-2026||Tier 1: Global Tech Company GCCs in Hyderabad": (
    <TierCompare cards={[
      {
        tier: "FAANG GCCs",
        examples: "Google · Amazon · Microsoft · Apple · Meta",
        rows: [
          { label: "SDE-1", range: "₹40–75 LPA" },
          { label: "SDE-2", range: "₹65–120 LPA" },
          { label: "Staff+", range: "₹110–200 LPA" },
        ],
      },
      {
        tier: "Enterprise Tech GCCs",
        examples: "SAP · Oracle · Qualcomm · Nvidia · Broadcom",
        rows: [
          { label: "SDE-1", range: "₹20–42 LPA" },
          { label: "SDE-2", range: "₹38–70 LPA" },
          { label: "Staff+", range: "₹65–110 LPA" },
        ],
      },
      {
        tier: "IT Services & BFSI",
        examples: "TCS · Infosys · Wipro · Deloitte USI · HSBC Tech",
        rows: [
          { label: "Fresher", range: "₹3.5–8 LPA" },
          { label: "Mid-Level", range: "₹12–25 LPA" },
          { label: "Senior", range: "₹22–40 LPA" },
        ],
      },
    ]} />
  ),

  "top-tech-companies-hyderabad-2026||Tier 2: Enterprise Tech and SaaS Companies": (
    <SalaryLadder maxLPA={110} rows={[
      { role: "Fresher (2026 batch)", min: 8, max: 22, note: "GCCs and SaaS" },
      { role: "Junior Engineer (1-3 yr)", min: 15, max: 38 },
      { role: "Mid-Level Engineer (3-6 yr)", min: 28, max: 60 },
      { role: "Senior Engineer (6-10 yr)", min: 45, max: 85 },
      { role: "Staff / Principal (10+ yr)", min: 70, max: 110 },
    ]} caption="Hyderabad enterprise tech and SaaS salaries 2026 — SAP Labs, Oracle, Qualcomm, Nvidia" />
  ),

  /* top-tech-companies-pune-2026: Industry Insights */
  "top-tech-companies-pune-2026||Tier 1: Best Pune Tech Employers for Engineering Quality": (
    <TierCompare cards={[
      {
        tier: "Global Product (Pune)",
        examples: "Persistent · Veritas · Bentley · Barclays Tech · HSBC",
        rows: [
          { label: "SDE-1", range: "₹15–35 LPA" },
          { label: "SDE-2", range: "₹28–55 LPA" },
          { label: "Senior", range: "₹45–80 LPA" },
        ],
      },
      {
        tier: "Automotive / Embedded",
        examples: "Cummins · Mercedes-Benz R&D · Tata Technologies · Eaton",
        rows: [
          { label: "Entry", range: "₹6–14 LPA" },
          { label: "Mid-Level", range: "₹14–30 LPA" },
          { label: "Senior", range: "₹25–50 LPA" },
        ],
      },
      {
        tier: "IT Services (Pune)",
        examples: "Infosys · Wipro · Cognizant · TCS · Capgemini",
        rows: [
          { label: "Fresher", range: "₹3.5–7 LPA" },
          { label: "Mid-Level", range: "₹10–22 LPA" },
          { label: "Senior", range: "₹18–35 LPA" },
        ],
      },
    ]} />
  ),

  "top-tech-companies-pune-2026||Pune vs Bengaluru vs Hyderabad: Which City Should You Choose?": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Pune — Average SWE (all levels)", min: 8, max: 45, note: "15–20% lower cost of living" },
      { role: "Hyderabad — Average SWE (all levels)", min: 8, max: 65, note: "No state income tax" },
      { role: "Bengaluru — Average SWE (all levels)", min: 10, max: 80, note: "Highest pay, highest rent" },
    ]} caption="City comparison — effective take-home is closer due to cost-of-living differences" />
  ),

  /* top-tech-companies-chennai-2026: Industry Insights */
  "top-tech-companies-chennai-2026||Chennai Salary Benchmarks and Why Chennai is Underrated": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Fresher at IT Services (0-1 yr)", min: 3, max: 7 },
      { role: "Freshworks / Zoho (0-1 yr)", min: 8, max: 18 },
      { role: "Mid-Level Product Eng (3-5 yr)", min: 18, max: 40 },
      { role: "Senior Product Eng (5-8 yr)", min: 32, max: 65 },
      { role: "Staff / Principal (8+ yr)", min: 50, max: 80 },
    ]} caption="Chennai tech salaries 2026 — 20–25% lower cost of living vs Bengaluru improves effective value" />
  ),

  "top-tech-companies-chennai-2026||Freshworks: Chennai's NASDAQ-Listed Product Company": (
    <TierCompare cards={[
      {
        tier: "Freshworks Chennai",
        examples: "Public SaaS · CRM · ITSM · Freshdesk",
        rows: [
          { label: "SDE-1", range: "₹14–22 LPA" },
          { label: "SDE-2", range: "₹22–40 LPA" },
          { label: "Senior SDE", range: "₹38–65 LPA" },
        ],
      },
      {
        tier: "Zoho Corporation",
        examples: "Bootstrapped · 55+ products · No VC",
        rows: [
          { label: "SDE-1", range: "₹8–16 LPA" },
          { label: "SDE-2", range: "₹14–28 LPA" },
          { label: "Senior SDE", range: "₹25–45 LPA" },
        ],
      },
      {
        tier: "BFSI / Bank Tech Centres",
        examples: "Standard Chartered · DBS · BNY Mellon",
        rows: [
          { label: "SDE-1", range: "₹10–20 LPA" },
          { label: "SDE-2", range: "₹20–38 LPA" },
          { label: "Senior SDE", range: "₹32–58 LPA" },
        ],
      },
    ]} />
  ),

  /* top-tech-companies-ncr-delhi-2026: Industry Insights */
  "top-tech-companies-ncr-delhi-2026||NCR Salary Benchmarks and Why NCR is Underrated for Engineers": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "Fresher at IT Services / BPO (0-1 yr)", min: 3, max: 7 },
      { role: "Travel Tech / Fintech SDE-1 (1-3 yr)", min: 12, max: 28 },
      { role: "Mid-Level SDE (3-6 yr)", min: 22, max: 50 },
      { role: "Senior SDE (6-9 yr)", min: 38, max: 72 },
      { role: "Staff / Principal / EM (9+ yr)", min: 58, max: 90 },
    ]} caption="NCR (Gurugram + Noida) tech salaries 2026 — travel tech, fintech, enterprise tech clusters" />
  ),

  "top-tech-companies-ncr-delhi-2026||Gurugram: India's Travel Tech and Fintech Capital": (
    <TierCompare cards={[
      {
        tier: "Travel Tech (Gurugram)",
        examples: "MakeMyTrip · OYO · Agoda Tech · Ixigo",
        rows: [
          { label: "SDE-1", range: "₹12–25 LPA" },
          { label: "SDE-2", range: "₹22–45 LPA" },
          { label: "Senior SDE", range: "₹38–65 LPA" },
        ],
      },
      {
        tier: "Fintech (Gurugram)",
        examples: "PolicyBazaar · PB Fintech · CredAvenue",
        rows: [
          { label: "SDE-1", range: "₹10–22 LPA" },
          { label: "SDE-2", range: "₹20–40 LPA" },
          { label: "Senior SDE", range: "₹35–60 LPA" },
        ],
      },
      {
        tier: "Enterprise Tech (Noida)",
        examples: "Adobe Noida · HCL · Tech Mahindra · Newgen",
        rows: [
          { label: "SDE-1", range: "₹14–30 LPA" },
          { label: "SDE-2", range: "₹25–50 LPA" },
          { label: "Senior SDE", range: "₹40–75 LPA" },
        ],
      },
    ]} />
  ),

  /* ai-ml-jobs-india-2026: Industry Insights */
  "ai-ml-jobs-india-2026||AI/ML Salaries in India in 2026: The Premium Explained": (
    <SalaryLadder maxLPA={130} rows={[
      { role: "ML Fresher / Data Scientist I (0-2 yr)", min: 8, max: 22 },
      { role: "ML Engineer II (2-4 yr)", min: 20, max: 50 },
      { role: "Senior ML Engineer (4-7 yr)", min: 40, max: 80 },
      { role: "Staff MLE / Research Engineer (7-10 yr)", min: 65, max: 105 },
      { role: "Principal MLE / ML Architect (10+ yr)", min: 90, max: 130 },
    ]} caption="India AI/ML salaries 2026 — GenAI engineers command 30–50% premium over classical ML" />
  ),

  "ai-ml-jobs-india-2026||Top Companies Hiring for AI/ML Roles in India in 2026": (
    <TierCompare cards={[
      {
        tier: "Global AI Leaders",
        examples: "Google · Microsoft · Meta AI · Adobe Firefly · Nvidia",
        rows: [
          { label: "ML Engineer II", range: "₹60–110 LPA" },
          { label: "Senior MLE", range: "₹90–160 LPA" },
          { label: "Research Scientist", range: "₹100–200 LPA" },
        ],
      },
      {
        tier: "Indian AI-First",
        examples: "Sarvam AI · Krutrim · Ola AI · Swiggy AI · PhonePe AI",
        rows: [
          { label: "ML Engineer II", range: "₹25–55 LPA" },
          { label: "Senior MLE", range: "₹45–85 LPA" },
          { label: "Research Scientist", range: "₹55–100 LPA" },
        ],
      },
      {
        tier: "Traditional Co + AI",
        examples: "Zomato · Flipkart · Myntra · ShareChat · Zepto",
        rows: [
          { label: "ML Engineer II", range: "₹20–45 LPA" },
          { label: "Senior MLE", range: "₹38–70 LPA" },
          { label: "Research Scientist", range: "₹45–80 LPA" },
        ],
      },
    ]} />
  ),

  /* top-edtech-companies-india-2026: Industry Insights */
  "top-edtech-companies-india-2026||EdTech Salary Benchmarks and Why Engineers Choose EdTech in 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Junior SDE (0-2 yr)", min: 8, max: 18, note: "EdTech startups" },
      { role: "Mid-Level SDE (2-5 yr)", min: 16, max: 38 },
      { role: "Senior SDE (5-8 yr)", min: 28, max: 60 },
      { role: "Staff / Principal (8+ yr)", min: 45, max: 80 },
    ]} caption="EdTech salaries 2026 — PW and Scaler at top; BYJU's excluded due to financial distress" />
  ),

  "top-edtech-companies-india-2026||Honest Assessment: Which EdTech Companies Are Safe in 2026": (
    <TierCompare cards={[
      {
        tier: "Stable / Growing",
        examples: "Physics Wallah · Scaler · upGrad Enterprise",
        rows: [
          { label: "SDE-1 pay", range: "₹10–22 LPA" },
          { label: "SDE-2 pay", range: "₹20–45 LPA" },
          { label: "Layoff risk", range: "Low" },
        ],
      },
      {
        tier: "Uncertain",
        examples: "Unacademy · Vedantu · Simplilearn",
        rows: [
          { label: "SDE-1 pay", range: "₹8–18 LPA" },
          { label: "SDE-2 pay", range: "₹15–35 LPA" },
          { label: "Layoff risk", range: "Moderate" },
        ],
      },
      {
        tier: "Avoid / Distress",
        examples: "BYJU's (NDA ongoing) · WhiteHat Jr",
        rows: [
          { label: "SDE-1 pay", range: "₹6–12 LPA" },
          { label: "SDE-2 pay", range: "₹12–24 LPA" },
          { label: "Layoff risk", range: "Very high" },
        ],
      },
    ]} />
  ),

  /* top-healthtech-companies-india-2026: Industry Insights */
  "top-healthtech-companies-india-2026||HealthTech Salary Benchmarks and Career Paths 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Junior SDE (0-2 yr)", min: 8, max: 20 },
      { role: "Mid-Level SDE (2-5 yr)", min: 18, max: 40 },
      { role: "Senior SDE (5-8 yr)", min: 32, max: 65 },
      { role: "Staff / Principal (8+ yr)", min: 50, max: 80 },
    ]} caption="India HealthTech salaries 2026 — Tata 1mg/Practo at upper end; Apollo Healthco mid-range" />
  ),

  "top-healthtech-companies-india-2026||Practo and Tata 1mg: India's Two Largest Digital Health Platforms": (
    <TierCompare cards={[
      {
        tier: "Tata 1mg",
        examples: "E-pharmacy · Lab tests · Tata Group backing",
        rows: [
          { label: "SDE-1", range: "₹14–28 LPA" },
          { label: "SDE-2", range: "₹26–50 LPA" },
          { label: "Senior SDE", range: "₹42–72 LPA" },
        ],
      },
      {
        tier: "Practo",
        examples: "Clinic SaaS · Teleconsult · B2C health",
        rows: [
          { label: "SDE-1", range: "₹12–22 LPA" },
          { label: "SDE-2", range: "₹20–40 LPA" },
          { label: "Senior SDE", range: "₹35–60 LPA" },
        ],
      },
      {
        tier: "Pristyn Care / MediBuddy",
        examples: "Surgical tech · Corporate wellness",
        rows: [
          { label: "SDE-1", range: "₹10–20 LPA" },
          { label: "SDE-2", range: "₹18–35 LPA" },
          { label: "Senior SDE", range: "₹30–55 LPA" },
        ],
      },
    ]} />
  ),

  /* remote-jobs-india-software-engineer-2026: Industry Insights */
  "remote-jobs-india-software-engineer-2026||Remote Salary Benchmarks: India vs Foreign-Based Employer": (
    <TierCompare cards={[
      {
        tier: "Indian Remote Employer",
        examples: "Atlassian · Zerodha · ClearTax · Remote-native startups",
        rows: [
          { label: "SDE-1 (3-5 yr)", range: "₹20–50 LPA" },
          { label: "SDE-2 (5-8 yr)", range: "₹40–80 LPA" },
          { label: "Senior (8+ yr)", range: "₹65–110 LPA" },
        ],
      },
      {
        tier: "US/EU Remote (INR equiv)",
        examples: "Toptal · Remote.com clients · US startups",
        rows: [
          { label: "SDE-1 (3-5 yr)", range: "₹40–90 LPA" },
          { label: "SDE-2 (5-8 yr)", range: "₹80–160 LPA" },
          { label: "Senior (8+ yr)", range: "₹130–250 LPA" },
        ],
      },
      {
        tier: "Contractor / Freelance",
        examples: "Upwork · Turing · Andela · Arc.dev",
        rows: [
          { label: "Mid-Level", range: "₹30–80 LPA equiv" },
          { label: "Senior", range: "₹70–150 LPA equiv" },
          { label: "Tax note", range: "GST + income tax" },
        ],
      },
    ]} />
  ),

  "remote-jobs-india-software-engineer-2026||Which Companies Hire Fully Remote Software Engineers from India in 2026": (
    <SalaryLadder maxLPA={160} rows={[
      { role: "Indian Remote-First (Zerodha, ClearTax)", min: 18, max: 65, note: "India-based salary" },
      { role: "Global SaaS Remote (Atlassian, GitLab)", min: 35, max: 95, note: "India band" },
      { role: "US Product Co Remote (Stripe, Notion)", min: 60, max: 140, note: "~USD salary, India resident" },
      { role: "US Contractor via Platform (Turing, Arc)", min: 50, max: 160, note: "Gross, pre-tax" },
    ]} caption="Remote software engineer salaries from India 2026 — foreign employer rates converted at ₹83/USD" />
  ),

  /* top-fintech-companies-india-2026: Industry Insights */
  "top-fintech-companies-india-2026||Fintech Engineer Salaries in India 2026": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Junior Fintech SDE (0-2 yr)", min: 10, max: 25 },
      { role: "Mid-Level Fintech SDE (2-5 yr)", min: 22, max: 50 },
      { role: "Senior Fintech SDE (5-8 yr)", min: 40, max: 75 },
      { role: "Staff / Principal (8+ yr)", min: 60, max: 100 },
    ]} caption="India fintech engineer salaries 2026 — payments infra (Razorpay, PhonePe) at upper band" />
  ),

  "top-fintech-companies-india-2026||India's Top Fintech Engineering Employers in 2026": (
    <TierCompare cards={[
      {
        tier: "Payments Infra",
        examples: "Razorpay · PhonePe · Juspay · BillDesk",
        rows: [
          { label: "SDE-1", range: "₹20–40 LPA" },
          { label: "SDE-2", range: "₹35–65 LPA" },
          { label: "Senior", range: "₹55–90 LPA" },
        ],
      },
      {
        tier: "Wealth / Trading",
        examples: "Groww · Zerodha · Upstox · Angel One",
        rows: [
          { label: "SDE-1", range: "₹15–30 LPA" },
          { label: "SDE-2", range: "₹25–55 LPA" },
          { label: "Senior", range: "₹45–80 LPA" },
        ],
      },
      {
        tier: "NBFC / Lending",
        examples: "Bajaj Finserv · KreditBee · MoneyView",
        rows: [
          { label: "SDE-1", range: "₹10–22 LPA" },
          { label: "SDE-2", range: "₹18–38 LPA" },
          { label: "Senior", range: "₹32–58 LPA" },
        ],
      },
    ]} />
  ),

  /* top-gaming-companies-india-2026: Industry Insights */
  "top-gaming-companies-india-2026||Gaming Engineer Salaries in India 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Junior Game / Backend Eng (0-2 yr)", min: 8, max: 18 },
      { role: "Mid-Level Engineer (2-5 yr)", min: 16, max: 38 },
      { role: "Senior Engineer (5-8 yr)", min: 28, max: 60 },
      { role: "Staff / Lead (8+ yr)", min: 45, max: 80 },
    ]} caption="India gaming tech salaries 2026 — real-money gaming (Dream11, MPL) pays higher than game dev" />
  ),

  "top-gaming-companies-india-2026||India's Top Gaming Engineering Employers in 2026": (
    <TierCompare cards={[
      {
        tier: "Real-Money Gaming",
        examples: "Dream11 · MPL · Games24x7 · Zupee",
        rows: [
          { label: "SDE-1", range: "₹15–30 LPA" },
          { label: "SDE-2", range: "₹28–55 LPA" },
          { label: "Senior SDE", range: "₹45–78 LPA" },
        ],
      },
      {
        tier: "Mobile Game Dev",
        examples: "nCore Games · SuperGaming · Nautilus Mobile",
        rows: [
          { label: "SDE-1", range: "₹8–18 LPA" },
          { label: "SDE-2", range: "₹16–32 LPA" },
          { label: "Senior SDE", range: "₹28–50 LPA" },
        ],
      },
      {
        tier: "Global Studio India",
        examples: "Ubisoft India · EA India · Gameloft",
        rows: [
          { label: "SDE-1", range: "₹10–22 LPA" },
          { label: "SDE-2", range: "₹20–40 LPA" },
          { label: "Senior SDE", range: "₹35–60 LPA" },
        ],
      },
    ]} />
  ),

  /* data-engineering-jobs-india-2026: Industry Insights */
  "data-engineering-jobs-india-2026||Data Engineering Salaries in India 2026": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "Junior Data Engineer (0-2 yr)", min: 8, max: 20 },
      { role: "Data Engineer II (2-5 yr)", min: 18, max: 42 },
      { role: "Senior Data Engineer (5-8 yr)", min: 35, max: 68 },
      { role: "Staff / Principal DE (8+ yr)", min: 55, max: 90 },
    ]} caption="India data engineering salaries 2026 — Spark + Kafka + dbt stack commands top rates" />
  ),

  "data-engineering-jobs-india-2026||Data Engineering Skills Required in India 2026": (
    <TierCompare cards={[
      {
        tier: "Core Skills (must have)",
        examples: "SQL · Python · Apache Spark · Airflow",
        rows: [
          { label: "Salary without cloud", range: "₹12–35 LPA" },
          { label: "Salary with cloud", range: "₹20–55 LPA" },
          { label: "Companies", range: "All segments" },
        ],
      },
      {
        tier: "High-Value Add-ons",
        examples: "Kafka · dbt · Delta Lake · Databricks",
        rows: [
          { label: "Salary boost", range: "+₹5–15 LPA" },
          { label: "Senior range", range: "₹45–75 LPA" },
          { label: "Companies", range: "Product + fintech" },
        ],
      },
      {
        tier: "Cloud Platforms",
        examples: "AWS Glue / Redshift · GCP BigQuery · Azure Synapse",
        rows: [
          { label: "Certification bonus", range: "+₹3–8 LPA" },
          { label: "Senior cloud DE", range: "₹40–70 LPA" },
          { label: "Companies", range: "GCCs + cloud-native" },
        ],
      },
    ]} />
  ),

  /* cloud-computing-jobs-india-2026: Industry Insights */
  "cloud-computing-jobs-india-2026||Cloud Engineering Salaries in India 2026": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Cloud Support / Jr Engineer (0-2 yr)", min: 6, max: 16 },
      { role: "Cloud Engineer II (2-5 yr)", min: 16, max: 38 },
      { role: "Senior Cloud Engineer (5-8 yr)", min: 30, max: 62 },
      { role: "Cloud Architect (8-12 yr)", min: 50, max: 90 },
      { role: "Principal / CCoE Lead (12+ yr)", min: 75, max: 100 },
    ]} caption="India cloud engineering salaries 2026 — multi-cloud + FinOps expertise pushes into architect range" />
  ),

  "cloud-computing-jobs-india-2026||Cloud Computing Roles in Highest Demand in India 2026": (
    <TierCompare cards={[
      {
        tier: "Platform / SRE",
        examples: "Kubernetes · Terraform · Prometheus · Istio",
        rows: [
          { label: "Mid-Level", range: "₹22–45 LPA" },
          { label: "Senior", range: "₹40–70 LPA" },
          { label: "Demand", range: "Very high" },
        ],
      },
      {
        tier: "Cloud Security",
        examples: "CSPM · CWPP · IAM · AWS Security Hub",
        rows: [
          { label: "Mid-Level", range: "₹20–42 LPA" },
          { label: "Senior", range: "₹38–68 LPA" },
          { label: "Demand", range: "High / fast growing" },
        ],
      },
      {
        tier: "FinOps / Architecture",
        examples: "Cost optimisation · Multi-cloud · CCoE",
        rows: [
          { label: "Architect range", range: "₹50–90 LPA" },
          { label: "Principal range", range: "₹75–110 LPA" },
          { label: "Demand", range: "Growing" },
        ],
      },
    ]} />
  ),

  /* cybersecurity-jobs-india-2026: Industry Insights */
  "cybersecurity-jobs-india-2026||Cybersecurity Salaries in India 2026": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "Junior Security Analyst (0-2 yr)", min: 5, max: 14 },
      { role: "Security Engineer (2-5 yr)", min: 14, max: 35 },
      { role: "Senior Security Engineer (5-8 yr)", min: 28, max: 58 },
      { role: "Security Architect (8-12 yr)", min: 48, max: 80 },
      { role: "CISO / Principal (12+ yr)", min: 70, max: 90 },
    ]} caption="India cybersecurity salaries 2026 — Cloud Security and AppSec command highest premiums" />
  ),

  "cybersecurity-jobs-india-2026||Cybersecurity Roles in Highest Demand in India 2026": (
    <TierCompare cards={[
      {
        tier: "Cloud Security",
        examples: "AWS Security Hub · CSPM · Zero Trust · IAM",
        rows: [
          { label: "Mid-Level", range: "₹20–42 LPA" },
          { label: "Senior", range: "₹38–68 LPA" },
          { label: "Demand", range: "Fastest growing" },
        ],
      },
      {
        tier: "AppSec / DevSecOps",
        examples: "SAST · DAST · Threat Modelling · OWASP",
        rows: [
          { label: "Mid-Level", range: "₹18–38 LPA" },
          { label: "Senior", range: "₹32–62 LPA" },
          { label: "Demand", range: "Very high" },
        ],
      },
      {
        tier: "SOC / GRC / Compliance",
        examples: "SIEM · ISO 27001 · DPDP · PCI-DSS",
        rows: [
          { label: "Mid-Level", range: "₹12–28 LPA" },
          { label: "Senior", range: "₹22–45 LPA" },
          { label: "Demand", range: "Stable / high" },
        ],
      },
    ]} />
  ),

  /* top-startups-hiring-engineers-india-2026: Industry Insights */
  "top-startups-hiring-engineers-india-2026||Best Startups for Engineers by Stage in 2026": (
    <TierCompare cards={[
      {
        tier: "Late-Stage / Pre-IPO",
        examples: "Zepto · Meesho · Ola Electric · PhysicsWallah · IndiGo Tech",
        rows: [
          { label: "SDE-1", range: "₹18–38 LPA" },
          { label: "SDE-2", range: "₹32–65 LPA" },
          { label: "ESOP value", range: "High if IPO" },
        ],
      },
      {
        tier: "Series B/C (Growth)",
        examples: "Cred · BrowserStack · Sarvam AI · Krutrim",
        rows: [
          { label: "SDE-1", range: "₹14–30 LPA" },
          { label: "SDE-2", range: "₹25–52 LPA" },
          { label: "ESOP value", range: "Medium-high risk" },
        ],
      },
      {
        tier: "Early Stage (Seed/A)",
        examples: "AI-first B2B SaaS · Deep tech / robotics",
        rows: [
          { label: "SDE-1", range: "₹10–22 LPA" },
          { label: "SDE-2", range: "₹18–38 LPA" },
          { label: "ESOP value", range: "High risk / reward" },
        ],
      },
    ]} />
  ),

  "top-startups-hiring-engineers-india-2026||How to Evaluate ESOP Offers at Indian Startups": (
    <FrameworkSteps steps={[
      { number: "01", label: "Verify vesting schedule", hint: "Standard is 4-year vesting with 1-year cliff. Beware anything shorter — it signals early-exit risk." },
      { number: "02", label: "Calculate strike price vs 409A/FMV", hint: "Strike price should be at or near the FMV at grant time. A high strike vs current valuation makes options near-worthless." },
      { number: "03", label: "Check exercise window", hint: "Post-termination exercise window (PTEW) should be 5–10 years, not 90 days. 90-day windows force you to buy or lose." },
      { number: "04", label: "Understand liquidation preferences", hint: "1x non-participating is fair. 2x participating preferred means investors take double before common shareholders (you) see anything." },
      { number: "05", label: "Assess IPO or acquisition likelihood", hint: "Ask about runway, revenue, and growth rate. Options are only valuable at a liquidity event. Most Indian startups never IPO." },
    ]} />
  ),

  /* ── Role Guides & Product ── */
  /* Java Developer: salary ladder by experience level */
  "java-developer-interview-questions-india-2026||Java Developer Salary in India 2026 and Career Path": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Fresher / Trainee (0–1 yr)", min: 4, max: 10 },
      { role: "Junior Java Developer (1–3 yrs)", min: 8, max: 18 },
      { role: "Java Developer (3–5 yrs)", min: 15, max: 30 },
      { role: "Senior Java Developer (5–8 yrs)", min: 25, max: 50 },
      { role: "Lead / Principal Engineer (8+ yrs)", min: 40, max: 80 },
    ]} caption="India 2026 — Spring Boot + Microservices experience commands top of band" />
  ),

  /* Java Developer: career path framework */
  "java-developer-interview-questions-india-2026||Core Java Topics: The Foundation for All Java Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Core Java Mastery", hint: "OOP, Collections, Generics, Exceptions, JVM internals" },
      { number: "02", label: "Spring Boot Ecosystem", hint: "REST APIs, Spring Data JPA, Security, AOP" },
      { number: "03", label: "Database Depth", hint: "SQL optimization, Hibernate, connection pooling, caching" },
      { number: "04", label: "Microservices Architecture", hint: "Service decomposition, Kafka, circuit breakers, Docker/K8s" },
      { number: "05", label: "System Design & Leadership", hint: "HLD/LLD, distributed systems, mentoring, tech decisions" },
    ]} />
  ),

  /* Data Analyst (Role Guide): salary ladder */
  "data-analyst-interview-questions-india-2026||Data Analyst Salary in India 2026 and Career Paths": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "Fresher Data Analyst (0–1 yr)", min: 4, max: 8 },
      { role: "Data Analyst (1–3 yrs)", min: 7, max: 15 },
      { role: "Senior Data Analyst (3–6 yrs)", min: 12, max: 25 },
      { role: "Lead / Analytics Manager (6–10 yrs)", min: 20, max: 40 },
      { role: "Principal / Head of Analytics (10+ yrs)", min: 30, max: 45, note: "Product companies pay premium" },
    ]} caption="India 2026 — SQL + Python + business domain expertise maximise compensation" />
  ),

  /* Data Analyst (Role Guide): career path framework */
  "data-analyst-interview-questions-india-2026||SQL Interview Questions for Data Analysts in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "SQL Mastery", hint: "Window functions, CTEs, query optimisation, indexing basics" },
      { number: "02", label: "Python + Pandas", hint: "Data wrangling, EDA, visualisation with matplotlib/seaborn" },
      { number: "03", label: "Business Analytics", hint: "KPIs, funnel analysis, cohort analysis, A/B testing basics" },
      { number: "04", label: "BI and Dashboarding", hint: "Tableau, Looker, or Power BI; stakeholder communication" },
      { number: "05", label: "Statistical and ML Fluency", hint: "Regression, hypothesis testing, basic ML model interpretation" },
    ]} />
  ),

  /* Product Manager (Role Guide, first instance): salary ladder */
  "product-manager-interview-questions-india-2026||PM Salary and Career Path in India 2026": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "APM / Junior PM (0–2 yrs)", min: 15, max: 30, note: "MBA or SWE background preferred" },
      { role: "PM (2–4 yrs)", min: 25, max: 50 },
      { role: "Senior PM (4–7 yrs)", min: 40, max: 80 },
      { role: "Group PM / Staff PM (7–10 yrs)", min: 60, max: 100 },
      { role: "Director of Product (10+ yrs)", min: 80, max: 120 },
    ]} caption="India 2026 — Flipkart, PhonePe, Swiggy, and FAANG India pay top-of-band" />
  ),

  /* Product Manager (Role Guide, first instance): framework for product design questions */
  "product-manager-interview-questions-india-2026||Product Design Questions: The Core PM Filter": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify the Goal", hint: "Who is the user? What metric defines success? What are constraints?" },
      { number: "02", label: "Define the User", hint: "Segment users, identify pain points, prioritise the primary persona" },
      { number: "03", label: "List Solutions", hint: "Brainstorm 3–5 solutions across impact and feasibility axes" },
      { number: "04", label: "Prioritise and Trade-off", hint: "Pick one solution, justify it vs alternatives using data/logic" },
      { number: "05", label: "Define Success Metrics", hint: "Primary metric + guardrail metrics + how you would measure them" },
    ]} />
  ),

  /* Frontend Developer (Role Guide): salary ladder */
  "frontend-developer-interview-questions-india-2026||Frontend Developer Salary in India 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Junior Frontend Developer (0–2 yrs)", min: 6, max: 14 },
      { role: "Frontend Developer (2–4 yrs)", min: 12, max: 25 },
      { role: "Senior Frontend Developer (4–7 yrs)", min: 22, max: 45 },
      { role: "Lead / Staff Frontend Engineer (7+ yrs)", min: 35, max: 55, note: "React Native or performance specialisation adds premium" },
    ]} caption="India 2026 — React + TypeScript + performance engineering commands highest salaries" />
  ),

  /* Frontend Developer (Role Guide): JavaScript deep dive framework */
  "frontend-developer-interview-questions-india-2026||JavaScript Deep Dive: The Foundation of Every Frontend Interview": (
    <FrameworkSteps steps={[
      { number: "01", label: "JavaScript Core", hint: "Closures, prototypes, event loop, async/await, `this` binding" },
      { number: "02", label: "React Depth", hint: "Hooks, reconciliation, memoisation, state management patterns" },
      { number: "03", label: "CSS and Browser Internals", hint: "Box model, flexbox/grid, rendering pipeline, repaints vs reflows" },
      { number: "04", label: "Performance Engineering", hint: "Lazy loading, bundle splitting, Core Web Vitals, LCP/CLS/INP" },
      { number: "05", label: "Frontend System Design", hint: "Component architecture, design systems, micro-frontends, accessibility" },
    ]} />
  ),

  /* ML Engineer (Role Guide): salary ladder */
  "machine-learning-engineer-interview-questions-india-2026||Python Coding and MLE Salary in India 2026": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "Junior MLE (0–2 yrs)", min: 10, max: 22 },
      { role: "MLE (2–4 yrs)", min: 18, max: 40 },
      { role: "Senior MLE (4–7 yrs)", min: 32, max: 65 },
      { role: "Staff / Principal MLE (7+ yrs)", min: 55, max: 90, note: "LLM/GenAI specialists command top of band" },
    ]} caption="India 2026 — GenAI and LLM fine-tuning skills command 30–50% premium over classical ML" />
  ),

  /* ML Engineer (Role Guide): fundamentals framework */
  "machine-learning-engineer-interview-questions-india-2026||ML Fundamentals: What Every Indian MLE Interview Tests": (
    <FrameworkSteps steps={[
      { number: "01", label: "ML Theory Foundations", hint: "Bias-variance, regularisation, optimisation algorithms, evaluation metrics" },
      { number: "02", label: "Python and ML Libraries", hint: "NumPy, pandas, scikit-learn, PyTorch or TensorFlow proficiency" },
      { number: "03", label: "ML System Design", hint: "Feature stores, training pipelines, serving infrastructure, A/B testing" },
      { number: "04", label: "GenAI and LLM Skills", hint: "Prompt engineering, RAG, fine-tuning, vector databases, LangChain" },
      { number: "05", label: "MLOps", hint: "Model versioning (MLflow), deployment (BentoML/Triton), monitoring drift" },
    ]} />
  ),

  /* Backend Developer (Role Guide): salary ladder */
  "backend-developer-interview-questions-india-2026||Backend Developer Salary and Career Path in India 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Junior Backend Developer (0–2 yrs)", min: 6, max: 15 },
      { role: "Backend Developer (2–4 yrs)", min: 14, max: 28 },
      { role: "Senior Backend Developer (4–7 yrs)", min: 25, max: 50 },
      { role: "Staff / Principal Engineer (7–10 yrs)", min: 40, max: 70 },
      { role: "Distinguished Engineer (10+ yrs)", min: 55, max: 80, note: "Rare; primarily at FAANG and top unicorns" },
    ]} caption="India 2026 — Golang, Java, or distributed systems expertise at scale pays top of band" />
  ),

  /* Backend Developer (Role Guide): language choice framework */
  "backend-developer-interview-questions-india-2026||Which Backend Language to Use in Indian Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Pick Your Primary Language", hint: "Java for enterprise, Python for data-adjacent, Go for performance, Node for startups" },
      { number: "02", label: "Master Database Design", hint: "Relational modelling, indexing, query planning, caching strategies" },
      { number: "03", label: "API and Distributed Patterns", hint: "REST, gRPC, event-driven with Kafka, idempotency, circuit breakers" },
      { number: "04", label: "Concurrency and Performance", hint: "Thread pools, async I/O, connection pooling, profiling and benchmarking" },
      { number: "05", label: "System Design Fluency", hint: "Scalability patterns, CAP theorem, consistent hashing, rate limiting" },
    ]} />
  ),

  /* DevOps/SRE (Role Guide, first instance): salary ladder */
  "devops-sre-interview-questions-india-2026||DevOps and SRE Salary and Career Path in India 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Junior DevOps / Platform Engineer (0–2 yrs)", min: 7, max: 16 },
      { role: "DevOps Engineer (2–4 yrs)", min: 14, max: 28 },
      { role: "Senior DevOps / SRE (4–7 yrs)", min: 25, max: 50 },
      { role: "Staff SRE / Platform Lead (7+ yrs)", min: 40, max: 70, note: "K8s + Terraform + observability expertise commands top pay" },
    ]} caption="India 2026 — SRE roles at product companies pay 20–30% more than DevOps at service IT" />
  ),

  /* DevOps/SRE (Role Guide, first instance): K8s framework */
  "devops-sre-interview-questions-india-2026||Kubernetes and Container Orchestration Questions": (
    <FrameworkSteps steps={[
      { number: "01", label: "Containerisation Fundamentals", hint: "Docker internals, image layering, multi-stage builds, registries" },
      { number: "02", label: "Kubernetes Core", hint: "Pods, Deployments, Services, Ingress, ConfigMaps, Secrets" },
      { number: "03", label: "CI/CD Pipeline Design", hint: "Jenkins/GitHub Actions, GitOps with ArgoCD, rollback strategies" },
      { number: "04", label: "Observability Stack", hint: "Prometheus, Grafana, ELK/Loki, distributed tracing, SLO/SLA/SLI" },
      { number: "05", label: "Infrastructure as Code", hint: "Terraform, Helm charts, cloud-native patterns on AWS/GCP/Azure" },
    ]} />
  ),

  /* Android Developer (Role Guide, first instance): salary ladder */
  "android-developer-interview-questions-india-2026||Android Developer Salary in India 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Junior Android Developer (0–2 yrs)", min: 6, max: 14 },
      { role: "Android Developer (2–4 yrs)", min: 12, max: 25 },
      { role: "Senior Android Developer (4–7 yrs)", min: 22, max: 45 },
      { role: "Lead / Principal Android Engineer (7+ yrs)", min: 35, max: 55, note: "Kotlin Multiplatform skills add premium" },
    ]} caption="India 2026 — Jetpack Compose + Kotlin Coroutines is the dominant skill stack" />
  ),

  /* Android Developer (Role Guide, first instance): Kotlin fundamentals framework */
  "android-developer-interview-questions-india-2026||Kotlin Fundamentals: What Every Android Interview Tests": (
    <FrameworkSteps steps={[
      { number: "01", label: "Kotlin Language Depth", hint: "Coroutines, Flow, data/sealed classes, extension functions, generics" },
      { number: "02", label: "Android Architecture", hint: "MVVM + Clean Architecture, Hilt/Dagger DI, Repository pattern" },
      { number: "03", label: "Jetpack Compose", hint: "Composable functions, state hoisting, recomposition, navigation" },
      { number: "04", label: "Performance on Low-End Devices", hint: "Memory profiling, ANR avoidance, startup time, battery optimisation" },
      { number: "05", label: "Testing and CI/CD", hint: "JUnit, Espresso, Robolectric, Firebase Test Lab, GitHub Actions" },
    ]} />
  ),

  /* Data Engineer (Role Guide): salary ladder */
  "data-engineer-interview-questions-india-2026||Data Engineer Salary and Career Path in India 2026": (
    <SalaryLadder maxLPA={65} rows={[
      { role: "Junior Data Engineer (0–2 yrs)", min: 8, max: 16 },
      { role: "Data Engineer (2–4 yrs)", min: 14, max: 28 },
      { role: "Senior Data Engineer (4–7 yrs)", min: 24, max: 45 },
      { role: "Staff / Principal Data Engineer (7+ yrs)", min: 38, max: 65, note: "Spark + Kafka + dbt + cloud data stack expertise" },
    ]} caption="India 2026 — Real-time streaming (Kafka + Flink) expertise commands 20% premium over batch-only" />
  ),

  /* Data Engineer (Role Guide): Spark framework */
  "data-engineer-interview-questions-india-2026||Apache Spark Interview Questions": (
    <FrameworkSteps steps={[
      { number: "01", label: "SQL and Data Modelling", hint: "Star/snowflake schema, slowly changing dimensions, query optimisation" },
      { number: "02", label: "Apache Spark", hint: "RDD vs DataFrame, partitioning, caching, broadcast joins, Spark SQL" },
      { number: "03", label: "Real-Time Streaming", hint: "Kafka producers/consumers, Kafka Streams, Spark Structured Streaming" },
      { number: "04", label: "Pipeline Orchestration", hint: "Apache Airflow DAGs, dbt transformations, data quality testing" },
      { number: "05", label: "Cloud Data Stacks", hint: "BigQuery/Redshift/Snowflake, Delta Lake, cloud storage patterns" },
    ]} />
  ),

  /* System Design (Role Guide): career framework */
  "system-design-interview-questions-india-2026||The System Design Interview Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify Requirements", hint: "Functional requirements, scale targets (QPS/DAU), latency SLA, constraints" },
      { number: "02", label: "Estimate Scale", hint: "Storage, bandwidth, QPS calculations — anchor your design to real numbers" },
      { number: "03", label: "High-Level Design", hint: "Core components: clients, API layer, services, databases, cache, CDN" },
      { number: "04", label: "Deep Dive", hint: "Pick 2–3 critical components the interviewer signals; go deep on trade-offs" },
      { number: "05", label: "Address Bottlenecks", hint: "Identify single points of failure, discuss sharding, replication, failover" },
      { number: "06", label: "Wrap Up", hint: "Summarise trade-offs, mention monitoring, future scalability considerations" },
    ]} />
  ),

  /* System Design (Role Guide): salary ladder for senior engineers */
  "system-design-interview-questions-india-2026||How to Practise System Design for Indian Interviews": (
    <SalaryLadder maxLPA={90} rows={[
      { role: "SDE-1 / Junior (system design not expected)", min: 12, max: 25 },
      { role: "SDE-2 / Mid-Level (basic HLD expected)", min: 22, max: 45 },
      { role: "SDE-3 / Senior (full system design required)", min: 38, max: 70 },
      { role: "Staff Engineer (leads the system design round)", min: 55, max: 90, note: "Can make or break the hire decision" },
    ]} caption="India 2026 — System design is the gate for SDE-2+ roles at product companies" />
  ),

  /* iOS Developer (Role Guide): salary ladder */
  "ios-developer-interview-questions-india-2026||iOS Architecture and iOS Developer Salary in India 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Junior iOS Developer (0–2 yrs)", min: 6, max: 14 },
      { role: "iOS Developer (2–4 yrs)", min: 12, max: 25 },
      { role: "Senior iOS Developer (4–7 yrs)", min: 22, max: 45 },
      { role: "Lead / Principal iOS Engineer (7+ yrs)", min: 35, max: 55, note: "SwiftUI + Combine + performance depth commands top pay" },
    ]} caption="India 2026 — iOS roles are rarer than Android; premium exists for experienced engineers" />
  ),

  /* iOS Developer (Role Guide): Swift fundamentals framework */
  "ios-developer-interview-questions-india-2026||Swift Fundamentals Tested in iOS Developer Interviews in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Swift Language Depth", hint: "Optionals, value vs reference types, generics, protocols, error handling" },
      { number: "02", label: "Concurrency: async/await and Actors", hint: "Structured concurrency, MainActor, async sequences, migration from GCD" },
      { number: "03", label: "UIKit vs SwiftUI", hint: "UIViewController lifecycle, SwiftUI declarative model, interoperability" },
      { number: "04", label: "iOS Architecture", hint: "MVC vs MVVM vs TCA, Combine or async/await for data flow, modularisation" },
      { number: "05", label: "Performance and Testing", hint: "Instruments profiling, XCTest, memory leaks, App Store submission" },
    ]} />
  ),

  /* QA/SDET (Role Guide): salary ladder */
  "qa-sdet-interview-questions-india-2026||SDET Salary Benchmarks and Career Paths in India 2026": (
    <SalaryLadder maxLPA={45} rows={[
      { role: "QA Engineer (0–2 yrs)", min: 4, max: 10 },
      { role: "SDET / Automation Engineer (2–4 yrs)", min: 8, max: 18 },
      { role: "Senior SDET (4–7 yrs)", min: 15, max: 30 },
      { role: "QA Lead / Principal SDET (7+ yrs)", min: 24, max: 45, note: "Performance and security testing expertise boosts pay" },
    ]} caption="India 2026 — Selenium + Cypress + API automation + CI/CD integration is the core skill set" />
  ),

  /* QA/SDET (Role Guide): QA vs SDET framework */
  "qa-sdet-interview-questions-india-2026||QA Engineer vs SDET: Understanding the Difference for Indian Tech Careers": (
    <FrameworkSteps steps={[
      { number: "01", label: "Manual Testing Mastery", hint: "Test planning, BDD/Gherkin, exploratory testing, defect reporting" },
      { number: "02", label: "Automation Foundations", hint: "Selenium WebDriver, TestNG/JUnit, page object model, locator strategies" },
      { number: "03", label: "API and Backend Testing", hint: "Postman, RestAssured, contract testing with Pact, database validation" },
      { number: "04", label: "CI/CD Integration", hint: "Jenkins/GitHub Actions pipelines, Docker test environments, parallel runs" },
      { number: "05", label: "Performance and Security", hint: "JMeter/Gatling load testing, OWASP top-10 basics, static analysis" },
    ]} />
  ),

  /* Full-Stack Developer (Role Guide): salary ladder */
  "full-stack-developer-interview-questions-india-2026||Full-Stack Portfolio Projects and Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Junior Full-Stack Developer (0–2 yrs)", min: 7, max: 16 },
      { role: "Full-Stack Developer (2–4 yrs)", min: 14, max: 28 },
      { role: "Senior Full-Stack Developer (4–7 yrs)", min: 24, max: 50 },
      { role: "Lead / Principal Full-Stack Engineer (7+ yrs)", min: 40, max: 70, note: "MERN or MEAN with cloud-native delivery" },
    ]} caption="India 2026 — React + Node.js + PostgreSQL + AWS remains the most in-demand full-stack combination" />
  ),

  /* Full-Stack Developer (Role Guide): interview framework */
  "full-stack-developer-interview-questions-india-2026||Frontend Interview Topics for Full-Stack Roles in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Frontend Depth", hint: "JavaScript event loop, React hooks and performance, CSS layout mastery" },
      { number: "02", label: "Backend Proficiency", hint: "REST API design, Node.js/Express, authentication patterns, error handling" },
      { number: "03", label: "Database Skills", hint: "SQL (joins, indexes), NoSQL (MongoDB), ORM usage, schema design" },
      { number: "04", label: "End-to-End System Design", hint: "Feature-level design covering frontend, API, DB, caching, and deployment" },
      { number: "05", label: "DevOps Basics", hint: "Docker, CI/CD pipeline, deployment to AWS/GCP, monitoring fundamentals" },
    ]} />
  ),

  /* Product Manager (Role Guide, second instance): salary ladder */
  "product-manager-interview-questions-india-2026||PM Salaries in India 2026": (
    <SalaryLadder maxLPA={120} rows={[
      { role: "APM / Associate PM (0–2 yrs)", min: 15, max: 30, note: "MBA programs or new-grad APM tracks" },
      { role: "Product Manager (2–5 yrs)", min: 28, max: 55 },
      { role: "Senior PM (5–8 yrs)", min: 45, max: 85 },
      { role: "Group PM / Director of Product (8+ yrs)", min: 70, max: 120 },
    ]} caption="India 2026 — Razorpay, PhonePe, Flipkart, CRED, and FAANG India pay highest PM salaries" />
  ),

  /* Product Manager (Role Guide, second instance): product design framework */
  "product-manager-interview-questions-india-2026||Product Design Framework for Indian PM Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Understand the User", hint: "Define user segments, map journeys, identify the top pain point" },
      { number: "02", label: "Define the Problem", hint: "Reframe the prompt as a 'How might we...' with clear success definition" },
      { number: "03", label: "Generate Solutions", hint: "Brainstorm broadly, then narrow using impact vs effort analysis" },
      { number: "04", label: "Prioritise", hint: "Use RICE or ICE scoring; explain your trade-offs explicitly" },
      { number: "05", label: "Measure Success", hint: "North star metric + 2–3 guardrail metrics + experiment design" },
    ]} />
  ),

  /* Data Scientist (Role Guide): salary ladder */
  "data-scientist-interview-questions-india-2026||Data Scientist Salaries in India 2026": (
    <SalaryLadder maxLPA={75} rows={[
      { role: "Junior Data Scientist (0–2 yrs)", min: 8, max: 18 },
      { role: "Data Scientist (2–4 yrs)", min: 16, max: 35 },
      { role: "Senior Data Scientist (4–7 yrs)", min: 28, max: 55 },
      { role: "Principal / Staff Data Scientist (7+ yrs)", min: 45, max: 75, note: "Causal inference and experimentation depth commands top pay" },
    ]} caption="India 2026 — Statistics depth + ML engineering skills + business acumen is the winning combination" />
  ),

  /* Data Scientist (Role Guide): interview framework */
  "data-scientist-interview-questions-india-2026||Data Scientist Interview Question Types in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Statistics and Probability", hint: "Distributions, hypothesis testing, p-values, A/B test design, CLT" },
      { number: "02", label: "Machine Learning Depth", hint: "Model selection, feature engineering, regularisation, evaluation metrics" },
      { number: "03", label: "SQL and Python", hint: "Complex SQL (window functions, CTEs), pandas data manipulation, EDA" },
      { number: "04", label: "ML System Design", hint: "Recommenders, fraud detection, feature stores, training vs serving" },
      { number: "05", label: "Business Case and Product Intuition", hint: "Metric definition, root cause analysis, experiment interpretation" },
    ]} />
  ),

  /* DevOps/SRE (Role Guide, second instance): salary ladder */
  "devops-sre-interview-questions-india-2026||DevOps/SRE Salaries in India 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Junior DevOps Engineer (0–2 yrs)", min: 7, max: 16 },
      { role: "DevOps / Platform Engineer (2–4 yrs)", min: 14, max: 28 },
      { role: "Senior SRE / DevOps (4–7 yrs)", min: 26, max: 50 },
      { role: "Staff SRE / Platform Architect (7+ yrs)", min: 42, max: 70, note: "Platform engineering at unicorns pays at top of band" },
    ]} caption="India 2026 — SRE roles at Razorpay, PhonePe, and Google India pay significantly above market" />
  ),

  /* DevOps/SRE (Role Guide, second instance): K8s and infra framework */
  "devops-sre-interview-questions-india-2026||Kubernetes and Infrastructure Topics in DevOps/SRE Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Linux and Networking Foundations", hint: "Processes, filesystems, TCP/IP, DNS, load balancing concepts" },
      { number: "02", label: "Containerisation and Kubernetes", hint: "Docker, K8s architecture, Helm, scheduling, RBAC, network policies" },
      { number: "03", label: "CI/CD and GitOps", hint: "Pipeline design, ArgoCD/Flux, blue-green and canary deployments" },
      { number: "04", label: "Observability", hint: "Metrics (Prometheus/Grafana), logs (ELK/Loki), traces (Jaeger), SLOs" },
      { number: "05", label: "Cloud Infrastructure", hint: "IaC with Terraform, cloud cost optimisation, multi-region reliability" },
    ]} />
  ),

  /* Android Developer (Role Guide, second instance): salary ladder */
  "android-developer-interview-questions-india-2026||Android Developer Salaries in India 2026": (
    <SalaryLadder maxLPA={55} rows={[
      { role: "Junior Android Developer (0–2 yrs)", min: 6, max: 14 },
      { role: "Android Developer (2–4 yrs)", min: 12, max: 25 },
      { role: "Senior Android Developer (4–7 yrs)", min: 22, max: 45 },
      { role: "Lead / Principal Android Engineer (7+ yrs)", min: 35, max: 55 },
    ]} caption="India 2026 — Companies like PhonePe, Swiggy, Razorpay, and CRED pay top Android salaries" />
  ),

  /* Android Developer (Role Guide, second instance): Kotlin depth framework */
  "android-developer-interview-questions-india-2026||Kotlin Depth Tested in Android Developer Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Kotlin Core", hint: "Coroutines, Flow, sealed classes, delegation, inline functions" },
      { number: "02", label: "Architecture (MVVM + Clean)", hint: "ViewModel, LiveData vs StateFlow, Use Cases, Repository, Hilt DI" },
      { number: "03", label: "Jetpack Compose", hint: "State management, side effects, navigation, lazy lists, theming" },
      { number: "04", label: "Performance and Debugging", hint: "Memory leaks (LeakCanary), Baseline Profiles, ANR detection" },
      { number: "05", label: "Testing", hint: "Unit tests (JUnit + MockK), integration tests, UI tests (Espresso/Compose)" },
    ]} />
  ),

  /* ── Behavioral, Interview Skills & Strategy ── */
  /* ── Behavioral Posts ── */

  /* Behavioral: top-10-google-interview-questions */
  "top-10-google-interview-questions||1. Tell me about a time you led a project with ambiguous requirements": (
    <FrameworkSteps steps={[
      { number: "S", label: "Set the Scene", hint: "Name the project, org context, and why requirements were unclear — 2 sentences max" },
      { number: "T", label: "State YOUR Task", hint: "What were YOU specifically responsible for deciding or delivering?" },
      { number: "A", label: "Describe YOUR Actions", hint: "List 2–3 concrete choices: how you gathered clarity, who you aligned with, what trade-offs you made" },
      { number: "R", label: "Quantify the Result", hint: "Ship date hit? Error rate? User impact? Metric that proves success" },
    ]} />
  ),

  /* Behavioral: hr-interview-questions-answers-india */
  "hr-interview-questions-answers-india||Answering 'What Are Your Weaknesses?'": (
    <FrameworkSteps steps={[
      { number: "01", label: "Name a Real Weakness", hint: "Pick something genuine but not core to the job — e.g. public speaking, perfectionism on low-stakes tasks" },
      { number: "02", label: "Show Self-Awareness", hint: "Explain when and how you noticed this weakness with a brief, specific example" },
      { number: "03", label: "Describe What You Did", hint: "Name the exact steps you took: course, practice, system, or mentor" },
      { number: "04", label: "Show Progress", hint: "Mention a measurable improvement or recent win that demonstrates you are actively closing the gap" },
    ]} />
  ),

  /* Behavioral: hr-interview-questions-india-2026 — Tell Me About Yourself */
  "hr-interview-questions-india-2026||Tell Me About Yourself: How to Answer": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — Who You Are Now", hint: "Current role, tech stack, and the type of problems you solve. 1–2 sentences." },
      { number: "02", label: "Past — What Built You", hint: "1 key experience or project that is directly relevant to this role. Skip unrelated history." },
      { number: "03", label: "Future — Why This Role", hint: "Connect your trajectory to this company's domain or problem space. Make it specific." },
    ]} />
  ),

  /* Behavioral: tell-me-about-yourself-fresher-india-2026 */
  "tell-me-about-yourself-answer-fresher-india-2026||The Formula: Present → Past → Future (Under 90 Seconds)": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — Name + Degree + Branch", hint: "'I am a final-year CSE student at [College].' One sentence. No fluff." },
      { number: "02", label: "Past — One Strong Project or Internship", hint: "Name it, state the tech, and give one outcome metric. 2 sentences." },
      { number: "03", label: "Future — Why This Company", hint: "Tie your interest to the company's product or domain. Avoid generic 'growth opportunities'." },
      { number: "04", label: "Close — Invite Conversation", hint: "'I would love to contribute to [specific area] here.' Signals clarity and confidence." },
    ]} />
  ),

  /* Behavioral: why-do-you-want-to-join-our-company-answer-india-2026 */
  "why-do-you-want-to-join-our-company-answer-india-2026||The Framework: Why This Company, Why This Role, Why Now": (
    <FrameworkSteps steps={[
      { number: "01", label: "Why This Company", hint: "Name one specific product, initiative, or technology — not 'good reputation'. Show you researched." },
      { number: "02", label: "Why This Role", hint: "Map 1–2 skills from your background directly to what this role demands." },
      { number: "03", label: "Why Now", hint: "Explain the career inflection point: what you are ready to do next and why timing matters." },
      { number: "04", label: "Tie It Together", hint: "One sentence connecting company mission + your skill + your timing into a coherent narrative." },
    ]} />
  ),

  /* Behavioral: career-gap-explanation-interview-india-2026 */
  "career-gap-explanation-interview-india-2026||The Core Principle: Frame, Don't Apologise": (
    <FrameworkSteps steps={[
      { number: "01", label: "Acknowledge the Gap Briefly", hint: "State the dates and reason in one sentence. No over-explaining, no apologies." },
      { number: "02", label: "What You Did During the Gap", hint: "Name any upskilling, freelance work, certification, or caregiving. Even informal learning counts." },
      { number: "03", label: "What You Learned or Built", hint: "One concrete output: a project, a certificate, a skill now directly relevant to this role." },
      { number: "04", label: "Bridge to Today", hint: "'I am now ready to …' — forward-looking statement that closes the gap narrative." },
    ]} />
  ),

  /* Behavioral: star-method-interview-answers-india-2026 */
  "star-method-interview-answers-india-2026||How STAR Works: and Where Most Candidates Go Wrong": (
    <FrameworkSteps steps={[
      { number: "S", label: "Situation — Set Context Fast", hint: "One sentence: company type, team size, the business condition. Do NOT spend more than 15% of your time here." },
      { number: "T", label: "Task — YOUR Responsibility", hint: "What were YOU asked to own or deliver? Distinguish your role from the team's role." },
      { number: "A", label: "Action — What YOU Did", hint: "3–4 specific actions. Use 'I' not 'we'. This is 60% of your answer and where most candidates are too vague." },
      { number: "R", label: "Result — Numbers Win", hint: "Quantify: time saved, revenue impact, error reduction, user growth. If no number, state the business outcome." },
    ]} />
  ),

  /* Behavioral: walk-me-through-your-resume-answer-guide */
  "walk-me-through-your-resume-answer-guide||The PPF Framework: Present, Past, Future": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — Current Role & Impact", hint: "What you do now and one metric or outcome you are proud of. 30 seconds." },
      { number: "02", label: "Past — The Thread That Connects", hint: "1–2 experiences that built the skill most relevant to THIS role. Skip everything else." },
      { number: "03", label: "Future — Why Here, Why Now", hint: "Where you want to go and why this company is the right next step. Be specific." },
      { number: "04", label: "Invite Depth", hint: "'Happy to go deeper on any of these.' Signals confidence and hands control to the interviewer." },
    ]} />
  ),

  /* Behavioral: where-do-you-see-yourself-in-5-years-answer */
  "where-do-you-see-yourself-in-5-years-answer||The Formula: Skill + Impact + Alignment": (
    <FrameworkSteps steps={[
      { number: "01", label: "Skill — What You Want to Master", hint: "Name a specific technical or leadership capability. Vague answers ('grow as a professional') signal no vision." },
      { number: "02", label: "Impact — What Problem You Want to Solve", hint: "Connect the skill to a business or product outcome you want to own." },
      { number: "03", label: "Alignment — Why This Company Is the Path", hint: "Show how this role builds toward your goal. Avoid answers that work at any company." },
    ]} />
  ),

  /* Behavioral: tell-me-about-yourself-experienced-professionals-india */
  "tell-me-about-yourself-experienced-professionals-india||The Strategic Answer Architecture": (
    <FrameworkSteps steps={[
      { number: "01", label: "Open with Your Current Role and Scope", hint: "Job title, team size or product scale, and the type of impact you drive. 1 sentence." },
      { number: "02", label: "Pick ONE Career Highlight", hint: "The one achievement most relevant to this company's domain. Metrics required." },
      { number: "03", label: "State What You Are Looking For", hint: "Specific challenge, scale, or technology. Not 'new opportunity' — be precise." },
      { number: "04", label: "Close with Why This Company", hint: "Connect their product or mission to what you just said you want. 1 sentence." },
    ]} />
  ),

  /* Behavioral: how-to-answer-what-are-your-weaknesses-india */
  "how-to-answer-what-are-your-weaknesses-india||The Formula That Works": (
    <FrameworkSteps steps={[
      { number: "01", label: "Name the Weakness Directly", hint: "State it in one sentence. No hedging ('my weakness is I work too hard'). That answer is rejected." },
      { number: "02", label: "Give a Specific Past Example", hint: "A brief story where this weakness created a real, minor problem. Shows authenticity." },
      { number: "03", label: "Describe Your Mitigation System", hint: "The habit, tool, or process you now use to prevent the weakness from causing problems." },
      { number: "04", label: "Show Recent Progress", hint: "One recent result or situation where your mitigation system worked." },
    ]} />
  ),

  /* Behavioral: star-method-interview-examples-india */
  "star-method-interview-examples-india||The STAR Framework Explained": (
    <FrameworkSteps steps={[
      { number: "S", label: "Situation", hint: "Set the context in 1–2 sentences: org type, team, the specific challenge or opportunity." },
      { number: "T", label: "Task", hint: "YOUR specific responsibility. Make it clear this was YOUR task, not the team's." },
      { number: "A", label: "Action", hint: "3 concrete steps YOU took. Use 'I chose…', 'I built…', 'I proposed…'. Avoid 'we'." },
      { number: "R", label: "Result", hint: "Quantified outcome: percentage, INR, time saved, users impacted. End with business impact." },
    ]} />
  ),

  /* Behavioral: tell-me-about-yourself-answer-india-2026 */
  "tell-me-about-yourself-answer-india-2026||The 3-part formula that works in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — Current Role or Status", hint: "Who you are professionally right now. For freshers: degree + college + relevant project. For experienced: role + company + key impact." },
      { number: "02", label: "Past — What Led Here", hint: "The most relevant experience or decision that connects your background to this role. One example only." },
      { number: "03", label: "Future — Why This Role", hint: "What you want to achieve next and why this specific company is the right fit. Avoid generic answers." },
    ]} />
  ),

  /* Behavioral: behavioral-interview-questions-india-2026 */
  "behavioral-interview-questions-india-2026||The STAR Framework: Applied Correctly": (
    <FrameworkSteps steps={[
      { number: "S", label: "Situation — Context Only (15%)", hint: "One sentence: industry, team size, the triggering event. Interviewers do not need your full project history." },
      { number: "T", label: "Task — Your Ownership (10%)", hint: "Define exactly what YOU were accountable for. Differentiate from what the team did." },
      { number: "A", label: "Action — Your Decisions (60%)", hint: "Walk through each specific action, decision, or trade-off YOU made. This is where candidates are graded." },
      { number: "R", label: "Result — Proof (15%)", hint: "Quantified business impact. If exact numbers are confidential, give an order of magnitude." },
    ]} />
  ),

  /* Behavioral: hr-interview-questions-answers-india-2026 */
  "hr-interview-questions-answers-india-2026||STAR method behavioural questions": (
    <FrameworkSteps steps={[
      { number: "S", label: "Situation", hint: "Set context briefly — project type, team, timeline. 1–2 sentences." },
      { number: "T", label: "Task", hint: "State what YOUR goal or responsibility was, distinct from the team's." },
      { number: "A", label: "Action", hint: "3 specific actions YOU personally took. Avoid 'we'. Explain the why behind each decision." },
      { number: "R", label: "Result", hint: "Outcome with numbers: time saved, bug reduction, user growth, revenue impact." },
    ]} />
  ),

  /* Behavioral: interview-preparation-for-introverts-india-2026 */
  "interview-preparation-for-introverts-india-2026||Turning introversion into an interview advantage": (
    <FrameworkSteps steps={[
      { number: "01", label: "Prepare Depth, Not Breadth", hint: "Introverts can prepare 5–6 stories so thoroughly that answers feel polished and thoughtful rather than rehearsed." },
      { number: "02", label: "Use Structured Frameworks", hint: "STAR, PPF, and numbered lists buy processing time without awkward pauses. Say 'There are three points...' to buy thinking time." },
      { number: "03", label: "Leverage Written Thinking", hint: "Use take-home tasks, coding problems, and whiteboard time — formats where introverts consistently outperform." },
      { number: "04", label: "Reframe the Pause", hint: "Indian interviews read thinking-pause as confidence. Say 'Let me think for a moment' — do not apologise for it." },
    ]} />
  ),

  /* ── Interview Skills Posts ── */

  /* Interview Skills: how-to-answer-tell-me-about-yourself-india */
  "how-to-answer-tell-me-about-yourself-india||The Framework: Present-Past-Future": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — What You Do Now", hint: "Role, domain, and one line about the type of problems you solve. For freshers: final year + branch + strongest project." },
      { number: "02", label: "Past — What Built You", hint: "The ONE experience most relevant to this interviewer's company or domain. One sentence with a metric or outcome." },
      { number: "03", label: "Future — Why This Role", hint: "What skill or scale you want next, and why this specific role is the right vehicle. Be specific — not 'growth'." },
      { number: "04", label: "Keep It Under 90 Seconds", hint: "Time yourself. If it runs longer, cut the past section. The interviewer wants a map, not a tour." },
    ]} />
  ),

  /* Interview Skills: how-to-answer-greatest-weakness-interview-india */
  "how-to-answer-greatest-weakness-interview-india||What Interviewers Are Actually Testing": (
    <FrameworkSteps steps={[
      { number: "01", label: "Name the Real Weakness", hint: "Choose something genuine and not central to this job. Avoid clichés like 'I work too hard'." },
      { number: "02", label: "Acknowledge Impact with a Mini-Story", hint: "One brief example where this weakness caused a minor problem. This shows honesty and self-awareness." },
      { number: "03", label: "Show What You Have Done About It", hint: "The specific habit, tool, or system you use to manage the weakness. Concrete details matter." },
      { number: "04", label: "Demonstrate Progress", hint: "A recent situation where your mitigation worked. Ends on a forward-looking, growth-oriented note." },
    ]} />
  ),

  /* Interview Skills: star-method-interview-examples-india-freshers */
  "star-method-interview-examples-india-freshers||What Is the STAR Method and Why Indian Companies Use It": (
    <FrameworkSteps steps={[
      { number: "S", label: "Situation — College Context", hint: "Name the course project, club, or internship. State the team size and the problem you faced." },
      { number: "T", label: "Task — Your Role", hint: "What were YOU specifically responsible for? Be precise — 'I led the backend' not 'we built the app'." },
      { number: "A", label: "Action — What YOU Did", hint: "3 specific steps: the tool chosen, the decision made, the conflict handled. Use 'I' throughout." },
      { number: "R", label: "Result — College-Level Metrics", hint: "Demo day feedback, professor score, lines of code, latency improvement, users in beta. Numbers matter even for freshers." },
    ]} />
  ),

  /* Interview Skills: how-to-answer-salary-expectations-india-2026 */
  "how-to-answer-salary-expectations-india-2026||Research Your Market Value Before the Interview": (
    <FrameworkSteps steps={[
      { number: "01", label: "Research Market Range", hint: "Check Glassdoor, AmbitionBox, Levels.fyi for this exact role + city + years of experience before the interview." },
      { number: "02", label: "Anchor High in Your Range", hint: "State the top 30% of the market range, not the median. You can always come down; you cannot go up." },
      { number: "03", label: "Defer If Asked Too Early", hint: "If asked before an offer: 'I am open to a competitive offer — what is the budgeted range for this role?'" },
      { number: "04", label: "Negotiate After Offer Letter", hint: "Once you have the number in writing, take 24–48 hours. Counter with a specific number + justification, not a vague 'can you do better?'" },
    ]} />
  ),

  /* Interview Skills: how-to-answer-why-do-you-want-to-leave-current-company */
  "how-to-answer-why-do-you-want-to-leave-current-company||The Framework: Pull Toward, Not Push Away": (
    <FrameworkSteps steps={[
      { number: "01", label: "Lead with Pull, Not Push", hint: "Start with what you want to move TOWARD: a technology, scale, domain, or scope. Not what you are running from." },
      { number: "02", label: "Acknowledge the Positive", hint: "Name one genuine thing you valued at your current company. Shows maturity and avoids sounding bitter." },
      { number: "03", label: "Bridge to This Company", hint: "Connect what you want next specifically to this company's product, tech stack, or mission." },
      { number: "04", label: "Keep It Under 60 Seconds", hint: "Long answers on this question raise red flags. Say enough to satisfy curiosity, then stop." },
    ]} />
  ),

  /* Interview Skills: how-to-crack-coding-interview-india-2026 */
  "how-to-crack-coding-interview-india-2026||The 3 Phases of Coding Interview Preparation": (
    <FrameworkSteps steps={[
      { number: "01", label: "Foundations (Weeks 1–3)", hint: "Arrays, strings, hash maps, two pointers, sliding window. Solve 40–50 easy problems with full understanding, not memorisation." },
      { number: "02", label: "Core Patterns (Weeks 4–7)", hint: "Trees, graphs, BFS/DFS, binary search, DP basics. Solve 60–80 mediums. Learn to recognise which pattern a problem belongs to." },
      { number: "03", label: "Mock + Company Prep (Week 8+)", hint: "Timed mock interviews on Pramp or HireStepX. Filter company-tagged problems. Practice talking through your approach before coding." },
    ]} />
  ),

  /* Interview Skills: salary-negotiation-tips-india-2026 */
  "salary-negotiation-tips-india-2026||How to Negotiate: The Exact Script": (
    <FrameworkSteps steps={[
      { number: "01", label: "Pause Before Responding", hint: "Say 'Thank you — I am excited about this offer. Can I take 24 hours to review it?' Never negotiate in the moment." },
      { number: "02", label: "State a Specific Counter", hint: "'Based on my research and [competing offer / current CTC / market data], I was expecting ₹X.' Name a number." },
      { number: "03", label: "Justify with Evidence", hint: "One sentence: market data, competing offer, or a specific skill/impact that justifies the ask." },
      { number: "04", label: "Stay Warm and Collaborative", hint: "End with 'I am genuinely excited about this role — I hope we can find a number that works.' Do not give ultimatums." },
    ]} />
  ),

  /* Interview Skills: fresher-resume-guide-india-2026 */
  "fresher-resume-guide-india-2026||How to Write Project Descriptions That Get Callbacks": (
    <FrameworkSteps steps={[
      { number: "01", label: "Lead with the Action Verb + Tech", hint: "'Built a real-time chat app using Node.js and WebSockets...' — not 'Worked on a project that...'." },
      { number: "02", label: "State the Problem Solved", hint: "One clause explaining WHY this project exists. Shows product thinking, not just coding." },
      { number: "03", label: "Quantify the Output", hint: "Users, latency, accuracy, uptime, lines of code reduced. Even 'served 200 beta users' beats nothing." },
      { number: "04", label: "Link to GitHub", hint: "Every project must have a public repo. Recruiters open links. No repo = the project did not happen." },
    ]} />
  ),

  /* Interview Skills: group-discussion-tips-india-campus-placements */
  "group-discussion-tips-india-campus-placements||How to Enter, Contribute, and Stand Out in a GD": (
    <FrameworkSteps steps={[
      { number: "01", label: "Open with a Frame, Not an Opinion", hint: "'This topic has two sides worth examining...' — framing the discussion is more valued than rushing to a position." },
      { number: "02", label: "Make 2–3 Substantive Points", hint: "Quality beats quantity. Evaluators penalise filler speech. One point with a fact beats three empty opinions." },
      { number: "03", label: "Acknowledge and Build", hint: "'Building on what [Name] said...' — shows listening skill, a top evaluation criterion." },
      { number: "04", label: "Redirect, Do Not Interrupt", hint: "Wait for a pause, then: 'I think we should also consider...' — entering forcefully loses points." },
      { number: "05", label: "Close with a Summary", hint: "If asked to conclude: restate both sides, then give a balanced takeaway. Do not just repeat your own point." },
    ]} />
  ),

  /* Interview Skills: how-to-get-promoted-software-engineer-india-2026 */
  "how-to-get-promoted-software-engineer-india-2026||The Three Highest-Leverage Promotion Accelerators": (
    <FrameworkSteps steps={[
      { number: "01", label: "Operate Visibly at the Next Level", hint: "Do not wait to be promoted to do next-level work. Lead one cross-team project, own one major initiative. Document it." },
      { number: "02", label: "Get a Sponsor, Not Just a Mentor", hint: "A sponsor advocates for you in the calibration room. Mentors give advice. Identify who has that influence and earn their trust." },
      { number: "03", label: "Build a Promotion Document", hint: "Maintain a running list of your impact: metrics, projects shipped, cross-team work. Share it with your manager 6 months before review." },
    ]} />
  ),

  /* Interview Skills: how-to-negotiate-job-offer-india-software-engineer-2026 */
  "how-to-negotiate-job-offer-india-software-engineer-2026||What to Say: The Counter-Offer Script": (
    <FrameworkSteps steps={[
      { number: "01", label: "Buy Time First", hint: "'Thank you — I am very excited. Can I take until [specific date] to review the full package?' Always get it in writing before negotiating." },
      { number: "02", label: "Open with Gratitude + Anchor", hint: "'I am genuinely excited about this offer. Based on my research, I was expecting something closer to ₹X.' State the number confidently." },
      { number: "03", label: "Justify in One Sentence", hint: "Market rate, competing offer, or a specific skill/achievement: 'Given my experience with [X] and the market range of ₹Y–₹Z...'." },
      { number: "04", label: "Stay Silent After Your Ask", hint: "After stating your counter, stop talking. The first person to speak loses negotiating leverage." },
    ]} />
  ),

  /* Interview Skills: tell-me-about-yourself-answer-india-software-engineer-2026 */
  "tell-me-about-yourself-answer-india-software-engineer-2026||The Best Framework for Experienced Engineers: Present-Past-Future": (
    <FrameworkSteps steps={[
      { number: "01", label: "Present — Role + Impact", hint: "Current title, tech stack, and one metric that shows scale or impact. 1–2 sentences." },
      { number: "02", label: "Past — The Most Relevant Thread", hint: "Pick the ONE past experience most relevant to THIS company. Skip everything else on your resume." },
      { number: "03", label: "Future — Your Specific Goal", hint: "What you want to build or learn next — tied directly to what this company does. Avoid 'new challenges'." },
      { number: "04", label: "Close + Invite", hint: "'I would love to talk about how my background maps to what you are building.' Hands control to the interviewer." },
    ]} />
  ),

  /* Interview Skills: how-to-answer-why-leaving-current-job */
  "how-to-answer-why-leaving-current-job||Four Answer Frameworks That Work for Indian Tech Engineers": (
    <FrameworkSteps steps={[
      { number: "01", label: "Growth Ceiling Frame", hint: "'I have delivered [X] and I am ready for [Y scope/scale/technology]. This company is the right place for that next step.'" },
      { number: "02", label: "Domain Pivot Frame", hint: "'My current role is in [domain A] but I want to deepen in [domain B] — which is what your team is building.'" },
      { number: "03", label: "Technology Stack Frame", hint: "'I want to work with [specific tech] at scale. Your infra is built on exactly that.' Requires prior research." },
      { number: "04", label: "Impact Frame", hint: "'I want to work on a product that reaches [X users / market]. That scale aligns with what you are building.'" },
    ]} />
  ),

  /* Interview Skills: linkedin-profile-tips-india-software-engineer-2026 */
  "linkedin-profile-tips-india-software-engineer-2026||Seven LinkedIn Optimisations That Actually Increase Recruiter Messages": (
    <FrameworkSteps steps={[
      { number: "01", label: "Headline = Role + Stack + Differentiator", hint: "'Senior Backend Engineer | Go, Kafka, Distributed Systems | Building for Scale' — not 'Software Engineer at Company'." },
      { number: "02", label: "Turn On Open to Work (Recruiters Only)", hint: "Set visibility to 'Recruiters only' — your current employer cannot see it. Include target roles and locations." },
      { number: "03", label: "About Section = 3-Sentence Pitch", hint: "What you build, how you think, and what you are looking for. First line must hook — it appears before 'see more'." },
      { number: "04", label: "Quantify Every Role", hint: "Each experience bullet: verb + metric + scale. 'Reduced API latency by 40% serving 2M daily requests.'" },
      { number: "05", label: "Add 5 Specific Skills", hint: "List the technologies at the TOP of your skills. Recruiters filter by skill keywords." },
      { number: "06", label: "Get 3 Endorsements for Top Skills", hint: "Ask former colleagues. Endorsed skills rank higher in LinkedIn search." },
      { number: "07", label: "Post or Comment Once a Week", hint: "Activity boosts your profile in recruiter search. A technical insight or project post performs best." },
    ]} />
  ),

  /* Interview Skills: where-do-you-see-yourself-in-5-years-india-tech-interview */
  "where-do-you-see-yourself-in-5-years-india-tech-interview||Framework for Experienced Engineers (3+ Years)": (
    <FrameworkSteps steps={[
      { number: "01", label: "Name a Technical or Leadership Goal", hint: "Staff engineer, engineering manager, ML specialist — be specific. 'Grow as a professional' is a non-answer." },
      { number: "02", label: "Connect to a Problem Domain", hint: "What type of problem do you want to be known for solving? Distributed systems, product growth, ML infra?" },
      { number: "03", label: "Show How This Role Is the Path", hint: "Specifically how this company's scale, product, or team structure lets you pursue that goal." },
      { number: "04", label: "Stay Realistic and Committed", hint: "Ambitious enough to show drive; grounded enough to signal you will stay long enough to deliver." },
    ]} />
  ),

  /* Interview Skills: coding-interview-preparation-guide-india-2026 */
  "coding-interview-preparation-guide-india-2026||8-Week Structured LeetCode Plan for Indian Product Companies": (
    <PrepTimeline caption="Structured coding interview prep for SDE-1/SDE-2 at Indian product companies" phases={[
      { period: "Week 1–2", label: "Foundations", tasks: ["Arrays, strings, hash maps (30 easy problems)", "Two pointers and sliding window", "Big-O analysis for every solution"], milestone: "Solve 30 easies without hints" },
      { period: "Week 3–4", label: "Core Data Structures", tasks: ["Linked lists, stacks, queues (20 mediums)", "Binary search and sorted arrays", "Trees: traversal, BST operations"], milestone: "Complete NeetCode Blind 75 Part 1" },
      { period: "Week 5–6", label: "Graphs and DP", tasks: ["BFS/DFS, topological sort (15 mediums)", "Dynamic programming: 1D then 2D", "Recursion and backtracking"], milestone: "Solve 10 company-tagged mediums for target company" },
      { period: "Week 7–8", label: "Mock and Polish", tasks: ["2 timed mock interviews per week", "Review all problems solved under time pressure", "Practice explaining approach before coding"], milestone: "Score 70%+ on 5 consecutive mocks" },
    ]} />
  ),

  /* ── Strategy Posts ── */

  /* Strategy: salary-negotiation-after-offer-letter-india */
  "salary-negotiation-after-offer-letter-india||The Counter-Offer Script": (
    <FrameworkSteps steps={[
      { number: "01", label: "Pause and Request Time", hint: "'Thank you for the offer — I am excited. Can I have until [date] to review it?' Never negotiate same-day." },
      { number: "02", label: "State Your Number Confidently", hint: "'Based on my research and [current CTC / competing offer], I was expecting ₹X LPA.' Name a specific number." },
      { number: "03", label: "Justify in One Sentence", hint: "Market data (AmbitionBox, Glassdoor) + your specific skill or impact. One reason is enough." },
      { number: "04", label: "Stay Silent", hint: "After your counter, do not fill the silence. The recruiter will speak next. Waiting is power." },
      { number: "05", label: "Negotiate Beyond Base Salary", hint: "If base is fixed: ask for joining bonus, extra RSUs, or earlier appraisal cycle. Something usually moves." },
    ]} />
  ),
  "salary-negotiation-after-offer-letter-india||Why Most Indians Do Not Negotiate (and Why You Should)": (
    <PrepTimeline caption="Salary negotiation preparation timeline" phases={[
      { period: "2 Weeks Before Offer", label: "Research Phase", tasks: ["Check AmbitionBox and Glassdoor for role + city + experience band", "Research on Levels.fyi for product/FAANG companies", "Identify your walk-away number and your target number"], milestone: "Know your market range with confidence" },
      { period: "At Offer Stage", label: "Buy Time", tasks: ["Request 24–48 hours to review", "Get full CTC breakup in writing", "Calculate take-home vs CTC"], milestone: "Full offer letter in hand before negotiating" },
      { period: "Counter-Offer", label: "Negotiate Strategically", tasks: ["Counter with a specific number (not a range)", "Justify with one data point", "Negotiate non-salary if base is fixed"], milestone: "Written confirmation of revised offer" },
    ]} />
  ),

  /* Strategy: highest-paying-it-companies-india-2026 */
  "highest-paying-it-companies-india-2026||How to Use This Data Strategically": (
    <PrepTimeline caption="Career strategy roadmap to reach top-paying IT companies" phases={[
      { period: "Year 1–2", label: "Build Fundaments", tasks: ["Join any company — product preferred", "Get depth in 1 technology stack", "Ship to production and collect metrics"], milestone: "2 quantifiable projects on resume" },
      { period: "Year 2–3", label: "Demonstrate Scale", tasks: ["Target CRED/Razorpay/Meesho tier", "Prepare system design fundamentals", "Build DSA consistency: 150+ problems solved"], milestone: "First product company offer above ₹20 LPA" },
      { period: "Year 3–5", label: "Target FAANG India", tasks: ["Deep dive: distributed systems, advanced DSA", "Mock interviews for Google/Meta/Uber bar", "Build cross-functional impact at current job"], milestone: "₹40–80 LPA offer from FAANG India" },
    ]} />
  ),

  /* Strategy: salary-hike-negotiation-current-company-india */
  "salary-hike-negotiation-current-company-india||The Conversation: What to Say": (
    <FrameworkSteps steps={[
      { number: "01", label: "Open with Context, Not Demand", hint: "'I wanted to discuss my compensation in light of the impact I have delivered this year.' Sets collaborative tone." },
      { number: "02", label: "Present Your Case with Numbers", hint: "List 3 specific contributions with metrics: 'I led [X] which reduced [Y] by [Z%].' Your manager cannot argue with your own data." },
      { number: "03", label: "Anchor with Market Data", hint: "'For my experience level and skills, the market range is ₹X–₹Y. I would like to align to that range.'" },
      { number: "04", label: "Name a Specific Number", hint: "Ask for the specific hike percentage or CTC you want. Do not say 'whatever you think is fair'." },
      { number: "05", label: "Give a Timeline", hint: "'Can we revisit this in two weeks?' Creates urgency and prevents indefinite deferral." },
    ]} />
  ),
  "salary-hike-negotiation-current-company-india||The Preparation: What to Do Before the Conversation": (
    <PrepTimeline caption="Internal salary negotiation preparation plan" phases={[
      { period: "4 Weeks Before", label: "Build Your Evidence File", tasks: ["List all projects delivered with metrics", "Note any scope expansion or new responsibilities", "Identify 1–2 cross-team contributions"], milestone: "Impact document ready" },
      { period: "2 Weeks Before", label: "Research Market", tasks: ["Check AmbitionBox for your role + company tier", "Get 1–2 data points from peers at competitor companies", "Know the market range for your exact experience band"], milestone: "Market data to anchor your ask" },
      { period: "1 Week Before", label: "Prepare and Time the Ask", tasks: ["Schedule the 1:1 for after a recent win or positive review", "Prepare your 2-minute opening: context + impact + ask", "Rehearse responses to 'budget is fixed' objection"], milestone: "Manager meeting scheduled" },
    ]} />
  ),

  /* Strategy: mba-vs-ms-vs-upskill-india-career-decision-2026 */
  "mba-vs-ms-vs-upskill-india-career-decision-2026||Decision framework: which path is right for you": (
    <FrameworkSteps steps={[
      { number: "01", label: "Define Your Goal Precisely", hint: "CTO path? Product management? Quant finance? Salary jump alone? Each goal has a different optimal path." },
      { number: "02", label: "Calculate True Cost and ROI", hint: "MBA: ₹30–70L + 2 years opportunity cost. MS: ₹50–120L. Upskilling: ₹0–5L. Payback period matters more than prestige." },
      { number: "03", label: "Test the Assumption", hint: "Can you achieve the goal WITHOUT the degree in 2–3 years? If yes, the degree rarely adds enough marginal value." },
      { number: "04", label: "Choose the Shortest Path to Your Goal", hint: "MBA for PM/consulting pivots. MS for research or top-tier global roles. Upskilling for most software career transitions." },
    ]} />
  ),

  /* Strategy: notice-period-buy-out-india-2026 */
  "notice-period-buy-out-india-2026||How to negotiate early joining": (
    <FrameworkSteps steps={[
      { number: "01", label: "Know Your Legal Obligation", hint: "Your employment contract defines the notice period. Buyout = you pay salary equivalent for remaining days. Calculate the exact amount." },
      { number: "02", label: "Get the New Employer to Pay", hint: "Ask HR: 'Is a joining bonus or buyout reimbursement available?' Many Indian product companies offer this. Ask before accepting." },
      { number: "03", label: "Negotiate With Current Employer", hint: "Offer to complete handover documentation in exchange for early release. Most companies prefer a clean exit over a grudging last month." },
      { number: "04", label: "Get the Release in Writing", hint: "Verbal agreement is not enough. Get the early relieving date confirmed by email with Experience Letter + relieving date confirmed." },
    ]} />
  ),

  /* Strategy: negotiation-tips-for-freshers-india-2026 */
  "negotiation-tips-for-freshers-india-2026||How to negotiate without risking your offer": (
    <FrameworkSteps steps={[
      { number: "01", label: "Know What Is Negotiable", hint: "Freshers: stipend during training, joining date, location preference. Band/grade is harder but not impossible at product companies." },
      { number: "02", label: "Use a Competing Offer if You Have One", hint: "'I have an offer for ₹X from [Company]. Is there any flexibility here?' This is the most effective fresher lever." },
      { number: "03", label: "Negotiate Tone, Not Terms, If No Leverage", hint: "If only one offer: negotiate joining date, role clarity, or training stream. Never go silent — ask for something." },
      { number: "04", label: "Get Everything in Writing", hint: "Offer letter, joining date, role, location, CTC breakup — all confirmed before resigning from or declining any other offer." },
    ]} />
  ),

  /* Strategy: bangalore-salary-guide-software-engineers-2026 */
  "bangalore-salary-guide-software-engineers-2026||Software engineer salaries in Bengaluru by experience level": (
    <SalaryLadder maxLPA={100} rows={[
      { role: "Fresher / 0–1 YOE (IT Services)", min: 3, max: 7 },
      { role: "Fresher / 0–1 YOE (Product Company)", min: 12, max: 22 },
      { role: "SDE-1 / 2–3 YOE", min: 18, max: 35 },
      { role: "SDE-2 / 4–6 YOE", min: 30, max: 55 },
      { role: "SDE-3 / Senior / 6–9 YOE", min: 45, max: 80 },
      { role: "Staff / Principal (10+ YOE)", min: 65, max: 100, note: "FAANG India top band" },
    ]} caption="Bengaluru 2026 — fixed + RSU vesting. FAANG India top of range." />
  ),
  "bangalore-salary-guide-software-engineers-2026||Bengaluru vs Hyderabad vs Pune vs Chennai for SWE careers": (
    <TierCompare cards={[
      {
        tier: "Bengaluru",
        examples: "Flipkart · Swiggy · PhonePe · Google · Microsoft",
        rows: [
          { label: "Avg SDE-2 CTC", range: "₹35–55 LPA" },
          { label: "FAANG density", range: "Highest in India" },
          { label: "Cost of living", range: "High (rent ₹25–50K/mo)" },
          { label: "Product co. density", range: "Very High" },
        ]
      },
      {
        tier: "Hyderabad",
        examples: "Microsoft · Amazon · Google · Walmart GTC",
        rows: [
          { label: "Avg SDE-2 CTC", range: "₹30–50 LPA" },
          { label: "FAANG density", range: "High (GCC-heavy)" },
          { label: "Cost of living", range: "Medium (rent ₹18–35K/mo)" },
          { label: "Product co. density", range: "High" },
        ]
      },
      {
        tier: "Pune",
        examples: "Persistent · Cummins Tech · Thoughtworks",
        rows: [
          { label: "Avg SDE-2 CTC", range: "₹22–38 LPA" },
          { label: "FAANG density", range: "Low" },
          { label: "Cost of living", range: "Medium-Low" },
          { label: "Product co. density", range: "Medium" },
        ]
      },
      {
        tier: "Chennai",
        examples: "Zoho · Freshworks · Standard Chartered GCC",
        rows: [
          { label: "Avg SDE-2 CTC", range: "₹20–35 LPA" },
          { label: "FAANG density", range: "Low" },
          { label: "Cost of living", range: "Low (rent ₹12–25K/mo)" },
          { label: "Product co. density", range: "Medium" },
        ]
      },
    ]} />
  ),

  /* Strategy: mock-interview-importance-india-2026 */
  "mock-interview-importance-india-2026||Building a Mock Interview Practice Routine": (
    <PrepTimeline caption="Mock interview practice plan for Indian software engineers" phases={[
      { period: "Week 1–2", label: "Solo Practice", tasks: ["Solve LeetCode problems out loud — narrate every step", "Record yourself on phone; watch back for filler words", "Time each problem: 20 min easy, 35 min medium"], milestone: "Comfortable talking while coding" },
      { period: "Week 3–4", label: "Peer Mocks", tasks: ["Find 2–3 peers on HireStepX, Pramp, or InterviewBit", "Do 2 mocks per week: one as interviewee, one as interviewer", "Give and receive structured feedback on each mock"], milestone: "Completed 8 peer mock sessions" },
      { period: "Week 5–6", label: "AI + Company-Specific Mocks", tasks: ["Use AI mock tools for behavioural STAR practice", "Do company-tagged problem sets under strict time", "Simulate full 45-minute interview with intro + coding + questions"], milestone: "70%+ score across 5 consecutive mocks" },
    ]} />
  ),

  /* Strategy: product-manager-interview-india-2026 */
  "product-manager-interview-india-2026||PM Interview Dimensions at Indian Companies": (
    <FrameworkSteps steps={[
      { number: "01", label: "Product Sense", hint: "Can you define a user problem, prioritise solutions, and describe a launch plan? Use Understand → Define → Prioritise → Launch framework." },
      { number: "02", label: "Analytics / Metrics", hint: "Can you set a north-star metric, build a funnel, and diagnose a metric drop? Indian PM interviews are metrics-heavy." },
      { number: "03", label: "Estimation", hint: "Market sizing and Fermi estimates. Practice: DAU of Google Pay India, GMV of Flipkart. Structure > precision." },
      { number: "04", label: "Execution", hint: "How do you manage stakeholders, handle trade-offs, and sequence a roadmap? Use RICE or MoSCoW framework." },
      { number: "05", label: "Behavioural", hint: "STAR stories about product wins, failures, influencing without authority, and managing scope creep." },
      { number: "06", label: "Technical Sufficiency", hint: "APIs, databases, system constraints — not deep code but enough to work with engineers. Especially tested at Flipkart and Razorpay." },
    ]} />
  ),
  "product-manager-interview-india-2026||Product Sense Questions: The Framework": (
    <PrepTimeline caption="8-week PM interview preparation plan for Indian candidates" phases={[
      { period: "Week 1–2", label: "Product Sense Foundations", tasks: ["Learn Understand-Define-Prioritise-Launch framework", "Practice 10 product design questions from Swiggy/PhonePe/Razorpay", "Read 5 PM teardowns of Indian consumer apps"], milestone: "Consistent structured product answers" },
      { period: "Week 3–4", label: "Metrics + Analytics", tasks: ["Practice north-star metric selection for 10 Indian products", "Learn funnel analysis + A/B testing basics", "Practice metric drop diagnosis: 5 scenarios"], milestone: "Can diagnose a metric drop in 4 minutes" },
      { period: "Week 5–6", label: "Estimation + Execution", tasks: ["10 Fermi estimate problems (DAU, GMV, market size)", "RICE prioritisation on 5 scenarios", "Stakeholder conflict: 3 STAR stories prepared"], milestone: "Estimation in under 3 minutes per question" },
      { period: "Week 7–8", label: "Mock Interviews", tasks: ["2 full-length PM mock interviews per week", "Behavioural bank: 8 STAR stories across all categories", "Research target company product deeply"], milestone: "Offer-ready across all 6 dimensions" },
    ]} />
  ),

  /* ── Remaining posts ── */

  /* Salary negotiation after offer */
  "salary-negotiation-after-job-offer-india-guide||Negotiation scripts and techniques": (
    <FrameworkSteps steps={[
      { number: "01", label: "Acknowledge the offer", hint: "Thank the recruiter sincerely and ask for 24–48 hours to review. Never negotiate on the spot — it signals desperation." },
      { number: "02", label: "State your number", hint: "Name your expected CTC confidently: \"Based on my research and experience, I was expecting ₹X. Is there flexibility?\"" },
      { number: "03", label: "Justify with data", hint: "Cite market ranges (Naukri, LinkedIn Salary, Glassdoor) and a competing offer if you have one. Don't just say \"I deserve more\"." },
      { number: "04", label: "Negotiate the full package", hint: "If base is fixed, negotiate joining bonus, variable %, ESOPs, notice period buyout, and WFH flexibility." },
    ]} />
  ),
  "salary-negotiation-after-job-offer-india-guide||What is negotiable beyond base salary": (
    <TierCompare cards={[
      { tier: "Service IT", examples: "TCS · Infosys · Wipro", rows: [{ label: "Base negotiability", range: "Low (band-fixed)" }, { label: "Joining bonus", range: "₹50K–2L (possible)" }] },
      { tier: "Product Startups", examples: "Swiggy · Razorpay · CRED", rows: [{ label: "Base negotiability", range: "High (±15%)" }, { label: "ESOPs", range: "Often negotiable" }] },
      { tier: "MNCs India", examples: "Microsoft · Amazon · Google", rows: [{ label: "Base negotiability", range: "Medium (±10%)" }, { label: "Signing bonus", range: "₹3–15L possible" }] },
    ]} />
  ),

  /* Side projects */
  "side-projects-portfolio-india-jobs-2026||What Makes a Side Project Actually Impressive": (
    <FrameworkSteps steps={[
      { number: "01", label: "Real problem solved", hint: "Projects that scratch a real itch outperform tutorial clones. Explain the problem you faced and why existing solutions failed you." },
      { number: "02", label: "Live and deployed", hint: "A working URL beats a GitHub link. Deploy on Vercel, Railway, or Render for free. Recruiters open URLs; they rarely clone repos." },
      { number: "03", label: "Production-quality code", hint: "Error handling, tests, environment variables handled properly, a clear README. These signal professional instincts." },
      { number: "04", label: "Measurable or growing", hint: "Real users or genuine metrics (even small) make a project tangible. 50 active users beats a polished demo with zero." },
    ]} />
  ),

  /* Remote work negotiation */
  "negotiating-remote-work-india-2026||When and How to Ask About Remote Work": (
    <FrameworkSteps steps={[
      { number: "01", label: "Time it right", hint: "Ask after you receive an offer — not during screening. Raising WFH requirements too early can screen you out before you've proven your value." },
      { number: "02", label: "Frame it as productivity", hint: "\"I do my deepest work remotely and have a well-equipped home office\" is stronger than \"I prefer working from home\"." },
      { number: "03", label: "Propose a structure", hint: "Offer a trial: \"I'm happy to come in for the first 30 days to ramp up, then move to 3 days in / 2 days remote.\" Structure lowers the risk for the employer." },
      { number: "04", label: "Get it in writing", hint: "Verbal WFH agreements disappear. Ask for the arrangement to be noted in your offer letter or a follow-up email." },
    ]} />
  ),

  /* Interview body language */
  "interview-body-language-india-2026||The Foundation: Posture and Physical Presence": (
    <FrameworkSteps steps={[
      { number: "01", label: "Sit at 90°", hint: "Back upright, feet flat on the floor. Slouching signals disengagement; leaning forward too much signals anxiety. 90° is neutral confidence." },
      { number: "02", label: "Open hands visible", hint: "Keep hands on the table or in view. Hidden hands read as concealment. Gestures when speaking are natural and positive — don't suppress them." },
      { number: "03", label: "Nod, don't over-nod", hint: "A single slow nod while listening signals understanding. Rapid nodding signals you want the interviewer to stop talking — the opposite of engaged." },
      { number: "04", label: "Pause before answering", hint: "A 1–2 second pause before your answer signals thoughtfulness, not uncertainty. Rushing to fill silence is the single most common interview mistake." },
    ]} />
  ),

  /* Optiver */
  "optiver-interview-questions-india-2026||The Optiver Interview Process: What Makes It Different": (
    <RoundFlow rounds={[
      { label: "Online Assessment", duration: "60 min", detail: "Mental math (80 arithmetic problems in 8 min), personality test, numerical reasoning" },
      { label: "HireVue Video", duration: "30 min", detail: "Async behavioral questions — recorded, not live" },
      { label: "First Round", duration: "60 min", detail: "Mental math oral drill + probability puzzles + brain teasers" },
      { label: "Technical Round", duration: "90 min", detail: "Coding (Python/C++) + market-making scenarios + statistical reasoning" },
      { label: "Final Round", duration: "60 min", detail: "Culture fit + harder quant problems + P&L discussion" },
    ]} />
  ),
  "optiver-interview-questions-india-2026||Market Making and Quant Concepts for Optiver": (
    <FrameworkSteps steps={[
      { number: "01", label: "Bid-ask spread intuition", hint: "Understand why market makers profit from the spread and how inventory risk affects quotes. Practice explaining this without jargon." },
      { number: "02", label: "Probability under pressure", hint: "Expected value, Bayes' theorem, and conditional probability are tested verbally. Practice explaining your reasoning aloud, not just writing answers." },
      { number: "03", label: "Mental arithmetic speed", hint: "Target: 40+ correct in the 8-minute 80-question test. Practice daily with apps like Mental Math Master or the Zetamac arithmetic trainer." },
      { number: "04", label: "Options Greeks basics", hint: "Know Delta, Gamma, Theta, Vega conceptually. You're not expected to price complex derivatives, but intuition about how they move is tested." },
    ]} />
  ),

  /* Blockchain/Web3 */
  "blockchain-web3-jobs-india-2026||Blockchain Developer Salaries in India 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Junior Blockchain Dev (0–2 yr)", min: 8, max: 20 },
      { role: "Smart Contract Engineer (2–4 yr)", min: 18, max: 40 },
      { role: "Senior Web3 Engineer (4–7 yr)", min: 30, max: 65 },
      { role: "Blockchain Architect / Tech Lead", min: 50, max: 80 },
    ]} caption="India 2026 — Web3 salaries vary widely by company funding stage" />
  ),
  "blockchain-web3-jobs-india-2026||Technical Skills for Web3 Engineering in India": (
    <FrameworkSteps steps={[
      { number: "01", label: "Solidity + EVM fundamentals", hint: "ERC-20, ERC-721, storage layout, gas optimisation. HardHat and Foundry are the dominant testing frameworks at Indian Web3 companies." },
      { number: "02", label: "Layer 2 familiarity", hint: "Polygon (largest Indian Web3 employer) uses Polygon PoS and CDK. Understand optimistic vs ZK rollups conceptually." },
      { number: "03", label: "Backend integration", hint: "ethers.js/web3.js, indexing with The Graph, event listeners. Node.js backend skills transfer directly." },
      { number: "04", label: "Security awareness", hint: "Reentrancy, integer overflow, access control flaws — smart contract auditing awareness signals senior maturity." },
    ]} />
  ),

  /* HealthTech */
  "healthtech-jobs-india-2026||HealthTech Salary Benchmarks India 2026": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 / Junior Engineer (0–2 yr)", min: 8, max: 18 },
      { role: "SDE-2 / Mid-level (2–5 yr)", min: 18, max: 35 },
      { role: "Senior Engineer (5–8 yr)", min: 30, max: 55 },
      { role: "Tech Lead / Staff Engineer", min: 45, max: 60 },
    ]} caption="Practo, PharmEasy, Pristyn Care, Medline India — 2026 ranges" />
  ),
  "healthtech-jobs-india-2026||Top HealthTech Employers in India 2026": (
    <TierCompare cards={[
      { tier: "Funded Scale-ups", examples: "PharmEasy · Practo · Pristyn Care", rows: [{ label: "SDE-1 range", range: "₹10–22 LPA" }, { label: "Growth stage", range: "Series D–F" }] },
      { tier: "Hospital Tech", examples: "Apollo Hospitals · Narayana Health", rows: [{ label: "SDE-1 range", range: "₹6–14 LPA" }, { label: "Stack", range: "Enterprise + cloud" }] },
      { tier: "Diagnostics Tech", examples: "Dr Lal PathLabs · Metropolis", rows: [{ label: "SDE-1 range", range: "₹7–15 LPA" }, { label: "Focus", range: "Data, integrations" }] },
    ]} />
  ),

  /* Frontend Engineer Role Guide */
  "frontend-engineer-interview-questions-india-2026||Frontend Engineer Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Junior Frontend (0–2 yr)", min: 5, max: 15 },
      { role: "Mid-level (2–5 yr)", min: 14, max: 30 },
      { role: "Senior Frontend (5–8 yr)", min: 25, max: 55 },
      { role: "Staff / Principal Engineer", min: 45, max: 70 },
    ]} caption="India 2026 — higher end at fintech and consumer internet" />
  ),
  "frontend-engineer-interview-questions-india-2026||React Interview Depth at Different Levels": (
    <TierCompare cards={[
      { tier: "SDE-1 (0–2 yr)", examples: "Junior Frontend roles", rows: [{ label: "Depth expected", range: "Hooks, lifecycle, props vs state" }, { label: "Common Q", range: "useEffect cleanup, key prop" }] },
      { tier: "SDE-2 (2–5 yr)", examples: "Mid-level roles", rows: [{ label: "Depth expected", range: "Performance, memoisation, context" }, { label: "Common Q", range: "reconciliation, Suspense, code-split" }] },
      { tier: "Senior (5+ yr)", examples: "Senior / Lead roles", rows: [{ label: "Depth expected", range: "Architecture, custom renderers, RSC" }, { label: "Common Q", range: "microfrontends, state at scale" }] },
    ]} />
  ),

  /* Resume tips */
  "resume-tips-software-engineer-india-2026||Writing Bullet Points That Get You Shortlisted": (
    <FrameworkSteps steps={[
      { number: "01", label: "Start with a strong verb", hint: "\"Built\", \"Reduced\", \"Led\", \"Designed\", \"Migrated\". Avoid passive constructions like \"Responsible for\" or \"Involved in\"." },
      { number: "02", label: "Add the scale", hint: "\"Reduced API latency\" is weak. \"Reduced API p99 latency from 800ms to 140ms for 2M daily active users\" is strong. Always add numbers." },
      { number: "03", label: "State the impact", hint: "What changed because of your work? Revenue? Conversion? Cost saving? Engineer count freed? Impact makes bullets scannable and memorable." },
      { number: "04", label: "Keep it one line", hint: "Two-line bullets are almost never read. If you need more space, split into two bullets. Recruiters spend 7 seconds on a first scan." },
    ]} />
  ),

  /* DevOps Engineer Role Guide */
  "devops-engineer-interview-questions-india-2026||DevOps Engineer Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={70} rows={[
      { role: "Junior DevOps / SRE (0–2 yr)", min: 6, max: 16 },
      { role: "Mid-level DevOps (2–5 yr)", min: 15, max: 35 },
      { role: "Senior DevOps / SRE (5–8 yr)", min: 28, max: 60 },
      { role: "Staff SRE / Platform Lead", min: 45, max: 70 },
    ]} caption="India 2026 — SRE at product companies commands premium" />
  ),
  "devops-engineer-interview-questions-india-2026||CI/CD and GitOps for Indian DevOps Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Pipeline stages", hint: "Source → Build → Test → Scan → Deploy → Monitor. Know each stage's failure modes and how to recover them automatically." },
      { number: "02", label: "GitOps fundamentals", hint: "Argo CD and Flux are the dominant tools at Indian product companies. Understand declarative vs imperative deployment and drift detection." },
      { number: "03", label: "Container security", hint: "Image scanning (Trivy, Snyk), non-root containers, read-only filesystems, secret management with Vault or AWS Secrets Manager." },
      { number: "04", label: "Observability wiring", hint: "Metrics (Prometheus), logs (Loki/ELK), traces (Jaeger). Know how to set SLOs and alert without alert fatigue." },
    ]} />
  ),

  /* Platform Engineer */
  "platform-engineer-interview-questions-india-2026||Platform Engineer Salary Benchmarks 2026": (
    <SalaryLadder maxLPA={80} rows={[
      { role: "Platform Engineer (2–4 yr)", min: 18, max: 35 },
      { role: "Senior Platform Engineer (4–7 yr)", min: 30, max: 60 },
      { role: "Staff Platform Engineer", min: 50, max: 80 },
    ]} caption="India 2026 — platform roles command 15–25% premium over SWE at same level" />
  ),
  "platform-engineer-interview-questions-india-2026||Platform Engineering Technical Skills for Interviews": (
    <FrameworkSteps steps={[
      { number: "01", label: "Internal developer platform", hint: "Backstage, Port, or custom IDP experience. Interviewers want to know if you've built self-service capabilities that reduced cognitive load for product engineers." },
      { number: "02", label: "Kubernetes at depth", hint: "Custom controllers, CRDs, admission webhooks, multi-cluster management. Platform roles go deeper than standard DevOps Kubernetes usage." },
      { number: "03", label: "Golden paths", hint: "How you define and enforce opinionated templates for services, CI pipelines, and infrastructure. Paved-road philosophy is a core platform engineering concept." },
      { number: "04", label: "Developer experience metrics", hint: "DORA metrics (deploy frequency, lead time, MTTR, change failure rate). Platform engineers own these — you need to know how to improve them." },
    ]} />
  ),

  /* EdTech */
  "edtech-jobs-india-2026||EdTech Engineering Salary Benchmarks India 2026": (
    <SalaryLadder maxLPA={50} rows={[
      { role: "SDE-1 (0–2 yr)", min: 8, max: 18 },
      { role: "SDE-2 (2–5 yr)", min: 16, max: 32 },
      { role: "Senior / Lead (5+ yr)", min: 28, max: 50 },
    ]} caption="PhysicsWallah, Unacademy, upGrad, BYJU's — 2026 ranges (post-edtech correction)" />
  ),
  "edtech-jobs-india-2026||Which EdTech Companies Are Stable in India in 2026": (
    <TierCompare cards={[
      { tier: "Stable / Growing", examples: "PhysicsWallah · upGrad · Classplus", rows: [{ label: "Cash flow", range: "Profitable or near" }, { label: "Hiring stance", range: "Selective growth" }] },
      { tier: "Recovery Mode", examples: "Unacademy · Vedantu", rows: [{ label: "Cash flow", range: "Restructured, leaner" }, { label: "Hiring stance", range: "Cautious" }] },
      { tier: "Avoid (risk)", examples: "BYJU's (legal/financial issues)", rows: [{ label: "Cash flow", range: "Distressed" }, { label: "Hiring stance", range: "Layoffs ongoing" }] },
    ]} />
  ),

  /* Fintech startups */
  "fintech-startup-jobs-india-2026||Compensation at Indian Fintech Startups 2026": (
    <SalaryLadder maxLPA={60} rows={[
      { role: "SDE-1 (0–2 yr)", min: 12, max: 25 },
      { role: "SDE-2 (2–5 yr)", min: 22, max: 45 },
      { role: "Senior Engineer (5+ yr)", min: 38, max: 60 },
    ]} caption="BharatPe, Slice, Fi Money, Jupiter, Setu — 2026 indicative ranges" />
  ),
  "fintech-startup-jobs-india-2026||How to Evaluate a Fintech Startup Before Joining": (
    <FrameworkSteps steps={[
      { number: "01", label: "Check runway and last round", hint: "Ask in the interview: \"When was your last funding round and what's your current runway?\" Series A+ with 18+ months runway is the minimum safe zone." },
      { number: "02", label: "Verify RBI licensing", hint: "Lending, payments, and insurance products need RBI/IRDAI/SEBI licenses. A startup without the right license is building on sand." },
      { number: "03", label: "Assess unit economics", hint: "Is the CAC declining? Is the cohort LTV improving? Good fintech has these numbers — ask if they can share directional data." },
      { number: "04", label: "Review engineer attrition", hint: "Check LinkedIn: how many engineers have left in the last 12 months? High attrition in engineering signals leadership or product problems." },
    ]} />
  ),

  /* Salary negotiation tips (software engineer specific) */
  "salary-negotiation-tips-india-software-engineer-2026||The Counter-Offer Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Anchor high, not extreme", hint: "Counter 15–20% above your target. Companies expect negotiation and bake in room. Anchoring at exactly your target leaves money on the table." },
      { number: "02", label: "Give a range, not a point", hint: "\"I'm looking for ₹28–32 LPA\" is more negotiable than \"I want ₹30 LPA\". The range signals flexibility while setting a floor." },
      { number: "03", label: "Justify once, then stop", hint: "State your market data. Then go quiet. Silence is powerful — recruiters are trained to fill it. Let them respond before you adjust." },
      { number: "04", label: "Negotiate all levers", hint: "If base is stuck, push on: joining bonus, variable payout guarantee (first year), ESOPs, and WFH days. These often have more flexibility than base." },
    ]} />
  ),
  "salary-negotiation-tips-india-software-engineer-2026||Five Mistakes That Will Cost You an Offer": (
    <TierCompare cards={[
      { tier: "Mistake: Anchoring low", examples: "Sharing your current CTC first", rows: [{ label: "Fix", range: "Deflect: \"I'd prefer to hear the range first\"" }] },
      { tier: "Mistake: Accepting verbally", examples: "Saying yes before seeing the letter", rows: [{ label: "Fix", range: "Always say \"Let me review the written offer\"" }] },
      { tier: "Mistake: Single-lever focus", examples: "Fighting only over base salary", rows: [{ label: "Fix", range: "Negotiate bonus, ESOPs, WFH, start date" }] },
    ]} />
  ),

  /* How to ace technical interview */
  "how-to-ace-technical-interview-india-2026||The 4-Week Technical Interview Preparation Plan": (
    <PrepTimeline caption="4-week interview prep plan" phases={[
      { period: "Week 1", label: "DSA Foundations", tasks: ["Arrays, strings, hashmaps: 15 LeetCode easy/medium", "Time/space complexity analysis for every solution", "Pick your primary language and practice its syntax"], milestone: "Consistent easy/medium in under 20 min" },
      { period: "Week 2", label: "Core Patterns", tasks: ["Two pointers, sliding window, BFS/DFS, binary search: 20 problems", "At least 1 hard problem daily — even a failed attempt teaches", "Practice explaining your approach out loud"], milestone: "Can articulate approach before coding" },
      { period: "Week 3", label: "System Design", tasks: ["Learn 4 core designs: URL shortener, rate limiter, notification service, feed", "Study CAP theorem, database selection, caching strategies", "Practice drawing and narrating design simultaneously"], milestone: "Any standard design in 40 min" },
      { period: "Week 4", label: "Mock Interviews", tasks: ["2 mock interviews (Pramp, Interviewing.io, or peer)", "Behavioral: 5 STAR stories covering ownership, conflict, failure, impact", "Research target companies' tech stacks and interview style"], milestone: "Offer-ready across all dimensions" },
    ]} />
  ),
  "how-to-ace-technical-interview-india-2026||The Think-Aloud Technique": (
    <FrameworkSteps steps={[
      { number: "01", label: "Repeat the problem", hint: "Restate the problem in your own words. This confirms understanding and gives you 30 seconds to think. Interviewers expect this." },
      { number: "02", label: "State your approach", hint: "Before writing a single line of code, say: \"My approach is X because Y.\" This is what separates candidates who get offers from those who don't." },
      { number: "03", label: "Code with commentary", hint: "Narrate what each section does as you write it. \"I'm using a hashmap here to get O(1) lookup instead of O(n) search...\"" },
      { number: "04", label: "Test with an example", hint: "Walk through your code with the example input before declaring it done. Catching your own bugs verbally scores far better than a silent wrong answer." },
    ]} />
  ),

  /* System design interview India */
  "system-design-interview-preparation-india-2026||The 6-Step System Design Framework": (
    <FrameworkSteps steps={[
      { number: "01", label: "Clarify requirements", hint: "Ask: functional requirements (what the system does), non-functional (scale, latency, consistency, availability). Spend 3–5 minutes here." },
      { number: "02", label: "Estimate scale", hint: "Back-of-envelope: users, requests/second, storage per day, bandwidth. Shows you think at production scale. Interviewers penalise skipping this." },
      { number: "03", label: "Define the API", hint: "Sketch 2–3 core API endpoints. This forces clarity on input/output before you start drawing boxes." },
      { number: "04", label: "High-level design", hint: "Draw: client, load balancer, app servers, database, cache, message queue. Explain each component's role and the data flow." },
      { number: "05", label: "Deep dive", hint: "The interviewer picks 1–2 components to drill. This is where you differentiate: schema, cache invalidation strategy, consistency model." },
      { number: "06", label: "Scale and trade-offs", hint: "How does the system handle 10x traffic? What breaks first? SQL vs NoSQL? Sync vs async? State trade-offs explicitly — there's no single right answer." },
    ]} />
  ),
  "system-design-interview-preparation-india-2026||Caching and Message Queue Architecture for Indian Tech Interviews": (
    <TierCompare cards={[
      { tier: "Caching Layer", examples: "Redis · Memcached · CDN", rows: [{ label: "What to know", range: "Cache-aside, write-through, TTL, eviction policies (LRU)" }, { label: "Common Q", range: "Cache invalidation, cache stampede, thundering herd" }] },
      { tier: "Message Queues", examples: "Kafka · RabbitMQ · SQS", rows: [{ label: "What to know", range: "Pub/sub, consumer groups, at-least-once vs exactly-once" }, { label: "Common Q", range: "Kafka partition strategy, dead-letter queues" }] },
      { tier: "Database Choice", examples: "PostgreSQL · Cassandra · DynamoDB", rows: [{ label: "What to know", range: "CAP theorem, ACID vs BASE, indexing, sharding strategies" }, { label: "Common Q", range: "When to denormalise, hot partition problem" }] },
    ]} />
  ),

  /* Best AI mock interview tools comparison */
  "best-ai-mock-interview-tools-india-2026||What actually matters when you're choosing one": (
    <ComparisonTable
      caption="Feature comparison across the tools covered below — pricing shown is the plan that unlocks full mock interview access, not a free-tier teaser."
      columns={[
        { name: "HireStepX", highlight: true },
        { name: "Interviewing.io" },
        { name: "Final Round AI" },
        { name: "Interview Warmup" },
        { name: "Verve / Yoodli / Big Interview" },
      ]}
      rows={[
        { label: "Voice practice", values: ["Yes", "Live human", "Yes", "Yes (basic)", "Varies"] },
        { label: "Pricing", values: ["Free start, INR/UPI", "$225+/session", "$148–225/mo (USD)", "Free", "Free tier + paid"] },
        { label: "India question bank", values: ["Deep (50+ companies)", "N/A", "Thin", "None", "Thin"] },
        { label: "Scored rubric feedback", values: ["Yes (STAR-based)", "Human feedback", "Yes", "No", "Varies"] },
        { label: "Best for", values: ["Indian company interviews", "High-stakes technical gut-check", "US company interviews", "One-off free warmup", "Delivery/communication polish"] },
      ]}
    />
  ),
  /* Early practice session data */
  "early-data-hirestepx-practice-sessions-2026||Behavioral rounds score lowest": (
    <ComparisonTable
      caption="Average overall score (0–100 rubric) on scored HireStepX practice sessions, by month. July is a partial month as of publication."
      columns={[
        { name: "HR round", highlight: true },
        { name: "Salary negotiation" },
        { name: "Behavioral" },
      ]}
      rows={[
        { label: "June 2026", values: ["55.3", "57.7", "51.0"] },
        { label: "July 2026 (partial)", values: ["78.0", "64.5", "55.0"] },
      ]}
    />
  ),

  "best-ai-mock-interview-tools-india-2026||Just using ChatGPT or Gemini directly": (
    <TierCompare cards={[
      { tier: "Campus / fresher", examples: "TCS NQT, Infosys InfyTQ, first job", rows: [{ label: "Pick", range: "HireStepX or Interview Warmup (free)" }] },
      { tier: "Experienced, targeting Indian companies", examples: "Product companies, GCCs, IT services", rows: [{ label: "Pick", range: "HireStepX — India-specific rubric + voice" }] },
      { tier: "Targeting US-headquartered companies", examples: "FAANG, US-based remote roles", rows: [{ label: "Pick", range: "Final Round AI or Interviewing.io" }] },
    ]} />
  ),

};

/* ─── Auto internal links ───────────────────────────────────────────────────
   Returns contextual links based on the post's category and company.
   Rendered after the FAQ and existing relatedLinks — no per-post changes.   */
const COMPANY_SALARY_SLUG: Record<string, string> = {
  "TCS": "tcs", "Infosys": "infosys", "Wipro": "wipro", "HCL": "hcl",
  "Accenture": "accenture", "Cognizant": "cognizant", "Capgemini": "capgemini",
  "Tech Mahindra": "techmahindra", "Mphasis": "mphasis", "LTIMindtree": "ltimindtree",
  "ThoughtWorks": "thoughtworks",
  "Google": "google", "Amazon": "amazon", "Microsoft": "microsoft",
  "Meta": "meta", "Apple": "apple", "Netflix": "netflix",
  "Flipkart": "flipkart", "Swiggy": "swiggy", "Zomato": "zomato",
  "Razorpay": "razorpay", "PhonePe": "phonepe", "Paytm": "paytm",
  "CRED": "cred", "Meesho": "meesho", "Zepto": "zepto",
  "Zerodha": "zerodha", "Groww": "groww", "Upstox": "upstox",
  "Goldman Sachs": "goldman", "JP Morgan": "jpmorgan", "JPMorgan": "jpmorgan",
  "JPMorgan Chase": "jpmorgan", "Barclays": "barclays",
  "Deloitte": "deloitte", "McKinsey": "mckinsey", "BCG": "bcg", "Bain": "bain",
  "Adobe": "adobe", "Salesforce": "salesforce", "Oracle": "oracle",
  "IBM": "ibm", "SAP": "sap", "Atlassian": "atlassian",
  "Uber": "uber", "Airbnb": "airbnb", "Stripe": "stripe",
  "Postman": "postman", "BrowserStack": "browserstack",
  "Freshworks": "freshworks", "Zoho": "zoho", "Dream11": "dream11",
  "ShareChat": "sharechat", "MakeMyTrip": "makemytrip",
  "OYO": "oyo", "Blinkit": "blinkit", "Myntra": "myntra", "Nykaa": "nykaa",
  "Angel One": "angelone", "Bajaj Finance": "bajajfinance",
  "HDFC Bank": "hdfc", "ICICI Bank": "icici", "Axis Bank": "axis",
  "Nvidia": "nvidia", "Intel": "intel", "Qualcomm": "qualcomm",
  "Cisco": "cisco", "VMware": "vmware", "LinkedIn": "linkedin", "Walmart": "walmart",
  "Citadel": "citadel", "D.E. Shaw": "deshaw", "Optiver": "optiver",
  "Millennium": "millennium", "PayPal": "paypal",
  "PhysicsWallah": "physicswallah", "Vedantu": "vedantu", "Scaler": "scaler",
};

function getAutoLinks(post: BlogPost): { label: string; href: string }[] {
  const links: { label: string; href: string }[] = [];
  const { category, company } = post;

  if (category === "Company Guides" && company && company !== "General") {
    const slug = COMPANY_SALARY_SLUG[company];
    links.push({ label: `${company} salary guide`, href: slug ? `/salary#${slug}` : "/salary" });
    links.push({ label: `Practice ${company} interview`, href: "/interview" });
    links.push({ label: "All company interview guides", href: "/companies" });
  }
  if (category === "Salary Guide") {
    links.push({ label: "All company salary guides", href: "/salary" });
    links.push({ label: "Practice salary negotiation", href: "/interview" });
  }
  if (category === "Technical") {
    links.push({ label: "Practice with AI mock interview", href: "/interview" });
    links.push({ label: "Compare company salaries", href: "/salary" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Career") {
    links.push({ label: "Practice for your next move", href: "/interview" });
    links.push({ label: "Know your market salary", href: "/salary" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Freshers") {
    links.push({ label: "Practice campus placement interviews", href: "/interview" });
    links.push({ label: "Fresher salary benchmarks", href: "/salary" });
    links.push({ label: "Campus placement preparation guide", href: "/for-students" });
  }
  if (category === "Behavioral") {
    links.push({ label: "Practice behavioral questions with AI", href: "/interview" });
    links.push({ label: "Interview question bank", href: "/questions" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Role Guides") {
    links.push({ label: "Practice role-specific questions", href: "/interview" });
    links.push({ label: "Salary benchmarks by role", href: "/salary" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Strategy" || category === "Interview Skills" || category === "Interview Tips") {
    links.push({ label: "Apply this in a live mock interview", href: "/interview" });
    links.push({ label: "Practice question bank", href: "/questions" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Industry Insights") {
    links.push({ label: "Company salary benchmarks", href: "/salary" });
    links.push({ label: "Practice industry interviews", href: "/interview" });
    links.push({ label: "All company interview guides", href: "/companies" });
  }
  if (category === "HR") {
    links.push({ label: "Practice HR round questions", href: "/interview" });
    links.push({ label: "Interview preparation hub", href: "/interview-prep" });
  }
  if (category === "Product") {
    links.push({ label: "Practice PM interviews", href: "/interview" });
    links.push({ label: "PM salary guide", href: "/salary" });
  }
  if (category === "Campus Placement") {
    links.push({ label: "Campus placement preparation guide", href: "/for-students" });
    links.push({ label: "Practice campus interviews", href: "/interview" });
  }

  return links;
}

/* ─── Single blog post ─── */
function BlogPostPage({ post, related, afterContent }: { post: BlogPost; related: BlogMeta[]; afterContent?: ReactNode }) {

  /* Derive video CTA copy from the post's company / category */
  const videoCta = (() => {
    const { company, category, cta: body } = post;
    if (category === "Freshers" || company === "Campus") {
      return { headingPlain: "Nail your", headingItalic: "campus placement.", body, ctaLabel: "Start free practice" };
    }
    if (category === "Strategy" || company === "Consulting") {
      return { headingPlain: "Master the", headingItalic: "case interview.", body, ctaLabel: "Practice a case now" };
    }
    if (company === "General" || category === "Skills") {
      return { headingPlain: "Stop reading,", headingItalic: "start answering.", body, ctaLabel: "Try it free" };
    }
    return { headingPlain: `Practice the ${company}`, headingItalic: "interview loop.", body, ctaLabel: `Start ${company} practice` };
  })();

  useEffect(() => {
    captureClientEvent("blog_post_view", {
      slug: post.slug,
      title: post.title,
      category: post.category,
    });
  }, [post.slug, post.title, post.category]);

  const canonicalUrl = `https://hirestepx.com/blog/${post.slug}`;

  /* JSON-LD is injected server-side by app/(marketing)/blog/[slug]/page.tsx
     (Article + FAQPage + BreadcrumbList). useSEO handles only <title> and
     <meta> tags here to avoid duplicate schema on direct page loads. */
  useSEO({
    title: `${post.title}: HireStepX`,
    description: post.metaDescription,
    canonical: canonicalUrl,
    ogImage: post.heroImage,
    ogType: "article",
  });

  /* Table of contents — only for posts with more than 4 sections */
  const showToc = post.sections.length > 4;

  return (
    <BlogShell afterContent={afterContent}>
      {/* Header: tight, centred, no wasted air */}
      <header className="blog-post-header" style={{ background: t.cream, paddingTop: 64, paddingBottom: 20 }}>
        <div className="blog-post-inner" style={{ maxWidth: 720, margin: "0 auto", padding: "0 40px", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 18, fontFamily: fonts.sans, fontSize: 12, color: t.inkFaint, flexWrap: "wrap" }}>
            <span>By {post.author ?? "HireStepX Team"}</span>
            <span aria-hidden style={{ color: t.lineStrong }}>·</span>
            <span>{new Date(post.datePublished).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}</span>
            <span aria-hidden style={{ color: t.lineStrong }}>·</span>
            <span>{post.readTime} read</span>
            <span aria-hidden style={{ color: t.lineStrong }}>·</span>
            <span>{post.category}</span>
          </div>
          <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(26px, 3.2vw, 40px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.024em", lineHeight: 1.15, textWrap: "balance" as const, margin: 0 }}>
            {post.title}
          </h1>
        </div>
      </header>

      {/* Hero image: flush under header, rounded */}
      <div className="blog-post-hero" style={{ maxWidth: 960, margin: "16px auto 0", padding: "0 40px" }}>
        <div className="blog-post-hero-frame" style={{ borderRadius: 12, overflow: "hidden", aspectRatio: "16/7", position: "relative", background: post.heroBg ?? t.creamSoft }}>
          <Image
            src={post.heroImage}
            alt={post.heroAlt}
            fill
            style={
              post.heroImageFit === "contain"
                ? { objectFit: "contain", padding: "10% 18%" }
                : { objectFit: "cover", objectPosition: "center top" }
            }
            priority
            sizes="(max-width: 720px) 100vw, 880px"
          />
        </div>
      </div>

      <article className="blog-article" style={{ maxWidth: 960, margin: "0 auto", padding: "0 40px 100px" }}>

        {/* Single reading column */}
        <div style={{ maxWidth: 720, margin: "0 auto" }}>

          {/* Intro dek */}
          <div style={{ borderTop: `1px solid ${t.line}`, paddingTop: 28, marginTop: 24, marginBottom: 36 }}>
            <p style={{ fontFamily: fonts.sans, fontSize: "clamp(17px, 1.8vw, 20px)", color: t.inkSoft, lineHeight: 1.75, letterSpacing: "-0.005em", margin: 0 }}>
              {post.intro}
            </p>
          </div>

          {/* Table of contents */}
          {showToc && (
            <nav aria-label="Contents" style={{ background: t.creamSoft, border: `1px solid ${t.lineStrong}`, borderRadius: 12, padding: "22px 24px", marginBottom: 56 }}>
              <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: t.inkFaint, margin: "0 0 14px" }}>
                In this guide
              </p>
              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" as const, gap: 10 }}>
                {post.sections.map((s, i) => {
                  const match = s.heading.match(/^(\d+)\.\s+(.+)$/);
                  const label = match ? match[2] : s.heading;
                  const id = `section-${i}`;
                  return (
                    <li key={i} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                      <span style={{ fontFamily: fonts.serif, fontSize: 13, fontStyle: "italic", color: t.copper, opacity: 0.7, flexShrink: 0, minWidth: 20 }}>{i + 1}</span>
                      <a href={`#${id}`} style={{ fontFamily: fonts.sans, fontSize: 14, color: t.coal, textDecoration: "none", lineHeight: 1.4 }}
                        className="ed-link">{label}</a>
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}

          {/* Sections */}
          {post.sections.map((section, i) => {
            const match = section.heading.match(/^(\d+)\.\s+(.+)$/);
            const num = match ? match[1].padStart(2, "0") : null;
            const headingText = match ? match[2] : section.heading;
            const visual = SECTION_VISUALS[`${post.slug}||${section.heading}`];
            /* One inline CTA at the midpoint — not the last section, and only
               for posts long enough that a mid-read break doesn't feel like
               an ambush. More than one interruption per read hurts dwell
               time more than it lifts clicks. */
            const midpoint = Math.floor(post.sections.length / 2);
            const showInlineCta = post.sections.length > 3 && i === midpoint && i < post.sections.length - 1;
            return (
              <React.Fragment key={i}>
                <section id={`section-${i}`} style={{ paddingTop: i === 0 ? 0 : 56, borderTop: i > 0 ? `1px solid ${t.line}` : "none" }}>
                  {num && (
                    <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, color: t.copper, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: 12 }}>
                      Question {num}
                    </p>
                  )}
                  <h2 style={{ fontFamily: fonts.serif, fontSize: "clamp(22px, 2.6vw, 32px)", fontWeight: 400, color: t.coal, marginBottom: 20, lineHeight: 1.2, letterSpacing: "-0.02em", textWrap: "balance" as const }}>
                    {headingText}
                  </h2>
                  <MarkdownProse text={section.content} />
                  {visual}
                </section>
                {showInlineCta && (
                  <div style={{ margin: "48px 0", padding: "24px 28px", background: t.coal, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" as const }}>
                    <p style={{ fontFamily: fonts.sans, fontSize: 14, color: t.creamMuted, margin: 0, lineHeight: 1.5, flex: 1, minWidth: "18ch" }}>
                      {post.cta}
                    </p>
                    <Link href="/signup?source=blog-inline" className="ed-cta" style={{ ...ctaPrimaryStyle("md"), flexShrink: 0, whiteSpace: "nowrap" as const, textDecoration: "none" }}>
                      Practice free <span className="ed-cta-arrow" aria-hidden>→</span>
                    </Link>
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {/* FAQ */}
          {post.faqs.length > 0 && (
            <section style={{ paddingTop: 52, borderTop: `1px solid ${t.line}`, marginBottom: 52 }}>
              <h2 style={{ fontFamily: fonts.serif, fontSize: "clamp(26px, 3.2vw, 38px)", fontWeight: 400, color: t.coal, marginBottom: 20, letterSpacing: "-0.02em" }}>
                Frequently asked questions
              </h2>
              <div style={{ background: t.white, border: `1px solid ${t.line}`, borderRadius: 14, overflow: "hidden" }}>
                {post.faqs.map((faq, i) => (
                  <details key={i} className="mv2p-faq" style={{ borderTop: i === 0 ? "none" : `1px solid ${t.line}`, padding: "20px 24px" }}>
                    <summary style={{ cursor: "pointer", fontFamily: fonts.sans, fontSize: 16, color: t.coal, letterSpacing: "-0.01em", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, fontWeight: 600 }}>
                      {faq.question}
                      <span aria-hidden className="mv2p-faq-marker" style={{ color: t.copper, fontSize: 22, fontFamily: fonts.sans, fontWeight: 300, lineHeight: 1, display: "inline-block", flexShrink: 0 }}>+</span>
                    </summary>
                    <div style={{ margin: "12px 0 0" }}>
                      <MarkdownProse text={faq.answer} style={{ fontSize: 15, lineHeight: 1.65, color: t.inkSoft }} />
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Explore more — practice links, related links, and auto-generated
              contextual links used to render as three separate sections with
              their own headings. Merged into one deduped, capped block: three
              stacked CTA sections in a row reads as a funnel, not a footer. */}
          {(() => {
            const seen = new Set<string>();
            const combined: { label: string; href: string }[] = [];
            for (const { label, slug } of post.practicePageSlugs ?? []) {
              const href = `/questions/${slug}`;
              if (seen.has(href)) continue;
              seen.add(href);
              combined.push({ label, href });
            }
            for (const link of post.relatedLinks ?? []) {
              if (seen.has(link.href)) continue;
              seen.add(link.href);
              combined.push(link);
            }
            for (const link of getAutoLinks(post)) {
              if (seen.has(link.href)) continue;
              seen.add(link.href);
              combined.push(link);
            }
            const capped = combined.slice(0, 6);
            if (capped.length === 0) return null;
            return (
              <section style={{ marginTop: 48, paddingTop: 48, borderTop: `1px solid ${t.line}` }}>
                <p style={{ fontFamily: fonts.sans, fontSize: 11, fontWeight: 700, color: t.copper, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                  Explore more
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {capped.map(({ label, href }) => (
                    <Link key={href} href={href} className="ed-cta" style={{ display: "inline-block", padding: "9px 16px", background: t.creamSoft, border: `1px solid ${t.lineStrong}`, borderRadius: 8, textDecoration: "none", fontFamily: fonts.sans, fontSize: 13, fontWeight: 500, color: t.coal }}>
                      {label} <span className="ed-cta-arrow" aria-hidden>→</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })()}

        </div>{/* end reading column */}

        {/* Continue reading: spans full article width, outside the reading column */}
        {related.length > 0 && (
          <section style={{ marginTop: 80, paddingTop: 48, borderTop: `1px solid ${t.line}` }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28 }}>
              <h2 style={{ fontFamily: fonts.serif, fontSize: "clamp(22px, 2.6vw, 30px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.018em", margin: 0 }}>
                Continue reading
              </h2>
              <Link href="/blog" style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 700, color: t.copper, textDecoration: "none", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                All posts →
              </Link>
            </div>
            <div className="blog-related-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${related.length}, 1fr)`, gap: 24 }}>
              {related.map(r => <CompactCard key={r.slug} post={r} />)}
            </div>
          </section>
        )}

      </article>

      {/* Closing CTA: homepage video CTA with post-specific copy */}
      <VideoCtaV2 {...videoCta} ctaHref="/signup" />
    </BlogShell>
  );
}

/* ─── Main export ───────────────────────────────────────────────────
 * Data is looked up server-side (app/(marketing)/blog/**\/page.tsx) and
 * passed down as props, so this client component never needs to import
 * the full post/meta arrays itself. Pass `post` for a single-post view
 * (with its `related` cards) or `metas` for the index view. */
export default function BlogPage({
  post,
  related,
  metas,
  page,
  afterContent,
}: {
  post?: BlogPost;
  related?: BlogMeta[];
  metas?: BlogMeta[];
  page?: number;
  afterContent?: ReactNode;
} = {}) {
  if (post) {
    return <BlogPostPage post={post} related={related ?? []} afterContent={afterContent} />;
  }
  if (metas) {
    return <BlogIndex metas={metas} initialPage={page} />;
  }
  return (
    <BlogShell>
      <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "160px 40px 80px", textAlign: "center" }}>
        <p style={{ fontFamily: fonts.sans, fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: t.copper, marginBottom: 14 }}>404</p>
        <h1 style={{ fontFamily: fonts.serif, fontSize: "clamp(36px, 4.5vw, 56px)", fontWeight: 400, color: t.coal, letterSpacing: "-0.025em", lineHeight: 1.05, marginBottom: 14 }}>
          Post not found
        </h1>
        <p style={{ fontFamily: fonts.sans, fontSize: 16, color: t.inkSoft, marginBottom: 28, maxWidth: "52ch" }}>
          That story might have moved or never existed. The blog index still has the rest of it.
        </p>
        <Link href="/blog" style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontFamily: fonts.sans, fontSize: 14, fontWeight: 600,
          padding: "11px 22px", borderRadius: 999, textDecoration: "none",
          background: t.indigo, color: t.white,
        }}>
          Back to blog
        </Link>
      </div>
    </BlogShell>
  );
}
