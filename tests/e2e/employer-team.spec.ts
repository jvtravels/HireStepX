import { test, expect, type Page, type Route } from "@playwright/test";
import { installMocks } from "./_authed-helpers";

/** /employer/team with a fully mocked network: members, seat limit, activity attribution. */

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const PROFILE = {
  status: "approved", companyName: "Acme Technologies", website: "https://acme.example", logoUrl: null,
  verificationTier: "email_verified", limits: { unlocksPerDay: 25, openRequirements: 15, rematchesPerHour: 20 },
  suspended: false, features: { teams: true },
};

const member = (userId: string, role: string, name: string, over: Record<string, unknown> = {}) => ({
  userId, role, name, email: `${name.toLowerCase()}@acme.com`, joinedAt: ago(100), lastActiveAt: ago(2), invitedBy: null, isYou: false, ...over,
});

const TEAM = {
  me: { userId: "u-owner", role: "owner", email: "priya@acme.com" },
  members: [member("u-owner", "owner", "Priya", { isYou: true }), member("u-dev", "admin", "Dev"), member("u-asha", "member", "Asha")],
  invites: [],
  assignableRoles: ["admin", "member", "viewer"],
  limits: { maxTeamSize: 5, invitesPerDay: 20, inviteTtlDays: 7 },
};

const EVENTS = [
  { id: "e1", at: ago(1), action: "candidate.messaged", entityType: "match", entityId: "m1", meta: { candidateName: "Rahul S.", jobTitle: "Senior Backend Engineer" }, actor: { userId: "u-asha", name: "Asha", removed: false } },
  { id: "e2", at: ago(2), action: "candidate.unlocked", entityType: "match", entityId: "m1", meta: { candidateName: "Rahul S." }, actor: { userId: "u-dev", name: "Dev", removed: false } },
];

async function installTeamMocks(page: Page, team = TEAM) {
  await page.route("**/api/**", (route) => json(route, {}));
  await installMocks(page);
  await page.route(/\/api\/employer-profile/, (route) => json(route, PROFILE));
  await page.route(/\/api\/employer-requirements/, (route) => json(route, { requirements: [] }));
  await page.route(/\/api\/employer-team$/, (route) => json(route, team));
  await page.route(/\/api\/employer-team-activity/, (route) =>
    json(route, { events: EVENTS, nextBefore: null, summary: [], summaryDays: 30 }));
}

test.describe("employer team page", () => {
  test("lists everyone with their role and the seat count", async ({ page }) => {
    await installTeamMocks(page);
    await page.goto("/employer/team");

    await expect(page.getByRole("heading", { level: 1, name: "Team" })).toBeVisible({ timeout: 15_000 });
    const table = page.getByRole("table", { name: "Team members" });
    await expect(table.getByText("Priya", { exact: true })).toBeVisible();
    await expect(table.getByText("Dev", { exact: true })).toBeVisible();
    await expect(table.getByText("Asha", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite teammate" })).toBeEnabled();
  });

  test("disables inviting once all five seats are taken", async ({ page }) => {
    const full = { ...TEAM, members: [...TEAM.members, member("u-4", "member", "Meera"), member("u-5", "viewer", "Kabir")] };
    await installTeamMocks(page, full);
    await page.goto("/employer/team");

    await expect(page.getByRole("button", { name: "Invite teammate" })).toBeDisabled({ timeout: 15_000 });
    await expect(page.getByRole("status").filter({ hasText: "5-seat limit" })).toBeVisible();
  });

  test("activity says who unlocked and who messaged each candidate", async ({ page }) => {
    await installTeamMocks(page);
    await page.goto("/employer/team");

    await page.getByRole("tab", { name: "Activity" }).click();
    const messaged = page.getByRole("listitem").filter({ hasText: "messaged" });
    await expect(messaged).toContainText("Asha");
    await expect(messaged).toContainText("Rahul S.");
    await expect(messaged).toContainText("for Senior Backend Engineer");
    await expect(page.getByRole("listitem").filter({ hasText: "unlocked" })).toContainText("Dev");
  });

  test("a viewer sees the team and roles but neither invites nor activity", async ({ page }) => {
    const asViewer = {
      ...TEAM,
      me: { userId: "u-asha", role: "viewer", email: "asha@acme.com" },
      members: TEAM.members.map((m) => ({ ...m, isYou: m.userId === "u-asha", role: m.userId === "u-asha" ? "viewer" : m.role })),
    };
    await installTeamMocks(page, asViewer);
    await page.goto("/employer/team");

    await expect(page.getByRole("tab", { name: "Members" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("tab", { name: "Roles" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Activity" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Invites" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Invite teammate" })).toHaveCount(0);
  });
});
