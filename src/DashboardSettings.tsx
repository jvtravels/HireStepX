"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, getStoredDeviceToken } from "./AuthContext";
import { useDocTitle } from "./useDocTitle";
import { authHeaders, getPaymentHistory, getSupabase, type PaymentRecord } from "./supabase";
import type { PersistedState } from "./dashboardTypes";
import { useDashboardCore, useDashboardUI } from "./DashboardContext";
import { DataLoadingSkeleton } from "./dashboardComponents";
import {
  icons,
  focusOutBase,
  AccountSection,
  InterviewSection,
  PlanSection,
} from "./settingsSections";

/* Cream-mode local tokens — mirror canvases/design-system/_tokens.ts. */
const c = {
  obsidian: "#FAF7F0",
  graphite: "#FFFFFF",
  border: "#EBE5D2",
  borderStrong: "#D6CDB5",
  gilt: "#B45309",
  ivory: "#0E0C08",
  chalk: "#0E0C08",
  stone: "#6E6759",
  sage: "#15803D",
  ember: "#B91C1C",
  indigo: "#312E81",
  cream: "#FAF7F0",
  creamSoft: "#F4EFE3",
};
const font = {
  display: "'Instrument Serif', Georgia, serif",
  ui: "'Satoshi', -apple-system, system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
};

const ALL_SECTIONS = [
  { id: "account", label: "Account", icon: icons.account },
  { id: "interview", label: "Interview", icon: icons.interview },
  { id: "plan", label: "Plan & Data", icon: icons.plan },
  { id: "referral", label: "Referral", icon: icons.referral },
] as const;

const SECTIONS = ALL_SECTIONS;

export default function SettingsPage() {
  useDocTitle("Settings");
  const { user: authUser, logout: authLogout, updateUser: authUpdateUser, resetPassword } = useAuth();
  const { persisted, updatePersisted: onUpdate, handleExportCSV: onExportCSV } = useDashboardCore();
  const { dataLoading, showToast, setShowUpgradeModal } = useDashboardUI();
  const onLogout = () => { authLogout(); };

  // Profile
  const [editName, setEditName] = useState(persisted.userName);
  const [editRole, setEditRole] = useState(persisted.targetRole);
  const [editCompany, setEditCompany] = useState(authUser?.targetCompany || "");
  const [editIndustry, setEditIndustry] = useState(authUser?.industry || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Danger zone
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");


  // Password
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Sessions — sign out other devices
  const [signOutOthersLoading, setSignOutOthersLoading] = useState(false);
  const [signOutOthersDone, setSignOutOthersDone] = useState(false);
  const [signOutOthersError, setSignOutOthersError] = useState<string | null>(
    null,
  );
  // Recent devices read from user_metadata. The first entry matches
  // the current active_device_token (this is the device we're on now).
  const [recentDevices, setRecentDevices] = useState<
    Array<{ id: string; ua?: string; at?: number; isCurrent: boolean }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const client = await getSupabase();
        const { data, error } = await client.auth.getUser();
        if (cancelled || error || !data?.user) return;
        const meta = data.user.user_metadata as
          | { recent_devices?: Array<{ id: string; ua?: string; at?: number }>; active_device_token?: string }
          | undefined;
        const list = meta?.recent_devices || [];
        const current = meta?.active_device_token;
        setRecentDevices(
          list.map((d) => ({ ...d, isCurrent: d.id === current })),
        );
      } catch {
        /* non-fatal — devices list just stays empty */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Export
  const [exporting, setExporting] = useState(false);

  // Section nav
  const pillsRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>("account");

  // Billing history
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const paymentsLoadedRef = useRef(false);
  useEffect(() => {
    if (activeSection !== "plan" || paymentsLoadedRef.current || !authUser?.id) return;
    paymentsLoadedRef.current = true;
    setPaymentsLoading(true);
    getPaymentHistory(authUser.id).then(setPayments).finally(() => setPaymentsLoading(false));
  }, [activeSection, authUser?.id]);

  const isDirty = editName !== persisted.userName || editRole !== persisted.targetRole || editCompany !== (authUser?.targetCompany || "") || editIndustry !== (authUser?.industry || "");

  // Auto-save on blur for text fields
  const focusOut = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    focusOutBase(e);
    setTimeout(() => {
      if (editName !== persisted.userName || editRole !== persisted.targetRole || editCompany !== (authUser?.targetCompany || "") || editIndustry !== (authUser?.industry || "")) {
        onUpdate({ userName: editName, targetRole: editRole });
        authUpdateUser({ name: editName, targetRole: editRole, targetCompany: editCompany, industry: editIndustry });
        showToast("Saved");
      }
    }, 0);
  }, [editName, editRole, editCompany, editIndustry, persisted.userName, persisted.targetRole, authUser?.targetCompany, authUser?.industry, onUpdate, authUpdateUser, showToast]);

  // Auto-save dirty profile fields when switching tabs
  const switchSection = useCallback((id: string) => {
    if (isDirty) {
      onUpdate({ userName: editName, targetRole: editRole });
      authUpdateUser({ name: editName, targetRole: editRole, targetCompany: editCompany, industry: editIndustry });
      showToast("Profile saved");
    }
    setActiveSection(id);
  }, [isDirty, editName, editRole, editCompany, editIndustry, onUpdate, authUpdateUser, showToast]);

  // Keyboard navigation for pills
  const handlePillKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next = (idx + 1) % SECTIONS.length; }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); next = (idx - 1 + SECTIONS.length) % SECTIONS.length; }
    if (next >= 0) {
      switchSection(SECTIONS[next].id);
      const buttons = pillsRef.current?.querySelectorAll<HTMLButtonElement>("button");
      buttons?.[next]?.focus();
    }
  };

  // beforeunload guard
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);



  if (dataLoading) return <DataLoadingSkeleton />;

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    onUpdate({ userName: editName, targetRole: editRole });
    await authUpdateUser({ name: editName, targetRole: editRole, targetCompany: editCompany, industry: editIndustry });
    setSaving(false); setSaved(true);
    showToast("Profile saved");
    setTimeout(() => setSaved(false), 3000);
  };

  const autoSave = (updates: Partial<PersistedState>) => onUpdate(updates);

  const handlePasswordReset = async () => {
    if (!authUser?.email) return;
    setResetLoading(true);
    const result = await resetPassword(authUser.email);
    setResetLoading(false);
    if (result.success) { setResetSent(true); showToast("Password reset email sent"); setTimeout(() => setResetSent(false), 10000); }
    else showToast(result.error || "Failed to send reset email");
  };

  const handleSignOutOtherDevices = async () => {
    if (signOutOthersLoading || signOutOthersDone) return;
    setSignOutOthersLoading(true);
    setSignOutOthersError(null);
    try {
      // Route through the server so user_metadata.active_device_token
      // is rotated in the same transaction as the session revocation.
      // The client-only path (supabase.auth.signOut({ scope: "others" }))
      // revoked tokens but left this device's metadata snapshot stale,
      // which let a refreshed Settings page show kicked-off devices as
      // still active until the next sign-in rotated metadata.
      const headers = await authHeaders();
      const deviceToken = getStoredDeviceToken();
      if (!deviceToken) {
        setSignOutOthersError("Missing device token");
        showToast("Couldn't sign out other devices. Try again.");
        return;
      }
      const res = await fetch("/api/signout-other-devices", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceToken,
          userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSignOutOthersError(data.error || `HTTP ${res.status}`);
        showToast("Couldn't sign out other devices. Try again.");
        return;
      }
      // Reflect the trimmed device list locally — the server pinned
      // recent_devices to just this device.
      setRecentDevices((prev) => prev.filter((d) => d.isCurrent));
      setSignOutOthersDone(true);
      showToast("All other devices signed out");
      setTimeout(() => setSignOutOthersDone(false), 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setSignOutOthersError(msg);
      showToast("Couldn't sign out other devices. Try again.");
    } finally {
      setSignOutOthersLoading(false);
    }
  };

  const difficultyVal = persisted.defaultDifficulty || "standard";
  const learningVal = authUser?.learningStyle || "direct";
  const experienceVal = authUser?.experienceLevel || "";
  const tierLabel = (authUser?.subscriptionTier || "free").charAt(0).toUpperCase() + (authUser?.subscriptionTier || "free").slice(1);

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      {/* ── Page Header ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontFamily: font.display, fontSize: 36, fontWeight: 400, color: c.ivory, margin: "0 0 6px", letterSpacing: "-0.02em", lineHeight: 1.05 }}>Settings</h2>
        <p style={{ fontFamily: font.ui, fontSize: 14, color: c.stone, lineHeight: 1.55, margin: 0, maxWidth: 640 }}>
          Tune HireStepX to match how you practice.
        </p>
      </div>

      {/* ── Section Navigation ── */}
      <div ref={pillsRef} role="tablist" aria-label="Settings sections" className="settings-pills" style={{
        display: "flex", gap: 4, marginBottom: 32, overflowX: "auto", paddingBottom: 2,
        borderBottom: `1px solid ${c.border}`, paddingRight: 2,
      }}>
        {SECTIONS.map((s, i) => (
          <button key={s.id} role="tab" aria-selected={activeSection === s.id} tabIndex={activeSection === s.id ? 0 : -1}
            onClick={() => switchSection(s.id)} onKeyDown={(e) => handlePillKeyDown(e, i)}
            style={{
              fontFamily: font.ui, fontSize: 13, fontWeight: 500, whiteSpace: "nowrap",
              padding: "10px 16px", cursor: "pointer", transition: "all 0.2s ease",
              background: "transparent", borderRadius: 0,
              border: "none", borderBottom: `2px solid ${activeSection === s.id ? c.gilt : "transparent"}`,
              color: activeSection === s.id ? c.ivory : c.stone,
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: -1,
            }}
            onMouseEnter={(e) => { if (activeSection !== s.id) e.currentTarget.style.color = c.chalk; }}
            onMouseLeave={(e) => { if (activeSection !== s.id) e.currentTarget.style.color = c.stone; }}
          >
            <span style={{ opacity: activeSection === s.id ? 1 : 0.5, transition: "opacity 0.2s", color: activeSection === s.id ? c.gilt : "currentColor" }}>{s.icon}</span>
            {s.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════ ACCOUNT ═══════════════════ */}
      {activeSection === "account" && (
        <AccountSection
          editName={editName} setEditName={setEditName}
          editCompany={editCompany} setEditCompany={setEditCompany}
          editIndustry={editIndustry} setEditIndustry={setEditIndustry}
          userName={persisted.userName} email={authUser?.email || ""}
          tierLabel={tierLabel} subscriptionTier={authUser?.subscriptionTier}
          isDirty={isDirty} saving={saving} saved={saved}
          handleSave={handleSave}
          resetLoading={resetLoading} resetSent={resetSent}
          handlePasswordReset={handlePasswordReset}
          isOAuthOnly={authUser?.signedInVia === "google"}
          signOutOthersLoading={signOutOthersLoading}
          signOutOthersDone={signOutOthersDone}
          signOutOthersError={signOutOthersError}
          handleSignOutOtherDevices={handleSignOutOtherDevices}
          recentDevices={recentDevices}
          focusOut={focusOut}
        />
      )}

      {/* ═══════════════════ INTERVIEW ═══════════════════ */}
      {activeSection === "interview" && (
        <InterviewSection
          editRole={editRole} setEditRole={setEditRole}
          focusOut={focusOut}
          difficultyVal={difficultyVal} learningVal={learningVal} experienceVal={experienceVal}
          autoSave={autoSave} authUpdateUser={authUpdateUser} showToast={showToast}
        />
      )}

      {/* ═══════════════════ PLAN & BILLING ═══════════════════ */}
      {activeSection === "plan" && (
        <PlanSection
          authUser={authUser} tierLabel={tierLabel}
          confirmCancel={confirmCancel} setConfirmCancel={setConfirmCancel}
          cancelLoading={cancelLoading} setCancelLoading={setCancelLoading}
          cancelMsg={cancelMsg} setCancelMsg={setCancelMsg}
          confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
          deleteEmailInput={deleteEmailInput} setDeleteEmailInput={setDeleteEmailInput}
          deleteLoading={deleteLoading} setDeleteLoading={setDeleteLoading}
          deleteMsg={deleteMsg} setDeleteMsg={setDeleteMsg}
          exporting={exporting} setExporting={setExporting}
          onExportCSV={onExportCSV}
          payments={payments} paymentsLoading={paymentsLoading}
          authUpdateUser={authUpdateUser} showToast={showToast}
          setShowUpgradeModal={setShowUpgradeModal} onLogout={onLogout}
          authHeaders={authHeaders}
        />
      )}

      {/* ═══════════════════ REFERRAL ═══════════════════ */}
      {activeSection === "referral" && <ReferralSection showToast={showToast} />}
    </div>
  );
}

/* ─── Referral Section Component (self-contained with its own state) ─── */

interface ReferralInviteRow {
  id: string;
  name: string;
  email: string;
  status: "pending" | "redeemed" | "rewarded";
  createdAt: string;
}

const REFERRAL_CAP = 6;

function ReferralSection({ showToast }: { showToast: (msg: string) => void }) {
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

  const referralLink = referralCode && typeof window !== "undefined"
    ? `${window.location.origin}/signup?ref=${referralCode}`
    : "";
  const shortLink = referralCode ? `hirestepx.com/r/${referralCode.toLowerCase()}` : "";

  const handleCopy = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    showToast("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!referralLink) return;
    const text = `Hey! I've been using HireStepX to practice for interviews with AI - it's really helped me improve. Try it out: ${referralLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleShareEmail = () => {
    if (!referralLink) return;
    const subject = "Try HireStepX - AI Mock Interviews";
    const body = `Hey!\n\nI've been using HireStepX to practice for interviews with AI interviewers. It gives detailed feedback on STAR method, speech analytics, and more.\n\nSign up with my referral link: ${referralLink}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const earned = Math.min(stats.rewarded, REFERRAL_CAP);
  const remaining = Math.max(REFERRAL_CAP - earned, 0);
  const pct = (earned / REFERRAL_CAP) * 100;

  const cardStyle: React.CSSProperties = {
    background: c.graphite,
    border: `1px solid ${c.border}`,
    borderRadius: 16,
    boxShadow: "0 1px 0 rgba(20,17,10,.03), 0 1px 2px rgba(20,17,10,.04), 0 12px 32px -16px rgba(20,17,10,.10)",
  };
  const kickerStyle: React.CSSProperties = { fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: c.gilt, letterSpacing: "0.12em", textTransform: "uppercase" };
  const headlineStyle: React.CSSProperties = { fontFamily: font.display, fontSize: 36, fontWeight: 400, color: c.ivory, margin: "8px 0 10px", letterSpacing: "-0.02em", lineHeight: 1.1 };
  const descStyle: React.CSSProperties = { fontFamily: font.ui, fontSize: 14, color: c.stone, lineHeight: 1.55, margin: 0, maxWidth: 640 };
  const sectionLabel: React.CSSProperties = { fontFamily: font.ui, fontSize: 11, fontWeight: 600, color: c.stone, letterSpacing: "0.08em", textTransform: "uppercase" };

  const primaryBtn: React.CSSProperties = {
    fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.cream,
    background: c.indigo, border: `1px solid ${c.indigo}`,
    borderRadius: 10, padding: "10px 18px", cursor: "pointer", transition: "all 0.15s",
  };
  const ghostBtn: React.CSSProperties = {
    fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory,
    background: c.graphite, border: `1px solid ${c.borderStrong}`,
    borderRadius: 10, padding: "10px 18px", cursor: "pointer", transition: "all 0.15s",
  };
  const linkBtn: React.CSSProperties = {
    fontFamily: font.ui, fontSize: 13, fontWeight: 600, color: c.ivory,
    background: "transparent", border: "none",
    padding: "10px 8px", cursor: "pointer",
  };

  if (loading) {
    return (
      <div style={{ ...cardStyle, padding: 28 }}>
        <span style={{ fontFamily: font.ui, fontSize: 13, color: c.stone }}>Loading referral info...</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 880 }}>
      <div>
        <div style={kickerStyle}>Referral</div>
        <h2 style={headlineStyle}>Bring a friend, earn a month</h2>
        <p style={descStyle}>
          They get 20% off their first Pro month. You get a free month when they convert.
          {" "}{earned} earned, {remaining} to go before the lifetime cap.
        </p>
      </div>

      <div style={{ ...cardStyle, padding: "28px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 28, alignItems: "start" }}>
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
              {shortLink ? (
                <>hirestepx.com/r/<span style={{ color: c.gilt }}>{referralCode?.toLowerCase()}</span></>
              ) : "—"}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
              <button type="button" onClick={handleCopy} style={primaryBtn}>
                {copied ? "Copied!" : "Copy link"}
              </button>
              <button type="button" onClick={handleShareWhatsApp} style={ghostBtn}>Share on WhatsApp</button>
              <button type="button" onClick={handleShareEmail} style={linkBtn}>Email a friend</button>
            </div>
          </div>

          <div style={{ padding: "20px 22px", borderRadius: 12, background: c.creamSoft, border: `1px solid ${c.border}` }} aria-label="Lifetime referral progress">
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontFamily: font.ui, fontSize: 13, color: c.ivory, fontWeight: 600 }}>Free months earned</span>
              <span style={{ fontFamily: font.mono, fontSize: 12, color: c.stone }}>{earned} of {REFERRAL_CAP}</span>
            </div>
            <div role="progressbar" aria-label="Free months earned" aria-valuemin={0} aria-valuemax={REFERRAL_CAP} aria-valuenow={earned} style={{ position: "relative", height: 8, background: c.border, borderRadius: 100 }}>
              <div style={{ position: "absolute", left: 0, top: 0, height: 8, width: `${pct}%`, background: c.gilt, borderRadius: 100, transition: "width 0.3s" }} />
            </div>
            <div style={{ fontFamily: font.ui, fontSize: 12, color: c.stone, marginTop: 10, lineHeight: 1.5 }}>
              Each converted invite adds one month, capped at six.
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...cardStyle, padding: "24px 28px" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: font.ui, fontSize: 14, fontWeight: 700, color: c.ivory }}>Your invites</div>
          <div style={{ fontFamily: font.ui, fontSize: 12, color: c.stone, marginTop: 4, lineHeight: 1.5 }}>
            We tell you when they sign up, and again when they convert.
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
      </div>
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
    ? { label: "Converted", bg: "#DCFCE7", fg: c.sage, border: "rgba(21,128,61,0.28)" }
    : invite.status === "redeemed"
      ? { label: "Joined", bg: "#E5E2F2", fg: c.indigo, border: "rgba(49,46,129,0.28)" }
      : { label: "Pending", bg: "#FEF3C7", fg: "#A16207", border: "rgba(161,98,7,0.28)" };
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 16, alignItems: "center",
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
