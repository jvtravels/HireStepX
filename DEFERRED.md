# Deferred Items Ledger

This file tracks intentionally-deferred work. Append-only (add a "resolved"
note inline when shipped — don't delete the line). Sweep monthly.

## Format
- `[YYYY-MM-DD | commit-sha] Title — brief reason for deferral. (resolved: yyyy-mm-dd sha if shipped)`

## Architecture
- [2026-05-15 | dabb3ea] Market-mode auto-inference from role — currently set explicitly via `initState`; `inferMarketMode` + `getConcessionMultiplier` are authored in `_market-mode.ts` but never called by the engine. Auto-inference path (role=data → force-hot) not implemented.
- [2026-05-15 | e599526] Wave-5+6+7 mass flag expansion — ~63 of 73 originally-scoped candidate-profile flags unshipped; polish, not blocking.
- [2026-05-15 | 5d841b5] Equity-instrument flags (Fix 6 in 2026-05-09 PDF) — cut due to scope of the candidate-profile enumeration pattern; system prompt does carry an EQUITY DISCLOSURE rule as a partial mitigation.
- [2026-05-15 | 3fcac3d] Sprint C.2 active-phase gating in `derivePhase` — `derivePhase` exits "opening" the instant `highestOfferMade > 0`; the practical gate is the move-picker discovery-incomplete branch (shipped). A second pass through `derivePhase` itself remains deferred.

## Detectors authored but not wired
- [2026-05-15 | 4482f87] Trial-close detector (`detectTrialCloseAsked`, `detectTrialCloseResponse`, `detectVariableComfortAsked`, `analyzeEquityClarity` in `_trial-close-detector.ts`) — exported and unit-tested but never threaded into the brief / move-picker. Surfaces a sophisticated negotiation tactic class; wiring is its own ship.
- [2026-05-15 | 4482f87] Verbose recruiter-critique mode (`critiqueRecruiterWithQuotes`) — kept for the planned post-session coach surface; not used by the live engine.
- [2026-05-15 | 4482f87] `shouldDiscloseRange` in `_range-disclosure-phase.ts` — helper for the planned phase-rule consolidator; current range-disclosure path runs through the kernel phase enum directly.

## Tests
- [2026-05-15 | cb1aa75] Dedicated `[ITEM REFUSED — SKIPPED]` brief-injection test — covered transitively in `refusalFallback.test.ts`; no standalone brief test.
- [2026-05-15] ~6 pre-existing flaky tests (verifyAuth retry + e2e-flows localStorage timing + wave3/wave4 system-prompt regex timeouts) — env flakes, unrelated to recent ships. Show up in some `vitest run` invocations and not others.

## Orphan-detector scope
- [2026-05-15 | 4482f87] `src/__tests__/orphanExports.test.ts` scopes to kernel + negotiation core files. Razorpay/CORS/subscription helpers in `server-handlers/_*.ts` carry ~140 additional "test-only exported" symbols; out of scope for the dead-wiring threat model (they're public API surfaces by design). Widening scope is its own triage ship.
