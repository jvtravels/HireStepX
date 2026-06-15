/* Shared light-theme email layout for HireStepX transactional email.

   Encodes the editorial brand design system (see the canvas at
   tempo/designs/canvases/design-system/_tokens.ts) as Outlook-safe,
   inline-styled table HTML: Instrument Serif headlines (Georgia
   fallback for clients without web fonts), a system sans body, cream
   surfaces, a single indigo CTA, and one copper accent per email.

   Pure string builders only — no Node APIs — so this module is safe in
   both the edge runtime (weekly-summary.ts) and the nodejs serverless
   handlers. Every caller-supplied string that is not already trusted
   HTML must be passed through escapeHtml() by the caller. */

/* ─── Palette (hex mirror of design-system/_tokens) ─── */
export const C = {
  cream: "#FAF7F0",
  white: "#FFFFFF",
  creamSoft: "#F4EFE3",
  coal: "#0E0C08",
  indigoGray: "#3E3A6E",
  inkSoft: "#6E6759",
  inkFaint: "#A39C8B",
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  copper: "#B45309",
  copper100: "#F4E5D8",
  success: "#15803D",
  success100: "#DCFCE7",
  error: "#B91C1C",
  error100: "#FEE2E2",
  warning: "#A16207",
  warning100: "#FEF3C7",
  line: "#EBE5D2",
  lineStrong: "#D6CDB5",
} as const;

const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";

/** HTML-escape untrusted text destined for an email body. Mirrors the
    per-handler escapeHtml() so this module has no external dependency. */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ─── Tone → background/foreground for data cards ─── */
type Tone = "cream" | "success" | "warning" | "error" | "indigo";
function toneBg(tone: Tone): string {
  switch (tone) {
    case "success":
      return C.success100;
    case "warning":
      return C.warning100;
    case "error":
      return C.error100;
    case "indigo":
      return C.indigo100;
    default:
      return C.creamSoft;
  }
}

/** Serif headline. `accentWord`, when given, is rendered as the single
    copper italic flourish allowed per email. Pass already-escaped text. */
export function title(
  text: string,
  opts: { accentWord?: string; size?: number } = {},
): string {
  const size = opts.size ?? 28;
  const accent = opts.accentWord
    ? ` <em style="font-style:italic;color:${C.copper};">${opts.accentWord}</em>`
    : "";
  return `<h1 style="margin:0 0 18px;font-family:${SERIF};font-size:${size}px;font-weight:400;line-height:1.18;letter-spacing:-0.01em;color:${C.coal};">${text}${accent}</h1>`;
}

/** Body paragraph. `muted` softens to indigo-gray; `small` drops to 13px. */
export function para(
  html: string,
  opts: { muted?: boolean; small?: boolean } = {},
): string {
  const color = opts.muted ? C.indigoGray : C.coal;
  const size = opts.small ? 13 : 15;
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:${size}px;line-height:1.7;color:${color};">${html}</p>`;
}

/** Bold inline fact. */
export function b(text: string): string {
  return `<strong style="color:${C.coal};font-weight:600;">${text}</strong>`;
}

/** Inline indigo link. */
export function link(label: string, href: string): string {
  return `<a href="${href}" style="color:${C.indigo};text-decoration:none;border-bottom:1px solid ${C.indigo};">${label}</a>`;
}

/** Single CTA button. tone "indigo" (default, filled) or "ghost" (outlined). */
export function button(
  label: string,
  href: string,
  opts: { tone?: "indigo" | "ghost" } = {},
): string {
  const ghost = opts.tone === "ghost";
  const bg = ghost ? C.white : C.indigo;
  const fg = ghost ? C.coal : C.white;
  const border = ghost ? `border:1px solid ${C.lineStrong};` : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 4px;"><tr><td style="border-radius:10px;background:${bg};${border}">
    <a href="${href}" style="display:inline-block;padding:13px 26px;font-family:${SANS};font-size:14px;font-weight:600;color:${fg};text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr></table>`;
}

/** Key/value receipt card on a tinted surface. Pass already-escaped values. */
export function dataCard(
  label: string,
  rows: [string, string][],
  opts: { tone?: Tone } = {},
): string {
  const bg = toneBg(opts.tone ?? "cream");
  const body = rows
    .map(
      ([k, v]) =>
        `<tr>
          <td style="padding:6px 0;font-family:${SANS};font-size:13px;color:${C.indigoGray};">${k}</td>
          <td style="padding:6px 0;font-family:${SANS};font-size:13px;color:${C.coal};font-weight:500;text-align:right;">${v}</td>
        </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;background:${bg};border-radius:10px;">
    <tr><td style="padding:18px 22px 6px;">
      <div style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:${C.inkSoft};margin-bottom:6px;">${label}</div>
    </td></tr>
    <tr><td style="padding:0 22px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
    </td></tr>
  </table>`;
}

/** Mono monospace span — receipt amounts / IDs. */
export function mono(text: string): string {
  return `<span style="font-family:${MONO};">${text}</span>`;
}

/** Grave coal eyebrow strip — for permanent/irreversible notices. */
export function graveEyebrow(text: string): string {
  return `<div style="font-family:${MONO};font-size:10px;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:${C.inkSoft};padding-bottom:16px;margin-bottom:24px;border-bottom:2px solid ${C.coal};">${text}</div>`;
}

/** Founder-voice signature block. `note` is an optional italic line above. */
export function signoff(opts: {
  name?: string;
  role?: string;
  note?: string;
} = {}): string {
  const name = opts.name ?? "Jay";
  const role = opts.role ?? "Founder, HireStepX";
  const note = opts.note
    ? `<p style="margin:30px 0 0;font-family:${SANS};font-size:14px;font-style:italic;line-height:1.6;color:${C.indigoGray};">${opts.note}</p>`
    : "";
  return `${note}<p style="margin:22px 0 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.indigoGray};">Yours,<br><strong style="font-weight:600;color:${C.coal};">${name}</strong><br><span style="font-size:13px;color:${C.inkSoft};">${role}</span></p>`;
}

/** Numbered list (welcome-style). Pass already-escaped item HTML. */
export function orderedList(items: string[]): string {
  const lis = items
    .map(
      (it) =>
        `<li style="margin-bottom:10px;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.indigoGray};">${it}</li>`,
    )
    .join("");
  return `<ol style="margin:0 0 26px;padding-left:20px;">${lis}</ol>`;
}

/** Standard footer — compliance + unsubscribe. `manageUrl` defaults to the
    settings page; pass an absolute URL. */
export function footer(opts: { manageUrl?: string; unsubUrl?: string } = {}): string {
  const manage = opts.manageUrl
    ? link("Manage notifications", opts.manageUrl)
    : "Manage notifications";
  const unsub = opts.unsubUrl ? link("Unsubscribe", opts.unsubUrl) : "Unsubscribe";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:44px;border-top:1px solid ${C.line};">
    <tr><td style="padding-top:22px;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.inkSoft};">
      You're receiving this because you have an account at hirestepx.com.<br>
      ${manage} &middot; ${unsub}
      <div style="margin-top:12px;font-size:11px;color:${C.inkFaint};">HireStepX</div>
    </td></tr>
  </table>`;
}

/** Hidden preheader text (inbox preview line). */
function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0;">${text}</div>`;
}

/** Full email document. `body` is trusted HTML assembled from the builders
    above. `preview` is the inbox preview line (escaped here). */
export function emailShell(opts: {
  preview: string;
  body: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
  body { margin:0; padding:0; background:${C.cream}; }
  a { color:${C.indigo}; }
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
${preheader(escapeHtml(opts.preview))}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream};padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${C.white};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
      <tr><td style="padding:40px 44px;">
        <div style="font-family:${SERIF};font-size:18px;font-weight:500;color:${C.coal};letter-spacing:-0.01em;padding-bottom:22px;margin-bottom:28px;border-bottom:1px solid ${C.line};">HireStepX</div>
        ${opts.body}
        ${footer()}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
