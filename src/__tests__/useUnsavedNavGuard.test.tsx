// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useUnsavedNavGuard } from "../employer/useUnsavedNavGuard";

function Harness({ dirty }: { dirty: boolean }) {
  useUnsavedNavGuard(() => dirty);
  return (
    <div>
      <a href="/employer/jobs" data-testid="in-app" onClick={(e) => e.preventDefault()}>Jobs</a>
      <a href="https://example.com/x" data-testid="external" onClick={(e) => e.preventDefault()}>Out</a>
    </div>
  );
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("useUnsavedNavGuard", () => {
  it("asks before an in-app link is followed while dirty, and blocks it on cancel", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { getByTestId } = render(<Harness dirty />);
    const notPrevented = fireEvent.click(getByTestId("in-app"));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it("lets the click through when the person confirms", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { getByTestId } = render(<Harness dirty />);
    fireEvent.click(getByTestId("in-app"));
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("does nothing when clean or for external links", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const clean = render(<Harness dirty={false} />);
    fireEvent.click(clean.getByTestId("in-app"));
    clean.unmount();
    const dirty = render(<Harness dirty />);
    fireEvent.click(dirty.getByTestId("external"));
    expect(confirm).not.toHaveBeenCalled();
  });
});
