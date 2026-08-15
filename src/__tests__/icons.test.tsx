import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { CheckIcon, InfoIcon, SpinnerIcon, ArrowRightIcon, XIcon } from "../_icons";

describe("shared icon atoms", () => {
  it("renders each icon hidden from the accessibility tree by default", () => {
    for (const Icon of [CheckIcon, InfoIcon, SpinnerIcon, ArrowRightIcon, XIcon]) {
      const { container } = render(<Icon />);
      const svg = container.querySelector("svg");
      expect(svg).toBeTruthy();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("width")).toBe("16");
    }
  });

  it("exposes an accessible label and role when a title is passed", () => {
    const { container } = render(<CheckIcon title="Completed" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Completed");
    expect(svg?.querySelector("title")?.textContent).toBe("Completed");
  });

  it("honors size, strokeWidth, and color overrides", () => {
    const { container } = render(<XIcon size={24} strokeWidth={1.5} color="#ff0000" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
    expect(svg?.getAttribute("stroke-width")).toBe("1.5");
    expect(svg?.getAttribute("stroke")).toBe("#ff0000");
  });
});
