/* Where this session leaves the round, and the one thing to fix first.
 * Pure presentation. */

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReportCardShell } from "./_primitives";
import { roundProgressDetail, roundProgressHeadline, type RoundProgress } from "../roundProgress";

export function RoundProgressStrip({
  progress,
  fixFirst,
  practiceHref,
}: {
  progress: RoundProgress | null;
  fixFirst?: { name: string; tip: string };
  practiceHref?: string;
}) {
  const fix = fixFirst && fixFirst.name.trim() ? fixFirst : undefined;
  if (!progress && !fix) return null;
  const dots = progress ? Array.from({ length: progress.required }, (_, i) => i < progress.qualifying) : [];
  return (
    <ReportCardShell id="ir-section-round" ariaLabelledBy="ir-round-heading" padding="24px 0">
      {progress ? (
        <div className="flex items-start gap-3.5">
          <div aria-hidden className="flex gap-1.5 pt-2">
            {dots.map((on, i) => (
              <span
                key={i}
                className={`size-2.5 rounded-full border-[1.5px] ${on ? "border-hx-success bg-hx-success" : "border-hx-line bg-transparent"}`}
              />
            ))}
          </div>
          <div className="min-w-0">
            <h2 id="ir-round-heading" className="m-0 text-base font-semibold text-hx-coal">
              {roundProgressHeadline(progress)}
            </h2>
            <p className="mt-1 mb-0 text-sm leading-snug text-hx-ink-soft">{roundProgressDetail(progress)}</p>
          </div>
        </div>
      ) : (
        <h2 id="ir-round-heading" className="sr-only">
          Fix first
        </h2>
      )}
      {fix && (
        <div className={`flex flex-wrap items-center justify-between gap-3 ${progress ? "mt-5" : ""}`}>
          <div className="min-w-0 flex-[1_1_280px]">
            <p className="m-0 text-sm font-semibold text-hx-ink-soft">Fix first</p>
            <p className="mt-0.5 mb-0 text-sm leading-snug text-hx-coal">
              <strong>{fix.name}.</strong> {fix.tip}
            </p>
          </div>
          {practiceHref && (
            <Button asChild variant="outline">
              <Link href={practiceHref}>Practice again</Link>
            </Button>
          )}
        </div>
      )}
    </ReportCardShell>
  );
}
