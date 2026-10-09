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

/* Thin posts that already earn search clicks (GSC, Jul 12 - Oct 8 2026, >=5
   clicks). They stay indexable so we keep that traffic, but still load no ads. */
const THIN_BUT_RANKING = new Set([
  "plivo-interview-experience-2026",
  "purplle-interview-experience-2026",
  "sigmoid-interview-experience-2026",
  "clevertap-interview-experience-2026",
  "ltimindtree-interview-questions-freshers-2026",
  "ixigo-interview-experience-2026",
  "zetwerk-interview-experience-2026",
  "procter-gamble-interview-experience-2026",
  "hul-uflp-interview-experience-2026",
  "zoho-interview-questions-freshers-2026",
  "hcl-interview-questions-freshers-2026",
  "policybazaar-interview-experience-2026",
  "kreditbee-interview-experience-2026",
  "licious-interview-experience-2026",
  "exotel-interview-experience-2026",
]);

export function shouldNoindexBlogPost(slug: string): boolean {
  return isThinBlogPost(slug) && !THIN_BUT_RANKING.has(slug);
}
