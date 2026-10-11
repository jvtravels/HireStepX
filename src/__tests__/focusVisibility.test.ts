import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");

// Editable controls in these files must not carry an inline `outline: "none"`:
// an inline style beats the global :focus-visible ring in index.css, leaving
// keyboard users with no focus indicator (WCAG 2.4.7). Fields that deliberately
// swap the border/ring on focus (SessionSetup, auth/_fields, DashboardCalendar)
// are intentionally not listed.
const MUST_NOT_SUPPRESS_OUTLINE = [
  "src/InterviewPanels.tsx",
  "src/InterviewNegotiationPanels.tsx",
  "src/settingsSections.tsx",
  "src/AdminDashboard.tsx",
  "src/AdminUnlockPanel.tsx",
  "src/SessionDetailPanels.tsx",
  "src/sessionReport/panels/sr-ScheduleNextSection.tsx",
  "src/components/interview/Composer.tsx",
  "src/onboarding/Panels.tsx",
  "app/admin-login/page.tsx",
];

describe("keyboard focus visibility", () => {
  it.each(MUST_NOT_SUPPRESS_OUTLINE)("%s keeps the global focus ring", (file) => {
    const src = readFileSync(join(root, file), "utf8");
    expect(src).not.toMatch(/outline:\s*["']none["']/);
  });
});
