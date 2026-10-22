import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useFocusTrap } from "../useFocusTrap";

function Harness() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, open);
  return (
    <>
      <button onClick={() => setOpen(true)}>opener</button>
      {open && (
        <div ref={ref} role="dialog" aria-label="d">
          <button>close</button>
          <input aria-label="field" />
          <button>save</button>
        </div>
      )}
      <button onClick={() => setOpen(false)}>outside-close</button>
    </>
  );
}

describe("useFocusTrap", () => {
  it("focuses the first field, wraps Tab/Shift+Tab, and restores focus on close", () => {
    render(<Harness />);
    const opener = screen.getByText("opener");
    opener.focus();
    fireEvent.click(opener);

    expect(document.activeElement).toBe(screen.getByLabelText("field"));

    screen.getByText("save").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByText("close"));

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText("save"));

    fireEvent.click(screen.getByText("outside-close"));
    expect(document.activeElement).toBe(opener);
  });
});
