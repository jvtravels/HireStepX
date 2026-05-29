/* Session Report fixtures.
 *
 * Realistic example inputs the storybook / canvas can mount against
 * without having to spin up the full session pipeline. Pure data only.
 *
 * Keep numbers grounded — these get screenshot into design reviews and
 * the numbers themselves shape the conversation. */

import type { OfferNetValueInput } from "./derivations/offerNetValue";
import type { SkillProgressPoint } from "./progressTracking";

/* Mid-senior MNC India offer — 32 LPA base + 6 LPA target variable +
 * 8 LPA joining bonus on a 24-month clawback (per
 * `clawbackForCompany` ladder for `big-tech` / `gcc` / `faang` tiers
 * in server-handlers/_joining-bonus-clawback.ts). The 8L joining
 * bonus on a 24mo full-on-early-exit window is the worst-case
 * asterisk shape — exactly the one the panel exists to surface. */
export const offerNetValueFixture: OfferNetValueInput = {
  baseLpa: 32,
  variableAtTargetLpa: 6,
  joiningBonusLpa: 8,
  clawbackWindowMonths: 24,
  company: "Microsoft IDC",
};

/* Skill-progress history — 4 sessions across 5 negotiation skills.
 * Mid-senior IC negotiating fintech / saas offers. Numbers chosen to
 * show a realistic mix: clear improvement on Anchoring (the user
 * coached on it), regression on ESOPs (new topic in s3 they fumbled),
 * volatility on Concessions, sideways drift on Silence Discipline,
 * and a slow climb on Reverse Interview. Reads honestly in screenshots
 * and exercises every trend branch (up / down / flat) in the panel. */
const DAY = 24 * 60 * 60 * 1000;
const t0 = Date.UTC(2026, 3, 1); // 2026-04-01

export const progressHistoryFixture: SkillProgressPoint[] = [
  // ── Session 1 (2026-04-01) — first crack, weak baseline. ──
  { skill: "Anchoring",         scorePct: 42, sessionId: "s1", completedAt: t0,           sector: "fintech" },
  { skill: "ESOPs",             scorePct: 71, sessionId: "s1", completedAt: t0,           sector: "fintech" },
  { skill: "Concessions",       scorePct: 55, sessionId: "s1", completedAt: t0,           sector: "fintech" },
  { skill: "Silence Discipline", scorePct: 60, sessionId: "s1", completedAt: t0,          sector: "fintech" },
  { skill: "Reverse Interview", scorePct: 48, sessionId: "s1", completedAt: t0,           sector: "fintech" },

  // ── Session 2 (~1 week later) — early gains on Anchoring after drill. ──
  { skill: "Anchoring",         scorePct: 51, sessionId: "s2", completedAt: t0 + 7 * DAY, sector: "saas" },
  { skill: "ESOPs",             scorePct: 68, sessionId: "s2", completedAt: t0 + 7 * DAY, sector: "saas" },
  { skill: "Concessions",       scorePct: 62, sessionId: "s2", completedAt: t0 + 7 * DAY, sector: "saas" },
  { skill: "Silence Discipline", scorePct: 58, sessionId: "s2", completedAt: t0 + 7 * DAY, sector: "saas" },
  { skill: "Reverse Interview", scorePct: 54, sessionId: "s2", completedAt: t0 + 7 * DAY, sector: "saas" },

  // ── Session 3 (~2 weeks in) — ESOP topic introduced, score craters. ──
  { skill: "Anchoring",         scorePct: 64, sessionId: "s3", completedAt: t0 + 14 * DAY, sector: "fintech" },
  { skill: "ESOPs",             scorePct: 52, sessionId: "s3", completedAt: t0 + 14 * DAY, sector: "fintech" },
  { skill: "Concessions",       scorePct: 48, sessionId: "s3", completedAt: t0 + 14 * DAY, sector: "fintech" },
  { skill: "Silence Discipline", scorePct: 61, sessionId: "s3", completedAt: t0 + 14 * DAY, sector: "fintech" },
  { skill: "Reverse Interview", scorePct: 59, sessionId: "s3", completedAt: t0 + 14 * DAY, sector: "fintech" },

  // ── Session 4 (~3 weeks in) — current session being reported on. ──
  { skill: "Anchoring",         scorePct: 73, sessionId: "s4", completedAt: t0 + 21 * DAY, sector: "saas" },
  { skill: "ESOPs",             scorePct: 49, sessionId: "s4", completedAt: t0 + 21 * DAY, sector: "saas" },
  { skill: "Concessions",       scorePct: 64, sessionId: "s4", completedAt: t0 + 21 * DAY, sector: "saas" },
  { skill: "Silence Discipline", scorePct: 60, sessionId: "s4", completedAt: t0 + 21 * DAY, sector: "saas" },
  { skill: "Reverse Interview", scorePct: 66, sessionId: "s4", completedAt: t0 + 21 * DAY, sector: "saas" },
];
