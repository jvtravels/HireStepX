import { test, expect } from "@playwright/test";
import { test as authedTest } from "../fixtures/base";

const CREDS_PRESENT =
  !!process.env.TEST_USER_EMAIL && !!process.env.TEST_USER_PASSWORD;

test.describe("Signup Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup");
  });

  test("renders signup form with name, email, and password fields", async ({ page }) => {
    await expect(page.getByText("Start practicing today")).toBeVisible();
    await expect(page.locator("#signup-name")).toBeVisible();
    await expect(page.locator("#signup-email")).toBeVisible();
    await expect(page.locator("input[type=password]").first()).toBeVisible();
  });

  test("shows password strength indicator — weak password", async ({ page }) => {
    const pw = page.locator("input[type=password]").first();
    await pw.click();
    await pw.fill("ab");
    await expect(page.getByText("Weak")).toBeVisible({ timeout: 3000 });
  });

  test("shows password strength indicator — strong password", async ({ page }) => {
    const pw = page.locator("input[type=password]").first();
    await pw.click();
    await pw.fill("StrongPass123!");
    await expect(page.getByText("Strong")).toBeVisible({ timeout: 3000 });
  });

  test("validates required fields on submit", async ({ page }) => {
    await page.locator("button[type=submit]").click();
    // HTML5 validation prevents submission — name field should be focused
    const name = page.locator("#signup-name");
    await expect(name).toBeFocused();
  });

  test("rejects short password", async ({ page }) => {
    await page.locator("#signup-name").fill("Test User");
    await page.locator("#signup-email").fill("test@example.com");
    const pw = page.locator("input[type=password]").first();
    await pw.fill("abc");
    await expect(page.getByText("Weak")).toBeVisible({ timeout: 3000 });
  });

  test("email typo suggestion appears", async ({ page }) => {
    await page.locator("#signup-name").fill("Test User");
    await page.locator("#signup-email").fill("test@gmial.com");
    await page.keyboard.press("Tab");
    await expect(page.getByText(/Did you mean/)).toBeVisible({ timeout: 5000 });
  });

  test("has link to login page", async ({ page }) => {
    await page.getByText("Log in").click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("renders login form with welcome message", async ({ page }) => {
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.locator("#signup-email")).toBeVisible();
    await expect(page.locator("input[type=password]")).toBeVisible();
  });

  test("shows forgot password link", async ({ page }) => {
    await expect(page.getByText("Forgot password?")).toBeVisible();
  });

  test("forgot password shows reset form", async ({ page }) => {
    await page.getByText("Forgot password?").click();
    await expect(page.getByText("Reset your password")).toBeVisible();
    await expect(page.locator("#reset-email")).toBeVisible();
  });

  test("has link to signup page", async ({ page }) => {
    await page.getByText("Sign up").click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test("remember me checkbox is present", async ({ page }) => {
    await expect(page.getByText("Remember me")).toBeVisible();
  });

  test("shows error on empty submit (HTML5 validation)", async ({ page }) => {
    await page.locator("button[type=submit]").click();
    const email = page.locator("#signup-email");
    await expect(email).toBeFocused();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.locator("#signup-email").fill("nonexistent@example.com");
    await page.locator("input[type=password]").fill("WrongPassword123!");
    await page.locator("button[type=submit]").click();
    // Should show an error message in the form-error alert div
    const errorAlert = page.locator("#form-error");
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Password Reset Page", () => {
  test("shows error state without valid token", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.locator("text=/Invalid|expired|Supabase|error/i")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("Auth Redirects — Protected Routes", () => {
  test("unauthenticated user visiting /dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("unauthenticated user visiting /session/new redirects to login", async ({ page }) => {
    await page.goto("/session/new");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("unauthenticated user visiting /interview redirects to login", async ({ page }) => {
    await page.goto("/interview");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("unauthenticated user visiting /settings redirects to login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("unauthenticated user visiting /analytics redirects to login", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("unauthenticated user visiting /resume redirects to login", async ({ page }) => {
    await page.goto("/resume");
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

test.describe("Auth — Navigation Between Pages", () => {
  test("signup and login pages are navigable between each other", async ({ page }) => {
    await page.goto("/signup");
    // Use getByRole link to avoid matching "Log in" in other text on the page
    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page).toHaveURL(/\/signup/);
  });
});

/* ─── Auth — Authenticated Flow ───
 * Gated at describe level: missing creds = visibly skipped (test.fixme), not
 * silently passed. The login happy-path lives in auth-login.spec.ts; this
 * block covers the logout side of the journey.
 *
 * Uses the authenticatedPage fixture so we don't re-log-in per test —
 * globalSetup already established the session. GitHub's flake research
 * (https://github.blog/engineering/.../reducing-flaky-builds-by-18x/) shows
 * per-test UI login is one of the top three flake sources. */
authedTest.describe("Auth — Authenticated Flow", () => {
  authedTest.fixme(
    !CREDS_PRESENT,
    "Awaiting TEST_USER_EMAIL / TEST_USER_PASSWORD — see chore/e2e-foundation PR follow-up checklist.",
  );

  authedTest("logout returns to landing or login page", async ({ authenticatedPage: page }) => {
    await page.goto("/dashboard");
    // Onboarding-only accounts land on /onboarding; either is fine — both
    // surfaces must expose logout. If they don't, that's the bug to catch.
    const logoutButton = page.getByRole("button", { name: /log\s*out|sign\s*out/i });
    await expect(logoutButton).toBeVisible({ timeout: 10_000 });
    await logoutButton.click();
    await expect(page).toHaveURL(/^\/$|\/login/, { timeout: 10_000 });
  });
});
