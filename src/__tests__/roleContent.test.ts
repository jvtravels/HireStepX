import { describe, it, expect, vi, afterEach } from "vitest";
import { loadRoleCompetency, loadCompanyGuidance } from "../../server-handlers/_role-content";

describe("loadRoleCompetency / loadCompanyGuidance", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when the slug is empty", async () => {
    expect(await loadRoleCompetency("")).toBeNull();
  });

  it("returns null when Supabase env vars aren't configured (no fetch call)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    // SUPABASE_URL/SERVICE_KEY aren't set in the test env, so this must
    // short-circuit before ever calling fetch.
    expect(await loadCompanyGuidance("acme-corp")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
