/* HireStepX — Settings canvas / component
   IA mirrors production: global left sidebar (Dashboard, Practice,
   Resume analysis, Progress, Bookmarks + Settings active) — same
   shape as the Dashboard canvas — and
   horizontal section pills at the top of <main>, matching
   src/DashboardSettings.tsx. Pills have roving tabindex + arrow keys.
   Notifications storyboard ships for design review only; it's not in
   ALL_SECTIONS in production yet. */
import React, { useId, useState } from "react";
import { tokens as t, fonts as f, shadows } from "../design-system/_tokens";

export type SettingsTab =
  | "account"
  | "interview"
  | "notifications"
  | "plan"
  | "referral";

export interface SettingsProps {
  tab?: SettingsTab;
}

/* Tinted-toward-coal/cream overlays so the "never #000/#fff" law holds. */
const local = {
  coalShadow08: "rgba(14, 12, 8, 0.08)",
  coalShadow18: "rgba(14, 12, 8, 0.18)",
  creamMuted: "rgba(250, 247, 240, 0.86)",
  cream10: "rgba(250, 247, 240, 0.10)",
  errorBorder: "rgba(185, 28, 28, 0.22)",
} as const;

/* Production ALL_SECTIONS — Notifications is hidden in src/DashboardSettings.tsx
   until fully implemented. The canvas mirrors that. */
const PILLS: Array<{ id: SettingsTab; label: string }> = [
  { id: "account", label: "Account" },
  { id: "interview", label: "Interview" },
  { id: "plan", label: "Plan & Data" },
  { id: "referral", label: "Referral" },
];

const GLOBAL_NAV: Array<{ id: string; label: string; icon: React.ReactNode; badge?: string }> = [
  { id: "dashboard", label: "Dashboard", icon: <NavIcon path="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" /> },
  { id: "practice", label: "Practice", icon: <NavIcon path="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4" /> },
  { id: "resume", label: "Resume analysis", icon: <NavIcon path="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2zM14 2v6h6" /> },
  { id: "progress", label: "Progress", icon: <NavIcon path="M23 6L13.5 15.5 8.5 10.5 1 18M17 6h6v6" /> },
  { id: "bookmarks", label: "Bookmarks", icon: <NavIcon path="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /> },
];

const SECONDARY_NAV: Array<{ id: string; label: string; icon: React.ReactNode }> = [
  { id: "settings", label: "Settings", icon: <NavIcon path="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /> },
  { id: "help", label: "Help & support", icon: <NavIcon path="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" /> },
  { id: "logout", label: "Logout", icon: <NavIcon path="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /> },
];

export function Settings({ tab = "account" }: SettingsProps) {
  return (
    <div style={shell} className="hsx-settings">
      <Stylesheet />
      <div style={grid} data-grid>
        <GlobalSidebar />
        <main style={mainCol} aria-labelledby="settings-page-title">
          <PageHeader />
          <SectionPills active={tab} />
          <div
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={tab === "notifications" ? "settings-notice-future" : `tab-${tab}`}
            tabIndex={0}
            style={sectionWrap}
          >
            {tab === "account" && <AccountSection />}
            {tab === "interview" && <InterviewSection />}
            {tab === "notifications" && <NotificationsSection />}
            {tab === "plan" && <PlanSection />}
            {tab === "referral" && <ReferralSection />}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── Global sidebar (mirrors dashboard canvas) ─────────────────────── */

function GlobalSidebar() {
  return (
    <aside style={sidebar} aria-label="Main navigation" data-sidebar>
      <div style={{ padding: "0 12px", marginBottom: 28 }}>
        <Wordmark />
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 4 }} aria-label="Primary">
        {GLOBAL_NAV.map((n) => (
          <SidebarItem key={n.id} item={n} active={false} />
        ))}
      </nav>

      <div style={planPanel}>
        <span style={proPill}>PRO</span>
        <div style={{ fontFamily: f.serif, fontSize: 18, color: t.coal, lineHeight: 1.2, margin: "10px 0 4px" }}>
          Renews 14 Jul 2026
        </div>
        <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: 0, lineHeight: 1.5 }}>
          Unlimited mocks, salary negotiation, skill radar.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 12, borderTop: `1px solid ${t.line}` }}>
        {SECONDARY_NAV.map((n) => (
          <SidebarItem key={n.id} item={n} active={n.id === "settings"} />
        ))}
      </div>
    </aside>
  );
}

function SidebarItem({ item, active }: { item: { id: string; label: string; icon: React.ReactNode; badge?: string }; active: boolean }) {
  return (
    <a
      href={`#${item.id}`}
      aria-current={active ? "page" : undefined}
      style={sidebarItem(active)}
    >
      <span style={sidebarItemIcon(active)} aria-hidden="true">{item.icon}</span>
      <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: active ? 600 : 500, color: active ? t.coal : t.inkSoft, flex: 1 }}>
        {item.label}
      </span>
      {item.badge && (
        <span style={{ fontFamily: f.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: t.copper, background: t.copper100, padding: "3px 6px", borderRadius: 4 }}>{item.badge}</span>
      )}
      {active && <span style={{ width: 3, height: 16, borderRadius: 2, background: t.copper, marginLeft: 2 }} aria-hidden="true" />}
    </a>
  );
}

function Wordmark() {
  return (
    <span style={{ fontFamily: f.serif, fontSize: 22, letterSpacing: "-0.02em", color: t.coal, lineHeight: 1 }}>
      Hire<em style={{ color: t.copper, fontStyle: "italic" }}>Step</em>X
    </span>
  );
}

/* ─── Page header + section pills ───────────────────────────────────── */

function PageHeader() {
  return (
    <div style={pageHead}>
      <h1 style={pageTitle} id="settings-page-title">Settings</h1>
      <p style={pageSub}>Tune HireStepX to match how you practice.</p>
    </div>
  );
}

function SectionPills({ active }: { active: SettingsTab }) {
  /* Roving tabindex + arrow-key nav, matching DashboardSettings.tsx
     keyboard semantics. */
  const [focused, setFocused] = useState<SettingsTab>(active);
  const move = (delta: number) => {
    const idx = PILLS.findIndex((p) => p.id === focused);
    const next = PILLS[(idx + delta + PILLS.length) % PILLS.length];
    setFocused(next.id);
  };
  return (
    <div style={pillBar}>
      <div role="tablist" aria-label="Settings sections" aria-orientation="horizontal" style={pillRow} data-pills>
        {PILLS.map((p) => {
          const on = p.id === active;
          const tabbable = p.id === focused;
          return (
            <button
              key={p.id}
              id={`tab-${p.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`panel-${p.id}`}
              tabIndex={tabbable ? 0 : -1}
              onFocus={() => setFocused(p.id)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
                if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
                if (e.key === "Home") { e.preventDefault(); setFocused(PILLS[0].id); }
                if (e.key === "End") { e.preventDefault(); setFocused(PILLS[PILLS.length - 1].id); }
              }}
              style={pillBtn(on)}
            >
              {p.label}
              {on && <span style={pillUnderline} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {/* Future-state label for the Notifications storyboard. Lives outside
          the tablist so it doesn't violate the role="tab"-only-children
          contract. It also labels the panel via aria-labelledby above. */}
      {active === "notifications" && (
        <div
          id="settings-notice-future"
          role="note"
          aria-label="Notifications, future state design"
          style={futureNoticeRow}
        >
          <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.copper }}>Notifications</span>
          <span aria-hidden="true" style={{ fontFamily: f.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: t.copper, background: t.copper100, padding: "3px 6px", borderRadius: 4 }}>FUTURE</span>
        </div>
      )}
    </div>
  );
}

/* ─── Account ───────────────────────────────────────────────────────── */

function AccountSection() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40, maxWidth: 880 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHead kicker="Account" title="Profile" desc="The basics we use to personalise interview prompts and coaching." />
      <Card>
        <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 24 }}>
          <div style={avatarLg} aria-hidden="true">AM</div>
          <div>
            <div style={{ fontFamily: f.sans, fontSize: 16, fontWeight: 700, color: t.coal }}>Arjun Mehta</div>
            <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 4 }}>arjun.mehta@gmail.com · Pro tier</div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button type="button" style={subtleBtn}>Upload photo</button>
              <button type="button" style={subtleBtnGhost}>Remove</button>
            </div>
          </div>
        </div>
        <Grid2>
          <Field label="Full name" value="Arjun Mehta" />
          <Field label="Display name" value="Arjun" />
          <Field label="Target role" value="Senior Product Manager" />
          <Field label="Target company" value="Razorpay" />
          <Field label="Industry" value="Fintech" />
          <FieldSelect label="Years of experience" value="6 to 8 years" />
        </Grid2>
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 20, gap: 10, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: t.success }} />
          Saved automatically when you leave a field
        </div>
      </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHead title="Security" desc="Sign-in and devices currently using your account." />
      <Card density="tight">
        <KeyValue label="Email" value="arjun.mehta@gmail.com" right={<TinyChip tone="success">Verified</TinyChip>} />
        <Divider />
        <KeyValue label="Password" value="Send a reset link to your email when you need to change it." right={<button type="button" style={subtleBtn}>Send reset link</button>} />
        <Divider />
        <KeyValue label="Sign-in method" value="Email and password, with Google as a backup" right={<TinyChip tone="success">Active</TinyChip>} />
      </Card>

      <Card density="tight">
        <SubHeader title="Active devices" hint="One device at a time. Signing in elsewhere automatically signs out this device. HireStepX rotates the token on every new sign-in." />
        <DeviceRow current name="Chrome on macOS, Mumbai" sub="Active now, this device" />
        <DeviceRow name="Safari on iPhone, Mumbai" sub="2 hours ago" />
        <DeviceRow name="Chrome on Windows, Bengaluru" sub="3 days ago" />
      </Card>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHead title="Danger zone" desc="These actions cannot be undone." tone="danger" />
      <DangerCard
        title="Delete account"
        body="Permanently remove your profile, sessions, and resume data. We retain anonymised analytics for 30 days."
        cta="Delete account"
      />
      </div>
    </div>
  );
}

/* ─── Interview ─────────────────────────────────────────────────────── */

function InterviewSection() {
  return (
    <SectionStack>
      <SectionHead kicker="Interview" title="What you practice" desc="Picks the question mix and difficulty for every new mock. Stored on your profile so each session inherits them automatically." />

      <Card>
        <SubHeader title="Difficulty" hint="Drives question selection and follow-up depth. Realistic mirrors a senior round at an Indian unicorn." />
        <SegmentedField label="Default difficulty" options={["Warm-up", "Realistic", "Stretch", "Brutal"]} initial="Realistic" />
      </Card>

      <Card>
        <SubHeader title="Question types" hint="Pick at least one. Every new mock pulls from the categories you keep on." />
        <CheckboxRow label="Behavioural (STAR)" checked />
        <CheckboxRow label="Salary negotiation" checked />
        <CheckboxRow label="Reverse interview (your questions for them)" checked />
        <CheckboxRow label="Case and product sense" />
        <CheckboxRow label="Resume deep-dives" checked />
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 16, gap: 10, fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
          <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: t.success }} />
          Saved automatically
        </div>
      </Card>

      <Card density="tight">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <span aria-hidden="true" style={{ ...kicker, color: t.copper, marginTop: 4 }}>Roadmap</span>
        </div>
        <div style={{ fontFamily: f.serif, fontSize: 20, color: t.coal, lineHeight: 1.25, margin: "6px 0 8px" }}>
          Voice, pace, and language coming next
        </div>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, margin: 0, maxWidth: 580 }}>
          Choose between Sarvam and Azure voices, dial in speaking pace and interrupt latency, and switch between English, Hindi, and Hinglish mid-session. Today these are baked into each interview; user-level preferences land alongside the next backend release.
        </p>
      </Card>
    </SectionStack>
  );
}

/* ─── Notifications (future state) ──────────────────────────────────── */

function NotificationsSection() {
  return (
    <SectionStack>
      <SectionHead kicker="Notifications — future state" title="When we reach out" desc="Quiet by default. We only nudge when there's something earned, or worth showing up for. This section is designed but not yet shipped — production hides it until the email pipeline lands." />
      <Card density="tight">
        <SubHeader title="Browser notifications" hint="Native pop-ups on this device." />
        <KeyValue label="Status" value="Allowed on arjun@macbook" right={<TinyChip tone="success">Granted</TinyChip>} />
      </Card>
      <Card density="tight">
        <SubHeader title="Email cadence" hint="Delivered via Resend. Unsubscribe links live at the bottom of every email." />
        <ToggleRow id="n-daily" title="Daily practice reminder" desc="9:00 AM your local time. Skipped on streak-rest days." on />
        <Divider />
        <ToggleRow id="n-streak" title="Streak milestones" desc="7, 14, 30, and 90-day celebrations." on />
        <Divider />
        <ToggleRow id="n-decay" title="Skill decay alerts" desc="When a previously-strong skill drifts below 70%." on />
        <Divider />
        <ToggleRow id="n-coach" title="Coach insights digest" desc="Weekly summary of patterns we've noticed." />
        <Divider />
        <ToggleRow id="n-product" title="Product updates" desc="New question banks, voice upgrades, interview formats." />
      </Card>
      <Card>
        <SubHeader title="Quiet hours" hint="We never reach out during these windows." />
        <Grid2>
          <FieldSelect label="From" value="10:00 PM" />
          <FieldSelect label="Until" value="7:00 AM" />
        </Grid2>
        <Toggle id="n-pause" label="Pause notifications during scheduled interviews" on />
      </Card>
    </SectionStack>
  );
}

/* ─── Plan & Data ───────────────────────────────────────────────────── */

function PlanSection() {
  return (
    <SectionStack>
      <SectionHead kicker="Plan & Data" title="Pro, invested in your offer" desc="Manage your subscription, see your invoices, and export your data." />

      <div style={planRow} data-plan-row>
        <PlanCard tier="Free" price="₹0" desc="2 mock interviews each month. Behavioural only." current={false} />
        <PlanCard tier="Pro" price="₹599 per month" desc="Unlimited mocks, salary negotiation, skill radar, priority voice." current />
        <PlanCard tier="Placement" price="₹4,999 one-time" desc="Coach reviews, mock panel of three, custom company prep." current={false} highlight />
      </div>

      <Card>
        <SubHeader title="This month" hint="Counted from your sessions table. Resets on the first of every month." />
        <UsageBar label="Mock interviews completed" value={18} total="Unlimited on Pro" pct={0.42} />
      </Card>

      <Card density="tight">
        <SubHeader title="Payment method" hint="Razorpay handles every renewal. UPI is fastest." />
        <KeyValue label="UPI" value="arjun.mehta@okhdfcbank" right={<TinyChip tone="success">Active</TinyChip>} />
      </Card>

      <Card density="tight">
        <SubHeader title="Payment history" hint="Every successful Razorpay charge on your account." />
        <InvoiceRow date="14 Jun 2026" amount="₹599" status="Paid" />
        <InvoiceRow date="14 May 2026" amount="₹599" status="Paid" />
        <InvoiceRow date="14 Apr 2026" amount="₹599" status="Paid" />
        <InvoiceRow date="14 Mar 2026" amount="₹599" status="Paid" />
        <InvoiceRow date="14 Feb 2026" amount="₹599" status="Paid" />
      </Card>

      <Card density="tight">
        <SubHeader title="Data" hint="Export everything, or delete on demand." />
        <KeyValue label="Export" value="CSV of every session, evaluation, and resume snapshot." right={<button type="button" style={subtleBtn}>Export CSV</button>} />
        <Divider />
        <KeyValue label="Cancel subscription" value="Access remains until 14 Jul 2026." right={<button type="button" style={subtleBtnGhost}>Cancel</button>} />
      </Card>
    </SectionStack>
  );
}

/* ─── Referral ──────────────────────────────────────────────────────── */

function ReferralSection() {
  return (
    <SectionStack>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHead kicker="Referral" title="Bring a friend, earn a month" desc="They get 20% off their first Pro month. You get a free month when they convert. Three earned, three to go before the lifetime cap." />

      <Card density="generous">
        <div style={referralHero} data-referral-hero>
          <div style={{ minWidth: 0 }}>
            <div style={kicker}>Your referral link</div>
            <div style={referralLink}>hirestepx.com/r/<span style={{ color: t.copper }}>arjun-mh</span></div>
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" style={primaryBtn}>Copy link</button>
              <button type="button" style={subtleBtn}>Share on WhatsApp</button>
              <button type="button" style={subtleBtnGhost}>Email a friend</button>
            </div>
          </div>
          <div style={referralProgress} aria-label="Lifetime referral progress">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, fontWeight: 700 }}>Free months earned</span>
              <span style={{ fontFamily: f.mono, fontSize: 12, color: t.inkSoft }}>3 of 6</span>
            </div>
            <div role="progressbar" aria-label="Free months earned" aria-valuemin={0} aria-valuemax={6} aria-valuenow={3} style={{ position: "relative", height: 8, background: t.line, borderRadius: 100 }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: 8, width: "50%", background: t.copper, borderRadius: 100 }} />
            </div>
            <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 10, lineHeight: 1.5 }}>Each converted invite adds one month, capped at six.</div>
          </div>
        </div>
      </Card>
      </div>

      <Card density="tight">
        <SubHeader title="Your invites" hint="We tell you when they sign up, and again when they convert." />
        <ReferRow name="Priya Shah" email="priya.s@gmail.com" sentAt="2d ago" status="Joined" />
        <ReferRow name="Karthik Iyer" email="kiyer.iit@gmail.com" sentAt="5d ago" status="Converted" />
        <ReferRow name="Ananya Rao" email="ananya@razorpay.com" sentAt="9d ago" status="Converted" />
        <ReferRow name="Vikram Singh" email="vsingh92@gmail.com" sentAt="14d ago" status="Pending" />
        <ReferRow name="Meera Pillai" email="meera.p@flipkart.com" sentAt="3w ago" status="Converted" />
      </Card>

      <Card>
        <SubHeader title="How it works" />
        <Step n={1} title="Share your link" desc="WhatsApp, email, anywhere. We track conversions by signup, no codes to remember." />
        <Step n={2} title="They get 20% off" desc="First Pro month at ₹479 instead of ₹599. The discount applies automatically." />
        <Step n={3} title="You earn a free month" desc="Credited the day they pay. Stacks up to six months before the cap pauses." />
      </Card>
    </SectionStack>
  );
}

/* ─── Section primitives ────────────────────────────────────────────── */

function SectionStack({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 880 }}>{children}</div>;
}

function SectionHead({ title, kicker: k, desc, tone }: { title: string; kicker?: string; desc?: string; tone?: "danger" }) {
  const headingId = useId();
  return (
    <div style={{ marginTop: 8 }}>
      {k && <div style={{ ...kicker, color: tone === "danger" ? t.error : t.copper }}>{k}</div>}
      <h2 id={headingId} style={{ fontFamily: f.serif, fontSize: 28, letterSpacing: "-0.02em", color: tone === "danger" ? t.error : t.coal, margin: "6px 0 6px", lineHeight: 1.15 }}>
        {title}
      </h2>
      {desc && <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0, lineHeight: 1.55, maxWidth: 620 }}>{desc}</p>}
    </div>
  );
}

function SubHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal }}>{title}</div>
      {hint && <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}

type CardDensity = "default" | "tight" | "generous";
function Card({ children, density = "default" }: { children: React.ReactNode; density?: CardDensity }) {
  const pad =
    density === "tight" ? "22px 26px" :
    density === "generous" ? "40px 40px" :
    "28px 32px";
  return <div style={{ ...cardStyle, padding: pad }}>{children}</div>;
}

function DangerCard({ title, body, cta }: { title: string; body: string; cta: string }) {
  return (
    <div style={{ ...cardStyle, padding: "28px 32px", borderColor: local.errorBorder, background: t.error100 }}>
      <div style={{ fontFamily: f.sans, fontSize: 15, fontWeight: 700, color: t.error }}>{title}</div>
      <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "8px 0 18px", lineHeight: 1.6, maxWidth: 560 }}>{body}</div>
      <button type="button" style={dangerBtn}>{cta}</button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={fieldLabel}>{label}</label>
      <input id={id} defaultValue={value} style={inputStyle} />
    </div>
  );
}

function FieldSelect({ label, value }: { label: string; value: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} style={fieldLabel}>{label}</label>
      <button id={id} type="button" style={{ ...inputStyle, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left" }}>
        <span>{value}</span>
        <span style={{ color: t.inkSoft, fontFamily: f.mono, fontSize: 11 }} aria-hidden="true">▾</span>
      </button>
    </div>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="hsx-settings-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>{children}</div>;
}

function KeyValue({ label, value, right }: { label: string; value: string; right?: React.ReactNode }) {
  return (
    <div className="hsx-kv" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", gap: 16 }}>
      <div>
        <div style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>{label}</div>
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 2 }}>{value}</div>
      </div>
      <div>{right}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: t.line, margin: "14px 0" }} role="separator" />;
}

function DeviceRow({ name, sub, current }: { name: string; sub: string; current?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${t.line}`, gap: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={deviceIcon} aria-hidden="true">
          <NavIcon path="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 20h8M12 16v4" />
        </span>
        <div>
          <div style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>{name}</div>
          <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 2 }}>{sub}</div>
        </div>
      </div>
      {current ? <TinyChip tone="success">This device</TinyChip> : <button type="button" style={linkBtn}>Sign out</button>}
    </div>
  );
}

function TinyChip({ children, tone }: { children: React.ReactNode; tone?: "success" | "warn" }) {
  const palette =
    tone === "success" ? { bg: t.success100, fg: t.success } :
    tone === "warn" ? { bg: t.warning100, fg: t.warning } :
    { bg: t.indigo100, fg: t.indigo };
  return (
    <span style={{ fontFamily: f.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px", borderRadius: 4, background: palette.bg, color: palette.fg, fontWeight: 700 }}>
      {children}
    </span>
  );
}

function Toggle({ id, label, on, inline, ariaLabelledBy }: { id?: string; label?: string; on?: boolean; inline?: boolean; ariaLabelledBy?: string }) {
  const fallback = useId();
  const ariaId = id ?? fallback;
  const labelledBy = ariaLabelledBy ?? (label ? `${ariaId}-label` : undefined);
  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-labelledby={labelledBy}
      style={switchBtn}
    >
      <span style={switchTrack(!!on)}>
        <span style={switchThumb(!!on)} />
      </span>
    </button>
  );
  if (inline || !label) return track;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
      {track}
      <span id={`${ariaId}-label`} style={{ fontFamily: f.sans, fontSize: 13, color: t.coal }}>{label}</span>
    </div>
  );
}

function ToggleRow({ id, title, desc, on }: { id: string; title: string; desc: string; on?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "10px 0", gap: 24 }}>
      <div>
        <div id={`${id}-label`} style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>{title}</div>
        <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 4, lineHeight: 1.5, maxWidth: 480 }}>{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!on}
        aria-labelledby={`${id}-label`}
        style={switchBtn}
      >
        <span style={switchTrack(!!on)}>
          <span style={switchThumb(!!on)} />
        </span>
      </button>
    </div>
  );
}

function CheckboxRow({ label, checked }: { label: string; checked?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", cursor: "pointer", minHeight: 44 }}>
      <input id={id} type="checkbox" defaultChecked={checked} style={srOnly} />
      <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${checked ? t.indigo : t.lineStrong}`, background: checked ? t.indigo : t.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {checked && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={t.white} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </span>
      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal }}>{label}</span>
    </label>
  );
}

function SegmentedField({ label, options, initial }: { label: string; options: string[]; initial: string }) {
  const [active, setActive] = useState(initial);
  const move = (delta: number) => {
    const idx = options.indexOf(active);
    setActive(options[(idx + delta + options.length) % options.length]);
  };
  return (
    <div role="radiogroup" aria-label={label} style={{ padding: "8px 0" }}>
      <div style={{ ...fieldLabel, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "inline-flex", padding: 4, background: t.creamSoft, borderRadius: 10, border: `1px solid ${t.line}` }}>
        {options.map((o) => {
          const on = o === active;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setActive(o)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
                if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
                if (e.key === "Home") { e.preventDefault(); setActive(options[0]); }
                if (e.key === "End") { e.preventDefault(); setActive(options[options.length - 1]); }
              }}
              style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 7, border: "none", cursor: "pointer", background: on ? t.white : "transparent", color: on ? t.coal : t.inkSoft, boxShadow: on ? `0 1px 2px ${local.coalShadow08}` : "none", minHeight: 36 }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlanCard({ tier, price, desc, current, highlight }: { tier: string; price: string; desc: string; current?: boolean; highlight?: boolean }) {
  const cta = current ? "You're on Pro" : highlight ? "Upgrade to Placement" : "Switch to Free";
  return (
    <div style={{ flex: 1, background: current ? t.indigoDeep : t.white, color: current ? t.cream : t.coal, border: `1px solid ${current ? t.indigoDeep : t.line}`, borderRadius: 14, padding: 24, boxShadow: current ? shadows.modal : shadows.card, position: "relative", overflow: "hidden", minWidth: 0 }}>
      {current && <span style={{ position: "absolute", top: 14, right: 14, fontFamily: f.mono, fontSize: 10, letterSpacing: "0.14em", color: t.copper, textTransform: "uppercase", fontWeight: 700 }}>Current</span>}
      {highlight && !current && <span style={{ position: "absolute", top: 14, right: 14, fontFamily: f.mono, fontSize: 10, letterSpacing: "0.14em", color: t.copper, textTransform: "uppercase", fontWeight: 700 }}>Best for the offer</span>}
      <div style={{ fontFamily: f.serif, fontSize: 26, color: current ? t.cream : t.coal, marginBottom: 6 }}>{tier}</div>
      <div style={{ fontFamily: f.serif, fontSize: 22, color: t.copper, marginBottom: 14 }}>{price}</div>
      <div style={{ fontFamily: f.sans, fontSize: 13, color: current ? local.creamMuted : t.inkSoft, lineHeight: 1.55, marginBottom: 20 }}>{desc}</div>
      {current ? (
        <button type="button" disabled aria-disabled="true" style={{ ...primaryBtn, width: "100%", background: local.cream10, color: t.cream, cursor: "default" }}>{cta}</button>
      ) : (
        <button type="button" style={{ ...primaryBtn, width: "100%" }}>{cta}</button>
      )}
    </div>
  );
}

function UsageBar({ label, value, total, pct }: { label: string; value: number; total: string | number; pct: number }) {
  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, fontWeight: 600 }}>{label}</span>
        <span style={{ fontFamily: f.mono, fontSize: 12, color: t.inkSoft }}>
          {value} <span style={{ color: t.inkSoft }}>of {total}</span>
        </span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)} style={{ position: "relative", height: 6, background: t.line, borderRadius: 100 }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: 6, width: `${Math.min(pct * 100, 100)}%`, background: t.copper, borderRadius: 100 }} />
      </div>
    </div>
  );
}

function InvoiceRow({ date, amount, status }: { date: string; amount: string; status: string }) {
  return (
    <div className="hsx-invoice" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 0.8fr", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${t.line}`, gap: 12 }}>
      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, fontWeight: 500 }}>{date}</span>
      <span style={{ fontFamily: f.mono, fontSize: 12, color: t.inkSoft }}>{amount}</span>
      <TinyChip tone="success">{status}</TinyChip>
    </div>
  );
}

function ReferRow({ name, email, sentAt, status }: { name: string; email: string; sentAt: string; status: "Joined" | "Converted" | "Pending" }) {
  const tone = status === "Converted" ? "success" : status === "Joined" ? undefined : "warn";
  return (
    <div className="hsx-refer" style={{ display: "grid", gridTemplateColumns: "1.6fr 2fr 0.8fr 0.8fr", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${t.line}`, gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{ ...avatar, width: 30, height: 30, fontSize: 11 }} aria-hidden="true">{name.split(" ").map((p) => p[0]).join("")}</span>
        <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
      </div>
      <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</span>
      <span style={{ fontFamily: f.mono, fontSize: 12, color: t.inkSoft }}>{sentAt}</span>
      <TinyChip tone={tone}>{status}</TinyChip>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "14px 0" }}>
      <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: "50%", background: t.indigo100, color: t.indigo, fontFamily: f.serif, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {n}
      </span>
      <div>
        <div style={{ fontFamily: f.sans, fontSize: 14, color: t.coal, fontWeight: 700 }}>{title}</div>
        <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 4, lineHeight: 1.55, maxWidth: 560 }}>{desc}</div>
      </div>
    </div>
  );
}

/* ─── Atoms ─────────────────────────────────────────────────────────── */

function NavIcon({ path }: { path: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  );
}

function Stylesheet() {
  return (
    <style>{`
      .hsx-settings *:focus-visible {
        outline: 2px solid ${t.indigoRing};
        outline-offset: 2px;
        border-radius: 6px;
      }
      .hsx-settings [role="tab"]:focus-visible {
        outline-offset: 4px;
        border-radius: 8px;
      }
      .hsx-settings [role="tabpanel"]:focus-visible {
        outline-offset: 6px;
      }
      @media (max-width: 960px) {
        .hsx-settings [data-grid] {
          grid-template-columns: 1fr !important;
        }
        .hsx-settings [data-sidebar] {
          display: none !important;
        }
        .hsx-settings [data-plan-row] {
          flex-direction: column !important;
        }
        .hsx-settings [data-referral-hero] {
          grid-template-columns: 1fr !important;
        }
        .hsx-settings .hsx-settings-grid2 {
          grid-template-columns: 1fr !important;
        }
        .hsx-settings .hsx-invoice,
        .hsx-settings .hsx-refer {
          grid-template-columns: 1fr !important;
          row-gap: 6px !important;
        }
        .hsx-settings .hsx-refer > * {
          padding-left: 0 !important;
        }
      }
      @media (max-width: 520px) {
        .hsx-settings main[aria-labelledby="settings-page-title"] {
          padding: 24px 20px 64px !important;
        }
        .hsx-settings .hsx-kv {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 10px !important;
        }
        .hsx-settings [data-pills] {
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch;
          flex-wrap: nowrap !important;
        }
      }
    `}</style>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */

const shell: React.CSSProperties = {
  width: "100%",
  minHeight: "100vh",
  background: t.cream,
  color: t.coal,
  fontFamily: f.sans,
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px 1fr",
  minHeight: "100vh",
};

const sidebar: React.CSSProperties = {
  background: t.cream,
  borderRight: `1px solid ${t.line}`,
  padding: "28px 18px",
  display: "flex",
  flexDirection: "column",
  gap: 24,
  position: "sticky",
  top: 0,
  height: "100vh",
  overflowY: "auto",
};

const sidebarItem = (on: boolean): React.CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "11px 14px",
  borderRadius: 10,
  textDecoration: "none",
  cursor: "pointer",
  background: on ? t.creamSoft : "transparent",
  transition: "background 160ms cubic-bezier(0.16, 1, 0.3, 1)",
  minHeight: 44,
  boxSizing: "border-box",
});

const sidebarItemIcon = (on: boolean): React.CSSProperties => ({
  width: 22,
  height: 22,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: on ? t.coal : t.inkSoft,
  flexShrink: 0,
});

const planPanel: React.CSSProperties = {
  marginTop: "auto",
  marginBottom: 12,
  padding: "14px 16px",
  background: t.creamSoft,
  border: `1px solid ${t.line}`,
  borderRadius: 12,
};

const proPill: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: "0.16em",
  color: t.copper,
  background: t.copper100,
  padding: "3px 7px",
  borderRadius: 4,
  display: "inline-block",
};

const mainCol: React.CSSProperties = {
  padding: "32px 40px 80px",
  minWidth: 0,
  maxWidth: 1100,
  width: "100%",
  boxSizing: "border-box",
};

const pageHead: React.CSSProperties = {
  marginBottom: 28,
};

const pageTitle: React.CSSProperties = {
  fontFamily: f.serif,
  fontSize: 36,
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  margin: "0 0 6px",
  color: t.coal,
  fontWeight: 400,
};

const pageSub: React.CSSProperties = {
  fontFamily: f.sans,
  fontSize: 14,
  color: t.inkSoft,
  margin: 0,
  lineHeight: 1.55,
  maxWidth: 640,
};

const pillBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: `1px solid ${t.line}`,
  marginBottom: 28,
  gap: 16,
  flexWrap: "wrap",
};

const pillRow: React.CSSProperties = {
  display: "flex",
  gap: 4,
};

const futureNoticeRow: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 14px",
  border: `1px solid ${t.copper}`,
  borderRadius: 999,
  background: t.copper100,
};

const pillBtn = (on: boolean): React.CSSProperties => ({
  position: "relative",
  fontFamily: f.sans,
  fontSize: 14,
  fontWeight: on ? 600 : 500,
  color: on ? t.coal : t.inkSoft,
  background: "transparent",
  border: "none",
  padding: "14px 18px",
  cursor: "pointer",
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
});

const pillUnderline: React.CSSProperties = {
  position: "absolute",
  left: 14,
  right: 14,
  bottom: -1,
  height: 2,
  background: t.copper,
};

const sectionWrap: React.CSSProperties = {
  minWidth: 0,
};

const cardStyle: React.CSSProperties = {
  background: t.white,
  border: `1px solid ${t.line}`,
  borderRadius: 14,
  boxShadow: shadows.card,
};

const fieldLabel: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.12em",
  color: t.inkSoft,
  textTransform: "uppercase",
  display: "block",
  marginBottom: 8,
};

const kicker: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.18em",
  color: t.copper,
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: f.sans,
  fontSize: 14,
  color: t.coal,
  background: t.white,
  border: `1px solid ${t.lineStrong}`,
  borderRadius: 9,
  padding: "12px 14px",
  outline: "none",
  boxSizing: "border-box",
  minHeight: 44,
};

const primaryBtn: React.CSSProperties = {
  fontFamily: f.sans,
  fontSize: 13,
  fontWeight: 600,
  color: t.cream,
  background: t.indigo,
  border: "none",
  borderRadius: 9,
  padding: "12px 18px",
  cursor: "pointer",
  boxShadow: shadows.cta,
  minHeight: 44,
};

const subtleBtn: React.CSSProperties = {
  fontFamily: f.sans,
  fontSize: 13,
  fontWeight: 600,
  color: t.coal,
  background: t.white,
  border: `1px solid ${t.lineStrong}`,
  borderRadius: 9,
  padding: "10px 14px",
  cursor: "pointer",
  minHeight: 40,
};

const subtleBtnGhost: React.CSSProperties = {
  fontFamily: f.sans,
  fontSize: 13,
  fontWeight: 600,
  color: t.inkSoft,
  background: "transparent",
  border: "none",
  borderRadius: 9,
  padding: "10px 14px",
  cursor: "pointer",
  minHeight: 40,
};

const dangerBtn: React.CSSProperties = {
  fontFamily: f.sans,
  fontSize: 13,
  fontWeight: 600,
  color: t.white,
  background: t.error,
  border: "none",
  borderRadius: 9,
  padding: "12px 18px",
  cursor: "pointer",
  minHeight: 44,
};

const linkBtn: React.CSSProperties = {
  fontFamily: f.sans,
  fontSize: 13,
  fontWeight: 600,
  color: t.indigo,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

const avatar: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: t.indigoDeep,
  color: t.cream,
  fontFamily: f.sans,
  fontSize: 12,
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  letterSpacing: "0.04em",
};

const avatarLg: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  background: t.indigoDeep,
  color: t.cream,
  fontFamily: f.serif,
  fontSize: 26,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  letterSpacing: "0.02em",
};

const deviceIcon: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  background: t.creamSoft,
  color: t.inkSoft,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const planRow: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "stretch",
};

const referralHero: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  alignItems: "center",
  gap: 40,
};

const referralLink: React.CSSProperties = {
  fontFamily: f.mono,
  fontSize: 18,
  color: t.coal,
  marginTop: 12,
  padding: "14px 18px",
  background: t.creamSoft,
  border: `1px dashed ${t.lineStrong}`,
  borderRadius: 10,
  display: "inline-block",
  fontWeight: 500,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const referralProgress: React.CSSProperties = {
  padding: "20px 24px",
  background: t.creamSoft,
  border: `1px solid ${t.line}`,
  borderRadius: 12,
};

const switchBtn: React.CSSProperties = {
  width: 44,
  height: 44,
  padding: 0,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const switchTrack = (on: boolean): React.CSSProperties => ({
  width: 36,
  height: 20,
  borderRadius: 100,
  background: on ? t.indigo : t.lineStrong,
  position: "relative",
  transition: "background 200ms cubic-bezier(0.16, 1, 0.3, 1)",
  display: "inline-block",
});

const switchThumb = (on: boolean): React.CSSProperties => ({
  position: "absolute",
  top: 2,
  left: on ? 18 : 2,
  width: 16,
  height: 16,
  borderRadius: "50%",
  background: t.white,
  transition: "left 200ms cubic-bezier(0.16, 1, 0.3, 1)",
  boxShadow: `0 1px 2px ${local.coalShadow18}`,
});

const srOnly: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};
