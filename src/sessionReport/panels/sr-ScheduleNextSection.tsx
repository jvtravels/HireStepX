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
import { t, f, shadows, radius } from "../tokens";

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

  /* Calendar icon — matches the one in NextStepsSection */
  const CalIcon = (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );

  return (
    <section
      id="ir-section-schedule"
      aria-labelledby="ir-schedule-heading"
      style={{
        background: t.white,
        border: `1px solid ${t.line}`,
        borderRadius: radius.shell,
        padding: 28,
        boxShadow: shadows.card,
        scrollMarginTop: 72,
      }}
    >
      {/* Eyebrow */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: f.mono,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: t.inkFaint,
            textTransform: "uppercase",
          }}
        >
          07
        </span>
        <span
          style={{
            width: 1,
            height: 10,
            background: t.lineStrong,
            display: "inline-block",
          }}
        />
        <span
          style={{
            fontFamily: f.sans,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: t.inkFaint,
            textTransform: "uppercase",
          }}
        >
          Plan ahead
        </span>
      </div>

      <h2
        id="ir-schedule-heading"
        style={{
          fontFamily: f.serif,
          fontSize: 22,
          fontWeight: 400,
          color: t.coal,
          margin: "0 0 18px",
          letterSpacing: "-0.01em",
        }}
      >
        When is your next session?
      </h2>

      {scheduled ? (
        /* ── Confirmation state ── */
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: t.successWash,
            border: `1px solid ${t.successAccent}`,
            borderLeft: `3px solid ${t.success}`,
            borderRadius: radius.bar,
            padding: "14px 18px",
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.xl,
              background: t.success100,
              color: t.success,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {CalIcon}
          </span>
          <div>
            <p
              style={{
                fontFamily: f.sans,
                fontSize: 13,
                fontWeight: 600,
                color: t.success,
                margin: "0 0 2px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Scheduled!
            </p>
            <p
              style={{
                fontFamily: f.sans,
                fontSize: 14,
                color: t.coal,
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              See you {formatConfirmation(scheduled)}.
            </p>
          </div>
          {/* Allow re-scheduling */}
          <button
            type="button"
            onClick={() => setScheduled(null)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              border: "none",
              fontFamily: f.sans,
              fontSize: 12,
              fontWeight: 600,
              color: t.inkSoft,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: radius.sm,
              flexShrink: 0,
            }}
          >
            Change
          </button>
        </div>
      ) : (
        /* ── Picker state ── */
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Quick-pick row */}
          <div
            style={{ display: "flex", gap: 10, flexWrap: "wrap" }}
            role="group"
            aria-label="Quick date options"
          >
            {quickPicks.map(({ label, date }) => (
              <button
                key={label}
                type="button"
                onClick={() => commit(date.toISOString())}
                style={{
                  fontFamily: f.sans,
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.indigo,
                  background: t.indigoTint,
                  border: `1px solid ${t.indigoRing}`,
                  borderRadius: radius.lg,
                  padding: "8px 16px",
                  cursor: "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    t.indigo100;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    t.indigoTint;
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{ flex: 1, height: 1, background: t.line }}
              aria-hidden="true"
            />
            <span
              style={{
                fontFamily: f.sans,
                fontSize: 11,
                color: t.inkFaint,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              or pick a date
            </span>
            <div
              style={{ flex: 1, height: 1, background: t.line }}
              aria-hidden="true"
            />
          </div>

          {/* Custom datetime-local input + Schedule button */}
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="datetime-local"
              value={customValue}
              min={toDatetimeLocal(addDays(base, 0))}
              onChange={(e) => setCustomValue(e.target.value)}
              aria-label="Choose a custom date and time"
              style={{
                fontFamily: f.sans,
                fontSize: 13,
                color: t.coal,
                background: t.creamSoft,
                border: `1px solid ${t.lineStrong}`,
                borderRadius: radius.lg,
                padding: "8px 12px",
                outline: "none",
                flex: "1 1 200px",
                minWidth: 0,
              }}
            />
            <button
              type="button"
              disabled={!customValue}
              onClick={() => {
                if (!customValue) return;
                commit(new Date(customValue).toISOString());
              }}
              style={{
                fontFamily: f.sans,
                fontSize: 13,
                fontWeight: 700,
                color: t.white,
                background: customValue ? t.indigo : t.inkFaint,
                border: "none",
                borderRadius: radius.lg,
                padding: "8px 20px",
                cursor: customValue ? "pointer" : "not-allowed",
                flexShrink: 0,
              }}
            >
              Schedule
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
