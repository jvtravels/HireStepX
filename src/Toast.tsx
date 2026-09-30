import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { c, font } from "./tokens";
import { tokens as T } from "./auth/_tokens";
import { haptic } from "./haptics";

/* ─── Types ─── */
export type ToastType = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });
export const useToast = () => useContext(ToastContext);

/* ─── Provider ─── */
let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    // AnimatePresence plays the exit animation before this actually unmounts.
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++nextId;
    setToasts(prev => [...prev.slice(-4), { id, message, type }]); // max 5
    // Mobile haptic feedback tied to toast type. No-op on desktops and iOS.
    if (type === "success") haptic.success();
    else if (type === "error") haptic.error();
    const timer = setTimeout(() => dismiss(id), 4000);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach(t => clearTimeout(t)); };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        role="status"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 9999,
          display: "flex", flexDirection: "column", gap: 8,
          pointerEvents: "none",
        }}
      >
        <AnimatePresence initial={false}>
            {toasts.map((t) => {
              // Info toasts are general notification UI, not a score/reward — indigo, not copper
              const color = t.type === "success" ? c.sage : t.type === "error" ? c.ember : T.indigo;
              const borderColor = t.type === "success" ? "rgba(21,128,61,0.25)" : t.type === "error" ? "rgba(185,28,28,0.25)" : "rgba(49,46,129,0.25)";
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.95 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    padding: "10px 16px", borderRadius: 10,
                    background: c.graphite, border: `1px solid ${borderColor}`,
                    boxShadow: "0 4px 20px rgba(14,12,8,0.18)",
                    display: "flex", alignItems: "center", gap: 10,
                    pointerEvents: "auto", maxWidth: 360,
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
                </motion.div>
              );
            })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
