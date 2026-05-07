# Analyzer ground-truth fixtures

These JSON files are the calibration set for the per-focus session
analyzers. Each fixture is a real (or realistic) session transcript
plus a human judgment of what flags the analyzer should produce.

The CI test in `src/__tests__/analyzers/groundTruth.test.ts` runs
every analyzer against its fixture set and computes precision and
recall on the flag predictions. If accuracy drops below the
per-focus threshold, the test fails. This is what stops a rubric
tweak from silently regressing accuracy.

## File layout

```
tests/fixtures/analyzer-ground-truth/
  behavioral/
    01-clean-star.json
    02-weak-star.json
    ...
  salary-negotiation/
    01-clean-anchor.json
    02-implausible-claim.json
    ...
```

One file per fixture. Filename is informational only — the test
discovers via `fs.readdir`.

## Fixture JSON schema

```jsonc
{
  "name": "short human-readable name",
  "notes": "optional — why this fixture exists, what it's testing",
  "session": {
    "type": "behavioral",        // must match analyzer focus
    "transcript": [
      { "speaker": "ai",   "text": "...", "time": "" },
      { "speaker": "user", "text": "...", "time": "" }
    ]
  },
  "expected": {
    "must_include":     ["weak_star_structure"],          // flags that MUST be present
    "must_not_include": ["empty_transcript"],             // flags that MUST be absent
    "expect_hallucination_types": ["implausible_salary_claim"]  // optional
  }
}
```

Fields not listed under `session` (id, user_id, score, etc.) are
filled with sane defaults by the test harness.

## How to add a fixture

1. Pull a real session from Supabase (or write a synthetic one).
2. Read it carefully. Decide *as a human grader* which flags the
   analyzer should produce and which it must not produce.
3. Save as a new `.json` file in the appropriate focus folder.
4. Run `npx vitest run src/__tests__/analyzers/groundTruth.test.ts`.
5. If the test fails on your new fixture, either:
   - The analyzer has a bug → fix the analyzer.
   - Your expected flags were wrong → adjust the fixture.
   - Both can be true.

## Accuracy thresholds

Set per focus in `groundTruth.test.ts`. v1 thresholds:

- behavioral: precision ≥ 0.7, recall ≥ 0.7
- salary-negotiation: precision ≥ 0.7, recall ≥ 0.7

Raise these as the fixture set grows and stabilizes. Rule of
thumb: don't raise a threshold until you have ≥15 fixtures for
that focus.
