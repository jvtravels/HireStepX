/**
 * ResumeFactPack — structured, kernel-grade resume facts.
 *
 * Pre-existing path reduced the resume to ~6 scalars at session-init
 * (totalYoe, applicableYoe, primaryDomain, experienceLevel, collegeTier,
 * internshipMonths) and discarded the rest. This module builds a richer,
 * pure-data fact pack from a parsed-resume shape so the salary-negotiation
 * kernel can:
 *   - seed candidate-profile flags with provenance="resume",
 *   - fire a credibility-probe when a stated affiliation contradicts
 *     the resume,
 *   - anchor counter math against a resume-derived prior-CTC floor.
 *
 * Pure. No I/O. Single source of truth for company-tier classification
 * routes through `_company-band-tiers.ts` and `_company-tier.ts`.
 */

import {
  classifyCompanyTier as classifyBandTier,
  type CompanyTier as BandTier,
} from "./_company-band-tiers";

/* ─── Minimal ParsedResume shape ───────────────────────────────────────
 * Deliberately narrow — we only define what the extractor reads. The
 * caller can pass any object that satisfies these fields; the canonical
 * client-side ParsedResume type is wider and structurally compatible.
 */
export interface ParsedResumeRole {
  title?: string | null;
  companyName?: string | null;
  /* ISO-ish dates ("2021-03", "2023-08") OR free-form ("Mar 2021"). The
   * extractor tolerates both via a forgiving month parser. */
  startDate?: string | null;
  endDate?: string | null; // null / "present" / "current" means ongoing
  description?: string | null;
}
export interface ParsedResumeEducation {
  degree?: string | null;
  institution?: string | null;
  /* e.g. "MBA", "PGDM", "B.Tech". */
  type?: string | null;
}
export interface ParsedResume {
  roles?: ParsedResumeRole[] | null;
  education?: ParsedResumeEducation[] | null;
  /* Free-form list of skills / stack the parser surfaced. The canonicaliser
   * below normalises this to known stack tags. */
  skills?: string[] | null;
  /* Optional full-text fallback used by leadership-claimed regex. */
  rawText?: string | null;
}

/* ─── ResumeFactPack ───────────────────────────────────────────────── */

export type ResumeCompanyTier =
  | "faang"
  | "unicorn"
  | "indian-product"
  | "service"
  | "startup"
  | "unknown";

export interface ResumePriorCompany {
  name: string;
  tier: ResumeCompanyTier;
  tenureMonths: number | null;
}

export type ResumeTenurePattern =
  | "frequent-switcher"
  | "stable"
  | "balanced"
  | "unknown";

export type ResumeMbaTier =
  | "top-tier-domestic"
  | "tier-1"
  | "other"
  | null;

export interface ResumeFactPack {
  priorCompanies: ResumePriorCompany[];
  stackTags: string[];
  tenurePattern: ResumeTenurePattern;
  mbaTier: ResumeMbaTier;
  leadershipClaimed: boolean;
  gapMonths: number | null;
  latestRole: {
    title: string;
    companyName: string;
    companyTier: string;
  } | null;
}

/* ─── Company-tier projection ─────────────────────────────────────────
 *
 * We project the 10-tier band model into the 6-tier resume-context model
 * the kernel reasons in. Keeps `_company-band-tiers.ts` as the source of
 * truth — this is a pure projection, not a parallel classifier. */
function projectBandTier(b: BandTier): ResumeCompanyTier {
  switch (b) {
    case "big-tech":
      return "faang";
    case "unicorn":
      return "unicorn";
    case "product-india":
    case "gcc":
      return "indian-product";
    case "it-services":
    case "consulting":
      return "service";
    case "startup":
      return "startup";
    case "bfsi":
    case "pharma":
    case "sme":
      return "unknown";
    default:
      return "unknown";
  }
}

export function classifyResumeCompanyTier(name: string | null | undefined): ResumeCompanyTier {
  if (!name) return "unknown";
  return projectBandTier(classifyBandTier(name));
}

/* ─── Stack canonicaliser ─────────────────────────────────────────── */

const STACK_CANONICAL: Array<{ canonical: string; patterns: RegExp[] }> = [
  { canonical: "react",      patterns: [/\breact(?:\.?js)?\b/i, /\breactjs\b/i] },
  { canonical: "node",       patterns: [/\bnode(?:\.?js)?\b/i, /\bnodejs\b/i] },
  { canonical: "typescript", patterns: [/\btypescript\b/i, /\bts\b/i] },
  { canonical: "javascript", patterns: [/\bjavascript\b/i, /\bjs\b/i] },
  { canonical: "java",       patterns: [/\bjava\b/i, /\bspring(?:\s*boot)?\b/i] },
  { canonical: "python",     patterns: [/\bpython\b/i, /\bdjango\b/i, /\bflask\b/i, /\bfastapi\b/i] },
  { canonical: "go",         patterns: [/\bgolang\b/i, /\bgo\b/i] },
  { canonical: "ruby",       patterns: [/\bruby(?:\s*on\s*rails)?\b/i, /\brails\b/i] },
  { canonical: "aws",        patterns: [/\baws\b/i, /\bamazon\s*web\s*services\b/i] },
  { canonical: "gcp",        patterns: [/\bgcp\b/i, /\bgoogle\s*cloud\b/i] },
  { canonical: "azure",      patterns: [/\bazure\b/i] },
  { canonical: "kubernetes", patterns: [/\bk8s\b/i, /\bkubernetes\b/i] },
  { canonical: "docker",     patterns: [/\bdocker\b/i] },
  { canonical: "kafka",      patterns: [/\bkafka\b/i] },
  { canonical: "postgres",   patterns: [/\bpostgres(?:ql)?\b/i] },
  { canonical: "mysql",      patterns: [/\bmysql\b/i] },
  { canonical: "mongodb",    patterns: [/\bmongo(?:db)?\b/i] },
  { canonical: "redis",      patterns: [/\bredis\b/i] },
  { canonical: "graphql",    patterns: [/\bgraphql\b/i] },
];

function canonicaliseStack(skills: string[]): string[] {
  const blob = skills.filter(Boolean).join(" \n ");
  const out = new Set<string>();
  for (const { canonical, patterns } of STACK_CANONICAL) {
    if (patterns.some((p) => p.test(blob))) out.add(canonical);
  }
  return Array.from(out);
}

/* ─── Date parsing ────────────────────────────────────────────────── */

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

/** Return a year-month integer (year * 12 + month). null if unparseable. */
function parseYM(s: string | null | undefined, nowYM: number): number | null {
  if (s == null) return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  if (t === "present" || t === "current" || t === "ongoing" || t === "now") return nowYM;
  // ISO "YYYY-MM" or "YYYY/MM"
  let m = /^(\d{4})[-/](\d{1,2})$/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Math.max(1, Math.min(12, Number(m[2]))) - 1;
    return y * 12 + mo;
  }
  // "Mar 2021" / "March 2021"
  m = /^([a-z]+)\s+(\d{4})$/.exec(t);
  if (m && MONTHS[m[1]] !== undefined) {
    return Number(m[2]) * 12 + MONTHS[m[1]];
  }
  // Year only — assume January.
  m = /^(\d{4})$/.exec(t);
  if (m) return Number(m[1]) * 12;
  return null;
}

/* ─── Tenure pattern ──────────────────────────────────────────────── */

function computeTenureMonths(start: number | null, end: number | null): number | null {
  if (start == null || end == null) return null;
  const months = end - start;
  if (months < 0) return null;
  return months;
}

function computeTenurePattern(
  roles: Array<{ startYM: number | null; endYM: number | null }>,
  nowYM: number,
): ResumeTenurePattern {
  if (roles.length === 0) return "unknown";
  // Frequent-switcher: 3+ companies whose tenure overlap with last 24 months.
  const cutoff = nowYM - 24;
  const recentCount = roles.filter((r) => (r.endYM ?? nowYM) >= cutoff).length;
  if (recentCount >= 3) return "frequent-switcher";
  // Stable: any single role >= 36 months OR average tenure >= 36 months.
  const tenures = roles
    .map((r) => computeTenureMonths(r.startYM, r.endYM))
    .filter((m): m is number => m != null);
  if (tenures.length === 0) return "unknown";
  const maxT = Math.max(...tenures);
  const avgT = tenures.reduce((a, b) => a + b, 0) / tenures.length;
  if (maxT >= 36 || avgT >= 36) return "stable";
  return "balanced";
}

/* ─── MBA tier ────────────────────────────────────────────────────── */

const TOP_MBA = [
  "iim ahmedabad", "iim a", "iima",
  "iim bangalore", "iim b", "iimb",
  "iim calcutta", "iim c", "iimc",
  "iim lucknow", "iim l", "iiml",
  "iim kozhikode", "iim k", "iimk",
  "iim indore", "iim i", "iimi",
  "isb", "indian school of business",
  "xlri",
  "fms delhi", "faculty of management studies",
  "mdi gurgaon", "mdi",
];
const TIER_1_MBA = [
  "iim shillong", "iim trichy", "iim raipur", "iim ranchi", "iim rohtak",
  "iim udaipur", "iim kashipur", "iim nagpur", "iim visakhapatnam",
  "iim bodhgaya", "iim amritsar", "iim sambalpur", "iim sirmaur", "iim jammu",
  "iift", "spjimr", "sp jain", "jbims", "nmims", "iim", "imt ghaziabad",
  "sibm", "scmhrd", "symbiosis", "iim mumbai", "tiss", "great lakes",
  "loyola institute of business administration", "liba",
];

function classifyMbaTier(edu: ParsedResumeEducation[]): ResumeMbaTier {
  let hasMba = false;
  for (const e of edu) {
    const t = `${e.type ?? ""} ${e.degree ?? ""}`.toLowerCase();
    if (/\b(mba|pgdm|pgp\b|post[\s-]graduate\s+(?:diploma|program))\b/.test(t)) {
      hasMba = true;
      const inst = (e.institution ?? "").toLowerCase();
      for (const top of TOP_MBA) if (inst.includes(top)) return "top-tier-domestic";
      for (const t1 of TIER_1_MBA) if (inst.includes(t1)) return "tier-1";
    }
  }
  return hasMba ? "other" : null;
}

/* ─── Leadership detection ────────────────────────────────────────── */

const LEADERSHIP_PATTERNS: RegExp[] = [
  /\bled\s+(?:a\s+)?team\s+of\s+\d+/i,
  /\bmanag(?:ed|ing)\s+\d+\s+(?:direct\s+)?reports?\b/i,
  /\bhead\s+of\s+(?:engineering|product|design|sales|operations|marketing)/i,
  /\b(?:engineering|technical)\s+manager\b/i,
  /\bpeople\s+manager\b/i,
  /\bteam\s+lead(?:er)?\b/i,
  /\bdirector\s+of\b/i,
];

function detectLeadership(resume: ParsedResume): boolean {
  const haystacks: string[] = [];
  if (resume.rawText) haystacks.push(resume.rawText);
  for (const r of resume.roles ?? []) {
    if (r.title) haystacks.push(r.title);
    if (r.description) haystacks.push(r.description);
  }
  const blob = haystacks.join("\n");
  return LEADERSHIP_PATTERNS.some((p) => p.test(blob));
}

/* ─── Gap computation ─────────────────────────────────────────────── */

function computeLongestGap(
  roles: Array<{ startYM: number | null; endYM: number | null }>,
): number | null {
  const sorted = roles
    .filter((r) => r.startYM != null && r.endYM != null)
    .slice()
    .sort((a, b) => (a.startYM ?? 0) - (b.startYM ?? 0));
  if (sorted.length < 2) return null;
  let maxGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = sorted[i - 1].endYM!;
    const curStart = sorted[i].startYM!;
    const gap = curStart - prevEnd;
    if (gap > maxGap) maxGap = gap;
  }
  return maxGap > 0 ? maxGap : null;
}

/* ─── Main extractor ──────────────────────────────────────────────── */

export function buildResumeFactPack(
  parsedResume: ParsedResume | null | undefined,
  opts?: { now?: Date },
): ResumeFactPack {
  const now = opts?.now ?? new Date();
  const nowYM = now.getUTCFullYear() * 12 + now.getUTCMonth();
  const rolesRaw = parsedResume?.roles ?? [];
  const edu = parsedResume?.education ?? [];

  // Annotate roles with parsed dates.
  const roles = rolesRaw.map((r) => {
    const startYM = parseYM(r.startDate, nowYM);
    const endYM = parseYM(r.endDate, nowYM) ?? (r.endDate == null ? nowYM : null);
    return { ...r, startYM, endYM };
  });

  const priorCompanies: ResumePriorCompany[] = roles
    .filter((r) => (r.companyName ?? "").trim().length > 0)
    .map((r) => ({
      name: (r.companyName as string).trim(),
      tier: classifyResumeCompanyTier(r.companyName),
      tenureMonths: computeTenureMonths(r.startYM, r.endYM),
    }));

  const stackTags = canonicaliseStack(parsedResume?.skills ?? []);
  const tenurePattern = computeTenurePattern(
    roles.map((r) => ({ startYM: r.startYM, endYM: r.endYM })),
    nowYM,
  );
  const mbaTier = classifyMbaTier(edu);
  const leadershipClaimed = detectLeadership(parsedResume ?? {});
  const gapMonths = computeLongestGap(
    roles.map((r) => ({ startYM: r.startYM, endYM: r.endYM })),
  );

  // Latest role: the role with the largest endYM (treating null endYM as
  // "current"). Ties broken by largest startYM.
  let latestRole: ResumeFactPack["latestRole"] = null;
  const sorted = roles
    .filter((r) => (r.companyName ?? "").trim().length > 0)
    .slice()
    .sort((a, b) => {
      const aEnd = a.endYM ?? nowYM;
      const bEnd = b.endYM ?? nowYM;
      if (bEnd !== aEnd) return bEnd - aEnd;
      return (b.startYM ?? 0) - (a.startYM ?? 0);
    });
  if (sorted.length > 0) {
    const r = sorted[0];
    latestRole = {
      title: (r.title ?? "").trim(),
      companyName: (r.companyName as string).trim(),
      companyTier: classifyResumeCompanyTier(r.companyName),
    };
  }

  return {
    priorCompanies,
    stackTags,
    tenurePattern,
    mbaTier,
    leadershipClaimed,
    gapMonths,
    latestRole,
  };
}

/* ─── Fuzzy company-name match ────────────────────────────────────── */

const COMPANY_SUFFIX_RX =
  /\b(?:inc|incorporated|corp|corporation|ltd|limited|pvt|private|llp|llc|gmbh|plc|technologies|technology|systems|labs|labs?|india|services|solutions|consulting)\b\.?/gi;

export function normalizeCompanyName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(COMPANY_SUFFIX_RX, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function fuzzyCompanyMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeCompanyName(a);
  const nb = normalizeCompanyName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return na.includes(nb) || nb.includes(na);
}

/* ─── Candidate-profile seeding from ResumeFactPack ──────────────── */

/**
 * Seed values for a subset of CandidateProfileResult flags from the
 * ResumeFactPack. Returned as a flat record so the kernel can apply
 * it as a Partial<CandidateProfileResult> via the existing merge
 * layer, and so the parallel flagProvenance map can record which
 * flags were resume-derived.
 *
 * Conservative: only flags whose semantics are unambiguously resume-
 * derivable are seeded. Candidate utterances later confirm via the
 * monotone-up merge (`||`) — they can never downgrade a resume fact.
 */
export interface ResumeProfileSeed {
  /** tenureSignal — "frequent" / "stable" / null. */
  tenureSignal: "frequent" | "stable" | null;
  /** peopleManagementClaimed pre-seed from leadershipClaimed. */
  peopleManagementClaimed: boolean;
  /** domesticTopMbaAnchor pre-seed from mbaTier === "top-tier-domestic". */
  domesticTopMbaAnchor: boolean;
  /** mncExperience pre-seed — true when any prior company is faang or
   *  indian-product tier. */
  mncExperience: boolean;
}

export function deriveCandidateProfileSeed(pack: ResumeFactPack | null | undefined): ResumeProfileSeed {
  if (!pack) {
    return {
      tenureSignal: null,
      peopleManagementClaimed: false,
      domesticTopMbaAnchor: false,
      mncExperience: false,
    };
  }
  const tenureSignal: "frequent" | "stable" | null =
    pack.tenurePattern === "frequent-switcher" ? "frequent"
    : pack.tenurePattern === "stable" ? "stable"
    : null;
  const mncExperience = pack.priorCompanies.some(
    (c) => c.tier === "faang" || c.tier === "indian-product",
  );
  return {
    tenureSignal,
    peopleManagementClaimed: pack.leadershipClaimed,
    domesticTopMbaAnchor: pack.mbaTier === "top-tier-domestic",
    mncExperience,
  };
}

/** Does the ResumeFactPack confirm the candidate's stated current company? */
export function resumeConfirmsCompany(pack: ResumeFactPack | null | undefined, statedCompany: string): boolean {
  if (!pack || !statedCompany) return false;
  if (pack.latestRole && fuzzyCompanyMatch(pack.latestRole.companyName, statedCompany)) return true;
  for (const c of pack.priorCompanies) {
    if (fuzzyCompanyMatch(c.name, statedCompany)) return true;
  }
  return false;
}
