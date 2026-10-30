import type { PublicOpening } from "./_public-openings-helpers";

/* Roles listed straight from code, with no database or admin step. Same rule as
 * the database path: never name the employer in any field here. A role hides
 * itself at expiresAt; remove the entry when it is filled. */
export const STATIC_OPENINGS: PublicOpening[] = [
  {
    slug: "sales-development-representative-international-saas",
    title: "Sales Development Representative (International SaaS)",
    summary:
      "Build a qualified sales pipeline across India, the US, UK, Europe, Middle East and ANZ. Research prospects, run email, LinkedIn and call outreach, and book meetings for the sales team. Remote, full-time, 1-2 years in SDR, BDR or inside sales.",
    location: "Remote (India)",
    workMode: "remote",
    experienceMin: 1,
    experienceMax: 2,
    skills: ["LinkedIn Sales Navigator", "Apollo", "HubSpot", "Salesforce", "Email sequencing"],
    employmentType: "full-time",
    listedAt: "2026-10-30T00:00:00.000Z",
    expiresAt: "2026-12-14T00:00:00.000Z",
  },
];

export function liveStaticOpenings(now: Date = new Date()): PublicOpening[] {
  return STATIC_OPENINGS.filter((o) => Date.parse(o.expiresAt) > now.getTime());
}
