import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tokens } from "../auth/_tokens";
import { CONTRAST_PAIRS, contrast, evaluatePairs, parseTokens } from "../../scripts/contrast-lib.mjs";

const root = join(__dirname, "..", "..");

describe("design token contrast (WCAG 2.x AA)", () => {
  // Parsed from source so scripts/check-contrast.mjs and this test can never
  // disagree; the equality check below guards the parser itself.
  const parsed = parseTokens(readFileSync(join(root, "src/auth/_tokens.ts"), "utf8"));

  it("parses the same values as the runtime tokens object", () => {
    for (const [k, v] of Object.entries(parsed)) {
      expect(tokens[k as keyof typeof tokens], k).toBe(v);
    }
  });

  it.each(evaluatePairs(parsed).map((r) => [`${r.fg} on ${r.bg}`, r] as const))(
    "%s meets its minimum ratio",
    (_name, r) => {
      expect(r.ratio, `${r.fg} on ${r.bg} (${r.why})`).toBeGreaterThanOrEqual(r.min);
    },
  );

  it("checks a non-trivial number of pairs", () => {
    expect(CONTRAST_PAIRS.length).toBeGreaterThan(30);
  });

  it("measures known reference ratios correctly", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
  });

  it("keeps index.css --muted-foreground in sync with tokens.inkSoft", () => {
    const css = readFileSync(join(root, "src/index.css"), "utf8");
    const rootBlock = css.slice(css.indexOf(":root"));
    expect(/--muted-foreground:\s*([^;]+);/.exec(rootBlock)?.[1]).toBe(tokens.inkSoft);
  });
});
