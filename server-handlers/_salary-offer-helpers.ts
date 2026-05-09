/**
 * Pure helpers for /api/salary-offer — extracted so unit tests can
 * exercise validation + normalization without spinning up Supabase.
 */

export type SalaryOfferLevel = "entry" | "mid" | "senior" | "lead" | "executive";
export type SalaryOfferOutcome = "accepted" | "declined" | "negotiating" | "rescinded";

export interface SalaryOfferInput {
  company?: unknown;
  role?: unknown;
  level?: unknown;
  city?: unknown;
  companyTier?: unknown;
  totalCtcLpa?: unknown;
  baseLpa?: unknown;
  variableLpa?: unknown;
  joiningBonusLpa?: unknown;
  equityLpa?: unknown;
  initialOfferLpa?: unknown;
  finalOfferLpa?: unknown;
  competingOfferLpa?: unknown;
  yoeAtOffer?: unknown;
  outcome?: unknown;
  hasWrittenLetter?: unknown;
  source?: unknown;
  mayShareAggregate?: unknown;
  notes?: unknown;
}

export interface SalaryOfferRow {
  user_id: string;
  company: string;
  role: string;
  level: SalaryOfferLevel;
  city: string | null;
  company_tier: string | null;
  total_ctc_lpa: number;
  base_lpa: number | null;
  variable_lpa: number | null;
  joining_bonus_lpa: number | null;
  equity_lpa: number | null;
  initial_offer_lpa: number | null;
  final_offer_lpa: number | null;
  competing_offer_lpa: number | null;
  yoe_at_offer: number | null;
  outcome: SalaryOfferOutcome;
  has_written_letter: boolean;
  source: string;
  may_share_aggregate: boolean;
  notes: string | null;
  updated_at: string;
}

const LEVELS = new Set<SalaryOfferLevel>(["entry", "mid", "senior", "lead", "executive"]);
const OUTCOMES = new Set<SalaryOfferOutcome>(["accepted", "declined", "negotiating", "rescinded"]);

/** LPA range guard — anything outside this is almost certainly typo
 *  (₹0.1 LPA stipend or ₹2000+ LPA which is implausible). The cap
 *  also prevents downstream Postgres numeric(8,2) overflow. */
const MIN_LPA = 0.5;
const MAX_LPA = 2000;

function num(v: unknown, opts?: { allowNull?: boolean }): number | null {
  if (v === undefined || v === null || v === "") return opts?.allowNull ? null : NaN;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return opts?.allowNull ? null : NaN;
  return Math.round(n * 100) / 100;
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export function normalizeSalaryOffer(
  userId: string,
  input: SalaryOfferInput,
): { ok: true; row: SalaryOfferRow } | { ok: false; error: string } {
  const company = str(input.company, 120);
  if (!company) return { ok: false, error: "company is required" };

  const role = str(input.role, 120);
  if (!role) return { ok: false, error: "role is required" };

  const level = typeof input.level === "string" ? input.level.toLowerCase() : "";
  if (!LEVELS.has(level as SalaryOfferLevel)) {
    return { ok: false, error: `level must be one of: ${Array.from(LEVELS).join(", ")}` };
  }

  const outcome = typeof input.outcome === "string" ? input.outcome.toLowerCase() : "";
  if (!OUTCOMES.has(outcome as SalaryOfferOutcome)) {
    return { ok: false, error: `outcome must be one of: ${Array.from(OUTCOMES).join(", ")}` };
  }

  const total = num(input.totalCtcLpa);
  if (total === null || !Number.isFinite(total)) {
    return { ok: false, error: "totalCtcLpa is required" };
  }
  if (total < MIN_LPA || total > MAX_LPA) {
    return { ok: false, error: `totalCtcLpa must be between ${MIN_LPA} and ${MAX_LPA} LPA` };
  }

  // Optional numerics — null on missing, but reject if explicitly out-of-range.
  const optional: Array<[keyof SalaryOfferInput, keyof SalaryOfferRow]> = [
    ["baseLpa", "base_lpa"],
    ["variableLpa", "variable_lpa"],
    ["joiningBonusLpa", "joining_bonus_lpa"],
    ["equityLpa", "equity_lpa"],
    ["initialOfferLpa", "initial_offer_lpa"],
    ["finalOfferLpa", "final_offer_lpa"],
    ["competingOfferLpa", "competing_offer_lpa"],
  ];
  const optionalValues: Partial<Record<keyof SalaryOfferRow, number | null>> = {};
  for (const [inKey, outKey] of optional) {
    const v = num(input[inKey], { allowNull: true });
    if (v !== null && (v < 0 || v > MAX_LPA)) {
      return { ok: false, error: `${String(inKey)} out of range` };
    }
    optionalValues[outKey] = v;
  }

  const yoe = num(input.yoeAtOffer, { allowNull: true });
  if (yoe !== null && (yoe < 0 || yoe > 60)) {
    return { ok: false, error: "yoeAtOffer out of range" };
  }

  return {
    ok: true,
    row: {
      user_id: userId,
      company,
      role,
      level: level as SalaryOfferLevel,
      city: str(input.city, 80),
      company_tier: str(input.companyTier, 40),
      total_ctc_lpa: total,
      base_lpa: optionalValues.base_lpa ?? null,
      variable_lpa: optionalValues.variable_lpa ?? null,
      joining_bonus_lpa: optionalValues.joining_bonus_lpa ?? null,
      equity_lpa: optionalValues.equity_lpa ?? null,
      initial_offer_lpa: optionalValues.initial_offer_lpa ?? null,
      final_offer_lpa: optionalValues.final_offer_lpa ?? null,
      competing_offer_lpa: optionalValues.competing_offer_lpa ?? null,
      yoe_at_offer: yoe,
      outcome: outcome as SalaryOfferOutcome,
      has_written_letter: !!input.hasWrittenLetter,
      source: str(input.source, 40) ?? "self-reported",
      may_share_aggregate: !!input.mayShareAggregate,
      notes: str(input.notes, 1000),
      updated_at: new Date().toISOString(),
    },
  };
}
