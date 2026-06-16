/* HireStepX — Readiness Index scoring core (deterministic, pure)
 * ──────────────────────────────────────────────────────────────────
 * computeReadiness(input) folds a user's session history (each with its
 * cached `report_json`, the SessionReport/mvp-9 shape), their target
 * profile, and the company-tier band curve into a single ReadinessPayload
 * that the Analytics surface renders directly. No I/O, no Date.now() —
 * `nowMs` is injected so the function is fully unit-testable and edge-safe.
 *
 * Every payload field maps to a real source. Where no first-class source
 * exists (percentile vs an absent cohort table; quantified-answer share),
 * the value is a clearly-labelled MODELLED estimate derived from the data
 * we do have (the tier hire-bar, red-flag density) — never fabricated.
 * Those carry `modelled: true` in `payload.meta` so the UI can caveat them.
 *
 * Pillars (weights sum to 1.0):
 *   Competence 0.34 · Consistency 0.18 · Coverage 0.18 · Currency 0.12 · Composure 0.18
 */

import { getCompanyTier, type CompanyTier } from "../data/company-tiers";

/* ─── Loose views of the persisted report_json (mvp-9) ───────────────
 * Mirrors server-handlers/evaluate-session.ts SessionReport, all optional
 * because old/partial reports exist. The endpoint asserts row.report_json
 * (jsonb, type unknown) to RIReport — a single allowed assertion. */

export interface RISkill { name: string; score: number; weight?: number }
export interface RIStar { S: boolean; T: boolean; A: boolean; R: boolean; L: boolean }
export interface RICultural {
  hedgedDisagreement: boolean;
  indirectFailureFraming: boolean;
  relationalFraming: boolean;
  calendarAnchored: boolean;
  deferentialGratitude: boolean;
  pedigreeRecital: boolean;
}
export interface RIPerQuestion {
  idx?: number;
  question?: string;
  verdict?: "strong" | "complete" | "partial" | "weak" | "skipped";
  score?: number;
  difficulty?: "warmup" | "standard" | "hard";
  frequencyPct?: number | null;
  starPresence?: RIStar;
  culturalRegister?: RICultural;
  likelyFollowUp?: { question: string; why: string } | null;
  lengthVerdict?: { verdict: "too-brief" | "right" | "too-long" } | null;
}
export interface RIRedFlag {
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  explanation?: string;
  quote?: string;
}
export interface RIWinFix { text: string; questionIdx: number; quote: string }
export interface RIThought {
  startMs: number; endMs: number;
  state: "tracking" | "losingThread" | "probingForScope" | "readyToMoveOn" | "impressed" | "concerned";
  note: string;
}
export interface RIReport {
  overallScore?: number;
  scoreConfidence?: number;
  band?: HireBand;
  verdict?: string;
  skills?: RISkill[];
  coreMetrics?: { fillerPerMin: number; silenceRatio: number; paceWpm: number; energy: number };
  advancedDelivery?: { hedgingPerMin: number; lexicalDiversity: number; firstPersonRatio: number; medianLatencyMs: number; selfCorrectionRate: number };
  perQuestion?: RIPerQuestion[];
  thoughtBubble?: RIThought[];
  calibration?: { companyLabel?: string; note?: string; bands?: { strongHire: number; hire: number; leanHire: number; noHire: number } };
  crossSessionInsights?: { kind: "improvement" | "regression" | "persistent"; text: string; metric?: string; delta?: number }[];
  blindSpots?: { competency: string; frequencyPct: number | null; note: string }[];
  storyReuseFindings?: { storyLabel: string; questionIndices: number[]; concern: string }[];
  readiness?: { targetBand: "strongHire" | "hire" | "leanHire"; estimatedHours: number; estimatedSessions: number; confidence: "low" | "medium" | "high"; rationale: string } | null;
  resumeGrounding?: { score: number; rationale: string } | null;
  reverseInterview?: { counts: { green: number; yellow: number; red: number }; verdict: "strong" | "neutral" | "weak" | "red_flag" } | null;
  coaching?: { strength: { headline: string; meaning: string }; gap: { headline: string; meaning: string; example: string } } | null;
  focusMetrics?: { label: string; value: string; tone: Tone }[];
  redFlags?: RIRedFlag[];
  wins?: RIWinFix[];
  fixes?: RIWinFix[];
}

export interface RawSession {
  id: string;
  createdAt: string;            // ISO timestamp (sessions.created_at)
  focus?: string;
  type?: string;
  difficulty?: string;
  duration?: number;            // seconds
  score?: number;               // sessions.score (0-100) — fallback for overallScore
  questions?: number;
  company?: string;             // sessions.target_company — per-session target
  negotiationMetrics?: Record<string, unknown> | null;
  report: RIReport | null;
}

export interface ReadinessProfile {
  targetRole?: string;
  targetCompany?: string;
  experienceLevel?: string;
  interviewDate?: string;       // ISO/date string
  practiceTimestamps?: string[];
}

export interface ReadinessInput {
  sessions: RawSession[];
  profile: ReadinessProfile;
  nowMs: number;
}

/* ─── Payload types (consumed verbatim by the UI) ─── */

export type Band = "ready" | "almost" | "building" | "early";
export type HireBand = "strongHire" | "hire" | "leanHire" | "noHire" | "strongNoHire";
export type Tone = "good" | "watch" | "miss" | "neutral";
export type PillarKey = "competence" | "consistency" | "coverage" | "currency" | "composure";

export interface Meter { min: number; max: number; lo: number; hi: number; value: number; lowerBetter?: boolean }
export interface PillarDriver { label: string; value: string; tone: Tone; hint: string; meter?: Meter }
export interface Pillar {
  key: PillarKey; label: string; score: number; delta: number; blurb: string; weight: number;
  trend: number[]; drivers: PillarDriver[]; hold: string; fix: string;
}
export interface Skill { name: string; score: number; delta: number; percentile: number }
export interface TargetMeta { role: string; company: string; round: string; date: string }
export interface RegisterSignal { key: string; label: string; ratePct: number; tone: "asset" | "watch"; note: string }
export interface FocusRollup { type: string; sessions: number; metrics: { label: string; value: string; tone: Tone }[] }
export interface CrossInsight { kind: "improvement" | "regression" | "persistent"; metric: string; delta?: number; text: string }
export interface TypedFlag { type: string; severity: "high" | "medium" | "low"; title: string; hits: number; of: number; quote: string }
export interface BlindSpot { competency: string; frequencyPct: number; note: string }
export interface WeakAnswer { question: string; verdict: string; quote: string; fix: string }
export interface Attention { atPct: number; state: RIThought["state"]; note: string }
export interface FollowUp { question: string; why: string; freqPct: number }
export interface Snapshot { id: string; label: string; ri: number; pillars: number[] }

export interface ReadinessPayload {
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
  target: TargetMeta;
  pillars: Pillar[];
  pillarLabels: string[];
  snapshots: Snapshot[];
  skills: Skill[];
  scoreSpread: { min: number; max: number; sigma: number };
  coverage: { focusDone: number; focusTotal: number; star: RIStar; commonPct: number };
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
  resume: { score: number; trend: number[]; rationale: string } | null;
  attention: Attention[];
  followUps: FollowUp[];
  coaching: { strength: { headline: string; meaning: string }; gap: { headline: string; meaning: string; example: string } } | null;
  negotiation: {
    score: number; outcome: string; anchorTurn: number; lpaGained: number;
    bandTraversalPct: number; leverDiversity: number; archetype: string;
  } | null;
  cadence: {
    heat: number[]; weeks: number;
    typeMix: { type: string; n: number }[];
    difficulty: { warmup: number; standard: number; hard: number };
    totalHours: number; totalSessions: number; questions: number;
  };
  meta: {
    modelled: string[];          // field names whose value is a modelled estimate
    sparse: boolean;             // too few sessions for full confidence (< 4)
    generatedAtMs: number;
  };
}

/* ─── Constants ─── */

const PILLAR_LABELS = ["Competence", "Consistency", "Coverage", "Currency", "Composure"];
const WEIGHTS: Record<PillarKey, number> = { competence: 0.34, consistency: 0.18, coverage: 0.18, currency: 0.12, composure: 0.18 };
const DAY_MS = 86_400_000;
const SPARSE_BELOW = 4;
const DEFAULT_HIRE_BAR = 70;

/* Eight canonical round types — the denominator for Coverage breadth. */
const FOCUS_CATALOG: { key: string; label: string; match: RegExp }[] = [
  { key: "behavioral", label: "Behavioral", match: /behav|hr|leadership|star/i },
  { key: "case", label: "Case study", match: /case|guesstimate|estimat|market/i },
  { key: "system", label: "System design", match: /system|architect|design|scal/i },
  { key: "technical", label: "Technical / coding", match: /tech|coding|dsa|algorithm|sql|data\b/i },
  { key: "product", label: "Product sense", match: /product|pm\b|metric|roadmap/i },
  { key: "negotiation", label: "Salary negotiation", match: /negoti|salary|offer|comp\b/i },
  { key: "campus", label: "Campus / fresher", match: /campus|fresher|intern|graduate/i },
  { key: "domain", label: "Role-specific", match: /domain|role|functional|finance|marketing/i },
];

/* Cultural-register markers: label + whether the marker is an asset or a watch. */
const REGISTER_META: Record<keyof RICultural, { label: string; tone: "asset" | "watch"; note: string }> = {
  relationalFraming: { label: "Relational outcome framing", tone: "asset", note: "Team-alignment framing reads as real impact, not filler." },
  calendarAnchored: { label: "Calendar-anchored context", tone: "asset", note: "Festival and quarter-end anchors situate the story concretely." },
  deferentialGratitude: { label: "Deferential gratitude", tone: "asset", note: "Courteous and warm. Reads as professionalism, not weakness." },
  hedgedDisagreement: { label: "Hedged disagreement", tone: "watch", note: "Polite push-back lands; make the conviction clearer at least once." },
  indirectFailureFraming: { label: "Indirect failure framing", tone: "watch", note: "“some challenges” can read as low ownership. Name the failure and the fix." },
  pedigreeRecital: { label: "Pedigree recital", tone: "watch", note: "Leading with marks and college dilutes impact. Lead with what you shipped." },
};

const VERDICT_TONE: Record<string, Tone> = { strong: "good", complete: "good", partial: "watch", weak: "miss", skipped: "miss" };
const VERDICT_LABEL: Record<string, string> = { strong: "Strong", complete: "Complete", partial: "Partial", weak: "Weak", skipped: "Skipped" };

/* ─── Small numeric helpers ─── */

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const round = (n: number): number => Math.round(n);
const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** 0-100 comfort-band score: ~92 inside [lo,hi], decaying toward 40 at the edges. */
function bandScore(v: number, lo: number, hi: number, min: number, max: number): number {
  if (v >= lo && v <= hi) return 92;
  if (v < lo) return clamp(round(92 - ((lo - v) / Math.max(1e-6, lo - min)) * 52), 38, 92);
  return clamp(round(92 - ((v - hi) / Math.max(1e-6, max - hi)) * 52), 38, 92);
}

function toneFromScore(s: number): Tone {
  if (s >= 75) return "good";
  if (s >= 55) return "watch";
  return "miss";
}

function focusKey(s: RawSession): string {
  const hay = `${s.focus || ""} ${s.type || ""}`;
  const hit = FOCUS_CATALOG.find((f) => f.match.test(hay));
  return hit ? hit.key : "behavioral";
}

function focusLabel(key: string): string {
  return FOCUS_CATALOG.find((f) => f.key === key)?.label || "Behavioral";
}

function sessionScore(s: RawSession): number {
  return s.report?.overallScore ?? s.score ?? 0;
}

/* ─── Date helpers (relative to injected nowMs) ─── */

function weeksAgoLabel(fromMs: number, nowMs: number): string {
  const w = Math.max(0, Math.round((nowMs - fromMs) / (7 * DAY_MS)));
  if (w <= 0) return "this week";
  if (w === 1) return "1 week ago";
  return `${w} weeks ago`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "TBD";
  return `${d.getUTCDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]}`;
}

/* ─── Skill aggregation over a window ─── */

interface SkillAgg { name: string; latest: number; earliest: number; lastPracticedMs: number; weight: number }

function aggregateSkills(window: RawSession[]): Map<string, SkillAgg> {
  const out = new Map<string, SkillAgg>();
  for (const s of window) {
    const ms = Date.parse(s.createdAt);
    for (const sk of s.report?.skills || []) {
      if (!sk?.name || typeof sk.score !== "number") continue;
      const prev = out.get(sk.name);
      if (!prev) {
        out.set(sk.name, { name: sk.name, latest: sk.score, earliest: sk.score, lastPracticedMs: ms, weight: sk.weight ?? 1 });
      } else {
        // window is ascending → later sessions overwrite `latest`
        prev.latest = sk.score;
        prev.lastPracticedMs = Math.max(prev.lastPracticedMs, ms);
        prev.weight = sk.weight ?? prev.weight;
      }
    }
  }
  return out;
}

/* ─── Cumulative pillar scores for a window (asOfMs drives decay) ─── */

interface PillarScores { competence: number; consistency: number; coverage: number; currency: number; composure: number }

function cumulativePillars(window: RawSession[], asOfMs: number): PillarScores {
  if (!window.length) return { competence: 0, consistency: 0, coverage: 0, currency: 0, composure: 0 };

  // Competence — weighted average of latest skill scores; falls back to mean session score.
  const skills = aggregateSkills(window);
  let competence: number;
  if (skills.size) {
    let num = 0, den = 0;
    for (const a of skills.values()) { num += a.latest * a.weight; den += a.weight; }
    competence = round(num / den);
  } else {
    competence = round(mean(window.map(sessionScore)));
  }

  // Consistency — inverse of overall-score variance.
  const scores = window.map(sessionScore).filter((n) => n > 0);
  const sigma = stddev(scores);
  const consistency = scores.length < 2 ? 62 : clamp(round(100 - sigma * 3.9), 30, 96);

  // Coverage — round-type breadth blended with STAR completeness + common-Q reach.
  const distinctFocus = new Set(window.map(focusKey)).size;
  const star = aggregateStar(window);
  const starDone = [star.S, star.T, star.A, star.R, star.L].filter(Boolean).length;
  const freqs: number[] = [];
  for (const s of window) for (const pq of s.report?.perQuestion || []) if (typeof pq.frequencyPct === "number") freqs.push(pq.frequencyPct);
  const commonPct = freqs.length ? clamp(round(mean(freqs)), 0, 100) : 0;
  const coverage = clamp(round((distinctFocus / FOCUS_CATALOG.length) * 55 + (starDone / 5) * 30 + (commonPct / 100) * 15), 0, 100);

  // Currency — skill freshness against a 7-day grace then linear decay.
  const idleScores: number[] = [];
  for (const a of skills.values()) {
    const idleDays = Math.max(0, (asOfMs - a.lastPracticedMs) / DAY_MS);
    idleScores.push(100 - clamp((idleDays - 7) * 3, 0, 55));
  }
  const currency = idleScores.length ? round(mean(idleScores)) : 70;

  // Composure — comfort-band scores over recent delivery metrics.
  const composure = composureScore(window);

  return { competence, consistency, coverage, currency, composure };
}

function aggregateStar(window: RawSession[]): RIStar {
  const tally = { S: 0, T: 0, A: 0, R: 0, L: 0 };
  let n = 0;
  for (const s of window) for (const pq of s.report?.perQuestion || []) {
    if (!pq.starPresence) continue;
    n++;
    (["S", "T", "A", "R", "L"] as const).forEach((k) => { if (pq.starPresence![k]) tally[k]++; });
  }
  if (!n) return { S: false, T: false, A: false, R: false, L: false };
  const present = (c: number) => c / n >= 0.4;
  return { S: present(tally.S), T: present(tally.T), A: present(tally.A), R: present(tally.R), L: present(tally.L) };
}

/** Recent-weighted delivery metrics → 0-100 composure. */
function composureScore(window: RawSession[]): number {
  const recent = window.slice(-3);
  const cm = recent.map((s) => s.report?.coreMetrics).filter((x): x is NonNullable<typeof x> => !!x);
  const ad = recent.map((s) => s.report?.advancedDelivery).filter((x): x is NonNullable<typeof x> => !!x);
  if (!cm.length) return 60;
  const filler = mean(cm.map((m) => m.fillerPerMin));
  const pace = mean(cm.map((m) => m.paceWpm));
  const energy = mean(cm.map((m) => m.energy));
  const silence = mean(cm.map((m) => m.silenceRatio));
  const hedging = ad.length ? mean(ad.map((m) => m.hedgingPerMin)) : 3;
  const latencyS = ad.length ? mean(ad.map((m) => m.medianLatencyMs)) / 1000 : 2;
  const parts = [
    bandScore(filler, 0, 5, 0, 12),
    bandScore(pace, 120, 160, 90, 200),
    bandScore(latencyS, 0, 2.2, 0, 5),
    bandScore(hedging, 0, 3, 0, 10),
    bandScore(energy, 60, 100, 0, 100),
    bandScore(silence, 0, 15, 0, 40),
  ];
  return round(mean(parts));
}

function composite(p: PillarScores): number {
  return round(
    p.competence * WEIGHTS.competence + p.consistency * WEIGHTS.consistency +
    p.coverage * WEIGHTS.coverage + p.currency * WEIGHTS.currency + p.composure * WEIGHTS.composure,
  );
}

/* ─── Tier hire-bar (cohort / threshold) ─── */

const TIER_BAR: Partial<Record<CompanyTier, number>> = {
  faang: 78, "big-tech": 75, "indian-unicorn": 71, "consulting-mbb": 76,
  "consulting-big4": 70, "bfsi-global": 74, gcc: 72, "saas-product": 71,
};

function hireBar(profile: ReadinessProfile, latest: RIReport | null): number {
  const calibrated = latest?.calibration?.bands?.hire;
  if (typeof calibrated === "number" && calibrated > 0) return calibrated;
  const tier = getCompanyTier(profile.targetCompany);
  return (tier && TIER_BAR[tier]) || DEFAULT_HIRE_BAR;
}

function bandFromRi(ri: number, threshold: number): Band {
  if (ri >= threshold) return "ready";
  if (ri >= threshold - 8) return "almost";
  if (ri >= 40) return "building";
  return "early";
}

/* ─── Main ─── */

export function computeReadiness(input: ReadinessInput): ReadinessPayload | null {
  const { profile, nowMs } = input;
  const sessions = [...input.sessions]
    .filter((s) => !!s.createdAt && !Number.isNaN(Date.parse(s.createdAt)))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  if (!sessions.length) return null;

  const n = sessions.length;
  const latestReport = sessions[n - 1].report;
  const modelled: string[] = [];

  const threshold = hireBar(profile, latestReport);
  const cohortRi = threshold;

  // Cumulative pillar vectors + RI trajectory, one per session.
  const vectors: PillarScores[] = sessions.map((_, i) => {
    const window = sessions.slice(0, i + 1);
    const asOf = i === n - 1 ? nowMs : Date.parse(sessions[i].createdAt);
    return cumulativePillars(window, asOf);
  });
  const trajectory = vectors.map(composite);
  const ri = trajectory[n - 1];
  const baselineRi = trajectory[0];

  // delta14d — RI now minus RI at the latest snapshot >= 14 days old. When
  // no session is genuinely that old (young account), there is no 14-day
  // baseline to compare against, so the change is 0 rather than the whole
  // lifetime gain mislabelled as "last 14 days".
  const cutoff = nowMs - 14 * DAY_MS;
  let priorIdx = -1;
  for (let i = n - 1; i >= 0; i--) { if (Date.parse(sessions[i].createdAt) <= cutoff) { priorIdx = i; break; } }
  const delta14d = priorIdx >= 0 ? ri - trajectory[priorIdx] : 0;

  const pillars = buildPillars(sessions, vectors, nowMs);

  // Confidence grows with sample size, capped.
  const confidence = clamp(0.4 + 0.05 * n, 0.4, 0.95);

  // Skills (top-level).
  const skillAgg = aggregateSkills(sessions);
  const skills: Skill[] = [...skillAgg.values()]
    .map((a) => {
      const pct = clamp(round(50 + (a.latest - cohortRi) * 2.4), 2, 99);
      return { name: a.name, score: round(a.latest), delta: round(a.latest - a.earliest), percentile: pct };
    })
    .sort((x, y) => y.score - x.score);
  if (skills.length) modelled.push("skills.percentile");

  // Band histogram + current hire band.
  const bandOrder: HireBand[] = ["strongHire", "hire", "leanHire", "noHire", "strongNoHire"];
  const bandCounts: Record<HireBand, number> = { strongHire: 0, hire: 0, leanHire: 0, noHire: 0, strongNoHire: 0 };
  for (const s of sessions) { const b = s.report?.band; if (b && b in bandCounts) bandCounts[b]++; }
  const bandMix = bandOrder.map((b) => ({ band: b, n: bandCounts[b] }));
  const hireBand: HireBand = latestReport?.band || riToHireBand(ri, latestReport);

  // Percentile — modelled vs the typical-hire bar, shrunk toward 50 when sparse.
  const rawPct = 50 + (ri - cohortRi) * 2.6;
  const shrink = clamp(n / 8, 0.35, 1);
  const percentile = clamp(round(50 + (rawPct - 50) * shrink), 2, 99);
  modelled.push("percentile");

  // Score spread.
  const allScores = sessions.map(sessionScore).filter((x) => x > 0);
  const scoreSpread = { min: round(Math.min(...allScores, ri)), max: round(Math.max(...allScores, ri)), sigma: round(stddev(allScores) * 10) / 10 };

  // Coverage detail.
  const star = aggregateStar(sessions);
  const distinctFocus = new Set(sessions.map(focusKey)).size;
  const freqs: number[] = [];
  for (const s of sessions) for (const pq of s.report?.perQuestion || []) if (typeof pq.frequencyPct === "number") freqs.push(pq.frequencyPct!);
  const commonPct = freqs.length ? clamp(round(mean(freqs)), 0, 100) : 0;
  const coverage = { focusDone: distinctFocus, focusTotal: FOCUS_CATALOG.length, star, commonPct };

  // Blind spots — dedupe by competency, keep highest frequency.
  const bsMap = new Map<string, BlindSpot>();
  for (const s of sessions) for (const b of s.report?.blindSpots || []) {
    if (!b?.competency) continue;
    const f = typeof b.frequencyPct === "number" ? b.frequencyPct : 50;
    const prev = bsMap.get(b.competency);
    if (!prev || f > prev.frequencyPct) bsMap.set(b.competency, { competency: b.competency, frequencyPct: f, note: b.note || "" });
  }
  const blindSpots = [...bsMap.values()].sort((a, b) => b.frequencyPct - a.frequencyPct).slice(0, 4);

  // Composure detail (recent average of raw metrics).
  const composure = composureDetail(sessions);

  // Cultural register rates.
  const cultural = buildCultural(sessions);

  // Answer craft.
  const answerCraft = buildAnswerCraft(sessions, modelled);

  // Focus rollups.
  const focusMetrics = buildFocusRollups(sessions);

  // Projection — from latest report.readiness, else slope-based.
  const projection = buildProjection(latestReport, ri, threshold, trajectory);

  // Refresh queue (skill decay).
  const refresh = buildRefresh(skillAgg, nowMs);

  // Cross-session insights (latest report).
  const crossSession: CrossInsight[] = (latestReport?.crossSessionInsights || []).map((c) => ({
    kind: c.kind, metric: c.metric || "", delta: c.delta, text: c.text,
  }));

  // Story reuse.
  const storyReuse = (latestReport?.storyReuseFindings || []).map((sr) => ({
    label: sr.storyLabel, count: sr.questionIndices?.length || 0, concern: sr.concern,
  }));

  // Red flags — aggregate across sessions, dedupe by type.
  const redFlags = buildRedFlags(sessions);

  // Reverse interview (latest non-null).
  const reverse = buildReverse(sessions);

  // Resume grounding trend.
  const resume = buildResume(sessions);

  // Attention timeline (latest report thoughtBubble).
  const attention = buildAttention(sessions);

  // Follow-up prep — aggregate likely follow-ups across recent sessions.
  const followUps = buildFollowUps(sessions);

  // Coaching (latest).
  const coaching = latestReport?.coaching || null;

  // Negotiation (latest negotiation session).
  const negotiation = buildNegotiation(sessions);

  // Cadence (practice heatmap + mix).
  const cadence = buildCadence(sessions, profile);

  // Snapshots — first, middle, last cumulative vectors.
  const snapIdx = n <= 3 ? sessions.map((_, i) => i) : [0, Math.floor((n - 1) / 2), n - 1];
  const snapshots: Snapshot[] = snapIdx.map((i) => ({
    id: sessions[i].id,
    label: `Session ${i + 1} · ${fmtDate(sessions[i].createdAt)}`,
    ri: trajectory[i],
    pillars: [vectors[i].competence, vectors[i].consistency, vectors[i].coverage, vectors[i].currency, vectors[i].composure],
  }));

  // The candidate's target company. Prefer the profile, but fall back to the
  // company practiced in their most recent session — most users set a company
  // when starting an interview but never fill the profile field, so the literal
  // "Target company" placeholder otherwise leaks into the UI.
  let resolvedCompany = profile.targetCompany || "";
  if (!resolvedCompany) {
    for (let i = n - 1; i >= 0; i--) {
      const c = sessions[i].company?.trim();
      if (c) { resolvedCompany = c; break; }
    }
  }

  return {
    ri, band: bandFromRi(ri, threshold), confidence, threshold, delta14d, sessions: n,
    percentile, hireBand, bandMix,
    cohort: { label: `${[resolvedCompany, profile.targetRole].filter(Boolean).join(" ") || "target"} hire bar`, ri: cohortRi },
    baseline: { ri: baselineRi, label: `your first session, ${weeksAgoLabel(Date.parse(sessions[0].createdAt), nowMs)}` },
    target: {
      role: profile.targetRole || "Your role",
      company: resolvedCompany || "your target company",
      round: focusLabel(focusKey(sessions[n - 1])) + " loop",
      date: fmtDate(profile.interviewDate),
    },
    pillars, pillarLabels: PILLAR_LABELS, snapshots, skills, scoreSpread, coverage, blindSpots,
    composure, cultural, answerCraft, focusMetrics, trajectory, projection, refresh,
    crossSession, storyReuse, redFlags, reverse, resume, attention, followUps, coaching, negotiation, cadence,
    meta: { modelled: [...new Set(modelled)], sparse: n < SPARSE_BELOW, generatedAtMs: nowMs },
  };
}

/* ─── Pillar builders ─── */

const PILLAR_BLURBS: Record<PillarKey, (p: number) => string> = {
  competence: (s) => s >= 72 ? "Strong product and role fundamentals. Your weakest skill is the one to close." : "Fundamentals are emerging. Two core skills still sit below the bar.",
  consistency: (s) => s >= 72 ? "Recent sessions are tightening, with fewer swings under pressure." : "Scores still swing session to session. The floor, not the ceiling, is the problem.",
  coverage: (s) => s >= 72 ? "Most round types practiced. A couple of STAR steps stay thin." : "Only a few round types touched. Breadth is the fastest gain here.",
  currency: (s) => s >= 72 ? "Most skills are fresh, practiced within the last week." : "Some skills are cooling. Refresh the idle ones before they decay further.",
  composure: (s) => s >= 72 ? "Pace and fillers sit inside the interviewer-comfort band." : "Delivery runs hot under pressure. Slowing the open is the lever.",
};

function buildPillars(sessions: RawSession[], vectors: PillarScores[], nowMs: number): Pillar[] {
  const n = sessions.length;
  const cutoff = nowMs - 14 * DAY_MS;
  let priorIdx = -1;
  for (let i = n - 1; i >= 0; i--) { if (Date.parse(sessions[i].createdAt) <= cutoff) { priorIdx = i; break; } }
  const keys: PillarKey[] = ["competence", "consistency", "coverage", "currency", "composure"];
  const skillAgg = aggregateSkills(sessions);
  const sortedSkills = [...skillAgg.values()].sort((a, b) => b.latest - a.latest);
  const strongest = sortedSkills[0];
  const weakest = sortedSkills[sortedSkills.length - 1];
  const scores = sessions.map(sessionScore).filter((x) => x > 0);
  const sigma = stddev(scores);
  const star = aggregateStar(sessions);
  const distinctFocus = new Set(sessions.map(focusKey)).size;
  const composure = composureDetail(sessions);
  const refresh = buildRefresh(skillAgg, nowMs);

  return keys.map((key) => {
    const score = vectors[n - 1][key];
    const trend = vectors.map((v) => v[key]);
    const delta = priorIdx >= 0 ? score - vectors[priorIdx][key] : 0;
    let drivers: PillarDriver[] = [];
    let hold = "", fix = "";

    if (key === "competence" && strongest && weakest) {
      drivers = [
        { label: strongest.name, value: String(round(strongest.latest)), tone: toneFromScore(strongest.latest), hint: "strongest skill" },
        { label: weakest.name, value: String(round(weakest.latest)), tone: toneFromScore(weakest.latest), hint: "weakest skill" },
      ];
      hold = `${strongest.name} consistently lands in your top band.`;
      fix = `${weakest.name} is your lowest skill. Closing it is the single biggest RI gain.`;
    } else if (key === "consistency") {
      drivers = [
        { label: "Score spread (sigma)", value: sigma.toFixed(1), tone: sigma <= 8 ? "good" : "miss", hint: "variance of session scores", meter: { min: 0, max: 20, lo: 0, hi: 8, value: Math.round(sigma * 10) / 10, lowerBetter: true } },
        { label: "Range", value: scores.length ? `${round(Math.min(...scores))} to ${round(Math.max(...scores))}` : "n/a", tone: sigma <= 8 ? "good" : "watch", hint: "min to max across sessions" },
      ];
      hold = sigma <= 8 ? "Your best and worst sessions are converging." : "Your ceiling is real; the floor is what drags the average.";
      fix = sigma <= 8 ? "Hold the floor: one weak session still pulls the average." : `Variance is high (sigma ${sigma.toFixed(1)}). Rehearse the round type that threw your weak session.`;
    } else if (key === "coverage") {
      drivers = [
        { label: "Round types", value: `${distinctFocus} / ${FOCUS_CATALOG.length}`, tone: distinctFocus >= 6 ? "good" : distinctFocus >= 4 ? "watch" : "miss", hint: "focus breadth" },
        { label: "STAR — Result", value: star.R ? "Present" : "Missing", tone: star.R ? "good" : "miss", hint: "starPresence.R" },
      ];
      hold = `${distinctFocus} of ${FOCUS_CATALOG.length} round types covered.`;
      fix = star.R ? "Two round types are still untouched. Widen the net." : "Result (R) is dropped in many answers, and round types remain untouched.";
    } else if (key === "currency") {
      const top = refresh[0];
      drivers = top
        ? [{ label: `${top.skill} idle`, value: `${top.days} days`, tone: top.days > 10 ? "miss" : "watch", hint: "skill-decay clock" }]
        : [{ label: "All skills", value: "Fresh", tone: "good", hint: "practiced recently" }];
      hold = "Most skills are fresh, practiced within the last week.";
      fix = top ? `${top.skill} has not been practiced in ${top.days} days. Refresh it.` : "Keep cadence steady to hold decay protection.";
    } else {
      drivers = [
        { label: "Filler / min", value: composure.fillerPerMin.toFixed(1), tone: composure.fillerPerMin <= 5 ? "good" : "miss", hint: "comfortable <= 5", meter: { min: 0, max: 12, lo: 0, hi: 5, value: composure.fillerPerMin, lowerBetter: true } },
        { label: "Pace", value: `${round(composure.paceWpm)} wpm`, tone: composure.paceWpm >= 120 && composure.paceWpm <= 160 ? "good" : "watch", hint: "120-160 ideal", meter: { min: 90, max: 200, lo: 120, hi: 160, value: round(composure.paceWpm) } },
        { label: "Median latency", value: `${(composure.medianLatencyMs / 1000).toFixed(1)} s`, tone: composure.medianLatencyMs <= 2200 ? "good" : "watch", hint: "think-time", meter: { min: 0, max: 5, lo: 0, hi: 2.2, value: Math.round(composure.medianLatencyMs / 100) / 10, lowerBetter: true } },
      ];
      hold = "Pace and fillers sit inside the interviewer-comfort band.";
      fix = "Median latency creeps up on hard questions. A three-beat structuring opener converts dead air into composure.";
    }

    return { key, label: PILLAR_LABELS[keys.indexOf(key)], score, delta, weight: WEIGHTS[key], trend, blurb: PILLAR_BLURBS[key](score), hold, fix, drivers };
  });
}

function riToHireBand(ri: number, latest: RIReport | null): HireBand {
  const b = latest?.calibration?.bands;
  const sh = b?.strongHire ?? 85, h = b?.hire ?? 70, lh = b?.leanHire ?? 55, nh = b?.noHire ?? 40;
  if (ri >= sh) return "strongHire";
  if (ri >= h) return "hire";
  if (ri >= lh) return "leanHire";
  if (ri >= nh) return "noHire";
  return "strongNoHire";
}

/* ─── Detail builders ─── */

function composureDetail(sessions: RawSession[]): ReadinessPayload["composure"] {
  const recent = sessions.slice(-3);
  const cm = recent.map((s) => s.report?.coreMetrics).filter((x): x is NonNullable<typeof x> => !!x);
  const ad = recent.map((s) => s.report?.advancedDelivery).filter((x): x is NonNullable<typeof x> => !!x);
  return {
    fillerPerMin: cm.length ? Math.round(mean(cm.map((m) => m.fillerPerMin)) * 10) / 10 : 0,
    paceWpm: cm.length ? round(mean(cm.map((m) => m.paceWpm))) : 0,
    silenceRatio: cm.length ? round(mean(cm.map((m) => m.silenceRatio))) : 0,
    energy: cm.length ? round(mean(cm.map((m) => m.energy))) : 0,
    hedgingPerMin: ad.length ? Math.round(mean(ad.map((m) => m.hedgingPerMin)) * 10) / 10 : 0,
    medianLatencyMs: ad.length ? round(mean(ad.map((m) => m.medianLatencyMs))) : 0,
    firstPersonRatio: ad.length ? Math.round(mean(ad.map((m) => m.firstPersonRatio)) * 100) / 100 : 0,
    lexicalDiversity: ad.length ? Math.round(mean(ad.map((m) => m.lexicalDiversity)) * 100) / 100 : 0,
    selfCorrectionRate: ad.length ? Math.round(mean(ad.map((m) => m.selfCorrectionRate)) * 10) / 10 : 0,
  };
}

function buildCultural(sessions: RawSession[]): RegisterSignal[] {
  const keys = Object.keys(REGISTER_META) as (keyof RICultural)[];
  const tally: Record<string, number> = {};
  let total = 0;
  for (const s of sessions) for (const pq of s.report?.perQuestion || []) {
    if (!pq.culturalRegister) continue;
    total++;
    for (const k of keys) if (pq.culturalRegister[k]) tally[k] = (tally[k] || 0) + 1;
  }
  if (!total) return [];
  return keys
    .map((k) => {
      const meta = REGISTER_META[k];
      return { key: k, label: meta.label, ratePct: round(((tally[k] || 0) / total) * 100), tone: meta.tone, note: meta.note };
    })
    .filter((r) => r.ratePct > 0)
    .sort((a, b) => b.ratePct - a.ratePct);
}

function buildAnswerCraft(sessions: RawSession[], modelled: string[]): ReadinessPayload["answerCraft"] {
  const vCount: Record<string, number> = { strong: 0, complete: 0, partial: 0, weak: 0, skipped: 0 };
  const len = { tooBrief: 0, right: 0, tooLong: 0 };
  let firstPersonSum = 0, fpN = 0, missingResultFlags = 0, totalAnswers = 0;
  const weak: WeakAnswer[] = [];

  for (const s of sessions) {
    const fixes = s.report?.fixes || [];
    for (const pq of s.report?.perQuestion || []) {
      totalAnswers++;
      if (pq.verdict && pq.verdict in vCount) vCount[pq.verdict]++;
      const lv = pq.lengthVerdict?.verdict;
      if (lv === "too-brief") len.tooBrief++;
      else if (lv === "too-long") len.tooLong++;
      else if (lv === "right") len.right++;
      if ((pq.verdict === "weak" || pq.verdict === "partial") && weak.length < 4 && pq.question) {
        const fx = fixes.find((f) => f.questionIdx === pq.idx);
        weak.push({
          question: pq.question,
          verdict: VERDICT_LABEL[pq.verdict] || pq.verdict,
          quote: fx?.quote || "",
          fix: fx?.text || "State your position, then close with a quantified outcome.",
        });
      }
    }
    const ad = s.report?.advancedDelivery;
    if (ad) { firstPersonSum += ad.firstPersonRatio; fpN++; }
    for (const rf of s.report?.redFlags || []) if (rf.type === "missing_result") missingResultFlags++;
  }

  const ownershipPct = fpN ? round((firstPersonSum / fpN) * 100) : 0;
  const quantifiedPct = totalAnswers ? clamp(round(100 - (missingResultFlags / totalAnswers) * 100), 0, 100) : 0;
  modelled.push("answerCraft.quantifiedPct");

  const verdictMix = (["strong", "complete", "partial", "weak", "skipped"] as const).map((v) => ({
    label: VERDICT_LABEL[v], n: vCount[v], tone: VERDICT_TONE[v],
  }));
  return { verdictMix, lengthMix: len, quantifiedPct, ownershipPct, weakAnswers: weak };
}

function buildFocusRollups(sessions: RawSession[]): FocusRollup[] {
  const groups = new Map<string, { count: number; latest: RawSession }>();
  for (const s of sessions) {
    const k = focusKey(s);
    const g = groups.get(k);
    if (!g) groups.set(k, { count: 1, latest: s });
    else { g.count++; g.latest = s; }
  }
  return [...groups.entries()]
    .map(([k, g]) => ({
      type: focusLabel(k),
      sessions: g.count,
      metrics: (g.latest.report?.focusMetrics || []).slice(0, 3).map((m) => ({ label: m.label, value: m.value, tone: m.tone })),
    }))
    .filter((r) => r.metrics.length > 0)
    .sort((a, b) => b.sessions - a.sessions);
}

function buildProjection(latest: RIReport | null, ri: number, threshold: number, trajectory: number[]): ReadinessPayload["projection"] {
  const r = latest?.readiness;
  const targetRi = ri >= threshold ? Math.min(100, threshold + 8) : threshold;
  if (r && r.estimatedSessions > 0) {
    return { sessions: r.estimatedSessions, hours: r.estimatedHours, targetRi };
  }
  // Slope from the last few sessions.
  const tail = trajectory.slice(-4);
  const slope = tail.length >= 2 ? (tail[tail.length - 1] - tail[0]) / (tail.length - 1) : 2;
  const gap = Math.max(0, targetRi - ri);
  const sessions = slope > 0.5 ? Math.ceil(gap / slope) : Math.ceil(gap / 2);
  return { sessions: clamp(sessions, 0, 30), hours: clamp(round(sessions * 1.3), 0, 40), targetRi };
}

function buildRefresh(skillAgg: Map<string, SkillAgg>, nowMs: number): { skill: string; days: number; decay: number }[] {
  return [...skillAgg.values()]
    .map((a) => {
      const days = Math.round((nowMs - a.lastPracticedMs) / DAY_MS);
      return { skill: a.name, days, decay: -clamp(round((days - 7) * 0.8), 0, 20) };
    })
    .filter((r) => r.days > 7)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);
}

function buildRedFlags(sessions: RawSession[]): TypedFlag[] {
  const n = sessions.length;
  const byType = new Map<string, { flag: RIRedFlag; hits: number }>();
  for (const s of sessions) {
    const seen = new Set<string>();
    for (const rf of s.report?.redFlags || []) {
      if (!rf?.type || seen.has(rf.type)) continue;
      seen.add(rf.type);
      const prev = byType.get(rf.type);
      if (!prev) byType.set(rf.type, { flag: rf, hits: 1 });
      else { prev.hits++; if (!prev.flag.quote && rf.quote) prev.flag = rf; }
    }
  }
  const sevRank = { high: 0, medium: 1, low: 2 };
  return [...byType.values()]
    .map(({ flag, hits }) => ({
      type: flag.type, severity: flag.severity, title: flag.title, hits, of: n,
      quote: flag.quote || flag.explanation || "",
    }))
    .sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.hits - a.hits)
    .slice(0, 5);
}

function buildReverse(sessions: RawSession[]): ReadinessPayload["reverse"] {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const r = sessions[i].report?.reverseInterview;
    if (r?.counts) {
      const verdict = r.verdict === "strong" ? "strong" : r.verdict === "red_flag" ? "red flags" : r.verdict === "weak" ? "weak" : "mixed";
      return { green: r.counts.green, yellow: r.counts.yellow, red: r.counts.red, verdict };
    }
  }
  return { green: 0, yellow: 0, red: 0, verdict: "untested" };
}

function buildResume(sessions: RawSession[]): ReadinessPayload["resume"] {
  const trend: number[] = [];
  let latest: { score: number; rationale: string } | null = null;
  for (const s of sessions) {
    const rg = s.report?.resumeGrounding;
    if (rg && typeof rg.score === "number") { trend.push(round(rg.score)); latest = rg; }
  }
  if (!latest) return null;
  return { score: round(latest.score), trend, rationale: latest.rationale };
}

function buildAttention(sessions: RawSession[]): Attention[] {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    const tb = s.report?.thoughtBubble;
    if (tb && tb.length) {
      const durMs = Math.max((s.duration || 0) * 1000, ...tb.map((t) => t.endMs));
      if (durMs <= 0) continue;
      return tb.map((t) => ({ atPct: clamp(round((t.startMs / durMs) * 100), 0, 100), state: t.state, note: t.note }));
    }
  }
  return [];
}

function buildFollowUps(sessions: RawSession[]): FollowUp[] {
  const recent = sessions.slice(-4);
  const byQ = new Map<string, FollowUp>();
  for (const s of recent) for (const pq of s.report?.perQuestion || []) {
    const fu = pq.likelyFollowUp;
    if (!fu?.question) continue;
    const freq = typeof pq.frequencyPct === "number" ? pq.frequencyPct : 0;
    const prev = byQ.get(fu.question);
    if (!prev || freq > prev.freqPct) byQ.set(fu.question, { question: fu.question, why: fu.why || "", freqPct: round(freq) });
  }
  return [...byQ.values()].sort((a, b) => b.freqPct - a.freqPct).slice(0, 3);
}

function buildNegotiation(sessions: RawSession[]): ReadinessPayload["negotiation"] {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const s = sessions[i];
    if (focusKey(s) !== "negotiation") continue;
    const m = s.negotiationMetrics;
    const num = (k: string, d: number): number => (m && typeof m[k] === "number" ? (m[k] as number) : d);
    const str = (k: string, d: string): string => (m && typeof m[k] === "string" ? (m[k] as string) : d);
    return {
      score: round(num("score", sessionScore(s))),
      outcome: str("outcome", "completed"),
      anchorTurn: num("anchorTurn", 0),
      lpaGained: num("lpaGained", 0),
      // Producer (save-session.ts) writes `bandTraversal` on a 0-1 scale;
      // the UI wants a percentage. Reading the non-existent `bandTraversalPct`
      // pinned this to 0 for every negotiation session.
      bandTraversalPct: clamp(round(num("bandTraversal", 0) * 100), 0, 100),
      leverDiversity: num("leverDiversity", 0),
      archetype: str("archetype", "Negotiation practiced. Review the round for anchor timing."),
    };
  }
  return null;
}

function buildCadence(sessions: RawSession[], profile: ReadinessProfile): ReadinessPayload["cadence"] {
  const weeks = 4;
  const heat = new Array(weeks * 7).fill(0);
  const now = sessions.length ? Date.parse(sessions[sessions.length - 1].createdAt) : 0;
  const stamps = profile.practiceTimestamps && profile.practiceTimestamps.length
    ? profile.practiceTimestamps.map((t) => Date.parse(t)).filter((t) => !Number.isNaN(t))
    : sessions.map((s) => Date.parse(s.createdAt));
  const windowStart = now - (weeks * 7 - 1) * DAY_MS;
  for (const t of stamps) {
    if (t < windowStart || t > now + DAY_MS) continue;
    const dayIdx = Math.floor((t - windowStart) / DAY_MS);
    if (dayIdx >= 0 && dayIdx < heat.length) heat[dayIdx]++;
  }
  const typeTally = new Map<string, number>();
  const diff = { warmup: 0, standard: 0, hard: 0 };
  let totalSec = 0, questions = 0;
  for (const s of sessions) {
    const label = focusLabel(focusKey(s));
    typeTally.set(label, (typeTally.get(label) || 0) + 1);
    totalSec += s.duration || 0;
    questions += s.questions || (s.report?.perQuestion?.length || 0);
    const d = (s.difficulty || "").toLowerCase();
    if (d.includes("warm") || d.includes("easy")) diff.warmup++;
    else if (d.includes("hard") || d.includes("senior") || d.includes("bar")) diff.hard++;
    else diff.standard++;
  }
  return {
    heat, weeks,
    typeMix: [...typeTally.entries()].map(([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n),
    difficulty: diff,
    totalHours: Math.round((totalSec / 3600) * 10) / 10,
    totalSessions: sessions.length,
    questions,
  };
}

/* Range-scoping helpers — re-exported so the UI slices client-side without
   duplicating the logic. */
export type RangeKey = "4w" | "12w" | "all";
export const RANGE_LABEL: Record<RangeKey, string> = { "4w": "4 weeks", "12w": "12 weeks", all: "all time" };
export function rangeSlice<T>(series: T[], range: RangeKey): T[] {
  if (range === "all" || series.length <= 2) return series;
  const keep = range === "4w" ? Math.min(4, series.length) : Math.min(8, series.length);
  return series.slice(series.length - keep);
}
