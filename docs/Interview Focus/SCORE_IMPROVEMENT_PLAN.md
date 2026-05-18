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

| \# | Focus | Baseline | Target | Effort | Status |
| --- | --- | --- | --- | --- | --- |
| 1 | HR Round | 8.1 | 9.2 | \~7 days | — |
| 2 | Salary Negotiation | 8.4 | 9.5 | \~8 days | — |
| 3 | Behavioral | 7.6 | 9.1 | \~7.5 days | ✅ Phases 1–3 shipped (+1.1 of +1.5) — analyzer at v3 |
| 4 | Campus Placement | 7.4 | 8.6 | \~6 days | — |
| 5 | Technical Leadership (Technical + System Design) | 7.8 | 9.0 | \~8 days | — |
| 6 | Panel Interview | 7.5 | 8.8 | \~6 days | — |
| 7 | Case Study | 7.2 | 8.7 | \~6.5 days | — |
| 8 | Strategic | 7.3 | 8.7 | \~6.5 days | — |
| 9 | Management | 7.4 | 8.7 | \~6 days | — |
| 10 | Government / PSU | 7.0 | 8.5 | \~6 days | — |

**Recommended sequencing**: HR Round → Salary Negotiation are already deepest; ship Behavioral + Campus Placement first (biggest delta-per-day). Then Technical Leadership (largest TAM). Government/PSU last (smallest paying segment but highest competitive moat — nobody else builds for SSC/UPSC/PSU candidates).

---

## 1. HR Round (8.1 → 9.2)

**File**: `server-handlers/analyzers/hr-round.ts` (v4.3.2, \~30 detection blocks) **State**: Most mature analyzer alongside Salary Neg. Strong signal coverage; gaps are at the edges.

**Top weaknesses**:

1. Counter-offer dodge detection is binary — doesn't distinguish "graceful deflection" from "evasive lie"
2. Resume cross-checks fire but feedback is generic ("inflated_seniority_claim" → no story for the candidate)
3. Coaching tips are 1-liner per flag; \~30 flags share \~10 coaching templates → repetition feels rote

### Phase 1 — Quick wins (\~1d, +0.3)

- **1.1** Group similar flags into coaching clusters with templated narrative ("3 evasive signals across compliance — pattern, not isolated"). Edit: `hr-round.ts` coaching-bits builder.
- **1.2** Surface resume-vs-transcript mismatch with the specific delta ("Resume: TL at Flipkart 2021-23; you said 'I led the team since 2020'"). Pull from `session.jd_analysis` already loaded.
- **1.3** Add `OFFER_ACCEPTED_GRACEFUL` positive counterpart to `COUNTER_OFFER_DODGE` — candidate gets credit for handling cleanly.

### Phase 2 — Depth validators (\~2d, +0.3)

- **2.1** Notice-period negotiation depth: detect buyout discussion / handover plan vs. pure "I can join in X days".
- **2.2** BGV / employment verification literacy: detect knowledge of `Form 16`, `UAN`, `relieving letter`, `payslip` requirements.
- **2.3** Compensation breakup probing: detect when candidate asks ESOP vesting cliff, variable %, joining bonus clawback terms.

### Phase 3 — Persona variability (\~2d, +0.2)

Three HR archetypes (already partially modelled in `_indian-panel-personas.ts`):

- **HR Partner (warm)** — default; rapport-led
- **HR Business Partner (firm)** — process-led, asks for proof points
- **Talent Acquisition (transactional)** — quick screen; speed-of-decision dominates Selected from company-size + role-seniority signals.

### Phase 4 — Hygiene (\~1d, +0.2)

- **4.1** Expand `hrRoundAnalyzer.test.ts` fixture suite to cover each of the 30+ detection blocks.
- **4.2** Reorder `evaluate-session` HR path: static rules before transcript (current path interleaves company context).
- **4.3** Bump version to v5.

### Phase 5 — Stretch (\~1d, +0.2)

- Counter-offer simulation: when user mentions current employer counter-offering, AI should escalate with realistic India-market response patterns.
- Probationary-period awareness probe (services-track specific).

---

## 2. Salary Negotiation (8.4 → 9.5)

**File**: `server-handlers/analyzers/salary-negotiation.ts` (v4, \~30 detection blocks) **Orphaned helpers ship-ready**: `_ctc-breakdown.ts`, `_equity-literacy.ts`, `_negotiation-math.ts:batnaStrength`

**Top weaknesses**:

1. 30+ flags, only 5 coaching tips
2. CTC breakdown helper exists but never surfaces in report
3. Equity-literacy helper exists but unused — startup/unicorn candidates fly blind on ESOP terms

### Phase 1 — Quick wins (\~1d, +0.3)

- **1.1** Wire `computeOldRegimeTaxLpa` + `computeNewRegimeTaxLpa` from `_ctc-breakdown.ts` into the report — show in-hand monthly under both regimes for the negotiated offer.
- **1.2** Expand coaching catalog from 5 to \~20 tips, one per top-frequency flag cluster.
- **1.3** Surface `tierBucket` (FAANG/GCC/Unicorn/Startup/Services/BFSI) in the report header so candidate sees which band they were scored against.

### Phase 2 — Depth validators (\~2d, +0.4)

- **2.1** Wire `computeEquityGrant` from `_equity-literacy.ts`: when ESOP mentioned, surface vesting cliff, current FMV vs. strike, expected dilution.
- **2.2** Wire `batnaStrength` scoring — currently only presence detected. Strength function quantifies "weak BATNA" (vague hint) vs. "strong BATNA" (named competing offer + LPA).
- **2.3** Joining-bonus clawback detector — candidates routinely miss the 1-yr / 2-yr clawback terms.
- **2.4** Variable-pay realism: detect when candidate accepts at face value vs. probes payout history.

### Phase 3 — Persona variability (\~2d, +0.3)

Five recruiter archetypes by sector — already mapped in `tierBucket()`:

- **IT Services** — fixed bands, 30% hike cap, services-track register
- **GCC (Indian arm of MNC)** — global pay benchmark, structured RSU
- **Indian Unicorn** — ESOP-heavy, cash-light
- **Early Startup** — aggressive ESOP %, low base, high risk
- **BFSI** — variable-heavy, regulatory comp constraints

Each gets distinct counter-offer logic and pushback patterns.

### Phase 4 — Hygiene (\~1.5d, +0.3)

- **4.1** Expand fixture suite to cover all `ai_*` self-consistency flags.
- **4.2** Negotiation-kernel state-machine snapshot tests — `_negotiation-state.ts` paths.
- **4.3** Bump to v5.

### Phase 5 — Stretch (\~1.5d, +0.2)

- Multi-round negotiation simulation: 3 offers across HR Partner → Hiring Manager → Director.
- Real-time "ZOPA tracker" in UI — candidate sees current band overlap.

---

## 3. Behavioral (7.6 → 9.1)

**File**: `server-handlers/analyzers/behavioral.ts` (**v3**, \~30 signals) **State**: Phases 1–3 shipped; analyzer now grades STAR per-answer, scores 10 competencies across 5 hiring tracks, and detects AI probing depth + failure ownership.

**Top weaknesses**:

1. ~~STAR detection is binary, not graded~~ — ✅ per-answer STAR matrix shipped (Phase 1)
2. ~~No competency taxonomy~~ — ✅ 10 competencies × 5 tracks shipped (Phase 2)
3. ~~`unverifiable_companies` false-fires on "At Last Year"~~ — ✅ suffix + stoplist gate shipped (Phase 1)
4. ~~No follow-up probing logic~~ — ✅ AI_PROBED_DEPTH / AI_ACCEPTED_VAGUE shipped (Phase 3)
5. Indian-register rule prompt-only — no analyzer enforcement (Phase 4)

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

### Phase 4 — Indian register + persona (\~1.5d, +0.2)

- **4.1** Mid-session register-drift detector reusing `USISM_PATTERNS`.
- **4.2** Three interviewer archetypes (HR Partner / Hiring Manager / Director).
- **4.3** Pedigree-aware opener for &lt;2-yr experience.

### Phase 5 — Hygiene (\~1d, +0.2)

- **5.1** Fixture suite (15–20 transcripts).
- **5.2** Prompt-cache reorder.
- **5.3** ✅ Bump to v2. — **superseded**: shipped as **v3** in commit `ba5222f` (covers Phases 1–3 in one bump so `_llm-rescore` recomputes all behavioral sessions).

### Phase 6 — Stretch

- STAR-graded scoring (0–3 per part).
- Story-recycling detector.
- Cross-story consistency check.

---

## 4. Campus Placement (7.4 → 8.6)

**File**: `server-handlers/analyzers/campus-placement.ts`**Target market**: TCS NQT, Infosys NQT, Wipro NLTH — 100k+ Indian hires/yr.

**Top weaknesses**:

1. Tech-stack detection inflates ("I know Python" == "I built production scraper in Python")
2. Passion-generic fires on keyword "passionate" anywhere
3. `classifyCollegeTier` + `cgpaCutoffAdjustment` computed but invisible in UI

### Phase 1 — Quick wins (\~1d, +0.4)

- **1.1** Surface tier-adjusted CGPA in the report.
- **1.2** `PASSION_GENERIC` (penalty) vs. `PASSION_SUBSTANTIATED` (paired with project / hackathon / internship).
- **1.3** Static fallback-question banner when `_fallback: "static"` fires.

### Phase 2 — Depth validators (\~2d, +0.3)

- **2.1** Tech-stack depth: `TECH_MENTIONED` vs. `TECH_APPLIED` (paired with project / line-count / deployment URL).
- **2.2** GitHub / portfolio link presence detector.
- **2.3** Recency multiplier (final-year &gt; 2nd-sem).

### Phase 3 — Persona variability (\~2d, +0.2)

Four archetypes:

- **TCS NQT (Ninja)** — academic walkthrough opener, 6.0 CGPA bar
- **TCS Digital / Infosys Power Programmer** — DSA depth, 7.5+ CGPA
- **Wipro NLTH** — bond awareness, location flexibility
- **Top-tier campus (product-co)** — project depth, system-design lite

### Phase 4 — Hygiene (\~1d, +0.1)

- **4.1** Fixture suite.
- **4.2** Inherit `BEHAVIOURAL_INDIAN_REGISTER_RULE` for archetypes 1–3.
- **4.3** Prompt-cache reorder.

### Phase 5 — Stretch (\~1.5d, +0.2)

- Bond / service-agreement awareness probe.
- "Any backlogs?" honest-handling detector.
- Aptitude-to-project consistency.

---

## 5. Technical Leadership (7.8 → 9.0)

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

*Last updated 2026-05-18 — owner: analyzer team. Update score columns after each phase ships.*