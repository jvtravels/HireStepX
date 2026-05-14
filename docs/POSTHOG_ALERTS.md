# PostHog Cost / Health Alert Config

HogQL query templates for the five launch-blocker alerts. Each entry
includes the query, the threshold that should fire, and the suggested
remediation action.

---

## A. Cost per session p95 > ₹5

**Query**

```sql
SELECT
  quantileExact(0.95)(sumCostInr) AS p95_cost_inr
FROM (
  SELECT
    properties.$session_id AS sid,
    sum(toFloat(properties.costInr)) AS sumCostInr
  FROM events
  WHERE event = 'turn_usage'
    AND timestamp > now() - INTERVAL 1 HOUR
  GROUP BY sid
)
```

**Threshold**: alert when `p95_cost_inr > 5`.

**Action**
1. Check `kernel_structured_envelope_missing` rate — LLM provider may
   have disabled jsonMode (forces retries → 2× cost per turn).
2. Inspect long sessions: `SELECT sid, count() FROM events WHERE event='turn_usage' GROUP BY sid ORDER BY count() DESC LIMIT 20`.
3. If transcript-summarization is bypassed, force the kernel into
   compact-brief mode (set `NEGOTIATION_FORCE_SUMMARIZE=1`).

---

## B. 5xx error rate > 1% over 5 min

**Query**

```sql
SELECT
  countIf(properties.status >= 500) / count() AS err_rate
FROM events
WHERE event = 'api_response'
  AND timestamp > now() - INTERVAL 5 MINUTE
  AND properties.endpoint = '/api/negotiate-turn'
```

**Threshold**: alert when `err_rate > 0.01`.

**Action**
1. Page on-call. Open dashboard "Edge function errors / 1h".
2. Inspect the top error message bucket — likely Groq 503 (regional outage)
   or `Invalid state` (state-deserialization regression).
3. If Groq, flip `LLM_PROVIDER=gemini` and re-deploy. Fallback path
   in `_llm.ts` already supports both.

---

## C. p95 latency > 5s over 5 min

**Query**

```sql
SELECT
  quantileExact(0.95)(toFloat(properties.latencyMs)) AS p95_latency
FROM events
WHERE event = 'turn_usage'
  AND timestamp > now() - INTERVAL 5 MINUTE
```

**Threshold**: alert when `p95_latency > 5000`.

**Action**
1. Check Groq status page + `kernel_fallback` rate — fallback means
   2x LLM calls, dominates latency.
2. If latency is from prompt size, force-enable transcript-summarizer
   (`NEGOTIATION_FORCE_SUMMARIZE=1`).
3. Long-term: cap `MAX_OUTPUT_TOKENS` down to 600 to shave 100-300ms.

---

## D. Injection-detected rate > 2% over 1 hour

**Query**

```sql
SELECT
  countIf(properties.injectionDetected = true) / count() AS inj_rate
FROM events
WHERE event = 'turn_usage'
  AND timestamp > now() - INTERVAL 1 HOUR
```

**Threshold**: alert when `inj_rate > 0.02`.

**Action**
1. Pull the `kernel_prompt_injection` events for that window — look
   at the `reasons` property to see which rule fired.
2. If a single user-agent / IP dominates, add a temporary IP block in
   `_shared.ts` rate-limiter.
3. If reasons cluster on a new attack phrase, extend
   `PROMPT_INJECTION_EXTRA_PATTERNS` in `_adversarial-detector.ts`.

---

## E. Turn-cap-429 rate > 5% over 1 hour

**Query**

```sql
SELECT
  countIf(properties.status = 429) / count() AS cap_rate
FROM events
WHERE event = 'api_response'
  AND timestamp > now() - INTERVAL 1 HOUR
  AND properties.endpoint = '/api/negotiate-turn'
```

**Threshold**: alert when `cap_rate > 0.05`.

**Action**
1. Differentiate `session-turn-cap` vs `user-daily-cap` from the
   `reason` property. The former implies kernel-loop; the latter is
   probably abuse OR a power user testing.
2. If `session-turn-cap` dominates, inspect terminal-phase detection —
   the kernel may not be transitioning to `accepted`/`walked-away` on
   reasonable inputs (regression in `applyCandidateAnswer`).
3. If `user-daily-cap` dominates, raise `MAX_TURNS_PER_USER_PER_DAY`
   from 200 → 300 temporarily and root-cause the traffic pattern.
