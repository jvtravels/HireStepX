/* Account-erasure confirmation email. Sent only AFTER erasure fully succeeded, by both
 * the immediate path and the scheduled cron. Wording must stay true: backups are not
 * edited, they are overwritten on their normal cycle, and payment records are kept
 * (anonymised) because tax law requires it. */

import { emailShell, title, para, link, dataCard, graveEyebrow } from "./_email-theme";
import { escapeHtml } from "./_shared";

export interface ErasureEmailEnv {
  resendApiKey: string;
  fromEmail: string;
  appUrl: string;
}

export function buildErasureEmail(name: string, appUrl: string): { subject: string; html: string } {
  const safeName = escapeHtml(name || "there");
  return {
    subject: "Your account has been deleted",
    html: emailShell({
      preview: "Your account and personal data have been deleted. Here's exactly what that covers.",
      body:
        graveEyebrow("Permanent &middot; Irreversible") +
        title("Deleted, as requested.") +
        para(`Hi ${safeName}, your HireStepX account and the personal data attached to it have been permanently deleted. This can't be undone.`) +
        dataCard("Removed", [
          ["Profile & login", "Deleted"],
          ["Sessions, transcripts & evaluations", "Deleted"],
          ["Resumes & uploaded files", "Deleted"],
          ["Messages & attachments", "Deleted"],
        ]) +
        dataCard("Kept, as the law requires", [
          ["Payment & invoice records", "Anonymised, no longer linked to you"],
        ]) +
        para(`Payment records are retained in anonymised form because tax law requires us to keep them. Copies of your data in our database backups are overwritten within 30 days.`, { muted: true }) +
        para(`Thank you for giving HireStepX a try. If you ever want to come back, you can start fresh anytime at ${link(appUrl.replace(/^https?:\/\//, ""), appUrl)}.`, { muted: true }) +
        para(`Didn't expect this? Contact us at ${link("support@hirestepx.com", "mailto:support@hirestepx.com")} immediately so we can investigate.`, { small: true, muted: true }),
    }),
  };
}

/** Best effort: never throws. */
export async function sendErasureEmail(
  fetchImpl: typeof fetch,
  env: ErasureEmailEnv,
  contact: { email: string; name: string },
): Promise<void> {
  if (!env.resendApiKey || !contact.email) return;
  try {
    const { subject, html } = buildErasureEmail(contact.name, env.appUrl);
    await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.fromEmail, to: [contact.email], subject, html }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.warn("[erase-user] confirmation email failed (non-critical):", e instanceof Error ? e.message : "error");
  }
}
