import { describe, it, expect } from "vitest";
import { parseBoolEnv } from "../../server-handlers/_sarvam-token-helpers";

describe("parseBoolEnv", () => {
  it("parses a clean 'true'", () => {
    expect(parseBoolEnv("true")).toBe(true);
  });

  it("parses the confirmed production corruption: a literal trailing backslash-n", () => {
    expect(parseBoolEnv("true\\n")).toBe(true);
  });

  it("parses a literal trailing backslash-r-backslash-n", () => {
    expect(parseBoolEnv("true\\r\\n")).toBe(true);
  });

  it("tolerates surrounding real whitespace", () => {
    expect(parseBoolEnv("  true  \n")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(parseBoolEnv("TRUE")).toBe(true);
    expect(parseBoolEnv("True")).toBe(true);
  });

  it("returns false for 'false'", () => {
    expect(parseBoolEnv("false")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(parseBoolEnv(undefined)).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(parseBoolEnv("")).toBe(false);
  });

  it("returns false for an unrelated value", () => {
    expect(parseBoolEnv("1")).toBe(false);
  });
});
