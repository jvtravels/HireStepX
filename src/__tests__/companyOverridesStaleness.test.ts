import { describe, it, expect } from "vitest";
import { COMPANY_SALARY_OVERRIDES } from "../../data/company-salary-overrides";

/* Staleness CI gate. Indian salary bands shift quarterly — a 2-yr-old
 * "verified ₹30 LPA" entry will be 20-30% off reality. Fail the build if
 * any override is older than the limit, forcing the team to refresh.
 *
 * Tighten the gate over time as the override count grows and the team
 * develops a refresh cadence. Initial gate is generous (18 months) so
 * the existing dataset doesn't immediately break CI on first deploy. */

const MAX_OVERRIDE_AGE_DAYS = 540; // 18 months
const TODAY = new Date();

function ageDays(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return Infinity;
  return (TODAY.getTime() - t) / 86400000;
}

interface OverrideLevel {
  lastVerified?: string;
  source?: string;
  sourceVerifiedAt?: Record<string, string | undefined>;
}

interface Walk { company: string; role: string; level: string; entry: OverrideLevel }

function* walkOverrides(): Generator<Walk> {
  for (const [company, roles] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
    if (!roles || typeof roles !== "object") continue;
    for (const [role, levels] of Object.entries(roles as Record<string, unknown>)) {
      if (!levels || typeof levels !== "object") continue;
      for (const [level, entry] of Object.entries(levels as Record<string, unknown>)) {
        if (!entry || typeof entry !== "object") continue;
        yield { company, role, level, entry: entry as OverrideLevel };
      }
    }
  }
}

describe("Salary override freshness", () => {
  it("every override has a parsable lastVerified date", () => {
    const offenders: string[] = [];
    for (const { company, role, level, entry } of walkOverrides()) {
      if (!entry.lastVerified) {
        offenders.push(`${company} / ${role} / ${level}: missing lastVerified`);
        continue;
      }
      const t = new Date(entry.lastVerified).getTime();
      if (!Number.isFinite(t)) {
        offenders.push(`${company} / ${role} / ${level}: unparseable lastVerified="${entry.lastVerified}"`);
      }
    }
    expect(offenders, offenders.slice(0, 10).join("\n")).toEqual([]);
  });

  it(`no override is older than ${MAX_OVERRIDE_AGE_DAYS} days`, () => {
    const stale: { key: string; ageDays: number }[] = [];
    for (const { company, role, level, entry } of walkOverrides()) {
      if (!entry.lastVerified) continue;
      const age = ageDays(entry.lastVerified);
      if (age > MAX_OVERRIDE_AGE_DAYS) {
        stale.push({ key: `${company} / ${role} / ${level}`, ageDays: Math.round(age) });
      }
    }
    if (stale.length > 0) {
      const msg = stale
        .sort((a, b) => b.ageDays - a.ageDays)
        .slice(0, 20)
        .map(s => `  ${s.key} — ${s.ageDays}d old`)
        .join("\n");
      throw new Error(
        `${stale.length} salary overrides exceed ${MAX_OVERRIDE_AGE_DAYS}-day staleness gate.\n` +
        `Top offenders:\n${msg}\n\n` +
        `Refresh by re-checking against Levels.fyi / AmbitionBox / Glassdoor and bumping lastVerified.`,
      );
    }
    expect(stale).toEqual([]);
  });

  it("every override declares a source string", () => {
    const offenders: string[] = [];
    for (const { company, role, level, entry } of walkOverrides()) {
      if (!entry.source || typeof entry.source !== "string" || entry.source.trim().length === 0) {
        offenders.push(`${company} / ${role} / ${level}`);
      }
    }
    expect(offenders, `Overrides missing source attribution:\n${offenders.slice(0, 10).join("\n")}`).toEqual([]);
  });
});
