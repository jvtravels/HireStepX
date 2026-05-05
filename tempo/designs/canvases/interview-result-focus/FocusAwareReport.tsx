/* HireStepX — Focus-Aware Result Canvas (DESIGN ONLY)
 *
 * Demonstrates focus-specific result screens. Renders the same overall
 * shape (hero verdict + skill axes + per-question detail with metrics
 * strip + red flags + follow-up) but the CONTENT swaps per focus
 * rubric. Same visual language, focus-specific signals.
 *
 * NOT imported by production. Lives only in the canvas system as a
 * design spec. When production absorbs this, the rubric data file
 * ports to data/, the LLM evaluator branches by focus, and the
 * production SessionReport reads from the rubric instead of the
 * hardcoded Communication/Structure/Leadership/etc. axes.
 */

import React from "react";
import {
  type FocusKey, type FocusRubric, type SkillAxis, type MetricTile, type RedFlagTemplate,
  RUBRICS_BY_FOCUS, UNIVERSAL_METRICS,
} from "./_focus-rubrics";

/* ─── Tokens (mirrors the production cream/copper system) ─── */
const t = {
  cream: "#FAF7F0", white: "#FFFFFF", creamSoft: "#F4EFE3",
  coal: "#0E0C08", indigoGray: "#3E3A6E", inkSoft: "#6E6759", inkFaint: "#A39C8B",
  indigo: "#312E81", indigoDeep: "#1E1B4B", indigo100: "#E5E2F2", indigoRing: "rgba(49, 46, 129, 0.20)",
  copper: "#B45309", copperSoft: "rgba(180,83,9,0.12)", copperLine: "rgba(180,83,9,0.22)",
  success: "#15803D", successSoft: "rgba(21,128,61,0.10)",
  error: "#B91C1C", errorSoft: "rgba(185,28,28,0.10)",
  line: "rgba(20,17,10,0.08)", lineStrong: "rgba(20,17,10,0.14)",
};
const f = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "Inter, system-ui, sans-serif",
  mono: "'JetBrains Mono', Menlo, monospace",
};

/* ─── Mock data shape per focus ─── */

export interface MockResult {
  focus: FocusKey;
  candidateName: string;
  role: string;
  company: string;
  overallScore: number;
  scoreBand: "weak" | "partial" | "strong";
  scoreDelta: number; // vs last session
  /** 0-100 per axis. Length must match rubric.skillAxes. */
  axisScores: number[];
  /** Per-question results — array of QResult. */
  questions: QResult[];
}

export interface QResult {
  index: number;
  text: string;
  score: number;
  band: "weak" | "partial" | "strong";
  whyScored: string;
  /** Focus-specific values matching rubric.metricsStrip in order. */
  metricValues: (string | number | boolean)[];
  /** Universal metrics — filler/100w, pace, hedging. */
  universalValues: [number, number, number];
  redFlags: { type: string; evidence: string }[];
  followUp?: string;
  band_specific_explanation?: string;
}

/* ─── Hero score gauge ─── */

function ScoreGauge({ score, band }: { score: number; band: "weak" | "partial" | "strong" }) {
  const color = band === "strong" ? t.success : band === "partial" ? t.copper : t.error;
  const circ = 2 * Math.PI * 60;
  const dash = (score / 100) * circ;
  return (
    <svg width="148" height="148" viewBox="0 0 148 148" aria-label={`Score: ${score} of 100`}>
      <circle cx="74" cy="74" r="60" fill="none" stroke={t.line} strokeWidth="10" />
      <circle
        cx="74" cy="74" r="60" fill="none" stroke={color} strokeWidth="10"
        strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
        transform="rotate(-90 74 74)"
      />
      <text x="74" y="78" textAnchor="middle" dominantBaseline="middle"
        fontFamily={f.mono} fontSize="32" fontWeight={600} fill={t.coal}>
        {score}
      </text>
      <text x="74" y="100" textAnchor="middle"
        fontFamily={f.mono} fontSize="9" fill={t.inkSoft} letterSpacing="2">
        / 100
      </text>
    </svg>
  );
}

/* ─── Skill axis bar ─── */

function SkillBar({ axis, score }: { axis: SkillAxis; score: number }) {
  const color = score >= 70 ? t.success : score >= 50 ? t.copper : t.error;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>
            {axis.label}
          </span>
          <span style={{ fontFamily: f.sans, fontSize: 11, color: t.inkSoft, lineHeight: 1.45 }}>
            {axis.description}
          </span>
        </div>
        <span style={{ fontFamily: f.mono, fontSize: 13, fontWeight: 600, color }}>{score}</span>
      </div>
      <div style={{ width: "100%", height: 4, background: t.line, borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

/* ─── Metric tile ─── */

function MetricTileView({ tile, value }: { tile: MetricTile; value: string | number | boolean }) {
  const display = (() => {
    if (tile.format === "boolean") return value ? "Yes" : "No";
    if (tile.format === "currency") return value ? `${value}` : "—";
    if (tile.format === "percent") return `${value}%`;
    if (tile.format === "duration") return `${value}s`;
    return String(value);
  })();
  /* tone-driven colour: high-good means a low value is bad. */
  const toneColor = (() => {
    if (tile.tone === "neutral") return t.coal;
    const num = typeof value === "number" ? value : value === true ? 100 : value === false ? 0 : -1;
    if (num < 0) return t.coal;
    if (tile.tone === "high-good") return num >= 50 ? t.success : num <= 10 ? t.error : t.copper;
    if (tile.tone === "low-good") return num <= 3 ? t.success : num >= 7 ? t.error : t.copper;
    return t.coal;
  })();
  return (
    <div style={{ display: "flex", flexDirection: "column", minWidth: 80 }}>
      <span style={{
        fontFamily: f.mono, fontSize: 9, fontWeight: 600, letterSpacing: "0.10em",
        textTransform: "uppercase", color: t.inkSoft,
      }} title={tile.description}>
        {tile.label}
      </span>
      <span style={{
        fontFamily: f.mono, fontSize: 14, fontWeight: 600,
        color: toneColor, marginTop: 2,
      }}>
        {display}
      </span>
    </div>
  );
}

/* ─── Red flag block ─── */

function RedFlagItem({ template, evidence }: { template: RedFlagTemplate; evidence: string }) {
  const filled = template.explanation.replace(/\{\{evidence\}\}/g, evidence);
  return (
    <li style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.error}
        strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden
        style={{ flexShrink: 0, marginTop: 2 }}>
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div>
        <div style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>
          {template.title}
        </div>
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.indigoGray, lineHeight: 1.55, marginTop: 2 }}>
          {filled}
        </div>
      </div>
    </li>
  );
}

/* ─── Per-question detail ─── */

function QuestionDetail({ q, rubric }: { q: QResult; rubric: FocusRubric }) {
  const heading = rubric.verdictHeading[q.band];
  const flagTemplates = q.redFlags
    .map((rf) => ({ template: rubric.redFlagCatalog.find((c) => c.type === rf.type), evidence: rf.evidence }))
    .filter((x): x is { template: RedFlagTemplate; evidence: string } => !!x.template);

  const bandColor = q.band === "strong" ? t.success : q.band === "partial" ? t.copper : t.error;

  return (
    <div style={{
      background: t.white, border: `1px solid ${t.line}`, borderLeft: `3px solid ${bandColor}`,
      borderRadius: 12, padding: "18px 20px", marginBottom: 14,
    }}>
      {/* Question header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 4 }}>
        <span style={{ fontFamily: f.mono, fontSize: 11, fontWeight: 600, color: t.inkSoft }}>
          Q{q.index}
        </span>
        <span style={{ fontFamily: f.mono, fontSize: 14, fontWeight: 600, color: bandColor }}>
          {q.score} <span style={{ color: t.inkFaint, fontWeight: 400 }}>/ 100</span>
        </span>
      </div>
      <p style={{ fontFamily: f.serif, fontSize: 17, color: t.coal, lineHeight: 1.45, margin: "4px 0 16px" }}>
        {q.text}
      </p>

      {/* Two-column: focus-specific metrics strip + universal sub-strip */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 16,
        padding: "12px 14px", background: t.creamSoft, borderRadius: 8, marginBottom: 16,
      }}>
        {rubric.metricsStrip.map((tile, i) => (
          <MetricTileView key={i} tile={tile} value={q.metricValues[i]} />
        ))}
        <span aria-hidden style={{ width: 1, alignSelf: "stretch", background: t.lineStrong }} />
        {UNIVERSAL_METRICS.map((tile, i) => (
          <MetricTileView key={`u${i}`} tile={tile} value={q.universalValues[i]} />
        ))}
      </div>

      {/* Coaching block — heading flips by band */}
      <div style={{
        background: q.band === "strong" ? t.successSoft : t.copperSoft,
        border: `1px solid ${q.band === "strong" ? "rgba(21,128,61,0.20)" : t.copperLine}`,
        borderRadius: 10, padding: "14px 16px",
      }}>
        <div style={{
          fontFamily: f.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
          textTransform: "uppercase", color: q.band === "strong" ? t.success : t.copper,
        }}>
          {heading}
        </div>
        <p style={{
          fontFamily: f.sans, fontSize: 14, color: t.coal, lineHeight: 1.55, margin: "6px 0 0",
        }}>
          {q.whyScored}
        </p>
        {flagTemplates.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0" }}>
            {flagTemplates.map((rf, i) => (
              <RedFlagItem key={i} template={rf.template} evidence={rf.evidence} />
            ))}
          </ul>
        )}
        {q.followUp && (
          <div style={{
            marginTop: 14, padding: "10px 12px",
            background: "rgba(255,255,255,0.5)", borderRadius: 6,
            border: `1px solid ${t.line}`,
          }}>
            <div style={{
              fontFamily: f.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em",
              textTransform: "uppercase", color: t.indigoGray,
            }}>
              Likely follow-up
            </div>
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, lineHeight: 1.5, margin: "4px 0 0" }}>
              {q.followUp}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Full report ─── */

export interface FocusAwareReportProps {
  result: MockResult;
}

/* ─── Storyboard demo wrappers — referenced by index.canvas.tsx ─── */

const BEHAVIORAL_STRONG: MockResult = {
  focus: "behavioral",
  candidateName: "Jay",
  role: "Senior Product Designer",
  company: "Razorpay",
  overallScore: 82,
  scoreBand: "strong",
  scoreDelta: 6,
  axisScores: [85, 78, 88, 70, 90, 80],
  questions: [
    {
      index: 1,
      text: "Tell me about a time you took an unpopular decision. What did the team say?",
      score: 84,
      band: "strong",
      whyScored: "You named the situation concretely (Q3 2024, design system migration), used 'I' 8 times in the action — clear ownership — and closed with a measurable outcome (40% fewer review cycles). The reflection at the end was the cherry on top.",
      metricValues: [218, 64, 5, 100],
      universalValues: [2, 158, 1],
      redFlags: [],
      followUp: "What would you do differently if you had to do it again?",
    },
    {
      index: 2,
      text: "Walk me through a project where you had to convince a senior leader.",
      score: 76,
      band: "partial",
      whyScored: "Solid setup but you used 'we' more than 'I' in the Action section. The interviewer wants to know what YOU specifically did to land the conversation, not the team's collective work.",
      metricValues: [195, 38, 3, 75],
      universalValues: [4, 162, 3],
      redFlags: [{ type: "all-we-no-i", evidence: "12, 3" }],
      followUp: "What was the specific moment that turned the conversation?",
    },
  ],
};

const TECHNICAL_PARTIAL: MockResult = {
  focus: "technical",
  candidateName: "Priya",
  role: "Senior Software Engineer",
  company: "Flipkart",
  overallScore: 64,
  scoreBand: "partial",
  scoreDelta: 0,
  axisScores: [70, 50, 45, 75, 60, 30],
  questions: [
    {
      index: 1,
      text: "Reverse a linked list in O(1) extra space, then explain when you'd use this in production.",
      score: 72,
      band: "partial",
      whyScored: "You reached the optimal iterative solution and your communication was strong throughout. Two gaps: you skipped naming the recursive O(n) space approach first, and you didn't articulate the time/space complexity for your final answer.",
      metricValues: [1, false, 2, 1],
      universalValues: [3, 145, 2],
      redFlags: [
        { type: "skipped-brute-force", evidence: "the iterative two-pointer approach" },
        { type: "no-complexity", evidence: "" },
      ],
      followUp: "What's the time and space complexity of your final solution?",
    },
    {
      index: 2,
      text: "Design a system to predict same-day delivery feasibility for a new pincode in tier-3 India.",
      score: 56,
      band: "weak",
      whyScored: "You jumped straight into 'I'd use ML' without first asking about constraints (existing logistics data, pincode coverage, peak QPS). Strong system-design starts with requirements, not solutions.",
      metricValues: [1, false, 0, 0],
      universalValues: [5, 140, 4],
      redFlags: [
        { type: "skipped-brute-force", evidence: "ML-based solution from the first sentence" },
        { type: "missed-edge-cases", evidence: "monsoon-disrupted pincodes, kirana partner availability" },
        { type: "no-trade-offs", evidence: "" },
      ],
      followUp: "What if you had no historical delivery data for that pincode yet?",
    },
  ],
};

const CASE_STUDY_STRONG: MockResult = {
  focus: "case-study",
  candidateName: "Rahul",
  role: "Senior Product Manager",
  company: "Swiggy",
  overallScore: 78,
  scoreBand: "strong",
  scoreDelta: 8,
  axisScores: [90, 75, 80, 70, 85, 65],
  questions: [
    {
      index: 1,
      text: "A restaurant partner's order acceptance rate has dropped from 92% to 78% over two weeks. Walk me through your investigation.",
      score: 82,
      band: "strong",
      whyScored: "Excellent framework usage — you opened with 'Let me use a Diagnose framework' and segmented by city/cohort/time consistently. You named the specific affected customer ('tier-2 working professional restaurant owners') and drove to a clear recommendation. One gap: you didn't define a primary success metric for the intervention.",
      metricValues: [true, 4, true, 1],
      universalValues: [3, 152, 2],
      redFlags: [{ type: "no-metrics", evidence: "" }],
      followUp: "If you had only one metric to define success of this intervention, which one?",
    },
  ],
};

const SALARY_NEG_WEAK: MockResult = {
  focus: "salary-negotiation",
  candidateName: "Sneha",
  role: "Senior Engineering Manager",
  company: "PhonePe",
  overallScore: 38,
  scoreBand: "weak",
  scoreDelta: -4,
  axisScores: [25, 20, 0, 35, 50, 70],
  questions: [
    {
      index: 1,
      text: "Our offer is \u20B938 LPA fixed plus 12% variable. We think that's competitive for your level. What's your reaction?",
      score: 30,
      band: "weak",
      whyScored: "You said 'that sounds fair, let me think about it' and ended the call. That's the textbook 'left value on the table' move — even neutral candidates counter-anchor with a specific number. You stayed in offer-reaction phase the whole call; never advanced to counter-offer or benefits discussion.",
      metricValues: ["\u2014", 0, false, 1],
      universalValues: [2, 138, 5],
      redFlags: [
        { type: "no-anchor", evidence: "" },
        { type: "accepted-first-offer", evidence: "that sounds fair, let me think about it" },
        { type: "no-package-depth", evidence: "only base discussed" },
        { type: "no-batna", evidence: "no competing offer or alternative mentioned" },
        { type: "phase-stalled", evidence: "" },
      ],
      followUp: "What's your minimum acceptable package?",
    },
    {
      index: 2,
      text: "I hear you on the base. The ESOPs vest over 4 years and we believe they'll be worth significantly more by then. Does that change your thinking?",
      score: 46,
      band: "weak",
      whyScored: "You hedged with 'I'd need to think about it.' This was your moment to introduce package depth — ask about the ESOP strike price, valuation methodology, signing bonus, or notice-period flexibility. Strong negotiators turn ESOP pushback into a 4-lever conversation.",
      metricValues: ["\u2014", 1, false, 1],
      universalValues: [3, 142, 6],
      redFlags: [
        { type: "no-package-depth", evidence: "didn't probe ESOP details, signing, or other levers" },
        { type: "no-batna", evidence: "" },
      ],
      followUp: "If we can't move on base, what else matters most to you?",
    },
  ],
};

const SALARY_NEG_STRONG: MockResult = {
  focus: "salary-negotiation",
  candidateName: "Arjun",
  role: "Senior Engineering Manager",
  company: "PhonePe",
  overallScore: 84,
  scoreBand: "strong",
  scoreDelta: 12,
  axisScores: [90, 85, 80, 88, 75, 80],
  questions: [
    {
      index: 1,
      text: "Our offer is \u20B938 LPA fixed plus 12% variable. We think that's competitive for your level. What's your reaction?",
      score: 86,
      band: "strong",
      whyScored: "Textbook anchor: you countered immediately with \u20B952L base + 15% variable, citing market data from your last two interviews. You named a competing offer at Razorpay, which gave you real leverage. You also opened the door to package conversation by asking about ESOPs, signing, and notice-period flexibility — five levers in two minutes.",
      metricValues: ["\u20B952L", 5, true, 4],
      universalValues: [2, 156, 1],
      redFlags: [],
      followUp: "If we landed at \u20B948L base, what would close the gap on the rest?",
    },
  ],
};

/* ─── Phase 2 + Phase 3 mock data ─────────────────────────────── */

const SYSTEM_DESIGN_PARTIAL: MockResult = {
  focus: "system-design",
  candidateName: "Vikram",
  role: "Senior Software Engineer",
  company: "PhonePe",
  overallScore: 62,
  scoreBand: "partial",
  scoreDelta: 5,
  /* Requirements, Capacity, Decomposition, DB, Scaling, Failure modes */
  axisScores: [40, 30, 75, 65, 70, 50],
  questions: [
    {
      index: 1,
      text: "Design a system to handle 100M daily UPI transactions with p99 < 200ms.",
      score: 62,
      band: "partial",
      whyScored: "Strong on decomposition (you named LB → API → Redis → Postgres → Kafka cleanly) and scaling (sharded by user_id, async writes via queue). Two gaps: you skipped requirements gathering and went straight to architecture, and you didn't state capacity numbers — 'we'd handle high traffic' isn't enough at this scale.",
      metricValues: [6, false, true, 2],
      universalValues: [3, 142, 4],
      redFlags: [
        { type: "skipped-requirements", evidence: "30" },
        { type: "no-capacity-numbers", evidence: "" },
      ],
      followUp: "What if 99.99% availability is required during festival peaks?",
    },
  ],
};

const STRATEGIC_STRONG: MockResult = {
  focus: "strategic",
  candidateName: "Anjali",
  role: "VP of Engineering",
  company: "Razorpay",
  overallScore: 80,
  scoreBand: "strong",
  scoreDelta: 6,
  /* Vision, Stakeholder, Resource, Time horizon, Conviction, Influence */
  axisScores: [85, 90, 75, 80, 78, 70],
  questions: [
    {
      index: 1,
      text: "You inherit a 60-person engineering org with 3 missed quarterly goals. What's your 90-day plan?",
      score: 82,
      band: "strong",
      whyScored: "Excellent stakeholder mapping — you named 4 distinct constituencies (engineering, product, sales, board) and held the trade-off between them. Vision was concrete ('in 3 years we ship weekly with 40 fewer engineers'). The bet you named — that 3 missed quarters were a process problem, not a talent problem — was specific and falsifiable. Light on influence reasoning: you didn't address how you'd build CEO alignment if your read of the problem differed.",
      metricValues: [4, 3, 5, true],
      universalValues: [2, 148, 1],
      redFlags: [],
      followUp: "How would you build alignment with the CEO if they thought it was a talent problem?",
    },
  ],
};

const CAMPUS_PLACEMENT_PARTIAL: MockResult = {
  focus: "campus-placement",
  candidateName: "Rohan",
  role: "Software Engineer (Fresher)",
  company: "Infosys",
  overallScore: 58,
  scoreBand: "partial",
  scoreDelta: 0,
  /* Project ownership, Project depth, Fundamentals, Enthusiasm, Coachability, Communication */
  axisScores: [45, 40, 70, 65, 50, 75],
  questions: [
    {
      index: 1,
      text: "Walk me through your final-year project. What was your specific contribution?",
      score: 56,
      band: "partial",
      whyScored: "You communicated cleanly and showed enthusiasm, but the project section drifted into 'we' for most of the architecture description, and your tech-stack reasoning was surface-level ('we used MongoDB' without why). Fundamentals were solid when probed. Strongest signal: you mentioned a specific bug you debugged — that landed.",
      metricValues: [38, 2, 5, 1],
      universalValues: [3, 150, 3],
      redFlags: [
        { type: "vague-project-role", evidence: "we built the backend" },
        { type: "surface-only-tech", evidence: "MongoDB / Express / React without justification" },
      ],
      followUp: "What was the hardest bug you debugged in this project, and how did you find it?",
    },
  ],
};

const HR_WEAK: MockResult = {
  focus: "hr",
  candidateName: "Karthik",
  role: "Senior Product Manager",
  company: "Flipkart",
  overallScore: 42,
  scoreBand: "weak",
  scoreDelta: -3,
  /* Specificity, Authenticity, Coherence, Salary realism, Cultural alignment, Red-flag absence */
  axisScores: [30, 35, 50, 40, 45, 25],
  questions: [
    {
      index: 1,
      text: "Why are you leaving your current role?",
      score: 38,
      band: "weak",
      whyScored: "Your answer leaned negative — 'my current manager doesn't appreciate me' — which HR reads as 'this candidate will badmouth us next.' The motivation for joining Flipkart was generic ('great company, great opportunity'). No specific research showed: no mention of Flipkart's recent product launches, engineering blog, or cultural attributes you actually researched.",
      metricValues: [1, 1, false, 4],
      universalValues: [4, 156, 2],
      redFlags: [
        { type: "badmouthing", evidence: "my current manager doesn't appreciate me" },
        { type: "generic-motivation", evidence: "great company, great opportunity" },
        { type: "vague-trajectory", evidence: "" },
      ],
      followUp: "What specifically about Flipkart's product strategy resonates with your background?",
    },
  ],
};

const PANEL_STRONG: MockResult = {
  focus: "panel",
  candidateName: "Meera",
  role: "Senior Software Engineer",
  company: "Swiggy",
  overallScore: 78,
  scoreBand: "strong",
  scoreDelta: 4,
  /* Persona, Tone, Consistency, Acknowledgment, Engagement balance, Routing */
  axisScores: [85, 75, 90, 70, 80, 75],
  questions: [
    {
      index: 1,
      text: "[Hiring Manager] Tell me about a time you led a peer team that disagreed with you.",
      score: 84,
      band: "strong",
      whyScored: "You answered the manager directly, framed the story around influence and outcomes (manager-track lens), then naturally pivoted at the end — 'On the technical side, the trade-off was between X and Y, which I'd love to dig into with [Tech Lead]' — that bridge was a strong signal. You also held eye contact with all three panelists when scanning the room.",
      metricValues: [3, 90, 2, 1],
      universalValues: [2, 152, 1],
      redFlags: [],
      followUp: "[Tech Lead] What was the technical trade-off you wanted to dig into?",
    },
    {
      index: 2,
      text: "[HR Partner] How do you handle stress during high-pressure releases?",
      score: 72,
      band: "partial",
      whyScored: "Tone-shifted nicely (more conversational, less technical) for the HR partner. But you missed the underlying concern — they were probing for burnout risk and team-health awareness. You answered the literal question (what you do when stressed) instead of addressing what HR actually wanted to know.",
      metricValues: [3, 100, 1, 0],
      universalValues: [3, 148, 2],
      redFlags: [
        { type: "missed-the-real-question", evidence: "burnout risk + team-health awareness" },
      ],
      followUp: "How do you spot burnout in a teammate before they do?",
    },
  ],
};

const GOVERNMENT_PARTIAL: MockResult = {
  focus: "government",
  candidateName: "Aditya",
  role: "Assistant Section Officer (UPSC)",
  company: "Government of India",
  overallScore: 60,
  scoreBand: "partial",
  scoreDelta: 0,
  /* Ethics, Service, Current affairs, Hierarchy, Regulatory, Specific examples */
  axisScores: [70, 55, 40, 80, 65, 50],
  questions: [
    {
      index: 1,
      text: "If your senior asks you to expedite a file that violates due process, what do you do?",
      score: 64,
      band: "partial",
      whyScored: "Your ethics framing was strong — you distinguished between hierarchical respect and procedural integrity, and used 'with respect, sir' framing throughout. Hierarchy tone was appropriate. But your answer stayed abstract: you didn't cite any specific RTI Act provisions or recent rulings (e.g. the Vineeta Sharma judgment) that would back your position. Specifics matter more than principles in government rounds.",
      metricValues: [4, 0, 6, 0],
      universalValues: [3, 138, 2],
      redFlags: [
        { type: "no-current-affairs", evidence: "no specific Act or ruling cited" },
      ],
      followUp: "What's a recent Supreme Court ruling on administrative discretion that informed your view?",
    },
  ],
};

/* Demo wrappers — each renders the report with preset data. The
   storyboards in index.canvas.tsx import these by name. */
export function BehavioralStrongDemo() { return <FocusAwareReport result={BEHAVIORAL_STRONG} />; }
export function TechnicalPartialDemo() { return <FocusAwareReport result={TECHNICAL_PARTIAL} />; }
export function CaseStudyStrongDemo() { return <FocusAwareReport result={CASE_STUDY_STRONG} />; }
export function SalaryNegWeakDemo() { return <FocusAwareReport result={SALARY_NEG_WEAK} />; }
export function SalaryNegStrongDemo() { return <FocusAwareReport result={SALARY_NEG_STRONG} />; }
export function SystemDesignPartialDemo() { return <FocusAwareReport result={SYSTEM_DESIGN_PARTIAL} />; }
export function StrategicStrongDemo() { return <FocusAwareReport result={STRATEGIC_STRONG} />; }
export function CampusPlacementPartialDemo() { return <FocusAwareReport result={CAMPUS_PLACEMENT_PARTIAL} />; }
export function HRWeakDemo() { return <FocusAwareReport result={HR_WEAK} />; }
export function PanelStrongDemo() { return <FocusAwareReport result={PANEL_STRONG} />; }
export function GovernmentPartialDemo() { return <FocusAwareReport result={GOVERNMENT_PARTIAL} />; }

export default function FocusAwareReport({ result }: FocusAwareReportProps) {
  const rubric = RUBRICS_BY_FOCUS[result.focus];
  if (!rubric) {
    return (
      <div style={{ padding: 40, fontFamily: f.sans, color: t.coal }}>
        No rubric defined for focus &ldquo;{result.focus}&rdquo;. Phase 2 will add it.
      </div>
    );
  }

  const FOCUS_LABEL: Partial<Record<FocusKey, string>> = {
    behavioral: "Behavioural",
    technical: "Technical",
    "case-study": "Case Study",
    "salary-negotiation": "Salary Negotiation",
    "system-design": "System Design",
    strategic: "Strategic / Leadership",
    "campus-placement": "Campus Placement",
    hr: "HR Round",
    panel: "Panel",
    government: "Government / PSU",
  };

  const bandLabel = result.scoreBand === "strong" ? "Strong" : result.scoreBand === "partial" ? "Lean Hire" : "Below Bar";
  const bandColor = result.scoreBand === "strong" ? t.success : result.scoreBand === "partial" ? t.copper : t.error;

  return (
    <div style={{
      background: t.cream, color: t.coal, minHeight: "100vh",
      fontFamily: f.sans, padding: "48px 24px 80px",
    }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* Eyebrow — focus type front-and-centre */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10, padding: "5px 12px",
          background: t.copperSoft, border: `1px solid ${t.copperLine}`, borderRadius: 999,
          marginBottom: 16,
        }}>
          <span style={{
            fontFamily: f.mono, fontSize: 10, fontWeight: 600, letterSpacing: "0.10em",
            textTransform: "uppercase", color: t.copper,
          }}>
            {FOCUS_LABEL[result.focus]} round · {result.company}
          </span>
        </div>

        {/* H1 */}
        <h1 style={{
          fontFamily: f.serif, fontSize: 36, fontWeight: 400, letterSpacing: "-0.015em",
          lineHeight: 1.15, margin: 0, color: t.coal,
        }}>
          Hi {result.candidateName} — here's what your <em style={{ color: t.copper, fontStyle: "italic" }}>{FOCUS_LABEL[result.focus]?.toLowerCase()}</em> round looked like.
        </h1>

        {/* Hero — score + verdict */}
        <div style={{
          display: "flex", gap: 28, alignItems: "center",
          marginTop: 28, padding: 24, background: t.white, borderRadius: 16,
          border: `1px solid ${t.line}`,
        }}>
          <ScoreGauge score={result.overallScore} band={result.scoreBand} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
              background: `${bandColor}15`, border: `1px solid ${bandColor}40`, borderRadius: 999,
              fontFamily: f.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
              textTransform: "uppercase", color: bandColor,
            }}>
              {bandLabel}
            </div>
            <p style={{
              fontFamily: f.serif, fontStyle: "italic", fontSize: 18, lineHeight: 1.55,
              color: t.indigoGray, marginTop: 12, marginBottom: 0,
            }}>
              {rubric.evaluationStatement}
            </p>
            {result.scoreDelta !== 0 && (
              <div style={{
                marginTop: 14, fontFamily: f.mono, fontSize: 12,
                color: result.scoreDelta > 0 ? t.success : t.error,
              }}>
                {result.scoreDelta > 0 ? "↑" : "↓"} {Math.abs(result.scoreDelta)} from your last {FOCUS_LABEL[result.focus]?.toLowerCase()} session
              </div>
            )}
          </div>
        </div>

        {/* Skill axes — focus-specific */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{
            fontFamily: f.serif, fontSize: 22, fontWeight: 400, letterSpacing: "-0.01em",
            margin: 0,
          }}>
            Skill breakdown
          </h2>
          <p style={{
            fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 4, marginBottom: 24,
          }}>
            What real {FOCUS_LABEL[result.focus]?.toLowerCase()} interviewers grade — different from generic interview skills.
          </p>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28,
            background: t.white, padding: "24px 26px", borderRadius: 12,
            border: `1px solid ${t.line}`,
          }}>
            {rubric.skillAxes.map((axis, i) => (
              <SkillBar key={axis.label} axis={axis} score={result.axisScores[i] ?? 50} />
            ))}
          </div>
        </section>

        {/* Per-question detail */}
        <section style={{ marginTop: 40 }}>
          <h2 style={{
            fontFamily: f.serif, fontSize: 22, fontWeight: 400, letterSpacing: "-0.01em",
            margin: "0 0 4px",
          }}>
            Question-by-question
          </h2>
          <p style={{
            fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginBottom: 20,
          }}>
            Each question is scored against the {FOCUS_LABEL[result.focus]?.toLowerCase()} rubric. Universal metrics (filler / pace / hedging) appear after the focus-specific column.
          </p>
          {result.questions.map((q) => (
            <QuestionDetail key={q.index} q={q} rubric={rubric} />
          ))}
        </section>

        {/* Footer note — explains why this is different from generic */}
        <div style={{
          marginTop: 40, padding: "20px 24px",
          background: t.indigo100, border: `1px solid ${t.indigoRing}`, borderRadius: 12,
          fontFamily: f.sans, fontSize: 13, color: t.indigoDeep, lineHeight: 1.6,
        }}>
          <div style={{
            fontFamily: f.mono, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em",
            textTransform: "uppercase", color: t.indigo, marginBottom: 6,
          }}>
            Why these metrics?
          </div>
          {rubric.evaluationStatement} The generic interview-prep tools grade every interview type the same way — quantification count, first-person ratio, STAR completeness — even when those signals aren&rsquo;t what the focus area actually evaluates. HireStepX adapts the rubric to what real {FOCUS_LABEL[result.focus]?.toLowerCase()} interviewers grade.
        </div>
      </div>
    </div>
  );
}
