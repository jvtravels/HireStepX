# Salary Data Coverage Plan

**Author:** drafted 2026-05-09 by Jay + Claude **Status:** proposed — pending scope approval **Owner:** Jay (data acquisition + validation), Claude (schema + tooling + first-pass writes)

## Problem statement

Today's coverage is uneven and the failure modes are user-visible:

1. **Companies are partially curated.** \~135 in `COMPANY_SALARY_OVERRIDES`, 100 in CSV, \~70 overlap. Many candidates target companies we have nothing on.
2. **Roles per company are sparse.** TCS shipped with `software-engineer + ux-designer + qa-engineer + business-analyst + project-manager` — but real TCS hires across \~25 distinct roles (SAP consultant, mainframe dev, cloud engineer, salesforce dev, ServiceNow dev, security engineer, network engineer, data engineer, ML engineer, scrum master, technical writer, etc.). When a candidate picks "SAP Consultant at TCS," they fall through to a generic `software-engineer` band that doesn't match SAP comp at all.
3. **Multi-track compression.** TCS, Infosys, Wipro, Cognizant, Accenture, HCL — all have 3+ fresher tracks (Ninja/Digital/Prime, DSE/Power/Specialist, Elite/Turbo/Velocity, GenC/GenC Next/GenC Pro). One band per level mis-quotes 60% of candidates. Fixed for TCS in `424a2b7`; structurally unfixed everywhere else.
4. **No multi-source provenance.** A single `source` string can be "AmbitionBox" or "Levels.fyi" — but no field captures whether two independent sources agree. The internal calibration audit found 48% agreement between CSV and curator; we need to flag low-confidence cells, not just stamp them all "verified."
5. **No freshness gate.** Stamps say `lastVerified: 2026-05-07` but nothing breaks CI when a stamp ages past 180 days. Comp moves quarterly in India tech.
6. **No user-feedback loop.** When a real candidate flags wrong numbers (like the TCS interview that triggered this plan), the fix is manual archaeology — no UI flag, no admin queue, no telemetry.

## Goals (in priority order)

1. **Don't quote a wrong number to a real candidate.** Failure mode: hedge or refuse &gt; quote a confident wrong number.
2. **Cover the top 50 highest-traffic Indian companies × top 15 roles each, deeply.** That's 750 cells × 5 levels = \~3,750 cells with curator-grade data and multi-track encoding where applicable.
3. **Tail coverage for the rest of the \~1000 companies in the autocomplete** — research-aggregated bands with explicit confidence labels and the calibration hedge that shipped today.
4. **Maintainable** — quarterly refresh achievable in &lt;1 day. CI breaks when stamps go stale.

## Non-goals (explicit)

- 100% coverage of every (company, role, level) cell. The long tail isn't worth the marginal effort vs. just hedging.
- Real-time scraping pipelines (Levels.fyi/AmbitionBox change-detection). Defer to post-revenue.
- Global market coverage (US, Europe). India-only for now.
- Granular bands in `salaries.ts` (separate file, separate audit, separate scope).

---

## Phase 0 — Foundation (must precede any data work)

**Purpose:** stop walking into the same data-quality trap twice. Build the scaffolding that makes the data work measurable, reviewable, and reversible.

**Estimated effort:** 1 day eng. **Cost:** \~$0 LLM. **Blocker:** none.

### 0.1 — Schema upgrade: structured `tracks` field

Add to `CompanyBandOverride`:

```ts
tracks?: Array<{
  trackName: string;        // "Ninja", "Digital", "Prime", "Specialist L3", "GenC Next"
  totalMin: number;
  totalMax: number;
  baseMin?: number; baseMax?: number;
  equityMin?: number; equityMax?: number;
  joiningBonusOverride?: [number, number];
  bondPenaltyLpa?: number;
  resumeSignals: string[];  // ["NQT top decile", "coding test invitee", "hackathon win"]
  notes?: string;
}>;
```

Replaces the freeform `notes` blob currently encoding tracks for TCS. Lets the LLM probe specifically: "Looking at your resume, I see you mentioned a hackathon win — that's a Digital-track signal. Anchoring at ₹7-9L."

When `tracks` is present, the top-level `totalMin/Max` becomes the union envelope; `tracks[].totalMin/Max` are the per-track sub-bands.

### 0.2 — Multi-source provenance field

Replace the single `source: string` with:

```ts
source: string;                     // primary citation
sourceVerifiedAt?: {                // already exists; promote to required for new entries
  glassdoor?: string;               // dated URL
  ambitionbox?: string;
  levelsFyi?: string;
  drhp?: string;                    // for IPO-stage cos
  operatorNetwork?: string;         // founder/recruiter network
};
agreementCount: 1 | 2 | 3 | 4 | 5;  // how many independent sources confirm
```

CI gate: `agreementCount >= 2` for any cell on a Tier-1 company.

### 0.3 — Freshness CI gate

```ts
// scripts/check-data-freshness.mts
// Fails CI if any Tier-1 company has lastVerified > 180 days old.
// Tier-2 (CSV-only) gets 365 days.
```

Add to `npm run test:coverage` so it gates every PR.

### 0.4 — User-feedback loop

UI: in the negotiation report, surface a "Was this number accurate?" prompt with thumbs up/down + optional offer-letter paste. Writes to `salary_feedback` Supabase table:

```sql
create table salary_feedback (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles,
  company text not null,
  role text not null,
  experience_level text not null,
  ai_quoted_band jsonb not null,    -- what we said
  user_actual jsonb,                -- what they say it should be
  feedback_kind text not null,      -- "accurate" | "too_low" | "too_high" | "way_off"
  notes text,
  created_at timestamptz default now()
);
```

Admin-dashboard surface lists open feedback for triage. Each piece of feedback is worth more than 50 LLM-arbitrated cells.

### 0.5 — Coverage-gap audit script

```ts
// scripts/audit-coverage-gaps.mts
// For each curated company, list:
//   - roles present vs. expected role-set for that company-type
//   - levels present vs. complete (entry|mid|senior|lead|executive)
//   - cells with agreementCount < 2
//   - cells with stamps > 180 days
//   - cells where curator disagrees with CSV by >50% (worst-drift watchlist)
// Output: docs/coverage-gaps.md (regenerated each run).
```

### 0.6 — Role taxonomy expansion

Today's `matchRoleKey` collapses to \~15 canonical roles. The IT-services reality needs \~30:

- `sap-consultant`, `mainframe-developer`, `cloud-engineer`, `devops-engineer`, `sre`, `security-engineer`, `network-engineer`, `salesforce-developer`, `servicenow-developer`, `data-engineer`, `ml-engineer`, `data-scientist`, `genai-engineer`, `scrum-master`, `technical-writer`, `business-analyst`, `product-manager`, `program-manager`, `engineering-manager`, `solutions-architect`, `pre-sales`, `qa-engineer`, `automation-engineer`, `mobile-android`, `mobile-ios`, `frontend-developer`, `backend-developer`, `fullstack-developer`, `embedded-engineer`, `firmware-engineer`, `dba`, `etl-developer`.

Plus product-co specific: `growth-pm`, `staff-engineer`, `principal-engineer`, `developer-advocate`, `support-engineer`.

Plus traditional: `mechanical-engineer`, `chemical-engineer`, `civil-engineer`, `electrical-engineer`, `quant-trader`, `quant-researcher`, `investment-banker`, `equity-research`, `consultant` (mgmt), `brand-manager`, `category-manager`, `supply-chain-manager`, `bank-po`, `gov-officer`.

Total: \~50 roles. `matchRoleKey` needs to handle the alias explosion ("SAP ABAP Developer" → `sap-consultant`, "AWS Cloud Architect" → `cloud-engineer`, "ServiceNow Admin" → `servicenow-developer`).

### 0.7 — Per-cell data spec (the contract)

Every (company, role, level) cell on Tier-1 companies MUST have:

| Field | Required | Notes |
| --- | --- | --- |
| `totalMin`, `totalMax` | yes | LPA |
| `baseMin`, `baseMax` | yes (Tier-1) | LPA, derived if absent |
| `equityType` | yes | enum |
| `equityMin`, `equityMax` | if equityType ≠ none | LPA annual |
| `equityVesting` | if equityType ≠ none | "4yr / 1yr cliff" style |
| `joiningBonusOverride` | recommended | \[min, max\] LPA |
| `source` | yes | primary citation |
| `sourceVerifiedAt` | yes | ≥1 dated source URL |
| `agreementCount` | yes | 1-5 |
| `lastVerified` | yes | ISO date |
| `notes` | yes | candidate-facing pitfall + pushback hint |
| `tracks` | when applicable | multi-track companies |
| `variablePctOverride` | when ≠ tier default |  |
| `noticePeriodDays` | inherited from `COMPANY_META` | OK to omit per-cell |
| `bondPenaltyLpa` | inherited from `COMPANY_META` | OK to omit per-cell |

---

## Phase 1 — Tier-1 Indian IT services (10 companies, \~25 roles each)

**Companies:** TCS (done), Infosys, Wipro, Cognizant, Accenture, HCL, Tech Mahindra, LTIMindtree, Capgemini, IBM India.

**Estimated effort:** 2 days eng. **Cost:** \~$5 LLM if I batch-validate cells. **Blocker:** Phase 0.

### Per-company deliverable

For each company:

1. Multi-track encoding for fresher tier (DSE/Power/Specialist for Infosys, Elite/Turbo/Velocity for Wipro, GenC tracks for Cognizant, ASE/ASE-Plus for Accenture, etc.)
2. Full role coverage: \~25 roles × 5 levels = 125 cells
3. Per-company facts:
   - Notice period (already in `COMPANY_META`; verify)
   - Bond penalty (already in `COMPANY_META`; verify)
   - Onsite-deputation track existence + premium magnitude
   - Service-bond duration for fresher tracks
   - Variable comp % at each level
   - 13th-month / festive bonus existence
   - ESPP availability + discount %
4. Negotiation context update:
   - Liquidity risk (low; no equity except IBM)
   - Track-aware HR pushback patterns
   - Candidate-should-ask checklist
   - Likely benefits (transport, meals, group health, LTA, etc.)
   - Walkaway thresholds per level
5. Sources cited: AmbitionBox 2026 cohort URL + Glassdoor + at least one disclosure (NQT for TCS, DSE disclosure for Infosys, GenC for Cognizant)
6. Regression tests: 3-5 per company pinning the multi-track envelope and lead/exec coverage

### Definition of done (Phase 1)

- All 10 companies have ≥20 roles each at ≥3 levels each
- All cells have `agreementCount >= 2`
- All cells `lastVerified: 2026-05-09`
- Coverage-gaps script (Phase 0.5) reports zero gaps for Phase 1 cohort
- Manual spot-check: pick 10 random cells, verify against levels.fyi/AmbitionBox in real-time
- All vitest pass + coverage gate green

---

## Phase 2 — Tier-1 Indian product/unicorn (25 companies, \~15 roles each)

**Companies:** Razorpay, Flipkart, Swiggy, Zomato, PhonePe, CRED, Zerodha, Paytm, Ola, Meesho, Nykaa, MakeMyTrip, Dream11, Rapido, ixigo, Groww, Upstox, Pine Labs, BharatPe, Acko, Zepto, Inshorts, Lenskart, Urban Company, Cure.fit.

**Estimated effort:** 2 days eng. **Cost:** \~$10 LLM. **Blocker:** Phase 1 done + spot-check passes.

### Roles per company (\~15)

`software-engineer`, `frontend-developer`, `backend-developer`, `mobile-android`, `mobile-ios`, `devops-engineer`, `sre`, `ml-engineer`, `data-engineer`, `data-scientist`, `product-manager`, `ux-designer`, `growth-pm`, `engineering-manager`, `staff-engineer`.

### Per-cell focus

Equity is the lever here, not base. Each cell needs:

- `equityMin`, `equityMax` and `equityVesting` accurate
- `liquidityRisk` accurate (private vs. public; recent buyback or IPO note)
- `recentBuybackNote` populated (Razorpay 6+ buybacks, Flipkart $33B implied valuation, etc.)
- ESOP vs. RSU distinction explicit
- Joining bonus authority (high for senior+ at unicorns)

### Track encoding

Most product cos don't have multi-tracks at fresher level. Skip `tracks` field unless: Flipkart Plus / Flipkart Standard differ; Swiggy Operations vs. Tech bands differ materially.

---

## Phase 3 — Tier-1 global tech India arms (25 companies)

**Companies:**

- FAANG: Google, Meta, Apple, Amazon, Microsoft, Netflix
- Big tech: Adobe, Salesforce, Oracle, SAP Labs, Intel, Nvidia, Qualcomm, Cisco, VMware, ServiceNow, Atlassian, Stripe, Twilio, Walmart Global Tech
- Banks/fintech GCC: JPMorgan, Goldman Sachs, Morgan Stanley, BofA, Wells Fargo
- Consulting: McKinsey, BCG, Bain (already curated, verify)

**Estimated effort:** 1.5 days. **Cost:** \~$5 LLM. **Blocker:** Phase 2.

Most of these are already well-curated from prior sessions. Phase 3 is **verification + completing missing roles**, not full rewrite.

---

## Phase 4 — Tail coverage (DEFERRED)

**Trigger to start:** post-revenue, OR when 3+ users flag a Tier-2 company.

The 70 CSV-only companies + 100s of autocomplete entries are currently hedged via the calibration sentence. That's good enough until paying users tell us otherwise.

If forced: outsource to a data freelancer on Upwork (₹15-25K, 2 weeks) using the schema spec from Phase 0.7 as the contract.

---

## Phase 5 — Maintenance loop (ongoing)

Once Phase 1-3 ship:

### Quarterly refresh

- CI gate from Phase 0.3 fires when `lastVerified` ages past 180d (Tier 1) or 365d (Tier 2)
- Quarterly: 1 focused day re-running coverage-gaps audit + spot-checking 30 random cells

### User-feedback funnel (Phase 0.4)

- Salary-feedback admin dashboard reviewed weekly
- Each "way_off" flag → 30-min targeted fix → regression test
- Each "accurate" thumbs-up → bumps `agreementCount` (user counts as a source)

### Levels.fyi / AmbitionBox change detection (deferred)

- Optional: scheduled scrape comparing our numbers to current public data, flagging &gt;25% drift
- Cost: $20-50/month + setup
- Defer until 100+ paying users

---

## Cost summary

| Phase | Eng time | LLM spend | When |
| --- | --- | --- | --- |
| 0 — Foundation | 1 day | $0 | now (gate for everything) |
| 1 — IT Services | 2 days | \~$5 | after 0 |
| 2 — Unicorns | 2 days | \~$10 | after 1 + spot-check |
| 3 — Global Tech | 1.5 days | \~$5 | after 2 |
| 4 — Tail | deferred | — | post-revenue |
| 5 — Maintenance | 30 min/wk | — | ongoing |

**Total upfront: \~6.5 working days, \~$20 LLM spend.**

---

## Decision points (need approval before execution)

1. **Scope confirmed?** Phase 0 → 1 → 2 → 3 in that order, deferring 4. Y/N.
2. **Schema changes OK?** Adding `tracks`, `agreementCount`, structured `sourceVerifiedAt` to `CompanyBandOverride` is a non-trivial refactor — will touch \~135 existing entries (auto-migrate with default values). Y/N.
3. **CI gate OK?** Adding a freshness gate that fails CI on stale stamps is a small but real friction tax on every future commit. Y/N.
4. **User-feedback table OK?** Adds a new Supabase table + admin surface. Small but real ongoing maintenance cost. Y/N.
5. **Spot-check protocol** — after each phase ships, you (or I via WebFetch on levels.fyi/AmbitionBox where allowed) spot-check 10 random cells before promoting Tier-1. Y/N.
6. **My honesty disclaimer:** my "research" here is grounded in training-data priors + the existing dataset, not real-time browsing. For every Tier-1 cell I write, I'll flag with `agreementCount: 1` unless you've verified externally. The CI gate will then refuse to ship those cells until they're independently confirmed. **This is the most important guardrail in the whole plan** — it prevents me from confidently stamping wrong numbers as `verified`.

---

## What I recommend

**Approve scope = Phase 0 + Phase 1.** That's 3 days of focused work, costs \~$5, and ships a foundation + the 10 highest-traffic Indian companies done correctly.

After Phase 1 lands and you've spot-checked one company's numbers against reality, decide on Phase 2 + 3.

Don't approve all 4 phases up front. The cost of a bad Phase 1 is 3 days. The cost of a bad Phase 1-3 is 6.5 days. Stage the commitment.

---

## What I will NOT do

- Stamp cells `verified` without independent confirmation. Default `agreementCount: 1` until a second source confirms.
- Touch granular bands in `salaries.ts` — separate scope.
- Rewrite the autocomplete company list — separate scope.
- Build the eval harness — explicitly deferred per prior session.
- Mass-LLM-generate role-band data without human review of each company before the commit lands.