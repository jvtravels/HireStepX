import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { LoaderCircleIcon, ClipboardListIcon, MessageSquareIcon, CheckCircle2Icon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { tokens as t, fonts as f, shadows, textSize } from "../auth/_tokens";
import type { RequirementStage, CandidateStatus } from "./mockData";
import { STRONG_MATCH_THRESHOLD } from "../../server-handlers/_requirement-match-helpers";
import { STAGE_TRANSITIONS } from "../../server-handlers/_employer-requirements-helpers";

/** Deterministic evenly-spaced sample, used to show a diverse slice of a
 *  suggestions list before the user has typed anything. */
function sampleDiverse(arr: string[], count: number): string[] {
  if (arr.length <= count) return arr;
  const step = Math.floor(arr.length / count);
  const result: string[] = [];
  for (let i = 0; i < count; i++) result.push(arr[i * step]);
  return result;
}

function computeDropdownRect(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const pad = 8;
  const vw = window.innerWidth;
  let width = rect.width;
  if (width > vw - pad * 2) width = vw - pad * 2;
  let left = rect.left;
  if (left < pad) left = pad;
  if (left + width > vw - pad) left = vw - pad - width;
  const spaceBelow = window.innerHeight - rect.bottom - 4;
  const top = spaceBelow < 120 ? Math.max(pad, rect.top - 204) : rect.bottom + 4;
  return { top, left, width };
}

const dropdownStyle: React.CSSProperties = {
  position: "fixed",
  zIndex: 9999,
  background: t.white,
  border: `1px solid ${t.line}`,
  borderRadius: 10,
  boxShadow: shadows.card,
  maxHeight: 200,
  overflowY: "auto",
};

function optionStyle(selected: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    padding: "9px 14px",
    border: "none",
    textAlign: "left",
    fontFamily: f.sans,
    fontSize: 13,
    cursor: "pointer",
    background: selected ? t.creamSoft : "transparent",
    color: selected ? t.coal : t.inkSoft,
  };
}

/* HireStepX — Employer console shared atoms.
   Mirrors src/auth/_fields.tsx conventions (inline styles + real tokens),
   ported from the talent-roster-employer canvas mockup. */

export function EmployerWordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src="/wordmark.png" alt="HireStepX" style={{ height: 28, width: "auto", display: "block" }} />
    </div>
  );
}

export function Eyebrow({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "copper" | "indigo" | "error" }) {
  const color = tone === "copper" ? t.copper : tone === "indigo" ? t.indigo : tone === "error" ? t.error : t.inkSoft;
  return (
    <div style={{ fontFamily: f.mono, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color, fontWeight: 600 }}>
      {children}
    </div>
  );
}

type PillTone = "indigo" | "copper" | "success" | "neutral" | "warning" | "error" | "violet";

const pillPalette: Record<PillTone, { bg: string; fg: string }> = {
  indigo: { bg: t.indigo100, fg: t.indigoDeep },
  copper: { bg: t.copper100, fg: t.copper },
  success: { bg: t.success100, fg: t.success },
  warning: { bg: t.warning100, fg: t.warning },
  error: { bg: t.error100, fg: t.error },
  neutral: { bg: t.creamSoft, fg: t.inkSoft },
  violet: { bg: t.violet100, fg: t.violet },
};

export function Pill({ children, tone = "neutral", filled = false }: { children: React.ReactNode; tone?: PillTone; filled?: boolean }) {
  const p = pillPalette[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        fontFamily: f.sans,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.2,
        maxWidth: "100%",
        minWidth: 0,
        overflowWrap: "anywhere",
        background: filled ? p.fg : p.bg,
        color: filled ? t.white : p.fg,
      }}
    >
      {children}
    </span>
  );
}

/* Mid tier floor, same 2026-10-04 recalibration as STRONG_MATCH_THRESHOLD
   (see its doc comment in _requirement-match-helpers.ts): real-score
   candidates with some genuine but partial overlap clustered 20-39, with a
   sharp drop into single digits below that for candidates with no real
   relevance — so 20 is "worth a look," not "strong." */
const FAIR_MATCH_THRESHOLD = 20;

export function ScoreChip({ score }: { score: number }) {
  const tone: PillTone = score >= STRONG_MATCH_THRESHOLD ? "success" : score >= FAIR_MATCH_THRESHOLD ? "copper" : "neutral";
  return (
    <div
      style={{
        width: 44,
        height: 32,
        borderRadius: 8,
        background: pillPalette[tone].bg,
        color: pillPalette[tone].fg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: f.mono,
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {score}
    </div>
  );
}

export function Card({
  children,
  pad = 24,
  radius = 16,
  background = t.white,
  border = `1px solid ${t.line}`,
  style,
}: {
  children: React.ReactNode;
  pad?: number;
  radius?: number;
  background?: string;
  border?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section style={{ background, border, borderRadius: radius, padding: pad, boxShadow: shadows.card, ...style }}>
      {children}
    </section>
  );
}

/* PrimaryCta/OutlineCta wrap the shared shadcn Button — same component,
   sizing, and radius as the rest of the app (e.g. Jobs page's "Post a
   requirement" / outline filter buttons) so employer CTAs read as one
   product, not a bespoke button system. */
export function PrimaryCta({
  children,
  onClick,
  icon,
  size = "md",
  disabled = false,
  full = false,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  size?: "sm" | "md";
  disabled?: boolean;
  full?: boolean;
  type?: "button" | "submit";
}) {
  // Full-width CTAs (settings/outcome save bars) keep their own sizing —
  // only the shape (radius/shadow) needs to track the shared Button.
  if (full) {
    return (
      <Button
        type={type}
        variant="default"
        onClick={onClick}
        disabled={disabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          height: size === "sm" ? 36 : 44,
          padding: size === "sm" ? "0 18px" : "0 20px",
          borderRadius: 8,
          fontFamily: f.sans,
          fontSize: size === "sm" ? 13 : 15,
          fontWeight: 600,
          boxShadow: disabled ? "none" : `0px 2px 4px color-mix(in srgb, ${t.indigo} 20%, transparent)`,
        }}
      >
        {children}
        {icon}
      </Button>
    );
  }

  // Compact toolbar/card CTAs rely on the shared Button's canonical shape
  // (radius/weight/font-size/shadow come from the `default` variant) instead
  // of a bespoke inline style — same pattern as Sessions/Jobs CTAs.
  return (
    <Button
      type={type}
      variant="default"
      size="lg"
      className={size === "sm" ? "gap-2 px-4.5" : "gap-2 px-4"}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
      {icon}
    </Button>
  );
}

export function OutlineCta({
  children,
  onClick,
  icon,
  size = "md",
  full = false,
  tone = "neutral",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  size?: "sm" | "md";
  full?: boolean;
  tone?: "neutral" | "indigo";
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: full ? "100%" : undefined,
        height: size === "sm" ? 36 : 44,
        padding: size === "sm" ? "0 16px" : "0 20px",
        borderRadius: 8,
        fontFamily: f.sans,
        fontSize: size === "sm" ? 13 : 14,
        fontWeight: 600,
        ...(tone === "indigo" ? { background: t.indigo100, color: t.indigoDeep, borderColor: t.indigo } : {}),
      }}
    >
      {icon}
      {children}
    </Button>
  );
}

export function SkillTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        padding: "4px 9px",
        borderRadius: 8,
        background: t.creamSoft,
        border: `1px solid ${t.line}`,
        fontFamily: f.sans,
        fontSize: 12,
        color: t.inkSoft,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  );
}

/** Label + tone for a candidate's per-requirement hiring-pipeline status —
 *  single source of truth so the candidate-detail page, the requirement
 *  table column, and any future surface never drift on wording or color.
 *  Mirrors CANDIDATE_STATUSES in
 *  server-handlers/_employer-candidate-status-helpers.ts. */
export const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = {
  shortlisted: "Shortlisted",
  interview_invited: "Interview Invited",
  interviewing: "Interviewing",
  hired: "Hired",
  rejected: "Rejected",
  not_a_fit: "Not a fit",
  no_response: "No response",
};

const CANDIDATE_STATUS_TONE: Record<CandidateStatus, PillTone> = {
  shortlisted: "indigo",
  interview_invited: "violet",
  interviewing: "copper",
  hired: "success",
  rejected: "error",
  not_a_fit: "neutral",
  no_response: "neutral",
};

export function CandidateStatusChip({ status }: { status: CandidateStatus }) {
  return <Pill tone={CANDIDATE_STATUS_TONE[status]}>{CANDIDATE_STATUS_LABEL[status]}</Pill>;
}

/** Colored dot + label — pipeline/stage indicator for opportunity and
 *  requirement tables (matching → review → interviewing → hired). */
export function StageDot({ tone, label }: { tone: PillTone; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: f.sans, fontSize: 13.5, color: t.coal }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: "50%", background: pillPalette[tone].fg, flexShrink: 0 }} />
      {label}
    </span>
  );
}

export type BadgeTone = "neutral" | "success" | "brand" | "info" | "warning" | "error";
const BADGE_TONE: Record<BadgeTone, { color: string; background: string }> = {
  neutral: { color: t.inkSoft, background: t.creamSoft },
  success: { color: t.successInk, background: t.success100 },
  brand: { color: t.indigoDeep, background: t.indigo100 },
  info: { color: t.info, background: t.info100 },
  warning: { color: t.warningInk, background: t.warning100 },
  error: { color: t.errorInk, background: t.error100 },
};

export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const { color, background } = BADGE_TONE[tone];
  return (
    <span style={{ fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color, background, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

/** All four persisted stage values, for label/tone/icon lookups that need to
 *  render whatever stage a posting is CURRENTLY in — including the
 *  system-owned `ai_matching`. This is distinct from which stages are valid
 *  manual DESTINATIONS, which is `STAGE_TRANSITIONS` (shared with the
 *  server, see _employer-requirements-helpers.ts): the dropdown below
 *  renders `STAGE_TRANSITIONS[stage]`, never this list. */
export const STAGE_OPTIONS: RequirementStage[] = ["ai_matching", "ready_for_review", "interviewing", "hired"];

export const STAGE_LABEL: Record<RequirementStage, string> = {
  ai_matching: "AI Matching",
  ready_for_review: "Ready for Review",
  interviewing: "Interviewing",
  hired: "Hired",
};

export const STAGE_TONE: Record<RequirementStage, BadgeTone> = {
  ai_matching: "neutral",
  ready_for_review: "info",
  interviewing: "brand",
  hired: "success",
};

/** Leading stage glyph — a stage reads at a glance instead of by color alone. */
export const STAGE_ICON: Record<RequirementStage, React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" }>> = {
  ai_matching: LoaderCircleIcon,
  ready_for_review: ClipboardListIcon,
  interviewing: MessageSquareIcon,
  hired: CheckCircle2Icon,
};

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
    closed posting shows a live spinning "AI Matching" pill next to its
    "Closed" badge, implying matching is still running on something no
    longer hiring. Frozen renders the label plain and static — no spin,
    no dropdown — since the stage is stale by definition once closed. */
export function StageCell({
  stage,
  hasEvaluatedCandidates,
  onChange,
  frozen,
}: {
  stage: RequirementStage;
  hasEvaluatedCandidates: boolean;
  onChange: (stage: RequirementStage) => void;
  frozen?: boolean;
}) {
  const { color, background } = BADGE_TONE[STAGE_TONE[stage]];
  const StageIcon = STAGE_ICON[stage];

  if (frozen || !hasEvaluatedCandidates) {
    return (
      <motion.span
        layout
        animate={{ backgroundColor: background, color }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        style={{
          display: "inline-flex", alignItems: "center", gap: 4, fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600,
          padding: "3px 8px", borderRadius: 999, whiteSpace: "nowrap",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={stage}
            initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            style={{ display: "inline-flex" }}
          >
            <StageIcon size={11} className={!frozen && stage === "ai_matching" ? "animate-spin" : undefined} aria-hidden="true" />
          </motion.span>
        </AnimatePresence>
        {STAGE_LABEL[stage]}
      </motion.span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          type="button"
          layout
          onClick={(e) => e.stopPropagation()}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          animate={{ backgroundColor: background, color }}
          transition={{ duration: 0.16, ease: [0.2, 0.7, 0.2, 1] }}
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

export function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ display: "block", fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, marginBottom: 6 }}>
      {children}
      {required && <span style={{ color: t.indigo }}> *</span>}
    </label>
  );
}

export function HelpText({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" }) {
  return (
    <div style={{ fontFamily: f.sans, fontSize: 12, color: tone === "error" ? t.error : t.inkFaint, marginTop: 6 }}>
      {children}
    </div>
  );
}

/** Multi-value tag input — type + Enter (or comma) to add, click "x" to
 *  remove. Backs every array-valued requirement field (locations, skills,
 *  preferred colleges, target companies, perks). No dropdown/autocomplete;
 *  it's a free-text chip list, matching what the API actually stores. */
export function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState("");

  const commit = () => {
    const cleaned = draft.trim();
    if (cleaned.length === 0) return;
    if (!values.includes(cleaned)) onChange([...values, cleaned]);
    setDraft("");
  };

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 10,
        border: `1px solid ${t.line}`,
        background: t.white,
      }}
    >
      {values.map((v) => (
        <span
          key={v}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 6px 4px 10px",
            borderRadius: 8,
            background: t.creamSoft,
            border: `1px solid ${t.line}`,
            fontFamily: f.sans,
            fontSize: 12,
            color: t.inkSoft,
            fontWeight: 500,
          }}
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            aria-label={`Remove ${v}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              margin: "-4px -6px -4px 0",
              border: "none",
              background: "transparent",
              color: t.inkFaint,
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && draft.length === 0 && values.length > 0) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : ""}
        style={{
          flex: 1,
          minWidth: 120,
          border: "none",
          outline: "none",
          fontFamily: f.sans,
          fontSize: 14,
          padding: "4px 2px",
        }}
      />
    </div>
  );
}

export function Divider() {
  return <div style={{ height: 1, background: t.line, width: "100%" }} />;
}

/** Single-value text input with a suggestions dropdown, filtered as the
 *  user types. Shows a diverse sample when empty and focused. Free text
 *  is still accepted — suggestions are a helper, not a closed enum. */
export function AutocompleteInput({
  value,
  onChange,
  placeholder,
  suggestions,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  suggestions: string[];
}) {
  const [focused, setFocused] = React.useState(false);
  const [selectedIdx, setSelectedIdx] = React.useState(-1);
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxId = React.useId();
  const diverseSample = React.useMemo(() => sampleDiverse(suggestions, 8), [suggestions]);

  const q = value.trim().toLowerCase();
  const filtered = focused
    ? q.length === 0
      ? diverseSample
      : suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 8)
    : [];

  React.useEffect(() => {
    if (filtered.length > 0 && inputRef.current) setRect(computeDropdownRect(inputRef.current));
  }, [filtered.length, focused, value]);

  React.useEffect(() => {
    if (filtered.length === 0) return;
    const recompute = () => {
      if (inputRef.current) setRect(computeDropdownRect(inputRef.current));
    };
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [filtered.length]);

  const select = (s: string) => {
    onChange(s);
    setFocused(false);
    setSelectedIdx(-1);
  };

  return (
    <div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSelectedIdx(-1);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(e) => {
          if (filtered.length === 0) {
            if (e.key === "Escape") inputRef.current?.blur();
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && selectedIdx >= 0) {
            e.preventDefault();
            select(filtered[selectedIdx]);
          } else if (e.key === "Escape") {
            setFocused(false);
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={filtered.length > 0}
        aria-controls={listboxId}
        aria-autocomplete="list"
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: 10,
          border: `1px solid ${t.line}`,
          fontFamily: f.sans,
          fontSize: 14,
          boxSizing: "border-box",
        }}
      />
      {filtered.length > 0 &&
        rect &&
        createPortal(
          <div id={listboxId} role="listbox" style={{ ...dropdownStyle, top: rect.top, left: rect.left, width: rect.width }}>
            {filtered.map((s, i) => (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={i === selectedIdx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(s);
                }}
                style={optionStyle(i === selectedIdx)}
              >
                {s}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** TagInput with a suggestions dropdown on the draft field — same chip
 *  behavior as TagInput, plus a filtered/sampled list the user can pick
 *  from without losing the ability to type a free-text tag. */
export function TagAutocompleteInput({
  values,
  onChange,
  placeholder,
  suggestions,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  suggestions: string[];
}) {
  const [draft, setDraft] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  const [selectedIdx, setSelectedIdx] = React.useState(-1);
  const [rect, setRect] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const listboxId = React.useId();
  const diverseSample = React.useMemo(() => sampleDiverse(suggestions, 8), [suggestions]);

  const commit = (raw?: string) => {
    const cleaned = (raw ?? draft).trim();
    if (cleaned.length === 0) return;
    if (!values.includes(cleaned)) onChange([...values, cleaned]);
    setDraft("");
    setSelectedIdx(-1);
  };

  const q = draft.trim().toLowerCase();
  const filtered = focused
    ? (q.length === 0 ? diverseSample : suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 8)).filter(
        (s) => !values.includes(s),
      )
    : [];

  React.useEffect(() => {
    if (filtered.length > 0 && containerRef.current) setRect(computeDropdownRect(containerRef.current));
  }, [filtered.length, focused, draft]);

  React.useEffect(() => {
    if (filtered.length === 0) return;
    const recompute = () => {
      if (containerRef.current) setRect(computeDropdownRect(containerRef.current));
    };
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [filtered.length]);

  return (
    <div ref={containerRef}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          padding: "8px 10px",
          borderRadius: 10,
          border: `1px solid ${t.line}`,
          background: t.white,
        }}
      >
        {values.map((v) => (
          <span
            key={v}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 6px 4px 10px",
              borderRadius: 8,
              background: t.creamSoft,
              border: `1px solid ${t.line}`,
              fontFamily: f.sans,
              fontSize: 12,
              color: t.inkSoft,
              fontWeight: 500,
            }}
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                margin: "-4px -6px -4px 0",
                border: "none",
                background: "transparent",
                color: t.inkFaint,
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSelectedIdx(-1);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setTimeout(() => setFocused(false), 150);
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              if (selectedIdx >= 0 && filtered[selectedIdx]) commit(filtered[selectedIdx]);
              else commit();
            } else if (e.key === "Backspace" && draft.length === 0 && values.length > 0) {
              onChange(values.slice(0, -1));
            } else if (e.key === "ArrowDown" && filtered.length > 0) {
              e.preventDefault();
              setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
            } else if (e.key === "ArrowUp" && filtered.length > 0) {
              e.preventDefault();
              setSelectedIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Escape") {
              setFocused(false);
              inputRef.current?.blur();
            }
          }}
          placeholder={values.length === 0 ? placeholder : ""}
          autoComplete="off"
          role="combobox"
          aria-expanded={filtered.length > 0}
          aria-controls={listboxId}
          aria-autocomplete="list"
          style={{
            flex: 1,
            minWidth: 120,
            border: "none",
            outline: "none",
            fontFamily: f.sans,
            fontSize: 14,
            padding: "4px 2px",
          }}
        />
      </div>
      {filtered.length > 0 &&
        rect &&
        createPortal(
          <div id={listboxId} role="listbox" style={{ ...dropdownStyle, top: rect.top, left: rect.left, width: rect.width }}>
            {filtered.map((s, i) => (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={i === selectedIdx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(s);
                }}
                style={optionStyle(i === selectedIdx)}
              >
                {s}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/** Groups related fields under a small-caps label with a hairline rule,
 *  so a long form reads as scannable sections instead of one flat list. */
export function FormSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {title && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ fontFamily: f.mono, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: t.inkFaint, fontWeight: 600 }}>
            {title}
          </span>
          <Divider />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
    </div>
  );
}

/** Toggle-button group for a small closed set of mutually-exclusive options
 *  (e.g. work mode) — replaces bare native radios with a brand-consistent,
 *  larger-touch-target control. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div style={{ display: "inline-flex", padding: 3, borderRadius: 11, background: t.creamSoft, gap: 2 }}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            style={{
              padding: "8px 16px",
              minHeight: 36,
              borderRadius: 8,
              border: "none",
              background: selected ? t.white : "transparent",
              color: selected ? t.indigoDeep : t.inkSoft,
              boxShadow: selected ? shadows.card : "none",
              fontFamily: f.sans,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** A single boolean checkbox toggle (e.g. "Portfolio required"). */
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        background: "none",
        border: "none",
        padding: 0,
        fontFamily: f.sans,
        fontSize: 13,
        fontWeight: 500,
        color: t.coal,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: `1.5px solid ${checked ? t.indigo : t.lineStrong}`,
          background: checked ? t.indigo : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

/* Mirrors DashboardHome.tsx's StatCell — same 3-column stat-strip pattern
   used on the candidate dashboard, reused so the employer dashboard reads
   as the same product. */
export function StatCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div style={{ padding: "16px 4px", borderRight: `1px solid ${t.line}` }}>
      <dt style={{ fontFamily: f.mono, fontSize: 12, color: t.inkSoft, letterSpacing: 0.6, textTransform: "uppercase", margin: 0 }}>
        {label}
      </dt>
      <dd style={{ margin: "6px 0 0", display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontFamily: f.sans, fontSize: 30, fontWeight: 400, color: t.coal, letterSpacing: -0.5, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{unit}</span>}
      </dd>
    </div>
  );
}

export const EmployerIcon = {
  Check: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Lock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M8 11V7a4 4 0 118 0v4" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Arrow: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Refresh: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M4 4v6h6M20 20v-6h-6M4.5 15a8 8 0 0013.9 3.4M19.5 9A8 8 0 005.6 5.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Alert: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 9v4M12 17h.01M10.3 3.9L2.7 18a2 2 0 001.8 3h15a2 2 0 001.8-3L13.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Building: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="10" height="18" rx="1" stroke="currentColor" strokeWidth="2" />
      <path d="M14 8h6v13h-6M8 7h.01M8 11h.01M8 15h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ChevronUp: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  ChevronDown: () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
