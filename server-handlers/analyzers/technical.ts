/* Technical interview analyzer — deterministic v2.
 *
 * v1 covered the obvious correctness traps. v2 adds the things that
 * separate a junior who can solve LeetCode-style problems from someone
 * who can actually ship: clarifying questions, testing instinct,
 * trade-off articulation, language idioms, and ownership framing.
 *
 * Catches:
 *   v1 carryover:
 *     - wrong_complexity_claim         User says O(n) but pasted nested loops
 *     - no_code_provided               AI asked for code, user only narrated
 *     - no_edge_case_probing           AI accepted code without probing edges
 *     - no_complexity_discussion       Big-O / runtime never came up
 *     - ai_accepted_without_verification  AI said "looks good" without verifying
 *   v2 additions:
 *     - jumped_to_code_no_clarifying   User started coding without asking
 *                                      about constraints / input shape
 *     - no_test_walkthrough            User wrote code but never walked
 *                                      through it with a sample input
 *     - no_tradeoff_articulation       Final solution given without naming
 *                                      an alternative + the trade-off
 *     - vague_complexity_claim         "It's pretty fast" / "linear-ish" with
 *                                      no concrete Big-O
 *     - language_anti_pattern          Common rookie idioms in the chosen
 *                                      language (var in JS, == in Python
 *                                      reference equality misunderstanding,
 *                                      string concat in loops in Java, etc.)
 *     - we_heavy_ownership             "We built / we wrote" with no "I" —
 *                                      can't tell what the candidate actually
 *                                      did
 */

import {
  AnalyzerInput,
  AnalyzerResult,
  FocusAnalyzer,
  RubricGap,
  TranscriptTurn,
  emptyResult,
} from "./_types";

// Only treat content as "code" if it's an actual fenced block or a function/def declaration with parens.
// "return null" prose was triggering false positives previously.
const CODE_BLOCK = /```[\s\S]*?```|\b(?:function\s+\w+\s*\(|def\s+\w+\s*\(|class\s+\w+\s*[:{]|public\s+(?:static\s+)?\w+\s+\w+\s*\()/;
const COMPLEXITY_CLAIM = /\bO\s*\(\s*([^)]{1,30})\s*\)/g;
// Two loop tokens within a small window — scoped to actual code blocks (see extractCodeOnly).
const LOOP_TOKEN = /\b(for|while)\s*\(/g;
const EDGE_CASE_PROBE = /\b(edge case|empty (?:input|array|list)|null|undefined|negative|overflow|boundary|what if|test (?:case|with))\b/i;
const COMPLEXITY_DISCUSSION = /\b(complexity|big[- ]o|time complexity|space complexity|runtime)\b/i;
const ASKS_FOR_CODE = /\b(write (?:a |the )?(?:function|code|solution)|implement|code (?:this|it) up|pseudo[- ]?code|how would you (?:code|write))\b/i;
const ACCEPTANCE = /\b(looks good|that works|correct|nice|perfect|great solution|let's move on)\b/i;

/* v2 additions. */

/* Clarifying questions BEFORE the first code attempt — signals the
 * candidate scoped before solving. We accept anything that's a question
 * about input shape, constraints, or examples. */
const CLARIFYING_QUESTION = /\b(what(?:'s|\s+(?:about|if|are|is|happens|s the))|can (?:i|the input|it|we)|are (?:the|there)|is (?:the|it)|do (?:duplicates|negatives|i)|how (?:large|big|many|long)|constraint|sorted|range|sample input|input shape|example|expect|assume|allowed)\b[^?]{0,120}\?/i;

/* User walks through their own code with a concrete example. */
const TEST_WALKTHROUGH = /\b(let'?s (?:walk|trace|run|try) (?:through|with|it)|for example,? (?:if|let|take)|trace (?:through|with)|dry[- ]?run|step through|sample (?:input|run)|input (?:would be|like))\b/i;

/* Trade-off articulation: two distinct approaches + the choice between
 * them. "Could have used X, chose Y because …" patterns. */
const TRADEOFF_LANGUAGE = /\b(?:could (?:have|'?ve) (?:used|done|gone with)|alternative|trade[- ]?off|instead of|versus|vs\.|chose (?:this|x|y) (?:because|over)|the other option|simpler but|faster but|more (?:memory|space) but)\b/i;

/* Vague complexity hand-waves — flag when the user used speed language
 * but no concrete O(...) anywhere. */
const VAGUE_SPEED_LANGUAGE = /\b(pretty (?:fast|quick|efficient)|linear[- ]?ish|quadratic[- ]?ish|fast enough|reasonable speed|should be (?:fast|fine))\b/i;

/* Language anti-patterns — scoped to specific languages we detect. The
 * goal is calibration ("write idiomatic code"), not gotchas. Each match
 * is genuinely rookie. */
const JS_HINT = /\b(let\s+\w+|const\s+\w+|=>\s*\{|console\.log|Array\.from|Map\(|Set\()/;
const PY_HINT = /\bdef\s+\w+\s*\(|->\s*\w+\s*:|import\s+\w+|print\s*\(/;
const JAVA_HINT = /\bpublic\s+(?:static\s+)?\w+\s+\w+\s*\(|System\.out\.println|new\s+ArrayList|new\s+HashMap/;
const JS_ANTIPATTERN = /\bvar\s+\w+\s*=|==(?!=)/; // var + loose-equality
const PY_ANTIPATTERN = /except\s*:|range\s*\(\s*len\s*\(/; // bare-except + range(len()) anti-pattern
const JAVA_ANTIPATTERN = /String\s+\w+\s*=\s*"[^"]*"\s*;[\s\S]{0,200}\+=\s*"/; // string concat in loop (heuristic)

/* "We" heavy — count first-person plural without I-claims around it. */
const WE_TOKEN = /\b(we|our|us)\b/gi;
const I_TOKEN = /\bI\b/g;

function isAi(t: TranscriptTurn): boolean { return t.speaker.toLowerCase().startsWith("a"); }
function isUser(t: TranscriptTurn): boolean { return t.speaker.toLowerCase().startsWith("u"); }

function looksLikeOn(claim: string): boolean {
  return /^\s*(?:n|log\s*n|1)\s*$/.test(claim);
}

/** Returns just the code-block content from a turn, or "" if no fenced/declared block. */
function extractCodeOnly(text: string): string {
  const blocks: string[] = [];
  const fenced = text.match(/```[\s\S]*?```/g) || [];
  blocks.push(...fenced);
  const declMatch = text.match(/(?:function\s+\w+\s*\([\s\S]*|def\s+\w+\s*\([\s\S]*|class\s+\w+\s*[:{][\s\S]*)/);
  if (declMatch && fenced.length === 0) blocks.push(declMatch[0]);
  return blocks.join("\n");
}

function hasNestedLoops(code: string): boolean {
  if (!code) return false;
  LOOP_TOKEN.lastIndex = 0;
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = LOOP_TOKEN.exec(code)) !== null) positions.push(m.index);
  if (positions.length < 2) return false;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] - positions[i - 1] < 250) return true;
  }
  return false;
}

/** True when the user's first substantive turn includes a clarifying
 *  question before any code block appears in the same turn or earlier. */
function userClarifiedBeforeCoding(userTurns: TranscriptTurn[]): boolean {
  for (const t of userTurns) {
    const text = t.text || "";
    // Split at the first code-fence / declaration so we can detect a
    // clarifier that appears in the same turn BEFORE the code starts.
    const fenceIdx = text.search(/```|function\s+\w+\s*\(|def\s+\w+\s*\(|class\s+\w+\s*[:{]/);
    const prefix = fenceIdx >= 0 ? text.slice(0, fenceIdx) : text;
    if (CLARIFYING_QUESTION.test(prefix)) return true;
    if (fenceIdx >= 0) return false; // code appeared, no clarifier before it
  }
  return false;
}

/** Detect language family from the user's pasted code, with anti-pattern
 *  match in the same family. Returns the anti-pattern label or null. */
function detectLanguageAntiPattern(code: string): string | null {
  if (!code) return null;
  if (JS_HINT.test(code) && JS_ANTIPATTERN.test(code)) return "JS: var / loose-equality";
  if (PY_HINT.test(code) && PY_ANTIPATTERN.test(code)) return "Python: bare-except / range(len(...))";
  if (JAVA_HINT.test(code) && JAVA_ANTIPATTERN.test(code)) return "Java: string-concat in loop";
  return null;
}

export const technicalAnalyzer: FocusAnalyzer = {
  focus: "technical",
  version: "technical-v2",

  async analyze({ session }: AnalyzerInput): Promise<AnalyzerResult> {
    const result = emptyResult();
    const transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (transcript.length === 0) {
      result.flags.push("empty_transcript");
      return result;
    }

    const flags = new Set<string>();
    const gaps: RubricGap[] = [];

    const userTurns = transcript.filter(isUser);
    const aiTurns = transcript.filter(isAi);
    const userText = userTurns.map((t) => t.text || "").join(" ");
    const aiText = aiTurns.map((t) => t.text || "").join(" ");

    const aiAskedForCode = ASKS_FOR_CODE.test(aiText);
    const userPastedCode = CODE_BLOCK.test(userText);
    const userCode = extractCodeOnly(userText);

    if (aiAskedForCode && !userPastedCode) {
      flags.add("no_code_provided");
      gaps.push({
        dimension: "code_artifact",
        expected: "User provides actual code or pseudo-code when asked",
        observed: "AI asked for an implementation but no code was pasted",
        severity: "medium",
      });
    }

    // v1: complexity claim vs nested-loop check (per-turn).
    let m: RegExpExecArray | null;
    for (let i = 0; i < userTurns.length; i++) {
      const text = userTurns[i].text || "";
      const code = extractCodeOnly(text);
      if (!code) continue;
      COMPLEXITY_CLAIM.lastIndex = 0;
      while ((m = COMPLEXITY_CLAIM.exec(text)) !== null) {
        const claim = (m[1] || "").trim();
        if (looksLikeOn(claim) && hasNestedLoops(code)) {
          flags.add("wrong_complexity_claim");
          gaps.push({
            dimension: "complexity_correctness",
            expected: `Claimed O(${claim}) should be free of nested iteration`,
            observed: "Code shows nested loops while complexity claim is sub-quadratic",
            severity: "high",
          });
        }
      }
    }

    if (userPastedCode && !EDGE_CASE_PROBE.test(aiText)) {
      flags.add("no_edge_case_probing");
      gaps.push({
        dimension: "rigor",
        expected: "AI asks about edge cases, empty input, or boundary conditions",
        observed: "AI accepted code without probing edge cases",
        severity: "medium",
      });
    }

    const subText = `${userText} ${aiText}`;
    // Either explicit discussion words OR a concrete O(...) claim counts
    // as having addressed complexity. "Time O(n), space O(n)" is the
    // de-facto idiom and shouldn't trip the flag.
    COMPLEXITY_CLAIM.lastIndex = 0;
    const hasExplicitBigO = COMPLEXITY_CLAIM.test(subText);
    if (userPastedCode && !COMPLEXITY_DISCUSSION.test(subText) && !hasExplicitBigO) {
      flags.add("no_complexity_discussion");
    }

    if (userPastedCode && ACCEPTANCE.test(aiText) && !EDGE_CASE_PROBE.test(aiText) && !COMPLEXITY_DISCUSSION.test(aiText)) {
      flags.add("ai_accepted_without_verification");
      gaps.push({
        dimension: "evaluator_rigor",
        expected: "AI verifies correctness or complexity before accepting",
        observed: "AI gave acceptance language ('looks good') without probing",
        severity: "high",
      });
    }

    /* v2: clarifying questions before coding. Only fires when code was
     * actually pasted — if the user just had a discussion, scoping
     * questions aren't required. */
    if (userPastedCode && !userClarifiedBeforeCoding(userTurns)) {
      flags.add("jumped_to_code_no_clarifying");
      gaps.push({
        dimension: "problem_framing",
        expected: "Ask about input constraints, edge cases, or sample I/O before writing code",
        observed: "User jumped straight to implementation without scoping the problem",
        severity: "medium",
      });
    }

    /* v2: test walkthrough — did the user trace their own code with a
     * sample input? */
    if (userPastedCode && !TEST_WALKTHROUGH.test(userText)) {
      flags.add("no_test_walkthrough");
      gaps.push({
        dimension: "verification",
        expected: "Trace the code with a concrete sample input to demonstrate correctness",
        observed: "User wrote code but never walked through a sample run",
        severity: "low",
      });
    }

    /* v2: trade-off articulation — for a senior signal, name an alternative. */
    if (userPastedCode && !TRADEOFF_LANGUAGE.test(userText) && userText.length > 400) {
      flags.add("no_tradeoff_articulation");
      gaps.push({
        dimension: "judgement",
        expected: "Name the alternative approach + the trade-off when presenting a solution",
        observed: "Solution presented as the only option with no alternative considered",
        severity: "low",
      });
    }

    /* v2: vague complexity — speed-talk without concrete Big-O. */
    if (userPastedCode && VAGUE_SPEED_LANGUAGE.test(userText) && !COMPLEXITY_CLAIM.test(userText)) {
      flags.add("vague_complexity_claim");
      gaps.push({
        dimension: "rigor",
        expected: "State concrete O(...) instead of 'pretty fast' / 'linear-ish'",
        observed: "User used vague speed language without naming a complexity",
        severity: "low",
      });
    }

    /* v2: language anti-pattern. */
    const antipattern = detectLanguageAntiPattern(userCode);
    if (antipattern) {
      flags.add("language_anti_pattern");
      gaps.push({
        dimension: "idiomatic_code",
        expected: "Use idiomatic language features (const/let in JS, enumerate in Python, StringBuilder in Java)",
        observed: `Anti-pattern detected — ${antipattern}`,
        severity: "low",
      });
    }

    /* v2: we-heavy ownership in technical narrative. We allow it when
     * the candidate clearly identifies their own slice ("I owned the
     * X part of what we built"), but pure "we wrote / we shipped" with
     * zero first-person is a credibility miss. Only fires past 200
     * words to avoid penalising short coding answers. */
    if (userText.length > 200) {
      const weCount = (userText.match(WE_TOKEN) || []).length;
      const iCount = (userText.match(I_TOKEN) || []).length;
      if (weCount >= 3 && iCount === 0) {
        flags.add("we_heavy_ownership");
        gaps.push({
          dimension: "ownership",
          expected: "Say what *you* specifically did, not just what the team did",
          observed: `${weCount} 'we' references and zero 'I' — can't tell the candidate's individual contribution`,
          severity: "medium",
        });
      }
    }

    const tips: string[] = [];
    if (flags.has("no_code_provided")) tips.push("When asked to implement, write the code (or pseudo-code) — verbal sketches lose points.");
    if (flags.has("wrong_complexity_claim")) tips.push("Recheck Big-O claims: nested loops are usually O(n²), not O(n) or O(log n).");
    if (flags.has("no_complexity_discussion")) tips.push("Always state time + space complexity after writing code, even if not asked.");
    if (flags.has("no_edge_case_probing")) tips.push("Walk through edge cases (empty input, single element, max size) explicitly.");
    if (flags.has("jumped_to_code_no_clarifying")) tips.push("Spend 60 seconds asking about input constraints + sample I/O before you start coding — interviewers grade scoping.");
    if (flags.has("no_test_walkthrough")) tips.push("After writing the function, trace it on a 3-element example out loud — catches off-by-ones live and signals testing instinct.");
    if (flags.has("no_tradeoff_articulation")) tips.push("Name the alternative you didn't pick. 'I went with hash-map; the sort-and-two-pointer version is O(n log n) and uses less memory but slower for this size.'");
    if (flags.has("vague_complexity_claim")) tips.push("Drop 'pretty fast' / 'linear-ish'. State the concrete O(...) and what dominates.");
    if (flags.has("language_anti_pattern")) tips.push("Use idiomatic features: const/let in JS, enumerate() in Python, StringBuilder for loops in Java. Anti-patterns are an easy credibility hit.");
    if (flags.has("we_heavy_ownership")) tips.push("In technical interviews, the interviewer needs to grade *you*. Use 'I built X, the team handled Y' framing rather than blanket 'we'.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
