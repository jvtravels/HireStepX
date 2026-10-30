import { describe, it, expect } from "vitest";
import {
  PUBLIC_OPENING_SELECT, OPENING_MAX_AGE_DAYS, isLiveOpening, toPublicOpening, liveOpenings,
  openingSlug, openingIdPrefix, findOpeningBySlug, experienceLabel, practiseHref, type OpeningRow,
} from "../../server-handlers/_public-openings-helpers";

const NOW = new Date("2026-10-30T10:00:00Z");
const ID = "0f3a9c21-1111-4222-8333-444455556666";

function row(over: Partial<OpeningRow> = {}): OpeningRow {
  return {
    id: ID, title: "Sales Executive", public_title: null, public_summary: "Own a territory and close inbound leads.",
    location: "Pune", locations: [], work_mode: "hybrid", experience_min: 1, experience_max: 3,
    skills: ["Negotiation", "CRM"], employment_type: "full-time", public_listing: "approved",
    public_approved_at: "2026-10-20T00:00:00Z", status: "ready", stage: "ai_matching", due_date: null, ...over,
  };
}

describe("isLiveOpening", () => {
  it("is live when both keys are on and nothing has expired", () => {
    expect(isLiveOpening(row(), NOW)).toBe(true);
  });
  it("is hidden unless admin approved (employer opt-in alone is not enough)", () => {
    expect(isLiveOpening(row({ public_listing: "employer_ok" }), NOW)).toBe(false);
    expect(isLiveOpening(row({ public_listing: "off" }), NOW)).toBe(false);
  });
  it("is hidden when closed, hired, or past its due date", () => {
    expect(isLiveOpening(row({ status: "closed" }), NOW)).toBe(false);
    expect(isLiveOpening(row({ stage: "hired" }), NOW)).toBe(false);
    expect(isLiveOpening(row({ due_date: "2026-10-29" }), NOW)).toBe(false);
    expect(isLiveOpening(row({ due_date: "2026-10-30" }), NOW)).toBe(true);
  });
  it("auto-hides 45 days after approval", () => {
    const old = new Date(NOW.getTime() - (OPENING_MAX_AGE_DAYS + 1) * 86_400_000).toISOString();
    const fresh = new Date(NOW.getTime() - (OPENING_MAX_AGE_DAYS - 1) * 86_400_000).toISOString();
    expect(isLiveOpening(row({ public_approved_at: old }), NOW)).toBe(false);
    expect(isLiveOpening(row({ public_approved_at: fresh }), NOW)).toBe(true);
  });
  it("needs an admin-written summary and an approval date", () => {
    expect(isLiveOpening(row({ public_summary: "  " }), NOW)).toBe(false);
    expect(isLiveOpening(row({ public_summary: null }), NOW)).toBe(false);
    expect(isLiveOpening(row({ public_approved_at: null }), NOW)).toBe(false);
  });
});

describe("anonymity", () => {
  const LEAKY = {
    ...row(),
    description: "Join Acme Corp's Pune team",
    responsibilities: "Report to the Acme VP",
    target_companies: ["Acme Corp"],
    preferred_colleges: ["IIT Acme"],
    perks_and_benefits: ["Acme stock"],
    department: "Acme Sales",
    budget_min: 900000,
  };

  it("never copies a field outside the allowlist, even if the row carries one", () => {
    const out = JSON.stringify(toPublicOpening(LEAKY));
    expect(out).not.toMatch(/acme/i);
    expect(out).not.toContain("900000");
  });

  it("never selects the free-text or sensitive columns from the database", () => {
    const cols = PUBLIC_OPENING_SELECT.split(",");
    for (const banned of ["description", "responsibilities", "nice_to_have", "target_companies", "preferred_colleges",
      "perks_and_benefits", "department", "budget_min", "budget_max", "employer_id", "preferred_industry", "relevant_experience"]) {
      expect(cols).not.toContain(banned);
    }
  });

  it("uses the admin title override when set", () => {
    expect(toPublicOpening(row({ title: "Sales Exec at Acme", public_title: "Sales Executive" })).title).toBe("Sales Executive");
  });
});

describe("slugs", () => {
  it("builds a stable slug from the title and the id, and finds it again", () => {
    const slug = openingSlug("Sales Executive (Pune)!", ID);
    expect(slug).toBe("sales-executive-pune-0f3a9c21");
    expect(openingIdPrefix(slug)).toBe("0f3a9c21");
    const [o] = liveOpenings([row({ title: "Sales Executive (Pune)!" })], NOW);
    expect(findOpeningBySlug([o], slug)).toEqual(o);
    expect(findOpeningBySlug([o], "sales-executive-pune-deadbeef")).toBeNull();
  });
  it("rejects slugs that do not end in an id", () => {
    expect(openingIdPrefix("sales-executive")).toBeNull();
  });
});

describe("liveOpenings", () => {
  it("drops non-live rows and lists newest first", () => {
    const a = row({ id: "aaaaaaaa-1111-4222-8333-444455556666", public_approved_at: "2026-10-10T00:00:00Z" });
    const b = row({ id: "bbbbbbbb-1111-4222-8333-444455556666", public_approved_at: "2026-10-25T00:00:00Z" });
    const c = row({ id: "cccccccc-1111-4222-8333-444455556666", public_listing: "employer_ok" });
    expect(liveOpenings([a, b, c], NOW).map((o) => o.slug.slice(-8))).toEqual(["bbbbbbbb", "aaaaaaaa"]);
  });
  it("caps skills at 8 and trims blanks", () => {
    const o = toPublicOpening(row({ skills: ["a", " ", "b", "c", "d", "e", "f", "g", "h", "i"] }));
    expect(o.skills).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });
});

describe("labels and links", () => {
  it("formats experience ranges", () => {
    expect(experienceLabel(null, null)).toBeNull();
    expect(experienceLabel(0, 1)).toBe("Fresher friendly");
    expect(experienceLabel(2, 4)).toBe("2 to 4 years");
    expect(experienceLabel(3, 3)).toBe("3 years");
    expect(experienceLabel(5, null)).toBe("5+ years");
    expect(experienceLabel(0, 3)).toBe("Up to 3 years");
  });
  it("carries role, skills and source through to sign-up", () => {
    const [o] = liveOpenings([row()], NOW);
    const q = new URL(practiseHref(o), "https://hirestepx.com").searchParams;
    expect(q.get("source")).toBe("openings");
    expect(q.get("role")).toBe("Sales Executive");
    expect(q.get("focus")).toBe("Negotiation,CRM");
    expect(q.get("opening")).toBe(o.slug);
  });
});
