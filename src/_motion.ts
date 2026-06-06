/* HireStepX — Motion tokens.
 *
 * Single source of truth for durations + easings. Replaces the ad-hoc
 * 160 / 180 / 200 / 220 / 240 / 280 / 300ms transitions sprinkled
 * through Interview, SessionSetup, Dashboard, Onboarding. Before this
 * file existed the same hover intent shipped with five different
 * timings; pick from `dur` and `ease` by intent, not by feel.
 *
 * Usage:
 *   import { dur, ease } from "./_motion";
 *   transition: `transform ${dur.fast} ${ease.snap}`
 *
 * The canonical @keyframes (fadeUp / spin / slideUp / slideUpSheet /
 * recordPulse / blink / pulse) live in `src/index.css` — never re-
 * declare them in a component `<style>` block. Use the matching utility
 * class (.spinner-md, .pulse-dot-md, …) or `animation` shorthand
 * referencing the global keyframe by name.
 */

export const dur = {
  // 120ms — color/border swap on hover, tactile feedback
  instant: "120ms",
  // 160ms — primary button hover transform/shadow. Snappy default.
  fast: "160ms",
  // 220ms — card hover transform/shadow, larger affordances.
  medium: "220ms",
  // 300ms — entrance fades, toasts, dropdown reveals.
  slow: "300ms",
  // 500ms — featured card hover with multiple pseudo-elements.
  slower: "500ms",
} as const;

export const ease = {
  // cubic-bezier(.2,.7,.2,1) — snappy snap-into-place. Use for hover
  // transforms on buttons & cards where the feel should be tactile.
  snap: "cubic-bezier(0.2, 0.7, 0.2, 1)",
  // cubic-bezier(.16,1,.3,1) — entrance / reveal. Long tail, soft
  // settle. Use for slideUp/fadeUp on modals, sheets, page enter.
  enter: "cubic-bezier(0.16, 1, 0.3, 1)",
  // Plain ease-in-out — looping pulses (record indicator, breath).
  inOut: "ease-in-out",
  // Plain linear — spinners; anything else looks unnatural.
  linear: "linear",
} as const;

export type Duration = typeof dur[keyof typeof dur];
export type Easing = typeof ease[keyof typeof ease];
