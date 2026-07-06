/* HR-round analyzer pattern bank.
 *
 * Extracted from `hr-round.ts` (v5.7.0) — pure constants + small
 * pure helpers, no analyze() orchestration. The split keeps each
 * file under the ESLint 1500-LOC warn threshold and makes the
 * regex bank reviewable in isolation when adding new flags.
 *
 * Anything stateless and reusable lives here: every regex, the
 * resume-summary helpers, the dimensions/clusters tables, and the
 * RESCORE_RUBRICS map. The orchestration in hr-round.ts imports
 * what it needs and stays focused on per-flag detection logic. */

import type { ResumeForAnalyzer } from "./_types";
import { parseResumePeriod } from "../_resume-period";

export const SALARY_NUMBER = /(?:₹|inr\s*)?\d{1,3}(?:[.,]\d{1,2})?\s*(?:lpa|lakhs?|lakh|l\b|cr|crores?|k|usd|\$)/i;
export const ASKED_ABOUT_SALARY = /\b(salary expectation|comp(?:ensation)? expectation|what are you looking for|target salary|expected ctc|current ctc|hike|package (?:kya|kitna|expectation)|kitna package|salary kitni|ctc kitna)\b/i;
export const HIKE_PROMPT = /\b(hike|why are you asking|jump from your current|% (?:on|over) (?:your )?current|kitna hike|hike kitna)\b/i;
export const PAYSLIP_PROMPT = /\b(payslip|pay slip|form\s*16|salary slip|salary proof)\b/i;
export const PAYSLIP_REFUSED = /\b(?:not comfortable|prefer not|can'?t share|cannot share|don'?t share|won'?t share|not willing|not (?:able|ready) to share|share nahi|nahi de sakta|share karna mushkil)\b/i;
export const BADMOUTHING = /\b(toxic|terrible|awful|hated|worst|stupid|incompetent|micromanag|backstab|crook|garbage|nightmare|abusive|harass|bakwaas|bekaar|ghatiya|chutiya)\b/i;
export const GAP_PROMPT = /\b(gap|career break|sabbatical|why (?:were you|are you|was there) (?:not working|unemployed|a (?:gap|break))|career mein gap)\b/i;
/* A gap answer is "explained" — even if short — when it carries a concrete
   anchor: a year, a duration, a month, or a named reason. Guards
   gap_unexplained against false-positiving a crisp factual answer like
   "4-month gap in 2023, cared for ill father, back at Infosys Feb 2024"
   purely because it is under the length gate. */
export const GAP_EXPLAINED = /\b(?:19|20)\d{2}\b|\b\d+[\s-]*(?:month|months|year|years|week|weeks|yr|yrs|mahine|saal)\b|\b(?:january|february|march|april|june|july|august|september|october|november|december)\b|\b(?:sabbatical|maternity|paternity|medical|health|surgery|illness|bereavement|layoff|laid off|restructur|relocat|upskill|reskill|certification|masters|mba|gmat|gate exam|preparation|startup|freelanc|consulting|higher stud|visa|immigration|caregiv|caring for|cared for)\b|\bfamily (?:reason|emergenc|commitment|obligation|matter|issue|health)|\b(?<!of )courses?\b/i;
export const NOTICE_PERIOD = /\b(notice period|when can you (?:start|join)|availability|join (?:by|on|in)|relocat|location preference|lwd|last working day|buyout|earliest (?:join|start)|kab join|join kab|notice kitna)\b/i;
export const NOTICE_ASKED = /\b(notice period|when can you (?:start|join)|earliest (?:join|start)|lwd|last working day|kab join kar|notice kitna)\b/i;
export const NOTICE_VAGUE = /\b(?:not sure|don'?t know|haven'?t checked|will check|depends on|maybe|few months|some time|not decided|need to (?:check|find out|confirm)|pata nahi|dekh ke bataunga|check karke|abhi confirm nahi|thoda time)\b/i;
/* Notice-period concrete answers include the full Indian range.
   180 / 6 months is standard at LTI Mindtree, Cognizant, Persistent,
   most of BFSI; flagging a candidate who says "180 days, no buyout"
   as vague would be a false positive. */
export const NOTICE_CONCRETE = /\b(?:30|45|60|90|120|180|three months?|two months?|one month|six months?|four months?|sixty|ninety|thirty|teen mahine|do mahine|ek mahina|chhe mahine|chai mahine)\b/i;
export const BGV_PROMPT = /\b(bgv|background verification|background check|payslip|form\s*16|relieving letter|experience letter|uan|pan card|aadhaar|aadhar|marksheet|reference check|first advantage|authbridge|ongrid)\b/i;
export const BGV_EVASIVE = /\b(?:not comfortable|prefer not|can'?t share|cannot share|don'?t share|won'?t share|not willing|not (?:able|ready) to share|don'?t have|lost|misplaced|nahi hai|kho gaya|share nahi)\b/i;
export const COUNTER_OFFER_PROMPT = /\b(counter[- ]offer|counter offer|if (?:your )?current (?:company|employer) (?:offers|matches|counters)|other offers|interviewing elsewhere|if we (?:make|extend) (?:you )?an offer|commitment within|kahin aur interview|aur offer)\b/i;
export const COUNTER_OFFER_DODGE = /\b(?:i'?ll see|it depends|maybe|not sure|can'?t say|too early|let me think|i'?ll decide (?:then|later)|will see how|dekhta hu|dekhte hain|soch ke bataunga|tab ki tab|abhi nahi bol sakta)\b/i;
/* Positive counterpart to COUNTER_OFFER_DODGE — candidate handles the
   counter-offer probe gracefully with a firm "no counter" commitment.
   When this fires we suppress counter_offer_dodge AND record a
   positive signal so the report credits the candidate. */
export const OFFER_ACCEPTED_GRACEFUL = /\b(?:if i (?:accept|take) (?:yours|your offer)[\s,]+i (?:won'?t|will not|don'?t plan to) (?:take|consider|entertain) (?:a |any )?counter|no counter[- ]?offer (?:consideration|for me|here|please)|(?:i'?ve|i have) (?:already )?(?:mentally )?decided[\s,]*(?:no counter|on this move|to (?:leave|move))|once i sign[\s,]+i'?m (?:in|committed|done)|i (?:won'?t|will not) entertain (?:a |any )?counter[- ]?offer|counter[- ]?offer (?:not in (?:the )?picture|out of (?:the )?picture|isn'?t happening)|haan main commit (?:karta|kar) (?:hu|raha)|i'?m done with them|no second thoughts (?:on (?:this|the) move)?|(?:yeah |yes )?i'?m clear on (?:this|the) move|i'?ve made up my mind|made up my mind (?:already|on (?:this|the) move))\b/i;
export const WHY_COMPANY_PROMPT = /\b(why (?:our|this) company|why us|why are you interested in (?:us|our|this company)|what do you know about (?:us|our company)|why (?:do )?you want to (?:join|work (?:at|with|here))|humari company kyu|yahan kyu)\b/i;
export const GENERIC_WHY = /\b(great culture|great brand|good company|reputed|reputation|big name|industry leader|top company|growth opportunit|good work[- ]?life|good place|nice place|love the company|achi company|badi company|brand achi)\b/i;
export const SPECIFIC_WHY = /\b(launched|launch|product|feature|leader|founder|ceo|cto|paper|blog|talk|conference|series [a-d]|ipo|acquired|acquisition|mission|domain|space|sector|stack|engineering blog|open source|case study|customer|use case)\b/i;
export const SELF_INTRO_PROMPT = /\b(tell me about yourself|walk me through|introduce yourself|your background|apne baare mein|introduction)\b/i;
export const SPECIFICS = /\b\d+\s*(?:years?|months?|saal|mahine)\b|\b(?:built|led|shipped|launched|migrated|deployed|scaled|owned|drove|delivered|banaya|kiya tha|lead kiya)\b/i;
export const BENEFITS_PROMPT = /\b(joining bonus|signing bonus|clawback|probation|bond|service agreement|esop|rsu|vesting|cliff|insurance|epf|provident fund|gratuity|nps|variable pay)\b/i;

/* Depth validators — distinguish shallow signals from real engagement. */
export const NOTICE_DEPTH = /\b(?:buy[- ]?out|hand[- ]?over|knowledge transfer|kt plan|early release|negotiate (?:my )?notice|reduce (?:my )?notice|serve (?:full|partial|out)|garden(?:ing)? leave|lwd (?:of|is|on|will be)|last working day (?:of|on|is|will be)|relieving (?:date|letter on|on)|formal resignation|notice buyout|notice negotiate)\b/i;
export const BGV_DOC_NAMED = /\b(?:form\s*16|uan|pay\s*slips?|relieving letter|experience letter|pan(?:\s*card)?|aadha+r|epfo|epf statement|salary slip|appointment letter)\b/i;
export const COMP_PROBE_RE = /\b(?:what(?:'?s| is) the (?:cliff|vesting|variable|clawback|payout|breakup)|cliff (?:period|duration|of)|vesting (?:schedule|period|cliff|over)|variable (?:payout|percentage|%|pay out)|clawback (?:terms|duration|period|amount)|how (?:much|long) is the (?:cliff|vesting|clawback|variable)|joining bonus clawback|esop (?:vest|cliff|schedule|grant)|when does the (?:variable|bonus|esop) (?:pay|vest|kick)|kya cliff hai|cliff kitna|variable kitna)\b/i;

export const COUNTER_OFFER_VOLUNTEERED = /\b(?:my (?:current )?(?:employer|company|manager|boss) (?:is likely to|might|will|may) (?:counter|match|come back)|current (?:employer|company) (?:gave|offered|made) (?:me )?(?:a )?counter|already (?:got|received|have) (?:a )?counter[- ]?offer|they'?re (?:trying to|going to) match|trying to retain me|retention (?:offer|bonus) on the table|they want me to stay|they'?re working on (?:a |my )?revised (?:offer|package)|(?:my )?manager has spoken to (?:leadership|hr|skip)|hr called me (?:yesterday|today|last week) (?:about|on)|asked me to (?:think|reconsider) before resigning|asked me to (?:wait|hold) before resigning|they'?re putting together (?:a |an )?(?:counter|revised|new offer))\b/i;
export const COUNTER_OFFER_DECLINE = /\b(?:i (?:declined|refused|turned (?:it )?down|rejected) (?:it|the counter|their offer)|told them no|not (?:taking|considering|accepting) (?:the |their |any )?counter|will not entertain|won'?t entertain|already (?:said|told them) no|no chance i (?:take|accept))\b/i;
/* Firm forward-commitment to join REGARDLESS of a counter. Distinct from
   DECLINE (which is about an already-received counter) and GRACEFUL (a
   specific "no counter" script). Guards counter_offer_dodge from firing on
   an answer that opens with a hedge phrase ("it depends...") but resolves
   into a clear commitment ("...but I'm firm on this move, a counter won't
   change it"). */
export const COUNTER_OFFER_COMMITTED = /\b(?:i'?m (?:firm|committed|decided|set|sure|clear) (?:on|about) (?:this|the) (?:move|switch|offer|role|change|decision)|i'?m (?:definitely|100%|fully|surely) joining|(?:my )?(?:decision|mind) is (?:final|made (?:up)?)|i (?:really |genuinely )?want to join (?:you|your|this)|(?:i'?m|i am) (?:on board|all in)|(?:a )?counter (?:won'?t|will not|doesn'?t|wouldn'?t) (?:change|matter|move|sway)|(?:not|won'?t be|wouldn'?t) using (?:this|your offer|it) as (?:a )?(?:leverage|lever|bargaining))\b/i;
export const PROBATION_PROMPT = /\b(probation(?:ary)?(?:\s+period)?|probationary|confirmation(?:\s+period)?|under probation|during probation)\b/i;
export const PROBATION_PROBE = /\b(?:how long is the probation|probation (?:period|duration|length) (?:is|of)|(?:what'?s|what is) the (?:probation|confirmation) (?:period|criteria|process)|confirmation (?:criteria|review|process)|probation pay|salary during probation|notice (?:during|in) probation|probation kitni|probation kab tak|kya criteria hai)\b/i;
export const HIKE_RATIONALE = /\b(market|benchmark|levels|glassdoor|range|peers?|competing|other offer|levels\.fyi|because i|since i'?ve|scope|impact|delivered|saved|drove|market rate|market mein)\b/i;

export const BOND_PROMPT = /\b(?:service\s+bond|training\s+bond|(?:two|one|1|2)[\s-]year\s+bond|service\s+agreement|bond\s+(?:period|amount|duration|penalty)|surety|notarized\s+bond)\b/i;
export const BOND_PROBE_RE = /\b(?:bond (?:period|duration|amount|breakage|penalty|pro[- ]?rate)|how (?:much|long) is the bond|what(?:'?s| is) the bond (?:period|amount|penalty)|breakage (?:fee|amount|penalty)|early exit (?:penalty|cost)|bond kitne (?:saal|years)|bond ki (?:duration|amount))\b/i;

export const PEDIGREE_PROMPT = /\b(?:cgpa|gpa|graduation marks|college tier|which (?:college|university|institute)|tenth (?:percentage|marks)|twelfth (?:percentage|marks)|(?:10th|12th|hsc|ssc) (?:percentage|marks|score)|graduation (?:from|in|year))\b/i;
export const PEDIGREE_EVASION = /\b(?:don'?t remember (?:exactly|the (?:exact )?(?:number|cgpa|percentage))|long time ago|doesn'?t matter (?:now|anymore)|why does (?:that|it) matter|pata nahi exact|yaad nahi)\b/i;

export const BREAKUP_ASKED = /\b(?:fixed|variable|joining\s+bonus|retention\s+bonus|rsu|esop|breakup|break[- ]?up|split|component|structure)\b[\s\S]{0,40}\b(?:ctc|comp|package|salary)\b|\bctc[\s\S]{0,40}\b(?:fixed|variable|breakup|break[- ]?up|split|component|structure)\b/i;
export const BREAKUP_DETAIL = /\b(?:fixed|base)\b[\s\S]{0,30}\b(?:variable|bonus|rsu|esop)\b|\b\d{1,3}(?:[.,]\d{1,2})?\s*(?:lpa|lakhs?|lakh|l\b)\s*(?:fixed|base|variable|bonus|rsu)\b|\bvariable\s+is\s+\d|\bjoining\s+bonus\s+(?:of\s+)?\d/i;
export const BREAKUP_GENUINELY_UNKNOWN = /\b(?:i (?:don'?t|do not) (?:actually )?know (?:the )?(?:exact )?(?:variable|payout|breakup|split)|(?:my )?company (?:doesn'?t|does not) share (?:the )?(?:variable|payout)|never (?:got|seen) (?:the )?(?:exact )?breakup|payout (?:history|details) (?:isn'?t|aren'?t|not) shared|not transparent (?:on|about) variable|variable (?:payout )?isn'?t (?:disclosed|shared|transparent))\b/i;

export const DEFERENTIAL_OPENER = /\b(?:respected (?:sir|ma'?am|madam)|honou?rable (?:sir|ma'?am)|it'?s (?:an |such )?(?:honou?r|privilege|great honou?r) (?:to be|to have|to be (?:considered|here))|thank you so much (?:for|sir|ma'?am)[^.]{0,40}opportunity|thanks (?:a lot |so much )?(?:for|sir|ma'?am)[^.]{0,40}opportunity|(?:first of all|firstly)[\s,]+thank you[^.]{0,40}(?:sir|ma'?am|opportunity)|i'?m (?:very |so |really )?(?:grateful|thankful|honou?red) (?:to|for|that)[^.]{0,40}(?:opportunity|considered|shortlist))\b/i;

export const COMP_RAISED_BY_USER = /\b(?:what(?:'?s| is) the (?:ctc|package|salary|pay|comp)|how much (?:does|will) (?:this|the role) pay|salary range|ctc range|package (?:offered|kya hai)|what are you offering|expected (?:ctc|package))\b/i;

export const REFERENCE_PROMPT = /\b(reference(?:s)?|ex[- ]?manager|previous manager|former manager|reference check)\b/i;
export const REFERENCE_REFUSAL = /\b(?:no references|don'?t want to share (?:any )?references?|rather not (?:give|share|provide) (?:any )?references?|no one to (?:give|share)|references nahi|reference nahi de sakta)\b/i;
export const REFERENCE_CURRENT_DEFERRED = /\b(?:current (?:manager|employer|boss|company)[^.]{0,80}(?:after (?:the )?offer|once (?:i|the offer) (?:have|is) (?:the )?offer|post offer letter|after offer letter)|happy to share (?:ex|previous|former|past) (?:managers|employers)|can share (?:references )?from (?:ex|previous|former) (?:employers|managers|companies))\b/i;

export const OFFER_DELAY_ANXIETY = /\b(?:when (?:will|do) i get the (?:written|formal) offer|how long (?:until|till) (?:the )?offer letter|offer letter (?:will|when) (?:come|arrive|be (?:sent|shared))|verbal offer.*written|exploding offer|offer (?:will )?expire|deadline to (?:accept|decide)|how (?:much )?time to (?:accept|decide))\b/i;

export const PRIOR_BGV_FAIL_PROMPT = /\b(?:ever fail(?:ed)? (?:a )?(?:background|bgv) check|prior bgv (?:failure|issue)|any bgv (?:fail|issue|discrepancy))\b/i;
export const PRIOR_BGV_FAIL_ADMIT = /\b(?:yes,?\s*(?:i|once|there)|once it (?:did|happened|failed)|i did fail|there was an issue|it got flagged)\b/i;
export const PRIOR_BGV_CONTEXT = /\b(?:in\s+\d{4}|in\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)|because|due to|reason was|resolved|cleared|sorted)\b/i;

export const NONCOMPETE_MENTION = /\b(?:non[- ]?compete|non[- ]?solicit|garden(?:ing)?\s+leave|cooling[- ]?off period|restraint of trade|i\s*p\s+assignment|moonlight(?:ing)?\s+restriction)\b/i;
export const NONCOMPETE_QUANTIFIED = /\b(?:\d+\s*(?:months?|years?|days?)|expires? (?:on|in)|until\s+\d|geography|industry|sector|covers?\s+(?:competitors|clients))\b/i;

export const GENAI_PROMPT = /\b(?:chat\s*gpt|copilot|cursor|claude|gemini|gen\s*ai|ai\s+(?:tool|assist)|llm)\b[\s\S]{0,40}\b(?:use|using|used|help|during)\b|\b(?:use|using|used)\b[\s\S]{0,30}\b(?:chat\s*gpt|copilot|cursor|claude|gemini|gen\s*ai|llm)\b/i;
/* v5.6.0: Hinglish forms ("nahi kiya", "kabhi nahi"). */
export const GENAI_DENIAL = /\b(?:no,?\s*(?:i|never|not at all)|i didn'?t use|never used|absolutely not|of course not|nahi(?:n)? (?:kiya|use kiya|liya)|kabhi nahi(?:n)?|bilkul nahi(?:n)?)\b/i;
export const GENAI_HONEST = /\b(?:yes,?\s*(?:i|for|i used)|i used (?:it|chat|copilot|cursor|claude)|i did use|for (?:boilerplate|syntax|drafts|brainstorm|debugging)|verified (?:by|with)|then i (?:reviewed|verified|tested))\b/i;

export const LOYALTY_PROMPT = /\b(?:promise (?:me )?you (?:won'?t|will not) leave|commit to (?:at least )?\d+ years|stay (?:for|at least) \d+ years|not (?:leaving|switching) (?:for|in) \d+ years)\b/i;
/* v5.6.0: tightened. Calibrated answers ("Yes, I commit … but I'll
   communicate early if X") no longer trip; LOYALTY_CALIBRATED gates. */
export const LOYALTY_FLAT_YES = /\b(?:yes,?\s*(?:i (?:promise|commit|will|won'?t))|absolutely,?\s*i (?:promise|commit|won'?t)|sure,?\s*i (?:promise|commit|won'?t)|haan,?\s*(?:i )?(?:promise|commit|pakka)|pakka\s+(?:commit|promise|stay)|guarantee\s+(?:i|that i)\s+(?:will|won'?t))\b/i;
export const LOYALTY_CALIBRATED = /\b(?:but\s+(?:i|if)|unless|i can'?t (?:promise|guarantee)|communicate early|let you know|plan for|aim for|hope to|3\+\s*years?|five\s+plus|conditional|if (?:things|the role|nothing))\b/i;

export const ASPIRATION_PROBE = /\b(?:you mentioned (?:starting|wanting to start|founding|own company|mba|business)|why (?:join us|come here) (?:now|then|if))\b[\s\S]{0,80}\b(?:start|founder|own company|mba|business|venture)\b/i;
export const ASPIRATION_WALKBACK = /\b(?:no,?\s*i (?:was|wasn'?t)|actually|i didn'?t mean|that was|i'?ve changed|not really|just (?:said|mentioned) it)\b/i;

export const BAND_MISMATCH_PROMPT = /\b(?:(?:above|outside|over) (?:our|the) band|(?:we can'?t|cannot) (?:match|offer) (?:that|your number)|your (?:number|ask) is (?:high|outside)|what(?:'s| is) your (?:real )?floor|tighten (?:your )?ask)\b/i;
/* v5.6.0: Hinglish forms ("jo aap dein", "aap decide karo"). */
export const FLOOR_COLLAPSE = /\b(?:whatever (?:you|the company) (?:can|offer)|i'?m (?:flexible|open to anything)|happy with (?:whatever|anything)|no specific (?:floor|number)|you decide|jo (?:aap|tum) (?:dein|do|de|offer)|aap (?:decide|tay) karo|jitna (?:dein|de)|koi (?:bhi )?number|no preference|as per (?:company|your) (?:policy|standard))\b/i;

export const REVERSE_INVITED = /\b(?:do you have (?:any )?questions for me|any questions (?:from your|for) (?:side|me)|anything you'?d like to ask)\b/i;
/* v5.6.0: Hinglish forms ("nahi koi sawal", "kuch nahi"). */
export const REVERSE_FLUFF = /\b(?:no(?:t really)?,?\s*(?:nothing|no questions|all good|i'?m good)|just (?:wanted to know|curious about) (?:the )?(?:start date|joining date|location|timing)|nahi(?:n)?,?\s*(?:koi (?:sawal|question)|kuch nahi|sab clear)|sab (?:clear|theek) hai|covered (?:everything|sab kuch))\b/i;
export const REVERSE_SUBSTANTIVE = /\b(?:team structure|reporting (?:line|to)|success (?:metric|criteria|look like)|first (?:30|60|90) days|manager(?:'s)? style|growth path|attrition|tech stack|on[- ]?call|roadmap|investment in|how is success measured)\b/i;

export const BGV_RESOLVED = /\b(?:yes,?\s*i (?:can|will|have|am able to) (?:share|provide)|happy to (?:share|provide)|will (?:share|send|provide) (?:them|those|by)|i (?:have|already have) (?:them|those|the documents)|can definitely (?:share|provide))\b/i;
export const REFERENCE_RESOLVED = /\b(?:i have (?:two |2 |references? ready|some references?)|yes,?\s*(?:references? )?(?:are )?(?:ready|available)|will (?:share|provide) (?:references?|their (?:names?|contacts?))|happy to (?:share|provide) references?)\b/i;

/* ── Wave-2 HR-round flags — real-life Indian HR scenarios ───────────── */
export const JOB_HOPPING_PROMPT = /\b(?:multiple (?:jobs|switches|companies)|short (?:stint|tenure)|job[- ]?hop|why so many (?:switches|companies)|tenure pattern|you'?ve switched (?:often|a lot))\b/i;
export const SHORT_STINT_VOLUNTEERED = /\b(?:(?:6|7|8|9|10|11|12|13|14|15|16|17)\s*months?|less than (?:a |one )?year|year and a half|under (?:a )?year|1\.5\s*years?)\b/i;
export const STINT_NARRATIVE = /\b(?:layoff|laid off|restructur|acquir|shut down|founder (?:exit|left)|team disbanded|relocat|family|health|growth|stretch role|learning curve|domain (?:change|shift)|bond complet|after my bond)\b/i;

export const MOONLIGHT_PROMPT = /\b(?:moonlight(?:ing)?|second job|side gig|side project|freelanc|consulting on the side|dual employ|two (?:jobs|companies)|outside work|other (?:income|engagement))\b/i;
export const MOONLIGHT_FLAT_DENIAL = /\b(?:no,?\s*(?:nothing|never|none|absolutely not)|i don'?t|i never|of course not|nahi karta|kabhi nahi)\b/i;
export const MOONLIGHT_HONEST = /\b(?:open[- ]?source|github|writing|blog|teach|tutor|udemy|youtube|side project|disclosed|with permission|on weekends|outside (?:my )?work hours|no client conflict)\b/i;

export const PF_UAN_PROMPT = /\b(?:uan|pf account|provident fund|epfo|dual (?:pf|uan)|overlapping (?:pf|contribution)|two (?:pf|uan))\b/i;
export const PF_UAN_EVASIVE = /\b(?:not sure|don'?t know|haven'?t checked|let me check|no idea|pata nahi)\b/i;

export const FAMILY_PROBE = /\b(?:relocat\w*|location preference|marriage plans|married|family situation|spouse|elderly parents|home town|are you planning to (?:marry|settle|relocate))/i;
export const FAMILY_FREEZE = /^(?:uh+|um+|hmm+|i\s+(?:don'?t know|umm|uhh)|that'?s personal|prefer not to (?:answer|discuss)|why are you asking|kyun pooch rahe)/i;

export const JOIN_FAST_PROMISE = /\b(?:can join in (?:15|10|7|2)\s*days?|join (?:immediately|right away|next week|within (?:2|two) weeks)|two[- ]?week notice|abhi join|turant join)\b/i;
export const NOTICE_LONG = /\b(?:60\s*days?|90\s*days?|three months?|two months?|teen mahine|do mahine)\b/i;

export const CLAWBACK_PROMPT = /\b(?:clawback|claw[- ]?back|joining bonus.*(?:return|refund|forfeit)|bond.*(?:break|amount)|service agreement (?:terms|duration)|retention bonus.*(?:condition|lock))\b/i;
export const CLAWBACK_BLIND_YES = /^(?:yes|sure|absolutely|no problem|that'?s fine|haan|theek hai|chalega)\b[\s\S]{0,80}$/i;
export const CLAWBACK_INFORMED = /\b(?:what (?:are|is) the (?:terms|duration|amount)|how long|how much|pro[- ]?rate|after how many|prorated)\b/i;

export const RTO_PROMPT = /\b(?:5[- ]?day(?:s)? (?:in office|wfo|from office)|return to office|work from office|wfo policy|hybrid policy|in[- ]?office (?:days|policy)|how many days (?:in|from) office)\b/i;
/* v5.6.0: Hinglish forms ("office nahi aaunga", "ghar se kaam"). */
export const RTO_FLAT_REFUSAL = /\b(?:only (?:wfh|remote)|wfh only|cannot (?:come to office|do wfo|do 5 days)|i don'?t do (?:wfo|office)|prefer (?:fully |only )?remote|no office|office nahi (?:aaunga|aaungi|aaunge|aa sakta)|ghar se (?:hi )?kaam|remote (?:hi )?chahiye|wfo (?:nahi|nahin) (?:chahiye|karna))\b/i;
export const RTO_NEGOTIATED = /\b(?:can do|i can come|fine with|3 days|4 days|hybrid (?:works|is fine)|negotiable|happy to|will adjust|can arrange)\b/i;

export const DOWNGRADE_PROMPT = /\b(?:your current (?:title|designation) is (?:senior|lead|principal|staff|sr\.?)|why (?:would you )?accept (?:a )?(?:lower|junior|smaller) (?:title|role|designation)|title (?:downgrade|mismatch)|leveling (?:gap|difference))\b/i;
export const DOWNGRADE_DEFENSIVE = /\b(?:not (?:a |really )?downgrade|that'?s not|title (?:doesn'?t|don'?t) matter to me|i don'?t care about (?:the |my )?title|titles? are (?:just |only )?labels)\b/i;

export const CERT_PROBE = /\b(?:when did you (?:get|earn|clear) (?:the |your )?(?:aws|gcp|azure|pmp|csm|scrum|cka|ckad)|cert(?:ificate|ification) (?:date|valid|expir|number)|verify (?:your )?cert|cert(?:ificate)? id)\b/i;
export const CERT_VAGUE = /\b(?:long (?:back|time ago)|few years (?:back|ago)|don'?t remember|some time (?:back|ago)|2 or 3 years|approximately|pata nahi|exact date)\b/i;

/* CTC-first opening uses the same pattern as COMP_RAISED_BY_USER. */
export const CTC_FIRST_USER = COMP_RAISED_BY_USER;

/* ── v5.4.0 realism additions ────────────────────────────────────── */
export const OTHER_OFFERS_PROMPT = /\b(?:other (?:offers?|processes?|interviews?)|interviewing elsewhere|active (?:offers?|processes?|conversations?)|in (?:the )?market with|elsewhere in (?:the )?market|kahin aur (?:interview|offer|process))\b/i;
export const OTHER_OFFERS_VAGUE = /\b(?:yeah|yes|a few|couple of|some|two[- ]three|a couple)\b[^.]{0,60}\b(?:places?|companies|processes?|offers?|interviews?)\b/i;
export const OTHER_OFFERS_SPECIFIC = /\b(?:(?:at|with)\s+(?:razorpay|swiggy|zomato|flipkart|amazon|google|microsoft|meta|stripe|paypal|phonepe|cred|zerodha|udaan|meesho|ola|uber|netflix|adobe|oracle|salesforce|sap|atlassian|linkedin|airbnb|booking|expedia|walmart|target|lowes|nvidia|intel|amd|qualcomm|cisco|ibm|deloitte|accenture|tcs|infosys|wipro|cognizant|capgemini|hcl|tech mahindra|mindtree)|offer (?:in hand|by|expected|on)|expecting (?:an? )?offer|by (?:friday|monday|tuesday|wednesday|thursday|next week|end of (?:week|month))|\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(?:final|hr|onsite)\s+(?:round|interview)\s+(?:at|with|next)|round\s*\d\s+(?:at|with))/i;

export const HR_BASE_KEYWORD = /\b(?:base (?:location|city|out of)|primary (?:location|city|reporting)|reporting (?:location|to (?:our )?(?:office|campus)))\b/i;
export const HR_CITY_WITH_ROLE = /\b(?:(?:role|position|job|seat|opening) (?:is )?(?:based )?(?:in|out of|at)|(?:located|based) (?:in|out of|at)|relocate to|move to)\s+(?:hyderabad|hyd|bangalore|bengaluru|blr|chennai|pune|gurgaon|gurugram|noida|delhi(?:\s+ncr)?|mumbai|bombay|kolkata|ahmedabad|kochi|trivandrum|chandigarh)\b/i;
export const RELO_PROBED = /\b(?:relocat|relo|joining bonus for relo|(?:temporary|temp) (?:wfh|remote)|when do i need to be in|moving (?:cost|allowance)|relocation (?:assistance|allowance|package)|housing (?:allowance|support))\b/i;

export const REASON_LEAVING_PROMPT = /\b(?:reason for (?:leaving|change|switch)|why (?:are you )?leaving|why (?:do you want to|are you looking to) (?:leave|move|switch))\b/i;
/* v5.6.0: Hinglish forms ("growth nahi thi", "manager theek nahi"). */
export const BLAME_FRAMING = /\b(?:no growth|wasn'?t (?:supported|valued|heard|recognized|respected)|politics|favoritism|biased|manager (?:didn'?t|wasn'?t|isn'?t)|hr (?:didn'?t|wasn'?t)|toxic culture|no learning|stuck (?:there|in)|nothing to learn|micromanag|not (?:appreciated|valued)|growth nahi(?:n)? (?:thi|tha|hai)|manager (?:theek|sahi|achha) nahi|culture (?:kharab|bad|toxic)|seekhne ko kuch nahi|kuch (?:bhi )?(?:nahi|naya))\b/i;
export const FORWARD_FRAME = /\b(?:next (?:challenge|step|chapter)|want to (?:build|learn|own|drive|move into|grow into)|(?:looking|ready) for (?:a |the )?(?:next|new|bigger)|fresh (?:problem|domain|space)|domain (?:change|shift)|move into|expand my)\b/i;

export const REFERENCE_AFFIRMED_VAGUE = /\b(?:yeah|yes|sure|definitely|haan)[^.]{0,40}\b(?:references?|ex[- ]?managers?|previous managers?|former managers?|references? hai)\b/i;
/* v5.5.0: case-insensitive + accepts lowercase STT proper nouns. */
export const REFERENCE_NAMED = /\b(?:from|at|with)\s+[a-z][\w&.-]{2,}|\bmy\s+(?:manager|lead|director|vp|head|reporting)\s+(?:at|from|was)\s+[\w&.-]{2,}|\bwho\s+was\s+my\s+(?:manager|lead|director|vp|head)|\b(?:mr|ms|mrs|dr)\.?\s+[a-z][\w]+/i;

export const ESOP_HR_MENTION = /\b(?:esop|rsu|stock options?|equity (?:grant|package)|stock grant)\b/i;
export const ESOP_LITERACY = /\b(?:strike (?:price|kya)|cliff (?:period|of|kitna)|vest (?:schedule|over|kitna)|double[- ]?trigger|fmv|409a|liquidation (?:preference)?|exercise window|tax on exercise|exercise period|preferred (?:stock|shares?)|common (?:stock|shares?)|secondary (?:sale|liquidity))\b/i;

export const BELL_CURVE_PROBED = /\b(?:bell curve|stack rank|forced rank|performance calibration|pip\b|performance improvement|attrition (?:rate|in)|regretted attrition|rating (?:distribution|cycle|curve)|calibration (?:cycle|process))\b/i;

export const BUYOUT_MENTIONED = /\bbuy[- ]?out\b/i;
export const BUYOUT_SPLIT_PROBED = /\b(?:reimburs|new (?:company|employer) (?:pay|cover|fund|reimburs)|split (?:the )?buyout|joining bonus (?:offset|cover|adjust)|who (?:pays|covers|funds) the buyout|covered by|offset (?:against|by) (?:joining|signing))\b/i;

/* ── v5.5.0 realism additions ────────────────────────────────────── */
export const FULLY_REMOTE_DEMAND = /\b(?:(?:i'?m |i am |i'?d )?(?:looking for|need|want|require) (?:fully |100\s*%? |permanent(?:ly)? )?remote|never (?:come|coming) (?:to|into) (?:the )?office|fully remote only|100\s*%? remote (?:only|preferred|required)|wfh permanent|can'?t (?:do|come to) office|no office days)\b/i;
export const HYBRID_NEGOTIATION = /\b(?:can do|happy to|fine with|will do)\s*(?:\d+\s*days?|hybrid|some office|few days)|ramp[- ]?up (?:in[- ]?office|period)|first (?:30|60|90)\s*days?\s+in/i;

export const VISA_DEMAND = /\b(?:h[\s-]?1\s?b|h1b|green\s*card|blue\s*card|sponsor (?:my )?(?:visa|relocation)|visa sponsorship|onsite (?:opportunity|within|in)\s*\d+\s*(?:months?|years?)|us (?:onsite|deputation)|uk (?:onsite|deputation)|sg (?:onsite|deputation))\b/i;

export const REVIEW_CYCLE_PROBE = /\b(?:review cycle|appraisal cycle|increment cycle|hike cycle|off[- ]?cycle|next (?:hike|review|appraisal)|promo cycle|promotion cycle|when (?:is|are) the (?:next )?(?:review|appraisal|hike|increment)|how (?:often|frequent) (?:are the )?(?:reviews|appraisals|hikes))\b/i;

export const TAX_STRUCTURE_PROBE = /\b(?:80\s*c|nps(?:\s+(?:employer|contribution))?|flexi (?:basket|component|pay)|meal (?:card|voucher|coupon)|sodexo|lta|leave travel|take[- ]?home|in[- ]?hand|tax (?:optim|saving|efficient)|gratuity calcul|section\s+80)\b/i;

export const PEDIGREE_PRE_APOLOGY = /\b(?:i know my college isn'?t|despite (?:my )?(?:college|tier|background)|not from (?:iit|nit|iiit|bits|iim)|tier[- ]?[23](?:\s+college)?|though i'?m not from|even though my college|coming from a tier[- ]?[23])\b/i;

/* ── Resume cross-checks ─────────────────────────────────────────── */
/* v5.6.0: case-insensitive + accepts lowercase STT proper nouns. */
export const TRANSCRIPT_EMPLOYER_RE = /\b(?:worked\s+at|was\s+at|joined|employed\s+at|currently\s+(?:at|with)|previously\s+at|my\s+(?:current|previous|last|ex)\s+(?:company|employer)\s+(?:is|was)|company\s+called)\s+([a-z][\w&.-]*(?:\s+[a-z][\w&.-]*){0,3})/gi;
export const SENIOR_TITLE_RE = /\b(?:senior|sr\.?|lead|staff|principal|architect|head\s+of|director|vp|vice\s+president)\b/i;
export const CAREER_BREAK_PROMPT = /\b(career\s+break|sabbatical|time\s+off|not\s+working|between\s+(?:jobs|roles)|year\s+off)\b/i;

/* Stoplists for the v5.6.0 employer-mention call-site filter. The
   lowercase TRANSCRIPT_EMPLOYER_RE captures common-noun phrases
   ("a fintech", "is taking"); these lists drop captures whose first
   token is an article or whose every token is a generic descriptor. */
export const EMPLOYER_STOP_TOKENS: ReadonlySet<string> = new Set([
  "a", "an", "the", "my", "our", "their", "his", "her",
  "this", "that", "some", "another", "one", "two", "three",
]);
export const EMPLOYER_GENERIC_TOKENS: ReadonlySet<string> = new Set([
  "fintech", "saas", "startup", "company", "firm", "mnc", "gcc",
  "unicorn", "product", "services", "agency", "consultancy",
  "bank", "client", "vendor", "team", "org", "shop", "place",
  "early", "stage", "small", "mid", "large", "global", "fintech.",
]);

export function normalizeEmployerName(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|corporation|corp|technologies|technology|tech|labs|solutions|systems|india|llp)\b\.?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function tokensOverlap(a: string, b: string): boolean {
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

export interface ResumeSummary {
  employers: string[];
  titles: string[];
  yoeMonths: number | null;
  gapsMonths: number[];
}

export function summarizeResume(resume: ResumeForAnalyzer | null | undefined): ResumeSummary {
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

export const DIMENSIONS = ["logistics", "comp", "stability", "compliance", "commitment", "benefits", "motivation"] as const;
export type Dimension = typeof DIMENSIONS[number];
export const DIMENSION_PATTERNS: Record<Dimension, RegExp> = {
  logistics: NOTICE_PERIOD,
  comp: ASKED_ABOUT_SALARY,
  stability: /\b(why (?:are you )?leaving|reason for (?:change|leaving|switch)|switched? (?:jobs|companies)|tenure|gap)\b/i,
  compliance: BGV_PROMPT,
  commitment: COUNTER_OFFER_PROMPT,
  benefits: BENEFITS_PROMPT,
  motivation: WHY_COMPANY_PROMPT,
};

/* LLM rescore rubrics for weak-regex flags. Static — kept here so the
   rubric text lives with the regex it backs up. */
export const RESCORE_RUBRICS: Record<string, string> = {
  generic_why_company: "Did the candidate name a verifiable specific (launch name, leader name, blog title, recent move, product, domain)? If yes, the flag is FALSE.",
  counter_offer_dodge: "Did the candidate commit OR did they only defer? If they deferred WITH a stated decision criterion (e.g. 'I'll commit once the role scope is locked'), the flag is FALSE. Pure 'I'll see' / 'we'll see' / 'dekhta hu' is TRUE.",
  generic_self_intro: "Does the intro have a narrative arc (years of experience + role + an outcome / project)? If yes, the flag is FALSE. Purely token-listing (skills, tech stack) with no story is TRUE.",
  reason_for_leaving_blame_framing: "Did the candidate frame the reason for leaving primarily through a FORWARD pull (next challenge, new domain, scope expansion) even if some backward facts (politics, no growth) are mentioned? If a forward frame is present alongside, the flag is FALSE. Pure backward blame with no forward pull is TRUE.",
  multi_offer_undisclosed: "Did the candidate name a specific company OR a specific timeline OR a specific stage for any other offer? Even one specific anchor (company name, expected-by date, round-stage) means the flag is FALSE. Pure 'a few places' / 'some companies' / 'yeah I'm interviewing' with zero specifics is TRUE.",
  reference_list_vague: "Did the candidate name a referee (first name, role, or company), OR specifically defer ('current manager doesn't know yet, will share post-offer')? Either case the flag is FALSE. Pure 'yeah I have references' / 'a couple of ex-managers' with no proper noun and no deferral context is TRUE.",
  floor_collapse: "Did the candidate hold ANY floor with rationale (a number, a 'no less than X', anchored on current/competing/market)? If a floor is stated — even tentatively — the flag is FALSE. Pure 'whatever you can offer' / 'I'm flexible' / 'aap decide karo' with zero floor and zero rationale is TRUE.",
  clawback_blind_accept: "Did the candidate ask ANY clarifying question about the clawback (duration, amount, pro-rate, what triggers it, refund schedule), even after an initial 'yes that's fine'? If a clarifier was asked in the same turn or the next, the flag is FALSE. Pure unconditional yes with no follow-up question is TRUE.",
  moonlighting_flat_denial: "Did the candidate disclose ANY scoped outside activity (open-source, blog, teaching, GitHub, consulting on weekends with permission) OR specifically caveat the denial ('nothing that creates a client conflict')? Either case the flag is FALSE. Pure 'no, never, of course not' with no scope is TRUE.",
  hybrid_expectation_mismatch: "Did the candidate frame remote as a preference with negotiation room ('I'd prefer remote but can do N days hybrid', 'open to hybrid if the team is mostly remote') vs an absolutist demand ('fully remote only, never in office')? Preference-with-room is FALSE. Absolutist no-office stance is TRUE.",
  tax_structure_naive: "Did the candidate engage ANY tax-structure component (80C, NPS, LTA, flexi-basket, meal cards, take-home, gratuity), even briefly? Any engagement = FALSE. Comp negotiation that stayed strictly on gross/fixed/variable with zero tax-structure mention at ₹25L+ is TRUE.",
};

export const CLUSTERS: ReadonlyArray<{ label: string; theme: string; members: ReadonlyArray<string> }> = [
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
