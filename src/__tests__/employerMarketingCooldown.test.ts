import { describe, it, expect, vi } from "vitest";
import {
  claimMarketingCooldown,
  releaseMarketingCooldown,
  marketingCooldownKey,
  MARKETING_COOLDOWN_SECONDS,
} from "../../server-handlers/_employer-marketing-cooldown";

describe("marketing cooldown", () => {
  it("claims with an atomic SET NX EX on a per-employer key", async () => {
    const pipe = vi.fn(async () => ["OK"]);
    expect(await claimMarketingCooldown(pipe, "emp1")).toBe("claimed");
    const cmd = (pipe.mock.calls[0] as unknown[])[0] as Array<Array<string | number>>;
    expect(cmd[0].slice(0, 2)).toEqual(["SET", marketingCooldownKey("emp1")]);
    expect(cmd[0].slice(3)).toEqual(["EX", MARKETING_COOLDOWN_SECONDS, "NX"]);
  });

  it("reports cooling when the key already exists (SET NX returns null)", async () => {
    expect(await claimMarketingCooldown(async () => [null], "emp1")).toBe("cooling");
  });

  it("fails closed: Redis unavailable is its own state so callers skip the send", async () => {
    expect(await claimMarketingCooldown(async () => null, "emp1")).toBe("unavailable");
  });

  it("release deletes the key and swallows errors", async () => {
    const pipe = vi.fn(async () => [1]);
    await releaseMarketingCooldown(pipe, "emp1");
    expect((pipe.mock.calls[0] as unknown[])[0]).toEqual([["DEL", marketingCooldownKey("emp1")]]);
    await expect(releaseMarketingCooldown(async () => { throw new Error("down"); }, "emp1")).resolves.toBeUndefined();
  });
});
