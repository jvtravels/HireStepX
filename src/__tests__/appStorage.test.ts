import { describe, it, expect } from "vitest";
import { clearAppOwnedStorage, isAppOwnedStorageKey } from "../_appStorage";

function fakeStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    removeItem: (k: string) => { data.delete(k); },
    keys: () => Array.from(data.keys()),
  };
}

describe("isAppOwnedStorageKey", () => {
  it("recognises app and supabase auth keys", () => {
    expect(isAppOwnedStorageKey("hirestepx_pending_employer")).toBe(true);
    expect(isAppOwnedStorageKey("hsx-draft")).toBe(true);
    expect(isAppOwnedStorageKey("sb-abc-auth-token")).toBe(true);
  });
  it("leaves other apps and the cookie-consent choice alone", () => {
    expect(isAppOwnedStorageKey("hirestepx_cookie_consent")).toBe(false);
    expect(isAppOwnedStorageKey("loom-recorder")).toBe(false);
    expect(isAppOwnedStorageKey("theme")).toBe(false);
  });
});

describe("clearAppOwnedStorage", () => {
  it("removes only app-owned keys and reports how many", () => {
    const s = fakeStorage({ "hirestepx_a": "1", "sb-x-auth-token": "2", "hirestepx_cookie_consent": "yes", "ext_key": "3" });
    expect(clearAppOwnedStorage(s)).toBe(2);
    expect(s.keys().sort()).toEqual(["ext_key", "hirestepx_cookie_consent"]);
  });
  it("is a no-op on empty storage", () => {
    expect(clearAppOwnedStorage(fakeStorage({}))).toBe(0);
  });
});

describe("clearLocalAccountData", () => {
  it("removes cached account data from local and session storage but keeps cookie consent", async () => {
    const { clearLocalAccountData } = await import("../_appStorage");
    localStorage.setItem("hirestepx_cache_sessions_u1", "[]");
    localStorage.setItem("sb-x-auth-token", "t");
    localStorage.setItem("hirestepx_cookie_consent", "granted");
    localStorage.setItem("other_app_key", "keep");
    sessionStorage.setItem("hirestepx_google_token", "g");
    clearLocalAccountData();
    expect(localStorage.getItem("hirestepx_cache_sessions_u1")).toBeNull();
    expect(localStorage.getItem("sb-x-auth-token")).toBeNull();
    expect(sessionStorage.getItem("hirestepx_google_token")).toBeNull();
    expect(localStorage.getItem("hirestepx_cookie_consent")).toBe("granted");
    expect(localStorage.getItem("other_app_key")).toBe("keep");
  });
});
