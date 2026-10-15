import type { Candidate } from "@/employer/mockData";
import type { CandidateEvidence } from "@/employer/EmployerDataContext";
import { formatSessionDate } from "./helpers";
import { ItemRequest, type RequestUi } from "./RequestPopover";

export function hasRoleMismatch(evidence: CandidateEvidence | null | undefined): boolean {
  return evidence?.roleFit?.status === "mismatch";
}

export function RoleMismatchNotice({ evidence, candidate, requirementTitle, requestUi }: { evidence: CandidateEvidence; candidate: Candidate; requirementTitle: string; requestUi: RequestUi }) {
  const fit = evidence.roleFit;
  const when = fit?.practicedAt ? formatSessionDate(fit.practicedAt) : "";
  return (
    <div role="note" className="grid max-w-[75ch] gap-2 rounded-xl border border-hx-line bg-hx-soft px-4 py-3.5">
      <p className="m-0 text-[13px] font-semibold text-hx-coal">
        {fit?.practicedFor ? `Practised for ${fit.practicedFor}, not ${requirementTitle}` : `Practised for a different role than ${requirementTitle}`}
      </p>
      <p className="m-0 text-[13px] leading-relaxed text-hx-ink-soft">
        Their graded interviews{when ? ` (latest ${when})` : ""} are for another role, so we do not show them as evidence for this one. The resume and match breakdown still apply.
      </p>
      <div>
        <ItemRequest
          candidate={candidate}
          ui={requestUi}
          label="Ask them to practise this role"
          preset={{ kind: "practice", topic: `Interview practice for ${requirementTitle}`.slice(0, 120) }}
        />
      </div>
    </div>
  );
}
