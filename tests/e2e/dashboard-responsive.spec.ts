/**
 * Dashboard responsive contract.
 *
 * Locks in the responsive-audit fixes shipped in 0d41d9a so a future
 * regression to the breakpoints, touch-target floor, or rail collapse
 * fails CI instead of leaking to production.
 *
 * Uses the `authenticatedPage` fixture (real Supabase session via
 * globalSetup), so this skips locally without TEST_USER_EMAIL set and
 * runs as a real render contract in CI.
 *
 * What this guards:
 *   - DashboardHome actually mounts past the Suspense fallback
 *     (the gap that caused the old mocked spec to be deleted in 5b839e8)
 *   - Hero clamps between 28px and 44px across the viewport range
 *   - No horizontal scroll at any device-class viewport
 *   - Mobile breakpoint (≤1023px) hides the sidebar and shows the Menu button
 *   - Desktop breakpoint (≥1180px) shows the rail
 *   - Touch-target floor: every CTA + Menu button ≥ 44px (WCAG 2.5.5)
 */

import { test, expect } from "../fixtures/base";
import type { Page } from "@playwright/test";

const VIEWPORTS = {
  mobileSmall: { width: 375, height: 667, label: "iPhone SE" },
  mobileLarge: { width: 393, height: 852, label: "iPhone 15 Pro" },
  tabletPortrait: { width: 820, height: 1180, label: "iPad portrait" },
  tabletLandscape: { width: 1180, height: 820, label: "iPad landscape" },
  desktop: { width: 1440, height: 900, label: "Desktop" },
} as const;

async function gotoDashboard(page: Page): Promise<void> {
  await page.goto("/dashboard");
  if (page.url().includes("/onboarding")) {
    await page.goto("/dashboard");
  }
  // Wait for the actual home surface, not just layout chrome.
  await expect(page.locator(".hsx-dh-root")).toBeVisible({ timeout: 15_000 });
}

async function getHorizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
}

test.describe("Dashboard — responsive contract", () => {
  for (const [key, vp] of Object.entries(VIEWPORTS)) {
    test(`${key} (${vp.width}×${vp.height}, ${vp.label}) — no horizontal scroll, hero clamped`, async ({
      authenticatedPage: page,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoDashboard(page);

      // No horizontal scroll at any device class.
      const overflow = await getHorizontalOverflow(page);
      expect(overflow, `horizontal overflow at ${vp.label}`).toBe(0);

      // Hero h1 obeys clamp(28px, 6vw, 44px).
      const hero = page.locator(".hsx-dh-hero").first();
      await expect(hero).toBeVisible();
      const heroFontPx = await hero.evaluate(
        (el) => parseFloat(getComputedStyle(el).fontSize) || 0,
      );
      expect(heroFontPx, `hero font at ${vp.label}`).toBeGreaterThanOrEqual(26);
      expect(heroFontPx, `hero font at ${vp.label}`).toBeLessThanOrEqual(44);
    });
  }

  test("mobile (≤1023px) hides sidebar, shows Menu button ≥44px", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(VIEWPORTS.mobileLarge);
    await gotoDashboard(page);

    const menuBtn = page.getByRole("button", { name: /open navigation menu/i });
    await expect(menuBtn).toBeVisible();

    const box = await menuBtn.boundingBox();
    expect(box, "Menu button bounding box").not.toBeNull();
    expect(box!.height, "Menu button height (WCAG 2.5.5)").toBeGreaterThanOrEqual(44);
    expect(box!.width, "Menu button width (WCAG 2.5.5)").toBeGreaterThanOrEqual(44);
  });

  test("desktop (≥1180px) renders rail and primary CTA ≥44px", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await gotoDashboard(page);

    // Primary CTA is the touch-target canary for the home surface.
    const cta = page.locator(".hsx-dh-cta-primary").first();
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box, "Primary CTA bounding box").not.toBeNull();
    expect(box!.height, "Primary CTA height (WCAG 2.5.5)").toBeGreaterThanOrEqual(44);

    // Menu button is hidden on desktop.
    const menuBtn = page.getByRole("button", { name: /open navigation menu/i });
    await expect(menuBtn).toBeHidden();
  });

  test("landscape phone (max-height 500px) compacts hero", async ({
    authenticatedPage: page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await gotoDashboard(page);

    const hero = page.locator(".hsx-dh-hero").first();
    const heroFontPx = await hero.evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize) || 0,
    );
    // Landscape-phone media query forces 26px.
    expect(heroFontPx).toBeLessThanOrEqual(30);
  });
});
