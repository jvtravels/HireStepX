/* Pure checker for the session-report scoring eval.
 *
 * Takes what evaluate-session produced for each golden case and decides
 * pass / fail with reasons. No LLM, no I/O — scripts/eval-report-scoring.ts
 * gathers the outcomes, this module judges them, and the unit tests drive it
 * with hand-built reports.
 *
 * "inconclusive" is reserved for infrastructure failures (provider outage,
 * quota) so a flaky free tier never reads as a scoring regression. */

import { applyBands, type Band, type BandThresholds } from "./_evaluate-session-helpers";
import {
  GROUP_MEAN_MARGIN,
  ORDERING_MARGIN,
  type GoldenCase,
} from "../data/report-scoring-golden";

export type EvalOutcome =
  | { kind: "report"; report: unknown }
  | { kind: "rejected"; status: number; error: string }
  | { kind: "error"; status: number; message: string };

export type CaseStatus = "pass" | "fail" | "inconclusive";

export interface CaseVerdict {
  id: string;
  status: CaseStatus;
  score: number | null;
  band: string | null;
  model: string | null;
  reasons: string[];
}

export interface SuiteVerdict {
  cases: CaseVerdict[];
  passed: number;
  failed: number;
  inconclusive: number;
  /** passed / (passed + failed); null when nothing was conclusive. */
  passRate: number | null;
}

const BANDS: readonly Band[] = ["strongHire", "hire", "leanHire", "noHire", "strongNoHire"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isScore(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
}

function isBand(v: unknown): v is Band {
  return typeof v === "string" && (BANDS as readonly string[]).includes(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function readBandThresholds(calibration: unknown): BandThresholds | null {
  if (!isRecord(calibration) || !isRecord(calibration.bands)) return null;
  const { strongHire, hire, leanHire, noHire } = calibration.bands;
  if (
    typeof strongHire !== "number" ||
    typeof hire !== "number" ||
    typeof leanHire !== "number" ||
    typeof noHire !== "number"
  ) {
    return null;
  }
  return { strongHire, hire, leanHire, noHire };
}

/** Structural completeness + internal consistency of a produced report. Empty array means complete. */
export function checkReportSchema(report: unknown): string[] {
  if (!isRecord(report)) return ["report is not an object"];
  const problems: string[] = [];

  if (!nonEmptyString(report.version)) problems.push("version missing");
  if (!isScore(report.overallScore)) problems.push("overallScore missing or outside 0-100");
  if (
    typeof report.scoreConfidence !== "number" ||
    !Number.isFinite(report.scoreConfidence) ||
    report.scoreConfidence < 0 ||
    report.scoreConfidence > 1
  ) {
    problems.push("scoreConfidence missing or outside 0-1");
  }
  if (!isBand(report.band)) problems.push("band missing or not a known band");
  if (!nonEmptyString(report.verdict)) problems.push("verdict empty");
  if (!nonEmptyString(report.model)) problems.push("model not reported");

  for (const key of ["wins", "fixes", "redFlags"] as const) {
    if (!Array.isArray(report[key])) problems.push(`${key} is not an array`);
  }
  const wins = Array.isArray(report.wins) ? report.wins : [];
  const fixes = Array.isArray(report.fixes) ? report.fixes : [];
  if (wins.length + fixes.length === 0) problems.push("no wins or fixes: report has no coaching content");
  for (const [label, items] of [["wins", wins], ["fixes", fixes]] as const) {
    items.forEach((item, i) => {
      if (!isRecord(item) || !nonEmptyString(item.text)) problems.push(`${label}[${i}] has no text`);
    });
  }

  if (!Array.isArray(report.skills) || report.skills.length === 0) {
    problems.push("skills missing or empty");
  } else {
    report.skills.forEach((s, i) => {
      if (!isRecord(s) || !nonEmptyString(s.name) || !isScore(s.score)) {
        problems.push(`skills[${i}] needs a name and a 0-100 score`);
      }
    });
  }

  if (!Array.isArray(report.perQuestion) || report.perQuestion.length === 0) {
    problems.push("perQuestion missing or empty");
  } else {
    report.perQuestion.forEach((q, i) => {
      if (!isRecord(q) || typeof q.idx !== "number" || !isScore(q.score)) {
        problems.push(`perQuestion[${i}] needs an idx and a 0-100 score`);
      }
    });
  }

  if (!isRecord(report.coreMetrics)) {
    problems.push("coreMetrics missing");
  } else {
    for (const k of ["fillerPerMin", "silenceRatio", "paceWpm", "energy"] as const) {
      if (typeof report.coreMetrics[k] !== "number") problems.push(`coreMetrics.${k} missing`);
    }
  }

  const thresholds = readBandThresholds(report.calibration);
  if (!thresholds) {
    problems.push("calibration.bands missing");
  } else if (isScore(report.overallScore) && isBand(report.band)) {
    const expected = applyBands(report.overallScore, thresholds);
    if (expected !== report.band) {
      problems.push(`band ${report.band} does not match overallScore ${report.overallScore} (calibration says ${expected})`);
    }
  }

  return problems;
}

function pickScore(report: unknown): number | null {
  return isRecord(report) && isScore(report.overallScore) ? report.overallScore : null;
}

function pickString(report: unknown, key: "band" | "model"): string | null {
  return isRecord(report) && typeof report[key] === "string" ? report[key] : null;
}

/** Judge one case in isolation: outcome kind, schema, score band, forbidden bands. */
export function checkCase(golden: GoldenCase, outcome: EvalOutcome): CaseVerdict {
  const verdict: CaseVerdict = {
    id: golden.id,
    status: "pass",
    score: null,
    band: null,
    model: null,
    reasons: [],
  };

  if (outcome.kind === "error") {
    verdict.status = "inconclusive";
    verdict.reasons.push(`provider/infrastructure failure (HTTP ${outcome.status}): ${outcome.message}`);
    return verdict;
  }

  const fail = (reason: string) => {
    verdict.status = "fail";
    verdict.reasons.push(reason);
  };
  const expected = golden.expect;

  if (expected.outcome === "rejected") {
    if (outcome.kind !== "rejected") {
      const score = pickScore(outcome.kind === "report" ? outcome.report : null);
      verdict.score = score;
      fail(`expected the handler to reject with ${expected.status} ${expected.error} but it produced a report${score === null ? "" : ` scoring ${score}`}`);
    } else {
      if (outcome.status !== expected.status) fail(`rejected with ${outcome.status}, expected ${expected.status}`);
      if (outcome.error !== expected.error) fail(`rejected with "${outcome.error}", expected "${expected.error}"`);
    }
    return verdict;
  }

  if (outcome.kind === "rejected") {
    fail(`handler rejected the transcript (${outcome.status} ${outcome.error}) but a report was expected`);
    return verdict;
  }

  verdict.score = pickScore(outcome.report);
  verdict.band = pickString(outcome.report, "band");
  verdict.model = pickString(outcome.report, "model");

  for (const problem of checkReportSchema(outcome.report)) fail(`schema: ${problem}`);

  if (verdict.score !== null) {
    const [min, max] = expected.scoreBand;
    if (verdict.score < min || verdict.score > max) {
      fail(`overallScore ${verdict.score} outside expected band [${min}, ${max}]`);
    }
  }
  if (verdict.band !== null && expected.forbidBands?.some((b) => b === verdict.band)) {
    fail(`band ${verdict.band} is forbidden for this case`);
  }
  return verdict;
}

interface ScoredCase {
  golden: GoldenCase;
  score: number;
}

/** Same-type pairs must respect rank: a higher-ranked case outscores a lower-ranked one by ORDERING_MARGIN. */
export function checkOrdering(scored: readonly ScoredCase[]): Array<{ caseId: string; reason: string }> {
  const failures: Array<{ caseId: string; reason: string }> = [];
  for (const hi of scored) {
    for (const lo of scored) {
      if (hi.golden.rank === undefined || lo.golden.rank === undefined) continue;
      if (hi.golden.rank <= lo.golden.rank) continue;
      if (hi.golden.request.meta.type !== lo.golden.request.meta.type) continue;
      if (hi.score - lo.score < ORDERING_MARGIN) {
        failures.push({
          caseId: hi.golden.id,
          reason: `ordering: ${hi.golden.id} (${hi.score}) must outscore ${lo.golden.id} (${lo.score}) by at least ${ORDERING_MARGIN}`,
        });
      }
    }
  }
  return failures;
}

/** Mean score per rank group must descend by GROUP_MEAN_MARGIN across adjacent groups. */
export function checkGroupMeans(scored: readonly ScoredCase[]): Array<{ caseId: string; reason: string }> {
  const groups = new Map<number, ScoredCase[]>();
  for (const s of scored) {
    if (s.golden.rank === undefined) continue;
    groups.set(s.golden.rank, [...(groups.get(s.golden.rank) ?? []), s]);
  }
  const mean = (xs: ScoredCase[]) => xs.reduce((sum, x) => sum + x.score, 0) / xs.length;
  const failures: Array<{ caseId: string; reason: string }> = [];
  for (const [hiRank, loRank] of [[3, 2], [2, 1]] as const) {
    const hi = groups.get(hiRank);
    const lo = groups.get(loRank);
    if (!hi || !lo) continue;
    const gap = mean(hi) - mean(lo);
    if (gap < GROUP_MEAN_MARGIN) {
      for (const s of hi) {
        failures.push({
          caseId: s.golden.id,
          reason: `ordering: rank ${hiRank} mean ${mean(hi).toFixed(1)} is only ${gap.toFixed(1)} above rank ${loRank} mean ${mean(lo).toFixed(1)} (need ${GROUP_MEAN_MARGIN})`,
        });
      }
    }
  }
  return failures;
}

/** Twin deltas: injection must not lift a score, Hinglish must not sink it. */
export function checkTwins(scored: readonly ScoredCase[]): Array<{ caseId: string; reason: string }> {
  const byId = new Map(scored.map((s) => [s.golden.id, s]));
  const failures: Array<{ caseId: string; reason: string }> = [];
  for (const s of scored) {
    const twin = s.golden.twin;
    if (!twin) continue;
    const other = byId.get(twin.caseId);
    if (!other) continue;
    const delta = s.score - other.score;
    if (twin.minDelta !== undefined && delta < twin.minDelta) {
      failures.push({
        caseId: s.golden.id,
        reason: `twin: scored ${s.score} vs ${twin.caseId} ${other.score} (delta ${delta}, floor ${twin.minDelta})`,
      });
    }
    if (twin.maxDelta !== undefined && delta > twin.maxDelta) {
      failures.push({
        caseId: s.golden.id,
        reason: `twin: scored ${s.score} vs ${twin.caseId} ${other.score} (delta +${delta}, ceiling +${twin.maxDelta})`,
      });
    }
  }
  return failures;
}

/** Judge every case, then the cross-case invariants, and roll up a pass rate over conclusive cases. */
export function evaluateSuite(
  goldens: readonly GoldenCase[],
  outcomes: Readonly<Record<string, EvalOutcome>>,
): SuiteVerdict {
  const cases = goldens.map((golden): CaseVerdict => {
    const outcome = outcomes[golden.id];
    if (!outcome) {
      return { id: golden.id, status: "inconclusive", score: null, band: null, model: null, reasons: ["no outcome recorded"] };
    }
    return checkCase(golden, outcome);
  });

  const scored: ScoredCase[] = [];
  for (const golden of goldens) {
    const v = cases.find((c) => c.id === golden.id);
    if (v && v.status !== "inconclusive" && v.score !== null && golden.expect.outcome === "report") {
      scored.push({ golden, score: v.score });
    }
  }

  const cross = [...checkOrdering(scored), ...checkGroupMeans(scored), ...checkTwins(scored)];
  for (const f of cross) {
    const v = cases.find((c) => c.id === f.caseId);
    if (!v) continue;
    v.status = "fail";
    if (!v.reasons.includes(f.reason)) v.reasons.push(f.reason);
  }

  const passed = cases.filter((c) => c.status === "pass").length;
  const failed = cases.filter((c) => c.status === "fail").length;
  const inconclusive = cases.length - passed - failed;
  return {
    cases,
    passed,
    failed,
    inconclusive,
    passRate: passed + failed === 0 ? null : passed / (passed + failed),
  };
}

export function formatVerdictLine(v: CaseVerdict): string {
  const tag = v.status === "pass" ? "PASS" : v.status === "fail" ? "FAIL" : "SKIP";
  const detail = v.score === null ? "no score" : `score ${v.score}${v.band ? ` (${v.band})` : ""}`;
  const model = v.model ? ` [${v.model}]` : "";
  return `${tag}  ${v.id}  ${detail}${model}`;
}

/** Mirrors the provider labelling used for LLM analytics so eval output lines up with PostHog. */
export function providerOfModel(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("cloudflare") || m.includes("@cf/")) return "cloudflare";
  if (m.includes("gemini")) return "gemini";
  if (m.includes("groq") || m.includes("llama") || m.includes("gpt-oss")) return "groq";
  return m;
}

/** Count of cases answered per model id, so a model swap's blast radius is visible in the run output. */
export function tallyModels(cases: readonly CaseVerdict[]): Array<{ model: string; provider: string; cases: number }> {
  const counts = new Map<string, number>();
  for (const c of cases) {
    if (c.model) counts.set(c.model, (counts.get(c.model) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([model, n]) => ({ model, provider: providerOfModel(model), cases: n }));
}
