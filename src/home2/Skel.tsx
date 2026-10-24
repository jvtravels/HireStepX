import { useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { generate } from "./ui-generation.js";

/* Draws the element as a dotted wireframe, then reveals the real UI behind a scan line, once, when it scrolls into view. Server HTML carries data-sk="pending", which CSS hides only when scripting is on, so no-JS users still see the final UI and nobody sees it flash before the skeleton. */
export function useSkel(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    document.documentElement.dataset.hxHyd = "1";
    const done = () => { el.dataset.sk = "done"; };
    if (!("IntersectionObserver" in window)) return done();
    let run: { cancel: () => void } | null = null;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      el.dataset.sk = "playing";
      run = generate(el, { mode: "skeleton", duration: 1200, reveal: "fade", fadeDuration: 380, revealAt: 700, delay: 0, onDone: done });
    }, { threshold: 0.25 });
    io.observe(el);
    return () => { io.disconnect(); run?.cancel(); el.dataset.sk = "pending"; };
  }, [ref]);
}

/* replayKey: when it changes after the first play, the swapped content redraws with a short skeleton (hidden before paint, so the new content never flashes). */
export default function Skel({ className, style, children, replayKey, role, "aria-label": ariaLabel }: { className?: string; style?: CSSProperties; children: ReactNode; replayKey?: number; role?: string; "aria-label"?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useSkel(ref);
  useLayoutEffect(() => {
    const el = ref.current;
    if (first.current) { first.current = false; return; }
    if (!el || el.dataset.sk === "pending") return;
    el.dataset.sk = "playing";
    generate(el, { mode: "skeleton", duration: 600, reveal: "fade", fadeDuration: 240, revealAt: 330, delay: 0, onDone: () => { el.dataset.sk = "done"; } });
  }, [replayKey]);
  return <div ref={ref} data-sk="pending" className={className} style={style} role={role} aria-label={ariaLabel}>{children}</div>;
}
