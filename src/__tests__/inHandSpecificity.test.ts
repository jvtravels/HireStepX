import { describe, it, expect } from "vitest";
import { detectInHandRequest, containsRupeeAmount } from "../../server-handlers/_recruiter-facts";

describe("Bug 5: detectInHandRequest", () => {
  it("fires on 'in hand'", () => {
    expect(detectInHandRequest("what is the in hand?")).toBe(true);
  });
  it("fires on 'in-hand'", () => {
    expect(detectInHandRequest("can you tell me the in-hand?")).toBe(true);
  });
  it("fires on 'take home'", () => {
    expect(detectInHandRequest("what's the take home per month?")).toBe(true);
  });
  it("fires on 'net salary'", () => {
    expect(detectInHandRequest("net salary?")).toBe(true);
  });
  it("fires on 'monthly take'", () => {
    expect(detectInHandRequest("monthly take home estimate")).toBe(true);
  });
  it("fires on 'after deductions'", () => {
    expect(detectInHandRequest("how much after deductions?")).toBe(true);
  });
  it("does not fire on unrelated text", () => {
    expect(detectInHandRequest("what is the variable component?")).toBe(false);
  });
});

describe("Bug 5: containsRupeeAmount invariant", () => {
  it("accepts ₹1,28,000 format", () => {
    expect(containsRupeeAmount("₹1,28,000/month after PF + tax")).toBe(true);
  });
  it("accepts 22 LPA", () => {
    expect(containsRupeeAmount("approximately 22 LPA")).toBe(true);
  });
  it("rejects bare percentage", () => {
    expect(containsRupeeAmount("70-75% of fixed")).toBe(false);
  });
  it("rejects empty", () => {
    expect(containsRupeeAmount("")).toBe(false);
  });
  it("invariant: in-hand request → response must contain rupee amount", () => {
    // Simulated bot response for an in-hand request
    const botReply = "Approximately ₹1,28,000/month based on standard deductions.";
    const candidateQ = "what's the in-hand?";
    if (detectInHandRequest(candidateQ)) {
      expect(containsRupeeAmount(botReply)).toBe(true);
    }
  });
});
