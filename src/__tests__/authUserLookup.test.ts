import { describe, it, expect, vi } from "vitest";
import {
  findAuthUserByEmail,
  isEmailVerified,
  isOAuthOnlyUser,
  normalizeAuthEmail,
  type AdminAuthUser,
} from "../../server-handlers/_auth-user-lookup";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("normalizeAuthEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeAuthEmail("  Bob@Example.COM ")).toBe("bob@example.com");
  });
  it.each([undefined, null, 42, "", "nope", "a@b", "a..b@example.com", `${"a".repeat(250)}@x.com`])(
    "rejects %s",
    (v) => expect(normalizeAuthEmail(v)).toBeNull(),
  );
});

describe("findAuthUserByEmail", () => {
  const users = [
    { id: "1", email: "abob@example.com" },
    { id: "2", email: "Bob@Example.com" },
    { id: "3", email: "bob@example.com.au" },
  ];

  it("requires exact case-insensitive equality, not a substring hit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ users }));
    const r = await findAuthUserByEmail("https://s.test", "key", "bob@example.com", fetchImpl);
    expect(r).toEqual({ ok: true, user: users[1] });
  });

  it("returns user:null when only superstrings match", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ users: [users[0], users[2]] }));
    expect(await findAuthUserByEmail("https://s.test", "key", "bob@example.com", fetchImpl)).toEqual({ ok: true, user: null });
  });

  it("asks for a wide page so superstring accounts cannot hide the real one", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ users: [] }));
    await findAuthUserByEmail("https://s.test", "key", "bob@example.com", fetchImpl);
    const url = String(fetchImpl.mock.calls[0][0]);
    expect(url).toContain("filter=bob%40example.com");
    expect(url).toContain("per_page=50");
  });

  it("reports ok:false (not 'no account') when the lookup fails", async () => {
    expect(await findAuthUserByEmail("u", "k", "a@b.co", vi.fn().mockResolvedValue(json({}, 500)))).toEqual({ ok: false });
    expect(await findAuthUserByEmail("u", "k", "a@b.co", vi.fn().mockRejectedValue(new Error("net")))).toEqual({ ok: false });
  });
});

describe("isEmailVerified", () => {
  it("accepts either the custom flag or email_confirmed_at", () => {
    expect(isEmailVerified({ id: "1", user_metadata: { custom_email_verified: true } })).toBe(true);
    expect(isEmailVerified({ id: "1", email_confirmed_at: "2026-01-01T00:00:00Z" })).toBe(true);
    expect(isEmailVerified({ id: "1", user_metadata: { custom_email_verified: false } })).toBe(false);
  });
});

describe("isOAuthOnlyUser", () => {
  const u = (app_metadata: AdminAuthUser["app_metadata"]): AdminAuthUser => ({ id: "1", app_metadata });
  it("is true when no email provider is present", () => {
    expect(isOAuthOnlyUser(u({ provider: "google", providers: ["google"] }))).toBe(true);
    expect(isOAuthOnlyUser(u({ provider: "google" }))).toBe(true);
  });
  it("is false for password or mixed accounts and when unknown", () => {
    expect(isOAuthOnlyUser(u({ provider: "email", providers: ["email"] }))).toBe(false);
    expect(isOAuthOnlyUser(u({ providers: ["google", "email"] }))).toBe(false);
    expect(isOAuthOnlyUser({ id: "1" })).toBe(false);
  });
});
