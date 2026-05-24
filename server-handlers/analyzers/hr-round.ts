/* HR-round interview analyzer — deterministic v2.
 *
 * Indian HR round = a 7-dimension final gate:
 *   1. Logistics       — notice / LWD / buyout / location / shift
 *   2. Comp discovery  — current CTC structure + expected hike, payslip validation
 *   3. Stability       — reason for leaving, gaps, tenure pattern, no bad-mouth
 *   4. Compliance      — BGV consent + documents (PAN/Aadhaar/UAN, relieving
 *                        letters, payslips, Form 16, marksheets)
 *   5. Commitment      — other offers, counter-offer protection, joining lock
 *   6. Benefits/policy — joining bonus clawback, probation, bond, ESOP vest
 *   7. Fit & motivation— specific "why us", values, manager fit, 3-5 yr plan
 *
 * Each detection maps to a rubric dimension surfaced in the report.
 */

import {
  AnalyzerInput,
  AnalyzerResult,
  FocusAnalyzer,
  ResumeForAnalyzer,
  RubricGap,
  TranscriptTurn,
  emptyResult,
} from "./_types";
import { parseResumePeriod } from "../_resume-period";
import { rescoreFlags, type FlagRescoreCandidate } from "./_llm-rescore";

function isAi(t: TranscriptTurn): boolean { return t.speaker.toLowerCase().startsWith("a"); }
function isUser(t: TranscriptTurn): boolean { return t.speaker.toLowerCase().startsWith("u"); }
function replyTo(transcript: TranscriptTurn[], idx: number): TranscriptTurn | undefined {
  return transcript.slice(idx + 1, idx + 3).find(isUser);
}

const SALARY_NUMBER = /(?:₹|inr\s*)?\d{1,3}(?:[.,]\d{1,2})?\s*(?:lpa|lakhs?|lakh|l\b|cr|crores?|k|usd|\$)/i;
const ASKED_ABOUT_SALARY = /\b(salary expectation|comp(?:ensation)? expectation|what are you looking for|target salary|expected ctc|current ctc|hike|package (?:kya|kitna|expectation)|kitna package|salary kitni|ctc kitna)\b/i;
const HIKE_PROMPT = /\b(hike|why are you asking|jump from your current|% (?:on|over) (?:your )?current|kitna hike|hike kitna)\b/i;
const PAYSLIP_PROMPT = /\b(payslip|pay slip|form\s*16|salary slip|salary proof)\b/i;
const PAYSLIP_REFUSED = /\b(?:not comfortable|prefer not|can'?t share|cannot share|don'?t share|won'?t share|not willing|not (?:able|ready) to share|share nahi|nahi de sakta|share karna mushkil)\b/i;
const BADMOUTHING = /\b(toxic|terrible|awful|hated|worst|stupid|incompetent|micromanag|backstab|crook|garbage|nightmare|abusive|harass|bakwaas|bekaar|ghatiya|chutiya)\b/i;
const GAP_PROMPT = /\b(gap|career break|sabbatical|why (?:were you|are you|was there) (?:not working|unemployed|a (?:gap|break))|career mein gap)\b/i;
const NOTICE_PERIOD = /\b(notice period|when can you (?:start|join)|availability|join (?:by|on|in)|relocat|location preference|lwd|last working day|buyout|earliest (?:join|start)|kab join|join kab|notice kitna)\b/i;
const NOTICE_ASKED = /\b(notice period|when can you (?:start|join)|earliest (?:join|start)|lwd|last working day|kab join kar|notice kitna)\b/i;
const NOTICE_VAGUE = /\b(?:not sure|don'?t know|haven'?t checked|will check|depends on|maybe|few months|some time|not decided|need to (?:check|find out|confirm)|pata nahi|dekh ke bataunga|check karke|abhi confirm nahi|thoda time)\b/i;
/* Notice-period concrete answers include the full Indian range.
   180 / 6 months is standard at LTI Mindtree, Cognizant, Persistent,
   most of BFSI; flagging a candidate who says "180 days, no buyout"
   as vague would be a false positive. */
const NOTICE_CONCRETE = /\b(?:30|45|60|90|120|180|three months?|two months?|one month|six months?|four months?|sixty|ninety|thirty|teen mahine|do mahine|ek mahina|chhe mahine|chai mahine)\b/i;
const BGV_PROMPT = /\b(bgv|background verification|background check|payslip|form\s*16|relieving letter|experience letter|uan|pan card|aadhaar|aadhar|marksheet|reference check|first advantage|authbridge|ongrid)\b/i;
const BGV_EVASIVE = /\b(?:not comfortable|prefer not|can'?t share|cannot share|don'?t share|won'?t share|not willing|not (?:able|ready) to share|don'?t have|lost|misplaced|nahi hai|kho gaya|share nahi)\b/i;
const COUNTER_OFFER_PROMPT = /\b(counter[- ]offer|counter offer|if (?:your )?current (?:company|employer) (?:offers|matches|counters)|other offers|interviewing elsewhere|if we (?:make|extend) (?:you )?an offer|commitment within|kahin aur interview|aur offer)\b/i;
const COUNTER_OFFER_DODGE = /\b(?:i'?ll see|it depends|maybe|not sure|can'?t say|too early|let me think|i'?ll decide (?:then|later)|will see how|dekhta hu|dekhte hain|soch ke bataunga|tab ki tab|abhi nahi bol sakta)\b/i;
/* Positive counterpart to COUNTER_OFFER_DODGE — candidate handles the
   counter-offer probe gracefully with a firm "no counter" commitment.
   When this fires we suppress counter_offer_dodge AND record a
   positive signal so the report credits the candidate. */
const OFFER_ACCEPTED_GRACEFUL = /\b(?:if i (?:accept|take) (?:yours|your offer)[\s,]+i (?:won'?t|will not|don'?t plan to) (?:take|consider|entertain) (?:a |any )?counter|no counter[- ]?offer (?:consideration|for me|here|please)|(?:i'?ve|i have) (?:already )?(?:mentally )?decided[\s,]*(?:no counter|on this move|to (?:leave|move))|once i sign[\s,]+i'?m (?:in|committed|done)|i (?:won'?t|will not) entertain (?:a |any )?counter[- ]?offer|counter[- ]?offer (?:not in (?:the )?picture|out of (?:the )?picture|isn'?t happening)|haan main commit (?:karta|kar) (?:hu|raha)|i'?m done with them|no second thoughts (?:on (?:this|the) move)?|(?:yeah |yes )?i'?m clear on (?:this|the) move|i'?ve made up my mind|made up my mind (?:already|on (?:this|the) move))\b/i;
const WHY_COMPANY_PROMPT = /\b(why (?:our|this) company|why us|why are you interested in (?:us|our|this company)|what do you know about (?:us|our company)|why (?:do )?you want to (?:join|work (?:at|with|here))|humari company kyu|yahan kyu)\b/i;
const GENERIC_WHY = /\b(great culture|great brand|good company|reputed|reputation|big name|industry leader|top company|growth opportunit|good work[- ]?life|good place|nice place|love the company|achi company|badi company|brand achi)\b/i;
const SPECIFIC_WHY = /\b(launched|launch|product|feature|leader|founder|ceo|cto|paper|blog|talk|conference|series [a-d]|ipo|acquired|acquisition|mission|domain|space|sector|stack|engineering blog|open source|case study|customer|use case)\b/i;
const SELF_INTRO_PROMPT = /\b(tell me about yourself|walk me through|introduce yourself|your background|apne baare mein|introduction)\b/i;
const SPECIFICS = /\b\d+\s*(?:years?|months?|saal|mahine)\b|\b(?:built|led|shipped|launched|migrated|deployed|scaled|owned|drove|delivered|banaya|kiya tha|lead kiya)\b/i;
const BENEFITS_PROMPT = /\b(joining bonus|signing bonus|clawback|probation|bond|service agreement|esop|rsu|vesting|cliff|insurance|epf|provident fund|gratuity|nps|variable pay)\b/i;

/* Depth validators — distinguish shallow signals from real engagement.
   NOTICE_DEPTH:    real notice-period plan (buyout, handover, LWD,
                    early release, garden leave) beyond just raw days.
   BGV_DOC_NAMED:   candidate-side BGV literacy — did they name a
                    specific document (Form 16 / UAN / payslip /
                    relieving letter / Aadhaar / PAN / EPFO)?
   COMP_PROBE_RE:   did the candidate ASK about ESOP cliff / variable
                    payout / clawback / vesting terms? HR offers
                    benefits; a candidate who never probes accepts blind. */
const NOTICE_DEPTH = /\b(?:buy[- ]?out|hand[- ]?over|knowledge transfer|kt plan|early release|negotiate (?:my )?notice|reduce (?:my )?notice|serve (?:full|partial|out)|garden(?:ing)? leave|lwd (?:of|is|on|will be)|last working day (?:of|on|is|will be)|relieving (?:date|letter on|on)|formal resignation|notice buyout|notice negotiate)\b/i;
const BGV_DOC_NAMED = /\b(?:form\s*16|uan|pay\s*slips?|relieving letter|experience letter|pan(?:\s*card)?|aadha+r|epfo|epf statement|salary slip|appointment letter)\b/i;
const COMP_PROBE_RE = /\b(?:what(?:'?s| is) the (?:cliff|vesting|variable|clawback|payout|breakup)|cliff (?:period|duration|of)|vesting (?:schedule|period|cliff|over)|variable (?:payout|percentage|%|pay out)|clawback (?:terms|duration|period|amount)|how (?:much|long) is the (?:cliff|vesting|clawback|variable)|joining bonus clawback|esop (?:vest|cliff|schedule|grant)|when does the (?:variable|bonus|esop) (?:pay|vest|kick)|kya cliff hai|cliff kitna|variable kitna)\b/i;

/* Counter-offer + probation guards.
   COUNTER_OFFER_VOLUNTEERED / DECLINE: candidate self-discloses an
     active retention attempt. Indian-market reality — counter-offers
     arrive in ~40% of senior switches; HR's #1 fear is the post-counter
     retraction. Raising one without firmly declining reads as flight
     risk confirmed.
   PROBATION_PROMPT / PROBE: services-track probation is 3-6 months
     with termination-without-cause clauses. Candidate who never probes
     duration / confirmation criteria / pay-during-probation accepts
     blind — the classic month-4 termination shock pattern. */
const COUNTER_OFFER_VOLUNTEERED = /\b(?:my (?:current )?(?:employer|company|manager|boss) (?:is likely to|might|will|may) (?:counter|match|come back)|current (?:employer|company) (?:gave|offered|made) (?:me )?(?:a )?counter|already (?:got|received|have) (?:a )?counter[- ]?offer|they'?re (?:trying to|going to) match|trying to retain me|retention (?:offer|bonus) on the table|they want me to stay|they'?re working on (?:a |my )?revised (?:offer|package)|(?:my )?manager has spoken to (?:leadership|hr|skip)|hr called me (?:yesterday|today|last week) (?:about|on)|asked me to (?:think|reconsider) before resigning|asked me to (?:wait|hold) before resigning|they'?re putting together (?:a |an )?(?:counter|revised|new offer))\b/i;
const COUNTER_OFFER_DECLINE = /\b(?:i (?:declined|refused|turned (?:it )?down|rejected) (?:it|the counter|their offer)|told them no|not (?:taking|considering|accepting) (?:the |their |any )?counter|will not entertain|won'?t entertain|already (?:said|told them) no|no chance i (?:take|accept))\b/i;
const PROBATION_PROMPT = /\b(probation(?:ary)?(?:\s+period)?|probationary|confirmation(?:\s+period)?|under probation|during probation)\b/i;
const PROBATION_PROBE = /\b(?:how long is the probation|probation (?:period|duration|length) (?:is|of)|(?:what'?s|what is) the (?:probation|confirmation) (?:period|criteria|process)|confirmation (?:criteria|review|process)|probation pay|salary during probation|notice (?:during|in) probation|probation kitni|probation kab tak|kya criteria hai)\b/i;
const HIKE_RATIONALE = /\b(market|benchmark|levels|glassdoor|range|peers?|competing|other offer|levels\.fyi|because i|since i'?ve|scope|impact|delivered|saved|drove|market rate|market mein)\b/i;

/* Service bond literacy — TCS / Infosys / Wipro / Accenture training
   bonds are 1-2 years with breakage penalties (₹50k-2L). Indian HR
   raises "bond" or "service agreement" and candidate should probe
   duration / breakage / pro-rate. Distinct from clawback (which
   covers joining-bonus repayment); bond covers service-period
   commitment. */
const BOND_PROMPT = /\b(?:service\s+bond|training\s+bond|(?:two|one|1|2)[\s-]year\s+bond|service\s+agreement|bond\s+(?:period|amount|duration|penalty)|surety|notarized\s+bond)\b/i;
const BOND_PROBE_RE = /\b(?:bond (?:period|duration|amount|breakage|penalty|pro[- ]?rate)|how (?:much|long) is the bond|what(?:'?s| is) the bond (?:period|amount|penalty)|breakage (?:fee|amount|penalty)|early exit (?:penalty|cost)|bond kitne (?:saal|years)|bond ki (?:duration|amount))\b/i;

/* Pedigree / CGPA probe — Indian HR routinely probes college tier
   + graduation CGPA in the first 90 seconds for <5yoe candidates.
   Practice equals reality even if it's questionable. Candidate
   who deflects ("I don't remember exactly") under 5 YOE reads as
   hiding a sub-7 CGPA — a real screen-out signal at IT services
   and consulting hires. */
const PEDIGREE_PROMPT = /\b(?:cgpa|gpa|graduation marks|college tier|which (?:college|university|institute)|tenth (?:percentage|marks)|twelfth (?:percentage|marks)|(?:10th|12th|hsc|ssc) (?:percentage|marks|score)|graduation (?:from|in|year))\b/i;
const PEDIGREE_EVASION = /\b(?:don'?t remember (?:exactly|the (?:exact )?(?:number|cgpa|percentage))|long time ago|doesn'?t matter (?:now|anymore)|why does (?:that|it) matter|pata nahi exact|yaad nahi)\b/i;

/* Salary breakup vagueness — when HR asks for the fixed/variable/bonus
   split and the candidate only gives a single CTC number with no
   component breakdown. Indian HR treats single-number CTC answers as a
   red flag (variable rarely paid out is the classic inflation). */
const BREAKUP_ASKED = /\b(?:fixed|variable|joining\s+bonus|retention\s+bonus|rsu|esop|breakup|break[- ]?up|split|component|structure)\b[\s\S]{0,40}\b(?:ctc|comp|package|salary)\b|\bctc[\s\S]{0,40}\b(?:fixed|variable|breakup|break[- ]?up|split|component|structure)\b/i;
const BREAKUP_DETAIL = /\b(?:fixed|base)\b[\s\S]{0,30}\b(?:variable|bonus|rsu|esop)\b|\b\d{1,3}(?:[.,]\d{1,2})?\s*(?:lpa|lakhs?|lakh|l\b)\s*(?:fixed|base|variable|bonus|rsu)\b|\bvariable\s+is\s+\d|\bjoining\s+bonus\s+(?:of\s+)?\d/i;
/* Honest-unknown carve-out for salary_breakup_vague. ~80% of mid-level
   Indian candidates don't actually know their variable payout %
   history — their employer doesn't share it. Flagging an honest "I
   don't know the exact variable split" as vague is a false positive.
   We still want a follow-up flag (`salary_breakup_unknown_owned`) so
   the report can coach "go find out before the next round" — but it's
   low severity, not a credibility hit. */
const BREAKUP_GENUINELY_UNKNOWN = /\b(?:i (?:don'?t|do not) (?:actually )?know (?:the )?(?:exact )?(?:variable|payout|breakup|split)|(?:my )?company (?:doesn'?t|does not) share (?:the )?(?:variable|payout)|never (?:got|seen) (?:the )?(?:exact )?breakup|payout (?:history|details) (?:isn'?t|aren'?t|not) shared|not transparent (?:on|about) variable|variable (?:payout )?isn'?t (?:disclosed|shared|transparent))\b/i;

/* Over-deferential opener — "thank you so much sir/ma'am, it's an
   honour" / "respected ma'am". Sounds polite but reads as juniorish /
   services-coded at FAANG / GCC / consulting / BFSI-global HR rounds.
   Persona-conditional intent: this is bad under hr-bp-firm at top-tier
   companies; tolerated at services/early-career. We can't access the
   persona inside the analyzer cleanly yet, so we gate on tier proxy via
   the difficulty + transcript length (mid+ with long-form session). */
const DEFERENTIAL_OPENER = /\b(?:respected (?:sir|ma'?am|madam)|honou?rable (?:sir|ma'?am)|it'?s (?:an |such )?(?:honou?r|privilege|great honou?r) (?:to be|to have|to be (?:considered|here))|thank you so much (?:for|sir|ma'?am)[^.]{0,40}opportunity|thanks (?:a lot |so much )?(?:for|sir|ma'?am)[^.]{0,40}opportunity|(?:first of all|firstly)[\s,]+thank you[^.]{0,40}(?:sir|ma'?am|opportunity)|i'?m (?:very |so |really )?(?:grateful|thankful|honou?red) (?:to|for|that)[^.]{0,40}(?:opportunity|considered|shortlist))\b/i;

/* Candidate-raises-comp pattern — shared by `comp_held_until_close`
   (positive signal: held off in the first 3 turns) and
   `ctc_first_question_user` (negative signal: opened with it). Single
   canonical regex; the two detection blocks differ only in which
   turn-window they apply it to. */
const COMP_RAISED_BY_USER = /\b(?:what(?:'?s| is) the (?:ctc|package|salary|pay|comp)|how much (?:does|will) (?:this|the role) pay|salary range|ctc range|package (?:offered|kya hai)|what are you offering|expected (?:ctc|package))\b/i;

/* Reference-check stalling — HR asks for ex-manager references and the
   candidate stalls/refuses. In India, "current manager doesn't know I'm
   leaving" is fine; "I'd rather not share any references" is a hard stop. */
const REFERENCE_PROMPT = /\b(reference(?:s)?|ex[- ]?manager|previous manager|former manager|reference check)\b/i;
const REFERENCE_REFUSAL = /\b(?:no references|don'?t want to share (?:any )?references?|rather not (?:give|share|provide) (?:any )?references?|no one to (?:give|share)|references nahi|reference nahi de sakta)\b/i;
/* Legitimate Indian carve-out: candidate offers ex-employer references
   but withholds CURRENT-employer reference until offer letter is in
   hand. Sharing your current manager before resignation gets you fired —
   this isn't evasion, it's universal Indian practice. */
const REFERENCE_CURRENT_DEFERRED = /\b(?:current (?:manager|employer|boss|company)[^.]{0,80}(?:after (?:the )?offer|once (?:i|the offer) (?:have|is) (?:the )?offer|post offer letter|after offer letter)|happy to share (?:ex|previous|former|past) (?:managers|employers)|can share (?:references )?from (?:ex|previous|former) (?:employers|managers|companies))\b/i;

/* Offer-letter-delay anxiety — candidate volunteers worry about
   verbal-offer-to-written-offer gap, exploding offers, or other
   pre-joining anxieties. Surfacing this lets the coach prep the
   candidate to ask cleanly rather than spiral mid-interview. */
const OFFER_DELAY_ANXIETY = /\b(?:when (?:will|do) i get the (?:written|formal) offer|how long (?:until|till) (?:the )?offer letter|offer letter (?:will|when) (?:come|arrive|be (?:sent|shared))|verbal offer.*written|exploding offer|offer (?:will )?expire|deadline to (?:accept|decide)|how (?:much )?time to (?:accept|decide))\b/i;

/* Prior BGV failure — HR fishes for it; honest admission with context
   beats discovery during onboarding. Detect when HR asks and the user
   admits failure without context (date, reason, resolution). */
const PRIOR_BGV_FAIL_PROMPT = /\b(?:ever fail(?:ed)? (?:a )?(?:background|bgv) check|prior bgv (?:failure|issue)|any bgv (?:fail|issue|discrepancy))\b/i;
const PRIOR_BGV_FAIL_ADMIT = /\b(?:yes,?\s*(?:i|once|there)|once it (?:did|happened|failed)|i did fail|there was an issue|it got flagged)\b/i;
const PRIOR_BGV_CONTEXT = /\b(?:in\s+\d{4}|in\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|because|due to|reason was|resolved|cleared|sorted)\b/i;

/* Non-compete / NDA bind — common in BFSI, consulting, IP-heavy roles.
   Detect when candidate volunteers a restriction but doesn't quantify
   it (duration, geography, scope). Vague "I have a non-compete" is a
   recruiter timebomb. */
const NONCOMPETE_MENTION = /\b(?:non[- ]?compete|non[- ]?solicit|garden(?:ing)?\s+leave|cooling[- ]?off period|restraint of trade|i\s*p\s+assignment|moonlight(?:ing)?\s+restriction)\b/i;
const NONCOMPETE_QUANTIFIED = /\b(?:\d+\s*(?:months?|years?|days?)|expires? (?:on|in)|until\s+\d|geography|industry|sector|covers?\s+(?:competitors|clients))\b/i;

/* GenAI usage disclosure — 2026's #1 new HR probe. If asked about
   ChatGPT/Copilot use during take-home and the candidate dodges or
   denies flatly, that's the red flag. Honest "yes, for X, verified by Y"
   is the strong signal. */
const GENAI_PROMPT = /\b(?:chat\s*gpt|copilot|cursor|claude|gemini|gen\s*ai|ai\s+(?:tool|assist)|llm)\b[\s\S]{0,40}\b(?:use|using|used|help|during)\b|\b(?:use|using|used)\b[\s\S]{0,30}\b(?:chat\s*gpt|copilot|cursor|claude|gemini|gen\s*ai|llm)\b/i;
const GENAI_DENIAL = /\b(?:no,?\s*(?:i|never|not at all)|i didn'?t use|never used|absolutely not|of course not)\b/i;
const GENAI_HONEST = /\b(?:yes,?\s*(?:i|for|i used)|i used (?:it|chat|copilot|cursor|claude)|i did use|for (?:boilerplate|syntax|drafts|brainstorm|debugging)|verified (?:by|with)|then i (?:reviewed|verified|tested))\b/i;

/* Loyalty extraction — "promise me you won't leave in 2 years" ritual,
   especially at services firms. The right answer is calibrated honesty
   ("I plan for 3+ years but can't promise"), not a flat yes/no. */
const LOYALTY_PROMPT = /\b(?:promise (?:me )?you (?:won'?t|will not) leave|commit to (?:at least )?\d+ years|stay (?:for|at least) \d+ years|not (?:leaving|switching) (?:for|in) \d+ years)\b/i;
const LOYALTY_FLAT_YES = /\b(?:yes,?\s*(?:i (?:promise|commit|will|won'?t))|absolutely,?\s*i (?:promise|commit|won'?t)|sure,?\s*i (?:promise|commit|won'?t))\b/i;

/* Aspiration conflict — when candidate mentioned founder/MBA/own-company
   ambitions earlier and HR probes "why join us then". A dodge or a
   contradictory walk-back is the failure mode. */
const ASPIRATION_PROBE = /\b(?:you mentioned (?:starting|wanting to start|founding|own company|mba|business)|why (?:join us|come here) (?:now|then|if))\b[\s\S]{0,80}\b(?:start|founder|own company|mba|business|venture)\b/i;
const ASPIRATION_WALKBACK = /\b(?:no,?\s*i (?:was|wasn'?t)|actually|i didn'?t mean|that was|i'?ve changed|not really|just (?:said|mentioned) it)\b/i;

/* Salary band mismatch — HR says "you're 30% above our band, what's
   your floor?" The candidate should hold a floor with rationale, not
   collapse to "whatever you can offer". */
const BAND_MISMATCH_PROMPT = /\b(?:(?:above|outside|over) (?:our|the) band|(?:we can'?t|cannot) (?:match|offer) (?:that|your number)|your (?:number|ask) is (?:high|outside)|what(?:'s| is) your (?:real )?floor|tighten (?:your )?ask)\b/i;
const FLOOR_COLLAPSE = /\b(?:whatever (?:you|the company) (?:can|offer)|i'?m (?:flexible|open to anything)|happy with (?:whatever|anything)|no specific (?:floor|number)|you decide)\b/i;

/* Reverse-interview quality — at close, HR invites questions. The
   candidate who asks zero or fluff ("what time do I start?") signals
   low engagement; substantive questions (team structure, success
   metric, manager style) signal strong fit. */
const REVERSE_INVITED = /\b(?:do you have (?:any )?questions for me|any questions (?:from your|for) (?:side|me)|anything you'?d like to ask)\b/i;
const REVERSE_FLUFF = /\b(?:no(?:t really)?,?\s*(?:nothing|no questions|all good|i'?m good)|just (?:wanted to know|curious about) (?:the )?(?:start date|joining date|location|timing))\b/i;
const REVERSE_SUBSTANTIVE = /\b(?:team structure|reporting (?:line|to)|success (?:metric|criteria|look like)|first (?:30|60|90) days|manager(?:'s)? style|growth path|attrition|tech stack|on[- ]?call|roadmap|investment in|how is success measured)\b/i;

/* Multi-probe RESOLUTION patterns — when a candidate initially hedges
   on BGV / payslip / reference but then eventually commits ("yes, I
   can share", "happy to provide", "I have them ready"). We track
   resolution across the session so a single bad reply doesn't lock
   them into a "high-severity evasion" flag if they corrected course
   on the follow-up probe. */
const BGV_RESOLVED = /\b(?:yes,?\s*i (?:can|will|have|am able to) (?:share|provide)|happy to (?:share|provide)|will (?:share|send|provide) (?:them|those|by)|i (?:have|already have) (?:them|those|the documents)|can definitely (?:share|provide))\b/i;
const REFERENCE_RESOLVED = /\b(?:i have (?:two |2 |references? ready|some references?)|yes,?\s*(?:references? )?(?:are )?(?:ready|available)|will (?:share|provide) (?:references?|their (?:names?|contacts?))|happy to (?:share|provide) references?)\b/i;

/* ── Wave-2 HR-round flags — real-life Indian HR scenarios ───────────── */

/* Job-hopping pattern — user volunteers 3+ short stints with no narrative.
   Indian HR treats <18-month tenures stacked together as instability unless
   the candidate proactively explains. */
const JOB_HOPPING_PROMPT = /\b(?:multiple (?:jobs|switches|companies)|short (?:stint|tenure)|job[- ]?hop|why so many (?:switches|companies)|tenure pattern|you'?ve switched (?:often|a lot))\b/i;
const SHORT_STINT_VOLUNTEERED = /\b(?:(?:6|7|8|9|10|11|12|13|14|15|16|17)\s*months?|less than (?:a |one )?year|year and a half|under (?:a )?year|1\.5\s*years?)\b/i;
const STINT_NARRATIVE = /\b(?:layoff|laid off|restructur|acquir|shut down|founder (?:exit|left)|team disbanded|relocat|family|health|growth|stretch role|learning curve|domain (?:change|shift)|bond complet|after my bond)\b/i;

/* Moonlighting probe — Wipro/Infosys post-2022 ritual. Flat denial of any
   side activity reads as evasive; honest disclosure with boundaries is strong. */
const MOONLIGHT_PROMPT = /\b(?:moonlight(?:ing)?|second job|side gig|side project|freelanc|consulting on the side|dual employ|two (?:jobs|companies)|outside work|other (?:income|engagement))\b/i;
const MOONLIGHT_FLAT_DENIAL = /\b(?:no,?\s*(?:nothing|never|none|absolutely not)|i don'?t|i never|of course not|nahi karta|kabhi nahi)\b/i;
const MOONLIGHT_HONEST = /\b(?:open[- ]?source|github|writing|blog|teach|tutor|udemy|youtube|side project|disclosed|with permission|on weekends|outside (?:my )?work hours|no client conflict)\b/i;

/* PF/UAN dual-employment — BGV-time discrepancy probe. Honest answer
   discloses + explains; evasion is the flag. */
const PF_UAN_PROMPT = /\b(?:uan|pf account|provident fund|epfo|dual (?:pf|uan)|overlapping (?:pf|contribution)|two (?:pf|uan))\b/i;
const PF_UAN_EVASIVE = /\b(?:not sure|don'?t know|haven'?t checked|let me check|no idea|pata nahi)\b/i;

/* Family-constraint freeze — relocation/marriage probe + freeze or one-word
   non-answer. Common at Indian service-tier; tests handling without bias. */
const FAMILY_PROBE = /\b(?:relocat\w*|location preference|marriage plans|married|family situation|spouse|elderly parents|home town|are you planning to (?:marry|settle|relocate))/i;
const FAMILY_FREEZE = /^(?:uh+|um+|hmm+|i\s+(?:don'?t know|umm|uhh)|that'?s personal|prefer not to (?:answer|discuss)|why are you asking|kyun pooch rahe)/i;

/* Joining-date over-promise — candidate promises <30 days while notice is
   60+. Indian HR treats this as either (a) lying about notice or (b)
   planning to ghost current employer. */
const JOIN_FAST_PROMISE = /\b(?:can join in (?:15|10|7|2)\s*days?|join (?:immediately|right away|next week|within (?:2|two) weeks)|two[- ]?week notice|abhi join|turant join)\b/i;
const NOTICE_LONG = /\b(?:60\s*days?|90\s*days?|three months?|two months?|teen mahine|do mahine)\b/i;

/* Clawback blind-accept — HR mentions clawback/bond, candidate says yes
   without asking duration/amount. Recipe for post-joining surprise. */
const CLAWBACK_PROMPT = /\b(?:clawback|claw[- ]?back|joining bonus.*(?:return|refund|forfeit)|bond.*(?:break|amount)|service agreement (?:terms|duration)|retention bonus.*(?:condition|lock))\b/i;
const CLAWBACK_BLIND_YES = /^(?:yes|sure|absolutely|no problem|that'?s fine|haan|theek hai|chalega)\b[\s\S]{0,80}$/i;
const CLAWBACK_INFORMED = /\b(?:what (?:are|is) the (?:terms|duration|amount)|how long|how much|pro[- ]?rate|after how many|prorated)\b/i;

/* RTO / 5-day office flat refusal — service-tier and most product-cos in
   2026 require WFO. Flat "I prefer WFH" with no negotiation is a dealbreaker. */
const RTO_PROMPT = /\b(?:5[- ]?day(?:s)? (?:in office|wfo|from office)|return to office|work from office|wfo policy|hybrid policy|in[- ]?office (?:days|policy)|how many days (?:in|from) office)\b/i;
const RTO_FLAT_REFUSAL = /\b(?:only (?:wfh|remote)|wfh only|cannot (?:come to office|do wfo|do 5 days)|i don'?t do (?:wfo|office)|prefer (?:fully |only )?remote|no office)\b/i;
const RTO_NEGOTIATED = /\b(?:can do|i can come|fine with|3 days|4 days|hybrid (?:works|is fine)|negotiable|happy to|will adjust|can arrange)\b/i;

/* Designation downgrade — candidate is Senior X applying for X. HR probes;
   defensive or ego-bruised answer is the flag. */
const DOWNGRADE_PROMPT = /\b(?:your current (?:title|designation) is (?:senior|lead|principal|staff|sr\.?)|why (?:would you )?accept (?:a )?(?:lower|junior|smaller) (?:title|role|designation)|title (?:downgrade|mismatch)|leveling (?:gap|difference))\b/i;
const DOWNGRADE_DEFENSIVE = /\b(?:not (?:a |really )?downgrade|that'?s not|title (?:doesn'?t|don'?t) matter to me|i don'?t care about (?:the |my )?title|titles? are (?:just |only )?labels)\b/i;

/* Certification claim gap — user lists AWS/PMP/GCP cert; HR probes when
   earned / expired / verifiable; user is vague. */
const CERT_PROBE = /\b(?:when did you (?:get|earn|clear) (?:the |your )?(?:aws|gcp|azure|pmp|csm|scrum|cka|ckad)|cert(?:ificate|ification) (?:date|valid|expir|number)|verify (?:your )?cert|cert(?:ificate)? id)\b/i;
const CERT_VAGUE = /\b(?:long (?:back|time ago)|few years (?:back|ago)|don'?t remember|some time (?:back|ago)|2 or 3 years|approximately|pata nahi|exact date)\b/i;

/* CTC-first opening uses the same pattern as COMP_RAISED_BY_USER —
   see the canonical regex defined above. Kept as a separate const
   name for clarity at the call site. */
const CTC_FIRST_USER = COMP_RAISED_BY_USER;

/* ── v5.4.0 realism additions ──────────────────────────────────────
 * Four HIGH-severity universal Indian-HR rituals not previously
 * detectable + three MEDIUM signals (ESOP literacy, bell-curve probe,
 * buyout split). All gated to long-form sessions so brisk TA screens
 * don't false-fire. */

/* multi_offer_undisclosed — HR probes "are you interviewing elsewhere"
   and the candidate answers vaguely ("yeah a few places") with no
   stage / company / timeline. Vague = weak leverage; HR uses this to
   size urgency. Honest specifics ("Razorpay round 3, offer expected by
   Friday") are the strong signal. */
const OTHER_OFFERS_PROMPT = /\b(?:other (?:offers?|processes?|interviews?)|interviewing elsewhere|active (?:offers?|processes?|conversations?)|in (?:the )?market with|elsewhere in (?:the )?market|kahin aur (?:interview|offer|process))\b/i;
const OTHER_OFFERS_VAGUE = /\b(?:yeah|yes|a few|couple of|some|two[- ]three|a couple)\b[^.]{0,60}\b(?:places?|companies|processes?|offers?|interviews?)\b/i;
/* v5.5.0: tightened. The previous version's `final round` / `round N`
   arms false-positived on candidates referring back to CURRENT
   conversation ("preparing for the final round here") and the proper-
   noun arm missed lowercase STT output ("at razorpay"). New version
   requires EITHER (a) a brand-name token paired with a stage, OR
   (b) a date/timeline anchor. Either signal alone is sufficient — both
   beats vague "a few places." */
const OTHER_OFFERS_SPECIFIC = /\b(?:(?:at|with)\s+(?:razorpay|swiggy|zomato|flipkart|amazon|google|microsoft|meta|stripe|paypal|phonepe|cred|zerodha|udaan|meesho|ola|uber|netflix|adobe|oracle|salesforce|sap|atlassian|linkedin|airbnb|booking|expedia|walmart|target|lowes|nvidia|intel|amd|qualcomm|cisco|ibm|deloitte|accenture|tcs|infosys|wipro|cognizant|capgemini|hcl|tech mahindra|mindtree)|offer (?:in hand|by|expected|on)|expecting (?:an? )?offer|by (?:friday|monday|tuesday|wednesday|thursday|next week|end of (?:week|month))|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(?:final|hr|onsite)\s+(?:round|interview)\s+(?:at|with|next)|round\s*\d\s+(?:at|with))/i;

/* location_flex_unprobed — FAANG India / GCC critical. Base-location
   (Hyd / Blr / Pune / Gurgaon) is non-negotiable but candidate never
   probes (a) base city, (b) relocation assistance, (c) temporary WFH
   for relo window. */
/* v5.5.0: split into TWO arms so incidental city mentions in HR's
   intro ("our Hyderabad team built X") don't false-fire. Either an
   explicit base-location keyword OR a city paired with role-location
   language. */
const HR_BASE_KEYWORD = /\b(?:base (?:location|city|out of)|primary (?:location|city|reporting)|reporting (?:location|to (?:our )?(?:office|campus)))\b/i;
const HR_CITY_WITH_ROLE = /\b(?:(?:role|position|job|seat|opening) (?:is )?(?:based )?(?:in|out of|at)|(?:located|based) (?:in|out of|at)|relocate to|move to)\s+(?:hyderabad|hyd|bangalore|bengaluru|blr|chennai|pune|gurgaon|gurugram|noida|delhi(?:\s+ncr)?|mumbai|bombay|kolkata|ahmedabad|kochi|trivandrum|chandigarh)\b/i;
const RELO_PROBED = /\b(?:relocat|relo|joining bonus for relo|(?:temporary|temp) (?:wfh|remote)|when do i need to be in|moving (?:cost|allowance)|relocation (?:assistance|allowance|package)|housing (?:allowance|support))\b/i;

/* reason_for_leaving_blame_framing — softer than BADMOUTHING. Catches
   subtler blame: "no growth", "wasn't valued", "politics". Universal
   Indian-HR screen — softer than "toxic" but equally disqualifying. */
const REASON_LEAVING_PROMPT = /\b(?:reason for (?:leaving|change|switch)|why (?:are you )?leaving|why (?:do you want to|are you looking to) (?:leave|move|switch))\b/i;
const BLAME_FRAMING = /\b(?:no growth|wasn'?t (?:supported|valued|heard|recognized|respected)|politics|favoritism|biased|manager (?:didn'?t|wasn'?t|isn'?t)|hr (?:didn'?t|wasn'?t)|toxic culture|no learning|stuck (?:there|in)|nothing to learn|micromanag|not (?:appreciated|valued))\b/i;
const FORWARD_FRAME = /\b(?:next (?:challenge|step|chapter)|want to (?:build|learn|own|drive|move into|grow into)|(?:looking|ready) for (?:a |the )?(?:next|new|bigger)|fresh (?:problem|domain|space)|domain (?:change|shift)|move into|expand my)\b/i;

/* reference_list_vague — distinct from REFERENCE_REFUSAL. Candidate
   offers references but doesn't NAME them ("yeah I have references",
   "couple of ex-managers" with no proper noun). Real HR scores
   named > vague. */
const REFERENCE_AFFIRMED_VAGUE = /\b(?:yeah|yes|sure|definitely|haan)[^.]{0,40}\b(?:references?|ex[- ]?managers?|previous managers?|former managers?|references? hai)\b/i;
/* v5.5.0: case-insensitive + accepts lowercase STT proper nouns
   ("anand from swiggy"). Triggered by an explicit relational
   construction (was my / my manager at / from / Mr/Ms prefix). */
const REFERENCE_NAMED = /\b(?:from|at|with)\s+[a-z][\w&.-]{2,}|\bmy\s+(?:manager|lead|director|vp|head|reporting)\s+(?:at|from|was)\s+[\w&.-]{2,}|\bwho\s+was\s+my\s+(?:manager|lead|director|vp|head)|\b(?:mr|ms|mrs|dr)\.?\s+[a-z][\w]+/i;

/* esop_literacy_low — product-unicorn / startup HR offers ESOP/RSU
   and candidate doesn't show literacy on the standard four terms:
   strike, cliff, vest schedule, double-trigger, FMV/409A. Critical
   for unicorn / pre-IPO comp. Distinct from comp_breakup_probe_missing
   (which fires when HR mentions benefits in general). */
const ESOP_HR_MENTION = /\b(?:esop|rsu|stock options?|equity (?:grant|package)|stock grant)\b/i;
const ESOP_LITERACY = /\b(?:strike (?:price|kya)|cliff (?:period|of|kitna)|vest (?:schedule|over|kitna)|double[- ]?trigger|fmv|409a|liquidation (?:preference)?|exercise window|tax on exercise|exercise period|preferred (?:stock|shares?)|common (?:stock|shares?)|secondary (?:sale|liquidity))\b/i;

/* bell_curve_pip_unprobed — universal at Amazon India / Microsoft
   India / TCS / Wipro. Candidate never probes performance
   calibration / stack rank / bell curve / PIP history / attrition.
   Long-form mid+ session expected to surface this. */
const BELL_CURVE_PROBED = /\b(?:bell curve|stack rank|forced rank|performance calibration|pip\b|performance improvement|attrition (?:rate|in)|regretted attrition|rating (?:distribution|cycle|curve)|calibration (?:cycle|process))\b/i;

/* buyout_split_unaddressed — when buyout is discussed but candidate
   doesn't probe WHO pays (new employer reimburses vs candidate self-
   funds vs split). Real negotiation lever; missing = lakhs left on
   table. */
const BUYOUT_MENTIONED = /\bbuy[- ]?out\b/i;
const BUYOUT_SPLIT_PROBED = /\b(?:reimburs|new (?:company|employer) (?:pay|cover|fund|reimburs)|split (?:the )?buyout|joining bonus (?:offset|cover|adjust)|who (?:pays|covers|funds) the buyout|covered by|offset (?:against|by) (?:joining|signing))\b/i;

/* ── v5.5.0 realism additions ──────────────────────────────────────
 * Five HIGH/MEDIUM Indian-HR gaps surfaced in the post-v5.4.0 audit. */

/* hybrid_expectation_mismatch — candidate states fully-remote / never-
   in-office posture when HR has framed RTO/hybrid as default. Distinct
   from rto_flat_refusal which requires HR to ask "how many days?"
   first; this fires when the candidate VOLUNTEERS an absolutist remote
   demand. Common at GCC / unicorn rounds where 3-day hybrid is policy. */
const FULLY_REMOTE_DEMAND = /\b(?:(?:i'?m |i am |i'?d )?(?:looking for|need|want|require) (?:fully |100\s*%? |permanent(?:ly)? )?remote|never (?:come|coming) (?:to|into) (?:the )?office|fully remote only|100\s*%? remote (?:only|preferred|required)|wfh permanent|can'?t (?:do|come to) office|no office days)\b/i;
const HYBRID_NEGOTIATION = /\b(?:can do|happy to|fine with|will do)\s*(?:\d+\s*days?|hybrid|some office|few days)|ramp[- ]?up (?:in[- ]?office|period)|first (?:30|60|90)\s*days?\s+in/i;

/* visa_sponsorship_demand_unprompted — candidate raises H1B / blue
   card / onsite sponsorship for what's framed as an India-IC role.
   GCC and unicorns treat this as misalignment. */
const VISA_DEMAND = /\b(?:h[\s-]?1\s?b|h1b|green\s*card|blue\s*card|sponsor (?:my )?(?:visa|relocation)|visa sponsorship|onsite (?:opportunity|within|in)\s*\d+\s*(?:months?|years?)|us (?:onsite|deputation)|uk (?:onsite|deputation)|sg (?:onsite|deputation))\b/i;

/* salary_review_cycle_unprobed — mid+ candidate accepts comp without
   asking review/appraisal cycle. Indian HR expects this question. */
const REVIEW_CYCLE_PROBE = /\b(?:review cycle|appraisal cycle|increment cycle|hike cycle|off[- ]?cycle|next (?:hike|review|appraisal)|promo cycle|promotion cycle|when (?:is|are) the (?:next )?(?:review|appraisal|hike|increment)|how (?:often|frequent) (?:are the )?(?:reviews|appraisals|hikes))\b/i;

/* tax_structure_naive — mid+ candidate at ₹25L+ talks only about
   gross/fixed without engaging Section 80C, NPS, LTA, meal cards,
   flexi-basket, take-home. Indian HR expects this fluency at senior. */
const TAX_STRUCTURE_PROBE = /\b(?:80\s*c|nps(?:\s+(?:employer|contribution))?|flexi (?:basket|component|pay)|meal (?:card|voucher|coupon)|sodexo|lta|leave travel|take[- ]?home|in[- ]?hand|tax (?:optim|saving|efficient)|gratuity calcul|section\s+80)\b/i;

/* tier1_college_default_assumption — candidate from non-tier-1 over-
   apologises pre-emptively when HR never raised pedigree. Internalised
   bias signal; low confidence read. */
const PEDIGREE_PRE_APOLOGY = /\b(?:i know my college isn'?t|despite (?:my )?(?:college|tier|background)|not from (?:iit|nit|iiit|bits|iim)|tier[- ]?[23](?:\s+college)?|though i'?m not from|even though my college|coming from a tier[- ]?[23])\b/i;

/* ── Resume cross-checks ─────────────────────────────────────────────
 * When the cron loads the user's resume by resume_version_id, three
 * extra checks fire:
 *   - resume_transcript_mismatch — employers named verbally that don't
 *     appear in the resume's experiences (BGV will catch this).
 *   - resume_gap_unaddressed — resume has a ≥3-month gap between two
 *     experiences and HR never probed it. Coaching nudge: the gap WILL
 *     come up in a real round; prepare a crisp one-liner now.
 *   - inflated_seniority_claim — resume / transcript title says
 *     "Senior / Lead / Staff" but resume YoE is <3. Indian HR cross-
 *     checks the level against years; mismatch reads as inflation.
 *
 * All three are silent no-ops when `resume` is null / empty. */
const TRANSCRIPT_EMPLOYER_RE = /\b(?:worked\s+at|was\s+at|joined|employed\s+at|currently\s+(?:at|with)|previously\s+at|my\s+(?:current|previous|last|ex)\s+(?:company|employer)\s+(?:is|was)|company\s+called)\s+([A-Z][\w&.-]*(?:\s+[A-Z][\w&.-]*){0,3})/g;
const SENIOR_TITLE_RE = /\b(?:senior|sr\.?|lead|staff|principal|architect|head\s+of|director|vp|vice\s+president)\b/i;
const CAREER_BREAK_PROMPT = /\b(career\s+break|sabbatical|time\s+off|not\s+working|between\s+(?:jobs|roles)|year\s+off)\b/i;

function normalizeEmployerName(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|corporation|corp|technologies|technology|tech|labs|solutions|systems|india|llp)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokensOverlap(a: string, b: string): boolean {
  const na = normalizeEmployerName(a);
  const nb = normalizeEmployerName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && (nb.includes(na) || na.includes(nb))) return true;
  const ta = new Set(na.split(/\s+/).filter((w) => w.length >= 3));
  const tb = new Set(nb.split(/\s+/).filter((w) => w.length >= 3));
  for (const w of ta) if (tb.has(w)) return true;
  return false;
}

/* Parse a resume "period" string into approximate {start,end} dates.
 * Tolerates: "Jan 2022 - Mar 2023", "2020 - present", "Jul 2021 — Dec 2022", "2018-2021".
 * Returns null on anything ambiguous — we'd rather under-fire than
 * fabricate a fake gap. */
// parseResumePeriod now lives in `server-handlers/_resume-period.ts`
// (shared with campus-placement). Behavior unchanged — same regex, same
// year-expansion cutoff, same MONTHS map.

interface ResumeSummary {
  employers: string[];
  titles: string[];
  yoeMonths: number | null;
  gapsMonths: number[];
}
function summarizeResume(resume: ResumeForAnalyzer | null | undefined): ResumeSummary {
  const empty: ResumeSummary = { employers: [], titles: [], yoeMonths: null, gapsMonths: [] };
  if (!resume || !Array.isArray(resume.experiences) || resume.experiences.length === 0) return empty;
  const employers = resume.experiences
    .map((e) => (e?.company || "").trim())
    .filter((s) => s.length >= 2);
  const titles = resume.experiences
    .map((e) => (e?.title || "").trim())
    .filter((s) => s.length >= 2);
  const periods = resume.experiences
    .map((e) => parseResumePeriod(e?.period))
    .filter((p): p is { start: Date; end: Date } => p !== null)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  let yoeMonths: number | null = null;
  if (periods.length > 0) {
    const total = periods.reduce(
      (acc, p) => acc + Math.max(0, (p.end.getTime() - p.start.getTime()) / (30 * 86400 * 1000)),
      0,
    );
    yoeMonths = Math.round(total);
  }
  const gapsMonths: number[] = [];
  for (let i = 1; i < periods.length; i++) {
    const gapMs = periods[i].start.getTime() - periods[i - 1].end.getTime();
    const gapM = Math.round(gapMs / (30 * 86400 * 1000));
    if (gapM >= 3) gapsMonths.push(gapM);
  }
  return { employers, titles, yoeMonths, gapsMonths };
}

const DIMENSIONS = ["logistics", "comp", "stability", "compliance", "commitment", "benefits", "motivation"] as const;
type Dimension = typeof DIMENSIONS[number];
const DIMENSION_PATTERNS: Record<Dimension, RegExp> = {
  logistics: NOTICE_PERIOD,
  comp: ASKED_ABOUT_SALARY,
  stability: /\b(why (?:are you )?leaving|reason for (?:change|leaving|switch)|switched? (?:jobs|companies)|tenure|gap)\b/i,
  compliance: BGV_PROMPT,
  commitment: COUNTER_OFFER_PROMPT,
  benefits: BENEFITS_PROMPT,
  motivation: WHY_COMPANY_PROMPT,
};

/* LLM rescore rubrics for weak-regex flags. Static — moved to module
   scope so it's not rebuilt per analyze() call. */
const RESCORE_RUBRICS: Record<string, string> = {
  generic_why_company: "Did the candidate name a verifiable specific (launch name, leader name, blog title, recent move, product, domain)? If yes, the flag is FALSE.",
  counter_offer_dodge: "Did the candidate commit OR did they only defer? If they deferred WITH a stated decision criterion (e.g. 'I'll commit once the role scope is locked'), the flag is FALSE. Pure 'I'll see' / 'we'll see' / 'dekhta hu' is TRUE.",
  generic_self_intro: "Does the intro have a narrative arc (years of experience + role + an outcome / project)? If yes, the flag is FALSE. Purely token-listing (skills, tech stack) with no story is TRUE.",
  reason_for_leaving_blame_framing: "Did the candidate frame the reason for leaving primarily through a FORWARD pull (next challenge, new domain, scope expansion) even if some backward facts (politics, no growth) are mentioned? If a forward frame is present alongside, the flag is FALSE. Pure backward blame with no forward pull is TRUE.",
  multi_offer_undisclosed: "Did the candidate name a specific company OR a specific timeline OR a specific stage for any other offer? Even one specific anchor (company name, expected-by date, round-stage) means the flag is FALSE. Pure 'a few places' / 'some companies' / 'yeah I'm interviewing' with zero specifics is TRUE.",
  reference_list_vague: "Did the candidate name a referee (first name, role, or company), OR specifically defer ('current manager doesn't know yet, will share post-offer')? Either case the flag is FALSE. Pure 'yeah I have references' / 'a couple of ex-managers' with no proper noun and no deferral context is TRUE.",
};

/* Coaching clusters — group flags by theme so the report leads with
   "pattern" framing when ≥2 flags in a cluster fire. Indian HR scores
   compliance and commitment as patterns, not isolated mistakes —
   telling the candidate "3 evasive signals across compliance" lands
   harder than 3 separate one-liners. Per-flag tips still follow so
   the candidate sees the per-issue specifics. */
const CLUSTERS: ReadonlyArray<{ label: string; theme: string; members: ReadonlyArray<string> }> = [
  {
    label: "compliance",
    theme: "BGV / documentation",
    members: [
      "bgv_document_evasion",
      "bgv_document_evasion_sustained",
      "bgv_document_initial_hedge",
      "payslip_refusal",
      "payslip_refusal_sustained",
      "reference_refusal",
      "reference_refusal_sustained",
      "reference_initial_hedge",
      "prior_bgv_fail_uncontextualised",
      "certification_gap_evasion",
      "pf_uan_evasive",
      "bgv_literacy_low",
    ],
  },
  {
    label: "commitment",
    theme: "pre-joining commitment",
    members: [
      "counter_offer_dodge",
      "offer_letter_delay_anxiety",
      "joining_date_overpromise",
      "aspiration_walkback",
      "loyalty_overcommit",
      "notice_period_shallow",
      "comp_breakup_probe_missing",
      "current_employer_counter_unresolved",
      "probation_terms_unprobed",
      "bond_terms_unprobed",
      "salary_breakup_unknown_owned",
      "esop_literacy_low",
      "bell_curve_pip_unprobed",
      "buyout_split_unaddressed",
    ],
  },
  {
    label: "stability",
    theme: "switch rationale / tenure",
    members: [
      "gap_unexplained",
      "resume_gap_unaddressed",
      "job_hopping_pattern",
      "user_badmouthing_employer",
      "reason_for_leaving_blame_framing",
    ],
  },
  {
    label: "credibility",
    theme: "resume cross-checks",
    members: [
      "resume_transcript_mismatch",
      "inflated_seniority_claim",
      "moonlighting_flat_denial",
      "genai_flat_denial",
      "pedigree_evasion",
      "over_deferential_opener",
      "multi_offer_undisclosed",
      "reference_list_vague",
    ],
  },
  {
    label: "logistics",
    theme: "logistics clarity",
    members: [
      "vague_notice_period",
      "notice_period_shallow",
      "joining_date_overpromise",
      "rto_flat_refusal",
      "family_constraint_freeze",
      "location_flex_unprobed",
      "hybrid_expectation_mismatch",
    ],
  },
  /* v5.5.0 new cluster — comp maturity. Surfaces "you negotiated like
     a fresher" pattern: comp number alone, no review cadence, no tax
     fluency, no equity literacy. Indian HR weights this cluster hard
     at mid-senior — anchors comp band on perceived sophistication. */
  {
    label: "comp_maturity",
    theme: "compensation sophistication",
    members: [
      "salary_review_cycle_unprobed",
      "tax_structure_naive",
      "esop_literacy_low",
      "comp_breakup_probe_missing",
      "buyout_split_unaddressed",
      "floor_collapse",
    ],
  },
  /* v5.5.0 new cluster — register / fit signals. Surfaces "low
     confidence" pattern: pre-apology for pedigree, deferential opener,
     pre-emptive visa demand misaligning with seat. */
  {
    label: "register_fit",
    theme: "register + role-seat fit",
    members: [
      "over_deferential_opener",
      "tier1_college_default_assumption",
      "visa_sponsorship_demand_unprompted",
      "designation_downgrade_defensive",
    ],
  },
];

export const hrRoundAnalyzer: FocusAnalyzer = {
  focus: "hr-round",
  version: "hr-round-v5.5.0",

  async analyze({ session, resume }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) {
      result.flags.push("empty_transcript");
      return result;
    }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];
    /* Evidence collected for weak-regex flags that get a 2nd-pass
       semantic-coherence LLM rescore at the end of analyze(). Map key
       is the flag name; value is the AI prompt + user reply the regex
       fired on. When LLM_RESCORE_ENABLED=0 the map is built but never
       consumed — cheap. */
    const rescoreEvidence = new Map<string, { aiPrompt: string; userReply: string }>();
    const aiText = transcript.filter(isAi).map((t) => t.text || "").join(" ");
    const userText = transcript.filter(isUser).map((t) => t.text || "").join(" ");
    const allText = `${aiText} ${userText}`;

    let anchorLeaked = false;
    let aiAskedAt = Infinity;
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && ASKED_ABOUT_SALARY.test(t.text || "") && i < aiAskedAt) aiAskedAt = i;
      if (isUser(t) && SALARY_NUMBER.test(t.text || "") && i < aiAskedAt) anchorLeaked = true;
    }
    if (anchorLeaked) {
      flags.add("user_anchor_leaked_salary");
      gaps.push({ dimension: "negotiation_protection", expected: "User holds salary number until HR explicitly asks", observed: "User volunteered a number before being asked — costs leverage", severity: "high" });
    }

    if (BADMOUTHING.test(userText)) {
      flags.add("user_badmouthing_employer");
      gaps.push({ dimension: "professionalism", expected: "Frame past challenges constructively, never personally", observed: "Negative language about previous employer detected", severity: "high" });
    }

    if (transcript.length > 6 && !NOTICE_PERIOD.test(allText)) flags.add("notice_period_never_discussed");

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && NOTICE_ASKED.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.length < 180 && NOTICE_VAGUE.test(r.text) && !NOTICE_CONCRETE.test(r.text)) {
          flags.add("vague_notice_period");
          gaps.push({ dimension: "logistics_clarity", expected: "Crisp notice period (e.g. '60 days, buyout possible') and earliest LWD", observed: "Candidate hedged on notice period — Indian HR treats this as flight risk", severity: "medium" });
          break;
        }
      }
    }

    /* notice_period_shallow. Concrete notice answer
       ("60 days") but no buyout / handover / LWD / early-release
       discussion across the whole session. Mid-senior HR rounds expect
       depth here; the shallow answer leaves comp-of-buyout and handover
       blind spots that surface at offer time. */
    {
      const hrAskedNotice = transcript.some((t) => isAi(t) && NOTICE_ASKED.test(t.text || ""));
      const candidateGaveConcrete = transcript.some(
        (t) => isUser(t) && NOTICE_CONCRETE.test(t.text || "") && (t.text || "").length < 220,
      );
      const depthDiscussed = NOTICE_DEPTH.test(allText);
      if (
        hrAskedNotice &&
        candidateGaveConcrete &&
        !depthDiscussed &&
        !flags.has("vague_notice_period") &&
        transcript.length > 6
      ) {
        flags.add("notice_period_shallow");
        gaps.push({
          dimension: "logistics_clarity",
          expected: "Beyond raw days: buyout policy, handover / KT plan, earliest LWD, and early-release options",
          observed: "Candidate stated notice in days but never discussed buyout, handover, or LWD — shallow for mid-senior HR rounds",
          severity: "medium",
          flag: "notice_period_shallow",
        });
      }
    }

    if (SELF_INTRO_PROMPT.test(aiText)) {
      const idx = transcript.findIndex((t) => isAi(t) && SELF_INTRO_PROMPT.test(t.text || ""));
      const r = replyTo(transcript, idx);
      if (r && r.text && r.text.length >= 60 && !SPECIFICS.test(r.text)) {
        flags.add("generic_self_intro");
        gaps.push({ dimension: "specificity", expected: "Self-intro includes years of experience, concrete projects, results", observed: "Self-intro lacked numbers, project names, or action verbs", severity: "medium", flag: "generic_self_intro" });
        rescoreEvidence.set("generic_self_intro", {
          aiPrompt: transcript[idx]?.text || "",
          userReply: r.text || "",
        });
      }
    }

    /* BGV multi-probe tracker. Old behavior: first evasive reply → flag,
       break. New behavior: walk every probe in the session, tally
       evasions vs eventual resolution. Sustained evasion across ≥2
       probes is high-severity; single-probe evasion that's later
       resolved is downgraded to medium (still worth coaching but not a
       "BGV will block onboarding" panic). */
    {
      let probes = 0;
      let evasions = 0;
      let resolved = false;
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        if (!(isAi(t) && BGV_PROMPT.test(t.text || ""))) continue;
        probes += 1;
        const r = replyTo(transcript, i);
        if (!r || !r.text) continue;
        if (BGV_EVASIVE.test(r.text)) evasions += 1;
        if (BGV_RESOLVED.test(r.text)) resolved = true;
      }
      if (evasions > 0 && !resolved) {
        flags.add("bgv_document_evasion");
        const sustained = probes >= 2 && evasions >= 2;
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Comfort sharing payslips, Form 16, relieving letters, PAN/Aadhaar/UAN for BGV",
          observed: sustained
            ? `Candidate hedged across ${evasions} of ${probes} BGV probes without recovering — BGV will block onboarding`
            : "Candidate hedged or refused on document sharing — BGV will block onboarding",
          severity: "high",
          flag: "bgv_document_evasion",
        });
        if (sustained) flags.add("bgv_document_evasion_sustained");
      } else if (evasions > 0 && resolved) {
        // Recovered: downgrade to a softer commitment-confidence flag.
        flags.add("bgv_document_initial_hedge");
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Answer BGV-doc probes crisply on the first ask — initial hedges read as flight risk even when followed by yes",
          observed: "Candidate hedged on a BGV probe before recovering on a later probe — recoverable but tighten the first answer",
          severity: "low",
          flag: "bgv_document_initial_hedge",
        });
      }
    }

    /* Payslip refusal tracker — same cumulative pattern as BGV. */
    {
      let probes = 0;
      let refusals = 0;
      let resolved = false;
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        if (!(isAi(t) && PAYSLIP_PROMPT.test(t.text || ""))) continue;
        probes += 1;
        const r = replyTo(transcript, i);
        if (!r || !r.text) continue;
        if (PAYSLIP_REFUSED.test(r.text)) refusals += 1;
        if (BGV_RESOLVED.test(r.text)) resolved = true;
      }
      if (refusals > 0 && !resolved) {
        flags.add("payslip_refusal");
        if (!flags.has("bgv_document_evasion")) {
          const sustained = probes >= 2 && refusals >= 2;
          gaps.push({
            dimension: "comp_transparency",
            expected: "Share payslips/Form 16 when asked — refusal signals inflated current CTC",
            observed: sustained
              ? `Candidate refused payslip share across ${refusals} of ${probes} probes — HR will assume current CTC is inflated`
              : "Candidate refused payslip share — HR will assume current CTC is inflated",
            severity: "high",
            flag: "payslip_refusal",
          });
          if (sustained) flags.add("payslip_refusal_sustained");
        }
      }
    }

    /* Counter-offer loop: prefer the graceful-acceptance positive
       signal when both patterns could match, since the graceful phrase
       often contains a "decide" / "see" token that the dodge regex also
       picks up. */
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && COUNTER_OFFER_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (!r || !r.text || r.text.length >= 220) continue;
        if (OFFER_ACCEPTED_GRACEFUL.test(r.text)) {
          flags.add("offer_accepted_graceful");
          break;
        }
        if (COUNTER_OFFER_DODGE.test(r.text)) {
          flags.add("counter_offer_dodge");
          gaps.push({ dimension: "commitment_signal", expected: "Clear stance on counter-offer / other offers — HR is testing pre-joining drop-out risk", observed: "Candidate dodged the commitment question, reads as flight risk", severity: "medium", flag: "counter_offer_dodge" });
          rescoreEvidence.set("counter_offer_dodge", { aiPrompt: t.text || "", userReply: r.text || "" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && WHY_COMPANY_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.length >= 40 && GENERIC_WHY.test(r.text) && !SPECIFIC_WHY.test(r.text)) {
          flags.add("generic_why_company");
          gaps.push({ dimension: "motivation_specificity", expected: "Why-us tied to a specific product, leader, domain, or recent move", observed: "Answer used generic platitudes (great culture/brand/growth) without specifics", severity: "medium", flag: "generic_why_company" });
          rescoreEvidence.set("generic_why_company", { aiPrompt: t.text || "", userReply: r.text || "" });
          break;
        }
      }
    }

    if (GAP_PROMPT.test(aiText)) {
      const idx = transcript.findIndex((t) => isAi(t) && GAP_PROMPT.test(t.text || ""));
      const r = replyTo(transcript, idx);
      if (r && r.text && r.text.length < 80) {
        flags.add("gap_unexplained");
        gaps.push({ dimension: "switch_rationale_honesty", expected: "Crisp factual explanation of any gap (study, family, layoff, sabbatical) with dates", observed: "Gap question received a thin or evasive answer — Indian HR probes harder here", severity: "medium" });
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && HIKE_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.length < 160 && !HIKE_RATIONALE.test(r.text)) {
          flags.add("hike_rationale_thin");
          gaps.push({ dimension: "comp_transparency", expected: "Hike % anchored on market data, scope expansion, or competing offer", observed: "Hike % asked but candidate gave no rationale — HR reads this as inflated ask", severity: "medium" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && BREAKUP_ASKED.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (!(r && r.text && r.text.length < 220 && SALARY_NUMBER.test(r.text) && !BREAKUP_DETAIL.test(r.text))) continue;
        if (BREAKUP_GENUINELY_UNKNOWN.test(r.text)) {
          /* Honest unknown — coach to go find out, but don't penalise
             credibility. */
          flags.add("salary_breakup_unknown_owned");
          gaps.push({
            dimension: "comp_transparency",
            expected: "Know your CTC breakup cold before the next round — fixed / variable / payout-history / joining bonus / RSU vest",
            observed: "Candidate honestly flagged they don't know the variable payout history — better than guessing, but go pull payslips / talk to manager before the next interview",
            severity: "low",
            flag: "salary_breakup_unknown_owned",
          });
        } else {
          flags.add("salary_breakup_vague");
          gaps.push({ dimension: "comp_transparency", expected: "When asked for the CTC structure, state fixed / variable / joining bonus / RSU split explicitly", observed: "Candidate gave a single CTC number with no component breakup — Indian HR reads this as inflated variable", severity: "medium" });
        }
        break;
      }
    }

    /* over_deferential_opener. Indian candidates from services /
       Tier-2 college backgrounds often open with "respected
       sir/ma'am, it's an honour" — sounds polite but reads as
       juniorish at MNC / FAANG / GCC / BFSI-global. Coaching anchor:
       confident-equal register opens, not deferential.

       Only fires for mid+ (where the register matters) on long-form
       sessions (a brisk 4-turn TA screen with a polite opener is
       fine). Won't penalise fresher / entry-level deferential openers. */
    {
      const level = (session.difficulty || "").toLowerCase();
      const isMidPlus = level === "mid" || level === "senior" || level === "lead" || level === "executive";
      if (isMidPlus && transcript.length > 8) {
        const firstUserTurns = transcript.filter(isUser).slice(0, 2);
        const opener = firstUserTurns.map((t) => t.text || "").join(" ");
        if (DEFERENTIAL_OPENER.test(opener)) {
          flags.add("over_deferential_opener");
          gaps.push({
            dimension: "register_confidence",
            expected: "Confident-equal register from the first turn — 'thanks for the time, let me walk you through my background' lands better than 'respected ma'am, it's an honour'",
            observed: "Candidate opened with deferential / over-grateful framing — at mid-senior MNC / FAANG / GCC rounds this reads as juniorish or services-coded and depresses comp anchor",
            severity: "low",
            flag: "over_deferential_opener",
          });
        }
      }
    }

    /* current_employer_counter_unresolved.
       Candidate volunteers that their current employer is likely to /
       did counter-offer them, but never gives a firm decline ("I told
       them no" / "won't entertain"). Distinct from counter_offer_dodge
       (which fires when HR probes hypothetically). This one is the
       candidate self-disclosing an active retention attempt — and not
       resolving it. HR reads it as flight risk confirmed. */
    {
      const userTextLower = userText.toLowerCase();
      const candidateRaised = COUNTER_OFFER_VOLUNTEERED.test(userTextLower);
      const candidateDeclined = COUNTER_OFFER_DECLINE.test(userTextLower) || flags.has("offer_accepted_graceful");
      if (candidateRaised && !candidateDeclined) {
        flags.add("current_employer_counter_unresolved");
        gaps.push({
          dimension: "commitment_signal",
          expected: "If the candidate raises a current-employer counter-offer, they MUST close it with a firm decline in the same breath ('they're trying to match — I've told them no')",
          observed: "Candidate volunteered that their current employer is counter-offering but never explicitly declined — HR reads this as active flight risk",
          severity: "high",
          flag: "current_employer_counter_unresolved",
        });
      }
    }

    /* probation_terms_unprobed.
       Probation came up (HR side OR candidate side) but the candidate
       never asked duration / confirmation criteria / pay-during-
       probation. Services-track probation is 3-6 months with
       termination-without-cause clauses; accepting blind is the
       classic post-joining shock pattern. */
    {
      const probationMentioned = PROBATION_PROMPT.test(allText);
      const userProbed = transcript.some((t) => isUser(t) && PROBATION_PROBE.test(t.text || ""));
      if (probationMentioned && !userProbed && transcript.length > 8) {
        flags.add("probation_terms_unprobed");
        gaps.push({
          dimension: "negotiation_protection",
          expected: "When probation comes up, probe duration (3 / 6 months), confirmation criteria, pay during probation, and notice-during-probation. Services-track probation has termination-without-cause clauses — knowing the terms protects the candidate",
          observed: "Probation was mentioned but candidate never asked duration / confirmation criteria / probation pay — accepting blind invites month-3 termination shock",
          severity: "medium",
          flag: "probation_terms_unprobed",
        });
      }
    }

    /* bgv_literacy_low. HR raised BGV / documents but the
       candidate never named a single doc back (Form 16 / UAN /
       payslip / relieving letter / Aadhaar / PAN / EPFO). Even when
       not actively evading, this reads as unprepared and slows
       onboarding. Distinct from bgv_document_evasion which requires
       active refusal language.

       Suppressed for freshers / entry-level — a fresh graduate has
       never filed taxes (no Form 16), often has no activated UAN, and
       hasn't seen a relieving letter. Penalising them here is unfair. */
    {
      const level = (session.difficulty || "").toLowerCase();
      const isFresher = level === "fresher" || level === "entry";
      const hrAskedBgv = transcript.some((t) => isAi(t) && BGV_PROMPT.test(t.text || ""));
      const userNamedDoc = transcript.some((t) => isUser(t) && BGV_DOC_NAMED.test(t.text || ""));
      if (
        hrAskedBgv &&
        !userNamedDoc &&
        !isFresher &&
        !flags.has("bgv_document_evasion") &&
        !flags.has("bgv_document_evasion_sustained")
      ) {
        flags.add("bgv_literacy_low");
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Name BGV docs by name (Form 16, UAN, last 3 payslips, relieving letter, PAN/Aadhaar) — fluency signals 'I've done this before'",
          observed: "BGV came up but candidate never named a single document by name — reads as unprepared even without active evasion",
          severity: "medium",
          flag: "bgv_literacy_low",
        });
      }
    }

    /* comp_breakup_probe_missing. HR mentioned benefits /
       ESOP / clawback / joining bonus but the candidate never PROBED
       the terms back (cliff, vesting schedule, variable payout %,
       clawback duration). Accepting benefits blind is the classic
       post-joining shock pattern; HR rounds reward candidates who
       ask before signing. */
    {
      const hrMentionedBenefits = transcript.some((t) => isAi(t) && BENEFITS_PROMPT.test(t.text || ""));
      const userProbed = transcript.some((t) => isUser(t) && COMP_PROBE_RE.test(t.text || ""));
      if (hrMentionedBenefits && !userProbed && transcript.length > 8) {
        flags.add("comp_breakup_probe_missing");
        gaps.push({
          dimension: "negotiation_protection",
          expected: "When ESOP / joining bonus / clawback / variable comes up, probe terms: cliff, vesting schedule, payout %, clawback duration",
          observed: "Benefits / ESOP / clawback was on the table but candidate never asked terms — accepting blind invites post-joining shock",
          severity: "medium",
          flag: "comp_breakup_probe_missing",
        });
      }
    }

    /* bond_terms_unprobed. HR raised service bond / training bond
       but candidate never asked duration / breakage / pro-rate. Indian-
       specific — TCS, Infosys, Wipro, Accenture training bonds are 1-2
       years with ₹50k-2L breakage. Blind acceptance is the #1 services-
       track post-joining shock. */
    {
      const hrMentionedBond = transcript.some((t) => isAi(t) && BOND_PROMPT.test(t.text || ""));
      const userProbedBond = transcript.some((t) => isUser(t) && BOND_PROBE_RE.test(t.text || ""));
      if (hrMentionedBond && !userProbedBond) {
        flags.add("bond_terms_unprobed");
        gaps.push({
          dimension: "negotiation_protection",
          expected: "When bond / service agreement comes up, probe duration, breakage penalty, pro-rate clause, and notarisation requirement",
          observed: "Service bond was raised but candidate never asked duration / breakage / pro-rate — accepting blind locks in 1-2 years with five- to six-figure exit penalty",
          severity: "high",
          flag: "bond_terms_unprobed",
        });
      }
    }

    /* pedigree_evasion. HR probed college / CGPA / 10th-12th marks
       (illegal-ish but universal in Indian HR) and candidate deflected
       under 5 YOE. Real HR reads "don't remember exactly" as hiding a
       sub-7 CGPA — a screen-out at IT services / consulting hires. */
    {
      const yoe = (session.difficulty || "").toLowerCase();
      const lowYoe = yoe === "fresher" || yoe === "entry" || yoe === "mid";
      if (lowYoe) {
        for (let i = 0; i < transcript.length; i++) {
          const t = transcript[i];
          if (!(isAi(t) && PEDIGREE_PROMPT.test(t.text || ""))) continue;
          const r = replyTo(transcript, i);
          if (r && r.text && PEDIGREE_EVASION.test(r.text)) {
            flags.add("pedigree_evasion");
            gaps.push({
              dimension: "credibility",
              expected: "Under 5 YOE, know your CGPA / 10th / 12th / college cold — Indian HR anchors early-career screening on academics",
              observed: "Candidate deflected on academic credentials — HR reads this as hiding a weak GPA, often a screen-out signal at IT services and consulting",
              severity: "medium",
              flag: "pedigree_evasion",
            });
            break;
          }
        }
      }
    }

    /* Reference-refusal tracker — same cumulative pattern. Recovery
       on a follow-up probe ("oh I do have a couple of references
       actually") downgrades the flag; sustained refusal across ≥2
       probes is high-severity. */
    {
      let probes = 0;
      let refusals = 0;
      let resolved = false;
      for (let i = 0; i < transcript.length; i++) {
        const t = transcript[i];
        if (!(isAi(t) && REFERENCE_PROMPT.test(t.text || ""))) continue;
        probes += 1;
        const r = replyTo(transcript, i);
        if (!r || !r.text) continue;
        /* Current-employer deferral is universal Indian practice, not
           refusal. Treat as resolved so the flag doesn't fire. */
        if (REFERENCE_CURRENT_DEFERRED.test(r.text)) {
          resolved = true;
          continue;
        }
        if (REFERENCE_REFUSAL.test(r.text)) refusals += 1;
        if (REFERENCE_RESOLVED.test(r.text)) resolved = true;
      }
      if (refusals > 0 && !resolved) {
        flags.add("reference_refusal");
        const sustained = probes >= 2 && refusals >= 2;
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Two professional references ready (ex-managers preferred); current manager exception is fine and expected",
          observed: sustained
            ? `Candidate refused references across ${refusals} of ${probes} probes — BGV blocker, recruiter will assume hidden exit`
            : "Candidate refused to provide any references — BGV blocker, recruiter will assume hidden exit",
          severity: "high",
          flag: "reference_refusal",
        });
        if (sustained) flags.add("reference_refusal_sustained");
      } else if (refusals > 0 && resolved) {
        flags.add("reference_initial_hedge");
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Have 2 references ready on the first ask — initial hesitation reads as a hidden-exit signal",
          observed: "Candidate hedged on a reference probe before recovering on a later probe — tighten the first answer",
          severity: "low",
          flag: "reference_initial_hedge",
        });
      }
    }

    if (OFFER_DELAY_ANXIETY.test(userText)) {
      flags.add("offer_letter_delay_anxiety");
      gaps.push({ dimension: "commitment_signal", expected: "Ask offer-letter timing crisply once near close — not as mid-interview anxiety", observed: "Candidate surfaced offer-letter / deadline anxiety during substantive turns — reads as nervous flight risk", severity: "low" });
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && PRIOR_BGV_FAIL_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && PRIOR_BGV_FAIL_ADMIT.test(r.text) && !PRIOR_BGV_CONTEXT.test(r.text)) {
          flags.add("prior_bgv_fail_uncontextualised");
          gaps.push({ dimension: "compliance_readiness", expected: "Prior BGV failure owned with date + reason + resolution ('flagged in 2022 for X, cleared after Y')", observed: "Admitted prior BGV failure without context — recruiter will assume worse", severity: "high" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isUser(t) && NONCOMPETE_MENTION.test(t.text || "") && !NONCOMPETE_QUANTIFIED.test(t.text || "")) {
        flags.add("non_compete_unquantified");
        gaps.push({ dimension: "compliance_readiness", expected: "Non-compete / NDA stated with duration + geography + scope ('12 months, India, direct competitors only')", observed: "Mentioned a non-compete restriction without quantifying scope — recruiter timebomb", severity: "medium" });
        break;
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && GENAI_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text) {
          if (GENAI_DENIAL.test(r.text) && !GENAI_HONEST.test(r.text)) {
            flags.add("genai_flat_denial");
            gaps.push({ dimension: "switch_rationale_honesty", expected: "Honest GenAI disclosure with where + how + verification ('used Copilot for boilerplate, wrote tests by hand')", observed: "Flat denial reads as dishonest — 2026 HR assumes everyone uses AI; the answer is HOW, not IF", severity: "medium" });
            break;
          }
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && LOYALTY_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.length < 220 && LOYALTY_FLAT_YES.test(r.text)) {
          flags.add("loyalty_overcommit");
          gaps.push({ dimension: "commitment_signal", expected: "Calibrated honesty ('I plan for 3+ years, can't promise — but I'd communicate early if anything changed')", observed: "Flat promise reads as performative — HR knows you can't actually commit to N years", severity: "low" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && ASPIRATION_PROBE.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && ASPIRATION_WALKBACK.test(r.text)) {
          flags.add("aspiration_walkback");
          gaps.push({ dimension: "switch_rationale_honesty", expected: "Hold the stated aspiration AND tie it to this role ('founder ambitions in 3+ yrs; this role gives me X experience I need first')", observed: "Walked back a stated aspiration when probed — reads as inconsistent", severity: "medium" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && BAND_MISMATCH_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && FLOOR_COLLAPSE.test(r.text)) {
          flags.add("floor_collapse");
          gaps.push({ dimension: "comp_transparency", expected: "Hold a floor with rationale ('my floor is X — anchored on competing offer / current + reasonable hike')", observed: "Collapsed to 'whatever you can offer' — HR will now anchor at the bottom of their band", severity: "high" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && REVERSE_INVITED.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text) {
          const fluff = REVERSE_FLUFF.test(r.text);
          const substantive = REVERSE_SUBSTANTIVE.test(r.text);
          if (fluff && !substantive) {
            flags.add("reverse_interview_low_quality");
            gaps.push({ dimension: "motivation_specificity", expected: "Ask 2-3 substantive questions (team structure, success metric, manager style, first-90-day expectations)", observed: "Closed with no questions or only logistics — reads as low engagement", severity: "medium" });
            break;
          }
        }
      }
    }

    /* ── Wave-2 detection blocks ─────────────────────────────────────── */

    // Job-hopping pattern — short stint volunteered without narrative.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isUser(t) && SHORT_STINT_VOLUNTEERED.test(t.text || "")) {
        const segment = t.text || "";
        const occurrences = (segment.match(SHORT_STINT_VOLUNTEERED) || []).length;
        // Either repeated short stints in one turn, OR an HR probe + thin narrative.
        const hrProbed = transcript.some((x) => isAi(x) && JOB_HOPPING_PROMPT.test(x.text || ""));
        if ((occurrences >= 2 || hrProbed) && !STINT_NARRATIVE.test(segment) && !STINT_NARRATIVE.test(userText)) {
          flags.add("job_hopping_pattern");
          gaps.push({ dimension: "switch_rationale_honesty", expected: "Each short stint accompanied by a one-line reason (layoff, founder exit, bond completed, domain change)", observed: "Multiple short stints surfaced without a narrative — Indian HR will assume instability", severity: "medium" });
          break;
        }
      }
    }

    // Moonlighting flat denial — Wipro/Infosys post-2022 probe.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && MOONLIGHT_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && MOONLIGHT_FLAT_DENIAL.test(r.text) && !MOONLIGHT_HONEST.test(r.text)) {
          flags.add("moonlighting_flat_denial");
          gaps.push({ dimension: "switch_rationale_honesty", expected: "Honest disclosure with boundaries ('I contribute to open-source on weekends, no client conflict')", observed: "Flat denial of any side activity reads as evasive — 2026 HR expects disclosure with scope", severity: "medium" });
          break;
        }
      }
    }

    // PF/UAN dual-employment evasion.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && PF_UAN_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && PF_UAN_EVASIVE.test(r.text)) {
          flags.add("pf_uan_evasive");
          gaps.push({ dimension: "compliance_readiness", expected: "Know your UAN, single active PF account, no overlapping contributions — BGV pulls EPFO records", observed: "Hedged on UAN / PF — recruiter assumes hidden parallel employment", severity: "high" });
          break;
        }
      }
    }

    // Family-constraint freeze — relocation/marriage probe response.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && FAMILY_PROBE.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.trim().length < 60 && FAMILY_FREEZE.test(r.text.trim())) {
          flags.add("family_constraint_freeze");
          gaps.push({ dimension: "logistics_clarity", expected: "Brief, neutral handling — 'I'm open to relocation' or 'I have a hometown preference; happy to discuss'", observed: "Froze or deflected on a family/relocation probe — HR reads as hidden constraint", severity: "low" });
          break;
        }
      }
    }

    // Joining-date over-promise — fast-join claim with long-notice context.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isUser(t) && JOIN_FAST_PROMISE.test(t.text || "") && NOTICE_LONG.test(allText)) {
        flags.add("joining_date_overpromise");
        gaps.push({ dimension: "logistics_clarity", expected: "Match join date to actual notice + buyout reality ('60-day notice, ₹X buyout possible — earliest LWD is Y')", observed: "Promised a fast join while notice in this conversation is 60-90 days — HR will assume you'll ghost current employer", severity: "medium" });
        break;
      }
    }

    // Clawback blind accept.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && CLAWBACK_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && CLAWBACK_BLIND_YES.test(r.text.trim()) && !CLAWBACK_INFORMED.test(r.text)) {
          flags.add("clawback_blind_accept");
          gaps.push({ dimension: "comp_transparency", expected: "Acknowledge + ask terms: 'I'm fine in principle — could you share the duration, amount, and pro-rate structure?'", observed: "Blind-accepted a clawback/bond without asking duration or amount — sets up a post-joining surprise", severity: "medium" });
          break;
        }
      }
    }

    // RTO flat refusal.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && RTO_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && RTO_FLAT_REFUSAL.test(r.text) && !RTO_NEGOTIATED.test(r.text)) {
          flags.add("rto_flat_refusal");
          gaps.push({ dimension: "logistics_clarity", expected: "Negotiate with constraints, don't flat-refuse: 'I can do 3 in-office days; can we discuss hybrid?'", observed: "Flat refusal of office days — 2026 RTO is non-negotiable at most service-tier and product-Indian firms", severity: "high" });
          break;
        }
      }
    }

    // Designation downgrade defensive.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && DOWNGRADE_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && DOWNGRADE_DEFENSIVE.test(r.text)) {
          flags.add("designation_downgrade_defensive");
          gaps.push({ dimension: "motivation_specificity", expected: "Own the leveling reality + reframe to scope: 'Title is calibrated to your scope/team; I care about the problem space and trajectory'", observed: "Defensive on title downgrade — reads as ego-bruised, not mission-driven", severity: "low" });
          break;
        }
      }
    }

    // Certification gap evasion.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && CERT_PROBE.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && CERT_VAGUE.test(r.text)) {
          flags.add("certification_gap_evasion");
          gaps.push({ dimension: "compliance_readiness", expected: "Know your cert exact date + ID + expiry — HR verifies via Credly/AWS directly during BGV", observed: "Vague on certification date — recruiter will verify and discrepancy reads as resume inflation", severity: "medium" });
          break;
        }
      }
    }

    // CTC-first user opening — candidate asks about salary in turn 1 or 2.
    {
      const userTurns: Array<{ idx: number; text: string }> = [];
      transcript.forEach((t, idx) => { if (isUser(t)) userTurns.push({ idx, text: t.text || "" }); });
      const earlyTurns = userTurns.slice(0, 2);
      const earlyHrAskedSalary = transcript.slice(0, earlyTurns.length > 0 ? earlyTurns[earlyTurns.length - 1].idx + 1 : 0).some((x) => isAi(x) && ASKED_ABOUT_SALARY.test(x.text || ""));
      if (!earlyHrAskedSalary && earlyTurns.some((u) => CTC_FIRST_USER.test(u.text))) {
        flags.add("ctc_first_question_user");
        gaps.push({ dimension: "motivation_specificity", expected: "Lead with role + team fit; surface comp questions after HR signals discovery is done", observed: "Asked about CTC/package before role/team discussion — reads as transactional", severity: "medium" });
      }
    }

    /* comp_held_until_close — positive signal. Candidate did NOT raise
       salary / CTC in their first 3 user turns. Indian HR rewards this
       as role-first register. Must run AFTER ctc_first_question_user
       so the guard at L730 actually suppresses double-credit. Only
       credit-worthy on long-form sessions where there was time to
       surface comp early but the candidate chose not to. */
    {
      if (transcript.length > 8) {
        const firstUserTurns = transcript.filter(isUser).slice(0, 3);
        const raisedCompEarly = firstUserTurns.some((t) => COMP_RAISED_BY_USER.test(t.text || ""));
        if (!raisedCompEarly && !flags.has("ctc_first_question_user")) {
          flags.add("comp_held_until_close");
        }
      }
    }

    /* ── v5.4.0 realism additions ────────────────────────────────── */

    // multi_offer_undisclosed — HR probed other offers; user answered
    // vaguely ("yeah a few places") with no stage / company / timeline.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isAi(t) && OTHER_OFFERS_PROMPT.test(t.text || ""))) continue;
      const r = replyTo(transcript, i);
      if (!r || !r.text) continue;
      if (OTHER_OFFERS_VAGUE.test(r.text) && !OTHER_OFFERS_SPECIFIC.test(r.text)) {
        flags.add("multi_offer_undisclosed");
        gaps.push({
          dimension: "commitment_signal",
          expected: "When HR asks about other offers, give stage + company + timeline ('final round at Razorpay, offer expected by Friday'). Specifics convert into negotiating leverage; vague answers signal weak market option",
          observed: "Candidate gave a vague 'a few places' answer with no stage / company / timeline — HR reads this as either no real competing process or unwilling to disclose",
          severity: "high",
          flag: "multi_offer_undisclosed",
        });
        rescoreEvidence.set("multi_offer_undisclosed", { aiPrompt: t.text || "", userReply: r.text || "" });
        break;
      }
    }

    // location_flex_unprobed — HR named a base city; candidate never
    // probed relocation / temp WFH / housing. FAANG India / GCC critical.
    {
      const hrNamedCity = transcript.some(
        (t) => isAi(t) && (HR_BASE_KEYWORD.test(t.text || "") || HR_CITY_WITH_ROLE.test(t.text || "")),
      );
      const userProbedRelo = transcript.some((t) => isUser(t) && RELO_PROBED.test(t.text || ""));
      if (hrNamedCity && !userProbedRelo && transcript.length > 8) {
        flags.add("location_flex_unprobed");
        gaps.push({
          dimension: "logistics_clarity",
          expected: "When HR mentions base city / reporting location, probe relocation assistance, temporary WFH window during the move, and housing allowance. FAANG India / GCC base-city is non-negotiable — knowing the support package is non-trivial money",
          observed: "Base city was mentioned but candidate never asked about relocation support, temp-remote window, or housing allowance — leaves lakhs of relo benefits on the table",
          severity: "high",
          flag: "location_flex_unprobed",
        });
      }
    }

    // reason_for_leaving_blame_framing — softer than badmouthing.
    // "no growth", "wasn't valued", "politics" without a forward frame.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isAi(t) && REASON_LEAVING_PROMPT.test(t.text || ""))) continue;
      const r = replyTo(transcript, i);
      if (!r || !r.text) continue;
      if (BLAME_FRAMING.test(r.text) && !FORWARD_FRAME.test(r.text) && !flags.has("user_badmouthing_employer")) {
        flags.add("reason_for_leaving_blame_framing");
        gaps.push({
          dimension: "professionalism",
          expected: "Reason-for-leaving should lead with the FORWARD frame ('want to move into agentic-search domain') not the BACKWARD blame ('no growth there, manager wasn't supportive'). Indian HR uses this exact diff to score maturity",
          observed: "Candidate framed leaving via blame ('no growth', 'wasn't valued', 'politics') without a forward / pull frame — softer than badmouthing but reads as the candidate the problem will follow",
          severity: "high",
          flag: "reason_for_leaving_blame_framing",
        });
        rescoreEvidence.set("reason_for_leaving_blame_framing", { aiPrompt: t.text || "", userReply: r.text || "" });
        break;
      }
    }

    // reference_list_vague — candidate affirms references but never
    // names them. Distinct from reference_refusal (no references) and
    // reference_initial_hedge (recovered after stall).
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isAi(t) && REFERENCE_PROMPT.test(t.text || ""))) continue;
      const r = replyTo(transcript, i);
      if (!r || !r.text) continue;
      if (
        REFERENCE_AFFIRMED_VAGUE.test(r.text) &&
        !REFERENCE_NAMED.test(r.text) &&
        !flags.has("reference_refusal") &&
        !flags.has("reference_initial_hedge")
      ) {
        flags.add("reference_list_vague");
        gaps.push({
          dimension: "compliance_readiness",
          expected: "Reference list should be NAMED: 'my manager Anand at Swiggy' or 'Priya, who was my lead at Razorpay'. Real HR weights named > vague — vague reads as a list you haven't actually pre-cleared",
          observed: "Candidate confirmed references exist but never named them — HR assumes the list isn't actually pre-cleared with the named referees",
          severity: "medium",
          flag: "reference_list_vague",
        });
        rescoreEvidence.set("reference_list_vague", { aiPrompt: t.text || "", userReply: r.text || "" });
        break;
      }
    }

    // esop_literacy_low — HR offered ESOP/RSU and candidate never
    // surfaced any of strike / cliff / vest / double-trigger / FMV.
    {
      const hrMentionedEsop = transcript.some((t) => isAi(t) && ESOP_HR_MENTION.test(t.text || ""));
      const userShowedLiteracy = transcript.some((t) => isUser(t) && ESOP_LITERACY.test(t.text || ""));
      if (hrMentionedEsop && !userShowedLiteracy && transcript.length > 8) {
        flags.add("esop_literacy_low");
        gaps.push({
          dimension: "comp_transparency",
          expected: "When ESOP / RSU / equity is offered, ask the standard four: strike price + cliff (typically 1 yr) + vest schedule (4 yr standard) + double-trigger (for unicorns) / FMV (for private cos). At pre-IPO / unicorn comp this is six- to seven-figure exposure",
          observed: "ESOP / RSU was on the table but candidate never surfaced strike / cliff / vest / double-trigger / FMV — accepting equity blind is the classic pre-IPO regret pattern",
          severity: "medium",
          flag: "esop_literacy_low",
        });
      }
    }

    // bell_curve_pip_unprobed — mid+ session, long-form, candidate
    // never probes performance calibration / stack rank / PIP history.
    {
      const level = (session.difficulty || "").toLowerCase();
      const isMidPlus = level === "mid" || level === "senior" || level === "lead" || level === "executive";
      const candidateProbed = transcript.some((t) => isUser(t) && BELL_CURVE_PROBED.test(t.text || ""));
      if (isMidPlus && transcript.length > 12 && !candidateProbed) {
        flags.add("bell_curve_pip_unprobed");
        gaps.push({
          dimension: "switch_rationale_honesty",
          expected: "At mid+ HR rounds at Amazon / Microsoft / TCS / Wipro, ask about performance calibration cycle, bell-curve / stack-rank policy, PIP history, and regretted-attrition rate. These are the structural factors that decide whether you're set up to succeed",
          observed: "Long-form mid+ session but candidate never asked about bell curve / stack rank / PIP / attrition — these are the calibration realities that bite 6-12 months in",
          severity: "medium",
          flag: "bell_curve_pip_unprobed",
        });
      }
    }

    // buyout_split_unaddressed — buyout raised by HR, candidate didn't
    // probe who pays (new employer reimburses vs candidate self-funds).
    // v5.5.0: HR-gated. Candidate-only buyout mentions (very common —
    // candidate volunteers "60 days notice, buyout possible") should
    // NOT fire this flag; the candidate already owns the topic and HR
    // never opened the funding question to begin with.
    {
      const hrRaisedBuyout = transcript.some((t) => isAi(t) && BUYOUT_MENTIONED.test(t.text || ""));
      const splitProbed = transcript.some((t) => isUser(t) && BUYOUT_SPLIT_PROBED.test(t.text || ""));
      if (hrRaisedBuyout && !splitProbed && transcript.length > 8) {
        flags.add("buyout_split_unaddressed");
        gaps.push({
          dimension: "negotiation_protection",
          expected: "When buyout is on the table, probe WHO pays: new employer reimburses vs candidate self-funds vs offset against joining bonus. This is a lakhs-level negotiation lever — buyout cost is typically 1-3 months gross",
          observed: "Buyout came up in the conversation but the funding question was never raised — leaves the split as a default 'candidate self-funds' which costs lakhs",
          severity: "medium",
          flag: "buyout_split_unaddressed",
        });
      }
    }

    /* ── v5.5.0 realism additions ────────────────────────────────── */

    // hybrid_expectation_mismatch — candidate volunteers an absolutist
    // fully-remote demand with no hybrid-negotiation softener.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isUser(t) && FULLY_REMOTE_DEMAND.test(t.text || ""))) continue;
      if (HYBRID_NEGOTIATION.test(t.text || "")) continue;
      // Don't double-fire with rto_flat_refusal (which requires HR
      // to have asked first); this one catches the candidate-volunteered
      // version that rto_flat_refusal misses.
      if (flags.has("rto_flat_refusal")) break;
      flags.add("hybrid_expectation_mismatch");
      gaps.push({
        dimension: "logistics_clarity",
        expected: "Most Indian GCCs / unicorns mandate 3+ day hybrid. Don't volunteer 'fully remote, never come to office' — frame as 'open to hybrid, can do N in-office days; what's the policy?' Absolutist remote demands are an instant misalignment signal in 2025-26",
        observed: "Candidate volunteered a fully-remote / never-in-office posture with no hybrid-negotiation softener — reads as misaligned with India RTO/hybrid reality",
        severity: "high",
        flag: "hybrid_expectation_mismatch",
      });
      break;
    }

    // visa_sponsorship_demand_unprompted — candidate raises H1B /
    // onsite sponsorship for an India-IC role.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isUser(t) && VISA_DEMAND.test(t.text || ""))) continue;
      flags.add("visa_sponsorship_demand_unprompted");
      gaps.push({
        dimension: "motivation_specificity",
        expected: "For an India-based IC role, don't raise H1B / blue-card / onsite sponsorship in the HR round — it signals the India seat is a stepping stone, not the destination. If onsite matters, ask about company-wide mobility programs ('does the team have onsite rotations?') instead of demanding sponsorship",
        observed: "Candidate raised visa sponsorship / onsite-deputation expectation in the HR round — for India-IC roles this reads as misalignment with the seat",
        severity: "high",
        flag: "visa_sponsorship_demand_unprompted",
      });
      break;
    }

    // salary_review_cycle_unprobed — mid+ long-form, comp discussed,
    // no candidate-side question about review/appraisal cadence.
    {
      const level = (session.difficulty || "").toLowerCase();
      const isMidPlus = level === "mid" || level === "senior" || level === "lead" || level === "executive";
      const compDiscussed = ASKED_ABOUT_SALARY.test(aiText) || transcript.some((t) => isUser(t) && SALARY_NUMBER.test(t.text || ""));
      const reviewProbed = transcript.some((t) => isUser(t) && REVIEW_CYCLE_PROBE.test(t.text || ""));
      if (isMidPlus && compDiscussed && !reviewProbed && transcript.length > 10) {
        flags.add("salary_review_cycle_unprobed");
        gaps.push({
          dimension: "comp_transparency",
          expected: "At mid-senior, ask about the review cycle (annual / half-yearly), off-cycle correction policy, and promo cadence. Comp is a trajectory not a number — Indian HR expects this question from candidates who've negotiated before",
          observed: "Comp was discussed but candidate never asked about review cycle / off-cycle / promo cadence — accepts the comp number as static instead of as a starting point",
          severity: "medium",
          flag: "salary_review_cycle_unprobed",
        });
      }
    }

    // tax_structure_naive — mid+ candidate negotiates only on
    // gross/fixed without engaging tax-optimised structure.
    {
      const level = (session.difficulty || "").toLowerCase();
      const isMidPlus = level === "mid" || level === "senior" || level === "lead" || level === "executive";
      const compDiscussed = ASKED_ABOUT_SALARY.test(aiText) || transcript.some((t) => isUser(t) && SALARY_NUMBER.test(t.text || ""));
      const taxAware = transcript.some((t) => isUser(t) && TAX_STRUCTURE_PROBE.test(t.text || ""));
      if (isMidPlus && compDiscussed && !taxAware && transcript.length > 10) {
        flags.add("tax_structure_naive");
        gaps.push({
          dimension: "comp_transparency",
          expected: "At mid-senior (₹25L+) the take-home delta between a naive structure and a tax-optimised one is 1-2 LPA. Ask about flexi-basket components: 80C max-out, NPS employer contribution (10% extra deduction), LTA, meal cards, gratuity calc. Indian HR expects this fluency",
          observed: "Comp was discussed but candidate never engaged 80C / NPS / flexi / LTA / take-home — gross-only negotiation leaves 1-2 LPA on the table at this band",
          severity: "medium",
          flag: "tax_structure_naive",
        });
      }
    }

    // tier1_college_default_assumption — candidate pre-apologises for
    // non-tier-1 pedigree when HR never raised it. Internalised bias.
    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (!(isUser(t) && PEDIGREE_PRE_APOLOGY.test(t.text || ""))) continue;
      // Only fire if HR never opened the pedigree topic — otherwise
      // it's a defensive response, not unsolicited.
      const hrAskedPedigree = transcript.slice(0, i).some((x) => isAi(x) && PEDIGREE_PROMPT.test(x.text || ""));
      if (hrAskedPedigree) continue;
      flags.add("tier1_college_default_assumption");
      gaps.push({
        dimension: "register_confidence",
        expected: "Don't pre-apologise for your college unless HR raises it. 'I know my college isn't IIT' / 'despite my tier-3 background' signals internalised bias and low confidence — the interviewer wasn't going there. Lead with what you've shipped; pedigree comes up only if asked",
        observed: "Candidate pre-apologised for non-tier-1 / non-IIT pedigree without HR raising the topic — reads as low confidence and surfaces a screen you'd otherwise have avoided",
        severity: "medium",
        flag: "tier1_college_default_assumption",
      });
      break;
    }

    /* ── Resume cross-checks (silent no-op when resume null) ─── */
    if (resume) {
      const resumeAgg = summarizeResume(resume);

      // 1) resume_transcript_mismatch — candidate verbally names an
      //    employer that doesn't appear in their resume. BGV will catch
      //    this; flag it here so the candidate either corrects the habit
      //    or updates the resume.
      if (resumeAgg.employers.length > 0) {
        const claimed: string[] = [];
        for (const t of transcript) {
          if (!isUser(t) || !t.text) continue;
          const re = new RegExp(TRANSCRIPT_EMPLOYER_RE.source, "g");
          let m: RegExpExecArray | null;
          while ((m = re.exec(t.text)) !== null) {
            const name = m[1].trim().replace(/[.,;:!?]+$/, "");
            if (name.length >= 2 && name.length <= 60) claimed.push(name);
          }
        }
        const orphans = claimed.filter(
          (c) => !resumeAgg.employers.some((e) => tokensOverlap(c, e)),
        );
        if (orphans.length > 0) {
          flags.add("resume_transcript_mismatch");
          const uniqOrphans = Array.from(new Set(orphans)).slice(0, 3);
          const resumeList = resumeAgg.employers.slice(0, 4).join(", ");
          gaps.push({
            dimension: "credibility",
            expected: "Every employer named in the interview must already appear on the resume — BGV pulls the resume as the source of truth.",
            observed: `Resume lists: ${resumeList}. You said: ${uniqOrphans.join(", ")} — ${uniqOrphans.length === 1 ? "this employer is" : "these employers are"} absent from the resume.`,
            severity: "high",
            flag: "resume_transcript_mismatch",
          });
        }
      }

      // 2) resume_gap_unaddressed — resume has a ≥3-month employment gap
      //    and HR never probed it. Pre-empt the real round: prepare a
      //    crisp factual one-liner now or get cornered later.
      if (resumeAgg.gapsMonths.length > 0) {
        const hrProbedGap = transcript.some(
          (t) => isAi(t) && (GAP_PROMPT.test(t.text || "") || CAREER_BREAK_PROMPT.test(t.text || "")),
        );
        if (!hrProbedGap) {
          const biggest = Math.max(...resumeAgg.gapsMonths);
          flags.add("resume_gap_unaddressed");
          gaps.push({
            dimension: "switch_rationale_honesty",
            expected: "Resume gaps ≥3 months always surface in the real HR round — pre-prep a one-liner with dates + reason + what you did.",
            observed: `Resume shows a ${biggest}-month gap between employments; this session did not surface or address it.`,
            severity: "medium",
            flag: "resume_gap_unaddressed",
          });
        }
      }

      // 3) inflated_seniority_claim — resume YoE < 3 years but the title
      //    (on CV or in transcript) reads Senior / Lead / Staff / Principal.
      //    Indian HR cross-checks level vs years; mismatch reads as
      //    resume inflation.
      if (resumeAgg.yoeMonths !== null && resumeAgg.yoeMonths < 36) {
        const resumeSenior = resumeAgg.titles.some((t) => SENIOR_TITLE_RE.test(t));
        const transcriptSenior: string[] = [];
        for (const t of transcript) {
          if (!isUser(t) || !t.text) continue;
          const reSelf = /\b(?:i\s+am|i'?m|i\s+work\s+as|my\s+(?:current|present)\s+(?:role|title|designation)\s+is)\s+(?:a\s+|an\s+|the\s+)?([\w\s./-]{3,60})/gi;
          let m: RegExpExecArray | null;
          while ((m = reSelf.exec(t.text)) !== null) {
            const claim = (m[1] || "").trim();
            if (SENIOR_TITLE_RE.test(claim)) transcriptSenior.push(claim.slice(0, 40));
          }
        }
        if (resumeSenior || transcriptSenior.length > 0) {
          flags.add("inflated_seniority_claim");
          const yearsRounded = (resumeAgg.yoeMonths / 12).toFixed(1);
          const observedTitle = (resumeSenior ? resumeAgg.titles : transcriptSenior).find((t) => SENIOR_TITLE_RE.test(t)) || "senior";
          const resumeTitle = resumeAgg.titles[0] || "unknown";
          const transcriptQuote = transcriptSenior[0] ? ` you said "${transcriptSenior[0]}"` : "";
          gaps.push({
            dimension: "credibility",
            expected: "Senior / Lead / Staff / Principal titles typically require 5+ years of relevant experience in the Indian market.",
            observed: resumeSenior
              ? `Resume YoE ≈ ${yearsRounded} years, resume title is "${resumeTitle}" (matches ${observedTitle}).${transcriptQuote ? ` Verbally${transcriptQuote}.` : ""} Reads as level inflation.`
              : `Resume YoE ≈ ${yearsRounded} years, resume title is "${resumeTitle}",${transcriptQuote} — claimed level outruns the YoE on paper.`,
            severity: "medium",
            flag: "inflated_seniority_claim",
          });
        }
      }

      // 4) under_titled_candidate — inverse of (3). Resume YoE ≥ 5 years
      //    but every listed title is plain IC ("Software Engineer",
      //    "Developer", "Analyst") with no Senior/Lead/Staff/Principal
      //    modifier. This isn't a credibility issue — it's a comp-leverage
      //    issue. HR anchors the comp band on title, not narrative; an
      //    under-titled candidate gets anchored low. Coaching nudge: retitle
      //    to match scope or be ready to walk through scope that exceeds
      //    the level on paper before the offer locks in.
      if (resumeAgg.yoeMonths !== null && resumeAgg.yoeMonths >= 60 && resumeAgg.titles.length > 0) {
        const anySenior = resumeAgg.titles.some((t) => SENIOR_TITLE_RE.test(t));
        const allPlainIC = resumeAgg.titles.every((t) =>
          /\b(?:software\s+engineer|developer|programmer|analyst|consultant|associate|engineer)\b/i.test(t) && !SENIOR_TITLE_RE.test(t),
        );
        if (!anySenior && allPlainIC) {
          flags.add("under_titled_candidate");
          const yearsRounded = (resumeAgg.yoeMonths / 12).toFixed(1);
          gaps.push({
            dimension: "comp_transparency",
            expected: "By ~5 years YoE in the Indian market, the resume title should reflect scope (Senior / Lead) — HR anchors the comp band on title, not narrative.",
            observed: `Resume YoE ≈ ${yearsRounded} years but every title is plain IC ("${resumeAgg.titles[0]}"). Under-titled candidates get anchored low on band.`,
            // Promoted low → medium: at 5+ YoE in the Indian market the
            // title-anchor gap is worth lakhs at offer time, not a nice-to-have.
            severity: "medium",
            flag: "under_titled_candidate",
          });
        }
      }
    }

    const covered = DIMENSIONS.filter((d) => DIMENSION_PATTERNS[d].test(allText));
    if (transcript.length > 8 && covered.length < 4) {
      flags.add("dimensions_thin_coverage");
      const missed = DIMENSIONS.filter((d) => !covered.includes(d));
      gaps.push({ dimension: "session_coverage", expected: "Indian HR round should touch ≥4 of 7 dimensions: logistics, comp, stability, compliance, commitment, benefits, motivation", observed: `Only ${covered.length}/7 covered. Missing: ${missed.join(", ")}.`, severity: "medium" });
    }

    /* ── 2nd-pass LLM rescore for weak-regex flags ──
       Three flags rely on token-level regex matches that can false-positive on
       answers which actually meet their rubric (e.g. someone says "great culture
       — specifically RazorpayX's launch in 2024" — "great culture" fires
       generic_why_company even though the reply IS specific). The rescore step
       hands each fired flag + its surrounding turns to the LLM and drops the
       flag if the LLM judges it a false positive.

       Gated by LLM_RESCORE_ENABLED. When off, rescoreFlags returns null and
       every flag is kept as-is (fail-open). When the call fails, same — so the
       worst case is identical to the pure-regex pass, never a regression. */
    const rescoreCandidates: FlagRescoreCandidate[] = [];
    for (const flag of Object.keys(RESCORE_RUBRICS)) {
      const ev = rescoreEvidence.get(flag);
      if (ev && flags.has(flag)) {
        rescoreCandidates.push({ flag, aiPrompt: ev.aiPrompt, userReply: ev.userReply, rubric: RESCORE_RUBRICS[flag] });
      }
    }
    if (rescoreCandidates.length > 0) {
      const verdicts = await rescoreFlags(rescoreCandidates);
      if (verdicts) {
        for (const v of verdicts) {
          if (!v.keep && flags.has(v.flag)) {
            flags.delete(v.flag);
          }
        }
      }
    }

    const tips: string[] = [];

    for (const cluster of CLUSTERS) {
      const hits = cluster.members.filter((m) => flags.has(m));
      if (hits.length >= 2) {
        tips.push(
          `Pattern, not isolated: ${hits.length} signals across ${cluster.theme} (${hits.slice(0, 4).join(", ")}). Indian HR scores ${cluster.label} as a cluster — fix the pattern, not just the loudest one.`,
        );
      }
    }

    /* Positive-signal counterpart to counter_offer_dodge — surfaced
       before negative tips so the candidate sees credit first. Not a
       rubric gap; pushed into coachingNotes for visibility only. */
    if (flags.has("offer_accepted_graceful")) {
      tips.push("Strong commitment signal: you closed the counter-offer probe cleanly ('won't entertain a counter / once I sign I'm in'). HR's #1 fear is pre-joining drop-out — that line de-risks you. Keep using it.");
    }
    if (flags.has("comp_held_until_close")) {
      tips.push("Positive signal: you held salary off the table until HR opened it — that reads as role-first, not money-first. Indian HR scores this as the right register; keep that discipline.");
    }

    if (flags.has("user_anchor_leaked_salary")) tips.push("Never name a salary first — deflect with 'I'd want to understand the role + level before discussing comp.'");
    if (flags.has("user_badmouthing_employer")) tips.push("Reframe past frustrations as growth opportunities. HR scores professionalism heavily.");
    if (flags.has("generic_self_intro")) tips.push("Tighten 'tell me about yourself' to a 90-second story with 2 concrete projects + outcomes.");
    if (flags.has("vague_notice_period")) tips.push("Know your notice period cold — exact days, buyout policy, earliest LWD. Vague answers signal flight risk.");
    if (flags.has("notice_period_shallow")) tips.push("Concrete days alone aren't enough at mid-senior. Layer on: buyout cost (typically 1 month gross), handover / KT plan, earliest LWD with manager sign-off, and whether early release is precedented. That's what HR scores.");
    if (flags.has("bgv_literacy_low")) tips.push("Name the docs by name when BGV comes up: 'Form 16 for last 2 years, UAN active, last 3 payslips, relieving letter from each employer.' Fluency signals you've onboarded before — opaque hand-waving slows down BGV intake.");
    if (flags.has("comp_breakup_probe_missing")) tips.push("Always probe ESOP / variable / clawback terms before you sign: cliff (typically 1yr), vesting (4yr standard), variable payout history (% paid out last 2 cycles), joining-bonus clawback duration. Accepting blind is the #1 post-joining regret pattern.");
    if (flags.has("bond_terms_unprobed")) tips.push("When service bond comes up, probe before agreeing: 'What's the bond duration — 1 or 2 years? What's the breakage penalty? Is it pro-rated by months served? Is it notarised?' Services-track training bonds (TCS, Infosys, Wipro, Accenture) lock you in 12-24 months with ₹50k–2L breakage. Knowing the terms is the difference between an informed choice and a five-figure exit shock.");
    if (flags.has("pedigree_evasion")) tips.push("Under 5 years experience, Indian HR will anchor on academics — know your CGPA, 10th %, 12th %, college name cold. 'Don't remember exactly' reads as hiding a sub-7 CGPA. Even if you're not proud of the number, own it: 'Graduated with X.Y CGPA from <college> — academics weren't my strongest, but here's what I did with my time after.'");
    if (flags.has("current_employer_counter_unresolved")) tips.push("If you mention your current employer is counter-offering, ALWAYS close it in the same breath: 'they're trying to match — I've already told them no.' Mentioning a counter without declining reads as you keeping the option open. India-market reality: ~40% of senior offers face a counter; HR rounds reward candidates who pre-empt the script.");
    if (flags.has("probation_terms_unprobed")) tips.push("When probation comes up, probe terms cold: 'What's the duration — 3 or 6 months? What are the confirmation criteria? Is the notice period during probation different? Is pay full or pro-rated?' Services-track probation has termination-without-cause clauses; blind acceptance leaves you exposed to a month-3 surprise.");
    if (flags.has("bgv_document_evasion")) tips.push("Keep payslips (last 3), Form 16, relieving letters, PAN/Aadhaar/UAN ready. Hesitation here blocks onboarding via BGV.");
    if (flags.has("bgv_document_evasion_sustained")) tips.push("Sustained BGV evasion across multiple probes is the strongest pre-offer red flag. Pre-prep a single line: 'I have all documents — payslips, Form 16, UAN — ready to share over secure channel.'");
    if (flags.has("bgv_document_initial_hedge")) tips.push("You recovered on a later BGV probe, but the first hedge still registers. Lead with confidence: 'Yes, I can share' beats 'let me check first.'");
    if (flags.has("payslip_refusal") && !flags.has("bgv_document_evasion")) tips.push("Refusing payslips reads as inflated current CTC. Share them — or justify why your number isn't anchored on current.");
    if (flags.has("counter_offer_dodge")) tips.push("On counter-offers: 'If I accept yours, I won't take a counter.' Pre-joining drop-out is HR's #1 fear — give them the clarity.");
    if (flags.has("generic_why_company")) tips.push("Drop 'great culture / great brand'. Name one specific thing: a recent launch, a leader's blog, a domain bet.");
    if (flags.has("gap_unexplained")) tips.push("Own gaps with one crisp sentence: dates + reason + what you did with the time. Indian HR will probe — be ready.");
    if (flags.has("hike_rationale_thin")) tips.push("Anchor hike % on market data or scope, not a desired round number.");
    if (flags.has("salary_breakup_vague")) tips.push("When HR asks structure, break the CTC down: 'Fixed X, variable Y (paid out Z%), joining bonus A, RSU vest B over 4 years.' Single-number CTC reads as inflated variable.");
    if (flags.has("salary_breakup_unknown_owned")) tips.push("You owned the unknown well ('I don't know the exact variable payout history') — that's better than guessing. Action item before the next round: pull last 2 years of payslips, talk to your manager about variable %, and learn the RSU vest schedule. Knowing the breakup is non-negotiable at offer time.");
    if (flags.has("over_deferential_opener")) tips.push("Drop the 'respected ma'am / it's an honour' framing — at MNC / FAANG / GCC / BFSI-global HR rounds it reads as juniorish and depresses your comp anchor. Try: 'Thanks for the time — quick background then I'll let you drive.' Confident-equal register, not deferential.");
    if (flags.has("reference_refusal")) tips.push("Have 2 references ready (ex-managers preferred). Saying 'no references' is a hard BGV blocker — even one current peer + one ex-manager is fine.");
    if (flags.has("reference_refusal_sustained")) tips.push("Refusing references across multiple HR probes is a hard pre-offer stop. Line up at least one ex-manager + one peer before the next round.");
    if (flags.has("reference_initial_hedge")) tips.push("You recovered on the second reference probe, but the initial hedge still scored. Have a name + role ready before HR asks twice.");
    if (flags.has("payslip_refusal_sustained")) tips.push("Refusing payslips on every probe locks HR into assuming inflated CTC. Share them or pre-empt: 'My ask isn't anchored on current — here's the rationale.'");
    if (flags.has("offer_letter_delay_anxiety")) tips.push("Hold offer-letter timing questions for the close — asking mid-interview reads as anxious. Phrase it cleanly: 'What's your typical timeline from verbal to written offer?'");
    if (flags.has("prior_bgv_fail_uncontextualised")) tips.push("Prior BGV failure? Own it with date + reason + resolution in one breath: 'flagged in 2022 for date overlap with my notice, cleared in 30 days.' Recruiters trust honest specifics.");
    if (flags.has("non_compete_unquantified")) tips.push("Non-compete? State scope crisply: duration + geography + industry coverage. 'Vague non-compete' = recruiter timebomb.");
    if (flags.has("genai_flat_denial")) tips.push("Modern HR assumes everyone uses AI. Flat denial reads as dishonest. Answer the HOW: 'Used Copilot for boilerplate; wrote tests by hand; verified security-sensitive bits.'");
    if (flags.has("loyalty_overcommit")) tips.push("Don't promise N years flat. Real answer: 'I plan for 3+ years; I can't promise but I'd communicate early if anything changed.' HR respects calibration.");
    if (flags.has("aspiration_walkback")) tips.push("Don't walk back stated ambitions when probed. Tie them to the role: 'Founder ambition in 3+ yrs — this role gives me the X experience I need first.'");
    if (flags.has("floor_collapse")) tips.push("Never collapse to 'whatever you can offer' on band mismatch. Hold a floor with rationale: 'My floor is X — anchored on competing offer / current + reasonable hike.'");
    if (flags.has("reverse_interview_low_quality")) tips.push("Close with 2-3 substantive questions: team structure, what success looks like in 90 days, manager style. No questions = low engagement signal.");
    if (flags.has("job_hopping_pattern")) tips.push("Short stints? Pre-empt the probe. One line per move: 'left X after 10 months — founder pivoted away from my domain; left Y after a year — bond completed.' Specifics defuse the instability read.");
    if (flags.has("moonlighting_flat_denial")) tips.push("Don't flat-deny moonlighting. Post-2022 HR (Wipro fired 300 for it) expects scoped honesty: 'I contribute to open-source on weekends, no client conflict, disclosed in writing.' That answer scores; 'no, never' reads as evasive.");
    if (flags.has("pf_uan_evasive")) tips.push("Know your UAN cold + confirm no overlapping PF contributions. BGV pulls EPFO; surprises here block onboarding.");
    if (flags.has("family_constraint_freeze")) tips.push("Family / relocation probes deserve a calm one-liner: 'Open to relocation' or 'I have a hometown preference, happy to discuss.' Freezing reads as a hidden constraint.");
    if (flags.has("joining_date_overpromise")) tips.push("Don't promise '15-day join' on a 60-day notice. Be honest: 'My notice is 60 days; I can attempt a buyout if there's flexibility — what's typical here?'");
    if (flags.has("clawback_blind_accept")) tips.push("Never blind-accept a clawback. Ask: 'What's the duration, amount, and pro-rate structure?' Acceptance without terms invites post-joining shock.");
    if (flags.has("rto_flat_refusal")) tips.push("Flat WFH-only is a post-RTO dealbreaker at most Indian firms (TCS, Infosys, Wipro, Flipkart, Swiggy all returned to office in 2023-2024). Negotiate: 'I can do 3 in-office days; what's the hybrid structure?'");
    if (flags.has("designation_downgrade_defensive")) tips.push("Don't dismiss the title question. Frame it: 'Titles map to your leveling; I care about the scope and the problem space — happy to align on what your X-level looks like.'");
    if (flags.has("certification_gap_evasion")) tips.push("Know your cert dates and IDs cold. HR verifies via Credly/AWS directly — vague answers + a discrepancy read as resume inflation.");
    if (flags.has("ctc_first_question_user")) tips.push("Don't open with salary. Establish role / team / scope first; surface comp once HR signals discovery is wrapping. Asking comp upfront reads as transactional.");
    if (flags.has("multi_offer_undisclosed")) tips.push("When HR asks about other offers, name the stage and timeline: 'Razorpay round 3, expecting offer by Friday' or 'Final HR round at Swiggy next week'. Vague 'a few places' answers fail twice — HR assumes either no real competing process or unwilling to disclose. Specifics convert into negotiation leverage; vagueness leaves it on the table.");
    if (flags.has("location_flex_unprobed")) tips.push("Base city was named but you never probed the relocation package — that's lakhs left on the table. Ask cleanly: 'What's the relocation assistance? Is there a temporary WFH window during the move? Housing allowance? Is the joining bonus structured to offset moving costs?' FAANG India / GCC base-city is non-negotiable, but the support package is very negotiable.");
    if (flags.has("reason_for_leaving_blame_framing")) tips.push("Lead with the FORWARD frame, not the BACKWARD blame. 'No growth, manager wasn't supportive' reads as the problem will follow you. Reframe: 'Want to move into [domain] — current role is mature for me there.' Same factual reason, mature register. Indian HR scores this exact diff on every senior switch.");
    if (flags.has("reference_list_vague")) tips.push("Name your references: 'Anand, who was my manager at Swiggy' or 'Priya, my lead at Razorpay'. 'Yeah I have a couple' reads as a list you haven't actually pre-cleared with the named referees. Have two named, pre-aligned references ready before the round.");
    if (flags.has("esop_literacy_low")) tips.push("Equity was on the table and you didn't surface the four standard probes: strike price, cliff (typically 1 yr), vest schedule (4 yr standard), double-trigger (at unicorns) / FMV / 409A (at private cos). At pre-IPO / unicorn comp this is six- to seven-figure exposure — accepting blind is the classic post-joining regret.");
    if (flags.has("bell_curve_pip_unprobed")) tips.push("At mid-senior at Amazon / Microsoft / TCS / Wipro / Infosys, ask about performance calibration cycle, bell-curve / stack-rank policy, PIP history, and regretted-attrition rate. These are the structural factors that decide whether you'll succeed 6-12 months in — and the answer telegraphs a LOT about the team culture.");
    if (flags.has("buyout_split_unaddressed")) tips.push("Buyout came up but you didn't ask WHO pays. The default is candidate self-funds — but new employer reimbursement is standard at FAANG / GCC and negotiable at most product cos. Ask: 'Is buyout reimbursed, or offset against joining bonus, or candidate-funded?' One question = potentially 1-3 months of gross salary back in your pocket.");
    if (flags.has("hybrid_expectation_mismatch")) tips.push("'Fully remote, never come to office' is a 2025-26 instant misalignment at most Indian GCCs / unicorns — 3-day hybrid is policy at Microsoft India, Walmart Global Tech, Target India, Razorpay, Flipkart, Swiggy. Reframe: 'Open to hybrid — can do 3 in-office days; what's the team's policy?' Even if your floor is 1 in-office day, ask before declaring.");
    if (flags.has("visa_sponsorship_demand_unprompted")) tips.push("Raising H1B / blue-card / onsite sponsorship in an India HR round signals the India seat is a stepping stone. If onsite matters, ask softly about company-wide mobility ('does the team have onsite rotations?' or 'what's the typical path to a US deputation?') — never demand sponsorship in round one. Misalignment with the seat is a screen-out signal.");
    if (flags.has("salary_review_cycle_unprobed")) tips.push("At mid-senior, never accept a comp number without asking about the trajectory. The three questions: 'What's the review cycle — annual or half-yearly? Are off-cycle corrections common? What's the typical promo timeline at this band?' Comp is a curve, not a point — HR scores candidates who treat it that way.");
    if (flags.has("tax_structure_naive")) tips.push("At ₹25L+ in India, the take-home delta between a naive structure and a tax-optimised one is 1-2 LPA. Ask: 'Is there a flexi-basket with 80C max-out, NPS employer contribution (10% extra deduction beyond 1.5L), LTA, meal cards? What's the take-home post all deductions?' This question alone often unlocks structure changes the recruiter wouldn't volunteer.");
    if (flags.has("tier1_college_default_assumption")) tips.push("Don't pre-apologise for your college. 'I know my college isn't IIT' / 'despite my tier-3 background' surfaces a screen the interviewer wasn't going to bring up — and signals internalised bias. Lead with what you've shipped. Pedigree comes up only if asked; if it does, own it with one calm line and pivot back to scope.");
    if (flags.has("dimensions_thin_coverage")) tips.push("Real Indian HR covers 7 dimensions. Re-run with notice/BGV/counter-offer/benefits prompts.");
    if (flags.has("resume_transcript_mismatch")) tips.push("Every employer you say out loud should already be on your resume. BGV pulls the resume as source-of-truth — verbal employers that aren't listed read as fabrication.");
    if (flags.has("resume_gap_unaddressed")) tips.push("Your resume shows a ≥3-month employment gap. Don't wait for the real interviewer to corner you — pre-prep a one-liner: 'between Mar 2022 and Jan 2023 I [studied / cared for family / took a sabbatical to ship X]; here's what I did with the time.'");
    if (flags.has("under_titled_candidate")) tips.push("Your resume has 5+ years of experience but every title reads as plain IC (Software Engineer / Developer). Indian HR anchors comp on title, not scope — retitle to match what you actually own (Senior / Lead) or be ready to walk through scope that exceeds the level on paper. Under-titling costs lakhs at offer time.");
    if (flags.has("inflated_seniority_claim")) tips.push("Your resume reads Senior/Lead/Staff/Principal but your years don't support it yet. Either retitle to match the level you can defend (with scope + ownership stories) or be ready to justify the leap: 'titled Senior because I lead the X module end-to-end since month N — I know that's quick.'");

    /* Indian HR illegally but routinely probes these — especially for
       women candidates (maternity intent, spouse-job, relocation-if-
       husband-transfers). The drill must cover them so candidates can
       practise deflection, not so the analyzer endorses the prompts. */
    const ILLEGAL_PROMPT_RE = /\b(?:caste|religion|mother tongue|marital|married|family.*(?:plan|soon)|are you (?:from|originally)|community|maternity (?:plan|leave|intent)|pregnan|baby plan|when (?:are|do) you plan(?:ning)? (?:to have|on having) (?:a |any )?(?:baby|child|kids)|(?:husband|wife|spouse)(?:'?s)? (?:job|work|company|transfer|location)|relocat.*(?:if|when) (?:husband|wife|spouse))\b/i;
    const touchedIllegal = transcript.some((t) => isAi(t) && ILLEGAL_PROMPT_RE.test(t.text || ""));
    if (touchedIllegal) {
      flags.add("illegal_prompt_used_for_practice");
      tips.push("Note: this session included prompts (marital, caste, religion, origin, family-planning) that are illegal-in-India under Equal Remuneration Act and constitutional non-discrimination — included ONLY to drill deflection. Tempo does not endorse asking them. If a real interviewer asks, deflect warmly: 'I'd prefer to keep the conversation on the role.'");
    }

    /* When rescore dropped a flag, drop its tagged gap too so the report
       stays internally consistent. Untagged gaps (the vast majority —
       all the non-rescore detections) pass through unchanged. */
    result.rubricGaps = gaps.filter((g) => !g.flag || flags.has(g.flag));
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
