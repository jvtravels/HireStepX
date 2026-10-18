import type { CSSProperties, ReactNode } from "react";
import { tokens as t, fonts as f } from "./auth/_tokens";

/* The one title / subtitle / actions row for candidate screens, plus the two
   containers those screens sit in (bordered panel, centered max-width column).
   Screens used to hand-roll each of these, so size, spacing and wrapping drifted. */

const ROOT: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: 12,
  borderBottom: `1px solid ${t.line}`,
};
const TITLE_BLOCK: CSSProperties = { minWidth: 0 };
const TITLE_BLOCK_FIXED: CSSProperties = { minWidth: 0, flexShrink: 0 };
const TITLE: CSSProperties = {
  fontFamily: f.sans,
  fontSize: 26,
  lineHeight: "32px",
  fontWeight: 700,
  color: t.coal,
  margin: 0,
  letterSpacing: "-0.01em",
};
const SUBTITLE: CSSProperties = { fontFamily: f.sans, fontSize: 14, color: t.inkFaint, margin: "2px 0 0" };
const ACTIONS: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  minWidth: 0,
};
const PANEL: CSSProperties = {
  background: t.white,
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minHeight: 0,
  borderRadius: 12,
  border: `1px solid ${t.line}`,
  overflow: "hidden",
  fontFamily: f.sans,
};
const COLUMN_BASE: CSSProperties = { width: "100%", margin: "0 auto" };

export default function CandidatePageHeader({
  title,
  subtitle,
  actions,
  titleId,
  padding = "16px 20px",
  actionsStyle,
}: {
  title: string;
  subtitle?: string;
  /** Right-hand slot (primary CTA, search, filters). Wraps under the title on narrow widths. */
  actions?: ReactNode;
  titleId?: string;
  padding?: CSSProperties["padding"];
  /** Per-screen tweaks to the actions row (e.g. stretch it to full width on phones). */
  actionsStyle?: CSSProperties;
}) {
  const rootStyle: CSSProperties = { ...ROOT, padding };
  const actionsMerged: CSSProperties = actionsStyle ? { ...ACTIONS, ...actionsStyle } : ACTIONS;
  return (
    <div style={rootStyle}>
      <div style={subtitle ? TITLE_BLOCK : TITLE_BLOCK_FIXED}>
        <h1 id={titleId} style={TITLE}>{title}</h1>
        {subtitle && <p style={SUBTITLE}>{subtitle}</p>}
      </div>
      {actions && <div style={actionsMerged}>{actions}</div>}
    </div>
  );
}

/* Bordered white card that fills the shell's scroll area; the page header sits
   inside it as its first child. */
export function CandidatePagePanel({ children }: { children: ReactNode }) {
  return <div style={PANEL}>{children}</div>;
}

/* Centered column for screens that should not stretch across wide monitors. */
export function CandidatePageContainer({ children, maxWidth = 960 }: { children: ReactNode; maxWidth?: number }) {
  const style: CSSProperties = { ...COLUMN_BASE, maxWidth };
  return <div style={style}>{children}</div>;
}
