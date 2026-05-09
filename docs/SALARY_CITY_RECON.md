# City-granularity recon (AmbitionBox) — 2026-05-09

## TL;DR

**Don't scrape AB per-city — sample sizes are too thin to be reliable signal.**
The city-filter URL works (`?location=<city-slug>` on a designation page),
but per-(company, role, city) reports are sparse outside HQ city, and where
samples ARE adequate, the city differential is within band noise (<10%) for
most companies.

## What we tested

URL pattern that returns clean `__NEXT_DATA__` with `salaryData.data`:
```
https://www.ambitionbox.com/salaries/<co>-salaries/<designation>?location=<city>
```
City slugs that work: `bengaluru`, `mumbai`, `pune`, `chennai`, `hyderabad`,
`noida`, `gurgaon`, `delhi-ncr`. (`bangalore` redirects to unfiltered.)

## Findings

### Microsoft Software Engineer (FAANG, RSU-paying)
| City      | n   | Typical band   |
|-----------|-----|----------------|
| Hyderabad | 887 | 31.7-35.0L     |
| Bengaluru | 752 | 31.5-34.8L     |
| Noida     | 232 | 31.4-35.5L     |
| Pune      | 142 | 32.7-36.6L     |
| Gurgaon   |  88 | 28.7-37.5L     |
| Chennai   |  76 | 30.1-35.2L     |
| Mumbai    |  35 | (low-n, dropped)|

Spread: ±5% midpoint variation. Within noise.

### TCS System Engineer (IT-services flagship)
| Scope     | n      | Typical band   |
|-----------|--------|----------------|
| All India | 106488 | 4.6-6.9L       |
| Hyderabad | 16678  | 4.5-6.9L       |

Effectively identical. TCS pays nationwide-uniform.

### Indian unicorns (Flipkart, Swiggy, Razorpay)
- HQ city (Bangalore) has n=50-300 per role
- Other cities have n<25, often n<10
- Where samples allow comparison, BLR-vs-other differentials are within
  ±15% but variance is dominated by sample-size noise, not real geo signal

## Why this matters

The original "Phase 2 = city × YOE granularity" recommendation overstated
the lift. AB's data architecture is:
- Per-company HQ city = solid sample (n>200)
- All other cities = trickle data (n<30)

Scraping 96 cos × 10 designations × 6 cities = 5,760 requests / ~3.4 hours
to harvest mostly low-confidence cells.

## Better paths forward (re-prioritized)

1. **Static city tier multipliers** at lookup time, sourced from public
   regional cost-of-living indices (Bengaluru = 1.0x baseline, Hyderabad
   ≈ 0.95x, Pune ≈ 0.92x, Chennai ≈ 0.90x, Tier-2 ≈ 0.80x). One-time
   research, applied uniformly.

2. **Equity vesting + joining-bonus surfacing** — the CSV already has
   `equityVesting`, `joiningBonusMin/Max`, `variablePct` columns; the
   `salary-lookup.ts` LLM-prompt pipeline doesn't surface them yet.
   Wire them through and the negotiation coach gains real leverage.

3. **Counter-offer playbook data** — per-tier typical bump %% (FAANG:
   8-15%, IT-services: 3-5%, startup: 10-25%). Either curator-sourced
   or LLM-summarized from public Blind/Reddit threads.

4. **User-offer ground truth** (slow-burn moat) — post-session
   "what offer did you get?" prompt.

## Decision

Skip AB city scraping. Continue with YOE-bucket scrape (in flight) for
the actual high-ROI granularity win. Pivot Phase 2 to options 1-2 above.
