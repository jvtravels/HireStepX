import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import EmployerShell from "../employer/EmployerShell";

let pathname = "/employer/jobs";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => pathname,
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => React.createElement("a", { href, ...props }, children),
}));
vi.mock("../AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Jay Vyas", email: "j@example.com" }, logout: vi.fn() }),
}));
vi.mock("../hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("../AppShellFrame", () => ({
  default: ({ children, extraCrumbs }: { children: React.ReactNode; extraCrumbs?: { label: string }[] }) =>
    React.createElement("div", { "data-testid": "console-frame", "data-crumbs": (extraCrumbs ?? []).map((c) => c.label).join(">") }, children),
}));
vi.mock("../employer/VerificationBanner", () => ({ default: () => null }));

const refreshCompanyStatus = vi.fn();
let data: Record<string, unknown> = {};
vi.mock("../employer/EmployerDataContext", () => ({
  useEmployerData: () => ({ companyName: "Acme", listConversations: vi.fn(), refreshCompanyStatus, ...data }),
}));

beforeEach(() => {
  window.localStorage.clear();
  refreshCompanyStatus.mockClear();
  data = { companyStatus: "none", companyStatusLoading: false, companyStatusError: false };
  pathname = "/employer/jobs";
});

describe("EmployerShell first paint", () => {
  it("shows a loading screen, not the onboarding frame or the page, while the profile loads", () => {
    data = { companyStatus: "none", companyStatusLoading: true, companyStatusError: false };
    render(<EmployerShell><p>Jobs page</p></EmployerShell>);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("Jobs page")).toBeNull();
    expect(screen.queryByTestId("console-frame")).toBeNull();
  });

  it("draws the console chrome with a skeleton, not the page, for a returning approved employer", () => {
    window.localStorage.setItem("hsx_employer_console", JSON.stringify({ userId: "u1", name: "Acme" }));
    data = { companyStatus: "none", companyStatusLoading: true, companyStatusError: false };
    render(<EmployerShell><p>Jobs page</p></EmployerShell>);
    expect(screen.getByTestId("console-frame")).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("Jobs page")).toBeNull();
  });

  it("ignores a hint saved by a different user", () => {
    window.localStorage.setItem("hsx_employer_console", JSON.stringify({ userId: "someone-else", name: "Other" }));
    data = { companyStatus: "none", companyStatusLoading: true, companyStatusError: false };
    render(<EmployerShell><p>Jobs page</p></EmployerShell>);
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
    expect(JSON.parse(window.localStorage.getItem("hsx_employer_console") ?? "null")).toEqual({ userId: "u1", name: "Acme" });
  });

  it("clears the hint when the company turns out not to be approved", () => {
    window.localStorage.setItem("hsx_employer_console", JSON.stringify({ userId: "u1", name: "Acme" }));
    data = { companyStatus: "none", companyStatusLoading: false, companyStatusError: false };
    render(<EmployerShell><p>Onboarding</p></EmployerShell>);
    expect(window.localStorage.getItem("hsx_employer_console")).toBeNull();
  });
});

describe("EmployerShell tab title", () => {
  it.each([
    ["/employer/requirements/r1/compare", "Compare candidates"],
    ["/employer/requirements/r1/edit", "Edit job"],
    ["/employer/requirements/r1/outcome", "Hiring outcome"],
    ["/employer/requirements/r1", "Jobs"],
  ])("titles %s as %s", (path, title) => {
    pathname = path;
    data = { companyStatus: "approved", companyStatusLoading: false, companyStatusError: false };
    render(<EmployerShell><p>Page</p></EmployerShell>);
    expect(document.title).toBe(`${title} · HireStepX`);
  });

  it("adds a leaf crumb on the post-a-job page so the header names the page", () => {
    pathname = "/employer/requirements/new";
    data = { companyStatus: "approved", companyStatusLoading: false, companyStatusError: false };
    render(<EmployerShell><p>Page</p></EmployerShell>);
    expect(screen.getByTestId("console-frame").getAttribute("data-crumbs")).toBe("Post a job");
  });
});

describe("EmployerShell page container", () => {
  const cardOf = (text: string) => screen.getByText(text).parentElement as HTMLElement;

  it.each([
    "/employer/requirements/r1",
    "/employer/requirements/r1/compare",
    "/employer/requirements/r1/outcome",
    "/employer/requirements/r1/candidates/m1",
  ])("does not wrap %s in a bordered card", (path) => {
    pathname = path;
    data = { companyStatus: "approved", companyStatusLoading: false, companyStatusError: false };
    render(<EmployerShell><p>Page</p></EmployerShell>);
    expect(cardOf("Page").className).not.toContain("border");
    expect(cardOf("Page").className).not.toContain("bg-white");
  });

  it("keeps the card on the dashboard", () => {
    pathname = "/employer";
    data = { companyStatus: "approved", companyStatusLoading: false, companyStatusError: false };
    render(<EmployerShell><p>Page</p></EmployerShell>);
    expect(cardOf("Page").className).toContain("border");
  });
});
