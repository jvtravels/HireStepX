import { describe, it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as theme from "../../server-handlers/_email-theme";

const FOOTER_TEXT = "You're receiving this because you have an account at hirestepx.com";

describe("emailShell footer ownership", () => {
  it("renders exactly one compliance footer", () => {
    const html = theme.emailShell({ preview: "p", body: theme.para("hello"), footer: { marketing: true } });
    expect(html.split(FOOTER_TEXT)).toHaveLength(2);
    expect(html.match(/Unsubscribe/g)).toHaveLength(1);
  });

  it("transactional footers carry no unsubscribe link", () => {
    const html = theme.emailShell({ preview: "p", body: theme.para("hello") });
    expect(html).not.toContain("Unsubscribe");
    expect(html).toContain("Manage notifications");
    expect(html).toContain("This is a service email");
  });

  it("marketing footers link the signed unsubscribe URL", () => {
    const html = theme.emailShell({ preview: "p", body: "", footer: { marketing: true, unsubUrl: "https://x.test/u" } });
    expect(html).toContain('href="https://x.test/u"');
  });

  it("includes the escaped postal address when configured", () => {
    vi.stubEnv("LEGAL_POSTAL_ADDRESS", "1 Main St <Block> & Co, Pune");
    const html = theme.emailShell({ preview: "p", body: "" });
    vi.unstubAllEnvs();
    expect(html).toContain("1 Main St &lt;Block&gt; &amp; Co, Pune");
  });

  it("uses a faint-ink colour that meets 4.5:1 on white", () => {
    expect(theme.emailShell({ preview: "p", body: "" })).toContain("#736B5D");
  });

  it("applies footer overrides without duplicating it", () => {
    const html = theme.emailShell({ preview: "p", body: "", footer: { marketing: true, manageUrl: "https://x.test/m", unsubUrl: "https://x.test/u" } });
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
