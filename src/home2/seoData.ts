import { BLOG_POSTS } from "../../data/blog-posts";
import type { BlogPost } from "../../data/blog-posts";
import { salaryCompanyLabel } from "../../data/salary-seo";
import { COMPANY_META } from "../../data/company-salary-overrides";
import { COMPANY_KNOWN_FACTS } from "../../data/company-known-facts";
import { CALIBRATION_DATE } from "../../data/salaries";
import { SALARY_GROUPS, SLUG_TO_GROUP } from "../../data/salary-groups";
import { BLOG_META, getBlogMetasBySlugs } from "../blog-meta";
import { getAutoLinks } from "../blogAutoLinks";
import { buildSalaryPageModel } from "../../app/(marketing)/salary/[company]/_jsonld";
import { buildQuestionsPageModel } from "../../app/(marketing)/questions/[slug]/_jsonld";
import type { ArticleTemplateProps, SalaryTemplateProps } from "./SeoTemplates";

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
  for (const { label, slug } of post.practicePageSlugs ?? []) add(label, `/questions/${slug}`);
  for (const l of post.relatedLinks ?? []) add(l.label, l.href);
  for (const l of getAutoLinks(post)) add(l.label, l.href);
  return { post, explore: explore.slice(0, 6), related: getBlogMetasBySlugs(post.relatedSlugs) };
}

export function salaryProps(company: string): SalaryTemplateProps | null {
  const model = buildSalaryPageModel(company);
  if (!model) return null;
  const key = company.replace(/-/g, " ");
  const group = SLUG_TO_GROUP[company];
  const related = group
    ? SALARY_GROUPS[group].filter((s) => s !== company).slice(0, 5).map((s) => ({ slug: s, label: salaryCompanyLabel(s) }))
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
