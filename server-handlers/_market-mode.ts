/**
 * Market-mode toggle helpers.
 *
 * The kernel already carries a `marketMode: "soft" | "neutral" | "hot"`
 * field that biases the concession curve. This module exposes the pure
 * helpers the kernel uses (so non-kernel callers — prompts, audits,
 * tests — can reason about market mode without re-implementing the math)
 * and adds a sector × role inference for 2025-26 Indian-market defaults.
 *
 * Pure; no I/O. */

import type { MarketMode } from "./_negotiation-kernel";
import type { CompanySector } from "./_company-band-tiers";

/** Concession-curve multiplier applied to the AI's step-up split at each
 *  counter. Soft markets compress what the AI will give up; hot markets
 *  expand it. Defaults preserve legacy behaviour (neutral = 1.0×). */
export function getConcessionMultiplier(mode: MarketMode | undefined | null): number {
  switch (mode) {
    case "soft": return 0.85;
    case "hot":  return 1.10;
    case "neutral":
    default:     return 1.0;
  }
}

/** Walk-away threshold multiplier. Soft markets pull the AI's walk-away
 *  floor up (less willing to chase low); hot markets push it down (more
 *  willing to flex). Default 1.0× preserves legacy behaviour. */
export function getWalkAwayThresholdMultiplier(mode: MarketMode | undefined | null): number {
  switch (mode) {
    case "soft": return 1.05;
    case "hot":  return 0.95;
    case "neutral":
    default:     return 1.0;
  }
}

export interface InferMarketModeInput {
  roleFamily?: string | null;
  sector?: CompanySector | string | null;
  /** ISO-ish year-month string, e.g. "2026-05". Not currently used by the
   *  rule set but accepted so callers can carry the freshness signal. */
  yearMonth?: string | null;
  /** Free-form target role title. Used to detect AI/ML/data specialization
   *  which forces hot regardless of tier (Tier-3 item 9). */
  role?: string | null;
  /** Optional tier the candidate is interviewing at. */
  tier?: string | null;
}

/** 2025-26 Indian market defaults inferred from (role-family, sector, role).
 *  Tier-3 extension: data/ML/AI roles force hot regardless of tier. */
export function inferMarketMode(input: InferMarketModeInput): MarketMode {
  const role = (input.role ?? "").toLowerCase();
  const family = (input.roleFamily ?? "").toLowerCase();
  const sector = (input.sector ?? "") as string;

  // Tier-3 (item 9): role-specialization asymmetry — AI/ML/data engineering
  // / MLE / NLP / LLM keywords force hot regardless of sector or tier.
  if (
    /\b(ai|ml|machine\s+learning|data\s+(scientist|engineer)|mle|nlp|llm|gen\s*ai|generative\s*ai|deep\s+learning|computer\s+vision|cv\s+engineer)\b/.test(role) ||
    family === "data"
  ) {
    return "hot";
  }

  // Engineering + IT-services = soft (services pricing has tightened in
  // 2025-26 with onsite-rate compression).
  if (family === "engineering" && /it-services|services/.test(sector)) {
    return "soft";
  }

  // Engineering + GCC = neutral.
  if (family === "engineering" && /gcc/.test(sector)) {
    return "neutral";
  }

  // Sales + early-stage / startup = soft (funding-winter).
  if (family === "sales" && /startup|seed|early|venture/.test(sector)) {
    return "soft";
  }

  return "neutral";
}
