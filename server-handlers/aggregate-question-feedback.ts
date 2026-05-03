/* Vercel Cron — Question-feedback weekly digest
 *
 * Runs weekly (Monday 09:00). Reads the last 7 days of question_feedback
 * rows, mines (a) the worst-performing (company × focus) patterns and
 * (b) "this matched my real interview" candidates that ≥2 users
 * confirmed, then emails the digest to MODERATOR_EMAIL via Resend.
 *
 * Authenticated via Vercel's `x-vercel-cron` header OR a Bearer
 * CRON_SECRET (so we can also trigger manually for testing).
 *
 * The actionable contract is small but real:
 *   - Worst patterns → review the curated bank, refresh stale entries
 *   - Real-match candidates → add the verified questions to the bank
 *   Both close the active-learning loop. Without this, the
 *   question_feedback table just accumulates unread rows.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseUrl } from "./_shared";
import {
  buildReport,
  renderReportHtml,
  type FeedbackRow,
} from "./_aggregate-feedback-helpers";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <onboarding@resend.dev>";
const MODERATOR_EMAIL = process.env.MODERATOR_EMAIL || process.env.ADMIN_EMAIL || "";

const WINDOW_DAYS = 7;
const MAX_ROWS = 5000; // safety cap; weekly volume should fit easily

export default async function handler(req: VercelRequest, res: VercelResponse) {
  /* Auth: Vercel Cron sets x-vercel-cron=1; manual triggers use Bearer
     CRON_SECRET. Either accepted; anything else is rejected. */
  const authHeader = (req.headers.authorization as string) || "";
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const hasValidSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron && !hasValidSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPABASE_URL = supabaseUrl();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Supabase not configured" });
  }
  if (!MODERATOR_EMAIL) {
    /* Not having a moderator email is a config error, not a runtime
       error — log and exit cleanly so the cron doesn't appear failing. */
    console.warn("[aggregate-question-feedback] MODERATOR_EMAIL not set; skipping digest");
    return res.status(200).json({ skipped: true, reason: "no moderator email configured" });
  }

  /* Fetch the rolling window of feedback. Empty company / role / focus
     are coalesced to "" via the table defaults; the aggregator then
     groups them under "(any)" buckets. */
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/question_feedback?created_at=gte.${encodeURIComponent(since)}&select=question_text,thumbs,company,role,focus,created_at&limit=${MAX_ROWS}`;

  let rows: FeedbackRow[] = [];
  try {
    const fetchRes = await fetch(url, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: "application/json",
      },
    });
    if (!fetchRes.ok) {
      const errText = await fetchRes.text().catch(() => "");
      console.error(`[aggregate-question-feedback] supabase fetch failed: HTTP ${fetchRes.status}: ${errText.slice(0, 200)}`);
      return res.status(500).json({ error: "Failed to query question_feedback" });
    }
    rows = (await fetchRes.json()) as FeedbackRow[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[aggregate-question-feedback] threw: ${msg.slice(0, 200)}`);
    return res.status(500).json({ error: msg });
  }

  const report = buildReport(rows, WINDOW_DAYS);

  /* Quiet weeks — no findings worth a digest, no email send.
     Vercel logs still show the run completed cleanly. */
  if (!report.hasFindings) {
    return res.status(200).json({
      sent: false, reason: "no findings", totalRowsAnalysed: report.totalRowsAnalysed,
    });
  }

  /* No Resend key configured — render the report and return it in the
     response body so manual triggers can still verify the output. */
  if (!RESEND_API_KEY) {
    console.warn("[aggregate-question-feedback] RESEND_API_KEY not set; returning report inline");
    return res.status(200).json({ sent: false, reason: "no resend key", report });
  }

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: MODERATOR_EMAIL,
      subject: `HireStepX question-feedback digest — ${report.worstPatterns.length} alerts, ${report.realMatchCandidates.length} candidates`,
      html: renderReportHtml(report),
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text().catch(() => "");
    console.error(`[aggregate-question-feedback] resend failed: HTTP ${emailRes.status}: ${errText.slice(0, 200)}`);
    return res.status(500).json({ error: "Email send failed", report });
  }

  return res.status(200).json({
    sent: true,
    totalRowsAnalysed: report.totalRowsAnalysed,
    worstPatterns: report.worstPatterns.length,
    realMatchCandidates: report.realMatchCandidates.length,
  });
}
