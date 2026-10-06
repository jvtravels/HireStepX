/* Health-alert signal computation, extracted from admin-data.ts so the
 * daily uptime-check cron can push these signals via email instead of
 * them sitting poll-only behind the admin dashboard's "health" tab. */

import { RATES_LAST_VERIFIED_AT, RATE_STALENESS_THRESHOLD_DAYS, rateCardAgeDays, isRateCardStale } from "./_cost-helpers";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function supa(path: string, opts?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });
}

async function fetchJSON<T = unknown>(path: string): Promise<T[]> {
  const res = await supa(path);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[health-alerts] supabase query failed: ${path.slice(0, 120)} → HTTP ${res.status}: ${body.slice(0, 200)}`);
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

type AlertSeverity = "critical" | "warning";
export interface HealthAlert {
  severity: AlertSeverity;
  code: string;
  message: string;
  action: string;
}

export async function getHealthAlerts(): Promise<{ alerts: HealthAlert[]; checkedAt: string }> {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86400000).toISOString().slice(0, 10);
  const sevenDaysAgo = daysAgo(7);
  const fourteenDaysAgo = daysAgo(14);

  const [todaySessions, recentSessions, llmUsageRecent, llmUsagePrev] = await Promise.all([
    // Sessions today (count + cost coverage)
    fetchJSON<{ id: string; llm_cost_inr: number | null; score: number | null; created_at: string }>(
      `sessions?select=id,llm_cost_inr,score,created_at&created_at=gte.${today}&limit=500`,
    ),
    // Sessions last 30d for volume baseline (just ids + date, cheap)
    fetchJSON<{ created_at: string }>(
      `sessions?select=created_at&created_at=gte.${sevenDaysAgo}&limit=2000`,
    ),
    // LLM usage last 24h for fallback rate
    fetchJSON<{ is_fallback: boolean; total_tokens: number }>(
      `llm_usage?select=is_fallback,total_tokens&created_at=gte.${yesterday}&limit=2000`,
    ),
    // LLM usage prior week for WoW fallback comparison
    fetchJSON<{ is_fallback: boolean }>(
      `llm_usage?select=is_fallback&created_at=gte.${fourteenDaysAgo}&created_at=lt.${sevenDaysAgo}&limit=2000`,
    ),
  ]);

  const alerts: HealthAlert[] = [];
  const round1 = (n: number) => Math.round(n * 10) / 10;

  // ── Signal 1: LLM fallback rate ──
  const totalCalls24h = llmUsageRecent.length;
  const fallbackCalls24h = llmUsageRecent.filter(u => u.is_fallback).length;
  const fallbackRate = totalCalls24h > 0 ? fallbackCalls24h / totalCalls24h : 0;
  const prevFallbackRate = llmUsagePrev.length > 0
    ? llmUsagePrev.filter(u => u.is_fallback).length / llmUsagePrev.length
    : 0;

  if (fallbackRate > 0.5 && totalCalls24h >= 5) {
    alerts.push({
      severity: "critical",
      code: "llm_groq_down",
      message: `Groq is down or heavily throttled — ${Math.round(fallbackRate * 100)}% of LLM calls in the last 24h routed to Gemini fallback (${fallbackCalls24h}/${totalCalls24h} calls).`,
      action: "Check status.groq.com and Groq dashboard. Gemini fallback is active but costs ~2.3× more per token.",
    });
  } else if (fallbackRate > 0.2 && totalCalls24h >= 5 && fallbackRate > prevFallbackRate * 1.5) {
    alerts.push({
      severity: "warning",
      code: "llm_fallback_elevated",
      message: `Groq fallback rate elevated — ${Math.round(fallbackRate * 100)}% vs ${Math.round(prevFallbackRate * 100)}% last week (${fallbackCalls24h}/${totalCalls24h} calls in 24h).`,
      action: "Monitor Groq latency. If this continues, check rate limits on the Groq console.",
    });
  }

  // ── Signal 2: Session cost coverage ──
  if (todaySessions.length >= 3) {
    const costed = todaySessions.filter(s => s.llm_cost_inr != null && s.llm_cost_inr > 0).length;
    const coverage = costed / todaySessions.length;
    if (coverage < 0.4) {
      alerts.push({
        severity: "critical",
        code: "cost_patch_broken",
        message: `Cost tracking broken — only ${Math.round(coverage * 100)}% of today's ${todaySessions.length} sessions have llm_cost_inr (${costed} have data, ${todaySessions.length - costed} missing).`,
        action: "Check save-session.ts fire-and-forget PATCH. The llm_usage insert or the PATCH itself is failing silently.",
      });
    } else if (coverage < 0.7) {
      alerts.push({
        severity: "warning",
        code: "cost_coverage_low",
        message: `Cost coverage is ${Math.round(coverage * 100)}% today (${costed}/${todaySessions.length} sessions). Missing data will skew averages.`,
        action: "Investigate llm_usage write failures in save-session.ts.",
      });
    }
  }

  // ── Signal 3: Session volume anomaly ──
  // Compare today vs prior 7-day daily average
  const priorDayCounts: Record<string, number> = {};
  for (const s of recentSessions) {
    const d = s.created_at?.slice(0, 10);
    if (d && d !== today) priorDayCounts[d] = (priorDayCounts[d] || 0) + 1;
  }
  const priorDays = Object.values(priorDayCounts);
  if (priorDays.length >= 3) {
    const dailyAvg = priorDays.reduce((a, b) => a + b, 0) / priorDays.length;
    const todayCount = todaySessions.length;
    const hourOfDay = new Date(now).getUTCHours();
    // Pro-rate today based on how far through the day we are (avoid false alerts at midnight)
    const prorated = hourOfDay >= 8 ? (todayCount / (hourOfDay / 24)) : null;

    if (prorated != null && dailyAvg > 5) {
      if (prorated < dailyAvg * 0.2) {
        alerts.push({
          severity: "critical",
          code: "session_volume_crash",
          message: `Session volume is critically low — ${todayCount} sessions so far today (est. ${Math.round(prorated)}/day extrapolated), vs ${round1(dailyAvg)} daily avg. Possible app outage.`,
          action: "Check Vercel function logs, Supabase status, and the interview flow end-to-end.",
        });
      } else if (prorated < dailyAvg * 0.4) {
        alerts.push({
          severity: "warning",
          code: "session_volume_low",
          message: `Session volume is down — ${todayCount} sessions so far today (est. ${Math.round(prorated)}/day), vs ${round1(dailyAvg)} daily avg (7d).`,
          action: "Monitor for the next hour. Could be time-of-day variation or a soft funnel issue.",
        });
      }
    }
  }

  // ── Signal 4: Failed sessions (score=null or score=0) ──
  if (todaySessions.length >= 3) {
    const failed = todaySessions.filter(s => s.score == null || s.score === 0).length;
    const failRate = failed / todaySessions.length;
    if (failRate > 0.4) {
      alerts.push({
        severity: "critical",
        code: "session_failures_high",
        message: `${Math.round(failRate * 100)}% of today's sessions have null/zero score (${failed}/${todaySessions.length}). Likely evaluation pipeline failing.`,
        action: "Check evaluate-session.ts, Groq/Gemini response parsing, and recent error logs.",
      });
    } else if (failRate > 0.2) {
      alerts.push({
        severity: "warning",
        code: "session_failures_elevated",
        message: `${Math.round(failRate * 100)}% of today's sessions scored 0 or null (${failed}/${todaySessions.length}).`,
        action: "Spot-check recent sessions in the Sessions tab. May indicate LLM JSON parse errors.",
      });
    }
  }

  // ── Signal 5: Rate-card staleness ──
  const ageDays = rateCardAgeDays(now);
  if (isRateCardStale(now)) {
    alerts.push({
      severity: ageDays > RATE_STALENESS_THRESHOLD_DAYS * 2 ? "critical" : "warning",
      code: "cost_rate_card_stale",
      message: `LLM/TTS/STT rate card hasn't been reverified in ${ageDays} days (last verified ${RATES_LAST_VERIFIED_AT}). The admin cost dashboard and both Sarvam/Deepgram credit guardrails all read this same rate card.`,
      action: "Check current Groq/Sarvam/Deepgram list prices (or your negotiated invoice rate) against DEFAULT_COST_RATES in _cost-helpers.ts, update the rate + RATES_LAST_VERIFIED_AT together, and log an actual invoice total via the Cost tab's reconciliation form.",
    });
  }

  return {
    alerts,
    checkedAt: new Date(now).toISOString(),
  };
}
