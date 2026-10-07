"use client";

/* Shared search-with-icon input — the base input rendered by
   SearchWithSuggestions (recent-searches dropdown, used across the
   candidate dashboard) and used directly by the employer requirement
   detail candidates table, so every search box in the app looks the same.

   The clear (×) button uses the transitions.dev "input-clear-with-dissolve"
   pattern (https://transitions.dev/detail.html?t=input-clear-with-dissolve):
   the typed text flies down while it blurs + fades, a soft per-word glow
   streak ignites underneath it, and the placeholder falls in from above —
   instead of the text just vanishing. The streak's rise/peak/fall envelope
   and the per-word gradient stack can't be expressed as static @keyframes,
   so the animated phase runs as a single requestAnimationFrame loop writing
   styles directly to refs, same as the reference implementation; React only
   owns the resting (non-animating) state via the "has-value"/"is-clearing"
   classes below. */

import { useEffect, useRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { tokens as T } from "@/auth/_tokens";
import { Input } from "@/components/ui/input";

const CLEAR_DUR = 1000;
const OUT_DUR = 400;
const IN_DUR = 400;
const OUT_FLY = 12;
const IN_FLY = 12;
const BLUR_PX = 2;
const GLOW_DELAY = 50;
const GLOW_PEAK_AT = 0.15;
const GLOW_OPACITY = 0.42;
const GLOW_SPREAD = 1.5;

// cubic-bezier(0.22, 1, 0.36, 1) sampler, matched to the CSS ease used
// elsewhere for "settle" motion, so the JS-driven animation reads the same
// as a CSS transition would.
function makeBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  return (t: number) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let s = t;
    for (let i = 0; i < 8; i++) {
      const dx = ((ax * s + bx) * s + cx) * s - t;
      const d = (3 * ax * s + 2 * bx) * s + cx;
      if (Math.abs(dx) < 1e-6 || d === 0) break;
      s -= dx / d;
    }
    return ((ay * s + by) * s + cy) * s;
  };
}
const EASE = makeBezier(0.22, 1, 0.36, 1);

const STYLE = `
.hsx-clear { position: relative; }
.hsx-clear-mirror,
.hsx-clear-placeholder {
  position: absolute;
  top: 0; bottom: 0;
  display: flex;
  align-items: center;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  z-index: 2;
}
.hsx-clear-mirror { opacity: 0; }
.hsx-clear.has-value .hsx-clear-mirror,
.hsx-clear.is-clearing .hsx-clear-mirror { opacity: 1; }
.hsx-clear.has-value > input,
.hsx-clear.is-clearing > input { -webkit-text-fill-color: transparent; }
/* The fake placeholder only exists to animate the fall-in during a clear —
   the real <input placeholder> owns the resting empty state, so this stays
   invisible except while JS is actively driving it mid-animation. */
.hsx-clear-placeholder { opacity: 0; }
.hsx-clear-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
  z-index: 3;
  mix-blend-mode: multiply;
}
.hsx-clear-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: 4;
}
.hsx-clear.has-value .hsx-clear-btn { display: inline-flex; }
@media (prefers-reduced-motion: reduce) {
  .hsx-clear-glow { opacity: 0 !important; }
}
`;

export function SearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  style,
  inputStyle,
  inputClassName,
  onFocus,
  onBlur,
  onKeyDown,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  inputClassName?: string;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const clearingRef = useRef(false);

  // Mirror + wrapper class stay in sync with the live value whenever we're
  // not mid-clear — the animation routine below owns them exclusively while
  // a clear is in flight.
  useEffect(() => {
    if (clearingRef.current) return;
    const wrap = wrapRef.current, mirror = mirrorRef.current;
    if (!wrap || !mirror) return;
    wrap.classList.toggle("has-value", value.length > 0);
    if (value.length > 0) mirror.textContent = value.replace(/ /g, " ");
  }, [value]);

  const buildGlow = (text: string, input: HTMLInputElement, wrap: HTMLElement) => {
    if (!canvasCtxRef.current) canvasCtxRef.current = document.createElement("canvas").getContext("2d");
    const ctx = canvasCtxRef.current;
    if (!ctx) return "";
    ctx.font = getComputedStyle(input).font;
    const w = wrap.clientWidth || 280;
    const padLeft = parseFloat(getComputedStyle(input).paddingLeft) || 12;
    const layers: string[] = [];
    let x = 0;
    text.split(/(\s+)/).forEach((seg) => {
      const segW = ctx.measureText(seg).width;
      if (seg.trim()) {
        const cx = padLeft + x + segW / 2;
        const hw = Math.max(segW * 0.45, 8) * GLOW_SPREAD;
        ([[0, 0.8, 7, 0.22], [hw * 0.45, 0.55, 8, 0.18], [-hw * 0.4, 0.65, 6, 0.16], [hw * 0.15, 0.9, 5, 0.14]] as const)
          .forEach(([dx, rwm, rh, a]) => {
            const lx = (((cx + dx) / w) * 100).toFixed(2);
            layers.push(`radial-gradient(ellipse ${Math.max(hw * rwm, 2).toFixed(1)}px ${rh}px at ${lx}% 100%, rgba(0,0,0,${a}), transparent)`);
          });
      }
      x += segW;
    });
    return layers.join(", ");
  };

  const handleClear = () => {
    const wrap = wrapRef.current, input = wrap?.querySelector("input") ?? null, mirror = mirrorRef.current,
      phold = placeholderRef.current, glow = glowRef.current;
    if (!wrap || !input || !mirror || !phold || !glow || clearingRef.current || !value) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const keepFocus = document.activeElement === input;
    const text = value.replace(/ /g, " ");
    onChange("");
    if (reduced) {
      if (keepFocus) input.focus({ preventScroll: true });
      return;
    }

    clearingRef.current = true;
    mirror.textContent = text;
    wrap.classList.remove("has-value");
    wrap.classList.add("is-clearing");
    glow.style.background = buildGlow(text, input, wrap);
    glow.style.opacity = "0";
    phold.style.transform = `translateY(-${IN_FLY}px)`;
    phold.style.opacity = "0.9";
    phold.style.filter = `blur(${BLUR_PX}px)`;

    const t0 = performance.now();
    const tick = (now: number) => {
      const el = now - t0;
      const eo = EASE(Math.min(1, el / OUT_DUR));
      mirror.style.transform = `translateY(${(eo * OUT_FLY).toFixed(1)}px)`;
      mirror.style.opacity = (1 - eo).toFixed(3);
      mirror.style.filter = `blur(${(eo * BLUR_PX).toFixed(1)}px)`;

      const ei = EASE(Math.min(1, el / IN_DUR));
      phold.style.transform = `translateY(${(-IN_FLY + ei * IN_FLY).toFixed(1)}px)`;
      phold.style.opacity = (0.9 + ei * 0.1).toFixed(3);
      phold.style.filter = `blur(${(BLUR_PX - ei * BLUR_PX).toFixed(1)}px)`;

      let g = 0;
      if (el > GLOW_DELAY) {
        const gp = Math.min(1, (el - GLOW_DELAY) / Math.max(1, CLEAR_DUR - GLOW_DELAY));
        g = gp < GLOW_PEAK_AT ? gp / GLOW_PEAK_AT : 1 - (gp - GLOW_PEAK_AT) / (1 - GLOW_PEAK_AT);
      }
      glow.style.opacity = (g * GLOW_OPACITY).toFixed(3);

      if (el < CLEAR_DUR) {
        requestAnimationFrame(tick);
      } else {
        wrap.classList.remove("is-clearing");
        [mirror, phold].forEach((el2) => { el2.style.cssText = ""; });
        mirror.textContent = "";
        glow.style.opacity = "0";
        glow.style.background = "";
        clearingRef.current = false;
        if (keepFocus) requestAnimationFrame(() => input.focus({ preventScroll: true }));
      }
    };
    requestAnimationFrame(tick);
  };

  return (
    <div style={{ position: "relative", ...style }}>
      <style>{STYLE}</style>
      <label htmlFor={id} className="sr-only">{label}</label>
      <div ref={wrapRef} className="hsx-clear">
        <SearchIcon
          size={14}
          color={T.inkFaint}
          aria-hidden="true"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", zIndex: 4 }}
        />
        <Input
          id={id}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          className={inputClassName}
          style={{ paddingLeft: 34, paddingRight: 30, height: 36, width: "100%", ...inputStyle }}
        />
        <div ref={mirrorRef} aria-hidden="true" className="hsx-clear-mirror" style={{ left: 34, right: 30, color: T.coal, font: "inherit" }} />
        <div ref={placeholderRef} aria-hidden="true" className="hsx-clear-placeholder" style={{ left: 34, right: 30, color: T.inkFaint, font: "inherit" }}>
          {placeholder}
        </div>
        <div ref={glowRef} aria-hidden="true" className="hsx-clear-glow" />
        <button
          type="button"
          aria-label="Clear search"
          className="hsx-clear-btn"
          style={{ right: 8 }}
          onMouseDown={(e) => { if (document.activeElement === wrapRef.current?.querySelector("input")) e.preventDefault(); }}
          onClick={handleClear}
        >
          <XIcon size={13} color={T.inkFaint} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
