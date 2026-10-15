"use client";

/* Candidate-side inbox for employer requests on one match: share a reply,
   mark a contact-detail request done, or decline. Backed by the
   resolve_request action in /api/candidate-employer-actions. */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { daysAgo } from "./hiringMatchFormat";
import { REQUEST_REPLY_MAX, resolveCandidateRequest } from "./employerActions";
import type { JobRequest } from "./DashboardJobs";

const PLACEHOLDER: Record<JobRequest["kind"], string> = {
  contact: "",
  document: "Describe what you are sharing, or paste a link once they have unlocked your profile.",
  practice: "Tell them when you will retake it, or add context for your earlier answer.",
  clarification: "Write your answer",
};

function RequestRow({ matchId, request, unlocked, onResolved, onError }: {
  matchId: string;
  request: JobRequest;
  unlocked: boolean;
  onResolved: (id: string, resolution: "fulfilled" | "declined") => void;
  onError: (message: string) => void;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<"fulfilled" | "declined" | null>(null);
  const isContact = request.kind === "contact";
  const needsReply = request.kind === "clarification";

  const submit = async (resolution: "fulfilled" | "declined") => {
    setBusy(resolution);
    const res = await resolveCandidateRequest(matchId, request.id, resolution, reply);
    setBusy(null);
    if (res.ok) onResolved(request.id, resolution);
    else onError(res.error);
  };

  return (
    <li className="list-none border-t border-hx-line py-3.5">
      <div className="text-[14px] font-semibold text-hx-coal [overflow-wrap:anywhere]">{request.headline}</div>
      <div className="mt-0.5 text-[12px] text-hx-ink-soft">Asked {daysAgo(request.createdAt)}</div>
      {request.note && (
        <p className="m-0 mt-2 text-[13.5px] leading-normal whitespace-pre-line text-hx-coal [overflow-wrap:anywhere]">{request.note}</p>
      )}
      {isContact ? (
        <p className="m-0 mt-2 text-[13px] leading-normal text-hx-ink-soft">
          Add these to your <Link href="/resume" className="text-hx-coal underline">resume</Link>, then mark this done. Employers only see them once they unlock your profile.
        </p>
      ) : (
        <>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, REQUEST_REPLY_MAX))}
            placeholder={PLACEHOLDER[request.kind]}
            aria-label={`Your reply to: ${request.headline}`}
            rows={3}
            className="mt-2.5"
          />
          {!unlocked && (
            <p className="m-0 mt-1.5 text-[12px] text-hx-ink-soft">
              Links and contact details can be shared once this employer unlocks your profile.
            </p>
          )}
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy !== null || (needsReply && !reply.trim())} onClick={() => void submit("fulfilled")}>
          {busy === "fulfilled" ? "Saving…" : isContact ? "Mark done" : "Send reply"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void submit("declined")}>
          {busy === "declined" ? "Saving…" : "Decline"}
        </Button>
      </div>
    </li>
  );
}

export default function CandidateRequestsCard({ matchId, requests, unlocked, onResolved, onError, style }: {
  matchId: string;
  requests: JobRequest[];
  unlocked: boolean;
  onResolved: (id: string, resolution: "fulfilled" | "declined") => void;
  onError: (message: string) => void;
  style?: React.CSSProperties;
}) {
  if (requests.length === 0) return null;
  return (
    <section aria-labelledby="job-requests-heading" style={style}>
      <h2 id="job-requests-heading" className="m-0 text-[15px] font-semibold text-hx-coal">
        Requests from this employer
      </h2>
      <p className="mt-1 mb-1.5 text-[13px] leading-normal text-hx-ink-soft">
        Sharing more evidence can strengthen your profile. You can decline anything you would rather not provide.
      </p>
      <ul className="m-0 p-0">
        {requests.map((r) => (
          <RequestRow key={r.id} matchId={matchId} request={r} unlocked={unlocked} onResolved={onResolved} onError={onError} />
        ))}
      </ul>
    </section>
  );
}
