import { test, expect } from "@playwright/test";

const PAGES = ["/", "/pricing", "/employers", "/blog", "/contact", "/login", "/signup"];

test.describe("marketing pages", () => {
  for (const path of PAGES) {
    test(`${path} renders cleanly`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

      const res = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(res?.status(), `${path} status`).toBeLessThan(400);
      await page.waitForLoadState("load");

      await expect(page.locator("h1").first()).toBeVisible();
      if (!["/login", "/signup"].includes(path)) await expect(page.locator("main")).toHaveCount(1);
      await page.waitForTimeout(1200);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1);

      const real = errors.filter((e) => !/favicon|Failed to load resource.*(posthog|googletagmanager|vercel)/i.test(e));
      expect(real, `${path} console errors`).toEqual([]);
    });
  }

  test("auth pages are not indexable", async ({ page }) => {
    for (const path of ["/login", "/signup"]) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    }
  });

  test("blog archive links meet 44px tap target height", async ({ page }) => {
    await page.goto("/blog", { waitUntil: "domcontentloaded" });
    const short = await page.$$eval(".lb-index a", (as) => as.filter((a) => a.getBoundingClientRect().height < 43.5).length);
    expect(short).toBe(0);
  });
});
