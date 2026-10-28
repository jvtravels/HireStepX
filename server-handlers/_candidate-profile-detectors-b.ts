import { type CollegeTier } from "./_candidate-profile-types";
import { COLLEGE_TIER_1_PATTERNS, COLLEGE_TIER_2_PATTERNS, COLLEGE_TIER_3_PATTERNS } from "./_candidate-profile-detectors-a";

/* ─── Wave-3 (2026-05-14j) — 25 new flags ──────────────────────────── */

/* Wave-3A — titlePrecisionAsk: candidate probes exact designation /
 * grade-step. Indian resume-readable-title weight is enormous. */
export const TITLE_PRECISION_PATTERNS: RegExp[] = [
  /\b(?:exact|specific|precise|actual)\s+(?:title|designation|grade|level|band)\b/i,
  /\b(?:what'?s?|tell\s+me)\s+(?:the\s+)?(?:exact\s+)?(?:designation|title|grade[-\s]?step)\b/i,
  /\b(?:sde[-\s]?\d|swe[-\s]?\d|l[-\s]?\d{1,2}|m[-\s]?\d|ic[-\s]?\d|p[-\s]?\d{1,2})\b\s+(?:or\s+|vs\s+|versus\s+)?(?:sde[-\s]?\d|swe[-\s]?\d|l[-\s]?\d{1,2}|m[-\s]?\d|senior|staff|principal)/i,
  /\b(?:senior\s+sde|principal\s+engineer|staff\s+engineer|associate\s+director)\b\s+(?:level|grade|band|step|or\s+)/i,
  /\b(?:resume[-\s]?readable|on\s+(?:my\s+)?resume|how\s+(?:will|does)\s+it\s+(?:read|appear)\s+on\s+(?:my\s+)?resume)\b/i,
];
export function detectTitlePrecisionAsk(t: string): boolean {
  return TITLE_PRECISION_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — currentCtcRefusal: candidate declines to share current
 * package. Recruiter must RESPECT and pivot to band-anchored pricing. */
export const CTC_REFUSAL_PATTERNS: RegExp[] = [
  /\b(?:prefer\s+not\s+to\s+(?:share|disclose|say)|rather\s+not\s+(?:share|say|disclose))\b.{0,40}\b(?:ctc|salary|package|comp(?:ensation)?|current\s+pay|number)\b/i,
  /\b(?:not\s+comfortable|uncomfortable)\s+(?:sharing|disclosing|revealing)\s+(?:my\s+)?(?:current\s+)?(?:ctc|salary|package|comp(?:ensation)?|number)\b/i,
  /\b(?:i\s+won'?t|i\s+will\s+not|i'?d\s+rather\s+not|won'?t\s+be)\s+(?:share|sharing|disclose|disclosing|tell|tell\s+you|reveal)\s+(?:my\s+)?(?:current\s+)?(?:ctc|salary|package|number)\b/i,
  /\b(?:current\s+ctc|current\s+(?:salary|package))\s+(?:is\s+)?(?:confidential|private|not\s+(?:something|relevant))/i,
  /\b(?:decline\s+to\s+(?:share|disclose)|keep\s+(?:that|it)\s+(?:confidential|private))\b.{0,40}\b(?:ctc|salary|package|comp)\b/i,
];
export function detectCurrentCtcRefusal(t: string): boolean {
  return CTC_REFUSAL_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — pregnancyDisclosed: candidate discloses pregnancy / due
 * date / imminent maternity leave. SENSITIVE — must not anchor down. */
export const PREGNANCY_PATTERNS: RegExp[] = [
  /\b(?:i'?m\s+)?(?:pregnant|expecting|with\s+child|carrying)\b/i,
  /\b(?:due\s+date|due\s+in\s+\w+|expecting\s+(?:a\s+)?(?:baby|child)\s+in\s+\w+)\b/i,
  /\b(?:maternity\s+leave\s+(?:is\s+)?(?:imminent|coming\s+up|soon|in\s+(?:a\s+)?(?:few\s+)?(?:weeks?|months?))|going\s+on\s+maternity\s+(?:leave|soon))\b/i,
  /\b(?:in\s+(?:my\s+)?(?:second|third|first|1st|2nd|3rd)\s+trimester|trimester\s+of\s+pregnancy)\b/i,
  /\b(?:will\s+(?:be\s+)?need(?:ing)?\s+maternity\s+leave|need(?:ing)?\s+(?:to\s+take\s+)?maternity)\b/i,
];
export function detectPregnancyDisclosed(t: string): boolean {
  return PREGNANCY_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — boomerangRehire: candidate is a returning ex-employee. */
export const BOOMERANG_PATTERNS: RegExp[] = [
  /\b(?:i\s+(?:worked|was)\s+(?:here|at\s+(?:this|the)\s+co(?:mpany)?)\s+(?:before|previously|earlier))\b/i,
  /\b(?:boomerang\s+(?:hire|rehire|employee|candidate)|boomeranging\s+back)\b/i,
  /\b(?:rejoining|coming\s+back|returning)\s+(?:after\s+\d+\s+(?:years?|months?)|to\s+(?:the\s+)?(?:co(?:mpany)?|team)|the\s+(?:company|firm))\b/i,
  /\b(?:ex[-\s]?(?:employee|colleague)|alumni|former\s+(?:employee|teammate))\s+(?:of\s+(?:this|the)\s+co(?:mpany)?|returning|coming\s+back)\b/i,
  /\b(?:rehire|re[-\s]hire|re[-\s]?joined?)\b/i,
];
export function detectBoomerangRehire(t: string): boolean {
  return BOOMERANG_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — referralReceived: candidate was referred internally. */
export const REFERRAL_PATTERNS: RegExp[] = [
  /\b(?:was|got|received|have)\s+(?:an?\s+)?(?:internal\s+|employee\s+)?referr(?:al|ed)\b/i,
  /\b(?:employee\s+referral|referral\s+bonus|referred\s+(?:me|by\s+\w+))\b/i,
  /\b\w+\s+referred\s+me\s+(?:to|for|here)\b/i,
  /\b(?:through\s+(?:an?\s+)?(?:employee\s+)?referral|via\s+(?:an?\s+)?referral)\b/i,
  /\b(?:my\s+(?:friend|colleague|ex[-\s]?colleague)\s+\w+\s+(?:works\s+here|is\s+(?:at|on)\s+the\s+team))\b/i,
];
export function detectReferralReceived(t: string): boolean {
  return REFERRAL_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — hometownReturnPreference: candidate wants to move to
 * hometown / tier-2 city. Distinct from spouseJobConstraint. */
export const HOMETOWN_PATTERNS: RegExp[] = [
  /\b(?:back\s+to\s+(?:my\s+)?(?:hometown|native\s+place|native\s+city|roots)|return(?:ing)?\s+to\s+(?:my\s+)?(?:hometown|native))\b/i,
  /\b(?:closer\s+to\s+(?:my\s+)?(?:family|parents|home)|move\s+closer\s+to\s+(?:family|home|parents))\b/i,
  /\b(?:move|relocate|moving|relocating)\s+(?:back\s+)?(?:to\s+)?(?:indore|coimbatore|bhubaneswar|jaipur|nagpur|kochi|trivandrum|kolkata|ahmedabad|lucknow|chandigarh|patna|vadodara|nashik|surat|visakhapatnam|vizag|guwahati|raipur|ranchi|dehradun|mysore|mangalore|trichy|madurai|vijayawada|tier[-\s]?2\s+city|tier[-\s]?ii\s+city)\b/i,
  /\b(?:my\s+(?:home[-\s]?town|native)\s+is\s+\w+|hometown\s+(?:posting|role|opportunity))\b/i,
  /\b(?:want\s+to\s+(?:settle|move)\s+(?:back\s+)?(?:in\s+|to\s+)?(?:my\s+)?(?:hometown|native|tier[-\s]?2))\b/i,
];
export function detectHometownReturnPreference(t: string): boolean {
  return HOMETOWN_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — pwdDisability: candidate discloses disability /
 * accessibility need / PWD reservation. SENSITIVE. */
export const PWD_PATTERNS: RegExp[] = [
  /\b(?:pwd|person\s+with\s+disability|persons?\s+with\s+disabilities|differently[-\s]?abled)\b/i,
  /\b(?:wheelchair|wheel[-\s]?chair)\s+(?:accessible|access|ramp|user)?\b/i,
  /\b(?:hearing|visual|vision|mobility|speech)\s+(?:impair(?:ment|ed)|disability|loss|challenge)\b/i,
  /\b(?:accessibility\s+(?:need|requirement|accommodation)|reasonable\s+accommodation|workplace\s+accommodation)\b/i,
  /\b(?:i\s+(?:have|am)\s+(?:a\s+)?(?:disability|disabled|deaf|blind|hard\s+of\s+hearing))\b/i,
  /\b(?:sign\s+language\s+interpreter|screen\s+reader|braille|adaptive\s+(?:tech|equipment))\b/i,
];
export function detectPwdDisability(t: string): boolean {
  return PWD_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — gratuityVestingNear: candidate close to 5-yr gratuity. */
export const GRATUITY_VESTING_PATTERNS: RegExp[] = [
  /\b(?:gratuity)\s+(?:vest(?:ing|s)?|eligibility|cliff|completion|kicks?\s+in)\b/i,
  /\b(?:lose\s+(?:my\s+)?gratuity|forfeit\s+gratuity|gratuity\s+(?:loss|forfeit))\b/i,
  /\b(?:almost|nearly|close\s+to|just\s+short\s+of|few\s+months\s+(?:to|from|away\s+from))\s+(?:5\s+years?|five\s+years?|gratuity)\b/i,
  /\b(?:4\.\d|four\s+point\s+\w+)\s+years?\b.{0,40}\b(?:gratuity|tenure|completion|current)/i,
  /\b(?:gratuity\s+(?:gap|shortfall|payout)|cover(?:ing)?\s+(?:my\s+|the\s+)?gratuity)\b/i,
];
export function detectGratuityVestingNear(t: string): boolean {
  return GRATUITY_VESTING_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — acquisitionContextAsk: candidate asks about OUR M&A. */
export const ACQUISITION_CONTEXT_PATTERNS: RegExp[] = [
  /\b(?:are\s+you|is\s+(?:the\s+)?(?:co(?:mpany)?|firm))\s+(?:being\s+)?(?:acquired|getting\s+acquired|in\s+(?:an?\s+)?m&a)\b/i,
  /\b(?:m\s*&\s*a|merger|acquisition)\s+(?:rumour|rumor|news|talks?|deal|context|impact|effect)\b/i,
  /\b(?:post[-\s]?acquisition|post[-\s]?merger|after\s+(?:the\s+)?acquisition)\s+(?:retention|comp|package|stock|options?)\b/i,
  /\b(?:heard\s+about\s+(?:the\s+|your\s+)?(?:m&a|merger|acquisition|deal)|rumours?\s+about\s+(?:m&a|merger|acquisition))\b/i,
  /\b(?:retention\s+(?:bonus|pool|grant)\s+post[-\s]?(?:acquisition|merger))\b/i,
];
export function detectAcquisitionContextAsk(t: string): boolean {
  return ACQUISITION_CONTEXT_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — lgbtqDisclosure: candidate discloses LGBTQ+ identity or
 * asks about partner benefits. SENSITIVE. */
export const LGBTQ_PATTERNS: RegExp[] = [
  /\b(?:lgbtq\+?|lgbt|lgbtqia\+?|queer|gay|lesbian|bisexual|transgender|non[-\s]?binary|gender[-\s]?fluid)\b/i,
  /\b(?:same[-\s]?sex\s+(?:partner|spouse|marriage)|same\s+gender\s+partner)\b/i,
  /\b(?:partner\s+(?:insurance|benefits?|cover|medical))\b.{0,80}\b(?:same[-\s]?sex|gay|lesbian|lgbt|domestic\s+partner)/i,
  /\b(?:domestic\s+partner(?:ship)?|civil\s+(?:union|partnership))\s+(?:benefits?|cover|insurance)?\b/i,
  /\b(?:my\s+(?:partner|spouse)\s+is\s+(?:also\s+)?(?:a\s+)?(?:man|woman|male|female)\b.{0,40}\b(?:insurance|cover|benefit))/i,
];
export function detectLgbtqDisclosure(t: string): boolean {
  return LGBTQ_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — chronicIllnessDisclosed: chronic illness / ongoing
 * treatment / cancer-survivor / autoimmune. SENSITIVE. */
export const CHRONIC_ILLNESS_PATTERNS: RegExp[] = [
  /\b(?:chronic\s+(?:illness|condition|disease|pain)|ongoing\s+(?:treatment|medical\s+condition))\b/i,
  /\b(?:dialysis|chemo(?:therapy)?|radiation|immunotherapy)\b/i,
  /\b(?:cancer\s+survivor|cancer\s+patient|in\s+remission|undergoing\s+(?:treatment|chemo|therapy))\b/i,
  /\b(?:autoimmune|lupus|crohn'?s|colitis|rheumatoid\s+arthritis|multiple\s+sclerosis|ms\s+diagnosis)\b/i,
  /\b(?:diabetes\s+type\s+1|type\s+1\s+diabetes|insulin[-\s]?dependent|kidney\s+(?:disease|failure)|liver\s+(?:disease|cirrhosis))\b/i,
  /\b(?:i\s+have\s+(?:a\s+)?(?:chronic|long[-\s]?term|ongoing)\s+(?:illness|condition|disease))\b/i,
];
export function detectChronicIllnessDisclosed(t: string): boolean {
  return CHRONIC_ILLNESS_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — noticeBuyoutAsk: candidate asks about notice buyout
 * money. Distinct from noticePeriodDays. */
export const NOTICE_BUYOUT_PATTERNS: RegExp[] = [
  /\b(?:notice\s+(?:period\s+)?buy[-\s]?out|buy[-\s]?out\s+(?:my\s+)?notice|buy\s+out\s+(?:my\s+)?notice)\b/i,
  /\b(?:can\s+you\s+(?:cover|buy[-\s]?out|pay)\s+(?:my\s+)?notice|notice[-\s]?period\s+shortfall|cover\s+the\s+(?:notice|shortfall))\b/i,
  /\b(?:notice\s+(?:buy[-\s]?out\s+)?amount|buyout\s+(?:cap|amount|fee))\b/i,
  /\b\d{1,3}[-\s]?day\s+notice\b.{0,40}\b(?:buy[-\s]?out|cover|pay\s+(?:off|out)|shortfall)/i,
  /\b(?:reimburse|recover|recoup)\s+(?:the\s+)?notice[-\s]?(?:period\s+)?(?:buyout|recovery)/i,
];
export function detectNoticeBuyoutAsk(t: string): boolean {
  return NOTICE_BUYOUT_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — bfsiClawbackContext: BFSI bonus clawback if leaving
 * before March / under 1 year. */
export const BFSI_CLAWBACK_PATTERNS: RegExp[] = [
  /\b(?:bonus|joining\s+bonus|sign[-\s]?on|deferred\s+(?:comp|bonus))\s+clawback\b/i,
  /\b(?:clawback\s+(?:if|when|clause|provision)|locked\s+(?:in\s+)?(?:till|until)\s+(?:march|q[14]|year[-\s]?end))\b/i,
  /\b(?:bonus\s+(?:locked|payable|paid\s+out)\s+(?:in|by|till|after)\s+(?:march|april|q[14]))\b/i,
  /\b(?:variable\s+pay\s+(?:locked|deferred)|deferred\s+comp\s+(?:clawback|vesting))\b/i,
  /\b(?:if\s+i\s+leave\s+(?:before|under|within)\s+(?:march|\d+\s+(?:year|month)s?))\b.{0,80}\b(?:bonus|clawback|forfeit|lose)/i,
];
export function detectBfsiClawbackContext(t: string): boolean {
  return BFSI_CLAWBACK_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — bigFourGradeStep: Deloitte/EY/PwC/KPMG grade reference. */
export const BIG_FOUR_GRADE_PATTERNS: RegExp[] = [
  /\b(?:deloitte|ernst\s*&?\s*young|\bey\b|pwc|price\s*waterhouse|kpmg|big[-\s]?(?:4|four))\b/i,
  /\b(?:consultant\s+to\s+senior\s+consultant|sc\s+to\s+manager|manager\s+to\s+senior\s+manager|sm\s+to\s+director)\b/i,
  /\b(?:s[12]\s+to\s+m[12]|c[12]\s+to\s+sc|grade[-\s]?step|grade\s+jump|lateral\s+at\s+(?:m1|m2|sm|sc|consultant))\b/i,
  /\b(?:senior\s+consultant|associate\s+manager|managing\s+director)\b.{0,80}\b(?:big[-\s]?4|deloitte|ey|pwc|kpmg|grade\s+step)/i,
  /\b(?:m1|m2|sm|smd|amd|svp|d\b)\s+(?:level|grade|step|band)\b.{0,40}\b(?:consulting|advisory|big[-\s]?4)/i,
];
export function detectBigFourGradeStep(t: string): boolean {
  return BIG_FOUR_GRADE_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — securityClearanceNeeded: defence / govt / clearance ask. */
export const SECURITY_CLEARANCE_PATTERNS: RegExp[] = [
  /\b(?:security\s+clearance|clearance\s+(?:status|required|needed|process)|need\s+(?:a\s+)?clearance)\b/i,
  /\b(?:drdo|isro|baba\s+atomic|bhel|bel|hal\s+aero|defence\s+(?:sector|project|contractor)|defense\s+(?:sector|project|contractor))\b/i,
  /\b(?:dod|department\s+of\s+defense|secret\s+clearance|top[-\s]?secret|ts[-\s]?sci|polygraph)\b/i,
  /\b(?:government\s+(?:project|contract|clearance)|govt\s+project|classified\s+(?:project|work))\b/i,
  /\b(?:police\s+verification|character\s+verification\s+(?:for|by))\b.{0,80}\b(?:clearance|defence|defense|gov)/i,
];
export function detectSecurityClearanceNeeded(t: string): boolean {
  return SECURITY_CLEARANCE_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — missionDrivenComp: willingness to take below-market for
 * mission-aligned roles (climate, healthtech, social, NGO). */
export const MISSION_DRIVEN_PATTERNS: RegExp[] = [
  /\b(?:mission[-\s]?(?:driven|aligned|first)|impact[-\s]?(?:driven|first|focused)|purpose[-\s]?(?:driven|aligned))\b/i,
  /\b(?:climate|cleantech|clean[-\s]?tech|sustainability|renewable|esg)\b.{0,80}\b(?:below[-\s]?market|lower\s+(?:pay|comp)|pay\s+cut|less\s+(?:money|comp))/i,
  /\b(?:healthtech|health[-\s]?tech|public\s+(?:sector|health)|govtech|gov[-\s]?tech|social\s+(?:impact|sector)|ngo|non[-\s]?profit)\b.{0,80}\b(?:open\s+to|willing\s+to|fine\s+with|happy\s+with)/i,
  /\b(?:open\s+to|willing\s+to|fine\s+(?:with|taking))\s+(?:a\s+)?(?:below[-\s]?market|pay\s+cut|lower\s+(?:pay|comp|ctc|salary))\s+(?:for\s+(?:the\s+)?(?:mission|impact|cause))/i,
  /\b(?:work\s+(?:for\s+)?(?:a\s+)?cause|cause[-\s]?driven|do\s+meaningful\s+work)\b/i,
];
export function detectMissionDrivenComp(t: string): boolean {
  return MISSION_DRIVEN_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — edtechReputationCheck: edtech stability anxiety. */
export const EDTECH_REPUTATION_PATTERNS: RegExp[] = [
  /\b(?:byju'?s|unacademy|whitehat\s+jr|vedantu|upgrad|toppr|simplilearn)\b.{0,120}\b(?:debacle|layoff|firing|stability|debacle|collapse|shutdown|crisis)/i,
  /\b(?:edtech\s+(?:stability|crisis|debacle|layoff|risk|reputation|future|winter))\b/i,
  /\b(?:are\s+you\s+(?:laying\s+off|firing|cutting))\b.{0,80}\b(?:like\s+(?:byju'?s|unacademy)|edtech)/i,
  /\b(?:worried|concerned|anxious)\s+(?:about\s+)?(?:after|because\s+of)\s+(?:the\s+)?(?:byju'?s|unacademy)\b/i,
  /\b(?:mass\s+(?:firing|layoff|exits?)|company\s+(?:winding\s+down|shutting\s+down|going\s+under))\b.{0,80}\b(?:edtech|byju|unacademy)/i,
];
export function detectEdtechReputationCheck(t: string): boolean {
  return EDTECH_REPUTATION_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — acquiHireContext: candidate's CURRENT company is being
 * acquired / wound down. Distinct from acquisitionContextAsk. */
export const ACQUI_HIRE_PATTERNS: RegExp[] = [
  /\b(?:my\s+)?(?:current\s+)?(?:company|employer|startup|firm)\s+(?:is\s+)?(?:being\s+)?(?:acquired|getting\s+acquired|in\s+talks\s+to\s+(?:be\s+)?(?:acquired|sold))\b/i,
  /\b(?:acqui[-\s]?hire|acquihire|talent\s+acquisition\s+deal)\b/i,
  /\b(?:my\s+)?(?:current\s+)?(?:company|startup|employer)\s+(?:is\s+)?(?:winding\s+down|shutting\s+down|going\s+under|in\s+wind[-\s]?down)\b/i,
  /\b(?:we'?re\s+being\s+(?:acquired|bought|absorbed)|company\s+(?:got|just\s+got)\s+acquired)\b/i,
  /\b(?:moving\s+(?:to|because)\s+(?:of\s+)?(?:the\s+)?(?:acquisition|wind[-\s]?down|shutdown))\b/i,
];
export function detectAcquiHireContext(t: string): boolean {
  return ACQUI_HIRE_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — cabinParkingAsk: traditional Indian seniority perks. */
export const CABIN_PARKING_PATTERNS: RegExp[] = [
  /\b(?:cabin|private\s+(?:office|cabin|workspace)|corner\s+(?:office|cabin))\b/i,
  /\b(?:dedicated\s+(?:parking|workstation|seat|desk)|reserved\s+parking|parking\s+(?:slot|spot|space|allotment))\b/i,
  /\b(?:company\s+car|car\s+lease|fuel\s+reimbursement|fuel\s+allowance|driver\s+(?:allowance|reimbursement|salary))\b/i,
  /\b(?:executive\s+(?:cabin|parking|perks?)|corner\s+seat|window\s+seat\s+(?:allotment|preference))\b/i,
  /\b(?:do\s+(?:i|we)\s+get\s+(?:a\s+)?(?:cabin|car|parking|driver))\b/i,
];
export function detectCabinParkingAsk(t: string): boolean {
  return CABIN_PARKING_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — spanOfControlAsk: team size / org / reporting probe. */
export const SPAN_OF_CONTROL_PATTERNS: RegExp[] = [
  /\b(?:span\s+of\s+control|how\s+(?:big|large)\s+(?:is\s+)?(?:the\s+)?team|team\s+size\s+(?:i'?ll|to|that\s+i))\b/i,
  /\b(?:how\s+many\s+(?:reports?|directs?|people)\s+(?:will|do)\s+i\s+(?:have|manage))\b/i,
  /\b(?:number\s+of\s+(?:direct\s+)?reports?|direct\s+reports?\s+count|reporting\s+(?:to|lines?|structure))\b/i,
  /\b(?:org(?:anization)?\s+(?:chart|structure|hierarchy)|reporting\s+(?:hierarchy|structure))\b/i,
  /\b(?:who\s+(?:reports\s+to\s+me|will\s+report\s+to\s+me|are\s+my\s+(?:directs?|reports?)))\b/i,
];
export function detectSpanOfControlAsk(t: string): boolean {
  return SPAN_OF_CONTROL_PATTERNS.some((p) => p.test(t));
}

/* Wave-3C — preResignationStealth: candidate hasn't told current
 * employer; stealth job search. */
export const PRE_RESIGNATION_STEALTH_PATTERNS: RegExp[] = [
  /\b(?:they\s+don'?t\s+know|hasn'?t\s+(?:told|informed)\s+(?:my\s+)?(?:manager|employer|company))\b.{0,40}\b(?:interview|job|search|looking)/i,
  /\b(?:stealth\s+(?:job\s+)?search|stealth\s+mode|on\s+the\s+down[-\s]?low|quietly\s+(?:interview|looking))\b/i,
  /\b(?:keep(?:ing)?\s+(?:this|it|the\s+search)\s+confidential|confidential(?:ity)?\s+(?:on\s+|of\s+)?(?:my\s+)?(?:search|interview))\b/i,
  /\b(?:current\s+(?:co|company|employer|manager)\s+doesn'?t\s+know|haven'?t\s+(?:told|informed|resigned|put\s+in\s+papers))\b/i,
  /\b(?:please\s+(?:don'?t|do\s+not)\s+(?:contact|inform|tell)\s+(?:my\s+)?(?:current|present)\s+(?:co|company|employer))\b/i,
];
export function detectPreResignationStealth(t: string): boolean {
  return PRE_RESIGNATION_STEALTH_PATTERNS.some((p) => p.test(t));
}

/* Wave-3C — reverseAnchorAsk: candidate asks recruiter to anchor
 * first. Routes to coaching: don't be the first to anchor. */
export const REVERSE_ANCHOR_PATTERNS: RegExp[] = [
  /\b(?:what'?s?\s+your\s+(?:budget|range|band)|what\s+range\s+(?:did\s+you|do\s+you|are\s+you))\s+(?:have\s+)?(?:in\s+mind|thinking|budgeted)?\b/i,
  /\b(?:you\s+tell\s+me|what\s+(?:would\s+you|do\s+you)\s+offer|you\s+(?:make\s+|put\s+)?(?:the\s+)?(?:first\s+)?offer)\b/i,
  /\b(?:what'?s?\s+the\s+(?:budget|allocation|number)\s+for\s+(?:this|the)\s+role)\b/i,
  /\b(?:i'?d\s+(?:rather|prefer)\s+(?:hear|know)\s+(?:your\s+)?(?:offer|range|number)\s+first|hear\s+(?:your|the)\s+(?:offer|number)\s+first)\b/i,
  /\b(?:share\s+(?:the\s+)?range\s+first|range\s+first\s+please|what\s+(?:can|do)\s+you\s+(?:offer|pay))\b/i,
];
export function detectReverseAnchorAsk(t: string): boolean {
  return REVERSE_ANCHOR_PATTERNS.some((p) => p.test(t));
}

/* Wave-3C — dietaryReligiousNeed: dietary / religious accommodation. */
export const DIETARY_RELIGIOUS_PATTERNS: RegExp[] = [
  /\b(?:jain\s+(?:food|diet|meals?)|halal|kosher|vegetarian\s+(?:cafeteria|canteen|meals?|option))\b/i,
  /\b(?:friday\s+prayers?|jumma|namaz|ramzan|ramadan)\b.{0,80}\b(?:timing|break|leave|accommodation|flexibility)?/i,
  /\b(?:sabbath|shabbat|saturday\s+off\s+for\s+(?:religious|sabbath))\b/i,
  /\b(?:no\s+(?:onion|garlic|beef|pork)|onion[-\s]?garlic[-\s]?free|pure\s+veg)\b/i,
  /\b(?:religious\s+(?:accommodation|observance|holiday)|prayer\s+(?:room|break|time))\b/i,
];
export function detectDietaryReligiousNeed(t: string): boolean {
  return DIETARY_RELIGIOUS_PATTERNS.some((p) => p.test(t));
}

/* Wave-3C — oldEmployerDocsIssue: missing relieving / experience /
 * payslips. Affects BGV. */
export const OLD_EMPLOYER_DOCS_PATTERNS: RegExp[] = [
  /\b(?:relieving\s+letter|experience\s+letter|exp\s+letter)\b.{0,80}\b(?:not\s+(?:given|received|provided)|haven'?t\s+(?:given|received|got)|missing|lost|trouble|issue|problem|delay)/i,
  /\b(?:ex[-\s]?employer|previous\s+(?:employer|company))\s+(?:hasn'?t|has\s+not|won'?t|will\s+not|didn'?t|did\s+not)\s+(?:give(?:n)?|provid(?:e|ed)|issue(?:d)?|hand\s+over)\b/i,
  /\b(?:lost\s+(?:my\s+)?(?:payslips?|salary\s+slips?|offer\s+letter|relieving|experience))\b/i,
  /\b(?:company\s+(?:shut\s+down|wound\s+down|closed)|previous\s+(?:co|employer)\s+(?:shut|closed))\b.{0,80}\b(?:no\s+(?:docs?|relieving|payslips?|letter)|can'?t\s+(?:get|retrieve|provide))/i,
  /\b(?:affidavit|self[-\s]?declaration)\b.{0,40}\b(?:relieving|experience|prior\s+employer|bgv)/i,
];
export function detectOldEmployerDocsIssue(t: string): boolean {
  return OLD_EMPLOYER_DOCS_PATTERNS.some((p) => p.test(t));
}

/* Wave-3C — equityRefreshCadenceAsk: refresh / top-up / promotion
 * grant cadence. Distinct from initial-grant mechanics. */
export const EQUITY_REFRESH_PATTERNS: RegExp[] = [
  /\b(?:equity\s+refresh|refresh\s+(?:grant|cadence|cycle|policy)|annual\s+refresh)\b/i,
  /\b(?:top[-\s]?up\s+grant|top[-\s]?up\s+(?:rsu|esop|equity)|refresher\s+grant)\b/i,
  /\b(?:promotion\s+(?:top[-\s]?up|grant|refresh|equity)|promo\s+(?:grant|refresh))\b/i,
  /\b(?:next\s+(?:rsu|esop|equity|stock)\s+grant|when\s+(?:do|will)\s+i\s+(?:get|receive)\s+(?:my\s+)?(?:next\s+)?(?:rsu|grant|refresh))\b/i,
  /\b(?:refresh\s+policy|refresh\s+(?:every|each)\s+(?:year|cycle)|annual\s+(?:rsu|equity)\s+(?:cycle|grant))\b/i,
];
export function detectEquityRefreshCadenceAsk(t: string): boolean {
  return EQUITY_REFRESH_PATTERNS.some((p) => p.test(t));
}

/* Wave-3D (PDF #17 follow-up, 2026-05-15) — equity-instrument depth.
 * Four distinct asks: vesting schedule, cliff period, exercise terms,
 * buyback / liquidity. Each routes a different recruiter voice. */
export const EQUITY_VESTING_SCHEDULE_PATTERNS: RegExp[] = [
  /\b(vesting\s+schedule|vest(?:ing)?\s+cadence|how\s+(?:does\s+)?vesting\s+work|vesting\s+period)\b/i,
];
export function detectEquityVestingScheduleAsk(t: string): boolean {
  return EQUITY_VESTING_SCHEDULE_PATTERNS.some((p) => p.test(t));
}

export const EQUITY_CLIFF_PERIOD_PATTERNS: RegExp[] = [
  /\b(cliff\s+period|1[-\s]?year\s+cliff|vesting\s+cliff)\b/i,
];
export function detectEquityCliffPeriodAsk(t: string): boolean {
  return EQUITY_CLIFF_PERIOD_PATTERNS.some((p) => p.test(t));
}

export const EQUITY_EXERCISE_TERMS_PATTERNS: RegExp[] = [
  /\b(exercise\s+terms|exercise\s+window|exercise\s+price|exercise\s+period|strike\s+price)\b/i,
];
export function detectEquityExerciseTermsAsk(t: string): boolean {
  return EQUITY_EXERCISE_TERMS_PATTERNS.some((p) => p.test(t));
}

export const EQUITY_BUYBACK_LIQUIDITY_PATTERNS: RegExp[] = [
  /\b(buyback|liquidity\s+event|secondary\s+sale|tender\s+offer|liquidity\s+history)\b/i,
];
export function detectEquityBuybackLiquidityAsk(t: string): boolean {
  return EQUITY_BUYBACK_LIQUIDITY_PATTERNS.some((p) => p.test(t));
}

/* ─── Wave-4 (2026-05-14k) — 32 new flags ──────────────────────────── */

/* Wave-4A — signOnClawback: sign-on / joining bonus clawback tail. */
export const SIGN_ON_CLAWBACK_PATTERNS: RegExp[] = [
  /\b(?:joining\s+bonus|sign[-\s]?on(?:\s+bonus)?|signing\s+bonus|jb)\s+(?:has\s+)?(?:an?\s+)?(?:\d+[-\s]?(?:month|year)s?\s+)?(?:clawback|recovery|tail|repayment|return)\b/i,
  /\b(?:clawback|recovery|return|repay)\s+(?:if\s+i\s+leave|on\s+(?:my\s+)?(?:joining|sign[-\s]?on|signing)\s+bonus)\b/i,
  /\b(?:\d{1,2}[-\s]?(?:month|year)s?\s+(?:clawback|tail|recovery)\s+(?:clause|period|window)?)\b/i,
  /\b(?:jb\s+recovery|joining[-\s]?bonus\s+recovery|sign[-\s]?on\s+(?:tail|clawback)\s+(?:clause)?)\b/i,
  /\b(?:if\s+i\s+leave\s+(?:before|under|within)\s+\d{1,2}\s+(?:months?|years?))\b.{0,80}\b(?:joining|sign[-\s]?on|signing|jb)/i,
];
export function detectSignOnClawback(t: string): boolean {
  return SIGN_ON_CLAWBACK_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — variableTrackRecord: PM/eng consistent variable history. */
export const VARIABLE_TRACK_RECORD_PATTERNS: RegExp[] = [
  /\b(?:always\s+(?:hit|hits|hitting|maxed|max(?:ing|imised))|consistently\s+(?:hit|max(?:ed|ing)?|deliver(?:ed|ing)?))\b.{0,60}\b(?:variable|bonus|payout|target)/i,
  /\b(?:100\s*%|full)\s+(?:variable|bonus|payout)\s+(?:every\s+(?:year|cycle)|history|track[-\s]?record)?\b/i,
  /\b(?:perfect|spotless|clean|flawless)\s+(?:variable|bonus|payout|variable\s+payout|bonus\s+payout)\s+(?:history|track[-\s]?record|record)\b/i,
  /\b(?:my\s+)?variable\s+(?:has\s+been|payout\s+has\s+been)\s+(?:100|max|full|at\s+target)\b/i,
  /\b(?:never\s+missed|always\s+at\s+(?:or\s+above\s+)?target)\b.{0,40}\b(?:variable|bonus|payout)/i,
];
export function detectVariableTrackRecord(t: string): boolean {
  return VARIABLE_TRACK_RECORD_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — wfhEquipmentStipend: desk / chair / internet / WFH setup. */
export const WFH_STIPEND_PATTERNS: RegExp[] = [
  /\b(?:wfh|work[-\s]?from[-\s]?home|home[-\s]?office)\s+(?:setup|stipend|allowance|equipment|kit)\b/i,
  /\b(?:desk|chair|monitor|ergonomic)\s+(?:stipend|allowance|reimbursement|setup)\b/i,
  /\b(?:internet|broadband|wifi)\s+(?:reimbursement|allowance|stipend|cover)\b/i,
  /\b(?:laptop|equipment)\s+(?:reimbursement|stipend|allowance|policy)\b/i,
  /\b(?:one[-\s]?time\s+(?:wfh|home[-\s]?office|setup)\s+(?:allowance|stipend|grant|amount))\b/i,
];
export function detectWfhEquipmentStipend(t: string): boolean {
  return WFH_STIPEND_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — salaryReviewCadenceAsk: review cycle / appraisal cadence. */
export const REVIEW_CADENCE_PATTERNS: RegExp[] = [
  /\b(?:annual|semi[-\s]?annual|half[-\s]?yearly|quarterly|yearly)\s+(?:review|appraisal|salary\s+review)\b/i,
  /\b(?:when'?s?|when\s+is)\s+(?:the\s+)?(?:next\s+)?(?:appraisal|salary\s+review|review\s+cycle|comp\s+cycle)\b/i,
  /\b(?:mid[-\s]?year\s+correction|off[-\s]?cycle\s+(?:correction|adjustment|raise))\b/i,
  /\b(?:review|appraisal|comp)\s+(?:cycle|cadence|frequency|policy)\b/i,
  /\b(?:how\s+often|when\s+do\s+you)\s+(?:do|run|hold)\s+(?:salary\s+)?(?:reviews?|appraisals?)\b/i,
];
export function detectSalaryReviewCadenceAsk(t: string): boolean {
  return REVIEW_CADENCE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — multipleOffersJuggling: 3+ active processes / multiple offers. */
export const MULTIPLE_OFFERS_PATTERNS: RegExp[] = [
  /\b(?:i\s+have|have)\s+(?:3|three|4|four|5|five|multiple|several)\s+(?:active\s+)?(?:offers?|processes?|interviews?|opportunities)\b/i,
  /\b(?:comparing|juggling|evaluating)\s+(?:3|three|4|four|5|five|multiple|several)\s+(?:offers?|companies|opportunities|options)\b/i,
  /\b(?:final\s+rounds?\s+with\s+(?:two|three|four|multiple|several|other)\s+(?:other\s+)?companies)\b/i,
  /\b(?:in\s+(?:talks|discussions|process)\s+with\s+(?:multiple|several|3|three|4|four)\s+(?:other\s+)?(?:companies|firms))\b/i,
  /\b(?:multiple\s+offers?\s+(?:in\s+hand|on\s+the\s+table|active))\b/i,
];
export function detectMultipleOffersJuggling(t: string): boolean {
  return MULTIPLE_OFFERS_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — recruitmentAgencyMediation: external recruiter / agency. */
export const AGENCY_PATTERNS: RegExp[] = [
  /\b(?:through|via)\s+(?:abc\s+)?(?:consultants?|consultancy|placement\s+agency|recruitment\s+(?:agency|firm)|staffing\s+(?:agency|firm))\b/i,
  /\b(?:placement\s+(?:agency|consultant)|external\s+recruiter|third[-\s]?party\s+recruiter|agency\s+recruiter)\b/i,
  /\b(?:naukri\s+rms|naukri\s+(?:recruiter|consultant)|rms\s+(?:reached|contacted))\b/i,
  /\b(?:i'?m\s+through|i\s+came\s+through)\s+(?:a\s+)?(?:consultant|consultancy|agency)\b/i,
  /\b(?:my\s+(?:agency|consultant|placement)\s+(?:rep|contact|recruiter))\b/i,
];
export function detectRecruitmentAgencyMediation(t: string): boolean {
  return AGENCY_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — internalTransferContext: IJP / internal candidate. */
export const INTERNAL_TRANSFER_PATTERNS: RegExp[] = [
  /\b(?:internal\s+(?:candidate|transfer|move|switch|job\s+posting)|i'?m\s+an\s+internal\s+candidate)\b/i,
  /\bijp\b/i,
  /\b(?:internal\s+job\s+posting|cross[-\s]?functional\s+(?:move|transfer)\s+(?:within|inside))\b/i,
  /\b(?:transferring|moving)\s+(?:within|inside|internally)\s+(?:the\s+)?(?:co(?:mpany)?|firm|org(?:anization)?)\b/i,
  /\b(?:lateral\s+(?:move|transfer)\s+within|internal\s+lateral)\b/i,
];
export function detectInternalTransferContext(t: string): boolean {
  return INTERNAL_TRANSFER_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — offerRescindedHistory: prior offer was pulled / cancelled. */
export const OFFER_RESCINDED_PATTERNS: RegExp[] = [
  /\b(?:my\s+(?:last|previous|prior)\s+offer\s+(?:was|got)\s+(?:rescinded|revoked|pulled|cancelled|withdrawn))\b/i,
  /\b(?:offer\s+(?:was\s+)?(?:rescinded|revoked|pulled|cancelled|withdrawn))\b/i,
  /\b(?:cars24|byju'?s|unacademy|ola)\s+(?:pulled|rescinded|cancelled|revoked)\s+(?:my\s+)?offer\b/i,
  /\b(?:joining\s+(?:was|got)\s+(?:cancelled|called\s+off|deferred\s+indefinitely)|joining\s+date\s+(?:cancelled|pulled))\b/i,
  /\b(?:offer\s+rescinded\s+(?:at\s+the\s+last\s+minute|just\s+before\s+joining))\b/i,
];
export function detectOfferRescindedHistory(t: string): boolean {
  return OFFER_RESCINDED_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — internationalDegreePremium: Stanford/MIT/Oxford/Ivy MBA. */
export const INTERNATIONAL_DEGREE_PATTERNS: RegExp[] = [
  /\b(?:stanford|mit|harvard|princeton|yale|oxford|cambridge|berkeley|caltech|cmu|carnegie\s+mellon|columbia|cornell|dartmouth|upenn|penn|brown)\b/i,
  /\b(?:ivy\s+league|insead|lbs|london\s+business\s+school|wharton|kellogg|booth|sloan|stern|haas|tuck|fuqua|johnson)\b/i,
  /\b(?:masters?|ms|mba|phd)\s+(?:at|from|degree\s+from)\s+(?:stanford|mit|harvard|oxford|cambridge|insead|lbs|wharton|kellogg)\b/i,
  /\b(?:overseas|abroad|us|uk|european)\s+(?:masters?|mba|phd|degree)\b/i,
  /\b(?:i\s+did\s+my\s+(?:masters?|mba|phd)\s+(?:at|in)\s+(?:the\s+)?(?:us|uk|states|abroad|overseas))\b/i,
];
export function detectInternationalDegreePremium(t: string): boolean {
  return INTERNATIONAL_DEGREE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — domesticTopMbaAnchor: IIM-A/B/C, ISB, XLRI, FMS, MDI. */
export const DOMESTIC_TOP_MBA_PATTERNS: RegExp[] = [
  /\b(?:iim[-\s]?(?:a|b|c|ahmedabad|bangalore|calcutta|kozhikode|lucknow|indore))\b/i,
  /\bisb\b|\bindian\s+school\s+of\s+business\b/i,
  /\b(?:xlri|fms|mdi|spjimr|sp\s+jain|jbims|nitie|iift)\b/i,
  /\b(?:fresh\s+(?:out\s+of|from)|just\s+graduated\s+from)\s+(?:iim|isb|xlri|fms|mdi)\b/i,
  /\b(?:iim|isb)\s+(?:grad(?:uate)?|fresher|alumni|alum)\b/i,
];
export function detectDomesticTopMbaAnchor(t: string): boolean {
  return DOMESTIC_TOP_MBA_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — toxicManagerContext: toxic boss / bad leadership exit. */
export const TOXIC_MANAGER_PATTERNS: RegExp[] = [
  /\b(?:toxic\s+(?:manager|boss|leadership|environment|workplace|culture))\b/i,
  /\b(?:my\s+manager\s+is\s+(?:the\s+reason|why)\s+i'?m\s+leaving)\b/i,
  /\b(?:bad|terrible|awful|horrible|abusive)\s+(?:manager|boss|leadership|leader)\b/i,
  /\b(?:leadership\s+is\s+the\s+(?:problem|issue|reason)|manager\s+issues?|management\s+issues?)\b/i,
  /\b(?:micromanag(?:er|ing|ement)|gaslighting\s+manager|hostile\s+manager)\b/i,
];
export function detectToxicManagerContext(t: string): boolean {
  return TOXIC_MANAGER_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — visaSponsorshipNeed: H1B / OPT / STEM / GC sponsorship. */
export const VISA_SPONSORSHIP_PATTERNS: RegExp[] = [
  /\b(?:h1[-\s]?b|h[-\s]?1[-\s]?b)\s+(?:sponsorship|transfer|visa)?\b/i,
  /\bopt\s+(?:runs?\s+out|expir(?:es|ing|y)|extension)\b/i,
  /\b(?:stem\s+(?:extension|opt)|stem[-\s]?opt)\b/i,
  /\b(?:visa\s+(?:sponsorship|transfer|status|required))\b/i,
  /\b(?:green\s+card|gc)\s+sponsorship\b/i,
  /\b(?:need\s+(?:visa\s+)?sponsorship|sponsor\s+(?:my\s+)?(?:visa|h1b|green\s+card|gc))\b/i,
];
export function detectVisaSponsorshipNeed(t: string): boolean {
  return VISA_SPONSORSHIP_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — casteReservationContext: SC/ST/OBC reservation in PSU/govt. */
export const CASTE_RESERVATION_PATTERNS: RegExp[] = [
  /\b(?:sc|st|obc|ews)\s+(?:category|reservation|quota|candidate)\b/i,
  /\b(?:reservation|quota)\s+(?:category|seat|under\s+(?:sc|st|obc|ews))\b/i,
  /\b(?:scheduled\s+(?:caste|tribe)|other\s+backward\s+class)\b/i,
  /\b(?:caste\s+(?:certificate|category|reservation))\b/i,
  /\b(?:psu|govt|government|public[-\s]?sector)\s+(?:reservation|quota|category)\b/i,
];
export function detectCasteReservationContext(t: string): boolean {
  return CASTE_RESERVATION_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — veteranTransition: ex-defence / armed-forces lateral. */
export const VETERAN_PATTERNS: RegExp[] = [
  /\b(?:ex[-\s]?(?:defence|defense|army|navy|air\s+force|military|servicemen|serviceman))\b/i,
  /\b(?:armed\s+forces?\s+(?:lateral|transition|veteran))\b/i,
  /\b(?:transitioning|moving)\s+from\s+the\s+(?:army|navy|air\s+force|military|defence|defense|forces?)\b/i,
  /\b(?:served\s+in\s+the\s+(?:army|navy|air\s+force|military|forces?)|veteran\s+(?:status|hire|transition))\b/i,
  /\b(?:retired\s+(?:army|navy|air\s+force|colonel|major|lieutenant|captain|commander))\b/i,
];
export function detectVeteranTransition(t: string): boolean {
  return VETERAN_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — singleParentConstraint: sole custody / single mom / dad. */
export const SINGLE_PARENT_PATTERNS: RegExp[] = [
  /\b(?:single\s+(?:parent|mom|mother|dad|father))\b/i,
  /\b(?:sole\s+(?:custody|guardian|parent|caregiver))\b/i,
  /\b(?:no\s+co[-\s]?parent|raising\s+(?:my\s+)?(?:kids?|child(?:ren)?)\s+alone)\b/i,
  /\b(?:divorced\s+(?:single\s+)?(?:mom|dad|parent)|widowed\s+(?:parent|mom|dad))\b/i,
  /\b(?:sole\s+(?:guardian|parent)\s+of\s+(?:my\s+)?(?:kid|child|children))\b/i,
];
export function detectSingleParentConstraint(t: string): boolean {
  return SINGLE_PARENT_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — jointFamilyFinancialResp: sole earner / extended family. */
export const JOINT_FAMILY_FIN_PATTERNS: RegExp[] = [
  /\b(?:sole\s+earner|only\s+earner|primary\s+earner)\b/i,
  /\b(?:supporting\s+(?:my\s+)?(?:parents|family|siblings)\s+financially)\b/i,
  /\b(?:responsibility\s+for\s+(?:my\s+)?siblings?'?\s+(?:education|college|fees))\b/i,
  /\b(?:household\s+runs\s+on\s+my\s+salary|family\s+depends\s+on\s+my\s+income)\b/i,
  /\b(?:joint\s+family\s+(?:responsibility|expenses)|extended\s+family\s+(?:support|dependents))\b/i,
];
export function detectJointFamilyFinancialResp(t: string): boolean {
  return JOINT_FAMILY_FIN_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — paternityLeaveAsk: paternity policy / new-father benefits. */
export const PATERNITY_LEAVE_PATTERNS: RegExp[] = [
  /\b(?:paternity\s+(?:leave|policy|benefits?|duration))\b/i,
  /\b(?:new[-\s]?father\s+(?:benefits?|leave|policy))\b/i,
  /\b(?:what'?s?\s+(?:your|the)\s+paternity)\b/i,
  /\b(?:dad\s+leave|father\s+leave|partner\s+leave\s+(?:for\s+new\s+(?:dads|fathers)))\b/i,
  /\b(?:paternity\s+(?:leave\s+)?(?:weeks|days|duration|length))\b/i,
];
export function detectPaternityLeaveAsk(t: string): boolean {
  return PATERNITY_LEAVE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — menstrualLeavePolicy: period leave / Zomato-style. */
export const MENSTRUAL_LEAVE_PATTERNS: RegExp[] = [
  /\b(?:menstrual\s+(?:leave|policy|days))\b/i,
  /\b(?:period\s+leave|periods?\s+(?:leave|policy|days?\s+off))\b/i,
  /\b(?:zomato[-\s]?style\s+(?:menstrual|period)\s+leave)\b/i,
  /\b(?:female[-\s]?specific\s+leave|monthly\s+leave\s+for\s+women)\b/i,
  /\b(?:do\s+you\s+(?:have|offer)\s+(?:menstrual|period)\s+leave)\b/i,
];
export function detectMenstrualLeavePolicy(t: string): boolean {
  return MENSTRUAL_LEAVE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4C — esopExerciseLoanAsk: ESOP loan / cashless exercise. */
export const ESOP_LOAN_PATTERNS: RegExp[] = [
  /\b(?:esop\s+(?:exercise\s+)?loan|exercise\s+loan|loan\s+to\s+exercise)\b/i,
  /\b(?:cashless\s+exercise|cashless\s+(?:esop|option))\b/i,
  /\b(?:company[-\s]?funded\s+exercise|company\s+(?:funds?|pays?\s+for)\s+(?:my\s+)?(?:esop\s+)?exercise)\b/i,
  /\b(?:do\s+you\s+offer\s+(?:an?\s+)?(?:esop\s+)?exercise\s+loan|loan[-\s]?backed\s+exercise)\b/i,
  /\b(?:net[-\s]?settle|net[-\s]?settlement)\s+(?:on\s+exercise|esop)\b/i,
];
export function detectEsopExerciseLoanAsk(t: string): boolean {
  return ESOP_LOAN_PATTERNS.some((p) => p.test(t));
}

/* Wave-4C — preIpoSecondaryAsk: secondary sale / tender opportunity. */
export const PRE_IPO_SECONDARY_PATTERNS: RegExp[] = [
  /\b(?:secondary\s+(?:sale|opportunity|transaction|market))\b/i,
  /\b(?:pre[-\s]?ipo\s+secondary|secondary\s+pre[-\s]?ipo)\b/i,
  /\b(?:tender\s+(?:offer|for\s+(?:early\s+)?employees?))\b/i,
  /\b(?:can\s+i\s+sell|sell\s+(?:some\s+)?(?:of\s+)?my\s+(?:vested\s+)?(?:esops?|shares?|equity))\b.{0,60}\b(?:secondary|pre[-\s]?ipo|tender)/i,
  /\b(?:liquidity\s+event\s+(?:before|pre)\s+ipo|early[-\s]?employee\s+liquidity)\b/i,
];
export function detectPreIpoSecondaryAsk(t: string): boolean {
  return PRE_IPO_SECONDARY_PATTERNS.some((p) => p.test(t));
}

/* Wave-4C — accelerationTriggerAsk: single/double-trigger acceleration. */
export const ACCELERATION_TRIGGER_PATTERNS: RegExp[] = [
  /\b(?:single[-\s]?trigger|double[-\s]?trigger)\s+(?:acceleration|vesting)?\b/i,
  /\b(?:acceleration\s+(?:trigger|clause|provision|on\s+change\s+of\s+control))\b/i,
  /\b(?:change\s+of\s+control\s+acceleration|coc\s+acceleration)\b/i,
  /\b(?:what'?s?\s+the\s+acceleration\s+(?:clause|policy|trigger))\b/i,
  /\b(?:accelerated\s+vesting\s+on\s+(?:acquisition|change|coc|termination))\b/i,
];
export function detectAccelerationTriggerAsk(t: string): boolean {
  return ACCELERATION_TRIGGER_PATTERNS.some((p) => p.test(t));
}

/* Wave-4C — esopPerquisiteTaxAsk: Section 17(2) / TDS on exercise. */
export const ESOP_PERQ_TAX_PATTERNS: RegExp[] = [
  /\b(?:section\s+17\s*\(\s*2\s*\)|sec\s+17[-\s]?2)/i,
  /\b(?:perquisite\s+tax|perq\s+tax)\s+(?:on\s+(?:exercise|esop|stock|rsu))?\b/i,
  /\b(?:tds\s+on\s+(?:esop\s+)?exercise|tds\s+(?:on\s+)?(?:rsu|vesting|exercise))\b/i,
  /\b(?:esop\s+(?:taxation|tax\s+treatment|tax\s+on\s+exercise))\b/i,
  /\b(?:fair\s+market\s+value\s+(?:on|at)\s+exercise|fmv\s+at\s+exercise)\b/i,
];
export function detectEsopPerquisiteTaxAsk(t: string): boolean {
  return ESOP_PERQ_TAX_PATTERNS.some((p) => p.test(t));
}

/* Wave-4C — tenderOfferCycleAsk: annual buyback / tender cycle. */
export const TENDER_CYCLE_PATTERNS: RegExp[] = [
  /\b(?:tender\s+offer\s+cycle|next\s+tender\s+offer)\b/i,
  /\b(?:annual\s+buy[-\s]?back|esop\s+buy[-\s]?back\s+(?:cadence|cycle|frequency))\b/i,
  /\b(?:buy[-\s]?back\s+(?:cycle|cadence|frequency|policy))\b/i,
  /\b(?:when'?s?\s+the\s+next\s+(?:buyback|tender|liquidity\s+event))\b/i,
  /\b(?:periodic\s+(?:buyback|tender)|quarterly\s+(?:buyback|tender))\b/i,
];
export function detectTenderOfferCycleAsk(t: string): boolean {
  return TENDER_CYCLE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4D — probationaryDurationAsk: probation length. */
export const PROBATION_DURATION_PATTERNS: RegExp[] = [
  /\b(?:how\s+long\s+is\s+(?:the\s+)?probation|probation\s+(?:duration|length|period\s+length))\b/i,
  /\b(?:3[-\s]?month|6[-\s]?month|three[-\s]?month|six[-\s]?month)\s+probation\b/i,
  /\b(?:probation(?:ary)?\s+(?:duration|months?|period))\b/i,
  /\b(?:probation\s+(?:is\s+)?(?:3|6|three|six|nine)\s+months?)\b/i,
  /\b(?:6[-\s]?month\s+vs\s+3[-\s]?month\s+probation|probation\s+vs)\b/i,
];
export function detectProbationaryDurationAsk(t: string): boolean {
  return PROBATION_DURATION_PATTERNS.some((p) => p.test(t));
}

/* Wave-4D — offerLetterTurnaroundDemand: fast OL turnaround. */
export const OL_TURNAROUND_PATTERNS: RegExp[] = [
  /\b(?:offer\s+letter|ol)\s+(?:in\s+|within\s+)?(?:24|48|72)\s+hours?\b/i,
  /\b(?:when\s+(?:will|do)\s+i\s+(?:get|receive)\s+(?:the\s+)?(?:written\s+)?offer(?:\s+letter)?)\b/i,
  /\b(?:offer[-\s]?letter\s+(?:deadline|turnaround|timeline))\b/i,
  /\b(?:need\s+the\s+ol|need\s+the\s+offer\s+letter)\s+(?:in|by|within)\b/i,
  /\b(?:can\s+you\s+send\s+(?:me\s+)?(?:the\s+)?(?:written\s+)?offer\s+(?:by|in|within))\b/i,
];
export function detectOfferLetterTurnaroundDemand(t: string): boolean {
  return OL_TURNAROUND_PATTERNS.some((p) => p.test(t));
}

/* Wave-4D — contractToHireAsk: contract-to-hire / temp-to-perm. */
export const CONTRACT_TO_HIRE_PATTERNS: RegExp[] = [
  /\b(?:contract[-\s]?to[-\s]?hire|c2h)\b/i,
  /\b(?:temp[-\s]?to[-\s]?perm|temporary[-\s]?to[-\s]?permanent)\b/i,
  /\b(?:is\s+this\s+(?:a\s+)?(?:contract|fixed[-\s]?term|temp(?:orary)?)\s+(?:role|position))\b/i,
  /\b(?:when\s+(?:does|will)\s+it\s+convert\s+to\s+(?:permanent|fte|full[-\s]?time))\b/i,
  /\b(?:conversion\s+to\s+permanent|converting\s+to\s+fte)\b/i,
];
export function detectContractToHireAsk(t: string): boolean {
  return CONTRACT_TO_HIRE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4D — headcountApprovalCheck: HC budgeted / approved? */
export const HEADCOUNT_APPROVAL_PATTERNS: RegExp[] = [
  /\b(?:is\s+the\s+)?(?:headcount|hc)\s+(?:approved|budgeted|signed[-\s]?off|allocated)\b/i,
  /\b(?:headcount\s+approval|hc\s+approval|backfill\s+(?:approved|budgeted))\b/i,
  /\b(?:offers?\s+fall\s+through\s+on\s+(?:hc|headcount))\b/i,
  /\b(?:has\s+the\s+(?:role|position)\s+been\s+(?:approved|budgeted))\b/i,
  /\b(?:budgeted\s+(?:role|position|headcount)|approved\s+(?:requisition|req))\b/i,
];
export function detectHeadcountApprovalCheck(t: string): boolean {
  return HEADCOUNT_APPROVAL_PATTERNS.some((p) => p.test(t));
}

/* Wave-4D — ipAssignmentClauseAsk: IP scope / side-project ownership. */
export const IP_CLAUSE_PATTERNS: RegExp[] = [
  /\b(?:ip\s+assignment|ip\s+clause|intellectual\s+property\s+(?:clause|assignment|scope))\b/i,
  /\b(?:do\s+i\s+own\s+(?:my\s+)?(?:side\s+projects?|personal\s+projects?|github|open[-\s]?source))\b/i,
  /\b(?:moonlighting\s+(?:clause|policy|ip)|side[-\s]?project\s+(?:ip|ownership))\b/i,
  /\b(?:invention\s+assignment|prior\s+inventions?\s+(?:carve[-\s]?out|clause))\b/i,
  /\b(?:can\s+i\s+(?:keep|own)\s+(?:my\s+)?(?:side|personal|open[-\s]?source)\s+(?:work|code|projects?))\b/i,
];
export function detectIpAssignmentClauseAsk(t: string): boolean {
  return IP_CLAUSE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4E — healthcarePharmaContext: pharma R&D / API / clinical. */
export const PHARMA_PATTERNS: RegExp[] = [
  /\b(?:sun\s+pharma|dr\.?\s+reddy'?s|cipla|lupin|aurobindo|biocon|glenmark|torrent\s+pharma|cadila|zydus|alkem|piramal)\b/i,
  /\b(?:pharma\s+(?:r\s*&\s*d|rnd|r&d|industry|sector|background))\b/i,
  /\b(?:api\s+manufacturing|active\s+pharmaceutical\s+ingredient)\b/i,
  /\b(?:clinical\s+(?:trials?|research|operations?)|cro\b|clinical\s+regulatory)\b/i,
  /\b(?:pharmaceutical\s+(?:industry|company|r&d|formulation)|drug\s+(?:discovery|development))\b/i,
];
export function detectHealthcarePharmaContext(t: string): boolean {
  return PHARMA_PATTERNS.some((p) => p.test(t));
}

/* Wave-4E — manufacturingCoreContext: core mech/elec/auto/steel. */
export const MFG_CORE_PATTERNS: RegExp[] = [
  /\b(?:tata\s+(?:motors|steel)|mahindra|l\s*&\s*t|larsen|maruti|bajaj\s+auto|hero\s+motocorp|ashok\s+leyland|tvs\s+motor|royal\s+enfield)\b/i,
  /\b(?:auto\s+oem|automotive\s+oem|automobile\s+(?:industry|sector|manufacturer))\b/i,
  /\b(?:manufacturing\s+plant|shop\s+floor|production\s+line|assembly\s+line)\b/i,
  /\b(?:core\s+(?:mechanical|electrical|engineering|industry)|mech(?:anical)?\s+engineering\s+(?:role|background))\b/i,
  /\b(?:steel\s+(?:plant|industry)|jsw|sail\b|vedanta|hindalco|nalco)\b/i,
];
export function detectManufacturingCoreContext(t: string): boolean {
  return MFG_CORE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4E — quickCommerceContext: Zepto/Blinkit/Instamart/BB-Now. */
export const QCOM_PATTERNS: RegExp[] = [
  /\b(?:zepto|blinkit|grofers|swiggy[-\s]?instamart|instamart|bb[-\s]?now|bigbasket\s+now|dunzo\s+daily)\b/i,
  /\b(?:quick[-\s]?commerce|q[-\s]?commerce)\b/i,
  /\b(?:10[-\s]?minute\s+delivery|10[-\s]?min\s+delivery|quick\s+delivery)\b/i,
  /\b(?:dark\s+stores?|micro[-\s]?warehouses?)\b/i,
  /\b(?:ultra[-\s]?fast\s+delivery|hyperlocal\s+delivery)\b/i,
];
export function detectQuickCommerceContext(t: string): boolean {
  return QCOM_PATTERNS.some((p) => p.test(t));
}

/* Wave-4E — d2cConsumerEquity: D2C founder-era brand. */
export const D2C_PATTERNS: RegExp[] = [
  /\b(?:boat|mamaearth|the\s+man\s+company|sugar\s+cosmetics|wakefit|licious|fresh\s+to\s+home|country\s+delight|epigamia|paper\s+boat|bombay\s+shaving)\b/i,
  /\b(?:d2c|dtc)\s+(?:brand|company|startup|e[-\s]?commerce)?\b/i,
  /\b(?:direct[-\s]?to[-\s]?consumer\s+(?:brand|company))\b/i,
  /\b(?:consumer[-\s]?tech\s+(?:startup|brand|company))\b/i,
  /\b(?:dtc\s+e[-\s]?commerce|d2c\s+e[-\s]?commerce)\b/i,
];
export function detectD2cConsumerEquity(t: string): boolean {
  return D2C_PATTERNS.some((p) => p.test(t));
}

export function detectCounterOfferRisk(t: string): "high" | "medium" | "low" | null {
  /* high — candidate mentions prior counter or manager already knows */
  if (/\b(?:(?:my\s+)?(?:current\s+)?(?:employer|manager|company|boss)\s+(?:already\s+)?knows?\s+(?:i'm|i\s+am)\s+(?:looking|interviewing|exploring))\b/i.test(t) ||
    /\b(?:they(?:'ve|\s+have)\s+already\s+(?:counter(?:ed)?|retained|tried\s+to\s+retain)|got\s+a\s+(?:counter|retention)\s+(?:offer|bonus))\b/i.test(t))
    return "high";
  /* low — candidate signals resignation letter ready / finalised */
  if (/\b(?:resignation\s+(?:letter\s+)?(?:is\s+)?(?:ready|submitted|drafted)|already\s+(?:resigned|put\s+in\s+(?:my\s+)?papers?))\b/i.test(t))
    return "low";
  return null;
}

export function detectCollegeTier(text: string): CollegeTier | null {
  if (!text) return null;
  /* tier-1 wins on tie — a candidate from "IIT-B and a tier-3 backup"
   * is read as tier-1 because their best signal dominates anchoring. */
  if (COLLEGE_TIER_1_PATTERNS.some((p) => p.test(text))) return "tier-1";
  if (COLLEGE_TIER_2_PATTERNS.some((p) => p.test(text))) return "tier-2";
  if (COLLEGE_TIER_3_PATTERNS.some((p) => p.test(text))) return "tier-3";
  return null;
}

/* ─── Bug-report 11 (2026-05-14) — Fresh-grad disclosure ─────────────
 *
 * A candidate may disclose mid-session that they are actually a pre-
 * graduate / fresh graduate / still in college / have zero applicable
 * experience. The previous parser had no signal for this: applicableYoe
 * was frozen at init from the resume, so a "Senior Product Designer"
 * resume applying for Business Analyst kept the senior bucket forever
 * even when the candidate said "I'm graduating, pre-graduate."
 *
 * Returns true when ANY of the following are stated:
 *   - "pre-graduate", "pre graduation", "yet to graduate"
 *   - "fresh graduate", "fresher", "freshly graduated"
 *   - "still in college", "still studying", "final year"
 *   - "haven't graduated", "haven't completed"
 *   - explicit "0 years of experience" / "no experience" in context
 *   - "graduating this year / next month / soon" (active student)
 * Pure. */
export const FRESH_GRAD_PATTERNS: RegExp[] = [
  /\b(pre[-\s]?grad(?:uate|uation)?|yet\s+to\s+graduate)\b/i,
  /\b(fresh(?:\s+|-)?grad(?:uate)?|fresher|fresh(?:ly|er|ers)?\s+(?:graduated|out\s+of\s+(?:college|university)))\b/i,
  /\b(still\s+(?:in\s+college|in\s+university|studying|a\s+student)|final[-\s]?year(?:\s+student)?|last[-\s]?year\s+(?:student|college))\b/i,
  /\b(haven'?t\s+(?:graduated|completed\s+(?:my\s+)?(?:degree|college))|not\s+(?:yet\s+)?graduated)\b/i,
  /\b(graduating\s+(?:this\s+year|next\s+(?:month|year)|soon|in\s+\w+))\b/i,
  /\b(0|zero)\s+(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp|yoe)\b/i,
  /\b(no\s+(?:prior\s+|professional\s+|real\s+|actual\s+)?(?:work\s+)?experience)\b/i,
  /\bi'?m\s+(?:graduating|a\s+fresher|a\s+fresh\s+grad)\b/i,
];

export function detectFreshGradDisclosure(text: string): boolean {
  if (!text) return false;
  return FRESH_GRAD_PATTERNS.some((p) => p.test(text));
}

/* `wantsHigherBase` — candidate explicitly asked for higher fixed/base.
 * BUG-006 widening (QA v3, 2026-05-19) — TC007 ("Is there flexibility on
 * fixed?") and TC009 ("I prefer stronger fixed because that is guaranteed")
 * are clear higher-base asks but the original regex required the literal
 * "higher fixed". Add (i) "flexibility on fixed / room on fixed",
 * (ii) "stronger / better fixed" without an explicit comparative verb,
 * (iii) "comfortable with fixed of N" / "fixed component of N" comp asks. */
export function detectWantsHigherBase(t: string): boolean {
  return /\b(?:higher\s+(?:fixed|base|basic)\s+(?:salary|pay|component))\b/i.test(t) ||
    /\b(?:want\s+(?:a\s+)?(?:better|higher|more)\s+(?:fixed|base)\b)/i.test(t) ||
    /\b(?:increase\s+(?:the\s+)?(?:fixed|base)\s+(?:salary|component|pay))\b/i.test(t) ||
    /\b(?:more\s+(?:in\s+)?(?:fixed|base|guaranteed)\s+(?:comp|salary|pay))\b/i.test(t) ||
    /\b(?:(?:any\s+)?(?:flexibility|flex|room|movement|wiggle\s*room)\s+on\s+(?:the\s+)?(?:fixed|base))\b/i.test(t) ||
    /\b(?:(?:stronger|bigger|fatter|larger)\s+(?:fixed|base)\b)/i.test(t) ||
    /\b(?:prefer\s+(?:a\s+)?(?:stronger|higher|larger|more)\s+(?:fixed|base|guaranteed))\b/i.test(t) ||
    /\b(?:(?:if\s+)?fixed\s+cannot\s+move)\b/i.test(t) ||
    /* QA v3 round 3 (2026-05-19) — breakup-pushback pattern. Candidate
     * has seen the offer breakup, fixed component is below expectation,
     * asks to revisit. Maps to P18_BREAKUP_PUSHBACK archetype. */
    /\bfixed\s+is\s+(?:lower|less|below)\s+(?:than\s+)?(?:expected|market|i\s+expected)\b/i.test(t) ||
    /\b(?:can\s+we\s+)?revisit\s+(?:it|the\s+(?:breakup|fixed|base|offer))\b/i.test(t) ||
    /\bbreakup.*(?:lower|less|below|disappointing)\b/i.test(t);
}

/* `wantsJoiningBonus` — candidate asked about or mentioned joining bonus. */
export function detectWantsJoiningBonus(t: string): boolean {
  /* #36 (2026-07-08) — "signing bonus" is the same sweetener as "joining bonus"
   * (US/global register); without it a "2L more and a signing bonus" compound
   * demand honored the base but silently dropped the bonus condition. */
  return /\b(?:joining\s+bonus|signing\s+bonus|sign[-\s]?on\s+bonus|sign[-\s]?on\s+(?:payment|component))\b/i.test(t) ||
    /\b(?:can\s+(?:you|the\s+company)\s+(?:offer|provide|give)\s+(?:a\s+)?(?:joining|sign[-\s]?on)\s+bonus)\b/i.test(t) ||
    /\b(?:is\s+there\s+(?:a\s+)?(?:joining|sign[-\s]?on)\s+bonus)\b/i.test(t);
}

/* `wantsRelocationAllowance` — candidate asked about relocation support. */
export function detectWantsRelocationAllowance(t: string): boolean {
  return /\b(?:relocation\s+(?:allowance|support|assistance|expenses?|package))\b/i.test(t) ||
    /\b(?:can\s+(?:you|the\s+company)\s+(?:cover|help\s+with|support)\s+(?:my\s+)?(?:relocation|moving\s+costs?))\b/i.test(t) ||
    /\b(?:moving\s+(?:allowance|support|assistance|expenses?))\b/i.test(t);
}

/* `wantsFlexibleWork` — candidate asked about hybrid / WFH / remote work
 * ARRANGEMENT (days in office, flexible hours), distinct from
 * wfhEquipmentStipend (one-time setup money). Gap #1 (2026-06-18). */
export function detectWantsFlexibleWork(t: string): boolean {
  return /\b(?:work\s+from\s+home|wfh|hybrid|remote\s+work|remote\s+option|days?\s+from\s+home|days?\s+in\s+(?:the\s+)?office|in[-\s]?office\s+days?|work\s+flexibility|flexible\s+(?:work|hours|timing|schedule))\b/i.test(t) ||
    /\b(?:can\s+i\s+(?:work|do)\s+(?:from\s+home|remote|hybrid))\b/i.test(t) ||
    /\b(?:how\s+many\s+days?\s+(?:in\s+(?:the\s+)?office|from\s+home|wfo|wfh))\b/i.test(t);
}

/* `invokedCompetingOffer` — used competing offer as leverage. Distinct from
 * just mentioning it — requires explicit leverage language. */
export function detectInvokedCompetingOffer(t: string): boolean {
  return /\b(?:(?:because\s+of|given|considering)\s+(?:my\s+)?(?:other|competing|rival)\s+offer)\b/i.test(t) ||
    /\b(?:(?:other|competing)\s+offer\s+(?:is\s+paying|pays?|has\s+already)\s+(?:more|higher|₹\s*\d+))\b/i.test(t) ||
    /\b(?:(?:match|beat|better)\s+(?:my|the|that)\s+(?:other|competing|rival)\s+offer)\b/i.test(t) ||
    /\b(?:need\s+(?:you\s+to\s+)?(?:match|beat|top)\s+(?:my|the)\s+(?:other|competing)\s+offer)\b/i.test(t);
}

/* `askedAboutGrowthPath` — asked about career progression explicitly. */
export function detectAskedAboutGrowthPath(t: string): boolean {
  return /\b(?:what(?:'s|\s+is)\s+(?:the\s+)?(?:career|growth|promotion|progression)\s+(?:path|track|trajectory|ladder|opportunity))\b/i.test(t) ||
    /\b(?:how\s+(?:fast|quickly|soon)\s+(?:do\s+people|can\s+i)\s+(?:get\s+promoted|grow|advance))\b/i.test(t) ||
    /\b(?:growth\s+(?:path|opportunity|track|potential)\s+(?:in|at|for\s+this)\s+(?:role|company|position))\b/i.test(t);
}

/* `gaveInconsistentNumbers` — CTC numbers contradicted each other. This is
 * primarily a kernel-set flag but text detection catches within-utterance
 * contradictions for early warning. */
export function detectGaveInconsistentNumbers(t: string): boolean {
  /* Look for two different LPA numbers in the same utterance claimed as
   * "current" salary — conservative: requires "current" context + two numbers. */
  const nums: number[] = [];
  const re = /\b(?:current(?:ly)?(?:\s+(?:ctc|salary|package))?\s+(?:is|at|:)\s*)(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l|lakh|lakhs)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const n = parseFloat(m[1]);
    if (Number.isFinite(n) && n > 0) nums.push(n);
  }
  if (nums.length >= 2) {
    const spread = Math.abs(nums[0] - nums[1]) / Math.min(nums[0], nums[1]);
    return spread > 0.1; /* > 10% difference in same utterance = inconsistent */
  }
  return false;
}

/* `evasiveOnCurrentCtc` — deflected or refused to disclose. Complementary
 * to currentCtcRefusal but captures softer evasion. */
export function detectEvasiveOnCurrentCtc(t: string): boolean {
  return /\b(?:(?:rather\s+|prefer\s+)?not\s+(?:discuss|get\s+into|share|disclose)\s+(?:my\s+)?(?:current\s+)?(?:ctc|salary|package))\b/i.test(t) ||
    /\b(?:it'?s?\s+(?:complicated|not\s+straightforward|hard\s+to\s+say)\s+(?:because|as)\s+(?:of\s+)?(?:the\s+)?(?:components?|structure|split))\b/i.test(t) ||
    /\b(?:i'?d\s+(?:prefer\s+to\s+)?(?:not|rather\s+not)\s+(?:anchor|lead)\s+with\s+(?:my\s+)?(?:current|present)\s+(?:ctc|number))\b/i.test(t);
}

/* `mentionedSpouseFamily` — mentioned spouse / family discussion. */
export function detectMentionedSpouseFamily(t: string): boolean {
  return /\b(?:(?:need|want)\s+to\s+(?:discuss|talk|check)\s+(?:with|to)\s+(?:my\s+)?(?:wife|husband|spouse|family|partner|parents))\b/i.test(t) ||
    /\b(?:(?:family|spouse|wife|husband|partner)\s+(?:decision|discussion|input|approval|needs?\s+to\s+know))\b/i.test(t) ||
    /\b(?:let\s+me\s+(?:discuss|check|talk)\s+(?:at\s+home|with\s+my\s+(?:family|wife|husband|spouse)))\b/i.test(t);
}

/* `mentionedForm16` — mentioned Form-16 / tax certificate from new employer. */
export function detectMentionedForm16(t: string): boolean {
  return /\b(?:form\s*[-\s]?16\b|form\s+16\s+(?:issuance|date|from\s+(?:new|your)\s+company)|will\s+(?:you|the\s+company)\s+give\s+(?:me\s+)?form\s*16)\b/i.test(t);
}

/* `askedAboutReporting` — asked who they report to. */
export function detectAskedAboutReporting(t: string): boolean {
  return /\b(?:who\s+(?:would|will|do)\s+i\s+(?:report\s+to|report\s+directly\s+to)|(?:reporting\s+(?:line|structure|relationship)|who\s+is\s+(?:my|the)\s+(?:manager|direct\s+manager|reporting\s+manager))\b)\b/i.test(t) ||
    /\b(?:who\s+does\s+this\s+role\s+report\s+to|who\s+would\s+be\s+my\s+(?:manager|boss|supervisor|lead))\b/i.test(t);
}

/* `askedAboutTeamSize` — asked about team size (not span-of-control). */
export function detectAskedAboutTeamSize(t: string): boolean {
  return /\b(?:how\s+(?:big|large|many\s+people)\s+is\s+the\s+team|team\s+(?:size|headcount|strength)|how\s+many\s+(?:people|members?|engineers?)\s+(?:are\s+)?(?:on|in)\s+(?:the\s+)?team)\b/i.test(t);
}

/* `askedAboutGrowthPath8` — Wave-8 growth-path detector (distinct pattern from Wave-7). */
export function detectAskedAboutGrowthPath8(t: string): boolean {
  return /\b(?:what(?:'s|\s+is)\s+(?:the\s+)?(?:career\s+trajectory|growth\s+opportunity|advancement\s+path|upward\s+mobility)|room\s+for\s+(?:growth|advancement)\s+in\s+(?:this\s+)?(?:role|position|company|team))\b/i.test(t) ||
    /\b(?:(?:fast|quick)\s+track(?:ed)?\s+(?:growth|promotion|advancement)|internal\s+mobility\s+(?:options?|opportunities?|path))\b/i.test(t);
}

/* `competingOfferAmount` — stated amount of competing offer in LPA. */
export function detectCompetingOfferAmount(t: string): number | null {
  const m = /(?:other|competing|rival)\s+offer\s+(?:is\s+)?(?:paying|offering|worth|at|of)\s*(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l\b|lakh|lakhs)\b/i.exec(t) ||
    /\b(?:they(?:'re|\s+are)\s+(?:offering|paying)\s*)(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l\b|lakh|lakhs)\b/i.exec(t);
  if (m) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/* `mentionedBgvConcern` — raised a background-verification concern. */
export function detectMentionedBgvConcern(t: string): boolean {
  return /\b(?:bgv\b|background\s+(?:verification|check|screening)|what\s+does\s+(?:the\s+)?bgv\s+cover|my\s+(?:degree|employment|gap)\s+(?:might|may|could)\s+(?:not\s+pass|fail|be\s+an?\s+issue\s+in)\s+(?:bgv|background\s+check))\b/i.test(t);
}

/* `mentionedMoonlighting` — mentioned moonlighting / second job / side-project policy. */
export function detectMentionedMoonlighting(t: string): boolean {
  return /\b(?:moonlight(?:ing)?\b|second\s+job\b|side\s+(?:hustle|project|job|gig|work)\b|parallel\s+(?:employment|work|job)|consulting\s+on\s+the\s+side)\b/i.test(t) ||
    /\b(?:what(?:'s|\s+is)\s+(?:your|the)\s+(?:moonlighting|dual\s+employment|second\s+job)\s+policy)\b/i.test(t);
}

/* `gaveRangeNotPoint` — candidate gave a range instead of point number.
 * S2-B8 (2026-07-22) — the second pattern originally included "and" as a
 * range connector, falsely matching "32 LPA and 38 LPA" in a turn where
 * the candidate disclosed CTC (32) and a salary counter (38) as two separate
 * facts ("Currently at 32 LPA and 38 LPA is my target"). That set
 * gaveRangeNotPoint=true and fired the range-to-point probe ("where in that
 * range do you actually see yourself landing?"), ignoring the counter.
 * Fix: remove "and" from the second pattern — "X LPA and Y LPA" without a
 * preceding "between"/"from" is ambiguous (CTC + counter is the common case).
 * The first pattern still covers "between N and M" / "from N to M" correctly. */
export function detectGaveRangeNotPoint(t: string): boolean {
  return /\b(?:somewhere\s+(?:between|in\s+the\s+range\s+of)|(?:between|from)\s+(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l|lakh|lakhs)?\s+(?:and|to|–|-)\s+(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l|lakh|lakhs)?\b)\b/i.test(t) ||
    /\b(?:(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l|lakh|lakhs)\s+(?:to|–|-)\s+(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l|lakh|lakhs))\b/i.test(t);
}

/* `deflectedOnRange` — candidate deflected when asked for a number.
 * BUG-007 widening (QA v3, 2026-05-19) — also catch the "salary is not
 * the main priority" / "whatever you decide / as per company standard"
 * patterns that previously only fired `candidateStance.avoidsAnchor`.
 * Without this widening, TC003 / TC019 hit the discovery-restart path
 * (no anti-exploitation guard) instead of the range-deflection prose.
 * The wired-profile rule for range-deflection then fires and produces
 * the "band-grade language + mutual disclosure" probe that explicitly
 * does NOT exploit the candidate's low-priority signal. */
export function detectDeflectedOnRange(t: string): boolean {
  return /\b(?:i(?:'m|\s+am)\s+(?:quite\s+)?flexible\s+(?:on\s+the\s+(?:number|salary|range)|about\s+(?:this|the\s+(?:number|package)))|you\s+(?:tell\s+me|can\s+decide|know\s+best)\s+(?:the\s+)?(?:number|salary|package))\b/i.test(t) ||
    /\b(?:(?:whatever\s+|you\s+tell\s+me\s+)?(?:the\s+)?market\s+(?:rate|says|dictates)|(?:open\s+to\s+discussion|happy\s+with\s+the\s+market\s+rate))\b/i.test(t) ||
    /\b(?:i\s+(?:don'?t|do\s+not)\s+have\s+a\s+(?:specific\s+)?(?:number\s+in\s+mind|fixed\s+expectation))\b/i.test(t) ||
    /* BUG-007 — avoidsAnchor patterns folded in. */
    /\bas\s+per\s+(?:company|your)\s+(?:standards?|policy|norms?|discretion|decision)\b/i.test(t) ||
    /\bwhatever\s+(?:you\s+)?(?:offer|decide|think\s+is\s+fair|company\s+(?:decides|gives))\b/i.test(t) ||
    /\b(?:salary|comp(?:ensation)?|package|money|the\s+number)\s+(?:is\s+)?(?:not|isn'?t)\s+(?:the\s+)?(?:main|primary|top|biggest|key)\s+(?:priority|consideration|factor|driver)/i.test(t) ||
    /\b(?:salary|comp(?:ensation)?|package|money|the\s+number)\s+is\s+secondary\b/i.test(t);
}

/* Polish 3 (2026-05-16) — `referencedMarketData` source detector with
 * the full Indian-context catalogue. Indian candidates routinely cite
 * Naukri (separately from Naukri Salary), Blind India / Blind app,
 * Glassdoor India, IIM Jobs (senior roles), Cutshort, Indeed in
 * addition to the long-standing AmbitionBox / Levels.fyi / Payscale
 * trio. Each source has a regex (case-insensitive, word-bounded where
 * possible) and a canonical key used by `marketDataSources` for the
 * citation phrasing in the reactive followup line. */
export const MARKET_DATA_SOURCE_PATTERNS: { key: string; re: RegExp }[] = [
  { key: "ambitionbox", re: /\b(?:ambitionbox|ambition\s+box)\b/i },
  { key: "levels.fyi", re: /\b(?:levels\.fyi|levels\s+fyi)\b/i },
  /* Blind: covers "blind", "blind india", "blind app", "blind salaries".
   * Anchored on the word so it doesn't match the adjective "blind". */
  { key: "blind", re: /\bblind(?:\s+(?:india|app|salaries?))?\b/i },
  /* Naukri: covers "naukri" alone AND "naukri salary"/"naukri.com". */
  { key: "naukri", re: /\bnaukri(?:[.\s]+(?:com|salary|salaries|listings?|jobs?|jobs?\s+(?:listings|data)))?\b/i },
  /* IIM Jobs: "iim jobs" or "iimjobs" (single token). Senior-role focus. */
  { key: "iimjobs", re: /\b(?:iim\s*jobs|iimjobs(?:\.com)?)\b/i },
  { key: "cutshort", re: /\bcutshort(?:\.com)?\b/i },
  { key: "glassdoor", re: /\bglassdoor(?:\s+india)?\b/i },
  { key: "payscale", re: /\bpayscale(?:\.com)?\b/i },
  /* Indeed: word-bounded so it doesn't match the adverb "indeed". A
   * candidate citing the platform almost always uses "Indeed says/data"
   * or "indeed.com". */
  { key: "indeed", re: /\b(?:indeed\.com|indeed\s+(?:says?|data|listings?|range|estimate|shows?))\b/i },
];

export function detectReferencedMarketDataSources(t: string): string[] {
  const out: string[] = [];
  for (const { key, re } of MARKET_DATA_SOURCE_PATTERNS) {
    if (re.test(t)) out.push(key);
  }
  return out;
}

/** Polish 3 (2026-05-16) — citation phrasing per market-data source.
 *  The reactive followup line uses these strings verbatim so the
 *  recruiter names the specific source the candidate referenced
 *  ("AmbitionBox numbers are useful as a floor", "Naukri listings
 *  skew towards service-company bands"), not a generic "market data
 *  estimate". */
export const marketDataSources: Record<string, string> = {
  ambitionbox: "AmbitionBox",
  "levels.fyi": "Levels.fyi",
  blind: "Blind",
  naukri: "Naukri",
  iimjobs: "IIM Jobs",
  cutshort: "Cutshort",
  glassdoor: "Glassdoor",
  payscale: "Payscale",
  indeed: "Indeed",
};

/* `referencedMarketData` — cited any of the catalogued sources OR a
 * generic "market data / market research" framing. */
export function detectReferencedMarketData(t: string): boolean {
  if (detectReferencedMarketDataSources(t).length > 0) return true;
  return /\b(?:linkedin\s+salary|comparably)\b/i.test(t) ||
    /\b(?:according\s+to\s+(?:market\s+(?:data|research|survey)|salary\s+(?:data|survey|report))|market\s+(?:data|research)\s+(?:shows?|suggests?|indicates?))\b/i.test(t);
}

/* `mentionedTaxImplication` — mentioned tax implications as a comp factor. */
export function detectMentionedTaxImplication(t: string): boolean {
  return /\b(?:new\s+tax\s+regime|old\s+(?:vs\.?\s+new\s+)?tax\s+regime|section\s+87\s*a\b|tax\s+(?:slab|bracket|planning|implication|saving|efficiency)|80\s*c\b|tds\s+(?:rate|deduction|planning)|effective\s+tax\s+rate)\b/i.test(t) ||
    /\b(?:post[-\s]?tax\s+(?:take[-\s]?home|in[-\s]?hand)|in[-\s]?hand\s+after\s+(?:tax|tds)|take[-\s]?home\s+after\s+(?:all\s+)?(?:deductions?|tax(?:es)?))\b/i.test(t);
}
