import { profileFromRole } from "./roleInterviewMatrix";

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
}

export function isEarlyCareer(role: string | undefined, experienceLevel: string | undefined): boolean {
  if (experienceLevel === "fresher") return true;
  if (!role) return false;
  const { family, seniority } = profileFromRole(role);
  return seniority === "fresher" || family === "student";
}

/* The first focus, in order of what this candidate needs next, that is live and
   that the role's real interview loops include. */
export function recommendFocus({ role, experienceLevel, stage, relevant, isComingSoon }: FocusInput): FocusPick {
  const early = isEarlyCareer(role, experienceLevel);
  const ordered = [...stagePicks(stage, early), ...(early ? EARLY_CAREER : EXPERIENCED)];
  const pick = ordered.find((p) => !isComingSoon(p.focus) && (!relevant || relevant.has(p.focus)));
  if (pick) return pick;
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
