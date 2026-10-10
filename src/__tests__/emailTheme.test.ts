import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as theme from "../../server-handlers/_email-theme";

const FOOTER_TEXT = "You're receiving this because you have an account at hirestepx.com";

describe("emailShell footer ownership", () => {
  it("renders exactly one compliance footer", () => {
    const html = theme.emailShell({ preview: "p", body: theme.para("hello") });
    expect(html.split(FOOTER_TEXT)).toHaveLength(2);
    expect(html.match(/Unsubscribe/g)).toHaveLength(1);
  });

  it("applies footer overrides without duplicating it", () => {
    const html = theme.emailShell({ preview: "p", body: "", footer: { manageUrl: "https://x.test/m", unsubUrl: "https://x.test/u" } });
    expect(html).toContain("https://x.test/m");
    expect(html).toContain("https://x.test/u");
    expect(html.split(FOOTER_TEXT)).toHaveLength(2);
  });

  it("does not export the footer builder, so bodies cannot add a second one", () => {
    expect("footer" in theme).toBe(false);
  });

  it("no handler composes its own footer", () => {
    const dir = join(__dirname, "../../server-handlers");
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && f !== "_email-theme.ts")
      .filter((f) => readFileSync(join(dir, f), "utf8").includes(FOOTER_TEXT));
    expect(offenders).toEqual([]);
  });
});
