/* HireStepX — Reference-question retrieval
 *
 * Hierarchical fallback retrieval over the curated question bank
 * (data/interview-question-bank.ts). Returns up to K reference entries
 * for a (company × roleFamily × focus) query, with explicit "tier"
 * metadata so the calling LLM prompt knows how tight the match is and
 * can adjust its instruction accordingly.
 *
 * Tier semantics:
 *   1 = exact (company × roleFamily × focus)
 *   2 = same role + focus, any company
 *   3 = same focus only, any role/company
 *   4 = nothing matched — caller falls through to pure-LLM generation
 *
 * Pure module: no React, no DB, no fetch. The bank is in-memory at edge
 * cold-start; lookups are O(n) over a small list (≤200 entries) so no
 * index needed yet. When we swap to vector RAG (Phase 3), the surface
 * area of this module stays the same — only the implementation behind
 * `retrieveReferenceQuestions` changes.
 */

import {
  QUESTION_BANK,
  type BankEntry,
  type CompanyKey,
  type RoleFamily,
  type FocusArea,
} from "../data/interview-question-bank";

export type RetrievalTier = 1 | 2 | 3 | 4;

export interface RetrievalQuery {
  /** Free-text company name from the user's setup form. Normalised here. */
  company?: string;
  /** Inferred role family (swe / pm / em / data / design / behavioral). */
  roleFamily?: RoleFamily;
  /** Interview focus area (behavioral / technical / case-study / etc). */
  focus?: FocusArea;
  /** How many references to return. Default 5, hard-capped at 8. */
  limit?: number;
}

export interface RetrievalResult {
  entries: BankEntry[];
  tier: RetrievalTier;
  /** True only when entries.length > 0. False is a signal to caller
   *  that no relevant references were found. */
  hasMatches: boolean;
}

/* ─── Company-name normalisation ────────────────────────────────────
   Users write "Flipkart", "FlipKart", "flipkart.com" — collapse to
   the bank's canonical key. Returns null when nothing matches; the
   retrieval then falls through to non-company tiers. */
const COMPANY_ALIASES: Record<string, CompanyKey> = {
  // FAANG / Big Tech
  google: "google", "google india": "google", alphabet: "google",
  amazon: "amazon", "amazon india": "amazon", "aws": "amazon",
  microsoft: "microsoft", "ms": "microsoft", "msft": "microsoft",
  meta: "meta", facebook: "meta", fb: "meta",
  apple: "apple",
  netflix: "netflix",
  uber: "uber",
  atlassian: "atlassian",
  stripe: "stripe",
  linkedin: "linkedin",
  adobe: "adobe",
  // Indian unicorns
  flipkart: "flipkart",
  razorpay: "razorpay",
  swiggy: "swiggy",
  zomato: "zomato",
  phonepe: "phonepe", "phone pe": "phonepe",
  paytm: "paytm",
  cred: "cred",
  zerodha: "zerodha",
  meesho: "meesho",
  oyo: "oyo",
  freshworks: "freshworks",
  zoho: "zoho",
  // IT services
  tcs: "tcs", "tata consultancy services": "tcs", "tata consultancy": "tcs",
  infosys: "infosys",
  wipro: "wipro",
  cognizant: "cognizant",
  accenture: "accenture",
  // Consulting
  mckinsey: "mckinsey", "mckinsey and company": "mckinsey",
  bcg: "bcg", "boston consulting group": "bcg",
  bain: "bain", "bain and company": "bain",
  deloitte: "deloitte",
  // Banking / Quant
  goldman: "goldman", "goldman sachs": "goldman",
  jpmc: "jpmc", "jp morgan": "jpmc", "jpmorgan": "jpmc", "jp morgan chase": "jpmc",
  "morgan stanley": "morgan-stanley",
  "jane street": "jane-street", janestreet: "jane-street",
  "de shaw": "de-shaw", deshaw: "de-shaw",
  citadel: "citadel",
  // AI labs
  openai: "openai",
  anthropic: "anthropic",
  sarvam: "sarvam", "sarvam ai": "sarvam",
};

export function normaliseCompany(raw: string | undefined): CompanyKey | null {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  if (!cleaned) return null;
  if (COMPANY_ALIASES[cleaned]) return COMPANY_ALIASES[cleaned];
  // Loose contains check for things like "Flipkart Internet Pvt Ltd"
  for (const [alias, key] of Object.entries(COMPANY_ALIASES)) {
    if (cleaned.includes(alias)) return key;
  }
  return null;
}

/* ─── Role-family inference ─────────────────────────────────────────
   The LLM prompt receives the user's free-text role ("Senior PM",
   "SDE-3", "Lead UX"). Map to the role family our bank uses. */
export function inferRoleFamily(rawRole: string | undefined): RoleFamily | null {
  if (!rawRole) return null;
  const r = rawRole.toLowerCase();
  // Order matters — more specific patterns must precede generic ones.
  // (e.g. "ML Engineer" must hit "ml" before "engineer" hits "swe".)
  if (/\b(ml engineer|ai engineer|llm engineer|genai|machine learning engineer|applied scientist|research engineer)\b/.test(r)) return "ml";
  if (/\b(quant|quantitative researcher|quantitative trader|quantitative developer|trader|systematic)\b/.test(r)) return "quant";
  // Consulting-specific titles only — exclude generic "partner" / "manager"
  // which over-trigger on "HR Partner", "Account Manager", etc.
  if (/\b(consultant|management consultant|strategy consultant|associate consultant|engagement manager)\b/.test(r)) return "consultant";
  if (/\b(writer|copywriter|editor|technical writer|ux writer|content designer|screenwriter|journalist)\b/.test(r)) return "writer";
  if (/\b(pm|product manager|product owner|apm|gpm|cpo|product lead|product analyst)\b/.test(r)) return "pm";
  if (/\b(em|engineering manager|tech lead|staff engineer|principal engineer|director)\b/.test(r)) return "em";
  if (/\b(data scientist|data engineer|data analyst|ds|business intelligence|analytics engineer)\b/.test(r)) return "data";
  if (/\b(senior designer|design lead|design manager|design director|head of design|principal designer)\b/.test(r)) return "designer-senior";
  if (/\b(designer|ux|ui|product designer)\b/.test(r)) return "design";
  if (/\b(swe|sde|software engineer|developer|programmer|engineer|backend|frontend|fullstack|full stack)\b/.test(r)) return "swe";
  // Default: behavioral applies to most non-technical generic roles.
  return "behavioral";
}

/* ─── Focus normalisation ───────────────────────────────────────────
   Map the user-facing focus value to the bank's FocusArea. */
const FOCUS_MAP: Record<string, FocusArea> = {
  behavioral: "behavioral", general: "general",
  technical: "technical", "system-design": "system-design",
  "case-study": "case-study", "campus-placement": "campus-placement",
  hr: "hr", panel: "panel", "salary-negotiation": "salary-negotiation",
  leadership: "leadership", strategic: "case-study",
};
export function normaliseFocus(raw: string | undefined): FocusArea | null {
  if (!raw) return null;
  return FOCUS_MAP[raw.toLowerCase()] || null;
}

/* ─── Recency weight ────────────────────────────────────────────────
   Older quarters get downweighted so 2024 questions don't outrank a
   fresh 2026 entry on a tie. Decay is mild — interview formats
   evolve gradually, not abruptly. */
function recencyWeight(addedQuarter: string): number {
  const m = addedQuarter.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return 0.5;
  const yearVal = parseInt(m[1], 10) + (parseInt(m[2], 10) - 1) * 0.25;
  const nowYear = new Date().getFullYear() + Math.floor(new Date().getMonth() / 3) * 0.25;
  const ageYears = Math.max(0, nowYear - yearVal);
  return 1 / (1 + ageYears * 0.4);
}

/* ─── The retrieval ────────────────────────────────────────────────
   Run the four tiers in order; return the first that gives ≥1 match.
   Within a tier, sort by recencyWeight DESC. */
export function retrieveReferenceQuestions(query: RetrievalQuery): RetrievalResult {
  const limit = Math.min(query.limit ?? 5, 8);
  const company = normaliseCompany(query.company);
  const roleFamily = query.roleFamily ?? null;
  const focus = query.focus ?? null;

  const sortByRecency = (a: BankEntry, b: BankEntry) =>
    recencyWeight(b.addedQuarter) - recencyWeight(a.addedQuarter);

  /* Tier 1: exact match */
  if (company && roleFamily && focus) {
    const exact = QUESTION_BANK.filter(e =>
      e.company === company && e.roleFamily === roleFamily && e.focus === focus,
    ).sort(sortByRecency).slice(0, limit);
    if (exact.length > 0) return { entries: exact, tier: 1, hasMatches: true };
  }

  /* Tier 2: same role + focus, any company */
  if (roleFamily && focus) {
    const t2 = QUESTION_BANK.filter(e =>
      e.roleFamily === roleFamily && e.focus === focus,
    ).sort(sortByRecency).slice(0, limit);
    if (t2.length > 0) return { entries: t2, tier: 2, hasMatches: true };
  }

  /* Tier 3: same focus only */
  if (focus) {
    const t3 = QUESTION_BANK.filter(e => e.focus === focus)
      .sort(sortByRecency).slice(0, limit);
    if (t3.length > 0) return { entries: t3, tier: 3, hasMatches: true };
  }

  /* Tier 4: no match — caller should fall through to pure LLM generation */
  return { entries: [], tier: 4, hasMatches: false };
}

/* ─── Prompt-injection formatter ────────────────────────────────────
   Render retrieved entries as a section the LLM prompt can include.
   The CRITICAL instruction — "use as STYLE inspiration, do NOT copy
   verbatim" — is part of the rendered block so it can never be
   accidentally omitted by callers. */
export function formatReferencesForPrompt(result: RetrievalResult): string {
  if (!result.hasMatches) {
    /* Tier 4: zero references. Tell the LLM explicitly so it knows
       it's flying blind on this combo and shouldn't fabricate
       company/role specifics. */
    return [
      "",
      "REAL-WORLD REFERENCE QUESTIONS (tier 4 — no direct match in our verified bank):",
      "GROUNDING NOTE: We have no verified reference questions for this exact (company × role × focus) combination. Stay with universally applicable questions for the focus area. DO NOT invent company-specific facts, scale numbers, product names, founders, or recent news. Use anonymous framings (\"a major Indian unicorn\", \"a high-scale payments product\") if you must reference the company at all.",
      "",
    ].join("\n");
  }
  const tierDescription =
    result.tier === 1 ? "exact match for this company, role, and focus"
    : result.tier === 2 ? "same role + focus at peer companies"
    : result.tier === 3 ? "same focus area, broader role pool"
    : "no direct match";
  const lines: string[] = [];
  lines.push("");
  lines.push(`REAL-WORLD REFERENCE QUESTIONS (tier ${result.tier} — ${tierDescription}):`);
  lines.push("These are HAND-CURATED, VERIFIED questions from real recent interviews. Use them as STYLE and DEPTH anchors. DO NOT copy them verbatim — generate fresh questions that match the format, specificity, and tone but use different wording, scenarios, or angles. The candidate must not see these literal strings.");
  /* Tier-aware grounding warning. The further from exact match, the
     less the LLM can rely on these references for company-specific
     fact grounding. Make the limit explicit so it doesn't improvise. */
  if (result.tier === 2) {
    lines.push("GROUNDING NOTE: These references are tier-2 (same role + focus, but at PEER companies, not the candidate's actual target). Use them for FORMAT and DEPTH calibration only. DO NOT carry over company-specific details (scale numbers, product names, internal processes) from these references — those belong to the peer company, not the candidate's target.");
  } else if (result.tier === 3) {
    lines.push("GROUNDING NOTE: These references are tier-3 (same focus area, different role family). Use them ONLY to calibrate the focus-area question style. DO NOT carry over the role-specific or company-specific specifics — they belong to a different interview context. Ground every company/role mention in the candidate's stated target, in generic terms if no verified facts are available.");
  }
  lines.push("");
  for (const e of result.entries) {
    /* Confidence stamp surfaces verified vs inferred. The LLM is
       instructed to anchor harder on verified specifics; treat
       inferred entries as directional only. Default = verified. */
    const confidence = e.confidence ?? "verified";
    const confidenceTag = confidence === "verified" ? "" : ` [confidence: inferred]`;
    lines.push(`  - ${e.text}${confidenceTag}`);
    if (e.styleNote) lines.push(`    [pattern: ${e.styleNote}]`);
  }
  lines.push("");
  lines.push("CONFIDENCE NOTE: Entries marked [confidence: inferred] are pattern extrapolations from public job descriptions, NOT cross-source-verified candidate post-mortems. Treat them as directional style guides only — do NOT anchor specific fact claims to them. Unmarked entries are verified from 2+ independent candidate sources.");
  lines.push("");
  return lines.join("\n");
}
