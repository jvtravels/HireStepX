# HireStepX Salary-Negotiation Kernel — Operational Runbook

This runbook covers production operations for the salary-negotiation
kernel: how to roll back a wave, how to flip kill-switches, how to size
cost / abuse caps, and how to triage the canonical incident shapes.

It is the on-call source-of-truth. Update it whenever a new wave / cap /
sensitive flag lands.

---

## Rollback recipe

Each "wave" of candidate-profile flags is a single commit. Rolling back
is a `git revert` + redeploy. Drop waves in reverse order — newer
waves assume older waves' fields exist.

Current HEAD: `cca72f5` (Wave-4).

| Layer                 | Commit     | Revert command                                 |
| --------------------- | ---------- | ---------------------------------------------- |
| Wave-4 (32 flags)     | `cca72f5`  | `git revert cca72f5 && git push origin main`   |
| Wave-3 (25 flags)     | `f250974`  | `git revert f250974 && git push origin main`   |
| Wave-2 (20 flags)     | `056b60b`  | `git revert 056b60b && git push origin main`   |
| Senior+process layer  | `70eafc2`  | `git revert 70eafc2 && git push origin main`   |
| Tier-1 audit layer    | `7e7b0e2`  | `git revert 7e7b0e2 && git push origin main`   |

Rules:

1. Revert higher-numbered waves first. Reverting Wave-3 while Wave-4 is
   still in place will conflict (Wave-4 imports Wave-3 fields).
2. Use `--no-edit` only after the conflict resolution; never blind-force.
3. After revert, run `npx vitest run --testTimeout=30000` locally before
   deploying — a successful revert MUST leave the suite green.

For a fast-path rollback that does NOT need a deploy, use the
kill-switches below.

---

## Kill-switch usage (no redeploy)

Each wave can be disabled at runtime via Vercel env vars. The
`_candidate-profile.ts` module reads these on every call (not at module
load), so flipping the value applies to the next request immediately
once Vercel propagates the env update (typically <1 minute).

```
HSX_DISABLE_WAVE_2=1   # zero the 20 Wave-2 flags
HSX_DISABLE_WAVE_3=1   # zero the 25 Wave-3 flags
HSX_DISABLE_WAVE_4=1   # zero the 32 Wave-4 flags
```

Apply via:

```
vercel env add HSX_DISABLE_WAVE_4 production
# enter value: 1
```

No redeploy needed — Vercel re-reads env on the next cold start, and
the module reads env on every extract.

To re-enable, remove the env var (or set it to `0`).

The kill-switch is the FIRST move during an incident. Revert is the
second move — only do it if the kill-switch isn't enough.

---

## Cost / abuse caps

Defined in `server-handlers/_session-limits.ts`:

| Constant                       | Value | Meaning                                         |
| ------------------------------ | ----- | ----------------------------------------------- |
| `MAX_INPUT_CHARS`              | 8000  | Per-turn candidate input ceiling (post-trim)    |
| `MAX_TURNS_PER_SESSION`        | 60    | Hard cap on turns per single session            |
| `MAX_TURNS_PER_USER_PER_DAY`   | 200   | Per-user daily turn ceiling                     |
| `MAX_OUTPUT_TOKENS`            | 800   | LLM output token ceiling per call               |

To change a cap: edit `_session-limits.ts`, update the constant, run
tests, and ship. There is no env override; caps are part of the kernel
contract and require code review.

The per-user-daily counter is currently a stub (`turnsToday = 0`). When
the backing KV store lands, point it at the real counter and remove the
TODO in `negotiate-turn.ts`.

---

## Error budget

| SLI                         | Target                                          |
| --------------------------- | ----------------------------------------------- |
| 5xx rate                    | < 0.5 % of `/api/negotiate-turn` requests       |
| p95 turn latency            | < 5 s                                           |
| Token cost per session      | < ₹3 (≈ $0.035 at current Groq pricing)         |
| Kernel-fallback rate        | < 5 % of LLM calls                              |
| Adversarial / injection rate| < 0.5 % of inputs                               |

PostHog dashboards:

- `kernel_turn` — every turn, lever + phase + source.
- `kernel_fallback` — deterministic-fallback fires.
- `kernel_adversarial_input` — jailbreak / off-topic / profane.
- `kernel_validate_fail` — LLM validation failures.
- `kernel_turn_usage` — stdout-captured per-turn cost / latency log.

---

## On-call escalation

| Role | Contact | Channel |
| ---- | ------- | ------- |
| First responder (P0/P1) | Jay Vyas | `vyasjay85@gmail.com` · phone on file |
| Escalation L1 — kernel  | Jay Vyas | same |
| Escalation L2 — product | Jay Vyas | same |
| Off-hours hard-stop      | n/a      | flip `NEGOTIATION_KERNEL_ENABLED=0` in Vercel prod env (returns 404 for negotiate-turn and routes the engine to the legacy script path) |

Single-maintainer rotation for MVP. Replace this table with a PagerDuty
schedule once headcount > 1 or 7-day DAU > 500. Until then, the
off-hours hard-stop env flag is the actual safety net — flipping it
takes &lt;1 minute via Vercel dashboard and needs no redeploy.

### Paging path (pre-PagerDuty)

The minimum bar before paid traffic is enabled is **one automated SMS to
one phone number** when any of the following trips. Configure in Better
Stack (or UptimeRobot) against the listed signal:

| Signal | Threshold | Source |
| ------ | --------- | ------ |
| `/api/uptime-check` non-200 | 2 consecutive failures, 60s apart | Better Stack HTTP monitor |
| `payment_completed` event rate | 0 events in 30 min during business hours after first paid traffic | PostHog alert |
| `verify_payment_dedup_degraded` rate | > 5 events in 15 min | PostHog alert |
| LLM 429 rate (`gq_groq_429` / `evaluate_groq_429`) | > 10 % of calls in 15 min | PostHog alert |
| 5xx rate on `/api/negotiate-turn` | > 0.5 % in 10 min | Vercel log drain → Better Stack |

Route every alert to: SMS + email to the contact in the table above.
When a second maintainer joins, fan out to both numbers.

### "Paged at 3am" playbook (half-page)

1. **Acknowledge** within 5 min via SMS reply or Better Stack web.
2. **Check `/api/uptime-check`** from a browser. If 200, the alert is a
   downstream issue (payments, LLM, DB). If non-200, flip
   `NEGOTIATION_KERNEL_ENABLED=0` in Vercel and proceed.
3. **Open the PostHog dashboard "Live ops"** — look at the last 30 min
   of `payment_completed`, `verify_payment_dedup_degraded`, and
   `kernel_fallback`. Identify which signal is anomalous.
4. **Match against Common Incidents** (Section "Common incidents" below)
   for the matching shape. Apply the kill-switch named there.
5. **Post in #ops** (or email yourself) with: incident shape, kill-switch
   flipped, expected blast radius, ETA on full fix. Even solo, write it
   down — you will not remember at 9am.
6. **Schedule a Tomorrow-Me task** to either revert the kill-switch or
   ship the real fix within 24h.

---

## Privacy — DPDP Special Personal Data

Under India's Digital Personal Data Protection Act, 2023, the following
candidate-profile flags encode SENSITIVE / SPECIAL personal data. They
MUST be zeroed in any analytics / log / retention write that includes a
`candidateProfile` snapshot:

- `pregnancyDisclosed`
- `pipDisclosed`
- `mentalHealthDisclosed`
- `lgbtqDisclosure`
- `casteReservationContext`
- `pwdDisability`
- `chronicIllnessDisclosed`
- `dietaryReligiousNeed`
- `singleParentConstraint`
- `paternityLeaveAsk`
- `menstrualLeavePolicy`
- `agingParentCare`
- `returnshipMaternity`

Use `redactCandidateProfileForLogs(profile)` from
`server-handlers/_candidate-profile.ts` to wrap any analytics write
that includes a candidateProfile snapshot. The function returns a copy
with every sensitive flag zeroed; it does not mutate the input.

When adding a new sensitive flag:

1. Add the key to `SPECIAL_PERSONAL_DATA_FLAGS` in `_candidate-profile.ts`.
2. Update the test list in `src/__tests__/sensitiveFlagRedaction.test.ts`.
3. Update the list above in this runbook.

Never log raw candidate utterances at INFO level — they can contain
sensitive disclosures. Use `redactPii` from `_pii-redact.ts` for any
free-text write.

---

## Common incidents

### A. Regex over-fires (a flag fires on a phrase it shouldn't)

Symptom: PostHog `kernel_turn` shows a flag firing at 10x its expected
rate; recruiter voice is wrong for many candidates.

Response:
1. Flip the relevant wave's kill-switch
   (`HSX_DISABLE_WAVE_2/3/4 = 1`).
2. Find the offending detector regex in `_candidate-profile.ts`.
3. Tighten the regex (add a negative lookahead / require more specific
   anchor / require digit nearby).
4. Add a unit test that pins both the positive case and the
   over-firing false positive.
5. Land + deploy + remove the kill-switch.

### B. LLM leaks system prompt

Symptom: a recruiter reply quotes the SECURITY block, lists the
NEGOTIATION_SYSTEM_PROMPT rules verbatim, or names internal flag
names.

Response:
1. Capture the offending session ID; pull the full transcript.
2. Identify the candidate utterance that triggered the leak — most
   commonly a novel injection pattern not covered by R1–R12.
3. Add the pattern to `_adversarial-detector.ts`
   (`PROMPT_INJECTION_EXTRA_PATTERNS`).
4. Land + deploy. Update the regression test in
   `src/__tests__/promptInjectionGuards.test.ts`.
5. If broader: tighten the SECURITY block in
   `_negotiate-turn-helpers.ts` (NEGOTIATION_SYSTEM_PROMPT).

### C. Latency spike

Symptom: p95 turn latency > 5s.

Response:
1. Check Groq status page; the upstream LLM is the dominant latency
   contributor.
2. Check `kernel_structured_envelope_missing` — if elevated, the LLM is
   ignoring jsonMode and we're doing the retry loop. Switch to fallback
   provider temporarily.
3. Check input size distribution — runaway input (post-`clampInput`
   truncation rate) indicates abuse; consider lowering
   `MAX_INPUT_CHARS`.

### D. Cost spike

Symptom: daily LLM bill jumps; per-session cost > ₹3.

Response:
1. Check `kernel_turn_usage` log for outlier sessions (look at
   `inputChars` and turn-count distribution).
2. If a single user is dominant: lower `MAX_TURNS_PER_USER_PER_DAY`
   temporarily.
3. If session-length is the driver: lower `MAX_TURNS_PER_SESSION`.
4. If input-size is the driver: lower `MAX_INPUT_CHARS`.

### E. Sensitive-flag false fire

Symptom: a sensitive flag (e.g. `pipDisclosed`) fires on a benign
utterance and shows up in a recruiter-coaching response.

Response:
1. Flip the relevant wave's kill-switch immediately.
2. Tighten the detector regex (see Incident A).
3. Audit recent log writes — if the false flag landed in any analytics
   row, file a DPDP incident note (it shouldn't have, given
   `redactCandidateProfileForLogs`, but verify).
4. Confirm `redactCandidateProfileForLogs` is in the call path of every
   `candidateProfile`-bearing PostHog event.

---

## Test commands

```bash
# Launch-blocker test pack
npx vitest run \
  src/__tests__/{promptInjectionGuards,sessionLimits,sensitiveFlagRedaction,waveKillSwitch,inputSanityBounds,critiqueInvariants}.test.ts \
  --testTimeout=30000

# Full suite (must be green before any deploy)
npx vitest run --testTimeout=30000
```
