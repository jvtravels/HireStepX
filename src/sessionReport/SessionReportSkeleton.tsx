import { Skeleton } from "@/components/ui/skeleton";
import { ReportFrame, ReportBody } from "./panels/sr-ReportFrame";

/* Shown from the click on a session row until the report can render. It reuses
   the real report frame (panel, "Session report" header, tab bar) and the
   Overview's block order, so the page settles in place instead of swapping a
   different layout in. */

const TAB_WIDTHS = ["w-14", "w-[72px]", "w-12", "w-12", "w-12"] as const;

function TabBarSkeleton() {
  return (
    <div aria-hidden="true" className="flex h-12 items-center gap-6 px-2">
      {TAB_WIDTHS.map((w, i) => (
        <Skeleton key={i} className={`h-3.5 ${w} rounded-md`} />
      ))}
    </div>
  );
}

function ListSkeleton({ rows }: { rows: readonly string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3 w-24 rounded-md" />
      {rows.map((w, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <Skeleton className={`h-3.5 ${w} rounded-md`} />
        </div>
      ))}
    </div>
  );
}

export function SessionReportSkeleton() {
  return (
    <ReportFrame tabs={<TabBarSkeleton />}>
      <ReportBody>
        <div role="status" aria-busy="true" className="flex flex-col gap-7 pt-6">
          <span className="sr-only">Loading session report</span>

          <div className="grid items-center gap-7 min-[900px]:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center gap-3">
              <div className="relative size-[132px]">
                <Skeleton className="size-full rounded-full" />
                <div className="absolute inset-[10px] rounded-full bg-white" />
              </div>
              <div className="flex items-center gap-2.5">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-5 w-full rounded-md" />
              <Skeleton className="h-5 w-4/5 rounded-md" />
              <Skeleton className="mt-1 h-3.5 w-1/2 rounded-md" />
            </div>
          </div>

          <div className="grid gap-7 min-[900px]:grid-cols-2">
            <ListSkeleton rows={["w-4/5", "w-3/5"]} />
            <ListSkeleton rows={["w-3/4", "w-2/3"]} />
          </div>

          <div className="flex flex-col gap-3 border-t border-hx-line pt-6">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <Skeleton className="size-2.5 rounded-full" />
                <Skeleton className="size-2.5 rounded-full" />
              </div>
              <Skeleton className="h-4 w-56 max-w-full rounded-md" />
            </div>
            <Skeleton className="h-3.5 w-3/4 max-w-lg rounded-md" />
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-hx-line pt-6">
            <Skeleton className="h-6 w-32 rounded-md" />
            <Skeleton className="h-10 w-36 rounded-lg" />
          </div>
        </div>
      </ReportBody>
    </ReportFrame>
  );
}
