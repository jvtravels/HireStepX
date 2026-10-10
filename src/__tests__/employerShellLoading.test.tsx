import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import EmployerShell from "../employer/EmployerShell";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/employer/jobs",
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => React.createElement("a", { href, ...props }, children),
}));
vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Jay Vyas", email: "j@example.com" }, logout: vi.fn() }),
}));
vi.mock("../hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("../AppShellFrame", () => ({
  default: ({ children }: { children: React.ReactNode }) => React.createElement("div", { "data-testid": "console-frame" }, children),
}));
vi.mock("../employer/VerificationBanner", () => ({ default: () => null }));

const refreshCompanyStatus = vi.fn();
let data: Record<string, unknown> = {};
vi.mock("../employer/EmployerDataContext", () => ({
  useEmployerData: () => ({ companyName: "Acme", listConversations: vi.fn(), refreshCompanyStatus, ...data }),
}));

beforeEach(() => {
  refreshCompanyStatus.mockClear();
  data = { companyStatus: "none", companyStatusLoading: false, companyStatusError: false };
});

describe("EmployerShell first paint", () => {
  it("shows a loading screen, not the onboarding frame or the page, while the profile loads", () => {
    data = { companyStatus: "none", companyStatusLoading: true, companyStatusError: false };
    render(<EmployerShell><p>Jobs page</p></EmployerShell>);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("Jobs page")).toBeNull();
    expect(screen.queryByTestId("console-frame")).toBeNull();
  });

  it("offers a retry instead of onboarding when the profile could not be loaded", () => {
    data = { companyStatus: "none", companyStatusLoading: false, companyStatusError: true };
    render(<EmployerShell><p>Jobs page</p></EmployerShell>);
    expect(screen.queryByText("Jobs page")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(refreshCompanyStatus).toHaveBeenCalledTimes(1);
  });

  it("renders the console frame with the page once the company is approved", () => {
    data = { companyStatus: "approved", companyStatusLoading: false, companyStatusError: false };
    render(<EmployerShell><p>Jobs page</p></EmployerShell>);
    expect(screen.getByTestId("console-frame")).toBeTruthy();
    expect(screen.getByText("Jobs page")).toBeTruthy();
  });
});
