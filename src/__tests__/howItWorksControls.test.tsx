import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HowItWorks } from "../home2/Pages";

const STEPS: [string, string][] = [["One", "First caption"], ["Two", "Second caption"]];

function mount() {
  return render(<HowItWorks steps={STEPS} icons={[null, null]} scene={(n) => <i>scene {n}</i>} title="Walkthrough" />);
}

describe("HowItWorks autoplay controls", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("offers a pause control that toggles autoplay", () => {
    const { container } = mount();
    const btn = screen.getByRole("button", { name: "Pause the walkthrough" });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: "Play the walkthrough" }).getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".hs")?.classList.contains("stopped")).toBe(true);
  });

  it("does not announce captions while it rotates by itself", () => {
    const { container } = mount();
    expect(container.querySelector(".hs-cap")?.getAttribute("aria-live")).toBe("off");
  });

  it("announces the caption once the visitor picks a step", () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole("tab", { name: /Two/ }));
    const cap = container.querySelector(".hs-cap");
    expect(cap?.textContent).toBe("Second caption");
    expect(cap?.getAttribute("aria-live")).toBe("polite");
  });

  it("pauses on a real mouse hover but not on touch", () => {
    // jsdom has no PointerEvent, so pointerType would be dropped from the init.
    vi.stubGlobal("PointerEvent", class extends MouseEvent {
      pointerType: string;
      constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
        super(type, init);
        this.pointerType = init.pointerType ?? "";
      }
    });
    vi.stubGlobal("IntersectionObserver", class {
      constructor(private cb: (e: { isIntersecting: boolean }[]) => void) {}
      observe() { this.cb([{ isIntersecting: true }]); }
      disconnect() {}
      unobserve() {}
    });
    const { container } = mount();
    const root = container.querySelector(".hs") as HTMLElement;
    expect(root.classList.contains("stopped")).toBe(false);
    fireEvent.pointerEnter(root, { pointerType: "touch" });
    expect(root.classList.contains("stopped")).toBe(false);
    fireEvent.pointerEnter(root, { pointerType: "mouse" });
    expect(root.classList.contains("stopped")).toBe(true);
    fireEvent.pointerLeave(root, { pointerType: "mouse" });
    expect(root.classList.contains("stopped")).toBe(false);
  });
});
