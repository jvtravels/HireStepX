import { expect, type Page } from "@playwright/test";

export const TEST_USER = {
  get email(): string | undefined {
    return process.env.TEST_USER_EMAIL;
  },
  get password(): string | undefined {
    return process.env.TEST_USER_PASSWORD;
  },
};

export function hasTestCreds(): boolean {
  return !!TEST_USER.email && !!TEST_USER.password;
}

/**
 * Log in via the real login form against the test Supabase project.
 * Returns true on success; callers should `test.skip(!await login(page))`
 * only when the test environment is genuinely unconfigured.
 */
export async function loginAsTestUser(page: Page): Promise<boolean> {
  if (!hasTestCreds()) return false;
  await page.goto("/login");
  // Login form reuses #signup-email for the email field (legacy id);
  // see .test-plan.md "Upgrades needed" for the rename TODO.
  await page.locator("#signup-email").fill(TEST_USER.email!);
  await page.locator("input[type=password]").fill(TEST_USER.password!);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });
  return true;
}
