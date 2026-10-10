import { test, expect } from "@playwright/test";

/*
 * Post-deploy smoke suite (run by .github/workflows/post-deploy-verify.yml
 * against production right after each deploy). Public pages only: no
 * credentials, no writes, no LLM/TTS calls, so it is safe and free to run on
 * every deploy. Select with `--grep @smoke`.
 */

test.describe("@smoke production", () => {
  test("homepage renders hero and primary CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/HireStepX/i);
    await expect(page.locator("h1#hd-hero")).toBeVisible();
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
  });

  test("pricing page renders", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page).toHaveTitle(/Pricing/i);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("login form is usable", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("health endpoint reports healthy", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });

  test("robots.txt and sitemap.xml are served", async ({ request }) => {
    expect((await request.get("/robots.txt")).status()).toBe(200);
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain("<urlset");
  });

  test("protected API rejects unauthenticated calls", async ({ request }) => {
    const res = await request.post("/api/sessions/save", { data: {} });
    expect([401, 403]).toContain(res.status());
  });
});
