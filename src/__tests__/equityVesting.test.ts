import { describe, it, expect } from "vitest";
import {
  extractEquityVesting,
  mergeEquityVesting,
} from "../../server-handlers/_equity-vesting";

describe("extractEquityVesting — vesting years", () => {
  it("extracts '4 year vesting'", () => {
    expect(extractEquityVesting("4 year vesting").vestingYears).toBe(4);
  });

  it("extracts 'vesting over 5 years'", () => {
    expect(extractEquityVesting("vesting over 5 years").vestingYears).toBe(5);
  });

  it("rejects out-of-range vesting (15 yrs)", () => {
    expect(extractEquityVesting("15 year vesting").vestingYears).toBe(null);
  });
});

describe("extractEquityVesting — cliff", () => {
  it("extracts '12 month cliff'", () => {
    expect(extractEquityVesting("12 month cliff").cliffMonths).toBe(12);
  });

  it("extracts 'cliff of 6 months'", () => {
    expect(extractEquityVesting("cliff of 6 months").cliffMonths).toBe(6);
  });

  it("converts '1-year cliff' to 12 months", () => {
    expect(extractEquityVesting("1-year cliff").cliffMonths).toBe(12);
  });

  it("handles '0 month cliff'", () => {
    expect(extractEquityVesting("0 month cliff").cliffMonths).toBe(0);
  });
});

describe("extractEquityVesting — preference", () => {
  it("detects cash-pref", () => {
    expect(extractEquityVesting("I prefer cash over equity").preference).toBe("cash-pref");
  });

  it("detects equity-pref via 'lower fixed for stronger equity'", () => {
    expect(extractEquityVesting("lower fixed for stronger equity").preference).toBe("equity-pref");
  });

  it("detects mixed-pref", () => {
    expect(extractEquityVesting("a balanced mix of cash and equity").preference).toBe("mixed-pref");
  });
});

describe("extractEquityVesting — familiarity", () => {
  it("detects experienced", () => {
    expect(extractEquityVesting("I've had ESOPs before").familiarity).toBe("experienced");
  });

  it("detects novice", () => {
    expect(extractEquityVesting("never had equity").familiarity).toBe("novice");
  });
});

describe("extractEquityVesting — hasAny", () => {
  it("false on empty", () => {
    expect(extractEquityVesting("").hasAny).toBe(false);
  });

  it("false when no cues", () => {
    expect(extractEquityVesting("hello there").hasAny).toBe(false);
  });

  it("true when vesting detected", () => {
    expect(extractEquityVesting("4 year vesting").hasAny).toBe(true);
  });
});

describe("mergeEquityVesting", () => {
  it("non-null overrides prior", () => {
    const prior = extractEquityVesting("4 year vesting");
    const next = extractEquityVesting("5 year vesting");
    expect(mergeEquityVesting(prior, next).vestingYears).toBe(5);
  });

  it("null preserves prior", () => {
    const prior = extractEquityVesting("4 year vesting");
    const next = extractEquityVesting("I prefer cash over equity");
    const m = mergeEquityVesting(prior, next);
    expect(m.vestingYears).toBe(4);
    expect(m.preference).toBe("cash-pref");
  });

  it("handles null prior", () => {
    const next = extractEquityVesting("4 year vesting");
    expect(mergeEquityVesting(null, next).vestingYears).toBe(4);
  });
});
