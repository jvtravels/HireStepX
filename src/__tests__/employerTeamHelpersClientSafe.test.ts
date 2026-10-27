import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// src/employer/teamActivity.ts is bundled for the browser and imports this module,
// so it must not reach _shared.ts (which imports server-only next/server).
describe("_employer-team-helpers stays browser-safe", () => {
  it("does not import _shared", () => {
    const src = readFileSync("server-handlers/_employer-team-helpers.ts", "utf8");
    expect(src).not.toMatch(/from\s+["']\.\/_shared["']/);
  });
});
