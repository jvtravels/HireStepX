"use client";

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  LockIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  ClockIcon,
  BuildingIcon,
  ArchiveIcon,
  Undo2Icon,
  HistoryIcon,
  IndianRupeeIcon,
  MapPinIcon,
  ChevronRightIcon,
  Building2Icon,
  LayoutGridIcon,
  CalendarIcon,
  GraduationCapIcon,
  FolderIcon,
  MoreVerticalIcon,
  FileTextIcon,
  MessageCircleIcon,
  BriefcaseIcon,
  PencilIcon,
  InfoIcon,
} from "lucide-react";
import { useEmployerData, Requirement, CandidateEvidence, UnlockPurchase } from "@/employer/EmployerDataContext";
import { useToast } from "@/Toast";
import { Candidate, RequirementStage, ArchiveDisposition } from "@/employer/mockData";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import LoadingScreen from "@/_LoadingScreen";
import { UNLOCK_BUNDLE_SIZE } from "../../../../../server-handlers/_unlock-pricing";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";
import { formatNumber } from "@/utils";
import {
  Card,
  CandidateStatusChip,
  Eyebrow,
  HelpText,
  OutlineCta,
  Pill,
  PrimaryCta,
  ScoreChip,
  SkillTag,
  StageCell,
  STAGE_LABEL,
} from "@/employer/_atoms";
import { SortableHead, type Sort } from "@/components/SortableHead";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilterPill } from "@/components/FilterPill";
import { SearchWithSuggestions } from "@/components/SearchWithSuggestions";
import { TablePaginationFooter } from "@/components/TablePaginationFooter";

const CANDIDATES_RECENT_SEARCHES_KEY = "hirestepx-employer-candidates-recent-searches";

function experienceLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} yrs experience`;
  if (min != null) return `${min}+ yrs experience`;
  return `Up to ${max} yrs experience`;
}

function daysUntil(dueDate: string): number {
  return Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

/** budgetMin/budgetMax's unit depends on salaryType — whole INR lakhs for
    per-annum roles, a raw INR amount for per-month/fixed ones. Mirrors
    asBoundedBudget in server-handlers/_employer-requirements-helpers.ts and
    budgetLabel in the jobs table. */
function budgetLabel(req: Requirement): string | null {
  const { budgetMin, budgetMax, salaryType } = req;
  if (budgetMin == null && budgetMax == null) return null;
  if (salaryType === "per-annum" || salaryType == null) {
    if (budgetMin != null && budgetMax != null) return `₹${budgetMin}–${budgetMax} LPA`;
    if (budgetMin != null) return `₹${budgetMin}+ LPA`;
    return `Up to ₹${budgetMax} LPA`;
  }
  const suffix = salaryType === "per-month" ? "/month" : " fixed";
  const fmt = (n: number) => `₹${formatNumber(n)}`;
  if (budgetMin != null && budgetMax != null) return `${fmt(budgetMin)}–${formatNumber(budgetMax)}${suffix}`;
  if (budgetMin != null) return `${fmt(budgetMin)}+${suffix}`;
  return `Up to ${fmt(budgetMax as number)}${suffix}`;
}

/** Tooltip copy per pipeline stage — mirrors the "why is this stage here"
    hint the canvas surfaces next to the stage badge. */
const STAGE_HINT: Record<RequirementStage, string> = {
  ai_matching: "The AI is still scoring the practicing pool against this posting.",
  ready_for_review: "Candidates have been scored — review the shortlist and unlock the ones worth contacting.",
  interviewing: "You're actively interviewing candidates from this shortlist.",
  hired: "This posting resulted in a hire.",
};

/* Base body-cell style — mirrors the secondary-text convention shared by
   the Jobs table (app/(employer)/employer/jobs/page.tsx) and Sessions
   table (src/SessionsV2.tsx): textSize.base (13), rather than this
   column's former off-scale 13.5. */
const td: CSSProperties = {
  fontFamily: f.sans,
  fontSize: textSize.base,
  color: t.coal,
  verticalAlign: "middle",
};

/* SortableHead (src/components/SortableHead.tsx) renders its own 20px
   horizontal padding on the sort button rather than relying on the
   th's default — body cells under a SortableHead column must match
   that 20px explicitly, same convention as SessionsV2.tsx/DashboardJobs.tsx,
   or the header text sits 12px right of the data below it. */
const tdSortable: CSSProperties = { ...td, padding: "0 20px" };

const HEADER_CELL_STYLE: CSSProperties = {
  fontFamily: f.sans,
  fontSize: textSize.base,
  fontWeight: 600,
  color: t.inkSoft,
};

type ContactFilter = "all" | "locked" | "unlocked";
type SortColumn = "name" | "match" | "sessions" | "pipeline" | "contact";

const contactFilterOptions: Array<{ value: ContactFilter; label: string }> = [
  { value: "all", label: "All candidates" },
  { value: "unlocked", label: "Unlocked" },
  { value: "locked", label: "Locked" },
];

const DEFAULT_SORT: Sort<SortColumn> = { column: "match", direction: "desc" };

const COLUMN_LABEL: Record<SortColumn, string> = {
  name: "Candidate",
  match: "Match",
  sessions: "Practice history",
  pipeline: "Pipeline",
  contact: "Contact",
};

// Funnel order, not alphabetical — "hired" should sort ahead of
// "interviewing" ahead of "shortlisted" when sorting by pipeline stage.
// Rejected/declined outcomes sort last regardless of direction intent.
const PIPELINE_RANK: Record<Candidate["candidateStatus"], number> = {
  shortlisted: 0,
  interview_invited: 1,
  interviewing: 2,
  hired: 3,
  not_a_fit: 4,
  no_response: 5,
  rejected: 6,
};

function candidateDisplayName(c: Candidate): string {
  return c.unlocked ? c.name : `Candidate #${c.id.slice(0, 6)}`;
}

function compareCandidates(a: Candidate, b: Candidate, sort: Sort<SortColumn>): number {
  const dir = sort.direction === "asc" ? 1 : -1;
  switch (sort.column) {
    case "name":
      return dir * candidateDisplayName(a).localeCompare(candidateDisplayName(b));
    case "match":
      return dir * (a.matchScore - b.matchScore);
    case "sessions":
      return dir * (a.sessionsCompleted - b.sessionsCompleted);
    case "pipeline":
      return dir * (PIPELINE_RANK[a.candidateStatus] - PIPELINE_RANK[b.candidateStatus]);
    case "contact":
      return dir * (Number(a.unlocked) - Number(b.unlocked));
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

function CandidateAvatar({ name, unlocked }: { name: string; unlocked: boolean }) {
  return (
    <Avatar>
      <AvatarFallback style={{ background: unlocked ? t.indigo100 : t.creamSoft, color: unlocked ? t.indigoDeep : t.inkFaint, fontFamily: f.sans, fontWeight: 700 }}>
        {unlocked ? initials(name) : <LockIcon size={14} aria-hidden="true" />}
      </AvatarFallback>
    </Avatar>
  );
}

function GeneratingState() {
  return (
    <LoadingScreen
      fullScreen={false}
      title="Matching candidates…"
      message="We're scoring active candidates against this requirement. This usually takes under a minute."
    />
  );
}

function ZeroMatchState() {
  return (
    <Card style={{ textAlign: "center", padding: 48 }}>
      <h2 style={{ fontFamily: f.sans, fontSize: 22, color: t.coal, margin: "0 0 8px" }}>No matches yet</h2>
      <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, margin: 0 }}>
        No candidates currently practicing on HireStepX match this requirement closely enough to shortlist.
        Try widening the location or notice period, or check back as more candidates practice this week.
      </p>
    </Card>
  );
}

function FailedState() {
  return (
    <Card style={{ textAlign: "center", padding: 48 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: t.error100, color: t.error, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <AlertTriangleIcon size={18} aria-hidden="true" />
      </div>
      <h2 style={{ fontFamily: f.sans, fontSize: 22, color: t.coal, margin: "0 0 8px" }}>Matching failed</h2>
      <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, marginBottom: 20 }}>
        Something went wrong generating this shortlist. No charge was made — you can safely try again.
      </p>
      <Link href="/employer/requirements/new" style={{ textDecoration: "none" }}>
        <PrimaryCta icon={<RefreshCwIcon size={14} aria-hidden="true" />}>Try again</PrimaryCta>
      </Link>
    </Card>
  );
}

// Dynamically loads the Razorpay checkout script with a CSP nonce — see
// handleCheckout in src/dashboardComponents.tsx for the original pattern
// this mirrors (strict-dynamic CSP means a script tag without the nonce
// is silently blocked, not rejected).
function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    const nonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute("content");
    if (nonce) s.nonce = nonce;
    const timer = setTimeout(() => { s.remove(); reject(new Error("timeout")); }, 10_000);
    s.onload = () => { clearTimeout(timer); resolve(); };
    s.onerror = () => { clearTimeout(timer); s.remove(); reject(new Error("load failed")); };
    document.head.appendChild(s);
  });
}

/** Formats interview_scheduled_at as the pipeline substep text under a
    candidate's status chip — real, non-fabricated scheduling data, not a
    stand-in for round/format detail HireStepX doesn't track. */
function interviewSubstep(candidate: Candidate): string | null {
  if (candidate.candidateStatus !== "interview_invited" && candidate.candidateStatus !== "interviewing") return null;
  if (!candidate.interviewScheduledAt) return null;
  const when = new Date(candidate.interviewScheduledAt);
  if (Number.isNaN(when.getTime())) return null;
  const diffDays = Math.round((when.getTime() - Date.now()) / 86_400_000);
  const dateLabel = when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (diffDays < 0) return `Interview was ${dateLabel}`;
  if (diffDays === 0) return `Interview today · ${dateLabel}`;
  return `Interview ${dateLabel}`;
}

function CandidateTableRow({
  candidate,
  requirementId,
  readOnly,
  selected,
  onToggleSelected,
  onUnlocked,
  onViewEvidence,
}: {
  candidate: Candidate;
  requirementId: string;
  readOnly: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onUnlocked: (candidateId: string, name: string, email: string) => void;
  onViewEvidence: () => void;
}) {
  const { createUnlockOrder, verifyUnlockPayment } = useEmployerData();
  const { toast } = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // Display-only — mirrors UNLOCK_SINGLE_PRICE_PAISE in
  // server-handlers/_unlock-pricing.ts, which is the sole source of truth
  // for the amount actually charged.
  const displayPrice = "₹59";

  const handleConfirmUnlock = async () => {
    setUnlocking(true);
    const order = await createUnlockOrder({ mode: "single", matchId: candidate.id });
    if (!order) {
      setUnlocking(false);
      toast("Couldn't start payment — please try again", "error");
      return;
    }

    try {
      await loadRazorpayScript();
    } catch {
      setUnlocking(false);
      toast("Payment system failed to load. Check your connection and try again.", "error");
      return;
    }
    if (!window.Razorpay) {
      setUnlocking(false);
      toast("Payment system not available. Please refresh and try again.", "error");
      return;
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      order_id: order.orderId,
      theme: { color: t.indigo },
      method: { upi: true, card: true, netbanking: true, wallet: true },
      handler: async function (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
        const result = await verifyUnlockPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        setUnlocking(false);
        setConfirming(false);
        const unlockedCandidate = result?.candidates[0];
        if (!unlockedCandidate) {
          toast("Payment received but unlock failed — contact support@hirestepx.com", "error");
          return;
        }
        onUnlocked(unlockedCandidate.matchId, unlockedCandidate.name, unlockedCandidate.contact.email);
        toast(`Unlocked ${unlockedCandidate.name}'s contact details`, "success");
      },
      modal: {
        ondismiss: function () { setUnlocking(false); },
      },
    });
    // The global Window.Razorpay type (declared in dashboardComponents.tsx) types
    // `on`'s callback as zero-arg; payment.failed actually passes a response object.
    (rzp as unknown as { on(event: string, cb: (r: unknown) => void): void }).on("payment.failed", function (response: unknown) {
      const errDetail = (response as { error?: { description?: string; reason?: string } })?.error;
      toast(errDetail?.description || errDetail?.reason || "Payment failed. Please try again.", "error");
      setUnlocking(false);
    });
    rzp.open();
  };

  return (
    <TableRow
      style={{ height: 64, borderBottom: `1px solid ${t.line}` }}
      onMouseEnter={(e) => { e.currentTarget.style.background = t.rowTint; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {!readOnly && (
        <TableCell style={{ width: 32, verticalAlign: "middle" }}>
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelected}
            title="Select candidate"
            aria-label={`Select ${candidate.unlocked ? candidate.name : `candidate #${candidate.id.slice(0, 6)}`}`}
          />
        </TableCell>
      )}
      <TableCell style={tdSortable}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CandidateAvatar name={candidate.name} unlocked={candidate.unlocked} />
          <div>
            <Link
              href={`/employer/requirements/${requirementId}/candidates/${candidate.id}`}
              style={{ fontWeight: 500, fontSize: textSize.md, color: t.coal, textDecoration: "none" }}
              onMouseOver={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
              onMouseOut={(e) => { e.currentTarget.style.textDecoration = "none"; }}
            >
              {candidate.unlocked ? candidate.name : `Candidate #${candidate.id.slice(0, 6)}`}
            </Link>
            <div style={{ fontSize: textSize.base, color: t.inkFaint, marginTop: 2 }}>
              {candidate.targetRole} · {candidate.city}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell style={tdSortable}>
        <ScoreChip score={candidate.matchScore} />
      </TableCell>
      <TableCell style={{ ...tdSortable, color: t.inkSoft }}>
        {candidate.rosterScore} roster · {candidate.sessionsCompleted} {candidate.sessionsCompleted === 1 ? "session" : "sessions"}
      </TableCell>
      <TableCell style={{ ...td, color: t.inkSoft }}>
        {candidate.resume?.noticePeriod || <span style={{ color: t.inkFaint }}>—</span>}
      </TableCell>
      <TableCell style={{ ...td, color: t.inkSoft }}>
        {candidate.resume?.currentCtc ? (
          <>
            {candidate.resume.currentCtc}
            <div style={{ fontFamily: f.sans, fontSize: textSize.xs, color: t.inkFaint, marginTop: 2 }}>self-reported</div>
          </>
        ) : (
          <span style={{ color: t.inkFaint }}>—</span>
        )}
      </TableCell>
      <TableCell style={{ ...td, maxWidth: 220 }}>
        {candidate.skills.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {candidate.skills.slice(0, 3).map((s) => (
              <SkillTag key={s}>{s}</SkillTag>
            ))}
            {candidate.skills.length > 3 && (
              <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint, alignSelf: "center" }}>
                +{candidate.skills.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: t.inkFaint }}>—</span>
        )}
      </TableCell>
      <TableCell style={tdSortable}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
          <CandidateStatusChip status={candidate.candidateStatus} />
          {interviewSubstep(candidate) && (
            <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint }}>{interviewSubstep(candidate)}</span>
          )}
        </div>
      </TableCell>
      <TableCell style={{ ...tdSortable, minWidth: 180 }}>
        {candidate.unlocked ? (
          <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.coal }}>{candidate.contact?.email}</span>
        ) : readOnly ? (
          <HelpText>Unlocking closed</HelpText>
        ) : (
          <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>Locked</span>
        )}
      </TableCell>
      <TableCell style={{ ...td, width: 48, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Actions for ${candidate.unlocked ? candidate.name : `candidate #${candidate.id.slice(0, 6)}`}`}
              style={{ height: 36, width: 36, color: t.inkFaint }}
            >
              <MoreVerticalIcon size={16} aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {!candidate.unlocked && !readOnly && (
              <DropdownMenuItem onSelect={() => setConfirming(true)}>
                <LockIcon className="size-4" aria-hidden="true" /> Unlock — {displayPrice}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={onViewEvidence}>
              <FileTextIcon className="size-4" aria-hidden="true" /> View evidence report
            </DropdownMenuItem>
            {candidate.unlocked && !readOnly && (
              <DropdownMenuItem onSelect={() => router.push(`/employer/requirements/${requirementId}/outcome?candidate=${candidate.id}`)}>
                <MessageCircleIcon className="size-4" aria-hidden="true" /> How did it go?
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog open={confirming} onOpenChange={(open) => { if (!unlocking) setConfirming(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unlock contact for {displayPrice}?</DialogTitle>
              <DialogDescription>
                Reveals {candidate.unlocked ? candidate.name : "this candidate"}&apos;s contact details.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <OutlineCta onClick={() => setConfirming(false)}>Cancel</OutlineCta>
              <PrimaryCta onClick={handleConfirmUnlock} disabled={unlocking}>
                {unlocking ? "Unlocking…" : "Confirm"}
              </PrimaryCta>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

function BatchUnlockBanner({
  requirementId,
  batchStart,
  batchEnd,
  onUnlocked,
}: {
  requirementId: string;
  batchStart: number;
  batchEnd: number;
  onUnlocked: (candidates: Array<{ matchId: string; name: string; contact: { email: string } }>) => void;
}) {
  const { createUnlockOrder, verifyUnlockPayment } = useEmployerData();
  const { toast } = useToast();
  const [unlocking, setUnlocking] = useState(false);

  const handleUnlockBatch = async () => {
    setUnlocking(true);
    const order = await createUnlockOrder({ mode: "batch", requirementId });
    if (!order) {
      setUnlocking(false);
      toast("Couldn't start payment — please try again", "error");
      return;
    }

    try {
      await loadRazorpayScript();
    } catch {
      setUnlocking(false);
      toast("Payment system failed to load. Check your connection and try again.", "error");
      return;
    }
    if (!window.Razorpay) {
      setUnlocking(false);
      toast("Payment system not available. Please refresh and try again.", "error");
      return;
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      order_id: order.orderId,
      theme: { color: t.indigo },
      method: { upi: true, card: true, netbanking: true, wallet: true },
      handler: async function (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) {
        const result = await verifyUnlockPayment({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        });
        setUnlocking(false);
        if (!result || result.candidates.length === 0) {
          toast("Payment received but unlock failed — contact support@hirestepx.com", "error");
          return;
        }
        onUnlocked(result.candidates);
        toast(`Unlocked ${result.candidates.length} candidate${result.candidates.length === 1 ? "" : "s"}`, "success");
      },
      modal: {
        ondismiss: function () { setUnlocking(false); },
      },
    });
    (rzp as unknown as { on(event: string, cb: (r: unknown) => void): void }).on("payment.failed", function (response: unknown) {
      const errDetail = (response as { error?: { description?: string; reason?: string } })?.error;
      toast(errDetail?.description || errDetail?.reason || "Payment failed. Please try again.", "error");
      setUnlocking(false);
    });
    rzp.open();
  };

  return (
    <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px", background: t.creamSoft }}>
      <span style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal }}>
        Unlock candidates <strong>{batchStart}–{batchEnd}</strong> for a flat rate instead of one at a time.
      </span>
      <PrimaryCta size="sm" icon={<LockIcon size={13} aria-hidden="true" />} onClick={handleUnlockBatch} disabled={unlocking}>
        {unlocking ? "Unlocking…" : "Unlock batch — ₹299"}
      </PrimaryCta>
    </Card>
  );
}

/** Mirrors EvidencePanel on the candidate-detail page — real per-skill
    scores from the candidate's most recent completed practice session. */
function EvidencePanel({ evidence, loading }: { evidence: CandidateEvidence | null; loading: boolean }) {
  if (loading) return <HelpText>Loading practice-session evidence…</HelpText>;
  if (!evidence || evidence.skills.length === 0) return <HelpText>No practice session data yet.</HelpText>;
  return (
    <div>
      {evidence.sessionDate && (
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, marginBottom: 14 }}>
          From most recent practice session · {new Date(evidence.sessionDate).toLocaleDateString()}
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
    </div>
  );
}

function EvidenceDialog({ matchId, onClose }: { matchId: string | null; onClose: () => void }) {
  const { fetchCandidateEvidence } = useEmployerData();
  const [evidence, setEvidence] = useState<CandidateEvidence | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    let active = true;
    setLoading(true);
    setEvidence(null);
    fetchCandidateEvidence(matchId).then((e) => {
      if (active) {
        setEvidence(e);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [matchId, fetchCandidateEvidence]);

  return (
    <Dialog open={matchId != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Evidence report</DialogTitle>
          <DialogDescription>Per-skill scores from this candidate&apos;s most recent completed practice session.</DialogDescription>
        </DialogHeader>
        <EvidencePanel evidence={evidence} loading={loading} />
      </DialogContent>
    </Dialog>
  );
}

/** Auto-dismissing "Undo" banner for the one action on this page that can be
    reversed without a page reload — a manual stage or bulk-status change.
    Failures already revert automatically; this is for changes that
    succeeded but the employer wants to take back. */
function UndoBanner({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", background: t.indigo100 }}>
      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.indigoDeep }}>{message}</span>
      <Button
        type="button"
        variant="link"
        onClick={onUndo}
        style={{ fontFamily: f.sans, fontSize: 12.5, fontWeight: 700, color: t.indigoDeep, height: "auto", padding: 0, display: "flex", alignItems: "center", gap: 4 }}
      >
        <Undo2Icon size={13} aria-hidden="true" /> Undo
      </Button>
    </Card>
  );
}

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    fetchRequirementDetail,
    updateRequirementStage,
    updateCandidateStatus,
    archiveRequirement,
    reopenRequirement,
    fetchUnlockHistory,
  } = useEmployerData();
  const { toast } = useToast();
  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  // Backs both the 2-way Compare flow and bulk actions — Compare just reads
  // this same set and only enables/fires when it holds exactly 2 ids.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectNote, setBulkRejectNote] = useState("");
  const [bulkRejectSubmitting, setBulkRejectSubmitting] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [pipelineFilter, setPipelineFilter] = useState<"all" | "interviewing" | "hired">("all");
  const [sort, setSort] = useState<Sort<SortColumn>>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [evidenceMatchId, setEvidenceMatchId] = useState<string | null>(null);
  const [undoBanner, setUndoBanner] = useState<{ message: string; run: () => void } | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReasonInput, setArchiveReasonInput] = useState("");
  const [archiveDisposition, setArchiveDisposition] = useState<ArchiveDisposition>("keep_candidates");
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [reopenSaving, setReopenSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [unlockHistory, setUnlockHistory] = useState<UnlockPurchase[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetchRequirementDetail(params.id);
    setRequirement(r);
    setLoading(false);
  }, [fetchRequirementDetail, params.id]);

  useEffect(() => {
    load();
  }, [load]);

  // A freshly created requirement matches synchronously on the server, so
  // by the time this page loads it's already past "generating" in
  // practice — this poll only covers the rare case of a stale fetch.
  useEffect(() => {
    if (requirement?.status !== "generating") return;
    const timer = setTimeout(load, 2500);
    return () => clearTimeout(timer);
  }, [requirement?.status, load]);

  const locationOptions = useMemo(() => {
    const cities = new Set((requirement?.candidates ?? []).map((c) => c.city).filter((c) => c && c !== "Not specified"));
    return Array.from(cities).sort();
  }, [requirement]);

  const suggestedFilters = useMemo(() => {
    const suggestions: Array<{ label: string; apply: () => void }> = [];
    const firstContact = contactFilterOptions.find((o) => o.value !== "all" && o.value !== contactFilter);
    if (firstContact) suggestions.push({ label: `Contact: ${firstContact.label}`, apply: () => setContactFilter(firstContact.value) });
    const firstLocation = locationOptions.find((loc) => loc !== locationFilter);
    if (firstLocation) suggestions.push({ label: `Location: ${firstLocation}`, apply: () => setLocationFilter(firstLocation) });
    return suggestions.slice(0, 4);
  }, [contactFilter, locationOptions, locationFilter]);

  const filteredSorted = useMemo(() => {
    const candidates = requirement?.candidates ?? [];
    const q = search.trim().toLowerCase();
    const filtered = candidates.filter((c) => {
      if (contactFilter === "locked" && c.unlocked) return false;
      if (contactFilter === "unlocked" && !c.unlocked) return false;
      if (locationFilter !== "all" && c.city !== locationFilter) return false;
      if (pipelineFilter === "interviewing" && c.candidateStatus !== "interview_invited" && c.candidateStatus !== "interviewing") return false;
      if (pipelineFilter === "hired" && c.candidateStatus !== "hired") return false;
      if (!q) return true;
      const haystack = [c.unlocked ? c.name : "", c.targetRole, c.city, c.resume?.noticePeriod || "", ...c.skills].join(" ").toLowerCase();
      return haystack.includes(q);
    });
    return filtered.sort((a, b) => compareCandidates(a, b, sort));
  }, [requirement, search, contactFilter, locationFilter, pipelineFilter, sort]);

  useEffect(() => {
    setPage(1);
  }, [search, contactFilter, locationFilter, pipelineFilter, sort, rowsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / rowsPerPage));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filteredSorted.slice((pageSafe - 1) * rowsPerPage, pageSafe * rowsPerPage);

  const handleUnlocked = (candidateId: string, name: string, email: string) => {
    setRequirement((prev) =>
      prev
        ? {
            ...prev,
            candidates: prev.candidates.map((c) =>
              c.id !== candidateId ? c : { ...c, unlocked: true, name, contact: { email } }
            ),
          }
        : prev
    );
  };

  const handleBatchUnlocked = (unlocked: Array<{ matchId: string; name: string; contact: { email: string } }>) => {
    const byId = new Map(unlocked.map((u) => [u.matchId, u]));
    setRequirement((prev) =>
      prev
        ? {
            ...prev,
            candidates: prev.candidates.map((c) => {
              const u = byId.get(c.id);
              return u ? { ...c, unlocked: true, name: u.name, contact: { email: u.contact.email } } : c;
            }),
          }
        : prev
    );
  };

  // Candidates arrive ranked by match_score descending (matches the server's
  // fixed fetch order — see server-handlers/employer-requirement-detail.ts),
  // so batch membership by position is stable regardless of local filtering.
  const nextLockedBatch = (() => {
    if (!requirement) return null;
    const candidates = requirement.candidates;
    for (let start = 0; start < candidates.length; start += UNLOCK_BUNDLE_SIZE) {
      const batch = candidates.slice(start, start + UNLOCK_BUNDLE_SIZE);
      if (batch.some((c) => !c.unlocked)) {
        return { start: start + 1, end: start + batch.length };
      }
    }
    return null;
  })();

  const handleStageChange = async (stage: RequirementStage) => {
    if (!requirement) return;
    const previousStage = requirement.stage;
    setRequirement((prev) => (prev ? { ...prev, stage } : prev));
    const ok = await updateRequirementStage(requirement.id, stage);
    if (!ok) {
      setRequirement((prev) => (prev ? { ...prev, stage: previousStage } : prev));
      toast("Couldn't update the stage — please try again", "error");
      return;
    }
    setUndoBanner({
      message: `Stage changed to ${STAGE_LABEL[stage]}`,
      run: async () => {
        setUndoBanner(null);
        setRequirement((prev) => (prev ? { ...prev, stage: previousStage } : prev));
        const reverted = await updateRequirementStage(requirement.id, previousStage);
        if (!reverted) {
          setRequirement((prev) => (prev ? { ...prev, stage } : prev));
          toast("Couldn't undo the stage change", "error");
        }
      },
    });
  };

  if (loading) {
    return (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Loading…</p>
      </Card>
    );
  }

  if (!requirement) {
    return (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>Requirement not found.</p>
      </Card>
    );
  }

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applyCandidateUpdate = (matchId: string, patch: Partial<Candidate>) => {
    setRequirement((prev) =>
      prev ? { ...prev, candidates: prev.candidates.map((c) => (c.id !== matchId ? c : { ...c, ...patch })) } : prev
    );
  };

  const handleBulkReject = async () => {
    if (!requirement) return;
    const targets = requirement.candidates.filter((c) => selectedIds.has(c.id));
    const eligible = targets.filter((c) => c.candidateStatus !== "hired");
    const skippedHiredCount = targets.length - eligible.length;
    if (eligible.length === 0) {
      setBulkRejectOpen(false);
      toast("All selected candidates are already hired — nothing to reject", "error");
      return;
    }

    const previousStatuses = new Map(eligible.map((c) => [c.id, c.candidateStatus] as const));
    setBulkRejectSubmitting(true);
    eligible.forEach((c) => applyCandidateUpdate(c.id, { candidateStatus: "rejected" }));

    const note = bulkRejectNote.trim() || undefined;
    const results = await Promise.allSettled(
      eligible.map((c) => updateCandidateStatus(c.id, { candidateStatus: "rejected", note }))
    );

    let succeeded = 0;
    let failed = 0;
    const succeededTargets: Candidate[] = [];
    results.forEach((result, i) => {
      const ok = result.status === "fulfilled" && result.value;
      if (ok) {
        succeeded += 1;
        succeededTargets.push(eligible[i]);
      } else {
        failed += 1;
        applyCandidateUpdate(eligible[i].id, { candidateStatus: previousStatuses.get(eligible[i].id)! });
      }
    });

    setBulkRejectSubmitting(false);
    setBulkRejectOpen(false);
    setBulkRejectNote("");
    setSelectedIds(new Set());

    const skippedSuffix = skippedHiredCount > 0 ? ` (${skippedHiredCount} already hired, skipped)` : "";
    if (failed === 0) {
      toast(`${succeeded} candidate${succeeded === 1 ? "" : "s"} rejected${skippedSuffix}`, "success");
      setUndoBanner({
        message: `${succeeded} candidate${succeeded === 1 ? "" : "s"} rejected`,
        run: async () => {
          setUndoBanner(null);
          succeededTargets.forEach((c) => applyCandidateUpdate(c.id, { candidateStatus: previousStatuses.get(c.id)! }));
          const restoreResults = await Promise.allSettled(
            succeededTargets.map((c) => updateCandidateStatus(c.id, { candidateStatus: previousStatuses.get(c.id)! }))
          );
          const restoreFailed = restoreResults.filter((r) => r.status !== "fulfilled" || !r.value).length;
          if (restoreFailed > 0) toast(`Couldn't undo ${restoreFailed} of ${succeededTargets.length}`, "error");
        },
      });
    } else if (succeeded === 0) {
      toast(`Couldn't reject any candidates — please try again${skippedSuffix}`, "error");
    } else {
      toast(`${succeeded} rejected, ${failed} failed — try again${skippedSuffix}`, "error");
    }
  };


  const handleArchive = async () => {
    setArchiveSaving(true);
    const ok = await archiveRequirement(requirement.id, {
      archiveReason: archiveReasonInput.trim() || undefined,
      archiveDisposition,
    });
    setArchiveSaving(false);
    if (ok) {
      toast("Requirement archived", "success");
      setArchiveOpen(false);
      setArchiveReasonInput("");
      load();
    } else {
      toast("Couldn't archive this requirement — please try again", "error");
    }
  };

  const handleReopen = async () => {
    setReopenSaving(true);
    const ok = await reopenRequirement(requirement.id);
    setReopenSaving(false);
    if (ok) {
      toast("Requirement reopened — re-matching candidates", "success");
      load();
    } else {
      toast("Couldn't reopen this requirement — please try again", "error");
    }
  };

  const openUnlockHistory = () => {
    setHistoryOpen(true);
    if (unlockHistory != null) return;
    setHistoryLoading(true);
    fetchUnlockHistory().then((purchases) => {
      setUnlockHistory(purchases ?? []);
      setHistoryLoading(false);
    });
  };

  const candidateIdSet = new Set(requirement.candidates.map((c) => c.id));
  const relevantUnlockHistory = (unlockHistory ?? []).filter((p) => p.matchIds.some((id) => candidateIdSet.has(id)));

  const readOnly = requirement.status === "closed";
  const avgMatch = requirement.candidates.length
    ? Math.round(requirement.candidates.reduce((sum, c) => sum + c.matchScore, 0) / requirement.candidates.length)
    : 0;
  const scoreLow = requirement.candidates.length ? Math.min(...requirement.candidates.map((c) => c.matchScore)) : 0;
  const scoreHigh = requirement.candidates.length ? Math.max(...requirement.candidates.map((c) => c.matchScore)) : 0;
  const evidenceTier = avgMatch >= 90 ? "Strong signal" : avgMatch >= 75 ? "Solid signal" : "Mixed signal";
  const expLabel = experienceLabel(requirement.experienceMin, requirement.experienceMax);
  const dueDaysLeft = requirement.dueDate ? daysUntil(requirement.dueDate) : null;
  const hasCandidates = requirement.candidates.length > 0 && requirement.status !== "generating";
  const budget = budgetLabel(requirement);
  const jobType = requirement.employmentType ? EMPLOYMENT_TYPE_LABEL[requirement.employmentType] || requirement.employmentType : null;
  const workModeLabel = requirement.workMode ? WORK_MODE_LABEL[requirement.workMode] || requirement.workMode : null;
  const interviewingCount = requirement.candidates.filter(
    (c) => c.candidateStatus === "interview_invited" || c.candidateStatus === "interviewing",
  ).length;
  const hiredCount = requirement.candidates.filter((c) => c.candidateStatus === "hired").length;
  const pipelineStages: Array<{ label: string; value: number; filterValue: "all" | "interviewing" | "hired" }> = [
    { label: "evaluated", value: requirement.candidates.length, filterValue: "all" },
    { label: "interviewing", value: interviewingCount, filterValue: "interviewing" },
    { label: "hired", value: hiredCount, filterValue: "hired" },
  ];
  const handlePipelineStageClick = (filterValue: "all" | "interviewing" | "hired") => {
    setPipelineFilter((prev) => (prev === filterValue ? "all" : filterValue));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
      <Card style={{ flex: "3 1 560px", boxShadow: "none" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: t.indigo100,
                color: t.indigo,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <BriefcaseIcon size={22} aria-hidden="true" />
            </div>
            <div>
              <Eyebrow tone="indigo">{requirement.noticePeriodPref} notice</Eyebrow>
              <h1 style={{ fontFamily: f.sans, fontSize: 28, color: t.coal, margin: "6px 0 0" }}>{requirement.title}</h1>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4, marginTop: 8, fontFamily: f.sans, fontSize: 13.5, fontWeight: 500, color: t.coal }}>
                {budget && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <IndianRupeeIcon size={14} color={t.inkFaint} aria-hidden="true" /> {budget}
                  </span>
                )}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MapPinIcon size={14} color={t.inkFaint} aria-hidden="true" />
                  {(requirement.locations.length > 0 ? requirement.locations.join(", ") : requirement.location)}
                  {workModeLabel ? ` · ${workModeLabel}` : ""}
                </span>
                {expLabel && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <GraduationCapIcon size={14} color={t.inkFaint} aria-hidden="true" /> {expLabel}
                  </span>
                )}
                {(jobType || requirement.durationWeeks != null || requirement.hoursPerWeek != null) && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <ClockIcon size={14} color={t.inkFaint} aria-hidden="true" />
                    {[
                      jobType,
                      requirement.durationWeeks != null ? `${requirement.durationWeeks} ${requirement.durationWeeks === 1 ? "week" : "weeks"}` : null,
                      requirement.hoursPerWeek != null ? `${requirement.hoursPerWeek} hrs/week` : null,
                    ].filter(Boolean).join(" · ")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {requirement.status === "closed" && (
              <Button type="button" variant="outline" onClick={handleReopen} disabled={reopenSaving} style={{ fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, height: "auto", padding: "6px 12px" }}>
                {reopenSaving ? "Reopening…" : "Reopen"}
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <StageCell
                    stage={requirement.stage}
                    hasEvaluatedCandidates={requirement.candidates.length > 0}
                    onChange={handleStageChange}
                    frozen={requirement.status === "closed"}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-64">{STAGE_HINT[requirement.stage]}</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Actions for ${requirement.title}`}
                  style={{ width: 36, height: 36, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: t.inkFaint }}
                >
                  <MoreVerticalIcon size={16} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {requirement.status !== "closed" && (
                  <DropdownMenuItem onSelect={() => router.push(`/employer/requirements/${requirement.id}/edit`)}>
                    <PencilIcon size={14} aria-hidden="true" /> Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={openUnlockHistory}>
                  <HistoryIcon size={14} aria-hidden="true" /> Unlock history
                </DropdownMenuItem>
                {requirement.status !== "closed" && (
                  <DropdownMenuItem
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive"
                    onSelect={() => setArchiveOpen(true)}
                  >
                    <ArchiveIcon size={14} aria-hidden="true" /> Archive
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Dialog open={archiveOpen} onOpenChange={(open) => { if (!archiveSaving) setArchiveOpen(open); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive &ldquo;{requirement.title}&rdquo;?</DialogTitle>
              <DialogDescription>
                Closes the posting to new unlocks. Candidates already unlocked stay unlocked — this only affects new activity.
              </DialogDescription>
            </DialogHeader>
            <div style={{ display: "grid", gap: 14, padding: "4px 0" }}>
              <div style={{ display: "grid", gap: 8 }}>
                <Label htmlFor="archive-reason">Reason (optional)</Label>
                <Textarea
                  id="archive-reason"
                  rows={2}
                  value={archiveReasonInput}
                  onChange={(e) => setArchiveReasonInput(e.target.value)}
                  placeholder="Role filled, put on hold, etc…"
                />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                <Label>Still-open candidates</Label>
                <RadioGroup value={archiveDisposition} onValueChange={(v) => setArchiveDisposition(v as ArchiveDisposition)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <RadioGroupItem value="keep_candidates" id="archive-keep" />
                    <Label htmlFor="archive-keep" style={{ fontWeight: 400 }}>Leave their status as-is</Label>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <RadioGroupItem value="reject_remaining" id="archive-reject" />
                    <Label htmlFor="archive-reject" style={{ fontWeight: 400 }}>Reject everyone still in the pipeline</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <OutlineCta onClick={() => setArchiveOpen(false)}>Cancel</OutlineCta>
              <Button type="button" variant="destructive" onClick={handleArchive} disabled={archiveSaving}>
                {archiveSaving ? "Archiving…" : "Archive requirement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unlock history</DialogTitle>
              <DialogDescription>Every contact unlock purchased against this requirement.</DialogDescription>
            </DialogHeader>
            {historyLoading ? (
              <HelpText>Loading purchase history…</HelpText>
            ) : relevantUnlockHistory.length === 0 ? (
              <HelpText>No unlocks purchased for this requirement yet.</HelpText>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto" }}>
                {relevantUnlockHistory.map((p) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${t.line}` }}>
                    <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal }}>
                      {p.matchIds.length > 1 ? `Batch of ${p.matchIds.length}` : "Single candidate"}
                    </span>
                    <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>
                      ₹{(p.amount / 100).toFixed(0)} · {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {requirement.description && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
            <p
              style={{
                fontFamily: f.sans,
                fontSize: 13.5,
                color: t.inkSoft,
                lineHeight: 1.6,
                margin: 0,
                display: descExpanded ? "block" : "-webkit-box",
                WebkitLineClamp: descExpanded ? undefined : 2,
                WebkitBoxOrient: "vertical",
                overflow: descExpanded ? "visible" : "hidden",
              }}
            >
              {requirement.description}
            </p>
            <Button
              type="button"
              variant="link"
              onClick={() => setDescExpanded((v) => !v)}
              style={{ padding: 0, marginTop: 6, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, height: "auto" }}
            >
              {descExpanded ? "Show less" : "Read more"}
            </Button>
          </div>
        )}

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
          {dueDaysLeft != null && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12.5, color: dueDaysLeft < 0 ? t.error : t.inkFaint, fontWeight: dueDaysLeft < 0 ? 600 : 400 }}>
              <ClockIcon size={13} aria-hidden="true" /> {dueDaysLeft < 0 ? `${Math.abs(dueDaysLeft)}d overdue` : dueDaysLeft === 0 ? "Due today" : `${dueDaysLeft}d until due`}
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>
            <BuildingIcon size={13} aria-hidden="true" /> Posted {requirement.createdAt}
          </span>
        </div>

        {hasCandidates ? (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>
              {pipelineStages.map((stage, i) => (
                <span key={stage.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {i > 0 && <ChevronRightIcon size={14} color={t.inkFaintWeak} aria-hidden="true" />}
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => handlePipelineStageClick(stage.filterValue)}
                    aria-pressed={pipelineFilter === stage.filterValue && stage.filterValue !== "all"}
                    style={{
                      padding: 0,
                      height: "auto",
                      fontFamily: f.sans,
                      fontSize: 13,
                      color: pipelineFilter === stage.filterValue && stage.filterValue !== "all" ? t.indigo : t.inkFaint,
                      fontWeight: pipelineFilter === stage.filterValue && stage.filterValue !== "all" ? 600 : 400,
                    }}
                  >
                    <span style={{ color: t.coal, fontWeight: 600 }}>{stage.value}</span> {stage.label}
                  </Button>
                  {stage.label === "evaluated" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span style={{ display: "inline-flex", color: t.inkFaintWeak }}>
                          <InfoIcon size={12} aria-hidden="true" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-64">
                        Candidates HireStepX matched to this posting from candidates&rsquo; practice-session history.
                      </TooltipContent>
                    </Tooltip>
                  )}
                </span>
              ))}
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 13, color: t.inkFaint }}>
              <span>
                <span style={{ color: t.indigo, fontWeight: 600 }}>{avgMatch}%</span> avg evidence score ({evidenceTier}), spanning{" "}
                <span style={{ color: t.coal, fontWeight: 500 }}>{scoreLow}–{scoreHigh}%</span>
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span style={{ display: "inline-flex", color: t.inkFaintWeak }}>
                    <InfoIcon size={12} aria-hidden="true" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-64">
                  The average match score across evaluated candidates, and the range it spans.
                </TooltipContent>
              </Tooltip>
            </span>
          </div>
        ) : (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
            <HelpText>
              {requirement.status === "generating" ? "Scoring candidates…" : "No candidates shared yet."}
            </HelpText>
          </div>
        )}
      </Card>

      <Card style={{ minWidth: 260, maxWidth: 340, flex: "1 1 260px", boxShadow: "none" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h2 style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 600, color: t.coal, margin: 0 }}>Talent preferences</h2>
          {requirement.status !== "closed" && (
            <Link
              href={`/employer/requirements/${requirement.id}/edit`}
              style={{ fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: t.indigo, textDecoration: "none" }}
            >
              Edit
            </Link>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
          {[
            { Icon: Building2Icon, label: "Industry", value: requirement.preferredIndustry || "Not specified" },
            { Icon: LayoutGridIcon, label: "Domain", value: requirement.preferredDomain || "Not specified" },
            { Icon: CalendarIcon, label: "Availability", value: requirement.availability || "Not specified" },
            { Icon: GraduationCapIcon, label: "Experience", value: requirement.relevantExperience || "Not specified" },
          ].map(({ Icon, label, value }) => (
            <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: t.creamSoft, color: t.inkFaint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={14} aria-hidden="true" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkFaint }}>{label}</span>
                <span style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 500, color: t.coal }}>{value}</span>
              </div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: t.creamSoft, color: t.inkFaint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FolderIcon size={14} aria-hidden="true" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkFaint }}>Portfolio</span>
              <Pill tone={requirement.portfolioRequired ? "indigo" : "neutral"}>
                {requirement.portfolioRequired ? "Required" : "Optional"}
              </Pill>
            </div>
          </div>
        </div>
      </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <Card>
          <h2 style={{ fontFamily: f.sans, fontSize: 18, color: t.coal, margin: "0 0 10px" }}>Description</h2>
          <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
            {requirement.description || "No description was added for this requirement."}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Location</div>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, marginTop: 4 }}>
                {requirement.locations.length > 0 ? requirement.locations.join(", ") : requirement.location}
              </div>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Work mode</div>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, marginTop: 4, textTransform: "capitalize" }}>{requirement.workMode || "Not specified"}</div>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Open positions</div>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, marginTop: 4 }}>{requirement.openPositions ?? "Not specified"}</div>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Experience</div>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, marginTop: 4 }}>{expLabel || "Any"}</div>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Notice period</div>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, marginTop: 4 }}>{requirement.noticePeriodPref}</div>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Preferred industry</div>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, marginTop: 4 }}>{requirement.preferredIndustry || "Not specified"}</div>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Due date</div>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, marginTop: 4 }}>{requirement.dueDate || "No due date set"}</div>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Posted</div>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, marginTop: 4 }}>{requirement.createdAt}</div>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Pipeline stage</div>
              <div style={{ marginTop: 4, fontFamily: f.sans, fontSize: 13.5, color: t.coal }}>{STAGE_LABEL[requirement.stage]}</div>
            </div>
          </div>

          {requirement.workSchedule && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Work schedule</div>
              <div style={{ fontFamily: f.sans, fontSize: 13.5, color: t.coal, marginTop: 4 }}>{requirement.workSchedule}</div>
            </div>
          )}

          {requirement.skills.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint, marginBottom: 8 }}>Skills</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {requirement.skills.map((s) => <SkillTag key={s}>{s}</SkillTag>)}
              </div>
            </div>
          )}

          {requirement.responsibilities && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint, marginBottom: 8 }}>Responsibilities</div>
              <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{requirement.responsibilities}</p>
            </div>
          )}

          {requirement.niceToHave && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint, marginBottom: 8 }}>Nice to have</div>
              <p style={{ fontFamily: f.sans, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{requirement.niceToHave}</p>
            </div>
          )}

          {requirement.preferredColleges.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint, marginBottom: 8 }}>Preferred colleges</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {requirement.preferredColleges.map((c) => <Pill key={c} tone="indigo">{c}</Pill>)}
              </div>
            </div>
          )}

          {requirement.targetCompanies.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint, marginBottom: 8 }}>Target companies</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {requirement.targetCompanies.map((c) => <Pill key={c} tone="indigo">{c}</Pill>)}
              </div>
            </div>
          )}

          {requirement.perksAndBenefits.length > 0 && (
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${t.line}` }}>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint, marginBottom: 8 }}>Perks and benefits</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {requirement.perksAndBenefits.map((p) => <Pill key={p} tone="success">{p}</Pill>)}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontFamily: f.sans, fontSize: 18, color: t.coal, margin: "0 0 16px" }}>Candidates</h2>
        <>
          {requirement.status === "generating" && <GeneratingState />}
          {requirement.status === "failed" && <FailedState />}
          {requirement.status === "zero" && <ZeroMatchState />}

          {(requirement.status === "ready" || requirement.status === "partial" || requirement.status === "closed") && (
            <>
              {undoBanner && (
                <UndoBanner message={undoBanner.message} onUndo={undoBanner.run} onDismiss={() => setUndoBanner(null)} />
              )}
              {readOnly && (
                <Card style={{ background: t.creamSoft, marginBottom: 16 }}>
                  <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
                    This requirement is closed. Candidate details are read-only.
                  </span>
                </Card>
              )}
              {!readOnly && nextLockedBatch && (
                <BatchUnlockBanner
                  requirementId={requirement.id}
                  batchStart={nextLockedBatch.start}
                  batchEnd={nextLockedBatch.end}
                  onUnlocked={handleBatchUnlocked}
                />
              )}
              {!readOnly && selectedIds.size >= 2 && (
                <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "10px 16px" }}>
                  <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>
                    {selectedIds.size} candidate{selectedIds.size === 1 ? "" : "s"} selected
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <Button type="button" variant="link" onClick={() => setSelectedIds(new Set())} style={{ fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, height: "auto", padding: 0 }}>
                      Clear selection
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => setBulkRejectOpen(true)}>
                      Reject selected
                    </Button>
                    {selectedIds.size === 2 && (
                      <Link
                        href={`/employer/requirements/${requirement.id}/compare?a=${Array.from(selectedIds)[0]}&b=${Array.from(selectedIds)[1]}`}
                        style={{ textDecoration: "none" }}
                      >
                        <PrimaryCta size="sm">Compare selected candidates</PrimaryCta>
                      </Link>
                    )}
                  </div>
                </Card>
              )}

              <Dialog open={bulkRejectOpen} onOpenChange={(open) => { if (!bulkRejectSubmitting) setBulkRejectOpen(open); }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reject {selectedIds.size} candidate{selectedIds.size === 1 ? "" : "s"}?</DialogTitle>
                    <DialogDescription>
                      Marks the selected candidates as rejected for {requirement.title}. Candidates already marked hired are skipped. This can&apos;t be undone from here.
                    </DialogDescription>
                  </DialogHeader>
                  <div style={{ display: "grid", gap: 8, padding: "4px 0" }}>
                    <Label htmlFor="bulk-reject-note">Reason (optional, applied to all)</Label>
                    <Textarea
                      id="bulk-reject-note"
                      rows={3}
                      value={bulkRejectNote}
                      onChange={(e) => setBulkRejectNote(e.target.value)}
                      placeholder="Anything you want on record about this decision…"
                    />
                  </div>
                  <DialogFooter>
                    <OutlineCta onClick={() => setBulkRejectOpen(false)}>Cancel</OutlineCta>
                    <Button type="button" variant="destructive" onClick={handleBulkReject} disabled={bulkRejectSubmitting}>
                      {bulkRejectSubmitting ? "Rejecting…" : "Reject candidates"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
                <SearchWithSuggestions
                  id="candidates-search"
                  label="Search candidates"
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by name, role, skill, or notice period…"
                  storageKey={CANDIDATES_RECENT_SEARCHES_KEY}
                  suggestedFilters={suggestedFilters}
                  style={{ flex: "1 1 220px", minWidth: 200, maxWidth: 420 }}
                  inputStyle={{ background: t.white }}
                  inputClassName="focus-visible:ring-0"
                />
                <FilterPill label="Contact" value={contactFilter} options={contactFilterOptions} onChange={setContactFilter} />
                {locationOptions.length > 1 && (
                  <FilterPill
                    label="Location"
                    value={locationFilter}
                    options={[{ value: "all", label: "All locations" }, ...locationOptions.map((loc) => ({ value: loc, label: loc }))]}
                    onChange={setLocationFilter}
                  />
                )}
                {(search.trim() !== "" || contactFilter !== "all" || locationFilter !== "all") && (
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => { setSearch(""); setContactFilter("all"); setLocationFilter("all"); }}
                    style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, height: "auto" }}
                  >
                    Clear filters
                  </Button>
                )}
              </div>

              {filteredSorted.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 48 }}>
                  <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0 }}>
                    No candidates match your search or filters.
                  </p>
                </Card>
              ) : (
                <Card pad={0} style={{ overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <Table style={{ minWidth: 1120 }}>
                      <TableHeader style={{ position: "sticky", top: 0, zIndex: 1 }}>
                        <TableRow style={{ background: t.rowTint, height: 40 }}>
                          {!readOnly && <TableHead style={{ width: 32 }}></TableHead>}
                          <SortableHead column="name" columnLabel={COLUMN_LABEL.name} defaultDirection="asc" width="26%" minWidth={240} sort={sort} onSortChange={setSort}>Candidate</SortableHead>
                          <SortableHead column="match" columnLabel={COLUMN_LABEL.match} width="7%" minWidth={80} sort={sort} onSortChange={setSort}>Match</SortableHead>
                          <SortableHead column="sessions" columnLabel={COLUMN_LABEL.sessions} width="13%" minWidth={150} sort={sort} onSortChange={setSort}>Practice history</SortableHead>
                          <TableHead style={{ ...HEADER_CELL_STYLE, width: "9%", minWidth: 110 }}>Notice period</TableHead>
                          <TableHead style={{ ...HEADER_CELL_STYLE, width: "10%", minWidth: 120 }}>Current CTC</TableHead>
                          <TableHead style={{ ...HEADER_CELL_STYLE, width: "17%", minWidth: 190 }}>Skills</TableHead>
                          <SortableHead column="pipeline" columnLabel={COLUMN_LABEL.pipeline} defaultDirection="asc" width="10%" minWidth={140} sort={sort} onSortChange={setSort}>Pipeline</SortableHead>
                          <SortableHead column="contact" columnLabel={COLUMN_LABEL.contact} width="8%" minWidth={170} sort={sort} onSortChange={setSort}>Contact</SortableHead>
                          <TableHead style={{ ...HEADER_CELL_STYLE, width: 48 }}></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageRows.map((c) => (
                          <CandidateTableRow
                            key={c.id}
                            candidate={c}
                            requirementId={requirement.id}
                            readOnly={readOnly}
                            selected={selectedIds.has(c.id)}
                            onToggleSelected={() => toggleSelected(c.id)}
                            onUnlocked={handleUnlocked}
                            onViewEvidence={() => setEvidenceMatchId(c.id)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePaginationFooter
                    entityLabel="candidate"
                    entityLabelPlural="candidates"
                    totalCount={requirement.candidates.length}
                    filteredCount={filteredSorted.length}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={setRowsPerPage}
                    page={pageSafe}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </Card>
              )}
              <EvidenceDialog matchId={evidenceMatchId} onClose={() => setEvidenceMatchId(null)} />
            </>
          )}
        </>
      </div>
    </div>
  );
}
