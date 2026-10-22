import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import "./setup-next-navigation";

const mockUseAuth = vi.fn();
const mockReadSessionFromLocalStorage = vi.fn();

vi.mock("../AuthContext", () => ({
  useAuth: () => mockUseAuth(),
  readSessionFromLocalStorage: () => mockReadSessionFromLocalStorage(),
}));

vi.mock("../posthogClient", () => ({
  captureClientEvent: vi.fn(),
}));

import { NavV2 } from "../marketing-v2/HomepageV2";

describe("NavV2 auth-aware CTA", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockReadSessionFromLocalStorage.mockReset();
  });

  it("shows Sign in while restore is pending and no stored session exists", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: false, loading: true });
    mockReadSessionFromLocalStorage.mockReturnValue(null);
    await act(async () => { render(<NavV2 />); });
    expect(screen.getAllByText("Sign in").length).toBeGreaterThan(0);
    expect(screen.queryByText("Dashboard")).toBeNull();
  });

  it("optimistically shows Dashboard during restore when a non-expired session token is stored", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: false, loading: true });
    mockReadSessionFromLocalStorage.mockReturnValue({
      access_token: "tok",
      refresh_token: "rtok",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: "u1" },
    });
    await act(async () => { render(<NavV2 />); });
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
  });

  it("does NOT show Dashboard during restore when the stored token is expired", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: false, loading: true });
    mockReadSessionFromLocalStorage.mockReturnValue(null);
    await act(async () => { render(<NavV2 />); });
    expect(screen.queryByText("Dashboard")).toBeNull();
    expect(screen.getAllByText("Sign in").length).toBeGreaterThan(0);
  });

  it("shows Dashboard once auth restore completes and confirms a real session", async () => {
    mockUseAuth.mockReturnValue({ isLoggedIn: true, loading: false });
    mockReadSessionFromLocalStorage.mockReturnValue(null);
    await act(async () => { render(<NavV2 />); });
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
  });
});
