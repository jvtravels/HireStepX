import { describe, it, expect } from "vitest";
import { analyzeDrift, mean, parseSessionRows, providerOfModel, type ScoredSession } from "../../server-handlers/_llm-drift-helpers";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 13);

function batch(model: string, score: number, count: number, daysAgo: number): ScoredSession[] {
  return Array.from({ length: count }, (_, i) => ({ model, score: score + (i % 3) - 1, at: NOW - daysAgo * DAY - i * 1000 }));
}

describe("providerOfModel", () => {
  it("maps model ids to chain providers", () => {
    expect(providerOfModel("gemini-2.5-flash")).toBe("gemini");
    expect(providerOfModel("cloudflare-@cf/openai/gpt-oss-120b")).toBe("cloudflare");
    expect(providerOfModel("openai/gpt-oss-120b")).toBe("groq");
    expect(providerOfModel("mystery")).toBe("other");
  });
});

describe("parseSessionRows", () => {
  it("keeps valid rows and drops zero, out-of-range and malformed ones", () => {
    const rows = [
      { model: "gemini-2.5-flash", score: "72", created_at: "2026-10-12T00:00:00Z" },
      { model: "gemini-2.5-flash", score: "0", created_at: "2026-10-12T00:00:00Z" },
      { model: "gemini-2.5-flash", score: "140", created_at: "2026-10-12T00:00:00Z" },
      { model: "", score: "50", created_at: "2026-10-12T00:00:00Z" },
      { model: "x", score: "50", created_at: "nope" },
    ];
    expect(parseSessionRows(rows)).toHaveLength(1);
    expect(parseSessionRows(null)).toEqual([]);
  });
});

describe("analyzeDrift", () => {
  const recentMs = 3 * DAY;

  it("reports nothing for a stable, single-provider distribution", () => {
    const s = [...batch("gemini-2.5-flash", 70, 30, 1), ...batch("gemini-2.5-flash", 70, 40, 10)];
    expect(analyzeDrift(s, NOW, recentMs)).toEqual([]);
  });

  it("flags a score shift between recent and baseline", () => {
    const s = [...batch("gemini-2.5-flash", 58, 30, 1), ...batch("gemini-2.5-flash", 70, 40, 10)];
    const f = analyzeDrift(s, NOW, recentMs);
    expect(f.map((x) => x.kind)).toContain("shift");
  });

  it("does not flag on too few samples", () => {
    const s = [...batch("gemini-2.5-flash", 40, 5, 1), ...batch("gemini-2.5-flash", 70, 40, 10)];
    expect(analyzeDrift(s, NOW, recentMs)).toEqual([]);
  });

  it("flags a gap between providers grading the same period", () => {
    const s = [...batch("gemini-2.5-flash", 75, 20, 1), ...batch("cloudflare-@cf/openai/gpt-oss-120b", 55, 20, 1)];
    expect(analyzeDrift(s, NOW, recentMs).map((x) => x.kind)).toContain("provider-gap");
  });

  it("flags a non-primary provider carrying most recent reports", () => {
    const s = [...batch("openai/gpt-oss-120b", 70, 25, 1), ...batch("gemini-2.5-flash", 70, 5, 1)];
    expect(analyzeDrift(s, NOW, recentMs).map((x) => x.kind)).toContain("fallback-share");
  });

  it("mean of nothing is 0", () => {
    expect(mean([])).toBe(0);
  });
});
