# v2 fixture inbox

Drop real-session transcripts here as JSON files. Each file becomes a
fixture the batch validator (`scripts/v2-fixture-validate.ts`) walks
through to find new failure modes.

## File shape

One JSON per session. Filename: `<company>-<role>-<n>.json` (slug-case).

```json
{
  "meta": {
    "company": "razorpay",
    "role": "Senior Software Engineer",
    "level": "senior",
    "yoe": 5,
    "candidate_ctc": 28,
    "candidate_target": 42,
    "notes": "candidate accepted at 40 LPA after 3 counters — clean session"
  },
  "log": [
    { "role": "ai", "text": "Hi — quick chat about your interest?" },
    { "role": "candidate", "text": "yes, my current CTC is 28 LPA" },
    { "role": "ai", "text": "great — what's your expectation?" }
  ],
  "_v2_expected_picks": {
    "3": { "tool": "ask_discovery", "_comment": "still in early discovery" },
    "5": { "tool": "propose_anchor", "_comment": "candidate has asked for offer twice" }
  }
}
```

The `_v2_expected_picks` block is optional — turn-indexed assertions
the validator checks. Keys are 1-indexed AI turn numbers.

## How to use

```bash
# Drop your files in this folder, then:
npx tsx scripts/v2-fixture-validate.ts

# Exits 0 if every fixture passes its expected picks.
# Exits 1 with a per-turn report otherwise.
# Either way, prints a coverage matrix (companies × roles × turn counts).
```

The validator does NOT call the LLM. It only runs the deterministic
v2 brain (`deriveState`, `legalTools`, `executeTool`) so it's fast
and cheap to run on every commit.

## Privacy

Real sessions contain candidate names and comp numbers. This folder
is gitignored (see `.gitignore` in the inbox folder). Move processed
fixtures into the parent `__fixtures__/` only after sanitization —
strip PII, replace company names if you're not comfortable shipping
them in the regression suite.
