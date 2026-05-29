/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * BGV-risk credibility callout — resume cross-check flags with per-
 * item dispute affordance.
 * Pure presentation. */

import { useState } from "react";
import { t, f, shadows, radius } from "../tokens";
import type { CredibilitySummary } from "../../_credibilityCallout";

export function CredibilitySection({
  summary,
  onDispute,
}: {
  summary: CredibilitySummary;
  onDispute?: (flag: string) => void;
}) {
  const [disputed, setDisputed] = useState<Set<string>>(() => new Set());
  if (!summary.hasIssues) return null;
  return (
    <section
      id="ir-section-credibility"
      aria-label="Credibility — resume vs transcript"
      style={{
        background: t.errorWash,
        border: `1px solid ${t.error}`,
        borderRadius: radius.card,
        padding: "clamp(14px, 4vw, 20px) clamp(14px, 4vw, 22px)",
        boxShadow: shadows.card,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 24,
            height: 24,
            padding: "0 8px",
            borderRadius: radius.pill,
            background: t.error,
            color: "#fff",
            fontFamily: f.sans,
            fontSize: 12,
            fontWeight: 700,
          }}
          aria-label={`${summary.count} credibility issue${summary.count === 1 ? "" : "s"}`}
        >
          {summary.count}
        </span>
        <h2
          style={{
            margin: 0,
            fontFamily: f.serif,
            fontSize: "clamp(17px, 4.5vw, 20px)",
            lineHeight: 1.25,
            fontWeight: 600,
            color: t.coal,
          }}
        >
          BGV-risk audit — fix before the next interview
        </h2>
      </header>
      <p
        style={{
          margin: 0,
          fontFamily: f.sans,
          fontSize: 13,
          lineHeight: 1.55,
          color: t.coal,
          opacity: 0.85,
        }}
      >
        What you said in the interview drifted from what your resume
        claims. Indian recruiters cross-check these against the
        offer letter, transcript, and degree certificate during
        background verification — each one is an instant-disqualifier
        if it surfaces post-offer.
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {summary.items.map((item) => (
          <li
            key={item.flag}
            style={{
              background: t.white,
              border: `1px solid ${t.errorAccent}`,
              borderRadius: radius.xl,
              padding: "clamp(10px, 3vw, 12px) clamp(11px, 3.5vw, 14px)",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              overflowWrap: "anywhere",
              wordBreak: "break-word",
            }}
          >
            <div
              style={{
                fontFamily: f.sans,
                fontSize: 14,
                fontWeight: 600,
                color: t.coal,
              }}
            >
              {item.label}
            </div>
            {item.evidence ? (
              <div
                style={{
                  fontFamily: f.mono ?? f.sans,
                  fontSize: 12,
                  color: t.coal,
                  opacity: 0.78,
                  lineHeight: 1.5,
                }}
              >
                {item.evidence.observed}
              </div>
            ) : item.description ? (
              <div
                style={{
                  fontFamily: f.sans,
                  fontSize: 12,
                  color: t.coal,
                  opacity: 0.78,
                  lineHeight: 1.5,
                }}
              >
                {item.description}
              </div>
            ) : null}
            <div
              style={{
                marginTop: 4,
                padding: "8px 10px",
                borderRadius: radius.tile,
                background: t.successWash,
                fontFamily: f.sans,
                fontSize: 12,
                color: t.success,
                lineHeight: 1.5,
              }}
            >
              <strong style={{ fontWeight: 600 }}>Fix:</strong> {item.action}
            </div>
            {onDispute && (
              <div
                style={{
                  marginTop: 2,
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  disabled={disputed.has(item.flag)}
                  onClick={() => {
                    if (disputed.has(item.flag)) return;
                    setDisputed((prev) => {
                      const next = new Set(prev);
                      next.add(item.flag);
                      return next;
                    });
                    onDispute(item.flag);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: "4px 6px",
                    fontFamily: f.sans,
                    fontSize: 11,
                    color: disputed.has(item.flag) ? t.success : t.coal,
                    opacity: disputed.has(item.flag) ? 0.7 : 0.55,
                    cursor: disputed.has(item.flag) ? "default" : "pointer",
                    textDecoration: disputed.has(item.flag) ? "none" : "underline",
                  }}
                  aria-label={
                    disputed.has(item.flag)
                      ? "Thanks — feedback recorded"
                      : "Report that this flag doesn't apply to you"
                  }
                >
                  {disputed.has(item.flag)
                    ? "✓ Thanks — feedback recorded"
                    : "Doesn't apply to me?"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
