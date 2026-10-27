import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

// "Server-side" user_metadata shared between mounts, like the real user row.
let serverMeta: Record<string, unknown> = {};
let hasSession = true;
const updateUser = vi.fn(async (attrs: { data?: Record<string, unknown> }) => {
  Object.assign(serverMeta, attrs.data ?? {});
  return { data: {}, error: null };
});
const jwt = (iat: number) => `h.${btoa(JSON.stringify({ iat }))}.s`;

vi.mock("../supabase", () => ({
  supabaseConfigured: true,
  getSupabase: async () => ({
    auth: {
      getSession: async () => ({
        data: { session: hasSession ? { access_token: jwt(Math.floor(Date.now() / 1000)), user: { email: "a@b.co" } } : null },
      }),
      getUser: async () => ({ data: { user: { email: "a@b.co", user_metadata: { ...serverMeta } } }, error: null }),
      updateUser,
      signOut: vi.fn(async () => ({})),
    },
  }),
}));

import ResetPassword from "../ResetPassword";

const STAMP_KEY = "hirestepx_reset_opened_at";

beforeEach(() => {
  cleanup();
  serverMeta = {};
  hasSession = true;
  updateUser.mockClear();
  window.sessionStorage.clear();
  window.location.hash = "";
});

describe("reset-password link guard", () => {
  it("opens a fresh link and stamps it", async () => {
    render(<ResetPassword />);
    await screen.findByLabelText("New password");
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(STAMP_KEY)).toBe(String(serverMeta.password_reset_opened_at));
  });

  it("lets the same tab reload inside the 90s window without a false 'already used'", async () => {
    render(<ResetPassword />);
    await screen.findByLabelText("New password");
    cleanup();
    render(<ResetPassword />);
    await screen.findByLabelText("New password");
    expect(screen.queryByText("This link was already used.")).toBeNull();
    expect(updateUser).toHaveBeenCalledTimes(1);
  });

  it("still rejects a second tab or device opening the link inside the window", async () => {
    render(<ResetPassword />);
    await screen.findByLabelText("New password");
    cleanup();
    window.sessionStorage.clear();
    render(<ResetPassword />);
    expect(await screen.findByText("This link was already used.")).toBeTruthy();
  });
});

describe("reset-password with no session", () => {
  it("calls a bare visit invalid, not expired", async () => {
    hasSession = false;
    render(<ResetPassword />);
    expect(await screen.findByText("We couldn't verify this link.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("This link has expired.")).toBeNull());
  });

  it("calls a Supabase otp_expired redirect expired", async () => {
    hasSession = false;
    window.location.hash = "#error=access_denied&error_code=otp_expired";
    render(<ResetPassword />);
    expect(await screen.findByText("This link has expired.")).toBeTruthy();
  });
});
