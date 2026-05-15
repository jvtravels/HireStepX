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

## Negotiation-flow redesign (2026-05-15 session — commits 3, 4, 6, 7, 8)
- [2026-05-15] Commit 3 — `planNextAction(state) → NextAction` central planner that owns the "what should the recruiter do this turn" decision (currently distributed across move-picker + brief + system-prompt + discovery-sequence). Cut: would require an audit pass over all 4 producers to make sure the planner doesn't drift from current behavior; one-shot risk too high for this session. `validateNextActionEmitted` (commit 5) was scope-cut to re-use `getNextDiscoveryQuestion` instead of consuming `planNextAction` output. (resolved: 2026-05-15 — `_next-action-planner.ts` shipped; move-picker is a thin shell; brief reads `state.plannedNextAction`; planner registers via globalThis hook to break the kernel↔planner load cycle. `validateNextActionEmitted` rewiring still pending — see entry below.)
- [2026-05-15] Commit 3 follow-up — `validateNextActionEmitted` consumed `getNextDiscoveryQuestion` rather than `state.plannedNextAction.ask`. (resolved: 2026-05-15 commit 3 — validator now reads `state.plannedNextAction.ask` when the planned action is `discovery-probe`, with a getNextDiscoveryQuestion fallback for back-compat with pre-commit-3 serialized sessions.)
- [2026-05-15] Commit 4 — `lastBriefTags` → `briefDecisionLog: BriefDecisionEntry[]` ring buffer (last 5 turns of {tag, turnIndex, reason, accepted}). Cut: state-shape extension touches every reducer call site; without commit 3's planner the entries would be redundant with existing decisionLog.
- [2026-05-15] Commit 6 — Discovery-sequence rewrite from imperative `getNextDiscoveryQuestion` switch-table to declarative `DISCOVERY_SEQUENCE: Question[]` array with `nextUnanswered(checklist, sequence)` reducer. Cut: cosmetic refactor under hot-path; defer until commit 3's planner consumes it.
- [2026-05-15] Commit 7 — Voss-tactics scheduler — make labels/mirrors/calibrated-questions fire by a scheduler (turn-cadence + state-trigger) instead of opportunistic in-brief prompt injection. Cut: needs the briefDecisionLog from commit 4 to avoid stacking tactics on the same draft.
- [2026-05-15] Commit 8 — Decision-log surfacing in the post-session coach view — render the (still-deferred) briefDecisionLog as "why the recruiter did X on turn N" timeline. Cut: depends on commits 3+4 landing; surface-only ship.

Each of commits 3-8 still makes sense and would compound nicely on the 1+2+5 foundation that landed: commit 3 (planner) is the keystone — commits 4, 6, 7, 8 all read cleaner once a single function owns "what's the next move." Recommend commits in order 3 → 6 → 4 → 7 → 8 next session.

## Orphan-detector scope
- [2026-05-15 | 4482f87] `src/__tests__/orphanExports.test.ts` scopes to kernel + negotiation core files. Razorpay/CORS/subscription helpers in `server-handlers/_*.ts` carry ~140 additional "test-only exported" symbols; out of scope for the dead-wiring threat model (they're public API surfaces by design). Widening scope is its own triage ship.
