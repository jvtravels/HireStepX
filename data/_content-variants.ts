/**
 * Deterministic sentence-variant picker for the /salary/[company] template.
 *
 * PRI-150: 224 salary pages shared one rigid sentence skeleton per element
 * (intro, per-role heading, FAQ Q&A) with only the company/role/numbers
 * substituted — Google's GSC data showed this reading as near-duplicate
 * boilerplate and suppressing CTR. `pickVariant` rotates through several
 * hand-written phrasings using a stable hash of the seed (company slug +
 * role key, etc.) so the same page always renders the same variant across
 * builds/ISR revalidations, but different pages diverge from each other.
 */
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function pickVariant<T>(seed: string, variants: readonly T[]): T {
  return variants[hashSeed(seed) % variants.length];
}
