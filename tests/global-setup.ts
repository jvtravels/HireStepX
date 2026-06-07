import { chromium, type FullConfig, expect } from "@playwright/test";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const STORAGE_STATE_PATH = "playwright/.auth/user.json";

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    console.warn(
      "[global-setup] TEST_USER_EMAIL / TEST_USER_PASSWORD not set — " +
        "authed specs that depend on storageState will fail. Provision a " +
        "test user in the test Supabase project and add the secrets to " +
        "GitHub Actions before merging.",
    );
    return;
  }

  if (!existsSync(dirname(STORAGE_STATE_PATH))) {
    mkdirSync(dirname(STORAGE_STATE_PATH), { recursive: true });
  }

  const baseURL = process.env.BASE_URL || "http://localhost:3000";
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.locator("#signup-email").fill(email);
  await page.locator("input[type=password]").fill(password);
  await page.locator("button[type=submit]").click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: 20_000 });
  await ctx.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
