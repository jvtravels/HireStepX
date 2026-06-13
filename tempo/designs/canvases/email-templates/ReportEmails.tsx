/* HireStepX — Email Templates / Reports & Digests
   Redesign of the recurring report emails:
   - weekly-summary.ts             → weekly recap (the marquee email)
   - aggregate-question-feedback.ts → moderator question-feedback digest (internal)
   The weekly recap is the brand's Sunday proof point — editorial,
   stat-forward, one next action. The digest is the internal ops view. */
import {
  EmailPage,
  EmailSpec,
  EmailFrame,
  EmailTitle,
  Accent,
  EmailButton,
  EmailLink,
  P,
  B,
  MonoLabelRow,
  StatRow,
} from "./_email-kit";

export default function ReportEmails() {
  return (
    <EmailPage
      num="05 / Reports & Digests"
      titlePre="The week, in"
      titleAccent="reps"
      description="Recurring digests. The weekly recap is the marquee email, styled like an editorial post, stat-forward, ending in one next move. The moderator digest is the internal ops report."
    >
      {/* 01 — Weekly recap */}
      <EmailSpec
        num="01"
        title="Weekly recap"
        desc="Sunday digest. The marquee email; proves the brand every week."
      >
        <EmailFrame
          subject="Your HireStepX week: 3 sessions, score 78"
          from="HireStepX"
          preview="Score up 8 points. Here's what stood out."
        >
          <MonoLabelRow>Week of 7–13 June 2026</MonoLabelRow>
          <EmailTitle size={32}>
            You're <Accent>sharper</Accent> than last week.
          </EmailTitle>
          <StatRow
            stats={[
              { label: "Sessions", val: "3" },
              { label: "Avg score", val: "78" },
              { label: "Change", val: "+8" },
            ]}
          />
          <P>
            Your behavioral structure improved across all three sessions. The AI
            noted you now open with situation context before jumping into
            action, a real STAR pattern. That's worth celebrating.
          </P>
          <P>
            The next push: <B>quantified outcomes</B>. Your stories land, but
            they're missing the "and that led to a 23% improvement" line at the
            end. Try <EmailLink>this prompt set</EmailLink> this week.
          </P>
          <EmailButton>Practice this →</EmailButton>
          <P small muted>See you next Sunday.</P>
        </EmailFrame>
      </EmailSpec>

      {/* 02 — Moderator question-feedback digest */}
      <EmailSpec
        num="02"
        title="Question-feedback digest"
        desc="Internal ops email to MODERATOR_EMAIL. Dense, scannable, no marketing."
      >
        <EmailFrame
          subject="Question feedback digest · 12 flagged"
          from="HireStepX Ops"
          preview="12 questions crossed the report threshold this week."
        >
          <EmailTitle size={26}>
            12 questions <Accent>flagged</Accent>.
          </EmailTitle>
          <P muted>
            These questions crossed the negative-feedback threshold in the last
            7 days and are queued for review. Confirm or dismiss each in the
            moderation panel.
          </P>
          <StatRow
            stats={[
              { label: "Flagged", val: "12" },
              { label: "Reports", val: "47" },
              { label: "Auto-paused", val: "3" },
            ]}
          />
          <P small muted>
            Top reason: <B>"unclear wording"</B> (21 reports). Next:{" "}
            <B>"off-topic for role"</B> (14). Full breakdown and per-question
            transcripts are in the panel.
          </P>
          <EmailButton>Open moderation panel →</EmailButton>
          <P small muted>
            Internal report · not sent to candidates ·{" "}
            <EmailLink>digest settings</EmailLink>
          </P>
        </EmailFrame>
      </EmailSpec>
    </EmailPage>
  );
}
