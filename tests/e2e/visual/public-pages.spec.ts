import { test, expect } from "@playwright/test";

/* HireStepX — visual regression tests for public surfaces.
 *
 * These snapshots cover the pages no logged-in user data can change:
 * landing, pricing, login, signup, forgot-password. They catch
 * accidental CSS regressions, broken layouts after a Tailwind upgrade,
 * and unintended typography drift that unit tests can't see.
 *
 * NOT covered here: dashboard, interview, score report. Those depend
 * on mocked auth + mocked LLM + mocked audio — too many moving parts
 * for a stable baseline. Add them once the network/auth mocking
 * harness from dashboard-authed.spec.ts is generalized.
 *
 * Updating baselines after an intentional design change:
 *   npx playwright test tests/e2e/visual --update-snapshots
 *
 * Snapshots are project-scoped (chromium / mobile / iPad) so each
 * device class has its own baseline.
 */

/* Each test waits for "networkidle" before snapping so loaded fonts
   and async hero animations don't race the screenshot. The 500ms
   settle is belt-and-braces for any framer-motion fades. */
async function waitForStable(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
}

test.describe("Public surfaces — visual regression", () => {
  test("landing page renders the editorial hero stably", async ({ page }) => {
    await page.goto("/");
    await waitForStable(page);
    /* `fullPage: true` snapshots the whole scroll length so footer,
       pricing tiles, testimonials are all covered in one baseline. */
    await expect(page).toHaveScreenshot("landing.png", {
      fullPage: true,
      /* 0.2% pixel tolerance covers font hinting jitter across runs.
         Real layout regressions blow well past this threshold. */
      maxDiffPixelRatio: 0.002,
      /* Mask elements that animate or depend on the live clock —
         streak banners, "X people practiced today" counters etc. */
      mask: [page.locator("[data-visual-mask]")],
    });
  });

  test("pricing page", async ({ page }) => {
    await page.goto("/pricing");
    await waitForStable(page);
    await expect(page).toHaveScreenshot("pricing.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });
  });

  test("login screen", async ({ page }) => {
    await page.goto("/login");
    await waitForStable(page);
    await expect(page).toHaveScreenshot("login.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });
  });

  test("signup screen", async ({ page }) => {
    await page.goto("/signup");
    await waitForStable(page);
    await expect(page).toHaveScreenshot("signup.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });
  });

  test("forgot-password screen", async ({ page }) => {
    await page.goto("/forgot-password");
    await waitForStable(page);
    await expect(page).toHaveScreenshot("forgot-password.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.002,
    });
  });
});
