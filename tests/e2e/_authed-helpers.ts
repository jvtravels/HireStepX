import { type Page, type Route } from "@playwright/test";

/**
 * Shared harness for authenticated-surface E2E specs.
 *
 * Strategy — `page.route()` over MSW: the app's fetches (supabase-js +
 * apiClient.ts) run in the browser, so Playwright's browser-side network
 * interception is the idiomatic tool. It patches the network before
 * navigation; neither the page nor its deps know they're mocked, and
 * nothing leaks into production (unlike an MSW service worker).
 *
 * Extracted from dashboard-authed.spec.ts so every authed surface
 * (dashboard, sessions, analytics, settings, …) shares ONE source of
 * truth for the fake session + table mocks rather than copy-pasting it.
 */

// Minimal fake JWT — supabase-js only decodes it to read the user id +
// expiry, so an unsigned token with a future exp is enough.
export function makeFakeJwt(userId: string, emailVerified = true): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    email: "rls-e2e@test.hirestepx.com",
    email_confirmed_at: emailVerified ? new Date().toISOString() : null,
    user_metadata: { name: "E2E User", custom_email_verified: emailVerified },
    app_metadata: { provider: "email", providers: ["email"] },
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000),
    aud: "authenticated",
    role: "authenticated",
  })).toString("base64url");
  return `${header}.${payload}.fake-signature`;
}

export const USER_ID = "00000000-0000-0000-0000-00000000e2e1";

export const FAKE_PROFILE = {
  id: USER_ID,
  email: "rls-e2e@test.hirestepx.com",
  name: "E2E User",
  target_role: "Software Engineer",
  target_company: "Google",
  has_completed_onboarding: true,
  subscription_tier: "free",
  practice_timestamps: [
    new Date(Date.now() - 1 * 86400000).toISOString(),
    new Date(Date.now() - 2 * 86400000).toISOString(),
  ],
  referral_code: "HSX-E2E123",
  created_at: new Date().toISOString(),
};

export const FAKE_SESSIONS = [
  {
    id: "sess-e2e-1",
    user_id: USER_ID,
    date: new Date(Date.now() - 1 * 86400000).toISOString(),
    type: "behavioral",
    difficulty: "standard",
    focus: "leadership",
    duration: 600,
    score: 78,
    questions: 5,
    transcript: [],
    ai_feedback: "Strong answers on leadership but could be more concise.",
    skill_scores: { Communication: 75, Structure: 82, Technical: 70 },
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "sess-e2e-2",
    user_id: USER_ID,
    date: new Date(Date.now() - 4 * 86400000).toISOString(),
    type: "technical",
    difficulty: "hard",
    focus: "system-design",
    duration: 900,
    score: 84,
    questions: 6,
    transcript: [],
    ai_feedback: "Good breadth; tighten the trade-off discussion.",
    skill_scores: { Communication: 80, Structure: 86, Technical: 85 },
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
];

/**
 * Install all network mocks BEFORE navigation. Returns a live array that
 * accumulates any real Supabase URLs that leaked past the mocks — assert
 * it stays empty so a test can't silently pass by hitting prod.
 */
export async function installMocks(page: Page): Promise<string[]> {
  await page.route(/\/auth\/v1\/user/, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: USER_ID,
        email: FAKE_PROFILE.email,
        email_confirmed_at: new Date().toISOString(),
        user_metadata: { name: FAKE_PROFILE.name, custom_email_verified: true },
        app_metadata: { provider: "email", providers: ["email"] },
      }),
    });
  });

  await page.route(/\/rest\/v1\/profiles/, async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([FAKE_PROFILE]) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
    }
  });

  await page.route(/\/rest\/v1\/sessions/, async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(FAKE_SESSIONS) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([FAKE_SESSIONS[0]]) });
    }
  });

  // Remaining user-scoped tables → empty arrays so sections render their
  // empty states without throwing.
  await page.route(/\/rest\/v1\/(calendar_events|feedback|llm_usage|payments|referrals|coach_messages|resume_versions|question_feedback)/, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  // Our own edge handlers → benign 200s.
  await page.route(/\/api\/(audit-log|log-error|admin-data|generate-insights|usage-this-month)/, async (route: Route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  // Seed a fake session into localStorage before boot. supabase-js restores
  // from the EXACT key `sb-<ref>-auth-token`, where <ref> is the first
  // hostname label of NEXT_PUBLIC_SUPABASE_URL. With no env (the default dev
  // harness) the client falls back to https://placeholder.supabase.co, so the
  // key is `sb-placeholder-auth-token`. Seeding the wrong key (e.g.
  // `sb-fake-auth-token`) makes hasStoredSession() true while getSession()
  // finds nothing → the AuthContext gate spins on "Loading..." forever. We
  // derive the ref from the same env the client reads so the seed key always
  // matches, and write a couple of fallbacks for robustness.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const ref = supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : "placeholder";
  const token = makeFakeJwt(USER_ID);
  await page.addInitScript(({ authToken, storageRef }) => {
    const fakeSession = {
      access_token: authToken,
      token_type: "bearer",
      expires_in: 86400,
      expires_at: Math.floor(Date.now() / 1000) + 86400,
      refresh_token: "fake-refresh",
      user: {
        id: "00000000-0000-0000-0000-00000000e2e1",
        email: "rls-e2e@test.hirestepx.com",
        email_confirmed_at: new Date().toISOString(),
        user_metadata: { name: "E2E User", custom_email_verified: true },
        app_metadata: { provider: "email" },
      },
    };
    try {
      const blob = JSON.stringify(fakeSession);
      // The real key the client restores from, plus a placeholder fallback.
      localStorage.setItem(`sb-${storageRef}-auth-token`, blob);
      localStorage.setItem("sb-placeholder-auth-token", blob);
      localStorage.setItem(`hirestepx_onboarding_done_${fakeSession.user.id}`, "true");
    } catch { /* storage restricted */ }
  }, { authToken: token, storageRef: ref });

  const realSupabaseCalls: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("supabase.co") && !url.includes("localhost")) realSupabaseCalls.push(url);
  });
  return realSupabaseCalls;
}
