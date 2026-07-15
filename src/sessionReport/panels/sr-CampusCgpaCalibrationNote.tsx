/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * Tier-aware CGPA calibration note for campus-placement sessions.
 * Pure presentation. */

import { t, shadows, radius } from "../tokens";

export function CampusCgpaCalibrationNote({
  meta,
}: {
  meta: {
    companyTier: string;
    collegeTier: string;
    baseCgpaCutoff: number;
    adjustedCgpaCutoff: number;
    statedCgpa: number | null;
    targetCompany?: string | null;
    archetype?: string;
    archetypeLabel?: string;
  };
}) {
  const { companyTier, collegeTier, baseCgpaCutoff, adjustedCgpaCutoff, statedCgpa, targetCompany, archetypeLabel } = meta;
  const adjustmentDelta = adjustedCgpaCutoff - baseCgpaCutoff;
  const tierLabel = (() => {
    if (companyTier === "product-global") return "Tier-1 global product";
    if (companyTier === "product-india") return "Indian product";
    if (companyTier === "service") return "Service-tier (TCS / Infosys / Wipro)";
    return "Company";
  })();
  const collegeLabel = collegeTier === "tier-1" ? "tier-1"
    : collegeTier === "tier-2" ? "tier-2"
    : null;
  const adjustmentText = adjustmentDelta !== 0 && collegeLabel
    ? `, ${collegeLabel} adjusted ${adjustedCgpaCutoff.toFixed(1)}`
    : "";
  const companyName = targetCompany && targetCompany.trim() ? targetCompany.trim() : tierLabel;
  const passed = statedCgpa !== null && statedCgpa >= adjustedCgpaCutoff;
  return (
    <section
      id="ir-section-cgpa-calibration"
      aria-label="CGPA calibration"
      style={{
        background: t.successWash,
        border: `1px solid ${t.success}`,
        borderRadius: radius.card,
        padding: "clamp(12px, 3.5vw, 16px) clamp(14px, 4vw, 20px)",
        boxShadow: shadows.card,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <header style={{ fontSize: 13, fontWeight: 600, color: t.success, letterSpacing: 0.3, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span>CGPA calibration</span>
        {archetypeLabel && archetypeLabel !== "Generic campus" && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: t.success,
              background: t.successTint,
              borderRadius: radius.pill,
              padding: "2px 8px",
              letterSpacing: 0.2,
              textTransform: "none",
            }}
            title="Campus archetype — drives the CGPA bar, DSA expectation, and bond/location-flex rubric"
          >
            {archetypeLabel}
          </span>
        )}
      </header>
      <p style={{ fontSize: 15, color: t.coal, lineHeight: 1.5, margin: 0 }}>
        {companyName} baseline {baseCgpaCutoff.toFixed(1)} CGPA{adjustmentText}
        {statedCgpa !== null && (
          <>
            {": you're at "}
            <strong style={{ color: passed ? t.success : t.error }}>
              {statedCgpa.toFixed(1)} {passed ? "✓" : "✗"}
            </strong>
          </>
        )}
        .
      </p>
      <p style={{ fontSize: 12, color: t.inkSoft, lineHeight: 1.5, margin: 0 }}>
        {collegeLabel === "tier-1"
          ? "IIT / NIT / BITS / IIIT / IISc receive a 0.5 point adjustment reflecting their harder grading curves."
          : "Your score is benchmarked against the company's standard fresher baseline. IIT / NIT / BITS / IIIT graduates receive a 0.5 adjustment for harder grading curves."}
      </p>
    </section>
  );
}
