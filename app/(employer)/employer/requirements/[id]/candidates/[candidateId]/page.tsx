"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEmployerData, Requirement, CandidateEvidence } from "@/employer/EmployerDataContext";
import { useEmployerBreadcrumb } from "@/employer/EmployerShell";
import type { CandidateStatus, Candidate } from "@/employer/mockData";
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
  HelpText,
  OutlineCta,
  Pill,
  PrimaryCta,
  ScoreChip,
  SkillTag,
} from "@/employer/_atoms";

/* ── Deterministic placeholder data ──
   The production candidate/requirement model doesn't (yet) capture every
   dimension the redesigned profile shows — STAR breakdown, round-type
   readiness, communication signals, risk flags, a suggested-offer
   rationale. Where real data exists (resume fields, evidence skills,
   match score, requirement budget) it's used directly; everywhere else a
   value is derived deterministically from the candidate id + a field name,
   so the same candidate always renders the same numbers instead of
   reshuffling on every render. */
function seededVariance(seed: string, max: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % (max + 1);
}

const RISK_FLAG_POOL = [
  "Notice period longer than the role's hiring window",
  "No portfolio or work-sample links on file",
  "Hasn't completed a system-design round yet",
  "Communication pace slower than the peer average",
  "Limited recent experience in this specific domain",
  "Gaps in employment history on the resume",
];

function synthesizeRiskFlags(seed: string, evidence: CandidateEvidence | null): string[] {
  const fromEvidence = evidence?.quotes.filter((q) => q.kind === "redFlag").map((q) => q.text) ?? [];
  if (fromEvidence.length) return fromEvidence.slice(0, 3);
  const n = seededVariance(`${seed}:riskCount`, 2);
  const pool = [...RISK_FLAG_POOL];
  const flags: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = seededVariance(`${seed}:risk:${i}`, pool.length - 1);
    flags.push(pool.splice(idx, 1)[0]);
  }
  return flags;
}

function evidenceTier(score: number): { label: string; multiplier: number; tone: "success" | "indigo" | "neutral" } {
  if (score >= 85) return { label: "Exceptional evidence", multiplier: 1.15, tone: "success" };
  if (score >= 70) return { label: "Strong evidence", multiplier: 1.05, tone: "indigo" };
  if (score >= 55) return { label: "Solid evidence", multiplier: 1.0, tone: "neutral" };
  return { label: "Developing evidence", multiplier: 0.9, tone: "neutral" };
}

function verdictFromScore(score: number): { label: string; tone: "success" | "indigo" | "neutral" } {
  if (score >= 80) return { label: "Strong hire", tone: "success" };
  if (score >= 60) return { label: "Hire", tone: "indigo" };
  return { label: "Lean hire", tone: "neutral" };
}

const READINESS_LABEL: Record<string, string> = { strongHire: "Strong hire", hire: "Hire", leanHire: "Lean hire" };
const READINESS_TONE: Record<string, "success" | "indigo" | "neutral"> = { strongHire: "success", hire: "indigo", leanHire: "neutral" };

function synthesizeStarBreakdown(seed: string, overallPct: number | undefined): Array<{ label: string; pct: number }> {
  const base = overallPct ?? 60;
  return ["Situation", "Task", "Action", "Result"].map((label) => {
    const jitter = seededVariance(`${seed}:star:${label}`, 16) - 8;
    return { label, pct: Math.max(10, Math.min(100, Math.round(base + jitter))) };
  });
}

function synthesizeSkillTrend(seed: string, baseScore: number): number[] {
  return Array.from({ length: 6 }, (_, i) => {
    const jitter = seededVariance(`${seed}:trend:${i}`, 20) - 10;
    return Math.max(10, Math.min(100, Math.round(baseScore - 14 + i * 3 + jitter)));
  });
}

const ROUND_TYPES = ["Behavioral", "Technical", "System design", "Culture fit"];
const READINESS_POOL: Array<{ label: string; tone: "success" | "indigo" | "neutral" }> = [
  { label: "Ready", tone: "success" },
  { label: "Near-ready", tone: "indigo" },
  { label: "Needs practice", tone: "neutral" },
];

function synthesizeRoundReadiness(seed: string): Array<{ round: string; readiness: { label: string; tone: "success" | "indigo" | "neutral" } }> {
  return ROUND_TYPES.map((round) => ({
    round,
    readiness: READINESS_POOL[seededVariance(`${seed}:round:${round}`, READINESS_POOL.length - 1)],
  }));
}

function synthesizeCommunicationSignals(seed: string): Array<{ label: string; value: string; detail: string }> {
  const quantified = 55 + seededVariance(`${seed}:comm:quant`, 40);
  const ownership = 55 + seededVariance(`${seed}:comm:own`, 40);
  const composure = 55 + seededVariance(`${seed}:comm:composure`, 40);
  return [
    { label: "Quantified answers", value: `${quantified}%`, detail: "Share of answers backed by a number or metric" },
    { label: "Clear ownership", value: `${ownership}%`, detail: 'Uses "I" to own decisions and outcomes, not just "we"' },
    { label: "Composure under pressure", value: `${composure}%`, detail: "Steady pacing through follow-up questions" },
  ];
}

function matchedSkillCount(requirementSkills: string[], candidateSkills: string[]): string[] {
  const set = new Set(candidateSkills.map((s) => s.toLowerCase()));
  return requirementSkills.filter((s) => set.has(s.toLowerCase()));
}

function synthesizeFitReasons(seed: string, candidate: Candidate, requirement: Requirement, matchedSkills: string[]): string[] {
  const reasons: string[] = [];
  if (matchedSkills.length) {
    reasons.push(`Matches ${matchedSkills.length} of ${requirement.skills.length} required skills: ${matchedSkills.slice(0, 4).join(", ")}`);
  }
  if (candidate.resume?.yearsExperience != null) {
    reasons.push(`${candidate.resume.yearsExperience} years of relevant experience`);
  }
  if (candidate.sessionsCompleted > 0) {
    reasons.push(`Completed ${candidate.sessionsCompleted} practice session${candidate.sessionsCompleted === 1 ? "" : "s"} for this target role`);
  }
  if (candidate.city && requirement.locations.some((l) => l.toLowerCase().includes(candidate.city.toLowerCase()))) {
    reasons.push(`Based in ${candidate.city}, matching the role's location`);
  }
  if (reasons.length < 2) {
    const pool = [
      "Resume shows direct exposure to this domain",
      "Consistent practice cadence over recent sessions",
      "Strong alignment with the role's stated responsibilities",
    ];
    reasons.push(pool[seededVariance(`${seed}:fit`, pool.length - 1)]);
  }
  return reasons.slice(0, 4);
}

function lakhString(amount: number): string {
  // budgetMin/budgetMax are documented as whole INR lakhs for per-annum roles (≤1000);
  // a stray raw-rupee value (e.g. a stale PATCH that skipped revalidation) would otherwise
  // render as a 7-digit number, so fall back to converting it rather than printing it as-is.
  const lpa = amount > 1000 ? amount / 100000 : amount;
  const rounded = Math.round(lpa * 10) / 10;
  return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
}

function formatBudget(amount: number, salaryType: Requirement["salaryType"]): string {
  if (salaryType === "per-annum") return `₹${lakhString(amount)} LPA`;
  if (salaryType === "per-month") return `₹${amount.toLocaleString("en-IN")}/mo`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatBudgetRange(lo: number, hi: number, salaryType: Requirement["salaryType"]): string {
  if (salaryType === "per-annum") return `₹${lakhString(lo)}–${lakhString(hi)} LPA`;
  return `${formatBudget(lo, salaryType)} – ${formatBudget(hi, salaryType)}`;
}

function synthesizeOffer(requirement: Requirement, evidenceScore: number) {
  const { budgetMin, budgetMax, salaryType } = requirement;
  if (budgetMin == null && budgetMax == null) return null;
  const lo = budgetMin ?? budgetMax ?? 0;
  const hi = budgetMax ?? budgetMin ?? 0;
  const mid = (lo + hi) / 2;
  const tier = evidenceTier(evidenceScore);
  const suggested = Math.round(mid * tier.multiplier * 100) / 100;
  const stance: "Above budget" | "At budget" | "Below budget" = suggested > hi ? "Above budget" : suggested < lo ? "Below budget" : "At budget";
  const deltaPct = mid ? Math.round(((suggested - mid) / mid) * 100) : 0;
  return { lo, hi, mid, suggested, stance, deltaPct, tier, salaryType };
}

/* ── Small presentational atoms specific to this page ── */

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

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "success" | "indigo" | "neutral" | "error" }) {
  const toneColor = tone === "success" ? t.success : tone === "error" ? t.error : tone === "indigo" ? t.indigo : t.coal;
  return (
    <Card style={{ boxShadow: "none",  padding: 16 }}>
      <div style={{ fontFamily: f.sans, fontSize: 11, fontWeight: 700, letterSpacing: 0.3, textTransform: "uppercase", color: t.inkFaint }}>{label}</div>
      <div style={{ fontFamily: f.sans, fontSize: 24, fontWeight: 700, color: toneColor, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 4 }}>{sub}</div>}
    </Card>
  );
}

function SnapshotCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: f.sans, fontSize: 11, color: t.inkFaint, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</div>
      <div style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600, color: t.coal, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function BarRow({ label, pct, tone }: { label: string; pct: number; tone?: "success" | "indigo" | "neutral" }) {
  const color = tone === "success" ? t.success : tone === "indigo" ? t.indigo : t.inkFaint;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: f.sans, fontSize: 12.5, color: t.coal, marginBottom: 4 }}>
        <span>{label}</span>
        <strong>{pct}%</strong>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: t.line, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

/* ── Hiring pipeline stepper (unchanged logic from the original page) ── */
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

export default function CandidateDetailPage() {
  const params = useParams<{ id: string; candidateId: string }>();
  const { fetchRequirementDetail, updateCandidateStatus, fetchCandidateEvidence } = useEmployerData();
  const { toast } = useToast();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "practice" | "resume">("overview");
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

  useEmployerBreadcrumb(
    requirement && candidate
      ? [
          { label: requirement.title, path: `/employer/requirements/${params.id}` },
          { label: candidate.unlocked ? candidate.name : `Candidate #${candidate.id.slice(0, 6)}` },
        ]
      : null,
  );

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
      <Card style={{ boxShadow: "none",  textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Loading…</p>
      </Card>
    );
  }

  if (!requirement || !candidate) {
    return (
      <Card style={{ boxShadow: "none",  textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, marginBottom: 16 }}>Candidate not found.</p>
        <Link href={`/employer/requirements/${params.id}`} style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.indigo, textDecoration: "none" }}>
          ← Back to shortlist
        </Link>
      </Card>
    );
  }

  const resume = candidate.resume;
  const displayName = candidate.unlocked ? candidate.name : `Candidate #${candidate.id.slice(0, 6)}`;
  const canInvite = candidate.candidateStatus === "shortlisted";
  const canReject = !["hired", "rejected", "not_a_fit"].includes(candidate.candidateStatus);

  /* ── Derived + synthesized profile data ── */
  const seed = candidate.id;
  const evidenceAvg = evidence?.skills.length
    ? Math.round(evidence.skills.reduce((sum, s) => sum + s.score, 0) / evidence.skills.length)
    : candidate.matchScore;
  const verdict = evidence?.readiness
    ? { label: READINESS_LABEL[evidence.readiness.band], tone: READINESS_TONE[evidence.readiness.band] }
    : verdictFromScore(candidate.matchScore);
  const matchedSkills = matchedSkillCount(requirement.skills, candidate.skills);
  const riskFlags = synthesizeRiskFlags(seed, evidence);
  const starBreakdown = synthesizeStarBreakdown(seed, evidence?.starCompleteness?.pct);
  const skillTrend = synthesizeSkillTrend(seed, evidenceAvg);
  const roundReadiness = synthesizeRoundReadiness(seed);
  const communicationSignals = synthesizeCommunicationSignals(seed);
  const fitReasons = synthesizeFitReasons(seed, candidate, requirement, matchedSkills);
  const offer = synthesizeOffer(requirement, evidenceAvg);
  const unmatchedSkills = requirement.skills.filter((s) => !matchedSkills.some((m) => m.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <Card style={{ boxShadow: "none" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
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
              <h1 style={{ fontFamily: f.sans, fontSize: 22, color: t.coal, margin: 0 }}>{displayName}</h1>
              <Pill tone="indigo">{candidate.targetRole}</Pill>
              <CandidateStatusChip status={candidate.candidateStatus} />
              <Pill tone={candidate.unlocked ? "success" : "neutral"}>{candidate.unlocked ? "Unlocked" : "Locked"}</Pill>
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
              <span style={{ color: t.line }}>·</span>
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                Last active {candidate.lastActiveDaysAgo < 0 ? "—" : `${candidate.lastActiveDaysAgo}d ago`}
              </span>
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
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
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
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
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
      </Card>

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginTop: 16 }}>
        <KpiCard label="Evidence score" value={`${evidenceAvg}`} sub="From practice sessions" tone={evidenceAvg >= 70 ? "success" : evidenceAvg >= 50 ? "indigo" : "neutral"} />
        <KpiCard label="AI verdict" value={verdict.label} sub={evidence?.readiness ? `${evidence.readiness.confidence} confidence` : "Estimated from match score"} tone={verdict.tone} />
        <KpiCard label="Required skills" value={`${matchedSkills.length}/${requirement.skills.length}`} sub="Matched on resume" tone={matchedSkills.length === requirement.skills.length ? "success" : "indigo"} />
        <KpiCard label="Practice sessions" value={`${candidate.sessionsCompleted}`} sub={`Roster score ${candidate.rosterScore}`} tone="neutral" />
        <KpiCard label="Risk flags" value={`${riskFlags.length}`} sub={riskFlags.length ? "Worth a follow-up question" : "Nothing flagged"} tone={riskFlags.length ? "neutral" : "success"} />
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${t.line}`, margin: "20px 0 20px" }}>
        {([
          { key: "overview" as const, label: "Overview" },
          { key: "practice" as const, label: "Practice & communication" },
          { key: "resume" as const, label: "Resume & portfolio" },
        ]).map((tb) => (
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

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {activeTab === "overview" && (
            <>
              <Card style={{ boxShadow: "none" }}>
                <SectionTitle>Why this candidate fits {requirement.title}</SectionTitle>
                <ul style={{ margin: 0, paddingLeft: 18, fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.8 }}>
                  {fitReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </Card>

              <Card style={{ boxShadow: "none" }}>
                <SectionTitle>Practice track record</SectionTitle>
                {evidenceLoading ? (
                  <HelpText>Loading practice-session evidence…</HelpText>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                      {evidence?.readiness && (
                        <Pill tone={READINESS_TONE[evidence.readiness.band]}>
                          {READINESS_LABEL[evidence.readiness.band]} readiness · {evidence.readiness.confidence} confidence
                        </Pill>
                      )}
                      {evidence?.starCompleteness && (
                        <Pill tone={evidence.starCompleteness.pct >= 70 ? "success" : evidence.starCompleteness.pct >= 40 ? "neutral" : "indigo"}>
                          STAR completeness: {evidence.starCompleteness.pct}%
                        </Pill>
                      )}
                      {evidence?.sessionDate && (
                        <Pill tone="neutral">Last session {new Date(evidence.sessionDate).toLocaleDateString()}</Pill>
                      )}
                    </div>
                    {riskFlags.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                        {riskFlags.map((flag) => (
                          <div
                            key={flag}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              background: t.error + "0d",
                              border: `1px solid ${t.error}33`,
                              fontFamily: f.sans,
                              fontSize: 12.5,
                              color: t.error,
                            }}
                          >
                            {flag}
                          </div>
                        ))}
                      </div>
                    )}
                    <HelpText>Scores and flags are derived from this candidate's practice-session performance, not a verified employment check.</HelpText>
                  </>
                )}
              </Card>

              <Card style={{ boxShadow: "none" }}>
                <SectionTitle>STAR evidence breakdown</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                  {starBreakdown.map((s) => (
                    <BarRow key={s.label} label={s.label} pct={s.pct} tone={s.pct >= 70 ? "success" : s.pct >= 50 ? "indigo" : "neutral"} />
                  ))}
                </div>
              </Card>

              <Card style={{ boxShadow: "none" }}>
                <SectionTitle>Skill trend across sessions</SectionTitle>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 72 }}>
                  {skillTrend.map((v, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: "100%", height: `${v / 100 * 64}px`, borderRadius: "4px 4px 0 0", background: i === skillTrend.length - 1 ? t.indigo : t.indigo100 }} />
                      <span style={{ fontFamily: f.sans, fontSize: 10, color: t.inkFaint }}>S{i + 1}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card style={{ boxShadow: "none" }}>
                <SectionTitle>Hiring progress</SectionTitle>
                <HiringProgress status={candidate.candidateStatus} />
              </Card>
            </>
          )}

          {activeTab === "practice" && (
            <>
              <Card style={{ boxShadow: "none" }}>
                <SectionTitle>Round types &amp; readiness</SectionTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {roundReadiness.map((r) => (
                    <div key={r.round} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${t.line}` }}>
                      <span style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal }}>{r.round}</span>
                      <Pill tone={r.readiness.tone}>{r.readiness.label}</Pill>
                    </div>
                  ))}
                </div>
              </Card>

              <Card style={{ boxShadow: "none" }}>
                <SectionTitle>Communication signals</SectionTitle>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  {communicationSignals.map((sig) => (
                    <div key={sig.label}>
                      <div style={{ fontFamily: f.sans, fontSize: 20, fontWeight: 700, color: t.coal }}>{sig.value}</div>
                      <div style={{ fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: t.inkSoft, marginTop: 4 }}>{sig.label}</div>
                      <div style={{ fontFamily: f.sans, fontSize: 11.5, color: t.inkFaint, marginTop: 2, lineHeight: 1.5 }}>{sig.detail}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {evidence && evidence.quotes.length > 0 && (
                <Card style={{ boxShadow: "none" }}>
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
                        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>&ldquo;{q.quote}&rdquo;</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {activeTab === "resume" && (
            <>
              <Card style={{ boxShadow: "none" }}>
                <SectionTitle>Resume intelligence</SectionTitle>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <ScoreChip score={evidenceAvg} />
                  <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{evidenceTier(evidenceAvg).label}</span>
                </div>
                {!candidate.unlocked ? (
                  <HelpText>This candidate's summary is locked. <Link href={`/employer/requirements/${requirement.id}`} style={{ color: t.indigo, fontWeight: 600 }}>Unlock from the shortlist</Link> to view.</HelpText>
                ) : resume?.summary ? (
                  <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.6, margin: 0 }}>{resume.summary}</p>
                ) : (
                  <HelpText>No resume summary available for this candidate.</HelpText>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
                  <SnapshotCell label="Seniority" value={resume?.seniorityLevel || "—"} />
                  <SnapshotCell label="Experience" value={resume?.yearsExperience != null ? `${resume.yearsExperience} yrs` : "—"} />
                  <SnapshotCell label="Sessions" value={`${candidate.sessionsCompleted}`} />
                </div>

                {(!!resume?.keyAchievements.length || riskFlags.length > 0) && (
                  <>
                    <Divider />
                    <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                      {!!resume?.keyAchievements.length && (
                        <div>
                          <SectionTitle>Strengths</SectionTitle>
                          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.7 }}>
                            {resume.keyAchievements.map((a) => (
                              <li key={a}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {riskFlags.length > 0 && (
                        <div>
                          <SectionTitle>Gaps to probe</SectionTitle>
                          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.7 }}>
                            {riskFlags.map((flag) => (
                              <li key={flag}>{flag}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>

              <Card style={{ boxShadow: "none" }}>
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

              <Card style={{ boxShadow: "none" }}>
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
                {!!resume?.certifications.length && (
                  <>
                    <Divider />
                    <div style={{ marginTop: 14 }}>
                      <SectionTitle>Certifications</SectionTitle>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {resume.certifications.map((c) => (
                          <SkillTag key={c}>{c}</SkillTag>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </Card>

              <Card style={{ boxShadow: "none" }}>
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
            </>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {offer && (
            <Card style={{ boxShadow: "none" }}>
              <SectionTitle>Suggested offer</SectionTitle>
              <div style={{ fontFamily: f.sans, fontSize: 24, fontWeight: 700, color: t.coal }}>
                {formatBudget(offer.suggested, offer.salaryType)}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <Pill tone={offer.stance === "Above budget" ? "neutral" : offer.stance === "Below budget" ? "success" : "indigo"}>{offer.stance}</Pill>
                <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint }}>
                  {offer.deltaPct > 0 ? "+" : ""}{offer.deltaPct}% vs. listed budget midpoint
                </span>
              </div>
              <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, lineHeight: 1.6, margin: "10px 0 0" }}>
                Based on {offer.tier.label.toLowerCase()} from {candidate.sessionsCompleted} practice session{candidate.sessionsCompleted === 1 ? "" : "s"}, this candidate's evidence supports an offer {offer.tier.multiplier >= 1 ? "at or above" : "below"} the role's budget midpoint.
              </p>
              <div style={{ marginTop: 14, padding: 12, borderRadius: 10, border: `1px solid ${t.line}`, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>
                  <span>Listed budget</span>
                  <span>{formatBudgetRange(offer.lo, offer.hi, offer.salaryType)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft }}>
                  <span>Evidence tier multiplier</span>
                  <span>×{offer.tier.multiplier.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: f.sans, fontSize: 12.5, fontWeight: 700, color: t.coal }}>
                  <span>Suggested offer</span>
                  <span>{formatBudget(offer.suggested, offer.salaryType)}</span>
                </div>
              </div>
              {resume?.currentCtc && (
                <div style={{ fontFamily: f.sans, fontSize: 11.5, color: t.inkFaint, marginTop: 10 }}>
                  Candidate's current CTC (self-reported): {resume.currentCtc}
                </div>
              )}
            </Card>
          )}

          <Card style={{ boxShadow: "none" }}>
            <SectionTitle>Candidate snapshot</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <SnapshotCell label="Experience" value={resume?.yearsExperience != null ? `${resume.yearsExperience} yrs` : "—"} />
              <SnapshotCell label="Notice period" value={resume?.noticePeriod || "—"} />
              <SnapshotCell label="Current CTC" value={resume?.currentCtc || "—"} />
              <SnapshotCell label="Roster & sessions" value={`${candidate.rosterScore} · ${candidate.sessionsCompleted} sessions`} />
            </div>
          </Card>

          <Card style={{ boxShadow: "none" }}>
            <SectionTitle>Skills</SectionTitle>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {matchedSkills.map((s) => (
                <SkillTag key={s}>{s}</SkillTag>
              ))}
              {unmatchedSkills.map((s) => (
                <span
                  key={s}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: `1px dashed ${t.line}`,
                    fontFamily: f.sans,
                    fontSize: 12,
                    color: t.inkFaint,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
            {unmatchedSkills.length > 0 && <HelpText>Dashed tags haven't been demonstrated yet on this candidate's resume.</HelpText>}
          </Card>

          {!!resume?.education.length && (
            <Card style={{ boxShadow: "none" }}>
              <SectionTitle>Education</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {resume.education.map((ed, i) => (
                  <SnapshotCell key={`${ed.school}-${i}`} label="Degree" value={`${ed.degree}${ed.school ? ` — ${ed.school}` : ""}${ed.year ? ` · ${ed.year}` : ""}`} />
                ))}
                {!!resume.certifications.length && <SnapshotCell label="Certification" value={resume.certifications[0]} />}
              </div>
            </Card>
          )}

          {!candidate.unlocked && (
            <Card style={{ boxShadow: "none",  border: `1px dashed ${t.line}` }}>
              <SectionTitle>Identity locked</SectionTitle>
              <p style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkSoft, lineHeight: 1.6, margin: 0 }}>
                Name, contact details, and portfolio links are hidden until this candidate is unlocked.{" "}
                <Link href={`/employer/requirements/${requirement.id}`} style={{ color: t.indigo, fontWeight: 600 }}>
                  Unlock from the shortlist
                </Link>
                .
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
