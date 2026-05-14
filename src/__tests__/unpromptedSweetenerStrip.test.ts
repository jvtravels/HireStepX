/* Fix 2 (PDF #17 follow-up, 2026-05-15) — unprompted sweetener strip.
 *
 * Real bug: recruiter said "We can add an equity grant vesting over
 * four years on top of the ₹24 LPA base. Interested?" — candidate
 * never asked for equity. */
import { describe, expect, it } from "vitest";
import {
  detectUnpromptedSweetener,
  stripUnpromptedSweetener,
} from "../../server-handlers/_adversarial-detector";

describe("detectUnpromptedSweetener", () => {
  it("flags 'we can add an equity grant' when last turn had no ask", () => {
    const r = detectUnpromptedSweetener(
      "We can add an equity grant on top of the base. Interested?",
      "What about timeline?",
    );
    expect(r.violated).toBe(true);
    expect(r.sweeteners.length).toBeGreaterThan(0);
  });

  it("flags 'we can offer a sign-on bonus' unprompted", () => {
    const r = detectUnpromptedSweetener(
      "We can offer a sign-on bonus of ₹5L.",
      "Can I work remotely?",
    );
    expect(r.violated).toBe(true);
  });

  it("flags 'we can sweeten' unprompted", () => {
    const r = detectUnpromptedSweetener(
      "We can sweeten this offer with extra benefits.",
      "Tell me about the team.",
    );
    expect(r.violated).toBe(true);
  });

  it("does NOT flag when candidate asked about equity", () => {
    const r = detectUnpromptedSweetener(
      "We can add an equity grant of 0.1%.",
      "Can you tell me about the equity component?",
    );
    expect(r.violated).toBe(false);
  });

  it("does NOT flag when candidate asked about joining bonus", () => {
    const r = detectUnpromptedSweetener(
      "We can offer a joining bonus of ₹3L.",
      "Is there a joining bonus on the table?",
    );
    expect(r.violated).toBe(false);
  });

  it("does NOT flag a reply with no sweetener", () => {
    const r = detectUnpromptedSweetener(
      "The total CTC for this role is ₹24L.",
      "What's the total CTC?",
    );
    expect(r.violated).toBe(false);
    expect(r.sweeteners.length).toBe(0);
  });

  it("handles null bot reply gracefully", () => {
    const r = detectUnpromptedSweetener(null, "anything");
    expect(r.violated).toBe(false);
  });

  it("flags 'on top of the base we can add equity'", () => {
    const r = detectUnpromptedSweetener(
      "On top of the base we can add an equity grant.",
      "Tell me about WFH policy.",
    );
    expect(r.violated).toBe(true);
  });
});

describe("stripUnpromptedSweetener", () => {
  it("removes the sweetener sentence when unprompted", () => {
    const cleaned = stripUnpromptedSweetener(
      "Your total CTC is ₹24L. We can add an equity grant on top. Let me know.",
      "What's the total?",
    );
    expect(cleaned).not.toMatch(/we can add an equity grant/i);
    expect(cleaned).toMatch(/24L/);
  });

  it("leaves reply intact when candidate asked about equity", () => {
    const reply = "We can add an equity grant of 0.1%.";
    expect(stripUnpromptedSweetener(reply, "Tell me about equity.")).toBe(reply);
  });

  it("returns generic redirect when stripping removes all content", () => {
    const cleaned = stripUnpromptedSweetener(
      "We can add an equity grant on top.",
      "Tell me about WFH.",
    );
    expect(cleaned).toMatch(/specific aspects|package/i);
  });
});
