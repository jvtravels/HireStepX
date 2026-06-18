/* F4 + F5 + F6 (Audit Pass 2, PDF#25, 2026-05-16) — opener polish set.
 *
 * F4: opener references resumeFactPack.latestRole.companyName / title
 *     when present; falls back to a generic opener when ResumeFactPack
 *     is absent. Must not fabricate facts.
 * F5: probe templates carry NO "as per your current band" / "for your
 *     current band" tautology (the candidate doesn't have a band — that
 *     phrase only makes sense when the recruiter is anchoring against
 *     OUR band; "your current band" is structural nonsense).
 * F6: trailing "first" promise dropped from the generic opener so the
 *     bot doesn't owe a second probe we never queued. */
import { describe, it, expect } from "vitest";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";
import type { ResumeFactPack } from "../../server-handlers/_resume-fact-pack";

const BAND: NegotiationBand = { initialOffer: 22, maxStretch: 30, walkAway: 18, hasEquity: false };

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  const s = initState({ sessionId: "s-opener", role: "swe", company: "acme", band: BAND });
  return Object.assign(s, overrides);
}

const OPEN: NextAction = { kind: "open-with-offer" } as NextAction;

describe("F4 — resume-aware opener", () => {
  it("opener cites latestRole.companyName when ResumeFactPack present", () => {
    const rfp: ResumeFactPack = {
      priorCompanies: [],
      stackTags: [],
      tenurePattern: "unknown" as never,
      mbaTier: "none" as never,
      leadershipClaimed: false,
      gapMonths: null,
      topAchievement: null,
      latestRole: {
        title: "Senior Product Designer",
        companyName: "Flipkart",
        companyTier: "unicorn",
      },
    };
    const s = mkState({ resumeFactPack: rfp, turnIndex: 0 });
    const line = renderCanonicalProse(OPEN, s);
    expect(line).toMatch(/Flipkart/);
    expect(line).toMatch(/Senior Product Designer/);
  });

  it("opener falls back to generic copy when ResumeFactPack absent", () => {
    /* FL1 (PDF#27, 2026-05-17) — generic opener now ends in a concrete
     * CTC ask instead of the ambiguous "compensation structure"
     * phrasing. The "Let's get straight into it" lead-in is retained. */
    const s = mkState({ resumeFactPack: null, turnIndex: 0 });
    const line = renderCanonicalProse(OPEN, s);
    expect(line).not.toMatch(/Flipkart|Razorpay|Infosys/);
    expect(line).toMatch(/Let's get straight into it/);
    expect(line).toMatch(/current CTC/i);
    expect(line).not.toMatch(/compensation structure/i);
  });

  it("opener falls back to generic when latestRole.companyName is empty", () => {
    const rfp: ResumeFactPack = {
      priorCompanies: [],
      stackTags: [],
      tenurePattern: "unknown" as never,
      mbaTier: "none" as never,
      leadershipClaimed: false,
      gapMonths: null,
      topAchievement: null,
      latestRole: { title: "", companyName: "", companyTier: "" },
    };
    const s = mkState({ resumeFactPack: rfp, turnIndex: 0 });
    const line = renderCanonicalProse(OPEN, s);
    expect(line).toMatch(/Let's get straight into it/);
  });

  it("opener does NOT fabricate seniority / team-size facts", () => {
    const rfp: ResumeFactPack = {
      priorCompanies: [],
      stackTags: [],
      tenurePattern: "unknown" as never,
      mbaTier: "none" as never,
      leadershipClaimed: false,
      gapMonths: null,
      topAchievement: null,
      latestRole: {
        title: "Software Engineer",
        companyName: "Razorpay",
        companyTier: "unicorn",
      },
    };
    const s = mkState({ resumeFactPack: rfp, turnIndex: 0 });
    const line = renderCanonicalProse(OPEN, s);
    /* Must not invent "team of N", "reporting to X", "managing M",
     * "X years of experience" — ResumeFactPack doesn't carry those
     * facts in a form we can safely surface here. */
    expect(line).not.toMatch(/\bteam of\b|\breporting to\b|\bmanaging\b|years of experience/i);
  });
});

describe("F5 — 'as per your current band' tautology absent from probe templates", () => {
  /* The candidate's "current band" is structurally a tautology: their
   * current CTC is set BY their current employer's band, so "current
   * CTC as per your current band" is circular. Probe templates must
   * not bake the phrase in. */
  const probeKinds: NextAction["kind"][] = [
    "discovery-probe",
    "probe-expectations",
    "probe-justification",
    "probe-mismatch",
  ];

  it("no probe-side canonical line contains 'as per your current band'", () => {
    const s = mkState();
    for (const kind of probeKinds) {
      const action = (
        kind === "discovery-probe"
          ? { kind, item: "currentCtc" }
          : { kind }
      ) as NextAction;
      const line = renderCanonicalProse(action, s);
      expect(
        line.toLowerCase().includes("as per your current band") ||
          line.toLowerCase().includes("for your current band"),
      ).toBe(false);
    }
  });
});

describe("F6 — opener drops 'first' promise", () => {
  it("turn-0 generic opener does not promise a 'first' probe", () => {
    /* "walk me through your current compensation structure first." was
     * the old line. The "first" promised a second probe we didn't queue.
     * FL1 (PDF#27) further replaces the "compensation structure" ask
     * with a concrete CTC ask. The opener line ends at the concrete ask
     * (a "?"). */
    const s = mkState({ resumeFactPack: null, turnIndex: 0 });
    const line = renderCanonicalProse(OPEN, s);
    expect(line).not.toMatch(/structure first/i);
    expect(line).not.toMatch(/\bfirst\b/i);
    expect(line).toMatch(/current CTC/i);
  });
});

describe("FL1 (PDF#27 Audit Pass 4) — concrete opener ask", () => {
  it("default (entry/mid) candidate gets the 'at the moment' framing", () => {
    const s = mkState({ resumeFactPack: null, turnIndex: 0, candidateApplicableYoe: 2 });
    const line = renderCanonicalProse(OPEN, s);
    expect(line).toMatch(/current CTC at the moment\?/);
  });

  it("senior YoE (>=4) candidate gets the 'total annual' framing", () => {
    const s = mkState({ resumeFactPack: null, turnIndex: 0, candidateApplicableYoe: 6 });
    const line = renderCanonicalProse(OPEN, s);
    expect(line).toMatch(/current CTC — total annual\?/);
  });

  it("role matches /senior|lead|principal|staff/i triggers senior framing", () => {
    const seniorRoles = ["Senior Engineer", "Tech Lead", "Principal SDE", "Staff Designer"];
    for (const role of seniorRoles) {
      const s = mkState({ resumeFactPack: null, turnIndex: 0, role });
      const line = renderCanonicalProse(OPEN, s);
      expect(line).toMatch(/current CTC — total annual\?/);
    }
  });

  it("opener no longer asks for 'compensation structure' / 'walk me through'", () => {
    const s = mkState({ resumeFactPack: null, turnIndex: 0 });
    const line = renderCanonicalProse(OPEN, s);
    expect(line).not.toMatch(/compensation structure/i);
    expect(line).not.toMatch(/walk me through your current/i);
  });
});
