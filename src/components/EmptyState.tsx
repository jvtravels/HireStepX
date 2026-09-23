"use client";
import type { ReactNode, CSSProperties } from "react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

/* ─── Shared EmptyState primitive ─────────────────────────────────────
   Generic "no data here yet" surface used across the admin, dashboard,
   and session-report surfaces. Built on top of the shadcn `Empty`
   primitive (default vertical layout — icon over title over description
   over action) rather than a hand-rolled card, per the shadcn migration.

   Pass any of:
     • icon        — decorative leading glyph (svg/element)
     • title       — required headline
     • description — supporting copy (optional)
     • action      — either a { label, onClick } CTA or a ReactNode
                     (lets callers pass a custom button cluster)
     • className   — for callers that need to layer extra styles

   Previously this duplicated a second inline EmptyState in
   readinessIndex/sections.tsx; both now consolidate onto this one. */

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
    <Empty className={className} style={style}>
      <EmptyHeader>
        {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && (
        <EmptyContent>
          {isActionShape(action) ? (
            <Button type="button" onClick={action.onClick}>
              {action.label}
            </Button>
          ) : (
            action
          )}
        </EmptyContent>
      )}
    </Empty>
  );
}

export default EmptyState;
