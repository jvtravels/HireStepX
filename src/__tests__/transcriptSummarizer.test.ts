import { describe, it, expect } from "vitest";
import {
  summarizeTranscriptIfLong,
  type TranscriptTurn,
} from "../../server-handlers/_transcript-summarizer";

function mkTurns(n: number): TranscriptTurn[] {
  return Array.from({ length: n }, (_, i) => ({
    role: (i % 2 === 0 ? "user" : "bot") as "user" | "bot",
    text: `turn-${i}`,
  }));
}

describe("summarizeTranscriptIfLong", () => {
  it("returns the input unchanged when below threshold", () => {
    const t = mkTurns(10);
    const r = summarizeTranscriptIfLong(t, { threshold: 30 });
    expect(r.summarized).toBe(false);
    expect(r.transcript.length).toBe(10);
  });

  it("compresses prefix and keeps tail when above threshold", () => {
    const t = mkTurns(35);
    const r = summarizeTranscriptIfLong(t, { threshold: 30, tailKeep: 10 });
    expect(r.summarized).toBe(true);
    /* 1 summary + 10 tail = 11 entries. */
    expect(r.transcript.length).toBe(11);
    expect(r.transcript[0].role).toBe("system");
    expect(r.transcript[0].text).toMatch(/Earlier in conversation/);
  });

  it("keeps the LAST tailKeep turns verbatim", () => {
    const t = mkTurns(40);
    const r = summarizeTranscriptIfLong(t, { threshold: 30, tailKeep: 10 });
    /* tail must contain turn-30 .. turn-39 verbatim. */
    const tailTexts = r.transcript.slice(1).map((e) => e.text);
    expect(tailTexts[0]).toBe("turn-30");
    expect(tailTexts[tailTexts.length - 1]).toBe("turn-39");
  });

  it("includes role / company / target / offer in the summary line", () => {
    const t = mkTurns(35);
    const r = summarizeTranscriptIfLong(t, {
      threshold: 30,
      tailKeep: 10,
      role: "swe",
      company: "Acme",
      candidateTarget: 28,
      highestOfferMade: 25,
    });
    expect(r.transcript[0].text).toContain("role discussed = swe");
    expect(r.transcript[0].text).toContain("company = Acme");
    expect(r.transcript[0].text).toContain("≈ ₹28 LPA");
    expect(r.transcript[0].text).toContain("highest offer so far = ₹25 LPA");
  });

  it("compresses count = total - tail", () => {
    const t = mkTurns(45);
    const r = summarizeTranscriptIfLong(t, { threshold: 30, tailKeep: 10 });
    expect(r.transcript[0].text).toContain("35 turns compressed");
  });

  it("uses default threshold = 30", () => {
    const t = mkTurns(31);
    const r = summarizeTranscriptIfLong(t);
    expect(r.summarized).toBe(true);
  });

  it("does not mutate input array", () => {
    const t = mkTurns(40);
    const before = t.length;
    summarizeTranscriptIfLong(t, { threshold: 30, tailKeep: 10 });
    expect(t.length).toBe(before);
  });

  it("returns input verbatim on empty / undefined turns", () => {
    expect(summarizeTranscriptIfLong([]).summarized).toBe(false);
    expect(summarizeTranscriptIfLong([]).transcript).toEqual([]);
  });

  it("does NOT summarize when total <= tailKeep even if > threshold", () => {
    /* Pathological config — tailKeep larger than threshold. Should
     * gracefully return input unchanged rather than emit a negative
     * dropped-count. */
    const t = mkTurns(5);
    const r = summarizeTranscriptIfLong(t, { threshold: 3, tailKeep: 10 });
    expect(r.summarized).toBe(false);
    expect(r.transcript.length).toBe(5);
  });

  it("summary line surfaces candidateProfile flags when hasAny=true", () => {
    const t = mkTurns(40);
    const r = summarizeTranscriptIfLong(t, {
      threshold: 30,
      tailKeep: 10,
      candidateProfile: {
        careerGapMonths: 6,
        careerGapActivity: null,
        tenureSignal: "stable",
        levelMismatch: null,
        domainPivot: true,
        hasAny: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
    expect(r.transcript[0].text).toContain("gap=6mo");
    expect(r.transcript[0].text).toContain("domain-pivot");
  });
});
