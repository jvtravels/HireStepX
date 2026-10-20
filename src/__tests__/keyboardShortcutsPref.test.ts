import { afterEach, describe, expect, it, vi } from "vitest";
import { getShortcutsEnabled, setShortcutsEnabled } from "../employer/keyboardShortcutsPref";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });

describe("keyboard shortcuts preference", () => {
  it("is on until the employer turns it off", () => {
    expect(getShortcutsEnabled()).toBe(true);
    setShortcutsEnabled(false);
    expect(getShortcutsEnabled()).toBe(false);
    setShortcutsEnabled(true);
    expect(getShortcutsEnabled()).toBe(true);
  });

  it("notifies subscribers when it changes", () => {
    const seen = vi.fn();
    window.addEventListener("hsx-employer-shortcuts-change", seen);
    setShortcutsEnabled(false);
    window.removeEventListener("hsx-employer-shortcuts-change", seen);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("stays on when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(getShortcutsEnabled()).toBe(true);
  });
});
