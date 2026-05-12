/* Tests for the client-side negotiation kernel feature flag.
 * Precedence: localStorage "1"/"0" override > NEXT_PUBLIC env > off. */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from "vitest";
import { isNegotiationKernelEnabled, setNegotiationKernelOverride } from "../_negotiation-kernel-flag";

const LS_KEY = "negotiation_kernel";

/* The test runtime here doesn't provide localStorage on window for
   all files; install a minimal in-memory shim so behaviour is
   deterministic regardless of which env vitest picks. */
beforeAll(() => {
  if (typeof window !== "undefined" && typeof window.localStorage?.setItem !== "function") {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => store.clear(),
      },
    });
  }
});

describe("isNegotiationKernelEnabled", () => {
  beforeEach(() => {
    try { window.localStorage.removeItem(LS_KEY); } catch { /* noop */ }
    delete process.env.NEXT_PUBLIC_NEGOTIATION_KERNEL_ENABLED;
  });
  afterEach(() => {
    try { window.localStorage.removeItem(LS_KEY); } catch { /* noop */ }
    delete process.env.NEXT_PUBLIC_NEGOTIATION_KERNEL_ENABLED;
  });

  it("returns false by default", () => {
    expect(isNegotiationKernelEnabled()).toBe(false);
  });

  it("returns true when NEXT_PUBLIC env is '1'", () => {
    process.env.NEXT_PUBLIC_NEGOTIATION_KERNEL_ENABLED = "1";
    expect(isNegotiationKernelEnabled()).toBe(true);
  });

  it("localStorage '1' override forces on even with env unset", () => {
    window.localStorage.setItem(LS_KEY, "1");
    expect(isNegotiationKernelEnabled()).toBe(true);
  });

  it("localStorage '0' override forces off even with env on", () => {
    process.env.NEXT_PUBLIC_NEGOTIATION_KERNEL_ENABLED = "1";
    window.localStorage.setItem(LS_KEY, "0");
    expect(isNegotiationKernelEnabled()).toBe(false);
  });

  it("unknown localStorage value falls through to env", () => {
    process.env.NEXT_PUBLIC_NEGOTIATION_KERNEL_ENABLED = "1";
    window.localStorage.setItem(LS_KEY, "yes");
    expect(isNegotiationKernelEnabled()).toBe(true);
  });
});

describe("setNegotiationKernelOverride", () => {
  beforeEach(() => {
    try { window.localStorage.removeItem(LS_KEY); } catch { /* noop */ }
  });

  it("writes '1' to localStorage", () => {
    setNegotiationKernelOverride("1");
    expect(window.localStorage.getItem(LS_KEY)).toBe("1");
  });

  it("clears override when given null", () => {
    window.localStorage.setItem(LS_KEY, "1");
    setNegotiationKernelOverride(null);
    expect(window.localStorage.getItem(LS_KEY)).toBeNull();
  });
});
