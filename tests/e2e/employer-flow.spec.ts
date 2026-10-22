import { test, expect, type Page, type Route } from "@playwright/test";
import { installMocks } from "./_authed-helpers";
// Type-only imports: erased at runtime, but they make tsc reject a mock that
// drifts from the shapes the employer console actually parses.
import type { Candidate, Requirement, RequirementSummary } from "../../src/employer/mockData";
import type { EmployerDashboardData } from "../../src/employer/dashboardData";

/**
 * Employer console E2E with a fully mocked network (page.route only, no real
 * API). Reuses the candidate-side auth harness in ./_authed-helpers.ts: the
 * employer console only needs a signed-in Supabase session; "has a company"
 * is decided by GET /api/employer-profile (EmployerDataContext), mocked below.
 */

const COMPANY = "Acme Technologies";
const REQ_ID = "11111111-1111-4111-8111-111111111111";
const MATCH_ID = "22222222-2222-4222-8222-222222222222";
const JOB_TITLE = "Senior Backend Engineer";

const PROFILE = {
  status: "approved",
  companyName: COMPANY,
  website: "https://acme.example",
  logoUrl: null,
  verificationTier: "email_verified",
  limits: { unlocksPerDay: 25, openRequirements: 15, rematchesPerHour: 20 },
  suspended: false,
};

const JOB_SUMMARY: RequirementSummary = {
  id: REQ_ID,
  title: JOB_TITLE,
  location: "Bengaluru",
  noticePeriodPref: "30 days",
  status: "ready",
  stage: "ready_for_review",
  department: "Engineering",
  experienceMin: 4,
  experienceMax: 8,
  dueDate: null,
  budgetMin: null,
  budgetMax: null,
  salaryType: null,
  locations: ["Bengaluru"],
  openPositions: 1,
  workMode: "hybrid",
  skills: ["Node.js", "PostgreSQL"],
  employmentType: "full-time",
  durationWeeks: null,
  hoursPerWeek: null,
  minReadinessBand: null,
  minStarCompleteness: null,
  createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  candidateCount: 12,
  aiScreening: {
    evaluated: 12,
    totalMatched: 12,
    scoreLow: 48,
    scoreHigh: 91,
    topMatches: 3,
    strongAvgScore: 84,
    strongMatchInitials: [],
    strongMatchExtra: 0,
    strongMatches: [],
  },
};

const DASHBOARD: EmployerDashboardData = {
  range: 30,
  jobs: [{ requirementId: REQ_ID, interviewing: 2, hired: 1, lastUpdatedAt: new Date(Date.now() - 86_400_000).toISOString() }],
  totals: { interviewsScheduled: 2, hired: 1, awaitingReview: 3 },
  trends: {
    jobs: { series: [0, 1], current: 1, previous: 0 },
    recommended: { series: [1, 2], current: 3, previous: 1 },
    interviews: { series: [0, 2], current: 2, previous: 0 },
    hired: { series: [0, 1], current: 1, previous: 0 },
  },
  upcomingInterviews: [],
  recommended: [],
  activity: [],
};

const LOCKED_CANDIDATE: Candidate = {
  id: MATCH_ID,
  name: "Hidden Candidate",
  targetRole: "Backend Engineer",
  city: "Bengaluru",
  matchScore: 87,
  rosterScore: 80,
  sessionsCompleted: 4,
  lastActiveDaysAgo: 1,
  skills: ["Node.js", "PostgreSQL"],
  unlocked: false,
  candidateStatus: "shortlisted",
  candidateStatusNote: null,
  interviewScheduledAt: null,
};

const REQUIREMENT_DETAIL: Requirement = {
  ...JOB_SUMMARY,
  description: "Own the payments backend.",
  archiveReason: null,
  archiveDisposition: null,
  customSkillSets: [],
  responsibilities: "",
  niceToHave: "",
  preferredIndustry: "",
  preferredDomain: "",
  workSchedule: "",
  availability: "",
  relevantExperience: "",
  portfolioRequired: false,
  preferredColleges: [],
  targetCompanies: [],
  perksAndBenefits: [],
  lastMatchedAt: new Date().toISOString(),
  candidates: [LOCKED_CANDIDATE],
  nextUnlockBatch: null,
  totalMatched: 1,
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Auth harness plus the employer endpoints every console page loads. */
async function installEmployerMocks(page: Page): Promise<string[]> {
  // Registered first, so every more specific route below wins over it: any
  // /api/* call the console makes that a test does not care about gets a
  // benign empty object instead of reaching a real server.
  await page.route("**/api/**", (route) => json(route, {}));
  const leaked = await installMocks(page);
  await page.route(/\/api\/employer-profile/, (route) => json(route, PROFILE));
  await page.route(/\/api\/employer-requirements/, (route) => json(route, { requirements: [JOB_SUMMARY] }));
  return leaked;
}

test.describe("Employer console — mocked network", () => {
  test("dashboard renders the greeting, hiring funnel and Active Jobs list", async ({ page }) => {
    const leaked = await installEmployerMocks(page);
    await page.route(/\/api\/employer-dashboard/, (route) => json(route, DASHBOARD));

    await page.goto("/employer");

    await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible({ timeout: 15_000 });

    // The funnel's numbers are animated visually; its sr-only summary is the stable contract.
    const funnel = page.getByRole("region", { name: "Hiring funnel" });
    await expect(funnel).toContainText("3 Recommended");
    await expect(funnel).toContainText("2 Interviewing");
    await expect(funnel).toContainText("1 Hired");

    const activeJobs = page.getByRole("region", { name: "Active Jobs" });
    await expect(activeJobs.getByRole("link", { name: JOB_TITLE, exact: true })).toBeVisible();

    // The dashboard feed loaded, so the degraded-state alert must not show.
    await expect(page.getByRole("alert").filter({ hasText: "didn't load" })).toHaveCount(0);
    expect(leaked, `real Supabase calls leaked through: ${leaked.join(", ")}`).toEqual([]);
  });

  test("shows the inline 'didn't load' alert when the dashboard API fails, and Retry refetches", async ({ page }) => {
    await installEmployerMocks(page);
    let failDashboard = true;
    let dashboardCalls = 0;
    await page.route(/\/api\/employer-dashboard/, (route) => {
      dashboardCalls += 1;
      return failDashboard ? json(route, { error: "boom" }, 500) : json(route, DASHBOARD);
    });

    await page.goto("/employer");

    // getWithRetry backs off (300ms + 900ms) before giving up on a 5xx.
    const alert = page.getByRole("alert").filter({ hasText: "didn't load" });
    await expect(alert).toBeVisible({ timeout: 15_000 });
    // The jobs list does not depend on the dashboard feed, so it still renders.
    await expect(page.getByRole("region", { name: "Active Jobs" }).getByRole("link", { name: JOB_TITLE, exact: true })).toBeVisible();

    const callsBeforeRetry = dashboardCalls;
    failDashboard = false;
    await alert.getByRole("button", { name: "Retry" }).click();

    await expect(alert).toHaveCount(0, { timeout: 10_000 });
    expect(dashboardCalls).toBeGreaterThan(callsBeforeRetry);
    await expect(page.getByRole("region", { name: "Hiring funnel" })).toContainText("2 Interviewing");
  });

  test("requirement detail: the unlock dialog states the per-candidate rate", async ({ page }) => {
    await installEmployerMocks(page);
    await page.route(/\/api\/employer-dashboard/, (route) => json(route, DASHBOARD));
    await page.route(/\/api\/employer-requirement-detail/, (route) =>
      route.request().method() === "GET" ? json(route, REQUIREMENT_DETAIL) : json(route, { ok: true }),
    );

    await page.goto(`/employer/requirements/${REQ_ID}`);

    // Locked candidates are masked, so the row's icon button is labelled "Unlock for ₹N: <masked name>".
    await page.getByRole("button", { name: /^Unlock for ₹\d+: / }).first().click({ timeout: 15_000 });

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /^Unlock this candidate for ₹\d+\?$/ })).toBeVisible();
    await expect(dialog).toContainText(/₹\d+ per candidate\./);
  });
  test("outcome page: title sits inside the main container beside a candidate summary, and saving confirms", async ({ page }, testInfo) => {
    await installEmployerMocks(page);
    const saved: string[] = [];
    await page.route(/\/api\/employer-dashboard/, (route) => json(route, DASHBOARD));
    await page.route(/\/api\/employer-requirement-detail/, (route) => json(route, REQUIREMENT_DETAIL));
    await page.route(/\/api\/employer-candidate-status/, (route) => {
      const body = route.request().postDataJSON() as { candidateStatus: string };
      saved.push(body.candidateStatus);
      return json(route, { id: MATCH_ID, candidateStatus: body.candidateStatus });
    });

    await page.goto(`/employer/requirements/${REQ_ID}/outcome?candidate=${MATCH_ID}`);

    const container = page.getByRole("region", { name: "Record an outcome" });
    await expect(container.getByRole("heading", { level: 1 })).toContainText("How did it go with");
    const summary = container.getByRole("complementary", { name: "Candidate summary" });
    await expect(summary).toContainText("Match score");
    await expect(summary).toContainText("87 / 100");
    await page.screenshot({ path: testInfo.outputPath("outcome-form.png"), fullPage: true });

    await container.getByRole("radio", { name: /Rejected/ }).click();
    await container.getByRole("button", { name: "Save outcome" }).click();
    await expect.poll(() => saved).toEqual(["rejected"]);
    await expect(page.getByRole("heading", { name: "Outcome saved" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("outcome-saved.png"), fullPage: true });
  });
  test("changing a stage can be undone with the z shortcut, and the shortcuts toggle turns it off", async ({ page }) => {
    await installEmployerMocks(page);
    const unlocked: Candidate = { ...LOCKED_CANDIDATE, name: "Priya Sharma", unlocked: true, candidateStatus: "shortlisted" };
    const patches: string[] = [];
    await page.route(/\/api\/employer-dashboard/, (route) => json(route, DASHBOARD));
    await page.route(/\/api\/employer-requirement-detail/, (route) => json(route, { ...REQUIREMENT_DETAIL, candidates: [unlocked] }));
    await page.route(/\/api\/employer-candidate-status/, (route) => {
      const body = route.request().postDataJSON() as { candidateStatus: string };
      patches.push(body.candidateStatus);
      return json(route, { id: MATCH_ID, candidateStatus: body.candidateStatus });
    });

    await page.goto(`/employer/requirements/${REQ_ID}`);
    await page.getByRole("button", { name: /^Stage for Priya Sharma: To review/ }).click({ timeout: 45_000 });
    await page.getByRole("menuitem", { name: "Reject" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Confirm" }).click();
    await expect.poll(() => patches).toEqual(["rejected"]);

    await page.keyboard.press("z");
    await expect.poll(() => patches).toEqual(["rejected", "shortlisted"]);

    await page.goto("/employer/settings");
    await page.getByRole("switch", { name: "Use keyboard shortcuts" }).click({ timeout: 15_000 });
    await page.goto(`/employer/requirements/${REQ_ID}`);
    await expect(page.getByRole("button", { name: /^Stage for Priya Sharma/ })).toBeVisible({ timeout: 15_000 });
    await page.keyboard.press("?");
    await expect(page.getByRole("heading", { name: "Keyboard shortcuts" })).toHaveCount(0);
  });
});
