import { describe, expect, it } from "vitest";
import { buildResourceItems } from "../home2/resourcesBuild";
import { CITY_PAGES } from "../../data/city-pages";
import { SEO_PAGES } from "../../data/seo-pages";
import { SALARY_SEO_PAGES } from "../../data/salary-seo";
import { BLOG_POSTS } from "../../data/blog-posts";
import { CARD_REDIRECTS } from "../home2/cardRedirects";

describe("2.0 resources index covers every SEO route", () => {
  const hrefs = new Set(buildResourceItems().map((i) => i.h));
  const linked = (h: string) => hrefs.has(CARD_REDIRECTS[h] ?? h);

  it("links the salary report, interview-prep hub and companies hub", () => {
    for (const h of ["/salary-report-2026", "/interview-prep", "/companies"]) expect(hrefs.has(h)).toBe(true);
  });
  it("links every city page", () => {
    for (const c of CITY_PAGES) expect(hrefs.has(`/interview-prep/${c.slug}`)).toBe(true);
  });
  it("links every question, salary, company and blog page", () => {
    for (const p of SEO_PAGES) {
      expect(linked(`/questions/${p.slug}`)).toBe(true);
      expect(linked(`/companies/${p.company}`)).toBe(true);
    }
    for (const p of SALARY_SEO_PAGES) expect(linked(`/salary/${p.slug}`)).toBe(true);
    for (const p of BLOG_POSTS) expect(linked(`/blog/${p.slug}`)).toBe(true);
  });
  it("has no duplicate hrefs within a kind", () => {
    const all = buildResourceItems().map((i) => `${i.k}|${i.h}`);
    expect(new Set(all).size).toBe(all.length);
  });
});
