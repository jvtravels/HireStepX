import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_VERSIONS, promptVersionFor } from "../../server-handlers/_prompt-versions";
import { REPORT_VERSION } from "../../server-handlers/_evaluate-report-cache";

describe("promptVersionFor", () => {
  it("returns exact matches", () => {
    expect(promptVersionFor("follow-up")).toBe(PROMPT_VERSIONS["follow-up"]);
    expect(promptVersionFor("evaluate-session")).toBe(REPORT_VERSION);
  });
  it("inherits the version of the longest matching base endpoint", () => {
    expect(promptVersionFor("follow-up-dedup-retry")).toBe(PROMPT_VERSIONS["follow-up"]);
    expect(promptVersionFor("evaluate-session-fast")).toBe(REPORT_VERSION);
  });
  it("does not match on a bare string prefix", () => {
    expect(promptVersionFor("generatex")).toBe("unversioned");
    expect(promptVersionFor("followup")).toBe("unversioned");
  });
  it("is unversioned for unknown or missing endpoints", () => {
    expect(promptVersionFor("brand-new")).toBe("unversioned");
    expect(promptVersionFor(undefined)).toBe("unversioned");
  });
});

describe("registry coverage", () => {
  it("every literal callLLM endpoint resolves to a real version", () => {
    const dir = join(__dirname, "../../server-handlers");
    const missing: string[] = [];
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const m of src.matchAll(/endpoint:\s*"([a-z0-9-]+)"/g)) {
        if (!src.includes("callLLM") && !src.includes("callGroq")) continue;
        if (promptVersionFor(m[1]) === "unversioned") missing.push(`${f}:${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
