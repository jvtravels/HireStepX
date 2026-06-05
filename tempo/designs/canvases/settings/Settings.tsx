/* HireStepX — Settings canvas / component
   Editorial-warm settings shell. Sidebar of tabs on the left, focused
   content pane on the right. Mock data inline. The `tab` prop drives
   the highlighted nav + rendered section. Auto-save semantics with a
   subtle saved chip; only the profile card uses explicit Save/Cancel
   because it edits many fields at once. */
import React, { useId } from "react";
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

const NAV: Array<{ id: SettingsTab; label: string; hint: string; icon: React.ReactNode }> = [
  { id: "account", label: "Account", hint: "Profile, password, devices",
    icon: <Icon path="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" /> },
  { id: "interview", label: "Interview", hint: "Voice, language, difficulty",
    icon: <Icon path="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4" /> },
  { id: "notifications", label: "Notifications", hint: "Reminders and nudges",
    icon: <Icon path="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" /> },
  { id: "plan", label: "Plan and data", hint: "Subscription, invoices, export",
    icon: <Icon path="M2 5h20v14H2zM2 10h20" /> },
  { id: "referral", label: "Referral", hint: "Invite friends, earn credits",
    icon: <Icon path="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M12.5 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM20 8v6M23 11h-6" /> },
];

export function Settings({ tab = "account" }: SettingsProps) {
  return (
    <div style={shell} className="hsx-settings">
      <Stylesheet />
      <TopBar />
      <div style={body} data-body>
        <Sidebar active={tab} />
        <main style={content} aria-labelledby="settings-section-title">
          {tab === "account" && <AccountSection />}
          {tab === "interview" && <InterviewSection />}
          {tab === "notifications" && <NotificationsSection />}
          {tab === "plan" && <PlanSection />}
          {tab === "referral" && <ReferralSection />}
        </main>
      </div>
    </div>
  );
}

/* ─── Shell chrome ──────────────────────────────────────────────────── */

function TopBar() {
  return (
    <header style={topBar}>
      <div style={topInner}>
        <a href="#" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
          <Wordmark />
        </a>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button type="button" style={ghostBtn}>Help</button>
          <div style={avatar} aria-hidden="true">AM</div>
        </div>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <span style={{ fontFamily: f.serif, fontSize: 22, letterSpacing: "-0.02em", color: t.coal, lineHeight: 1 }}>
      Hire<em style={{ color: t.copper, fontStyle: "italic" }}>Step</em>X
    </span>
  );
}

function Sidebar({ active }: { active: SettingsTab }) {
  return (
    <aside style={sidebar} aria-label="Settings sections" data-sidebar>
      <div style={{ padding: "20px 16px 8px" }}>
        <h1 style={pageTitle} id="settings-page-title">
          Your <em style={{ color: t.copper, fontStyle: "italic", fontFamily: f.serif }}>workspace</em>
        </h1>
        <p style={pageSub}>Tune HireStepX to match how you practice.</p>
      </div>
      <nav style={{ padding: "8px 8px 16px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((n) => {
          const on = n.id === active;
          return (
            <a
              key={n.id}
              href={`#${n.id}`}
              aria-current={on ? "page" : undefined}
              style={navItem(on)}
            >
              <span style={navIcon(on)} aria-hidden="true">{n.icon}</span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
                <span style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: on ? t.indigo : t.coal }}>
                  {n.label}
                </span>
                <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>{n.hint}</span>
              </span>
              {on && <span style={navDot} aria-hidden="true" />}
            </a>
          );
        })}
      </nav>
      <div style={sidebarFooter}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: f.serif, fontSize: 22, color: t.copper, lineHeight: 1 }} aria-hidden="true">★</span>
          <div>
            <div style={{ fontFamily: f.sans, fontSize: 12, fontWeight: 700, color: t.coal }}>Pro tier</div>
            <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>Renews 14 Jul 2026</div>
          </div>
        </div>
        <button type="button" style={ghostBtnSm}>Manage</button>
      </div>
    </aside>
  );
}

/* ─── Account ───────────────────────────────────────────────────────── */

function AccountSection() {
  return (
    <SectionStack>
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
        <RowActions primary="Save changes" />
      </Card>

      <SectionHead title="Security" desc="Sign-in, password, and devices currently using your account." />
      <Card>
        <KeyValue label="Email" value="arjun.mehta@gmail.com" right={<TinyChip tone="success">Verified</TinyChip>} />
        <Divider />
        <KeyValue label="Password" value="Last updated 14 Mar 2026" right={<button type="button" style={subtleBtn}>Send reset link</button>} />
        <Divider />
        <KeyValue label="Sign-in method" value="Email and password, with Google as a backup" right={<TinyChip tone="success">Active</TinyChip>} />
      </Card>

      <Card>
        <SubHeader title="Active devices" hint="One device at a time. HireStepX rotates the token on every new sign-in." />
        <DeviceRow current name="Chrome on macOS, Mumbai" sub="Active now, this device" />
        <DeviceRow name="Safari on iPhone, Mumbai" sub="2 hours ago" />
        <DeviceRow name="Chrome on Windows, Bengaluru" sub="3 days ago" />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" style={subtleBtn}>Sign out other devices</button>
        </div>
      </Card>

      <SectionHead title="Danger zone" desc="These actions cannot be undone." tone="danger" />
      <DangerCard
        title="Delete account"
        body="Permanently remove your profile, sessions, and resume data. We retain anonymised analytics for 30 days."
        cta="Delete account"
      />
    </SectionStack>
  );
}

/* ─── Interview ─────────────────────────────────────────────────────── */

function InterviewSection() {
  return (
    <SectionStack>
      <SectionHead kicker="Interview" title="How interviews feel" desc="Tune the interviewer's voice, accent, and intensity. Defaults match a senior PM round at an Indian unicorn." />

      <Card>
        <SubHeader title="Voice and accent" hint="Sarvam Bulbul is the default. Azure and Web Speech kick in automatically if it stalls." />
        <RadioGrid
          name="voice"
          active="indian-female"
          options={[
            { id: "indian-female", label: "Anika, Indian English (female)", meta: "Sarvam · warm, mid-paced" },
            { id: "indian-male", label: "Rohan, Indian English (male)", meta: "Sarvam · crisp, panel-style" },
            { id: "azure-female", label: "Aarohi, Indian English (female)", meta: "Azure · executive tone" },
            { id: "azure-male", label: "Prabhat, Indian English (male)", meta: "Azure · founder energy" },
          ]}
        />
        <Divider />
        <SliderField id="pace" label="Speaking pace" value="Natural" valueHint="0.95x" />
        <Divider />
        <SliderField id="latency" label="Interrupt latency" value="Patient" valueHint="1.6s of silence before nudging" />
      </Card>

      <Card>
        <SubHeader title="Difficulty and focus" hint="Drives question selection and follow-up depth." />
        <SegmentedField label="Default difficulty" options={["Warm-up", "Realistic", "Stretch", "Brutal"]} active="Realistic" />
        <Divider />
        <CheckboxRow label="Behavioural (STAR)" checked />
        <CheckboxRow label="Salary negotiation" checked />
        <CheckboxRow label="Reverse interview (your questions for them)" checked />
        <CheckboxRow label="Case and product sense" />
        <CheckboxRow label="Resume deep-dives" checked />
      </Card>

      <Card>
        <SubHeader title="Language and code-switching" hint="HireStepX supports English, Hindi, and Hinglish in the same flow." />
        <Grid2>
          <FieldSelect label="Primary language" value="English" />
          <FieldSelect label="Secondary language" value="Hinglish (50 / 50)" />
        </Grid2>
        <Toggle id="t-register" label="Allow regional register (Mumbai or Bengaluru cadence)" on />
        <Toggle id="t-captions" label="Show real-time captions during interview" on />
      </Card>

      <Card>
        <SubHeader title="Microphone and audio" hint="Tested on your default input device." />
        <KeyValue label="Input device" value="MacBook Pro Microphone" right={<button type="button" style={subtleBtn}>Test mic</button>} />
        <Divider />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", gap: 16 }}>
          <div>
            <div style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal }}>Noise suppression</div>
            <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 2 }}>Browser-native echo and noise cancellation.</div>
          </div>
          <Toggle id="t-noise" on inline />
        </div>
      </Card>
    </SectionStack>
  );
}

/* ─── Notifications ─────────────────────────────────────────────────── */

function NotificationsSection() {
  return (
    <SectionStack>
      <SectionHead kicker="Notifications" title="When we reach out" desc="Quiet by default. We only nudge when there's something earned, or worth showing up for." />
      <Card>
        <SubHeader title="Browser notifications" hint="Native pop-ups on this device." />
        <KeyValue label="Status" value="Allowed on arjun@macbook" right={<TinyChip tone="success">Granted</TinyChip>} />
      </Card>
      <Card>
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

/* ─── Plan and data ─────────────────────────────────────────────────── */

function PlanSection() {
  return (
    <SectionStack>
      <SectionHead kicker="Plan and data" title="Pro, invested in your offer" desc="Manage your subscription, see your invoices, and export your data." />

      <div style={planRow} data-plan-row>
        <PlanCard tier="Free" price="₹0" desc="2 mock interviews each month. Behavioural only." current={false} />
        <PlanCard tier="Pro" price="₹599 per month" desc="Unlimited mocks, salary negotiation, skill radar, priority voice." current />
        <PlanCard tier="Placement" price="₹4,999 one-time" desc="Coach reviews, mock panel of three, custom company prep." current={false} highlight />
      </div>

      <Card>
        <SubHeader title="Usage this month" hint="Resets on the first of every month." />
        <UsageBar label="Mock interviews" value={18} total="Unlimited" pct={0.42} />
        <UsageBar label="Coach insights generated" value={42} total="Unlimited" pct={0.6} />
        <UsageBar label="Resume re-parses" value={3} total={10} pct={0.3} />
      </Card>

      <Card>
        <SubHeader title="Payment method" hint="Razorpay handles billing. UPI is fastest for renewals." />
        <KeyValue label="UPI" value="arjun.mehta@okhdfcbank" right={<button type="button" style={subtleBtn}>Replace</button>} />
        <Divider />
        <KeyValue label="Backup card" value="HDFC ending 4421, expires 09 / 27" right={<button type="button" style={subtleBtnGhost}>Remove</button>} />
      </Card>

      <Card>
        <SubHeader title="Invoices" hint="Last six months. Click any row for the GST invoice." />
        <InvoiceRow date="14 Jun 2026" amount="₹599" status="Paid" />
        <InvoiceRow date="14 May 2026" amount="₹599" status="Paid" />
        <InvoiceRow date="14 Apr 2026" amount="₹599" status="Paid" />
        <InvoiceRow date="14 Mar 2026" amount="₹599" status="Paid" />
        <InvoiceRow date="14 Feb 2026" amount="₹599" status="Paid" />
      </Card>

      <Card>
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
      <SectionHead kicker="Referral" title="Bring a friend, earn a month" desc="They get 20% off their first Pro month. You get a free month when they convert." />

      <Card>
        <div style={referralHero} data-referral-hero>
          <div>
            <div style={kicker}>Your referral link</div>
            <div style={referralLink}>hirestepx.com/r/<span style={{ color: t.copper }}>arjun-mh</span></div>
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" style={primaryBtn}>Copy link</button>
              <button type="button" style={subtleBtn}>Share on WhatsApp</button>
              <button type="button" style={subtleBtnGhost}>Email a friend</button>
            </div>
          </div>
          <div style={referralStat}>
            <div style={{ fontFamily: f.serif, fontSize: 64, color: t.coal, lineHeight: 1 }}>3</div>
            <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, marginTop: 6 }}>free months earned</div>
            <div style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 4 }}>of 6 lifetime cap</div>
          </div>
        </div>
      </Card>

      <Card>
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
  return (
    <div style={{ marginTop: 8 }}>
      {k && <div style={{ ...kicker, color: tone === "danger" ? t.error : t.copper }}>{k}</div>}
      <h2 id="settings-section-title" style={{ fontFamily: f.serif, fontSize: 30, letterSpacing: "-0.02em", color: tone === "danger" ? t.error : t.coal, margin: "6px 0 6px", lineHeight: 1.15 }}>
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

function Card({ children }: { children: React.ReactNode }) {
  return <div style={cardStyle}>{children}</div>;
}

function DangerCard({ title, body, cta }: { title: string; body: string; cta: string }) {
  return (
    <div style={{ ...cardStyle, borderColor: "rgba(185,28,28,0.22)", background: t.error100 }}>
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

function RowActions({ primary }: { primary: string }) {
  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
      <button type="button" style={subtleBtnGhost}>Cancel</button>
      <button type="button" style={primaryBtn}>{primary}</button>
    </div>
  );
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
          <Icon path="M5 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8 20h8M12 16v4" />
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

/* Accessible switch. Real <button role="switch"> with aria-checked.
   44×44 tap target via padding while keeping the 36×20 visual track. */
function Toggle({ id, label, on, inline }: { id?: string; label?: string; on?: boolean; inline?: boolean }) {
  const fallback = useId();
  const ariaId = id ?? fallback;
  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      aria-labelledby={label ? `${ariaId}-label` : undefined}
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

/* Real <input type="checkbox"> visually hidden, custom indicator next
   to a real <label>. Keyboard-accessible, screen-reader-accessible. */
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

/* Real radio group. Visually hidden inputs, custom dots, semantic name. */
function RadioGrid({
  name,
  options,
  active,
}: { name: string; options: Array<{ id: string; label: string; meta: string }>; active: string }) {
  return (
    <div role="radiogroup" aria-label="Voice and accent" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="hsx-settings-grid2">
      {options.map((o) => {
        const on = o.id === active;
        const inputId = `${name}-${o.id}`;
        return (
          <label key={o.id} htmlFor={inputId} style={radioCard(on)}>
            <input id={inputId} type="radio" name={name} defaultChecked={on} style={srOnly} />
            <span aria-hidden="true" style={radioDot(on)}>{on && <span style={radioDotInner} />}</span>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: on ? t.indigo : t.coal }}>{o.label}</span>
              <span style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, marginTop: 4 }}>{o.meta}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function SegmentedField({ label, options, active }: { label: string; options: string[]; active: string }) {
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
              style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, padding: "10px 16px", borderRadius: 7, border: "none", cursor: "pointer", background: on ? t.white : "transparent", color: on ? t.coal : t.inkSoft, boxShadow: on ? "0 1px 2px rgba(20,17,10,0.08)" : "none", minHeight: 36 }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SliderField({ id, label, value, valueHint }: { id: string; label: string; value: string; valueHint: string }) {
  return (
    <div style={{ padding: "10px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
        <label htmlFor={id} style={fieldLabel}>{label}</label>
        <span style={{ fontFamily: f.mono, fontSize: 12, color: t.inkSoft }}>{value} · {valueHint}</span>
      </div>
      <div
        id={id}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={55}
        aria-valuetext={`${value}, ${valueHint}`}
        tabIndex={0}
        style={{ position: "relative", height: 6, background: t.line, borderRadius: 100 }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, height: 6, width: "55%", background: t.indigo, borderRadius: 100 }} />
        <div style={{ position: "absolute", left: "calc(55% - 10px)", top: -7, width: 20, height: 20, borderRadius: "50%", background: t.white, border: `2px solid ${t.indigo}`, boxShadow: shadows.cta }} />
      </div>
    </div>
  );
}

function PlanCard({ tier, price, desc, current, highlight }: { tier: string; price: string; desc: string; current?: boolean; highlight?: boolean }) {
  return (
    <div style={{ flex: 1, background: current ? t.indigoDeep : t.white, color: current ? t.cream : t.coal, border: `1px solid ${current ? t.indigoDeep : t.line}`, borderRadius: 14, padding: 24, boxShadow: current ? shadows.modal : shadows.card, position: "relative", overflow: "hidden", minWidth: 0 }}>
      {current && <span style={{ position: "absolute", top: 14, right: 14, fontFamily: f.mono, fontSize: 10, letterSpacing: "0.14em", color: t.copper, textTransform: "uppercase", fontWeight: 700 }}>Current</span>}
      {highlight && !current && <span style={{ position: "absolute", top: 14, right: 14, fontFamily: f.mono, fontSize: 10, letterSpacing: "0.14em", color: t.copper, textTransform: "uppercase", fontWeight: 700 }}>Best for the offer</span>}
      <div style={{ fontFamily: f.serif, fontSize: 26, color: current ? t.cream : t.coal, marginBottom: 6 }}>{tier}</div>
      <div style={{ fontFamily: f.serif, fontSize: 22, color: t.copper, marginBottom: 14 }}>{price}</div>
      <div style={{ fontFamily: f.sans, fontSize: 13, color: current ? "rgba(250,247,240,0.85)" : t.inkSoft, lineHeight: 1.55, marginBottom: 20 }}>{desc}</div>
      <button type="button" style={{ ...primaryBtn, width: "100%", background: current ? "rgba(255,255,255,0.10)" : t.indigo, color: t.cream, cursor: current ? "default" : "pointer" }}>
        {current ? "You're on Pro" : highlight ? "Upgrade to Placement" : "Switch to Free"}
      </button>
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
    <div className="hsx-invoice" style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.6fr", alignItems: "center", padding: "12px 0", borderBottom: `1px solid ${t.line}`, gap: 12 }}>
      <span style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, fontWeight: 500 }}>{date}</span>
      <span style={{ fontFamily: f.mono, fontSize: 12, color: t.inkSoft }}>{amount}</span>
      <TinyChip tone="success">{status}</TinyChip>
      <button type="button" style={linkBtn}>Download</button>
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

function Icon({ path }: { path: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  );
}

/* Responsive + focus rules. Fonts come from CanvasProviders or the
   shared design-system canvas; we avoid duplicate @import per mount. */
function Stylesheet() {
  return (
    <style>{`
      .hsx-settings *:focus-visible {
        outline: 2px solid ${t.indigoRing};
        outline-offset: 2px;
        border-radius: 6px;
      }
      @media (max-width: 880px) {
        .hsx-settings [data-body] {
          grid-template-columns: 1fr !important;
          padding: 20px 16px 64px !important;
          gap: 20px !important;
        }
        .hsx-settings [data-sidebar] {
          position: relative !important;
          top: 0 !important;
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
          grid-template-columns: 1fr 1fr !important;
          row-gap: 8px !important;
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
  display: "flex",
  flexDirection: "column",
};

const topBar: React.CSSProperties = {
  background: t.cream,
  borderBottom: `1px solid ${t.line}`,
  position: "sticky",
  top: 0,
  zIndex: 10,
};

const topInner: React.CSSProperties = {
  maxWidth: 1320,
  margin: "0 auto",
  padding: "18px 32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  boxSizing: "border-box",
};

const body: React.CSSProperties = {
  flex: 1,
  display: "grid",
  gridTemplateColumns: "300px 1fr",
  maxWidth: 1320,
  margin: "0 auto",
  width: "100%",
  padding: "32px 32px 80px",
  gap: 40,
  alignItems: "start",
  boxSizing: "border-box",
};

const sidebar: React.CSSProperties = {
  position: "sticky",
  top: 84,
  background: t.white,
  border: `1px solid ${t.line}`,
  borderRadius: 14,
  boxShadow: shadows.card,
  overflow: "hidden",
};

const pageTitle: React.CSSProperties = {
  fontFamily: f.serif,
  fontSize: 28,
  lineHeight: 1.05,
  letterSpacing: "-0.02em",
  margin: "0 0 6px",
  color: t.coal,
  fontWeight: 400,
};

const pageSub: React.CSSProperties = {
  fontFamily: f.sans,
  fontSize: 13,
  color: t.inkSoft,
  margin: 0,
  lineHeight: 1.55,
};

const navItem = (on: boolean): React.CSSProperties => ({
  position: "relative",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 12px",
  borderRadius: 10,
  textAlign: "left",
  cursor: "pointer",
  background: on ? t.indigo100 : "transparent",
  transition: "background 160ms cubic-bezier(0.16, 1, 0.3, 1)",
  width: "100%",
  textDecoration: "none",
  color: "inherit",
  minHeight: 56,
  boxSizing: "border-box",
});

const navIcon = (on: boolean): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: on ? t.indigo : t.creamSoft,
  color: on ? t.cream : t.inkSoft,
  flexShrink: 0,
});

const navDot: React.CSSProperties = {
  position: "absolute",
  right: 12,
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: t.copper,
};

const sidebarFooter: React.CSSProperties = {
  borderTop: `1px solid ${t.line}`,
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: t.creamSoft,
  gap: 12,
};

const content: React.CSSProperties = {
  paddingTop: 4,
  minWidth: 0,
};

const cardStyle: React.CSSProperties = {
  background: t.white,
  border: `1px solid ${t.line}`,
  borderRadius: 14,
  padding: "28px 32px",
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

const ghostBtn: React.CSSProperties = {
  fontFamily: f.sans,
  fontSize: 13,
  fontWeight: 500,
  color: t.inkSoft,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "10px 12px",
  borderRadius: 8,
  minHeight: 40,
};

const ghostBtnSm: React.CSSProperties = {
  fontFamily: f.sans,
  fontSize: 12,
  fontWeight: 700,
  color: t.indigo,
  background: "transparent",
  border: "none",
  cursor: "pointer",
  padding: "6px 8px",
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

const radioCard = (on: boolean): React.CSSProperties => ({
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "14px 14px",
  borderRadius: 10,
  border: `1.5px solid ${on ? t.indigo : t.line}`,
  background: on ? t.indigo100 : t.white,
  cursor: "pointer",
  position: "relative",
});

const radioDot = (on: boolean): React.CSSProperties => ({
  width: 16,
  height: 16,
  borderRadius: "50%",
  border: `1.5px solid ${on ? t.indigo : t.lineStrong}`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  marginTop: 3,
});

const radioDotInner: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: t.indigo,
};

const planRow: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "stretch",
};

const referralHero: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: 32,
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
};

const referralStat: React.CSSProperties = {
  padding: "20px 28px",
  background: t.creamSoft,
  border: `1px solid ${t.line}`,
  borderRadius: 12,
  textAlign: "center",
  minWidth: 160,
};

/* Switch primitive — 44×44 tap target around a 36×20 visual track. */
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
  boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
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
