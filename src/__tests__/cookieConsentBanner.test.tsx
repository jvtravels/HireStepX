import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import CookieConsent from "../../app/CookieConsent";
import { OPEN_SETTINGS_EVENT } from "../consent";

vi.mock("../posthogClient", () => ({ captureClientEvent: vi.fn() }));

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

async function showBanner() {
  render(<CookieConsent />);
  await act(async () => { vi.advanceTimersByTime(500); });
}

describe("CookieConsent banner", () => {
  it("opens as a compact summary with both choices and a Details toggle", async () => {
    await showBanner();
    expect(screen.getByRole("dialog", { name: "Cookie consent" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Essential only" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Accept all" })).toBeTruthy();
    expect(screen.queryByText(/Google Analytics 4/)).toBeNull();
    expect(screen.getByRole("button", { name: "Details" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("Details reveals the full per-vendor disclosure and Hide details collapses it", async () => {
    await showBanner();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText(/Google Analytics 4/)).toBeTruthy();
    expect(screen.getByText(/Vercel Web Analytics/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Privacy policy" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide details" }));
    expect(screen.queryByText(/Google Analytics 4/)).toBeNull();
  });

  it("reopening from Cookie settings shows the full disclosure straight away", async () => {
    window.localStorage.setItem(
      "hirestepx_cookie_consent",
      JSON.stringify({ choice: "rejected", version: "2026-10-11", timestamp: new Date().toISOString() }),
    );
    render(<CookieConsent />);
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => { window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT)); });
    expect(screen.getByText(/Google Analytics 4/)).toBeTruthy();
  });

  it("choosing records the choice and closes the banner", async () => {
    await showBanner();
    fireEvent.click(screen.getByRole("button", { name: "Essential only" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.localStorage.getItem("hirestepx_cookie_consent")).toContain("rejected");
  });
});
