import { describe, it, expect } from "vitest";
import { asRating, asReason, summarizeReviews, visibleReviews, toReviewView, type ReviewView } from "../../server-handlers/_review-helpers";

const rv = (id: string, rating: 1 | 2 | 3 | 4): ReviewView => ({ reviewerUserId: id, reviewerEmail: `${id}@x.co`, rating, reason: "r", updatedAt: "2026-10-29T00:00:00Z" });

describe("review helpers", () => {
  it("accepts only ratings 1-4", () => {
    expect(asRating(3)).toBe(3);
    for (const bad of [0, 5, 2.5, "3", null, undefined]) expect(asRating(bad)).toBeNull();
  });
  it("trims and bounds the reason", () => {
    expect(asReason("  ok  ")).toBe("ok");
    expect(asReason("   ")).toBeNull();
    expect(asReason("x".repeat(501))).toBeNull();
    expect(asReason("x".repeat(500))).not.toBeNull();
    expect(asReason(5)).toBeNull();
  });
  it("detects disagreement", () => {
    expect(summarizeReviews([{ rating: 4 }, { rating: 1 }])).toEqual({ count: 2, yes: 1, no: 1, disagreement: true });
    expect(summarizeReviews([{ rating: 4 }, { rating: 3 }]).disagreement).toBe(false);
    expect(summarizeReviews([]).disagreement).toBe(false);
  });
  it("hides teammates' reviews until the caller has reviewed", () => {
    const all = [rv("a", 4), rv("b", 1)];
    expect(visibleReviews(all, "c")).toEqual({ mine: null, others: [], revealed: false, hiddenCount: 2 });
    const v = visibleReviews(all, "a");
    expect(v.revealed).toBe(true);
    expect(v.others.map((r) => r.reviewerUserId)).toEqual(["b"]);
  });
  it("drops rows with an out-of-range rating", () => {
    expect(toReviewView({ reviewer_user_id: "a", reviewer_email: null, rating: 9, reason: "r", updated_at: "t" })).toBeNull();
  });
});
