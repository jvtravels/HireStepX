/* STT-fragility reproducer tests.
 *
 * Follow-up to commit f5289f3 which fixed an STT mishear of "LPA" → "LPE"
 * that caused entire sessions to ghost. The narrow fix landed in two
 * parsers. This audit broadens the lens to other candidate-text parsers
 * that consume voice-transcribed input and have the same shape of risk:
 * a parser miss → no fact bound → kernel falls through → static closing.
 *
 * Three high-leverage fragility holes covered here:
 *
 *   1. English number-words for salary ("thirty six LPA", "thirty-six
 *      lakhs"). STT layers (Sarvam / Whisper / Azure) sometimes ship
 *      spelled-out numerals instead of digits for slow careful
 *      pronunciation. Both `_fact-parser.ts` and
 *      `_number-role-classifier.ts` only matched digit strings, so the
 *      salary fact was dropped on the floor — same catastrophic
 *      failure mode as the LPE bug.
 *
 *   2. Trial-close bare affirmatives. After the bot asks "is ₹X within
 *      your range?", the candidate says "yeah" / "yep" / "ya" / "haan"
 *      / "ji" / "absolutely". The trial-close detector only matched
 *      bare "yes" — so the affirmative was lost, the move-picker
 *      didn't transition, and the recruiter re-asked the same trial
 *      close on the next turn.
 *
 *   3. Acceptance classifier bare Hindi affirmatives. Indian
 *      candidates routinely say bare "haan" / "ji" / "ji haan" /
 *      "ha ji" as an affirmative to "are you good with this offer?".
 *      The acceptance classifier's HINDI_MIX_PATTERNS required
 *      "haan + thik/ok/done"; bare Hindi yes fell through to no-match.
 */
import { describe, it, expect } from "vitest";
import { parseSalaryFacts } from "../../../server-handlers/_fact-parser";
import { classifyNumberRoles } from "../../../server-handlers/_number-role-classifier";
import { classifyAcceptance } from "../../../server-handlers/_acceptance-classifier";
import { detectTrialCloseResponse } from "../../../server-handlers/_trial-close-detector";

describe("STT fragility — English number-words for salary disclosure", () => {
  it("parses 'thirty six LPA' as 36 LPA (fact-parser)", () => {
    const facts = parseSalaryFacts("my current CTC is thirty six LPA");
    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts[0].value).toBe(36);
  });

  it("parses 'thirty-six lakhs' as 36 LPA (fact-parser)", () => {
    const facts = parseSalaryFacts("currently earning thirty-six lakhs");
    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts[0].value).toBe(36);
  });

  it("classifies 'my current CTC is thirty six LPA' as currentCtc=36 (number-role-classifier)", () => {
    const r = classifyNumberRoles(
      "my current CTC is thirty six LPA",
      { lastAiText: "what's your current total annual CTC?" },
    );
    expect(r.currentCtc).toBe(36);
  });

  it("classifies 'expecting forty LPA' as target=40 (number-role-classifier)", () => {
    const r = classifyNumberRoles("expecting forty LPA");
    expect(r.target).toBe(40);
  });
});

describe("STT fragility — trial-close bare affirmatives", () => {
  it("detects bare 'yeah' as accept", () => {
    expect(detectTrialCloseResponse("yeah")).toBe("accept");
  });
  it("detects bare 'yep' as accept", () => {
    expect(detectTrialCloseResponse("yep")).toBe("accept");
  });
  it("detects bare 'ya' as accept", () => {
    expect(detectTrialCloseResponse("ya.")).toBe("accept");
  });
  it("detects bare 'haan' as accept", () => {
    expect(detectTrialCloseResponse("haan")).toBe("accept");
  });
  it("detects 'ji haan' as accept", () => {
    expect(detectTrialCloseResponse("ji haan")).toBe("accept");
  });
  it("detects bare 'absolutely' as accept", () => {
    expect(detectTrialCloseResponse("absolutely!")).toBe("accept");
  });
  it("detects bare 'nope' as decline", () => {
    expect(detectTrialCloseResponse("nope")).toBe("decline");
  });
  it("detects bare 'nah' as decline", () => {
    expect(detectTrialCloseResponse("nah")).toBe("decline");
  });
});

describe("STT fragility — bare Hindi acceptance affirmatives", () => {
  it("accepts bare 'haan' as commitment idiom when offer is on table", () => {
    const r = classifyAcceptance("haan", { offerOnTable: true });
    expect(r.accepted).toBe(true);
  });

  it("accepts 'ji haan, that offer works' as acceptance", () => {
    const r = classifyAcceptance("ji haan, that offer works", { offerOnTable: true });
    expect(r.accepted).toBe(true);
  });

  it("accepts bare 'ji' as commitment idiom when offer is on table", () => {
    const r = classifyAcceptance("ji.", { offerOnTable: true });
    expect(r.accepted).toBe(true);
  });

  it("does NOT accept bare 'haan' when no offer is on table (phase gate)", () => {
    const r = classifyAcceptance("haan", { offerOnTable: false });
    expect(r.accepted).toBe(false);
  });
});
