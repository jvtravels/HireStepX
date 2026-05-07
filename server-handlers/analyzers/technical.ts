/* Technical interview analyzer — deterministic v1.
 *
 * Catches:
 *   - User claims a Big-O complexity that obviously contradicts their code
 *     (e.g. claims O(n) but pasted code has nested loops)
 *   - AI accepted code without asking about edge cases
 *   - User never wrote (or pasted) any code despite the AI asking for an
 *     implementation
 *   - AI accepted "looks good to me" without verifying correctness
 *   - Discussion never touched test cases / edge cases / time complexity
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

function isAi(t: TranscriptTurn): boolean { return t.speaker.toLowerCase().startsWith("a"); }
function isUser(t: TranscriptTurn): boolean { return t.speaker.toLowerCase().startsWith("u"); }

function looksLikeOn(claim: string): boolean {
  // crude: claim says O(n) or O(log n) — i.e., linear or sublinear
  return /^\s*(?:n|log\s*n|1)\s*$/.test(claim);
}

/** Returns just the code-block content from a turn, or "" if no fenced/declared block. */
function extractCodeOnly(text: string): string {
  const blocks: string[] = [];
  const fenced = text.match(/```[\s\S]*?```/g) || [];
  blocks.push(...fenced);
  // Also catch un-fenced function/def declarations through end-of-text.
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
  // Two loops within 250 chars of each other → likely nested.
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] - positions[i - 1] < 250) return true;
  }
  return false;
}

export const technicalAnalyzer: FocusAnalyzer = {
  focus: "technical",
  version: "technical-v1",

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

    if (aiAskedForCode && !userPastedCode) {
      flags.add("no_code_provided");
      gaps.push({
        dimension: "code_artifact",
        expected: "User provides actual code or pseudo-code when asked",
        observed: "AI asked for an implementation but no code was pasted",
        severity: "medium",
      });
    }

    // Complexity claim vs nested-loop check — scoped to code blocks only.
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

    // Did the AI probe edge cases at all?
    if (userPastedCode && !EDGE_CASE_PROBE.test(aiText)) {
      flags.add("no_edge_case_probing");
      gaps.push({
        dimension: "rigor",
        expected: "AI asks about edge cases, empty input, or boundary conditions",
        observed: "AI accepted code without probing edge cases",
        severity: "medium",
      });
    }

    // Time complexity discussion at all?
    const subText = `${userText} ${aiText}`;
    if (userPastedCode && !COMPLEXITY_DISCUSSION.test(subText)) {
      flags.add("no_complexity_discussion");
    }

    // AI accepted code without any verification language
    if (userPastedCode && ACCEPTANCE.test(aiText) && !EDGE_CASE_PROBE.test(aiText) && !COMPLEXITY_DISCUSSION.test(aiText)) {
      flags.add("ai_accepted_without_verification");
      gaps.push({
        dimension: "evaluator_rigor",
        expected: "AI verifies correctness or complexity before accepting",
        observed: "AI gave acceptance language ('looks good') without probing",
        severity: "high",
      });
    }

    const tips: string[] = [];
    if (flags.has("no_code_provided")) tips.push("When asked to implement, write the code (or pseudo-code) — verbal sketches lose points.");
    if (flags.has("wrong_complexity_claim")) tips.push("Recheck Big-O claims: nested loops are usually O(n²), not O(n) or O(log n).");
    if (flags.has("no_complexity_discussion")) tips.push("Always state time + space complexity after writing code, even if not asked.");
    if (flags.has("no_edge_case_probing")) tips.push("Walk through edge cases (empty input, single element, max size) explicitly.");

    result.rubricGaps = gaps;
    result.flags = Array.from(flags);
    result.coachingNotes = tips.join(" ");
    return result;
  },
};
