import { describe, it, expect, vi, beforeEach } from "vitest";
import { teamsEnabledFor, parsePilotCompanies } from "../../server-handlers/_employer-team-gate";
import { FLAGS } from "../featureFlagRegistry";

const COMPANY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

describe("EMPLOYER_TEAMS flag defaults", () => {
  it("ships dark: off by default and evaluated per company", () => {
    expect(FLAGS.EMPLOYER_TEAMS.enabled).toBe(false);
    expect(FLAGS.EMPLOYER_TEAMS.scope).toBe("user");
  });
});

describe("parsePilotCompanies", () => {
  it("splits, trims, lowercases and drops blanks", () => {
    expect([...parsePilotCompanies(` ${COMPANY.toUpperCase()} , ,${OTHER}`)]).toEqual([COMPANY, OTHER]);
    expect(parsePilotCompanies(undefined).size).toBe(0);
  });
});

describe("teamsEnabledFor", () => {
  const flag = vi.fn<(id: string) => Promise<boolean>>();
  beforeEach(() => { flag.mockReset(); flag.mockResolvedValue(false); });

  it("falls through to the flag chain when nothing else applies", async () => {
    expect(await teamsEnabledFor(COMPANY, { env: {}, flag })).toBe(false);
    flag.mockResolvedValue(true);
    expect(await teamsEnabledFor(COMPANY, { env: {}, flag })).toBe(true);
    expect(flag).toHaveBeenCalledWith(COMPANY);
  });

  it("enables only allowlisted pilot companies, case-insensitively", async () => {
    const env = { EMPLOYER_TEAMS_COMPANIES: COMPANY.toUpperCase() };
    expect(await teamsEnabledFor(COMPANY, { env, flag })).toBe(true);
    expect(await teamsEnabledFor(OTHER, { env, flag })).toBe(false);
  });

  it("FF_EMPLOYER_TEAMS=off kills the feature even for pilot companies and a true flag", async () => {
    flag.mockResolvedValue(true);
    const env = { FF_EMPLOYER_TEAMS: "off", EMPLOYER_TEAMS_COMPANIES: COMPANY };
    expect(await teamsEnabledFor(COMPANY, { env, flag })).toBe(false);
    expect(flag).not.toHaveBeenCalled();
  });

  it("FF_EMPLOYER_TEAMS=on turns it on for everyone via the flag chain", async () => {
    flag.mockResolvedValue(true);
    expect(await teamsEnabledFor(OTHER, { env: { FF_EMPLOYER_TEAMS: "on" }, flag })).toBe(true);
  });
});
