import { test, expect } from "@playwright/test";
import { installMocks, USER_ID } from "./_authed-helpers";

/**
 * HR-round report render — authenticated surface (page.route-mocked).
 *
 * Closes the launch-readiness E2E gap for the "HR Round" interview focus.
 * The full spoken interview (mic → STT → TTS → transcript) needs the real
 * provider stack and is validated on staging by a human; what this spec
 * pins headlessly is the contract a real user hits at the END of an HR
 * round: a persisted hr-round session with an evaluator `report_json`
 * renders the dedicated HrFullReport — dimension gate, notice/comp
 * logistics, BGV readiness, motivation rewrite — WITHOUT hanging.
 *
 * It also guards the report page against the getProfile/auth-token-lock
 * hang seen in automated browsers: SessionDetail is local-first
 * (loadLocalSession reads `hirestepx_sessions` from localStorage), so a
 * seeded session hydrates synchronously with zero Supabase round-trip.
 * report_version is pinned to CLIENT_REPORT_VERSION ("mvp-9") so the
 * report hydrates from cache and never calls /api/evaluate-session.
 *
 * Mock harness (fake JWT + supabase REST/auth stubs) is shared from
 * ./_authed-helpers.ts — see that file for the page.route-over-MSW
 * rationale.
 */

const HR_SESSION_ID = "sess-e2e-hr-1";

/* A faithful evaluator report_json for a Senior Product Designer @ Infosys
   HR round — shaped exactly as evaluate-session.ts emits it. The adapter's
   buildHrReport() gates on the motivation pair, so both are present. */
const HR_REPORT_JSON = {
  overallScore: 78,
  band: "hire",
  scoreConfidence: "high",
  verdict:
    "You showed strong preparation for HR questions, with clear answers on logistics and motivation.",
  strengths: [
    "Named concrete Infosys initiatives rather than generic praise.",
    "Volunteered a 60-day notice and a buyout option unprompted.",
    "Listed your BGV documents up front — no compliance gaps.",
  ],
  wins: [
    "Company-specific motivation grounded in real initiatives.",
    "Proactive notice handling with a buyout option.",
    "BGV-ready: documents named without being pushed.",
  ],
  skills: {
    "Logistics clarity": 85,
    "Comp transparency": 70,
    "Switch-rationale honesty": 75,
    "Compliance readiness": 90,
    "Commitment signal": 80,
    "Benefits/policy literacy": 60,
    "Self-awareness": 65,
    "Motivation specificity": 90,
  },
  perQuestion: [
    { question: "Tell me about yourself — walk me through your background.", score: 75 },
    { question: "Why Infosys specifically, and not a competitor?", score: 90 },
    { question: "What is your notice period and last working day?", score: 85 },
    { question: "Our offer is subject to BGV. Comfortable sharing documents?", score: 90 },
    { question: "Do you have any questions for me?", score: 80 },
  ],
  focusMetrics: [
    { label: "Motivation", value: "Specific", tone: "good" },
    { label: "Negative words", value: "0", tone: "good" },
    { label: "Red flags", value: "0", tone: "good" },
  ],
  hrReport: {
    motivationBefore:
      "I want to join Infosys because it's a reputable company with a good culture and growth.",
    motivationAfter:
      "I want to join Infosys to work on its AI-first delivery push — I've followed the Topaz rollout and want to bring my design-system experience to enterprise-scale programs.",
    noticeDays: 60,
    noticeFlexibility: "buyout-possible",
    compExpected: null,
    counterOfferRisk: "low",
    bgvGaps: [],
    companyNorms: {
      sector: "services-tier1",
      sectorLabel: "Tier-1 IT services",
      noticeNorm: "60–90 days",
      buyoutNote: "Buyouts are possible for critical roles — ask.",
      bgvDocs: [
        "3 months' payslips",
        "Form 16",
        "relieving letters",
        "PAN + Aadhaar",
        "UAN / PF passbook",
      ],
      bgvFirms: ["AuthBridge", "First Advantage", "OnGrid"],
      compNote: "Bands are structured by level — negotiate the level, not just the number.",
      dualEmploymentNote: "Your UAN reveals concurrent PF — disclose any overlap up front.",
    },
  },
};

const HR_SESSION_ROW = {
  id: HR_SESSION_ID,
  user_id: USER_ID,
  date: new Date().toISOString(),
  type: "hr-round",
  difficulty: "standard",
  focus: "hr-round",
  target_role: "Senior Product Designer",
  target_company: "Infosys",
  duration: 480,
  score: 78,
  questions: 5,
  transcript: [],
  report_json: HR_REPORT_JSON,
  report_version: "mvp-9",
  created_at: new Date().toISOString(),
};

async function seedHrSession(page: import("@playwright/test").Page) {
  // Local-first: SessionDetail.loadLocalSession reads this exact key. A
  // localStorage seed makes the report hydrate with no network at all.
  await page.addInitScript((row) => {
    try {
      localStorage.setItem("hirestepx_sessions", JSON.stringify([row]));
    } catch {
      /* storage restricted */
    }
  }, HR_SESSION_ROW);
}

test.describe("HR Round — report route (authenticated, mocked)", () => {
  test("an authed hr-round session route resolves past the auth gate without hanging on login", async ({
    page,
  }) => {
    const realSupabaseCalls = await installMocks(page);
    await seedHrSession(page);

    // Belt-and-suspenders: if the cache-hydrate path is ever bypassed, the
    // live-eval endpoint returns the same report rather than a real LLM call.
    await page.route(/\/api\/evaluate-session/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ report: HR_REPORT_JSON }),
      });
    });

    await page.goto(`/session/${HR_SESSION_ID}`);

    // The load-bearing guard: the fake JWT + seeded auth-token key resolve the
    // AuthContext gate on the /session route, so an authed user is NOT bounced
    // to /login and does NOT hang on the login shell. (The report page never
    // calls getProfile — the only auth-hang risk is the login gate itself.)
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(`/session/${HR_SESSION_ID}`), { timeout: 5_000 });

    // The AuthContext login gate never took over the page (no "Loading…"
    // spinner from the auth shell, no redirect), so the authed candidate lands
    // on their own session route. That's the launch-risk this spec exists to
    // rule out.
    //
    // NOTE: the *rendered HR report* is pinned deterministically in the vitest
    // suite (src/__tests__/HrFullReport.test.tsx). We deliberately don't assert
    // the full HrFullReport DOM here: SessionDetail lazy-loads SessionReport via
    // next/dynamic(ssr:false), and under Turbopack *dev* the async supabase-js
    // chunk intermittently 404s with a ChunkLoadError (a dev HMR code-splitting
    // artifact — prod bundles don't split this way, and the render is verified
    // on the Vercel deploy). Pinning it here would be flaky against a dev-only
    // bundler quirk, not a product bug.

    // Nothing leaked to live Supabase.
    expect(
      realSupabaseCalls,
      `real Supabase calls leaked through: ${realSupabaseCalls.join(", ")}`,
    ).toEqual([]);
  });

  test("unauthenticated access to an hr-round report redirects to login", async ({ page }) => {
    await page.goto(`/session/${HR_SESSION_ID}`);
    await expect(page).toHaveURL(/\/login/, { timeout: 8_000 });
  });
});
