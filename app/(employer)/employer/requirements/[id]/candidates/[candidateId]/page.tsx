"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEmployerData, Requirement, CandidateEvidence } from "@/employer/EmployerDataContext";
import type { CandidateStatus } from "@/employer/mockData";
import { useToast } from "@/Toast";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CandidateStatusChip,
  CANDIDATE_STATUS_LABEL,
  Card,
  Divider,
  EmployerIcon,
  HelpText,
  OutlineCta,
  Pill,
  PrimaryCta,
  ScoreChip,
  SkillTag,
} from "@/employer/_atoms";

/** Ordered happy-path pipeline — mirrors CANDIDATE_STATUS_LABEL's keys minus
 *  the three terminal-negative outcomes, which render as a separate marker
 *  instead of a step (there's no "further along" for a rejection). */
const PIPELINE_STEPS: CandidateStatus[] = ["shortlisted", "interview_invited", "interviewing", "hired"];
const NEGATIVE_STATUSES: CandidateStatus[] = ["rejected", "not_a_fit", "no_response"];

function HiringProgress({ status }: { status: CandidateStatus }) {
  const isNegative = NEGATIVE_STATUSES.includes(status);
  const currentIndex = isNegative ? -1 : PIPELINE_STEPS.indexOf(status);
  return (
    <div>
      {PIPELINE_STEPS.map((step, i) => {
        const reached = !isNegative && i <= currentIndex;
        const isCurrent = !isNegative && i === currentIndex;
        const isLast = i === PIPELINE_STEPS.length - 1;
        return (
          <div key={step} style={{ display: "flex", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 10 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: reached ? t.indigo : t.creamSoft,
                  border: `2px solid ${isCurrent ? t.indigo : reached ? t.indigo : t.line}`,
                  flexShrink: 0,
                  boxSizing: "border-box",
                }}
              />
              {!isLast && <span style={{ width: 2, flex: 1, minHeight: 22, background: reached && i < currentIndex ? t.indigo : t.line }} />}
            </div>
            <div style={{ paddingBottom: isLast ? 0 : 20 }}>
              <span style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: isCurrent ? 700 : 500, color: reached ? t.coal : t.inkFaint }}>
                {CANDIDATE_STATUS_LABEL[step]}
              </span>
            </div>
          </div>
        );
      })}
      {isNegative && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.error, flexShrink: 0 }} />
          <span style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 700, color: t.error }}>{CANDIDATE_STATUS_LABEL[status]}</span>
        </div>
      )}
    </div>
  );
}

function EvidencePanel({ evidence, loading }: { evidence: CandidateEvidence | null; loading: boolean }) {
  if (loading) {
    return <HelpText>Loading practice-session evidence…</HelpText>;
  }
  if (!evidence || evidence.skills.length === 0) {
    return <HelpText>No practice session data yet.</HelpText>;
  }
  const readinessLabel: Record<string, string> = { strongHire: "Strong hire readiness", hire: "Hire readiness", leanHire: "Lean-hire readiness" };
  const readinessTone: Record<string, "success" | "indigo" | "neutral"> = { strongHire: "success", hire: "indigo", leanHire: "neutral" };

  return (
    <div>
      {evidence.sessionDate && (
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginBottom: 14 }}>
          From most recent practice session · {new Date(evidence.sessionDate).toLocaleDateString()}
        </div>
      )}

      {(evidence.readiness || evidence.starCompleteness) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {evidence.readiness && (
            <Pill tone={readinessTone[evidence.readiness.band]}>
              {readinessLabel[evidence.readiness.band]} · {evidence.readiness.confidence} confidence
            </Pill>
          )}
          {evidence.starCompleteness && (
            <Pill tone={evidence.starCompleteness.pct >= 70 ? "success" : evidence.starCompleteness.pct >= 40 ? "neutral" : "indigo"}>
              STAR completeness: {evidence.starCompleteness.pct}%
            </Pill>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {evidence.skills.map((s) => (
          <div key={s.name}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: f.sans, fontSize: 13, color: t.coal, marginBottom: 4 }}>
              <span>{s.name}</span>
              <strong>{Math.round(s.score)}</strong>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: t.line, overflow: "hidden" }}>
              <div
                style={{
                  width: `${Math.max(0, Math.min(100, s.score))}%`,
                  height: "100%",
                  background: s.score >= 70 ? t.success : s.score >= 50 ? t.warning : t.error,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {evidence.quotes.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <SectionTitle>What they said</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {evidence.quotes.map((q, i) => (
              <div
                key={i}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: q.kind === "redFlag" ? t.error + "0d" : t.success + "0d",
                  border: `1px solid ${q.kind === "redFlag" ? t.error + "33" : t.success + "33"}`,
                }}
              >
                <div style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 700, color: q.kind === "redFlag" ? t.error : t.success, marginBottom: 4 }}>
                  {q.kind === "redFlag" ? "Flag" : "Win"} · {q.text}
                </div>
                <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, fontStyle: "italic" }}>
                  &ldquo;{q.quote}&rdquo;
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: t.inkFaint, margin: "0 0 12px" }}>
      {children}
    </h2>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

const PhoneIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.8 21 3 13.2 3 3.6c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1.1L6.6 10.8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const MailIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M3.5 6.5L12 13l8.5-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M10 14a4 4 0 005.7.3l2.6-2.6a4 4 0 00-5.6-5.6L11 7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 10a4 4 0 00-5.7-.3L5.7 12.3a4 4 0 005.6 5.6L13 16.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function ContactBox({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 14px",
        borderRadius: 10,
        border: `1px solid ${t.line}`,
        fontFamily: f.sans,
        fontSize: 13,
        color: t.coal,
        flex: "1 1 180px",
      }}
    >
      <span style={{ color: t.inkFaint, display: "flex" }}>{icon}</span>
      {children}
    </div>
  );
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string; candidateId: string }>();
  const { fetchRequirementDetail, updateCandidateStatus, fetchCandidateEvidence } = useEmployerData();
  const { toast } = useToast();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"about" | "resume" | "evidence">("about");
  const [showBreakdown, setShowBreakdown] = useState(false);

  const [evidence, setEvidence] = useState<CandidateEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [inviteDate, setInviteDate] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchRequirementDetail(params.id);
    setRequirement(r);
    setLoading(false);
  }, [fetchRequirementDetail, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  const candidate = requirement?.candidates.find((c) => c.id === params.candidateId);

  useEffect(() => {
    if (!candidate) return;
    let active = true;
    setEvidenceLoading(true);
    fetchCandidateEvidence(candidate.id).then((e) => {
      if (active) {
        setEvidence(e);
        setEvidenceLoading(false);
      }
    });
    return () => {
      active = false;
    };
    // Depend on candidate?.id, not `candidate` itself — the candidate object
    // is re-derived from `requirement` on every render (including the
    // optimistic status patches below), and re-fetching evidence on those
    // would be wasted network traffic for data that hasn't changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidate?.id, fetchCandidateEvidence]);

  const applyCandidateUpdate = (matchId: string, patch: Partial<Requirement["candidates"][number]>) => {
    setRequirement((prev) =>
      prev ? { ...prev, candidates: prev.candidates.map((c) => (c.id !== matchId ? c : { ...c, ...patch })) } : prev,
    );
  };

  const handleSendInvite = async () => {
    if (!candidate) return;
    const previousStatus = candidate.candidateStatus;
    const previousNote = candidate.candidateStatusNote;
    const previousScheduledAt = candidate.interviewScheduledAt;
    setInviteSubmitting(true);
    applyCandidateUpdate(candidate.id, {
      candidateStatus: "interview_invited",
      candidateStatusNote: inviteNote.trim() || previousNote,
      interviewScheduledAt: inviteDate || previousScheduledAt,
    });
    const ok = await updateCandidateStatus(candidate.id, {
      candidateStatus: "interview_invited",
      note: inviteNote.trim() || undefined,
      interviewScheduledAt: inviteDate || undefined,
    });
    setInviteSubmitting(false);
    if (!ok) {
      applyCandidateUpdate(candidate.id, { candidateStatus: previousStatus, candidateStatusNote: previousNote, interviewScheduledAt: previousScheduledAt });
      toast("Couldn't send the invite — please try again", "error");
      return;
    }
    toast("Interview invite sent", "success");
    setInviteOpen(false);
    setInviteNote("");
    setInviteDate("");
  };

  const handleReject = async () => {
    if (!candidate) return;
    const previousStatus = candidate.candidateStatus;
    const previousNote = candidate.candidateStatusNote;
    setRejectSubmitting(true);
    applyCandidateUpdate(candidate.id, { candidateStatus: "rejected", candidateStatusNote: rejectNote.trim() || previousNote });
    const ok = await updateCandidateStatus(candidate.id, { candidateStatus: "rejected", note: rejectNote.trim() || undefined });
    setRejectSubmitting(false);
    if (!ok) {
      applyCandidateUpdate(candidate.id, { candidateStatus: previousStatus, candidateStatusNote: previousNote });
      toast("Couldn't reject the candidate — please try again", "error");
      return;
    }
    toast("Candidate marked as rejected", "success");
    setRejectOpen(false);
    setRejectNote("");
  };

  if (loading) {
    return (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Loading…</p>
      </Card>
    );
  }

  if (!requirement || !candidate) {
    return (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, marginBottom: 16 }}>Candidate not found.</p>
        <Link href={`/employer/requirements/${params.id}`} style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.indigo, textDecoration: "none" }}>
          ← Back to shortlist
        </Link>
      </Card>
    );
  }

  const resume = candidate.resume;
  const displayName = candidate.unlocked ? candidate.name : `Candidate #${candidate.id.slice(0, 6)}`;
  const tabs: Array<{ key: "about" | "resume" | "evidence"; label: string }> = [
    { key: "about", label: "About" },
    { key: "resume", label: "Resume" },
    { key: "evidence", label: "Evidence" },
  ];
  const canInvite = candidate.candidateStatus === "shortlisted";
  const canReject = !["hired", "rejected", "not_a_fit"].includes(candidate.candidateStatus);

  return (
    <div>
      <Link
        href={`/employer/requirements/${requirement.id}`}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: t.inkSoft, textDecoration: "none", marginBottom: 16 }}
      >
        <span style={{ display: "inline-block", transform: "rotate(180deg)" }}>
          <EmployerIcon.Arrow />
        </span>
        {requirement.title}
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "stretch", marginBottom: 0 }}>
        <Card>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: t.indigo100,
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
              {candidate.unlocked ? initials(displayName) : "?"}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontFamily: f.sans, fontSize: 24, color: t.coal, margin: 0 }}>{displayName}</h1>
                <Pill tone="indigo">{candidate.targetRole}</Pill>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <ScoreChip score={candidate.matchScore} />
                <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>match score</span>
                {candidate.matchBreakdown && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setShowBreakdown((v) => !v)}
                    style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 600, padding: 0, height: "auto", textDecoration: "underline" }}
                  >
                    {showBreakdown ? "Hide why" : "Why this score?"}
                  </Button>
                )}
                <span style={{ color: t.line }}>·</span>
                <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{candidate.city}</span>
              </div>
              {showBreakdown && candidate.matchBreakdown && (
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 8, fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>
                  <span>Role match: <strong style={{ color: t.coal }}>{candidate.matchBreakdown.roleMatch}%</strong></span>
                  <span>Skill match: <strong style={{ color: t.coal }}>{candidate.matchBreakdown.skillMatch}%</strong></span>
                  <span>Location match: <strong style={{ color: t.coal }}>{candidate.matchBreakdown.locationMatch}%</strong></span>
                </div>
              )}
              {resume?.headline && (
                <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkFaint, marginTop: 8 }}>{resume.headline}</div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {candidate.skills.map((s) => (
                  <SkillTag key={s}>{s}</SkillTag>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
              {[
                resume?.seniorityLevel,
                resume?.yearsExperience != null ? `${resume.yearsExperience} yrs experience` : null,
                `${candidate.sessionsCompleted} practice sessions`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            <Pill tone={candidate.unlocked ? "success" : "neutral"}>{candidate.unlocked ? "Unlocked" : "Locked"}</Pill>
          </div>

          <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint, marginTop: 10 }}>
            Last active {candidate.lastActiveDaysAgo < 0 ? "—" : `${candidate.lastActiveDaysAgo}d ago`}
          </div>

          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {candidate.unlocked ? (
              <>
                {candidate.contact?.phone && <ContactBox icon={<PhoneIcon />}>{candidate.contact.phone}</ContactBox>}
                {candidate.contact?.email && <ContactBox icon={<MailIcon />}>{candidate.contact.email}</ContactBox>}
                {resume?.linkedin && (
                  <ContactBox icon={<LinkIcon />}>
                    <a href={`https://${resume.linkedin.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>
                      {resume.linkedin}
                    </a>
                  </ContactBox>
                )}
              </>
            ) : (
              <HelpText>
                Contact details are locked. <Link href={`/employer/requirements/${requirement.id}`} style={{ color: t.indigo, fontWeight: 600 }}>Unlock from the shortlist</Link> to view.
              </HelpText>
            )}
          </div>
        </Card>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>Hiring status</span>
          <CandidateStatusChip status={candidate.candidateStatus} />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canInvite && (
            <PrimaryCta size="sm" onClick={() => setInviteOpen(true)}>
              Send Interview Invite
            </PrimaryCta>
          )}
          {canReject && (
            <OutlineCta size="sm" onClick={() => setRejectOpen(true)}>
              Reject Candidate
            </OutlineCta>
          )}
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send interview invite</DialogTitle>
            <DialogDescription>Marks {displayName} as invited to interview for {requirement.title}.</DialogDescription>
          </DialogHeader>
          <div style={{ display: "grid", gap: 14, padding: "4px 0" }}>
            <div style={{ display: "grid", gap: 8 }}>
              <Label htmlFor="invite-scheduled-at">Scheduled date (optional)</Label>
              <Input id="invite-scheduled-at" type="date" value={inviteDate} onChange={(e) => setInviteDate(e.target.value)} />
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              <Label htmlFor="invite-note">Note (optional)</Label>
              <Textarea id="invite-note" rows={3} value={inviteNote} onChange={(e) => setInviteNote(e.target.value)} placeholder="Anything you want on record about this invite…" />
            </div>
          </div>
          <DialogFooter>
            <OutlineCta onClick={() => setInviteOpen(false)}>Cancel</OutlineCta>
            <PrimaryCta onClick={handleSendInvite} disabled={inviteSubmitting}>
              {inviteSubmitting ? "Sending…" : "Send invite"}
            </PrimaryCta>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject this candidate?</DialogTitle>
            <DialogDescription>Marks {displayName} as rejected for {requirement.title}. This can't be undone from here.</DialogDescription>
          </DialogHeader>
          <div style={{ display: "grid", gap: 8, padding: "4px 0" }}>
            <Label htmlFor="reject-note">Reason (optional)</Label>
            <Textarea id="reject-note" rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Anything you want on record about this decision…" />
          </div>
          <DialogFooter>
            <OutlineCta onClick={() => setRejectOpen(false)}>Cancel</OutlineCta>
            <Button type="button" variant="destructive" onClick={handleReject} disabled={rejectSubmitting}>
              {rejectSubmitting ? "Rejecting…" : "Reject candidate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${t.line}`, margin: "20px 0 20px" }}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setActiveTab(tb.key)}
            style={{
              padding: "10px 18px",
              border: "none",
              borderRadius: "10px 10px 0 0",
              background: activeTab === tb.key ? t.indigo : "transparent",
              color: activeTab === tb.key ? t.white : t.inkSoft,
              fontFamily: f.sans,
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {activeTab === "about" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, alignItems: "start" }}>
          <Card>
            <SectionTitle>About</SectionTitle>
            {!candidate.unlocked ? (
              <HelpText>This candidate's summary is locked. <Link href={`/employer/requirements/${requirement.id}`} style={{ color: t.indigo, fontWeight: 600 }}>Unlock from the shortlist</Link> to view.</HelpText>
            ) : resume?.summary ? (
              <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.6, margin: 0 }}>{resume.summary}</p>
            ) : (
              <HelpText>No resume summary available for this candidate.</HelpText>
            )}

            {!!resume?.keyAchievements.length && (
              <>
                <Divider />
                <div style={{ marginTop: 14 }}>
                  <SectionTitle>Achievements</SectionTitle>
                  <ul style={{ margin: 0, paddingLeft: 18, fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.7 }}>
                    {resume.keyAchievements.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {!!resume?.education.length && (
              <>
                <Divider />
                <div style={{ marginTop: 14 }}>
                  <SectionTitle>Qualification</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {resume.education.map((ed, i) => (
                      <div key={`${ed.school}-${i}`} style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                        <strong style={{ color: t.coal }}>{ed.degree}</strong>
                        {ed.school ? ` — ${ed.school}` : ""}
                        {ed.year ? ` · ${ed.year}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {(!!resume?.certifications.length || (candidate.unlocked && resume?.linkedin)) && (
              <>
                <Divider />
                <div style={{ marginTop: 14 }}>
                  <SectionTitle>Links</SectionTitle>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {candidate.unlocked && resume?.linkedin && (
                      <a href={`https://${resume.linkedin.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                        <SkillTag>LinkedIn</SkillTag>
                      </a>
                    )}
                    {resume?.certifications.map((c) => (
                      <SkillTag key={c}>{c}</SkillTag>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Card>

          <Card>
            <SectionTitle>Employment history</SectionTitle>
            {resume?.experience.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {resume.experience.map((e, i) => (
                  <div key={`${e.company}-${i}`} style={{ paddingBottom: 14, borderBottom: i < resume.experience.length - 1 ? `1px solid ${t.line}` : "none" }}>
                    <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal }}>{e.title || "Role"}</div>
                    <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 2 }}>{e.company}</div>
                    {e.period && <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginTop: 2 }}>{e.period}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <HelpText>No structured employment history extracted from this resume.</HelpText>
            )}

            {!!resume?.industries.length && (
              <>
                <Divider />
                <div style={{ marginTop: 14 }}>
                  <SectionTitle>Industries</SectionTitle>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {resume.industries.map((i) => (
                      <SkillTag key={i}>{i}</SkillTag>
                    ))}
                  </div>
                </div>
              </>
            )}

            {(resume?.noticePeriod || resume?.currentCtc) && (
              <>
                <Divider />
                <div style={{ marginTop: 14 }}>
                  <SectionTitle>As stated on resume</SectionTitle>
                  <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, display: "flex", flexDirection: "column", gap: 4 }}>
                    {resume?.noticePeriod && <div>Notice period: <strong style={{ color: t.coal }}>{resume.noticePeriod}</strong></div>}
                    {resume?.currentCtc && <div>Current CTC: <strong style={{ color: t.coal }}>{resume.currentCtc}</strong></div>}
                  </div>
                  <HelpText>Self-reported by the candidate's resume text — not independently verified.</HelpText>
                </div>
              </>
            )}
          </Card>

          <Card>
            <SectionTitle>Portfolio &amp; work samples</SectionTitle>
            {!candidate.unlocked ? (
              <HelpText>Portfolio links are locked until this candidate is unlocked.</HelpText>
            ) : candidate.portfolioLinks?.length ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {candidate.portfolioLinks.map((link) => (
                  <a key={link.url} href={link.url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                    <SkillTag>{link.title}</SkillTag>
                  </a>
                ))}
              </div>
            ) : (
              <HelpText>No portfolio or project links on file for this candidate.</HelpText>
            )}
          </Card>
        </div>
      )}

      {activeTab === "about" && (
        <Card style={{ marginTop: 16 }}>
          <SectionTitle>Hiring Progress</SectionTitle>
          <HiringProgress status={candidate.candidateStatus} />
        </Card>
      )}

      {activeTab === "evidence" && (
        <Card>
          <SectionTitle>Evidence</SectionTitle>
          <EvidencePanel evidence={evidence} loading={evidenceLoading} />
        </Card>
      )}

      {activeTab === "resume" && (
        <Card>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", paddingBottom: 16, borderBottom: `1px solid ${t.line}` }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: t.indigo100,
                color: t.indigoDeep,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: f.sans,
                fontSize: 15,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {candidate.unlocked ? initials(displayName) : "?"}
            </div>
            <div>
              <div style={{ fontFamily: f.sans, fontSize: 20, color: t.coal }}>{displayName}</div>
              <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 2 }}>
                {resume?.headline || candidate.targetRole}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {candidate.unlocked && candidate.contact?.email && <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>{candidate.contact.email}</span>}
                {candidate.unlocked && candidate.contact?.phone && <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>{candidate.contact.phone}</span>}
              </div>
            </div>
          </div>

          {candidate.unlocked && resume?.summary && (
            <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.6, margin: "16px 0 0" }}>{resume.summary}</p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, marginTop: 20 }}>
            <div>
              <SectionTitle>Experience</SectionTitle>
              {resume?.experience.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {resume.experience.map((e, i) => (
                    <div key={`${e.company}-${i}`}>
                      <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal }}>{e.title || "Role"}</div>
                      <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 2 }}>
                        {e.company}
                        {e.period ? ` · ${e.period}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <HelpText>No structured experience extracted from this resume.</HelpText>
              )}

              {!!resume?.education.length && (
                <div style={{ marginTop: 20 }}>
                  <SectionTitle>Education</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {resume.education.map((ed, i) => (
                      <div key={`${ed.school}-${i}`} style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                        <strong style={{ color: t.coal }}>{ed.degree}</strong>
                        {ed.school ? ` — ${ed.school}` : ""}
                        {ed.year ? ` · ${ed.year}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              {!!resume?.industries.length && (
                <div style={{ marginBottom: 20 }}>
                  <SectionTitle>Industry knowledge</SectionTitle>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {resume.industries.map((i) => (
                      <SkillTag key={i}>{i}</SkillTag>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <SectionTitle>Tools &amp; skills</SectionTitle>
                {candidate.skills.length ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {candidate.skills.map((s) => (
                      <SkillTag key={s}>{s}</SkillTag>
                    ))}
                  </div>
                ) : (
                  <HelpText>No tools or skills listed on this resume.</HelpText>
                )}
              </div>

              {!!resume?.certifications.length && (
                <div>
                  <SectionTitle>Certifications</SectionTitle>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {resume.certifications.map((c) => (
                      <SkillTag key={c}>{c}</SkillTag>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
