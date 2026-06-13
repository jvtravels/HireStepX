/* Prep Runway engine (PRI-35) — pure scheduling logic.
 *
 * When a real interview is logged, this derives the adaptive countdown of AI
 * mock-prep sessions that lead up to it: a calibration run a week out, a
 * targeted drill, a company-flavored mock, a confidence run the day before,
 * and a reflection a couple of hours after. Each pre-interview node deep-links
 * into a pre-configured mock (company + round + focus + difficulty prefilled).
 *
 * Everything here is side-effect-free and edge-safe (no Node APIs, no clock
 * reads) so the handler can stay focused on persistence and this can be
 * unit-tested deterministically — see src/__tests__/prepRunway.test.ts.
 */

const DAY = 1440; // minutes

/** A logged real interview, the anchor the runway counts down to. */
export interface PrepRunwayParent {
  id: string;
  start_utc: string | null;
  company: string;
  type: string; // the round, e.g. "System Design", "Behavioral"
  timezone: string;
}

/** One scheduled node of the runway, ready to be persisted as a prep-session. */
export interface PrepSessionPlan {
  offsetLabel: string; // "T-7", "T-4", "T-2", "T-1", "T+2h"
  title: string;
  start_utc: string;
  duration_minutes: number;
  mockType: string; // normalized /session/new `type` param
  focus: string;
  difficulty: string; // "warmup" | "standard" | "hard"
  isReflection: boolean;
  /** Relative launch URL for the prefilled mock, or "" for the reflection. */
  deepLink: string;
}

/** Map a human round label to the interview engine's `type` query param. */
export function mockTypeForRound(round: string): string {
  const r = (round || "").toLowerCase();
  if (r.includes("system")) return "system_design";
  if (r.includes("tech") || r.includes("coding")) return "technical";
  if (r.includes("case")) return "case";
  if (r.includes("salary") || r.includes("negotiat")) return "salary-negotiation";
  // Phone screens, culture fit, behavioral, final rounds all map to behavioral.
  return "behavioral";
}

/** Build a /session/new deep link that prefills the mock from the interview. */
export function prepLaunchUrl(opts: {
  company: string;
  mockType: string;
  focus: string;
  difficulty: string;
}): string {
  const q = new URLSearchParams();
  q.set("type", opts.mockType);
  if (opts.company) q.set("company", opts.company);
  if (opts.focus && opts.focus !== "general") q.set("focus", opts.focus);
  if (opts.difficulty) q.set("difficulty", opts.difficulty);
  q.set("source", "prep-runway");
  return `/session/new?${q.toString()}`;
}

/** Adapt difficulty from the most recent mock score (0-100). Strong runs get
 *  stretched to "hard"; we never pile "hard" on a struggling candidate. A
 *  missing score leaves the ladder's baseline untouched. */
export function adaptDifficulty(base: string, recentScore?: number): string {
  if (typeof recentScore !== "number" || !Number.isFinite(recentScore)) return base;
  if (recentScore >= 85 && base === "standard") return "hard";
  if (recentScore < 50 && base === "hard") return "standard";
  return base;
}

interface LadderRung {
  offsetLabel: string;
  offsetMinutes: number; // signed, relative to the interview start
  title: (company: string) => string;
  duration: number;
  focus: string;
  baseDifficulty: string;
  isReflection: boolean;
}

/** The fixed shape of the runway. Times are anchored to the interview's own
 *  wall-clock instant (same time-of-day, N days earlier), which keeps prep in
 *  the candidate's normal practice window without a tz-math round trip. */
const LADDER: LadderRung[] = [
  { offsetLabel: "T-7", offsetMinutes: -7 * DAY, title: () => "Calibration mock", duration: 30, focus: "general", baseDifficulty: "warmup", isReflection: false },
  { offsetLabel: "T-4", offsetMinutes: -4 * DAY, title: () => "Targeted drill", duration: 45, focus: "weak-areas", baseDifficulty: "standard", isReflection: false },
  { offsetLabel: "T-2", offsetMinutes: -2 * DAY, title: (co) => (co ? `${co} mock` : "Company-flavored mock"), duration: 60, focus: "general", baseDifficulty: "standard", isReflection: false },
  { offsetLabel: "T-1", offsetMinutes: -1 * DAY, title: () => "Confidence run", duration: 45, focus: "general", baseDifficulty: "standard", isReflection: false },
  { offsetLabel: "T+2h", offsetMinutes: 120, title: () => "Reflection", duration: 15, focus: "general", baseDifficulty: "warmup", isReflection: true },
];

/** Derive the prep-session ladder for a logged interview. Only nodes whose
 *  scheduled instant is still in the future (relative to `now`) are returned,
 *  so logging an interview three days out skips the already-passed T-7/T-4. */
export function buildPrepRunway(
  parent: PrepRunwayParent,
  ctx: { now: string; recentScore?: number },
): PrepSessionPlan[] {
  const anchorMs = parent.start_utc ? Date.parse(parent.start_utc) : NaN;
  const nowMs = Date.parse(ctx.now);
  if (Number.isNaN(anchorMs) || Number.isNaN(nowMs)) return [];

  const mockType = mockTypeForRound(parent.type);
  const plans: PrepSessionPlan[] = [];

  for (const rung of LADDER) {
    const startMs = anchorMs + rung.offsetMinutes * 60_000;
    if (startMs <= nowMs) continue; // already passed — don't schedule the past

    const difficulty = rung.isReflection ? "warmup" : adaptDifficulty(rung.baseDifficulty, ctx.recentScore);
    plans.push({
      offsetLabel: rung.offsetLabel,
      title: rung.title(parent.company),
      start_utc: new Date(startMs).toISOString(),
      duration_minutes: rung.duration,
      mockType,
      focus: rung.focus,
      difficulty,
      isReflection: rung.isReflection,
      deepLink: rung.isReflection ? "" : prepLaunchUrl({ company: parent.company, mockType, focus: rung.focus, difficulty }),
    });
  }
  return plans;
}

/** Shape a runway node into a body the calendar-save normalizer accepts. */
export function planToEventBody(
  plan: PrepSessionPlan,
  parent: PrepRunwayParent,
): Record<string, unknown> {
  return {
    title: `${plan.title} · ${plan.offsetLabel}`,
    company: parent.company,
    type: plan.isReflection ? "reflection" : plan.mockType,
    start_utc: plan.start_utc,
    duration: plan.duration_minutes,
    notes: plan.isReflection
      ? "Reflect on how the interview went. Your notes feed real questions back into your practice bank."
      : `Auto-scheduled prep. Launch the mock: ${plan.deepLink}`,
    timezone: parent.timezone,
    kind: "prep-session",
    parent_interview_id: parent.id,
    source: "prep-runway",
    status: "upcoming",
    reminders: plan.isReflection ? [{ channel: "email", minutesBefore: 0 }] : true,
  };
}
