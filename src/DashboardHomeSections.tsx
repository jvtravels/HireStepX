"use client";

/* Section components for the candidate dashboard home (DashboardHome.tsx),
   implementing the locked "Candidates Dashboard" Figma — a flat black/
   white/gray layout, a stark departure from the legacy indigo/copper
   theme. Kept in a companion file so DashboardHome.tsx (already near the
   1500-LOC ESLint warning threshold) stays focused on data wiring and
   orchestration; these are presentational, driven entirely by props. */

import { tokens as t, fonts as f, textSize } from "./auth/_tokens";
import type { PracticeCoverage, EvidenceCapability } from "./dashboardData";
import { skillLabel } from "./skillCopy";
import { hoursOrDaysAgo } from "./hiringMatchFormat";
import { useHiringActivity } from "./useHiringActivity";
import { Button } from "@/components/ui/button";

/* ─── shared bits ─── */

function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}
      style={{ height: 6, borderRadius: 999, background: t.line, overflow: "hidden" }}
    >
      <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
    </div>
  );
}

function Tag({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "error" | "success" | "indigo" }) {
  const palette = {
    neutral: { bg: t.creamSoft, fg: t.inkSoft },
    error: { bg: t.error100, fg: t.error },
    success: { bg: t.success100, fg: t.success },
    indigo: { bg: t.indigo100, fg: t.indigo },
  }[tone];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600,
      color: palette.fg, background: palette.bg,
      padding: "3px 9px", borderRadius: 999,
    }}>{label}</span>
  );
}

function StatCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      flex: "1 1 220px", minWidth: 220, padding: "18px",
      background: t.cream, border: `1px solid ${t.line}`, borderRadius: 12,
      display: "flex", flexDirection: "column", gap: 10,
    }}>{children}</div>
  );
}

/* ─── Header ─── */

export function DashboardHeader({
  displayName, hasData, targetRole, seniorityLevel, readinessGap,
  nearestEvent, hasGoogleToken, googleSyncStatus, onConnectCalendar,
}: {
  displayName: string;
  hasData: boolean;
  targetRole: string;
  seniorityLevel: string | null;
  readinessGap: number;
  nearestEvent: { date: string; time: string } | null;
  hasGoogleToken: boolean;
  googleSyncStatus: "idle" | "syncing" | "done" | "error";
  onConnectCalendar: () => void;
}) {
  const roleLabel = targetRole || "your target role";
  const seniorityPrefix = seniorityLevel ? `${seniorityLevel} ` : "";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
          <h1 style={{ fontFamily: f.sans, fontSize: textSize["3xl"], fontWeight: 700, color: t.coal, margin: 0, letterSpacing: "-0.01em" }}>
            {hasData ? "Welcome Back" : "Welcome"}, {displayName}
          </h1>
          {targetRole && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.indigo,
              background: t.indigo100, padding: "4px 11px", borderRadius: 999,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.indigo, flexShrink: 0 }} aria-hidden />
              {targetRole}
            </span>
          )}
        </div>
        <p style={{ fontFamily: f.sans, fontSize: textSize.md, color: t.inkSoft, margin: 0 }}>
          {readinessGap > 0
            ? `You're ${readinessGap} points away from your ${seniorityPrefix}${roleLabel} readiness target.`
            : `You've hit your ${seniorityPrefix}${roleLabel} readiness target. Keep practicing to stay sharp.`}
        </p>
      </div>

      {hasData && nearestEvent ? (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
          padding: "10px 16px", borderRadius: 999,
          background: t.creamSoft, border: `1px solid ${t.line}`,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.coal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.coal, fontWeight: 600 }}>
            Upcoming Interview: {formatEventDateShort(nearestEvent.date)}, {nearestEvent.time}
          </span>
        </div>
      ) : (
        <Button
          type="button"
          size="cta"
          onClick={onConnectCalendar}
          disabled={googleSyncStatus === "syncing" || hasGoogleToken}
          style={{ flexShrink: 0, fontFamily: f.sans }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {googleSyncStatus === "syncing" ? "Connecting…" : hasGoogleToken ? "Calendar Connected" : "Connect the Calendar"}
        </Button>
      )}
    </div>
  );
}

function formatEventDateShort(date: string): string {
  return new Date(date + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

/* ─── 4-card stat row ─── */

export function StatCardsRow({
  hasData, readinessScore, readinessDelta, resumeScore, improvementsCount,
  practiceCoverage, onViewResume, onViewJobs,
}: {
  hasData: boolean;
  readinessScore: number;
  readinessDelta: number | null;
  resumeScore: number | null;
  improvementsCount: number;
  practiceCoverage: PracticeCoverage;
  onViewResume: () => void;
  onViewJobs: () => void;
}) {
  const hiring = useHiringActivity();
  const unlockedCount = hiring?.unlockedCount ?? 0;
  const latestMatch = hiring?.recent?.[0] ?? null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
      <StatCard>
        <div style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, fontWeight: 600 }}>Interview Readiness</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: f.sans, fontSize: textSize["2xl"], fontWeight: 700, color: t.coal }}>{hasData ? readinessScore : 0}</span>
          <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint }}>/ 100</span>
          {readinessDelta != null && readinessDelta !== 0 && (
            <Tag tone={readinessDelta > 0 ? "success" : "error"} label={`${readinessDelta > 0 ? "+" : ""}${readinessDelta}`} />
          )}
        </div>
        <ProgressBar value={hasData ? readinessScore : 0} color={t.coal} />
      </StatCard>

      <StatCard>
        <div style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, fontWeight: 600 }}>Resume Strength</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: f.sans, fontSize: textSize["2xl"], fontWeight: 700, color: t.coal }}>{resumeScore ?? 0}</span>
          <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint }}>/ 100</span>
          {improvementsCount > 0 && <Tag label={`${improvementsCount} to improve`} />}
        </div>
        <ProgressBar value={resumeScore ?? 0} color={t.coal} />
        <Button type="button" variant="ghost" onClick={onViewResume} style={{
          alignSelf: "flex-start", background: "none", border: "none", padding: 0, height: "auto", cursor: "pointer",
          fontFamily: f.sans, fontSize: textSize.sm, fontWeight: 600, color: t.indigo,
        }}>View Details →</Button>
      </StatCard>

      <StatCard>
        <div style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, fontWeight: 600 }}>Practice Coverage</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontFamily: f.sans, fontSize: textSize["2xl"], fontWeight: 700, color: t.coal }}>
            {practiceCoverage.practicedCount}/{practiceCoverage.totalAreas}
          </span>
          <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint }}>areas</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: practiceCoverage.totalAreas }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 6, borderRadius: 999,
              background: i < practiceCoverage.practicedCount ? t.coal : t.line,
            }} />
          ))}
        </div>
        {practiceCoverage.biggestGapLabel && <Tag tone="error" label={`Biggest Gap: ${practiceCoverage.biggestGapLabel}`} />}
      </StatCard>

      <StatCard>
        <div style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, fontWeight: 600 }}>Needs Attention</div>
        <Button type="button" variant="ghost" onClick={onViewJobs} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", height: "auto",
          background: "none", border: "none", padding: 0, cursor: unlockedCount > 0 ? "pointer" : "default", textAlign: "left",
        }}>
          <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.coal, fontWeight: 600 }}>
            {unlockedCount} Employer{unlockedCount === 1 ? "" : "s"} Interested
          </span>
          {unlockedCount > 0 && <span aria-hidden style={{ color: t.inkFaint }}>→</span>}
        </Button>
        {latestMatch && (
          <div style={{ fontFamily: f.sans, fontSize: textSize.xs, color: t.inkFaint }}>
            {latestMatch.companyName} · {hoursOrDaysAgo(latestMatch.matchedAt)}
          </div>
        )}
        <Button type="button" variant="ghost" onClick={onViewResume} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", height: "auto",
          background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", borderRadius: 0,
          borderTop: `1px solid ${t.line}`, paddingTop: 8, marginTop: 2,
        }}>
          <span style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.coal, fontWeight: 600 }}>
            Resume Improvement {improvementsCount > 0 ? `(${improvementsCount})` : ""}
          </span>
          <span aria-hidden style={{ color: t.inkFaint }}>→</span>
        </Button>
      </StatCard>
    </div>
  );
}

/* ─── Your Next Move / Your First Step ─── */

const NEXT_MOVE_COPY: Record<string, { description: string; tags: [string, string, string] }> = {
  communication: {
    description: "Clear, confident communication is the fastest lever for your overall score. This session drills the fundamentals.",
    tags: ["Clearer answer structure", "Relevant examples", "Stronger delivery"],
  },
  structure: {
    description: "A well-structured answer is easier to follow and score. This session drills organizing your response before you speak.",
    tags: ["Situation → Result flow", "Shorter setup", "Clear takeaway"],
  },
  technicalDepth: {
    description: "Real technical depth separates a good answer from a great one. This session drills going past the surface level.",
    tags: ["Specific tools used", "Trade-offs explained", "Concrete outcomes"],
  },
  leadership: {
    description: "Owning the work as a leader is what interviewers listen for. This session drills showing ownership, not just participation.",
    tags: ["Ownership language", "Decision rationale", "Team impact"],
  },
  problemSolving: {
    description: "Breaking a problem down step by step shows how you think, not just what you did. This session drills that structure.",
    tags: ["Problem framing", "Step-by-step logic", "Verified outcome"],
  },
  confidence: {
    description: "Sounding certain changes how an answer is received, even when the content is the same. This session drills delivery.",
    tags: ["Fewer hedges", "Steady pacing", "Direct statements"],
  },
  specificity: {
    description: "Numbers and specifics make a claim credible. This session drills backing up every answer with real detail.",
    tags: ["Quantified results", "Named tools/metrics", "Concrete examples"],
  },
  adaptability: {
    description: "Pivoting cleanly when a follow-up catches you off guard shows real command of the material. This session drills staying flexible under pressure.",
    tags: ["Handles follow-ups", "Flexible framing", "No rigid scripts"],
  },
  businessImpact: {
    description: "Tying your work to revenue, efficiency, or growth turns a feature story into a business story. This session drills that connection.",
    tags: ["Revenue/efficiency framing", "Quantified outcomes", "Business-first narrative"],
  },
  answerCompleteness: {
    description: "Leaving part of a multi-part question unanswered costs easy points. This session drills covering every angle asked.",
    tags: ["Full question coverage", "No dropped sub-asks", "Structured completeness"],
  },
  anchoring: {
    description: "Anchoring the number first sets the frame for the entire negotiation. This session drills opening with confidence.",
    tags: ["Opening with a number", "Market-rate framing", "Holding your position"],
  },
  packageThinking: {
    description: "Looking beyond base salary unlocks real negotiation leverage. This session drills thinking in total compensation.",
    tags: ["Equity & bonus asks", "Benefits negotiation", "Total comp framing"],
  },
  leverageUse: {
    description: "Building leverage before you ask changes the entire conversation. This session drills surfacing your strongest cards.",
    tags: ["Competing offers", "Market data citing", "Timing your ask"],
  },
  concessionStrategy: {
    description: "Trading concessions instead of just giving them protects your position. This session drills give-to-get negotiation.",
    tags: ["Trade, don't cave", "Conditional offers", "Protecting your floor"],
  },
  closingTechnique: {
    description: "A clear written summary at the close avoids ambiguity later. This session drills closing the loop properly.",
    tags: ["Written summary", "Next-step clarity", "Confirming terms"],
  },
  composure: {
    description: "Staying composed under pressure is itself a signal to the other side. This session drills holding steady when pushed.",
    tags: ["Measured pace", "No over-explaining", "Calm pushback"],
  },
  professionalTone: {
    description: "A professional, collaborative tone keeps negotiation productive instead of adversarial. This session drills that balance.",
    tags: ["Collaborative framing", "Firm but polite", "No ultimatums"],
  },
  empathy: {
    description: "Leading with user empathy shows you understand who you're building for. This session drills grounding answers in the user.",
    tags: ["User-first framing", "Named pain points", "Evidence of research"],
  },
  metricsLiteracy: {
    description: "Picking the right success metric shows product judgment. This session drills reasoning with the metrics that matter.",
    tags: ["Right north star", "Trade-off awareness", "Data-backed calls"],
  },
  prioritization: {
    description: "Being clear about trade-offs is what separates prioritization from just listing ideas. This session drills that clarity.",
    tags: ["Named trade-offs", "Clear rationale", "Decisive calls"],
  },
  productSense: {
    description: "Sharp product instincts show up in how you reason, not just what you ship. This session drills that reasoning.",
    tags: ["User + business lens", "Clear hypotheses", "Grounded judgment"],
  },
  systemThinking: {
    description: "Thinking in systems instead of features shows you can scale a solution. This session drills that broader lens.",
    tags: ["Component breakdown", "Scaling considerations", "Edge-case awareness"],
  },
  starStructure: {
    description: "Hitting every STAR beat cleanly keeps your answers complete and easy to score. This session drills the full structure.",
    tags: ["Situation → Task", "Action in detail", "Quantified result"],
  },
};

export function NextMoveCard({ isFirstTimer, weakestSkillKey, ctaLabel, onStart, sessionMinutes, sessionQuestionCount, chips }: {
  isFirstTimer: boolean;
  weakestSkillKey: string | null;
  ctaLabel: string;
  onStart: () => void;
  /** Real minutes + question count for the session this CTA launches
   *  (data/session-length.ts via nextMove.ts) — not a guessed placeholder. */
  sessionMinutes: number;
  sessionQuestionCount: number;
  /** Streak / smart-schedule context chips from nextMove.ts — optional,
   *  omitted entirely (not even an empty row) when there's nothing to show. */
  chips?: { kind: "streak" | "schedule"; label: string }[];
}) {
  const key = weakestSkillKey && NEXT_MOVE_COPY[weakestSkillKey] ? weakestSkillKey : "communication";
  const copy = NEXT_MOVE_COPY[key];
  const title = `Practice ${skillLabel(key)}`;

  return (
    <section aria-labelledby="dh-next-heading" style={{
      padding: "24px", borderRadius: 14, background: t.cream, border: `1px solid ${t.line}`,
      display: "flex", flexDirection: "column", gap: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.coal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
          <span style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 700, color: t.coal }}>
            {isFirstTimer ? "Your First Step" : "Your Next Move"}
          </span>
        </div>
        <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkFaint }}>
          ~{sessionMinutes} min · {sessionQuestionCount} questions
        </span>
      </div>
      <h2 id="dh-next-heading" style={{ fontFamily: f.sans, fontSize: textSize["2xl"], fontWeight: 700, color: t.coal, margin: 0 }}>
        {title}
      </h2>
      <p style={{ fontFamily: f.sans, fontSize: textSize.base, color: t.inkSoft, margin: 0, lineHeight: 1.55 }}>
        {copy.description}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {chips?.map((c) => (
          <Tag key={c.label} label={c.label} tone={c.kind === "streak" ? "indigo" : "neutral"} />
        ))}
        {copy.tags.map((tag) => <Tag key={tag} label={tag} />)}
      </div>
      <Button
        type="button"
        size="cta"
        onClick={onStart}
        style={{ marginTop: 4, width: "100%", fontFamily: f.sans }}
      >
        {ctaLabel} →
      </Button>
    </section>
  );
}

/* ─── Practice Activity (full-data only) ─── */

export function PracticeActivityCard({ sessionsCompleted, hoursLogged, questionsAnswered }: {
  sessionsCompleted: number; hoursLogged: number; questionsAnswered: number;
}) {
  const subStats = [
    { label: "Total Practice Time", value: `${hoursLogged}h` },
    { label: "Questions Answered", value: questionsAnswered },
  ];
  return (
    <section aria-labelledby="dh-activity-heading" style={{
      padding: "24px", borderRadius: 14, background: t.cream, border: `1px solid ${t.line}`,
      display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={t.coal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="M18 17V9" />
          <path d="M13 17V5" />
          <path d="M8 17v-3" />
        </svg>
        <h2 id="dh-activity-heading" style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 700, color: t.coal, margin: 0 }}>
          Practice Activity
        </h2>
      </div>
      <div style={{
        padding: "16px", borderRadius: 10, background: t.creamSoft, border: `1px solid ${t.line}`,
        textAlign: "center",
      }}>
        <div style={{ fontFamily: f.sans, fontSize: textSize["2xl"], fontWeight: 700, color: t.coal }}>{sessionsCompleted}</div>
        <div style={{ fontFamily: f.sans, fontSize: textSize.xs, color: t.inkSoft, marginTop: 4 }}>Total Sessions</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {subStats.map((s) => (
          <div key={s.label} style={{
            padding: "14px", borderRadius: 10, background: t.creamSoft, border: `1px solid ${t.line}`,
            textAlign: "center",
          }}>
            <div style={{ fontFamily: f.sans, fontSize: textSize.xl, fontWeight: 700, color: t.coal }}>{s.value}</div>
            <div style={{ fontFamily: f.sans, fontSize: textSize.xs, color: t.inkSoft, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Evidence Capabilities (full-data only) ─── */

export function EvidenceCapabilitiesCard({ capabilities }: { capabilities: EvidenceCapability[] }) {
  const verifiedCount = capabilities.filter((c) => c.verified).length;
  return (
    <section aria-labelledby="dh-evidence-heading" style={{
      padding: "24px", borderRadius: 14, background: t.cream, border: `1px solid ${t.line}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 id="dh-evidence-heading" style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 700, color: t.coal, margin: 0 }}>
          Evidence Capabilities
        </h2>
        <span style={{ fontFamily: f.sans, fontSize: textSize.xs, fontWeight: 600, color: t.inkSoft }}>
          {verifiedCount} of {capabilities.length} Verified
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {capabilities.map((c) => (
          <div key={c.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.coal }}>{c.label}</span>
            {c.verified ? (
              <Tag tone="success" label={c.verifiedDateLabel ? `Verified ${c.verifiedDateLabel}` : "Verified"} />
            ) : (
              <Tag label="Not yet" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Getting Started stepper (empty-state only) ─── */

export function GettingStartedCard({ hasResume, hasTargetRole, hasFirstSession, hasVisitedAnalytics }: {
  hasResume: boolean; hasTargetRole: boolean; hasFirstSession: boolean;
  /** Real localStorage flag (dashboardHelpers.ts) written on mount by the
   *  analytics page itself — not a permanently-false placeholder. */
  hasVisitedAnalytics: boolean;
}) {
  const steps = [
    { label: "Upload your resume", done: hasResume },
    { label: "Set your target role", done: hasTargetRole },
    { label: "Complete your first session", done: hasFirstSession },
    { label: "Review your analytics", done: hasVisitedAnalytics },
  ];
  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <section aria-labelledby="dh-getting-started-heading" style={{
      padding: "24px", borderRadius: 14, background: t.cream, border: `1px solid ${t.line}`,
    }}>
      <h2 id="dh-getting-started-heading" style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 700, color: t.coal, margin: "0 0 16px" }}>
        Getting Started
      </h2>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {steps.map((step, i) => {
          const state = step.done ? "done" : i === currentIndex ? "current" : "pending";
          return (
            <div key={step.label} style={{ display: "flex", gap: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: state === "done" ? t.coal : state === "current" ? t.indigo100 : t.creamSoft,
                  border: state === "current" ? `2px solid ${t.indigo}` : `1px solid ${t.line}`,
                }}>
                  {state === "done" && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                {i < steps.length - 1 && <span style={{ width: 1, flex: 1, minHeight: 20, background: t.line }} />}
              </div>
              <div style={{ paddingBottom: 18 }}>
                <span style={{
                  fontFamily: f.sans, fontSize: textSize.base, fontWeight: state === "pending" ? 400 : 600,
                  color: state === "pending" ? t.inkFaint : t.coal,
                }}>{step.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── "What you'll unlock" teaser grid (empty-state only) ───
   The Figma file duplicates "Resume Strength"'s description verbatim onto
   "Evidence Capabilities", and "Employer Interest"'s description reads like
   it belongs to "Evidence Capabilities" — a copy-paste bug in the design
   file. Corrected here so each card accurately describes its own feature. */

const UNLOCK_CARDS = [
  { title: "Interview Readiness", description: "A single score tracking how ready you are for your target role, updated after every session." },
  { title: "Resume Strength", description: "An AI-scored breakdown of your resume with specific, actionable improvements." },
  { title: "Evidence Capabilities", description: "Verified proof of the skills you've demonstrated across your practice sessions." },
  { title: "Employer Interest", description: "See which employers have shortlisted or unlocked your profile for open roles." },
];

export function UnlockTeaserGrid() {
  return (
    <section aria-labelledby="dh-unlock-heading" style={{
      padding: "24px", borderRadius: 14, background: t.cream, border: `1px solid ${t.line}`,
    }}>
      <h2 id="dh-unlock-heading" style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 700, color: t.coal, margin: "0 0 16px" }}>
        What You&apos;ll Unlock
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        {UNLOCK_CARDS.map((card) => (
          <div key={card.title} style={{ padding: "16px", borderRadius: 10, background: t.creamSoft, border: `1px solid ${t.line}` }}>
            <div style={{ fontFamily: f.sans, fontSize: textSize.base, fontWeight: 700, color: t.coal, marginBottom: 6 }}>{card.title}</div>
            <div style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, lineHeight: 1.5 }}>{card.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NoSessionsEmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12,
      padding: "48px 24px", border: `1px solid ${t.line}`, borderRadius: 12, background: t.cream,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12, background: t.creamSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={t.inkSoft} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" />
        </svg>
      </div>
      <h3 style={{ fontFamily: f.sans, fontSize: textSize.lg, fontWeight: 700, color: t.coal, margin: 0 }}>No Sessions Yet</h3>
      <p style={{ fontFamily: f.sans, fontSize: textSize.sm, color: t.inkSoft, margin: 0, maxWidth: 360 }}>
        Your completed practice sessions will appear here.
      </p>
      <Button
        type="button"
        size="cta"
        onClick={onStart}
        style={{ marginTop: 6, fontFamily: f.sans }}
      >
        Start Your First Session
      </Button>
    </div>
  );
}
