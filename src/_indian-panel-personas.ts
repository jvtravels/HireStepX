/* HireStepX — Indian behavioural-panel personas
 *
 * Real Indian behavioural loops aren't a single interviewer monolog —
 * they rotate across 3 distinct personas, and the candidate has to
 * shift register for each one:
 *
 *   1. HR Partner — Indian HR leans relational and culture-fit. They
 *      probe "why this company", "notice period", "family relocation",
 *      "any pending offers", "salary expectations". They tolerate (and
 *      expect) deferential gratitude markers ("thank you so much for
 *      this opportunity, sir / ma'am"). Hinglish softeners are
 *      common. Their bar is "does this person fit, will they stay,
 *      will they accept the offer." STAR depth matters less here than
 *      authenticity.
 *
 *   2. Hiring Manager — the role's direct supervisor. Probes
 *      ownership, stakeholder management, conflict resolution, the
 *      "tell me about a time you disagreed with your manager" cluster.
 *      Indian HMs frequently apply the services-track lens — "what was
 *      the client / onsite / offshore split", "how did you handle a
 *      manager from a different geography". STAR Action depth matters
 *      a lot here; "we" without an "I" gets re-probed.
 *
 *   3. Technical Lead — peer-level interviewer who probes the
 *      technical narrative behind a behavioural Situation. "Walk me
 *      through the technical decision YOU made on that project."
 *      Indian tech leads (esp. at services + GCC) probe the architectural
 *      sliver. They DO NOT score deferential gratitude as a positive —
 *      they want STAR Action specificity. Mirror the candidate's
 *      pronoun choice but push for the individual contribution.
 *
 * Each persona carries:
 *   - a `register` profile (which Indian-register markers they reward
 *     vs. neutrally accept vs. softly redirect)
 *   - a `probeStyle` string injected into the live-coach prompt so the
 *     follow-up question matches the persona's voice
 *   - a `scoringEmphasis` line so the post-session report knows what
 *     this turn was really probing for
 *
 * Pure constant module — no runtime side-effects, no I/O. Safe to
 * import from server-handlers (Edge runtime) and src/ alike.
 */

export type PanelPersonaId = "hr-partner" | "hiring-manager" | "tech-lead";

export interface PanelPersona {
  id: PanelPersonaId;
  displayName: string;
  /** One-line voice instruction the live coach uses to colour the
   *  follow-up reply. Already pre-tuned for Indian-loop register. */
  probeStyle: string;
  /** Which Indian cultural-register markers this persona REWARDS
   *  (treats as positive signal), TOLERATES (no penalty), or
   *  REDIRECTS (gently steer toward depth). Used by the live coach to
   *  decide whether to mirror, ignore, or pivot. */
  registerRewards: ReadonlyArray<string>;
  registerTolerates: ReadonlyArray<string>;
  registerRedirects: ReadonlyArray<string>;
  /** What the post-session report should weight on this turn. Single
   *  line for prompt-injection. */
  scoringEmphasis: string;
  /** 2-3 signature Indian-English softeners that give this persona a
   *  distinct *voice* in intro / interstitial / acknowledgement turns.
   *  Hard rule: NEVER injected inside a question stem — the
   *  BEHAVIOURAL-INDIAN-REGISTER rule bans softeners in stems globally.
   *  This field is additive: it tells the LLM which 1-2 of these to
   *  sprinkle so HR Partner doesn't sound interchangeable with Tech
   *  Lead. */
  softenerPhrases: ReadonlyArray<string>;
}

const PERSONAS: Record<PanelPersonaId, PanelPersona> = {
  "hr-partner": {
    id: "hr-partner",
    displayName: "HR Partner",
    probeStyle:
      "You are the Indian HR Partner. Your voice is warm, relational, lightly formal. You probe culture-fit, stay-intent, notice-period, family-relocation, competing offers, and 'why this company'. Deferential gratitude ('thank you for this opportunity', 'sir' / 'ma'am') from the candidate is EXPECTED and NORMAL — do NOT score it as low confidence. Reward authenticity over STAR depth. Hinglish softeners ('na', 'haina', 'yaar') are in bounds if the candidate already used them. Do NOT probe architecture, code, or technical trade-offs — that's the Tech Lead's lane.",
    registerRewards: ["deferentialGratitude", "relationalFraming"],
    registerTolerates: ["hedgedDisagreement", "indirectFailureFraming", "calendarAnchored", "pedigreeRecital", "careerLadderNarrative"],
    registerRedirects: [],
    scoringEmphasis:
      "Score this turn on: motivation authenticity, stay-intent credibility, cultural fit signal, deal-closeability. STAR Action depth is secondary here — pedigree / family / relocation framing is legitimate primary signal in an Indian HR turn.",
    // HR Partner — warm, relational, Delhi-ish register
    softenerPhrases: ["right?", "yes please", "ya"],
  },
  "hiring-manager": {
    id: "hiring-manager",
    displayName: "Hiring Manager",
    probeStyle:
      "You are the Indian Hiring Manager — the direct supervisor for this role. Your voice is collegial, outcome-focused, willing to push back. You probe ownership, stakeholder management, manager-conflict, and the services-track angle ('onsite / offshore split', 'client-facing cadence', 'how did you handle a manager in a different geography'). Hedged disagreement ('with respect, I'd push back') is STRONG conviction in your eyes — reward it. Indirect failure framing ('there were some challenges') is legitimate ownership in this register — do NOT probe it as deflection. But 'we' without an 'I' gets ONE re-probe for the individual contribution.",
    registerRewards: ["hedgedDisagreement", "indirectFailureFraming", "careerLadderNarrative"],
    registerTolerates: ["relationalFraming", "calendarAnchored", "deferentialGratitude"],
    registerRedirects: ["pedigreeRecital"], // HM doesn't care about board %
    scoringEmphasis:
      "Score this turn on: STAR Action depth, individual ownership clarity, stakeholder-management craft, services-track context awareness. Career-ladder narrative defending short stints is LEGITIMATE — credit smart sequencing, do NOT probe as instability.",
    // Hiring Manager — collegial PM register, Bangalore-ish
    softenerPhrases: ["actually", "just briefly", "so"],
  },
  "tech-lead": {
    id: "tech-lead",
    displayName: "Technical Lead",
    probeStyle:
      "You are the Indian Technical Lead — peer-level interviewer probing the technical sliver behind a behavioural Situation. Your voice is precise, curious, and uninterested in fluff. You probe: 'what was the actual technical decision YOU made', 'what was the architectural trade-off', 'what would you do differently'. Deferential gratitude is neutral — don't reward, don't penalise. STAR Action specificity is what you're hunting. If the candidate stays in 'we' voice, re-probe ONCE for the individual technical contribution. Calendar anchors (BBD, EOSS, Diwali freeze) ground the Situation usefully — credit them.",
    registerRewards: ["calendarAnchored", "careerLadderNarrative"],
    registerTolerates: ["hedgedDisagreement", "indirectFailureFraming", "relationalFraming"],
    registerRedirects: ["deferentialGratitude", "pedigreeRecital"], // TL wants STAR Action not pedigree
    scoringEmphasis:
      "Score this turn on: STAR Action technical specificity, individual ownership of the technical decision, trade-off awareness, blast-radius reasoning. Deferential gratitude is neutral on this turn — neither credit nor penalty.",
    // Tech Lead — more formal, precise, senior register
    softenerPhrases: ["I see", "got it", "tell me one thing"],
  },
};

/** All three personas, in canonical rotation order: HR → HM → TL → HM →
 *  HR (so HR opens the warmup, TL gets the deep-tech middle, HR closes
 *  on stay-intent). Match this with the 5-question behavioural script. */
export const PANEL_ROTATION: ReadonlyArray<PanelPersonaId> = [
  "hr-partner",
  "hiring-manager",
  "tech-lead",
  "hiring-manager",
  "hr-partner",
];

/** Lookup a persona by id. Returns null on unrecognised input —
 *  callers should fall through to the neutral single-interviewer
 *  register in that case. */
export function getPanelPersona(id: string | null | undefined): PanelPersona | null {
  if (!id) return null;
  const norm = id.toLowerCase().trim();
  // Accept both canonical ids ("hr-partner") and display strings
  // ("HR Partner") so callers don't have to normalise.
  const map: Record<string, PanelPersonaId> = {
    "hr-partner": "hr-partner",
    "hr partner": "hr-partner",
    "hiring-manager": "hiring-manager",
    "hiring manager": "hiring-manager",
    "tech-lead": "tech-lead",
    "tech lead": "tech-lead",
    "technical lead": "tech-lead",
  };
  const key = map[norm];
  return key ? PERSONAS[key] : null;
}

/** Build a prompt fragment the follow-up handler can inject when a
 *  behavioural turn is running under a panel persona. Combines the
 *  persona's probeStyle, register policy, and scoring emphasis into
 *  ONE coherent block so the LLM doesn't have to reconcile three
 *  separate directives. */
export function panelPersonaPromptFragment(persona: PanelPersona): string {
  const rewardsLine = persona.registerRewards.length
    ? `Reward as positive signal: ${persona.registerRewards.join(", ")}.`
    : "";
  const redirectsLine = persona.registerRedirects.length
    ? `Softly redirect (don't punish): ${persona.registerRedirects.join(", ")} — pivot to what this persona actually probes.`
    : "";
  const softenerLine = persona.softenerPhrases.length
    ? `Signature softeners (use sparingly — 1-2 across the whole session, ONLY in intro / interstitial / acknowledgement turns, NEVER inside a question stem): ${persona.softenerPhrases.map((p) => `"${p}"`).join(", ")}.`
    : "";
  return [
    `INDIAN-PANEL PERSONA — ${persona.displayName}.`,
    persona.probeStyle,
    rewardsLine,
    redirectsLine,
    softenerLine,
    persona.scoringEmphasis,
  ].filter(Boolean).join(" ");
}
