/* Page chrome shared by every session-report variant: the candidate-app
 * panel + header (same as Jobs / Sessions / Settings), then the body. */

import type { ReactNode } from "react";
import { CandidatePagePanel } from "../../CandidatePageHeader";

export function ReportFrame({
  title = "Session report",
  subtitle,
  tabs,
  children,
}: {
  title?: string;
  subtitle?: string;
  tabs?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CandidatePagePanel>
      <header className="flex flex-wrap items-center justify-between gap-x-6 border-b border-border px-4 min-[900px]:px-7">
        <div className="flex min-w-0 items-baseline gap-3 py-3.5">
          <h1 className="m-0 shrink-0 text-lg font-semibold leading-6 tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="m-0 truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {tabs && <div className="ir-tab-bar -mx-1 max-w-full min-w-0 overflow-x-auto">{tabs}</div>}
      </header>
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
