import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { SEO_PAGES } from "../../data/seo-pages";

/**
 * Blog → /questions internal-link integrity gate.
 *
 * Every blog post carries a `practicePageSlugs` array that renders
 * "Practice these questions" links pointing at /questions/<slug>. If a
 * slug drifts from the real SEO_PAGES set (renamed page, typo, invented
 * slug), the link 404s — dead internal links waste crawl equity and emit
 * soft-404 signals, silently, with no type error to catch them.
 *
 * This gate parses the practicePageSlugs entries straight out of the
 * data/blog-posts.ts source (a source scan is the idiomatic check here —
 * mirrors designTokenHexGate) and asserts each slug resolves to a real
 * /questions/[slug] page.
 *
 * When you add or rename an SEO page, update the referencing blog posts
 * and this test stays green automatically. When a reference breaks, it
 * names the offending slug.
 */

const BLOG_SRC = join(process.cwd(), "data", "blog-posts.ts");

/* practicePageSlugs entries are object literals of the shape
   `{ label: "…", slug: "…" }`. Match the slug of any entry that also
   carries a label on the same line, which is exactly the cross-link
   shape (and excludes the post's own top-level `slug: "…",`). */
const ENTRY = /\{\s*label:\s*"[^"]+",\s*slug:\s*"([a-z0-9-]+)"\s*\}/g;

/* relatedSlugs are blog→blog links: `relatedSlugs: ["a", "b", …]`. They
   must reference other blog-post slugs (NOT /questions SEO slugs). */
const RELATED = /relatedSlugs:\s*\[([^\]]*)\]/g;
const QUOTED = /"([a-z0-9-]+)"/g;

describe("blog practice-link integrity", () => {
  const realSlugs = new Set(SEO_PAGES.map((p) => p.slug));
  const source = readFileSync(BLOG_SRC, "utf8");

  const referenced: string[] = [];
  for (const m of source.matchAll(ENTRY)) referenced.push(m[1]);

  it("finds practicePageSlugs entries to validate", () => {
    // Guards against the regex silently matching nothing after a refactor.
    expect(referenced.length).toBeGreaterThan(40);
  });

  it("every practicePageSlugs slug resolves to a real /questions page", () => {
    const broken = [...new Set(referenced)].filter((s) => !realSlugs.has(s));
    expect(
      broken,
      `Blog posts link to /questions/<slug> pages that don't exist in SEO_PAGES:\n${broken.join("\n")}`,
    ).toEqual([]);
  });

  it("every relatedSlugs entry resolves to a real blog post", () => {
    /* Blog-post slugs are top-level `slug: "…",` entries. */
    const blogSlugs = new Set(
      [...source.matchAll(/^\s*slug:\s*"([a-z0-9-]+)",/gm)].map((m) => m[1]),
    );
    const relatedRefs: string[] = [];
    for (const block of source.matchAll(RELATED)) {
      for (const q of block[1].matchAll(QUOTED)) relatedRefs.push(q[1]);
    }
    expect(relatedRefs.length).toBeGreaterThan(20);

    const broken = [...new Set(relatedRefs)].filter((s) => !blogSlugs.has(s));
    expect(
      broken,
      `relatedSlugs reference blog posts that don't exist (a /questions SEO slug likely leaked in):\n${broken.join("\n")}`,
    ).toEqual([]);
  });
});
