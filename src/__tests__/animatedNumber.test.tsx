import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

const reduce = vi.hoisted(() => ({ value: false }));
vi.mock("motion/react", () => ({ useReducedMotion: () => reduce.value }));

import AnimatedNumber from "../AnimatedNumber";

afterEach(() => { reduce.value = false; vi.useRealTimers(); });

describe("AnimatedNumber", () => {
  it("shows the final value immediately when reduced motion is on", () => {
    reduce.value = true;
    const { container } = render(<AnimatedNumber value={42} suffix="%" />);
    expect(container.querySelector("[aria-hidden]")?.textContent).toBe("42%");
  });

  it("always exposes the final value to screen readers", () => {
    render(<AnimatedNumber value={7} />);
    expect(screen.getByText("7", { selector: ".sr-only" })).toBeTruthy();
  });

  it("counts up from 0 to the target", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const { container } = render(<AnimatedNumber value={50} />);
    expect(container.querySelector("[aria-hidden]")?.textContent).toBe("0");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(container.querySelector("[aria-hidden]")?.textContent).toBe("50");
  });
});
