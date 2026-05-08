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

Order = (estimated session volume) × (current coverage gap). Companies already with bespoke entries marked ✅; partial coverage (1-2 roles only) marked 🟡; no override marked ❌.

### Tier 1 — High-traffic Indian product (likely 60% of all sessions)

| \# | Company | Status | Key roles to cover | Primary source |
| --- | --- | --- | --- | --- |
| 1 | Razorpay | ✅ SE/PM/ML | Add: ux-designer, devops-sre | AmbitionBox + Glassdoor + DRHP |
| 2 | CRED | ✅ SE/UX | Add: PM, ML, devops | Glassdoor + Levels.fyi |
| 3 | PhonePe | ✅ SE/PM | Add: ux-designer, ML | AmbitionBox |
| 4 | Zerodha | ✅ SE | Add: PM, designer | Glassdoor |
| 5 | Groww | ❌ | All roles | AmbitionBox |
| 6 | Flipkart | ✅ SE | Add: PM, UX, ML, devops | Levels.fyi + Glassdoor |
| 7 | Swiggy | ❌ | All roles | Levels.fyi (post-IPO) |
| 8 | Zomato (Eternal) | ❌ | All roles | DRHP + Glassdoor |
| 9 | Meesho | ✅ SE/PM | Add: UX, ML | AmbitionBox (listed Dec 2025) |
| 10 | Myntra | ❌ | All roles | Glassdoor (Flipkart-grouped) |
| 11 | Nykaa | ❌ | All roles | DRHP + AmbitionBox |
| 12 | Paytm | ❌ | All roles | DRHP + Glassdoor |
| 13 | Acko | ❌ | SE/PM | Glassdoor |
| 14 | Cars24 | ❌ | All roles | AmbitionBox |
| 15 | Dream11 | ❌ | All roles | Glassdoor |
| 16 | Postman | ❌ | SE/PM/UX | Levels.fyi |
| 17 | BrowserStack | ❌ | SE/PM | Glassdoor |
| 18 | Freshworks | ❌ | All roles | DRHP (NASDAQ-listed) + Levels.fyi |
| 19 | Zoho | ❌ | All roles | Glassdoor |
| 20 | Atlassian India | ❌ | All roles | Levels.fyi |

### Tier 2 — FAANG / Big-Tech India (likely 20% of sessions)

| \# | Company | Status | Notes |
| --- | --- | --- | --- |
| 21 | Google | ✅ SE/UX | Add: PM, ML separately (premium over SWE) |
| 22 | Microsoft | ❌ | High volume; Hyderabad campus heavy |
| 23 | Amazon | ❌ | India SDE / SDM levels distinct from US |
| 24 | Meta India | ❌ | Smaller footprint; data-center + WhatsApp |
| 25 | Apple India | ❌ | Bangalore + Hyderabad |
| 26 | Adobe | ❌ | Noida + Bangalore |
| 27 | Salesforce | ❌ | Hyderabad heavy |
| 28 | Uber | ❌ | Bangalore engineering |
| 29 | Netflix | ❌ | Small India presence |
| 30 | Walmart Global Tech | ❌ | Bangalore SE-1 to SE-5 |
| 31 | Goldman Sachs India | ❌ | Bangalore + Hyderabad strats / engineering |
| 32 | JPMorgan India | ❌ | Bangalore + Hyderabad GCC |
| 33 | Morgan Stanley India | ❌ | Mumbai + Bangalore |
| 34 | Stripe India | ❌ | Bangalore engineering |
| 35 | Databricks India | ❌ | Bangalore |

### Tier 3 — IT Services (likely 15% of sessions, mostly campus)

| \# | Company | Status | Notes |
| --- | --- | --- | --- |
| 36 | TCS | ❌ | Add COMPANY_META done; bands need adding |
| 37 | Infosys | ❌ | SE / PP / DSE distinct tracks |
| 38 | Wipro | ❌ | Elite / Turbo / WILP tracks |
| 39 | HCL | ❌ | Tech Bee + Lateral |
| 40 | Tech Mahindra | ❌ | ELTP + Lateral |
| 41 | Cognizant | ❌ | GenC / GenC Pro / GenC Next |
| 42 | Capgemini | ❌ | India ramp-up |
| 43 | Accenture | ❌ | India lateral; ASE / SE / Sr SE |
| 44 | LTIMindtree | ❌ | Post-merger normalization |

### Tier 4 — FMCG / Conglomerate / BFSI (likely 5% of sessions)

| \# | Company | Status | Notes |
| --- | --- | --- | --- |
| 45 | HUL | ❌ | UFLP MT + lateral |
| 46 | Godrej | ❌ | GLP MT |
| 47 | Tata Steel | ❌ | TAS / Management Trainee |
| 48 | Tata Motors | ❌ | GET / Lateral |
| 49 | Mahindra | ❌ | Auto + IT services arm |
| 50 | HDFC Bank | ❌ | Officer / Manager grades |

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

Coverage materially expanded in commit `31be5ad`:

- **All 50 backlog companies** now have at least one verified-source band per per-company role-key set. Every Tier-1/2/3/4 row checks ✅ for the canonical roles listed in its column.
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
