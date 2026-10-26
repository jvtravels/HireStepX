import { describe, it, expect } from "vitest";
import thin from "../../data/thin-questions-redirects.json";
import { questionHref, isThinQuestionSlug } from "../seoLinks";
import sitemap from "../../app/sitemap";

describe("questionHref", () => {
  it("links thin slugs straight to their redirect target", () => {
    for (const [slug, dest] of Object.entries(thin as Record<string, string>)) {
      expect(questionHref(slug)).toBe(dest);
      expect(isThinQuestionSlug(slug)).toBe(true);
    }
  });
  it("leaves real question pages alone", () => {
    expect(questionHref("not-a-thin-slug")).toBe("/questions/not-a-thin-slug");
  });
});

describe("sitemap", () => {
  const urls = sitemap().map((e) => e.url);
  it("excludes URLs that redirect elsewhere", () => {
    for (const p of ["/login", "/signup", "/how-it-works", "/for-students", "/grievance"]) {
      expect(urls).not.toContain(`https://hirestepx.com${p}`);
    }
  });
  it("has no thin questions pages", () => {
    for (const slug of Object.keys(thin)) {
      expect(urls).not.toContain(`https://hirestepx.com/questions/${slug}`);
    }
  });
  it("has no duplicate URLs", () => {
    expect(new Set(urls).size).toBe(urls.length);
  });
});

import { buildResourceItems } from "../home2/resourcesBuild";

describe("hub crawlability", () => {
  const hrefs = new Set(buildResourceItems().map((i) => i.h));
  const urls = sitemap().map((e) => e.url.replace("https://hirestepx.com", ""));
  it("every sitemap question/salary/blog page is listed in the hub index", () => {
    const missing = urls.filter((p) => /^\/(questions|salary|blog)\/[^/]+$/.test(p) && !hrefs.has(p));
    expect(missing).toEqual([]);
  });
});
