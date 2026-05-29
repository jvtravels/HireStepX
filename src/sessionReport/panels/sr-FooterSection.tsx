/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Thumbs feedback + reason tags + trust/usefulness 2-question polls.
 * Pure presentation. */

import { useState } from "react";
import { t, f } from "../tokens";

export function FooterSection({
  onTrustAnswer,
  onUsefulAnswer,
}: {
  onTrustAnswer?: (value: "yes" | "no") => void;
  onUsefulAnswer?: (value: "yes" | "no") => void;
}) {
  const [thumb, setThumb] = useState<"up" | "down" | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [trust, setTrust] = useState<"yes" | "no" | null>(null);
  const [useful, setUseful] = useState<"yes" | "no" | null>(null);
  const reasons = thumb === "down"
    ? ["Score felt too harsh", "Score felt too generous", "Feedback was vague", "Wrong about my answer"]
    : ["The score felt fair", "Coaching was specific", "I'll try the retry CTA"];
  return (
    <footer
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "8px 4px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.copper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          Your data is private and secure.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
          Was this report helpful?
          <button
            type="button"
            className={`ir-thumb-btn${thumb === "up" ? " active" : ""}`}
            aria-label="Helpful"
            aria-pressed={thumb === "up"}
            onClick={() => { setThumb(thumb === "up" ? null : "up"); setReason(null); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </button>
          <button
            type="button"
            className={`ir-thumb-btn${thumb === "down" ? " active" : ""}`}
            aria-label="Not helpful"
            aria-pressed={thumb === "down"}
            onClick={() => { setThumb(thumb === "down" ? null : "down"); setReason(null); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
            </svg>
          </button>
        </div>
      </div>
      {thumb && (
        <div
          className="ir-feedback-row"
          role="group"
          aria-label="What was off?"
          style={{ justifyContent: "flex-end", paddingTop: 4 }}
        >
          <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
            {thumb === "down" ? "What was off?" : "What worked?"}
          </span>
          {reasons.map((r) => (
            <button
              key={r}
              type="button"
              className={`ir-feedback-tag${reason === r ? " active" : ""}`}
              aria-pressed={reason === r}
              onClick={() => setReason(reason === r ? null : r)}
            >
              {r}
            </button>
          ))}
          {reason && (
            <span style={{ fontFamily: f.sans, fontSize: 11, color: t.success, fontWeight: 500 }}>
              ✓ Thanks — recorded
            </span>
          )}
        </div>
      )}
      <div className="ir-poll-row" style={{ paddingTop: 6, justifyContent: "space-between" }}>
        <div className="ir-poll-row">
          <span>Did this score feel fair?</span>
          <button
            type="button"
            className={`ir-poll-yes${trust === "yes" ? " active" : ""}`}
            aria-pressed={trust === "yes"}
            onClick={() => { setTrust("yes"); onTrustAnswer?.("yes"); }}
          >
            Yes
          </button>
          <button
            type="button"
            className={`ir-poll-no${trust === "no" ? " active" : ""}`}
            aria-pressed={trust === "no"}
            onClick={() => { setTrust("no"); onTrustAnswer?.("no"); }}
          >
            No
          </button>
        </div>
        <div className="ir-poll-row">
          <span>Will you act on this feedback?</span>
          <button
            type="button"
            className={`ir-poll-yes${useful === "yes" ? " active" : ""}`}
            aria-pressed={useful === "yes"}
            onClick={() => { setUseful("yes"); onUsefulAnswer?.("yes"); }}
          >
            Yes
          </button>
          <button
            type="button"
            className={`ir-poll-no${useful === "no" ? " active" : ""}`}
            aria-pressed={useful === "no"}
            onClick={() => { setUseful("no"); onUsefulAnswer?.("no"); }}
          >
            No
          </button>
        </div>
      </div>
    </footer>
  );
}
