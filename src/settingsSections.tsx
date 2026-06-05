import type React from "react";
import { memo, useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import type { PersistedState } from "./dashboardTypes";
import type { PaymentRecord } from "./supabase";

/* Cream-mode local tokens — mirror tempo/designs/canvases/design-system/_tokens.ts
   and DashboardLayout. Same keys as the old dark `c` so JSX style values
   keep compiling; values are now cream / coal / copper / indigo. */
const c = {
  obsidian: "#FAF7F0",
  graphite: "#FFFFFF",
  border: "#EBE5D2",
  borderStrong: "#D6CDB5",
  gilt: "#B45309",
  giltDark: "#923F07",
  ivory: "#0E0C08",
  chalk: "#0E0C08",
  stone: "#6E6759",
  sage: "#15803D",
  ember: "#B91C1C",
  slate: "#6E6759",
  indigo: "#312E81",
  indigoDeep: "#1E1B4B",
  indigo100: "#E5E2F2",
  copper100: "#F4E5D8",
  success100: "#DCFCE7",
  error100: "#FEE2E2",
  warning100: "#FEF3C7",
  cream: "#FAF7F0",
  creamSoft: "#F4EFE3",
};
const font = {
  display: "'Instrument Serif', Georgia, serif",
  ui: "'Satoshi', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};
const shadow = {
  sm: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
  glow: "0 1px 2px rgba(49,46,129,.18), 0 4px 12px -4px rgba(49,46,129,.24)",
  glowStrong: "0 2px 4px rgba(49,46,129,.22), 0 10px 24px -6px rgba(49,46,129,.30)",
};

/* ─── Section Icons (shared) ─── */
export const icons = {
  account: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  interview: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>,
  plan: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  referral: <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>,
};

/* ─── Shared Styles ─── */
export const cardStyle: React.CSSProperties = {
  background: c.graphite,
  borderRadius: 16,
  border: `1px solid ${c.border}`,
  padding: "32px 36px",
  marginBottom: 24,
  boxShadow: shadow.sm,
  position: "relative",
  overflow: "hidden",
};

export const sectionHeader: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 14, marginBottom: 8,
};

export const sectionTitle: React.CSSProperties = {
  fontFamily: font.display, fontSize: 22, fontWeight: 400, color: c.ivory, letterSpacing: "0.01em",
};

export const sectionDesc: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, color: c.stone, marginBottom: 32, lineHeight: 1.6, paddingLeft: 50,
};

export const labelStyle: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: c.stone, display: "block", marginBottom: 8,
  letterSpacing: "0.04em", textTransform: "uppercase",
};

export const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 16px", borderRadius: 10,
  background: c.graphite, border: `1px solid ${c.borderStrong}`,
  color: c.ivory, fontFamily: font.ui, fontSize: 13, outline: "none", boxSizing: "border-box",
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

export const focusIn = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "rgba(180,83,9,0.5)";
  e.currentTarget.style.boxShadow = "0 0 0 3px #F4E5D8";
};
export const focusOutBase = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = c.border;
  e.currentTarget.style.boxShadow = "none";
};

const chipBtn = (active: boolean): React.CSSProperties => ({
  padding: "14px 16px", borderRadius: 12, cursor: "pointer",
  background: active ? "#F4E5D8" : "c.creamSoft",
  border: `1.5px solid ${active ? "rgba(180,83,9,0.45)" : c.border}`,
  textAlign: "left", transition: "all 0.2s ease",
  boxShadow: active ? "0 0 0 1px #F4E5D8" : "none",
  position: "relative",
});

const chipLabel = (active: boolean): React.CSSProperties => ({
  fontFamily: font.ui, fontSize: 12, fontWeight: 600,
  color: active ? c.gilt : c.chalk, display: "flex", alignItems: "center", gap: 8, marginBottom: 3,
});

const chipDesc: React.CSSProperties = { fontFamily: font.ui, fontSize: 10, color: c.stone, paddingLeft: 22 };

/* ─── Small shared components ─── */
function RadioDot({ active }: { active: boolean }) {
  return (
    <span style={{
      width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
      border: `1.5px solid ${active ? c.gilt : "#D6CDB5"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "border-color 0.2s ease",
    }}>
      {active && <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.gilt }} />}
    </span>
  );
}

/** Render a Unix-ms timestamp as a relative phrase ("3h ago"). */
function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Best-effort UA → "Browser on OS" label. Matches major browsers + OS
    so the audit list reads as something the user recognizes. */
function parseUserAgent(ua: string): string {
  if (!ua) return "Unknown device";
  let browser = "Browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = "Safari";
  let os = "Unknown";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "Mac";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";
  return `${browser} on ${os}`;
}

export function Divider() {
  return (
    <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${c.border}, transparent)`, margin: "28px 0" }} />
  );
}

export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-pressed={on} style={{
      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
      background: on ? c.indigo : "#EBE5D2",
      padding: 3, transition: "background 0.25s ease", position: "relative",
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: "50%",
        background: on ? c.obsidian : c.stone,
        transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: on ? "translateX(20px)" : "translateX(0)",
        boxShadow: on ? "0 1px 3px rgba(0,0,0,0.3)" : "none",
      }} />
    </button>
  );
}

/* ─── Decorative gradient accent (reused at top of every card) ─── */
function CardAccent() {
  return <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, rgba(180,83,9,0.28), transparent)` }} />;
}

/* ─── Section icon wrapper ─── */
function IconBox({ children, color }: { children: React.ReactNode; color?: string }) {
  const col = color || "rgba(180,83,9";
  return (
    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${col},0.06)`, border: `1px solid ${col},0.12)`, display: "flex", alignItems: "center", justifyContent: "center", color: color ? undefined : c.gilt }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ACCOUNT SECTION
   ═══════════════════════════════════════════════════════════════ */

export interface AccountSectionProps {
  // Profile state
  editName: string;
  setEditName: (v: string) => void;
  editRole: string;
  setEditRole: (v: string) => void;
  editCompany: string;
  setEditCompany: (v: string) => void;
  editIndustry: string;
  setEditIndustry: (v: string) => void;
  editCity: string;
  setEditCity: (v: string) => void;
  editExperience: string;
  setEditExperience: (v: string) => void;
  // Derived
  userName: string;
  email: string;
  tierLabel: string;
  subscriptionTier: string | undefined;
  isDirty: boolean;
  // Save
  saving: boolean;
  saved: boolean;
  handleSave: () => void;
  // Password
  resetLoading: boolean;
  resetSent: boolean;
  handlePasswordReset: () => void;
  /** True when the signed-in user authenticated via Google (or any
   *  OAuth provider) — they don't have an internal-app password to
   *  reset, so the section hides. Resetting via email link only
   *  changes a password they don't use, which confused users. */
  isOAuthOnly: boolean;
  // Sessions — sign out every device except the current one
  signOutOthersLoading: boolean;
  signOutOthersDone: boolean;
  signOutOthersError: string | null;
  handleSignOutOtherDevices: () => void;
  // Recent devices history (last 5 logins). Read-only audit list.
  recentDevices: Array<{
    id: string;
    ua?: string;
    at?: number;
    isCurrent: boolean;
  }>;
  // Blur handler (auto-save)
  focusOut: (e: React.FocusEvent<HTMLInputElement>) => void;
  // Auto-save the experience select on change (no blur event)
  authUpdateUser: (updates: { experienceLevel?: string }) => void | Promise<void>;
}

const EXPERIENCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Select range" },
  { value: "fresher", label: "Fresher" },
  { value: "entry", label: "0 to 2 years" },
  { value: "mid", label: "3 to 5 years" },
  { value: "senior", label: "6 to 8 years" },
  { value: "lead", label: "9 to 12 years" },
  { value: "executive", label: "12+ years" },
];

function ExperienceLabel(value: string): string {
  return EXPERIENCE_OPTIONS.find((o) => o.value === value)?.label || "Select range";
}

function FieldShell({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        style={{
          fontFamily: font.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
          color: c.stone, textTransform: "uppercase", display: "block", marginBottom: 8,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const editorialInput: React.CSSProperties = {
  width: "100%", fontFamily: font.ui, fontSize: 14, color: c.ivory,
  background: c.graphite, border: `1px solid ${c.borderStrong}`, borderRadius: 9,
  padding: "12px 14px", outline: "none", boxSizing: "border-box", minHeight: 44,
  transition: "border-color 0.18s ease, box-shadow 0.18s ease",
};

const accSubtleBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory,
  background: c.graphite, border: `1px solid ${c.borderStrong}`, borderRadius: 9,
  padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

const accSubtleBtnGhost: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.stone,
  background: "transparent", border: "none", borderRadius: 9,
  padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

function SectionHead({ kicker: k, title, desc, tone }: { kicker?: string; title: string; desc?: string; tone?: "danger" }) {
  return (
    <div style={{ marginTop: 8, marginBottom: 16 }}>
      {k && (
        <div style={{
          fontFamily: font.mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.18em",
          color: tone === "danger" ? c.ember : c.gilt, textTransform: "uppercase",
        }}>{k}</div>
      )}
      <h2 style={{
        fontFamily: font.display, fontSize: 28, letterSpacing: "-0.02em",
        color: tone === "danger" ? c.ember : c.ivory, margin: "6px 0", lineHeight: 1.15, fontWeight: 400,
      }}>{title}</h2>
      {desc && (
        <p style={{
          fontFamily: font.ui, fontSize: 14, color: c.stone, margin: 0, lineHeight: 1.55, maxWidth: 620,
        }}>{desc}</p>
      )}
    </div>
  );
}

function EditorialCard({ children, density = "default" }: { children: React.ReactNode; density?: "default" | "tight" }) {
  return (
    <div style={{
      background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 14,
      boxShadow: shadow.sm,
      padding: density === "tight" ? "20px 24px" : "28px 32px",
    }}>{children}</div>
  );
}

function KeyValue({ label, value, right }: { label: string; value: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", gap: 16 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory }}>{label}</div>
        <div style={{ fontFamily: font.ui, fontSize: 12, color: c.stone, marginTop: 2 }}>{value}</div>
      </div>
      <div>{right}</div>
    </div>
  );
}

function ThinDivider() {
  return <div style={{ height: 1, background: c.border, margin: "12px 0" }} role="separator" />;
}

function TinyChip({ children, tone }: { children: React.ReactNode; tone?: "success" | "warn" }) {
  const palette =
    tone === "success" ? { bg: c.success100, fg: c.sage } :
    tone === "warn" ? { bg: c.warning100, fg: c.giltDark } :
    { bg: c.indigo100, fg: c.indigo };
  return (
    <span style={{
      fontFamily: font.mono, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "4px 8px", borderRadius: 4, background: palette.bg, color: palette.fg, fontWeight: 700,
    }}>{children}</span>
  );
}

export const AccountSection = memo(function AccountSection(props: AccountSectionProps) {
  const {
    editName, setEditName,
    editRole, setEditRole,
    editCompany, setEditCompany,
    editIndustry, setEditIndustry,
    editCity, setEditCity,
    editExperience, setEditExperience,
    userName, email, tierLabel, subscriptionTier,
    resetLoading, resetSent, handlePasswordReset, isOAuthOnly,
    signOutOthersLoading, signOutOthersDone, signOutOthersError,
    handleSignOutOtherDevices,
    recentDevices,
    focusOut,
    authUpdateUser,
  } = props;
  void subscriptionTier; void tierLabel;

  const initial = (userName || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 880 }}>
      {/* ── Profile ── */}
      <SectionHead kicker="Account" title="Profile" desc="The basics we use to personalise interview prompts and coaching." />
      <EditorialCard>
        <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 24 }}>
          <div aria-hidden="true" style={{
            width: 64, height: 64, borderRadius: "50%",
            background: c.indigoDeep, color: c.cream, fontFamily: font.display, fontSize: 26,
            display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: "0.02em", flexShrink: 0,
          }}>{initial}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: font.ui, fontSize: 16, fontWeight: 700, color: c.ivory, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName || "Your name"}</div>
            <div style={{ fontFamily: font.ui, fontSize: 13, color: c.stone, marginTop: 4 }}>
              {email}{tierLabel ? ` · ${tierLabel} tier` : ""}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="settings-form-grid">
          <FieldShell label="Full name" htmlFor="acc-name">
            <input id="acc-name" type="text" value={editName} maxLength={60}
              onChange={(e) => setEditName(e.target.value)}
              onFocus={focusIn} onBlur={focusOut} style={editorialInput} />
          </FieldShell>
          <FieldShell label="Target role" htmlFor="acc-role">
            <input id="acc-role" type="text" value={editRole} maxLength={80}
              placeholder="e.g. Senior Product Manager"
              onChange={(e) => setEditRole(e.target.value)}
              onFocus={focusIn} onBlur={focusOut} style={editorialInput} />
          </FieldShell>
          <FieldShell label="Target company" htmlFor="acc-company">
            <input id="acc-company" type="text" value={editCompany} maxLength={60}
              placeholder="e.g. Razorpay"
              onChange={(e) => setEditCompany(e.target.value)}
              onFocus={focusIn} onBlur={focusOut} style={editorialInput} />
          </FieldShell>
          <FieldShell label="Industry" htmlFor="acc-industry">
            <input id="acc-industry" type="text" value={editIndustry} maxLength={60}
              placeholder="e.g. Fintech"
              onChange={(e) => setEditIndustry(e.target.value)}
              onFocus={focusIn} onBlur={focusOut} style={editorialInput} />
          </FieldShell>
          <FieldShell label="City" htmlFor="acc-city">
            <input id="acc-city" type="text" value={editCity} maxLength={60}
              placeholder="e.g. Bengaluru"
              onChange={(e) => setEditCity(e.target.value)}
              onFocus={focusIn} onBlur={focusOut} style={editorialInput} />
          </FieldShell>
          <FieldShell label="Years of experience" htmlFor="acc-experience">
            <div style={{ position: "relative" }}>
              <select id="acc-experience" value={editExperience}
                onChange={(e) => { setEditExperience(e.target.value); void authUpdateUser({ experienceLevel: e.target.value }); }}
                style={{ ...editorialInput, appearance: "none", WebkitAppearance: "none", MozAppearance: "none", paddingRight: 36, cursor: "pointer" }}
                aria-label={`Years of experience, currently ${ExperienceLabel(editExperience)}`}
              >
                {EXPERIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <span aria-hidden style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: c.stone, fontFamily: font.mono, fontSize: 11, pointerEvents: "none" }}>▾</span>
            </div>
          </FieldShell>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: 20, gap: 10, fontFamily: font.ui, fontSize: 12, color: c.stone }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: c.sage }} />
          Saved automatically when you leave a field
        </div>
      </EditorialCard>

      {/* ── Security ── */}
      <SectionHead title="Security" desc="Sign-in and devices currently using your account." />
      <EditorialCard density="tight">
        <KeyValue label="Email" value={email} right={<TinyChip tone="success">Verified</TinyChip>} />
        <ThinDivider />
        {!isOAuthOnly ? (
          <KeyValue
            label="Password"
            value="Send a reset link to your email when you need to change it."
            right={
              <button type="button" onClick={handlePasswordReset} disabled={resetLoading || resetSent}
                style={{
                  ...accSubtleBtn,
                  color: resetSent ? c.sage : c.ivory,
                  background: resetSent ? c.success100 : c.graphite,
                  borderColor: resetSent ? "rgba(21,128,61,0.3)" : c.borderStrong,
                  cursor: (resetLoading || resetSent) ? "default" : "pointer",
                  opacity: resetLoading ? 0.6 : 1,
                }}
              >
                {resetLoading ? "Sending..." : resetSent ? "Email sent" : "Send reset link"}
              </button>
            }
          />
        ) : (
          <KeyValue
            label="Password"
            value="You signed in with Google — manage your password in your Google Account."
            right={<TinyChip>Google</TinyChip>}
          />
        )}
        <ThinDivider />
        <KeyValue
          label="Sign-in method"
          value={isOAuthOnly ? "Google" : "Email and password"}
          right={<TinyChip tone="success">Active</TinyChip>}
        />
      </EditorialCard>

      <EditorialCard density="tight">
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 700, color: c.ivory }}>Active devices</div>
          <div style={{ fontFamily: font.ui, fontSize: 12, color: c.stone, marginTop: 4, lineHeight: 1.5 }}>
            One device at a time. Signing in elsewhere automatically signs out this device.
          </div>
        </div>
        {recentDevices.length === 0 ? (
          <div style={{ fontFamily: font.ui, fontSize: 13, color: c.stone, padding: "12px 0" }}>
            No recent sign-ins recorded yet.
          </div>
        ) : (
          recentDevices.map((d, idx) => {
            const seen = d.at ? formatRelative(d.at) : "Unknown";
            const label = parseUserAgent(d.ua || "");
            return (
              <div key={d.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 0", gap: 16,
                borderBottom: idx < recentDevices.length - 1 ? `1px solid ${c.border}` : "none",
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
                  <span aria-hidden style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: c.creamSoft, color: c.stone,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
                    <div style={{ fontFamily: font.ui, fontSize: 12, color: c.stone, marginTop: 2 }}>
                      {d.isCurrent ? "Active now, this device" : seen}
                    </div>
                  </div>
                </div>
                {d.isCurrent && <TinyChip tone="success">This device</TinyChip>}
              </div>
            );
          })
        )}

        <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <div style={{ fontFamily: font.ui, fontSize: 12, color: signOutOthersError ? c.ember : c.stone }}>
            {signOutOthersError || "Sign out every device except this one."}
          </div>
          <button onClick={handleSignOutOtherDevices} disabled={signOutOthersLoading || signOutOthersDone}
            style={{
              ...accSubtleBtnGhost,
              color: signOutOthersDone ? c.sage : c.indigo,
              cursor: (signOutOthersLoading || signOutOthersDone) ? "default" : "pointer",
              opacity: signOutOthersLoading ? 0.6 : 1,
            }}
          >
            {signOutOthersLoading ? "Signing out..." : signOutOthersDone ? "Signed out" : "Sign out everywhere else"}
          </button>
        </div>
      </EditorialCard>
    </div>
  );
});


/* ═══════════════════════════════════════════════════════════════
   INTERVIEW PREFERENCES SECTION
   ═══════════════════════════════════════════════════════════════ */

export interface InterviewSectionProps {
  editRole: string;
  setEditRole: (v: string) => void;
  focusOut: (e: React.FocusEvent<HTMLInputElement>) => void;
  // Chip values
  difficultyVal: string;
  learningVal: string;
  experienceVal: string;
  // Callbacks
  autoSave: (updates: Partial<PersistedState>) => void;
  authUpdateUser: (updates: Record<string, string>) => void;
  showToast: (msg: string) => void;
}

export const InterviewSection = memo(function InterviewSection(props: InterviewSectionProps) {
  const {
    editRole, setEditRole, focusOut,
    difficultyVal, learningVal, experienceVal,
    autoSave, authUpdateUser, showToast,
  } = props;

  return (
    <div style={cardStyle}>
      <CardAccent />

      <div style={sectionHeader}>
        <IconBox>{icons.interview}</IconBox>
        <h3 style={sectionTitle}>Interview Preferences</h3>
      </div>
      <p style={sectionDesc}>Configure your target role and interview difficulty</p>

      {/* Target role + Feedback style */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }} className="settings-form-grid">
        <div>
          <label htmlFor="settings-role" style={labelStyle}>Target Role</label>
          <input id="settings-role" type="text" value={editRole} onChange={(e) => setEditRole(e.target.value)} maxLength={80}
            style={inputStyle} onFocus={focusIn} onBlur={focusOut} />
        </div>
        <div>
          <span style={labelStyle}>Feedback Style</span>
          <div role="group" aria-label="Feedback Style" style={{ display: "flex", gap: 10 }}>
            {([
              { id: "direct" as const, label: "Direct" },
              { id: "encouraging" as const, label: "Encouraging" },
            ]).map(s => (
              <button key={s.id} onClick={() => { authUpdateUser({ learningStyle: s.id }); showToast("Feedback style updated"); }}
                style={{ ...chipBtn(learningVal === s.id), flex: 1, padding: "11px 14px" }}
                onMouseEnter={(e) => { if (learningVal !== s.id) e.currentTarget.style.borderColor = "#D6CDB5"; }}
                onMouseLeave={(e) => { if (learningVal !== s.id) e.currentTarget.style.borderColor = c.border; }}>
                <span style={{ ...chipLabel(learningVal === s.id), marginBottom: 0 }}><RadioDot active={learningVal === s.id} />{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Difficulty + Experience */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="settings-form-grid">
        <div>
          <span style={labelStyle}>Difficulty</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { id: "warmup", label: "Warm-up", desc: "Confidence-building" },
              { id: "standard", label: "Standard", desc: "Realistic pacing" },
              { id: "intense", label: "Intense", desc: "High pressure" },
            ].map(d => (
              <button key={d.id} onClick={() => { autoSave({ defaultDifficulty: d.id }); showToast("Difficulty updated"); }} style={chipBtn(difficultyVal === d.id)}
                onMouseEnter={(e) => { if (difficultyVal !== d.id) e.currentTarget.style.borderColor = "#D6CDB5"; }}
                onMouseLeave={(e) => { if (difficultyVal !== d.id) e.currentTarget.style.borderColor = c.border; }}>
                <span style={chipLabel(difficultyVal === d.id)}><RadioDot active={difficultyVal === d.id} />{d.label}</span>
                <span style={chipDesc}>{d.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <span style={labelStyle}>Experience Level</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { id: "entry", label: "Entry", desc: "0-2 years" },
              { id: "mid", label: "Mid", desc: "3-5 years" },
              { id: "senior", label: "Senior", desc: "6-10 years" },
              { id: "lead", label: "Lead+", desc: "10+ years" },
            ].map(d => (
              <button key={d.id} onClick={() => { authUpdateUser({ experienceLevel: d.id }); showToast("Experience level updated"); }} style={chipBtn(experienceVal === d.id)}
                onMouseEnter={(e) => { if (experienceVal !== d.id) e.currentTarget.style.borderColor = "#D6CDB5"; }}
                onMouseLeave={(e) => { if (experienceVal !== d.id) e.currentTarget.style.borderColor = c.border; }}>
                <span style={chipLabel(experienceVal === d.id)}><RadioDot active={experienceVal === d.id} />{d.label}</span>
                <span style={chipDesc}>{d.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

/* ─── Usage this month ─── */
interface UsageRow { count: number; cap: number | null }
interface UsageResponse {
  ok: true;
  tier: string;
  period_start: string;
  period_end: string;
  mock: UsageRow;
  resume_parses: UsageRow;
  coach_insights: null;
}

function UsageBar({ label, row }: { label: string; row: UsageRow }) {
  const cap = row.cap;
  const pct = cap && cap > 0 ? Math.min(100, Math.round((row.count / cap) * 100)) : 0;
  const display = cap == null ? `${row.count}` : `${row.count} of ${cap}`;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory }}>{label}</span>
        <span style={{ fontFamily: font.mono, fontSize: 12, color: c.stone }}>{display}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: c.border, overflow: "hidden" }}>
        <div style={{ width: cap == null ? "100%" : `${pct}%`, height: "100%", background: pct >= 90 ? c.ember : c.gilt, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

const UsageThisMonth = memo(function UsageThisMonth({
  getAuthHeaders,
}: { getAuthHeaders: () => Promise<Record<string, string>> }) {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/usage-this-month", { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as UsageResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load usage");
      }
    })();
    return () => { cancelled = true; };
  }, [getAuthHeaders]);

  if (error) return null; // Fail quiet — usage is decorative, not gating.
  if (!data) {
    return <span style={{ fontFamily: font.ui, fontSize: 12, color: c.stone }}>Loading usage…</span>;
  }
  return (
    <div>
      <UsageBar label="Mock interviews completed" row={data.mock} />
      <UsageBar label="Resume parses" row={data.resume_parses} />
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   PLAN & BILLING SECTION
   ═══════════════════════════════════════════════════════════════ */

export interface PlanSectionProps {
  authUser: {
    email?: string;
    subscriptionTier?: string;
    subscriptionStart?: string;
    subscriptionEnd?: string;
    cancelAtPeriodEnd?: boolean;
    subscriptionPaused?: boolean;
    id?: string;
  } | null;
  tierLabel: string;
  // Cancel / reactivate
  confirmCancel: boolean;
  setConfirmCancel: (v: boolean) => void;
  cancelLoading: boolean;
  setCancelLoading: (v: boolean) => void;
  cancelMsg: string;
  setCancelMsg: (v: string) => void;
  // Delete account
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  deleteEmailInput: string;
  setDeleteEmailInput: (v: string) => void;
  deleteLoading: boolean;
  setDeleteLoading: (v: boolean) => void;
  deleteMsg: string;
  setDeleteMsg: (v: string) => void;
  // Export
  exporting: boolean;
  setExporting: (v: boolean) => void;
  onExportCSV: () => void;
  // Billing
  payments: PaymentRecord[];
  paymentsLoading: boolean;
  // Actions
  authUpdateUser: (updates: Record<string, unknown>) => void;
  showToast: (msg: string) => void;
  setShowUpgradeModal: (v: boolean) => void;
  onLogout: () => void;
  // API helpers
  authHeaders: () => Promise<Record<string, string>>;
}

/* ─── Plan & Data — editorial layout (matches canvas) ─── */
const planKicker: React.CSSProperties = { fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: c.gilt, letterSpacing: "0.12em", textTransform: "uppercase" };
const planHeadline: React.CSSProperties = { fontFamily: font.display, fontSize: 36, fontWeight: 400, color: c.ivory, margin: "8px 0 10px", letterSpacing: "-0.02em", lineHeight: 1.1 };
const planDesc: React.CSSProperties = { fontFamily: font.ui, fontSize: 14, color: c.stone, lineHeight: 1.55, margin: 0, maxWidth: 640 };
const planCardOuter: React.CSSProperties = {
  background: c.graphite,
  border: `1px solid ${c.border}`,
  borderRadius: 16,
  boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
};
const subHeaderTitle: React.CSSProperties = { fontFamily: font.ui, fontSize: 14, fontWeight: 700, color: c.ivory };
const subHeaderHint: React.CSSProperties = { fontFamily: font.ui, fontSize: 12, color: c.stone, marginTop: 4, lineHeight: 1.5 };
const keyValueLabel: React.CSSProperties = { fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory };
const keyValueValue: React.CSSProperties = { fontFamily: font.ui, fontSize: 12, color: c.stone, lineHeight: 1.5, marginTop: 2 };
const subtleBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: c.ivory,
  background: c.creamSoft, border: `1px solid ${c.borderStrong}`,
  borderRadius: 8, padding: "8px 14px", cursor: "pointer", transition: "all 0.15s",
};
const subtleBtnGhost: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: c.ember,
  background: "transparent", border: `1px solid rgba(185,28,28,0.3)`,
  borderRadius: 8, padding: "8px 14px", cursor: "pointer", transition: "all 0.15s",
};
const dangerSolidBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 12, fontWeight: 600, color: c.cream,
  background: c.ember, border: "none",
  borderRadius: 8, padding: "8px 14px", cursor: "pointer", transition: "opacity 0.15s",
};


function InvoiceRow({ payment, divider }: { payment: PaymentRecord; divider: boolean }) {
  const d = new Date(payment.created_at);
  const dateLabel = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const amount = `₹${Math.round(payment.amount / 100)}`;
  const paid = payment.status === "completed";
  const tone = paid
    ? { label: "Paid", bg: c.success100, fg: c.sage, border: "rgba(21,128,61,0.28)" }
    : { label: payment.status, bg: c.error100, fg: c.ember, border: "rgba(185,28,28,0.28)" };
  const planLabel = payment.tier ? payment.tier.charAt(0).toUpperCase() + payment.tier.slice(1) : payment.plan;
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 16, alignItems: "center",
      padding: "14px 0", borderBottom: divider ? `1px solid ${c.border}` : "none",
    }}>
      <div style={{ fontFamily: font.ui, fontSize: 13, color: c.ivory, fontWeight: 600 }}>{dateLabel}</div>
      <div style={{ fontFamily: font.ui, fontSize: 12, color: c.stone }}>{planLabel}</div>
      <div style={{ fontFamily: font.mono, fontSize: 13, color: c.ivory }}>{amount}</div>
      <div style={{
        fontFamily: font.ui, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        color: tone.fg, background: tone.bg, border: `1px solid ${tone.border}`,
        borderRadius: 6, padding: "4px 8px",
      }}>{tone.label}</div>
    </div>
  );
}

export const PlanSection = memo(function PlanSection(props: PlanSectionProps) {
  const {
    authUser, tierLabel,
    confirmCancel, setConfirmCancel, cancelLoading, setCancelLoading, cancelMsg, setCancelMsg,
    confirmDelete, setConfirmDelete, deleteEmailInput, setDeleteEmailInput, deleteLoading, setDeleteLoading, deleteMsg, setDeleteMsg,
    exporting, setExporting, onExportCSV,
    payments, paymentsLoading,
    authUpdateUser, showToast, onLogout,
    authHeaders: getAuthHeaders,
  } = props;

  const tier = authUser?.subscriptionTier || "free";
  const isPaid = tier !== "free";
  const headline = tier === "pro"
    ? "Pro, invested in your offer"
    : tier === "starter"
      ? "Starter, building the habit"
      : "Practice on the house";
  const headlineDesc = isPaid
    ? "Manage your subscription, see your invoices, and export your data."
    : "Start free. Upgrade when you want unlimited reps and the negotiation coach.";

  let endDateLabel = "";
  let daysLeft = 0;
  if (isPaid && authUser?.subscriptionStart && authUser?.subscriptionEnd) {
    const end = new Date(authUser.subscriptionEnd).getTime();
    daysLeft = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
    endDateLabel = new Date(authUser.subscriptionEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  async function handleReactivate() {
    setCancelLoading(true); setCancelMsg("");
    try {
      const hdrs = await Promise.race([getAuthHeaders(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Auth timeout")), 5000))]);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch("/api/reactivate-subscription", { method: "POST", headers: hdrs, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data.success) { authUpdateUser({ cancelAtPeriodEnd: false }); showToast("Plan reactivated"); }
        else showToast(data.error || "Failed");
      } else {
        const d = await res.json().catch(() => ({})); showToast(d.error || `Failed (${res.status})`);
      }
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "AbortError" ? "Request timed out." : (err instanceof Error ? err.message : "Network error.");
      setCancelMsg(msg); showToast(msg);
    } finally { setCancelLoading(false); }
  }

  async function handlePauseToggle() {
    setCancelLoading(true);
    try {
      const hdrs = await Promise.race([getAuthHeaders(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Auth timeout")), 5000))]);
      const isPaused = !!authUser?.subscriptionPaused;
      const action = isPaused ? "resume" : "pause";
      const res = await fetch("/api/pause-subscription", { method: "POST", headers: hdrs, body: JSON.stringify({ action }) });
      if (res.ok) {
        const data = await res.json();
        if (data.success) { authUpdateUser({ subscriptionPaused: action === "pause" }); showToast(action === "pause" ? "Subscription paused" : "Subscription resumed"); }
        else showToast(data.error || "Failed");
      } else {
        const d = await res.json().catch(() => ({})); showToast(d.error || "Failed");
      }
    } catch { showToast("Network error"); } finally { setCancelLoading(false); }
  }

  async function handleConfirmCancel() {
    setCancelLoading(true); setCancelMsg("");
    try {
      const hdrs = await Promise.race([getAuthHeaders(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Auth timeout")), 5000))]);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch("/api/cancel-subscription", { method: "POST", headers: hdrs, signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          authUpdateUser({ cancelAtPeriodEnd: true });
          setConfirmCancel(false);
          showToast("Plan will cancel at end of period");
          track("subscription_cancelled", { tier: authUser?.subscriptionTier || "unknown" });
        } else { setCancelMsg(data.error || "Failed."); showToast(data.error || "Cancellation failed"); }
      } else {
        const d = await res.json().catch(() => ({})); setCancelMsg(d.error || `Error (${res.status}).`); showToast(d.error || "Cancellation failed");
      }
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "AbortError" ? "Request timed out." : "Network error.";
      setCancelMsg(msg); showToast(msg);
    } finally { setCancelLoading(false); }
  }

  async function handleFullJsonExport() {
    setExporting(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/export-user-data", { method: "GET", headers });
      if (!res.ok) { showToast("Export failed. Try again."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hirestepx-export-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Full data export downloaded.");
    } catch (err) {
      console.error("[settings] GDPR export failed:", err);
      showToast("Export failed. Try again.");
    } finally { setExporting(false); }
  }

  async function handleConfirmDelete() {
    setDeleteLoading(true); setDeleteMsg("");
    try {
      const hdrs = await Promise.race([getAuthHeaders(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Auth timeout")), 5000))]);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch("/api/delete-account", { method: "POST", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify({}), signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok || res.status === 207) {
        const data = await res.json().catch(() => ({}));
        if (data.scheduled) showToast("Account scheduled for deletion. Log in within 7 days to cancel.");
        localStorage.clear();
        onLogout();
      } else {
        const d = await res.json().catch(() => ({})); setDeleteMsg(d.error || "Failed. Try again."); setDeleteLoading(false);
      }
    } catch (err) {
      setDeleteMsg(err instanceof DOMException && err.name === "AbortError" ? "Timed out. Try again." : "Network error.");
      setDeleteLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 880 }}>
      <div>
        <div style={planKicker}>Plan & Data</div>
        <h2 style={planHeadline}>{headline}</h2>
        <p style={planDesc}>{headlineDesc}</p>
      </div>

      {/* Status strip for paid plans */}
      {isPaid && endDateLabel && (
        <div style={{ ...planCardOuter, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={subHeaderTitle}>
              {tierLabel}
              {authUser?.cancelAtPeriodEnd && (
                <span style={{ fontFamily: font.ui, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: c.error100, color: c.ember, letterSpacing: "0.06em", textTransform: "uppercase", marginLeft: 10 }}>Cancelling</span>
              )}
              {!authUser?.cancelAtPeriodEnd && authUser?.subscriptionPaused && (
                <span style={{ fontFamily: font.ui, fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: c.copper100, color: c.gilt, letterSpacing: "0.06em", textTransform: "uppercase", marginLeft: 10 }}>Paused</span>
              )}
            </div>
            <div style={subHeaderHint}>
              {authUser?.cancelAtPeriodEnd
                ? `Access remains until ${endDateLabel}.`
                : `Renews ${endDateLabel}. ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left in this cycle.`}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {authUser?.cancelAtPeriodEnd ? (
              <button disabled={cancelLoading} onClick={handleReactivate}
                style={{ ...subtleBtn, color: c.cream, background: c.sage, border: `1px solid ${c.sage}`, opacity: cancelLoading ? 0.6 : 1 }}>
                {cancelLoading ? "Reactivating..." : "Reactivate"}
              </button>
            ) : !confirmCancel ? (
              <>
                <button onClick={handlePauseToggle} style={subtleBtn} disabled={cancelLoading}>
                  {authUser?.subscriptionPaused ? "Resume" : "Pause"}
                </button>
                <button onClick={() => setConfirmCancel(true)} style={subtleBtnGhost}>Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setConfirmCancel(false)} style={subtleBtn}>Keep plan</button>
                <button disabled={cancelLoading} onClick={handleConfirmCancel} style={{ ...dangerSolidBtn, opacity: cancelLoading ? 0.6 : 1 }}>
                  {cancelLoading ? "Cancelling..." : "Yes, cancel"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {cancelMsg && <p style={{ fontFamily: font.ui, fontSize: 12, color: cancelMsg.includes("ancelled") ? c.sage : c.ember, margin: 0 }}>{cancelMsg}</p>}

      {/* This month */}
      <div style={{ ...planCardOuter, padding: "24px 28px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={subHeaderTitle}>This month</div>
          <div style={subHeaderHint}>Counted from your sessions table. Resets on the first of every month.</div>
        </div>
        <UsageThisMonth getAuthHeaders={getAuthHeaders} />
      </div>

      {/* Payment method — paid plans only */}
      {isPaid && (
        <div style={{ ...planCardOuter, padding: "20px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={keyValueLabel}>Payment method</div>
            <div style={keyValueValue}>Razorpay handles every renewal. Update card or UPI from their dashboard.</div>
          </div>
          <a href="https://razorpay.com/support/#request/merchant" target="_blank" rel="noopener noreferrer"
            style={{ ...subtleBtn, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            Manage on Razorpay
            <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      )}

      {/* Payment history */}
      <div style={{ ...planCardOuter, padding: "24px 28px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={subHeaderTitle}>Payment history</div>
          <div style={subHeaderHint}>Every successful Razorpay charge on your account.</div>
        </div>
        {paymentsLoading ? (
          <div style={{ fontFamily: font.ui, fontSize: 13, color: c.stone, padding: "16px 0" }}>Loading payment history…</div>
        ) : payments.length === 0 ? (
          <div style={{ fontFamily: font.ui, fontSize: 13, color: c.stone, padding: "16px 0" }}>No payments yet. Upgrade to start a billing history.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {payments.map((p, i) => (
              <InvoiceRow key={p.id} payment={p} divider={i < payments.length - 1} />
            ))}
          </div>
        )}
      </div>

      {/* Data */}
      <div style={{ ...planCardOuter, padding: "24px 28px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={subHeaderTitle}>Data</div>
          <div style={subHeaderHint}>Export everything, or delete on demand.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: `1px solid ${c.border}`, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={keyValueLabel}>Export sessions</div>
            <div style={keyValueValue}>CSV of every session, evaluation, and resume snapshot.</div>
          </div>
          <button type="button" disabled={exporting}
            onClick={async () => { setExporting(true); try { await onExportCSV(); } finally { setExporting(false); } }}
            style={{ ...subtleBtn, opacity: exporting ? 0.6 : 1 }}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: `1px solid ${c.border}`, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={keyValueLabel}>Full data export</div>
            <div style={keyValueValue}>JSON portable copy of your account, sessions, payments, and preferences.</div>
          </div>
          <button type="button" disabled={exporting} onClick={handleFullJsonExport} style={{ ...subtleBtn, opacity: exporting ? 0.6 : 1 }}>
            {exporting ? "Exporting…" : "Download JSON"}
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: `1px solid ${c.border}`, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={keyValueLabel}>Log out</div>
            <div style={keyValueValue}>Sign out on this device.</div>
          </div>
          <button type="button" onClick={onLogout} style={subtleBtn}>Log out</button>
        </div>

        {!confirmDelete ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ ...keyValueLabel, color: c.ember }}>Delete account</div>
              <div style={keyValueValue}>Scheduled for permanent deletion in 7 days. Log in within 7 days to cancel.</div>
            </div>
            <button type="button"
              onClick={() => { setConfirmDelete(true); setDeleteEmailInput(""); setDeleteMsg(""); }}
              style={subtleBtnGhost}>
              Delete account
            </button>
          </div>
        ) : (
          <div style={{ padding: "16px 0" }}>
            <div style={{ ...keyValueLabel, color: c.ember, marginBottom: 6 }}>Confirm delete</div>
            <div style={keyValueValue}>Type your email ({authUser?.email}) to confirm. This is reversible for 7 days.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input type="email" value={deleteEmailInput}
                onChange={(e) => setDeleteEmailInput(e.target.value)}
                placeholder="Type your email to confirm" aria-label="Confirm email for account deletion"
                style={{
                  fontFamily: font.ui, fontSize: 13, color: c.ivory, background: c.graphite,
                  border: `1px solid rgba(185,28,28,0.3)`, borderRadius: 8, padding: "9px 12px",
                  outline: "none", minWidth: 240, flex: 1,
                }} />
              <button type="button" onClick={() => { setConfirmDelete(false); setDeleteEmailInput(""); }} style={subtleBtn}>Keep account</button>
              <button type="button"
                disabled={deleteLoading || deleteEmailInput.toLowerCase() !== (authUser?.email || "").toLowerCase()}
                onClick={handleConfirmDelete}
                style={{ ...dangerSolidBtn, opacity: (deleteLoading || deleteEmailInput.toLowerCase() !== (authUser?.email || "").toLowerCase()) ? 0.45 : 1 }}>
                {deleteLoading ? "Deleting…" : "Confirm delete"}
              </button>
            </div>
            {deleteMsg && <p style={{ fontFamily: font.ui, fontSize: 12, color: c.ember, marginTop: 10, marginBottom: 0 }}>{deleteMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
});

