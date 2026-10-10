import { useState } from "react";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Button } from "@/components/ui/button";
import type { Candidate } from "@/employer/mockData";
import { CandidateStatusChip, EmployerIcon, OutlineCta, Pill, PrimaryCta, ScoreChip } from "@/employer/_atoms";
import { MaskedIdentity } from "@/employer/_atoms2";
import { canInviteToInterview } from "@/employer/InterviewInviteDialog";
import { readCandidateResponse } from "@/employer/_candidateFields";
import { ContactBox, LinkIcon, MailIcon, Muted, PhoneIcon, UnlockLink } from "./atoms";
import { InlineNotice } from "./Notices";
import { initials, maskedName } from "./helpers";

function ResponsePill({ candidate, declined }: { candidate: Candidate; declined: boolean }) {
  const response = declined ? "declined" : readCandidateResponse(candidate);
  if (response === null) return null;
  if (response === "interested") return <Pill tone="success"><EmployerIcon.Check />Candidate is interested</Pill>;
  if (response === "declined") return <Pill tone="error"><EmployerIcon.Alert />Declined contact</Pill>;
  return <Pill tone="neutral">No response yet</Pill>;
}

export function CandidateHeader({
  candidate,
  phone,
  suspended,
  declined,
  shortlistHref,
  onInvite,
  onReject,
}: {
  candidate: Candidate;
  phone: boolean;
  suspended: boolean;
  declined: boolean;
  shortlistHref: string;
  onInvite: () => void;
  onReject: () => void;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const resume = candidate.resume;
  const displayName = maskedName(candidate);
  const canInvite = canInviteToInterview(candidate.candidateStatus);
  const canReject = !["hired", "rejected", "not_a_fit"].includes(candidate.candidateStatus);
  const inviteBlocked = suspended || declined;
  const blockedReason = suspended
    ? "Actions are unavailable while your account is suspended."
    : declined
      ? "Invite is disabled because this candidate declined contact."
      : null;

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div
        aria-hidden="true"
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: candidate.unlocked ? t.indigo100 : t.creamSoft,
          color: t.indigoDeep,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: f.sans,
          fontSize: 18,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {candidate.unlocked ? initials(displayName) : <EmployerIcon.Lock />}
      </div>

      <div style={{ minWidth: 0, flex: phone ? "1 1 calc(100% - 72px)" : 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <MaskedIdentity as="h1" name={displayName} masked={!candidate.unlocked} nameStyle={{ fontSize: 22 }} />
          <Pill tone="indigo">{candidate.targetRole}</Pill>
          <CandidateStatusChip status={candidate.candidateStatus} />
          <ResponsePill candidate={candidate} declined={declined} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap", fontFamily: f.sans, fontSize: 13, color: t.neutralInk }}>
          <ScoreChip score={candidate.matchScore} label="Match score for this requirement" />
          <span>match score</span>
          {candidate.matchBreakdown && (
            <Button
              type="button"
              variant="link"
              aria-expanded={showBreakdown}
              onClick={() => setShowBreakdown((v) => !v)}
              className="pointer-coarse:h-11"
              style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 600, padding: 0, height: "auto", textDecoration: "underline" }}
            >
              {showBreakdown ? "Hide why" : "Why this score?"}
            </Button>
          )}
          <span aria-hidden="true">·</span>
          <span>{candidate.city}</span>
          <span aria-hidden="true">·</span>
          <span>Last active {candidate.lastActiveDaysAgo < 0 ? "unknown" : `${candidate.lastActiveDaysAgo}d ago`}</span>
        </div>

        {showBreakdown && candidate.matchBreakdown && (
          <ul style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "8px 0 0", padding: 0, listStyle: "none", fontFamily: f.sans, fontSize: 12.5, color: t.neutralInk }}>
            <li>Role match: <strong style={{ color: t.coal }}>{candidate.matchBreakdown.roleMatch}%</strong></li>
            <li>Skill match: <strong style={{ color: t.coal }}>{candidate.matchBreakdown.skillMatch}%</strong></li>
            <li>Location match: <strong style={{ color: t.coal }}>{candidate.matchBreakdown.locationMatch}%</strong></li>
          </ul>
        )}

        {resume?.headline && <div style={{ fontFamily: f.sans, fontSize: 13, color: t.neutralInk, marginTop: 8 }}>{resume.headline}</div>}

        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {candidate.unlocked ? (
            <>
              {candidate.contact?.phone && <ContactBox icon={<PhoneIcon />} label="Phone">{candidate.contact.phone}</ContactBox>}
              {candidate.contact?.email && <ContactBox icon={<MailIcon />} label="Email">{candidate.contact.email}</ContactBox>}
              {resume?.linkedin && (
                <ContactBox icon={<LinkIcon />} label="LinkedIn">
                  <a href={`https://${resume.linkedin.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                    {resume.linkedin}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </ContactBox>
              )}
            </>
          ) : (
            <InlineNotice tone="neutral" title="Contact details are locked" action={<UnlockLink href={shortlistHref}>Unlock from the shortlist</UnlockLink>}>
              Name, phone, email and links stay hidden until you unlock this candidate.
            </InlineNotice>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, width: phone ? "100%" : undefined, maxWidth: phone ? undefined : 220 }}>
        <div style={{ display: "flex", flexDirection: phone ? "row" : "column", flexWrap: "wrap", gap: 8 }}>
          {canInvite && (
            <PrimaryCta size="sm" onClick={onInvite} disabled={inviteBlocked}>
              Send Interview Invite
            </PrimaryCta>
          )}
          {canReject && (
            <OutlineCta size="sm" onClick={onReject} disabled={suspended}>
              Reject Candidate
            </OutlineCta>
          )}
        </div>
        {blockedReason && canInvite && <Muted>{blockedReason}</Muted>}
        {suspended && !canInvite && canReject && <Muted>{blockedReason}</Muted>}
      </div>
    </div>
  );
}
