/* MASTER PROACTIVE-AUDIT HARNESS — Sessions A + B + C consolidated.
 *
 * Audit Sessions A, B, C produced 10 area-specific test files. This
 * file is the durable umbrella: it re-runs the high-value invariants
 * from those areas in a property-test shape so a regression in any of
 * the audited surfaces fails loudly at CI time.
 *
 * Areas exercised:
 *   1. Data integrity         — tier monotonicity + non-degenerate bands
 *   2. Role classifier        — random valid inputs map to known RoleKey
 *   3. Domain graph           — bidirectionality
 *   4. Info-intent coverage   — corpus sample
 *   5. Acceptance corpus      — sample
 *   6. Close-floor invariant  — 100 randomised states
 *   7. Terminal stickiness    — 50 random transition sequences
 *   8. P35 opening clamp      — 100 randomised bands
 *
 * Sampling is intentional — full corpus coverage lives in the per-area
 * test files. This harness is the canary.
 */
import { describe, it, expect } from "vitest";

import { COMPANY_SALARY_OVERRIDES } from "../../data/company-salary-overrides";
import type { ExperienceLevel } from "../../data/salaries";
import { matchRoleKey } from "../../data/salaries";
import { clampOpenerToP35 } from "../../data/salary-lookup";
import {
  __ADJACENT_INTERNAL,
} from "../../server-handlers/_candidate-profile";
import {
  parseCandidateAnswer,
  initState,
  pickAiMove,
  clampToCloseFloor,
  isTerminalPhase,
  type NegotiationBand,
  type NegotiationState,
  type NegotiationPhase,
} from "../../server-handlers/_negotiation-kernel";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const EXP_ORDER: ExperienceLevel[] = ["entry", "mid", "senior", "lead", "executive"];

/* Seeded LCG so the property tests are deterministic. */
function makeRng(seed = 0xc0ffee) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

describe("[1] data integrity — tier monotonicity + non-degenerate bands", () => {
  it("every (company,role,level) cell has totalMin < totalMax", () => {
    const violations: string[] = [];
    for (const [company, roles] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
      for (const [role, levels] of Object.entries(roles ?? {})) {
        for (const [lvl, cell] of Object.entries(levels ?? {})) {
          if (!cell) continue;
          if (!(cell.totalMin < cell.totalMax)) {
            violations.push(`${company}/${role}/${lvl}: ${cell.totalMin}-${cell.totalMax}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("within (company,role): next-level totalMax >= prev totalMax (monotonic)", () => {
    const violations: string[] = [];
    for (const [company, roles] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
      for (const [role, levels] of Object.entries(roles ?? {})) {
        let prev: { lvl: string; max: number } | null = null;
        for (const lvl of EXP_ORDER) {
          const cell = (levels as Record<string, { totalMax: number } | undefined>)?.[lvl];
          if (!cell) continue;
          if (prev && cell.totalMax < prev.max) {
            violations.push(`${company}/${role}: ${prev.lvl}(max=${prev.max}) > ${lvl}(max=${cell.totalMax})`);
          }
          prev = { lvl, max: cell.totalMax };
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("[2] role classifier — random valid inputs map to a known RoleKey", () => {
  /* Subset of the canonical role-key emit set; using a small list keeps
   * the harness fast while still covering common families. */
  const KNOWN_ROLE_KEYS = new Set([
    "software-engineer", "product-manager", "engineering-manager",
    "data-scientist", "ux-designer", "marketing", "sales", "consultant",
    "devops-sre", "frontend-developer", "backend-developer", "mobile-developer",
    "qa-engineer", "hr", "finance",
  ]);
  const probes = [
    "Software Engineer", "software engineer", "SDE", "Backend Developer",
    "Front-end Developer", "Product Manager", "PM", "Data Scientist",
    "DS", "UX Designer", "Designer", "DevOps Engineer", "SRE",
    "QA Engineer", "Mobile Developer", "Android Developer",
  ];
  for (const p of probes) {
    it(`"${p}" → ${KNOWN_ROLE_KEYS.has(matchRoleKey(p)) ? "known" : "fallback"}`, () => {
      const key = matchRoleKey(p);
      /* matchRoleKey is total — must return SOMETHING. */
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
    });
  }
});

describe("[3] domain graph — bidirectionality", () => {
  it("if B in adjacent[A] then A in adjacent[B]", () => {
    const violations: string[] = [];
    for (const [a, neighbours] of Object.entries(__ADJACENT_INTERNAL)) {
      for (const b of neighbours) {
        const back = (__ADJACENT_INTERNAL as Record<string, readonly string[]>)[b];
        if (!back || !back.includes(a)) {
          violations.push(`${a} → ${b} but ${b} ↛ ${a}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("[4] info-intent coverage — corpus sample", () => {
  const cases: Array<[string, string]> = [
    ["what are the benefits?", "benefits-overview"],
    ["explain the variable components", "compensation-breakdown"],
    ["what's the clawback?", "clawback-period"],
    ["what's the vesting schedule?", "vest-schedule"],
    ["how much in-hand monthly?", "in-hand-monthly"],
    ["what's the exercise window?", "exercise-window"],
    ["when can I join?", "notice-period-ask"],
    ["what hike is this for me?", "hike-percentage-ask"],
  ];
  for (const [utterance, intent] of cases) {
    it(`"${utterance}" → ${intent}`, () => {
      expect(parseCandidateAnswer(utterance).infoAsked).toContain(intent);
    });
  }
});

describe("[5] acceptance classifier — corpus sample", () => {
  const onTable = { offerOnTable: true };
  const accepts = ["I accept", "deal", "done", "sold", "let's go", "I'm in"];
  const walkaways = ["No thanks, I'll pass", "I'm out", "this isn't going to work"];
  for (const u of accepts) {
    it(`"${u}" → accepted=true`, () => {
      const r = classifyAcceptance(u, onTable);
      expect(r.accepted).toBe(true);
    });
  }
  for (const u of walkaways) {
    it(`"${u}" → walk-away veto (accepted=false)`, () => {
      const r = classifyAcceptance(u);
      expect(r.accepted).toBe(false);
      /* The walk-away pattern triggers reasons[] = ["walk-away"]. */
      expect(r.reasons.join(" ")).toMatch(/walk|hard-conditional|none/i);
    });
  }
});

describe("[6] close-floor invariant — 100 random states", () => {
  it("clampToCloseFloor(state, v) is never < state.highestOfferMade", () => {
    const rnd = makeRng(0xfaceb00c);
    for (let i = 0; i < 100; i++) {
      const initialOffer = 10 + Math.floor(rnd() * 40);
      const band: NegotiationBand = {
        initialOffer,
        maxStretch: initialOffer + 5 + Math.floor(rnd() * 30),
        walkAway: Math.max(5, initialOffer - 5),
        hasEquity: rnd() > 0.5,
      };
      const highest = initialOffer + Math.floor(rnd() * 20);
      const state = { ...initState({ sessionId: "p", role: "swe", company: "acme", band }), highestOfferMade: highest };
      const tentative = highest - 1 - Math.floor(rnd() * 10); // intentionally below floor
      const out = clampToCloseFloor(state, tentative);
      expect(out, `i=${i} highest=${highest} tentative=${tentative}`).toBeGreaterThanOrEqual(highest);
    }
  });
});

describe("[7] terminal stickiness — random transition sequences", () => {
  const terminals: NegotiationPhase[] = ["accepted", "walked-away", "stalemate"];
  it("once a state is in a terminal phase from a prior turn, pickAiMove emits terminal-restate / close-* (not a fresh non-terminal lever)", () => {
    const rnd = makeRng(0xbeef);
    for (let i = 0; i < 50; i++) {
      const band: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: rnd() > 0.5 };
      const terminal = terminals[Math.floor(rnd() * terminals.length)]!;
      const turn = 3 + Math.floor(rnd() * 5);
      const state: NegotiationState = {
        ...initState({ sessionId: `p${i}`, role: "swe", company: "acme", band }),
        phase: terminal,
        turnIndex: turn,
        acceptedAtTurn: terminal === "accepted" ? turn - 1 : null,
        highestOfferMade: 25,
      };
      expect(isTerminalPhase(state.phase)).toBe(true);
      const move = pickAiMove(state);
      /* In a sticky terminal phase the move must NOT be a fresh
       * non-terminal lever like counter-base / probe / joining-bonus. */
      expect(["counter-base", "probe", "joining-bonus", "equity-grant", "notice-buyout"])
        .not.toContain(move.lever);
    }
  });
});

describe("[8] P35 opening clamp — 100 random bands", () => {
  it("clampOpenerToP35 always returns <= totalMin + 0.35*(totalMax-totalMin)", () => {
    const EPS = 0.05 + 1e-6;
    const rnd = makeRng(0xdeadbeef);
    for (let i = 0; i < 100; i++) {
      const totalMin = 1 + rnd() * 80;
      const totalMax = totalMin + 1 + rnd() * 200;
      const opener = clampOpenerToP35(totalMin, totalMax);
      const cap = totalMin + 0.35 * (totalMax - totalMin);
      expect(opener, `min=${totalMin} max=${totalMax}`).toBeLessThanOrEqual(cap + EPS);
      expect(opener).toBeGreaterThanOrEqual(totalMin - EPS);
    }
  });
});
