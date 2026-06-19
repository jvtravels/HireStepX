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

// jsdom resolves the optional native `canvas` package when it's present, then
// drives image decoding through it inside HTMLImageElement._updateTheImageData.
// A broken / stub `canvas` install makes `new Canvas.Image()` throw, so ANY
// <img src=...> render (e.g. the wordmark on OnboardingComplete) crashes —
// non-deterministically, only when a worker shard happens to run that file. We
// never decode images under test, so neutralize the side effect at its source
// on the impl prototype. This is ordering-independent and covers every code
// path (the `.src` setter and React's setAttribute) in one place.
if (typeof window !== "undefined" && typeof window.HTMLImageElement === "function") {
  try {
    const probe = window.document.createElement("img");
    const implSym = Object.getOwnPropertySymbols(probe).find(
      (s) => String(s) === "Symbol(impl)",
    );
    if (implSym) {
      const impl = (probe as unknown as Record<symbol, unknown>)[implSym];
      const proto = impl ? (Object.getPrototypeOf(impl) as Record<string, unknown>) : null;
      if (proto && typeof proto._updateTheImageData === "function") {
        proto._updateTheImageData = function () {};
      }
    }
  } catch {
    // Best-effort: if jsdom internals change shape, tests that don't render
    // <img> are unaffected and image-rendering tests fail loudly as before.
  }
}
