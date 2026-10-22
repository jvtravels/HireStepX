import React, { useEffect, useRef, useState } from "react";

/* ─── Skeleton loader and reveal ─────────────────────────────────────────
 * Ported from the transitions.dev "skeleton-loader-and-reveal" pattern
 * (https://transitions.dev/detail.html?t=skeleton-loader-and-reveal):
 * the skeleton and the real content occupy the same slot and cross-fade
 * with a matching cross-blur when data arrives, instead of popping from
 * one to the other. Both layers stay mounted in a CSS grid stack (rather
 * than the spec's position:absolute) so the slot auto-sizes to whichever
 * layer is taller — real content here reflows (different session counts,
 * resume lengths, etc.), unlike the spec's fixed-size list rows/avatars.
 *
 * Reduced motion is handled globally — index.css forces every transition/
 * animation duration to 0.01ms under prefers-reduced-motion, so no local
 * guard is needed here. */
const REVEAL_DUR_MS = 400;
const REVEAL_BLUR_PX = 2;
const REVEAL_EASE = "ease-in-out";

export function SkeletonReveal({
  loading,
  skeleton,
  children,
  style,
  className,
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  const [revealed, setRevealed] = useState(!loading);
  const [instant, setInstant] = useState(false);
  const wasLoadingRef = useRef(loading);

  useEffect(() => {
    const was = wasLoadingRef.current;
    wasLoadingRef.current = loading;
    if (was && !loading) {
      setRevealed(true);
    } else if (!was && loading) {
      // A refetch snaps back to the skeleton with no animated reverse —
      // the pattern's `.is-resetting` replay behavior — then the next
      // load-finish cross-fades normally again.
      setInstant(true);
      setRevealed(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setInstant(false));
      });
    }
  }, [loading]);

  const transition = instant
    ? "none"
    : `opacity ${REVEAL_DUR_MS}ms ${REVEAL_EASE}, filter ${REVEAL_DUR_MS}ms ${REVEAL_EASE}`;

  return (
    <div className={className} style={{ display: "grid", gridTemplateRows: "1fr", ...style }}>
      <div
        aria-hidden={revealed}
        style={{
          gridArea: "1 / 1",
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          opacity: revealed ? 0 : 1,
          filter: `blur(${revealed ? REVEAL_BLUR_PX : 0}px)`,
          transition,
          pointerEvents: revealed ? "none" : "auto",
        }}
      >
        {skeleton}
      </div>
      <div
        aria-hidden={!revealed}
        style={{
          gridArea: "1 / 1",
          minHeight: 0,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          opacity: revealed ? 1 : 0,
          filter: `blur(${revealed ? 0 : REVEAL_BLUR_PX}px)`,
          transition,
          pointerEvents: revealed ? "auto" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
