import { Panel, PanelButton } from "@/employer/_panelParts";
import { Badge } from "@/employer/_atoms";
import { REQUEST_KIND_LABEL, REQUEST_STATUS_LABEL, type CandidateRequestDto, type RequestStatus } from "@/employer/_candidateRequestTypes";
import type { CandidateRequestsState } from "./useCandidateRequests";

const STATUS_TONE: Record<RequestStatus, "warning" | "success" | "error" | "neutral"> = {
  pending: "warning",
  fulfilled: "success",
  declined: "error",
  cancelled: "neutral",
};

const FIELD_LABEL: Record<string, string> = { phone: "phone number", email: "email address", linkedin: "LinkedIn profile", portfolio: "portfolio or GitHub" };

function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function describe(r: CandidateRequestDto): string {
  if (r.kind === "contact") return r.fields?.length ? `Contact details: ${r.fields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}` : REQUEST_KIND_LABEL.contact;
  return r.topic ? `${REQUEST_KIND_LABEL[r.kind]}: ${r.topic}` : REQUEST_KIND_LABEL[r.kind];
}

export function RequestsPanel({ state, disabled }: { state: CandidateRequestsState; disabled: boolean }) {
  if (!state.available || state.requests.length === 0) return null;
  return (
    <Panel id="requests-heading" title="Requests to this candidate">
      <ul aria-label="Requests sent to this candidate" className="m-0 flex list-none flex-col p-0">
        {state.requests.map((r) => (
          <li key={r.id} className="grid gap-1 border-b border-hx-line py-3 first:pt-0 last:border-b-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 text-[13px] font-medium text-hx-coal [overflow-wrap:anywhere]">{describe(r)}</span>
              <Badge tone={STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
            </div>
            <p className="m-0 text-[12px] text-hx-ink-soft">Sent {ago(r.createdAt)}{r.resolvedAt ? `, answered ${ago(r.resolvedAt)}` : ""}</p>
            {r.note && <p className="m-0 text-[13px] text-hx-ink-soft [overflow-wrap:anywhere]">You asked: {r.note}</p>}
            {r.responseNote && <p className="m-0 text-[13px] text-hx-coal [overflow-wrap:anywhere]">Candidate replied: {r.responseNote}</p>}
            {r.status === "pending" && !disabled && (
              <div><PanelButton onClick={() => void state.cancel(r.id)}>Cancel request</PanelButton></div>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
