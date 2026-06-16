import { test, expect, type Page, type Locator } from "@playwright/test";

/*
 * Pricing E2E targets the dedicated /pricing route (PricingPageV2), not the
 * homepage section. /pricing is `force-static` with no lazy-loading or reveal
 * animations, so it's the stable surface to assert the four canonical SKUs:
 *   Free ₹0 · Per session ₹9 · Weekly ₹49 (10 sessions) · Monthly ₹149 (40 sessions)
 * The homepage (HomepageV2) renders the same tiers, but behind scroll-reveal —
 * the nav "Pricing" link points users here too.
 */

/** The tier-cards section: <section aria-label="Pricing tiers"> with 4 cards. */
function tierSection(page: Page): Locator {
  return page.locator('section[aria-label="Pricing tiers"]');
}

/** A single tier card, located by its exact tier-name label (avoids matching
 *  e.g. the Monthly card via its "Everything in Weekly" feature line). */
function tierCard(page: Page, name: string): Locator {
  return tierSection(page)
    .locator(".mv2p-pricing-row > div")
    .filter({ has: page.getByText(name, { exact: true }) });
}

test.describe("Pricing Page — Plan Display", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
    await expect(tierSection(page)).toBeVisible({ timeout: 10000 });
  });

  test("free plan shows ₹0 / forever", async ({ page }) => {
    const card = tierCard(page, "Free");
    await expect(card.getByText("₹0")).toBeVisible();
    await expect(card.getByText("forever")).toBeVisible();
  });

  test("free plan shows 'Start free' CTA", async ({ page }) => {
    await expect(
      tierCard(page, "Free").getByRole("link", { name: /Start free/ }),
    ).toBeVisible();
  });

  test("single session plan shows ₹9 / session price", async ({ page }) => {
    const card = tierCard(page, "Per session");
    await expect(card.getByText("₹9")).toBeVisible();
    await expect(card.getByText("/ session")).toBeVisible();
  });

  test("single session plan shows 'Buy one session' CTA", async ({ page }) => {
    await expect(
      tierCard(page, "Per session").getByRole("link", { name: /Buy one session/ }),
    ).toBeVisible();
  });

  test("weekly plan shows ₹49 / 7 days price", async ({ page }) => {
    const card = tierCard(page, "Weekly");
    await expect(card.getByText("₹49")).toBeVisible();
    await expect(card.getByText("/ 7 days")).toBeVisible();
  });

  test("weekly plan CTA says 'Go weekly'", async ({ page }) => {
    await expect(
      tierCard(page, "Weekly").getByRole("link", { name: /Go weekly/ }),
    ).toBeVisible();
  });

  test("monthly plan shows ₹149 / 30 days price", async ({ page }) => {
    const card = tierCard(page, "Monthly");
    await expect(card.getByText("₹149")).toBeVisible();
    await expect(card.getByText("/ 30 days")).toBeVisible();
  });

  test("monthly plan shows 'Most loved' badge", async ({ page }) => {
    // exact:true so the badge isn't confused with the "Most loved during
    // placement season" sub-label in the same card.
    await expect(tierCard(page, "Monthly").getByText("Most loved", { exact: true })).toBeVisible();
  });

  test("monthly plan CTA says 'Go monthly'", async ({ page }) => {
    await expect(
      tierCard(page, "Monthly").getByRole("link", { name: /Go monthly/ }),
    ).toBeVisible();
  });

  test("removed annual plan is no longer shown", async ({ page }) => {
    await expect(page.getByText("₹1,199")).toHaveCount(0);
    await expect(tierSection(page).getByText("Annual")).toHaveCount(0);
  });

  test("all 4 plans are displayed", async ({ page }) => {
    const section = tierSection(page);
    await expect(section.getByText("Free", { exact: true })).toBeVisible();
    await expect(section.getByText("Per session", { exact: true })).toBeVisible();
    await expect(section.getByText("Weekly", { exact: true })).toBeVisible();
    await expect(section.getByText("Monthly", { exact: true })).toBeVisible();
  });
});

test.describe("Pricing Page — Feature Lists", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
    await expect(tierSection(page)).toBeVisible({ timeout: 10000 });
  });

  test("free plan lists its features", async ({ page }) => {
    const card = tierCard(page, "Free");
    await expect(card.getByText("3 mock sessions")).toBeVisible();
    await expect(card.getByText("Email report")).toBeVisible();
  });

  test("monthly plan lists 40 sessions and analytics", async ({ page }) => {
    const card = tierCard(page, "Monthly");
    await expect(card.getByText("40 sessions · 30 days")).toBeVisible();
    await expect(card.getByText("Session history & score trends")).toBeVisible();
  });

  test("weekly plan lists 10 sessions over 7 days", async ({ page }) => {
    await expect(tierCard(page, "Weekly").getByText("10 sessions · 7 days")).toBeVisible();
  });
});

test.describe("Pricing Page — CTA Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pricing");
    await expect(tierSection(page)).toBeVisible({ timeout: 10000 });
  });

  test("free plan CTA links to signup", async ({ page }) => {
    await tierCard(page, "Free").getByRole("link", { name: /Start free/ }).click();
    await expect(page).toHaveURL(/\/signup/, { timeout: 10000 });
  });

  test("single session CTA links to signup", async ({ page }) => {
    await tierCard(page, "Per session").getByRole("link", { name: /Buy one session/ }).click();
    await expect(page).toHaveURL(/\/signup/, { timeout: 10000 });
  });

  test("monthly CTA links to signup", async ({ page }) => {
    await tierCard(page, "Monthly").getByRole("link", { name: /Go monthly/ }).click();
    await expect(page).toHaveURL(/\/signup/, { timeout: 10000 });
  });
});

test.describe("Pricing Page — Trust Signals", () => {
  test("shows student discount and no-renew assurances", async ({ page }) => {
    await page.goto("/pricing");
    await expect(tierSection(page)).toBeVisible({ timeout: 10000 });

    // Per-card student-discount chip on the paid recurring tiers.
    await expect(
      tierCard(page, "Weekly").getByText(".ac.in / .edu.in · 30% off"),
    ).toBeVisible();
    // Compare table / FAQ reiterate the no-auto-renew promise.
    await expect(page.getByText("Do plans auto-renew?")).toBeVisible();
  });
});

test.describe("Pricing Page — Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("pricing plan CTAs are reachable on mobile", async ({ page }) => {
    await page.goto("/pricing");
    await expect(tierSection(page)).toBeVisible({ timeout: 10000 });

    await expect(
      tierCard(page, "Free").getByRole("link", { name: /Start free/ }),
    ).toBeVisible();
    await expect(
      tierCard(page, "Monthly").getByRole("link", { name: /Go monthly/ }),
    ).toBeVisible();
  });
});
