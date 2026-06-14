import { describe, it, expect } from "vitest";
import { c, font } from "../tokens";

describe("design tokens", () => {
  it("exports all required colors", () => {
    // tokens.ts is now a ROLE-preserving cream-brand shim over auth/_tokens:
    // the legacy dark ramp was remapped (obsidian→cream page bg, ivory→coal
    // primary text, gilt→copper accent, sage→success, ember→error).
    expect(c.obsidian).toBe("#FAF7F0");
    expect(c.graphite).toBe("#F4EFE3");
    expect(c.ivory).toBe("#0E0C08");
    expect(c.gilt).toBe("#B45309");
    expect(c.sage).toBe("#15803D");
    expect(c.ember).toBe("#B91C1C");
  });

  it("exports font families", () => {
    expect(font.display).toContain("Instrument Serif");
    expect(font.ui).toContain("Inter");
    expect(font.mono).toContain("JetBrains Mono");
  });
});
