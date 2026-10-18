import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBeforeUnloadGuard } from "../useBeforeUnloadGuard";

function fire(): BeforeUnloadEvent {
  const e = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(e);
  return e;
}

describe("useBeforeUnloadGuard", () => {
  it("does not prompt while inactive (no answers yet)", () => {
    const { unmount } = renderHook(() => useBeforeUnloadGuard(false));
    expect(fire().defaultPrevented).toBe(false);
    unmount();
  });

  it("prompts once active", () => {
    const { rerender, unmount } = renderHook(({ a }) => useBeforeUnloadGuard(a), { initialProps: { a: false } });
    rerender({ a: true });
    expect(fire().defaultPrevented).toBe(true);
    unmount();
  });

  it("stops prompting after release()", () => {
    const { result, unmount } = renderHook(() => useBeforeUnloadGuard(true));
    expect(fire().defaultPrevented).toBe(true);
    result.current();
    expect(fire().defaultPrevented).toBe(false);
    unmount();
  });

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useBeforeUnloadGuard(true));
    unmount();
    expect(fire().defaultPrevented).toBe(false);
  });
});
