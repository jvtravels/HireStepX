"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArchiveIcon,
  BriefcaseIcon,
  Building2Icon,
  BuildingIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  FolderIcon,
  GraduationCapIcon,
  HistoryIcon,
  IndianRupeeIcon,
  InfoIcon,
  LayoutGridIcon,
  MapPinIcon,
  MoreVerticalIcon,
  PencilIcon,
  RefreshCwIcon,
} from "lucide-react";
import { tokens as t, fonts as f, textSize } from "@/auth/_tokens";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, HelpText, OutlineCta, Pill, SkillTag, STAGE_LABEL, StageCell } from "@/employer/_atoms";
import { useEmployerData, type Requirement, type UnlockPurchase } from "@/employer/EmployerDataContext";
import type { ArchiveDisposition, RequirementStage } from "@/employer/mockData";
import { InlineNotice } from "@/employer/_requirementAtoms";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/hiringMatchFormat";
import type { PipelineFilter } from "./candidateTableModel";
import { budgetLabel, dueLabel, experienceLabel, STAGE_HINT, timeAgoLabel } from "./requirementFormat";

const DESCRIPTION_TRUNCATE_LENGTH = 220;

/** Focusable explanation trigger. A bare icon in a span is invisible to
    keyboard and touch users, so this is a real button. */
function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-flex items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:size-11"
          style={{ color: t.inkFaint, background: "transparent", border: "none", cursor: "pointer", padding: 4, outlineColor: t.indigo }}
        >
          <InfoIcon size={12} aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

const metaChipStyle = { display: "inline-flex", alignItems: "center", gap: 6 } as const;

const REQ_HEADER_CSS = `
.rq-pipe-btn:hover { text-decoration: underline; }
.rq-pipe-btn:focus-visible { outline: 2px solid ${t.indigo}; outline-offset: 2px; border-radius: 4px; }
@media (pointer: coarse) { .rq-pipe-btn { min-height: 44px; } }
.rq-head-card { container-type: inline-size; }
.rq-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: start; }
.rq-head-actions { display: flex; align-items: center; gap: 10px; min-height: 34px; }
@container (max-width: 560px) {
  .rq-head { grid-template-columns: minmax(0, 1fr); }
}
`;

function formatPrice(paise: number): string {
  return paise === 0 ? "Complimentary" : `₹${(paise / 100).toFixed(0)}`;
}

function UnlockHistoryDialog({
  open,
  onOpenChange,
  requirement,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: Requirement;
}) {
  const { fetchUnlockHistory } = useEmployerData();
  const [purchases, setPurchases] = useState<UnlockPurchase[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = () => {
    setLoading(true);
    setFailed(false);
    fetchUnlockHistory().then((res) => {
      if (res == null) setFailed(true);
      else setPurchases(res);
      setLoading(false);
    });
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (next && purchases == null && !loading) load();
  };

  const ids = new Set(requirement.candidates.map((c) => c.id));
  const relevant = (purchases ?? []).filter((p) => p.matchIds.some((id) => ids.has(id)));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unlock history</DialogTitle>
          <DialogDescription>Every contact unlock purchased against this requirement.</DialogDescription>
        </DialogHeader>
        <div aria-live="polite" aria-busy={loading}>
          {loading ? (
            <div style={{ display: "grid", gap: 10 }}>
              <span className="sr-only">Loading purchase history</span>
              <Skeleton style={{ height: 36 }} />
              <Skeleton style={{ height: 36 }} />
              <Skeleton style={{ height: 36 }} />
            </div>
          ) : failed ? (
            <InlineNotice
              tone="error"
              title="Couldn't load your purchase history"
              action={<OutlineCta size="sm" onClick={load}>Try again</OutlineCta>}
            >
              Check your connection and try again.
            </InlineNotice>
          ) : relevant.length === 0 ? (
            <HelpText>No unlocks purchased for this requirement yet.</HelpText>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", maxHeight: 320, overflowY: "auto" }}>
              {relevant.map((p) => {
                const names = (p.candidates || []).map((c) => c.name).filter((n): n is string => !!n);
                const label = names.length > 0 ? names.join(", ") : p.matchIds.length > 1 ? `Batch of ${p.matchIds.length}` : "Single candidate";
                return (
                  <li
                    key={p.id}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "8px 0", borderBottom: `1px solid ${t.line}` }}
                  >
                    <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.coal, minWidth: 0, overflowWrap: "anywhere" }}>{label}</span>
                    <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>
                      {formatPrice(p.amount)} · {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArchiveDialog({
  open,
  onOpenChange,
  requirement,
  onArchived,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: Requirement;
  onArchived: () => void;
}) {
  const { archiveRequirement } = useEmployerData();
  const [reason, setReason] = useState("");
  const [disposition, setDisposition] = useState<ArchiveDisposition>("keep_candidates");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const ok = await archiveRequirement(requirement.id, { archiveReason: reason.trim() || undefined, archiveDisposition: disposition });
    setSaving(false);
    if (!ok) {
      setError("Couldn't archive this requirement. Check your connection and try again. If your account is suspended, archiving is turned off.");
      return;
    }
    setReason("");
    onOpenChange(false);
    onArchived();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archive &ldquo;{requirement.title}&rdquo;?</DialogTitle>
          <DialogDescription>
            Closes the posting to new unlocks. Candidates already unlocked stay unlocked. This only affects new activity.
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: "grid", gap: 14, padding: "4px 0" }}>
          <div style={{ display: "grid", gap: 8 }}>
            <Label htmlFor="archive-reason">Reason (optional)</Label>
            <Textarea id="archive-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Role filled, put on hold, etc." />
          </div>
          <div role="group" aria-labelledby="archive-disposition-label" style={{ display: "grid", gap: 8 }}>
            <Label id="archive-disposition-label">Candidates still in the pipeline</Label>
            <RadioGroup value={disposition} onValueChange={(v) => setDisposition(v as ArchiveDisposition)}>
              <div className="pointer-coarse:min-h-11" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RadioGroupItem value="keep_candidates" id="archive-keep" />
                <Label htmlFor="archive-keep" style={{ fontWeight: 400 }}>Leave their status as is</Label>
              </div>
              <div className="pointer-coarse:min-h-11" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RadioGroupItem value="reject_remaining" id="archive-reject" />
                <Label htmlFor="archive-reject" style={{ fontWeight: 400 }}>Reject everyone still in the pipeline</Label>
              </div>
            </RadioGroup>
            {disposition === "reject_remaining" && (
              <HelpText>Rejected candidates can&apos;t be moved back into the pipeline.</HelpText>
            )}
          </div>
          {error && <InlineNotice tone="error">{error}</InlineNotice>}
        </div>
        <DialogFooter>
          <OutlineCta onClick={() => onOpenChange(false)} disabled={saving}>Cancel</OutlineCta>
          <Button type="button" variant="destructive" onClick={submit} disabled={saving} className="pointer-coarse:h-11">
            {saving ? "Archiving…" : "Archive requirement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RequirementHeader({
  requirement,
  suspended,
  pipelineFilter,
  onPipelineFilterChange,
  onPatch,
  onReload,
}: {
  requirement: Requirement;
  suspended: boolean;
  pipelineFilter: PipelineFilter;
  onPipelineFilterChange: (next: PipelineFilter) => void;
  onPatch: (patch: Partial<Requirement>) => void;
  onReload: () => void;
}) {
  const { updateRequirementStage, reopenRequirement } = useEmployerData();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [reopenSaving, setReopenSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const closed = requirement.status === "closed";
  const readOnly = closed || suspended;
  const candidates = requirement.candidates;

  const handleStageChange = async (stage: RequirementStage) => {
    const previous = requirement.stage;
    setMessage(null);
    onPatch({ stage });
    const ok = await updateRequirementStage(requirement.id, stage);
    if (!ok) {
      onPatch({ stage: previous });
      setMessage({ tone: "error", text: "Couldn't update the stage. Nothing was changed, so please try again." });
      return;
    }
    setMessage({ tone: "success", text: `Stage changed to ${STAGE_LABEL[stage]}.` });
  };

  const handleReopen = async () => {
    setReopenSaving(true);
    setMessage(null);
    const ok = await reopenRequirement(requirement.id);
    setReopenSaving(false);
    if (!ok) {
      setMessage({ tone: "error", text: "Couldn't reopen this requirement. Please try again." });
      return;
    }
    setMessage({ tone: "success", text: "Requirement reopened. Re-matching candidates now." });
    onReload();
  };

  const avgMatch = candidates.length ? Math.round(candidates.reduce((sum, c) => sum + c.matchScore, 0) / candidates.length) : 0;
  const scoreLow = candidates.length ? Math.min(...candidates.map((c) => c.matchScore)) : 0;
  const scoreHigh = candidates.length ? Math.max(...candidates.map((c) => c.matchScore)) : 0;
  const evidenceTier = avgMatch >= 90 ? "Strong signal" : avgMatch >= 75 ? "Solid signal" : "Mixed signal";
  const expLabel = experienceLabel(requirement.experienceMin, requirement.experienceMax);
  const due = requirement.dueDate ? dueLabel(requirement.dueDate) : null;
  const hasCandidates = candidates.length > 0 && requirement.status !== "generating";
  const budget = budgetLabel(requirement);
  const jobType = requirement.employmentType ? EMPLOYMENT_TYPE_LABEL[requirement.employmentType] || requirement.employmentType : null;
  const workModeLabel = requirement.workMode ? WORK_MODE_LABEL[requirement.workMode] || requirement.workMode : null;
  const interviewingCount = candidates.filter((c) => c.candidateStatus === "interview_invited" || c.candidateStatus === "interviewing").length;
  const hiredCount = candidates.filter((c) => c.candidateStatus === "hired").length;
  // totalMatched is the pre-cap pool size; once it exceeds the candidates we
  // show, "N evaluated" would understate the pool, so it reads "Top N (of M matched)".
  const totalMatched = Math.max(requirement.totalMatched ?? 0, candidates.length);
  const evaluatedCapped = totalMatched > candidates.length;

  const stages: Array<{ kind: "evaluated" | "interviewing" | "hired"; label: string; value: string; filter: PipelineFilter; aria: string }> = [
    {
      kind: "evaluated",
      label: evaluatedCapped ? `(of ${totalMatched} matched)` : "evaluated",
      value: evaluatedCapped ? `Top ${candidates.length}` : String(candidates.length),
      filter: "all",
      aria: "Show all candidates",
    },
    { kind: "interviewing", label: "interviewing", value: String(interviewingCount), filter: "interviewing", aria: "Filter to candidates being interviewed" },
    { kind: "hired", label: "hired", value: String(hiredCount), filter: "hired", aria: "Filter to hired candidates" },
  ];

  const description = requirement.description ?? "";
  const longDescription = description.length > DESCRIPTION_TRUNCATE_LENGTH;
  const locationText = requirement.locations.length > 0 ? requirement.locations.join(", ") : requirement.location;

  const prefs = [
    { Icon: Building2Icon, label: "Industry", value: requirement.preferredIndustry || "Not specified" },
    { Icon: LayoutGridIcon, label: "Domain", value: requirement.preferredDomain || "Not specified" },
    { Icon: CalendarIcon, label: "Availability", value: requirement.availability || "Not specified" },
  ];

  return (
    <>
      <style>{REQ_HEADER_CSS}</style>
      <div style={{ display: "flex", alignItems: "stretch", gap: 16, flexWrap: "wrap" }}>
        <Card aria-label="Requirement summary" className="rq-head-card" style={{ flex: "3 1 min(560px, 100%)", minWidth: 0, boxShadow: "none" }}>
          <div className="rq-head">
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <div
                aria-hidden="true"
                style={{ width: 48, height: 48, borderRadius: 12, background: t.indigo100, color: t.indigo, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <BriefcaseIcon size={22} />
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ overflowWrap: "anywhere", fontFamily: f.sans, fontSize: "clamp(22px, 6vw, 28px)", fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.2, color: t.coal, margin: 0 }}>
                  {requirement.title}
                </h1>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4, marginTop: 8, fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>
                  {budget && (
                    <span style={metaChipStyle}>
                      <IndianRupeeIcon size={14} color={t.inkFaint} aria-hidden="true" /> {budget}
                    </span>
                  )}
                  <span style={metaChipStyle}>
                    <MapPinIcon size={14} color={t.inkFaint} aria-hidden="true" />
                    {locationText}
                    {workModeLabel ? ` · ${workModeLabel}` : ""}
                  </span>
                  {expLabel && (
                    <span style={metaChipStyle}>
                      <GraduationCapIcon size={14} color={t.inkFaint} aria-hidden="true" /> {expLabel}
                    </span>
                  )}
                  {(jobType || requirement.durationWeeks != null || requirement.hoursPerWeek != null) && (
                    <span style={metaChipStyle}>
                      <ClockIcon size={14} color={t.inkFaint} aria-hidden="true" />
                      {[
                        jobType,
                        requirement.durationWeeks != null ? `${requirement.durationWeeks} ${requirement.durationWeeks === 1 ? "week" : "weeks"}` : null,
                        requirement.hoursPerWeek != null ? `${requirement.hoursPerWeek} hrs/week` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="rq-head-actions">
              {closed && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReopen}
                  disabled={reopenSaving || suspended}
                  className="pointer-coarse:h-11"
                  style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600 }}
                >
                  {reopenSaving ? "Reopening…" : "Reopen"}
                </Button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <StageCell stage={requirement.stage} hasEvaluatedCandidates={candidates.length > 0} onChange={handleStageChange} frozen={readOnly} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-64">
                  {suspended ? "Stage changes are turned off while your account is suspended." : STAGE_HINT[requirement.stage]}
                </TooltipContent>
              </Tooltip>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Actions for ${requirement.title}`}
                    className="pointer-coarse:size-11"
                    style={{ width: 36, height: 36, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", color: t.inkFaint }}
                  >
                    <MoreVerticalIcon size={16} aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {!closed &&
                    (suspended ? (
                      <DropdownMenuItem disabled>
                        <PencilIcon size={14} aria-hidden="true" /> Edit
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem asChild>
                        <Link href={`/employer/requirements/${requirement.id}/edit`}>
                          <PencilIcon size={14} aria-hidden="true" /> Edit
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  <DropdownMenuItem onSelect={() => setHistoryOpen(true)}>
                    <HistoryIcon size={14} aria-hidden="true" /> Unlock history
                  </DropdownMenuItem>
                  {!closed && (
                    <DropdownMenuItem
                      disabled={suspended}
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

          {message && (
            <div style={{ marginTop: 12 }}>
              <InlineNotice tone={message.tone}>{message.text}</InlineNotice>
            </div>
          )}

          <ArchiveDialog open={archiveOpen} onOpenChange={setArchiveOpen} requirement={requirement} onArchived={onReload} />
          <UnlockHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} requirement={requirement} />

          {description && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
              <p style={{ fontFamily: f.sans, fontSize: textSize.md, color: t.inkSoft, lineHeight: 1.6, margin: 0, overflowWrap: "anywhere" }}>
                {descExpanded || !longDescription ? description : `${description.slice(0, DESCRIPTION_TRUNCATE_LENGTH).trimEnd()}…`}
                {longDescription && (
                  <>
                    {" "}
                    <Button
                      type="button"
                      variant="link"
                      aria-expanded={descExpanded}
                      onClick={() => setDescExpanded((v) => !v)}
                      className="pointer-coarse:min-h-11"
                      style={{ padding: 0, fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, height: "auto", display: "inline" }}
                    >
                      {descExpanded ? "Show less" : "Read more"}
                    </Button>
                  </>
                )}
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
            {due && (
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: textSize.base, color: due.overdue ? t.errorInk : t.inkFaint, fontWeight: due.overdue ? 600 : 400 }}>
                <ClockIcon size={13} aria-hidden="true" /> {due.text}
              </span>
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>
              <BuildingIcon size={13} aria-hidden="true" /> Posted {timeAgoLabel(requirement.createdAt)}
            </span>
            {requirement.lastMatchedAt && (
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>
                <RefreshCwIcon size={13} aria-hidden="true" /> Updated {timeAgoLabel(requirement.lastMatchedAt)}
              </span>
            )}
          </div>

          {hasCandidates ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
              <ol aria-label="Pipeline" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint, listStyle: "none", margin: 0, padding: 0 }}>
                {stages.map((stage, i) => {
                  const active = pipelineFilter === stage.filter && stage.filter !== "all";
                  return (
                    <li key={stage.kind} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {i > 0 && <ChevronRightIcon size={14} color={t.inkFaintWeak} aria-hidden="true" />}
                      <button
                        type="button"
                        className="rq-pipe-btn"
                        aria-label={stage.aria}
                        aria-pressed={stage.filter === "all" ? undefined : active}
                        onClick={() => onPipelineFilterChange(stage.filter === "all" ? "all" : pipelineFilter === stage.filter ? "all" : stage.filter)}
                        style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", fontFamily: f.sans, fontSize: textSize.base, color: active ? t.indigo : t.inkFaint, fontWeight: active ? 600 : 400 }}
                      >
                        <span style={{ color: t.coal, fontWeight: 600 }}>{stage.value}</span> {stage.label}
                      </button>
                      {stage.kind === "evaluated" && (
                        <InfoTip label="About evaluated candidates">
                          Candidates HireStepX matched to this posting from candidates&rsquo; practice-session history.
                        </InfoTip>
                      )}
                    </li>
                  );
                })}
              </ol>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>
                <span>
                  <span style={{ color: t.indigo, fontWeight: 600 }}>{avgMatch}%</span> avg match score ({evidenceTier}), spanning{" "}
                  <span style={{ color: t.coal, fontWeight: 500 }}>
                    {scoreLow}–{scoreHigh}%
                  </span>
                </span>
                <InfoTip label="About the average match score">The average match score across evaluated candidates, and the range it spans.</InfoTip>
              </span>
            </div>
          ) : (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
              <HelpText>{requirement.status === "generating" ? "Scoring candidates…" : "No candidates shared yet."}</HelpText>
            </div>
          )}
        </Card>

        <Card aria-labelledby="talent-prefs-heading" style={{ minWidth: "min(260px, 100%)", maxWidth: 340, flex: "1 1 260px", boxShadow: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <h2 id="talent-prefs-heading" style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 600, color: t.coal, margin: 0 }}>
              Talent preferences
            </h2>
            {!closed && !suspended && (
              <Link
                href={`/employer/requirements/${requirement.id}/edit`}
                aria-label={`Edit talent preferences for ${requirement.title}`}
                className="inline-flex items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:min-h-11"
                style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 600, color: t.indigo, textDecoration: "none", outlineColor: t.indigo }}
              >
                Edit
              </Link>
            )}
          </div>
          <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 14, marginTop: 16, marginBottom: 0 }}>
            {prefs.map(({ Icon, label, value }) => (
              <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8, background: t.creamSoft, color: t.inkFaint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={14} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <dt style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>{label}</dt>
                  <dd style={{ margin: 0, fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal, overflowWrap: "anywhere" }}>{value}</dd>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 8, background: t.creamSoft, color: t.inkFaint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FolderIcon size={14} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <dt style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkFaint }}>Portfolio</dt>
                <dd style={{ margin: 0 }}>
                  <Pill tone={requirement.portfolioRequired ? "indigo" : "neutral"}>{requirement.portfolioRequired ? "Required" : "Optional"}</Pill>
                </dd>
              </div>
            </div>
          </dl>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${t.line}` }}>
            <h3 style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 600, color: t.coal, margin: 0 }}>Required skills</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {requirement.skills.length ? (
                requirement.skills.map((s) => <SkillTag key={s}>{s}</SkillTag>)
              ) : (
                <span style={{ fontFamily: f.sans, fontSize: textSize.md, fontWeight: 500, color: t.coal }}>Not specified</span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
