import { describe, it, expect } from "vitest";
import { GAP_CTA_MAP, pickNextMove } from "../nextMove";
import { startDrill, currentQuestion, type DrillSkill } from "../../server-handlers/_drill-session";

/**
 * Contract test for the drill-key plumbing between three surfaces:
 *
 *   1. nextMove.ts            — owns GAP_CTA_MAP (gap code → CTA + drill key)
 *   2. DashboardHome card     — builds /session/new?focus=…&drill=<key> URLs
 *   3. SessionSetup           — reverses {drill → CTA} via Object.values(GAP_CTA_MAP)
 *      and renders a banner when the URL drill key matches.
 *   4. generate-questions.ts  — accepts a `drill` field on the LLM request
 *      and shapes the prompt via DRILL_GUIDANCE.
 *
 * If any one of these drifts (a renamed `drill:` field, a removed CTA, a
 * dropped DRILL_GUIDANCE entry), the dashboard CTA promise silently
 * breaks. An E2E for this surface needs heavy auth + session_insights
 * mocking; this lighter contract test catches the same class of
 * regression at unit-test speed.
 *
 * The DRILL_GUIDANCE map is duplicated here as a string set rather than
 * imported, because importing edge-runtime server-handler code into
 * vitest pulls in WinterCG-only globals. The duplication is acceptable
 * because the cost of a drift is a failing test that names the missing
 * key — exactly what we want.
 */

const KNOWN_DRILL_GUIDANCE_KEYS = new Set([
  "resume_facts",
  "career_gap",
  "seniority",
  "under_titled",
  "comp_floor",
  "comp_deflect",
]);

/**
 * The `type` values SessionSetup.focusToType maps a URL focus onto. The
 * dashboard CTA emits `?focus=<value>`; SessionSetup reads `type` OR `focus`
 * and preselects the matching interview focus. Duplicated here (not imported)
 * because SessionSetup pulls in React/Next at import time — a drift here means
 * the gap CTA stops preselecting HR Round, which this test names.
 */
const KNOWN_SESSIONSETUP_TYPES = new Set([
  "behavioral", "strategic", "technical", "case-study", "salary-negotiation",
  "panel", "campus-placement", "hr-round", "management", "government-psu",
]);

describe("Drill-CTA contract", () => {
  it("every GAP_CTA_MAP entry with a drill key has a non-empty string drill value", () => {
    // Campus-placement entries intentionally omit drill (they go to setup, not a
    // micro-drill session). All other entries must have a non-empty drill key.
    for (const [gapCode, cta] of Object.entries(GAP_CTA_MAP)) {
      if (cta.drill !== undefined) {
        expect(cta.drill, `gap ${gapCode}: drill must be a non-empty string`).toBeTruthy();
        expect(typeof cta.drill).toBe("string");
        expect(cta.drill.length).toBeGreaterThan(0);
      }
    }
  });

  it("every drill key has matching prompt guidance in generate-questions DRILL_GUIDANCE", () => {
    // The drill key is what /interview forwards to generate-questions.
    // An entry without DRILL_GUIDANCE coverage means the dashboard CTA
    // claims a coached drill but the LLM gets no prompt shaping.
    // Entries without a drill key (campus-placement) bypass this check — they
    // go directly to the setup page and never trigger a micro-drill session.
    const missing: string[] = [];
    for (const cta of Object.values(GAP_CTA_MAP)) {
      if (cta.drill && !KNOWN_DRILL_GUIDANCE_KEYS.has(cta.drill)) missing.push(cta.drill);
    }
    expect(
      missing,
      `drill keys not wired into DRILL_GUIDANCE (update generate-questions.ts when this fires): ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("drill keys are unique across gap codes (reverse-map is well-formed)", () => {
    // SessionSetup builds DRILL_TO_CTA via Object.values(GAP_CTA_MAP).reduce
    // — last-write-wins on collisions. Two gaps sharing a drill key would
    // silently lose one set of banner copy. Entries without drill are skipped.
    const seen = new Map<string, string>();
    for (const [gapCode, cta] of Object.entries(GAP_CTA_MAP)) {
      if (!cta.drill) continue;
      const prior = seen.get(cta.drill);
      if (prior) {
        throw new Error(
          `drill key "${cta.drill}" is used by both "${prior}" and "${gapCode}" — banner copy will collide`,
        );
      }
      seen.set(cta.drill, gapCode);
    }
  });

  it("every CTA has the headline + label SessionSetup renders into the banner", () => {
    for (const [gapCode, cta] of Object.entries(GAP_CTA_MAP)) {
      expect(cta.label, `gap ${gapCode}: missing label`).toBeTruthy();
      expect(cta.headline, `gap ${gapCode}: missing headline`).toBeTruthy();
      expect(cta.headline.length).toBeGreaterThan(20);
    }
  });

  it("each gap CTA href carries a focus SessionSetup recognizes (+ drill key for drill entries)", () => {
    // The dashboard renders pickNextMove(...).ctaHref directly. If the engine
    // emits a focus value SessionSetup can't map, the targeted interview type
    // silently falls back to the role default — the promise breaks invisibly.
    // Campus-placement entries use a custom ctaHref without a drill param (they
    // go to setup, not a micro-drill) — only check drill key for drill entries.
    for (const [gapCode, cta] of Object.entries(GAP_CTA_MAP)) {
      const { ctaHref } = pickNextMove({ skills: [], currentStreak: 0, topGaps: [gapCode] });
      const url = new URL(ctaHref, "https://example.com");
      const focus = url.searchParams.get("focus");
      expect(focus, `gap ${gapCode}: ctaHref must carry a focus`).toBeTruthy();
      expect(
        KNOWN_SESSIONSETUP_TYPES.has(focus as string),
        `gap ${gapCode}: focus "${focus}" is not in SessionSetup.focusToType — preselect will silently fail`,
      ).toBe(true);
      if (cta.drill) {
        expect(url.searchParams.get("drill"), `gap ${gapCode}: ctaHref must carry the drill key`).toBe(cta.drill);
      }
    }
  });

  it("every GAP_CTA_MAP drill key is a real, runnable DrillSkill (taxonomies unified)", () => {
    // The micro-drill engine (server-handlers/_drill-session.ts) and the gap
    // CTA (nextMove.ts) used to carry DISJOINT vocabularies — the engine knew
    // only negotiation skills (esop|anchoring|…) while the CTA emitted HR-round
    // keys (comp_floor|resume_facts|…). This asserts they're now ONE taxonomy:
    // each gap CTA drill key must boot a valid 5-question drill, not throw.
    // Entries without a drill key (campus-placement) are skipped — they go to
    // the setup page, not a micro-drill session.
    for (const [gapCode, cta] of Object.entries(GAP_CTA_MAP)) {
      if (!cta.drill) continue;
      const state = startDrill({ skill: cta.drill as DrillSkill, maxQuestions: 5 });
      expect(state.script.length, `gap ${gapCode}: drill "${cta.drill}" must script 5 questions`).toBe(5);
      expect(currentQuestion(state), `gap ${gapCode}: drill "${cta.drill}" must yield a first question`).toBeTruthy();
    }
  });
});
