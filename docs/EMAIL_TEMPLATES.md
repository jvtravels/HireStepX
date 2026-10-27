# HireStepX — Email Templates Reference

Single source of truth for every transactional/lifecycle email sent to users (and ops). Use this as the spec when editing copy, designing templates, or adding new triggers.

**Sender identity (all emails)**

- **From**: `process.env.FROM_EMAIL`, defaulting to `HireStepX <hello@hirestepx.com>` (every handler, including team invites; replies reach a real inbox). Replies to a few emails go to `support@hirestepx.com` or `hello@hirestepx.com` (set per handler).
- **Colors** (tokens in `server-handlers/_email-theme.ts`): indigo `#312E81` primary (buttons, links), success green `#15803D`, error red `#B91C1C` (security/failure hero dot and light-red frame), neutral page background `#FAFAFA`, white sheet.
- **Header**: HireStepX wordmark image (`https://hirestepx.com/wordmark-email.png`, 18px high, with a dark-mode variant), top-left.
- **Hero**: every email opens with a `hero()` block: a white card (eyebrow with status dot, 28px headline, optional lede) on a rounded 16px frame with the site's soft gradient (light red for `tone: "error"`).
- **Footer (every email)**: "You're receiving this because you have an account at hirestepx.com." plus "Manage notifications" (emails to people who may have no account, such as team invites and contact acknowledgements, pass `footer: { reason }` instead, which replaces that sentence and drops the Manage link); marketing/lifecycle emails (`marketing: true`) also carry a signed "Unsubscribe" link, transactional ones never do. Sender line is `HireStepX · hello@hirestepx.com`; a postal address renders only if `LEGAL_POSTAL_ADDRESS` is configured, never invented.
- **Width**: 600px max, single column, 15px body text, Geist/system sans stack, no italics.
- **CTA buttons**: 10px radius, 12px 22px padding, white text on indigo (ghost variant is outlined).

**Voice**: confident, warm, India-aware (₹ for amounts, IST for times where relevant), no emoji-heavy fluff. Short sentences. One clear action per email.

---

## 1. Email Verification (Welcome)

| Field | Value |
| --- | --- |
| Trigger | New signup completes via `/api/send-welcome` (verify) |
| File | `server-handlers/send-welcome.ts:429` |
| Category | Transactional (no unsubscribe) |
| Rate limit | 3 / IP / hour |

**Subject**: `{firstName}, confirm your email to get started`**Preheader**: `One tap and your 2 free mock interviews are ready.`

**Body**

- **H1**: Welcome to HireStepX, {firstName}.
- **Lede**: You're one click away from your first AI mock interview. Verify your email to activate your account.
- **CTA button**: `Verify email` → `{verifyLink}` (24h expiry)
- **What's next list** (3 steps with icons):
  1. Upload your resume (PDF or paste text)
  2. Pick a target role and company
  3. Run a mock interview — get scored in minutes
- **Fallback link**: "Button not working? Paste this in your browser: {verifyLink}"
- **Security line**: "If you didn't create a HireStepX account, ignore this email."
- **Sign-off**: `The HireStepX team` (via `signoff()`)

---

## 2. Verification Reminder

| Field | Value |
| --- | --- |
| Trigger | User unverified after N hours |
| File | `send-welcome.ts:220` |
| Category | Lifecycle (unsubscribe ok) |
| Rate limit | 2 / IP / day |

**Subject**: `{firstName}, here is a fresh verification link`**Preheader**: `Here's a fresh link, good for 24 hours.`

**Body**

- **H1**: One step left, {firstName}.
- **Body**: We saved your spot. The last link may have expired, so here is a new one (valid 24 hours). One tap and your 2 free mock interviews are ready.
- **CTA**: `Verify email`
- **Soft urgency**: "This link expires in 24 hours."
- **Tiny**: "Need a new link? Sign in and we'll resend."

---

## 3. Password Reset

| Field | Value |
| --- | --- |
| Trigger | Forgot-password flow |
| File | `send-welcome.ts:287` |
| Category | Security (no unsubscribe) |
| Rate limit | 3 / IP / hour |

**Subject**: `Your password reset link`**Preheader**: `Valid for 60 minutes. Didn't ask? Nothing changes.`

**Body**

- **H1**: Reset your password
- **Body**: Click below to choose a new password. This link expires in **1 hour** and works only once.
- **CTA**: `Reset password` → `{resetLink}`
- **Security panel** (red border-left, light red bg):
  - "Didn't request this? You can safely ignore this email — your password won't change."
  - "If you see repeated reset emails you didn't request, contact support@hirestepx.com."
- **Fallback link**: plain-text URL.

---

## 4. Password Changed

| Field | Value |
| --- | --- |
| Trigger | Successful password change in settings |
| File | `send-welcome.ts:99` |
| Category | Security (no unsubscribe) |

**Subject**: `Your password was changed`**Preheader**: `If this was you, there's nothing to do.`

**Body**

- **H1**: Password updated
- **Body**: Your password was changed on **{date} at {time IST}**.
- **Detail row**: Device · IP city · Time
- **Security CTA**: `Wasn't you? Reset password now` (red button)
- **Footer note**: "We'll never email you to ask for your password."

---

## 5. New Device Login

| Field | Value |
| --- | --- |
| Trigger | Sign-in from unrecognized device token |
| File | `send-welcome.ts:157` |
| Category | Security |
| Rate limit | 5 / IP / hour |

**Subject**: `Was this you? New sign-in on your account`**Preheader**: `{Browser} on {OS} · {City, Country}`

**Body**

- **H1**: New device signed in
- **Device card** (bordered):
  - Device: {browser} on {OS}
  - Location (approx): {city, country}
  - Time: {date, time IST}
- **Body**: HireStepX is single-device — signing in here logged you out of your previous device.
- **Security CTA**: `This wasn't me — secure account` → reset password link.

---

## 6. Payment Confirmation / Receipt

| Field | Value |
| --- | --- |
| Trigger | Razorpay payment verified |
| File | `verify-payment.ts:53` |
| Category | Transactional |

**Subject**: `{amount} received, {planLabel} is live`**Preheader**: `Receipt for ₹{amount} · Payment ID {short}`

**Body**

- **H1**: You're in. Welcome to {planName}.
- **Receipt card**:
  - Plan: {planName}
  - Amount: ₹{amount}
  - Valid: {startDate} → {endDate}
  - Payment ID: {paymentId}
- **Plan benefits** (3-line bullet of what unlocks now)
- **Primary CTA**: `Start practicing` → `/dashboard`
- **Footer note**: "This is your tax invoice. Need GST details? Reply to this email."

---

## 7. Subscription Renewed

| Field | Value |
| --- | --- |
| Trigger | Razorpay `subscription.charged` webhook |
| File | `razorpay-webhook.ts:278` |
| Category | Transactional |

**Subject**: `Your {tier} plan is renewed`**Preheader**: `Next billing: {nextDate}`

**Body**

- **H1**: Subscription renewed
- **Body**: We charged ₹{amount} on {date} and extended your **{tier}** plan to **{newEndDate}**.
- **CTA**: `Continue practicing`
- **Tiny**: "Manage your plan in Settings → Subscription."

---

## 8. Renewal Reminder (Expiring Soon)

| Field | Value |
| --- | --- |
| Trigger | Daily cron, expires in ≤3 days, **manual** plans only (auto-renew skipped) |
| File | `send-renewal-reminders.ts` |
| Category | Lifecycle |

**Subject**: `Your {tier} plan expires in {N} day(s)`**Preheader**: `Renew to keep your sessions running without a gap.`

**Body**

- **H1**: {N} day{s} left on your {tier} plan
- **Countdown banner**: "{N} days remaining"
- **Body**: Renew before the end date and your sessions, AI coaching and analytics keep running without a break.
- **CTA**: `Renew now` → `/pricing?renew=1`
- **Soft fallback**: "If you don't renew, your account moves to free tier — your sessions and progress stay safe."

---

## 9. Payment Abandonment Recovery

| Field | Value |
| --- | --- |
| Trigger | Hourly cron, payment intent 1–24h old, unpaid |
| File | `send-abandonment-emails.ts` |
| Category | Lifecycle |

**Subject**: `Your {planName} is still waiting`**Preheader**: `Your checkout is still open. Finish whenever you're ready.`

**Body**

- **H1**: Forgot something, {firstName}?
- **Body**: You started checking out for **{planName}** but didn't finish. Your spot is saved.
- **Plan card**: name + ₹{amount} + 3 key benefits
- **CTA**: `Complete purchase` → `/checkout?intent={id}`
- **No-pressure footer**: "No rush — the free tier is always there if you want to keep practicing."

---

## 10. Cancellation Confirmation

| Field | Value |
| --- | --- |
| Trigger | User cancels subscription |
| File | `cancel-subscription.ts:106` |
| Category | Transactional |

**Subject**: `Subscription cancellation confirmed`**Preheader**: `You still have access until {endDate}.`

**Body**

- **H1**: We'll miss you, {firstName}.
- **Body**: Your **{tier}** plan is cancelled. You keep full access until **{endDate}** — after that, you'll move to free tier.
- **Reactivate CTA** (secondary): `Changed your mind? Reactivate`
- **Feedback ask** (1 line): "Mind telling us why? Reply with one word — we read every reply."

---

## 11. Pause / Resume Confirmation

| Field | Value |
| --- | --- |
| Trigger | User pauses or resumes subscription |
| File | `pause-subscription.ts:119` |
| Category | Transactional |

**Subject (pause)**: `Your plan is paused. Nothing is lost`**Subject (resume)**: `Welcome back, your plan is active again`

**Body (pause)**

- **H1**: Paused.
- **Body**: Your **{tier}** plan is paused. We won't bill you until you resume. You can resume anytime from Settings.
- **CTA**: `Resume now`

**Body (resume)**

- **H1**: You're back in.
- **Body**: Your **{tier}** plan is active again. Next billing: {date}.
- **CTA**: `Start practicing`

---

## 12. Reactivation Confirmation

| Field | Value |
| --- | --- |
| Trigger | User reactivates a cancelled-pending subscription |
| File | `reactivate-subscription.ts:112` |
| Category | Transactional |

**Subject**: `Good to have you back, your plan is active`

**Body**

- **H1**: Welcome back, {firstName}.
- **Body**: Your **{tier}** plan is reactivated. Auto-renewal is back on — next billing **{nextBillingDate}**.
- **Plan summary card**: tier · next billing · benefits unlocked
- **CTA**: `Continue practicing`

---

## 13. Subscription Expired

| Field | Value |
| --- | --- |
| Trigger | Daily cron — `subscription_end` passed |
| File | `reset-expired-subscriptions.ts:71` |
| Category | Lifecycle |

**Subject**: `{firstName}, your plan has ended. Your progress is safe`**Preheader**: `Your data is safe — pick up where you left off.`

**Body**

- **H1**: Your {tier} plan expired
- **Body**: You've been moved to the free tier. **All your sessions, scores, and progress are preserved.**
- **Free plan data**: 2 free mock interviews · your data fully preserved
- **Primary CTA**: `Renew {tier}` → `/pricing`
- **Secondary CTA**: `Continue on free tier` → `/dashboard`

---

## 14. Payment Failed / Halted

| Field | Value |
| --- | --- |
| Trigger | Razorpay `subscription.halted` (all retries failed) |
| File | `razorpay-webhook.ts:301` |
| Category | Transactional / Security |

**Subject**: `Your payment didn't go through`**Preheader**: `Update your payment method to restore access.`

**Body**

- **H1**: We couldn't process your payment
- **Body**: After several retries, your **{tier}** payment didn't go through. You've been moved to free tier.
- **What you lost** (compact 2-col table): feature → status (the paused features listed in the email; free plan includes 2 free sessions)
- **Primary CTA**: `Update payment method` → settings deep link
- **Tiny**: "Common fixes: insufficient funds, expired card, bank-side block on autopay."

---

## 15. Re-engagement (Tiered)

| Field | Value |
| --- | --- |
| Trigger | Daily cron, inactivity tiers |
| File | `re-engage-users.ts` |
| Category | Lifecycle |

### 15a. Day 1–3 (Free)

**Subject**: `{firstName}, your next practice session is ready` (first-session variant: `{firstName}, your first practice session is ready`)**Body**: One sentence on weakest skill from last session, single CTA `Start session` (3 questions, 10 min).

### 15b. Day 3–7 (Free)

**Subject**: `{firstName}, your {skill} could use a refresh`**Body**: Names the weakest skill from the last session. CTA `Practice {skill}` (or `Upgrade from ₹9` once both free sessions are used).

### 15c. Day 7–14 (Free) — Last chance

**Subject**: `{firstName}, your practice sessions are still here`**Body**: Last reminder. Shows last score when known. CTA `Start practicing`.

### 15d. Paid 14+ days

**Subject**: `{firstName}, ready for a quick drill?`**Body**: Two weeks since the last session; points to the dashboard for Sprint Pack sessions remaining. CTA `Start a quick session`.

### 15e. Paid 30+ days

**Subject**: `{firstName}, it has been a month. Ready for a drill?`**Body**: Soft, no guilt. Footer: "No pressure. Your progress is saved, and your dashboard shows what is left on your Sprint Pack." (No pause/cancel line: the Sprint Pack is a one-time purchase.) CTA `Start a focused drill`.

**All re-engagement footers**: prominent unsubscribe + "Pause emails for 30 days" link.

---

## 16. Weekly Progress Digest

| Field | Value |
| --- | --- |
| Trigger | Weekly cron on user's signup-weekday |
| File | `weekly-summary.ts` |
| Category | Lifecycle |
| Status | Live (marketing opt-out honored) |

**Subject** (varies): `{firstName}, your score is up {delta} points` / `{firstName}, here's your week: score {score}` / `{firstName}, you scored {score} this week` (first score)**Preheader**: `{N} sessions this week, latest score {score}.`

**Body**

- **H1**: This week in your prep
- **Stats row** (3 tiles): Sessions · Avg score · Best skill
- **Score chart** (sparkline, last 4 weeks)
- **Weakest skill callout**: "Your {skill} dropped {N} pts. Run a focused session?"
- **CTA**: `View full report` → `/dashboard`
- **Streak row** (if active): "🔥 {N}-day streak"

---

## 17. Account Deletion Confirmation

| Field | Value |
| --- | --- |
| Trigger | User deletes account (sent **before** wipe) |
| File | `delete-account.ts:144` |
| Category | Transactional / Security |

**Subject**: `Your account has been deleted`

**Body**

- **H1**: Account deleted
- **Body**: We've removed your HireStepX account and the data associated with it.
- **What was deleted** list: profile · sessions · payment history · resume · audit logs
- **Body**: "You can create a new account anytime."
- **Support line**: "Questions? Email hello@hirestepx.com. We keep deletion-confirmation records for 30 days for compliance."

---

## 18. System Alert *(internal)*

| Field | Value |
| --- | --- |
| Trigger | Uptime check every 15 min, on degraded |
| File | `uptime-check.ts:37` |
| Category | Internal ops |
| Recipient | `support@hirestepx.com` only |

**Subject**: `[ALERT] HireStepX services degraded: {service}: {status}`

**Body** (plain text, no HTML chrome)

```
Service: {service}
Status: {status}
Timestamp: {ISO}
Endpoint: {url}
Details: {raw json}
```

---

## Design checklist for new emails

 1. **Subject ≤ 50 chars**, no ALL CAPS, no clickbait
 2. **Preheader** set explicitly (don't let it auto-fill from body)
 3. **One primary CTA** — anything else is a text link
 4. **HTML-escape** every interpolated user value (already enforced server-side; double-check in templates)
 5. **Plain-text alternative** included (Resend auto, but verify)
 6. **Footer**: physical address + unsubscribe (lifecycle only) + "Why am I getting this?"
 7. **Test rendering**: Gmail (web/iOS), Outlook desktop, Apple Mail — Litmus or Mailtrap before merge
 8. **Dark mode**: avoid pure-white backgrounds for cards; use `#F9FAFB` so it inverts cleanly
 9. **i18n note**: copy is English-only today; ₹ amounts always; IST for times where shown
10. **Tracking**: Resend open/click tracking on lifecycle, **off** for security/transactional

## When adding a new email type

1. Extract template into `server-handlers/_email-templates.ts` if it doesn't exist; keep templates pure
2. Add row to this doc (copy, file, trigger, rate limit)
3. Add a unit test for the template in `src/__tests__/emailTemplates.test.ts` (snapshot the HTML)
4. If lifecycle/marketing: gate behind user `email_preferences` column in `profiles`
5. Log via `service_usage` (fire-and-forget) for cost/volume tracking

---

## Additional lifecycle and billing emails

| Email | File | Subject |
| --- | --- | --- |
| Day 1 activation (never started) | `send-activation-emails.ts` | `{firstName}, your 2 free sessions are waiting` (signed `The HireStepX team`) |
| Win-back (paid plan lapsed 10-21 days) | `send-winback-emails.ts` | `{firstName}, your best score was {score}/100` or `{firstName}, your HireStepX progress is still here` (signed `The HireStepX team`) |
| Sprint Pack day 2 | `send-onboarding-drip.ts` | `{firstName}, your Sprint Pack is ready to use` |
| Sprint Pack day 5 | `send-onboarding-drip.ts` | `{firstName}, how is your {role} prep going?` |
| Report ready | `save-session.ts` | `{firstName}, your interview report is ready` |
| First session done | `save-session.ts` | `{firstName}, you've completed your first HireStepX session` |
| Both free sessions used | `save-session.ts` | `{firstName}, you've used both free sessions` |
| Account exists | `send-welcome.ts` | `{firstName}, you already have an account` |
| Employer interest nudge | `re-engage-users.ts` | `{firstName}, employers are looking at your profile` |
| Refund started | `razorpay-webhook.ts` | `Your refund is on its way` (5-7 business days) |
| Refund done | `razorpay-webhook.ts` | `Your refund has been processed` (5-7 business days) |

Facts every email must keep true: Single session ₹9; Sprint Pack ₹39 for 5 sessions over 30 days; no Pro tier; never "unlimited"; 2 free sessions; verify link valid 24 hours; reset link valid 60 minutes. Use US spelling ("practice", "practicing").
