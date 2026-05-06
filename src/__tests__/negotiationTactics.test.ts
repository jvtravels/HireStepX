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

  it("returns null on neutral text", () => {
    expect(detectNegotiationTactic("Welcome — thanks for joining the call.")).toBeNull();
  });
});
