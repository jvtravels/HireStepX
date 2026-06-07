import { test as base, expect } from "@playwright/test";
import { test as authedTest } from "../fixtures/base";

/* ─── Unauthenticated guard checks ─── */
base.describe("Onboarding — Unauthenticated", () => {
  base("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  base("onboarding complete page redirects without auth", async ({ page }) => {
    await page.goto("/onboarding/complete");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

/* ─── Authed surface checks ───
 *
 * Pre-Phase-3 these only assert that the onboarding shell renders for a
 * seeded user — the full 3-step flow (resume upload + profile write +
 * dashboard land) is owned by onboarding-e2e.spec.ts (P1 in .test-plan.md).
 *
 * Each assertion runs unconditionally — no `if (visible)` no-ops. If the
 * element isn't there for the seeded test user, the test should FAIL, not
 * silently pass. */
authedTest.describe("Onboarding — Authenticated shell", () => {
  authedTest("onboarding shell renders with step indicator", async ({ authenticatedPage: page }) => {
    await page.goto("/onboarding");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("h1, h2, h3").first()).toBeVisible({ timeout: 10_000 });
  });

  authedTest("role autocomplete suggests on focus", async ({ authenticatedPage: page }) => {
    await page.goto("/onboarding");
    const roleInput = page.locator("input[placeholder*='role' i], #target-role").first();
    await roleInput.focus();
    await expect(page.locator("[role=listbox]")).toBeVisible({ timeout: 3000 });
  });

  authedTest("role autocomplete filters on input", async ({ authenticatedPage: page }) => {
    await page.goto("/onboarding");
    const roleInput = page.locator("input[placeholder*='role' i], #target-role").first();
    await roleInput.fill("Data Sci");
    const listbox = page.locator("[role=listbox]");
    await expect(listbox).toBeVisible({ timeout: 3000 });
    await expect(listbox.getByText("Data Scientist")).toBeVisible();
  });

  authedTest("company autocomplete filters on input", async ({ authenticatedPage: page }) => {
    await page.goto("/onboarding");
    const companyInput = page.locator("input[placeholder*='company' i], #target-company").first();
    await companyInput.fill("Raz");
    const listbox = page.locator("[role=listbox]");
    await expect(listbox).toBeVisible({ timeout: 3000 });
    await expect(listbox.getByText("Razorpay")).toBeVisible();
  });

  authedTest("autocomplete closes on Escape", async ({ authenticatedPage: page }) => {
    await page.goto("/onboarding");
    const roleInput = page.locator("input[placeholder*='role' i], #target-role").first();
    await roleInput.focus();
    await expect(page.locator("[role=listbox]")).toBeVisible({ timeout: 3000 });
    await page.keyboard.press("Escape");
    await expect(page.locator("[role=listbox]")).not.toBeVisible();
  });
});
