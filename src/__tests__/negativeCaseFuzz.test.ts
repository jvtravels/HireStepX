/* Negative-case fuzz for the candidate-profile parser (2026-05-14).
 * ─────────────────────────────────────────────────────────────────────
 * Goal: confirm the 107 detectors don't fire on benign, off-topic
 * conversation. We generate 1000 random utterances composed of weather /
 * sports / cooking / small-talk words and assert:
 *   - per-utterance: fewer than 3 flags ever fire,
 *   - aggregate: average < 0.5 flags / utterance.
 *
 * PRNG is mulberry32 with a fixed seed so the run is byte-deterministic. */
import { describe, it, expect } from "vitest";
import {
  extractCandidateProfile,
  type CandidateProfileResult,
} from "../../server-handlers/_candidate-profile";

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const VOCAB: ReadonlyArray<string> = [
  /* Weather */
  "weather", "sunny", "cloudy", "rainy", "humid", "monsoon", "breeze", "warm", "cool", "drizzle",
  /* Sports */
  "cricket", "football", "tennis", "match", "score", "team", "player", "stadium", "tournament", "league",
  /* Cooking */
  "recipe", "spice", "tomato", "onion", "ginger", "garlic", "tea", "coffee", "biscuit", "dosa",
  /* Generic small-talk */
  "hello", "thanks", "okay", "today", "tomorrow", "evening", "morning", "nice", "good", "fine",
  "really", "actually", "honestly", "interesting", "agree", "wonder", "story", "person", "place", "thing",
  "the", "a", "is", "was", "and", "but", "with", "from", "of", "to",
];

function countActiveFlags(p: CandidateProfileResult): number {
  let n = 0;
  for (const [k, v] of Object.entries(p)) {
    if (k === "hasAny") continue;
    if (v === true) n++;
    else if (typeof v === "number" && Number.isFinite(v)) n++;
    else if (typeof v === "string" && v.length > 0) n++;
  }
  return n;
}

describe("negative-case fuzz — extractCandidateProfile", () => {
  it("activates < 3 flags per utterance and averages < 0.5 across 1000 samples", () => {
    const rand = mulberry32(0xC0FFEE);
    const N = 1000;
    let total = 0;
    let maxPer = 0;
    let overThreshold = 0;
    for (let i = 0; i < N; i++) {
      const wordCount = 3 + Math.floor(rand() * 18);
      const words: string[] = [];
      for (let w = 0; w < wordCount; w++) {
        words.push(VOCAB[Math.floor(rand() * VOCAB.length)]);
      }
      const text = words.join(" ");
      const profile = extractCandidateProfile(text);
      const n = countActiveFlags(profile);
      total += n;
      if (n > maxPer) maxPer = n;
      if (n >= 3) overThreshold++;
      /* Per-utterance hard ceiling. */
      expect(n).toBeLessThan(3);
    }
    const avg = total / N;
    /* Surfaced via expect() so it appears in CI logs even with console
     * silencing. */
    expect({ total, avg, maxPer, overThreshold, N }).toEqual({
      total,
      avg,
      maxPer,
      overThreshold,
      N: 1000,
    });
    expect(avg).toBeLessThan(0.5);
  });
});
