"use client";

/* Candidate-side inbox for employer requests on one match: share a reply,
   mark a contact-detail request done, or decline. Backed by the
   resolve_request action in /api/candidate-employer-actions. */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tokens as t, fonts as f } from "./auth/_tokens";
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
    <li style={{ listStyle: "none", padding: "14px 0", borderTop: `1px solid ${t.line}` }}>
      <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, overflowWrap: "anywhere" }}>{request.headline}</div>
      <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginTop: 2 }}>Asked {daysAgo(request.createdAt)}</div>
      {request.note && (
        <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, margin: "8px 0 0", lineHeight: 1.5, overflowWrap: "anywhere", whiteSpace: "pre-line" }}>{request.note}</p>
      )}
      {isContact ? (
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "8px 0 0", lineHeight: 1.5 }}>
          Add these to your <Link href="/resume" style={{ color: t.coal, textDecoration: "underline" }}>resume</Link>, then mark this done. Employers only see them once they unlock your profile.
        </p>
      ) : (
        <>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value.slice(0, REQUEST_REPLY_MAX))}
            placeholder={PLACEHOLDER[request.kind]}
            aria-label={`Your reply to: ${request.headline}`}
            rows={3}
            style={{ marginTop: 10 }}
          />
          {!unlocked && (
            <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, margin: "6px 0 0" }}>
              Links and contact details can be shared once this employer unlocks your profile.
            </p>
          )}
        </>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
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
      <h2 id="job-requests-heading" style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: 0 }}>
        Requests from this employer
      </h2>
      <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "4px 0 6px", lineHeight: 1.5 }}>
        Sharing more evidence can strengthen your profile. You can decline anything you would rather not provide.
      </p>
      <ul style={{ margin: 0, padding: 0 }}>
        {requests.map((r) => (
          <RequestRow key={r.id} matchId={matchId} request={r} unlocked={unlocked} onResolved={onResolved} onError={onError} />
        ))}
      </ul>
    </section>
  );
}
