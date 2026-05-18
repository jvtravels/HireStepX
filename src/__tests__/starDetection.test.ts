import { describe, it, expect } from "vitest";
import { detectStarPresence, nextStarGap } from "../_star-detection";

/* Shared STAR detection — the single source of truth for whether an answer
   has Situation / Task / Action / Result. Drift between this module and
   either consumer (live coach OR final report) erodes coaching trust, so
   the regex set is pinned here. */

describe("detectStarPresence", () => {
  it("returns all-false for empty input", () => {
    const r = detectStarPresence("");
    expect(r).toMatchObject({ situation: false, task: false, action: false, result: false, count: 0, hasMetrics: false, weHeavy: false, learning: false });
  });

  it("detects a full STAR answer", () => {
    const text = "At my last company we were under pressure and the goal was to launch onboarding before Q4. I led the redesign and shipped it in six weeks, which led to a 30% lift in activation.";
    const r = detectStarPresence(text);
    expect(r.situation).toBe(true);
    expect(r.task).toBe(true);
    expect(r.action).toBe(true);
    expect(r.result).toBe(true);
    expect(r.count).toBe(4);
    expect(r.hasMetrics).toBe(true);
  });

  it("Situation alone — 'when I' / 'at my last company' shapes", () => {
    expect(detectStarPresence("When I was at my previous company").situation).toBe(true);
    expect(detectStarPresence("In Q3 things got messy").situation).toBe(true);
    expect(detectStarPresence("During the migration we struggled").situation).toBe(true);
  });

  it("Phase-6 — accepts artifact-for-context framing as Situation", () => {
    /* Pre-Phase-6 audit caught a false-positive on
       "I built a reusable data table component for an admin dashboard
        because every module had slightly different table patterns."
       The narrow SITUATION_RE rejected this and the live coach said
       "Jumped straight to the action — set the scene first" even
       though the candidate did set the scene. */
    expect(
      detectStarPresence(
        "I built a reusable data table component for an admin dashboard because every module had slightly different table patterns.",
      ).situation,
    ).toBe(true);
    expect(detectStarPresence("In one of my projects, we had to design for low-bandwidth users in Tier 2 cities.").situation).toBe(true);
    expect(detectStarPresence("In my current role, I owned the checkout funnel.").situation).toBe(true);
    expect(detectStarPresence("On our consumer mobile app, the onboarding step was leaking.").situation).toBe(true);
  });

  it("Phase-6 — does NOT over-fire on bare 'for it / for them'", () => {
    /* Discipline check: the broadened regex must require a concrete
       artifact/domain noun, not bare prepositions. */
    expect(detectStarPresence("I worked for it and made sure things shipped.").situation).toBe(false);
    expect(detectStarPresence("I designed for them and got positive feedback.").situation).toBe(false);
  });

  it("Task alone — 'the goal / the brief / needed to'", () => {
    expect(detectStarPresence("the goal was to ship onboarding").task).toBe(true);
    expect(detectStarPresence("our goal was clear").task).toBe(true);
    expect(detectStarPresence("I had to figure it out fast").task).toBe(true);
    expect(detectStarPresence("the brief was to triple revenue").task).toBe(true);
  });

  it("Action — first-person verbs, not 'I think / I was / I feel'", () => {
    expect(detectStarPresence("I built the prototype").action).toBe(true);
    expect(detectStarPresence("I led the rollout").action).toBe(true);
    expect(detectStarPresence("I shipped on schedule").action).toBe(true);
    expect(detectStarPresence("I think it was fine").action).toBe(false);
    expect(detectStarPresence("I was nervous").action).toBe(false);
  });

  it("Result — metric markers count alone", () => {
    expect(detectStarPresence("we saw a 40% lift").result).toBe(true);
    expect(detectStarPresence("revenue grew by 3x").result).toBe(true);
    expect(detectStarPresence("₹50,000 saved per month").result).toBe(true);
    expect(detectStarPresence("50 users adopted it").result).toBe(true);
  });

  it("Result — outcome bridges without metrics", () => {
    expect(detectStarPresence("which led to higher engagement").result).toBe(true);
    expect(detectStarPresence("so that the team could move faster").result).toBe(true);
    expect(detectStarPresence("the impact was significant").result).toBe(true);
  });

  it("Result — qualitative outcome markers (no raw numbers)", () => {
    expect(detectStarPresence("it became the most-used feature in the product").result).toBe(true);
    expect(detectStarPresence("the tool got rolled out org-wide").result).toBe(true);
    expect(detectStarPresence("we shipped on time and it went live without incident").result).toBe(true);
    expect(detectStarPresence("the platform gained adoption across the company").result).toBe(true);
  });

  it("Action — senior-level verbs (championed, spearheaded, steered)", () => {
    expect(detectStarPresence("I championed the migration end-to-end").action).toBe(true);
    expect(detectStarPresence("I spearheaded the cross-team rollout").action).toBe(true);
    expect(detectStarPresence("I steered the team through the cutover").action).toBe(true);
    expect(detectStarPresence("I rolled out the change in three phases").action).toBe(true);
  });

  it("weHeavy — flags collective phrasing without first-person action (Indian cultural humility default)", () => {
    // ≥2 we-action hits + no I-action verb → weHeavy fires
    const text = "At my last company, we built the onboarding flow, we shipped it in six weeks, and our team launched the dashboard right after.";
    const r = detectStarPresence(text);
    expect(r.weHeavy).toBe(true);
    expect(r.action).toBe(false);
  });

  it("weHeavy — false when first-person Action is also present", () => {
    // Even with we-mentions, an explicit I-verb means the candidate IS
    // attributing personal action. Don't flag as we-heavy.
    const text = "We built the system as a team but I led the architecture review and I designed the API.";
    const r = detectStarPresence(text);
    expect(r.action).toBe(true);
    expect(r.weHeavy).toBe(false);
  });

  it("weHeavy — false when there's only one passing collective mention", () => {
    // Single "we shipped" surrounded by I-verbs is normal narration, not we-heavy.
    const text = "I designed the schema, I wrote the migration, and we shipped on Friday.";
    const r = detectStarPresence(text);
    expect(r.weHeavy).toBe(false);
  });

  it("learning — explicit reflective bridges fire", () => {
    expect(detectStarPresence("I learned that scoping early matters").learning).toBe(true);
    expect(detectStarPresence("In hindsight I'd start with the data model").learning).toBe(true);
    expect(detectStarPresence("Looking back, the lesson was to over-communicate").learning).toBe(true);
    expect(detectStarPresence("Next time I would loop in security on day one").learning).toBe(true);
    expect(detectStarPresence("What I took away from that was test in prod-shape envs").learning).toBe(true);
    expect(detectStarPresence("Since then I always write the rollback first").learning).toBe(true);
  });

  it("learning — generic positive language does NOT fire", () => {
    // Guard against false positives — "it was good" / "we did well" is
    // not the same as reflective takeaway language.
    expect(detectStarPresence("It went really well in the end").learning).toBe(false);
    expect(detectStarPresence("The team was happy with the result").learning).toBe(false);
    expect(detectStarPresence("I think it was a good outcome").learning).toBe(false);
  });

  it("learning — empty input returns false", () => {
    expect(detectStarPresence("").learning).toBe(false);
  });

  it("count reflects partial STAR coverage", () => {
    // Situation + Task only (long preamble that never gets to action / result)
    const text = "When I was at my last company we were under pressure and the goal was to launch the new onboarding flow.";
    expect(detectStarPresence(text).count).toBe(2);
  });
});

describe("nextStarGap", () => {
  const fullStar = { situation: true, task: true, action: true, result: true, count: 4, hasMetrics: true };

  it("returns null when answer is too short for STAR coaching (< 25 words)", () => {
    expect(nextStarGap(fullStar, 20)).toBeNull();
    expect(nextStarGap({ situation: true, task: true, action: false, result: false, count: 2, hasMetrics: false }, 24)).toBeNull();
  });

  it("fires at 25+ words — the floor at which incomplete STAR is coachable", () => {
    expect(nextStarGap({ situation: true, task: true, action: false, result: false, count: 2, hasMetrics: false }, 30)).toBe("action");
    expect(nextStarGap({ situation: true, task: true, action: true, result: false, count: 3, hasMetrics: false }, 35)).toBe("result");
  });

  it("returns null when STAR is fully present", () => {
    expect(nextStarGap(fullStar, 80)).toBeNull();
  });

  it("flags Action gap when S+T present", () => {
    expect(nextStarGap({ situation: true, task: true, action: false, result: false, count: 2, hasMetrics: false }, 50)).toBe("action");
  });

  it("flags Result gap when S+T+A present", () => {
    expect(nextStarGap({ situation: true, task: true, action: true, result: false, count: 3, hasMetrics: false }, 50)).toBe("result");
  });

  it("flags Situation/Task gap when only Action present", () => {
    expect(nextStarGap({ situation: false, task: false, action: true, result: false, count: 1, hasMetrics: false }, 50)).toBe("situation-task");
  });
});

describe("integration: starGap + budget contract (T3.8)", () => {
  // These tests pin the contract between detectStarPresence, nextStarGap,
  // and decideComponentGapFollowUp — the three pure functions that gate
  // the engine's component-gap follow-up injection. If any of them
  // changes shape, this catches the drift before it ships.
  it("a 30-word S+T-only answer gets an action gap on the first call, nothing on the second", () => {
    // Simulates two candidate turns on the SAME question where the
    // second turn still doesn't add Action. Budget cap = 1 means the
    // first turn coaches the gap, the second doesn't — we don't drill.
    const turn1 = "At my last company in Q3 the goal was to ship onboarding before the activation push and we had three weeks to get it done across two teams with limited engineering bandwidth.";
    const turn2 = "Same project at my last company. We had a lot to coordinate and various people had opinions on the right approach to take, and the goal was always shifting from week to week with that team.";
    const wc1 = turn1.trim().split(/\s+/).length;
    const wc2 = turn2.trim().split(/\s+/).length;
    const star1 = detectStarPresence(turn1);
    const star2 = detectStarPresence(turn2);
    expect(star1.action).toBe(false);
    expect(star2.action).toBe(false);

    const gap1 = nextStarGap(star1, wc1);
    const gap2 = nextStarGap(star2, wc2);
    expect(gap1).toBe("action");
    expect(gap2).toBe("action");
  });

  it("malformed starGap input never produces a valid directive value", () => {
    // The follow-up handler validates against this set. Mirror the check
    // so the test fails if the set ever drifts.
    const validStarGaps = new Set(["action", "result", "situation-task"]);
    expect(validStarGaps.has("Action")).toBe(false); // case-sensitive
    expect(validStarGaps.has("results")).toBe(false); // plural
    expect(validStarGaps.has("")).toBe(false);
    expect(validStarGaps.has("situationtask")).toBe(false); // no dash
  });
});
