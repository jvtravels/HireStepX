/* HireStepX — Email Templates / Auth & Account
   Redesign of the welcome + transactional auth emails (send-welcome.ts):
   welcome, verification, verify-reminder, password reset, password-changed,
   new-device sign-in, account-not-found, duplicate-account.
   One purpose, one CTA, calm security copy. Copper is the headline accent
   only; security/info data cards carry semantic tone (warning, never warm). */
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
  Signoff,
} from "./_email-kit";

export default function AuthAccountEmails() {
  return (
    <EmailPage
      num="01 / Auth & Account"
      titlePre="Confirm it's"
      titleAccent="you"
      description="The welcome moment plus every single-purpose security email. The CTA is the whole message; copy stays calm and specific, never alarmist. Sent from send-welcome.ts."
    >
      {/* 01 — Welcome (marquee, founder voice) */}
      <EmailSpec
        num="01"
        title="Welcome"
        desc="The marquee transactional email. Personal, founder-signed, ends in one action."
      >
        <EmailFrame
          subject="Welcome. Your first practice begins now."
          from="Jay from HireStepX"
          preview="Three free sessions, no card needed. Here's how to start."
        >
          <EmailTitle size={32}>
            Welcome, <Accent>Arjun</Accent>.
          </EmailTitle>
          <P>
            Glad you're here. You've got three free practice interviews, enough
            to find your weakest area and fix one of them.
          </P>
          <P>Three things worth knowing before you start:</P>
          <ol
            style={{
              margin: "0 0 26px",
              paddingLeft: 20,
              color: t.indigoGray,
              fontFamily: f.sans,
              fontSize: 15,
              lineHeight: 1.7,
            }}
          >
            <li style={{ marginBottom: 10 }}>
              Your AI interviewer adapts to your resume. The more honest the
              resume, the sharper the questions.
            </li>
            <li style={{ marginBottom: 10 }}>
              Sessions run 15 minutes by default. Start with{" "}
              <B>Behavioral, Standard</B>.
            </li>
            <li>You can interrupt the AI anytime. Real interviewers do too.</li>
          </ol>
          <EmailButton>Start your first interview →</EmailButton>
          <Signoff
            name="Jay"
            role="Founder, HireStepX"
            note="Reply to this email if anything's unclear. I read every one."
          />
        </EmailFrame>
      </EmailSpec>

      {/* 02 — Email verification */}
      <EmailSpec
        num="02"
        title="Verify your email"
        desc="Sent immediately after signup. The button is the entire email."
      >
        <EmailFrame
          subject="Verify your email · 15 minutes"
          from="HireStepX"
          preview="One click to confirm it's you and unlock your account."
        >
          <EmailTitle>
            Verify your <Accent>email</Accent>.
          </EmailTitle>
          <P>
            We just need to confirm this address is yours. One click, then you
            can start practising.
          </P>
          <EmailButton>Verify my email →</EmailButton>
          <P small muted>
            The link expires in <B>15 minutes</B> for your security. If you
            didn't sign up, you can safely ignore this email. Your address won't
            be used.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 03 — Verify reminder */}
      <EmailSpec
        num="03"
        title="Verification reminder"
        desc="Nudge for accounts that signed up but never confirmed."
      >
        <EmailFrame
          subject="Still need to verify your email"
          from="HireStepX"
          preview="Your free sessions are waiting behind one click."
        >
          <EmailTitle>
            One step <Accent>left</Accent>.
          </EmailTitle>
          <P>
            You signed up but haven't confirmed your email yet. Your three free
            practice interviews are ready the moment you do.
          </P>
          <EmailButton>Verify and start →</EmailButton>
          <P small muted>
            A fresh link, valid for <B>15 minutes</B>. If you've already
            verified, you're all set, just ignore this.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 04 — Password reset */}
      <EmailSpec
        num="04"
        title="Password reset"
        desc="Requested from /forgot-password. Time-boxed link, no account leakage."
      >
        <EmailFrame
          subject="Reset link, as requested"
          from="HireStepX"
          preview="Valid for 60 minutes. Didn't ask? Nothing changes."
        >
          <EmailTitle>
            Reset your <Accent>password</Accent>.
          </EmailTitle>
          <P>
            You asked to reset your HireStepX password. Pick a new one; this is
            the only link you'll need.
          </P>
          <EmailButton>Choose a new password →</EmailButton>
          <P small muted>
            The link works for <B>60 minutes</B>, then expires. If you didn't
            request this, ignore it. Your password stays exactly as it is.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 05 — Password changed */}
      <EmailSpec
        num="05"
        title="Password changed"
        desc="Confirmation plus a security backstop if it wasn't them."
      >
        <EmailFrame
          subject="Your password was changed"
          from="HireStepX Security"
          preview="If this was you, no action needed."
        >
          <EmailTitle>
            Password <Accent>updated</Accent>.
          </EmailTitle>
          <P>
            Your HireStepX password was just changed. If that was you, you're
            done; nothing else to do.
          </P>
          <DataCard
            label="Change details"
            rows={[
              ["When", "13 June 2026, 3:14 PM IST"],
              ["Device", "Chrome · Windows"],
              ["Location", "Bengaluru, IN (approx.)"],
            ]}
          />
          <P small muted>
            Didn't change it? <EmailLink>Secure your account</EmailLink> right
            away and contact us. We'll lock things down.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 06 — New device sign-in */}
      <EmailSpec
        num="06"
        title="New device sign-in"
        desc="Single-device enforcement: a sign-in elsewhere logged this session out."
      >
        <EmailFrame
          subject="New device sign-in"
          from="HireStepX Security"
          preview="A new device signed in to your account."
        >
          <EmailTitle>
            New <Accent>sign-in</Accent> detected.
          </EmailTitle>
          <P>
            Your account was just signed in to on a new device. HireStepX allows
            one active device at a time, so any other session was signed out.
          </P>
          <DataCard
            label="Sign-in details"
            tone="warning"
            rows={[
              ["When", "13 June 2026, 9:02 AM IST"],
              ["Device", "Safari · iPhone"],
              ["Location", "Pune, IN (approx.)"],
            ]}
          />
          <P small muted>
            If this was you, ignore this email. If not,{" "}
            <EmailLink>reset your password</EmailLink> immediately. Someone else
            may have your credentials.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 07 — Account not found */}
      <EmailSpec
        num="07"
        title="Account not found"
        desc="Forgot-password for an address with no account. Helpful, not leaky."
      >
        <EmailFrame
          subject="We couldn't find your account"
          from="HireStepX"
          preview="No account exists for this address. Here's what to do."
        >
          <EmailTitle>
            No account <Accent>yet</Accent>.
          </EmailTitle>
          <P>
            Someone asked to reset a HireStepX password for this address, but we
            don't have an account on file for it.
          </P>
          <P muted>
            If that was you, you may have signed up with a different email, or
            you haven't created an account yet.
          </P>
          <EmailButton>Create an account →</EmailButton>
          <P small muted>
            If you didn't request anything, you can safely ignore this email.
          </P>
        </EmailFrame>
      </EmailSpec>

      {/* 08 — Duplicate account */}
      <EmailSpec
        num="08"
        title="Account already exists"
        desc="Signup attempt on an address that already has an account."
      >
        <EmailFrame
          subject="You already have an account"
          from="HireStepX"
          preview="Sign in instead, or reset your password if you're stuck."
        >
          <EmailTitle>
            Welcome <Accent>back</Accent>.
          </EmailTitle>
          <P>
            You tried to sign up, but this address already has a HireStepX
            account. No need to create another; just sign in.
          </P>
          <EmailButton>Sign in →</EmailButton>
          <P small muted>
            Forgot your password? <EmailLink>Reset it here</EmailLink>. If this
            wasn't you, no account was created and nothing changed.
          </P>
        </EmailFrame>
      </EmailSpec>
    </EmailPage>
  );
}
