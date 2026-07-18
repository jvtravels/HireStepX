/* Campus-placement regex constants + analyzer-tuning thresholds.
 *
 * Extracted from `campus-placement.ts` in v6.10 — zero-behavior-change
 * refactor. Co-located comments preserved verbatim (they document the
 * rubric reasoning behind each pattern and are load-bearing for future
 * edits).
 *
 * Keeping the regex bank in its own module:
 *   - drops the main analyzer file under the 1500-LOC ESLint warn line
 *   - lets a contributor scan/diff regex changes without scrolling
 *     through 1300 lines of analyzer logic
 *   - is consumed by `campusReadinessParity.test.ts`, which reads this
 *     module directly and asserts the analyzer-side pattern is
 *     byte-identical to the live-coaching chip copy in
 *     `src/_campus-readiness.ts`
 */

export const ACADEMIC_PROJECT = /\b(capstone|final[- ]?year project|btech project|major project|college project|coursework|cgpa|gpa|sgpa|kt\b|backlog)\b/i;
export const FRESHER_LEXICON = /\b(fresher|just graduated|final year|recent graduate|college senior|placement|on[- ]campus|btech|b\.?tech|bca|mca|m\.?tech)\b/i;
// B3: narrowed `love (?:to )?learn` — bare "I love to learn" without a tech
// subject is too broad (matches learning music / cooking / anything). Require
// a tech object after "learn" OR replace with direct tech verbs "code/build/create".
export const GENERIC_PASSION = /\b(passionate about (?:tech|coding|technology|engineering|programming)|always loved|since childhood|always wanted to|love (?:to )?(?:learn\s+(?:(?:new\s+)?tech(?:nolog(?:y|ies))?|coding|programming|to\s+code)|code|build|create))\b/i;
export const SPECIFIC_PROJECT = /\b(built|implemented|deployed|led|coded|designed|trained|integrated|published)\s+\w+/i;
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
// G3: added `(?:on\s+)?` before the platform names so "100 on LeetCode" /
// "200 on Codeforces" match, not just "100 LeetCode" / "200 submissions".
// G4 note: `\w+` in SPECIFIC_PROJECT intentionally matches digits (\w=[a-zA-Z0-9_])
// so "I built 2048 Game" or "I coded 15Puzzle" correctly trigger the pattern.
export const SUBSTANTIATION_TOKEN = /\b(github\.com\/[\w-]+|github\.io|gitlab\.com\/[\w-]+|leetcode\.com\/[\w-]+|codeforces\.com\/profile|kaggle\.com\/[\w-]+|hackerrank\.com\/[\w-]+|hackathon|sih\b|smart india hackathon|coding contest|code[- ]?jam|hash[- ]?code|kickstart|internship|intern at|interned at|nptel|coursera|udemy|edx\b|cs50|striver(?:'s)?\s+sdc?\s*sheet|striver sde|neetcode|grokking|knight (?:badge|rated)|guardian rated|expert rated|specialist rated|top\s+\d+%?|\d{2,}\s*\+?\s*(?:on\s+)?(?:problems|leetcode|questions|submissions))\b/i;
export const AVAILABILITY = /\b(available (?:from|after)|join (?:by|in|on|after)|notice|graduation|exam|semester|joining date|relocat)\b/i;
export const COLLEGE_BADMOUTH = /\b(my college (?:was|is) (?:bad|terrible|awful)|(?:professors|faculty) (?:are|were) (?:useless|incompetent|terrible)|nothing was taught|wasted (?:my )?time)\b/i;

/* Concrete tech stack — at least one of these must appear when the user
 * narrates a project, otherwise the answer reads as hand-wave. */
export const TECH_STACK = /\b(python|java\b|javascript|typescript|c\+\+|kotlin|swift|go(?:lang)?|rust|node(?:\.?js)?|react|next(?:\.?js)?|angular|vue|django|flask|spring|express|fastapi|tensorflow|pytorch|numpy|pandas|scikit|opencv|sql|mysql|postgres|mongodb|redis|firebase|aws|gcp|azure|docker|kubernetes|git|linux|raspberry pi|arduino|html|css|tailwind|bootstrap|figma|excel|tableau|powerbi|r studio|matlab|verilog|vhdl|simulink|autocad|solidworks|catia|ansys|matlab simulink|plc|scada)\b/i;
/* Global tech-name capture — used to count DISTINCT tech mentions so we
 * can tell "mentioned" (≥2 names but no application context) apart from
 * "applied" (named + paired with an artifact). Mirrors TECH_STACK with
 * a /g flag and no /i fragments specific to single-token forms. */
export const TECH_STACK_G = /\b(python|java|javascript|typescript|c\+\+|kotlin|swift|go(?:lang)?|rust|node(?:\.?js)?|react|next(?:\.?js)?|angular|vue|django|flask|spring|express|fastapi|tensorflow|pytorch|numpy|pandas|scikit|opencv|sql|mysql|postgres|mongodb|redis|firebase|aws|gcp|azure|docker|kubernetes|raspberry pi|arduino|tailwind|bootstrap|figma|tableau|powerbi|matlab|verilog|vhdl|simulink|autocad|solidworks|catia|ansys|plc|scada)\b/gi;
export const PROJECT_NARRATION = /\b(my project|our project|the project|i (?:built|made|developed|coded|designed|trained|implemented)|we (?:built|made|developed|coded|designed|trained|implemented))\b/i;

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
export const TECH_APPLIED = /\b(?:(?:\d+\s+)?(?:rest|graphql|grpc)?\s*(?:api\s+)?endpoints?|api\s+with\s+\d+\s+(?:routes?|endpoints?)|deployed\s+(?:on|to|at)\s+(?:vercel|netlify|render|heroku|aws|gcp|azure|fly\.io|railway|huggingface|streamlit|firebase\s+hosting)|live\s+(?:demo|url|site)\s+(?:at|on)|hosted\s+(?:at|on)|\d{2,}\s*(?:loc|lines\s+of\s+code|lines\b)|~?\s*\d+\s*k\s+lines|used\s+(?:python|java|react|next|flask|django|fastapi|node|express|spring|tensorflow|pytorch|postgres|mongo|redis|aws|docker|kubernetes)\s+(?:to|for|and)\s+\w+|trained\s+(?:a|the|my)\s+(?:cnn|rnn|lstm|transformer|model|classifier|regressor|gan|bert|gpt)\s+(?:in|with|on)\s+(?:python|tensorflow|pytorch|keras|scikit)|(?:postgres|mysql|mongo(?:db)?|sqlite)\s+(?:with|database\s+with)\s+\d+\s+(?:tables?|collections?|documents?)|wrote\s+(?:the\s+)?(?:backend|frontend|api|service|pipeline)\s+in\s+\w+|schema\s+with\s+\d+\s+(?:tables?|collections?))\b/i;

/* Phase-2 recency markers — the campus-interview rubric weights a final-year
 * project well above a 2nd-semester one. Without a recency anchor we have
 * to assume the most distant signal applies. We surface a flag when the
 * candidate cites only DISTANT markers (1st year / 2nd sem) for project
 * narration. The presence of any RECENT marker suppresses. */
// C5: added "right now building/working/developing" as a recency anchor.
export const PROJECT_RECENT_MARKER = /\b(?:final[- ]?year(?:\s+project)?|fy(?:p|np)?\b|capstone|(?:currently|right\s+now)\s+(?:building|working\s+on|developing)|this\s+(?:semester|month|year|week)|last\s+(?:semester|month)|ongoing|in\s+progress|recently\s+(?:built|finished|completed|shipped|deployed)|8th\s+sem(?:ester)?|7th\s+sem(?:ester)?|final\s+sem(?:ester)?|pre[- ]?final|3rd\s+year|fourth\s+year|senior\s+year|major\s+project)\b/i;
export const PROJECT_DISTANT_MARKER = /\b(?:1st\s+year|first\s+year|2nd\s+year|second\s+year|1st\s+sem(?:ester)?|2nd\s+sem(?:ester)?|3rd\s+sem(?:ester)?|4th\s+sem(?:ester)?|first\s+sem(?:ester)?|second\s+sem(?:ester)?|freshman\s+year|sophomore\s+year|two\s+years\s+(?:ago|back)|three\s+years\s+(?:ago|back)|long\s+(?:time\s+)?ago)\b/i;

/* Implausible team-size brag for a fresher / college context. */
export const IMPLAUSIBLE_TEAM = /\b(?:led|managed|headed|directed)\s+(?:a\s+)?team\s+of\s+(\d{2,})/i;

/* "Why this company / what attracted you" probe by AI. Tightened — the
 * earlier version's `\w{2,}` fallback matched any "why X?" question. */
export const WHY_COMPANY_PROBE = /\b(?:why\b[^?.!]{0,80}?\b(?:join us|work (?:here|with us|for us)|us specifically|this (?:company|firm|role|org)|our (?:company|firm|org))|what\s+(?:attracted|brought|drew|excites|excited)\s+you\s+(?:to|about|here|towards))\b/i;
/* Company-specific signal in user answer: tight tokens that indicate
 * the candidate did real research, not generic filler. Avoid generic
 * words like "team" / "product" / "values" — those false-positive on
 * unrelated answers. */
// B5: removed `brand name` — "brand name" false-positives on negation counter-
// examples like "I'm not a brand-name person; I care about the product". The
// distinct alternatives `brand value` + `great brand` already cover genuine
// brand-appeal filler without the negation risk. (Parity: update CP_COMPANY_GENERIC.)
export const COMPANY_GENERIC_FILLER = /\b(great culture|good culture|brand value|great brand|big company|good company|great company|reputation|growth opportunit|learning opportunit|big mnc)\b/i;
export const COMPANY_SPECIFIC_SIGNAL = /\b(trailhead|nqt|infytq|techbee|genc|engage|step program|leadership principles?|customer obsession|day\s*1|crucible|future leaders|gennxt|peak|spirit of wipro|infosys lex|tata code of conduct|your (?:founder|ceo|cofounder|recent|latest|q[1-4]|fy\d|launch|ipo|acquisition|investment|hiring plan|product line|ai strategy|tech stack)|i (?:read|saw|noticed|came across|listened to))\b/i;
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
// I6: split inline into named clusters so future edits touch one group at
// a time without risk of breaking neighbouring alternatives.
//   Group A — training / onboarding vocabulary
//     structured training | training program | ilp | initial learning program
//     onboarding program/process/cohort | fresher training/cohort/program
//   Group B — stability / growth vocabulary
//     stable career/growth/environment/long-term | long-term career/growth/stability
//   Group C — scale / delivery vocabulary
//     proven client/track record/delivery | client base/portfolio/delivery
//     service-led | services model/business/firm | global delivery/footprint/presence
//     scale of operations/delivery | established firm/company/leader/player
//   Group D — brand / domain vocabulary
//     brand maturity | industry leader | Fortune N
//     domain exposure | industry exposure | breadth of projects/domains
export const COMPANY_SERVICE_TIER_NARRATIVE = /\b(?:structured\s+training|training\s+program|stable\s+(?:career|growth|environment|long[- ]term)|long[- ]term\s+(?:career|growth|stability)|proven\s+(?:client|track\s+record|delivery)|client\s+(?:base|portfolio|delivery)|service[- ]led|services?\s+(?:model|business|firm)|global\s+(?:delivery|footprint|presence)|scale\s+of\s+(?:operations?|delivery)|established\s+(?:firm|company|leader|player)|brand\s+maturity|industry\s+leader|fortune\s+\d+|domain\s+exposure|industry\s+exposure|breadth\s+of\s+(?:projects?|domains?)|onboarding\s+(?:program|process|cohort)|fresher\s+(?:training|cohort|program)|ilp\b|initial\s+learning\s+program)\b/i;

/* v6.7 — Cognizant GenC / Capgemini Exceller specifically reward a
 * "client rotation / domain breadth" narrative. Candidates who say
 * "exposure to multiple client domains / horizontal mobility / cross-
 * industry rotation / GenC Pro track" are giving the rubric-matched
 * answer for that archetype. Feeds the existing
 * `service_tier_why_company_acceptable` positive flag when archetype
 * resolves to `cognizant-genc`. */
export const COGNIZANT_CLIENT_ROTATION_NARRATIVE = /\b(?:client\s+rotation|cross[- ]?(?:industry|domain|client)\s+(?:rotation|exposure|mobility|projects?)|multiple\s+(?:client|domain)\s+(?:exposure|projects?)|domain\s+breadth|breadth\s+(?:of\s+)?(?:industries?|domains?|clients?)|genc\s+(?:pro|next)|exceller\s+track|horizontal\s+mobility|rotational\s+(?:program|projects?))\b/i;

/* v6.7 — Location-agnostic signal for tcs-digital. The Digital track
 * loop does NOT probe relocation explicitly (unlike Ninja); a candidate
 * who proactively states pan-India / any-location openness deserves
 * credit, not silence. Used to suppress `weak_reverse_questions` at
 * tcs-digital when present + emit `location_agnostic_signal`. */
export const LOCATION_AGNOSTIC_SIGNAL = /\b(?:open\s+to\s+(?:any\s+location|relocat|pan[- ]?india|all\s+locations?)|location[- ]?agnostic|happy\s+to\s+(?:move|relocate)\s+(?:anywhere|to\s+any)|willing\s+to\s+relocate\s+(?:to\s+)?(?:anywhere|any\s+location|any\s+city|pan[- ]?india)|no\s+location\s+(?:preference|constraint)|flexible\s+(?:on|with|about)\s+location|comfortable\s+(?:with\s+)?(?:any\s+location|pan[- ]?india|relocat))\b/i;

/* v6.7 — Shipped-to-prod evidence. Distinct from the generic
 * PORTFOLIO_LINK / TECH_APPLIED — this specifically captures the
 * "we shipped it and users used it" signal: production deploys,
 * active users, merged PRs to a real codebase, features in
 * customer-facing release notes. At product-grade archetypes
 * (top-tier-campus / tcs-digital) this is a higher-credibility
 * substitute for a GitHub link and suppresses
 * `portfolio_absent_for_claim`. */
export const SHIPPED_TO_PROD_CONTEXT = /\b(?:(?:shipped|deployed|launched|released)\s+(?:to\s+)?(?:prod(?:uction)?|customers?|users?|live|the\s+app|the\s+platform)|(?:in|to)\s+production|live\s+(?:in\s+production|with\s+(?:real\s+)?users?|on\s+the\s+app)|active\s+users?|monthly\s+active|daily\s+active|dau|mau|merged\s+(?:my\s+|the\s+)?pr\s+(?:to|into)|pr\s+(?:got\s+)?merged|customer[- ]?facing|user[- ]?facing\s+feature|first\s+\d+\s+(?:users|customers)|onboarded\s+\d+|served\s+\d+\s+(?:users|requests|customers))\b/i;

/* Volunteered backlogs / KTs / low CGPA unprompted is a framing error.
 * DEFICIT_PROBE intentionally excludes /fail/ — behavioral failure
 * chestnuts like "tell me about a failure" must NOT count as the AI
 * probing academic deficits. */
export const VOLUNTEERED_DEFICIT = /\b(?:i (?:have|had|got)|i'?ve got|unfortunately)\s+(?:\d+\s+)?(?:backlog|kts?|low\s+cgpa|bad\s+cgpa|poor\s+grade)/i;
export const DEFICIT_PROBE = /\b(?:backlog|\bkts?\b|cgpa|gpa|grade|repeat (?:a |the )?(?:year|semester|course))\b/i;

/* Excessive filler — count occurrences across user turns. */
export const FILLER = /\b(basically|as such|like,? you know|um|uh|sort of|kind of|i mean)\b/gi;
export const FILLER_PER_100_WORDS_THRESHOLD = 4;

/* Internship probe + content. */
export const INTERNSHIP_CLAIM = /\b(internship|interned|intern at|summer intern|summer training|industrial training|6[- ]month\s+intern)\b/i;
// C4: broadened from "internship at X" to also catch "worked at X", "employed at X",
// "placed at X" so candidates who summarize their internship without the word
// "internship" still get detail credit.
export const INTERNSHIP_DETAIL = /\b(intern(?:ship)?\s+at\s+\w|worked\s+(?:at|for|with)\s+[A-Z]|employed\s+at\s+\w|placed\s+at\s+\w|stipend|deliverable|reported to|mentor|onboarded|shipped|merged|in production)\b/i;

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
export const MTI_PATTERNS: RegExp[] = [
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

/* Stated CGPA values — captures the numeric value so we can grade framing.
 * Group 1: numeric form  "my CGPA is 8.5"
 * C1: also exported separately as CGPA_STATED_WORD_FORM for spoken forms
 *     "my CGPA is eight point five" that the digit-only pattern misses. */
// C2: added optional `\/10` and `out of 10/ten` suffix so "My CGPA is 9/10"
// and "My CGPA is 8.5 out of 10" match with group-1 capturing the numeric
// part (9 and 8.5 respectively). The suffix is non-capturing so existing
// `cgpaMatch[1]` callers are unaffected.
export const CGPA_STATED = /\b(?:cgpa|gpa|sgpa)\s*(?:is|was|of|:)?\s*(\d(?:\.\d{1,2})?)(?:\s*\/\s*10|\s+out\s+of\s+(?:10|ten))?\b/i;
/* C1: word-form CGPA — "my CGPA is eight point five" / "seven point eight".
 * The analyzer parses this with parseWordFormCgpa() and treats it identically
 * to CGPA_STATED for framing checks + meta surfacing. Only covers common
 * whole+decimal combos (e.g. "seven point five", not "seven and a half"). */
export const CGPA_STATED_WORD_FORM = /\b(?:cgpa|gpa|sgpa)\s*(?:is|was|of|:)?\s*((?:ten|nine|eight|seven|six|five|four|three)(?:\s+point\s+(?:ten|nine|eight|seven|six|five|four|three|two|one|zero)(?:\s+(?:ten|nine|eight|seven|six|five|four|three|two|one|zero))?)?)\b/i;
/* College / TPO internal CGPA gatekeeping. Many tier-2/3 colleges enforce
 * 6.5–7.0 internal bars even though TCS firm cutoff is 6.0. A candidate
 * stating their CGPA alongside "my college won't send me below 6.5" or
 * "TPO cutoff is 7.0" is providing valid context, NOT being evasive —
 * it surfaces a real structural constraint the recruiter respects.
 * v6.6 — treats this as framing for `cgpa_low_no_framing` AND emits the
 * positive flag `college_cgpa_policy_acknowledged`. */
export const COLLEGE_CGPA_POLICY = /\b(?:my\s+college|the\s+college|college'?s?|tpo|placement\s+cell|t\.?p\.?o\.?)\s+(?:(?:internal\s+)?(?:cutoff|policy|bar|requirement|gatekeep(?:ing)?|threshold|minimum)|won'?t\s+(?:send|allow|forward|shortlist)|requires?|enforces?|mandate[sd]?|insists?)\b[^.?!]{0,60}?\b\d(?:\.\d{1,2})?\b/i;

/* Framing context that excuses a low CGPA — must appear in the same user
 * span as the number for the candidate to get credit. */
export const CGPA_FRAMING_CONTEXT = /\b(?:family|health|hospital|surgery|loss|covid|caregiv|financial|part[- ]?time job|supported|recovered|bounced back|after that|since then|the next sem|improved|trended? up|consistent improvement|i (?:worked on|focused on|built|shipped|interned|won|cleared|topped)|(?:9|8|10)\.\d+\s+in\s+(?:my\s+)?(?:last|recent|final)\s+(?:few\s+)?semesters?|last\s+(?:three|four|two|few|3|4|5)\s+semesters?\s+(?:i|i'?ve)|cleared\s+(?:the\s+)?(?:case|coding|final|aptitude)\s+round|placed\s+(?:in|at|with)|offered?\s+by|got\s+(?:an\s+)?offer\s+from|trend(?:ing|ed)?\s+(?:upward|up)|sgpa\s+(?:has\s+)?(?:improved|gone\s+up)|hackathon|kaggle|leetcode|codeforces|open[- ]?source\s+contribut|published)\b/i;

/* Reverse-question grading. Every Indian campus interview closes with
 * "Do you have any questions for us?" — what the candidate asks back
 * is part of the grade. */
export const REVERSE_QUESTION_PROBE = /\b(?:any\s+questions?\s+(?:for\s+(?:us|me|the\s+team))?|do\s+you\s+have\s+(?:any\s+)?questions?|anything\s+you'?d?\s+like\s+to\s+ask|questions?\s+from\s+your\s+(?:side|end))\b/i;
/* Specific, prepared reverse-questions — these score. */
export const REVERSE_QUESTION_SPECIFIC = /\b(?:training\s+program|onboarding|mentor|on[- ]?call|rotation|tech\s+stack|deployment|production|code\s+review|team\s+structure|growth\s+(?:track|path|plan)|career\s+(?:track|progression|ladder)|appraisal|promotion\s+(?:cycle|timeline)|notice\s+period|bond|service\s+agreement|recent\s+launch|product\s+roadmap|client\s+(?:engagement|project)|new\s+(?:product|launch|hire)|ppt|pre[- ]?placement\s+talk|the\s+(?:speaker|presenter)\s+mentioned|(?:i\s+(?:noticed|saw|read|came\s+across)|i'?ve\s+(?:noticed|seen|read)|i\s+was\s+reading)\s+(?:that|about|on|your)|(?:could|can|would)\s+you\s+(?:walk\s+me\s+through|tell\s+me\s+more\s+about|share|elaborate)|how\s+does\s+(?:the\s+team|your\s+team|engineering|the\s+org)\s+(?:handle|approach|decide|measure|review)|what\s+(?:does|do)\s+(?:a\s+)?(?:typical\s+)?(?:first\s+(?:90\s+days|six\s+months|year)|day\s+in\s+the\s+life|new\s+joiner|fresher)|what\s+(?:metrics|kpis?|success\s+criteria)|how\s+(?:are|do)\s+(?:juniors|freshers|new\s+hires)\s+(?:evaluated|mentored|supported)|story\s+behind|engineering\s+(?:culture|blog|values))\b/i;
/* Generic / lazy reverse-questions — these don't score. */
export const REVERSE_QUESTION_GENERIC = /\b(?:work\s+culture|company\s+culture|good\s+culture|growth\s+opportunit|learning\s+opportunit|work[- ]?life\s+balance|when\s+(?:can|do)\s+i\s+(?:start|join|expect)|how\s+(?:is|are)\s+the\s+(?:team|culture|company))\b/i;
/* "No, I don't" / declining the offer to ask. */
export const REVERSE_QUESTION_DECLINED = /\b(?:no\s*[,.]?\s*(?:i\s+(?:don'?t|do\s+not)|that'?s\s+(?:all|fine|good)|nothing\s+(?:from|for)\s+(?:my|now))|i'?m\s+(?:good|clear|set|fine|done|sorted)|i\s+think\s+i'?m\s+(?:good|clear|set|fine|done|sorted)|i'?ve\s+got\s+everything|all\s+(?:clear|good)|nothing\s+from\s+(?:me|my\s+(?:side|end))|i\s+(?:don'?t|do\s+not)\s+have\s+(?:any|questions))\b/i;

/* Bond / service-agreement probe + readiness signal. Real Indian campus
 * interviews probe bond comfort directly; freshers who say "I don't know
 * about bonds" or refuse outright disqualify themselves. */
export const BOND_PROBE = /\b(?:service\s+agreement|service\s+bond|training\s+bond|two[- ]?year\s+bond|2[- ]?year\s+bond|1[- ]?year\s+bond|bond\s+(?:period|duration|amount)|sign\s+(?:the\s+|a\s+)?bond|notice\s+period\s+bond)\b/i;
export const BOND_HEALTHY_RESPONSE = /\b(?:comfortable\s+(?:with|signing)|i'?m\s+aware|i\s+know\s+(?:the|about|of)\s+(?:the\s+)?(?:bond|service\s+agreement|2\s*year|1\s*year)|happy\s+to\s+sign|(?:2|two|1|one|15)\s*(?:[- ]?)(?:month|year)s?|standard\s+practice|fully\s+aware)\b/i;
// B1: removed bare `refuse` (false-positives on "I refuse to believe...",
// "I refuse to accept less"). Refusal phrases now either:
//   (a) contain "sign" — specific enough that "I won't sign" always means
//       contract refusal in an interview context, OR
//   (b) contain "bond" explicitly — anchors vague negatives like "no way".
// The analyzer gates the whole block on BOND_PROBE firing first, which
// provides additional context; BOND_REFUSAL is also self-contained.
export const BOND_REFUSAL = /\b(?:i\s+won'?t\s+(?:sign|agree\s+to)\s+(?:any\s+|the\s+|a\s+)?(?:bond|service\s+agreement|contract)?|absolutely\s+not\s+(?:sign(?:ing)?|agree(?:ing)?)|no\s+way\s+(?:i'?(?:m|ll)\s+sign|i'?ll\s+agree)|refuse\s+to\s+sign\s+(?:any\s+|the\s+|a\s+)?(?:bond|service\s+agreement|contract)|never\s+sign(?:ing)?\s+(?:any\s+|a\s+|the\s+)?(?:bond|service\s+agreement|contract)|i\s+don'?t\s+(?:sign|do)\s+bonds?)\b/i;
export const BOND_IGNORANCE = /\b(?:what'?s?\s+(?:a\s+)?bond|i\s+don'?t\s+know\s+(?:about|what)|never\s+heard\s+of|first\s+(?:time\s+)?hearing)\b/i;

/* ── Wave 3: real-life campus edge cases ─────────────────────────────────
 * Each block below targets a specific failure mode Indian recruiters see
 * repeatedly. Patterns are intentionally conservative — we'd rather miss
 * a true positive than fire on a benign answer. */

/* Attrition risk — fresher signaling exit within 1-2 years (MBA / MS / GRE
 * prep / going abroad). At service-tier this is an immediate red flag
 * because the company can't recover the 2yr training cost. */
export const ATTRITION_HIGHER_STUDIES = /\b(?:planning\s+(?:to\s+)?(?:do\s+)?(?:my\s+)?(?:mba|ms\b|masters|m\.?tech\s+abroad|gre|gmat|cat\s+exam)|going\s+abroad\s+for\s+(?:my\s+)?(?:mba|ms|masters|higher\s+studies)|prepar(?:e|ing)\s+for\s+(?:gre|gmat|cat\b|ielts|toefl)|after\s+(?:1|2|one|two)\s*years?\s+i\s+(?:want|plan|will)\s+to\s+(?:do|pursue|join)\s+(?:my\s+)?(?:mba|ms|masters)|i\s+want\s+to\s+do\s+(?:my\s+)?(?:mba|ms|masters)\s+(?:in|after|within)\s+(?:1|2|one|two)\s*years?)\b/i;

/* Relocation refusal — flat refusal to leave home city. Dealbreaker at
 * TCS/Infosys/Wipro/Cognizant where allocation is pan-India. */
export const RELOCATION_REFUSAL = /\b(?:(?:cannot|can'?t|won'?t|will\s+not|unable\s+to)\s+relocate|not\s+willing\s+to\s+relocate|only\s+(?:want\s+to\s+work|prefer\s+to\s+work|join\s+if\s+(?:posting|posted))\s+(?:in|at|near)\s+(?:bangalore|bengaluru|hyderabad|chennai|mumbai|pune|delhi|noida|gurgaon|gurugram|kolkata|my\s+(?:home\s+)?(?:city|town))|(?:can|will)\s+only\s+work\s+(?:in|from)\s+(?:bangalore|bengaluru|hyderabad|chennai|mumbai|pune|delhi|noida|gurgaon|gurugram|kolkata)|relocation\s+is\s+(?:a\s+)?(?:problem|deal[- ]?breaker|not\s+possible))\b/i;
export const RELOCATION_PROBE = /\b(?:relocat|are\s+you\s+(?:open\s+to|willing\s+to)\s+(?:move|relocate)|(?:bangalore|bengaluru|hyderabad|chennai|pune|noida|gurgaon|trivandrum|kochi|kolkata|nagpur|mysore)\s+(?:office|location|allocation|posting|deployment|center)|any\s+(?:of\s+our\s+)?location|pan[- ]?india\s+(?:posting|deployment|allocation))\b/i;

/* Night-shift / on-call refusal — common dealbreaker. */
export const SHIFT_REFUSAL = /\b(?:(?:cannot|can'?t|won'?t|will\s+not|don'?t\s+(?:want|prefer)|not\s+(?:comfortable|okay|ok|willing))\s+(?:to\s+)?(?:do|work|take)\s+(?:night\s+shift|on[- ]?call|rotational\s+shift|graveyard\s+shift|us\s+shift|evening\s+shift)|night\s+shift\s+is\s+(?:a\s+)?(?:problem|deal[- ]?breaker|not\s+possible|issue)|no\s+night\s+(?:shifts?|duty)|on[- ]?call\s+is\s+(?:a\s+)?(?:problem|deal[- ]?breaker|not\s+possible|issue))\b/i;
export const SHIFT_PROBE = /\b(?:night\s+shift|rotational\s+shift|on[- ]?call|24x7|24\s*\/\s*7|us\s+(?:shift|hours|timing)|graveyard|client\s+(?:hours|timing)|shift\s+timing|production\s+support)\b/i;

/* Cliché strength/weakness — "perfectionist", "work too hard". */
export const CLICHE_STRENGTH_WEAKNESS = /\b(?:i'?m\s+a\s+perfectionist|i\s+am\s+(?:a\s+)?perfectionist|my\s+(?:biggest\s+)?weakness\s+is\s+(?:that\s+)?(?:i\s+am\s+a\s+perfectionist|i'?m\s+a\s+perfectionist|i\s+work\s+too\s+(?:hard|much)|i\s+care\s+too\s+much|i\s+am\s+too\s+(?:dedicated|hard[- ]?working|honest))|i\s+work\s+too\s+(?:hard|much)\s+sometimes|i'?m\s+too\s+(?:hard[- ]?working|dedicated|honest)|workaholic)\b/i;
export const STRENGTH_WEAKNESS_PROBE = /\b(?:(?:greatest|biggest|main)\s+(?:strength|weakness)|tell\s+me\s+(?:about\s+)?your\s+(?:strengths?|weakness(?:es)?)|what\s+(?:are|is)\s+your\s+(?:strengths?|weakness(?:es)?)|areas?\s+(?:of\s+improvement|to\s+improve))\b/i;

/* "Tell me about yourself" → resume recital cue. */
export const TMAY_PROBE = /\b(?:tell\s+me\s+about\s+yourself|introduce\s+yourself|walk\s+me\s+through\s+your\s+(?:background|resume|cv|profile)|brief\s+(?:introduction|intro)\s+about\s+yourself)\b/i;
export const RESUME_RECITAL = /\b(?:as\s+(?:per|mentioned\s+in|stated\s+in)\s+my\s+(?:resume|cv)|as\s+(?:you\s+can\s+see\s+)?(?:in|on)\s+my\s+(?:resume|cv)|on\s+(?:the\s+)?top\s+of\s+(?:the\s+)?(?:resume|cv|profile)|listed\s+(?:in|on)\s+my\s+(?:resume|cv)|going\s+through\s+my\s+resume|reading\s+(?:from\s+)?my\s+resume)\b/i;

/* "Where do you see yourself in 5 years?" — career-goal probe.
 * Specific (tech-lead / SDE-3 / shipping a product) scores;
 * vague ("successful", "settled", "in a senior position") doesn't. */
export const CAREER_GOAL_PROBE = /\b(?:where\s+do\s+you\s+see\s+yourself|5\s*years?\s+(?:down\s+the\s+line|from\s+now|hence)|long[- ]?term\s+(?:goal|plan|vision|aspiration)|career\s+(?:goal|plan|aspiration|trajectory|graph)|(?:short|long)[- ]?term\s+plan)\b/i;
export const CAREER_GOAL_VAGUE = /\b(?:(?:want\s+to\s+be|see\s+myself|be)\s+(?:successful|big|in\s+a\s+(?:senior|leadership|big|higher|good)\s+(?:position|role|level)|settled|happy|grown\s+(?:in|as)\s+(?:a\s+)?person|at\s+a\s+higher\s+level)|wherever\s+(?:life|the\s+company)\s+takes|grow\s+(?:in|with)\s+the\s+company|don'?t\s+(?:know|have\s+a\s+plan)|haven'?t\s+(?:thought|decided))\b/i;
export const CAREER_GOAL_SPECIFIC = /\b(?:tech\s+lead|senior\s+(?:engineer|developer|sde)|principal\s+(?:engineer|developer)|sde[- ]?[23ii]|engineering\s+manager|staff\s+engineer|specialis[ez]\s+in\s+\w|domain\s+expert|architect\s+(?:for|on)|associate\s+(?:consultant|architect|partner)|product\s+(?:manager|owner)|founding\s+(?:engineer|team)|own(?:ership)?\s+of\s+(?:a|the|my)\s+(?:product|module|service|feature)|shipping\s+(?:my|the)\s+(?:first|own)\s+(?:product|feature|module)|deep\s+expertise\s+in\s+\w|core\s+contributor\s+to\s+\w)\b/i;

/* Hackathon claim — should come with rank/prize/team/duration detail. */
export const HACKATHON_CLAIM = /\b(?:hackathon|hack\s+day|smart\s+india\s+hackathon|sih\b|hackerearth\s+(?:contest|hackathon)|unstop|techgig|codevita|coding\s+contest|programming\s+contest|google\s+hash\s+code|kickstart)\b/i;
export const HACKATHON_DETAIL = /\b(?:won|runner[- ]?up|top\s+\d+|finalist|prize|stipend|leader[- ]?board|team\s+of\s+\d|built\s+\w+\s+in\s+\d+\s+(?:hours?|days?)|(?:24|36|48|72)\s+hours?|theme\s+was|problem\s+statement|judges?|first\s+place|second\s+place|third\s+place|rank\s+\d+|cash\s+prize|certificate)\b/i;

/* Buzzword soup — listing too many trendy areas as "interests" without an
 * anchor project. Counted across the full user text. */
export const BUZZWORD = /\b(?:ai\b|ml\b|machine\s+learning|deep\s+learning|blockchain|web3\b|iot\b|cloud\s+computing|cyber\s*security|data\s+science|big\s+data|generative\s+ai|gen\s*ai|chatgpt|llm\b|nlp\b|computer\s+vision|robotics|ar\s*\/\s*vr|metaverse|quantum\s+computing|crypto(?:currency)?|nft\b)\b/gi;

/* Family-pressure framing — unprofessional in a job interview context. */
export const FAMILY_PRESSURE = /\b(?:my\s+(?:parents|family|father|mother|dad|mom)\s+(?:want|wants|wanted|told|asked|forced|pushed|insisted|chose)|because\s+of\s+my\s+(?:parents|family)|my\s+(?:parents|family)'?s?\s+(?:wish|dream|expectation|pressure|choice)|forced\s+(?:by|into|to\s+join)\s+(?:my\s+)?(?:parents|family|this\s+field))\b/i;

/* Negative compare to another company. */
export const NEGATIVE_COMPARE = /\b(?:(?:tcs|infosys|wipro|cognizant|hcl|tech\s+mahindra|capgemini|accenture|google|amazon|microsoft|adobe|flipkart|swiggy|zomato)\s+is\s+(?:better|worse|bigger|smaller|cheaper|costlier|worse\s+paying|low[- ]?paying)\s+than|(?:better|worse|cheaper|costlier|smaller|bigger)\s+than\s+(?:tcs|infosys|wipro|cognizant|hcl|google|amazon|microsoft|flipkart|swiggy|zomato)|(?:tcs|infosys|wipro|cognizant|hcl|capgemini|accenture)\s+(?:doesn'?t|does\s+not|never)\s+(?:pay\s+well|train\s+well|give\s+good))\b/i;

/* Salary expectation probe + value extraction. */
export const SALARY_EXPECTATION_PROBE = /\b(?:salary\s+expectation|expected\s+(?:ctc|salary|package|compensation)|what\s+(?:are|is)\s+your\s+(?:salary|ctc|package)\s+expectation|how\s+much\s+(?:are\s+you\s+expecting|do\s+you\s+want|salary)|expected\s+pay)\b/i;
// C3: added plain "lakhs?" (without "per annum" suffix) so "5 lakhs" / "6 lakh"
// matches. The gate is already `aiAskedSalary`, so false positives from
// non-salary "lakhs" (e.g. "my project served 5 lakh users") are acceptable;
// that context would only be reached after AI explicitly asks about salary.
export const SALARY_NUMBER_LPA = /\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:lpa\b|lakhs?\s*(?:per\s*annum\b)?|l\.?p\.?a\.?)\b/i;

/* User raised salary too early — in a technical / introductory round.
 * We flag if the user mentions CTC/salary before the AI has done so, AND
 * within the first 4 user turns. */
export const USER_SALARY_RAISED = /\b(?:what\s+(?:is\s+(?:the\s+)?)?(?:ctc|salary|package|pay)|how\s+much\s+do\s+you\s+pay|salary\s+structure|what'?s\s+the\s+(?:pay|ctc|package))\b/i;

/* Portfolio absence claim — user said "I built X" but didn't reference
 * any github / hosted demo / live link. Only fires on substantial
 * project narration. */
export const CLAIMED_BUILT = /\b(?:i\s+(?:built|made|developed|coded|implemented|deployed|shipped|trained)\s+(?:a\s+|an\s+|the\s+|my\s+)?\w)/i;
export const PORTFOLIO_LINK = /\b(?:github(?:\.com)?|gitlab|bitbucket|portfolio\s+(?:link|url|site|website)|live\s+(?:demo|link|url|site)|deployed\s+(?:on|at)|hosted\s+(?:on|at)|netlify|vercel|render|heroku|firebase\s+hosting|aws\s+(?:s3|amplify|elastic)|hugging\s*face|kaggle\s+notebook|colab\s+notebook|leetcode\s+profile|codeforces|codechef|hackerrank\s+profile|figma\s+(?:link|file)|notion\s+page|demo\s+video)\b/i;

/* ── Wave-4 patterns — deeper Indian campus realism ───────────────── */

/* Active backlog / arrears — TCS/Infosys/Wipro have strict no-active-backlog
 * rules. AI probes; user evades ("not sure", "few left", "will clear soon"). */
export const BACKLOG_PROBE = /\b(?:any\s+(?:active\s+)?(?:backlogs?|arrears?|kt(?:s)?\b|supplementary)|how\s+many\s+(?:backlogs?|arrears?|kts?)|do\s+you\s+have\s+(?:any\s+)?(?:backlogs?|arrears?|standing\s+arrears?)|standing\s+arrears?|active\s+(?:backlog|arrear)|history\s+of\s+(?:backlogs?|arrears?))\b/i;
export const BACKLOG_EVASIVE = /\b(?:not\s+sure|don'?t\s+remember|few\s+left|couple\s+(?:left|pending)|will\s+clear|going\s+to\s+clear|trying\s+to\s+clear|some\s+(?:are\s+)?pending|haven'?t\s+(?:checked|counted)|i\s+think\s+(?:one|two|three|a\s+few))\b/i;
export const BACKLOG_CLEAN = /\b(?:no\s+(?:active\s+)?(?:backlogs?|arrears?|kts?)|zero\s+(?:backlogs?|arrears?)|all\s+(?:cleared|passed|first\s+attempt)|cleared\s+(?:everything|all\s+(?:papers|subjects))|first[- ]?attempt\s+pass)\b/i;

/* Branch-jump — non-CS branch applying to SDE/SWE. Mech / Civil / EEE / ECE /
 * Chem / Biotech / IT / MBA all common. Needs learning-narrative when probed. */
export const NONCS_BRANCH = /\b(?:mechanical\s+engineering|civil\s+engineering|chemical\s+engineering|electrical\s+(?:engineering|and\s+electronics)|electronics\s+(?:and\s+communication|engineering|and\s+telecom)|ece\b|eee\b|biotech(?:nology)?|aerospace|metallurgy|automobile\s+engineering|production\s+engineering|industrial\s+engineering|i\s+am\s+(?:from|in)\s+(?:mech|civil|ece|eee|chem|biotech))\b/i;
export const BRANCH_LEARNING_NARRATIVE = /\b(?:self[- ]?taught|self[- ]?study|learnt\s+(?:coding|programming|cs|dsa)|coursera|nptel|udemy|youtube|cs50|harvard\s+cs50|mit\s+ocw|leetcode|hackerrank|gfg|geeks\s*for\s*geeks|striver|love\s+babbar|kunal\s+kushwaha|abdul\s+bari|completed\s+(?:a|the)\s+(?:bootcamp|course|specialization)|minor\s+in\s+(?:cs|computer)|certified\s+in|switched\s+(?:to|domains?)|cross[- ]?domain|transitioned\s+to|moved\s+(?:into|to)\s+(?:software|tech|cs)|built\s+\d+\s+projects?)\b/i;

/* PPT (pre-placement talk) recall — interviewers expect the candidate to
 * reference something from the PPT (speaker, recent launch, program name).
 * Fire if substantial transcript + no PPT reference. */
export const PPT_REFERENCE = /\b(?:ppt\b|pre[- ]?placement\s+talk|the\s+(?:speaker|presenter|hr|recruiter)\s+(?:mentioned|talked\s+about|shared)|during\s+(?:your|the)\s+(?:presentation|talk)|you\s+(?:mentioned|talked\s+about|presented)\s+(?:in\s+the\s+ppt|earlier|during)|i\s+(?:saw|attended|was\s+at)\s+(?:your|the)\s+(?:ppt|presentation|pre[- ]?placement)|in\s+(?:your|the)\s+pre[- ]?placement)\b/i;

/* Coding-round score defense — AI mentions low coding/DSA score, user has
 * no rationale (preparation timeline, time-pressure, learning since). */
export const CODING_SCORE_PROBE = /\b(?:your\s+(?:coding|dsa|online|written|aptitude)\s+(?:round\s+)?score\s+(?:was|is)\s+(?:low|on\s+the\s+lower\s+side|not\s+great|weak)|you\s+(?:only\s+)?cleared\s+(?:\d|one|two)\s+(?:question|problem)s?|coding\s+(?:round|test).+(?:struggle|tough|hard|low)|you\s+(?:missed|didn'?t\s+(?:clear|solve))\s+(?:the\s+)?(?:hard|second|third|last)\s+(?:problem|question)|why\s+(?:was\s+)?your\s+(?:coding|dsa)\s+score\s+(?:so\s+)?low)\b/i;
export const CODING_SCORE_RATIONALE = /\b(?:nerves?|time\s+(?:pressure|management|ran\s+out)|got\s+stuck|over[- ]?thought|first\s+(?:placement\s+)?(?:round|test)|since\s+then|after\s+that\s+i'?ve|i'?ve\s+(?:improved|practi[cs]ed|been\s+solving|done\s+\d+)|leetcode\s+streak|currently\s+at\s+(?:knight|guardian|specialist|expert)|solved\s+\d{2,}\s+problems?|practi[cs]ing\s+(?:daily|every\s+day)|i\s+know\s+where\s+i\s+(?:went\s+wrong|lost\s+marks))\b/i;

/* Parallel exam prep — admits preparing for GATE / CAT / UPSC / GRE alongside
 * placement. Attrition-adjacent, service-tier red flag. */
export const PARALLEL_EXAM_PREP = /\b(?:(?:also|simultaneously|in\s+parallel|side\s+by\s+side|along\s+with\s+this|alongside)\s+(?:preparing|studying|appearing)\s+for\s+(?:gate|cat|upsc|gre|gmat|ielts|toefl)|i'?m\s+(?:also\s+)?(?:preparing|studying)\s+for\s+(?:gate|cat|upsc|gre|gmat)\s+(?:this\s+year|simultaneously|in\s+parallel)|writing\s+(?:gate|cat|upsc)\s+(?:this|next)\s+(?:year|month)|gate\s+(?:and|plus|alongside)|cat\s+(?:and|plus|alongside))\b/i;

/* Tier-3 overcompensation — non-tier-1 / non-tier-2 college + grandiose
 * leadership claim. Fires only when collegeTier === "unknown". */
export const GRANDIOSE_CLAIM = /\b(?:nation(?:al|-?wide)?\s+(?:winner|topper|champion|leader)|all\s+india\s+(?:rank|topper|winner)|hackathon\s+(?:winner|champion)\s+(?:nationally|globally)|google\s+gsoc|outreachy|won\s+(?:hackathons?|contests?)\s+(?:multiple\s+times|nationally|globally|across\s+india)|i'?ve\s+led\s+(?:teams?\s+of\s+)?\d{2,}|i'?ve\s+(?:single[- ]?handedly|alone|by\s+myself)\s+(?:built|shipped|launched)\s+(?:a\s+)?(?:startup|product|company)|founder\s+of\s+(?:my\s+own\s+)?(?:startup|company)|generated\s+(?:revenue|\d+\s*(?:lakhs?|crores?))|served?\s+(?:thousands|millions)\s+of\s+(?:users|customers))\b/i;

/* FYP (final-year project) solo claim vs team — user says "I built" but
 * also references team-of-N. Detect contradiction. */
export const FYP_SOLO_CLAIM = /\b(?:i\s+(?:built|made|developed|coded|shipped|designed|architected)\s+(?:the\s+|a\s+|an\s+|my\s+)?(?:fyp|final[- ]?year\s+project|capstone|major\s+project))\b/i;
export const FYP_TEAM_MENTION = /\b(?:team\s+of\s+(?:3|4|5|6|three|four|five|six)|(?:3|4|5|6|three|four|five|six)[- ]?(?:person|member)\s+team|my\s+team|we\s+(?:built|made|developed|did|shipped|presented)|our\s+(?:team|group)\s+(?:built|made|developed|did)|with\s+(?:my\s+)?(?:teammates|team\s+members|group\s+mates))\b/i;

/* Stipend dodge — AI asks intern stipend, user hedges (could signal
 * fabricated internship or undisclosed unpaid status). */
export const STIPEND_PROBE = /\b(?:what\s+was\s+(?:your|the)\s+stipend|how\s+much\s+(?:were\s+you\s+paid|did\s+(?:they|you)\s+(?:pay|get))|stipend\s+(?:amount|kitna|details?)|paid\s+internship|monthly\s+(?:stipend|pay|comp))\b/i;
export const STIPEND_DODGE = /\b(?:don'?t\s+(?:remember|recall)|prefer\s+not|it\s+was\s+unpaid\s+but|not\s+(?:disclosed|comfortable)|confidential|nda|can'?t\s+share|small\s+amount|something\s+(?:small|minimal|nominal)|not\s+much|barely\s+anything|just\s+(?:travel|conveyance)|i\s+wasn'?t\s+(?:keeping\s+track|paying\s+attention))\b/i;
export const STIPEND_CONCRETE = /\b(?:\d{1,2},?\d{3}\s*(?:per\s+month|\/month|monthly|pm\b)|₹\s*\d{1,2},?\d{3}|\d{1,2}\s*(?:k|thousand)\s*(?:per\s+month|\/month|monthly|pm\b)|inr\s+\d{1,2},?\d{3}|stipend\s+(?:was|of)\s+(?:₹|rs\.?)?\s*\d|i\s+was\s+paid\s+\d|got\s+(?:₹|rs\.?)?\s*\d{1,2},?\d{3})\b/i;

/* ── Wave-5 patterns — softer-signal Indian campus realism ────────── */

/* Memorized self-intro — verbatim YouTube-template openers. Fires when
 * the candidate's response to TMAY contains 2+ canonical template phrases.
 * C6: added "giving a brief introduction" / "begin with a brief" variants. */
export const MEMORIZED_TEMPLATE = /\b(?:good\s+(?:morning|afternoon|evening)\s+(?:sir|ma'?am|mam|sir\s*\/\s*ma'?am)|first\s+of\s+all\s+(?:i'?d\s+like\s+to\s+)?thank\s+you\s+for\s+(?:this\s+(?:wonderful\s+)?opportunity|giving\s+me\s+this\s+(?:wonderful\s+)?opportunity)|coming\s+to\s+my\s+(?:introduction|family\s+background)|i\s+would\s+(?:like\s+to\s+|want\s+to\s+)?(?:introduce\s+myself|begin\s+(?:with|by)|give\s+(?:a\s+)?(?:brief\s+)?(?:introduction|intro))|talking\s+about\s+my\s+(?:family|hobbies|strengths)|on\s+a\s+concluding\s+note|that'?s\s+all\s+(?:about|from)\s+me|this\s+is\s+all\s+about\s+(?:me|myself)|myself\s+\w+\s+\w+(?:,|\s+and\s+i\s+am))/i;

/* Aptitude / on-spot puzzle refusal — AI asks a live aptitude / DSA /
 * estimation question; user refuses or stalls. */
export const APTITUDE_LIVE_PROBE = /\b(?:quick\s+(?:one|question|puzzle)|solve\s+(?:this|the\s+following)|how\s+would\s+you\s+(?:approach|solve)|let'?s\s+do\s+(?:a\s+)?(?:quick\s+)?(?:puzzle|brainteaser|estimation)|find\s+the\s+(?:second|3rd|nth)\s+(?:highest|largest)|reverse\s+(?:a\s+)?(?:linked\s+list|string|array)|estimate\s+the\s+number\s+of|fermi\s+(?:question|estimate))\b/i;
export const APTITUDE_REFUSAL = /\b(?:can'?t\s+(?:think|solve|do)\s+(?:on\s+the\s+spot|right\s+now|under\s+pressure)|i'?m\s+not\s+good\s+(?:at|with)\s+(?:puzzles|aptitude|dsa|on[- ]?spot)|need\s+(?:to\s+see|a)\s+(?:ide|laptop|computer|keyboard|paper)|i\s+don'?t\s+do\s+(?:puzzles|aptitude|brainteasers)|skip\s+(?:this|that)|pass\s+(?:on\s+)?(?:this|that)|not\s+comfortable\s+(?:with|doing)\s+(?:this|puzzles|aptitude))\b/i;

/* Onsite / foreign-opportunity premature ask — fresher brings up US /
 * UK / onsite within the first 3 user turns, before role discussion. */
export const ONSITE_QUERY = /\b(?:onsite\s+(?:opportunit|chance|posting|assignment|deputation)|when\s+(?:will|can|do)\s+i\s+go\s+(?:onsite|abroad|to\s+(?:us|usa|uk|canada|australia|germany))|foreign\s+(?:posting|opportunity|travel|deputation)|us\s+(?:client|posting|travel|opportunity|onsite|deputation)|sent\s+to\s+(?:us|usa|uk|onsite)|client\s+location\s+(?:travel|visit|posting))\b/i;

/* Nepotism reference — mentions relative / family-friend at the company.
 * Red flag at most Indian firms; some PSUs explicitly forbid it. */
export const NEPOTISM_MENTION = /\b(?:my\s+(?:uncle|aunt|father|mother|dad|mom|cousin|brother|sister|relative|chacha|mama|mausi|bhai|behen|bhaiya|didi)\s+(?:works?|is\s+(?:working|an?\s+\w+))\s+(?:at|in|for|with)\s+(?:your\s+)?(?:company|organi[zs]ation|firm|here|this\s+company)|my\s+(?:family\s+friend|relative|cousin)\s+(?:works?|is)\s+(?:at|in|for|with)\s+(?:your|this)\s+(?:company|organi[zs]ation|firm)|referred\s+by\s+my\s+(?:uncle|aunt|father|mother|cousin|relative)|family\s+contact\s+(?:at|in)\s+(?:your|this)\s+company)\b/i;

/* In-hand vs CTC confusion — explicit signal of misunderstanding Indian
 * fresher comp structure. Often combined with disappointed-tone phrasing. */
export const INHAND_CTC_CONFUSION = /\b(?:but\s+(?:my\s+)?in[- ]?hand\s+(?:should\s+be|will\s+be|is)\s+\d|in[- ]?hand\s+(?:salary\s+)?(?:will\s+be|kitna|kya|how\s+much)|i\s+(?:thought|assumed|expected)\s+(?:the\s+)?ctc\s+(?:was|is)\s+(?:the\s+)?(?:in[- ]?hand|monthly\s+pay)|isn'?t\s+ctc\s+the\s+same\s+as\s+(?:in[- ]?hand|monthly|take[- ]?home)|so\s+i'?ll\s+(?:take\s+home|get)\s+\d+\s*lpa)\b/i;

/* Code-on-paper / whiteboard freeze — AI asks for pseudocode / logic
 * walkthrough, user says they can only code in IDE. */
export const CODE_WRITE_PROBE = /\b(?:write\s+(?:the\s+)?(?:pseudo[- ]?code|code|logic|algorithm)|walk\s+me\s+through\s+the\s+(?:code|logic|algorithm)|how\s+would\s+you\s+code\s+(?:this|it)|on\s+(?:paper|whiteboard|notepad|chat)|share\s+your\s+screen\s+and\s+code|type\s+out\s+the\s+logic|sketch\s+(?:the\s+)?(?:code|algorithm)|explain\s+(?:the\s+)?logic\s+(?:line\s+by\s+line|step\s+by\s+step))\b/i;
export const CODE_WRITE_REFUSAL = /\b(?:i\s+can\s+only\s+code\s+in\s+(?:an?\s+)?ide|i\s+need\s+(?:an?\s+)?ide|can'?t\s+(?:code|write)\s+(?:without|on\s+paper|here|in\s+chat|in\s+the\s+chat)|i\s+don'?t\s+write\s+(?:code\s+)?(?:on\s+paper|by\s+hand)|let\s+me\s+(?:open|grab)\s+(?:my\s+)?(?:laptop|ide|vs\s*code)|i'?m\s+not\s+good\s+(?:without|outside)\s+(?:an?\s+)?ide)\b/i;

/* Resume date inconsistency — overlapping internship windows in same text.
 * Detects two date ranges that clearly overlap (e.g. "May 2024 to August 2024"
 * AND "June 2024 to October 2024"). Conservative — only fires when at least
 * two month-year ranges are mentioned and obviously overlap. */
export const MONTH_YEAR_RANGE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})\s+(?:to|till|until|-|–|—)\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})/gi;

/* Degree / branch inconsistency — candidate names two different branches
 * across the transcript. Common confusion sources: CSE, IT, AIML, AIDS,
 * ECE, EEE, Mech, Civil, Chem. Fires if two distinct branch names appear
 * in user text without an explicit minor / dual-degree connector. */
// NOTE: bare two-letter forms ("IT", "IS") are intentionally excluded — they
// false-positive on the English words "it"/"is" inside any transcript. We
// require the spelled-out forms ("information technology" / "information
// science"); canonicalization below still maps both into the "it"/"is" keys.
// Same caution for short forms like "mech": require a branch-context word.
export const BRANCH_NAME = /\b(?:cse\b|c\s*s\s*e\b|computer\s+science(?:\s+and\s+engineering)?|cs\s+engineering|information\s+technology|information\s+science|electronics\s+and\s+communication(?:\s+engineering)?|ece\b|e\s*c\s*e\b|electrical\s+and\s+electronics(?:\s+engineering)?|eee\b|e\s*e\s*e\b|mechanical(?:\s+engineering)?|\bmech\s+(?:branch|engineering|department|stream|major|student)|civil\s+engineering|chemical\s+engineering|chem\s+engg|biotech(?:nology)?|a\s*i\s*\/?\s*m\s*l\b|aiml\b|artificial\s+intelligence\s+(?:and|&)\s+machine\s+learning|\baids\s+(?:branch|department|stream|major|student|engineering)|artificial\s+intelligence\s+(?:and|&)\s+data\s+science|data\s+science\s+(?:engineering|branch))\b/i;
export const DUAL_DEGREE_CONNECTOR = /\b(?:minor\s+in|dual[- ]?degree|integrated\s+(?:m\s*tech|b\s*tech|m[- ]?s)|with\s+a\s+specialization\s+in|core\s+(?:branch|major)\s+is|primary\s+branch|specializ\w+\s+in|i'?m\s+from\s+\w+\s+but\s+(?:my\s+)?(?:minor|focus|elective)|switched\s+(?:from|branch|streams))\b/i;
