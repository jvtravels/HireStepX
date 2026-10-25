import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildResourceItems } from "../home2/resourcesBuild";

describe("resource cards", () => {
  it("never link to a URL that next.config redirects", () => {
    const cfg = readFileSync("next.config.js", "utf8");
    const redirectsAt = cfg.indexOf("async redirects()");
    const rules = cfg.slice(redirectsAt).match(/\{[^{}]*?source:\s*"[^"]+"[^{}]*?permanent[^{}]*?\}/gs) ?? [];
    const exact = new Set<string>();
    for (const r of rules) {
      const src = /source:\s*"([^"]+)"/.exec(r)?.[1];
      if (src && !/[:*(]/.test(src) && !/\b(has|missing):/.test(r)) exact.add(src);
    }
    expect(exact.size).toBeGreaterThan(10);
    const bad = buildResourceItems().filter((i) => exact.has(i.h)).map((i) => i.h);
    expect(bad).toEqual([]);
  });
  it("has unique hrefs within each kind", () => {
    const keys = buildResourceItems().map((i) => `${i.k}|${i.h}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
