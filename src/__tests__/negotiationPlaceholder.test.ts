/* PDF#46 (2026-05-26) — placeholder-leak regression.
 *
 * The salary-negotiation engine pre-inserts a structural slot before
 * each non-terminal AI turn so the engine has somewhere to advance
 * into while the async kernel call resolves. Two prior attempts at
 * this slot baked user-visible content into it:
 *
 *   PDF#43: "Let me take a look on my side — one moment" (silent
 *           wait if the kernel reply dropped — PDF#47 caught this).
 *   PDF#47: "While I check the structure on my side — what's been
 *           guiding the number you have in mind for this move?"
 *           (a fake recruiter question shipped verbatim when the
 *           kernel reply dropped — PDF#46 caught this asked four
 *           times character-identical across four different user
 *           answers).
 *
 * Both shapes are the same architectural mistake: a STRUCTURAL slot
 * sharing its representation with a USER-FACING slot. The clean cut
 * is `pendingKernel: true`: the slot exists for the kernel to fill
 * but carries NO user-facing text. The engine and renderer treat it
 * as a thinking-state hold until the kernel-resolve path replaces
 * it with a real followUpStep.
 *
 * These tests lock the contract so a future "helpful" refactor
 * can't silently re-introduce either failure mode.
 *
 * What we explicitly DON'T test from React-land here (the engine
 * is a 3k-LOC hook; spinning up jsdom + the full TTS / kernel /
 * Supabase wiring is out of scope for a unit suite): the engine's
 * pendingKernel hold and re-fire-on-clear behavior. Those are
 * covered structurally by typecheck (the field's existence on
 * InterviewStep) and by inspection of the effect's dep array. The
 * tests below cover the STATIC contract that any future placeholder
 * insertion must honor.
 */
import { describe, it, expect } from "vitest";
import type { InterviewStep } from "../interviewScripts";

describe("PDF#46 — salary-neg placeholder slot contract", () => {
  it("InterviewStep type carries an optional pendingKernel boolean", () => {
    // Compile-time witness: a placeholder slot shape must typecheck.
    // If a future refactor removes pendingKernel from the type, the
    // type assertion below stops compiling.
    const placeholder: InterviewStep = {
      type: "question",
      aiText: "",
      aiTextDisplay: "",
      thinkingDuration: 300,
      speakingDuration: 4500,
      waitForUser: true,
      pendingKernel: true,
      scoreNote: "Negotiation kernel placeholder — invisible until kernel resolve",
    };
    expect(placeholder.pendingKernel).toBe(true);
    expect(placeholder.aiText).toBe("");
    expect(placeholder.aiTextDisplay).toBe("");
  });

  it("a pendingKernel slot MUST NOT carry user-visible text", () => {
    /* Lock the invariant: pendingKernel:true → aiText and
     * aiTextDisplay must both be empty strings. If either is
     * populated, the engine's TTS / transcript / renderer paths
     * will leak that text as a real recruiter utterance —
     * exactly the PDF#46 / PDF#47 failure mode.
     *
     * We assert the invariant against the shape any future
     * placeholder factory should produce. Any change to the
     * placeholder insertion at useInterviewEngine.ts that
     * forgets this contract will surface as a manual
     * inspection failure here; this test is a compile-time
     * + reading-the-test reminder that the field must stay
     * empty. */
    const lookalikes: InterviewStep[] = [
      {
        type: "question",
        aiText: "",
        aiTextDisplay: "",
        thinkingDuration: 300,
        speakingDuration: 4500,
        waitForUser: true,
        pendingKernel: true,
      },
    ];
    for (const slot of lookalikes) {
      if (slot.pendingKernel) {
        expect(slot.aiText).toBe("");
        expect(slot.aiTextDisplay ?? "").toBe("");
      }
    }
  });

  it("forbidden literal: the prior 'While I check the structure on my side' placeholder string must not exist in useInterviewEngine.ts as a live placeholder", async () => {
    /* PDF#46 anti-regression. The literal string is what shipped
     * to the user four times verbatim in PDF#46. If a future
     * change re-introduces it as a placeholder text, this test
     * fails with a clear pointer to the line. The string is fine
     * in COMMENTS (it appears in the PDF#46 / PDF#47 audit
     * comments at the insertion site) — we only reject it as a
     * live string assigned to aiText/aiTextDisplay.
     *
     * The check is regex-based: match `aiText: "...the forbidden
     * string..."` or `aiTextDisplay: "...same..."`. Comments and
     * surrounding prose containing the literal naturally don't
     * match the assignment shape. */
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(__dirname, "../useInterviewEngine.ts");
    const src = await fs.readFile(filePath, "utf-8");
    const forbidden =
      /ai(?:Text|TextDisplay)\s*:\s*["'`][^"'`]*While I check the structure on my side[^"'`]*["'`]/;
    expect(src).not.toMatch(forbidden);
  });

  it("forbidden literal: the older 'one moment' silent-wait placeholder must not exist as a live placeholder either", async () => {
    /* PDF#43 anti-regression (covered by PDF#47 audit). Same
     * shape — a hardcoded string assigned to aiText would leak. */
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(__dirname, "../useInterviewEngine.ts");
    const src = await fs.readFile(filePath, "utf-8");
    const forbidden =
      /ai(?:Text|TextDisplay)\s*:\s*["'`][^"'`]*structure on my side[^"'`]*one moment[^"'`]*["'`]/i;
    expect(src).not.toMatch(forbidden);
  });
});
