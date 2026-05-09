# Salary Data Freelancer Brief

**Hire on:** Upwork / Fiverr / WorknHire (search "data entry research India salary") **Budget:** ₹5,000 – ₹8,000 for Phase 1 (10 IT-services companies) **Estimated time:** 15–20 hours

## What you're building

A CSV with verified salary bands for India's largest IT-services and product companies, used to coach candidates through salary negotiations on a mock-interview platform. Every number you enter MUST be backed by at least one public source URL. Numbers cannot be invented. If you can't verify a cell from public sources, leave it blank — the system handles missing cells gracefully.

## Phase 1 scope — 10 companies, \~25 roles each

Fill data for these 10 companies first. \~3,750 cells total (10 cos × \~25 roles × 5 levels × 1-3 tracks).

 1. TCS (Tata Consultancy Services) — example rows already in the CSV; use as template
 2. Infosys — example rows already in the CSV; use as template
 3. Wipro
 4. Cognizant
 5. Accenture (India)
 6. HCL Technologies
 7. Tech Mahindra
 8. LTIMindtree
 9. Capgemini (India)
10. IBM India

## The CSV file

Open `data/salary-data-input.csv`. Columns explained:

| Column | What to enter |
| --- | --- |
| `company` | lowercase short name, no suffixes. `tcs` not `TCS Ltd` |
| `role` | kebab-case canonical role key. See "Role list" below. |
| `level` | exactly one of: `entry` (0-2 YOE), `mid` (3-5), `senior` (5-8), `lead` (8-12), `executive` (12+) |
| `trackName` | Leave blank for single-track companies. For multi-track (TCS Ninja/Digital/Prime, Infosys DSE/Power/Specialist, etc.) fill the track name |
| `totalMin`, `totalMax` | Total CTC range in LPA (lakhs per annum). Numbers only — `8.5` not `₹8.5L` |
| `baseMin`, `baseMax` | Fixed base in LPA. Usually 70-85% of total at IT services |
| `equityMin`, `equityMax` | Annual equity value in LPA. `0` if no equity (most IT services) |
| `equityType` | `rsu` (public co stock), `esop` (private co options), or `none` |
| `equityVesting` | E.g. "4yr / 1yr cliff" or "4yr / 25-25-25-25". Leave blank if no equity |
| `joiningBonusMin`, `joiningBonusMax` | One-time signing bonus in LPA |
| `variablePct` | Variable/performance bonus as % of CTC. IT services typically 10-15. |
| `noticePeriodDays` | Standard notice period. TCS=90, Infosys=90, Wipro=90, Razorpay=30. |
| `bondPenaltyLpa` | Service bond penalty if candidate quits early. TCS=0.5, Infosys=1.0. `0` if none. |
| `sourceGlassdoor` | URL to the Glassdoor salary page you used |
| `sourceAmbitionbox` | URL to the AmbitionBox salary page you used |
| `sourceLevelsFyi` | URL to Levels.fyi if applicable |
| `sourceDrhp` | URL to DRHP / IPO filing if applicable |
| `sourceOperatorNetwork` | "Founder/Recruiter network: " if you have insider info |
| `resumeSignals` | For multi-track tracks only: pipe-separated cues that signal this track. E.g. "NQT top decile |
| `notes` | One-line note on this band: what's typical, what HR pushes back on, what the candidate should ask. Max 200 chars. |
| `lastVerified` | Today's date in YYYY-MM-DD format |

**At least ONE source column MUST be filled per row.** If no source, leave the row out — DO NOT guess.

## Role list (canonical keys)

Use exactly these keys (kebab-case):

**Engineering:**`software-engineer`, `frontend-developer`, `backend-developer`, `fullstack-developer`, `mobile-android`, `mobile-ios`, `embedded-engineer`, `firmware-engineer`, `qa-engineer`, `automation-engineer`

**Specialized engineering:**`devops-engineer`, `sre`, `cloud-engineer`, `security-engineer`, `network-engineer`, `dba`, `etl-developer`, `data-engineer`, `ml-engineer`, `data-scientist`, `genai-engineer`

**Enterprise / IT services-specific:**`sap-consultant`, `mainframe-developer`, `salesforce-developer`, `servicenow-developer`, `oracle-consultant`, `solutions-architect`, `pre-sales`, `technical-writer`

**Management / non-tech:**`engineering-manager`, `product-manager`, `program-manager`, `project-manager`, `scrum-master`, `business-analyst`, `ux-designer`, `growth-pm`

If the company hires for a role NOT in this list (e.g. an actuary at LIC), skip it for now and flag it back — we'll add the canonical key.

## How to research each cell — the workflow

For each (company, role, level) combination:

1. **Open AmbitionBox** → search "TCS Software Engineer salary" → look at the cohort distribution + median
2. **Open Glassdoor (.co.in)** → search same → cross-check the median
3. **Open Levels.fyi** if available → especially for senior+ roles at product cos / GCCs
4. **Take the median ± 20%** as totalMin/totalMax. Don't take the absolute max (that's principal-level outliers).
5. **For multi-track companies (TCS, Infosys, Wipro, Cognizant, Accenture, HCL):** create one row PER track. Each track row has its own band. The system will merge them into a single envelope.
6. **Paste the source URL** into the appropriate `source*` column. Multiple sources = multiple columns filled (better confidence).
7. **Stamp** `lastVerified` **with today's date.**
8. **Note** field: 1 sentence on what HR pushes back with, what the candidate should ask. Be specific. "Push for written refresher floor" is better than "negotiate equity."

## Multi-track guidance (CRITICAL)

These companies HAVE multiple fresher tracks. Don't compress to one band — fill one row per track:

| Company | Tracks | Approximate fresher CTC |
| --- | --- | --- |
| TCS | Ninja, Digital, Prime | ₹3.4L / ₹7-9L / ₹11.5L |
| Infosys | DSE, Power Programmer, Specialist L1, L2, L3 | ₹3.6L / ₹8L / ₹10L / ₹16L / ₹21L |
| Wipro | Elite, Turbo, Velocity, WILP | ₹3.5L / ₹6L / ₹6.5L / ₹2L (work-integrated) |
| Cognizant | GenC, GenC Next, GenC Pro | ₹4L / ₹6.5L / ₹9-12L |
| Accenture | ASE, ASE-Plus | ₹4.5L / ₹7-9L |
| HCL | TechBee, GET (standard), GET (Premium) | ₹2L / ₹4.5L / ₹7L |

For mid/senior/lead/executive levels, multi-track usually consolidates into one band — fill `trackName` blank for those rows.

## What you SHOULD NOT do

- <span data-name="cross_mark" data-type="emoji"><img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/274c.png" draggable="false" loading="lazy" align="absmiddle" alt="x emoji"></span> Don't invent numbers. If you can't find a source, skip the row.
- <span data-name="cross_mark" data-type="emoji"><img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/274c.png" draggable="false" loading="lazy" align="absmiddle" alt="x emoji"></span> Don't include the highest-reported number as `totalMax` — that's the staff/principal outlier, not the median ceiling. Use 75th-90th percentile.
- <span data-name="cross_mark" data-type="emoji"><img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/274c.png" draggable="false" loading="lazy" align="absmiddle" alt="x emoji"></span> Don't fill `equityMin/Max` for IT services companies (TCS/Infosys/Wipro/etc.) — they don't issue equity. Leave both as `0`.
- <span data-name="cross_mark" data-type="emoji"><img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/274c.png" draggable="false" loading="lazy" align="absmiddle" alt="x emoji"></span> Don't include US-onsite numbers — India-only.
- <span data-name="cross_mark" data-type="emoji"><img src="https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/274c.png" draggable="false" loading="lazy" align="absmiddle" alt="x emoji"></span> Don't paste promotional/clickbait sites (Cuemath, Naukri marketing pages). Stick to AmbitionBox, Glassdoor, Levels.fyi, DRHP filings, official company disclosures.

## Quality bar — how we'll review your work

When you submit the CSV, we run:

```sh
npm run import:salaries -- --dry-run
```

This validates:

- Every row has ≥1 source URL
- Every row has `lastVerified` within last 90 days
- Total numbers &gt; base numbers (sanity)
- Equity = 0 for IT services
- No duplicate (company, role, level, trackName) tuples
- All `role` values match the canonical role list

Rows that fail validation are listed back to you for correction. Pay is on rows that PASS validation, not rows submitted.

## Deliverable

Filled `data/salary-data-input.csv`. That's it. Email/Drive/GitHub PR — your preference.

## Questions to ask before starting

1. Do you have access to AmbitionBox Premium? (Helps with senior+ data)
2. Have you done salary research before, or is this your first?
3. Can you commit to 15-20 hours over the next week?
4. Do you have a recent example of similar work (CSV, structured data, source citations)?

---

**For the candidate (you, the developer):** if you'd rather skip the freelancer and do this yourself — fine, \~15-20 hours of your evenings. The CSV format is the same. Use the example rows in `data/salary-data-input.csv` as your template. Run `npm run import:salaries -- --dry-run` after every batch of 50 rows to catch errors early.