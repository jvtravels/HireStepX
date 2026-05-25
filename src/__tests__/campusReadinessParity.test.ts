/* Regex-parity drift lock for campus-placement.
 *
 * The CampusReadinessChips live-coaching surface (src/_campus-readiness.ts)
 * and the post-session analyzer (server-handlers/analyzers/campus-placement.ts)
 * each maintain their own copy of the regexes used to detect: project
 * narration, tech stack, generic-company filler, specific-company signal,
 * filler words, deficit volunteering, badmouth, implausible team-size,
 * internship claim/detail.
 *
 * History: these have drifted at least 3 times during the campus-placement
 * v1 → v2 work (TECH_STACK was the most painful — server analyzer didn't
 * include solidworks/ansys, so a fixture failed `project_no_tech_stack`).
 *
 * This test reads BOTH files and asserts that for each named pattern the
 * regex source strings are byte-identical. If you legitimately need to
 * diverge (e.g. a chip needs a softer threshold than the analyzer flag),
 * delete the entry from this map with a comment explaining why.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// v6.10 — analyzer-side regex constants were extracted from
// `campus-placement.ts` to `_campus-regex.ts`. The parity test now reads
// the regex module directly. The const declarations carry an `export `
// prefix there, which the source-extraction regex below tolerates.
const ANALYZER = fs.readFileSync(
  path.resolve(__dirname, "../../server-handlers/analyzers/_campus-regex.ts"),
  "utf-8",
);
const CHIPS = fs.readFileSync(
  path.resolve(__dirname, "../_campus-readiness.ts"),
  "utf-8",
);

/* Pull the source of a `[export] const NAME = /.../i;` line from the file
 * text. Returns the raw pattern string without delimiters or flags so the
 * two sides can be compared regardless of variable naming. */
function patternSource(text: string, constName: string): string {
  const re = new RegExp(`(?:export\\s+)?const\\s+${constName}\\s*(?::\\s*RegExp)?\\s*=\\s*(/.+/)([gimsuy]*)\\s*;`);
  const m = text.match(re);
  if (!m) throw new Error(`Could not find regex const ${constName}`);
  // Strip leading + trailing slash
  return m[1].slice(1, -1);
}

/* Pairs: [analyzer-side const, chip-side const]. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["PROJECT_NARRATION", "CP_PROJECT_NARRATION"],
  ["TECH_STACK", "CP_TECH_STACK"],
  ["COMPANY_GENERIC_FILLER", "CP_COMPANY_GENERIC"],
  ["COMPANY_SPECIFIC_SIGNAL", "CP_COMPANY_SPECIFIC"],
  ["IMPLAUSIBLE_TEAM", "CP_IMPLAUSIBLE_TEAM"],
  ["COLLEGE_BADMOUTH", "CP_BADMOUTH"],
  ["VOLUNTEERED_DEFICIT", "CP_VOLUNTEERED_DEFICIT"],
  ["INTERNSHIP_CLAIM", "CP_INTERNSHIP_CLAIM"],
  ["INTERNSHIP_DETAIL", "CP_INTERNSHIP_DETAIL"],
  ["AVAILABILITY", "CP_AVAILABILITY"],
];

describe("campus-placement regex parity (analyzer ↔ live chips)", () => {
  for (const [analyzerName, chipName] of PAIRS) {
    it(`${analyzerName} stays identical to ${chipName}`, () => {
      const a = patternSource(ANALYZER, analyzerName);
      const c = patternSource(CHIPS, chipName);
      expect(c).toBe(a);
    });
  }
});
