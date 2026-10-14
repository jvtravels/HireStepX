import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { tokens as t } from "../auth/_tokens";

const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

const HX_TO_TOKEN = {
  "hx-coal": t.coal,
  "hx-ink-soft": t.inkSoft,
  "hx-line": t.line,
  "hx-soft": t.creamSoft,
  "hx-indigo": t.indigo,
  "hx-indigo-100": t.indigo100,
  "hx-success": t.success,
  "hx-success-100": t.success100,
  "hx-success-ink": t.successInk,
  "hx-error-ink": t.errorInk,
  "hx-warning-100": t.warning100,
  "hx-warning-ink": t.warningInk,
} as const;

describe("hx-* Tailwind theme colors", () => {
  it.each(Object.entries(HX_TO_TOKEN))("%s matches the design token", (name, value) => {
    const m = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
    expect(m, `--color-${name} missing from index.css`).not.toBeNull();
    expect(m![1].trim()).toBe(value);
  });
});
