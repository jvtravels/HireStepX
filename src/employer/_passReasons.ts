export const REJECT_REASONS = ["Skills gap", "Not enough experience", "Too senior", "Location", "Salary expectations", "Notice period", "Communication", "Role mismatch"] as const;

export type RejectReason = (typeof REJECT_REASONS)[number];

const KNOWN_REASONS: ReadonlySet<string> = new Set(REJECT_REASONS);

/** Reasons first, then the free text, in one string for the existing `note` field. */
export function composeRejectNote(reasons: readonly string[], text: string): string | undefined {
  const parts = [reasons.length > 0 ? `Reasons: ${reasons.join(", ")}.` : "", text.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

/** Reads the reasons back out of a note written by composeRejectNote; free text and unknown labels are ignored. */
export function parseRejectReasons(note: string | null | undefined): RejectReason[] {
  const match = /^Reasons: ([^.]*)\./.exec(note ?? "");
  if (!match) return [];
  const found = match[1].split(", ").filter((r): r is RejectReason => KNOWN_REASONS.has(r));
  return [...new Set(found)];
}
