/* Admin: generate a fix plan from current open issues.
 *
 * NOT auto-applied — the LLM returns recommendations the admin reviews
 * and implements as code changes. This is the closed-loop step that
 * replaces "manually paste sessions to Claude and ask what to fix."
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminToken as verifyToken } from "./_admin-auth";
import { callLLM, extractJSON } from "./_llm";
import { buildFixPlanPrompt, parseFixPlan, type FixPlanInput } from "./_fix-plan-helpers";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface InsightRow {
  session_id: string;
  focus: string;
  flags: string[] | null;
  hallucinations: { type?: string; evidence?: string }[] | null;
  resolution_status: string;
  severity: string;
}

async function supa<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? (j as T[]) : [];
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "x-admin-token, content-type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { res.status(503).json({ error: "Server misconfigured" }); return; }
  const token = req.headers["x-admin-token"];
  if (typeof token !== "string" || !verifyToken(token)) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = (req.body || {}) as { focus?: string };
  const focusFilter = typeof body.focus === "string" && body.focus.length > 0 ? body.focus : null;

  // Pull open insights with flags. Cap at 200 — enough context for a plan.
  const focusClause = focusFilter ? `&focus=eq.${encodeURIComponent(focusFilter)}` : "";
  const insights = await supa<InsightRow>(
    `session_insights?resolution_status=eq.open${focusClause}&order=analyzed_at.desc&limit=200&select=session_id,focus,flags,hallucinations,resolution_status,severity`,
  );

  // Aggregate flags with example evidence pulled from hallucinations
  const flagAgg = new Map<string, { flag: string; count: number; severity_high: number; example_evidence: string[] }>();
  for (const r of insights) {
    for (const f of r.flags || []) {
      const a = flagAgg.get(f) || { flag: f, count: 0, severity_high: 0, example_evidence: [] };
      a.count += 1;
      if (r.severity === "high") a.severity_high += 1;
      if (a.example_evidence.length < 3 && Array.isArray(r.hallucinations)) {
        for (const h of r.hallucinations) {
          if (h.evidence) a.example_evidence.push(h.evidence);
          if (a.example_evidence.length >= 3) break;
        }
      }
      flagAgg.set(f, a);
    }
  }

  const flaggedSessions = insights
    .filter((r) => (r.flags || []).length > 0)
    .slice(0, 12)
    .map((r) => ({
      session_id: r.session_id,
      focus: r.focus,
      flags: r.flags || [],
      hallucinations_summary: (r.hallucinations || []).map((h) => `${h.type || ""}: ${(h.evidence || "").slice(0, 120)}`).slice(0, 3),
    }));

  const input: FixPlanInput = {
    focus: focusFilter || undefined,
    openIssues: Array.from(flagAgg.values()).sort((a, b) => b.count - a.count).slice(0, 12),
    flaggedSessions,
    registeredFocuses: ["behavioral", "salary-negotiation", "technical", "system-design", "hr-round"],
  };

  if (input.openIssues.length === 0) {
    res.status(200).json({
      ok: true,
      plan: { summary: "No open issues to plan against. Either everything's resolved or no sessions have been analyzed yet.", items: [], cautions: [] },
      input_summary: { issue_count: 0, session_count: 0 },
    });
    return;
  }

  const prompt = buildFixPlanPrompt(input);

  try {
    const llmRes = await callLLM({ prompt, temperature: 0.2, maxTokens: 1200, jsonMode: true }, 25000, {
      endpoint: "admin-fix-plan",
    });
    const parsed = parseFixPlan(llmRes.text);
    // Defensive: if the parser got nothing useful, still return so the UI can show something.
    if (!parsed.summary && parsed.items.length === 0) {
      // Try one more parse via extractJSON which handles ```json blocks etc.
      const fallback = extractJSON<typeof parsed>(llmRes.text);
      if (fallback) {
        Object.assign(parsed, fallback);
      }
    }
    res.status(200).json({
      ok: true,
      plan: parsed,
      model: llmRes.model,
      input_summary: { issue_count: input.openIssues.length, session_count: input.flaggedSessions.length, focus: focusFilter },
    });
  } catch (e) {
    res.status(502).json({ error: "LLM call failed", details: String((e as Error).message || e).slice(0, 300) });
  }
}
