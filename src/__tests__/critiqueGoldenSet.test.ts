import { describe, it, expect } from "vitest";
import {
  critiqueRecruiterStrategy,
  type RecruiterCritiqueItem,
} from "../../server-handlers/_recruiter-critique";
import {
  initState,
  type NegotiationState,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import type { KernelTurnSummary } from "../../server-handlers/_negotiation-metrics";

/* Golden-set regression for the recruiter critique output. Themes are
 * keyword groups that MUST appear (`expectedThemes`) or MUST NOT appear
 * (`forbiddenThemes`) in the concatenated `detail` strings emitted by
 * `critiqueRecruiterStrategy`. The 10 scenarios cover the canonical
 * Indian-market negotiation shapes the kernel needs to behave well on
 * (pregnancy, PIP, caste, ESOP-tax, BFSI-March-bonus, GCC-arbitrage,
 * fresher-naive, senior-overconfident, notice-buyout-leverage,
 * multi-offer-pivot).
 *
 * Themes match case-insensitively. */

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 30, walkAway: 16, hasEquity: false };

function makeState(over: Partial<NegotiationState> = {}): NegotiationState {
  const base = initState({ sessionId: "g1", role: "swe", company: "Acme", band: BAND, maxTurns: 8 });
  return { ...base, ...over } as NegotiationState;
}

function m(over: Partial<KernelTurnSummary>): KernelTurnSummary {
  return {
    lever: "open-with-offer",
    newTotalLpa: null,
    turnIndex: 0,
    candidateTargetAtTurn: null,
    ...over,
  } as KernelTurnSummary;
}

function detailsBlob(items: RecruiterCritiqueItem[]): string {
  return items.map((i) => `${i.code} ${i.detail}`).join("\n").toLowerCase();
}

interface Scenario {
  name: string;
  state: NegotiationState;
  moves: KernelTurnSummary[];
  expectedThemes: string[];
  forbiddenThemes: string[];
}

const scenarios: Scenario[] = [
  {
    name: "pregnancy — recruiter asked an inappropriate family-planning question",
    state: makeState({
      conversationLog: [
        { speaker: "ai", text: "Welcome. When are you planning to have kids?" },
        { speaker: "candidate", text: "That's not relevant to this role." },
      ],
    }),
    moves: [m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 })],
    expectedThemes: ["personal", "inappropriate", "bias"],
    forbiddenThemes: ["caste"],
  },
  {
    name: "PIP — recruiter must not surface PIP language during compensation talk",
    state: makeState({
      candidateProfile: {
        ...makeState().candidateProfile,
        pipDisclosed: true,
        hasAny: true,
      },
      conversationLog: [
        { speaker: "ai", text: "We are offering ₹25 LPA fixed." },
        { speaker: "candidate", text: "I'm currently on a PIP at my employer, so timeline matters." },
      ],
    }),
    moves: [m({ lever: "open-with-offer", newTotalLpa: 25, turnIndex: 0 })],
    expectedThemes: [],
    forbiddenThemes: ["pip"],
  },
  {
    name: "caste — recruiter asked caste/community (PSU context)",
    state: makeState({
      company: "BHEL",
      conversationLog: [
        { speaker: "ai", text: "Which caste do you belong to?" },
        { speaker: "candidate", text: "I don't think that's appropriate." },
      ],
    }),
    moves: [m({ lever: "open-with-offer", newTotalLpa: 20, turnIndex: 0 })],
    expectedThemes: ["religion", "inappropriate"],
    forbiddenThemes: [],
  },
  {
    name: "ESOP-tax — recruiter ceiling-rushed without probing equity prefs",
    state: makeState({
      band: { initialOffer: 30, maxStretch: 50, walkAway: 25, hasEquity: true },
    }),
    moves: [
      m({ lever: "open-with-offer", newTotalLpa: 35, turnIndex: 0 }),
      m({ lever: "counter-base", newTotalLpa: 50, turnIndex: 1 }),
    ],
    expectedThemes: ["ceiling", "probe"],
    forbiddenThemes: ["caste", "pregnancy"],
  },
  {
    name: "BFSI March bonus — recruiter conceded without ask",
    state: makeState({ company: "HDFC" }),
    moves: [
      m({ lever: "open-with-offer", newTotalLpa: 24, turnIndex: 0, candidateTargetAtTurn: 28 }),
      m({ lever: "counter-base", newTotalLpa: 27, turnIndex: 1, candidateTargetAtTurn: 28 }),
    ],
    expectedThemes: ["concession", "candidate"],
    forbiddenThemes: [],
  },
  {
    name: "GCC arbitrage — premature ceiling on cross-border candidate",
    state: makeState({
      band: { initialOffer: 40, maxStretch: 60, walkAway: 35, hasEquity: true },
      company: "Microsoft IDC",
    }),
    moves: [
      m({ lever: "open-with-offer", newTotalLpa: 45, turnIndex: 0, candidateTargetAtTurn: 60 }),
      m({ lever: "counter-base", newTotalLpa: 60, turnIndex: 1, candidateTargetAtTurn: 60 }),
    ],
    expectedThemes: ["ceiling", "headroom"],
    forbiddenThemes: ["pip", "caste"],
  },
  {
    name: "fresher-naive — recruiter accepted without component breakdown",
    state: makeState({
      phase: "accepted",
      acceptedAtTurn: 3,
      freshGradDisclosed: true,
      candidateComponentBreakdown: { base: null, variable: null, equity: null, hasAny: false },
    }),
    moves: [
      m({ lever: "open-with-offer", newTotalLpa: 5, turnIndex: 0 }),
      m({ lever: "joining-bonus", turnIndex: 1 }),
      m({ lever: "counter-base", newTotalLpa: 6, turnIndex: 2 }),
    ],
    expectedThemes: ["breakdown", "offer"],
    forbiddenThemes: ["caste"],
  },
  {
    name: "senior-overconfident — recruiter held firm then conceded",
    state: makeState(),
    moves: [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0, candidateTargetAtTurn: 28 }),
      m({ lever: "counter-base", newTotalLpa: 25, turnIndex: 1, candidateTargetAtTurn: 28 }),
      m({ lever: "hold-firm", turnIndex: 2, candidateTargetAtTurn: 28 }),
      m({ lever: "counter-base", newTotalLpa: 27, turnIndex: 3, candidateTargetAtTurn: 28 }),
    ],
    expectedThemes: ["hold-firm", "credib"],
    forbiddenThemes: [],
  },
  {
    name: "notice-buyout leverage — recruiter walked away without warning",
    state: makeState({ phase: "walked-away", walkedAwayAtTurn: 4 }),
    moves: [
      m({ lever: "open-with-offer", newTotalLpa: 22, turnIndex: 0 }),
      m({ lever: "counter-base", newTotalLpa: 25, turnIndex: 1 }),
      m({ lever: "counter-base", newTotalLpa: 27, turnIndex: 2 }),
    ],
    expectedThemes: ["walked away", "signal"],
    forbiddenThemes: ["caste"],
  },
  {
    name: "multi-offer pivot — recruiter countered without probing",
    state: makeState(),
    moves: [
      m({ lever: "open-with-offer", newTotalLpa: 24, turnIndex: 0, candidateTargetAtTurn: 30 }),
      m({ lever: "counter-base", newTotalLpa: 28, turnIndex: 1, candidateTargetAtTurn: 30 }),
    ],
    expectedThemes: ["probe", "anchor"],
    forbiddenThemes: ["pregnancy"],
  },
];

describe("critique golden-set", () => {
  for (const s of scenarios) {
    it(`scenario: ${s.name}`, () => {
      const items = critiqueRecruiterStrategy({ finalState: s.state, moves: s.moves });
      const blob = detailsBlob(items);
      for (const want of s.expectedThemes) {
        expect(blob).toContain(want.toLowerCase());
      }
      for (const bad of s.forbiddenThemes) {
        expect(blob).not.toContain(bad.toLowerCase());
      }
    });
  }
});
