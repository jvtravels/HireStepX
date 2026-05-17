/* Learning Mode toggle + move-tag chip — in-flow transparency UI
 * (Dim 14, AP3 / 2026-05-17).
 *
 * Companion to server-handlers/_move-tag.ts. The server emits an
 * optional `moveTag` ({ label, hint, family }) on each negotiate-turn
 * response; this module renders that signal under a user-controlled
 * Learning Mode toggle (off by default, persisted to localStorage).
 *
 * Three surfaces:
 *   - LEARNING_MODE_KEY        — localStorage key.
 *   - useLearningMode()        — hook returning [enabled, setEnabled].
 *   - <LearningModeToggle />   — chip-style switch for the topbar.
 *   - <MoveTagChip />          — small footnote chip under AI bubbles.
 *
 * Backward-compatible: missing `moveTag` renders nothing; toggle off
 * renders nothing. No reserved space. No new dependencies — uses inline
 * SVGs (the codebase pattern) instead of pulling in lucide-react.
 */

import { useCallback, useEffect, useState } from "react";

/** localStorage key for the user's Learning Mode preference. */
export const LEARNING_MODE_KEY = "hirestep:learning-mode";

/** Move-tag families emitted by deriveMoveTag. Mirrored on the client
 *  so the chip can pick a family-specific icon without importing from
 *  server-handlers/_move-tag (the type would drag node-only deps in). */
export type MoveTagFamily =
  | "discovery"
  | "anchor"
  | "defense"
  | "counter"
  | "stall"
  | "close"
  | "terminal"
  | "meta";

export interface MoveTag {
  label: string;
  hint: string;
  family: MoveTagFamily;
}

/* ─── Hook ─────────────────────────────────────────────────────────── */

function readPersisted(): boolean {
  try {
    return localStorage.getItem(LEARNING_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Persisted Learning Mode flag. Default off. Writes to localStorage
 *  every flip so the preference survives reloads. SSR-safe via the
 *  try/catch read. */
export function useLearningMode(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() => readPersisted());
  const set = useCallback((next: boolean) => {
    setEnabled(next);
    try {
      localStorage.setItem(LEARNING_MODE_KEY, next ? "true" : "false");
    } catch {
      /* expected: localStorage may be unavailable (incognito quota,
       * disabled cookies). The in-memory state still updates. */
    }
  }, []);
  /* Sync across tabs: a second tab toggling the preference broadcasts a
   * `storage` event we mirror into state. Non-essential — kept simple. */
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === LEARNING_MODE_KEY) {
        setEnabled(ev.newValue === "true");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return [enabled, set];
}

/* ─── Family icons ─────────────────────────────────────────────────── */

/** Inline SVG icons keyed by lever family. Matches the spec:
 *    discovery → Search       anchor   → Anchor
 *    defense   → Shield       counter  → Scale
 *    stall     → Clock        close    → CheckCircle
 *    terminal  → DoorOpen     meta     → Sparkles
 *  The icons are line-art, currentColor stroke, so the chip's text
 *  colour drives them — no extra theming knobs. */
export function MoveTagIcon({ family, size = 12 }: { family: MoveTagFamily; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (family) {
    case "discovery":
      return (
        <svg {...common} data-icon="search">
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case "anchor":
      return (
        <svg {...common} data-icon="anchor">
          <circle cx="12" cy="5" r="3" />
          <line x1="12" y1="22" x2="12" y2="8" />
          <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
        </svg>
      );
    case "defense":
      return (
        <svg {...common} data-icon="shield">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "counter":
      return (
        <svg {...common} data-icon="scale">
          <path d="M16 16l3-8 3 8c-2 1-4 1-6 0" />
          <path d="M2 16l3-8 3 8c-2 1-4 1-6 0" />
          <line x1="7" y1="21" x2="17" y2="21" />
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="5" y1="8" x2="19" y2="8" />
        </svg>
      );
    case "stall":
      return (
        <svg {...common} data-icon="clock">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "close":
      return (
        <svg {...common} data-icon="check-circle">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case "terminal":
      return (
        <svg {...common} data-icon="door-open">
          <path d="M13 4h3v16h-3" />
          <path d="M13 4L4 6v12l9 2" />
          <line x1="10" y1="12" x2="10" y2="13" />
        </svg>
      );
    case "meta":
      return (
        <svg {...common} data-icon="sparkles">
          <path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        </svg>
      );
  }
}

/* ─── Toggle ───────────────────────────────────────────────────────── */

/** Chip-style switch for the topbar. Renders nothing unless `visible`
 *  — gating happens at the call site (only show during salary-neg).
 *
 *  ARIA: role=switch + aria-checked is the spec for a binary toggle
 *  that isn't an HTML checkbox; keyboard (Space / Enter) toggles via
 *  the native button activation behaviour. */
export function LearningModeToggle({
  visible,
  enabled,
  onChange,
}: {
  visible: boolean;
  enabled: boolean;
  onChange: (next: boolean) => void;
}) {
  if (!visible) return null;
  const fg = enabled ? "#7a4a06" : "#5b5347";
  const bg = enabled ? "rgba(180,83,9,0.10)" : "rgba(20,17,10,0.04)";
  const border = enabled ? "rgba(180,83,9,0.28)" : "rgba(20,17,10,0.10)";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label="Learning Mode"
      title="See why the recruiter chose each move"
      data-testid="learning-mode-toggle"
      onClick={() => onChange(!enabled)}
      onKeyDown={(ev) => {
        /* Space / Enter activate via the implicit button handler in all
         * browsers, but Space on role=switch is occasionally swallowed
         * by scroll handlers. Explicitly toggle on both so keyboard
         * activation is bulletproof in jsdom + real browsers. */
        if (ev.key === " " || ev.key === "Enter") {
          ev.preventDefault();
          onChange(!enabled);
        }
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        minHeight: 32,
        borderRadius: 999,
        background: bg,
        border: `1px solid ${border}`,
        color: fg,
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.01em",
        cursor: "pointer",
        transition: "background 0.18s ease, border-color 0.18s ease, color 0.18s ease",
      }}
    >
      <MoveTagIcon family="meta" size={12} />
      <span>Learning Mode</span>
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 700,
          padding: "1px 6px",
          borderRadius: 999,
          background: enabled ? "#7a4a06" : "rgba(20,17,10,0.10)",
          color: enabled ? "#fff" : "#5b5347",
          minWidth: 22,
        }}
      >
        {enabled ? "ON" : "OFF"}
      </span>
    </button>
  );
}

/* ─── Chip ─────────────────────────────────────────────────────────── */

/** Footnote chip rendered BELOW the AI bubble when Learning Mode is on.
 *  Backward compatible: if `tag` is undefined, renders null — no space,
 *  no warning. Hint reveals on hover via the native title attribute and
 *  on tap via a chip-level expand toggle (mobile-friendly).
 *
 *  Styled as a footnote — muted, small, rounded-full, gap-1.5. Not a
 *  feature — a footnote on the feature above. */
export function MoveTagChip({
  tag,
  enabled,
}: {
  tag: MoveTag | undefined | null;
  enabled: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!enabled || !tag) return null;
  return (
    <div
      data-testid="move-tag-chip-wrap"
      style={{
        marginTop: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
      }}
    >
      <button
        type="button"
        data-testid="move-tag-chip"
        data-family={tag.family}
        aria-expanded={expanded}
        aria-label={`Why this move: ${tag.label}. ${tag.hint}`}
        title={tag.hint}
        onClick={() => setExpanded((v) => !v)}
        onMouseEnter={() => setExpanded(true)}
        onFocus={() => setExpanded(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "3px 10px",
          borderRadius: 999,
          background: "rgba(20,17,10,0.03)",
          border: "1px solid rgba(20,17,10,0.10)",
          color: "#5b5347",
          fontSize: 11,
          fontWeight: 500,
          lineHeight: 1.4,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        <MoveTagIcon family={tag.family} size={11} />
        <span>{tag.label}</span>
      </button>
      {expanded && (
        <p
          data-testid="move-tag-chip-hint"
          style={{
            margin: 0,
            maxWidth: 480,
            fontSize: 11,
            lineHeight: 1.5,
            color: "#6b6356",
            fontStyle: "italic",
          }}
        >
          {tag.hint}
        </p>
      )}
    </div>
  );
}
