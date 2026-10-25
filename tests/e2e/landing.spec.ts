import { test, expect } from "@playwright/test";

test.describe("Landing page (2.0)", () => {
  test("hero, primary CTA and title render", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/HireStepX/i);
    await expect(page.locator("h1").first()).toContainText(/Prepare to be hired/i);
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
  });

  test("footer links to privacy and terms", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole("link", { name: "Privacy" }).first()).toHaveAttribute("href", /\/privacy/);
    await expect(footer.getByRole("link", { name: "Terms" }).first()).toHaveAttribute("href", /\/terms/);
  });

  test("key marketing routes respond", async ({ request }) => {
    for (const path of ["/pricing", "/candidates", "/employers", "/resources", "/privacy", "/terms"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
    }
  });

  test("no horizontal overflow on a phone", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    await ctx.close();
  });
});
