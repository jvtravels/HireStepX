import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * Design-token adoption gate (Design & UX audit doc 02, P1).
 *
 * The design system declares src/auth/_tokens.ts + src/sessionReport/tokens.ts
 * the single source of truth, but adoption is partial: raw six-digit hex
 * literals still live inline in component JSX. This gate FREEZES that count at
 * the audited baseline and asserts it only ever trends DOWN — new raw hex in a
 * .tsx file fails CI, which is the cheapest way to drive adoption without a
 * big-bang refactor. When you migrate a literal onto a token, lower the
 * baseline to match; never raise it.
 *
 * Token files are .ts (not .tsx) so they are naturally out of scope. Test
 * fixtures under __tests__ are excluded — they legitimately embed sample hex.
 *
 * Baseline measured 2026-06-18 after detokening the report orchestrator
 * (SessionReportView.tsx: 15 literals → 0, which dropped the file off the
 * offender list entirely). Audit doc 02 recorded the pre-migration figure as
 * ~224 raw literals; the live .tsx count is 209 occurrences across 28 files
 * after this pass. Ratchet DOWN as more literals migrate onto tokens; never
 * raise it.
 */

const BASELINE_OCCURRENCES = 209;
const BASELINE_FILES = 28;

const HEX = /#[0-9a-fA-F]{6}\b/g;
const SRC = join(process.cwd(), "src");

function collectTsx(dir: string, acc: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      collectTsx(full, acc);
    } else if (entry.endsWith(".tsx")) {
      acc.push(full);
    }
  }
  return acc;
}

describe("design-token hex gate", () => {
  const files = collectTsx(SRC, []);

  it("raw six-digit hex in .tsx only ratchets down (use tokens, never raise the baseline)", () => {
    let occurrences = 0;
    let filesWithHex = 0;
    const offenders: string[] = [];

    for (const file of files) {
      const matches = readFileSync(file, "utf8").match(HEX);
      if (matches && matches.length > 0) {
        occurrences += matches.length;
        filesWithHex += 1;
        offenders.push(`${file.replace(process.cwd() + "/", "")} (${matches.length})`);
      }
    }

    expect(
      occurrences,
      `raw-hex occurrences rose above the frozen baseline (${BASELINE_OCCURRENCES}). ` +
        `Migrate new colours onto src/sessionReport/tokens.ts or src/auth/_tokens.ts. Offenders:\n` +
        offenders.join("\n"),
    ).toBeLessThanOrEqual(BASELINE_OCCURRENCES);

    expect(
      filesWithHex,
      `number of .tsx files with raw hex rose above the frozen baseline (${BASELINE_FILES}).`,
    ).toBeLessThanOrEqual(BASELINE_FILES);
  });
});
