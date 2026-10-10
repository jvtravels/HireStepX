# Service level objectives

Targets, not yet measured over a full window. The measurement source for each
is named so the first monthly review can fill in actuals.

| SLO | Target | Measured by |
|---|---|---|
| Availability of hirestepx.com, app login, `/api/health` | 99.5% / 30 days | `.github/workflows/uptime-monitor.yml` (5-min probe; outage issues give downtime) |
| Interview session save success | 99% | PostHog `client_error` + `/api/sessions/save` error rate |
| Report generation success | 98% | PostHog alert on evaluate-session failures |
| Mobile Lighthouse performance (home) | ≥ 70 now, ratchet up | `.github/workflows/lighthouse.yml` (weekly) |

Error budget: 99.5% over 30 days is about 3h 36m of downtime. If the budget is
spent, pause feature work until reliability items from the latest postmortem ship.
