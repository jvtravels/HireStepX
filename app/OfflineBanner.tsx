"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useConnectionState } from "@/connectionMonitor";

/**
 * Driven by real request outcomes (see connectionMonitor), not navigator.onLine,
 * so it also catches captive portals and stalled mobile data where the browser
 * still reports "online". Shows a brief confirmation on recovery.
 */
export function OfflineBanner() {
  const { status } = useConnectionState();
  const employer = (usePathname() ?? "").startsWith("/employer");
  const [showBack, setShowBack] = useState(false);
  const prev = useRef(status);

  useEffect(() => {
    const was = prev.current;
    prev.current = status;
    if (status === "online" && was !== "online") {
      setShowBack(true);
      const t = setTimeout(() => setShowBack(false), 2000);
      return () => clearTimeout(t);
    }
    if (status !== "online") setShowBack(false);
    return undefined;
  }, [status]);

  if (status === "online" && !showBack) return null;

  const isBack = status === "online";
  const degraded = status === "degraded";

  // The console has no interview answers to sync, so it gets a pill that says
  // what actually happens. It sits just under the header: a bottom pill covered
  // the pagination and composer controls, and pointer-events-none keeps taps
  // on whatever lies beneath.
  if (employer) {
    return (
      <div
        role="alert"
        className="pointer-events-none fixed top-[60px] left-1/2 z-[9999] w-max max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full bg-hx-coal px-4 py-2 text-center text-[13px] font-medium leading-snug text-white shadow-lg"
      >
        {isBack
          ? "Back online"
          : degraded
            ? "Your connection is unstable. Some actions may be slow."
            : "You’re offline. Changes won’t be saved until you’re back."}
      </div>
    );
  }

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: isBack ? "rgba(34,120,60,0.92)" : "rgba(212,179,127,0.14)",
        borderBottom: isBack ? "1px solid #2d8a4e" : "1px solid #D4B37F",
        color: isBack ? "#e0f5e6" : "#D4B37F",
        textAlign: "center",
        padding: "8px 16px",
        fontFamily: "'Geist Sans', system-ui, sans-serif",
        fontSize: 14,
        transition: "opacity 0.4s ease",
        opacity: isBack ? 0.95 : 1,
      }}
    >
      {isBack
        ? "Back online"
        : degraded
          ? "Your connection is unstable. Some actions may be slow."
          : "You’re offline. We’ll keep trying and sync your work when you’re back."}
    </div>
  );
}
