/* HireStepX — Email Templates / Subscription Lifecycle
   Redesign of the plan-management emails:
   - cancel-subscription.ts     → cancellation confirmed
   - reactivate-subscription.ts → reactivated
   - pause-subscription.ts      → paused / resumed
   - send-renewal-reminders.ts  → renewal reminder (expiring soon)
   - delete-account.ts          → account deleted
   Respectful of the user's choice; every exit leaves a door open. */
import { tokens as t, fonts as f } from "../design-system/_tokens";
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

export default function SubscriptionEmails() {
  return (
    <EmailPage
      num="03 / Subscription Lifecycle"
      titlePre="Your plan, your"
      titleAccent="call"
      description="Cancel, pause, resume, reactivate, renew, delete. Each one confirms the action plainly, keeps access details clear, and never guilt-trips the exit."
    >
      {/* 01 — Renewal reminder */}
      <EmailSpec
        num="01"
        title="Renewal reminder"
        desc="Sent a few days before a plan expires. Heads-up, not a hard sell."
      >
        <EmailFrame
          subject="Your Pro plan expires in 3 days"
          from="HireStepX Billing"
          preview="Renew to keep unlimited practice without a gap."
        >
          <EmailTitle>
            3 days <Accent>left</Accent>.
          </EmailTitle>
          <P>
            Your HireStepX <B>Pro</B> plan expires on <B>16 June 2026</B>. Renew
            before then to keep unlimited sessions, AI feedback and analytics
            running without a break.
          </P>
          <DataCard
            label="Current plan"
            rows={[
              ["Plan", "Pro · monthly"],
              ["Expires", "16 June 2026"],
              ["Renews at", "₹149 / month"],
            ]}
          />
          <EmailButton>Renew now →</EmailButton>
          <P small muted>
            Not renewing? You'll move to the free plan automatically; your
            history and reports stay exactly where they are.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 02 — Subscription paused */}
      <EmailSpec
        num="02"
        title="Subscription paused"
        desc="User-initiated pause. Reassure that billing stops and data stays."
      >
        <EmailFrame
          subject="Your subscription is paused"
          from="HireStepX"
          preview="Billing is on hold. Resume whenever you're ready."
        >
          <EmailTitle>
            Paused, <Accent>not gone</Accent>.
          </EmailTitle>
          <P>
            We've paused your Pro subscription. You won't be billed while it's
            paused, and everything (sessions, reports, streaks) stays exactly as
            you left it.
          </P>
          <EmailButton tone="ghost">Resume anytime →</EmailButton>
          <P small muted>
            Resume in one click from <EmailLink>Settings → Plan</EmailLink>.
            Your Pro features switch back on the moment you do.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 03 — Subscription resumed */}
      <EmailSpec
        num="03"
        title="Subscription resumed"
        desc="Pause lifted. Pro is active again, billing restarts."
      >
        <EmailFrame
          subject="Welcome back to Pro"
          from="HireStepX"
          preview="Your subscription is active again."
        >
          <EmailTitle>
            Back <Accent>on</Accent>.
          </EmailTitle>
          <P>
            Your Pro subscription is active again. Unlimited sessions, full AI
            coaching and analytics are all switched back on.
          </P>
          <DataCard
            label="Plan resumed"
            tone="success"
            rows={[
              ["Plan", "Pro · monthly"],
              ["Next renewal", "13 July 2026"],
              ["Billing", "₹149 / month"],
            ]}
          />
          <EmailButton>Start a session →</EmailButton>
        </EmailFrame>
      </EmailSpec>

      {/* 04 — Cancellation confirmed */}
      <EmailSpec
        num="04"
        title="Cancellation confirmed"
        desc="Subscription cancelled. Be gracious; keep access until period end."
      >
        <EmailFrame
          subject="Your cancellation is confirmed"
          from="HireStepX"
          preview="Pro stays active until the end of your billing period."
        >
          <EmailTitle>
            Cancelled, <Accent>no hard feelings</Accent>.
          </EmailTitle>
          <P>
            Your Pro subscription is cancelled and won't renew. You'll keep full
            Pro access until <B>13 July 2026</B>, then move to the free plan.
          </P>
          <DataCard
            label="What happens next"
            rows={[
              ["Pro access until", "13 July 2026"],
              ["Then", "Free plan"],
              ["Your data", "Kept, nothing deleted"],
            ]}
          />
          <EmailButton tone="ghost">Reactivate Pro →</EmailButton>
          <P small muted>
            If you cancelled by mistake, you can reactivate any time before the
            date above and nothing changes. We'd love a line on what we could do
            better; just reply.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 05 — Reactivated */}
      <EmailSpec
        num="05"
        title="Subscription reactivated"
        desc="User came back. Warm welcome, confirm what's restored."
      >
        <EmailFrame
          subject="Your Pro subscription is reactivated"
          from="HireStepX"
          preview="Everything's restored and running again."
        >
          <EmailTitle>
            Good to have you <Accent>back</Accent>.
          </EmailTitle>
          <P>
            Your HireStepX Pro subscription is reactivated. Everything you had is
            right where you left it, and the unlimited sessions are open again.
          </P>
          <DataCard
            label="You're all set"
            tone="success"
            rows={[
              ["Plan", "Pro · monthly"],
              ["Active until", "13 July 2026"],
              ["Billing", "₹149 / month"],
            ]}
          />
          <EmailButton>Pick up where you left off →</EmailButton>
        </EmailFrame>
      </EmailSpec>

      {/* 06 — Account deleted */}
      <EmailSpec
        num="06"
        title="Account deleted"
        desc="Final confirmation after a destructive, irreversible action."
      >
        <EmailFrame
          subject="Your account has been deleted"
          from="HireStepX"
          preview="Your data is gone. Here's exactly what was removed."
        >
          <div
            style={{
              fontFamily: f.mono,
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: t.inkSoft,
              paddingBottom: 16,
              marginBottom: 24,
              borderBottom: `2px solid ${t.coal}`,
            }}
          >
            Permanent · Irreversible
          </div>
          <EmailTitle>Deleted, as requested.</EmailTitle>
          <P>
            Your HireStepX account and all associated data have been permanently
            deleted. This can't be undone, and we keep no backup of your
            sessions or reports.
          </P>
          <DataCard
            label="Removed"
            rows={[
              ["Profile & login", "Deleted"],
              ["Sessions & reports", "Deleted"],
              ["Resume & uploads", "Deleted"],
              ["Active subscription", "Cancelled"],
            ]}
          />
          <P muted>
            Thank you for giving HireStepX a try. If you ever want to come back,
            you're always welcome to start fresh.
          </P>
          <P small muted>
            Didn't expect this? <EmailLink>Contact us</EmailLink> immediately so
            we can investigate.
          </P>
        </EmailFrame>
      </EmailSpec>
    </EmailPage>
  );
}
