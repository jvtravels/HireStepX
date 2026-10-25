import { test, expect } from "@playwright/test";

/*
 * Pricing E2E for the 2.0 /pricing page. Source of truth for amounts is
 * data/plans: Free ₹0 (2 sessions), Sprint Pack ₹39 (5 sessions, 30 days),
 * Single session ₹9. No subscriptions, so no auto-renew.
 */

test.describe("Pricing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/first 2 sessions are free/i);
  });

  test("shows the three canonical prices", async ({ page }) => {
    const body = page.locator("main");
    await expect(body.getByText("₹0", { exact: true }).first()).toBeVisible();
    await expect(body.getByText("₹39", { exact: true }).first()).toBeVisible();
    await expect(body.getByText("₹9", { exact: true }).first()).toBeVisible();
  });

  test("Sprint Pack is flagged as best value with its per-session maths", async ({ page }) => {
    await expect(page.getByText("Best value").first()).toBeVisible();
    await expect(page.getByText(/₹7\.80 a session/)).toBeVisible();
    await expect(page.getByText("Valid for 30 days").first()).toBeVisible();
  });

  test("single session credit never expires and there is no auto-renew", async ({ page }) => {
    await expect(page.getByText("Credit never expires").first()).toBeVisible();
    await expect(page.getByText("No auto-renew").first()).toBeVisible();
  });

  test("removed plans are not shown", async ({ page }) => {
    await expect(page.getByText("Annual")).toHaveCount(0);
    await expect(page.getByText("₹149")).toHaveCount(0);
    await expect(page.getByText("₹1,199")).toHaveCount(0);
  });

  test("every plan CTA links to signup", async ({ page }) => {
    for (const name of [/Start practising/, /Get the pack/, /Buy one/]) {
      const link = page.getByRole("link", { name }).first();
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", "/signup");
    }
  });
});

test.describe("Pricing page, mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("plan CTAs are reachable and nothing overflows horizontally", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("link", { name: /Get the pack/ }).first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
