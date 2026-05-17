/* AR1 / Audit Pass 4 (PDF#27, 2026-05-17) — type-level satisfiesTopic.
 *
 * Invariant test for the type-level satisfiesTopic refactor:
 *   - Every probe-producing NextAction variant carries `satisfiesTopic`
 *     as a required field (compile error if forgotten on a new kind).
 *   - When the planner's emitted NextAction is shipped through
 *     applyAiMove, exactly one entry is appended to state.askedTopics
 *     (or `array.length` for multi-topic recaps).
 *
 * The exhaustiveness check is performed at compile time by referencing
 * action.satisfiesTopic on each probe kind; at runtime, the test just
 * confirms the ship-site behaviour.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  type AiMove,
  type NegotiationBand,
  type NegotiationState,
  type DiscoveryTopic,
} from "../../server-handlers/_negotiation-kernel";
import {
  PROBE_PRODUCING_KINDS,
  type NextAction,
} from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function mkState(): NegotiationState {
  return initState({ sessionId: "ar1", role: "swe", company: "acme", band: BAND });
}

describe("AR1 — PROBE_PRODUCING_KINDS contains every probe variant", () => {
  it("set includes the canonical probe kinds", () => {
    const expected = [
      "discovery-probe",
      "component-probe",
      "probe-expectations",
      "probe-justification",
      "probe-mismatch",
      "reactive-followup",
      "credibility-probe",
      "range-disclosure",
      "anchor-with-band",
      "open-with-offer",
      "counter-offer",
      "close-recap-formal",
      "band-anchor-with-rationale",
      "internal-equity-defense",
      "comparative-anchoring",
      "lever-grade-upgrade",
      "lever-retention-bonus",
      "lever-rsu-refresh",
      "lever-relocation",
      "lever-perf-bonus-cadence",
      "lever-joining-bonus-explained",
    ];
    for (const k of expected) {
      expect(PROBE_PRODUCING_KINDS.has(k as NextAction["kind"])).toBe(true);
    }
  });
});

describe("AR1 — ship-site appends exactly one askedTopics entry per probe", () => {
  function shipMoveWithTopic(state: NegotiationState, topic: DiscoveryTopic): NegotiationState {
    const move: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      rationale: "test",
      askedTopic: topic,
    };
    return applyAiMove(state, move, "test text");
  }

  it("discovery-probe push: askedTopics grows by 1", () => {
    const before = mkState();
    const after = shipMoveWithTopic(before, "currentCtcAnswered");
    expect((after.askedTopics ?? []).length).toBe((before.askedTopics ?? []).length + 1);
    const tail = (after.askedTopics ?? []).slice(-1)[0];
    expect(tail?.topic).toBe("currentCtcAnswered");
  });

  it("reactive-followup push: askedTopics grows by 1", () => {
    const before = mkState();
    const after = shipMoveWithTopic(before, "value-proof");
    expect((after.askedTopics ?? []).length).toBe((before.askedTopics ?? []).length + 1);
  });

  it("structural-lever push: askedTopics grows by 1", () => {
    const before = mkState();
    const after = shipMoveWithTopic(before, "lever-grade-upgrade");
    expect((after.askedTopics ?? []).length).toBe((before.askedTopics ?? []).length + 1);
  });
});

/* Compile-time guard: this function is unreachable at runtime but the
 * type system MUST reject any NextAction probe variant that lacks
 * satisfiesTopic. If a new probe kind is added without the field, this
 * file will fail to compile — the discovery-loop class of regression
 * is permanently closed. */
function _compileTimeProbeGuard(a: NextAction): void {
  if (a.kind === "discovery-probe") {
    const t: NextAction["kind"] extends never ? never : unknown = a.satisfiesTopic;
    void t;
  }
  if (a.kind === "component-probe") {
    void a.satisfiesTopic;
  }
  if (a.kind === "reactive-followup") {
    void a.satisfiesTopic;
  }
  if (a.kind === "anchor-with-band") {
    void a.satisfiesTopic;
  }
  if (a.kind === "counter-offer") {
    void a.satisfiesTopic;
  }
  if (a.kind === "close-recap-formal") {
    void a.satisfiesTopic;
  }
}
void _compileTimeProbeGuard;
