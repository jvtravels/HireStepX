import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const apiFetch = vi.fn();
vi.mock("../apiClient", () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

const { default: NotificationPreferences } = await import("../notifications/NotificationPreferences");

beforeEach(() => apiFetch.mockReset());

describe("NotificationPreferences load", () => {
  it.each([
    ["an empty body", { ok: true, status: 200, data: {} }],
    ["a body without inApp", { ok: true, status: 200, data: { prefs: {} } }],
    ["a failed request", { ok: false, status: 500, data: null }],
  ])("falls back to the defaults on %s instead of crashing", async (_name, res) => {
    apiFetch.mockResolvedValue(res);
    render(<NotificationPreferences audience="employer" />);
    await waitFor(() => expect(screen.getAllByRole("switch").length).toBeGreaterThan(0));
    for (const s of screen.getAllByRole("switch")) expect(s.getAttribute("aria-checked")).toBe("true");
  });
});
