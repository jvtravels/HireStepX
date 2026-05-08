#!/usr/bin/env node
// Regenerates /data/csv-company-role-bands.ts from the source CSV.
// Usage: node scripts/build-csv-company-role-bands.mjs
//
// Output uses per-field interning tables to keep the on-disk
// representation compact (edge bundle size matters). The runtime
// `getCsvCompanyBand` / `getCsvRoleLevelBand` API hydrates packed
// bands back to the public `CsvRoleBand` shape, so callers see no
// difference.

import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import path from "node:path";

const CSV_PATH =
  "/Users/jayvyas/Downloads/Salary Data Companies 1-100.csv";
const OUT_PATH = path.resolve(
  process.cwd(),
  "data/csv-company-role-bands.ts",
);

const ALLOWED_LEVELS = new Set([
  "fresher",
  "junior",
  "mid",
  "senior",
  "lead",
  "manager",
]);

function parseCurrency(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const cleaned = s.replace(/[₹,\s]/g, "").replace(/[Ll]$/, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseNumber(v) {
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function s(v) {
  return v == null ? "" : String(v);
}

function splitPipe(v) {
  const str = s(v).trim();
  if (!str) return [];
  return str
    .split(" | ")
    .map((x) => x.trim())
    .filter(Boolean);
}

function splitSemi(v) {
  const str = s(v).trim();
  if (!str) return [];
  return str
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean);
}

function normalizeCompanyKey(name) {
  let k = String(name || "").toLowerCase().trim();
  k = k.replace(/[.,;:!?]+$/g, "").trim();
  if (k.endsWith(" india")) k = k.slice(0, -" india".length).trim();
  return k;
}

const raw = readFileSync(CSV_PATH);
let text = raw.toString("utf8");
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

const records = parse(text, {
  columns: true,
  skip_empty_lines: true,
  relax_quotes: true,
  relax_column_count: true,
  trim: false,
});

console.error(`parsed ${records.length} rows`);

const companies = new Map();

for (const r of records) {
  const companyName = s(r.company_name).trim();
  if (!companyName) continue;
  const companyKey = normalizeCompanyKey(companyName);
  if (!companyKey) continue;

  const level = s(r.normalized_level).trim().toLowerCase();
  if (!ALLOWED_LEVELS.has(level)) continue;

  const roleTitle = s(r.role_title).trim();
  if (!roleTitle) continue;

  const band = {
    totalMinLpa: parseCurrency(r.total_ctc_min_lpa),
    totalMedianLpa: parseCurrency(r.total_ctc_median_lpa),
    totalMaxLpa: parseCurrency(r.total_ctc_max_lpa),
    fixedMinLpa: parseCurrency(r.fixed_min_lpa),
    fixedMaxLpa: parseCurrency(r.fixed_max_lpa),
    bonusMinLpa: parseCurrency(r.bonus_min_lpa),
    bonusMaxLpa: parseCurrency(r.bonus_max_lpa),
    equityMinLpa: parseCurrency(r.equity_min_lpa),
    equityMaxLpa: parseCurrency(r.equity_max_lpa),
    joiningBonusMinLpa: parseCurrency(r.joining_bonus_min_lpa),
    joiningBonusMaxLpa: parseCurrency(r.joining_bonus_max_lpa),
    equityType: s(r.equity_type).trim(),
    vestingSchedule: s(r.vesting_schedule).trim(),
    equityLiquidityRisk: s(r.equity_liquidity_risk).trim(),
    noticePeriod: s(r.notice_period).trim(),
    bestNegotiationFocus: s(r.best_negotiation_focus).trim(),
    likelyHrPushback: s(r.likely_hr_pushback).trim(),
    candidateQuestionsToVerify: splitPipe(r.candidate_questions_to_verify),
    candidateRedFlags: s(r.candidate_red_flags).trim(),
    supportedInterviewFocus: splitSemi(r.supported_interview_focus),
    safeAskMinLpa: parseCurrency(r.safe_ask_min_lpa),
    safeAskMaxLpa: parseCurrency(r.safe_ask_max_lpa),
    strongAskMinLpa: parseCurrency(r.strong_ask_min_lpa),
    strongAskMaxLpa: parseCurrency(r.strong_ask_max_lpa),
    stretchAskMinLpa: parseCurrency(r.stretch_ask_min_lpa),
    stretchAskMaxLpa: parseCurrency(r.stretch_ask_max_lpa),
    walkawayThresholdLpa: parseCurrency(r.walkaway_threshold_lpa),
    candidateBestResponse: s(r.candidate_best_response).trim(),
    candidateBadResponse: s(r.candidate_bad_response).trim(),
    hrFollowupQuestion: s(r.hr_followup_question).trim(),
    salaryNegotiationRubric: s(r.salary_negotiation_rubric).trim(),
    benefitsSummary: s(r.benefits_summary).trim(),
    locationMultiplierMin: parseNumber(r.location_salary_multiplier_min),
    locationMultiplierMax: parseNumber(r.location_salary_multiplier_max),
    experienceRange: s(r.experience_range).trim(),
    companyType: s(r.company_type).trim(),
    roleFamily: s(r.role_family).trim(),
    roleSubfamily: s(r.role_subfamily).trim(),
    likelyIndiaLocations: s(r.likely_india_locations).trim(),
    v6PrimaryInterviewFocus: s(r.v6_primary_interview_focus).trim(),
  };

  let entry = companies.get(companyKey);
  if (!entry) {
    entry = {
      companyName,
      companyType: s(r.company_type).trim(),
      roles: new Map(),
    };
    companies.set(companyKey, entry);
  }

  let roleMap = entry.roles.get(roleTitle);
  if (!roleMap) {
    roleMap = new Map();
    entry.roles.set(roleTitle, roleMap);
  }
  if (!roleMap.has(level)) {
    roleMap.set(level, band);
  }
}

console.error(`distinct companies: ${companies.size}`);

// ── Interning ────────────────────────────────────────────────────
// Each interner maps a stable key (the value itself for strings, or
// a JSON-stringified canonical form for arrays) to a numeric id.

function makeInterner() {
  const map = new Map();
  const list = [];
  return {
    intern(value, keyOverride) {
      const key = keyOverride !== undefined ? keyOverride : value;
      const existing = map.get(key);
      if (existing !== undefined) return existing;
      const id = list.length;
      map.set(key, id);
      list.push(value);
      return id;
    },
    list,
    size() {
      return list.length;
    },
  };
}

const stringFields = [
  "candidateRedFlags",
  "benefitsSummary",
  "likelyHrPushback",
  "candidateBestResponse",
  "candidateBadResponse",
  "hrFollowupQuestion",
  "salaryNegotiationRubric",
  "equityType",
  "vestingSchedule",
  "equityLiquidityRisk",
  "noticePeriod",
  "bestNegotiationFocus",
  "companyType",
  "roleFamily",
  "roleSubfamily",
  "likelyIndiaLocations",
  "v6PrimaryInterviewFocus",
  "experienceRange",
];

const arrayFields = [
  "candidateQuestionsToVerify",
  "supportedInterviewFocus",
];

const interners = {};
for (const f of stringFields) interners[f] = makeInterner();
for (const f of arrayFields) interners[f] = makeInterner();

// Pre-intern empty values so id 0 is always the empty form for each.
for (const f of stringFields) interners[f].intern("");
for (const f of arrayFields) interners[f].intern([], "[]");

let totalRows = 0;
for (const [, entry] of companies) {
  for (const [, lvlMap] of entry.roles) {
    for (const [, band] of lvlMap) {
      totalRows++;
      for (const f of stringFields) {
        band[f + "Id"] = interners[f].intern(band[f]);
      }
      for (const f of arrayFields) {
        const arr = band[f];
        const key = JSON.stringify(arr);
        band[f + "Id"] = interners[f].intern(arr, key);
      }
    }
  }
}

console.error(`total rows: ${totalRows}`);
for (const f of [...stringFields, ...arrayFields]) {
  console.error(`  ${f}: ${interners[f].size()} unique`);
}

// ── Emit ─────────────────────────────────────────────────────────

function tsString(v) {
  return JSON.stringify(s(v));
}

function tsStringArray(arr) {
  if (!arr.length) return "[]";
  return "[" + arr.map((x) => JSON.stringify(x)).join(",") + "]";
}

function emitPackedBand(b) {
  const parts = [];
  parts.push(`{`);
  parts.push(`a:${b.totalMinLpa},`);
  parts.push(`b:${b.totalMedianLpa},`);
  parts.push(`c:${b.totalMaxLpa},`);
  parts.push(`d:${b.fixedMinLpa},`);
  parts.push(`e:${b.fixedMaxLpa},`);
  parts.push(`f:${b.bonusMinLpa},`);
  parts.push(`g:${b.bonusMaxLpa},`);
  parts.push(`h:${b.equityMinLpa},`);
  parts.push(`i:${b.equityMaxLpa},`);
  parts.push(`j:${b.joiningBonusMinLpa},`);
  parts.push(`k:${b.joiningBonusMaxLpa},`);
  parts.push(`l:${b.safeAskMinLpa},`);
  parts.push(`m:${b.safeAskMaxLpa},`);
  parts.push(`n:${b.strongAskMinLpa},`);
  parts.push(`o:${b.strongAskMaxLpa},`);
  parts.push(`p:${b.stretchAskMinLpa},`);
  parts.push(`q:${b.stretchAskMaxLpa},`);
  parts.push(`r:${b.walkawayThresholdLpa},`);
  parts.push(`s:${b.locationMultiplierMin},`);
  parts.push(`t:${b.locationMultiplierMax},`);
  // Interned ids — single-letter keys to keep the file small.
  // String fields:
  parts.push(`A:${b.candidateRedFlagsId},`);
  parts.push(`B:${b.benefitsSummaryId},`);
  parts.push(`C:${b.likelyHrPushbackId},`);
  parts.push(`D:${b.candidateBestResponseId},`);
  parts.push(`E:${b.candidateBadResponseId},`);
  parts.push(`F:${b.hrFollowupQuestionId},`);
  parts.push(`G:${b.salaryNegotiationRubricId},`);
  parts.push(`H:${b.equityTypeId},`);
  parts.push(`I:${b.vestingScheduleId},`);
  parts.push(`J:${b.equityLiquidityRiskId},`);
  parts.push(`K:${b.noticePeriodId},`);
  parts.push(`L:${b.bestNegotiationFocusId},`);
  parts.push(`M:${b.companyTypeId},`);
  parts.push(`N:${b.roleFamilyId},`);
  parts.push(`O:${b.roleSubfamilyId},`);
  parts.push(`P:${b.likelyIndiaLocationsId},`);
  parts.push(`Q:${b.v6PrimaryInterviewFocusId},`);
  parts.push(`R:${b.experienceRangeId},`);
  // Array fields:
  parts.push(`S:${b.candidateQuestionsToVerifyId},`);
  parts.push(`T:${b.supportedInterviewFocusId},`);
  parts.push(`}`);
  return parts.join("");
}

const out = [];
out.push(`// Auto-generated from "Salary Data Companies 1-100.csv".`);
out.push(`// Do not edit by hand — regenerate with scripts/build-csv-company-role-bands.mjs.`);
out.push(`// Long repeated string fields are interned in tables below; bands store numeric ids.`);
out.push(`// The public API (getCsvCompanyBand / getCsvRoleLevelBand) hydrates them back to the`);
out.push(`// full CsvRoleBand shape, so callers see no difference.`);
out.push(``);
out.push(`export type CsvLevel = "fresher" | "junior" | "mid" | "senior" | "lead" | "manager";`);
out.push(``);
out.push(`export interface CsvRoleBand {`);
out.push(`  totalMinLpa: number;`);
out.push(`  totalMedianLpa: number;`);
out.push(`  totalMaxLpa: number;`);
out.push(`  fixedMinLpa: number;`);
out.push(`  fixedMaxLpa: number;`);
out.push(`  bonusMinLpa: number;`);
out.push(`  bonusMaxLpa: number;`);
out.push(`  equityMinLpa: number;`);
out.push(`  equityMaxLpa: number;`);
out.push(`  joiningBonusMinLpa: number;`);
out.push(`  joiningBonusMaxLpa: number;`);
out.push(`  equityType: string;`);
out.push(`  vestingSchedule: string;`);
out.push(`  equityLiquidityRisk: string;`);
out.push(`  noticePeriod: string;`);
out.push(`  bestNegotiationFocus: string;`);
out.push(`  likelyHrPushback: string;`);
out.push(`  candidateQuestionsToVerify: string[];`);
out.push(`  candidateRedFlags: string;`);
out.push(`  supportedInterviewFocus: string[];`);
out.push(`  safeAskMinLpa: number;`);
out.push(`  safeAskMaxLpa: number;`);
out.push(`  strongAskMinLpa: number;`);
out.push(`  strongAskMaxLpa: number;`);
out.push(`  stretchAskMinLpa: number;`);
out.push(`  stretchAskMaxLpa: number;`);
out.push(`  walkawayThresholdLpa: number;`);
out.push(`  candidateBestResponse: string;`);
out.push(`  candidateBadResponse: string;`);
out.push(`  hrFollowupQuestion: string;`);
out.push(`  salaryNegotiationRubric: string;`);
out.push(`  benefitsSummary: string;`);
out.push(`  locationMultiplierMin: number;`);
out.push(`  locationMultiplierMax: number;`);
out.push(`  experienceRange: string;`);
out.push(`  companyType: string;`);
out.push(`  roleFamily: string;`);
out.push(`  roleSubfamily: string;`);
out.push(`  likelyIndiaLocations: string;`);
out.push(`  v6PrimaryInterviewFocus: string;`);
out.push(`}`);
out.push(``);
out.push(`export interface CsvCompany {`);
out.push(`  companyName: string;`);
out.push(`  companyType: string;`);
out.push(`  roles: Record<string, Partial<Record<CsvLevel, CsvRoleBand>>>;`);
out.push(`}`);
out.push(``);

// Emit interning tables.
function emitStringTable(name, list) {
  const lines = [`const ${name}: readonly string[] = [`];
  for (const v of list) lines.push(`${tsString(v)},`);
  lines.push(`];`);
  return lines.join("\n");
}

function emitStringArrayTable(name, list) {
  const lines = [`const ${name}: readonly (readonly string[])[] = [`];
  for (const arr of list) lines.push(`${tsStringArray(arr)},`);
  lines.push(`];`);
  return lines.join("\n");
}

const tableNameMap = {
  candidateRedFlags: "T_RED_FLAGS",
  benefitsSummary: "T_BENEFITS",
  likelyHrPushback: "T_HR_PUSHBACK",
  candidateBestResponse: "T_BEST_RESP",
  candidateBadResponse: "T_BAD_RESP",
  hrFollowupQuestion: "T_HR_FOLLOWUP",
  salaryNegotiationRubric: "T_RUBRIC",
  equityType: "T_EQUITY_TYPE",
  vestingSchedule: "T_VESTING",
  equityLiquidityRisk: "T_LIQUIDITY",
  noticePeriod: "T_NOTICE",
  bestNegotiationFocus: "T_BEST_NEG_FOCUS",
  companyType: "T_COMPANY_TYPE",
  roleFamily: "T_ROLE_FAMILY",
  roleSubfamily: "T_ROLE_SUBFAMILY",
  likelyIndiaLocations: "T_LOCATIONS",
  v6PrimaryInterviewFocus: "T_PRIMARY_FOCUS",
  experienceRange: "T_EXPERIENCE",
  candidateQuestionsToVerify: "T_QUESTIONS",
  supportedInterviewFocus: "T_SUPPORTED_FOCUS",
};

for (const f of stringFields) {
  out.push(emitStringTable(tableNameMap[f], interners[f].list));
  out.push(``);
}
for (const f of arrayFields) {
  out.push(emitStringArrayTable(tableNameMap[f], interners[f].list));
  out.push(``);
}

// Packed band shape — internal only.
out.push(`interface CsvRoleBandPacked {`);
out.push(`  a: number; b: number; c: number; d: number; e: number;`);
out.push(`  f: number; g: number; h: number; i: number; j: number;`);
out.push(`  k: number; l: number; m: number; n: number; o: number;`);
out.push(`  p: number; q: number; r: number; s: number; t: number;`);
out.push(`  A: number; B: number; C: number; D: number; E: number;`);
out.push(`  F: number; G: number; H: number; I: number; J: number;`);
out.push(`  K: number; L: number; M: number; N: number; O: number;`);
out.push(`  P: number; Q: number; R: number;`);
out.push(`  S: number; T: number;`);
out.push(`}`);
out.push(``);
out.push(`interface CsvCompanyPacked {`);
out.push(`  companyName: string;`);
out.push(`  companyTypeId: number;`);
out.push(`  roles: Record<string, Partial<Record<CsvLevel, CsvRoleBandPacked>>>;`);
out.push(`}`);
out.push(``);
out.push(`const PACKED: Record<string, CsvCompanyPacked> = {`);

const sortedKeys = Array.from(companies.keys()).sort();
for (const ck of sortedKeys) {
  const entry = companies.get(ck);
  const companyTypeId = interners.companyType.intern(entry.companyType);
  out.push(`${JSON.stringify(ck)}: {`);
  out.push(`companyName:${tsString(entry.companyName)},`);
  out.push(`companyTypeId:${companyTypeId},`);
  out.push(`roles: {`);
  const sortedRoles = Array.from(entry.roles.keys()).sort();
  for (const rt of sortedRoles) {
    const lvlMap = entry.roles.get(rt);
    out.push(`${JSON.stringify(rt)}: {`);
    const levelOrder = ["fresher", "junior", "mid", "senior", "lead", "manager"];
    for (const lvl of levelOrder) {
      if (!lvlMap.has(lvl)) continue;
      out.push(`${JSON.stringify(lvl)}: ${emitPackedBand(lvlMap.get(lvl))},`);
    }
    out.push(`},`);
  }
  out.push(`},`);
  out.push(`},`);
}
out.push(`};`);
out.push(``);

// Hydration.
out.push(`function hydrate(p: CsvRoleBandPacked): CsvRoleBand {`);
out.push(`  return {`);
out.push(`    totalMinLpa: p.a,`);
out.push(`    totalMedianLpa: p.b,`);
out.push(`    totalMaxLpa: p.c,`);
out.push(`    fixedMinLpa: p.d,`);
out.push(`    fixedMaxLpa: p.e,`);
out.push(`    bonusMinLpa: p.f,`);
out.push(`    bonusMaxLpa: p.g,`);
out.push(`    equityMinLpa: p.h,`);
out.push(`    equityMaxLpa: p.i,`);
out.push(`    joiningBonusMinLpa: p.j,`);
out.push(`    joiningBonusMaxLpa: p.k,`);
out.push(`    equityType: T_EQUITY_TYPE[p.H],`);
out.push(`    vestingSchedule: T_VESTING[p.I],`);
out.push(`    equityLiquidityRisk: T_LIQUIDITY[p.J],`);
out.push(`    noticePeriod: T_NOTICE[p.K],`);
out.push(`    bestNegotiationFocus: T_BEST_NEG_FOCUS[p.L],`);
out.push(`    likelyHrPushback: T_HR_PUSHBACK[p.C],`);
out.push(`    candidateQuestionsToVerify: T_QUESTIONS[p.S] as string[],`);
out.push(`    candidateRedFlags: T_RED_FLAGS[p.A],`);
out.push(`    supportedInterviewFocus: T_SUPPORTED_FOCUS[p.T] as string[],`);
out.push(`    safeAskMinLpa: p.l,`);
out.push(`    safeAskMaxLpa: p.m,`);
out.push(`    strongAskMinLpa: p.n,`);
out.push(`    strongAskMaxLpa: p.o,`);
out.push(`    stretchAskMinLpa: p.p,`);
out.push(`    stretchAskMaxLpa: p.q,`);
out.push(`    walkawayThresholdLpa: p.r,`);
out.push(`    candidateBestResponse: T_BEST_RESP[p.D],`);
out.push(`    candidateBadResponse: T_BAD_RESP[p.E],`);
out.push(`    hrFollowupQuestion: T_HR_FOLLOWUP[p.F],`);
out.push(`    salaryNegotiationRubric: T_RUBRIC[p.G],`);
out.push(`    benefitsSummary: T_BENEFITS[p.B],`);
out.push(`    locationMultiplierMin: p.s,`);
out.push(`    locationMultiplierMax: p.t,`);
out.push(`    experienceRange: T_EXPERIENCE[p.R],`);
out.push(`    companyType: T_COMPANY_TYPE[p.M],`);
out.push(`    roleFamily: T_ROLE_FAMILY[p.N],`);
out.push(`    roleSubfamily: T_ROLE_SUBFAMILY[p.O],`);
out.push(`    likelyIndiaLocations: T_LOCATIONS[p.P],`);
out.push(`    v6PrimaryInterviewFocus: T_PRIMARY_FOCUS[p.Q],`);
out.push(`  };`);
out.push(`}`);
out.push(``);

// Public read-only export — lazily hydrated proxy isn't worth the
// complexity. Build a simple wrapper that hydrates on access.
out.push(`function hydrateCompany(packed: CsvCompanyPacked): CsvCompany {`);
out.push(`  const roles: Record<string, Partial<Record<CsvLevel, CsvRoleBand>>> = {};`);
out.push(`  for (const role of Object.keys(packed.roles)) {`);
out.push(`    const lvls = packed.roles[role];`);
out.push(`    const out: Partial<Record<CsvLevel, CsvRoleBand>> = {};`);
out.push(`    for (const lvl of Object.keys(lvls) as CsvLevel[]) {`);
out.push(`      const p = lvls[lvl];`);
out.push(`      if (p) out[lvl] = hydrate(p);`);
out.push(`    }`);
out.push(`    roles[role] = out;`);
out.push(`  }`);
out.push(`  return {`);
out.push(`    companyName: packed.companyName,`);
out.push(`    companyType: T_COMPANY_TYPE[packed.companyTypeId],`);
out.push(`    roles,`);
out.push(`  };`);
out.push(`}`);
out.push(``);

// Memoise hydrated companies — cheap insurance for callers that hit
// the same company repeatedly.
out.push(`const HYDRATED_CACHE: Record<string, CsvCompany> = {};`);
out.push(`function getHydratedByKey(key: string): CsvCompany | null {`);
out.push(`  const cached = HYDRATED_CACHE[key];`);
out.push(`  if (cached) return cached;`);
out.push(`  const packed = PACKED[key];`);
out.push(`  if (!packed) return null;`);
out.push(`  const h = hydrateCompany(packed);`);
out.push(`  HYDRATED_CACHE[key] = h;`);
out.push(`  return h;`);
out.push(`}`);
out.push(``);

// Backwards-compat export: callers who iterate this dictionary get
// hydrated entries via a Proxy. Keeps the public surface unchanged.
out.push(`export const CSV_COMPANY_ROLE_BANDS: Record<string, CsvCompany> = new Proxy(`);
out.push(`  {} as Record<string, CsvCompany>,`);
out.push(`  {`);
out.push(`    get(_target, prop: string) {`);
out.push(`      if (typeof prop !== "string") return undefined;`);
out.push(`      return getHydratedByKey(prop) ?? undefined;`);
out.push(`    },`);
out.push(`    has(_target, prop: string) {`);
out.push(`      return typeof prop === "string" && prop in PACKED;`);
out.push(`    },`);
out.push(`    ownKeys() {`);
out.push(`      return Object.keys(PACKED);`);
out.push(`    },`);
out.push(`    getOwnPropertyDescriptor(_target, prop: string) {`);
out.push(`      if (typeof prop !== "string" || !(prop in PACKED)) return undefined;`);
out.push(`      return {`);
out.push(`        enumerable: true,`);
out.push(`        configurable: true,`);
out.push(`        value: getHydratedByKey(prop),`);
out.push(`      };`);
out.push(`    },`);
out.push(`  },`);
out.push(`);`);
out.push(``);

out.push(`function normalizeCompanyKey(name: string): string {`);
out.push(`  let k = name.toLowerCase().trim();`);
out.push(`  k = k.replace(/[.,;:!?]+$/g, "").trim();`);
out.push(`  if (k.endsWith(" india")) k = k.slice(0, -" india".length).trim();`);
out.push(`  return k;`);
out.push(`}`);
out.push(``);
out.push(`export function getCsvCompanyBand(company: string | undefined | null): CsvCompany | null {`);
out.push(`  if (!company) return null;`);
out.push(`  const key = normalizeCompanyKey(company);`);
out.push(`  if (!key) return null;`);
out.push(`  const direct = getHydratedByKey(key);`);
out.push(`  if (direct) return direct;`);
out.push(`  const withIndia = getHydratedByKey(key + " india");`);
out.push(`  if (withIndia) return withIndia;`);
out.push(`  return null;`);
out.push(`}`);
out.push(``);
out.push(`export function getCsvRoleLevelBand(`);
out.push(`  company: string | undefined | null,`);
out.push(`  role: string | undefined | null,`);
out.push(`  level: CsvLevel | undefined | null,`);
out.push(`): CsvRoleBand | null {`);
out.push(`  if (!company || !role || !level) return null;`);
out.push(`  const co = getCsvCompanyBand(company);`);
out.push(`  if (!co) return null;`);
out.push(`  const exact = co.roles[role];`);
out.push(`  if (exact) {`);
out.push(`    const band = exact[level];`);
out.push(`    if (band) return band;`);
out.push(`  }`);
out.push(`  const target = role.toLowerCase().trim();`);
out.push(`  for (const k of Object.keys(co.roles)) {`);
out.push(`    if (k.toLowerCase().trim() === target) {`);
out.push(`      const band = co.roles[k][level];`);
out.push(`      if (band) return band;`);
out.push(`    }`);
out.push(`  }`);
out.push(`  return null;`);
out.push(`}`);
out.push(``);

writeFileSync(OUT_PATH, out.join("\n"));
console.error(`wrote ${OUT_PATH}`);
console.error(`companies: ${companies.size}`);
