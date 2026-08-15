/* Post-session product star rating — plain 1-5 stars, once per session.
 * Distinct from TestimonialNudge (share prompt) and the AI-accuracy
 * feedback buttons in FooterSection — this rates HireStepX itself, and
 * is the only signal that feeds the schema.org aggregateRating on
 * /pricing (server-handlers/_product-rating-helpers.ts reads
 * product_ratings once enough responses exist). Fire-and-forget submit:
 * the optimistic UI is the source of truth client-side. */

import { useState, type CSSProperties } from "react";
import { t, f } from "../tokens";
import { captureClientEvent } from "../../posthogClient";

const starButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 4,
  fontSize: 26,
  lineHeight: 1,
  color: t.line,
};

export function ProductRating({ sessionId }: { sessionId: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!sessionId) return null;

  const submit = (value: number) => {
    if (submitted) return;
    setRating(value);
    setSubmitted(true);
    captureClientEvent("product_rating_submitted", { sessionId, rating: value });
    void (async () => {
      try {
        const { apiFetch } = await import("../../apiClient");
        await apiFetch("/api/product-rating", { sessionId, rating: value });
      } catch {
        /* Soft-fail — the optimistic UI already reflects the submission. */
      }
    })();
  };

  return (
    <div
      role="group"
      aria-label="Rate HireStepX"
      style={{
        border: `1px solid ${t.line}`,
        borderRadius: 14,
        padding: "18px 24px",
        background: t.cream,
        marginTop: 4,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <p style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: 0 }}>
        {submitted ? "Thanks for the rating!" : "How would you rate HireStepX so far?"}
      </p>
      <div style={{ display: "flex", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => {
          const active = (hovered ?? rating ?? 0) >= star;
          return (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              disabled={submitted}
              onClick={() => submit(star)}
              onMouseEnter={() => !submitted && setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              style={{
                ...starButtonStyle,
                color: active ? t.copper : t.line,
                cursor: submitted ? "default" : "pointer",
              }}
            >
              ★
            </button>
          );
        })}
      </div>
    </div>
  );
}
