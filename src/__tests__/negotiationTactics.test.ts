import { describe, it, expect } from "vitest";
import { detectNegotiationTactic } from "../_negotiation-tactics";

describe("detectNegotiationTactic", () => {
  it("flags current-CTC probe", () => {
    expect(detectNegotiationTactic("So what's your current CTC?")?.id).toBe("current_ctc_probe");
  });

  it("flags deadline / urgency", () => {
    expect(detectNegotiationTactic("I need to know by end of week.")?.id).toBe("deadline");
    expect(detectNegotiationTactic("Our headcount approval expires Friday.")?.id).toBe("deadline");
  });

  it("flags band-ceiling flinch", () => {
    expect(detectNegotiationTactic("That's the absolute top of my band.")?.id).toBe("flinch");
    expect(detectNegotiationTactic("I can't go any higher.")?.id).toBe("flinch");
  });

  it("flags split authority", () => {
    expect(detectNegotiationTactic("Let me check with leadership and get back.")?.id).toBe("split_authority");
  });

  it("flags fake empathy", () => {
    expect(detectNegotiationTactic("I genuinely want this to work for both of us.")?.id).toBe("fake_empathy");
  });

  it("flags package redirect", () => {
    expect(detectNegotiationTactic("Let's look at the full package — total comp matters more.")?.id).toBe("package_redirect");
  });

  it("flags loss framing", () => {
    expect(detectNegotiationTactic("You'd be walking away from a real opportunity here.")?.id).toBe("loss_framing");
  });

  it("flags anchor / market citation", () => {
    expect(detectNegotiationTactic("We just hired someone at this level for ₹12 LPA.")?.id).toBe("anchor");
    expect(detectNegotiationTactic("Our band for this role is ₹14 LPA.")?.id).toBe("anchor");
  });

  it("flags level-cap excuse", () => {
    expect(detectNegotiationTactic("We have a level cap for external hires here.")?.id).toBe("level_cap");
  });

  it("flags equity dazzle", () => {
    expect(detectNegotiationTactic("If we IPO in two years your equity will be life-changing.")?.id).toBe("equity_dazzle");
  });

  it("flags signing-bonus clawback", () => {
    expect(detectNegotiationTactic("The joining bonus has a 2-year clawback if you leave early.")?.id).toBe("signing_clawback");
  });

  it("flags notice-period pressure", () => {
    expect(detectNegotiationTactic("How soon can you join? Can you negotiate with your current employer?")?.id).toBe("notice_pressure");
  });

  it("flags competing-offer skepticism", () => {
    expect(detectNegotiationTactic("It's hard to match without seeing the offer letter in writing.")?.id).toBe("competing_offer_skepticism");
  });

  it("returns null on neutral text", () => {
    expect(detectNegotiationTactic("Welcome — thanks for joining the call.")).toBeNull();
  });

  it("every detected tactic includes 3+ verbatim counter-scripts", () => {
    const samples = [
      "what's your current ctc",
      "by end of week",
      "top of my band",
      "let me check with leadership",
      "i genuinely want this to work",
      "let's look at the full package",
      "you'd be walking away from",
      "our band for this role is",
      "level cap for external hires",
      "if we ipo your equity",
      "joining bonus has clawback",
      "how soon can you join",
      "hard to match without seeing the offer letter",
    ];
    for (const s of samples) {
      const t = detectNegotiationTactic(s);
      expect(t, `tactic for "${s}"`).not.toBeNull();
      expect(t!.counterScripts.length).toBeGreaterThanOrEqual(3);
    }
  });
});
