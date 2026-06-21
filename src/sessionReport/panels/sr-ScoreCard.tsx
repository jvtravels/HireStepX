"use client";
/**
 * ScoreCard — generates a 1200×630 PNG score card for social sharing.
 * Uses the Canvas API (client-only). The card shows:
 * - HireStepX wordmark (top-left)
 * - Role + Company (top-right, truncated)
 * - Large score number (centre)
 * - Score label (e.g. "Strong Performer")
 * - Top strength and top gap (two lines below)
 * - "Practice at hirestepx.com" footer
 *
 * Props: { score, role, company, topStrength, topGap, verdict, onDownload }
 *
 * No external canvas libraries — native browser Canvas API only.
 */

import { t } from "../tokens";

/* ── Token values used for canvas drawing ─────────────────────────── */
/* Canvas drawText uses raw hex strings — these come from the design
   token file so the card stays in sync with the report palette. */
const C = {
  cream:     t.cream,
  coal:      t.coal,
  indigo:    t.indigo,
  copper:    t.copper,
  inkSoft:   t.inkSoft,
  line:      t.line,
  success:   t.success,
} as const;

const W = 1200;
const H = 630;
const ACCENT_BAR_H = 8;
const PADDING = 72;

/* Truncate a string to `max` chars with an ellipsis. */
function trunc(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/* Score → human-readable label. Mirrors the verdict labels used in
   sr-HeroSection so the card reads consistently with the full report. */
function scoreLabel(score: number): string {
  if (score >= 85) return "Strong Performer";
  if (score >= 72) return "Lean Hire";
  if (score >= 58) return "On Track";
  if (score >= 40) return "Needs Work";
  return "Early Stage";
}

/* Score → accent colour for the label. */
function labelColor(score: number): string {
  if (score >= 72) return C.success;
  if (score >= 58) return C.copper;
  return t.error;
}

export interface ScoreCardProps {
  score: number;
  role: string;
  company: string;
  topStrength: string;
  topGap: string;
  verdict?: string;
}

/**
 * downloadScoreCard — generates the PNG and triggers a browser download.
 * Guard-gated on `typeof window !== 'undefined'` so it's safe to call
 * in SSR contexts (it simply noops if the Canvas API is absent).
 */
export async function downloadScoreCard(props: ScoreCardProps): Promise<void> {
  if (typeof window === "undefined") return;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  /* ── Background ──────────────────────────────────────────────────── */
  ctx.fillStyle = C.cream;
  ctx.fillRect(0, 0, W, H);

  /* ── Copper accent bar (top edge) ───────────────────────────────── */
  ctx.fillStyle = C.copper;
  ctx.fillRect(0, 0, W, ACCENT_BAR_H);

  /* ── Subtle line at bottom ───────────────────────────────────────── */
  ctx.fillStyle = C.line;
  ctx.fillRect(0, H - 4, W, 4);

  /* ── Indigo left accent bar (decorative) ────────────────────────── */
  ctx.fillStyle = C.indigo;
  ctx.fillRect(0, ACCENT_BAR_H, 6, H - ACCENT_BAR_H - 4);

  /* ── HireStepX wordmark (top-left) ─────────────────────────────── */
  ctx.fillStyle = C.indigo;
  ctx.font = `700 28px 'Satoshi', system-ui, -apple-system, sans-serif`;
  ctx.fillText("HireStepX", PADDING, ACCENT_BAR_H + 54);

  /* ── Role + Company (top-right) ─────────────────────────────────── */
  ctx.textAlign = "right";
  const roleText = trunc(props.role, 40);
  const compText = trunc(props.company, 40);
  ctx.fillStyle = C.coal;
  ctx.font = `600 22px 'Satoshi', system-ui, -apple-system, sans-serif`;
  ctx.fillText(roleText, W - PADDING, ACCENT_BAR_H + 48);
  ctx.fillStyle = C.inkSoft;
  ctx.font = `400 18px 'Satoshi', system-ui, -apple-system, sans-serif`;
  ctx.fillText(compText, W - PADDING, ACCENT_BAR_H + 76);
  ctx.textAlign = "left";

  /* ── Divider ────────────────────────────────────────────────────── */
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, ACCENT_BAR_H + 100);
  ctx.lineTo(W - PADDING, ACCENT_BAR_H + 100);
  ctx.stroke();

  /* ── Large score (centre) ───────────────────────────────────────── */
  ctx.textAlign = "center";
  ctx.fillStyle = C.indigo;
  ctx.font = `700 160px 'Satoshi', system-ui, -apple-system, sans-serif`;
  ctx.fillText(String(props.score), W / 2, 370);

  /* ── "/100" sub-label ────────────────────────────────────────────── */
  ctx.fillStyle = C.inkSoft;
  ctx.font = `400 28px 'Satoshi', system-ui, -apple-system, sans-serif`;
  ctx.fillText("/ 100", W / 2, 410);

  /* ── Score label ─────────────────────────────────────────────────── */
  const label = props.verdict || scoreLabel(props.score);
  ctx.fillStyle = labelColor(props.score);
  ctx.font = `700 26px 'Satoshi', system-ui, -apple-system, sans-serif`;
  ctx.fillText(label.toUpperCase(), W / 2, 460);

  /* ── Divider ────────────────────────────────────────────────────── */
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, 490);
  ctx.lineTo(W - PADDING, 490);
  ctx.stroke();

  /* ── Top strength + top gap (two rows) ──────────────────────────── */
  const maxLineLen = 70;
  if (props.topStrength) {
    ctx.textAlign = "left";
    ctx.fillStyle = C.success;
    ctx.font = `700 16px 'Satoshi', system-ui, -apple-system, sans-serif`;
    ctx.fillText("✓", PADDING, 526);
    ctx.fillStyle = C.coal;
    ctx.font = `400 16px 'Satoshi', system-ui, -apple-system, sans-serif`;
    ctx.fillText(trunc(props.topStrength, maxLineLen), PADDING + 26, 526);
  }
  if (props.topGap) {
    ctx.fillStyle = C.copper;
    ctx.font = `700 16px 'Satoshi', system-ui, -apple-system, sans-serif`;
    ctx.fillText("↑", PADDING, 556);
    ctx.fillStyle = C.coal;
    ctx.font = `400 16px 'Satoshi', system-ui, -apple-system, sans-serif`;
    ctx.fillText(trunc(props.topGap, maxLineLen), PADDING + 26, 556);
  }

  /* ── Footer ─────────────────────────────────────────────────────── */
  ctx.textAlign = "center";
  ctx.fillStyle = C.inkSoft;
  ctx.font = `400 15px 'Satoshi', system-ui, -apple-system, sans-serif`;
  ctx.fillText("Practice at hirestepx.com", W / 2, H - 22);

  /* ── Export as PNG ───────────────────────────────────────────────── */
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error("Canvas toBlob returned null")); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hirestepx-score.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

/**
 * ScoreCardDownloadButton — a button that calls downloadScoreCard on click.
 * Matches the visual style of the ghost buttons used in sr-Header.tsx.
 */
export function ScoreCardDownloadButton(props: ScoreCardProps & { className?: string }) {
  const handleClick = async () => {
    await downloadScoreCard(props);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Download score card as image"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "10px 18px",
        borderRadius: 10,
        border: `1px solid ${t.line}`,
        background: "transparent",
        color: t.coal,
        fontFamily: "'Satoshi', system-ui, -apple-system, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      {/* Download icon */}
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download Score Card
    </button>
  );
}
