import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("../AuthContext", () => ({
  useAuth: () => ({
    signup: vi.fn(), login: vi.fn(), loginWithGoogle: vi.fn(),
    isLoggedIn: false, user: null, isLoading: false, lockoutSeconds: 0,
  }),
  clearPendingConsent: vi.fn(),
  storePendingConsent: vi.fn(),
  storePendingEmployerProfile: vi.fn(),
  storePendingNextTarget: vi.fn(),
  storePendingReferralCode: vi.fn(),
}));
vi.mock("../supabase", () => ({ getAuthToken: vi.fn(async () => null) }));

import { StagingSignupForm, StagingLoginForm } from "../home2/AuthForms";

const INVITE = `next=${encodeURIComponent("/employer/join?token=" + "t".repeat(43))}`;

const previewResponse = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const fetchMock = vi.fn();
beforeEach(() => {
  search = "";
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => previewResponse({ error: "invalid" }, 404));
  vi.stubGlobal("fetch", fetchMock);
});

describe("staging signup form", () => {
  it("asks an invited teammate for a person's details, not a new company's", () => {
    search = INVITE;
    render(<StagingSignupForm />);
    expect(screen.getByRole("heading", { name: "Create your account to join" })).toBeTruthy();
    expect(screen.getByLabelText("Full name")).toBeTruthy();
    expect(screen.queryByLabelText(/Company name/)).toBeNull();
    expect(screen.queryByLabelText(/Company website/)).toBeNull();
    expect(screen.queryByRole("group", { name: "Account type" })).toBeNull();
    expect(screen.getByRole("button", { name: "Create account and continue" })).toBeTruthy();
  });

  it("still shows the company form for a new employer", () => {
    search = "next=%2Femployer";
    render(<StagingSignupForm />);
    expect(screen.getByRole("heading", { name: "Create a company account" })).toBeTruthy();
    expect(screen.getByLabelText("Company name")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Account type" })).toBeTruthy();
  });

  it("still shows the candidate form by default", () => {
    render(<StagingSignupForm />);
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "I'm a candidate" }));
    expect(screen.queryByLabelText(/Company name/)).toBeNull();
  });
});

describe("staging signup form with an invite preview", () => {
  it("pre-fills and locks the invited address and names who invited you", async () => {
    search = INVITE;
    fetchMock.mockReturnValue(previewResponse({ state: "pending", companyName: "Acme Technologies", role: "member", email: "asha@acme.com", inviterName: "Priya Nair" }));
    render(<StagingSignupForm />);
    await waitFor(() => expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("asha@acme.com"));
    expect((screen.getByLabelText("Email") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByText("Priya Nair invited you to join Acme Technologies on HireStepX.")).toBeTruthy();
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/employer-team-accept?token=${"t".repeat(43)}`);
  });

  it("leaves the email editable when the invite is expired or unknown", async () => {
    search = INVITE;
    fetchMock.mockReturnValue(previewResponse({ state: "expired", companyName: "Acme Technologies", role: "member", email: "asha@acme.com" }));
    render(<StagingSignupForm />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect((screen.getByLabelText("Email") as HTMLInputElement).readOnly).toBe(false);
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
  });

  it("does not look anything up for a normal signup", () => {
    render(<StagingSignupForm />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("staging login form", () => {
  it("says it is for accepting an invite, not reviewing a shortlist", () => {
    search = INVITE;
    render(<StagingLoginForm />);
    expect(screen.getByText("Log in to accept your team invite.")).toBeTruthy();
    expect(screen.queryByText(/shortlist/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Continue to your roster" })).toBeNull();
  });
});
