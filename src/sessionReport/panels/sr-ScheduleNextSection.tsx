/* Schedule Next Session panel — sr-ScheduleNextSection.tsx
 * Extracted as a standalone panel following the sr-NextStepsSection pattern.
 *
 * Props:
 *   todayIso   — ISO date string provided by the parent (no Date.now() here).
 *   onSchedule — optional callback fired with the scheduled ISO date string.
 *
 * Behaviour:
 *   Three quick-pick buttons (Tomorrow / This weekend / Next week) + a
 *   datetime-local input for custom dates. On any selection the date is
 *   persisted to localStorage "hsx_next_session" and onSchedule is called.
 *   After scheduling a confirmation line replaces the controls. */

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SrSectionShell } from "./_primitives";

/* ── Date helpers ──────────────────────────────────────────────────────── */

/** Parse todayIso and return a Date with time set to 10:00 local. */
function baseDate(todayIso: string): Date {
  const d = new Date(todayIso);
  d.setHours(10, 0, 0, 0);
  return d;
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

/** Days until the coming Saturday (day 6). If today is already Saturday,
 *  returns 7 so we jump to next Saturday. */
function daysUntilSaturday(base: Date): number {
  const dow = base.getDay(); // 0 = Sun … 6 = Sat
  const diff = (6 - dow + 7) % 7;
  return diff === 0 ? 7 : diff;
}

/** Format an ISO string for the datetime-local <input> default value. */
function toDatetimeLocal(d: Date): string {
  // "YYYY-MM-DDTHH:mm" — no seconds, no TZ suffix
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

/** Human-readable confirmation label using Intl.DateTimeFormat. */
function formatConfirmation(isoDate: string): string {
  const d = new Date(isoDate);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/* ── Constants ─────────────────────────────────────────────────────────── */

const LS_KEY = "hsx_next_session";

/* ── Component ──────────────────────────────────────────────────────────── */

export function ScheduleNextSection({
  todayIso,
  onSchedule,
}: {
  /** ISO date string representing today — provided by the parent. */
  todayIso: string;
  /** Called with the ISO string of the chosen date after the user confirms. */
  onSchedule?: (isoDate: string) => void;
}) {
  const base = baseDate(todayIso);

  const quickPicks = [
    { label: "Tomorrow", date: addDays(base, 1) },
    { label: "This weekend", date: addDays(base, daysUntilSaturday(base)) },
    { label: "Next week", date: addDays(base, 7) },
  ];

  const [customValue, setCustomValue] = useState<string>(
    toDatetimeLocal(addDays(base, 1))
  );
  const [scheduled, setScheduled] = useState<string | null>(null);

  function commit(isoDate: string) {
    try {
      localStorage.setItem(LS_KEY, isoDate);
    } catch {
      // Storage may be unavailable (private mode, full quota). Silent fail.
    }
    setScheduled(isoDate);
    onSchedule?.(isoDate);
  }

  return (
    <SrSectionShell
      anchorId="ir-section-schedule"
      headingId="ir-schedule-heading"
      num="10"
      label="Plan ahead"
      title="Plan your next session"
      subtitle="Pick a time and we will keep it on your calendar."
    >
      {scheduled ? (
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="m-0 text-sm font-semibold text-foreground">Scheduled</p>
            <p className="m-0 text-sm text-muted-foreground">See you {formatConfirmation(scheduled)}.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setScheduled(null)}>
            Change
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick date options">
            {quickPicks.map(({ label, date }) => (
              <Button key={label} type="button" variant="outline" size="sm" onClick={() => commit(date.toISOString())}>
                {label}
              </Button>
            ))}
          </div>
          <span className="px-1 text-sm text-muted-foreground" aria-hidden="true">or</span>
          <Input
            type="datetime-local"
            value={customValue}
            min={toDatetimeLocal(addDays(base, 0))}
            onChange={(e) => setCustomValue(e.target.value)}
            aria-label="Choose a custom date and time"
            className="w-auto min-w-[200px] flex-1 sm:max-w-[260px]"
          />
          <Button
            type="button"
            size="sm"
            disabled={!customValue}
            onClick={() => {
              if (!customValue) return;
              commit(new Date(customValue).toISOString());
            }}
          >
            Schedule
          </Button>
        </div>
      )}
    </SrSectionShell>
  );
}
