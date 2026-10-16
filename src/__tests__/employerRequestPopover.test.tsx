// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { RequestButton, RequestPopover } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/RequestPopover";
import type { CandidateRequestsState } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/useCandidateRequests";
import type { Candidate } from "../employer/mockData";

const state: CandidateRequestsState = {
  requests: [],
  pending: [],
  available: true,
  loaded: true,
  create: vi.fn(),
  cancel: vi.fn(),
  findPending: () => null,
};

describe("RequestPopover", () => {
  it("opens when the Request trigger is clicked", async () => {
    const candidate = { unlocked: false, contact: undefined, resume: undefined, portfolioLinks: [] } as any as Candidate;
    render(
      <RequestPopover candidate={candidate} state={state} disabled={false} disabledReason={null}>
        <RequestButton pendingCount={0} />
      </RequestPopover>,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: /request/i }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("button", { name: /request/i }));
    expect(await screen.findByText("Request from candidate")).toBeTruthy();
  });
});
