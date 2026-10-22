import { useSyncExternalStore } from "react";

/* True while the viewport is narrower than `px`. SSR/first paint report
   false (desktop layout) and correct themselves on hydration; matchMedia is
   guarded because jsdom doesn't implement it. */
export function useMaxWidth(px: number): boolean {
  const query = `(max-width: ${px - 1}px)`;
  return useSyncExternalStore(
    (notify) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false),
    () => false,
  );
}
