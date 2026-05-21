/* Candidate-profile signal registry — composition seam for the
 * wave-module carve.
 *
 * Audit follow-up (2026-05-21). `_candidate-profile.ts` carries 326
 * functions across Waves 1-9 in a single 236-KB file. The audit
 * flagged it as a rules engine masquerading as a state shape. The
 * chaos backstop (candidateProfileChaos.test.ts, 34 invariants) is
 * now in place, so we can introduce a registration API that lets a
 * wave's detection logic live in its own file and self-register at
 * import time.
 *
 * This file is the SEAM, not the migration. It defines the registry
 * + the registration helper + the runner. Existing waves keep using
 * the legacy direct-call path inside extractCandidateProfile until
 * they're migrated one by one. A migrated detector additionally
 * registers itself here; a contract test asserts the registry
 * output matches the legacy extractor output byte-for-byte, so the
 * physical move is safe (the legacy call site can later be deleted
 * without changing behaviour).
 *
 * Three migration modes:
 *
 *   1. SHADOW    — detector registered + still called in legacy extract.
 *                  Contract test verifies parity. Default mode for new
 *                  registrations until the wave is fully cut over.
 *
 *   2. PRIMARY   — detector registered; legacy extract call removed.
 *                  extractCandidateProfile reads the field from the
 *                  registry output. (Future state.)
 *
 *   3. RETIRED   — detector is being deprecated; registry entry kept
 *                  for back-compat but no longer used. (Future state.)
 *
 * Today this file ships in SHADOW mode for three Wave-2 flags as
 * proof-of-pattern.
 */

/** Strategy used to merge two profile snapshots on the same flag. */
export type MergeStrategy =
  | "or" // boolean monotone-up: a || b. Default for boolean signals.
  | "last-truthy" // prefer next over prior when both are non-null/non-undefined.
  | "first-wins" // freeze on first non-null value; later assignments ignored.
  | "max"; // numeric max(a, b); null treated as -Infinity.

export interface WaveFlagDetector<T = boolean> {
  /** Property name on CandidateProfileResult. */
  readonly name: string;
  /** Wave identifier (e.g. "wave-2A", "wave-7"). Diagnostic only. */
  readonly waveId: string;
  /** Pure detection — given the candidate utterance, return the flag value. */
  readonly detect: (text: string) => T;
  /** Default value when no candidate text has been observed (EMPTY default). */
  readonly defaultValue: T;
  /** Strategy for merging this flag across consecutive turns. */
  readonly mergeStrategy: MergeStrategy;
}

/** Map from property-name → detector. Single entry per flag. */
const REGISTRY = new Map<string, WaveFlagDetector<unknown>>();

/** Register a wave-flag detector. Throws on duplicate name (registration
 *  is a load-time invariant — a duplicate means two waves are fighting
 *  over the same flag, which we want to surface loudly). */
export function registerWaveFlag<T>(detector: WaveFlagDetector<T>): void {
  if (REGISTRY.has(detector.name)) {
    throw new Error(
      `[candidate-profile-registry] duplicate registration for "${detector.name}" ` +
        `(prior wave=${REGISTRY.get(detector.name)?.waveId}, new wave=${detector.waveId})`,
    );
  }
  REGISTRY.set(detector.name, detector as WaveFlagDetector<unknown>);
}

/** Read-only view of the registry. Used by the contract test. */
export function getRegisteredFlags(): ReadonlyArray<WaveFlagDetector<unknown>> {
  return Array.from(REGISTRY.values());
}

/** Run every registered detector against the supplied text. Returns a
 *  partial profile snapshot keyed by flag name. Consumers spread this
 *  into their fuller profile. */
export function runRegistry(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const detector of REGISTRY.values()) {
    out[detector.name] = text ? detector.detect(text) : detector.defaultValue;
  }
  return out;
}

/** Merge two snapshots according to each detector's mergeStrategy.
 *  Snapshots are partial — keys not present in either default to the
 *  detector's defaultValue. */
export function mergeRegistry(
  prior: Record<string, unknown>,
  next: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const detector of REGISTRY.values()) {
    const a = prior[detector.name];
    const b = next[detector.name];
    out[detector.name] = applyMerge(a, b, detector);
  }
  return out;
}

function applyMerge(
  a: unknown,
  b: unknown,
  detector: WaveFlagDetector<unknown>,
): unknown {
  switch (detector.mergeStrategy) {
    case "or":
      return Boolean(a) || Boolean(b);
    case "last-truthy":
      if (b !== null && b !== undefined) return b;
      if (a !== null && a !== undefined) return a;
      return detector.defaultValue;
    case "first-wins":
      if (a !== null && a !== undefined && a !== detector.defaultValue) return a;
      if (b !== null && b !== undefined) return b;
      return detector.defaultValue;
    case "max": {
      const an = typeof a === "number" ? a : Number.NEGATIVE_INFINITY;
      const bn = typeof b === "number" ? b : Number.NEGATIVE_INFINITY;
      const m = Math.max(an, bn);
      return Number.isFinite(m) ? m : detector.defaultValue;
    }
  }
}

/** Reset hook for tests. Production code never calls this. */
export function __resetRegistryForTesting(): void {
  REGISTRY.clear();
}
