/* Extracted from SessionReportView.tsx 2026-05-29 split.
 * "Do you have any questions for us?" closing-turn card. Includes
 * the reason + verdict label tables.
 * Pure presentation. */

import { t, f, radius } from "../tokens";
import type { InterviewResultData } from "../types";
import { SrSectionShell } from "./_primitives";

const REVERSE_REASON_LABELS: Record<string, string> = {
  success_definition: "Asked what success looks like in 30–90 days",
  team_structure: "Asked how the team is structured",
  current_challenge: "Asked about the team's hardest current problem",
  decision_making_process: "Asked how technical decisions get made",
  variable_payout_history: "Asked about variable / bonus payout history",
  expected_contribution: "Asked what you'd be expected to bring",
  tech_debt_or_tradeoffs: "Asked how the team thinks about tech-debt / trade-offs",
  honest_reflection_invite: "Asked the interviewer for an honest reflection",
  services_structure_probe: "Asked about onshore / offshore / client split",
  salary_too_early: "Asked about salary / CTC in this round",
  wfh_aggressive: "Asked for WFH 'full time / always' upfront",
  promotion_timeline_entitled: "Asked 'when will I get promoted / hiked?'",
  leave_policy_pre_offer: "Asked about leave / attendance policy pre-offer",
  attendance_strictness: "Asked how strict attendance / timing is",
  anti_work_signalling: "Asked about weekends / night-shifts / overtime",
  joining_bonus_negotiation_too_early: "Tried to negotiate joining bonus here",
  generic_culture: "Asked a generic 'what's the culture like'",
  process_basics: "Asked about next steps / process timeline",
  generic_closer: "Closed with 'anything else I should know?'",
  unclassified: "Question didn't match a known shape",
  empty: "No question was asked",
};

const REVERSE_VERDICT_COPY: Record<"strong" | "neutral" | "weak" | "red_flag", {
  title: string;
  oneLiner: string;
  tone: "good" | "ok" | "warn" | "bad";
}> = {
  strong: {
    title: "Strong close",
    oneLiner: "You asked at least one substantive role / team question — that's the senior-judgement signal Indian hiring managers look for here.",
    tone: "good",
  },
  neutral: {
    title: "Neutral close",
    oneLiner: "Your closing questions were generic. They didn't hurt, but a real-role probe (success criteria, team shape, decision-making) would lift this turn from neutral to strong.",
    tone: "ok",
  },
  weak: {
    title: "Low-engagement close",
    oneLiner: "You said little / nothing when invited. Indian recruiters read silence here as low interest. Always have one substantive question ready.",
    tone: "warn",
  },
  red_flag: {
    title: "Closing-turn red flag",
    oneLiner: "One of your questions is a documented offer-killer in Indian loops at this stage. Reshape it for round 2 — these belong with HR after the offer, not with the panel before.",
    tone: "bad",
  },
};

export function ReverseInterviewSection({
  reverse,
}: {
  reverse: NonNullable<InterviewResultData["reverseInterview"]>;
}) {
  const copy = REVERSE_VERDICT_COPY[reverse.verdict];
  const accent =
    copy.tone === "good" ? t.success
    : copy.tone === "ok" ? t.indigo
    : copy.tone === "warn" ? t.warning
    : t.error;
  return (
    <SrSectionShell
      anchorId="ir-section-reverse"
      headingId="ir-reverse-heading"
      num="07"
      label="Reverse interview"
      title={copy.title}
      subtitle={copy.oneLiner}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontFamily: f.sans, fontSize: 12, padding: "4px 10px", borderRadius: radius.pill, background: t.successTint, color: t.success, fontWeight: 600 }}>
          {reverse.counts.green} strong
        </span>
        <span style={{ fontFamily: f.sans, fontSize: 12, padding: "4px 10px", borderRadius: radius.pill, background: t.warningTint, color: t.warning, fontWeight: 600 }}>
          {reverse.counts.yellow} neutral
        </span>
        <span style={{ fontFamily: f.sans, fontSize: 12, padding: "4px 10px", borderRadius: radius.pill, background: t.errorTint, color: t.error, fontWeight: 600 }}>
          {reverse.counts.red} risky
        </span>
      </div>
      {reverse.classifications.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {reverse.classifications.map((c, i) => {
            const dotColor = c.bucket === "green" ? t.success : c.bucket === "red" ? t.error : t.warning;
            return (
              <li
                key={i}
                style={{
                  fontFamily: f.sans,
                  fontSize: 13,
                  color: t.coal,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 12px",
                  background: t.cream,
                  borderRadius: radius.lg,
                  borderLeft: `3px solid ${dotColor}`,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} aria-hidden="true" />
                <span>{REVERSE_REASON_LABELS[c.reason] || c.reason}</span>
              </li>
            );
          })}
        </ul>
      )}
      <p
        style={{
          fontFamily: f.sans,
          fontSize: 12,
          color: accent,
          margin: "14px 0 0",
          fontStyle: "italic",
        }}
      >
        Verdict: {reverse.verdict.replace("_", " ")}
      </p>
    </SrSectionShell>
  );
}
