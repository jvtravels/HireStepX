/* Resume↔role domain match detector.
 *
 * Bug 4 (2026-05-14) — user-test session: resume showed a Senior Product
 * Designer, the target role was Java Developer. The recruiter never
 * probed why they were switching domains. A real recruiter would lead
 * with "your resume reads design — why are you pivoting to backend?".
 *
 * Three classifications:
 *   - "none"  — resume and target are aligned (react → react, ux → ux)
 *   - "soft"  — same broad domain, different specialty (backend → frontend, qa → sde)
 *   - "hard"  — cross-domain pivot (design → engineering, sales → eng,
 *               data → frontend, eng → product mgmt)
 *
 * Pure, no IO. */

export type ResumeRoleMismatchSeverity = "none" | "soft" | "hard";

export interface ResumeRoleMismatchResult {
  mismatch: boolean;
  severity: ResumeRoleMismatchSeverity;
  reason?: string;
}

type Domain =
  | "engineering-frontend"
  | "engineering-backend"
  | "engineering-fullstack"
  | "engineering-mobile"
  | "engineering-devops"
  | "engineering-embedded"
  | "design-ux"
  | "design-graphic"
  | "data-science"
  | "data-analytics"
  | "data-engineering"
  | "product-management"
  | "program-management"
  | "marketing"
  | "sales"
  | "qa-testing"
  | "support"
  | "hr"
  | "finance"
  | "operations"
  | "content"
  | "unknown";

function classifyDomain(title: string | null | undefined): Domain {
  if (!title) return "unknown";
  const r = title.toLowerCase();
  if (/(ux|ui|product\s+designer|interaction\s+designer|visual\s+designer)/.test(r)) return "design-ux";
  if (/(graphic\s+designer|illustrator|brand\s+designer)/.test(r)) return "design-graphic";
  if (/(front[\s-]?end|react|angular|vue|web\s+developer|frontend)/.test(r)) return "engineering-frontend";
  if (/(back[\s-]?end|java\s+developer|java\s+engineer|node|golang|python\s+dev|backend|spring|api\s+(?:dev|eng))/.test(r)) return "engineering-backend";
  if (/(full[\s-]?stack|mern|mean)/.test(r)) return "engineering-fullstack";
  if (/(android|ios|mobile|flutter|react\s+native)/.test(r)) return "engineering-mobile";
  if (/(devops|sre|site\s+reliability|platform\s+eng|infra(?:structure)?\s+(?:eng|dev))/.test(r)) return "engineering-devops";
  if (/(embedded|firmware|hardware\s+eng)/.test(r)) return "engineering-embedded";
  if (/(data\s+scientist|machine\s+learning|ml\s+engineer|ai\s+engineer|nlp)/.test(r)) return "data-science";
  if (/(data\s+analyst|business\s+analyst|ba\b|analytics)/.test(r)) return "data-analytics";
  if (/(data\s+engineer|etl|spark|hadoop)/.test(r)) return "data-engineering";
  if (/(product\s+manager|\bpm\b|product\s+owner|po\b)/.test(r)) return "product-management";
  if (/(program\s+manager|tpm|project\s+manager|delivery\s+manager)/.test(r)) return "program-management";
  if (/(marketing|growth|seo|content\s+marketing|digital\s+marketing)/.test(r)) return "marketing";
  if (/(sales|account\s+executive|bdm|business\s+development|relationship\s+manager)/.test(r)) return "sales";
  if (/(qa|tester|test\s+engineer|sdet|quality\s+assurance|automation\s+test)/.test(r)) return "qa-testing";
  if (/(support|customer\s+success|technical\s+support|cse)/.test(r)) return "support";
  if (/(\bhr\b|talent|recruiter|people\s+ops|human\s+resources)/.test(r)) return "hr";
  if (/(finance|accountant|controller|cfo|fp&a)/.test(r)) return "finance";
  if (/(operations|ops\s+manager|coo\b)/.test(r)) return "operations";
  if (/(content\s+writer|copywriter|editor|technical\s+writer)/.test(r)) return "content";
  return "unknown";
}

const ENGINEERING = new Set<Domain>([
  "engineering-frontend",
  "engineering-backend",
  "engineering-fullstack",
  "engineering-mobile",
  "engineering-devops",
  "engineering-embedded",
]);
const DESIGN = new Set<Domain>(["design-ux", "design-graphic"]);
const DATA = new Set<Domain>(["data-science", "data-analytics", "data-engineering"]);

function familyOf(d: Domain): string {
  if (ENGINEERING.has(d)) return "engineering";
  if (DESIGN.has(d)) return "design";
  if (DATA.has(d)) return "data";
  // QA shares the engineering family for mismatch purposes — QA → SDE is a
  // soft pivot (same domain), not a hard cross-domain switch.
  if (d === "qa-testing") return "engineering";
  return d;
}

export interface DetectResumeRoleMismatchInput {
  resumeTitle: string | null | undefined;
  targetRole: string | null | undefined;
}

/* Fix 1 (2026-05-15) — Role-source priority.
 *
 * Real session: user selected target role "Customer Success Manager at
 * Freshworks", resume showed "Senior Product Designer". The kernel
 * anchored "Senior Product Designer position" — resume title leaked
 * into the bot's address of the role. The fix: session-config-selected
 * role MUST take priority over resume title; resume title is only a
 * fallback when session config didn't supply one.
 *
 * Pure precedence helper:
 *   sessionConfig.targetRole > resume.title > defaultRole
 */
export interface SelectTargetRoleInput {
  sessionTargetRole?: string | null | undefined;
  resumeTitle?: string | null | undefined;
  defaultRole?: string | null | undefined;
}

function isUsefulString(v: string | null | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Choose the authoritative target role.
 *  Precedence: session config > resume title > default > "Software Engineer". */
export function selectTargetRole(input: SelectTargetRoleInput): string {
  if (isUsefulString(input.sessionTargetRole)) return input.sessionTargetRole.trim();
  if (isUsefulString(input.resumeTitle)) return input.resumeTitle.trim();
  if (isUsefulString(input.defaultRole)) return input.defaultRole.trim();
  return "Software Engineer";
}

export function detectResumeRoleMismatch(
  input: DetectResumeRoleMismatchInput,
): ResumeRoleMismatchResult {
  const a = classifyDomain(input.resumeTitle);
  const b = classifyDomain(input.targetRole);
  if (a === "unknown" || b === "unknown") return { mismatch: false, severity: "none" };
  if (a === b) return { mismatch: false, severity: "none" };
  const fa = familyOf(a);
  const fb = familyOf(b);
  if (fa === fb) {
    /* Same family, different specialty — soft mismatch (e.g. backend → frontend,
     * qa → sde-equivalent if both engineering). */
    return {
      mismatch: true,
      severity: "soft",
      reason: `${input.resumeTitle} → ${input.targetRole}: same domain family (${fa}), different specialty.`,
    };
  }
  return {
    mismatch: true,
    severity: "hard",
    reason: `${input.resumeTitle} → ${input.targetRole}: cross-domain pivot (${fa} → ${fb}).`,
  };
}

/* Fix 5 (2026-05-15) — Resume↔role mismatch probe-stage.
 *
 * Real session: resume domain "Senior Product Designer", target role
 * "Customer Success Manager". detectResumeRoleMismatch fired "hard" but
 * the brief block was informational only — the bot ignored it and
 * jumped straight into salary discussion.
 *
 * shouldEnterProbeMismatch returns true when the kernel should route
 * the FIRST substantive turn into a domain-switch probe rather than
 * the anchor turn. Pre-condition: a hard mismatch AND the recruiter
 * hasn't completed its first substantive turn yet.
 *
 * Pure. */
export function shouldEnterProbeMismatch(
  mismatch: ResumeRoleMismatchResult,
  turnsCompleted: number,
): boolean {
  if (!mismatch.mismatch) return false;
  if (mismatch.severity !== "hard") return false;
  return turnsCompleted < 1;
}
