import { tokens as t, fonts as f } from "@/auth/_tokens";
import type { CandidateStatus } from "@/employer/mockData";
import { CANDIDATE_STATUS_LABEL } from "@/employer/_atoms";
import { PIPELINE_STEPS, NEGATIVE_STATUSES } from "./helpers";

export function HiringProgress({ status }: { status: CandidateStatus }) {
  const isNegative = NEGATIVE_STATUSES.includes(status);
  const currentIndex = isNegative ? -1 : PIPELINE_STEPS.indexOf(status);
  return (
    <div>
      <ol aria-label="Hiring pipeline" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {PIPELINE_STEPS.map((step, i) => {
          const reached = !isNegative && i <= currentIndex;
          const isCurrent = !isNegative && i === currentIndex;
          const isLast = i === PIPELINE_STEPS.length - 1;
          return (
            <li key={step} aria-current={isCurrent ? "step" : undefined} style={{ display: "flex", gap: 10 }}>
              <div aria-hidden="true" style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 10 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: reached ? t.indigo : t.creamSoft,
                    border: `2px solid ${reached ? t.indigo : t.line}`,
                    flexShrink: 0,
                    boxSizing: "border-box",
                  }}
                />
                {!isLast && <span style={{ width: 2, flex: 1, minHeight: 22, background: reached && i < currentIndex ? t.indigo : t.line }} />}
              </div>
              <div style={{ paddingBottom: isLast ? 0 : 20 }}>
                <span style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: isCurrent ? 700 : 500, color: reached ? t.coal : t.neutralInk }}>
                  {CANDIDATE_STATUS_LABEL[step]}
                  <span className="sr-only">{isCurrent ? " (current stage)" : reached ? " (completed)" : " (not reached)"}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {isNegative && (
        <p style={{ display: "flex", gap: 10, alignItems: "center", margin: "4px 0 0" }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: "50%", background: t.error, flexShrink: 0 }} />
          <span style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 700, color: t.errorInk }}>{CANDIDATE_STATUS_LABEL[status]}</span>
        </p>
      )}
    </div>
  );
}
