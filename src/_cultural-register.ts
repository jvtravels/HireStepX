/* HireStepX — Indian-context cultural register detectors
 *
 * The behavioural evaluator inherits its rubric from Western interview
 * coaching (Amazon LP, McKinsey PEI), which systematically mis-grades
 * three things in Indian-English answers:
 *
 *   1. "Hedged disagreement" — "with respect, I'd suggest…" — is the
 *      Indian register for strong conviction expressed politely. The
 *      Western rubric reads it as weak conviction and asks "be more
 *      direct." This is wrong: the candidate IS being direct, in the
 *      register native to their interview context.
 *
 *   2. "Indirect failure framing" — "there were some challenges with
 *      the timeline" / "the rollout had a few issues" — is the Indian
 *      register for failure ownership. The Western rubric reads it as
 *      deflection and asks "own it more directly." This is wrong: the
 *      candidate IS owning it, in a way that's professionally
 *      appropriate in their context.
 *
 *   3. "Relational framing" — "kept the team aligned" / "preserved
 *      trust with stakeholders" — is a legitimate Result marker in
 *      Indian behavioural answers. The Western rubric reads it as
 *      soft-skill filler and asks for "harder metrics."
 *
 * This module is a set of regex detectors that surface these markers
 * so downstream consumers (follow-up handler, evaluator) can treat
 * them as non-penalty signals — recognising the register without
 * scoring the candidate down for using it. Conservative regexes: only
 * the unambiguous shapes match. False negatives are preferable to
 * false positives (claiming the register is present when it isn't
 * would let weak answers off the hook).
 *
 * Sibling to _star-detection.ts. Both are shared between live coach
 * and report so the candidate sees consistent treatment.
 */

export interface CulturalRegister {
  /** "with respect, I'd push back" / "may I gently disagree" — hedged
   *  disagreement that's actually strong conviction in Indian register. */
  hedgedDisagreement: boolean;
  /** "there were some challenges" / "the rollout had a few issues" —
   *  indirect failure ownership. Counts as ownership signal, NOT
   *  deflection. */
  indirectFailureFraming: boolean;
  /** "kept the team aligned" / "preserved trust" / "maintained
   *  relationships" — relational outcome framing. Counts as a Result
   *  marker. */
  relationalFraming: boolean;
  /** Festival / quarter-end / calendar references that anchor the
   *  Situation in real Indian operational context. */
  calendarAnchored: boolean;
  /** "Thank you so much for this opportunity, sir" / "I really
   *  appreciate you taking the time" — explicit gratitude / deference
   *  phrases that Western low-confidence-marker detection would
   *  misfire on. Counts as professional courtesy, NOT weakness. */
  deferentialGratitude: boolean;
  /** "I scored 92% in 10th, CGPA 8.4" — voluntary recital of board
   *  percentages or CGPA. Standard ritual at Indian services firms
   *  (TCS / Infosys / Wipro etc.), NOT padding or insecurity. */
  pedigreeRecital: boolean;
}

/* Hedged disagreement — must contain BOTH a deference marker
   ("with respect", "respectfully", "if I may", "may I", "I'd gently")
   AND a disagreement / pushback verb. A bare "with respect" alone
   doesn't qualify (could be respectful agreement). */
const HEDGED_DISAGREEMENT_RE = /\b(?:with\s+(?:all\s+)?respect|respectfully|if\s+i\s+may|may\s+i|i'?d?\s+gently|i\s+would\s+gently|allow\s+me\s+to|with\s+due\s+respect)\b[\s\S]{0,80}\b(?:disagree|push(?:ed)?\s+back|differ|challenge|question|raise(?:d)?\s+a\s+concern|suggest(?:ed)?\s+otherwise|propose(?:d)?\s+(?:a\s+)?different|offer(?:ed)?\s+(?:a\s+)?counter|present(?:ed)?\s+(?:an?\s+)?alternative)\b/i;

/* Indirect failure framing — "there were challenges/issues/hiccups"
   or "the X had some/a few Y" structure. Conservative: requires both
   the hedge ("some/a few/certain") AND a problem-word ("challenge,
   issue, hiccup, gap, setback, slowdown"). Bare "there were issues"
   without the hedge is closer to direct American framing. */
const INDIRECT_FAILURE_RE = /\bthere\s+were\s+(?:some|a\s+few|certain|several|a\s+couple\s+of)\s+(?:challenges|issues|hiccups|gaps|setbacks|slowdowns|complications|misalignments)\b|\b(?:the|our)\s+(?:rollout|launch|project|migration|delivery|release|sprint)\s+(?:had|ran\s+into|hit)\s+(?:some|a\s+few|certain|its\s+share\s+of|a\s+couple\s+of)\s+(?:challenges|issues|hiccups|bumps|gaps)\b|\bthings\s+(?:didn'?t|did\s+not)\s+(?:quite|fully|entirely)\s+(?:go|land|work)\b/i;

/* Relational framing — outcome markers that describe trust,
   alignment, harmony, or relationship preservation as the result.
   These are legitimate behavioural results, not filler. */
const RELATIONAL_FRAMING_RE = /\b(?:kept|maintained|preserved|built|earned|restored|strengthened|deepened)\s+(?:the\s+|our\s+|team'?s?\s+|stakeholder'?s?\s+)?(?:trust|alignment|harmony|relationship|rapport|confidence|credibility|goodwill|buy[\s-]?in)\b|\b(?:kept|got|held|brought)\s+(?:the\s+team|everyone|the\s+group|stakeholders?|the\s+room)\s+(?:aligned|together|engaged|in\s+(?:the\s+)?loop|on\s+the\s+same\s+page)\b|\bteam\s+stayed\s+(?:aligned|together|cohesive|engaged)\b|\bno\s+one\s+(?:lost\s+face|felt\s+blindsided|was\s+left\s+behind)\b|\bbrought\s+(?:everyone|the\s+team|stakeholders)\s+along\b/i;

/* Calendar anchoring — Indian festival / fiscal-calendar references.
   These ground the Situation in real operational pressure, NOT
   anecdotal filler. Conservative: only well-known anchors. */
/* "christmas" intentionally NOT in the festival list — universally
   celebrated, fires on "merry christmas, sir" politeness instead of
   the operational-pressure framing we actually want to detect. */
const CALENDAR_ANCHOR_RE = /\b(?:diwali|holi|navratri|dussehra|onam|pongal|sankranti|raksha\s+bandhan|janmashtami|ganesh\s+chaturthi|durga\s+puja|eid|karva\s+chauth|baisakhi|lohri)\b|\b(?:big\s+billion\s+days?|bbd|big\s+saving\s+days?|bsd|monsoon\s+sale|republic\s+day\s+sale|independence\s+day\s+sale|end\s+of\s+season\s+sale|eoss)\b|\b(?:quarter[\s-]?end|year[\s-]?end|q[1-4]\s+close|fy\s+close|financial\s+year\s+end|march\s+31|march\s+closing|fy\s*\d{2,4}\s+close)\b/i;

/* Deferential gratitude — explicit thank-you / appreciation aimed at
   the interviewer. Indian-context professional courtesy. Conservative:
   requires a gratitude marker within 60 chars of an interviewer-direction
   token ("for this opportunity" / "for taking the time" / "sir" / "ma'am"
   / "for having me"). Bare "thanks" inside a STAR Action doesn't qualify
   ("I thanked the team and moved on" must NOT fire). Also matches the
   "it's an honour / privilege to..." opener. */
const DEFERENTIAL_GRATITUDE_RE = /\b(?:thank\s+you(?:\s+(?:so\s+much|very\s+much|very\s+kindly))?|thanks\s+(?:a\s+lot|so\s+much|very\s+much)|i\s+(?:really\s+|truly\s+|sincerely\s+)?appreciate(?:\s+you)?|i'?m\s+(?:really\s+|truly\s+)?grateful|i'?d\s+like\s+to\s+thank\s+you)\b[\s\S]{0,60}\b(?:(?:for\s+)?(?:this\s+opportunity|having\s+me|taking\s+(?:the\s+)?time|the\s+(?:chance|opportunity))|sir|ma'?am|for\s+(?:your|the)\s+time)\b|\bit'?s\s+(?:an\s+|a\s+real\s+)?(?:honour|honor|privilege)\s+to\s+(?:be\s+here|interview|speak\s+with\s+you)\b/i;

/* Pedigree recital — voluntary mention of 10th/12th board percentages
   or CGPA. Strict shape: "<verb> <number>% in 10th/12th/boards" OR
   "10th/12th marks were <number>" OR "CGPA <number>" / "<number> CGPA".
   "I scored well in school" doesn't qualify; "I got 92% in 10th" does. */
const PEDIGREE_RECITAL_RE = /\b(?:scored|got|secured|achieved|attained)\s+(?:about\s+|around\s+|nearly\s+)?\d{2,3}(?:\.\d+)?\s*(?:%|percent|percentage)\s+in\s+(?:my\s+)?(?:10th|12th|tenth|twelfth|class\s+(?:10|12|x|xii)|board(?:s)?|hsc|ssc|cbse|icse)\b|\b(?:my\s+)?(?:10th|12th|tenth|twelfth|class\s+(?:10|12|x|xii)|board(?:s)?|hsc|ssc)\s+(?:marks|percentage|score|result)s?\s+(?:was|were)\s+\d{2,3}(?:\.\d+)?\s*(?:%|percent)?\b|\bcgpa\s+(?:of\s+|was\s+|is\s+)?\d(?:\.\d+)?(?:\s*\/\s*10)?\b|\b\d(?:\.\d+)?\s*cgpa\b/i;

export function detectCulturalRegister(text: string): CulturalRegister {
  const t = text || "";
  return {
    hedgedDisagreement: HEDGED_DISAGREEMENT_RE.test(t),
    indirectFailureFraming: INDIRECT_FAILURE_RE.test(t),
    relationalFraming: RELATIONAL_FRAMING_RE.test(t),
    calendarAnchored: CALENDAR_ANCHOR_RE.test(t),
    deferentialGratitude: DEFERENTIAL_GRATITUDE_RE.test(t),
    pedigreeRecital: PEDIGREE_RECITAL_RE.test(t),
  };
}

/** Convenience: did the candidate use ANY Indian-register marker on
 *  this answer? Used by the follow-up handler to softly opt-in the
 *  conversational-register block ("the candidate is in Indian
 *  register; mirror it lightly") instead of forcing it on every
 *  behavioural turn. */
export function hasAnyIndianRegister(reg: CulturalRegister): boolean {
  return reg.hedgedDisagreement
    || reg.indirectFailureFraming
    || reg.relationalFraming
    || reg.calendarAnchored
    || reg.deferentialGratitude
    || reg.pedigreeRecital;
}
