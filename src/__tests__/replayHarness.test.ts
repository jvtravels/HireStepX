/* Replay-harness canary — architectural bug-prevention (2026-05-15).
 *
 * Drives the kernel through a canned 6-message transcript and asserts
 * that the decision log captures one entry per AI turn and includes
 * the discovery-next picker at least once. This is the leaf-level
 * regression for the dead-wiring class of bug (orphan helpers, brief
 * tags that never reach the decision log).
 */
import { describe, it, expect } from "vitest";
import { replayTranscript } from "../../server-handlers/_replay-harness";
import { EMPTY_DISCOVERY_CHECKLIST } from "../../server-handlers/_discovery-stage";

describe("replayTranscript — decision log canary", () => {
  it("populates decisionLog with one entry per AI turn and surfaces discovery-next picker", async () => {
    const messages = [
      { role: "user" as const, content: "Hi, I'm interested in the role." },
      { role: "assistant" as const, content: "Great to hear — happy to walk you through it." },
      { role: "user" as const, content: "Sure, tell me more." },
      { role: "assistant" as const, content: "What are you currently earning?" },
      { role: "user" as const, content: "Thanks for asking, that's a fair question." },
      { role: "assistant" as const, content: "And what's your notice period?" },
    ];
    const final = await replayTranscript(messages, {
      sessionId: "replay-canary",
      role: "Software Engineer",
      company: "test-co",
      initOverrides: {
        discoveryStage: "discovery",
        discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
      },
    });
    expect(final.decisionLog).toBeDefined();
    expect(final.decisionLog!.length).toBe(3);
    /* Discovery-next picker must appear at least once — the canned
     * transcript starts with an empty discovery checklist so the first
     * non-terminal AI turn should route into the ordered-discovery
     * probe. */
    const pickers = final.decisionLog!.map((e) => e.picker);
    expect(pickers).toContain("discovery-next");
  });
});
