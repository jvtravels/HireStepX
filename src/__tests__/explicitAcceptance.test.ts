import { describe, it, expect } from "vitest";
import { detectExplicitAcceptance } from "../../server-handlers/_acceptance-classifier";

describe("Bug 2: detectExplicitAcceptance — strong signals accept", () => {
  it("accepts 'I accept the offer'", () => {
    expect(detectExplicitAcceptance("I accept the offer").accepted).toBe(true);
  });
  it("accepts 'yes I'm accepting'", () => {
    expect(detectExplicitAcceptance("yes I'm accepting").accepted).toBe(true);
  });
  it("accepts 'please send the offer letter'", () => {
    expect(detectExplicitAcceptance("please send the offer letter").accepted).toBe(true);
  });
  it("accepts \"I'm in\"", () => {
    expect(detectExplicitAcceptance("I'm in").accepted).toBe(true);
  });
  it("accepts \"let's move forward with this number\"", () => {
    expect(detectExplicitAcceptance("let's move forward with this number").accepted).toBe(true);
  });
});

describe("Bug 2: detectExplicitAcceptance — hedged signals do NOT accept", () => {
  it("rejects 'sounds good'", () => {
    expect(detectExplicitAcceptance("sounds good").accepted).toBe(false);
  });
  it("rejects 'thank you for clarifying'", () => {
    expect(detectExplicitAcceptance("thank you for clarifying that").accepted).toBe(false);
  });
  it("rejects 'I appreciate'", () => {
    expect(detectExplicitAcceptance("I appreciate the offer").accepted).toBe(false);
  });
  it("rejects \"I'd be comfortable moving forward IF...\"", () => {
    expect(detectExplicitAcceptance("I'd be comfortable moving forward if you can do 30L").accepted).toBe(false);
  });
  it("rejects 'let me think about it'", () => {
    expect(detectExplicitAcceptance("let me think about it").accepted).toBe(false);
  });
  it("rejects empty/null", () => {
    expect(detectExplicitAcceptance("").accepted).toBe(false);
    expect(detectExplicitAcceptance(null).accepted).toBe(false);
  });
});
