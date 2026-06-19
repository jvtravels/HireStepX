/* Discovery re-ask de-duplication (2026-06-19, surfaced via the offline
 * dice sweep over `runConversation`).
 *
 * When a candidate gives a NON-ANSWER ("ok" / "hmm" / "not sure") to a
 * discovery probe, the planner re-asks the SAME topic on the next turn.
 * The canonical probe string was fixed, so the re-ask shipped verbatim
 * (modulo an overlay tic) — robotic, and it tripped the same-response
 * loop guard. `proseDiscoveryProbe` now counts prior asks of the item
 * from the asked-topic LEDGER (not the lossy `askedTopics` array) and
 * picks a distinct nudge variant on a re-ask. First ask is byte-identical
 * to before; only the re-prompt changes. */
import { describe, it, expect } from "vitest";
import {
  runConversation,
  normLine,
} from "./_negotiationSim";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const band: NegotiationBand = {
  initialOffer: 28,
  maxStretch: 40,
  walkAway: 22,
  hasEquity: true,
};

describe("discovery probe re-ask de-duplication", () => {
  it("does not ship the opening CTC probe verbatim when the candidate stonewalls", () => {
    const { transcript } = runConversation({
      sessionId: "reask-ctc-1",
      role: "Backend Engineer",
      company: "Zoho",
      band,
      turns: ["ok", "still thinking", "not sure"],
    });
    // No two consecutive AI lines normalize to the same content — the
    // re-ask must differ from the prior probe, not just carry a new tic.
    for (let i = 1; i < transcript.length; i++) {
      const prev = normLine(transcript[i - 1].aiText);
      const cur = normLine(transcript[i].aiText);
      if (prev && cur) expect(cur).not.toBe(prev);
    }
  });

  it("re-prompts the CTC ask with a distinct nudge phrasing", () => {
    const { transcript } = runConversation({
      sessionId: "reask-ctc-2",
      role: "Data Scientist",
      company: "Stripe",
      band,
      turns: ["ok"],
    });
    const opener = transcript[0].aiText;
    const reAsk = transcript[1].aiText;
    // Opener is the canonical "start with your current side" probe…
    expect(opener.toLowerCase()).toContain("start with your current side");
    // …the re-ask is a different, nudge-shaped prompt for the same fact.
    expect(reAsk.toLowerCase()).not.toContain("start with your current side");
    expect(reAsk.toLowerCase()).toMatch(/ctc|figure|ballpark/);
  });

  it("keeps the first-ask phrasing byte-identical (no snapshot drift)", () => {
    // A session whose opener fires with no overlay tics (null-ish dice)
    // still leads with the canonical probe text — the re-ask logic only
    // engages on priorAsks >= 1.
    const { transcript } = runConversation({
      sessionId: "reask-ctc-3",
      role: "Backend Engineer",
      company: "Acme",
      band,
      turns: [],
    });
    expect(transcript[0].aiText.toLowerCase()).toContain(
      "what's the total ctc at present",
    );
  });
});
