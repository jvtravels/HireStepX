import { profileFromRole } from "./roleInterviewMatrix";
import { isEnabled } from "./featureFlags";
import type { RoundStatus } from "./focusRounds";

/* Focus label → interview type key (the `focus` / `type` URL param and the
   session script key). */
export const FOCUS_TO_TYPE: Record<string, string> = {
  "Behavioral": "behavioral",
  "Strategic": "strategic",
  "Technical Leadership": "technical",
  "Case Study": "case-study",
  "Salary Negotiation": "salary-negotiation",
  "Panel Interview": "panel",
  "Campus Placement": "campus-placement",
  "HR Round": "hr-round",
  "Management": "management",
  "Government / PSU": "government-psu",
};

/* MVP launch (2026-06): these focuses are shown but not selectable. Behavioral,
   Campus Placement, HR Round and Salary Negotiation are live; to ship one of
   these, remove it here. Salary Negotiation also needs its kill switch on. */
const STATIC_COMING_SOON = new Set([
  "Strategic",
  "Technical Leadership",
  "Case Study",
  "Management",
  "Panel Interview",
  "Government / PSU",
]);

/* Evaluated per call, not at module load, so a PostHog flag that loads after
   first paint takes effect on the next render. */
export function isFocusComingSoon(focus: string): boolean {
  return STATIC_COMING_SOON.has(focus) || (focus === "Salary Negotiation" && !isEnabled("SALARY_NEGOTIATION_MODE"));
}

export interface FocusPick {
  focus: string;
  reason: string;
}

const REASON = {
  campus: "Built for first-job interviews: your introduction, projects and teamwork.",
  hr: "The screen most employers run first: motivation, strengths, notice period and salary expectations.",
  behavioral: "Real examples of how you handle pressure, conflict and ownership. Useful in every later round.",
  salary: "Practise countering an offer before you reply to a real one.",
  hrInvited: "Most employers open with an HR screen. Rehearse it before yours.",
  behavioralLater: "Later rounds dig into situations you've handled. Have your examples ready.",
  salaryHired: "You're selected. Rehearse the offer conversation before you reply.",
  keepGoing: "You've started this round. Two sessions at 70 or above clear it and show employers the proof.",
};

/* Only the live focuses are ever recommended. Salary Negotiation is last for
   everyone: it rewards a candidate who already has their story straight, so it
   is only reached early when a stage says an offer is near (see stagePicks). */
const EARLY_CAREER: FocusPick[] = [
  { focus: "Campus Placement", reason: REASON.campus },
  { focus: "HR Round", reason: REASON.hr },
  { focus: "Behavioral", reason: REASON.behavioral },
];
const EXPERIENCED: FocusPick[] = [
  { focus: "Behavioral", reason: REASON.behavioral },
  { focus: "HR Round", reason: REASON.hr },
  { focus: "Salary Negotiation", reason: REASON.salary },
];

/* What the employer's status on a match says about the round the candidate is
   walking into. Unknown statuses add nothing. */
function stagePicks(stage: string | null | undefined, early: boolean): FocusPick[] {
  switch (stage) {
    case "interview_invited":
      return [early ? { focus: "Campus Placement", reason: REASON.campus } : { focus: "HR Round", reason: REASON.hrInvited }];
    case "interviewing":
      return [{ focus: "Behavioral", reason: REASON.behavioralLater }];
    case "hired":
      return [{ focus: "Salary Negotiation", reason: REASON.salaryHired }];
    default:
      return [];
  }
}

interface FocusInput {
  role?: string;
  experienceLevel?: string;
  /** The employer's status on the match this practice is for, when there is one. */
  stage?: string | null;
  relevant: ReadonlySet<string> | null;
  isComingSoon: (focus: string) => boolean;
  /** Round status per focus label, from the candidate's practice history. */
  rounds?: Readonly<Record<string, RoundStatus>>;
}

export function isEarlyCareer(role: string | undefined, experienceLevel: string | undefined): boolean {
  if (experienceLevel === "fresher") return true;
  if (!role) return false;
  const { family, seniority } = profileFromRole(role);
  return seniority === "fresher" || family === "student";
}

/* The first focus, in order of what this candidate needs next, that is live and
   that the role's real interview loops include. A round already cleared yields
   to one that is not, so history steers the next session. */
export function recommendFocus({ role, experienceLevel, stage, relevant, isComingSoon, rounds }: FocusInput): FocusPick {
  const early = isEarlyCareer(role, experienceLevel);
  const staged = stagePicks(stage, early);
  const ordered = [...staged, ...(early ? EARLY_CAREER : EXPERIENCED)];
  const eligible = ordered.filter((p) => !isComingSoon(p.focus) && (!relevant || relevant.has(p.focus)));
  const pick = eligible.find((p) => rounds?.[p.focus] !== "cleared") ?? eligible[0];
  if (pick) return rounds?.[pick.focus] === "practising" && !staged.includes(pick) ? { focus: pick.focus, reason: REASON.keepGoing } : pick;
  const firstOpen = relevant ? [...relevant].find((f) => !isComingSoon(f)) : undefined;
  const focus = firstOpen ?? "Behavioral";
  return { focus, reason: [...EARLY_CAREER, ...EXPERIENCED].find((p) => p.focus === focus)?.reason ?? "" };
}

/* One source of truth for the "For you" badge and the pre-selected card, so the
   badge can never point at a card the role filter hides or that is locked. */
export function resolveFocusDefaults(input: FocusInput): { recommended: string; defaultFocus: string; reason: string } {
  const { focus, reason } = recommendFocus(input);
  return { recommended: focus, defaultFocus: focus, reason };
}
