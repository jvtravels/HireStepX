/* Admin sections: overview, users, sessions, feedback, calendar, outcomes. */

import { daysAgo, fetchCandidateCount, fetchCount, fetchEmployerIds, fetchJSON, LIMIT_PROFILES, LIMIT_SESSIONS, LIMIT_PAYMENTS, LIMIT_LLM, TTS_SERVICES, STT_SERVICES, LIMIT_RECENT } from "./_admin-shared";
import { costBreakdown, DEFAULT_COST_RATES } from "./_cost-helpers";
import { getSarvamMonthlySpend } from "./_sarvam-credit-guard";
import { getDeepgramMonthlySpend } from "./_deepgram-credit-guard";

/* ─── Section Handlers ─── */

export async function getOverview() {
  const weekAgo = daysAgo(7);
  const monthAgo = daysAgo(30);
  const today = daysAgo(0).slice(0, 10);

  // Use counts + targeted queries instead of loading everything
  const employerIds = await fetchEmployerIds();
  const [
    totalUserCount,
    weekUserCount,
    totalSessionCount,
    weekSessionCount,
    monthSessionCount,
    allProfiles,
    recentSessions,
    payments,
    llmRecent,
    serviceRecent,
  ] = await Promise.all([
    fetchCandidateCount(employerIds),
    fetchCandidateCount(employerIds, `&created_at=gte.${weekAgo}`),
    fetchCount("sessions"),
    fetchCount("sessions", `&created_at=gte.${weekAgo}`),
    fetchCount("sessions", `&created_at=gte.${monthAgo}`),
    fetchJSON<{ id: string; subscription_tier: string | null; subscription_end: string | null; practice_timestamps: string[] | null; created_at: string }>(
      `profiles?select=id,subscription_tier,subscription_end,practice_timestamps,created_at&limit=${LIMIT_PROFILES}`
    ),
    fetchJSON<{ user_id: string; score: number; created_at: string }>(
      `sessions?select=user_id,score,created_at&order=created_at.desc&limit=${LIMIT_SESSIONS}`
    ),
    fetchJSON<{ amount: number; status: string; created_at: string }>(
      `payments?select=amount,status,created_at&order=created_at.desc&limit=${LIMIT_PAYMENTS}`
    ),
    fetchJSON<{ total_tokens: number; is_fallback: boolean; status: string; created_at: string }>(
      `llm_usage?select=total_tokens,is_fallback,status,created_at&order=created_at.desc&limit=${LIMIT_LLM}`
    ),
    // Voice cost lives in service_usage: TTS request_chars (precise) + STT
    // token-issuance calls (count only — STT minutes aren't logged). Scoped to
    // the 30-day window to match the per-session divisor.
    fetchJSON<{ service: string; request_chars: number | null; status: string; created_at: string }>(
      `service_usage?select=service,request_chars,status,created_at&created_at=gte.${monthAgo}&limit=5000`
    ),
  ]);

  const profiles = allProfiles.filter((p) => !employerIds.has(p.id));

  const now = Date.now();

  // Tier breakdown + active users
  const tierBreakdown: Record<string, number> = { free: 0, starter: 0, team: 0 };
  let activeLastWeek = 0;
  const sevenDaysFromNow = new Date(now + 7 * 86400000).toISOString().slice(0, 10);
  let churningThisWeek = 0;
  let paidUserCount = 0;
  for (const p of profiles) {
    const tier = p.subscription_tier || "free";
    tierBreakdown[tier] = (tierBreakdown[tier] || 0) + 1;
    if (p.practice_timestamps?.length) {
      const last = new Date(p.practice_timestamps[p.practice_timestamps.length - 1]).getTime();
      if (now - last < 7 * 86400000) activeLastWeek++;
    }
    if (tier !== "free" && tier != null) {
      paidUserCount++;
      // Subscription ending within the next 7 days
      if (p.subscription_end && p.subscription_end >= today && p.subscription_end <= sevenDaysFromNow) {
        churningThisWeek++;
      }
    }
  }
  const conversionRate = profiles.length > 0 ? Math.round((paidUserCount / profiles.length) * 100) : 0;

  // Avg score
  const scoredSessions = recentSessions.filter(s => s.score != null && s.score > 0);
  const avgScore = scoredSessions.length > 0
    ? Math.round(scoredSessions.reduce((sum, s) => sum + s.score, 0) / scoredSessions.length)
    : 0;

  // Sessions per day (last 30 days)
  const sessionsPerDay: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    sessionsPerDay[new Date(now - i * 86400000).toISOString().slice(0, 10)] = 0;
  }
  for (const s of recentSessions) {
    const d = s.created_at?.slice(0, 10);
    if (d && d in sessionsPerDay) sessionsPerDay[d]++;
  }

  // Revenue
  const successPayments = payments.filter(p => p.status === "captured" || p.status === "paid" || p.status === "success");
  const totalRevenue = successPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const revenueThisMonth = successPayments.filter(p => p.created_at >= monthAgo).reduce((sum, p) => sum + (p.amount || 0), 0);

  // LLM
  const todayLlm = llmRecent.filter(u => u.created_at?.startsWith(today));
  const tokensToday = todayLlm.reduce((sum, u) => sum + (u.total_tokens || 0), 0);
  const fallbackRate = llmRecent.length > 0
    ? Math.round((llmRecent.filter(u => u.is_fallback).length / llmRecent.length) * 100) : 0;
  const errorRate = llmRecent.length > 0
    ? Math.round((llmRecent.filter(u => u.status === "error" || u.status === "timeout").length / llmRecent.length) * 100) : 0;

  // ── Marginal cost (estimate, rate-card based — see _cost-helpers.ts) ──
  // 30-day window so the per-session number isn't whipsawed by a quiet day.
  // llmRecent is capped at LIMIT_LLM; on high volume this undercounts and the
  // estimate reads low — acceptable for a dashboard signal, flagged in the UI.
  let llmTokens30dPrimary = 0, llmTokens30dFallback = 0;
  for (const u of llmRecent) {
    if (!u.created_at || u.created_at < monthAgo) continue;
    if (u.is_fallback) llmTokens30dFallback += u.total_tokens || 0;
    else llmTokens30dPrimary += u.total_tokens || 0;
  }
  let ttsChars30d = 0, sttCalls30d = 0;
  let llmTokensTodayPrimary = 0, llmTokensTodayFallback = 0, ttsCharsToday = 0, sttCallsToday = 0;
  for (const u of llmRecent) {
    if (!u.created_at?.startsWith(today)) continue;
    if (u.is_fallback) llmTokensTodayFallback += u.total_tokens || 0;
    else llmTokensTodayPrimary += u.total_tokens || 0;
  }
  for (const r of serviceRecent) {
    const isToday = r.created_at?.startsWith(today);
    if (TTS_SERVICES.has(r.service)) {
      ttsChars30d += r.request_chars || 0;
      if (isToday) ttsCharsToday += r.request_chars || 0;
    } else if (STT_SERVICES.has(r.service) && r.status === "success") {
      sttCalls30d += 1;
      if (isToday) sttCallsToday += 1;
    }
  }
  const cost30d = costBreakdown({
    llmTokensPrimary: llmTokens30dPrimary,
    llmTokensFallback: llmTokens30dFallback,
    ttsChars: ttsChars30d,
    sttCalls: sttCalls30d,
    sessions: monthSessionCount,
  });
  const costToday = costBreakdown({
    llmTokensPrimary: llmTokensTodayPrimary,
    llmTokensFallback: llmTokensTodayFallback,
    ttsChars: ttsCharsToday,
    sttCalls: sttCallsToday,
    sessions: recentSessions.filter(s => s.created_at?.startsWith(today)).length,
  });

  // Activation funnel (30d): signups → first session → paid
  const signups30dProfiles = profiles.filter(p => p.created_at >= monthAgo);
  const signups30dIds = new Set(signups30dProfiles.map(p => p.id));
  const sessionUserIds = new Set(recentSessions.filter(s => s.created_at >= monthAgo && signups30dIds.has(s.user_id)).map(s => s.user_id));
  const activatedCount = sessionUserIds.size;
  const convertedCount = signups30dProfiles.filter(p => {
    const tier = p.subscription_tier;
    return tier && tier !== "free" && sessionUserIds.has(p.id);
  }).length;
  const activationRate = signups30dIds.size > 0 ? Math.round((activatedCount / signups30dIds.size) * 100) : 0;
  const paidConversionRate = activatedCount > 0 ? Math.round((convertedCount / activatedCount) * 100) : 0;

  const anomalies = await getAnomalies();

  // Prepaid/free credit grants — separate from the estimated-spend cost
  // breakdown above, these track real remaining balance against the fixed
  // Sarvam startup-program and Deepgram startup-credit grants.
  const [sarvamCredits, deepgramCredits] = await Promise.all([
    getSarvamMonthlySpend(),
    getDeepgramMonthlySpend(),
  ]);

  return {
    users: {
      total: totalUserCount,
      today: profiles.filter(p => p.created_at?.startsWith(today)).length,
      thisWeek: weekUserCount,
      activeLastWeek,
      tierBreakdown,
      churningThisWeek,
      conversionRate,
      paidUserCount,
    },
    sessions: { total: totalSessionCount, today: recentSessions.filter(s => s.created_at?.startsWith(today)).length, thisWeek: weekSessionCount, avgScore, perDay: sessionsPerDay },
    revenue: { totalPaise: totalRevenue, thisMonthPaise: revenueThisMonth, paymentCount: successPayments.length },
    activation: {
      signups30d: signups30dIds.size,
      activatedCount,
      activationRate,
      convertedCount,
      paidConversionRate,
    },
    llm: { tokensToday, fallbackRate, errorRate, totalCalls: llmRecent.length },
    cost: {
      perSessionInr: cost30d.perSessionInr,
      todayInr: costToday.totalInr,
      month: { totalInr: cost30d.totalInr, llmInr: cost30d.llmInr, ttsInr: cost30d.ttsInr, sttInr: cost30d.sttInr, sessions: cost30d.sessions },
      estimate: true,
    },
    credits: {
      sarvam: { usedCredits: sarvamCredits.usedCredits, capCredits: sarvamCredits.capCredits },
      deepgram: { usedUsd: deepgramCredits.usedUsd, capUsd: deepgramCredits.capUsd },
    },
    anomalies,
  };
}

const USERS_SCAN_PAGE = 1000;

/* Candidates only — employer accounts share the profiles table but belong to
 * the Employers tab. Walks ids in signup order, skipping employers, so the page
 * and total are exact for any number of employers. Only ids are scanned; full
 * rows are fetched for the final page. */
export async function getUsers(search?: string, offset = 0, limit = 50) {
  const employerIds = await fetchEmployerIds();
  const searchFilter = search
    ? `&or=(name.ilike.*${encodeURIComponent(search)}*,email.ilike.*${encodeURIComponent(search)}*)`
    : "";

  const wanted = offset + limit;
  const candidateIds: string[] = [];
  for (let raw = 0; candidateIds.length < wanted; raw += USERS_SCAN_PAGE) {
    const rows = await fetchJSON<{ id: string }>(
      `profiles?select=id&order=created_at.desc&offset=${raw}&limit=${USERS_SCAN_PAGE}${searchFilter}`,
    );
    for (const r of rows) if (!employerIds.has(r.id)) candidateIds.push(r.id);
    if (rows.length < USERS_SCAN_PAGE) break;
  }
  const pageIds = candidateIds.slice(offset, wanted);

  const [rowsForPage, totalCount] = await Promise.all([
    pageIds.length > 0
      ? fetchJSON<{ id: string }>(
          `profiles?select=id,name,email,subscription_tier,created_at,practice_timestamps,has_completed_onboarding,subscription_end&id=in.(${pageIds.map(encodeURIComponent).join(",")})`,
        )
      : Promise.resolve([]),
    fetchCandidateCount(employerIds, searchFilter),
  ]);
  const byId = new Map(rowsForPage.map((r) => [r.id, r]));
  const profiles = pageIds.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));

  // Get session counts + last-7d counts for the users on this page
  const userIds = (profiles as Array<{ id: string }>).map(p => p.id);
  const countMap: Record<string, number> = {};
  const last7dMap: Record<string, number> = {};
  if (userIds.length > 0) {
    const idList = userIds.map(id => encodeURIComponent(id)).join(",");
    const sevenDaysAgo = daysAgo(7);
    const [allSessions, recentSessions] = await Promise.all([
      fetchJSON<{ user_id: string }>(
        `sessions?select=user_id&user_id=in.(${idList})&limit=10000`,
      ),
      fetchJSON<{ user_id: string }>(
        `sessions?select=user_id&user_id=in.(${idList})&created_at=gte.${sevenDaysAgo}&limit=5000`,
      ),
    ]);
    for (const s of allSessions) countMap[s.user_id] = (countMap[s.user_id] || 0) + 1;
    for (const s of recentSessions) last7dMap[s.user_id] = (last7dMap[s.user_id] || 0) + 1;
  }

  const users = (profiles as Array<{
    id: string; name: string | null; email: string; subscription_tier: string;
    created_at: string; practice_timestamps: string[] | null;
    has_completed_onboarding: boolean; subscription_end: string | null;
  }>).map(p => ({
    id: p.id,
    name: p.name || "—",
    email: p.email,
    tier: p.subscription_tier || "free",
    sessionsCount: countMap[p.id] || 0,
    sessionsLast7d: last7dMap[p.id] || 0,
    lastActive: p.practice_timestamps?.length
      ? p.practice_timestamps[p.practice_timestamps.length - 1]
      : null,
    onboarded: !!p.has_completed_onboarding,
    joined: p.created_at,
    subscriptionEnd: p.subscription_end,
  }));

  return { users, total: totalCount };
}

export async function getUserDetail(userId: string) {
  const encoded = encodeURIComponent(userId);
  const [profile, sessions, payments, llmUsage, feedback, credits] = await Promise.all([
    fetchJSON(`profiles?id=eq.${encoded}&select=id,name,email,subscription_tier,target_role,target_company,experience_level,industry,subscription_start,subscription_end,cancel_at_period_end,has_completed_onboarding,created_at&limit=1`),
    fetchJSON<{ id: string; date: string; type: string; difficulty: string; duration: number; score: number; skill_scores: Record<string, unknown> | null; created_at: string; llm_cost_inr: number | null; prompt_tokens: number | null; completion_tokens: number | null; target_role: string | null; target_company: string | null }>(`sessions?user_id=eq.${encoded}&select=id,date,type,difficulty,duration,score,skill_scores,created_at,llm_cost_inr,prompt_tokens,completion_tokens,target_role,target_company&order=created_at.desc&limit=50`),
    fetchJSON(`payments?user_id=eq.${encoded}&select=id,razorpay_payment_id,amount,currency,status,plan,tier,created_at&order=created_at.desc&limit=30`),
    fetchJSON(`llm_usage?user_id=eq.${encoded}&select=endpoint,model,total_tokens,latency_ms,status,created_at&order=created_at.desc&limit=100`),
    fetchJSON(`feedback?user_id=eq.${encoded}&select=id,rating,comment,session_score,session_type,created_at&order=created_at.desc&limit=20`),
    fetchJSON<{ balance: number }>(`session_credits?user_id=eq.${encoded}&select=balance&limit=1`),
  ]);

  // Compute total LLM cost across this user's sessions
  const totalLlmCostInr = sessions.reduce((sum, s) => sum + (s.llm_cost_inr || 0), 0);
  const totalPromptTokens = sessions.reduce((sum, s) => sum + (s.prompt_tokens || 0), 0);
  const totalCompletionTokens = sessions.reduce((sum, s) => sum + (s.completion_tokens || 0), 0);

  // Top 3 most expensive sessions
  const top3ExpensiveSessions = [...sessions]
    .filter(s => s.llm_cost_inr != null && s.llm_cost_inr > 0)
    .sort((a, b) => (b.llm_cost_inr || 0) - (a.llm_cost_inr || 0))
    .slice(0, 3)
    .map(s => ({ id: s.id, type: s.type, date: s.created_at, llmCostInr: s.llm_cost_inr, promptTokens: s.prompt_tokens, completionTokens: s.completion_tokens }));

  return {
    profile: profile[0] || null,
    sessions,
    payments,
    llmUsage,
    feedback,
    creditBalance: Array.isArray(credits) && credits.length > 0 ? (credits[0].balance ?? 0) : 0,
    costSummary: {
      totalLlmCostInr: Math.round(totalLlmCostInr * 100) / 100,
      totalPromptTokens,
      totalCompletionTokens,
      top3ExpensiveSessions,
    },
  };
}

/**
 * Full session payload for admin drill-down: metadata + transcript + skill
 * scores + cached report (if generated). Q&A pairing is done client-side
 * from the transcript array since the engine writes interleaved
 * { speaker: "ai"|"user", text } turns.
 */
export async function getSessionDetail(sessionId: string) {
  const encoded = encodeURIComponent(sessionId);
  const [sessionRows, llmUsage] = await Promise.all([
    fetchJSON<{
      id: string; user_id: string; date: string; type: string; difficulty: string;
      focus: string; duration: number; score: number; questions: number;
      transcript: Array<{ speaker: string; text: string; time?: string }>;
      ai_feedback: string;
      skill_scores: Record<string, unknown> | null;
      job_description?: string;
      jd_analysis?: Record<string, unknown> | null;
      report_json?: Record<string, unknown> | null;
      report_version?: string | null;
      report_generated_at?: string | null;
      created_at: string;
    }>(
      `sessions?id=eq.${encoded}&select=*&limit=1`,
    ),
    fetchJSON<{ endpoint: string; model: string; total_tokens: number; prompt_tokens: number; completion_tokens: number; is_fallback: boolean; latency_ms: number; status: string; created_at: string }>(
      `llm_usage?session_id=eq.${encoded}&select=endpoint,model,total_tokens,prompt_tokens,completion_tokens,is_fallback,latency_ms,status,created_at&order=created_at.desc&limit=20`,
    ),
  ]);
  const session = sessionRows[0];
  if (!session) return { session: null, profile: null, qaPairs: [], llmCalls: [], costInr: 0 };

  // Fetch the user's profile so admins can see who this session belongs to.
  const profileRows = await fetchJSON<{ id: string; name: string | null; email: string }>(
    `profiles?id=eq.${encodeURIComponent(session.user_id)}&select=id,name,email&limit=1`,
  );
  const profile = profileRows[0] || null;

  // Pair AI questions with the candidate answers that follow them.
  const transcript = Array.isArray(session.transcript) ? session.transcript : [];
  const qaPairs: Array<{ question: string; answer: string; questionTime?: string; answerTime?: string }> = [];
  let pendingQuestion: { text: string; time?: string } | null = null;
  for (const turn of transcript) {
    const speaker = String(turn?.speaker ?? "").toLowerCase();
    const text = String(turn?.text ?? "").trim();
    if (!text) continue;
    const isAI = speaker === "ai" || speaker === "interviewer" || speaker === "assistant";
    const isUser = speaker === "user" || speaker === "candidate";
    if (isAI) {
      // Flush any orphaned question (interviewer asked twice, candidate didn't answer).
      if (pendingQuestion) {
        qaPairs.push({ question: pendingQuestion.text, answer: "(no answer)", questionTime: pendingQuestion.time });
      }
      pendingQuestion = { text, time: turn.time };
    } else if (isUser && pendingQuestion) {
      qaPairs.push({
        question: pendingQuestion.text,
        answer: text,
        questionTime: pendingQuestion.time,
        answerTime: turn.time,
      });
      pendingQuestion = null;
    } else if (isUser) {
      // Candidate spoke without a paired question (initial monologue, etc.)
      qaPairs.push({ question: "(no question recorded)", answer: text, answerTime: turn.time });
    }
  }
  if (pendingQuestion) {
    qaPairs.push({ question: pendingQuestion.text, answer: "(no answer)", questionTime: pendingQuestion.time });
  }

  // Compute cost from session-scoped llm_usage rows
  let primaryTok = 0, fallbackTok = 0, promptTok = 0, completionTok = 0;
  for (const u of llmUsage) {
    promptTok += u.prompt_tokens || 0;
    completionTok += u.completion_tokens || 0;
    if (u.is_fallback) fallbackTok += u.total_tokens || 0;
    else primaryTok += u.total_tokens || 0;
  }
  const sessionCost = costBreakdown(
    { llmTokensPrimary: primaryTok, llmTokensFallback: fallbackTok, ttsChars: 0, sttCalls: 0, sessions: 1 },
    DEFAULT_COST_RATES,
  );

  return { session, profile, qaPairs, llmCalls: llmUsage, costInr: sessionCost.llmInr, promptTokens: promptTok, completionTokens: completionTok };
}

export interface AnomalyHighSpendUser {
  userId: string;
  tokens: number;
  zScore: number;
}

export interface AnomaliesResult {
  highSpendUsers: AnomalyHighSpendUser[];
  runawayCallsToday: number;
}

export async function getAnomalies(): Promise<AnomaliesResult> {
  const since = daysAgo(1);
  const [recentRows, runawayRows] = await Promise.all([
    fetchJSON<{ user_id: string; total_tokens: number; created_at: string }>(
      `llm_usage?select=user_id,total_tokens,created_at&created_at=gte.${since}&limit=5000`,
    ),
    fetchJSON<{ id: string }>(
      `llm_usage?select=id&total_tokens=gt.8000&created_at=gte.${since}&limit=1000`,
    ),
  ]);

  // Sum tokens per user_id
  const perUser = new Map<string, number>();
  for (const row of recentRows) {
    if (!row.user_id) continue;
    perUser.set(row.user_id, (perUser.get(row.user_id) || 0) + (row.total_tokens || 0));
  }

  const values = Array.from(perUser.values()).filter(v => v > 0);
  const highSpendUsers: AnomalyHighSpendUser[] = [];

  if (values.length === 1) {
    // Only one user — flag if over 10,000 tokens
    const [userId, tokens] = Array.from(perUser.entries())[0];
    if (tokens > 10000) {
      highSpendUsers.push({ userId, tokens, zScore: 0 });
    }
  } else if (values.length > 1) {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stddev = Math.sqrt(variance);
    const threshold = stddev > 0 ? mean + 2.5 * stddev : mean * 3;

    for (const [userId, tokens] of perUser.entries()) {
      if (tokens > threshold) {
        const zScore = stddev > 0 ? Math.round(((tokens - mean) / stddev) * 100) / 100 : 0;
        highSpendUsers.push({ userId, tokens, zScore });
      }
    }
    highSpendUsers.sort((a, b) => b.tokens - a.tokens);
  }

  return {
    highSpendUsers,
    runawayCallsToday: runawayRows.length,
  };
}

export async function getSessions() {
  const [sessions, totalCount] = await Promise.all([
    fetchJSON<{
      id: string; user_id: string; date: string; type: string; difficulty: string; focus: string;
      duration: number; score: number; skill_scores: Record<string, number> | null; created_at: string;
      llm_cost_inr: number | null; prompt_tokens: number | null; completion_tokens: number | null;
    }>(`sessions?select=id,user_id,date,type,difficulty,focus,duration,score,skill_scores,created_at,llm_cost_inr,prompt_tokens,completion_tokens&order=created_at.desc&limit=${LIMIT_SESSIONS}`),
    fetchCount("sessions"),
  ]);

  const scoreDistribution: Record<string, number> = {};
  for (let i = 0; i <= 90; i += 10) { scoreDistribution[`${i}-${i + 9}`] = 0; }
  const byType: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  const skillTotals: Record<string, { sum: number; count: number }> = {};
  let durationSum = 0; let durationCount = 0;

  for (const s of sessions) {
    if (s.score != null) { const b = Math.min(90, Math.floor(s.score / 10) * 10); scoreDistribution[`${b}-${b + 9}`]++; }
    byType[s.type || "unknown"] = (byType[s.type || "unknown"] || 0) + 1;
    byDifficulty[s.difficulty || "unknown"] = (byDifficulty[s.difficulty || "unknown"] || 0) + 1;
    if (s.duration > 0) { durationSum += s.duration; durationCount++; }
    if (s.skill_scores) {
      for (const [skill, score] of Object.entries(s.skill_scores)) {
        if (!skillTotals[skill]) skillTotals[skill] = { sum: 0, count: 0 };
        skillTotals[skill].sum += score as number;
        skillTotals[skill].count++;
      }
    }
  }

  const avgSkillScores: Record<string, number> = {};
  for (const [skill, { sum, count }] of Object.entries(skillTotals)) { avgSkillScores[skill] = Math.round(sum / count); }

  return {
    total: totalCount,
    avgScore: sessions.length > 0 ? Math.round(sessions.reduce((s, x) => s + (x.score || 0), 0) / sessions.length) : 0,
    avgDuration: durationCount > 0 ? Math.round(durationSum / durationCount) : 0,
    scoreDistribution, byType, byDifficulty, avgSkillScores,
    recent: sessions.slice(0, LIMIT_RECENT).map(s => ({
      id: s.id, userId: s.user_id, type: s.type, difficulty: s.difficulty, focus: s.focus,
      score: s.score, duration: s.duration, date: s.created_at,
      llmCostInr: s.llm_cost_inr ?? null, promptTokens: s.prompt_tokens ?? null, completionTokens: s.completion_tokens ?? null,
      isFallback: false,
    })),
  };
}

export async function getFeedback() {
  const [feedback, totalCount] = await Promise.all([
    fetchJSON<{
      id: string; user_id: string; session_id: string; rating: string; comment: string;
      session_score: number; session_type: string; created_at: string;
    }>("feedback?select=id,user_id,session_id,rating,comment,session_score,session_type,created_at&order=created_at.desc&limit=200"),
    fetchCount("feedback"),
  ]);

  const byRating: Record<string, number> = {};
  for (const f of feedback) { byRating[f.rating] = (byRating[f.rating] || 0) + 1; }

  return { total: totalCount, byRating, recent: feedback.slice(0, LIMIT_RECENT) };
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  type: string;
  date: string;
  time?: string;
  company?: string;
  created_at: string;
}

export async function getCalendar() {
  const weekAgo = daysAgo(7);
  const today = new Date().toISOString();
  // calendar_events has no "reminded" column — reminder delivery is tracked
  // in the normalized calendar_reminder_log (one row per event+channel+lead-
  // time actually sent, see its table comment). Derive "reminded" from
  // whether an event has any log row at all, rather than querying a column
  // that was never part of the schema.
  const [allEvents, profiles, reminderLog] = await Promise.all([
    fetchJSON<CalendarEvent>("calendar_events?select=id,user_id,type,date,time,company,created_at&order=date.desc&limit=500"),
    fetchJSON<{ id: string; name: string | null; email: string }>("profiles?select=id,name,email&limit=2000"),
    fetchJSON<{ event_id: string }>("calendar_reminder_log?select=event_id&order=sent_at.desc&limit=2000"),
  ]);
  const profileMap = new Map(profiles.map((p) => [p.id, { name: p.name || "(no name)", email: p.email }]));
  const remindedEventIds = new Set(reminderLog.map((r) => r.event_id));

  const upcoming = allEvents.filter((e) => e.date >= today).length;
  const pastWeek = allEvents.filter((e) => e.date >= weekAgo && e.date < today).length;

  // Events grouped by type
  const byType: Record<string, number> = {};
  for (const e of allEvents) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }

  const recent = allEvents.slice(0, 50).map((e) => ({
    id: e.id,
    userName: profileMap.get(e.user_id)?.name || "(deleted user)",
    userEmail: profileMap.get(e.user_id)?.email || "—",
    type: e.type,
    company: e.company || "—",
    date: e.date,
    time: e.time || "",
    reminded: remindedEventIds.has(e.id),
  }));

  return {
    total: allEvents.length,
    upcoming,
    pastWeek,
    byType,
    recent,
  };
}

/**
 * User outcomes — voluntary self-reports of post-HireStepX job-search
 * results. The data unlock for fundraising case studies. Returns counts
 * + the share-permitted testimonials (anonymized: only first name).
 */
export async function getOutcomes() {
  const [outcomes, profiles] = await Promise.all([
    fetchJSON<{
      user_id: string; applied: boolean | null; interviewed: boolean | null;
      offer: boolean | null; accepted: boolean | null;
      company: string | null; role_landed: string | null;
      testimonial: string | null; may_share_publicly: boolean;
      reported_at: string;
    }>("user_outcomes?select=*&order=reported_at.desc&limit=500"),
    fetchJSON<{ id: string; name: string | null }>("profiles?select=id,name&limit=2000"),
  ]);
  const profileMap = new Map(profiles.map((p) => [p.id, p.name || ""]));
  const total = outcomes.length;
  const applied = outcomes.filter((o) => o.applied === true).length;
  const interviewed = outcomes.filter((o) => o.interviewed === true).length;
  const offer = outcomes.filter((o) => o.offer === true).length;
  const accepted = outcomes.filter((o) => o.accepted === true).length;
  const offerRate = total > 0 ? Math.round((offer / total) * 100) : 0;

  const shareableTestimonials = outcomes
    .filter((o) => o.may_share_publicly && o.testimonial)
    .slice(0, 30)
    .map((o) => ({
      firstName: (profileMap.get(o.user_id) || "Anonymous").split(" ")[0],
      company: o.company || "—",
      roleLanded: o.role_landed || "—",
      testimonial: o.testimonial || "",
      reportedAt: o.reported_at,
    }));

  const recent = outcomes.slice(0, 50).map((o) => ({
    name: profileMap.get(o.user_id) || "(deleted user)",
    applied: o.applied,
    interviewed: o.interviewed,
    offer: o.offer,
    accepted: o.accepted,
    company: o.company || "—",
    roleLanded: o.role_landed || "—",
    reportedAt: o.reported_at,
  }));

  return { total, applied, interviewed, offer, accepted, offerRate, shareableTestimonials, recent };
}
