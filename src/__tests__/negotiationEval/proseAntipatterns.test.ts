/* PROSE-LINT-1 regression rows. Locks the regex shape on both sides:
 *
 *   - POSITIVE rows fire because the prose is genuinely off-character.
 *     If a regex is loosened too far and stops matching, this catches it.
 *
 *   - NEGATIVE rows are real recruiter-shaped utterances that include
 *     overlapping vocabulary ("appreciate", "understand", "value",
 *     "share"). The detector must NOT fire on them — those words are
 *     legitimate in real recruiter speech. If a regex is tightened wrong
 *     and starts firing on natural prose, this catches it.
 *
 * Update process: when a new antipattern is added to
 *   server-handlers/_prose-antipatterns.ts, add at least one positive
 *   row AND one near-miss negative row here. Detectors without a
 *   negative companion get over-fitted and fire on real prose. */

import { describe, it, expect } from "vitest";
import {
  detectProseAntipatterns,
  detectTranscriptAntipatterns,
} from "../../../server-handlers/_prose-antipatterns";

const POSITIVE: ReadonlyArray<{ id: string; text: string }> = [
  { id: "meta-narration", text: "As your interview practice partner, I think you should push back here." },
  { id: "meta-narration", text: "Let me coach you on this for a second." },
  { id: "meta-narration", text: "I'll switch to coach mode now." },
  { id: "meta-narration", text: "As your AI, I would suggest a different framing." },
  { id: "template-filler", text: "I understand that this is an important decision for you." },
  { id: "template-filler", text: "I appreciate your patience in working through this with me." },
  { id: "template-filler", text: "Thank you for sharing that with me." },
  { id: "template-filler", text: "I completely understand where you're coming from." },
  { id: "template-filler", text: "That's a great question — let me think." },
  { id: "generic-advice", text: "Remember, always negotiate your worth." },
  { id: "generic-advice", text: "Don't undersell yourself in these conversations." },
  { id: "generic-advice", text: "You need to know your market value before walking in." },
  { id: "generic-advice", text: "Believe in yourself and you'll do great." },
  { id: "generic-advice", text: "Stay confident and the rest will follow." },
];

const NEGATIVE: ReadonlyArray<string> = [
  /* Real recruiter shapes that share vocabulary but are NOT antipatterns. */
  "Your current CTC is 22 LPA — got it.",
  "I appreciate you sharing the offer details.",
  "Let me share the breakdown: 18 fixed, 4 variable, 6 RSUs.",
  "We value engineers with your kind of fintech background.",
  "I understand the gap — let's see if we can close it.",
  "What's your target number?",
  "Got it. That's a fair ask given your years of experience.",
  "Let me check with the panel and get back to you.",
  "Your variable component vests over four years.",
  "We can move on the joining bonus but the fixed is locked.",
];

describe("detectProseAntipatterns — positive rows fire", () => {
  for (const row of POSITIVE) {
    it(`fires "${row.id}" on: ${row.text.slice(0, 60)}`, () => {
      const hits = detectProseAntipatterns(row.text);
      expect(hits.some((h) => h.id === row.id)).toBe(true);
    });
  }
});

describe("detectProseAntipatterns — negative rows must stay quiet", () => {
  for (const text of NEGATIVE) {
    it(`is silent on: ${text.slice(0, 60)}`, () => {
      const hits = detectProseAntipatterns(text);
      expect(hits).toEqual([]);
    });
  }
});

describe("detectTranscriptAntipatterns — transcript-level scan", () => {
  it("returns an empty list for a clean transcript", () => {
    const turns = NEGATIVE.map((aiText) => ({ aiText }));
    expect(detectTranscriptAntipatterns(turns)).toEqual([]);
  });

  it("annotates each hit with its turn index", () => {
    const turns = [
      { aiText: "Got it." },
      { aiText: "As your interview practice partner, I'd push back." },
      { aiText: "Cool." },
      { aiText: "Always negotiate your worth." },
    ];
    const hits = detectTranscriptAntipatterns(turns);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ turnIndex: 1, pattern: { id: "meta-narration" } });
    expect(hits[1]).toMatchObject({ turnIndex: 3, pattern: { id: "generic-advice" } });
  });

  it("skips turns with no aiText (candidate-only turns)", () => {
    const turns = [
      { aiText: undefined },
      { aiText: "Got it." },
    ];
    expect(detectTranscriptAntipatterns(turns)).toEqual([]);
  });
});
