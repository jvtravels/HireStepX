/* RC-3 (2026-07-18) — fabricated-employer gate.
 *
 * Company proper-noun analogue of the number-subset rule in validateRestyle.
 * The recruiter may name only the seat/target company, the candidate's stated
 * current employer, a disclosed competing-offer company, or a company the
 * kernel itself named in this-turn canonical. A curated-company label the LLM
 * restyle introduces outside that set ("unlike your stint at Infosys…") is a
 * fabricated employer reference → canonical fallback. Matching is case-
 * sensitive on the proper label form so lowercase common words never trip. */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  validateRestyle,
  detectFabricatedEmployer,
} from "../../server-handlers/_response-pipeline";

const BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 34,
  walkAway: 18,
  hasEquity: true,
};

// Seat company is a curated known company so a legitimate self-mention passes.
const mkState = (over?: Partial<NegotiationState>): NegotiationState => ({
  ...initState({ sessionId: "fab-emp", role: "swe", company: "google", band: BAND }),
  ...over,
});

describe("validateRestyle — fabricated-employer gate (RC-3)", () => {
  it("rejects a restyle that names a third company neither seat, current, nor competing", () => {
    const canonical =
      "On the base — we can move to ₹30L, and I'll take the equity ask back to the panel.";
    const bad =
      "On the base — we can move to ₹30L. Honestly, unlike your stint at Infosys, we reward impact fast.";
    const r = validateRestyle(canonical, bad, mkState());
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("fabricated-employer:Infosys");
  });

  it("allows the seat/target company to be named", () => {
    const canonical = "At Google, this grade carries a broad band — let me get the base to ₹30L.";
    const ok = "Here at Google the band on this grade is wide, so I can take the base to ₹30L.";
    const r = validateRestyle(canonical, ok, mkState());
    expect(r.valid).toBe(true);
  });

  it("allows the candidate's stated current employer", () => {
    const canonical = "On your current side — I hear you, let me see what I can do on the base.";
    const ok = "On your current comp at Flipkart — I hear you; let me work the base up.";
    const r = validateRestyle(canonical, ok, mkState({ currentEmployer: "Flipkart" }));
    expect(r.valid).toBe(true);
  });

  it("allows a disclosed competing-offer company via the action", () => {
    const canonical =
      "You'd mentioned the competing offer from Amazon — would you mind sharing the letter?";
    const ok =
      "On that Amazon offer you flagged — could you share the letter, even redacted? Helps me push the panel.";
    const action = { kind: "fake-leverage-challenge", competingCompany: "Amazon" } as never;
    const r = validateRestyle(canonical, ok, mkState(), action);
    expect(r.valid).toBe(true);
  });

  it("allows any company the kernel already named in this-turn canonical", () => {
    const canonical = "Teams like Swiggy pay aggressively here, and we're competitive — base to ₹30L.";
    const ok = "Teams like Swiggy do pay aggressively, and we're right there — base to ₹30L.";
    const r = validateRestyle(canonical, ok, mkState());
    expect(r.valid).toBe(true);
  });

  it("does NOT false-trip on lowercase common words that collide with labels", () => {
    // "apple" (fruit), "meta" (prefix), "oracle" (noun) — none are the proper label form.
    const canonical = "Let me get the base up to ₹30L for you.";
    const restyled =
      "You're the apple of the panel's eye on this one — let me get the base to ₹30L, no meta games.";
    const r = validateRestyle(canonical, restyled, mkState());
    expect(r.valid).toBe(true);
  });

  it("pure helper: returns the offending label and respects the allow-set", () => {
    expect(detectFabricatedEmployer("base to 30L", "we beat Infosys", [])).toBe("Infosys");
    expect(detectFabricatedEmployer("base to 30L", "we beat Infosys", ["infosys"])).toBeNull();
    expect(detectFabricatedEmployer("base to 30L", "we beat Infosys", ["Infosys"])).toBeNull();
    expect(detectFabricatedEmployer("we beat Infosys", "we beat Infosys", [])).toBeNull();
    expect(detectFabricatedEmployer("base to 30L", "no company here", [])).toBeNull();
  });
});
