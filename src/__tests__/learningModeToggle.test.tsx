/* Learning Mode toggle + move-tag chip — UI contract tests
 * (Dim 14 in-flow transparency, AP3 / 2026-05-17).
 *
 * Covers the eight client-side acceptance criteria called out in the
 * AP3 brief — default-off behaviour, localStorage persistence, family
 * iconography, hint reveal, backward compatibility for missing
 * moveTag, focus-gated visibility, ARIA contract, and keyboard
 * activation.
 *
 * Why a dedicated harness instead of mounting <Interview/>:
 *   The Interview surface drags in TTS, mic, video, supabase, posthog,
 *   the engine refs and a router — every dependency would need to be
 *   stubbed to test a two-component contract. The components under
 *   test (LearningModeToggle, MoveTagChip, useLearningMode) are
 *   pure-presentational + a localStorage hook; testing them in
 *   isolation matches their actual surface area. The wiring INTO
 *   Interview.tsx is asserted by a source-level check at the bottom.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEARNING_MODE_KEY,
  LearningModeToggle,
  MoveTagChip,
  useLearningMode,
  type MoveTag,
} from "../LearningModeUI";

/** Tiny wrapper that exposes the hook + components together so a single
 *  render can exercise the persisted-state contract end-to-end. */
function Harness({
  visible = true,
  tag,
  initialTag,
}: {
  visible?: boolean;
  tag?: MoveTag | null;
  initialTag?: MoveTag;
}) {
  const [enabled, setEnabled] = useLearningMode();
  const [currentTag] = useState<MoveTag | undefined | null>(tag ?? initialTag);
  return (
    <div>
      <LearningModeToggle visible={visible} enabled={enabled} onChange={setEnabled} />
      <MoveTagChip tag={currentTag} enabled={enabled} />
    </div>
  );
}

/* jsdom in this repo is run with the harness's `--localstorage-file`
 * flag which leaves `window.localStorage` partially shimmed (no .clear).
 * Match the pattern used by interviewAPI.test.ts: stub a minimal,
 * spec-compliant in-memory store when the runtime's surface is
 * incomplete. */
const memStore: Record<string, string> = {};
const memLocalStorage = {
  getItem: (key: string) => memStore[key] ?? null,
  setItem: (key: string, value: string) => { memStore[key] = value; },
  removeItem: (key: string) => { delete memStore[key]; },
  clear: () => { Object.keys(memStore).forEach((k) => delete memStore[k]); },
  get length() { return Object.keys(memStore).length; },
  key: (i: number) => Object.keys(memStore)[i] ?? null,
};
try {
  if (typeof localStorage === "undefined" || typeof localStorage.clear !== "function") {
    vi.stubGlobal("localStorage", memLocalStorage);
  }
} catch {
  vi.stubGlobal("localStorage", memLocalStorage);
}

const SAMPLE_TAG: MoveTag = {
  label: "Anchoring you to a number",
  hint: "Real Indian HR opens with a single offer number — treat it as a floor, not a ceiling.",
  family: "anchor",
};

describe("Learning Mode — toggle + move-tag chip", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /* ─ 1. Default off ─────────────────────────────────────────────── */
  it("defaults to off (no localStorage) → renders no chip", () => {
    render(<Harness tag={SAMPLE_TAG} />);
    const toggle = screen.getByTestId("learning-mode-toggle");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(screen.queryByTestId("move-tag-chip")).toBeNull();
    /* No reserved space — the chip wrapper renders nothing too. */
    expect(screen.queryByTestId("move-tag-chip-wrap")).toBeNull();
  });

  /* ─ 2. Toggle on → localStorage written → chip renders ─────────── */
  it("toggling on writes localStorage and renders the chip with label", () => {
    render(<Harness tag={SAMPLE_TAG} />);
    const toggle = screen.getByTestId("learning-mode-toggle");
    act(() => { fireEvent.click(toggle); });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(localStorage.getItem(LEARNING_MODE_KEY)).toBe("true");
    const chip = screen.getByTestId("move-tag-chip");
    expect(chip.textContent).toContain(SAMPLE_TAG.label);
  });

  /* ─ 3. Family icon ─────────────────────────────────────────────── */
  it("chip carries the correct family for icon selection", () => {
    localStorage.setItem(LEARNING_MODE_KEY, "true");
    render(<Harness tag={SAMPLE_TAG} />);
    const chip = screen.getByTestId("move-tag-chip");
    expect(chip.getAttribute("data-family")).toBe("anchor");
    /* The icon switch uses data-icon as a stable handle so each family
     * maps to the spec'd lucide-equivalent glyph. */
    const icon = chip.querySelector("svg[data-icon]");
    expect(icon).not.toBeNull();
    expect(icon!.getAttribute("data-icon")).toBe("anchor");
  });

  it("each family maps to the spec'd icon", () => {
    localStorage.setItem(LEARNING_MODE_KEY, "true");
    const families: Array<[MoveTag["family"], string]> = [
      ["discovery", "search"],
      ["anchor", "anchor"],
      ["defense", "shield"],
      ["counter", "scale"],
      ["stall", "clock"],
      ["close", "check-circle"],
      ["terminal", "door-open"],
      ["meta", "sparkles"],
    ];
    for (const [family, icon] of families) {
      const { unmount } = render(
        <Harness tag={{ label: "x", hint: "y", family }} />,
      );
      const chipIcon = screen.getByTestId("move-tag-chip").querySelector("svg[data-icon]");
      expect(chipIcon?.getAttribute("data-icon")).toBe(icon);
      unmount();
    }
  });

  /* ─ 4. Hint reveal ─────────────────────────────────────────────── */
  it("hint reveals on hover and on click (mobile)", () => {
    localStorage.setItem(LEARNING_MODE_KEY, "true");
    render(<Harness tag={SAMPLE_TAG} />);
    const chip = screen.getByTestId("move-tag-chip");
    /* Not expanded by default. */
    expect(screen.queryByTestId("move-tag-chip-hint")).toBeNull();
    /* Hover reveals. */
    act(() => { fireEvent.mouseEnter(chip); });
    const hint = screen.getByTestId("move-tag-chip-hint");
    expect(hint.textContent).toContain(SAMPLE_TAG.hint);
    /* Always available via the native title attribute (works on touch
     * devices via long-press, per the brief). */
    expect(chip.getAttribute("title")).toBe(SAMPLE_TAG.hint);
  });

  it("hint reveals on click for keyboard / touch users without hover", () => {
    localStorage.setItem(LEARNING_MODE_KEY, "true");
    render(<Harness tag={SAMPLE_TAG} />);
    const chip = screen.getByTestId("move-tag-chip");
    act(() => { fireEvent.click(chip); });
    expect(screen.getByTestId("move-tag-chip-hint")).toBeTruthy();
    expect(chip.getAttribute("aria-expanded")).toBe("true");
  });

  /* ─ 5. Backward compatibility — missing moveTag ────────────────── */
  it("turn record without moveTag → no chip, no crash, no warning", () => {
    localStorage.setItem(LEARNING_MODE_KEY, "true");
    render(<Harness tag={undefined} />);
    /* Toggle still renders ON. */
    expect(screen.getByTestId("learning-mode-toggle").getAttribute("aria-checked")).toBe("true");
    /* Chip silently absent. */
    expect(screen.queryByTestId("move-tag-chip")).toBeNull();
    expect(screen.queryByTestId("move-tag-chip-wrap")).toBeNull();
  });

  it("null moveTag (defensive) renders nothing", () => {
    localStorage.setItem(LEARNING_MODE_KEY, "true");
    render(<Harness tag={null} />);
    expect(screen.queryByTestId("move-tag-chip")).toBeNull();
  });

  /* ─ 6. Hidden on non-salary-negotiation focuses ────────────────── */
  it("toggle hidden when focus ≠ salary-negotiation (visible=false)", () => {
    localStorage.setItem(LEARNING_MODE_KEY, "true");
    render(<Harness visible={false} tag={SAMPLE_TAG} />);
    expect(screen.queryByTestId("learning-mode-toggle")).toBeNull();
  });

  /* ─ 7. ARIA contract ───────────────────────────────────────────── */
  it("toggle has role=switch and aria-checked tracks state", () => {
    render(<Harness tag={SAMPLE_TAG} />);
    const toggle = screen.getByTestId("learning-mode-toggle");
    expect(toggle.getAttribute("role")).toBe("switch");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    act(() => { fireEvent.click(toggle); });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    act(() => { fireEvent.click(toggle); });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  /* ─ 8. Keyboard activation ─────────────────────────────────────── */
  it("Space and Enter activate the toggle", () => {
    render(<Harness tag={SAMPLE_TAG} />);
    const toggle = screen.getByTestId("learning-mode-toggle");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    act(() => { fireEvent.keyDown(toggle, { key: " " }); });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    act(() => { fireEvent.keyDown(toggle, { key: "Enter" }); });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });
});

/* ─ Source-level wiring check ──────────────────────────────────────
 * Mounting <Interview/> would drag in router + tts + supabase + posthog
 * — see harness rationale above. Instead, assert at the source level
 * that the Interview component (a) imports the Learning-Mode surfaces,
 * (b) gates the toggle on isSalaryNegotiation, and (c) renders the
 * chip with step.moveTag. This locks the wiring without owning every
 * downstream stub. */
const INTERVIEW_SRC = readFileSync(
  join(__dirname, "..", "Interview.tsx"),
  "utf-8",
);

describe("Interview.tsx — Learning-Mode wiring", () => {
  it("imports the Learning-Mode UI surface", () => {
    expect(INTERVIEW_SRC).toMatch(/from\s+["']\.\/LearningModeUI["']/);
    expect(INTERVIEW_SRC).toMatch(/LearningModeToggle/);
    expect(INTERVIEW_SRC).toMatch(/MoveTagChip/);
    expect(INTERVIEW_SRC).toMatch(/useLearningMode/);
  });

  it("renders the toggle gated on isSalaryNegotiation", () => {
    /* Stable structure: the JSX explicitly passes
     * visible={isSalaryNegotiation} so non-salary focuses can never
     * see the toggle. */
    expect(INTERVIEW_SRC).toMatch(/<LearningModeToggle[\s\S]*?visible=\{isSalaryNegotiation\}/);
  });

  it("renders MoveTagChip with the per-step moveTag", () => {
    expect(INTERVIEW_SRC).toMatch(/<MoveTagChip\s+tag=\{step\.moveTag\}\s+enabled=\{learningMode\}/);
  });
});
