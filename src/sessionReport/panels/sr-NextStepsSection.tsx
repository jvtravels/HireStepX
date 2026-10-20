/* Next steps: the readiness sentence and resume fixes that match this
 * interview pattern. Renders nothing when neither is present.
 * Pure presentation. */

import { t, f, size } from "../tokens";
import { ReportCardShell, CalloutCard } from "./_primitives";

export function NextStepsSection({
  readinessSentence,
  resumeImprovements,
}: {
  readinessSentence?: string;
  /** Resume polish bullets from the AI analysis. Max 3. */
  resumeImprovements?: string[];
}) {
  const hasResume = !!resumeImprovements && resumeImprovements.length > 0;
  if (!readinessSentence && !hasResume) return null;

  return (
    <ReportCardShell id="ir-section-next" ariaLabelledBy="ir-next-heading">
      <h2 id="ir-next-heading" style={{ fontFamily: f.sans, fontSize: size.xl, fontWeight: 600, color: t.coal, margin: "0 0 4px", letterSpacing: "-0.01em" }}>
        Next steps
      </h2>
      {readinessSentence && (
        <p style={{ fontFamily: f.sans, fontSize: size.base, color: t.inkSoft, margin: "0 0 16px", lineHeight: 1.5 }}>
          {readinessSentence}
        </p>
      )}
      {resumeImprovements && resumeImprovements.length > 0 && (
        <div style={{ margin: "16px 0" }}>
          <CalloutCard eyebrow="Resume fixes that match this interview pattern">
            <ul style={{ margin: 0, padding: "0 0 0 16px" }}>
              {resumeImprovements.map((tip, i) => (
                <li key={i} style={{ marginBottom: i < resumeImprovements.length - 1 ? 4 : 0 }}>
                  {tip}
                </li>
              ))}
            </ul>
          </CalloutCard>
        </div>
      )}
    </ReportCardShell>
  );
}
