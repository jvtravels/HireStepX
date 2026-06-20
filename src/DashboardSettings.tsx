"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, getStoredDeviceToken } from "./AuthContext";
import { useDocTitle } from "./useDocTitle";
import { authHeaders, getPaymentHistory, getSupabase, type PaymentRecord } from "./supabase";
import { useDashboardCore, useDashboardUI } from "./DashboardContext";
import { DataLoadingSkeleton } from "./dashboardComponents";
import {
  icons,
  focusOutBase,
  AccountSection,
  PlanSection,
  ReferralSection,
} from "./settingsSections";

/* Cream-mode tokens — derive from the single source of truth so a WCAG
 * fix in auth/_tokens.ts can never silently undo itself here. */
import { tokens as T, fonts as F } from "./auth/_tokens";
const c = {
  obsidian: T.cream,
  graphite: "#FDFCF7",         // settings uses a slightly warmer raised surface than dashboard
  border: T.line,
  borderStrong: T.lineStrong,
  gilt: T.copper,
  ivory: T.coal,
  chalk: T.coal,
  stone: T.inkSoft,
  sage: T.success,
  ember: T.error,
  indigo: T.indigo,
  cream: T.cream,
  creamSoft: T.creamSoft,
} as const;
const font = {
  display: F.serif,
  ui: F.sans,
  mono: F.mono,
} as const;

const ALL_SECTIONS = [
  { id: "account", label: "Account", icon: icons.account },
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
  const [editCity, setEditCity] = useState(authUser?.city || "");
  const [editExperience, setEditExperience] = useState(authUser?.experienceLevel || "");
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

  const isDirty = editName !== persisted.userName || editRole !== persisted.targetRole || editCompany !== (authUser?.targetCompany || "") || editIndustry !== (authUser?.industry || "") || editCity !== (authUser?.city || "") || editExperience !== (authUser?.experienceLevel || "");

  // Auto-save on blur for text fields
  const focusOut = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    focusOutBase(e);
    setTimeout(() => {
      if (editName !== persisted.userName || editRole !== persisted.targetRole || editCompany !== (authUser?.targetCompany || "") || editIndustry !== (authUser?.industry || "") || editCity !== (authUser?.city || "")) {
        onUpdate({ userName: editName, targetRole: editRole });
        authUpdateUser({ name: editName, targetRole: editRole, targetCompany: editCompany, industry: editIndustry, city: editCity });
        showToast("Saved");
      }
    }, 0);
  }, [editName, editRole, editCompany, editIndustry, editCity, persisted.userName, persisted.targetRole, authUser?.targetCompany, authUser?.industry, authUser?.city, onUpdate, authUpdateUser, showToast]);

  // Auto-save dirty profile fields when switching tabs
  const switchSection = useCallback((id: string) => {
    if (isDirty) {
      onUpdate({ userName: editName, targetRole: editRole });
      authUpdateUser({ name: editName, targetRole: editRole, targetCompany: editCompany, industry: editIndustry, city: editCity, experienceLevel: editExperience });
      showToast("Profile saved");
    }
    setActiveSection(id);
  }, [isDirty, editName, editRole, editCompany, editIndustry, editCity, editExperience, onUpdate, authUpdateUser, showToast]);

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

  // Number hotkeys (1/2/3) for tab nav — skip when user is typing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tgt?.isContentEditable) return;
      const idx = "123".indexOf(e.key);
      if (idx < 0 || idx >= SECTIONS.length) return;
      e.preventDefault();
      switchSection(SECTIONS[idx].id);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [switchSection]);



  if (dataLoading) return <DataLoadingSkeleton />;

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    onUpdate({ userName: editName, targetRole: editRole });
    await authUpdateUser({ name: editName, targetRole: editRole, targetCompany: editCompany, industry: editIndustry, city: editCity, experienceLevel: editExperience });
    setSaving(false); setSaved(true);
    showToast("Profile saved");
    setTimeout(() => setSaved(false), 3000);
  };

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

  const tierLabel = (authUser?.subscriptionTier || "free").charAt(0).toUpperCase() + (authUser?.subscriptionTier || "free").slice(1);

  return (
    <div style={{ width: "100%", maxWidth: 880, margin: "0 auto", isolation: "isolate" }}>
      <style>{`
        /* ── Settings mobile fixes ────────────────────────────────────────
           On ≤1023px the dashboard main has paddingTop:76px (clearing the
           56px fixed nav header + 20px gap). The sticky header's -12px
           margin collapses that gap to 64px → flush with the nav.
           Override to 0 so "Settings" heading gets the full 20px gap. */
        @media (max-width: 1023px) {
          .settings-sticky-header { margin-top: 0 !important; }
        }
        /* ── Tab overflow fix at 375px ────────────────────────────────────
           Three tabs (Account | Plan & Data | Referral) plus keyboard-shortcut
           kbd badges (~22px each) total ~402px — wider than the 351px
           content column at 375px. Hide the badges on touch and tighten
           horizontal tab padding so all 3 tabs fit without scrolling. */
        @media (max-width: 600px) {
          .settings-pills kbd { display: none !important; }
          .settings-pills button { padding-left: 10px !important; padding-right: 10px !important; }
        }
      `}</style>
      {/* ── Sticky Header + Tabs ── */}
      <div className="settings-sticky-header" style={{
        position: "sticky", top: 0, zIndex: 10,
        background: c.obsidian,
        margin: "-12px 0 24px",
        padding: "12px 0 16px",
        boxShadow: `0 8px 12px -10px rgba(0,0,0,0.06)`,
      }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontFamily: font.display, fontSize: "clamp(28px, 5.5vw, 36px)", fontWeight: 400, color: c.ivory, margin: "0 0 6px", letterSpacing: "-0.02em", lineHeight: 1.05 }}>Settings</h2>
          <p className="settings-page-sub" style={{ fontFamily: font.ui, fontSize: 14, color: c.stone, lineHeight: 1.55, margin: 0, maxWidth: 640 }}>
            Tune HireStepX to match how you practice.
          </p>
        </div>

        {/* ── Section Navigation ── */}
        <div ref={pillsRef} role="tablist" aria-label="Settings sections" className="settings-pills" style={{
          display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2,
          borderBottom: `1px solid ${c.border}`, paddingRight: 2,
        }}>
        {SECTIONS.map((s, i) => (
          <button key={s.id} role="tab" aria-selected={activeSection === s.id} tabIndex={activeSection === s.id ? 0 : -1}
            onClick={() => switchSection(s.id)} onKeyDown={(e) => handlePillKeyDown(e, i)}
            title={`${s.label} (press ${i + 1})`}
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
            <kbd aria-hidden="true" style={{
              fontFamily: font.mono, fontSize: 10, fontWeight: 600,
              color: activeSection === s.id ? c.gilt : c.stone,
              background: activeSection === s.id ? "rgba(180,83,9,0.08)" : "transparent",
              border: `1px solid ${activeSection === s.id ? "rgba(180,83,9,0.28)" : c.border}`,
              borderRadius: 4, padding: "1px 5px", marginLeft: 2,
              lineHeight: 1.2, letterSpacing: 0,
            }}>{i + 1}</kbd>
          </button>
        ))}
        </div>
      </div>

      {/* ═══════════════════ ACCOUNT ═══════════════════ */}
      {activeSection === "account" && (
        <AccountSection
          editName={editName} setEditName={setEditName}
          editRole={editRole} setEditRole={setEditRole}
          editCompany={editCompany} setEditCompany={setEditCompany}
          editIndustry={editIndustry} setEditIndustry={setEditIndustry}
          editCity={editCity} setEditCity={setEditCity}
          editExperience={editExperience} setEditExperience={setEditExperience}
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
          authUpdateUser={authUpdateUser}
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

