import { describe, it, expect } from "vitest";
import { blogPostWordCount, isThinBlogPost, shouldNoindexBlogPost, THIN_BLOG_WORD_THRESHOLD } from "../blogQuality";
import { BLOG_POSTS } from "../../data/blog-posts";

describe("blogQuality", () => {
  it("counts intro, headings and section content", () => {
    expect(blogPostWordCount({ intro: "one two", sections: [{ heading: "three", content: "four five" }] })).toBe(5);
  });

  it("treats unknown slugs as not thin", () => {
    expect(isThinBlogPost("does-not-exist")).toBe(false);
  });

  it("flags exactly the posts under the threshold", () => {
    for (const p of BLOG_POSTS) {
      expect(isThinBlogPost(p.slug)).toBe(blogPostWordCount(p) < THIN_BLOG_WORD_THRESHOLD);
    }
  });

  it("keeps thin posts that already rank indexable", () => {
    expect(isThinBlogPost("plivo-interview-experience-2026")).toBe(true);
    expect(shouldNoindexBlogPost("plivo-interview-experience-2026")).toBe(false);
  });

  it("noindexes only thin posts outside the ranking allowlist", () => {
    const noindexed = BLOG_POSTS.filter((p) => shouldNoindexBlogPost(p.slug));
    expect(noindexed.length).toBeGreaterThan(0);
    for (const p of noindexed) expect(isThinBlogPost(p.slug)).toBe(true);
  });

  it("keeps a healthy majority of posts indexable", () => {
    const thin = BLOG_POSTS.filter((p) => isThinBlogPost(p.slug)).length;
    expect(thin / BLOG_POSTS.length).toBeLessThan(0.4);
  });
});

describe("blog duplicate redirects", () => {
  it("point at existing posts that are not themselves redirected", async () => {
    const { blogDuplicateKeeper } = await import("../blogQuality");
    const redirects = (await import("../../data/blog-duplicate-redirects.json")).default as Record<string, string>;
    const slugs = new Set(BLOG_POSTS.map((p) => p.slug));
    for (const [dup, keeper] of Object.entries(redirects)) {
      expect(slugs.has(keeper)).toBe(true);
      expect(blogDuplicateKeeper(keeper)).toBeUndefined();
      expect(dup).not.toBe(keeper);
    }
  });

  it("no post lists a redirected duplicate as a related post", async () => {
    const redirects = (await import("../../data/blog-duplicate-redirects.json")).default as Record<string, string>;
    for (const p of BLOG_POSTS) {
      for (const r of p.relatedSlugs ?? []) expect(redirects[r]).toBeUndefined();
    }
  });
});
