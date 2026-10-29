import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDownIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { fonts as f, textSize } from "../auth/_tokens";
import type { RequirementStage } from "./mockData";
import { STAGE_TRANSITIONS } from "../../server-handlers/_employer-requirements-helpers";
import { STAGE_OPTIONS, STAGE_LABEL, STAGE_TONE, STAGE_ICON, pillPalette } from "./_atoms";

/* Lives apart from _atoms so the motion library only loads on the pages that
   render a stage pill; every console page imports _atoms through the shell. */

/** Real, persisted hiring-pipeline stage — manually set by the employer,
    distinct from the AI-generation Status. Click to move a posting to any
    of the stages `STAGE_TRANSITIONS[stage]` lists as reachable from here
    (see _employer-requirements-helpers.ts) — never `ai_matching`, which is
    system-owned and set only by `runMatching`, so it's never offered as a
    dropdown destination and the server rejects it if one were forged.

    Non-interactive (plain badge, no dropdown) while the AI hasn't produced
    any evaluated candidates yet — nothing exists to review, interview, or
    hire, so offering those stages as clickable options would let an
    employer "hire" against an empty shortlist. Shared by the jobs list
    (per-row) and the opportunity detail page (header) so the pipeline
    reads identically everywhere it appears.

    `frozen` covers a closed requirement: archiving only ever patches
    `status`, never `stage` (see handleStatusAction in
    employer-requirement-detail.ts), so a requirement archived while still
    mid-matching keeps `stage: "ai_matching"` forever. Without this, a
    closed posting shows a live spinning "AI matching" pill next to its
    "Closed" badge, implying matching is still running on something no
    longer hiring. Frozen renders the label plain and static — no spin,
    no dropdown — since the stage is stale by definition once closed. */
export function StageCell({
  stage: rawStage,
  hasEvaluatedCandidates,
  onChange,
  frozen,
  closed,
  matchedOnce,
}: {
  stage: RequirementStage;
  hasEvaluatedCandidates: boolean;
  onChange: (stage: RequirementStage) => void;
  frozen?: boolean;
  /** The posting is closed: its stored stage is stale, so show "Closed" instead of it. */
  closed?: boolean;
  /** Matching finished with zero results, so the posting is idle rather than mid-run. */
  matchedOnce?: boolean;
}) {
  // A stage this build doesn't know (new server value, stale cache) falls back
  // to "ai_matching" rather than taking the whole list down.
  const stage: RequirementStage = STAGE_OPTIONS.includes(rawStage) ? rawStage : "ai_matching";
  // A posting whose matching found nobody can still carry a stale
  // ready_for_review stage; there is nothing to review, so say so.
  const idleMatching = !hasEvaluatedCandidates && !!matchedOnce && (stage === "ai_matching" || stage === "ready_for_review");
  const { fg: color, bg: background } = pillPalette[idleMatching ? "neutral" : STAGE_TONE[stage]];
  const StageIcon = STAGE_ICON[idleMatching ? "ai_matching" : stage];
  // The global CSS reduced-motion rule only reaches CSS animations; motion's
  // JS-driven springs/scales need the hook.
  const reduceMotion = useReducedMotion();

  if (closed) {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-hx-soft px-2 py-[3px] text-[13px] font-semibold text-hx-ink-soft">
        Closed
      </span>
    );
  }

  if (frozen || !hasEvaluatedCandidates) {
    return (
      <motion.span
        layout={!reduceMotion}
        animate={{ backgroundColor: background, color }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600,
          padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={stage}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.5, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: "inline-flex" }}
          >
            <StageIcon size={11} className={!frozen && !idleMatching && stage === "ai_matching" ? "animate-spin" : undefined} aria-hidden="true" />
          </motion.span>
        </AnimatePresence>
        {idleMatching ? "No matches yet" : STAGE_LABEL[stage]}
      </motion.span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          type="button"
          layout={!reduceMotion}
          onClick={(e) => e.stopPropagation()}
          whileHover={reduceMotion ? undefined : { scale: 1.03 }}
          whileTap={reduceMotion ? undefined : { scale: 0.97 }}
          animate={{ backgroundColor: background, color }}
          transition={{ duration: reduceMotion ? 0 : 0.16, ease: [0.2, 0.7, 0.2, 1] }}
          aria-label={`Pipeline stage: ${STAGE_LABEL[stage]}. Change stage`}
          className="pointer-coarse:min-h-11"
          style={{
            display: "inline-flex", alignItems: "center", gap: 4, fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600,
            padding: "7px 9px 7px 10px", borderRadius: 999, whiteSpace: "nowrap", border: "none", cursor: "pointer",
          }}
        >
          <StageIcon size={11} aria-hidden="true" />
          {STAGE_LABEL[stage]}
          <ChevronDownIcon size={11} aria-hidden="true" />
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STAGE_TRANSITIONS[stage].map((opt) => (
          <DropdownMenuItem key={opt} onSelect={() => onChange(opt)}>
            {STAGE_LABEL[opt]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
