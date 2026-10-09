import { describe, it, expect } from "vitest";
import { blogPostWordCount, isThinBlogPost, THIN_BLOG_WORD_THRESHOLD } from "../blogQuality";
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

  it("keeps a healthy majority of posts indexable", () => {
    const thin = BLOG_POSTS.filter((p) => isThinBlogPost(p.slug)).length;
    expect(thin / BLOG_POSTS.length).toBeLessThan(0.4);
  });
});
