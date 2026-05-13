import { describe, it, expect } from "vitest";
import {
  extractLocationMode,
  mergeLocationMode,
} from "../../server-handlers/_location-mode";

describe("extractLocationMode — work mode", () => {
  it("detects 'fully remote'", () => {
    expect(extractLocationMode("I want fully remote").workMode).toBe("remote");
  });

  it("detects 'hybrid'", () => {
    expect(extractLocationMode("hybrid is fine").workMode).toBe("hybrid");
  });

  it("detects 'work from office'", () => {
    expect(extractLocationMode("work from office only").workMode).toBe("office");
  });

  it("detects 'remote role'", () => {
    expect(extractLocationMode("I prefer a remote role").workMode).toBe("remote");
  });

  it("returns null when no mode stated", () => {
    expect(extractLocationMode("hello").workMode).toBe(null);
  });
});

describe("extractLocationMode — city", () => {
  it("normalizes 'bengaluru' to bangalore", () => {
    expect(extractLocationMode("I'm in Bengaluru").locationCity).toBe("bangalore");
  });

  it("normalizes 'bombay' to mumbai", () => {
    expect(extractLocationMode("based in Bombay").locationCity).toBe("mumbai");
  });

  it("normalizes 'gurgaon' to delhi-ncr", () => {
    expect(extractLocationMode("from Gurgaon").locationCity).toBe("delhi-ncr");
  });

  it("detects pune", () => {
    expect(extractLocationMode("I'm in Pune").locationCity).toBe("pune");
  });

  it("returns null for non-hub city", () => {
    expect(extractLocationMode("I'm in Indore").locationCity).toBe(null);
  });
});

describe("extractLocationMode — relocation", () => {
  it("detects relocation request", () => {
    expect(extractLocationMode("need relocation assistance").relocationRequested).toBe(true);
  });

  it("detects 'cover relocation'", () => {
    expect(extractLocationMode("can you cover relocation?").relocationRequested).toBe(true);
  });

  it("detects relocation refusal", () => {
    expect(extractLocationMode("I can't relocate").relocationRefused).toBe(true);
  });

  it("detects 'family reasons'", () => {
    expect(extractLocationMode("family reasons").relocationRefused).toBe(true);
  });
});

describe("extractLocationMode — hasAny", () => {
  it("false on empty", () => {
    expect(extractLocationMode("").hasAny).toBe(false);
  });

  it("true when work mode set", () => {
    expect(extractLocationMode("hybrid").hasAny).toBe(true);
  });
});

describe("mergeLocationMode", () => {
  it("non-null overrides prior", () => {
    const prior = extractLocationMode("hybrid");
    const next = extractLocationMode("fully remote");
    expect(mergeLocationMode(prior, next).workMode).toBe("remote");
  });

  it("null preserves prior city", () => {
    const prior = extractLocationMode("I'm in Bengaluru");
    const next = extractLocationMode("hybrid");
    const m = mergeLocationMode(prior, next);
    expect(m.locationCity).toBe("bangalore");
    expect(m.workMode).toBe("hybrid");
  });

  it("refusal sticks across neutral mention", () => {
    const prior = extractLocationMode("I can't relocate");
    const next = extractLocationMode("hello");
    expect(mergeLocationMode(prior, next).relocationRefused).toBe(true);
  });

  it("request flips when refusal arrives", () => {
    const prior = extractLocationMode("need relocation assistance");
    const next = extractLocationMode("I can't relocate");
    const m = mergeLocationMode(prior, next);
    expect(m.relocationRefused).toBe(true);
  });

  it("handles null prior", () => {
    const next = extractLocationMode("hybrid");
    expect(mergeLocationMode(null, next).workMode).toBe("hybrid");
  });
});
