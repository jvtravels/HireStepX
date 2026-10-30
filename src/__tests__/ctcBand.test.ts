import { describe, it, expect } from "vitest";
import { ctcBand, parseCtcLpa, readAvailabilityConfirmedAt, sharedCtcBand } from "../../server-handlers/_ctc-band";
import { extractResumeDetail } from "../../server-handlers/_resume-detail-helpers";
import { availabilityConfirmedLabel, buildInterviewQuestions } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";

describe("parseCtcLpa", () => {
  it.each([
    ["24 LPA", 24],
    ["₹24,00,000", 24],
    ["20-26L", 26],
    ["1.2 Cr", 120],
    ["18 lakhs per annum", 18],
    ["2400000", 24],
  ])("%s -> %s", (text, lpa) => expect(parseCtcLpa(text)).toBe(lpa));

  it("returns null for unusable text", () => {
    expect(parseCtcLpa("negotiable")).toBeNull();
    expect(parseCtcLpa("")).toBeNull();
    expect(parseCtcLpa(null)).toBeNull();
    expect(parseCtcLpa("90k")).toBeNull();
  });
});

describe("ctcBand", () => {
  it("brackets the figure without equalling it", () => {
    expect(ctcBand("24 LPA")).toBe("₹21–27 LPA");
    expect(ctcBand("10 LPA")).toBe("₹9–11 LPA");
  });
  it("never narrower than two lakh", () => {
    expect(ctcBand("3 LPA")).toBe("₹2–4 LPA");
  });
  it("is null when nothing parses", () => expect(ctcBand("depends")).toBeNull());
});

describe("sharedCtcBand + extractResumeDetail", () => {
  const ai = (extra: Record<string, unknown>) => ({ _type: "ai", topSkills: ["x"], expectedCtc: "24 LPA", ...extra });

  it("exposes a band only when the candidate opted in", () => {
    expect(sharedCtcBand(ai({}))).toBeNull();
    expect(sharedCtcBand(ai({ shareCtcBand: false }))).toBeNull();
    expect(sharedCtcBand(ai({ shareCtcBand: true }))).toBe("₹21–27 LPA");
    expect(sharedCtcBand(ai({ shareCtcBand: "yes" }))).toBeNull();
  });

  it("carries the band and a valid confirmation date into the resume detail", () => {
    const iso = new Date(Date.now() - 3 * 86_400_000).toISOString();
    const d = extractResumeDetail(ai({ shareCtcBand: true, availabilityConfirmedAt: iso }));
    expect(d.expectedCtcBand).toBe("₹21–27 LPA");
    expect(d.availabilityConfirmedAt).toBe(iso);
  });

  it("defaults to nothing shared", () => {
    const d = extractResumeDetail(ai({}));
    expect(d.expectedCtcBand).toBeNull();
    expect(d.availabilityConfirmedAt).toBeNull();
  });
});

describe("readAvailabilityConfirmedAt", () => {
  const now = Date.parse("2026-10-27T00:00:00Z");
  it("accepts past dates and drops junk or far-future ones", () => {
    expect(readAvailabilityConfirmedAt("2026-10-20T00:00:00Z", now)).toBe("2026-10-20T00:00:00.000Z");
    expect(readAvailabilityConfirmedAt("not a date", now)).toBeNull();
    expect(readAvailabilityConfirmedAt("2030-01-01T00:00:00Z", now)).toBeNull();
    expect(readAvailabilityConfirmedAt(42, now)).toBeNull();
  });
});

describe("availabilityConfirmedLabel", () => {
  const now = Date.parse("2026-10-27T12:00:00Z");
  it("labels recent and stale confirmations", () => {
    expect(availabilityConfirmedLabel("2026-10-27T01:00:00Z", now)).toEqual({ text: "Confirmed today", stale: false });
    expect(availabilityConfirmedLabel("2026-10-24T12:00:00Z", now)).toEqual({ text: "Confirmed 3d ago", stale: false });
    expect(availabilityConfirmedLabel("2026-08-01T00:00:00Z", now)?.stale).toBe(true);
    expect(availabilityConfirmedLabel(null, now)).toBeNull();
  });
});

describe("buildInterviewQuestions", () => {
  const cand = (periods: string[]) => ({ resume: { experience: periods.map((period) => ({ title: "Eng", company: "", period })) } }) as never;
  it("asks about each unmatched skill first, max three questions", () => {
    const q = buildInterviewQuestions(cand([]), { title: "Backend Engineer" }, ["Kafka", "Go", "Redis"]);
    expect(q).toHaveLength(3);
    expect(q[0]).toContain("Kafka");
    expect(q[1]).toContain("Go");
    expect(q.join(" ")).not.toContain("Redis");
  });
  it("falls back to a role-specific question", () => {
    const q = buildInterviewQuestions(cand([]), { title: "Backend Engineer" }, []);
    expect(q).toHaveLength(3);
    expect(q[0]).toContain("Backend Engineer");
  });
});
