import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "node_modules/",
      ".tempo/",
      "tempo/**",
      ".vercel/**",
      ".next/**",
      "public/**",
      "scripts/**",
      // loadtest/ runs in Node (no browser globals); lint-on-it produces
      // noise since the eslint config targets browser + Next code paths.
      "loadtest/**",
      "coverage/**",
      // typescript-eslint's parser stack-overflows on the giant
      // template-literal payloads in LEVER_GUIDANCE (multi-KB strings
      // across ~50 entries in a Record<NegotiationLever, string>).
      // File still gets type-checked via `tsc --noEmit`; lint-only
      // exemption keeps CI green until the strings move to data/.
      "server-handlers/_negotiate-turn-helpers.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Allow the deliberate `role="list"` on <ul>/<ol> that also carry
      // `list-style: none`. Safari + VoiceOver strip the implicit list
      // semantics the moment list-style is removed, so re-asserting
      // role="list" is the standard a11y workaround (not cargo-cult) —
      // used across the pSEO/marketing pages. Every OTHER redundant role
      // (button, navigation, listitem, …) is still an error.
      "jsx-a11y/no-redundant-roles": ["error", { ul: ["list"], ol: ["list"] }],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Codebase-health guardrails — enforce hygiene rules the team picked
      // during the 10/10 audit push. Ratchet limits downward over time.
      //
      // max-lines: warn when a single file crosses ~1500 LOC. Not an error
      // (we have legitimate outliers like SessionReportView) but visible
      // in PR review. Count excludes blank lines and comments so format
      // changes don't trip it.
      "max-lines": ["warn", {
        max: 1500,
        skipBlankLines: true,
        skipComments: true,
      }],
      // Ban `as unknown as SomeType` in production code. The pattern is
      // a grep-able "give up on types here" signal and masked the resume-
      // data drift bug we just fixed. Test files are exempt via the
      // override below — mocks legitimately need it.
      "no-restricted-syntax": ["warn",
        {
          selector: "TSAsExpression[expression.type='TSAsExpression'][expression.typeAnnotation.type='TSUnknownKeyword']",
          message: "Avoid `as unknown as X` in production code — define a discriminated union or type guard instead. (See resumeParser.ts StoredResume for the pattern.) This rule is off in src/__tests__/* where mocks need it.",
        },
        /* PR-6 (PDF #28 Month 1) — ledger-tracked slot writes are
         * owned by _negotiation-kernel.ts. Every external write would
         * silently bypass the dual-write to state.ledger that PR-2
         * established, re-opening the class of bug the migration
         * exists to close. Consumers READ via getFactOr(state.ledger,
         * "...", state.X). This rule is turned off in the kernel
         * itself (next config block) and in test fixtures (existing
         * block at the bottom). */
        {
          selector: "AssignmentExpression[left.type='MemberExpression'][left.object.name='state'][left.property.name=/^(candidateCurrentCtc|candidateCurrentCompany|competingOffer)$/]",
          message: "Direct write to a ledger-tracked NegotiationState slot is forbidden outside _negotiation-kernel.ts. The kernel owns these writes so the dual-write to state.ledger (PR-2) fires and first-wins (PR-4) is preserved. Read via getFactOr(state.ledger, ..., state.X); to add a new write path, route the parse through applyCandidateAnswer / applyAiMove.",
        },
      ],
    },
  },
  // PR-6 — _negotiation-kernel.ts is the ONE file allowed to write
  // ledger-tracked slots directly. The dual-write to state.ledger lives
  // alongside every slot mutation; turning the ban off here keeps the
  // legitimate kernel writes legal without re-opening the surface to
  // the rest of the codebase. The as-unknown-as ban is also lifted as a
  // pragmatic concession — the kernel has none of those today and the
  // tooling forces an all-or-nothing choice on no-restricted-syntax.
  {
    files: ["server-handlers/_negotiation-kernel.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Test-file exemptions: mocks and fixtures legitimately need the escape
  // hatches we ban elsewhere.
  {
    files: ["src/__tests__/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": "off",
      "max-lines": "off",
    },
  },
  // E2E-only bans: `page.waitForTimeout` and `waitForLoadState('networkidle')`
  // are flake factories. Wait for explicit state instead. Scoped to
  // tests/e2e/** so unit tests are unaffected. See tests/.test-plan.md.
  {
    files: ["tests/e2e/**/*.{ts,tsx}"],
    rules: {
      // Starts as warn so the existing 16 violations don't block CI;
      // ratchet to error once they're cleaned up (see .test-plan.md
      // "Upgrades needed").
      "no-restricted-syntax": [
        "warn",
        {
          selector: "CallExpression[callee.property.name='waitForTimeout']",
          message:
            "Do not use page.waitForTimeout — wait for an explicit condition (toBeVisible / waitForResponse / waitForFunction). See tests/.test-plan.md.",
        },
        {
          selector:
            "CallExpression[callee.property.name='waitForLoadState'][arguments.0.value='networkidle']",
          message:
            "Do not use waitForLoadState('networkidle') — it's flake-prone. Wait for a specific element or response instead.",
        },
      ],
    },
  },
  eslintConfigPrettier,
);
