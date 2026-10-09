import { getBlogPostBySlug, type BlogPost } from "../data/blog-posts";

/* AdSense "Low value content" gate for blog posts. Below this many words a
   post has too little substance to stand alone in search or carry ads. */
export const THIN_BLOG_WORD_THRESHOLD = 700;

export function blogPostWordCount(post: Pick<BlogPost, "intro" | "sections">): number {
  const text = [post.intro, ...post.sections.flatMap((s) => [s.heading, s.content])].join(" ");
  return text.split(/\s+/).filter(Boolean).length;
}

export function isThinBlogPost(slug: string): boolean {
  const post = getBlogPostBySlug(slug);
  if (!post) return false;
  return blogPostWordCount(post) < THIN_BLOG_WORD_THRESHOLD;
}
