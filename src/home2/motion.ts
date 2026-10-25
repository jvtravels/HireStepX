import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Plays once when scrolled into view. Starts "on" so server render, reduced motion and already-visible content show the final state. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [on, setOn] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined" || reduced()) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.85 && r.bottom > 0) return;
    setOn(false);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setOn(true); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, on };
}

export function useTween(target: number, ms = 700) {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current;
    if (from === target) return;
    if (reduced()) { cur.current = target; setV(target); return; }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const val = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      cur.current = val;
      setV(val);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export const delay = (i: number): React.CSSProperties => ({ ["--i" as string]: i });

/* Scroll-linked tilt: sets --t on the element, 1 while it sits low in the viewport, 0 once it has scrolled up. No re-renders. */
export function useScrollTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const top = el.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, (top - vh * 0.1) / (vh * 0.45)));
      el.style.setProperty("--t", p.toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}

/* Scroll-linked depth: sets --p on the element, 0 as it enters at the bottom of the viewport and 1 as it leaves at the top. No re-renders. */
export function useScrollDepth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      el.style.setProperty("--p", p.toFixed(3));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}

/* Scroll-pinned stage: a card that expands to fill the screen, holds while n panels cross-fade on scroll, then shrinks away. Writes --e (expand 0..1) and per-panel --o/--y/--b vars to the stage with no re-renders. */
export const FT_ENTER = 320;
export const FT_STEP = 400;
export const FT_TOP = 0;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => x * x * (3 - 2 * x);

export function useScrollStage<T extends HTMLElement, S extends HTMLElement>(n: number) {
  const ref = useRef<T>(null);
  const stage = useRef<S>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    const el = ref.current;
    const st = stage.current;
    if (!el || !st) return;
    let raf = 0;
    let cur = 0;
    const update = () => {
      raf = 0;
      if (el.offsetHeight - window.innerHeight <= 0) return;
      const s = FT_TOP - el.getBoundingClientRect().top;
      const e = smooth(clamp(s / FT_ENTER, 0, 1)) * (1 - smooth(clamp((s - FT_ENTER - n * FT_STEP) / FT_ENTER, 0, 1)));
      const f = clamp((s - FT_ENTER) / FT_STEP, 0, n - 0.001);
      const fb = clamp(f, 0.5, n - 0.5);
      st.style.setProperty("--e", e.toFixed(4));
      if (st.parentElement) st.parentElement.style.zIndex = e > 0.001 ? "20" : "";
      for (let k = 0; k < n; k++) {
        const d = Math.abs(fb - (k + 0.5));
        st.style.setProperty(`--o${k}`, clamp(1 - (d - 0.36) / 0.14, 0, 1).toFixed(3));
        st.style.setProperty(`--y${k}`, `${(clamp(fb - (k + 0.5), -0.5, 0.5) * -56).toFixed(1)}px`);
        st.style.setProperty(`--b${k}`, clamp(1 - Math.abs(fb - (k + 0.5)), 0, 1).toFixed(3));
      }
      const idx = Math.floor(f);
      if (idx !== cur) { cur = idx; setI(idx); }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [n]);
  const go = (k: number) => {
    const el = ref.current;
    if (!el) return;
    const s = FT_ENTER + FT_STEP * (k + 0.5);
    window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - FT_TOP + s, behavior: reduced() ? "auto" : "smooth" });
  };
  return { ref, stage, i, go };
}

/* Keeps an element mounted for `ms` after `open` goes false so an exit animation can play. */
export function usePresence(open: boolean, ms = 160) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return; }
    if (reduced()) { setMounted(false); return; }
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted: open || mounted, closing: !open && mounted };
}

/* Sliding indicator: measures the selected tab and exposes --sx / --sw on the container. */
export function useSlider<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const on = el.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!on) { el.removeAttribute("data-ready"); return; }
      el.style.setProperty("--sx", on.offsetLeft + "px");
      el.style.setProperty("--sy", on.offsetTop + "px");
      el.style.setProperty("--sw", on.offsetWidth + "px");
      el.style.setProperty("--sh", on.offsetHeight + "px");
      el.setAttribute("data-ready", "");
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [dep]);
  return ref;
}
