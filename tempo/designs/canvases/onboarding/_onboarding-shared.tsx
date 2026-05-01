/* HireStepX — Onboarding / Shared atoms
   Reused across the 3 onboarding screens (Upload · Analyse · Review). */
import React from "react";
import { tokens as t, fonts as f } from "../design-system/_tokens";

export type OnboardingStep = "upload" | "analyse" | "review";

// Aspirational verbs — describes the destination ("Practice"), not just the
// step ("Review"). Keeps the user oriented on outcome, not process.
const STEPS: { id: OnboardingStep; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "analyse", label: "Read" },
  { id: "review", label: "Practice" },
];

/** Inline progress chips — current step highlighted in indigo, completed
    steps in coal-on-cream, upcoming steps faded. Lives in the topbar. */
export function OnboardingStepper({ current }: { current: OnboardingStep }) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <ol
      aria-label="Onboarding progress"
      style={{ display: "flex", alignItems: "center", gap: 8, listStyle: "none", margin: 0, padding: 0 }}
    >
      {STEPS.map((step, i) => {
        const isCurrent = i === currentIdx;
        const isComplete = i < currentIdx;
        return (
          <li key={step.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              aria-current={isCurrent ? "step" : undefined}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: f.mono,
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: isCurrent ? t.indigo : isComplete ? t.coal : t.inkFaint,
                background: isCurrent ? t.indigo100 : "transparent",
                // Upcoming chips need a stronger border than t.line on cream —
                // otherwise they read as floating numbers, not as pills.
                border: `1px solid ${isCurrent ? t.indigo : t.lineStrong}`,
                borderRadius: 999,
                padding: "4px 10px",
                fontWeight: 500,
              }}
            >
              {isComplete ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span aria-hidden="true">{i + 1}</span>
              )}
              {step.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                style={{ width: 14, height: 1, background: i < currentIdx ? t.lineStrong : t.line }}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
