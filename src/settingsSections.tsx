import type React from "react";
import { memo, useEffect, useState } from "react";
import { track } from "@vercel/analytics";
import { authHeaders, type PaymentRecord } from "./supabase";
import { useAuth, referralSignupUrl } from "./AuthContext";
import { captureClientEvent } from "./posthogClient";
import { useDashboardSubscription } from "./DashboardContext";


/* Cream-mode local tokens — mirror tempo/designs/canvases/design-system/_tokens.ts
   and DashboardLayout. Same keys as the old dark `c` so JSX style values
   keep compiling; values are now cream / coal / copper / indigo. */
const c = {
  obsidian: "#FAF7F0",
  graphite: "#FDFCF7",
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

export const focusOutBase = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = c.border;
  e.currentTarget.style.boxShadow = "none";
};

export const focusIn = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = "rgba(180,83,9,0.5)";
  e.currentTarget.style.boxShadow = `0 0 0 3px ${c.copper100}`;
};

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

export const accSubtleBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory,
  background: c.graphite, border: `1px solid ${c.borderStrong}`, borderRadius: 9,
  padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

export const accSubtleBtnGhost: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.stone,
  background: "transparent", border: "none", borderRadius: 9,
  padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

export const dangerSubtleBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ember,
  background: "transparent", border: `1px solid rgba(185,28,28,0.3)`,
  borderRadius: 9, padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

export const dangerSolidBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.cream,
  background: c.ember, border: "none",
  borderRadius: 9, padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

export const successSubtleBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.cream,
  background: c.sage, border: `1px solid ${c.sage}`,
  borderRadius: 9, padding: "10px 14px", cursor: "pointer", minHeight: 40,
};

export const indigoPrimaryBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.cream,
  background: c.indigo, border: `1px solid ${c.indigo}`,
  borderRadius: 9, padding: "10px 16px", cursor: "pointer", minHeight: 40,
};

export const indigoGhostBtn: React.CSSProperties = {
  fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory,
  background: c.graphite, border: `1px solid ${c.borderStrong}`,
  borderRadius: 9, padding: "10px 16px", cursor: "pointer", minHeight: 40,
};

export function SectionHead({ kicker: k, title, desc, tone }: { kicker?: string; title: string; desc?: string; tone?: "danger" }) {
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

export function EditorialCard({ children, density = "default" }: { children: React.ReactNode; density?: "default" | "tight" }) {
  return (
    <div className="editorial-card" data-density={density} style={{
      background: c.graphite, border: `1px solid ${c.border}`, borderRadius: 14,
      boxShadow: shadow.sm,
      padding: density === "tight" ? "20px 24px" : "28px 32px",
    }}>{children}</div>
  );
}

export function KeyValue({ label, value, right }: { label: string; value: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", gap: 16, flexWrap: "wrap" }}>
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
    userName, email,
    resetLoading, resetSent, handlePasswordReset, isOAuthOnly,
    signOutOthersLoading, signOutOthersDone, signOutOthersError,
    handleSignOutOtherDevices,
    recentDevices,
    focusOut,
    authUpdateUser,
  } = props;

  const initial = (userName || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40, maxWidth: 880 }}>
      {/* ── Profile group ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHead title="Profile" desc="The basics we use to personalise interview prompts and coaching." />
      <EditorialCard>
        <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
          <div aria-hidden="true" style={{
            width: 64, height: 64, borderRadius: "50%",
            background: c.indigoDeep, color: c.cream, fontFamily: font.display, fontSize: 28,
            display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: "0.02em", flexShrink: 0,
          }}>{initial}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: font.ui, fontSize: 16, fontWeight: 700, color: c.ivory, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userName || "Your name"}</div>
            <div style={{ fontFamily: font.ui, fontSize: 13, color: c.stone, marginTop: 4 }}>
              {email}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }} className="settings-form-grid">
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
      </div>

      {/* ── Security group ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            value="You signed in with Google: manage your password in your Google Account."
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
          recentDevices.slice(0, 2).map((d, idx, arr) => {
            const seen = d.at ? formatRelative(d.at) : "Unknown";
            const label = parseUserAgent(d.ua || "");
            return (
              <div key={d.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 0", gap: 16, flexWrap: "wrap",
                borderBottom: idx < arr.length - 1 ? `1px solid ${c.border}` : "none",
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

        <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
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
  getAuthHeaders, planName,
}: { getAuthHeaders: () => Promise<Record<string, string>>; planName?: string }) {
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
  // Label reflects the active plan so users see exactly what they're spending.
  const mockLabel = planName ? `Sessions with ${planName}` : "Mock interviews completed";
  return (
    <div>
      <UsageBar label={mockLabel} row={data.mock} />
      <UsageBar label="Resume parses" row={data.resume_parses} />
    </div>
  );
});

/* Always-visible extra sessions row. Green when credits exist, muted when zero.
   Gives users a persistent anchor to know purchased credits are a thing. */
function ExtraSessionsInfoBox() {
  const { creditBalance } = useDashboardSubscription();
  const hasCredits = creditBalance > 0;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 14px", borderRadius: 8, marginTop: 4,
      background: hasCredits ? c.success100 : "rgba(180,83,9,0.06)",
      border: hasCredits ? `1px solid rgba(21,128,61,0.25)` : "1px solid rgba(180,83,9,0.18)",
    }}>
      <span style={{ fontFamily: font.ui, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
        color: hasCredits ? "#166534" : c.gilt }}>
        {hasCredits ? (
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        )}
        Extra sessions available
      </span>
      <span style={{ fontFamily: font.mono, fontSize: 14, fontWeight: 700,
        color: hasCredits ? c.sage : c.gilt, opacity: hasCredits ? 1 : 0.55 }}>
        {creditBalance}
      </span>
    </div>
  );
}

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
    signedInVia?: "google" | "email";
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
  // Credit reconciliation
  onReconcileCredits?: () => Promise<void>;
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
const planCardOuter: React.CSSProperties = {
  background: c.graphite,
  border: `1px solid ${c.border}`,
  borderRadius: 14,
  boxShadow: shadow.sm,
  padding: "24px 28px",
};
const subHeaderTitle: React.CSSProperties = { fontFamily: font.ui, fontSize: 14, fontWeight: 700, color: c.ivory };
const subHeaderHint: React.CSSProperties = { fontFamily: font.ui, fontSize: 12, color: c.stone, marginTop: 4, lineHeight: 1.5 };
const keyValueLabel: React.CSSProperties = { fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory };
const keyValueValue: React.CSSProperties = { fontFamily: font.ui, fontSize: 12, color: c.stone, lineHeight: 1.5, marginTop: 2 };


function InvoiceRow({ payment, divider }: { payment: PaymentRecord; divider: boolean }) {
  const d = new Date(payment.created_at);
  const dateLabel = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const amountDisplay = `₹${Math.round(payment.amount / 100)}`;
  const paid = payment.status === "completed";
  const tone = paid
    ? { label: "Paid", bg: c.success100, fg: c.sage, border: "rgba(21,128,61,0.28)" }
    : { label: payment.status, bg: c.error100, fg: c.ember, border: "rgba(185,28,28,0.28)" };

  // Derive a human-readable purchase title from plan + amount.
  // payment.plan: "single" | "weekly" | "monthly"
  // payment.tier: "free" | "starter" | "pro" (unreliable for single — always "free")
  const isSingle = payment.plan === "single";
  const isWeekly = payment.plan === "weekly";
  // Single-session: ₹9 each (900 paise). Derive qty from total amount.
  const sessionQty = isSingle ? Math.round(payment.amount / 900) : 0;

  const purchaseTitle = isSingle
    ? `${sessionQty} extra session${sessionQty !== 1 ? "s" : ""}`
    : isWeekly ? "Interview Sprint Pack"
    : payment.plan === "monthly" ? "Pro Plan — Monthly"
    : payment.tier
      ? payment.tier.charAt(0).toUpperCase() + payment.tier.slice(1) + " Plan"
      : payment.plan;

  // Sub-line: period for subscriptions, credit note for single purchases.
  let subLine = "";
  if (isSingle) {
    subLine = "Added to session credits · never expire";
  } else if (payment.subscription_start && payment.subscription_end) {
    const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    subLine = `${fmt(payment.subscription_start)} – ${fmt(payment.subscription_end)}`;
  }

  return (
    <div style={{
      padding: "14px 0", borderBottom: divider ? `1px solid ${c.border}` : "none",
      display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16,
    }}>
      {/* Left: date + purchase detail */}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontFamily: font.ui, fontSize: 13, color: c.ivory, fontWeight: 600, whiteSpace: "nowrap" }}>{dateLabel}</span>
          <span style={{ fontFamily: font.ui, fontSize: 13, color: c.ivory, fontWeight: 500 }}>{purchaseTitle}</span>
        </div>
        {subLine && (
          <p style={{ margin: "3px 0 0", fontFamily: font.ui, fontSize: 11, color: c.stone, lineHeight: 1.4 }}>{subLine}</p>
        )}
      </div>

      {/* Right: amount + badge + receipt */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 600, color: c.ivory }}>{amountDisplay}</span>
        <div style={{
          fontFamily: font.ui, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
          color: tone.fg, background: tone.bg, border: `1px solid ${tone.border}`,
          borderRadius: 6, padding: "4px 8px",
        }}>{tone.label}</div>
        {payment.receipt_url && (
          <a href={payment.receipt_url} target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: font.ui, fontSize: 11, color: c.gilt, textDecoration: "none", whiteSpace: "nowrap" }}
            onMouseEnter={e => { e.currentTarget.style.textDecoration = "underline"; }}
            onMouseLeave={e => { e.currentTarget.style.textDecoration = "none"; }}
          >Receipt →</a>
        )}
      </div>
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

  // Re-auth gate: password re-entry before destructive identity action.
  // Local state — not hoisted into the parent because no other section
  // reads it, and we want it cleared the moment confirmDelete flips off.
  const [deletePasswordInput, setDeletePasswordInput] = useState("");

  const tier = authUser?.subscriptionTier || "free";
  const isPaid = tier !== "free";
  // OAuth-only accounts have no password to verify against — server-side
  // we'd be re-auth-gating against something that doesn't exist. Detect
  // via the auth provider on the user; if it's google-only, skip the
  // password field and rely on the email-confirm + bearer alone.
  const isOAuthOnlyUser = authUser?.signedInVia === "google";
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


  async function handleConfirmDelete() {
    setDeleteLoading(true); setDeleteMsg("");
    try {
      const hdrs = await Promise.race([getAuthHeaders(), new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Auth timeout")), 5000))]);
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      // Re-auth gate: send the user's password so the server can verify
      // possession-of-credentials, not just possession-of-bearer.
      // OAuth-only users have no app password — server skips the check
      // for them; sending an empty string is fine (server only verifies
      // when present and non-empty for non-OAuth users).
      const body = isOAuthOnlyUser ? {} : { password: deletePasswordInput };
      const res = await fetch("/api/delete-account", { method: "POST", headers: { ...hdrs, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
      clearTimeout(t);
      if (res.ok || res.status === 207) {
        const data = await res.json().catch(() => ({}));
        if (data.scheduled) showToast("Account scheduled for deletion. Log in within 7 days to cancel.");
        localStorage.clear();
        onLogout();
      } else {
        const d = await res.json().catch(() => ({}));
        // On failed re-auth, clear the password input so the user retypes
        // rather than re-submitting the same wrong value.
        if (d?.code === "reauth_required" || d?.code === "reauth_failed") setDeletePasswordInput("");
        setDeleteMsg(d.error || "Failed. Try again."); setDeleteLoading(false);
      }
    } catch (err) {
      setDeleteMsg(err instanceof DOMException && err.name === "AbortError" ? "Timed out. Try again." : "Network error.");
      setDeleteLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 880 }}>
      <SectionHead title={headline} desc={headlineDesc} />

      {/* Status band for paid plans (inline, not a card) */}
      {isPaid && endDateLabel && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 16, flexWrap: "wrap",
          padding: "4px 0 18px", borderBottom: `1px solid ${c.border}`,
          marginTop: -8,
        }}>
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
                style={{ ...successSubtleBtn, opacity: cancelLoading ? 0.6 : 1 }}>
                {cancelLoading ? "Reactivating..." : "Reactivate"}
              </button>
            ) : !confirmCancel ? (
              <>
                <button onClick={handlePauseToggle} style={accSubtleBtn} disabled={cancelLoading}>
                  {authUser?.subscriptionPaused ? "Resume" : "Pause"}
                </button>
                <button onClick={() => setConfirmCancel(true)} style={dangerSubtleBtn}>Cancel</button>
              </>
            ) : (
              <>
                <button onClick={() => setConfirmCancel(false)} style={accSubtleBtn}>Keep plan</button>
                <button disabled={cancelLoading} onClick={handleConfirmCancel} style={{ ...dangerSolidBtn, opacity: cancelLoading ? 0.6 : 1 }}>
                  {cancelLoading ? "Cancelling..." : "Yes, cancel"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {cancelMsg && <p style={{ fontFamily: font.ui, fontSize: 12, color: c.ember, margin: 0 }}>{cancelMsg}</p>}

      {/* This period — plan usage bars (no session-quota row; extra credits shown inline) */}
      <div style={{ ...planCardOuter }}>
        <div style={{ marginBottom: 16 }}>
          <div style={subHeaderTitle}>This period</div>
          <div style={subHeaderHint}>Completed interviews and resource usage for your active billing period.</div>
        </div>
        <UsageThisMonth
          getAuthHeaders={getAuthHeaders}
          planName={tier.charAt(0).toUpperCase() + tier.slice(1)}
        />
        <ExtraSessionsInfoBox />
      </div>

      {/* Payment method — paid plans only */}
      {isPaid && (
        <div style={{ ...planCardOuter, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={keyValueLabel}>Payment method</div>
            <div style={keyValueValue}>Razorpay handles every renewal. Update card or UPI from their dashboard.</div>
          </div>
          <a href="https://razorpay.com/support/#request/merchant" target="_blank" rel="noopener noreferrer"
            style={{ ...accSubtleBtn, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
            Manage on Razorpay
            <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      )}

      {/* Payment history */}
      <div style={{ ...planCardOuter }}>
        <div style={{ marginBottom: 16 }}>
          <div style={subHeaderTitle}>Payment history</div>
          <div style={subHeaderHint}>Every successful Razorpay charge on your account.</div>
        </div>
        {paymentsLoading ? (
          <div style={{ fontFamily: font.ui, fontSize: 13, color: c.stone, padding: "16px 0" }}>Loading payment history…</div>
        ) : payments.length === 0 ? (
          <div style={{ fontFamily: font.ui, fontSize: 13, color: c.stone, padding: "16px 0" }}>No payments yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {payments.map((p, i) => (
              <InvoiceRow key={p.id} payment={p} divider={i < payments.length - 1} />
            ))}
          </div>
        )}
      </div>

      {/* Data */}
      <div style={{ ...planCardOuter }}>
        <div style={{ marginBottom: 16 }}>
          <div style={subHeaderTitle}>Data</div>
          <div style={subHeaderHint}>Export your session history or sign out on this device.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", borderBottom: `1px solid ${c.border}`, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={keyValueLabel}>Export sessions</div>
            <div style={keyValueValue}>CSV of every completed session: questions, your answers, scores, and the resume snapshot used.</div>
          </div>
          <button type="button" disabled={exporting}
            onClick={async () => { setExporting(true); try { await onExportCSV(); } finally { setExporting(false); } }}
            style={{ ...accSubtleBtn, opacity: exporting ? 0.6 : 1 }}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        {/* Sync credits button removed — balance now updates automatically via
            Supabase Realtime subscription in DashboardContext. The /api/credit-reconcile
            endpoint and onReconcileCredits prop are kept as a support escape-hatch
            but no longer surfaced in the UI for normal users. */}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 0", flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={keyValueLabel}>Log out</div>
            <div style={keyValueValue}>Sign out on this device. Other devices stay signed in.</div>
          </div>
          <button type="button" onClick={onLogout} style={accSubtleBtn}>Log out</button>
        </div>
      </div>

      {/* Danger zone */}
      <div style={{ ...planCardOuter, borderColor: "rgba(185,28,28,0.28)" }}>
        {!confirmDelete ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontFamily: font.mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: c.ember, textTransform: "uppercase", marginBottom: 4 }}>Danger zone</div>
              <div style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: c.ember, marginBottom: 2 }}>Delete account</div>
              <div style={subHeaderHint}>Removes your account and all data. A 7-day grace period lets you cancel by logging in.</div>
            </div>
            <button type="button"
              onClick={() => { setConfirmDelete(true); setDeleteEmailInput(""); setDeletePasswordInput(""); setDeleteMsg(""); }}
              style={{ ...dangerSubtleBtn, flexShrink: 0 }}>
              Begin deletion
            </button>
          </div>
        ) : (() => {
          const emailMatches = deleteEmailInput.toLowerCase() === (authUser?.email || "").toLowerCase();
          // OAuth users skip the password gate (no app password exists).
          // For everyone else, require a non-empty password before enabling submit.
          const passwordOk = isOAuthOnlyUser || deletePasswordInput.length > 0;
          const submitDisabled = deleteLoading || !emailMatches || !passwordOk;
          return (
          <div>
            <div style={{ ...keyValueLabel, color: c.ember, marginBottom: 6 }}>Confirm deletion</div>
            <div style={keyValueValue}>
              Type your email ({authUser?.email})
              {isOAuthOnlyUser ? " to confirm" : " and re-enter your password to confirm"}.
              Reversible for 7 days after submit.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <input type="email" value={deleteEmailInput}
                onChange={(e) => setDeleteEmailInput(e.target.value)}
                aria-label="Confirm email for account deletion"
                autoComplete="off"
                style={{
                  fontFamily: font.ui, fontSize: 13, color: c.ivory, background: c.graphite,
                  border: `1px solid rgba(185,28,28,0.3)`, borderRadius: 9, padding: "10px 14px",
                  outline: "none", minWidth: 0, width: "100%", minHeight: 40, boxSizing: "border-box",
                }} />
              {!isOAuthOnlyUser && (
                <input type="password" value={deletePasswordInput}
                  onChange={(e) => setDeletePasswordInput(e.target.value)}
                  aria-label="Re-enter password to confirm account deletion"
                  placeholder="Re-enter your password"
                  autoComplete="current-password"
                  style={{
                    fontFamily: font.ui, fontSize: 13, color: c.ivory, background: c.graphite,
                    border: `1px solid rgba(185,28,28,0.3)`, borderRadius: 9, padding: "10px 14px",
                    outline: "none", minWidth: 0, width: "100%", minHeight: 40, boxSizing: "border-box",
                  }} />
              )}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 4 }}>
                <button type="button" onClick={() => { setConfirmDelete(false); setDeleteEmailInput(""); setDeletePasswordInput(""); }} style={accSubtleBtn}>Keep account</button>
                <button type="button"
                  disabled={submitDisabled}
                  onClick={handleConfirmDelete}
                  style={{ ...dangerSolidBtn, opacity: submitDisabled ? 0.45 : 1 }}>
                  {deleteLoading ? "Deleting…" : "Confirm delete"}
                </button>
              </div>
            </div>
            {deleteMsg && <p style={{ fontFamily: font.ui, fontSize: 12, color: c.ember, marginTop: 10, marginBottom: 0 }}>{deleteMsg}</p>}
          </div>
          );
        })()}
      </div>
    </div>
  );
});

/* ═══════════════════════════════════════════════════════════════
   REFERRAL SECTION
   ═══════════════════════════════════════════════════════════════ */

interface ReferralInviteRow {
  id: string;
  name: string;
  email: string;
  status: "pending" | "redeemed" | "rewarded";
  createdAt: string;
}


export function ReferralSection({ showToast }: { showToast: (msg: string) => void }) {
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, redeemed: 0, rewarded: 0 });
  const [invites, setInvites] = useState<ReferralInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const headers = await authHeaders();
        const [codeRes, invitesRes] = await Promise.all([
          fetch("/api/referral", { headers }),
          fetch("/api/referral-invites", { headers }),
        ]);
        if (codeRes.ok) {
          const data = await codeRes.json();
          setReferralCode(data.code);
          setStats(data.stats);
        }
        if (invitesRes.ok) {
          const data = await invitesRes.json();
          if (Array.isArray(data.invites)) setInvites(data.invites as ReferralInviteRow[]);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id]);

  const referralLink = referralCode ? referralSignupUrl(referralCode) : "";
  // Display the real, working link (sans protocol) rather than a prettier
  // hirestepx.com/r/<code> short link that has no redirect behind it — a link
  // we show must be a link that actually resolves.
  const displayLink = referralLink.replace(/^https?:\/\//, "");

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    showToast("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
    captureClientEvent("referral_invite_sent", { surface: "settings", channel: "copy" });
  };

  const handleShareWhatsApp = () => {
    if (!referralLink) return;
    const text = `Hey! I've been practising interviews on HireStepX with an AI that scores your answers. Sign up with my link and we each get a free session: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    captureClientEvent("referral_invite_sent", { surface: "settings", channel: "whatsapp" });
  };

  const handleShareEmail = () => {
    if (!referralLink) return;
    const subject = "Try HireStepX - AI Mock Interviews";
    const body = `Hey!\n\nI've been using HireStepX to practice for interviews with AI interviewers. It gives detailed feedback on STAR method, speech analytics, and more.\n\nSign up with my link and we each get a free practice session: ${referralLink}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    captureClientEvent("referral_invite_sent", { surface: "settings", channel: "email" });
  };

  const sectionLabel: React.CSSProperties = { fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: c.stone, letterSpacing: "0.08em", textTransform: "uppercase" };

  const linkBtn: React.CSSProperties = {
    fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory,
    background: "transparent", border: "none",
    padding: "10px 8px", cursor: "pointer",
  };

  if (loading) {
    return (
      <EditorialCard>
        <span style={{ fontFamily: font.ui, fontSize: 13, color: c.stone }}>Loading referral info...</span>
      </EditorialCard>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 880 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHead
        title="Bring a friend — you both get a free session"
        desc={`When a friend signs up with your link, you each get a free practice session, credited instantly. ${stats.rewarded} earned so far.`}
      />

      <EditorialCard>
        <div className="settings-referral-grid" style={{ display: "grid", gap: 28, alignItems: "start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={sectionLabel}>Your referral link</div>
            <div style={{
              marginTop: 12,
              display: "inline-flex", alignItems: "center",
              padding: "14px 18px", borderRadius: 12,
              background: c.creamSoft, border: `1px solid ${c.border}`,
              fontFamily: font.mono, fontSize: 15, color: c.ivory,
              maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {displayLink ? (
                <span style={{ color: c.gilt }}>{displayLink}</span>
              ) : "—"}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" onClick={handleCopy} style={indigoPrimaryBtn}>
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button type="button" onClick={handleShareWhatsApp} style={indigoGhostBtn}>Share on WhatsApp</button>
              <button type="button" onClick={handleShareEmail} style={linkBtn}>Email a friend</button>
            </div>
          </div>

          <div style={{ padding: "20px 22px", borderRadius: 12, background: c.creamSoft, border: `1px solid ${c.border}` }} aria-label="Referral rewards">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: font.ui, fontSize: 13, color: c.ivory, fontWeight: 600 }}>Free sessions earned</span>
              <span style={{ fontFamily: font.mono, fontSize: 18, fontWeight: 700, color: c.gilt }}>{stats.rewarded}</span>
            </div>
            <div style={{ fontFamily: font.ui, fontSize: 12, color: c.stone, marginTop: 10, lineHeight: 1.5 }}>
              {stats.redeemed} friend{stats.redeemed === 1 ? "" : "s"} joined with your link. You both get a free session the moment they sign up — no purchase needed.
            </div>
          </div>
        </div>
      </EditorialCard>
      </div>

      <EditorialCard>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 700, color: c.ivory }}>Your invites</div>
          <div style={{ fontFamily: font.ui, fontSize: 12, color: c.stone, marginTop: 4, lineHeight: 1.5 }}>
            We tell you the moment a friend joins with your link.
          </div>
        </div>
        {invites.length === 0 ? (
          <div style={{ fontFamily: font.ui, fontSize: 13, color: c.stone, padding: "20px 0" }}>
            No invites yet. Share your link to see them here.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {invites.map((inv, i) => (
              <ReferRow key={inv.id} invite={inv} divider={i < invites.length - 1} />
            ))}
          </div>
        )}
      </EditorialCard>
    </div>
  );
}

function ReferRow({ invite, divider }: { invite: ReferralInviteRow; divider: boolean }) {
  const initials = invite.name
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";
  const ts = invite.createdAt ? relativeTime(invite.createdAt) : "";
  const tone = invite.status === "rewarded"
    ? { label: "Rewarded", bg: "#DCFCE7", fg: c.sage, border: "rgba(21,128,61,0.28)" }
    : invite.status === "redeemed"
      ? { label: "Joined", bg: "#E5E2F2", fg: c.indigo, border: "rgba(49,46,129,0.28)" }
      : { label: "Pending", bg: "#FEF3C7", fg: "#A16207", border: "rgba(161,98,7,0.28)" };
  return (
    <div className="settings-refer-row" style={{
      display: "grid", gap: 16, alignItems: "center",
      padding: "14px 0", borderBottom: divider ? `1px solid ${c.border}` : "none",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: c.indigo, color: c.cream,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: font.ui, fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
      }}>{initials}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 600, color: c.ivory, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{invite.name}</div>
        <div style={{ fontFamily: font.ui, fontSize: 12, color: c.stone, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{invite.email}</div>
      </div>
      <div style={{ fontFamily: font.ui, fontSize: 12, color: c.stone }}>{ts}</div>
      <div style={{
        fontFamily: font.ui, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
        color: tone.fg, background: tone.bg, border: `1px solid ${tone.border}`,
        borderRadius: 6, padding: "4px 8px",
      }}>{tone.label}</div>
    </div>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const day = 86_400_000;
  const days = Math.floor(diff / day);
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

