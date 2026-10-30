import { BLOG_POSTS } from "../../data/blog-posts";
import type { BlogPost } from "../../data/blog-posts";
import { salaryCompanyLabel } from "../../data/salary-seo";
import { COMPANY_META } from "../../data/company-salary-overrides";
import { COMPANY_KNOWN_FACTS } from "../../data/company-known-facts";
import { CALIBRATION_DATE } from "../../data/salaries";
import { SALARY_GROUPS, SLUG_TO_GROUP } from "../../data/salary-groups";
import { BLOG_META, getBlogMetasBySlugs } from "../blog-meta";
import { blogDuplicateKeeper, shouldNoindexBlogPost } from "../blogQuality";
import { getAutoLinks } from "../blogAutoLinks";
import { buildSalaryPageModel } from "../../app/(marketing)/salary/[company]/_jsonld";
import { buildQuestionsPageModel } from "../../app/(marketing)/questions/[slug]/_jsonld";
import type { ArticleTemplateProps, SalaryTemplateProps } from "./SeoTemplates";
import { questionHref } from "../seoLinks";

const RELATED_TARGET = 6;

/* Curated relatedSlugs leave most posts with 1-2 inbound links, which is why Google
   "discovers" them without crawling. Pad each post's list from its own category,
   picking the least-linked candidates first so inbound links spread evenly. Computed
   once in BLOG_POSTS order so the result does not depend on render order. */
let relatedCache: Map<string, string[]> | undefined;
function relatedFor(post: BlogPost): string[] {
  if (!relatedCache) {
    const live = (slug: string) => !blogDuplicateKeeper(slug) && !shouldNoindexBlogPost(slug);
    const inbound = new Map<string, number>();
    const bump = (slug: string) => inbound.set(slug, (inbound.get(slug) ?? 0) + 1);
    const out = new Map<string, string[]>();
    for (const p of BLOG_POSTS) {
      const base = (p.relatedSlugs ?? []).filter((s) => s !== p.slug && live(s));
      out.set(p.slug, base);
      base.forEach(bump);
    }
    for (const p of BLOG_POSTS) {
      const list = out.get(p.slug) ?? [];
      if (list.length >= RELATED_TARGET) continue;
      const candidates = BLOG_META.filter((m) => m.category === p.category && m.slug !== p.slug && !list.includes(m.slug) && live(m.slug))
        .sort((a, b) => (inbound.get(a.slug) ?? 0) - (inbound.get(b.slug) ?? 0));
      for (const c of candidates) {
        if (list.length >= RELATED_TARGET) break;
        list.push(c.slug);
        bump(c.slug);
      }
    }
    relatedCache = out;
  }
  return relatedCache.get(post.slug) ?? post.relatedSlugs;
}

export function articlePost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

/* Same merge as BlogPage's "Explore more": practice pages, curated links, then category auto-links; deduped, capped at 6. */
export function articleProps(post: BlogPost): ArticleTemplateProps {
  const seen = new Set<string>();
  const explore: { label: string; href: string }[] = [];
  const add = (label: string, href: string) => {
    if (seen.has(href)) return;
    seen.add(href);
    explore.push({ label, href });
  };
  for (const { label, slug } of post.practicePageSlugs ?? []) add(label, questionHref(slug));
  for (const l of post.relatedLinks ?? []) add(l.label, l.href);
  for (const l of getAutoLinks(post)) add(l.label, l.href);
  return { post, explore: explore.slice(0, 6), related: getBlogMetasBySlugs(relatedFor(post)) };
}

export function salaryProps(company: string): SalaryTemplateProps | null {
  const model = buildSalaryPageModel(company);
  if (!model) return null;
  const key = company.replace(/-/g, " ");
  const group = SLUG_TO_GROUP[company];
  const headline = model.roles[0];
  const headLevel = headline?.bands[0]?.level;
  const related = group
    ? SALARY_GROUPS[group].filter((s) => s !== company).slice(0, 5).map((s) => {
        const peer = buildSalaryPageModel(s);
        const role = peer?.roles.find((r) => r.roleKey === headline?.roleKey) ?? peer?.roles[0];
        const band = role?.bands.find((b) => b.level === headLevel) ?? role?.bands[0];
        return {
          slug: s,
          label: salaryCompanyLabel(s),
          band: band && role ? { role: role.roleLabel, level: band.levelLabel, min: band.totalMin, max: band.totalMax } : undefined,
        };
      })
    : [];
  return {
    company,
    model,
    meta: COMPANY_META[company] ?? COMPANY_META[key],
    facts: COMPANY_KNOWN_FACTS[company] ?? COMPANY_KNOWN_FACTS[key],
    related: related.length >= 2 ? related : [],
    groupLabel: group ?? "",
    blogSlug: BLOG_META.find((p) => p.company.toLowerCase() === company)?.slug,
    calibrationDate: CALIBRATION_DATE,
  };
}

export function questionsModel(slug: string) {
  return buildQuestionsPageModel(slug);
}
