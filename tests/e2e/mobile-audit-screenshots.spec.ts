/**
 * Mobile audit screenshots — authenticated surfaces at 390×844 (iPhone 14 Pro).
 * Run with: npx playwright test mobile-audit-screenshots --project=chromium --reporter=list
 * Screenshots land in /tmp/mobile-audit/
 */
import { test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { installMocks, makeFakeJwt, USER_ID, FAKE_PROFILE, FAKE_SESSIONS } from "./_authed-helpers";

const OUT = "/tmp/mobile-audit";
fs.mkdirSync(OUT, { recursive: true });

async function shot(page: any, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

// Fix the mock to also cover auth/v1/token refresh and auth/v1/session
async function installFullMocks(page: any) {
  const token = makeFakeJwt(USER_ID);
  const fakeUserObj = {
    id: USER_ID,
    email: FAKE_PROFILE.email,
    email_confirmed_at: new Date().toISOString(),
    user_metadata: { name: FAKE_PROFILE.name, custom_email_verified: true, active_device_token: "playwright-e2e-token" },
    app_metadata: { provider: "email", providers: ["email"] },
    aud: "authenticated",
    role: "authenticated",
    created_at: new Date().toISOString(),
  };
  const fakeSessionPayload = {
    access_token: token,
    token_type: "bearer",
    expires_in: 86400,
    expires_at: Math.floor(Date.now() / 1000) + 86400,
    refresh_token: "fake-refresh",
    user: fakeUserObj,
  };

  // Seed localStorage before page loads
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "placeholder";
  await page.addInitScript(({ blob, r }: { blob: string; r: string }) => {
    try {
      localStorage.setItem(`sb-${r}-auth-token`, blob);
      localStorage.setItem("sb-placeholder-auth-token", blob);
    } catch { /* storage restricted */ }
  }, { blob: JSON.stringify(fakeSessionPayload), r: ref });

  // Cover all Supabase auth endpoints
  await page.route(/supabase.*\/auth\/v1\/token/, async (route: any) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSessionPayload) });
  });
  await page.route(/supabase.*\/auth\/v1\/user/, async (route: any) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeUserObj) });
  });
  await page.route(/supabase.*\/auth\/v1\/session/, async (route: any) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSessionPayload) });
  });
  // Catch any other auth endpoint
  await page.route(/supabase.*\/auth\/v1\//, async (route: any) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fakeSessionPayload) });
  });

  // Profiles
  await page.route(/supabase.*\/rest\/v1\/profiles/, async (route: any) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([FAKE_PROFILE]) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_PROFILE) });
    }
  });

  // Sessions
  await page.route(/supabase.*\/rest\/v1\/sessions/, async (route: any) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_SESSIONS) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([FAKE_SESSIONS[0]]) });
    }
  });

  // All other Supabase REST tables → empty
  await page.route(/supabase.*\/rest\/v1\//, async (route: any) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  // Our own API handlers
  await page.route(/\/api\//, async (route: any) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
}

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});

test.describe("Mobile audit — app surfaces", () => {
  test("01 dashboard top", async ({ page }) => {
    await installFullMocks(page);
    await page.goto("/dashboard");
    // Wait for content to appear (not just loading spinner)
    await page.waitForFunction(() => !document.body.innerText.includes("Loading..."), { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, "01-dashboard-top");
  });

  test("02 dashboard mid", async ({ page }) => {
    await installFullMocks(page);
    await page.goto("/dashboard");
    await page.waitForFunction(() => !document.body.innerText.includes("Loading..."), { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);
    await shot(page, "02-dashboard-mid");
  });

  test("03 dashboard bottom", async ({ page }) => {
    await installFullMocks(page);
    await page.goto("/dashboard");
    await page.waitForFunction(() => !document.body.innerText.includes("Loading..."), { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await shot(page, "03-dashboard-bottom");
  });

  test("04 interview setup", async ({ page }) => {
    await installFullMocks(page);
    await page.goto("/interview");
    await page.waitForFunction(() => !document.body.innerText.includes("Loading..."), { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, "04-interview-top");
    await page.evaluate(() => window.scrollTo(0, 700));
    await page.waitForTimeout(300);
    await shot(page, "05-interview-mid");
  });

  test("05 session history", async ({ page }) => {
    await installFullMocks(page);
    await page.goto("/sessions");
    await page.waitForFunction(() => !document.body.innerText.includes("Loading..."), { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await shot(page, "06-sessions-top");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await shot(page, "07-sessions-bottom");
  });

  test("06 session report", async ({ page }) => {
    await installFullMocks(page);
    await page.goto("/sessions/sess-e2e-1");
    await page.waitForFunction(() => !document.body.innerText.includes("Loading..."), { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, "08-report-top");
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(300);
    await shot(page, "09-report-mid");
    await page.evaluate(() => window.scrollTo(0, 1800));
    await page.waitForTimeout(300);
    await shot(page, "10-report-lower");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await shot(page, "11-report-bottom");
  });
});
