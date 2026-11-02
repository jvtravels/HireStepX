import { describe, it, expect } from "vitest";
import { resolveAccountHome } from "../auth/accountHome";

function api(profile: unknown, invites: unknown, opts: { profileFails?: boolean; invitesFail?: boolean } = {}) {
  return async (url: string) => {
    if (url.includes("employer-profile")) {
      if (opts.profileFails) throw new Error("net");
      return new Response(JSON.stringify(profile));
    }
    if (opts.invitesFail) return new Response("{}", { status: 500 });
    return new Response(JSON.stringify(invites));
  };
}

describe("resolveAccountHome", () => {
  it("sends an account with a company to the employer console", async () => {
    expect(await resolveAccountHome("t", api({ status: "approved" }, { invites: [] }))).toBe("/employer");
  });
  it("sends an invitee with no company there too", async () => {
    expect(await resolveAccountHome("t", api({ status: "none" }, { invites: [{ id: "i" }] }))).toBe("/employer");
  });
  it("leaves a plain candidate on the candidate redirect", async () => {
    expect(await resolveAccountHome("t", api({ status: "none" }, { invites: [] }))).toBeNull();
  });
  it("falls back to candidate when a lookup fails, but still honours the other", async () => {
    expect(await resolveAccountHome("t", api(null, { invites: [] }, { profileFails: true }))).toBeNull();
    expect(await resolveAccountHome("t", api({ status: "none" }, null, { invitesFail: true }))).toBeNull();
    expect(await resolveAccountHome("t", api(null, { invites: [{ id: "i" }] }, { profileFails: true }))).toBe("/employer");
  });
});
