import { useLayoutEffect, useState } from "react";

const prefersReducedMotion = () =>
  typeof window === "undefined" || typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Eases 0 -> target on mount. Returns the target untouched when the user
   prefers reduced motion, or when matchMedia is unavailable (SSR, jsdom). */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(target);
  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      setValue(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setValue(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}
