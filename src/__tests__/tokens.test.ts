import { describe, it, expect } from "vitest";
import { c, font } from "../tokens";

describe("design tokens", () => {
  it("exports all required colors", () => {
    // tokens.ts is now a ROLE-preserving cream-brand shim over auth/_tokens:
    // the legacy dark ramp was remapped (obsidian→cream page bg, ivory→coal
    // primary text, gilt→copper accent, sage→success, ember→error).
    expect(c.obsidian).toBe("oklch(1 0 0)");
    expect(c.graphite).toBe("oklch(0.967 0.001 286.375)");
    expect(c.ivory).toBe("oklch(0.148 0.004 228.8)");
    expect(c.gilt).toBe("oklch(0.555 0.163 48.998)");
    expect(c.sage).toBe("oklch(0.527 0.137 150.069)");
    expect(c.ember).toBe("oklch(0.505 0.190 27.518)");
  });

  it("exports font families", () => {
    expect(font.display).toContain("Instrument Serif");
    expect(font.ui).toContain("Satoshi");
    expect(font.mono).toContain("JetBrains Mono");
  });
});
