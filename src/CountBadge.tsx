"use client";

import { useEffect, useRef, useState } from "react";
import { tokens as T, fonts as F } from "./auth/_tokens";

/* Shared by NotificationBell and MessagesBell so both header icons show a
 * consistent unread indicator. Ported from the transitions.dev
 * "notification-badge" pattern (https://transitions.dev/detail.html?t=notification-badge):
 * the badge slides in diagonally and pops independently of the icon when it
 * first appears, then scales down + fades + blurs out (instead of just
 * vanishing) when the count drops back to zero. The outer .hsx-badge
 * wrapper owns the slide-in keyframe (data-open flips false->true on
 * mount); the inner .hsx-badge-dot owns the pop/close transform so the two
 * can run on different easings/durations like the spec. Stays mounted for
 * BADGE_CLOSE_DUR_MS after the count hits zero so the close animation can
 * finish before the span is actually removed. */
const BADGE_CLOSE_DUR_MS = 180;

const BADGE_STYLE = `
@keyframes hsx-badge-slide-in {
  from { transform: translate(-8.2px, 12.4px); }
  to   { transform: translate(0, 0); }
}
.hsx-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  pointer-events: none;
  will-change: transform;
}
.hsx-badge[data-open="true"] {
  animation: hsx-badge-slide-in 260ms cubic-bezier(0.22, 1, 0.36, 1);
}
.hsx-badge-dot {
  transform-origin: center;
  transform: scale(1);
  opacity: 1;
  filter: blur(0);
  transition:
    transform 500ms cubic-bezier(0.34, 1.36, 0.64, 1),
    opacity 400ms cubic-bezier(0.34, 1.36, 0.64, 1),
    filter 500ms cubic-bezier(0.34, 1.36, 0.64, 1);
  will-change: transform, opacity, filter;
}
.hsx-badge[data-open="false"] .hsx-badge-dot {
  transform: scale(0);
  opacity: 0;
  filter: blur(2px);
  transition:
    transform ${BADGE_CLOSE_DUR_MS}ms cubic-bezier(0.4, 0, 0.2, 1),
    opacity ${BADGE_CLOSE_DUR_MS}ms cubic-bezier(0.4, 0, 0.2, 1),
    filter ${BADGE_CLOSE_DUR_MS}ms cubic-bezier(0.4, 0, 0.2, 1);
}
@media (prefers-reduced-motion: reduce) {
  .hsx-badge, .hsx-badge-dot { animation: none !important; transition: none !important; }
}
`;

export default function CountBadge({ count }: { count: number }) {
  const hasCount = count > 0;
  const [shouldRender, setShouldRender] = useState(hasCount);
  const [open, setOpen] = useState(hasCount);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (unmountTimerRef.current) { clearTimeout(unmountTimerRef.current); unmountTimerRef.current = null; }
    if (hasCount) {
      setShouldRender(true);
      setOpen(true);
    } else {
      setOpen(false);
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      unmountTimerRef.current = setTimeout(() => setShouldRender(false), reduced ? 0 : BADGE_CLOSE_DUR_MS);
    }
    return () => { if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current); };
  }, [hasCount]);

  if (!shouldRender) return null;

  return (
    <span className="hsx-badge" data-open={open} aria-hidden="true">
      <style>{BADGE_STYLE}</style>
      <span
        className="hsx-badge-dot"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minWidth: 16, height: 16, padding: "0 4px", boxSizing: "border-box",
          borderRadius: 999, background: T.error, color: T.white,
          fontFamily: F.sans, fontSize: 10, fontWeight: 700,
          border: `2px solid ${T.white}`,
        }}
      >
        {count > 9 ? "9+" : count}
      </span>
    </span>
  );
}
