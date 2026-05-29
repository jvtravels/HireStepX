/* Recruiter memory-callback feature (2026-05-29).
 *
 * Covers two new NextAction kinds added in the same change:
 *   - callback-prior-context: periodically surfaces ONE earlier-stated
 *     candidate fact ("you mentioned X earlier — ...") so the recruiter
 *     sounds like they're tracking the conversation.
 *   - competing-offer-warm-ack: pure respectful acknowledgment of the
 *     candidate's market value the first turn after a competingOffer
 *     claim lands.
 *
 * The sub-planners (`maybePlanCallbackPriorContext`,
 * `maybePlanCompetingOfferWarmAck`) are exercised directly so the suite
 * is decoupled from the rest of the cascade.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
  type DiscoveryTopic,
  type UserClaims,
} from "../../server-handlers/_negotiation-kernel";
import {
  maybePlanCallbackPriorContext,
  maybePlanCompetingOfferWarmAck,
} from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};

const make = (
  overrides: Partial<NegotiationState> = {},
): NegotiationState => ({
  ...initState({
    sessionId: "memory-callback-test",
    role: "swe",
    company: "acme",
    band: BAND,
  }),
  /* Default to "opening" so the new memory-callback gates (which
   * fire only in early phases) are exercised; tests override as
   * needed. */
  phase: "opening",
  ...overrides,
});

const claims = (partial: UserClaims): UserClaims => partial;

describe("callback-prior-context", () => {
  it("fires once after turn 3 when userClaims has at least one recorded fact", () => {
    const s = make({
      turnIndex: 5,
      userClaims: claims({
        currentCtc: { value: 18, firstSeenTurn: 1 },
      }),
    });
    const a = maybePlanCallbackPriorContext(s);
    expect(a).not.toBeNull();
    expect(a!.kind).toBe("callback-prior-context");
    if (a!.kind === "callback-prior-context") {
      expect(a!.claim).toBe("currentCtc");
      expect(a!.value).toBe(18);
    }
  });

  it("does NOT fire when userClaims is empty / missing", () => {
    const s1 = make({ turnIndex: 5 });
    expect(maybePlanCallbackPriorContext(s1)).toBeNull();
    const s2 = make({ turnIndex: 5, userClaims: {} });
    expect(maybePlanCallbackPriorContext(s2)).toBeNull();
  });

  it("does NOT fire before turn 4 (need facts to call back to)", () => {
    const s = make({
      turnIndex: 3,
      userClaims: claims({
        currentCtc: { value: 18, firstSeenTurn: 1 },
      }),
    });
    expect(maybePlanCallbackPriorContext(s)).toBeNull();
  });

  it("picks the MOST RECENT recorded claim when multiple are present", () => {
    const s = make({
      turnIndex: 6,
      userClaims: claims({
        currentCtc: { value: 18, firstSeenTurn: 1 },
        noticePeriod: { value: 60, firstSeenTurn: 2 },
        competingOffer: {
          value: { company: "PhonePe", amount: 26 },
          firstSeenTurn: 4,
        },
      }),
    });
    const a = maybePlanCallbackPriorContext(s);
    expect(a).not.toBeNull();
    if (a!.kind === "callback-prior-context") {
      expect(a!.claim).toBe("competingOffer");
      expect(a!.firstSeenTurn).toBe(4);
      expect(a!.companyLabel).toBe("PhonePe");
    }
  });

  it("does NOT double-fire once stamped in reactiveFollowupsFired", () => {
    const s = make({
      turnIndex: 5,
      userClaims: claims({
        currentCtc: { value: 18, firstSeenTurn: 1 },
      }),
      reactiveFollowupsFired: [
        "callback-prior-context" as DiscoveryTopic,
      ],
    });
    expect(maybePlanCallbackPriorContext(s)).toBeNull();
  });

  it("renders formal prose for BFSI / consulting and casual prose for unicorn", () => {
    /* BFSI — formal lead. */
    const sBfsi = make({
      turnIndex: 4,
      recruiterSectorPersona: "bfsi",
      userClaims: claims({
        currentCtc: { value: 18, firstSeenTurn: 1 },
      }),
    });
    const aBfsi = maybePlanCallbackPriorContext(sBfsi)!;
    const proseBfsi = renderCanonicalProse(aBfsi, sBfsi);
    expect(proseBfsi.toLowerCase()).toMatch(/earlier in our conversation|to revisit/i);

    /* Unicorn — casual lead. */
    const sUnicorn = make({
      turnIndex: 4,
      recruiterSectorPersona: "indian-unicorn",
      userClaims: claims({
        currentCtc: { value: 18, firstSeenTurn: 1 },
      }),
    });
    const aUni = maybePlanCallbackPriorContext(sUnicorn)!;
    const proseUni = renderCanonicalProse(aUni, sUnicorn);
    expect(proseUni.toLowerCase()).not.toMatch(/earlier in our conversation/i);
    /* casual flavour cue */
    expect(proseUni.toLowerCase()).toMatch(/(you said|anchor|right now|you're at)/i);
  });
});

describe("competing-offer-warm-ack", () => {
  it("fires once when userClaims.competingOffer is recorded", () => {
    const s = make({
      turnIndex: 3,
      userClaims: claims({
        competingOffer: {
          value: { company: "Razorpay", amount: 32 },
          firstSeenTurn: 2,
        },
      }),
    });
    const a = maybePlanCompetingOfferWarmAck(s);
    expect(a).not.toBeNull();
    expect(a!.kind).toBe("competing-offer-warm-ack");
    if (a!.kind === "competing-offer-warm-ack") {
      expect(a!.company).toBe("Razorpay");
      expect(a!.amountLpa).toBe(32);
    }
  });

  it("does NOT fire when no competingOffer claim exists", () => {
    const s = make({
      turnIndex: 3,
      userClaims: claims({
        currentCtc: { value: 18, firstSeenTurn: 1 },
      }),
    });
    expect(maybePlanCompetingOfferWarmAck(s)).toBeNull();
  });

  it("does NOT double-fire once stamped in reactiveFollowupsFired", () => {
    const s = make({
      turnIndex: 3,
      userClaims: claims({
        competingOffer: {
          value: { company: "Razorpay", amount: 32 },
          firstSeenTurn: 2,
        },
      }),
      reactiveFollowupsFired: [
        "competing-offer-warm-ack" as DiscoveryTopic,
      ],
    });
    expect(maybePlanCompetingOfferWarmAck(s)).toBeNull();
  });

  it("skips when priorContext.existingCompetingOffer already covers the same conversational role", () => {
    const s = make({
      turnIndex: 3,
      priorContext: {
        existingCompetingOffer: {
          company: "Razorpay",
          amountLpa: 32,
          signed: false,
        },
      },
      userClaims: claims({
        competingOffer: {
          value: { company: "Razorpay", amount: 32 },
          firstSeenTurn: 2,
        },
      }),
    });
    expect(maybePlanCompetingOfferWarmAck(s)).toBeNull();
  });

  it("renders genuinely respectful market-value prose (not a negotiation pushback)", () => {
    const s = make({
      turnIndex: 3,
      userClaims: claims({
        competingOffer: {
          value: { company: "Razorpay", amount: 32 },
          firstSeenTurn: 2,
        },
      }),
    });
    const a = maybePlanCompetingOfferWarmAck(s)!;
    const prose = renderCanonicalProse(a, s);
    expect(prose).toMatch(/Razorpay/);
    /* Warm acknowledgment language — not a pushback. */
    expect(prose.toLowerCase()).toMatch(
      /(market value|where you stand in the market|real signal|neighborhood|range)/i,
    );
  });
});
