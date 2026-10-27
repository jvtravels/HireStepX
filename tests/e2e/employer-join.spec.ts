import { test, expect, type Page, type Route } from "@playwright/test";
import { installMocks } from "./_authed-helpers";

/**
 * The invite landing page, /employer/join?token=…, with a fully mocked network.
 * The signed-in test user's email is rls-e2e@test.hirestepx.com (see
 * _authed-helpers), so the preview below is addressed to that or to someone else.
 */

const TOKEN = "t".repeat(43);
const URL_PATH = `/employer/join?token=${TOKEN}`;
const MY_EMAIL = "rls-e2e@test.hirestepx.com";

const preview = (over: Record<string, unknown> = {}) => ({
  state: "pending", companyName: "Acme Technologies", role: "member", email: MY_EMAIL, inviterName: "Priya Nair", ...over,
});

async function mockPreview(page: Page, body: unknown, status = 200) {
  await page.route(/\/api\/employer-team-accept\?token=/, (route: Route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }));
}

test.describe("employer join page: signed out", () => {
  test("shows who invited you and sends you to sign up or log in with the link preserved", async ({ page }) => {
    await mockPreview(page, preview());
    await page.goto(URL_PATH);

    await expect(page.getByRole("heading", { name: "Join Acme Technologies on HireStepX" })).toBeVisible();
    await expect(page.getByText("Priya Nair", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(MY_EMAIL).first()).toBeVisible();
    await expect(page.getByText("Member:", { exact: false })).toBeVisible();

    const next = encodeURIComponent(URL_PATH);
    await expect(page.getByRole("link", { name: "Create account to join" })).toHaveAttribute("href", `/signup?next=${next}`);
    await expect(page.getByRole("link", { name: "I already have an account" })).toHaveAttribute("href", `/login?next=${next}`);
  });

  test("the page only ever sends a Referer to its own origin", async ({ page }) => {
    await mockPreview(page, preview(), 200);
    const res = await page.goto(URL_PATH);
    const html = await res!.text();
    expect(html).toMatch(/<meta name="referrer" content="same-origin"/);
  });

  test("explains an unknown link instead of a blank page", async ({ page }) => {
    await mockPreview(page, { error: "invalid" }, 404);
    await page.goto(URL_PATH);
    await expect(page.getByRole("heading", { name: "We couldn't find this invite" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to log in" })).toBeVisible();
  });

  test("shows the dead-link reason for an expired invite", async ({ page }) => {
    await mockPreview(page, preview({ state: "expired" }));
    await page.goto(URL_PATH);
    await expect(page.getByRole("heading", { name: "This invite has expired" })).toBeVisible();
    await expect(page.getByText("Ask Priya Nair to send you a new one.")).toBeVisible();
  });

  test("treats a missing token as an invalid link", async ({ page }) => {
    await page.goto("/employer/join");
    await expect(page.getByRole("heading", { name: "We couldn't find this invite" })).toBeVisible();
  });

  test("offers a retry when the preview request fails", async ({ page }) => {
    await mockPreview(page, { error: "boom" }, 500);
    await page.goto(URL_PATH);
    await expect(page.getByRole("heading", { name: "Something went wrong" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

test.describe("employer join page: signed in", () => {
  test.beforeEach(async ({ page }) => {
    await installMocks(page);
  });

  test("joins with one click and lands in the console", async ({ page }) => {
    await mockPreview(page, preview());
    let posted: unknown = null;
    await page.route(/\/api\/employer-team-accept$/, async (route: Route) => {
      if (route.request().method() !== "POST") return route.fallback();
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, companyName: "Acme Technologies", role: "member" }) });
    });
    await page.route((u) => u.pathname === "/employer", (route: Route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<title>console</title><h1>Console</h1>" }));

    await page.goto(URL_PATH);
    await page.getByRole("button", { name: "Join Acme Technologies" }).click();
    await page.waitForURL((u) => u.pathname === "/employer");
    expect(posted).toEqual({ token: TOKEN });
  });

  test("tells a signed-in stranger the invite is for someone else and offers to switch account", async ({ page }) => {
    await mockPreview(page, preview({ email: "someone.else@acme.com" }));
    await page.goto(URL_PATH);
    await expect(page.locator("p[role=alert]")).toContainText(`signed in as ${MY_EMAIL}, but this invite is for someone.else@acme.com`);
    await expect(page.getByRole("button", { name: "Switch account" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Join / })).toHaveCount(0);
  });

  test("shows the server's reason and a way out when accepting fails", async ({ page }) => {
    await mockPreview(page, preview());
    await page.route(/\/api\/employer-team-accept$/, async (route: Route) => {
      if (route.request().method() !== "POST") return route.fallback();
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "You already belong to a company.", code: "already_member" }) });
    });
    await page.goto(URL_PATH);
    await page.getByRole("button", { name: "Join Acme Technologies" }).click();
    await expect(page.locator("p[role=alert]")).toContainText("You're already on a team.");
    await expect(page.getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute("href", "/employer");
  });

  test("lets you retry after a transient failure", async ({ page }) => {
    await mockPreview(page, preview());
    let attempts = 0;
    await page.route(/\/api\/employer-team-accept$/, async (route: Route) => {
      if (route.request().method() !== "POST") return route.fallback();
      attempts += 1;
      await route.fulfill(attempts === 1
        ? { status: 500, contentType: "application/json", body: JSON.stringify({ error: "Something went wrong. Please try again." }) }
        : { status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.route((u) => u.pathname === "/employer", (route: Route) => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Console</h1>" }));
    await page.goto(URL_PATH);
    const join = page.getByRole("button", { name: "Join Acme Technologies" });
    await join.click();
    await expect(page.locator("p[role=alert]")).toContainText("Something went wrong");
    await expect(join).toBeEnabled();
    await join.click();
    await page.waitForURL((u) => u.pathname === "/employer");
    expect(attempts).toBe(2);
  });
});
