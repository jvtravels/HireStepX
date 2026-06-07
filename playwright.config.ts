import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE_PATH } from "./tests/global-setup";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Default 3 retries in CI matches PostHog's pattern; set
  // PLAYWRIGHT_RETRIES=0 in workflow_dispatch to surface the true
  // per-test failure rate when auditing flake.
  retries: process.env.PLAYWRIGHT_RETRIES
    ? Number(process.env.PLAYWRIGHT_RETRIES)
    : process.env.CI
      ? 3
      : 1,
  workers: process.env.CI ? 4 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,
  globalSetup: "./tests/global-setup.ts",

  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "tablet",
      use: { ...devices["iPad Pro 11"] },
    },
    {
      name: "android",
      use: { ...devices["Pixel 7"] },
    },
  ],

  // Local + CI both run a production-built app — matches PostHog/Supabase
  // pattern of testing the same binary that ships. Skip when
  // PLAYWRIGHT_SKIP_WEBSERVER=1 (e.g. running against an external preview).
  ...(process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? {}
    : {
        webServer: {
          command: process.env.CI
            ? "npm run build && npm run start"
            : "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      }),
});

export { STORAGE_STATE_PATH };
