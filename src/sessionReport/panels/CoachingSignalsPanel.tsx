/* Month 2 PR-6 (PDF #28) — Coaching Signals panel.
 *
 * Surfaces the family-level guardrail flags collected by the planner
 * during the session (see _kernel-move-picker.checkFamilyGuardrails).
 * Renders only when at least one flag fired — same honest-empty-state
 * pattern as the other panels in this report.
 *
 * Each flag has a human-language label + a "what this felt like"
 * explanation written for non-technical candidates. The numeric count
 * is shown so the candidate can spot patterns ("the recruiter stalled
 * three times" reads differently from "the recruiter stalled once"). */

import { PanelShell, EventRow, EyebrowLabel, t, f } from "./_primitives";

interface Props {
  flagSummary?: Record<string, number>;
}

/* Human-readable mapping. Add a new row here when a new guardrail
 * flag is introduced in checkFamilyGuardrails. Unknown flags fall
 * through to a generic label so adding a flag without updating this
 * file doesn't hide it from the report. */
const FLAG_COPY: Record<string, { label: string; meaning: string }> = {
  "pressure-repeat": {
    label: "Two pressure moves in a row",
    meaning:
      "The recruiter used a coercive tactic (exploding offer, fake competing candidate, retention threat) two turns in a row. This is the manipulative pattern — slow down and don't react to the second one.",
  },
  "stall-cascade": {
    label: "Two stalling tactics in a row",
    meaning:
      'The recruiter chained two delays ("let me check with my manager… let me check with the panel"). They are buying time. Set a deadline for the next response.',
  },
  "anchor-double-set": {
    label: "They anchored twice without listening",
    meaning:
      "The recruiter put a number on the table, then put another number on the table without waiting for your reaction. You can ignore the second anchor — respond to the first one.",
  },
};

function labelFor(flag: string): { label: string; meaning: string } {
  return (
    FLAG_COPY[flag] ?? {
      label: flag,
      meaning: "A pattern in the recruiter's moves the system flagged for review.",
    }
  );
}

export function CoachingSignalsPanel({ flagSummary }: Props) {
  if (!flagSummary) return null;
  const entries = Object.entries(flagSummary).filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  /* Highest count first so the most-repeated pattern leads. */
  entries.sort((a, b) => b[1] - a[1]);

  return (
    <PanelShell
      index="07"
      title="Recruiter patterns the system flagged"
      subtitle="These are recurring move-shapes the negotiation engine watched for during your call. Each one is a tactic to be aware of — not necessarily a problem you caused."
    >
      <EyebrowLabel>FLAGGED PATTERNS · {entries.length}</EyebrowLabel>
      <div className="nfr-vstack-md">
        {entries.map(([flag, count]) => {
          const { label, meaning } = labelFor(flag);
          return (
            <EventRow
              key={flag}
              tone="neutral"
              leading={
                <div
                  style={{
                    fontFamily: f.mono,
                    fontSize: 14,
                    fontWeight: 700,
                    color: t.coal,
                    minWidth: 32,
                  }}
                >
                  ×{count}
                </div>
              }
              primary={
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: t.coal,
                  }}
                >
                  {label}
                </div>
              }
              secondary={<span style={{ fontSize: 11 }}>{meaning}</span>}
            />
          );
        })}
      </div>
    </PanelShell>
  );
}
