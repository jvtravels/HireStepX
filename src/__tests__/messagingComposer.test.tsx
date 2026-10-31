import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Composer, { type ComposerBlock } from "../messaging/Composer";

const base = {
  counterpartName: "Asha",
  masked: false,
  draft: "",
  onDraftChange: vi.fn(),
  onSend: vi.fn(),
  onAttach: vi.fn(),
  sending: false,
  attaching: false,
  error: null,
  onDismissError: vi.fn(),
  quickReplies: ["Hello"],
};

describe("Composer", () => {
  it("shows the form when nothing blocks the thread", () => {
    render(<Composer {...base} block={null} />);
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: /send/i })).toBeTruthy();
  });

  it.each<[ComposerBlock, RegExp]>([
    ["closed", /Messaging is closed/],
    ["suspended", /Messaging is turned off/],
    ["unlock", /Unlock this candidate/],
  ])("shows only the reason, no dead form, when blocked: %s", (block, reason) => {
    render(<Composer {...base} block={block} closedMessage="This candidate declined." />);
    expect(screen.getByText(reason)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /send/i })).toBeNull();
  });
});
