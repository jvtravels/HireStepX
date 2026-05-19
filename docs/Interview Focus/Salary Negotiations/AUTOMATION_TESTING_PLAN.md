# Salary Negotiation — Automation Testing Plan

**Status:** Draft (2026-05-19)
**Owner:** salary-negotiation focus
**Sibling docs:** [`../SCORE_IMPROVEMENT_PLAN.md`](../SCORE_IMPROVEMENT_PLAN.md)

---

## 1. Problem statement

The salary-negotiation surface is a combinatorial product of **independent
axes** that interact at runtime:

| Axis                  | Cardinality | Examples                                                                |
| --------------------- | ----------- | ----------------------------------------------------------------------- |
| Company tier          | 6           | FAANG / GCC / Unicorn / Startup / Services / BFSI                       |
| Sector persona        | 6           | it-services / gcc / indian-unicorn / early-startup / bfsi / default     |
| Round persona         | 3           | hr-partner / hiring-manager / director                                  |
| Multi-round mode      | 2           | enabled / disabled (default-OFF byte-identical invariant)               |
| Role × level          | ~40         | SDE-1/2/3, EM, PM/SPM, Senior PD, Data, DS, SRE, …                      |
| Candidate archetype   | ~10         | under-asker / moonshot / anchored / hedger / walker / BATNA-loaded / …  |
| Negotiation path      | ~20         | anchor-counter-accept / anchor-walk / equity-probe-only / cap-then-take |
| Tax regime            | 2           | old / new                                                               |
| Joining bonus present | 2           | yes / no                                                                |
| Equity present        | 3           | none / private-ESOP / public-RSU                                        |

Naive cross-product ≈ **7 million cells**. Today's ~30 hand-authored fixtures
cover <0.01%. Every PDF audit (we are on PDF#36) surfaces a bug in an unseen
cell. Manual testing cannot keep up with feature velocity.

**Goal:** keep coverage growth ahead of feature growth — without paying $$$
on an LLM simulator on every PR.

---

## 2. What's already in place

Existing salary-neg test surface (≈95 passing tests):

- `salaryNegotiationFixtures.test.ts` — 30 hand-authored transcripts
- `negotiationKernelStateMachine.test.ts` — 5 snapshot scenarios
- `multi-round-kernel.test.ts` — 19 kernel transitions (Phase 5A)
- `indianRecruiterPersonas.test.ts` — 19 per-persona prose checks
- `pdf36MeeshoSeniorPDArchPass.test.ts` — 23 regression cases from a user audit
- `negotiationKernel.test.ts`, `negotiationCounter.test.ts`,
  `negotiationLevers.test.ts`, … — unit tests around individual helpers

**What's missing:**

- Cross-axis matrix coverage — we test each cell, not the combinations
- Property invariants — no "kernel never enters an impossible state" assertion
  over arbitrary turn sequences
- Adversarial candidate inputs (typos, code-switching, malformed numbers)
- Production-replay corpus

**The crucial leverage:** `_negotiation-kernel.ts` and `_canonical-prose.ts`
are **deterministic and pure** (no I/O, no clock, no randomness). The LLM
restyle is the only stochastic layer, and it's bypassed by the validator
fallback to canonical prose. **Determinism is the foundation that makes
automation testing realistic at all.**

---

## 3. Five-layer approach

Each higher layer trades cost for coverage of more subtle bugs. Land bottom-up.

### Layer 1 — Deterministic scenario matrix (highest ROI, ship first)

**What:** combinatorial **pairwise** generator over the axes in §1. The IBM
PICT algorithm reduces 7M cells to ~250–400 scenarios that cover every
**pair** of axis values at least once. (Empirically: ~80% of cross-axis bugs
are pairwise interactions.)

**Layout:**

```
src/__tests__/scenarios/
  axes.ts              ── declarative axis registry (tier, persona, role, …)
  archetypes.ts        ── candidate playbooks (under-asker, moonshot, …)
  generator.ts         ── pairwise covering-array (in-house, ~120 LOC, no dep)
  __snapshots__/       ── golden corpus, one file per scenario
  scenarioMatrix.test.ts
```

**Per-scenario harness (pure, no LLM calls):**

1. `initState(scenarioFromAxes(scenario))`
2. Drive the kernel through the archetype's scripted playbook (10–30 turns)
3. Assert invariants (see Layer 2)
4. `toMatchSnapshot({ finalPhase, flags, totalScore, roundLedger })` —
   **structural snapshot, not prose** — so prose changes don't rebaseline 250
   files.

**CI impact:** ~10s incremental, runs on every PR.

**Why first:** deterministic, fast, $0 cost, catches the bulk of cross-axis
bugs surfaced today through PDF audits.

---

### Layer 2 — Property-based testing (kernel invariants)

**What:** `fast-check` (new dev-dep, ~50KB) generates **arbitrary sequences
of `applyCandidateAnswer` / `applyAiMove` calls** with random utterance shapes
drawn from a small grammar. 200–1000 random sequences per property; on
failure, fast-check shrinks to the minimal repro.

**Invariants to assert:**

1. **`roundIndex` monotone-up** — never decreases turn-over-turn
2. **`highestOfferMade` monotone-up** — anchors can rise, never fall
3. **ZOPA bound**: `walkAway ≤ initialOffer ≤ candidateTarget` always
4. **Acceptance gate**: `acceptedAtTurn != null ⇒ phase === "accepted"` AND
   `verbalAcceptanceTurn` is set
5. **askedTopics monotonicity**: ledger only grows
6. **roundTransitions contiguity**: `hr-partner → hiring-manager → director`,
   no gaps, no out-of-order
7. **Phase reachability**: every `phase` reached comes from a documented
   predecessor in the state-machine diagram
8. **Default-OFF byte-identity** (the contract we now have a doc-comment for):
   with `multiRoundEnabled === false`, the post-state of any turn sequence is
   `deepEqual` to the pre-Phase-5 HEAD output for the same inputs. Run against
   a pinned snapshot of pre-Phase-5 kernel behaviour.
9. **No silent capitulation**: `highestOfferMade` only rises when the planner
   emitted a `counter-offer` / `anchor-with-offer` / lever kind — never on a
   probe / clarification turn.
10. **Validator-fallback safety**: for every NextAction kind, the canonical
    prose passes its own validators (no kernel-produced prose ever fails the
    restyle contract).

**CI impact:** ~30s with 200 cases/property, runs on every PR.

**Why second:** catches off-by-one boundaries and rare sequences that the
matrix can't enumerate by construction.

---

### Layer 3 — Simulated candidate agent (the "real" simulator)

Two flavours, ship 3a on PRs and 3b nightly.

#### 3a. Rule-based candidate agent (CI-safe, deterministic)

**What:** each candidate archetype = a small state machine that reads the
bot's last move and picks its next utterance from a templated library with
`${number}` slots filled from the bot's offer.

**Archetypes (~10):**

| Archetype       | Behaviour                                                                  |
| --------------- | -------------------------------------------------------------------------- |
| under-asker     | Anchors below band-min; never counters; accepts first non-rescission offer |
| moonshot        | Anchors at band-max+30%; walks if no movement by turn 6                    |
| BATNA-loaded    | Opens with competing offer "₹X at Company Y"; counters every offer up      |
| hedger          | Returns ranges ("12–15") to every direct number ask                        |
| equity-focused  | Probes vesting/cliff/FMV on every offer; ignores joining bonus             |
| scope-trader    | Offers scope expansion in exchange for cash; pushes title bump             |
| walker          | Walks if AI offers < target by turn 4 — short-fuse persona                 |
| accepter        | Accepts first concrete number; no counter                                  |
| fact-confused   | Misstates own current CTC mid-session; mixes LPA and CTC numbers           |
| code-switcher   | Mixes Hindi/English ("notice period", "kitne mein settle hoga")            |

**Run shape:** archetype × persona = ~10 × ~9 = ~90 full-session simulations
(30–50 turns each). Each asserts:

- Terminal phase matches the expected outcome for the archetype
- The expected analyzer flags fire (e.g. under-asker ⇒ `user_below_band_underask`)
- No PDF-audit bug surfaces (LEADING_ACK rotation, ai_consecutive_duplicate_question, etc.)

**CI impact:** ~20–30s on every PR; **$0 cost — no LLM calls.**

#### 3b. LLM candidate agent (nightly / off-PR)

**What:** Anthropic SDK with prompt caching. A Claude model in candidate-mode
gets a persona dossier + the bot's last turn; emits a 200-token reply. Run a
30-turn session per scenario.

**Cadence:** weekly nightly, ~20 scenarios, ~$2–5 per run.

**Output:** validated runs feed back into the Layer 1 golden corpus.

**Why both:** rule-based gets 80% of the value at 0% of the cost; LLM agent
exists to probe the long tail of natural-language variation that rule-based
templates can't simulate.

---

### Layer 4 — Production-replay corpus

**What:** anonymize and snapshot a slice of real sessions (or staging
sessions you've run yourself). Each becomes a fixture:

```ts
{
  candidateUtterances: string[],
  kernelInitInput: SalaryNegotiationInput,
  expectedKernelStateHash: string,
  expectedAnalyzerFlags: string[],
  expectedFinalScore: number
}
```

**How:** PostHog already logs `kernel_init` + `salneg_persona`. Build
`scripts/captureSessionFixture.ts` that converts a PostHog event log into a
deterministic fixture (scrub PII first — names, companies, salary numbers
hashed to bands).

**Cadence:** capture quarterly. Re-run on every PR to catch regressions when
the kernel evolves.

**Why fourth:** catches what humans **actually** do, not what we *think* they
do. Slow to build, but the corpus compounds.

---

### Layer 5 — Mutation testing (optional, quarterly)

**What:** StrykerJS on `salary-negotiation.ts` + `_negotiation-kernel.ts` +
`_canonical-prose.ts`. Mutates flag-firing logic, kernel transitions, persona
selection; reports which mutations the matrix + properties **miss**.

**Cadence:** quarterly (full run takes ~10–20 minutes). Results drive new
fixtures into Layer 1.

**Why fifth:** a meta-test of the test suite. Tells you where coverage is
shallow.

---

## 4. Tooling choices

| Concern             | Pick                                | Rationale                                                |
| ------------------- | ----------------------------------- | -------------------------------------------------------- |
| Pairwise generator  | In-house (~120 LOC TS)              | No dep risk; PICT algorithm is well-documented           |
| Property-based      | `fast-check`                        | Industry standard, good shrinking, dev-dep only          |
| LLM simulator       | Existing Anthropic SDK              | Already used for restyle; reuse prompt caching           |
| Replay capture      | PostHog events → JSON fixture       | `salneg_persona` / `kernel_init` are already instrumented |
| Snapshot diffing    | Vitest built-in `toMatchSnapshot`   | No new dep                                                |
| Mutation testing    | StrykerJS                           | TS-native, vitest-compatible runner                       |

---

## 5. Phase plan

### Phase A — Matrix (1–2 days)

- [ ] `src/__tests__/scenarios/axes.ts` — axis registry
- [ ] `src/__tests__/scenarios/generator.ts` — pairwise pict generator
- [ ] `src/__tests__/scenarios/archetypes.ts` — 10 candidate playbooks
- [ ] `src/__tests__/scenarios/scenarioMatrix.test.ts` — harness
- [ ] Initial snapshot corpus committed
- **Output:** ~250 scenarios green in <10s on PR

### Phase B — Properties (1 day)

- [ ] Add `fast-check` to devDeps
- [ ] `src/__tests__/kernelInvariants.test.ts` with 10 properties (§3 Layer 2)
- **Output:** kernel invariants asserted across 2000+ random sequences/run

### Phase C — Rule-based candidate agent (2–3 days)

- [ ] `src/__tests__/simulator/candidateAgent.ts` — archetype state machines
- [ ] `src/__tests__/simulator/runSession.ts` — driver
- [ ] `src/__tests__/simulator/sessions.test.ts` — 90 sessions × 30 turns
- **Output:** end-to-end deterministic sessions on PR, $0 cost

### Phase D — LLM simulator + replay corpus (later)

- [ ] Nightly LLM candidate runner (CI cron, weekly)
- [ ] `scripts/captureSessionFixture.ts`
- [ ] First 20-session replay corpus committed
- **Output:** quarterly bug-discovery cadence beyond what determinism catches

### Phase E — Mutation testing (quarterly, optional)

- [ ] StrykerJS config
- [ ] First mutation report → new Layer-1 fixtures

---

## 6. Risks / open questions

- **Snapshot churn:** any prose change rebaselines structural snapshots if
  they accidentally include prose. Mitigation: snapshot **state shape + flags +
  score**, never prose text — prose has its own focused tests already
  (`indianRecruiterPersonas.test.ts`, `phase5RoundPersonaProse.test.ts`).
- **Pairwise covers pairs only:** 3-way interactions can still slip.
  Mitigation: Layer 3b nightly LLM runs probe higher-order interactions; if
  one is caught, lift to a Layer 1 fixture.
- **Rule-based agents are stilted:** they won't catch prose-quality bugs
  (only structural ones). That's exactly what Layer 3b LLM agent and the
  existing prose tests cover.
- **Replay corpus PII:** scrub names/companies/exact numbers before
  committing. Build the scrubber once; reuse.
- **CI time budget:** Phases A+B+C add ~60s to PR. If that's too much, gate
  Layer 3a behind a `[full-test]` PR label and only run smoke set by default.

---

## 7. Success metrics

- **Coverage:** every pairwise axis combination appears in ≥1 passing
  scenario (pict-complete)
- **Regression rate:** zero PDF-audit-style bugs survive PR review (today's
  catch-cadence is per-PDF; target is per-PR)
- **CI cost:** <1 min added to PR pipeline for Layers 1–3a
- **Bug discovery:** Layer 3b LLM nightly surfaces ≥1 unseen issue per month
  for the first 6 months — feeds back into Layer 1 corpus

---

## 8. Open call-outs to revisit during Phase A

- Do we expose a `state-as-stable-hash` helper from `_negotiation-kernel.ts`
  for snapshot diffing? (Avoids brittleness around field-order drift in
  serialisation.)
- Does the existing `_llm-rescore.ts` pipeline need a "skip rescore in
  scenario tests" mode? (Currently version-bump-triggered; tests should pin
  the analyzer version.)
- Where does the canonical "expected outcome per archetype × persona" table
  live? — likely `archetypes.ts` itself, but it doubles the fixture surface.
- Test-data axes vs. **runtime** axes — we should pin axes to types
  re-exported from the kernel / personas modules so the generator can't drift
  out of sync silently. `keyof typeof TIER_BUCKET_LABEL`, etc.
