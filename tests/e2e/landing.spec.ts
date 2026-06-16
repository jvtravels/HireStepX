import { test, expect } from "@playwright/test";

/*
 * Landing-page E2E targets HomepageV2 (src/marketing-v2/HomepageV2.tsx), the
 * production homepage rendered at "/". Structure assumed by these specs:
 *   - Sticky <nav aria-label="Primary"> with link row (hidden ≤880px) +
 *     a ≤880px hamburger (button[aria-label="Open menu"]) that opens
 *     <div id="mv2-mobile-menu">.
 *   - Hero <h1 id="hd-hero"> "Practice the interview. Not the panic." with
 *     CTAs "Start round 01" (/signup) and "Watch 60-sec preview".
 *   - Section <h2> headings carry ids hd-focus / hd-story / hd-features /
 *     hd-india / hd-why / hd-pricing / hd-compare / hd-faq.
 *   - FAQ is <section id="faq"> with category tabs + native <details> items.
 *   - Footer is <footer aria-labelledby="hd-cta"> with /privacy + /terms links.
 */

test.describe("Landing Page — Core", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads with HireStepX in title", async ({ page }) => {
    await expect(page).toHaveTitle(/HireStepX/);
  });

  test("renders hero with headline containing 'interview'", async ({ page }) => {
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("interview", { timeout: 5000 });
  });

  test("shows primary hero CTA", async ({ page }) => {
    await expect(page.getByRole("link", { name: /Start round 01/ })).toBeVisible();
  });

  test("hero CTA links to signup for unauthenticated users", async ({ page }) => {
    await page.getByRole("link", { name: /Start round 01/ }).click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("shows free-trial trust signal in hero", async ({ page }) => {
    await expect(page.getByText(/no card needed/i).first()).toBeVisible();
  });
});

test.describe("Landing Page — Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows navigation links on desktop", async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 900, "Nav links collapse into the hamburger ≤880px");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: "How it works" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Pricing" })).toBeVisible();
  });

  test("sign-in link is visible on desktop", async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 900, "Auth links collapse into the hamburger ≤880px");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: /sign\s*in/i })).toBeVisible();
  });

  test("start-free link is visible on desktop", async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 900, "Auth links collapse into the hamburger ≤880px");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(nav.getByRole("link", { name: /start free/i })).toBeVisible();
  });

  test("Pricing nav link routes to /pricing", async ({ page, viewport }) => {
    test.skip(!!viewport && viewport.width < 900, "Nav links collapse into the hamburger ≤880px");
    const nav = page.getByRole("navigation", { name: "Primary" });
    await nav.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing/);
  });
});

test.describe("Landing Page — Sections", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("interview-types section is present", async ({ page }) => {
    const heading = page.getByRole("heading", { name: /Ten interview types/ });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("how-it-works section has three steps", async ({ page }) => {
    const heading = page.getByRole("heading", { name: /Three steps/ });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("features section shows heading", async ({ page }) => {
    const heading = page.getByRole("heading", { name: /Not another/ });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("pricing section shows the four canonical plans", async ({ page }) => {
    // HomepageV2 pricing lives at <section aria-labelledby="hd-pricing">, far
    // down the page behind scroll-reveal. Scroll it into view, then assert.
    const pricing = page.locator('section[aria-labelledby="hd-pricing"]');
    await pricing.scrollIntoViewIfNeeded();
    await expect(pricing.getByText("Free", { exact: true })).toBeVisible({ timeout: 8000 });
    await expect(pricing.getByText("Per session", { exact: true })).toBeVisible();
    await expect(pricing.getByText("Weekly", { exact: true })).toBeVisible();
    await expect(pricing.getByText("Monthly", { exact: true })).toBeVisible();
  });

  test("pricing section shows canonical prices and no removed annual plan", async ({ page }) => {
    const pricing = page.locator('section[aria-labelledby="hd-pricing"]');
    await pricing.scrollIntoViewIfNeeded();
    // Scope to the tier grid so prices don't collide with the masthead's
    // "From ₹9 / session" eyebrow.
    const grid = pricing.locator(".mv2-pricing-grid");
    await expect(grid.getByText("₹9")).toBeVisible({ timeout: 8000 });
    await expect(grid.getByText("₹49")).toBeVisible();
    await expect(grid.getByText("₹149")).toBeVisible();
    // The annual plan was removed from the product.
    await expect(pricing.getByText("Annual")).toHaveCount(0);
    await expect(page.getByText("₹1,199")).toHaveCount(0);
  });
});

test.describe("Landing Page — FAQ", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const faq = page.locator("#faq");
    await faq.scrollIntoViewIfNeeded();
    await expect(page.getByRole("heading", { name: /Things you'd ask/ })).toBeVisible({ timeout: 10000 });
  });

  test("FAQ section displays pricing questions by default", async ({ page }) => {
    await expect(page.getByText("Is the free tier actually free?")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Do plans auto-renew?")).toBeVisible();
  });

  test("first FAQ item is open by default", async ({ page }) => {
    // Native <details open> on the first item — its answer is visible.
    await expect(page.getByText(/3 full mock sessions, full scoring/)).toBeVisible({ timeout: 5000 });
  });

  test("switching category tab swaps the questions", async ({ page }) => {
    const tablist = page.getByRole("tablist", { name: "FAQ categories" });
    await tablist.getByRole("tab", { name: /Product/ }).click();
    await expect(page.getByText("Why not just use ChatGPT?")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Is the free tier actually free?")).toHaveCount(0);
  });

  test("a collapsed FAQ item expands on click", async ({ page }) => {
    const item = page.locator("details.mv2p-faq").filter({ hasText: "Do plans auto-renew?" });
    await item.locator("summary").click();
    await expect(item).toHaveJSProperty("open", true);
    await expect(page.getByText(/Weekly and Monthly are one-time top-ups/)).toBeVisible({ timeout: 3000 });
  });
});

test.describe("Landing Page — Footer", () => {
  test("footer renders with brand and legal links", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByText(/HireStepX/).first()).toBeVisible({ timeout: 8000 });
    await expect(footer.getByRole("link", { name: "Privacy" }).first()).toBeVisible();
    await expect(footer.getByRole("link", { name: "Terms" }).first()).toBeVisible();
  });

  test("privacy link navigates correctly", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await footer.getByRole("link", { name: "Privacy" }).first().click();
    await expect(page).toHaveURL(/\/privacy/);
  });

  test("terms link navigates correctly", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await footer.getByRole("link", { name: "Terms" }).first().click();
    await expect(page).toHaveURL(/\/terms/);
  });
});

test.describe("Landing Page — Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("mobile nav hamburger is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("mobile nav opens menu with links", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.locator("#mv2-mobile-menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Pricing" })).toBeVisible();
    await expect(menu.getByRole("link", { name: /start free/i })).toBeVisible();
  });

  test("mobile nav closes on Escape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("#mv2-mobile-menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#mv2-mobile-menu")).toHaveCount(0);
  });

  test("hero CTA is visible on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Start round 01/ }).first()).toBeVisible();
  });
});
