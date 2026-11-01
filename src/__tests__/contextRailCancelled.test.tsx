import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ContextRail from "../messaging/ContextRail";

const base = {
  facts: [],
  interviewAt: "2026-11-10T10:00:00.000Z",
  messages: [],
  onOpenAttachment: () => {},
};

describe("ContextRail interview section", () => {
  it("shows no cancelled note while the interview stands", () => {
    render(<ContextRail {...base} />);
    expect(screen.queryByText(/Cancelled/)).toBeNull();
  });

  it("marks the booked time as cancelled when the candidate is out", () => {
    render(<ContextRail {...base} interviewCancelled />);
    expect(screen.getByText(/Cancelled\. The candidate is no longer taking part/)).toBeTruthy();
  });
});
