/* HireStepX — Interview session draft snapshot
 *
 * Pure-function helper that builds the IDB / localStorage draft payload.
 * Extracted from useInterviewEngine.ts so the snapshot shape is one
 * thing in one place — not 12 inline fields scattered through a 2,300-
 * LOC engine. Also testable without React.
 *
 * The hook that USES this (autosave timer + beforeunload listener)
 * stays in the engine because it has too many React-state and ref
 * dependencies to extract cleanly.
 *
 * See src/__tests__/sessionDraft.test.ts.
 */

import type { InterviewStep } from "./interviewScripts";

export interface InterviewDraftSnapshot {
  /** Conversation transcript so far. */
  transcript: { speaker: "ai" | "user"; text: string; time: string }[];
  /** Live in-progress answer text (so a refresh mid-typing doesn't lose words). */
  currentTranscript: string;
  /** Index into the script the user is currently on. */
  currentStep: number;
  /** Total elapsed seconds in this session. */
  elapsed: number;
  /** Session metadata — used at restore time to validate compatibility. */
  interviewType: string;
  interviewDifficulty: string;
  interviewFocus: string;
  /** Optional URL-param overrides that need to round-trip. */
  targetRole: string;
  targetCompany: string;
  /** Snapshot of the script (allows resume even if URL params changed). */
  script: InterviewStep[];
  /** Wall-clock timestamp — used by restore to enforce TTL. */
  savedAt: number;
}

export interface DraftSnapshotInput {
  transcript: InterviewDraftSnapshot["transcript"];
  currentTranscript: string;
  currentStep: number;
  elapsed: number;
  interviewType: string;
  interviewDifficulty: string;
  interviewFocus: string;
  targetRole: string;
  targetCompany: string;
  script: InterviewStep[];
}

/**
 * Build the draft payload to persist. Stamped with a fresh `savedAt`
 * each call so the restore TTL check works correctly.
 */
export function buildDraftSnapshot(input: DraftSnapshotInput): InterviewDraftSnapshot {
  return {
    transcript: input.transcript,
    currentTranscript: input.currentTranscript,
    currentStep: input.currentStep,
    elapsed: input.elapsed,
    interviewType: input.interviewType,
    interviewDifficulty: input.interviewDifficulty,
    interviewFocus: input.interviewFocus,
    targetRole: input.targetRole,
    targetCompany: input.targetCompany,
    script: input.script,
    savedAt: Date.now(),
  };
}

/** Default time-to-live for restorable drafts: 24 hours. */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Decide whether a parsed draft from storage is restorable.
 * Returns the validated draft, or null if it should be discarded.
 *
 * Discard reasons (caller should also call deleteFromIDB):
 *   - Older than DRAFT_TTL_MS
 *   - Not the expected shape
 *   - Less than 1 step in (intro doesn't need restoring)
 *   - Interview type mismatch (user started a different session)
 */
export function validateRestoredDraft(
  parsed: unknown,
  expectedInterviewType?: string,
): InterviewDraftSnapshot | null {
  if (!parsed || typeof parsed !== "object") return null;
  const draft = parsed as Partial<InterviewDraftSnapshot>;
  if (!Array.isArray(draft.transcript)) return null;
  if (typeof draft.currentStep !== "number" || draft.currentStep <= 0) return null;
  if (typeof draft.savedAt === "number" && Date.now() - draft.savedAt > DRAFT_TTL_MS) return null;
  if (expectedInterviewType && draft.interviewType && draft.interviewType !== expectedInterviewType) return null;
  return draft as InterviewDraftSnapshot;
}
