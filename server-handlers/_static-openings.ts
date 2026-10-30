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
    department: "sales",
    details: {
      about:
        "An expanding SaaS business is looking for an SDR to build a qualified sales pipeline in India and international markets. You will identify potential customers, start conversations across email, LinkedIn and calls, qualify opportunities, and arrange meetings for the sales team. The role suits someone who enjoys outbound sales, thoughtful research and learning how different markets buy software.",
      responsibilities: [
        "Research relevant companies and decision-makers across assigned markets and build high-quality prospect lists.",
        "Run personalised outbound sequences using email, LinkedIn and calls.",
        "Follow up promptly on inbound enquiries, demo requests and other relevant leads.",
        "Hold initial discovery conversations to understand prospect needs, fit and buying readiness.",
        "Book qualified meetings and hand over clear notes and context to the sales team.",
        "Keep accurate CRM records, outreach activity and pipeline updates.",
        "Share recurring customer objections, competitor insights and messaging feedback.",
        "Test outreach approaches by segment, market and channel, and help build a repeatable sales playbook.",
      ],
      requirements: [
        "1 to 2 years of experience in SDR, BDR, inside sales or software business development.",
        "Experience generating qualified meetings or pipeline. International prospecting experience is preferred.",
        "Strong spoken and written English, and confidence engaging founders and senior decision-makers.",
        "Hands-on familiarity with tools such as LinkedIn Sales Navigator, Apollo, HubSpot, Salesforce or email sequencing platforms.",
        "Organised, resilient and self-directed, with the flexibility to overlap with international time zones.",
      ],
      goodToHave: [
        "Exposure to SaaS for e-commerce, D2C brands, marketing technology or analytics.",
        "Understanding of Shopify, Amazon, digital advertising or common e-commerce business metrics.",
        "Experience at an early-stage startup, or building outbound outreach for a new market.",
      ],
      success: [
        { label: "First 30 days", text: "Learn the offering, target customers and competitive landscape. Build prospect lists and launch the first sequences." },
        { label: "By 60 days", text: "Run an organised outreach rhythm and consistently generate qualified sales conversations." },
        { label: "By 90 days", text: "Improve meeting quality and conversion, refine messaging and document what works by region." },
      ],
      offers: [
        "Fully remote working arrangement.",
        "Competitive compensation, with details shared during the selection process.",
        "Exposure to international sales and a path towards larger account responsibilities.",
        "Close collaboration with sales leadership in a growing business.",
      ],
    },
    listedAt: "2026-10-30T00:00:00.000Z",
    expiresAt: "2026-12-14T00:00:00.000Z",
  },
];

export function liveStaticOpenings(now: Date = new Date()): PublicOpening[] {
  return STATIC_OPENINGS.filter((o) => Date.parse(o.expiresAt) > now.getTime());
}
