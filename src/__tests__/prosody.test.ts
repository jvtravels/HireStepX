import { describe, it, expect } from "vitest";
import { stripProsodyMarkup, renderForCartesia, renderForAzure, renderProsody } from "../_prosody";

describe("stripProsodyMarkup", () => {
  it("returns input unchanged when there's no markup", () => {
    expect(stripProsodyMarkup("Tell me about a time you led.")).toBe("Tell me about a time you led.");
  });
  it("strips emphasis markers", () => {
    expect(stripProsodyMarkup("Tell me about a _time_ you led.")).toBe("Tell me about a time you led.");
  });
  it("strips strong emphasis markers", () => {
    expect(stripProsodyMarkup("That was the __biggest__ moment.")).toBe("That was the biggest moment.");
  });
  it("converts pauses into safe whitespace/punctuation", () => {
    const r = stripProsodyMarkup("First[pause]then second[pause:long]then third.");
    expect(r).not.toContain("[pause]");
    expect(r).not.toContain("[pause:long]");
  });
  it("collapses double-spaces left by stripping", () => {
    const r = stripProsodyMarkup("a [pause] b");
    expect(r).not.toMatch(/\s{2,}/);
  });
  it("handles empty input", () => {
    expect(stripProsodyMarkup("")).toBe("");
  });
});

describe("renderForCartesia", () => {
  it("converts short pause to ellipsis", () => {
    expect(renderForCartesia("Take[pause]your time.")).toContain("…");
  });
  it("converts long pause to double ellipsis", () => {
    expect(renderForCartesia("Wait[pause:long]for it.")).toContain("… …");
  });
  it("drops emphasis markup (no inline support)", () => {
    expect(renderForCartesia("Tell me a _time_.")).toBe("Tell me a time.");
  });
  it("never emits brackets", () => {
    expect(renderForCartesia("a[pause]b[pause:long]c[breath]d")).not.toMatch(/\[/);
  });
});

describe("renderForAzure", () => {
  it("wraps in a <speak> envelope", () => {
    const r = renderForAzure("Plain text.");
    expect(r).toMatch(/^<speak\s/);
    expect(r).toMatch(/<\/speak>$/);
  });
  it("renders emphasis with SSML tags", () => {
    const r = renderForAzure("a _time_ to remember");
    expect(r).toContain('<emphasis level="moderate">time</emphasis>');
  });
  it("renders strong emphasis with SSML strong tag", () => {
    const r = renderForAzure("that __biggest__ moment");
    expect(r).toContain('<emphasis level="strong">biggest</emphasis>');
  });
  it("renders pauses as <break> tags", () => {
    const r = renderForAzure("a[pause]b[pause:long]c");
    expect(r).toContain('<break time="250ms"/>');
    expect(r).toContain('<break time="600ms"/>');
  });
  it("escapes literal & < > characters in body", () => {
    const r = renderForAzure("AT&T moved <fast> from a to b");
    expect(r).toContain("AT&amp;T");
    expect(r).toContain("&lt;fast&gt;");
  });
  it("includes voice name when supplied", () => {
    const r = renderForAzure("hello", "en-IN-NeerjaNeural");
    expect(r).toContain('<voice name="en-IN-NeerjaNeural">');
  });
});

describe("renderProsody dispatcher", () => {
  it("dispatches to cartesia", () => {
    expect(renderProsody("a[pause]b", "cartesia")).toContain("…");
  });
  it("dispatches to azure with SSML envelope", () => {
    expect(renderProsody("hi", "azure")).toMatch(/<speak/);
  });
  it("strips for browser", () => {
    expect(renderProsody("a _time_ b[pause]", "browser")).toBe("a time b");
  });
});
