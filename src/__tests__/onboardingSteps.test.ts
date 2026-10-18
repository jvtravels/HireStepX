import { describe, it, expect } from "vitest";
import type { RequirementSummary } from "../employer/mockData";
import type { EmployerDashboardData } from "../employer/dashboardData";
import { deriveOnboardingSteps, firstShortlistJob, hasProgressedCandidate } from "../employer/onboardingSteps";

const job = (id: string, topMatches: number, candidateCount: number) => ({ id, candidateCount, aiScreening: { topMatches } }) as RequirementSummary;
const dash = (over: Partial<EmployerDashboardData>) => ({ jobs: [], upcomingInterviews: [], ...over }) as EmployerDashboardData;

describe("onboarding steps", () => {
  it("starts with nothing done and points the first step at the job form", () => {
    const steps = deriveOnboardingSteps({ jobs: [], reviewed: null, unlocked: null });
    expect(steps.map((s) => s.done)).toEqual([false, false, false]);
    expect(steps[0].href).toBe("/employer/requirements/new");
    expect(steps[1].href).toBe("/employer/jobs");
  });

  it("marks the first step done once a job exists and sends the next two to that job's shortlist", () => {
    const steps = deriveOnboardingSteps({ jobs: [job("a", 0, 0), job("b", 3, 12)], reviewed: false, unlocked: false });
    expect(steps.map((s) => s.done)).toEqual([true, false, false]);
    expect(steps[1].href).toBe("/employer/requirements/b");
    expect(steps[2].href).toBe("/employer/requirements/b");
    expect(steps[1].cta).toBe("Open shortlist");
  });

  it("says matching is still running when no job has candidates yet", () => {
    const steps = deriveOnboardingSteps({ jobs: [job("a", 0, 0)], reviewed: false, unlocked: false });
    expect(steps[1].cta).toBe("View your jobs");
    expect(steps[1].body).toContain("Matching runs");
  });

  it("counts an unlock as having reviewed a match", () => {
    const steps = deriveOnboardingSteps({ jobs: [job("a", 2, 5)], reviewed: false, unlocked: true });
    expect(steps.map((s) => s.done)).toEqual([true, true, true]);
  });

  it("treats unknown state as not done", () => {
    const steps = deriveOnboardingSteps({ jobs: [job("a", 2, 5)], reviewed: null, unlocked: null });
    expect(steps.map((s) => s.done)).toEqual([true, false, false]);
  });

  it("reads review progress from the dashboard feed", () => {
    expect(hasProgressedCandidate(null)).toBeNull();
    expect(hasProgressedCandidate(dash({ jobs: [{ requirementId: "a", interviewing: 0, hired: 0, lastUpdatedAt: null }] }))).toBe(false);
    expect(hasProgressedCandidate(dash({ jobs: [{ requirementId: "a", interviewing: 1, hired: 0, lastUpdatedAt: null }] }))).toBe(true);
  });

  it("picks the job with the most strong matches, then the most candidates", () => {
    expect(firstShortlistJob([job("a", 1, 9), job("b", 4, 2), job("c", 4, 7)])?.id).toBe("c");
    expect(firstShortlistJob([])).toBeNull();
  });
});
