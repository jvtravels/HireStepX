export type CtaReasonInput = {
  starting: boolean;
  formComplete: boolean;
  hasRole: boolean;
  companyMissing: boolean;
  roleCompanyMismatch: boolean;
  isOnline: boolean;
  micStatus: string;
  needsMic: boolean;
};

export function getCtaReason(i: CtaReasonInput): string | null {
  if (i.starting) return null;
  if (!i.formComplete) {
    if (!i.hasRole) return "Add your target role to continue.";
    if (i.companyMissing) return "Add the company to continue.";
    if (i.roleCompanyMismatch) return "Pick a role and company that go together.";
    return "Pick an interview focus to continue.";
  }
  if (!i.isOnline) return "You're offline. Reconnect to start.";
  if (i.micStatus === "requesting") return "Waiting for microphone permission. Check your browser's prompt.";
  if (i.needsMic) {
    return i.micStatus === "denied"
      ? "Microphone is blocked. Allow it in your browser's site settings, then try again."
      : "We need microphone access to run a voice interview.";
  }
  return null;
}
