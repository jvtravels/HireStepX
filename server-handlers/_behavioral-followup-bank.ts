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
  | "conflict.how-communicated";

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

/** Map the engine's `starGap` value + `weHeavy` boolean to a probe cue.
 *  Returns null when neither signal warrants a deterministic probe. */
export function cueFromEngineHints(opts: {
  starGap?: "action" | "result" | "situation-task";
  weHeavy?: boolean;
  questionText?: string;
}): BehavioralProbeCue | null {
  // Conflict / disagreement questions get conflict-specific probes
  // BEFORE the STAR-gap probes, because the conflict deepener is what
  // distinguishes a strong conflict answer from a generic one.
  if (opts.questionText && /\b(disagree|conflict|pushed back|push back|tough feedback|rejected)\b/i.test(opts.questionText)) {
    return "conflict.disagreement";
  }
  if (opts.weHeavy) return "we-heavy";
  if (opts.starGap === "action") return "star.action";
  if (opts.starGap === "result") return "star.result";
  if (opts.starGap === "situation-task") return "star.situation-task";
  return null;
}

/** The 15 probes as a plain list — useful for prompt injection into
 *  the evaluator's `likelyFollowUp` field so the report's "next
 *  question" suggestion picks from a real-interviewer menu. */
export const PROBE_TEXTS: ReadonlyArray<string> = BEHAVIORAL_PROBES.map(p => p.text);
