import { describe, it, expect } from "vitest";
import { buildJobPostingJsonLd, openingMetaTitle, openingMetaDescription } from "../../server-handlers/_openings-seo";
import { STATIC_OPENINGS } from "../../server-handlers/_static-openings";
import type { PublicOpening } from "../../server-handlers/_public-openings-helpers";

const base: PublicOpening = {
  slug: "sales-executive-0f3a9c21", title: "Sales Executive", summary: "Own a territory and close inbound leads.",
  location: "Pune, Maharashtra", workMode: "hybrid", experienceMin: 1, experienceMax: 3, skills: ["CRM", "Negotiation"],
  employmentType: "full-time", listedAt: "2026-10-20T00:00:00.000Z", expiresAt: "2026-12-04T00:00:00.000Z",
};

describe("buildJobPostingJsonLd", () => {
  it("attributes the posting to HireStepX, never an employer", () => {
    const j = buildJobPostingJsonLd(base);
    expect(j["@type"]).toBe("JobPosting");
    expect(j.hiringOrganization.name).toBe("HireStepX");
    expect(j.datePosted).toBe("2026-10-20");
    expect(j.validThrough).toBe(base.expiresAt);
    expect(j.employmentType).toBe("FULL_TIME");
    expect(j.directApply).toBe(false);
  });
  it("uses a city address for on-site and hybrid roles", () => {
    const j = buildJobPostingJsonLd(base) as { jobLocation?: { address: { addressLocality: string; addressCountry: string } } };
    expect(j.jobLocation?.address).toEqual({ "@type": "PostalAddress", addressLocality: "Pune", addressCountry: "IN" });
  });
  it("marks remote roles as telecommute limited to India", () => {
    const j = buildJobPostingJsonLd({ ...base, workMode: "remote", location: "Remote (India)" }) as Record<string, unknown>;
    expect(j.jobLocationType).toBe("TELECOMMUTE");
    expect(j.jobLocation).toBeUndefined();
  });
  it("converts minimum experience to months", () => {
    const j = buildJobPostingJsonLd(base) as { experienceRequirements?: { monthsOfExperience: number } };
    expect(j.experienceRequirements?.monthsOfExperience).toBe(12);
  });
  it("escapes markup in the description", () => {
    expect(buildJobPostingJsonLd({ ...base, summary: "a <script>x</script>" }).description).not.toContain("<script>");
  });
  it("builds for every static role", () => {
    for (const o of STATIC_OPENINGS) expect(buildJobPostingJsonLd(o).title).toBe(o.title);
  });
});

describe("meta title and description", () => {
  it("adds work mode and falls back to a short title", () => {
    expect(openingMetaTitle(base)).toBe("Sales Executive (Hybrid, Pune, Maharashtra) | HireStepX");
    expect(openingMetaTitle({ ...base, title: "x".repeat(70) })).toBe(`${"x".repeat(70)} | HireStepX`);
  });
  it("stays within a snippet-friendly length", () => {
    for (const o of [base, ...STATIC_OPENINGS]) expect(openingMetaDescription(o).length).toBeLessThanOrEqual(200);
  });
});
