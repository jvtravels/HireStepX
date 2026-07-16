import { describe, it, expect, vi } from "vitest";
import { extractJSON } from "../../server-handlers/_llm";

// Suppress the "logUsage disabled" console.warn that fires when _llm.ts is
// imported without Supabase env vars — irrelevant to extractJSON testing.
vi.spyOn(console, "warn").mockImplementation(() => {});

describe("extractJSON", () => {
  describe("direct JSON parsing", () => {
    it("parses clean JSON object", () => {
      const result = extractJSON('{"score": 85, "feedback": "Good"}');
      expect(result).toEqual({ score: 85, feedback: "Good" });
    });

    it("parses clean JSON array", () => {
      const result = extractJSON('[{"q": "Q1"}, {"q": "Q2"}]');
      expect(result).toHaveLength(2);
    });
  });

  describe("markdown code fences", () => {
    it("extracts JSON from ```json fences", () => {
      const result = extractJSON('```json\n{"score": 90}\n```');
      expect(result).toEqual({ score: 90 });
    });

    it("extracts JSON from plain ``` fences", () => {
      const result = extractJSON('```\n{"key": "value"}\n```');
      expect(result).toEqual({ key: "value" });
    });

    it("handles fences with extra whitespace", () => {
      const result = extractJSON('```json  \n  {"data": true}  \n```  ');
      expect(result).toEqual({ data: true });
    });
  });

  describe("JSON embedded in prose", () => {
    it("extracts object from surrounding text", () => {
      const result = extractJSON('Here is the evaluation:\n{"score": 75}\nThat concludes the review.');
      expect(result).toEqual({ score: 75 });
    });

    it("extracts array from surrounding text", () => {
      const result = extractJSON('Questions:\n[{"q": "Tell me about yourself"}]\nEnd.');
      expect(result).toEqual([{ q: "Tell me about yourself" }]);
    });
  });

  describe("nested objects", () => {
    it("handles nested braces correctly", () => {
      const result = extractJSON('Result: {"outer": {"inner": {"deep": 1}}, "score": 80}');
      expect(result).toEqual({ outer: { inner: { deep: 1 } }, score: 80 });
    });

    it("handles escaped quotes in strings", () => {
      const result = extractJSON('{"text": "He said \\"hello\\""}');
      expect(result).toEqual({ text: 'He said "hello"' });
    });

    it("handles braces inside strings", () => {
      const result = extractJSON('{"code": "function() { return {}; }"}');
      expect(result).toEqual({ code: "function() { return {}; }" });
    });
  });

  describe("edge cases", () => {
    it("returns null for empty string", () => {
      expect(extractJSON("")).toBeNull();
    });

    it("returns null for plain text with no JSON", () => {
      expect(extractJSON("This is just regular text without any JSON.")).toBeNull();
    });

    it("returns null for malformed JSON", () => {
      expect(extractJSON("{key: value}")).toBeNull();
    });

    it("returns null for incomplete JSON — truncated at max_tokens boundary", () => {
      // This is the real-world failure mode: LLM hits max_tokens mid-object.
      // extractJSON must return null rather than a partial/corrupt result.
      expect(extractJSON('{"score": 85, "feedback":')).toBeNull();
      expect(extractJSON('{"questions": [{"text": "Tell me about')).toBeNull();
    });

    it("handles JSON with numeric values", () => {
      const result = extractJSON('{"score": 92.5, "count": -3}');
      expect(result).toEqual({ score: 92.5, count: -3 });
    });

    it("handles JSON with boolean and null values", () => {
      const result = extractJSON('{"active": true, "deleted": false, "parent": null}');
      expect(result).toEqual({ active: true, deleted: false, parent: null });
    });

    it("prefers whichever structure (array vs object) appears first in text", () => {
      // Array before object in the text — real _llm.ts scans for earliest start index.
      const r1 = extractJSON('Array first: [1,2,3] then {"x":1}');
      expect(r1).toEqual([1, 2, 3]);

      // Object before array
      const r2 = extractJSON('Object first: {"x":1} then [1,2,3]');
      expect(r2).toEqual({ x: 1 });
    });
  });
});
