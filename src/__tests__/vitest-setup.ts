import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia. Components that read viewport state at
// mount (DashboardContext's isMobile, responsive panels) call it during render,
// so provide a minimal, inert stub for the whole test suite.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// Node's experimental localStorage can be active without a backing file (see the
// "--localstorage-file" warning), leaving getItem/setItem undefined. Components
// that touch localStorage during render (interview draft restore) then throw and
// fall back to the error boundary. Install a deterministic in-memory store.
if (
  typeof window !== "undefined" &&
  typeof window.localStorage?.getItem !== "function"
) {
  const store = new Map<string, string>();
  const mem: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => void store.delete(k),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
  };
  Object.defineProperty(window, "localStorage", {
    value: mem,
    configurable: true,
  });
}
