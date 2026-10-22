import { isAiResume, type StoredResume } from "./resumeParser";

export interface HiringFacts {
  noticePeriod: string;
  currentCtc: string;
  expectedCtc: string;
}

export const NOTICE_PERIOD_OPTIONS = ["Immediate", "15 days", "30 days", "60 days", "90 days"] as const;
export const HIRING_FACT_MAX = 40;

export const EMPTY_FACTS: HiringFacts = { noticePeriod: "", currentCtc: "", expectedCtc: "" };

const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, HIRING_FACT_MAX);

export function readHiringFacts(resume: StoredResume | null | undefined): HiringFacts {
  if (!isAiResume(resume)) return EMPTY_FACTS;
  return { noticePeriod: clean(resume.noticePeriod), currentCtc: clean(resume.currentCtc), expectedCtc: clean(resume.expectedCtc) };
}

export function sanitizeFacts(raw: HiringFacts): HiringFacts {
  return { noticePeriod: clean(raw.noticePeriod), currentCtc: clean(raw.currentCtc), expectedCtc: clean(raw.expectedCtc) };
}

export function factsChanged(a: HiringFacts, b: HiringFacts): boolean {
  const x = sanitizeFacts(a);
  const y = sanitizeFacts(b);
  return x.noticePeriod !== y.noticePeriod || x.currentCtc !== y.currentCtc || x.expectedCtc !== y.expectedCtc;
}

/** Empty strings clear the field (null) so an employer never sees a blank row. */
export function withHiringFacts<T extends StoredResume>(resume: T, facts: HiringFacts): T {
  const f = sanitizeFacts(facts);
  return { ...resume, noticePeriod: f.noticePeriod || null, currentCtc: f.currentCtc || null, expectedCtc: f.expectedCtc || null };
}

/** A fresh parse replaces resume_data wholesale; keep what the candidate chose
 *  to share unless the new resume states its own value. */
export function carryHiringFacts<T extends StoredResume>(next: T, prev: StoredResume | null | undefined): T {
  if (!isAiResume(next) || !isAiResume(prev)) return next;
  return {
    ...next,
    noticePeriod: next.noticePeriod || prev.noticePeriod || null,
    currentCtc: next.currentCtc || prev.currentCtc || null,
    expectedCtc: next.expectedCtc || prev.expectedCtc || null,
  };
}
