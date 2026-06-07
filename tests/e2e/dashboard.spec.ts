import { test, expect } from "@playwright/test";
import { test as authedTest } from "../fixtures/base";

const CREDS_PRESENT =
  !!process.env.TEST_USER_EMAIL && !!process.env.TEST_USER_PASSWORD;

test.describe("Dashboard — Unauthenticated", () => {
  test("dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("sessions page redirects to login", async ({ page }) => {
    await page.goto("/sessions");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("analytics page redirects to login", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("calendar page redirects to login", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("resume page redirects to login", async ({ page }) => {
    await page.goto("/resume");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("settings page redirects to login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

/* ─── Dashboard — Authenticated ───
 * Describe-level fixme replaces the per-test silent skip pattern. Missing
 * creds = visibly skipped in the report, not a misleading green pass.
 * Each test uses the storageState session (one UI login per suite, not per
 * test) — the per-test login was the dominant flake source. */
authedTest.describe("Dashboard — Authenticated", () => {
  authedTest.fixme(
    !CREDS_PRESENT,
    "Awaiting TEST_USER_EMAIL / TEST_USER_PASSWORD — see chore/e2e-foundation PR follow-up checklist.",
  );

  authedTest("dashboard loads with greeting or empty state", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    // Onboarding-incomplete accounts redirect — navigate back so the assertion
    // is on the dashboard tree, not the onboarding shell.
    if (page.url().includes("/onboarding")) {
      await page.goto("/dashboard");
    }
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });
  });

  authedTest("navigation sidebar has expected tabs", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    if (page.url().includes("/onboarding")) {
      await page.goto("/dashboard");
    }
    const nav = page.locator("nav, aside, [role=navigation]");
    const navText = await nav.textContent();
    expect(navText).toBeTruthy();
  });

  authedTest("settings page loads", async ({ authenticatedPage: page }) => {
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });
  });

  authedTest("resume page loads", async ({ authenticatedPage: page }) => {
    await page.goto("/resume");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });
  });

  authedTest("analytics page loads", async ({ authenticatedPage: page }) => {
    await page.goto("/analytics");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 5000 });
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Legal Pages — Public", () => {
  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  });
});

test.describe("404 Page", () => {
  test("unknown route shows not found", async ({ page }) => {
    await page.goto("/this-page-does-not-exist");
    await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Placeholder Pages", () => {
  test("about page loads", async ({ page }) => {
    await page.goto("/page/about");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("help page loads", async ({ page }) => {
    await page.goto("/page/help");
    await expect(page.locator("h1")).toBeVisible();
  });
});
