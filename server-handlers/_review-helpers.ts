/* Pure helpers for team candidate reviews (match_reviews). */

export type ReviewRating = 1 | 2 | 3 | 4;

export const RATING_LABEL: Record<ReviewRating, string> = {
  1: "Strong no",
  2: "Lean no",
  3: "Lean yes",
  4: "Strong yes",
};

export const REASON_MAX = 500;

export function asRating(v: unknown): ReviewRating | null {
  return v === 1 || v === 2 || v === 3 || v === 4 ? v : null;
}

export function asReason(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length >= 1 && s.length <= REASON_MAX ? s : null;
}

export interface ReviewView {
  reviewerUserId: string;
  reviewerEmail: string;
  rating: ReviewRating;
  reason: string;
  updatedAt: string;
}

export interface ReviewRow {
  reviewer_user_id: string;
  reviewer_email: string | null;
  rating: number;
  reason: string;
  updated_at: string;
}

export function toReviewView(row: ReviewRow): ReviewView | null {
  const rating = asRating(row.rating);
  if (!rating) return null;
  return {
    reviewerUserId: row.reviewer_user_id,
    reviewerEmail: row.reviewer_email ?? "",
    rating,
    reason: row.reason,
    updatedAt: row.updated_at,
  };
}

export interface ReviewSummary {
  count: number;
  yes: number;
  no: number;
  /** Someone leans yes and someone leans no. */
  disagreement: boolean;
}

export function summarizeReviews(reviews: Array<{ rating: ReviewRating }>): ReviewSummary {
  const yes = reviews.filter((r) => r.rating >= 3).length;
  const no = reviews.length - yes;
  return { count: reviews.length, yes, no, disagreement: yes > 0 && no > 0 };
}

/** The blind rule: teammates' reviews are only returned once the caller has
 *  submitted their own, so nobody anchors on a colleague's verdict. */
export function visibleReviews(all: ReviewView[], callerUserId: string): { mine: ReviewView | null; others: ReviewView[]; revealed: boolean; hiddenCount: number } {
  const mine = all.find((r) => r.reviewerUserId === callerUserId) ?? null;
  const others = all.filter((r) => r.reviewerUserId !== callerUserId);
  if (!mine) return { mine: null, others: [], revealed: false, hiddenCount: others.length };
  return { mine, others, revealed: true, hiddenCount: 0 };
}
