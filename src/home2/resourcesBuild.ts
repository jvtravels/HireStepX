import { BLOG_POSTS } from "../../data/blog-posts";
import { SEO_PAGES } from "../../data/seo-pages";
import { SALARY_SEO_PAGES, salaryCompanyLabel } from "../../data/salary-seo";
import { COMPANY_LABEL } from "../../data/company-labels";
import type { Item } from "./resourcesData";

const label = (slug: string) => COMPANY_LABEL[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);

export function buildResourceItems(): Item[] {
  const guides: Item[] = BLOG_POSTS.map((p) => ({
    k: p.category === "Salary Guide" ? "salary" : "guide",
    t: p.title,
    h: `/blog/${p.slug}`,
    co: p.company || "",
    tag: p.category,
    rt: parseInt(p.readTime, 10) || undefined,
  }));
  const salaries: Item[] = SALARY_SEO_PAGES.map((p) => ({
    k: "salary", t: p.searchPhrase, h: `/salary/${p.slug}`, co: salaryCompanyLabel(p.slug), tag: "Salary", d: p.hubNote,
  }));
  const questions: Item[] = SEO_PAGES.map((p) => ({
    k: "question", t: p.searchPhrase, h: `/questions/${p.slug}`, co: label(p.company), role: p.roleFamily, focus: p.focus,
  }));
  const companies: Item[] = [...new Set(SEO_PAGES.map((p) => p.company))].map((c) => ({
    k: "company", t: `${label(c)} interview guide`, h: `/companies/${c}`, co: label(c),
  }));
  return [...guides, ...salaries, ...questions, ...companies];
}
