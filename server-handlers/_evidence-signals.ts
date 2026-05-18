/* HireStepX — Evidence-quality signals.
 *
 * Behavioural audit (May 2026, Senior Product Designer @ Meesho) found
 * that the AI accepted quantified claims like "35-40% improvement" /
 * "task completion lifted by 15-20%" without ever probing for the
 * baseline, the measurement method, or the sample size. Senior
 * interviewers — Director / Bar-Raiser archetypes — push exactly there.
 *
 * This module does the deterministic pre-pass so both surfaces agree:
 *   - live coach (`src/interviewMicroFeedback.ts`) — fires an inline
 *     chip the moment a metric without context arrives, so the
 *     candidate can self-correct on the next turn.
 *   - post-session analyzer (`behavioral.ts`) — surfaces
 *     `metric_without_baseline` as a rubric gap when the pattern is
 *     persistent across the session.
 *
 * Three dimensions of evidence:
 *   - baseline:  "from 4s to 2s" / "before X / now Y" / "previously …"
 *   - method:    "A/B test", "analytics", "session recordings",
 *                "user interviews", "diary study", "telemetry"
 *   - sample:    "N users", "N sessions", "N requests", "N customers"
 *
 * A metric is "well-evidenced" when at least ONE of the three appears
 * within ±120 chars of the number. Tighter than the global text would
 * be — we want the evidence attached to the specific claim, not
 * elsewhere in the answer.
 *
 * No LLM. Pure regex + proximity. Empty / null input must not throw;
 * defaults to {hasMetric:false, missingDimensions:[]}.
 *
 * Test pin: src/__tests__/evidenceSignals.test.ts.
 */

/* Numeric metric — a percentage, currency, multiplier, time delta, or
   a unit-tagged count. Conservative on bare integers: "I led 3 teams"
   or "across 5 engineers" isn't an outcome metric, so unit list
   excludes structural / org counts. Boundary handling: leading
   lookbehind `(?<![\w.])` (no preceding word char or dot, so we don't
   match "p99" or "v3.4"); NO trailing `\b` because `%` / `x` are
   followed by non-word chars (".", ",", " ") that don't form a word
   boundary — the old `\b` swallowed every metric ending in punctuation. */
const METRIC_RE =
  /(?<![\w.])(?:\$|₹)?\d+(?:[.,]\d+)?(?:[\s\-–—]+\d+(?:[.,]\d+)?)?\s*(?:%|percent|x|×|k\b|m\b|b\b|crores?|lakhs?|lpa|million|billion|hours?|minutes?|seconds?|ms\b|s\b|days?|weeks?|months?|years?|users?|customers?|sessions?|requests?|qps|rps|orders?|tickets?|leads?|signups?|installs?|opens?|clicks?|conversions?|bps|basis\s+points?)|(?<![\w.])(?:\$|₹)\d/i;

/* Baseline cues. Comparison-of-states language: "from X to Y", "before
   X (now Y)", "previously / used to". Without one of these, a "+35%"
   number floats untethered. */
const BASELINE_RE =
  /\bfrom\s+\d|\bto\s+\d.*\b(?:from|previously|originally|before)\b|\bbaseline\b|\bbefore\s+(?:the|that|our|we|i)\b|\bpreviously\b|\bused\s+to\s+(?:be|take|sit|run)\b|\boriginally\b|\bdown\s+from\b|\bup\s+from\b|\bcompared\s+to\b|\bversus\s+the\s+(?:old|previous|prior)\b/i;

/* Measurement-method cues. How was the impact captured? A/B tests,
   analytics platforms, qualitative research, telemetry, dashboards.
   The list is intentionally broad on tooling names — anything that
   names a measurement instrument counts. */
const METHOD_RE =
  /\bA[\s\/-]?B\s+(?:test|tested|testing|experiment)\b|\bsplit[\s-]?test\b|\bcontrolled\s+experiment\b|\bexperiment\b|\bholdout\b|\bcohort\b|\banalytics\b|\bmixpanel\b|\bamplitude\b|\bsegment\b|\bgoogle\s+analytics\b|\bga4?\b|\bsession\s+recordings?\b|\bheatmap\b|\bfullstory\b|\bhotjar\b|\bclarity\b|\bclickstream\b|\btelemetry\b|\bdashboard\b|\bgrafana\b|\bdatadog\b|\bkibana\b|\blooker\b|\btableau\b|\bsurveys?\b|\bnps\b|\bcsat\b|\busability\s+test\b|\buser\s+interviews?\b|\bdiary\s+study\b|\bfunnel\s+(?:analysis|metrics)\b|\bretention\s+curve\b/i;

/* Sample-size cues. The metric is grounded against a denominator.
   "30% improvement across 12,000 users" passes; "30% improvement" on
   its own doesn't. Accept both unit-tagged numbers ("12k users") and
   "n=…" notation common in research-flavoured answers. */
/* Note: no outer trailing `\b`. After a `\d+` match the next char is
   often another digit ("240" — the `\b` would fall between 2 and 4,
   which is NOT a word boundary, and the match would fail). Each
   alternation handles its own end-anchor where it matters. */
const SAMPLE_RE =
  /\b(?:n\s*=\s*\d+|sample\s+(?:of|size)\s+\d+|over\s+\d+\s*(?:k|m|users|customers|sessions|requests|orders|installs)|across\s+\d+\s*(?:k|m|users|customers|sessions|teams|services|markets|cities|regions)|on\s+\d+\s*(?:k|m|users|customers|sessions|devices))/i;

export type EvidenceDimension = "baseline" | "method" | "sample";

export interface EvidenceQuality {
  /** Did the answer quote at least one outcome metric? Gate for the
   *  rest of the signal — no metric means no evidence question to ask. */
  hasMetric: boolean;
  /** Which evidence dimensions are NOT attached to the metric within
   *  the proximity window. Ordered baseline → method → sample so the
   *  live-coach picks the most pedagogically useful nudge first. */
  missingDimensions: EvidenceDimension[];
  /** True iff at least one dimension landed within the window. Used by
   *  the post-session analyzer to distinguish "metric quoted, well-
   *  evidenced" from "metric quoted, floats untethered". */
  evidenced: boolean;
}

const PROXIMITY_WINDOW = 120;

/* Scan-pass: for each metric hit, build a ±120-char window and check
 * which evidence cues fall inside it. Aggregate across all metric hits
 * — a single well-evidenced metric is enough to mark a dimension
 * "present" for the answer overall. */
export function detectEvidenceQuality(answer: string | null | undefined): EvidenceQuality {
  const t = answer || "";
  if (!t) return { hasMetric: false, missingDimensions: [], evidenced: false };

  const metricMatches: RegExpExecArray[] = [];
  const re = new RegExp(METRIC_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    metricMatches.push(m);
    if (re.lastIndex === m.index) re.lastIndex++; // guard against zero-width
  }
  if (metricMatches.length === 0) {
    return { hasMetric: false, missingDimensions: [], evidenced: false };
  }

  const present = { baseline: false, method: false, sample: false };
  for (const hit of metricMatches) {
    const start = Math.max(0, hit.index - PROXIMITY_WINDOW);
    const end = Math.min(t.length, hit.index + hit[0].length + PROXIMITY_WINDOW);
    const window = t.slice(start, end);
    if (!present.baseline && BASELINE_RE.test(window)) present.baseline = true;
    if (!present.method && METHOD_RE.test(window)) present.method = true;
    if (!present.sample && SAMPLE_RE.test(window)) present.sample = true;
    if (present.baseline && present.method && present.sample) break;
  }

  const missingDimensions: EvidenceDimension[] = [];
  if (!present.baseline) missingDimensions.push("baseline");
  if (!present.method) missingDimensions.push("method");
  if (!present.sample) missingDimensions.push("sample");

  return {
    hasMetric: true,
    missingDimensions,
    evidenced: missingDimensions.length < 3,
  };
}
