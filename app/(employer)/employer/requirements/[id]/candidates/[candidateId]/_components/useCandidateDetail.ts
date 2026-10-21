import { useState, useEffect, useCallback } from "react";
import { useEmployerData } from "@/employer/EmployerDataContext";
import type { Requirement, CandidateEvidence, EmployerApiError } from "@/employer/EmployerDataContext";
import type { CandidateStatus } from "@/employer/mockData";
import { useToast } from "@/Toast";
import { canInviteCandidate } from "../../../_components/requirementFormat";

export type ActionNotice =
  | { kind: "unlock_required"; message: string }
  | { kind: "declined"; message: string }
  | { kind: "suspended"; message: string };

/** `note` is the private internal note; `candidateMessage` is the only text the candidate sees. */
type StatusChange = { status: CandidateStatus; note?: string; candidateMessage?: string; scheduledAt?: string };

/** Maps the structured status-update failure onto what the page should do:
 *  an inline notice (402/409/403), a "no longer available" screen (404), or a
 *  plain error toast (anything else, including a tier limit 429). */
function classify(err: EmployerApiError): { notice?: ActionNotice; unavailable?: boolean; toast?: string } {
  if (err.status === 402 || err.code === "unlock_required") {
    return { notice: { kind: "unlock_required", message: "Unlock this candidate first. Interview invites and later stages are only available once their contact is revealed." } };
  }
  if (err.code === "candidate_withdrew") {
    return { notice: { kind: "declined", message: "This candidate has withdrawn from employer contact, so you can't invite them. You can still close them out." } };
  }
  if (err.status === 409) {
    return { notice: { kind: "declined", message: "This candidate has declined contact, so you can't invite them. You can still close them out." } };
  }
  if (err.status === 404) return { unavailable: true };
  if (err.status === 403 || err.code === "suspended") {
    return { notice: { kind: "suspended", message: err.error || "Your account is suspended. Contact support to restore access." } };
  }
  if (err.status === 429 && err.limit != null) {
    return { toast: `Daily limit reached (${err.limit} on your ${err.tier ? err.tier.replace("_", " ") : "current"} tier). Try again tomorrow.` };
  }
  return { toast: err.error || "Couldn't update this candidate. Please try again" };
}

const CLEAN_SCOPE = { unavailable: false, declined: false, notice: null as ActionNotice | null };
type CandidateScope = { id: string } & typeof CLEAN_SCOPE;

export function useCandidateDetail(requirementId: string, matchId: string) {
  const { fetchRequirementDetail, updateCandidateStatusResult, fetchCandidateEvidence } = useEmployerData();
  const { toast } = useToast();

  const [requirement, setRequirement] = useState<Requirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // Per-candidate outcomes are scoped to the match id, so stepping to the next
  // candidate starts clean instead of inheriting the last one's notice or decline.
  const [scope, setScope] = useState<CandidateScope>({ id: matchId, ...CLEAN_SCOPE });
  const local = scope.id === matchId ? scope : { id: matchId, ...CLEAN_SCOPE };
  const { unavailable, declined: declinedLocally, notice } = local;
  const patchScope = useCallback(
    (p: Partial<typeof CLEAN_SCOPE>) => setScope((prev) => ({ ...(prev.id === matchId ? prev : { id: matchId, ...CLEAN_SCOPE }), ...p })),
    [matchId],
  );

  const [evidence, setEvidence] = useState<CandidateEvidence | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceFailed, setEvidenceFailed] = useState(false);
  const [evidenceNonce, setEvidenceNonce] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    const r = await fetchRequirementDetail(requirementId);
    setRequirement(r);
    setLoadFailed(r === null);
    setLoading(false);
  }, [fetchRequirementDetail, requirementId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    const r = await fetchRequirementDetail(requirementId, { fresh: true });
    if (r) setRequirement(r);
  }, [fetchRequirementDetail, requirementId]);

  const candidate = requirement?.candidates.find((c) => c.id === matchId);
  const candidateId = candidate?.id;
  const unlockedFlag = candidate?.unlocked;

  // Keyed on id + unlocked (not the candidate object, which is re-derived on
  // every optimistic patch): re-fetching on unlock reveals the quotes.
  useEffect(() => {
    if (!candidateId) return;
    let active = true;
    setEvidenceLoading(true);
    setEvidenceFailed(false);
    fetchCandidateEvidence(candidateId).then((e) => {
      if (!active) return;
      setEvidence(e);
      setEvidenceId(candidateId);
      setEvidenceFailed(e === null);
      setEvidenceLoading(false);
    });
    return () => {
      active = false;
    };
  }, [candidateId, unlockedFlag, evidenceNonce, fetchCandidateEvidence]);

  const reloadEvidence = useCallback(() => setEvidenceNonce((n) => n + 1), []);
  const clearNotice = useCallback(() => patchScope({ notice: null }), [patchScope]);
  // Until the new candidate's evidence lands, show loading rather than the previous candidate's answers.
  const evidenceStale = candidateId != null && evidenceId !== candidateId;

  const changeStatus = async (change: StatusChange): Promise<boolean> => {
    if (!candidate) return false;
    const previous = {
      candidateStatus: candidate.candidateStatus,
      candidateStatusNote: candidate.candidateStatusNote,
      interviewScheduledAt: candidate.interviewScheduledAt,
    };
    const patch = (p: Partial<typeof candidate>) =>
      setRequirement((prev) => (prev ? { ...prev, candidates: prev.candidates.map((c) => (c.id !== candidate.id ? c : { ...c, ...p })) } : prev));

    patchScope({ notice: null });
    patch({
      candidateStatus: change.status,
      candidateStatusNote: change.note || previous.candidateStatusNote,
      interviewScheduledAt: change.scheduledAt || previous.interviewScheduledAt,
    });
    const res = await updateCandidateStatusResult(candidate.id, {
      candidateStatus: change.status,
      note: change.note,
      // Always explicit (even empty) so the server never treats the private note as a message to the candidate.
      candidateMessage: change.candidateMessage ?? "",
      interviewScheduledAt: change.scheduledAt,
    });
    if (res.ok) return true;

    patch(previous);
    const outcome = classify(res.error);
    if (outcome.notice) patchScope({ notice: outcome.notice, ...(outcome.notice.kind === "declined" && { declined: true }) });
    if (outcome.unavailable) patchScope({ unavailable: true });
    if (outcome.toast) toast(outcome.toast, "error");
    return false;
  };

  return {
    requirement,
    candidate,
    loading,
    loadFailed,
    unavailable,
    // Invite is closed when the server already says declined/withdrew, not only after a failed attempt here.
    declinedLocally: declinedLocally || (candidate != null && !canInviteCandidate(candidate)),
    reload: load,
    refresh,
    evidence: evidenceStale ? null : evidence,
    evidenceLoading: evidenceLoading || evidenceStale,
    evidenceFailed: evidenceStale ? false : evidenceFailed,
    reloadEvidence,
    notice,
    clearNotice,
    changeStatus,
  };
}
