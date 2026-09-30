"use client";

import { useState, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronDownIcon, LockIcon, RefreshCwIcon, AlertTriangleIcon, ClockIcon, BuildingIcon } from "lucide-react";
import { useEmployerData, Requirement } from "@/employer/EmployerDataContext";
import { useToast } from "@/Toast";
import { Candidate, RequirementStage } from "@/employer/mockData";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import LoadingScreen from "@/_LoadingScreen";
import { STRONG_MATCH_THRESHOLD } from "../../../../../server-handlers/_requirement-match-helpers";
import { UNLOCK_BUNDLE_SIZE } from "../../../../../server-handlers/_unlock-pricing";
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
  StatCell,
  StatusChip,
  StageCell,
  STAGE_LABEL,
} from "@/employer/_atoms";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

function experienceLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} yrs experience`;
  if (min != null) return `${min}+ yrs experience`;
  return `Up to ${max} yrs experience`;
}

function daysUntil(dueDate: string): number {
  return Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

// Real match-score tiers (mirrors the >=85 / >=70 thresholds ScoreChip already
// uses) standing in for the reference layout's interview-round pipeline —
// HireStepX has no interview-round data, but this is the closest genuine
// equivalent: how many shared candidates land in each match-quality band.
const scoreTiers: Array<{ key: string; label: string; min: number; max: number }> = [
  { key: "strong", label: "Strong match", min: STRONG_MATCH_THRESHOLD, max: 101 },
  { key: "good", label: "Good match", min: 70, max: STRONG_MATCH_THRESHOLD },
  { key: "fair", label: "Fair match", min: 50, max: 70 },
  { key: "low", label: "Low match", min: 0, max: 50 },
];

const tierColors: Record<string, string> = {
  strong: t.success,
  good: t.indigo,
  fair: t.warning,
  low: t.inkFaintWeak,
};

/** Tooltip copy per pipeline stage — mirrors the "why is this stage here"
    hint the canvas surfaces next to the stage badge. */
const STAGE_HINT: Record<RequirementStage, string> = {
  ai_matching: "The AI is still scoring the practicing pool against this posting.",
  ready_for_review: "Candidates have been scored — review the shortlist and unlock the ones worth contacting.",
  interviewing: "You're actively interviewing candidates from this shortlist.",
  hired: "This posting resulted in a hire.",
};

const td: CSSProperties = {
  fontFamily: f.sans,
  fontSize: 13.5,
  color: t.coal,
  verticalAlign: "top",
};

type ContactFilter = "all" | "locked" | "unlocked";
type SortKey = "match" | "recent";

const contactFilterOptions: Array<{ value: ContactFilter; label: string }> = [
  { value: "all", label: "All candidates" },
  { value: "unlocked", label: "Unlocked" },
  { value: "locked", label: "Locked" },
];

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: "match", label: "Best match" },
  { value: "recent", label: "Most recently active" },
];

/** Dropdown-backed filter pill — mirrors FilterPill on /employer/jobs so the
    two candidate-facing tables in the console share one filter language. */
function FilterMenu<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: Array<{ value: V; label: string }>;
  onChange: (value: V) => void;
}) {
  const active = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" style={{ borderRadius: 8, height: 40, gap: 8, background: t.white, fontFamily: f.sans, fontSize: 13, fontWeight: 500 }}>
          {active ? `${label}: ${active.label}` : label}
          <ChevronDownIcon size={12} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as V)}>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
        {unlocked ? initials(name) : "?"}
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

function CandidateTableRow({
  candidate,
  requirementId,
  readOnly,
  selected,
  onToggleSelected,
  onUnlocked,
}: {
  candidate: Candidate;
  requirementId: string;
  readOnly: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onUnlocked: (candidateId: string, name: string, email: string) => void;
}) {
  const { createUnlockOrder, verifyUnlockPayment } = useEmployerData();
  const { toast } = useToast();
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
    <TableRow>
      {!readOnly && (
        <TableCell style={{ width: 32 }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            title="Select candidate"
            aria-label={`Select ${candidate.unlocked ? candidate.name : `candidate #${candidate.id.slice(0, 6)}`}`}
            style={{ width: 16, height: 16 }}
          />
        </TableCell>
      )}
      <TableCell style={td}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <CandidateAvatar name={candidate.name} unlocked={candidate.unlocked} />
          <div>
            <Link
              href={`/employer/requirements/${requirementId}/candidates/${candidate.id}`}
              style={{ fontWeight: 700, fontSize: 14, color: t.coal, textDecoration: "none" }}
              onMouseOver={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
              onMouseOut={(e) => { e.currentTarget.style.textDecoration = "none"; }}
            >
              {candidate.unlocked ? candidate.name : `Candidate #${candidate.id.slice(0, 6)}`}
            </Link>
            <div style={{ fontSize: 12.5, color: t.inkFaint, marginTop: 2 }}>
              {candidate.targetRole} · {candidate.city}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell style={td}>
        <ScoreChip score={candidate.matchScore} />
      </TableCell>
      <TableCell style={{ ...td, color: t.inkSoft }}>
        {candidate.rosterScore} roster · {candidate.sessionsCompleted} sessions
      </TableCell>
      <TableCell style={{ ...td, color: t.inkSoft }}>
        {candidate.lastActiveDaysAgo < 0 ? "—" : `${candidate.lastActiveDaysAgo}d ago`}
      </TableCell>
      <TableCell style={{ ...td, color: t.inkSoft }}>
        {candidate.resume?.noticePeriod || <span style={{ color: t.inkFaint }}>—</span>}
      </TableCell>
      <TableCell style={{ ...td, color: t.inkSoft }}>
        {candidate.resume?.currentCtc ? (
          <>
            {candidate.resume.currentCtc}
            <div style={{ fontFamily: f.sans, fontSize: 10.5, color: t.inkFaint, marginTop: 2 }}>self-reported</div>
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
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, alignSelf: "center" }}>
                +{candidate.skills.length - 3}
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: t.inkFaint }}>—</span>
        )}
      </TableCell>
      <TableCell style={td}>
        <Pill tone={candidate.unlocked ? "success" : "neutral"}>{candidate.unlocked ? "Unlocked" : "Locked"}</Pill>
      </TableCell>
      <TableCell style={td}>
        <CandidateStatusChip status={candidate.candidateStatus} />
      </TableCell>
      <TableCell style={{ ...td, minWidth: 200 }}>
        {candidate.unlocked ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
            <span style={{ fontFamily: f.sans, fontSize: 12.5, color: t.coal }}>{candidate.contact?.email}</span>
            {!readOnly && (
              <Link href={`/employer/requirements/${requirementId}/outcome?candidate=${candidate.id}`} style={{ textDecoration: "none" }}>
                <OutlineCta size="sm">How did it go?</OutlineCta>
              </Link>
            )}
          </div>
        ) : readOnly ? (
          <HelpText>Unlocking closed</HelpText>
        ) : confirming ? (
          <div style={{ background: t.creamSoft, borderRadius: 10, padding: 10 }}>
            <div style={{ fontFamily: f.sans, fontSize: 12.5, color: t.coal, marginBottom: 8 }}>
              Unlock for <strong>{displayPrice}</strong>?
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <PrimaryCta size="sm" onClick={handleConfirmUnlock} disabled={unlocking}>
                {unlocking ? "Unlocking…" : "Confirm"}
              </PrimaryCta>
              <OutlineCta size="sm" onClick={() => setConfirming(false)}>Cancel</OutlineCta>
            </div>
          </div>
        ) : (
          <PrimaryCta size="sm" icon={<LockIcon size={13} aria-hidden="true" />} onClick={() => setConfirming(true)}>
            Unlock — {displayPrice}
          </PrimaryCta>
        )}
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

export default function RequirementDetailPage() {
  const params = useParams<{ id: string }>();
  const { fetchRequirementDetail, updateRequirement, updateRequirementStage, updateCandidateStatus } = useEmployerData();
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
  const [activeTab, setActiveTab] = useState<"candidates" | "description">("candidates");
  const [search, setSearch] = useState("");
  const [contactFilter, setContactFilter] = useState<ContactFilter>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("match");
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDate, setExtendDate] = useState("");
  const [extendSaving, setExtendSaving] = useState(false);

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

  const filteredSorted = useMemo(() => {
    const candidates = requirement?.candidates ?? [];
    const q = search.trim().toLowerCase();
    const filtered = candidates.filter((c) => {
      if (contactFilter === "locked" && c.unlocked) return false;
      if (contactFilter === "unlocked" && !c.unlocked) return false;
      if (locationFilter !== "all" && c.city !== locationFilter) return false;
      if (!q) return true;
      const haystack = [c.unlocked ? c.name : "", c.targetRole, c.city, c.resume?.noticePeriod || "", ...c.skills].join(" ").toLowerCase();
      return haystack.includes(q);
    });
    const recency = (c: Candidate) => (c.lastActiveDaysAgo < 0 ? Number.POSITIVE_INFINITY : c.lastActiveDaysAgo);
    return filtered.sort((a, b) => (sortKey === "match" ? b.matchScore - a.matchScore : recency(a) - recency(b)));
  }, [requirement, search, contactFilter, locationFilter, sortKey]);

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
    }
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
    results.forEach((result, i) => {
      const ok = result.status === "fulfilled" && result.value;
      if (ok) {
        succeeded += 1;
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
    } else if (succeeded === 0) {
      toast(`Couldn't reject any candidates — please try again${skippedSuffix}`, "error");
    } else {
      toast(`${succeeded} rejected, ${failed} failed — try again${skippedSuffix}`, "error");
    }
  };

  const openExtendDeadline = () => {
    setExtendDate(requirement.dueDate || "");
    setExtendOpen(true);
  };

  const handleExtendDeadline = async () => {
    if (!extendDate) return;
    setExtendSaving(true);
    const ok = await updateRequirement(requirement.id, {
      title: requirement.title,
      locations: requirement.locations.length > 0 ? requirement.locations : [requirement.location],
      noticePeriodPref: requirement.noticePeriodPref,
      description: requirement.description,
      experienceMin: requirement.experienceMin ?? undefined,
      experienceMax: requirement.experienceMax ?? undefined,
      dueDate: extendDate,
      budgetMin: requirement.budgetMin ?? undefined,
      budgetMax: requirement.budgetMax ?? undefined,
      openPositions: requirement.openPositions ?? undefined,
      workMode: requirement.workMode ?? undefined,
      employmentType: requirement.employmentType ?? undefined,
      skills: requirement.skills,
      responsibilities: requirement.responsibilities,
      niceToHave: requirement.niceToHave,
      preferredIndustry: requirement.preferredIndustry,
      preferredColleges: requirement.preferredColleges,
      targetCompanies: requirement.targetCompanies,
      perksAndBenefits: requirement.perksAndBenefits,
    });
    setExtendSaving(false);
    if (ok) {
      toast("Deadline updated — re-matching candidates", "success");
      setExtendOpen(false);
      load();
    } else {
      toast("Couldn't update the deadline — please try again", "error");
    }
  };

  const readOnly = requirement.status === "closed";
  const unlockedCount = requirement.candidates.filter((c) => c.unlocked).length;
  const avgMatch = requirement.candidates.length
    ? Math.round(requirement.candidates.reduce((sum, c) => sum + c.matchScore, 0) / requirement.candidates.length)
    : 0;
  const expLabel = experienceLabel(requirement.experienceMin, requirement.experienceMax);
  const dueDaysLeft = requirement.dueDate ? daysUntil(requirement.dueDate) : null;
  const tierCounts = scoreTiers.map((tier) => ({
    ...tier,
    count: requirement.candidates.filter((c) => c.matchScore >= tier.min && c.matchScore < tier.max).length,
  }));
  const hasCandidates = requirement.candidates.length > 0 && requirement.status !== "generating";

  return (
    <div>
      {/* Mirrors the back-link on the candidate-detail page so both detail
          surfaces share one breadcrumb language instead of a one-off pattern. */}
      <Link
        href="/employer/jobs"
        style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12.5, fontWeight: 600, color: t.inkSoft, textDecoration: "none", marginBottom: 16 }}
      >
        <ChevronDownIcon size={14} style={{ transform: "rotate(90deg)" }} aria-hidden="true" />
        Jobs
      </Link>

      <Card>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <Eyebrow tone="indigo">
              {(requirement.locations.length > 0 ? requirement.locations.join(", ") : requirement.location)} · {requirement.noticePeriodPref} notice
            </Eyebrow>
            <h1 style={{ fontFamily: f.sans, fontSize: 28, color: t.coal, margin: "6px 0 0" }}>{requirement.title}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {requirement.status !== "closed" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openExtendDeadline}
                  style={{
                    fontFamily: f.sans,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: t.indigo,
                    background: "none",
                    border: `1px solid ${t.line}`,
                    borderRadius: 8,
                    padding: "6px 12px",
                    height: "auto",
                  }}
                >
                  Extend deadline
                </Button>
                <Link
                  href={`/employer/requirements/${requirement.id}/edit`}
                  style={{
                    fontFamily: f.sans,
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: t.indigo,
                    textDecoration: "none",
                    border: `1px solid ${t.line}`,
                    borderRadius: 8,
                    padding: "6px 12px",
                  }}
                >
                  Edit
                </Link>
              </>
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
            <StatusChip status={requirement.status} />
          </div>
        </div>

        <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Extend deadline</DialogTitle>
              <DialogDescription>
                Pick a new due date for &ldquo;{requirement.title}&rdquo;. Candidates will be re-scored once it&apos;s saved.
              </DialogDescription>
            </DialogHeader>
            <div style={{ display: "grid", gap: 8, padding: "4px 0" }}>
              <Label htmlFor="extend-due-date">New due date</Label>
              <Input
                id="extend-due-date"
                type="date"
                value={extendDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setExtendDate(e.target.value)}
              />
            </div>
            <DialogFooter>
              <OutlineCta onClick={() => setExtendOpen(false)}>Cancel</OutlineCta>
              <PrimaryCta onClick={handleExtendDeadline} disabled={!extendDate || extendSaving}>
                {extendSaving ? "Saving…" : "Save new deadline"}
              </PrimaryCta>
            </DialogFooter>
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
          {expLabel && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>
              <ClockIcon size={13} aria-hidden="true" /> {expLabel}
            </span>
          )}
          {dueDaysLeft != null && (
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>
              <ClockIcon size={13} aria-hidden="true" /> {dueDaysLeft < 0 ? `${Math.abs(dueDaysLeft)}d overdue` : dueDaysLeft === 0 ? "Due today" : `${dueDaysLeft}d until due`}
            </span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>
            <BuildingIcon size={13} aria-hidden="true" /> Posted {requirement.createdAt}
          </span>
        </div>

        {hasCandidates ? (
          <>
            <div style={{ display: "flex", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
              <StatCell label="Candidates shared" value={String(requirement.candidates.length)} unit="" />
              <StatCell label="Contacts unlocked" value={String(unlockedCount)} unit="" />
              <StatCell label="Avg match score" value={String(avgMatch)} unit="/ 100" />
            </div>

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
              <div style={{ display: "flex", height: 6, borderRadius: 999, overflow: "hidden", background: t.line }}>
                {tierCounts.map((tier) => (
                  tier.count > 0 && (
                    <Tooltip key={tier.key}>
                      <TooltipTrigger asChild>
                        <div style={{ width: `${(tier.count / requirement.candidates.length) * 100}%`, background: tierColors[tier.key] }} />
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{tier.label} · {tier.count}</TooltipContent>
                    </Tooltip>
                  )
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
                {tierCounts.map((tier) => (
                  <span key={tier.key} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: 12.5, color: t.inkFaint }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: tierColors[tier.key], flexShrink: 0 }} />
                    {tier.count} {tier.label.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
            <HelpText>
              {requirement.status === "generating" ? "Scoring candidates…" : "No candidates shared yet."}
            </HelpText>
          </div>
        )}
      </Card>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "candidates" | "description")} style={{ margin: "20px 0 16px" }}>
        <TabsList variant="line" className="border-b" style={{ borderColor: t.line, width: "100%", justifyContent: "flex-start", gap: 24 }}>
          <TabsTrigger value="candidates" style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600 }}>Candidates</TabsTrigger>
          <TabsTrigger value="description" style={{ fontFamily: f.sans, fontSize: 13.5, fontWeight: 600 }}>Job Description</TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "description" && (
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
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Status</div>
              <div style={{ marginTop: 4 }}><StatusChip status={requirement.status} /></div>
            </div>
            <div>
              <div style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", color: t.inkFaint }}>Pipeline stage</div>
              <div style={{ marginTop: 4, fontFamily: f.sans, fontSize: 13.5, color: t.coal }}>{STAGE_LABEL[requirement.stage]}</div>
            </div>
          </div>

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
      )}

      {activeTab === "candidates" && (
        <>
          {requirement.status === "generating" && <GeneratingState />}
          {requirement.status === "failed" && <FailedState />}
          {requirement.status === "zero" && <ZeroMatchState />}

          {(requirement.status === "ready" || requirement.status === "partial" || requirement.status === "closed") && (
            <>
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
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, role, skill, or notice period…"
                  style={{ flex: "1 1 220px", minWidth: 200, height: 40 }}
                  aria-label="Search candidates"
                />
                <FilterMenu label="Contact" value={contactFilter} options={contactFilterOptions} onChange={setContactFilter} />
                {locationOptions.length > 1 && (
                  <FilterMenu
                    label="Location"
                    value={locationFilter}
                    options={[{ value: "all", label: "All locations" }, ...locationOptions.map((loc) => ({ value: loc, label: loc }))]}
                    onChange={setLocationFilter}
                  />
                )}
                <FilterMenu label="Sort" value={sortKey} options={sortOptions} onChange={setSortKey} />
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
                      <TableHeader>
                        <TableRow>
                          {!readOnly && <TableHead></TableHead>}
                          <TableHead>Candidate</TableHead>
                          <TableHead>Match</TableHead>
                          <TableHead>Practice history</TableHead>
                          <TableHead>Last active</TableHead>
                          <TableHead>Notice period</TableHead>
                          <TableHead>Current CTC</TableHead>
                          <TableHead>Skills</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pipeline</TableHead>
                          <TableHead>Contact</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSorted.map((c) => (
                          <CandidateTableRow
                            key={c.id}
                            candidate={c}
                            requirementId={requirement.id}
                            readOnly={readOnly}
                            selected={selectedIds.has(c.id)}
                            onToggleSelected={() => toggleSelected(c.id)}
                            onUnlocked={handleUnlocked}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
