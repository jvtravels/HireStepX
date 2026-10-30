import { describe, it, expect } from "vitest";
import { BLOG_POSTS } from "../../data/blog-posts";
import { BLOG_META } from "../blog-meta";

describe("blog dateModified", () => {
  const metaBySlug = new Map(BLOG_META.map((m) => [m.slug, m]));

  it("is mirrored between blog-posts and blog-meta", () => {
    for (const post of BLOG_POSTS) {
      expect(metaBySlug.get(post.slug)?.dateModified, post.slug).toBe(post.dateModified);
    }
  });

  it("is a valid date that is not before datePublished", () => {
    for (const post of BLOG_POSTS) {
      if (!post.dateModified) continue;
      expect(post.dateModified, post.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(post.dateModified >= post.datePublished, post.slug).toBe(true);
    }
  });
});
