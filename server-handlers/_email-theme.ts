/* Shared light-theme email layout for HireStepX transactional email.

   Encodes the HireStepX 2.0 design system (src/auth/_tokens.ts) as
   Outlook-safe, inline-styled table HTML: a white sheet on a near-white
   page, the wordmark image, sans-only type, one filled indigo button, and
   a `hero` block on the site's peach-pink-lavender gradient.

   Pure string builders only — no Node APIs — so this module is safe in
   both the edge runtime (weekly-summary.ts) and the nodejs serverless
   handlers. Every caller-supplied string that is not already trusted
   HTML must be passed through escapeHtml() by the caller. */

/* ─── Palette (hex mirror of src/auth/_tokens.ts) ─── */
export const C = {
  cream: "#FAFAFA",
  white: "#FFFFFF",
  creamSoft: "#F4F4F5",
  coal: "#090B0C",
  indigoGray: "#3E3A6E",
  inkSoft: "#5C6C70",
  inkFaint: "#4B585B",
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  copper: "#B24500",
  copper100: "#FBE7D8",
  success: "#15803D",
  success100: "#DCFCE7",
  error: "#B91C1C",
  error100: "#FEE2E2",
  warning: "#A16207",
  warning100: "#FEF3C7",
  line: "#EAECF0",
  lineStrong: "#D6CDB5",
} as const;

/* sRGB approximations of the site's stage gradient
   (oklch 0.945/0.04/55, 0.95/0.035/320, 0.935/0.045/285). The solid
   colour is the Outlook fallback, which ignores background-image. */
const STAGE_FALLBACK = "#F3EEF8";
const STAGE_GRADIENT = "linear-gradient(135deg,#FBE9DC 0%,#F9E6F3 50%,#E9E4F8 100%)";

const SANS =
  "'Geist Sans', Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** HTML-escape untrusted text destined for an email body. Mirrors the
    per-handler escapeHtml() so this module has no external dependency. */
export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escaped first name for greetings; "there" when the name is blank. */
export function firstNameOf(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return escapeHtml(first || "there");
}

/** ", Arjun" for headlines that end in a name; empty when none is known. */
export function nameSuffix(name: string | null | undefined): string {
  const first = firstNameOf(name);
  return first === "there" ? "" : `, ${first}`;
}

/* Outlook ignores margin on tables, so inter-block spacing is td padding. */
const GAP = 24;
function block(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:0 0 ${GAP}px;">${inner}</td></tr></table>`;
}

/* ─── Tone → background for data cards ─── */
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
      return C.white;
  }
}

/** Sans headline. `accentWord`, when given, is appended in copper (no
    italics). Pass already-escaped text. Prefer hero() for the top block. */
export function title(
  text: string,
  opts: { accentWord?: string; size?: number } = {},
): string {
  const size = opts.size ?? 28;
  const accent = opts.accentWord
    ? ` <span style="color:${C.copper};">${opts.accentWord}</span>`
    : "";
  return `<h1 style="margin:0 0 16px;font-family:${SANS};font-size:${size}px;font-weight:600;line-height:1.2;letter-spacing:-0.03em;color:${C.coal};">${text}${accent}</h1>`;
}

/** Body paragraph. `muted` softens to inkSoft; `small` is 13px fine print. */
export function para(
  html: string,
  opts: { muted?: boolean; small?: boolean } = {},
): string {
  const color = opts.small || opts.muted ? C.inkSoft : C.indigoGray;
  const size = opts.small ? 13 : 15;
  return `<p style="margin:0 0 ${GAP}px;font-family:${SANS};font-size:${size}px;line-height:1.6;color:${color};">${html}</p>`;
}

/** Bold inline fact. */
export function b(text: string): string {
  return `<strong style="color:${C.coal};font-weight:600;">${text}</strong>`;
}

/** Inline indigo link. */
export function link(label: string, href: string): string {
  return `<a href="${href}" style="color:${C.indigo};text-decoration:underline;">${label}</a>`;
}

type ButtonTone = "indigo" | "ghost";
function buttonTable(label: string, href: string, tone: ButtonTone | undefined): string {
  const ghost = tone === "ghost";
  const bg = ghost ? C.white : C.indigo;
  const fg = ghost ? C.coal : C.white;
  const edge = ghost ? C.lineStrong : C.indigo;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${bg}" style="border-radius:10px;background:${bg};border:1px solid ${edge};">
    <a href="${href}" style="display:inline-block;padding:12px 22px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1.2;color:${fg};text-decoration:none;border-radius:10px;">${label}</a>
  </td></tr></table>`;
}

/** Single CTA button. tone "indigo" (default, filled) or "ghost" (outlined). */
export function button(
  label: string,
  href: string,
  opts: { tone?: ButtonTone } = {},
): string {
  return block(buttonTable(label, href, opts.tone));
}

/** Primary + secondary buttons side by side with a 12px gutter. Labels are
    already-escaped HTML; the first is filled unless `ghost` is set. */
export function actions(
  buttons: { label: string; href: string; ghost?: boolean }[],
): string {
  const cells = buttons
    .map(
      (btn, i) =>
        `<td style="padding:0 ${i < buttons.length - 1 ? 12 : 0}px 0 0;">${buttonTable(btn.label, btn.href, btn.ghost ? "ghost" : "indigo")}</td>`,
    )
    .join("");
  return block(
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`,
  );
}

/** Fine print is plain muted text; only a real warning (tone "warn") gets a
    box. Pass already-escaped HTML. */
export function note(html: string, opts: { tone?: "neutral" | "warn" } = {}): string {
  if (opts.tone === "warn") {
    return block(
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.warning100}" style="background:${C.warning100};border-radius:10px;padding:12px 16px;font-family:${SANS};font-size:14px;line-height:1.55;color:${C.coal};">${html}</td></tr></table>`,
    );
  }
  return para(html, { small: true });
}

/** Bordered key/value table. A non-empty `label` renders as a small header
    row. Pass already-escaped values. */
export function dataCard(
  label: string,
  rows: [string, string][],
  opts: { tone?: Tone } = {},
): string {
  const bg = toneBg(opts.tone ?? "cream");
  const header = label
    ? `<tr><td colspan="2" style="padding:12px 16px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${C.inkSoft};">${label}</td></tr>`
    : "";
  const body = rows
    .map(([k, v], i) => {
      const edge = i || label ? `border-top:1px solid ${C.line};` : "";
      return `<tr>
          <td style="padding:12px 16px;${edge}font-family:${SANS};font-size:14px;line-height:1.4;color:${C.inkSoft};">${k}</td>
          <td align="right" style="padding:12px 16px;${edge}font-family:${SANS};font-size:14px;line-height:1.4;color:${C.coal};font-weight:600;text-align:right;">${v}</td>
        </tr>`;
    })
    .join("");
  return block(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${bg};border:1px solid ${C.line};border-radius:10px;border-collapse:separate;">${header}${body}</table>`,
  );
}

/** Label/value rows with no header. */
export function data(rows: [string, string][]): string {
  return dataCard("", rows);
}

/** Top-of-email block: a 16px-radius frame on the site gradient (light red
    for errors) holding a white card with status dot + eyebrow, headline and
    lede. All arguments are already-escaped HTML. */
export function hero(opts: {
  eyebrow?: string;
  title: string;
  lede?: string;
  tone?: "default" | "success" | "error";
}): string {
  const tone = opts.tone ?? "default";
  const dot = tone === "error" ? C.error : tone === "success" ? C.success : C.indigo;
  const frameBg = tone === "error" ? C.error100 : STAGE_FALLBACK;
  const frameImg = tone === "error" ? "" : `background-image:${STAGE_GRADIENT};`;
  const eyebrow = opts.eyebrow
    ? `<div style="font-family:${SANS};font-size:13px;font-weight:500;line-height:1.4;color:${C.coal};padding-bottom:12px;"><span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:${dot};margin-right:8px;vertical-align:middle;"></span>${opts.eyebrow}</div>`
    : "";
  const lede = opts.lede
    ? `<p style="margin:16px 0 0;font-family:${SANS};font-size:16px;line-height:1.6;color:${C.indigoGray};">${opts.lede}</p>`
    : "";
  return block(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-radius:16px;"><tr><td bgcolor="${frameBg}" style="padding:16px;border-radius:16px;background-color:${frameBg};${frameImg}">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.white}" style="padding:24px;border-radius:12px;background:${C.white};">
        ${eyebrow}<h1 style="margin:0;font-family:${SANS};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:-0.03em;color:${C.coal};">${opts.title}</h1>${lede}
      </td></tr></table>
    </td></tr></table>`,
  );
}

/** Tabular-figure span for receipt amounts / IDs. */
export function mono(text: string): string {
  return `<span style="font-variant-numeric:tabular-nums;">${text}</span>`;
}

/** Grave eyebrow strip — for permanent/irreversible notices. */
export function graveEyebrow(text: string): string {
  return `<div style="font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${C.inkSoft};padding-bottom:16px;margin-bottom:24px;border-bottom:2px solid ${C.coal};">${text}</div>`;
}

/** Founder-voice signature block. `note` is an optional line above. */
export function signoff(opts: {
  name?: string;
  role?: string;
  note?: string;
} = {}): string {
  const name = opts.name ?? "Jay";
  const role = opts.role ?? "Founder, HireStepX";
  const note = opts.note
    ? `<p style="margin:24px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.indigoGray};">${opts.note}</p>`
    : "";
  return `${note}<p style="margin:24px 0 0;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.indigoGray};">Yours,<br><strong style="font-weight:600;color:${C.coal};">${name}</strong><br><span style="font-size:13px;color:${C.inkSoft};">${role}</span></p>`;
}

/** Numbered list (welcome-style). Pass already-escaped item HTML. */
export function orderedList(items: string[]): string {
  const lis = items
    .map(
      (it) =>
        `<li style="margin-bottom:8px;font-family:${SANS};font-size:15px;line-height:1.6;color:${C.indigoGray};">${it}</li>`,
    )
    .join("");
  return `<ol style="margin:0 0 ${GAP}px;padding-left:20px;">${lis}</ol>`;
}

/** Footer options. `marketing: true` marks a promotional/notification email
    that must carry a working unsubscribe link (CAN-SPAM, Gmail/Yahoo bulk
    rules); without it the footer is the transactional one and never offers
    an unsubscribe, because account/payment/security mail can't be opted out of. */
export interface EmailFooterOptions {
  marketing?: boolean;
  manageUrl?: string;
  /** Per-recipient signed one-click link (see _unsubscribe.ts). When a
      marketing email has none (no signing secret configured) the footer
      degrades to the login-gated settings page rather than a dead link. */
  unsubUrl?: string;
}

function postalAddress(): string {
  return (process.env.LEGAL_POSTAL_ADDRESS || process.env.NEXT_PUBLIC_LEGAL_POSTAL_ADDRESS || "").trim();
}

/** Standard footer. Every email names the sender; the postal address renders
    only when LEGAL_POSTAL_ADDRESS is configured (never invented). */
function footer(opts: EmailFooterOptions = {}): string {
  const manageUrl = opts.manageUrl ?? "https://hirestepx.com/settings";
  const footLink = (label: string, href: string) =>
    `<a href="${href}" style="color:${C.inkSoft};text-decoration:underline;">${label}</a>`;
  const links = opts.marketing
    ? `${footLink("Manage notifications", manageUrl)} &middot; ${footLink("Unsubscribe", opts.unsubUrl ?? manageUrl)}`
    : footLink("Manage notifications", manageUrl);
  const reason = opts.marketing
    ? "You're receiving this because you have an account at hirestepx.com."
    : "You're receiving this because you have an account at hirestepx.com. This is a service email about your account or activity.";
  const address = postalAddress();
  const sender = `HireStepX &middot; hello@hirestepx.com${address ? `<br>${escapeHtml(address)}` : ""}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
    <tr><td style="padding-top:20px;border-top:1px solid ${C.line};font-family:${SANS};font-size:12px;line-height:1.7;color:${C.inkFaint};">
      ${reason} ${links}<br>
      ${sender}
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
  /** Overrides for the compliance footer. The shell is the footer's only
      owner (the builder is module-private), so a body can never render a
      second copy. */
  footer?: EmailFooterOptions;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  body { margin:0; padding:0; background:${C.cream}; }
  a { color:${C.indigo}; }
  @media (max-width:480px) {
    .hsx-page { padding:16px 12px !important; }
    .hsx-sheet { padding:28px 20px 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
${preheader(escapeHtml(opts.preview))}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}" class="hsx-page" style="background:${C.cream};padding:24px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.white}" style="max-width:600px;width:100%;background:${C.white};border:1px solid ${C.line};border-radius:12px;">
      <tr><td class="hsx-sheet" style="padding:40px 40px 32px;">
        <img src="https://hirestepx.com/wordmark.png" alt="HireStepX" height="22" style="display:block;height:22px;width:auto;border:0;outline:none;margin:0 0 32px;" />
        ${opts.body}
        ${footer(opts.footer)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
