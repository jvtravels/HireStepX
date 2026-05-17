/* HireStepX — Canonical behavioural follow-up probe bank (the 15)
 *
 * Real interviewers don't free-form their follow-ups — they ask from
 * a remarkably stable bank of ~15 probes. The phrasing is consistent
 * enough that candidates who've done 5+ loops recognise the exact
 * questions across companies.
 *
 * Today the follow-up coach (server-handlers/follow-up.ts) LLM-
 * generates the probe text. That's fine but it produces drift — same
 * STAR gap can surface five different phrasings across sessions. This
 * file provides a deterministic preferred-phrasing menu that the
 * coach injects as a "pick from these unless context demands otherwise"
 * hint. Net effect: probes feel like a real human interviewer,
 * candidates start recognising the pattern, and the system gets
 * cheaper / faster on common gaps.
 *
 * Each probe is tagged with the STAR gap or behavioural-cue it
 * addresses, so the coach can pick the right probe deterministically
 * before falling back to LLM generation.
 *
 * Pure constant + tiny picker — no runtime side-effects, safe to
 * import from Edge handlers.
 */

/** Behavioural probe categories. Maps the cue the coach detects to a
 *  preferred phrasing. `star.*` rows align with `starGap` values the
 *  engine already passes. `closer.*` rows are universal deepeners. */
export type BehavioralProbeCue =
  /* STAR gaps (mirror the `starGap` values the engine emits) */
  | "star.action"
  | "star.result"
  | "star.situation-task"
  /* Pronoun / individual-contribution probe (`weHeavy === true`) */
  | "we-heavy"
  /* Universal closers — fire when STAR is satisfied but the answer
     hasn't yet earned `strong` because it lacks reflection. */
  | "closer.learning"
  | "closer.would-do-differently"
  | "closer.feedback-received"
  /* Conflict / disagreement-specific deepeners (fires when the
     question itself was about disagreement / pushback / conflict). */
  | "conflict.disagreement"
  | "conflict.team-reaction"
  | "conflict.how-communicated"
  /* Pushback probes — stress-test the *reasoning* behind the Action by
     pushing back the way a real interviewer would. Distinguishes
     candidates who defended their call from those who got lucky. */
  | "pushback.alternative"
  | "pushback.risk"
  | "pushback.assumption"
  | "pushback.if-wrong"
  /* Emotion probes — vulnerability / resilience signal. Used on
     failure / conflict / setback questions to surface the human side. */
  | "emotion.feel"
  | "emotion.hardest"
  | "emotion.regret"
  /* Lift A — answer-analysis signals beyond starGap / weHeavy. These
     fire deterministically from cheap regex detectors on the answer text
     (see _behavioural-answer-signals.ts). */
  | "defensiveness.own-it"
  | "crispness.too-thin"
  | "vagueness.quantify"
  /* Competency deepeners for the two competencies split out in 2026-05.
     These fire when the QUESTION itself is on-topic (regex below) — they
     replace generic STAR coaching with probe phrasing a real interviewer
     uses for adaptability / execution-rigor specifically. */
  | "adaptability.what-changed"
  | "adaptability.learning-speed"
  | "adaptability.tradeoff"
  | "execution-rigor.where-missed"
  | "execution-rigor.process-change"
  | "execution-rigor.tradeoff-defense";

export interface BehavioralProbe {
  cue: BehavioralProbeCue;
  /** The probe text as a real interviewer would say it. Short, direct,
   *  no filler. Use the AI persona to colour delivery on top — these
   *  strings carry the substance, not the prosody. */
  text: string;
  /** What this probe is hunting for — fed into the coach prompt as
   *  the "why" line so the LLM-rendered version (if it adapts the
   *  phrasing) still preserves intent. */
  intent: string;
}

/** The 15 canonical probes, indexed by the cue they answer. Some cues
 *  carry multiple variants so the same gap doesn't get the same
 *  phrasing twice in a session — `pickBehavioralProbe` rotates. */
export const BEHAVIORAL_PROBES: ReadonlyArray<BehavioralProbe> = [
  { cue: "star.action",           text: "What exactly was your role?",                                  intent: "Surface the individual Action — separate the candidate's slice from the team's." },
  { cue: "star.action",           text: "What did you personally own?",                                 intent: "Force first-person ownership clarity after a 'we' answer." },
  { cue: "star.action",           text: "Why did you choose that approach?",                            intent: "Probe the reasoning behind the Action — generic answers can name the move but not the why." },
  { cue: "star.action",           text: "What alternatives did you consider?",                          intent: "Trade-off awareness — strong answers can name 2-3 alternatives and why they lost." },
  { cue: "star.result",           text: "What was the final outcome?",                                  intent: "Surface a Result the answer omitted." },
  { cue: "star.result",           text: "What was the measurable impact?",                              intent: "Push for quantification when the Result was qualitative." },
  { cue: "star.situation-task",   text: "What was the hardest part?",                                   intent: "Unpack the Situation/Task when the candidate skipped to the Action — exposes scope." },
  { cue: "star.situation-task",   text: "Who else was involved?",                                       intent: "Map the stakeholder graph behind the Situation." },
  { cue: "we-heavy",              text: "What did you personally own?",                                 intent: "Re-probe for individual contribution after persistent 'we' framing." },
  { cue: "closer.learning",       text: "What did you learn?",                                          intent: "Reflection beat — strong answers self-critique without prompting." },
  { cue: "closer.would-do-differently", text: "What would you do differently now?",                     intent: "Hindsight + growth signal — generic 'communicate more' is a weak answer." },
  { cue: "closer.feedback-received", text: "What feedback did you receive?",                            intent: "External validation signal — did the manager / team agree the outcome was good?" },
  { cue: "conflict.disagreement", text: "How did you handle the disagreement?",                         intent: "On conflict questions specifically — surface the de-escalation move." },
  { cue: "conflict.team-reaction", text: "How did the team react?",                                     intent: "Social-impact lens on conflict answers — was the outcome trusted?" },
  { cue: "conflict.how-communicated", text: "How did you communicate it?",                              intent: "Communication craft on conflict / bad-news / pushback answers." },
  { cue: "pushback.alternative",  text: "Couldn't you have just done it the simpler way — keep the old flow and skip the migration?", intent: "Stress-test the *reasoning* behind the chosen Action by proposing a plausible-sounding alternative the candidate didn't take. Real interviewers do this to separate someone who *defended* their call from someone who *got lucky*. Phrasing should be specific to the answer when context allows — this is the canonical scaffold." },
  { cue: "pushback.alternative",  text: "Why not just throw more people at it?",                        intent: "Naive-fix pushback — tests whether candidate thought about cost / second-order effects." },
  { cue: "pushback.risk",         text: "Looking at it now — that sounds pretty risky. What gave you confidence it would work?", intent: "Surface the risk-management reasoning. Strong answers articulate the explicit risk-checks; weak answers say 'we just had to ship'." },
  { cue: "pushback.assumption",   text: "What if the assumption you were making turned out to be wrong?", intent: "Counterfactual probe — tests whether the candidate understood what was *assumed* vs *known*." },
  { cue: "pushback.if-wrong",     text: "If you ran into this situation again next week — same constraints — would you actually do anything differently?", intent: "Hindsight probe that's NOT 'what would you do differently' (which we already have as a closer). This one forces a yes/no on whether the experience updated the candidate's playbook." },
  { cue: "emotion.feel",          text: "How did that actually feel in the moment?",                    intent: "Vulnerability probe. Used on failure / conflict / setback questions. Strong answers acknowledge emotion without melodrama; weak answers either gloss over ('it was fine') or wallow." },
  { cue: "emotion.hardest",       text: "What was the hardest part of it for you personally?",          intent: "Emotional difficulty, not logistical. Tests whether the candidate can name the human cost of the story — usually surfaces what they actually learned." },
  { cue: "emotion.regret",        text: "Is there anything about it you still think about?",            intent: "Soft probe for residual self-critique on failure questions. Strong answers name something specific; weak answers say 'no, we did the best we could'." },
  { cue: "defensiveness.own-it",  text: "Setting aside everyone else for a moment — what's the piece you'd own?", intent: "Redirect deflection on a failure / mistake question back to first-person accountability. Fires when the answer leans on 'wasn't my call' / 'out of my control' / 'they didn't' style framing." },
  { cue: "crispness.too-thin",    text: "Can you give me a bit more — set the scene first.",             intent: "Thin answer (< 40 words) — re-elicit Situation / Task before the coach probes deeper." },
  { cue: "vagueness.quantify",    text: "Roughly what numbers are we talking about?",                    intent: "Push a scale-word answer ('many users', 'several teams') to a quantified one. Fires when the answer uses vague magnitudes with no digits present." },
  /* adaptability — context-switching, learning velocity, what they
     gave up. Real interviewers grade on the *cost* of the adaptation,
     not just that it happened. */
  { cue: "adaptability.what-changed",   text: "What specifically did you have to change about how you worked?",       intent: "Surface the concrete delta — strong answers name a habit or process they rebuilt; weak answers say 'I adjusted'." },
  { cue: "adaptability.learning-speed", text: "How long did it take you to get productive again?",                    intent: "Velocity probe — separates candidates who time-boxed their own learning from those who waited to be productive." },
  { cue: "adaptability.tradeoff",       text: "What did you have to deprioritise to make room for it?",               intent: "Cost-of-change probe — strong answers name what they explicitly cut; weak answers claim 'nothing, I just worked harder'." },
  /* execution-rigor — self-QA, where in the process the miss lived,
     what they built so it wouldn't repeat. Differs from ownership: the
     miss is the *focus*, not just the trigger. */
  { cue: "execution-rigor.where-missed",     text: "Where in your process did the detail slip?",                       intent: "Force a specific failure point — design, review, testing, handoff — instead of generic 'I should have checked'." },
  { cue: "execution-rigor.process-change",   text: "What did you put in place so it wouldn't happen again?",           intent: "Systems-thinking probe — strong answers describe a checklist / lint / gate they added; weak answers say 'I'm more careful now'." },
  { cue: "execution-rigor.tradeoff-defense", text: "If you had the same time pressure again, would you cut the same corner?", intent: "Hindsight + integrity probe — tests whether the candidate can defend a deliberate trade-off vs only confessing in hindsight." },
];

/** Lightweight rotation state — caller passes the set of probes
 *  already asked this session to avoid repeating phrasings. */
export interface PickProbeOpts {
  cue: BehavioralProbeCue;
  /** Probe TEXTS already used in this session — checked verbatim so
   *  the same wording can't repeat. */
  alreadyAsked?: ReadonlyArray<string>;
}

/** Pick a deterministic probe for a given cue, skipping already-asked
 *  phrasings. Returns `null` when no canonical probe exists for the
 *  cue — caller should fall back to LLM generation. */
export function pickBehavioralProbe(opts: PickProbeOpts): BehavioralProbe | null {
  const candidates = BEHAVIORAL_PROBES.filter(p => p.cue === opts.cue);
  if (candidates.length === 0) return null;
  const already = new Set((opts.alreadyAsked || []).map(s => s.trim().toLowerCase()));
  const fresh = candidates.filter(c => !already.has(c.text.trim().toLowerCase()));
  return (fresh[0] || candidates[0]) ?? null;
}

/** Build the prompt fragment the live coach can inject when it has a
 *  detected cue. Tells the LLM: "Prefer this phrasing unless context
 *  forces an adaptation." Keeps the bank as a soft constraint rather
 *  than a hard substitution so contextual probes (referencing the
 *  candidate's specific project / number / phrase) can still win. */
export function probePromptFragment(probe: BehavioralProbe): string {
  return `PREFERRED PHRASING for this gap (from the canonical behavioural-probe bank — match this phrasing unless the candidate's specific answer forces a more contextual variant): "${probe.text}". Intent: ${probe.intent}`;
}

/** Map the engine's `starGap` value + `weHeavy` boolean (+ Lift A
 *  answer-analysis signals) to a probe cue. Returns null when no signal
 *  warrants a deterministic probe.
 *
 *  Precedence (high → low):
 *   1. defensiveness on a failure question — own-it redirect comes first
 *      because deflection is the single most disqualifying behaviour on
 *      a failure prompt; getting STAR shape right after a dodge is moot.
 *   2. conflict cue on conflict-shaped questions — the conflict deepener
 *      is what separates strong conflict answers from generic STAR.
 *   3. crispness === "thin" — re-elicit Situation/Task on stub answers
 *      before any deeper probe; otherwise the coach probes air.
 *   4. weHeavy — pronoun-attribution clarification.
 *   5. starGap (action / result / situation-task).
 *   6. vagueness — only fires when weHeavy and starGap are clean; on a
 *      structurally-fine answer the remaining gap is quantification.
 *
 *  `selfAwarenessShown` doesn't return a cue — it suppresses the
 *  `closer.would-do-differently` probe (caller checks
 *  `shouldSuppressCue`).
 */
export function cueFromEngineHints(opts: {
  starGap?: "action" | "result" | "situation-task";
  weHeavy?: boolean;
  questionText?: string;
  /* Lift A — answer-analysis signals (optional; default off so existing
     callers continue to work). */
  vagueness?: boolean;
  crispness?: "thin" | "ok" | "rambling";
  selfAwarenessShown?: boolean;
  defensiveness?: boolean;
}): BehavioralProbeCue | null {
  const questionAboutFailure = !!opts.questionText && /\b(fail|mistake|wrong|missed|didn't go well|setback|regret)\b/i.test(opts.questionText);
  // 1. Defensiveness on a failure question — own-it redirect first.
  if (opts.defensiveness && questionAboutFailure) {
    return "defensiveness.own-it";
  }
  // 2. Conflict / disagreement questions get conflict-specific probes
  // BEFORE the STAR-gap probes, because the conflict deepener is what
  // distinguishes a strong conflict answer from a generic one.
  if (opts.questionText && /\b(disagree|conflict|pushed back|push back|tough feedback|rejected)\b/i.test(opts.questionText)) {
    return "conflict.disagreement";
  }
  // 2b. Adaptability / execution-rigor competency deepeners — same
  // precedence-band as conflict: when the question is on-topic, the
  // competency-specific probe beats the generic STAR gap. Mirrors how
  // a real interviewer doesn't follow up "tell me about adapting" with
  // "what did you do?" — they follow up with "what did you have to
  // change about how you worked?".
  if (opts.questionText && /\b(adapt|adapted|adapting|major change|switch context|learn(?:ed|ing)? (?:a )?(?:new|quickly)|new (?:skill|tool|stack))\b/i.test(opts.questionText)) {
    return "adaptability.what-changed";
  }
  if (opts.questionText && /\b(caught a bug|missed detail|missed (?:a )?detail|came back to bite|thoroughness|cut(?: a)? corner|traded (?:thoroughness|rigor)|defend the call)\b/i.test(opts.questionText)) {
    return "execution-rigor.where-missed";
  }
  // 3. Thin answer — need more substance before any deeper probe.
  if (opts.crispness === "thin") return "crispness.too-thin";
  // 4. Pronoun-attribution.
  if (opts.weHeavy) return "we-heavy";
  // 5. STAR gaps.
  if (opts.starGap === "action") return "star.action";
  if (opts.starGap === "result") return "star.result";
  if (opts.starGap === "situation-task") return "star.situation-task";
  // 6. Vagueness — fires only on otherwise-clean answers (no weHeavy /
  //    starGap). On a structurally-fine answer the remaining gap is
  //    scale; on a structurally-broken one, fix the structure first.
  if (opts.vagueness && !opts.weHeavy && !opts.starGap) return "vagueness.quantify";
  return null;
}

/** Should a specific cue be SUPPRESSED given the answer-analysis signals?
 *  Used for the self-awareness rule: when a candidate has already
 *  self-critiqued without being asked, asking "what would you do
 *  differently?" reads as not-listening — they just told you.
 *
 *  Callers (the follow-up coach) consult this AFTER picking a cue from
 *  their own logic (e.g. a closer chosen because STAR was complete) —
 *  if suppressed, fall back to a different closer or to LLM generation. */
export function shouldSuppressCue(
  cue: BehavioralProbeCue,
  signals: { selfAwarenessShown?: boolean },
): boolean {
  if (cue === "closer.would-do-differently" && signals.selfAwarenessShown) {
    return true;
  }
  return false;
}

/** The 15 probes as a plain list — useful for prompt injection into
 *  the evaluator's `likelyFollowUp` field so the report's "next
 *  question" suggestion picks from a real-interviewer menu. */
export const PROBE_TEXTS: ReadonlyArray<string> = BEHAVIORAL_PROBES.map(p => p.text);
