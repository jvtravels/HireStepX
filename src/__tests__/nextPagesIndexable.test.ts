import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("2.0 *-next pages", () => {
  it("never hard-code noindex (root layout decides by environment)", () => {
    const root = join(process.cwd(), "app/(marketing)");
    const dirs = readdirSync(root).filter((d) => d.endsWith("-next"));
    const offenders = dirs.flatMap((d) => walk(join(root, d))).filter((f) => /noindex/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
