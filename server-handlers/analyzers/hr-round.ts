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
const NOTICE_CONCRETE = /\b(?:30|45|60|90|three months?|two months?|one month|sixty|ninety|thirty|teen mahine|do mahine|ek mahina)\b/i;
const BGV_PROMPT = /\b(bgv|background verification|background check|payslip|form\s*16|relieving letter|experience letter|uan|pan card|aadhaar|aadhar|marksheet|reference check|first advantage|authbridge|ongrid)\b/i;
const BGV_EVASIVE = /\b(?:not comfortable|prefer not|can'?t share|cannot share|don'?t share|won'?t share|not willing|not (?:able|ready) to share|don'?t have|lost|misplaced|nahi hai|kho gaya|share nahi)\b/i;
const COUNTER_OFFER_PROMPT = /\b(counter[- ]offer|counter offer|if (?:your )?current (?:company|employer) (?:offers|matches|counters)|other offers|interviewing elsewhere|if we (?:make|extend) (?:you )?an offer|commitment within|kahin aur interview|aur offer)\b/i;
const COUNTER_OFFER_DODGE = /\b(?:i'?ll see|it depends|maybe|not sure|can'?t say|too early|let me think|i'?ll decide (?:then|later)|will see how|dekhta hu|dekhte hain|soch ke bataunga|tab ki tab|abhi nahi bol sakta)\b/i;
/* Positive counterpart to COUNTER_OFFER_DODGE — candidate handles the
   counter-offer probe gracefully with a firm "no counter" commitment.
   When this fires we suppress counter_offer_dodge AND record a
   positive signal so the report credits the candidate. */
const OFFER_ACCEPTED_GRACEFUL = /\b(?:if i (?:accept|take) (?:yours|your offer)[\s,]+i (?:won'?t|will not|don'?t plan to) (?:take|consider|entertain) (?:a |any )?counter|no counter[- ]?offer (?:consideration|for me|here|please)|(?:i'?ve|i have) (?:already )?decided[\s,]+no counter|once i sign[\s,]+i'?m (?:in|committed|done)|i (?:won'?t|will not) entertain (?:a |any )?counter[- ]?offer|counter[- ]?offer (?:not in (?:the )?picture|out of (?:the )?picture|isn'?t happening)|haan main commit (?:karta|kar) (?:hu|raha))\b/i;
const WHY_COMPANY_PROMPT = /\b(why (?:our|this) company|why us|why are you interested in (?:us|our|this company)|what do you know about (?:us|our company)|why (?:do )?you want to (?:join|work (?:at|with|here))|humari company kyu|yahan kyu)\b/i;
const GENERIC_WHY = /\b(great culture|great brand|good company|reputed|reputation|big name|industry leader|top company|growth opportunit|good work[- ]?life|good place|nice place|love the company|achi company|badi company|brand achi)\b/i;
const SPECIFIC_WHY = /\b(launched|launch|product|feature|leader|founder|ceo|cto|paper|blog|talk|conference|series [a-d]|ipo|acquired|acquisition|mission|domain|space|sector|stack|engineering blog|open source|case study|customer|use case)\b/i;
const SELF_INTRO_PROMPT = /\b(tell me about yourself|walk me through|introduce yourself|your background|apne baare mein|introduction)\b/i;
const SPECIFICS = /\b\d+\s*(?:years?|months?|saal|mahine)\b|\b(?:built|led|shipped|launched|migrated|deployed|scaled|owned|drove|delivered|banaya|kiya tha|lead kiya)\b/i;
const BENEFITS_PROMPT = /\b(joining bonus|signing bonus|clawback|probation|bond|service agreement|esop|rsu|vesting|cliff|insurance|epf|provident fund|gratuity|nps|variable pay)\b/i;

/* v4.6 depth validators ───────────────────────────────────────────
   2.1  NOTICE_DEPTH — extras that distinguish a shallow "60 days"
        from a real notice-period plan (buyout, handover, LWD, early
        release, garden leave).
   2.2  BGV_DOC_NAMED — candidate-side BGV literacy: did they ever
        name a specific document (Form 16 / UAN / payslip / relieving
        letter / Aadhaar / PAN / EPFO)?
   2.3  COMP_PROBE_RE — did the candidate ASK about ESOP cliff /
        variable payout / clawback / vesting terms? HR offers benefits;
        a candidate who never probes the terms accepts blind. */
const NOTICE_DEPTH = /\b(?:buy[- ]?out|hand[- ]?over|knowledge transfer|kt plan|early release|negotiate (?:my )?notice|reduce (?:my )?notice|serve (?:full|partial|out)|garden(?:ing)? leave|lwd (?:of|is|on|will be)|last working day (?:of|on|is|will be)|relieving (?:date|letter on|on)|formal resignation|notice buyout|notice negotiate)\b/i;
const BGV_DOC_NAMED = /\b(?:form\s*16|uan|pay\s*slips?|relieving letter|experience letter|pan(?:\s*card)?|aadha+r|epfo|epf statement|salary slip|appointment letter)\b/i;
const COMP_PROBE_RE = /\b(?:what(?:'?s| is) the (?:cliff|vesting|variable|clawback|payout|breakup)|cliff (?:period|duration|of)|vesting (?:schedule|period|cliff|over)|variable (?:payout|percentage|%|pay out)|clawback (?:terms|duration|period|amount)|how (?:much|long) is the (?:cliff|vesting|clawback|variable)|joining bonus clawback|esop (?:vest|cliff|schedule|grant)|when does the (?:variable|bonus|esop) (?:pay|vest|kick)|kya cliff hai|cliff kitna|variable kitna)\b/i;
const HIKE_RATIONALE = /\b(market|benchmark|levels|glassdoor|range|peers?|competing|other offer|levels\.fyi|because i|since i'?ve|scope|impact|delivered|saved|drove|market rate|market mein)\b/i;

/* Salary breakup vagueness — when HR asks for the fixed/variable/bonus
   split and the candidate only gives a single CTC number with no
   component breakdown. Indian HR treats single-number CTC answers as a
   red flag (variable rarely paid out is the classic inflation). */
const BREAKUP_ASKED = /\b(?:fixed|variable|joining\s+bonus|retention\s+bonus|rsu|esop|breakup|break[- ]?up|split|component|structure)\b[\s\S]{0,40}\b(?:ctc|comp|package|salary)\b|\bctc[\s\S]{0,40}\b(?:fixed|variable|breakup|break[- ]?up|split|component|structure)\b/i;
const BREAKUP_DETAIL = /\b(?:fixed|base)\b[\s\S]{0,30}\b(?:variable|bonus|rsu|esop)\b|\b\d{1,3}(?:[.,]\d{1,2})?\s*(?:lpa|lakhs?|lakh|l\b)\s*(?:fixed|base|variable|bonus|rsu)\b|\bvariable\s+is\s+\d|\bjoining\s+bonus\s+(?:of\s+)?\d/i;

/* Reference-check stalling — HR asks for ex-manager references and the
   candidate stalls/refuses. In India, "current manager doesn't know I'm
   leaving" is fine; "I'd rather not share any references" is a hard stop. */
const REFERENCE_PROMPT = /\b(reference(?:s)?|ex[- ]?manager|previous manager|former manager|reference check)\b/i;
const REFERENCE_REFUSAL = /\b(?:no references|don'?t want to share (?:any )?references?|rather not (?:give|share|provide) (?:any )?references?|no one to (?:give|share)|references nahi|reference nahi de sakta)\b/i;

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

/* CTC-first opening — candidate's very first or second turn asks about
   salary before role/team is even discussed. Indian HR reads this as
   transactional / unprofessional. */
const CTC_FIRST_USER = /\b(?:what(?:'s| is) the (?:ctc|package|salary|pay)|how much (?:does|will) (?:this|the role) pay|salary range|ctc range|package (?:offered|kya hai)|what are you offering)\b/i;

/* ── v4.2 resume cross-checks ────────────────────────────────────────
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

export const hrRoundAnalyzer: FocusAnalyzer = {
  focus: "hr-round",
  version: "hr-round-v4.6.0",

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

    /* v4.6 / 2.1 — notice_period_shallow. Concrete notice answer
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
        if (r && r.text && r.text.length < 220 && SALARY_NUMBER.test(r.text) && !BREAKUP_DETAIL.test(r.text)) {
          flags.add("salary_breakup_vague");
          gaps.push({ dimension: "comp_transparency", expected: "When asked for the CTC structure, state fixed / variable / joining bonus / RSU split explicitly", observed: "Candidate gave a single CTC number with no component breakup — Indian HR reads this as inflated variable", severity: "medium" });
          break;
        }
      }
    }

    /* v4.6 / 2.2 — bgv_literacy_low. HR raised BGV / documents but the
       candidate never named a single doc back (Form 16 / UAN /
       payslip / relieving letter / Aadhaar / PAN / EPFO). Even when
       not actively evading, this reads as unprepared and slows
       onboarding. Distinct from bgv_document_evasion which requires
       active refusal language. */
    {
      const hrAskedBgv = transcript.some((t) => isAi(t) && BGV_PROMPT.test(t.text || ""));
      const userNamedDoc = transcript.some((t) => isUser(t) && BGV_DOC_NAMED.test(t.text || ""));
      if (
        hrAskedBgv &&
        !userNamedDoc &&
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

    /* v4.6 / 2.3 — comp_breakup_probe_missing. HR mentioned benefits /
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

    /* ── v4.2 resume cross-checks (silent no-op when resume null) ─── */
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
       every flag is kept as-is (fail-open). When the call fails, same. So the
       worst case is "back to v4.3.2 behavior," never a regression. */
    const rescoreCandidates: FlagRescoreCandidate[] = [];
    const RESCORE_RUBRICS: Record<string, string> = {
      generic_why_company: "Did the candidate name a verifiable specific (launch name, leader name, blog title, recent move, product, domain)? If yes, the flag is FALSE.",
      counter_offer_dodge: "Did the candidate commit OR did they only defer? If they deferred WITH a stated decision criterion (e.g. 'I'll commit once the role scope is locked'), the flag is FALSE. Pure 'I'll see' / 'we'll see' / 'dekhta hu' is TRUE.",
      generic_self_intro: "Does the intro have a narrative arc (years of experience + role + an outcome / project)? If yes, the flag is FALSE. Purely token-listing (skills, tech stack) with no story is TRUE.",
    };
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

    /* ── Coaching clusters (v4.5) ──
       Group flags by theme so the report leads with "pattern" framing
       when ≥2 flags in a cluster fire. Indian HR scores compliance and
       commitment as patterns, not isolated mistakes — telling the
       candidate "3 evasive signals across compliance" lands harder
       than 3 separate one-liners further down. Linear per-flag tips
       still follow so the candidate sees the per-issue specifics. */
    const CLUSTERS: Array<{ label: string; theme: string; members: string[] }> = [
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
        ],
      },
    ];
    for (const cluster of CLUSTERS) {
      const hits = cluster.members.filter((m) => flags.has(m));
      if (hits.length >= 2) {
        tips.push(
          `Pattern, not isolated: ${hits.length} signals across ${cluster.theme} (${hits.slice(0, 4).join(", ")}). Indian HR scores ${cluster.label} as a cluster — fix the pattern, not just the loudest one.`,
        );
      }
    }

    /* Phase 1.3 — positive-signal counterpart to counter_offer_dodge.
       Surfaced before the negative tips so the candidate sees credit
       first. We don't add it to the rubric-gap list (not a gap) but
       we DO push it into coachingNotes for visibility. */
    if (flags.has("offer_accepted_graceful")) {
      tips.push("Strong commitment signal: you closed the counter-offer probe cleanly ('won't entertain a counter / once I sign I'm in'). HR's #1 fear is pre-joining drop-out — that line de-risks you. Keep using it.");
    }

    if (flags.has("user_anchor_leaked_salary")) tips.push("Never name a salary first — deflect with 'I'd want to understand the role + level before discussing comp.'");
    if (flags.has("user_badmouthing_employer")) tips.push("Reframe past frustrations as growth opportunities. HR scores professionalism heavily.");
    if (flags.has("generic_self_intro")) tips.push("Tighten 'tell me about yourself' to a 90-second story with 2 concrete projects + outcomes.");
    if (flags.has("vague_notice_period")) tips.push("Know your notice period cold — exact days, buyout policy, earliest LWD. Vague answers signal flight risk.");
    if (flags.has("notice_period_shallow")) tips.push("Concrete days alone aren't enough at mid-senior. Layer on: buyout cost (typically 1 month gross), handover / KT plan, earliest LWD with manager sign-off, and whether early release is precedented. That's what HR scores.");
    if (flags.has("bgv_literacy_low")) tips.push("Name the docs by name when BGV comes up: 'Form 16 for last 2 years, UAN active, last 3 payslips, relieving letter from each employer.' Fluency signals you've onboarded before — opaque hand-waving slows down BGV intake.");
    if (flags.has("comp_breakup_probe_missing")) tips.push("Always probe ESOP / variable / clawback terms before you sign: cliff (typically 1yr), vesting (4yr standard), variable payout history (% paid out last 2 cycles), joining-bonus clawback duration. Accepting blind is the #1 post-joining regret pattern.");
    if (flags.has("bgv_document_evasion")) tips.push("Keep payslips (last 3), Form 16, relieving letters, PAN/Aadhaar/UAN ready. Hesitation here blocks onboarding via BGV.");
    if (flags.has("bgv_document_evasion_sustained")) tips.push("Sustained BGV evasion across multiple probes is the strongest pre-offer red flag. Pre-prep a single line: 'I have all documents — payslips, Form 16, UAN — ready to share over secure channel.'");
    if (flags.has("bgv_document_initial_hedge")) tips.push("You recovered on a later BGV probe, but the first hedge still registers. Lead with confidence: 'Yes, I can share' beats 'let me check first.'");
    if (flags.has("payslip_refusal") && !flags.has("bgv_document_evasion")) tips.push("Refusing payslips reads as inflated current CTC. Share them — or justify why your number isn't anchored on current.");
    if (flags.has("counter_offer_dodge")) tips.push("On counter-offers: 'If I accept yours, I won't take a counter.' Pre-joining drop-out is HR's #1 fear — give them the clarity.");
    if (flags.has("generic_why_company")) tips.push("Drop 'great culture / great brand'. Name one specific thing: a recent launch, a leader's blog, a domain bet.");
    if (flags.has("gap_unexplained")) tips.push("Own gaps with one crisp sentence: dates + reason + what you did with the time. Indian HR will probe — be ready.");
    if (flags.has("hike_rationale_thin")) tips.push("Anchor hike % on market data or scope, not a desired round number.");
    if (flags.has("salary_breakup_vague")) tips.push("When HR asks structure, break the CTC down: 'Fixed X, variable Y (paid out Z%), joining bonus A, RSU vest B over 4 years.' Single-number CTC reads as inflated variable.");
    if (flags.has("reference_refusal")) tips.push("Have 2 references ready (ex-managers preferred). Saying 'no references' is a hard BGV blocker — even one current peer + one ex-manager is fine.");
    if (flags.has("reference_refusal_sustained")) tips.push("Refusing references across multiple HR probes is a hard pre-offer stop. Line up at least one ex-manager + one peer before the next round.");
    if (flags.has("reference_initial_hedge")) tips.push("You recovered on the second reference probe, but the initial hedge still scored. Have a name + role ready before HR asks twice.");
    if (flags.has("payslip_refusal_sustained")) tips.push("Refusing payslips on every probe locks HR into assuming inflated CTC. Share them or pre-empt: 'My ask isn't anchored on current — here's the rationale.'");
    if (flags.has("offer_letter_delay_anxiety")) tips.push("Hold offer-letter timing questions for the close — asking mid-interview reads as anxious. Phrase it cleanly: 'What's your typical timeline from verbal to written offer?'");
    if (flags.has("prior_bgv_fail_uncontextualised")) tips.push("Prior BGV failure? Own it with date + reason + resolution in one breath: 'flagged in 2022 for date overlap with my notice, cleared in 30 days.' Recruiters trust honest specifics.");
    if (flags.has("non_compete_unquantified")) tips.push("Non-compete? State scope crisply: duration + geography + industry coverage. 'Vague non-compete' = recruiter timebomb.");
    if (flags.has("genai_flat_denial")) tips.push("2026 HR assumes everyone uses AI. Flat denial reads as dishonest. Answer the HOW: 'Used Copilot for boilerplate; wrote tests by hand; verified security-sensitive bits.'");
    if (flags.has("loyalty_overcommit")) tips.push("Don't promise N years flat. Real answer: 'I plan for 3+ years; I can't promise but I'd communicate early if anything changed.' HR respects calibration.");
    if (flags.has("aspiration_walkback")) tips.push("Don't walk back stated ambitions when probed. Tie them to the role: 'Founder ambition in 3+ yrs — this role gives me the X experience I need first.'");
    if (flags.has("floor_collapse")) tips.push("Never collapse to 'whatever you can offer' on band mismatch. Hold a floor with rationale: 'My floor is X — anchored on competing offer / current + reasonable hike.'");
    if (flags.has("reverse_interview_low_quality")) tips.push("Close with 2-3 substantive questions: team structure, what success looks like in 90 days, manager style. No questions = low engagement signal.");
    if (flags.has("job_hopping_pattern")) tips.push("Short stints? Pre-empt the probe. One line per move: 'left X after 10 months — founder pivoted away from my domain; left Y after a year — bond completed.' Specifics defuse the instability read.");
    if (flags.has("moonlighting_flat_denial")) tips.push("Don't flat-deny moonlighting. 2026 HR expects scoped honesty: 'I contribute to open-source on weekends, no client conflict, disclosed in writing.' That answer scores; 'no, never' reads as evasive.");
    if (flags.has("pf_uan_evasive")) tips.push("Know your UAN cold + confirm no overlapping PF contributions. BGV pulls EPFO; surprises here block onboarding.");
    if (flags.has("family_constraint_freeze")) tips.push("Family / relocation probes deserve a calm one-liner: 'Open to relocation' or 'I have a hometown preference, happy to discuss.' Freezing reads as a hidden constraint.");
    if (flags.has("joining_date_overpromise")) tips.push("Don't promise '15-day join' on a 60-day notice. Be honest: 'My notice is 60 days; I can attempt a buyout if there's flexibility — what's typical here?'");
    if (flags.has("clawback_blind_accept")) tips.push("Never blind-accept a clawback. Ask: 'What's the duration, amount, and pro-rate structure?' Acceptance without terms invites post-joining shock.");
    if (flags.has("rto_flat_refusal")) tips.push("Flat WFH-only is a 2026 dealbreaker at most Indian firms. Negotiate: 'I can do 3 in-office days; what's the hybrid structure?'");
    if (flags.has("designation_downgrade_defensive")) tips.push("Don't dismiss the title question. Frame it: 'Titles map to your leveling; I care about the scope and the problem space — happy to align on what your X-level looks like.'");
    if (flags.has("certification_gap_evasion")) tips.push("Know your cert dates and IDs cold. HR verifies via Credly/AWS directly — vague answers + a discrepancy read as resume inflation.");
    if (flags.has("ctc_first_question_user")) tips.push("Don't open with salary. Establish role / team / scope first; surface comp once HR signals discovery is wrapping. Asking comp upfront reads as transactional.");
    if (flags.has("dimensions_thin_coverage")) tips.push("Real Indian HR covers 7 dimensions. Re-run with notice/BGV/counter-offer/benefits prompts.");
    if (flags.has("resume_transcript_mismatch")) tips.push("Every employer you say out loud should already be on your resume. BGV pulls the resume as source-of-truth — verbal employers that aren't listed read as fabrication.");
    if (flags.has("resume_gap_unaddressed")) tips.push("Your resume shows a ≥3-month employment gap. Don't wait for the real interviewer to corner you — pre-prep a one-liner: 'between Mar 2022 and Jan 2023 I [studied / cared for family / took a sabbatical to ship X]; here's what I did with the time.'");
    if (flags.has("under_titled_candidate")) tips.push("Your resume has 5+ years of experience but every title reads as plain IC (Software Engineer / Developer). Indian HR anchors comp on title, not scope — retitle to match what you actually own (Senior / Lead) or be ready to walk through scope that exceeds the level on paper. Under-titling costs lakhs at offer time.");
    if (flags.has("inflated_seniority_claim")) tips.push("Your resume reads Senior/Lead/Staff/Principal but your years don't support it yet. Either retitle to match the level you can defend (with scope + ownership stories) or be ready to justify the leap: 'titled Senior because I lead the X module end-to-end since month N — I know that's quick.'");

    const ILLEGAL_PROMPT_RE = /\b(?:caste|religion|mother tongue|marital|married|family.*(?:plan|soon)|are you (?:from|originally)|community)\b/i;
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
