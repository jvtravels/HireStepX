/* Role → Interview Focus matrix.
   ─────────────────────────────────────────────────────────────────────
   Real interviews aren't a uniform menu — a junior frontend engineer
   doesn't get a Strategic round, a Customer Success rep doesn't get
   Technical Leadership, and a UPSC aspirant has zero overlap with a
   product-company hiring loop. Showing all 10 focuses to all roles
   creates two failure modes:
     (a) decision paralysis — users pick "Strategic" because it sounds
         senior, get questions that don't match their actual round
     (b) calibration miscalibration — the LLM generates questions for
         a context the candidate will never face

   This module classifies a free-text `targetRole` into a (family,
   seniority) pair via ordered regex matching, then returns the focuses
   that real interviews for that role cell would include.

   Family + seniority are also exposed for downstream consumers
   (question generation, calibration band, scoring rubrics) so the
   classifier is a shared truth, not a SessionSetup-only filter. */

export type InterviewFocus =
  | "Behavioral"
  | "Strategic"
  | "Technical Leadership"
  | "Case Study"
  | "Salary Negotiation"
  | "Panel Interview"
  | "Campus Placement"
  | "HR Round"
  | "Management"
  | "Government / PSU";

export type RoleFamily =
  | "swe"          // SDE / SWE / Backend / Frontend / Mobile / Full-stack
  | "em"           // Engineering Manager / Tech Lead / Architect / VP Eng
  | "pm"           // Product Manager / APM / Group PM / Head of Product
  | "designer"     // Product / UX / UI / Visual / Design Manager / Researcher
  | "data"         // Data Scientist / DA / DE / ML Engineer / Applied Scientist
  | "qa"           // QA / SDET / Test / Automation
  | "devops"       // DevOps / SRE / Platform / Infra / Cloud
  | "sales"        // AE / SDR / BDR / Sales / Account Mgr
  | "marketing"    // Brand / Growth / SEO / PMM / Performance
  | "finance"      // Finance / FP&A / Accounting / Banking / Equity Research
  | "ops"          // BizOps / Strategy / Chief of Staff / Program Mgr
  | "consulting"   // MBB / Big 4 / Strategy Consultant / Engagement Mgr
  | "cs"           // Customer Success / Support / Client Services
  | "hr"           // HR / Recruiter / TA / People Ops / HRBP
  | "legal"        // Lawyer / Counsel / Paralegal / Compliance / CS
  | "founder"      // Founder / Co-founder / CEO / COO / CXO
  | "psu"          // Government / PSU / Banking / Civil Services
  | "student"      // Campus / Fresher / Intern / Trainee
  | "other";

export type Seniority =
  | "fresher"  // Intern, fresher, 0-1 yr, trainee, campus
  | "junior"   // Associate, jr., L1-L2, SDE-1
  | "mid"      // Default — 2-5 yrs experience, no explicit seniority hint
  | "senior"   // Sr., Senior, L4-L5, SDE-3
  | "lead"     // Staff, Principal, Distinguished, Lead, Architect
  | "exec";    // Director, VP, Head of, CxO

/* ─── Family inference ────────────────────────────────────────────
   Order matters — more specific patterns first. "Software Engineer"
   matches `swe` only after we've ruled out "Engineering Manager"
   above it. The catch-all swe pattern lives last. */

const FAMILY_PATTERNS: Array<{ family: RoleFamily; re: RegExp }> = [
  // Founder / C-suite — must come first (CEO can also match other patterns)
  { family: "founder",   re: /\b(founder|co-?founder|ceo|coo|cto|cmo|cfo|cpo|cxo|chief\s+\w+\s+officer)\b/i },

  // Engineering management track — distinct from IC engineer
  { family: "em",        re: /\b(engineering\s+manager|engineering\s+lead|tech\s+lead|director\s+(of\s+)?engineering|vp\s+(of\s+)?engineering|head\s+of\s+engineering|architect|principal\s+engineer|distinguished\s+engineer)\b/i },

  // Product Manager — must precede generic "manager"
  { family: "pm",        re: /\b(product\s+manager|associate\s+product\s+manager|apm|group\s+(pm|product\s+manager)|gpm|head\s+of\s+product|director\s+of\s+product|vp\s+(of\s+)?product|chief\s+product\s+officer|product\s+lead|principal\s+pm)\b/i },

  // Design — picks up all design titles. Earlier version listed only
  // the product/UX/UI tribes and missed creative/motion subspecialties
  // entirely (Motion Designer, Graphic Designer, Animator, Illustrator,
  // 3D Designer, etc.) — those fell through to "other" and got the
  // unfiltered 10-focus list. The Bombay Design Centre session
  // surfaced this. Broadened to include the creative subspecialties
  // plus a generic /\b\w+\s+designer\b/ catch-all so anything ending in
  // "Designer" classifies as design — and any stray Designer title that
  // somehow shouldn't be caught here would still pick up via specific
  // earlier patterns (we don't have one for "Sound Designer" yet, etc.).
  { family: "designer",  re: /\b(product\s+designer|ux\s+designer|ui\s+designer|ux\/ui|visual\s+designer|interaction\s+designer|motion\s+(?:graphic\s+)?designer|graphic\s+designer|brand\s+designer|3d\s+designer|industrial\s+designer|game\s+designer|illustrator|animator|motion\s+graphics?(?:\s+(?:designer|artist|specialist))?|design\s+manager|head\s+of\s+design|director\s+of\s+design|ux\s+researcher|design\s+lead|design\s+director|design\s+ops|creative\s+(?:designer|director|lead)|\w+\s+designer)\b/i },

  // Data / ML
  { family: "data",      re: /\b(data\s+scientist|data\s+analyst|data\s+engineer|ml\s+engineer|machine\s+learning\s+engineer|ai\s+engineer|applied\s+scientist|research\s+scientist|analytics\s+(engineer|manager)|business\s+analyst|bi\s+analyst)\b/i },

  // QA / SDET
  { family: "qa",        re: /\b(qa\s+engineer|quality\s+assurance|sdet|test\s+engineer|automation\s+engineer|qa\s+lead|qa\s+manager)\b/i },

  // DevOps / SRE / Platform
  { family: "devops",    re: /\b(devops|sre|site\s+reliability|platform\s+engineer|cloud\s+engineer|infrastructure\s+engineer|systems\s+engineer|build\s+engineer|release\s+engineer)\b/i },

  // Consulting (MBB / Big 4) — distinct from BizOps. "Partner" alone
  // is too generic (HR Business Partner, Sales Partner, etc.) so we
  // only match it in firm-anchored contexts.
  { family: "consulting", re: /\b((associate\s+)?consultant|consulting|engagement\s+manager)\b|\b(strategy\s+consultant|management\s+consultant)\b|\b(partner|principal)\s+(at|in|@)?\s*(mckinsey|bcg|bain|deloitte|kpmg|pwc|ey|accenture|strategy&)\b/i },

  // Government / PSU
  { family: "psu",       re: /\b(ias|ips|ifs|upsc|ssc|psu|public\s+sector|civil\s+services|bank\s+po|sbi\s+po|ibps|government|govt|ministry|railway|defence|defense|drdo|isro|bhel|ongc|ntpc|gail|hal|coal\s+india|nabard|rbi)\b/i },

  // Fresher / Student / Campus
  { family: "student",   re: /\b(student|fresher|intern\b|campus|undergrad|graduate\s+trainee|management\s+trainee|gtt|gmt|trainee\s+(engineer|associate)|fresh\s+grad)\b/i },

  // Sales
  { family: "sales",     re: /\b(account\s+executive|account\s+manager|business\s+development|bd\s+(rep|manager)|sales\s+(rep|manager|lead|director|exec)|sdr|bdr|key\s+account|enterprise\s+sales|inside\s+sales)\b/i },

  // Marketing
  { family: "marketing", re: /\b(marketing|brand\s+(manager|lead)|growth\s+(manager|lead|hacker)|seo|sem\b|content\s+(manager|strategist)|social\s+media|digital\s+marketing|performance\s+marketing|product\s+marketing|pmm)\b/i },

  // Finance / Banking — match before IB explicitly
  { family: "finance",   re: /\b(finance|financial|fp\s*&\s*a|accountant|accounting|controller|treasurer|equity\s+research|investment\s+bank(?:er|ing)|ib\s+analyst|m&a|asset\s+management|portfolio\s+manager|cpa\b|chartered\s+accountant|ca\b)\b/i },

  // BizOps / Strategy / Program Management
  { family: "ops",       re: /\b(business\s+operations|biz\s*ops|business\s+ops|strategy\s+(manager|lead|associate)|chief\s+of\s+staff|program\s+manager|tpm|technical\s+program\s+manager|project\s+manager|operations\s+manager)\b/i },

  // Customer Success / Support
  { family: "cs",        re: /\b(customer\s+success|customer\s+support|client\s+services|technical\s+support|account\s+management(?!\s+associate)|implementation\s+specialist|onboarding\s+specialist)\b/i },

  // HR / People
  { family: "hr",        re: /\b(human\s+resource|hrbp|recruiter|talent\s+acquisition|people\s+ops|people\s+operations|head\s+of\s+people|chief\s+people\s+officer|hr\s+(manager|lead|generalist|director|business\s+partner))\b/i },

  // Legal / Compliance
  { family: "legal",     re: /\b(legal\s+counsel|corporate\s+lawyer|attorney|paralegal|compliance\s+(officer|manager)|company\s+secretary|cs\s+(?:cum|&)\s+legal|chief\s+legal\s+officer)\b/i },

  // SWE — catch-all for engineers, must come last
  { family: "swe",       re: /\b(software\s+engineer|swe|sde-?\d?|developer|backend|frontend|front-?end|back-?end|full\s*-?stack|mobile\s+engineer|ios\s+engineer|android\s+engineer|web\s+developer|programmer|coder)\b/i },
];

export function inferRoleFamily(role: string): RoleFamily {
  const text = (role || "").trim();
  if (!text) return "other";
  for (const { family, re } of FAMILY_PATTERNS) {
    if (re.test(text)) return family;
  }
  return "other";
}

/* ─── Seniority inference ─────────────────────────────────────────
   Order: most specific first. "Senior Software Engineer" matches
   `senior` not `mid`. Default is `mid` for any role that doesn't
   carry an explicit level signal. */

const SENIORITY_PATTERNS: Array<{ level: Seniority; re: RegExp }> = [
  { level: "exec",    re: /\b(vp\b|vice\s+president|director|head\s+of|chief\s+\w+\s+officer|cxo|c-?level|c-?suite|partner)\b/i },
  { level: "lead",    re: /\b(staff|principal|distinguished|fellow|architect|tech\s+lead|engineering\s+lead|product\s+lead|design\s+lead|sde-?[34]|l[5-7])\b/i },
  { level: "senior",  re: /\b(senior|sr\.?|sde-?2|l4)\b/i },
  { level: "junior",  re: /\b(junior|jr\.?|associate(?!\s+consultant)|sde-?1|l[12])\b/i },
  { level: "fresher", re: /\b(fresher|intern|trainee|graduate\s+trainee|0-?1\s*(yr|year)|entry-?level|entry\s+level|fresh\s+grad)\b/i },
];

export function inferSeniority(role: string): Seniority {
  const text = (role || "").trim();
  if (!text) return "mid";
  for (const { level, re } of SENIORITY_PATTERNS) {
    if (re.test(text)) return level;
  }
  return "mid";
}

const SENIORITY_RANK: Record<Seniority, number> = {
  fresher: 0, junior: 1, mid: 2, senior: 3, lead: 4, exec: 5,
};

const isAtLeast = (s: Seniority, min: Seniority) =>
  SENIORITY_RANK[s] >= SENIORITY_RANK[min];

/* ─── The matrix ──────────────────────────────────────────────────
   Returns the focuses that actual interview loops for the given
   (family, seniority) cell would include. Sourced from:
     • FAANG India interview reports (Levels.fyi, Glassdoor)
     • Indian unicorn formats (Razorpay/CRED/Zerodha/Flipkart/Swiggy)
     • MBB / Big 4 consulting case interview structure
     • IT services campus + lateral patterns (TCS/Infosys/Wipro)
     • UPSC / SSC / banking exam pattern (PSU)

   Design rules:
     • "Behavioral" is universal — every role has at least one of
       these. Even PSU prep includes personality/situational rounds.
     • "HR Round" is universal except founders.
     • "Salary Negotiation" requires non-fresher and a market-rate
       hiring context (excluded for student / PSU pipelines where
       the comp is fixed by exam-rank or campus offer letter).
     • "Strategic" gates on senior+ in strategy-driven families.
     • "Technical Leadership" gates on tech-IC mid+ or tech-mgmt.
     • "Case Study" is for business/strategy/commercial roles.
     • "Panel Interview" gates on mid+ — juniors are typically
       evaluated 1-on-1 even at FAANG.
     • "Campus Placement" is for freshers/students only.
     • "Management" is for management-track families or senior+ ICs
       that have a manager alternative.
     • "Government / PSU" is opt-in — only when role text matches
       PSU patterns. PSU candidates don't get private-sector focuses
       because the formats don't overlap.                                                  */

export function getRelevantFocuses(
  family: RoleFamily,
  seniority: Seniority,
): InterviewFocus[] {
  const out: InterviewFocus[] = [];

  // PSU is its own world — return early so we don't mix formats.
  if (family === "psu") {
    out.push("Behavioral");        // SSB/personality rounds
    out.push("HR Round");          // banking/PSU interview round
    out.push("Government / PSU");  // primary focus
    return out;
  }

  // Universal foundations
  out.push("Behavioral");
  if (family !== "founder") out.push("HR Round");

  // Salary Negotiation: anyone employed, exclude freshers + students.
  // (Students/freshers usually get fixed campus packages with no
  // negotiation; we surface this once they're in a real-market role.)
  if (seniority !== "fresher" && family !== "student") {
    out.push("Salary Negotiation");
  }

  // Campus Placement: freshers + students only.
  if (seniority === "fresher" || family === "student") {
    out.push("Campus Placement");
  }

  // Strategic: senior+ in strategy-driven families OR founder/consulting at any level.
  const strategicFamilies: RoleFamily[] = [
    "em", "pm", "ops", "designer", "data", "marketing",
    "sales", "finance", "legal",
  ];
  if (family === "founder" || family === "consulting") {
    out.push("Strategic");
  } else if (isAtLeast(seniority, "senior") && strategicFamilies.includes(family)) {
    out.push("Strategic");
  }

  // Technical Leadership: tech ICs mid+ and tech managers.
  // QA needs senior+ to access this (junior QA is task-oriented).
  if (["swe", "em", "data", "devops"].includes(family) && isAtLeast(seniority, "mid")) {
    out.push("Technical Leadership");
  } else if (family === "qa" && isAtLeast(seniority, "senior")) {
    out.push("Technical Leadership");
  }

  // Case Study: business / strategy / commercial roles. Gate juniors out
  // for sales/marketing/finance/ops because case interviews start at
  // mid-level for those families. PMs and consultants get them at any level.
  const caseAlwaysFamilies: RoleFamily[] = ["pm", "consulting", "founder"];
  const caseMidPlusFamilies: RoleFamily[] = ["ops", "marketing", "sales", "finance"];
  if (caseAlwaysFamilies.includes(family)) {
    out.push("Case Study");
  } else if (caseMidPlusFamilies.includes(family) && isAtLeast(seniority, "mid")) {
    out.push("Case Study");
  }

  // Panel Interview: mid+ in any family, plus EM and founder at any level.
  // Juniors mostly get sequential 1-on-1 rounds, not panels.
  if (
    isAtLeast(seniority, "mid") ||
    family === "em" ||
    family === "founder"
  ) {
    out.push("Panel Interview");
  }

  // Management: dedicated management families OR senior+ ICs that have a
  // managerial path (PM/designer/marketing/sales). SWE excluded — the
  // SWE → EM jump is a track change, not a management round.
  if (family === "em" || family === "founder") {
    out.push("Management");
  } else if (
    isAtLeast(seniority, "senior") &&
    ["pm", "designer", "marketing", "sales", "ops", "hr"].includes(family)
  ) {
    out.push("Management");
  }

  return out;
}

/* ─── Convenience: derive everything from a free-text role ─── */

export interface RoleProfile {
  role: string;
  family: RoleFamily;
  seniority: Seniority;
  focuses: InterviewFocus[];
}

export function profileFromRole(role: string): RoleProfile {
  const family = inferRoleFamily(role);
  const seniority = inferSeniority(role);
  return {
    role,
    family,
    seniority,
    focuses: getRelevantFocuses(family, seniority),
  };
}
