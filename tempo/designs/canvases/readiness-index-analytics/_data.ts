/* HireStepX — Readiness Index analytics / data layer
   ───────────────────────────────────────────────────────────────
   Types + fixtures, grounded in the real report_json (mvp-9) shape,
   the sessions table, and the negotiation kernel. No JSX here so the
   fixtures stay unit-testable and the section components stay pure-view.

   Every field maps to a computed path. New-this-pass additions and
   their sources:
     • Pillar.trend          ← readiness_snapshots over time (per pillar)
     • Pillar.drivers/hold/fix ← the metrics feeding each pillar
     • cohort / baseline      ← calibration.bands · first snapshot
     • percentile             ← adapter.percentile
     • snapshots[]            ← readiness_snapshots (session-over-session diff)
     • *.quote evidence       ← perQuestion[].quote · redFlags[].quote
     • attention[]            ← report_json.thoughtBubble[]
     • followUps[]            ← perQuestion[].likelyFollowUp
     • coaching               ← report_json.coaching{strength,gap}
     • meter comfort bands    ← coreMetrics / advancedDelivery target ranges */

export type Variant = "ready" | "building" | "drilldown" | "mobile";
export type Band = "ready" | "almost" | "building" | "early";
export type HireBand = "strongHire" | "hire" | "leanHire" | "noHire" | "strongNoHire";
export type Tone = "good" | "watch" | "miss" | "neutral";
export type RangeKey = "4w" | "12w" | "all";

/* A metric's comfort band, so any raw number can render itself legible:
   scale [min,max], comfortable zone [lo,hi], and whether lower is better. */
export interface Meter { min: number; max: number; lo: number; hi: number; value: number; lowerBetter?: boolean }

export interface PillarDriver { label: string; value: string; tone: Tone; hint: string; meter?: Meter }
export interface Pillar {
  key: "competence" | "consistency" | "coverage" | "currency" | "composure";
  label: string;
  score: number;
  delta: number;
  blurb: string;
  weight: number;
  trend: number[];
  drivers: PillarDriver[];
  hold: string;
  fix: string;
}
export interface Skill { name: string; score: number; delta: number; percentile: number }
export interface Target { role: string; company: string; round: string; date: string }

export interface RegisterSignal { key: string; label: string; ratePct: number; tone: "asset" | "watch"; note: string }
export interface FocusRollup { type: string; sessions: number; metrics: { label: string; value: string; tone: Tone }[] }
export interface CrossInsight { kind: "improvement" | "regression" | "persistent"; metric: string; delta?: number; text: string }
export interface TypedFlag { type: string; severity: "high" | "medium" | "low"; title: string; hits: number; of: number; quote: string }
export interface BlindSpot { competency: string; frequencyPct: number; note: string }
export interface WeakAnswer { question: string; verdict: string; quote: string; fix: string }
export interface Attention { atPct: number; state: "tracking" | "losingThread" | "probingForScope" | "readyToMoveOn" | "impressed" | "concerned"; note: string }
export interface FollowUp { question: string; why: string; freqPct: number }
export interface Snapshot { id: string; label: string; ri: number; pillars: number[] }

export interface Fixture {
  ri: number;
  band: Band;
  confidence: number;
  threshold: number;
  delta14d: number;
  sessions: number;
  percentile: number;
  hireBand: HireBand;
  bandMix: { band: HireBand; n: number }[];
  cohort: { label: string; ri: number };
  baseline: { ri: number; label: string };
  target: Target;
  pillars: Pillar[];
  pillarLabels: string[];
  snapshots: Snapshot[];
  skills: Skill[];
  scoreSpread: { min: number; max: number; sigma: number };
  coverage: { focusDone: number; focusTotal: number; star: { S: boolean; T: boolean; A: boolean; R: boolean; L: boolean }; commonPct: number };
  blindSpots: BlindSpot[];
  composure: {
    fillerPerMin: number; paceWpm: number; silenceRatio: number;
    hedgingPerMin: number; medianLatencyMs: number; energy: number;
    firstPersonRatio: number; lexicalDiversity: number; selfCorrectionRate: number;
  };
  cultural: RegisterSignal[];
  answerCraft: {
    verdictMix: { label: string; n: number; tone: Tone }[];
    lengthMix: { tooBrief: number; right: number; tooLong: number };
    quantifiedPct: number;
    ownershipPct: number;
    weakAnswers: WeakAnswer[];
  };
  focusMetrics: FocusRollup[];
  trajectory: number[];
  projection: { sessions: number; hours: number; targetRi: number };
  refresh: { skill: string; days: number; decay: number }[];
  crossSession: CrossInsight[];
  storyReuse: { label: string; count: number; concern: string }[];
  redFlags: TypedFlag[];
  reverse: { green: number; yellow: number; red: number; verdict: string };
  resume: { score: number; trend: number[]; rationale: string };
  attention: Attention[];
  followUps: FollowUp[];
  coaching: { strength: { headline: string; meaning: string }; gap: { headline: string; meaning: string; example: string } };
  negotiation: {
    score: number; outcome: string; anchorTurn: number; lpaGained: number;
    bandTraversalPct: number; leverDiversity: number; archetype: string;
  };
  cadence: {
    heat: number[]; weeks: number;
    typeMix: { type: string; n: number }[];
    difficulty: { warmup: number; standard: number; hard: number };
    totalHours: number; totalSessions: number; questions: number;
  };
}

const PILLAR_LABELS = ["Competence", "Consistency", "Coverage", "Currency", "Composure"];

export const READY: Fixture = {
  ri: 74, band: "ready", confidence: 0.82, threshold: 72, delta14d: +6, sessions: 11, percentile: 71,
  hireBand: "hire",
  bandMix: [
    { band: "strongHire", n: 2 }, { band: "hire", n: 5 }, { band: "leanHire", n: 3 }, { band: "noHire", n: 1 }, { band: "strongNoHire", n: 0 },
  ],
  cohort: { label: "typical Razorpay PM hire", ri: 70 },
  baseline: { ri: 58, label: "your first session, 5 weeks ago" },
  target: { role: "Senior PM", company: "Razorpay", round: "Onsite Loop", date: "27 Jun" },
  pillars: [
    { key: "competence",  label: "Competence",  score: 78, delta: +4, weight: 0.34, trend: [70, 72, 71, 74, 76, 78],
      blurb: "Strong product sense and customer focus. Analytical rigor trails the rest.",
      hold: "Product sense and customer-focus answers consistently land in the top band.",
      fix: "Analytical rigor is the one skill under 75. Closing it is your single biggest RI gain.",
      drivers: [
        { label: "Product Sense", value: "82", tone: "good", hint: "skills[].score" },
        { label: "Analytical Rigor", value: "71", tone: "watch", hint: "weakest skill" },
        { label: "Customer Focus", value: "84", tone: "good", hint: "strongest skill" },
      ] },
    { key: "consistency", label: "Consistency", score: 81, delta: +7, weight: 0.18, trend: [62, 66, 70, 74, 78, 81],
      blurb: "Last 8 sessions are tightening, with fewer blow-ups under pressure.",
      hold: "Your best and worst sessions are converging: variance is down from sigma 11 to 6.",
      fix: "One weak session still sits at 68. Identify what threw it and rehearse that round type.",
      drivers: [
        { label: "Score spread (sigma)", value: "6.2", tone: "good", hint: "variance of overallScore", meter: { min: 0, max: 20, lo: 0, hi: 8, value: 6.2, lowerBetter: true } },
        { label: "Range", value: "68 to 86", tone: "good", hint: "min to max across sessions" },
      ] },
    { key: "coverage",    label: "Coverage",    score: 70, delta: +2, weight: 0.18, trend: [60, 62, 65, 66, 68, 70],
      blurb: "6 of 8 round types practiced. The Result step of STAR is still thin.",
      hold: "Six of eight round types covered, and common-question coverage sits at 73 percent.",
      fix: "Result (R) is dropped in roughly 1 in 3 answers, and two round types are still untouched.",
      drivers: [
        { label: "Round types", value: "6 / 8", tone: "watch", hint: "focus breadth" },
        { label: "Common-Q coverage", value: "73%", tone: "good", hint: "freq-weighted pool", meter: { min: 0, max: 100, lo: 70, hi: 100, value: 73 } },
        { label: "STAR — Result", value: "Missing", tone: "miss", hint: "starPresence.R" },
      ] },
    { key: "currency",    label: "Currency",    score: 76, delta: -3, weight: 0.12, trend: [82, 80, 79, 78, 77, 76],
      blurb: "Influencing is cooling: 11 days since you last practiced it.",
      hold: "Most skills are fresh, practiced within the last week.",
      fix: "Influencing has not been practiced in 11 days and has decayed 6 points. Refresh it.",
      drivers: [
        { label: "Influencing idle", value: "11 days", tone: "miss", hint: "skill-decay half-life" },
        { label: "Analytical idle", value: "8 days", tone: "watch", hint: "approaching decay" },
      ] },
    { key: "composure",   label: "Composure",   score: 79, delta: +5, weight: 0.18, trend: [68, 70, 73, 75, 77, 79],
      blurb: "Pace and fillers both sit in the interviewer-comfortable range.",
      hold: "Pace and fillers both sit inside the interviewer-comfort band. You no longer rush the open.",
      fix: "Median latency creeps up on hard questions. A three-beat structuring opener converts dead air into composure.",
      drivers: [
        { label: "Filler / min", value: "4.1", tone: "good", hint: "comfortable <= 5", meter: { min: 0, max: 12, lo: 0, hi: 5, value: 4.1, lowerBetter: true } },
        { label: "Pace", value: "138 wpm", tone: "good", hint: "120-160 ideal", meter: { min: 90, max: 200, lo: 120, hi: 160, value: 138 } },
        { label: "Median latency", value: "1.8 s", tone: "good", hint: "think-time", meter: { min: 0, max: 5, lo: 0, hi: 2.2, value: 1.8, lowerBetter: true } },
      ] },
  ],
  pillarLabels: PILLAR_LABELS,
  snapshots: [
    { id: "s1",  label: "Session 1 · 9 May",  ri: 58, pillars: [61, 49, 52, 70, 57] },
    { id: "s6",  label: "Session 6 · 30 May", ri: 67, pillars: [72, 70, 64, 78, 71] },
    { id: "s11", label: "Session 11 · 12 Jun", ri: 74, pillars: [78, 81, 70, 76, 79] },
  ],
  skills: [
    { name: "Product Sense",    score: 82, delta: +3, percentile: 78 },
    { name: "Customer Focus",   score: 84, delta: +5, percentile: 81 },
    { name: "Execution",        score: 79, delta: +2, percentile: 69 },
    { name: "Analytical Rigor", score: 71, delta: +1, percentile: 52 },
    { name: "Influencing",      score: 70, delta: -4, percentile: 48 },
  ],
  scoreSpread: { min: 68, max: 86, sigma: 6.2 },
  coverage: { focusDone: 6, focusTotal: 8, star: { S: true, T: true, A: true, R: false, L: true }, commonPct: 73 },
  blindSpots: [
    { competency: "Conflict / disagreement", frequencyPct: 68, note: "Razorpay loops probe this in the bar-raiser. Untested in your sessions." },
    { competency: "Failure / what you'd redo", frequencyPct: 54, note: "Commonly asked, only touched once." },
  ],
  composure: {
    fillerPerMin: 4.1, paceWpm: 138, silenceRatio: 12, hedgingPerMin: 2.3, medianLatencyMs: 1800, energy: 74,
    firstPersonRatio: 0.71, lexicalDiversity: 0.58, selfCorrectionRate: 0.9,
  },
  cultural: [
    { key: "relationalFraming",     label: "Relational outcome framing", ratePct: 62, tone: "asset", note: "“kept the team aligned” reads as real impact, not filler." },
    { key: "calendarAnchored",      label: "Calendar-anchored context",  ratePct: 48, tone: "asset", note: "Festival and quarter-end anchors situate the story." },
    { key: "careerLadderNarrative", label: "Deliberate-ladder narrative", ratePct: 41, tone: "asset", note: "Reads as intentional growth, not job-hopping." },
    { key: "indirectFailureFraming", label: "Indirect failure framing",  ratePct: 38, tone: "watch", note: "“there were some challenges” can read as low ownership to a HQ panel." },
    { key: "hedgedDisagreement",    label: "Hedged disagreement",        ratePct: 33, tone: "watch", note: "Polite push-back lands; make the conviction clearer once." },
  ],
  answerCraft: {
    verdictMix: [
      { label: "Strong",   n: 18, tone: "good" },
      { label: "Complete", n: 22, tone: "good" },
      { label: "Partial",  n: 14, tone: "watch" },
      { label: "Weak",     n: 6,  tone: "miss" },
      { label: "Skipped",  n: 2,  tone: "miss" },
    ],
    lengthMix: { tooBrief: 9, right: 41, tooLong: 12 },
    quantifiedPct: 64,
    ownershipPct: 71,
    weakAnswers: [
      { question: "Tell me about a time you disagreed with your manager.", verdict: "Weak", quote: "“…so we sort of went with their call and it worked out okay in the end.”", fix: "No clear stance, no result. State your position, then the outcome with a number." },
      { question: "Walk me through a launch that failed.", verdict: "Partial", quote: "“There were some challenges but the team handled it.”", fix: "Name the failure and your specific fix. Indirect framing reads as low ownership." },
    ],
  },
  focusMetrics: [
    { type: "Behavioral",   sessions: 5, metrics: [{ label: "STAR coverage", value: "82%", tone: "good" }, { label: "First-person", value: "71%", tone: "good" }, { label: "Conflict balance", value: "1 / 2", tone: "watch" }] },
    { type: "Case study",   sessions: 3, metrics: [{ label: "Framework", value: "Held", tone: "good" }, { label: "Recommendation", value: "Clear", tone: "good" }, { label: "Success metric", value: "No guardrail", tone: "watch" }] },
    { type: "System design",sessions: 2, metrics: [{ label: "Capacity stated", value: "Yes", tone: "good" }, { label: "Components", value: "5", tone: "good" }, { label: "Failure modes", value: "1", tone: "watch" }] },
    { type: "HR round",     sessions: 1, metrics: [{ label: "Motivation", value: "Specific", tone: "good" }, { label: "Negative words", value: "0", tone: "good" }, { label: "Red flags", value: "0", tone: "good" }] },
  ],
  trajectory: [58, 61, 60, 64, 67, 66, 70, 74],
  projection: { sessions: 3, hours: 4, targetRi: 80 },
  refresh: [
    { skill: "Influencing", days: 11, decay: -6 },
    { skill: "Analytical Rigor", days: 8, decay: -3 },
  ],
  crossSession: [
    { kind: "improvement", metric: "Pace", delta: -14, text: "Pace settled from 171 to 138 wpm over your last 4 sessions." },
    { kind: "improvement", metric: "Quantification", delta: +21, text: "You now put a number on results far more often than two weeks ago." },
    { kind: "persistent",  metric: "Result (R)", text: "The Result step is still dropped in roughly 1 in 3 answers." },
    { kind: "regression",  metric: "Influencing", delta: -4, text: "Influencing slipped after 11 days without a rep." },
  ],
  storyReuse: [
    { label: "Catalyst IQ launch", count: 4, concern: "Used for product sense, execution, and influencing. A panel will notice the thin portfolio." },
  ],
  redFlags: [
    { type: "missing_result", severity: "high",   title: "Missing Result (R)", hits: 3, of: 8, quote: "“…and that's roughly how we approached the rollout.” — no metric, no outcome." },
    { type: "we_without_i",   severity: "medium", title: "“We” without “I” (ownership)", hits: 2, of: 8, quote: "“We decided, we shipped, we measured.” — the panel can't tell what you did." },
    { type: "vague",          severity: "low",    title: "Vague scope on metrics", hits: 1, of: 8, quote: "“It moved the numbers quite a bit.” — quantify it." },
  ],
  reverse: { green: 4, yellow: 2, red: 0, verdict: "strong" },
  resume: { score: 76, trend: [54, 60, 63, 69, 76], rationale: "You anchor most answers in named projects now. Two answers still drift generic." },
  attention: [
    { atPct: 8,  state: "tracking",       note: "Clear setup. Interviewer is following." },
    { atPct: 34, state: "probingForScope",note: "They lean in on the metric you mention." },
    { atPct: 52, state: "losingThread",   note: "Answer ran long here; attention dips." },
    { atPct: 71, state: "impressed",      note: "The quantified result lands well." },
    { atPct: 92, state: "readyToMoveOn",  note: "Wrapped cleanly, on to the next question." },
  ],
  followUps: [
    { question: "How did you measure success, and what was the guardrail metric?", why: "Your case answers state a recommendation without a counter-metric.", freqPct: 64 },
    { question: "What would you do differently?", why: "Your failure stories skip the redo step.", freqPct: 54 },
    { question: "Who disagreed with you, and how did you handle it?", why: "Conflict is your largest untested area.", freqPct: 68 },
  ],
  coaching: {
    strength: { headline: "You lead with the customer", meaning: "Most answers open from a real user problem, which reads as senior product instinct." },
    gap: { headline: "Close the loop with a number", meaning: "Answers often end at the action, not the result.", example: "Instead of “we improved activation”, say “activation rose from 31 to 44 percent in two quarters”." },
  },
  negotiation: {
    score: 72, outcome: "accepted", anchorTurn: 1, lpaGained: 6.5, bandTraversalPct: 68, leverDiversity: 4,
    archetype: "Early anchor, holds the band. Folds slightly on the final ask.",
  },
  cadence: {
    heat: [0,1,0,2,1,0,0, 1,0,2,1,0,3,0, 0,2,1,0,1,2,0, 1,1,0,3,0,1,2],
    weeks: 4,
    typeMix: [{ type: "Behavioral", n: 5 }, { type: "Case", n: 3 }, { type: "System design", n: 2 }, { type: "HR", n: 1 }],
    difficulty: { warmup: 2, standard: 6, hard: 3 },
    totalHours: 9.4, totalSessions: 11, questions: 64,
  },
};

export const BUILDING: Fixture = {
  ri: 58, band: "building", confidence: 0.64, threshold: 72, delta14d: +9, sessions: 5, percentile: 38,
  hireBand: "leanHire",
  bandMix: [
    { band: "strongHire", n: 0 }, { band: "hire", n: 1 }, { band: "leanHire", n: 2 }, { band: "noHire", n: 2 }, { band: "strongNoHire", n: 0 },
  ],
  cohort: { label: "typical Razorpay PM hire", ri: 70 },
  baseline: { ri: 44, label: "your first session, 2 weeks ago" },
  target: { role: "Senior PM", company: "Razorpay", round: "Onsite Loop", date: "27 Jun" },
  pillars: [
    { key: "competence",  label: "Competence",  score: 61, delta: +8, weight: 0.34, trend: [50, 53, 56, 61],
      blurb: "Product sense is emerging. Analytical and influencing answers stay underbuilt.",
      hold: "Product sense is improving fast, up 9 points since session one.",
      fix: "Analytical rigor and influencing both sit below 55. They are core to the PM loop.",
      drivers: [
        { label: "Product Sense", value: "66", tone: "watch", hint: "rising" },
        { label: "Influencing", value: "47", tone: "miss", hint: "weakest skill" },
      ] },
    { key: "consistency", label: "Consistency", score: 49, delta: +3, weight: 0.18, trend: [44, 46, 47, 49],
      blurb: "Scores swing 40 to 74: one strong session, one weak, repeat.",
      hold: "Your ceiling is real: your best session hit 74.",
      fix: "Variance is high (sigma 13). One strong then one weak session means the floor is the problem.",
      drivers: [
        { label: "Score spread (sigma)", value: "13.1", tone: "miss", hint: "variance", meter: { min: 0, max: 20, lo: 0, hi: 8, value: 13.1, lowerBetter: true } },
        { label: "Range", value: "40 to 74", tone: "miss", hint: "min to max" },
      ] },
    { key: "coverage",    label: "Coverage",    score: 52, delta: +6, weight: 0.18, trend: [40, 44, 48, 52],
      blurb: "Only 3 of 8 round types touched. Case and influencing are untested.",
      hold: "Behavioral rounds are well-rehearsed.",
      fix: "Five of eight round types are untouched, including case and influencing.",
      drivers: [
        { label: "Round types", value: "3 / 8", tone: "miss", hint: "focus breadth" },
        { label: "Common-Q coverage", value: "41%", tone: "miss", hint: "freq-weighted", meter: { min: 0, max: 100, lo: 70, hi: 100, value: 41 } },
      ] },
    { key: "currency",    label: "Currency",    score: 70, delta: 0, weight: 0.12, trend: [70, 70, 70, 70],
      blurb: "Recent enough, but too few reps to decay-protect.",
      hold: "Everything practiced is still fresh.",
      fix: "Too few reps overall to build decay protection. Volume is the fix here.",
      drivers: [
        { label: "Most-idle skill", value: "9 days", tone: "watch", hint: "analytical rigor" },
      ] },
    { key: "composure",   label: "Composure",   score: 57, delta: +4, weight: 0.18, trend: [50, 53, 55, 57],
      blurb: "Pace runs fast at 171 wpm, and fillers spike whenever you get stuck.",
      hold: "Energy is solid; you sound engaged.",
      fix: "Pace runs at 171 wpm and fillers hit 7.8 per minute under pressure. Slow the open.",
      drivers: [
        { label: "Pace", value: "171 wpm", tone: "miss", hint: "120-160 ideal", meter: { min: 90, max: 200, lo: 120, hi: 160, value: 171 } },
        { label: "Filler / min", value: "7.8", tone: "miss", hint: "comfortable <= 5", meter: { min: 0, max: 12, lo: 0, hi: 5, value: 7.8, lowerBetter: true } },
      ] },
  ],
  pillarLabels: PILLAR_LABELS,
  snapshots: [
    { id: "s1", label: "Session 1 · 30 May", ri: 44, pillars: [50, 44, 40, 70, 50] },
    { id: "s3", label: "Session 3 · 6 Jun",  ri: 52, pillars: [56, 47, 48, 70, 55] },
    { id: "s5", label: "Session 5 · 12 Jun", ri: 58, pillars: [61, 49, 52, 70, 57] },
  ],
  skills: [
    { name: "Product Sense",    score: 66, delta: +9, percentile: 44 },
    { name: "Customer Focus",   score: 63, delta: +4, percentile: 39 },
    { name: "Execution",        score: 58, delta: +6, percentile: 33 },
    { name: "Analytical Rigor", score: 51, delta: +3, percentile: 21 },
    { name: "Influencing",      score: 47, delta: +2, percentile: 18 },
  ],
  scoreSpread: { min: 40, max: 74, sigma: 13.1 },
  coverage: { focusDone: 3, focusTotal: 8, star: { S: true, T: true, A: false, R: false, L: false }, commonPct: 41 },
  blindSpots: [
    { competency: "Conflict / disagreement", frequencyPct: 68, note: "Razorpay bar-raiser staple. Never practiced." },
    { competency: "Influencing without authority", frequencyPct: 61, note: "Core to the PM loop, untested." },
    { competency: "Failure / what you'd redo", frequencyPct: 54, note: "Commonly asked, untested." },
  ],
  composure: {
    fillerPerMin: 7.8, paceWpm: 171, silenceRatio: 19, hedgingPerMin: 4.6, medianLatencyMs: 2600, energy: 61,
    firstPersonRatio: 0.52, lexicalDiversity: 0.44, selfCorrectionRate: 2.1,
  },
  cultural: [
    { key: "indirectFailureFraming", label: "Indirect failure framing",  ratePct: 61, tone: "watch", note: "“some challenges” dominates. Name the failure and the fix directly." },
    { key: "deferentialGratitude",  label: "Deferential gratitude",      ratePct: 54, tone: "asset", note: "Courteous and warm. Recognised as professionalism, not weakness." },
    { key: "pedigreeRecital",       label: "Pedigree recital",           ratePct: 47, tone: "watch", note: "Marks and college lead too many answers. Lead with impact instead." },
    { key: "relationalFraming",     label: "Relational outcome framing", ratePct: 39, tone: "asset", note: "Team-alignment framing is landing." },
    { key: "hedgedDisagreement",    label: "Hedged disagreement",        ratePct: 22, tone: "watch", note: "Rarely pushes back. Practice one firm, respectful disagreement." },
  ],
  answerCraft: {
    verdictMix: [
      { label: "Strong",   n: 4,  tone: "good" },
      { label: "Complete", n: 9,  tone: "good" },
      { label: "Partial",  n: 11, tone: "watch" },
      { label: "Weak",     n: 8,  tone: "miss" },
      { label: "Skipped",  n: 3,  tone: "miss" },
    ],
    lengthMix: { tooBrief: 14, right: 13, tooLong: 8 },
    quantifiedPct: 38,
    ownershipPct: 52,
    weakAnswers: [
      { question: "Estimate the market size for UPI merchant lending.", verdict: "Weak", quote: "“It would be a really big number, probably in the crores.”", fix: "No structure, no assumptions. Break it into segments and state each number." },
      { question: "Describe a project you owned end to end.", verdict: "Partial", quote: "“Our team built the feature and it went live.”", fix: "“Our team” hides your role. Lead with what you personally decided and did." },
    ],
  },
  focusMetrics: [
    { type: "Behavioral",  sessions: 3, metrics: [{ label: "STAR coverage", value: "54%", tone: "miss" }, { label: "First-person", value: "52%", tone: "watch" }, { label: "Conflict balance", value: "0 / 1", tone: "miss" }] },
    { type: "Campus / fresher", sessions: 2, metrics: [{ label: "Project ownership", value: "44%", tone: "watch" }, { label: "Fundamentals", value: "Mixed", tone: "watch" }, { label: "Tech reasoning", value: "1", tone: "watch" }] },
  ],
  trajectory: [44, 47, 46, 52, 55, 58],
  projection: { sessions: 9, hours: 11, targetRi: 72 },
  refresh: [
    { skill: "Analytical Rigor", days: 9, decay: -5 },
    { skill: "Execution", days: 7, decay: -4 },
    { skill: "Influencing", days: 6, decay: -3 },
  ],
  crossSession: [
    { kind: "improvement", metric: "Product Sense", delta: +9, text: "Product-sense answers are noticeably more structured than your first session." },
    { kind: "persistent",  metric: "Result (R)", text: "Result is missing in 4 of your last 5 sessions." },
    { kind: "persistent",  metric: "Pace", text: "Pace stays above 160 wpm whenever a question lands hard." },
    { kind: "regression",  metric: "Consistency", delta: -6, text: "The gap between your best and worst session widened this week." },
  ],
  storyReuse: [
    { label: "College fest sponsorship", count: 3, concern: "Reused for ownership, influencing, and execution. Build two more stories." },
  ],
  redFlags: [
    { type: "missing_result", severity: "high",   title: "No Result (R) in STAR", hits: 4, of: 5, quote: "“…and that's basically what we did.” — four of five sessions end with no outcome." },
    { type: "vague",          severity: "high",   title: "Surface-level analytical answers", hits: 3, of: 5, quote: "“It's a big market, lots of users.” — no segmentation, no numbers." },
    { type: "scope_drift",    severity: "medium", title: "Pace exceeds 160 wpm under pressure", hits: 3, of: 5, quote: "Words-per-minute spikes to 178 the moment a hard question lands." },
  ],
  reverse: { green: 1, yellow: 2, red: 1, verdict: "weak" },
  resume: { score: 49, trend: [38, 41, 44, 47, 49], rationale: "Too many generic claims. Cite the projects already on your resume." },
  attention: [
    { atPct: 10, state: "tracking",     note: "Reasonable start." },
    { atPct: 40, state: "losingThread", note: "Pace spikes; interviewer stops nodding." },
    { atPct: 66, state: "concerned",    note: "No result given; they probe for one." },
    { atPct: 90, state: "readyToMoveOn",note: "Answer trails off rather than closing." },
  ],
  followUps: [
    { question: "Can you put a number on that result?", why: "Almost no answer reaches a quantified outcome.", freqPct: 71 },
    { question: "What was your specific role versus the team's?", why: "Ownership reads as collective, not personal.", freqPct: 58 },
    { question: "Tell me about a time you disagreed with someone senior.", why: "Conflict is entirely untested.", freqPct: 68 },
  ],
  coaching: {
    strength: { headline: "Your product instinct is growing", meaning: "Product-sense answers are far more structured than two weeks ago." },
    gap: { headline: "Own the work, then quantify it", meaning: "Answers hide behind “we” and stop before the result.", example: "Instead of “our team improved retention”, say “I proposed the win-back flow that lifted D30 retention 7 points”." },
  },
  negotiation: {
    score: 41, outcome: "stalemate", anchorTurn: 4, lpaGained: 1.5, bandTraversalPct: 24, leverDiversity: 2,
    archetype: "Anchors late and leaks the current number early. Leaves money on the table.",
  },
  cadence: {
    heat: [0,0,1,0,0,0,0, 0,1,0,0,2,0,0, 0,0,1,0,0,1,0, 0,1,0,1,0,0,0],
    weeks: 4,
    typeMix: [{ type: "Behavioral", n: 3 }, { type: "Campus", n: 2 }],
    difficulty: { warmup: 2, standard: 3, hard: 0 },
    totalHours: 3.8, totalSessions: 5, questions: 27,
  },
};

/* Range-scoping: the header toggle slices history to the chosen window
   and reports how much it shows, so the control is wired, not cosmetic. */
export const RANGE_LABEL: Record<RangeKey, string> = { "4w": "4 weeks", "12w": "12 weeks", all: "all time" };

export function rangeSlice<T>(series: T[], range: RangeKey): T[] {
  if (range === "all" || series.length <= 2) return series;
  const keep = range === "4w" ? Math.min(4, series.length) : Math.min(8, series.length);
  return series.slice(series.length - keep);
}
