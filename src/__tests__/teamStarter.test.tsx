import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TeamStarter from "../employer/team/TeamStarter";

describe("TeamStarter", () => {
  it("lists the roles you can hand out and the free seats", () => {
    render(<TeamStarter roles={["admin", "member", "viewer"]} seatsLeft={4} onInvite={() => {}} />);
    expect(screen.getByText(/You have 4 seats free/)).toBeTruthy();
    expect(screen.getByText("Viewer")).toBeTruthy();
    expect(screen.getByText("Admin")).toBeTruthy();
  });

  it("opens the invite form from the main button", () => {
    const onInvite = vi.fn();
    render(<TeamStarter roles={["member"]} seatsLeft={1} onInvite={onInvite} />);
    expect(screen.getByText(/You have 1 seat free/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Invite your first teammate/ }));
    expect(onInvite).toHaveBeenCalledOnce();
  });
});
