import { type CandidateProfileResult, EMPTY_CANDIDATE_PROFILE } from "./_candidate-profile-types";

/* ─── PDF #17 architectural fix (2026-05-15) — discovery-flag detectors ──
 *
 * Six pure detector functions for the discovery-first state machine.
 * Each returns a single boolean indicating whether the candidate's
 * utterance contains the relevant disclosure signal. The recruiter
 * MUST collect these signals (via getNextDiscoveryQuestion + the
 * isDiscoveryComplete gate) BEFORE disclosing an anchor band. */

/** Detect candidate disclosing current CTC. Looks for an explicit
 *  reference to current package + a ₹ / lakh number. Pure. */
export function detectCurrentCtcDisclosed(text: string): boolean {
  if (!text) return false;
  /* Must mention current/present compensation context AND a number/
   * range. We're conservative: a bare number without "current"/"earn"/
   * "package" context isn't a CTC disclosure (could be a target). */
  const ctcContext =
    /\b(?:my\s+current\s+(?:ctc|salary|package|comp|cost\s+to\s+company)|i'?m\s+earning|i\s+earn|i\s+make|current\s+package(?:\s+is)?|presently\s+(?:earning|getting)|today\s+i\s+(?:earn|make|get))\b/i.test(text) ||
    /\b(?:currently|right\s+now)\s+(?:at|on|earning|making|getting)\b/i.test(text);
  if (!ctcContext) return false;
  return /(?:₹|rs\.?|inr|\d+\s*(?:lpa|lakh|l\b|k\b|cr\b|crore))/i.test(text);
}

/** Detect candidate disclosing fixed/variable split. Pure. */
export function detectFixedVariableSplitDisclosed(text: string): boolean {
  if (!text) return false;
  if (/\b\d+\s*[-\s]*\d+\s*split\b/i.test(text)) return true;
  if (/\b(?:fixed\s+is|fixed\s+component|fixed\s+portion|fixed\s+pay)\b.{0,40}(?:₹|rs\.?|\d)/i.test(text)) return true;
  if (/\b(?:variable\s+is|variable\s+component|variable\s+portion|variable\s+pay)\b.{0,40}(?:₹|rs\.?|\d|%)/i.test(text)) return true;
  if (/\b\d+\s*(?:fixed|fix)\s+(?:and|plus|\+|,)\s*\d+\s*(?:variable|var)\b/i.test(text)) return true;
  if (/\bsplit\s+is\s+(?:about\s+|around\s+)?\d+/i.test(text)) return true;
  return false;
}

/** Detect candidate disclosing in-hand / take-home salary. Pure. */
export function detectInHandSalaryDisclosed(text: string): boolean {
  if (!text) return false;
  if (/\b(?:in\s*-?\s*hand|take\s*-?\s*home|monthly\s+net|net\s+per\s+month|net\s+(?:salary|in\s+hand))\b.{0,50}(?:₹|rs\.?|inr|\d)/i.test(text)) return true;
  if (/(?:₹|rs\.?|inr)\s*[\d.,]+\s*(?:in\s*-?\s*hand|take\s*-?\s*home|net|per\s+month)\b/i.test(text)) return true;
  return false;
}

/** Detect candidate disclosing notice period or earliest joining date.
 *  Pure. */
export function detectNoticePeriodDisclosed(text: string): boolean {
  if (!text) return false;
  if (/\b\d+\s*(?:day|days|week|weeks|month|months)\s*(?:of\s+)?notice\b/i.test(text)) return true;
  if (/\bnotice\s+(?:period\s+)?(?:is|of)\s+\d+\s*(?:day|week|month)/i.test(text)) return true;
  if (/\b(?:i\s+can\s+join|i'?ll\s+be\s+able\s+to\s+join|can\s+join)\s+(?:in\s+)?\d+\s*(?:day|week|month)/i.test(text)) return true;
  if (/\bserving\s+(?:my\s+)?notice\b/i.test(text)) return true;
  if (/\b(?:90|60|30|45|15)\s*[-\s]*day\s+notice\b/i.test(text)) return true;
  return false;
}

/** Detect candidate disclosing competing offer status (positive or
 *  negative). Pure. */
export function detectCompetingOffersDisclosed(text: string): boolean {
  if (!text) return false;
  if (/\b(?:i\s+have\s+(?:another|other|a\s+competing)\s+offer|i'?ve\s+got\s+another\s+offer|other\s+offers?\s+in\s+hand|active\s+offer)\b/i.test(text)) return true;
  if (/\b(?:in\s+process\s+with|interviewing\s+(?:at|with)|in\s+the\s+(?:final|last)\s+round\s+(?:at|with))\b/i.test(text)) return true;
  if (/\bcompeting\s+offers?\b/i.test(text)) return true;
  if (/\b(?:no\s+other\s+offers|i\s+don'?t\s+have\s+(?:any\s+)?other\s+offers|not\s+(?:in\s+process|interviewing)\s+(?:anywhere|with\s+anyone))\b/i.test(text)) return true;
  if (/\bonly\s+(?:offer|company)\s+(?:i'?m|i\s+am)\s+(?:talking\s+to|in\s+process\s+with)\b/i.test(text)) return true;
  return false;
}

/** Detect role-specific value proof. Pure — generic across role
 *  families. Captures ARR / book size / quota / team / product / scale
 *  numbers in a value-claim context. */
export function detectValueProofProvided(text: string): boolean {
  if (!text) return false;
  /* CSM/CS: ARR / book / retention */
  if (/\b(?:arr|annual\s+recurring|gross\s+retention|net\s+retention|gdr|ndr|gross\s+renewal|book\s+of\s+business|book\s+size)\b/i.test(text)) return true;
  /* Sales: quota / attainment / deal size */
  if (/\b(?:quota\s+(?:of|attainment)|hit\s+\d+%\s+of\s+quota|attained\s+\d+%|deal\s+size|acv|tcv|pipeline\s+of)\b/i.test(text)) return true;
  /* Engineering: scale numbers / systems shipped */
  if (/\b(?:architected|built|scaled|designed)\s+(?:a\s+)?(?:system|platform|service|pipeline)\b.{0,80}(?:million|billion|rps|qps|requests|users|transactions)/i.test(text)) return true;
  if (/\b(?:handling|serving|processing)\s+\d+(?:k|m|mn|bn|million|billion)\s+(?:requests|users|events|transactions|rps|qps)/i.test(text)) return true;
  /* Product: launched + metrics */
  if (/\b(?:launched|shipped|owned|drove)\b.{0,80}(?:metric|dau|mau|gmv|conversion|retention\s+by|revenue\s+by|grew\s+by|up\s+\d+%)/i.test(text)) return true;
  /* Design: portfolio depth */
  if (/\b(?:my\s+portfolio|case\s+study|case\s+studies|design\s+system|design\s+system\s+i\s+(?:built|owned))\b/i.test(text)) return true;
  /* People mgmt scope */
  if (/\b(?:i\s+(?:lead|manage|managed|led|run)\s+(?:a\s+)?team\s+of\s+\d+|team\s+of\s+\d+\s+(?:engineers|designers|pms|reports))\b/i.test(text)) return true;
  return false;
}

/* ─── Phase 29 (2026-05-14) — Role-applicable YOE ────────────────────
 *
 * A Senior Product Designer with 6 years of experience applying for a
 * Java Developer role has totalYoe=6 but applicableYoe≈0 — the
 * negotiation kernel must NOT pay senior rates for unrelated tenure.
 *
 * Two inputs:
 *   - resumeProfile.primaryDomain (e.g. "Product Design", "Java
 *     Backend", "Data Science") — emitted by analyze-resume.
 *   - targetRole (e.g. "java developer") — known at session start.
 *
 * Three outcomes:
 *   - match    → applicableYoe = totalYoe
 *   - adjacent → applicableYoe = totalYoe * 0.5
 *   - pivot    → applicableYoe = 0
 *
 * Conservative: when primaryDomain is missing/empty we fall back to
 * domainPivot / transferableSkillsClaimed utterance signals (if a pivot
 * is asserted in dialogue, applicableYoe collapses to 0).
 *
 * Pure: no clock, no IO. */

export interface ApplicableYoeInputs {
  totalYoe: number | null;
  primaryDomain: string | null;
  targetRole: string;
  /** Optional fallbacks from utterance-derived candidateProfile. */
  domainPivot?: boolean;
}

export interface DomainCanon {
  /** Canonical domain key surfaced from a free-form string. */
  key: string;
  /** Adjacent domains by canonical key. */
  adjacent: string[];
}

/* Lowercase-keyword → canonical domain. Order matters: more-specific
 * phrases first so "product designer" beats "designer". */
/* Exported for the domain-graph invariant test
 * (src/__tests__/domainGraphInvariants.test.ts). Not part of the
 * runtime public API — leading double underscore signals "internal,
 * audit-only". */
export const __DOMAIN_KEYWORDS_INTERNAL: Array<[RegExp, string]> = [
  [/\b(product\s+design(er)?|ux\s+design(er)?|ui\/?ux|interaction\s+design)\b/i, "product-design"],
  [/\b(visual\s+design|graphic\s+design|brand\s+design)\b/i, "visual-design"],
  [/\b(java\s+(backend|developer|engineer)|spring\s+boot|java\s+ee|j2ee)\b/i, "java-backend"],
  [/\b(python\s+backend|django|flask|fastapi)\b/i, "python-backend"],
  [/\b(node\.?js|nodejs\s+backend|express\s+backend)\b/i, "node-backend"],
  [/\b(\.net|c#|dotnet)\s+(backend|developer|engineer)?\b/i, "dotnet-backend"],
  [/\b(go(lang)?\s+(backend|developer|engineer))\b/i, "go-backend"],
  [/\b(backend\s+(engineer|developer|engineering)|server[-\s]side)\b/i, "backend"],
  [/\b(frontend\s+(engineer|developer|engineering)|react|angular|vue|web\s+frontend)\b/i, "frontend"],
  [/\b(full[-\s]?stack)\b/i, "fullstack"],
  [/\b(mobile|android|ios|react\s+native|flutter)\s*(engineer|developer)?\b/i, "mobile"],
  [/\b(data\s+(science|scientist)|machine\s+learning|ml\s+engineer|ai\s+engineer)\b/i, "data-science"],
  [/\b(data\s+(engineer|engineering)|etl|pipeline|warehouse)\b/i, "data-engineering"],
  [/\b(data\s+analyst|business\s+analyst|analytics)\b/i, "data-analyst"],
  [/\b(devops|sre|site\s+reliability|platform\s+engineer|infrastructure)\b/i, "devops"],
  [/\b(security\s+engineer|appsec|infosec|cybersecurity)\b/i, "security"],
  [/\b(product\s+manager|product\s+management|pm\b)\b/i, "product-management"],
  [/\b(program\s+manager|tpm|technical\s+program)\b/i, "program-management"],
  [/\b(product\s+marketing|pmm)\b/i, "product-marketing"],
  [/\b(social\s+media\s+(manager|lead|specialist|executive|coordinator|strategist)?|community\s+manager|influencer\s+(marketing|manager))\b/i, "social-media"],
  [/\b(marketing\s+(manager|lead)?|growth\s+marketing|digital\s+marketing)\b/i, "marketing"],
  [/\b(sales\s+(engineer|executive|manager)?|account\s+executive|sdr|bdr)\b/i, "sales"],
  [/\b(customer\s+success|cs\s+manager|implementation)\b/i, "customer-success"],
  [/\b(qa\s+(engineer)?|test\s+(engineer|automation)|sdet)\b/i, "qa"],
  [/\b(content\s+(writer|strategist)|technical\s+writer|copywriter)\b/i, "content"],
  [/\b(hr\b|human\s+resources|people\s+(ops|operations)|recruiter|talent\s+acquisition|hr\s+manager|hrbp)\b/i, "hr-people"],
  [/\b(finance\s+(manager|analyst)?|financial\s+analyst|accountant|controller|fp&a|treasur(er|y))\b/i, "finance"],
  /* Bug-report 13 (2026-05-14) — Operations / management / business
   * domain mappings. Pre-13 the table only had a single "operations"
   * keyword which matched too narrowly, and no entries for management /
   * business analyst / customer-success-manager etc., so a Senior
   * Product Designer applying for Operations Manager was getting an
   * "unknown" classification on the target side → applicableYoe
   * defaulted to totalYoe → senior band → catastrophic ₹25L opener. */
  [/\b(operations\s+(manager|lead|head|director)?|ops\s+(manager|lead|head)?|coo\b|chief\s+operating\s+officer|supply\s+chain\s+(manager|lead)?|logistics\s+(manager|lead)?|warehouse\s+(manager|lead)?|fulfilment|fulfillment)\b/i, "operations"],
  [/\b(project\s+manager|program\s+manager|engineering\s+manager|general\s+manager|delivery\s+manager|gm\b|pmo\b)\b/i, "management"],
  [/\b(business\s+(analyst|operations|ops)|biz\s*ops|bizops)\b/i, "business"],
  [/\b(account\s+manager|customer\s+success\s+(manager|lead)?|customer\s+experience\s+(lead|manager)?|cx\s+(lead|manager))\b/i, "customer-success"],
  [/\b(brand\s+(manager|lead)|growth\s+(manager|lead)|marketing\s+(manager|lead|director)?)\b/i, "marketing"],
  [/\b(consultant|consulting|advisory)\b/i, "consulting"],
  [/\b(teach(ing|er)?|educator|instructor|professor)\b/i, "education"],
];

/* Adjacency graph — keyed by canonical domain. Edges are bidirectional
 * conceptually but stored from-each-side for O(1) lookup. */
/* Session A (2026-05-14) audit — graph normalised to be bidirectional
 * and every key referenced by DOMAIN_KEYWORDS / by an edge value MUST
 * be a key in this record (no orphan nodes). The runtime classifier
 * uses `cand.adj.includes(b) || b.adj.includes(a)` so prior asymmetries
 * were behaviour-equivalent, but the audit invariant test now enforces
 * proper bidirectionality so the graph can be reasoned about. The
 * operations / hr-people / finance / qa / education buckets remain
 * intentionally pivot-only (no outgoing adjacency) — this is the
 * design intent from bug-report 13. */
export const __ADJACENT_INTERNAL: Record<string, string[]> = {
  "product-design": ["visual-design", "frontend", "product-management"],
  "visual-design": ["product-design"],
  "frontend": ["fullstack", "mobile", "product-design"],
  "fullstack": ["frontend", "backend", "java-backend", "node-backend"],
  "backend": ["fullstack", "java-backend", "python-backend", "node-backend", "dotnet-backend", "go-backend", "devops", "data-engineering", "security", "management"],
  "java-backend": ["backend", "fullstack"],
  "python-backend": ["backend", "data-engineering"],
  "node-backend": ["backend", "fullstack"],
  "dotnet-backend": ["backend"],
  "go-backend": ["backend", "devops"],
  "mobile": ["frontend"],
  "data-science": ["data-engineering", "data-analyst"],
  "data-engineering": ["data-science", "backend", "python-backend"],
  "data-analyst": ["data-science", "product-management", "business"],
  "devops": ["backend", "security", "go-backend"],
  "security": ["devops", "backend"],
  "product-management": ["product-marketing", "program-management", "data-analyst", "customer-success", "management", "product-design"],
  "program-management": ["product-management", "management"],
  "product-marketing": ["product-management", "marketing"],
  "marketing": ["product-marketing", "content", "sales", "social-media"],
  /* Bug-report 14 (2026-05-14) — social-media as its own bucket.
   * Adjacent to marketing + content (skill transfer is real: copy,
   * brand, audience). Not adjacent to product-design — a Senior
   * Product Designer → Social Media Manager is a true craft pivot. */
  "social-media": ["marketing", "content"],
  "sales": ["customer-success", "marketing"],
  "customer-success": ["sales", "product-management"],
  /* Bug-report 13 — management cluster is internally adjacent (e.g.
   * Engineering Manager → Program Manager). Operations / business /
   * hr-people / finance are intentionally NOT adjacent to anything else
   * outside their own bucket: cross-bucket transitions (Product Design
   * → Operations Manager, Engineering → Operations) must classify as
   * pivot to keep applicableYoe=0 and prevent over-anchoring. */
  "management": ["product-management", "program-management", "backend"],
  "business": ["data-analyst", "consulting"],
  "consulting": ["business"],
  "content": ["marketing", "social-media"],
  /* Pivot-only buckets — empty adjacency by design. */
  "operations": [],
  "hr-people": [],
  "finance": [],
  "qa": [],
  "education": [],
};

export function canonDomain(s: string | null | undefined): DomainCanon | null {
  if (!s) return null;
  for (const [pat, key] of __DOMAIN_KEYWORDS_INTERNAL) {
    if (pat.test(s)) return { key, adjacent: __ADJACENT_INTERNAL[key] ?? [] };
  }
  return null;
}

export type ApplicableYoeRelation = "match" | "adjacent" | "pivot" | "unknown";

export interface ApplicableYoeResult {
  applicableYoe: number | null;
  relation: ApplicableYoeRelation;
  /** The canonical key inferred for the candidate's primary domain. */
  candidateDomainKey: string | null;
  /** The canonical key inferred for the target role's domain. */
  targetDomainKey: string | null;
}

/** Map (primaryDomain, targetRole, totalYoe) → applicableYoe.
 *  Pure. */
export function computeApplicableYoe(input: ApplicableYoeInputs): ApplicableYoeResult {
  const { totalYoe, primaryDomain, targetRole } = input;
  const cand = canonDomain(primaryDomain);
  const tgt = canonDomain(targetRole);

  /* Conservative defaults when we can't classify both sides. */
  if (totalYoe == null) {
    return { applicableYoe: null, relation: "unknown", candidateDomainKey: cand?.key ?? null, targetDomainKey: tgt?.key ?? null };
  }
  if (!cand || !tgt) {
    /* Bug-report 14 (2026-05-14) — when either side fails to classify
     * we previously defaulted to `relation: "unknown"` with applicableYoe
     * = totalYoe (full credit). That is the wrong direction for a
     * salary kernel: granting full credit to an unrecognised target role
     * lets a senior candidate's YoE anchor a senior-tier band for a
     * role the system has no model of. Bug-13 (Senior Product Designer
     * → Operations Manager → ₹25L opener) and Bug-14 (Senior Product
     * Designer → Social Media Manager → ₹32L opener) are the same
     * bug class, both rooted here. Band-aiding by adding more domain
     * keywords fixes the symptom for that role and leaves the next
     * unknown role exposed.
     *
     * Correct contract: when we cannot model the relationship, treat
     * it as a pivot. applicableYoe collapses to 0, the band-resolver
     * picks the entry tier, and the recruiter offers conservatively.
     * If the candidate IS in fact senior in the unknown role, they
     * will negotiate up from a low opener — the failure mode is mild
     * (under-offer + counter) rather than catastrophic (6–8× market
     * offer that destroys the simulation's pedagogical value).
     *
     * `relation: "unknown"` is still emitted when totalYoe is null
     * (the truly unknowable case, handled above), so callers that
     * branch on "unknown" for telemetry continue to work. */
    return { applicableYoe: 0, relation: "pivot", candidateDomainKey: cand?.key ?? null, targetDomainKey: tgt?.key ?? null };
  }
  if (cand.key === tgt.key) {
    return { applicableYoe: totalYoe, relation: "match", candidateDomainKey: cand.key, targetDomainKey: tgt.key };
  }
  if (cand.adjacent.includes(tgt.key) || tgt.adjacent.includes(cand.key)) {
    return { applicableYoe: Math.round(totalYoe * 0.5 * 10) / 10, relation: "adjacent", candidateDomainKey: cand.key, targetDomainKey: tgt.key };
  }
  return { applicableYoe: 0, relation: "pivot", candidateDomainKey: cand.key, targetDomainKey: tgt.key };
}

/** Convert applicableYoe → experienceLevel keyword consumed by the
 *  salary-lookup band resolver. Buckets: 0–1 entry, 2–4 mid, 5–8 senior,
 *  9+ staff. Null when no signal. Pure. */
export function experienceLevelFromYoe(yoe: number | null | undefined): "entry" | "mid" | "senior" | "staff" | null {
  if (yoe == null || !Number.isFinite(yoe)) return null;
  if (yoe <= 1) return "entry";
  if (yoe <= 4) return "mid";
  if (yoe <= 8) return "senior";
  return "staff";
}

export function mergeCandidateProfile(
  prior: CandidateProfileResult | null | undefined,
  next: CandidateProfileResult,
): CandidateProfileResult {
  const p = prior ?? EMPTY_CANDIDATE_PROFILE;
  const merged: CandidateProfileResult = {
    careerGapMonths: next.careerGapMonths ?? p.careerGapMonths,
    careerGapActivity: next.careerGapActivity ?? p.careerGapActivity,
    tenureSignal: next.tenureSignal ?? p.tenureSignal,
    levelMismatch: next.levelMismatch ?? p.levelMismatch,
    /* domainPivot + transferableSkillsClaimed are monotone-up — once
     * the candidate disclosed a pivot the recruiter would remember. */
    domainPivot: p.domainPivot || next.domainPivot,
    transferableSkillsClaimed:
      p.transferableSkillsClaimed || next.transferableSkillsClaimed,
    /* compensationHistoryIssue prefers the more severe of the two
     * (unpaid > delayed). Last-stated escalation wins. */
    compensationHistoryIssue:
      next.compensationHistoryIssue === "unpaid"
        ? "unpaid"
        : p.compensationHistoryIssue === "unpaid"
          ? "unpaid"
          : (next.compensationHistoryIssue ?? p.compensationHistoryIssue),
    /* Phase 26 — both fields are monotone-up: once the candidate has
     * disclosed a bond or raised the probation-comp question, the
     * recruiter would remember through the rest of the session. */
    serviceBondAccepted: p.serviceBondAccepted || next.serviceBondAccepted,
    probationCompMentioned: p.probationCompMentioned || next.probationCompMentioned,
    /* internshipConversion is monotone-up — once the candidate disclosed
     * "I was your intern" or "convert my PPO", the recruiter remembers. */
    internshipConversion: p.internshipConversion || next.internshipConversion,
    /* collegeTier — last-stated wins (recruiter would update mental
     * model on disclosure), but never demoted from null. */
    collegeTier: next.collegeTier ?? p.collegeTier,
    /* Junior-flow (2026-05-14e) — all four are monotone-up. Once the
     * candidate disclosed an early switch / low CTC / prior internship
     * / service background, the recruiter would remember through the
     * rest of the session. */
    earlySwitcher: p.earlySwitcher || next.earlySwitcher,
    lowCtcAlert: p.lowCtcAlert || next.lowCtcAlert,
    priorInternshipNonConversion: p.priorInternshipNonConversion || next.priorInternshipNonConversion,
    serviceCompanyBackground: p.serviceCompanyBackground || next.serviceCompanyBackground,
    compBreakupUnknown: p.compBreakupUnknown || next.compBreakupUnknown,
    /* Real-world Indian extensions (2026-05-14g) — all monotone-up.
     * Once disclosed, the recruiter would remember through the session. */
    recentLayoff: p.recentLayoff || next.recentLayoff,
    hotDomainPremium: p.hotDomainPremium || next.hotDomainPremium,
    pipDisclosed: p.pipDisclosed || next.pipDisclosed,
    verbalOnlyOffer: p.verbalOnlyOffer || next.verbalOnlyOffer,
    culturalJoiningConstraint: p.culturalJoiningConstraint || next.culturalJoiningConstraint,
    /* Senior + process + long-tail (2026-05-14h) — all monotone-up. */
    peopleManagementClaimed: p.peopleManagementClaimed || next.peopleManagementClaimed,
    mncExperience: p.mncExperience || next.mncExperience,
    crossBorderAnchor: p.crossBorderAnchor || next.crossBorderAnchor,
    unvestedEquityLossClaim: p.unvestedEquityLossClaim || next.unvestedEquityLossClaim,
    explodingOfferPressure: p.explodingOfferPressure || next.explodingOfferPressure,
    postAcceptanceRenege: p.postAcceptanceRenege || next.postAcceptanceRenege,
    quotaAttainmentClaimed: p.quotaAttainmentClaimed || next.quotaAttainmentClaimed,
    gardenLeaveDisclosed: p.gardenLeaveDisclosed || next.gardenLeaveDisclosed,
    nonCompeteFlagged: p.nonCompeteFlagged || next.nonCompeteFlagged,
    relocationBonusAsked: p.relocationBonusAsked || next.relocationBonusAsked,
    /* Wave-2 (2026-05-14i) — all monotone-up. */
    parentInsuranceAsked: p.parentInsuranceAsked || next.parentInsuranceAsked,
    inHandTakehomeFocus: p.inHandTakehomeFocus || next.inHandTakehomeFocus,
    rtoPushback: p.rtoPushback || next.rtoPushback,
    returnshipMaternity: p.returnshipMaternity || next.returnshipMaternity,
    payBandAsked: p.payBandAsked || next.payBandAsked,
    taxStructureAsked: p.taxStructureAsked || next.taxStructureAsked,
    bgvAnxiety: p.bgvAnxiety || next.bgvAnxiety,
    esopSophisticationProbe: p.esopSophisticationProbe || next.esopSophisticationProbe,
    spouseJobConstraint: p.spouseJobConstraint || next.spouseJobConstraint,
    agingParentCare: p.agingParentCare || next.agingParentCare,
    moonlightingDisclosed: p.moonlightingDisclosed || next.moonlightingDisclosed,
    mentalHealthDisclosed: p.mentalHealthDisclosed || next.mentalHealthDisclosed,
    payParityAsked: p.payParityAsked || next.payParityAsked,
    preemptiveCounterReceived: p.preemptiveCounterReceived || next.preemptiveCounterReceived,
    acceptanceTimeRequest: p.acceptanceTimeRequest || next.acceptanceTimeRequest,
    cryptoTokenComp: p.cryptoTokenComp || next.cryptoTokenComp,
    gccArbitrageAnchor: p.gccArbitrageAnchor || next.gccArbitrageAnchor,
    benchTimeDisclosed: p.benchTimeDisclosed || next.benchTimeDisclosed,
    founderSecondInnings: p.founderSecondInnings || next.founderSecondInnings,
    latecareerAgeBias: p.latecareerAgeBias || next.latecareerAgeBias,
    /* Wave-3 (2026-05-14j) — all monotone-up. */
    titlePrecisionAsk: p.titlePrecisionAsk || next.titlePrecisionAsk,
    currentCtcRefusal: p.currentCtcRefusal || next.currentCtcRefusal,
    pregnancyDisclosed: p.pregnancyDisclosed || next.pregnancyDisclosed,
    boomerangRehire: p.boomerangRehire || next.boomerangRehire,
    referralReceived: p.referralReceived || next.referralReceived,
    hometownReturnPreference: p.hometownReturnPreference || next.hometownReturnPreference,
    pwdDisability: p.pwdDisability || next.pwdDisability,
    gratuityVestingNear: p.gratuityVestingNear || next.gratuityVestingNear,
    acquisitionContextAsk: p.acquisitionContextAsk || next.acquisitionContextAsk,
    lgbtqDisclosure: p.lgbtqDisclosure || next.lgbtqDisclosure,
    chronicIllnessDisclosed: p.chronicIllnessDisclosed || next.chronicIllnessDisclosed,
    noticeBuyoutAsk: p.noticeBuyoutAsk || next.noticeBuyoutAsk,
    bfsiClawbackContext: p.bfsiClawbackContext || next.bfsiClawbackContext,
    bigFourGradeStep: p.bigFourGradeStep || next.bigFourGradeStep,
    securityClearanceNeeded: p.securityClearanceNeeded || next.securityClearanceNeeded,
    missionDrivenComp: p.missionDrivenComp || next.missionDrivenComp,
    edtechReputationCheck: p.edtechReputationCheck || next.edtechReputationCheck,
    acquiHireContext: p.acquiHireContext || next.acquiHireContext,
    cabinParkingAsk: p.cabinParkingAsk || next.cabinParkingAsk,
    spanOfControlAsk: p.spanOfControlAsk || next.spanOfControlAsk,
    preResignationStealth: p.preResignationStealth || next.preResignationStealth,
    reverseAnchorAsk: p.reverseAnchorAsk || next.reverseAnchorAsk,
    dietaryReligiousNeed: p.dietaryReligiousNeed || next.dietaryReligiousNeed,
    oldEmployerDocsIssue: p.oldEmployerDocsIssue || next.oldEmployerDocsIssue,
    equityRefreshCadenceAsk: p.equityRefreshCadenceAsk || next.equityRefreshCadenceAsk,
    /* Wave-3D (PDF #17 follow-up, 2026-05-15) — equity-instrument depth. */
    equityVestingScheduleAsk: p.equityVestingScheduleAsk || next.equityVestingScheduleAsk,
    equityCliffPeriodAsk: p.equityCliffPeriodAsk || next.equityCliffPeriodAsk,
    equityExerciseTermsAsk: p.equityExerciseTermsAsk || next.equityExerciseTermsAsk,
    equityBuybackLiquidityAsk: p.equityBuybackLiquidityAsk || next.equityBuybackLiquidityAsk,
    /* Wave-4 (2026-05-14k) — all monotone-up. */
    signOnClawback: p.signOnClawback || next.signOnClawback,
    variableTrackRecord: p.variableTrackRecord || next.variableTrackRecord,
    wfhEquipmentStipend: p.wfhEquipmentStipend || next.wfhEquipmentStipend,
    salaryReviewCadenceAsk: p.salaryReviewCadenceAsk || next.salaryReviewCadenceAsk,
    multipleOffersJuggling: p.multipleOffersJuggling || next.multipleOffersJuggling,
    recruitmentAgencyMediation: p.recruitmentAgencyMediation || next.recruitmentAgencyMediation,
    internalTransferContext: p.internalTransferContext || next.internalTransferContext,
    offerRescindedHistory: p.offerRescindedHistory || next.offerRescindedHistory,
    internationalDegreePremium: p.internationalDegreePremium || next.internationalDegreePremium,
    domesticTopMbaAnchor: p.domesticTopMbaAnchor || next.domesticTopMbaAnchor,
    toxicManagerContext: p.toxicManagerContext || next.toxicManagerContext,
    visaSponsorshipNeed: p.visaSponsorshipNeed || next.visaSponsorshipNeed,
    casteReservationContext: p.casteReservationContext || next.casteReservationContext,
    veteranTransition: p.veteranTransition || next.veteranTransition,
    singleParentConstraint: p.singleParentConstraint || next.singleParentConstraint,
    jointFamilyFinancialResp: p.jointFamilyFinancialResp || next.jointFamilyFinancialResp,
    paternityLeaveAsk: p.paternityLeaveAsk || next.paternityLeaveAsk,
    menstrualLeavePolicy: p.menstrualLeavePolicy || next.menstrualLeavePolicy,
    esopExerciseLoanAsk: p.esopExerciseLoanAsk || next.esopExerciseLoanAsk,
    preIpoSecondaryAsk: p.preIpoSecondaryAsk || next.preIpoSecondaryAsk,
    accelerationTriggerAsk: p.accelerationTriggerAsk || next.accelerationTriggerAsk,
    esopPerquisiteTaxAsk: p.esopPerquisiteTaxAsk || next.esopPerquisiteTaxAsk,
    tenderOfferCycleAsk: p.tenderOfferCycleAsk || next.tenderOfferCycleAsk,
    probationaryDurationAsk: p.probationaryDurationAsk || next.probationaryDurationAsk,
    offerLetterTurnaroundDemand: p.offerLetterTurnaroundDemand || next.offerLetterTurnaroundDemand,
    contractToHireAsk: p.contractToHireAsk || next.contractToHireAsk,
    headcountApprovalCheck: p.headcountApprovalCheck || next.headcountApprovalCheck,
    ipAssignmentClauseAsk: p.ipAssignmentClauseAsk || next.ipAssignmentClauseAsk,
    healthcarePharmaContext: p.healthcarePharmaContext || next.healthcarePharmaContext,
    manufacturingCoreContext: p.manufacturingCoreContext || next.manufacturingCoreContext,
    quickCommerceContext: p.quickCommerceContext || next.quickCommerceContext,
    d2cConsumerEquity: p.d2cConsumerEquity || next.d2cConsumerEquity,
    /* PDF #17 architectural fix (2026-05-15) — six discovery-flag
     * detectors. All monotone-up: once the candidate has disclosed
     * the signal, the recruiter would remember through the session. */
    currentCtcDisclosed:
      (p.currentCtcDisclosed ?? false) || (next.currentCtcDisclosed ?? false),
    fixedVariableSplitDisclosed:
      (p.fixedVariableSplitDisclosed ?? false) || (next.fixedVariableSplitDisclosed ?? false),
    inHandSalaryDisclosed:
      (p.inHandSalaryDisclosed ?? false) || (next.inHandSalaryDisclosed ?? false),
    noticePeriodDisclosed:
      (p.noticePeriodDisclosed ?? false) || (next.noticePeriodDisclosed ?? false),
    competingOffersDisclosed:
      (p.competingOffersDisclosed ?? false) || (next.competingOffersDisclosed ?? false),
    valueProofProvided:
      (p.valueProofProvided ?? false) || (next.valueProofProvided ?? false),
    /* Wave-5 (ITEM 4, 2026-05-15) — all monotone-up except nullable unions. */
    counterOfferRisk: next.counterOfferRisk ?? p.counterOfferRisk,
    /* Wave-6 (2026-05-15) — all monotone-up except nullable numerics. */
    wantsHigherBase: p.wantsHigherBase || next.wantsHigherBase,
    wantsJoiningBonus: p.wantsJoiningBonus || next.wantsJoiningBonus,
    wantsRelocationAllowance: p.wantsRelocationAllowance || next.wantsRelocationAllowance,
    wantsFlexibleWork: p.wantsFlexibleWork || next.wantsFlexibleWork,
    /* offerDeadlineText — latest non-null wins. */
    /* Wave-7 (2026-05-15) — all monotone-up. */
    invokedCompetingOffer: p.invokedCompetingOffer || next.invokedCompetingOffer,
    askedAboutGrowthPath: p.askedAboutGrowthPath || next.askedAboutGrowthPath,
    gaveInconsistentNumbers: p.gaveInconsistentNumbers || next.gaveInconsistentNumbers,
    evasiveOnCurrentCtc: p.evasiveOnCurrentCtc || next.evasiveOnCurrentCtc,
    /* Wave-8 (2026-05-16) — monotone-up booleans; nullable fields take last non-null. */
    mentionedSpouseFamily: p.mentionedSpouseFamily || next.mentionedSpouseFamily,
    mentionedForm16: p.mentionedForm16 || next.mentionedForm16,
    askedAboutReporting: p.askedAboutReporting || next.askedAboutReporting,
    askedAboutTeamSize: p.askedAboutTeamSize || next.askedAboutTeamSize,
    askedAboutGrowthPath8: p.askedAboutGrowthPath8 || next.askedAboutGrowthPath8,
    competingOfferAmount: Math.max(p.competingOfferAmount ?? 0, next.competingOfferAmount ?? 0) || null,
    /* Wave-9 (2026-05-16) — all monotone-up. */
    mentionedBgvConcern: p.mentionedBgvConcern || next.mentionedBgvConcern,
    mentionedMoonlighting: p.mentionedMoonlighting || next.mentionedMoonlighting,
    gaveRangeNotPoint: p.gaveRangeNotPoint || next.gaveRangeNotPoint,
    deflectedOnRange: p.deflectedOnRange || next.deflectedOnRange,
    referencedMarketData: p.referencedMarketData || next.referencedMarketData,
    /* Polish 3 (2026-05-16) — union-merge per-source citations across
     * turns so the planner can name everything the candidate has ever
     * cited in this session. */
    referencedMarketDataSources: Array.from(
      new Set([
        ...(p.referencedMarketDataSources ?? []),
        ...(next.referencedMarketDataSources ?? []),
      ]),
    ),
    mentionedTaxImplication: p.mentionedTaxImplication || next.mentionedTaxImplication,
    hasAny: false,
  };
  merged.hasAny =
    merged.careerGapMonths != null ||
    merged.careerGapActivity != null ||
    merged.tenureSignal != null ||
    merged.levelMismatch != null ||
    merged.domainPivot ||
    merged.transferableSkillsClaimed ||
    merged.compensationHistoryIssue != null ||
    merged.serviceBondAccepted ||
    merged.probationCompMentioned ||
    merged.internshipConversion ||
    merged.collegeTier != null ||
    merged.earlySwitcher ||
    merged.lowCtcAlert ||
    merged.priorInternshipNonConversion ||
    merged.serviceCompanyBackground ||
    merged.compBreakupUnknown ||
    merged.recentLayoff ||
    merged.hotDomainPremium ||
    merged.pipDisclosed ||
    merged.verbalOnlyOffer ||
    merged.culturalJoiningConstraint ||
    merged.peopleManagementClaimed ||
    merged.mncExperience ||
    merged.crossBorderAnchor ||
    merged.unvestedEquityLossClaim ||
    merged.explodingOfferPressure ||
    merged.postAcceptanceRenege ||
    merged.quotaAttainmentClaimed ||
    merged.gardenLeaveDisclosed ||
    merged.nonCompeteFlagged ||
    merged.relocationBonusAsked ||
    merged.parentInsuranceAsked ||
    merged.inHandTakehomeFocus ||
    merged.rtoPushback ||
    merged.returnshipMaternity ||
    merged.payBandAsked ||
    merged.taxStructureAsked ||
    merged.bgvAnxiety ||
    merged.esopSophisticationProbe ||
    merged.spouseJobConstraint ||
    merged.agingParentCare ||
    merged.moonlightingDisclosed ||
    merged.mentalHealthDisclosed ||
    merged.payParityAsked ||
    merged.preemptiveCounterReceived ||
    merged.acceptanceTimeRequest ||
    merged.cryptoTokenComp ||
    merged.gccArbitrageAnchor ||
    merged.benchTimeDisclosed ||
    merged.founderSecondInnings ||
    merged.latecareerAgeBias ||
    merged.titlePrecisionAsk ||
    merged.currentCtcRefusal ||
    merged.pregnancyDisclosed ||
    merged.boomerangRehire ||
    merged.referralReceived ||
    merged.hometownReturnPreference ||
    merged.pwdDisability ||
    merged.gratuityVestingNear ||
    merged.acquisitionContextAsk ||
    merged.lgbtqDisclosure ||
    merged.chronicIllnessDisclosed ||
    merged.noticeBuyoutAsk ||
    merged.bfsiClawbackContext ||
    merged.bigFourGradeStep ||
    merged.securityClearanceNeeded ||
    merged.missionDrivenComp ||
    merged.edtechReputationCheck ||
    merged.acquiHireContext ||
    merged.cabinParkingAsk ||
    merged.spanOfControlAsk ||
    merged.preResignationStealth ||
    merged.reverseAnchorAsk ||
    merged.dietaryReligiousNeed ||
    merged.oldEmployerDocsIssue ||
    merged.equityRefreshCadenceAsk ||
    merged.equityVestingScheduleAsk ||
    merged.equityCliffPeriodAsk ||
    merged.equityExerciseTermsAsk ||
    merged.equityBuybackLiquidityAsk ||
    merged.signOnClawback ||
    merged.variableTrackRecord ||
    merged.wfhEquipmentStipend ||
    merged.salaryReviewCadenceAsk ||
    merged.multipleOffersJuggling ||
    merged.recruitmentAgencyMediation ||
    merged.internalTransferContext ||
    merged.offerRescindedHistory ||
    merged.internationalDegreePremium ||
    merged.domesticTopMbaAnchor ||
    merged.toxicManagerContext ||
    merged.visaSponsorshipNeed ||
    merged.casteReservationContext ||
    merged.veteranTransition ||
    merged.singleParentConstraint ||
    merged.jointFamilyFinancialResp ||
    merged.paternityLeaveAsk ||
    merged.menstrualLeavePolicy ||
    merged.esopExerciseLoanAsk ||
    merged.preIpoSecondaryAsk ||
    merged.accelerationTriggerAsk ||
    merged.esopPerquisiteTaxAsk ||
    merged.tenderOfferCycleAsk ||
    merged.probationaryDurationAsk ||
    merged.offerLetterTurnaroundDemand ||
    merged.contractToHireAsk ||
    merged.headcountApprovalCheck ||
    merged.ipAssignmentClauseAsk ||
    merged.healthcarePharmaContext ||
    merged.manufacturingCoreContext ||
    merged.quickCommerceContext ||
    merged.d2cConsumerEquity ||
    (merged.currentCtcDisclosed ?? false) ||
    (merged.fixedVariableSplitDisclosed ?? false) ||
    (merged.inHandSalaryDisclosed ?? false) ||
    (merged.noticePeriodDisclosed ?? false) ||
    (merged.competingOffersDisclosed ?? false) ||
    (merged.valueProofProvided ?? false) ||
    /* Wave-5 (ITEM 4, 2026-05-15) */
    merged.counterOfferRisk != null ||
    /* Wave-6 (2026-05-15) */
    merged.wantsHigherBase ||
    merged.wantsJoiningBonus ||
    merged.wantsRelocationAllowance ||
    merged.wantsFlexibleWork ||
    /* Wave-7 (2026-05-15) */
    merged.invokedCompetingOffer ||
    merged.askedAboutGrowthPath ||
    merged.gaveInconsistentNumbers ||
    merged.evasiveOnCurrentCtc ||
    /* Wave-8 (2026-05-16) */
    merged.mentionedSpouseFamily ||
    merged.mentionedForm16 ||
    merged.askedAboutReporting ||
    merged.askedAboutTeamSize ||
    merged.askedAboutGrowthPath8 ||
    merged.competingOfferAmount != null ||
    /* Wave-9 (2026-05-16) */
    merged.mentionedBgvConcern ||
    merged.mentionedMoonlighting ||
    merged.gaveRangeNotPoint ||
    merged.deflectedOnRange ||
    merged.referencedMarketData ||
    merged.mentionedTaxImplication;
  return merged;
}

