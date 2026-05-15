/* Scenario-coverage gate — architectural bug-prevention (2026-05-15).
 *
 * Block PRs that touch `_negotiation-kernel.ts` or `_kernel-move-picker.ts`
 * without also touching `scenarios.test.ts`. The motivation: leaf-level
 * unit tests passed for months while orphan helpers
 * (lockAnchor / effectiveAnchorLpa / clampAnchorAgainstCandidateAsk /
 * buildPostAcceptanceMessage) sat un-wired. Scenario tests drive the
 * full kernel transition graph and are the only place the dead-wiring
 * class of bug surfaces.
 *
 * This gate runs at vitest time (no infra changes). It does:
 *   - resolve origin/main as the base ref
 *   - diff against HEAD
 *   - fail if kernel/move-picker is in the diff and scenarios.test.ts is not
 *
 * Gracefully skips when:
 *   - we're not in a git repo
 *   - origin/main is unreachable (offline CI, shallow clone)
 *   - HEAD == origin/main (running on main itself; no unmerged diff to gate)
 *   - the diff comes back empty (a no-op rebase / squashed history situation)
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { join } from "path";

const REPO_ROOT = join(__dirname, "..", "..");

function git(args: string[]): { ok: boolean; stdout: string } {
  const res = spawnSync("git", args, { encoding: "utf8", cwd: REPO_ROOT });
  if (res.status !== 0 || res.error) return { ok: false, stdout: res.stdout || "" };
  return { ok: true, stdout: res.stdout || "" };
}

describe("scenario-coverage gate", () => {
  it("changes to kernel/move-picker also touch scenarios.test.ts", () => {
    /* Skip when no git available — keep the test green in stripped CI. */
    const v = git(["--version"]);
    if (!v.ok) {
      console.warn("[scenarioCoverageGate] git unavailable — skipping");
      return;
    }
    /* Skip when not in a git repo (rev-parse fails). */
    const inside = git(["rev-parse", "--is-inside-work-tree"]);
    if (!inside.ok || inside.stdout.trim() !== "true") {
      console.warn("[scenarioCoverageGate] not in a git work tree — skipping");
      return;
    }
    /* Skip when origin/main is unreachable. */
    const baseRef = "origin/main";
    const refCheck = git(["rev-parse", "--verify", baseRef]);
    if (!refCheck.ok) {
      console.warn(`[scenarioCoverageGate] ${baseRef} unreachable — skipping`);
      return;
    }
    /* Skip when the current branch IS main / master. The gate is a
     * pre-merge check for feature branches; on the trunk itself there's
     * no "did this PR forget scenarios?" question to ask. Without this
     * skip, a series of commits made directly to main (between two
     * pushes to origin/main) would trip the gate on every intermediate
     * commit. */
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim();
    if (branch === "main" || branch === "master" || branch === "HEAD") {
      return;
    }
    /* Skip when HEAD == origin/main (running on main itself; no
     * unmerged diff to gate). */
    const headSha = git(["rev-parse", "HEAD"]).stdout.trim();
    const baseSha = refCheck.stdout.trim();
    if (headSha === baseSha) {
      return;
    }
    /* Use the merge-base (origin/main...HEAD) to mirror what GitHub PR
     * diffs show; falls back to plain diff if merge-base fails. */
    const diff = git(["diff", "--name-only", `${baseRef}...HEAD`]);
    if (!diff.ok) {
      console.warn(`[scenarioCoverageGate] git diff failed — skipping`);
      return;
    }
    const files = diff.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
    if (files.length === 0) return;
    const touchedKernel = files.some(
      (f) =>
        f.endsWith("server-handlers/_negotiation-kernel.ts") ||
        f.endsWith("server-handlers/_kernel-move-picker.ts"),
    );
    const touchedScenarios = files.some((f) =>
      f.endsWith("src/__tests__/integration/scenarios.test.ts"),
    );
    if (touchedKernel && !touchedScenarios) {
      throw new Error(
        `Kernel touched without scenario coverage. Files in diff:\n` +
          files.map((f) => `  - ${f}`).join("\n") +
          `\n\nAdd a scenario test to src/__tests__/integration/scenarios.test.ts ` +
          `or document why this change can't be scenario-tested.`,
      );
    }
    expect(true).toBe(true);
  });
});
