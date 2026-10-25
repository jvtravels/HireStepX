import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import CookieConsent from "../../app/CookieConsent";
import { CONSENT_KEY, OPEN_SETTINGS_EVENT, getConsentCategories, serializeConsent } from "../consent";

const capture = vi.hoisted(() => vi.fn());
vi.mock("../posthogClient", () => ({ captureClientEvent: capture }));

beforeEach(() => {
  window.localStorage.clear();
  capture.mockClear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

async function showBanner() {
  render(<CookieConsent />);
  await act(async () => { vi.advanceTimersByTime(500); });
}

function reopen() {
  act(() => { window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT)); });
}

describe("CookieConsent banner", () => {
  it("opens as a compact summary with equal Reject all / Accept all and a Customize layer", async () => {
    await showBanner();
    expect(screen.getByRole("dialog", { name: "Cookies on HireStepX" })).toBeTruthy();
    const reject = screen.getByRole("button", { name: "Reject all" });
    const accept = screen.getByRole("button", { name: "Accept all" });
    expect(reject.className).toBe(accept.className);
    expect(screen.getByRole("button", { name: "Customize" })).toBeTruthy();
    expect(screen.queryByText(/Google Analytics 4/)).toBeNull();
    expect(screen.getByRole("link", { name: "Privacy policy" })).toBeTruthy();
  });

  it("does not steal focus on a first visit", async () => {
    await showBanner();
    expect(document.activeElement).toBe(document.body);
  });

  it("Customize shows per-category switches that start off, with essential locked on", async () => {
    await showBanner();
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    expect(screen.getByText("Always on")).toBeTruthy();
    expect(screen.getByText(/Google Analytics 4/)).toBeTruthy();
    expect(screen.getByText(/Vercel Analytics/)).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Analytics" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("switch", { name: "Advertising" }).getAttribute("aria-checked")).toBe("false");
  });

  it("Save choices records analytics-only as a custom choice and fires the analytics event", async () => {
    await showBanner();
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    fireEvent.click(screen.getByRole("switch", { name: "Analytics" }));
    fireEvent.click(screen.getByRole("button", { name: "Save choices" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getConsentCategories()).toEqual({ analytics: true, advertising: false });
    expect(window.localStorage.getItem(CONSENT_KEY)).toContain("custom");
    expect(capture).toHaveBeenCalledWith("cookie_consent_accepted");
  });

  it("Reject all stores nothing optional and sends no event", async () => {
    await showBanner();
    fireEvent.click(screen.getByRole("button", { name: "Reject all" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getConsentCategories()).toEqual({ analytics: false, advertising: false });
    expect(window.localStorage.getItem(CONSENT_KEY)).toContain("rejected");
    expect(capture).not.toHaveBeenCalled();
  });

  it("Accept all allows both categories", async () => {
    await showBanner();
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    expect(getConsentCategories()).toEqual({ analytics: true, advertising: true });
  });

  it("reopening from Cookie settings shows the controls with the saved state, focuses the dialog and Escape closes it unchanged", async () => {
    window.localStorage.setItem(CONSENT_KEY, serializeConsent({ analytics: true, advertising: false }));
    render(<CookieConsent />);
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(screen.queryByRole("dialog")).toBeNull();
    reopen();
    expect(screen.getByRole("switch", { name: "Analytics" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("switch", { name: "Advertising" }).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/Last saved/)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByText("Cookies on HireStepX"));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getConsentCategories()).toEqual({ analytics: true, advertising: false });
  });

  it("the close button on a reopened panel leaves the choice untouched", async () => {
    window.localStorage.setItem(CONSENT_KEY, serializeConsent("rejected"));
    render(<CookieConsent />);
    reopen();
    fireEvent.click(screen.getByRole("button", { name: "Close cookie settings" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(getConsentCategories()).toEqual({ analytics: false, advertising: false });
  });

  it("Escape does not dismiss a first-visit banner (no choice yet)", async () => {
    await showBanner();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
