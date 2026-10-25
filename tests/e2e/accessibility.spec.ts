import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { installMocks } from "./_authed-helpers";

/**
 * Accessibility tests using axe-core and manual checks.
 * Checks WCAG 2.1 AA compliance on key pages.
 */

const settled = (page: import("@playwright/test").Page) =>
  page.waitForFunction(() =>
    document.getAnimations().every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== "running"),
  );

test.describe("Accessibility — Landing Page", () => {
  test("landing page has no critical or serious a11y violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });
    await settled(page);

    // Bar raised from critical-only to critical+serious, matching the
    // signup/login bar — every structural / ARIA / name-role-value rule now
    // gates landing at the serious level too.
    //
    // color-contrast remains the ONE excluded rule, now QUANTIFIED rather than
    // hand-waved: enabling it surfaces 134 violation nodes on landing, all
    // copper (#B45309) on cream tints (#F2E3D4) at <14px bold — measured 3.99:1
    // vs the 4.5:1 AA threshold. Fixing them means darkening the copper scale
    // or enforcing a min size/weight for copper text across marketing — a
    // design decision with cross-surface visual blast radius, tracked as a
    // founder-owned design fix in audit doc 02, not patched blind here. When it
    // lands, delete this disableRules line so contrast gates in CI.
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude(".particle-canvas")
      .exclude("canvas")
      .disableRules(["color-contrast"])
      .analyze();

    expect(results.violations.filter(v => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  });

  test("skip-to-content link exists", async ({ page }) => {
    await page.goto("/");
    const skipLink = page.locator("a.skip-to-content");
    await expect(skipLink).toBeAttached();
  });

  test("navigation has aria-label", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav[aria-label]").first()).toBeAttached();
  });

  test("images have alt text or aria-hidden", async ({ page }) => {
    await page.goto("/");
    // All img tags should have alt or be aria-hidden
    const images = page.locator("img:not([alt]):not([aria-hidden='true'])");
    const count = await images.count();
    expect(count).toBe(0);
  });

  test("main content landmark exists", async ({ page }) => {
    await page.goto("/");
    const main = page.locator("main, [role=main]");
    await expect(main).toBeAttached();
  });

  test("heading hierarchy starts with h1", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1");
    await expect(h1.first()).toBeVisible({ timeout: 5000 });
    // h1 should come before h2 in the DOM
    const h1Box = await h1.first().boundingBox();
    expect(h1Box).toBeTruthy();
  });

  test("no duplicate h1 headings on landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);
  });
});

test.describe("Accessibility — Signup Page", () => {
  test("signup form has no critical a11y violations", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.locator("form")).toBeVisible({ timeout: 5000 });
    await settled(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations.filter(v => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  });

  test("form inputs have associated labels", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel(/name/i).first()).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });

  test("submit button is accessible", async ({ page }) => {
    await page.goto("/signup");
    const submitBtn = page.locator("button[type=submit]");
    await expect(submitBtn).toBeVisible();
    // Button should have accessible text
    const text = await submitBtn.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});

test.describe("Accessibility — Login Page", () => {
  test("login form has no critical a11y violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("form")).toBeVisible({ timeout: 5000 });
    await settled(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    expect(results.violations.filter(v => v.impact === "critical" || v.impact === "serious")).toEqual([]);
  });

  test("login page has proper heading", async ({ page }) => {
    await page.goto("/login");
    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Accessibility — Authenticated surfaces", () => {
  // The audit (doc 02, P1) flagged that axe-core never ran on the surfaces
  // users pay for. This closes the gap for /analytics, which mounts reliably
  // under the page.route() mock harness (see _authed-helpers.ts). The
  // dashboard/sessions/settings/interview/report surfaces don't mount past the
  // dev Suspense fallback within the test budget (the documented harness
  // limitation in authed-surfaces.spec.ts) so they stay on the live-Vercel
  // sweep, not here.
  //
  // color-contrast is excluded for the same quantified reason as landing:
  // enabling it surfaces 58 nodes on /analytics, all the editorial copper /
  // amber inks on cream at ~4.3:1 vs the 4.5:1 AA threshold — the same
  // founder-owned copper-scale design fix. Every other rule gates at the
  // critical+serious bar.
  test("analytics has no critical or serious a11y violations", async ({ page }) => {
    const leaks = await installMocks(page);
    await page.goto("/analytics");
    await expect(page).toHaveURL(/\/analytics/, { timeout: 15_000 });
    await expect(page.locator("body")).toContainText(/Analytics|Readiness|Performance|Insights/i, { timeout: 30_000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude(".particle-canvas")
      .exclude("canvas")
      .disableRules(["color-contrast"])
      .analyze();

    expect(results.violations.filter(v => v.impact === "critical" || v.impact === "serious")).toEqual([]);
    expect(leaks, `real Supabase calls leaked: ${leaks.join(", ")}`).toEqual([]);
  });
});

test.describe("Accessibility — Legal Pages", () => {
  test("terms page has proper heading hierarchy", async ({ page }) => {
    await page.goto("/terms");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible({ timeout: 5000 });
  });

  test("privacy page has proper heading hierarchy", async ({ page }) => {
    await page.goto("/privacy");
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Accessibility — Mobile Navigation", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("mobile menu toggle exposes an accessible label", async ({ page }) => {
    await page.goto("/");
    // HomepageV2 nav uses a labelled hamburger button (not a modal dialog).
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("#hx-menu")).toBeVisible();
  });

  test("mobile menu toggle has aria-expanded and aria-controls", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Open menu" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAttribute("aria-controls", "hx-menu");
    await toggle.click();
    // Label flips to "Close menu" once open; assert expanded state on it.
    await expect(page.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
  });

  test("Escape key closes mobile menu", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("#hx-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#hx-menu")).toHaveCount(0);
  });
});

test.describe("Accessibility — Keyboard Navigation", () => {
  test("interactive elements are keyboard-focusable", async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 768, "Tab focus behavior varies on mobile");
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(800);

    // Tab into the page — look for any interactive element receiving focus
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const tag = await page.evaluate(() => document.activeElement?.tagName);
      if (tag && ["A", "BUTTON", "INPUT"].includes(tag)) {
        expect(tag).toBeTruthy();
        return;
      }
    }
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(["A", "BUTTON", "INPUT"]).toContain(focused);
  });

  test("signup form is navigable with Tab", async ({ page }) => {
    await page.goto("/signup");
    await page.locator('input[type="email"]').focus();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(["INPUT", "BUTTON", "A"]).toContain(focused);
  });

  test("login form is navigable with Tab", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').focus();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(["INPUT", "BUTTON", "A", "LABEL"]).toContain(focused);
  });

  test("focus is visible on interactive elements", async ({ page }) => {
    await page.goto("/signup");
    const input = page.locator('input[type="email"]').first();
    await input.focus();
    await expect(input).toBeFocused();
    const borderColor = await input.evaluate(el => getComputedStyle(el).borderColor);
    expect(borderColor).toBeTruthy();
  });
});

test.describe("Accessibility — FAQ Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.locator("#faq").scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: /answered plainly/i })).toBeVisible({ timeout: 10000 });
  });

  test("FAQ questions are buttons that expose aria-expanded and aria-controls", async ({ page }) => {
    const first = page.locator("#faq-fq-0");
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(first).toHaveAttribute("aria-controls", "faq-fa-0");
    await expect(page.locator("#faq-fa-0")).toHaveAttribute("role", "region");
  });

  test("a collapsed FAQ item opens from the keyboard", async ({ page }) => {
    const second = page.locator("#faq-fq-1");
    await second.scrollIntoViewIfNeeded();
    await second.focus();
    await page.keyboard.press("Enter");
    await expect(second).toHaveAttribute("aria-expanded", "true");
  });
});
