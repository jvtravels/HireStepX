import { describe, it, expect } from "vitest";
import { computeFocusRounds, roundOf, roundStatusByLabel } from "../focusRounds";

const s = (date: string, score: number, type: string, focus?: string) => ({ date, score, type, focus });
const byKey = (rounds: ReturnType<typeof computeFocusRounds>, key: string) => rounds.find((r) => r.key === key)!;

describe("roundOf", () => {
  it("reads HR and campus from focus because both are stored as type behavioral", () => {
    expect(roundOf({ type: "behavioral", focus: "hr-round" })).toBe("hr-round");
    expect(roundOf({ type: "behavioral", focus: "campus-placement" })).toBe("campus-placement");
    expect(roundOf({ type: "behavioral", focus: null })).toBe("behavioral");
  });
  it("recognises the dedicated hr type and negotiation by either field", () => {
    expect(roundOf({ type: "hr-round" })).toBe("hr-round");
    expect(roundOf({ type: "salary-negotiation" })).toBe("salary-negotiation");
    expect(roundOf({ type: "behavioral", focus: "salary-negotiation" })).toBe("salary-negotiation");
  });
  it("ignores focuses that are not live", () => {
    expect(roundOf({ type: "technical" })).toBeNull();
  });
});

describe("computeFocusRounds", () => {
  it("returns all four rounds, not started with no sessions", () => {
    const rounds = computeFocusRounds([]);
    expect(rounds.map((r) => r.key)).toEqual(["behavioral", "hr-round", "campus-placement", "salary-negotiation"]);
    expect(rounds.every((r) => r.status === "not_started" && r.best === null && r.clearedAt === null)).toBe(true);
  });
  it("is practising until two sessions reach 70", () => {
    const r = byKey(computeFocusRounds([s("2026-01-01", 82, "behavioral"), s("2026-01-02", 55, "behavioral")]), "behavioral");
    expect(r).toMatchObject({ status: "practising", attempts: 2, best: 82, qualifying: 1, clearedAt: null });
  });
  it("clears on the second session at 70+ and dates the clear by that session", () => {
    const r = byKey(
      computeFocusRounds([s("2026-03-01", 90, "behavioral", "hr-round"), s("2026-01-01", 71, "behavioral", "hr-round"), s("2026-02-01", 40, "behavioral", "hr-round")]),
      "hr-round",
    );
    expect(r).toMatchObject({ status: "cleared", qualifying: 2, best: 90, clearedAt: "2026-03-01" });
  });
  it("keeps rounds independent", () => {
    const rounds = computeFocusRounds([s("2026-01-01", 80, "behavioral", "campus-placement"), s("2026-01-02", 80, "behavioral")]);
    expect(byKey(rounds, "campus-placement").attempts).toBe(1);
    expect(byKey(rounds, "behavioral").attempts).toBe(1);
  });
  it("skips ungraded sessions", () => {
    expect(byKey(computeFocusRounds([s("2026-01-01", 0, "behavioral"), s("2026-01-02", Number.NaN, "behavioral")]), "behavioral").status).toBe("not_started");
  });
});

describe("roundStatusByLabel", () => {
  it("keys status by the focus label the setup picker uses", () => {
    expect(roundStatusByLabel(computeFocusRounds([]))["HR Round"]).toBe("not_started");
    expect(roundStatusByLabel(undefined)).toEqual({});
  });
});
