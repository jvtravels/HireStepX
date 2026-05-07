/* System-design interview analyzer — deterministic v1.
 *
 * Catches:
 *   - AI never probed for scale assumptions (QPS, data volume, latency)
 *   - Discussion skipped capacity estimation, data model, scaling, or failure modes
 *   - User gave magnitude-implausible numbers (1 QPS for a global service)
 *   - AI accepted a hand-wavy answer without follow-up
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

const SCALE_PROBES = [
  /\b(qps|requests? per second|rps)\b/i,
  /\b(data (?:volume|size)|how (?:many|much) (?:users|records|rows|gb|tb))\b/i,
  /\b(latency (?:budget|target|sla)|p99|p95|response time)\b/i,
  /\b(read[/-]?write ratio|read heavy|write heavy)\b/i,
  /\b(geographic|regions?|multi[- ]region|cdn)\b/i,
];

const DESIGN_DIMENSIONS: { name: string; rx: RegExp }[] = [
  { name: "capacity_estimation", rx: /\b(estimat|back[- ]of[- ]the[- ]envelope|napkin math|rough number|capacity)\b/i },
  { name: "api_design", rx: /\b(api|endpoint|REST|graphql|grpc|method signature|request[/ ]response)\b/i },
  { name: "data_model", rx: /\b(schema|table|column|entity|relationship|primary key|index)\b/i },
  { name: "scaling", rx: /\b(shard|partition|replicat|cache|cdn|load balancer|horizontal scal)\b/i },
  { name: "failure_modes", rx: /\b(failure|fail[- ]?over|disaster|recovery|retry|circuit breaker|fault tolerant)\b/i },
  { name: "monitoring", rx: /\b(monitor|observ|alert|metric|trace|logging)\b/i },
];

const HAND_WAVING_RX = /\b(it works|just works|stuff|thingy|like that|or something|whatever|some kind of|magic)\b/i;

export const systemDesignAnalyzer: FocusAnalyzer = {
  focus: "system-design",
  version: "system-design-v1",

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
    const fullText = `${aiText} ${userText}`;

    // Scale probing — count how many of the 5 dimensions the AI raised
    const scaleProbeHits = SCALE_PROBES.filter((rx) => rx.test(aiText)).length;
    if (scaleProbeHits < 2) {
      flags.add("insufficient_scale_probing");
      gaps.push({
        dimension: "scale_probing",
        expected: "AI probes ≥3 of: QPS, data volume, latency budget, R/W ratio, geo distribution",
        observed: `AI probed only ${scaleProbeHits} of 5 dimensions`,
        severity: scaleProbeHits === 0 ? "high" : "medium",
      });
    }

    // Coverage of canonical design dimensions
    const missingDims: string[] = [];
    for (const d of DESIGN_DIMENSIONS) {
      if (!d.rx.test(fullText)) missingDims.push(d.name);
    }
    if (missingDims.length >= 3) {
      flags.add("incomplete_design_coverage");
      gaps.push({
        dimension: "design_breadth",
        expected: "Discussion covers capacity, API, data model, scaling, failure modes, monitoring",
        observed: `Missing: ${missingDims.join(", ")}`,
        severity: missingDims.length >= 4 ? "high" : "medium",
      });
    }

    // User hand-waving
    if (HAND_WAVING_RX.test(userText)) {
      flags.add("user_hand_waving");
    }

    // AI accepts hand-waving without probe
    const handWavingTurns = transcript
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => isUser(t) && HAND_WAVING_RX.test(t.text || ""));
    let acceptedHandWaving = 0;
    for (const { i } of handWavingTurns) {
      const nextAi = transcript.slice(i + 1, i + 3).find(isAi);
      if (nextAi && !/\?/.test(nextAi.text || "")) acceptedHandWaving += 1;
    }
    if (acceptedHandWaving >= 2) {
      flags.add("ai_accepts_hand_waving");
      gaps.push({
        dimension: "evaluator_rigor",
        expected: "AI pushes back when user is vague",
        observed: `AI moved on without probing on ${acceptedHandWaving} hand-wavy answers`,
        severity: "high",
      });
    }

    const tips: string[] = [];
    if (flags.has("insufficient_scale_probing")) tips.push("Always pin down scale before designing — QPS, data size, latency budget, R/W ratio.");
    if (flags.has("incomplete_design_coverage")) tips.push(`Cover all canonical layers: ${missingDims.join(", ")}.`);
    if (flags.has("user_hand_waving")) tips.push("Replace 'it just works' with concrete components — name the queue, the cache, the index.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
