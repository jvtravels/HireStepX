import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { c, font } from "./tokens";
import { tokens as T } from "./auth/_tokens";
import { haptic } from "./haptics";

/* ─── Types ─── */
export type ToastType = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  type: ToastType;
  entering: boolean;
  leaving: boolean;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

/* ─── Banner-stacking tunables ───────────────────────────────────────────
 * Ported from the transitions.dev "banner-stacking" pattern
 * (https://transitions.dev/detail.html?t=banner-stacking): newest toast
 * rises in at depth 0, older ones push back — smaller, higher, dimmer —
 * three deep, and a fourth arrival sends the oldest out. Hovering the
 * collapsed stack fans it into a readable list. */
const STACK_OPEN_MS = 350;
const STACK_CLOSE_MS = 250;
const STACK_RISE = 80; // px, enter offset
const STACK_BLUR = 2; // px, enter/leave cross-blur
const STACK_SCALE = 0.97; // enter scale-in
const STACK_PEEK = 12; // px, per-depth push-back offset
const STACK_SPREAD_GAP = 8; // px, gap between fanned-out banners
const STACK_DEPTH_SCALE = 0.06; // per-depth scale shrink
const STACK_DEPTH_FADE = 0.4; // per-depth opacity dim
const STACK_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const STACK_WIDTH = 360;
const MAX_DEPTH = 2; // three visible deep: 0, 1, 2
// Per-depth idle opacity: depth 1 dims by one fade step, depth 2 by 1.6x
// that step — not a plain depth*fade line, mirrors the source pattern.
const DEPTH_OPACITY = [1, 1 - STACK_DEPTH_FADE, 1 - STACK_DEPTH_FADE * 1.6];

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/* ─── Provider ─── */
let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isSpread, setIsSpread] = useState(false);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const leavingScheduledRef = useRef<Set<number>>(new Set());
  const stackRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Marks a toast for its leave animation; the effect below removes it
  // from state once --stack-close has played.
  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId;
    if (type === "success") haptic.success();
    else if (type === "error") haptic.error();

    setToasts(prev => {
      const withNew: Toast[] = [{ id, message, type, entering: true, leaving: false }, ...prev];
      // A fourth (and beyond) banner is pushed straight into its leave
      // animation rather than queued — "the fourth arrival sends the
      // oldest out."
      let rank = -1;
      return withNew.map(t => {
        if (t.leaving) return t;
        rank += 1;
        return rank > MAX_DEPTH ? { ...t, leaving: true } : t;
      });
    });

    const timer = setTimeout(() => dismiss(id), 4000);
    timersRef.current.set(id, timer);

    // Flush the pre-open (is-enter) state, then release it in the same
    // task — a single rAF hop is skipped whenever the frame clock is
    // throttled, and the banner would land with no motion at all.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setToasts(prev => prev.map(t => (t.id === id ? { ...t, entering: false } : t)));
      });
    });
  }, [dismiss]);

  // Actually remove a banner once it has finished playing its leave
  // animation (fired exactly once per toast, whenever `leaving` flips true).
  useEffect(() => {
    toasts.forEach(t => {
      if (t.leaving && !leavingScheduledRef.current.has(t.id)) {
        leavingScheduledRef.current.add(t.id);
        const timer = setTimeout(() => {
          setToasts(prev => prev.filter(x => x.id !== t.id));
          leavingScheduledRef.current.delete(t.id);
          timersRef.current.delete(t.id);
        }, STACK_CLOSE_MS + 60);
        timersRef.current.set(t.id, timer);
      }
    });
  }, [toasts]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach(timer => clearTimeout(timer)); };
  }, []);

  // Hover spread is geometry, not :hover — the gaps between fanned-out
  // banners belong to no element, and a plain mouseleave on the collapsed
  // card would fire before the pointer reaches the taller revealed column.
  useEffect(() => {
    if (toasts.length === 0) return;
    const within = (e: PointerEvent, above: number) => {
      const stack = stackRef.current;
      if (!stack) return false;
      const r = stack.getBoundingClientRect();
      return (
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY <= r.bottom && e.clientY >= r.top - above
      );
    };
    const onPointerMove = (e: PointerEvent) => {
      const stack = stackRef.current;
      if (!stack) return;
      const spreadHeight = (stack.getBoundingClientRect().height + STACK_SPREAD_GAP) * 2;
      setIsSpread(prev => {
        if (prev) return within(e, spreadHeight);
        return within(e, 0);
      });
    };
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [toasts.length]);

  // Rank among non-leaving toasts gives each one its stacking depth
  // (0 = front); leaving toasts animate out from wherever they were.
  const depthById = new Map<number, number>();
  let rank = -1;
  toasts.forEach(t => {
    if (!t.leaving) { rank += 1; depthById.set(t.id, rank); }
  });

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        role="status"
        style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, pointerEvents: "none" }}
      >
        <div ref={stackRef} style={{ position: "relative", width: `min(${STACK_WIDTH}px, calc(100vw - 48px))` }}>
          {toasts.map((t) => {
            const depth = t.leaving ? MAX_DEPTH + 1 : (depthById.get(t.id) ?? 0);
            const color = t.type === "success" ? c.sage : t.type === "error" ? c.ember : T.indigo;
            const borderColor = t.type === "success" ? T.successLine : t.type === "error" ? T.errorLine : T.indigoRing;

            const spreadActive = isSpread && !t.leaving && depth > 0;
            const translateY = t.entering
              ? STACK_RISE
              : spreadActive
                ? 0 // handled below via calc() against the banner's own height
                : -(STACK_PEEK * depth);
            const scale = t.entering ? STACK_SCALE : spreadActive ? 1 : 1 - STACK_DEPTH_SCALE * depth;
            const opacity = t.entering || t.leaving
              ? 0
              : spreadActive
                ? 1
                : DEPTH_OPACITY[Math.min(depth, DEPTH_OPACITY.length - 1)];
            const blur = t.entering || t.leaving ? STACK_BLUR : 0;
            const duration = t.leaving ? STACK_CLOSE_MS : STACK_OPEN_MS;

            const transform = spreadActive
              ? `translateY(calc((100% + ${STACK_SPREAD_GAP}px) * -${depth})) scale(1)`
              : `translateY(${translateY}px) scale(${scale})`;

            return (
              <div
                key={t.id}
                style={{
                  position: depth === 0 && !t.leaving ? "relative" : "absolute",
                  left: 0, right: 0, bottom: 0,
                  zIndex: t.leaving ? 0 : 3 - Math.min(depth, 3),
                  transformOrigin: depth === 0 && !t.leaving ? "50% 50%" : "50% 100%",
                  transform: reducedMotion ? "none" : transform,
                  opacity,
                  filter: reducedMotion ? "none" : `blur(${blur}px)`,
                  transition: reducedMotion || t.entering
                    ? "none"
                    : `transform ${duration}ms ${STACK_EASE}, opacity ${duration}ms ${STACK_EASE}, filter ${duration}ms ${STACK_EASE}`,
                  willChange: "transform, opacity, filter",
                  padding: "10px 16px", borderRadius: 10,
                  background: c.graphite, border: `1px solid ${borderColor}`,
                  boxShadow: "0 4px 20px rgba(14,12,8,0.18)",
                  display: "flex", alignItems: "center", gap: 10,
                  pointerEvents: t.leaving ? "none" : "auto",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontFamily: font.ui, fontSize: 13, color: c.ivory, lineHeight: 1.4, flex: 1 }}>{t.message}</span>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss notification"
                  style={{ background: "none", border: "none", color: c.stone, cursor: "pointer", padding: 2, flexShrink: 0 }}
                >
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
