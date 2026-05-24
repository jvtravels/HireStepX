/* Campus-placement interview analyzer.
 *
 * Tailored to Indian campus / fresher hiring patterns. Catches:
 *   - Generic "passion for technology" answers without specifics
 *   - No academic project or capstone discussed
 *   - AI didn't ask about CGPA / coursework / availability
 *   - User badmouthed the college / professors
 *   - Project descriptions with no concrete tech stack named
 *   - Implausible team-size claims ("I led 20 people in a college project")
 *   - "Why this company" asked but answered with no company-specific signal
 *   - Volunteered backlogs / KTs / low CGPA unprompted (poor framing)
 *   - Excessive filler words ("basically", "as such", "like")
 *   - Internship claimed in resume but never elaborated
 *
 * ── Version history ────────────────────────────────────────────────
 *   v2   deterministic baseline (initial waves 1–3).
 *   v5   Phase 1 quick wins — tier-adjusted CGPA surfaced
 *        (`meta.campusPlacement`), `PASSION_SUBSTANTIATED` / `SUBSTANTIATION_TOKEN`
 *        pair, static-fallback banner.
 *   v6   Phase 2 depth validators — `TECH_APPLIED`, `PORTFOLIO_LINK`,
 *        `PROJECT_RECENT_MARKER` / `PROJECT_DISTANT_MARKER`. New flags
 *        `tech_named_but_not_applied`, `portfolio_link_present`,
 *        `projects_dated_not_recent`.
 *   v6.2 Phase 3 archetypes — `_campus-archetype.ts` resolves
 *        tcs-ninja / tcs-digital / wipro-nlth / top-tier-campus / unknown.
 *        Archetype overrides the coarse-tier CGPA cutoff; surfaces as
 *        `campus_archetype_*` flag + `meta.campusPlacement.archetypeLabel`.
 *   v6.3 Phase 4 hygiene — fixture suite (`campusPlacementFixtures.test.ts`),
 *        register-rule inheritance in `generate-questions.ts`, prompt-cache
 *        order verified.
 *   v6.4 Phase 5 stretch — `backlog_honest_disclosure` (positive pair to
 *        `active_backlog_evasion`) + `aptitude_project_inconsistency`
 *        cross-signal. Bond awareness covered by Wave-3 patterns.
 *   v6.5 Phase 6 realism calibration — (a) MTI whitelist now allows
 *        "passed out 2024" (standard Indian English; recruiters don't
 *        deduct); (b) new `COMPANY_SERVICE_TIER_NARRATIVE` regex +
 *        `service_tier_why_company_acceptable` positive flag — TCS NQT /
 *        Wipro NLTH candidates saying "structured training / proven
 *        client base / long-term stability" no longer fire
 *        `no_company_specific_research` (they were product-co graded
 *        wrongly); (c) `weak_reverse_questions` suppressed for
 *        tcs-ninja / wipro-nlth archetypes (acceptable filler at
 *        service-tier); (d) `archetypeCgpaCutoff("wipro-nlth")` moved
 *        6.5 → 6.0 to match the 2025 firm-wide floor; (e) the
 *        aptitude-probe prompt in generate-questions now routes
 *        cognitive-coding (SQL / strings) to TCS / Infosys and
 *        classical puzzles to Wipro / Cognizant.
 *   v6.6 Post-v6.5 realism audit — six gaps closed:
 *        (a) `college_cgpa_policy_acknowledged` positive flag — when a
 *        candidate cites the TPO / college internal CGPA cutoff
 *        alongside a stated CGPA, the bare number isn't framing-naked.
 *        Suppresses `cgpa_low_no_framing` (treated as framing context).
 *        (b) Bond multi-probe gate — `bond_unprepared` now requires the
 *        AI to have probed bond ≥2 times before firing. Eliminates the
 *        false-positive on freshers who simply weren't asked twice.
 *        `bondProbeCount` surfaced on meta. (c) Reverse-question
 *        mid-session tracking — if the candidate asked ≥1 SPECIFIC
 *        question BEFORE the closing slot, suppress `weak_reverse_questions`
 *        even at tcs-digital / top-tier-campus (and emit
 *        `mid_session_questions_present` as a positive signal).
 *        (d) Aptitude probe expected-type surfaced on meta
 *        (`aptitudeProbeExpectedType`) so the LLM evaluator can grade
 *        whether the generated probe matched the archetype.
 *        (e) `internship_company_unrecognized` — transcript-only signal
 *        when claimed-internship company doesn't match any of the
 *        top ~70 Indian tech employers AND no resume is loaded to
 *        verify. Low severity, informational.
 *        (f) MTI "graduated in 2024" was already a no-op (no pattern
 *        in v6.5 list matches it); documented in the realism note.
 *   v6.7 Post-v6.6 realism audit — six gaps closed:
 *        (a) `cognizant-genc` archetype split out from `wipro-nlth`
 *        (Cognizant + Capgemini Exceller). Cognizant's "client rotation
 *        / domain breadth" narrative now gets credit on the why-company
 *        probe via the new `COGNIZANT_CLIENT_ROTATION_NARRATIVE` regex,
 *        which feeds the existing `service_tier_why_company_acceptable`
 *        positive flag. (b) Short-screening gate — when
 *        `transcript.length < 10`, suppress `bond_unprepared` and
 *        `reverse_questions_declined`; an HR-screening call doesn't
 *        always hit the closing slot or probe bond twice. Emits the
 *        positive flag `short_screening_session_acknowledged`.
 *        (c) `shipped_to_prod_context` positive flag — when a candidate
 *        narrates a project with concrete shipped-to-prod evidence
 *        (active users / production deploy / merged PR / shipped feature),
 *        emit the positive flag and suppress `portfolio_absent_for_claim`
 *        at product-grade archetypes (top-tier-campus / tcs-digital).
 *        (d) `location_agnostic_signal` — at tcs-digital, a candidate
 *        who explicitly states they're open to any location / pan-India
 *        gets credit instead of being silently dinged for not probing
 *        relocation. (e) `aptitude_puzzle_refusal` severity downgraded
 *        to "low" for tcs-digital — that loop is offline-coding-format,
 *        not live-puzzle. (f) `weak_reverse_questions` at unknown
 *        archetype now adopts service-tier leniency (generic reverse
 *        questions are acceptable when we can't pin down archetype).
 *   v6.8 Post-v6.7 audit — severity coherence pass:
 *        (a) `aptitude_puzzle_refusal` severity calibrated by archetype
 *        loop format: tcs-digital "low" (offline-coding format),
 *        tcs-ninja / unknown "medium" (NQT live round doesn't dwell on
 *        puzzles; unknown can't be pinned to either side), wipro-nlth /
 *        cognizant-genc / top-tier-campus stay "high" where classical
 *        puzzles and DSA-on-the-spot ARE the loop. Removes the
 *        unknown-archetype incoherence where v6.7 granted service-tier
 *        leniency on reverse questions but still slammed "high" on
 *        aptitude refusal. (b) Two new ground-truth fixtures exercise
 *        the v6.7 positive flags `shipped_to_prod_context` +
 *        `location_agnostic_signal` end-to-end so the regression net
 *        catches future drift on the suppression chains they feed.
 *   v6.9 Maintainability pass — zero-behavior-change refactor: the
 *        57-entry flag → coaching-tip if-chain at the bottom of the
 *        analyzer extracted to `_campus-tips.ts` as a single
 *        `CAMPUS_FLAG_TIPS: Record<string, string>` dictionary. The
 *        analyzer's final step iterates the live flag set and joins
 *        matching tips. Drops ~55 lines from this file (now under the
 *        1500-LOC ESLint warn line) and makes a missing tip for a
 *        newly-added flag trivially discoverable in one place.
 * ──────────────────────────────────────────────────────────────────
 */

import { AnalyzerInput, AnalyzerResult, FocusAnalyzer, RubricGap, TranscriptTurn, emptyResult } from "./_types";
import { classifyCompanyTier } from "../_company-tier";
import { classifyCollegeTier, cgpaCutoffAdjustment } from "../_college-tier";
import { classifyCampusArchetype, archetypeCgpaCutoff, archetypeLabel } from "../_campus-archetype";
import { parsePeriodMonths, NUM_WORDS, SPOKEN_DURATION_REGEX } from "../_resume-period";
import { CAMPUS_FLAG_TIPS } from "./_campus-tips";

const isAi = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("a");
const isUser = (t: TranscriptTurn) => t.speaker.toLowerCase().startsWith("u");

const ACADEMIC_PROJECT = /\b(capstone|final[- ]?year project|btech project|major project|college project|coursework|cgpa|gpa|sgpa|kt\b|backlog)\b/i;
const FRESHER_LEXICON = /\b(fresher|just graduated|final year|recent graduate|college senior|placement|on[- ]campus|btech|b\.?tech|bca|mca|m\.?tech)\b/i;
const GENERIC_PASSION = /\b(passionate about (?:tech|coding|technology|engineering|programming)|always loved|since childhood|always wanted to|love (?:to )?learn)\b/i;
const SPECIFIC_PROJECT = /\b(built|implemented|deployed|led|coded|designed|trained|integrated|published)\s+\w+/i;
/* Substantiation tokens — any one of these next to a "passionate"
 * claim turns the claim from cliché into a defendable answer. We
 * gate `generic_passion_no_substance` on the ABSENCE of all of them:
 *   - github URL or repo handle (artifact)
 *   - hackathon / coding contest mention (named event)
 *   - internship mention (real-world signal)
 *   - named MOOC / course (NPTEL, Coursera, Udemy, edX, CS50, Striver)
 *   - a quantified outcome ("won", "ranked", "200+ problems", percentile)
 * Mirrors the GENERIC_WHY / SPECIFIC_WHY paired pattern from hr-round.ts.
 */
const SUBSTANTIATION_TOKEN = /\b(github\.com\/[\w-]+|github\.io|gitlab\.com\/[\w-]+|leetcode\.com\/[\w-]+|codeforces\.com\/profile|kaggle\.com\/[\w-]+|hackerrank\.com\/[\w-]+|hackathon|sih\b|smart india hackathon|coding contest|code[- ]?jam|hash[- ]?code|kickstart|internship|intern at|interned at|nptel|coursera|udemy|edx\b|cs50|striver(?:'s)?\s+sdc?\s*sheet|striver sde|neetcode|grokking|knight (?:badge|rated)|guardian rated|expert rated|specialist rated|top\s+\d+%?|\d{2,}\s*\+?\s*(?:problems|leetcode|questions|submissions))\b/i;
const AVAILABILITY = /\b(available (?:from|after)|join (?:by|in|on|after)|notice|graduation|exam|semester|joining date|relocat)\b/i;
const COLLEGE_BADMOUTH = /\b(my college (?:was|is) (?:bad|terrible|awful)|(?:professors|faculty) (?:are|were) (?:useless|incompetent|terrible)|nothing was taught|wasted (?:my )?time)\b/i;

/* Concrete tech stack — at least one of these must appear when the user
 * narrates a project, otherwise the answer reads as hand-wave. */
const TECH_STACK = /\b(python|java\b|javascript|typescript|c\+\+|kotlin|swift|go(?:lang)?|rust|node(?:\.?js)?|react|next(?:\.?js)?|angular|vue|django|flask|spring|express|fastapi|tensorflow|pytorch|numpy|pandas|scikit|opencv|sql|mysql|postgres|mongodb|redis|firebase|aws|gcp|azure|docker|kubernetes|git|linux|raspberry pi|arduino|html|css|tailwind|bootstrap|figma|excel|tableau|powerbi|r studio|matlab|verilog|vhdl|simulink|autocad|solidworks|catia|ansys|matlab simulink|plc|scada)\b/i;
/* Global tech-name capture — used to count DISTINCT tech mentions so we
 * can tell "mentioned" (≥2 names but no application context) apart from
 * "applied" (named + paired with an artifact). Mirrors TECH_STACK with
 * a /g flag and no /i fragments specific to single-token forms. */
const TECH_STACK_G = /\b(python|java|javascript|typescript|c\+\+|kotlin|swift|go(?:lang)?|rust|node(?:\.?js)?|react|next(?:\.?js)?|angular|vue|django|flask|spring|express|fastapi|tensorflow|pytorch|numpy|pandas|scikit|opencv|sql|mysql|postgres|mongodb|redis|firebase|aws|gcp|azure|docker|kubernetes|raspberry pi|arduino|tailwind|bootstrap|figma|tableau|powerbi|matlab|verilog|vhdl|simulink|autocad|solidworks|catia|ansys|plc|scada)\b/gi;
const PROJECT_NARRATION = /\b(my project|our project|the project|i (?:built|made|developed|coded|designed|trained|implemented)|we (?:built|made|developed|coded|designed|trained|implemented))\b/i;

/* Phase-2 tech-DEPTH evidence: a tech name fused with an applied artifact.
 *
 *   - A REST/GraphQL endpoint count    ("3 endpoints", "REST API with 5 routes")
 *   - A deployed URL                  ("deployed on vercel/netlify/render")
 *   - A code-volume marker            ("400 LOC", "~2k lines")
 *   - A concrete pairing verb         ("used Flask to serve", "trained a CNN in PyTorch")
 *   - A schema/DB shape signal        ("Postgres with 3 tables", "Mongo collections for")
 *
 * Presence of ANY of these alongside a tech name turns a hand-wave name-drop
 * into evidence the candidate actually shipped with it. The flag we add
 * below (tech_named_but_not_applied) is the SYMMETRIC counterpart to
 * project_no_tech_stack: that flag catches projects with no tech named,
 * this one catches tech named with no project depth around it. */
const TECH_APPLIED = /\b(?:(?:\d+\s+)?(?:rest|graphql|grpc)?\s*(?:api\s+)?endpoints?|api\s+with\s+\d+\s+(?:routes?|endpoints?)|deployed\s+(?:on|to|at)\s+(?:vercel|netlify|render|heroku|aws|gcp|azure|fly\.io|railway|huggingface|streamlit|firebase\s+hosting)|live\s+(?:demo|url|site)\s+(?:at|on)|hosted\s+(?:at|on)|\d{2,}\s*(?:loc|lines\s+of\s+code|lines\b)|~?\s*\d+\s*k\s+lines|used\s+(?:python|java|react|next|flask|django|fastapi|node|express|spring|tensorflow|pytorch|postgres|mongo|redis|aws|docker|kubernetes)\s+(?:to|for|and)\s+\w+|trained\s+(?:a|the|my)\s+(?:cnn|rnn|lstm|transformer|model|classifier|regressor|gan|bert|gpt)\s+(?:in|with|on)\s+(?:python|tensorflow|pytorch|keras|scikit)|(?:postgres|mysql|mongo(?:db)?|sqlite)\s+(?:with|database\s+with)\s+\d+\s+(?:tables?|collections?|documents?)|wrote\s+(?:the\s+)?(?:backend|frontend|api|service|pipeline)\s+in\s+\w+|schema\s+with\s+\d+\s+(?:tables?|collections?))\b/i;

/* Phase-2 recency markers — the campus-interview rubric weights a final-year
 * project well above a 2nd-semester one. Without a recency anchor we have
 * to assume the most distant signal applies. We surface a flag when the
 * candidate cites only DISTANT markers (1st year / 2nd sem) for project
 * narration. The presence of any RECENT marker suppresses. */
const PROJECT_RECENT_MARKER = /\b(?:final[- ]?year(?:\s+project)?|fy(?:p|np)?\b|capstone|currently\s+(?:building|working\s+on|developing)|this\s+(?:semester|month|year|week)|last\s+(?:semester|month)|ongoing|in\s+progress|recently\s+(?:built|finished|completed|shipped|deployed)|8th\s+sem(?:ester)?|7th\s+sem(?:ester)?|final\s+sem(?:ester)?|pre[- ]?final|3rd\s+year|fourth\s+year|senior\s+year|major\s+project)\b/i;
const PROJECT_DISTANT_MARKER = /\b(?:1st\s+year|first\s+year|2nd\s+year|second\s+year|1st\s+sem(?:ester)?|2nd\s+sem(?:ester)?|3rd\s+sem(?:ester)?|4th\s+sem(?:ester)?|first\s+sem(?:ester)?|second\s+sem(?:ester)?|freshman\s+year|sophomore\s+year|two\s+years\s+(?:ago|back)|three\s+years\s+(?:ago|back)|long\s+(?:time\s+)?ago)\b/i;

/* Implausible team-size brag for a fresher / college context. */
const IMPLAUSIBLE_TEAM = /\b(?:led|managed|headed|directed)\s+(?:a\s+)?team\s+of\s+(\d{2,})/i;

/* "Why this company / what attracted you" probe by AI. Tightened — the
 * earlier version's `\w{2,}` fallback matched any "why X?" question. */
const WHY_COMPANY_PROBE = /\b(?:why\b[^?.!]{0,80}?\b(?:join us|work (?:here|with us|for us)|us specifically|this (?:company|firm|role|org)|our (?:company|firm|org))|what\s+(?:attracted|brought|drew|excites|excited)\s+you\s+(?:to|about|here|towards))\b/i;
/* Company-specific signal in user answer: tight tokens that indicate
 * the candidate did real research, not generic filler. Avoid generic
 * words like "team" / "product" / "values" — those false-positive on
 * unrelated answers. */
const COMPANY_GENERIC_FILLER = /\b(great culture|good culture|brand value|brand name|great brand|big company|good company|great company|reputation|growth opportunit|learning opportunit|big mnc)\b/i;
const COMPANY_SPECIFIC_SIGNAL = /\b(trailhead|nqt|infytq|techbee|genc|engage|step program|leadership principles?|customer obsession|day\s*1|crucible|future leaders|gennxt|peak|spirit of wipro|infosys lex|tata code of conduct|your (?:founder|ceo|cofounder|recent|latest|q[1-4]|fy\d|launch|ipo|acquisition|investment|hiring plan|product line|ai strategy|tech stack)|i (?:read|saw|noticed|came across|listened to))\b/i;
/* Service-tier acceptable narrative — TCS / Infosys / Wipro / Cognizant
 * recruiters EXPECT freshers to anchor on stability, structured training,
 * proven scale, long-term growth. Saying "great training program +
 * proven client base + long-term career" at a TCS NQT loop is NOT
 * generic — it's exactly the answer the panelist is grading for.
 * This regex captures that narrative so we don't fire
 * `no_company_specific_research` against service-tier archetypes when
 * the candidate gave a context-appropriate answer. Product-co loops
 * (Google / Flipkart / Razorpay) still demand specific signal — the
 * archetype gate handles that asymmetry below. */
const COMPANY_SERVICE_TIER_NARRATIVE = /\b(?:structured\s+training|training\s+program|stable\s+(?:career|growth|environment|long[- ]term)|long[- ]term\s+(?:career|growth|stability)|proven\s+(?:client|track\s+record|delivery)|client\s+(?:base|portfolio|delivery)|service[- ]led|services?\s+(?:model|business|firm)|global\s+(?:delivery|footprint|presence)|scale\s+of\s+(?:operations?|delivery)|established\s+(?:firm|company|leader|player)|brand\s+maturity|industry\s+leader|fortune\s+\d+|domain\s+exposure|industry\s+exposure|breadth\s+of\s+(?:projects?|domains?)|onboarding\s+(?:program|process|cohort)|fresher\s+(?:training|cohort|program)|ilp\b|initial\s+learning\s+program)\b/i;

/* v6.7 — Cognizant GenC / Capgemini Exceller specifically reward a
 * "client rotation / domain breadth" narrative. Candidates who say
 * "exposure to multiple client domains / horizontal mobility / cross-
 * industry rotation / GenC Pro track" are giving the rubric-matched
 * answer for that archetype. Feeds the existing
 * `service_tier_why_company_acceptable` positive flag when archetype
 * resolves to `cognizant-genc`. */
const COGNIZANT_CLIENT_ROTATION_NARRATIVE = /\b(?:client\s+rotation|cross[- ]?(?:industry|domain|client)\s+(?:rotation|exposure|mobility|projects?)|multiple\s+(?:client|domain)\s+(?:exposure|projects?)|domain\s+breadth|breadth\s+(?:of\s+)?(?:industries?|domains?|clients?)|genc\s+(?:pro|next)|exceller\s+track|horizontal\s+mobility|rotational\s+(?:program|projects?))\b/i;

/* v6.7 — Location-agnostic signal for tcs-digital. The Digital track
 * loop does NOT probe relocation explicitly (unlike Ninja); a candidate
 * who proactively states pan-India / any-location openness deserves
 * credit, not silence. Used to suppress `weak_reverse_questions` at
 * tcs-digital when present + emit `location_agnostic_signal`. */
const LOCATION_AGNOSTIC_SIGNAL = /\b(?:open\s+to\s+(?:any\s+location|relocat|pan[- ]?india|all\s+locations?)|location[- ]?agnostic|happy\s+to\s+(?:move|relocate)\s+(?:anywhere|to\s+any)|willing\s+to\s+relocate\s+(?:to\s+)?(?:anywhere|any\s+location|any\s+city|pan[- ]?india)|no\s+location\s+(?:preference|constraint)|flexible\s+(?:on|with|about)\s+location|comfortable\s+(?:with\s+)?(?:any\s+location|pan[- ]?india|relocat))\b/i;

/* v6.7 — Shipped-to-prod evidence. Distinct from the generic
 * PORTFOLIO_LINK / TECH_APPLIED — this specifically captures the
 * "we shipped it and users used it" signal: production deploys,
 * active users, merged PRs to a real codebase, features in
 * customer-facing release notes. At product-grade archetypes
 * (top-tier-campus / tcs-digital) this is a higher-credibility
 * substitute for a GitHub link and suppresses
 * `portfolio_absent_for_claim`. */
const SHIPPED_TO_PROD_CONTEXT = /\b(?:(?:shipped|deployed|launched|released)\s+(?:to\s+)?(?:prod(?:uction)?|customers?|users?|live|the\s+app|the\s+platform)|(?:in|to)\s+production|live\s+(?:in\s+production|with\s+(?:real\s+)?users?|on\s+the\s+app)|active\s+users?|monthly\s+active|daily\s+active|dau|mau|merged\s+(?:my\s+|the\s+)?pr\s+(?:to|into)|pr\s+(?:got\s+)?merged|customer[- ]?facing|user[- ]?facing\s+feature|first\s+\d+\s+(?:users|customers)|onboarded\s+\d+|served\s+\d+\s+(?:users|requests|customers))\b/i;

/* Volunteered backlogs / KTs / low CGPA unprompted is a framing error.
 * DEFICIT_PROBE intentionally excludes /fail/ — behavioral failure
 * chestnuts like "tell me about a failure" must NOT count as the AI
 * probing academic deficits. */
const VOLUNTEERED_DEFICIT = /\b(?:i (?:have|had|got)|i'?ve got|unfortunately)\s+(?:\d+\s+)?(?:backlog|kts?|low\s+cgpa|bad\s+cgpa|poor\s+grade)/i;
const DEFICIT_PROBE = /\b(?:backlog|\bkts?\b|cgpa|gpa|grade|repeat (?:a |the )?(?:year|semester|course))\b/i;

/* Excessive filler — count occurrences across user turns. */
const FILLER = /\b(basically|as such|like,? you know|um|uh|sort of|kind of|i mean)\b/gi;
const FILLER_PER_100_WORDS_THRESHOLD = 4;

/* Internship probe + content. */
const INTERNSHIP_CLAIM = /\b(internship|interned|intern at|summer intern|summer training|industrial training|6[- ]month\s+intern)\b/i;
const INTERNSHIP_DETAIL = /\b(intern(ship)?\s+at\s+\w|stipend|deliverable|reported to|mentor|onboarded|shipped|merged|in production)\b/i;

/* Mother-Tongue-Influence (MTI) — high-frequency Indian-English deviations
 * that recruiters at TIER-1 firms (Google / MS / Goldman / McKinsey India)
 * actively flag. Each entry is a distinct phrase shape; we count distinct
 * hits across all patterns and trigger at ≥1.
 *
 * REALISM CALIBRATION NOTE — items deliberately NOT in this list because
 * Indian recruiters across TCS / Infosys / Wipro / product-cos all accept
 * them as standard Indian English in 2025-26:
 *   - "passed out 2024"  — universal Indian usage for "graduated 2024".
 *     TCS / Infosys / Wipro hear it every screen; product cos don't dock
 *     for it either. Penalizing it is accent-policing, not actual rubric.
 *   - "give an exam"     — standard for "take an exam".
 *   - "do the needful"   — borderline; kept (only in formal email context
 *     is it grating); see `do_the_needful` entry below.
 *
 * Items that DO stay flagged because they consistently land as a deduction
 * in recruiter feedback forms: bare "myself X" intro, "revert back",
 * "kindly", "doubt" (for question), "prepone", "cope up with".
 */
const MTI_PATTERNS: RegExp[] = [
  /\bdo(?:ing)?\s+the\s+needful\b/i,
  /\brevert\s+back\b/i,                     // "revert" already means reply
  /\bmyself\s+[A-Z][a-z]+\b/,               // "Myself Rahul"
  /\bgood\s+name\b/i,                       // "May I know your good name?"
  /\bkindly\s+(?:do|find|note|revert|provide|share)\b/i,
  /\bcope\s+up\s+with\b/i,                  // standard is "cope with"
  /\bdiscuss\s+about\b/i,                   // standard is "discuss"
  /\bhaving\s+(?:a\s+)?doubt\b/i,           // "doubt" = question in IndE
  /\bprepone\b/i,                           // not standard English
  /\breach\s+(?:by|at|till)\s+\d/i,         // "reach by 5" vs "arrive by 5"
];

/* Stated CGPA values — captures the numeric value so we can grade framing. */
const CGPA_STATED = /\b(?:cgpa|gpa|sgpa)\s*(?:is|was|of|:)?\s*(\d(?:\.\d{1,2})?)/i;
/* College / TPO internal CGPA gatekeeping. Many tier-2/3 colleges enforce
 * 6.5–7.0 internal bars even though TCS firm cutoff is 6.0. A candidate
 * stating their CGPA alongside "my college won't send me below 6.5" or
 * "TPO cutoff is 7.0" is providing valid context, NOT being evasive —
 * it surfaces a real structural constraint the recruiter respects.
 * v6.6 — treats this as framing for `cgpa_low_no_framing` AND emits the
 * positive flag `college_cgpa_policy_acknowledged`. */
const COLLEGE_CGPA_POLICY = /\b(?:my\s+college|the\s+college|college'?s?|tpo|placement\s+cell|t\.?p\.?o\.?)\s+(?:(?:internal\s+)?(?:cutoff|policy|bar|requirement|gatekeep(?:ing)?|threshold|minimum)|won'?t\s+(?:send|allow|forward|shortlist)|requires?|enforces?|mandate[sd]?|insists?)\b[^.?!]{0,60}?\b\d(?:\.\d{1,2})?\b/i;

/* Framing context that excuses a low CGPA — must appear in the same user
 * span as the number for the candidate to get credit. */
const CGPA_FRAMING_CONTEXT = /\b(?:family|health|hospital|surgery|loss|covid|caregiv|financial|part[- ]?time job|supported|recovered|bounced back|after that|since then|the next sem|improved|trended? up|consistent improvement|i (?:worked on|focused on|built|shipped|interned|won|cleared|topped)|(?:9|8|10)\.\d+\s+in\s+(?:my\s+)?(?:last|recent|final)\s+(?:few\s+)?semesters?|last\s+(?:three|four|two|few|3|4|5)\s+semesters?\s+(?:i|i'?ve)|cleared\s+(?:the\s+)?(?:case|coding|final|aptitude)\s+round|placed\s+(?:in|at|with)|offered?\s+by|got\s+(?:an\s+)?offer\s+from|trend(?:ing|ed)?\s+(?:upward|up)|sgpa\s+(?:has\s+)?(?:improved|gone\s+up)|hackathon|kaggle|leetcode|codeforces|open[- ]?source\s+contribut|published)\b/i;

/* Reverse-question grading. Every Indian campus interview closes with
 * "Do you have any questions for us?" — what the candidate asks back
 * is part of the grade. */
const REVERSE_QUESTION_PROBE = /\b(?:any\s+questions?\s+(?:for\s+(?:us|me|the\s+team))?|do\s+you\s+have\s+(?:any\s+)?questions?|anything\s+you'?d?\s+like\s+to\s+ask|questions?\s+from\s+your\s+(?:side|end))\b/i;
/* Specific, prepared reverse-questions — these score. */
const REVERSE_QUESTION_SPECIFIC = /\b(?:training\s+program|onboarding|mentor|on[- ]?call|rotation|tech\s+stack|deployment|production|code\s+review|team\s+structure|growth\s+(?:track|path|plan)|career\s+(?:track|progression|ladder)|appraisal|promotion\s+(?:cycle|timeline)|notice\s+period|bond|service\s+agreement|recent\s+launch|product\s+roadmap|client\s+(?:engagement|project)|new\s+(?:product|launch|hire)|ppt|pre[- ]?placement\s+talk|the\s+(?:speaker|presenter)\s+mentioned|(?:i\s+(?:noticed|saw|read|came\s+across)|i'?ve\s+(?:noticed|seen|read)|i\s+was\s+reading)\s+(?:that|about|on|your)|(?:could|can|would)\s+you\s+(?:walk\s+me\s+through|tell\s+me\s+more\s+about|share|elaborate)|how\s+does\s+(?:the\s+team|your\s+team|engineering|the\s+org)\s+(?:handle|approach|decide|measure|review)|what\s+(?:does|do)\s+(?:a\s+)?(?:typical\s+)?(?:first\s+(?:90\s+days|six\s+months|year)|day\s+in\s+the\s+life|new\s+joiner|fresher)|what\s+(?:metrics|kpis?|success\s+criteria)|how\s+(?:are|do)\s+(?:juniors|freshers|new\s+hires)\s+(?:evaluated|mentored|supported)|story\s+behind|engineering\s+(?:culture|blog|values))\b/i;
/* Generic / lazy reverse-questions — these don't score. */
const REVERSE_QUESTION_GENERIC = /\b(?:work\s+culture|company\s+culture|good\s+culture|growth\s+opportunit|learning\s+opportunit|work[- ]?life\s+balance|when\s+(?:can|do)\s+i\s+(?:start|join|expect)|how\s+(?:is|are)\s+the\s+(?:team|culture|company))\b/i;
/* "No, I don't" / declining the offer to ask. */
const REVERSE_QUESTION_DECLINED = /\b(?:no\s*[,.]?\s*(?:i\s+(?:don'?t|do\s+not)|that'?s\s+(?:all|fine|good)|nothing\s+(?:from|for)\s+(?:my|now))|i'?m\s+(?:good|clear|set|fine|done|sorted)|i\s+think\s+i'?m\s+(?:good|clear|set|fine|done|sorted)|i'?ve\s+got\s+everything|all\s+(?:clear|good)|nothing\s+from\s+(?:me|my\s+(?:side|end))|i\s+(?:don'?t|do\s+not)\s+have\s+(?:any|questions))\b/i;

/* Bond / service-agreement probe + readiness signal. Real Indian campus
 * interviews probe bond comfort directly; freshers who say "I don't know
 * about bonds" or refuse outright disqualify themselves. */
const BOND_PROBE = /\b(?:service\s+agreement|service\s+bond|training\s+bond|two[- ]?year\s+bond|2[- ]?year\s+bond|1[- ]?year\s+bond|bond\s+(?:period|duration|amount)|sign\s+(?:the\s+|a\s+)?bond|notice\s+period\s+bond)\b/i;
const BOND_HEALTHY_RESPONSE = /\b(?:comfortable\s+(?:with|signing)|i'?m\s+aware|i\s+know\s+(?:the|about|of)\s+(?:the\s+)?(?:bond|service\s+agreement|2\s*year|1\s*year)|happy\s+to\s+sign|(?:2|two|1|one|15)\s*(?:[- ]?)(?:month|year)s?|standard\s+practice|fully\s+aware)\b/i;
const BOND_REFUSAL = /\b(?:i\s+won'?t\s+sign|absolutely\s+not|no\s+way|refuse|never\s+sign|i\s+don'?t\s+(?:sign|do)\s+bonds?)\b/i;
const BOND_IGNORANCE = /\b(?:what'?s?\s+(?:a\s+)?bond|i\s+don'?t\s+know\s+(?:about|what)|never\s+heard\s+of|first\s+(?:time\s+)?hearing)\b/i;

/* ── Wave 3: real-life campus edge cases ─────────────────────────────────
 * Each block below targets a specific failure mode Indian recruiters see
 * repeatedly. Patterns are intentionally conservative — we'd rather miss
 * a true positive than fire on a benign answer. */

/* Attrition risk — fresher signaling exit within 1-2 years (MBA / MS / GRE
 * prep / going abroad). At service-tier this is an immediate red flag
 * because the company can't recover the 2yr training cost. */
const ATTRITION_HIGHER_STUDIES = /\b(?:planning\s+(?:to\s+)?(?:do\s+)?(?:my\s+)?(?:mba|ms\b|masters|m\.?tech\s+abroad|gre|gmat|cat\s+exam)|going\s+abroad\s+for\s+(?:my\s+)?(?:mba|ms|masters|higher\s+studies)|prepar(?:e|ing)\s+for\s+(?:gre|gmat|cat\b|ielts|toefl)|after\s+(?:1|2|one|two)\s*years?\s+i\s+(?:want|plan|will)\s+to\s+(?:do|pursue|join)\s+(?:my\s+)?(?:mba|ms|masters)|i\s+want\s+to\s+do\s+(?:my\s+)?(?:mba|ms|masters)\s+(?:in|after|within)\s+(?:1|2|one|two)\s*years?)\b/i;

/* Relocation refusal — flat refusal to leave home city. Dealbreaker at
 * TCS/Infosys/Wipro/Cognizant where allocation is pan-India. */
const RELOCATION_REFUSAL = /\b(?:(?:cannot|can'?t|won'?t|will\s+not|unable\s+to)\s+relocate|not\s+willing\s+to\s+relocate|only\s+(?:want\s+to\s+work|prefer\s+to\s+work|join\s+if\s+(?:posting|posted))\s+(?:in|at|near)\s+(?:bangalore|bengaluru|hyderabad|chennai|mumbai|pune|delhi|noida|gurgaon|gurugram|kolkata|my\s+(?:home\s+)?(?:city|town))|(?:can|will)\s+only\s+work\s+(?:in|from)\s+(?:bangalore|bengaluru|hyderabad|chennai|mumbai|pune|delhi|noida|gurgaon|gurugram|kolkata)|relocation\s+is\s+(?:a\s+)?(?:problem|deal[- ]?breaker|not\s+possible))\b/i;
const RELOCATION_PROBE = /\b(?:relocat|are\s+you\s+(?:open\s+to|willing\s+to)\s+(?:move|relocate)|(?:bangalore|bengaluru|hyderabad|chennai|pune|noida|gurgaon|trivandrum|kochi|kolkata|nagpur|mysore)\s+(?:office|location|allocation|posting|deployment|center)|any\s+(?:of\s+our\s+)?location|pan[- ]?india\s+(?:posting|deployment|allocation))\b/i;

/* Night-shift / on-call refusal — common dealbreaker. */
const SHIFT_REFUSAL = /\b(?:(?:cannot|can'?t|won'?t|will\s+not|don'?t\s+(?:want|prefer)|not\s+(?:comfortable|okay|ok|willing))\s+(?:to\s+)?(?:do|work|take)\s+(?:night\s+shift|on[- ]?call|rotational\s+shift|graveyard\s+shift|us\s+shift|evening\s+shift)|night\s+shift\s+is\s+(?:a\s+)?(?:problem|deal[- ]?breaker|not\s+possible|issue)|no\s+night\s+(?:shifts?|duty)|on[- ]?call\s+is\s+(?:a\s+)?(?:problem|deal[- ]?breaker|not\s+possible|issue))\b/i;
const SHIFT_PROBE = /\b(?:night\s+shift|rotational\s+shift|on[- ]?call|24x7|24\s*\/\s*7|us\s+(?:shift|hours|timing)|graveyard|client\s+(?:hours|timing)|shift\s+timing|production\s+support)\b/i;

/* Cliché strength/weakness — "perfectionist", "work too hard". */
const CLICHE_STRENGTH_WEAKNESS = /\b(?:i'?m\s+a\s+perfectionist|i\s+am\s+(?:a\s+)?perfectionist|my\s+(?:biggest\s+)?weakness\s+is\s+(?:that\s+)?(?:i\s+am\s+a\s+perfectionist|i'?m\s+a\s+perfectionist|i\s+work\s+too\s+(?:hard|much)|i\s+care\s+too\s+much|i\s+am\s+too\s+(?:dedicated|hard[- ]?working|honest))|i\s+work\s+too\s+(?:hard|much)\s+sometimes|i'?m\s+too\s+(?:hard[- ]?working|dedicated|honest)|workaholic)\b/i;
const STRENGTH_WEAKNESS_PROBE = /\b(?:(?:greatest|biggest|main)\s+(?:strength|weakness)|tell\s+me\s+(?:about\s+)?your\s+(?:strengths?|weakness(?:es)?)|what\s+(?:are|is)\s+your\s+(?:strengths?|weakness(?:es)?)|areas?\s+(?:of\s+improvement|to\s+improve))\b/i;

/* "Tell me about yourself" → resume recital cue. */
const TMAY_PROBE = /\b(?:tell\s+me\s+about\s+yourself|introduce\s+yourself|walk\s+me\s+through\s+your\s+(?:background|resume|cv|profile)|brief\s+(?:introduction|intro)\s+about\s+yourself)\b/i;
const RESUME_RECITAL = /\b(?:as\s+(?:per|mentioned\s+in|stated\s+in)\s+my\s+(?:resume|cv)|as\s+(?:you\s+can\s+see\s+)?(?:in|on)\s+my\s+(?:resume|cv)|on\s+(?:the\s+)?top\s+of\s+(?:the\s+)?(?:resume|cv|profile)|listed\s+(?:in|on)\s+my\s+(?:resume|cv)|going\s+through\s+my\s+resume|reading\s+(?:from\s+)?my\s+resume)\b/i;

/* "Where do you see yourself in 5 years?" — career-goal probe.
 * Specific (tech-lead / SDE-3 / shipping a product) scores;
 * vague ("successful", "settled", "in a senior position") doesn't. */
const CAREER_GOAL_PROBE = /\b(?:where\s+do\s+you\s+see\s+yourself|5\s*years?\s+(?:down\s+the\s+line|from\s+now|hence)|long[- ]?term\s+(?:goal|plan|vision|aspiration)|career\s+(?:goal|plan|aspiration|trajectory|graph)|(?:short|long)[- ]?term\s+plan)\b/i;
const CAREER_GOAL_VAGUE = /\b(?:(?:want\s+to\s+be|see\s+myself|be)\s+(?:successful|big|in\s+a\s+(?:senior|leadership|big|higher|good)\s+(?:position|role|level)|settled|happy|grown\s+(?:in|as)\s+(?:a\s+)?person|at\s+a\s+higher\s+level)|wherever\s+(?:life|the\s+company)\s+takes|grow\s+(?:in|with)\s+the\s+company|don'?t\s+(?:know|have\s+a\s+plan)|haven'?t\s+(?:thought|decided))\b/i;
const CAREER_GOAL_SPECIFIC = /\b(?:tech\s+lead|senior\s+(?:engineer|developer|sde)|principal\s+(?:engineer|developer)|sde[- ]?[23ii]|engineering\s+manager|staff\s+engineer|specialis[ez]\s+in\s+\w|domain\s+expert|architect\s+(?:for|on)|associate\s+(?:consultant|architect|partner)|product\s+(?:manager|owner)|founding\s+(?:engineer|team)|own(?:ership)?\s+of\s+(?:a|the|my)\s+(?:product|module|service|feature)|shipping\s+(?:my|the)\s+(?:first|own)\s+(?:product|feature|module)|deep\s+expertise\s+in\s+\w|core\s+contributor\s+to\s+\w)\b/i;

/* Hackathon claim — should come with rank/prize/team/duration detail. */
const HACKATHON_CLAIM = /\b(?:hackathon|hack\s+day|smart\s+india\s+hackathon|sih\b|hackerearth\s+(?:contest|hackathon)|unstop|techgig|codevita|coding\s+contest|programming\s+contest|google\s+hash\s+code|kickstart)\b/i;
const HACKATHON_DETAIL = /\b(?:won|runner[- ]?up|top\s+\d+|finalist|prize|stipend|leader[- ]?board|team\s+of\s+\d|built\s+\w+\s+in\s+\d+\s+(?:hours?|days?)|(?:24|36|48|72)\s+hours?|theme\s+was|problem\s+statement|judges?|first\s+place|second\s+place|third\s+place|rank\s+\d+|cash\s+prize|certificate)\b/i;

/* Buzzword soup — listing too many trendy areas as "interests" without an
 * anchor project. Counted across the full user text. */
const BUZZWORD = /\b(?:ai\b|ml\b|machine\s+learning|deep\s+learning|blockchain|web3\b|iot\b|cloud\s+computing|cyber\s*security|data\s+science|big\s+data|generative\s+ai|gen\s*ai|chatgpt|llm\b|nlp\b|computer\s+vision|robotics|ar\s*\/\s*vr|metaverse|quantum\s+computing|crypto(?:currency)?|nft\b)\b/gi;

/* Family-pressure framing — unprofessional in a job interview context. */
const FAMILY_PRESSURE = /\b(?:my\s+(?:parents|family|father|mother|dad|mom)\s+(?:want|wants|wanted|told|asked|forced|pushed|insisted|chose)|because\s+of\s+my\s+(?:parents|family)|my\s+(?:parents|family)'?s?\s+(?:wish|dream|expectation|pressure|choice)|forced\s+(?:by|into|to\s+join)\s+(?:my\s+)?(?:parents|family|this\s+field))\b/i;

/* Negative compare to another company. */
const NEGATIVE_COMPARE = /\b(?:(?:tcs|infosys|wipro|cognizant|hcl|tech\s+mahindra|capgemini|accenture|google|amazon|microsoft|adobe|flipkart|swiggy|zomato)\s+is\s+(?:better|worse|bigger|smaller|cheaper|costlier|worse\s+paying|low[- ]?paying)\s+than|(?:better|worse|cheaper|costlier|smaller|bigger)\s+than\s+(?:tcs|infosys|wipro|cognizant|hcl|google|amazon|microsoft|flipkart|swiggy|zomato)|(?:tcs|infosys|wipro|cognizant|hcl|capgemini|accenture)\s+(?:doesn'?t|does\s+not|never)\s+(?:pay\s+well|train\s+well|give\s+good))\b/i;

/* Salary expectation probe + value extraction. */
const SALARY_EXPECTATION_PROBE = /\b(?:salary\s+expectation|expected\s+(?:ctc|salary|package|compensation)|what\s+(?:are|is)\s+your\s+(?:salary|ctc|package)\s+expectation|how\s+much\s+(?:are\s+you\s+expecting|do\s+you\s+want|salary)|expected\s+pay)\b/i;
const SALARY_NUMBER_LPA = /\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:lpa|lakhs?\s*per\s*annum|l\.?p\.?a\.?)\b/i;

/* User raised salary too early — in a technical / introductory round.
 * We flag if the user mentions CTC/salary before the AI has done so, AND
 * within the first 4 user turns. */
const USER_SALARY_RAISED = /\b(?:what\s+(?:is\s+(?:the\s+)?)?(?:ctc|salary|package|pay)|how\s+much\s+do\s+you\s+pay|salary\s+structure|what'?s\s+the\s+(?:pay|ctc|package))\b/i;

/* Portfolio absence claim — user said "I built X" but didn't reference
 * any github / hosted demo / live link. Only fires on substantial
 * project narration. */
const CLAIMED_BUILT = /\b(?:i\s+(?:built|made|developed|coded|implemented|deployed|shipped|trained)\s+(?:a\s+|an\s+|the\s+|my\s+)?\w)/i;
const PORTFOLIO_LINK = /\b(?:github(?:\.com)?|gitlab|bitbucket|portfolio\s+(?:link|url|site|website)|live\s+(?:demo|link|url|site)|deployed\s+(?:on|at)|hosted\s+(?:on|at)|netlify|vercel|render|heroku|firebase\s+hosting|aws\s+(?:s3|amplify|elastic)|hugging\s*face|kaggle\s+notebook|colab\s+notebook|leetcode\s+profile|codeforces|codechef|hackerrank\s+profile|figma\s+(?:link|file)|notion\s+page|demo\s+video)\b/i;

/* ── Wave-4 patterns — deeper Indian campus realism ───────────────── */

/* Active backlog / arrears — TCS/Infosys/Wipro have strict no-active-backlog
 * rules. AI probes; user evades ("not sure", "few left", "will clear soon"). */
const BACKLOG_PROBE = /\b(?:any\s+(?:active\s+)?(?:backlogs?|arrears?|kt(?:s)?\b|supplementary)|how\s+many\s+(?:backlogs?|arrears?|kts?)|do\s+you\s+have\s+(?:any\s+)?(?:backlogs?|arrears?|standing\s+arrears?)|standing\s+arrears?|active\s+(?:backlog|arrear)|history\s+of\s+(?:backlogs?|arrears?))\b/i;
const BACKLOG_EVASIVE = /\b(?:not\s+sure|don'?t\s+remember|few\s+left|couple\s+(?:left|pending)|will\s+clear|going\s+to\s+clear|trying\s+to\s+clear|some\s+(?:are\s+)?pending|haven'?t\s+(?:checked|counted)|i\s+think\s+(?:one|two|three|a\s+few))\b/i;
const BACKLOG_CLEAN = /\b(?:no\s+(?:active\s+)?(?:backlogs?|arrears?|kts?)|zero\s+(?:backlogs?|arrears?)|all\s+(?:cleared|passed|first\s+attempt)|cleared\s+(?:everything|all\s+(?:papers|subjects))|first[- ]?attempt\s+pass)\b/i;

/* Branch-jump — non-CS branch applying to SDE/SWE. Mech / Civil / EEE / ECE /
 * Chem / Biotech / IT / MBA all common. Needs learning-narrative when probed. */
const NONCS_BRANCH = /\b(?:mechanical\s+engineering|civil\s+engineering|chemical\s+engineering|electrical\s+(?:engineering|and\s+electronics)|electronics\s+(?:and\s+communication|engineering|and\s+telecom)|ece\b|eee\b|biotech(?:nology)?|aerospace|metallurgy|automobile\s+engineering|production\s+engineering|industrial\s+engineering|i\s+am\s+(?:from|in)\s+(?:mech|civil|ece|eee|chem|biotech))\b/i;
const BRANCH_LEARNING_NARRATIVE = /\b(?:self[- ]?taught|self[- ]?study|learnt\s+(?:coding|programming|cs|dsa)|coursera|nptel|udemy|youtube|cs50|harvard\s+cs50|mit\s+ocw|leetcode|hackerrank|gfg|geeks\s*for\s*geeks|striver|love\s+babbar|kunal\s+kushwaha|abdul\s+bari|completed\s+(?:a|the)\s+(?:bootcamp|course|specialization)|minor\s+in\s+(?:cs|computer)|certified\s+in|switched\s+(?:to|domains?)|cross[- ]?domain|transitioned\s+to|moved\s+(?:into|to)\s+(?:software|tech|cs)|built\s+\d+\s+projects?)\b/i;

/* PPT (pre-placement talk) recall — interviewers expect the candidate to
 * reference something from the PPT (speaker, recent launch, program name).
 * Fire if substantial transcript + no PPT reference. */
const PPT_REFERENCE = /\b(?:ppt\b|pre[- ]?placement\s+talk|the\s+(?:speaker|presenter|hr|recruiter)\s+(?:mentioned|talked\s+about|shared)|during\s+(?:your|the)\s+(?:presentation|talk)|you\s+(?:mentioned|talked\s+about|presented)\s+(?:in\s+the\s+ppt|earlier|during)|i\s+(?:saw|attended|was\s+at)\s+(?:your|the)\s+(?:ppt|presentation|pre[- ]?placement)|in\s+(?:your|the)\s+pre[- ]?placement)\b/i;

/* Coding-round score defense — AI mentions low coding/DSA score, user has
 * no rationale (preparation timeline, time-pressure, learning since). */
const CODING_SCORE_PROBE = /\b(?:your\s+(?:coding|dsa|online|written|aptitude)\s+(?:round\s+)?score\s+(?:was|is)\s+(?:low|on\s+the\s+lower\s+side|not\s+great|weak)|you\s+(?:only\s+)?cleared\s+(?:\d|one|two)\s+(?:question|problem)s?|coding\s+(?:round|test).+(?:struggle|tough|hard|low)|you\s+(?:missed|didn'?t\s+(?:clear|solve))\s+(?:the\s+)?(?:hard|second|third|last)\s+(?:problem|question)|why\s+(?:was\s+)?your\s+(?:coding|dsa)\s+score\s+(?:so\s+)?low)\b/i;
const CODING_SCORE_RATIONALE = /\b(?:nerves?|time\s+(?:pressure|management|ran\s+out)|got\s+stuck|over[- ]?thought|first\s+(?:placement\s+)?(?:round|test)|since\s+then|after\s+that\s+i'?ve|i'?ve\s+(?:improved|practi[cs]ed|been\s+solving|done\s+\d+)|leetcode\s+streak|currently\s+at\s+(?:knight|guardian|specialist|expert)|solved\s+\d{2,}\s+problems?|practi[cs]ing\s+(?:daily|every\s+day)|i\s+know\s+where\s+i\s+(?:went\s+wrong|lost\s+marks))\b/i;

/* Parallel exam prep — admits preparing for GATE / CAT / UPSC / GRE alongside
 * placement. Attrition-adjacent, service-tier red flag. */
const PARALLEL_EXAM_PREP = /\b(?:(?:also|simultaneously|in\s+parallel|side\s+by\s+side|along\s+with\s+this|alongside)\s+(?:preparing|studying|appearing)\s+for\s+(?:gate|cat|upsc|gre|gmat|ielts|toefl)|i'?m\s+(?:also\s+)?(?:preparing|studying)\s+for\s+(?:gate|cat|upsc|gre|gmat)\s+(?:this\s+year|simultaneously|in\s+parallel)|writing\s+(?:gate|cat|upsc)\s+(?:this|next)\s+(?:year|month)|gate\s+(?:and|plus|alongside)|cat\s+(?:and|plus|alongside))\b/i;

/* Tier-3 overcompensation — non-tier-1 / non-tier-2 college + grandiose
 * leadership claim. Fires only when collegeTier === "unknown". */
const GRANDIOSE_CLAIM = /\b(?:nation(?:al|-?wide)?\s+(?:winner|topper|champion|leader)|all\s+india\s+(?:rank|topper|winner)|hackathon\s+(?:winner|champion)\s+(?:nationally|globally)|google\s+gsoc|outreachy|won\s+(?:hackathons?|contests?)\s+(?:multiple\s+times|nationally|globally|across\s+india)|i'?ve\s+led\s+(?:teams?\s+of\s+)?\d{2,}|i'?ve\s+(?:single[- ]?handedly|alone|by\s+myself)\s+(?:built|shipped|launched)\s+(?:a\s+)?(?:startup|product|company)|founder\s+of\s+(?:my\s+own\s+)?(?:startup|company)|generated\s+(?:revenue|\d+\s*(?:lakhs?|crores?))|served?\s+(?:thousands|millions)\s+of\s+(?:users|customers))\b/i;

/* FYP (final-year project) solo claim vs team — user says "I built" but
 * also references team-of-N. Detect contradiction. */
const FYP_SOLO_CLAIM = /\b(?:i\s+(?:built|made|developed|coded|shipped|designed|architected)\s+(?:the\s+|a\s+|an\s+|my\s+)?(?:fyp|final[- ]?year\s+project|capstone|major\s+project))\b/i;
const FYP_TEAM_MENTION = /\b(?:team\s+of\s+(?:3|4|5|6|three|four|five|six)|(?:3|4|5|6|three|four|five|six)[- ]?(?:person|member)\s+team|my\s+team|we\s+(?:built|made|developed|did|shipped|presented)|our\s+(?:team|group)\s+(?:built|made|developed|did)|with\s+(?:my\s+)?(?:teammates|team\s+members|group\s+mates))\b/i;

/* Stipend dodge — AI asks intern stipend, user hedges (could signal
 * fabricated internship or undisclosed unpaid status). */
const STIPEND_PROBE = /\b(?:what\s+was\s+(?:your|the)\s+stipend|how\s+much\s+(?:were\s+you\s+paid|did\s+(?:they|you)\s+(?:pay|get))|stipend\s+(?:amount|kitna|details?)|paid\s+internship|monthly\s+(?:stipend|pay|comp))\b/i;
const STIPEND_DODGE = /\b(?:don'?t\s+(?:remember|recall)|prefer\s+not|it\s+was\s+unpaid\s+but|not\s+(?:disclosed|comfortable)|confidential|nda|can'?t\s+share|small\s+amount|something\s+(?:small|minimal|nominal)|not\s+much|barely\s+anything|just\s+(?:travel|conveyance)|i\s+wasn'?t\s+(?:keeping\s+track|paying\s+attention))\b/i;
const STIPEND_CONCRETE = /\b(?:\d{1,2},?\d{3}\s*(?:per\s+month|\/month|monthly|pm\b)|₹\s*\d{1,2},?\d{3}|\d{1,2}\s*(?:k|thousand)\s*(?:per\s+month|\/month|monthly|pm\b)|inr\s+\d{1,2},?\d{3}|stipend\s+(?:was|of)\s+(?:₹|rs\.?)?\s*\d|i\s+was\s+paid\s+\d|got\s+(?:₹|rs\.?)?\s*\d{1,2},?\d{3})\b/i;

/* ── Wave-5 patterns — softer-signal Indian campus realism ────────── */

/* Memorized self-intro — verbatim YouTube-template openers. Fires when
 * the candidate's response to TMAY contains 2+ canonical template phrases. */
const MEMORIZED_TEMPLATE = /\b(?:good\s+(?:morning|afternoon|evening)\s+(?:sir|ma'?am|mam|sir\s*\/\s*ma'?am)|first\s+of\s+all\s+(?:i'?d\s+like\s+to\s+)?thank\s+you\s+for\s+(?:this\s+(?:wonderful\s+)?opportunity|giving\s+me\s+this\s+(?:wonderful\s+)?opportunity)|coming\s+to\s+my\s+(?:introduction|family\s+background)|i\s+would\s+like\s+to\s+(?:introduce\s+myself|begin\s+(?:with|by))|talking\s+about\s+my\s+(?:family|hobbies|strengths)|on\s+a\s+concluding\s+note|that'?s\s+all\s+(?:about|from)\s+me|this\s+is\s+all\s+about\s+(?:me|myself)|myself\s+\w+\s+\w+(?:,|\s+and\s+i\s+am))/i;

/* Aptitude / on-spot puzzle refusal — AI asks a live aptitude / DSA /
 * estimation question; user refuses or stalls. */
const APTITUDE_LIVE_PROBE = /\b(?:quick\s+(?:one|question|puzzle)|solve\s+(?:this|the\s+following)|how\s+would\s+you\s+(?:approach|solve)|let'?s\s+do\s+(?:a\s+)?(?:quick\s+)?(?:puzzle|brainteaser|estimation)|find\s+the\s+(?:second|3rd|nth)\s+(?:highest|largest)|reverse\s+(?:a\s+)?(?:linked\s+list|string|array)|estimate\s+the\s+number\s+of|fermi\s+(?:question|estimate))\b/i;
const APTITUDE_REFUSAL = /\b(?:can'?t\s+(?:think|solve|do)\s+(?:on\s+the\s+spot|right\s+now|under\s+pressure)|i'?m\s+not\s+good\s+(?:at|with)\s+(?:puzzles|aptitude|dsa|on[- ]?spot)|need\s+(?:to\s+see|a)\s+(?:ide|laptop|computer|keyboard|paper)|i\s+don'?t\s+do\s+(?:puzzles|aptitude|brainteasers)|skip\s+(?:this|that)|pass\s+(?:on\s+)?(?:this|that)|not\s+comfortable\s+(?:with|doing)\s+(?:this|puzzles|aptitude))\b/i;

/* Onsite / foreign-opportunity premature ask — fresher brings up US /
 * UK / onsite within the first 3 user turns, before role discussion. */
const ONSITE_QUERY = /\b(?:onsite\s+(?:opportunit|chance|posting|assignment|deputation)|when\s+(?:will|can|do)\s+i\s+go\s+(?:onsite|abroad|to\s+(?:us|usa|uk|canada|australia|germany))|foreign\s+(?:posting|opportunity|travel|deputation)|us\s+(?:client|posting|travel|opportunity|onsite|deputation)|sent\s+to\s+(?:us|usa|uk|onsite)|client\s+location\s+(?:travel|visit|posting))\b/i;

/* Nepotism reference — mentions relative / family-friend at the company.
 * Red flag at most Indian firms; some PSUs explicitly forbid it. */
const NEPOTISM_MENTION = /\b(?:my\s+(?:uncle|aunt|father|mother|dad|mom|cousin|brother|sister|relative|chacha|mama|mausi|bhai|behen|bhaiya|didi)\s+(?:works?|is\s+(?:working|an?\s+\w+))\s+(?:at|in|for|with)\s+(?:your\s+)?(?:company|organi[zs]ation|firm|here|this\s+company)|my\s+(?:family\s+friend|relative|cousin)\s+(?:works?|is)\s+(?:at|in|for|with)\s+(?:your|this)\s+(?:company|organi[zs]ation|firm)|referred\s+by\s+my\s+(?:uncle|aunt|father|mother|cousin|relative)|family\s+contact\s+(?:at|in)\s+(?:your|this)\s+company)\b/i;

/* In-hand vs CTC confusion — explicit signal of misunderstanding Indian
 * fresher comp structure. Often combined with disappointed-tone phrasing. */
const INHAND_CTC_CONFUSION = /\b(?:but\s+(?:my\s+)?in[- ]?hand\s+(?:should\s+be|will\s+be|is)\s+\d|in[- ]?hand\s+(?:salary\s+)?(?:will\s+be|kitna|kya|how\s+much)|i\s+(?:thought|assumed|expected)\s+(?:the\s+)?ctc\s+(?:was|is)\s+(?:the\s+)?(?:in[- ]?hand|monthly\s+pay)|isn'?t\s+ctc\s+the\s+same\s+as\s+(?:in[- ]?hand|monthly|take[- ]?home)|so\s+i'?ll\s+(?:take\s+home|get)\s+\d+\s*lpa)\b/i;

/* Code-on-paper / whiteboard freeze — AI asks for pseudocode / logic
 * walkthrough, user says they can only code in IDE. */
const CODE_WRITE_PROBE = /\b(?:write\s+(?:the\s+)?(?:pseudo[- ]?code|code|logic|algorithm)|walk\s+me\s+through\s+the\s+(?:code|logic|algorithm)|how\s+would\s+you\s+code\s+(?:this|it)|on\s+(?:paper|whiteboard|notepad|chat)|share\s+your\s+screen\s+and\s+code|type\s+out\s+the\s+logic|sketch\s+(?:the\s+)?(?:code|algorithm)|explain\s+(?:the\s+)?logic\s+(?:line\s+by\s+line|step\s+by\s+step))\b/i;
const CODE_WRITE_REFUSAL = /\b(?:i\s+can\s+only\s+code\s+in\s+(?:an?\s+)?ide|i\s+need\s+(?:an?\s+)?ide|can'?t\s+(?:code|write)\s+(?:without|on\s+paper|here|in\s+chat|in\s+the\s+chat)|i\s+don'?t\s+write\s+(?:code\s+)?(?:on\s+paper|by\s+hand)|let\s+me\s+(?:open|grab)\s+(?:my\s+)?(?:laptop|ide|vs\s*code)|i'?m\s+not\s+good\s+(?:without|outside)\s+(?:an?\s+)?ide)\b/i;

/* Resume date inconsistency — overlapping internship windows in same text.
 * Detects two date ranges that clearly overlap (e.g. "May 2024 to August 2024"
 * AND "June 2024 to October 2024"). Conservative — only fires when at least
 * two month-year ranges are mentioned and obviously overlap. */
const MONTH_YEAR_RANGE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\s+(?:to|till|until|-|–|—)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})/gi;

/* Degree / branch inconsistency — candidate names two different branches
 * across the transcript. Common confusion sources: CSE, IT, AIML, AIDS,
 * ECE, EEE, Mech, Civil, Chem. Fires if two distinct branch names appear
 * in user text without an explicit minor / dual-degree connector. */
// NOTE: bare two-letter forms ("IT", "IS") are intentionally excluded — they
// false-positive on the English words "it"/"is" inside any transcript. We
// require the spelled-out forms ("information technology" / "information
// science"); canonicalization below still maps both into the "it"/"is" keys.
// Same caution for short forms like "mech": require a branch-context word.
const BRANCH_NAME = /\b(?:cse\b|c\s*s\s*e\b|computer\s+science(?:\s+and\s+engineering)?|cs\s+engineering|information\s+technology|information\s+science|electronics\s+and\s+communication(?:\s+engineering)?|ece\b|e\s*c\s*e\b|electrical\s+and\s+electronics(?:\s+engineering)?|eee\b|e\s*e\s*e\b|mechanical(?:\s+engineering)?|\bmech\s+(?:branch|engineering|department|stream|major|student)|civil\s+engineering|chemical\s+engineering|chem\s+engg|biotech(?:nology)?|a\s*i\s*\/?\s*m\s*l\b|aiml\b|artificial\s+intelligence\s+(?:and|&)\s+machine\s+learning|\baids\s+(?:branch|department|stream|major|student|engineering)|artificial\s+intelligence\s+(?:and|&)\s+data\s+science|data\s+science\s+(?:engineering|branch))\b/i;
const DUAL_DEGREE_CONNECTOR = /\b(?:minor\s+in|dual[- ]?degree|integrated\s+(?:m\s*tech|b\s*tech|m[- ]?s)|with\s+a\s+specialization\s+in|core\s+(?:branch|major)\s+is|primary\s+branch|specializ\w+\s+in|i'?m\s+from\s+\w+\s+but\s+(?:my\s+)?(?:minor|focus|elective)|switched\s+(?:from|branch|streams))\b/i;

/* ── Resume-aware helpers (Wave-6) ────────────────────────────────── */

/** Canonical branch keys we use for cross-checks (CSE, IT, IS, ECE, EEE,
 *  Mech, Civil, Chem, Biotech, AIML, AIDS, DataScience). Anything else
 *  resolves to undefined so callers can skip the check. */
function canonicalizeBranch(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const k = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return undefined;
  if (/^c(omputer)?s(cience)?(?:andengineering)?$/.test(k) || k.includes("cse")) return "cse";
  if (/^i(nformation)?t(echnology)?$/.test(k) || k.endsWith("informationtechnology")) return "it";
  if (/^i(nformation)?s(cience)?$/.test(k) || k.endsWith("informationscience")) return "is";
  if (k.includes("ece") || k.includes("electronicscommunication")) return "ece";
  if (k.includes("eee") || k.includes("electricalelectronics")) return "eee";
  if (k.includes("mechanical")) return "mech";
  if (k.includes("civil")) return "civil";
  if (k.includes("chemical") || k.includes("chemengg")) return "chem";
  if (k.includes("biotech")) return "biotech";
  if (k.includes("aiml") || k.includes("machinelearning")) return "aiml";
  if (k.includes("aids") || k.includes("datascienceengineering")) return "aids";
  if (k.includes("datascience")) return "datascience";
  return undefined;
}

/** Normalize a company string for cross-check comparison. Drops
 *  Pvt Ltd / Inc / Technologies suffixes, lowercases, strips punctuation. */
function normalizeCompanyName(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|corporation|corp|technologies|technology|tech|labs|solutions|systems|india)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Curated list of well-known Indian + global tech employers (~70).
 *  Used by `internship_company_unrecognized` to decide whether a
 *  claimed-internship company is plausible without resume cross-check.
 *  Conservative — only the most-recognised names; small legitimate
 *  startups will fall through and not be flagged at high severity. */
const KNOWN_TECH_EMPLOYER = /\b(?:tcs|tata\s+consultancy|infosys|wipro|cognizant|hcl|tech\s+mahindra|capgemini|accenture|deloitte|pwc|ey|kpmg|ibm|oracle|sap|google|microsoft|amazon|apple|meta|facebook|adobe|linkedin|salesforce|nvidia|intel|qualcomm|atlassian|stripe|netflix|uber|doordash|databricks|snowflake|mongodb|flipkart|razorpay|phonepe|paytm|swiggy|zomato|cred|zerodha|myntra|freshworks|browserstack|postman|nykaa|meesho|ola|byju'?s|unacademy|jio|airtel|ltimindtree|persistent|mindtree|hexaware|coforge|mphasis|amdocs|globallogic|virtusa|samsung|sony|cisco|dell|hp(?:\s+inc)?|lenovo|qualcomm|broadcom|amd|paypal|netapp|servicenow|workday|vmware|cloudera|hortonworks|nutanix|palo\s+alto|fortinet|crowdstrike|okta|twilio|zoom|slack|github|gitlab|atlassian|reliance|isro|drdo|barc|nse|bse|crisil|nielsen|gartner|mckinsey|bcg|bain|fractal|tredence|mu\s*sigma|brillio|happiest\s+minds|persistent\s+systems|zoho|kpit|cyient|sonata|niit|hcl\s+technologies|infosys\s+bpm|wipro\s+digital|tcs\s+ignite)\b/i;

/** Extract candidate company names from transcript text — looks for
 *  "interned at X" / "internship at X" / "at X as <role>". Conservative
 *  — only returns short proper-noun-looking strings. */
function extractClaimedCompanies(userText: string): string[] {
  const out: string[] = [];
  const re = /\b(?:interned|internship|worked|intern)\s+(?:at|with|for)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(userText)) !== null) {
    const name = m[1].replace(/[.,;:]+$/, "").trim();
    if (name && name.length <= 60) out.push(name);
  }
  return out;
}

export const campusPlacementAnalyzer: FocusAnalyzer = {
  focus: "campus-placement",
  version: "campus-placement-v6.9",
  async analyze({ session, resume }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) { result.flags.push("empty_transcript"); return result; }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];

    const aiText = transcript.filter(isAi).map((t) => t.text || "").join(" ");
    const userText = transcript.filter(isUser).map((t) => t.text || "").join(" ");
    const fullText = `${aiText} ${userText}`;
    const userTurnCount = transcript.filter(isUser).filter((t) => (t.text || "").length > 50).length;

    // No academic project / coursework / CGPA discussed at all
    if (userTurnCount >= 3 && !ACADEMIC_PROJECT.test(fullText)) {
      flags.add("no_academic_project_discussed");
      gaps.push({
        dimension: "fresher_relevance",
        expected: "Campus interviews should surface capstone / final-year project / coursework",
        observed: "No academic project, CGPA, or coursework came up",
        severity: "medium",
      });
    }

    // Generic passion language without ANY substantiation. We require
    // BOTH the verb-based SPECIFIC_PROJECT pattern AND the noun-based
    // SUBSTANTIATION_TOKEN list (github / hackathon / internship / named
    // MOOC / quantified outcome) to be absent before flagging — mirrors
    // the GENERIC_WHY / SPECIFIC_WHY pair pattern in hr-round.ts. Cuts
    // the false-positive rate on candidates who say "I'm passionate
    // about ML, you can see my Kaggle profile at …".
    if (
      GENERIC_PASSION.test(userText) &&
      !SPECIFIC_PROJECT.test(userText) &&
      !SUBSTANTIATION_TOKEN.test(userText)
    ) {
      flags.add("generic_passion_no_substance");
      gaps.push({
        dimension: "specificity",
        expected: "Replace 'passionate about tech' with a specific project + outcome (or a GitHub link, hackathon, internship, named course, or a quantified milestone like '200+ LeetCode')",
        observed: "User used generic passion language without describing a built artifact or any substantiation (no GitHub / hackathon / internship / MOOC / quantified outcome)",
        severity: "medium",
      });
    }

    // Identifies as fresher AND never mentioned availability
    if (FRESHER_LEXICON.test(userText) && !AVAILABILITY.test(`${aiText} ${userText}`) && userTurnCount >= 3) {
      flags.add("availability_never_discussed");
    }

    // Badmouthing college
    if (COLLEGE_BADMOUTH.test(userText)) {
      flags.add("user_badmouthing_college");
      gaps.push({
        dimension: "professionalism",
        expected: "Frame challenges constructively even when discussing weak coursework",
        observed: "User badmouthed college / professors — costs interview points",
        severity: "high",
      });
    }

    // Project narrated but no concrete tech stack named
    if (PROJECT_NARRATION.test(userText) && !TECH_STACK.test(userText)) {
      flags.add("project_no_tech_stack");
      gaps.push({
        dimension: "specificity",
        expected: "Name the actual stack — language, framework, DB, deployment target",
        observed: "User narrated a project without naming any concrete technology",
        severity: "medium",
      });
    }

    /* Phase-2 (2.1) — Tech-stack DEPTH check (symmetric to project_no_tech_stack).
     * Catches the inverse failure mode: the candidate name-drops ≥2 distinct
     * technologies but never anchors them in an artifact (endpoint count,
     * deployed URL, line count, schema shape, applied verb pairing). The
     * recruiter read of this is "lists Python, Flask, React, MongoDB, AWS,
     * Docker on the resume but couldn't tell me what they actually did with
     * any of them." We require ≥2 distinct tech names so a single bare
     * "I used Python" doesn't trip it. */
    const techNameHits = userText.match(TECH_STACK_G) || [];
    const distinctTech = new Set(techNameHits.map((s) => s.toLowerCase()));
    if (
      distinctTech.size >= 2 &&
      PROJECT_NARRATION.test(userText) &&
      !TECH_APPLIED.test(userText) &&
      userTurnCount >= 3
    ) {
      flags.add("tech_named_but_not_applied");
      gaps.push({
        dimension: "specificity",
        expected: "Pair each tech with what you did with it: 'Flask backend serving 4 REST endpoints, Postgres with 3 tables (users / sessions / events), deployed on Render at xyz.onrender.com.' Names alone read as resume keywords.",
        observed: `User named ${distinctTech.size} technologies but never anchored them in an artifact (no endpoint count, deployed URL, line-count, or applied verb pairing) — reads as keyword-stuffed`,
        severity: "medium",
      });
    }

    /* Phase-2 (2.2) — Portfolio link present as a POSITIVE signal.
     * Surfaces alongside the existing negative `portfolio_absent_for_claim`.
     * Lets the report render a green check ('✓ shared GitHub / live demo')
     * and gives downstream consumers (LLM evaluator, dashboard chip) a
     * single flag to read without re-running PORTFOLIO_LINK. */
    if (PORTFOLIO_LINK.test(userText) && (PROJECT_NARRATION.test(userText) || INTERNSHIP_CLAIM.test(userText))) {
      flags.add("portfolio_link_present");
    }

    /* Phase-2 (2.3) — Recency multiplier proxy. We don't raise/lower the
     * numeric score here (the LLM evaluator owns scoring); we surface a
     * flag the evaluator + report read as "project depth was real, but it
     * was 2nd-semester, not final-year — discount accordingly." Only fires
     * when distant markers are PRESENT and no recent marker counterbalances. */
    if (
      PROJECT_NARRATION.test(userText) &&
      PROJECT_DISTANT_MARKER.test(userText) &&
      !PROJECT_RECENT_MARKER.test(userText)
    ) {
      flags.add("projects_dated_not_recent");
      gaps.push({
        dimension: "credibility",
        expected: "Anchor at least one project to your CURRENT semester or final-year. A 2nd-semester project carries far less weight than what you're building this term — interviewers calibrate against recency.",
        observed: "User narrated a project but only cited distant time markers (1st / 2nd year, freshman year) with no current-term or final-year anchor",
        severity: "low",
      });
    }

    // Implausible team-size brag (fresher claiming to have led a 20-person team)
    const teamMatch = userText.match(IMPLAUSIBLE_TEAM);
    if (teamMatch && Number(teamMatch[1]) >= 20) {
      flags.add("implausible_team_size");
      gaps.push({
        dimension: "credibility",
        expected: "Calibrate leadership claims to the college context (3-6 person teams typical)",
        observed: `User claimed to have led a team of ${teamMatch[1]} — implausible for college projects`,
        severity: "medium",
      });
    }

    // "Why this company" probed but only generic filler in response.
    // Phase-6 realism calibration: service-tier (TCS NQT / Wipro NLTH /
    // Cognizant GenC) recruiters EXPECT stability/training/scale
    // narrative — flagging it as generic was a product-co rubric leak.
    // We compute archetype inline here (cheap, pure) and apply an
    // archetype-aware gate: service-tier candidates get credit for
    // either SPECIFIC_SIGNAL (program names) OR SERVICE_TIER_NARRATIVE
    // (stability/training/scale); product-tier candidates still need
    // SPECIFIC_SIGNAL.
    const aiAskedWhyCompany = transcript.some((t) => isAi(t) && WHY_COMPANY_PROBE.test(t.text || ""));
    if (aiAskedWhyCompany && COMPANY_GENERIC_FILLER.test(userText) && !COMPANY_SPECIFIC_SIGNAL.test(userText)) {
      const whyArchetype = classifyCampusArchetype(session.target_company, `${aiText} ${userText}`);
      const serviceTier = whyArchetype === "tcs-ninja" || whyArchetype === "wipro-nlth" || whyArchetype === "cognizant-genc";
      // v6.7 — Cognizant GenC / Capgemini Exceller specifically reward
      // a client-rotation / domain-breadth narrative. Either the
      // generic service-tier narrative OR the Cognizant-specific one
      // counts as a context-appropriate answer for that archetype.
      const serviceTierNarrativePresent = serviceTier && (
        COMPANY_SERVICE_TIER_NARRATIVE.test(userText) ||
        (whyArchetype === "cognizant-genc" && COGNIZANT_CLIENT_ROTATION_NARRATIVE.test(userText))
      );

      if (serviceTierNarrativePresent) {
        // Positive signal — candidate gave a context-appropriate
        // service-tier answer (training program / stability / scale).
        // No `no_company_specific_research` flag for this archetype.
        flags.add("service_tier_why_company_acceptable");
      } else {
        flags.add("no_company_specific_research");
        gaps.push({
          dimension: "preparation",
          expected: serviceTier
            ? "For service-tier (TCS / Infosys / Wipro), anchor on what they actually reward — structured training program, proven client base, long-term stable growth, breadth of domain exposure. 'Great culture / great brand' alone is too thin."
            : "Reference a specific program (TCS NQT, Infosys InfyTQ, Amazon LP), recent launch, or values from the careers page",
          observed: "AI probed 'why this company' — user replied with generic 'great culture / brand' filler",
          severity: "high",
        });
      }
    }

    // Volunteered backlogs / low CGPA without being asked
    const aiAskedAboutDeficit = transcript.some((t) => isAi(t) && DEFICIT_PROBE.test(t.text || ""));
    if (VOLUNTEERED_DEFICIT.test(userText) && !aiAskedAboutDeficit) {
      flags.add("volunteered_academic_deficit");
      gaps.push({
        dimension: "framing",
        expected: "Don't volunteer backlogs / KTs / low CGPA. If asked, explain context briefly + what you learned",
        observed: "User volunteered an academic deficit unprompted — costs interview points before any probe",
        severity: "medium",
      });
    }

    // Excessive filler word usage
    const userWordCount = userText.split(/\s+/).filter(Boolean).length;
    const fillerMatches = userText.match(FILLER) || [];
    if (userWordCount >= 100) {
      const fillerPer100 = (fillerMatches.length / userWordCount) * 100;
      if (fillerPer100 >= FILLER_PER_100_WORDS_THRESHOLD) {
        flags.add("excessive_filler_words");
        gaps.push({
          dimension: "communication clarity",
          expected: "≤3 fillers per 100 words. Pause instead of saying 'basically' / 'as such' / 'like'",
          observed: `User used filler ${fillerMatches.length} times across ${userWordCount} words (${fillerPer100.toFixed(1)} per 100)`,
          severity: "low",
        });
      }
    }

    // Mother-Tongue-Influence (MTI) deviations — count distinct pattern hits
    const mtiHits = MTI_PATTERNS.filter((rx) => rx.test(userText)).length;
    if (mtiHits >= 1) {
      flags.add("mti_pattern_detected");
      gaps.push({
        dimension: "communication clarity",
        expected: "Swap MTI phrases for standard professional phrasing — 'please do this' instead of 'kindly do the needful', 'I'm Rahul' instead of 'myself Rahul', 'I have a question' instead of 'I have a doubt'. ('Passed out' is fine — Indian recruiters accept it.)",
        observed: `User used ${mtiHits} Mother-Tongue-Influence phrase${mtiHits === 1 ? "" : "s"} — recruiters in tier-1 firms grade against these`,
        severity: mtiHits >= 3 ? "medium" : "low",
      });
    }

    // Low CGPA stated without framing context — tier-aware threshold.
    // Tier-1 global firms (Google/MS/Amazon India) typically gate at 7.5;
    // most others gate at 7.0; service-tier (TCS/Infosys/Wipro) at 6.5.
    const companyTier = classifyCompanyTier(session.target_company);
    const collegeTier = classifyCollegeTier(userText);
    /* Phase-3 — Persona archetype.
     *
     * companyTier is coarse (TCS == service). The archetype layer is
     * finer: TCS NQT Ninja (CGPA 6.0, basic coding) is a different
     * interview from TCS Digital (CGPA 7.5, deep DSA, 3x comp) even
     * though both classify as "service". The archetype overrides the
     * tier-derived CGPA cutoff when known and surfaces a label the
     * report can render ("TCS NQT (Ninja) / Infosys SE"). */
    const archetype = classifyCampusArchetype(session.target_company, `${aiText} ${userText}`);
    const archetypeCutoff = archetypeCgpaCutoff(archetype);
    const baseCgpaCutoff = archetypeCutoff !== null
      ? archetypeCutoff
      : (companyTier === "product-global" ? 7.5
        : companyTier === "service" ? 6.5
        : 7.0);
    // Tier-1 colleges (IIT/NIT/BITS/IIIT/IISc) get -0.5 leniency due to
    // harder grading curves. Tier-2 + unknown apply the baseline.
    const cgpaCutoff = baseCgpaCutoff + cgpaCutoffAdjustment(collegeTier);
    const cgpaMatch = userText.match(CGPA_STATED);
    /* Stash CGPA calibration on `result.meta` so the candidate sees the
     * exact cutoff they were graded against in the report — surfaces
     * the otherwise-invisible tier-adjustment math (TCS NQT base 6.0 →
     * tier-2 adjusted 5.5, etc.) instead of leaving them to guess. */
    const statedCgpaForMeta = cgpaMatch ? Number(cgpaMatch[1]) : NaN;
    // v6.6 — hoist bond probe count so it can be surfaced on meta
    // alongside archetype + cgpa info. The downstream bond block
    // (line ~770) re-uses the same value for its multi-probe gate.
    const bondProbeCount = transcript.filter((t) => isAi(t) && BOND_PROBE.test(t.text || "")).length;
    // v6.6 — aptitude probe expected type, derived from archetype, so
    // the LLM evaluator (and any downstream prompt-quality check) can
    // grade whether the generated probe actually matched what the
    // recruiter at this archetype would have asked. tcs-ninja /
    // tcs-digital expect cognitive-coding (SQL / strings / hashmap);
    // wipro-nlth expects classical puzzles (8 balls, 3 switches);
    // top-tier-campus skips the aptitude probe entirely. Anything
    // else: "either" (signal absent).
    const aptitudeProbeExpectedType: "cognitive-coding" | "classical-puzzle" | "none" | "either" =
      archetype === "tcs-ninja" || archetype === "tcs-digital" ? "cognitive-coding"
      : archetype === "wipro-nlth" ? "classical-puzzle"
      : archetype === "top-tier-campus" ? "none"
      : "either";
    result.meta = {
      ...(result.meta || {}),
      campusPlacement: {
        companyTier,
        collegeTier,
        baseCgpaCutoff,
        adjustedCgpaCutoff: cgpaCutoff,
        statedCgpa: Number.isFinite(statedCgpaForMeta) && statedCgpaForMeta > 0 ? statedCgpaForMeta : null,
        targetCompany: session.target_company || null,
        archetype,
        archetypeLabel: archetypeLabel(archetype),
        bondProbeCount,
        aptitudeProbeExpectedType,
      },
    };
    // v6.6 — college/TPO internal CGPA cutoff disclosure is valid
    // framing: it surfaces a structural constraint (e.g. "my college
    // won't send below 6.5" / "TPO cutoff is 7.0") that the recruiter
    // respects rather than penalises. Emit positive flag and treat
    // as framing context for `cgpa_low_no_framing` below.
    const collegeCgpaPolicyCited = COLLEGE_CGPA_POLICY.test(userText);
    if (collegeCgpaPolicyCited) {
      flags.add("college_cgpa_policy_acknowledged");
    }
    if (cgpaMatch) {
      const cgpa = Number(cgpaMatch[1]);
      if (cgpa > 0 && cgpa < cgpaCutoff && !CGPA_FRAMING_CONTEXT.test(userText) && !collegeCgpaPolicyCited) {
        flags.add("cgpa_low_no_framing");
        const tierNote = collegeTier === "tier-1"
          ? ` (already adjusted for ${collegeTier} grading curve)`
          : "";
        gaps.push({
          dimension: "framing",
          expected: `CGPA below ${cgpaCutoff.toFixed(1)} for this company tier${tierNote} needs a one-sentence honest reason + evidence of capability (project, internship, ranking improvement, hackathon)`,
          observed: `User stated CGPA ${cgpa.toFixed(1)} with no framing — below the typical threshold for ${companyTier === "product-global" ? "tier-1 global product firms" : companyTier === "service" ? "Indian IT services" : "this company tier"}${tierNote}`,
          severity: "high",
        });
      }
    }

    // College-tier signal as a standalone signal — used by the report to
    // calibrate the rest of the rubric (project depth, project specificity).
    // We surface a flag so downstream consumers (LLM evaluator, dashboard
    // chips) can read it without re-running the classifier.
    if (collegeTier === "tier-1") {
      flags.add("college_tier_1");
    } else if (collegeTier === "tier-2") {
      flags.add("college_tier_2");
    }

    // Phase-3 — surface the campus archetype as a flag so dashboard
    // chips + the LLM evaluator can branch on it without re-running
    // the classifier. `unknown` is intentionally NOT emitted (no
    // signal to render).
    if (archetype !== "unknown") {
      flags.add(`campus_archetype_${archetype.replace(/-/g, "_")}`);
    }

    // Reverse-questions: AI closed with "any questions for us?" — grade what came back.
    // We inspect the LAST user turn AFTER the latest reverse-question probe by the AI.
    let reverseProbeIdx = -1;
    transcript.forEach((t, idx) => { if (isAi(t) && REVERSE_QUESTION_PROBE.test(t.text || "")) reverseProbeIdx = idx; });
    // v6.6 — scan ALL user turns BEFORE the closing reverse-question slot
    // for any SPECIFIC question (tech stack, mentor, growth track, etc.).
    // Smart candidates often ask substantive questions mid-interview and
    // then say "no" / "all clear" at the formal closing — that's not
    // weak preparation, it's exhausted curiosity. Emit positive flag and
    // suppress `weak_reverse_questions` at any archetype when present.
    const beforeProbeUserText = reverseProbeIdx >= 0
      ? transcript.slice(0, reverseProbeIdx).filter(isUser).map((t) => t.text || "").join(" ")
      : "";
    const midSessionSpecificAsked =
      beforeProbeUserText.length > 0 &&
      REVERSE_QUESTION_SPECIFIC.test(beforeProbeUserText) &&
      /\?/.test(beforeProbeUserText);
    if (midSessionSpecificAsked) {
      flags.add("mid_session_questions_present");
    }
    // v6.7 — Short-screening session gate. Sub-10-turn transcripts are
    // typically HR screening / first-round skim, not full panels. Don't
    // ding the candidate for a missing closing slot or a single bond
    // probe in that format. Emit a positive informational flag so the
    // report can render the calibration explicitly.
    const isShortScreeningSession = transcript.length < 10;
    if (isShortScreeningSession) {
      flags.add("short_screening_session_acknowledged");
    }
    // v6.7 — Location-agnostic signal at tcs-digital. The Digital track
    // doesn't probe relocation explicitly; candidates who proactively
    // state any-location openness deserve credit.
    const locationAgnosticPresent = LOCATION_AGNOSTIC_SIGNAL.test(userText);
    if (locationAgnosticPresent) {
      flags.add("location_agnostic_signal");
    }
    if (reverseProbeIdx >= 0) {
      const afterProbe = transcript.slice(reverseProbeIdx + 1).filter(isUser).map((t) => t.text || "").join(" ");
      if (afterProbe) {
        if (REVERSE_QUESTION_DECLINED.test(afterProbe)) {
          if (!isShortScreeningSession) {
            flags.add("reverse_questions_declined");
            gaps.push({
              dimension: "preparation",
              expected: "Always have 2-3 prepared reverse-questions — about training program, tech stack, mentor structure, growth track, or something from the PPT",
              observed: "User declined the reverse-question slot ('No, I'm good') — reads as unprepared / disinterested",
              severity: "medium",
            });
          }
        } else if (REVERSE_QUESTION_GENERIC.test(afterProbe) && !REVERSE_QUESTION_SPECIFIC.test(afterProbe)) {
          // Phase-6 realism calibration: at TCS NQT / Wipro NLTH /
          // Cognizant loops, "what's the work culture?" is a perfectly
          // acceptable filler question — recruiters there expect safe,
          // table-stakes questions from freshers, not Razorpay-grade
          // product probes. We only fire `weak_reverse_questions` for
          // tcs-digital and top-tier-campus where the bar IS specific.
          // v6.6 — mid-session specific questions also suppress the
          // closing-slot weak flag (across archetypes). Smart candidates
          // ask substantive questions mid-interview and then close with
          // "all clear" — that pattern should not be docked.
          // v6.7 — Service-tier leniency extended to `cognizant-genc`
          // and `unknown` archetypes (we can't pin archetype; default
          // to leniency rather than docking a generic reverse question).
          // tcs-digital: location-agnostic statement is also a positive
          // signal that suppresses the closing-slot weak flag (the
          // candidate volunteered relocation context the Digital loop
          // would normally probe for).
          const reverseService = archetype === "tcs-ninja" || archetype === "wipro-nlth" || archetype === "cognizant-genc" || archetype === "unknown";
          const tcsDigitalLocationCovered = archetype === "tcs-digital" && locationAgnosticPresent;
          if (!reverseService && !midSessionSpecificAsked && !tcsDigitalLocationCovered) {
            flags.add("weak_reverse_questions");
            gaps.push({
              dimension: "preparation",
              expected: "Specific reverse-questions score: 'What's the typical TCS-Ignite cohort exit destination after the 2-year bond?' beats 'How is the work culture?'",
              observed: "User's reverse-questions were generic ('work culture' / 'growth opportunities') — weak tie-breaker signal",
              severity: "low",
            });
          }
        }
      } else {
        if (!isShortScreeningSession) {
          flags.add("reverse_questions_declined");
          gaps.push({
            dimension: "preparation",
            expected: "Always have 2-3 prepared reverse-questions — silence on the closer is a credibility hit",
            observed: "AI asked 'any questions for us?' — user gave no response",
            severity: "medium",
          });
        }
      }
    }

    // Bond / service-agreement probing — service-tier only.
    // v6.6 — `bond_unprepared` now requires ≥2 AI probes. Real loops
    // probe bond twice (once early as a screening, once again at
    // closure); a single probe with an "I don't know" reply is often
    // just the candidate caught off-guard, not unresearched. Refusal
    // remains a single-strike DQ — refusing outright doesn't get more
    // benign with more probes. `bondProbeCount` was hoisted earlier so
    // it could land on meta alongside archetype info.
    const aiBondProbed = bondProbeCount > 0;
    if (aiBondProbed) {
      const userBondText = transcript.filter(isUser).map((t) => t.text || "").join(" ");
      if (BOND_REFUSAL.test(userBondText)) {
        flags.add("bond_refusal");
        gaps.push({
          dimension: "preparation",
          expected: "Refusing the bond outright is an instant DQ at TCS/Infosys/Wipro. If genuinely concerned, frame as 'I'd like to understand the buyout terms' — never 'I won't sign'",
          observed: "User refused the service agreement outright — at service-tier firms this ends the interview",
          severity: "high",
        });
      } else if (bondProbeCount >= 2 && BOND_IGNORANCE.test(userBondText) && !BOND_HEALTHY_RESPONSE.test(userBondText) && !isShortScreeningSession) {
        // v6.7 — Short-screening sessions are excluded; a sub-10-turn
        // HR skim doesn't always reach a second bond probe meaningfully.
        flags.add("bond_unprepared");
        gaps.push({
          dimension: "preparation",
          expected: "Know the bond duration for your target company before the interview: TCS 2yr, Infosys 1yr, Wipro 15mo + ₹2L, Cognizant 1yr, HCL 1.5yr",
          observed: "User showed unfamiliarity with service-bond concept when asked — reads as unresearched",
          severity: "medium",
        });
      }
    }

    // Internship claimed but no detail given (resume padding signal)
    if (INTERNSHIP_CLAIM.test(userText) && !INTERNSHIP_DETAIL.test(userText) && userTurnCount >= 3) {
      flags.add("internship_unsubstantiated");
      gaps.push({
        dimension: "credibility",
        expected: "An internship mention should come with company, duration, deliverable, mentor, and a concrete output",
        observed: "User mentioned an internship but never named the company, deliverable, or impact",
        severity: "medium",
      });
    }

    // v6.6 — internship company plausibility (transcript-only). Fires
    // only when no resume is loaded (resume-aware path uses the stricter
    // `claimed_internship_not_in_resume` instead) AND the candidate
    // named ≥1 internship company AND none of the named companies match
    // any of the ~70 well-known Indian/global tech employers in the
    // `KNOWN_TECH_EMPLOYER` whitelist. Conservative — small legitimate
    // startups will fall through; we treat this as informational, not
    // disqualifying, until resume-cross-check can verify.
    if (!resume && INTERNSHIP_CLAIM.test(userText)) {
      const claimed = extractClaimedCompanies(userText);
      if (claimed.length > 0) {
        const anyKnown = claimed.some((c) => KNOWN_TECH_EMPLOYER.test(c));
        if (!anyKnown) {
          flags.add("internship_company_unrecognized");
          gaps.push({
            dimension: "credibility",
            expected: "When naming an internship company, prefer the full, recognised brand (e.g. 'Razorpay Software Pvt Ltd' / 'Infosys BPM'). Recruiters cross-check against BGV — unrecognised names invite a verification drill the candidate may not be able to defend.",
            observed: `Candidate named internship company/companies (${claimed.slice(0, 3).join(", ")}) that don't match any of the well-known Indian / global tech employers — informational, not yet verified against resume.`,
            severity: "low",
          });
        }
      }
    }

    /* ── Wave 3 detection: real-life campus edge cases ─────────────── */

    // Attrition risk — fresher signaling exit for higher studies within 1-2 yrs.
    // Exception: if candidate explicitly commits to honoring the bond/service period first,
    // that signals retention, not attrition.
    const honorsBond = /\b(?:after\s+(?:completing|finishing|fulfilling|honoring)\s+(?:my\s+)?(?:bond|service|2[- ]?year\s+commitment|two[- ]?year\s+commitment)|once\s+(?:my\s+)?bond\s+(?:is\s+)?(?:done|complete|over)|post[- ]?bond|after\s+the\s+bond)\b/i.test(userText);
    if (ATTRITION_HIGHER_STUDIES.test(userText) && !honorsBond) {
      flags.add("attrition_risk_higher_studies");
      gaps.push({
        dimension: "framing",
        expected: "Service-tier firms (TCS/Infosys/Wipro) won't hire candidates planning MBA/MS within the bond. If higher studies is a real plan, frame as 'I'd like to build a strong foundation here first' — not 'I'm joining for 2 years and then doing MBA'",
        observed: "User explicitly stated higher-studies plan (MBA/MS/GRE/CAT) within 1-2 years — strong attrition signal at service-tier",
        severity: companyTier === "service" ? "high" : "medium",
      });
    }

    // Relocation refusal — flat refusal to leave home city.
    const aiAskedRelocation = transcript.some((t) => isAi(t) && RELOCATION_PROBE.test(t.text || ""));
    if (RELOCATION_REFUSAL.test(userText)) {
      flags.add("relocation_refusal");
      gaps.push({
        dimension: "preparation",
        expected: "Refusing relocation outright is a dealbreaker at TCS/Infosys/Wipro/Cognizant (pan-India allocation). If you have a genuine constraint, soften: 'I have a strong preference for the South — could you walk me through how allocation works?'",
        observed: aiAskedRelocation
          ? "AI probed location flexibility — user refused outright. Pan-India service firms can't accommodate this."
          : "User volunteered relocation refusal unprompted — reads as unflexible / unaware",
        severity: companyTier === "service" ? "high" : "medium",
      });
    }

    // Night-shift / on-call refusal.
    const aiAskedShift = transcript.some((t) => isAi(t) && SHIFT_PROBE.test(t.text || ""));
    if (SHIFT_REFUSAL.test(userText)) {
      flags.add("shift_oncall_refusal");
      gaps.push({
        dimension: "preparation",
        expected: "Most service-tier and global-product firms have rotational/US-shift roles. Flat refusal closes doors. If you have a constraint (health/family), frame as 'I'd want to understand the rotation cadence' — not a flat no",
        observed: aiAskedShift
          ? "AI asked about shift flexibility — user refused outright"
          : "User volunteered shift refusal unprompted",
        severity: "medium",
      });
    }

    // Cliché strength/weakness — "perfectionist" / "work too hard".
    // Gate on the interviewer actually asking the probe so we don't fire
    // on a candidate volunteering the cliché in an unrelated story (rare,
    // but a real false-positive class without the gate).
    const aiAskedStrengthWeakness = transcript.some((t) => isAi(t) && STRENGTH_WEAKNESS_PROBE.test(t.text || ""));
    if (aiAskedStrengthWeakness && CLICHE_STRENGTH_WEAKNESS.test(userText)) {
      flags.add("cliche_strength_weakness");
      gaps.push({
        dimension: "specificity",
        expected: "Interviewers hear 'perfectionist' / 'work too hard' 5+ times a day. Pick a real, calibrated weakness with a concrete example of how you're working on it",
        observed: "User used a cliché strength/weakness ('perfectionist', 'work too hard', 'workaholic')",
        severity: "low",
      });
    }

    // "Tell me about yourself" → resume recital cue.
    const aiAskedTmay = transcript.some((t) => isAi(t) && TMAY_PROBE.test(t.text || ""));
    if (aiAskedTmay && RESUME_RECITAL.test(userText)) {
      flags.add("tmay_resume_recital");
      gaps.push({
        dimension: "communication clarity",
        expected: "'Tell me about yourself' is a structure question, not a resume recital. Use the 60-second frame: who-I-am → strongest project → why-this-role. The interviewer already has your resume.",
        observed: "User said 'as per my resume' / 'as you can see in my resume' — signals they're reading off the page",
        severity: "medium",
      });
    }

    // Career-goal probe answered with vague / non-specific language.
    const aiAskedCareerGoal = transcript.some((t) => isAi(t) && CAREER_GOAL_PROBE.test(t.text || ""));
    if (aiAskedCareerGoal && CAREER_GOAL_VAGUE.test(userText) && !CAREER_GOAL_SPECIFIC.test(userText)) {
      flags.add("career_goal_vague");
      gaps.push({
        dimension: "preparation",
        expected: "Pick a specific role/skill 3-5 years out: 'SDE-2 with deep ownership of a backend service' / 'tech lead in distributed systems' / 'product specialist in fintech'. Vague answers ('successful', 'in a senior position') signal no plan",
        observed: "AI asked about 5-year goal — user gave vague answer ('successful' / 'in a senior position' / 'wherever life takes me')",
        severity: "medium",
      });
    }

    // Hackathon claim without detail.
    if (HACKATHON_CLAIM.test(userText) && !HACKATHON_DETAIL.test(userText) && userTurnCount >= 3) {
      flags.add("hackathon_unsubstantiated");
      gaps.push({
        dimension: "credibility",
        expected: "A hackathon mention should come with: theme, team size, duration, what shipped, and rank/outcome. 'I participated in SIH' alone is resume padding.",
        observed: "User mentioned a hackathon / coding contest but gave no rank, prize, team size, or what was built",
        severity: "low",
      });
    }

    // Buzzword soup — listing many trendy areas without an anchor project.
    const buzzwordHits = (userText.match(BUZZWORD) || []);
    const uniqueBuzzwords = new Set(buzzwordHits.map((s) => s.toLowerCase().replace(/\s+/g, " ").trim()));
    if (uniqueBuzzwords.size >= 5 && !TECH_STACK.test(userText)) {
      flags.add("buzzword_soup");
      gaps.push({
        dimension: "specificity",
        expected: "Listing 5+ trendy areas ('AI, ML, blockchain, IoT, cloud, web3') without a single concrete project reads as a buzzword resume. Pick ONE area you've actually built in",
        observed: `User listed ${uniqueBuzzwords.size} trendy areas (AI/ML/blockchain/IoT/etc.) with no concrete tech stack to back any of them`,
        severity: "medium",
      });
    }

    // Family-pressure framing — unprofessional in interview context.
    if (FAMILY_PRESSURE.test(userText)) {
      flags.add("family_pressure_framing");
      gaps.push({
        dimension: "professionalism",
        expected: "Never frame career choice as parent-driven ('my parents wanted me to do engineering'). Own the choice: 'I picked CS because I enjoyed the problem-solving in 12th-grade physics'",
        observed: "User attributed career choice to parents/family pressure — signals lack of ownership",
        severity: "medium",
      });
    }

    // Negative compare to another company.
    if (NEGATIVE_COMPARE.test(userText)) {
      flags.add("negative_company_compare");
      gaps.push({
        dimension: "professionalism",
        expected: "Never disparage other companies in an interview, even competitors. If asked 'why us over X?', name what excites you about THIS company — don't trash the other",
        observed: "User compared the target company unfavourably to another firm (or vice versa) — reads as immature",
        severity: "medium",
      });
    }

    // Inflated salary expectation for a campus fresher.
    const aiAskedSalary = transcript.some((t) => isAi(t) && SALARY_EXPECTATION_PROBE.test(t.text || ""));
    // Service-tier campus fresher band ≈ ₹3.5-4.5L; product-india ≈ ₹6-15L;
    // product-global ≈ ₹15-30L. Any single-digit fresher quoting >2x is inflated.
    const salaryInflatedCutoff = companyTier === "product-global" ? 35
      : companyTier === "product-india" ? 20
      : companyTier === "service" ? 8
      : 12;
    if (aiAskedSalary) {
      const salaryMatch = userText.match(SALARY_NUMBER_LPA);
      if (salaryMatch) {
        const lpa = Number(salaryMatch[1]);
        if (lpa >= salaryInflatedCutoff) {
          flags.add("salary_expectation_inflated");
          gaps.push({
            dimension: "preparation",
            expected: `Campus fresher band for this tier sits well below ${salaryInflatedCutoff} LPA. Either anchor to glassdoor/levels.fyi data, or defer politely: 'I'm flexible and trust the standard fresher band — I'd like to learn more about the role'`,
            observed: `User quoted ${lpa} LPA — well above typical fresher campus offer for ${companyTier === "service" ? "service-tier" : companyTier === "product-india" ? "Indian product" : companyTier === "product-global" ? "global product India" : "this"} firms`,
            severity: "medium",
          });
        }
      }
    }

    // User raised salary in the first 4 user turns, before AI did.
    const aiTurnsRaisingSalary = transcript
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => isAi(t) && (SALARY_EXPECTATION_PROBE.test(t.text || "") || USER_SALARY_RAISED.test(t.text || "")));
    const firstAiSalaryIdx = aiTurnsRaisingSalary.length > 0 ? aiTurnsRaisingSalary[0].idx : Number.POSITIVE_INFINITY;
    const userTurnsWithIdx = transcript
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => isUser(t));
    for (let i = 0; i < Math.min(userTurnsWithIdx.length, 4); i += 1) {
      const { t, idx } = userTurnsWithIdx[i];
      if (idx < firstAiSalaryIdx && USER_SALARY_RAISED.test(t.text || "")) {
        flags.add("salary_raised_too_early");
        gaps.push({
          dimension: "preparation",
          expected: "Don't bring up salary in the technical / first round. Wait for HR / final round, or until the interviewer raises it. Asking 'what's the CTC' in turn 2 of a tech round signals wrong priorities",
          observed: "User asked about salary/CTC in the first 4 turns, before the AI raised compensation — wrong round for this question",
          severity: "medium",
        });
        break;
      }
    }

    // v6.7 — Shipped-to-prod context as a positive signal. Distinct from
    // PORTFOLIO_LINK (which is a URL): this captures "we shipped it and
    // users used it" — production deploys, active users, merged PRs.
    // At product-grade archetypes (top-tier-campus / tcs-digital) this
    // is a higher-credibility substitute for a GitHub link.
    const shippedToProdPresent = SHIPPED_TO_PROD_CONTEXT.test(userText) && (PROJECT_NARRATION.test(userText) || INTERNSHIP_CLAIM.test(userText));
    if (shippedToProdPresent) {
      flags.add("shipped_to_prod_context");
    }

    // Portfolio absence — claimed to build something but no public artifact link.
    // v6.7 — At product-grade archetypes (top-tier-campus / tcs-digital),
    // a `shipped_to_prod_context` signal counts as credibility substitute
    // for the missing portfolio link (the candidate's evidence is "real
    // users ship", not "here's a repo URL").
    const productGradeArchetype = archetype === "top-tier-campus" || archetype === "tcs-digital";
    if (
      CLAIMED_BUILT.test(userText) &&
      !PORTFOLIO_LINK.test(userText) &&
      userTurnCount >= 3 &&
      (PROJECT_NARRATION.test(userText) || INTERNSHIP_CLAIM.test(userText)) &&
      !(productGradeArchetype && shippedToProdPresent)
    ) {
      flags.add("portfolio_absent_for_claim");
      gaps.push({
        dimension: "credibility",
        expected: "When narrating a project, drop a github/live-demo/portfolio link in the same turn. 'Source is on my GitHub at /username/repo' or 'live demo at xyz.vercel.app' adds 10x credibility over a verbal claim",
        observed: "User claimed to have built / shipped a project but never referenced GitHub, a live demo, a hosted URL, or any public artifact",
        severity: "low",
      });
    }

    /* ── Wave-4 detection: deeper Indian campus realism ───────────────── */

    // Active backlog evasion (service-tier dealbreaker). Phase-5
    // adds the symmetric POSITIVE signal `backlog_honest_disclosure`
    // when the candidate gives a clean, unhedged answer on the same
    // probe — recruiters explicitly reward this in service-tier loops.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!isAi(t) || !BACKLOG_PROBE.test(t.text || "")) continue;
      const reply = transcript.slice(i + 1, i + 3).find(isUser);
      if (!reply || !reply.text) continue;

      // Single decision tree — evasive and clean are mutually exclusive
      // by construction. If both match (e.g. "no backlogs but maybe one
      // pending"), evasive wins (recruiter ear hears the hedge first).
      const evasive = BACKLOG_EVASIVE.test(reply.text);
      const clean = BACKLOG_CLEAN.test(reply.text);
      if (evasive) {
        flags.add("active_backlog_evasion");
        gaps.push({
          dimension: "preparation",
          expected: "Service-tier firms have a no-active-backlog rule. State your exact standing crisply: 'Zero active backlogs, cleared one supplementary in 2nd year, all subjects passed.'",
          observed: "Candidate hedged on the backlog probe — recruiters flag this as either active arrears or evasion. Both are dealbreakers at TCS/Infosys/Wipro/Cognizant.",
          severity: "high",
        });
      } else if (clean) {
        // Phase-5 positive signal — candidate answered the backlog
        // probe with a crisp, unhedged clean disclosure. Surfaces
        // as a green chip on the report and a positive note for the
        // LLM evaluator to lift the score.
        flags.add("backlog_honest_disclosure");
      }
      break;
    }

    // Branch-jump narrative — non-CS branch + SDE role + no learning story.
    if (NONCS_BRANCH.test(userText) && /\b(?:sde|software\s+(?:dev|engineer)|backend|frontend|full[- ]?stack|developer|swe\b|programmer)\b/i.test(`${userText} ${aiText}`) && !BRANCH_LEARNING_NARRATIVE.test(userText) && userTurnCount >= 3) {
      flags.add("branch_jump_thin_narrative");
      gaps.push({
        dimension: "credibility",
        expected: "Non-CS branch applying to SDE? Lead with the bridge: a course (CS50 / Striver SDE Sheet / NPTEL), N self-built projects, and what clicked. 'I'm Mech but did CS50, built 4 projects, switched because systems thinking translates.'",
        observed: "Candidate mentioned a non-CS branch + SDE-track role but never explained the learning bridge (self-study course, projects, certifications) — reads as opportunistic.",
        severity: "medium",
      });
    }

    // PPT recall absent — substantial transcript with no PPT/launch reference.
    if (userTurnCount >= 4 && !PPT_REFERENCE.test(userText) && (companyTier === "service" || companyTier === "product-india" || companyTier === "product-global")) {
      flags.add("ppt_recall_absent");
      gaps.push({
        dimension: "preparation",
        expected: "Reference something from the pre-placement talk (a speaker name, a recent launch, the program name like 'Infosys Springboard' or 'Wipro Turbo'). Shows you listened.",
        observed: "Substantial interview turns but candidate never referenced the PPT, the speaker, or a recent company-specific launch — signals low pre-interview engagement.",
        severity: "low",
      });
    }

    // Coding-round score undefended.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && CODING_SCORE_PROBE.test(t.text || "")) {
        const reply = transcript.slice(i + 1, i + 3).find(isUser);
        if (reply && reply.text && reply.text.length < 280 && !CODING_SCORE_RATIONALE.test(reply.text)) {
          flags.add("coding_round_score_undefended");
          gaps.push({
            dimension: "credibility",
            expected: "Own the gap with one honest sentence + one recent-evidence sentence: 'Time pressure on the last problem; since then I've solved 200+ on Leetcode, currently Knight on Codeforces.' Defends without excusing.",
            observed: "AI probed a low coding round score; candidate had no rationale or recent-evidence answer.",
            severity: "medium",
          });
          break;
        }
      }
    }

    // Parallel exam prep — attrition signal at service-tier.
    if (PARALLEL_EXAM_PREP.test(userText)) {
      flags.add("parallel_exam_prep_disclosed");
      gaps.push({
        dimension: "framing",
        expected: "Don't volunteer GATE / CAT / UPSC parallel prep in a service-tier interview. If asked directly, frame as: 'I'd like to first build a strong foundation here; long-term plans are flexible.'",
        observed: "Candidate disclosed parallel exam prep (GATE/CAT/UPSC/GRE) — recruiters at service-tier discount this as 1-2 year attrition risk.",
        severity: companyTier === "service" ? "high" : "medium",
      });
    }

    // Tier-3 overcompensation — unknown college + grandiose claim.
    if (collegeTier === "unknown" && GRANDIOSE_CLAIM.test(userText)) {
      flags.add("tier_3_overcompensation");
      gaps.push({
        dimension: "credibility",
        expected: "Calibrate claims to evidence. 'Top 5 in my college hackathon (40 teams)' beats 'national hackathon winner' if the former is what actually happened. Interviewers verify with one specific drill-down.",
        observed: "Candidate made a grandiose national/global achievement claim that doesn't match the rest of the context — invites a verification probe the candidate is unlikely to defend.",
        severity: "medium",
      });
    }

    // FYP solo claim vs team mention — contradiction.
    if (FYP_SOLO_CLAIM.test(userText) && FYP_TEAM_MENTION.test(userText)) {
      flags.add("fyp_solo_claim_vs_team");
      gaps.push({
        dimension: "credibility",
        expected: "Be precise on contribution: 'In our 4-person FYP team I owned the backend (FastAPI + Postgres); teammates handled the React frontend and the ML model.' Mixing 'I built' with 'we presented' invites a 'who did what exactly' drill.",
        observed: "Candidate said 'I built' the FYP but elsewhere referenced a team — Indian campus interviewers will probe individual contribution.",
        severity: "medium",
      });
    }

    // Stipend dodge — AI probes intern stipend, user hedges.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && STIPEND_PROBE.test(t.text || "")) {
        const reply = transcript.slice(i + 1, i + 3).find(isUser);
        if (reply && reply.text && STIPEND_DODGE.test(reply.text) && !STIPEND_CONCRETE.test(reply.text)) {
          flags.add("stipend_dodge");
          gaps.push({
            dimension: "credibility",
            expected: "Stipend is a routine probe — state the number cleanly. '₹25,000 / month at the startup, unpaid academic internship at the lab (mentored by Prof. X)'. Hedging here signals fabrication.",
            observed: "Candidate hedged on a stipend question — recruiters use this as a fabrication tell; even unpaid internships should be stated openly with context.",
            severity: "medium",
          });
          break;
        }
      }
    }

    /* ── Wave-5 detection: softer-signal Indian campus realism ──────── */

    // Memorized self-intro — multiple template phrases in the TMAY reply.
    if (TMAY_PROBE.test(aiText)) {
      const tmayIdx = transcript.findIndex((t) => isAi(t) && TMAY_PROBE.test(t.text || ""));
      const r = tmayIdx >= 0 ? transcript.slice(tmayIdx + 1, tmayIdx + 3).find(isUser) : undefined;
      if (r && r.text) {
        const reText = new RegExp(MEMORIZED_TEMPLATE.source, "gi");
        const matches = r.text.match(reText) || [];
        if (matches.length >= 2) {
          flags.add("memorized_self_intro");
          gaps.push({
            dimension: "specificity",
            expected: "Rewrite the self-intro in your own voice with one concrete project + outcome. Verbatim 'first of all I'd like to thank you for this opportunity, coming to my introduction' reads as cassette-tape.",
            observed: "Self-intro reply hit multiple memorized-template phrases (e.g. 'first of all thank you', 'coming to my introduction', 'talking about my family') — Indian recruiters now flag this template as no-thought signal.",
            severity: "medium",
          });
        }
      }
    }

    // Aptitude / on-spot puzzle refusal. Phase-5 also surfaces an
    // APTITUDE-TO-PROJECT CONSISTENCY signal: when the candidate
    // refuses a live puzzle AND elsewhere claimed substantial project
    // depth (TECH_APPLIED evidence or a portfolio link), the two
    // claims are inconsistent — recruiters drill exactly this gap
    // ("you shipped a FastAPI service but can't reason about 8 balls?").
    let aptitudeRefusedAt = -1;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && APTITUDE_LIVE_PROBE.test(t.text || "")) {
        const reply = transcript.slice(i + 1, i + 3).find(isUser);
        if (reply && reply.text && APTITUDE_REFUSAL.test(reply.text)) {
          aptitudeRefusedAt = i;
          flags.add("aptitude_puzzle_refusal");
          // v6.7 — tcs-digital is offline-coding-format (the live loop
          // doesn't dwell on classical puzzles); downgrade severity so
          // the report reflects the rubric the Digital track actually
          // grades against. Other archetypes keep the "high" severity.
          // v6.8 — extend the offline-coding-format leniency: tcs-ninja
          // (NQT) is also an online-aptitude-then-live-coding loop where
          // the LIVE round rarely dwells on classical puzzles, so a
          // puzzle refusal in the mock there reads "medium" rather than
          // "high". `unknown` picks up the same medium severity — when
          // we can't pin the archetype we shouldn't slam a fresher at
          // full "high" for refusing a probe whose format we can't
          // verify against the actual loop. `wipro-nlth` and
          // `cognizant-genc` keep "high" — their live loops genuinely
          // do test classical puzzles.
          const aptitudeSeverity: "low" | "medium" | "high" =
            archetype === "tcs-digital" ? "low"
            : archetype === "tcs-ninja" || archetype === "unknown" ? "medium"
            : "high";
          gaps.push({
            dimension: "preparation",
            expected: "Even if stuck, narrate your thinking aloud — 'Let me think out loud: 8 balls, two weighings, so each weighing has to split into 3 buckets...' Interviewers grade approach, not perfection. Flat refusal loses 100% of marks.",
            observed: "Candidate refused or stalled on a live puzzle / DSA / estimation question — reads as inflexible or unprepared.",
            severity: aptitudeSeverity,
          });
          break;
        }
      }
    }
    if (
      aptitudeRefusedAt >= 0 &&
      (TECH_APPLIED.test(userText) || PORTFOLIO_LINK.test(userText))
    ) {
      flags.add("aptitude_project_inconsistency");
      gaps.push({
        dimension: "credibility",
        expected: "If you actually shipped the project you described, a 60-second aptitude question should not be a wall. Anchor the refusal: 'Let me try — I ship in code, so let me reason through it like a debugger.' Refusing while claiming depth invites the recruiter to discount the project.",
        observed: "Candidate refused a live aptitude / puzzle probe but earlier claimed substantial project depth (applied tech stack or portfolio link). The two signals don't fit — recruiters interpret this as either an inflated project claim or an unwillingness to think on the spot.",
        severity: "high",
      });
    }

    // Onsite / foreign opportunity premature — fresher asks within first 3 turns.
    {
      const userTurnIdxs: number[] = [];
      transcript.forEach((t, idx) => { if (isUser(t)) userTurnIdxs.push(idx); });
      const earlyTurns = userTurnIdxs.slice(0, 3);
      if (earlyTurns.some((idx) => ONSITE_QUERY.test(transcript[idx].text || ""))) {
        flags.add("onsite_opportunity_premature");
        gaps.push({
          dimension: "framing",
          expected: "Don't bring up onsite / US deputation in early turns — service-tier recruiters read this as offer-shopping. Hold it for HR / post-offer conversations; phrase as: 'I'd love to understand how growth and global rotations work over the first 2-3 years — but happy to discuss when we get there.'",
          observed: "Candidate asked about onsite / foreign deputation in the first 3 user turns — wrong round for this question.",
          severity: companyTier === "service" ? "high" : "medium",
        });
      }
    }

    // Nepotism reference — relative working at the company.
    if (NEPOTISM_MENTION.test(userText)) {
      flags.add("nepotism_reference");
      gaps.push({
        dimension: "professionalism",
        expected: "Never mention a relative / family-friend at the company unsolicited — even as small-talk. It activates explicit anti-nepotism filters at most Indian firms and is forbidden outright at PSU / consulting / Big-4. If discovered through BGV that's fine; volunteering it isn't.",
        observed: "Candidate volunteered that a relative / family-friend works at the company — recruiters log this as a nepotism signal.",
        severity: "medium",
      });
    }

    // In-hand vs CTC confusion.
    if (INHAND_CTC_CONFUSION.test(userText)) {
      flags.add("inhand_vs_ctc_confusion");
      gaps.push({
        dimension: "preparation",
        expected: "Know the Indian fresher CTC structure before the interview: CTC = fixed + variable + joining bonus + RSU/ESOP + benefits + (sometimes) retentions. In-hand is roughly 70-78% of fixed after taxes, EPF, and professional tax. Asking 'isn't CTC the same as in-hand' tells recruiters you didn't prepare.",
        observed: "Candidate showed explicit CTC vs in-hand confusion — reads as financial-literacy gap and unprofessional in an offer-conversation.",
        severity: "low",
      });
    }

    // Code-on-paper / whiteboard freeze.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && CODE_WRITE_PROBE.test(t.text || "")) {
        const reply = transcript.slice(i + 1, i + 3).find(isUser);
        if (reply && reply.text && CODE_WRITE_REFUSAL.test(reply.text)) {
          flags.add("code_on_paper_freeze");
          gaps.push({
            dimension: "preparation",
            expected: "Practice writing 20-line solutions on paper / chat / whiteboard during prep. 'I can only code in an IDE' tells the interviewer you've memorized templates without internalizing logic.",
            observed: "Candidate refused to write code without an IDE — interviewers grade this as superficial DSA prep.",
            severity: "high",
          });
          break;
        }
      }
    }

    // Resume date inconsistency — overlapping month-year ranges.
    {
      const monthMap: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      const ranges: Array<{ start: number; end: number }> = [];
      const reAll = new RegExp(MONTH_YEAR_RANGE.source, "gi");
      let m: RegExpExecArray | null;
      while ((m = reAll.exec(userText)) !== null) {
        const sMonth = monthMap[m[1].slice(0, 3).toLowerCase()];
        const sYear = Number(m[2]);
        const eMonth = monthMap[m[3].slice(0, 3).toLowerCase()];
        const eYear = Number(m[4]);
        if (sMonth && eMonth) {
          ranges.push({ start: sYear * 12 + sMonth, end: eYear * 12 + eMonth });
        }
      }
      let overlap = false;
      for (let i = 0; i < ranges.length && !overlap; i++) {
        for (let j = i + 1; j < ranges.length && !overlap; j++) {
          const a = ranges[i], b = ranges[j];
          if (a.start <= b.end && b.start <= a.end && !(a.start === b.start && a.end === b.end)) overlap = true;
        }
      }
      if (overlap) {
        flags.add("resume_date_inconsistency");
        gaps.push({
          dimension: "credibility",
          expected: "Internship / project dates must not overlap (unless explicitly part-time + disclosed). Two overlapping full-time windows trip BGV instantly and read as resume fabrication.",
          observed: "Two month-year ranges in the candidate's narration overlap — interviewers will probe and BGV will surface this.",
          severity: "high",
        });
      }
    }

    // Degree / branch inconsistency — two different branch names in user text.
    {
      const seen = new Set<string>();
      const reBranch = new RegExp(BRANCH_NAME.source, "gi");
      let bm: RegExpExecArray | null;
      while ((bm = reBranch.exec(userText)) !== null) {
        const key = bm[0].toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
        // Canonicalize close-matches so cse / computerscience / computerscienceandengineering all map together.
        let canon = key;
        if (/^c(omputer)?s(cience)?(?:andengineering)?$/.test(key) || key === "cse") canon = "cse";
        else if (/^i(nformation)?t(echnology)?$/.test(key) || key === "it") canon = "it";
        else if (/^i(nformation)?s(cience)?$/.test(key) || key === "is") canon = "is";
        else if (/^e(lectronics)?c(ommunication)?e?$/.test(key) || key === "ece") canon = "ece";
        else if (/^e(lectrical)?e(lectronics)?e?$/.test(key) || key === "eee") canon = "eee";
        else if (/^mech(anical)?(engineering)?$/.test(key)) canon = "mech";
        else if (/^civil(engineering)?$/.test(key)) canon = "civil";
        else if (/^chem(ical|engg)?(engineering)?$/.test(key)) canon = "chem";
        else if (/^biotech(nology)?$/.test(key)) canon = "biotech";
        else if (/^aiml$|^a(rtificial)?i(ntelligence)?m(achine)?l(earning)?$/.test(key)) canon = "aiml";
        else if (/^aids$|^a(rtificial)?i(ntelligence)?d(ata)?s(cience)?$/.test(key)) canon = "aids";
        else if (/^datascience(engineering|branch)?$/.test(key)) canon = "datascience";
        seen.add(canon);
      }
      if (seen.size >= 2 && !DUAL_DEGREE_CONNECTOR.test(userText)) {
        flags.add("degree_branch_inconsistency");
        gaps.push({
          dimension: "credibility",
          expected: "Be precise about your branch — pick the exact name on your transcript and stick with it. If you have a minor or dual-degree, say so explicitly: 'CSE major with an AIML minor'. Drifting between 'I'm in CSE' and 'I'm in AIML' reads as either confusion or fabrication.",
          observed: `Candidate referenced multiple branches across the transcript (${Array.from(seen).join(", ")}) without a minor / dual-degree explanation.`,
          severity: "medium",
        });
      }
    }

    /* ── Wave-6 detection: resume cross-checks ────────────────────────
     * These only run when the cron successfully loaded the resume by
     * resume_version_id. Otherwise we silently skip — analyzer must
     * still produce useful output on transcript-only data. */
    if (resume) {
      // 1) Internship company cross-check.
      // Candidate says "I interned at Razorpay" but Razorpay isn't on
      // their resume → high-signal credibility issue. Soft match
      // (normalized substring either direction) to tolerate "Razorpay"
      // vs "Razorpay Software Pvt Ltd". Only fire when the resume
      // actually has at least one experience entry — otherwise we
      // can't distinguish "fabricated" from "resume missing data".
      if (Array.isArray(resume.experiences) && resume.experiences.length > 0) {
        const resumeCompanies = resume.experiences
          .map((e) => normalizeCompanyName(e?.company))
          .filter((s) => s.length >= 3);
        const claimed = extractClaimedCompanies(userText);
        const unverified: string[] = [];
        for (const c of claimed) {
          const norm = normalizeCompanyName(c);
          if (!norm) continue;
          const present = resumeCompanies.some((r) => r === norm || r.includes(norm) || norm.includes(r));
          if (!present) unverified.push(c);
        }
        if (unverified.length > 0) {
          flags.add("claimed_internship_not_in_resume");
          gaps.push({
            dimension: "credibility",
            expected: "Every company / internship mentioned in the interview must already appear on the resume. BGV will pull the resume as source-of-truth — narrating a role that isn't listed reads as fabrication and is the #1 disqualifier in Indian campus drives.",
            observed: `Candidate referenced ${unverified.length === 1 ? "a company" : "companies"} not present in their uploaded resume: ${unverified.slice(0, 3).join(", ")}.`,
            severity: "high",
            flag: "claimed_internship_not_in_resume",
          });
        }
      }

      // 2) Branch mismatch with resume's degree.
      // If the resume's education entry canonicalizes to e.g. "mech"
      // but the candidate consistently says "I'm in CSE", that's a
      // bigger tell than the transcript-only branch-drift check —
      // the resume is the authoritative source.
      const resumeBranch = canonicalizeBranch(resume.degree);
      if (resumeBranch) {
        // Reuse the BRANCH_NAME regex collected earlier in the Wave-5
        // block by scanning userText. Canonicalize each hit with the
        // shared helper so the comparison is apples-to-apples.
        const spokenBranches = new Set<string>();
        const reB = new RegExp(BRANCH_NAME.source, "gi");
        let bm2: RegExpExecArray | null;
        while ((bm2 = reB.exec(userText)) !== null) {
          const canon = canonicalizeBranch(bm2[0]);
          if (canon) spokenBranches.add(canon);
        }
        // Only fire if the spoken set is non-empty and excludes the
        // resume branch entirely — i.e. the candidate is speaking a
        // branch they don't have on paper. Mentioning the resume
        // branch alongside others is handled by degree_branch_inconsistency.
        if (spokenBranches.size > 0 && !spokenBranches.has(resumeBranch) && !DUAL_DEGREE_CONNECTOR.test(userText)) {
          flags.add("branch_mismatch_with_resume");
          gaps.push({
            dimension: "credibility",
            expected: `Match the branch you spoke about (${Array.from(spokenBranches).join(", ")}) with what's on your resume (${resumeBranch}). The resume is the BGV-checked source of truth — a verbal branch change without "dual-degree" / "minor in" framing reads as fabrication.`,
            observed: `Resume lists ${resumeBranch} but candidate identified as ${Array.from(spokenBranches).join(", ")} in the transcript.`,
            severity: "high",
            flag: "branch_mismatch_with_resume",
          });
        }
      }

      // 3) Grad-year mismatch with resume.
      // Resume.gradYear is the BGV-checked source of truth. If the
      // candidate states a different year in the transcript ("I'll
      // graduate in 2025" but resume says 2024), that's a credibility
      // hit. We tolerate ±1 (legitimate spillover semester) before
      // flagging.
      if (resume.gradYear && /^20\d{2}$/.test(resume.gradYear)) {
        const resumeYear = parseInt(resume.gradYear, 10);
        const spokenYears = new Set<number>();
        const yearRe = /\b(?:graduat(?:e|ing|ed|ion)|passing|passout|pass[- ]out|batch|class of)\b[^.?!]{0,40}\b(20\d{2})\b|\b(20\d{2})\s*(?:batch|passout|pass[- ]out|grad)/gi;
        let ym: RegExpExecArray | null;
        while ((ym = yearRe.exec(userText)) !== null) {
          const y = parseInt(ym[1] || ym[2], 10);
          if (y >= 2015 && y <= 2030) spokenYears.add(y);
        }
        const driftedYears = Array.from(spokenYears).filter((y) => Math.abs(y - resumeYear) > 1);
        if (driftedYears.length > 0) {
          flags.add("grad_year_mismatch_with_resume");
          gaps.push({
            dimension: "credibility",
            expected: `The graduation year you stated (${driftedYears.join(", ")}) should match what's on your resume (${resumeYear}). BGV pulls the resume — a verbal year drift > 1 year reads as fabrication and disqualifies in service-tier rounds.`,
            observed: `Resume lists graduation year ${resumeYear}, but candidate mentioned ${driftedYears.join(", ")} in the transcript.`,
            severity: "high",
            flag: "grad_year_mismatch_with_resume",
          });
        }
      }

      // 4) College mismatch with resume.
      // Resume.school is the source of truth. Tolerate aliases (IIT
      // Bombay vs IITB, VIT vs VIT Vellore) by canonicalising both
      // sides via classifyCollegeTier — if both sides land on the
      // same tier-1/tier-2 bucket OR the normalized substring matches
      // either way, we treat as same college. Otherwise flag.
      if (resume.school && resume.school.length >= 3) {
        const resumeSchoolNorm = resume.school.toLowerCase().replace(/[^a-z0-9]/g, "");
        const resumeTier = classifyCollegeTier(resume.school);
        // Detect college mentions in transcript. Two patterns:
        //   (a) Tier-1/2 acronym + city — "IIT Bombay", "NIT Surathkal",
        //       "BITS Pilani", "IIIT Hyderabad". Acronym at start of span.
        //   (b) After a preposition ("from", "at", "studied at"…) a longer
        //       name ending in University / College / Institute.
        const mentions: string[] = [];
        const acronymRe = /\b(IIT|NIT|IIIT|BITS|IISc|IIM)\b[\s-]*([A-Za-z][A-Za-z .'-]{2,40})/g;
        let am: RegExpExecArray | null;
        while ((am = acronymRe.exec(userText)) !== null) {
          mentions.push(`${am[1]} ${am[2]}`.trim());
        }
        const collegeMentionRe = /\b(?:from|at|studied at|graduated from|i'?m at|i'?m in|i'?m from)\s+([A-Za-z][A-Za-z& .'-]{4,60}(?:university|college|institute)[A-Za-z &.,'-]{0,40})/gi;
        let cm: RegExpExecArray | null;
        while ((cm = collegeMentionRe.exec(userText)) !== null) {
          const m = cm[1].trim();
          if (m.length >= 4) mentions.push(m);
        }
        const mismatched: string[] = [];
        for (const m of mentions) {
          const mNorm = m.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!mNorm) continue;
          // Same college if normalized strings overlap either way.
          if (resumeSchoolNorm.includes(mNorm) || mNorm.includes(resumeSchoolNorm)) continue;
          // Same college if both canonicalise to the same tier-1/tier-2 bucket
          // AND the bucket isn't "unknown" (otherwise every state college
          // collides). Tier overlap on tier-1/-2 only.
          const mTier = classifyCollegeTier(m);
          if (mTier !== "unknown" && mTier === resumeTier && mTier === classifyCollegeTier(`${resume.school} ${m}`)) continue;
          mismatched.push(m);
        }
        if (mismatched.length > 0) {
          flags.add("college_mismatch_with_resume");
          gaps.push({
            dimension: "credibility",
            expected: `The college you named (${mismatched.slice(0, 2).join(", ")}) should match what's on your resume (${resume.school}). Indian campus BGV pulls the transcript / certificate — a verbal swap reads as fabrication.`,
            observed: `Resume lists ${resume.school}, but candidate mentioned ${mismatched.slice(0, 2).join(", ")} in the transcript.`,
            severity: "high",
            flag: "college_mismatch_with_resume",
          });
        }
      }

      // 5) CGPA mismatch with resume.
      // Resume.cgpa is BGV-checked (transcript / provisional). If the
      // candidate verbally claims a CGPA > 0.5 points off (or > 5% for
      // percentage scales), flag — recruiters do verify against the
      // transcript. Tolerate small drift (rounding, latest-semester SGPA
      // movement). Skip entirely if resume CGPA is unparseable.
      if (resume.cgpa) {
        const resumeCgpa = parseFloat(resume.cgpa);
        if (!Number.isNaN(resumeCgpa) && resumeCgpa > 0) {
          const isPercentScale = resumeCgpa > 10;
          const tolerance = isPercentScale ? 5 : 0.5;
          // Patterns: "my CGPA is 8.2", "I have 7.4 CGPA", "8.7 out of 10",
          // "scored 84%". Plausibility-filter to the resume's own scale.
          const cgpaRe = /\b(?:cgpa|gpa|sgpa)\s*(?:is|of|:|stands at|currently)?\s*(\d{1,2}(?:\.\d{1,2})?)\b|\b(\d{1,2}\.\d{1,2})\s*(?:cgpa|gpa|sgpa|\/\s*10|out of (?:ten|10))\b|\b(?:scored|got|secured|with)\s+(\d{2,3})\s*(?:%|percent)\b/gi;
          const spoken: number[] = [];
          let cm2: RegExpExecArray | null;
          while ((cm2 = cgpaRe.exec(userText)) !== null) {
            const v = parseFloat(cm2[1] || cm2[2] || cm2[3]);
            if (Number.isNaN(v)) continue;
            if (isPercentScale && v >= 30 && v <= 100) spoken.push(v);
            else if (!isPercentScale && v >= 4 && v <= 10) spoken.push(v);
          }
          const drifted = spoken.filter((v) => Math.abs(v - resumeCgpa) > tolerance);
          if (drifted.length > 0) {
            flags.add("cgpa_mismatch_with_resume");
            gaps.push({
              dimension: "credibility",
              expected: `The CGPA you stated (${drifted.map((d) => d.toFixed(2)).join(", ")}) should match what's on your resume (${resumeCgpa}). Recruiters verify CGPA against the transcript / provisional — even a 1-point drift will trip BGV.`,
              observed: `Resume lists CGPA ${resumeCgpa}, but candidate mentioned ${drifted.map((d) => d.toFixed(2)).join(", ")} in the transcript.`,
              severity: "high",
              flag: "cgpa_mismatch_with_resume",
            });
          }
        }
      }

      // 5.5) Internship duration mismatch with resume.
      // Resume's experience.period is the BGV-checked window. If the
      // candidate verbally says "I was there for six months" near a
      // company name but the resume shows a 3-month range, flag —
      // recruiters routinely cross-check duration against the offer
      // letter / relieving letter. We require BOTH an absolute drift
      // > 2 months AND a relative drift > 30% to suppress noise from
      // partial-month rounding ("about 4 months" vs an exact 3.5).
      if (Array.isArray(resume.experiences) && resume.experiences.length > 0) {
        // parsePeriodMonths, NUM_WORDS and the spoken-duration regex now
        // live in `_resume-period.ts` — shared with hr-round.
        const durRe = SPOKEN_DURATION_REGEX;
        const driftedCompanies: string[] = [];
        for (const exp of resume.experiences) {
          const resumeMonths = parsePeriodMonths(exp?.period);
          const companyNorm = normalizeCompanyName(exp?.company);
          if (!resumeMonths || !companyNorm || companyNorm.length < 3) continue;
          const userLower = userText.toLowerCase();
          // Find every occurrence of the company in userText, then check
          // ±150 chars for a duration phrase.
          let searchFrom = 0;
          let foundDriftForThisCompany = false;
          while (!foundDriftForThisCompany) {
            const idx = userLower.indexOf(companyNorm.split(/\s+/)[0], searchFrom);
            if (idx === -1) break;
            searchFrom = idx + 1;
            const window = userText.slice(Math.max(0, idx - 150), Math.min(userText.length, idx + 150));
            durRe.lastIndex = 0;
            let dm: RegExpExecArray | null;
            while ((dm = durRe.exec(window)) !== null) {
              const raw = dm[1].toLowerCase();
              const n = NUM_WORDS[raw] ?? parseInt(raw, 10);
              if (Number.isNaN(n) || n <= 0) continue;
              const unit = dm[2].toLowerCase();
              const spokenMonths = unit.startsWith("year") ? n * 12 : n;
              const absDrift = Math.abs(spokenMonths - resumeMonths);
              const relDrift = absDrift / resumeMonths;
              if (absDrift > 2 && relDrift > 0.3) {
                driftedCompanies.push(`${(exp?.company || "").trim()} (resume: ${resumeMonths}mo, spoken: ${spokenMonths}mo)`);
                foundDriftForThisCompany = true;
                break;
              }
            }
          }
        }
        if (driftedCompanies.length > 0) {
          flags.add("internship_duration_mismatch_with_resume");
          gaps.push({
            dimension: "credibility",
            expected: "The internship duration you state verbally must match the period on your resume — recruiters cross-check against the offer / relieving letter during BGV. Even rounding 3 months up to 'six months' to sound stronger is a documented disqualifier in service-tier rounds.",
            observed: `Duration drift detected for: ${driftedCompanies.slice(0, 2).join("; ")}.`,
            flag: "internship_duration_mismatch_with_resume",
            severity: "high",
          });
        }
      }

      // 6) Portfolio satisfied by resume.
      // The transcript-only `portfolio_absent_for_claim` rule fires
      // when the user narrates a project without dropping a GitHub
      // link in their answer. If their resume lists a GitHub /
      // portfolio / live-demo URL we suppress that flag — recruiter
      // can already see it.
      if (flags.has("portfolio_absent_for_claim") && Array.isArray(resume.links) && resume.links.filter((u): u is string => typeof u === "string" && u.length > 0).some((u) => /github|gitlab|bitbucket|vercel|netlify|herokuapp|render\.com|huggingface|kaggle/i.test(u))) {
        flags.delete("portfolio_absent_for_claim");
        // Also drop the corresponding rubric gap, if any.
        for (let i = gaps.length - 1; i >= 0; i--) {
          if (gaps[i].dimension === "credibility" && /portfolio|github|live demo/i.test(gaps[i].expected)) {
            gaps.splice(i, 1);
          }
        }
      }
    }

    const tips: string[] = [];
    flags.forEach((flag) => {
      const tip = CAMPUS_FLAG_TIPS[flag];
      if (tip) tips.push(tip);
    });

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
