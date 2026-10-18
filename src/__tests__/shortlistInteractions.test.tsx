// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { Candidate, CandidateStatus } from "../employer/mockData";
import type { EmployerApiResult } from "../employer/EmployerDataContext";
import SelectionBar from "../../app/(employer)/employer/requirements/[id]/_components/SelectionBar";
import { useStageActions } from "../../app/(employer)/employer/requirements/[id]/_components/useStageActions";
import { rowAnnouncement, useShortlistShortcuts } from "../../app/(employer)/employer/requirements/[id]/_components/useShortlistShortcuts";
import { ToastProvider, useToast } from "../Toast";

const cand = (id: string, candidateStatus: CandidateStatus) => ({ id, name: `Name ${id}`, candidateStatus, unlocked: true }) as Candidate;
const ok: EmployerApiResult<null> = { ok: true, status: 200, data: null, error: null } as EmployerApiResult<null>;

describe("SelectionBar", () => {
  const baseProps = { canChangeStage: true, eligible: { rejected: 2, shortlisted: 0 }, busy: false, onCompare: vi.fn(), onBulk: vi.fn(), onClear: vi.fn() };

  it("renders nothing with no selection", () => {
    const { container } = render(<SelectionBar {...baseProps} count={0} />);
    expect(container.firstChild).toBeNull();
  });

  it("disables Compare until two are selected, then fires it", () => {
    const onCompare = vi.fn();
    const { rerender } = render(<SelectionBar {...baseProps} onCompare={onCompare} count={1} />);
    expect((screen.getByRole("button", { name: /compare/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Select 1 more to compare")).toBeTruthy();
    rerender(<SelectionBar {...baseProps} onCompare={onCompare} count={2} />);
    expect(screen.getByText("2 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /compare/i }));
    expect(onCompare).toHaveBeenCalledTimes(1);
  });

  it("turns Compare off again above three", () => {
    render(<SelectionBar {...baseProps} count={4} />);
    expect((screen.getByRole("button", { name: /compare/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Compare up to 3 candidates")).toBeTruthy();
  });

  it("disables a bulk move nobody in the selection qualifies for and reports the others", () => {
    const onBulk = vi.fn();
    render(<SelectionBar {...baseProps} onBulk={onBulk} count={2} />);
    expect((screen.getByRole("button", { name: "Back to To review" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onBulk).toHaveBeenCalledWith("rejected");
  });

  it("hides stage actions on a closed job and clears the selection", () => {
    const onClear = vi.fn();
    render(<SelectionBar {...baseProps} canChangeStage={false} onClear={onClear} count={2} />);
    expect(screen.queryByRole("button", { name: "Reject" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onClear).toHaveBeenCalled();
  });
});

describe("useStageActions", () => {
  function setup(update: (id: string, p: { candidateStatus: CandidateStatus }) => Promise<EmployerApiResult<null>>) {
    let list = [cand("1", "shortlisted"), cand("2", "shortlisted"), cand("3", "interview_invited")];
    const patchCandidates = vi.fn((apply: (c: Candidate) => Candidate) => { list = list.map(apply); });
    const toast = vi.fn();
    const hook = renderHook(() => useStageActions({ candidates: list, patchCandidates, update, toast }));
    return { hook, toast, statuses: () => list.map((c) => `${c.id}:${c.candidateStatus}`), refresh: () => hook.rerender() };
  }

  it("rejects in bulk with an optimistic patch and an Undo that restores prior statuses", async () => {
    const update = vi.fn(async () => ok);
    const s = setup(update);
    let moved: string[] = [];
    await act(async () => { moved = await s.hook.result.current.bulkMove(new Set(["1", "2", "3"]), "rejected"); });
    expect(moved.sort()).toEqual(["1", "2", "3"]);
    expect(s.statuses()).toEqual(["1:rejected", "2:rejected", "3:rejected"]);
    const [message, type, options] = s.toast.mock.calls[0];
    expect(message).toBe("Rejected 3 candidates.");
    expect(type).toBe("success");
    expect(options.action.label).toBe("Undo");

    update.mockClear();
    await act(async () => { options.action.onClick(); });
    // A rejected candidate can only be reopened to To review, so the invited one is not restorable and stays rejected.
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith("1", { candidateStatus: "shortlisted" });
    expect(update).not.toHaveBeenCalledWith("3", expect.anything());
    expect(s.statuses()).toEqual(["1:shortlisted", "2:shortlisted", "3:rejected"]);
    expect(s.toast.mock.calls[1][0]).toBe("Restored 2 candidates.");
  });

  it("rolls back only the candidates the server refused", async () => {
    const update = vi.fn(async (id: string) => (id === "2" ? ({ ok: false, status: 500, data: null, error: { message: "boom" } } as unknown as EmployerApiResult<null>) : ok));
    const s = setup(update);
    await act(async () => { await s.hook.result.current.bulkMove(new Set(["1", "2"]), "rejected"); });
    expect(s.statuses()).toEqual(["1:rejected", "2:shortlisted", "3:interview_invited"]);
    expect(s.toast.mock.calls[0][0]).toContain("Rejected 1 candidate.");
    expect(s.toast.mock.calls[0][0]).toContain("1 didn't save.");
  });

  it("gives a single stage change an Undo only when the move can be reversed", async () => {
    const update = vi.fn(async () => ok);
    const s = setup(update);
    const [first, , third] = [cand("1", "shortlisted"), cand("2", "shortlisted"), cand("3", "interview_invited")];
    await act(async () => { await s.hook.result.current.applyStage(first, "rejected"); });
    expect(s.toast.mock.calls[0][2]?.action?.label).toBe("Undo");
    await act(async () => { await s.hook.result.current.applyStage(third, "interviewing"); });
    expect(s.toast.mock.calls[1][2]).toBeUndefined();
  });

  it("makes no calls and says so when nobody in the selection qualifies", async () => {
    const update = vi.fn(async () => ok);
    const s = setup(update);
    await act(async () => { await s.hook.result.current.bulkMove(new Set(["1"]), "shortlisted"); });
    expect(update).not.toHaveBeenCalled();
    expect(s.toast.mock.calls[0][1]).toBe("error");
  });
});

describe("useShortlistShortcuts", () => {
  const handlers = () => ({ onNext: vi.fn(), onPrev: vi.fn(), onToggleSelect: vi.fn(), onOpen: vi.fn(), onHelp: vi.fn(), onEscape: vi.fn() });

  it("maps j k x e ? and Escape to their handlers", () => {
    const h = handlers();
    renderHook(() => useShortlistShortcuts(h, true));
    for (const key of ["j", "k", "x", "e", "?", "Escape"]) fireEvent.keyDown(window, { key });
    expect(h.onNext).toHaveBeenCalledTimes(1);
    expect(h.onPrev).toHaveBeenCalledTimes(1);
    expect(h.onToggleSelect).toHaveBeenCalledTimes(1);
    expect(h.onOpen).toHaveBeenCalledTimes(1);
    expect(h.onHelp).toHaveBeenCalledTimes(1);
    expect(h.onEscape).toHaveBeenCalledTimes(1);
  });

  it("ignores keys typed into an input and keys with a modifier", () => {
    const h = handlers();
    renderHook(() => useShortlistShortcuts(h, true));
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "j" });
    fireEvent.keyDown(window, { key: "x", metaKey: true });
    expect(h.onNext).not.toHaveBeenCalled();
    expect(h.onToggleSelect).not.toHaveBeenCalled();
    input.remove();
  });

  it("does nothing when disabled", () => {
    const h = handlers();
    renderHook(() => useShortlistShortcuts(h, false));
    fireEvent.keyDown(window, { key: "j" });
    expect(h.onNext).not.toHaveBeenCalled();
  });

  it("announces the row for a screen reader", () => {
    expect(rowAnnouncement("Asha", 2, 10, false)).toBe("Asha, candidate 2 of 10");
    expect(rowAnnouncement("Asha", 2, 10, true)).toBe("Asha, candidate 2 of 10, selected");
  });
});

describe("Toast action", () => {
  function Trigger({ onUndo }: { onUndo: () => void }) {
    const { toast } = useToast();
    return <button onClick={() => toast("Rejected 2 candidates.", "success", { action: { label: "Undo", onClick: onUndo } })}>go</button>;
  }

  it("runs the action once and dismisses the toast", () => {
    const onUndo = vi.fn();
    render(<ToastProvider><Trigger onUndo={onUndo} /></ToastProvider>);
    fireEvent.click(screen.getByText("go"));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});
