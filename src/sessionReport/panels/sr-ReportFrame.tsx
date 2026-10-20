/* Page chrome shared by every session-report variant: the candidate-app
 * panel + header (same as Jobs / Sessions / Settings), then the body. */

import type { ReactNode } from "react";
import CandidatePageHeader, { CandidatePagePanel } from "../../CandidatePageHeader";

export function ReportFrame({
  title = "Session report",
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CandidatePagePanel>
      <CandidatePageHeader title={title} subtitle={subtitle} actions={actions} padding="20px 28px" />
      {children}
    </CandidatePagePanel>
  );
}

/* Scrolling content area under the header (and tab bar, when present). */
export function ReportBody({ children, id, labelledBy }: { children: ReactNode; id?: string; labelledBy?: string }) {
  return (
    <div
      id={id}
      role={id ? "tabpanel" : undefined}
      aria-labelledby={labelledBy}
      className="ir-frame-body min-h-0 flex-1 overflow-y-auto font-sans px-4 pb-12 pt-2 text-foreground min-[900px]:px-7"
    >
      {children}
    </div>
  );
}
