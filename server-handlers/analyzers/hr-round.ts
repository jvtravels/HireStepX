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
  RubricGap,
  TranscriptTurn,
  emptyResult,
} from "./_types";

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
const WHY_COMPANY_PROMPT = /\b(why (?:our|this) company|why us|why are you interested in (?:us|our|this company)|what do you know about (?:us|our company)|why (?:do )?you want to (?:join|work (?:at|with|here))|humari company kyu|yahan kyu)\b/i;
const GENERIC_WHY = /\b(great culture|great brand|good company|reputed|reputation|big name|industry leader|top company|growth opportunit|good work[- ]?life|good place|nice place|love the company|achi company|badi company|brand achi)\b/i;
const SPECIFIC_WHY = /\b(launched|launch|product|feature|leader|founder|ceo|cto|paper|blog|talk|conference|series [a-d]|ipo|acquired|acquisition|mission|domain|space|sector|stack|engineering blog|open source|case study|customer|use case)\b/i;
const SELF_INTRO_PROMPT = /\b(tell me about yourself|walk me through|introduce yourself|your background|apne baare mein|introduction)\b/i;
const SPECIFICS = /\b\d+\s*(?:years?|months?|saal|mahine)\b|\b(?:built|led|shipped|launched|migrated|deployed|scaled|owned|drove|delivered|banaya|kiya tha|lead kiya)\b/i;
const BENEFITS_PROMPT = /\b(joining bonus|signing bonus|clawback|probation|bond|service agreement|esop|rsu|vesting|cliff|insurance|epf|provident fund|gratuity|nps|variable pay)\b/i;
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
  version: "hr-round-v3",

  async analyze({ session }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) {
      result.flags.push("empty_transcript");
      return result;
    }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];
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

    if (SELF_INTRO_PROMPT.test(aiText)) {
      const idx = transcript.findIndex((t) => isAi(t) && SELF_INTRO_PROMPT.test(t.text || ""));
      const r = replyTo(transcript, idx);
      if (r && r.text && r.text.length >= 60 && !SPECIFICS.test(r.text)) {
        flags.add("generic_self_intro");
        gaps.push({ dimension: "specificity", expected: "Self-intro includes years of experience, concrete projects, results", observed: "Self-intro lacked numbers, project names, or action verbs", severity: "medium" });
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && BGV_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && BGV_EVASIVE.test(r.text)) {
          flags.add("bgv_document_evasion");
          gaps.push({ dimension: "compliance_readiness", expected: "Comfort sharing payslips, Form 16, relieving letters, PAN/Aadhaar/UAN for BGV", observed: "Candidate hedged or refused on document sharing — BGV will block onboarding", severity: "high" });
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && PAYSLIP_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && PAYSLIP_REFUSED.test(r.text)) {
          flags.add("payslip_refusal");
          if (!flags.has("bgv_document_evasion")) {
            gaps.push({ dimension: "comp_transparency", expected: "Share payslips/Form 16 when asked — refusal signals inflated current CTC", observed: "Candidate refused payslip share — HR will assume current CTC is inflated", severity: "high" });
          }
          break;
        }
      }
    }

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && COUNTER_OFFER_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && r.text.length < 220 && COUNTER_OFFER_DODGE.test(r.text)) {
          flags.add("counter_offer_dodge");
          gaps.push({ dimension: "commitment_signal", expected: "Clear stance on counter-offer / other offers — HR is testing pre-joining drop-out risk", observed: "Candidate dodged the commitment question, reads as flight risk", severity: "medium" });
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
          gaps.push({ dimension: "motivation_specificity", expected: "Why-us tied to a specific product, leader, domain, or recent move", observed: "Answer used generic platitudes (great culture/brand/growth) without specifics", severity: "medium" });
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

    for (let i = 0; i < transcript.length; i++) {
      const t = transcript[i];
      if (isAi(t) && REFERENCE_PROMPT.test(t.text || "")) {
        const r = replyTo(transcript, i);
        if (r && r.text && REFERENCE_REFUSAL.test(r.text)) {
          flags.add("reference_refusal");
          gaps.push({ dimension: "compliance_readiness", expected: "Two professional references ready (ex-managers preferred); current manager exception is fine and expected", observed: "Candidate refused to provide any references — BGV blocker, recruiter will assume hidden exit", severity: "high" });
          break;
        }
      }
    }

    if (OFFER_DELAY_ANXIETY.test(userText)) {
      flags.add("offer_letter_delay_anxiety");
      gaps.push({ dimension: "commitment_signal", expected: "Ask offer-letter timing crisply once near close — not as mid-interview anxiety", observed: "Candidate surfaced offer-letter / deadline anxiety during substantive turns — reads as nervous flight risk", severity: "low" });
    }

    const covered = DIMENSIONS.filter((d) => DIMENSION_PATTERNS[d].test(allText));
    if (transcript.length > 8 && covered.length < 4) {
      flags.add("dimensions_thin_coverage");
      const missed = DIMENSIONS.filter((d) => !covered.includes(d));
      gaps.push({ dimension: "session_coverage", expected: "Indian HR round should touch ≥4 of 7 dimensions: logistics, comp, stability, compliance, commitment, benefits, motivation", observed: `Only ${covered.length}/7 covered. Missing: ${missed.join(", ")}.`, severity: "medium" });
    }

    const tips: string[] = [];
    if (flags.has("user_anchor_leaked_salary")) tips.push("Never name a salary first — deflect with 'I'd want to understand the role + level before discussing comp.'");
    if (flags.has("user_badmouthing_employer")) tips.push("Reframe past frustrations as growth opportunities. HR scores professionalism heavily.");
    if (flags.has("generic_self_intro")) tips.push("Tighten 'tell me about yourself' to a 90-second story with 2 concrete projects + outcomes.");
    if (flags.has("vague_notice_period")) tips.push("Know your notice period cold — exact days, buyout policy, earliest LWD. Vague answers signal flight risk.");
    if (flags.has("bgv_document_evasion")) tips.push("Keep payslips (last 3), Form 16, relieving letters, PAN/Aadhaar/UAN ready. Hesitation here blocks onboarding via BGV.");
    if (flags.has("payslip_refusal") && !flags.has("bgv_document_evasion")) tips.push("Refusing payslips reads as inflated current CTC. Share them — or justify why your number isn't anchored on current.");
    if (flags.has("counter_offer_dodge")) tips.push("On counter-offers: 'If I accept yours, I won't take a counter.' Pre-joining drop-out is HR's #1 fear — give them the clarity.");
    if (flags.has("generic_why_company")) tips.push("Drop 'great culture / great brand'. Name one specific thing: a recent launch, a leader's blog, a domain bet.");
    if (flags.has("gap_unexplained")) tips.push("Own gaps with one crisp sentence: dates + reason + what you did with the time. Indian HR will probe — be ready.");
    if (flags.has("hike_rationale_thin")) tips.push("Anchor hike % on market data or scope, not a desired round number.");
    if (flags.has("salary_breakup_vague")) tips.push("When HR asks structure, break the CTC down: 'Fixed X, variable Y (paid out Z%), joining bonus A, RSU vest B over 4 years.' Single-number CTC reads as inflated variable.");
    if (flags.has("reference_refusal")) tips.push("Have 2 references ready (ex-managers preferred). Saying 'no references' is a hard BGV blocker — even one current peer + one ex-manager is fine.");
    if (flags.has("offer_letter_delay_anxiety")) tips.push("Hold offer-letter timing questions for the close — asking mid-interview reads as anxious. Phrase it cleanly: 'What's your typical timeline from verbal to written offer?'");
    if (flags.has("dimensions_thin_coverage")) tips.push("Real Indian HR covers 7 dimensions. Re-run with notice/BGV/counter-offer/benefits prompts.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
