/* PDF #01 audit replay — empty/zero-disclosure session must
 * produce a clean baseline state.
 *
 * Original finding: an early kernel patch initialized the ledger
 * with placeholder fact entries (defaulting current-ctc to 0), which
 * the coaching report then surfaced as "candidate disclosed 0 LPA"
 * — clearly a fabrication. The fix made the ledger genuinely empty
 * at init and made getFact return null for unrecorded facts.
 *
 * Regression shape: zero candidate turns. All fact getters must
 * return null; guardrail summary must be empty. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import {
  getFact,
  size,
  type FactKind,
} from "../../../server-handlers/_conversation-ledger";
import { guardrailFlagSummary } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-01-emptySessionClean"),
  turns: [],
};

const ALL_FACT_KINDS: FactKind[] = [
  "current-ctc",
  "current-company",
  "target-ctc",
  "notice-period-days",
  "competing-offer",
  "joining-date",
  "component-base",
  "component-variable",
  "component-equity",
];

describe("PDF #01 replay — zero-turn session is genuinely empty", () => {
  it("every fact getter returns null", () => {
    const s = replayTranscript(FIX);
    for (const k of ALL_FACT_KINDS) {
      expect(getFact(s.ledger!, k)).toBeNull();
    }
    expect(size(s.ledger!)).toBe(0);
  });

  it("guardrail summary is empty", () => {
    const s = replayTranscript(FIX);
    expect(Object.keys(guardrailFlagSummary(s))).toEqual([]);
  });

  it("decision log is empty", () => {
    const s = replayTranscript(FIX);
    expect(s.decisionLog ?? []).toEqual([]);
  });
});
