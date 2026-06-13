/* HireStepX — Email Templates / Payments & Billing
   Redesign of the Razorpay payment emails:
   - verify-payment.ts        → payment confirmed (manual verify)
   - send-abandonment-emails.ts → cart abandonment
   - razorpay-webhook.ts      → renewal, payment-failed, activation
   Calm confirmations. Numbers prominent. Receipt on cream, never accountant-tone. */
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
  Mono,
} from "./_email-kit";

export default function PaymentEmails() {
  return (
    <EmailPage
      num="02 / Payments & Billing"
      titlePre="Money, made"
      titleAccent="calm"
      description="UPI-first Razorpay receipts and billing notices. Prominent amounts, a clean receipt block on cream, one CTA back to the dashboard, never an order-number subject line."
    >
      {/* 01 — Payment confirmed (verify-payment.ts) */}
      <EmailSpec
        num="01"
        title="Payment confirmed"
        desc="Sent on successful checkout. Plan unlocked, receipt inside."
      >
        <EmailFrame
          subject="₹149 received · Pro is live"
          from="HireStepX Billing"
          preview="Pro plan starts now. Renews 13 July 2026."
        >
          <EmailTitle>
            You're <Accent>in</Accent>.
          </EmailTitle>
          <P>
            Pro plan starts now. Unlimited interviews, full AI feedback, salary
            negotiation mode and performance analytics, all unlocked.
          </P>
          <DataCard
            label="Receipt"
            rows={[
              ["Plan", "Pro · monthly"],
              ["Amount", <Mono>₹149.00</Mono>],
              ["GST included", <Mono>₹22.73</Mono>],
              ["Renews", "13 July 2026"],
              ["Razorpay ID", <Mono>pay_NhJa12K3LkM4</Mono>],
            ]}
          />
          <EmailButton>Go to dashboard →</EmailButton>
          <P small muted>
            Need a GST invoice for your company? Reply to this email and we'll
            send a tax-compliant version within the hour.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 02 — Cart abandonment */}
      <EmailSpec
        num="02"
        title="Checkout abandoned"
        desc="Payment started but not completed. Gentle, no false urgency."
      >
        <EmailFrame
          subject="You're one step away from Pro"
          from="HireStepX"
          preview="Your checkout is still open. Pick up where you left off."
        >
          <EmailTitle>
            Almost <Accent>there</Accent>.
          </EmailTitle>
          <P>
            You started upgrading to Pro but didn't finish checkout. No charge
            was made; your selection is still saved.
          </P>
          <DataCard
            label="Waiting for you"
            rows={[
              ["Plan", "Pro · monthly"],
              ["Amount", <Mono>₹149.00</Mono>],
              ["Pay with", "UPI · cards · netbanking"],
            ]}
          />
          <EmailButton>Complete checkout →</EmailButton>
          <P small muted>
            Changed your mind? No problem, you can keep practising on the free
            plan, and this link will be here when you're ready.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 03 — Subscription renewed (webhook) */}
      <EmailSpec
        num="03"
        title="Subscription renewed"
        desc="Auto-renewal succeeded via Razorpay webhook. Quiet, reassuring."
      >
        <EmailFrame
          subject="Pro plan renewed"
          from="HireStepX Billing"
          preview="Auto-renewed and active until 13 July 2026."
        >
          <EmailTitle>
            Renewed, <Accent>nothing to do</Accent>.
          </EmailTitle>
          <P>
            Your HireStepX <B>Pro</B> plan auto-renewed and is active until{" "}
            <B>13 July 2026</B>. Keep practising; your unlimited sessions roll
            right on.
          </P>
          <DataCard
            label="Receipt"
            rows={[
              ["Plan", "Pro · monthly"],
              ["Amount", <Mono>₹149.00</Mono>],
              ["Active until", "13 July 2026"],
              ["Razorpay ID", <Mono>pay_Oq72bWxYzLp9</Mono>],
            ]}
          />
          <EmailButton>Continue practising →</EmailButton>
          <P small muted>
            <EmailLink>Manage subscription</EmailLink> ·{" "}
            <EmailLink>Download invoice</EmailLink>
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 04 — Payment failed / paused */}
      <EmailSpec
        num="04"
        title="Payment failed"
        desc="Auto-renewal charge declined. Subscription paused, clear recovery path."
      >
        <EmailFrame
          subject="Payment failed, your plan is paused"
          from="HireStepX Billing"
          preview="Update your payment method to restore Pro access."
        >
          <EmailTitle>
            We couldn't <Accent>renew</Accent>.
          </EmailTitle>
          <P>
            The auto-renewal charge for your Pro plan didn't go through, so we've
            paused your subscription for now. Your data and history are safe.
          </P>
          <DataCard
            label="What happened"
            tone="error"
            rows={[
              ["Plan", "Pro · monthly"],
              ["Amount due", <Mono>₹149.00</Mono>],
              ["Reason", "Payment declined"],
            ]}
          />
          <EmailButton>Update payment method →</EmailButton>
          <P small muted>
            We'll retry automatically once your method is updated. Until then
            you're on the free plan; no sessions are lost.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 05 — Subscription activated (webhook first charge) */}
      <EmailSpec
        num="05"
        title="Subscription activated"
        desc="First successful charge on a new recurring subscription."
      >
        <EmailFrame
          subject="Pro plan activated"
          from="HireStepX Billing"
          preview="Your recurring Pro subscription is now live."
        >
          <EmailTitle>
            Pro is <Accent>live</Accent>.
          </EmailTitle>
          <P>
            Your recurring <B>Pro</B> subscription is set up and active until{" "}
            <B>13 July 2026</B>. We'll renew it automatically each month so your
            practice never pauses.
          </P>
          <DataCard
            label="Receipt"
            rows={[
              ["Plan", "Pro · monthly · recurring"],
              ["Amount", <Mono>₹149.00</Mono>],
              ["Next renewal", "13 July 2026"],
              ["Razorpay ID", <Mono>sub_Nh20pLkQrSt3</Mono>],
            ]}
          />
          <EmailButton>Start practising →</EmailButton>
          <P small muted>
            Manage or cancel anytime from <EmailLink>Settings → Plan</EmailLink>.
            You stay in control.
          </P>
        </EmailFrame>
      </EmailSpec>
    </EmailPage>
  );
}
