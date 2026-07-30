/* Category bucketing shared between the client blog index (BlogPage.tsx)
 * and the server-rendered /blog/category/[category] pages. Kept in its own
 * server-safe file (no "use client") so Server Components can import it
 * without pulling in BlogPage's client bundle.
 *
 * Consolidates the many raw `category` values on BLOG_META into a small
 * set of user-intent buckets people actually browse by.
 */

export const CATEGORY_BUCKET_MAP: Record<string, string> = {
  "Behavioral": "Behavioral", "HR Round": "Behavioral", "Skills": "Behavioral", "HR": "Behavioral",
  "Career": "Career", "Preparation": "Career", "Career Advice": "Career",
  "Freshers": "Freshers", "Campus": "Freshers", "Campus Placement": "Freshers",
  "Technical": "Technical", "System Design": "Technical", "FAANG": "Technical",
  "Product": "Technical", "Product Tech": "Technical", "Finance & Banking Tech": "Technical",
  "Interview Skills": "Technical", "Role Guides": "Technical",
  "Full Guide": "Company Guides", "Experience": "Company Guides", "Comparison": "Company Guides",
  "Company Guides": "Company Guides",
  "Strategy": "Strategy", "Salary Guide": "Strategy", "Leadership": "Strategy", "Industry Insights": "Strategy",
  "Interview Tips": "Career",
};

export const CATEGORY_BUCKETS = ["Company Guides", "Freshers", "Behavioral", "Technical", "Career", "Strategy"];

export function categoryBucket(rawCategory: string): string {
  return CATEGORY_BUCKET_MAP[rawCategory] ?? rawCategory;
}

export function bucketToSlug(bucket: string): string {
  return bucket.toLowerCase().replace(/\s+/g, "-");
}

const BUCKET_DESCRIPTIONS: Record<string, string> = {
  "Company Guides": "Company-specific interview process breakdowns: rounds, question formats, and what each company's interviewers actually score you on.",
  "Freshers": "Campus placement and entry-level interview prep: aptitude tests, GD topics, HR rounds, and first-job resume and interview basics.",
  "Behavioral": "STAR method answers, leadership and HR round questions, and how to structure behavioral stories that hold up under follow-up questions.",
  "Technical": "Coding, system design, and role-specific technical interview prep across languages, frameworks, and system design topics.",
  "Career": "Salary negotiation, career strategy, and general job-search guidance for the Indian job market.",
  "Strategy": "Salary benchmarks, case study frameworks, and interview strategy guides for product, consulting, and leadership roles.",
};

export function bucketDescription(bucket: string): string {
  return BUCKET_DESCRIPTIONS[bucket] ?? `${bucket} interview preparation guides for Indian candidates.`;
}
