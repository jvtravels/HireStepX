/* Next session: the one thing to work on, how far the Hire band is, and a
 * link into setup. Resume fixes follow when the AI resume analysis has any.
 * Pure presentation. */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t, f, size } from "../tokens";
import { ReportCardShell, CalloutCard } from "./_primitives";

type Plan = { sessions: number; weeks: number; targetBand: string };

function planLine(plan: Plan): string {
  const s = plan.sessions === 1 ? "session" : "sessions";
  const w = plan.weeks === 1 ? "week" : "weeks";
  return `About ${plan.sessions} ${s} to reach the ${plan.targetBand} band, around ${plan.weeks} ${w} at 3 sessions a week.`;
}

export function NextStepsSection({
  plan,
  focusFirst,
  practiceHref,
  resumeImprovements,
}: {
  plan?: Plan;
  /** The top improvement from this session. */
  focusFirst?: string;
  /** Setup link prefilled with this session's type, role and company. */
  practiceHref?: string;
  /** Resume polish bullets from the AI analysis. Max 3. */
  resumeImprovements?: string[];
}) {
  const hasResume = !!resumeImprovements && resumeImprovements.length > 0;
  if (!plan && !focusFirst && !practiceHref && !hasResume) return null;

  return (
    <ReportCardShell id="ir-section-next" ariaLabelledBy="ir-next-heading">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: 1, maxWidth: "65ch" }}>
          <h2 id="ir-next-heading" style={{ fontFamily: f.sans, fontSize: size.xl, fontWeight: 600, color: t.coal, margin: "0 0 12px", letterSpacing: "-0.01em" }}>
            Next session
          </h2>
          {focusFirst && (
            <p style={{ fontFamily: f.sans, fontSize: size.base, color: t.coal, margin: "0 0 8px", lineHeight: 1.5 }}>
              <span style={{ color: t.inkSoft }}>Focus first: </span>
              {focusFirst}
            </p>
          )}
          {plan && (
            <p style={{ fontFamily: f.sans, fontSize: size.base, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
              {planLine(plan)}
            </p>
          )}
        </div>
        {practiceHref && (
          <Button asChild size="lg" className="shrink-0">
            <Link href={practiceHref}>Practise again</Link>
          </Button>
        )}
      </div>
      {hasResume && (
        <div style={{ marginTop: 20 }}>
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
