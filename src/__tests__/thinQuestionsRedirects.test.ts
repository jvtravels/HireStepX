import { describe, it, expect } from "vitest";
import redirects from "../../data/thin-questions-redirects.json";
import { SEO_PAGES } from "../../data/seo-pages";
import { QUESTION_BANK } from "../../data/interview-question-bank";
import { isThinDuplicateQuestionsPage } from "../../app/(marketing)/questions/[slug]/_jsonld";
import { getBlogPostBySlug } from "../../data/blog-posts";
import { getSalaryPage } from "../../data/salary-seo";

describe("thin /questions redirects", () => {
  const entries = Object.entries(redirects as Record<string, string>);

  it("only redirects pages that are still thin with no company questions", () => {
    for (const [slug] of entries) {
      const page = SEO_PAGES.find((p) => p.slug === slug);
      expect(page, slug).toBeTruthy();
      expect(isThinDuplicateQuestionsPage(slug), slug).toBe(true);
      expect(QUESTION_BANK.some((q) => q.company === page!.company), slug).toBe(false);
    }
  });

  it("points every redirect at an existing blog post or salary page", () => {
    for (const [slug, dest] of entries) {
      const [, kind, target] = dest.split("/");
      if (kind === "blog") expect(getBlogPostBySlug(target), slug).toBeTruthy();
      else if (kind === "salary") expect(getSalaryPage(target), slug).toBeTruthy();
      else throw new Error(`${slug}: unexpected destination ${dest}`);
    }
  });
});
