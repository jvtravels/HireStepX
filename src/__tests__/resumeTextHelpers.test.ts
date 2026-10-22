import { describe, it, expect } from "vitest";
import { isUnreadableResumeText, truncateResumeText, RESUME_CHAR_CAP } from "../../server-handlers/_resume-text-helpers";
import { parseResumeData } from "../resumeParser";

const DEVANAGARI = [
  "राहुल शर्मा",
  "अनुभव",
  "वरिष्ठ सॉफ्टवेयर इंजीनियर, इन्फोसिस, बेंगलुरु 2019 - वर्तमान",
  "माइक्रोसर्विसेज का डिज़ाइन और विकास किया, लागत में तीस प्रतिशत की कमी की",
  "शिक्षा",
  "बी.टेक कंप्यूटर विज्ञान, दिल्ली विश्वविद्यालय 2015 - 2019",
].join("\n");

describe("isUnreadableResumeText", () => {
  it("accepts a Devanagari resume (letters + combining marks count)", () => {
    expect(isUnreadableResumeText(DEVANAGARI)).toBe(false);
  });
  it("accepts English text", () => {
    expect(isUnreadableResumeText("Senior engineer with ten years of experience building payment systems at scale.")).toBe(false);
  });
  it("flags replacement-character garble from unmapped Indic fonts", () => {
    expect(isUnreadableResumeText("�".repeat(40) + " ab ".repeat(5))).toBe(true);
  });
  it("flags private-use glyph output", () => {
    expect(isUnreadableResumeText(" ".repeat(30))).toBe(true);
  });
  it("flags symbol-only text with almost no letters", () => {
    expect(isUnreadableResumeText("#@!$%^&*()_+=-[]{}|;:,.<>?/~".repeat(3))).toBe(true);
  });
  it("leaves very short input to the callers' length gates", () => {
    expect(isUnreadableResumeText("��")).toBe(false);
  });
});

describe("Devanagari through the parser", () => {
  it("still finds the experience and education sections", () => {
    const parsed = parseResumeData(DEVANAGARI);
    expect(parsed.experience.length + parsed.education.length).toBeGreaterThan(0);
  });
});

describe("truncateResumeText", () => {
  it("returns short text untouched", () => {
    expect(truncateResumeText("hello")).toEqual({ text: "hello", truncated: false });
  });

  it("keeps the head of every section instead of dropping trailing ones", () => {
    const filler = (tag: string, n: number) => Array.from({ length: n }, (_, i) => `${tag} bullet ${i} did a thing`).join("\n");
    const text = ["EXPERIENCE", filler("exp", 600), "EDUCATION", filler("edu", 5), "CERTIFICATIONS", filler("cert", 5)].join("\n");
    expect(text.length).toBeGreaterThan(RESUME_CHAR_CAP);
    const out = truncateResumeText(text);
    expect(out.truncated).toBe(true);
    expect(out.text.length).toBeLessThanOrEqual(RESUME_CHAR_CAP);
    expect(out.text).toContain("EDUCATION");
    expect(out.text).toContain("edu bullet 4");
    expect(out.text).toContain("CERTIFICATIONS");
    expect(out.text).toContain("cert bullet 4");
    expect(out.text).toContain("exp bullet 0");
  });

  it("recognises Devanagari section headings", () => {
    const body = (t: string, n: number) => Array.from({ length: n }, (_, i) => `${t} पंक्ति ${i} काम किया`).join("\n");
    const text = ["अनुभव", body("अ", 900), "शिक्षा", body("श", 3)].join("\n");
    const out = truncateResumeText(text, 3000);
    expect(out.text.length).toBeLessThanOrEqual(3000);
    expect(out.text).toContain("शिक्षा");
    expect(out.text).toContain("श पंक्ति 2");
  });

  it("falls back to a line-boundary head cut when there are no headings", () => {
    const text = Array.from({ length: 2000 }, (_, i) => `line number ${i} with words`).join("\n");
    const out = truncateResumeText(text, 1000);
    expect(out.truncated).toBe(true);
    expect(out.text.length).toBeLessThanOrEqual(1000);
    expect(out.text.endsWith("words")).toBe(true);
  });
});
