/* Mirrors the engine's own start-intent rule (useInterviewEngine's
   missingStartIntentRef): /interview is only legitimate with ?new=1,
   ?resume=true, or a saved draft for this user. Checked before the engine
   mounts so a bounced visit shows a message instead of a blank interview
   shell, and never reaches the engine's credit-charging effects. */
export function hasInterviewStartIntent(
  search: string,
  readDraft: (key: string) => string | null,
  userId: string | null | undefined,
): boolean {
  const params = new URLSearchParams(search);
  if (params.get("new") === "1" || params.get("resume") === "true") return true;
  try {
    return !!readDraft(`hirestepx_interview_draft_${userId || "anon"}`);
  } catch {
    return false;
  }
}
