import { describe, expect, it } from "vitest";
import { buildResourceItems } from "../home2/resourcesBuild";
import { CITY_PAGES } from "../../data/city-pages";
import { SEO_PAGES } from "../../data/seo-pages";
import { SALARY_SEO_PAGES } from "../../data/salary-seo";
import { BLOG_POSTS } from "../../data/blog-posts";

describe("2.0 resources index covers every SEO route", () => {
  const hrefs = new Set(buildResourceItems().map((i) => i.h));

  it("links the salary report, interview-prep hub and companies hub", () => {
    for (const h of ["/salary-report-2026", "/interview-prep", "/companies"]) expect(hrefs.has(h)).toBe(true);
  });
  it("links every city page", () => {
    for (const c of CITY_PAGES) expect(hrefs.has(`/interview-prep/${c.slug}`)).toBe(true);
  });
  it("links every question, salary, company and blog page", () => {
    for (const p of SEO_PAGES) {
      expect(hrefs.has(`/questions/${p.slug}`)).toBe(true);
      expect(hrefs.has(`/companies/${p.company}`)).toBe(true);
    }
    for (const p of SALARY_SEO_PAGES) expect(hrefs.has(`/salary/${p.slug}`)).toBe(true);
    for (const p of BLOG_POSTS) expect(hrefs.has(`/blog/${p.slug}`)).toBe(true);
  });
  it("has no duplicate hrefs", () => {
    const all = buildResourceItems().map((i) => i.h);
    expect(new Set(all).size).toBe(all.length);
  });
});
