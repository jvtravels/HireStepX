"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/* Mounts <video> only once the wrapping section nears the viewport, so the
   25MB CTA video isn't fetched on every page load (DarkBand is the last
   section on every question/company/salary page). Split into its own
   client component so the rest of _editorial.tsx can stay server-rendered. */
export function LazyBandVideo({ src, style }: { src: string; style: CSSProperties }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setNearViewport(true); obs.disconnect(); } },
      { rootMargin: "400px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={sectionRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {nearViewport && (
        <video aria-hidden autoPlay loop muted playsInline preload="none" style={style}>
          <source src={src} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
