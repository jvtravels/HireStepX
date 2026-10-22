import { describe, it, expect, beforeEach, vi } from "vitest";
import { resolveFlag, remoteKeyFor, isFlagName, hashPercent } from "../featureFlagRegistry";
import { isEnabled, overrideFlag, clearOverrides, setFlagProvider } from "../featureFlags";
import { isServerFlagEnabled, parseEnvFlag, _clearFlagCache, type ServerFlagDeps } from "../../server-handlers/_feature-flags";

describe("featureFlagRegistry", () => {
  it("resolves override > remote > default", () => {
    expect(resolveFlag("SALARY_NEGOTIATION_MODE", {})).toBe(true);
    expect(resolveFlag("SALARY_NEGOTIATION_MODE", { remote: false })).toBe(false);
    expect(resolveFlag("SALARY_NEGOTIATION_MODE", { remote: false, override: true })).toBe(true);
  });

  it("maps flag names to kebab-case remote keys", () => {
    expect(remoteKeyFor("SALARY_NEGOTIATION_MODE")).toBe("salary-negotiation-mode");
  });

  it("narrows only declared flag names", () => {
    expect(isFlagName("SALARY_NEGOTIATION_MODE")).toBe(true);
    expect(isFlagName("HOMEPAGE_V2")).toBe(false);
  });

  it("hashPercent is deterministic and in range", () => {
    expect(hashPercent("abc")).toBe(hashPercent("abc"));
    for (const s of ["a", "user-1", "user-2xyz"]) {
      const p = hashPercent(s);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(100);
    }
  });
});

describe("client isEnabled", () => {
  beforeEach(() => {
    clearOverrides();
    setFlagProvider({ get: () => undefined });
  });

  it("falls back to the code default when the provider has no value", () => {
    expect(isEnabled("SALARY_NEGOTIATION_MODE")).toBe(true);
  });

  it("honors the remote provider (kill switch without deploy)", () => {
    const get = vi.fn(() => false);
    setFlagProvider({ get });
    expect(isEnabled("SALARY_NEGOTIATION_MODE")).toBe(false);
    expect(get).toHaveBeenCalledWith("salary-negotiation-mode");
  });

  it("localStorage override beats remote", () => {
    setFlagProvider({ get: () => false });
    overrideFlag("SALARY_NEGOTIATION_MODE", true);
    expect(isEnabled("SALARY_NEGOTIATION_MODE")).toBe(true);
  });

  it("a throwing provider never breaks the UI", () => {
    setFlagProvider({ get: () => { throw new Error("boom"); } });
    expect(isEnabled("SALARY_NEGOTIATION_MODE")).toBe(true);
  });

  it("ignores overrides for undeclared flags", () => {
    overrideFlag("NOT_A_FLAG", true);
    expect(localStorage.getItem("hirestepx_ff_NOT_A_FLAG")).toBeNull();
  });
});

describe("server isServerFlagEnabled", () => {
  let now = 0;
  const deps = (env: Record<string, string | undefined>, remote: ServerFlagDeps["remote"]): ServerFlagDeps =>
    ({ env, remote, now: () => now });

  beforeEach(() => {
    _clearFlagCache();
    now = 1_000;
  });

  it("parses env switches", () => {
    expect(parseEnvFlag("off")).toBe(false);
    expect(parseEnvFlag(" ON ")).toBe(true);
    expect(parseEnvFlag("0")).toBe(false);
    expect(parseEnvFlag("maybe")).toBeUndefined();
    expect(parseEnvFlag(undefined)).toBeUndefined();
  });

  it("env override wins and skips the remote call", async () => {
    const remote = vi.fn(async () => true);
    expect(await isServerFlagEnabled("SALARY_NEGOTIATION_MODE", "u1", deps({ FF_SALARY_NEGOTIATION_MODE: "off" }, remote))).toBe(false);
    expect(remote).not.toHaveBeenCalled();
  });

  it("uses the remote value and falls back to default when undefined", async () => {
    expect(await isServerFlagEnabled("SALARY_NEGOTIATION_MODE", "u1", deps({}, async () => false))).toBe(false);
    _clearFlagCache();
    expect(await isServerFlagEnabled("SALARY_NEGOTIATION_MODE", "u1", deps({}, async () => undefined))).toBe(true);
  });

  it("global flags share one cached remote lookup across users until TTL", async () => {
    const remote = vi.fn(async () => false);
    const d = deps({}, remote);
    await isServerFlagEnabled("SALARY_NEGOTIATION_MODE", "u1", d);
    await isServerFlagEnabled("SALARY_NEGOTIATION_MODE", "u2", d);
    expect(remote).toHaveBeenCalledTimes(1);
    expect(remote).toHaveBeenCalledWith("salary-negotiation-mode", "hirestepx-server");
    now += 61_000;
    await isServerFlagEnabled("SALARY_NEGOTIATION_MODE", "u1", d);
    expect(remote).toHaveBeenCalledTimes(2);
  });
});
