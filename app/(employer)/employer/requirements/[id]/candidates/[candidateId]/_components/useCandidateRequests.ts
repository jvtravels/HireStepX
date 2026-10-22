import { useCallback, useEffect, useState } from "react";
import { useEmployerData } from "@/employer/EmployerDataContext";
import type { CandidateRequestDto, CreateRequestBody, RequestKind } from "@/employer/_candidateRequestTypes";

export function useCandidateRequests(matchId: string | undefined) {
  const { fetchCandidateRequests, createCandidateRequest, cancelCandidateRequest } = useEmployerData();
  const [requests, setRequests] = useState<CandidateRequestDto[]>([]);
  const [available, setAvailable] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!matchId) return;
    let active = true;
    fetchCandidateRequests(matchId).then((res) => {
      if (!active) return;
      if (res) {
        setRequests(res.requests);
        setAvailable(res.available);
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [matchId, fetchCandidateRequests]);

  const create = useCallback(
    async (body: CreateRequestBody) => {
      if (!matchId) return { ok: false as const, error: { error: "Candidate not loaded", status: 0 } };
      const res = await createCandidateRequest(matchId, body);
      if (res.ok) setRequests((prev) => [res.data, ...prev]);
      return res;
    },
    [matchId, createCandidateRequest],
  );

  const cancel = useCallback(
    async (requestId: string) => {
      if (!matchId) return false;
      const res = await cancelCandidateRequest(matchId, requestId);
      if (res.ok) setRequests((prev) => prev.map((r) => (r.id === requestId ? res.data : r)));
      return res.ok;
    },
    [matchId, cancelCandidateRequest],
  );

  const pending = requests.filter((r) => r.status === "pending");
  const findPending = useCallback(
    (kind: RequestKind, topic?: string | null) =>
      pending.find((r) => r.kind === kind && (r.topic ?? "") === (topic ?? "")) ?? null,
    [pending],
  );

  return { requests, pending, available, loaded, create, cancel, findPending };
}

export type CandidateRequestsState = ReturnType<typeof useCandidateRequests>;
