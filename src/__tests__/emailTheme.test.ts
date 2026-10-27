import { describe, it, expect, vi } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as theme from "../../server-handlers/_email-theme";

const FOOTER_TEXT = "You're receiving this because you have an account at";

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

  it("a custom reason replaces the account sentence and drops Manage notifications", () => {
    const html = theme.emailShell({ preview: "p", body: "", footer: { reason: "A teammate invited this address." } });
    expect(html).toContain("A teammate invited this address.");
    expect(html).not.toContain(FOOTER_TEXT);
    expect(html).not.toContain("Manage notifications");
    expect(html).not.toContain("Unsubscribe");
  });

  it("footer site and support addresses are explicit links, not client auto-links", () => {
    const html = theme.emailShell({ preview: "p", body: "" });
    expect(html).toContain('href="https://hirestepx.com"');
    expect(html).toContain('href="mailto:hello@hirestepx.com"');
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

  it("uses the design-system faint ink for footer text", () => {
    expect(theme.emailShell({ preview: "p", body: "" })).toContain(theme.C.inkFaint);
  });

  it("shows the wordmark image and sender line, not the old favicon header", () => {
    const html = theme.emailShell({ preview: "p", body: "" });
    expect(html).toContain("https://hirestepx.com/wordmark-email.png");
    expect(html).not.toContain("favicon.svg");
    expect(html).toContain("HireStepX &middot; <a href=\"mailto:hello@hirestepx.com\"");
  });

  it("marketing footers pair Manage notifications with Unsubscribe", () => {
    const html = theme.emailShell({ preview: "p", body: "", footer: { marketing: true } });
    expect(html).toContain("Manage notifications");
    expect(html).toContain("Unsubscribe");
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


describe("2.0 building blocks", () => {
  const page = () =>
    theme.emailShell({
      preview: "p",
      body:
        theme.hero({ eyebrow: "Eyebrow", title: "Title", lede: "Lede", tone: "success" }) +
        theme.hero({ title: "Plain" }) +
        theme.hero({ title: "Oops", tone: "error" }) +
        theme.data([["A", "1"], ["B", "2"]]) +
        theme.actions([{ label: "Go", href: "https://x.test/a" }, { label: "Other", href: "https://x.test/b", ghost: true }]) +
        theme.note("fine print") +
        theme.note("careful", { tone: "warn" }) +
        theme.title("T") +
        theme.signoff({ note: "n" }),
    });

  it("emits no italics, em tags, serif or mono fonts or web-font imports", () => {
    const html = page();
    expect(html).not.toMatch(/<em[\s>]/);
    expect(html).not.toMatch(/font-style:\s*italic/i);
    expect(html).not.toMatch(/Instrument|JetBrains|@import|[^-]serif[,;]/);
  });

  it("hero carries the gradient with a solid fallback colour", () => {
    const html = theme.hero({ title: "T" });
    expect(html).toContain("linear-gradient(135deg");
    expect(html).toContain('bgcolor="#F3EEF8"');
    expect(html).toContain("background-color:#F3EEF8");
  });

  it("error hero uses the light red frame, not the gradient", () => {
    const html = theme.hero({ title: "T", tone: "error" });
    expect(html).not.toContain("linear-gradient");
    expect(html).toContain(theme.C.error100);
  });

  it("hero renders eyebrow, headline and lede in order and skips absent parts", () => {
    const full = theme.hero({ eyebrow: "EYE", title: "HEAD", lede: "LEDE" });
    expect(full.indexOf("EYE")).toBeLessThan(full.indexOf("HEAD"));
    expect(full.indexOf("HEAD")).toBeLessThan(full.indexOf("LEDE"));
    const bare = theme.hero({ title: "HEAD" });
    expect(bare).not.toContain("<p ");
    expect(bare).not.toContain("border-radius:99px");
  });

  it("hero passes caller HTML through untouched (callers escape)", () => {
    const html = theme.hero({ title: `Hi ${theme.escapeHtml("<b>x</b>")}` });
    expect(html).toContain("Hi &lt;b&gt;x&lt;/b&gt;");
    expect(html).not.toContain("<b>x</b>");
  });

  it("actions puts buttons in one row with a 12px gutter and a ghost second button", () => {
    const html = theme.actions([{ label: "One", href: "https://x.test/1" }, { label: "Two", href: "https://x.test/2", ghost: true }]);
    expect(html.match(/<tr><td style="padding:0 12px 0 0;">/g)).toHaveLength(1);
    expect(html).toContain('href="https://x.test/1"');
    expect(html).toContain(`background:${theme.C.white}`);
    expect(html).toContain(`background:${theme.C.indigo}`);
  });

  it("note is plain text by default and a warning box only when asked", () => {
    expect(theme.note("hi")).not.toContain(theme.C.warning100);
    expect(theme.note("hi", { tone: "warn" })).toContain(theme.C.warning100);
  });

  it("firstNameOf and nameSuffix escape and fall back", () => {
    expect(theme.firstNameOf("Arjun Mehta")).toBe("Arjun");
    expect(theme.firstNameOf("  ")).toBe("there");
    expect(theme.firstNameOf(null)).toBe("there");
    expect(theme.firstNameOf("<i>x")).toBe("&lt;i&gt;x");
    expect(theme.nameSuffix("Arjun Mehta")).toBe(", Arjun");
    expect(theme.nameSuffix("")).toBe("");
  });

  it("dataCard keeps the optional label and header row", () => {
    expect(theme.dataCard("Receipt", [["A", "1"]])).toContain("Receipt");
    expect(theme.dataCard("", [["A", "1"]])).not.toContain("text-transform:uppercase");
  });

  it("no production email file brings back the split accentWord headline", () => {
    const dir = join(__dirname, "../../server-handlers");
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => /accentWord|\bemailTitle\(/.test(readFileSync(join(dir, f), "utf8")));
    expect(offenders).toEqual([]);
  });

  it("ships a dark palette and a swappable wordmark", () => {
    const html = theme.emailShell({ preview: "p", body: theme.hero({ title: "T" }) });
    expect(html).toContain('content="light dark"');
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain("https://hirestepx.com/wordmark-email-dark.png");
    expect(html).toContain(".hsx-logo-dark { display:block !important; }");
    expect(html).toContain(`[bgcolor="${theme.C.white}"]`);
  });

  it("both wordmark files exist in public/", () => {
    for (const f of ["wordmark-email.png", "wordmark-email-dark.png"]) {
      expect(existsSync(join(__dirname, "../../public", f))).toBe(true);
    }
  });
});
