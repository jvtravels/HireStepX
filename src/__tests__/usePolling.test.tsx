import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePolling } from "../usePolling";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("usePolling", () => {
  beforeEach(() => { vi.useFakeTimers(); setVisibility("visible"); });
  afterEach(() => { vi.useRealTimers(); });

  it("runs immediately, then on the interval", async () => {
    const task = vi.fn(async () => true);
    renderHook(() => usePolling(task, 1000));
    await act(async () => { await Promise.resolve(); });
    expect(task).toHaveBeenCalledTimes(1);
    expect(task).toHaveBeenLastCalledWith(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(task).toHaveBeenCalledTimes(2);
    expect(task).toHaveBeenLastCalledWith(false);
  });

  it("makes no requests while the tab is hidden and catches up on return", async () => {
    const task = vi.fn(async () => true);
    renderHook(() => usePolling(task, 1000));
    await act(async () => { await Promise.resolve(); });
    act(() => setVisibility("hidden"));
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => { setVisibility("visible"); await Promise.resolve(); });
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("backs off exponentially after failures", async () => {
    const task = vi.fn(async () => false);
    renderHook(() => usePolling(task, 1000));
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1999); });
    expect(task).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(task).toHaveBeenCalledTimes(2);
  });

  it("stops polling on unmount", async () => {
    const task = vi.fn(async () => true);
    const { unmount } = renderHook(() => usePolling(task, 1000));
    await act(async () => { await Promise.resolve(); });
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(task).toHaveBeenCalledTimes(1);
  });
});
