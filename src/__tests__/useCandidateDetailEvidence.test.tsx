import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const fetchCandidateEvidence = vi.fn(async () => ({ matchId: "m1" }));
let resolveDetail: (v: unknown) => void = () => {};
const fetchRequirementDetail = vi.fn(() => new Promise((r) => { resolveDetail = r; }));

vi.mock("@/employer/EmployerDataContext", () => ({
  useEmployerData: () => ({ fetchRequirementDetail, fetchCandidateEvidence, updateCandidateStatusResult: vi.fn() }),
}));
vi.mock("@/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { useCandidateDetail } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/useCandidateDetail";

describe("useCandidateDetail evidence timing", () => {
  it("asks for evidence while the job detail is still loading, and only once", async () => {
    const { result } = renderHook(() => useCandidateDetail("req-1", "m1"));
    await waitFor(() => expect(fetchCandidateEvidence).toHaveBeenCalledWith("m1"));
    expect(result.current.loading).toBe(true);

    await act(async () => { resolveDetail({ id: "req-1", candidates: [{ id: "m1", unlocked: false }] }); });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchCandidateEvidence).toHaveBeenCalledTimes(1);
  });
});
