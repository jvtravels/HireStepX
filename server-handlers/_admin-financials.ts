/* Admin sections: financials, LLM/provider usage, cost reconciliation. */

import { fetchJSON, daysAgo, LIMIT_LLM, fetchCount, TTS_SERVICES, STT_SERVICES, supa } from "./_admin-shared";
import { emptyBreakdown, categorizeLlmError } from "./_admin-llm-categorizer";
import { getAnomalies } from "./_admin-activity";
import { costBreakdown, llmInr, RATES_LAST_VERIFIED_AT, rateCardAgeDays, isRateCardStale } from "./_cost-helpers";

export async function getFinancials() {
  const [payments, activeProfiles] = await Promise.all([
    fetchJSON<{
      id: string; user_id: string; amount: number; currency: string; status: string; tier: string; plan: string; created_at: string;
    }>(`payments?select=id,user_id,amount,currency,status,tier,plan,created_at&order=created_at.desc&limit=2000`),
    // Active paid subscriptions: tier not free AND subscription_end in the future
    fetchJSON<{ subscription_tier: string; subscription_end: string | null }>(
      `profiles?select=subscription_tier,subscription_end&subscription_tier=neq.free&subscription_tier=not.is.null&limit=5000`,
    ),
  ]);

  const now = Date.now();
  const isSuccess = (p: { status: string }) =>
    p.status === "captured" || p.status === "paid" || p.status === "success";
  const isFailed = (p: { status: string }) =>
    p.status === "failed" || p.status === "cancelled" || p.status === "cancelled_by_user" || p.status === "expired";

  const success = payments.filter(isSuccess);
  const failed = payments.filter(isFailed);
  const pending = payments.filter(p => !isSuccess(p) && !isFailed(p));

  const totalRevenue = success.reduce((s, p) => s + (p.amount || 0), 0);

  const monthAgo = daysAgo(30);
  const lastMonthAgo = daysAgo(60);
  const thisMonthPayments = success.filter(p => p.created_at >= monthAgo);
  const lastMonthPayments = success.filter(p => p.created_at >= lastMonthAgo && p.created_at < monthAgo);
  const revenueThisMonth = thisMonthPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const revenueLastMonth = lastMonthPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const momGrowthPct = revenueLastMonth > 0
    ? Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100)
    : (revenueThisMonth > 0 ? 100 : 0);

  const successRate = payments.length > 0 ? Math.round((success.length / payments.length) * 100) : 100;
  const avgTransactionPaise = success.length > 0 ? Math.round(totalRevenue / success.length) : 0;

  // Plan breakdown with count
  const byPlan: Record<string, { revenue: number; count: number }> = {};
  for (const p of success) {
    const k = p.plan || p.tier || "unknown";
    if (!byPlan[k]) byPlan[k] = { revenue: 0, count: 0 };
    byPlan[k].revenue += p.amount || 0;
    byPlan[k].count += 1;
  }

  // Per day (30d)
  const perDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) { perDay[new Date(now - i * 86400000).toISOString().slice(0, 10)] = 0; }
  for (const p of success) { const d = p.created_at?.slice(0, 10); if (d && d in perDay) perDay[d] += p.amount || 0; }

  // Per month (12 months)
  const perMonth: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - i, 1);
    perMonth[d.toISOString().slice(0, 7)] = 0;
  }
  for (const p of success) { const m = p.created_at?.slice(0, 7); if (m && m in perMonth) perMonth[m] += p.amount || 0; }

  // Top spenders aggregation
  const spenderMap = new Map<string, { total: number; count: number; lastDate: string }>();
  for (const p of success) {
    if (!p.user_id) continue;
    const e = spenderMap.get(p.user_id);
    if (!e) {
      spenderMap.set(p.user_id, { total: p.amount || 0, count: 1, lastDate: p.created_at });
    } else {
      e.total += p.amount || 0;
      e.count += 1;
      if (p.created_at > e.lastDate) e.lastDate = p.created_at;
    }
  }
  const topSpenderIds = Array.from(spenderMap.entries())
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10)
    .map(([id]) => id);

  const profileMap = new Map<string, { name: string; email: string }>();
  if (topSpenderIds.length > 0) {
    const idList = topSpenderIds.map(id => `"${id}"`).join(",");
    const profiles = await fetchJSON<{ id: string; name: string | null; email: string }>(
      `profiles?select=id,name,email&id=in.(${idList})`,
    );
    for (const pr of profiles) profileMap.set(pr.id, { name: pr.name || "(no name)", email: pr.email });
  }

  const topSpenders = topSpenderIds.map(id => {
    const data = spenderMap.get(id)!;
    const pr = profileMap.get(id);
    return { userId: id, name: pr?.name || "(unknown)", email: pr?.email || "", totalPaise: data.total, paymentCount: data.count, lastPayment: data.lastDate };
  });

  const paidUserCount = spenderMap.size;
  const arpuPaise = paidUserCount > 0 ? Math.round(totalRevenue / paidUserCount) : 0;

  // MRR: estimate from active subscriptions × avg monthly revenue per plan
  // "Active" = subscription_end is in the future or null (lifetime)
  const todayStr = new Date().toISOString().slice(0, 10);
  const activeSubs = activeProfiles.filter(p =>
    p.subscription_tier && p.subscription_tier !== "free" &&
    (p.subscription_end == null || p.subscription_end > todayStr)
  );
  const activeByTier: Record<string, number> = {};
  for (const p of activeSubs) {
    const t = p.subscription_tier || "unknown";
    activeByTier[t] = (activeByTier[t] || 0) + 1;
  }
  // Monthly revenue per plan from payments (avg payment / plan, ignoring annual vs monthly)
  const planRevenueMap: Record<string, { total: number; count: number }> = {};
  for (const p of success) {
    const k = p.plan || p.tier || "unknown";
    if (!planRevenueMap[k]) planRevenueMap[k] = { total: 0, count: 0 };
    planRevenueMap[k].total += p.amount || 0;
    planRevenueMap[k].count++;
  }
  // Annualise: detect "annual"/"yearly" in plan name → divide by 12
  const avgMonthlyPaiseByPlan: Record<string, number> = {};
  for (const [plan, { total, count }] of Object.entries(planRevenueMap)) {
    const avgPmt = count > 0 ? total / count : 0;
    const isAnnual = /annual|yearly|year/i.test(plan);
    avgMonthlyPaiseByPlan[plan] = Math.round(isAnnual ? avgPmt / 12 : avgPmt);
  }
  // MRR = sum(active subs per tier × avg monthly price for that tier)
  let estimatedMrrPaise = 0;
  for (const [tier, subCount] of Object.entries(activeByTier)) {
    const monthlyPaise = avgMonthlyPaiseByPlan[tier] || 0;
    estimatedMrrPaise += subCount * monthlyPaise;
  }
  const activeSubsCount = activeSubs.length;

  return {
    totalRevenuePaise: totalRevenue,
    revenueThisMonthPaise: revenueThisMonth,
    revenueLastMonthPaise: revenueLastMonth,
    momGrowthPct,
    totalPayments: success.length,
    failedPayments: failed.length,
    pendingPayments: pending.length,
    successRate,
    avgTransactionPaise,
    paidUserCount,
    arpuPaise,
    estimatedMrrPaise,
    activeSubsCount,
    byPlan,
    perDay,
    perMonth,
    topSpenders,
    recent: payments.slice(0, 50).map(p => ({
      id: p.id, amount: p.amount, currency: p.currency, status: p.status,
      plan: p.plan || p.tier, date: p.created_at, userId: p.user_id,
    })),
    recentFailed: failed.slice(0, 20).map(p => ({
      id: p.id, amount: p.amount, plan: p.plan || p.tier, status: p.status, date: p.created_at,
    })),
  };
}

export async function getLLMUsage() {
  const usage = await fetchJSON<{
    id: string; user_id: string; endpoint: string; model: string; is_fallback: boolean;
    prompt_tokens: number; completion_tokens: number; total_tokens: number;
    latency_ms: number; status: string; error_message: string | null; created_at: string;
  }>(`llm_usage?select=id,user_id,endpoint,model,is_fallback,prompt_tokens,completion_tokens,total_tokens,latency_ms,status,error_message,created_at&order=created_at.desc&limit=${LIMIT_LLM}`);

  const now = Date.now();
  const today = daysAgo(0).slice(0, 10);

  const byEndpoint: Record<string, { calls: number; tokens: number; avgLatency: number; errors: number; _latencySum: number }> = {};
  const byModel: Record<string, { calls: number; tokens: number }> = {};
  const tokensPerDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) { tokensPerDay[new Date(now - i * 86400000).toISOString().slice(0, 10)] = 0; }

  for (const u of usage) {
    // By endpoint
    const ep = u.endpoint || "unknown";
    if (!byEndpoint[ep]) byEndpoint[ep] = { calls: 0, tokens: 0, avgLatency: 0, errors: 0, _latencySum: 0 };
    byEndpoint[ep].calls++;
    byEndpoint[ep].tokens += u.total_tokens || 0;
    byEndpoint[ep]._latencySum += u.latency_ms || 0;
    if (u.status === "error" || u.status === "timeout") byEndpoint[ep].errors++;

    // By model
    const m = u.model || "unknown";
    if (!byModel[m]) byModel[m] = { calls: 0, tokens: 0 };
    byModel[m].calls++;
    byModel[m].tokens += u.total_tokens || 0;

    // Per day
    const d = u.created_at?.slice(0, 10);
    if (d && d in tokensPerDay) tokensPerDay[d] += u.total_tokens || 0;
  }

  // Compute avg latency
  const cleanEndpoints: Record<string, { calls: number; tokens: number; avgLatency: number; errors: number }> = {};
  for (const [ep, d] of Object.entries(byEndpoint)) {
    cleanEndpoints[ep] = { calls: d.calls, tokens: d.tokens, avgLatency: d.calls > 0 ? Math.round(d._latencySum / d.calls) : 0, errors: d.errors };
  }

  const totalTokens = usage.reduce((s, u) => s + (u.total_tokens || 0), 0);
  const todayTokens = usage.filter(u => u.created_at?.startsWith(today)).reduce((s, u) => s + (u.total_tokens || 0), 0);
  const fallbackCount = usage.filter(u => u.is_fallback).length;
  const errored = usage.filter(u => u.status === "error" || u.status === "timeout");

  // Categorize each error so the dashboard surfaces *why* calls fail. Token
  // quota is one of many failure modes; per-minute rate limits, context-length
  // overflow, and provider 5xxs are far more common in practice.
  // Pure regex logic lives in _admin-llm-categorizer.ts so it can be unit-tested.
  const errorBreakdown = emptyBreakdown();
  for (const u of errored) {
    errorBreakdown[categorizeLlmError(u.status, u.error_message)]++;
  }

  return {
    totalCalls: usage.length,
    totalTokens,
    todayTokens,
    fallbackRate: usage.length > 0 ? Math.round((fallbackCount / usage.length) * 100) : 0,
    errorRate: usage.length > 0 ? Math.round((errored.length / usage.length) * 100) : 0,
    errorBreakdown,
    byEndpoint: cleanEndpoints,
    byModel,
    tokensPerDay,
    recentErrors: errored.slice(0, 20).map(u => ({
      endpoint: u.endpoint, model: u.model, error: u.error_message, status: u.status, date: u.created_at,
    })),
    // Service details for the enhanced Services view
    services: await buildServiceDetails(usage),
    anomalies: await getAnomalies(),
  };
}

/** Build detailed per-service breakdown with real usage from service_usage table + llm_usage */
export async function buildServiceDetails(
  llmUsage: Array<{ model: string; is_fallback: boolean; total_tokens: number; latency_ms: number; status: string; created_at: string }>,
) {
  const today = daysAgo(0).slice(0, 10);
  const monthAgo = daysAgo(30).slice(0, 10);
  const todayUsage = llmUsage.filter(u => u.created_at?.startsWith(today));

  // Classify by `is_fallback` only — that column is the canonical signal for which
  // provider served the call. Sniffing the model string double-counts rows when
  // both predicates match and drops rows whose model field doesn't contain a
  // known substring.
  const groqCalls = llmUsage.filter(u => !u.is_fallback);
  const groqToday = todayUsage.filter(u => !u.is_fallback);
  const groqTokensToday = groqToday.reduce((s, u) => s + (u.total_tokens || 0), 0);
  const groqWindowErrors = groqCalls.filter(u => u.status === "error" || u.status === "timeout").length;
  const groqAvgLatency = groqCalls.length > 0 ? Math.round(groqCalls.reduce((s, u) => s + (u.latency_ms || 0), 0) / groqCalls.length) : 0;

  const geminiCalls = llmUsage.filter(u => u.is_fallback);
  const geminiToday = todayUsage.filter(u => u.is_fallback);
  const geminiTokensToday = geminiToday.reduce((s, u) => s + (u.total_tokens || 0), 0);
  const geminiWindowErrors = geminiCalls.filter(u => u.status === "error" || u.status === "timeout").length;
  const geminiAvgLatency = geminiCalls.length > 0 ? Math.round(geminiCalls.reduce((s, u) => s + (u.latency_ms || 0), 0) / geminiCalls.length) : 0;

  // True all-time totals — `llmUsage` is capped at LIMIT_LLM rows so summing it
  // would silently undercount once the table grows past that window.
  const [groqCallsTotal, groqErrorsTotal, geminiCallsTotal, geminiErrorsTotal] = await Promise.all([
    fetchCount("llm_usage", "&is_fallback=eq.false"),
    fetchCount("llm_usage", "&is_fallback=eq.false&status=in.(error,timeout)"),
    fetchCount("llm_usage", "&is_fallback=eq.true"),
    fetchCount("llm_usage", "&is_fallback=eq.true&status=in.(error,timeout)"),
  ]);

  // Fetch service_usage for all non-LLM services
  const serviceRows = await fetchJSON<{
    service: string; status: string; latency_ms: number | null;
    request_chars: number | null; response_bytes: number | null; created_at: string;
  }>(`service_usage?select=service,status,latency_ms,request_chars,response_bytes,created_at&created_at=gte.${monthAgo}&order=created_at.desc&limit=5000`);

  // Aggregate per service
  type Agg = { callsTotal: number; callsToday: number; errorsTotal: number; errorsToday: number; latencySum: number; latencyCount: number; charsTotal: number; charsToday: number; bytesTotal: number };
  const agg: Record<string, Agg> = {};
  for (const r of serviceRows) {
    if (!agg[r.service]) agg[r.service] = { callsTotal: 0, callsToday: 0, errorsTotal: 0, errorsToday: 0, latencySum: 0, latencyCount: 0, charsTotal: 0, charsToday: 0, bytesTotal: 0 };
    const a = agg[r.service];
    const isToday = r.created_at?.startsWith(today);
    a.callsTotal++;
    if (isToday) a.callsToday++;
    if (r.status === "error" || r.status === "timeout") {
      a.errorsTotal++;
      if (isToday) a.errorsToday++;
    }
    if (r.latency_ms) { a.latencySum += r.latency_ms; a.latencyCount++; }
    if (r.request_chars) { a.charsTotal += r.request_chars; if (isToday) a.charsToday += r.request_chars; }
    if (r.response_bytes) a.bytesTotal += r.response_bytes;
  }

  const svc = (name: string): Agg => agg[name] || { callsTotal: 0, callsToday: 0, errorsTotal: 0, errorsToday: 0, latencySum: 0, latencyCount: 0, charsTotal: 0, charsToday: 0, bytesTotal: 0 };
  const avgLat = (a: Agg) => a.latencyCount > 0 ? Math.round(a.latencySum / a.latencyCount) : 0;
  const svcStatus = (a: Agg) => a.callsTotal > 0 && a.errorsTotal > a.callsTotal * 0.1 ? "degraded" : "healthy";

  const az = svc("azure_tts");
  const ca = svc("cartesia_tts");
  const dg = svc("deepgram_stt");
  const sv = svc("sarvam_stt");
  const re = svc("resend_email");

  // Upstash: estimate commands from total service calls (each rate-limited req = ~2 Redis commands)
  const totalServiceCalls = serviceRows.length + llmUsage.length;
  const todayServiceCalls = serviceRows.filter(r => r.created_at?.startsWith(today)).length + todayUsage.length;
  const upstashEstCmdsTotal = totalServiceCalls * 2;
  const upstashEstCmdsToday = todayServiceCalls * 2;

  return [
    {
      name: "Groq",
      type: "LLM",
      role: "Primary",
      model: "openai/gpt-oss-20b (fast) / openai/gpt-oss-120b (fallback)",
      status: groqWindowErrors > groqCalls.length * 0.1 ? "degraded" : "healthy",
      usage: {
        callsTotal: groqCallsTotal,
        callsToday: groqToday.length,
        tokensToday: groqTokensToday,
        tokensTotal: groqCalls.reduce((s, u) => s + (u.total_tokens || 0), 0),
        errorsTotal: groqErrorsTotal,
        errorsToday: groqToday.filter(u => u.status === "error" || u.status === "timeout").length,
        avgLatencyMs: groqAvgLatency,
      },
      limits: { requestsPerDay: 1000, requestsPerMinute: 30, tokensPerMinute: 8000 },
      notes: "Free tier: 30 RPM, 1,000 RPD, 8,000 TPM (corrected 2026-10-03 from live 413 error bodies — both openai/gpt-oss-20b and -120b cite 'Limit 8000'; the previous 12,000 figure was stale). Per-minute token cap is the bottleneck during interviews — our own prompt+max_tokens budget (~8.8K) exceeds this on prompt-heavy sessions, so 413s recur independent of any traffic spike. Upgrade at console.groq.com to lift TPM, or shrink the prompt/maxTokens budget in evaluate-session.ts.",
    },
    {
      name: "Google Gemini",
      type: "LLM",
      role: "Primary (slow calls) / Fallback (fast calls)",
      model: "gemini-3.5-flash-lite",
      status: geminiWindowErrors > geminiCalls.length * 0.2 ? "degraded" : "healthy",
      usage: {
        callsTotal: geminiCallsTotal,
        callsToday: geminiToday.length,
        tokensToday: geminiTokensToday,
        tokensTotal: geminiCalls.reduce((s, u) => s + (u.total_tokens || 0), 0),
        errorsTotal: geminiErrorsTotal,
        errorsToday: geminiToday.filter(u => u.status === "error" || u.status === "timeout").length,
        avgLatencyMs: geminiAvgLatency,
      },
      limits: { requestsPerDay: 250, requestsPerMinute: 10, tokensPerMinute: 250_000 },
      notes: "Migrated off gemini-2.5-flash (2026-10-03): Google restricted the 2.5 series to limited access ahead of its 2026-10-16 retirement and was already returning 429s. 3.5-flash-lite is same-priced and is Google's own recommended replacement — verify free-tier RPM/RPD/TPM caps at aistudio.google.com, as they may differ from the 2.5-flash figures below.",
    },
    {
      name: "Azure TTS",
      type: "TTS",
      role: "Primary",
      model: "Neural voices (Indian English)",
      status: svcStatus(az),
      usage: {
        callsTotal: az.callsTotal,
        callsToday: az.callsToday,
        charsToday: az.charsToday,
        charsTotal: az.charsTotal,
        errorsTotal: az.errorsTotal,
        errorsToday: az.errorsToday,
        avgLatencyMs: avgLat(az),
      },
      limits: { freeCharsPerMonth: 500_000 },
      notes: "Free tier: 0.5M chars/month (F0). Standard: $16/1M chars. Check portal.azure.com for usage.",
    },
    {
      name: "Cartesia",
      type: "TTS",
      role: "Fallback",
      model: "sonic-3",
      status: svcStatus(ca),
      usage: {
        callsTotal: ca.callsTotal,
        callsToday: ca.callsToday,
        charsToday: ca.charsToday,
        charsTotal: ca.charsTotal,
        errorsTotal: ca.errorsTotal,
        errorsToday: ca.errorsToday,
        avgLatencyMs: avgLat(ca),
      },
      limits: { freeSecondsPerMonth: 600 },
      notes: "Free: 10 min/month. Only used when Azure TTS fails. Check play.cartesia.ai for usage.",
    },
    {
      name: "Deepgram",
      type: "STT",
      role: "Primary",
      model: "Nova-3",
      status: svcStatus(dg),
      usage: {
        callsTotal: dg.callsTotal,
        callsToday: dg.callsToday,
        errorsTotal: dg.errorsTotal,
        errorsToday: dg.errorsToday,
        avgLatencyMs: avgLat(dg),
      },
      limits: { freeCredits: 200 },
      notes: "Pay-as-you-go with $200 free credit. Each token request = 1 STT session. Check console.deepgram.com.",
    },
    {
      name: "Sarvam AI",
      type: "STT",
      role: "Fallback (Indian English)",
      model: "saaras:v2",
      status: svcStatus(sv),
      usage: {
        callsTotal: sv.callsTotal,
        callsToday: sv.callsToday,
        errorsTotal: sv.errorsTotal,
        errorsToday: sv.errorsToday,
        avgLatencyMs: avgLat(sv),
      },
      limits: { freeRequestsPerDay: 50 },
      notes: "Used for Indian-English STT after Deepgram. Check dashboard.sarvam.ai for usage.",
    },
    {
      name: "Resend",
      type: "Email",
      role: "Transactional",
      model: "—",
      status: svcStatus(re),
      usage: {
        callsTotal: re.callsTotal,
        callsToday: re.callsToday,
        errorsTotal: re.errorsTotal,
        errorsToday: re.errorsToday,
        avgLatencyMs: avgLat(re),
      },
      limits: { freeEmailsPerDay: 100, freeEmailsPerMonth: 3000 },
      notes: "Free: 100/day, 3K/month. Sends: welcome, payment, renewal, re-engagement. Check resend.com/overview.",
    },
    {
      name: "Upstash Redis",
      type: "Cache / Rate Limiting",
      role: "Rate limiter",
      model: "—",
      status: "healthy",
      usage: {
        callsTotal: upstashEstCmdsTotal,
        callsToday: upstashEstCmdsToday,
        errorsTotal: 0,
        errorsToday: 0,
        avgLatencyMs: null,
      },
      limits: { freeCommandsPerDay: 10_000, freeStorageMb: 256 },
      notes: "Free: 10K commands/day, 256MB. ~2 cmds per rate-limited request. Check console.upstash.com.",
    },
  ];
}

/* ─── Cost Analytics ─── */

/** Roll the same rate-card math `getOverview`/`getCostData` use for live
 * estimates over one closed calendar month, for comparison against a real
 * invoice total entered via the "save-cost-reconciliation" action below. */
export async function modeledCostForMonth(month: string): Promise<number> {
  const start = `${month}-01`;
  const startDate = new Date(`${start}T00:00:00Z`);
  const end = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  const [llmUsage, serviceUsage] = await Promise.all([
    fetchJSON<{ total_tokens: number; is_fallback: boolean }>(
      `llm_usage?select=total_tokens,is_fallback&created_at=gte.${start}&created_at=lt.${end}&limit=20000`,
    ),
    fetchJSON<{ service: string; request_chars: number | null; status: string }>(
      `service_usage?select=service,request_chars,status&created_at=gte.${start}&created_at=lt.${end}&limit=20000`,
    ),
  ]);
  let primaryTok = 0, fallbackTok = 0;
  for (const u of llmUsage) {
    if (u.is_fallback) fallbackTok += u.total_tokens || 0;
    else primaryTok += u.total_tokens || 0;
  }
  let ttsChars = 0, sttCalls = 0;
  for (const r of serviceUsage) {
    if (TTS_SERVICES.has(r.service)) ttsChars += r.request_chars || 0;
    else if (STT_SERVICES.has(r.service) && r.status === "success") sttCalls += 1;
  }
  return costBreakdown({ llmTokensPrimary: primaryTok, llmTokensFallback: fallbackTok, ttsChars, sttCalls, sessions: 1 }).totalInr;
}

export interface CostReconciliationRow {
  month: string;
  actual_invoice_inr: number;
  modeled_inr: number;
  note: string | null;
  created_at: string;
}

/** Record a real, closed-period invoice total against this month's modeled
 * estimate — the "financial clock vs. operational clock" check the rate
 * card's own comments ask for but nothing previously tracked. Upserts by
 * month so re-entering a correction overwrites, not duplicates. */
export async function saveCostReconciliation(month: string, actualInvoiceInr: number, note?: string): Promise<CostReconciliationRow> {
  const modeledInr = await modeledCostForMonth(month);
  const res = await supa("cost_rate_reconciliations", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      month,
      actual_invoice_inr: actualInvoiceInr,
      modeled_inr: modeledInr,
      note: note ? note.slice(0, 500) : null,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`cost_rate_reconciliations upsert failed: HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const rows = await res.json() as CostReconciliationRow[];
  return rows[0];
}

export async function getCostData() {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const thirtyDaysAgo = daysAgo(30);
  const sevenDaysAgo = daysAgo(7);
  const fourteenDaysAgo = daysAgo(14);

  const [recentSessions, topSessions, endpointUsage, lastWeekSessions, reconciliations] = await Promise.all([
    // All sessions last 30d with cost fields — includes user_id for per-user aggregation
    fetchJSON<{
      id: string; user_id: string; type: string; focus: string; score: number; duration: number;
      llm_cost_inr: number | null; prompt_tokens: number | null; completion_tokens: number | null;
      created_at: string;
    }>(`sessions?select=id,user_id,type,focus,score,duration,llm_cost_inr,prompt_tokens,completion_tokens,created_at&created_at=gte.${thirtyDaysAgo}&order=created_at.desc&limit=2000`),
    // Top 30 most expensive sessions all-time
    fetchJSON<{
      id: string; user_id: string; type: string; focus: string; score: number; duration: number;
      llm_cost_inr: number | null; prompt_tokens: number | null; completion_tokens: number | null;
      created_at: string;
    }>(`sessions?select=id,user_id,type,focus,score,duration,llm_cost_inr,prompt_tokens,completion_tokens,created_at&llm_cost_inr=not.is.null&order=llm_cost_inr.desc.nullslast&limit=30`),
    // LLM usage by endpoint for cost-per-endpoint breakdown
    fetchJSON<{ endpoint: string; total_tokens: number; is_fallback: boolean; created_at: string }>(
      `llm_usage?select=endpoint,total_tokens,is_fallback,created_at&created_at=gte.${thirtyDaysAgo}&limit=5000`,
    ),
    // Sessions 8–14 days ago (prior week) for week-over-week comparison
    fetchJSON<{ llm_cost_inr: number | null }>(
      `sessions?select=llm_cost_inr&created_at=gte.${fourteenDaysAgo}&created_at=lt.${sevenDaysAgo}&limit=2000`,
    ),
    // Real invoice totals entered against modeled estimates — see saveCostReconciliation.
    fetchJSON<CostReconciliationRow>(`cost_rate_reconciliations?select=month,actual_invoice_inr,modeled_inr,note,created_at&order=month.desc&limit=12`),
  ]);

  const costedSessions = recentSessions.filter(s => s.llm_cost_inr != null && s.llm_cost_inr > 0);
  const totalLlmInr = costedSessions.reduce((sum, s) => sum + (s.llm_cost_inr || 0), 0);
  const avgCostPerSession = costedSessions.length > 0 ? totalLlmInr / costedSessions.length : 0;
  const highestSessionCostInr = topSessions.length > 0 ? (topSessions[0].llm_cost_inr || 0) : 0;

  // Data coverage — how many sessions have cost data vs total
  const nullCostCount = recentSessions.length - costedSessions.length;
  const dataCoveragePercent = recentSessions.length > 0
    ? Math.round((costedSessions.length / recentSessions.length) * 100)
    : 0;

  // Week-over-week: this week vs prior week
  const thisWeekSessions = costedSessions.filter(s => s.created_at >= sevenDaysAgo);
  const thisWeekInr = round2(thisWeekSessions.reduce((sum, s) => sum + (s.llm_cost_inr || 0), 0));
  const lastWeekInr = round2(lastWeekSessions.filter(s => s.llm_cost_inr != null && s.llm_cost_inr > 0)
    .reduce((sum, s) => sum + (s.llm_cost_inr || 0), 0));
  const wowDeltaPct = lastWeekInr > 0
    ? Math.round(((thisWeekInr - lastWeekInr) / lastWeekInr) * 100)
    : null;

  // Today's cost + anomaly detection (today vs 30d daily average)
  const todayCostInr = round2(costedSessions
    .filter(s => s.created_at?.slice(0, 10) === today)
    .reduce((sum, s) => sum + (s.llm_cost_inr || 0), 0));
  const dailyAvgInr = round2(totalLlmInr / 30);
  // Spike if today is 2× the 30d daily average and exceeds ₹0.20 absolute
  const isCostSpike = todayCostInr > dailyAvgInr * 2 && todayCostInr > 0.2;

  // Cost by focus type
  const focusMap: Record<string, { total: number; count: number }> = {};
  for (const s of costedSessions) {
    const key = s.focus || s.type || "unknown";
    if (!focusMap[key]) focusMap[key] = { total: 0, count: 0 };
    focusMap[key].total += s.llm_cost_inr || 0;
    focusMap[key].count++;
  }
  const byFocus: Record<string, { totalInr: number; sessions: number; avgInr: number }> = {};
  for (const [k, v] of Object.entries(focusMap)) {
    byFocus[k] = {
      totalInr: round2(v.total),
      sessions: v.count,
      avgInr: round2(v.count > 0 ? v.total / v.count : 0),
    };
  }

  // Daily cost trend (30d)
  const perDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    perDay[new Date(now - i * 86400000).toISOString().slice(0, 10)] = 0;
  }
  for (const s of costedSessions) {
    const d = s.created_at?.slice(0, 10);
    if (d && d in perDay) perDay[d] = round2((perDay[d] || 0) + (s.llm_cost_inr || 0));
  }

  // Cost by endpoint (estimated from token counts × rate card)
  const epMap: Record<string, { primaryTokens: number; fallbackTokens: number; calls: number }> = {};
  for (const u of endpointUsage) {
    const ep = u.endpoint || "unknown";
    if (!epMap[ep]) epMap[ep] = { primaryTokens: 0, fallbackTokens: 0, calls: 0 };
    epMap[ep].calls++;
    if (u.is_fallback) epMap[ep].fallbackTokens += u.total_tokens || 0;
    else epMap[ep].primaryTokens += u.total_tokens || 0;
  }
  const byEndpoint: Record<string, { estimatedInr: number; tokens: number; calls: number }> = {};
  for (const [ep, d] of Object.entries(epMap)) {
    byEndpoint[ep] = {
      estimatedInr: round2(llmInr(d.primaryTokens, false) + llmInr(d.fallbackTokens, true)),
      tokens: d.primaryTokens + d.fallbackTokens,
      calls: d.calls,
    };
  }

  // Top 5 users by LLM spend (30d) — compute from costedSessions
  const userCostMap: Record<string, { total: number; sessions: number }> = {};
  for (const s of costedSessions) {
    const uid = s.user_id || "unknown";
    if (!userCostMap[uid]) userCostMap[uid] = { total: 0, sessions: 0 };
    userCostMap[uid].total += s.llm_cost_inr || 0;
    userCostMap[uid].sessions++;
  }
  const topUserIds = Object.entries(userCostMap)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5)
    .map(([uid]) => uid);
  // Fetch profiles for top users
  let topUserProfiles: { id: string; name: string | null; email: string }[] = [];
  if (topUserIds.length > 0) {
    topUserProfiles = await fetchJSON<{ id: string; name: string | null; email: string }>(
      `profiles?id=in.(${topUserIds.map(id => encodeURIComponent(id)).join(",")})&select=id,name,email&limit=5`,
    );
  }
  const profileMap = new Map(topUserProfiles.map(p => [p.id, { name: p.name || "(no name)", email: p.email }]));
  const topUsersByCost = topUserIds.map(uid => ({
    userId: uid,
    name: profileMap.get(uid)?.name || "(no name)",
    email: profileMap.get(uid)?.email || "—",
    totalLlmInr: round2(userCostMap[uid].total),
    sessions: userCostMap[uid].sessions,
    avgInr: round2(userCostMap[uid].sessions > 0 ? userCostMap[uid].total / userCostMap[uid].sessions : 0),
  }));

  return {
    totalLlmInr: round2(totalLlmInr),
    avgCostPerSession: round2(avgCostPerSession),
    highestSessionCostInr: round2(highestSessionCostInr),
    sessionCount: costedSessions.length,
    totalSessions30d: recentSessions.length,
    nullCostCount,
    dataCoveragePercent,
    thisWeekInr,
    lastWeekInr,
    wowDeltaPct,
    todayCostInr,
    dailyAvgInr,
    isCostSpike,
    byFocus,
    perDay,
    byEndpoint,
    topUsersByCost,
    // Rate-card provenance — see _cost-helpers.ts's own "list estimates, not
    // billed amounts" caveat. Surfaced here so staleness is visible wherever
    // the modeled cost figures are, not just in the health-alerts tab.
    ratesLastVerifiedAt: RATES_LAST_VERIFIED_AT,
    rateCardAgeDays: rateCardAgeDays(now),
    rateCardIsStale: isRateCardStale(now),
    // Real invoice totals vs. this tool's own modeled estimate, entered via
    // the "save-cost-reconciliation" action — the FinOps "operational clock
    // vs. financial clock" split applied concretely.
    costReconciliations: reconciliations
      .map(r => ({
        month: r.month,
        actualInvoiceInr: r.actual_invoice_inr,
        modeledInr: r.modeled_inr,
        variancePct: r.modeled_inr > 0 ? Math.round(((r.actual_invoice_inr - r.modeled_inr) / r.modeled_inr) * 1000) / 10 : null,
        note: r.note,
      }))
      .sort((a, b) => b.month.localeCompare(a.month)),
    topExpensiveSessions: topSessions.map(s => ({
      id: s.id,
      userId: s.user_id,
      focus: s.focus || s.type || "—",
      score: s.score || 0,
      duration: s.duration || 0,
      llmCostInr: round2(s.llm_cost_inr || 0),
      promptTokens: s.prompt_tokens || 0,
      completionTokens: s.completion_tokens || 0,
      date: s.created_at,
    })),
  };
}
