import thinQuestionRedirects from "../data/thin-questions-redirects.json";

const THIN: Record<string, string> = thinQuestionRedirects;

export function isThinQuestionSlug(slug: string): boolean {
  return slug in THIN;
}

/* Thin /questions/<slug> pages 308 to their company's blog or salary page; link straight to the destination so internal links never spend a redirect hop. */
export function questionHref(slug: string): string {
  return THIN[slug] ?? `/questions/${slug}`;
}
