# Salary Data Curator Backlog

**Owner:** Whoever's running the data refresh this quarter. **Cadence:** Refresh \~5 companies/week. Bump `lastVerified` when re-checking. **CI gate:** `companyOverridesStaleness.test.ts` fails the build at &gt;540 days old.

---

## How to source one company

For each priority company below:

1. **Open the source URLs** in order (Levels.fyi → AmbitionBox → Glassdoor).
2. **Pull the median + range** for each (role, level) the company hires for.
3. **Cross-check across 2 sources** — if they disagree by &gt;20%, prefer the larger sample size and note the discrepancy in `notes`.
4. **Add an entry** to `data/company-salary-overrides.ts` like:

```ts
"<lowercase-key>": {
  "<role-key>": {
    mid: {
      totalMin: <number>, totalMax: <number>,
      equityMin: <opt>, equityMax: <opt>,
      equityType: "esop" | "rsu" | "none",
      equityVesting: "4yr / 1yr cliff",
      source: "Levels.fyi + AmbitionBox (N samples)",
      lastVerified: "YYYY-MM-DD",
      notes: "<optional>",
      sourceVerifiedAt: { levelsFyi: "YYYY-MM-DD", ambitionbox: "YYYY-MM-DD" },
    },
    senior: { ... },
  },
},
```

5. **For company-level facts** (notice period, bond, deputation), add to the `COMPANY_META` table in the same file. Don't duplicate per-role.

6. **Run** `npm test` — staleness gate verifies your `lastVerified` is parsable.

---

## Role-key reference (52 keys)

When unsure which role-key a job title maps to, run this one-liner:

```sh
node -e 'console.log(require("./data/salaries").matchRoleKey("Senior Product Designer"))'
```

Common mappings:

- "Software Engineer" / "SDE" / "SWE" → `software-engineer`
- "Product Designer" / "UX Designer" → `ux-designer`
- "Product Manager" / "APM" → `product-manager`
- "Data Scientist" → `data-scientist`
- "ML Engineer" / "AI Engineer" → `ml-engineer`
- "Full Stack" / "Backend" / "Frontend" → `software-engineer`
- "DevOps" / "SRE" → `devops-sre`
- "Engineering Manager" / "EM" → `engineering-manager`

---

## Top-50 priority backlog

Order = (estimated session volume) × (current coverage gap). Status is computed by `companySalaryOverridesCoverage.test.ts` against the canonical role set listed per row: ✅ all canonical roles present; 🟡 partial; ❌ no entry. Last automated reconciliation: **2026-05-08**.

**Headline numbers**

- Salary-override coverage: **127 / 141 expected role-cells = 90%** across the top-50.
- Companies fully covered: **38 / 50 = 76%**. The remaining 12 rows have specific gaps listed in the table below.
- Per-company negotiation context (`company-negotiation-context.ts`, the new strategic layer): **6 / 50 = 12%** (Meesho, Myntra, Nykaa, Paytm, Acko, Cars24). All other top-50 cos still rely on generic `COMP_STRATEGY_NOTES`.

### Tier 1 — High-traffic Indian product (likely 60% of all sessions)

| \# | Company | Status | Canonical roles / gaps | Primary source |
| --- | --- | --- | --- | --- |
| 1 | Razorpay | 🟡 SE/PM/UX/Sales/ML/DevOps | **Add: data-scientist** | AmbitionBox + Glassdoor + DRHP |
| 2 | CRED | 🟡 SE/PM/UX/Marketing/ML/DevOps | **Add: data-scientist** | Glassdoor + Levels.fyi |
| 3 | PhonePe | ✅ SE/PM/UX/Data/Risk/KAM/ML | Refreshed 2026-05-08 | AmbitionBox + DRHP |
| 4 | Zerodha | ✅ SE/PM/UX | — | Glassdoor |
| 5 | Groww | 🟡 SE/PM/UX | **Add: data-scientist** | AmbitionBox |
| 6 | Flipkart | ✅ SE/PM/UX/ML/DevOps | — | Levels.fyi + Glassdoor |
| 7 | Swiggy | 🟡 SE/PM/UX/Operations | **Add: data-scientist** | Levels.fyi (post-IPO) |
| 8 | Zomato (Eternal) | 🟡 SE/PM/UX | **Add: data-scientist** | DRHP + Glassdoor |
| 9 | Meesho | ✅ SE/PM/UX/ML + neg-context | Refreshed 2026-05-08 (joining-bonus + neg-focus) | AmbitionBox (listed Dec 2025) |
| 10 | Myntra | 🟡 SE/PM/UX + neg-context | **Add: marketing** | Glassdoor (Flipkart-grouped) |
| 11 | Nykaa | 🟡 SE/PM/UX + neg-context | **Add: marketing** | DRHP + AmbitionBox |
| 12 | Paytm | 🟡 SE/PM/UX + neg-context | **Add: data-scientist** | DRHP + Glassdoor |
| 13 | Acko | 🟡 SE/PM + neg-context | **Add: data-scientist** | Glassdoor |
| 14 | Cars24 | ✅ SE/PM/UX/Sales + neg-context | Refreshed 2026-05-08 | AmbitionBox |
| 15 | Dream11 | ✅ SE/PM/Data | — | Glassdoor |
| 16 | Postman | ✅ SE/PM/UX | — | Levels.fyi |
| 17 | BrowserStack | ✅ SE/PM | — | Glassdoor |
| 18 | Freshworks | ✅ SE/PM/UX | — | DRHP (NASDAQ-listed) + Levels.fyi |
| 19 | Zoho | ✅ SE/PM | — | Glassdoor |
| 20 | Atlassian India | ✅ SE/PM/UX | — | Levels.fyi |

### Tier 2 — FAANG / Big-Tech India (likely 20% of sessions)

| \# | Company | Status | Canonical roles / gaps | Notes |
| --- | --- | --- | --- | --- |
| 21 | Google | ✅ SE/PM/UX/ML | — | Levels.fyi |
| 22 | Microsoft | ✅ SE/PM/UX/ML | — | Levels.fyi |
| 23 | Amazon | ✅ SE/PM/UX/ML | India SDE / SDM levels distinct from US | Levels.fyi |
| 24 | Meta India | ✅ SE/PM/ML | — | Levels.fyi |
| 25 | Apple India | ✅ SE/PM | — | Levels.fyi |
| 26 | Adobe | ✅ SE/PM/UX | — | Levels.fyi |
| 27 | Salesforce | ✅ SE/PM | — | Glassdoor |
| 28 | Uber | ✅ SE/PM | — | Levels.fyi |
| 29 | Netflix | ✅ SE/PM | — | Levels.fyi |
| 30 | Walmart Global Tech | ✅ SE/PM/Data | — | Levels.fyi |
| 31 | Goldman Sachs India | ✅ SE/Data/Finance | — | Levels.fyi + DRHP |
| 32 | **JPMorgan India** | ❌ | **Add: SE, data-scientist, finance** (entire row missing) | Levels.fyi + Glassdoor |
| 33 | Morgan Stanley India | ✅ SE/Finance | — | Glassdoor |
| 34 | Stripe India | ✅ SE/PM | — | Levels.fyi |
| 35 | Databricks India | 🟡 SE/ML | **Add: product-manager** | Levels.fyi |

### Tier 3 — IT Services (likely 15% of sessions, mostly campus) — **100% covered**

| \# | Company | Status | Notes |
| --- | --- | --- | --- |
| 36 | TCS | ✅ SE/QA/BA | — |
| 37 | Infosys | ✅ SE | SE / PP / DSE distinct tracks documented in notes |
| 38 | Wipro | ✅ SE | Elite / Turbo / WILP tracks |
| 39 | HCL | ✅ SE | Tech Bee + Lateral |
| 40 | Tech Mahindra | ✅ SE | ELTP + Lateral |
| 41 | Cognizant | ✅ SE | GenC / GenC Pro / GenC Next |
| 42 | Capgemini | ✅ SE | India ramp-up |
| 43 | Accenture | ✅ SE | India lateral; ASE / SE / Sr SE |
| 44 | LTIMindtree | ✅ SE | Post-merger normalization |

### Tier 4 — FMCG / Conglomerate / BFSI (likely 5% of sessions)

| \# | Company | Status | Canonical roles / gaps | Notes |
| --- | --- | --- | --- | --- |
| 45 | HUL | ✅ Marketing/Sales | — | UFLP MT + lateral |
| 46 | Godrej | ✅ Marketing/Sales | — | GLP MT |
| 47 | Tata Steel | ✅ Mech-Eng | — | TAS / Management Trainee |
| 48 | Tata Motors | ✅ Mech-Eng | — | GET / Lateral |
| 49 | Mahindra | ✅ Mech-Eng | — | Auto + IT services arm |
| 50 | HDFC Bank | 🟡 Finance | **Add: sales** | Officer / Manager grades |

---

## Curator action queue (prioritised by leverage)

The 12 rows still 🟡 / ❌ above resolve down to **13 missing role-cells**. Tackle in this order:

1. **JPMorgan India** — entire row missing; Tier-2 GCC, high session volume. SE / DS / Finance bands. (3 cells)
2. `data-scientist` **sweep** — Razorpay, CRED, Groww, Swiggy, Zomato, Paytm, Acko (7 cells in one batch). DS is the single most-requested role we don't ground per-company.
3. `marketing` **for Myntra + Nykaa** — required for Brand / Growth / Category roles per the negotiation-context grids already curated. (2 cells)
4. **Databricks PM** + **HDFC Bank Sales**. (2 cells)

After those 13 cells land, top-50 hits **100% / 100%** override coverage. Next phase shifts to the **negotiation-context layer** (currently 6/50; aim for the same Tier-1 set first).

---

## Per-tier source recipes

### IT Services

1. Glassdoor → company → "Salaries" tab → filter by location India
2. AmbitionBox → company → cross-check
3. Bond + notice from official offer-letter screenshots on TeamBlind / Reddit r/india
4. Most useful per-role: Software Engineer (entry → senior), Test / QA, BA

### FAANG India

1. Levels.fyi → primary source; filter by India
2. Cross-check Glassdoor for outliers
3. Note: USD numbers convert at offer-time FX, not vesting-time

### Indian Unicorns

1. AmbitionBox → primary
2. Glassdoor → cross-check
3. DRHP filings (SEBI) for listed / pre-IPO cos — executive comp section is gold
4. Buyback announcements on press releases (TechCrunch India, YourStory, MoneyControl)

### FMCG / Conglomerate

1. Campus placement reports (IIM-A, IIM-B, IIM-C, IIT-B, IIT-D releases)
2. AmbitionBox lateral
3. Glassdoor for senior roles

### Government / PSU

1. 7th CPC pay matrix (govt website)
2. PSU annual reports — mention scientist / engineer cadre pay
3. Career portal sites for current GP / CPI bands

---

## Verification heuristics

After adding an entry, **sanity-check:**

1. Does `senior.totalMin` ≥ `mid.totalMax × 0.9`? (continuity check)
2. Is `entry.totalMin` ≥ minimum-wage equivalent? (₹3 LPA floor)
3. Does the equity range make sense vs the total CTC? (equity should be 5-25% of CTC for product cos with equity)
4. Does `lastVerified` match today's date in YYYY-MM-DD?

If any check fails, the data is probably wrong — re-source.

---

## What goes in `notes` vs other fields

- `notes` = qualitative color the LLM uses to flavor the negotiation. "CRED design bar exceptionally high — premium over peer unicorns."
- `source` = where you got the numbers, e.g. "AmbitionBox (3,400 samples) + Levels.fyi"
- `sourceVerifiedAt` = per-source dates so we can track which sources have stale data
- `recentBuybackNote` = ONLY company-specific public buyback events (don't generalize)

---

## Telemetry feedback loop

After 1 week of `salary_band_resolved` events in PostHog:

```
Filter: band_source IN ("tier-default", "fallback")
Group by: company
Sort: count desc
```

Top 20 there = **next 20 to add to this backlog**. Repeat weekly until `band_source = "company-override"` is &gt;70% of all salary-neg sessions.

That's the "mature" state. We're at \~30% today.

---

## 2026-05-08 bulk fill — current state

Coverage materially expanded in commit `31be5ad`, refreshed in `96dfe64` (Meesho/Myntra/Nykaa/Paytm/Acko/Cars24 joining-bonus authority + per-(role × level) negotiation focus + new `company-negotiation-context.ts` layer).

- **49/50 backlog companies** have at least one verified-source band (only JPMorgan still empty). Across the canonical role set per row, **127/141 cells = 90%** are filled; **38/50 cos = 76%** are full ✅. Remaining gaps queued in the action list above.
- **Sector defaults** (`__sector_*`) expanded from SE-only (1 role) to all 14 canonical roles (SE, PM, UX, ML, DS, DevOps, data-analyst, BA, sales, marketing, finance, operations, customer-success, hr) at every level. This is what the long tail of \~10k companies in the autocomplete actually hits.
- **Classifier blind spots = 0.** All 845 companies in `company-tiers.ts` route to a sector via `classifyCompanyType()`.
- `sectorRoleCoverage.test.ts` locks the role coverage in CI — fails the build if any sector silently regresses to SE-only.

### Provenance grep cheat-sheet

The next curator can target refresh by `source` substring:

| Substring | What it means | Action |
| --- | --- | --- |
| `Glassdoor`, `Levels.fyi`, `AmbitionBox`, `DRHP` | Verified against named source. | Refresh `lastVerified` quarterly. |
| `HireStepX 2026 seed` | Templated benchmark × company multiplier. | Replace with verified data when telemetry shows it firing on real sessions. |
| `Sector default 2026-05-08` | Derived from sector's anchor role × cross-role multiplier. | Refresh the anchor role's verified band; derived bands re-derive automatically by re-running the expansion script. |

### What's NOT covered

- Per-role precision within sector defaults (sales-in-BFSI ≠ sales-in-IT-services even though both inherit the sector multiplier). Fix incrementally as PostHog `band_source = "tier-default"` complaints surface.
- Companies outside `company-tiers.ts` (free-text input from candidates). These rely on `classifyCompanyType`'s keyword heuristics — track null returns in production via PostHog.