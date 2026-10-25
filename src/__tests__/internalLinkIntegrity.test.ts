import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { BLOG_POSTS } from "../../data/blog-posts";
import { SEO_PAGES } from "../../data/seo-pages";

/* Internal-link integrity gate. Every literal in-site href in marketing and
   page code must resolve to a real route, a real blog/SEO slug, or a
   next.config.js redirect/rewrite. Catches dead links before a staging
   merge ships them to production. */

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "src/home2", "src/marketing-v2", "src/auth", "data/blog-posts.ts"];
const HREF = /href\s*[=:]\s*\{?\s*["'](\/[^"'\s{}$]*)["']/g;

function walk(p: string, out: string[] = []): string[] {
  const s = statSync(join(ROOT, p));
  if (s.isFile()) { out.push(p); return out; }
  for (const e of readdirSync(join(ROOT, p))) {
    if (e === "node_modules" || e === "__tests__" || e === "api") continue;
    walk(join(p, e), out);
  }
  return out;
}

function routePatterns(): RegExp[] {
  return walk("app")
    .filter((f) => /\/page\.tsx$/.test(f) && !f.startsWith("app/api/"))
    .map((f) => {
      const segs = relative("app", f).replace(/\/page\.tsx$/, "").split("/")
        .filter((s) => s && !/^\(.*\)$/.test(s));
      const re = segs.map((s) => (/^\[.*\]$/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("/");
      return new RegExp(`^/${re}$`);
    });
}

describe("internal link integrity", () => {
  const routes = routePatterns();
  const config = readFileSync(join(ROOT, "next.config.js"), "utf8");
  const redirectSources = new Set([...config.matchAll(/source:\s*"(\/[^":]*)"/g)].map((m) => m[1]));
  const blogSlugs = new Set(BLOG_POSTS.map((p) => p.slug));
  const seoSlugs = new Set(SEO_PAGES.map((p) => p.slug));

  function resolves(path: string): boolean {
    const clean = path.replace(/[?#].*$/, "").replace(/(.)\/$/, "$1");
    if (clean === "" || clean === "/") return true;
    if (clean.startsWith("/_next") || /\.[a-z0-9]+$/i.test(clean)) return true;
    const blog = clean.match(/^\/blog\/([^/]+)$/);
    if (blog && !blogSlugs.has(blog[1])) return redirectSources.has(clean);
    const q = clean.match(/^\/(?:questions|companies)\/([^/]+)$/);
    if (q && !seoSlugs.has(q[1])) return redirectSources.has(clean);
    if (redirectSources.has(clean)) return true;
    return routes.some((r) => r.test(clean));
  }

  it("every literal internal href resolves", () => {
    const broken: string[] = [];
    for (const f of SCAN_DIRS.flatMap((d) => walk(d)).filter((f) => /\.(tsx?|ts)$/.test(f))) {
      const src = readFileSync(join(ROOT, f), "utf8");
      for (const m of src.matchAll(HREF)) {
        if (!resolves(m[1])) broken.push(`${f}: ${m[1]}`);
      }
    }
    expect([...new Set(broken)]).toEqual([]);
  });
});
