import { test, expect } from "../fixtures/base";
import { cleanupUserData, getTestUserId } from "../helpers/api";

/**
 * Tier 1 — Real login journey.
 *
 * Asserts that a real seeded user can sign in via the production Login form
 * and lands on a real dashboard (not a mocked surface). No `page.route()`
 * fakery: every selector matches the real source in src/auth/Login.tsx and
 * src/DashboardHome.tsx, so the test fails fast on UI drift.
 *
 * Gated with test.fixme() until TEST_USER_EMAIL / TEST_USER_PASSWORD are
 * provisioned in .env.test (local) or GitHub Actions secrets (CI). When the
 * creds land the gate auto-lifts — no spec change required.
 *
 * Note on the fixture: `authenticatedPage` from fixtures/base.ts reuses
 * storageState produced by global-setup.ts (one UI login per suite). The
 * `happy path` test below uses a bare `page` because it's exercising the
 * login form itself — using the authenticated fixture would skip the very
 * thing under test.
 */

const CREDS_PRESENT =
  !!process.env.TEST_USER_EMAIL && !!process.env.TEST_USER_PASSWORD;

test.describe("Auth — Login journey (Tier 1)", () => {
  test.fixme(
    !CREDS_PRESENT,
    "Awaiting TEST_USER_EMAIL / TEST_USER_PASSWORD — see chore/e2e-foundation PR follow-up checklist.",
  );

  test.afterEach(async () => {
    // Service-role cleanup keeps the seeded user's row in auth.users but
    // wipes anything the login flow / dashboard side-effects may have
    // created (e.g. session_credits trigger fires on first sign-in for
    // some accounts). Skip silently if service-role key isn't wired up.
    try {
      const userId = await getTestUserId();
      await cleanupUserData(userId);
    } catch {
      /* service-role not configured; skip teardown */
    }
  });

  test("happy path: valid creds redirect to dashboard with hero heading", async ({ browser }) => {
    // Fresh context — no storageState — so we actually traverse the form.
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/login");
    await expect(page.locator("#login-heading")).toBeVisible();

    await page.getByPlaceholder("rahul@example.com").fill(process.env.TEST_USER_EMAIL!);
    await page.getByPlaceholder("Enter your password").fill(process.env.TEST_USER_PASSWORD!);

    // Submit and assert real redirect — not a client-side toast.
    await Promise.all([
      page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20_000 }),
      page.locator("button[type=submit]").click(),
    ]);

    // If we land on /dashboard, the hero must render — proves the dashboard
    // tree mounted with a real session, not a redirect loop.
    if (/\/dashboard/.test(page.url())) {
      await expect(page.locator("#dh-hero")).toContainText("Welcome", { timeout: 10_000 });
    }

    await ctx.close();
  });

  test("invalid password surfaces #login-error and stays on /login", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    await page.goto("/login");
    await page.getByPlaceholder("rahul@example.com").fill(process.env.TEST_USER_EMAIL!);
    await page.getByPlaceholder("Enter your password").fill("definitely-not-the-real-password-xyz");
    await page.locator("button[type=submit]").click();

    // Error is rendered into #login-error by setError(mapAuthError(...)) —
    // assert it appears without polling for arbitrary timeouts.
    await expect(page.locator("#login-error")).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/login/);

    await ctx.close();
  });

  test("storageState fixture lands directly on an authenticated surface", async ({ authenticatedPage: page }) => {
    // Verifies global-setup persisted a real session — the fixture short-
    // circuits the UI login, so this test passes only if the cookies in
    // playwright/.auth/user.json are actually valid against the backend.
    await page.goto("/dashboard");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("#dh-hero")).toBeVisible({ timeout: 15_000 });
  });
});
