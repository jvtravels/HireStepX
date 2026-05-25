import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    include: [
      "src/__tests__/**/*.{test,spec}.{ts,tsx}",
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: [
      "tests/e2e/**",
      "tests/example.spec.ts",
      "node_modules",
      ".next",
    ],
    setupFiles: ["./src/__tests__/vitest-setup.ts"],
    /* PDF#45 audit pass 3 (2026-05-26) — raise per-test timeout to
     * absorb cold-import latency on `_negotiate-turn-helpers.ts`
     * (the kernel's mega-module). Six system-prompt token tests
     * (midLevel / realWorld / seniorAndProcess / wave2 / wave3 /
     * wave4 flow) call `await import("../../server-handlers/
     * _negotiate-turn-helpers")` inside the test body; under full-
     * suite parallel transform load that import alone has been
     * observed to push past the vitest default of 5000 ms even
     * though each test does only a string-contains check after the
     * import resolves. Pass cleanly in isolation. A 15 s ceiling
     * gives a comfortable margin without masking real regressions —
     * any individual test that legitimately needs more than 15 s
     * is doing something it shouldn't. */
    testTimeout: 15000,
    /* Match hookTimeout to testTimeout so beforeAll / afterAll that
     * also touch the kernel module don't trip on the same cold-
     * import latency. */
    hookTimeout: 15000,
    coverage: {
      // v8 is the built-in provider — no extra deps needed.
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      include: [
        "src/**/*.{ts,tsx}",
        "server-handlers/**/*.ts",
        "data/**/*.ts",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "src/__tests__/**",
        "tests/**",
        "**/node_modules/**",
        // Next.js boilerplate / glue that tests would exercise indirectly.
        "src/index.css",
        // Large pure-data files — 100% coverage gives no signal, they're
        // consumed by imports-only which already get counted via the
        // handler under test.
        "data/role-competencies.ts",
        "data/company-guidance.ts",
        "data/salary-lookup.ts",
        "data/salaries.ts",
        "data/city-tiers.ts",
        "data/company-tiers.ts",
        "data/company-suggestions.ts",
      ],
      // Baseline thresholds — set 0.5-1 point below current values so CI
      // turns red on any regression. Bump these up each time a new test
      // batch lifts actual numbers. Current (2026-04-24 after +65 tests
      // for subscription actions, notebook sort, nextMove picker, profile
      // sanitisation): lines 19.2%, statements 18.1%, functions 16.0%,
      // branches 15.5%.
      //
      // Why not 80%? 60% of the codebase is UI JSX components that our
      // pure-function tests don't touch. The useful metric is pure logic
      // + handler coverage; enforcing 80% globally would force snapshot
      // tests on every component. Raise when Playwright + MSW integration
      // tests cover the UI paths.
      thresholds: {
        // Global gate — see comment above for the rationale (60% of
        // the codebase is JSX UI we don't unit-test).
        // Current: lines 20.6% / statements 19.7% / functions 17.8% /
        // branches 16.7%. Ratchet floor 1 pt below to lock the gains.
        lines: 19,
        statements: 18,
        functions: 16,
        branches: 15,
        // ─── Per-folder gate: server-handlers ───
        // server-handlers/ is pure server-side logic — payment flows,
        // session scoring, auth rate limits, email signing. A bug
        // here is a data-integrity / financial / privacy incident,
        // not a visual glitch. Hold this folder to a separate floor
        // that ratchets upward as we add tests, rather than letting
        // the JSX-heavy aggregate disguise gaps in pure logic.
        //
        // Current (post: evaluate-session / generate-questions /
        // cancel-subscription / export-user-data helpers extracted +
        // tested — 101 new tests): 13.26% statements / 12.64%
        // branches / 18.93% functions / 12.61% lines. Floor set 1pt
        // below to ratchet monotonically.
        "server-handlers/**": {
          lines: 11,
          statements: 12,
          functions: 17,
          branches: 11,
        },
      },
    },
  },
});
