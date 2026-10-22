"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

const DURATION_MS = 700;

/** Counts from the previously shown value to `value`; the first render counts up from 0. */
export default function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const shown = useRef(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      shown.current = value;
      setDisplay(value);
      return;
    }
    const from = shown.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      shown.current = Math.round(from + (value - from) * eased);
      setDisplay(shown.current);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduceMotion]);

  return (
    <>
      <span aria-hidden="true" className="tabular-nums">{display}{suffix}</span>
      <span className="sr-only">{value}{suffix}</span>
    </>
  );
}
