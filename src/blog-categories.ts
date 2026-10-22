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

/* Longer, category-specific editorial intros for the /blog/category/[category]
 * landing pages. A one-sentence description plus a bare list of links reads
 * as a thin auto-generated tag page; this gives each of the 6 buckets an
 * actual point of view a reader can act on before they pick a post. */
const BUCKET_INTROS: Record<string, string> = {
  "Company Guides":
    "Most candidates prep with the same generic question bank regardless of who's interviewing them, then get caught out when a panel asks something specific to how that company actually works — Amazon's bar for STAR stories tied to a Leadership Principle, TCS's aptitude-heavy first round, a fintech's obsession with reconciliation edge cases. These guides break down what changes company to company: round structure, who's in the room, what a strong answer sounds like there specifically, and what tends to trip people up. Read the guide for the company you're interviewing with before you touch a generic question list.",
  "Freshers":
    "Your first real interview has a different shape than every one after it — aptitude tests and group discussions before you ever meet a technical panel, HR rounds that probe for culture fit more than skill, and a resume with no work history to lean on. These guides cover the parts of campus placement season that experienced-hire content skips: what off-campus and on-campus drives actually test for, how to talk about projects and internships when you don't have a job title yet, and the GD and HR-round patterns that repeat across Indian campus hiring.",
  "Behavioral":
    "The STAR framework is easy to describe and hard to execute under a follow-up question you didn't prepare for. These guides go past \"use STAR\" into the mechanics: how to pick a story that actually has a measurable result, how to keep the Situation short enough that you get to the Action before the interviewer's attention drifts, and how to hold up when someone probes \"what would you do differently\" or \"what if your manager disagreed.\" Most of what separates a passable HR round from a strong one is in the follow-up, not the opening answer.",
  "Technical":
    "Technical rounds fail for two different reasons — not knowing the material, or knowing it but not communicating it the way the interviewer is scoring for. These guides are split by what's actually being tested: coding rounds where the interviewer wants your thought process out loud, system design rounds where breadth of trade-off discussion often matters more than landing on \"the right\" architecture, and role-specific rounds (data, product, finance-tech) where domain vocabulary signals experience faster than a correct answer does.",
  "Career":
    "The interview is one step in a longer negotiation you're having with the Indian job market — what to ask for, when to push back on an offer, and how to read a JD or company signal before you've spent three rounds finding out it wasn't the right fit. These guides cover the parts of the job search that happen around the interview itself: comparing offers on more than base CTC, negotiating without a competing offer in hand, and reading notice-period and bond-clause terms before you sign.",
  "Strategy":
    "Senior and case-style interviews are scored on structure as much as on the answer — a consulting case that rewards a clean framework over a clever-sounding guess, a leadership round that wants to see how you'd actually run a team through a hard trade-off, a salary conversation where the number on offer is only meaningful once you know the market band it sits in. These guides are for candidates past the fundamentals stage: frameworks for case interviews, how to benchmark an offer against real India salary data, and what changes about interviewing once you're being evaluated for judgment, not just competence.",
};

export function bucketIntro(bucket: string): string {
  return BUCKET_INTROS[bucket] ?? bucketDescription(bucket);
}
