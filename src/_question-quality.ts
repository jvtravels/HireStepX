/**
 * Question-quality post-filter.
 *
 * Runs against the LLM's generated script BEFORE it ships to the
 * candidate. Catches the classes of low-signal output the prompt
 * rules can't fully prevent:
 *
 *   1. Too short — under 15 words usually means a one-liner that
 *      gives the candidate nothing to land a STAR answer on.
 *   2. Banned LLM-isms — "leverage", "synergize", "deep-dive",
 *      "stakeholder alignment" etc. We already ban these in the
 *      prompt; this is the safety net.
 *   3. Generic templates — "Tell me about yourself" is fine for
 *      Q1 only; treating it as Q3 means the LLM punted.
 *   4. Role-mismatched — for non-opening questions on tech roles,
 *      we expect at least ONE concrete reference to the role's
 *      domain (resume, focus area, target company). Pure
 *      generalities ("Tell me about a time you led a team") are
 *      fine ONCE in a session, not five times.
 *
 * Output: { kept, rejected, downgraded } so the engine can decide
 * whether to retry generation, downgrade specific steps to a
 * generic-but-safe fallback, or accept as-is.
 */

export interface QualityCheckInput {
  type: string;
  aiText: string;
  /** Index in the script (0 = intro, last = closing). */
  idx: number;
  /** Total step count, so we know which slots are "warm-up" vs. "signature". */
  total: number;
}

export interface QualityIssue {
  rule: "too-short" | "banned-llm-ism" | "generic-template-late" | "no-role-anchor";
  detail: string;
}

export interface QualityResult {
  ok: boolean;
  issues: QualityIssue[];
  /** A safe fallback text the engine can substitute if it doesn't want
   *  to retry generation. Empty string means "leave as-is". */
  fallback: string;
}

/* ─── Banned LLM-isms ─── */
const BANNED_PHRASES: { match: RegExp; reason: string }[] = [
  { match: /\bleverag(e|ed|ing)\b/i, reason: "leverage" },
  { match: /\bsynerg(y|ies|ize|ized)\b/i, reason: "synergy" },
  { match: /\bcircle back\b/i, reason: "circle back" },
  { match: /\bdeep[- ]?dive\b/i, reason: "deep-dive" },
  { match: /\bdrive (impact|results|outcomes|value)\b/i, reason: "drive impact" },
  { match: /\bstakeholder alignment\b/i, reason: "stakeholder alignment" },
  { match: /\bbest[- ]in[- ]class\b/i, reason: "best-in-class" },
  { match: /\bworld[- ]class\b/i, reason: "world-class" },
  { match: /\bideat(e|ed|ing|ion)\b/i, reason: "ideate" },
  { match: /\butili[sz](e|ed|ing|ation)\b/i, reason: "utilize" },
  { match: /\bfacilitat(e|ed|ing|ion)\b/i, reason: "facilitate" },
];

/* ─── Generic templates that are only OK as openers ─── */
const GENERIC_OPENER_PATTERNS: RegExp[] = [
  /^(tell me about yourself|walk me through your resume)/i,
  /^(why are you (interested|looking|exploring)|why this (role|company|position))/i,
  /^(what (is|are) your (strengths|weaknesses|career goals))/i,
];

/* ─── Role-domain anchors ─── */
/* These are tokens we expect to see in role-grounded questions for
 * the given focus. If a non-opener question contains NONE of them,
 * it likely lacks specificity. List is intentionally generous —
 * better to accept a fine question than reject a real one. */
const ROLE_ANCHORS_BY_FOCUS: Record<string, RegExp[]> = {
  technical: [/architecture|design|debug|trade[- ]?off|scale|latency|database|api|deploy|incident|on[- ]?call|system|service|microservice|stack|framework|cache|queue|stream|index|schema|query|refactor|review|test|coverage|cursor|copilot|claude|llm|prompt|ai/i],
  "case-study": [/market|customer|user|revenue|cost|cac|ltv|margin|profit|growth|share|segment|hypothesis|estimate|size|breakdown|driver|lever/i],
  "system-design": [/architecture|design|scale|distributed|consistency|partition|cache|database|queue|throughput|latency|bottleneck|trade[- ]?off|capacity|sharding/i],
  behavioral: [/team|stakeholder|deadline|conflict|disagree|owner|priorit|customer|user|ship|deliver|outcome|metric|impact|result|role|project/i],
  "hr-round": [/notice|salary|ctc|leave|join|transition|culture|expectation|value|company|switch|role|growth/i],
  managerial: [/team|hiring|delegate|escalat|stakeholder|priorit|deadline|review|feedback|performance|coach|mentor|onboard|process|retro/i],
  management: [/team|hiring|delegate|escalat|stakeholder|priorit|deadline|review|feedback|performance|coach|mentor|onboard|process|retro/i],
  panel: [/team|stakeholder|trade[- ]?off|outcome|metric|impact|architecture|customer|user|ship/i],
  strategic: [/vision|alignment|roadmap|trade[- ]?off|outcome|metric|stakeholder|second[- ]order|long[- ]term|market|differentiat|positioning/i],
  "campus-placement": [/college|project|intern|academic|fundamental|learn|technology|team|responsib/i],
  "government-psu": [/public|service|ethic|policy|regulation|stakeholder|posting|department|integrity|due[- ]?process/i],
};

/** Extract a role-anchor list for the given focus. Falls back to a
 *  generous list when focus is unrecognised. */
function getRoleAnchors(focus: string): RegExp[] {
  return ROLE_ANCHORS_BY_FOCUS[focus] ?? [/team|project|customer|stakeholder|outcome|metric|trade[- ]?off|design|build|ship|deliver|impact/i];
}

/**
 * Run the quality check against a single step. Returns
 * { ok: true } on a clean pass, or { ok: false, issues, fallback }
 * with a safe replacement string when the question fails.
 *
 * Behaviour:
 *   - intro / closing steps are exempt from anchor + generic checks
 *     (they're framing, not testable questions).
 *   - The first "question" step is exempt from generic-opener +
 *     anchor checks (warmup is supposed to be broad).
 */
export function checkQuestionQuality(
  step: QualityCheckInput,
  focus: string,
  role: string,
): QualityResult {
  const issues: QualityIssue[] = [];
  const text = (step.aiText || "").trim();
  const isFraming = step.type === "intro" || step.type === "closing";
  const isOpener = step.type === "question" && step.idx === 1;

  /* 1. Too short */
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (!isFraming && wordCount < 15) {
    issues.push({ rule: "too-short", detail: `${wordCount} words` });
  }

  /* 2. Banned LLM-isms */
  for (const { match, reason } of BANNED_PHRASES) {
    if (match.test(text)) {
      issues.push({ rule: "banned-llm-ism", detail: reason });
      break;
    }
  }

  /* 3. Generic template used outside the opener slot */
  if (!isFraming && !isOpener) {
    for (const pat of GENERIC_OPENER_PATTERNS) {
      if (pat.test(text)) {
        issues.push({ rule: "generic-template-late", detail: text.slice(0, 60) });
        break;
      }
    }
  }

  /* 4. No role anchor — only for non-opener questions */
  if (!isFraming && !isOpener) {
    const anchors = getRoleAnchors(focus);
    const matchesAnchor = anchors.some((re) => re.test(text));
    if (!matchesAnchor) {
      issues.push({ rule: "no-role-anchor", detail: `no domain token for focus=${focus}` });
    }
  }

  if (issues.length === 0) return { ok: true, issues: [], fallback: "" };

  /* Build a safe fallback. We don't try to be clever — generic but
   * focus-aware questions that won't embarrass us. The downstream
   * follow-up generator will recover real specificity from the
   * candidate's answer. */
  const fallback = buildFallback(step.type, focus, role, step.idx, step.total);
  return { ok: false, issues, fallback };
}

function buildFallback(type: string, focus: string, role: string, idx: number, total: number): string {
  const safeRole = (role || "this role").slice(0, 80);
  if (type === "intro") {
    return `Welcome — thanks for taking the time. We're going to spend the next 20 minutes covering a few areas relevant to ${safeRole}. I'll ask, you talk — there are no trick questions. Ready to start?`;
  }
  if (type === "closing") {
    return "We've covered a lot of ground — thanks. Before we wrap, do you have any questions for me about the role, team, or how the rest of the process unfolds?";
  }
  // questions / follow-ups — pick by focus + position
  if (focus === "technical" || focus === "system-design") {
    if (idx === 1) return `Walk me through one technical project you've shipped recently — what you owned, what you'd redo, what surprised you.`;
    if (idx >= total - 2) return `Tell me about a system you built or owned where things broke at scale. What was the failure mode, and how did you decide what to fix first?`;
    return `Pick a technical decision you made in the last 12 months that you'd defend hardest, and one you'd quietly walk back if asked. Why each?`;
  }
  if (focus === "case-study") {
    if (idx === 1) return `Let's say a B2B SaaS in your domain is seeing 18% MoM signup growth but flat MRR. What's your first hypothesis, and how would you validate it?`;
    return `Stay with the same case — what's the single metric you'd ask the CEO for if you could only have one to make your call?`;
  }
  if (focus === "hr-round") {
    return `Tell me concretely — why are you exploring a change right now, and what's making you think this role specifically (not just any new role)?`;
  }
  if (focus === "salary-negotiation") {
    return `Help me understand where your expectations are anchored — what's driving the number you have in mind?`;
  }
  if (focus === "government-psu") {
    return `Walk me through a decision you've taken where short-term efficiency conflicted with due process. How did you reason about it?`;
  }
  if (focus === "management" || focus === "managerial") {
    return `Tell me about a time you had to escalate a risk to leadership when the team wanted to push through. How did you frame it, and what changed afterwards?`;
  }
  if (focus === "campus-placement") {
    return `Pick a college project or internship you're proudest of — walk me through the problem, your specific contribution, and what you'd do differently.`;
  }
  // Default behavioural-style fallback
  if (idx === 1) {
    return `Tell me about a recent project at work you're proud of — what you owned, what was hard, and how you'd describe the outcome to someone who wasn't there.`;
  }
  if (idx >= total - 2) {
    return `Tell me about a real failure — not a near miss. What went wrong, what did you take responsibility for, and what's different in how you work today because of it?`;
  }
  return `Tell me about a time you disagreed with a teammate or stakeholder on something that mattered. How did you raise it, and where did it land?`;
}
