declare const process: { env: Record<string, string | undefined> };

/** Email (Resend) and Slack ops alert; each channel is optional and failures are swallowed. */
export async function sendOpsAlert(subject: string, text: string): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    tasks.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "HireStepX Alerts <alerts@hirestepx.com>", to: [process.env.ALERT_EMAIL || "support@hirestepx.com"], subject, text }),
      signal: AbortSignal.timeout(3000),
    }));
  }
  const slack = process.env.SLACK_ALERT_WEBHOOK_URL;
  if (slack) {
    tasks.push(fetch(slack, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `*${subject}*\n${text}` }), signal: AbortSignal.timeout(3000) }));
  }
  await Promise.allSettled(tasks);
}
