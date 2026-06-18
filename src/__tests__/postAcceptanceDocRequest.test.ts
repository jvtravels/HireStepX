/* Post-acceptance document collection (2026-06-18).
 *
 * Real Indian HR, the moment a candidate accepts, asks for PAN + Aadhaar
 * scans to kick off the offer letter / BGV. This locks that the kernel
 * actually reaches `accepted` on a clean acceptance AND fires the
 * document-request turn naming both documents — so the close lands like a
 * real onboarding hand-off, not a polite sign-off into the void. */
import { describe, it, expect } from "vitest";
import { runConversation } from "./_negotiationSim";

describe("post-acceptance Aadhaar/PAN document request", () => {
  it("reaches accepted on a clean accept and asks for PAN + Aadhaar", () => {
    const { transcript } = runConversation({
      role: "Senior Backend Engineer",
      company: "PhonePe",
      band: { initialOffer: 30, maxStretch: 46, walkAway: 26, hasEquity: true },
      stopOnTerminal: false,
      turns: [
        "7 years experience. Current CTC is 26 LPA — 22 fixed, 4 variable.",
        "No ESOPs currently, it's all cash.",
        "I led the payments platform rebuild that cut latency by 60%.",
        "I'm targeting 38 LPA total.",
        "My notice is 60 days, buyout is possible.",
        "No other offers in hand right now.",
        "Can you come closer to 38?",
        "That's fair. I accept the offer as is.",
        "Yes, please go ahead and send the offer letter.",
        "Yes, confirmed. Happy to proceed.",
        "Sure, I'll share them.",
      ],
    });

    // The negotiation must actually close.
    const acceptedAt = transcript.findIndex((t) => t.phase === "accepted");
    expect(acceptedAt).toBeGreaterThanOrEqual(0);

    // The document request must fire after acceptance and name both docs.
    const docTurn = transcript.find(
      (t) => t.kind === "post-acceptance-document-request",
    );
    expect(docTurn, "no post-acceptance document request fired").toBeTruthy();
    const docText = (docTurn?.aiText ?? "").toLowerCase();
    expect(docText).toContain("pan");
    expect(docText).toContain("aadhaar");
    // It is genuinely a post-acceptance turn.
    expect(transcript.indexOf(docTurn!)).toBeGreaterThanOrEqual(acceptedAt);
  });
});
