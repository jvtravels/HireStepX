"use client";
import React, { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { captureClientEvent } from "./posthogClient";
import Image from "next/image";
import Link from "next/link";
import { tokens as t, fonts } from "./auth/_tokens";
import { NavV2, MobileStickyCTA, VideoCtaV2 } from "./marketing-v2/HomepageV2";
import { FooterDome as FinalCTAFooterV2 } from "./marketing-v2/FooterDome";
import { useSEO } from "./useSEO";
import { editorialCSS, MarkdownProse, ctaPrimaryStyle } from "./marketing-v2/_editorial";
import type { BlogPost } from "../data/blog-posts";
import type { BlogMeta } from "./blog-meta";
import { CATEGORY_BUCKET_MAP, CATEGORY_BUCKETS, bucketToSlug } from "./blog-categories";
import { CopyEmailLink } from "./_CopyEmailLink";
import { SearchWithSuggestions } from "@/components/SearchWithSuggestions";
import { SECTION_VISUALS } from "./blog/sectionVisuals";

/* PageShell: mirrors marketing-v2 chrome so the blog inherits the
   editorial brand (cream surface, Instrument Serif + Geist Sans, copper
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
const RECENT_SEARCHES_KEY = "hirestepx-blog-recent-searches";

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

  const suggestedFilters = useMemo(() => {
    const suggestions: Array<{ label: string; apply: () => void }> = [];
    for (const cat of CATEGORIES) {
      if (cat === activeCategory) continue;
      suggestions.push({ label: `Category: ${cat}`, apply: () => { setActiveCategory(cat); resetPage(); } });
      if (suggestions.length >= 4) break;
    }
    return suggestions;
  }, [activeCategory]);

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
          <div style={{ maxWidth: 540, margin: "0 auto" }}>
            <SearchWithSuggestions
              id="blog-search"
              label="Search blog"
              value={searchQuery}
              onChange={value => { setSearchQuery(value); resetPage(); }}
              placeholder="Search by company, topic, or keyword…"
              storageKey={RECENT_SEARCHES_KEY}
              suggestedFilters={suggestedFilters}
              style={{ width: "100%", textAlign: "left" }}
            />
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

          {/* Sources & methodology: an E-E-A-T trust block on every post, not
              a per-post hand-edit. Interview-experience posts blend
              candidate-reported detail with HireStepX-compiled practice
              questions, and a reader can't tell which is which without this
              — see the SEO brief's §13 (sources, review signal, correction
              path are required on every major content page). */}
          <section style={{ marginTop: 48, paddingTop: 28, borderTop: `1px solid ${t.line}` }}>
            <p style={{ fontFamily: fonts.sans, fontSize: 13, lineHeight: 1.7, color: t.inkFaint, margin: 0 }}>
              This guide combines candidate-reported interview experiences (from platforms like AmbitionBox and Glassdoor, and direct submissions) with practice questions compiled by the HireStepX team to help you rehearse — the two aren&apos;t the same thing, and we don&apos;t present a practice question as a verified historical one. See our{" "}
              <Link href="/methodology" className="ed-link" style={{ color: t.inkSoft, textDecoration: "underline" }}>
                methodology
              </Link>{" "}
              for how we source and label. Published {new Date(post.datePublished).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}. Spot something outdated or wrong? Email{" "}
              <CopyEmailLink email="hello@hirestepx.com" style={{ color: t.inkSoft, textDecoration: "underline" }} />.
            </p>
          </section>

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
          padding: "11px 22px", borderRadius: 8, textDecoration: "none",
          background: t.indigo, color: t.white,
        }}>
          Back to blog
        </Link>
      </div>
    </BlogShell>
  );
}
