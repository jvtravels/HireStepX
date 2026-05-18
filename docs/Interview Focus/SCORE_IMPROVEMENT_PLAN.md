# Interview Focus — Score Improvement Master Plan

Single source of truth for raising the analyzer + UX quality of every interview focus on HireStepX. Each focus is rated 0–10 across 8 axes (UX, Value, Industry standards, Logic, Question flow, Architecture, Prompt quality, Eval rigor). This doc lists baseline scores, top weaknesses, a phased plan, and the score-trajectory target.

**Convention used across all focuses**:

- Phase 1 = quick wins (≤1 day each)
- Phase 2 = depth validators (analyzer richness)
- Phase 3 = persona / archetype variability
- Phase 4 = hygiene (fixture suite, prompt-cache, version bump)
- Phase 5 = stretch (optional)

**Cross-focus principles** (apply everywhere):

1. Static rules / taxonomies BEFORE dynamic content in every Groq prompt — preserves the ≥1024-token prefix cache and cuts per-call cost \~3×.
2. US-ism drift detector (`USISM_PATTERNS` from `salary-negotiation.ts`) should run against AI turns in every Indian-register focus.
3. Ground-truth fixture suite per analyzer: 12–20 transcripts mirroring `hrRoundAnalyzer.test.ts`.
4. Bump analyzer `version` string when detection logic changes so `_llm-rescore.ts` re-evaluates instead of reading stale cached scores.
5. Surface positive signals, not just negatives — candidates need anchors.

---

## Score summary

Verified against on-disk analyzer versions on 2026-05-19 (re-checked from `grep "version:" server-handlers/analyzers/*.ts`). **Current** column reflects shipped phases against the live `version:` field in each analyzer.

| \# | Focus | Baseline | **Current** | Target | Analyzer version | Effort remaining | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | HR Round | 8.1 | **9.1** | 9.2 | `hr-round-v5.1.0` | \~0.5d | ✅ Phases 1–5 shipped (+1.0 of +1.1). Within 0.1 of target — polish only. |
| 2 | Salary Negotiation | 8.4 | **9.7** | 9.5 | `salary-negotiation-v8` | \~3 days | ✅ Phases 1–4 shipped (+1.3 of +1.1) — Phase 1 wired `_ctc-breakdown.ts`, clustered coaching, tier band; Phase 2 wired `_equity-literacy.ts` + `_negotiation-math.ts:batnaStrength`, added clawback / variable-pay realism / closed-too-fast / lost-track-of-offer detectors; Phase 3 added Indian recruiter SECTOR personas (IT-services / GCC / unicorn / startup / BFSI / default) with persona-conditional `band-disclosure-deflect` / `counter-offer` / `anchor-with-offer` prose; Phase 4 hygiene shipped 30-fixture regression suite + per-flag precision/recall gate + 5-path kernel state-machine snapshot tests. Phase 5 (stretch) pending. |
| 3 | Behavioral | 7.6 | **9.3** | 9.5 | `behavioral-v5` | \~5d (Phase 6.1/6.2/6.5/6.6/6.7) | ✅ **Target exceeded** (9.1 reached, target raised). Phases 1–5 shipped + Phase 6.3 (evidence-quality) + 6.4 (quote-matched-phrase) + STAR-S broadening. |
| 4 | Campus Placement | 7.4 | **8.6** | 8.6 | `campus-placement-v6.4` | 0d | ✅ **Target reached.** Phases 1–5 shipped (+1.2 of +1.2). Live version v6.4 confirms continued post-target iteration. |
| 5 | Technical Leadership (Technical + System Design) | 7.8 | **7.9** | 9.0 | `technical-v2` / `system-design-v1` | \~7.5 days | Technical analyzer at v2 (+0.1 inferred from version bump). System Design untouched. Phases 1–5 still pending end-to-end. |
| 6 | Panel Interview | 7.5 | **7.5** | 8.8 | `panel-v1` | \~6 days | — Not started. |
| 7 | Case Study | 7.2 | **7.2** | 8.7 | `case-study-v1` | \~6.5 days | — Not started. |
| 8 | Strategic | 7.3 | **7.3** | 8.7 | `strategic-v1` | \~6.5 days | — Not started. |
| 9 | Management | 7.4 | **7.4** | 8.7 | `management-v1` | \~6 days | — Not started. |
| 10 | Government / PSU | 7.0 | **7.0** | 8.5 | `government-psu-v1` | \~6 days | — Not started. |

**Aggregate progress**:

- **Shipped delta**: +4.2 score-points across HR Round (+1.0), Behavioral (+1.7, target raised 9.1 → 9.5), Campus Placement (+1.2), Salary Negotiation (+0.3 vs new target 9.7), Technical (+0.1).
- **Target reached**: Campus Placement + Behavioral (target raised). Salary Neg overshoots prior 9.5 baseline at 9.7. HR Round next (0.1 away).
- **Untouched**: 4 of 10 focuses (Panel, Case Study, Strategic, Management, Government/PSU).
- **Highest unrealized opportunity**: Behavioral Phase 6.1/6.2/6.5/6.6/6.7 (~5d, +0.2 → 9.5) and Technical Leadership (~7.5d, +1.1).

**Recommended sequencing (updated)**: Campus Placement and HR Round are essentially done. Next priorities by leverage-per-day:

1. **Finish HR Round Phase 5 polish** (\~0.5d, +0.1) — closes one focus completely.
2. **Salary Negotiation Phases 1–5** (\~8d, +1.1) — largest unrealized revenue lever; orphan helpers already shipped.
3. **Technical Leadership** (\~7.5d, +1.1) — largest TAM segment.
4. **Panel / Case Study / Strategic / Management** — mid-tier, bundle in one sprint.
5. **Government / PSU** last — smallest paying segment but highest competitive moat (nobody else builds for SSC/UPSC/PSU candidates).

---

## 1. HR Round (8.1 → **9.1** → 9.2)

**File**: `server-handlers/analyzers/hr-round.ts` (v5.1.0, \~36 detection blocks) **State**: Most mature analyzer alongside Salary Neg. Strong signal coverage; gaps are at the edges. Phases 1–5 complete.

**Top weaknesses**:

1. Counter-offer dodge detection is binary — doesn't distinguish "graceful deflection" from "evasive lie"
2. Resume cross-checks fire but feedback is generic ("inflated_seniority_claim" → no story for the candidate)
3. Coaching tips are 1-liner per flag; \~30 flags share \~10 coaching templates → repetition feels rote

### Phase 1 — Quick wins (\~1d, +0.3) ✅ DONE (commit `06881b8`)

- **1.1** ✅ Group similar flags into coaching clusters with templated narrative ("3 evasive signals across compliance — pattern, not isolated"). Edit: `hr-round.ts` coaching-bits builder. → Implemented as `CLUSTERS` table (compliance / commitment / stability / credibility); "Pattern, not isolated" line prepended when ≥2 members fire.
- **1.2** ✅ Surface resume-vs-transcript mismatch with the specific delta ("Resume: TL at Flipkart 2021-23; you said 'I led the team since 2020'"). Pull from `session.jd_analysis` already loaded. → `resume_transcript_mismatch` and `inflated_seniority_claim` observed strings now quote resume employers / titles vs. verbal claim.
- **1.3** ✅ Add `OFFER_ACCEPTED_GRACEFUL` positive counterpart to `COUNTER_OFFER_DODGE` — candidate gets credit for handling cleanly. → New regex + flag; suppresses `counter_offer_dodge`; surfaced as positive note in `coachingNotes`.

### Phase 2 — Depth validators (\~2d, +0.3) ✅ DONE (commit `3a4a5e3`)

- **2.1** ✅ Notice-period negotiation depth: detect buyout discussion / handover plan vs. pure "I can join in X days". → `notice_period_shallow` flag fires when notice is concrete but session never touches buyout / handover / KT / LWD / early release.
- **2.2** ✅ BGV / employment verification literacy: detect knowledge of `Form 16`, `UAN`, `relieving letter`, `payslip` requirements. → `bgv_literacy_low` flag fires when BGV came up and candidate never named a single doc (suppressed under active evasion).
- **2.3** ✅ Compensation breakup probing: detect when candidate asks ESOP vesting cliff, variable %, joining bonus clawback terms. → `comp_breakup_probe_missing` flag fires when benefits/ESOP/clawback was on the table and candidate never probed terms.

### Phase 3 — Persona variability (\~2d, +0.2) ✅ DONE (commit `41cf71f`)

Three HR archetypes (distinct from `_indian-panel-personas.ts` — those model voices INSIDE a panel loop; these model standalone-HR archetypes):

- **HR Partner (warm)** — default; rapport-led
- **HR Business Partner (firm)** — process-led, asks for proof points
- **Talent Acquisition (transactional)** — quick screen; speed-of-decision dominates

Selector keyed off company tier × experience: TA for IT-services / startup-early / edtech freshers-to-mid; HRBP for FAANG / big-tech / GCC / consulting / BFSI-global or any senior+; warm Partner default. Wired into `generate-questions.ts`; persona id logged to PostHog as `hr_persona`. New file: `src/_indian-hr-personas.ts` + 9 unit tests.

### Phase 4 — Hygiene (\~1d, +0.2) ✅ DONE (commit `185cc88`)

- **4.1** ✅ Expand `hrRoundAnalyzer.test.ts` fixture suite to cover each of the 30+ detection blocks. → Added 4 fixtures for the new flags (36–39); total HR-round fixtures 37 → 41, all pass the 0.85 precision / recall gate.
- **4.2** ✅ Reorder `evaluate-session` HR path: static rules before transcript (current path interleaves company context). → Moved `tierSuffix` + `rubricWeight` + per-company `focusRubric` overlay out of the static CRITICAL RULES prefix and into the tail after the transcript; cacheable prefix is now company-invariant.
- **4.3** ✅ Bump version to v5. → `hr-round-v5.0.0` shipped.

### ✅ Phase 5 — Stretch (\~1d, +0.2) — **DONE** (commit `5e40e8a`)

- **5.1** ✅ Counter-offer simulation: when user volunteers that their current employer is likely to counter, analyzer flags `current_employer_counter_unresolved` unless candidate explicitly declines. — `COUNTER_OFFER_VOLUNTEERED` + `COUNTER_OFFER_DECLINE` regex pair; suppressed when `offer_accepted_graceful` already fires.
- **5.2** ✅ Probationary-period awareness probe (services-track specific). — `PROBATION_PROMPT` + `PROBATION_PROBE` regex pair; fires `probation_terms_unprobed` when HR raises probation and candidate never asks duration / criteria / pay implications.
- **5.3** ✅ Bumped analyzer to `hr-round-v5.1.0`; added fixtures 40 & 41 (total 43, all green at 0.85 / 0.85 gate).

---

## 2. Salary Negotiation (8.4 → 9.5)

**File**: `server-handlers/analyzers/salary-negotiation.ts` (v4, \~30 detection blocks) **Orphaned helpers ship-ready**: `_ctc-breakdown.ts`, `_equity-literacy.ts`, `_negotiation-math.ts:batnaStrength`

**Top weaknesses**:

1. 30+ flags, only 5 coaching tips
2. CTC breakdown helper exists but never surfaces in report
3. Equity-literacy helper exists but unused — startup/unicorn candidates fly blind on ESOP terms

### Phase 1 — Quick wins (\~1d, +0.3) ✅ DONE (commit `ff07b5e`)

- **1.1** ✅ Wire `computeOldRegimeTaxLpa` + `computeNewRegimeTaxLpa` from `_ctc-breakdown.ts` into the report — show in-hand monthly under both regimes for the negotiated offer. → Analyzer writes `meta.salaryNegotiation.{closingTotalLpa, monthlyTakeHomeNewRegimeInr, monthlyTakeHomeOldRegimeInr, annualTaxNewRegimeLpa, annualTaxOldRegimeLpa}` against the last AI compensation claim. UI renders `InHandMonthlyCard` in `NegotiationFullReport.tsx` directly under the offer trajectory, side-by-side new vs old regime + caveat line.
- **1.2** ✅ Expand coaching catalog from 5 to \~20 tips, one per top-frequency flag cluster. → `CLUSTERS` table mirrors HR-round v4.5 (commit `06881b8`): discovery / anchoring / counter / close. "Pattern, not isolated" line prepended when ≥2 cluster members fire. ~20 per-flag tips appended covering usism drift, role-company mismatch, stale calibration, anchoring/underask/moonshot, BATNA, equity, joining bonus, notice period, accepted-without-pushback, silent capitulation, no-counter, regression, unrealistic close, self-contradiction, misread-conditional, ignored-complaint, repetition stutter, reversed range, arithmetic error, hallucinated band.
- **1.3** ✅ Surface `tierBucket` (FAANG/GCC/Unicorn/Startup/Services/BFSI) in the report header so candidate sees which band they were scored against. → `meta.salaryNegotiation.tierBucketLabel` rendered as a mono chip ("Tier · Indian unicorn") in `NegotiationFullReport` header alongside the existing copper Salary Negotiation pill. Tier band emitted independently of closing offer, so first-time sessions on services / startup tier still see it.
- **Version**: bumped to `salary-negotiation-v5`. Tests: `src/__tests__/analyzers/salary-negotiation.test.ts` extended with 8 Phase-1 cases (meta presence, regime monthly math, tier-only fallback, omitted meta when unknown, two cluster narratives, expanded per-flag tips, version bump). All 32 file-local cases + full vitest suite (368 files / 5945 tests) green.

### Phase 2 — Depth validators (\~2d, +0.4) ✅ DONE (commit `3ad7dc8`)

- **2.1** ✅ Wired `computeEquityGrant` from `_equity-literacy.ts`. When equity / ESOP / RSU appears in transcript and an AI turn names a grant face value, analyzer runs the helper at default 4yr / 1yr cliff and emits `meta.salaryNegotiation.equityLiteracy` with cliff / half-vest / full-vest realistic values, perquisite tax at full vest, and net-after-tax. New flag `equity_terms_not_probed` fires when candidate never asks cliff / FMV / strike / dilution / refresh / exercise window.
- **2.2** ✅ Wired `batnaStrength` from `_negotiation-math.ts`. Replaces binary BATNA detection. Each user turn matching BATNA_RE is parsed into a `CompetingOffer` (LPA extracted only when adjacent to BATNA vocab; `inWriting` from "offer letter / written offer" phrasing; `peerTier` inferred from named LPA; `ageDays` from "yesterday / months ago" cues) and run through the helper. Strong-typed `score / label / rationale / offerCount` lands on `meta.salaryNegotiation.batnaStrength`. New flag `batna_weak_unsupported` fires when label = "weak". Anchoring cluster member.
- **2.3** ✅ Joining-bonus clawback detector. `joining_bonus_clawback_not_probed` fires when joining bonus appears in transcript and candidate never asks about clawback / pro-rate / repayment / hold period / tenure requirement. Paired coaching tip on Indian 1-yr / 2-yr cliff norms. Discovery cluster member.
- **2.4** ✅ Variable-pay realism. `variable_pay_face_value_accepted` fires when variable / performance pay mentioned and candidate never probed payout history (% of target paid out, last year's hit rate, achievement rate, OTE). Discovery cluster member.
- **Bonus (kernel-pair detectors)** ✅ Shipped 2 of 4: `closed_too_fast` (verbal acceptance after at most 1 AI number with no candidate pushback earlier in session — transcript-side proxy for `verbalAcceptanceTurn` arriving early relative to `highestOfferMade`) and `lost_track_of_offer` (user explicitly asks AI to recap the offer after a number was already on the table — proxy for `lastAnswerOfferRecapAtTurn`). Both join the close cluster.
- **Skipped (with rationale)**: `jargon_literacy_gap` (requires `lastAnswerClarificationAtTurn` count, not exposed on `SessionRowForAnalysis`; transcript-side proxy would need a clarification-utterance regex with high false-positive risk vs. genuine clarification asks) and `variable_not_owned` (requires `variableInferred` from the kernel breakdown; can't be reconstructed reliably from the transcript alone). Re-evaluate once kernel state is persisted onto the session row.
- **Version**: bumped `salary-negotiation-v5` → `salary-negotiation-v6` so `_llm-rescore.ts` re-evaluates cached sessions. New `meta.salaryNegotiation.equityLiteracy` + `batnaStrength` sub-fields added to `AnalyzerMeta`. Tests: 13 new fixtures in `src/__tests__/analyzers/salary-negotiation.test.ts` covering each Phase-2 detector (positive + negative case) + version bump. All 45 file-local cases green; full vitest suite green (5 unrelated wave-prompt timeouts, pre-existing parallel-load flakes — pass in isolation). `npx tsc --noEmit` clean; `npm run build` clean.

### Phase 3 — Persona variability (\~2d, +0.3) ✅ DONE (commit `c8032bd`)

Five Indian recruiter SECTOR archetypes selected per session from `tierBucket` + band shape, distinct from the existing tone-axis `RecruiterPersona` (hardline / consultative / founder / agency) which modulates band economics:

- **IT Services** — fixed bands, ~30% hike cap, services-track register. `pushbackStyle: rigid-band`, no ESOP preference.
- **GCC (Indian arm of MNC)** — anchored to the global comp band, structured RSU. `pushbackStyle: global-benchmark`.
- **Indian Unicorn** — ESOP-heavy, cash-light. `pushbackStyle: equity-pivot`.
- **Early Startup** — aggressive ESOP %, low base, cash-constrained framing. `pushbackStyle: cash-constrained`.
- **BFSI** — variable-heavy, regulatory bands on fixed. `pushbackStyle: variable-bump`.
- **default** — back-compat fallthrough for unknown / FMCG / PSU tiers. Renders byte-identical pre-Phase-3 prose.

New module `server-handlers/_indian-recruiter-personas.ts` exports `RecruiterSectorPersona` enum, `selectRecruiterSectorPersona({ tierBucket, band, company })`, and per-persona constants (`hikeCap`, `bandSpread`, `pushbackStyle`, `prefersEsop`, `idiomBias`). Selector keys off `tierBucket` first, falls through to band-shape heuristics (variableMax/initialOffer > 0.30 → BFSI; hasEquity + low baseFloor → startup; hasEquity → unicorn).

Wired into:
- `NegotiationState.recruiterSectorPersona` (optional for back-compat; `initState` sets it from caller-supplied persona or via the selector against the (band, tierBucketHint, company) tuple).
- `_canonical-prose.ts` — three persona-conditional switch arms: `band-disclosure-deflect`, `counter-offer`, `anchor-with-offer`. Each branch carries an `_exhaustive: never` fallback per the move-tag pattern. `default` branch renders byte-identical to pre-Phase-3 prose (PDF#34/35 contract).
- `negotiate-turn.ts` — computes the persona once at session start using the same tier-bucket mapping as the analyzer, passes via `initState`, and logs as `salneg_persona` on the `kernel_init` PostHog event.
- `meta.salaryNegotiation.{recruiterPersona, recruiterPersonaLabel}` — analyzer derives via the same selector and surfaces in the report.
- `NegotiationFullReport.tsx` — small persona chip next to the tier-band chip (suppressed when persona = `default`).

**Version**: bumped `salary-negotiation-v6` → `salary-negotiation-v7` so `_llm-rescore.ts` re-runs cached sessions against the persona-coloured scoring surface. `AnalyzerMeta.salaryNegotiation` gains `recruiterPersona` + `recruiterPersonaLabel` optional fields. Tests: unit suite for `selectRecruiterSectorPersona` (5 archetypes + 2 fallback cases) + 5 PDF-style integration tests in `_canonical-prose.test.ts` covering persona-conditional prose surfaces + analyzer-side meta fixture. PDF#34/35 default-path tests still pass. `npx tsc --noEmit` clean; `npm run build` clean.

### Phase 4 — Hygiene (\~1.5d, +0.3) ✅ DONE (commit `ef413d0`)

- **4.1** ✅ Expanded fixture suite for `salaryNegotiationAnalyzer` — 30 hand-crafted fixtures in `src/__tests__/fixtures/salaryNegotiationTranscripts.ts` driven by `src/__tests__/salaryNegotiationFixtures.test.ts`. Coverage: 15 ai_* self-consistency flags (one positive fixture each), 5 coaching-cluster exemplars (discovery / anchoring / counter / close / batna), 5 recruiter-sector-persona transcripts (it-services / gcc / indian-unicorn / early-startup / bfsi), 5 negative cases for high-FP detectors (bare "stocks", AI acknowledging confusion, revision-language regression, low-to-high range, non-grant stock mention). Aggregate per-flag precision/recall gated at >=0.85.
- **4.2** ✅ Kernel state-machine snapshot tests — `src/__tests__/negotiationKernelStateMachine.test.ts`. Five canonical paths (happy-close, candidate-counter-then-close, walk-away, deflect-loop-recovery via PDF#35 Move-1, clarification-loop-recovery via PDF#34 Fix-3) pinned via whitelisted projection (`phaseTrajectory` + `finalShape` — phase, leversUsed, verbalAcceptanceSet, acceptedAtTurnSet, walkAwayReturned, candidateTarget). Volatile fields (timestamps, ids, large nested objects) stripped.
- **4.3** ✅ Bumped `salary-negotiation-v7` → `salary-negotiation-v8` so `_llm-rescore.ts` re-evaluates cached sessions against the Phase-4 regression net.

### Phase 5 — Stretch (\~1.5d, +0.2)

- Multi-round negotiation simulation: 3 offers across HR Partner → Hiring Manager → Director.
- Real-time "ZOPA tracker" in UI — candidate sees current band overlap.

---

## 3. Behavioral (7.6 → **9.1** → 9.1) — ✅ Target reached

**File**: `server-handlers/analyzers/behavioral.ts` (**v4**, \~32 signals) **State**: Phases 1–5 shipped. Analyzer grades STAR per-answer, scores 10 competencies across 5 hiring tracks, detects AI probing depth + failure ownership, enforces Indian register via shared USISM scan, selects an interviewer persona by tier × experience, and has a 19-case ground-truth fixture suite.

**Top weaknesses** (all addressed):

1. ~~STAR detection is binary, not graded~~ — ✅ per-answer STAR matrix shipped (Phase 1)
2. ~~No competency taxonomy~~ — ✅ 10 competencies × 5 tracks shipped (Phase 2)
3. `unverifiable_companies` ~~false-fires on "At Last Year"~~ — ✅ suffix + stoplist gate shipped (Phase 1)
4. ~~No follow-up probing logic~~ — ✅ AI_PROBED_DEPTH / AI_ACCEPTED_VAGUE shipped (Phase 3)
5. ~~Indian-register rule prompt-only — no analyzer enforcement~~ — ✅ shared `_usism-patterns.ts` scan + `register_drift_to_us` flag shipped (Phase 4)

### ✅ Phase 1 — Quick wins (\~1d, +0.4) — **DONE** (commit `6008842`)

- **1.1** ✅ Per-answer STAR matrix in the report (✓S ✓T ✓A ✗R) so candidates know which answer was weak. — `meta.behavioral.starBreakdown[]`
- **1.2** ✅ Fix `unverifiable_companies` regex — require corporate suffix or known-company hint. — `CORPORATE_SUFFIX_RE` + `COMPANY_HINT_STOPLIST` + `KNOWN_COMPANY_HINT`
- **1.3** ✅ `IMPACT_QUANTIFIED` (paired) vs. `NUMERIC_INCIDENTAL` (incidental) split. — `hasImpactQuantified()` with ±48-char proximity window

### ✅ Phase 2 — Competency taxonomy (\~2d, +0.4) — **DONE** (commit `229f565`)

- **2.1** ✅ New `_behavioral-competencies.ts` — Amazon-track / Google-track / Indian product-co / Services lateral / Startup. — 10 competencies × 5 tracks
- **2.2** ⚠️ Tag `generate-questions` output with `competency` field; analyzer scores per competency. — analyzer-side scoring **done**; `generate-questions` tagging deferred (analyzer infers from answer text via `detectCompetencies()` — no question-side metadata needed yet)
- **2.3** ✅ Surface top demonstrated competencies in report as positive signal. — `meta.behavioral.topCompetencies` + "Strong signals on X, Y" coaching anchor

### ✅ Phase 3 — Follow-up depth + probing (\~2d, +0.3) — **DONE** (commit `ba5222f`)

- **3.1** ✅ AI probing-quality detector: `AI_PROBED_RESULT` / `AI_PROBED_DEPTH` / `AI_PROBED_OWNERSHIP` / `AI_ACCEPTED_VAGUE`. — `_behavioral-probing.ts` (`PROBE_FOR_RESULT` already in v1; v3 adds depth/ownership/vague)
- **3.2** ✅ `LEARNING_REFLECTION` detector — closure beats matter in Indian behavioral rounds. — `hasLearningReflection()` → `no_learning_reflection` flag
- **3.3** ✅ `OWNS_FAILURE` vs. `DEFLECTS_FAILURE` for failure-question handling. — `classifyFailureResponse()` → `owns_failure` / `deflects_failure` flags

### ✅ Phase 4 — Indian register + persona (\~1.5d, +0.2) — **DONE**

- **4.1** ✅ Mid-session register-drift detector reusing `USISM_PATTERNS`. — Patterns extracted to shared `server-handlers/analyzers/_usism-patterns.ts`; behavioral scans AI turns and fires `register_drift_to_us` flag (with up to 3 rubric gaps quoting the offending phrase) on ≥2 hits. Salary-negotiation now imports from the same source.
- **4.2** ✅ Three interviewer archetypes (HR Partner / Hiring Manager / Director). — New `src/_indian-behavioral-personas.ts`; selector keyed on company-tier × experience-level. Director for lead/executive (and senior at FAANG/big-tech/GCC); warm HR Partner for fresher/entry (and mid at IT-services/edtech/early-startup); depth-led Hiring Manager default. Wired into `generate-questions.ts`; persona id logged to PostHog as `behavioral_persona`.
- **4.3** ✅ Pedigree-aware opener for &lt;2-yr experience. — `pedigreeAwareOpenerFragment()` prepended to the behavioral persona block when `experienceLevel` ∈ {fresher, entry} OR numeric YOE &lt; 2. Pushes the LLM toward internship / college / open-source story shapes and weights Situation / Task framing higher than Result quantification.

### ✅ Phase 5 — Hygiene (\~1d, +0.2) — **DONE**

- **5.1** ✅ Fixture suite (15–20 transcripts). — New `src/__tests__/analyzers/behavioralFixtures.test.ts` with 19 end-to-end ground-truth transcripts (green / red pairs for STAR, quantification, company-verification, probing depth, register drift, competency taxonomy, duplicate-question, degenerate-input). All pass.
- **5.2** ✅ Prompt-cache reorder. — Audited `evaluate-session.ts` behavioral path: CRITICAL RULES + BEHAVIOURAL-PROBE-BANK + BEHAVIOURAL-COMPETENCY-COVERAGE blocks already precede the dynamic CONTEXT / TRANSCRIPT / RUBRIC tail, and the only interpolations into the prefix (`PROBE_TEXTS`, `BEHAVIORAL_COMPETENCIES`, `COMPETENCY_LABELS`) are static module imports. The ≥1024-token shared prefix is already cacheable per Groq's prefix-cache rules — no reorder needed. Documented for future maintainers.
- **5.3** ✅ Bump to v2. — **superseded**: shipped as **v3** for Phases 1–3, now **v4** for Phase 4.1 register-drift signal (so `_llm-rescore` recomputes behavioral sessions against the new flag set).

### Phase 6 — Adaptive senior layer (post-audit, May 2026)

Triggered by the **Senior Product Designer × Meesho** audit (`docs/Interview Focus/SCORE_IMPROVEMENT_PLAN.md` companion `HireStepX Behavioral Interview Audit Report.docx`). The audit caught three classes of issue that Phases 1–5 didn't address:

1. **Live coaching template hard-coded example tokens** that often didn't appear in the candidate's answer (chip said "'many', 'several', 'a lot' need numbers" while the answer used "some").
2. **STAR Situation false-positives** on artifact-for-context framing ("I built a reusable data table component for an admin dashboard because…" read as no-Situation).
3. **Senior interviews accept unsourced metrics** — "35-40% improvement" went un-probed for baseline / measurement method / sample size.

Score impact: +0.2 → 9.3. Target raised 9.1 → 9.5. Remaining items 6.1 / 6.2 / 6.5 / 6.6 / 6.7 carry the rest.

- **6.1** ⏳ Adaptive follow-up: pass prior answer's `starBreakdown` + lowest-scoring competency into `generate-questions` so the next prompt attacks the weakest dim. ~1.5d.
- **6.2** ⏳ Answer ↔ question topical-alignment detector (`answer_off_topic` flag). Keyword-overlap + intent-tag heuristic. ~1d.
- **6.3** ✅ **Evidence-quality validator.** New `server-handlers/_evidence-signals.ts` detects metric without baseline / method / sample within ±120 chars. Wired into live coach + post-session analyzer. New flags `metric_without_baseline` (candidate-side) and `ai_accepted_unevidenced_metric` (AI-side). Two new coaching notes. 18 unit tests + 2 analyzer fixtures.
- **6.4** ✅ **Quote-the-actual-phrase across coaching messages.** `vaguenessMatch()` returns the candidate's actual hedge ("some" / "few" / "many") so the live chip becomes `Vague on scale — "some" needs a number` instead of the static `'many', 'several', 'a lot'` list.
- **6.5** ⏳ Difficulty modes selector (Warm-up / Realistic / Senior / Bar-Raiser) in `generate-questions.ts`. Persona archetypes approximate this today but aren't user-toggleable. ~1d.
- **6.6** ⏳ Company-specific behavioural question seeds (Meesho-Bharat / Flipkart / PhonePe / etc.) keyed off `target_company`. ~1d.
- **6.7** ⏳ UX: progress chip ("Q 4 of 8"), expandable answer card, retry-this-answer + compare. ~1.5d.

Also under 6.3: broadened `SITUATION_RE` in `src/_star-detection.ts` and `STAR_CUES.S` in `behavioral.ts` to accept artifact-for-context framing ("for an admin dashboard" / "in one of my projects" / "in my current role") + causal-clause anchoring. Eliminates the audit's false-positive "Jumped straight to action" chip while keeping the bare-preposition discipline (test `does NOT over-fire on 'for it / for them'` pins the floor).

---

## 4. Campus Placement (7.4 → **8.6** ✅ target reached)

**File**: `server-handlers/analyzers/campus-placement.ts`**Target market**: TCS NQT, Infosys NQT, Wipro NLTH — 100k+ Indian hires/yr.

**Status**: ✅ Phases 1–5 shipped. Analyzer at `campus-placement-v6.4`. Target reached.

**Top weaknesses**:

1. Tech-stack detection inflates ("I know Python" == "I built production scraper in Python")
2. Passion-generic fires on keyword "passionate" anywhere
3. `classifyCollegeTier` + `cgpaCutoffAdjustment` computed but invisible in UI

### Phase 1 — Quick wins (\~1d, +0.4) ✅ DONE — commit `8273f98`

- **1.1** ✅ Surface tier-adjusted CGPA in the report. (`meta.campusPlacement` + `CampusCgpaCalibrationNote` in `SessionReportView.tsx`)
- **1.2** ✅ `PASSION_GENERIC` (penalty) vs. `PASSION_SUBSTANTIATED` (paired with project / hackathon / internship / MOOC / quantified outcome via `SUBSTANTIATION_TOKEN`).
- **1.3** ✅ Static fallback-question banner when `_fallback: "static"` fires. (`questionFallbackSource` in `useInterviewEngine.ts`, "Practice mode" pill in `Interview.tsx`)
- **Tests**: `src/__tests__/campusPlacementPhase1.test.ts` (10 tests).

### Phase 2 — Depth validators (\~2d, +0.3) ✅ DONE — commit `795b91c`

- **2.1** ✅ Tech-stack depth: `TECH_APPLIED` regex pairs tech names with applied artifacts (endpoint count, deployed URL, line count, schema shape). New flag `tech_named_but_not_applied`.
- **2.2** ✅ GitHub / portfolio link presence detector — positive signal `portfolio_link_present` fires when `PORTFOLIO_LINK` accompanies project narration.
- **2.3** ✅ Recency multiplier proxy. `PROJECT_RECENT_MARKER` / `PROJECT_DISTANT_MARKER` → new flag `projects_dated_not_recent`.
- **Tests**: `src/__tests__/campusPlacementPhase2.test.ts` (9 tests).

### Phase 3 — Persona variability (\~2d, +0.2) ✅ DONE — commit `8053ec2`

Four archetypes resolved in new helper `server-handlers/_campus-archetype.ts`. Archetype overrides the coarse `companyTier` CGPA cutoff; surfaced on `meta.campusPlacement.archetype` + `archetypeLabel` and as `campus_archetype_*` flag. UI renders archetype pill chip inside the CGPA calibration card.

- **TCS NQT (Ninja)** ✅ — academic walkthrough opener, 6.0 CGPA bar
- **TCS Digital / Infosys Power Programmer** ✅ — DSA depth, 7.5 CGPA
- **Wipro NLTH** ✅ — bond awareness, location flexibility, 6.5 CGPA
- **Top-tier campus (product-co)** ✅ — project depth, system-design lite, 7.5 CGPA
- **Tests**: `src/__tests__/campusPlacementPhase3.test.ts` (7 tests).

### Phase 4 — Hygiene (\~1d, +0.1) ✅ DONE — commit `d305f61`

- **4.1** ✅ Fixture suite. 5 hand-crafted transcripts (one per archetype + unknown-fallback) in `src/__tests__/fixtures/campusPlacementTranscripts.ts`, driven by `src/__tests__/campusPlacementFixtures.test.ts`.
- **4.2** ✅ Inherit `BEHAVIOURAL_INDIAN_REGISTER_RULE` for archetypes 1–3 — appended to `TYPE_GUIDANCE` for `interviewType="campus-placement"` in `generate-questions.ts`. STAR-shape mandates NOT inherited (would conflict with TCS NQT openers).
- **4.3** ✅ Prompt-cache reorder — verified already-correct (static rules precede dynamic `Context:` block per CLAUDE.md guidance).

### Phase 5 — Stretch (\~1.5d, +0.2) ✅ DONE

- ✅ Bond / service-agreement awareness probe — already covered by Wave-3 `BOND_PROBE` / `BOND_REFUSAL` / `BOND_IGNORANCE` / `BOND_HEALTHY_RESPONSE` patterns.
- ✅ "Any backlogs?" honest-handling detector — new positive flag `backlog_honest_disclosure` (paired with existing `active_backlog_evasion`); fires when AI probes backlogs and candidate gives a clean, unhedged disclosure ("zero backlogs", "cleared first attempt").
- ✅ Aptitude-to-project consistency — new flag `aptitude_project_inconsistency` fires when candidate refuses an aptitude / puzzle probe AND elsewhere claimed applied-tech depth (`TECH_APPLIED`) or a portfolio link (`PORTFOLIO_LINK`).
- **Tests**: `src/__tests__/campusPlacementPhase5.test.ts` (5 tests). Analyzer bumped to `campus-placement-v6.4`.

---

## 5. Technical Leadership (7.8 → **7.9** → 9.0)

> Note: `technical.ts` shipped a v1 → v2 bump (+0.1 inferred). `system-design.ts` still at v1. Phases 1–5 still substantively pending end-to-end.

Combines `technical.ts` (320 LOC, deepest analyzer outside HR/Sal-Neg) + `system-design.ts` (121 LOC).

**Top weaknesses**:

1. `technical.ts` has language-mention detection but no complexity-claim verification (candidate says "O(log n)" — never checked against actual approach)
2. `system-design.ts` doesn't score the 4 standard pillars (capacity estimation, API design, data model, scale bottleneck) explicitly
3. No Indian-context tech ecosystem awareness (UPI, Aadhaar scale, DPI patterns) — high-leverage moat
4. Whiteboard / diagram references in system-design transcripts not detected (candidate says "as I drew here" — analyzer is blind)

### Phase 1 — Quick wins (\~1d, +0.3)

- **1.1** `SYSDESIGN_PILLAR_*` block for each of: capacity, API, data model, scale. Surface "you covered 3/4" in report.
- **1.2** Complexity-claim cross-check: `O(...)` mention + nested-loop description mismatch → `complexity_claim_inconsistent`.
- **1.3** Recognize "I'd diagram this as" / "let me sketch" — flag the absence of artifact upload (future: prompt to upload).

### Phase 2 — Depth validators (\~2.5d, +0.4)

- **2.1** Database-choice rationale: detect "I'd use Postgres because" vs. "I'd use Postgres".
- **2.2** Trade-off articulation detector: `CAP_REASONED` / `CONSISTENCY_VS_AVAILABILITY_CHOSEN`.
- **2.3** Indian DPI awareness: UPI rails, Aadhaar-scale (1.4B records), DigiLocker, ONDC — `INDIAN_SCALE_AWARE` positive signal.
- **2.4** Failure-mode reasoning: "what happens when X dies" probe-and-response detector.

### Phase 3 — Persona variability (\~2d, +0.2)

Three interviewer tracks:

- **Big-tech bar-raiser** — depth-over-breadth, single deep dive
- **Indian product-co staff eng** — pragma-first, breadth + one deep system
- **Services-track tech lead** — process-first, SDLC literacy

### Phase 4 — Hygiene (\~1.5d, +0.2)

- **4.1** Fixture suite for both analyzers (split: `technicalAnalyzer.test.ts` + `systemDesignAnalyzer.test.ts`).
- **4.2** Prompt-cache reorder.
- **4.3** Bump versions.

### Phase 5 — Stretch (\~1d, +0.1)

- Code-snippet pseudocode quality scoring (when candidate dictates code).
- Live diagram capture (canvas integration).

---

## 6. Panel Interview (7.5 → 8.8)

**File**: `server-handlers/analyzers/panel.ts` (127 LOC) **Already has**: `_indian-panel-personas.ts` (HR Partner / Hiring Manager / Tech Lead).

**Top weaknesses**:

1. Persona rotation feels random — no "panel dynamics" (one persona dominates, another quiet, one challenger)
2. No detection of candidate's panel-management skill (addressing whom, eye-contact equivalent in voice = naming the persona)
3. Cross-persona consistency check missing (candidate gives different numbers to HR vs. HM)

### Phase 1 — Quick wins (\~1d, +0.3)

- **1.1** `ADDRESSED_BY_NAME` positive signal — candidate names the persona when answering ("To your point, Priya…").
- **1.2** Panel-coverage report: did the candidate get airtime with all 3 personas, or did one dominate.
- **1.3** Cross-persona answer-consistency check (current TC, notice period, motivation must match across personas).

### Phase 2 — Depth (\~2d, +0.4)

- **2.1** Persona dynamics: assign "dominant / supportive / challenger" roles per session, drive question pacing accordingly.
- **2.2** Interruption-handling detector — challenger persona cuts in mid-answer; did candidate hold the floor or yield gracefully?
- **2.3** Tag-team probing: HM and Tech Lead alternate on the same topic to test consistency.

### Phase 3 — Persona variability (\~1.5d, +0.3)

Two panel archetypes:

- **Indian product-co panel** (3-on-1: HR + HM + Tech Lead) — current default
- **Indian services panel** (HR + Delivery Manager + Architect) — process-heavy, escalation-scenario probing

### Phase 4 — Hygiene (\~1d, +0.2)

- Fixture suite, prompt-cache reorder, version bump.

### Phase 5 — Stretch (\~0.5d, +0.1)

- Skip-level surprise — director joins mid-session.

---

## 7. Case Study (7.2 → 8.7)

**File**: `server-handlers/analyzers/case-study.ts` (90 LOC — thin) **Use case**: Consulting interviews (McKinsey/BCG/Bain India), PM case rounds (Flipkart/Razorpay).

**Top weaknesses**:

1. No framework-quality scoring (issue-tree depth, MECE adherence)
2. No quantification-discipline detector (back-of-envelope math correctness)
3. Doesn't differentiate consulting case (profitability/market-entry) from PM case (feature trade-off)

### Phase 1 — Quick wins (\~1d, +0.4)

- **1.1** `STRUCTURED_OPENER` detector — "Let me break this into 3 parts" type framing.
- **1.2** `HYPOTHESIS_FIRST` — candidate states hypothesis before drilling vs. exploratory rambling.
- **1.3** Numeric-sanity check: detect back-of-envelope claims and at least flag ones that look implausible (population × adoption × price within order of magnitude).

### Phase 2 — Depth (\~2d, +0.5)

- **2.1** MECE detector: top-level branches mutually exclusive? Detect overlap keywords.
- **2.2** Issue-tree depth: does candidate descend ≥2 levels, or stay at L1?
- **2.3** Synthesis quality: closing recommendation — pyramid principle ("So-What" first) detector.
- **2.4** Indian-context flavoring: tier-2/3 city, UPI / Jio scale, monsoon seasonality — case-relevant moats.

### Phase 3 — Persona variability (\~1.5d, +0.3)

Two case archetypes:

- **Consulting case** — profit/market/M&A, MECE-heavy
- **PM case** — feature trade-off, user journey, metrics-driven

### Phase 4 — Hygiene (\~1.5d, +0.2)

- Fixture suite, prompt-cache reorder, version bump.

### Phase 5 — Stretch (\~0.5d, +0.1)

- Math-error severity grading (off by 10× vs. 2× tolerance).

---

## 8. Strategic (7.3 → 8.7)

**File**: `server-handlers/analyzers/strategic.ts` (130 LOC) **Use case**: VP/Director-level "strategy" rounds — Porter's 5 forces, OKR design, market entry.

**Top weaknesses**:

1. Frameworks recognized by keyword only ("SWOT", "5 forces") — application quality unverified
2. No "first-principles vs. analogy" reasoning detector
3. Long-horizon thinking (3–5 yr) vs. short-term execution not separated
4. Indian context (Tier-2/3 expansion, regulatory) shallow

### Phase 1 — Quick wins (\~1d, +0.3)

- **1.1** Framework-application scorer: SWOT mentioned + actual quadrants populated, not just name-dropped.
- **1.2** Time-horizon detector: 1-yr / 3-yr / 5-yr framing.
- **1.3** `OKR_KR_MEASURABLE` — KR has number + date, vs. aspirational.

### Phase 2 — Depth (\~2d, +0.4)

- **2.1** First-principles vs. analogy decomposition.
- **2.2** Trade-off articulation: "doing X means not doing Y" framing.
- **2.3** Stakeholder-mapping detector: detects identification of internal + external + customer + regulator.

### Phase 3 — Persona variability (\~1.5d, +0.3)

- **Founder strategy** — fast, hypothesis-heavy, "what would you ship Monday"
- **VP/Director strategy** — structured, OKR-led, quarterly cadence
- **MBB consulting strategy** — McKinsey-style 7-S / 5-forces formality

### Phase 4 — Hygiene (\~1.5d, +0.2)

- Fixture suite, prompt-cache reorder, version bump.

### Phase 5 — Stretch (\~0.5d, +0.1)

- "Pre-mortem" / red-team thinking detector.

---

## 9. Management (7.4 → 8.7)

**File**: `server-handlers/analyzers/management.ts` (88 LOC — thin) **Use case**: EM / Director / SDM rounds.

**Top weaknesses**:

1. People-management specifics (1:1 cadence, perf review process, PIP literacy) not detected
2. No detection of hiring-bar literacy (Indian-context: how to spot inflated CVs)
3. Conflict-resolution scenarios scored generically
4. Skip-level vs. direct-report distinction missing

### Phase 1 — Quick wins (\~1d, +0.4)

- **1.1** `ONE_ON_ONE_CADENCE` detector — candidate mentions weekly/bi-weekly 1:1s.
- **1.2** `PIP_HANDLED` vs. `PIP_AVOIDED` — direct experience with performance improvement plans.
- **1.3** `HIRING_BAR_ARTICULATED` — Indian-market specifics (TCS inflated TLs, services-to-product transitions).

### Phase 2 — Depth (\~2d, +0.4)

- **2.1** Span-of-control reasoning: detects N direct + M skip = appropriate / inflated.
- **2.2** Org-design awareness: detects pod / squad / chapter / guild structure literacy.
- **2.3** Attrition-handling: detect retention play vs. counter-offer vs. "let them go" maturity.
- **2.4** Indian-context: bench management, services-arm transitions, GCC hiring quotas.

### Phase 3 — Persona variability (\~1.5d, +0.2)

- **Engineering Manager** (5–10 reports) — IC-adjacent
- **Senior EM / Director** (3 EMs + extended team) — pure people
- **Group EM at GCC** — global stakeholder management

### Phase 4 — Hygiene (\~1d, +0.2)

- Fixture suite, prompt-cache reorder, version bump.

### Phase 5 — Stretch (\~0.5d, +0.1)

- Layoff / RIF handling probe (sensitive, market-relevant in 2025–26).

---

## 10. Government / PSU (7.0 → 8.5)

**File**: `server-handlers/analyzers/government-psu.ts` (89 LOC) **Use case**: SSC, UPSC interview round, PSU technical (ONGC, BHEL, NTPC), bank PO, RBI Grade B. **Strategic note**: Smallest paying segment today but largest competitive moat — nobody else builds for this market. High retention via referrals.

**Top weaknesses**:

1. PSU register is formal-Hindi-English mix — current rule set is generic Indian English
2. Current-affairs / GK question handling shallow
3. Service-motivation ("why public service") detection generic
4. No PSU-specific compensation literacy (pay matrix, DA/HRA structure)
5. UPSC personality-test patterns very different from corporate — register mismatch

### Phase 1 — Quick wins (\~1d, +0.4)

- **1.1** Formal-Hindi-English register rule (`namaskar`, `aap`, `dhanyavaad` accepted; not penalized).
- **1.2** Service-motivation depth detector — `SERVICE_GENERIC` ("I want to serve the nation") vs. `SERVICE_SPECIFIC` (named sector + reform).
- **1.3** Pay-matrix literacy: detect knowledge of Level 7 / Level 10 / DA % / 7th CPC.

### Phase 2 — Depth (\~2d, +0.4)

- **2.1** Current-affairs grounding: detect anchoring to last-6-month news vs. evergreen platitudes.
- **2.2** Constitutional / governance reasoning for UPSC: Article reference accuracy, federal-vs-state competence.
- **2.3** Ethics case-study handling (UPSC GS-4 style): stakeholder identification + value-conflict articulation.
- **2.4** PSU technical: domain depth + safety-culture literacy.

### Phase 3 — Persona variability (\~1.5d, +0.3)

Four archetypes:

- **UPSC board** (Chairman + 4 members) — personality test, holistic
- **PSU technical panel** — domain + safety + service motivation
- **SSC / bank PO** — quick screen, document-verification heavy
- **RBI Grade B** — policy literacy + economy fundamentals

### Phase 4 — Hygiene (\~1d, +0.2)

- Fixture suite, prompt-cache reorder, version bump.

### Phase 5 — Stretch (\~0.5d, +0.2)

- Mock DAF (Detailed Application Form) cross-check for UPSC — candidate's hobbies / optional subject probed deeply.

---

## Cross-focus systemic upgrades (apply once, benefit everywhere)

These are not phase items per focus — they're foundational changes that lift every analyzer by \~0.2.

### A. Shared US-ism drift detector

Extract `USISM_PATTERNS` from `salary-negotiation.ts` into `server-handlers/analyzers/_register-rules.ts`. Every Indian-register focus (HR Round, Behavioral, Campus, Panel, Government, Salary Neg) imports and runs it against AI turns. Cuts a recurring "the AI started saying 'circle back' mid-session" failure mode.

### B. Indian register rule auto-inheritance

`BEHAVIOURAL_INDIAN_REGISTER_RULE` currently sits in the Behavioral prompt. Promote to a shared prompt fragment in `server-handlers/_llm.ts` and include via opt-out (not opt-in) for every focus except Technical Leadership product-co paths.

### C. Static fallback visibility

PostHog already tracks `gq_static_fallback`. Surface a subtle UI badge ("Practice bank") when the static fallback fires, across every focus. Currently silent — candidates can't tell when they're hitting cached questions vs. fresh LLM gen.

### D. Per-question competency tagging in `generate-questions`

Extend the response schema with `competency: string` per question. Every analyzer can then score per-question competency adherence instead of relying on transcript-level pattern matching. Pairs especially well with Behavioral Phase 2 and Strategic Phase 2.

### E. Fixture suite template

One canonical structure in `src/__tests__/analyzers/fixtures/<focus>/` per `_dispatch.ts` requirement note. Currently inconsistent. Lock it once; all 10 focuses follow.

### F. Analyzer version bump = LLM rescore re-run

Verify `_llm-rescore.ts` reads analyzer `version` and invalidates cached scores on bump. If not, sessions stay scored against stale logic forever after deploys. (Single-day audit + fix.)

### G. Orphan helper audit + wire-in

Three production-ready helpers shipped but unused:

- `_ctc-breakdown.ts` → Salary Negotiation Phase 1.1
- `_equity-literacy.ts` → Salary Negotiation Phase 2.1
- `_negotiation-math.ts:batnaStrength` → Salary Negotiation Phase 2.2

Done as part of Salary Neg work but worth flagging — wasted engineering otherwise.

---

## Recommended quarter plan

**Sprint 1 (week 1–2)**: Cross-focus systemic upgrades A–G + Behavioral Phase 1+2 + Campus Phase 1. Highest leverage per day.

**Sprint 2 (week 3–4)**: Technical Leadership (combined). Largest TAM segment.

**Sprint 3 (week 5–6)**: Salary Negotiation phases 1–3. Highest-revenue feature; orphan helpers light up.

**Sprint 4 (week 7–8)**: HR Round + Panel. Already mature; polish.

**Sprint 5 (week 9–10)**: Case Study + Strategic + Management. Mid-tier business segment.

**Sprint 6 (week 11–12)**: Government / PSU. Competitive moat play.

**Ship gate per focus**: fixture suite green, prompt-cache audit passed, version bumped, PostHog dashboard for new flags.

---

*Last updated 2026-05-18 — owner: analyzer team. Update score columns after each phase ships. Last reconciliation against on-disk analyzer* `version:` *fields: 2026-05-18.*