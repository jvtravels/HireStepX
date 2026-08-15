import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CopyEmailLink } from "../_CopyEmailLink";

describe("CopyEmailLink", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the email as the default label", () => {
    render(<CopyEmailLink email="support@hirestepx.com" />);
    expect(screen.getByRole("button", { name: /copy email address/i })).toHaveTextContent("support@hirestepx.com");
  });

  it("copies via navigator.clipboard and shows a confirmation that resets", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<CopyEmailLink email="support@hirestepx.com" />);
    fireEvent.click(screen.getByRole("button"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(writeText).toHaveBeenCalledWith("support@hirestepx.com");
    expect(screen.getByRole("button")).toHaveTextContent("Copied!");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole("button")).toHaveTextContent("support@hirestepx.com");
  });

  it("falls back to execCommand when the Clipboard API is unavailable", () => {
    vi.stubGlobal("navigator", {});
    const execSpy = vi.fn();
    document.execCommand = execSpy;

    render(<CopyEmailLink email="support@hirestepx.com">Email us</CopyEmailLink>);
    fireEvent.click(screen.getByRole("button"));
    expect(execSpy).toHaveBeenCalledWith("copy");
  });
});
