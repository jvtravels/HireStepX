"use client";
import type { ReactNode, CSSProperties } from "react";
import { c, font, radius } from "../tokens";

/* ─── Shared EmptyState primitive ─────────────────────────────────────
   Generic, neutral "no data here yet" surface used across the admin and
   dashboard surfaces. Aesthetic matches the AdminDashboard card system
   (graphite background, hairline border, ivory headline, stone copy) so
   it drops into any panel without restyling.

   Centered vertically + horizontally inside its parent card. Pass any of:
     • icon        — decorative leading glyph (svg/element)
     • title       — required headline
     • description — supporting copy (optional)
     • action      — either a { label, onClick } CTA or a ReactNode
                     (lets callers pass a custom button cluster)
     • className   — for callers that need to layer extra styles

   Previously the AdminDashboard had a local inline `EmptyState({ message })`
   that bypassed the layout token; that copy lived in 17 call sites. This
   primitive replaces it without behavior change. */

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: EmptyStateAction | ReactNode;
  className?: string;
  /** Optional style overrides for the outer card. */
  style?: CSSProperties;
}

function isActionShape(a: unknown): a is EmptyStateAction {
  return !!a && typeof a === "object" && "label" in (a as object) && "onClick" in (a as object);
}

export function EmptyState({ icon, title, description, action, className, style }: EmptyStateProps) {
  return (
    <div
      className={className}
      style={{
        background: c.graphite,
        border: `1px solid ${c.border}`,
        borderRadius: radius.lg,
        padding: "60px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        ...style,
      }}
    >
      {icon && (
        <div aria-hidden style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: c.gilt, marginBottom: 4 }}>
          {icon}
        </div>
      )}
      <p
        style={{
          fontFamily: font.ui,
          fontSize: 16,
          fontWeight: 500,
          color: c.ivory,
          margin: 0,
          lineHeight: 1.4,
        }}
      >
        {title}
      </p>
      {description && (
        <p
          style={{
            fontFamily: font.ui,
            fontSize: 13,
            color: c.stone,
            margin: 0,
            maxWidth: 440,
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      )}
      {action && (
        <div style={{ marginTop: 8 }}>
          {isActionShape(action) ? (
            <button
              type="button"
              onClick={action.onClick}
              style={{
                fontFamily: font.ui,
                fontSize: 13,
                fontWeight: 500,
                padding: "9px 20px",
                borderRadius: 8,
                border: "none",
                background: c.gilt,
                color: c.obsidian,
                cursor: "pointer",
              }}
            >
              {action.label}
            </button>
          ) : (
            action
          )}
        </div>
      )}
    </div>
  );
}

export default EmptyState;
