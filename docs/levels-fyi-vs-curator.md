# Levels.fyi vs Curator — recon report

Per-level mean total-comp from Levels.fyi (India location), converted USD → LPA via the page's embedded exchange rate. Compared against COMPANY_SALARY_OVERRIDES midpoints. n = total samples, c12 = samples in the last 12 months.

A "✓" in agreement column = within ±20% of curator midpoint. "✗" = outside ±20%. Empty = no curator entry to compare.

## Key findings (read this first)

- **Where curator and Levels.fyi mean agree**: Google SE all levels, Apple SE all levels, Amazon SDE-II/PM/Principal-PM, Microsoft entry-tier. These are the cells where curator's "Levels.fyi P50" sourcing held up.
- **Where curator is HIGHER than Levels.fyi mean by 30-50%**: Adobe SE mid+, Nvidia SE mid+, Oracle SE all, Cisco SE mid+, Microsoft SE senior+, Amazon PM senior, ServiceNow, VMware, Atlassian.
  - Curator notes claim P50 sourcing but Levels.fyi mean (across substantial c12 samples) is much lower. Either the 2024-25 tech-downturn compressed actual offers OR curator was anchored to upper-decile self-reports.
  - Either way, **Levels.fyi mean reflects what candidates are getting in 2026** and is probably the better number for negotiation guidance.
- **Decision points**:
  1. Flip these cells from curator → Levels.fyi mean (build Phase 2C-B scraper + wire as preferred for product cos at senior+).
  2. Or leave curator alone and accept that we're coaching candidates to the high end of the band — risk: candidate quotes a number a recruiter laughs at.
  3. Or treat as advisory data only — surface in the SessionReportView as "market check" without changing curator.

Sample sizes (c12) are non-trivial for the disagreement cells — Adobe SE3 c12=35, Microsoft 62 c12=140, Oracle IC-3 c12=247 — these aren't noise.

## google — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L3 (ord 0 → entry) | 10 / 187 | ₹44.0L | ₹26.6L | ₹14.7L | ₹2.7L | ₹39.5L (entry) | ✓ 11% |
| L4 (ord 1 → mid) | 15 / 227 | ₹73.1L | ₹42.4L | ₹27.5L | ₹3.2L | ₹68.8L (mid) | ✓ 6% |
| L5 (ord 2 → senior) | 21 / 111 | ₹118.4L | ₹62.0L | ₹50.1L | ₹6.3L | ₹105.0L (senior) | ✓ 13% |

## google — product-manager (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Associate Product Manager 1 (ord 0 → entry) | 6 / 0 | ₹30.6L | ₹30.6L | ₹0.0L | ₹0.0L | ₹40.3L (entry) | ✗ 24% |
| Product Manager 1 (ord 2 → mid) | 17 / 5 | ₹64.2L | ₹47.5L | ₹14.8L | ₹1.9L | ₹83.2L (mid) | ✗ 23% |
| Product Manager 2 (ord 3 → senior) | 21 / 9 | ₹119.8L | ₹64.3L | ₹46.1L | ₹9.4L | ₹153.2L (senior) | ✗ 22% |
| Senior PM (ord 4 → lead) | 21 / 3 | ₹169.7L | ₹90.3L | ₹67.4L | ₹12.1L | ₹215.0L (lead) | ✗ 21% |
| Group PM (ord 5 → executive) | 10 / 3 | ₹312.5L | ₹150.9L | ₹131.7L | ₹30.0L | — | — |

## amazon — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SDE I (ord 0 → entry) | 12 / 221 | ₹35.0L | ₹25.1L | ₹8.4L | ₹1.5L | ₹27.0L (entry) | ✗ 30% |
| SDE II (ord 1 → mid) | 48 / 583 | ₹60.8L | ₹47.8L | ₹11.8L | ₹1.2L | ₹51.5L (mid) | ✓ 18% |
| SDE III (ord 2 → senior) | 10 / 108 | ₹134.4L | ₹90.4L | ₹44.0L | ₹0.0L | ₹87.5L (senior) | ✗ 54% |
| Principal SDE (ord 3 → lead) | 6 / 6 | ₹218.7L | ₹132.3L | ₹86.4L | ₹0.0L | — | — |

## amazon — product-manager (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Product Manager (ord 0 → mid) | 19 / 7 | ₹58.1L | ₹42.6L | ₹14.3L | ₹1.2L | ₹64.5L (mid) | ✓ 10% |
| Senior Product Manager (ord 1 → senior) | 10 / 51 | ₹73.9L | ₹56.1L | ₹16.9L | ₹0.9L | ₹118.5L (senior) | ✗ 38% |
| Principal Product Manager (ord 2 → lead) | 17 / 17 | ₹175.5L | ₹99.3L | ₹76.2L | ₹0.0L | ₹169.0L (lead) | ✓ 4% |

## microsoft — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SDE (ord 0 → entry) | 68 / 73 | ₹27.3L | ₹18.0L | ₹7.8L | ₹1.6L | ₹35.0L (entry) | ✗ 22% |
| 60 (ord 1 → entry) | 11 / 118 | ₹32.1L | ₹21.3L | ₹9.4L | ₹1.4L | ₹35.0L (entry) | ✓ 8% |
| SDE II (ord 2 → mid) | 46 / 203 | ₹43.5L | ₹28.4L | ₹13.2L | ₹1.9L | ₹60.0L (mid) | ✗ 28% |
| 62 (ord 3 → senior) | 13 / 140 | ₹58.1L | ₹37.7L | ₹17.4L | ₹3.0L | ₹97.5L (senior) | ✗ 40% |
| Senior SDE (ord 4 → senior) | 21 / 122 | ₹72.6L | ₹48.2L | ₹19.6L | ₹4.7L | ₹97.5L (senior) | ✗ 26% |
| 64 (ord 5 → executive) | 69 / 73 | ₹98.2L | ₹61.3L | ₹29.5L | ₹7.4L | — | — |
| Principal SDE (ord 6 → lead) | 5 / 35 | ₹137.2L | ₹77.9L | ₹46.0L | ₹13.4L | — | — |
| 66 (ord 7 → executive) | 5 / 5 | ₹184.0L | ₹83.9L | ₹86.8L | ₹13.4L | — | — |

## microsoft — product-manager (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 60 (ord 1 → entry) | 13 / 1 | ₹31.1L | ₹21.3L | ₹6.9L | ₹2.9L | ₹37.0L (entry) | ✓ 16% |
| 61 (ord 2 → mid) | 9 / 10 | ₹42.1L | ₹27.9L | ₹10.2L | ₹3.9L | ₹60.0L (mid) | ✗ 30% |
| 62 (ord 3 → senior) | 25 / 26 | ₹52.8L | ₹37.1L | ₹11.8L | ₹3.9L | ₹97.5L (senior) | ✗ 46% |
| 63 (ord 4 → lead) | 17 / 18 | ₹75.0L | ₹49.7L | ₹19.2L | ₹6.1L | — | — |
| 64 (ord 5 → executive) | 19 / 19 | ₹93.7L | ₹55.8L | ₹29.1L | ₹8.8L | — | — |
| 65 (ord 6 → executive) | 11 / 12 | ₹126.5L | ₹69.1L | ₹42.6L | ₹14.7L | — | — |
| 66 (ord 7 → executive) | 12 / 6 | ₹181.8L | ₹82.8L | ₹82.5L | ₹16.5L | — | — |
| 67 (ord 8 → executive) | 10 / 4 | ₹309.8L | ₹102.9L | ₹173.3L | ₹33.5L | — | — |

## apple — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ICT2 (ord 0 → entry) | 14 / 9 | ₹34.4L | ₹21.2L | ₹13.1L | ₹0.1L | ₹37.0L (entry) | ✓ 7% |
| ICT3 (ord 1 → mid) | 34 / 35 | ₹63.6L | ₹35.4L | ₹26.4L | ₹1.9L | ₹65.0L (mid) | ✓ 2% |
| ICT4 (ord 2 → senior) | 27 / 27 | ₹112.5L | ₹53.2L | ₹55.9L | ₹3.4L | ₹112.5L (senior) | ✓ 0% |

## adobe — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Software Engineer 1 (ord 0 → entry) | 20 / 8 | ₹24.9L | ₹17.1L | ₹5.9L | ₹1.9L | ₹30.9L (entry) | ✓ 20% |
| Software Engineer 2 (ord 1 → mid) | 33 / 34 | ₹32.5L | ₹22.1L | ₹9.2L | ₹1.3L | ₹62.5L (mid) | ✗ 48% |
| Software Engineer 3 (ord 2 → senior) | 31 / 35 | ₹53.6L | ₹34.1L | ₹16.1L | ₹3.4L | ₹102.5L (senior) | ✗ 48% |
| Software Engineer 4 (ord 3 → lead) | 50 / 51 | ₹79.2L | ₹51.3L | ₹23.7L | ₹4.2L | ₹160.0L (lead) | ✗ 50% |
| Software Engineer 5 (ord 4 → executive) | 5 / 20 | ₹119.3L | ₹73.4L | ₹35.1L | ₹10.8L | — | — |
| Software Engineer 5.5 (ord 5 → executive) | 6 / 6 | ₹176.5L | ₹100.6L | ₹59.8L | ₹16.0L | — | — |
| Principal Scientist (ord 6 → executive) | 7 / 1 | ₹240.9L | ₹115.7L | ₹93.4L | ₹31.8L | — | — |

## adobe — product-manager (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L3 (ord 2 → entry) | 15 / 2 | ₹62.4L | ₹44.4L | ₹13.2L | ₹4.7L | ₹31.1L (entry) | ✗ 101% |
| L4 (ord 3 → mid) | 14 / 1 | ₹94.7L | ₹57.5L | ₹29.1L | ₹8.2L | ₹64.2L (mid) | ✗ 48% |

## nvidia — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IC1 (ord 0 → entry) | 13 / 8 | ₹26.0L | ₹18.9L | ₹6.2L | ₹0.9L | ₹33.4L (entry) | ✗ 22% |
| IC2 (ord 1 → mid) | 17 / 8 | ₹37.9L | ₹20.9L | ₹17.1L | ₹0.0L | ₹70.0L (mid) | ✗ 46% |
| IC3 (ord 2 → senior) | 14 / 15 | ₹66.1L | ₹36.3L | ₹29.8L | ₹0.0L | ₹127.5L (senior) | ✗ 48% |
| IC4 (ord 3 → lead) | 15 / 16 | ₹87.2L | ₹47.1L | ₹40.1L | ₹0.0L | ₹200.0L (lead) | ✗ 56% |
| IC5 (ord 4 → executive) | 7 / 2 | ₹116.5L | ₹74.7L | ₹41.7L | ₹0.0L | — | — |

## oracle — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IC-1 (ord 0 → entry) | 13 / 73 | ₹20.7L | ₹15.5L | ₹5.3L | ₹0.0L | ₹28.2L (entry) | ✗ 26% |
| IC-2 (ord 1 → mid) | 14 / 162 | ₹24.4L | ₹18.3L | ₹6.0L | ₹0.2L | ₹45.0L (mid) | ✗ 46% |
| IC-3 (ord 2 → senior) | 35 / 247 | ₹44.7L | ₹31.3L | ₹13.4L | ₹0.1L | ₹72.5L (senior) | ✗ 38% |
| IC-4 (ord 3 → lead) | 13 / 100 | ₹60.4L | ₹43.1L | ₹17.2L | ₹0.0L | ₹117.5L (lead) | ✗ 49% |

## cisco — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Software Engineer 1 (ord 0 → entry) | 16 / 17 | ₹17.2L | ₹15.7L | ₹0.3L | ₹1.3L | ₹21.1L (entry) | ✓ 18% |
| Software Engineer 2 (ord 1 → mid) | 15 / 69 | ₹22.4L | ₹19.2L | ₹0.9L | ₹2.2L | ₹36.9L (mid) | ✗ 39% |
| Software Engineer III (ord 2 → senior) | 20 / 65 | ₹35.6L | ₹29.5L | ₹5.0L | ₹1.2L | ₹69.8L (senior) | ✗ 49% |
| Software Engineer IV (ord 3 → lead) | 13 / 59 | ₹46.8L | ₹36.0L | ₹8.3L | ₹2.6L | ₹108.5L (lead) | ✗ 57% |
| Technical Leader 1 (ord 4 → executive) | 16 / 18 | ₹62.6L | ₹44.7L | ₹14.1L | ₹3.8L | — | — |
| Technical Leader 2 (ord 5 → executive) | 9 / 3 | ₹111.3L | ₹65.1L | ₹35.2L | ₹11.0L | — | — |
| Principal Engineer (ord 6 → executive) | 6 / 1 | ₹138.9L | ₹84.6L | ₹36.2L | ₹18.1L | — | — |

## salesforce — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Associate MTS (ord 0 → entry) | 22 / 23 | ₹27.1L | ₹18.8L | ₹6.3L | ₹2.1L | ₹32.5L (entry) | ✓ 17% |
| MTS (ord 1 → entry) | 17 / 87 | ₹47.1L | ₹33.0L | ₹11.4L | ₹2.7L | ₹32.5L (entry) | ✗ 45% |
| Senior MTS (ord 2 → senior) | 30 / 161 | ₹76.9L | ₹55.4L | ₹15.8L | ₹5.8L | ₹102.5L (senior) | ✗ 25% |
| Lead MTS (ord 3 → senior) | 13 / 54 | ₹118.8L | ₹77.7L | ₹30.6L | ₹10.5L | ₹102.5L (senior) | ✓ 16% |
| Principal MTS (ord 4 → lead) | 6 / 18 | ₹158.5L | ₹97.2L | ₹44.9L | ₹16.5L | ₹190.0L (lead) | ✓ 17% |

## salesforce — product-manager (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Product Manager (ord 2 → mid) | 10 / 8 | ₹74.5L | ₹59.3L | ₹8.0L | ₹7.1L | ₹64.5L (mid) | ✓ 15% |
| Senior Product Manager (ord 3 → senior) | 10 / 11 | ₹103.4L | ₹75.7L | ₹17.9L | ₹9.8L | ₹118.5L (senior) | ✓ 13% |
| Director (ord 4 → executive) | 14 / 1 | ₹149.7L | ₹107.6L | ₹26.0L | ₹16.1L | ₹233.0L (executive) | ✗ 36% |
| Senior Director (ord 5 → executive) | 6 / 3 | ₹230.4L | ₹150.9L | ₹42.3L | ₹37.1L | ₹233.0L (executive) | ✓ 1% |

## target — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L4 (ord 1 → mid) | 22 / 9 | ₹20.5L | ₹20.2L | ₹0.0L | ₹0.3L | ₹39.0L (mid) | ✗ 47% |
| L5 (ord 2 → senior) | 22 / 24 | ₹39.4L | ₹34.9L | ₹2.4L | ₹2.1L | ₹66.5L (senior) | ✗ 41% |

## barclays — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BA1 (ord 0 → entry) | 5 / 3 | ₹15.3L | ₹14.8L | ₹0.0L | ₹0.4L | — | — |
| BA3 (ord 2 → entry) | 24 / 5 | ₹14.3L | ₹14.0L | ₹0.0L | ₹0.3L | — | — |
| BA4 (ord 3 → mid) | 12 / 39 | ₹15.7L | ₹15.4L | ₹0.1L | ₹0.2L | ₹36.5L (mid) | ✗ 57% |
| BA5 (ord 4 → executive) | 15 / 4 | ₹40.8L | ₹38.4L | ₹0.0L | ₹2.4L | — | — |

## atlassian — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P30 (ord 0 → entry) | 11 / 12 | ₹40.3L | ₹27.8L | ₹11.0L | ₹1.4L | ₹42.0L (entry) | ✓ 4% |
| P40 (ord 1 → mid) | 21 / 75 | ₹64.1L | ₹44.6L | ₹14.1L | ₹5.4L | ₹75.0L (mid) | ✓ 14% |
| P50 (ord 2 → senior) | 25 / 94 | ₹100.3L | ₹66.4L | ₹26.9L | ₹7.0L | ₹120.0L (senior) | ✓ 16% |
| P60 (ord 3 → lead) | 8 / 29 | ₹173.7L | ₹100.4L | ₹54.6L | ₹18.7L | ₹160.0L (lead) | ✓ 9% |

## vmware — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MTS 1 (ord 0 → entry) | 11 / 0 | ₹23.9L | ₹16.3L | ₹6.9L | ₹0.7L | ₹23.0L (entry) | ✓ 4% |
| MTS 2 (ord 1 → mid) | 11 / 2 | ₹38.8L | ₹25.2L | ₹11.9L | ₹1.7L | ₹41.0L (mid) | ✓ 5% |
| MTS 3 (ord 2 → senior) | 27 / 6 | ₹53.7L | ₹35.9L | ₹15.1L | ₹2.7L | ₹64.0L (senior) | ✓ 16% |
| Senior MTS (ord 3 → lead) | 23 / 4 | ₹88.9L | ₹51.6L | ₹31.1L | ₹6.2L | — | — |
| Staff Engineer 1 (ord 4 → executive) | 59 / 1 | ₹92.4L | ₹66.8L | ₹16.8L | ₹8.8L | — | — |
| Staff Engineer 2 (ord 5 → executive) | 11 / 0 | ₹154.9L | ₹96.1L | ₹40.5L | ₹18.3L | — | — |

## servicenow — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IC1 (ord 0 → entry) | 10 / 10 | ₹28.3L | ₹16.4L | ₹10.9L | ₹1.0L | ₹32.2L (entry) | ✓ 12% |
| IC2 (ord 1 → mid) | 14 / 56 | ₹36.6L | ₹23.7L | ₹11.7L | ₹1.2L | ₹49.0L (mid) | ✗ 25% |
| IC3 (ord 2 → senior) | 12 / 45 | ₹55.3L | ₹34.1L | ₹18.1L | ₹3.1L | ₹85.0L (senior) | ✗ 35% |
| IC4 (ord 3 → lead) | 7 / 18 | ₹87.2L | ₹52.3L | ₹29.1L | ₹5.7L | ₹132.5L (lead) | ✗ 34% |
| IC5 (ord 4 → executive) | 5 / 5 | ₹122.2L | ₹62.3L | ₹45.8L | ₹14.0L | — | — |

## walmart — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P2 (ord 0 → entry) | 31 / 36 | ₹21.6L | ₹19.4L | ₹1.1L | ₹1.1L | ₹26.9L (entry) | ✓ 20% |
| P3 (ord 1 → mid) | 12 / 176 | ₹35.9L | ₹25.3L | ₹6.9L | ₹3.7L | ₹42.5L (mid) | ✓ 15% |
| Senior SWE (ord 2 → senior) | 10 / 160 | ₹56.9L | ₹41.4L | ₹8.9L | ₹6.5L | ₹77.5L (senior) | ✗ 27% |
| P4 (ord 3 → lead) | 11 / 68 | ₹85.1L | ₹48.5L | ₹25.3L | ₹11.3L | ₹145.0L (lead) | ✗ 41% |
| Principal SWE (ord 4 → executive) | 10 / 10 | ₹124.2L | ₹74.2L | ₹31.8L | ₹18.2L | — | — |

## walmart — product-manager (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P3 (ord 2 → senior) | 5 / 3 | ₹39.8L | ₹30.5L | ₹4.8L | ₹4.5L | ₹109.5L (senior) | ✗ 64% |
| P4 (ord 3 → lead) | 10 / 11 | ₹57.3L | ₹43.4L | ₹7.3L | ₹6.6L | ₹156.5L (lead) | ✗ 63% |
| P5 (ord 4 → executive) | 11 / 12 | ₹106.5L | ₹62.4L | ₹30.3L | ₹13.9L | ₹216.0L (executive) | ✗ 51% |
| P6 (ord 5 → executive) | 5 / 5 | ₹140.1L | ₹83.5L | ₹33.9L | ₹22.7L | ₹216.0L (executive) | ✗ 35% |

## linkedin — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Apprentice Software Engineer (ord 0 → entry) | 7 / 0 | ₹45.3L | ₹27.0L | ₹16.9L | ₹1.4L | ₹35.0L (entry) | ✗ 29% |
| Software Engineer (ord 1 → mid) | 31 / 31 | ₹60.2L | ₹36.7L | ₹21.1L | ₹2.4L | ₹65.0L (mid) | ✓ 7% |
| Senior Software Engineer (ord 2 → mid) | 37 / 38 | ₹99.0L | ₹55.7L | ₹39.5L | ₹3.9L | ₹65.0L (mid) | ✗ 52% |
| Staff Software Engineer (ord 3 → senior) | 12 / 12 | ₹172.0L | ₹79.8L | ₹81.5L | ₹10.7L | ₹105.0L (senior) | ✗ 64% |
| Senior Staff Software Engineer (ord 4 → lead) | 6 / 0 | ₹204.2L | ₹104.2L | ₹89.9L | ₹10.1L | — | — |

## uber — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Software Engineer I (ord 0 → entry) | 9 / 20 | ₹36.2L | ₹27.1L | ₹7.7L | ₹1.5L | ₹36.0L (entry) | ✓ 1% |
| Software Engineer II (ord 1 → mid) | 18 / 74 | ₹70.7L | ₹47.0L | ₹19.2L | ₹4.5L | ₹65.0L (mid) | ✓ 9% |
| Senior Software Engineer (ord 2 → senior) | 18 / 61 | ₹128.9L | ₹72.2L | ₹46.5L | ₹10.3L | ₹105.0L (senior) | ✗ 23% |
| Staff Software Engineer (ord 3 → lead) | 13 / 13 | ₹215.0L | ₹97.9L | ₹103.4L | ₹13.7L | — | — |
| Senior Staff Software Engineer (ord 4 → executive) | 7 / 0 | ₹255.3L | ₹146.0L | ₹85.6L | ₹23.7L | — | — |

## uber — product-manager (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Product Manager II (ord 2 → mid) | 10 / 10 | ₹75.6L | ₹51.6L | ₹16.6L | ₹7.4L | ₹74.0L (mid) | ✓ 2% |
| Senior Product Manager (ord 3 → senior) | 11 / 5 | ₹113.7L | ₹72.5L | ₹30.8L | ₹10.4L | ₹136.0L (senior) | ✓ 16% |
| Lead Product Manager (ord 4 → executive) | 7 / 0 | ₹173.6L | ₹98.1L | ₹61.9L | ₹13.6L | ₹267.5L (executive) | ✗ 35% |
| Group Product Manager (ord 5 → executive) | 5 / 0 | ₹195.0L | ₹134.9L | ₹41.2L | ₹18.9L | ₹267.5L (executive) | ✗ 27% |

## stripe — software-engineer (fx=91.55 INR/USD)

| Level | n / c12 | LF mean total | LF base | LF stock | LF bonus | Curator (closest tier) | Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 (ord 0 → entry) | 11 / 8 | ₹54.2L | ₹30.0L | ₹20.6L | ₹3.6L | ₹40.0L (entry) | ✗ 35% |
| L2 (ord 1 → mid) | 16 / 18 | ₹94.6L | ₹52.1L | ₹37.5L | ₹4.9L | ₹67.5L (mid) | ✗ 40% |
| L3 (ord 2 → senior) | 11 / 11 | ₹152.9L | ₹72.5L | ₹71.2L | ₹9.2L | ₹112.5L (senior) | ✗ 36% |
| L4 (ord 3 → lead) | 6 / 1 | ₹247.7L | ₹119.7L | ₹103.8L | ₹24.2L | — | — |

---

## Summary

- Targets fetched: 25 / 25 (0 missing on LF)
- Cells compared: 87
- Agree (±20%): 34 / 87 (39%)
- No curator entry to compare: 29