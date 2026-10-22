import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));

import RedirectNotice from "../RedirectNotice";

describe("RedirectNotice", () => {
  it("explains the redirect and replaces the route", () => {
    render(<RedirectNotice to="/dashboard" title="Calendar isn't available yet" message="Taking you back." />);
    expect(screen.getAllByText("Calendar isn't available yet").length).toBeGreaterThan(0);
    expect(screen.getByText("Taking you back.")).toBeTruthy();
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });
});
