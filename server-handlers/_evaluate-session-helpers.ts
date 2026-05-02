/* Pure helpers extracted from evaluate-session.ts so we can unit-test the
   scoring/normalization pipeline without spinning up the edge handler. The
   handler imports these — behaviour must remain bit-identical. */

export type Band = "strongHire" | "hire" | "leanHire" | "noHire" | "strongNoHire";

export interface BandThresholds {
  strongHire: number;
  hire: number;
  leanHire: number;
  noHire: number;
}

export interface CompanyProfile {
  label: string;
  bands: BandThresholds;
  skillWeights: Record<string, number>;
  note: string;
}

export interface TranscriptTurn {
  role: "interviewer" | "candidate";
  text: string;
  startMs?: number;
  endMs?: number;
}

export interface CoreMetrics {
  fillerPerMin: number;
  silenceRatio: number;
  paceWpm: number;
  energy: number;
}

export interface AdvancedDelivery {
  hedgingPerMin: number;
  lexicalDiversity: number;
  firstPersonRatio: number;
  medianLatencyMs: number;
  selfCorrectionRate: number;
}

export interface WinOrFix {
  text: string;
  questionIdx: number;
  quote: string;
}

export type RedFlagType =
  | "blame"
  | "missing_result"
  | "we_without_i"
  | "scope_drift"
  | "contradiction"
  | "vague";

export interface RedFlag {
  type: RedFlagType;
  severity: "high" | "medium" | "low";
  title: string;
  explanation: string;
  questionIdx: number;
  quote: string;
}

export interface ThoughtBubbleSegment {
  startMs: number;
  endMs: number;
  state:
    | "tracking"
    | "losingThread"
    | "probingForScope"
    | "readyToMoveOn"
    | "impressed"
    | "concerned";
  note: string;
}

export interface StoryReuseFinding {
  storyLabel: string;
  questionIndices: number[];
  concern: string;
}

export interface BlindSpot {
  competency: string;
  frequencyPct: number | null;
  note: string;
}

export interface ReadinessForecast {
  targetBand: "strongHire" | "hire" | "leanHire";
  estimatedHours: number;
  estimatedSessions: number;
  confidence: "low" | "medium" | "high";
  rationale: string;
}

export interface CrossSessionInsight {
  kind: "improvement" | "regression" | "persistent";
  text: string;
  metric?: string;
  delta?: number;
}

export const ROLE_SKILLS: Record<string, string[]> = {
  swe: ["Problem Framing", "Technical Depth", "Trade-off Reasoning", "Communication", "Ownership"],
  pm: ["Product Sense", "Analytical", "Execution", "Influencing", "Customer Focus"],
  em: ["Strategic Thinking", "People Management", "Execution", "Communication", "Conflict Handling"],
  data: ["Analytical", "Technical Depth", "Business Impact", "Communication", "Ownership"],
  behavioral: ["Structure", "Ownership", "Impact", "Communication", "Composure"],
};

export const DEFAULT_BANDS: BandThresholds = {
  strongHire: 85,
  hire: 70,
  leanHire: 55,
  noHire: 40,
};

export const COMPANY_BANDS: Record<string, CompanyProfile> = {
  amazon:       { label: "Amazon",              bands: { strongHire: 90, hire: 75, leanHire: 60, noHire: 42 }, skillWeights: { "Ownership": 1.3, "Impact": 1.2, "Technical Depth": 1.15, "Problem Framing": 1.1, "Influencing": 1.1 }, note: "Amazon Bar Raiser — Ownership + Deliver Results weighted heavily." },
  google:       { label: "Google",              bands: { strongHire: 88, hire: 73, leanHire: 58, noHire: 42 }, skillWeights: { "Problem Framing": 1.2, "Technical Depth": 1.2, "Communication": 1.15, "Trade-off Reasoning": 1.1 }, note: "Google G&L + technical bar." },
  meta:         { label: "Meta",                bands: { strongHire: 88, hire: 72, leanHire: 58, noHire: 42 }, skillWeights: { "Impact": 1.25, "Execution": 1.15, "Technical Depth": 1.1, "Problem Framing": 1.05 }, note: "Meta's signal-based E-level rubric — Impact above all." },
  stripe:       { label: "Stripe",              bands: { strongHire: 87, hire: 72, leanHire: 57, noHire: 42 }, skillWeights: { "Communication": 1.3, "Problem Framing": 1.15, "Ownership": 1.1, "Technical Depth": 1.1, "Customer Focus": 1.05 }, note: "Stripe's high writing and clarity bar." },
  netflix:      { label: "Netflix",             bands: { strongHire: 90, hire: 76, leanHire: 62, noHire: 45 }, skillWeights: { "Impact": 1.3, "Ownership": 1.2, "Influencing": 1.15, "Execution": 1.1 }, note: "Netflix keeper-test — senior by default." },
  microsoft:    { label: "Microsoft",           bands: { strongHire: 86, hire: 71, leanHire: 56, noHire: 40 }, skillWeights: { "Technical Depth": 1.15, "Problem Framing": 1.1, "Communication": 1.1, "Impact": 1.1 }, note: "Microsoft Growth Mindset + technical rubric." },
  apple:        { label: "Apple",               bands: { strongHire: 88, hire: 73, leanHire: 58, noHire: 42 }, skillWeights: { "Technical Depth": 1.2, "Problem Framing": 1.15, "Customer Focus": 1.15, "Ownership": 1.1 }, note: "Apple craft + secrecy culture — depth over breadth." },
  "series-b":   { label: "Series-B Startup",    bands: { strongHire: 80, hire: 65, leanHire: 50, noHire: 35 }, skillWeights: { "Ownership": 1.2, "Execution": 1.15, "Impact": 1.1 }, note: "Series-B growth stage — bias toward ownership + execution." },
  "early-stage":{ label: "Early-Stage Startup", bands: { strongHire: 78, hire: 62, leanHire: 48, noHire: 32 }, skillWeights: { "Ownership": 1.25, "Execution": 1.2 }, note: "Seed / Series-A — friendlier bar, scrappy ownership." },
};

export const COMPANY_ALIASES: Record<string, string> = {
  aws: "amazon", amzn: "amazon", alphabet: "google", facebook: "meta", fb: "meta",
  msft: "microsoft", ms: "microsoft", nflx: "netflix", startup: "early-stage",
};

export function applyBands(score: number, bands: BandThresholds): Band {
  if (score >= bands.strongHire) return "strongHire";
  if (score >= bands.hire) return "hire";
  if (score >= bands.leanHire) return "leanHire";
  if (score >= bands.noHire) return "noHire";
  return "strongNoHire";
}

export function resolveCompanyProfile(
  targetCompany: string | null | undefined,
): CompanyProfile | null {
  if (!targetCompany) return null;
  const key = String(targetCompany).toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!key) return null;
  if (COMPANY_BANDS[key]) return COMPANY_BANDS[key];
  if (COMPANY_ALIASES[key] && COMPANY_BANDS[COMPANY_ALIASES[key]]) {
    return COMPANY_BANDS[COMPANY_ALIASES[key]];
  }
  for (const k of Object.keys(COMPANY_BANDS)) {
    if (key.includes(k)) return COMPANY_BANDS[k];
  }
  return null;
}

export function computeCoreMetrics(
  transcript: TranscriptTurn[],
  durationSec: number,
): CoreMetrics {
  const candidateTurns = transcript.filter((t) => t.role === "candidate");
  const allText = candidateTurns.map((t) => t.text).join(" ");
  const words = allText.split(/\s+/).filter(Boolean);
  const fillerRegex = /\b(um+|uh+|like|you know|so|actually|basically|literally)\b/gi;
  const fillerMatches = allText.match(fillerRegex) || [];
  const speakingMinutes = Math.max(durationSec / 60, 0.1);

  let silenceMs = 0;
  for (let i = 1; i < candidateTurns.length; i++) {
    const prev = candidateTurns[i - 1];
    const cur = candidateTurns[i];
    if (prev.endMs != null && cur.startMs != null) {
      const gap = cur.startMs - prev.endMs;
      if (gap > 1500) silenceMs += gap;
    }
  }
  const silenceRatio =
    durationSec > 0 ? Math.min(100, Math.round((silenceMs / (durationSec * 1000)) * 100)) : 0;

  const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
  const diversity = words.length > 0 ? uniqueWords / words.length : 0;
  const avgLen = candidateTurns.length > 0 ? words.length / candidateTurns.length : 0;
  const energy = Math.max(
    0,
    Math.min(100, Math.round(40 + diversity * 80 + Math.min(avgLen, 30))),
  );

  return {
    fillerPerMin: Math.round((fillerMatches.length / speakingMinutes) * 10) / 10,
    silenceRatio,
    paceWpm: Math.round(words.length / speakingMinutes),
    energy,
  };
}

export function computeAdvancedDelivery(
  transcript: TranscriptTurn[],
  durationSec: number,
): AdvancedDelivery {
  const candidateTurns = transcript.filter((t) => t.role === "candidate");
  const allText = candidateTurns.map((t) => t.text).join(" ");
  const words = allText.split(/\s+/).filter(Boolean);
  const speakingMinutes = Math.max(durationSec / 60, 0.1);

  const hedgeRegex = /\b(?:i\s+(?:think|guess|feel|believe|assume|suppose)|maybe|kind\s+of|sort\s+of|kinda|sorta|probably|perhaps|might|could\s+be|i'?m\s+not\s+sure)\b/gi;
  const hedgeCount = (allText.match(hedgeRegex) || []).length;

  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z']/g, ""))).size;
  const lexicalDiversity = words.length >= 20 ? uniqueWords / words.length : 0;

  const iCount = (allText.match(/\bI\b/g) || []).length;
  const weCount = (allText.match(/\bwe\b/gi) || []).length;
  const firstPersonRatio = iCount + weCount > 0 ? iCount / (iCount + weCount) : 0.5;

  const latencies: number[] = [];
  for (let i = 1; i < transcript.length; i++) {
    const prev = transcript[i - 1];
    const cur = transcript[i];
    if (
      prev.role === "interviewer" &&
      cur.role === "candidate" &&
      prev.endMs != null &&
      cur.startMs != null
    ) {
      const gap = cur.startMs - prev.endMs;
      if (gap >= 0 && gap < 30_000) latencies.push(gap);
    }
  }
  latencies.sort((a, b) => a - b);
  const medianLatencyMs = latencies.length > 0 ? latencies[Math.floor(latencies.length / 2)] : 0;

  const scRegex = /\b(?:let\s+me\s+rephrase|actually(?:,|\s+let\s+me)|what\s+i\s+(?:meant|mean)\s+(?:to\s+say\s+)?(?:is|was)|sorry,?\s+i\s+misspoke|scratch\s+that|let\s+me\s+start\s+over)\b/gi;
  const scCount = (allText.match(scRegex) || []).length;

  return {
    hedgingPerMin: Math.round((hedgeCount / speakingMinutes) * 10) / 10,
    lexicalDiversity: Math.round(lexicalDiversity * 100) / 100,
    firstPersonRatio: Math.round(firstPersonRatio * 100) / 100,
    medianLatencyMs: Math.round(medianLatencyMs),
    selfCorrectionRate: Math.round((scCount / speakingMinutes) * 10) / 10,
  };
}

export function filterGroundedItems(
  items: WinOrFix[] | undefined,
  candidateCorpus: string,
): WinOrFix[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((w) => w && typeof w.text === "string" && w.text.trim().length > 0)
    .filter((w) => {
      if (w.questionIdx === -1 || !w.quote) return true;
      return typeof w.quote === "string" && candidateCorpus.includes(w.quote.trim());
    })
    .slice(0, 3);
}

export function filterGroundedRedFlags(
  items: RedFlag[] | undefined,
  candidateCorpus: string,
): RedFlag[] {
  if (!Array.isArray(items)) return [];
  const validTypes: RedFlagType[] = [
    "blame",
    "missing_result",
    "we_without_i",
    "scope_drift",
    "contradiction",
    "vague",
  ];
  const validSeverities = ["high", "medium", "low"] as const;
  return items
    .filter(
      (f) =>
        f &&
        validTypes.includes(f.type) &&
        (validSeverities as readonly string[]).includes(f.severity),
    )
    .filter((f) => typeof f.title === "string" && f.title.trim().length > 0)
    .filter((f) => {
      if (f.questionIdx === -1 || !f.quote) return true;
      return typeof f.quote === "string" && candidateCorpus.includes(f.quote.trim());
    })
    .slice(0, 4);
}

export function validateReportShape(
  report: unknown,
  transcript: TranscriptTurn[],
): boolean {
  if (!report || typeof report !== "object") return false;
  const r = report as Record<string, unknown>;
  if (typeof r.overallScore !== "number" || r.overallScore < 0 || r.overallScore > 100) return false;
  if (!Array.isArray(r.perQuestion)) return false;

  const candidateCorpus = transcript
    .filter((t) => t.role === "candidate")
    .map((t) => t.text)
    .join("\n");

  for (const pq of r.perQuestion as Array<{
    restructured?: { citations?: Array<{ sourceStart?: number; sourceEnd?: number }> };
  }>) {
    if (pq.restructured && Array.isArray(pq.restructured.citations)) {
      for (const c of pq.restructured.citations) {
        if (typeof c.sourceStart !== "number" || typeof c.sourceEnd !== "number") continue;
        if (
          c.sourceStart >= candidateCorpus.length ||
          c.sourceEnd > candidateCorpus.length
        )
          return false;
      }
    }
  }
  return true;
}

/**
 * Blend role-weighted skill composite with the LLM's holistic overall score.
 * 60/40 split — composite keeps company calibration honest, LLM captures
 * cross-cutting signal weights don't model. Result is clamped 0-100.
 */
export function computeBlendedOverall(
  rawSkills: Array<{ name: string; score: number }>,
  skillWeights: Record<string, number>,
  llmOverall: number,
): { weightedSkills: Array<{ name: string; score: number; weight: number }>; overallScore: number } {
  const weightedSkills = rawSkills.map((s) => ({
    name: s.name,
    score: s.score,
    weight: Math.round((skillWeights[s.name] ?? 1.0) * 100) / 100,
  }));
  const totalWeight = weightedSkills.reduce((sum, w) => sum + w.weight, 0) || 1;
  const composite =
    weightedSkills.length > 0
      ? weightedSkills.reduce((sum, w) => sum + w.score * w.weight, 0) / totalWeight
      : llmOverall;
  const overallScore = Math.max(0, Math.min(100, Math.round(composite * 0.6 + llmOverall * 0.4)));
  return { weightedSkills, overallScore };
}

/** Validate + clamp thoughtBubble segments coming from the LLM. */
export function normalizeThoughtBubble(raw: unknown): ThoughtBubbleSegment[] {
  const validStates = [
    "tracking",
    "losingThread",
    "probingForScope",
    "readyToMoveOn",
    "impressed",
    "concerned",
  ];
  if (!Array.isArray(raw)) return [];
  return (raw as ThoughtBubbleSegment[])
    .filter((s) => s && validStates.includes(s.state) && typeof s.note === "string")
    .map((s) => ({
      startMs: Math.max(0, Math.floor(Number(s.startMs) || 0)),
      endMs: Math.max(0, Math.floor(Number(s.endMs) || 0)),
      state: s.state,
      note: s.note.slice(0, 100),
    }))
    .filter((s) => s.endMs >= s.startMs)
    .slice(0, 8);
}

export function normalizeScoreConfidence(raw: unknown): number {
  if (typeof raw !== "number" || !isFinite(raw)) return 0.8;
  return Math.max(0, Math.min(1, Math.round(raw * 100) / 100));
}

export function normalizeStoryReuse(raw: unknown): StoryReuseFinding[] {
  if (!Array.isArray(raw)) return [];
  return (raw as StoryReuseFinding[])
    .filter(
      (f) =>
        f &&
        typeof f.storyLabel === "string" &&
        Array.isArray(f.questionIndices) &&
        f.questionIndices.length >= 2 &&
        typeof f.concern === "string",
    )
    .map((f) => ({
      storyLabel: f.storyLabel.slice(0, 60),
      questionIndices: f.questionIndices.filter((i) => typeof i === "number" && i >= 0).slice(0, 6),
      concern: f.concern.slice(0, 200),
    }))
    .filter((f) => f.questionIndices.length >= 2)
    .slice(0, 3);
}

export function normalizeBlindSpots(raw: unknown): BlindSpot[] {
  if (!Array.isArray(raw)) return [];
  return (raw as BlindSpot[])
    .filter((b) => b && typeof b.competency === "string" && b.competency.trim().length > 0)
    .map((b) => ({
      competency: b.competency.slice(0, 60),
      frequencyPct:
        typeof b.frequencyPct === "number" &&
        isFinite(b.frequencyPct) &&
        b.frequencyPct >= 0 &&
        b.frequencyPct <= 100
          ? Math.round(b.frequencyPct)
          : null,
      note: typeof b.note === "string" ? b.note.slice(0, 160) : "",
    }))
    .slice(0, 5);
}

export function normalizeReadiness(raw: unknown): ReadinessForecast | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as ReadinessForecast;
  const validBands = ["strongHire", "hire", "leanHire"];
  const validConf = ["low", "medium", "high"];
  if (!validBands.includes(r.targetBand)) return null;
  return {
    targetBand: r.targetBand,
    estimatedHours: Math.max(0, Math.min(500, Math.round(Number(r.estimatedHours) || 0))),
    estimatedSessions: Math.max(0, Math.min(100, Math.round(Number(r.estimatedSessions) || 0))),
    confidence: validConf.includes(r.confidence) ? r.confidence : "medium",
    rationale: typeof r.rationale === "string" ? r.rationale.slice(0, 220) : "",
  };
}

/**
 * Cross-session insights are gated: empty array if no prior reports were
 * provided to the LLM. Defense-in-depth against fabricated history.
 */
export function normalizeCrossSessionInsights(
  raw: unknown,
  priorSessionCount: number,
): CrossSessionInsight[] {
  if (!Array.isArray(raw)) return [];
  if (priorSessionCount === 0) return [];
  const validKinds = ["improvement", "regression", "persistent"];
  return (raw as CrossSessionInsight[])
    .filter(
      (i) =>
        i &&
        validKinds.includes(i.kind) &&
        typeof i.text === "string" &&
        i.text.trim().length > 0,
    )
    .map((i) => ({
      kind: i.kind,
      text: i.text.slice(0, 220),
      metric: typeof i.metric === "string" ? i.metric.slice(0, 40) : undefined,
      delta:
        typeof i.delta === "number" && isFinite(i.delta) ? Math.round(i.delta * 10) / 10 : undefined,
    }))
    .slice(0, 4);
}
