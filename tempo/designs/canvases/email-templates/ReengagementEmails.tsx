/* HireStepX — Email Templates / Re-engagement
   Redesign of the tiered win-back ladder from server-handlers/re-engage-users.ts:
   day1, day3, day7 (free tier) and paid14, paid30 (paid tier).
   Honest, useful, never guilty. Each tier escalates value, not pressure;
   day7 is the last free nudge and says so. */
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
  DataCard,
} from "./_email-kit";

export default function ReengagementEmails() {
  return (
    <EmailPage
      num="04 / Re-engagement"
      titlePre="Keep the"
      titleAccent="reps"
      description="A five-step win-back ladder keyed to days since last session. Skills decay without practice; these acknowledge the gap, surface the user's own numbers, and offer one focused way back in. Never guilt, never fake urgency."
    >
      {/* day1 */}
      <EmailSpec
        num="01"
        title="Day 1 · Next session ready"
        desc="One day idle. Light touch, just a door held open."
      >
        <EmailFrame
          subject="Arjun, your next practice session is ready"
          from="HireStepX"
          preview="Pick up right where you left off. No card needed."
        >
          <EmailTitle>
            Ready when <Accent>you are</Accent>.
          </EmailTitle>
          <P>
            Your personalised <B>Product Manager</B> session is set up and
            waiting. Pick up exactly where you left off, it takes about 15
            minutes.
          </P>
          <EmailButton>Continue practising →</EmailButton>
          <P small muted>
            You still have free sessions remaining. No card needed.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* day3 */}
      <EmailSpec
        num="02"
        title="Day 3 · Skills need a refresh"
        desc="Three days idle. Point at the weakest area from their last report."
      >
        <EmailFrame
          subject="Your behavioral skills need a refresh"
          from="HireStepX"
          preview="10 minutes rebuilds what 3 days started to fade."
        >
          <EmailTitle>
            Three days, <Accent>already</Accent>?
          </EmailTitle>
          <P>
            Your last report flagged <B>behavioral structure</B> as the area
            with the most room to grow. A short, focused drill is the fastest way
            to lock it in before it fades.
          </P>
          <EmailButton>Practice behavioral →</EmailButton>
          <P small muted>
            10 minutes is all it takes. Your resume-personalised questions are
            waiting.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* day7 */}
      <EmailSpec
        num="03"
        title="Day 7 · Last free nudge"
        desc="A week idle. The final reminder, and it honestly says so."
      >
        <EmailFrame
          subject="Your practice sessions are still here"
          from="HireStepX"
          preview="This is our last reminder; your sessions will always be here."
        >
          <EmailTitle>
            One week <Accent>out</Accent>.
          </EmailTitle>
          <P>
            Interview skills fade fastest in the first weeks without practice.
            You've built a real baseline; it's worth keeping warm before your
            next interview.
          </P>
          <EmailButton>Practice now, it's free →</EmailButton>
          <P small muted>
            This is our last reminder. We'll stop emailing, but your practice
            sessions will always be here when you're ready. You can also{" "}
            <EmailLink>pause these emails</EmailLink>.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* paid14 */}
      <EmailSpec
        num="04"
        title="Paid · 14 days idle"
        desc="Paying subscriber, two weeks quiet. Remind them of the value they own."
      >
        <EmailFrame
          subject="Two weeks since your last Pro session"
          from="HireStepX"
          preview="Your last focus area was quantified outcomes. Pick it up?"
        >
          <EmailTitle>
            Two weeks of <Accent>unused</Accent> Pro.
          </EmailTitle>
          <P>
            You're on the <B>Pro plan</B> (unlimited sessions, every day) and
            it's been 14 days. A 10-minute session today rebuilds the muscle
            memory that got you this far.
          </P>
          <DataCard
            label="Your last session"
            rows={[
              ["Score", "72 / 100"],
              ["Focus area", "Quantified outcomes"],
              ["Role", "Product Manager"],
            ]}
          />
          <EmailButton>Start a quick session →</EmailButton>
        </EmailFrame>
      </EmailSpec>

      {/* paid30 */}
      <EmailSpec
        num="05"
        title="Paid · 30 days idle"
        desc="A month quiet. Offer a focused drill; remind them they can pause."
      >
        <EmailFrame
          subject="Your Pro plan is active and ready when you are"
          from="HireStepX"
          preview="A focused 15-minute drill to brush the rust off."
        >
          <EmailTitle>
            A month <Accent>away</Accent>.
          </EmailTitle>
          <P>
            It's been about a month since your last session. Your{" "}
            <B>Product Manager</B> skills are still in there; let's brush them
            off with a focused 15-minute drill.
          </P>
          <EmailButton>Start a focused drill →</EmailButton>
          <P small muted>
            Pause or cancel anytime from <EmailLink>Settings → Plan</EmailLink>.
            We want you practising only when it's actually useful.
          </P>
        </EmailFrame>
      </EmailSpec>
    </EmailPage>
  );
}
