// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MembersTab from "@/employer/team/MembersTab";
import type { TeamMember } from "@/employer/useTeam";

const member = (id: string): TeamMember =>
  ({ userId: id, name: `Person ${id}`, email: `${id}@acme.test`, role: "owner", lastActiveAt: null } as unknown as TeamMember);

const base = { myRole: "owner" as const, compact: false, soleOwner: true, onCommand: vi.fn(), busyId: null };

describe("MembersTab invite nudge", () => {
  it("offers an invite when the team is just the viewer", () => {
    const onInviteClick = vi.fn();
    render(<MembersTab {...base} members={[member("a")]} onInviteClick={onInviteClick} />);
    fireEvent.click(screen.getByRole("button", { name: "Invite a teammate" }));
    expect(onInviteClick).toHaveBeenCalledOnce();
  });

  it("hides the nudge when the viewer cannot invite", () => {
    render(<MembersTab {...base} members={[member("a")]} />);
    expect(screen.queryByRole("button", { name: "Invite a teammate" })).toBeNull();
  });

  it("hides the nudge once there is more than one member", () => {
    render(<MembersTab {...base} members={[member("a"), member("b")]} onInviteClick={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Invite a teammate" })).toBeNull();
  });
});
