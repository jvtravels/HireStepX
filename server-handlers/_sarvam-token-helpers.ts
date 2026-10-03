// Confirmed in production (2026-10-04): SARVAM_ALLOW_CLIENT_KEY was stored as
// the 6-character string `true\n` (a literal trailing backslash-n, not real
// whitespace — likely pasted from somewhere that escaped it) rather than
// `true`. A plain `.trim() === "true"` check doesn't strip that, so the flag
// silently evaluated false in prod — Sarvam STT returned 503 on every single
// token request regardless of subscription tier, with no error that pointed
// at the env var. Strip a literal trailing `\n`/`\r\n` escape in addition to
// real whitespace so this class of copy-paste corruption can't do that again.
export function parseBoolEnv(raw: string | undefined): boolean {
  return (raw || "").trim().replace(/(\\r)?\\n$/, "").trim().toLowerCase() === "true";
}
